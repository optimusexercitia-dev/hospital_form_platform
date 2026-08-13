-- =============================================================================
-- Bulk case creation — "Múltiplos casos".
--
-- One atomic RPC that DEALS many cases across committee members in a single
-- transaction: for each row it composes the EXISTING doors (never re-implements
-- them) — create_case_from_template (snapshot phases/version/custom-fields/
-- narratives + HC068 required-check + recompute_recommendations), activate_phase
-- (first phase live, assigned + due-dated, case -> in_review via the
-- recompute_case_status trigger), optional downstream pre-assignment +
-- assign_narrative (all_phases scope), and set_case_patient (the audited,
-- coordinator-only, patient_enabled + name-or-MRN-floor PHI single door; Rule 12).
--
-- All-or-nothing: any row failing rolls back the WHOLE batch (incl. any PHI). The
-- per-row error is RE-RAISED with a `linha N:` prefix (SQLSTATE preserved) so the
-- client can jump back to the offending grid row.
--
-- Composition contract VERIFIED against the LIVE catalog (pg_get_functiondef /
-- pg_proc / pg_trigger — NOT migration text, ADR 0078):
--   * create_case_from_template(uuid,text,uuid,text,uuid,jsonb) RETURNS cases;
--     asserts cases_multi_phase; sets/clears app.in_case_rpc itself.
--   * activate_phase(uuid,uuid,date) RETURNS case_phases; status->active +
--     assigned_to + due_date; enforces member (HC021) + blocks (HC018); the case
--     -> in_review transition is app.trg_recompute_case_status (AFTER UPDATE OF
--     status on case_phases), NOT inside the fn.
--   * app.guard_case_phase_status PERMITS any non-status field change while
--     current_setting('app.in_case_rpc') = 'on' -> the downstream assigned_to-only
--     UPDATE on a pending phase is sanctioned under that GUC (set via set_config
--     with is_local = true).
--   * assign_narrative(uuid,uuid) RETURNS void; open-narrative only; admin-gated.
--   * set_case_patient(uuid,text,text,date,int,text,text,text,text) RETURNS void;
--     delegates to set_participant_patient (atomic, audited, coordinator-only,
--     patient_enabled + name-or-MRN floor).
--   * mint_case_number is a BEFORE-INSERT trigger already taking a per-commission
--     pg_advisory_xact_lock (held for the whole tx) — concurrency is auto-handled;
--     this RPC ALSO takes that lock up-front to close the pre-first-insert window.
--
-- PHI: adds NO new PHI store; reuses the participant single door per row. Rule 12
-- intact.
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- 1. Feature flag (default OFF; seed forces ON for local/E2E, mirroring
--    case_custom_fields — the migration NEVER enables it in production).
-- -----------------------------------------------------------------------------
insert into app.feature_flags (key, enabled, description)
values (
  'cases_bulk_create',
  false,
  'Bulk case creation ("Múltiplos casos"): the bulk_create_cases RPC deals many '
  || 'cases across committee members in one atomic transaction and activates each '
  || 'first phase (assigned + due-dated). Coordinator-only. Default off; seed '
  || 'forces ON for local/E2E.'
)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 2. assert_bulk_create_enabled — mirrors app.assert_cases_enabled.
-- -----------------------------------------------------------------------------
create or replace function app.assert_bulk_create_enabled()
returns void
language plpgsql
stable
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  if not app.feature_enabled('cases_bulk_create') then
    raise exception 'o recurso de criação de casos em massa não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 3. bulk_create_cases — the atomic dealer.
--
--    p_rows = [{ label:text?, assigned_to:uuid, custom_fields:[{key,value}]?,
--                patient:{ name,mrn,date_of_birth,age_years,sex,encounter_ref,
--                          unit,attending }? }]
--    p_phase_scope ∈ ('first_only','all_phases'); p_deadline rides the first
--    phase's due_date ONLY.
-- -----------------------------------------------------------------------------
create or replace function public.bulk_create_cases(
  p_template_id uuid,
  p_deadline date,
  p_phase_scope text,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission_id uuid;
  v_status text;
  v_count integer;
  v_i integer := 0;
  r_row jsonb;
  v_label text;
  v_assigned_to uuid;
  v_custom_fields jsonb;
  v_patient jsonb;
  v_case public.cases;
  v_first_phase_id uuid;
  v_assignee uuid;
  v_narr_id uuid;
begin
  -- Both gates: the composed create_case_from_template asserts cases_multi_phase
  -- itself, but assert early for a clean message; the bulk feature has its own flag.
  perform app.assert_cases_enabled();
  perform app.assert_bulk_create_enabled();

  select commission_id, status into v_commission_id, v_status
  from public.process_templates
  where id = p_template_id;
  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  -- Authority (the RPC is the boundary): coordinator / commission-admin of the
  -- template's commission. DELIBERATELY STRICTER than create_case_from_template's
  -- own gate (which also admits a create_cases Administrativo) — bulk dealing is a
  -- coordinator act (Design #9).
  if not (app.is_staff_admin_of(v_commission_id)
          or app.is_commission_admin_of(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  if v_status <> 'active' then
    raise exception 'apenas processos publicados podem iniciar casos'
      using errcode = 'check_violation';
  end if;

  if p_phase_scope is null or p_phase_scope not in ('first_only', 'all_phases') then
    raise exception 'escopo de fases inválido' using errcode = 'check_violation';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'nenhuma linha informada' using errcode = 'check_violation';
  end if;

  v_count := jsonb_array_length(p_rows);
  if v_count = 0 then
    raise exception 'informe ao menos um caso' using errcode = 'check_violation';
  end if;
  if v_count > 200 then
    raise exception 'no máximo 200 casos por lote (recebido %)', v_count
      using errcode = 'check_violation';
  end if;

  -- Serialize case_number minting for this commission up-front. mint_case_number
  -- (a BEFORE-INSERT trigger) takes this same lock per-insert; taking it here
  -- closes the pre-first-insert window and makes the batch atomic w.r.t. a
  -- concurrent single create on the same commission.
  perform pg_advisory_xact_lock(hashtextextended(v_commission_id::text, 0));

  -- Pre-validate: every row carries an assignee, and the DISTINCT assignee set are
  -- all members (clean early failure before minting anything).
  if exists (
    select 1 from jsonb_array_elements(p_rows) as e(elem)
    where nullif(e.elem ->> 'assigned_to', '') is null
  ) then
    raise exception 'cada caso precisa de um responsável' using errcode = 'check_violation';
  end if;

  for v_assignee in
    select distinct (e.elem ->> 'assigned_to')::uuid
    from jsonb_array_elements(p_rows) as e(elem)
  loop
    if not app.is_member_of_for(v_commission_id, v_assignee) then
      raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
    end if;
  end loop;

  -- Per-row loop. Each row's work runs in a subblock so a failure can be RE-RAISED
  -- with its 1-based row index; the re-raise propagates out and rolls back the
  -- ENTIRE batch (all-or-nothing, incl. PHI).
  for r_row in select e.elem from jsonb_array_elements(p_rows) as e(elem)
  loop
    v_i := v_i + 1;
    begin
      v_label := nullif(btrim(r_row ->> 'label'), '');
      v_assigned_to := (r_row ->> 'assigned_to')::uuid;
      v_custom_fields := coalesce(r_row -> 'custom_fields', '[]'::jsonb);
      v_patient := case
        when jsonb_typeof(r_row -> 'patient') = 'object' then r_row -> 'patient'
        else null
      end;

      -- (a) Create the case: snapshot phases + pinned versions + custom-field
      --     values (HC068 required-check) + narratives + recompute_recommendations.
      v_case := public.create_case_from_template(
        p_template_id, v_label, null, null, null, v_custom_fields
      );

      -- (b) Activate the LOWEST-position phase -> owner + deadline (rides due_date;
      --     the case -> in_review transition fires on the status change trigger).
      select cp.id into v_first_phase_id
      from public.case_phases cp
      where cp.case_id = v_case.id
      order by cp.position asc
      limit 1;
      if v_first_phase_id is null then
        raise exception 'o processo não possui fases' using errcode = 'check_violation';
      end if;

      perform public.activate_phase(v_first_phase_id, v_assigned_to, p_deadline);

      -- (c) all_phases: pre-assign the downstream PENDING phases to the same owner
      --     (guarded assigned_to-only UPDATE under app.in_case_rpc) + assign each
      --     open narrative. Deadline stays on the first phase ONLY (Design #3/#4).
      if p_phase_scope = 'all_phases' then
        perform set_config('app.in_case_rpc', 'on', true);
        update public.case_phases
        set assigned_to = v_assigned_to,
            updated_at = now()
        where case_id = v_case.id
          and status = 'pending';
        perform set_config('app.in_case_rpc', 'off', true);

        for v_narr_id in
          select cn.id
          from public.case_narratives cn
          where cn.case_id = v_case.id
            and cn.status = 'open'
        loop
          perform public.assign_narrative(v_narr_id, v_assigned_to);
        end loop;
      end if;

      -- (d) PHI (Rule 12): reuse the audited coordinator-only single door. Only
      --     when the row carries a patient; set_case_patient enforces
      --     patient_enabled + the name-or-MRN floor internally.
      if v_patient is not null then
        perform public.set_case_patient(
          v_case.id,
          nullif(btrim(v_patient ->> 'name'), ''),
          nullif(btrim(v_patient ->> 'mrn'), ''),
          nullif(v_patient ->> 'date_of_birth', '')::date,
          nullif(v_patient ->> 'age_years', '')::integer,
          coalesce(nullif(btrim(v_patient ->> 'sex'), ''), 'unknown'),
          nullif(btrim(v_patient ->> 'encounter_ref'), ''),
          nullif(btrim(v_patient ->> 'unit'), ''),
          nullif(btrim(v_patient ->> 'attending'), '')
        );
      end if;

    exception
      when others then
        -- Row-indexed re-raise (SQLSTATE preserved so the action's mapCaseError /
        -- mapCasePatientError still maps it). Aborts the whole batch.
        raise exception 'linha %: %', v_i, sqlerrm using errcode = sqlstate;
    end;
  end loop;

  -- One batch audit row (per-case + per-PHI audits already emit inside the composed
  -- fns). No identifiers in the metadata (Rule 11).
  perform app.audit_write(
    'cases.bulk_created',
    'process_template',
    p_template_id,
    v_commission_id,
    format('%s casos criados em massa', v_count),
    jsonb_build_object(
      'count', v_count,
      'template_id', p_template_id,
      'phase_scope', p_phase_scope,
      'deadline', p_deadline
    )
  );

  return v_count;
end;
$function$;

revoke all on function public.bulk_create_cases(uuid, date, text, jsonb) from public;
grant execute on function public.bulk_create_cases(uuid, date, text, jsonb)
  to authenticated, service_role;

commit;

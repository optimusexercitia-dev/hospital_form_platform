-- ADR 0134 — M4: the bulk two-key gate (PO ruling, option A), and the INVOKER rationale
-- for the creation-scoped PHI helper recorded IN THE CATALOG.
-- Local only on `feat/case-surface-split-2`; no remote push, no merge.
--
-- ── 1. WHY A SECOND KEY (and why no composed door was widened) ──────────────────────
-- ADR 0134 Amendment 1 §A1.2 opened bulk creation "under the existing `create_cases` key",
-- and its Consequences said Increment 2 gains "a `member_can(commission,'create_cases')` arm
-- on `bulk_create_cases`". That change was made in 20261003000600 and MEASURED INSUFFICIENT:
-- bulk composes three further doors, each with its own authority question —
--     (a) create_case_from_template  is_staff_admin_of OR member_can('create_cases')      ✔
--     (b) activate_phase             is_staff_admin_of OR member_can('assign_case_phases') ✘
--     (c) assign_narrative           is_staff_admin_of ONLY — no capability arm exists     ✘
--         (all_phases scope only)
-- The PO ruled option A: require BOTH existing keys, widen no door, and keep all_phases
-- coordinator-only. The PO was told explicitly this is two keys rather than one.
--
-- ── 2. WHY all_phases IS REFUSED AT THE GATE AND NOT IN THE LOOP ────────────────────
-- Because (c) has no capability arm, all_phases can never be satisfied by a delegate. Left
-- to fire where it naturally would — inside the per-row loop — that is a caller filling up
-- to 200 rows and losing every one of them to 'linha N: sem permissão'. That is the exact
-- failure shape A1.2 was ruled to remove, one scope down. It is therefore refused before
-- the advisory lock and before any row is minted, with its own pt-BR message naming the
-- scope.
--
-- ── 3. THE HELPER STAYS SECURITY INVOKER — and this is the safer direction ───────────
-- `app._set_participant_patient_unchecked` is the only SECURITY INVOKER writer of
-- `public.participants`, which trips pgTAP 276 O5 ("every writer of participants is
-- SECURITY DEFINER (no invoker-rights path in)"). The obvious fix — flip it to DEFINER —
-- WOULD HAVE REMOVED A SAFEGUARD. Measured 2026-08-22, both cells, in rolled-back
-- transactions, granting the helper EXECUTE to `authenticated` and calling it as
-- `authenticated`:
--     INVOKER, existing participant  -> ERROR: permission denied for table patient_participants
--     INVOKER, minting the chain     -> ERROR: new row violates RLS policy for case_participant_roles
--     DEFINER, same grant            -> SUCCEEDED, returned a participant uuid
-- ⇒ On the intended path there is no difference (the helper is called only from DEFINER
-- bodies owned by `postgres`). The difference appears only if the ACL ever leaks — and
-- there, INVOKER REFUSES and DEFINER WRITES PHI. O5's stated intent is "no invoker-rights
-- path in", a PROPERTY; `prosecdef` is a PROXY for it, correct for the two `public` doors
-- that `authenticated` can actually call. This helper satisfies the property by a stronger
-- mechanism — it cannot be called by an invoker at all (no EXECUTE, and `app` is not
-- PostgREST-exposed). O5 is amended to assert the property; the proxy is not the rule.
-- ⚠ Note the two INVOKER cells refused via DIFFERENT locks. The predicted one is the PHI
-- table grant; the mint path hits `case_participant_roles`' RLS first. Both refuse, but an
-- absence's MECHANISM is measured, not read off the gate you expected to fire.

CREATE OR REPLACE FUNCTION public.bulk_create_cases(p_template_id uuid, p_deadline date, p_phase_scope text, p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
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

  select t.commission_id,
         case when app.published_version_of_template(t.id) is not null
              then 'active' else 'draft' end
    into v_commission_id, v_status
  from public.process_templates t
  where t.id = p_template_id;
  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  -- Authority (the RPC is the boundary): the coordinator of the template's commission,
  -- OR an Administrativo holding BOTH `create_cases` AND `assign_case_phases` there.
  -- ⭐ TWO KEYS, NOT ONE (PO ruling 2026-08-22, option A). Widening this gate alone was
  -- NECESSARY AND NOT SUFFICIENT, and that was measured rather than predicted: bulk is a
  -- COMPOSITION. Step (b) calls `public.activate_phase`, whose own gate is
  -- `is_staff_admin_of OR member_can(commission,'assign_case_phases')` — so a
  -- `create_cases`-only delegate passed THIS gate and was then refused inside the per-row
  -- loop, rolling the whole batch back with 'linha N: sem permissão'. The second key is
  -- honest rather than bureaucratic: bulk really does activate phases, which is exactly
  -- what that key names. No composed door was widened to make this work.
  -- ⚠ REVERSED 2026-08-22 (ADR 0134 Amendment 1 §A1.2, PO-ruled). This block used to read
  -- "DELIBERATELY STRICTER than create_case_from_template's own gate … bulk dealing is a
  -- coordinator act (Design #9)". That design was OVERRULED: creating many cases carries
  -- the same logical responsibility as creating one, so the two doors now agree. The old
  -- sentence is quoted rather than deleted, because a reader who finds only the new text
  -- cannot tell a recorded decision was reversed rather than overlooked.
  -- ⛔ NO `app.is_admin()` DISJUNCT AND NO TENANCY ARM. Test 314 §11.34 is a CATALOG
  -- assertion listing this function among 29 doors whose comment-stripped body must not
  -- reference the tenancy-admin predicate, and the noun rule (ADR 0078 A35) keeps
  -- platform_admin out of commission content. `member_can` is itself membership-aware, so
  -- this widens to delegates of THIS commission and to nobody else.
  -- ⚠ The predicate's NAME is deliberately not spelled here: 11.34 strips comments before
  -- matching, so a mention would be harmless — but "you cannot quote the string you are
  -- asserting the absence of" has bitten this repo three times, once inside the comment
  -- warning about it. Not spelling it costs nothing.
  if not (app.is_staff_admin_of(v_commission_id)
          or (app.member_can(v_commission_id, 'create_cases')
              and app.member_can(v_commission_id, 'assign_case_phases'))) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  if v_status <> 'active' then
    raise exception 'apenas processos publicados podem iniciar casos'
      using errcode = 'check_violation';
  end if;

  if p_phase_scope is null or p_phase_scope not in ('first_only', 'all_phases') then
    raise exception 'escopo de fases inválido' using errcode = 'check_violation';
  end if;

  -- ⛔ all_phases IS COORDINATOR-ONLY, AND IT IS REFUSED HERE — AT THE GATE, BEFORE ANY
  -- ROW EXISTS. Step (c) of the per-row loop calls `public.assign_narrative`, whose gate is
  -- `app.is_staff_admin_of` ALONE — it has no capability arm at all, so NO combination of
  -- ADR-0061 keys can satisfy it. Discovered by measurement (the composition sweep), not
  -- by reading the ruling.
  -- ⚠ THE PLACEMENT IS THE POINT, not the refusal. Left to fire inside the loop, a
  -- non-coordinator would fill up to 200 rows, commit nothing, and get 'linha N:' back —
  -- the dead-end door ADR 0134 Amendment 1 §A1.2 was ruled to eliminate, reproduced one
  -- scope down. An honest refusal BEFORE any work is not a dead end; a rollback after 200
  -- rows is. The message names the scope so the caller knows which half to change.
  if p_phase_scope = 'all_phases' and not app.is_staff_admin_of(v_commission_id) then
    raise exception 'o escopo "todas as fases" é exclusivo da coordenação da comissão'
      using errcode = '42501';
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

      -- (d) PHI (Rule 12) — ADR 0134 Amendment 2 option D. WAS: the audited
      --     coordinator-only door `public.set_case_patient`, which refused every
      --     non-coordinator and rolled the WHOLE batch back after up to 200 rows had been
      --     filled in — the dead-end door T4 was overruled to avoid, at 200x the cost.
      --     NOW: the unchecked writer, reached only because the authority gate above has
      --     already admitted this caller FOR CREATION. Participant id is NULL by the
      --     structural property in the migration header (the helper is the only surface
      --     that can create a patient participant, so a case minted in this loop cannot
      --     already have one). Every shape check (patient_enabled, phi_disposed_at, the
      --     sex vocabulary, the ADR-0038 name-or-MRN floor) and the audit trigger are
      --     UNCHANGED — they live below the cut, so every door still gets them.
      if v_patient is not null then
        perform app._set_participant_patient_unchecked(
          v_case.id, null,
          nullif(btrim(v_patient ->> 'name'), ''),
          nullif(btrim(v_patient ->> 'mrn'), ''),
          nullif(v_patient ->> 'date_of_birth', '')::date,
          nullif(v_patient ->> 'age_years', '')::integer,
          coalesce(nullif(btrim(v_patient ->> 'sex'), ''), 'unknown'),
          nullif(btrim(v_patient ->> 'encounter_ref'), ''),
          nullif(btrim(v_patient ->> 'unit'), ''),
          nullif(btrim(v_patient ->> 'attending'), ''),
          null
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

-- The rationale above lives in the CATALOG too, so a reader running \df+ or querying
-- pg_description sees it without finding this file. A file comment can drift from the
-- object it describes; a COMMENT ON cannot.
comment on function app._set_participant_patient_unchecked(
  uuid, uuid, text, text, date, integer, text, text, text, text, uuid) is
  'ADR 0134 Amdt 2 option D — creation-scoped PHI writer. SECURITY INVOKER DELIBERATELY: '
  'called only from DEFINER bodies owned by postgres, so on the intended path INVOKER and '
  'DEFINER are identical; if the ACL ever leaks, INVOKER is REFUSED by the PHI tables '
  '(measured: "permission denied for table patient_participants") while DEFINER would '
  'WRITE. Do not flip it to DEFINER to satisfy pgTAP 276 O5 — that trades the second lock '
  'for a green test. O5 asserts the PROPERTY (no invoker-rights path in), which this '
  'function satisfies by being uncallable by an invoker at all.';

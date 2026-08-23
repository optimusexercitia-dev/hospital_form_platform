-- ADR 0134 / ADR 0078 A35 — PO RULING 2026-08-22, closing
-- FUP-CREATE-CASE-IS-ADMIN-DISJUNCT-VS-THE-NOUN-RULE.
--
-- THE RULING. Remove the platform-admin disjunct from `public.create_case`'s authority
-- gate. platform_admin loses case creation ENTIRELY; CLAUDE.md §1's noun rule (ADR 0078
-- A35 — platform_admin may administer tenancy, identity, vocabulary and audit, and may
-- NOT touch commission content or PHI) stands unamended. No exception was carved for
-- this door.
--
-- MEASURED FROM THE LIVE CATALOG (`pg_get_functiondef`, never migration text — some
-- migrations in this repo rewrite bodies at runtime, so a file is stale by design). Both
-- bodies below are the catalog's own output with the edits named here applied to it:
--   create_case        md5 cfed0fbed34ac5608e65b75ca3c62535  (before)
--   bulk_create_cases  md5 7c4529fc78150bf49c7d70adf7acc19f  (before)
--
-- (1) create_case — THE AUTHORITY GATE loses its third arm:
--       before: is_staff_admin_of(c) OR app.is_admin() OR member_can(c,'create_cases')
--       after:  is_staff_admin_of(c) OR member_can(c,'create_cases')
--     The refusal is unchanged in both halves — 'sem permissão', errcode 42501 — because
--     the ruling changes WHO is refused, not HOW.
--
-- (2) create_case — THE SECOND, PHI-SPECIFIC GATE IS DELETED, and this is the part a
--     narrow reading of the ruling misses. 20261003000800 did NOT touch the authority
--     gate; it ADDED a gate immediately after it whose predicate was exactly
--     "the authority gate MINUS the platform-admin arm". Cutting that arm makes the two
--     predicates IDENTICAL, so the PHI gate becomes STRUCTURALLY UNREACHABLE: past the
--     authority gate, `not (is_staff_admin_of or member_can)` is false by construction.
--     ⛔ Deleted rather than kept as a backstop, by lead ruling. A duplicated predicate is
--     not a second lock — this repo already ruled that way once, on `hasCaseStanding`'s
--     redundant Administrativo arm. Decisively: a dead gate that SILENTLY BECOMES LIVE if
--     the authority gate is later widened is worse than no gate, because whoever widens
--     the authority gate should have to decide about PHI explicitly rather than inherit a
--     bar they never knew existed. The collapse also makes create_case structurally
--     identical to `create_case_from_template`, which has one authority gate, no PHI gate,
--     and writes p_patient unconditionally past it.
--     ⚠ The pt-BR message 'apenas a coordenação da comissão ou um Administrativo
--     autorizado a criar casos pode registrar dados do paciente' therefore disappears from
--     this door. A refused platform_admin now gets 'sem permissão' from the authority gate,
--     BEFORE the case is minted — the M10 half-state property 000800 established is
--     preserved, and is preserved more strongly (they are now refused with or without a
--     PHI payload). Behavioural pins: supabase/tests/357 §8c, message asserted as well as
--     errcode so the test names WHICH gate refused.
--
-- (3) bulk_create_cases — COMMENT CORRECTION ONLY, byte-identical code. Its guard block
--     claimed "NO app.is_admin() DISJUNCT AND NO TENANCY ARM. Test 314 §11.34 is a CATALOG
--     assertion…". Measured: §11.34 pins the TENANCY predicate only. The platform-admin
--     half was claimed as covered and was pinned nowhere — a comment asserting coverage
--     that does not exist, which is how the same gap survived on create_case. Corrected to
--     say what §11.34 actually checks, and pointed at the NEW pin (314 §11.36) that covers
--     the other half across all three creation doors.
--
-- WHAT IS PINNED (red-first; all four were observed RED against the pre-change bodies):
--   357 §8c  — behavioural: a hatted platform_admin is refused at this door WITH and
--              WITHOUT a PHI payload, by message and errcode; both remaining arms still
--              create (the no-under-grant twin); the coordinator positive control stands.
--   357 §8d  — CATALOG, EXACTNESS: the authority gate's predicate set is exactly
--              {is_staff_admin_of, member_can('create_cases')} — the captured expression
--              text itself, so an added OR a removed arm reds, with the PHI consequence in
--              the failure message.
--   314 §11.36/§11.37 — CATALOG, FAMILY: not one of the three creation doors names the
--              platform-admin predicate, twinned with a detector positive control so the
--              zero cannot mean "the regexp matches nothing".
--
-- Local only. No push (the remote is deliberately behind).

CREATE OR REPLACE FUNCTION public.create_case(p_commission_id uuid, p_label text DEFAULT NULL::text, p_patient_enabled boolean DEFAULT false, p_outcome_ids uuid[] DEFAULT '{}'::uuid[], p_department_id uuid DEFAULT NULL::uuid, p_department_other text DEFAULT NULL::text, p_case_type_id uuid DEFAULT NULL::uuid, p_patient jsonb DEFAULT NULL::jsonb)
 RETURNS cases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_case public.cases;
  v_attempt integer := 0;
  v_bad uuid;
  v_dept_other text := nullif(btrim(p_department_other), '');
  -- O-1: default to today's column defaults; a supplied case_type overrides them.
  v_visibility text := 'commission_default';
  v_confidentiality text := 'non_phi_internal';
begin
  perform app.assert_cases_enabled();
  perform app.assert_processless_cases_enabled();

  if not exists (select 1 from public.commissions where id = p_commission_id) then
    raise exception 'comissão % não encontrada', p_commission_id using errcode = 'no_data_found';
  end if;

  -- ⛔ AUTHORITY — EXACTLY TWO ARMS, AND THE SET IS PINNED, NOT DESCRIBED.
  -- PO ruling 2026-08-22 (FUP-CREATE-CASE-IS-ADMIN-DISJUNCT-VS-THE-NOUN-RULE): the
  -- platform-admin disjunct that used to sit here is GONE. CLAUDE.md §1's noun rule
  -- (ADR 0078 A35) stands unamended — platform_admin administers tenancy, identity,
  -- vocabulary and audit, and does NOT touch commission content. A case is commission
  -- content, so platform_admin loses case creation entirely; the ruling was NOT to carve
  -- an exception for this door. This door was the SOLE outlier of the three creation
  -- doors (measured on the live catalog: create_case_from_template and bulk_create_cases
  -- never carried the arm), so the removal makes the family agree rather than inventing
  -- a new rule.
  -- ⚠ WIDENING THIS GATE WIDENS WHO MAY WRITE PHI AT CREATION (ADR 0134 Amendment 2 —
  -- the creation-scoped patient-identifier write below is gated by THIS line and nothing
  -- else). Do not add a disjunct here without answering the PHI question explicitly.
  -- ⛔ A COMMENT CANNOT CARRY THAT — supabase/tests/357 §8d pins this expression's exact
  -- text, so any added or removed arm reds with the PHI consequence in the failure
  -- message, and 314 §11.36 pins the same absence across all three creation doors.
  if not (app.is_staff_admin_of(p_commission_id)
          or app.member_can(p_commission_id, 'create_cases')) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- O-1 Rule-12 inheritance: a supplied case_type must resolve in the case's org
  -- (mirrors create_case_from_template's guard) AND sets visibility/confidentiality
  -- from the type (an Ethics type resolves explicit_grants_only). Guarded by the
  -- case_types flag so the path is inert until E3a is live.
  if p_case_type_id is not null and app.feature_enabled('case_types') then
    select default_visibility_policy, default_confidentiality_level
      into v_visibility, v_confidentiality
    from public.case_types
    where id = p_case_type_id
      and organization_id = app.org_of_commission(p_commission_id);
    if not found then
      raise exception 'tipo de caso não encontrado para esta organização'
        using errcode = 'no_data_found';
    end if;
  end if;

  if p_department_id is not null and v_dept_other is not null then
    raise exception 'informe um setor da lista OU um valor personalizado, não ambos'
      using errcode = '23514';
  end if;
  if p_department_id is not null
     and not app.department_belongs_to_commission(p_department_id, p_commission_id) then
    raise exception 'este setor não pertence ao hospital deste caso'
      using errcode = 'HC030';
  end if;

  if cardinality(p_outcome_ids) > 0 then
    perform app.assert_extras_enabled();

    select oid into v_bad
    from unnest(p_outcome_ids) as oid
    where not exists (
      select 1 from public.case_outcomes o
      where o.id = oid
        and o.commission_id = p_commission_id
        and o.archived = false
    )
    limit 1;
    if found then
      raise exception 'este desfecho não pertence à comissão deste caso'
        using errcode = 'HC030';
    end if;
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases
        (commission_id, template_version_id, case_type_id, label, created_by, patient_enabled,
         department_id, department_other, visibility_policy, confidentiality_level)
      values
        (p_commission_id, null, p_case_type_id, nullif(btrim(p_label), ''), auth.uid(),
         coalesce(p_patient_enabled, false), p_department_id, v_dept_other,
         v_visibility, v_confidentiality)
      returning * into v_case;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then
          raise;
        end if;
    end;
  end loop;

  if cardinality(p_outcome_ids) > 0 then
    insert into public.case_offered_outcomes (case_id, outcome_id)
    select v_case.id, oid from unnest(p_outcome_ids) as oid
    on conflict do nothing;
  end if;

  perform set_config('app.in_case_rpc', 'off', true);

  -- ADR 0061 (revised): a NON-coordinator (capability-arm) creator self-grants a
  -- case_access READ — just enough to SEE the case they opened. Coordinators/commission
  -- admins already see the whole board — skip them. (Flag branch collapsed — B4.)
  if not (app.is_staff_admin_of(p_commission_id)) then
    perform app._grant_case_access_unchecked(v_case.id, auth.uid(), 'read', null, null, 'creator_self_grant');
  end if;

  -- ADR 0134 Amendment 2 option D — CREATION-SCOPED PHI WRITE. The authority question
  -- ("may you create cases here?") was answered above; this is the same act, not a
  -- second one. Participant id is NULL by the STRUCTURAL property in the header: the
  -- helper is the ONLY surface in the database that can create a patient participant,
  -- so a case cannot already have one here.
  if p_patient is not null then
    perform app._set_participant_patient_unchecked(
      v_case.id, null,
      nullif(btrim(p_patient ->> 'name'), ''),
      nullif(btrim(p_patient ->> 'mrn'), ''),
      nullif(p_patient ->> 'date_of_birth', '')::date,
      nullif(p_patient ->> 'age_years', '')::integer,
      coalesce(nullif(btrim(p_patient ->> 'sex'), ''), 'unknown'),
      nullif(btrim(p_patient ->> 'encounter_ref'), ''),
      nullif(btrim(p_patient ->> 'unit'), ''),
      nullif(btrim(p_patient ->> 'attending'), ''),
      null);
  end if;

  return v_case;
end;
$function$;

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
  -- ⛔ NO PLATFORM-ADMIN DISJUNCT AND NO TENANCY ARM — TWO SEPARATE PINS, NOT ONE.
  -- ⚠ CORRECTED 2026-08-22. This block used to say "Test 314 §11.34 is a CATALOG
  -- assertion" covering BOTH halves. It does not: §11.34 lists this function among the
  -- 29 ratified doors whose comment-stripped body must not reference the TENANCY-admin
  -- predicate, and that is ALL it checks. The platform-admin half was asserted here in
  -- prose and pinned NOWHERE, for as long as this comment claimed otherwise — which is
  -- precisely how the same missing arm went unnoticed on create_case until QA B1. The
  -- platform-admin half is now pinned by 314 §11.36 (all THREE creation doors), which is
  -- NEW coverage, not a restoration.
  -- The noun rule (ADR 0078 A35) keeps platform_admin out of commission content, and
  -- `member_can` is itself membership-aware, so this widens to delegates of THIS
  -- commission and to nobody else.
  -- ⚠ Neither predicate's NAME is spelled here: both pins strip comments before matching,
  -- so a mention would be harmless — but "you cannot quote the string you are asserting
  -- the absence of" has bitten this repo three times, once inside the comment warning
  -- about it. Not spelling them costs nothing.
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

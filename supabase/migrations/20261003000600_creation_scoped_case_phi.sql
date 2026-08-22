-- ADR 0134 Amendment 2 option D (M3) — CREATION-SCOPED PATIENT-IDENTIFIER WRITE.
-- A member holding the ADR-0061 `create_cases` capability may supply patient identifiers
-- AS PART OF CREATING A CASE — single or bulk. They may not read them, may not edit them
-- afterwards, and may not dispose of them. Local only on `feat/case-surface-split-2`;
-- no remote push, no merge. PO ruled option D on 2026-08-21.
--
-- ⚠ This is the platform's FIRST PHI WRITE PATH NOT HELD BY A COORDINATOR. That is the
-- fact a future auditor will find first, so the reasoning is attached to it here rather
-- than only in the ADR: ADR 0134 §A2.4 records the residual risks that were accepted
-- explicitly (cross-module amplification through the patient index, correction becoming a
-- coordinator queue, duplicate chains scaling with batch size).
--
-- ── WHY A SPLIT WRITER, AND WHY NOT THE TWO OBVIOUS ALTERNATIVES (§A2.2) ─────────────
-- ⛔ REJECTED — a GUC-conditioned gate (`current_setting('app.in_case_rpc')`). Measured:
--    22 functions set that GUC, and it means "a sanctioned case RPC is running", not
--    "this caller is entitled". Promoting it to an authority predicate would make all 22
--    sites — and every future one — PHI authorization sites, and it is outside every
--    authz ARM's domain by construction (they bound by prosecdef and policy presence).
-- ⛔ REJECTED — widening `public.set_participant_patient` with a "no identifiers yet"
--    condition. That door checks the COMMISSION, never the caller's relationship to the
--    CASE, so a member_can disjunct there would admit writing identities into ANY
--    patient-capable case in the commission that has none — including the coordinator's
--    and ethics cases. "First write wins" is not "a case I am creating".
--
-- ── ACCEPTED: ONE WRITER, TWO EXPLICIT GATES ────────────────────────────────────────
-- `app._set_participant_patient_unchecked` holds the whole body below the authority cut
-- (flag, shape validations, the ADR-0038 name-or-MRN floor, the participant chain, the
-- upsert, the has_patient denorm) and NO authority check. `public.set_participant_patient`
-- keeps its coordinator gate and delegates; the three creation RPCs — which have already
-- gated on "may you create cases here?" and hold a case they minted IN THE SAME
-- TRANSACTION — call the helper directly. Creation-scope is therefore STRUCTURAL rather
-- than predicate-based.
--
-- ⭐ THE STRUCTURAL CLAIM, RE-BASED ON A PROPERTY RATHER THAN ON TIMING (lead ruling).
-- An earlier draft argued the participant id may be NULL because "a case minted
-- microseconds earlier has no participant chain". That is a TIMING argument and it goes
-- stale the moment someone adds a step to the creation path. Measured instead, from the
-- catalog, over every non-system routine plus triggers/rules/policies/ACLs:
--     routines whose comment-stripped body INSERTs into patient_participants ... 1
--     non-internal triggers on patient_participants ......................... 0
--     rules ................................................................. 0
--     policies .............................................................. 0
--     relacl ....................... {postgres, service_role} — no authenticated/anon
--     control: routines mentioning patient_identifiers ...................... 6
-- (the control proves the sweep can find things, so the 1 is real and not a broken
-- predicate). That single inserter is `set_participant_patient` today and becomes THIS
-- HELPER after the split. ⇒ The only surface in the database that can create a patient
-- participant is the helper itself, so a case cannot acquire one except through it. That
-- survives a refactor: any new creation step that made a participant would have to come
-- through this same door.
-- ⇒ No `_resolve_case_patient_participant` helper is introduced. On the creation path such
-- a resolver could only ever return NULL, and a function that can only return NULL should
-- not exist.
--
-- ⚠ `assert_not_case_excluded` STAYS ON THE GATED SIDE and is deliberately absent from the
-- creation path. At creation time no recusal or exclusion can exist on a case that did not
-- exist a moment ago, so its absence there is safe BY CONSTRUCTION — written down because
-- it is an argument, not an assumption, and the next reader is owed it.
--
-- ── WHAT OPTION D DOES NOT GRANT (each verifiable from the catalog) ──────────────────
-- `read_standard_phi` (still S1-coordinator or an S3 grant whose own column is set — the
-- S8 non-leak proven in supabase/tests/356 §8 is untouched) · editing identifiers after
-- creation (`case_viewer_capabilities.can_manage_lifecycle` is coordinator-only) ·
-- `dispose_case_phi` (single-armed, unchanged) · `search_patient_xref` /
-- `patient_trajectory_bundle` (their gates are untouched) · anything in the event_patient
-- or referral_patient modules · close/cancel/set_outcome.
--
-- ⛔ NO PHI TRAVELS BACK. The lead narrowed §A2.4's "the response echoes the identifiers
-- just written" to a NON-PHI structural result: a response body carrying identifier values
-- to a principal holding no read_standard_phi would be a PHI READ PATH wearing a different
-- name. Neither RPC's return type changes — both still return `public.cases`, which carries
-- no identifier-shaped column (measured: zero). The typo-at-the-keyboard confirmation is
-- built client-side from the payload the user just submitted, which they already hold.
--
-- ⛔ `CREATE OR REPLACE` CANNOT ADD A PARAMETER — it would create an OVERLOAD, and
-- PostgREST 300s on an ambiguous candidate set. The two single-case doors are therefore
-- DROPped and recreated. `DROP FUNCTION` WITHOUT `CASCADE` (deliberate: if some object
-- depends on these, this migration must fail loudly rather than silently remove the
-- dependent), and DROP takes the ACL with it — so EXECUTE is re-issued below and
-- supabase/tests/357 pins the resulting proacl AND the overload count from the catalog.

-- ── 1. The unchecked writer (app; no authority; not PostgREST-reachable) ────────────
create or replace function app._set_participant_patient_unchecked(
  p_case_id uuid, p_participant_id uuid default null, p_name text default null,
  p_mrn text default null, p_date_of_birth date default null, p_age_years integer default null,
  p_sex text default 'unknown', p_encounter_ref text default null, p_unit text default null,
  p_attending text default null, p_role_id uuid default null
) returns uuid
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case public.cases;
  v_participant uuid := p_participant_id;
  v_role uuid := p_role_id;
begin
  -- ⛔ NO AUTHORITY CHECK BY DESIGN. Creation-scope is STRUCTURAL: this function lives in
  -- `app` (not PostgREST-exposed), holds no EXECUTE for authenticated/anon, and its only
  -- callers are four doors that have each already answered an authority question. The
  -- caller set is pinned BY PROPERTY in supabase/tests/357, so a fifth caller reds.
  --
  -- ⚠ THE FLAG ASSERT LIVES HERE, not only in the wrapper. The measurement offered it
  -- "either side"; with three new callers, wrapper-only would let the creation path write
  -- PHI while `case_patient` is dark. It is kept in the wrapper TOO, for error ORDERING
  -- only (today the flag raises before "caso não encontrado", and existing callers must
  -- keep that order) — never for authority. The copy here is the load-bearing one and is
  -- falsifiable: 357's creation-path flag-dark pin reds if it is removed.
  perform app.assert_case_patient_enabled();

  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  if not v_case.patient_enabled then
    raise exception 'este caso não coleta identificação do paciente'
      using errcode = 'check_violation';
  end if;
  if v_case.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste caso foram descartados e não podem mais ser alterados'
      using errcode = 'check_violation';
  end if;
  if p_sex is not null and p_sex not in ('female', 'male', 'other', 'unknown') then
    raise exception 'sexo inválido' using errcode = 'check_violation';
  end if;
  -- ADR 0038 name-or-MRN floor (now enforced in the writer, not just the UI).
  if coalesce(btrim(p_name), '') = '' and coalesce(btrim(p_mrn), '') = '' then
    raise exception 'informe ao menos o nome ou o prontuário do paciente'
      using errcode = 'check_violation';
  end if;

  -- Create the participant chain atomically when no participant was supplied. The
  -- registry display_name is a SURROGATE (never the raw name) — Q4: participants is
  -- org-scoped readable, so patient rows must expose no raw identifier there.
  if v_participant is null then
    -- Resolve the link role. When the caller gives none (the ADR-0038 arg-only patient
    -- path), fall back to the org's default 'affected_patient' role, creating it once if
    -- absent — case_participants.role_id is NOT NULL, so a link always carries a role.
    if v_role is null then
      insert into public.case_participant_roles
        (organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
      values (v_case.organization_id, 'affected_patient', 'Paciente afetado',
              array['patient'], true)
      on conflict (organization_id, key) where case_type_id is null do nothing;
      select id into v_role from public.case_participant_roles
       where organization_id = v_case.organization_id
         and key = 'affected_patient' and case_type_id is null;
    end if;

    insert into public.participants
      (organization_id, participant_type, sensitivity_class, display_name, created_by)
    values (v_case.organization_id, 'patient', 'patient_phi', 'Paciente', auth.uid())
    returning id into v_participant;

    insert into public.patient_participants (participant_id) values (v_participant);

    insert into public.case_participants (case_id, participant_id, role_id, added_by)
    values (p_case_id, v_participant, v_role, auth.uid());
  else
    -- Existing participant: must be a patient participant already linked to this case.
    if not exists (
      select 1 from public.patient_participants pp where pp.participant_id = v_participant
    ) then
      raise exception 'participante não é um paciente' using errcode = 'check_violation';
    end if;
    if not exists (
      select 1 from public.case_participants cp
      where cp.participant_id = v_participant and cp.case_id = p_case_id
        and cp.removed_at is null
    ) then
      raise exception 'paciente não vinculado a este caso' using errcode = 'check_violation';
    end if;
  end if;

  insert into public.patient_identifiers
    (participant_id, name, mrn, date_of_birth, age_years, sex, encounter_ref, unit, attending)
  values
    (v_participant, p_name, p_mrn, p_date_of_birth, p_age_years, coalesce(p_sex, 'unknown'),
     p_encounter_ref, p_unit, p_attending)
  on conflict (participant_id) do update
    set name = excluded.name, mrn = excluded.mrn, date_of_birth = excluded.date_of_birth,
        age_years = excluded.age_years, sex = excluded.sex,
        encounter_ref = excluded.encounter_ref, unit = excluded.unit,
        attending = excluded.attending, updated_at = now();

  -- Maintain the denormalized has_patient flag under the case-RPC guard bypass.
  if not v_case.has_patient then
    perform set_config('app.in_case_rpc', 'on', true);
    update public.cases set has_patient = true where id = p_case_id;
    perform set_config('app.in_case_rpc', 'off', true);
  end if;

  return v_participant;
end;
$function$;

-- ⛔ A fresh function's proacl is NULL = the PERMISSIVE DEFAULT, which INCLUDES PUBLIC.
-- The revoke is mandatory, not defensive. Shape derived from the sole precedent as
-- measured in the catalog: app._grant_case_access_unchecked is prosecdef=f with
-- proacl {postgres=X/postgres} and has_function_privilege('authenticated', …) FALSE.
-- No grant to authenticated is issued here, and 357 pins that from the catalog.
revoke all on function app._set_participant_patient_unchecked(
  uuid, uuid, text, text, date, integer, text, text, text, text, uuid) from public;

-- ── 2. The gated door keeps its gate and delegates ──────────────────────────────────
-- Signature, ACL, prosecdef and every SQLSTATE stay byte-identical. No caller changes.
CREATE OR REPLACE FUNCTION public.set_participant_patient(p_case_id uuid, p_participant_id uuid DEFAULT NULL::uuid, p_name text DEFAULT NULL::text, p_mrn text DEFAULT NULL::text, p_date_of_birth date DEFAULT NULL::date, p_age_years integer DEFAULT NULL::integer, p_sex text DEFAULT 'unknown'::text, p_encounter_ref text DEFAULT NULL::text, p_unit text DEFAULT NULL::text, p_attending text DEFAULT NULL::text, p_role_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_case public.cases;
  v_participant uuid := p_participant_id;
  v_role uuid := p_role_id;
begin
  perform app.assert_case_patient_enabled();

  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  -- COORDINATOR-ONLY write gate (not can_read_case — that is the broad READ scope).
  if not app.is_staff_admin_of(v_case.commission_id) then
    raise exception 'apenas a coordenação da comissão pode registrar dados do paciente'
      using errcode = '42501';
  end if;
  perform app.assert_not_case_excluded(p_case_id);  -- ADR 0078 M1·4 (§3.6·A2)
  return app._set_participant_patient_unchecked(
    p_case_id, p_participant_id, p_name, p_mrn, p_date_of_birth, p_age_years, p_sex,
    p_encounter_ref, p_unit, p_attending, p_role_id);
end;
$function$;

-- ── 3. public.create_case — DROP + CREATE to add p_patient ──────────────────────────
drop function public.create_case(uuid, text, boolean, uuid[], uuid, text, uuid);
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

  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()
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
revoke all on function public.create_case(uuid, text, boolean, uuid[], uuid, text, uuid, jsonb) from public;
grant execute on function public.create_case(uuid, text, boolean, uuid[], uuid, text, uuid, jsonb) to authenticated, service_role;

-- ── 4. public.create_case_from_template — DROP + CREATE to add p_patient ────────────
-- bulk_create_cases calls this with SIX positional args; the new seventh is defaulted,
-- and plpgsql resolves the call at execution time, so drop+create in one transaction is
-- safe. M10: this is also the fix for the half-state — the case and its identifiers are
-- now one call, so there is no "case survived without its identifiers" return to make.
drop function public.create_case_from_template(uuid, text, uuid, text, uuid, jsonb);
CREATE OR REPLACE FUNCTION public.create_case_from_template(p_template_id uuid, p_label text DEFAULT NULL::text, p_department_id uuid DEFAULT NULL::uuid, p_department_other text DEFAULT NULL::text, p_case_type_id uuid DEFAULT NULL::uuid, p_custom_fields jsonb DEFAULT '[]'::jsonb, p_patient jsonb DEFAULT NULL::jsonb)
 RETURNS cases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_commission_id uuid;
  v_version_id uuid;
  v_collects boolean;
  v_case_type_id uuid;
  v_case public.cases;
  r_slot record;
  v_version uuid;
  v_case_phase_id uuid;
  v_attempt integer := 0;
  v_narratives_on boolean := app.feature_enabled('case_narratives');
  v_dept_other text := nullif(btrim(p_department_other), '');
  v_visibility text := 'commission_default';
  v_confidentiality text := 'non_phi_internal';
begin
  perform app.assert_cases_enabled();

  -- Resolution is deliberately in THREE steps so each failure keeps the error
  -- semantics the pre-versioning door had:
  --   1. template unknown            -> "processo não encontrado"
  --   2. caller not permitted        -> "processo não encontrado" (no existence leak)
  --   3. no PUBLISHED version        -> "apenas processos publicados podem iniciar casos"
  -- Collapsing 1 and 3 into a single join would turn an unpublished process into
  -- a "not found", losing the actionable message the builder shows the author.
  select commission_id into v_commission_id
  from public.process_templates where id = p_template_id;

  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if not (app.is_staff_admin_of(v_commission_id)
          or app.member_can(v_commission_id, 'create_cases')) then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  v_version_id := app.published_version_of_template(p_template_id);
  if v_version_id is null then
    raise exception 'apenas processos publicados podem iniciar casos'
      using errcode = 'check_violation';
  end if;

  -- ADR 0096 D1: collects_patient and case_type_id are the VERSION's now, so a
  -- case inherits what was in force when it was created, not what the template
  -- was later edited to say.
  select collects_patient, case_type_id
    into v_collects, v_case_type_id
  from public.process_template_versions where id = v_version_id;

  -- ADR 0064 D4 — the template declares its type; a case snapshots case_type_id.
  -- An EXPLICIT p_case_type_id overrides; otherwise the case INHERITS.
  v_case_type_id := coalesce(p_case_type_id, v_case_type_id);

  if p_department_id is not null and v_dept_other is not null then
    raise exception 'informe um setor da lista OU um valor personalizado, não ambos'
      using errcode = '23514';
  end if;
  if p_department_id is not null
     and not app.department_belongs_to_commission(p_department_id, v_commission_id) then
    raise exception 'este setor não pertence ao hospital deste caso'
      using errcode = 'HC030';
  end if;

  if v_case_type_id is not null and app.feature_enabled('case_types') then
    select default_visibility_policy, default_confidentiality_level
      into v_visibility, v_confidentiality
    from public.case_types
    where id = v_case_type_id
      and organization_id = app.org_of_commission(v_commission_id);
    if not found then
      raise exception 'tipo de caso não encontrado para esta organização'
        using errcode = 'no_data_found';
    end if;
  end if;

  -- ADR 0083 — required custom fields must carry a value. Checked EARLY (only
  -- reads the version's defs + the caller's payload) so we fail before minting a
  -- case. A value is "blank" when absent, JSON null, or an empty/whitespace string.
  if exists (
    select 1
    from public.process_template_custom_fields f
    left join lateral (
      select (e.elem -> 'value') as val
      from jsonb_array_elements(coalesce(p_custom_fields, '[]'::jsonb)) as e(elem)
      where e.elem ->> 'key' = f.key
      limit 1
    ) cf on true
    where f.template_version_id = v_version_id
      and f.required
      and (
        cf.val is null
        or jsonb_typeof(cf.val) = 'null'
        or (jsonb_typeof(cf.val) = 'string' and btrim(cf.val #>> '{}') = '')
      )
  ) then
    raise exception 'preencha todos os campos personalizados obrigatórios'
      using errcode = 'HC068';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases
        (commission_id, template_version_id, case_type_id, label, created_by, patient_enabled,
         department_id, department_other, visibility_policy, confidentiality_level)
      values
        (v_commission_id, v_version_id, v_case_type_id, nullif(btrim(p_label), ''), auth.uid(),
         coalesce(v_collects, false), p_department_id, v_dept_other,
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

  for r_slot in
    select id, position, form_id, title, recommend_when, default_due_days, blocks,
           display_position, result_ruleset, emits_result
    from public.process_template_phases
    where template_version_id = v_version_id
    order by position
  loop
    v_version := app.published_version_of_form(r_slot.form_id);
    if v_version is null then
      raise exception
        'o formulário da fase % ainda não foi publicado', r_slot.position
        using errcode = 'HC017';
    end if;

    if r_slot.recommend_when is not null then
      perform app.validate_template_recommend_when(
        v_version_id, r_slot.position, r_slot.recommend_when
      );
    end if;

    insert into public.case_phases
      (case_id, position, form_id, form_version_id, title, recommend_when,
       is_ad_hoc, default_due_days, blocks, display_position, result_ruleset,
       emits_result)
    values
      (v_case.id, r_slot.position, r_slot.form_id, v_version, r_slot.title,
       r_slot.recommend_when, false, r_slot.default_due_days, r_slot.blocks,
       coalesce(r_slot.display_position, r_slot.position), r_slot.result_ruleset,
       r_slot.emits_result)
    returning id into v_case_phase_id;

    insert into public.case_phase_allowed_results (case_phase_id, result_id, position)
    select v_case_phase_id, tar.result_id, tar.position
    from public.process_template_phase_allowed_results tar
    where tar.template_phase_id = r_slot.id
      and r_slot.emits_result;
  end loop;

  insert into public.case_offered_outcomes (case_id, outcome_id)
  select v_case.id, pto.outcome_id
  from public.process_template_outcomes pto
  where pto.template_version_id = v_version_id;

  -- ADR 0083 — SNAPSHOT each version custom-field def onto the case, freezing
  -- key/label/field_type/options/position and writing the caller-provided value.
  insert into public.case_custom_field_values
    (case_id, template_field_id, key, label, field_type, options, value, position)
  select
    v_case.id, f.id, f.key, f.label, f.field_type, f.options,
    case
      when cf.val is null
        or jsonb_typeof(cf.val) = 'null'
        or (jsonb_typeof(cf.val) = 'string' and btrim(cf.val #>> '{}') = '')
      then null
      else cf.val
    end,
    f.position
  from public.process_template_custom_fields f
  left join lateral (
    select (e.elem -> 'value') as val
    from jsonb_array_elements(coalesce(p_custom_fields, '[]'::jsonb)) as e(elem)
    where e.elem ->> 'key' = f.key
    limit 1
  ) cf on true
  where f.template_version_id = v_version_id;

  insert into public.case_phase_offered_results (case_id, result_id)
  select distinct v_case.id, ids.rid
  from (
    select (r ->> 'result_id')::uuid as rid
    from public.case_phases cp
    cross join lateral jsonb_array_elements(coalesce(cp.result_ruleset -> 'rules', '[]'::jsonb)) as r
    where cp.case_id = v_case.id
    union
    select (cp.result_ruleset ->> 'default_result_id')::uuid
    from public.case_phases cp
    where cp.case_id = v_case.id
    union
    select cpar.result_id
    from public.case_phase_allowed_results cpar
    join public.case_phases cp on cp.id = cpar.case_phase_id
    where cp.case_id = v_case.id
  ) ids
  -- PCI/H4 (ADR 0095) — PRESERVED VERBATIM. The rid values come from JSONB
  -- (rules[].result_id and default_result_id), which no FK can validate. A result
  -- deleted after the ruleset was authored would otherwise reach the FK below and
  -- raise 23503, failing EVERY case creation from this template. Restricting to
  -- results that still exist AND belong to this commission degrades gracefully
  -- instead — matching what app.compute_case_phase_result already does at compute
  -- time. 210_phase_result_junctions deliberately deletes a ruleset-referenced
  -- result and asserts a clean cascade, so this filter is load-bearing.
  join public.phase_results pr
    on pr.id = ids.rid
   and pr.commission_id = v_commission_id
  where ids.rid is not null
  on conflict do nothing;

  if v_narratives_on then
    insert into public.case_narratives
      (case_id, narrative_type_id, type_label, display_position, title,
       instructions, is_expected, created_by)
    select v_case.id, ptn.narrative_type_id,
           coalesce(nullif(btrim(ptn.title), ''), cnt.label),
           ptn.display_position, ptn.title, ptn.instructions, ptn.is_expected,
           auth.uid()
    from public.process_template_narratives ptn
    join public.case_narrative_types cnt on cnt.id = ptn.narrative_type_id
    where ptn.template_version_id = v_version_id;
  end if;

  perform set_config('app.in_case_rpc', 'off', true);

  perform public.recompute_recommendations(v_case.id);

  -- ADR 0061 (revised): self-grant the non-coordinator creator a READ.
  if not (app.is_staff_admin_of(v_commission_id)) then
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
revoke all on function public.create_case_from_template(uuid, text, uuid, text, uuid, jsonb, jsonb) from public;
grant execute on function public.create_case_from_template(uuid, text, uuid, text, uuid, jsonb, jsonb) to authenticated, service_role;

-- ── 5. public.bulk_create_cases — the A1.2 widening + step (d) re-pointed ───────────
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
  -- OR an Administrativo holding `create_cases` there.
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
          or app.member_can(v_commission_id, 'create_cases')) then
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

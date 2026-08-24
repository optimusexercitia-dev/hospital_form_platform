-- ============================================================================
-- ADR 0137 D1/D2/D3 — Migration B: re-emit every body that referenced the
-- retiring booleans, add the required-mode refusals, then drop the booleans.
--
-- ⛔ EVERY BODY BELOW WAS RE-EMITTED FROM `pg_get_functiondef()` ON THE LIVE
--    CATALOG, never from migration text. Several bodies in this repo are
--    rewritten at runtime by earlier migrations (pg_get_functiondef + replace +
--    execute), so a migration file is stale BY DESIGN and reading one here has
--    already produced a confident false P0 (ADR 0078 "METHODOLOGY FINDING").
--
-- THE RE-EMISSION SET — measured 2026-08-23 from the live catalog, with `--`
-- comments stripped and `\m…\M` word boundaries. The naive substring match
-- returns TWELVE routines; four of those are false positives whose NAMES
-- contain the column name (`app.assert_case_patient_enabled`,
-- `public.case_patient_enabled`, `public.set_participant_patient`,
-- `public.dispose_case_phi`) and one (`public.bulk_create_cases`) matches in a
-- COMMENT only. The genuine set is SEVEN:
--
--   routine                                   prosecdef  references
--   public.set_template_collects_patient      t          collects_patient   (REPLACED)
--   public.create_case_from_template          t          both
--   public.create_case                        t          patient_enabled
--   public.clone_template_version             f  ⚠       collects_patient
--   app.trg_audit_template_versions           t          collects_patient
--   app._set_participant_patient_unchecked    f  ⚠       patient_enabled
--   public.get_case_detail                    t          patient_enabled
--
-- ⭐ `public.clone_template_version` is the one that would have shipped a live
--    defect: it copies `collects_patient` in BOTH the column list and the
--    SELECT, so dropping the column breaks cloning a published version to a new
--    draft — Architecture Rule 5's core mechanism — and it breaks at RUNTIME,
--    not at migration time. `app.trg_audit_template_versions` is the Rule 11
--    audit trigger: a dangling reference there fails EVERY template-version
--    write.
--
-- ⚠ The two `prosecdef = f` bodies (`clone_template_version`,
--   `_set_participant_patient_unchecked`) are `ARM=wrapper`'s domain; name them
--   in the gate record.
--
-- `public.bulk_create_cases` is edited too, but for the reason the naive match
-- did NOT imply: it needs the per-row required-fields pre-check so a refusal
-- carries its row index.
--
-- ⛔ NO TOP-LEVEL `set local` (silent 25P01 no-op). This file needs none.
-- ============================================================================

-- ── 0. Pre-drop guard: the Migration A backfill must have held ─────────────
--
-- ⚠ THIS ASSERTION IS THE ONLY THING THAT CAN CATCH A BAD BACKFILL, AND IT IS
--   DELIBERATELY HERE RATHER THAN IN pgTAP. On a fresh `supabase db reset` the
--   migrations run against an EMPTY database and `seed.sql` runs AFTER them, so
--   Migration A's backfill matches ZERO rows locally and any pgTAP assertion
--   about it is vacuous by construction — the fixture cannot reach the state
--   being tested. On a real database (`db push`) the backfill matches every
--   row, and this is where a mismatch surfaces: while BOTH columns still exist,
--   one statement before the drop makes them unreadable.

do $precheck$
declare
  v_bad integer;
begin
  select count(*) into v_bad
  from public.process_template_versions
  where patient_mode <> (case when collects_patient then 'optional' else 'none' end);
  if v_bad > 0 then
    raise exception
      'backfill mismatch: % process_template_versions rows disagree with collects_patient', v_bad
      using errcode = 'HC0T4';
  end if;

  select count(*) into v_bad
  from public.cases
  where patient_mode <> (case when patient_enabled then 'optional' else 'none' end);
  if v_bad > 0 then
    raise exception
      'backfill mismatch: % cases rows disagree with patient_enabled', v_bad
      using errcode = 'HC0T4';
  end if;

  -- ADR 0137 D1: the backfill NEVER produces 'required'. Anything that did
  -- came from somewhere else and must be understood before the booleans go.
  select count(*) into v_bad from public.process_template_versions where patient_mode = 'required';
  if v_bad > 0 then
    raise exception 'backfill produced % required-mode template versions (D1 forbids it)', v_bad
      using errcode = 'HC0T4';
  end if;
  select count(*) into v_bad from public.cases where patient_mode = 'required';
  if v_bad > 0 then
    raise exception 'backfill produced % required-mode cases (D1 forbids it)', v_bad
      using errcode = 'HC0T4';
  end if;
end;
$precheck$;

-- ── 1. app.trg_audit_template_versions (Rule 11 audit trigger) ──────────────
-- Re-emitted from the live catalog; the ONLY change is the audited column
-- allow-list. If this body kept naming a dropped column, EVERY write to
-- process_template_versions would fail.

create or replace function app.trg_audit_template_versions()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_cols constant text[] := array[
    'status', 'version_number', 'title', 'description',
    'patient_mode', 'patient_required_fields', 'case_type_id'
  ];
  v_id uuid;
  v_template uuid;
  v_action text;
  v_meta jsonb;
begin
  if tg_op = 'DELETE' then
    v_template := old.template_id; v_id := old.id;
    v_action := 'process_template_version.deleted';
    v_meta := app.audit_diff(to_jsonb(old), null, v_cols);
  elsif tg_op = 'INSERT' then
    v_template := new.template_id; v_id := new.id;
    v_action := 'process_template_version.created';
    v_meta := app.audit_diff(null, to_jsonb(new), v_cols);
  else
    v_template := new.template_id; v_id := new.id;
    v_action := 'process_template_version.updated';
    v_meta := app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols);
  end if;
  perform app.audit_write(v_action, 'process_template_version', v_id,
    app.commission_of_template(v_template), 'Versão do processo ' || tg_op, v_meta);
  return null;
end;
$function$;

-- ── 2. public.clone_template_version (Rule 5 cloning; prosecdef = f) ────────
-- ⭐ The body the old five-name hand-list missed. Copies the setting in BOTH
--    the column list AND the select; both are re-pointed at the new columns.

create or replace function public.clone_template_version(p_source_version_id uuid)
 returns uuid
 language plpgsql
 set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_template_id uuid;
  v_next_number integer;
  v_new_version_id uuid;
  v_uid uuid := auth.uid();
  v_existing_draft uuid;
begin
  perform app.assert_cases_enabled();

  select template_id into v_template_id
  from public.process_template_versions
  where id = p_source_version_id;

  if v_template_id is null then
    raise exception 'versão % não encontrada', p_source_version_id
      using errcode = 'no_data_found';
  end if;

  select id into v_existing_draft
  from public.process_template_versions
  where template_id = v_template_id and status = 'draft'
  limit 1;

  if v_existing_draft is not null then
    return v_existing_draft;
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next_number
  from public.process_template_versions
  where template_id = v_template_id;

  -- RLS-gated. This INSERT is the authority proof for the clone; the helper
  -- re-checks the same predicate for its own writes because it runs as owner.
  -- ADR 0137 D1/D2: the PHI mode + its required-field set clone together. They
  -- are one setting read as a whole; carrying the mode without the set would
  -- produce a `required` draft that no longer knows what it requires.
  insert into public.process_template_versions (
    template_id, version_number, status, title, description,
    patient_mode, patient_required_fields, case_type_id, created_by
  )
  select v_template_id, v_next_number, 'draft', s.title, s.description,
         s.patient_mode, s.patient_required_fields, s.case_type_id, v_uid
  from public.process_template_versions s
  where s.id = p_source_version_id
  returning id into v_new_version_id;

  perform app.copy_template_version_children(p_source_version_id, v_new_version_id);

  return v_new_version_id;
end;
$function$;

-- ── 3. public.set_template_patient_mode — replaces set_template_collects_patient ──

drop function if exists public.set_template_collects_patient(uuid, boolean);

create or replace function public.set_template_patient_mode(
  p_template_version_id uuid,
  p_mode text,
  p_required_fields text[] default '{}'::text[]
)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission_id uuid;
  v_status text;
  v_mode text := coalesce(nullif(btrim(p_mode), ''), 'none');
  v_fields text[];
  v_bad text;
begin
  perform app.assert_case_patient_enabled();

  select t.commission_id, v.status into v_commission_id, v_status
  from public.process_template_versions v
  join public.process_templates t on t.id = v.template_id
  where v.id = p_template_version_id;

  if v_commission_id is null then
    raise exception 'versão % não encontrada', p_template_version_id
      using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id)
          or app.is_tenancy_admin_of(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'check_violation';
  end if;

  if v_mode not in ('none', 'optional', 'required') then
    raise exception 'modo de identificação do paciente inválido: %', v_mode
      using errcode = 'HC0T2';
  end if;

  if v_mode = 'required' then
    -- ADR 0137 D2: `mrn` is ALWAYS a member and the UI renders it selected and
    -- non-interactive. WELDED here rather than refused, so a caller that simply
    -- omits it gets the correct set instead of an error about a field it was
    -- never allowed to deselect. The CHECK constraint is the backstop.
    select array_agg(f order by ord) into v_fields
    from unnest(
           array['name', 'mrn', 'date_of_birth', 'sex', 'encounter_ref', 'attending'],
           array[1, 2, 3, 4, 5, 6]
         ) as v(f, ord)
    where f = 'mrn' or f = any (coalesce(p_required_fields, '{}'::text[]));

    -- Anything the caller sent that is NOT in the vocabulary is refused rather
    -- than silently dropped: `age_years` and `unit` are excluded BY DECISION
    -- (D2 welded to D9), and swallowing them would let a picker believe it had
    -- configured a field the database will never enforce.
    select f into v_bad
    from unnest(coalesce(p_required_fields, '{}'::text[])) as f
    where f <> all (array['name', 'mrn', 'date_of_birth', 'sex', 'encounter_ref', 'attending'])
    limit 1;
    if v_bad is not null then
      raise exception 'campo de identificação inválido: %', v_bad using errcode = 'HC0T2';
    end if;
  else
    -- A non-required mode carries no set. Keeping a stale one would let a later
    -- flip to `required` silently activate fields nobody re-picked.
    v_fields := '{}'::text[];
  end if;

  update public.process_template_versions
  set patient_mode = v_mode,
      patient_required_fields = v_fields
  where id = p_template_version_id;
end;
$function$;

comment on function public.set_template_patient_mode(uuid, text, text[]) is
  'ADR 0137 D1/D2. Sets a DRAFT template version''s PHI collection mode and, for '
  '''required'', its field set (mrn always welded in). Replaces the retired '
  'set_template_collects_patient. Authority unchanged: staff_admin or tenancy '
  'admin of the template''s commission, draft versions only.';

-- Every new public.* RPC: REVOKE from PUBLIC before the GRANT, or the dashboard
-- t19 pgTAP guard reds.
revoke all on function public.set_template_patient_mode(uuid, text, text[]) from public;
grant execute on function public.set_template_patient_mode(uuid, text, text[]) to authenticated;

-- ── 4. app._set_participant_patient_unchecked (prosecdef = f) ───────────────
--
-- ⭐ THIS IS ADR 0137 D3's PHI-WRITE ENFORCEMENT POINT, AND IT IS NOT
--    `set_case_patient`. Measured: `public.set_case_patient` is a COMPAT DOOR
--    that resolves the case's single existing patient participant and delegates
--    to `public.set_participant_patient`, which delegates HERE — this is where
--    the mode check actually lives. Putting the required-field refusal in
--    `set_case_patient` would leave the E1 multi-patient door
--    (`set_participant_patient`) completely unguarded: CLAUDE.md Rule 12's "one
--    writer body with TWO gates" failing open. Both doors inherit it from here.
--    pgTAP drives BOTH; a test that only drives the compat door passes while the
--    real hole stays open.

create or replace function app._set_participant_patient_unchecked(
  p_case_id uuid,
  p_participant_id uuid default null::uuid,
  p_name text default null::text,
  p_mrn text default null::text,
  p_date_of_birth date default null::date,
  p_age_years integer default null::integer,
  p_sex text default 'unknown'::text,
  p_encounter_ref text default null::text,
  p_unit text default null::text,
  p_attending text default null::text,
  p_role_id uuid default null::uuid
)
 returns uuid
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
  -- ADR 0137 D1: the boolean became a three-mode setting. `none` is the old
  -- `patient_enabled = false`; the message is unchanged and so is the SQLSTATE,
  -- because existing callers and mappers depend on both.
  if v_case.patient_mode = 'none' then
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

  -- ADR 0137 D3 — THE PHI-WRITE REFUSAL. Placed AFTER the ADR-0038 floor so the
  -- generic "name or MRN" message still wins for a `none`/`optional` case, and
  -- BEFORE any row is written so a refused write leaves nothing behind. The
  -- payload is rebuilt as jsonb rather than re-testing each argument inline, so
  -- this door and the three minting doors share ONE predicate and cannot drift.
  perform app.assert_patient_required_fields(
    v_case.patient_mode,
    v_case.patient_required_fields,
    jsonb_build_object(
      'name', p_name,
      'mrn', p_mrn,
      'date_of_birth', p_date_of_birth,
      'sex', p_sex,
      'encounter_ref', p_encounter_ref,
      'attending', p_attending
    ));

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

-- ── 5. public.create_case (process-less door) ───────────────────────────────
--
-- ⛔ THE SIGNATURE DOES NOT CHANGE, AND THAT IS A CONSTRAINT, NOT A PREFERENCE.
--    `supabase/tests/357` §1.6 pins this function's exact identity argument
--    string `create_case(uuid,text,boolean,uuid[],uuid,text,uuid,jsonb)` and
--    §1.5 pins the overload count at exactly one. `p_patient_enabled boolean`
--    therefore stays and is MAPPED — `true -> 'optional'`, `false -> 'none'`,
--    which is ADR 0137 D1's mechanical rule anyway. A process-less case has no
--    template version to carry a mode, so `required` is unreachable here by
--    construction, not by omission.
--
-- ⚠ The authority gate below is pinned VERBATIM by 357 §8d.1 and by 314 §11.36.
--   It is reproduced byte-for-byte from the live catalog and must not be
--   touched by this migration.

create or replace function public.create_case(
  p_commission_id uuid,
  p_label text default null::text,
  p_patient_enabled boolean default false,
  p_outcome_ids uuid[] default '{}'::uuid[],
  p_department_id uuid default null::uuid,
  p_department_other text default null::text,
  p_case_type_id uuid default null::uuid,
  p_patient jsonb default null::jsonb
)
 returns cases
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case public.cases;
  v_attempt integer := 0;
  v_bad uuid;
  v_dept_other text := nullif(btrim(p_department_other), '');
  -- O-1: default to today's column defaults; a supplied case_type overrides them.
  v_visibility text := 'commission_default';
  v_confidentiality text := 'non_phi_internal';
  -- ADR 0137 D1: the boolean argument maps onto the three-mode setting.
  v_patient_mode text := case when coalesce(p_patient_enabled, false)
                              then 'optional' else 'none' end;
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
        (commission_id, template_version_id, case_type_id, label, created_by,
         patient_mode, patient_required_fields,
         department_id, department_other, visibility_policy, confidentiality_level)
      values
        (p_commission_id, null, p_case_type_id, nullif(btrim(p_label), ''), auth.uid(),
         v_patient_mode, '{}'::text[],
         p_department_id, v_dept_other,
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

-- ── 6. public.create_case_from_template ─────────────────────────────────────
--
-- ⚠ The eager refusal here fires ONLY when a payload was supplied and is
--   incomplete. It deliberately does NOT refuse a NULL payload, because
--   `bulk_create_cases` composes this function with `p_patient => null` and
--   writes PHI afterwards (357 §1.1 pins that composition — see §7). The
--   "a required-mode case must end up with PHI at all" half is carried by the
--   DEFERRED constraint trigger from Migration A, which is ordering-immune and
--   also covers the direct-table INSERT path this function cannot see.

create or replace function public.create_case_from_template(
  p_template_id uuid,
  p_label text default null::text,
  p_department_id uuid default null::uuid,
  p_department_other text default null::text,
  p_case_type_id uuid default null::uuid,
  p_custom_fields jsonb default '[]'::jsonb,
  p_patient jsonb default null::jsonb
)
 returns cases
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission_id uuid;
  v_version_id uuid;
  v_patient_mode text;
  v_patient_required text[];
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

  -- ADR 0096 D1: the PHI setting and case_type_id are the VERSION's, so a case
  -- inherits what was in force when it was created, not what the template was
  -- later edited to say. ADR 0137 D1/D2 widened the first from a boolean to a
  -- mode PLUS its required-field set; both snapshot together.
  select patient_mode, patient_required_fields, case_type_id
    into v_patient_mode, v_patient_required, v_case_type_id
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

  -- ADR 0137 D3 — eager refusal for a SUPPLIED but incomplete payload, checked
  -- before anything is minted so the caller gets a field-naming message rather
  -- than a deferred failure at commit. A NULL payload is left to the deferred
  -- guard (see the header): bulk composes this door and supplies PHI later.
  if p_patient is not null then
    perform app.assert_patient_required_fields(v_patient_mode, v_patient_required, p_patient);
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
        (commission_id, template_version_id, case_type_id, label, created_by,
         patient_mode, patient_required_fields,
         department_id, department_other, visibility_policy, confidentiality_level)
      values
        (v_commission_id, v_version_id, v_case_type_id, nullif(btrim(p_label), ''), auth.uid(),
         coalesce(v_patient_mode, 'none'), coalesce(v_patient_required, '{}'::text[]),
         p_department_id, v_dept_other,
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

-- ── 7. public.bulk_create_cases — per-row eager refusal only ────────────────
--
-- ⛔ ITS DIRECT CALL TO `app._set_participant_patient_unchecked` STAYS.
--    `supabase/tests/357` §1.1 pins the caller set of that helper at EXACTLY
--    FOUR routines, by property. Routing bulk's PHI through
--    `create_case_from_template(p_patient => ...)` — which is otherwise an
--    identical call and looked like a clean simplification — would drop the set
--    to three and red that keystone. Left alone deliberately.
--
--    The only edit is the per-row pre-check below, which exists purely so a
--    required-mode refusal carries its `linha N:` index instead of surfacing at
--    commit from the deferred guard with no row attribution.
--
-- ⚠ Re-emitted VERBATIM from the live catalog apart from that block; the
--   authority comments here are pinned prose (314 §11.34 / §11.36).

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
  v_version_id uuid;
  v_patient_mode text;
  v_patient_required text[];
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

  -- ADR 0137 D3 — resolve the published version's PHI mode ONCE, up front. Every
  -- row of the batch mints from the same version, so the required set cannot
  -- differ between rows.
  v_version_id := app.published_version_of_template(p_template_id);
  select patient_mode, patient_required_fields
    into v_patient_mode, v_patient_required
  from public.process_template_versions where id = v_version_id;

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

      -- ADR 0137 D3 — PER-ROW EAGER REFUSAL, before the case is minted. The
      -- deferred guard from Migration A would catch this too, but only at
      -- COMMIT, outside this subblock, so the operator would get an unindexed
      -- failure after up to 200 rows of work. Here it is `linha N:`.
      perform app.assert_patient_required_fields(
        v_patient_mode, v_patient_required, v_patient);

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
      --     already have one). Every shape check (patient_mode, phi_disposed_at, the
      --     sex vocabulary, the ADR-0038 name-or-MRN floor, the ADR-0137 required set)
      --     and the audit trigger are UNCHANGED — they live below the cut, so every door
      --     still gets them.
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

-- ── 8. public.get_case_detail — expose the mode, keep the derived boolean ───
--
-- ⚠ `patient_enabled` STAYS IN THE ENVELOPE, now DERIVED (`patient_mode <>
--   'none'`). The column is dropped below, but the JSON key is a published
--   contract the case detail view and the create/edit dialogs already read, and
--   a parallel frontend increment is editing those files right now. Keeping the
--   derived key is what lets the schema land ahead of the UI (the deploy order
--   this batch requires: schema first, then code).

create or replace function public.get_case_detail(p_case_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_case public.cases;
  v_outcome jsonb;
  v_is_coordinator boolean;
  v_result jsonb;
begin
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  -- Flag branch collapsed (B4): the case_access read path is the only path now.
  if not app.can_read_case(p_case_id, auth.uid()) then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;

  v_is_coordinator :=
    app.is_staff_admin_of(v_case.commission_id);

  if not v_is_coordinator then
    perform public.log_audit_access(
      'case.opened', 'case', p_case_id, v_case.commission_id,
      'Caso aberto por participante/concedido', '{}'::jsonb);
  end if;

  select case when o.id is null then null else jsonb_build_object(
           'id', o.id,
           'label', o.label,
           'color_token', o.color_token,
           'requires_action_plan', o.requires_action_plan,
           'is_adverse', o.is_adverse
         ) end
    into v_outcome
  from (select v_case.outcome_id as oid) s
  left join public.case_outcomes o on o.id = s.oid;

  select jsonb_build_object(
    'id', v_case.id,
    'commission_id', v_case.commission_id,
    'template_id', (select v.template_id from public.process_template_versions v
                       where v.id = v_case.template_version_id),
    'template_version_id', v_case.template_version_id,
    'template_version_number', (select v.version_number from public.process_template_versions v
                                  where v.id = v_case.template_version_id),
    'template_title', (select v.title from public.process_template_versions v
                         where v.id = v_case.template_version_id),
    'case_number', v_case.case_number,
    'label', v_case.label,
    'status', v_case.status,
    'outcome_id', v_case.outcome_id,
    'outcome', v_outcome,
    'has_patient', v_case.has_patient,
    'patient_enabled', (v_case.patient_mode <> 'none'),
    'patient_mode', v_case.patient_mode,
    'patient_required_fields', to_jsonb(v_case.patient_required_fields),
    'viewer_capabilities', jsonb_build_object(
      'can_read', true,
      'can_write_content', app.can_write_case_content(p_case_id, auth.uid()),
      'can_manage_lifecycle', v_is_coordinator
    ),
    'offered_outcomes', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', o.id,
          'label', o.label,
          'color_token', o.color_token,
          'requires_action_plan', o.requires_action_plan,
          'is_adverse', o.is_adverse
        ) order by o.position)
       from public.case_offered_outcomes coo
       join public.case_outcomes o on o.id = coo.outcome_id
       where coo.case_id = p_case_id),
      '[]'::jsonb),
    'created_at', v_case.created_at,
    'closed_at', v_case.closed_at,
    'phases', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cp.id,
          'position', cp.position,
          'form_id', cp.form_id,
          'form_version_id', cp.form_version_id,
          'form_title', f.title,
          'title', cp.title,
          'status', cp.status,
          'recommended', cp.recommended,
          'assigned_to', cp.assigned_to,
          'assignee_name', pr.full_name,
          'is_ad_hoc', cp.is_ad_hoc,
          'blocks', cp.blocks,
          'recommend_when', cp.recommend_when,
          'due_date', cp.due_date,
          'default_due_days', cp.default_due_days,
          'display_position', coalesce(cp.display_position, cp.position),
          'response_id', sub.response_id,
          'submitted_at', sub.submitted_at,
          'result_id', cp.result_id,
          'result_computed_at', cp.result_computed_at,
          'result', case when prr.id is null then null else jsonb_build_object(
            'id', prr.id,
            'label', prr.label,
            'color_token', prr.color_token,
            'is_adverse', prr.is_adverse,
            'source', cp.result_source
          ) end
        ) order by cp.position)
       from public.case_phases cp
       join public.forms f on f.id = cp.form_id
       left join public.profiles pr on pr.id = cp.assigned_to
       left join public.phase_results prr on prr.id = cp.result_id
       -- BE-2: resolve the current revision via the pointer (was an unordered
       -- `limit 1` over all submitted rows — nondeterministic once chains exist).
       left join lateral (
         select r.id as response_id, r.submitted_at
         from public.responses r
         where r.id = cp.current_response_id
           and cp.status = 'completed'
       ) sub on true
       where cp.case_id = p_case_id),
      '[]'::jsonb),
    'narratives', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cn.id,
          'narrative_type_id', cn.narrative_type_id,
          'type_label', cn.type_label,
          'display_position', cn.display_position,
          'title', cn.title,
          'instructions', cn.instructions,
          'is_expected', cn.is_expected,
          'is_ad_hoc', cn.is_ad_hoc,
          'body_md', cn.body_md,
          'assigned_to', cn.assigned_to,
          'assignee_name', npr.full_name,
          'status', cn.status,
          'concluded_at', cn.concluded_at,
          'concluded_by', cn.concluded_by,
          'updated_at', cn.updated_at
        ) order by cn.display_position)
       from public.case_narratives cn
       left join public.profiles npr on npr.id = cn.assigned_to
       where cn.case_id = p_case_id),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

-- ── 9. Drop the booleans — ONLY after every body above has landed ───────────
--
-- ⛔ The verification is a QUERY, not a re-read of the list at the top of this
--   file. Zero live bodies may reference either name (comment-stripped,
--   word-boundary), or the drop breaks something at RUNTIME.

-- Two strippings, and the second one has to be justified rather than assumed:
--   * `--` comments are stripped because a mention in prose is not a reference
--     (the naive match returns five extra routines for exactly this reason).
--   * SINGLE-QUOTED LITERALS are stripped because a column reference can never
--     appear inside one. `get_case_detail` deliberately keeps emitting a
--     `'patient_enabled'` JSON KEY — a derived compat field, not a column read —
--     and the first run of this migration failed on precisely that, which is
--     the check working, not a false alarm to silence.
--     ⚠ The one thing this stripping COULD hide is a column named inside dynamic
--     SQL (`execute 'update ... patient_enabled ...'`). That is not hypothetical
--     in this repo — several migrations rewrite bodies by string surgery — so
--     any body whose LITERALS still carry the names is reported as a NOTICE
--     rather than silently passed, and any that also uses `execute` is a hard
--     failure.
do $verify$
declare
  v_left text;
  v_literal_only text;
  v_dynamic text;
begin
  with bodies as (
    select n.nspname || '.' || p.proname as r,
           regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g') as decommented
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'public') and p.prokind in ('f', 'p')
  ), classified as (
    select r, decommented,
           regexp_replace(decommented, '''[^'']*''', '''''', 'g') as code_only
    from bodies
    where decommented ~ '\m(collects_patient|patient_enabled)\M'
  )
  select string_agg(r, ', ' order by r) filter (
           where code_only ~ '\m(collects_patient|patient_enabled)\M'),
         string_agg(r, ', ' order by r) filter (
           where code_only !~ '\m(collects_patient|patient_enabled)\M'),
         string_agg(r, ', ' order by r) filter (
           where code_only !~ '\m(collects_patient|patient_enabled)\M'
             and code_only ~* '\mexecute\M')
    into v_left, v_literal_only, v_dynamic
  from classified;

  if v_left is not null then
    raise exception 'still referencing the retiring booleans in CODE: %', v_left
      using errcode = 'HC0T4';
  end if;
  if v_dynamic is not null then
    raise exception
      'retiring boolean appears in a STRING LITERAL of a body that also uses EXECUTE (dynamic SQL cannot be cleared by inspection): %',
      v_dynamic using errcode = 'HC0T4';
  end if;
  if v_literal_only is not null then
    raise notice
      'retiring boolean survives only inside string literals (expected: the get_case_detail compat JSON key): %',
      v_literal_only;
  end if;
end;
$verify$;

alter table public.process_template_versions drop column collects_patient;
alter table public.cases drop column patient_enabled;

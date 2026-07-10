-- =============================================================================
-- F1 (ADR 0064 E0 / ADR 0065) — Case-Participants foundation, part 2 of 3:
--   • denormalize organization_id onto cases (hardening R2);
--   • case_participants (case × participant × role link, primary-subject partial-unique);
--   • re-key case_patient → patient_identifiers (N-per-case, participant-keyed);
--   • re-key the case-module patient_xref grain from case_id → participant_id (R3, Q1=A);
--   • the atomic DEFINER writer (set_participant_patient) + audited doors
--     (get_participant_patient / get_case_patients) — Class-1 patient PHI, unchanged posture.
--
-- Reset-OK / pre-launch: case_patient ships/stays OFF ⇒ ZERO production PHI to migrate.
-- We DROP case_patient and CREATE patient_identifiers additively — no rename/back-compat
-- shim, no data migration. Local/seed rework only (ADR 0064 Decision 3; ADR 0065 §6).
--
-- The isolation + audited-door + disposal + reveal-on-demand posture is PRESERVED verbatim
-- (Rule 12 Class 1); only cardinality (1 → N) and key (case_id → participant_id) change.
-- ADR 0038's read-broad / write-tight asymmetry (case-workers read; coordinators write)
-- and the name-or-MRN floor are preserved.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · cases.organization_id — hardening R2 denormalization.
--     Verified NOT present today (cases carries only commission_id; org resolved via
--     commission_of_case). Needed so case_participants can enforce same-org integrity.
-- -----------------------------------------------------------------------------
alter table public.cases add column if not exists organization_id uuid;

-- Backfill from commission → organization (reset-OK: local/seed only, no prod data).
update public.cases c
   set organization_id = app.org_of_commission(c.commission_id)
 where c.organization_id is null;

alter table public.cases
  alter column organization_id set not null;
alter table public.cases
  add constraint cases_organization_id_fkey
  foreign key (organization_id) references public.organizations(id);

comment on column public.cases.organization_id is
  'Denormalized org (= org_of_commission(commission_id)); hardening R2 (ADR 0064). Kept '
  'in lock-step with commission_id by app.guard_case_org_matches_commission (HC095). Lets '
  'case_participants enforce participant-same-org integrity without joining through the '
  'commission each time.';

-- Guard: organization_id must equal the commission-resolved org (no drift). Mirrors the
-- ADR-0054 guard_hospital_org_repoint pattern. Fires BEFORE INSERT OR UPDATE.
create or replace function app.guard_case_org_matches_commission()
  returns trigger language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_expected uuid;
begin
  v_expected := app.org_of_commission(new.commission_id);
  if new.organization_id is null then
    new.organization_id := v_expected;
  elsif new.organization_id is distinct from v_expected then
    raise exception 'organization_id do caso não corresponde à organização da comissão'
      using errcode = 'HC095';
  end if;
  return new;
end;
$$;
alter function app.guard_case_org_matches_commission() owner to postgres;

drop trigger if exists trg_guard_case_org_matches_commission on public.cases;
create trigger trg_guard_case_org_matches_commission
  before insert or update of organization_id, commission_id on public.cases
  for each row execute function app.guard_case_org_matches_commission();

-- -----------------------------------------------------------------------------
-- 2 · case_participants — the case × participant × role link (ADR 0064 Decision 1).
-- -----------------------------------------------------------------------------
create table if not exists public.case_participants (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  role_id uuid not null references public.case_participant_roles(id),
  is_primary_subject boolean not null default false,
  involvement_summary text,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (case_id, participant_id, role_id)
);
comment on table public.case_participants is
  'ADR 0064 Decision 1 — case × participant × role. Carries ONLY the link + role, never '
  'sensitive attributes (those route to the subtype tables). Cross-tenant integrity is a '
  'BEFORE trigger (HC094), NOT a pure composite FK — cases and participants both anchor '
  'org but the ADR-0054 pure-composite shape cannot span this (R2). Case-scoped RLS via '
  'the broad can_read_case (DEFINER ⇒ R6-safe).';

-- Primary-subject partial-unique: at most one LIVE primary subject per case.
create unique index case_participants_one_primary_subject
  on public.case_participants (case_id)
  where is_primary_subject and removed_at is null;

create index case_participants_case_idx on public.case_participants (case_id);
create index case_participants_participant_idx on public.case_participants (participant_id);

-- R2 cross-tenant guard: the participant must belong to the case's organization.
create or replace function app.assert_participant_same_org_as_case()
  returns trigger language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case_org uuid;
  v_part_org uuid;
begin
  select organization_id into v_case_org from public.cases where id = new.case_id;
  select organization_id into v_part_org from public.participants where id = new.participant_id;
  if v_case_org is null or v_part_org is null or v_case_org is distinct from v_part_org then
    raise exception 'o participante e o caso devem pertencer à mesma organização'
      using errcode = 'HC094';
  end if;
  return new;
end;
$$;
alter function app.assert_participant_same_org_as_case() owner to postgres;

drop trigger if exists trg_assert_participant_same_org_as_case on public.case_participants;
create trigger trg_assert_participant_same_org_as_case
  before insert or update of case_id, participant_id on public.case_participants
  for each row execute function app.assert_participant_same_org_as_case();

alter table public.case_participants enable row level security;

-- Case-scoped: read gated by the broad can_read_case (DEFINER over base tables, R6-safe
-- — E0 does NOT fold any participant term into can_read_case).
--
-- QA phase-F1 MINOR-1: there is deliberately NO write policy here. `can_read_case` is a
-- READ authority — gating a FOR ALL write policy on it would let any case reader write
-- participants, the wrong boundary. Participant writes funnel through DEFINER RPCs (e.g.
-- set_participant_patient, which inserts as the function owner and is grant/RLS-immune)
-- until E1 defines a real write authority for case_participants. No direct-client write
-- path exists — no INSERT/UPDATE/DELETE grant is issued on this table.
create policy case_participants_select on public.case_participants
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));

-- RLS narrows an existing grant; it does not create one (QA phase-F1 MAJOR-1). Without
-- this, case_participants_select is inert and every authenticated read fails with
-- `permission denied` before RLS ever evaluates.
grant select on public.case_participants to authenticated;

-- -----------------------------------------------------------------------------
-- 3 · Re-key case_patient → patient_identifiers (N-per-case, participant-keyed).
--     DROP the 1-per-case table; CREATE the participant-keyed satellite. Reset-OK:
--     the case_patient flag is OFF, so there is no PHI to migrate.
-- -----------------------------------------------------------------------------

-- Drop the old satellite (and its triggers/policies fall with it). The xref-maintain
-- and key-derive trigger FUNCTIONS are re-pointed below, not dropped.
drop table if exists public.case_patient cascade;

create table public.patient_identifiers (
  participant_id uuid primary key
    references public.patient_participants(participant_id) on delete cascade,
  name text,
  mrn text,
  date_of_birth date,
  age_years integer,
  sex text not null default 'unknown',
  encounter_ref text,
  unit text,
  attending text,
  patient_key text,       -- ADR 0039 keyed hash of MRN (NOT PHI)
  encounter_key text,     -- ADR 0039 keyed hash of encounter (NOT PHI)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_identifiers_age_nonneg check (age_years is null or age_years >= 0),
  constraint patient_identifiers_sex_check
    check (sex in ('female', 'male', 'other', 'unknown'))
);
comment on table public.patient_identifiers is
  'ISOLATED PHI (Rule 12 Class 1; ADR 0064 Decision 3, re-keying ADR 0038''s case_patient '
  'from 1-per-case to N-per-case). One row per PATIENT PARTICIPANT of a case. Keyed off the '
  'type-gated patient_participants chain (m4) so identifiers can only hang off a patient. '
  'ALL DML REVOKED from authenticated; written ONLY via the atomic DEFINER '
  'set_participant_patient; read ONLY via the audited doors (get_participant_patient / '
  'get_case_patients → case_patient.read). NEVER selected on list/board/dashboard paths. '
  'The READ scope is the BROAD can_read_case_patient (assignees need the MRN); WRITE is '
  'coordinator-only (ADR 0038 read-broad/write-tight asymmetry preserved).';
comment on column public.patient_identifiers.patient_key is
  'ADR 0039 — non-reversible keyed hash of the MRN. NOT PHI.';
comment on column public.patient_identifiers.encounter_key is
  'ADR 0039 — non-reversible keyed hash of the encounter number. NOT PHI.';

-- Class-1 isolation: revoke ALL DML from authenticated; door-only access.
revoke all on table public.patient_identifiers from authenticated;

alter table public.patient_identifiers enable row level security;
-- No SELECT policy: direct SELECT is revoked; the only read path is the audited DEFINER
-- door, exactly as case_patient was door-only. (RLS enabled to satisfy Rule 1; the door
-- runs SECURITY DEFINER so it is unaffected.)

-- -----------------------------------------------------------------------------
-- 4 · Re-point the key-derive + audit + xref-maintain triggers onto the new table,
--     with the case-module xref grain moved case_id → participant_id (R3 / Q1=A).
-- -----------------------------------------------------------------------------

-- Helper: the case a patient participant currently belongs to (any live link). Used by
-- the doors and the xref-maintain to resolve commission + the audit entity (= case_id).
create or replace function app.case_of_patient_participant(p_participant_id uuid)
  returns uuid
  language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select cp.case_id
  from public.case_participants cp
  where cp.participant_id = p_participant_id
    and cp.removed_at is null
  order by cp.added_at asc
  limit 1;
$$;
alter function app.case_of_patient_participant(uuid) owner to postgres;
revoke all on function app.case_of_patient_participant(uuid) from public;
grant all on function app.case_of_patient_participant(uuid) to authenticated;
grant all on function app.case_of_patient_participant(uuid) to service_role;

-- Key-derive trigger (unchanged logic; re-attached to patient_identifiers).
-- app.trg_derive_patient_keys already derives patient_key/encounter_key from mrn/
-- encounter_ref; it is table-agnostic (reads NEW.mrn / NEW.encounter_ref), so it is
-- reused as-is.
create trigger trg_derive_patient_keys_biu
  before insert or update on public.patient_identifiers
  for each row execute function app.trg_derive_patient_keys();

-- Audit trigger: emit case_patient.updated keyed on the CASE (audit entity stays case_id
-- for continuity with the C-4 dispatch which gates case_patient.* on can_read_case_patient
-- (case_id)). A dedicated wrapper resolves the case from the participant.
create or replace function app.trg_audit_patient_identifiers()
  returns trigger language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case uuid;
  v_comm uuid;
begin
  v_case := app.case_of_patient_participant(coalesce(new.participant_id, old.participant_id));
  if v_case is null then
    return coalesce(new, old);
  end if;
  v_comm := app.commission_of_case(v_case);
  perform app.audit_write('case_patient.updated', 'case_patient', v_case, v_comm,
    'Identificadores de paciente atualizados', '{}'::jsonb);
  return coalesce(new, old);
end;
$$;
alter function app.trg_audit_patient_identifiers() owner to postgres;
create trigger trg_audit_patient_identifiers_aiu
  after insert or update on public.patient_identifiers
  for each row execute function app.trg_audit_patient_identifiers();

-- xref-maintain: the case module's xref grain is now the PARTICIPANT (Q1=A / R3). A
-- dedicated maintainer (the baseline trg_xref_maintain hard-codes case_id and can't be
-- reused for the participant grain). commission resolved via the participant's case.
create or replace function app.trg_xref_maintain_patient_identifiers()
  returns trigger language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_participant uuid;
  v_case uuid;
  v_comm uuid;
  v_reason text;
begin
  if TG_OP = 'DELETE' then
    v_participant := old.participant_id;
    v_reason := coalesce(
      nullif(btrim(coalesce(current_setting('app.phi_dispose_reason', true), '')), ''),
      'other');
    -- Stamp the participant's case-module xref row disposed (retain the row; R3 purge).
    update public.patient_xref
       set disposed_at = coalesce(disposed_at, now()),
           disposed_reason = v_reason
     where module = 'case' and entity_id = v_participant;
    return old;
  end if;

  v_participant := new.participant_id;
  -- Nothing to index when both keys NULL (name-only PHI): no xref row.
  if new.patient_key is null and new.encounter_key is null then
    return new;
  end if;

  v_case := app.case_of_patient_participant(v_participant);
  v_comm := case when v_case is not null then app.commission_of_case(v_case) else null end;

  insert into public.patient_xref (module, entity_id, commission_id, patient_key, encounter_key)
  values ('case', v_participant, v_comm, new.patient_key, new.encounter_key)
  on conflict (module, entity_id) do update
    set patient_key = excluded.patient_key,
        encounter_key = excluded.encounter_key,
        commission_id = excluded.commission_id;
  return new;
end;
$$;
alter function app.trg_xref_maintain_patient_identifiers() owner to postgres;
create trigger trg_xref_maintain_patient_identifiers_aiud
  after insert or delete or update on public.patient_identifiers
  for each row execute function app.trg_xref_maintain_patient_identifiers();

comment on function app.trg_xref_maintain_patient_identifiers() is
  'ADR 0064 R3 / ADR 0065 §9 (Q1=A): the case module now contributes ONE patient_xref row '
  'PER PATIENT PARTICIPANT (entity_id = participant_id), not one per case. Safe because '
  'case_patient is flag-OFF (zero prod PHI). Changes how the case module feeds Phase-23 '
  'cross-committee linkage — see docs/decisions ADR for this re-key.';

-- -----------------------------------------------------------------------------
-- 5 · The atomic DEFINER writer (R4): participant + patient_participants +
--     case_participants link + patient_identifiers, in ONE coordinator-gated call.
-- -----------------------------------------------------------------------------
create or replace function public.set_participant_patient(
  p_case_id uuid,
  p_participant_id uuid default null,      -- null ⇒ create a new patient participant
  p_name text default null,
  p_mrn text default null,
  p_date_of_birth date default null,
  p_age_years integer default null,
  p_sex text default 'unknown',
  p_encounter_ref text default null,
  p_unit text default null,
  p_attending text default null,
  p_role_id uuid default null              -- role for a newly-created participant link
) returns uuid
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
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
$$;
alter function public.set_participant_patient(uuid, uuid, text, text, date, integer, text, text, text, text, uuid) owner to postgres;
revoke all on function public.set_participant_patient(uuid, uuid, text, text, date, integer, text, text, text, text, uuid) from public;
grant all on function public.set_participant_patient(uuid, uuid, text, text, date, integer, text, text, text, text, uuid) to authenticated;
grant all on function public.set_participant_patient(uuid, uuid, text, text, date, integer, text, text, text, text, uuid) to service_role;

-- Compatibility door for the ADR-0038 SINGLE-patient UI (create-case dialog +
-- CasePatientPanel edit). Preserves the original set_case_patient(p_case_id, …) contract
-- and its UPSERT-the-one-patient semantics on top of the N-per-case model: it resolves
-- the case's lone patient participant (if any) and delegates to set_participant_patient,
-- so repeated edits update the same participant rather than creating a new one. The
-- multi-patient E1 UI uses set_participant_patient directly.
create or replace function public.set_case_patient(
  p_case_id uuid,
  p_name text default null,
  p_mrn text default null,
  p_date_of_birth date default null,
  p_age_years integer default null,
  p_sex text default 'unknown',
  p_encounter_ref text default null,
  p_unit text default null,
  p_attending text default null
) returns void
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_existing uuid;
begin
  -- The case's single existing patient participant, if one is already on file. QA
  -- phase-F1 MINOR-2: this resolves via an INNER join on patient_identifiers, which is
  -- safe today because set_participant_patient always writes an identifiers row for
  -- every patient participant it creates — so after any single-patient write the
  -- resolver finds it. The invariant is implicit, though: the E1 multi-patient path
  -- must never create a patient participant WITHOUT a patient_identifiers row, or this
  -- resolver would fail to find it and mint a duplicate patient participant on the next
  -- compat-door edit.
  select cp.participant_id into v_existing
  from public.case_participants cp
  join public.participants p on p.id = cp.participant_id
  join public.patient_identifiers pi on pi.participant_id = cp.participant_id
  where cp.case_id = p_case_id and cp.removed_at is null and p.participant_type = 'patient'
  order by cp.added_at asc
  limit 1;

  perform public.set_participant_patient(
    p_case_id, v_existing, p_name, p_mrn, p_date_of_birth, p_age_years, p_sex,
    p_encounter_ref, p_unit, p_attending, null);
end;
$$;
alter function public.set_case_patient(uuid, text, text, date, integer, text, text, text, text) owner to postgres;
revoke all on function public.set_case_patient(uuid, text, text, date, integer, text, text, text, text) from public;
grant all on function public.set_case_patient(uuid, text, text, date, integer, text, text, text, text) to authenticated;
grant all on function public.set_case_patient(uuid, text, text, date, integer, text, text, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- 6 · The audited read doors (Class-1 single door; NULL-out-of-scope preserved).
--     entity_id logged = the CASE (continuity with the C-4 dispatch on case_patient.read).
-- -----------------------------------------------------------------------------

-- Single-participant door (generalizes get_case_patient → get_participant_patient).
create or replace function public.get_participant_patient(p_participant_id uuid)
  returns jsonb
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case uuid;
  v_case_number integer;
  v_comm uuid;
  v_row public.patient_identifiers;
begin
  v_case := app.case_of_patient_participant(p_participant_id);
  if v_case is null then
    return null;
  end if;
  if not app.can_read_case_patient(v_case, auth.uid()) then
    return null;  -- out of scope → NULL, no audit row (R1 gate inherited unchanged)
  end if;

  select * into v_row from public.patient_identifiers where participant_id = p_participant_id;
  if v_row.participant_id is null then
    return null;  -- entitled, but no PHI on file: nothing read, no audit row
  end if;

  select case_number, app.commission_of_case(v_case)
    into v_case_number, v_comm
    from public.cases where id = v_case;

  perform public.log_audit_access(
    'case_patient.read', 'case_patient', v_case, v_comm,
    'Leitura dos identificadores do paciente do caso ' || v_case_number,
    '{}'::jsonb
  );
  return to_jsonb(v_row);
end;
$$;
alter function public.get_participant_patient(uuid) owner to postgres;
revoke all on function public.get_participant_patient(uuid) from public;
grant all on function public.get_participant_patient(uuid) to authenticated;
grant all on function public.get_participant_patient(uuid) to service_role;

-- N-aware list door: all patient identifiers of a case (the panel needs N). Emits ONE
-- case_patient.read per patient row actually returned; NULL/empty out-of-scope.
create or replace function public.get_case_patients(p_case_id uuid)
  returns jsonb
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case public.cases;
  v_result jsonb := '[]'::jsonb;
  v_row public.patient_identifiers;
begin
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    return null;
  end if;
  if not app.can_read_case_patient(p_case_id, auth.uid()) then
    return null;  -- out of scope → NULL, no audit rows
  end if;

  for v_row in
    select pi.*
    from public.patient_identifiers pi
    join public.case_participants cp
      on cp.participant_id = pi.participant_id and cp.removed_at is null
    where cp.case_id = p_case_id
    order by cp.added_at asc
  loop
    perform public.log_audit_access(
      'case_patient.read', 'case_patient', p_case_id, v_case.commission_id,
      'Leitura dos identificadores do paciente do caso ' || v_case.case_number,
      '{}'::jsonb
    );
    v_result := v_result || to_jsonb(v_row);
  end loop;

  return v_result;   -- [] when entitled but no PHI on file
end;
$$;
alter function public.get_case_patients(uuid) owner to postgres;
revoke all on function public.get_case_patients(uuid) from public;
grant all on function public.get_case_patients(uuid) to authenticated;
grant all on function public.get_case_patients(uuid) to service_role;

-- Compatibility door for the ADR-0038 SINGLE-patient reader (referrals snapshot +
-- CasePatientPanel). Preserves get_case_patient(p_case_id) → the single patient's
-- identifiers (or NULL), emitting the same audited case_patient.read. Delegates to
-- get_participant_patient on the case's lone patient participant.
create or replace function public.get_case_patient(p_case_id uuid)
  returns jsonb
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_participant uuid;
begin
  select cp.participant_id into v_participant
  from public.case_participants cp
  join public.participants p on p.id = cp.participant_id
  join public.patient_identifiers pi on pi.participant_id = cp.participant_id
  where cp.case_id = p_case_id and cp.removed_at is null and p.participant_type = 'patient'
  order by cp.added_at asc
  limit 1;

  if v_participant is null then
    return null;
  end if;
  return public.get_participant_patient(v_participant);
end;
$$;
alter function public.get_case_patient(uuid) owner to postgres;
revoke all on function public.get_case_patient(uuid) from public;
grant all on function public.get_case_patient(uuid) to authenticated;
grant all on function public.get_case_patient(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 7 · The Class-2 professional audited reader (Decision 2). Case-scoped, audited,
--     NO single-door isolation. entity_id = the professional_profile_id.
-- -----------------------------------------------------------------------------
create or replace function public.get_case_professional(p_participant_id uuid)
  returns jsonb
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_profile public.professional_profiles;
  v_profile_id uuid;
  v_case uuid;
  v_comm uuid;
begin
  select professional_profile_id into v_profile_id
    from public.professional_participants where participant_id = p_participant_id;
  if v_profile_id is null then
    return null;
  end if;
  if not app.can_read_professional_profile(v_profile_id, auth.uid()) then
    return null;  -- out of scope → NULL, no audit row
  end if;

  select * into v_profile from public.professional_profiles where id = v_profile_id;

  v_case := (
    select cp.case_id from public.case_participants cp
    where cp.participant_id = p_participant_id and cp.removed_at is null
    order by cp.added_at asc limit 1
  );
  v_comm := case when v_case is not null then app.commission_of_case(v_case) else null end;

  perform public.log_audit_access(
    'professional_profile.read', 'professional_profile', v_profile_id, v_comm,
    'Leitura da identidade profissional', '{}'::jsonb
  );
  return to_jsonb(v_profile);
end;
$$;
alter function public.get_case_professional(uuid) owner to postgres;
revoke all on function public.get_case_professional(uuid) from public;
grant all on function public.get_case_professional(uuid) to authenticated;
grant all on function public.get_case_professional(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 8 · Extend the log_audit_access allow-list + the C-4 entitlement dispatch with the
--     new professional_profile.read verb (O4). The verb must be in BOTH or reads fail:
--     the allow-list (else check_violation) AND _audit_access_authorized (else the C-4
--     forge-guard returns false and the read is silently blocked). case_patient.read is
--     preserved (Q3) — its C-4 arm already gates on can_read_case_patient(case_id), and
--     the re-keyed doors still log entity_id = case_id, so that arm is unchanged.
-- -----------------------------------------------------------------------------
create or replace function public.log_audit_access(
  p_action text, p_entity_type text, p_entity_id uuid, p_commission uuid,
  p_summary text, p_metadata jsonb default '{}'::jsonb
) returns void
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if p_action not in (
    'response.opened_foreign', 'response.exported', 'audit.exported',
    'event_patient.read', 'case.opened',
    'safety_event.viewed', 'triage.viewed', 'rca.viewed', 'capa.viewed',
    'meeting.viewed', 'interview.viewed',
    'referral_patient.read', 'referral.viewed',
    'case_patient.read',
    -- ADR 0064 Class 2 (O4): the audited professional-identity read.
    'professional_profile.read'
  ) then
    raise exception 'log_audit_access: ação de acesso não permitida (%)', p_action
      using errcode = 'check_violation';
  end if;
  -- C-4 entitlement guard: "if you could read it, you may audit that read."
  if not app._audit_access_authorized(p_action, p_entity_id, p_commission) then
    raise exception 'log_audit_access: sem permissão para registrar este acesso'
      using errcode = '42501';
  end if;
  perform app.audit_write(p_action, p_entity_type, p_entity_id, p_commission, p_summary, p_metadata);
end;
$$;
alter function public.log_audit_access(text, text, uuid, uuid, text, jsonb) owner to postgres;

create or replace function app._audit_access_authorized(
  p_action text, p_entity_id uuid, p_commission uuid
) returns boolean
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_event uuid;
  v_resp_commission uuid;
  v_commission uuid;
begin
  if v_uid is null then
    return false;
  end if;
  if coalesce(app.is_admin(), false) then
    return true;
  end if;

  case p_action
    when 'case.opened' then
      return app.can_read_case(p_entity_id, v_uid);
    when 'case_patient.read' then
      return app.can_read_case_patient(p_entity_id, v_uid);
    -- ADR 0064 Class 2: entity is the professional_profile_id; case-scoped gate.
    when 'professional_profile.read' then
      return app.can_read_professional_profile(p_entity_id, v_uid);

    when 'event_patient.read' then
      return app.can_read_event_patient(p_entity_id, v_uid);
    when 'safety_event.viewed' then
      return app.can_read_event(p_entity_id, v_uid);
    when 'triage.viewed' then
      return app.can_read_event(p_entity_id, v_uid);

    when 'rca.viewed' then
      select event_id into v_event from public.rca where id = p_entity_id;
      return v_event is not null and app.can_read_event(v_event, v_uid);

    when 'capa.viewed' then
      return app.can_read_capa(p_entity_id, v_uid);

    when 'meeting.viewed' then
      select commission_id into v_commission from public.meetings where id = p_entity_id;
      return v_commission is not null
             and (app.is_member_of(v_commission) or app.is_commission_admin_of(v_commission));
    when 'interview.viewed' then
      select commission_id into v_commission from public.case_interviews where id = p_entity_id;
      return v_commission is not null
             and (app.is_member_of(v_commission) or app.is_commission_admin_of(v_commission));

    when 'referral.viewed' then
      return app.can_read_referral_phi(p_entity_id, v_uid);
    when 'referral_patient.read' then
      return app.can_read_referral_phi(p_entity_id, v_uid);

    when 'response.opened_foreign' then
      select commission_id into v_resp_commission from public.responses where id = p_entity_id;
      return v_resp_commission is not null
             and (app.is_staff_admin_of(v_resp_commission)
                  or app.is_commission_admin_of(v_resp_commission));

    when 'response.exported' then
      return p_commission is not null
             and (app.is_staff_admin_of(p_commission) or app.is_commission_admin_of(p_commission));
    when 'audit.exported' then
      return p_commission is not null
             and (app.is_staff_admin_of(p_commission) or app.is_commission_admin_of(p_commission));

    else
      return false;
  end case;
end;
$$;
alter function app._audit_access_authorized(text, uuid, uuid) owner to postgres;

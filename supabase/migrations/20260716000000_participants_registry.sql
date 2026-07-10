-- =============================================================================
-- F1 (ADR 0064 E0 / ADR 0065) — Case-Participants foundation, part 1 of 3:
--   the participants typed-identity registry (dialect 3), case-type config,
--   role vocabulary, and the professional-identity sensitivity class (Class 2).
--
-- Reset-OK / pre-launch: additive, correct shape landed ONCE. New surface lands
-- behind the `case_participants` / `case_types` flags, seeded OFF (part 3). RLS is
-- enabled on EVERY new table from creation regardless of the flag (Rule 1) — the
-- flag gates RPC/feature reachability, never the security boundary.
--
-- m2 HARD GATE (ADR 0064): the `case_participants` / `case_types` flags MUST NOT be
-- flipped in ANY environment holding real ethics data until E1's respondent-exclusion
-- RLS lands. This migration ships the `professional_profiles.user_id` self-read hook
-- that E1 later closes; it does not itself close it.
--
-- Dialect 3 (ADR 0065 §1): `participants` is a typed-identity registry —
-- UNIQUE(id, participant_type) + subtype tables pinned by composite FK + CHECK. This
-- is the class-separation invariant (0064 R5): a `professional` participant can never
-- acquire a `patient_identifiers` row, and vice-versa.
--
-- New custom SQLSTATEs (HC high-water was HC093; ADR 0065 §9):
--   HC094 — participant not in the same org as its case (case_participants guard).
--   HC095 — cases.organization_id drift vs commission-resolved org (part 2).
-- The professional gate reuses plain 42501 (Class 2 is deliberately NOT single-door;
-- HC096 held unallocated — lead ruling Q5).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · case_types — org-scoped config catalog (ADR 0064 Decision 4).
--     Catalog table (ADR 0065 §5: tenant-extensible vocabulary → table).
-- -----------------------------------------------------------------------------
create table if not exists public.case_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  display_name text not null,                                   -- pt-BR (Rule 10)
  primary_subject_kind text not null
    check (primary_subject_kind in ('patient', 'professional', 'entity', 'none')),
  -- E1 access-spine hook: DEFINES the column here; does NOT change can_read_case
  -- behavior (that is E1). O1: seed rows carry a sane default so E1 need not retrofit.
  default_visibility_policy text not null default 'commission_default'
    check (default_visibility_policy in ('commission_default', 'explicit_grants_only')),
  default_case_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);
comment on table public.case_types is
  'ADR 0064 Decision 4 — org-scoped case-type config (terminology/workflow/default '
  'visibility/subject kind). A process_template references a case_type; a case snapshots '
  'case_type_id. default_visibility_policy is DEFINED here but wired into can_read_case '
  'only in E1. Catalog table (ADR 0065 §5). Ships behind the case_types flag (OFF at E0).';

alter table public.case_types enable row level security;

-- Org-scoped read for any member of the org; admin-only write.
create policy case_types_select on public.case_types
  for select to authenticated
  using (app.is_org_member(organization_id) or app.is_admin());
create policy case_types_admin_write on public.case_types
  for all to authenticated
  using (app.is_admin() or app.is_org_admin_of(organization_id))
  with check (app.is_admin() or app.is_org_admin_of(organization_id));

-- -----------------------------------------------------------------------------
-- 2 · case_type_terminology — per-type pt-BR label overrides (ADR 0064 Decision 4).
--     All values stay pt-BR (Rule 10) — the type only selects WHICH pt-BR bundle.
-- -----------------------------------------------------------------------------
create table if not exists public.case_type_terminology (
  case_type_id uuid not null references public.case_types(id) on delete cascade,
  term_key text not null
    check (term_key in ('case', 'primary_subject', 'timeline', 'document', 'decision')),
  singular_label text not null,                                 -- pt-BR
  plural_label text,                                            -- pt-BR
  help_text text,                                               -- pt-BR
  primary key (case_type_id, term_key)
);
comment on table public.case_type_terminology is
  'ADR 0064 Decision 4 — per-case-type UI label overrides. Ethics renders Denúncia / '
  'Médico denunciado / Cronologia processual; M&M renders Caso / Paciente / Linha do '
  'tempo. All values pt-BR (Rule 10).';

alter table public.case_type_terminology enable row level security;

create policy case_type_terminology_select on public.case_type_terminology
  for select to authenticated
  using (exists (
    select 1 from public.case_types ct
    where ct.id = case_type_terminology.case_type_id
      and (app.is_org_member(ct.organization_id) or app.is_admin())
  ));
create policy case_type_terminology_admin_write on public.case_type_terminology
  for all to authenticated
  using (exists (
    select 1 from public.case_types ct
    where ct.id = case_type_terminology.case_type_id
      and (app.is_admin() or app.is_org_admin_of(ct.organization_id))
  ))
  with check (exists (
    select 1 from public.case_types ct
    where ct.id = case_type_terminology.case_type_id
      and (app.is_admin() or app.is_org_admin_of(ct.organization_id))
  ));

-- -----------------------------------------------------------------------------
-- 3 · participants — dialect-3 typed-identity registry (ADR 0064 Decision 1).
--     Holds NO sensitive payload — only identity + type. Subtype detail lives in
--     0..1 subtype tables pinned by composite FK + CHECK (R5).
--
--     display_name IS ORG-SCOPED READABLE, therefore NON-PHI BY CONSTRUCTION
--     (lead ruling Q4): for a `patient` participant it MUST be a surrogate/coded
--     label ('Paciente …'), NEVER the raw name. Raw patient identity lives ONLY in
--     patient_identifiers behind the audited door (part 2). Cross-case "same patient"
--     linkage rides patient_key / patient_xref (hashed), not a shared readable name.
-- -----------------------------------------------------------------------------
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  participant_type text not null
    check (participant_type in
      ('patient', 'professional', 'external_person', 'department',
       'institution', 'regulatory_body', 'other')),
  -- m1: the security-reviewer hook — WHICH isolation checklist applies to this row.
  -- Derived from and consistent with participant_type (CHECK, not free-set).
  sensitivity_class text not null
    check (sensitivity_class in ('patient_phi', 'professional_identity', 'non_sensitive')),
  display_name text not null,                                   -- see Q4 note above
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- sensitivity_class DERIVED from participant_type (m1).
  constraint participants_sensitivity_derives_type check (
    (participant_type = 'patient'      and sensitivity_class = 'patient_phi') or
    (participant_type = 'professional' and sensitivity_class = 'professional_identity') or
    (participant_type in ('external_person', 'department', 'institution',
                          'regulatory_body', 'other')
       and sensitivity_class = 'non_sensitive')
  ),

  -- R5 anchor: the composite key subtype tables pin against (id is already unique;
  -- this composite unique is what a composite FK can target).
  constraint participants_id_type_uniq unique (id, participant_type)
);
comment on table public.participants is
  'ADR 0064 Decision 1 — the platform''s reusable typed-identity registry (dialect 3, '
  'ADR 0065 §1). Anything recording WHO/WHAT a row is about references this. Holds NO '
  'sensitive payload — only identity + type. sensitivity_class is CHECK-derived from '
  'participant_type (m1). UNIQUE(id, participant_type) is the composite-FK anchor for '
  'subtype pinning (R5). display_name is org-scoped-readable ⇒ NON-PHI: a patient row '
  'carries a SURROGATE label, never the raw name (raw identity lives only in '
  'patient_identifiers behind the audited door).';
comment on column public.participants.display_name is
  'Org-scoped readable ⇒ NON-PHI by construction. For participant_type=''patient'' this '
  'MUST be a surrogate/coded label (e.g. ''Paciente''), set by set_participant_patient — '
  'NEVER the raw patient name. Raw name/MRN/DOB live only in patient_identifiers.';

alter table public.participants enable row level security;

-- Registry holds no payload → org-scoped read is appropriate. Writes go through the
-- DEFINER writers / coordinator paths (no broad INSERT/UPDATE grant to authenticated).
create policy participants_select on public.participants
  for select to authenticated
  using (app.is_org_member(organization_id) or app.is_admin());

-- -----------------------------------------------------------------------------
-- 4 · case_participant_roles — case-type-aware role vocabulary (ADR 0064 Decision 1).
--     Catalog table (ADR 0065 §5).
-- -----------------------------------------------------------------------------
create table if not exists public.case_participant_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_type_id uuid references public.case_types(id) on delete cascade,
  key text not null,
  display_name text not null,                                   -- pt-BR (Rule 10)
  allowed_participant_types text[] not null,
  is_primary_subject_candidate boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.case_participant_roles is
  'ADR 0064 Decision 1 — case-type-aware role vocabulary (respondent_doctor, complainant, '
  'affected_patient, witness, investigator, …). allowed_participant_types constrains which '
  'participant kinds may take the role; is_primary_subject_candidate flags subject-eligible '
  'roles. Catalog table (ADR 0065 §5).';

-- Role keys unique per (org, type). case_type_id NULL = org-wide role; a NULL cannot
-- participate in a plain UNIQUE, so use a pair of partial unique indexes.
create unique index case_participant_roles_org_type_key_uniq
  on public.case_participant_roles (organization_id, case_type_id, key)
  where case_type_id is not null;
create unique index case_participant_roles_org_key_uniq
  on public.case_participant_roles (organization_id, key)
  where case_type_id is null;

alter table public.case_participant_roles enable row level security;

create policy case_participant_roles_select on public.case_participant_roles
  for select to authenticated
  using (app.is_org_member(organization_id) or app.is_admin());
create policy case_participant_roles_admin_write on public.case_participant_roles
  for all to authenticated
  using (app.is_admin() or app.is_org_admin_of(organization_id))
  with check (app.is_admin() or app.is_org_admin_of(organization_id));

-- -----------------------------------------------------------------------------
-- 5 · professional_profiles — Class-2 professional-identity registry (Decision 2).
--     A doctor-under-review is LGPD personal data but NOT patient health PHI: its
--     own class — case-scoped RLS + AUDITED reads (professional_profile.read on the
--     log_audit_access allow-list) — but NO isolated single door, NO reveal-on-demand.
--     No dispose_* path at E0 (M2 — CFM-retention-vs-erasure posture designed in E1/E2).
-- -----------------------------------------------------------------------------
create table if not exists public.professional_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- m2 self-read hook: a respondent MAY be a platform user (external/former/contractor/
  -- account-less ⇒ NULL). Landed at E0; E1's respondent-exclusion RLS closes the loop.
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  professional_type text,
  license_number text,                                          -- CRM (nullable: unknown)
  license_region text,
  specialty text,
  affiliation_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.professional_profiles is
  'ADR 0064 Decision 2 — Class-2 professional identity (LGPD personal data, NOT patient '
  'PHI). Case-scoped RLS + AUDITED reads (professional_profile.read); NO isolated single '
  'door, NO reveal-on-demand (contrast the three Class-1 patient modules). No dispose_* '
  'path at E0 (M2 — retention-vs-erasure designed in E1/E2). user_id is the E1 '
  'respondent-self-read hook (inert until E1; m2 hard gate).';

-- O3: dedupe a re-entered CRM; nullable license tolerated for account-less/unknown.
create unique index professional_profiles_license_uniq
  on public.professional_profiles (organization_id, license_number, license_region)
  where license_number is not null;

alter table public.professional_profiles enable row level security;

-- Class-2 read gate (Decision 2; lead Q6): case-scoped, DEFINER over base tables so
-- it is R6-safe (never an RLS-gated read of case_participants). A reader may see a
-- professional iff they can_read_case SOME case the professional participates in.
create or replace function app.can_read_professional_profile(p_profile_id uuid, p_uid uuid)
  returns boolean
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if p_uid is null then
    return false;
  end if;
  if coalesce(app.is_admin(), false) then
    return true;
  end if;
  -- DEFINER traversal over BASE tables (bypasses RLS ⇒ no case_participants recursion,
  -- ADR 0064 R6): professional → professional_participants → case_participants(live)
  -- → case, gated by the broad can_read_case.
  return exists (
    select 1
    from public.professional_participants pp
    join public.case_participants cp
      on cp.participant_id = pp.participant_id
     and cp.removed_at is null
    where pp.professional_profile_id = p_profile_id
      and app.can_read_case(cp.case_id, p_uid)
  );
end;
$$;
revoke all on function app.can_read_professional_profile(uuid, uuid) from public;
grant all on function app.can_read_professional_profile(uuid, uuid) to authenticated;
grant all on function app.can_read_professional_profile(uuid, uuid) to service_role;

-- Case-scoped SELECT policy (the audited reader below re-gates + logs; a direct SELECT
-- is still bounded to what the reader may see — Class 2 is not REVOKE-all-isolated).
create policy professional_profiles_select on public.professional_profiles
  for select to authenticated
  using (app.can_read_professional_profile(id, auth.uid()));

-- -----------------------------------------------------------------------------
-- 6 · subtype tables — composite FK + CHECK pin the participant_type (R5).
--     This is the single most important invariant: a `professional` can never
--     acquire a `patient_identifiers` row, and vice-versa.
-- -----------------------------------------------------------------------------

-- 6a · professional_participants — links a `professional` participant to a profile.
create table if not exists public.professional_participants (
  participant_id uuid primary key,
  professional_profile_id uuid not null
    references public.professional_profiles(id) on delete cascade,
  participant_type text not null default 'professional'
    check (participant_type = 'professional'),
  created_at timestamptz not null default now(),
  -- R5 composite pin: this row can only attach to a `professional` participant.
  constraint professional_participants_type_fk
    foreign key (participant_id, participant_type)
    references public.participants (id, participant_type) on delete cascade
);
comment on table public.professional_participants is
  'R5 subtype: pins a professional participant (composite FK + CHECK) to its '
  'professional_profile. A patient participant can never get this row.';

alter table public.professional_participants enable row level security;
create policy professional_participants_select on public.professional_participants
  for select to authenticated
  using (app.can_read_professional_profile(professional_profile_id, auth.uid()));

-- 6b · patient_participants — the type-gated patient subtype chain (m4).
--      patient_identifiers (part 2) hangs off THIS, never off a bare participants row.
create table if not exists public.patient_participants (
  participant_id uuid primary key,
  participant_type text not null default 'patient'
    check (participant_type = 'patient'),
  created_at timestamptz not null default now(),
  -- R5 composite pin: this row can only attach to a `patient` participant.
  constraint patient_participants_type_fk
    foreign key (participant_id, participant_type)
    references public.participants (id, participant_type) on delete cascade
);
comment on table public.patient_participants is
  'R5 subtype (m4): the type-gated patient chain. patient_identifiers keys off this, '
  'so PHI identifiers hang off a type-pinned patient participant, never a bare '
  'participants row. RLS on, no broad SELECT — reached only via the audited door.';

alter table public.patient_participants enable row level security;
-- No broad SELECT policy: patient_participants is reached only via the DEFINER doors
-- (get_participant_patient / get_case_patients) in part 2. DML is DEFINER-only.

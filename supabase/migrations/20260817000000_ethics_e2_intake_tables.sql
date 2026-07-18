-- =============================================================================
-- ETH·E2 (ADR 0073) — BE-2: ethics intake tables (admissibility / allegations /
--   findings) + the allegation-category catalog + the `ethics` feature flag.
--
-- Scope (lead-approved, build-plan §3 BE-2 + the 2026-07-18 "Lead rulings"):
--   1. feature flag `ethics` (seeded OFF).
--   2. ethics_allegation_categories — org-scoped catalog (dialect-2, ADR 0065 §5).
--   3. ethics_case_details      — 1:1 admissibility/intake extension (D1). This
--        table's EXISTENCE is the canonical "ethics-typed case" marker (Lead ruling
--        1: `cases` has no case_type_id; every ethics-only E2 RPC will assert
--        `exists(select 1 from ethics_case_details where case_id = X)`).
--   4. ethics_allegations        — N per case (D2).
--   5. ethics_findings           — 1 per allegation (D2), DENORMALIZED case_id.
--
-- RLS (Rule 1) is enabled on every table from creation. The three case-child
-- tables carry ONE SELECT policy `app.can_read_case(case_id, auth.uid())` — the
-- verbatim E1 (ADR 0072) predicate, NO new shape (post-0078 it is a thin
-- projection of `_case_caps`'s read_case_content bit, but still the correct
-- gate). WRITES are DEFINER-RPC-ONLY (BE-6) — NO authenticated INSERT/UPDATE/
-- DELETE policy or grant exists, so a case READER cannot write them (the
-- meetings/interviews/case-access/case-recusals door pattern; 0064 QA MINOR-1:
-- never gate a FOR-ALL write on the READ predicate). A SELECT grant to
-- `authenticated` is REQUIRED because RLS NARROWS an existing grant, it does not
-- create one (F1 MAJOR-1).
--
-- Catalog SELECT policy mirrors the NAMED live precedent
-- `public.case_participant_roles` (20260716000000_participants_registry.sql
-- L216): `app.is_org_member(organization_id) or app.is_admin()`. UNLIKE that
-- precedent, this catalog carries NO direct FOR-ALL write policy/grant — E2
-- catalog writes go through the BE-6 DEFINER CRUD RPCs
-- (create/archive_ethics_allegation_category), consistent with E2's
-- DEFINER-only write posture (§2.4).
--
-- SQLSTATEs (ADR 0073 D11; RESERVED as documentation here — the BE-6 RPCs
-- TRANSLATE these constraints, this migration only LANDS them):
--   HC0J0 — invalid admissibility/lifecycle state  → ethics_case_details CHECK.
--   HC0J2 — invalid allegation category            → ethics_allegations FK.
--   HC0J3 — a finding already exists               → ethics_findings unique(allegation_id).
-- No RPC, no audit write, and none of the other E2 tables (decisions/votes/
-- notifications/hearings/appeals) or the retention trigger land here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0 · feature flag `ethics` — E2 owns it; seeded OFF (D12). Flipped ON at BE-9
--     via a companion one-line migration once the pgTAP gate is green.
-- -----------------------------------------------------------------------------
insert into app.feature_flags (key, enabled, description) values
  ('ethics', false,
   'When true, the ETH·E2 ethics procedure (ADR 0073) is reachable: admissibility '
   '→ allegations/findings → hearing → vote → decision → appeal, plus the M2 '
   'professional-identity retention-pin/redaction. The E2 tables'' RLS is '
   'can_read_case (unconditional); this flag gates the BE-6 DEFINER RPCs'' '
   'reachability, never the security boundary. Ships OFF (pre-pilot); enabled via '
   'seed.sql for E2E, flipped ON at the E2 gate.')
  on conflict (key) do update set enabled = excluded.enabled, description = excluded.description;

-- -----------------------------------------------------------------------------
-- 1 · ethics_allegation_categories — org-scoped catalog (dialect-2, ADR 0065 §5).
--     Committees add allegation categories at runtime (professional_misconduct,
--     negligence, breach_of_confidentiality, …) without a migration.
-- -----------------------------------------------------------------------------
create table if not exists public.ethics_allegation_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  display_name text not null,                              -- pt-BR (Rule 10)
  is_active boolean not null default true,
  position int not null default 0,
  unique (organization_id, key)
);
comment on table public.ethics_allegation_categories is
  'ADR 0073 D2 — org-scoped ethics allegation-category catalog (dialect-2, ADR 0065 §5). '
  'SELECT gated org-scoped (mirrors case_participant_roles); writes DEFINER-CRUD-only (BE-6). '
  'ethics_allegations.allegation_category_id FKs here — an invalid id is HC0J2.';

alter table public.ethics_allegation_categories enable row level security;

-- SELECT org-scoped — verbatim precedent: public.case_participant_roles (L216).
create policy ethics_allegation_categories_select on public.ethics_allegation_categories
  for select to authenticated
  using (app.is_org_member(organization_id) or app.is_admin());

-- RLS narrows an existing grant (F1 MAJOR-1). SELECT only — writes DEFINER-CRUD (BE-6).
grant select on public.ethics_allegation_categories to authenticated;

-- -----------------------------------------------------------------------------
-- 2 · ethics_case_details — 1:1 admissibility/intake extension (D1). PK = case_id.
--     Its existence marks the case ethics-typed (Lead ruling 1).
-- -----------------------------------------------------------------------------
create table if not exists public.ethics_case_details (
  case_id uuid primary key references public.cases(id) on delete cascade,
  admissibility_status text not null default 'pending'
    check (admissibility_status in ('pending', 'admissible', 'inadmissible')),   -- HC0J0
  admissibility_decided_at timestamptz,
  admissibility_decided_by uuid references public.profiles(id),
  admissibility_rationale_md text,                         -- sanitized Markdown (Rule 7)
  complaint_channel text
    check (complaint_channel in ('internal', 'patient', 'external_body', 'anonymous', 'other')),
  complaint_received_at timestamptz,                       -- the prazo-clock origin
  summary_md text,                                         -- sanitized Markdown (Rule 7)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.ethics_case_details is
  'ADR 0073 D1 — the 1:1 admissibility/intake extension of an ethics case (keyed by '
  'case_id). Its EXISTENCE is the canonical ethics-typed-case marker (Lead ruling 1, '
  '2026-07-18: cases has no case_type_id). SELECT gated by can_read_case; writes '
  'DEFINER-RPC-only (upsert_ethics_case_details / decide_admissibility — BE-6). '
  'admissibility_status CHECK backs HC0J0.';

alter table public.ethics_case_details enable row level security;

create policy ethics_case_details_select on public.ethics_case_details
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));

grant select on public.ethics_case_details to authenticated;

-- -----------------------------------------------------------------------------
-- 3 · ethics_allegations — N per case (D2).
-- -----------------------------------------------------------------------------
create table if not exists public.ethics_allegations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  -- No cascade: an in-use category cannot be hard-deleted (archive via is_active).
  allegation_category_id uuid not null references public.ethics_allegation_categories(id),  -- HC0J2
  description_md text not null,                            -- sanitized Markdown (Rule 7)
  alleged_event_date date,
  severity text check (severity in ('low', 'moderate', 'high', 'critical')),
  status text not null default 'under_review'
    check (status in ('under_review', 'substantiated', 'not_substantiated',
                      'partially_substantiated', 'dismissed', 'referred_elsewhere')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.ethics_allegations is
  'ADR 0073 D2 — one allegation of an ethics case (N per case), each with its own '
  'status + finding. SELECT gated by can_read_case; writes DEFINER-RPC-only '
  '(add/update_ethics_allegation — BE-6). allegation_category_id FK backs HC0J2.';

create index ethics_allegations_case_idx
  on public.ethics_allegations (case_id);
create index ethics_allegations_category_idx
  on public.ethics_allegations (allegation_category_id);

alter table public.ethics_allegations enable row level security;

create policy ethics_allegations_select on public.ethics_allegations
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));

grant select on public.ethics_allegations to authenticated;

-- -----------------------------------------------------------------------------
-- 4 · ethics_findings — 1 per allegation (D2). case_id is DENORMALIZED so the
--     SELECT policy is a BASE-TABLE can_read_case with NO join to
--     ethics_allegations (the R6/perf discipline E1 uses for case_recusals).
-- -----------------------------------------------------------------------------
create table if not exists public.ethics_findings (
  id uuid primary key default gen_random_uuid(),
  allegation_id uuid not null references public.ethics_allegations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,   -- denormalized for base-table RLS
  finding text not null
    check (finding in ('substantiated', 'not_substantiated', 'partially_substantiated',
                       'inconclusive', 'dismissed')),
  rationale_md text,                                       -- sanitized Markdown (Rule 7)
  evidence_summary_md text,                                -- sanitized Markdown (Rule 7)
  decided_by uuid references public.profiles(id),
  decided_at timestamptz not null default now(),
  unique (allegation_id),                                  -- ONE current finding per allegation — HC0J3
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.ethics_findings is
  'ADR 0073 D2 — the current formal conclusion on one allegation (1:1 via '
  'unique(allegation_id) — HC0J3). case_id is DENORMALIZED so the SELECT policy is a '
  'base-table can_read_case (R6/perf — no join to ethics_allegations). Writes '
  'DEFINER-RPC-only (record_ethics_finding — BE-6).';

create index ethics_findings_case_idx
  on public.ethics_findings (case_id);

alter table public.ethics_findings enable row level security;

create policy ethics_findings_select on public.ethics_findings
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));

grant select on public.ethics_findings to authenticated;

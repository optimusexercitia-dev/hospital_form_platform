-- =============================================================================
-- ETH·E1 (ADR 0072 D4) — BE-3: case_conflict_declarations + case_recusals.
--
-- Two case-child tables. RLS enabled from creation (Rule 1). WRITE is DEFINER-RPC-ONLY
-- (BE-5) — NO authenticated write policy exists, so a case READER cannot write them
-- (the meetings/interviews/case-access door pattern; 0064 QA MINOR-1: never gate a
-- FOR-ALL write on the READ predicate). SELECT grant to authenticated is required
-- because RLS NARROWS an existing grant, it does not create one (F1 MAJOR-1).
--
-- New SQLSTATEs (ADR 0072 D9): HC0E0 (live-recusal partial-unique — surfaced by the
-- BE-5 record_recusal RPC), HC0E2 (one declaration per member per case — the
-- unique(case_id, declarant_id) below). Reserved as documentation here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · case_conflict_declarations — a member's self-declared COI on a case.
-- -----------------------------------------------------------------------------
create table if not exists public.case_conflict_declarations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  declarant_id uuid not null references public.profiles(id),
  conflict_type text not null
    check (conflict_type in ('professional_relationship', 'personal_relationship',
                             'financial_interest', 'prior_involvement', 'other')),
  description_md text,                                   -- sanitized Markdown (Rule 7)
  status text not null default 'declared'
    check (status in ('declared', 'recused', 'waived')),
  declared_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  unique (case_id, declarant_id)                         -- HC0E2 (one live per member)
);
comment on table public.case_conflict_declarations is
  'ADR 0072 D4 · E1 — a panel member''s self-declared conflict of interest on a case. '
  'SELECT gated by can_read_case; writes DEFINER-RPC-only (declare_conflict / resolution '
  'via record_recusal). One declaration per (case, declarant) — HC0E2.';

create index case_conflict_declarations_case_idx
  on public.case_conflict_declarations (case_id);

alter table public.case_conflict_declarations enable row level security;

-- SELECT: plain case-read (a declarant always sees their own via the case read).
create policy case_conflict_declarations_select on public.case_conflict_declarations
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));

-- RLS narrows an existing grant (F1 MAJOR-1). SELECT only — NO write grant (DEFINER-only).
grant select on public.case_conflict_declarations to authenticated;

-- -----------------------------------------------------------------------------
-- 2 · case_recusals — a formal recusal; a LIVE row (lifted_at is null) denies read
--     via the BE-4 can_read_case deny-term.
-- -----------------------------------------------------------------------------
create table if not exists public.case_recusals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  reason_md text,                                       -- sanitized Markdown (Rule 7)
  source text not null check (source in ('self', 'coordinator', 'conflict')),
  conflict_declaration_id uuid references public.case_conflict_declarations(id),
  recused_at timestamptz not null default now(),
  recused_by uuid references public.profiles(id),
  lifted_at timestamptz,                                -- soft-lift (audit-preserving)
  lifted_by uuid references public.profiles(id)
);
comment on table public.case_recusals is
  'ADR 0072 D4 · E1 — a formal recusal on a case. LIVE recusal = lifted_at is null; the '
  'can_read_case / can_read_case_patient / can_write_case_content deny-terms filter on '
  'that (the target immediately loses read/write). Soft-lift (lifted_at) restores it. '
  'Writes DEFINER-RPC-only (record_recusal / lift_recusal).';

-- One LIVE recusal per (case, user) — HC0E0. A lifted row does not participate.
create unique index case_recusals_one_live
  on public.case_recusals (case_id, user_id) where lifted_at is null;
-- The deny-term's driving lookup (BE-4 perf note): case_id + user_id among LIVE rows.
create index case_recusals_case_user_live_idx
  on public.case_recusals (case_id, user_id) where lifted_at is null;

alter table public.case_recusals enable row level security;

-- SELECT: the D4 asymmetry. A RECUSED user (whom can_read_case now DENIES) still sees
-- THAT they are recused (self-arm → the "você está impedido" banner) WITHOUT regaining
-- case read; the coordinator sees every recusal to manage the panel (R6-safe: no
-- case_participants read).
create policy case_recusals_select on public.case_recusals
  for select to authenticated
  using (
    app.can_read_case(case_id, auth.uid())
    or user_id = auth.uid()
    or app.is_staff_admin_of_for(app.commission_of_case(case_id), auth.uid())
  );

grant select on public.case_recusals to authenticated;

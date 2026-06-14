-- Cases-Extras batch / R1: case DOCUMENTS & manual EVENTS.
--
-- Two independent child tables of a case (purely additive — no case-workflow
-- state machine, no in_case_rpc chokepoint; these are NOT part of the phase
-- invariant). RLS member-read / staff_admin-write, commission resolved via the
-- existing app.commission_of_case (no new resolver). The matching storage bucket
-- (case-documents) + its policies land in 092003.
--
-- public.case_documents — FILE-BACKED artifacts (minutes/ata, scans, registries).
--   The file lives in the case-documents bucket; this row is its metadata.
--   SOFT-DELETE only (deleted_at/deleted_by): the Storage object is NEVER removed
--   (Architecture Rule 6 — objects are immutable), and reads filter
--   deleted_at IS NULL. doc_type / occurred_at use ASCII slugs / a real-world
--   date distinct from the upload time.
--
-- public.case_events — MANUAL free-text working notes (note/meeting/decision).
--   Fully editable + HARD-deletable (working notes, not immutable artifacts);
--   staff_admin-gated. body is required free text; title optional.
--
-- No new SQLSTATE; no feature-flag gate at the TABLE level (RLS + CHECK suffice).
-- The WRITE ACTIONS gate cases_extras in the TS layer (dark feature returns
-- empty); reads do not gate.

-- ===========================================================================
-- public.cases_extras_enabled() -> boolean   (TS-layer gate for table writes)
-- ===========================================================================
-- R1/R3/R4 add child entities whose writes are DIRECT table operations (not RPCs
-- that can self-gate like the R2 status RPCs). This thin SECURITY DEFINER read
-- lets the server-action layer gate those writes on the cases_extras flag (the
-- flag itself lives in the locked-down app schema, invisible to PostgREST). It
-- exposes only a boolean — no data, no commission scoping needed (the flag is
-- global). Mirrors app.feature_enabled but is callable as a public RPC.
create function public.cases_extras_enabled()
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select app.feature_enabled('cases_extras');
$$;

grant execute on function public.cases_extras_enabled() to authenticated, service_role;
revoke all on function public.cases_extras_enabled() from public, anon;

-- ===========================================================================
-- public.case_documents
-- ===========================================================================
create table public.case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  doc_type text not null default 'other'
    check (doc_type in ('ata', 'digitalizacao', 'registro', 'other')),
  title text not null,
  description text,
  -- The immutable Storage path in the case-documents bucket
  -- ({commission_id}/{case_id}/{uuid}.{ext}); unique so a path is referenced once.
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  -- Real-world date of the document (e.g. the meeting date), distinct from the
  -- upload time (created_at). Nullable.
  occurred_at date,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  -- Soft-delete: the row is hidden (reads filter deleted_at is null), the Storage
  -- object is retained (Rule 6).
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id),
  constraint case_documents_title_not_blank check (btrim(title) <> ''),
  constraint case_documents_size_nonneg check (size_bytes is null or size_bytes >= 0)
);

alter table public.case_documents enable row level security;
create index case_documents_case_idx on public.case_documents (case_id);
-- Partial index for the common "live documents of a case" read.
create index case_documents_case_live_idx
  on public.case_documents (case_id)
  where deleted_at is null;

-- ===========================================================================
-- public.case_events — manual free-text working notes
-- ===========================================================================
create table public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  kind text not null default 'note'
    check (kind in ('note', 'meeting', 'decision', 'other')),
  title text,
  body text not null,
  occurred_at date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_events_body_not_blank check (btrim(body) <> '')
);

alter table public.case_events enable row level security;
create index case_events_case_idx on public.case_events (case_id);

-- ===========================================================================
-- RLS — members read, staff_admin write (commission via app.commission_of_case)
-- ===========================================================================
-- Mirrors the cases family (20260613090007). A member of the case's commission
-- READS (so the case detail can render the docs/events panels); a staff_admin of
-- that commission WRITES (+ admin everywhere). Soft-delete filtering for
-- documents is a QUERY concern (deleted_at is null), not RLS — a staff_admin
-- could un-delete in a future iteration, so the row stays commission-visible.

create policy case_documents_select on public.case_documents
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_case(case_id)) or app.is_admin()
  );

create policy case_documents_staff_admin_write on public.case_documents
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_admin()
  )
  with check (
    app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_admin()
  );

create policy case_events_select on public.case_events
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_case(case_id)) or app.is_admin()
  );

create policy case_events_staff_admin_write on public.case_events
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_admin()
  )
  with check (
    app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_admin()
  );

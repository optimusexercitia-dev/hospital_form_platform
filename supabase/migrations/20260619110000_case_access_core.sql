-- Case Access Control (1 of 3): CORE — the per-case ACL table, the narrative
-- assignee + lifecycle columns, the feature flag (default OFF), and the flag-gate
-- helpers. ADR 0033.
--
-- Goal (ADR 0033): make case access ADJUSTABLE and ATTRIBUTION-DRIVEN. Today a
-- Case is visible in full only to the coordinator (staff_admin); a plain member's
-- only relationship is the single phase they were assigned. This increment adds:
--   * a per-case ACL (case_access) so a coordinator can GRANT read/write to any
--     commission member, and
--   * a single assignee + minimal aberta->concluida lifecycle on case_narratives
--     (mirroring phases), so a narrative has a "whose to-do is this".
-- The READ that flows from ATTRIBUTION (a phase/narrative assignee) is COMPUTED in
-- app.can_read_case (migration …110001), NEVER stored here — so reassigning moves
-- the read automatically (ADR 0033 D6, the rejected "materialize" alternative).
--
-- This migration lands the DATA MODEL + flag only. The three predicates +
-- case_viewer_capabilities + the RLS tighten land in …110001; the RPCs +
-- get_case_detail re-gate + content-write broadening + audit land in …110002 (BE-4).
--
-- INVARIANTS PRESERVED (regression-guard — ADR 0033 §Goal):
--   * Phase-7 submitted-only: untouched here (no responses/answers change).
--   * Phase-fill identity-bound: untouched (case_phases.assigned_to stays the sole
--     fill authority; case_access grants do NOT add a fill path).
--   * PHI-free: this increment never touches can_read_event / event_patient.
--   * Flag OFF ⇒ today's behavior exactly (the …110001 predicate falls back to
--     is_member_of while case_access is OFF; the flag is inserted OFF here).
--
-- New SQLSTATE (continuing the HC0xx class after HC054 = Case Narratives; ADR 0033
-- §Decision D9 reserves HC055+):
--   HC055  narrative wrong lifecycle state: assign/conclude requires 'aberta';
--          reopen requires 'concluida'. (HC020 case-terminal, HC021 not-a-member,
--          HC054 terminal-case narrative freeze, and 42501 narrative-write denial
--          are REUSED unchanged.)

-- ===========================================================================
-- public.case_access — the per-case ACL (ADR 0033 D6)
-- ===========================================================================
-- One row per (case, user) explicit grant. level 'write' IMPLIES 'read' (the
-- predicates treat any row as read; only a 'write' row additionally grants
-- content-write). PK (case_id, user_id) = at most one grant per member per case
-- (re-granting at a new level is an UPSERT in grant_case_access, BE-4) AND it is
-- the index the per-case grant scan in can_read_case uses. Writes go through the
-- DEFINER grant/revoke RPCs ONLY — there is NO INSERT/UPDATE/DELETE policy
-- (…110001), mirroring event_custody / event_patient. granted_by is provenance
-- (who granted it); ON DELETE: a removed member/case cascades their grants away.
create table public.case_access (
  case_id    uuid not null references public.cases (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  level      text not null check (level in ('read', 'write')),
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now(),
  primary key (case_id, user_id)
);

alter table public.case_access enable row level security;

-- Reverse lookup for list_my_cases (BE-4): "the cases this user is granted".
create index case_access_user_idx on public.case_access (user_id);

comment on table public.case_access is
  'Per-case ACL (ADR 0033 D6). One (case,user) grant; level write implies read. '
  'Attribution-derived read is NOT stored here — it is computed in '
  'app.can_read_case. Writes via grant_case_access / revoke_case_access (DEFINER) '
  'only; no INSERT/UPDATE/DELETE policy.';

-- ===========================================================================
-- case_narratives — single assignee + minimal aberta->concluida lifecycle (D5)
-- ===========================================================================
-- assigned_to: a SINGLE assignee (mirroring case_phases.assigned_to; nullable —
--   an un-assigned narrative is authored by any write-grantee, Q14). The assignee
--   gains full-case READ automatically (computed in can_read_case), so an
--   assignee's read cannot be revoked without unassigning (ADR 0033 D6).
-- status: aberta -> concluida. The assignee (or a coordinator) "Conclui" it, which
--   freezes the body; the coordinator can reopen. No activation/blocker gate —
--   narratives are assignable + fillable anytime while the case is non-terminal
--   (the existing case-terminal freeze guard_case_narrative_frozen still applies on
--   top — ADR 0033 D5). concluded_at/by stamp the conclusion.
-- ON DELETE SET NULL on the profile FKs: a profile is never deleted (Rule 2), but
--   keep parity with the rest of the schema's profile references.
alter table public.case_narratives
  add column assigned_to  uuid references public.profiles (id) on delete set null,
  add column status       text not null default 'aberta'
    check (status in ('aberta', 'concluida')),
  add column concluded_at timestamptz,
  add column concluded_by uuid references public.profiles (id) on delete set null;

-- Index the assignee column: can_read_case's narrative-attribution term + the
-- list_my_cases narrative scan both filter case_narratives by assigned_to (perf
-- §7). Existing rows backfill to assigned_to = NULL, status = 'aberta' (the column
-- defaults) — no data migration needed; an existing case's narratives are simply
-- un-assigned + open, which is the correct starting state.
create index case_narratives_assigned_to_idx on public.case_narratives (assigned_to);

-- ===========================================================================
-- Feature flag — case_access (default OFF)
-- ===========================================================================
-- CRUX (ADR 0033 D9): while this flag is OFF, app.can_read_case (…110001) falls
-- back to app.is_member_of (today's behavior) so the restrictive boundary does NOT
-- bite until the feature ships, and the new RPC surface is gated. Flipped ON
-- in-increment at completion (BE-6), mirroring the case_narratives / patient_safety
-- flips. Tests flip it ON inside their rolled-back transaction (hermetic).
insert into app.feature_flags (key, enabled, description) values
  ('case_access', false,
   'When true, the Case Access Control feature (per-case read/write grants via '
   || 'case_access, attribution-driven full-case read computed in '
   || 'app.can_read_case, the narrative assignee + aberta/concluida lifecycle, and '
   || 'the "Meus Casos" list) is live. While OFF, app.can_read_case falls back to '
   || 'is_member_of so the restrictive boundary does not bite. Enabled at '
   || 'Case Access Control completion.');

-- app.assert_case_access_enabled() — the RPC entry gate (raises 23514 when OFF).
-- Mirrors app.assert_narratives_enabled / app.assert_patient_safety_enabled.
create function app.assert_case_access_enabled()
returns void
language plpgsql
stable
set search_path = app, public, pg_catalog
as $$
begin
  if not app.feature_enabled('case_access') then
    raise exception 'o controle de acesso ao caso não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function app.assert_case_access_enabled() from public;
grant execute on function app.assert_case_access_enabled() to authenticated, service_role;

-- public.case_access_enabled() — TS-layer gate for the server actions. Thin
-- SECURITY DEFINER boolean read of the flag (which lives in the locked-down app
-- schema). Mirrors public.case_narratives_enabled / public.patient_safety_enabled.
create function public.case_access_enabled()
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select app.feature_enabled('case_access');
$$;

grant execute on function public.case_access_enabled() to authenticated, service_role;
revoke all on function public.case_access_enabled() from public, anon;

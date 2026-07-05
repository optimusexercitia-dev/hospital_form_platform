-- =============================================================================
-- WS-6 · Performance — pilot-window sweep (P2, P3, P4, P5, P8).
-- =============================================================================
-- Pre-pilot DB hardening, Wave 2. Detail:
--   docs/plans/pre-pilot-db-hardening-program.md §1 WS-6.
--
-- This migration is the ADDITIVE DB surface for the query-layer perf sweep. All
-- objects are new or index-only; no RLS SHAPE changes, no behavior change to any
-- existing read path's visibility. Every DEFINER RPC here reproduces the EXACT
-- membership/authz gate of the function it derives from — the added cursor/limit
-- params filter WITHIN that already-scoped set and can never widen visibility.
--
-- Contents:
--   §1 P2 — list_audit_filter_actors(p_commission): distinct actors in scope,
--           SELECT DISTINCT ON in the DB instead of a full-table client fetch.
--   §2 P4 — get_feature_flags(): all feature flags as one jsonb object, one round
--           trip, replacing N per-flag *_enabled() calls at the call site.
--   §3 P3 — keyset pagination: pqs_inbox gains (p_cursor, p_limit); list_cases_board
--           gains p_limit (CAPPED board, no cursor — see §3b); + the composite
--           indexes backing each paginated list's keyset order.
--
-- P5 is pure query-layer (submissions.ts embedded filter) — no DB object here.
-- P8 (per-scope CAPA counter) shipped folded into D4 in Wave 1 — not here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- §1 · P2 — distinct audit actors (RPC, not a bare view, so the RLS-matching
--      scope is explicit and cannot silently diverge from audit_log's SELECT policy).
-- -----------------------------------------------------------------------------
-- Returns the DISTINCT set of actors (actor_id + resolved name) that appear in the
-- audit_log rows the CALLER may read, optionally scoped to one commission. This is
-- SECURITY INVOKER: it runs under the caller's RLS, so the audit_log SELECT policy
-- (admin: all; staff_admin: own commission; else none) is the authority — exactly
-- the visibility the old client-side full-scan had, minus the full fetch. A NULL
-- actor (system) surfaces as one row with actor_id = null.
create or replace function public.list_audit_filter_actors(p_commission uuid default null)
returns table (actor_id uuid, full_name text)
language sql
stable
security invoker
set search_path to 'public', 'pg_catalog'
as $$
  select distinct on (al.actor_id) al.actor_id, p.full_name
  from public.audit_log al
  left join public.profiles p on p.id = al.actor_id
  where p_commission is null or al.commission_id = p_commission
  order by al.actor_id, p.full_name;
$$;

alter function public.list_audit_filter_actors(uuid) owner to postgres;

comment on function public.list_audit_filter_actors(uuid) is
  'P2 (WS-6): distinct audit actors in the caller''s readable scope. SECURITY INVOKER — audit_log RLS is the authority (same visibility as the former client-side scan). Optional p_commission narrows to one commission. NULL actor_id = system.';

-- -----------------------------------------------------------------------------
-- §2 · P4 — one-shot feature-flags read. Replaces N separate *_enabled() DEFINER
--      round trips (7 in c/[commission]/layout.tsx alone) with ONE. Mirrors the
--      per-flag functions' pattern (SQL STABLE SECURITY DEFINER over app.feature_flags)
--      but returns the WHOLE table as a jsonb object { key: enabled, ... }.
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER (like every *_enabled() sibling) because app.feature_flags is
-- not directly readable by `authenticated`; the flags are non-sensitive booleans.
create or replace function public.get_feature_flags()
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select coalesce(jsonb_object_agg(key, enabled), '{}'::jsonb)
  from app.feature_flags;
$$;

alter function public.get_feature_flags() owner to postgres;

comment on function public.get_feature_flags() is
  'P4 (WS-6): all feature flags as one jsonb object { key: enabled }. One round trip replacing the per-flag *_enabled() calls. SECURITY DEFINER (app.feature_flags is not authenticated-readable); flags are non-sensitive booleans.';

-- -----------------------------------------------------------------------------
-- §3 · P3 — keyset pagination.
-- -----------------------------------------------------------------------------

-- §3a · pqs_inbox — a real list; keyset fits. Adds (p_cursor_reported_at, p_cursor_id,
--       p_limit). The OPERATOR-hospital gate (enrolled pqs_members UNION appointed
--       nsp_coordinator) is REPRODUCED byte-for-byte from the CURRENT definition
--       (20260710000000_nsp_per_hospital.sql §6, ADR 0052 — NOT the superseded per-org
--       baseline); the cursor predicate is ANDed AFTER it, so pagination filters
--       within — never widens — the visible set.
--       Sort/keyset: (reported_at DESC, id DESC). limit is p_limit+1-free: the caller
--       requests limit and asks for one extra row to detect nextCursor (we return
--       exactly p_limit here and let the caller over-fetch by passing p_limit+1).
--       Kept simplest: the query returns up to p_limit rows; the TS layer passes
--       limit+1 and trims — mirroring the standard keyset idiom without duplicating
--       the has-more flag in SQL.
drop function if exists public.pqs_inbox(text, text, uuid);
create or replace function public.pqs_inbox(
  p_status text default null,
  p_suspected_harm_level text default null,
  p_reporting_commission_id uuid default null,
  p_cursor_reported_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 25
) returns table (
  id uuid, code text, title text, status text, suspected_harm_level text,
  reporting_commission_id uuid, reporting_commission_name text,
  current_owner_kind text, current_owner_commission_id uuid,
  case_id uuid, case_number integer,
  reported_at timestamptz, acknowledged_at timestamptz
)
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select
    e.id, e.code, e.title, e.status, e.suspected_harm_level,
    e.reporting_commission_id, rc.name,
    e.current_owner_kind, e.current_owner_commission_id,
    e.case_id, c.case_number,
    e.reported_at, e.acknowledged_at
  from public.patient_safety_event e
  join public.commissions rc on rc.id = e.reporting_commission_id
  left join public.cases c on c.id = e.case_id
  where rc.hospital_id in (
          select hospital_id from public.pqs_members where user_id = auth.uid()
          union
          select hospital_id from public.organization_members
          where user_id = auth.uid() and role = 'nsp_coordinator' and hospital_id is not null
        )
    and (p_status is null or e.status = p_status)
    and (p_suspected_harm_level is null or e.suspected_harm_level = p_suspected_harm_level)
    and (p_reporting_commission_id is null or e.reporting_commission_id = p_reporting_commission_id)
    -- Keyset: rows strictly AFTER the cursor in (reported_at DESC, id DESC) order.
    -- Row-tuple comparison; NULL cursor = first page (predicate is a no-op).
    and (
      p_cursor_reported_at is null
      or (e.reported_at, e.id) < (p_cursor_reported_at, p_cursor_id)
    )
  order by e.reported_at desc, e.id desc
  limit greatest(p_limit, 0);
$$;

alter function public.pqs_inbox(text, text, uuid, timestamptz, uuid, integer) owner to postgres;

comment on function public.pqs_inbox(text, text, uuid, timestamptz, uuid, integer) is
  'P3 (WS-6): keyset-paginated NSP inbox. Sort (reported_at DESC, id DESC); cursor = last row''s (reported_at, id). SECURITY DEFINER; the operator-hospital gate (enrolled pqs_members UNION appointed nsp_coordinator) is unchanged from 20260710000000 (ADR 0052) — the cursor filters WITHIN the visible set, never widens it. Caller over-fetches by passing p_limit+1 to detect a next page.';

-- §3b · list_cases_board — a KANBAN board (column-per-status), NOT a flat list. A single
--       flat keyset cursor over (case_number DESC) slices ACROSS status columns and would
--       empty out columns per page, breaking the board UX. Per the lead's condition-b:
--       CAP it (most-recent-N by case_number) and expose it as a single non-cursored page
--       (the TS layer returns nextCursor:null). We add only p_limit (default 200 — well
--       above any real pre-pilot per-commission case count) and keep the existing gate +
--       ordering. No new index: cases_commission_number_key UNIQUE(commission_id,
--       case_number) already backs the per-commission case_number-desc scan.
drop function if exists public.list_cases_board(uuid);
create or replace function public.list_cases_board(
  p_commission_id uuid,
  p_limit integer default 200
) returns table (
  case_id uuid, case_number integer, label text, status text,
  outcome_id uuid, outcome jsonb, created_at timestamptz, closed_at timestamptz, phases jsonb
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $$
begin
  if not app.is_staff_admin_of(p_commission_id) then
    return;
  end if;

  return query
  select c.id,
         c.case_number,
         c.label,
         c.status,
         c.outcome_id,
         case when o.id is null then null else jsonb_build_object(
           'id', o.id,
           'label', o.label,
           'color_token', o.color_token,
           'requires_action_plan', o.requires_action_plan,
           'is_adverse', o.is_adverse
         ) end as outcome,
         c.created_at,
         c.closed_at,
         coalesce(
           (select jsonb_agg(jsonb_build_object(
               'position', cp.position,
               'title', cp.title,
               'status', cp.status,
               'recommended', cp.recommended,
               'assigned_to', cp.assigned_to,
               'assignee_name', pr.full_name,
               'due_date', cp.due_date,
               'result', case when prr.id is null then null else jsonb_build_object(
                 'id', prr.id,
                 'label', prr.label,
                 'color_token', prr.color_token,
                 'is_adverse', prr.is_adverse,
                 'source', cp.result_source
               ) end
             ) order by cp.position)
            from public.case_phases cp
            left join public.profiles pr on pr.id = cp.assigned_to
            left join public.phase_results prr on prr.id = cp.result_id
            where cp.case_id = c.id),
           '[]'::jsonb) as phases
  from public.cases c
  left join public.case_outcomes o on o.id = c.outcome_id
  where c.commission_id = p_commission_id
  order by c.case_number desc
  limit greatest(p_limit, 0);
end;
$$;

alter function public.list_cases_board(uuid, integer) owner to postgres;

comment on function public.list_cases_board(uuid, integer) is
  'P3 (WS-6): CAPPED kanban board (most-recent p_limit cases by case_number desc). NOT keyset-cursored — a flat cursor cannot page a column-per-status board (condition-b). Gate + ordering unchanged from baseline. Backed by cases_commission_number_key UNIQUE(commission_id, case_number).';

-- §3d · P4 — count_open_cases_for_board: the sidebar OPEN-cases badge counter. The
--       layout previously derived this from list_cases_board(...).filter(open).length —
--       pulling up to CASES_BOARD_CAP rows WITH nested phase JSON on every coordinator
--       page-load, purely to count. This returns just the integer.
--
--       Visibility MUST equal the board's. The board is DEFINER-gated by
--       is_staff_admin_of(commission) and then shows EVERY case of that commission — a
--       visibility a direct RLS-scoped `cases` count CANNOT reproduce (cases_select =
--       app.can_read_case [broad per-case ACL] OR is_commission_admin_of [org/hospital
--       admin] — neither equals is_staff_admin_of). So this is a DEFINER counter that
--       repeats the board's EXACT gate + the same commission scope, counting only the
--       non-terminal ("open") statuses the badge shows (concluido/cancelado are terminal;
--       nao_iniciado/em_revisao/pendente are open — mirrors isTerminalCaseStatus). A
--       non-staff_admin gets 0 (gate returns before the count).
create or replace function public.count_open_cases_for_board(p_commission_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $$
begin
  if not app.is_staff_admin_of(p_commission_id) then
    return 0;
  end if;

  return (
    select count(*)::int
    from public.cases c
    where c.commission_id = p_commission_id
      and c.status not in ('concluido', 'cancelado')
  );
end;
$$;

alter function public.count_open_cases_for_board(uuid) owner to postgres;

comment on function public.count_open_cases_for_board(uuid) is
  'P4 (WS-6): the sidebar open-cases badge count. Reproduces list_cases_board''s EXACT visibility — same is_staff_admin_of(commission) gate, same commission scope — counting only non-terminal (open) statuses. Replaces board.filter(open).length (which pulled up-to-CASES_BOARD_CAP rows + phase JSON just to count). A non-staff_admin gets 0.';

-- -----------------------------------------------------------------------------
-- §3c · Composite indexes backing the keyset orderings of the query-layer lists
--       (listSubmissions / listMeetings / listCommissionReferrals) and pqs_inbox.
--       Not covered by the Wave-1 P9/P10 index set. list_cases_board needs none
--       (see §3b). All CREATE INDEX IF NOT EXISTS — additive, reset-OK.
-- -----------------------------------------------------------------------------

-- listSubmissions keyset: (submitted_at DESC NULLS LAST, updated_at DESC, id DESC)
-- within a commission. submitted_at is NULL for in_progress rows (the opt-in filter),
-- so keep NULLS LAST to match the query's .order(..., nullsFirst:false).
create index if not exists responses_commission_submitted_keyset_idx
  on public.responses using btree
  (commission_id, submitted_at desc nulls last, updated_at desc, id desc);

-- listMeetings keyset: (scheduled_start DESC, id DESC) within a commission.
create index if not exists meetings_commission_scheduled_keyset_idx
  on public.meetings using btree
  (commission_id, scheduled_start desc, id desc);

-- listCommissionReferrals keyset: (created_at DESC, id DESC), read via an OR over
-- (source_commission_id, target_commission_id). Two partial-column-leading indexes
-- serve each arm of the OR without an expression index; PostgREST's OR expands to a
-- UNION-able pair the planner can satisfy per arm.
create index if not exists case_referral_source_created_keyset_idx
  on public.case_referral using btree
  (source_commission_id, created_at desc, id desc);
create index if not exists case_referral_target_created_keyset_idx
  on public.case_referral using btree
  (target_commission_id, created_at desc, id desc);

-- pqs_inbox keyset: (reported_at DESC, id DESC). The operator-hospital gate joins
-- commissions, but the sort + cursor comparison drive off patient_safety_event directly.
create index if not exists patient_safety_event_reported_keyset_idx
  on public.patient_safety_event using btree
  (reported_at desc, id desc);

-- -----------------------------------------------------------------------------
-- §4 · Function grants. WS-2 C-2 (20260711000100) flipped the default privileges
--      to revoke-per-object, and the DROP+CREATE above discarded the baseline's
--      explicit grants — so re-establish the intended posture for the (re)created
--      functions: EXECUTE to authenticated + service_role, NOT to PUBLIC. This
--      matches every existing RPC's grant pattern (a bare CREATE leaves only the
--      PUBLIC default, which we do not want on tenant RPCs).
-- -----------------------------------------------------------------------------
revoke all on function public.list_audit_filter_actors(uuid) from public;
grant execute on function public.list_audit_filter_actors(uuid) to authenticated, service_role;

revoke all on function public.get_feature_flags() from public;
grant execute on function public.get_feature_flags() to authenticated, service_role;

revoke all on function public.pqs_inbox(text, text, uuid, timestamptz, uuid, integer) from public;
grant execute on function public.pqs_inbox(text, text, uuid, timestamptz, uuid, integer) to authenticated, service_role;

revoke all on function public.list_cases_board(uuid, integer) from public;
grant execute on function public.list_cases_board(uuid, integer) to authenticated, service_role;

revoke all on function public.count_open_cases_for_board(uuid) from public;
grant execute on function public.count_open_cases_for_board(uuid) to authenticated, service_role;

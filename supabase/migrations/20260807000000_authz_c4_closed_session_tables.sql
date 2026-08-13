-- ============================================================================
-- ADR 0078 Gate 2 · Stage C · C4 — reserved (closed) session tables.
-- Plan lines 373–376, A4. Three tables, greenfield:
--   • meeting_closed_sessions          = a time BLOCK, NO authority.
--   • meeting_closed_session_items     = the SUBSTANCE; reach resolves here.
--       NO authenticated SELECT (C5's DEFINER RPC projects the four tiers).
--   • meeting_closed_session_item_readers = the reader list, consulted ONLY when
--       case_id IS NULL. CASE AUTHORITY IS NEVER OUT-VOTED BY A READER LIST.
--
-- A4·1's column list omits a decision field and a "who withdrew and why" field;
-- A7 says one row carries all four tiers but never amended it — both added here
-- (plan lines 392–394): `decision` and `withdrawals`.
--
-- WRITES go through C6's coordinator-only DEFINER RPCs; these tables carry RLS
-- with NO authenticated write policy (BUG-SUP-002: no broad authenticated DML
-- behind a DEFINER gate). meeting_closed_sessions gets a reach-scoped SELECT
-- (the block metadata is low-sensitivity); the items + readers have NO
-- authenticated policy at all (C5/C6 DEFINER reach them as owner).
--
-- ⚠ Wave-2 landmine carried: meeting_closed_sessions_select reads reach via
-- can_reach_meeting(meeting_id) — that re-queries public.meetings, whose PARENT
-- row already exists when a session is inserted, so the INSERT…RETURNING trap
-- (C3/120) does NOT bite here. A self-referential re-query would; none is used.
-- LOCAL ONLY.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. meeting_closed_sessions — the time block.
-- ----------------------------------------------------------------------------
create table public.meeting_closed_sessions (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references public.meetings(id) on delete cascade,
  label       text,
  opened_by   uuid references public.profiles(id),
  opened_at   timestamptz not null default now(),
  closed_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index meeting_closed_sessions_meeting_idx on public.meeting_closed_sessions(meeting_id);

alter table public.meeting_closed_sessions enable row level security;

-- The block metadata is readable by meeting reachers (times); writes are DEFINER
-- (C6). items + readers get NO grant (RPC-only). New tables receive no default
-- privileges here, so grant SELECT explicitly.
grant select on public.meeting_closed_sessions to authenticated;

-- Reach-scoped read of the block (existence + times); no authority beyond reach.
create policy meeting_closed_sessions_select on public.meeting_closed_sessions
  for select to authenticated
  using (
    app.can_reach_meeting(meeting_id, (select auth.uid()))
    or app.is_commission_admin_of(app.commission_of_meeting(meeting_id))
  );

-- ----------------------------------------------------------------------------
-- 2. meeting_closed_session_items — the substance. NO authenticated SELECT.
-- ----------------------------------------------------------------------------
create table public.meeting_closed_session_items (
  id                 uuid primary key default gen_random_uuid(),
  closed_session_id  uuid not null references public.meeting_closed_sessions(id) on delete cascade,
  case_id            uuid references public.cases(id),          -- nullable: case-less
  position           integer not null default 1,
  quorum_met         boolean not null default true,             -- stub tier
  started_at         timestamptz,                               -- stub tier
  ended_at           timestamptz,                               -- stub tier
  withdrawals        text,                                      -- propriety tier (who withdrew + why)
  substance          text,                                      -- substance tier
  decision           text,                                      -- decision tier
  created_at         timestamptz not null default now()
);
create index meeting_closed_session_items_session_idx on public.meeting_closed_session_items(closed_session_id);
create index meeting_closed_session_items_case_idx on public.meeting_closed_session_items(case_id);

alter table public.meeting_closed_session_items enable row level security;
-- NO policy: authenticated SELECT/DML denied by RLS. Only C5/C6 (DEFINER, owner)
-- reach these rows, and the tier projection lives in C5.

-- ----------------------------------------------------------------------------
-- 3. meeting_closed_session_item_readers — reader list (case_id IS NULL only).
-- ----------------------------------------------------------------------------
create table public.meeting_closed_session_item_readers (
  id        uuid primary key default gen_random_uuid(),
  item_id   uuid not null references public.meeting_closed_session_items(id) on delete cascade,
  user_id   uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (item_id, user_id)
);
create index meeting_closed_session_item_readers_item_idx on public.meeting_closed_session_item_readers(item_id);

alter table public.meeting_closed_session_item_readers enable row level security;
-- NO policy: consulted only by C5/C6 (DEFINER). The reader list never out-votes
-- case authority — it is read ONLY on the case_id IS NULL branch (enforced in C5).

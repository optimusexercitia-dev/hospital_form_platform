-- Phase 14a / B3: Patient-Safety / NSP — ISOLATED PHI, append-only custody ledger,
-- and the ACCESS-FOLLOWS-CUSTODY RLS (the novel, security-sensitive core). ADR 0031.
--
-- This migration lands the two child tables and the custody-aware access model:
--   * public.event_patient — the ISOLATED 0..1 PHI satellite (PK = event_id). The
--     ONLY place patient identifiers live (minimum-necessary, Rule 12). Encryption-
--     ready: the most sensitive columns (name / mrn / encounter_ref) can move to
--     extensions.pgcrypto column-level encryption with no shape change.
--   * public.event_custody — the APPEND-ONLY hand-off ledger. The current holder is
--     the row with held_until IS NULL. app.guard_event_custody is tightened per the
--     lead's Q1: it permits ONLY a held_until NULL->non-null close, ONLY under
--     app.in_safety_rpc; it rejects any change to an already-set held_until, any
--     other-column UPDATE, and ALL DELETE (a closed interval is permanent — history
--     is never rewritten).
--   * app.can_read_event(event_id, uid) — the SINGLE access-follows-custody predicate
--     reused by every 14a table (and inherited by 14b–14d children): read = member of
--     the event's CURRENT-OWNER commission OR member of the REPORTING commission
--     (provenance, never revoked) OR app.is_pqs_member(uid)/admin. A PQS-held event
--     has a NULL owner commission, so the owner term is simply false and access falls
--     to provenance OR PQS — exactly right.
--   * the RLS policies on event + custody + patient (member-READ via can_read_event;
--     writes via the B4 lifecycle RPCs only). PHI is NEVER selected on queue/list/
--     aggregate paths — the B4 pqs_inbox + the query-layer list select governance
--     columns only; event_patient is loaded ONLY by the dedicated audited read.
--
-- The mutation-audit triggers (PHI-free allow-lists) + the flag flip land in B4.

-- ===========================================================================
-- public.event_patient — the ISOLATED PHI satellite (0..1 per event)
-- ===========================================================================
-- PK = event_id (so exactly 0 or 1 PHI rows per event), ON DELETE CASCADE from the
-- event. Minimum-necessary identifiers only (Rule 12): name, MRN, DOB or age, sex,
-- encounter ref, unit, attending. age_years is the less-identifying fallback when a
-- DOB is unavailable/withheld. This table carries the SAME access-follows-custody
-- scope as the event, but its READ is AUDITED (the query-layer getEventPatient emits
-- an event_patient.read row, B5) — HIPAA requires logging PHI access (Rule 11/12).
create table public.event_patient (
  event_id uuid primary key references public.patient_safety_event (id) on delete cascade,
  name text,
  mrn text,
  date_of_birth date,
  age_years integer,
  sex text not null default 'unknown'
    check (sex in ('female', 'male', 'other', 'unknown')),
  encounter_ref text,
  unit text,
  attending text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_patient_age_nonneg check (age_years is null or age_years >= 0)
);

alter table public.event_patient enable row level security;

comment on table public.event_patient is
  'ISOLATED PHI (Rule 12) — the ONLY place patient identifiers live. 0..1 per event '
  '(PK = event_id). Read via the dedicated AUDITED path only (event_patient.read, '
  'Rule 11); NEVER selected on queue/list/aggregate paths. Encryption-ready.';

-- ===========================================================================
-- public.event_custody — the APPEND-ONLY hand-off ledger
-- ===========================================================================
-- One row per custody interval. The current holder is the row with held_until IS
-- NULL (there is at most one open interval per event — partial unique index below).
-- notify_safety_event opens the initial PQS-held interval; transfer_event_custody
-- closes the open interval (sets held_until) and appends a new one (B4). owner_kind
-- 'commission' must name the commission; 'pqs' must not.
create table public.event_custody (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.patient_safety_event (id) on delete cascade,
  owner_kind text not null
    check (owner_kind in ('pqs', 'commission')),
  owner_commission_id uuid references public.commissions (id) on delete no action,
  held_from timestamptz not null default now(),
  held_until timestamptz,
  assigned_by uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now(),
  constraint event_custody_owner_shape check (
    (owner_kind = 'pqs' and owner_commission_id is null)
    or (owner_kind = 'commission' and owner_commission_id is not null)
  ),
  constraint event_custody_interval_order check (
    held_until is null or held_until >= held_from
  )
);

alter table public.event_custody enable row level security;

create index event_custody_event_idx on public.event_custody (event_id, held_from);
-- At most one OPEN interval (the current holder) per event.
create unique index event_custody_open_interval_key
  on public.event_custody (event_id)
  where held_until is null;

comment on table public.event_custody is
  'APPEND-ONLY custody ledger (ADR 0031). Current holder = the row with held_until '
  'IS NULL. Guarded: only a held_until NULL->non-null close (under app.in_safety_rpc) '
  'is permitted; no other UPDATE, no DELETE — a closed interval is permanent.';

-- ===========================================================================
-- app.guard_event_custody — APPEND-ONLY with a single flagged close (Q1)
-- ===========================================================================
-- BEFORE UPDATE OR DELETE. The ONLY legal mutation of an existing row is closing the
-- open interval: held_until NULL -> non-null, with EVERY OTHER column unchanged, and
-- ONLY under app.in_safety_rpc (so transfer_event_custody can do it; a direct client
-- write cannot). Everything else — re-closing/altering an already-set held_until, any
-- other-column edit, and ALL DELETE — raises HC043 (history is never rewritten). A
-- commission cascade cannot reach this table (owner_commission_id is ON DELETE NO
-- ACTION; the event cascade deletes whole rows as the table owner, bypassing this
-- BEFORE trigger only on the event-delete path, which itself is RPC-gated).
create function app.guard_event_custody()
returns trigger
language plpgsql
set search_path = app, pg_catalog
as $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_safety_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    raise exception 'o histórico de custódia do evento é imutável (não pode ser excluído)'
      using errcode = 'HC043';
  end if;

  -- UPDATE: only the one-time close of the open interval, only under the flag.
  if not v_in_rpc then
    raise exception 'o histórico de custódia do evento é imutável (somente inserção)'
      using errcode = 'HC043';
  end if;

  if old.held_until is not null then
    raise exception 'um intervalo de custódia já encerrado não pode ser alterado'
      using errcode = 'HC043';
  end if;

  if new.held_until is null then
    raise exception 'a única alteração permitida é encerrar o intervalo de custódia atual'
      using errcode = 'HC043';
  end if;

  -- Every other column must be unchanged (only held_until may move NULL->non-null).
  if new.id is distinct from old.id
     or new.event_id is distinct from old.event_id
     or new.owner_kind is distinct from old.owner_kind
     or new.owner_commission_id is distinct from old.owner_commission_id
     or new.held_from is distinct from old.held_from
     or new.assigned_by is distinct from old.assigned_by
     or new.note is distinct from old.note
     or new.created_at is distinct from old.created_at then
    raise exception 'apenas o encerramento (held_until) de um intervalo de custódia pode ser alterado'
      using errcode = 'HC043';
  end if;

  return new;
end;
$$;

create trigger guard_event_custody_trg
  before update or delete on public.event_custody
  for each row execute function app.guard_event_custody();

-- ===========================================================================
-- app.can_read_event(event_id, uid) -> boolean    (access-follows-custody predicate)
-- ===========================================================================
-- The SINGLE access predicate every 14a table's SELECT policy uses (and 14b–14d
-- children inherit). SECURITY DEFINER + uid-pure so pgTAP can assert it per-user and
-- so it bypasses RLS internally (no recursion). Read =
--   * member of the event's CURRENT-OWNER commission (custodian), OR
--   * member of the REPORTING commission (provenance — never revoked by a transfer), OR
--   * app.is_pqs_member(uid) (= admin today; membership-ready).
-- A PQS-held event has current_owner_commission_id IS NULL, so the custodian term is
-- false (is_member_of_for(NULL,...) is false) and access falls to provenance OR PQS.
create function app.can_read_event(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1
    from public.patient_safety_event e
    where e.id = p_event_id
      and (
        app.is_member_of_for(e.current_owner_commission_id, p_user_id)
        or app.is_member_of_for(e.reporting_commission_id, p_user_id)
        or app.is_pqs_member(p_user_id)
      )
  );
$$;

revoke all on function app.can_read_event(uuid, uuid) from public;
grant execute on function app.can_read_event(uuid, uuid) to authenticated, service_role;

-- ===========================================================================
-- RLS — patient_safety_event (member SELECT via can_read_event; no client write)
-- ===========================================================================
-- READ = the access-follows-custody predicate (OR the live JWT-claim admin path).
-- There is NO INSERT/UPDATE/DELETE policy: every write goes through the B4 lifecycle
-- RPCs (SECURITY DEFINER), which own the state machine + custody + audit. The
-- guard_event_status trigger backstops any direct attempt the absence of a policy
-- already denies.
create policy patient_safety_event_select on public.patient_safety_event
  for select to authenticated
  using (app.can_read_event(id, auth.uid()) or app.is_admin());

-- ===========================================================================
-- RLS — event_custody (member SELECT via can_read_event; append-only, no policy write)
-- ===========================================================================
-- READ = the same access scope as the event. No write policy (the B4 RPCs insert/
-- close under SECURITY DEFINER; the guard enforces append-only regardless of role).
create policy event_custody_select on public.event_custody
  for select to authenticated
  using (app.can_read_event(event_id, auth.uid()) or app.is_admin());

-- ===========================================================================
-- RLS — event_patient (member SELECT via can_read_event; reads are AUDITED in B5)
-- ===========================================================================
-- READ = the SAME access scope as the event (tightest, Rule 12). The .read AUDIT is
-- a query-layer concern (getEventPatient, B5) — RLS cannot emit an audit row. PHI is
-- NEVER selected on queue/list/aggregate paths (minimum-necessary); only the
-- dedicated panel read loads this table. No client write policy (set_event_patient,
-- B4, writes under SECURITY DEFINER).
create policy event_patient_select on public.event_patient
  for select to authenticated
  using (app.can_read_event(event_id, auth.uid()) or app.is_admin());

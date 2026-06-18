-- Phase 14b / B2: Patient-Safety / NSP — TRIAGE freeze guard + RLS (the security-
-- sensitive surface). ADR 0030/0032.
--
-- This migration lands:
--   * app.guard_event_triage — the worksheet FREEZE. Mirrors the meetings/interviews
--     content-freeze + 14a's guard_event_status: keyed on the PARENT EVENT status (not
--     a local flag), gated by the EXISTING 14a app.in_safety_rpc GUC (one flag covers
--     both the event status flip and the worksheet write inside a triage RPC). Once the
--     parent event is 'triaged' (or terminal), any worksheet/flag write outside a
--     triage RPC raises HC045 — the "viewable-forever, immutable once confirmed" rule.
--   * RLS on event_triage + event_triage_sentinel_flags: member-READ = the event's
--     access-follows-custody scope (reuse 14a's app.can_read_event); NO client write
--     policy — every write is a DEFINER RPC (B3), PQS/admin-gated via is_pqs_member.
--   * RLS on the config vocab (pqs_event_types + pqs_sentinel_criteria): any-
--     authenticated READ (non-PHI, needed by the committee notify form's type picker
--     too); NO client write policy (is_pqs_member-gated DEFINER CRUD, B3).
--   * RLS on the rca shell: member-READ = event scope; NO write policy (14c owns RCA
--     writes — the shell is inserted by confirm_triage under DEFINER).

-- ===========================================================================
-- app.guard_event_triage — freeze the worksheet once the event is triaged
-- ===========================================================================
-- BEFORE UPDATE OR DELETE on event_triage. Legal writes:
--   * Always, under app.in_safety_rpc (the triage RPCs own save/confirm/reopen).
--   * Outside the flag: REJECT any write/delete whose parent event is 'triaged' or
--     terminal ('closed'/'cancelled') → HC045. (A worksheet on a 'reported'/
--     'acknowledged' event is only ever written by save_triage anyway — which sets the
--     flag — so the practical effect is: a frozen worksheet is immutable except via
--     reopen_triage, which first flips the event back to 'acknowledged'.)
-- Reads the parent status via a subquery (the worksheet has no status of its own),
-- exactly like guard_meeting_child_lock keys on the parent meeting status. The event
-- cascade deletes whole worksheet rows as the table owner; that path is itself RPC-
-- gated upstream (the event delete is guarded by guard_event_status).
create function app.guard_event_triage()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_safety_rpc', true), 'off') = 'on';
  v_event_id uuid := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  v_event_status text;
begin
  -- Under the flag the triage RPCs are the authority — admit the write.
  if v_in_rpc then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select status into v_event_status
  from public.patient_safety_event
  where id = v_event_id;

  if v_event_status in ('triaged', 'closed', 'cancelled') then
    raise exception 'a triagem confirmada é imutável (reabra a triagem para editar)'
      using errcode = 'HC045';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger guard_event_triage_trg
  before update or delete on public.event_triage
  for each row execute function app.guard_event_triage();

-- ===========================================================================
-- RLS — event_triage (member SELECT via can_read_event; no client write)
-- ===========================================================================
-- READ = the same access-follows-custody scope as the parent event (reuse the 14a
-- predicate). NO INSERT/UPDATE/DELETE policy: every write goes through the B3 DEFINER
-- triage RPCs (is_pqs_member-gated). The guard backstops direct attempts the absent
-- policy already denies.
create policy event_triage_select on public.event_triage
  for select to authenticated
  using (app.can_read_event(event_id, auth.uid()) or app.is_admin());

-- ===========================================================================
-- RLS — event_triage_sentinel_flags (member SELECT via can_read_event; no write)
-- ===========================================================================
create policy event_triage_sentinel_flags_select on public.event_triage_sentinel_flags
  for select to authenticated
  using (app.can_read_event(event_id, auth.uid()) or app.is_admin());

-- ===========================================================================
-- RLS — pqs_event_types + pqs_sentinel_criteria (any-authenticated READ; no write)
-- ===========================================================================
-- Non-PHI config vocab. Any authenticated user READS (the committee notify form's
-- event-type picker needs this too, not just the NSP). NO client write policy — the
-- B3 is_pqs_member-gated DEFINER CRUD owns writes.
create policy pqs_event_types_select on public.pqs_event_types
  for select to authenticated
  using (true);

create policy pqs_sentinel_criteria_select on public.pqs_sentinel_criteria
  for select to authenticated
  using (true);

-- ===========================================================================
-- RLS — rca shell (member SELECT via can_read_event; no client write — 14c owns it)
-- ===========================================================================
-- Consistent with the rest of the NSP tables (never world-readable). 14c adds the
-- write policy + can_write_rca; here the shell is inserted by confirm_triage (DEFINER).
create policy rca_select on public.rca
  for select to authenticated
  using (app.can_read_event(event_id, auth.uid()) or app.is_admin());

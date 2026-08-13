-- =============================================================================
-- ADR 0078 · Gate 2 fix wave — MAJOR-2: reserved-session content escapes the
-- meeting child lock (qa review §3).
--
-- `app.guard_meeting_child_lock` is attached (pg_trigger-verified) to
-- meeting_agenda_items, meeting_attendees, meeting_cases — and to NONE of
-- meeting_closed_sessions, meeting_closed_session_items,
-- meeting_closed_session_item_readers. `open_reserved_session` /
-- `add_reserved_item` gate on `is_staff_admin_of` with NO status check.
--
-- Proven on a `distributed` meeting, one transaction, sibling as the control:
--   >>> AGENDA INSERT BLOCKED: 23514 (o conteúdo desta reunião está bloqueado)
--   >>> open_reserved_session SUCCEEDED
--   >>> add_reserved_item     SUCCEEDED   ← INTEGRITY GAP
-- Ordinary agenda content cannot be authored into a signed+distributed ata; the
-- most confidential content in the model can. The composed ata renders the
-- reserved tiers and meeting_signatures.content_hash signs the record ⇒ a
-- coordinator can append deliberation to an already-signed, already-distributed
-- ata without invalidating the signature.
--
-- Fixed at the TABLE layer, not in the RPCs: per memory
-- `definer-rpc-gate-needs-table-level-enforcement` (BUG-SUP-002), an RPC-only
-- gate is bypassable whenever the table carries broad DML. The trigger binds
-- every writer.
--
-- Anchoring:
--   meeting_closed_sessions            → has meeting_id  → the EXISTING guard fits.
--   meeting_closed_session_items       → closed_session_id → needs a 1-hop join.
--   meeting_closed_session_item_readers→ item_id           → needs a 2-hop join.
-- Hence one new guard for the two deeper children.
--
-- NOTE: `dispose_meeting_minutes` (A10 — retained by PO decision) touches
-- `meetings` + `meeting_agenda_items` only, NOT the reserved tables, so Rule-12
-- disposal is unaffected by this migration (verified from the live body).
-- =============================================================================

create or replace function app.guard_reserved_child_lock()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_key        uuid;
  v_meeting_id uuid;
  v_status     text;
begin
  if tg_table_name = 'meeting_closed_session_items' then
    if tg_op = 'DELETE' then v_key := old.closed_session_id; else v_key := new.closed_session_id; end if;
    select s.meeting_id into v_meeting_id
      from public.meeting_closed_sessions s
     where s.id = v_key;

  elsif tg_table_name = 'meeting_closed_session_item_readers' then
    if tg_op = 'DELETE' then v_key := old.item_id; else v_key := new.item_id; end if;
    select s.meeting_id into v_meeting_id
      from public.meeting_closed_session_items i
      join public.meeting_closed_sessions s on s.id = i.closed_session_id
     where i.id = v_key;

  else
    raise exception 'app.guard_reserved_child_lock attached to unexpected table %', tg_table_name;
  end if;

  -- The ancestor may already be gone (a cascade delete of the meeting / session
  -- also cascades these children); nothing to lock in that case. Mirrors
  -- app.guard_meeting_child_lock's own cascade branch.
  if v_meeting_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select status into v_status from public.meetings where id = v_meeting_id;
  if v_status is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if v_status in ('in_signature', 'signed', 'distributed', 'cancelled') then
    raise exception 'o conteúdo desta reunião está bloqueado (%)', v_status
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

-- meeting_closed_sessions carries meeting_id directly → the existing guard fits.
drop trigger if exists guard_meeting_child_lock_closed_sessions_trg on public.meeting_closed_sessions;
create trigger guard_meeting_child_lock_closed_sessions_trg
  before insert or update or delete on public.meeting_closed_sessions
  for each row execute function app.guard_meeting_child_lock();

drop trigger if exists guard_reserved_child_lock_items_trg on public.meeting_closed_session_items;
create trigger guard_reserved_child_lock_items_trg
  before insert or update or delete on public.meeting_closed_session_items
  for each row execute function app.guard_reserved_child_lock();

drop trigger if exists guard_reserved_child_lock_readers_trg on public.meeting_closed_session_item_readers;
create trigger guard_reserved_child_lock_readers_trg
  before insert or update or delete on public.meeting_closed_session_item_readers
  for each row execute function app.guard_reserved_child_lock();

-- GUARD -----------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  select string_agg(t.tbl, ', ') into v_missing
    from (values ('meeting_closed_sessions'), ('meeting_closed_session_items'),
                 ('meeting_closed_session_item_readers')) as t(tbl)
   where not exists (
     select 1 from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_proc p on p.oid = tg.tgfoid
     where c.relname = t.tbl
       and not tg.tgisinternal
       and p.proname in ('guard_meeting_child_lock', 'guard_reserved_child_lock'));
  if v_missing is not null then
    raise exception 'Gate-2 MAJOR-2: the meeting child lock is NOT attached to: %', v_missing;
  end if;
end $$;

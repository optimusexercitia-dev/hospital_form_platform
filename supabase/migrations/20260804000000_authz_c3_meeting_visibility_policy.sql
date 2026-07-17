-- ============================================================================
-- ADR 0078 Gate 2 · Stage C · C3 — meetings.visibility_policy + the reach gate.
-- Plan lines 366–371. Sequenced BEFORE C1/C2 (this migration) because their
-- projection RPCs consume app.can_reach_meeting, defined here.
--
-- WHAT: a meeting is either `commission_default` (member-wide, today's behaviour)
-- or `participants_only` (only attendees + commission admins reach it). The
-- "Nova reunião → Participantes" roster gains authorization meaning.
--
-- BINDINGS (plan:369):
--   • reach(meeting) = is_member_of(commission) AND
--       (visibility_policy='commission_default' OR caller is an attendee)
--   • is_member_of stays AND-ed — NO cross-committee guests.
--   • NO coordinator OR-arm — a recused coordinator who is not an attendee must
--     not read a sub-group (participants_only) meeting.
--   • participants_only REQUIRES a non-empty roster, enforced in the DB.
--
-- ⚠ DEVIATION FROM PLAN WORDING (flagged for lead): the plan says "new enum".
-- This ships `text` + CHECK, matching the existing public.cases.visibility_policy
-- convention (also text) so the two visibility columns stay uniform and C5's
-- cross-reference reasoning never straddles an enum/text boundary. Trivial to
-- convert to an enum if the lead prefers.
--
-- Catalog-verified (predicates copied from pg_policies, not migration text).
-- LOCAL ONLY. The is_commission_admin_of arm on every *_select policy is KEPT
-- here and removed by C7 (clean attribution).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. The column.
-- ----------------------------------------------------------------------------
alter table public.meetings
  add column visibility_policy text not null default 'commission_default';

alter table public.meetings
  add constraint meetings_visibility_policy_check
  check (visibility_policy in ('commission_default', 'participants_only'));

comment on column public.meetings.visibility_policy is
  'ADR 0078 C3. commission_default = member-wide; participants_only = attendees + '
  'commission admins only (reach via app.can_reach_meeting). participants_only '
  'requires a non-empty roster (enforced by trg_meetings_roster / trg_attendee_roster).';

-- ----------------------------------------------------------------------------
-- 2. The reach gate. DEFINER — it reads meetings/meeting_attendees regardless of
--    the caller's RLS, and is itself called from the *_select policies (so it
--    must not recurse through RLS).
-- ----------------------------------------------------------------------------
create or replace function app.can_reach_meeting(p_meeting_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_member_of_for(app.commission_of_meeting(p_meeting_id), p_uid)
     and (
       (select m.visibility_policy from public.meetings m where m.id = p_meeting_id)
         = 'commission_default'
       or exists (
         select 1 from public.meeting_attendees a
         where a.meeting_id = p_meeting_id and a.user_id = p_uid
       )
     );
$$;

revoke all on function app.can_reach_meeting(uuid, uuid) from public;
grant execute on function app.can_reach_meeting(uuid, uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Re-cut the five meeting SELECT policies onto can_reach_meeting.
--    is_member_of(...) → can_reach_meeting(meeting_id, auth.uid()); the
--    is_commission_admin_of arm is preserved (C7 removes it).
-- ----------------------------------------------------------------------------
-- ⚠ meetings_select is INLINED (not routed through can_reach_meeting) on purpose:
-- an INSERT ... RETURNING evaluates the SELECT policy on the NEW row, and
-- can_reach_meeting re-queries public.meetings by id — the just-inserted row is
-- not yet visible to that subquery, so visibility_policy reads NULL and a
-- legitimate creator's RETURNING is denied (breaks create_meeting). Reading the
-- candidate row's own columns (commission_id, visibility_policy) avoids the
-- re-query. This is logically identical to can_reach_meeting for this table
-- (commission_of_meeting(id) = commission_id here). Child-table policies keep
-- can_reach_meeting — their parent meeting already exists when children insert.
drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings
  for select to authenticated
  using (
    (app.is_member_of(commission_id)
     and (visibility_policy = 'commission_default'
          or exists (select 1 from public.meeting_attendees a
                     where a.meeting_id = meetings.id
                       and a.user_id = (select auth.uid()))))
    or app.is_commission_admin_of(commission_id)
  );

drop policy if exists meeting_agenda_items_select on public.meeting_agenda_items;
create policy meeting_agenda_items_select on public.meeting_agenda_items
  for select to authenticated
  using (
    app.can_reach_meeting(meeting_id, (select auth.uid()))
    or app.is_commission_admin_of(app.commission_of_meeting(meeting_id))
  );

drop policy if exists meeting_attendees_select on public.meeting_attendees;
create policy meeting_attendees_select on public.meeting_attendees
  for select to authenticated
  using (
    app.can_reach_meeting(meeting_id, (select auth.uid()))
    or app.is_commission_admin_of(app.commission_of_meeting(meeting_id))
  );

drop policy if exists meeting_cases_select on public.meeting_cases;
create policy meeting_cases_select on public.meeting_cases
  for select to authenticated
  using (
    (app.can_reach_meeting(meeting_id, (select auth.uid()))
     or app.is_commission_admin_of(app.commission_of_meeting(meeting_id)))
    and app.can_reach_case_on_member_surface(case_id, (select auth.uid()))
  );

drop policy if exists meeting_signatures_select on public.meeting_signatures;
create policy meeting_signatures_select on public.meeting_signatures
  for select to authenticated
  using (
    app.can_reach_meeting(meeting_id, (select auth.uid()))
    or app.is_commission_admin_of(app.commission_of_meeting(meeting_id))
  );

-- ----------------------------------------------------------------------------
-- 4. Roster invariant: a participants_only meeting must have >= 1 attendee.
--    Enforced with IMMEDIATE triggers (testable via throws_ok; the realistic
--    flow is create commission_default -> add attendees -> flip participants_only).
-- ----------------------------------------------------------------------------
create or replace function app.assert_meeting_roster_nonempty(p_meeting_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.meeting_attendees a where a.meeting_id = p_meeting_id) then
    raise exception 'uma reunião restrita aos participantes exige ao menos um participante'
      using errcode = 'HC0C3';
  end if;
end;
$$;

revoke all on function app.assert_meeting_roster_nonempty(uuid) from public;

-- Fires when a meeting is created as, or flipped to, participants_only.
create or replace function app.trg_meetings_roster()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.visibility_policy = 'participants_only' then
    perform app.assert_meeting_roster_nonempty(new.id);
  end if;
  return new;
end;
$$;

create trigger trg_meetings_roster
  before insert or update of visibility_policy on public.meetings
  for each row execute function app.trg_meetings_roster();

-- Prevents emptying the roster of a participants_only meeting (which would make
-- it unreadable to everyone but commission admins — the invariant read backwards).
create or replace function app.trg_attendee_roster()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy text;
begin
  select m.visibility_policy into v_policy from public.meetings m where m.id = old.meeting_id;
  if v_policy = 'participants_only'
     and not exists (
       select 1 from public.meeting_attendees a
       where a.meeting_id = old.meeting_id and a.id <> old.id
     ) then
    raise exception 'não é possível remover o último participante de uma reunião restrita'
      using errcode = 'HC0C3';
  end if;
  return old;
end;
$$;

create trigger trg_attendee_roster
  before delete on public.meeting_attendees
  for each row execute function app.trg_attendee_roster();

-- =============================================================================
-- ADR 0078 · Gate 2 fix wave — P0: the Organization User's arm is REVERSED in
-- the DEFINER doors (qa `docs/reviews/authz-gate-2-review.md` §1).
--
-- C7 removed `app.is_commission_admin_of` from every meeting_* policy. Four
-- surfaces put it back. All are `prosecdef = t` ⇒ RLS never runs ⇒ the policy
-- fix is bypassed entirely. Proven live (orgadmin.a, preconditions asserted
-- is_commission_admin_of = t / is_member_of = f / can_reach_meeting = f):
-- the base tables return 0/0/0/0 while `get_meeting_agenda_items` returns 2
-- rows with title + description and `get_meeting_cases` returns the decision.
-- Only a Next.js 404 gated it → Architecture Rule 1 (never rely on UI hiding).
--
-- A8: an Organization User reads NO meeting record. Appendix B: Organization
-- User × Meeting metadata = None; × Meeting content = No.
--
-- ⚠ EVERY BODY BELOW WAS REGENERATED FROM THE LIVE CATALOG
-- (`pg_get_functiondef`), NOT from migration text (ADR 0078 A28 — migration
-- text is stale by design). ONLY the gate line is edited.
-- ⚠ `get_reserved_session_items` is VOLATILE (commit ac57a20 — its audit INSERT
-- raises 25006 under PostgREST if it reverts to STABLE, because PostgREST runs
-- STABLE/IMMUTABLE functions in a read-only transaction). Its volatility is
-- carried by OMITTING a volatility keyword (VOLATILE is the default). Do NOT
-- write STABLE here. Re-asserted at the foot of this migration.
-- ⚠ CREATE OR REPLACE throughout — a DROP + CREATE resets the ACL and makes the
-- function anon-EXECutable (the regression 17a8d08 had to fix).
-- =============================================================================

-- 1 ---------------------------------------------------------------------------
create or replace function public.get_meeting_agenda_items(p_meeting_id uuid)
 returns setof public.meeting_agenda_items
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_comm uuid := app.commission_of_meeting(p_meeting_id);
begin
  -- C7/A8 (Gate-2 fix): the `or app.is_commission_admin_of(v_comm)` arm is GONE.
  -- An Organization User reads no meeting record. Reach is the only door.
  if not app.can_reach_meeting(p_meeting_id, v_uid) then
    return;
  end if;

  -- Rule 11: the meeting-view surface already emits 'meeting.viewed' (app layer);
  -- this projection is read within it, so no duplicate log here.

  return query
    select (app._project_meeting_agenda_item(ai, v_uid)).*
    from public.meeting_agenda_items ai
    where ai.meeting_id = p_meeting_id
    order by ai.position;
end;
$function$;

-- 2 ---------------------------------------------------------------------------
create or replace function public.get_meeting_cases(p_meeting_id uuid)
 returns setof public.meeting_cases
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_comm uuid := app.commission_of_meeting(p_meeting_id);
begin
  -- C7/A8 (Gate-2 fix): the org arm is GONE.
  if not app.can_reach_meeting(p_meeting_id, v_uid) then
    return;  -- no reach → empty
  end if;

  -- Rule 11: the meeting-view surface already emits 'meeting.viewed' (app layer,
  -- src/lib/queries/meetings.ts) and the case surface emits 'case.opened'; this
  -- projection is read within those audited surfaces, so no duplicate log here.

  return query
    select (app._project_meeting_case(mc, v_uid)).*
    from public.meeting_cases mc
    where mc.meeting_id = p_meeting_id
    order by mc.created_at;
end;
$function$;

-- 3 ---------------------------------------------------------------------------
-- ⚠ VOLATILE — no volatility keyword below, ON PURPOSE (see header).
create or replace function public.get_reserved_session_items(p_meeting_id uuid)
 returns table(id uuid, closed_session_id uuid, case_id uuid, item_position integer,
               quorum_met boolean, started_at timestamp with time zone,
               ended_at timestamp with time zone, process_number integer,
               withdrawals text, substance text, decision text)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid  uuid := (select auth.uid());
  v_comm uuid := app.commission_of_meeting(p_meeting_id);
begin
  -- C7/A8 (Gate-2 fix): the org arm is GONE. This door read a sub-group ethics
  -- case's process number + outcome to a principal outside the committee.
  if not app.can_reach_meeting(p_meeting_id, v_uid) then
    return;  -- no reach → the reserved session is invisible
  end if;

  -- Rule 11: the reserved-session read is an audited meeting access (reuse
  -- 'meeting.viewed'; no new action — see Wave-2 audit ruling).
  perform public.log_audit_access(
    'meeting.viewed', 'meeting', p_meeting_id, v_comm,
    'Leitura da sessão reservada da reunião', '{}'::jsonb);

  return query
  select
    i.id,
    i.closed_session_id,
    i.case_id,
    i.position,
    i.quorum_met,                                            -- stub: reach
    i.started_at,
    i.ended_at,
    -- propriety · process number: case-linked AND not the respondent.
    case when i.case_id is not null
              and not app.is_case_respondent(i.case_id, v_uid)
         then c.case_number end,
    -- propriety · withdrawal names: case-linked, not respondent, and A26 —
    -- member-wide for commission_default; deliberation-gated for explicit_grants_only.
    case when i.case_id is not null
              and not app.is_case_respondent(i.case_id, v_uid)
              and (c.visibility_policy = 'commission_default'
                   or app.has_case_capability(i.case_id, v_uid, 'read_case_deliberation'))
         then i.withdrawals end,
    -- substance: case-anchored → read_case_deliberation; case-less → reader list.
    case
      when i.case_id is null then
        case when exists (select 1 from public.meeting_closed_session_item_readers r
                          where r.item_id = i.id and r.user_id = v_uid)
             then i.substance end
      else
        case when app.has_case_capability(i.case_id, v_uid, 'read_case_deliberation')
             then i.substance end
    end,
    -- decision: case-anchored → NOT excluded; case-less → reader list.
    case
      when i.case_id is null then
        case when exists (select 1 from public.meeting_closed_session_item_readers r
                          where r.item_id = i.id and r.user_id = v_uid)
             then i.decision end
      else
        case when not app.is_case_excluded(i.case_id, v_uid)
             then i.decision end
    end
  from public.meeting_closed_session_items i
  join public.meeting_closed_sessions s on s.id = i.closed_session_id
  left join public.cases c on c.id = i.case_id
  where s.meeting_id = p_meeting_id
  order by s.opened_at, i.position;
end;
$function$;

-- 4 ---------------------------------------------------------------------------
-- The LATENT arm: dead behind the `can_read_case` pre-gate (an Organization User
-- has can_read_case = false — A4, verified). Removed as a RE-ARMING TRAP: if a
-- future change relaxes the pre-gate, the arm silently returns the meeting
-- surface. 245 asserts it stays dead.
create or replace function public.get_case_meeting_links(p_case_id uuid)
 returns setof public.meeting_cases
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if not app.can_read_case(p_case_id, v_uid) then
    return;  -- cannot read the case → no timeline meeting content
  end if;

  -- Rule 11: gated by can_read_case; the case-detail surface already audits the
  -- case read ('case.opened'). No duplicate log for this projection.

  return query
    select (app._project_meeting_case(mc, v_uid)).*
    from public.meeting_cases mc
    where mc.case_id = p_case_id
      and app.can_reach_meeting(mc.meeting_id, v_uid)  -- C7/A8: org arm GONE
    order by mc.created_at;
end;
$function$;

-- 5 — the policy ---------------------------------------------------------------
drop policy if exists meeting_closed_sessions_select on public.meeting_closed_sessions;
create policy meeting_closed_sessions_select on public.meeting_closed_sessions
  for select to authenticated
  using (app.can_reach_meeting(meeting_id, (select auth.uid())));  -- C7/A8: org arm GONE

-- GUARDS ----------------------------------------------------------------------
do $$
declare
  v_bad text;
begin
  -- No surface touched here may still carry the arm.
  -- ⚠ §7.2 — "text is not truth": a body regex MATCHES COMMENTS. The bodies above
  -- deliberately NAME the removed arm in their comments, so a naive
  -- `pg_get_functiondef(p.oid) ~ 'is_commission_admin_of'` fails on its own
  -- documentation. (It did, on the first apply of this migration.) Assert over
  -- LIVE CODE LINES ONLY.
  select string_agg(p.proname, ', ') into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('get_meeting_agenda_items','get_meeting_cases',
                       'get_reserved_session_items','get_case_meeting_links')
     and exists (
       select 1 from unnest(string_to_array(pg_get_functiondef(p.oid), E'\n')) ln
        where ln ~ 'app\.is_commission_admin_of' and trim(ln) !~ '^--'
     );
  if v_bad is not null then
    raise exception 'Gate-2 P0: the org arm survives as LIVE CODE in: %', v_bad;
  end if;

  -- ⚠ THE RE-EMIT TRAP: get_reserved_session_items must still be VOLATILE.
  if (select provolatile from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'get_reserved_session_items') <> 'v' then
    raise exception 'Gate-2 P0: get_reserved_session_items lost VOLATILE (ac57a20) — '
                    'its audit INSERT will raise 25006 under PostgREST';
  end if;

  -- ⚠ THE ACL-RESET TRAP: no function in public may be anon-EXECutable.
  select string_agg(p.proname, ', ') into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (p.proacl is null or array_to_string(p.proacl, ',') ~ '(^|,)anon=');
  if v_bad is not null then
    raise exception 'Gate-2 P0: anon-EXECutable / null-ACL functions in public: %', v_bad;
  end if;
end $$;

-- =============================================================================
-- ADR 0078 · Gate 2 fix wave — MINOR-1: `get_reserved_session_items` projects
-- started_at / ended_at to the RESPONDENT (qa review §6).
--
-- A7: the respondent sees the bare stub — "no number, no withdrawal list, NO
-- TIMES." A26 later reclassifies "item reserved, quorum held, times" as the
-- non-identifying stub, which licenses times for a non-granted MEMBER — but A26
-- was ruling on the member, not the respondent, so A7's "no times" for the
-- respondent is UNSUPERSEDED. Gate times on NOT is_case_respondent so the
-- documents stop contradicting each other.
--
-- Case-less items (case_id IS NULL — the only scenario A4·1 exists for) keep
-- their times: app.is_case_respondent(NULL, ·) is FALSE, so the NOT is TRUE and
-- the stub renders. This is A24·4's trap read in the safe direction — the bug
-- there was `case_id IS NOT NULL AND NOT is_case_respondent(...)`, which masks
-- the case-less branch for everyone. Do not "tidy" this into that shape.
--
-- ⚠ Body regenerated from the live catalog after 20260816000000 (the P0 cut),
-- NOT from migration text (A28). The org arm stays GONE.
-- ⚠ VOLATILE — no volatility keyword, ON PURPOSE (ac57a20; PostgREST runs
-- STABLE functions in a read-only transaction and the audit INSERT would raise
-- 25006). Re-asserted at the foot.
-- =============================================================================

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
  -- C7/A8: no org arm. Reach is the only door.
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
    -- propriety · times: A7 — the respondent sees NO times on his own case.
    -- Case-less (case_id IS NULL) → is_case_respondent is FALSE → times shown
    -- (A24·4; the stub must render for the reader list).
    case when not app.is_case_respondent(i.case_id, v_uid) then i.started_at end,
    case when not app.is_case_respondent(i.case_id, v_uid) then i.ended_at end,
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

-- GUARDS ----------------------------------------------------------------------
do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_reserved_session_items';
  -- ⚠ §7.2 — assert over LIVE CODE ONLY; a body regex matches comments too.
  if exists (select 1 from unnest(string_to_array(v_def, E'\n')) ln
              where ln ~ 'app\.is_commission_admin_of' and trim(ln) !~ '^--') then
    raise exception 'Gate-2 MINOR-1: the P0 org-arm cut was REVERTED by this re-emit';
  end if;
  if (select provolatile from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'get_reserved_session_items') <> 'v' then
    raise exception 'Gate-2 MINOR-1: get_reserved_session_items lost VOLATILE (ac57a20)';
  end if;
end $$;

-- ============================================================================
-- ADR 0078 Gate 2 · Stage C · C5 — the four-tier reserved-session projection.
-- Plan lines 378–410; A7 as corrected by A15 / A24·4 / A26. Depends on C4.
--
-- meeting_closed_session_items has NO authenticated SELECT (C4); this audited
-- SECURITY DEFINER RPC projects the tiers the caller may see (the get_case_patient
-- / get_meeting_cases pattern). New public RPC → REVOKE ALL FROM PUBLIC before GRANT.
--
-- THE FOUR TIERS (corrected, plan:396-400):
--   • stub       (reach)                         — quorum, times, position.
--   • propriety  (reach AND NOT is_case_respondent) — the process number and
--                the withdrawal record. ⭐ Gated on is_case_respondent ALONE, NOT
--                is_case_excluded: the RECUSED must still see her own withdrawal
--                (keystone 10). A26 (binding): the withdrawal NAMES are member-wide
--                only for commission_default; explicit_grants_only additionally
--                requires read_case_deliberation. Keys on cases.visibility_policy.
--   • substance  (reach AND read_case_deliberation)
--   • decision   (reach AND NOT is_case_excluded)
--
-- ⛔ THE case_id IS NULL BRANCH (plan:382-394): case-less is the only scenario C4
-- exists for. There is_case_respondent(NULL,·)/is_case_excluded(NULL,·) are FALSE
-- (so the raw case predicates would "allow everyone") and _case_caps(NULL,·) fails
-- CLOSED. Corrected: case-less → substance + decision follow the READER LIST; the
-- propriety tier is EMPTY (no number, no withdrawals — not "allow"). Case authority
-- is never out-voted by a reader list (the reader list is read ONLY when case_id IS NULL).
-- LOCAL ONLY.
-- ============================================================================

create or replace function public.get_reserved_session_items(p_meeting_id uuid)
returns table (
  id                uuid,
  closed_session_id uuid,
  case_id           uuid,
  item_position     integer,
  quorum_met        boolean,      -- stub
  started_at        timestamptz,  -- stub
  ended_at          timestamptz,  -- stub
  process_number    integer,      -- propriety (NULL for case-less or the respondent)
  withdrawals       text,         -- propriety (A26-gated names)
  substance         text,         -- substance
  decision          text          -- decision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_comm uuid := app.commission_of_meeting(p_meeting_id);
begin
  if not (app.can_reach_meeting(p_meeting_id, v_uid) or app.is_commission_admin_of(v_comm)) then
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
$$;

revoke all on function public.get_reserved_session_items(uuid) from public;
grant execute on function public.get_reserved_session_items(uuid) to authenticated;

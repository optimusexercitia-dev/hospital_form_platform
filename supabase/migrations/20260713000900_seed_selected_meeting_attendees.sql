-- ============================================================================
-- Meeting participants: seed a SUBSET of committee members as convened attendees.
-- Sibling of seed_expected_meeting_attendees (which seeds ALL members) — same
-- gate, same write shape, same idempotency; the only difference is the
-- `user_id = any(p_user_ids)` subset filter.
--
-- NON-MEMBER SAFETY: the join to commission_members means a user_id in the array
-- that is NOT a member of the meeting's commission matches no row and is silently
-- IGNORED (never inserted) — no separate validation/rejection needed.
--
-- Additive; mirrors an already-approved RPC. No new RLS shape.
-- ============================================================================

create or replace function public.seed_selected_meeting_attendees(
  p_meeting_id uuid,
  p_user_ids uuid[]
)
returns void
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission_id uuid;
begin
  perform app.assert_meetings_enabled();
  -- Same authority as the "all" sibling: staff_admin of the meeting's commission
  -- (+ admins). Raises 42501 for anyone else. Also resolves the commission id.
  v_commission_id := app.assert_meeting_staff_admin(p_meeting_id);

  perform set_config('app.in_meeting_rpc', 'on', true);
  insert into public.meeting_attendees (meeting_id, user_id, role, attendance)
  select p_meeting_id, cm.user_id, 'membro', 'convocado'
  from public.commission_members cm
  where cm.commission_id = v_commission_id
    and cm.user_id = any (coalesce(p_user_ids, '{}'::uuid[]))
  on conflict (meeting_id, user_id) where user_id is not null do nothing;
  perform set_config('app.in_meeting_rpc', 'off', true);
end;
$$;

alter function public.seed_selected_meeting_attendees(uuid, uuid[]) owner to postgres;
revoke all on function public.seed_selected_meeting_attendees(uuid, uuid[]) from public;
grant execute on function public.seed_selected_meeting_attendees(uuid, uuid[])
  to authenticated, service_role;

comment on function public.seed_selected_meeting_attendees(uuid, uuid[]) is
  'Meeting participants: seed a SUBSET of the meeting''s commission members as convened attendees (attendance=convocado, role=membro). Sibling of seed_expected_meeting_attendees (all members); same staff_admin gate + idempotency. A non-member id in p_user_ids is ignored (join to commission_members).';

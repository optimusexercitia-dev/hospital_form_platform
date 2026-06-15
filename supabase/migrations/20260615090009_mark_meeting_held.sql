-- Phase 10 / B: mark_meeting_held — the explicit agendada -> realizada transition.
--
-- The approved 5-state design is agendada -> realizada -> em_assinatura, but the
-- only RPC that left agendada was conclude_meeting (which steps straight through
-- realizada to em_assinatura as a convenience shortcut). `realizada` was thus
-- never a REACHABLE resting state — a meeting could not be marked "held" and
-- left there (e.g. to fill in discussion notes / attendance over several
-- sessions before sending the ata to signature).
--
-- This adds mark_meeting_held(p_meeting_id): staff_admin, agendada -> realizada
-- under the app.in_meeting_rpc flag (so app.guard_meeting_status permits the
-- legal transition). It mirrors distribute_meeting exactly. conclude_meeting
-- KEEPS accepting agendada OR realizada (the shortcut is unchanged), so this is
-- purely additive — no other signature changes.

create function public.mark_meeting_held(p_meeting_id uuid)
returns public.meetings
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_status text;
  v_result public.meetings;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);

  select status into v_status from public.meetings where id = p_meeting_id;
  if v_status <> 'agendada' then
    raise exception 'apenas reuniões agendadas podem ser marcadas como realizadas'
      using errcode = 'HC033';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meetings
  set status = 'realizada', updated_at = now()
  where id = p_meeting_id returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.mark_meeting_held(uuid) to authenticated, service_role;
revoke execute on function public.mark_meeting_held(uuid) from anon, public;

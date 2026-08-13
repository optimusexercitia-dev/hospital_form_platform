-- =============================================================================
-- Fix · assign_member_title must be SECURITY DEFINER (silent no-op on leaders)
-- =============================================================================
-- Bug: a staff_admin coordinator could not change another coordinator's (or their
-- own) committee title in "Gerenciar" — the change silently failed (no error, no
-- change).
--
-- Root cause: assign_member_title was SECURITY INVOKER, so its
--   update public.commission_members set title_id = ... where id = p_member_id
-- ran under the caller's RLS. The only UPDATE policy a staff_admin has on
-- commission_members is commission_members_staff_admin_update, whose USING/WITH
-- CHECK is `app.is_staff_admin_of(commission_id) AND role = 'staff'`. Assigning a
-- leadership title targets a role = 'staff_admin' row, which matches no policy →
-- the UPDATE affects 0 rows and raises no exception. The RPC returns void, the
-- server action reports { ok: true }, and the UI silently reverts.
--
-- Fix: recreate the function as SECURITY DEFINER so the update bypasses the
-- `role = 'staff'` RLS restriction. This mirrors the WS-1 guarded-DEFINER-door
-- posture (migration 20260711000000): the function is safe as DEFINER because it
-- carries its OWN authorization gate — it still refuses any caller who is not a
-- staff_admin OR commission admin of the member's commission (raise 42501). It
-- only mutates title_id and nothing else; a title is a display label, NOT a role
-- or authority grant, so DEFINER introduces no privilege escalation.
--
-- Unchanged and still enforced under DEFINER (triggers are security-context
-- independent, so they fire regardless):
--   * guard_member_title_commission_trg — A1 same-commission integrity on title_id.
--   * audit_commission_members_trg      — emits the audit row for the UPDATE.
-- auth.uid() also still resolves inside a DEFINER function: is_staff_admin_of /
-- is_commission_admin_of read the request JWT GUC via auth.uid() internally,
-- independent of security context.
--
-- Signature (arg types + void return) is UNCHANGED — the generated TS type and
-- the nullable/clear path (p_title_id NULL clears the assignment) are preserved.
-- =============================================================================

create or replace function public.assign_member_title(
  p_member_id uuid,
  p_title_id uuid default null
)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission
  from public.commission_members where id = p_member_id;
  if v_commission is null then
    raise exception 'membro inexistente' using errcode = 'check_violation';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- p_title_id NULL clears the assignment; a non-null value must belong to the
  -- member's commission (the A1 same-commission integrity trigger enforces it).
  update public.commission_members set title_id = p_title_id where id = p_member_id;
end;
$$;
alter function public.assign_member_title(uuid, uuid) owner to postgres;

-- t19 grant hygiene (project MEMORY): CREATE OR REPLACE resets the ACL to
-- PUBLIC-executable, so re-assert the intended grants. Match the appointment-RPC
-- convention (authenticated + service_role).
revoke all on function public.assign_member_title(uuid, uuid) from public;
grant execute on function public.assign_member_title(uuid, uuid) to authenticated, service_role;

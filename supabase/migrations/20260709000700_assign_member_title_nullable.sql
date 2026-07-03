-- =============================================================================
-- Phase A · A10 — assign_member_title: nullable p_title_id (clear a title)
-- =============================================================================
-- assign_member_title(p_member_id, p_title_id) both-required made the generated
-- TS type `p_title_id: string`, so the "clear a member's title" call (title_id =
-- null) could not typecheck. Recreate with `p_title_id uuid DEFAULT NULL` so the
-- generated Args type is optional/nullable — passing null CLEARS the title
-- (`update ... set title_id = null`), which is the intended clear path. Behavior
-- and authz are otherwise unchanged (staff_admin OR is_commission_admin_of).
-- =============================================================================

create or replace function public.assign_member_title(
  p_member_id uuid,
  p_title_id uuid default null
)
  returns void language plpgsql
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

-- The signature (arg types) is unchanged, so the existing REVOKE/GRANT still
-- apply; re-assert them defensively (CREATE OR REPLACE keeps ACL for the same
-- signature, but be explicit).
revoke all on function public.assign_member_title(uuid, uuid) from public;
grant execute on function public.assign_member_title(uuid, uuid) to authenticated;

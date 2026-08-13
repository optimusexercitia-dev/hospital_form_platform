-- Coordinator "add existing member" support.
--
-- Staff coordinators (staff_admin) may only add committee members that are
-- ALREADY registered on the platform — the invite-a-brand-new-user-by-email path
-- is removed from the coordinator flow. New people are registered separately by an
-- org_admin (/o/[org]/manage/usuarios → registerUser). This SECURITY DEFINER RPC
-- returns the users a coordinator may add to a commission: ACTIVE profiles
-- anchored to the commission's ORGANIZATION who are NOT already members. It is the
-- only way a staff_admin reads the org roster (they have no blanket profiles
-- SELECT under RLS), keeping access minimum-necessary and coordinator-gated in the
-- database rather than the UI.

create or replace function public.list_addable_commission_members(
  p_commission_id uuid,
  p_search text default null
)
  returns table(user_id uuid, full_name text, email text)
  language plpgsql
  stable
  security definer
  set search_path to 'public', 'pg_catalog'
as $$
declare
  v_org_id uuid;
  v_q text;
begin
  -- Coordinator-gated: a staff_admin of THIS commission, or an org_admin of its
  -- organization (mirrors the members server-action authorization). Anyone else
  -- gets an empty set — never a leak of the org roster.
  if not (
    app.is_staff_admin_of(p_commission_id)
    or app.is_org_admin_of_commission(p_commission_id)
  ) then
    return;
  end if;

  select c.organization_id
    into v_org_id
    from public.commissions c
   where c.id = p_commission_id;

  if v_org_id is null then
    return;
  end if;

  v_q := nullif(btrim(coalesce(p_search, '')), '');

  return query
  select pr.id, pr.full_name, pr.email::text
    from public.profiles pr
   where pr.home_organization_id = v_org_id
     and pr.is_active
     -- Platform (vendor) admins are walled off from tenant data — never a member.
     and not pr.is_admin
     and not exists (
       select 1
         from public.commission_members cm
        where cm.commission_id = p_commission_id
          and cm.user_id = pr.id
     )
     and (
       v_q is null
       or pr.full_name ilike '%' || v_q || '%'
       or pr.email ilike '%' || v_q || '%'
     )
   order by pr.full_name nulls last, pr.email
   limit 500;
end;
$$;

alter function public.list_addable_commission_members(uuid, text) owner to postgres;

revoke all on function public.list_addable_commission_members(uuid, text) from public;
grant execute on function public.list_addable_commission_members(uuid, text) to authenticated;
grant execute on function public.list_addable_commission_members(uuid, text) to service_role;

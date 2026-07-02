-- ============================================================================
-- Forced initial-password change — migration 20260703000000.
--
-- Adds profiles.must_change_password: set TRUE by registerUser on the flag-OFF
-- (admin-set-initial-password) onboarding path (ADR 0049), so the user is forced
-- to /primeiro-acesso to rotate the admin-known credential before using the app.
-- Cleared by updatePassword after a successful rotation. Both writes are
-- SERVICE-ROLE, so the column is locked into guard_profile_privileged_columns'
-- service-role-only set: a signed-in user must NOT be able to self-clear it via a
-- direct UPDATE (which would skip the forced change without rotating the
-- password). No new RLS shape — reads ride the existing profiles SELECT policies.
-- ============================================================================

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'TRUE forces the user to /primeiro-acesso to set a new password before using the app. Set at registration on the admin-set-initial-password path (email verification OFF; ADR 0049), cleared on a successful password rotation. Service-role-only writable (locked by guard_profile_privileged_columns) so a user cannot self-clear it and skip the forced change.';

-- ----------------------------------------------------------------------------
-- Widen guard_profile_privileged_columns: must_change_password joins the
-- SERVICE-ROLE-ONLY set (alongside the identity/lifecycle columns). Both feature
-- writes are service-role (auth.uid() IS NULL → trusted, returns early), so this
-- does NOT break the in-session clear performed by updatePassword's admin client.
-- ----------------------------------------------------------------------------
create or replace function public.guard_profile_privileged_columns()
  returns trigger language plpgsql security definer
  set search_path to 'public', 'pg_catalog' as $$
declare
  v_actor_is_admin boolean;
  v_identity_changed boolean;
  v_privilege_changed boolean;
begin
  v_privilege_changed :=
       new.is_admin is distinct from old.is_admin
    or new.is_active is distinct from old.is_active;

  v_identity_changed :=
       new.suspended_until is distinct from old.suspended_until
    or new.email_confirmed_at is distinct from old.email_confirmed_at
    or new.home_organization_id is distinct from old.home_organization_id
    or new.home_hospital_id is distinct from old.home_hospital_id
    or new.hospital_employee_id is distinct from old.hospital_employee_id
    or new.professional_category_id is distinct from old.professional_category_id
    or new.must_change_password is distinct from old.must_change_password;

  if not v_privilege_changed and not v_identity_changed then
    return new;
  end if;

  -- service_role / postgres (no auth.uid) are trusted callers — the action path.
  if auth.uid() is null then
    return new;
  end if;

  -- Identity/lifecycle columns are service-role-only: NO signed-in caller edits them.
  if v_identity_changed then
    raise exception 'identity/lifecycle columns are service-role-only'
      using errcode = 'check_violation';
  end if;

  -- is_admin/is_active: admin-only in-session (legacy behavior preserved).
  select is_admin into v_actor_is_admin
  from public.profiles where id = auth.uid();

  if not coalesce(v_actor_is_admin, false) then
    raise exception 'only an admin may change is_admin/is_active'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

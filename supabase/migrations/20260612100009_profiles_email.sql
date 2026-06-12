-- Phase 3 / M9: denormalize email onto public.profiles.
--
-- Forward-only, additive. The member/admin-user lists must show each user's
-- email, but the canonical email lives in auth.users, which the data API cannot
-- read under RLS. Rather than an RPC/view over auth.users (which would reinvent
-- the access control we already have), we copy email onto profiles so it rides
-- on the existing profiles_select_self_or_admin policy (M6): visible to exactly
-- the user themselves, co-members of a shared commission, and admins — with no
-- service-role reads on the display path.
--
-- See docs/decisions/0010-denormalize-email-on-profiles.md.

-- ---------------------------------------------------------------------------
-- Column. citext for case-insensitive matching + dedupe, consistent with
-- commissions.slug. Nullable: profiles is never rewritten/NOT-NULL'd (it is the
-- never-deleted identity table), and the partial unique index below tolerates
-- the legacy null rows while still preventing two profiles sharing an email.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column email extensions.citext;

comment on column public.profiles.email is
  'Denormalized copy of auth.users.email; kept fresh by the signup trigger and '
  'the auth-email-change sync trigger. Source of truth remains auth.users.';

-- Backfill existing rows from auth.users (seed personas + any prior signups).
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is null;

create unique index profiles_email_key
  on public.profiles (email)
  where email is not null;

-- ---------------------------------------------------------------------------
-- Signup trigger: also persist email at profile creation. CREATE OR REPLACE on
-- the existing SECURITY DEFINER function keeps its signature, owner, and grants
-- (supabase_auth_admin already has select on profiles from M2; INSERT runs as
-- the definer/owner). full_name behaviour is unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Email-change sync: when Supabase changes a user's auth email, mirror it onto
-- the profile so the denormalized copy never goes stale. Fires only when the
-- email column actually changes (UPDATE OF email + a distinct-check guard).
-- ---------------------------------------------------------------------------
create function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = new.email
    where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

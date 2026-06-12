-- Phase 1 / M2: Identity — profiles, commissions, commission_members.
--
-- RLS is enabled on every table at creation; the policies themselves live in
-- the later RLS migration (M6). Until then the tables are deny-by-default,
-- which is the intended secure baseline.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- One row per auth user. Profiles are NEVER deleted (responses and sign-offs
-- reference them); deactivation is via is_active. `is_admin` is the canonical
-- global-admin flag and is mirrored into the JWT by the access-token hook
-- below — but the DB row is always the source of truth.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  full_name text not null default '',
  is_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

comment on table public.profiles is
  'One row per auth user. Never deleted; deactivate via is_active.';

-- Auto-create a profile whenever an auth user is created. full_name is taken
-- from sign-up metadata when present. Runs as the table owner (definer) so it
-- works under the auth admin role that inserts into auth.users.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Privileged-column guard: only a global admin (or the service role / postgres,
-- e.g. seeds and the signup trigger) may change is_admin or is_active. This is
-- a trigger rather than an RLS WITH CHECK because comparing OLD vs NEW from
-- within a profiles policy would require subquerying profiles and cause
-- infinite RLS recursion. It is the authority behind the simple
-- profiles_update_self policy (M6) and the staff_admin-cannot-escalate rule.
create function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_actor_is_admin boolean;
begin
  if new.is_admin is distinct from old.is_admin
     or new.is_active is distinct from old.is_active then
    -- service_role / postgres (no auth.uid) are trusted callers.
    if auth.uid() is null then
      return new;
    end if;

    select is_admin into v_actor_is_admin
    from public.profiles where id = auth.uid();

    if not coalesce(v_actor_is_admin, false) then
      raise exception 'only an admin may change is_admin/is_active'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_profile_privileged_columns_trg
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- ---------------------------------------------------------------------------
-- commissions
-- ---------------------------------------------------------------------------
create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug extensions.citext not null unique,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint commissions_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

alter table public.commissions enable row level security;

-- ---------------------------------------------------------------------------
-- commission_members
-- ---------------------------------------------------------------------------
-- A user's role is per commission; the same user may be staff_admin in one
-- commission and staff in another. Global admin lives on profiles.is_admin, not
-- here.
create table public.commission_members (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  role text not null check (role in ('staff', 'staff_admin')),
  created_at timestamptz not null default now(),
  unique (commission_id, user_id)
);

alter table public.commission_members enable row level security;

create index commission_members_user_idx on public.commission_members (user_id);
create index commission_members_commission_idx on public.commission_members (commission_id);

-- ---------------------------------------------------------------------------
-- Custom access token hook — exposes is_admin as a JWT claim.
-- ---------------------------------------------------------------------------
-- See docs/decisions/0002-admin-claim-access-token-hook.md. The hook reads
-- profiles.is_admin live at token-issue time, so changing a user's admin status
-- takes effect on their next token refresh without any app_metadata write. RLS
-- helpers read this claim with a DB fallback, so correctness never depends on
-- the hook being configured.
create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  claims jsonb;
  v_is_admin boolean;
begin
  select is_admin into v_is_admin
  from public.profiles
  where id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{is_admin}', to_jsonb(coalesce(v_is_admin, false)));

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- GoTrue runs this hook as supabase_auth_admin. Grant exactly what it needs and
-- nothing to the data-API roles.
revoke all on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
grant select on public.profiles to supabase_auth_admin;

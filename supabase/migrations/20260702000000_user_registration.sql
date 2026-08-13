-- ============================================================================
-- User Registration & Identity Management
-- ============================================================================
-- Additive, forward-only. On top of the single baseline 20260620000000 (and the
-- 20260701000000 ad-hoc-narratives increment). To be re-squashed into the
-- baseline at phase completion; do NOT edit prior migrations.
--
-- Delivers (approved plan + lead rulings):
--   * profiles: home_organization_id (tenant anchor; nullable + CHECK, vendor
--     stays org-less — R1), home_hospital_id, hospital_employee_id,
--     professional_category_id, email_confirmed_at (denormalized), suspended_until.
--   * professional_categories (managed vocabulary) + seed.
--   * professional_credentials (1 user -> N).
--   * app.is_active(uid) folded into every membership SD-helper (NOT into
--     app.is_admin* — R3): the platform-wide deactivation/suspension enforcement.
--   * handle_new_user reads home_organization_id + email_confirmed_at from the
--     invite metadata (service-role-set-once; NOT an authz input).
--   * sync_profile_email_confirmed trigger keeps profiles.email_confirmed_at fresh.
--   * guard_profile_privileged_columns widened to lock ALL system/identity columns
--     against a self-update (R2 widened).
--   * RLS: profiles SELECT org-anchor path; professional_credentials;
--     professional_categories.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. professional_categories (managed vocabulary; mirrors pqs_event_types).
-- ----------------------------------------------------------------------------
create table if not exists public.professional_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  label_pt text not null,
  -- Council/registry mapping when the category has one (CRM/COREN/CRF/...).
  issuing_authority text,
  is_active boolean not null default true,
  position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_categories_key_key unique (key),
  constraint professional_categories_key_not_blank check (btrim(key) <> ''),
  constraint professional_categories_label_not_blank check (btrim(label_pt) <> '')
);

alter table public.professional_categories owner to postgres;

comment on table public.professional_categories is
  'Managed professional-category vocabulary (physician/nurse/...). Non-PHI; any-authenticated READ, platform_admin CRUD. FK target of profiles.professional_category_id.';

alter table public.professional_categories enable row level security;

create policy "professional_categories_select"
  on public.professional_categories
  for select to authenticated
  using (true);

create policy "professional_categories_admin_write"
  on public.professional_categories
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

grant all on table public.professional_categories to authenticated;
grant all on table public.professional_categories to service_role;

-- ----------------------------------------------------------------------------
-- 2. profiles: new identity/lifecycle columns.
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists home_organization_id uuid,
  add column if not exists home_hospital_id uuid,
  add column if not exists hospital_employee_id text,
  add column if not exists professional_category_id uuid,
  add column if not exists email_confirmed_at timestamptz,
  add column if not exists suspended_until timestamptz;

alter table public.profiles
  add constraint profiles_home_organization_id_fkey
    foreign key (home_organization_id) references public.organizations(id) on delete restrict,
  add constraint profiles_home_hospital_id_fkey
    foreign key (home_hospital_id) references public.hospitals(id) on delete set null,
  add constraint profiles_professional_category_id_fkey
    foreign key (professional_category_id) references public.professional_categories(id) on delete set null;

comment on column public.profiles.home_organization_id is
  'Owning tenant/org anchor for a tenant user. NULLABLE by design: the platform_admin (vendor) account is legitimately org-less. Set service-role-once at invite time (handle_new_user reads it from the invite metadata) — NOT an authorization input; authz flows through memberships + RLS.';
comment on column public.profiles.home_hospital_id is
  'Descriptive HR unit only — hospital is NOT an access boundary here. Nullable.';
comment on column public.profiles.hospital_employee_id is 'Matricula (employee id) — descriptive.';
comment on column public.profiles.email_confirmed_at is
  'Denormalized copy of auth.users.email_confirmed_at; kept fresh by sync_profile_email_confirmed + set on signup by handle_new_user. Drives the derived "pending" status. Source of truth remains auth.users.';
comment on column public.profiles.suspended_until is
  'Non-null + in the future => the user is currently suspended (temporary, auto-reinstating). Enforced by app.is_active().';

-- Every TENANT (non-admin) user must be org-anchored; the vendor (is_admin) stays
-- org-less (R1). Enforced by a DEFERRED CONSTRAINT TRIGGER, not a table CHECK, so
-- it fires at COMMIT — after a multi-step creation flow (invite -> profile ->
-- membership, or a test harness that inserts the user row then anchors it) has
-- had a chance to set the anchor. A plain CHECK would fire on the intermediate
-- trigger-INSERT (home_organization_id still NULL) and reject every non-admin
-- signup. The invariant is identical; only the enforcement point moves to commit.
create or replace function public.assert_profile_tenant_has_org()
  returns trigger language plpgsql
  set search_path to 'public', 'pg_catalog' as $$
begin
  if new.home_organization_id is null and not new.is_admin then
    raise exception 'a non-admin profile must have home_organization_id (tenant anchor)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
alter function public.assert_profile_tenant_has_org() owner to postgres;

revoke all on function public.assert_profile_tenant_has_org() from public;
grant all on function public.assert_profile_tenant_has_org() to authenticated;
grant all on function public.assert_profile_tenant_has_org() to service_role;

drop trigger if exists profiles_tenant_has_org_trg on public.profiles;
create constraint trigger profiles_tenant_has_org_trg
  after insert or update of home_organization_id, is_admin on public.profiles
  deferrable initially deferred
  for each row execute function public.assert_profile_tenant_has_org();

-- ----------------------------------------------------------------------------
-- 3. professional_credentials (1 user -> N; optional).
-- ----------------------------------------------------------------------------
create table if not exists public.professional_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  issuing_country text not null,
  issuing_state text not null,
  issuing_authority text not null,
  registration_number text not null,
  -- Set when an admin marks the credential verified; CLEARED on any edit (tamper-visible).
  verified_at timestamptz,
  expires_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_credentials_unique
    unique (issuing_country, issuing_state, issuing_authority, registration_number)
);

alter table public.professional_credentials owner to postgres;

comment on table public.professional_credentials is
  'Professional council registrations (CRM/COREN/CRF/...), 1 user -> N. Non-PHI. SELECT self / org_admin-of-home-org / platform_admin; writes via the service-role action path only (no write policy).';

create index if not exists professional_credentials_user_id_idx
  on public.professional_credentials (user_id);

alter table public.professional_credentials enable row level security;

-- SELECT: self, org_admin of the credential owner's home org, or platform_admin.
create policy "professional_credentials_select"
  on public.professional_credentials
  for select to authenticated
  using (
    user_id = auth.uid()
    or app.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = professional_credentials.user_id
        and p.home_organization_id is not null
        and app.is_org_admin_of(p.home_organization_id)
    )
  );

-- No INSERT/UPDATE/DELETE policy: all writes go through the service-role action
-- path (createAdminClient), which bypasses RLS. The action is the authority.

grant all on table public.professional_credentials to authenticated;
grant all on table public.professional_credentials to service_role;

-- ----------------------------------------------------------------------------
-- 4. app.is_active(uid) — the deactivation/suspension predicate.
-- ----------------------------------------------------------------------------
create or replace function app.is_active(p_user_id uuid default auth.uid())
  returns boolean
  language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
  as $$
  select coalesce(
    (
      select is_active
         and (suspended_until is null or now() >= suspended_until)
      from public.profiles
      where id = p_user_id
    ),
    false  -- absent profile / null uid => not active (fail closed).
  );
$$;

alter function app.is_active(uuid) owner to postgres;
comment on function app.is_active(uuid) is
  'True iff the user is active AND not currently suspended. Folded into every membership SD-helper so deactivation/suspension enforces platform-wide via RLS. Deliberately NOT folded into app.is_admin* (vendor lifecycle is out of scope — R3).';

revoke all on function app.is_active(uuid) from public;
grant execute on function app.is_active(uuid) to authenticated;
grant execute on function app.is_active(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 5. Fold app.is_active() into the membership SD-helpers.
--    Each current-user helper now short-circuits on inactivity; the *_for
--    variants gate the passed user. Pattern: `app.is_active(<uid>) and <old-body>`.
--    NOT modified: app.is_admin / app.is_admin_for (R3).
--    Composite predicates (can_write_interview, can_read_event, ...) build on
--    these helpers and inherit the check transitively — not re-checked.
-- ----------------------------------------------------------------------------

create or replace function app.is_member_of(p_commission_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(auth.uid()) and exists (
    select 1 from public.commission_members
    where commission_id = p_commission_id and user_id = auth.uid()
  );
$$;
alter function app.is_member_of(uuid) owner to postgres;

create or replace function app.is_member_of_for(p_commission_id uuid, p_user_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id) and exists (
    select 1 from public.commission_members
    where commission_id = p_commission_id and user_id = p_user_id
  );
$$;
alter function app.is_member_of_for(uuid, uuid) owner to postgres;

create or replace function app.is_staff_admin_of(p_commission_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(auth.uid()) and exists (
    select 1 from public.commission_members
    where commission_id = p_commission_id
      and user_id = auth.uid()
      and role = 'staff_admin'
  );
$$;
alter function app.is_staff_admin_of(uuid) owner to postgres;

create or replace function app.is_staff_admin_of_for(p_commission_id uuid, p_user_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id) and exists (
    select 1 from public.commission_members
    where commission_id = p_commission_id
      and user_id = p_user_id
      and role = 'staff_admin'
  );
$$;
alter function app.is_staff_admin_of_for(uuid, uuid) owner to postgres;

create or replace function app.is_org_admin_of(p_org_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(auth.uid()) and exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and user_id = auth.uid()
      and role = 'org_admin'
  );
$$;
alter function app.is_org_admin_of(uuid) owner to postgres;

create or replace function app.is_org_admin_of_for(p_org_id uuid, p_user_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id) and exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and user_id = p_user_id
      and role = 'org_admin'
  );
$$;
alter function app.is_org_admin_of_for(uuid, uuid) owner to postgres;

create or replace function app.is_org_admin_of_commission(p_commission_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(auth.uid()) and exists (
    select 1
    from public.commissions c
    join public.organization_members om on om.organization_id = c.organization_id
    where c.id = p_commission_id
      and om.user_id = auth.uid()
      and om.role = 'org_admin'
  );
$$;
alter function app.is_org_admin_of_commission(uuid) owner to postgres;

create or replace function app.is_org_admin_of_commission_for(p_commission_id uuid, p_user_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id) and exists (
    select 1
    from public.commissions c
    join public.organization_members om on om.organization_id = c.organization_id
    where c.id = p_commission_id
      and om.user_id = p_user_id
      and om.role = 'org_admin'
  );
$$;
alter function app.is_org_admin_of_commission_for(uuid, uuid) owner to postgres;

create or replace function app.is_org_member(p_org_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(auth.uid()) and exists (
    select 1
    from public.commissions c
    join public.commission_members cm on cm.commission_id = c.id
    where c.organization_id = p_org_id
      and cm.user_id = auth.uid()
  );
$$;
alter function app.is_org_member(uuid) owner to postgres;

-- PQS/NSP roster helpers. is_pqs_member_of / is_pqs_writer_of delegate to
-- is_pqs_member_of_for; is_nsp_coordinator_of delegates to is_nsp_coordinator_of_for.
-- Folding the *_for + *_any leaves gets the whole PQS/NSP surface.
create or replace function app.is_pqs_member_of_for(p_org_id uuid, p_user_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id) and exists (
    select 1 from public.pqs_members
    where organization_id = p_org_id and user_id = p_user_id
  );
$$;
alter function app.is_pqs_member_of_for(uuid, uuid) owner to postgres;

create or replace function app.is_pqs_member_of_any(p_user_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id)
     and exists (select 1 from public.pqs_members where user_id = p_user_id);
$$;
alter function app.is_pqs_member_of_any(uuid) owner to postgres;

create or replace function app.is_nsp_coordinator_of_for(p_org_id uuid, p_user_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id) and exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and user_id = p_user_id
      and role = 'nsp_coordinator'
  );
$$;
alter function app.is_nsp_coordinator_of_for(uuid, uuid) owner to postgres;

-- ----------------------------------------------------------------------------
-- 6. handle_new_user: also set home_organization_id + email_confirmed_at.
--    home_organization_id comes from the invite metadata, which is set
--    SERVICE-ROLE-ONCE at invite time and is NOT an authorization input — authz
--    flows through memberships + RLS. (Skill: raw_user_meta_data is user-editable
--    and must never drive an authz decision; here it only seeds a descriptive
--    anchor at creation, and guard_profile_privileged_columns locks it after.)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer
  set search_path to 'public', 'pg_catalog' as $$
begin
  insert into public.profiles (id, full_name, email, home_organization_id, is_admin, email_confirmed_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    -- Descriptive anchor only (see fn comment). Null-safe cast: a malformed value
    -- simply yields NULL, and the profiles_tenant_has_org CHECK then rejects a
    -- non-admin insert — which never happens on the real invite path (the action
    -- always supplies a valid org).
    nullif(new.raw_user_meta_data ->> 'home_organization_id', '')::uuid,
    -- Provisioning-only admin bootstrap. Read from app_metadata (raw_app_meta_data),
    -- which is SERVICE-ROLE-ONLY and NOT user-editable (the skill: never trust
    -- user_metadata for authz; app_metadata is the safe channel). This lets a
    -- provisioning path mint the org-less vendor platform_admin at creation so the
    -- profiles_tenant_has_org CHECK holds immediately. The authoritative is_admin
    -- claim still derives from the profiles column via custom_access_token_hook;
    -- this only seeds that column. Defaults false for every ordinary invite.
    coalesce((new.raw_app_meta_data ->> 'bootstrap_admin')::boolean, false),
    new.email_confirmed_at
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
alter function public.handle_new_user() owner to postgres;

-- ----------------------------------------------------------------------------
-- 7. sync_profile_email_confirmed: denormalize auth.users.email_confirmed_at.
--    Mirrors sync_profile_email. Backs the AFTER UPDATE OF email_confirmed_at
--    trigger on auth.users (created below).
-- ----------------------------------------------------------------------------
create or replace function public.sync_profile_email_confirmed()
  returns trigger language plpgsql security definer
  set search_path to 'public', 'pg_catalog' as $$
begin
  if new.email_confirmed_at is distinct from old.email_confirmed_at then
    update public.profiles
    set email_confirmed_at = new.email_confirmed_at
    where id = new.id;
  end if;
  return new;
end;
$$;
alter function public.sync_profile_email_confirmed() owner to postgres;

revoke all on function public.sync_profile_email_confirmed() from public;
grant all on function public.sync_profile_email_confirmed() to authenticated;
grant all on function public.sync_profile_email_confirmed() to service_role;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.sync_profile_email_confirmed();

-- ----------------------------------------------------------------------------
-- 8. guard_profile_privileged_columns: widen the self-mutation lock (R2 widened).
--    Rule: a signed-in caller (auth.uid() not null) may change is_admin/is_active
--    only if they are an admin (legacy behavior). The identity/lifecycle columns
--    (suspended_until, email_confirmed_at, home_organization_id, home_hospital_id,
--    hospital_employee_id, professional_category_id) are SERVICE-ROLE-ONLY: no
--    signed-in caller may change them, admin or not. The auth.uid() IS NULL escape
--    keeps the service-role action path writing everything.
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
    or new.professional_category_id is distinct from old.professional_category_id;

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
alter function public.guard_profile_privileged_columns() owner to postgres;

-- ----------------------------------------------------------------------------
-- 9. profiles SELECT: add the org-anchor directory path (C).
--    org_admin-ONLY (nsp_coordinator does NOT get the whole-org directory).
--    Recreate profiles_select_self_or_admin with the added OR term.
-- ----------------------------------------------------------------------------
-- Every branch that exposes ANOTHER user's profile row requires the CALLER to be
-- active (B1). The org-admin branches enforce this transitively — app.is_org_admin_of
-- folds app.is_active(auth.uid()). The peer self-join is a RAW commission_members
-- join with no helper, so it is guarded EXPLICITLY: a deactivated/suspended user
-- with a live JWT must not read peers' rows (incl. the new identity columns) via
-- direct PostgREST. The SELF branch (id = auth.uid()) stays OPEN — a deactivated
-- user reading their OWN row is fine (and needed for /conta-inativa).
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles
  for select to authenticated
  using (
    (id = auth.uid())
    -- org_admin of the user's HOME org: sees every user anchored to the org,
    -- including a freshly-registered pending user with no committee yet.
    -- (app.is_org_admin_of already gates caller activity via the is_active fold.)
    or (
      profiles.home_organization_id is not null
      and app.is_org_admin_of(profiles.home_organization_id)
    )
    -- org_admin via a shared-commission membership (pre-existing path; folded).
    or (exists (
      select 1
      from public.commission_members cm
      join public.commissions c on c.id = cm.commission_id
      where cm.user_id = profiles.id
        and app.is_org_admin_of(c.organization_id)
    ))
    -- shared-commission peer visibility (pre-existing path). RAW join → guard the
    -- caller's activity explicitly (B1) so an inactive peer is denied.
    or (
      app.is_active(auth.uid())
      and exists (
        select 1
        from public.commission_members me
        join public.commission_members them on them.commission_id = me.commission_id
        where me.user_id = auth.uid()
          and them.user_id = profiles.id
      )
    )
  );

-- profiles_admin_select carries the org-admin term too, for parity with the
-- pre-existing shared-commission path; add the home-org anchor there as well.
-- Every non-admin branch that exposes ANOTHER user's row goes through
-- app.is_org_admin_of(...), which folds app.is_active(auth.uid()) — so an inactive
-- caller is already denied on both org-admin branches (B1). app.is_admin() is the
-- vendor path (deliberately NOT is_active-gated — the vendor must not be lockable;
-- ADR 0048). No raw peer join here.
drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select"
  on public.profiles
  for select to authenticated
  using (
    app.is_admin()
    or (
      profiles.home_organization_id is not null
      and app.is_org_admin_of(profiles.home_organization_id)
    )
    or (exists (
      select 1
      from public.commission_members cm
      join public.commissions c on c.id = cm.commission_id
      where cm.user_id = profiles.id
        and app.is_org_admin_of(c.organization_id)
    ))
  );

-- ----------------------------------------------------------------------------
-- 10. Seed professional_categories (deterministic ids for pgTAP/E2E fixtures).
-- ----------------------------------------------------------------------------
insert into public.professional_categories (id, key, label_pt, issuing_authority, position) values
  ('d1000000-0000-0000-0000-000000000001', 'physician',      'Médico(a)',          'CRM',     1),
  ('d1000000-0000-0000-0000-000000000002', 'nurse',          'Enfermeiro(a)',      'COREN',   2),
  ('d1000000-0000-0000-0000-000000000003', 'pharmacist',     'Farmacêutico(a)',    'CRF',     3),
  ('d1000000-0000-0000-0000-000000000004', 'physiotherapist','Fisioterapeuta',     'CREFITO', 4),
  ('d1000000-0000-0000-0000-000000000005', 'administrator',  'Administrador(a)',   null,      5),
  ('d1000000-0000-0000-0000-000000000006', 'other',          'Outro',              null,      6)
on conflict (key) do nothing;

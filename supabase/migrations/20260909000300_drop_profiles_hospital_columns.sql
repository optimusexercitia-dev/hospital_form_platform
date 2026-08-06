-- AFF W1 / T1.3 — drop `profiles.home_hospital_id` + `profiles.hospital_employee_id`.
--
-- ADR 0097 D3. This is a REFACTOR, not a column drop: matrícula moves onto the
-- affiliation row (it is a property of the EMPLOYMENT, not of the person), and the
-- hospital fact becomes `public.hospital_affiliations` (20260909000100).
--
-- ⚠ `home_organization_id` is NOT touched — it is the tenancy anchor (ADR 0048 D6,
-- `profiles_tenant_has_org_trg`) and the filter of every org-scoped read.
--
-- THE TWO RUNTIME LANDMINES this migration defuses (external audit MEDIUM-1; neither
-- is visible to lint, tsc, or unit tests):
--
--  1. **`guard_profile_privileged_columns` compares both doomed columns.** plpgsql is
--     LATE-BOUND: `drop column` SUCCEEDS, and then **every later `profiles` UPDATE
--     fails 42703 at runtime**. The function is therefore rewritten in this same
--     migration, and the body below was regenerated from the LIVE
--     `pg_get_functiondef` (never from migration text — migration bodies are stale by
--     design here, ADR 0078 A28). `create or replace` — not `drop`+`create`, which is
--     a privilege reset (recorded lesson).
--  2. **Both `profiles` SELECT policies carry a `home_hospital_id` leg.** A policy is
--     a dependency of the column: the drop would fail (or cascade the policy away)
--     unless the legs go first. `alter policy` is used rather than drop+create so the
--     policy's name, roles, command and `with_check` cannot be silently lost.
--
-- ⚠ SCOPE — this migration REMOVES a leg and adds NOTHING. The affiliation +
-- membership legs that REPLACE it are W2 / T2.3, deliberately. Consequence, measured
-- and reported rather than discovered later: between this migration and T2.3 a
-- `hospital_admin` cannot read the profile of a person who is affiliated to their
-- hospital but sits on none of its committees (e.g. a freshly-registered person).
-- pgTAP `301` §5 PINS that deny, and W2/T2.3 must INVERT that assertion — it is the
-- executable form of this warning, not a property worth keeping.
--
-- The `home_hospital_id` leg is called "inert" in ADR 0097 finding 2 on the strength
-- of the SEED (populated 1/30). That measures the seed, not the flow: `registerUser`
-- set the column on every hospital-admin registration, so the leg was live on the
-- product path. Recorded here so the next reader does not inherit the wrong premise.

-- ---------------------------------------------------------------------------
-- 1. Drop the `home_hospital_id` leg from both SELECT policies (verbatim otherwise —
--    diffed leg-by-leg against `pg_policies` before and after).
-- ---------------------------------------------------------------------------
alter policy profiles_admin_select on public.profiles
  using (
    app.is_admin()
    or (home_organization_id is not null and app.is_org_admin_of(home_organization_id))
    or exists (
      select 1
      from public.memberships cm
      join public.commissions c on c.id = cm.commission_id
      where cm.commission_id is not null
        and cm.principal_id = profiles.id
        and app.is_commission_admin_of(c.id)
    )
  );

alter policy profiles_select_self_or_admin on public.profiles
  using (
    id = (select auth.uid())
    or (home_organization_id is not null and app.is_org_admin_of(home_organization_id))
    or exists (
      select 1
      from public.memberships cm
      join public.commissions c on c.id = cm.commission_id
      where cm.commission_id is not null
        and cm.principal_id = profiles.id
        and app.is_commission_admin_of(c.id)
    )
    or (
      app.is_active((select auth.uid()))
      and exists (
        select 1
        from public.memberships me
        join public.memberships them on them.commission_id = me.commission_id
        where me.commission_id is not null
          and me.principal_id = (select auth.uid())
          and them.principal_id = profiles.id
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Rewrite the privileged-column guard: drop the two doomed comparisons, add `cpf`
--    to the identity set (ADR 0097 D7/D14 — binding; `cpf` is an identity key and
--    person-level fields are out of a hospital admin's reach).
--
--    ⚠ The `cpf` arm is BELT-AND-BRACES, not the primary control: 20260909000200
--    already withholds `update (cpf)` from `authenticated`, so a signed-in caller is
--    refused with 42501 before this trigger ever runs. It is here because D7/D14 make
--    it binding, and because the grant and the trigger are two independently
--    revertable things.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
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
    or new.cpf is distinct from old.cpf
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
$function$;

-- ---------------------------------------------------------------------------
-- 3. The drop itself. `profiles_home_hospital_id_fkey` goes with the column — which
--    is also why `src/lib/queries/org.ts`'s embed string
--    `profiles!profiles_home_hospital_id_fkey(count)` had to become an affiliation
--    count in the same commit: a PostgREST `.select()` is a STRING, so it typechecks
--    after the drop and fails only at runtime (the recorded TV mechanism).
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop column home_hospital_id,
  drop column hospital_employee_id;

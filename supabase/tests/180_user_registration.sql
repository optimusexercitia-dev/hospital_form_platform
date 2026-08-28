-- User Registration & Identity Management — migration 20260702000000.
--
-- Runs against the PERSISTED SEED (not test_helpers.bootstrap) so it can use the
-- deterministic lifecycle personas d1..d4 (pending/active/suspended/deactivated),
-- all anchored to org-a (0c…00a), org_admin = orgadmin.a (…b1). Proves:
--   * new profiles columns + FKs + the deferred tenant-anchor trigger;
--   * professional_categories / professional_credentials shape + uniqueness;
--   * the email_confirmed_at denorm trigger;
--   * app.is_active() truth table + its fold into the membership SD-helpers
--     (deactivated + currently-suspended are denied; a lapsed suspension is not);
--   * profiles SELECT org-anchor path (a pending, committee-less user is visible
--     to its org_admin) and its org_admin-ONLY scope (a bare member, a foreign
--     org_admin, AND an nsp_coordinator are denied — M1);
--   * profiles SELECT is_active-gated for peers (B1): a suspended/deactivated
--     caller cannot read a commission peer's row; an active peer still can;
--   * professional_credentials RLS (self / org_admin / foreign);
--   * the widened guard_profile_privileged_columns self-mutation lock;
--   * app.is_active is REVOKEd from PUBLIC.
--
-- NOTE (M2): there is NO SQL 4-way status derivation to test. The DB's concern is
-- the access boolean app.is_active() (exercised below); the 4-way DISPLAY status
-- (deriveUserStatus) is TS-only and asserted in Vitest against the shared fixture.
-- The two intentionally differ on the email_confirmed_at dimension.

begin;
select plan(40);

-- Seed persona ids (see supabase/seed.sql).
create temp table ids on commit drop as select
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  '0c000000-0000-0000-0000-00000000000b'::uuid as org_b,
  'a0000000-0000-0000-0000-0000000000a1'::uuid as comm_ccih,
  '00000000-0000-0000-0000-0000000000b1'::uuid as orgadmin_a,
  '00000000-0000-0000-0000-0000000000b2'::uuid as orgadmin_b,
  '00000000-0000-0000-0000-0000000000c1'::uuid as nspcoord_a,       -- nsp_coordinator of org-a (NOT org_admin)
  '00000000-0000-0000-0000-000000000003'::uuid as staff_ccih,       -- plain staff of CCIH
  '00000000-0000-0000-0000-000000000004'::uuid as staff2_ccih,      -- another plain staff of CCIH (peer)
  '00000000-0000-0000-0000-0000000000d1'::uuid as u_pending,
  '00000000-0000-0000-0000-0000000000d2'::uuid as u_active,
  '00000000-0000-0000-0000-0000000000d3'::uuid as u_suspended,
  '00000000-0000-0000-0000-0000000000d4'::uuid as u_deactivated;
grant select on ids to authenticated;

-- ---------------------------------------------------------------------------
-- Schema shape.
-- ---------------------------------------------------------------------------
select hasnt_column('public', 'profiles', 'home_organization_id', 'profiles.home_organization_id is GONE (AE2.4 / ADR 0164 — the tenant anchor is a non-voided organization_affiliations row; re-introducing the column reds HERE, and this is the only guard against that anywhere)');
-- AFF W1 (ADR 0097 D3): both hospital columns were DROPPED by 20260909000300 —
-- "works at this hospital" is a hospital_affiliations row, and matricula is a property
-- of the employment, not of the person. Asserted as absences (same count) so a
-- re-introduction reds here rather than quietly restoring the split identity.
select hasnt_column('public', 'profiles', 'home_hospital_id', 'profiles.home_hospital_id is GONE (moved to hospital_affiliations)');
select hasnt_column('public', 'profiles', 'hospital_employee_id', 'profiles.hospital_employee_id is GONE (matricula is per employment)');
select has_column('public', 'profiles', 'professional_category_id', 'profiles.professional_category_id exists');
select has_column('public', 'profiles', 'email_confirmed_at', 'profiles.email_confirmed_at exists');
select has_column('public', 'profiles', 'suspended_until', 'profiles.suspended_until exists');
-- Forced initial-password change (migration 20260703000000; ADR 0049).
select has_column('public', 'profiles', 'must_change_password', 'profiles.must_change_password exists');
select col_default_is('public', 'profiles', 'must_change_password', 'false', 'profiles.must_change_password defaults false');
select has_table('public', 'professional_categories', 'professional_categories table exists');
select has_table('public', 'professional_credentials', 'professional_credentials table exists');

-- ---------------------------------------------------------------------------
-- Deferred tenant-anchor trigger. profiles.id FKs auth.users, so create the auth
-- user (handle_new_user makes the profile). We isolate each anchor case in its
-- OWN savepoint and force the DEFERRED constraint with SET CONSTRAINTS IMMEDIATE
-- so exactly that row's violation is catchable without leaking pending checks
-- into later assertions.
-- ---------------------------------------------------------------------------
-- The anchor invariant is enforced by a DEFERRED constraint trigger, which only
-- fires at the outer COMMIT (pgTAP always rolls back), so we assert it via the
-- catalog + the raw trigger-function logic + the SEED's living proof, rather than
-- fight deferred semantics with SET CONSTRAINTS mid-transaction.

-- (a) ⚠ REWRITTEN 2026-08-28 (AE2.4 increment 1, migration 20261003005600, ADR 0164).
-- This asserted `profiles_tenant_has_org_trg` on `public.profiles`. THAT TRIGGER IS GONE:
-- containment could not be re-predicated at CREATION time (the profile is written in
-- GoTrue's `auth.users` transaction and the affiliation in a separate PostgREST one, so
-- DEFERRABLE defers only to its OWN commit), and it moved to the only post-creation event
-- that can destroy it. The assertion follows the invariant instead of being deleted.
select is(
  (select tgdeferrable and tginitdeferred
   from pg_trigger
   where tgname = 'org_affiliation_tenant_containment_trg'
     and tgrelid = 'public.organization_affiliations'::regclass),
  true,
  'the tenant-anchor invariant is a DEFERRABLE INITIALLY DEFERRED constraint trigger on organization_affiliations void/delete (ADR 0164); behaviour is keystoned by 393 § 2'
);

-- (b) ⛔ DELETED 2026-08-28 (AE2.4). Two cells counted org-less profiles via
-- `home_organization_id`; the column is gone, so they die with it. They were already
-- statements about the SEED rather than about an enforced invariant — the enforced
-- invariant is "≥ 1 NON-VOIDED organization affiliation", carried by `393 § 1.2` (zero
-- tenant orphans in the seed) and by `app.tenant_orphan_profiles()`. ⚠ The org-less
-- VENDOR (is_admin) persona had no other cell asserting its existence; see the AE2.4
-- report.

-- ⭐ (b') THE VENDOR WITNESS, RESTORED BY THE LEAD over the substrate that replaced the
-- column. The two deleted cells were about the SEED, but one of them was also the ONLY
-- direct assertion that the org-less platform_admin persona exists at all.
--
-- ⚠ IT IS NOT COVERED INCIDENTALLY, AND THAT WAS CHECKED RATHER THAN ASSUMED: the only
--    other cell naming `…b0` uses it as an ACTOR (`328 § …`), so it would red if the
--    persona vanished -- but incidentally, and an incidental guard is not coverage of the
--    property it happens to protect.
--
-- ⛔ BOTH HALVES IN ONE STRING, deliberately. `exists` alone would go green if the vendor
--    acquired an affiliation (the noun rule says a platform_admin is not a tenant
--    person); `has no affiliation` alone is satisfied by the persona not existing at all.
--    Neither half is the claim; the pair is.
select is(
  (select coalesce((select 'exists=' || p.is_admin::text from public.profiles p
                     where p.email = 'platform@test.local'), 'MISSING')
          || '|affiliations=' ||
          (select count(*)::text from public.organization_affiliations oa
            join public.profiles p2 on p2.id = oa.principal_id
           where p2.email = 'platform@test.local' and oa.voided_at is null)),
  'exists=true|affiliations=0',
  '1.9 ⭐ the org-less VENDOR persona exists, is `is_admin`, and holds ZERO non-voided organization affiliations -- the noun rule (ADR 0078 A35) in the seed, and the shape `app.tenant_orphan_profiles()` must NOT flag. Restores the witness the dropped-column cells carried');

-- professional_credentials uniqueness (4-tuple).
select throws_ok(
  $$ insert into public.professional_credentials
       (user_id, issuing_country, issuing_state, issuing_authority, registration_number)
     values ('00000000-0000-0000-0000-0000000000d2', 'BR', 'SP', 'CRM', '123456-SP') $$,
  '23505',
  null,
  'duplicate (country,state,authority,number) credential is rejected'
);

-- professional_categories unique key.
select throws_ok(
  $$ insert into public.professional_categories (key, label_pt) values ('physician', 'Dup') $$,
  '23505',
  null,
  'duplicate professional_categories.key is rejected'
);

-- ---------------------------------------------------------------------------
-- email_confirmed_at denorm trigger: confirming the auth user propagates.
-- (d1 is pending — its profiles.email_confirmed_at is NULL.)
-- ---------------------------------------------------------------------------
select is(
  (select email_confirmed_at from public.profiles where id = (select u_pending from ids)),
  null,
  'pending persona starts with NULL profiles.email_confirmed_at'
);
update auth.users set email_confirmed_at = '2026-07-01T00:00:00Z'
  where id = (select u_pending from ids);
select isnt(
  (select email_confirmed_at from public.profiles where id = (select u_pending from ids)),
  null,
  'confirming auth.users.email_confirmed_at syncs to profiles (denorm trigger)'
);

-- ---------------------------------------------------------------------------
-- app.is_active() truth table.
-- ---------------------------------------------------------------------------
select ok(app.is_active((select u_active from ids)),        'is_active: active persona => true');
select ok(app.is_active((select u_pending from ids)),       'is_active: pending persona (confirmed above) => true');
select ok(not app.is_active((select u_suspended from ids)), 'is_active: currently-suspended => false');
select ok(not app.is_active((select u_deactivated from ids)),'is_active: deactivated => false');
select ok(not app.is_active('00000000-0000-0000-0000-0000009999ff'), 'is_active: absent profile => false');

-- ---------------------------------------------------------------------------
-- Fold into the membership helpers (both d2 active + d3 suspended are CCIH staff).
-- ---------------------------------------------------------------------------
select ok(
  app.is_member_of_for((select comm_ccih from ids), (select u_active from ids)),
  'fold: is_member_of_for allows an ACTIVE member'
);
select ok(
  not app.is_member_of_for((select comm_ccih from ids), (select u_suspended from ids)),
  'fold: is_member_of_for denies a SUSPENDED member'
);
-- org-admin fold: orgadmin.a is active; simulate suspending them and confirm the
-- helper denies, then the rollback restores.
select ok(app.is_org_admin_of_for((select org_a from ids), (select orgadmin_a from ids)),
  'fold: is_org_admin_of_for allows an ACTIVE org_admin');
update public.profiles set suspended_until = now() + interval '1 day'
  where id = (select orgadmin_a from ids);
select ok(not app.is_org_admin_of_for((select org_a from ids), (select orgadmin_a from ids)),
  'fold: is_org_admin_of_for denies a SUSPENDED org_admin');
update public.profiles set suspended_until = null where id = (select orgadmin_a from ids);

-- ---------------------------------------------------------------------------
-- profiles SELECT org-anchor path: an org_admin sees a PENDING, committee-less
-- user of its home org; a plain member does NOT; a foreign org_admin does NOT.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select orgadmin_a from ids), false);
set local role authenticated;
select ok(
  exists (select 1 from public.profiles where id = (select u_pending from ids)),
  'org_admin sees a pending, committee-less user anchored to its org'
);
reset role;

select test_helpers.claims_for((select staff_ccih from ids), false);
set local role authenticated;
select ok(
  not exists (select 1 from public.profiles where id = (select u_pending from ids)),
  'a plain commission member does NOT get the org directory (pending user hidden)'
);
reset role;

select test_helpers.claims_for((select orgadmin_b from ids), false);
set local role authenticated;
select ok(
  not exists (select 1 from public.profiles where id = (select u_pending from ids)),
  'a FOREIGN org_admin (org-b) does not see an org-a user'
);
reset role;

-- M1: an nsp_coordinator of org-a (NOT an org_admin) does NOT get the whole-org
-- directory via the profiles home-org SELECT path (the org-anchor path is
-- org_admin-ONLY by design).
select test_helpers.claims_for((select nspcoord_a from ids), false);
set local role authenticated;
select ok(
  not exists (select 1 from public.profiles where id = (select u_pending from ids)),
  'M1: an nsp_coordinator does NOT get the org user directory (org_admin-only path)'
);
reset role;

-- ---------------------------------------------------------------------------
-- B1: the peer-visibility branch is is_active-gated. d2 (active), d3 (suspended)
-- and staff_ccih/staff2_ccih are all CCIH members (peers). An ACTIVE caller reads
-- a peer's row; a SUSPENDED or DEACTIVATED caller does NOT (the raw peer self-join
-- now requires app.is_active(auth.uid())).
-- ---------------------------------------------------------------------------
-- Active peer: staff_ccih reads peer staff2_ccih (both active CCIH members).
select test_helpers.claims_for((select staff_ccih from ids), false);
set local role authenticated;
select ok(
  exists (select 1 from public.profiles where id = (select staff2_ccih from ids)),
  'B1: an ACTIVE member reads a commission peer''s profile row'
);
reset role;

-- FUNCTIONAL regression (the coverage gap that let the roster break slip through):
-- an ACTIVE member must see a freshly-invited PENDING co-member (email_confirmed_at
-- NULL) — visibility depends ONLY on the caller's activity + shared commission, NOT
-- on the TARGET being confirmed/active. Add d1 (pending) to CCIH, then read as the
-- active staff_ccih. (Rolled back with the txn.)
select set_config('request.jwt.claims', '', true);
insert into public.memberships (commission_id, principal_id, role)
  values ((select comm_ccih from ids), (select u_pending from ids), 'staff')
  on conflict (principal_id, role, organization_id, hospital_id, commission_id) do nothing;
select test_helpers.claims_for((select staff_ccih from ids), false);
set local role authenticated;
select ok(
  exists (select 1 from public.profiles where id = (select u_pending from ids)),
  'B1 functional: an ACTIVE member sees a PENDING co-member (target need not be confirmed)'
);
reset role;

-- Suspended caller: d3 (suspended, CCIH member) cannot read peer staff_ccih.
select test_helpers.claims_for((select u_suspended from ids), false);
set local role authenticated;
select ok(
  not exists (select 1 from public.profiles where id = (select staff_ccih from ids)),
  'B1: a SUSPENDED member cannot read a commission peer''s profile row'
);
reset role;

-- Deactivated caller: temporarily deactivate an active CCIH member (staff2_ccih)
-- and confirm it can no longer read peer staff_ccih. Rolled back with the txn.
-- Clear the JWT claims first so auth.uid() is null (the superuser/service-role
-- path that guard_profile_privileged_columns trusts for lifecycle-column writes;
-- a leftover non-admin claim from a prior claims_for would otherwise be rejected).
select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = false where id = (select staff2_ccih from ids);
select test_helpers.claims_for((select staff2_ccih from ids), false);
set local role authenticated;
select ok(
  not exists (select 1 from public.profiles where id = (select staff_ccih from ids)),
  'B1: a DEACTIVATED member cannot read a commission peer''s profile row'
);
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = true where id = (select staff2_ccih from ids);

-- ---------------------------------------------------------------------------
-- professional_credentials RLS: self reads own; org_admin reads org member's;
-- a foreign org_admin does not.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select u_active from ids), false);
set local role authenticated;
select ok(
  exists (select 1 from public.professional_credentials where user_id = (select u_active from ids)),
  'a user reads their OWN credentials'
);
reset role;

select test_helpers.claims_for((select orgadmin_a from ids), false);
set local role authenticated;
select ok(
  exists (select 1 from public.professional_credentials where user_id = (select u_active from ids)),
  'org_admin reads a home-org member''s credentials'
);
reset role;

select test_helpers.claims_for((select orgadmin_b from ids), false);
set local role authenticated;
select ok(
  not exists (select 1 from public.professional_credentials where user_id = (select u_active from ids)),
  'a FOREIGN org_admin cannot read another org''s credentials'
);
reset role;

-- ---------------------------------------------------------------------------
-- Widened self-mutation guard: a signed-in user cannot self-change a lifecycle
-- column, but may edit full_name.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select u_suspended from ids), false);
set local role authenticated;
select throws_ok(
  format($$ update public.profiles set suspended_until = null where id = %L $$, (select u_suspended from ids)),
  '23514',
  null,
  'a signed-in user cannot self-clear suspended_until'
);
select lives_ok(
  format($$ update public.profiles set full_name = 'Alterado' where id = %L $$, (select u_suspended from ids)),
  'a signed-in user may still edit their own full_name'
);
-- must_change_password is service-role-only (ADR 0049): a signed-in user must not
-- be able to self-mutate it (setting a DIFFERENT value than the seeded false, so
-- the guard's is-distinct check actually fires — the real skip-attack is a clear,
-- but the seed persona already has it false; asserting on a genuine change proves
-- the lock, and a self-clear on a truly-flagged row is the same code path).
select throws_ok(
  format($$ update public.profiles set must_change_password = true where id = %L $$, (select u_suspended from ids)),
  '23514',
  null,
  'a signed-in user cannot self-mutate must_change_password'
);
reset role;

-- ---------------------------------------------------------------------------
-- app.is_active REVOKEd from PUBLIC (no anon/PUBLIC exec).
-- ---------------------------------------------------------------------------
select ok(
  not has_function_privilege('public', 'app.is_active(uuid)', 'execute'),
  'PUBLIC has no EXECUTE on app.is_active(uuid)'
);

select * from finish();
rollback;

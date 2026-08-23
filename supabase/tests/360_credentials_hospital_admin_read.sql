-- AFF2 B2 — `professional_credentials_select` gains an affiliation leg and a membership
-- leg for hospital admins. ADR 0133 D13, as resolved by Amendment 2 (PO-ruled 2026-08-23).
-- Migration 20261003001100.
--
-- WHY THIS EXISTS. Before it, `professional_credentials` SELECT admitted self /
-- platform_admin / org_admin-of-home-org only. A hospital_admin could read a person's
-- PROFILE row and not their credential row, so the redesign's "Registro" column rendered
-- an em-dash for every hospital admin — the "empty never means no-permission" state this
-- codebase bans. Measured before the migration: `hospitaladmin.a1` reads 1 profiles row
-- for a person and 0 of their credentials.
--
-- ⛔ THE READ BOUNDARY AND THE WRITE BOUNDARY ARE DELIBERATELY DIFFERENT, and the
-- membership leg looks too wide if you forget it. ADR 0133 D1(b)/D2 bound who may
-- ADMINISTER a person (all-commission-tier, footprint inside the caller's hospitals);
-- Amendment 1 ruling 1 then aligned the widened WRITES to "the read boundary D13 already
-- draws". Nothing in D2 says a hospital-tier person's credentials are unreadable — it says
-- they cannot be administered. So the legs here MIRROR the two live `profiles` SELECT legs
-- verbatim, hospital-tier included (§3 pins that arm). Narrower would manufacture a fresh
-- instance of the very trap the widening exists to remove.
--
-- ⚠ AN ASYMMETRY THAT NOW LIVES INSIDE ONE POLICY, stated here because a reader who sees
-- the affiliation leg's filter will assume its sibling has one: the AFFILIATION leg filters
-- activity (`ended_on IS NULL`); the MEMBERSHIP leg does NOT filter `expires_at`. That is
-- not an oversight — it mirrors both live `profiles` policies, neither of which filters
-- `expires_at` anywhere. Filtering only here would make two policies silently disagree
-- about what "active" means, and the person with an expired membership still reaches the
-- directory through the `profiles` leg with a blank Registro cell (the same trap again).
-- Tracked for BOTH policies at once as FUP-AFF2-ACTIVE-MEANS-TWO-THINGS. §5.2 pins the
-- current behaviour so whichever way that follow-up lands, the change is deliberate.
--
-- ⛔ FIXTURE DISCIPLINE: every id below is FIXED and self-contained (the `0aff2002-` block),
-- never a seed persona and never `gen_random_uuid()`. Seed ids drift with the roster; a
-- random id cannot be reproduced from a failure message. Each admin persona holds EXACTLY
-- ONE membership so `test_helpers.claims_for` auto-derives its `active_role` — `app.has_role`
-- refuses a self-check whose active hat does not match, and a hatless fixture fails CLOSED,
-- which reads as a correct DENY. §0.3 asserts the hats resolved rather than trusting that.
--
-- ⛔ WHAT MAKES THE DENY ARMS NON-VACUOUS: §4.3. A DENY that returns 0 is indistinguishable
-- from a missing fixture row, an unset hat, or a typo'd id — so the same DENY persona is
-- required to SUCCEED on a subject at its own hospital. Without that control §4 proves
-- nothing at all.
--
-- ⚠ PER ADR 0097 D6's CAVEAT: the DENY arms below pin the DEFAULT STATE — the absence of a
-- leg that would have admitted these callers — NOT a tenant boundary. Do not cite §4 as
-- tenant-isolation coverage; tenant isolation for this table is not what this file measures.

begin;
select plan(21);

-- ===========================================================================
-- §0 Fixture + preconditions. Built as table owner, before any role switch.
-- ===========================================================================
insert into public.organizations (id, name, slug) values
  ('0aff2002-0000-0000-0000-00000000000a', 'AFF2 Rede Alfa', 'aff2-rede-alfa'),
  ('0aff2002-0000-0000-0000-00000000000b', 'AFF2 Rede Beta', 'aff2-rede-beta');

insert into public.hospitals (id, organization_id, name, slug) values
  ('0aff2002-0000-0000-0000-000000000011', '0aff2002-0000-0000-0000-00000000000a', 'AFF2 Hospital Um',   'aff2-hosp-um'),
  ('0aff2002-0000-0000-0000-000000000012', '0aff2002-0000-0000-0000-00000000000a', 'AFF2 Hospital Dois', 'aff2-hosp-dois'),
  ('0aff2002-0000-0000-0000-000000000013', '0aff2002-0000-0000-0000-00000000000b', 'AFF2 Hospital Beta', 'aff2-hosp-beta');

insert into public.commissions (id, name, slug, hospital_id, organization_id) values
  ('0aff2002-0000-0000-0000-000000000021', 'AFF2 Comissao Um', 'aff2-com-um',
   '0aff2002-0000-0000-0000-000000000011', '0aff2002-0000-0000-0000-00000000000a');

-- Personas. Inserting into auth.users auto-creates the profile (on_auth_user_created).
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', e, now(), now()
from (values
  ('0aff2002-0000-0000-0000-0000000000a1'::uuid, 'aff2.ha1@test.local'),      -- admin of H1
  ('0aff2002-0000-0000-0000-0000000000a2'::uuid, 'aff2.ha2@test.local'),      -- admin of H2 (sibling)
  ('0aff2002-0000-0000-0000-0000000000a3'::uuid, 'aff2.hax@test.local'),      -- admin of HX (other org)
  ('0aff2002-0000-0000-0000-0000000000b1'::uuid, 'aff2.p.aff@test.local'),    -- AFFILIATION leg only
  ('0aff2002-0000-0000-0000-0000000000b2'::uuid, 'aff2.p.mem@test.local'),    -- MEMBERSHIP leg only
  ('0aff2002-0000-0000-0000-0000000000b3'::uuid, 'aff2.p.tier@test.local'),   -- hospital-TIER only
  ('0aff2002-0000-0000-0000-0000000000b4'::uuid, 'aff2.p.h2@test.local'),     -- the §4.3 control subject
  ('0aff2002-0000-0000-0000-0000000000b5'::uuid, 'aff2.p.none@test.local'),   -- NO footprint at all
  ('0aff2002-0000-0000-0000-0000000000c1'::uuid, 'aff2.colleague@test.local') -- plain staff, same commission
) as s(u, e);

update public.profiles set home_organization_id = '0aff2002-0000-0000-0000-00000000000a'
 where id in ('0aff2002-0000-0000-0000-0000000000a1','0aff2002-0000-0000-0000-0000000000a2',
              '0aff2002-0000-0000-0000-0000000000b1','0aff2002-0000-0000-0000-0000000000b2',
              '0aff2002-0000-0000-0000-0000000000b3','0aff2002-0000-0000-0000-0000000000b4',
              '0aff2002-0000-0000-0000-0000000000b5','0aff2002-0000-0000-0000-0000000000c1');
update public.profiles set home_organization_id = '0aff2002-0000-0000-0000-00000000000b'
 where id = '0aff2002-0000-0000-0000-0000000000a3';

-- The three admins. Exactly one membership each (see the header).
insert into public.memberships (organization_id, hospital_id, principal_id, role) values
  ('0aff2002-0000-0000-0000-00000000000a', '0aff2002-0000-0000-0000-000000000011', '0aff2002-0000-0000-0000-0000000000a1', 'hospital_admin'),
  ('0aff2002-0000-0000-0000-00000000000a', '0aff2002-0000-0000-0000-000000000012', '0aff2002-0000-0000-0000-0000000000a2', 'hospital_admin'),
  ('0aff2002-0000-0000-0000-00000000000b', '0aff2002-0000-0000-0000-000000000013', '0aff2002-0000-0000-0000-0000000000a3', 'hospital_admin');

-- ⭐ THE SUBJECTS ARE SPLIT BY LEG ON PURPOSE. A single subject holding BOTH routes would
-- stay green with either leg missing from the policy, which is the whole failure mode this
-- file exists to exclude. b1 can only be reached by the affiliation leg, b2 only by the
-- membership leg, b3 only by the membership leg's hospital-tier arm.
insert into public.hospital_affiliations (principal_id, organization_id, hospital_id, started_on) values
  ('0aff2002-0000-0000-0000-0000000000b1', '0aff2002-0000-0000-0000-00000000000a', '0aff2002-0000-0000-0000-000000000011', '2024-01-01'),
  ('0aff2002-0000-0000-0000-0000000000b4', '0aff2002-0000-0000-0000-00000000000a', '0aff2002-0000-0000-0000-000000000012', '2024-01-01');

insert into public.memberships (commission_id, principal_id, role) values
  ('0aff2002-0000-0000-0000-000000000021', '0aff2002-0000-0000-0000-0000000000b2', 'staff'),
  ('0aff2002-0000-0000-0000-000000000021', '0aff2002-0000-0000-0000-0000000000c1', 'staff');
insert into public.memberships (organization_id, hospital_id, principal_id, role) values
  ('0aff2002-0000-0000-0000-00000000000a', '0aff2002-0000-0000-0000-000000000011', '0aff2002-0000-0000-0000-0000000000b3', 'technical_director');

insert into public.professional_credentials
  (user_id, issuing_country, issuing_state, issuing_authority, registration_number) values
  ('0aff2002-0000-0000-0000-0000000000b1', 'BR', 'SP', 'CRM',   'AFF2-AFF-001'),
  ('0aff2002-0000-0000-0000-0000000000b2', 'BR', 'SP', 'COREN', 'AFF2-MEM-002'),
  ('0aff2002-0000-0000-0000-0000000000b3', 'BR', 'SP', 'CRM',   'AFF2-TIER-003'),
  ('0aff2002-0000-0000-0000-0000000000b4', 'BR', 'SP', 'CRM',   'AFF2-H2-004'),
  ('0aff2002-0000-0000-0000-0000000000b5', 'BR', 'SP', 'CRM',   'AFF2-NONE-005'),
  -- ⛔ The colleague needs one too, and the reason is the point of 4.6: a control that
  -- asserts "this session CAN read something" is itself vacuous if the row it reaches for
  -- was never created. The first run of this file caught exactly that — 4.6 went red on a
  -- missing fixture row, not on a policy fact.
  ('0aff2002-0000-0000-0000-0000000000c1', 'BR', 'SP', 'COREN', 'AFF2-COLLEAGUE-006');

-- Preconditions, asserted rather than assumed (the ad-hoc-probe lesson: a confounder
-- persona confirms falsely). If b1 had a stray membership or b2 a stray affiliation, the
-- leg-separation above would be fiction and §1/§2 would stop distinguishing anything.
select is(
  (select count(*)::int from public.memberships where principal_id = '0aff2002-0000-0000-0000-0000000000b1'), 0,
  '0.1 PRECONDITION: the affiliation-leg subject holds ZERO memberships — so 1.1 can only pass through the affiliation leg');

select is(
  (select count(*)::int from public.hospital_affiliations where principal_id = '0aff2002-0000-0000-0000-0000000000b2'), 0,
  '0.2 PRECONDITION: the membership-leg subject holds ZERO affiliations — so 2.1 can only pass through the membership leg');

select test_helpers.claims_for('0aff2002-0000-0000-0000-0000000000a1');
set local role authenticated;
select ok(
  app.is_hospital_admin_of('0aff2002-0000-0000-0000-000000000011')
  and not app.is_org_admin_of('0aff2002-0000-0000-0000-00000000000a')
  and not app.is_admin(),
  '0.3 PRECONDITION: HA1''s hat RESOLVED as hospital_admin of H1 and it is NOT an org_admin or platform_admin — every ALLOW below therefore passes through the new legs, not a pre-existing one');
select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §1 The AFFILIATION leg (ALLOW). Subject: affiliated to H1, zero committees —
-- exactly the "zero-committee-but-affiliated" arm ADR 0133 D13 names.
-- ===========================================================================
select test_helpers.claims_for('0aff2002-0000-0000-0000-0000000000a1');
set local role authenticated;

select is(
  (select count(*)::int from public.professional_credentials
    where user_id = '0aff2002-0000-0000-0000-0000000000b1'), 1,
  '1.1 ⭐ ALLOW via the AFFILIATION leg: H1''s admin reads the credential of a person affiliated to H1 who sits on NO committee');

select is(
  (select registration_number from public.professional_credentials
    where user_id = '0aff2002-0000-0000-0000-0000000000b1'), 'AFF2-AFF-001',
  '1.2 ... and the VALUE is readable, not just the row count — the Registro column renders a number');

select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §2 The MEMBERSHIP leg (ALLOW). Subject: commission-tier seat at a commission of
-- H1, no affiliation. Reaches the caller only via commissions.hospital_id.
-- ===========================================================================
select test_helpers.claims_for('0aff2002-0000-0000-0000-0000000000a1');
set local role authenticated;

select is(
  (select count(*)::int from public.professional_credentials
    where user_id = '0aff2002-0000-0000-0000-0000000000b2'), 1,
  '2.1 ⭐ ALLOW via the MEMBERSHIP leg: H1''s admin reads the credential of a person seated on an H1 commission with NO hospital affiliation');

select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §3 The HOSPITAL-TIER arm of the membership leg — Amendment 2's widening.
-- Required by the lead: the widest thing the ruling authorises must be the thing
-- an arm asserts, or a later "tightening" to commission-tier passes everything.
-- ===========================================================================
select test_helpers.claims_for('0aff2002-0000-0000-0000-0000000000a1');
set local role authenticated;

select is(
  (select count(*)::int from public.professional_credentials
    where user_id = '0aff2002-0000-0000-0000-0000000000b3'), 1,
  '3.1 ⭐ AMENDMENT 2: H1''s admin reads the credential of a HOSPITAL-TIER person (technical_director at H1) with no affiliation and no committee. This is the COALESCE(hm.hospital_id, hc.hospital_id) arm — narrowing to commission-tier reds HERE and nowhere else');

select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §4 DENY. ⚠ These pin the DEFAULT STATE, not a tenant boundary (ADR 0097 D6).
-- Their entire non-vacuity rests on 4.2 — see the header.
-- ===========================================================================
select test_helpers.claims_for('0aff2002-0000-0000-0000-0000000000a2');
set local role authenticated;

select is(
  (select count(*)::int from public.professional_credentials
    where user_id in ('0aff2002-0000-0000-0000-0000000000b1',
                      '0aff2002-0000-0000-0000-0000000000b2',
                      '0aff2002-0000-0000-0000-0000000000b3')), 0,
  '4.1 DENY: a SIBLING hospital''s admin (H2, same org) reads NONE of H1''s three subjects. Pins the DEFAULT STATE — the absence of a leg admitting them — NOT a tenant boundary');

select is(
  (select count(*)::int from public.professional_credentials
    where user_id = '0aff2002-0000-0000-0000-0000000000b4'), 1,
  '4.2 ⭐ THE CONTROL THAT MAKES 4.1 MEAN ANYTHING: the SAME session DOES read a credential at its OWN hospital. Without this, 4.1''s zero is indistinguishable from a broken hat, a missing fixture row, or a typo''d id');

select test_helpers.reset_role_and_claims();

select test_helpers.claims_for('0aff2002-0000-0000-0000-0000000000a3');
set local role authenticated;
select is(
  (select count(*)::int from public.professional_credentials
    where user_id in ('0aff2002-0000-0000-0000-0000000000b1',
                      '0aff2002-0000-0000-0000-0000000000b2',
                      '0aff2002-0000-0000-0000-0000000000b3')), 0,
  '4.3 DENY: a hospital admin of the OTHER ORG reads none of them either (same D6 caveat — default state, not a proven tenant boundary)');
select test_helpers.reset_role_and_claims();

-- A person with NO footprint belongs to no hospital, so no hospital admin reaches them.
select test_helpers.claims_for('0aff2002-0000-0000-0000-0000000000a1');
set local role authenticated;
select is(
  (select count(*)::int from public.professional_credentials
    where user_id = '0aff2002-0000-0000-0000-0000000000b5'), 0,
  '4.4 DENY: an UNAFFILIATED, uncommitteed person is reachable by no hospital admin — both legs require a hospital, and the empty footprint satisfies neither');
select test_helpers.reset_role_and_claims();

-- The widening must not reach below the admin tier.
select test_helpers.claims_for('0aff2002-0000-0000-0000-0000000000c1');
set local role authenticated;
select is(
  (select count(*)::int from public.professional_credentials
    where user_id = '0aff2002-0000-0000-0000-0000000000b2'), 0,
  '4.5 DENY: a plain STAFF colleague on the SAME commission reads nothing. Both new legs gate on app.is_hospital_admin_of, so co-membership alone must not admit');

select is(
  (select count(*)::int from public.professional_credentials
    where user_id = '0aff2002-0000-0000-0000-0000000000c1'), 1,
  '4.6 VACUITY CONTROL for 4.5: that same staff member DOES read their OWN credential (the self leg). 4.5''s zero is therefore about the subject, not about a session that can read nothing');
select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §5 The three ORIGINAL legs survived the re-emission. `alter policy` replaces the
-- whole USING expression, so a leg dropped in transcription would be invisible —
-- every ALLOW above would still pass, because they all exercise the NEW legs.
-- ===========================================================================
select test_helpers.claims_for('0aff2002-0000-0000-0000-0000000000b1');
set local role authenticated;
select is(
  (select count(*)::int from public.professional_credentials
    where user_id = '0aff2002-0000-0000-0000-0000000000b1'), 1,
  '5.1 REGRESSION (leg 1 of 3, self): a person still reads their own credential');
select test_helpers.reset_role_and_claims();

-- An org_admin of the subjects' home org. Reaches them through leg 3, not the new ones.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '0aff2002-0000-0000-0000-0000000000d1',
        'authenticated', 'authenticated', 'aff2.orgadmin@test.local', now(), now());
update public.profiles set home_organization_id = '0aff2002-0000-0000-0000-00000000000a'
 where id = '0aff2002-0000-0000-0000-0000000000d1';
insert into public.memberships (organization_id, principal_id, role)
values ('0aff2002-0000-0000-0000-00000000000a', '0aff2002-0000-0000-0000-0000000000d1', 'org_admin');

select test_helpers.claims_for('0aff2002-0000-0000-0000-0000000000d1');
set local role authenticated;
select is(
  (select count(*)::int from public.professional_credentials
    where user_id in ('0aff2002-0000-0000-0000-0000000000b1','0aff2002-0000-0000-0000-0000000000b2',
                      '0aff2002-0000-0000-0000-0000000000b3','0aff2002-0000-0000-0000-0000000000b4',
                      '0aff2002-0000-0000-0000-0000000000b5')), 5,
  '5.2 REGRESSION (leg 3 of 3, org_admin-of-home-org): still reads ALL FIVE subjects, including the zero-footprint one no hospital admin can reach');
select test_helpers.reset_role_and_claims();

-- The seeded platform admin (measured: the only `profiles.is_admin` row). `claims_for`'s
-- second argument mints the `platform_admin` hat, which `app.is_admin()` requires since
-- ADR 0106 D11 — holding the entitlement is not enough, the caller must be ACTING as it.
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b0', true);
set local role authenticated;
-- ⛔ HARDENED 2026-08-23. This was `count(*) from professional_credentials >= 6` — an
-- unscoped floor over the whole table, so ambient rows from a concurrent E2E run could
-- satisfy it while the platform_admin leg was broken for every fixture subject. Measured
-- during that incident: the contamination added 0 credentials, so this one was not in fact
-- moved — but "it happened not to be reachable this time" is not a property, and the
-- scoped form costs nothing.
select is(
  (select count(*)::int from public.professional_credentials
    where user_id in ('0aff2002-0000-0000-0000-0000000000b1','0aff2002-0000-0000-0000-0000000000b2',
                      '0aff2002-0000-0000-0000-0000000000b3','0aff2002-0000-0000-0000-0000000000b4',
                      '0aff2002-0000-0000-0000-0000000000b5','0aff2002-0000-0000-0000-0000000000c1')), 6,
  '5.3 REGRESSION (leg 2 of 3, app.is_admin): a platform_admin reads ALL SIX fixture credentials — an exact count over named ids, not a floor over the whole table');
select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §6 Structure. A second permissive SELECT policy, or a new write policy, would
-- change what this table admits while every assertion above stayed green.
-- ===========================================================================
select is(
  (select count(*)::int from pg_policy pol join pg_class c on c.oid = pol.polrelid
    where c.relname = 'professional_credentials'), 1,
  '6.1 the table still carries EXACTLY ONE policy — no second permissive SELECT policy quietly ORed in beside this one, and no new write policy');

select is(
  (select pol.polcmd::text from pg_policy pol join pg_class c on c.oid = pol.polrelid
    where c.relname = 'professional_credentials'), 'r',
  '6.2 ... and it is still SELECT-only. Credential WRITES stay off the RLS path (no INSERT/UPDATE/DELETE policy exists, so authenticated cannot write despite holding table grants)');

select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'professional_credentials'),
  '6.3 ... and RLS is still ENABLED — without this every DENY above would be measuring nothing (Architecture Rule 1)');

-- Both new legs must actually be present in the stored expression. This is a WEAK
-- assertion by design (text matching on a normalized predicate) and is here only to
-- catch the case where a future edit drops a leg while the fixture happens not to
-- cover it; §1/§2/§3 are the real proof.
select ok(
  (select pg_get_expr(pol.polqual, pol.polrelid) from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    where c.relname = 'professional_credentials') like '%hospital_affiliations%',
  '6.4 the affiliation leg is present in the stored predicate');

select ok(
  (select pg_get_expr(pol.polqual, pol.polrelid) from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    where c.relname = 'professional_credentials') like '%COALESCE%',
  '6.5 the membership leg kept its COALESCE(hm.hospital_id, hc.hospital_id) form — the hospital-tier arm Amendment 2 authorised (see §3)');

select * from finish();
rollback;

-- AFF3 — a hospital_admin keeps READ visibility of a person who EVER held an affiliation
-- to a hospital they administer. ADR 0148. Migration 20261003002900.
--
-- WHY THIS EXISTS. `end_affiliation` is the documented hospital-admin offboarding action,
-- and until this change it was self-defeating: the instant the affiliation ended, the
-- person's `profiles` row left the admin's RLS scope, so the offboarding flow's own
-- redirect landed on a 404 and the person-detail page's affiliation-history card — whose
-- entire purpose is to render `Encerrado` rows — was unreachable for the one role that
-- needs it. Measured before the migration, `hospitaladmin.a1` vs `dr.john`, rolled back:
-- affiliation active => 1 profiles row; commission seat ALSO removed => still 1; the
-- affiliation then ended => 0.
--
-- ⭐ THE SHARPEST STATEMENT OF THE DEFECT, and the reason this is a contradiction rather
-- than merely a tight policy: `public.list_org_people` is SECURITY DEFINER and its gate is
-- ORG-scoped — it does not filter on affiliation at all. So the departed person kept
-- appearing in the hospital admin's directory listing (measured: 1) while `profiles`
-- returned 0. The platform listed a person you could not open. The DEFINER door and the
-- RLS policy disagreed, and only the door had ever been consulted — this repo's standing
-- lesson that `prosecdef` belongs beside `pg_policies`, one more time. §2.3 pins the
-- agreement the migration creates, so a future re-narrowing of the policy reds HERE
-- rather than silently restoring the contradiction.
--
-- ⛔ THREE POLICIES CHANGED, NOT TWO, AND THE THIRD IS A DIFFERENT DATA CLASS.
-- `profiles_admin_select` + `profiles_select_self_or_admin` carry the leg, and so does
-- `professional_credentials_select` — which exists (ADR 0133 D13 Amdt 2, migration
-- 20261003001100) precisely to MIRROR the two profiles legs, because a hospital admin who
-- could read a profile but not the credential rendered an em-dash in the "Registro"
-- column: an empty cell silently meaning "no permission", the state this codebase bans.
-- Widening profiles alone would have re-created that exact bug for departed people one
-- release later. Credentials are Class-2 professional-identity data (Rule 12), so §1.4
-- asserts that arm separately rather than letting it ride along inside a profiles count.
--
-- ⚠ BOTH PROFILES POLICIES ARE PERMISSIVE AND OR'D TOGETHER, so widening EITHER ONE alone
-- makes every ALLOW arm below pass. §5 is therefore not decoration: it is the only thing
-- that can tell a fully-applied migration from a half-applied one. Per-policy, by name.
--
-- ⛔ WHAT DID *NOT* MOVE — and this is the whole risk of the change. READ widened; WRITE
-- did not. §4 pins that, with the honest caveat stated on the section itself.
--
-- ⛔ FIXTURE DISCIPLINE: every id is FIXED and self-contained (the `0aff3001-` block),
-- never a seed persona and never `gen_random_uuid()`. Seed ids drift with the roster, and
-- a keystone pinned to ids a seed minted randomly is green only on the reset that authored
-- it and red on every fresh one. Each admin persona holds EXACTLY ONE membership so
-- `test_helpers.claims_for` auto-derives its `active_role`; a hatless fixture fails CLOSED,
-- which reads as a correct DENY. §0.3 asserts the hats resolved rather than trusting that.

begin;
select plan(35);

-- ===========================================================================
-- §0 Fixture + preconditions. Built as table owner, before any role switch.
-- ===========================================================================
insert into public.organizations (id, name, slug) values
  ('0aff3001-0000-0000-0000-00000000000a', 'AFF3 Rede Alfa', 'aff3-rede-alfa'),
  ('0aff3001-0000-0000-0000-00000000000b', 'AFF3 Rede Beta', 'aff3-rede-beta');

insert into public.hospitals (id, organization_id, name, slug) values
  ('0aff3001-0000-0000-0000-000000000011', '0aff3001-0000-0000-0000-00000000000a', 'AFF3 Hospital Um',   'aff3-hosp-um'),
  ('0aff3001-0000-0000-0000-000000000012', '0aff3001-0000-0000-0000-00000000000a', 'AFF3 Hospital Dois', 'aff3-hosp-dois'),
  ('0aff3001-0000-0000-0000-000000000013', '0aff3001-0000-0000-0000-00000000000b', 'AFF3 Hospital Beta', 'aff3-hosp-beta');

-- Personas. Inserting into auth.users auto-creates the profile (on_auth_user_created).
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', e, now(), now()
from (values
  ('0aff3001-0000-0000-0000-0000000000a1'::uuid, 'aff3.ha1@test.local'),      -- admin of H1
  ('0aff3001-0000-0000-0000-0000000000a2'::uuid, 'aff3.ha2@test.local'),      -- admin of H2 (sibling, same org)
  ('0aff3001-0000-0000-0000-0000000000a3'::uuid, 'aff3.hax@test.local'),      -- admin of HX (other org)
  ('0aff3001-0000-0000-0000-0000000000d1'::uuid, 'aff3.orgadmin@test.local'), -- org_admin of Alfa
  ('0aff3001-0000-0000-0000-0000000000b1'::uuid, 'aff3.departed@test.local'), -- ⭐ THE SUBJECT: ENDED H1 affiliation
  ('0aff3001-0000-0000-0000-0000000000b2'::uuid, 'aff3.stranger@test.local'), -- never any tie to H1
  ('0aff3001-0000-0000-0000-0000000000b3'::uuid, 'aff3.h2departed@test.local'),-- ENDED H2 affiliation
  ('0aff3001-0000-0000-0000-0000000000b4'::uuid, 'aff3.active@test.local')    -- ACTIVE H1 affiliation (control)
) as s(u, e);

update public.profiles set home_organization_id = '0aff3001-0000-0000-0000-00000000000a'
 where id in ('0aff3001-0000-0000-0000-0000000000a1','0aff3001-0000-0000-0000-0000000000a2',
              '0aff3001-0000-0000-0000-0000000000d1','0aff3001-0000-0000-0000-0000000000b1',
              '0aff3001-0000-0000-0000-0000000000b2','0aff3001-0000-0000-0000-0000000000b3',
              '0aff3001-0000-0000-0000-0000000000b4');
update public.profiles set home_organization_id = '0aff3001-0000-0000-0000-00000000000b'
 where id = '0aff3001-0000-0000-0000-0000000000a3';

update public.profiles set full_name = 'AFF3 Pessoa Desligada'
 where id = '0aff3001-0000-0000-0000-0000000000b1';

-- The three hospital admins + one org_admin. Exactly ONE membership each (see the header).
insert into public.memberships (organization_id, hospital_id, principal_id, role) values
  ('0aff3001-0000-0000-0000-00000000000a', '0aff3001-0000-0000-0000-000000000011', '0aff3001-0000-0000-0000-0000000000a1', 'hospital_admin'),
  ('0aff3001-0000-0000-0000-00000000000a', '0aff3001-0000-0000-0000-000000000012', '0aff3001-0000-0000-0000-0000000000a2', 'hospital_admin'),
  ('0aff3001-0000-0000-0000-00000000000b', '0aff3001-0000-0000-0000-000000000013', '0aff3001-0000-0000-0000-0000000000a3', 'hospital_admin');
insert into public.memberships (organization_id, principal_id, role) values
  ('0aff3001-0000-0000-0000-00000000000a', '0aff3001-0000-0000-0000-0000000000d1', 'org_admin');

-- ⭐ THE SUBJECTS CARRY EXACTLY ONE ROUTE EACH, ON PURPOSE. `departed` holds an ENDED H1
-- affiliation and NOTHING else — no membership, no second affiliation — so §1 can only
-- pass through the widened affiliation leg. A subject holding any other route would keep
-- §1 green with the migration reverted, which is the whole failure mode this file excludes.
insert into public.hospital_affiliations
  (principal_id, organization_id, hospital_id, started_on, ended_on) values
  ('0aff3001-0000-0000-0000-0000000000b1', '0aff3001-0000-0000-0000-00000000000a',
   '0aff3001-0000-0000-0000-000000000011', '2023-01-01', '2025-06-30'),
  ('0aff3001-0000-0000-0000-0000000000b3', '0aff3001-0000-0000-0000-00000000000a',
   '0aff3001-0000-0000-0000-000000000012', '2023-01-01', '2025-06-30');
insert into public.hospital_affiliations
  (principal_id, organization_id, hospital_id, started_on) values
  ('0aff3001-0000-0000-0000-0000000000b4', '0aff3001-0000-0000-0000-00000000000a',
   '0aff3001-0000-0000-0000-000000000011', '2024-01-01');

insert into public.professional_credentials
  (user_id, issuing_country, issuing_state, issuing_authority, registration_number) values
  ('0aff3001-0000-0000-0000-0000000000b1', 'BR', 'SP', 'CRM',   'AFF3-DEPARTED-001'),
  ('0aff3001-0000-0000-0000-0000000000b2', 'BR', 'SP', 'COREN', 'AFF3-STRANGER-002'),
  ('0aff3001-0000-0000-0000-0000000000b4', 'BR', 'SP', 'CRM',   'AFF3-ACTIVE-004');

-- Preconditions, asserted rather than assumed (the ad-hoc-probe lesson: a persona with a
-- seeded confounder confirms falsely).
select is(
  (select count(*)::int from public.memberships
    where principal_id = '0aff3001-0000-0000-0000-0000000000b1'), 0,
  '0.1 PRECONDITION: the departed subject holds ZERO memberships — so §1 cannot pass through the membership leg');

select is(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = '0aff3001-0000-0000-0000-0000000000b1' and ended_on is null), 0,
  '0.2 PRECONDITION: the departed subject holds ZERO ACTIVE affiliations — the pre-change predicate matches nothing for them');

select is(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = '0aff3001-0000-0000-0000-0000000000b1'), 1,
  '0.3 PRECONDITION: ... but exactly ONE affiliation row EXISTS (ended). Without this, §1 would be asserting over an absent row rather than an ended one');

select is(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = '0aff3001-0000-0000-0000-0000000000b2')
  + (select count(*)::int from public.memberships
    where principal_id = '0aff3001-0000-0000-0000-0000000000b2'), 0,
  '0.4 PRECONDITION: the stranger subject holds NO affiliation and NO membership anywhere — §3.1''s deny is about the absence of a tie to H1, not about a tie that expired');

select test_helpers.claims_for('0aff3001-0000-0000-0000-0000000000a1');
set local role authenticated;
select ok(
  app.is_hospital_admin_of('0aff3001-0000-0000-0000-000000000011')
  and not app.is_hospital_admin_of('0aff3001-0000-0000-0000-000000000012')
  and not app.is_org_admin_of('0aff3001-0000-0000-0000-00000000000a')
  and not app.is_admin(),
  '0.5 PRECONDITION: HA1''s hat RESOLVED as hospital_admin of H1 ONLY — not H2, not org_admin, not platform_admin. Every ALLOW below therefore passes through the widened leg, not a pre-existing one');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for('0aff3001-0000-0000-0000-0000000000a2');
set local role authenticated;
select ok(
  app.is_hospital_admin_of('0aff3001-0000-0000-0000-000000000012')
  and not app.is_hospital_admin_of('0aff3001-0000-0000-0000-000000000011'),
  '0.6 PRECONDITION: HA2''s hat RESOLVED as hospital_admin of H2 ONLY — the §3.3/§3.4 pairing needs this to be a real sibling boundary');
select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §1 ⭐ THE NEW BEHAVIOUR. Every arm here is RED before migration 20261003002900.
-- ===========================================================================
select test_helpers.claims_for('0aff3001-0000-0000-0000-0000000000a1');
set local role authenticated;

select is(
  (select count(*)::int from public.profiles
    where id = '0aff3001-0000-0000-0000-0000000000b1'), 1,
  '1.1 ⭐ KEYSTONE: H1''s admin reads the profile of a person whose ONLY affiliation to H1 is ENDED. This is the 404 the offboarding flow used to land on');

select is(
  (select full_name from public.profiles
    where id = '0aff3001-0000-0000-0000-0000000000b1'), 'AFF3 Pessoa Desligada',
  '1.2 ... and the VALUE is readable, not merely the row count — the detail page renders a name, not a blank header');

select is(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = '0aff3001-0000-0000-0000-0000000000b1' and ended_on is not null), 1,
  '1.3 ... and the ENDED affiliation row is readable, so the history card that renders `Encerrado` has something to render. (`hospital_affiliations_select` never filtered activity; this pins that the card''s data survives beside the profile it hangs off)');

select is(
  (select registration_number from public.professional_credentials
    where user_id = '0aff3001-0000-0000-0000-0000000000b1'), 'AFF3-DEPARTED-001',
  '1.4 ⭐ CLASS-2 ARM, asserted separately: the departed person''s COUNCIL REGISTRATION is readable too. Widening profiles alone would render an em-dash here — the "empty means no-permission" state ADR 0133 D13 exists to prevent');

select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §2 The DEFINER door and the RLS policy now AGREE. Before the change the directory
-- listed a person the detail page 404'd on; that contradiction is what §2.3 forbids.
-- ===========================================================================
select test_helpers.claims_for('0aff3001-0000-0000-0000-0000000000a1');
set local role authenticated;

select is(
  (select count(*)::int from public.list_org_people('0aff3001-0000-0000-0000-00000000000a')
    where user_id = '0aff3001-0000-0000-0000-0000000000b1'), 1,
  '2.1 the SECURITY DEFINER directory door lists the departed person (its gate is org-scoped and never filtered affiliation — this was ALWAYS true and is the half that made the disagreement visible)');

select is(
  (select count(*)::int from public.list_org_people('0aff3001-0000-0000-0000-00000000000a') d
    join public.profiles p on p.id = d.user_id
   where d.user_id = '0aff3001-0000-0000-0000-0000000000b1'), 1,
  '2.2 ⭐ THE DOOR AND THE POLICY AGREE: every person the directory door lists can be JOINED to a readable `profiles` row. This is the exact join the detail-page navigation performs, and it returned 0 before the migration');

-- ⚠ THE SCOPE OF THIS CLAIM WAS CORRECTED DURING AUTHORING, and the correction is the
-- interesting part. This arm first read "NOT ONE row the door returns is unopenable" — a
-- universal over the door's whole result. It went RED after the migration with 4 orphans
-- remaining (5 before), and the 4 were characterised rather than explained away: EVERY one
-- of them had never held an affiliation to a hospital this caller administers (a sibling
-- hospital's admin, an org_admin, a person with an ended tie to H2, a person with no
-- footprint at all). That residual is the ORG-SCOPED DEFINER DOOR returning the whole org's
-- roster — pre-existing, ratified by ADR 0097 finding 1, and NOT something this ADR claims
-- to fix. The over-claim would have been a false statement about the platform sitting in a
-- keystone. What ADR 0148 actually establishes is the bounded property below.
select is(
  (select count(*)::int
     from public.list_org_people('0aff3001-0000-0000-0000-00000000000a') d
    where exists (select 1 from public.hospital_affiliations ha
                   where ha.principal_id = d.user_id
                     and ha.hospital_id = '0aff3001-0000-0000-0000-000000000011')
      and not exists (select 1 from public.profiles p where p.id = d.user_id)), 0,
  '2.3 ⭐ ZERO UNOPENABLE EX-COLLEAGUES: of the people the directory door lists, every one who EVER held an affiliation to the hospital this caller administers can be opened. Counterexamples before the migration: 1 (the departed subject). This is the exact property ADR 0148 authorises — bounded to the caller''s own hospital, not a claim about the whole roster');

select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §3 DENY — the widening is HOSPITAL-scoped, not org-wide. "People who worked HERE",
-- never "people who work anywhere". Each deny is paired with a control on the SAME
-- session, or its zero is indistinguishable from a broken hat or a missing fixture row.
-- ===========================================================================
select test_helpers.claims_for('0aff3001-0000-0000-0000-0000000000a1');
set local role authenticated;

select is(
  (select count(*)::int from public.profiles
    where id = '0aff3001-0000-0000-0000-0000000000b2'), 0,
  '3.1 DENY: H1''s admin does NOT read a person in the same org who NEVER held any tie to H1. The widening changed the TENSE of the affiliation test, not its HOSPITAL scope');

select is(
  (select count(*)::int from public.profiles
    where id = '0aff3001-0000-0000-0000-0000000000b4'), 1,
  '3.2 ⭐ THE CONTROL THAT MAKES 3.1 MEAN ANYTHING: the SAME session DOES read an ACTIVELY affiliated H1 person. Without it, 3.1''s zero could be a broken hat, an unset claim, or a typo''d id');

select is(
  (select count(*)::int from public.profiles
    where id = '0aff3001-0000-0000-0000-0000000000b3'), 0,
  '3.3 DENY: H1''s admin does NOT read a person whose ended affiliation was to the SIBLING hospital H2. Removing the conjunct must not collapse the hospital boundary along with the time boundary');

select test_helpers.reset_role_and_claims();

select test_helpers.claims_for('0aff3001-0000-0000-0000-0000000000a2');
set local role authenticated;
select is(
  (select count(*)::int from public.profiles
    where id = '0aff3001-0000-0000-0000-0000000000b3'), 1,
  '3.4 ⭐ THE CONTROL FOR 3.3, AND THE POSITIVE TWIN OF §1: H2''s OWN admin DOES read that same H2-departed person. So 3.3 is a statement about which hospital, and the widening is proven to work for a second hospital rather than being special-cased to H1');
select is(
  (select count(*)::int from public.profiles
    where id = '0aff3001-0000-0000-0000-0000000000b1'), 0,
  '3.5 DENY: the sibling-hospital admin does NOT read H1''s departed person');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for('0aff3001-0000-0000-0000-0000000000a3');
set local role authenticated;
select is(
  (select count(*)::int from public.profiles
    where id in ('0aff3001-0000-0000-0000-0000000000b1','0aff3001-0000-0000-0000-0000000000b4')), 0,
  '3.6 DENY (CROSS-ORG): a hospital admin of ANOTHER ORG reads neither the departed nor the active H1 person');
select is(
  (select count(*)::int from public.professional_credentials
    where user_id = '0aff3001-0000-0000-0000-0000000000b1'), 0,
  '3.7 DENY: ... and cannot read the departed person''s credential either — the Class-2 widening carries the same hospital bound as the profiles one');
select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §4 ⛔ THE WRITE BOUNDARY, WHICH DID NOT MOVE.
--
-- ⚠ HONEST CAVEAT, STATED SO NOBODY LATER MIS-CITES THIS SECTION: every arm here is
-- green BEFORE and AFTER migration 20261003002900. It proves that the widening added no
-- WRITE leg. It does NOT prove the ADR-0133 (AFF2) capability derivation, because that
-- derivation is TypeScript running on the SERVICE-ROLE client, where RLS does not apply
-- at all. Its proof lives in `src/lib/users/departed-person-footprint.test.ts`, whose mock
-- APPLIES the filters it is given so the suite reds if `.is('ended_on', null)` is deleted
-- from `resolvePersonFootprint` (verified by mutation: 7 of 11 arms fail). Do not cite §4
-- as AFF2 coverage.
--
-- What §4 genuinely establishes: at the RLS layer a hospital_admin has NO write path to
-- `profiles` whatsoever — `profiles_admin_update` is `app.is_admin()` and
-- `profiles_update_self` is `id = auth.uid()`, and neither gained a leg here.
-- ===========================================================================
select test_helpers.claims_for('0aff3001-0000-0000-0000-0000000000a1');
set local role authenticated;

update public.profiles set full_name = 'AFF3 ESCALADA INDEVIDA'
 where id = '0aff3001-0000-0000-0000-0000000000b1';
update public.profiles set full_name = 'AFF3 ESCALADA INDEVIDA'
 where id = '0aff3001-0000-0000-0000-0000000000b4';
-- The control: the SAME session updating ITSELF, through `profiles_update_self`.
update public.profiles set full_name = 'AFF3 HA1 Autoedicao'
 where id = '0aff3001-0000-0000-0000-0000000000a1';
select test_helpers.reset_role_and_claims();

select is(
  (select full_name from public.profiles
    where id = '0aff3001-0000-0000-0000-0000000000b1'), 'AFF3 Pessoa Desligada',
  '4.1 ⛔ THE BOUNDARY: a hospital_admin that can now READ the departed person still CANNOT rename them — the UPDATE matched zero rows and the stored name is untouched. Read widened; write did not');

select isnt(
  (select full_name from public.profiles
    where id = '0aff3001-0000-0000-0000-0000000000b4'), 'AFF3 ESCALADA INDEVIDA',
  '4.2 ... and the same refusal applies to an ACTIVELY affiliated person, so 4.1 is the standing read/write asymmetry rather than something this migration introduced for departed people only');

select is(
  (select full_name from public.profiles
    where id = '0aff3001-0000-0000-0000-0000000000a1'), 'AFF3 HA1 Autoedicao',
  '4.3 ⭐ THE CONTROL THAT MAKES 4.1/4.2 MEAN ANYTHING: that same session DID successfully update its OWN row via `profiles_update_self`. Without this, both refusals above are indistinguishable from a session with no UPDATE grant, a failed hat, or a typo''d id');

select is(
  (select string_agg(policyname, ',' order by policyname) from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'UPDATE'),
  'profiles_admin_update,profiles_update_self',
  '4.4 the UPDATE surface is UNCHANGED — exactly these two policies, by name. A third one, or a hospital-admin leg grafted onto either, would let 4.1 keep passing for this fixture while the boundary moved for someone else');

-- ===========================================================================
-- §5 STRUCTURE — did the migration actually land on ALL THREE policies?
--
-- ⚠ THE ONLY SECTION THAT CAN DETECT A HALF-APPLIED MIGRATION. The two `profiles`
-- policies are permissive and OR'd, so widening EITHER makes all of §1 pass. Asserted
-- per policy, by name, in both directions: the leg must still be PRESENT (so a migration
-- that deleted the whole leg instead of the conjunct reds), and it must no longer filter
-- activity.
-- ===========================================================================
select ok(
  (select qual from pg_policies where tablename = 'profiles' and policyname = 'profiles_admin_select')
    like '%hospital_affiliations%',
  '5.1 `profiles_admin_select` still HAS an affiliation leg (a migration that dropped the leg rather than the conjunct would also make §1 pass — for the wrong reason, by admitting nobody through it)');

select ok(
  (select qual from pg_policies where tablename = 'profiles' and policyname = 'profiles_admin_select')
    not like '%ended_on%',
  '5.2 ⭐ `profiles_admin_select` no longer filters `ended_on` anywhere in its predicate');

select ok(
  (select qual from pg_policies where tablename = 'profiles' and policyname = 'profiles_select_self_or_admin')
    like '%hospital_affiliations%',
  '5.3 `profiles_select_self_or_admin` still HAS an affiliation leg');

select ok(
  (select qual from pg_policies where tablename = 'profiles' and policyname = 'profiles_select_self_or_admin')
    not like '%ended_on%',
  '5.4 ⭐ `profiles_select_self_or_admin` no longer filters `ended_on` — the arm §1 would NOT have caught, since either policy alone satisfies it');

select ok(
  (select qual from pg_policies where tablename = 'professional_credentials' and policyname = 'professional_credentials_select')
    like '%hospital_affiliations%',
  '5.5 `professional_credentials_select` still HAS an affiliation leg');

select ok(
  (select qual from pg_policies where tablename = 'professional_credentials' and policyname = 'professional_credentials_select')
    not like '%ended_on%',
  '5.6 ⭐ `professional_credentials_select` no longer filters `ended_on` — the Class-2 arm');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'SELECT'), 2,
  '5.7 `profiles` still carries exactly TWO SELECT policies — a third permissive one would widen reads past what this ADR authorised while every arm above stayed green');

-- ===========================================================================
-- §6 REGRESSION — the legs that were NOT the subject of this change survived the
-- re-emission. `create policy` writes the whole USING expression, so a leg lost in
-- transcription would be invisible to §1–§3: they all exercise the affiliation leg.
-- ===========================================================================
select test_helpers.claims_for('0aff3001-0000-0000-0000-0000000000b2');
set local role authenticated;
select is(
  (select count(*)::int from public.profiles
    where id = '0aff3001-0000-0000-0000-0000000000b2'), 1,
  '6.1 REGRESSION (self leg): a person with no footprint at all still reads their OWN profile');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for('0aff3001-0000-0000-0000-0000000000d1');
set local role authenticated;
select is(
  (select count(*)::int from public.profiles
    where id in ('0aff3001-0000-0000-0000-0000000000b1','0aff3001-0000-0000-0000-0000000000b2',
                 '0aff3001-0000-0000-0000-0000000000b3','0aff3001-0000-0000-0000-0000000000b4')), 4,
  '6.2 REGRESSION (org_admin-of-home-org leg): an org_admin still reads ALL FOUR subjects, departed and active alike — this leg is why the defect was hospital-admin-only');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b0', true);
set local role authenticated;
select is(
  (select count(*)::int from public.profiles
    where id in ('0aff3001-0000-0000-0000-0000000000b1','0aff3001-0000-0000-0000-0000000000b2',
                 '0aff3001-0000-0000-0000-0000000000b3','0aff3001-0000-0000-0000-0000000000b4')), 4,
  '6.3 REGRESSION (platform_admin leg): `app.is_admin()` still admits — an exact count over named ids, never a floor over the table (ambient E2E rows can satisfy a floor while the leg is broken)');
select test_helpers.reset_role_and_claims();

select ok(
  (select qual from pg_policies where tablename = 'profiles' and policyname = 'profiles_select_self_or_admin')
    like '%is_member_of%',
  '6.4 REGRESSION (co-membership leg): the `app.is_member_of` leg survived the re-emission. No arm above exercises it, so only a structural assertion can notice it vanish');

select * from finish();
rollback;

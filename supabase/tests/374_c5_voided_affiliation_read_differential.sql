-- AFF4 B3 — THE C5 KEYSTONE. ADR 0151 D7; closes
-- `FUP-AFF3-NO-REVOCATION-FOR-A-MIS-ENTERED-AFFILIATION`.
--
-- THE PROPOSITION. Since ADR 0148 made person reads EVER-HELD, a hospital admin who once
-- held an affiliation over a person keeps reading that person's profile and council
-- credentials FOREVER. `end_affiliation` cannot withdraw it — ending says "was true and
-- stopped", and an ever-held leg reads ended rows by definition. So a MIS-ENTERED
-- affiliation grants a permanent, unrevocable read. Void is the third tense that revokes
-- it, and this suite is the reason the tense exists.
--
-- ⚠ THIS IS A DIFFERENTIAL, NOT A POST-STATE. Asserting only "the wrong-hospital admin
-- cannot read the person after the void" passes just as happily when the admin could
-- never read them in the first place — a fixture that cannot reach the failing state
-- reports success for the wrong reason. §1 therefore PROVES the read exists (and survives
-- an END, which is the half that makes C5 a defect), §2 proves the void removes it, and
-- §3 proves the removal is SCOPED rather than a general blackout.
--
-- ⚠ WHY THE FIXTURE IS BUILT THE WAY IT IS, and why §0 asserts it instead of trusting it.
-- All three policies under test carry a SECOND hospital-admin leg — the memberships-
-- derived one (`hm` LEFT JOIN `hc`) — that never touches `hospital_affiliations` at all.
-- If the subject held ANY membership at the admin's hospital or its commissions, that leg
-- would carry the read straight through the void and §2 would fail for a reason having
-- nothing to do with the change under test. The subject is therefore seatless, and §0.1
-- ASSERTS it: a keystone whose precondition is only a comment is one fixture edit away
-- from proving nothing.
--
-- ⚠ EXPECTED RED BEFORE THE B3 MIGRATION. §2.1 and §2.2 fail until the affiliation leg of
-- `profiles_admin_select`, `profiles_select_self_or_admin` and
-- `professional_credentials_select` gains `AND ha.voided_at IS NULL`. That red is the
-- point: it is observed and reported BEFORE the migration lands. §1 and §3 pass both
-- before and after — they are the controls that keep §2's green honest.
--
-- ⚠ THE VOID IS PERFORMED BY A DIRECT OWNER-LEVEL UPDATE, not by `void_affiliation` —
-- that door is AFF4 B4 and does not exist yet. This suite tests the READ CONSEQUENCE of
-- the voided tense, which is B3's whole scope; the door's own authority grid and its
-- never-employed precondition are B4/B9's.
--
-- Assertion count: 15

begin;
select plan(15);

create temp table k on commit drop as select
  -- hospital_admin of central-a ONLY. Not a platform admin, not an org admin: the
  -- affiliation leg is his ONLY route to this subject, which is what makes the
  -- differential attributable.
  '00000000-0000-0000-0000-0000000000e1'::uuid as hosp_admin,
  -- novato.pendente — ZERO memberships anywhere (see §0.1). Anchored to org A, active,
  -- so he is affiliatable and reachable by the org admin control in §3.
  '00000000-0000-0000-0000-0000000000d1'::uuid as subject,
  '00000000-0000-0000-0000-0000000000b1'::uuid as org_admin_a,
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  '05000000-0000-0000-0000-00000000000a'::uuid as central_a,
  'ac000000-0000-0000-0000-0000000000c5'::uuid as cred_id;
grant select on k to authenticated;
grant select on k to service_role;

-- ============================================================================
-- §0 PRECONDITIONS — asserted, never assumed. Each one is a way this suite could go
--    green while measuring nothing.
-- ============================================================================

-- `app.audit_write` is feature-flag gated, and the affiliation audit trigger calls it on
-- every write this fixture performs.
select is((select enabled from app.feature_flags where key = 'audit_trail'), true,
  '0.0 PRECONDITION: audit_trail is enabled (the affiliation audit trigger depends on it)');

select is(
  (select count(*)::int from public.memberships where principal_id = (select subject from k)), 0,
  '0.1 PRECONDITION (the vacuity guard): the subject holds ZERO memberships, so the memberships-derived hospital-admin leg cannot carry the read past the void');

select is(
  (select is_admin from public.profiles where id = (select hosp_admin from k)), false,
  '0.2 PRECONDITION: the admin is NOT a platform admin (app.is_admin() would satisfy profiles_admin_select leg 1 regardless of any affiliation)');

select is(
  (select count(*)::int from public.memberships
    where principal_id = (select hosp_admin from k)
      and role = 'org_admin' and organization_id = (select org_a from k)), 0,
  '0.3 PRECONDITION: the admin is NOT an org_admin of the subject''s organization (the org-tier leg is a separate OR arm, untouched by B3; since AE2.2 it keys on organization_affiliations, not home_organization_id)');

-- The subject has no council credential in the seed, so one is created here. Without it,
-- "the admin can no longer read the credentials" would be trivially true in BOTH
-- directions — the recorded shape where a green gate means the fixture cannot reach the
-- failing state.
insert into public.professional_credentials
  (id, user_id, issuing_country, issuing_state, issuing_authority, registration_number)
values
  ((select cred_id from k), (select subject from k), 'BR', 'SP', 'COREN', 'C5-KEYSTONE-1');

select is(
  (select count(*)::int from public.professional_credentials where user_id = (select subject from k)), 1,
  '0.4 PRECONDITION: the subject HAS exactly one credential, so §1.2/§2.2 measure a real read rather than an empty set');

-- The affiliation is the SEED's, not one this suite inserts. That is deliberate and it
-- was not a free choice: `novato.pendente` is the only active org-A profile with zero
-- memberships, and the seed already affiliates him to central-a — an INSERT here collides
-- with `hospital_affiliations_active_uq`. Asserting the seed's shape is therefore the
-- honest form. The ids are fixed, so the fixture stays deterministic; what it must not do
-- is ASSUME the row's tense, since starting from an already-ended row would make §1.3
-- measure a transition that had already happened.
select is(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = (select subject from k) and hospital_id = (select central_a from k)
      and ended_on is null and voided_at is null), 1,
  '0.5 PRECONDITION: exactly one ACTIVE affiliation exists, at the admin''s own hospital — the single route under test, in the present tense');

-- ============================================================================
-- §1 THE EVER-HELD BASELINE (ADR 0148). This is the defect, demonstrated: the read
--    exists, and ENDING the affiliation does not take it away.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false);
set local role authenticated;

select is(
  (select count(id)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'), 1,
  '1.1 BASELINE: the hospital admin reads the subject''s profile through the affiliation leg');

select is(
  (select count(id)::int from public.professional_credentials
    where user_id = '00000000-0000-0000-0000-0000000000d1'), 1,
  '1.2 BASELINE: ... and reads the subject''s council credential the same way');

reset role;

-- END the affiliation. This is the tense that is NOT sufficient, and proving it here is
-- what makes the void a necessity rather than a preference.
update public.hospital_affiliations
   set ended_on = current_date
 where principal_id = (select subject from k) and hospital_id = (select central_a from k);

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false);
set local role authenticated;

select is(
  (select count(id)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'), 1,
  '1.3 ⭐ C5 ITSELF: the affiliation is ENDED and the admin STILL reads the profile — ever-held (0148), so `end` cannot revoke a mis-entered affiliation');

select is(
  (select count(id)::int from public.professional_credentials
    where user_id = '00000000-0000-0000-0000-0000000000d1'), 1,
  '1.4 ⭐ C5 ITSELF: ... and STILL reads the credential');

reset role;

-- ============================================================================
-- §2 THE VOID — the differential. RED until the B3 migration adds the conjunct.
-- ============================================================================
update public.hospital_affiliations
   set voided_at = now(), voided_by = (select org_admin_a from k),
       void_reason = 'lancamento indevido - keystone C5'
 where principal_id = (select subject from k) and hospital_id = (select central_a from k);

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false);
set local role authenticated;

select is(
  (select count(id)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'), 0,
  '2.1 ⭐ THE FIX: the affiliation is VOIDED and the admin can no longer read the profile');

select is(
  (select count(id)::int from public.professional_credentials
    where user_id = '00000000-0000-0000-0000-0000000000d1'), 0,
  '2.2 ⭐ THE FIX: ... nor the credential');

-- D7's record-vs-contribution asymmetry, and the arm that distinguishes "the affiliation
-- leg was narrowed" from "visibility broke". The ROW stays visible to this table's own
-- audience so the UI can badge it *Anulado*; what was revoked is what the row GRANTED,
-- never the record that it happened.
select is(
  (select count(id)::int from public.hospital_affiliations
    where principal_id = '00000000-0000-0000-0000-0000000000d1'
      and hospital_id = '05000000-0000-0000-0000-00000000000a'), 1,
  '2.3 ⭐ ASYMMETRY (D7): the VOIDED ROW ITSELF is still visible to the same admin — hospital_affiliations_select is deliberately NOT changed');

reset role;

-- ============================================================================
-- §3 SCOPE CONTROL. Without this, §2 is equally consistent with having broken person
--    reads for everyone. The org admin reaches the subject through the ORG-tier leg,
--    which B3 does not touch.
--    ⚠ WEAKENED BY AE2.2 (2026-08-27), stated rather than left to rot. This section
--    used to isolate two DIFFERENT mechanisms: the hospital-affiliation leg (B3's
--    subject) versus `profiles.home_organization_id` (the org leg). AE2.2 moved the
--    org leg onto `organization_affiliations` too, so BOTH legs are now
--    affiliation-derived and §3 no longer separates "the void narrowed the affiliation
--    leg" from "person reads still work at all". It remains a real control — the
--    subject's ORG affiliation is untouched by §2's hospital void, so 3.1/3.2 still
--    distinguish a targeted narrowing from a blanket one — but it is no longer a
--    control across mechanisms. Do not cite it as one.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;

select is(
  (select count(id)::int from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'), 1,
  '3.1 CONTROL: the ORG admin still reads the profile after the void — the void narrows the affiliation leg, not person reads in general');

select is(
  (select count(id)::int from public.professional_credentials
    where user_id = '00000000-0000-0000-0000-0000000000d1'), 1,
  '3.2 CONTROL: ... and still reads the credential');

reset role;

select * from finish();
rollback;

-- AFF4 B1/B9 — the `organization_affiliations` SELECT policy audience (ADR 0151 D1).
--
-- WHY THIS SUITE EXISTS AND WHY IT EXISTS *NOW*. The AFF4 diff-scoped door sweep reported
-- `organization_affiliations.organization_affiliations_select` as **BLIND**: neutralizing
-- the policy to `true` made NOTHING fail. That is what a brand-new gate looks like before
-- anything asserts it, and under CLAUDE.md §6 step 1 a BLIND blocks the phase — it is
-- keystoned, never allowlisted, because this is a tenant-isolation policy and the
-- allowlist is only ever for an unreachable backstop.
--
-- ⚠ THE VACUITY TRAP THIS SUITE HAD TO AVOID, and it is not hypothetical here.
-- `organization_affiliations` holds ZERO rows until AFF4 B5 backfills and B7 seeds it. A
-- DENY assertion over an empty table passes whether the policy is enforced, neutralized,
-- or absent entirely — it would have "closed" the BLIND while measuring nothing at all.
-- Every persona below therefore reads against rows this suite INSERTS, and §0 asserts they
-- are there before any read is attempted.
--
-- ⚠ EVERY DENY IS PAIRED WITH A CONTROL. "Org admin B sees zero org-A rows" is equally
-- consistent with "org admin B cannot read this table at all" — so §3.2 proves B *does*
-- read its own org's row. A zero that is never contrasted with a one is not evidence of
-- isolation, only of silence.
--
-- ⚠ THE `active_role` TRAP, recorded because it cost a debugging round and will cost the
-- next author one too. `test_helpers.claims_for(user, is_admin)` derives the `active_role`
-- claim ONLY when the persona has EXACTLY ONE distinct live role; with two or more it
-- sets no claim at all, and `app.has_role` — and therefore `app.is_org_admin_of` — then
-- returns FALSE for someone who plainly holds the membership. `orgadmin.b` holds
-- `org_admin` AND a `staff_admin` seat, so the two-argument form silently denies him. The
-- THIRD argument is passed explicitly below for every admin persona, including the ones
-- that would auto-derive correctly today: a seed change that hands `orgadmin.a` a second
-- role would otherwise flip §2.1/§2.2 from ALLOW to DENY and the suite would still be
-- green, having quietly stopped testing the org-admin arm.
--
-- The subject persona takes the two-argument form deliberately — he has zero memberships,
-- so there is no role to assume and the self leg does not consult one.
--
-- The policy under test (measured from pg_policies, not from the migration):
--   ((principal_id = ( SELECT auth.uid() AS uid)) OR app.is_org_admin_of(organization_id))
-- Deliberately narrower than the `hospital_affiliations` sibling: there is no hospital
-- tier here, so no `is_hospital_admin_of` arm and no memberships-derived arm — which is
-- exactly what §4 pins.
--
-- Assertion count: 10

begin;
select plan(10);

create temp table k on commit drop as select
  '00000000-0000-0000-0000-0000000000d1'::uuid as subject_a,      -- novato.pendente, org A
  '00000000-0000-0000-0000-0000000000b3'::uuid as subject_b,      -- org-B person
  '00000000-0000-0000-0000-0000000000b1'::uuid as org_admin_a,
  '00000000-0000-0000-0000-0000000000b2'::uuid as org_admin_b,
  '00000000-0000-0000-0000-0000000000e1'::uuid as hosp_admin,     -- hospital_admin of central-a, NOT an org admin
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  '0c000000-0000-0000-0000-00000000000b'::uuid as org_b,
  'af000000-0000-0000-0000-00000000000a'::uuid as row_a,
  'af000000-0000-0000-0000-00000000000b'::uuid as row_b;
grant select on k to authenticated;
grant select on k to service_role;

-- ============================================================================
-- §0 PRECONDITIONS — the three ways this suite could go green measuring nothing.
-- ============================================================================

select is((select enabled from app.feature_flags where key = 'audit_trail'), true,
  '0.0 PRECONDITION: audit_trail is enabled (the org-affiliation audit trigger fires on every insert below)');

insert into public.organization_affiliations (id, principal_id, organization_id, started_on)
values
  ((select row_a from k), (select subject_a from k), (select org_a from k), current_date - 10),
  ((select row_b from k), (select subject_b from k), (select org_b from k), current_date - 10);

select is(
  (select count(*)::int from public.organization_affiliations where id in ((select row_a from k), (select row_b from k))), 2,
  '0.1 PRECONDITION (the vacuity guard): both fixture rows exist — the table is EMPTY until B5/B7, and a DENY over an empty table proves nothing');

select is(
  (select count(*)::int from public.organization_affiliations where principal_id = (select hosp_admin from k)), 0,
  '0.2 PRECONDITION: the hospital admin has NO org affiliation of his own, so §4.1 measures the org-admin arm and not the self arm');

select is(
  (select count(*)::int from public.memberships
    where principal_id = (select hosp_admin from k) and role = 'org_admin'), 0,
  '0.3 PRECONDITION: the hospital admin is not an org_admin anywhere (otherwise §4.1 would be denied for the wrong reason)');

-- ============================================================================
-- §1 SELF — a person reads their own employment record.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000d1', false);
set local role authenticated;
select is(
  (select count(id)::int from public.organization_affiliations), 1,
  '1.1 ALLOW (self): the subject reads their OWN org affiliation and nothing else');
reset role;

-- ============================================================================
-- §2 ORG ADMIN A — reads its own organization, and only its own.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false, 'org_admin');
set local role authenticated;

select is(
  (select count(id)::int from public.organization_affiliations
    where organization_id = '0c000000-0000-0000-0000-00000000000a'), 1,
  '2.1 ALLOW (org_admin): org admin A reads the affiliation in its own organization');

select is(
  (select count(id)::int from public.organization_affiliations
    where organization_id = '0c000000-0000-0000-0000-00000000000b'), 0,
  '2.2 ⭐ DENY (tenant isolation): org admin A reads ZERO rows of organization B');

reset role;

-- ============================================================================
-- §3 ORG ADMIN B — the mirror, with the control that makes §3.1's zero mean something.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b2', false, 'org_admin');
set local role authenticated;

select is(
  (select count(id)::int from public.organization_affiliations
    where organization_id = '0c000000-0000-0000-0000-00000000000a'), 0,
  '3.1 ⭐ DENY (tenant isolation, the mirror): org admin B reads ZERO rows of organization A');

select is(
  (select count(id)::int from public.organization_affiliations
    where organization_id = '0c000000-0000-0000-0000-00000000000b'), 1,
  '3.2 CONTROL: ... while reading its OWN organization''s row — so §3.1 is isolation, not an inability to read the table');

reset role;

-- ============================================================================
-- §4 HOSPITAL ADMIN — pins the ABSENCE of an arm. The hospital sibling policy grants a
--    hospital_admin four legs; this policy grants none, because there is no hospital tier
--    at the organization level. An absent arm is a decision, and it needs an assertion or
--    the next author "completes the pattern".
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false, 'hospital_admin');
set local role authenticated;
select is(
  (select count(id)::int from public.organization_affiliations), 0,
  '4.1 ⭐ DENY (no hospital-admin arm): a hospital_admin of an org-A hospital reads ZERO org affiliations — deliberately narrower than hospital_affiliations_select');
reset role;

select * from finish();
rollback;

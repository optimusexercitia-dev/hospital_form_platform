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
-- `organization_affiliations` held ZERO rows until AFF4 B7 seeded it. A DENY assertion over
-- an empty table passes whether the policy is enforced, neutralized, or absent entirely —
-- it would have "closed" the BLIND while measuring nothing at all. §0 therefore asserts
-- rows exist in BOTH organizations before any read is attempted.
--
-- ⭐ REWRITTEN AT B7 (2026-08-26), AND THE SUITE GOT STRONGER, NOT WEAKER. It used to
-- INSERT two fixture rows; B7's seed now gives every persona an active org affiliation, and
-- the fixture insert collided with `organization_affiliations_active_uq`. Rather than move
-- the fixture out of the way, the suite now reads the SEEDED population: each DENY is
-- contrasted against a real multi-row org instead of a single planted row, and each ALLOW
-- asserts the caller sees EXACTLY the rows that exist in its own org — a count captured
-- as `postgres` before any role switch, so "sees everything it should" and "sees nothing it
-- should not" are one assertion rather than a hardcoded number that rots with the seed.
--
-- ⚠ ONE PRECONDITION INVERTED, and it is recorded rather than quietly dropped: §0.2 used to
-- assert the hospital admin had NO org affiliation of his own, so §4.1's zero could only be
-- the org-admin arm. He now has one, like every other persona. §4 is therefore re-cut: he
-- reads EXACTLY his own row (the SELF arm, which this policy does grant) and ZERO belonging
-- to anyone else (the hospital-admin arm, which it does not). That is the same absence being
-- pinned, measured against a subject that now exists.
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
-- Assertion count: 11

begin;
select plan(11);

-- The counts are captured HERE, as `postgres`, before any `set local role` — inside a role
-- switch the policy is what is being measured, so it cannot also be the source of the
-- expected value. Capturing them makes each ALLOW an EXACT-SET assertion ("sees precisely
-- its own org's rows") rather than a hardcoded number that silently rots as the seed grows.
create temp table k on commit drop as select
  '00000000-0000-0000-0000-0000000000d1'::uuid as subject_a,      -- novato.pendente, org A
  '00000000-0000-0000-0000-0000000000b1'::uuid as org_admin_a,
  '00000000-0000-0000-0000-0000000000b2'::uuid as org_admin_b,
  '00000000-0000-0000-0000-0000000000e1'::uuid as hosp_admin,     -- hospital_admin of central-a, NOT an org admin
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  '0c000000-0000-0000-0000-00000000000b'::uuid as org_b,
  (select count(*)::int from public.organization_affiliations
    where organization_id = '0c000000-0000-0000-0000-00000000000a') as org_a_total,
  (select count(*)::int from public.organization_affiliations
    where organization_id = '0c000000-0000-0000-0000-00000000000b') as org_b_total;
grant select on k to authenticated;
grant select on k to service_role;

-- ============================================================================
-- §0 PRECONDITIONS — the ways this suite could go green measuring nothing.
-- ============================================================================

select cmp_ok(
  (select org_a_total from k), '>', 1,
  '0.0 PRECONDITION (the vacuity guard): organization A holds MORE THAN ONE org affiliation — a DENY over an empty table proves nothing, and a single planted row cannot tell "reads its org" from "reads one row"');

select cmp_ok(
  (select org_b_total from k), '>', 0,
  '0.1 PRECONDITION (the vacuity guard, the other side): organization B holds rows too — otherwise §2.2 and §3.1 deny access to nothing');

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select hosp_admin from k)
      and ended_on is null and voided_at is null), 1,
  '0.2 PRECONDITION: the hospital admin HAS exactly one org affiliation of his own — inverted at B7 (he used to have none), which is why §4 now separates the SELF arm from the absent hospital-admin arm instead of reading one zero');

select is(
  (select count(*)::int from public.memberships
    where principal_id = (select hosp_admin from k) and role = 'org_admin'), 0,
  '0.3 PRECONDITION: the hospital admin is not an org_admin anywhere (otherwise §4 would be allowed for the wrong reason)');

-- ============================================================================
-- §1 SELF — a person reads their own employment record.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000d1', false);
set local role authenticated;
select is(
  (select count(id)::int from public.organization_affiliations), 1,
  '1.1 ALLOW (self): the subject reads their OWN org affiliation and nothing else — an unqualified count, so any leak from the other 30-odd seeded rows reds here');
reset role;

-- ============================================================================
-- §2 ORG ADMIN A — reads its own organization, and only its own.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false, 'org_admin');
set local role authenticated;

select is(
  (select count(id)::int from public.organization_affiliations
    where organization_id = '0c000000-0000-0000-0000-00000000000a'),
  (select org_a_total from k),
  '2.1 ALLOW (org_admin): org admin A reads EXACTLY the affiliations in its own organization — the expected count was captured as postgres, so a policy that dropped rows and one that leaked them both red here');

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
    where organization_id = '0c000000-0000-0000-0000-00000000000b'),
  (select org_b_total from k),
  '3.2 CONTROL: ... while reading its OWN organization''s rows in full — so §3.1 is isolation, not an inability to read the table');

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
  (select count(id)::int from public.organization_affiliations
    where principal_id <> (select hosp_admin from k)), 0,
  '4.1 ⭐ DENY (no hospital-admin arm): a hospital_admin of an org-A hospital reads ZERO org affiliations belonging to ANYONE ELSE — deliberately narrower than hospital_affiliations_select, which grants him four legs');

select is(
  (select count(id)::int from public.organization_affiliations), 1,
  '4.2 CONTROL: ... while reading his OWN row through the SELF arm — so §4.1 is the missing hospital-admin arm, not an inability to read the table at all');
reset role;

select * from finish();
rollback;

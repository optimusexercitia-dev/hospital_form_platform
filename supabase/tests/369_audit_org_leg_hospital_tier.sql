-- AUD1 — an `org_admin` reads the HOSPITAL-TIER audit rows of its own organization.
-- ADR 0146 (amends ADR 0051). Migration 20261003002300.
--
-- THE DEFECT. `audit_log_select`'s org leg was `hospital_id IS NULL AND commission_id IS
-- NULL AND app.is_org_admin_of(organization_id)`. A HOSPITAL-TIER row (`hospital_id` set,
-- `commission_id` NULL) therefore fell through every leg for an org_admin: leg 3 wants
-- `is_hospital_admin_of`, which an org_admin is not, and leg 4 excluded the row on
-- `hospital_id IS NULL`. Commission-tier rows survive via leg 2 (`is_tenancy_admin_of`),
-- which is exactly why the audit surface looked populated and nobody noticed.
--
-- Measured on the seed before the migration (`orgadmin.a`, harness asserted
-- `is_org_admin_of = t`, `is_admin() = f`), scoping BOTH sides to org A:
--   commission tier  173 exist / 173 visible
--   hospital   tier   19 exist /   0 visible   ← total blindness, not a partial gap
--   org        tier   16 exist /  16 visible
-- The hidden rows were `membership.granted` (15) and `affiliation.created` (4) — the
-- hospital-scope governance events an org admin most needs to see.
--
-- ⭐ THE PLATFORM ALREADY DISAGREED WITH ITSELF, AND THE DOOR HELD THE INTENDED RULE.
-- `public.verify_audit_chain` is SECURITY DEFINER and its hospital arm reads
-- `is_hospital_admin_of(p_hospital) OR is_org_admin_of(<that hospital's org>)`. Probed
-- before the migration: an org_admin calling `verify_audit_chain(p_hospital := …)`
-- SUCCEEDS (`ok = t`) while reading those same rows returns ZERO. An org admin could
-- cryptographically attest that a hospital's audit chain was intact and not see a single
-- entry in it. This migration is therefore a RECONCILIATION, not a widening of intent:
-- RLS is being brought into line with an authorization decision the platform already
-- shipped. §2 pins both halves so they cannot drift apart again.
--
-- ⛔ LEG 5 IS DELIBERATELY UNTOUCHED *BY THIS MIGRATION*. The `is_admin()` leg keeps its
-- `organization_id IS NULL` bound — that is the platform-admin NOUN RULE (CLAUDE.md §1,
-- ADR 0078 A35): a platform_admin administers tenancy, never tenant CONTENT. §5 asserts it
-- still holds and §6.5 asserts the conjunct is still literally present, because "I changed
-- one leg and not the other" is only credible if something fails when the other one moves.
--
-- ⚠ AMENDED BY ADR 0147 / migration 20261003002400. The bound was right; the claim that
-- `organization_id IS NULL` EXPRESSED it was not. `app.audit_write` and
-- `public.verify_audit_chain` both define the platform chain as ALL THREE scope keys NULL,
-- so leg 5 checking only two of them admitted a malformed hospital-tier row (`hospital_id`
-- set, `organization_id` NULL) — which is what `app.trg_audit_standard_ownerships` was
-- writing. Leg 5 now also carries `hospital_id IS NULL`. §6.4 and §6.8 below were rewritten
-- for that; the behavioural arms in §5 are unchanged and still pass, because a WELL-FORMED
-- hospital-tier row never satisfied leg 5 in the first place. Test 370 owns the new half.
--
-- ⛔ FIXTURE DISCIPLINE: every id is FIXED and self-contained (the `0ad00146-` block),
-- never a seed persona and never `gen_random_uuid()`. Rows are created through
-- `app.audit_write` — the sanctioned DEFINER writer — never by direct INSERT, so the hash
-- chain stays valid and §2's `verify_audit_chain` arms mean something. Each admin persona
-- holds EXACTLY ONE membership so `test_helpers.claims_for` auto-derives its `active_role`;
-- a hatless fixture fails CLOSED, which reads as a correct DENY. §0 asserts the hats
-- resolved rather than trusting that.

begin;
select plan(29);

-- ===========================================================================
-- §0 Fixture + preconditions. Built as table owner, before any role switch.
-- ===========================================================================
insert into public.organizations (id, name, slug) values
  ('0ad00146-0000-0000-0000-00000000000a', 'AUD1 Rede O', 'aud1-rede-o'),
  ('0ad00146-0000-0000-0000-00000000000b', 'AUD1 Rede P', 'aud1-rede-p');

insert into public.hospitals (id, organization_id, name, slug) values
  ('0ad00146-0000-0000-0000-000000000011', '0ad00146-0000-0000-0000-00000000000a', 'AUD1 Hospital Um',   'aud1-hosp-um'),
  ('0ad00146-0000-0000-0000-000000000012', '0ad00146-0000-0000-0000-00000000000a', 'AUD1 Hospital Dois', 'aud1-hosp-dois'),
  ('0ad00146-0000-0000-0000-000000000013', '0ad00146-0000-0000-0000-00000000000b', 'AUD1 Hospital Pe',   'aud1-hosp-pe');

insert into public.commissions (id, name, slug, hospital_id, organization_id) values
  ('0ad00146-0000-0000-0000-000000000021', 'AUD1 Comissao Um', 'aud1-com-um',
   '0ad00146-0000-0000-0000-000000000011', '0ad00146-0000-0000-0000-00000000000a');

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', e, now(), now()
from (values
  ('0ad00146-0000-0000-0000-0000000000a1'::uuid, 'aud1.orgadmin.o@test.local'), -- org_admin of O
  ('0ad00146-0000-0000-0000-0000000000a2'::uuid, 'aud1.orgadmin.p@test.local'), -- org_admin of P
  ('0ad00146-0000-0000-0000-0000000000a3'::uuid, 'aud1.ha1@test.local'),        -- hospital_admin of H1
  ('0ad00146-0000-0000-0000-0000000000a4'::uuid, 'aud1.staff@test.local')       -- plain staff of C1
) as s(u, e);

update public.profiles set home_organization_id = '0ad00146-0000-0000-0000-00000000000a'
 where id in ('0ad00146-0000-0000-0000-0000000000a1','0ad00146-0000-0000-0000-0000000000a3',
              '0ad00146-0000-0000-0000-0000000000a4');
update public.profiles set home_organization_id = '0ad00146-0000-0000-0000-00000000000b'
 where id = '0ad00146-0000-0000-0000-0000000000a2';

-- Exactly ONE membership per persona (see the header).
insert into public.memberships (organization_id, principal_id, role) values
  ('0ad00146-0000-0000-0000-00000000000a', '0ad00146-0000-0000-0000-0000000000a1', 'org_admin'),
  ('0ad00146-0000-0000-0000-00000000000b', '0ad00146-0000-0000-0000-0000000000a2', 'org_admin');
insert into public.memberships (organization_id, hospital_id, principal_id, role) values
  ('0ad00146-0000-0000-0000-00000000000a', '0ad00146-0000-0000-0000-000000000011', '0ad00146-0000-0000-0000-0000000000a3', 'hospital_admin');
insert into public.memberships (commission_id, principal_id, role) values
  ('0ad00146-0000-0000-0000-000000000021', '0ad00146-0000-0000-0000-0000000000a4', 'staff');

-- Audit rows, one per tier, through the sanctioned DEFINER writer.
-- HOSPITAL tier at H1 — ⭐ the subject.
select app.audit_write('aud1.hospital.h1', 'hospital', '0ad00146-0000-0000-0000-000000000011', null,
  'AUD1 hospital-tier row at H1', '{}'::jsonb,
  '0ad00146-0000-0000-0000-00000000000a', '0ad00146-0000-0000-0000-000000000011');
-- HOSPITAL tier at H2 — the SIBLING, proving the org leg spans the whole org.
select app.audit_write('aud1.hospital.h2', 'hospital', '0ad00146-0000-0000-0000-000000000012', null,
  'AUD1 hospital-tier row at H2', '{}'::jsonb,
  '0ad00146-0000-0000-0000-00000000000a', '0ad00146-0000-0000-0000-000000000012');
-- HOSPITAL tier in the OTHER ORG — the cross-org deny subject / §3.2 control.
select app.audit_write('aud1.hospital.hp', 'hospital', '0ad00146-0000-0000-0000-000000000013', null,
  'AUD1 hospital-tier row at HP', '{}'::jsonb,
  '0ad00146-0000-0000-0000-00000000000b', '0ad00146-0000-0000-0000-000000000013');
-- ORG tier in O (leg 4's original population) and COMMISSION tier in C1 (leg 2).
select app.audit_write('aud1.org.o', 'organization', '0ad00146-0000-0000-0000-00000000000a', null,
  'AUD1 org-tier row', '{}'::jsonb, '0ad00146-0000-0000-0000-00000000000a', null);
select app.audit_write('aud1.commission.c1', 'commission', '0ad00146-0000-0000-0000-000000000021',
  '0ad00146-0000-0000-0000-000000000021', 'AUD1 commission-tier row', '{}'::jsonb, null, null);
-- PLATFORM tier (all scope keys NULL) — leg 5's population.
-- ⚠ `entity_id` is NOT NULL — the PLATFORM tier is defined by all three SCOPE keys
-- (organization/hospital/commission) being NULL, never by a null entity. Passing null here
-- aborts the file with a constraint error, which prove reports as "27/27 failed": an ERROR,
-- not a discriminating red. Caught on this file's first run.
select app.audit_write('aud1.platform', 'platform', '0ad00146-0000-0000-0000-0000000000ff', null,
  'AUD1 platform-tier row', '{}'::jsonb, null, null);

-- GROUND TRUTH for §2.2, captured as table owner (RLS off) BEFORE any role switch.
-- ⚠ NOT a hardcoded count. The fixture's own `insert into memberships` emits a
-- `membership.granted` HOSPITAL-TIER audit row at H1 through the audit trigger, so this
-- chain holds 2 rows, not the 1 the file explicitly writes. That is not fixture noise —
-- it is the very class of row the defect hid (15 of the 19 hidden seed rows were
-- `membership.granted`). Comparing against a captured count asserts COMPLETENESS — the
-- caller sees ALL of them — and cannot drift as triggers are added.
create temp table chain_truth on commit drop as
select count(*)::int as h1_hospital_tier_rows
  from public.audit_log
 where hospital_id = '0ad00146-0000-0000-0000-000000000011' and commission_id is null;
grant select on chain_truth to authenticated;

select cmp_ok(
  (select h1_hospital_tier_rows from chain_truth), '>=', 2,
  '0.0 PRECONDITION: the H1 hospital chain holds at least 2 rows — the one this file writes plus the membership.granted row the fixture''s own hospital-tier membership emits. §2.2 compares against this, so it must be a real population rather than a single row');

-- Preconditions, asserted rather than assumed. 0.1 is load-bearing: the widened leg keys
-- on `organization_id`, so a hospital-tier row with a NULL org would still be invisible
-- and §1 would be measuring a fixture accident rather than the policy.
select is(
  (select count(*)::int from public.audit_log
    where action = 'aud1.hospital.h1'
      and commission_id is null and hospital_id is not null and organization_id is not null), 1,
  '0.1 PRECONDITION: the H1 row is genuinely HOSPITAL-TIER (commission NULL, hospital set) AND carries a non-null organization_id — the column the widened leg keys on');

select is(
  (select count(*)::int from public.audit_log where action = 'aud1.org.o'
    and commission_id is null and hospital_id is null), 1,
  '0.2 PRECONDITION: the org-tier row is genuinely ORG-TIER (hospital AND commission NULL) — so §4.4 distinguishes the two tiers rather than one shape');

select test_helpers.claims_for('0ad00146-0000-0000-0000-0000000000a1');
set local role authenticated;
select ok(
  app.is_org_admin_of('0ad00146-0000-0000-0000-00000000000a')
  and not app.is_admin()
  and not app.is_hospital_admin_of('0ad00146-0000-0000-0000-000000000011'),
  '0.3 PRECONDITION: O''s org_admin hat RESOLVED, and it is NEITHER a platform_admin NOR a hospital_admin of H1 — so every ALLOW in §1 passes through the widened org leg, not leg 3 or leg 5');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for('0ad00146-0000-0000-0000-0000000000a3');
set local role authenticated;
select ok(
  app.is_hospital_admin_of('0ad00146-0000-0000-0000-000000000011')
  and not app.is_org_admin_of('0ad00146-0000-0000-0000-00000000000a'),
  '0.4 PRECONDITION: HA1''s hat RESOLVED as hospital_admin of H1 and NOT an org_admin — §4 therefore measures leg 3 in isolation');
select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §1 ⭐ THE NEW BEHAVIOUR. Every arm here is RED before migration 20261003002300.
-- ===========================================================================
select test_helpers.claims_for('0ad00146-0000-0000-0000-0000000000a1');
set local role authenticated;

select is(
  (select count(*)::int from public.audit_log where action = 'aud1.hospital.h1'), 1,
  '1.1 ⭐ KEYSTONE: O''s org_admin reads the HOSPITAL-TIER audit row of a hospital in its org. This is the row `/o/[org]/manage/audit` has never shown');

select is(
  (select count(*)::int from public.audit_log where action = 'aud1.hospital.h2'), 1,
  '1.2 ⭐ ... and the SIBLING hospital''s row too. The leg is ORG-wide: an org_admin administers every hospital in its org, so a fix reaching only one hospital would be wrong');

select is(
  (select summary from public.audit_log where action = 'aud1.hospital.h1'),
  'AUD1 hospital-tier row at H1',
  '1.3 ... and the row CONTENT is readable, not merely its existence — the audit table renders a summary, not a count');

select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §2 THE DOOR AND THE POLICY, RECONCILED. 2.1 was already true and is pinned so the
-- door's rule cannot quietly narrow; 2.2 is the half this migration adds.
-- ===========================================================================
select test_helpers.claims_for('0ad00146-0000-0000-0000-0000000000a1');
set local role authenticated;

select ok(
  (select ok from public.verify_audit_chain(null, null, '0ad00146-0000-0000-0000-000000000011')),
  '2.1 the SECURITY DEFINER door already lets an org_admin VERIFY the H1 hospital chain (its hospital arm reads is_hospital_admin_of OR is_org_admin_of). True before this migration — pinned so the door and the policy cannot drift apart again');

select is(
  (select count(*)::int from public.audit_log
    where hospital_id = '0ad00146-0000-0000-0000-000000000011' and commission_id is null),
  (select h1_hospital_tier_rows from chain_truth),
  '2.2 ⭐ THE CONTRADICTION CLOSED: the same caller now reads EVERY row of the chain it was already permitted to ATTEST — compared against the owner-visible count, not a hardcoded number, so this asserts completeness. Before the migration it verified this chain and saw ZERO of its rows');

select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §3 DENY — the leg is ORG-scoped. Each deny is paired with a control on the SAME
-- session, or its zero is indistinguishable from a broken hat or a missing row.
-- ===========================================================================
select test_helpers.claims_for('0ad00146-0000-0000-0000-0000000000a2');
set local role authenticated;

select is(
  (select count(*)::int from public.audit_log
    where action in ('aud1.hospital.h1','aud1.hospital.h2','aud1.org.o','aud1.commission.c1')), 0,
  '3.1 DENY (CROSS-ORG): P''s org_admin reads NONE of org O''s rows at any tier. Widening the org leg must not weaken tenant isolation');

select is(
  (select count(*)::int from public.audit_log where action = 'aud1.hospital.hp'), 1,
  '3.2 ⭐ THE CONTROL THAT MAKES 3.1 MEAN ANYTHING: the SAME session DOES read the hospital-tier row of its OWN org — so 3.1''s zero is about the tenant boundary, not a dead session, and the widening is proven on a second org rather than special-cased to O');

select test_helpers.reset_role_and_claims();

select test_helpers.claims_for('0ad00146-0000-0000-0000-0000000000a4');
set local role authenticated;
select ok(
  app.is_member_of('0ad00146-0000-0000-0000-000000000021'),
  '3.3 CONTROL FOR 3.4: the plain-staff session is LIVE — its commission membership predicate resolves true. `audit_log` admits no staff leg at all, so this hat check is the only available proof that 3.4''s zero is about the policy rather than an unset claim');
select is(
  (select count(*)::int from public.audit_log
    where action in ('aud1.hospital.h1','aud1.org.o','aud1.commission.c1')), 0,
  '3.4 DENY: a plain STAFF member of C1 reads nothing at any tier — the widening must not reach below the admin tiers');
select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §4 hospital_admin visibility is UNCHANGED. Leg 3 was not touched, and the widened
-- leg 4 must not hand a hospital_admin anything new either.
-- ===========================================================================
select test_helpers.claims_for('0ad00146-0000-0000-0000-0000000000a3');
set local role authenticated;

select is(
  (select count(*)::int from public.audit_log where action = 'aud1.hospital.h1'), 1,
  '4.1 REGRESSION (leg 3): HA1 still reads its OWN hospital-tier row');

select is(
  (select count(*)::int from public.audit_log where action = 'aud1.hospital.h2'), 0,
  '4.2 REGRESSION (leg 3 stays HOSPITAL-bounded): HA1 reads ZERO of the SIBLING hospital''s rows. The org leg widened; leg 3 did not, so a hospital admin gains nothing org-wide');

select is(
  (select count(*)::int from public.audit_log where action = 'aud1.commission.c1'), 1,
  '4.3 REGRESSION (leg 2): HA1 still reads its hospital''s COMMISSION-tier row via is_tenancy_admin_of');

select is(
  (select count(*)::int from public.audit_log where action = 'aud1.org.o'), 0,
  '4.4 ⭐ THE WIDENED LEG DID NOT LOSE ITS ROLE CHECK: HA1 reads ZERO ORG-TIER rows. Removing `hospital_id IS NULL` must not turn leg 4 into "any admin of anything in this org" — it still requires is_org_admin_of');

select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §5 ⛔ THE PLATFORM-ADMIN LEG, DELIBERATELY NOT TOUCHED (the noun rule).
-- ===========================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b0', true);
set local role authenticated;

select is(
  (select count(*)::int from public.audit_log where action = 'aud1.platform'), 1,
  '5.1 REGRESSION (leg 5): a platform_admin still reads the PLATFORM-tier row (all scope keys NULL)');

select is(
  (select count(*)::int from public.audit_log
    where action in ('aud1.hospital.h1','aud1.hospital.h2','aud1.hospital.hp')), 0,
  '5.2 ⭐ THE NOUN RULE HOLDS: a platform_admin reads ZERO TENANT hospital-tier rows. Leg 5''s `organization_id IS NULL` bound is what forbids this, and it was left in place on purpose — widening it the way leg 4 was widened would hand platform_admin tenant CONTENT (CLAUDE.md §1, ADR 0078 A35)');

select is(
  (select count(*)::int from public.audit_log
    where action in ('aud1.org.o','aud1.commission.c1')), 0,
  '5.3 ... and zero tenant org-tier and commission-tier rows either');

select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §6 STRUCTURE. The behavioural arms cannot tell "leg 4 widened" from "leg 5 widened
-- too" — §5.2 would catch the latter, but only for this fixture's rows. These pin the
-- predicate itself, in BOTH directions: what moved, and what did not.
-- ===========================================================================
select is(
  (select count(*)::int from pg_policy pol join pg_class c on c.oid = pol.polrelid
    where c.relname = 'audit_log'), 1,
  '6.1 `audit_log` still carries EXACTLY ONE policy — a second permissive SELECT policy would widen reads while every arm above stayed green');

select is(
  (select pol.polcmd::text from pg_policy pol join pg_class c on c.oid = pol.polrelid
    where c.relname = 'audit_log'), 'r',
  '6.2 ... and it is still SELECT-only. Audit WRITES stay off the RLS path — `authenticated` holds SELECT only and every write goes through the DEFINER writer (Rule 11, append-only)');

select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'audit_log'),
  '6.3 ... and RLS is still ENABLED — without this every DENY above measures nothing (Architecture Rule 1)');

-- ⚠ 6.4 WAS `qual NOT LIKE '%hospital_id IS NULL%'` over the WHOLE predicate. ADR 0147 put
-- that string on leg 5 legitimately, so the old form reds on a correct policy. It was
-- rewritten LEG-SCOPED rather than relaxed, and the replacement is STRICTLY STRONGER: the
-- old `NOT LIKE` also passed if leg 4 were deleted outright, this one requires leg 4 to be
-- literally present in the right shape. Verified by mutation both ways — restoring leg 4's
-- conjunct reds 6.4, removing leg 5's reds 6.8.
select ok(
  (select qual from pg_policies where tablename = 'audit_log' and policyname = 'audit_log_select')
    like '%((commission_id IS NULL) AND app.is_org_admin_of(organization_id))%',
  '6.4 ⭐ leg 4 — the ORG leg — carries `commission_id IS NULL` and NO hospital conjunct. This is the single edit this migration makes, pinned as the whole leg: a bare substring test cannot tell which leg the conjunct sits on, and "which leg" is the entire difference between the bug and the boundary');

select ok(
  (select qual from pg_policies where tablename = 'audit_log' and policyname = 'audit_log_select')
    like '%(organization_id IS NULL)%',
  '6.5 ⭐ ... while leg 5''s `organization_id IS NULL` bound is STILL PRESENT. "I widened one leg and deliberately not the other" is only a credible claim if something fails when the other one moves — this is that something');

select ok(
  (select qual from pg_policies where tablename = 'audit_log' and policyname = 'audit_log_select')
    like '%is_org_admin_of%',
  '6.6 the org leg still gates on `app.is_org_admin_of` — a rewrite that dropped the role check would make §1 pass for the wrong reason');

select ok(
  (select qual from pg_policies where tablename = 'audit_log' and policyname = 'audit_log_select')
    like '%is_staff_admin_of%'
  and (select qual from pg_policies where tablename = 'audit_log' and policyname = 'audit_log_select')
    like '%is_tenancy_admin_of%'
  and (select qual from pg_policies where tablename = 'audit_log' and policyname = 'audit_log_select')
    like '%is_hospital_admin_of%',
  '6.7 REGRESSION: legs 1-3 survived the re-emission. `alter policy` replaces the WHOLE using expression, so a leg lost in transcription would be invisible to arms that never exercise it');

select ok(
  (select qual from pg_policies where tablename = 'audit_log' and policyname = 'audit_log_select')
    like '%((organization_id IS NULL) AND (hospital_id IS NULL) AND (commission_id IS NULL) AND app.is_admin())%',
  '6.8 ⭐ (ADR 0147) leg 5 carries the FULL platform-chain shape — all three scope keys NULL, exactly as `app.audit_write` and `public.verify_audit_chain` define that chain. 6.5 above pins only the `organization_id` half, which was true while the leg was still too wide; this is the arm that reds if the `hospital_id` bound is removed again');

select * from finish();
rollback;

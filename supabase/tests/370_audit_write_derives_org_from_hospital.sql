-- ADR 0147 (amends 0146) — `app.audit_write` derives the organization from the hospital,
-- and leg 5 of `audit_log_select` expresses the PLATFORM CHAIN exactly.
-- Migration 20261003002400.
--
-- THE DEFECT (two halves, one root cause).
-- `app.audit_write` derived org+hospital from `p_commission` when one was supplied, but on
-- the HOSPITAL branch it used `v_org := p_organization` verbatim — no derivation. Every
-- caller compensated by hand (`v_org := app.org_of_hospital(<the same hospital>)`, nine
-- functions, plus three deriving inline) except one:
-- `app.trg_audit_standard_ownerships` passes `p_hospital => new.hospital_id` at all three
-- of its call sites and never passes `p_organization`. Its rows land
-- `organization_id IS NULL`.
--
-- Measured before this migration, calling the writer with the trigger's exact arguments
-- (rolled back, hats asserted, sole offender confirmed by sweeping all 179 `audit_write`
-- callers in `pg_proc`):
--
--   org_admin of that hospital's org  sees 0   ← ADR 0146's superset Consequence, falsified
--   hospital_admin of that hospital   sees 1
--   platform_admin                    sees 1   ← ⭐ the half nobody flagged, and the worse one
--
-- ⭐ WHY THE platform_admin ROW IS THE WORSE HALF. Leg 5 reads
-- `(organization_id IS NULL) AND (commission_id IS NULL) AND app.is_admin()` — it carries
-- NO `hospital_id IS NULL` conjunct, so a NULL-org HOSPITAL-TIER row satisfies it and a
-- platform_admin reads tenant audit CONTENT. That is precisely what test 369 §5.2 asserts
-- cannot happen; 369 passes only because its fixture guarantees a non-null org (369 §0.1
-- asserts that guarantee explicitly). The fixture was well-formed. The platform was not.
--
-- ⛔ TWO FIXES, DIFFERENT REACH — and the difference is the point of §4.
--   WRITE side (`audit_write` derives)  — FORWARD-ONLY. No backfill is possible: `v_org`
--     feeds `app.audit_canonical` → the sha256 `row_hash`, and rows chain on `prev_hash`.
--     Rewriting `organization_id` on an existing row would invalidate its hash and break
--     the tamper-evident chain (Rule 11) — the exact property `verify_audit_chain` exists
--     to prove. Pre-existing NULL-org rows stay invisible to their org admin permanently.
--   READ side (leg 5 gains `hospital_id IS NULL`) — RETROACTIVE. It is a predicate change
--     and touches no data, so it closes the platform_admin half for those same pre-existing
--     rows. §4.2 is that half, and its fixture models a legacy row rather than asserting
--     about one that no longer occurs.
--
-- ⛔ FIXTURE DISCIPLINE (369's, kept): every id is FIXED and self-contained (the
-- `0be00147-` block), never a seed persona and never `gen_random_uuid()`. Rows are created
-- through `app.audit_write` — the sanctioned DEFINER writer — never by direct INSERT, so
-- every hash chain stays valid and §3 means something. Each admin persona holds EXACTLY
-- ONE membership so `test_helpers.claims_for` auto-derives its `active_role`; a hatless
-- fixture fails CLOSED, which reads as a correct DENY, so §0 asserts the hats resolved.

begin;
select plan(22);

-- ===========================================================================
-- §0 Fixture + preconditions. Built as table owner, before any role switch.
-- ===========================================================================
insert into public.organizations (id, name, slug) values
  ('0be00147-0000-0000-0000-00000000000a', 'A147 Rede O', 'a147-rede-o'),
  ('0be00147-0000-0000-0000-00000000000b', 'A147 Rede P', 'a147-rede-p');

insert into public.hospitals (id, organization_id, name, slug) values
  ('0be00147-0000-0000-0000-000000000011', '0be00147-0000-0000-0000-00000000000a', 'A147 Hospital Um',   'a147-hosp-um'),
  ('0be00147-0000-0000-0000-000000000012', '0be00147-0000-0000-0000-00000000000a', 'A147 Hospital Dois', 'a147-hosp-dois'),
  ('0be00147-0000-0000-0000-000000000013', '0be00147-0000-0000-0000-00000000000b', 'A147 Hospital Pe',   'a147-hosp-pe');

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', e, now(), now()
from (values
  ('0be00147-0000-0000-0000-0000000000a1'::uuid, 'a147.orgadmin.o@test.local'), -- org_admin of O
  ('0be00147-0000-0000-0000-0000000000a2'::uuid, 'a147.ha1@test.local'),        -- hospital_admin of H1
  ('0be00147-0000-0000-0000-0000000000a3'::uuid, 'a147.orgadmin.p@test.local')  -- org_admin of P
) as s(u, e);

update public.profiles set home_organization_id = '0be00147-0000-0000-0000-00000000000a'
 where id in ('0be00147-0000-0000-0000-0000000000a1','0be00147-0000-0000-0000-0000000000a2');
update public.profiles set home_organization_id = '0be00147-0000-0000-0000-00000000000b'
 where id = '0be00147-0000-0000-0000-0000000000a3';

-- Exactly ONE membership per persona (see the header).
insert into public.memberships (organization_id, principal_id, role) values
  ('0be00147-0000-0000-0000-00000000000a', '0be00147-0000-0000-0000-0000000000a1', 'org_admin'),
  ('0be00147-0000-0000-0000-00000000000b', '0be00147-0000-0000-0000-0000000000a3', 'org_admin');
insert into public.memberships (organization_id, hospital_id, principal_id, role) values
  ('0be00147-0000-0000-0000-00000000000a', '0be00147-0000-0000-0000-000000000011', '0be00147-0000-0000-0000-0000000000a2', 'hospital_admin');

-- ⚠ 0.1 GUARDS EVERY OTHER ARM. `app.audit_write` RETURNS EARLY, silently, when the
-- `audit_trail` flag is off — no row, no error. With the flag off the DENY arms would all
-- pass on an empty table and read as a correct boundary.
select ok(
  app.feature_enabled('audit_trail'),
  '0.1 PRECONDITION: the `audit_trail` flag is ENABLED. `app.audit_write` returns early and silently when it is not, which would make every DENY arm below pass against an empty table');

select test_helpers.claims_for('0be00147-0000-0000-0000-0000000000a1');
set local role authenticated;
select ok(
  app.is_org_admin_of('0be00147-0000-0000-0000-00000000000a')
  and not app.is_admin()
  and not app.is_hospital_admin_of('0be00147-0000-0000-0000-000000000011'),
  '0.2 PRECONDITION: O''s org_admin hat RESOLVED, and it is NEITHER a platform_admin NOR a hospital_admin of H1 — so §2.1''s ALLOW passes through the org leg, not leg 3 or leg 5');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for('0be00147-0000-0000-0000-0000000000a2');
set local role authenticated;
select ok(
  app.is_hospital_admin_of('0be00147-0000-0000-0000-000000000011')
  and not app.is_org_admin_of('0be00147-0000-0000-0000-00000000000a'),
  '0.3 PRECONDITION: HA1''s hat RESOLVED as hospital_admin of H1 and NOT an org_admin — §2.2 therefore measures leg 3 in isolation');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b0', true);
set local role authenticated;
select ok(
  app.is_admin(),
  '0.4 PRECONDITION: the platform_admin hat RESOLVED (`app.is_admin` also requires ACTING AS platform_admin — ADR 0106 D11). Without this §2.3 and §4.2 would be zeroes produced by a hatless session, not by leg 5');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for('0be00147-0000-0000-0000-0000000000a3');
set local role authenticated;
select ok(
  app.is_org_admin_of('0be00147-0000-0000-0000-00000000000b')
  and not app.is_org_admin_of('0be00147-0000-0000-0000-00000000000a'),
  '0.5 PRECONDITION: P''s org_admin hat RESOLVED for its OWN org and NOT for O — §2.4''s zero is then about the tenant boundary');
select test_helpers.reset_role_and_claims();

-- ---------------------------------------------------------------------------
-- The audit rows. Written through the sanctioned DEFINER writer.
-- The two H1 rows are written BACK TO BACK and in this order, because §3.1/§3.2
-- compare them as consecutive links of the same chain.
-- ---------------------------------------------------------------------------

-- (a) hospital tier at H1, org passed EXPLICITLY — the well-formed shape every other
--     caller produces. §3's chain anchor.
select app.audit_write('a147.explicit.h1', 'hospital', '0be00147-0000-0000-0000-000000000011', null,
  'A147 explicit-org hospital-tier row at H1', '{}'::jsonb,
  '0be00147-0000-0000-0000-00000000000a', '0be00147-0000-0000-0000-000000000011');

-- (b) ⭐ THE SUBJECT: hospital tier at H1 written EXACTLY as
--     `app.trg_audit_standard_ownerships` writes it — `p_hospital` by keyword, no
--     `p_organization` at all. Before this migration this row lands org NULL.
select app.audit_write('a147.derived.h1', 'standard_ownership', '0be00147-0000-0000-0000-0000000000f1', null,
  'A147 trigger-shaped hospital-tier row at H1', '{}'::jsonb,
  p_hospital => '0be00147-0000-0000-0000-000000000011');

-- (c) an explicit org that DISAGREES with the hospital's own org, at H2. The fix is a
--     `coalesce`, not an override: it adds derivation and deliberately adds no validation.
select app.audit_write('a147.caller.wins', 'hospital', '0be00147-0000-0000-0000-000000000012', null,
  'A147 caller-supplied foreign org at H2', '{}'::jsonb,
  '0be00147-0000-0000-0000-00000000000b', '0be00147-0000-0000-0000-000000000012');

-- (d) hospital tier in the OTHER org — §2.5's control.
select app.audit_write('a147.hospital.p3', 'hospital', '0be00147-0000-0000-0000-000000000013', null,
  'A147 hospital-tier row at HP', '{}'::jsonb,
  '0be00147-0000-0000-0000-00000000000b', '0be00147-0000-0000-0000-000000000013');

-- (e) org tier at O — §3.4 proves the derived row did NOT migrate onto this chain.
select app.audit_write('a147.org.o', 'organization', '0be00147-0000-0000-0000-00000000000a', null,
  'A147 org-tier row', '{}'::jsonb, '0be00147-0000-0000-0000-00000000000a', null);

-- (f) PLATFORM tier — all three SCOPE keys NULL. Leg 5's legitimate population.
select app.audit_write('a147.platform', 'platform', '0be00147-0000-0000-0000-0000000000ff', null,
  'A147 platform-tier row', '{}'::jsonb, null, null);

-- (g) ⭐ THE LEGACY SHAPE, built honestly. After the write-side fix a hospital-tier row can
--     only still land org-NULL when `app.org_of_hospital` returns NULL — i.e. the hospital
--     id does not resolve. `audit_log.hospital_id` carries NO foreign key (verified in the
--     live catalog), so a phantom hospital reproduces the pre-existing production shape
--     through the real writer, without a direct INSERT that would break a hash chain.
--     It doubles as the fail-closed proof: the writer INVENTS no org.
select app.audit_write('a147.legacy.orphan', 'standard_ownership', '0be00147-0000-0000-0000-0000000000f2', null,
  'A147 legacy NULL-org hospital-tier row', '{}'::jsonb,
  p_hospital => '0be00147-0000-0000-0000-00000000dead');

-- ===========================================================================
-- §1 ⭐ THE WRITE-SIDE CLASS FIX. 1.1 is RED before migration 20261003002400.
-- ===========================================================================
select is(
  (select organization_id from public.audit_log where action = 'a147.derived.h1'),
  '0be00147-0000-0000-0000-00000000000a'::uuid,
  '1.1 ⭐ KEYSTONE: a hospital-tier write that passes NO `p_organization` — the shape `app.trg_audit_standard_ownerships` uses at all three of its call sites — now lands carrying the hospital''s own organization. Before this migration it landed NULL');

select ok(
  (select hospital_id is not null and commission_id is null
     from public.audit_log where action = 'a147.derived.h1'),
  '1.2 ... and the row is STILL HOSPITAL-TIER (hospital set, commission NULL). Populating `organization_id` must not re-tier the row — the chain is chosen on hospital/commission and this is the arm that says so behaviourally');

select is(
  (select organization_id from public.audit_log where action = 'a147.caller.wins'),
  '0be00147-0000-0000-0000-00000000000b'::uuid,
  '1.3 the fix is a COALESCE, not an override: an explicitly-passed organization survives even when it disagrees with the hospital''s own org. The change adds DERIVATION and deliberately adds NO VALIDATION — a caller that lies is out of scope here, and no current caller does (all 179 `audit_write` callers swept)');

-- ===========================================================================
-- §2 ⭐ THE READ CONSEQUENCE. 2.1 and 2.3 are RED before the migration.
-- ===========================================================================
select test_helpers.claims_for('0be00147-0000-0000-0000-0000000000a1');
set local role authenticated;
select is(
  (select count(*)::int from public.audit_log where action = 'a147.derived.h1'), 1,
  '2.1 ⭐ KEYSTONE: O''s org_admin READS the trigger-shaped row. This is ADR 0146''s "an org_admin''s audit reach is a superset of each of its hospital admins''" — which was FALSE for this action class before the fix, because the widened leg 4 keys on `organization_id` and the row had none');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for('0be00147-0000-0000-0000-0000000000a2');
set local role authenticated;
select is(
  (select count(*)::int from public.audit_log where action = 'a147.derived.h1'), 1,
  '2.2 CONTROL + REGRESSION (leg 3): the hospital_admin of H1 read this row BEFORE the fix and still reads it. Its 1 is what made the org admin''s 0 an INVERSION rather than a row nobody could see');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b0', true);
set local role authenticated;
select is(
  (select count(*)::int from public.audit_log where action = 'a147.derived.h1'), 0,
  '2.3 ⭐ KEYSTONE (the half nobody flagged): a platform_admin reads ZERO of this TENANT hospital-tier row. Before the fix its NULL `organization_id` satisfied leg 5''s `organization_id IS NULL` and a platform admin read tenant CONTENT — the noun rule (CLAUDE.md §1, ADR 0078 A35) that test 369 §5.2 believes it pins');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for('0be00147-0000-0000-0000-0000000000a3');
set local role authenticated;
select is(
  (select count(*)::int from public.audit_log
    where action in ('a147.derived.h1','a147.explicit.h1','a147.org.o')), 0,
  '2.4 DENY (CROSS-ORG): P''s org_admin reads NONE of org O''s rows. Populating `organization_id` must widen the row to its OWN org only. (`a147.caller.wins` is deliberately excluded — it carries org P by its caller''s own explicit argument, which is §1.3''s subject, not a tenancy failure)');
select is(
  (select count(*)::int from public.audit_log where action = 'a147.hospital.p3'), 1,
  '2.5 ⭐ THE CONTROL THAT MAKES 2.4 MEAN ANYTHING: the SAME session DOES read the hospital-tier row of its OWN org — so 2.4''s zero is about the tenant boundary, not a dead session');
select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §3 ⭐ CHAIN NEUTRALITY. The derivation must not move a row between chains, perturb
-- `seq`, or break `prev_hash` linkage — `v_org` feeds the row hash, so "it only adds a
-- column value" is exactly the kind of claim that has to be measured.
-- ===========================================================================
select is(
  (select b.seq - a.seq
     from public.audit_log a, public.audit_log b
    where a.action = 'a147.explicit.h1' and b.action = 'a147.derived.h1'),
  1::bigint,
  '3.1 ⭐ the derived row is the IMMEDIATE NEXT link of the SAME H1 hospital chain — `seq` advanced by exactly one over the explicit-org row written just before it. `audit_write` selects the hospital chain on `hospital_id = v_hospital and commission_id is null`, which never reads `organization_id`, and the `elsif v_hospital is not null` arm is tested BEFORE the `elsif v_org is not null` arm. This is that argument, measured');

select ok(
  (select b.prev_hash = a.row_hash
     from public.audit_log a, public.audit_log b
    where a.action = 'a147.explicit.h1' and b.action = 'a147.derived.h1'),
  '3.2 ... and its `prev_hash` is the previous row''s `row_hash`. The link is intact, not merely adjacent');

-- ⚠ `verify_audit_chain` is a DEFINER DOOR with its own gate: its hospital arm demands
-- `is_hospital_admin_of(p_hospital) OR is_org_admin_of(<that hospital's org>)`. Called as
-- the table OWNER it raises 42501 and ABORTS the file — which reads as "10/22 failed",
-- not as a discriminating red. Caught on this file's first run. HA1 is used rather than
-- O's org_admin because its arm of the door holds regardless of the org derivation under
-- test, so 3.3 measures the CHAIN and not the door.
select test_helpers.claims_for('0be00147-0000-0000-0000-0000000000a2');
set local role authenticated;
select ok(
  (select ok from public.verify_audit_chain(null, null, '0be00147-0000-0000-0000-000000000011')),
  '3.3 ⭐ `verify_audit_chain` accepts the whole H1 hospital chain. The chain identity it enumerates (`hospital_id = X and commission_id is null`) also never reads `organization_id`, and it recomputes each hash from the row''s OWN stored columns — which is precisely why a BACKFILL would break it and this forward-only fix does not');

select test_helpers.reset_role_and_claims();

select is(
  (select count(*)::int from public.audit_log
    where organization_id = '0be00147-0000-0000-0000-00000000000a'
      and hospital_id is null and commission_id is null
      and action = 'a147.derived.h1'), 0,
  '3.4 ... and the now-org-bearing row did NOT migrate onto the ORG chain. `verify_audit_chain` enumerates the org chain as `organization_id = X and hospital_id IS NULL and commission_id IS NULL`; a row that gained an org while keeping its hospital must stay out of it or the org chain''s hashes would no longer replay');

-- ===========================================================================
-- §4 ⭐ THE PLATFORM-CHAIN BOUND (leg 5). This is the RETROACTIVE half — a predicate
-- change, so unlike the write fix it reaches rows that already exist.
-- ===========================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b0', true);
set local role authenticated;

select is(
  (select count(*)::int from public.audit_log where action = 'a147.platform'), 1,
  '4.1 REGRESSION: a platform_admin still reads the genuine PLATFORM-TIER row (all three scope keys NULL). Narrowing leg 5 must cost it nothing it was meant to have');

select is(
  (select count(*)::int from public.audit_log where action = 'a147.legacy.orphan'), 0,
  '4.2 ⭐ KEYSTONE: a platform_admin reads ZERO of a MALFORMED hospital-tier row (hospital set, organization NULL) — the shape pre-existing production rows already carry and which no backfill may repair. Leg 5''s new `hospital_id IS NULL` conjunct is what excludes it; without that conjunct leg 5 is broader than the platform chain `app.audit_write` and `public.verify_audit_chain` both define as ALL THREE scope keys NULL');
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for('0be00147-0000-0000-0000-0000000000a1');
set local role authenticated;
select is(
  (select count(*)::int from public.audit_log where action = 'a147.legacy.orphan'), 0,
  '4.3 ... and NOBODY ELSE reads it either: the org_admin of O is denied too, because the row names no organization for leg 4 to key on. The malformed row FAILS CLOSED — stated so the next reader knows 4.2 is a confidentiality fix, not a redistribution of the row to a different admin');
select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §5 STRUCTURE. §4 proves leg 5 excludes THIS fixture's row; these pin the predicate so a
-- future edit cannot re-widen it for every other row while §4 stays green.
-- ===========================================================================
select ok(
  (select qual from pg_policies where tablename = 'audit_log' and policyname = 'audit_log_select')
    like '%((organization_id IS NULL) AND (hospital_id IS NULL) AND (commission_id IS NULL) AND app.is_admin())%',
  '5.1 ⭐ leg 5 carries its FULL platform-chain shape — all three scope keys NULL. Asserted as the whole leg rather than as a bare `hospital_id IS NULL` substring, which would also be satisfied by the conjunct sitting on the WRONG leg (that is exactly the defect ADR 0146 removed from leg 4)');

select ok(
  (select qual from pg_policies where tablename = 'audit_log' and policyname = 'audit_log_select')
    like '%((commission_id IS NULL) AND app.is_org_admin_of(organization_id))%',
  '5.2 ⭐ ... while leg 4 still carries NO hospital conjunct. Same leg-scoped form, opposite direction: ADR 0146 removed it from leg 4 and ADR 0147 added it to leg 5, and the two legs must not be confused for one another');

select * from finish();
rollback;

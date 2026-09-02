-- 408 — AE4.9 "do now" item 2: public.assume_role ENFORCES authz.roles.session_selectable.
-- Subject: 20261003007260 (ADR 0176 D7 / G4 of ADR 0155 / plan § AE4.9 "Do now" item 2 [IA-F4]).
--
-- ⛔⛔ WHY A GREEN HERE WOULD OTHERWISE PROVE NOTHING, AND WHAT MAKES IT PROVE SOMETHING.
--
-- All eleven `platform_role` enum values map to an authz.roles row with session_selectable = true
-- (the migration ASSERTS this as a precondition, or it would be revoking a live capability). The
-- only false row is `administrativo`, which is not a platform_role value at all. So the new gate
-- DENIES NOTHING on seeded data: a suite that merely called assume_role and watched it succeed
-- would be green with the gate present, absent, or misspelled.
--
-- Therefore every assertion below is a MUTATION or its control:
--   §3 flips ONE real role's session_selectable true -> false and asserts THAT role becomes
--      unselectable WHILE THE OTHER TWO STILL SELECT. ⛔ The discrimination half is not optional:
--      a query that is simply broken — wrong column, wrong join, always-false — satisfies "the
--      mutated role is denied" perfectly, and only the still-selectable siblings separate a wired
--      gate from a dead one.
--   §4 removes a role's catalog row entirely and asserts the fail-closed branch. That branch is
--      reachable for `platform_admin` ONLY, because its arm of assume_role reads profiles.is_admin
--      and touches no membership; for every membership-derived role
--      memberships_role_scope_kind_fkey (MATCH FULL, ON DELETE RESTRICT) makes the state
--      unconstructible. §4.0 asserts that FK rather than asserting the claim in prose.
--   §2 establishes that each subject could select its role BEFORE the mutation, and §3.5/§4.3
--      that it can again AFTER the restore — so a denial is attributable to the mutation and not
--      to a fixture that never worked.
--
-- ⚠ THIS SUITE DOES NOT CALL `test_helpers.bootstrap()`: it needs the real seeded personas
-- (chefe.ccih = staff_admin, orgadmin.a = org_admin, platform = profiles.is_admin) and
-- bootstrap's `truncate … cascade` would destroy them. Everything rolls back.
--
-- ⚠ assume_role requires a `session_id` claim, which test_helpers.claims_for does NOT set — the
-- claims blob is built inline here (315's pattern) and re-set before every call, because each
-- call must run as its own subject.
--
-- RUN SHAPE: `Files=2, Tests=18` (17 here + 00_setup.sql's one). ⛔ Keep this line in step with
-- plan().

begin;
select plan(17);

-- ============================================================================
-- §0 — FIXTURE + the structural facts §§3-4 depend on.
-- ============================================================================
create temp table f408 on commit drop as
  select (select id from public.profiles where email = 'chefe.ccih@test.local')  as sa_uid,
         (select id from public.profiles where email = 'orgadmin.a@test.local')  as oa_uid,
         (select id from public.profiles where email = 'platform@test.local')    as pa_uid;

select is(
  (select count(*)::int from f408
    where sa_uid is not null and oa_uid is not null and pa_uid is not null),
  1, '0.1 FIXTURE CONTROL: the three subject personas resolve');

select is(
  (select count(*)::int from authz.roles
    where code in ('staff_admin','org_admin','platform_admin') and session_selectable),
  3,
  '0.2 FIXTURE CONTROL: all three subject roles are session_selectable = TRUE at suite start. '
  '⛔ §3''s mutation is true -> false; if any were already false the "before" half would be '
  'measuring a denial the gate did not cause.');

select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.memberships'::regclass
      and conname = 'memberships_role_scope_kind_fkey'
      and confmatchtype = 'f'),
  1,
  '0.3 ⭐ THE BOUND ON §4, ASSERTED RATHER THAN ARGUED: memberships_role_scope_kind_fkey exists '
  'and is MATCH FULL. It is what makes "a membership-derived role with no catalog row" '
  'unconstructible — so §4 uses platform_admin, whose arm reads profiles.is_admin and touches no '
  'membership. ⛔ If this reds the FK moved, and §4''s scope claim must be re-derived, not '
  'adjusted. The FK retires at AE5-complete (ADR 0162 §2) and the gate is what stands behind it.');

-- ============================================================================
-- §1 — THE GATE IS PRESENT IN THE LIVE BODY. Read from pg_proc, comments STRIPPED, so a comment
-- SAYING it enforces the column cannot green this.
-- ============================================================================

select ok(
  (select regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'session_selectable'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'assume_role'),
  '1.1 ⭐ assume_role READS session_selectable, from comment-stripped prosrc. Measured at head '
  '20261003007240 this was FALSE — the column was not referenced at all — which is the finding '
  'IA-F4 filed and 0176 D7 rules on.');

select ok(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'assume_role'),
  '1.2 ...and it is still SECURITY DEFINER, which is the ONLY reason the read needs no grant. '
  'The superseded ruling read G4 as a client-side query into the sealed `authz` schema; it is a '
  'server-side read inside the definer''s own context. ⛔ prosecdef from pg_proc, never inferred.');

select is(
  (select count(*)::int
     from unnest(array['anon','authenticated','service_role']) r
    where has_schema_privilege(r, 'authz', 'USAGE')),
  0,
  '1.3 ⛔ AND NO APPLICATION ROLE GAINED USAGE ON `authz` FOR THIS. The whole point of D7 is that '
  'enforcing G4 costs no widening of the sealed schema; if this reds, the fix was bought with the '
  'exposure the original ruling was trying to avoid.');

-- ============================================================================
-- §2 — BASELINE: each subject can select its own role TODAY.
-- ============================================================================

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select sa_uid from f408), 'role', 'authenticated',
                     'session_id', gen_random_uuid())::text, true);
set local role authenticated;
select lives_ok($$ select public.assume_role('staff_admin'::public.platform_role) $$,
  '2.1 BASELINE: chefe.ccih (a real staff_admin) selects staff_admin');
reset role;

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select oa_uid from f408), 'role', 'authenticated',
                     'session_id', gen_random_uuid())::text, true);
set local role authenticated;
select lives_ok($$ select public.assume_role('org_admin'::public.platform_role) $$,
  '2.2 BASELINE: orgadmin.a (a real org_admin) selects org_admin');
reset role;

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select pa_uid from f408), 'role', 'authenticated',
                     'session_id', gen_random_uuid())::text, true);
set local role authenticated;
select lives_ok($$ select public.assume_role('platform_admin'::public.platform_role) $$,
  '2.3 BASELINE: platform (profiles.is_admin) selects platform_admin — the arm that reads no '
  'membership, which is what makes §4 constructible');
reset role;

-- ============================================================================
-- §3 — THE MUTATION: session_selectable true -> false on ONE role.
-- ============================================================================

update authz.roles set session_selectable = false where code = 'staff_admin';

select is((select session_selectable from authz.roles where code = 'staff_admin'), false,
  '3.0 ⛔ THE MUTATION LANDED. A mutation that did not fully apply reports GREEN downstream — '
  'assert the edit, then the effect.');

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select sa_uid from f408), 'role', 'authenticated',
                     'session_id', gen_random_uuid())::text, true);
set local role authenticated;
select throws_ok($$ select public.assume_role('staff_admin'::public.platform_role) $$,
  '42501', 'papel não selecionável nesta sessão',
  '3.1 ⭐⭐ THE MUTATED ROLE IS NOW UNSELECTABLE — by the NEW gate specifically. The message is '
  'asserted, not just the SQLSTATE: assume_role''s pre-existing "papel não disponível" denial '
  'carries the SAME 42501, so an errcode-only assertion would pass if the caller had simply '
  'stopped holding the role.');
reset role;

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select oa_uid from f408), 'role', 'authenticated',
                     'session_id', gen_random_uuid())::text, true);
set local role authenticated;
select lives_ok($$ select public.assume_role('org_admin'::public.platform_role) $$,
  '3.2 ⭐⭐ THE DISCRIMINATION HALF: org_admin STILL SELECTS while staff_admin does not. ⛔ '
  'Without this, a gate that is simply broken — wrong column, always-false, a typo''d role code — '
  'satisfies 3.1 exactly as well as a correct one. This is the assertion that separates "the '
  'column is read" from "something denied".');
reset role;

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select pa_uid from f408), 'role', 'authenticated',
                     'session_id', gen_random_uuid())::text, true);
set local role authenticated;
select lives_ok($$ select public.assume_role('platform_admin'::public.platform_role) $$,
  '3.3 ...and so does platform_admin. Two independent siblings, because one could coincide with '
  'whatever a broken predicate happens to admit.');
reset role;

update authz.roles set session_selectable = true where code = 'staff_admin';

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select sa_uid from f408), 'role', 'authenticated',
                     'session_id', gen_random_uuid())::text, true);
set local role authenticated;
select lives_ok($$ select public.assume_role('staff_admin'::public.platform_role) $$,
  '3.4 ⛔ THE RESTORE IS PROVEN: flipping the column back makes staff_admin selectable again. A '
  'one-way latch — a door that broke on the first UPDATE and never recovered — would satisfy 3.1 '
  'and 3.2 and fail here.');
reset role;

-- ============================================================================
-- §4 — THE FAIL-CLOSED BRANCH: no catalog row at all.
-- Reachable ONLY for platform_admin (§0.3's FK explains why), and constructed here rather than
-- asserted in prose.
-- ============================================================================

delete from authz.roles where code = 'platform_admin';

select is((select count(*)::int from authz.roles where code = 'platform_admin'), 0,
  '4.1 THE MUTATION LANDED: platform_admin has no catalog row. ⚠ Possible only because no '
  'membership references it — allowed_scope_kind is the structurally unreachable `none`, so the '
  'ON DELETE RESTRICT FK has nothing to hold.');

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select pa_uid from f408), 'role', 'authenticated',
                     'session_id', gen_random_uuid())::text, true);
set local role authenticated;
select throws_ok($$ select public.assume_role('platform_admin'::public.platform_role) $$,
  '42501', 'papel não selecionável nesta sessão',
  '4.2 ⭐⭐ FAIL CLOSED: a role the catalog does not carry is NOT selectable, even for a caller '
  'who genuinely holds it (profiles.is_admin is untouched). ⛔ `coalesce(…, false)` is what makes '
  'the missing row a DENIAL rather than a NULL that falls through the `if not` as false.');
reset role;

insert into authz.roles (code, allowed_scope_kind, system_managed, session_selectable, state)
  values ('platform_admin', 'none', true, true, 'legacy');

select set_config('request.jwt.claims',
  jsonb_build_object('sub', (select pa_uid from f408), 'role', 'authenticated',
                     'session_id', gen_random_uuid())::text, true);
set local role authenticated;
select lives_ok($$ select public.assume_role('platform_admin'::public.platform_role) $$,
  '4.3 ...and restoring the row restores the capability, so 4.2 measured the ROW and not some '
  'unrelated damage the DELETE did on its way past.');
reset role;

select * from finish();
rollback;

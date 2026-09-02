-- 404 — BUG-PROF-INACTIVE-001: the staff_admin org-ascent arm gates on app.is_active.
-- Subject: 20261003007190. Found by AE4.5's differential oracle (403 section 4.1).
--
-- ⚠ THE SUBJECT MOVED IN AE4.7c, AND THE BUG DID NOT. This file was written against
-- `app.can_manage_professional`, which then held the arm. AE4.7c split that gate by
-- OPERATION (matrix § 12.8.5): the commission staff_admin ascent — the arm this bug was
-- ABOUT — moved to `app.can_create_professional`, and from there into
-- `app.is_org_commission_staff_admin`, where the `is_active(p_uid)` term now lives.
-- ⛔ A 404 left pointing at can_manage_professional would have kept PASSING while asserting
-- nothing: 1.3 and 1.4 expect a DENIAL, and a gate that no longer admits staff_admins at all
-- denies them for a reason unrelated to principal state. Two green assertions, zero coverage
-- of the fix — the exact orphaning shape AE4.7b repaired one layer down (315/319).
--
-- ⚠ AND IT MOVED A SECOND TIME IN AE4.9 D6 (migration 20261003007300, ADR 0176 D6). That
-- migration re-keys `app.can_create_professional`'s staff_admin arm off
-- `app.is_org_commission_staff_admin` and onto `authz.has_permission(...,
-- 'org.professionals.create')`. So the door no longer names the helper at all, and §1.6 —
-- which asserted exactly that call — went RED. ⛔ THE PIN WAS NOT SIMPLY RE-CODED TO MATCH:
-- the subject was re-established first, on the live catalog, in a rolled-back transaction.
--   * THE INVARIANT HOLDS. Measured at head 20261003007300: 1.2 grants an ACTIVE principal,
--     1.3 and 1.4 deny once `is_active` / `suspended_until` is flipped and NOTHING else
--     changes. That is a real differential on the live door, not a re-read of the fix.
--   * THE GATE MOVED, IT DID NOT VANISH. `app.is_active` is now applied by
--     `authz.assignment_facts`, which projects no assignment for an inactive principal —
--     verified on `pg_proc`, and the whole chain door -> `authz.has_permission` ->
--     `authz.entailed_grants` -> `authz.assignment_facts` -> `app.is_active(p_principal)`
--     was walked hop by hop. §1.6 now asserts THAT chain (see its own note for why the
--     longer chain is a WEAKER instrument than the one it replaces).
--   * THE BEHAVIOURAL PROOF IS DOUBLED, not moved. 1.2-1.4 stay here, unchanged, on
--     `app.can_create_professional` directly; `409` §3.10/§3.11 assert the same invariant one
--     layer OUT, at the production RPC `public.create_professional_profile` (42501), on both
--     polarities. ⛔ Neither is a substitute for the other: 409 measures what a user can
--     reach, this file measures the authorizer a future caller might reach differently.
--   * ⚠ `409` §3.1 asserts the NEGATION of the old §1.6 — that the body no longer names the
--     helper. Left as it was, this file and 409 could not both be green; that is what makes
--     the old §1.6 a stale pin rather than a live finding.
--
-- ⛔ THE DEFECT, for anyone reading this cold. app.is_staff_admin_of_for is
-- `app.is_active(uid) AND app.has_role(...)`; app.has_role does NOT itself check is_active;
-- and app.can_manage_professional called app.has_role DIRECTLY. So a DEACTIVATED or
-- SUSPENDED principal kept Class-2 professional-identity authority across the WHOLE
-- organization — 13 doors, all 13 holding `authenticated` EXECUTE (AE4.7c later split those
-- 13 across four gates; the arm, and therefore this bug's blast radius, followed the ascent). The app-layer sign-out is
-- not a defence: JWTs are bearer tokens and deactivation does not revoke them, which is why
-- Architecture Rule 1 puts the boundary in the database.
--
-- ⚠ PREDATES AE4. The resolver answered correctly all along; AE4.5 is what made the
-- disagreement VISIBLE and, because the matrix was already approved, ACTIONABLE (PA-F8).
--
-- ⚠ APPROVED LIMITATION, carried from the deny-class table: `suspended` is NOT independently
-- observable from `inactive` — app.is_active folds both, so no site distinguishes them. Both
-- states are asserted below; ⛔ that is not a claim of separate coverage.
--
-- RUN SHAPE: `Files=2, Tests=7` (6 here + 00_setup.sql's one).

begin;
select plan(6);

create temp table f404 on commit drop as
select p.id as uid,
       (select h.organization_id from public.memberships m
          join public.commissions c on c.id = m.commission_id
          join public.hospitals h on h.id = c.hospital_id
         where m.principal_id = p.id and m.role = 'staff_admin' limit 1) as oid
  from public.profiles p where p.email = 'chefe.ccih@test.local';

select is((select count(*)::int from f404 where uid is not null and oid is not null), 1,
  '1.1 FIXTURE CONTROL: one active staff_admin with a resolvable organization');

select ok(app.can_create_professional((select oid from f404), (select uid from f404)),
  '1.2 ⭐ ACTIVE PRINCIPAL STILL GRANTED — the over-narrowing guard. A fix that simply denied '
  'everyone would satisfy 1.3 and 1.4 perfectly and fail HERE.');

update public.profiles set is_active = false where id = (select uid from f404);
select ok(not app.can_create_professional((select oid from f404), (select uid from f404)),
  '1.3 ⭐ DEACTIVATED PRINCIPAL DENIED — the defect itself. Before 20261003007190 this '
  'returned TRUE while app.is_staff_admin_of_for returned false for the same principal.');
update public.profiles set is_active = true where id = (select uid from f404);

update public.profiles set suspended_until = now() + interval '7 days' where id = (select uid from f404);
select ok(not app.can_create_professional((select oid from f404), (select uid from f404)),
  '1.4 SUSPENDED PRINCIPAL DENIED. ⚠ Same predicate as 1.3 — app.is_active folds inactive and '
  'suspended, so this is NOT independent coverage of suspension.');
update public.profiles set suspended_until = null where id = (select uid from f404);

select ok(
  (select p.prosrc ~ 'is_active\(p_uid\)' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'is_org_commission_staff_admin'),
  '1.5 CATALOG-POSITIVE: `app.is_org_commission_staff_admin` still carries `app.is_active(p_uid)` '
  'on its staff_admin arm. A future `create or replace` that silently drops it reds here, and no '
  'diff review would catch that. ⛔ READ THE SCOPE CHANGE BEFORE CITING THIS LINE. AE4.7c gave '
  'the ascent ONE home for THREE consumers and this asserted the gate for all three. AE4.9 D6 '
  'took one of them away: `can_create_professional` — THIS FILE''S DOOR — no longer calls the '
  'helper. So 1.5 is now about the TWO REMAINING callers, `can_manage_external_participant` and '
  '`can_manage_case_vocabulary` (catalog rows 31/32, still `pending-rekey`; that they are exactly '
  'two is pinned by 409 §3.2). It is kept because nothing else asserts their is_active gate — '
  'NOT because it still covers this bug. ⛔ Do not let a green 1.5 read as coverage of '
  'BUG-PROF-INACTIVE-001; 1.2-1.4 and 1.6 are what cover it now. ⛔ The gate is on the '
  'staff_admin arm ONLY: is_org_admin_of gates internally, and wrapping app.is_admin() would be '
  'actively wrong (FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM).');

-- 1.6 — THE CHAIN, RE-POINTED BY AE4.9 D6 (was: `can_create_professional` names
--       `is_org_commission_staff_admin`).  The shape is unchanged and it is the whole point of
--       the line: an assertion about a callee is worth nothing until the CALL is asserted too,
--       so every hop from the door down to `app.is_active` is named here.  The probe returns the
--       BROKEN hops, so a red says WHICH link parted rather than just `false`.
--       ⚠ HONEST ABOUT ITS OWN STRENGTH: this is a WEAKER instrument than the one it replaces.
--       The old chain was ONE hop inside `app`; this is FOUR, three of them in `authz`, and each
--       is a name match that can be true while the composition means something else.  It is a
--       tripwire on the chain's SHAPE, not a proof of the gate.  The proof is 1.2-1.4, which
--       flip the principal's state and measure the door's answer.  ⛔ If this ever reds, do NOT
--       re-point it again until 1.2-1.4 have been re-measured — a moved gate and a REMOVED gate
--       look identical from up here, and that is exactly how a pinned expectation greens itself
--       while deleting its subject.
create or replace function pg_temp.f404_src(p_ns text, p_fn text) returns text
language sql stable as $$
  select coalesce((select regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')
                     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = p_ns and p.proname = p_fn), '<ABSENT>');
$$;

select is(
  (select coalesce(string_agg(t.hop, ' ; ' order by t.hop), '<intact>') from (
     select 'HOP1 app.can_create_professional -> authz.has_permission(org.professionals.create)' as hop
      where pg_temp.f404_src('app', 'can_create_professional')
            !~ 'authz\.has_permission\(\s*p_uid\s*,\s*''organization''\s*,\s*p_org\s*,\s*''org\.professionals\.create'''
     union all
     select 'HOP2 authz.has_permission -> authz.entailed_grants'
      where pg_temp.f404_src('authz', 'has_permission') !~ 'authz\.entailed_grants'
     union all
     select 'HOP3 authz.entailed_grants -> authz.assignment_facts'
      where pg_temp.f404_src('authz', 'entailed_grants') !~ 'authz\.assignment_facts'
     union all
     select 'HOP4 authz.assignment_facts -> app.is_active(p_principal)'
      where pg_temp.f404_src('authz', 'assignment_facts') !~ 'app\.is_active\(p_principal\)'
   ) t),
  '<intact>',
  '1.6 ⭐⭐ THE CHAIN IS ASSERTED AT EVERY HOP. `can_create_professional` reaches `is_active` '
  'only through authz.has_permission -> entailed_grants -> assignment_facts, which refuses to '
  'project an assignment for an inactive principal. ⛔ HOP1 pins the permission CODE, not just '
  'the call: `has_permission` with the wrong code would resolve some OTHER permission and this '
  'file would be measuring a gate it is not about. ⛔ The probe is not vacuous — asked for the '
  'RETIRED hop (`can_create_professional` -> `is_org_commission_staff_admin`) the same query '
  'reports it broken, so it returns both answers. Verified on the live catalog 2026-09-02.');

select * from finish();
rollback;

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
  '1.5 CATALOG-POSITIVE, the durable half: the body carries `app.is_active(p_uid)` on the '
  'staff_admin arm. A future `create or replace` that silently drops it reds here, and no diff '
  'review would catch that. ⚠ AE4.7c moved the arm — and therefore this assertion — out of '
  'can_manage_professional into `app.is_org_commission_staff_admin`, where the ascent now lives '
  'in ONE place for its three consumers. ⛔ The gate is on the staff_admin arm ONLY: '
  'is_org_admin_of gates internally, and wrapping app.is_admin() would be actively wrong '
  '(FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM).');

select ok(
  (select regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'is_org_commission_staff_admin'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_create_professional'),
  '1.6 ⭐⭐ AND THE CHAIN IS ASSERTED AT BOTH ENDS. 1.5 now checks a body the DOOR does not '
  'name: `can_create_professional` reaches `is_active` only THROUGH is_org_commission_staff_admin. '
  '⛔ Without this line, someone who re-inlined the ascent into can_create_professional (or '
  'dropped the disjunct entirely) would leave 1.5 green — it would still find the term, in a '
  'function nothing calls — while 1.2-1.4 measure a door that no longer reaches it. An assertion '
  'about a callee is worth nothing until the CALL is asserted too.');

select * from finish();
rollback;

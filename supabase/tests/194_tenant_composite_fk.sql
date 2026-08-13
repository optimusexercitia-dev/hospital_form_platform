-- WS-3b · D2 — tenant-hierarchy composite FK + hospitals org-repoint guard.
-- Migration: 20260711000400_tenant_composite_fk.sql · ADR 0054.
--
-- The lock: this suite fails if the composite FK / FK-referenceable unique / repoint
-- guard is removed — i.e. if a commission's org can silently disagree with its hospital,
-- or a populated hospital can change org.
--
-- Covers:
--   §1 the constraints + guard trigger exist.
--   §2 moving a POPULATED hospital to another org raises HC082 (clean message).
--   §3 moving an EMPTY hospital to another org is allowed.
--   §4 a commissions row with a mismatched (hospital_id, organization_id) raises 23503.

begin;
select plan(8);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'org_b')::uuid  as org_b,
         (v->>'hosp_b')::uuid as hosp_b,   -- has commissions (comm_x, comm_y)
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- A SECOND org + an EMPTY hospital under org_b (no commissions), for the positive
-- repoint control. Superuser inserts.
create temp table t on commit drop as
  select gen_random_uuid() as org2, gen_random_uuid() as empty_hosp;
grant select on t to authenticated;
insert into public.organizations (id, name, slug)
  values ((select org2 from t), 'Org Two', 'org-two-' || substr((select org2 from t)::text,1,8));
insert into public.hospitals (id, organization_id, name, slug)
  values ((select empty_hosp from t), (select org_b from k), 'Hosp Empty',
          'hosp-empty-' || substr((select empty_hosp from t)::text,1,8));

-- ============================================================================
-- §1: constraints + guard exist
-- ============================================================================
select ok(
  exists (select 1 from pg_constraint where conname='hospitals_id_org_uq'
          and conrelid='public.hospitals'::regclass and contype='u'),
  '1.1: hospitals_id_org_uq UNIQUE constraint exists (FK-referenceable, not a bare index)');
select ok(
  exists (select 1 from pg_constraint where conname='commissions_hospital_org_fkey'
          and conrelid='public.commissions'::regclass and contype='f'),
  '1.2: commissions_hospital_org_fkey composite FK exists');
select ok(
  exists (select 1 from pg_constraint where conname='commissions_hospital_id_fkey'
          and conrelid='public.commissions'::regclass and contype='f'),
  '1.3: the single-column commissions_hospital_id_fkey is KEPT (ON DELETE RESTRICT)');
select ok(
  exists (select 1 from pg_trigger where tgname='guard_hospital_org_repoint_trg'
          and tgrelid='public.hospitals'::regclass and not tgisinternal),
  '1.4: guard_hospital_org_repoint_trg exists');

-- ============================================================================
-- §2: moving a POPULATED hospital to another org raises HC082.
-- ============================================================================
select throws_ok(
  format($$ update public.hospitals set organization_id = %L::uuid where id = %L::uuid $$,
         (select org2 from t), (select hosp_b from k)),
  'HC082', null,
  '2.1: repointing a POPULATED hospital (has commissions) to another org raises HC082');

-- ============================================================================
-- §3: moving an EMPTY hospital to another org is allowed.
-- ============================================================================
select lives_ok(
  format($$ update public.hospitals set organization_id = %L::uuid where id = %L::uuid $$,
         (select org2 from t), (select empty_hosp from t)),
  '3.1: repointing an EMPTY hospital (no commissions) to another org is allowed');

-- ============================================================================
-- §4: a commissions row with a mismatched (hospital_id, organization_id) is rejected.
-- hosp_b belongs to org_b; store a commission claiming org2 while pointing at hosp_b.
-- The composite FK finds no hospitals row matching (hosp_b, org2) -> 23503. (The
-- commissions derive trigger would normally fix organization_id, so bypass it by
-- setting the value the trigger can't reconcile — a direct superuser insert that
-- disables the derive path via an explicit org that mismatches the hospital.)
-- ============================================================================
-- The derive trigger sets organization_id from hospital_id, so a direct insert with a
-- mismatched org is auto-corrected — meaning the FK is belt-and-suspenders behind the
-- trigger. Prove the FK independently: temporarily drop the derive trigger in-txn so a
-- mismatched org reaches the composite FK.
savepoint before_drop_derive;
alter table public.commissions disable trigger user;  -- disable derive + others in-txn
select throws_ok(
  format($$ insert into public.commissions (name, slug, created_by, hospital_id, organization_id)
            values ('Bad', 'bad-comm-xyz', %L::uuid, %L::uuid, %L::uuid) $$,
         (select admin from k), (select hosp_b from k), (select org2 from t)),
  '23503', null,
  '4.1: a commission whose stored org disagrees with its hospital''s org raises 23503 (composite FK)');
rollback to savepoint before_drop_derive;

-- Belt: a correctly-matched commission still inserts (via the normal derive path).
select lives_ok(
  format($$ insert into public.commissions (name, slug, created_by, hospital_id)
            values ('Good', 'good-comm-xyz', %L::uuid, %L::uuid) $$,
         (select admin from k), (select hosp_b from k)),
  '4.2: a commission under its real hospital inserts cleanly (derive fills the matching org)');

select * from finish();
rollback;

-- Hospital-admin tier dropped-symbol catalog sweep (ADR 0051; migration
-- 20260709000200). PERMANENT GUARD for the swap: A2 DROPPED
-- app.is_org_admin_of_commission[_for] and rebound every commission-scoped caller
-- to app.is_commission_admin_of[_for]. A CREATE OR REPLACE that copied a STALE
-- base could leave an OFF-INVENTORY caller referencing the dropped symbol — it
-- would then ERROR at call time (the ADR 0042 M2 class). This asserts the LIVE
-- catalog (function bodies + RLS policy expressions) has ZERO references to the
-- dropped symbol, so the class can never silently return.
--
-- The regex \m(is_org_admin_of_commission)\( matches the bare/_for dropped names
-- (both start with is_org_admin_of_commission) while is_org_admin_of( — the
-- org-level surface that STAYS — does NOT match (the char after ...of is '(',
-- not 'c'). is_commission_admin_of[_for]( — the rebound name — also does not
-- match. The two `commissions` policies keep is_org_admin_of(organization_id)
-- (the Q5 documented exception) which correctly does NOT trip this sweep.
begin;
select plan(5);

-- (1) No app/public function body references the dropped commission predicate.
select is(
  (select count(*)::int from pg_proc
   where pronamespace in ('app'::regnamespace, 'public'::regnamespace)
     and prosrc ~ '\mis_org_admin_of_commission\('),
  0,
  'SWEEP: ZERO app/public pg_proc bodies reference the dropped is_org_admin_of_commission');

-- (2) No RLS policy USING (qual) references the dropped symbol.
select is(
  (select count(*)::int from pg_policies
   where coalesce(qual, '') ~ '\mis_org_admin_of_commission\('),
  0,
  'SWEEP: ZERO pg_policies USING (qual) clauses reference the dropped symbol');

-- (3) No RLS policy WITH CHECK references the dropped symbol.
select is(
  (select count(*)::int from pg_policies
   where coalesce(with_check, '') ~ '\mis_org_admin_of_commission\('),
  0,
  'SWEEP: ZERO pg_policies WITH CHECK clauses reference the dropped symbol');

-- (4) The dropped functions themselves no longer exist.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname in ('is_org_admin_of_commission','is_org_admin_of_commission_for')),
  0,
  'SWEEP: the dropped predicates is_org_admin_of_commission[_for] do NOT exist');

-- (5) CALIBRATION: the rebound predicate IS present and referenced (so tests 1–4
-- returning 0 means "swapped", not "no commission-admin code at all").
select ok(
  (select count(*)::int from pg_proc
   where pronamespace in ('app'::regnamespace, 'public'::regnamespace)
     and prosrc ~ '\mis_commission_admin_of\(') >= 10,
  'SWEEP CALIBRATION: the rebound is_commission_admin_of is present in >=10 bodies (swap landed)');

select * from finish();
rollback;

-- AFF4 — D4 CONTAINMENT ACROSS THE **ACTOR** DIMENSION.
--
-- ⛔⛔ WHY THIS FILE EXISTS, AND IT IS THE WHOLE POINT.
--    `380` §6 covers D4 containment thoroughly — but only across the STATE dimension
--    (orphan / ended-orphan / child-before-parent), and EVERY arm there runs as the
--    privileged suite role. It never varies the CALLER. That blind spot let a
--    100%-reproducible break ship: `app.assert_hospital_affiliation_has_org` was created
--    SECURITY **INVOKER**, so its `exists` against `public.organization_affiliations` ran
--    under the CALLING user's RLS — and that table has NO hospital tier by design
--    (ADR 0151 D1, pinned by `375` §4.1). A `hospital_admin` performing D5's one-step
--    rehire therefore hit a FALSE-POSITIVE `23514`: `affiliate_person_impl` (DEFINER)
--    correctly created the org parent, and the deferred trigger could not SEE the row that
--    had just been created, so the whole transaction rolled back.
--
--    ⭐ TWO INDIVIDUALLY-CORRECT DECISIONS COMPOSING INTO A BREAK — a deliberately narrow
--    policy, and a backstop that reads under caller RLS. Neither is wrong alone. A
--    containment arm that varies only the STATE and never the ACTOR cannot see this class
--    at all, which is why the state coverage in `380` §6 was no defence.
--
-- ⚠ THE DEFERRAL TRAP, INHERITED FROM `380` §6 AND RESTATED BECAUSE IT IS LOAD-BEARING:
--   `hospital_affiliation_has_org_trg` is DEFERRABLE INITIALLY DEFERRED and every pgTAP
--   suite ends in `rollback`, so the check NEVER fires on its own here. Every arm below
--   forces `set constraints all immediate` INSIDE the same block. Without that line these
--   arms observe the write succeed and pass while proving nothing.
--
-- ⚠ ROLE IDIOM: `test_helpers.claims_for(<uuid>, false, '<active_role>')` — the THREE-arg
--   form. `app.has_role` ends in `p_user_id is distinct from auth.uid() or p_role is not
--   distinct from app.active_role()`, so without an `active_role` claim every `app.is_*_of`
--   returns false for a self-query and an ALLOW arm fails for the wrong reason.
--
-- Assertion count: 12
-- ============================================================================
begin;
select plan(12);

create temp table k on commit drop as select
  -- TWO subjects, never one. Reusing a single id across the control and the keystone
  -- removes the isolation the schema gives for free, and in this repo that has fabricated
  -- both a defect and an all-clear.
  '00000000-0000-0000-0000-0000000000d2'::uuid as subject_ctl,  -- org A, rehired by org_admin
  '00000000-0000-0000-0000-000000000002'::uuid as subject_key,  -- org A, rehired by hospital_admin
  '00000000-0000-0000-0000-0000000000b1'::uuid as org_admin_a,
  '00000000-0000-0000-0000-0000000000e1'::uuid as hosp_admin,   -- central-a ONLY
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  '05000000-0000-0000-0000-00000000000a'::uuid as central_a,
  '2019-03-04'::date as past_start;
grant select on k to authenticated;
grant select on k to service_role;

-- ── SETUP: put both subjects into the D5 "org-offboarded but still anchored" state. ──
-- The tenant anchor is `profiles.home_organization_id`, NOT an active org affiliation, so
-- an org-offboarded person REMAINS rehireable — that is exactly what D5 promises and what
-- this file exercises.
-- ⚠ AE2.2 (2026-08-27) split that sentence in two, and only the WRITE half above is still
-- true. Containment/rehire still anchors on the column (AE2.2 was ruled T3: the trigger is
-- NOT re-predicated, because the door that creates an org affiliation is itself gated on
-- the column). But READ visibility no longer anchors on it at all — it now derives from
-- `organization_affiliations` via ADR 0163's last-org retention, which is precisely what
-- keeps an org-offboarded person visible to the retaining org's admin. Do not cite this
-- comment for a read claim.
update public.organization_affiliations
   set ended_on = current_date, ended_by = (select org_admin_a from k)
 where principal_id in ((select subject_ctl from k), (select subject_key from k))
   and ended_on is null and voided_at is null;

-- ============================================================================
-- §0 PRECONDITIONS — asserted, never assumed.
-- ============================================================================
select is(
  (select count(*)::int from pg_trigger
    where tgrelid = 'public.hospital_affiliations'::regclass
      and tgname = 'hospital_affiliation_has_org_trg'
      and tgdeferrable and tginitdeferred), 1,
  '0.1 ⛔ THE TRAP, PINNED: the trigger IS deferrable-initially-deferred, which is why every arm below forces it immediate — if this becomes false, re-read those arms before trusting them');

select is(
  (select count(*)::int from public.memberships
    where principal_id = (select hosp_admin from k)
      and role = 'hospital_admin' and hospital_id = (select central_a from k))
  + (select count(*)::int from public.memberships
      where principal_id = (select hosp_admin from k) and role = 'org_admin'), 1,
  '0.2 PRECONDITION: the actor is hospital_admin of central-a and org_admin NOWHERE — otherwise §2 would pass through the org-admin arm of the policy and prove nothing');

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select subject_ctl from k) and ended_on is null and voided_at is null), 0,
  '0.3 PRECONDITION: the CONTROL subject is org-offboarded — so the rehire must CREATE the org parent, which is the write the trigger then has to see');

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select subject_key from k) and ended_on is null and voided_at is null), 0,
  '0.4 PRECONDITION: the KEYSTONE subject is likewise org-offboarded');

-- ⛔ FLUSH: prove the state entering the arms already satisfies D4, so every verdict below
--    is about a row THIS file wrote and not a leftover. That this LIVES is the assertion.
select lives_ok(
  $$set constraints all immediate$$,
  '0.5 the state entering §1/§2 already satisfies D4 — so a refusal below is about this file''s own write');
set constraints all deferred;

-- ============================================================================
-- §1 CONTROL — the SAME rehire, by an `org_admin`. This arm passed both BEFORE and AFTER
--    the fix, and that is precisely what makes §2 an ACTOR result rather than a state one:
--    the policy grants `app.is_org_admin_of`, so an org admin's RLS could always see the
--    parent the door had just created.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false, 'org_admin');
set local role authenticated;

select lives_ok(
  $$select public.affiliate_person(
      '00000000-0000-0000-0000-0000000000d2'::uuid,
      '05000000-0000-0000-0000-00000000000a'::uuid,
      null, '2019-03-04'::date, null, null, null);
    set constraints all immediate;$$,
  '1.1 CONTROL: an ORG ADMIN can perform the D5 one-step rehire of an org-offboarded person');
set constraints all deferred;
reset role;

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select subject_ctl from k) and ended_on is null and voided_at is null), 1,
  '1.2 CONTROL non-vacuity: the rehire actually CREATED the active org parent — 1.1 is a real write, not a no-op that cannot fail');

-- ============================================================================
-- §2 ⭐⭐ THE KEYSTONE — the identical rehire, by a `hospital_admin`.
--    RED before the fix (`23514`, the containment trigger firing on a row the door had
--    just created); GREEN after. Same state, same door, DIFFERENT ACTOR.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false, 'hospital_admin');
set local role authenticated;

select lives_ok(
  $$select public.affiliate_person(
      '00000000-0000-0000-0000-000000000002'::uuid,
      '05000000-0000-0000-0000-00000000000a'::uuid,
      null, '2019-03-04'::date, null, null, null);
    set constraints all immediate;$$,
  '2.1 ⭐⭐ KEYSTONE: a HOSPITAL ADMIN can perform the same D5 rehire — before the SECURITY DEFINER fix this raised a false-positive 23514, because the INVOKER trigger read organization_affiliations under the caller''s own RLS and could not see the parent the door had just written');
set constraints all deferred;

-- ⭐⭐ THE CONTROL THAT PINS **WHICH** FIX IS IN PLACE, and it is the important one.
--    2.1 would also go green if someone "fixed" this by adding a hospital tier to
--    `organization_affiliations_select`. ADR 0158 D2 forbids exactly that — never fix a
--    read by granting access. So assert the hospital admin STILL cannot see the row:
--    2.1 must pass because the TRIGGER stopped consulting caller RLS, not because the
--    POLICY was widened. If this ever flips to 1, the containment fix has been replaced
--    by a privilege grant and `375` §4.1 will be failing too.
select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select subject_key from k)), 0,
  '2.2 ⭐ ...and the hospital admin STILL reads ZERO org affiliations of that person — so 2.1 is the DEFINER trigger, NOT a widened policy (ADR 0158 D2)');
reset role;

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select subject_key from k) and ended_on is null and voided_at is null), 1,
  '2.3 non-vacuity: the row 2.2 cannot see DOES exist — measured without RLS. That gap between 1 and 0 is the exact blindness that broke the rehire');

select is(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = (select subject_key from k)
      and hospital_id = (select central_a from k)
      and ended_on is null and voided_at is null), 1,
  '2.4 non-vacuity: the hospital affiliation itself landed — 2.1 committed the child as well as the parent');

-- ============================================================================
-- §3 THE STRUCTURAL PIN — so the property cannot be reverted silently.
-- ============================================================================
select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'assert_hospital_affiliation_has_org'), true,
  '3.1 ⭐ the containment trigger is SECURITY DEFINER — it enforces a DATA INVARIANT and reads no caller identity, so DEFINER grants nobody anything; INVOKER merely blinded it to the data it asserts over');

select * from finish();
rollback;

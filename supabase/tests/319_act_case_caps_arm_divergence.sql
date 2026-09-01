-- ACT Stage 4 (ADR 0106 D14) — the _case_caps arm-divergence keystone.
--
-- D14 classifies every bit-contributing arm of app._case_caps as either
-- ROLE-DERIVED (obeys the hat: reaches memberships ONLY through has_role /
-- has_role_any, whose caller-only condition arms when the evaluated principal
-- IS the caller) or RELATIONSHIP-DERIVED (D6-immune: per-case ACL rows,
-- assignment, respondent, recusal — the principal is the OBJECT of a per-case
-- relationship, not the holder of a grant). Audited from the live catalog
-- 2026-08-10 (pg_get_functiondef of _case_caps + every helper it calls):
--
--   S1 coordinator      is_staff_admin_of_for  -> authz.holds_role(commission,        ROLE
--                                                 staff_admin)  ⚠ CATALOG-ROUTED since AE4.6;
--                                                 the hat conjunct lives in authz.holds_role
--                                                 (AE4.7b), NOT in app.has_role. Still
--                                                 ROLE-derived — the CLASSIFICATION is
--                                                 unchanged; only the chokepoint moved.
--   S2 tenancy admin    is_tenancy_admin_of_for-> has_role(org|hospital, *_admin)    ROLE
--   S5 member default   is_member_of_for       -> has_role_any(commission)           ROLE
--   S6 nsp referral     is_pqs_operator_of_for -> has_role(hospital, nsp_coord|pqs)  ROLE
--   S7 quality reviewer is_quality_reviewer_of_for -> has_role(hospital, q_reviewer) ROLE
--   S3 manual grant     case_access_grants row (principal_id = p_uid)        RELATIONSHIP
--   S4 assignment       case_phases/case_narratives.assigned_to = p_uid      RELATIONSHIP
--   STEP-4 hard denies  is_case_respondent / is_recused_from_case            RELATIONSHIP
--   (STEP 1-3: null-uid / is_active / unknown-case are PRECONDITIONS — they
--    contribute no bits and belong to neither class; is_active is D3's outer
--    status gate, deliberately hat-independent.)
--
-- THE CLAIM THIS FILE PINS (same user, same case, two genuinely-held hats):
--   role-derived bits DIFFER between hats; relationship-derived bits are
--   IDENTICAL AND SET. Plus the two boundary behaviours that make the claim
--   exact: a hatless multi-role caller keeps ONLY relationship bits (D5 x D6),
--   and a THIRD-PARTY evaluation (auth.uid() <> p_uid) consults the full grant
--   set regardless of anyone's hat (the designed disarm the third-party doors
--   and file_correction_request's corrector check depend on).
--
-- VACUITY CONTROLS (authz-handoff §7.1 — which assertion de-vacuates which):
--   * A1/A2 (exact masks 111/64) — absences and presences in ONE equality; the
--     divergence cannot be two zeros because A1 proves the bits SET under the
--     staff_admin hat and A2 proves them CLEAR under the org_admin hat.
--   * A4 (bit-16 CLEAR under both hats, pre-grant) is the negative control for
--     A11/A12 (bit-16 SET under both hats, post-grant): the fixture insertion
--     demonstrably flips the bit, so "identical under both hats" is not
--     satisfied by 0==0 (the BUG-VACUOUS-ASSERT-1 shape).
--   * A5/A7 (mutation twins) prove the DIVERGENCE assertions can fail: with the
--     caller-only condition stripped from has_role (A5) a hat sa_x DOES NOT HOLD
--     reads S2's bit 64 (0 -> 64, A4b is its pre-mutation zero); stripped from
--     has_role_any (A7) the S5 arm leaks bit 2 (64 -> 66). One function at a
--     time; byte-identical restore asserted (A6/A8).
--     ⚠ AE4.7b re-pointed A5's OBSERVABLE TWICE, and the discarded attempt is
--     recorded at A5 because it is the instructive one. It used to watch S1 leak
--     into the ORG-hat mask (64 -> 111); S1 is now catalog-routed
--     (app.is_staff_admin_of_for -> authz.holds_role, which carries its own hat
--     conjunct), so a has_role mutation cannot open it and the old A5 was
--     orphaned. ⛔ The obvious repair — staff_admin hat, expecting 111 -> 175 —
--     is VACUOUS: S1's 111 ALREADY CONTAINS bit 64, so S2's whole contribution
--     is masked. Measured at 111, caught by a red.
--   * A9/A10 (exact masks 127/94) are the non-zero anchors for the recusal
--     zeros (A15-A17): 0 after 127/94 is a real transition, not a default.
--   * Permissive-sibling immunity (§7.1 shape 6): every assertion here is on
--     app._case_caps' RETURN VALUE — no table read, no policy can OR itself
--     into the result. The hat clause arms because claims_for sets sub = the
--     evaluated principal (verified by A14, where sub <> principal and the
--     clause provably DISARMS).
--
-- Masks (app._cap_bit): view=1 delib=2 content=4 std_phi=8 restr_phi=16
-- write=32 manage=64. 111 = S1 (all but restr_phi). 64 = S2. 30 = grant(16|8)
-- + assignment(4|2). 127 = 111|16. 94 = 64|30. 66 = 64 | S5-leak(2).
-- Every expected value below was MEASURED against the live resolver before
-- this file was written (probe run 2026-08-10), not derived on paper.
--
-- Fixture notes: sa_x is made genuinely dual-hat (staff_admin@comm_x from
-- bootstrap + org_admin@org_b here). The grant row sets read_standard_phi
-- ALONGSIDE read_restricted_phi — the case_access_grants_restricted_implies_
-- standard CHECK enforces the lattice at the column level (probe-caught).
-- No ON CONFLICT anywhere: fixture inserts fail LOUDLY.

begin;
select plan(18);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x, (v->>'sa_y')::uuid as sa_y,
         (v->>'comm_x')::uuid as comm_x, (v->>'org_b')::uuid as org_b,
         (v->>'form_u')::uuid as form_u, (v->>'ver_u')::uuid as ver_u
  from ctx;
grant select on k to authenticated;

-- Dual-hat subject: staff_admin@comm_x (bootstrap) + org_admin@org_b (here).
insert into public.memberships (organization_id, principal_id, role)
  select org_b, sa_x, 'org_admin' from k;

-- The case, created by a third party (sa_y) so no creator ambiguity exists.
create temp table cs on commit drop as
  select '00000000-0000-0000-0000-0000000e4001'::uuid as case_a;
grant select on cs to authenticated;
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy)
  select cs.case_a, k.comm_x, 99811, k.sa_y, 'commission_default' from cs, k;

-- =============================================================================
-- §1 BASELINE — role arms only (no relationship fixture exists yet).
-- =============================================================================
-- Each mask is CAPTURED in its own statement right after the claims change —
-- claims_for is a side effect, and AND-operand evaluation order inside one
-- expression is NOT guaranteed in Postgres, so hat-switch + read must never
-- share a statement.
select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
create temp table m_sa on commit drop as
  select app._case_caps((select case_a from cs), (select sa_x from k)) as caps;
select is(
  (select caps from m_sa),
  111,
  'A1 EXACT ⭐: staff_admin hat -> S1 coordinator mask 111 (everything but read_restricted_phi) — presences AND absences in one equality');

select test_helpers.claims_for((select sa_x from k), false, 'org_admin');
create temp table m_oa on commit drop as
  select app._case_caps((select case_a from cs), (select sa_x from k)) as caps;
select is(
  (select caps from m_oa),
  64,
  'A2 EXACT ⭐: org_admin hat, SAME user, SAME case -> S2 mask 64 (manage_case_access only) — every S1/S5 bit is GONE under the other hat');

-- A3: the mandate's own sentence, in bits — role-derived bits SET under one
-- hat and CLEAR under the other (not two zeros).
select ok(
  ((select caps from m_sa)
     & (app._cap_bit('view_case_overview') | app._cap_bit('write_case_content')))
    = (app._cap_bit('view_case_overview') | app._cap_bit('write_case_content'))
  and ((select caps from m_oa)
     & (app._cap_bit('view_case_overview') | app._cap_bit('write_case_content'))) = 0,
  'A3 ROLE DIVERGENCE ⭐: view_case_overview|write_case_content (33) SET under the staff_admin hat and CLEAR under the org_admin hat — a real divergence, not 0 vs 0');

-- A4: negative control for A11/A12 — bit 16 is CLEAR under BOTH hats before
-- the grant row exists (no role arm can confer it: S1 excludes it by design).
select ok(
  ((select caps from m_sa) & app._cap_bit('read_restricted_phi')) = 0
  and ((select caps from m_oa) & app._cap_bit('read_restricted_phi')) = 0,
  'A4 NEGATIVE CONTROL: read_restricted_phi (16) CLEAR under both hats pre-grant — A11/A12''s "identical" cannot be vacuous 0==0');

-- A4b: A5's NEGATIVE CONTROL, and A5 is worth nothing without it. A5 asserts that a hat
-- sa_x does not hold reads 64 UNDER THE MUTATION; that is a real transition only if the same
-- hat reads 0 BEFORE it. ⛔ Without this line, an A5 that measured 64 would be equally well
-- explained by a fixture where the bit was set all along — the BUG-VACUOUS-ASSERT-1 shape
-- A4 above rules out for bit 16, applied to the hat axis instead of the grant axis.
select test_helpers.claims_for((select sa_x from k), false, 'quality_reviewer');
select is(
  app._case_caps((select case_a from cs), (select sa_x from k)),
  0,
  'A4b NEGATIVE CONTROL ⭐ (AE4.7b): wearing a hat sa_x DOES NOT HOLD, every role-derived arm is shut and the mask is EXACTLY 0 — pre-mutation. A5''s 64 is therefore a transition, not a default');

-- =============================================================================
-- §2 MUTATION TWINS — prove the divergence assertions CAN fail (one function
--    at a time; byte-identical restore asserted after each).
-- =============================================================================
do $do$
declare v_orig text;
begin
  select pg_get_functiondef(p.oid) into v_orig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proname = 'has_role'
    and pg_get_function_identity_arguments(p.oid) = 'p_scope_type text, p_scope_id uuid, p_role text, p_user_id uuid';
  perform set_config('act319.orig_has_role', v_orig, false);

  execute $sql$
    create or replace function app.has_role(p_scope_type text, p_scope_id uuid, p_role text, p_user_id uuid)
     returns boolean language sql stable security definer
     set search_path to 'app', 'public', 'pg_catalog'
    as $body$
      select exists (
        select 1 from public.memberships m
        where m.principal_id = p_user_id
          and m.role = p_role
          and (m.expires_at is null or m.expires_at > now())
          and case p_scope_type
                when 'organization' then m.organization_id = p_scope_id
                when 'hospital'     then m.hospital_id     = p_scope_id
                when 'commission'   then m.commission_id   = p_scope_id
                else false
              end
      );
    $body$;
  $sql$;
end $do$;

-- ⭐⭐ AE4.7b — A5's OBSERVABLE MOVED HATS. Same subject (has_role's caller-only condition),
-- same fixture, same mutation; the ARM it is read through changed, because AE4.6 moved one.
--
-- Until the cutover, A5 wore the ORG_ADMIN hat and watched S1 leak: with the condition
-- stripped, is_staff_admin_of_for admitted regardless of hat and the org-hat mask rose 64 ->
-- 111. S1 now routes through the authz catalog (app.is_staff_admin_of_for -> authz.holds_role),
-- which carries its OWN hat conjunct — so mutating app.has_role can no longer open it, the mask
-- stayed 64, and A5 went red on the branch. ⛔ ORPHANED, NOT WRONG, and it failed LOUDLY: a
-- re-point that left the assertion satisfied would have been a hat twin testing no hat, green
-- forever.
--
-- ⛔⛔ AND THE OBVIOUS RE-POINT IS VACUOUS — MEASURED, NOT REASONED. The first repair wore
-- the STAFF_ADMIN hat and expected the mutation to add S2's manage_case_access bit on top of
-- S1: 111 | 64 = 175. It measured 111. **S1 ALREADY CONTAINS BIT 64** (1|2|4|8|32|64 = 111),
-- so S2's entire contribution is masked by the arm that is legitimately open, and the twin
-- observes nothing while looking exactly like a twin. A mutation whose effect lands inside
-- bits another arm already set is the same silent-vacuity shape this file's own A4 exists to
-- rule out — committed here because it was caught by a red, which is the only reason to trust
-- the replacement below.
--
-- ⭐ THE OBSERVABLE THAT WORKS: wear a hat sa_x DOES NOT HOLD (`quality_reviewer` — he holds
-- staff_admin@comm_x and org_admin@org_b, and claims_for does not require the membership).
-- Then EVERY role-derived arm is shut and the mask is 0 (A4b), so nothing can mask anything.
-- The mutation opens exactly one arm — S2, via is_tenancy_admin_of_for ->
-- has_role('organization', org_b, 'org_admin', ...) — and the mask becomes exactly 64.
--
-- ⭐⭐ THAT ONE EXACT EQUALITY CARRIES BOTH HALVES, which is why it is `is` and not a bit test:
--   * 64 PRESENT   — the hat gate on the still-has_role-routed arm demonstrably fails, so
--                    A2's 64 and A3's divergence are not vacuous;
--   * 111's OTHER BITS ABSENT — the CATALOG-routed S1 arm did NOT open under the same
--                    mutation. That is 319's copy of 315's arm-split control, and it is the
--                    measurement that explains why the old A5 was orphaned rather than broken.
-- ⚠ S7 is NOT opened by wearing the quality_reviewer HAT: the hat is a claim, not a
-- membership, and sa_x holds no quality_reviewer row for has_role to admit even unconditioned.
select test_helpers.claims_for((select sa_x from k), false, 'quality_reviewer');
select is(
  app._case_caps((select case_a from cs), (select sa_x from k)),
  64,
  'A5 MUTATION TWIN (has_role) ⭐: caller-only condition stripped -> a hat sa_x DOES NOT HOLD reads S2''s manage_case_access bit (0 -> 64) — the hat gate A2/A3 pin demonstrably fails. And exactly 64: the CATALOG-routed S1 arm stays shut under the same mutation, so this equality is the arm-split control too');

do $do$
begin execute current_setting('act319.orig_has_role', true); end $do$;
select is(
  (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'has_role'
     and pg_get_function_identity_arguments(p.oid) = 'p_scope_type text, p_scope_id uuid, p_role text, p_user_id uuid'),
  current_setting('act319.orig_has_role', true),
  'A6 RESTORE: has_role byte-identical to its pre-mutation definition');

do $do$
declare v_orig text;
begin
  select pg_get_functiondef(p.oid) into v_orig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proname = 'has_role_any';
  perform set_config('act319.orig_has_role_any', v_orig, false);

  execute $sql$
    create or replace function app.has_role_any(p_scope_type text, p_scope_id uuid, p_user_id uuid)
     returns boolean language sql stable security definer
     set search_path to 'app', 'public', 'pg_catalog'
    as $body$
      select exists (
        select 1 from public.memberships m
        where m.principal_id = p_user_id
          and (m.expires_at is null or m.expires_at > now())
          and case p_scope_type
                when 'organization' then m.organization_id = p_scope_id
                when 'hospital'     then m.hospital_id     = p_scope_id
                when 'commission'   then m.commission_id   = p_scope_id
                else false
              end
      );
    $body$;
  $sql$;
end $do$;

select test_helpers.claims_for((select sa_x from k), false, 'org_admin');
select is(
  app._case_caps((select case_a from cs), (select sa_x from k)),
  66,
  'A7 MUTATION TWIN (has_role_any) ⭐: condition stripped -> the S5 member arm leaks read_case_deliberation under the org_admin hat (64 -> 66) — A2''s exact mask is sensitive to the SIBLING door too');

do $do$
begin execute current_setting('act319.orig_has_role_any', true); end $do$;
select is(
  (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'has_role_any'),
  current_setting('act319.orig_has_role_any', true),
  'A8 RESTORE: has_role_any byte-identical to its pre-mutation definition');

-- =============================================================================
-- §3 RELATIONSHIP ARMS — grant (S3) + assignment (S4) on the SAME user+case.
-- =============================================================================
select set_config('request.jwt.claims', '', true);
insert into public.case_access_grants (case_id, principal_id, source, read_restricted_phi, read_standard_phi)
  select cs.case_a, k.sa_x, 'manual_grant', true, true from cs, k;
insert into public.case_phases (case_id, position, form_id, form_version_id, status, assigned_to, blocks)
  select cs.case_a, 1, k.form_u, k.ver_u, 'active', k.sa_x, '{}' from cs, k;

select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
create temp table m_sa2 on commit drop as
  select app._case_caps((select case_a from cs), (select sa_x from k)) as caps;
select is(
  (select caps from m_sa2),
  127,
  'A9 EXACT: staff_admin hat post-fixture -> 127 (111 | the grant''s read_restricted_phi)');

select test_helpers.claims_for((select sa_x from k), false, 'org_admin');
create temp table m_oa2 on commit drop as
  select app._case_caps((select case_a from cs), (select sa_x from k)) as caps;
select is(
  (select caps from m_oa2),
  94,
  'A10 EXACT ⭐: org_admin hat post-fixture -> 94 (S2 64 | grant 16|8 | assignment 4|2) — relationship bits arrived intact while every S1/S5 role bit stayed gone');

-- A11: the mandate's identity claim, non-vacuously — the relationship mask 30
-- is FULLY SET (not merely equal) under BOTH hats.
select ok(
  ((select caps from m_sa2) & 30) = 30
  and ((select caps from m_oa2) & 30) = 30,
  'A11 RELATIONSHIP IDENTITY ⭐: grant+assignment bits (16|8|4|2 = 30) SET AND IDENTICAL under both hats — non-zero on each side (A4 is the pre-fixture negative control)');

-- A12: the sharpest single bit — 16 is conferrable by NO role arm (S1 excludes
-- it by design), so its presence under both hats isolates the S3 grant arm.
select ok(
  ((select caps from m_sa2) & app._cap_bit('read_restricted_phi')) <> 0
  and ((select caps from m_oa2) & app._cap_bit('read_restricted_phi')) <> 0,
  'A12 GRANT-ONLY BIT ⭐: read_restricted_phi SET under both hats — only the S3 ACL row can confer it, so the D6-immune arm provably fires under EVERY hat');

-- A13: D5 x D6 — a hatless multi-role caller keeps ONLY the relationship bits.
-- claims_for with no explicit role derives nothing for a multi-role principal
-- (sa_x holds two role types), so active_role() is NULL: every role arm fails
-- closed (D5) while grant+assignment survive (D6 immunity includes the no-hat
-- state — a case does not stop being about you because you have not picked a
-- hat). Pins the semantics AS BUILT; if the PO ever rules relationship reach
-- must ALSO require a hat, this assertion is the one that must consciously red.
select test_helpers.claims_for((select sa_x from k), false);
select is(
  app._case_caps((select case_a from cs), (select sa_x from k)),
  30,
  'A13 HATLESS (D5 x D6): no active hat -> role arms 0, relationship arms intact (30 exactly)');

-- A14: the third-party disarm — sa_y (own hat active) evaluates sa_x's caps;
-- the caller-only condition disarms (p_uid <> auth.uid()) and the resolver
-- reports sa_x's FULL grant set. This is the designed behaviour every
-- third-party door (and file_correction_request's corrector check) rests on:
-- one user's hat must never change what the system concludes about ANOTHER.
select test_helpers.claims_for((select sa_y from k), false, 'staff_admin');
select is(
  app._case_caps((select case_a from cs), (select sa_x from k)),
  127,
  'A14 THIRD-PARTY DISARM ⭐: sa_y (wearing staff_admin) asks about sa_x -> full 127, hat-independent — and the contrast with A9/A10 proves the hat clause keys on auth.uid(), not on session decoration');

-- =============================================================================
-- §4 HARD DENY — recusal zeroes EVERYTHING, under every hat and for
--    third-party evaluation alike (D6 protective immunity). Non-vacuous
--    because A9/A10/A14 just measured 127/94/127 on the same fixtures.
-- =============================================================================
select set_config('request.jwt.claims', '', true);
insert into public.case_recusals (case_id, user_id, source)
  select cs.case_a, k.sa_x, 'coordinator' from cs, k;

select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
select is(
  app._case_caps((select case_a from cs), (select sa_x from k)),
  0,
  'A15 RECUSAL ⭐: the widest role hat (staff_admin, 127 moments ago) reads 0 — no hat outruns a recusal');

select test_helpers.claims_for((select sa_x from k), false, 'org_admin');
select is(
  app._case_caps((select case_a from cs), (select sa_x from k)),
  0,
  'A16 RECUSAL: org_admin hat reads 0 (was 94)');

select test_helpers.claims_for((select sa_y from k), false, 'staff_admin');
select is(
  app._case_caps((select case_a from cs), (select sa_x from k)),
  0,
  'A17 RECUSAL, third-party view: even the hat-free evaluation path reports 0 (was 127) — the deny is relationship-derived, not hat mechanics');

select * from finish();
rollback;

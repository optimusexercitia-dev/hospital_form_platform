-- AE2.3a — THE WIDENING DIFFERENTIAL, READ/VISIBILITY HALF (the phase keystone).
-- Plan docs/plans/authz-evolution.md § AE2.3; ruling ADR 0163; phase record
-- docs/progress/authz-ae2.md § AE2.2.
--
-- ============================================================================
-- ⛔ SCOPE — AE2.3 IS SPLIT, AND THE SPLIT IS NOT A CONVENIENCE
-- ============================================================================
-- The plan's AE2.3 demands the differential cover "containment-trigger accept
-- AND reject · affiliation lifecycle transitions" and "INSERT `WITH CHECK` ·
-- UPDATE new-row `WITH CHECK`".  Neither has a subject in AE2.2:
--
--   • The containment trigger was ruled **T3** — it belongs to AE2.4, because
--     the door that CREATES an org affiliation is itself gated on the column,
--     so both halves must break in one move (docs/progress/authz-ae2.md).
--     `public.assert_profile_tenant_has_org` is UNCHANGED by AE2.2.
--   • The AE2.1 census measured all three re-predicated legs as `SELECT` only,
--     with **ZERO** `with_check`.  § 1.1 re-measures that here rather than
--     citing it.
--
-- ⛔ Writing those cells anyway would produce a suite that is GREEN HAVING
--    ASSERTED NOTHING — the exact vacuity family this repo keeps paying for
--    (docs/reviews/vacuous-assertion-audit.md).  So:
--
--   AE2.3a  (THIS SUITE)  the READ/VISIBILITY half — the 3 SELECT legs,
--                         `list_addable_commission_members`, and every door
--                         consuming the changed predicate.
--   AE2.3b  (AE2.4)       the WRITE/CONTAINMENT half — the containment trigger,
--                         `app.affiliate_person_to_org_impl`, the picker.
--
-- ⚠ The plan's warning "the phase changes write containment; a read-only
--   differential proves the wrong half" is TRUE — **of AE2.4**.  AE2.2 changed
--   no write containment at all, so for AE2.2 the read half is the whole half.
--   ⛔ Do not read this suite as discharging AE2.4's differential.
--
-- ============================================================================
-- WHAT "DIFFERENTIAL" MEANS HERE, AND WHY IT IS ONE TRANSACTION
-- ============================================================================
-- Both predicates are evaluated in ONE transaction, per (caller, target) pair,
-- so no stack state can skew one side against the other:
--
--   OLD (verbatim from the AE2.2 per-leg contract table, docs/progress/authz-ae2.md,
--        which reproduced it from the live catalog BEFORE migration 20261003005400):
--          (home_organization_id IS NOT NULL) AND app.is_org_admin_of(home_organization_id)
--   NEW:   app.can_administer_person_via_affiliation(person)
--
-- The OLD predicate no longer exists in the catalog, so it is REPRODUCED here.
-- ⚠ That reproduction is honest only because of two things asserted below and
--   not assumed: § 1.1 (no policy anywhere still names the column, so there is
--   no second, unreproduced copy) and § 6.2 (the roster door's old row filter
--   reproduced in full, not just its changed conjunct).
--
-- The OLD leg is evaluated against an **RLS-free snapshot** of
-- `home_organization_id`, because it was a POLICY predicate applied to the row
-- already in hand — never a re-read under the caller's RLS.  Re-reading it
-- through `public.profiles` would evaluate it under the NEW policy and silently
-- make the differential compare the new predicate with itself.
--
-- ============================================================================
-- THE RULE THIS SUITE ENFORCES (ADR 0154; plan PA-F13)
-- ============================================================================
-- Every intended WIDENING is PRE-DECLARED as an expected cell.  A widening that
-- is not pre-declared is a RED.  Narrowing can be wrong and safe; unapproved
-- widening cannot.  § 2.3 compares the measured widenings against a hand-written
-- list carrying a REASON per pair; § 2.4 does the same for newly-hidden pairs,
-- each carrying a written disposition.  ⚠ Those two lists are written
-- INDEPENDENTLY of § 2.2's expectation table on purpose: deriving them from it
-- would make them restatements, green whenever § 2.2 is green.  § 2.5 is the
-- cross-check that reds if the two hand artefacts ever disagree.
--
-- ---------------------------------------------------------------------------
-- THE FIVE PRE-DECLARED WIDENINGS, WITH REASONS
-- ---------------------------------------------------------------------------
--   CB×T4  ended in A, ACTIVE in B          → B is the current employer; ADR 0163
--                                             arm 2 must not fire while arm 1 is
--                                             non-empty (bound 3).
--   CB×T5  the ended_on TIE (A and B same    → ADR 0163 bound 2: ties yield ALL tied
--          day, nothing active)                orgs.  ⭐ THIS CELL EXISTS BECAUSE AN
--                                               ARBITRARY TIE-BREAK IS A *NARROWING*,
--                                               and a differential that only
--                                               pre-declares widenings would never
--                                               notice one.
--   CB×T7  ACTIVE in BOTH A and B            → the plan's own named example: a person
--                                             affiliated to two organisations becomes
--                                             legitimately visible to both.
--   CB×T8  column says A, ACTIVE only in B   → the substrate is the truth; the column
--                                             stopped deciding.  This is the whole
--                                             point of AE2.
--   CC×T10 column says A, ACTIVE only in C   → same class as CB×T8, measured through a
--                                             CROSS-ORG actor (org C) so the widening
--                                             is not an artefact of the A/B pair.
--
-- ---------------------------------------------------------------------------
-- THE FIVE NEWLY-HIDDEN PAIRS, EACH ACCEPTED IN WRITING
-- ---------------------------------------------------------------------------
--   CA×T3  voided-only person        ACCEPT — ADR 0163 bound 1: a voided row is "was
--                                    never true" and is excluded from the derivation
--                                    ENTIRELY.  Hiding it is the bound working.
--   CA×T4  ended in A, active in B   ACCEPT — authority follows the ACTIVE org; an
--                                    ended row must not add reach on top of it.
--   CA×T8  column A, active B        ACCEPT — the intended mechanism change.
--   CA×T10 column A, active C        ACCEPT — same class as CA×T8.
--   CA×T9  NO affiliation row at all ACCEPT, WITH ITS BLAST RADIUS NAMED.  Under the
--                                    column an org_admin of the anchor org could read
--                                    such a person; under ADR 0163 they have no
--                                    retaining org and become platform_admin-only.
--                                    ⚠ The state is CONSTRUCTED, not normally
--                                    reachable: every person is created through an
--                                    affiliation-creating door, and the seed has
--                                    exactly one profile with no affiliation row —
--                                    `platform@test.local`, who is `is_admin` and
--                                    already reached by `app.is_admin()`.  Recorded
--                                    as an accepted narrowing rather than as "cannot
--                                    happen", because ⛔ "not reachable" is not
--                                    "protected".
--
-- ============================================================================
-- THE CELLS THE SEED CANNOT REACH — CONSTRUCTED, WITH DISTINCT IDS
-- ============================================================================
-- ⛔ NO seeded persona holds a membership or affiliation outside its home org,
--    and there is NO cross-org persona — a cross-org test written against
--    `multi@test.local` passes while proving nothing (CLAUDE.md § 9).  So the
--    cross-org axis is built here: `solo.c@test.local` is the actor (org C, a
--    one-person organisation) and T10 is the only subject it can ever reach.
--
-- ⚠ Every fixture person gets its OWN id in the `0ae23a…` namespace — disjoint
--   from 390's `0000ae22…` and 391's `0000ae23…`.  Fixtures that SHARE ids
--   across cases fabricate both defects and all-clears, and every deletion in
--   this suite is by identity, never positional (the rollback does it all).
--
--   T1  active in A                              the ordinary case
--   T2  ended in A, non-voided, nothing else     ADR 0163's actual subject
--   T3  ONLY a voided row in A                   bound 1 — excluded entirely
--   T4  ended in A + ACTIVE in B                 arm 2 must not fire
--   T5  ended in A and B ON THE SAME DAY         bound 2 — ALL tied orgs
--   T6  non-voided ends EARLY (A); VOIDED ends   ⭐ the voided-ordering trap:
--       LATE (B)                                 filtering voided AFTER max()
--                                                yields EMPTY — a total, silent
--                                                loss of authority.  390 § C7
--                                                covers the predicate; § 3.3
--                                                asserts it at the POLICY level.
--   T7  ACTIVE in BOTH A and B                   the pre-declared widening
--   T8  column A, ACTIVE only in B               the column stopped deciding
--   T9  NO affiliation row at all                the honest empty
--   T10 column A, ACTIVE only in C               the cross-org cell
--
-- ============================================================================
-- WHY THE POLICY-LEVEL NUMBERS ARE NOT ABSORBED BY SIBLING ARMS
-- ============================================================================
-- All three re-predicated policies are PERMISSIVE and OR'd with siblings, so a
-- table-level read test normally proves nothing about one leg.  § 0.2/§ 0.3/
-- § 0.5 buy the isolation: every fixture person holds ZERO memberships and ZERO
-- hospital affiliations, and no caller is a platform admin — so the changed leg
-- is the ONLY route into them.  That is what licenses § 3.1/§ 3.2 to assert
-- policy-level visibility EQUALS the leg, pair for pair.
--
-- ============================================================================
-- § 5 — THE `professional_credentials` PRE-DECLARED WIDENING CANDIDATE
-- ============================================================================
-- AE2.2 handed this over as "believed set-identical, but that is AN ARGUMENT,
-- NOT A MEASUREMENT".  The old leg ran its `profiles` sub-select under the
-- CALLER's RLS; the new DEFINER call removes that implicit second gate.
--
-- Measured here, over all 50 pairs including every constructed cell: § 5.1
-- (credentials visible ⇒ profiles row visible) and § 5.2 (the two are equal in
-- BOTH directions), with § 5.3 as the floor that stops both from being
-- vacuously true over an all-false matrix.
--
-- ⚠ WHAT IS MEASURED AND WHAT IS REDUCED, STATED SO NEITHER IS OVERSOLD.  The
--   removed gate could only ever BIND if the credentials leg's inner condition
--   were not itself a disjunct of the `profiles` SELECT policy — and it was, and
--   its replacement still is (§ 1.2 pins exactly that, so a future divergence
--   reds here and forces this measurement to be redone).  Given that, the old
--   leg reduces to its inner condition under BOTH readings of how Postgres
--   applies RLS to tables referenced inside a policy expression, so the
--   conclusion does not depend on resolving that question.  The behavioural
--   half — that the gate is non-binding IN FACT, on every pair — is measured.
--
-- ============================================================================
-- § 6 — THE ROSTER DOOR, AND A DIVERGENCE THAT IS MEASURED RATHER THAN ARGUED
-- ============================================================================
-- `list_addable_commission_members` deliberately uses ACTIVE affiliation, NOT
-- `app.person_authority_orgs`: the two doors answer different questions
-- ("who may ADMINISTER this person" vs "who may be STAFFED here"), and ADR 0163's
-- retention was never an input to the second.  § 6.4 turns that from a stated
-- intention into a measurement: T2, T5 and T6 ARE retained for org A by the
-- authority predicate and are NOT addable to org A's commission.  If anyone ever
-- "unifies" the two predicates, § 6.3 and § 6.4 disagree.
--
-- ⭐ RED-FIRST / VACUITY PROOF.  A keystone green on its first run is vacuous.
--    This suite's ability to fail was proven by MUTATION rather than by writing
--    it before a change it does not make: `app.person_authority_orgs` arm 2's
--    `not exists (… active …)` guard was removed in the catalog, which widens
--    CA×T4 — an UNDECLARED widening — and § 2.2/§ 2.3 red.  The edit was
--    asserted to have LANDED from `pg_proc` (never from a command exit status)
--    and rolled back byte-identically.  Recorded in docs/progress/authz-ae2.md.
-- ============================================================================

begin;
select plan(38);

-- ---------------------------------------------------------------------------
-- Constants.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.k()
returns table (
  org_a uuid, org_b uuid, org_c uuid, ccih uuid, qual_b uuid,
  ca uuid, cb uuid, cc uuid, ch uuid, cs uuid, chefe uuid
)
language sql immutable as $$
  select '0c000000-0000-0000-0000-00000000000a'::uuid,  -- Rede Hospitalar A
         '0c000000-0000-0000-0000-00000000000b'::uuid,  -- Rede Hospitalar B
         '0c000000-0000-0000-0000-00000000000c'::uuid,  -- Rede Hospitalar C
         'a0000000-0000-0000-0000-0000000000a1'::uuid,  -- CCIH               (org A)
         'c0000000-0000-0000-0000-0000000000c1'::uuid,  -- Qualidade e Seg.   (org B)
         '00000000-0000-0000-0000-0000000000b1'::uuid,  -- orgadmin.a
         '00000000-0000-0000-0000-0000000000b2'::uuid,  -- orgadmin.b
         '00000000-0000-0000-0000-0000000000c0'::uuid,  -- solo.c  (CROSS-ORG actor)
         '00000000-0000-0000-0000-0000000000e1'::uuid,  -- hospitaladmin.a1
         '00000000-0000-0000-0000-000000000003'::uuid,  -- staff1.ccih (D3 collapse)
         '00000000-0000-0000-0000-000000000002'::uuid;  -- chefe.ccih  (roster caller)
$$;
grant execute on function pg_temp.k() to authenticated;

-- ---------------------------------------------------------------------------
-- ⭐ THE SEED SNAPSHOT IS TAKEN **BEFORE** THE FIXTURES EXIST, so § 8's
--    zero-movement claim is about the seed population and cannot be diluted (or
--    inflated) by the ten constructed persons.
-- ---------------------------------------------------------------------------
create temp table ae23_seed as
  select p.id as person_id, p.home_organization_id from public.profiles p;
grant select on ae23_seed to authenticated;

create temp table ae23_callers (label text primary key, caller uuid, role_hint text);
insert into ae23_callers values
  ('CA', (select ca    from pg_temp.k()), 'org_admin'),
  ('CB', (select cb    from pg_temp.k()), 'org_admin'),
  ('CC', (select cc    from pg_temp.k()), 'org_admin'),
  ('CH', (select ch    from pg_temp.k()), 'hospital_admin'),
  ('CS', (select cs    from pg_temp.k()), 'staff');
grant select on ae23_callers to authenticated;

create temp table ae23_targets (label text primary key, target uuid, note text);
insert into ae23_targets values
  ('T1',  '00000000-0000-0000-0000-0ae23a000001', 'active in A'),
  ('T2',  '00000000-0000-0000-0000-0ae23a000002', 'fully offboarded: ended in A, non-voided'),
  ('T3',  '00000000-0000-0000-0000-0ae23a000003', 'voided-only'),
  ('T4',  '00000000-0000-0000-0000-0ae23a000004', 'ended in A, ACTIVE in B'),
  ('T5',  '00000000-0000-0000-0000-0ae23a000005', 'ended_on TIE across A and B'),
  ('T6',  '00000000-0000-0000-0000-0ae23a000006', 'voided-ordering trap: voided row ends LATER'),
  ('T7',  '00000000-0000-0000-0000-0ae23a000007', 'ACTIVE in both A and B'),
  ('T8',  '00000000-0000-0000-0000-0ae23a000008', 'column A, ACTIVE only in B'),
  ('T9',  '00000000-0000-0000-0000-0ae23a000009', 'no affiliation row at all'),
  ('T10', '00000000-0000-0000-0000-0ae23a00000a', 'column A, ACTIVE only in C (cross-org)');
grant select on ae23_targets to authenticated;

-- ---------------------------------------------------------------------------
-- Fixture principals.  `handle_new_user` mints the profile from auth.users;
-- `home_organization_id` is then set EXPLICITLY to org A for ALL TEN — including
-- the ones whose only affiliation is elsewhere.  That is what makes this a
-- differential rather than a snapshot: under the OLD predicate orgadmin.a
-- administered all ten, so every removal is attributable to the new predicate
-- and to nothing else.
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', t.target, 'authenticated', 'authenticated',
       t.target || '@ae23a.test', now(), now()
from pg_temp.ae23_targets t;

update public.profiles
   set home_organization_id = (select org_a from pg_temp.k()),
       full_name = 'AE23a fixture ' || (select label from pg_temp.ae23_targets t where t.target = profiles.id),
       is_active = true
 where id in (select target from pg_temp.ae23_targets);

-- The affiliation substrate.  `started_on` precedes every `ended_on`
-- (organization_affiliations_period_ck) and every voided row carries a reason
-- (organization_affiliations_voided_shape).
insert into public.organization_affiliations
  (principal_id, organization_id, started_on, ended_on, ended_by, voided_at, voided_by, void_reason, created_by)
values
  -- T1 — active in A.
  ('00000000-0000-0000-0000-0ae23a000001', (select org_a from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select ca from pg_temp.k())),
  -- T2 — ADR 0163's subject: one ENDED, non-voided row in A.
  ('00000000-0000-0000-0000-0ae23a000002', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), null, null, null, (select ca from pg_temp.k())),
  -- T3 — the only row is VOIDED.  Bound 1: no retaining org at all.
  ('00000000-0000-0000-0000-0ae23a000003', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), now(), (select ca from pg_temp.k()), 'lançamento equivocado', (select ca from pg_temp.k())),
  -- T4 — ended in A, still ACTIVE in B.  Retention must NOT fire for A.
  ('00000000-0000-0000-0000-0ae23a000004', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), null, null, null, (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae23a000004', (select org_b from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select cb from pg_temp.k())),
  -- T5 — the TIE.  Both end 2026-02-20; nothing active.  Bound 2 → {A, B}.
  ('00000000-0000-0000-0000-0ae23a000005', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-02-20', (select ca from pg_temp.k()), null, null, null, (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae23a000005', (select org_b from pg_temp.k()), date '2025-01-01', date '2026-02-20', (select cb from pg_temp.k()), null, null, null, (select cb from pg_temp.k())),
  -- T6 — the VOIDED-ORDERING TRAP.  Non-voided A ends 2026-01-10; VOIDED B ends
  --      2026-06-10.  Correct answer {A}; a max() computed before the void
  --      filter returns EMPTY.
  ('00000000-0000-0000-0000-0ae23a000006', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), null, null, null, (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae23a000006', (select org_b from pg_temp.k()), date '2025-01-01', date '2026-06-10', (select cb from pg_temp.k()), now(), (select cb from pg_temp.k()), 'lançamento equivocado', (select cb from pg_temp.k())),
  -- T7 — active in BOTH.  The pre-declared widening.
  ('00000000-0000-0000-0000-0ae23a000007', (select org_a from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae23a000007', (select org_b from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select cb from pg_temp.k())),
  -- T8 — the column says A; the only affiliation is an ACTIVE one in B.
  ('00000000-0000-0000-0000-0ae23a000008', (select org_b from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select cb from pg_temp.k())),
  -- T10 — the CROSS-ORG cell: column A, active affiliation in C.
  ('00000000-0000-0000-0000-0ae23a00000a', (select org_c from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select cc from pg_temp.k()));
-- T9 deliberately gets no row at all.

-- Credentials for ALL ten, so § 5's `credentials ⇔ profiles` comparison covers
-- the same 50 pairs as § 3 rather than a subset chosen after the fact.
insert into public.professional_credentials
  (user_id, issuing_country, issuing_state, issuing_authority, registration_number)
select t.target, 'BR', 'SP', 'COREN', 'AE23A-' || t.label from pg_temp.ae23_targets t;

-- ---------------------------------------------------------------------------
-- The RLS-FREE snapshot of the column, taken as postgres.  ⛔ The OLD leg was a
-- POLICY predicate applied to the row already in hand; re-reading the column
-- through `public.profiles` under the caller would evaluate it under the NEW
-- policy and make the differential compare the new predicate with itself.
-- ---------------------------------------------------------------------------
create temp table ae23_snapshot as
  select p.id as person_id, p.home_organization_id
    from public.profiles p
   where p.id in (select target from pg_temp.ae23_targets);
grant select on ae23_snapshot to authenticated;

create temp table ae23_matrix (
  caller uuid, target uuid, old_leg bool, new_leg bool, prof_visible bool, cred_visible bool);
grant select, insert on ae23_matrix to authenticated;

create temp table ae23_seed_matrix (caller uuid, person_id uuid, old_leg bool, new_leg bool);
grant select, insert on ae23_seed_matrix to authenticated;

create temp table ae23_roster (commission uuid, caller uuid, user_id uuid);
grant select, insert on ae23_roster to authenticated;

-- ---------------------------------------------------------------------------
-- THE PRE-DECLARATION.  All 50 cells, written out.  Explicitness IS the
-- pre-declaration: a cell that is not here cannot arrive silently.
-- ---------------------------------------------------------------------------
create temp table ae23_expected (caller_label text, target_label text, old_leg bool, new_leg bool, verdict text);
insert into ae23_expected values
  -- CA = orgadmin.a.  The column anchored ALL TEN to org A, so old is TRUE for
  -- every one of them, and every FALSE below is a narrowing this suite owns.
  ('CA','T1', true,  true,  'unchanged'),
  ('CA','T2', true,  true,  'unchanged'),   -- ADR 0163 retention keeps it TRUE
  ('CA','T3', true,  false, 'NARROWING'),
  ('CA','T4', true,  false, 'NARROWING'),
  ('CA','T5', true,  true,  'unchanged'),   -- tie → A is one of the retaining orgs
  ('CA','T6', true,  true,  'unchanged'),   -- void excluded BEFORE max() → A
  ('CA','T7', true,  true,  'unchanged'),
  ('CA','T8', true,  false, 'NARROWING'),
  ('CA','T9', true,  false, 'NARROWING'),
  ('CA','T10',true,  false, 'NARROWING'),
  -- CB = orgadmin.b.  Old is FALSE throughout (no target's column says B), so
  -- every TRUE below is a widening and must appear in ae23_widenings.
  ('CB','T1', false, false, 'unchanged'),
  ('CB','T2', false, false, 'unchanged'),
  ('CB','T3', false, false, 'unchanged'),
  ('CB','T4', false, true,  'WIDENING'),
  ('CB','T5', false, true,  'WIDENING'),
  ('CB','T6', false, false, 'unchanged'),   -- B's row is VOIDED → excluded entirely
  ('CB','T7', false, true,  'WIDENING'),
  ('CB','T8', false, true,  'WIDENING'),
  ('CB','T9', false, false, 'unchanged'),
  ('CB','T10',false, false, 'unchanged'),
  -- CC = solo.c, the CROSS-ORG actor.  Reaches exactly one person, ever.
  ('CC','T1', false, false, 'unchanged'),
  ('CC','T2', false, false, 'unchanged'),
  ('CC','T3', false, false, 'unchanged'),
  ('CC','T4', false, false, 'unchanged'),
  ('CC','T5', false, false, 'unchanged'),
  ('CC','T6', false, false, 'unchanged'),
  ('CC','T7', false, false, 'unchanged'),
  ('CC','T8', false, false, 'unchanged'),
  ('CC','T9', false, false, 'unchanged'),
  ('CC','T10',false, true,  'WIDENING'),
  -- CH = hospitaladmin.a1.  ADR 0163 bound 4: this ADR adds NO hospital-tier
  -- reach.  All false, both sides.
  ('CH','T1', false, false, 'unchanged'),
  ('CH','T2', false, false, 'unchanged'),
  ('CH','T3', false, false, 'unchanged'),
  ('CH','T4', false, false, 'unchanged'),
  ('CH','T5', false, false, 'unchanged'),
  ('CH','T6', false, false, 'unchanged'),
  ('CH','T7', false, false, 'unchanged'),
  ('CH','T8', false, false, 'unchanged'),
  ('CH','T9', false, false, 'unchanged'),
  ('CH','T10',false, false, 'unchanged'),
  -- CS = staff1.ccih.  THE D3 COLLAPSE CELL: shares an ACTIVE org-A affiliation
  -- with T1/T7 and holds NO org_admin membership.  All false, both sides.  This
  -- is what reds if LOCATE and GRANT are ever collapsed into one join.
  ('CS','T1', false, false, 'unchanged'),
  ('CS','T2', false, false, 'unchanged'),
  ('CS','T3', false, false, 'unchanged'),
  ('CS','T4', false, false, 'unchanged'),
  ('CS','T5', false, false, 'unchanged'),
  ('CS','T6', false, false, 'unchanged'),
  ('CS','T7', false, false, 'unchanged'),
  ('CS','T8', false, false, 'unchanged'),
  ('CS','T9', false, false, 'unchanged'),
  ('CS','T10',false, false, 'unchanged');

-- ⚠ WRITTEN INDEPENDENTLY of ae23_expected, on purpose.  Derived from it these
--   would be restatements — green whenever § 2.2 is green.  § 2.5 cross-checks.
create temp table ae23_widenings (caller_label text, target_label text, reason text);
insert into ae23_widenings values
  ('CB','T4',  'ended in A but ACTIVE in B — arm 2 must not fire while arm 1 is non-empty (ADR 0163 bound 3)'),
  ('CB','T5',  'the ended_on TIE — bound 2 yields ALL tied orgs; an arbitrary tie-break would be a silent NARROWING'),
  ('CB','T7',  'ACTIVE in both A and B — the plan''s own named legitimate widening'),
  ('CB','T8',  'column says A, ACTIVE only in B — the substrate is the truth'),
  ('CC','T10', 'CROSS-ORG actor: column says A, ACTIVE only in C');

create temp table ae23_narrowings (caller_label text, target_label text, disposition text);
insert into ae23_narrowings values
  ('CA','T3',  'ACCEPT — bound 1, a voided row is "was never true" and is excluded from the derivation entirely'),
  ('CA','T4',  'ACCEPT — authority follows the ACTIVE org; an ended row adds no reach on top of it'),
  ('CA','T8',  'ACCEPT — the intended mechanism change: the column stopped deciding'),
  ('CA','T9',  'ACCEPT — no affiliation row, so no retaining org; platform_admin-only. Blast radius named in the header; the state is CONSTRUCTED, and "not reachable" is not "protected"'),
  ('CA','T10', 'ACCEPT — same class as CA×T8, measured across the org-C boundary');

-- ============================================================================
-- § 0  PRECONDITIONS AND VACUITY GUARDS
-- ============================================================================
select is(
  (select count(*)::int from public.profiles p join pg_temp.ae23_targets t on t.target = p.id
    where p.home_organization_id = (select org_a from pg_temp.k()) and p.is_active and not p.is_admin), 10,
  '0.1 ⭐ THE DIFFERENTIAL GUARD: all ten fixture persons are ACTIVE, non-admin and anchored by the COLUMN to org A — so the OLD predicate admitted all ten for orgadmin.a, and every narrowing below is attributable to the new predicate alone');

select is(
  (select count(*)::int from public.memberships m where m.principal_id in (select target from pg_temp.ae23_targets)), 0,
  '0.2 VACUITY GUARD: the fixture persons hold ZERO memberships — the commission/tenancy sibling arms of both profiles policies cannot carry any read in § 3');

select is(
  (select count(*)::int from public.hospital_affiliations ha where ha.principal_id in (select target from pg_temp.ae23_targets)), 0,
  '0.3 VACUITY GUARD: the fixture persons hold ZERO hospital affiliations — the hospital_admin sibling arms cannot carry any read in § 3 either');

select is(
  (select count(*)::int from public.professional_credentials pc where pc.user_id in (select target from pg_temp.ae23_targets)), 10,
  '0.4 PRECONDITION: every fixture person HAS a credential row, so § 5 measures a real read rather than an empty table');

select is(
  (select count(*)::int from public.profiles p join pg_temp.ae23_callers c on c.caller = p.id where p.is_admin), 0,
  '0.5 VACUITY GUARD: not one of the five callers is a platform_admin — app.is_admin() would satisfy leg 1 of two of the three policies regardless of any affiliation');

select is(
  (select count(*)::int from public.organization_affiliations oa
    where oa.principal_id = '00000000-0000-0000-0000-0ae23a000003' and oa.voided_at is not null), 1,
  '0.6 VACUITY GUARD: T3 HAS an affiliation row and it is voided — its denial means "voided is excluded", not "no fixture"');

select is(
  (select count(*)::int from public.organization_affiliations v
    where v.principal_id = '00000000-0000-0000-0000-0ae23a000006' and v.voided_at is not null
      and v.ended_on > (select nv.ended_on from public.organization_affiliations nv
                         where nv.principal_id = '00000000-0000-0000-0000-0ae23a000006' and nv.voided_at is null)), 1,
  '0.7 ⭐ THE TRAP IS ACTUALLY BUILT: T6''s VOIDED row ends LATER than its non-voided one. Without this the § 3.3 green would only mean the fixture never reached the failing state');

select is(
  (select count(*)::int from public.organization_affiliations oa
    where oa.principal_id = '00000000-0000-0000-0000-0ae23a000009'), 0,
  '0.8 PRECONDITION: T9 genuinely has zero affiliation rows — the honest empty, distinct from T3''s voided-only one');

-- ============================================================================
-- § 1  THE OLD PREDICATE IS GONE, AND THE NEW ONE IS THE SAME CALL EVERYWHERE
-- ============================================================================
select is(
  (select count(*)::int from pg_policies
    where coalesce(qual, '') || coalesce(with_check, '') like '%home_organization_id%'), 0,
  '1.1 ⭐ NO POLICY ANYWHERE still names home_organization_id (unanchored, over qual AND with_check) — so the OLD predicate reproduced in this suite is the only copy of it, and there is no second, unreproduced leg the differential is blind to');

select is(
  (select count(*)::int from pg_policies
    where policyname in ('profiles_admin_select', 'profiles_select_self_or_admin', 'professional_credentials_select')
      and cmd = 'SELECT' and with_check is null
      and coalesce(qual, '') like '%app.can_administer_person_via_affiliation(%'), 3,
  '1.2 ⭐ all three re-predicated legs are SELECT-only with NULL with_check and carry the IDENTICAL call. This is what licenses § 5''s reduction (the removed implicit gate could only bind if the credentials leg were not also a profiles disjunct) AND what makes the plan''s "INSERT/UPDATE WITH CHECK" cells subjectless rather than skipped');

-- ============================================================================
-- § 2  THE DIFFERENTIAL — measured per (caller, target), both predicates in ONE
--      transaction, against a pre-declaration written before the run
-- ============================================================================
select test_helpers.claims_for((select ca from pg_temp.k()), false, 'org_admin');
set local role authenticated;
insert into pg_temp.ae23_matrix
select (select ca from pg_temp.k()), t.target,
       (s.home_organization_id is not null and app.is_org_admin_of(s.home_organization_id)),
       app.can_administer_person_via_affiliation(t.target),
       exists (select 1 from public.profiles pr where pr.id = t.target),
       exists (select 1 from public.professional_credentials pc where pc.user_id = t.target)
  from pg_temp.ae23_targets t join pg_temp.ae23_snapshot s on s.person_id = t.target;
insert into pg_temp.ae23_seed_matrix
select (select ca from pg_temp.k()), sd.person_id,
       (sd.home_organization_id is not null and app.is_org_admin_of(sd.home_organization_id)),
       app.can_administer_person_via_affiliation(sd.person_id)
  from pg_temp.ae23_seed sd;
reset role;

select test_helpers.claims_for((select cb from pg_temp.k()), false, 'org_admin');
set local role authenticated;
insert into pg_temp.ae23_matrix
select (select cb from pg_temp.k()), t.target,
       (s.home_organization_id is not null and app.is_org_admin_of(s.home_organization_id)),
       app.can_administer_person_via_affiliation(t.target),
       exists (select 1 from public.profiles pr where pr.id = t.target),
       exists (select 1 from public.professional_credentials pc where pc.user_id = t.target)
  from pg_temp.ae23_targets t join pg_temp.ae23_snapshot s on s.person_id = t.target;
insert into pg_temp.ae23_seed_matrix
select (select cb from pg_temp.k()), sd.person_id,
       (sd.home_organization_id is not null and app.is_org_admin_of(sd.home_organization_id)),
       app.can_administer_person_via_affiliation(sd.person_id)
  from pg_temp.ae23_seed sd;
reset role;

select test_helpers.claims_for((select cc from pg_temp.k()), false, 'org_admin');
set local role authenticated;
insert into pg_temp.ae23_matrix
select (select cc from pg_temp.k()), t.target,
       (s.home_organization_id is not null and app.is_org_admin_of(s.home_organization_id)),
       app.can_administer_person_via_affiliation(t.target),
       exists (select 1 from public.profiles pr where pr.id = t.target),
       exists (select 1 from public.professional_credentials pc where pc.user_id = t.target)
  from pg_temp.ae23_targets t join pg_temp.ae23_snapshot s on s.person_id = t.target;
insert into pg_temp.ae23_seed_matrix
select (select cc from pg_temp.k()), sd.person_id,
       (sd.home_organization_id is not null and app.is_org_admin_of(sd.home_organization_id)),
       app.can_administer_person_via_affiliation(sd.person_id)
  from pg_temp.ae23_seed sd;
reset role;

select test_helpers.claims_for((select ch from pg_temp.k()), false, 'hospital_admin');
set local role authenticated;
insert into pg_temp.ae23_matrix
select (select ch from pg_temp.k()), t.target,
       (s.home_organization_id is not null and app.is_org_admin_of(s.home_organization_id)),
       app.can_administer_person_via_affiliation(t.target),
       exists (select 1 from public.profiles pr where pr.id = t.target),
       exists (select 1 from public.professional_credentials pc where pc.user_id = t.target)
  from pg_temp.ae23_targets t join pg_temp.ae23_snapshot s on s.person_id = t.target;
reset role;

select test_helpers.claims_for((select cs from pg_temp.k()), false, 'staff');
set local role authenticated;
insert into pg_temp.ae23_matrix
select (select cs from pg_temp.k()), t.target,
       (s.home_organization_id is not null and app.is_org_admin_of(s.home_organization_id)),
       app.can_administer_person_via_affiliation(t.target),
       exists (select 1 from public.profiles pr where pr.id = t.target),
       exists (select 1 from public.professional_credentials pc where pc.user_id = t.target)
  from pg_temp.ae23_targets t join pg_temp.ae23_snapshot s on s.person_id = t.target;
reset role;

select cmp_ok((select count(*)::int from pg_temp.ae23_matrix), '>=', 50,
  '2.1 FLOOR: the differential measured at least 5 callers × 10 targets. A zero-delta verdict over an empty matrix is the classic vacuous green');

select set_eq(
  $q$select c.label as caller_label, t.label as target_label, m.old_leg, m.new_leg
       from pg_temp.ae23_matrix m
       join pg_temp.ae23_callers c on c.caller = m.caller
       join pg_temp.ae23_targets t on t.target = m.target$q$,
  $q$select caller_label, target_label, old_leg, new_leg from pg_temp.ae23_expected$q$,
  '2.2 ⭐ THE DIFFERENTIAL: every (caller, target) cell matches its pre-declaration, OLD and NEW. A cell that moved in either direction without being written down first fails HERE');

select set_eq(
  $q$select c.label as caller_label, t.label as target_label
       from pg_temp.ae23_matrix m
       join pg_temp.ae23_callers c on c.caller = m.caller
       join pg_temp.ae23_targets t on t.target = m.target
      where m.new_leg and not m.old_leg$q$,
  $q$select caller_label, target_label from pg_temp.ae23_widenings$q$,
  '2.3 ⛔ THE 0154 RULE: the measured WIDENINGS are exactly the five pre-declared ones, each carrying a written reason. An unapproved widening cannot be safe, so any extra pair reds here');

select set_eq(
  $q$select c.label as caller_label, t.label as target_label
       from pg_temp.ae23_matrix m
       join pg_temp.ae23_callers c on c.caller = m.caller
       join pg_temp.ae23_targets t on t.target = m.target
      where m.old_leg and not m.new_leg$q$,
  $q$select caller_label, target_label from pg_temp.ae23_narrowings$q$,
  '2.4 the newly HIDDEN pairs are exactly the five reviewed ones, each carrying a written ACCEPT disposition. A narrowing can be wrong and safe — but it may not be silent');

select is(
  (select count(*)::int from pg_temp.ae23_expected e
    where e.verdict is distinct from
          (case when e.new_leg and not e.old_leg then 'WIDENING'
                when e.old_leg and not e.new_leg then 'NARROWING'
                else 'unchanged' end))
  + (select count(*)::int from pg_temp.ae23_widenings w
      where not exists (select 1 from pg_temp.ae23_expected e
                         where e.caller_label = w.caller_label and e.target_label = w.target_label
                           and e.verdict = 'WIDENING'))
  + (select count(*)::int from pg_temp.ae23_narrowings n
      where not exists (select 1 from pg_temp.ae23_expected e
                         where e.caller_label = n.caller_label and e.target_label = n.target_label
                           and e.verdict = 'NARROWING')), 0,
  '2.5 CROSS-CHECK of the hand artefacts against each other: every verdict label is derivable from its own old/new pair, and every declared widening/narrowing has a matching verdict row. § 2.3 and § 2.4 are only independent evidence while these three lists agree');

select cmp_ok(
  (select count(*)::int from pg_temp.ae23_matrix where old_leg is not distinct from new_leg), '>=', 40,
  '2.6 FLOOR: at least 40 of the 50 cells did not move at all — AE2 is a MECHANISM change (ADR 0163 § Consequences predicted near-zero movement), and a differential that moved everything would mean the reproduction of the old predicate is wrong');

-- ============================================================================
-- § 3  POLICY LEVEL — the leg IS the visibility, because § 0 removed every
--      sibling route into these persons
-- ============================================================================
select is(
  (select count(*)::int from pg_temp.ae23_matrix where prof_visible is distinct from new_leg), 0,
  '3.1 on all 50 pairs, the profiles row is visible EXACTLY when the new leg is true — the predicate is not merely correct in isolation, the policy actually calls it (and § 0.2/§ 0.3/§ 0.5 are what stop a permissive sibling from carrying the read)');

select is(
  (select count(*)::int from pg_temp.ae23_matrix where cred_visible is distinct from new_leg), 0,
  '3.2 …and the same holds on professional_credentials, measured independently rather than inferred from § 3.1');

select is(
  (select prof_visible from pg_temp.ae23_matrix m
    where m.caller = (select ca from pg_temp.k()) and m.target = '00000000-0000-0000-0000-0ae23a000006'), true,
  '3.3 ⭐ THE VOIDED-ORDERING TRAP AT POLICY LEVEL: orgadmin.a can still read T6, whose VOIDED row ends LATER than the real one. An implementation computing max(ended_on) before filtering voided returns EMPTY here — a total, silent loss of authority that no widening rule would ever catch');

select is(
  (select prof_visible from pg_temp.ae23_matrix m
    where m.caller = (select cb from pg_temp.k()) and m.target = '00000000-0000-0000-0000-0ae23a000005'), true,
  '3.4 ⭐ THE TIE AT POLICY LEVEL: orgadmin.b can read T5, tied with org A on ended_on. An arbitrary tie-break picks one org and is a NARROWING — and this differential only pre-declares widenings, so § 2 alone would never notice it');

-- ============================================================================
-- § 4  THE D3 COLLAPSE — LOCATE and GRANT are two steps, and must stay two
-- ============================================================================
select is(
  (select count(*)::int from public.organization_affiliations oa
    where oa.principal_id in ((select cs from pg_temp.k()), '00000000-0000-0000-0000-0ae23a000001')
      and oa.organization_id = (select org_a from pg_temp.k())
      and oa.ended_on is null and oa.voided_at is null), 2,
  '4.1 PRECONDITION: staff1.ccih and T1 BOTH hold an ACTIVE org-A affiliation — so § 4.3''s denial is "sharing an affiliation grants nothing", not "there was nothing to share"');

select is(
  (select count(*)::int from public.memberships m
    where m.principal_id = (select cs from pg_temp.k()) and m.role::text = 'org_admin'), 0,
  '4.2 PRECONDITION: staff1.ccih holds NO org_admin membership at any scope — the GRANT half is genuinely absent');

select is(
  (select count(*)::int from pg_temp.ae23_matrix where caller = (select cs from pg_temp.k()) and new_leg), 0,
  '4.3 ⭐ ADR 0155 D3: a caller who SHARES an active affiliation with the target but holds no org_admin membership in the resolved org is denied for EVERY target. This is what reds if LOCATE and GRANT are ever collapsed into one join');

select is(
  (select count(*)::int from pg_temp.ae23_matrix
    where caller = (select cs from pg_temp.k()) and (prof_visible or cred_visible)), 0,
  '4.4 …and the denial holds end-to-end through RLS on BOTH re-predicated tables. § 4.3 is truth about the predicate and evidence about nothing downstream');

-- ============================================================================
-- § 5  THE professional_credentials WIDENING CANDIDATE — MEASURED, not inherited
-- ============================================================================
select is(
  (select count(*)::int from pg_temp.ae23_matrix where cred_visible and not prof_visible), 0,
  '5.1 ⭐ MEASURED, NOT ARGUED: on all 50 pairs there is no case where the credential is readable but the person''s profiles row is not — the implicit profiles-RLS gate the old leg carried, and the new DEFINER call removes, binds on ZERO pairs');

select is(
  (select count(*)::int from pg_temp.ae23_matrix where cred_visible is distinct from prof_visible), 0,
  '5.2 …and the equality holds in BOTH directions, so the removal did not narrow either. AE2.2 recorded this as an argument and explicitly refused to assert it away; this is the measurement it owed');

select cmp_ok(
  (select count(*)::int from pg_temp.ae23_matrix where cred_visible), '>=', 5,
  '5.3 FLOOR: at least five pairs actually READ a credential, so § 5.1 and § 5.2 are not two true statements about an all-false matrix');

-- ============================================================================
-- § 6  THE ROSTER DOOR — and the DELIBERATE divergence from the authority
--      predicate, measured rather than argued
-- ============================================================================
select test_helpers.claims_for((select chefe from pg_temp.k()), false, 'staff_admin');
set local role authenticated;
insert into pg_temp.ae23_roster
select (select ccih from pg_temp.k()), (select chefe from pg_temp.k()), r.user_id
  from public.list_addable_commission_members((select ccih from pg_temp.k())) r;
reset role;

select test_helpers.claims_for((select cb from pg_temp.k()), false, 'org_admin');
set local role authenticated;
insert into pg_temp.ae23_roster
select (select qual_b from pg_temp.k()), (select cb from pg_temp.k()), r.user_id
  from public.list_addable_commission_members((select qual_b from pg_temp.k())) r;
reset role;

select isnt_empty(
  $q$select 1 from pg_temp.ae23_roster where commission = 'a0000000-0000-0000-0000-0000000000a1'$q$,
  '6.1 CONTROL: the door returns a non-empty roster for chefe.ccih on CCIH — every exclusion below is measured against a working door, not a blanket empty');

select is(
  (select count(*)::int from pg_temp.ae23_targets t join public.profiles pr on pr.id = t.target
    where pr.home_organization_id = (select org_a from pg_temp.k())
      and pr.is_active and not pr.is_admin
      and not exists (select 1 from public.memberships m
                       where m.commission_id = (select ccih from pg_temp.k()) and m.principal_id = pr.id)), 10,
  '6.2 THE OLD ROSTER PREDICATE, REPRODUCED IN FULL (not just its changed conjunct): under `pr.home_organization_id = v_org_id and pr.is_active and not pr.is_admin and not exists(memberships)` all TEN were addable to CCIH. Every absence in § 6.3 is attributable to the affiliation conjunct alone');

select set_eq(
  $q$select t.label from pg_temp.ae23_targets t
      where t.target in (select r.user_id from pg_temp.ae23_roster r
                          where r.commission = 'a0000000-0000-0000-0000-0000000000a1')$q$,
  $q$select unnest(array['T1','T7'])$q$,
  '6.3 under the NEW predicate exactly the two ACTIVELY affiliated persons are addable to org A''s commission — 10 → 2, a pre-declared NARROWING that breaks no flow (rehire is affiliate-first, one step, ADR 0151 D5)');

select is(
  (select count(*)::int from pg_temp.ae23_matrix m join pg_temp.ae23_targets t on t.target = m.target
    where m.caller = (select ca from pg_temp.k()) and t.label in ('T2','T5','T6') and m.new_leg), 3,
  '6.4 ⭐ THE DIVERGENCE, MEASURED: T2, T5 and T6 ARE retained for org A by the AUTHORITY predicate (§ 6.3 shows none of them is addable). The two doors answer different questions — "who may ADMINISTER" vs "who may be STAFFED" — and ADR 0163''s retention was never an input to the second. If anyone unifies them, § 6.3 and § 6.4 disagree');

select isnt_empty(
  $q$select 1 from pg_temp.ae23_roster where commission = 'c0000000-0000-0000-0000-0000000000c1'$q$,
  '6.5 CONTROL: orgadmin.b is a tenancy admin of org B''s commission and gets a non-empty roster there — so § 6.6 measures WHICH persons, never whether the caller may list at all');

select set_eq(
  $q$select t.label from pg_temp.ae23_targets t
      where t.target in (select r.user_id from pg_temp.ae23_roster r
                          where r.commission = 'c0000000-0000-0000-0000-0000000000c1')$q$,
  $q$select unnest(array['T4','T7','T8'])$q$,
  '6.6 ⭐ THE ROSTER WIDENING, PRE-DECLARED: the three persons ACTIVELY affiliated to org B are addable to org B''s commission even though their column says org A — while T5, whose org-B row is ENDED, is not. The substrate decides, and retention does not leak into staffing eligibility');

-- ============================================================================
-- § 7  SHAPE — the two properties whose loss would make everything above lie
-- ============================================================================
select is(
  has_function_privilege('authenticated', 'app.person_authority_orgs(uuid)', 'EXECUTE'), false,
  '7.1 app.person_authority_orgs is STILL not executable by `authenticated`. A row-returning DEFINER is a gate you can walk through: granting it would let any caller enumerate any person''s organizations by id, and it is in NO sweep arm''s finding domain to notice');

select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_administer_person_via_affiliation'), true,
  '7.2 the authority predicate is STILL SECURITY DEFINER — a create-or-replace that dropped it would subject its organization_affiliations read to the caller''s RLS, whose SELECT policy has no hospital tier by design (ADR 0151 D1), and every § 3 number would silently change meaning');

-- ============================================================================
-- § 8  THE SEED POPULATION — zero movement, on a FLOORED population
-- ============================================================================
select cmp_ok((select count(*)::int from pg_temp.ae23_seed), '>=', 30,
  '8.1 FLOOR, not an exact count: the seed snapshot holds at least 30 persons. Catalog-driven counts drift with every seed change; a floor is what survives that without going vacuous');

select is(
  (select count(*)::int from pg_temp.ae23_seed_matrix where old_leg is distinct from new_leg), 0,
  '8.2 ⭐ ZERO MOVEMENT across the whole seed roster for all three org_admin callers — the delta ADR 0163 predicted, and the reason "every widening is pre-declared or it is a red" is an affordable rule here rather than a rubber stamp');

select cmp_ok(
  (select count(*)::int from pg_temp.ae23_seed_matrix where old_leg and new_leg), '>=', 25,
  '8.3 FLOOR: at least 25 of those seed pairs are TRUE under BOTH predicates, so § 8.2''s zero delta is agreement between two live predicates and not two silent falses');

select * from finish();
rollback;

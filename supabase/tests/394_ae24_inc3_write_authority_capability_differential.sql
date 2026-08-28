-- AE2.4 INCREMENT 3 — THE WRITE-AUTHORITY PATH, AND ITS CAPABILITY-LEVEL DIFFERENTIAL.
--
-- Rulings ADR 0163 (last-org retention) · ADR 0164 (which makes this differential a HARD
-- GATE on the column drop) · ADR 0155 D3 / Architecture Rule 13 (locate vs grant).
-- Phase record docs/progress/authz-ae2.md § AE2.4 increment 3.
--
-- ============================================================================
-- WHAT THIS SUITE IS FOR
-- ============================================================================
-- `app.can_administer_person_for` is THE person-level capability predicate: it
-- decides `fields` / `credentials` / `cpf_change` / `lifecycle` for every one of
-- the six AE1.3 person-door kernels.  Until this increment it resolved the
-- target's organisation from `profiles.home_organization_id`.  ADR 0163's
-- last-org retention was therefore live on the READ side only — and the two
-- capabilities its Decision paragraph named are exactly the ones those doors
-- gate.  This increment re-predicates the resolution onto
-- `app.person_authority_orgs`, and this suite measures what that moves.
--
-- ⛔ WITHOUT THIS MEASUREMENT THE COLUMN DROP SILENTLY MOVES WRITE AUTHORITY.
--    That is not a figure of speech: home org and retaining/active org COINCIDE
--    for every person in `seed.sql`, so the entire seeded suite is true under
--    both predicates and would stay green through the change.  § 8 measures that
--    coincidence rather than citing it.
--
-- ============================================================================
-- ⭐ THE CAPABILITY AXIS IS VACUOUS ON THE ORG TIER — MEASURED, THEN FIXED
-- ============================================================================
-- The obvious way to write a "capability-level" differential is to take AE2.3a's
-- ten targets and multiply by four capabilities.  That produces FOUR IDENTICAL
-- COPIES and nothing else, because the org_admin arm returns `true` BEFORE the
-- capability dispatch is ever reached.  An axis that cannot vary is not an axis.
--
-- The INTERSECTION / SUBSET split (ADR 0133 Amdt 1 r1) lives on the HOSPITAL_ADMIN
-- arm alone, and that arm is reached only when the target has a NON-EMPTY
-- footprint.  AE2.3a's ten targets deliberately have ZERO footprint.  So this
-- suite carries TWO populations:
--
--   P1..P10  the ORG-TIER substrate — the same ten shapes as `392`, zero
--            footprint.  § 2.2 MEASURES that the capability axis is inert here
--            rather than assuming it, and § 2.3 cross-checks that the movement
--            reproduces 392's read-side matrix exactly.
--   Q1..Q7   the HOSPITAL-TIER substrate — non-empty footprints, built so
--            INTERSECTION and SUBSET genuinely disagree.  § 3.2 floors that.
--
-- ============================================================================
-- ⛔ WHAT THE SEED CANNOT REACH, MEASURED BEFORE A CELL WAS WRITTEN
-- ============================================================================
--   • No seeded persona holds a membership or affiliation outside its home org,
--     and there is no cross-org persona (CLAUDE.md § 9).  The cross-org actor is
--     `solo.c@test.local` (org C), exactly as `392` established.
--   • ⭐ THE SEED HAS NO `hospital_admin` IN ORG B.  Measured from `memberships`
--     before this fixture was designed: org B carries `orgadmin.b`, `nspcoord.b`,
--     `pqs.b` and `quality.b` and NO hospital_admin.  Every hospital-tier
--     WIDENING cell needs an actor administering a hospital in the *new* org, so
--     `HB1` is CONSTRUCTED.  A cell written against `hospitaladmin.a1` would have
--     passed while proving nothing.
--   • ⭐ AN ACTIVE HOSPITAL AFFILIATION CANNOT STRAND ITSELF IN THE OLD ORG.
--     `assert_hospital_affiliation_has_org` (AFF4 D4 / ADR 0151 D4) requires an
--     ACTIVE org affiliation in the SAME organisation, so "footprint in org A
--     while the org affiliation is in B" is unreachable through that leg.  It IS
--     reachable through the footprint's OTHER leg — a commission membership that
--     outlives the org affiliation — which is exactly the state the shipped
--     comment describes ("the org-wide member picker seats people on commissions
--     of hospitals they hold no affiliation with").  Q2 and Q5 are built that
--     way, so every fixture state here is one the database will actually hold.
--     ⛔ Not "constructed inside a rollback where the deferred trigger never
--     fires" — that would be measuring a cell for a state the DB forbids.
--
-- ============================================================================
-- THE DIFFERENTIAL, AND WHY THE OLD SIDE IS TRUSTWORTHY
-- ============================================================================
-- OLD and NEW are evaluated per (caller × target × capability) IN ONE
-- TRANSACTION.  The OLD predicate no longer exists in the catalog after this
-- increment's migration, so it is REPRODUCED as `pg_temp.can_admin_with_orgs`,
-- parameterised on the located organisations:
--
--   OLD = can_admin_with_orgs(cap, u, a, array[<RLS-free snapshot of the column>])
--   NEW = app.can_administer_person_for(cap, u, a)
--
-- ⛔ A reproduction is a liability in BOTH directions: if it drifts from the
--    shipped body, the differential is wrong on the old side AND reads as a real
--    movement.  § 9.1 is the control that removes the liability — the SAME
--    reproduction, fed `app.person_authority_orgs(u)`, must equal the shipped
--    function on EVERY cell.  That isolates the difference between the two sides
--    to the ORGANISATION LIST ALONE; any drift in the reproduced D2 / footprint /
--    INTERSECTION / SUBSET logic reds there instead of masquerading as a finding.
--    § 8.2 is the second control, over the seed population.
--
-- The old side reads the column from an RLS-FREE SNAPSHOT: it was a read inside
-- a DEFINER door against the row in hand, never a re-read under a caller's RLS.
--
-- ============================================================================
-- THE RULE (ADR 0154; plan PA-F13): EVERY WIDENING IS PRE-DECLARED OR IT IS A RED
-- ============================================================================
-- § 4.1 compares the MEASURED widening set against a hand list carrying a reason
-- per class; § 4.2 cross-checks that hand list against the expectation table.
-- ⚠ The two are written INDEPENDENTLY on purpose — deriving one from the other
--   makes it a restatement, green whenever its source is green.
--
-- ---------------------------------------------------------------------------
-- PRE-DECLARED WIDENINGS (48 cells), BY CLASS
-- ---------------------------------------------------------------------------
--  ORG TIER, all four capabilities (the org arm short-circuits the dispatch):
--   CB×P4  ended in A, ACTIVE in B          arm 2 must not fire while arm 1 is
--                                           non-empty (ADR 0163 bound 3)
--   CB×P5  the `ended_on` TIE               bound 2 — ties yield ALL tied orgs
--   CB×P7  ACTIVE in both A and B           the plan's own named widening
--   CB×P8  column A, ACTIVE only in B       the substrate is the truth
--   CC×P10 same, through a CROSS-ORG actor  not an artefact of the A/B pair
--   CB×Q2  as P8 but with a real footprint  the org arm is footprint-blind
--   CB×Q3  as Q2, footprint spans two orgs
--   CB×Q4  RETENTION to B                   ⭐ ADR 0163's actual subject on the
--                                           WRITE side, and the cell that
--                                           discriminates ruling (i) from (ii)
--   CB×Q6  ACTIVE in both, cross-org fp
--   CB×Q7  column A, ACTIVE B, single-hospital footprint
--
--  HOSPITAL TIER — ⭐ CAPABILITY-DIFFERENTIATED, which is the whole point of
--  this suite existing separately from `392`:
--   HB1×Q3  {fields, credentials} ONLY      the actor administers ONE hospital of
--                                           a two-hospital footprint: INTERSECTION
--                                           admits, SUBSET refuses.  Under the old
--                                           predicate the actor reached NOTHING in
--                                           the target's home org, so this is a
--                                           widening on exactly two capabilities.
--   HB1×Q6  {fields, credentials} ONLY      same class, via a cross-org footprint
--   HB1×Q7  all four                        SINGLE-hospital footprint, so
--                                           INTERSECTION and SUBSET coincide.
--                                           ⭐ This cell is the control that makes
--                                           Q3/Q6's split a property of the
--                                           FOOTPRINT and not of the predicate.
--
-- ---------------------------------------------------------------------------
-- NEWLY-HIDDEN CELLS (44), EACH ACCEPTED IN WRITING
-- ---------------------------------------------------------------------------
--   CA×P3   voided-only          ACCEPT — bound 1: a voided row is "was never
--                                true" and is excluded from the derivation.
--   CA×P4   ended A, active B    ACCEPT — authority follows the ACTIVE org.
--   CA×P8 / CA×P10               ACCEPT — the intended mechanism change.
--   CA×P9   NO affiliation row   ACCEPT, BLAST RADIUS NAMED.  A true orphan
--                                becomes administrable by NOBODY, for all four
--                                capabilities.  ⛔ This is the WRITE half of the
--                                narrowing `392` accepted on the read side, and
--                                increment 1 deliberately made orphans claimable:
--                                `affiliate_person_to_org_impl` now admits any
--                                org admin over an orphan (ADR 0165 cells W5/W6/W7),
--                                so recovery is one affiliation away and does not
--                                need this predicate.  Recorded as an accepted
--                                narrowing, NOT as "cannot happen".
--   CA×Q2 / CA×Q3 / CA×Q4 / CA×Q7   ACCEPT — the same mechanism change, now with
--                                a footprint present, including retention moving
--                                the authority to org B (Q4).
--   HA1×Q2 {fields, credentials}    ACCEPT — ⭐ a hospital_admin of the OLD org
--   HAD×Q2 all four                 loses a person whose employment moved.  The
--   HAD×Q3 {fields, credentials}    footprint is STRANDED in org A by a commission
--                                   membership that outlived the org affiliation;
--                                   the person is org B's now, and org A's
--                                   hospital admins keeping edit rights over them
--                                   is the defect, not the loss.
--
-- ============================================================================
-- ⭐ § 6 — THE RULING THAT WAS *NOT* TAKEN, MEASURED BESIDE THE ONE THAT WAS
-- ============================================================================
-- ADR 0163's Decision paragraph says retention is "bounded to the SUBSET
-- capabilities (lifecycle, cpf_change)".  Read literally that would deny an
-- org_admin of the retaining organisation `fields` and `credentials` over a
-- fully-offboarded person — a NARROWING against today, since the org arm holds
-- all four.  Bound 3 of the same ADR says retention "grants nothing beyond what
-- an org_admin of an ACTIVE affiliation would hold", and such an admin holds all
-- four: the ADR contradicts itself.  Ruled by the PO 2026-08-28: the SUBSET
-- wording borrowed a HOSPITAL-tier label (ADR 0133's INTERSECTION/SUBSET split,
-- which has never applied to org_admin) and pinned it to an ORG-tier rule.
-- Implementation is CAPABILITY-BLIND retention; ADR 0163 is amended.
--
-- ⛔ § 6 exists because "a reading was not intended" is worth more with the
--    alternative MEASURED beside it.  It evaluates the counterfactual predicate
--    and states exactly how many cells it would move, and in which direction.
--
-- ============================================================================
-- § 7 — THE AUDIT-ORGANISATION DIFFERENTIAL, WHICH IS A READ-AUTHORITY ONE
-- ============================================================================
-- All six kernels read the column for ONE purpose: `audit_write(p_organization
-- => v_org)`.  That is not attribution housekeeping.  `audit_log_select` carries
--   ((commission_id IS NULL) AND app.is_org_admin_of(organization_id))
-- and all six write `p_commission => null`, so `v_org` decides WHO MAY READ THE
-- AUDIT ROW.  `app.person_audit_organization(actor, user)` replaces the column
-- read; § 7 measures the readership movement, including the tie-break.
--
-- ⚠ THE TIE-BREAK IS BOUNDED-BUT-ARBITRARY AND IS PRE-DECLARED AS SUCH (§ 7.4).
--   Where an actor administers TWO locating organisations, `order by
--   organization_id limit 1` picks one and the LOSING org's other admins can no
--   longer read that row.  Any candidate is a defensible attribution; WHICH one
--   is arbitrary, chosen for determinism.  The lowest uuid means nothing.
--
-- ============================================================================
-- FIXTURE HYGIENE
-- ============================================================================
-- ⚠ Every fixture person has its OWN id in the `0ae24c…` namespace — disjoint
--   from 390's `0000ae22…`, 391's `0000ae23…` and 392's `0ae23a…`.  Fixtures that
--   SHARE ids across cases fabricate both defects and all-clears.  Every deletion
--   is by identity; the rollback does all of it.
-- ⚠ No role switching anywhere: every predicate here takes an explicit actor
--   (`*_for` / `p_actor`), so nothing depends on session state.
-- ============================================================================

begin;
select plan(42);

-- ---------------------------------------------------------------------------
-- Constants — seeded ids, measured from the catalog, never guessed.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.k()
returns table (
  org_a uuid, org_b uuid, org_c uuid,
  hca uuid, hsa uuid, hcb uuid, huc uuid,
  ccih uuid, etica uuid,
  ca uuid, cb uuid, cc uuid, ha1 uuid, had uuid, cs uuid,
  hb1 uuid, cab uuid, csh uuid
)
language sql immutable as $$
  select '0c000000-0000-0000-0000-00000000000a'::uuid,  -- Rede Hospitalar A
         '0c000000-0000-0000-0000-00000000000b'::uuid,  -- Rede Hospitalar B
         '0c000000-0000-0000-0000-00000000000c'::uuid,  -- Rede Hospitalar C
         '05000000-0000-0000-0000-00000000000a'::uuid,  -- Hospital Central A
         '05000000-0000-0000-0000-0000000000a2'::uuid,  -- Hospital Secundário A
         '05000000-0000-0000-0000-00000000000b'::uuid,  -- Hospital Central B
         '05000000-0000-0000-0000-00000000000c'::uuid,  -- Hospital Unico C
         'a0000000-0000-0000-0000-0000000000a1'::uuid,  -- CCIH        (org A / HCA)
         'e0000000-0000-0000-0000-0000000000e1'::uuid,  -- Ética       (org A / HSA)
         '00000000-0000-0000-0000-0000000000b1'::uuid,  -- CA  orgadmin.a
         '00000000-0000-0000-0000-0000000000b2'::uuid,  -- CB  orgadmin.b
         '00000000-0000-0000-0000-0000000000c0'::uuid,  -- CC  solo.c (cross-org)
         '00000000-0000-0000-0000-0000000000e1'::uuid,  -- HA1 hospitaladmin.a1  (HCA only)
         '00000000-0000-0000-0000-0000000000e3'::uuid,  -- HAD hospitaladmin.dual(HCA+HSA)
         '00000000-0000-0000-0000-000000000003'::uuid,  -- CS  staff1.ccih
         '00000000-0000-0000-0000-0ae24c0000f1'::uuid,  -- HB1 CONSTRUCTED: hospital_admin HCB
         '00000000-0000-0000-0000-0ae24c0000f2'::uuid,  -- CAB CONSTRUCTED: org_admin of A AND B
         '00000000-0000-0000-0000-0ae24c0000f3'::uuid;  -- CSH CONSTRUCTED: shares an affiliation,
                                                        --     holds NO membership (Rule 13)
$$;

-- ---------------------------------------------------------------------------
-- ⭐ THE SEED SNAPSHOT IS TAKEN BEFORE THE FIXTURES EXIST, so § 8's zero-movement
--    claim is about the seed population and cannot be diluted by them.
-- ---------------------------------------------------------------------------
create temp table x_seed as
  select p.id as person_id, p.home_organization_id from public.profiles p;

create temp table x_caps (ord int primary key, cap text not null unique);
insert into x_caps values (1,'fields'), (2,'credentials'), (3,'cpf_change'), (4,'lifecycle');

create temp table x_callers (label text primary key, caller uuid, note text);
insert into x_callers values
  ('CA',  (select ca  from pg_temp.k()), 'org_admin A'),
  ('CB',  (select cb  from pg_temp.k()), 'org_admin B'),
  ('CC',  (select cc  from pg_temp.k()), 'org_admin C + hospital_admin HUC (cross-org)'),
  ('HA1', (select ha1 from pg_temp.k()), 'hospital_admin of HCA only'),
  ('HAD', (select had from pg_temp.k()), 'hospital_admin of HCA and HSA'),
  ('HB1', (select hb1 from pg_temp.k()), 'CONSTRUCTED hospital_admin of HCB only (org B has none)'),
  ('CS',  (select cs  from pg_temp.k()), 'staff — the pure negative');

create temp table x_targets (label text primary key, target uuid, pop text, note text);
insert into x_targets values
  ('P1',  '00000000-0000-0000-0000-0ae24c000001', 'P', 'active in A'),
  ('P2',  '00000000-0000-0000-0000-0ae24c000002', 'P', 'ended-non-voided A — retention to A'),
  ('P3',  '00000000-0000-0000-0000-0ae24c000003', 'P', 'voided-only — bound 1 excludes it'),
  ('P4',  '00000000-0000-0000-0000-0ae24c000004', 'P', 'ended A + ACTIVE B'),
  ('P5',  '00000000-0000-0000-0000-0ae24c000005', 'P', 'ended_on TIE across A and B'),
  ('P6',  '00000000-0000-0000-0000-0ae24c000006', 'P', 'voided row ends LATER than the real one'),
  ('P7',  '00000000-0000-0000-0000-0ae24c000007', 'P', 'ACTIVE in both A and B'),
  ('P8',  '00000000-0000-0000-0000-0ae24c000008', 'P', 'column A, ACTIVE only in B'),
  ('P9',  '00000000-0000-0000-0000-0ae24c000009', 'P', 'no affiliation row at all — the orphan'),
  ('P10', '00000000-0000-0000-0000-0ae24c00000a', 'P', 'column A, ACTIVE only in C'),
  ('Q1',  '00000000-0000-0000-0000-0ae24c000011', 'Q', 'active A; hosp affs HCA+HSA'),
  ('Q2',  '00000000-0000-0000-0000-0ae24c000012', 'Q', 'ended A + active B; footprint STRANDED in A'),
  ('Q3',  '00000000-0000-0000-0000-0ae24c000013', 'Q', 'active B; footprint HCB + HSA (cross-org)'),
  ('Q4',  '00000000-0000-0000-0000-0ae24c000014', 'Q', 'ended-non-voided B only; EMPTY footprint'),
  ('Q5',  '00000000-0000-0000-0000-0ae24c000015', 'Q', 'ended-non-voided A only; footprint HCA+HSA'),
  ('Q6',  '00000000-0000-0000-0000-0ae24c000016', 'Q', 'active A AND B; footprint HCA+HCB'),
  ('Q7',  '00000000-0000-0000-0000-0ae24c000017', 'Q', 'active B; SINGLE-hospital footprint HCB');

-- ---------------------------------------------------------------------------
-- Fixture principals.  `handle_new_user` mints each profile from `auth.users`;
-- `home_organization_id` is then set to ORG A for ALL SEVENTEEN targets — the
-- ones whose only affiliation is elsewhere included.  That is what makes this a
-- DIFFERENTIAL and not a snapshot: under the OLD predicate `orgadmin.a`
-- administered all seventeen, so every removal is attributable to the new
-- predicate and to nothing else.
-- ---------------------------------------------------------------------------
create temp table x_principals (id uuid primary key);
insert into x_principals
select target from x_targets
union all
values ((select hb1 from pg_temp.k())),
       ((select cab from pg_temp.k())),
       ((select csh from pg_temp.k()));

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000'::uuid, p.id, 'authenticated', 'authenticated',
       p.id::text || '@ae24c.test', now(), now()
from x_principals p;

update public.profiles
   set home_organization_id = (select org_a from pg_temp.k()),
       full_name = 'AE24c target ' || (select label from x_targets t where t.target = profiles.id),
       is_active = true
 where id in (select target from x_targets);

update public.profiles
   set home_organization_id = (select org_b from pg_temp.k()),
       full_name = 'AE24c constructed caller',
       is_active = true
 where id in ((select hb1 from pg_temp.k()),
              (select cab from pg_temp.k()),
              (select csh from pg_temp.k()));

-- The constructed callers' authority.  ⛔ MEMBERSHIPS, never affiliations —
-- Architecture Rule 13: the affiliation LOCATES, the membership GRANTS.
insert into public.memberships (principal_id, organization_id, hospital_id, commission_id, role)
values
  ((select hb1 from pg_temp.k()), (select org_b from pg_temp.k()),
   (select hcb from pg_temp.k()), null, 'hospital_admin'),
  ((select cab from pg_temp.k()), (select org_a from pg_temp.k()), null, null, 'org_admin'),
  ((select cab from pg_temp.k()), (select org_b from pg_temp.k()), null, null, 'org_admin');
-- CSH gets NO membership at all.  That is the Rule 13 subject (§ 9.2).

-- The constructed callers' own org affiliations — legitimate rows, so the
-- fixture world is one the database will actually hold.
insert into public.organization_affiliations
  (principal_id, organization_id, started_on, created_by)
values
  ((select hb1 from pg_temp.k()), (select org_b from pg_temp.k()), date '2025-01-01', (select cb from pg_temp.k())),
  ((select cab from pg_temp.k()), (select org_a from pg_temp.k()), date '2025-01-01', (select ca from pg_temp.k())),
  ((select cab from pg_temp.k()), (select org_b from pg_temp.k()), date '2025-01-01', (select cb from pg_temp.k())),
  ((select csh from pg_temp.k()), (select org_b from pg_temp.k()), date '2025-01-01', (select cb from pg_temp.k()));

-- ---------------------------------------------------------------------------
-- THE ORG-AFFILIATION SUBSTRATE.  `started_on` precedes every `ended_on`
-- (organization_affiliations_period_ck) and every voided row carries a reason
-- (organization_affiliations_voided_shape).
-- ---------------------------------------------------------------------------
insert into public.organization_affiliations
  (principal_id, organization_id, started_on, ended_on, ended_by, voided_at, voided_by, void_reason, created_by)
values
  -- ---- population P: the org tier, zero footprint (shapes mirror `392`) ----
  ('00000000-0000-0000-0000-0ae24c000001', (select org_a from pg_temp.k()), date '2025-01-01', null,             null,                          null,  null, null, (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000002', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), null,  null, null, (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000003', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), now(), (select ca from pg_temp.k()), 'lançamento equivocado', (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000004', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), null,  null, null, (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000004', (select org_b from pg_temp.k()), date '2025-01-01', null,             null,                          null,  null, null, (select cb from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000005', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-02-20', (select ca from pg_temp.k()), null,  null, null, (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000005', (select org_b from pg_temp.k()), date '2025-01-01', date '2026-02-20', (select cb from pg_temp.k()), null,  null, null, (select cb from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000006', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), null,  null, null, (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000006', (select org_b from pg_temp.k()), date '2025-01-01', date '2026-06-10', (select cb from pg_temp.k()), now(), (select cb from pg_temp.k()), 'lançamento equivocado', (select cb from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000007', (select org_a from pg_temp.k()), date '2025-01-01', null,             null,                          null,  null, null, (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000007', (select org_b from pg_temp.k()), date '2025-01-01', null,             null,                          null,  null, null, (select cb from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000008', (select org_b from pg_temp.k()), date '2025-01-01', null,             null,                          null,  null, null, (select cb from pg_temp.k())),
  -- P9 deliberately gets no row at all.
  ('00000000-0000-0000-0000-0ae24c00000a', (select org_c from pg_temp.k()), date '2025-01-01', null,             null,                          null,  null, null, (select cc from pg_temp.k())),
  -- ---- population Q: the hospital tier, non-empty footprints ----
  ('00000000-0000-0000-0000-0ae24c000011', (select org_a from pg_temp.k()), date '2025-01-01', null,             null,                          null,  null, null, (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000012', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), null,  null, null, (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000012', (select org_b from pg_temp.k()), date '2025-01-01', null,             null,                          null,  null, null, (select cb from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000013', (select org_b from pg_temp.k()), date '2025-01-01', null,             null,                          null,  null, null, (select cb from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000014', (select org_b from pg_temp.k()), date '2025-01-01', date '2026-03-15', (select cb from pg_temp.k()), null,  null, null, (select cb from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000015', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-03-15', (select ca from pg_temp.k()), null,  null, null, (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000016', (select org_a from pg_temp.k()), date '2025-01-01', null,             null,                          null,  null, null, (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000016', (select org_b from pg_temp.k()), date '2025-01-01', null,             null,                          null,  null, null, (select cb from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000017', (select org_b from pg_temp.k()), date '2025-01-01', null,             null,                          null,  null, null, (select cb from pg_temp.k()));

-- ---------------------------------------------------------------------------
-- THE FOOTPRINT SUBSTRATE.
--
-- ⛔ HOSPITAL AFFILIATIONS ARE ONLY EVER CREATED WHERE AN ACTIVE ORG AFFILIATION
--    IN THE SAME ORG EXISTS — `assert_hospital_affiliation_has_org` (AFF4 D4)
--    forbids anything else, so Q2 and Q5 use the footprint's OTHER leg: a
--    commission membership that OUTLIVED the org affiliation.  That is a
--    reachable state (seated while employed in A, then employment moved), and it
--    is the state the shipped comment names: "the org-wide member picker seats
--    people on commissions of hospitals they hold no affiliation with".
-- ---------------------------------------------------------------------------
insert into public.hospital_affiliations
  (principal_id, organization_id, hospital_id, started_on, created_by)
values
  -- Q1 — the no-divergence control: two hospitals of org A, org aff ACTIVE in A.
  ('00000000-0000-0000-0000-0ae24c000011', (select org_a from pg_temp.k()), (select hca from pg_temp.k()), date '2025-01-01', (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000011', (select org_a from pg_temp.k()), (select hsa from pg_temp.k()), date '2025-01-01', (select ca from pg_temp.k())),
  -- Q3 — HCB (legal: org aff ACTIVE in B).  Its second footprint hospital is HSA,
  --      contributed by a commission membership below — a CROSS-ORG footprint.
  ('00000000-0000-0000-0000-0ae24c000013', (select org_b from pg_temp.k()), (select hcb from pg_temp.k()), date '2025-01-01', (select cb from pg_temp.k())),
  -- Q6 — active in BOTH orgs, so both hospital rows are legal.
  ('00000000-0000-0000-0000-0ae24c000016', (select org_a from pg_temp.k()), (select hca from pg_temp.k()), date '2025-01-01', (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae24c000016', (select org_b from pg_temp.k()), (select hcb from pg_temp.k()), date '2025-01-01', (select cb from pg_temp.k())),
  -- Q7 — a SINGLE-hospital footprint, so INTERSECTION and SUBSET coincide.
  ('00000000-0000-0000-0000-0ae24c000017', (select org_b from pg_temp.k()), (select hcb from pg_temp.k()), date '2025-01-01', (select cb from pg_temp.k()));

insert into public.memberships (principal_id, organization_id, hospital_id, commission_id, role)
values
  -- Q2 — the STRANDED footprint: CCIH (HCA) + Ética (HSA), both org A, while the
  --      person's active org affiliation is in B.
  ('00000000-0000-0000-0000-0ae24c000012', null, null, (select ccih  from pg_temp.k()), 'staff'),
  ('00000000-0000-0000-0000-0ae24c000012', null, null, (select etica from pg_temp.k()), 'staff'),
  -- Q3's second footprint hospital — HSA, in org A, while the person is org B's.
  ('00000000-0000-0000-0000-0ae24c000013', null, null, (select etica from pg_temp.k()), 'staff'),
  -- Q5 — retention to A, with a footprint that outlived the org affiliation.
  ('00000000-0000-0000-0000-0ae24c000015', null, null, (select ccih  from pg_temp.k()), 'staff'),
  ('00000000-0000-0000-0000-0ae24c000015', null, null, (select etica from pg_temp.k()), 'staff');

-- ---------------------------------------------------------------------------
-- THE RLS-FREE SNAPSHOT OF THE COLUMN.  ⛔ The OLD resolution was a read inside a
-- DEFINER door against the row in hand; re-reading it under a caller's RLS would
-- evaluate it under the NEW policies and make the differential compare the new
-- predicate with itself.
-- ---------------------------------------------------------------------------
create temp table x_snapshot as
  select p.id as person_id, p.home_organization_id
    from public.profiles p
   where p.id in (select target from x_targets);

-- ---------------------------------------------------------------------------
-- THE OLD PREDICATE, REPRODUCED AND PARAMETERISED ON THE LOCATED ORGANISATIONS.
-- Everything from the actor-active check down is a faithful copy of the shipped
-- body at head 20261003005600; § 9.1 is the control that proves it faithful.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.can_admin_with_orgs(
  p_capability text, p_user uuid, p_actor uuid, p_orgs uuid[]
) returns boolean
language plpgsql stable as $fn$
declare
  v_administered uuid[];
  v_footprint    uuid[];
begin
  if p_capability is null
     or p_capability not in ('fields', 'credentials', 'cpf_change', 'lifecycle') then
    raise exception 'capacidade de escopo de pessoa desconhecida: %', coalesce(p_capability, '<null>')
      using errcode = 'HC0T7';
  end if;

  if p_actor is null or p_user is null then return false; end if;

  -- The ONLY parameterised step: where the old body did
  -- `select pr.home_organization_id into v_org … ; if v_org is null then return false`.
  if p_orgs is null or cardinality(p_orgs) = 0 then return false; end if;

  if not app.is_active(p_actor) then return false; end if;

  -- The org arm — NOT footprint-bounded, and it short-circuits the capability
  -- dispatch, which is exactly why the capability axis is inert on population P.
  if exists (select 1 from unnest(p_orgs) o where app.is_org_admin_of_for(o, p_actor)) then
    return true;
  end if;

  v_administered := array(
    select h.id from public.hospitals h
     where h.organization_id = any (p_orgs)
       and app.is_hospital_admin_of_for(h.id, p_actor));
  if cardinality(v_administered) = 0 then return false; end if;

  if exists (select 1 from public.memberships m
              where m.principal_id = p_user and m.commission_id is null) then
    return false;
  end if;

  v_footprint := array(
    select ha.hospital_id from public.hospital_affiliations ha
     where ha.principal_id = p_user and ha.ended_on is null and ha.voided_at is null
       and ha.hospital_id is not null
    union
    select c.hospital_id from public.memberships m
      join public.commissions c on c.id = m.commission_id
     where m.principal_id = p_user and m.commission_id is not null
       and (m.expires_at is null or m.expires_at > now())
       and c.hospital_id is not null);

  if cardinality(v_footprint) = 0 then return false; end if;

  if p_capability in ('fields', 'credentials') then
    return v_footprint && v_administered;
  else
    return not exists (
      select 1 from unnest(v_footprint) f where not (f = any (v_administered)));
  end if;
end;
$fn$;

-- The CAPABILITY-BOUNDED counterfactual (§ 6): ADR 0163's Decision paragraph read
-- literally.  Retention (the arm that fires only when no active affiliation
-- exists) would locate NOTHING for `fields` / `credentials`.
create or replace function pg_temp.orgs_bounded(p_user uuid, p_capability text)
returns uuid[] language sql stable as $fn$
  select case
    when p_capability in ('cpf_change', 'lifecycle')
      then array(select organization_id from app.person_authority_orgs(p_user))
    else array(
      select oa.organization_id from public.organization_affiliations oa
       where oa.principal_id = p_user and oa.ended_on is null and oa.voided_at is null)
  end;
$fn$;

-- ---------------------------------------------------------------------------
-- THE MEASURED MATRIX — 5 callers × 10 P-targets + 7 callers × 7 Q-targets,
-- times four capabilities.  Both sides in one transaction, per cell.
-- ---------------------------------------------------------------------------
create temp table x_matrix (
  caller_label text, target_label text, cap text,
  old_v bool, new_v bool, ctl_v bool, alt_v bool
);

insert into x_matrix
select cl.label, tg.label, cp.cap,
       pg_temp.can_admin_with_orgs(
         cp.cap, tg.target, cl.caller,
         case when sn.home_organization_id is null then '{}'::uuid[]
              else array[sn.home_organization_id] end),
       app.can_administer_person_for(cp.cap, tg.target, cl.caller),
       -- the FAITHFULNESS control (§ 9.1): the same reproduction fed the NEW
       -- organisation list must equal the shipped function on every cell.
       pg_temp.can_admin_with_orgs(
         cp.cap, tg.target, cl.caller,
         array(select organization_id from app.person_authority_orgs(tg.target))),
       -- the § 6 counterfactual.
       pg_temp.can_admin_with_orgs(
         cp.cap, tg.target, cl.caller, pg_temp.orgs_bounded(tg.target, cp.cap))
  from x_callers cl
  join x_targets tg on (tg.pop = 'Q' or cl.label in ('CA','CB','CC','HA1','CS'))
  join x_caps cp on true
  left join x_snapshot sn on sn.person_id = tg.target;

-- Measured masks, in capability order, for comparison with the expectation table.
create temp table x_measured as
  select caller_label, target_label,
         string_agg(case when old_v then 'T' else 'F' end, '' order by c.ord) as old_mask,
         string_agg(case when new_v then 'T' else 'F' end, '' order by c.ord) as new_mask
    from x_matrix m join x_caps c on c.cap = m.cap
   group by caller_label, target_label;

-- ---------------------------------------------------------------------------
-- THE EXPECTATION TABLE — hand-written from the design, BEFORE the first run.
-- Masks are (fields, credentials, cpf_change, lifecycle).
-- ---------------------------------------------------------------------------
create temp table x_expect (caller_label text, target_label text, old_mask text, new_mask text);
insert into x_expect values
  -- CA — org_admin A.  OLD: the column says A for all seventeen, so all TTTT.
  ('CA','P1','TTTT','TTTT'), ('CA','P2','TTTT','TTTT'), ('CA','P3','TTTT','FFFF'),
  ('CA','P4','TTTT','FFFF'), ('CA','P5','TTTT','TTTT'), ('CA','P6','TTTT','TTTT'),
  ('CA','P7','TTTT','TTTT'), ('CA','P8','TTTT','FFFF'), ('CA','P9','TTTT','FFFF'),
  ('CA','P10','TTTT','FFFF'),
  ('CA','Q1','TTTT','TTTT'), ('CA','Q2','TTTT','FFFF'), ('CA','Q3','TTTT','FFFF'),
  ('CA','Q4','TTTT','FFFF'), ('CA','Q5','TTTT','TTTT'), ('CA','Q6','TTTT','TTTT'),
  ('CA','Q7','TTTT','FFFF'),
  -- CB — org_admin B.  OLD: never, the column says A and CB holds nothing there.
  ('CB','P1','FFFF','FFFF'), ('CB','P2','FFFF','FFFF'), ('CB','P3','FFFF','FFFF'),
  ('CB','P4','FFFF','TTTT'), ('CB','P5','FFFF','TTTT'), ('CB','P6','FFFF','FFFF'),
  ('CB','P7','FFFF','TTTT'), ('CB','P8','FFFF','TTTT'), ('CB','P9','FFFF','FFFF'),
  ('CB','P10','FFFF','FFFF'),
  ('CB','Q1','FFFF','FFFF'), ('CB','Q2','FFFF','TTTT'), ('CB','Q3','FFFF','TTTT'),
  ('CB','Q4','FFFF','TTTT'), ('CB','Q5','FFFF','FFFF'), ('CB','Q6','FFFF','TTTT'),
  ('CB','Q7','FFFF','TTTT'),
  -- CC — the cross-org actor.  Only P10 ever resolves to org C.
  ('CC','P1','FFFF','FFFF'), ('CC','P2','FFFF','FFFF'), ('CC','P3','FFFF','FFFF'),
  ('CC','P4','FFFF','FFFF'), ('CC','P5','FFFF','FFFF'), ('CC','P6','FFFF','FFFF'),
  ('CC','P7','FFFF','FFFF'), ('CC','P8','FFFF','FFFF'), ('CC','P9','FFFF','FFFF'),
  ('CC','P10','FFFF','TTTT'),
  ('CC','Q1','FFFF','FFFF'), ('CC','Q2','FFFF','FFFF'), ('CC','Q3','FFFF','FFFF'),
  ('CC','Q4','FFFF','FFFF'), ('CC','Q5','FFFF','FFFF'), ('CC','Q6','FFFF','FFFF'),
  ('CC','Q7','FFFF','FFFF'),
  -- HA1 — hospital_admin of HCA only.  On population P the footprint is EMPTY, so
  -- the empty-footprint deny answers every cell on both sides.
  ('HA1','P1','FFFF','FFFF'), ('HA1','P2','FFFF','FFFF'), ('HA1','P3','FFFF','FFFF'),
  ('HA1','P4','FFFF','FFFF'), ('HA1','P5','FFFF','FFFF'), ('HA1','P6','FFFF','FFFF'),
  ('HA1','P7','FFFF','FFFF'), ('HA1','P8','FFFF','FFFF'), ('HA1','P9','FFFF','FFFF'),
  ('HA1','P10','FFFF','FFFF'),
  ('HA1','Q1','TTFF','TTFF'), ('HA1','Q2','TTFF','FFFF'), ('HA1','Q3','FFFF','FFFF'),
  ('HA1','Q4','FFFF','FFFF'), ('HA1','Q5','TTFF','TTFF'), ('HA1','Q6','TTFF','TTFF'),
  ('HA1','Q7','FFFF','FFFF'),
  -- HAD — hospital_admin of HCA AND HSA, so SUBSET can succeed for it.
  ('HAD','Q1','TTTT','TTTT'), ('HAD','Q2','TTTT','FFFF'), ('HAD','Q3','TTFF','FFFF'),
  ('HAD','Q4','FFFF','FFFF'), ('HAD','Q5','TTTT','TTTT'), ('HAD','Q6','TTFF','TTFF'),
  ('HAD','Q7','FFFF','FFFF'),
  -- HB1 — CONSTRUCTED hospital_admin of HCB.  OLD: nothing in org A, so never.
  ('HB1','Q1','FFFF','FFFF'), ('HB1','Q2','FFFF','FFFF'), ('HB1','Q3','FFFF','TTFF'),
  ('HB1','Q4','FFFF','FFFF'), ('HB1','Q5','FFFF','FFFF'), ('HB1','Q6','FFFF','TTFF'),
  ('HB1','Q7','FFFF','TTTT'),
  -- CS — staff.  The pure negative, on both sides, everywhere.
  ('CS','P1','FFFF','FFFF'), ('CS','P2','FFFF','FFFF'), ('CS','P3','FFFF','FFFF'),
  ('CS','P4','FFFF','FFFF'), ('CS','P5','FFFF','FFFF'), ('CS','P6','FFFF','FFFF'),
  ('CS','P7','FFFF','FFFF'), ('CS','P8','FFFF','FFFF'), ('CS','P9','FFFF','FFFF'),
  ('CS','P10','FFFF','FFFF'),
  ('CS','Q1','FFFF','FFFF'), ('CS','Q2','FFFF','FFFF'), ('CS','Q3','FFFF','FFFF'),
  ('CS','Q4','FFFF','FFFF'), ('CS','Q5','FFFF','FFFF'), ('CS','Q6','FFFF','FFFF'),
  ('CS','Q7','FFFF','FFFF');

-- ---------------------------------------------------------------------------
-- THE HAND LISTS — written INDEPENDENTLY of the expectation table above.
-- ---------------------------------------------------------------------------
create temp table x_declared_widening (caller_label text, target_label text, cap text, reason text);
insert into x_declared_widening
select v.c, v.t, cp.cap, v.r from (values
  ('CB','P4','ended in A, ACTIVE in B — arm 2 must not fire while arm 1 is non-empty (bound 3)'),
  ('CB','P5','the ended_on TIE — bound 2 yields ALL tied orgs'),
  ('CB','P7','ACTIVE in both organisations'),
  ('CB','P8','column A, ACTIVE only in B — the substrate is the truth'),
  ('CC','P10','the same class through a CROSS-ORG actor'),
  ('CB','Q2','as P8, with a footprint present — the org arm is footprint-blind'),
  ('CB','Q3','as Q2, footprint spanning two organisations'),
  ('CB','Q4','RETENTION to B — ADR 0163 on the WRITE side'),
  ('CB','Q6','ACTIVE in both, cross-org footprint'),
  ('CB','Q7','column A, ACTIVE B, single-hospital footprint')
) as v(c,t,r) cross join x_caps cp
union all
select v.c, v.t, cp.cap, v.r from (values
  ('HB1','Q3','⭐ INTERSECTION admits one administered hospital of a two-hospital footprint; SUBSET refuses'),
  ('HB1','Q6','the same, reached through a cross-org footprint')
) as v(c,t,r) cross join x_caps cp where cp.cap in ('fields','credentials')
union all
select 'HB1','Q7', cp.cap,
       'SINGLE-hospital footprint, so INTERSECTION and SUBSET coincide — the control that makes Q3/Q6 a property of the FOOTPRINT'
  from x_caps cp;

create temp table x_declared_narrowing (caller_label text, target_label text, cap text, disposition text);
insert into x_declared_narrowing
select v.c, v.t, cp.cap, v.d from (values
  ('CA','P3','ACCEPT — bound 1: a voided row is "was never true"'),
  ('CA','P4','ACCEPT — authority follows the ACTIVE organisation'),
  ('CA','P8','ACCEPT — the intended mechanism change'),
  ('CA','P9','ACCEPT WITH BLAST RADIUS NAMED — a true orphan is administrable by nobody; recovery is one affiliation away (ADR 0165 W5/W6/W7)'),
  ('CA','P10','ACCEPT — the same class, cross-org'),
  ('CA','Q2','ACCEPT — the mechanism change with a footprint present'),
  ('CA','Q3','ACCEPT — same'),
  ('CA','Q4','ACCEPT — retention moved the authority to org B'),
  ('CA','Q7','ACCEPT — same'),
  ('HAD','Q2','ACCEPT — the footprint is stranded in org A; the person is org B''s now')
) as v(c,t,d) cross join x_caps cp
union all
select v.c, v.t, cp.cap, v.d from (values
  ('HA1','Q2','ACCEPT — INTERSECTION-only loss, the SUBSET half was already denied'),
  ('HAD','Q3','ACCEPT — same class, the administered hospital was the stranded one')
) as v(c,t,d) cross join x_caps cp where cp.cap in ('fields','credentials');

-- ===========================================================================
-- § 0 — PRECONDITIONS.  Each one licenses a later claim; none is decorative.
-- ===========================================================================
select is(
  (select count(*)::int from x_snapshot s
    where s.home_organization_id = (select org_a from pg_temp.k())),
  17,
  '§ 0.1 all seventeen targets are anchored to org A by the column, so every '
  'movement is attributable to the new predicate and to nothing else');

select is(
  (select count(*)::int from public.memberships m
    where m.principal_id in (select target from x_targets) and m.commission_id is null),
  0,
  '§ 0.2 no target holds an org-tier or hospital-tier seat, so the D2 '
  'push-to-org_admin-only rule is not what is deciding any cell');

select is(
  (select count(*)::int from public.profiles p
    where p.id in (select caller from x_callers) and p.is_admin),
  0,
  '§ 0.3 no caller is a platform admin — the org and hospital arms are the only '
  'routes into these cells');

select is(
  (select count(*)::int from x_callers c where not app.is_active(c.caller)),
  0,
  '§ 0.4 every caller is app.is_active, so the actor-active gate is not silently '
  'answering cells the authority arms are meant to answer');

select is(
  (select string_agg(t.label || '=' || coalesce(fp.hospitals, '-'), ' ' order by t.label)
     from x_targets t
     left join lateral (
       select string_agg(h.name, '+' order by h.name) as hospitals
         from (select ha.hospital_id as hid from public.hospital_affiliations ha
                where ha.principal_id = t.target and ha.ended_on is null and ha.voided_at is null
                union
               select c.hospital_id from public.memberships m
                 join public.commissions c on c.id = m.commission_id
                where m.principal_id = t.target and c.hospital_id is not null) f
         join public.hospitals h on h.id = f.hid) fp on true
    where t.pop = 'Q'),
  'Q1=Hospital Central A+Hospital Secundário A '
  'Q2=Hospital Central A+Hospital Secundário A '
  'Q3=Hospital Central B+Hospital Secundário A '
  'Q4=- '
  'Q5=Hospital Central A+Hospital Secundário A '
  'Q6=Hospital Central A+Hospital Central B '
  'Q7=Hospital Central B',
  '§ 0.5 the MEASURED footprints are the designed ones — the fixture built the '
  'world it claims, including Q4''s deliberately empty one');

select is(
  (select string_agg(t.label || '=' || coalesce(o.orgs, '-'), ' ' order by t.label)
     from x_targets t
     left join lateral (
       select string_agg(og.name, '+' order by og.name) as orgs
         from app.person_authority_orgs(t.target) pao
         join public.organizations og on og.id = pao.organization_id) o on true),
  'P1=Rede Hospitalar A P10=Rede Hospitalar C P2=Rede Hospitalar A P3=- '
  'P4=Rede Hospitalar B P5=Rede Hospitalar A+Rede Hospitalar B P6=Rede Hospitalar A '
  'P7=Rede Hospitalar A+Rede Hospitalar B P8=Rede Hospitalar B P9=- '
  'Q1=Rede Hospitalar A Q2=Rede Hospitalar B Q3=Rede Hospitalar B Q4=Rede Hospitalar B '
  'Q5=Rede Hospitalar A Q6=Rede Hospitalar A+Rede Hospitalar B Q7=Rede Hospitalar B',
  '§ 0.6 the MEASURED located organisations are the designed ones — all four '
  'ADR 0163 bounds visible in one string (P3 void-only empty, P5 the tie yielding '
  'BOTH, P6 the voided-ordering trap resolving to A, P9 the orphan empty)');

select ok(
  (select count(*) from x_seed) >= 30
  and not exists (select 1 from x_seed s join x_targets t on t.target = s.person_id),
  '§ 0.7 the seed snapshot was taken BEFORE the fixtures existed, so § 8''s '
  'zero-movement claim cannot be diluted by them');

-- ===========================================================================
-- § 1 — THE CATALOG CONTRACT.  Measured from pg_proc, never from a migration file.
-- ===========================================================================
select is(
  (select p.prosecdef::text || '|' || p.provolatile::text || '|'
          || array_to_string(coalesce(p.proconfig, '{}'), ',') || '|'
          || array_to_string(coalesce(p.proacl, '{}'), ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_administer_person_for'),
  'true|s|search_path=app, public, pg_catalog|postgres=X/postgres',
  '§ 1.1 can_administer_person_for keeps its DEFINER context, STABLE volatility, '
  'pinned search_path and postgres-only EXECUTE across the re-predication');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_administer_person_for'
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'home_organization_id'),
  0,
  '§ 1.2 the capability predicate no longer resolves the column (comment-stripped, '
  'because a comment mentioning it is not a read)');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app'
      and p.proname in ('set_person_active_impl','suspend_person_impl',
                        'update_person_fields_impl','upsert_credential_impl',
                        'delete_credential_impl','finalize_invited_person_impl')
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'home_organization_id'),
  0,
  '§ 1.3 none of the six AE1.3 person-door kernels resolves the column');

select is(
  (select p.prosecdef::text || '|' || p.provolatile::text || '|'
          || array_to_string(coalesce(p.proconfig, '{}'), ',') || '|'
          || array_to_string(coalesce(p.proacl, '{}'), ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'person_audit_organization'),
  'true|s|search_path=app, public, pg_catalog|postgres=X/postgres',
  '§ 1.4 person_audit_organization is DEFINER, STABLE, pinned and postgres-only — '
  'it decides audit-row readership, so it is not client-reachable');

select is(
  (select string_agg(n.nspname || '.' || p.proname, ' ' order by n.nspname, p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app','public')
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'home_organization_id'),
  'public.guard_profile_privileged_columns public.handle_new_user',
  '§ 1.5 exactly TWO functions still name the column, and both are the column-drop '
  'increment''s — they WRITE or GUARD it rather than deriving authority from it. '
  '⚠ An enumeration, not a count: a newcomer reds by name');

select ok(
  not has_function_privilege('anon', 'app.person_authority_orgs(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'app.person_authority_orgs(uuid)', 'execute')
  and not has_function_privilege('service_role', 'app.person_authority_orgs(uuid)', 'execute'),
  '§ 1.6 the locator stays unreachable by every client role — asserted POSITIVELY '
  'via has_function_privilege, never by reading proacl for an absence');

-- ===========================================================================
-- § 2 — THE ORG-TIER DIFFERENTIAL (population P).
-- ===========================================================================
select is(
  (select count(*)::int from x_measured m join x_expect e using (caller_label, target_label)
     join x_targets t on t.label = m.target_label
    where t.pop = 'P' and (m.old_mask, m.new_mask) is distinct from (e.old_mask, e.new_mask)),
  0,
  '§ 2.1 all 200 org-tier cells match the expectation table written before the run');

select ok(
  (select bool_and(old_mask in ('TTTT','FFFF') and new_mask in ('TTTT','FFFF'))
     from x_measured m join x_targets t on t.label = m.target_label where t.pop = 'P'),
  '§ 2.2 ⭐ THE CAPABILITY AXIS IS INERT ON THE ORG TIER — MEASURED, NOT ASSUMED. '
  'Every P cell agrees across all four capabilities on BOTH sides, because the org '
  'arm returns before the dispatch and the footprint is empty. This is why a '
  '"capability differential" built on 392''s population alone would be four '
  'identical copies of a read-side result');

select is(
  (select string_agg(m.caller_label || '×' || m.target_label || ':'
                     || case when m.old_mask = 'FFFF' then '↑' else '↓' end, ' '
                     order by m.caller_label, m.target_label)
     from x_measured m join x_targets t on t.label = m.target_label
    where t.pop = 'P' and m.old_mask is distinct from m.new_mask),
  'CA×P10:↓ CA×P3:↓ CA×P4:↓ CA×P8:↓ CA×P9:↓ CB×P4:↑ CB×P5:↑ CB×P7:↑ CB×P8:↑ CC×P10:↑',
  '§ 2.3 the org-tier movement reproduces AE2.3a''s read-side matrix EXACTLY — the '
  'same five widenings and five narrowings, now on the WRITE path. ⭐ Two '
  'independently written predicates agreeing cell-for-cell is the cross-check; if '
  'the write path had drifted from the read path, this is where it shows');

-- ===========================================================================
-- § 3 — THE HOSPITAL-TIER / CAPABILITY DIFFERENTIAL (population Q).
-- ===========================================================================
select is(
  (select count(*)::int from x_measured m join x_expect e using (caller_label, target_label)
     join x_targets t on t.label = m.target_label
    where t.pop = 'Q' and (m.old_mask, m.new_mask) is distinct from (e.old_mask, e.new_mask)),
  0,
  '§ 3.1 all 196 hospital-tier cells match the expectation table');

select ok(
  (select count(*) from x_measured m join x_targets t on t.label = m.target_label
    where t.pop = 'Q' and m.old_mask not in ('TTTT','FFFF')) >= 3
  and (select count(*) from x_measured m join x_targets t on t.label = m.target_label
        where t.pop = 'Q' and m.new_mask not in ('TTTT','FFFF')) >= 3,
  '§ 3.2 THE FLOOR THAT STOPS § 3.1 BEING VACUOUS ON THE CAPABILITY AXIS: at least '
  'three Q cells disagree across capabilities on EACH side. Without this, § 3.1 '
  'could pass over a matrix where the axis is as inert as it is on P');

select is(
  (select string_agg(m.cap || '=' || m.new_v::text, ' ' order by c.ord)
     from x_matrix m join x_caps c on c.cap = m.cap
    where m.caller_label = 'HB1' and m.target_label = 'Q3'),
  'fields=true credentials=true cpf_change=false lifecycle=false',
  '§ 3.3 ⭐⭐ THE KEYSTONE CELL. A hospital_admin of ONE hospital in the newly '
  'located organisation gains `fields` and `credentials` (INTERSECTION) over a '
  'two-hospital footprint and is still refused `cpf_change` and `lifecycle` '
  '(SUBSET). Under the column this actor reached NOTHING. ⛔ This is the cell the '
  'drop would have moved silently, and no seeded persona can construct it');

select is(
  (select count(*)::int from x_matrix
    where target_label = 'Q4' and caller_label in ('HA1','HAD','HB1')
      and (old_v or new_v)),
  0,
  '§ 3.4 ADR 0163 BOUND 4 SURVIVES STRUCTURALLY: retention adds no hospital-tier '
  'reach. Q4''s retaining org is B and HB1 administers a hospital there, yet the '
  'empty footprint refuses all four capabilities — the bound is enforced by the '
  'footprint rule, not by the locator');

-- ===========================================================================
-- § 4 — WIDENINGS.  Pre-declared or it is a red.
-- ===========================================================================
select is(
  (select count(*)::int from x_matrix m
    where m.new_v and not m.old_v
      and not exists (select 1 from x_declared_widening d
                       where (d.caller_label, d.target_label, d.cap)
                           = (m.caller_label, m.target_label, m.cap))),
  0,
  '§ 4.1 EVERY MEASURED WIDENING IS PRE-DECLARED. An undeclared widening is a red, '
  'per ADR 0154 / plan PA-F13');

select is(
  (select count(*)::int from x_declared_widening d
    where not exists (select 1 from x_matrix m
                       where (m.caller_label, m.target_label, m.cap)
                           = (d.caller_label, d.target_label, d.cap)
                         and m.new_v and not m.old_v)),
  0,
  '§ 4.2 and the hand list carries NO cell that does not actually widen — the '
  'cross-check between two independently written artefacts, so they cannot drift '
  'into agreement. Combined with § 4.1 the two sets are EQUAL (48 cells)');

select ok(
  (select count(*) from x_matrix where old_v) between 60 and 200
  and (select count(*) from x_matrix where new_v) between 60 and 200
  and (select count(*) from x_matrix where new_v and not old_v) = 48
  and (select count(*) from x_matrix where old_v and not new_v) = 44,
  '§ 4.3 THE NON-VACUITY FLOOR: both predicates are genuinely mixed over the 396 '
  'cells, and the movement is 48 widenings / 44 narrowings. A match between two '
  'CONSTANTS would satisfy § 4.1 and § 5.1 and prove nothing');

-- ===========================================================================
-- § 5 — NARROWINGS.  Each one accepted in writing.
-- ===========================================================================
select is(
  (select count(*)::int from x_matrix m
    where m.old_v and not m.new_v
      and not exists (select 1 from x_declared_narrowing d
                       where (d.caller_label, d.target_label, d.cap)
                           = (m.caller_label, m.target_label, m.cap))),
  0,
  '§ 5.1 every measured narrowing carries a written disposition — narrowing can be '
  'wrong and safe, but it may not be SILENT');

select is(
  (select count(*)::int from x_declared_narrowing d
    where not exists (select 1 from x_matrix m
                       where (m.caller_label, m.target_label, m.cap)
                           = (d.caller_label, d.target_label, d.cap)
                         and m.old_v and not m.new_v)),
  0,
  '§ 5.2 and no accepted-narrowing line describes a cell that does not narrow');

-- ===========================================================================
-- § 6 — THE RULING THAT WAS NOT TAKEN, MEASURED BESIDE THE ONE THAT WAS.
-- ===========================================================================
select is(
  (select string_agg(t.label, ' ' order by t.label) from x_targets t
    where exists (select 1 from public.organization_affiliations oa
                   where oa.principal_id = t.target and oa.voided_at is null
                     and oa.ended_on is not null)
      and not exists (select 1 from public.organization_affiliations oa
                       where oa.principal_id = t.target and oa.ended_on is null
                         and oa.voided_at is null)),
  'P2 P5 P6 Q4 Q5',
  '§ 6.1 ADR 0163''s retention arm fires on exactly five of the seventeen targets — '
  'the derivation domain the counterfactual below is bounded to');

select is(
  (select count(*)::int from x_matrix where new_v is distinct from alt_v),
  16,
  '§ 6.2 the CAPABILITY-BOUNDED reading of ADR 0163''s Decision paragraph would move '
  'exactly 16 of the 396 cells — all of them `fields` or `credentials` on a target '
  'whose authority comes from retention. ⛔ Measured, not argued: the PO ruled the '
  'SUBSET wording a borrowed hospital-tier label and amended the ADR, and a ruling '
  'that a reading was NOT intended is worth more with the alternative measured');

select is(
  (select count(*)::int from x_matrix where old_v and not alt_v and new_v)::text
    || '/' || (select count(*)::int from x_matrix where not old_v and new_v and not alt_v)::text,
  '12/4',
  '§ 6.3 and the direction is stated: the counterfactual would create 12 NEW '
  'narrowings (an org_admin unable to correct an ex-employee''s name) and would '
  'cancel 4 already-declared widenings. Bound 3 of the same ADR — "grants nothing '
  'beyond what an org_admin of an ACTIVE affiliation would hold" — contradicts it, '
  'and such an admin holds all four');

select ok(
  (select new_v from x_matrix where caller_label='CA' and target_label='P2' and cap='fields')
  and (select new_v from x_matrix where caller_label='CB' and target_label='Q4' and cap='credentials'),
  '§ 6.4 the SHIPPED predicate is the capability-BLIND one: retention carries '
  '`fields` and `credentials` too. This is the assertion that reds if anyone later '
  '"restores" the ADR''s original SUBSET wording without re-opening the ruling');

-- ===========================================================================
-- § 7 — THE AUDIT-ORGANISATION DIFFERENTIAL, WHICH IS A READ-AUTHORITY ONE.
-- ===========================================================================
select is(
  (select count(*)::int from x_matrix m
     join x_callers cl on cl.label = m.caller_label
     join x_targets tg on tg.label = m.target_label
    where m.new_v
      and (app.person_audit_organization(cl.caller, tg.target) is null
           or not exists (select 1 from app.person_authority_orgs(tg.target) o
                           where o.organization_id
                                 = app.person_audit_organization(cl.caller, tg.target))
           or not (app.is_org_admin_of_for(
                     app.person_audit_organization(cl.caller, tg.target), cl.caller)
                   or exists (select 1 from public.hospitals h
                               where h.organization_id
                                     = app.person_audit_organization(cl.caller, tg.target)
                                 and app.is_hospital_admin_of_for(h.id, cl.caller))))),
  0,
  '§ 7.1 for EVERY authorized cell the attributed organisation is one the target''s '
  'affiliations LOCATE and one the actor actually administers — so the acting admin '
  'can always read the audit row they caused (audit_log_select''s '
  'commission_id-IS-NULL arm gates exactly on this)');

select is(
  (select count(*)::int from x_matrix m
     join x_callers cl on cl.label = m.caller_label
     join x_targets tg on tg.label = m.target_label
     join x_snapshot sn on sn.person_id = tg.target
    where m.new_v and tg.label in ('P1','P2','P6','Q1','Q5')
      and app.person_audit_organization(cl.caller, tg.target)
          is distinct from sn.home_organization_id),
  0,
  '§ 7.2 where the located organisation and the column COINCIDE — which is the whole '
  'of seed.sql — the attributed organisation is byte-identical to what the column '
  'produced. The audit trail''s readership does not move for anybody real');

select is(
  (select string_agg(m.caller_label || '×' || m.target_label || '→' || og.name, ' '
                     order by m.caller_label, m.target_label)
     from (select distinct caller_label, target_label from x_matrix where new_v) m
     join x_callers cl on cl.label = m.caller_label
     join x_targets tg on tg.label = m.target_label
     join x_snapshot sn on sn.person_id = tg.target
     join public.organizations og
       on og.id = app.person_audit_organization(cl.caller, tg.target)
    where app.person_audit_organization(cl.caller, tg.target)
          is distinct from sn.home_organization_id),
  'CB×P4→Rede Hospitalar B CB×P5→Rede Hospitalar B CB×P7→Rede Hospitalar B '
  'CB×P8→Rede Hospitalar B CB×Q2→Rede Hospitalar B CB×Q3→Rede Hospitalar B '
  'CB×Q4→Rede Hospitalar B CB×Q6→Rede Hospitalar B CB×Q7→Rede Hospitalar B '
  'CC×P10→Rede Hospitalar C HB1×Q3→Rede Hospitalar B HB1×Q6→Rede Hospitalar B '
  'HB1×Q7→Rede Hospitalar B',
  '§ 7.3 the thirteen cells where audit-row READERSHIP moves off the column, '
  'pre-declared by enumeration. Each is a cell where the person''s employment is '
  'genuinely elsewhere, so the row becomes readable by the admins who can act on '
  'the person and stops being readable by the ones who cannot');

select is(
  (select og.name from public.organizations og
    where og.id = app.person_audit_organization(
                    (select cab from pg_temp.k()),
                    (select target from x_targets where label = 'Q6'))),
  'Rede Hospitalar A',
  '§ 7.4 ⚠ THE TIE-BREAK IS BOUNDED-BUT-ARBITRARY, AND PRE-DECLARED AS SUCH. An '
  'actor administering BOTH located organisations attributes to the lower uuid; the '
  'losing organisation''s OTHER admins lose readership of that row. Any candidate is '
  'a defensible attribution — WHICH one is arbitrary, chosen for determinism. The '
  'lowest uuid means nothing, and a later reader must not infer that it does');

select ok(
  app.person_audit_organization(
    (select cs from pg_temp.k()),
    (select target from x_targets where label = 'Q3')) is null
  and app.person_audit_organization(
        (select ca from pg_temp.k()),
        (select target from x_targets where label = 'P9')) is null,
  '§ 7.5 FAIL-CLOSED: an actor with no authority over the person, and a person with '
  'no locating organisation at all, both attribute NULL — which routes the audit row '
  'to the platform-admin-only arm rather than to an organisation nobody vetted');

-- ===========================================================================
-- § 8 — THE SEED POPULATION.  The reason this change is a mechanism change.
-- ===========================================================================
select ok((select count(*) from x_seed) >= 30,
  '§ 8.1 the seed snapshot is floored at 30 persons rather than pinned to an exact '
  'count, because catalog-driven seed counts drift and a pinned one reds for the '
  'wrong reason');

select is(
  (select count(*)::int
     from x_seed s
     cross join (values ((select ca from pg_temp.k())),
                        ((select cb from pg_temp.k())),
                        ((select cc from pg_temp.k())),
                        ((select ha1 from pg_temp.k())),
                        ((select had from pg_temp.k()))) as a(actor)
     cross join x_caps cp
    where pg_temp.can_admin_with_orgs(
            cp.cap, s.person_id, a.actor,
            case when s.home_organization_id is null then '{}'::uuid[]
                 else array[s.home_organization_id] end)
          is distinct from app.can_administer_person_for(cp.cap, s.person_id, a.actor)),
  0,
  '§ 8.2 ZERO MOVEMENT across the entire seed roster, for five callers and all four '
  'capabilities. ⛔ This is what makes the change a mechanism change AND what makes '
  'every other seeded suite blind to it: home org and located org coincide for every '
  'seeded person, so nothing outside this file could have noticed');

select ok(
  (select count(*)
     from x_seed s
     cross join x_caps cp
    where app.can_administer_person_for(cp.cap, s.person_id, (select ca from pg_temp.k()))) >= 25,
  '§ 8.3 and the floor that stops § 8.2 being agreement between two silent falses: '
  'org_admin A holds at least 25 (person, capability) cells over the seed');

-- ===========================================================================
-- § 9 — THE FAITHFULNESS CONTROL, AND ARCHITECTURE RULE 13.
-- ===========================================================================
select is(
  (select count(*)::int from x_matrix where ctl_v is distinct from new_v),
  0,
  '§ 9.1 ⭐ THE CONTROL THAT MAKES THE OLD SIDE TRUSTWORTHY. The reproduction, fed '
  'app.person_authority_orgs(target), equals the SHIPPED predicate on all 396 cells '
  '— so the only difference between the two sides of this differential is the '
  'ORGANISATION LIST. Any drift in the reproduced D2 / footprint / INTERSECTION / '
  'SUBSET logic reds HERE instead of masquerading as a finding in § 4 or § 5');

select is(
  (select count(*)::int from x_caps cp
     cross join (values ('Q3'), ('Q7')) as v(label)
     join x_targets tg on tg.label = v.label
    where app.can_administer_person_for(cp.cap, tg.target, (select csh from pg_temp.k()))),
  0,
  '§ 9.2 ARCHITECTURE RULE 13 — a caller who SHARES an active organization '
  'affiliation with the target but holds NO membership anywhere is denied for every '
  'capability. The affiliation LOCATES; only a memberships row GRANTS. ⛔ The '
  'collapsed one-join form type-checks identically, which is why this is asserted '
  'rather than reviewed for');

-- ===========================================================================
-- § 10 — THE SIX KERNELS, END TO END.
--
-- ⛔ THIS SECTION EXISTS BECAUSE OF A MEASURED GAP, NOT FOR COMPLETENESS. `385` and `386`
--    are the person-door suites and they assert the audit row's `action`, `actor_id` and
--    `metadata` — and NEVER its `organization_id` (grep-measured over both files before
--    this section was written). That value is precisely what this increment moves, and it
--    is a READ-AUTHORITY value: `audit_log_select` admits a commission-less row to
--    `app.is_org_admin_of(organization_id)`. Without § 10 the six kernels' half of the
--    change would ship with no assertion anywhere.
--
-- The actor is `orgadmin.b` over Q7 — an actor whose authority exists ONLY under the new
-- predicate (old = FFFF, new = TTTT), so every row here is attributed by a path that did
-- not exist before this migration.
-- ===========================================================================
create temp table x_kernel_audit (action text, organization_id uuid);
create temp table x_kernel_cred (id uuid);

-- ⛔ THE WATERMARK IS AN ID SNAPSHOT, NOT `max(seq)`, AND THE FIRST DRAFT GOT THAT WRONG.
-- `audit_log.seq` is PER-CHAIN, not global — `app.audit_write` derives it from the max
-- within the row's own chain (commission / hospital / organization), which is what makes
-- `public.verify_audit_chain` work. A global `select max(seq)` therefore returns some other
-- chain's counter, and `where seq > that` matches NOTHING: the section ran, six audit rows
-- were written, and the instrument reported zero. ⭐ Caught by § 10.2's floor rather than by
-- reading the code — an assertion of the form "zero rows carry the old value" would have
-- passed, gloriously, over an empty set.
create temp table x_audit_before as select id from public.audit_log;

-- ⛔ EVERY CALL IS EXCEPTION-GUARDED, AND THAT IS NOT DEFENSIVE TIDINESS. An unguarded
-- fixture that DRIVES the subject under test turns any mutation of that subject into a
-- suite ABORT — a FAIL-shaped abort that runs a prefix of the plan and is indistinguishable
-- from a hold when read as a verdict. Measured: the first mutation run reported
-- `Files=2, Tests=40` for two mutations, so § 10 never executed and its coverage under them
-- was UNKNOWN rather than green. Guarded, a mutation that breaks authority now REDS § 10.1
-- and § 10.2 (no rows written) instead of erasing them.
do $$
declare
  v_actor uuid := (select cb from pg_temp.k());
  v_user  uuid := (select target from x_targets where label = 'Q7');
  v_cred  uuid;
begin
  begin perform app.finalize_invited_person_impl(                             -- cpf_change
          v_actor, v_user, 'AE24c Q7', null, null, null, null, false);
  exception when others then null; end;
  begin perform app.update_person_fields_impl(                                -- fields
          v_actor, v_user, 'AE24c Q7 renomeado', null,
          false, null, false, null, false, null);
  exception when others then null; end;
  begin v_cred := app.upsert_credential_impl(                                 -- credentials
           v_actor, v_user, null, 'BR', 'SP', 'COREN', 'AE24C-Q7', null);
        perform app.delete_credential_impl(v_actor, v_cred);                  -- credentials
  exception when others then null; end;
  begin perform app.suspend_person_impl(                                      -- lifecycle
          v_actor, v_user, now() + interval '1 day');
  exception when others then null; end;
  begin perform app.set_person_active_impl(v_actor, v_user, true);            -- lifecycle
  exception when others then null; end;

  insert into x_kernel_audit
  select a.action, a.organization_id
    from public.audit_log a
   where not exists (select 1 from x_audit_before b where b.id = a.id);

  -- A FRESH credential for § 10.3, so its refusal comes from the AUTHORITY check and not
  -- from `v_user is null` on a row that no longer exists — the two return the identical
  -- 42501 and would be indistinguishable.
  insert into public.professional_credentials
    (user_id, issuing_country, issuing_state, issuing_authority, registration_number)
  values (v_user, 'BR', 'SP', 'COREN', 'AE24C-Q7-KEEP')
  returning id into v_cred;
  insert into x_kernel_cred values (v_cred);
end;
$$;

create or replace function pg_temp.kernel_sqlstates(p_actor uuid, p_user uuid, p_cred uuid)
returns text language plpgsql as $fn$
declare parts text[] := '{}';
begin
  begin perform app.finalize_invited_person_impl(p_actor, p_user, 'x', null, null, null, null, false);
        parts := parts || 'finalize=NONE';
  exception when others then parts := parts || ('finalize=' || sqlstate); end;
  begin perform app.update_person_fields_impl(p_actor, p_user, 'x', null, false, null, false, null, false, null);
        parts := parts || 'fields=NONE';
  exception when others then parts := parts || ('fields=' || sqlstate); end;
  begin perform app.upsert_credential_impl(p_actor, p_user, null, 'BR', 'SP', 'COREN', 'X', null);
        parts := parts || 'upsert=NONE';
  exception when others then parts := parts || ('upsert=' || sqlstate); end;
  begin perform app.delete_credential_impl(p_actor, p_cred);
        parts := parts || 'delete=NONE';
  exception when others then parts := parts || ('delete=' || sqlstate); end;
  begin perform app.suspend_person_impl(p_actor, p_user, now());
        parts := parts || 'suspend=NONE';
  exception when others then parts := parts || ('suspend=' || sqlstate); end;
  begin perform app.set_person_active_impl(p_actor, p_user, true);
        parts := parts || 'active=NONE';
  exception when others then parts := parts || ('active=' || sqlstate); end;
  return array_to_string(parts, ' ');
end;
$fn$;

select is(
  (select string_agg(ka.action || '=' || og.name, ' ' order by ka.action)
     from x_kernel_audit ka join public.organizations og on og.id = ka.organization_id),
  'credential.created=Rede Hospitalar B credential.deleted=Rede Hospitalar B '
  'person.fields_updated=Rede Hospitalar B person.reactivated=Rede Hospitalar B '
  'person.registered=Rede Hospitalar B person.suspended=Rede Hospitalar B',
  '§ 10.1 ALL SIX kernels attribute their audit row to the LOCATED organisation. Reported '
  'PER KERNEL rather than as a count, so one kernel left on the column reds by name — a '
  'count would go on passing at 5 of 6');

select is(
  (select count(*)::int from x_kernel_audit)::text || '/' ||
  (select count(*)::int from x_kernel_audit
    where organization_id = (select org_a from pg_temp.k()))::text,
  '6/0',
  '§ 10.2 THE DIFFERENTIAL STATEMENT, with its own floor: exactly SIX rows were written '
  '(so § 10.1 is not true of an empty set) and ZERO carry the column''s value. Under the '
  'old predicate every one of these six would have been attributed to org A — readable by '
  'admins with no authority over this person, and NOT readable by the admin who acted');

select is(
  pg_temp.kernel_sqlstates(
    (select ca from pg_temp.k()),
    (select target from x_targets where label = 'Q7'),
    (select id from x_kernel_cred)),
  'finalize=42501 fields=42501 upsert=42501 delete=42501 suspend=42501 active=42501',
  '§ 10.3 THE DENY POLARITY, on the same six doors: `orgadmin.a` — who administered this '
  'person under the column and does not under the affiliations — is refused by every one '
  'of them. ⭐ Its positive control is § 10.1 itself: the identical six calls SUCCEEDED for '
  '`orgadmin.b`, so this is not six doors that refuse everybody');

select * from finish();
rollback;

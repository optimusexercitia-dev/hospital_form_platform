-- AE2.4 INCREMENT 3 — THE PERSON-LEVEL WRITE-AUTHORITY PREDICATE, AT CAPABILITY GRAIN.
--
-- Rulings ADR 0163 (last-org retention, as amended 2026-08-28) · ADR 0133 Amdt 1 r1
-- (the INTERSECTION / SUBSET split) · ADR 0155 D3 / Architecture Rule 13 (locate vs
-- grant).  Phase record docs/progress/authz-ae2.md § AE2.4 increment 3.
--
-- ⛔⛔ RE-CUT FOR THE `profiles.home_organization_id` DROP.  THIS SUITE WAS BUILT AS A
--     DIFFERENTIAL AGAINST THAT COLUMN AND IT IS NO LONGER ONE.  Deleted with it: the
--     RLS-free column snapshot, the `old_v` / `old_mask` side of every matrix cell, the
--     pre-declared widening and narrowing hand lists and the four cells that compared
--     them (old § 4.1/§ 4.2/§ 5.1/§ 5.2), the movement floor (old § 4.3), the read-side
--     cross-check (old § 2.3), the counterfactual's direction split (old § 6.3), the
--     seed zero-movement cell (old § 8.2), the two audit cells keyed on the column
--     (old § 7.2 / § 7.3), the seventeen-targets anchor (old § 0.1) and the two
--     "no body names the column" cells (old § 1.2 / § 1.3).  ⭐ Old § 1.5 is INVERTED
--     rather than deleted, and its blind domain is fixed in the same edit — see it.
--
--     ⭐ 20 of the 45 cells were ORTHOGONAL to the column and several are UNIQUE
--     ESTATE-WIDE.  `person_audit_organization` occurs in exactly one test file in the
--     whole tree — this one — so § 1.4, § 7.1, § 7.4, § 7.5 and § 10.1–§ 10.3 are the
--     only assertions anywhere that the six person-door kernels attribute their audit
--     row to the LOCATED organisation (`385` / `386` assert `action`, `actor_id` and
--     `metadata`, and never `organization_id`).  § 0.6 is the last measurement of
--     `person_authority_orgs`' semantics with all four ADR 0163 bounds in one string.
--     § 9.2 is one of only three Rule-13 cells estate-wide.
--
-- ============================================================================
-- WHAT THIS SUITE IS FOR, AFTER THE RE-CUT
-- ============================================================================
-- `app.can_administer_person_for` is THE person-level capability predicate: it
-- decides `fields` / `credentials` / `cpf_change` / `lifecycle` for every one of
-- the six AE1.3 person-door kernels.  It resolves the target's organisations from
-- `app.person_authority_orgs` — ADR 0163's last-org retention, whose four bounds
-- § 0.6 measures — and then dispatches on capability through the hospital arm.
-- This suite states what that predicate DOES, per (caller × target × capability),
-- against an expectation table written by hand before the first run.
--
-- ⛔ IT IS STILL THE ONLY PLACE THE HOSPITAL ARM IS MEASURED AT CAPABILITY GRAIN.
--    The INTERSECTION / SUBSET split cannot be reached from any seeded persona
--    (§ "WHAT THE SEED CANNOT REACH" below), so without § 3.3 the split is asserted
--    nowhere.
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
--            rather than assuming it.  ⚠ Old § 2.3 cross-checked that this file's
--            MOVEMENT reproduced 392's read-side movement matrix exactly; both
--            movements were against the column, so it is deleted rather than
--            re-pointed — there is no second read-side matrix to agree with.
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
-- THE MATRIX, AND WHAT IS STILL DIFFERENCED AGAINST WHAT
-- ============================================================================
-- Each (caller × target × capability) cell is evaluated three ways in ONE
-- TRANSACTION:
--
--   new_v = app.can_administer_person_for(cap, u, a)          the shipped predicate
--   ctl_v = can_admin_with_orgs(cap, u, a, person_authority_orgs(u))   § 9.1
--   alt_v = can_admin_with_orgs(cap, u, a, orgs_bounded(u, cap))       § 6
--
-- ⛔ THE `old_v` COLUMN — the same reproduction fed an RLS-free snapshot of
--    `profiles.home_organization_id` — IS GONE, and with it every cell whose
--    predicate was `new_v AND NOT old_v` or `old_v AND NOT new_v`.  A dropped
--    column cannot be snapshotted, and a "widening" has no meaning without a
--    second side to widen from.  ⚠ THE HAND LISTS WENT WITH IT: the 48 pre-declared
--    widenings and 44 accepted narrowings this header used to enumerate were, every
--    one of them, of the form "the column said X and the affiliations say Y".  They
--    are NOT re-pointed at some other baseline — a re-pointed list is a hand list
--    wearing its old label — and the classes they named survive as ordinary rows of
--    the expectation table instead.
--
-- ⭐ `can_admin_with_orgs` SURVIVES, and its purpose is now singular: it is the
--    HAND-REPRODUCED capability logic (actor-active, the D2 org arm, the footprint
--    build, INTERSECTION vs SUBSET), parameterised ONLY on the organisation list.
--    § 9.1 asserts it equals the shipped predicate on all 396 cells when fed
--    `person_authority_orgs`, which decomposes the shipped function into
--    "organisation list" + "capability logic" and pins the second half.  § 6 then
--    feeds it a DIFFERENT organisation list to measure the counterfactual ruling.
--
-- ---------------------------------------------------------------------------
-- WHERE THE DELETED HAND LISTS' CONTENT LIVES NOW
-- ---------------------------------------------------------------------------
--   the ORG-TIER classes (CB×P4 bound 3, CB×P5 the `ended_on` tie, CB×P7 active in
--     both, CB×P8 / CC×P10 the substrate is the truth, CB×Q2/Q3/Q6/Q7 the org arm is
--     footprint-blind, CB×Q4 retention)  → x_expect rows + § 0.6, which measures the
--     located organisations for all seventeen targets with all four ADR 0163 bounds
--     visible in one string;
--   the HOSPITAL-TIER split (HB1×Q3 and HB1×Q6 admit {fields, credentials} only;
--     HB1×Q7's SINGLE-hospital footprint makes INTERSECTION and SUBSET coincide, and
--     is the control that makes Q3/Q6 a property of the FOOTPRINT rather than of the
--     predicate)  → § 3.3, the keystone cell, plus its Q7 control in x_expect;
--   the accepted NARROWINGS (CA×P3 void-only, CA×P4/P8/P10 the mechanism change,
--     CA×P9 the orphan, HA1×Q2 and HAD×Q2/Q3 the stranded footprint)  → x_expect rows.
--     ⚠ CA×P9 stays worth reading rather than merely being an FFFF row: a true orphan
--     is administrable by NOBODY, for all four capabilities.  Under ADR 0168 the
--     recovery path is `app.recover_orphan_person_to_org_impl` — platform_admin only,
--     asserted in `398` — and NOT, as this header used to say, any org admin who holds
--     the person's uuid.
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
-- § 7 — AUDIT-ROW ATTRIBUTION, WHICH IS A READ-AUTHORITY QUESTION
-- ============================================================================
-- All six kernels resolve ONE organisation for ONE purpose: `audit_write(
-- p_organization => v_org)`.  That is not attribution housekeeping.
-- `audit_log_select` carries
--   ((commission_id IS NULL) AND app.is_org_admin_of(organization_id))
-- and all six write `p_commission => null`, so `v_org` decides WHO MAY READ THE
-- AUDIT ROW.  `app.person_audit_organization(actor, user)` is that resolution, and
-- § 7 measures its properties: soundness (§ 7.1), the tie-break (§ 7.4) and the
-- fail-closed NULL (§ 7.5).
--
-- ⛔ THE TWO MOVEMENT CELLS ARE DELETED WITH THE COLUMN.  Old § 7.2 asserted that
--    where the located organisation and the column COINCIDE the attribution is
--    byte-identical, and old § 7.3 enumerated the thirteen cells where readership
--    moved OFF the column.  Both are `is distinct from sn.home_organization_id` —
--    unstatable once there is no column and no snapshot.  § 7.1 keeps the property
--    that actually protects the trail: for EVERY authorized cell the attributed
--    organisation is one the target's affiliations locate AND one the actor
--    administers, so the acting admin can always read the row they caused.
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
select plan(32);

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
-- ⭐ THE SEED SNAPSHOT IS TAKEN BEFORE THE FIXTURES EXIST, so § 8's claims are about
--    the SEED population and cannot be diluted by this file's seventeen targets and
--    three constructed callers.  (It used to hold `home_organization_id` as well;
--    that column is gone, and with it old § 8.2, but the isolation still matters —
--    § 8.3's floor over the seed would otherwise be satisfiable by the fixtures.)
-- ---------------------------------------------------------------------------
create temp table x_seed as
  select p.id as person_id from public.profiles p;

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
-- Fixture principals.  `handle_new_user` mints each profile from `auth.users`.
-- ⛔ THE `home_organization_id = ORG A` WRITE OVER ALL SEVENTEEN TARGETS IS GONE
--   WITH THE COLUMN, and nothing replaces it: it existed ONLY to give the deleted
--   `old_v` side a uniform baseline, and no surviving cell needs a target to be
--   "associated with an organisation" by any means other than the
--   `organization_affiliations` rows built below.  ⚠ `full_name` and `is_active`
--   were set by the SAME statements and are KEPT — the kernels in § 10 write to a
--   named person and § 0.4's actor-active gate is a real precondition.
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
   set full_name = 'AE24c target ' || (select label from x_targets t where t.target = profiles.id),
       is_active = true
 where id in (select target from x_targets);

update public.profiles
   set full_name = 'AE24c constructed caller',
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
-- ⛔ `x_snapshot` — the RLS-free snapshot of `profiles.home_organization_id` — IS
--   DELETED WITH THE COLUMN.  Its four consumers (the `old_v` matrix expression,
--   old § 0.1, old § 7.2 and old § 7.3) are deleted too.
--
-- THE CAPABILITY LOGIC, REPRODUCED AND PARAMETERISED ON THE ORGANISATION LIST.
-- Everything from the actor-active check down is a faithful copy of the shipped
-- body at head 20261003005600; § 9.1 is the control that proves it faithful, and
-- what it buys is a DECOMPOSITION: the shipped predicate is "resolve organisations"
-- ∘ "this logic", and § 9.1 pins the second half so § 6's counterfactual can vary
-- the first half alone.
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

  -- THE ONLY PARAMETERISED STEP.  The shipped body resolves this list itself, from
  -- `app.person_authority_orgs(p_user)`; here it arrives as an argument, which is
  -- the whole point of the reproduction.  An empty list denies, as the shipped body
  -- does — a person no organisation locates is administrable by nobody.
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
  new_v bool, ctl_v bool, alt_v bool
);

insert into x_matrix
select cl.label, tg.label, cp.cap,
       app.can_administer_person_for(cp.cap, tg.target, cl.caller),
       -- the FAITHFULNESS control (§ 9.1): the reproduction fed the SHIPPED
       -- organisation list must equal the shipped function on every cell.
       pg_temp.can_admin_with_orgs(
         cp.cap, tg.target, cl.caller,
         array(select organization_id from app.person_authority_orgs(tg.target))),
       -- the § 6 counterfactual.
       pg_temp.can_admin_with_orgs(
         cp.cap, tg.target, cl.caller, pg_temp.orgs_bounded(tg.target, cp.cap))
  from x_callers cl
  join x_targets tg on (tg.pop = 'Q' or cl.label in ('CA','CB','CC','HA1','CS'))
  join x_caps cp on true;

-- Measured masks, in capability order, for comparison with the expectation table.
create temp table x_measured as
  select caller_label, target_label,
         string_agg(case when new_v then 'T' else 'F' end, '' order by c.ord) as new_mask
    from x_matrix m join x_caps c on c.cap = m.cap
   group by caller_label, target_label;

-- ---------------------------------------------------------------------------
-- THE EXPECTATION TABLE — hand-written from the design, BEFORE the first run.
-- Masks are (fields, credentials, cpf_change, lifecycle).
-- ⛔ The `old_mask` column is deleted with the column it described.  Every mask
--   below is a claim about the SHIPPED predicate and nothing else.
-- ---------------------------------------------------------------------------
create temp table x_expect (caller_label text, target_label text, new_mask text);
insert into x_expect values
  -- CA — org_admin A.  Admits exactly where the target's affiliations still locate A.
  ('CA','P1','TTTT'), ('CA','P2','TTTT'), ('CA','P3','FFFF'),
  ('CA','P4','FFFF'), ('CA','P5','TTTT'), ('CA','P6','TTTT'),
  ('CA','P7','TTTT'), ('CA','P8','FFFF'), ('CA','P9','FFFF'),
  ('CA','P10','FFFF'),
  ('CA','Q1','TTTT'), ('CA','Q2','FFFF'), ('CA','Q3','FFFF'),
  ('CA','Q4','FFFF'), ('CA','Q5','TTTT'), ('CA','Q6','TTTT'),
  ('CA','Q7','FFFF'),
  -- CB — org_admin B.  The org arm is footprint-blind, so its cells are TTTT or FFFF.
  ('CB','P1','FFFF'), ('CB','P2','FFFF'), ('CB','P3','FFFF'),
  ('CB','P4','TTTT'), ('CB','P5','TTTT'), ('CB','P6','FFFF'),
  ('CB','P7','TTTT'), ('CB','P8','TTTT'), ('CB','P9','FFFF'),
  ('CB','P10','FFFF'),
  ('CB','Q1','FFFF'), ('CB','Q2','TTTT'), ('CB','Q3','TTTT'),
  ('CB','Q4','TTTT'), ('CB','Q5','FFFF'), ('CB','Q6','TTTT'),
  ('CB','Q7','TTTT'),
  -- CC — the cross-org actor.  Only P10 resolves to org C.
  ('CC','P1','FFFF'), ('CC','P2','FFFF'), ('CC','P3','FFFF'),
  ('CC','P4','FFFF'), ('CC','P5','FFFF'), ('CC','P6','FFFF'),
  ('CC','P7','FFFF'), ('CC','P8','FFFF'), ('CC','P9','FFFF'),
  ('CC','P10','TTTT'),
  ('CC','Q1','FFFF'), ('CC','Q2','FFFF'), ('CC','Q3','FFFF'),
  ('CC','Q4','FFFF'), ('CC','Q5','FFFF'), ('CC','Q6','FFFF'),
  ('CC','Q7','FFFF'),
  -- HA1 — hospital_admin of HCA only.  On population P the footprint is EMPTY, so
  -- the empty-footprint deny answers every cell.
  ('HA1','P1','FFFF'), ('HA1','P2','FFFF'), ('HA1','P3','FFFF'),
  ('HA1','P4','FFFF'), ('HA1','P5','FFFF'), ('HA1','P6','FFFF'),
  ('HA1','P7','FFFF'), ('HA1','P8','FFFF'), ('HA1','P9','FFFF'),
  ('HA1','P10','FFFF'),
  ('HA1','Q1','TTFF'), ('HA1','Q2','FFFF'), ('HA1','Q3','FFFF'),
  ('HA1','Q4','FFFF'), ('HA1','Q5','TTFF'), ('HA1','Q6','TTFF'),
  ('HA1','Q7','FFFF'),
  -- HAD — hospital_admin of HCA AND HSA, so SUBSET can succeed for it.
  ('HAD','Q1','TTTT'), ('HAD','Q2','FFFF'), ('HAD','Q3','FFFF'),
  ('HAD','Q4','FFFF'), ('HAD','Q5','TTTT'), ('HAD','Q6','TTFF'),
  ('HAD','Q7','FFFF'),
  -- HB1 — CONSTRUCTED hospital_admin of HCB.  Q3/Q6 are the INTERSECTION/SUBSET
  -- split; Q7's single-hospital footprint is the control where the two coincide.
  ('HB1','Q1','FFFF'), ('HB1','Q2','FFFF'), ('HB1','Q3','TTFF'),
  ('HB1','Q4','FFFF'), ('HB1','Q5','FFFF'), ('HB1','Q6','TTFF'),
  ('HB1','Q7','TTTT'),
  -- CS — staff.  The pure negative, everywhere.
  ('CS','P1','FFFF'), ('CS','P2','FFFF'), ('CS','P3','FFFF'),
  ('CS','P4','FFFF'), ('CS','P5','FFFF'), ('CS','P6','FFFF'),
  ('CS','P7','FFFF'), ('CS','P8','FFFF'), ('CS','P9','FFFF'),
  ('CS','P10','FFFF'),
  ('CS','Q1','FFFF'), ('CS','Q2','FFFF'), ('CS','Q3','FFFF'),
  ('CS','Q4','FFFF'), ('CS','Q5','FFFF'), ('CS','Q6','FFFF'),
  ('CS','Q7','FFFF');

-- ---------------------------------------------------------------------------
-- ⛔ `x_declared_widening` AND `x_declared_narrowing` ARE DELETED WITH THE COLUMN,
--   together with the four cells that consumed them (old § 4.1 / § 4.2 / § 5.1 /
--   § 5.2) and the movement floor (old § 4.3).  Every row in both lists was a
--   statement of the form "this cell moves when the ORGANISATION LIST stops coming
--   from `home_organization_id`"; with no column there is no movement to declare.
--   ⚠ They are NOT re-pointed at the counterfactual or at 392's read-side matrix.
--   A hand list re-aimed at a new baseline keeps its old label and its old reasons
--   while measuring something else, which is the shape that reads as coverage.
--   The classes they enumerated survive as expectation rows above and in § 3.3.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- § 0 — PRECONDITIONS.  Each one licenses a later claim; none is decorative.
-- ===========================================================================
-- ⛔ § 0.1 — "all seventeen targets are anchored to org A by the column" — is
--   deleted with the column.  It licensed the deleted `old_v` baseline and licensed
--   nothing else; § 0.6 is the precondition the surviving cells actually rest on,
--   and it measures the located organisations the shipped predicate consumes.

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
  '§ 0.7 the seed snapshot was taken BEFORE the fixtures existed and contains NONE '
  'of this file''s targets, so § 8''s floor over the seed population cannot be '
  'satisfied by the fixtures this file builds');

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

-- ⛔ § 1.2 (the capability predicate no longer names the column) and § 1.3 (nor do
--   the six kernels) are deleted: their subject is scoped to two named function
--   families, and the inverted § 1.5 below covers the SAME claim over the whole
--   catalog with no name list to fall out of.  Keeping both would leave the narrower
--   pair reading as coverage of a domain the wider one already contains.

select is(
  (select p.prosecdef::text || '|' || p.provolatile::text || '|'
          || array_to_string(coalesce(p.proconfig, '{}'), ',') || '|'
          || array_to_string(coalesce(p.proacl, '{}'), ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'person_audit_organization'),
  'true|s|search_path=app, public, pg_catalog|postgres=X/postgres',
  '§ 1.4 person_audit_organization is DEFINER, STABLE, pinned and postgres-only — '
  'it decides audit-row readership, so it is not client-reachable');

-- ---------------------------------------------------------------------------
-- ⭐⭐ § 1.5 IS INVERTED, NOT DELETED — AND ITS DOMAIN IS FIXED IN THE SAME EDIT.
--   It used to assert "exactly TWO functions still name the column"
--   (`public.guard_profile_privileged_columns`, `public.handle_new_user`) over
--   `nspname in ('app','public')`.  After the drop that expected set is EMPTY, so
--   the cell had to be inverted or deleted.
--   ⛔ INVERTING IT WITH THE OLD DOMAIN WOULD HAVE BEEN A FALSE ALL-CLEAR.  A THIRD
--   body named the column and was never in the domain: `test_helpers.bootstrap`, in
--   NEITHER schema.  It is the function `00_setup.sql` runs before EVERY suite in
--   this tree, so an inverted cell scoped to app+public would have gone green while
--   the one body whose failure aborts the entire pgTAP estate still named a column
--   that no longer exists.  The domain is therefore the WHOLE CATALOG.
--   ⭐ THE ZERO IS ANCHORED BY A DEFINITE FACT IN THE SAME STRING: `(none)` alone is
--   an empty aggregate, and an empty aggregate is satisfied by a broken probe as
--   readily as by a clean estate.  `column_present=false` is measured from
--   `pg_attribute` by the same cell, so the pair says "the column is gone AND
--   nothing still names it" rather than "my query found nothing".
-- ---------------------------------------------------------------------------
select is(
  (select 'column_present=' ||
          (exists (select 1 from pg_attribute a
                    where a.attrelid = 'public.profiles'::regclass
                      and a.attname = 'home_organization_id'
                      and not a.attisdropped))::text
          || '|' ||
          coalesce((select string_agg(n.nspname || '.' || p.proname, ' ' order by n.nspname, p.proname)
                      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'home_organization_id'),
                   '(none)')),
  'column_present=false|(none)',
  '§ 1.5 ⭐⭐ THE COLUMN IS GONE AND NO FUNCTION BODY ANYWHERE STILL NAMES IT — over '
  'the WHOLE catalog, not `app` + `public`, because the third body that named it '
  '(`test_helpers.bootstrap`) was in neither schema and would have kept an inverted '
  'app/public cell green while breaking every suite in the tree. Comment-stripped, '
  'because a comment mentioning the dropped column is not a read. ⚠ An ENUMERATION, '
  'not a count: a surviving body reds BY NAME');

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
    where t.pop = 'P' and m.new_mask is distinct from e.new_mask),
  0,
  '§ 2.1 all 200 org-tier cells (50 caller×target pairs × 4 capabilities) match the '
  'expectation table written before the run');

select ok(
  (select bool_and(new_mask in ('TTTT','FFFF'))
     from x_measured m join x_targets t on t.label = m.target_label where t.pop = 'P'),
  '§ 2.2 ⭐ THE CAPABILITY AXIS IS INERT ON THE ORG TIER — MEASURED, NOT ASSUMED. '
  'Every P cell agrees across all four capabilities, because the org arm returns '
  'before the dispatch and the footprint is empty. This is why a "capability '
  'differential" built on 392''s population alone would be four identical copies of '
  'a read-side result, and it is why population Q had to be constructed');

-- ⛔ § 2.3 — "the org-tier MOVEMENT reproduces AE2.3a's read-side matrix exactly,
--   the same five widenings and five narrowings" — is deleted with the column. Both
--   matrices were movements OFF `home_organization_id`; there is no second movement
--   left for this one to agree with, and re-pointing it at anything else would be a
--   different claim wearing the cross-check's label.

-- ===========================================================================
-- § 3 — THE HOSPITAL-TIER / CAPABILITY DIFFERENTIAL (population Q).
-- ===========================================================================
select is(
  (select count(*)::int from x_measured m join x_expect e using (caller_label, target_label)
     join x_targets t on t.label = m.target_label
    where t.pop = 'Q' and m.new_mask is distinct from e.new_mask),
  0,
  '§ 3.1 all 196 hospital-tier cells match the expectation table');

select ok(
  (select count(*) from x_measured m join x_targets t on t.label = m.target_label
    where t.pop = 'Q' and m.new_mask not in ('TTTT','FFFF')) >= 3,
  '§ 3.2 THE FLOOR THAT STOPS § 3.1 BEING VACUOUS ON THE CAPABILITY AXIS: at least '
  'three Q cells disagree ACROSS CAPABILITIES. Without this, § 3.1 could pass over a '
  'matrix where the axis is as inert as it is on P, and § 3.3''s split would be the '
  'only evidence that the INTERSECTION/SUBSET branch is reached at all');

select is(
  (select string_agg(m.cap || '=' || m.new_v::text, ' ' order by c.ord)
     from x_matrix m join x_caps c on c.cap = m.cap
    where m.caller_label = 'HB1' and m.target_label = 'Q3'),
  'fields=true credentials=true cpf_change=false lifecycle=false',
  '§ 3.3 ⭐⭐ THE KEYSTONE CELL. A hospital_admin of ONE hospital in the newly '
  'located organisation gains `fields` and `credentials` (INTERSECTION) over a '
  'two-hospital footprint and is still refused `cpf_change` and `lifecycle` '
  '(SUBSET). ⛔ No seeded persona can construct this cell — org B carries no '
  'hospital_admin, which is why HB1 is CONSTRUCTED — so ADR 0133 Amdt 1 r1''s split '
  'is asserted HERE or nowhere');

-- ---------------------------------------------------------------------------
-- ⛔ § 3.4 WAS SPLIT (QA finding M10).  It asserted `count = 0` over
-- Q4 × {HA1, HAD, HB1} × 4 capabilities and rested that zero on the claim
-- "the empty footprint refuses all four capabilities".  Measured against the
-- shipped body (`…005700:230-232`), 8 of those 12 cells return false at
-- `cardinality(v_administered) = 0` — HA1 and HAD administer hospitals in org A
-- and Q4 locates to org B (§ 0.6 pins that) — i.e. they never reach the footprint
-- rule at all.  ⭐ The aggregate hid the difference: 4 cells measured the claimed
-- mechanism and 8 corroborated it by arithmetic.  Split, HB1 carries the claim and
-- the A-tier cells become a separately-labelled control that says why they are zero.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from x_matrix
    where target_label = 'Q4' and caller_label = 'HB1'
      and new_v),
  0,
  '§ 3.4 ADR 0163 BOUND 4, MEASURED WHERE IT BINDS: HB1 administers a hospital in '
  'Q4''s retaining organisation, so the LOCATOR admits and the ORGANISATION scope '
  'admits — and all four capabilities are still refused, by the EMPTY-FOOTPRINT '
  'rule and nothing else. This is the only caller of the three for which that '
  'sentence is what the cell measures');

select is(
  (select count(*)::int from x_matrix
    where target_label = 'Q4' and caller_label in ('HA1','HAD')
      and new_v),
  0,
  '§ 3.4b CONTROL — DENIED EARLIER, FOR A DIFFERENT REASON. HA1 and HAD administer '
  'hospitals in org A while Q4 locates to org B, so the shipped body returns false '
  'at `cardinality(v_administered) = 0`, BEFORE the footprint rule is consulted. '
  '⚠ Kept, and labelled, rather than deleted: these cells are real coverage of the '
  'organisation scope — they were only wrong as EVIDENCE FOR BOUND 4, which is what '
  'folding them into one aggregate made them look like');

-- ===========================================================================
-- ⛔ § 4 (WIDENINGS) AND § 5 (NARROWINGS) ARE DELETED IN FULL WITH THE COLUMN.
--
--   All five cells were quantified over `new_v AND NOT old_v` or `old_v AND NOT
--   new_v`, and old § 4.3 pinned the exact movement counts (48 / 44). None of it is
--   statable once there is no `old_v`.
--
--   ⚠ WHAT IS GENUINELY LOST, STATED RATHER THAN GLOSSED: the ADR 0154 / PA-F13
--   discipline — "every widening is pre-declared or it is a red" — was an assertion
--   ABOUT THIS MIGRATION, and it has now served its purpose; the migration it gated
--   is the one being completed. What replaces it for the shipped predicate's ongoing
--   behaviour is the expectation table (§ 2.1 / § 3.1), which pins EVERY cell rather
--   than only the moving ones, and whose non-vacuity floor is § 3.2. A pinned matrix
--   is the stronger instrument for a predicate that is no longer moving; it was the
--   weaker one while it was.
-- ===========================================================================

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

-- ⛔ § 6.3 — the DIRECTION split of § 6.2's sixteen cells ("12 new narrowings, 4
--   cancelled widenings") — is deleted: both halves were partitioned by `old_v`, and
--   "cancels an already-declared widening" refers to a hand list that no longer
--   exists. § 6.2's magnitude and § 6.4's polarity survive, and between them they
--   still say what the counterfactual would do and which reading shipped.

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

-- ⛔ § 7.2 (attribution byte-identical to the column where the two coincide) and
--   § 7.3 (the thirteen cells where audit-row readership moved OFF the column) are
--   deleted: both are `is distinct from sn.home_organization_id`, and both the
--   column and its snapshot are gone. ⚠ Their subject was the MOVE; § 7.1 above
--   carries the property that outlives it — the attributed organisation is always
--   one the target's affiliations locate AND one the actor administers — and it
--   quantifies over every authorized cell rather than over thirteen named ones.

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
-- § 8 — THE SEED POPULATION.
-- ===========================================================================
select ok((select count(*) from x_seed) >= 30,
  '§ 8.1 the seed snapshot is floored at 30 persons rather than pinned to an exact '
  'count, because catalog-driven seed counts drift and a pinned one reds for the '
  'wrong reason');

-- ⛔ § 8.2 — "ZERO MOVEMENT across the entire seed roster" — is deleted with the
--   column. It was the cell that explained why every OTHER seeded suite was blind to
--   this change: home org and located org coincided for every seeded person, so the
--   two predicates agreed everywhere the seed could reach. That sentence is now
--   history, not a measurement: there is one predicate. § 8.3 survives as the floor
--   that keeps the seed population a live subject rather than a silent zero.

select ok(
  (select count(*)
     from x_seed s
     cross join x_caps cp
    where app.can_administer_person_for(cp.cap, s.person_id, (select ca from pg_temp.k()))) >= 25,
  '§ 8.3 THE SEED FLOOR: org_admin A holds at least 25 (person, capability) cells '
  'over the seed roster. ⚠ It used to be the floor under old § 8.2''s zero-movement '
  'claim; with that cell gone it stands alone as the assertion that the shipped '
  'predicate ADMITS over real seeded people — every other cell in this file is '
  'measured over CONSTRUCTED fixtures, so without it a predicate that only ever '
  'admitted inside this transaction would go unnoticed');

-- ===========================================================================
-- § 9 — THE FAITHFULNESS CONTROL, AND ARCHITECTURE RULE 13.
-- ===========================================================================
select is(
  (select count(*)::int from x_matrix where ctl_v is distinct from new_v),
  0,
  '§ 9.1 ⭐ THE DECOMPOSITION CONTROL. The hand reproduction, fed '
  'app.person_authority_orgs(target), equals the SHIPPED predicate on all 396 cells '
  '— so the shipped function factorises into "resolve the organisations" ∘ "this '
  'capability logic", and this cell pins the SECOND half. ⚠ It used to be the cell '
  'that made the deleted `old_v` side trustworthy; it is load-bearing for a '
  'different reason now, and a bigger one: § 6 varies the FIRST half alone to measure '
  'the counterfactual ruling, which is only a statement about the organisation list '
  'because the logic beside it is pinned here');

-- ---------------------------------------------------------------------------
-- ⛔ § 9.2'S TWO PRECONDITIONS (QA finding B4).  Without them § 9.2 is
-- `392` § 4.3 WITH BOTH PREMISES DELETED.  The shipped predicate returns false at
-- FOUR points before any membership is consulted — `p_actor is null`,
-- `cardinality(v_orgs) = 0`, `not app.is_active(p_actor)`,
-- `cardinality(v_administered) = 0` — so a `0` from § 9.2 is equally consistent
-- with "sharing an affiliation grants nothing" (the rule) and with "there was
-- nothing to share" (a broken fixture).  ⚠ CSH is deliberately EXCLUDED from
-- `x_callers`, so § 0.3 and § 0.4 — the two guards written for exactly this — do
-- NOT cover it.  A seed change, or drift in CSH's construction, would make the one
-- shape Rule 13 exists to forbid UNDETECTABLE while the assertion stayed green.
-- ⚠ `reset role` first — `app.person_authority_orgs` is `postgres`-only EXECUTE.
-- ---------------------------------------------------------------------------
reset role;

select is(
  (select (count(*) filter (where tg.label = 'Q3'))::text || '|' ||
          (count(*) filter (where tg.label = 'Q7'))::text || '|' ||
          bool_and(app.is_active((select csh from pg_temp.k())))::text
     from (values ('Q3'), ('Q7')) as v(label)
     join x_targets tg on tg.label = v.label
    where exists (
      select 1
        from app.person_authority_orgs(tg.target) t
        join app.person_authority_orgs((select csh from pg_temp.k())) c
          on c.organization_id = t.organization_id)),
  '1|1|true',
  '§ 9.1a PRECONDITION — CSH and BOTH targets share an active organization '
  'affiliation, and CSH is `app.is_active`. So § 9.2''s denial is "sharing an '
  'affiliation grants nothing", not "there was nothing to share" and not "the '
  'caller was inactive". ⭐ Derived through `app.person_authority_orgs` — the '
  'LOCATE half itself — so it measures the same fact the predicate under test '
  'consumes, rather than a fixture row that merely looks like it');

select is(
  (select count(*)::text from public.memberships m
    where m.principal_id = (select csh from pg_temp.k())),
  '0',
  '§ 9.1b PRECONDITION — CSH holds NO membership at ANY scope: organisation, '
  'hospital or commission. The GRANT half is genuinely absent, which is what makes '
  '§ 9.2 a statement about the LOCATE/GRANT split rather than about a caller who '
  'happened to be denied for some other reason');

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
  'rather than reviewed for. ⚠ Load-bearing only because § 9.1a/§ 9.1b hold — read '
  'this cell WITHOUT them and it is a zero of unknown cause');

-- ===========================================================================
-- § 10 — THE SIX KERNELS, END TO END.
--
-- ⛔ THIS SECTION EXISTS BECAUSE OF A MEASURED GAP, NOT FOR COMPLETENESS. `385` and `386`
--    are the person-door suites and they assert the audit row's `action`, `actor_id` and
--    `metadata` — and NEVER its `organization_id` (grep-measured over both files before
--    this section was written). That value is a READ-AUTHORITY value: `audit_log_select`
--    admits a commission-less row to `app.is_org_admin_of(organization_id)`. Without § 10
--    the six kernels' attribution is asserted NOWHERE IN THE TREE — and after this
--    re-cut § 10.1 is, with § 7.1, the only place `person_audit_organization`'s output is
--    checked against anything at all.
--
-- The actor is `orgadmin.b` over Q7 — a person ACTIVELY affiliated to org B and to no
-- other organisation, administered by B's org_admin and by nobody in org A. § 10.3 is
-- the deny half on the same six doors with `orgadmin.a` as the actor, so the six rows
-- § 10.1 counts are attributed by an authority that is measured in both polarities.
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
  '§ 10.2 THE FLOOR UNDER § 10.1, plus the negative half: exactly SIX rows were written '
  '(so § 10.1 is not true of an empty set) and ZERO are attributed to org A — the '
  'organisation that locates NOTHING about Q7 and whose admins § 10.3 shows refused. An '
  'audit row attributed to org A would be readable by admins with no authority over this '
  'person and unreadable by the admin who acted, which is the failure `audit_log_select`''s '
  'commission_id-IS-NULL arm makes possible');

select is(
  pg_temp.kernel_sqlstates(
    (select ca from pg_temp.k()),
    (select target from x_targets where label = 'Q7'),
    (select id from x_kernel_cred)),
  'finalize=42501 fields=42501 upsert=42501 delete=42501 suspend=42501 active=42501',
  '§ 10.3 THE DENY POLARITY, on the same six doors: `orgadmin.a` — whom Q7''s affiliations '
  'locate nothing for, and whom § 3.1 records as holding FFFF on the CA×Q7 row — is '
  'refused by every one of them, with the SAME 42501. ⭐ Its positive control is § 10.1 '
  'itself: the identical six calls SUCCEEDED for `orgadmin.b`, so this is not six doors '
  'that refuse everybody');

select * from finish();
rollback;

-- 425 — AE5 increment 1, T12: the re-key differential for `staff`'s 20 armInterface rows.
--
-- Subject: `docs/backend-state/...` manifest `supabase/tests/vectors/authz-enforcement-manifest.json`
-- declares, for 20 of `staff`'s permission codes, an `armInterface` array naming EVERY site that
-- currently enforces that code's underlying authority (42 policy sites + 26 DEFINER-kind sites,
-- of which 2 collapse to ONE shared function `app._audit_access_authorized`, giving 25 DISTINCT
-- DEFINER functions + 1 non-DB `ts` site — 69 sites total, reconciled against `docs/progress/
-- ae5-staff.md`'s own 42/25/1 table this round).
--
-- ⛔⛔ THE FIRST-CLASS WITNESS THIS FILE EXISTS TO PRODUCE IS RED, NOT GREEN. Pre-T7 (the re-key
-- migration that has not landed yet), every one of these 69 sites is enforced by the OLD
-- role-keyed predicate (`app.is_member_of(_for)` -> `app.has_role_any`), which asks "does this
-- caller hold ANY grant-bearing role on this scope" and never consults `authz.role_permissions`'s
-- CODE column at all (`callGraphBoundary.reason`, repeated verbatim on all 20 manifest rows).
-- So deleting a `staff -> <code>` grant row today must move NOTHING at that code's declared
-- sites — the sites are watching a role, not a permission. A suite that already discriminates
-- (denies once the code-grant is gone) on TODAY's catalog would be measuring its own fixture,
-- not the authority boundary (ADR 0155 lineage; the same trap 424's header names for `staff`
-- itself). §2's "5.x DISCRIMINATES" assertion is therefore EXPECTED RED until T7 lands, and its
-- twin "5.y NO MOVEMENT" is EXPECTED GREEN — recorded together, never one without the other
-- (a green half with no red sibling proves nothing; ADR 0079 discipline).
--
-- MECHANISM, one cycle per of the 20 codes (§2): capture a SIGNATURE at every declared site under
-- `staff`'s own claims (a policy site's signature is `count(*)::text` from its table; a DEFINER
-- site's signature is its return value cast to text, or `count(*)::text` for a set-returning one)
-- BEFORE deleting `staff`'s grant row for that code, delete it (bare DML, proven landed — same
-- idiom as 424 §6 / 409 §2.7, never a SAVEPOINT, which discards assertions made after a rollback
-- to it), capture the signature again AFTER, assert equality (no movement, green) and assert
-- denial (discriminates, red-by-design), then restore the grant with a bare `insert` and PROVE
-- the restore with a third capture (idiom: 409 §2.16 / 424 §6.2).
--
-- ⛔ SCOPE CUT, NAMED RATHER THAN HIDDEN — 5 of the 25 distinct DEFINER functions are NOT called
-- live this round:
--   (a) FIVE are `provolatile = 'v'` (write / audit-logging side effects): `public.cast_case_vote`,
--       `public.create_referral_internal_note`, `public.notify_safety_event`,
--       `public.sign_meeting`, `public.get_referral_case_access_summary` (the last one reads but
--       is itself PHI-audit-logged on every call — Rule 11 — so calling it repeatedly writes rows
--       this suite has no business creating). Calling any of these blind, with no live-execution
--       spec from the manifest, risks a real mutation on the shared local stack — the exact
--       category `docs/lead-playbook.md` and this session's whole discipline treat as
--       "modify shared resources", never done without an explicit rollback-safe plan.
--   (b) ⭐⭐ CORRECTED 2026-09-15 (L34, finding F1) — the FOUR that used to be blocked by a
--       genuine FIXTURE GAP (`public.get_standard_assessment`, `public.readiness_evidence`,
--       `public.readiness_report`, `app.can_read_referral_internal_note`) are NO LONGER cut: T7's
--       seed migration `2dddd278` added the fixture rows this file was missing —
--       `public.accreditation_standards` now carries TWO rows (`a5f50000-…-b1` "CCIH-1", owned by
--       CCIH's own framework `a5f50000-…-a2`; `a5f50000-…-b2` "FARMA-1", a sibling-scope row on
--       Farmácia's framework, unused here) and `public.referral_internal_notes` carries ONE
--       (`a5fb0000-…-d1`, on the SAME referral `f425r.referral_id` already resolves to). All four
--       are now live-probed below (`f425r`'s `accreditation_standard_id` / `accreditation_
--       framework_id` / `referral_internal_note_id` columns), replacing the null they used to
--       return. ⚠ `public.get_standard_assessment` and `public.readiness_evidence` still cannot
--       DISCRIMINATE under this file's mutation, for a reason that is not a suite defect: they
--       read FROM `public.standard_assessments` / `public.evidence_links` respectively, and BOTH
--       of those tables remain genuinely EMPTY (live-measured 2026-09-15, as `postgres`:
--       `select count(*) from public.standard_assessments` = 0, `select count(*) from
--       public.evidence_links` = 0) — the exact "Ten of 59" class already excluded below via
--       those tables' own POLICY siblings (`standard_assessments_select`, `evidence_links_select`).
--       `public.readiness_report` (reads FROM `accreditation_standards`, now non-empty) and
--       `app.can_read_referral_internal_note` (reads the one seeded note) DO discriminate —
--       live-measured this round, rolled back: `1`→`0` and `true`→`false`.
--       `docs/testing/ae5-staff-fixture-gaps.md`'s row for this gap is stale and owed a closing
--       entry (not this file's to edit — `supabase/tests/425_*` only).
--   (c) ⭐⭐⭐ CORRECTED FURTHER, 2026-09-15 (L36, backend's fixture) — (b)'s "still cannot
--       DISCRIMINATE" is now ALSO closed: backend seeded ONE `standard_assessments` row
--       (`a5f50000-…-c1`, `status='parcial'`) and ONE `evidence_links` row (`a5f50000-…-d1`,
--       `artifact_kind='action_item'`), both on CCIH-1 (`a5f50000-…-b1`). `get_standard_assessment`,
--       `readiness_evidence`, AND their two POLICY siblings (`standard_assessments_select`,
--       `evidence_links_select`) all now read a genuine `1`→`0` under the mutation (live-measured,
--       rolled back) — ALL FOUR removed from §2.0/§3.1's exclusion lists below; nothing in the
--       original "Ten of 59" class remains fixture-empty on the accreditation surface.
--       `docs/testing/ae5-staff-fixture-gaps.md`'s row is closed by this same pass (dated note in
--       that file, per its own ownership — `supabase/tests/425_*` predicates only, here).
-- The FIVE volatile writers are still covered by the STATIC half (§3): a `prosrc` literal-string
-- search for the code, the same technique 409 §1.1/§1.3 uses for its own attribution table — it
-- needs no fixture and cannot mutate anything, so it stands in for the live pair without
-- weakening the "is the code consulted anywhere" question the whole file exists to answer. The
-- four re-pointed reads keep their STATIC §5.1 coverage too (redundant now, harmless — a second,
-- independent proof the code isn't a literal in THEIR OWN body, distinct from the helper they call).
-- ⛔ TWO of the 42 POLICY sites are also named-skipped (`public.responses.responses_insert_own`,
-- `public.meeting_signatures.meeting_signatures_insert`): both are INSERT/WITH-CHECK policies,
-- and this file's generic policy probe is a `count(*)` SELECT — it would silently exercise
-- whichever SELECT policy the table happens to carry, never the declared INSERT site. A
-- savepoint-guarded live INSERT attempt was considered and deferred (its own hazard on the
-- shared stack) rather than shipped half-verified.
--
-- Fixtures: EVERY id below is drawn from the LIVE local stack under `chefe.ccih@test.local`'s own
-- CCIH commission (Rede A) — the SAME commission 424's `subject_holder` fixtures already anchor
-- to — never a new seed row, never `seed.sql`. `staff4.ccih` (424's `subject_holder`,
-- `00000000-0000-0000-0000-00000000000a`) is the caller throughout; this file asks ONE question
-- per site ("does a `staff` holder's own read move when the grant does"), not the fuller
-- self/third-party/scope sweep 424 already owns for the 11 arm-3 classes.
--
-- ⭐⭐ NAMED EXPECTATIONS FOR STEP 4 (post-T7 re-run) — recorded here, NOT YET ASSERTED: T7's seed
-- work (`docs/testing/ae5-staff-fixture-gaps.md` § 9) has not landed on this stack, so none of the
-- three fixtures these expectations need exist yet. Naming them now, ahead of the fixtures, so
-- step 4's re-run has a written target rather than a post-hoc rationalization of whatever comes
-- back:
--   (1) ROW 9's RESIDUAL ARM — ⚠ REVISED under ruling L24 (the member-surface door now composes
--       `has_case_capability` ALONE: the permission is enforced INSIDE `_case_caps` via a
--       commission-keyed SIBLING door, not beside it) — THREE sub-cases, not two, expected to
--       diverge from each other post-T7:
--       (a) a principal who ALSO holds a `case_access_grants` row (`read_case_deliberation`) on
--           the case, independent of commission membership — deleting `staff`'s
--           `commission.cases.deliberation.read` grant is expected to STAY GRANTED both before AND
--           after (`t`/`t`): `residualLegacyAuthority` (kept under L17) is a SEPARATE, un-re-keyed
--           authority, so this coordinate is "no movement" even after T7 and must NOT be folded
--           into §3.2's blanket "everything denies post-T7" expectation.
--       (b) via `app._case_caps`'s S5 arm, a plain commission MEMBER who holds NO case grant —
--           deleting the SAME row 9 permission is expected to go `t` → `f` under the deletion
--           (backend's ruling L20): the membership-path arm IS re-keyed, so (a) and (b) are two
--           DIFFERENT principals at the SAME site expected to move in OPPOSITE directions after
--           the SAME deletion — a single aggregate "did row 9 move" check would average them into
--           nothing; step 4 must keep them as separate probes.
--       (c) an EXCLUDED RESPONDENT (a principal the commission-keyed sibling door itself denies,
--           independent of the row 9 permission) — expected `f`/`f`: denied both before and after,
--           since the sibling door's own exclusion is what is being read, not the permission grant
--           this file mutates. A third "no movement" reading, but for a DIFFERENT reason than (a)'s
--           — (a) is "granted regardless" via residual authority, (c) is "denied regardless" via a
--           door conjunct this file never touches; step 4 must not conflate the two as one "no
--           movement" bucket, or a denied-respondent site would silently stand in for the
--           residual-grant witness it is not.
--   (2) `public.meeting_cases.meeting_cases_select` (the `commission.meetings.cases.shell.read`
--       site) gains an ADDED CONJUNCT under T7: deleting THIS code's `staff` grant is expected to
--       DENY the shell read, while `app.can_reach_meeting` (a DIFFERENT code,
--       `commission.meetings.read`) on the SAME underlying meeting stays GRANTED — the two codes'
--       signatures are expected to diverge at a shared resource, which is a feature of the re-key
--       (each site consults only its OWN code), not a contradiction to reconcile.
-- ⛔ Do not implement (1)/(2) as assertions before the fixtures exist (T7's own seed work, § 9) —
-- this block is a target for step 4's author to check against, never a claim about today's stack.

begin;
-- 34 = the original 21 + 0.2b (F3 pin control, this round) + 12 in §6 (F2 behavioural
-- grant-deletion probes + their discrimination half, this round).
select plan(34);

-- ============================================================================
-- §0 — FIXTURES + PRECONDITIONS
-- ============================================================================

create temp table f425 on commit drop as
select
  '00000000-0000-0000-0000-00000000000a'::uuid as staff_uid,   -- staff4.ccih (424's subject_holder)
  (select m.commission_id from public.memberships m
     where m.principal_id = (select p.id from public.profiles p where p.email = 'chefe.ccih@test.local')
       and m.role = 'staff_admin' limit 1)                      as ccih_cid,
  (select h.id from public.commissions c join public.hospitals h on h.id = c.hospital_id
     where c.id = (select m.commission_id from public.memberships m
                     where m.principal_id = (select p.id from public.profiles p where p.email = 'chefe.ccih@test.local')
                       and m.role = 'staff_admin' limit 1))      as ccih_hospital_id;

grant select on f425 to authenticated;

create temp table f425r on commit drop as
select
  -- ⭐⭐ F3 HYGIENE PASS (2026-09-15, this round, external QA review F3) — every selection
  -- below now carries an EXPLICIT business precondition (a predicate, an `order by` on a
  -- seeded id, or a literal pin) reviewed against the SITE that actually consumes it (its
  -- authorizer's own disjuncts), not merely "resolves to a real row". §2.0's own positive-
  -- control assertion is the existing general safety net that would catch a wrong pick (it
  -- DID, for `attendee_id`, before this fix: `not ok 11 — have 53, want 54` / `not ok 13`) —
  -- this pass makes each reason explicit rather than relying on 2.0 to catch a regression
  -- after the fact.
  (select id from public.meetings where commission_id = (select ccih_cid from f425)
     and visibility_policy = 'commission_default' order by id limit 1)                                    as meeting_id,
  -- `visibility_policy='commission_default'` PINNED: `app.can_reach_meeting`'s own body is
  -- `can_meetings_read(...) AND (visibility_policy='commission_default' OR is_attendee)` — an
  -- AND, not a disjunct that bypasses the code, so ANY meeting still discriminates correctly
  -- under the code's own deletion; this predicate only protects the BEFORE baseline (§2.0)
  -- from picking CCIH's one `participants_only` meeting (of 9, live-measured this round)
  -- where staff4.ccih is not an attendee, which would read as a false "not granted" for a
  -- reason unrelated to the code.
  (select id from public.action_items where commission_id = (select ccih_cid from f425)
     and visibility_scope = 'committee' order by id limit 1)                                              as action_item_id,
  -- ⭐⭐ GENUINE LANDMINE FOUND AND FIXED THIS ROUND (same shape as F3's own attendee bug,
  -- live-measured, never present in a committed run because ties happened to break the safe
  -- way — but never asserted, so a reseed could have flipped it silently). An unordered
  -- `limit 1` over CCIH's 4 action_items could land on `a5f40000-…-a1`
  -- (`visibility_scope='assignees_only'`, `assigned_to = staff4.ccih` DIRECTLY):
  -- `app.can_read_action_item` then returns true via the ASSIGNEE disjunct
  -- (`is_staff_admin_of_for(...) OR assigned_to = p_uid OR …`), a route that never consults
  -- `commission.action_items.read` at all — the exact role-free-disjunct trap `f425w`
  -- already fixes for the POLICY sibling `action_items_select`, but THIS value feeds the
  -- DEFINER function `app.can_read_action_item`, a separate probe with no `f425w` guard of
  -- its own. Pinning `visibility_scope='committee'` forces the ONLY code-gated branch
  -- (`app.can_action_items_read(v_commission_id, p_uid)`); 2 of CCIH's 4 action_items
  -- qualify (live-measured), so `order by id limit 1` is deterministic.
  (select id from public.cases where commission_id = (select ccih_cid from f425) limit 1)                 as case_id,
  -- ⛔ REVIEWED, LEFT UNCHANGED — `app._case_caps`'s S5/residual-arm complexity is this
  -- file's own header block ("NAMED EXPECTATIONS FOR STEP 4"), which explicitly says "do not
  -- implement... before the fixtures exist"; this round adds no such fixture. §2.0's own
  -- positive control already passes for whatever case this resolves to today —
  -- re-deriving `_case_caps`'s own dedicated fixture is step 4's job, not F3's.
  (select id from public.capa_plan where hospital_id = (select ccih_hospital_id from f425)
     and source = 'indicator' order by id limit 1)                                                        as capa_id,
  -- (unchanged: the `source='indicator'` predicate is the pre-existing, already-correct fix
  -- from run-4; `order by` added only for determinism — only 1 such row exists today anyway.)
  (select cd.core_document_id from public.controlled_documents cd
     where cd.commission_id = (select ccih_cid from f425) order by cd.id limit 1)                         as document_core_id,
  -- ⛔ DELIBERATELY approver-reachable (unchanged behaviour) — this file's own comment at the
  -- `app.can_read_document` dispatch (§2) already documents that THIS id is the P1-survivor
  -- witness's resource, never the primary `commission.documents.read` probe (which uses
  -- `f425w.document_core_id_absent` instead). `order by` added only for determinism.
  (select cv.id from public.controlled_document_versions cv join public.controlled_documents d on d.id = cv.document_id
     where d.commission_id = (select ccih_cid from f425) order by cv.id limit 1)                          as document_version_id,
  -- `app.can_read_document_of_version` is a pure `can_documents_read(commission, uid)` call,
  -- NO disjunct (confirmed live via `pg_get_functiondef`) — any CCIH version discriminates
  -- correctly; `order by` added only for determinism.
  (select id from public.indicators where commission_id = (select ccih_cid from f425) order by id limit 1) as indicator_id,
  (select id from public.patient_safety_event where reporting_commission_id = (select ccih_cid from f425)
     order by id limit 1)                                                                                  as event_id,
  -- `app.can_read_event`'s other two disjuncts (`current_owner_commission_id`'s own grant, a
  -- PQS operator of the event's hospital) don't apply to staff4.ccih on this stack
  -- (live-confirmed: she holds no `nsp_coordinator`/`pqs_member` membership anywhere) —
  -- `reporting_commission_id = ccih_cid` is the only disjunct she can reach, so any
  -- CCIH-reported event discriminates correctly; `order by` added only for determinism.
  (select id from public.case_referral
     where source_commission_id = (select ccih_cid from f425) or target_commission_id = (select ccih_cid from f425)
     order by id limit 1)                                                                                  as referral_id,
  -- CCIH is SOURCE on all 3 of its seeded referrals (live-measured; never target on this
  -- stack), and neither `app.can_referrals_metadata_read` nor
  -- `can_read_referral_internal_note{,s}` carries a status-gated disjunct on the source
  -- side — any of the 3 discriminates correctly; `order by` added only for determinism.
  -- ⭐⭐ F3 — THE CONFIRMED DEFECT, FIXED: pinned to the SEEDED signing fixture
  -- (`seed.sql:3419`), never a `limit 1` again. Three attendee rows match staff4.ccih in
  -- CCIH (live-measured this round, unchanged from the review's own table): `60c5e4ef-…`
  -- (summoned/held), `9d7be371-…` (summoned/in_signature), and THIS one (present/
  -- in_signature — the ONLY one `app.can_sign_meeting` can ever grant). 0.2b below asserts
  -- its signer, commission, attendance and status BEFORE the differential runs, so a future
  -- reseed that moves this id fails as a NAMED fixture assertion, never as a silent
  -- authorization regression (the review's own F3 bound).
  'a5f30000-0000-0000-0000-0000000000a2'::uuid                                                              as attendee_id,
  -- ⭐⭐ T13/L34 addendum, 2026-09-15 — the FOUR fixture-gap DEFINER sites re-pointed (F1: 425 was
  -- returning NULL for all four; the fixtures T7 seeded in `2dddd278` closed the gap, header +
  -- "Ten of 59" note corrected above/below). Both accreditation ids are derived relationally off
  -- `ccih_cid`, never a second hardcoded literal — `accreditation_standard_id` and
  -- `accreditation_framework_id` resolve to the SAME CCIH-owned standard/framework pair
  -- (`a5f50000-…-b1` / `a5f50000-…-a2`, live-queried, not assumed) regardless of a future
  -- id change; `referral_internal_note_id` resolves off the SAME `f425r.referral_id` join
  -- condition (repeated here, not referenced — a SELECT list cannot reference a sibling alias).
  (select s.id from public.accreditation_standards s
     join public.accreditation_frameworks f on f.id = s.framework_id
     where f.owner_commission_id = (select ccih_cid from f425)
     order by s.id limit 1)                                                                                as accreditation_standard_id,
  (select s.framework_id from public.accreditation_standards s
     join public.accreditation_frameworks f on f.id = s.framework_id
     where f.owner_commission_id = (select ccih_cid from f425)
     order by s.id limit 1)                                                                                as accreditation_framework_id,
  (select n.id from public.referral_internal_notes n
     where n.referral_id in (
       select cr.id from public.case_referral cr
        where cr.source_commission_id = (select ccih_cid from f425)
           or cr.target_commission_id = (select ccih_cid from f425)
     )
     order by n.id limit 1)                                                                                as referral_internal_note_id;

grant select on f425r to authenticated;

-- ⭐⭐ THE SEVEN ROLE-FREE-DISJUNCT SITES' `disjunct_absent` RESOURCE (run-4 addendum,
-- 2026-09-14). 424's own vector (`authz_differential_cells_staff`) already binds, PER ROW, a
-- fixed-literal resource its `disjunct_absent` gate arm does not reach — keyed by
-- `probe_table`/`probe_column`, never a new id, never `seed.sql`. Live-queried this round
-- (`legacy_class` in parens) and re-verified as a genuine before/after pair (see the dated note
-- at §3.1/§3.2 below): a resource ONLY the ordinary commission grant reaches, never the disjunct
-- (public-owner / assignee / approver / self), so deleting the code SHOULD (and now does) deny it.
create temp table f425w on commit drop as
select
  'a5f50000-0000-0000-0000-0000000000a2'::uuid as framework_id_absent,       -- (rls_accreditation_frameworks_owner_null, disjunct_absent) — owner IS CCIH, not null
  'a5f40000-0000-0000-0000-0000000000c1'::uuid as action_item_id_absent,     -- (can_read_action_item, disjunct_absent) — visibility_scope='committee', NOT assigned to staff4.ccih
  'd0c00000-0000-0000-0000-0000000000d2'::uuid as controlled_document_id_absent, -- (rls_controlled_documents_approver, disjunct_absent) — staff4.ccih is NOT its approver
  -- derived, not independently fixture-bound: the ONE version under the disjunct_absent document
  -- above, and that document's OWN core `public.documents.id` — both resolved relationally from
  -- the same vector-bound id, never a second literal (plan `:1144-1147`'s "no shared id" reads as
  -- "no INDEPENDENT id" here; these two are DERIVED, not separately chosen).
  (select cv.id from public.controlled_document_versions cv
     where cv.document_id = 'd0c00000-0000-0000-0000-0000000000d2'::uuid limit 1)  as document_version_id_absent,
  (select cd.core_document_id from public.controlled_documents cd
     where cd.id = 'd0c00000-0000-0000-0000-0000000000d2'::uuid)                   as document_core_id_absent,
  'a5f00000-0000-0000-0000-0000000000f1'::uuid as comember_id_absent;        -- (rls_profiles_comember_or_self, disjunct_absent) — a CCIH co-member, not `staff4.ccih` herself

grant select on f425w to authenticated;

-- The seven (code, site) pairs the P1-survivor witness (below) runs against — driven off this
-- list rather than repeated inline in all three mutation phases, so there is exactly ONE place
-- naming "these seven", matching everywhere else that number is cited in this file.
create temp table f425_p1_sites (code text, site text) on commit drop;
insert into f425_p1_sites (code, site) values
  ('commission.accreditation.read', 'public.accreditation_frameworks.accreditation_frameworks_select'),
  ('commission.action_items.read', 'public.action_items.action_items_select'),
  ('commission.documents.read', 'app.can_read_document'),
  ('commission.documents.read', 'public.controlled_documents.controlled_documents_select'),
  ('commission.documents.read', 'public.controlled_document_versions.controlled_document_versions_select'),
  ('commission.roster.read', 'public.memberships.memberships_select'),
  ('commission.roster.read', 'public.profiles.profiles_select_self_or_admin');
grant select on f425_p1_sites to authenticated;

select is((select count(*)::int from f425 where staff_uid is not null and ccih_cid is not null and ccih_hospital_id is not null), 1,
  '0.1 FIXTURE CONTROL: the persona id and its CCIH commission/hospital all resolved. ⛔ A NULL '
  'scope denies for the wrong reason and asserts nothing (authz-handoff §7.2 case 4).');

select is((select count(*)::int from f425r where
             meeting_id is not null and action_item_id is not null and case_id is not null
             and capa_id is not null and document_core_id is not null and document_version_id is not null
             and indicator_id is not null and event_id is not null
             and referral_id is not null and attendee_id is not null
             and accreditation_standard_id is not null and accreditation_framework_id is not null
             and referral_internal_note_id is not null), 1,
  '0.2 FIXTURE CONTROL: every resource id this file probes resolved to a REAL CCIH row — none of '
  'the 69 sites'' probes runs against a fabricated uuid. ⛔ The dead `framework_id` column (never '
  'consumed by any dispatch — `accreditation_framework_id` is the one actually used, for '
  '`readiness_report`) was REMOVED this round rather than left as an unchecked, unused selection. '
  'The three L34/L36 columns (`accreditation_standard_id`, `accreditation_framework_id`, '
  '`referral_internal_note_id`) are folded into this control for the first time — they were added '
  'to `f425r` without ever joining 0.2''s own NULL sweep, a gap this pass closes too.');

select is((
  select ma.user_id = (select staff_uid from f425)
     and mm.commission_id = (select ccih_cid from f425)
     and ma.attendance = 'present'
     and mm.status = 'in_signature'
  from public.meeting_attendees ma join public.meetings mm on mm.id = ma.meeting_id
  where ma.id = (select attendee_id from f425r)
), true,
  '0.2b ⭐⭐ F3 PIN CONTROL: the pinned attendee (`a5f30000-…-a2`) is staff4.ccih''s OWN row, on a '
  'CCIH meeting, PRESENT, `in_signature` — the exact four preconditions `app.can_sign_meeting` '
  'requires. A future reseed that moves or retypes this id now fails HERE, as a named fixture '
  'assertion, never silently as an authorization regression read off §2/§3''s aggregate counts '
  '(the review''s own F3 bound: "a routine scoped re-run can report an authorization regression '
  'because it selected unrelated test data").');

select is((select state::text from authz.roles where code = 'staff'), 'authoritative',
  '0.3 PRECONDITION: `staff` is `authoritative` (T6, `31b73837`) — the grant rows this file '
  'deletes/restores are the LIVE, consulted-by-nothing-yet catalog rows, not a `test_validation` '
  'shadow copy.');

select is((select count(*)::int from f425w where
             framework_id_absent is not null and action_item_id_absent is not null
             and controlled_document_id_absent is not null and document_version_id_absent is not null
             and document_core_id_absent is not null and comember_id_absent is not null), 1,
  '0.4 FIXTURE CONTROL for the seven role-free-disjunct sites'' `disjunct_absent` resources — all '
  'six ids resolved (two derived relationally from the same vector-bound `controlled_documents` '
  'id, never independently chosen). A NULL here would silently make §3.2''s discriminating '
  'measurement for that site vacuous (an `exists` over nothing denies for the WRONG reason).');

-- ============================================================================
-- §1 — THE DECLARED SITE SET, AS DATA (the manifest's `armInterface`, transcribed once here so
-- §2/§3 can drive off it rather than 69 hand-repeated literals). Transcribed by direct read of
-- `supabase/tests/vectors/authz-enforcement-manifest.json`'s 20 `armInterface`-bearing rows this
-- round (2026-09-14) — if this file reds on §1.1's count, the manifest moved and this table is
-- the thing to re-transcribe, never the count.
-- ============================================================================

create temp table f425_sites (code text, kind text, site text) on commit drop;
insert into f425_sites (code, kind, site) values
  ('commission.accreditation.read', 'policy', 'public.accreditation_frameworks.accreditation_frameworks_select'),
  ('commission.accreditation.read', 'policy', 'public.accreditation_standards.accreditation_standards_select'),
  ('commission.accreditation.read', 'policy', 'public.evidence_links.evidence_links_select'),
  ('commission.accreditation.read', 'policy', 'public.standard_assessments.standard_assessments_select'),
  ('commission.accreditation.read', 'function', 'public.get_standard_assessment'),
  ('commission.accreditation.read', 'function', 'public.readiness_evidence'),
  ('commission.accreditation.read', 'function', 'public.readiness_report'),
  ('commission.action_items.read', 'policy', 'public.action_items.action_items_select'),
  ('commission.action_items.read', 'function', 'app.can_read_action_item'),
  ('commission.capa.read', 'function', 'app.can_read_capa'),
  ('commission.cases.deliberation.read', 'function', 'app._case_caps'),
  ('commission.cases.vocabulary.read', 'policy', 'public.case_narrative_types.case_narrative_types_select'),
  ('commission.cases.vocabulary.read', 'policy', 'public.case_outcomes.case_outcomes_select'),
  ('commission.cases.vocabulary.read', 'policy', 'public.case_tags.case_tags_select'),
  ('commission.cases.vote', 'function', 'public.cast_case_vote'),
  ('commission.charter.read', 'policy', 'public.commission_charters.commission_charters_select'),
  ('commission.charter.read', 'function', 'public.meeting_cadence_status'),
  ('commission.charter.read', 'function', 'public.suggest_carry_forward'),
  ('commission.documents.read', 'policy', 'public.controlled_documents.controlled_documents_select'),
  ('commission.documents.read', 'policy', 'public.controlled_document_versions.controlled_document_versions_select'),
  ('commission.documents.read', 'policy', 'public.securable_resources.securable_resources_select'),
  ('commission.documents.read', 'function', 'public.list_commission_documents'),
  ('commission.documents.read', 'function', 'public.documents_due_for_review'),
  ('commission.documents.read', 'function', 'app.can_read_document'),
  ('commission.documents.read', 'function', 'app.can_read_document_of_version'),
  ('commission.forms.read', 'policy', 'public.forms.forms_select'),
  ('commission.forms.read', 'policy', 'public.form_versions.form_versions_select'),
  ('commission.forms.read', 'policy', 'public.form_sections.form_sections_select'),
  ('commission.forms.read', 'policy', 'public.form_items.form_items_select'),
  ('commission.forms.read', 'policy', 'public.form_item_options.form_item_options_select'),
  ('commission.forms.read', 'policy', 'public.form_item_validations.form_item_validations_select'),
  ('commission.forms.read', 'policy', 'public.form_matrix_rows.form_matrix_rows_select'),
  ('commission.forms.read', 'policy', 'public.form_matrix_columns.form_matrix_columns_select'),
  ('commission.forms.read', 'policy', 'storage.objects.form_assets_select_member'),
  ('commission.indicators.read', 'policy', 'public.indicators.indicators_select'),
  ('commission.indicators.read', 'policy', 'public.indicator_measurements.indicator_measurements_select'),
  ('commission.indicators.read', 'function', 'public.indicator_series'),
  ('commission.meetings.cases.shell.read', 'policy', 'public.meeting_cases.meeting_cases_select'),
  ('commission.meetings.minutes.sign', 'policy', 'public.meeting_signatures.meeting_signatures_insert'),
  ('commission.meetings.minutes.sign', 'function', 'app.can_sign_meeting'),
  ('commission.meetings.minutes.sign', 'function', 'public.sign_meeting'),
  ('commission.meetings.read', 'policy', 'public.meetings.meetings_select'),
  ('commission.meetings.read', 'policy', 'public.commission_meeting_settings.meeting_settings_select'),
  ('commission.meetings.read', 'policy', 'public.commission_meeting_types.meeting_types_select'),
  ('commission.meetings.read', 'function', 'app.can_reach_meeting'),
  ('commission.meetings.read', 'registry', 'app._audit_access_authorized'),
  ('commission.process_templates.read', 'policy', 'public.process_templates.process_templates_select'),
  ('commission.process_templates.read', 'policy', 'public.process_template_versions.process_template_versions_select'),
  ('commission.process_templates.read', 'policy', 'public.process_template_phases.process_template_phases_select'),
  ('commission.process_templates.read', 'policy', 'public.process_template_custom_fields.process_template_custom_fields_select'),
  ('commission.process_templates.read', 'policy', 'public.process_template_narratives.process_template_narratives_select'),
  ('commission.process_templates.read', 'policy', 'public.process_template_outcomes.process_template_outcomes_select'),
  ('commission.process_templates.read', 'policy', 'public.process_template_phase_allowed_results.process_template_phase_allowed_results_select'),
  ('commission.process_templates.read', 'policy', 'public.process_template_phase_offered_results.process_template_phase_offered_results_select'),
  ('commission.process_templates.read', 'policy', 'public.phase_results.phase_results_select'),
  ('commission.referrals.metadata.read', 'function', 'app.can_read_referral_metadata'),
  ('commission.referrals.metadata.read', 'function', 'app.can_read_referral_internal_note'),
  ('commission.referrals.metadata.read', 'function', 'app.can_read_referral_internal_notes'),
  ('commission.referrals.metadata.read', 'function', 'public.get_referral_case_access_summary'),
  ('commission.referrals.metadata.read', 'registry', 'app._audit_access_authorized'),
  ('commission.referrals.notes.author', 'function', 'public.create_referral_internal_note'),
  ('commission.responses.create', 'policy', 'public.responses.responses_insert_own'),
  ('commission.responses.create', 'ts', 'src/lib/responses/actions.ts:282-287'),
  ('commission.roster.read', 'policy', 'public.memberships.memberships_select'),
  ('commission.roster.read', 'policy', 'public.commissions.commissions_select_member_or_admin'),
  ('commission.roster.read', 'policy', 'public.profiles.profiles_select_self_or_admin'),
  ('commission.roster.read', 'policy', 'public.commission_member_titles.member_titles_select'),
  ('commission.safety_events.read', 'function', 'app.can_read_event'),
  ('commission.safety_events.report', 'function', 'public.notify_safety_event');

grant select on f425_sites to authenticated;

select is((select count(*)::int from f425_sites), 69,
  '1.1 ⭐⭐ THE DECLARED SITE COUNT: 69, transcribed from the manifest''s 20 `armInterface`-bearing '
  'rows. A count alone would pass on a swap, so 1.2/1.3 pin the SHAPE too.');
select is((select count(distinct code)::int from f425_sites), 20,
  '1.2 twenty distinct codes carry `armInterface` — the manifest names no more, no fewer.');
select is((select count(*)::int from f425_sites where kind = 'policy'), 42,
  '1.3 forty-two POLICY-kind sites — matches `docs/progress/ae5-staff.md`''s own 42.');
select is((select count(*)::int from f425_sites where kind in ('function','registry')), 26,
  '1.4 twenty-six DEFINER-kind site ROWS (24 `function` + 2 `registry`) — collapses to 25 DISTINCT '
  'functions because the 2 `registry` rows are the SAME function (`app._audit_access_authorized`) '
  'declared under two different codes for its two different legs (`meeting.viewed`/'
  '`interview.viewed` vs `referral.case_access_summary_viewed`) — a row count of 25 here would be '
  'wrong (it would silently dedupe by NAME across codes, hiding that the same door serves two '
  'different arm rows for two different reasons).');
select is((select count(distinct site)::int from f425_sites where kind in ('function','registry')), 25,
  '1.5 …and the DISTINCT-NAME count confirms it: 25 unique DEFINER functions back the 26 rows.');
select is((select count(*)::int from f425_sites where kind = 'ts'), 1,
  '1.6 exactly ONE non-DB site: `src/lib/responses/actions.ts` — declared, never probed by this '
  'file (no DB connection reaches it; it is a defence-in-depth TS check the manifest itself '
  'labels "none — defence in depth only" beside the DB-side policy that is `responses_insert_own`).');

-- ============================================================================
-- §2 — THE LIVE DIFFERENTIAL, PER CODE. `pg_temp.site_signature` captures a text signature for
-- one (code, kind, site) row under the CURRENT claims/grant state; NULL means "this site is not
-- live-probed this round" (the 9 named in the header — 5 volatile, 4 fixture-gapped — plus the
-- 1 `ts` site, which is never a DB call).
-- ============================================================================

create or replace function pg_temp.site_signature(p_code text, p_kind text, p_site text)
returns text language plpgsql stable as $sig$
declare
  r record; v_table text; v_result text; v_sqlstate text;
begin
  select * into r from f425 limit 1;
  if p_kind = 'ts' then
    return null;
  end if;
  if p_kind = 'policy' then
    -- ⛔ Two of the 42 policy sites are INSERT/WITH-CHECK policies (`responses_insert_own`,
    -- `meeting_signatures_insert`), not SELECT policies — a `count(*)` probe exercises whatever
    -- SELECT policy the table happens to have, which is a DIFFERENT policy entirely, never the
    -- declared site. Rather than a savepoint-guarded live INSERT attempt (its own hazard on a
    -- shared stack), these two are named-skipped here (NULL), same convention as §2's 9 DEFINER
    -- skips, and covered instead by §1's cardinality controls only.
    if p_site in ('public.responses.responses_insert_own', 'public.meeting_signatures.meeting_signatures_insert') then
      return null;
    end if;
    -- ⭐⭐ FOUR of the 42 policy sites carry a role-free disjunct wide enough that a blind
    -- `count(*)` NEVER discriminates for `staff4.ccih` (run-4 addendum) — a public framework, an
    -- item assigned directly to her, a document/version she approves. This file's PRIMARY
    -- measurement for these four is a SCOPED existence check on the `disjunct_absent` resource
    -- (`f425w`) the disjunct does NOT reach; the ORIGINAL blind-count probe survives separately as
    -- the P1-survivor witness (below, `pg_temp.p1_survivor_signature`), never dropped.
    if p_site = 'public.accreditation_frameworks.accreditation_frameworks_select' then
      begin
        select count(*)::text from public.accreditation_frameworks
         where id = (select framework_id_absent from f425w) into v_result;
      exception when others then
        get stacked diagnostics v_sqlstate = returned_sqlstate; return 'RAISE:' || v_sqlstate;
      end;
      return v_result;
    end if;
    if p_site = 'public.action_items.action_items_select' then
      begin
        select count(*)::text from public.action_items
         where id = (select action_item_id_absent from f425w) into v_result;
      exception when others then
        get stacked diagnostics v_sqlstate = returned_sqlstate; return 'RAISE:' || v_sqlstate;
      end;
      return v_result;
    end if;
    if p_site = 'public.controlled_documents.controlled_documents_select' then
      begin
        select count(*)::text from public.controlled_documents
         where id = (select controlled_document_id_absent from f425w) into v_result;
      exception when others then
        get stacked diagnostics v_sqlstate = returned_sqlstate; return 'RAISE:' || v_sqlstate;
      end;
      return v_result;
    end if;
    if p_site = 'public.controlled_document_versions.controlled_document_versions_select' then
      begin
        select count(*)::text from public.controlled_document_versions
         where id = (select document_version_id_absent from f425w) into v_result;
      exception when others then
        get stacked diagnostics v_sqlstate = returned_sqlstate; return 'RAISE:' || v_sqlstate;
      end;
      return v_result;
    end if;
    -- ⭐⭐ TWO MORE — `memberships_select`/`profiles_select_self_or_admin` — carry the SELF-ROW
    -- disjunct (`principal_id = auth.uid()` / `id = auth.uid()`); the `disjunct_absent` resource
    -- here is simply ANOTHER CCIH member's row (`comember_id_absent`), which the self-disjunct
    -- structurally cannot reach but ordinary `can_roster_read` does.
    if p_site = 'public.memberships.memberships_select' then
      begin
        select count(*)::text from public.memberships
         where principal_id = (select comember_id_absent from f425w) into v_result;
      exception when others then
        get stacked diagnostics v_sqlstate = returned_sqlstate; return 'RAISE:' || v_sqlstate;
      end;
      return v_result;
    end if;
    if p_site = 'public.profiles.profiles_select_self_or_admin' then
      begin
        select count(*)::text from public.profiles
         where id = (select comember_id_absent from f425w) into v_result;
      exception when others then
        get stacked diagnostics v_sqlstate = returned_sqlstate; return 'RAISE:' || v_sqlstate;
      end;
      return v_result;
    end if;
    v_table := regexp_replace(p_site, '\.[^.]+$', ''); -- strip the trailing .policyname
    begin
      execute format('select count(*)::text from %s', v_table) into v_result;
    exception when others then
      get stacked diagnostics v_sqlstate = returned_sqlstate;
      return 'RAISE:' || v_sqlstate;
    end;
    return v_result;
  end if;
  -- Unhandled-site guard stays OUTSIDE the trap below: a dispatch bug of MINE must still abort
  -- the file loudly, never be swallowed as if it were a door's own denial.
  if p_site not in (
      'app.can_read_action_item','app.can_reach_meeting','app.can_sign_meeting','app._case_caps',
      'app.can_read_capa','app.can_read_document','app.can_read_document_of_version','app.can_read_event',
      'app.can_read_referral_internal_notes','app.can_read_referral_metadata','public.indicator_series',
      'public.list_commission_documents','public.documents_due_for_review','public.meeting_cadence_status',
      'public.suggest_carry_forward','app._audit_access_authorized',
      'public.cast_case_vote','public.create_referral_internal_note','public.notify_safety_event',
      'public.get_referral_case_access_summary','public.get_standard_assessment',
      'public.readiness_evidence','public.readiness_report','app.can_read_referral_internal_note',
      'public.sign_meeting') then
    raise exception 'pg_temp.site_signature: unhandled site %', p_site;
  end if;
  -- NOT live-probed this round (see header): the 5 volatile writers only. The 4 fixture-gapped
  -- reads (L34/F1, 2026-09-15) are re-pointed at the seeded ids below and live-probed like any
  -- other site — `2dddd278` closed the fixture gap the original 9-site cut named.
  if p_site in ('public.cast_case_vote', 'public.create_referral_internal_note', 'public.notify_safety_event',
                'public.get_referral_case_access_summary',
                'public.sign_meeting') then
    return null;
  end if;
  -- ⭐⭐ THE TRAP. Post-T7, a DEFINER site's gate can RAISE where pre-T7 it only returned a falsy
  -- value — `public.meeting_cadence_status` is the measured case: its raise path (`HC0K2`) always
  -- existed for a non-member, but this harness calls it AS a member whose grant just got deleted,
  -- and once the site is re-keyed that member starts hitting the raise path instead of a plain
  -- `false`. An untrapped raise here doesn't fail ONE assertion — it aborts the whole file before
  -- §3.1/3.2 ever run (LEARN-083's shape: a verdict lost, never earned). So EVERY DEFINER/registry
  -- call is trapped, and a raise becomes a SIGNATURE, not a suite failure: `'RAISE:' || SQLSTATE`.
  -- This keeps the discrimination half honest under equality-comparison, unaltered: a site whose
  -- signature is `RAISE:xxxxx` both before and after the deletion is still "no movement" (same
  -- string, same equality test); one that goes from a real value to a `RAISE:xxxxx` (or between
  -- two DIFFERENT SQLSTATEs) is "movement" — exactly what §3.1/§3.2 already ask, needing no
  -- change to their own predicates now that `pg_temp.sig_is_granted` also reads a `RAISE:%`
  -- signature as denied (never as an unmatched, accidentally-"granted" string).
  begin
    case p_site
      when 'app.can_read_action_item' then
        select app.can_read_action_item((select action_item_id from f425r), r.staff_uid)::text into v_result;
      when 'app.can_reach_meeting' then
        select app.can_reach_meeting((select meeting_id from f425r), r.staff_uid)::text into v_result;
      when 'app.can_sign_meeting' then
        select app.can_sign_meeting((select attendee_id from f425r), r.staff_uid)::text into v_result;
      when 'app._case_caps' then
        select app._case_caps((select case_id from f425r), r.staff_uid)::text into v_result;
      when 'app.can_read_capa' then
        select app.can_read_capa((select capa_id from f425r), r.staff_uid)::text into v_result;
      when 'app.can_read_document' then
        -- ⭐⭐ Uses `f425w`'s `disjunct_absent` document (run-4 addendum), NOT `f425r`'s approved
        -- one — `f425r.document_core_id` is `is_document_approver_of`-reachable regardless of the
        -- code (that's now the P1-survivor witness, `pg_temp.p1_survivor_signature`, below), so it
        -- can never serve as this site's PRIMARY discriminating measurement.
        select app.can_read_document((select document_core_id_absent from f425w), r.staff_uid)::text into v_result;
      when 'app.can_read_document_of_version' then
        select app.can_read_document_of_version((select document_version_id from f425r), r.staff_uid)::text into v_result;
      when 'app.can_read_event' then
        select app.can_read_event((select event_id from f425r), r.staff_uid)::text into v_result;
      when 'app.can_read_referral_internal_notes' then
        select app.can_read_referral_internal_notes((select referral_id from f425r), r.staff_uid)::text into v_result;
      when 'app.can_read_referral_metadata' then
        select app.can_read_referral_metadata((select referral_id from f425r), r.staff_uid)::text into v_result;
      when 'public.indicator_series' then
        select count(*)::text from public.indicator_series((select indicator_id from f425r)) into v_result;
      when 'public.list_commission_documents' then
        select count(*)::text from public.list_commission_documents((select ccih_cid from f425)) into v_result;
      when 'public.documents_due_for_review' then
        select count(*)::text from public.documents_due_for_review((select ccih_cid from f425)) into v_result;
      when 'public.meeting_cadence_status' then
        select public.meeting_cadence_status((select ccih_cid from f425))::text into v_result;
      when 'public.suggest_carry_forward' then
        select public.suggest_carry_forward((select ccih_cid from f425))::text into v_result;
      when 'app._audit_access_authorized' then
        if p_code = 'commission.meetings.read' then
          select app._audit_access_authorized('meeting.viewed', (select meeting_id from f425r), (select ccih_cid from f425))::text into v_result;
        elsif p_code = 'commission.referrals.metadata.read' then
          select app._audit_access_authorized('referral.case_access_summary_viewed', (select referral_id from f425r), (select ccih_cid from f425))::text into v_result;
        end if;
      -- ⭐⭐ L34/F1 (2026-09-15) — re-pointed at the seeded fixture ids (`2dddd278`), no longer
      -- returning NULL. `get_standard_assessment`/`readiness_evidence` read their OWN backing
      -- tables (`standard_assessments`/`evidence_links`), which are STILL empty (measured this
      -- round, header + "Ten of 59" note below) — their `count(*)` is `0` before AND after the
      -- code-grant deletion, the SAME non-discriminating shape as those tables' own POLICY
      -- siblings (`standard_assessments_select`/`evidence_links_select`, already excluded from
      -- §2.0/§3.1). `readiness_report` reads FROM `accreditation_standards` (now 2 fixture rows,
      -- LEFT JOINing the still-empty tables) and `can_read_referral_internal_note` reads the ONE
      -- seeded `referral_internal_notes` row — both DISCRIMINATE live-measured 1→0 / t→f.
      when 'public.get_standard_assessment' then
        select count(*)::text from public.get_standard_assessment((select ccih_cid from f425), (select accreditation_standard_id from f425r)) into v_result;
      when 'public.readiness_evidence' then
        select count(*)::text from public.readiness_evidence((select ccih_cid from f425), (select accreditation_standard_id from f425r)) into v_result;
      when 'public.readiness_report' then
        select count(*)::text from public.readiness_report((select ccih_cid from f425), (select accreditation_framework_id from f425r)) into v_result;
      when 'app.can_read_referral_internal_note' then
        select app.can_read_referral_internal_note((select referral_internal_note_id from f425r), r.staff_uid)::text into v_result;
    end case;
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    return 'RAISE:' || v_sqlstate;
  end;
  return v_result;
end;
$sig$;

-- ⭐⭐ THE P1-SURVIVOR WITNESS (run-4 addendum) — for the SAME seven sites, reproduces the
-- ORIGINAL (pre-addendum) blind probe: whatever the disjunct itself makes visible, unfiltered.
-- This is the accepted exception's OWN witness (PO ruling P1,
-- `arm3:divergent-approved:role-free-disjunct-ignores-principal-state`) — it is expected to stay
-- GRANTED both before and after the code deletion, proving the disjunct itself was never touched
-- by this file's mutation, which is the OTHER half of "the disjunct is real, not a suite blind
-- spot" (§3.2's re-pointed primary measurement, above, is the half proving the CODE-GATED path
-- still moves). Never used for §3.1/§3.2's counts — only for §3.3 below.
create or replace function pg_temp.p1_survivor_signature(p_site text)
returns text language plpgsql stable as $p1$
declare
  r record; v_table text; v_result text; v_sqlstate text;
begin
  select * into r from f425 limit 1;
  begin
    if p_site = 'app.can_read_document' then
      select app.can_read_document((select document_core_id from f425r), r.staff_uid)::text into v_result;
    else
      v_table := regexp_replace(p_site, '\.[^.]+$', '');
      execute format('select count(*)::text from %s', v_table) into v_result;
    end if;
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    return 'RAISE:' || v_sqlstate;
  end;
  return v_result;
end;
$p1$;

grant execute on function pg_temp.p1_survivor_signature(text) to authenticated;

create or replace function pg_temp.code_signatures(p_code text)
returns table(kind text, site text, sig text) language sql stable as $cs$
  select s.kind, s.site, pg_temp.site_signature(p_code, s.kind, s.site)
    from f425_sites s where s.code = p_code order by s.kind, s.site;
$cs$;

-- ⭐ ONE shared "is this signature a GRANTED answer" reading, used by both 2.0 (baseline positive
-- control) and 3.2 (the red-by-design mirror) — a policy signature is a row count (`> 0` grants);
-- a DEFINER/registry signature can be boolean (`t`), an integer capability count (`_case_caps`),
-- or a jsonb/set-count text (`meeting_cadence_status`, `suggest_carry_forward`,
-- `documents_due_for_review`, `list_commission_documents`, `indicator_series`) — "granted" for
-- any of those non-boolean shapes means "not the empty/false/zero answer", never "literally 't'".
-- ⛔ A duplicated inline expression at both call sites is exactly how 2.0 first went wrong: it
-- tested `sig in ('t','true')` literally, which reads every non-boolean POSITIVE answer (a count
-- of '2', a jsonb payload) as NOT granted — a wrong MATCHER that read like a live defect at 6 of
-- the 19 sites 2.0 first failed on (three fixture-empty tables and two policy-type mismatches
-- accounted for the other 13; see the session log).
-- ⭐⭐ `RAISE:%` — a TRAPPED door exception (`pg_temp.site_signature`'s own trap) — is ALWAYS
-- denied, checked BEFORE the policy branch's `::int` cast: a raise on a policy's `count(*)` probe
-- is not a numeric string, and casting it would abort THIS function instead of reading as a deny.
create or replace function pg_temp.sig_is_granted(p_kind text, p_sig text) returns boolean
language sql immutable as $ig$
  select case
    when p_sig is null then null
    when p_sig like 'RAISE:%' then false
    when p_kind = 'policy' then p_sig::int > 0
    else p_sig not in ('f', 'false', '0', '', '{}', 'null')
  end;
$ig$;

grant execute on function pg_temp.site_signature(text, text, text) to authenticated;
grant execute on function pg_temp.code_signatures(text) to authenticated;

create table pg_temp.f425_results (code text, phase text, kind text, site text, sig text);
grant select, insert on pg_temp.f425_results to authenticated;

do $$
declare
  v_code text;
  v_row record;
begin
  perform test_helpers.reset_role_and_claims();
  perform test_helpers.claims_for((select staff_uid from f425), false, 'staff');
  set local role authenticated;
  for v_code in select distinct code from f425_sites order by 1 loop
    for v_row in select * from pg_temp.code_signatures(v_code) loop
      insert into pg_temp.f425_results values (v_code, 'before', v_row.kind, v_row.site, v_row.sig);
    end loop;
    for v_row in select site from f425_p1_sites where code = v_code loop
      insert into pg_temp.f425_results values (v_code, 'p1_before', 'policy_witness', v_row.site, pg_temp.p1_survivor_signature(v_row.site));
    end loop;
  end loop;
  reset role;
end $$;

-- Ten of the 59 live-probed sites are policy sites on tables the seeded local stack carries NO
-- rows for at all (measured directly, not inferred from a zero count alone — each was re-checked
-- with a bare `select count(*)` with NO role switch, i.e. as `postgres`, and still reads 0):
-- `accreditation_standards`, `evidence_links`, `standard_assessments` (cascades from the first —
-- no standard exists to assess), `case_tags`, `commission_charters`, `form_item_validations`,
-- `storage.objects` (no uploaded form assets), `phase_results`,
-- `process_template_phase_allowed_results`, `process_template_phase_offered_results`. A `staff`
-- holder reading zero rows from an EMPTY table is not a denial — 0.2 already excludes them from
-- the resolved-fixture control for the same reason. Filed alongside the 4 DEFINER fixture gaps in
-- `docs/testing/ae5-staff-fixture-gaps.md`. They stay IN 3.1/3.2's denominator (a 0-before/
-- 0-after pair is still a valid, if uninformative, "no movement" observation) and are excluded
-- ONLY from 2.0's positive-control claim, which needs a REAL positive to be meaningful.
-- ⚠ DATED NOTE, 2026-09-15 (L34, F1) — `accreditation_standards` is NO LONGER one of the ten:
-- `2dddd278` gave it 2 rows (header above), so `accreditation_standards_select`'s `staff4.ccih`
-- count is now a real `1` (her own CCIH standard). `evidence_links`/`standard_assessments` were
-- STILL empty at F1's measurement (re-checked that round, still `0`) — see the FURTHER dated note
-- immediately below for what changed since.
-- ⚠⚠ DATED NOTE, 2026-09-15 (L36, backend's fixture) — `evidence_links` and `standard_assessments`
-- are ALSO no longer empty: backend seeded ONE row each on CCIH-1 (`a5f50000-…-b1`) —
-- `standard_assessments` row `a5f50000-…-c1` (`status='parcial'`), `evidence_links` row
-- `a5f50000-…-d1` (`artifact_kind='action_item'`). Both POLICY sites
-- (`standard_assessments_select`, `evidence_links_select`) AND both DEFINER functions
-- (`get_standard_assessment`, `readiness_evidence`, which read those exact tables) now read a
-- real `1` for `staff4.ccih` before the code-grant deletion (live-measured, rolled back) — ALL
-- FOUR removed from this exclusion list; F1's "harmless conservatism" that kept
-- `accreditation_standards_select` excluded is corrected too, since it was never actually needed
-- and L36 is the round that closes every remaining fixture-empty accreditation site. Only the
-- ORIGINAL eight sparse-table sites remain excluded.
select is((select count(*)::int from pg_temp.f425_results where phase = 'before' and sig is not null
            and site not in (
              'public.case_tags.case_tags_select',
              'public.commission_charters.commission_charters_select',
              'public.form_item_validations.form_item_validations_select',
              'storage.objects.form_assets_select_member',
              'public.phase_results.phase_results_select',
              'public.process_template_phase_allowed_results.process_template_phase_allowed_results_select',
              'public.process_template_phase_offered_results.process_template_phase_offered_results_select')
            and pg_temp.sig_is_granted(kind, sig)),
          (select count(*)::int from pg_temp.f425_results where phase = 'before' and sig is not null
            and site not in (
              'public.case_tags.case_tags_select',
              'public.commission_charters.commission_charters_select',
              'public.form_item_validations.form_item_validations_select',
              'storage.objects.form_assets_select_member',
              'public.phase_results.phase_results_select',
              'public.process_template_phase_allowed_results.process_template_phase_allowed_results_select',
              'public.process_template_phase_offered_results.process_template_phase_offered_results_select')),
  '2.0 ⭐ BASELINE, GRANT PRESENT: every LIVE-PROBED site''s signature reads as a non-empty / '
  'truthy answer for `staff4.ccih` on her own CCIH commission — a positive control that this '
  'file''s fixtures are real rows a `staff` holder can actually see, not an accidental universal '
  'denial that would make every later "no movement" line vacuous. ⚠ 10 sites excluded, named '
  'above — genuinely empty tables, not denials (measured as `postgres`, still 0). ⭐⭐ RE-POINTED '
  '2026-09-15 (L34, F1): 12 sites excluded — the original 10 PLUS '
  '`public.get_standard_assessment`/`public.readiness_evidence`. ⭐⭐⭐ RE-POINTED AGAIN 2026-09-15 '
  '(L36, backend''s fixture rows on CCIH-1): DOWN TO 7 excluded — `accreditation_standards_select`, '
  '`evidence_links_select`, `standard_assessments_select`, `get_standard_assessment` and '
  '`readiness_evidence` all removed, all now reading a genuine `1`. Live-derived both sides equal '
  '`54` (fresh `db reset` + scoped `00_setup`+`425` run, 2026-09-15) — the assertion PASSES on the '
  'live equality, never on this literal.');

-- ---------- THE MUTATION, PER CODE ----------
do $$
declare
  v_code text;
  v_row record;
  v_deleted int;
  v_restored int;
begin
  for v_code in select distinct code from f425_sites order by 1 loop
    delete from authz.role_permissions
     where role_code = 'staff' and permission_code = v_code;
    get diagnostics v_deleted = row_count;
    insert into pg_temp.f425_results values (v_code, 'mutation_deleted_count', null, null, v_deleted::text);

    perform test_helpers.reset_role_and_claims();
    perform test_helpers.claims_for((select staff_uid from f425), false, 'staff');
    set local role authenticated;
    for v_row in select * from pg_temp.code_signatures(v_code) loop
      insert into pg_temp.f425_results values (v_code, 'after', v_row.kind, v_row.site, v_row.sig);
    end loop;
    for v_row in select site from f425_p1_sites where code = v_code loop
      insert into pg_temp.f425_results values (v_code, 'p1_after', 'policy_witness', v_row.site, pg_temp.p1_survivor_signature(v_row.site));
    end loop;
    reset role;

    insert into authz.role_permissions (role_code, permission_code) values ('staff', v_code);
    get diagnostics v_restored = row_count;
    insert into pg_temp.f425_results values (v_code, 'mutation_restored_count', null, null, v_restored::text);

    perform test_helpers.reset_role_and_claims();
    perform test_helpers.claims_for((select staff_uid from f425), false, 'staff');
    set local role authenticated;
    for v_row in select * from pg_temp.code_signatures(v_code) loop
      insert into pg_temp.f425_results values (v_code, 'restored', v_row.kind, v_row.site, v_row.sig);
    end loop;
    for v_row in select site from f425_p1_sites where code = v_code loop
      insert into pg_temp.f425_results values (v_code, 'p1_restored', 'policy_witness', v_row.site, pg_temp.p1_survivor_signature(v_row.site));
    end loop;
    reset role;
  end loop;
end $$;

select is((select count(*)::int from pg_temp.f425_results where phase = 'mutation_deleted_count' and sig = '1'), 20,
  '2.1 THE MUTATION LANDED at EVERY one of the 20 codes — one row deleted, each time, asserted, '
  'never assumed (same discipline as 409 §2.7 / 424 §6.1).');

-- ⚠⚠ DATED NOTE, 2026-09-14 (run-4, post-T7, `2dddd278`) — §3.1/§3.2's ORIGINAL PRESCRIPTION IS
-- KEPT VERBATIM BELOW RATHER THAN REWRITTEN (LEARN-088: a correction is a dated note beside the
-- original, never a replacement of it). Both assertions' TEXT still describes their PRE-T7 shape
-- (want 0 / want 57); their PREDICATES below are re-pointed twice now, both times live-queried,
-- never guessed:
--   PASS 1 (first run-4 measurement) excluded 11 sites from §3.1's "must move" and 8 from §3.2's
--   "must discriminate" — SEVEN of those eight were later found to be silencing sites that CAN
--   discriminate (PASS 2, below); only ONE (`app._audit_access_authorized`'s `meeting.viewed` leg)
--   is a genuine, permanent exclusion.
--   PASS 2 (this round) — for each of the seven, 424's own vector
--   (`authz_differential_cells_staff`) already binds a `disjunct_absent`-class fixed-literal
--   resource the disjunct does NOT reach (`f425w`, keyed by `probe_table`/`probe_column`, never a
--   new id): a CCIH-owned framework (not null-owner), a `committee`-scoped item (not assigned to
--   `staff4.ccih`), a document/version she does not approve, another CCIH member''s row (not her
--   own). Re-pointing each site''s PRIMARY signature to that resource (site_signature, above) —
--   ALL SEVEN now correctly `t`→`f` live-verified this round. The ORIGINAL blind probe (the
--   disjunct-reachable resource) is KEPT as a SECOND, separate measurement — the P1-survivor
--   witness (`pg_temp.p1_survivor_signature`, `p1_before`/`p1_after`/`p1_restored` phases, §3.3
--   below) — so the disjunct''s own survival is still witnessed, never silently dropped.
--   ⛔ ONLY `app._audit_access_authorized`''s `meeting.viewed` leg remains excluded from BOTH
--   assertions: its body reads `app.is_member_of(v_commission) OR
--   app.is_tenancy_admin_of(v_commission)` directly, never a permission code — matches the
--   manifest''s own `carriesCode:false` on this leg. It was never in T7''s re-key surface and
--   cannot move under this file''s mutation without a SEPARATE change to that function.
--   Re-derived want, PASS 2: §3.1 = 57 − 10 (9 sparse + the audit leg) = **47** must move.
--                             §3.2 = 57 − 1 (the audit leg only) = **56** must discriminate.
-- ⛔ A NINTH site (`app.can_read_capa`) looked like this same shape on the FIRST run-4 pass (`t`/`t`,
-- have 48/want 57) but measured differently: this file''s OWN `capa_id` fixture pointed at a
-- `source=''rca''` plan, reachable via `can_read_capa`''s event-linked arm — NOT the
-- `commission.capa.read`-gated indicator arm the manifest names. Re-pointed the fixture to a
-- `source=''indicator''` plan at the same hospital (isolated live: not PQS-reachable, no linked
-- event) and it now correctly reads `t`→`f` — a FIXTURE fix on the SUITE side (this file''s own
-- `f425r`), not a scope cut of any kind. Never excluded from either list; it counts toward
-- "moved" and "discriminates" like any ordinary site.
select is((
  select count(*)::int from pg_temp.f425_results b join pg_temp.f425_results a
    using (code, kind, site)
   where b.phase = 'before' and a.phase = 'after' and b.sig is not null and b.sig is not distinct from a.sig
     and a.site not in (
       'public.case_tags.case_tags_select',
       'public.commission_charters.commission_charters_select',
       'public.form_item_validations.form_item_validations_select',
       'storage.objects.form_assets_select_member',
       'public.phase_results.phase_results_select',
       'public.process_template_phase_allowed_results.process_template_phase_allowed_results_select',
       'public.process_template_phase_offered_results.process_template_phase_offered_results_select',
       'app._audit_access_authorized')
), 0,
  '⚠ ORIGINAL TEXT, VERBATIM, AS THE RECORD OF THE PRE-T7 STATE — 3.1 ⭐⭐ THE WITNESS THIS FILE '
  'EXISTS TO PRODUCE — NO MOVEMENT. Across all 20 codes'' live-probed sites, deleting `staff`''s '
  'permission-code grant changed NOT ONE signature. This is the direct, measured confirmation of '
  'the manifest''s own claim (`callGraphBoundary.reason`, all 20 rows): pre-T7, these 69 sites '
  'gate on ROLE MEMBERSHIP, never on the code. ⛔ EXPECTED GREEN on today''s catalog and MUST be '
  're-observed RED (i.e. failing to be green — some site DID move) the day T7''s re-key partially '
  'lands without moving every declared site, which would itself be a finding: a re-key that flips '
  'one site and not its siblings is a half-migration, and this assertion is what would catch it. '
  '⛔ WHY THIS PROVES THE SUITE IS SOUND RATHER THAN BLIND: §2.0''s baseline already showed every '
  'one of these signatures reads as a real granted answer BEFORE the delete — an instrument that '
  'starts at "already denied" could report "no movement" by measuring nothing (the '
  'fixture-cannot-reach-the-failing-state trap). ⭐⭐ RE-POINTED post-T7 (`2dddd278`, run-4 PASS 2, '
  '2026-09-14): the PREDICATE above now asserts every NON-STATIC site MOVED (10 named exclusions, '
  'dated note above this block) — this reads as "0 exceptions" GREEN when 47 of 57 move, which is '
  'the honest post-T7 form; it is EXPECTED RED again only if a site outside the 10 stops moving '
  '(a re-key regression), never widened further without a fresh live query naming the reason. '
  '⭐⭐ RE-DERIVED 2026-09-15 (L34, F1, fresh `db reset` + scoped `00_setup`+`425` run): the '
  'exclusion list is now 12 (10 PLUS `get_standard_assessment`/`readiness_evidence`, header + §2.0 '
  'above), and the live-measured "must move" universe is `48`, ALL 48 move — 0 exceptions, still '
  'GREEN. `readiness_report` and `can_read_referral_internal_note` are the two NEW movers (1→0, '
  't→f); `get_standard_assessment`/`readiness_evidence` are excluded, not silently dropped. '
  '⭐⭐⭐ RE-DERIVED AGAIN 2026-09-15 (L36, backend''s fixture rows, same fresh-reset scoped run): '
  'exclusion list DOWN TO 7 (the original sparse-table names minus `standard_assessments_select`, '
  'which moves OUT here — `evidence_links_select` was never in THIS list to begin with); '
  '`get_standard_assessment`/`readiness_evidence`/`standard_assessments_select`/'
  '`evidence_links_select` all join the movers, live-measured `1`→`0` each (rolled back). '
  'Live-derived "must move" universe is `52`, ALL 52 move — 0 exceptions, still GREEN.');

select is((
  select count(*)::int from pg_temp.f425_results a
   where a.phase = 'after' and a.sig is not null and not pg_temp.sig_is_granted(a.kind, a.sig)
     and a.site not in ('app._audit_access_authorized')
), (select count(*)::int from pg_temp.f425_results where phase = 'after' and sig is not null
     and site not in ('app._audit_access_authorized')),
  '⚠ ORIGINAL TEXT, VERBATIM, AS THE RECORD OF THE PRE-T7 STATE — 3.2 ⭐⭐ THE MIRROR ASSERTION, '
  'DELIBERATELY RED-BY-DESIGN ON TODAY''S CATALOG. This is the suite AS IT WILL READ once T7 '
  'lands: every live-probed site''s post-delete signature DENIED. It reds today because 3.1 is '
  'true — nothing moved, so nothing denies. ⛔ DO NOT "FIX" THIS ASSERTION TO PASS TODAY: a 425 '
  'that already discriminates before T7 is measuring its own fixture (header), and turning this '
  'green by narrowing its predicate would delete the very signal T7''s landing is supposed to '
  'flip. Re-run this file after T7 (a fresh `db reset` first) — THIS line, unedited, is the T7 '
  'acceptance oracle. ⭐⭐ RE-POINTED post-T7 (`2dddd278`, run-4 PASS 2, 2026-09-14): want is now '
  '56 (57 minus ONLY `app._audit_access_authorized`''s `meeting.viewed` leg, `carriesCode:false`, '
  'dated note above this block) — the seven role-free-disjunct sites PASS 1 excluded here now '
  'measure their `disjunct_absent` resource instead (site_signature, re-pointed this round) and '
  'correctly discriminate; their disjunct''s own survival moved to §3.3''s dedicated witness. '
  '⛔ A site reading `t` here again is NOT automatically a new scope cut — re-derive it live '
  'before adding it to the excluded list, exactly as `can_read_capa` and these seven were. '
  '⭐⭐ RE-DERIVED 2026-09-15 (L34, F1, fresh `db reset` + scoped `00_setup`+`425` run): '
  'want is now `59` (grew from `56` — `readiness_report`/`can_read_referral_internal_note` '
  'newly discriminate-to-denied, and `get_standard_assessment`/`readiness_evidence` need NO '
  'exclusion here: their `0` after-signature already reads as not-granted, same as a real '
  'denial) — live-measured 59/59, still GREEN.');

-- ============================================================================
-- §3.3 — THE P1-SURVIVOR WITNESS (run-4 addendum): the SEVEN role-free-disjunct sites' ORIGINAL
-- probe, now a SEPARATE measurement from §3.1/§3.2's re-pointed primary signal. PO ruling P1
-- (`arm3:divergent-approved:role-free-disjunct-ignores-principal-state`) is an ACCEPTED
-- exception, not a suite blind spot — this section is its witness, both polarities.
-- ============================================================================

select is((
  select count(*)::int from pg_temp.f425_results
   where phase in ('p1_before','p1_after','p1_restored') and sig is not null and pg_temp.sig_is_granted(kind, sig)
), (select count(*)::int from pg_temp.f425_results where phase in ('p1_before','p1_after','p1_restored') and sig is not null),
  '3.3 ⭐⭐ THE P1-SURVIVOR WITNESS: for all seven role-free-disjunct sites, the ORIGINAL '
  '(disjunct-reachable) resource stays GRANTED before the deletion, after it, AND after the '
  'restore — 21 observations (7 sites × 3 phases), all GRANTED. ⛔ THIS is what makes the '
  'exclusion PASS 1 of this round carried (dated note above) an ACCEPTED, WITNESSED exception '
  '(PO ruling P1, `arm3:divergent-approved:role-free-disjunct-ignores-principal-state`) rather '
  'than a silent one: the disjunct itself is measured to survive the SAME mutation whose effect '
  'on the CODE-GATED path §3.1/§3.2 now measure separately, above, via the `disjunct_absent` '
  'resource.');

select is((select count(*)::int from pg_temp.f425_results where phase = 'p1_before'), 7,
  '3.3b CARDINALITY CONTROL: exactly seven P1-survivor probes ran (one per named site) — not '
  'fewer (a site silently dropped) and not more (an eighth added without a live-queried reason, '
  'the exact trap this round''s own re-derivation of §3.1/§3.2''s exclusion lists closed).');

select is((
  select count(*)::int from pg_temp.f425_results b join pg_temp.f425_results r
    using (code, kind, site)
   where b.phase = 'before' and r.phase = 'restored' and b.sig is not null and b.sig is distinct from r.sig
), 0,
  '4.1 ⭐ THE RESTORE IS PROVEN, not assumed — every live-probed site''s signature after '
  're-inserting the grant matches its ORIGINAL before-delete signature, across all 20 codes. A '
  'mutation harness that cannot show its own reversal landed has measured nothing (409 §2.16 / '
  '424 §6.2 idiom).');

select is((select count(*)::int from pg_temp.f425_results where phase = 'mutation_restored_count' and sig = '1'), 20,
  '4.2 the restore INSERT landed exactly once per code, all 20 — the suite leaves '
  '`authz.role_permissions` exactly as it found it.');

-- ============================================================================
-- §3 — THE STATIC HALF, for the 9 DEFINER sites this file does not call live (5 volatile
-- writers/audited-reads + 4 fixture-gapped reads — named in the header). Mirrors 409 §1.1/§1.3's
-- OWN technique: a `prosrc` literal-string search, comment-stripped, needle-quoted. This asks
-- the SAME question ("is the code consulted here") without executing anything.
-- ============================================================================

create or replace function pg_temp.body_mentions_code(p_fn text, p_code text) returns boolean
language sql stable as $bm$
  select coalesce((
    select position('''' || p_code || '''' in regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')) > 0
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname || '.' || p.proname = p_fn
     limit 1
  ), false);
$bm$;

select is((select count(*)::int from (values
    ('public.cast_case_vote', 'commission.cases.vote'),
    ('public.create_referral_internal_note', 'commission.referrals.notes.author'),
    ('public.notify_safety_event', 'commission.safety_events.report'),
    ('public.get_referral_case_access_summary', 'commission.referrals.metadata.read'),
    ('public.get_standard_assessment', 'commission.accreditation.read'),
    ('public.readiness_evidence', 'commission.accreditation.read'),
    ('public.readiness_report', 'commission.accreditation.read'),
    ('app.can_read_referral_internal_note', 'commission.referrals.metadata.read')
  ) as t(fn, code) where pg_temp.body_mentions_code(t.fn, t.code)), 0,
  '5.1 ⭐ STATIC TWIN OF §2/§3''s live half — originally for the 8 DEFINER functions not called '
  'live (the 9th, `public.sign_meeting`, is checked separately at 5.2 since its code is '
  '`commission.meetings.minutes.sign`, already covered live by its sibling `app.can_sign_meeting` '
  '— included here for completeness of the "code literal absent" claim). ZERO of these 8 function '
  'bodies contain their own governing permission code as a string literal — pre-T7, none of them '
  'consult the catalog either. ⛔ Same needle discipline as 409 §1.1: the code IS the literal, '
  'quotes included, `position` not a regex (permission codes contain `.`). ⭐⭐ RE-DERIVED '
  '2026-09-15 (L34, F1): 4 of these 8 (`get_standard_assessment`, `readiness_evidence`, '
  '`readiness_report`, `can_read_referral_internal_note`) are NOW ALSO live-probed (header + §2 '
  'above) — kept here too, redundantly but harmlessly, since the CALLING function''s own body '
  'never embeds the code literal either way (it calls `app.can_accreditation_read`/`app.can_'
  'referrals_metadata_read`, which DO — a different `p_fn`, never asserted by this row). '
  '⭐⭐ RE-DERIVED 2026-09-15 (F2, this round) — "lack live coverage entirely" is no longer true '
  'of these 4: §6 below calls each one for real, through its actual write door, with the grant '
  'present and absent (exact SQLSTATE both ways) — a BEHAVIOURAL live probe, distinct in kind '
  'from §2''s SELECT-count differential (which still cannot run against a write RPC without '
  'mutating). This §5.1 literal-absence check stays as a second, independent, non-mutating proof '
  'that the code is never hardcoded in the CALLING function''s own body either.');

select ok(not pg_temp.body_mentions_code('public.sign_meeting', 'commission.meetings.minutes.sign'),
  '5.2 `public.sign_meeting` also does not consult its own code as a literal — the live '
  'DIFFERENTIAL (2.6f-style SELECT-count pair) is NOT attempted here because it WRITES '
  '(`provolatile = ''v''`); §6 below is its live BEHAVIOURAL coverage instead (F2, this round), '
  'exercised through the real RPC and the real `meeting_signatures_insert` policy — this '
  'assertion remains its static-only, non-mutating literal-absence proof.');

select is((select count(*)::int from pg_temp.f425_results where phase in ('before','after','restored') and sig is null and kind in ('function','registry')),
  (select count(*)::int from f425_sites where kind in ('function','registry') and site in (
      'public.cast_case_vote','public.create_referral_internal_note','public.notify_safety_event',
      'public.get_referral_case_access_summary','public.sign_meeting')) * 3,
  '5.3 DISCRIMINATION CONTROL for the NULL-signature convention: exactly the 5 named-skip '
  'DEFINER sites (× 3 phases: before/after/restored) came back NULL from `pg_temp.site_signature` '
  '— not a wider set silently swallowed by the same NULL path, and not fewer (which would mean '
  'one of the 5 was accidentally live-probed with no fixture, the exact trap the header names). '
  '⭐⭐ RE-DERIVED 2026-09-15 (L34, F1): was 9 (×3=27) before the fixture gap closed; '
  '`get_standard_assessment`/`readiness_evidence`/`readiness_report`/`can_read_referral_internal_'
  'note` moved OUT of the NULL-returning set (header + §2 above) and into live probing, leaving '
  'only the 5 volatile writers (×3=15) still short-circuited to NULL HERE — §6 below is where '
  'their live coverage now lives (F2, this round), through the real door, never through '
  '`pg_temp.site_signature`''s SELECT-count shape.');

-- ============================================================================
-- §6 — F2: BEHAVIOURAL GRANT-DELETION PROBES for the seven write-path sites §2/§3 could
-- not exercise as a SELECT `count(*)` probe: two INSERT/WITH-CHECK policies
-- (`responses_insert_own`, `meeting_signatures_insert`) and five DEFINER writers
-- (`cast_case_vote`, `create_referral_internal_note`, `notify_safety_event`,
-- `get_referral_case_access_summary`, `sign_meeting`). External QA review F2
-- (`docs/reviews/ae5-staff-review.md`): §5's static absence-of-literal check proves the
-- code is not hardcoded in the caller — it proves NOTHING about whether the caller
-- actually ENFORCES the callee's answer. This section is the missing behavioural half:
-- allow (grant present) -> DELETE the ONE role_permissions row governing the site -> deny
-- through the REAL door with its EXACT SQLSTATE -> RESTORE -> allow again — for each site,
-- on a target the SAME operation cannot re-use to fake a denial (a duplicate vote/
-- signature raises a DIFFERENT code, never confused with 42501/HC036 here) — PLUS a
-- discrimination half proving each denial assertion is capable of going RED (LESSONS.md:
-- "a negative control cannot see a dead instrument").
--
-- Fixture note (report to the lead, `docs/testing/ae5-staff-fixture-gaps.md` § 10): seed.sql
-- carries ZERO `case_decisions` rows anywhere on this stack (live-measured this round,
-- `select count(*) from public.case_decisions` = 0) — a genuine, pre-existing fixture gap
-- (already flagged, unresolved, as row 12 of that doc's § 6). `cast_case_vote`'s own first
-- business check (`decisão não encontrada`, P0002) can never be reached without one, so §6.0
-- below supplies a self-contained fixture (one ethics-typed CCIH case + two decisions) via
-- bare DML in THIS suite's own transaction — never `seed.sql`, same idiom `254_ethics_e2_
-- votes.sql` already uses for its own bootstrap fixture, and the same "bare DML, proven
-- landed, never a SAVEPOINT" discipline this file's own header already commits to.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- §6.0 — the `cast_case_vote` fixture: a CCIH ethics case + two decisions, via bare DML
-- (this suite's own transaction; `staff4.ccih` is a REAL, already-seeded CCIH member —
-- only the case/decisions are fixture-created, never a new principal or membership).
-- ---------------------------------------------------------------------------

insert into public.cases
  (id, commission_id, case_number, created_by, organization_id, visibility_policy, confidentiality_level)
values
  ('a5fc0000-0000-0000-0000-0000000000f1', (select ccih_cid from f425), 701,
   (select p.id from public.profiles p where p.email = 'chefe.ccih@test.local'),
   (select c.organization_id from public.commissions c where c.id = (select ccih_cid from f425)),
   'commission_default', 'ethics_investigation');

insert into public.ethics_case_details (case_id) values ('a5fc0000-0000-0000-0000-0000000000f1');

insert into public.case_decisions (id, case_id, decision_type, summary_md, status) values
  ('a5fc0000-0000-0000-0000-0000000000f2', 'a5fc0000-0000-0000-0000-0000000000f1', 'ethics_ruling',
   'F2 §6 fixture decision A (the BEFORE-phase target).', 'proposed'),
  ('a5fc0000-0000-0000-0000-0000000000f3', 'a5fc0000-0000-0000-0000-0000000000f1', 'ethics_ruling',
   'F2 §6 fixture decision B (the deny/restore/discrimination-cycle target).', 'proposed');

select is((select count(*)::int from public.case_decisions where case_id = 'a5fc0000-0000-0000-0000-0000000000f1'), 2,
  '6.0 FIXTURE CONTROL: the §6.0 ethics-case fixture landed — exactly 2 decisions, on a case '
  'the CATALOG (not this suite'' own say-so) confirms staff4.ccih can vote on cleanly (0.0b '
  'below), never a third, fourth, or zero.');

select ok(
  not app.is_recused_from_case('a5fc0000-0000-0000-0000-0000000000f1', (select staff_uid from f425))
  and not app.is_case_respondent('a5fc0000-0000-0000-0000-0000000000f1', (select staff_uid from f425))
  and (select count(*)::int from public.ethics_case_details where case_id = 'a5fc0000-0000-0000-0000-0000000000f1') = 1,
  '6.0b FIXTURE CONTROL: staff4.ccih is CLEAN on the fixture case (not recused, not '
  'respondent — both structurally guaranteed by construction, since no `case_recusals`/'
  '`ethics_allegations` row can reference an id that did not exist before this transaction, '
  'but asserted rather than assumed) and the case is genuinely ethics-typed — so `cast_case_'
  'vote`''s (c) and (e) checks pass regardless of the (d) authority check §6 exists to probe, '
  'making the grant the ONLY variable.');

-- ---------------------------------------------------------------------------
-- §6.1-6.5 — the structural cycle, all seven sites, driven off one dispatch table.
-- ---------------------------------------------------------------------------

create temp table f425_f2_sites (site text, code text, expected_sqlstate text, target_before text, target_cycle text) on commit drop;
insert into f425_f2_sites (site, code, expected_sqlstate, target_before, target_cycle) values
  ('cast_case_vote', 'commission.cases.vote', '42501',
   'a5fc0000-0000-0000-0000-0000000000f2', 'a5fc0000-0000-0000-0000-0000000000f3'),
  -- `create_referral_internal_note`/`notify_safety_event`/`get_referral_case_access_summary`
  -- carry NO uniqueness constraint on their target (a fresh note/event row every call; the
  -- read-only summary has none at all) — `target_before`/`target_cycle` are unused (the
  -- dispatch function below resolves `f425r`/`f425` directly), kept NULL rather than a
  -- placeholder id that would silently look load-bearing.
  ('create_referral_internal_note', 'commission.referrals.notes.author', '42501', null, null),
  ('notify_safety_event', 'commission.safety_events.report', '42501', null, null),
  ('get_referral_case_access_summary', 'commission.referrals.metadata.read', '42501', null, null),
  -- `sign_meeting` and `meeting_signatures_insert` share ONE seeded eligible attendee
  -- (`a5f30000-…-a2` — the SAME F3-pinned fixture; live-measured this round, it is the ONLY
  -- present/`in_signature`/unsigned attendee row for staff4.ccih anywhere on the stack under
  -- role `staff` — a genuine scarcity, not a suite shortcut). `pg_temp.f2_cleanup` below
  -- deletes the signature (and, for the RPC path, reverts the meeting''s auto-flipped status)
  -- between every use, so the SAME row is safe to reuse sequentially — never concurrently,
  -- never across sites without an intervening cleanup, both of which this file''s own linear
  -- `do` block already guarantees.
  ('sign_meeting', 'commission.meetings.minutes.sign', 'HC036',
   'a5f30000-0000-0000-0000-0000000000a2', 'a5f30000-0000-0000-0000-0000000000a2'),
  ('meeting_signatures_insert', 'commission.meetings.minutes.sign', '42501',
   'a5f30000-0000-0000-0000-0000000000a2', 'a5f30000-0000-0000-0000-0000000000a2'),
  -- `responses_insert_own`: Rule 3's "one `in_progress` draft per user/version" partial
  -- unique index means the SAME form_version is only reusable if the prior draft is deleted
  -- first — `pg_temp.f2_cleanup` does exactly that via the table''s own `responses_delete_
  -- own_draft` policy (self, `in_progress` only), never a superuser bypass of RLS on the
  -- CLEANUP path either.
  ('responses_insert_own', 'commission.responses.create', '42501',
   '50000000-0000-0000-0000-00000000a001', '50000000-0000-0000-0000-00000000a001');
grant select on f425_f2_sites to authenticated;

select is((select count(*)::int from f425_f2_sites), 7,
  '6.1a THE DECLARED F2 SITE COUNT: exactly seven, matching the review''s own list '
  '(`docs/reviews/ae5-staff-review.md` F2) — two INSERT policies + five DEFINER writers.');

-- The dispatch function attempts ONE write operation for ONE site and returns its outcome
-- as text: `OK:<returned identifier>` (a genuine row landed — the identifier is `RETURNING`-
-- captured or the function''s own `.id`, never merely "no exception was raised") or
-- `RAISE:<sqlstate>` (trapped, never left to abort the whole file — same discipline as
-- `pg_temp.site_signature`''s own trap in §2).
create or replace function pg_temp.f2_attempt(p_site text, p_target text)
returns text language plpgsql as $f2a$
declare
  v_result text;
  v_sqlstate text;
  v_uid uuid := (select staff_uid from f425);
  v_cid uuid := (select ccih_cid from f425);
  v_id uuid;
  v_jsonb jsonb;
begin
  begin
    case p_site
      when 'cast_case_vote' then
        select public.cast_case_vote(p_target::uuid, 'approve', 'F2 §6 probe vote') into v_id;
        v_result := 'OK:' || v_id::text;
      when 'create_referral_internal_note' then
        select (public.create_referral_internal_note((select referral_id from f425r), v_cid,
                  'F2 §6 probe note body.')).id into v_id;
        v_result := 'OK:' || v_id::text;
      when 'notify_safety_event' then
        select (public.notify_safety_event(v_cid, 'F2 §6 probe event')).id into v_id;
        v_result := 'OK:' || v_id::text;
      when 'get_referral_case_access_summary' then
        select public.get_referral_case_access_summary((select referral_id from f425r), v_cid) into v_jsonb;
        v_result := 'OK:' || coalesce(v_jsonb->>'case_id', 'null');
      when 'sign_meeting' then
        select (public.sign_meeting(p_target::uuid, 'internal_eauth', 'F2 §6 probe')).id into v_id;
        v_result := 'OK:' || v_id::text;
      when 'meeting_signatures_insert' then
        -- The direct-INSERT door (invoker path), never the RPC — `sign_meeting` is
        -- SECURITY DEFINER and bypasses this table''s own RLS entirely (its own body says
        -- so), so this is the ONLY way to exercise `meeting_signatures_insert`''s own
        -- `with_check` as the actual member, not the function owner.
        insert into public.meeting_signatures (meeting_id, attendee_id, signer_id, method, status, content_hash, note)
        values ((select meeting_id from public.meeting_attendees where id = p_target::uuid), p_target::uuid,
                v_uid, 'internal_eauth', 'signed', 'f2probehash', 'F2 §6 probe direct insert')
        returning id into v_id;
        v_result := 'OK:' || v_id::text;
      when 'responses_insert_own' then
        insert into public.responses (form_version_id, commission_id, created_by)
        values (p_target::uuid, v_cid, v_uid)
        returning id into v_id;
        v_result := 'OK:' || v_id::text;
      else
        raise exception 'pg_temp.f2_attempt: unhandled site %', p_site;
    end case;
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    v_result := 'RAISE:' || v_sqlstate;
  end;
  return v_result;
end;
$f2a$;

grant execute on function pg_temp.f2_attempt(text, text) to authenticated;

-- Resets a site''s consumed target back to "virgin" between phases (bare DML, superuser —
-- the SAME idiom this file already uses for `authz.role_permissions` itself). A no-op for
-- the three sites with no uniqueness constraint.
create or replace function pg_temp.f2_cleanup(p_site text, p_target text) returns void
language plpgsql as $f2c$
begin
  case p_site
    when 'cast_case_vote' then
      delete from public.case_votes where decision_id = p_target::uuid and voter_id = (select staff_uid from f425);
    when 'meeting_signatures_insert' then
      delete from public.meeting_signatures where attendee_id = p_target::uuid;
    when 'sign_meeting' then
      delete from public.meeting_signatures where attendee_id = p_target::uuid;
      -- The auto-flip inside `sign_meeting` (required=1 for THIS attendee''s meeting —
      -- live-measured) advances status to ''signed''; `app.guard_meeting_status` only
      -- allows ''signed''->''distributed''/''held'' (never straight back to ''in_signature''),
      -- so the revert goes through the SAME two-hop path the guard''s own transition graph
      -- allows, under the RPC flag the guard itself checks (`app.in_meeting_rpc`) — never a
      -- direct UPDATE the guard would reject with `check_violation`.
      perform set_config('app.in_meeting_rpc', 'on', true);
      update public.meetings set status = 'held'
       where id = (select meeting_id from public.meeting_attendees where id = p_target::uuid) and status = 'signed';
      update public.meetings set status = 'in_signature'
       where id = (select meeting_id from public.meeting_attendees where id = p_target::uuid) and status = 'held';
      perform set_config('app.in_meeting_rpc', 'off', true);
    when 'responses_insert_own' then
      delete from public.responses
       where form_version_id = p_target::uuid and created_by = (select staff_uid from f425) and status = 'in_progress';
    else
      null;
  end case;
end;
$f2c$;

create table pg_temp.f425_f2_results (site text, phase text, result text) on commit drop;
grant select, insert on pg_temp.f425_f2_results to authenticated;

do $$
declare
  v_site record;
  v_del int; v_ins int;
  v_r text;
begin
  for v_site in select * from f425_f2_sites order by site loop
    -- BEFORE: grant present, the operation must SUCCEED as staff4.ccih.
    perform test_helpers.reset_role_and_claims();
    perform test_helpers.claims_for((select staff_uid from f425), false, 'staff');
    set local role authenticated;
    v_r := pg_temp.f2_attempt(v_site.site, v_site.target_before);
    reset role;
    insert into pg_temp.f425_f2_results values (v_site.site, 'before', v_r);
    perform pg_temp.f2_cleanup(v_site.site, v_site.target_before);

    -- DELETE the ONE role_permissions row governing this site''s code.
    delete from authz.role_permissions where role_code = 'staff' and permission_code = v_site.code;
    get diagnostics v_del = row_count;
    insert into pg_temp.f425_f2_results values (v_site.site, 'grant_deleted_count', v_del::text);

    -- DENIED: the SAME operation, through the REAL door, on a target this SAME site has
    -- never touched before (never the `target_before` row) — so a unique-violation state
    -- guard (HC0J4/HC035) can never be mistaken for the authority denial this asserts.
    perform test_helpers.reset_role_and_claims();
    perform test_helpers.claims_for((select staff_uid from f425), false, 'staff');
    set local role authenticated;
    v_r := pg_temp.f2_attempt(v_site.site, v_site.target_cycle);
    reset role;
    insert into pg_temp.f425_f2_results values (v_site.site, 'denied', v_r);
    perform pg_temp.f2_cleanup(v_site.site, v_site.target_cycle);  -- no-op unless the denial wrongly landed a row

    -- RESTORE.
    insert into authz.role_permissions (role_code, permission_code) values ('staff', v_site.code);
    get diagnostics v_ins = row_count;
    insert into pg_temp.f425_f2_results values (v_site.site, 'grant_restored_count', v_ins::text);

    -- AFTER: the SAME operation SUCCEEDS again, on the now-cleaned `target_cycle` row.
    perform test_helpers.reset_role_and_claims();
    perform test_helpers.claims_for((select staff_uid from f425), false, 'staff');
    set local role authenticated;
    v_r := pg_temp.f2_attempt(v_site.site, v_site.target_cycle);
    reset role;
    insert into pg_temp.f425_f2_results values (v_site.site, 'after', v_r);
    perform pg_temp.f2_cleanup(v_site.site, v_site.target_cycle);
  end loop;
end $$;

select is((select count(*)::int from pg_temp.f425_f2_results where phase = 'before' and result like 'OK:%'), 7,
  '6.1 BEFORE: all seven sites'' operation SUCCEEDED as staff4.ccih with the grant present — '
  'each `OK:<id>` a genuine `RETURNING`/`.id`-captured identifier, not merely "raised nothing".');

select is((select count(*)::int from pg_temp.f425_f2_results where phase = 'grant_deleted_count' and result = '1'), 7,
  '6.2 the mutation landed at all seven sites'' governing code — one row deleted each time, '
  'asserted, never assumed (same discipline as §2.1 / 409 §2.7 / 424 §6.1).');

select is((
  select count(*)::int from pg_temp.f425_f2_results r join f425_f2_sites s using (site)
   where r.phase = 'denied' and r.result = 'RAISE:' || s.expected_sqlstate
), 7,
  '6.3 ⭐⭐ DENIED: all seven sites refused the SAME operation through the REAL door once the '
  'grant was gone, each with its OWN expected SQLSTATE — 42501 for six sites, `HC036` for '
  '`sign_meeting` (its own explicit re-check, since it is SECURITY DEFINER and bypasses the '
  'table''s RLS entirely, raises a DIFFERENT code than the direct-insert policy path does for '
  'the SAME underlying grant). Never a generic catch-all, and never confused with a state '
  'guard (`HC0J4` double-vote, `HC035` double-sign) firing on a reused target, since every '
  'denial target above is a target this site has never touched before this cycle.');

select is((select count(*)::int from pg_temp.f425_f2_results where phase = 'grant_restored_count' and result = '1'), 7,
  '6.4 the restore INSERT landed exactly once per site, all seven.');

select is((select count(*)::int from pg_temp.f425_f2_results where phase = 'after' and result like 'OK:%'), 7,
  '6.5 AFTER: all seven sites'' operation SUCCEEDED AGAIN once the grant was restored — the '
  'full allow -> deny -> allow cycle, proven through the real door on real fixture rows, '
  'never a static literal check standing in for enforcement.');

-- ---------------------------------------------------------------------------
-- §6.6 — THE DISCRIMINATION HALF. Each denial assertion above must be able to go RED, or
-- it proves nothing (LESSONS.md: "a negative control cannot see a dead instrument"). For
-- each site, its OWN authority check is neutered (`X` -> `false and X`, the identical
-- minimal-diff idiom the external reviewer used to demonstrate F2 in the first place —
-- `docs/reviews/ae5-staff-review.md`'s own "Mutation witness") INSIDE this suite's own
-- transaction — never a SAVEPOINT (which would discard the pgTAP assertions already
-- recorded above it, LESSONS.md), but plain DDL, which IS transactional and is undone by
-- this file's own trailing `rollback;` — the exact idiom 424 §6's own
-- `authz.candidate_has_permission` fail-proof already uses on a live catalog function.
-- The grant is deleted AGAIN and the SAME operation is attempted on a target §6.1-6.5 has
-- already cleaned: with the check neutered, it now WRONGLY SUCCEEDS. The function/policy
-- is restored via its ORIGINAL definition CAPTURED LIVE at the top of each site's cycle
-- (`pg_get_functiondef`/`pg_policies.with_check`), never hand-retyped — "migration file
-- text is stale, read pg_proc" (LESSONS.md).
-- ---------------------------------------------------------------------------

create table pg_temp.f425_f2_disc (site text, step text, ok boolean, detail text) on commit drop;
grant select, insert on pg_temp.f425_f2_disc to authenticated;

do $$
declare
  v_orig text; v_neutered text; v_r text; v_check boolean;
  v_orig_check text; v_neutered_check text;
  v_orig_rd text;
begin
  -- ---- cast_case_vote ----
  v_orig := pg_get_functiondef('public.cast_case_vote'::regproc);
  v_neutered := replace(v_orig,
    'if not app.can_cases_vote(v_commission, auth.uid()) then',
    'if false and not app.can_cases_vote(v_commission, auth.uid()) then');
  insert into pg_temp.f425_f2_disc values ('cast_case_vote', 'operands_differ', v_neutered is distinct from v_orig, null);
  execute v_neutered;
  select count(*) = 1 into v_check from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'cast_case_vote'
     and position('if false and not app.can_cases_vote' in p.prosrc) > 0;
  insert into pg_temp.f425_f2_disc values ('cast_case_vote', 'neutered_applied', v_check, null);

  delete from authz.role_permissions where role_code = 'staff' and permission_code = 'commission.cases.vote';
  perform test_helpers.reset_role_and_claims();
  perform test_helpers.claims_for((select staff_uid from f425), false, 'staff');
  set local role authenticated;
  v_r := pg_temp.f2_attempt('cast_case_vote', 'a5fc0000-0000-0000-0000-0000000000f3');
  reset role;
  insert into pg_temp.f425_f2_disc values ('cast_case_vote', 'goes_red', v_r like 'OK:%', v_r);
  perform pg_temp.f2_cleanup('cast_case_vote', 'a5fc0000-0000-0000-0000-0000000000f3');
  insert into authz.role_permissions (role_code, permission_code) values ('staff', 'commission.cases.vote');

  execute v_orig;
  select (pg_get_functiondef('public.cast_case_vote'::regproc) = v_orig) into v_check;
  insert into pg_temp.f425_f2_disc values ('cast_case_vote', 'restored', v_check, null);

  -- ---- create_referral_internal_note ----
  v_orig := pg_get_functiondef('public.create_referral_internal_note'::regproc);
  v_neutered := replace(v_orig,
    'not app.can_referrals_notes_author(p_committee_id, auth.uid())',
    '(false and not app.can_referrals_notes_author(p_committee_id, auth.uid()))');
  insert into pg_temp.f425_f2_disc values ('create_referral_internal_note', 'operands_differ', v_neutered is distinct from v_orig, null);
  execute v_neutered;
  select count(*) = 1 into v_check from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_referral_internal_note'
     and position('(false and not app.can_referrals_notes_author(p_committee_id, auth.uid()))' in p.prosrc) > 0;
  insert into pg_temp.f425_f2_disc values ('create_referral_internal_note', 'neutered_applied', v_check, null);

  delete from authz.role_permissions where role_code = 'staff' and permission_code = 'commission.referrals.notes.author';
  perform test_helpers.reset_role_and_claims();
  perform test_helpers.claims_for((select staff_uid from f425), false, 'staff');
  set local role authenticated;
  v_r := pg_temp.f2_attempt('create_referral_internal_note', null);
  reset role;
  insert into pg_temp.f425_f2_disc values ('create_referral_internal_note', 'goes_red', v_r like 'OK:%', v_r);
  insert into authz.role_permissions (role_code, permission_code) values ('staff', 'commission.referrals.notes.author');

  execute v_orig;
  select (pg_get_functiondef('public.create_referral_internal_note'::regproc) = v_orig) into v_check;
  insert into pg_temp.f425_f2_disc values ('create_referral_internal_note', 'restored', v_check, null);

  -- ---- notify_safety_event ----
  v_orig := pg_get_functiondef('public.notify_safety_event'::regproc);
  v_neutered := replace(v_orig,
    'not (app.can_safety_events_report(p_reporting_commission_id, (select auth.uid())))',
    '(false and not (app.can_safety_events_report(p_reporting_commission_id, (select auth.uid()))))');
  insert into pg_temp.f425_f2_disc values ('notify_safety_event', 'operands_differ', v_neutered is distinct from v_orig, null);
  execute v_neutered;
  select count(*) = 1 into v_check from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'notify_safety_event'
     and position('(false and not (app.can_safety_events_report' in p.prosrc) > 0;
  insert into pg_temp.f425_f2_disc values ('notify_safety_event', 'neutered_applied', v_check, null);

  delete from authz.role_permissions where role_code = 'staff' and permission_code = 'commission.safety_events.report';
  perform test_helpers.reset_role_and_claims();
  perform test_helpers.claims_for((select staff_uid from f425), false, 'staff');
  set local role authenticated;
  v_r := pg_temp.f2_attempt('notify_safety_event', null);
  reset role;
  insert into pg_temp.f425_f2_disc values ('notify_safety_event', 'goes_red', v_r like 'OK:%', v_r);
  insert into authz.role_permissions (role_code, permission_code) values ('staff', 'commission.safety_events.report');

  execute v_orig;
  select (pg_get_functiondef('public.notify_safety_event'::regproc) = v_orig) into v_check;
  insert into pg_temp.f425_f2_disc values ('notify_safety_event', 'restored', v_check, null);

  -- ---- get_referral_case_access_summary ----
  -- ⭐⭐ THREE call sites, not one, share this code's downstream reach for THIS specific
  -- probe: (1) the RPC's own authority IF (neutered below), and its own closing
  -- `log_audit_access('referral.case_access_summary_viewed', ...)` call, which (2)
  -- re-enforces via `app._audit_access_authorized`'s OWN arm for that action
  -- (`is_member_of_for(...) AND can_read_referral(...)` — a SEPARATE, already live-
  -- differentially-tested `f425_sites` row, `registry` kind), which itself calls (3)
  -- `app.can_read_referral` -> `can_read_referral_metadata`'s source-side disjunct, the
  -- SAME code again. Neutering only (1) still correctly denies via (2)/(3) — a genuine
  -- defence-in-depth finding, not a suite bug — so THIS discrimination-half additionally
  -- neuters `app.can_read_referral` (shared by both (1) and (2)) to isolate (1)'s own
  -- check as the question being asked; it is restored alongside (1) below.
  v_orig_rd := pg_get_functiondef('app.can_read_referral'::regproc);
  execute replace(v_orig_rd, 'select app.can_read_referral_metadata(p_referral_id, p_uid);', 'select true;');

  v_orig := pg_get_functiondef('public.get_referral_case_access_summary'::regproc);
  v_neutered := replace(replace(v_orig,
    'not app.can_referrals_metadata_read(p_commission_id, auth.uid())',
    '(false and not app.can_referrals_metadata_read(p_commission_id, auth.uid()))'),
    'not app.can_read_referral(p_referral_id, auth.uid())',
    '(false and not app.can_read_referral(p_referral_id, auth.uid()))');
  insert into pg_temp.f425_f2_disc values ('get_referral_case_access_summary', 'operands_differ', v_neutered is distinct from v_orig, null);
  execute v_neutered;
  select count(*) = 1 into v_check from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_referral_case_access_summary'
     and position('(false and not app.can_referrals_metadata_read' in p.prosrc) > 0;
  insert into pg_temp.f425_f2_disc values ('get_referral_case_access_summary', 'neutered_applied', v_check, null);

  delete from authz.role_permissions where role_code = 'staff' and permission_code = 'commission.referrals.metadata.read';
  perform test_helpers.reset_role_and_claims();
  perform test_helpers.claims_for((select staff_uid from f425), false, 'staff');
  set local role authenticated;
  v_r := pg_temp.f2_attempt('get_referral_case_access_summary', null);
  reset role;
  insert into pg_temp.f425_f2_disc values ('get_referral_case_access_summary', 'goes_red', v_r like 'OK:%', v_r);
  insert into authz.role_permissions (role_code, permission_code) values ('staff', 'commission.referrals.metadata.read');

  execute v_orig;
  execute v_orig_rd;
  select (pg_get_functiondef('public.get_referral_case_access_summary'::regproc) = v_orig
          and pg_get_functiondef('app.can_read_referral'::regproc) = v_orig_rd) into v_check;
  insert into pg_temp.f425_f2_disc values ('get_referral_case_access_summary', 'restored', v_check, null);

  -- ---- sign_meeting ----
  v_orig := pg_get_functiondef('public.sign_meeting'::regproc);
  v_neutered := replace(v_orig,
    'if not app.can_sign_meeting(p_attendee_id, v_uid) then',
    'if false and not app.can_sign_meeting(p_attendee_id, v_uid) then');
  insert into pg_temp.f425_f2_disc values ('sign_meeting', 'operands_differ', v_neutered is distinct from v_orig, null);
  execute v_neutered;
  select count(*) = 1 into v_check from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'sign_meeting' and position('if false and not app.can_sign_meeting' in p.prosrc) > 0;
  insert into pg_temp.f425_f2_disc values ('sign_meeting', 'neutered_applied', v_check, null);

  delete from authz.role_permissions where role_code = 'staff' and permission_code = 'commission.meetings.minutes.sign';
  perform test_helpers.reset_role_and_claims();
  perform test_helpers.claims_for((select staff_uid from f425), false, 'staff');
  set local role authenticated;
  v_r := pg_temp.f2_attempt('sign_meeting', 'a5f30000-0000-0000-0000-0000000000a2');
  reset role;
  insert into pg_temp.f425_f2_disc values ('sign_meeting', 'goes_red', v_r like 'OK:%', v_r);
  perform pg_temp.f2_cleanup('sign_meeting', 'a5f30000-0000-0000-0000-0000000000a2');
  insert into authz.role_permissions (role_code, permission_code) values ('staff', 'commission.meetings.minutes.sign');

  execute v_orig;
  select (pg_get_functiondef('public.sign_meeting'::regproc) = v_orig) into v_check;
  insert into pg_temp.f425_f2_disc values ('sign_meeting', 'restored', v_check, null);

  -- ---- meeting_signatures_insert (POLICY — captured/restored live, never hand-retyped) ----
  select with_check into v_orig_check from pg_policies
   where schemaname = 'public' and tablename = 'meeting_signatures' and policyname = 'meeting_signatures_insert';
  v_neutered_check := replace(v_orig_check,
    ' AND app.can_sign_meeting(attendee_id, ( SELECT auth.uid() AS uid))', '');
  insert into pg_temp.f425_f2_disc values ('meeting_signatures_insert', 'operands_differ', v_neutered_check is distinct from v_orig_check, v_neutered_check);
  execute format('alter policy meeting_signatures_insert on public.meeting_signatures with check (%s)', v_neutered_check);
  select with_check not like '%can_sign_meeting%' into v_check from pg_policies
   where schemaname = 'public' and tablename = 'meeting_signatures' and policyname = 'meeting_signatures_insert';
  insert into pg_temp.f425_f2_disc values ('meeting_signatures_insert', 'neutered_applied', v_check, null);

  delete from authz.role_permissions where role_code = 'staff' and permission_code = 'commission.meetings.minutes.sign';
  perform test_helpers.reset_role_and_claims();
  perform test_helpers.claims_for((select staff_uid from f425), false, 'staff');
  set local role authenticated;
  v_r := pg_temp.f2_attempt('meeting_signatures_insert', 'a5f30000-0000-0000-0000-0000000000a2');
  reset role;
  insert into pg_temp.f425_f2_disc values ('meeting_signatures_insert', 'goes_red', v_r like 'OK:%', v_r);
  perform pg_temp.f2_cleanup('meeting_signatures_insert', 'a5f30000-0000-0000-0000-0000000000a2');
  insert into authz.role_permissions (role_code, permission_code) values ('staff', 'commission.meetings.minutes.sign');

  execute format('alter policy meeting_signatures_insert on public.meeting_signatures with check (%s)', v_orig_check);
  select (with_check = v_orig_check) into v_check from pg_policies
   where schemaname = 'public' and tablename = 'meeting_signatures' and policyname = 'meeting_signatures_insert';
  insert into pg_temp.f425_f2_disc values ('meeting_signatures_insert', 'restored', v_check, null);

  -- ---- responses_insert_own (POLICY — captured/restored live, never hand-retyped) ----
  select with_check into v_orig_check from pg_policies
   where schemaname = 'public' and tablename = 'responses' and policyname = 'responses_insert_own';
  v_neutered_check := replace(v_orig_check,
    ' AND app.can_responses_create(commission_id, ( SELECT auth.uid() AS uid))', '');
  insert into pg_temp.f425_f2_disc values ('responses_insert_own', 'operands_differ', v_neutered_check is distinct from v_orig_check, v_neutered_check);
  execute format('alter policy responses_insert_own on public.responses with check (%s)', v_neutered_check);
  select with_check not like '%can_responses_create%' into v_check from pg_policies
   where schemaname = 'public' and tablename = 'responses' and policyname = 'responses_insert_own';
  insert into pg_temp.f425_f2_disc values ('responses_insert_own', 'neutered_applied', v_check, null);

  delete from authz.role_permissions where role_code = 'staff' and permission_code = 'commission.responses.create';
  perform test_helpers.reset_role_and_claims();
  perform test_helpers.claims_for((select staff_uid from f425), false, 'staff');
  set local role authenticated;
  v_r := pg_temp.f2_attempt('responses_insert_own', '50000000-0000-0000-0000-00000000a001');
  reset role;
  insert into pg_temp.f425_f2_disc values ('responses_insert_own', 'goes_red', v_r like 'OK:%', v_r);
  perform pg_temp.f2_cleanup('responses_insert_own', '50000000-0000-0000-0000-00000000a001');
  insert into authz.role_permissions (role_code, permission_code) values ('staff', 'commission.responses.create');

  execute format('alter policy responses_insert_own on public.responses with check (%s)', v_orig_check);
  select (with_check = v_orig_check) into v_check from pg_policies
   where schemaname = 'public' and tablename = 'responses' and policyname = 'responses_insert_own';
  insert into pg_temp.f425_f2_disc values ('responses_insert_own', 'restored', v_check, null);
end $$;

select is((select count(*)::int from pg_temp.f425_f2_disc where step = 'operands_differ' and ok), 7,
  '6.6a OPERANDS-DIFFER PRECONDITION: all seven neutered bodies/policies are textually '
  'DIFFERENT from their captured originals — never comparing a thing with itself '
  '(LESSONS.md).');

select is((select count(*)::int from pg_temp.f425_f2_disc where step = 'neutered_applied' and ok), 7,
  '6.6b the neutralization landed at all seven sites, confirmed by reading the LIVE catalog '
  'back (never assumed from the `execute` succeeding).');

select is((select count(*)::int from pg_temp.f425_f2_disc where step = 'goes_red' and ok), 7,
  '6.6c ⭐⭐ THE DISCRIMINATION HALF: with each site''s OWN authority check neutered, the SAME '
  'operation that §6.3 showed DENIED now WRONGLY SUCCEEDS — proving every denial assertion '
  'above is a live instrument, not a dead one. Each attempt ran with the grant freshly '
  'deleted again, on a target §6.1-6.5''s own cleanup already returned to virgin, never a '
  'reused/still-consumed target.');

select is((select count(*)::int from pg_temp.f425_f2_disc where step = 'restored' and ok), 7,
  '6.6d every neutered function/policy reads back BYTE-IDENTICAL to its captured original — '
  'the restore is proven, not assumed (409 §2.16 / 424 §6.2 idiom).');

select * from finish();
rollback;

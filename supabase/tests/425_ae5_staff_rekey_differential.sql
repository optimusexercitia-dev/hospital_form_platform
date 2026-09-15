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
-- ⛔ SCOPE CUT, NAMED RATHER THAN HIDDEN — 9 of the 25 distinct DEFINER functions are NOT called
-- live this round:
--   (a) FIVE are `provolatile = 'v'` (write / audit-logging side effects): `public.cast_case_vote`,
--       `public.create_referral_internal_note`, `public.notify_safety_event`,
--       `public.sign_meeting`, `public.get_referral_case_access_summary` (the last one reads but
--       is itself PHI-audit-logged on every call — Rule 11 — so calling it repeatedly writes rows
--       this suite has no business creating). Calling any of these blind, with no live-execution
--       spec from the manifest, risks a real mutation on the shared local stack — the exact
--       category `docs/lead-playbook.md` and this session's whole discipline treat as
--       "modify shared resources", never done without an explicit rollback-safe plan.
--   (b) FOUR are blocked by a genuine FIXTURE GAP, not a suite defect: `public.get_standard_
--       assessment`, `public.readiness_evidence`, `public.readiness_report` all require a real
--       `accreditation_standards.id`, and `app.can_read_referral_internal_note` requires a real
--       `referral_internal_notes.id` — BOTH tables are EMPTY on the seeded local stack (measured
--       this round: `select count(*) from public.accreditation_standards` = 0, `select count(*)
--       from public.referral_internal_notes` = 0). Filed as a new row in
--       `docs/testing/ae5-staff-fixture-gaps.md` (T13's register) rather than fabricated with a
--       nonexistent uuid, which would assert a denial for "no such row" and not for authority.
-- All NINE are still covered by the STATIC half (§3): a `prosrc` literal-string search for the
-- code, the same technique 409 §1.1/§1.3 uses for its own attribution table — it needs no
-- fixture and cannot mutate anything, so it stands in for the live pair without weakening the
-- "is the code consulted anywhere" question the whole file exists to answer.
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
select plan(21);

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
  (select id from public.meetings where commission_id = (select ccih_cid from f425) limit 1)              as meeting_id,
  (select id from public.action_items where commission_id = (select ccih_cid from f425) limit 1)           as action_item_id,
  (select id from public.cases where commission_id = (select ccih_cid from f425) limit 1)                  as case_id,
  -- ⛔ MUST be `source = 'indicator'`: `app.can_read_capa` has THREE disjuncts (PQS-operator,
  -- event-linked, and the indicator-sourced arm THIS suite's code, `commission.capa.read`,
  -- actually gates — matches the manifest's own "the indicator-sourced arm" label). A capa
  -- fixture with ANY other `source` (this hospital also seeds `rca` and `manual`) is reachable
  -- via a DIFFERENT, code-independent disjunct and would never discriminate under this file's
  -- deletion — measured live 2026-09-14 on the post-T7 catalog (`ca000000-…-a3`, `source='rca'`,
  -- stayed `t`/`t`; `a5f70000-…-a1`, `source='indicator'`, correctly went `t`→`f`).
  (select id from public.capa_plan where hospital_id = (select ccih_hospital_id from f425)
     and source = 'indicator' limit 1)                                                                      as capa_id,
  (select cd.core_document_id from public.controlled_documents cd
     where cd.commission_id = (select ccih_cid from f425) limit 1)                                          as document_core_id,
  (select cv.id from public.controlled_document_versions cv join public.controlled_documents d on d.id = cv.document_id
     where d.commission_id = (select ccih_cid from f425) limit 1)                                           as document_version_id,
  (select id from public.accreditation_frameworks limit 1)                                                  as framework_id,
  (select id from public.indicators where commission_id = (select ccih_cid from f425) limit 1)              as indicator_id,
  (select id from public.patient_safety_event where reporting_commission_id = (select ccih_cid from f425) limit 1) as event_id,
  (select id from public.case_referral
     where source_commission_id = (select ccih_cid from f425) or target_commission_id = (select ccih_cid from f425)
     limit 1)                                                                                                as referral_id,
  (select ma.id from public.meeting_attendees ma join public.meetings mm on mm.id = ma.meeting_id
     where mm.commission_id = (select ccih_cid from f425) and ma.user_id = (select staff_uid from f425)
     limit 1)                                                                                                as attendee_id;

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
             and framework_id is not null and indicator_id is not null and event_id is not null
             and referral_id is not null and attendee_id is not null), 1,
  '0.2 FIXTURE CONTROL: every resource id this file probes resolved to a REAL CCIH row — none of '
  'the 69 sites'' probes runs against a fabricated uuid. ⛔ `accreditation_standards` and '
  '`referral_internal_notes` are DELIBERATELY ABSENT from this table: both are EMPTY on the '
  'seeded stack (measured 2026-09-14; count(*) = 0 for each), which is a FIXTURE GAP, filed in '
  '`docs/testing/ae5-staff-fixture-gaps.md`, not a suite defect — the 4 DEFINER functions needing '
  'those ids are covered by §3''s static check only (header names them).');

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
  -- NOT live-probed this round (see header): the 5 volatile writers + the 4 fixture-gapped reads.
  if p_site in ('public.cast_case_vote', 'public.create_referral_internal_note', 'public.notify_safety_event',
                'public.get_referral_case_access_summary', 'public.get_standard_assessment',
                'public.readiness_evidence', 'public.readiness_report', 'app.can_read_referral_internal_note',
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
select is((select count(*)::int from pg_temp.f425_results where phase = 'before' and sig is not null
            and site not in (
              'public.accreditation_standards.accreditation_standards_select',
              'public.evidence_links.evidence_links_select',
              'public.standard_assessments.standard_assessments_select',
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
              'public.accreditation_standards.accreditation_standards_select',
              'public.evidence_links.evidence_links_select',
              'public.standard_assessments.standard_assessments_select',
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
  'above — genuinely empty tables, not denials (measured as `postgres`, still 0).');

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
       'public.evidence_links.evidence_links_select',
       'public.case_tags.case_tags_select',
       'public.commission_charters.commission_charters_select',
       'public.form_item_validations.form_item_validations_select',
       'storage.objects.form_assets_select_member',
       'public.phase_results.phase_results_select',
       'public.process_template_phase_allowed_results.process_template_phase_allowed_results_select',
       'public.process_template_phase_offered_results.process_template_phase_offered_results_select',
       'public.standard_assessments.standard_assessments_select',
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
  '(a re-key regression), never widened further without a fresh live query naming the reason.');

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
  'before adding it to the excluded list, exactly as `can_read_capa` and these seven were.');

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
  '5.1 ⭐ STATIC TWIN OF §2/§3''s live half, for the 8 DEFINER functions not called live this '
  'round (the 9th, `public.sign_meeting`, is checked separately at 5.2 since its code is '
  '`commission.meetings.minutes.sign`, already covered live by its sibling `app.can_sign_meeting` '
  '— included here for completeness of the "code literal absent" claim). ZERO of these 8 function '
  'bodies contain their own governing permission code as a string literal — pre-T7, none of them '
  'consult the catalog either. ⛔ Same needle discipline as 409 §1.1: the code IS the literal, '
  'quotes included, `position` not a regex (permission codes contain `.`).');

select ok(not pg_temp.body_mentions_code('public.sign_meeting', 'commission.meetings.minutes.sign'),
  '5.2 `public.sign_meeting` also does not consult its own code as a literal — the live half '
  '(2.6f-style pair) is NOT attempted here because it WRITES (`provolatile = ''v''`); this is its '
  'static-only coverage.');

select is((select count(*)::int from pg_temp.f425_results where phase in ('before','after','restored') and sig is null and kind in ('function','registry')),
  (select count(*)::int from f425_sites where kind in ('function','registry') and site in (
      'public.cast_case_vote','public.create_referral_internal_note','public.notify_safety_event',
      'public.get_referral_case_access_summary','public.get_standard_assessment','public.readiness_evidence',
      'public.readiness_report','app.can_read_referral_internal_note','public.sign_meeting')) * 3,
  '5.3 DISCRIMINATION CONTROL for the NULL-signature convention: exactly the 9 named-skip '
  'DEFINER sites (× 3 phases: before/after/restored) came back NULL from `pg_temp.site_signature` '
  '— not a wider set silently swallowed by the same NULL path, and not fewer (which would mean '
  'one of the 9 was accidentally live-probed with no fixture, the exact trap the header names).');

select * from finish();
rollback;

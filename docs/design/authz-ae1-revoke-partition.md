# AE1.2 — RV0 revoke partition: PROCEED / HOLD / UNCHANGED

- **Task:** RV0 step 1 (`docs/design/authz-definer-classification-ae1.md`, `# LEAD RULINGS on
  the revoke set`), applied to the 233-function proposed revoke set from that classification's
  §7. Read-only: no migration, no `REVOKE`, no `db reset` was issued for this deliverable.
- **Governing property (RV0):** *"a revoke may not create sweep blindness."* **DELTA is the
  authoritative verdict** (lead ruling, 2026-08-27): HOLD means the revoke itself removes a
  domain membership that existed pre-revoke. A function that was never in any arm's domain is
  not made blind by this revoke — its observability is unchanged, not created and not destroyed.
- **Measured:** 2026-08-27, by `backend`, on the local stack, head **`20261003005300`** (484
  migrations registered == 484 on disk; last applied
  `20261003005300_adp_global_revoke_public_execute.sql`). ⚠ **This is a LATER head than the one
  this file's planning text was written against (`20261003004400`)** — AE1.3's person doors and
  AE1.5's policy edits have since landed. Per the file's own rule, every number in §5 is
  **re-derived fresh at `…5300`**, not patched onto the earlier draft's arithmetic; the `…4400`
  framing has been removed rather than carried forward. Re-derive again from scratch if the
  catalog moves.
- ⛔ **The catalog is the sole truth.** Every predicate below was read out of the actual
  scripts (cited by file:line), not out of `docs/plans/authz-ae1-person-doors.md` §10's prose
  summary — that summary is a map, and re-reading the source found one thing it didn't say (the
  `GUARD_KEYS` name-rescue, §3 below).
- ⭐ **A copy of a copy needs its own count check.** The 233-function set was extracted from the
  classification doc's §12 table via the Grep tool, which persists large results to a file and
  showed "233 total occurrences" in its own count — but the persisted file it wrote had only 232
  lines; one row silently did not survive that round-trip, with no error anywhere. Re-extracting
  the same rows directly with Bash `grep` against the source markdown (not through the tool's
  persisted-output copy) gave 233, matching the classification's own composition arithmetic
  (213 app + 20 public; 134 trigger body + 99 internal helper). Had this gone unchecked, the
  partition below would have been built on 232 of 233 functions, and every downstream total —
  the verdict counts, the batch breakdown, the "sums to 233" checks — would have summed cleanly
  against the wrong base, with nothing to contradict it. The fix is not "trust the tool less"; it
  is that any extracted list gets an independent count against its source before it is used as an
  input to anything else.

---

## 1. The four buckets, and why there are four and not two

| bucket | meaning |
| --- | --- |
| **PROCEED (property-rescued)** | still inside ≥ 1 arm's domain after the revoke, by a catalog **property** (return type, mostly) — this rescue survives any rename |
| **PROCEED (name-rescued)** | still inside a domain **only** via `p0-authz-writepath-audit.sh`'s 11-name `GUARD_KEYS` hand list — real coverage today, but a rename of the function silently evicts it from the sweep (the same failure shape as "a rename orphans a name-keyed verdict") |
| **HOLD (blindness created)** | was inside ≥ 1 arm's domain pre-revoke, falls out of every arm's domain post-revoke. **This is RV0's target and the point of the exercise** |
| **UNCHANGED (never swept)** | was inside **zero** arms' domains before the revoke, and stays at zero after. ⛔ **Not a clean bill.** If a function here is genuinely fine, it is fine because it is a trigger body (Postgres checks `EXECUTE` on a trigger function at `CREATE TRIGGER` time, never at fire time, and refuses a direct call to a `trigger`-returning function outright) or an `app`-schema-only internal helper (PostgREST exposes only `["public","graphql_public"]`, so no sweep — old or new — has ever looked at it) — **not because any arm examined it**. Calling this "PROCEED" would assert a safety property nobody measured |

The **absolute** reading (post-revoke domain membership alone, ignoring pre-revoke history) is
reported alongside as its own number (§5) — it is real and useful (it is exactly
`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`'s neighbourhood), but it is **not** the verdict RV0 asks for.

---

## 2. Arm domain predicates — verified against the scripts, not the prose summary

| arm | domain condition (as read from source) | source |
| --- | --- | --- |
| `floor` | `nspname = 'public' AND prosecdef AND has_function_privilege('authenticated', oid, 'EXECUTE')` — no return-type filter | `supabase/tests/mutation/p0-authz-invariant.sh` `run_arm_floor()` :279 |
| `census` (fn clause) | `nspname IN ('app','public') AND prosecdef AND (rettype='bool' OR (proretset AND auth_exec))` (a second clause covers `public` INVOKER wrappers — never true for our 233, all `prosecdef=true`; a third covers RLS policy rows, a different object) | `p0-authz-invariant.sh` `run_arm_census()` :362 |
| `policy` — predicate arm | `prosecdef AND PRED_DOMAIN` where `PRED_DOMAIN = (rettype='bool' AND proname NOT IN ('enqueue_notification','remind_document_approver') AND (name ~ '^(is_\|can_\|has_\|referral_target_analyst\|attachment_confidentiality_ok)' AND name !~ '^is_valid_' OR stripped_prosrc ~ 'auth\.uid\(\)\|memberships\|member_can\|app\.is_\|app\.can_\|app\.has_\|principal_id')) OR proname = 'assert_not_case_excluded'` | `p0-authz-door-audit.sh` :367-381 |
| `policy` — rowdoor arm | `nspname IN ('app','public') AND prosecdef AND proretset AND auth_exec` | `p0-authz-rowdoor-audit.sh` :202-208 |
| `policy` — write-path hand lists | (a) `GUARD_KEYS`, an **11-name allowlist** neutralized directly by proname, independent of return type or grants: `assert_capa_writable, assert_meeting_staff_admin, assert_interview_writable, assert_rca_writable, assert_session_writable, assert_referral_draft_writable, assert_referral_target_acts, set_commission_oversight, ensure_professional_participant, create_external_participant, set_primary_subject`; (b) a 33-entry write-policy snapshot (table.policy → qual/with_check referencing predicate functions) — checked against our 233 and **confirmed to add nothing** (every function it references is already policy-predicate class, verdict `y`, never in this revoke set) | `p0-authz-writepath-audit.sh` :210 (a); :477-520 (b) |
| `wrapper` | `nspname='public' AND NOT prosecdef` — **structurally out of scope for every one of the 233**: all 233 are `prosecdef=true` by construction (they are members of the 752 DEFINER population), so this arm never includes any of them, pre- or post-revoke | `p0-authz-invariant.sh` `run_arm_wrapper()` :559 |
| `hat` | `nspname IN ('app','public') AND prokind='f'` — **no privilege term**, hence invariant under any revoke. Reported for completeness; **not counted as a rescue** — RV0's own worked example (`public.set_participant_patient`, which satisfies this domain) is still called "swept by nothing" after its revoke, so membership here does not count toward PROCEED | `act-hat-blind-sweep.sh` :189 |

### 2.0 Re-verification at head `20261003005300` — predicates hold, four citations had drifted

Every predicate above was re-read from source at the measured head before any of §5 was
computed. **All six domain predicates are unchanged in substance** — the scratch derivation and
the live scripts agree, so no verdict moved. Four **line citations** had drifted, which is the
"a comment is an assertion that goes stale silently" class and is corrected here rather than
left to be re-discovered:

| citation as written | actual at `…5300` | drift |
| --- | --- | --- |
| `p0-authz-invariant.sh` `run_arm_floor()` :279 | :279 (domain query :296-303) | none |
| `p0-authz-invariant.sh` `run_arm_census()` :362 | :362 (clause 1 :383-390) | none |
| `p0-authz-invariant.sh` `run_arm_wrapper()` :559 | :559 | none |
| `p0-authz-writepath-audit.sh` `GUARD_KEYS` :210 | :210 | none |
| `p0-authz-door-audit.sh` :367-381 | **:368-378** | −1 / −3 |
| `p0-authz-rowdoor-audit.sh` :202-208 | **:200-209** | −2 / +1 |
| `p0-authz-writepath-audit.sh` snapshot :477-520 | **:478-512** | +1 / −8 |
| `act-hat-blind-sweep.sh` :189 | **:181-183** | **−8 to −6** |

Two substantive clarifications the re-read produced:

- **The `wrapper` row's predicate is not literally in `run_arm_wrapper()`.** That function
  delegates to `p0-authz-invoker-audit.sh` (or, under `FROMFINDINGS=1`, compares committed
  findings); the `public` + `NOT prosecdef` shape is stated explicitly in **`run_arm_census()`'s
  second clause** (:399-405), which additionally requires `prokind='f'`, `lanname='plpgsql'` and
  `authenticated` EXECUTE. The conclusion is unaffected and now rests on a measurement rather
  than on the cited line: **all 233 are `prosecdef = true`** (§5.0 CHECK C, measured — not
  assumed "by construction"), so both the wrapper arm and the census INVOKER clause exclude
  every one of them, pre- and post-revoke.
- **The 33-entry write-policy snapshot really does add nothing — now measured, not asserted.**
  The snapshot references exactly 15 distinct functions
  (`app.` `can_manage_referral_source`, `can_manage_referral_target`, `can_read_case`,
  `can_sign_meeting`, `can_sign_section`, `can_write_capa`, `can_write_interview`,
  `can_write_rca`, `commission_of_meeting`, `is_admin`, `is_case_excluded`, `is_member_of`,
  `is_staff_admin_of`, `is_staff_admin_of_for`, `member_can`). **Intersection with the 233 is
  empty.** ⚠ Note the near-misses that make this worth measuring rather than eyeballing: the
  233 contain `commission_of_action_item` / `_document_version` / `_event` / `_interview` /
  `_referral` but **not** `commission_of_meeting`, and contain seven `is_*_of_for` helpers but
  **not** `is_staff_admin_of_for`. This is the recorded `X` / `X_for` trap; the two sets come
  within one identifier of touching.

### 2.1 The GUARD_KEYS finding — why it gets its own verdict class, not a footnote

Five of the 233 resolve to a name in `GUARD_KEYS`:
`assert_capa_writable`, `assert_interview_writable`, `assert_rca_writable`,
`assert_referral_draft_writable`, `assert_referral_target_acts`. None of these is `bool`-returning
(they are `uuid`/`void` raise-guards), so **none of them would be rescued by any catalog property**
— their only route back into `policy`'s domain is that this specific script names them, literally,
by identifier, and swaps their body via `CREATE OR REPLACE FUNCTION` to test the calling RPC's
write path. That neutralization does not depend on the *guard's own* `authenticated` grant (a
`SECURITY DEFINER` caller runs as its owner and needs no `EXECUTE` grant on a function it, as
owner, calls) — confirmed by reading the neutralization bodies directly
(`p0-authz-writepath-audit.sh` :237-300), which preserve signature/owner and only replace the
body — so this rescue is **invariant under the revoke**, exactly like the property-based ones.

But it is a **different kind** of coverage, and the lead's ruling is followed here: these five are
`PROCEED (name-rescued)`, never merged into `PROCEED (property-rescued)`. **`ARM=policy`'s coverage
of the write path is property-derived plus this 11-name allowlist, and the allowlist half does not
generalize to anything not on it** — a sixth raise-guard added tomorrow gets zero coverage from
this mechanism until someone remembers to add its name.

**GUARD_KEYS liveness** (do all 11 names resolve in `pg_proc` today — a name that resolves to
nothing is a dead rescue, inflating the sweep's apparent domain while protecting nothing):
§5.3 (measured against the live catalog).

---

## 3. Batch derivation (property, not hand-typed)

Batch membership is **re-derived** from each function's own catalog shape, not copied from the
classification doc's batch table:

- **batch 1** — `orig_class = 'trigger body'` (134)
- **batch 2** — `orig_class = 'internal helper' AND sch = 'app' AND rettype = 'bool'`
- **batch 3** — `orig_class = 'internal helper' AND sch = 'app' AND rettype <> 'bool' AND NOT proretset`
- **batch 4** — `orig_class = 'internal helper' AND (sch = 'public' OR proretset)`

The deriving SQL (§4) prints each batch's size as a check that this reproduces 134/43/52/4 — if it
doesn't, that's a finding in itself (the classification's own batch boundary vs. a fresh catalog
read disagreeing), reported rather than silently reconciled.

---

## 4. The deriving SQL

Run once per the DB-access window (see the reset-window note in §0 above); re-run fresh — never
patched — if the catalog changes underneath (a new migration lands). Full text, ready to run
as-is:

Executed once, as a single script, against the live local catalog at head `20261003005300`:

```bash
docker exec supabase_db_azkbbhskturikxpgmafq \
  psql -U postgres -d postgres -P pager=off -v ON_ERROR_STOP=1 -f /tmp/rv0_final.sql
```

Full text, verbatim — the exact script that produced every number in §5, including the
233-row input list (byte-identical to an independent Bash `grep`/`awk` extraction from
`docs/design/authz-definer-classification-ae1.md` §12; see §5.0 CHECK A):
```sql
-- ============================================================================
-- RV0 partition derivation. READ-ONLY: no REVOKE, no migration, no db reset.
-- Head 20261003005300 (484 registered == 484 on disk).
--
-- Arm domain predicates, each re-verified against the SOURCE SCRIPT (not prose)
-- at this head, 2026-08-27:
--   floor    p0-authz-invariant.sh   run_arm_floor()          :279 (query :296-303)
--   census   p0-authz-invariant.sh   run_arm_census()         :362 (clause 1 :383-390;
--            clause 2 = public INVOKER plpgsql :399-405; clause 3 = RLS policies)
--   policy   p0-authz-door-audit.sh  PRED_DOMAIN              :368-378
--          + p0-authz-rowdoor-audit.sh rowdoor worklist       :200-209
--          + p0-authz-writepath-audit.sh GUARD_KEYS           :210
--   wrapper  p0-authz-invariant.sh   run_arm_wrapper()        :559
--   hat      act-hat-blind-sweep.sh  _hb_fn domain            :181-183
-- ============================================================================
set search_path to pg_catalog, public;

drop table if exists revoke_targets;
create temp table revoke_targets (sch text, fname text, orig_class text);
insert into revoke_targets (sch, fname, orig_class) values
('app','_audit_access_authorized','internal helper'),
('app','_case_caps','internal helper'),
('app','_insert_block_child_rows','internal helper'),
('app','action_item_initial_status','internal helper'),
('app','action_item_status_by_key','internal helper'),
('app','advance_capa_action_core','internal helper'),
('app','answer_map_by_item','internal helper'),
('app','answer_map_by_item_scoped','internal helper'),
('app','answer_map_scoped','internal helper'),
('app','artifact_belongs_to_commission','internal helper'),
('app','assert_capa_writable','internal helper'),
('app','assert_condition_value_codes','internal helper'),
('app','assert_ethics_coordinator','internal helper'),
('app','assert_ethics_typed','internal helper'),
('app','assert_interview_writable','internal helper'),
('app','assert_matrix_answer_writable','internal helper'),
('app','assert_not_case_excluded','internal helper'),
('app','assert_phase_result_ready','internal helper'),
('app','assert_rca_writable','internal helper'),
('app','assert_reference_answer_writable','internal helper'),
('app','assert_referral_draft_writable','internal helper'),
('app','assert_referral_target_acts','internal helper'),
('app','assert_respondent_linkage_resolved','internal helper'),
('app','audit_case_participant_role','trigger body'),
('app','audit_case_type_terminology','trigger body'),
('app','can_amend_referral_phi_snapshot','internal helper'),
('app','can_curate_pqs_vocab','internal helper'),
('app','can_edit_referral_internal_note','internal helper'),
('app','can_manage_professional','internal helper'),
('app','can_manage_referral_internal_note','internal helper'),
('app','can_manage_referral_phi_disclosure','internal helper'),
('app','can_read_case_patient','internal helper'),
('app','can_read_full_meeting_content','internal helper'),
('app','can_read_minutes_transcript','internal helper'),
('app','can_read_quality_dashboards','internal helper'),
('app','can_read_referral','internal helper'),
('app','can_read_referral_internal_notes','internal helper'),
('app','can_write_action_item_stake','internal helper'),
('app','can_write_case_narrative','internal helper'),
('app','can_write_document','internal helper'),
('app','case_of_action_item','internal helper'),
('app','case_of_patient_participant','internal helper'),
('app','case_phase_answer_map','internal helper'),
('app','case_phase_option_aggregates','internal helper'),
('app','commission_of_action_item','internal helper'),
('app','commission_of_document_version','internal helper'),
('app','commission_of_event','internal helper'),
('app','commission_of_interview','internal helper'),
('app','commission_of_referral','internal helper'),
('app','commission_staff_admin_of_case','internal helper'),
('app','compute_case_phase_result','internal helper'),
('app','compute_due_charter_notifications','internal helper'),
('app','compute_due_document_review_notifications','internal helper'),
('app','compute_due_ethics_notifications','internal helper'),
('app','confidentiality_clearance_ok','internal helper'),
('app','controlled_version_source_path','internal helper'),
('app','copy_response_answers','internal helper'),
('app','decide_document_approval_core','internal helper'),
('app','department_belongs_to_commission','internal helper'),
('app','derive_capa_hospital','trigger body'),
('app','eligible_voters','internal helper'),
('app','ensure_answer_rows','internal helper'),
('app','ensure_matrix_answer_rows','internal helper'),
('app','ensure_securable_resource_capa_action','trigger body'),
('app','ensure_securable_resource_rca','trigger body'),
('app','event_capa_fully_settled','internal helper'),
('app','event_current_custodian','internal helper'),
('app','event_of_capa','internal helper'),
('app','evidence_label_of','internal helper'),
('app','evidence_status_of','internal helper'),
('app','guard_action_item','trigger body'),
('app','guard_capa_child_lock','trigger body'),
('app','guard_capa_status','trigger body'),
('app','guard_case_correction_request_write','trigger body'),
('app','guard_case_narrative_frozen','trigger body'),
('app','guard_case_narrative_type_coherent','trigger body'),
('app','guard_case_offered_outcome_coherent','trigger body'),
('app','guard_case_outcome_coherent','trigger body'),
('app','guard_case_participant_role_key','trigger body'),
('app','guard_case_phase_blocks_referenced','trigger body'),
('app','guard_case_phase_blocks_refs','trigger body'),
('app','guard_case_phase_refs_coherent','trigger body'),
('app','guard_case_phase_status','trigger body'),
('app','guard_case_reopening_write','trigger body'),
('app','guard_case_result_link_coherent','trigger body'),
('app','guard_case_status','trigger body'),
('app','guard_case_tag_assignment','trigger body'),
('app','guard_case_visibility','trigger body'),
('app','guard_commission_oversight','trigger body'),
('app','guard_controlled_document_status','trigger body'),
('app','guard_event_status','trigger body'),
('app','guard_event_triage','trigger body'),
('app','guard_frozen_approver_set','trigger body'),
('app','guard_interview_child_lock','trigger body'),
('app','guard_interview_links','trigger body'),
('app','guard_interview_status','trigger body'),
('app','guard_matrix_axis_code_immutable','trigger body'),
('app','guard_matrix_cell_coherent','trigger body'),
('app','guard_meeting_cases','trigger body'),
('app','guard_meeting_child_lock','trigger body'),
('app','guard_meeting_status','trigger body'),
('app','guard_narrative_revision_append_only','trigger body'),
('app','guard_phase_blocks_shape','trigger body'),
('app','guard_process_template_case_type','trigger body'),
('app','guard_process_template_outcome','trigger body'),
('app','guard_professional_linkage','trigger body'),
('app','guard_published_template_version','trigger body'),
('app','guard_rca_child_lock','trigger body'),
('app','guard_rca_status','trigger body'),
('app','guard_reference_coherent','trigger body'),
('app','guard_referral_message','trigger body'),
('app','guard_reserved_child_lock','trigger body'),
('app','guard_response_active_print','trigger body'),
('app','guard_risk_matrix_coherent','trigger body'),
('app','guard_submitted_selections','trigger body'),
('app','guard_supersession_coherent','trigger body'),
('app','guard_template_narrative_type','trigger body'),
('app','guard_template_phase_form_coherent','trigger body'),
('app','guard_template_phase_ruleset_content','trigger body'),
('app','has_case_capability','internal helper'),
('app','has_role','internal helper'),
('app','has_role_any','internal helper'),
('app','hospital_of_event','internal helper'),
('app','is_admin_for','internal helper'),
('app','is_dpo_of_for','internal helper'),
('app','is_entitled_document_approver','internal helper'),
('app','is_hospital_admin_of_for','internal helper'),
('app','is_nsp_coordinator_of','internal helper'),
('app','is_nsp_coordinator_of_for','internal helper'),
('app','is_nsp_org_admin_of_for','internal helper'),
('app','is_org_admin_of_for','internal helper'),
('app','is_oversight_only_reader','internal helper'),
('app','is_pqs_member_of','internal helper'),
('app','is_pqs_member_of_any','internal helper'),
('app','is_pqs_member_of_for','internal helper'),
('app','is_pqs_operator_in_org_for','internal helper'),
('app','is_pqs_operator_of_for','internal helper'),
('app','is_quality_reviewer_of_for','internal helper'),
('app','is_recused_from_case','internal helper'),
('app','is_tenancy_admin_of_for','internal helper'),
('app','item_question_type','internal helper'),
('app','latest_published_version','internal helper'),
('app','matrix_cells_by_item','internal helper'),
('app','member_can_for','internal helper'),
('app','mint_capa_code','trigger body'),
('app','mint_case_number','trigger body'),
('app','mint_controlled_document_code','trigger body'),
('app','mint_event_code','trigger body'),
('app','mint_indicator_code','trigger body'),
('app','mint_interview_number','trigger body'),
('app','mint_meeting_number','trigger body'),
('app','published_version_of_template','internal helper'),
('app','rca_bump_in_progress','internal helper'),
('app','recompute_case_status','internal helper'),
('app','references_by_item','internal helper'),
('app','referral_target_analyst','internal helper'),
('app','risk_matrix_by_item','internal helper'),
('app','seed_default_member_titles','internal helper'),
('app','seed_meetings_on_commission_insert','trigger body'),
('app','seed_member_titles_on_commission_insert','trigger body'),
('app','submitted_form_responses','internal helper'),
('app','touch_referral_note_updated_at','trigger body'),
('app','trg_attendee_roster','trigger body'),
('app','trg_audit_accreditation_frameworks','trigger body'),
('app','trg_audit_accreditation_standards','trigger body'),
('app','trg_audit_action_item_checklists','trigger body'),
('app','trg_audit_action_item_reminders','trigger body'),
('app','trg_audit_action_item_status_history','trigger body'),
('app','trg_audit_action_item_updates','trigger body'),
('app','trg_audit_action_items','trigger body'),
('app','trg_audit_administrativo','trigger body'),
('app','trg_audit_administrativo_capabilities','trigger body'),
('app','trg_audit_capa_effectiveness','trigger body'),
('app','trg_audit_capa_plan','trigger body'),
('app','trg_audit_case_access','trigger body'),
('app','trg_audit_case_child','trigger body'),
('app','trg_audit_case_narrative_types','trigger body'),
('app','trg_audit_case_narratives','trigger body'),
('app','trg_audit_case_phases','trigger body'),
('app','trg_audit_cases','trigger body'),
('app','trg_audit_commissions','trigger body'),
('app','trg_audit_controlled_document_versions','trigger body'),
('app','trg_audit_controlled_documents','trigger body'),
('app','trg_audit_document_approvals','trigger body'),
('app','trg_audit_event_custody','trigger body'),
('app','trg_audit_event_patient','trigger body'),
('app','trg_audit_event_triage','trigger body'),
('app','trg_audit_evidence_links','trigger body'),
('app','trg_audit_form_items','trigger body'),
('app','trg_audit_form_sections','trigger body'),
('app','trg_audit_form_versions','trigger body'),
('app','trg_audit_forms','trigger body'),
('app','trg_audit_hospital_updated','trigger body'),
('app','trg_audit_indicator_measurements','trigger body'),
('app','trg_audit_indicators','trigger body'),
('app','trg_audit_interviews','trigger body'),
('app','trg_audit_meeting_signatures','trigger body'),
('app','trg_audit_meetings','trigger body'),
('app','trg_audit_memberships','trigger body'),
('app','trg_audit_patient_identifiers','trigger body'),
('app','trg_audit_rca','trigger body'),
('app','trg_audit_responses','trigger body'),
('app','trg_audit_safety_event','trigger body'),
('app','trg_audit_signoffs','trigger body'),
('app','trg_audit_standard_assessments','trigger body'),
('app','trg_audit_standard_ownerships','trigger body'),
('app','trg_audit_template_narratives','trigger body'),
('app','trg_audit_template_versions','trigger body'),
('app','trg_complete_phase_on_signoff','trigger body'),
('app','trg_meetings_roster','trigger body'),
('app','trg_pin_respondent_retention','trigger body'),
('app','trg_recompute_case_status','trigger body'),
('app','trg_xref_maintain_patient_identifiers','trigger body'),
('public','commission_derive_organization_id','trigger body'),
('public','form_item_options_parent_is_choice','trigger body'),
('public','form_item_options_sync_version','trigger body'),
('public','form_items_sync_version','trigger body'),
('public','guard_default_section_delete','trigger body'),
('public','guard_profile_privileged_columns','trigger body'),
('public','guard_published_structure','trigger body'),
('public','guard_published_version','trigger body'),
('public','guard_response_version_commission','trigger body'),
('public','guard_submitted_children','trigger body'),
('public','guard_submitted_response','trigger body'),
('public','guard_submitted_signoffs','trigger body'),
('public','handle_new_user','trigger body'),
('public','reject_answer_on_display_item','trigger body'),
('public','reject_invalid_selection','trigger body'),
('public','set_participant_patient','internal helper'),
('public','snap_referral_commission_names','trigger body'),
('public','sync_case_phase_on_submit','trigger body'),
('public','sync_profile_email','trigger body'),
('public','sync_profile_email_confirmed','trigger body');

-- ── CHECK A: the input list's own composition, against the classification's §7 ────
--   expected 233 total = 213 app + 20 public = 134 trigger body + 99 internal helper
select 'A_input_composition' as check, count(*) as n_total,
       count(*) filter (where sch='app')                    as n_app,
       count(*) filter (where sch='public')                 as n_public,
       count(*) filter (where orig_class='trigger body')    as n_trigger,
       count(*) filter (where orig_class='internal helper') as n_internal,
       count(distinct sch||'.'||fname)                      as n_distinct
from revoke_targets;

-- ── Join to the LIVE catalog. Name-keyed; CHECK B proves it is 1:1 (no overloads). ─
drop table if exists rv0_ev;
create temp table rv0_ev as
select rt.sch, rt.fname, rt.orig_class,
       p.oid,
       pg_get_function_identity_arguments(p.oid) as args,
       t.typname   as rettype,
       l.lanname   as lang,
       p.proretset, p.prosecdef, p.prokind,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec,
       has_function_privilege('service_role',  p.oid, 'EXECUTE') as svc_exec,
       has_function_privilege('anon',          p.oid, 'EXECUTE') as anon_exec,
       -- does PUBLIC hold EXECUTE?  A NULL proacl is the DEFAULT acl, which includes
       -- PUBLIC — the recorded "guards that read right but fail open" trap.
       (p.proacl is null
        or exists (select 1 from aclexplode(p.proacl) a
                   where a.grantee = 0 and a.privilege_type = 'EXECUTE')) as public_exec,
       regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as stripped_src
from revoke_targets rt
join pg_namespace n on n.nspname = rt.sch
join pg_proc      p on p.pronamespace = n.oid and p.proname = rt.fname
join pg_type      t on t.oid = p.prorettype
join pg_language  l on l.oid = p.prolang;

-- ── CHECK B: resolution is 1:1 — 233 in, 233 out, no overload, nothing unresolved ──
select 'B_resolution' as check,
       (select count(*) from revoke_targets) as in_rows,
       (select count(*) from rv0_ev)         as out_rows,
       (select count(*) from (select sch,fname from rv0_ev group by 1,2 having count(*)<>1) x)
                                             as names_not_1to1,
       (select count(*) from revoke_targets rt
         where not exists (select 1 from rv0_ev e where e.sch=rt.sch and e.fname=rt.fname))
                                             as unresolved_in_catalog;

-- ── CHECK C: the premises this partition rests on — MEASURED, never assumed ───────
--   C1 all 233 are prosecdef      (why the wrapper arm is structurally out of scope)
--   C2 all 233 hold `authenticated` EXECUTE today (the revoke has something to remove)
--   C3 how many ALSO hold EXECUTE via PUBLIC — for those, revoking from `authenticated`
--      alone does NOT make has_function_privilege() false (it still arrives via PUBLIC),
--      so the simulated post-state is not reachable by that revoke alone.
select 'C_premises' as check,
       count(*)                                  as n,
       count(*) filter (where prosecdef)         as n_prosecdef,
       count(*) filter (where not prosecdef)     as n_invoker,
       count(*) filter (where auth_exec)         as n_auth_exec_true,
       count(*) filter (where not auth_exec)     as n_auth_exec_false,
       count(*) filter (where public_exec)       as n_public_exec,
       count(*) filter (where svc_exec)          as n_svc_exec,
       count(*) filter (where anon_exec)         as n_anon_exec,
       count(*) filter (where prokind='f')       as n_prokind_f,
       count(*) filter (where rettype='trigger') as n_rettype_trigger
from rv0_ev;

-- ── Arm domain membership, PRE-revoke and POST-revoke (auth_exec simulated false) ──
drop table if exists rv0_verdict;
create temp table rv0_verdict as
with pred as (
  -- p0-authz-door-audit.sh PRED_DOMAIN, transcribed literally. It carries NO privilege
  -- term, hence it is invariant under the revoke.
  select oid,
    ( rettype = 'bool'
      and fname not in ('enqueue_notification','remind_document_approver')
      and ( ( fname ~ '^(is_|can_|has_|referral_target_analyst|attachment_confidentiality_ok)'
              and fname !~ '^is_valid_' )
            or stripped_src ~ 'auth\.uid\(\)|memberships|member_can|app\.is_|app\.can_|app\.has_|principal_id' )
      or fname = 'assert_not_case_excluded'
    ) as pred_domain
  from rv0_ev
), guardkeys as (
  -- p0-authz-writepath-audit.sh :210 GUARD_KEYS — 11 names, matched by proname alone.
  -- The neutralization is a CREATE OR REPLACE by the owner, so it needs no
  -- `authenticated` EXECUTE on the guard ⇒ also invariant under the revoke.
  select oid,
    fname in ('assert_capa_writable','assert_meeting_staff_admin','assert_interview_writable',
              'assert_rca_writable','assert_session_writable','assert_referral_draft_writable',
              'assert_referral_target_acts','set_commission_oversight','ensure_professional_participant',
              'create_external_participant','set_primary_subject') as in_guard_keys
  from rv0_ev
)
select e.*, pr.pred_domain, gk.in_guard_keys,

  -- ══ PRE-revoke ════════════════════════════════════════════════════════════════
  (e.sch='public' and e.prosecdef and e.auth_exec)                     as floor_pre,
  (e.sch in ('app','public') and e.prosecdef
     and (e.rettype='bool' or (e.proretset and e.auth_exec)))          as census1_pre,
  (e.sch='public' and not e.prosecdef and e.prokind='f'
     and e.lang='plpgsql' and e.auth_exec)                             as census2_pre,
  (e.sch in ('app','public') and e.prosecdef and pr.pred_domain)       as pol_pred_pre,
  (e.sch in ('app','public') and e.prosecdef and e.proretset and e.auth_exec)
                                                                       as pol_row_pre,
  gk.in_guard_keys                                                     as pol_guard_pre,
  (e.sch='public' and not e.prosecdef)                                 as wrapper_pre,

  -- ══ POST-revoke — the identical predicates with auth_exec forced to false ══════
  false                                                                as floor_post,
  (e.sch in ('app','public') and e.prosecdef and e.rettype='bool')     as census1_post,
  false                                                                as census2_post,
  (e.sch in ('app','public') and e.prosecdef and pr.pred_domain)       as pol_pred_post,
  false                                                                as pol_row_post,
  gk.in_guard_keys                                                     as pol_guard_post,
  (e.sch='public' and not e.prosecdef)                                 as wrapper_post,

  -- hat: nspname in (app,public) AND prokind='f' — NO privilege term, hence invariant.
  -- Reported, NOT counted as a rescue (RV0's own set_participant_patient example).
  (e.sch in ('app','public') and e.prokind='f')                        as hat_invariant
from rv0_ev e
join pred      pr on pr.oid = e.oid
join guardkeys gk on gk.oid = e.oid;

alter table rv0_verdict add column any_domain_pre  boolean;
alter table rv0_verdict add column any_domain_post boolean;
alter table rv0_verdict add column verdict text;

update rv0_verdict set
  any_domain_pre  = (floor_pre  or census1_pre  or census2_pre
                     or pol_pred_pre  or pol_row_pre  or pol_guard_pre  or wrapper_pre),
  any_domain_post = (floor_post or census1_post or census2_post
                     or pol_pred_post or pol_row_post or pol_guard_post or wrapper_post);

-- DELTA is authoritative. Name-rescue is split out and NEVER merged into property-rescue.
-- ⚠ The condition is "GUARD_KEYS is the ONLY surviving route", written as an explicit
-- disjunction of every other post arm. An earlier draft wrote `policy_post and not
-- in_guard_keys`, which is always false whenever in_guard_keys is true regardless of
-- pred_domain — caught on review before it was ever run; kept named so it is not
-- quietly reintroduced.
update rv0_verdict set verdict =
  case
    when any_domain_post
         and pol_guard_post
         and not (census1_post or pol_pred_post or floor_post or census2_post
                  or pol_row_post or wrapper_post)                then 'PROCEED (name-rescued)'
    when any_domain_post                                          then 'PROCEED (property-rescued)'
    when any_domain_pre                                           then 'HOLD (blindness created)'
    else                                                               'UNCHANGED (never swept)'
  end;

-- ── §5.1 Overall verdict totals — MUST sum to 233 ─────────────────────────────────
select verdict, count(*) as n from rv0_verdict group by 1
union all
select 'TOTAL', count(*) from rv0_verdict
order by 1;

-- ── §5.2 The HOLD list, in full ───────────────────────────────────────────────────
select sch||'.'||fname||'('||args||')' as func, orig_class, rettype, proretset,
       pred_domain, in_guard_keys, any_domain_pre, any_domain_post
from rv0_verdict
where verdict = 'HOLD (blindness created)'
order by sch, fname;

-- ── §5.2b which arm(s) each HOLD row is losing ────────────────────────────────────
select sch||'.'||fname as func,
       floor_pre, census1_pre, census2_pre, pol_pred_pre, pol_row_pre, pol_guard_pre
from rv0_verdict
where verdict = 'HOLD (blindness created)'
order by sch, fname;

-- ── §5.2c the name-rescued rows, named ────────────────────────────────────────────
select sch||'.'||fname as func, rettype, verdict
from rv0_verdict
where in_guard_keys
order by verdict, sch, fname;

-- ── §5.4 Per-batch verdict breakdown + the arm-domain delta per batch ─────────────
--   Batch membership is DERIVED from catalog shape, never copied from the doc's table.
drop table if exists rv0_batch;
create temp table rv0_batch as
select *,
  case
    when orig_class='trigger body'                                          then 'batch1_trigger'
    when orig_class='internal helper' and sch='app' and rettype='bool'      then 'batch2_app_bool'
    when orig_class='internal helper' and sch='app' and rettype<>'bool'
         and not proretset                                                  then 'batch3_app_nonbool_nonsetof'
    when orig_class='internal helper' and (sch='public' or proretset)       then 'batch4_held'
    else 'UNCLASSIFIED_CHECK_ME'
  end as batch
from rv0_verdict;

--   §5.4a batch sizes — expected 134 / 43 / 52 / 4.  A miss here IS the finding.
select batch, count(*) as n from rv0_batch group by 1
union all
select 'TOTAL', count(*) from rv0_batch
order by 1;

--   §5.4b verdict breakdown per batch
select batch, verdict, count(*) as n from rv0_batch group by 1,2 order by 1,2;

--   §5.4c arm-domain delta per batch (per-arm pre → post counts)
select batch, count(*) as n,
       count(*) filter (where floor_pre)     as floor_pre,
       count(*) filter (where floor_post)    as floor_post,
       count(*) filter (where census1_pre)   as census1_pre,
       count(*) filter (where census1_post)  as census1_post,
       count(*) filter (where pol_pred_pre)  as polpred_pre,
       count(*) filter (where pol_pred_post) as polpred_post,
       count(*) filter (where pol_row_pre)   as polrow_pre,
       count(*) filter (where pol_row_post)  as polrow_post,
       count(*) filter (where pol_guard_pre) as polguard_pre,
       count(*) filter (where pol_guard_post)as polguard_post,
       count(*) filter (where hat_invariant) as hat_inv
from rv0_batch group by 1 order by 1;

-- ── §5.5 Absolute (non-authoritative) reading, computed WITHOUT the verdict CASE ───
select 'absolute_zero_domain_post' as metric, count(*) as n
from rv0_verdict where not any_domain_post
union all
select 'cross_check_HOLD_plus_UNCHANGED', count(*)
from rv0_verdict where verdict in ('HOLD (blindness created)','UNCHANGED (never swept)')
union all
select 'zero_domain_PRE (already unswept before any revoke)', count(*)
from rv0_verdict where not any_domain_pre;

-- ── §5.3 GUARD_KEYS liveness — all 11 names, INDEPENDENT of the 233 ───────────────
select k as guard_key,
       (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname in ('app','public') and p.proname = k)              as n_matches,
       (select string_agg(n.nspname||'.'||p.proname||'('||
                          pg_get_function_identity_arguments(p.oid)||')', ' ; ' order by p.oid)
          from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname in ('app','public') and p.proname = k)              as resolves_to,
       (select count(*) from rv0_ev e where e.fname = k)                     as in_the_233
from unnest(array['assert_capa_writable','assert_meeting_staff_admin','assert_interview_writable',
                  'assert_rca_writable','assert_session_writable','assert_referral_draft_writable',
                  'assert_referral_target_acts','set_commission_oversight','ensure_professional_participant',
                  'create_external_participant','set_primary_subject']) as k
order by k;

--   §5.3b GUARD_KEYS signature drift: guard_sig() resolves each by regprocedure. A name
--   that resolves but whose ARGUMENT LIST moved is a rescue that fails at run time.
select k as guard_key, sig, to_regprocedure(sig) is not null as sig_resolves
from (values
  ('assert_capa_writable','app.assert_capa_writable(uuid)'),
  ('assert_meeting_staff_admin','app.assert_meeting_staff_admin(uuid)'),
  ('assert_interview_writable','app.assert_interview_writable(uuid)'),
  ('assert_rca_writable','app.assert_rca_writable(uuid)'),
  ('assert_session_writable','app.assert_session_writable(uuid)'),
  ('assert_referral_draft_writable','app.assert_referral_draft_writable(uuid)'),
  ('assert_referral_target_acts','app.assert_referral_target_acts(uuid,text[])'),
  ('set_commission_oversight','public.set_commission_oversight(uuid,text)'),
  ('ensure_professional_participant','public.ensure_professional_participant(uuid)'),
  ('create_external_participant','public.create_external_participant(uuid,text,text)'),
  ('set_primary_subject','public.set_primary_subject(uuid)')
) as t(k,sig)
order by k;

-- ── CHECK D: is an `authenticated`-only REVOKE even EFFECTIVE on these functions? ──
-- has_function_privilege('authenticated', …) is TRUE if the privilege arrives by ANY
-- route: a direct grant, a grant to a role `authenticated` is a member of, or a grant to
-- PUBLIC. A NULL proacl is the DEFAULT acl, which grants EXECUTE to PUBLIC.
-- ⇒ where the ONLY route is PUBLIC, `REVOKE EXECUTE … FROM authenticated` is a silent
--   no-op: has_function_privilege stays TRUE and the simulated post-state is unreachable.
drop table if exists rv0_acl;
create temp table rv0_acl as
select e.sch, e.fname, e.oid,
       p.proacl is null as acl_is_default_null,
       (p.proacl is null
        or exists (select 1 from aclexplode(p.proacl) a
                   where a.grantee = 0 and a.privilege_type = 'EXECUTE'))       as public_exec,
       -- a NULL proacl is the DEFAULT acl (owner + PUBLIC) — it carries no direct
       -- `authenticated` grant by definition, and aclexplode() rejects the 0-dimensional
       -- empty array, so NULL is handled here rather than coalesced.
       (p.proacl is not null
        and exists (select 1 from aclexplode(p.proacl) a
                    where a.grantee = to_regrole('authenticated')::oid
                      and a.privilege_type = 'EXECUTE'))                        as direct_auth_grant,
       has_function_privilege('authenticated', e.oid, 'EXECUTE')                as auth_exec
from rv0_ev e join pg_proc p on p.oid = e.oid;

select 'D_revoke_effectiveness' as check,
       count(*)                                                          as n,
       count(*) filter (where direct_auth_grant)                         as has_direct_auth_grant,
       count(*) filter (where public_exec)                               as reachable_via_PUBLIC,
       count(*) filter (where public_exec and not direct_auth_grant)     as PUBLIC_only_revoke_is_noop,
       count(*) filter (where direct_auth_grant and not public_exec)     as revoke_fully_effective,
       count(*) filter (where acl_is_default_null)                       as acl_null_default
from rv0_acl;

-- D2 — the same split restricted to the 23 HOLD rows: does the HOLD verdict even bind?
select v.verdict, count(*) as n,
       count(*) filter (where a.public_exec)                             as reachable_via_PUBLIC,
       count(*) filter (where a.public_exec and not a.direct_auth_grant) as revoke_is_noop,
       count(*) filter (where a.direct_auth_grant and not a.public_exec) as revoke_effective
from rv0_verdict v join rv0_acl a on a.oid = v.oid
group by 1 order by 1;

-- D3 — name the HOLD rows whose revoke would be a no-op as scoped
select v.sch||'.'||v.fname as func, a.direct_auth_grant, a.public_exec
from rv0_verdict v join rv0_acl a on a.oid = v.oid
where v.verdict = 'HOLD (blindness created)'
order by a.public_exec desc, v.sch, v.fname;
```

---

## 5. Results

*Every number below is generated by §4's script against the live catalog at head
`20261003005300` — none is asserted, and none is carried over from the `…4400` draft.*

### 5.0 Input and premise checks — run before any verdict was computed

| check | result | reading |
| --- | --- | --- |
| **A** input composition | `n_total=233`, `app=213`, `public=20`, `trigger body=134`, `internal helper=99`, `distinct=233` | reproduces the classification §7 composition exactly, with **no duplicate rows** |
| **B** catalog resolution | `in=233`, `out=233`, `names_not_1to1=0`, `unresolved=0` | name-keying is safe here: every `(schema, name)` resolves to exactly one `oid`, **zero overloads**, nothing missing from the catalog |
| **C** premises | `prosecdef=233` / `invoker=0`; `auth_exec=233` true, `0` false; `prokind='f'`=233; `rettype='trigger'`=134 | both load-bearing premises **hold as measured**, not "by construction": the wrapper arm and the census INVOKER clause are genuinely empty for this set, and every one of the 233 does currently hold `authenticated` EXECUTE, so the simulated revoke has something to remove |
| **D** revoke effectiveness | `direct authenticated grant=96`; `reachable via PUBLIC=138`; **`PUBLIC-only ⇒ revoke is a silent no-op=137`**; `revoke fully effective=95`; `proacl IS NULL (default acl)=137` | **new finding — see §5.6.** For 137 of the 233 the privilege arrives via `PUBLIC`, so `REVOKE … FROM authenticated` alone leaves `has_function_privilege()` **true** |

⭐ **The 233-row input list was re-extracted independently, not trusted.** Per the header's
warning, the list was pulled a second time straight from
`docs/design/authz-definer-classification-ae1.md` with Bash `awk` over §12's table (selecting
rows whose `EXECUTE needed` cell is `**n**`), and count-checked three ways before use:

- **233 rows**, and §6.2's own arithmetic closes: `y=485` + `n=233` + `?=34` = **752** ✓
- composition **213 `app` + 20 `public`** and **134 `trigger body` + 99 `internal helper`** ✓
- **233 distinct** `(schema, name)` pairs — no row duplicated to mask a dropped one ✓
- `comm` diff against the derivation script's hand-typed `VALUES` block: **zero rows on either
  side** — the two lists are identical, so the 232-vs-233 round-trip loss the header records
  did **not** reach this file's input.

### 5.1 Overall verdict totals — sum to 233

| verdict | count |
| --- | ---: |
| PROCEED (property-rescued) | 44 |
| PROCEED (name-rescued) | 5 |
| **HOLD (blindness created)** | **23** |
| UNCHANGED (never swept) | 161 |
| **TOTAL** | **233** |

**Arithmetic, printed rather than claimed: 44 + 5 + 23 + 161 = 233 ✓** (the script emits the
`TOTAL` row from the same table by `count(*)`, so the total cannot drift from its parts).

### 5.2 The HOLD list, in full — 23 functions

These were inside ≥ 1 arm's domain before the revoke and inside **zero** after. This is the
number the phase cares about.

**3 × `app`, all set-returning** (they leave `ARM=census` clause 1 *and* `ARM=policy`'s rowdoor
arm — both require `proretset` **and** `authenticated` EXECUTE):

| function | class | returns |
| --- | --- | --- |
| `app.case_phase_option_aggregates(p_case_phase_id uuid)` | internal helper | `SETOF record` |
| `app.eligible_voters(p_case_id uuid)` | internal helper | `SETOF uuid` |
| `app.submitted_form_responses(p_form_id uuid)` | internal helper | `SETOF responses` |

**20 × `public`, all leaving `ARM=floor`** (19 trigger bodies + the one PHI door):

| function | class |
| --- | --- |
| `public.commission_derive_organization_id()` | trigger body |
| `public.form_item_options_parent_is_choice()` | trigger body |
| `public.form_item_options_sync_version()` | trigger body |
| `public.form_items_sync_version()` | trigger body |
| `public.guard_default_section_delete()` | trigger body |
| `public.guard_profile_privileged_columns()` | trigger body |
| `public.guard_published_structure()` | trigger body |
| `public.guard_published_version()` | trigger body |
| `public.guard_response_version_commission()` | trigger body |
| `public.guard_submitted_children()` | trigger body |
| `public.guard_submitted_response()` | trigger body |
| `public.guard_submitted_signoffs()` | trigger body |
| `public.handle_new_user()` | trigger body |
| `public.reject_answer_on_display_item()` | trigger body |
| `public.reject_invalid_selection()` | trigger body |
| `public.snap_referral_commission_names()` | trigger body |
| `public.sync_case_phase_on_submit()` | trigger body |
| `public.sync_profile_email()` | trigger body |
| `public.sync_profile_email_confirmed()` | trigger body |
| **`public.set_participant_patient(p_case_id uuid, p_participant_id uuid, p_name text, p_mrn text, p_date_of_birth date, p_age_years integer, p_sex text, p_encounter_ref text, p_unit text, p_attending text, p_role_id uuid)`** | **internal helper — Rule 12 PHI (case module)** |

**Which arm each HOLD row loses.** The two groups are **disjoint** — the 20 `public` rows are in
`floor` and nothing else, the 3 set-returning rows are in `census` clause 1 and `policy`'s
rowdoor arm and neither is in `floor` — so the union is exactly `20 + 3 = 23`, with no row
counted twice:

| arm lost | rows | detail |
| --- | ---: | --- |
| `floor` only | 20 | the 20 `public` rows above — `floor` is the *only* arm that had them |
| `census` clause 1 **and** `policy` rowdoor | 3 | the set-returning trio — both arms require EXECUTE, so both drop together |

⚠ **This independently reproduces §7.4's predicted coverage cost**, which was written before any
of it was measured: `ARM=floor` loses **20** objects (19 `trigger`-returning + `set_participant_patient`),
`ARM=census` clause 1 loses **3**, `ARM=policy` rowdoor loses **3** — and because the two groups
are disjoint, the union is exactly **23**. `ARM=hat` and `ARM=wrapper` lose nothing (no privilege
term / structurally empty).

⭐ **`public.set_participant_patient` is RV0's own worked example, and it lands where RV0 said it
would** — `public`, DEFINER, returns `uuid`, no set, not a predicate name ⇒ after the revoke it is
in **no** arm's domain. It satisfies `ARM=hat`'s domain, and per §2 that is deliberately **not**
counted as a rescue; the function is still swept by nothing. RV2's standing ruling (not revoked
in AE1) is untouched by this file.

### 5.3 GUARD_KEYS liveness — all 11 names, checked against `pg_proc` independent of the 233

**All 11 resolve, each to exactly one function, and every one of the 11 `regprocedure`
signatures `guard_sig()` uses also resolves.** There is **no dead rescue** in the allowlist
today — nothing is inflating the sweep's apparent domain while protecting nothing.

| `GUARD_KEYS` name | matches in `pg_proc` | resolves to | `guard_sig()` signature resolves | in the 233 |
| --- | :---: | --- | :---: | :---: |
| `assert_capa_writable` | 1 | `app.assert_capa_writable(p_capa_id uuid)` | ✅ | ✅ |
| `assert_interview_writable` | 1 | `app.assert_interview_writable(p_interview_id uuid)` | ✅ | ✅ |
| `assert_meeting_staff_admin` | 1 | `app.assert_meeting_staff_admin(p_meeting_id uuid)` | ✅ | — |
| `assert_rca_writable` | 1 | `app.assert_rca_writable(p_rca_id uuid)` | ✅ | ✅ |
| `assert_referral_draft_writable` | 1 | `app.assert_referral_draft_writable(p_referral_id uuid)` | ✅ | ✅ |
| `assert_referral_target_acts` | 1 | `app.assert_referral_target_acts(p_referral_id uuid, p_expected text[])` | ✅ | ✅ |
| `assert_session_writable` | 1 | `app.assert_session_writable(p_session_id uuid)` | ✅ | — |
| `create_external_participant` | 1 | `public.create_external_participant(p_org uuid, p_type text, p_display_name text)` | ✅ | — |
| `ensure_professional_participant` | 1 | `public.ensure_professional_participant(p_profile_id uuid)` | ✅ | — |
| `set_commission_oversight` | 1 | `public.set_commission_oversight(p_commission_id uuid, p_oversight text)` | ✅ | — |
| `set_primary_subject` | 1 | `public.set_primary_subject(p_case_participant_id uuid)` | ✅ | — |

**5 of the 11 fall inside this revoke set** — exactly the five §2.1 predicted, and they are the
whole of the `PROCEED (name-rescued)` bucket. None is `bool`-returning (`void`, `uuid`, `uuid`,
`case_referral`, `case_referral`), so **no catalog property would rescue any of them**; the
allowlist naming them literally is their only route into `ARM=policy`'s domain:

| function | returns | verdict |
| --- | --- | --- |
| `app.assert_capa_writable` | `void` | PROCEED (name-rescued) |
| `app.assert_interview_writable` | `uuid` | PROCEED (name-rescued) |
| `app.assert_rca_writable` | `uuid` | PROCEED (name-rescued) |
| `app.assert_referral_draft_writable` | `case_referral` | PROCEED (name-rescued) |
| `app.assert_referral_target_acts` | `case_referral` | PROCEED (name-rescued) |

⚠ **Liveness is checked; durability is not, and cannot be by any query here.** All 11 names
resolve *today*. The failure this bucket exists to flag is a **future** rename or signature
change silently evicting a guard from the sweep — a `.sh` hand list has nothing that reds when
that happens. Verdict-splitting is the mitigation this file can offer; it is not a gate.

### 5.4 Per-batch verdict breakdown, and the arm-domain delta per batch

**Batch sizes reproduce the classification's 134 / 43 / 52 / 4 exactly** — re-derived from each
function's own catalog shape (§3's predicates), never copied from §7.1's table. `134 + 43 + 52 +
4 = 233` ✓, and the `UNCLASSIFIED_CHECK_ME` arm of the `CASE` matched **zero** rows.

| batch | derived size | expected (§7.1) | agrees |
| --- | ---: | ---: | :---: |
| 1 — trigger bodies | 134 | 134 | ✅ |
| 2 — `app` boolean helpers | 43 | 43 | ✅ |
| 3 — remaining `app` (non-bool, non-setof) | 52 | 52 | ✅ |
| 4 — HELD (§7.2) | 4 | 4 | ✅ |

**Verdicts per batch:**

| batch | PROCEED (property) | PROCEED (name) | HOLD | UNCHANGED | total |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 — trigger bodies | 0 | 0 | **19** | 115 | 134 |
| 2 — `app` boolean | 43 | 0 | 0 | 0 | 43 |
| 3 — `app` other | 1 | 5 | 0 | 46 | 52 |
| 4 — HELD | 0 | 0 | **4** | 0 | 4 |
| **total** | **44** | **5** | **23** | **161** | **233** |

**Arm-domain delta per batch** (count of rows in each arm's domain, pre → post):

| batch | n | `floor` | `census` cl.1 | `policy` pred | `policy` rowdoor | `policy` GUARD_KEYS | `hat` (invariant) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 — trigger bodies | 134 | **19 → 0** | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 134 |
| 2 — `app` boolean | 43 | 0 → 0 | 43 → 43 | 40 → 40 | 0 → 0 | 0 → 0 | 43 |
| 3 — `app` other | 52 | 0 → 0 | 0 → 0 | 1 → 1 | 0 → 0 | 5 → 5 | 52 |
| 4 — HELD | 4 | **1 → 0** | **3 → 0** | 0 → 0 | **3 → 0** | 0 → 0 | 4 |
| **total** | **233** | **20 → 0** | **46 → 43** | **41 → 41** | **3 → 0** | **5 → 5** | **233** |

Reading the table:

- **Batch 2 loses nothing** — all 43 stay in `census` clause 1 (and 40 of them in `PRED_DOMAIN`),
  both of which key on `rettype='bool'` with **no** EXECUTE term. §7.1's stated reason for
  ordering batch 2 where it is holds up under measurement.
- **Batch 3 loses nothing either**, but for a much weaker reason: 46 of its 52 were in **no
  arm's domain to begin with**. That is `UNCHANGED`, not safety — see §1.
- **Batch 1 is where the surprise is.** 115 of its 134 are `UNCHANGED`, but **19 are `HOLD`** —
  the `public` trigger bodies, which `ARM=floor` *does* currently see (it filters on schema +
  `prosecdef` + EXECUTE and applies **no return-type filter**, so a `trigger`-returning function
  is inside its domain). Revoking evicts all 19. ⚠ **This is the one place where "batch 1 is the
  lowest-consequence slice" is true about *runtime* risk and false about *observability***: the
  revoke cannot break a trigger (EXECUTE is checked at `CREATE TRIGGER`, not at fire time), but
  it does silently shrink `ARM=floor`'s domain by 19 objects. Those two facts are independent and
  §7.1's framing conflates them.
- **Batch 4's hold is upheld, and it is the only batch that is 100% HOLD.** All 4 fall out of
  every arm. RV1's ruling stands on measured ground.

### 5.5 Absolute (non-authoritative) reading, reported alongside

| metric | n |
| --- | ---: |
| in **zero** arm domains **post**-revoke, regardless of history | **184** |
| cross-check: `HOLD` + `UNCHANGED` from §5.1 (23 + 161) | **184** ✓ |
| in **zero** arm domains **pre**-revoke (already unswept before anything is revoked) | **161** |

The 184 is computed by a **separate query** (`where not any_domain_post`) that does not reuse
the verdict `CASE` expression, so the agreement between the two is a real cross-check rather
than a restatement. It is `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`'s neighbourhood and it is the number
that would be quoted if the absolute reading were treated as the verdict — **it is not**. Of
those 184, **161 are already unswept today**: the revoke did not create that condition and this
file does not claim it as a result. The delta the revoke actually causes is **23**.

### 5.6 ⚠ New finding — 137 of the 233 revokes are a silent no-op **as scoped**

Not part of the RV0 partition, surfaced by CHECK D while measuring the premise that the
functions currently hold `authenticated` EXECUTE. It does not move any verdict in §5.1 (RV0's
question is counterfactual: *if* the grant were false, what happens to coverage) but it binds
**execution**:

| | n |
| --- | ---: |
| hold a **direct** `authenticated` EXECUTE grant | 96 |
| reachable by `authenticated` **via `PUBLIC`** | 138 |
| **`PUBLIC`-only ⇒ `REVOKE … FROM authenticated` changes nothing** | **137** |
| direct grant and no `PUBLIC` ⇒ revoke is fully effective | 95 |
| `proacl IS NULL` (the default acl, which grants EXECUTE to `PUBLIC`) | 137 |

`has_function_privilege('authenticated', …)` is true if the privilege arrives by **any** route.
For 137 functions the only route is `PUBLIC`, so revoking from `authenticated` leaves the
predicate **true** and nothing observable changes — the recorded "a `REVOKE` you're not entitled
to make is a silent no-op" shape, one step over (here the revoke is *entitled* but *irrelevant*).
The 138 figure is the same 138 §7 lists as "also hold `anon` EXECUTE", which RV5 rules
out of scope; the sharper statement is that for 137 of them **the `authenticated` revoke itself
is the no-op**, not merely that an `anon` residue survives it.

**Where those 137 sit against the verdicts** — and this is the part that matters:

| verdict | n | reachable via `PUBLIC` | revoke is a no-op | revoke is effective |
| --- | ---: | ---: | ---: | ---: |
| HOLD (blindness created) | 23 | 0 | **0** | **23** |
| PROCEED (name-rescued) | 5 | 0 | 0 | 5 |
| PROCEED (property-rescued) | 44 | 7 | 7 | 37 |
| UNCHANGED (never swept) | 161 | 131 | 130 | 30 |

⭐ **All 23 HOLD rows carry a direct `authenticated` grant and no `PUBLIC` grant, so the revoke
is fully effective on every one of them.** The HOLD verdict is not softened by this finding —
it binds exactly where it matters. The no-ops are concentrated in `UNCHANGED` (130 of 137),
i.e. in the bucket where the revoke was going to change nothing observable anyway.

#### ⛔ The above is an ACL *reading*. Here is the effective probe, because this phase already
#### paid once for the difference

Everything in §5.6 so far is derived from grant routes and `proacl IS NULL` — that is reading the
rule, and close condition #2 of this same phase was a case where reading the rule (`pg_default_acl`
listed no `PUBLIC`, so `public` looked closed) gave the **wrong** answer and only probing the
effective state gave the right one. The finding here happens to survive that upgrade, but it
should not have been left at reading grade. Executed by the lead **2026-08-27**, head
`20261003005300`, inside a `do $$` block **rolled back by a deliberate raise** (residue
re-measured after: 320 `app` DEFINERs still `authenticated`-executable, unchanged):

| subject | `proacl` | before | after `revoke execute … from authenticated` |
| --- | --- | :---: | :---: |
| `app.can_read_event_patient` | **NULL** (built-in default) | `true` | ⛔ **`true`** — the revoke did nothing |
| `app.commission_of_case` (**positive control**) | explicit | `true` | ✅ `false` |

The control is what makes the first row evidence: without it, a `true` after the revoke is
equally consistent with a probe that is stuck-true. And the ACL the revoke *materialised* on the
NULL-proacl function is the tell — `=X/postgres,postgres=X/postgres`, where **the leading `=X/`
with an empty grantee IS the surviving `PUBLIC` grant**. Postgres wrote the default out
explicitly and removed the row it was asked to remove; there was never an `authenticated` row.

⚠ **And note which function the probe happened to select: `app.can_read_event_patient`** — a
Rule 12 PHI-module read predicate. The no-op class is not confined to inert helpers, so
"concentrated in UNCHANGED" bounds the *coverage* consequence, not the *sensitivity* of the
members.

⭐ **The execution consequence, stated once:** a batch written as `REVOKE EXECUTE … FROM
authenticated` will report success and change nothing for 137 of 233, and no gate would notice —
the arms would return identical verdicts because the privilege never moved. Whoever executes
these batches must probe `has_function_privilege` **after** each one and treat an unmoved
predicate as a failure, not as idempotence. This is the fifth sighting of *a NULL `proacl`
includes PUBLIC* in this repo.

---

## 6. RV3 — does Postgres re-check EXECUTE on a function inside a stored CHECK expression at write time?

⚠ **RV3's exclusion bound nothing — say so plainly, not as "RV3 satisfied".** The 5 functions
(`app.is_valid_condition`, `app.is_valid_visibility`, `app.is_valid_validation_config`,
`app.is_valid_cpf`, `app.is_valid_recommend_when`) across 8 CHECK constraints (`form_items`,
`form_sections`, `form_item_validations`, `case_phases`, `process_template_phases`,
`professional_profiles`, `profiles`) are confirmed **absent** from the 233-function revoke set
(checked against the same list this file partitions — zero hits). RV3's "excluded from every
batch until answered" instruction was therefore a correctly-stated precaution applied to a set
that turned out to be **empty** — no function in §5 was actually held out by it, and no verdict
in §5 moved because of it. That is different from the filter having been exercised and found
nothing to exclude; it never had a candidate to consider in the first place. Reporting this as
"RV3 satisfied" would imply a filter did work it never did.

⚠ **The underlying question stays open regardless, and still gates future revokes**: whether
Postgres re-checks EXECUTE on a function inside a stored CHECK expression at write time. It is
answered here — cheap now, expensive to reconstruct later — because the next phase that revokes
anything touching a constraint-referenced function will need it, not because anything in this
partition depended on it.

**Method, exactly as the task authorizes and no more:**
- Everything inside ONE transaction, rolled back at the end. `CREATE ROLE` is transactional.
- A fresh, single-purpose probe role, granted only what is needed to attempt the write (and
  `BYPASSRLS`, to isolate the CHECK-constraint-function privilege question from RLS — a
  confound this experiment is not trying to measure).
- `REVOKE EXECUTE` on the target function from the probe role and from `PUBLIC`, with a positive
  `has_function_privilege` check that the revoke actually landed before attempting the write (a
  `REVOKE` you are not entitled to make is a silent no-op).
- The write attempted is a value that would **pass** the CHECK's own logic were it evaluated —
  isolating "was EXECUTE checked" from "did the CHECK's business logic reject the value".
- After `ROLLBACK`, two independent residue checks, reported as measurements: `pg_roles` for the
  probe role (expect: absent) and `has_function_privilege` for the real roles on the real function
  (expect: unchanged from the pre-experiment baseline).

**Answer: YES — PostgreSQL DOES re-check `EXECUTE` at write time, for both function languages.**

A role that lacks `EXECUTE` on a function referenced inside a stored `CHECK` expression **cannot
write the constrained table at all**. The write fails with **`42501 permission denied for
function <name>`** — *not* the constraint's own `23514`, and *not* silently succeeding. Measured
on both language classes, because the two could plausibly differ and 4 of RV3's 5 functions are
`sql`:

| arm | probe function | language | inlinable by the planner | result of the write |
| --- | --- | --- | :---: | --- |
| **A** | `app.is_valid_cpf(text)` | `plpgsql` | no | **`ERROR: permission denied for function is_valid_cpf`** |
| **B** | `app.is_valid_recommend_when(jsonb)` | `sql` | **yes** | **`ERROR: permission denied for function is_valid_recommend_when`** |

**⇒ Inlining does not change the answer.** A `LANGUAGE sql` function that the planner may inline
is checked just the same.

**The controls, which are what make the answer load-bearing rather than an anecdote:**

| step | what it establishes | measured |
| --- | --- | --- |
| A0 precondition | the probe role genuinely lacks `EXECUTE` — positively checked *before* the write, so a failure cannot be mistaken for an unrelated denial | `has_function_privilege('rv3_probe', …) = false` ✅ |
| A1 experiment | valid value, no `EXECUTE` | **denied — `42501`** |
| **A2 differential** | **flip exactly ONE variable** — `GRANT EXECUTE … TO rv3_probe` — and re-run A1 **verbatim** | grant landed (`= true`), **`INSERT` SUCCEEDED, 1 row** |
| A3 negative control | with `EXECUTE` granted, an **invalid** value | **rejected — `23514` check constraint `rv3_a_ck`** |
| B1 revoke landed | ARM B's function has `proacl IS NULL`, so `PUBLIC` held `EXECUTE`; the `REVOKE` from `PUBLIC` **and** the probe was positively verified before the write | both `has_function_privilege` → `false` ✅ |
| B2 control | the same valid value inserts fine as superuser | 1 row ✅ |
| B3 experiment | probe writes that value without `EXECUTE` | **denied — `42501`** |

A2 and A3 together are the differential that makes this a measurement rather than a coincidence:
**A2** proves the denial in A1 is caused by the `EXECUTE` grant and by nothing else (same role,
same statement, same value, one privilege changed); **A3** proves the `CHECK` is genuinely being
*evaluated* rather than skipped — a skipped constraint would also have let the valid value
through, for entirely the wrong reason.

⚠ **A first attempt of this experiment proved nothing and looked like it had run.** Executed as
`postgres`, every `SET ROLE` returned `ERROR: permission denied to set role "rv3_probe"` —
`postgres` is **not** a superuser on this stack — after which the aborted transaction reported
`current transaction is aborted, commands ignored` for the actual experiment. The run produced
output at every step and the residue checks still passed. It was re-run as **`supabase_admin`**
(the real superuser, the same role `psql_admin()` uses in the harness). Anyone repeating this
must run it as `supabase_admin`, and must read the positive control's SQLSTATE rather than the
mere presence of an error.

**Deviation from the method above, in the safe direction, stated rather than hidden:** ARM A
needed **no `REVOKE` at all**. `app.is_valid_cpf`'s ACL is
`{postgres=X,authenticated=X,service_role=X}` — `PUBLIC` holds no `EXECUTE`, so a brand-new role
lacks it *inherently*. The method's "`REVOKE`, then positively check it landed" became
"positively check the probe role lacks it" — the same precondition, positively verified, with
**zero privilege mutation on any real object**. ARM B did need the `REVOKE` (its `proacl` is
`NULL`, i.e. the default ACL, which grants `EXECUTE` to `PUBLIC`) and performed it exactly as
specified, inside the same rolled-back transaction.

**Residue checks after `ROLLBACK` — all three clean, reported as measurements:**

| check | expected | measured |
| --- | --- | --- |
| `pg_roles` rows named `rv3_probe` | 0 | **0** ✅ |
| probe tables `public.rv3_a` / `public.rv3_b` | absent | **both `to_regclass` → NULL** ✅ |
| `app.is_valid_cpf` ACL | unchanged from baseline | **`{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`** — byte-identical to the pre-experiment capture ✅ |
| `app.is_valid_recommend_when` ACL | unchanged from baseline | **back to `NULL` (default acl)**; `anon` and `PUBLIC` both `true` again, as before the `REVOKE` ✅ |

### 6.1 What this binds — and what it does not

- ⛔ **Revoking `authenticated` `EXECUTE` on any of the 5 constraint-referenced functions would
  break every `INSERT`/`UPDATE` touching the constrained column, for that role, on all 8
  tables** — `form_items` (×2: `required_if`, `visible_when`), `form_sections`,
  `form_item_validations`, `case_phases`, `process_template_phases`, `professional_profiles`,
  `profiles`. That includes the signup path (`profiles.cpf`) and all form authoring. The failure
  is a hard `42501`, immediate and total, not a subtle coverage loss.
- ✅ **Nothing in §5 moves.** As §6's opening states, all 5 functions are **absent from the 233**
  — re-verified here independently against the freshly re-extracted list (`0` hits for each of
  `is_valid_condition`, `is_valid_visibility`, `is_valid_validation_config`, `is_valid_cpf`,
  `is_valid_recommend_when`). RV3's exclusion still bound **nothing**; this answer is banked for
  the next phase that revokes something a constraint references, exactly as §6 says.
- ⚠ **The 8 constraints were re-derived from `pg_constraint`, not read off the plan** — a
  `pg_get_constraintdef` sweep for the 5 names returns exactly 8 rows, confirming the count.
- ⚠ **Scope of the claim.** This was measured for `CHECK` constraints. It says nothing about
  index expressions, generated columns, or `DEFAULT` expressions, which are separate mechanisms
  and were not tested. Do not generalize it to them without measuring.

### 6.2 Transcript — the exact script that was run

Run as **`supabase_admin`** (not `postgres` — see the warning above), once, verbatim:

```bash
docker exec supabase_db_azkbbhskturikxpgmafq \
  psql -U supabase_admin -d postgres -P pager=off -f /tmp/rv3b.sql
```

```sql
-- ============================================================================
-- RV3, arms A and B. ONE transaction, rolled back. Residue checked after.
--   ARM A — app.is_valid_cpf(text): LANGUAGE plpgsql (NOT inlinable), proisstrict=f,
--           PUBLIC holds no EXECUTE ⇒ a fresh role lacks it inherently, so ARM A
--           mutates NO real object's ACL at all.
--   ARM B — app.is_valid_recommend_when(jsonb): LANGUAGE sql (INLINABLE by the
--           planner), proacl IS NULL ⇒ PUBLIC holds EXECUTE, so this arm must
--           actually REVOKE from PUBLIC (§6's method) and positively check it landed.
--           Inlining is the reason this arm exists: 4 of RV3's 5 functions are `sql`,
--           and an inlined body could plausibly skip the wrapper's EXECUTE test.
-- ============================================================================
\set ON_ERROR_STOP off
begin;

create role rv3_probe nologin bypassrls;
grant usage on schema app, public to rv3_probe;

create table public.rv3_a (id int primary key, cpf text,
  constraint rv3_a_ck check ((cpf is null) or app.is_valid_cpf(cpf)));
create table public.rv3_b (id int primary key, rw jsonb,
  constraint rv3_b_ck check (app.is_valid_recommend_when(rw)));
grant select, insert on public.rv3_a, public.rv3_b to rv3_probe;

-- ══════════ ARM A — plpgsql, not inlinable ══════════════════════════════════════
select 'A0_precondition' as step,
       has_function_privilege('rv3_probe','app.is_valid_cpf(text)','EXECUTE') as probe_exec_MUST_BE_F;

-- A1: probe writes a VALID value while lacking EXECUTE.
savepoint a1; set local role rv3_probe;
insert into public.rv3_a values (1,'52998224725');
select 'A1_no_execute_valid_value' as step, 'INSERT SUCCEEDED' as result;
rollback to savepoint a1;

-- A2: flip EXACTLY ONE variable — grant the probe EXECUTE — and repeat A1 verbatim.
savepoint a2;
grant execute on function app.is_valid_cpf(text) to rv3_probe;
select 'A2_grant_landed' as step,
       has_function_privilege('rv3_probe','app.is_valid_cpf(text)','EXECUTE') as probe_exec_MUST_BE_T;
set local role rv3_probe;
insert into public.rv3_a values (2,'52998224725');
select 'A2_with_execute_valid_value' as step, 'INSERT SUCCEEDED' as result,
       (select count(*) from public.rv3_a where id=2) as rows_written;
reset role;
-- A3: same role, same grant, INVALID value — the constraint must still bite (23514),
--     proving the CHECK is genuinely evaluated and not merely skipped.
savepoint a3; set local role rv3_probe;
insert into public.rv3_a values (3,'12345678900');
select 'A3_with_execute_INVALID_value' as step, 'INSERT SUCCEEDED (constraint NOT enforced!)' as result;
rollback to savepoint a3;
rollback to savepoint a2;

-- ══════════ ARM B — sql, inlinable ══════════════════════════════════════════════
select 'B0_before_revoke' as step,
       has_function_privilege('rv3_probe','app.is_valid_recommend_when(jsonb)','EXECUTE') as probe_exec,
       has_function_privilege('public','app.is_valid_recommend_when(jsonb)','EXECUTE')    as public_exec,
       (select proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='app' and p.proname='is_valid_recommend_when')                   as proacl;

revoke execute on function app.is_valid_recommend_when(jsonb) from public;
revoke execute on function app.is_valid_recommend_when(jsonb) from rv3_probe;

-- ⚠ a REVOKE you are not entitled to make is a silent no-op — check it LANDED.
select 'B1_revoke_landed' as step,
       has_function_privilege('rv3_probe','app.is_valid_recommend_when(jsonb)','EXECUTE') as probe_exec_MUST_BE_F,
       has_function_privilege('public','app.is_valid_recommend_when(jsonb)','EXECUTE')    as public_exec_MUST_BE_F;

-- B2: control — a valid value inserts fine as superuser.
insert into public.rv3_b values (0, '{"from_phase":1,"question_key":"k","op":"equals","value":"v"}'::jsonb);
select 'B2_control_valid_as_superuser' as step, count(*) as rows from public.rv3_b where id=0;

-- B3: the probe writes that same valid value while lacking EXECUTE.
savepoint b3; set local role rv3_probe;
insert into public.rv3_b values (1, '{"from_phase":1,"question_key":"k","op":"equals","value":"v"}'::jsonb);
select 'B3_no_execute_valid_value_SQLFN' as step, 'INSERT SUCCEEDED' as result;
rollback to savepoint b3;

reset role;
rollback;

-- ══════════ RESIDUE ═════════════════════════════════════════════════════════════
select 'RESIDUE_role' as step, (select count(*) from pg_roles where rolname='rv3_probe') as must_be_0;
select 'RESIDUE_tables' as step,
       to_regclass('public.rv3_a') is null as a_gone_MUST_BE_T,
       to_regclass('public.rv3_b') is null as b_gone_MUST_BE_T;
select 'RESIDUE_privs' as step, p.proname,
       has_function_privilege('authenticated', p.oid,'EXECUTE') as authenticated,
       has_function_privilege('service_role',  p.oid,'EXECUTE') as service_role,
       has_function_privilege('anon',          p.oid,'EXECUTE') as anon,
       has_function_privilege('public',        p.oid,'EXECUTE') as public_,
       coalesce(p.proacl::text,'<NULL = default acl>')          as proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='app' and p.proname in ('is_valid_cpf','is_valid_recommend_when')
order by p.proname;
```

Observed output, abridged to the deciding lines (full run reproduced the residue table above):

```text
A0_precondition        | probe_exec_must_be_f = f
SAVEPOINT / SET
psql:/tmp/rv3b.sql:30: ERROR:  permission denied for function is_valid_cpf      <- A1
A2_grant_landed        | probe_exec_must_be_t = t
INSERT 0 1
A2_with_execute_valid_value | INSERT SUCCEEDED | rows_written = 1              <- A2
psql:/tmp/rv3b.sql:47: ERROR:  new row for relation "rv3_a" violates check
                               constraint "rv3_a_ck"                           <- A3
B0_before_revoke       | probe_exec = t | public_exec = t | proacl = <NULL>
REVOKE / REVOKE
B1_revoke_landed       | probe_exec_must_be_f = f | public_exec_must_be_f = f
B2_control_valid_as_superuser | rows = 1
psql:/tmp/rv3b.sql:73: ERROR:  permission denied for function
                               is_valid_recommend_when                          <- B3
RESIDUE_role   | must_be_0 = 0
RESIDUE_tables | a_gone = t | b_gone = t
RESIDUE_privs  | is_valid_cpf            | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
RESIDUE_privs  | is_valid_recommend_when | <NULL = default acl>
```

---

## 7. What did not survive contact with the code

- `docs/plans/authz-ae1-person-doors.md` §10's domain table is accurate for floor/census/wrapper/hat
  as written, but its one-line gloss of `policy`'s domain ("plus two hand lists for the write path")
  does not name them — reading the actual script surfaced the `GUARD_KEYS` name-rescue (§2.1), which
  changes 5 verdicts from what a catalog-property-only derivation would have produced.
- **The measured head was not the planned head, and the file said so about itself.** This was
  derived at `20261003005300`, not the `20261003004400` the planning text assumed (§ header).
  Every §5 number is a fresh derivation at the later head; nothing was patched onto the earlier
  draft's arithmetic. That the totals still reproduce §7.1's 134/43/52/4 and §7.4's 20/3/3 is a
  result, not an assumption — AE1.3's and AE1.5's migrations landing in between could have moved
  them and did not.
- **Four of the eight `file:line` citations in §2 had drifted** (§2.0), the worst by 8 lines.
  Every *predicate* was unchanged, so no verdict moved — but the citations were re-derived rather
  than trusted, and the drift is recorded instead of quietly fixed. `act-hat-blind-sweep.sh`'s
  `:189` now points into the middle of a `regexp_matches` clause, not the domain `where`.
- **The `wrapper` row's cited line does not contain the cited predicate.** `run_arm_wrapper()`
  delegates to `p0-authz-invoker-audit.sh`; the `public` + `NOT prosecdef` shape is spelled out in
  `run_arm_census()`'s second clause. The conclusion is unchanged but now rests on **measuring**
  `prosecdef` for all 233 (CHECK C: 233/233) rather than on the phrase "by construction" — which
  is the kind of premise that is true until a migration makes it false with nothing to notice.
- ⚠ **The 33-entry write-policy snapshot's "adds nothing" was an assertion; it is now a
  measurement, and it is closer than it reads.** The snapshot references 15 functions and the
  intersection with the 233 is empty — but it contains `app.commission_of_meeting` while the 233
  contain five sibling `commission_of_*` helpers, and `app.is_staff_admin_of_for` while the 233
  contain seven sibling `is_*_of_for` helpers. This is precisely the `X` / `X_for` trap §7.3 of
  the classification names as "the recorded trap"; the sets miss each other by one identifier.
- ⭐ **A premise stated as "by construction" was worth measuring, and one of them was wrong in a
  way that matters.** "All 233 currently hold `authenticated` EXECUTE" is true (233/233) — but
  for **137 of them the only route is `PUBLIC`**, so the proposed `REVOKE … FROM authenticated`
  is a **silent no-op** (§5.6). No verdict changes, because RV0's question is counterfactual, but
  an execution plan that assumed 233 effective revokes would have been wrong about 137 of them
  and would have had nothing to contradict it — the resulting "revoke applied, no change
  observed" reads exactly like success.
- ⛔ **RV3's answer is the opposite of the permissive assumption, and it is a hard blocker for
  future revokes.** Postgres **does** re-check `EXECUTE` on a function inside a stored `CHECK`
  expression at write time, for inlinable `sql` functions as well as `plpgsql` (§6). Revoking on
  any constraint-referenced function breaks writes to every table carrying that constraint with a
  `42501`. It bound nothing here only because all 5 such functions are outside the 233.
- ⚠ **The RV3 experiment's first run proved nothing while producing output at every step**
  — `postgres` is not a superuser on this stack, so every `SET ROLE` was denied and the real
  experiment never executed; the residue checks still passed. It was re-run as `supabase_admin`.
  A run of this shape must be read by its positive control's SQLSTATE, never by "an error
  appeared where one was expected".

## 8. Stated as unmeasured

Named rather than approximated, per the file's own standard:

- **Durability of the `GUARD_KEYS` rescue.** §5.3 measures that all 11 names resolve *today*.
  Nothing here can measure whether a future rename evicts one — a `.sh` hand list has no gate
  that reds on that. The verdict split (name- vs property-rescued) is the mitigation, not a fix.
- **Whether the 23 HOLD functions are actually *unsafe*.** RV0 measures **observability**, not
  reachability or exploitability. HOLD means "no arm would sweep it after the revoke" — it is an
  absence of coverage, not a finding of vulnerability, and the reverse inference ("UNCHANGED ⇒
  fine") is exactly what §1 refuses to make.
- **The 161 `UNCHANGED` rows.** No arm examined them before or after. Their safety rests on the
  *class* argument (trigger bodies are not directly callable; `app` is not PostgREST-exposed),
  which this file did not re-derive — §7.1 flags that same argument as "the plan's own class
  definition, not something this task measured", and that remains true.
- **Index expressions, generated columns and `DEFAULT` expressions.** RV3 measured `CHECK`
  constraints only (§6.1). The other three are separate mechanisms and were not tested.
- **Behaviour under an actual revoke.** Everything here is simulated in the predicate. No
  `REVOKE` was applied to any of the 233, and no pgTAP/E2E run was made against a revoked state,
  so the *runtime* consequence of the batches remains predicted, not observed.

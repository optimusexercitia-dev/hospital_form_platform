# QO·B — org_admin content wall: catalog inventory & classification (step ①)

**Decision record:** ADR [0100](../decisions/0100-quality-office-oversight.md) **D12**.
**Plan:** [quality-office-oversight.md](./quality-office-oversight.md) § "Phase B".
**Status:** ✅ **RATIFIED 2026-08-08** (§6) — D12 step ② satisfied, migrations authorized.
**Build state:** **M1–M4 all landed** (`20260915000000`–`000300`) — response plane ·
documents/printed · indicator measurements · case-plane write doors. A/B matrix clean on a
clean seed; pgTAP **174 / 5502 / PASS** on a fresh reset (326 registered == 326 files);
BUG-QOB-001 and BUG-QOB-002 both closed and behaviourally re-proven.
**Still open before the §6 gate:** mutation audit (`b1-org-admin-wall-mutation-audit.sh`),
the diff-scoped ADR 0079 door sweep + `ARM=census`/`ARM=floor`, new pgTAP suites for the
wall itself, E2E, and `qa` review. Rulings Q8/Q9 (case-access + governance doors) were
ratified 2026-08-08 and are recorded in M4's header.
**Derived:** 2026-08-08, from the **live catalog** of the local stack
(`supabase_db_azkbbhskturikxpgmafq`), 322 registered == 322 files.

> **Evidence markers.** **[MEAS]** = measured by execution against the seeded DB (a real
> principal, a real row count, a discriminating control). **[CAT]** = read from
> `pg_policies` / `pg_proc` / `pg_get_functiondef`. **[JUDGE]** = a
> content-vs-configuration judgement — *this is what the PO is being asked to ratify*.
> Per CLAUDE.md's graphify exception, **no claim here comes from migration file text.**

---

## 1. The finding that reframes Phase B

**[CAT] `app.is_commission_admin_of(_for)` is not the commission's own admin — it is the
tenancy admin.** Its body is, verbatim from `pg_get_functiondef`:

```sql
select app.is_active(p_user_id) and exists (
  select 1 from public.commissions c
  where c.id = p_commission_id
    and ( app.has_role('organization', c.organization_id, 'org_admin',      p_user_id)
       or app.has_role('hospital',     c.hospital_id,     'hospital_admin', p_user_id) ) );
```

**[MEAS]** against CCIH: `org_admin` → `true`, `hospital_admin` → `true`,
**`staff_admin` (`chefe.ccih`) → `false`.** The committee's own coordinator is admitted by
a *different* predicate (`app.is_staff_admin_of`), which sits beside it as a separate
disjunct in essentially every policy:

```
forms_staff_admin_write  ->  app.is_staff_admin_of(commission_id) OR app.is_commission_admin_of(commission_id)
```

**Consequence for the wall: the cut is clean.** Removing the `is_commission_admin_of`
disjunct subtracts *exactly* org_admin + hospital_admin and leaves the committee's own
staff_admin arm untouched. That is the mechanical shape of nearly every edit in §4.

⚠ **The name has misled every reader of this codebase, including this plan's own
predecessors.** Renaming it (e.g. `app.is_tenancy_admin_of`) is proposed as **Q6** in §6.

## 2. Population (the raw structural read — *not* the fix list)

| Surface | Count | Source |
|---|---|---|
| Policies routing an admin predicate | **87** | `pg_policies` [CAT] |
| Functions routing an admin predicate | **144** | `pg_proc`, comment-stripped `prosrc` [CAT] |
| — of which SECURITY DEFINER | 119 | `prosecdef = t` |
| — of which INVOKER (`prosecdef = f`) | 25 | ⚠ see §5.3 |
| Boolean predicates in the closure | 29 | transitive, depth ≤ 5 |

Per the A4 precedent this is **a raw reading, not the population** — A4's own structural
sweep read 36 `FOR ALL` policies and the real target set was different. Classification in
§4 is per-item.

## 3. What org_admin and hospital_admin actually reach today [MEAS]

> ⚠ **CORRECTION (2026-08-08, during the M3 build).** The absolute counts in §3 and §3.1
> were measured on a **live, E2E-mutated** local DB (the stack had been up for hours and
> carried leftover rows from prior test runs), **not on a fresh `supabase db reset`**.
> The mechanism, the controls and every qualitative finding are unaffected — but the
> numbers are inflated. On a **clean seed** the same measurement is:
>
> | Table | org_admin | hospital_admin | staff_admin | staff |
> |---|---|---|---|---|
> | `responses` | **13** | **13** | 7 | 5 |
> | `answers` | **50** | **50** | 26 | 15 |
> | `answer_selected_options` | **47** | **47** | 29 | 18 |
> | `indicator_measurements` | 8 | 8 | 8 | 8 |
> | `printed_documents` | **0** | 0 | 0 | 0 |
>
> The headline holds on the clean seed — the tenancy admins still read roughly **twice**
> what the committee's own coordinator does. `printed_documents` holds **zero** rows in a
> clean seed, so M2's cut there is **not observable in the A/B matrix**; it is covered
> instead by pgTAP `312`/`313`, which build their own fixtures.
>
> How this was caught: a `db reset` ran between the M2 and M3 captures, so the pre-image
> and post-image came from different populations and the diff reported ~700 spurious
> LOST + ~300 spurious GAINED cells, including on the KEEP side. The matrix was rebuilt
> by holding all three migrations out, resetting, capturing, re-applying and re-capturing
> — which is the only baseline this program should cite. **A/B baselines are invalidated
> by a reset; capture and compare within one DB lifetime.**

Measured under `set local role authenticated` with real JWT claims, in a rolled-back
transaction. `staff_admin (chefe.ccih)` and `staff (staff1.ccih)` are the controls.

| Table | org_admin | hospital_admin | staff_admin *(control)* | staff *(control)* |
|---|---|---|---|---|
| `responses` | **36** | **36** | 25 | 23 |
| `answers` | **81** | **81** | 49 | 32 |
| `controlled_documents` | 3 | 3 | 2 | — |
| `controlled_document_versions` | 3 | — | — | — |
| `forms` | 13 | 13 | — | — |
| `form_items` | 40 | — | — | — |
| `indicator_measurements` | 8 | — | — | — |
| `printed_documents` | 6 | 6 | — | — |
| `process_templates` | 8 | — | — | — |
| `cases` | **0** | **0** | 26 | — |
| `case_events` / `meetings` / `phase_results` | **0** | — | (1 meeting) | — |

**Two things to read off this table.**

1. **The tenancy admins read more committee content than the committee's own
   coordinator does** (36 responses vs 25; 81 answers vs 49) — because they span every
   commission in the org/hospital while the coordinator holds one. This is precisely the
   over-reach D12 exists to remove.
2. **The case plane is already walled** — `cases` = 0, `can_read_case` = `false`
   [MEAS]. A4 did that job and it holds. Phase B is the *rest* of the surface, plus §5.1.

### 3.1 ⛔ `responses_admin_all` is live, FOR ALL, and destructive

**[CAT]** the policy is a bare tenancy-admin grant with no other term:

```
responses :: responses_admin_all [ALL]  ->  app.is_commission_admin_of(commission_id)
```

**[MEAS]** as `orgadmin.a`, in one rolled-back transaction:

- `DELETE FROM responses WHERE status='in_progress' AND created_by <> me` → **`DELETE 6`**,
  removing in-progress drafts owned by `staff1`, `staff2` and others.
- The same principal reads **9** of those users' draft `answers`.
- **Control:** the identical statement as plain `staff` → **`DELETE 0`** (RLS filtered the
  rows away entirely). The probe discriminates.
- On **submitted** rows the delete is stopped — but by the `guard_submitted_response`
  **trigger**, not by RLS. The policy admitted the row; a data-integrity guard caught it.

So the only thing standing between an org_admin and another user's submitted work is a
trigger written for a different purpose, and for **in-progress** work there is nothing at
all. Severity call → **Q5** in §6.

## 4. Classification — the list the PO is asked to ratify

**Legend:** ✂ **CUT** = remove the `is_commission_admin_of` / `is_org_admin_of` /
`is_hospital_admin_of` arm. 🔒 **KEEP** = configuration, administration, or a PHI-free
aggregate — explicitly retained per D12 ⑥. ❓ = **[JUDGE]**, a genuine PO call (§6).

### 4.1 ✂ CUT — response & answer content (the headline)

`responses` (`responses_admin_all`, `responses_select`) · `answers` ·
`answer_selected_options` · `answer_matrix_cells` · `answer_references` ·
`answer_risk_matrix` · `response_group_instances` · `phase_results`

Doors: `dashboard_free_text` **[MEAS: 7 rows to org_admin]** · `dashboard_export_rows`
**[MEAS: 8 rows]** · `dashboard_completion_by_member` · `get_response_for_signoff` ·
`supersede_response` · `target_case_response` · `file_correction_request` ·
`review_correction` · `reject_correction` · `withdraw_correction`

> The three row-level dashboard doors are the same three D11 already rules must stay
> closed to the quality_reviewer. Cutting them here makes the two tiers consistent.

### 4.2 ✂ CUT — controlled-document content

`controlled_documents` · `controlled_document_versions` · `document_approvals` ·
storage `controlled_documents_obj_select_member` / `_insert_writable`

Doors: `create_controlled_document` · `update_controlled_document` · `publish_document` ·
`mark_document_obsolete` · `supersede_document` · `submit_document_for_approval` ·
`set_document_version_file` · `list_commission_documents` **[MEAS: 2 rows]** ·
`documents_due_for_review` · `remind_document_approver`

### 4.3 ✂ CUT — printed documents & attachments

`printed_documents` **[MEAS: 6 rows]** · `revoke_printed_document` ·
`app.can_view_printed_document` · `app.can_write_attachment` · `reclassify_attachment` ·
`soft_delete_attachment`

### 4.4 ✂ CUT — case-plane **write** doors (read is already cut; see §5.1)

`update_case_meta` · `create_case` · `create_case_from_template` · `close_case` ·
`cancel_case` · `reopen_case` · `set_case_visibility` · `set_case_confidentiality` ·
`update_case_custom_field_values` · `conclude_narrative` · `unassign_narrative` ·
`update_case_narrative_body` · `delete_ad_hoc_case_narrative` · `delete_ad_hoc_case_phase` ·
`reassign_phase` · `set_case_phase_result_override` · `set_case_participant_role` ·
`remove_case_participant` · `set_primary_subject` · `set_case_outcome` ·
`grant_case_access` · `revoke_case_access` · `list_case_access` · `record_recusal` ·
`lift_recusal` · `create_interview` · `schedule_ethics_hearing` · `get_case_detail` ·
`list_my_cases` · `case_viewer_capabilities` · `case_tag_report` · `dispose_case_phi`

### 4.5 🔒 KEEP — tenancy, identity, vocabulary, audit (the "noun" surface)

`commissions` · `hospitals` · `hospital_departments` · `organizations` · `memberships` ·
`profiles` · `hospital_affiliations` · `case_types` · `case_type_terminology` ·
`case_participant_roles` · `standard_ownerships` · `professional_credentials` ·
`commission_member_titles` · `commission_administrativos` · `audit_log`

Doors: `list_org_people` · `list_org_eligible_users` · `list_addable_commission_members` ·
`grant_member_capability` · `revoke_member_capability` · `revoke_administrativo` ·
`set_commission_oversight` · `reorder_departments` · `set_standard_ownership` ·
`verify_audit_chain` · `list_approver_candidates` · `app.can_manage_professional` ·
member-title CRUD (`create/rename/delete/reorder_member_title(s)`)

### 4.6 🔒 KEEP — PHI-free aggregates (D12 ⑥, explicit)

`dashboard_distributions` · `dashboard_entity_references` · `dashboard_form_totals` ·
`dashboard_matrix_cells` · `dashboard_risk_scores` · `dashboard_submissions_over_time` ·
`hospital_readiness` · `hospital_indicator_rollup` · `hospital_document_register` ·
`indicator_kpis` · `indicator_series` · `commission_overview`

### 4.7 ❓ Genuinely undecided — these are the PO's calls

| # | Family | The question |
|---|---|---|
| **a** | **Form definitions** — `forms`, `form_versions`, `form_sections`, `form_items`, `form_item_options`, `form_item_validations`, `form_matrix_rows/columns`, `form_block_library` (+ `set_item_validations`, `upsert_matrix_axes`, block-library CRUD) | The *instrument*, not the answers. Is authoring a committee's checklist **configuration** an org_admin may do, or **committee content** they may not? [MEAS] org_admin currently reads 13 forms / 40 items and holds **write** via `forms_staff_admin_write`. |
| **b** | **Process templates** — the 9-policy `process_template_*` family (+ `set_process_outcomes`) | Same shape as (a), one level more abstract. [MEAS] org_admin reads 8. |
| **c** | **Indicators** — `indicators` + `indicator_measurements`; `create_indicator`, `update_indicator`, `set_indicator_target`, `record_indicator_measurement`, `compute_derived_measurement` | The *definition* looks like configuration; the *measurement* is quality data. Split the family, or treat as one? [MEAS] org_admin reads 8 measurements. |
| **d** | **Committee taxonomy** — `case_tags`, `case_outcomes`, `case_narrative_types`, `commission_meeting_types`, `commission_meeting_settings`, `phase_results` vocab (+ their create/rename/reorder/archive doors) | Per-committee vocabulary. Configuration (like `case_types`, kept) or the committee's own to control? |
| **e** | **Meetings** — `commission_meeting_settings`, `update_meeting_settings`, `create/rename/archive_meeting_type` | [MEAS] org_admin reads **0 meetings** — the content is already unreachable. Only the *settings/type* config arms remain. Cut for symmetry, or leave as configuration? |

## 5. Three things the classification alone would miss

### 5.1 ⛔ org_admin can WRITE case content it cannot READ

**[MEAS], one transaction, same principal:**

- `get_case_detail(case_a)` → **denied**, `caso … não encontrado`; `cases` → **0 rows**.
- `update_case_meta(case_a, 'PHASE-B-PROBE', …)` → **SUCCEEDED**; the case was renamed.

**[CAT]** the door's authority block is
`if app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)` and it
**never consults `can_read_case`** — it reads `public.cases` directly inside SECURITY
DEFINER, so RLS never applies.

A4 narrowed the read plane (policies + 4 functions) and **left the write doors on the
tenancy-admin predicate.** The result is a write-without-read asymmetry on case content
that survives today. This is the same class ADR 0100's standing rule names — *conferring
(here: retaining) a capability requires enumerating its consumers* — and it is why §4.4
exists as its own block. Severity → **Q5**.

### 5.2 The consumer axis (ADR 0100's standing rule, applied *subtractively*)

Phase A leaked three times by enumerating arms that must **change** without enumerating
who **consumes** the bit. Phase B is the mirror image: it **removes** a principal from
predicates that other surfaces consume. The dangerous direction here is **over-cut**, not
under-cut — a shared predicate cut for the content case that some legitimate
configuration surface also routes.

`is_commission_admin_of` has **144 function consumers and 87 policy consumers**. §4 is
therefore written per-item, and the §4.5/4.6 KEEP lists are as load-bearing as the CUT
lists. The A/B equivalence matrix (step ④) is what proves it: **LOST = only the ratified
cells, GAINED = 0.**

### 5.3 ⚠ 25 of the 144 doors are INVOKER (`prosecdef = f`)

`close_case`, `cancel_case`, `set_case_outcome`, `update_case_narrative_body`,
`update_meeting_settings`, `update_phase_result`, the taxonomy CRUD family, and others run
as the **caller**, so their security is the caller's RLS plus a hand-written probe. These
are exactly the shape of open item **#4 AUDIT-INVOKER-WRAPPER** in PROGRESS.md — the
standing ADR 0079 sweep floors `prosecdef = t` and cannot see them. Any cut in this set
must be verified **behaviourally**, because neutralizing a gate they don't own proves
nothing.

## 6. ✅ PO ratification — RATIFIED 2026-08-08

**The gate is passed.** D12 step ② is satisfied; migrations are authorized. Rulings:

| # | Question | **PO ruling** |
|---|---|---|
| Q1 | Form definitions (§4.7a) | **KEEP as configuration.** Not in D12's content enumeration; hold no answers and no PHI. |
| Q2 | Process templates (§4.7b) | **KEEP as configuration** (follows Q1). |
| Q3 | Indicators (§4.7c) | **SPLIT** — keep the *definition* (`indicators`, `create/update_indicator`, `set_indicator_target`); **cut the *measurement*** (`indicator_measurements`, `record_indicator_measurement`, `compute_derived_measurement`). Aggregates stay per D12 ⑥. |
| Q4 | hospital_admin | **Same wall as org_admin.** Both are admitted by the same predicate and measure identically; walling only org_admin would leave a documented bypass. |
| Q5 | Severity of the two live defects | **File both as bugs now, fix in Phase B.** → **BUG-QOB-001** (fixed by M1) and **BUG-QOB-002** (pending M4). |
| Q6 | Rename `is_commission_admin_of` → `is_tenancy_admin_of` | **Yes, but as a SEPARATE wave AFTER Phase B lands** — a rename rewrites nearly every body Phase B also edits, confounding the equivalence matrix. |
| Q7 | Taxonomy & meetings (§4.7d/e) | **KEEP both as configuration.** Consistent with Q1 and with `case_types`. Rule: *org_admin shapes the containers, never reads what goes in them.* |

⚠ **One correction to §4.1 made during build:** `phase_results` is **commission VOCABULARY**
(`id, commission_id, label, color_token, is_adverse, archived, position`), not per-case
results, so under Q7 it is **KEEP**, not CUT. §4.1 listed it wrongly. `case_participant_roles`
is likewise org-level vocabulary → KEEP. Verified from `information_schema.columns`.

### 6.1 Original questions (kept for the record)

1. **Q1 — Form definitions (§4.7a):** cut or keep?
2. **Q2 — Process templates (§4.7b):** cut or keep? (default: follow Q1)
3. **Q3 — Indicators (§4.7c):** split definition/measurement, cut both, or keep both?
4. **Q4 — hospital_admin:** D12 says *"the same wall is evaluated for hospital_admin
   during the inventory."* [MEAS] its reach is **identical** to org_admin's (36/81/3/13/6).
   Same wall, or does hospital_admin keep content within its own hospital?
5. **Q5 — §3.1 + §5.1 severity:** are the live in-progress-response deletion and the
   case-content write-without-read **bugs to file now**, or simply Phase B's scope?
6. **Q6 — rename `is_commission_admin_of` → `is_tenancy_admin_of`?** It has misread as
   "the committee's admin" in this program's own planning documents. A rename is a
   mechanical catalog change with a real regression surface (memory: *a parameter rename is
   a privilege reset*; a rebuild silently loses the ACL) — worth it, or leave it?
7. **Q7 — taxonomy & meetings (§4.7d, §4.7e):** cut or keep?

## 6.2 Gate evidence so far (QO·B build, 2026-08-08)

| Gate | Result |
|---|---|
| Migrations | **4** (`20260915000000`–`000300`), fresh reset **326 registered == 326 files** |
| pgTAP | **175 files / 5535 / PASS** on a fresh reset |
| A/B equivalence matrix | clean-seed 928-cell pre-image → **LOST = the 2 tenancy admins on the 7 ratified tables only · GAINED = 0 · KEEP-side 0/0** |
| `b1` mutation audit | **11/11 RED-PROVEN** (8 under-cut + 3 over-cut), RESTORE byte-identical, CONTROL 33 ok / 0 not ok |
| `ARM=census` | **HOLDS** — 450 live gates, 460 verdicts, no unswept newcomer |
| `ARM=floor` | **HOLDS** — 82 never-called doors, all allowlisted |
| Diff-scoped door sweep | **15 items**, derived from the migration diff — ⚠ in progress; first finding below |
| E2E | spec written (`e2e/qob-org-admin-content-wall.spec.ts`); **not yet run** |
| `qa` review | not started |

**Open findings from this build:**

- ⛔ **`app.can_read_document_object` is BLIND** (diff-scoped sweep, PREDICATE ARM).
  Neutralizing it reds nothing in the entire suite. M2 changed this gate, and `314` keystones
  its sibling `can_read_document_of_version` (2.4/2.5) but not it. It governs the
  controlled-document **storage bytes**, so it is a content boundary, **not** an unreachable
  backstop — §6 says keystone it, never allowlist it. Fix: add the missing 314 keystones.
- 🔴 **BUG-QOB-003** — the UI still resolves a tenancy admin to `staff_admin`
  ([session.ts:459](../../src/lib/queries/session.ts:459)), so the wall closes underneath
  coordinator affordances that can no longer work. Not a security defect; needs a PO ruling.
- 🔴 **FUP-QOB-1** — M1 made `response_group_instances_write_own_draft`'s `created_by` term
  unobservable; `270` §J's keystone is annotated vacuous pending a ruling.
- ⚠ **A killed sweep leaks a mutation.** The first diff-scoped run was cut off by a 10-minute
  tool cap mid-case and left `indicator_measurements_select` neutralized to `true` in the live
  catalog. Caught by checking the catalog rather than trusting the harness's restore; fixed by
  a full reset. **Run the sweep detached, and verify the catalog after any aborted gate run.**

## 7. Sequencing once ratified

| Step | Work | Gate |
|---|---|---|
| **B.0** | pgTAP `311` §6 S3/S4 fixture isolation — QA r3's carried MINOR, *"land before Phase B"* | RED-provable |
| **B.3** | Subtractive migrations, bodies re-emitted from live `pg_get_functiondef`, old-vs-new diffed property-by-property (ACLs survive) | 322 == files |
| **B.4** | A/B equivalence matrix over a reachability population; pre-image asserted real | **LOST = ratified cells only · GAINED = 0** |
| **B.5** | `b1-org-admin-wall-mutation-audit.sh` + sibling pgTAP relocations | every keystone RED-proven |
| **B.6** | Diff-scoped ADR 0079 door sweep over every changed policy/gate + `ARM=census` + `ARM=floor` | no BLIND |
| **B.7** | E2E + `qa` review + PO approval | §6 gate |

**Reference data** (not committed — regenerate from the catalog, never trust these files):
`b1_policies.txt` (87), `b1_doors.txt` (144), probe scripts `b1_reach/write/all/inprog.sql`,
in the session scratchpad.

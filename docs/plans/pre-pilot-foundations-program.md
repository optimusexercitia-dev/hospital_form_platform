# Pre-Pilot Foundations Program — one coordinated plan for four structural initiatives

**Status:** PLANNED (design accepted; not implemented). **Date:** 2026-07-10 · **Owner:** platform
lead → `backend` (+ `frontend` where a UI is named).
**Posture:** pre-launch, **reset-OK** — no live data, so we land the *correct* shape once, additively,
with no back-compat migrations (memory `prelaunch-db-reset-ok`).
**Binding rules:** Rule 1 (RLS is the boundary), Rule 2 (canonical schema — extend, never contradict),
Rule 3 (one evaluator, mirrored SQL↔TS), Rule 5/6 (published + storage immutability), Rule 10 (pt-BR),
Rule 11 (audit), Rule 12 (PHI).

**Refined 2026-07-10** (design grill; generated-types verification): three polymorphism dialects (not
two); F3 expanded to freeze the fuller relational answer-data set (Rec-A contract authored first);
`reference`→participants bridge; supersession correction model ratified (engine deferred); calculations
+ i18n deferred as additive-anytime; confidentiality-label defaults set. ADR authorship (0065 + 0060/
0063/0064 amendments) stays F0's Record-step deliverable.

**Consolidates and sequences four independently-approved initiatives into one collision-free plan:**

| # | Initiative | Source | Prior status |
|---|---|---|---|
| A | **Flexible-Forms Foundation** (45-gap disposition + pre-pilot form-engine bones) | ADR [0060](../decisions/0060-flexible-forms-foundation.md) | planned "after Phase 16" |
| B | **Centralized Attachments Substrate** (Phase 14e + DMS-handoff seams) | ADR [0063](../decisions/0063-centralized-attachments-substrate.md) + [phase-14e](../phases/phase-14e-attachment-phi-classification.md) + [schema draft](../design/attachments-core-schema-draft.md) | planned "before 15→17→16" (now partly stale — 15/17 shipped) |
| C | **Case Subject Generalization — E0** (participants / roles / professional registry / case-types) | ADR [0064](../decisions/0064-case-subject-generalization-participants.md) | design landed, unscheduled |
| D | **Pre-Pilot DB Hardening — Waves 3+4** (the deferred structural tracks) | [pre-pilot-db-hardening-program](./pre-pilot-db-hardening-program.md) | Waves 1+2 ✅ shipped; Waves 3+4 deferred |

The central finding of this reconciliation: **initiative D is not a fourth independent program — its
remaining (Wave-3/4) structural items are precisely the design decisions that make A, B and C fit
together without colliding.** D12 (polymorphism dialect), D5/§6.2 (patient master), and D6/§6.3
(metadata item types) each *overlap* one of the three ADRs. So this plan folds D's remainder into the
foundations as their **design spine** (§2), disposes of every Wave-3/4 item explicitly (§5), and
sequences the three builds by their real dependencies (§3).

---

## 0. Scope

**In scope (this program, all pre-pilot / reset-OK):**
- **F0** — Foundations design gate: ratify the cross-initiative conventions (polymorphism, identity,
  Rule 12 taxonomy) and the collision resolutions in §1. Tiny/no migration; unblocks F1–F3.
- **F1** — Case-Participants E0 (initiative C / ADR 0064), behind flags OFF.
- **F2** — Centralized Attachments 14e (initiative B / ADR 0063), behind flag `attachments`.
- **F3** — Flexible-Forms Foundation (initiative A / ADR 0060), structural, no flag.
- **F-cleanup** — the residual hardening items (D3, WS-8 D8/D10/D11) done opportunistically pre-pilot.

**Out of scope / stays deferred (unchanged):** the E1 access-spine + E2 ethics procedure (post-pilot,
after 0064; behind the **m2 hard gate**), the FF-1…FF-5 field-type/validation/power-authoring UX
phases (post-pilot), the attachment versioning/redaction/grants machinery (reserved seams only), P6
(checkpointed `verify_audit_chain`) + P7 (audit partition on `chain_key`, **not** time — both stay
deferred to the pre-Phase-19 evidence track), and the §6.1 single-`memberships` collapse.

**Explicitly cancelled by this reconciliation:** the D6/§6.3 metadata-driven `form_item_types`
refactor (superseded by ADR 0060 — see §1 C-ε) and the standalone D5/§6.2 "hospital-scoped patient
master" table (superseded by the participant model + existing `patient_index` — see §1 C-δ).

---

## 1. Collision matrix — the four initiatives against each other

Each row is a place where two or more initiatives touch the same schema surface, the resolution, and
the phase that owns it. **This is the core of the plan.**

### C-α · Polymorphism-dialect proliferation — D12 × ADR 0063 × ADR 0064  🔴

- **Today (confirmed, 2026-07-10 backend sweep):** the platform has **no `(owner_type, owner_id)`
  polymorphic pattern** — every cross-reference is a **kind discriminator + explicit *named* nullable
  FKs + a kind-scoped shape CHECK** (`rca_evidence` `kind` + `cited_*_id`; `referral_shared_item`
  `kind` + `source_*_id`; `action_items` `source_type` + `source_meeting_id`/`case_id` (no generic
  `source_id`); `case_events` `kind`). Hardening **D12** mandates: pick **one** polymorphism dialect
  *before* a fifth site appears.
- **Collision:** B (0063) introduces the platform's **first** no-FK text polymorphism —
  `attachments.(owner_type, owner_id)` (the authorizing owner) plus `attachment_references` and
  `attachment_subjects`. C (0064) introduces a **different** dialect — a `participants` *typed
  registry* (`UNIQUE(id, participant_type)` + composite-FK-pinned subtype tables). Landing both,
  unreconciled, is exactly the proliferation D12 forbids.
- **Resolution — ratify exactly three sanctioned dialects with a written "when to use which" rule**
  (F0 writes it into ARCHITECTURE.md as the D12 closure; this *is* "picking the dialect"). The
  2026-07-10 grill added dialect 1 explicitly: the *incumbent* named-FK+CHECK pattern is **not** being
  replaced — it stays in permanent use (`rca_evidence`, `referral_shared_item`, `case_events`,
  `capa_plan`, and the already-unified `action_items.source_*`), so it must be named rather than left
  implicit. Naming it also keeps the unified-`action_items` source from becoming an unsanctioned "fifth
  site" of an un-blessed dialect — the exact proliferation D12 forbids:
  1. **Named-FK + shape CHECK** *(incumbent)* — a `kind`/`source_type` discriminator + explicit **named
     nullable FKs** + a kind-scoped shape CHECK. **Use** for **intra-domain source/provenance** links
     where the target set is closed & small and real FK integrity + join targets are wanted. Instances:
     `rca_evidence`, `referral_shared_item`, `case_events`, `capa_plan`, `action_items.source_*`.
  2. **Owner-dispatch polymorphism** — `(owner_type text, owner_id uuid)`, **no FK**, authorization
     dispatched by a `SECURITY DEFINER` `app.can_*` CASE dispatcher; never a join target; explicit
     two-step reads. **Use only** for a row *owned by / living under* one of several **heterogeneous**
     parent domains that share no common registry. Sole sanctioned instance: the attachments
     authorizing owner (`case|meeting|interview|action_item|form_upload`).
  3. **Typed-identity registry** — a `participants`-style anchor with `UNIQUE(id, type)` + subtype
     tables pinned by **composite FK + CHECK**. **Use** for a **reusable identity that many rows point
     at** (people, orgs, entities as case subjects).
  - **Bridging decision (load-bearing):** `attachment_subjects` does **not** get its own fourth
    `(subject_type, subject_id)` no-FK polymorphism. Its subject is a **participant** →
    `attachment_subjects.participant_id → participants(id)` (dialect 3). See C-β. **Consequence:
    participants (F1) must land before attachments (F2).**
- **Owner:** F0 (convention) + F1/F2 (conform). Closes D12.

### C-β · Subject/role vocabulary duplication — ADR 0063 `attachment_subjects` × ADR 0064 participants  🔴

- **Collision:** the 0063 schema draft gives `attachment_subjects` its own `subject_type ∈
  {patient,physician,staff,complainant,witness,department,committee,hospital}` + `subject_role ∈
  {patient_of_record,physician_under_review,complainant,witness,…}`. ADR 0064 independently defines
  `participant_type ∈ {patient,professional,external_person,department,institution,regulatory_body,
  other}` + `case_participant_roles` (`respondent_doctor`, `complainant`, `affected_patient`,
  `witness`, …). **Two parallel, non-matching vocabularies for the identical concept** ("who/what a
  document is about" = "who is a participant in the matter").
- **Resolution:** collapse them onto the participant registry (follows from C-α):
  - Re-key `attachment_subjects` to `(attachment_id, participant_id → participants(id), role_id →
    case_participant_roles(id) NULL, note)`. Drop the free `subject_type`/`subject_id`/`subject_role`
    CHECK columns from the 0063 draft. The row stays **non-authorizing and PHI-safe** exactly as 0063
    intends (a participant carries only identity+type; patient identifiers stay in the isolated PHI
    satellite — Rule 12), but there is now **one** subject vocabulary, not two.
  - For a non-case attachment whose subject is e.g. a department, participants are **org-anchored**
    (not case-anchored) so a `department`/`institution` participant still serves; the case link is
    only through `case_participants`, which `attachment_subjects` does not require.
- **Owner:** F2 (builds `attachment_subjects` against the F1 participants tables). This is the single
  biggest schema-collision resolution and the reason **F1 precedes F2**.

### C-γ · Sensitivity taxonomy + Rule 12 double-amendment — ADR 0063 × ADR 0064  🔴

- **Collision:** **both** ADRs amend Rule 12. C (0064) adds **professional identity** as a *second
  sensitivity class* beside patient PHI. B (0063) adds the **attachments** layer: a physical
  `sensitivity_tier ∈ {phi, standard}` (picks the bucket) + a semantic `confidentiality_label ∈
  {non_phi_internal, phi_standard, phi_restricted, peer_review_confidential, legal_privileged,
  ethics_investigation, credentialing_sensitive}`. Applied independently, the two Rule-12 edits diverge
  and the label value-set is finalized twice.
- **Resolution — one consolidated Rule-12 taxonomy, authored once in F0 and applied at each phase's
  Record step:**
  - **Class 1 — patient PHI** (unchanged): three isolated modules (`event_patient`,
    `referral_patient`, case `patient_identifiers`), single audited door, reveal-on-demand, disposal.
  - **Class 2 — professional identity** (0064): case-scoped RLS + audited reads, **no** isolated
    single door, **no** reveal-on-demand. Lives in `professional_profiles`.
  - **Attachments layer** (0063): `sensitivity_tier` is the *physical* PHI segregation (bucket);
    `confidentiality_label` is the *semantic* regime, and its value-set is **aligned to the two
    classes** — the `phi_*` labels map to Class 1; `ethics_investigation` / `credentialing_sensitive`
    / `peer_review_confidential` / `legal_privileged` map to Class 2 or governance-confidential. The
    label value-set (0063 open item a) is thus finalized **together with** the 0064 class definitions,
    as one taxonomy.
  - **Also reconcile the same edit** (0064 QA-M1): CLAUDE.md §3's Rule-12 summary still says "PHI
    lives in exactly two modules" — already wrong since ADR 0038 (case = third). F0/F1 fix it to
    "three patient-PHI modules + the professional-identity class."
- **Owner:** F0 (authors the merged wording) → F1 records Class 2, F2 records the attachments layer.
  See §4.

### C-δ · PHI-disposal composition — hardening C-6 / D5 × ADR 0063 D10 × ADR 0064 R3  🔴

- **State after Waves 1+2 (confirmed — `20260711000700_phi_disposal_closure.sql`):** C-6 already
  extended `dispose_case_phi` to delete `case_patient`, delete case-phase `answers`, and redact
  `case_narratives.body_md` / `case_events.body`+`title` / `case_interviews.summary_md` /
  `case_interview_subjects.note` / `cases.label` / `case_documents.title`+`description` /
  `meeting_cases.summary`+`decision`. A **separate** `dispose_meeting_minutes` (new in C-6) handles
  `meetings.minutes_md` + agenda text. `dispose_event_phi` / `dispose_referral_phi` similarly closed.
- **Collision:** `dispose_case_phi` is edited again by **two** of the four initiatives — C (0064)
  re-keys `case_patient → patient_identifiers` (N per case), generalizes disposal to purge **all**
  patient satellites **and** each participant's `patient_xref` rows (R3), and renames
  `get_case_patient → get_participant_patient`; B (0063) adds `dispose_attachment_phi` **and** a
  per-owner redaction line into each `dispose_*_phi` (D10, keyed on `(owner_type, owner_id)`) so
  disposing a case also redacts its attachments. And hardening **D5/§6.2** wanted a *separate*
  hospital-scoped patient master to be the single erasure door.
- **Resolution:**
  - **Compose, in order.** F1 rewrites `dispose_case_phi` to the participant-keyed shape (per-satellite
    + `patient_xref` purge). F2 then *layers* the D10 attachment-redaction line on top of F1's version.
    Because F1 fully lands + types regen before F2 begins, the edits compose cleanly; §4 records the
    final body.
  - **Drop D5/§6.2's separate patient-master table.** The participant model (`patient_identifiers`
    hung off `patient_participants`) + the existing key-only `patient_xref` linkage (ADR 0039; flag
    `patient_index`) **are** the identity substrate; a *third* patient store would itself be a
    collision. C-6's
    "single truthful erasure" goal is met by the generalized per-participant disposal doors + xref
    purge — **not** a new master. (Removes a Wave-3 track; see §5.)
- **Owner:** F1 (participant-keyed disposal + xref) → F2 (attachment D10 line). Verify item: 0064 **R3**
  (xref purge per participant) + its pgTAP keystone.

### C-ε · Form-item typing — ADR 0060 CHECK-enum-widen × hardening D6/§6.3 metadata refactor  🟢

- **Collision:** hardening **D6/§6.3** (Wave-3 deferred) is the *full metadata-driven
  `form_item_types` catalog* refactor. ADR 0060 **Gap 1 = DROP** the data-driven catalog: "keep the
  CHECK enum, widen per feature." Only the one-line `ELSE false` safety flip (D6-flip) was ever
  wanted, and it **already shipped in Wave 1**.
- **Resolution:** **D6/§6.3 is CANCELLED — superseded by ADR 0060's explicit decision.** F3 owns *all*
  form-item typing changes and does them by **widening the CHECK enum** (add `group`,
  `repeating_group`, `matrix`, `risk_matrix`, `reference`), never a catalog table. (Removes a Wave-3
  track; see §5.)
- **Owner:** F3.

### C-ζ · `form_upload` owner_type / file-upload answers — ADR 0060 DROP × ADR 0063 reserve  🟢

- **Collision:** A (0060, 07-07) **drops** file-upload-as-a-form-answer entirely (a broad PHI ingress
  that would turn the whole form engine into a potential PHI store). B (0063, 07-09) **reserves**
  `owner_type='form_upload'` (dispatcher returns `false`) **and** a design-only
  `form_items.phi_policy` column for a *future* flexible-forms upload surface. The later ADR reserves a
  hook the earlier ADR rejected, and both would touch `form_items`.
- **Resolution:**
  - Keep `owner_type='form_upload'` in the attachments CHECK as **permanently inert** (the dispatcher
    stays `false`); it costs nothing and preserves the enum slot.
  - **Do not** add any file/upload `item_type` to `form_items` (0060 excludes it — the widened enum is
    `group|repeating_group|matrix|risk_matrix|reference` only), and **do not** reserve
    `form_items.phi_policy` — it is dead schema for a feature 0060 rejected, and dropping it keeps
    `form_items` a single-owner (F3) table with no B/F3 co-edit. *(This overrides Phase-14e §3.8 /
    ADR-0063 D9's phi_policy reservation — a deliberate reconciliation, recorded in F2's ADR note.
    Reviving form-upload answers requires a **new ADR** that overturns 0060's PHI-ingress objection.)*
- **Owner:** F2 keeps the inert owner_type; F3 owns `form_items` and adds no upload type. Removes the
  only table both B and A would touch.

### C-η · Sequencing across the four + Phase 16  🟢

- **Collision:** stale/again-conflicting sequencing notes — 0063 "build next before 15→17→16" (15/17
  now shipped), 0060 "after Phase 16", 0064 unscheduled, D unscheduled.
- **Resolution — one pre-pilot order (all reset-OK, all cheapest on an empty DB):**
  `F0 → F1 → F2 → Phase 16 → F3 → F-cleanup → pilot reset → pilot`. Rationale + the one genuinely
  optional interleave (F3 vs Phase 16) in §3.
- **Owner:** this program.

### C-θ · Attachment evidence-consolidation scope — ADR 0063 × existing evidence surfaces  🟢

- **Ground truth (2026-07-10 generated-types verification):** the action-item/CAPA domain is already
  built and rich — `action_items` is a **single unified table** (`commission_id` + `source_type` +
  named `source_*_id`, dialect 1; ADR 0050 fold + `visibility_scope`) with `action_item_assignments`
  (multi-role), `action_item_status_history`, and configurable `action_item_statuses`/
  `action_item_urgency_levels`; CAPA is a separate regulated subsystem (`capa_plan → capa_action →
  capa_action_task → capa_action_evidence → capa_effectiveness`). There is **nothing to unify** on the
  task plane; the only open question was the fragmented **evidence/file** plane. (C-α already described
  `action_items` correctly — this row records the verified fuller picture.)
- **Resolution (grill decision "(i)"):** F2 folds the **three pure file tables** (`case_documents`,
  `meeting_attachments`, `case_interview_attachments`) and adds `owner_type='action_item'` — a genuine
  **new capability** (`action_items` has no attachments today; the dispatcher resolves commission via
  `action_items.commission_id`, non-recursively). It **leaves `rca_evidence` and `capa_action_evidence`
  as deliberate domain tables** (`rca_evidence` is also a *citation* layer via `cited_*_id`; both are
  working regulated NSP code on the immutable `nsp-evidence` bucket) — a **forward-note** records them
  as post-pilot consolidation candidates (reset-OK does not expire). **Mandatory:** the
  `rca_evidence.cited_document_id` + `referral_shared_item.source_document_id` → `attachments(id)`
  repoint is **atomic** with the `case_documents` fold (single migration — a half-applied drop breaks
  both). **Fold-in fidelity:** `case_documents.doc_type` maps into `attachments.kind` (preserve; do not
  flatten to `'outro'`); `meeting`/`interview` files (mime-only) get a per-owner_type default `kind`.
- **Owner:** F2.

> **🔴/🟢 = plan-review level (CLAUDE.md §6):** 🔴 items get a full plan review before code; 🟢 a
> one-line plan + ack. C-α/β/γ/δ are the 🔴 design core; they are all resolved *here* so the per-phase
> reviews are conformance checks, not re-litigation.

---

## 2. The design spine (D-remainder folded in) — conventions ratified at F0

F0 produces a short **conventions ADR** (next free number, ~0065) + the ARCHITECTURE.md edits, so
F1–F3 build against a settled contract:

1. **Three sanctioned polymorphism dialects** (named-FK+CHECK *incumbent* · owner-dispatch · typed
   registry) with the "when to use which" rule (C-α). New ARCHITECTURE rule/appendix. **Closes
   hardening D12.**
2. **Identity/subject convention** — `participants` is the platform's reusable identity registry;
   anything that records *who/what a row is about* (starting with `attachment_subjects`) references it
   rather than inventing a parallel subject table (C-β).
3. **One Rule-12 sensitivity taxonomy** — Class 1 (patient PHI, three modules) + Class 2 (professional
   identity) + the attachments tier/label layer aligned to both (C-γ). Merged wording drafted here,
   applied at each phase's Record step (§4).
4. **Disposal composition order** — participant-keyed patient disposal (F1) before the attachment D10
   line (F2); no separate patient-master door (C-δ).
5. **Form typing stays a widened CHECK enum**, no metadata catalog (C-ε); `form_items` is F3-only, no
   `phi_policy` (C-ζ).
6. **Verify-at-build items carried from the ADR reviews:** 0064 **R1 — RESOLVED by the 2026-07-10
   sweep:** `is_multi_org()` and migration `…629000000` **do not exist in the shipped schema** (the
   review's detail was stale). The *actual* gate on `app.can_read_case_patient`
   (`20260710000000_nsp_per_hospital.sql`) is **per-hospital PQS-operator** (`is_pqs_operator_of_for(
   hospital_of_commission(…))`) **+ per-commission** staff-admin / membership / live `case_access` /
   phase-or-narrative assignee — no org/multi-org boolean. F1's `get_participant_patient` **inherits
   this exact predicate unchanged** and the intended asymmetry holds (professional identity is *not*
   so gated — it is LGPD-personal, case-scoped). **R2** (denormalize `organization_id` onto `cases` —
   confirmed no org col today), **R5** (`UNIQUE(id, participant_type)` + subtype composite-FK+CHECK —
   the class-separation invariant), **R6** (E1 anti-recursion — pre-committed, E1 not built here).

7. **Catalog-table vs CHECK-enum convention** — *tenant-extensible* vocabularies live in **catalog
   tables** (`case_types`, `case_participant_roles`, `action_item_statuses`/`_urgency_levels`);
   *code-coupled* type systems that each need renderer/evaluator support stay **CHECK enums**
   (`form_items.item_type`). The rule that reconciles adopting 0064's catalogs while rejecting
   D6/§6.3's form-item catalog (C-ε).
8. **Freeze principle** — *freeze answer-data shapes while reset-OK* (their structure binds historical
   answers; e.g. F3's inert answer tables), but *definitions, engines, and enum-widens are additive
   anytime* and are **not** pre-landed (e.g. calculations, i18n, the correction engine). Defines what
   the reset-OK window is — and is not — spent on.
9. **Reference → participants bridge** — the F3 `reference` item type targets the `participants`
   registry (`answer_references.participant_id`), unifying initiatives A and C; internal-platform-entity
   reference lanes are deferred-but-additive. Follows from convention 2.
10. **Supersession correction model** — a future submitted-form correction *supersedes* the prior via a
    nullable `responses.supersedes_id`, and aggregation counts only the **latest in a supersession
    chain**. Ratified now (recorded design decision) so Phase-15/dashboard aggregation is built
    **supersession-tolerant**; the `reopen`/correction engine + UX defer to a post-pilot ADR (0060
    Gap 38). See §8.

---

## 3. Phased sequence

> All phases: `backend`-owned migrations, forward-only (reset-OK), sequential timestamp windows, one
> Phase Gate each (CLAUDE.md §6). Contract-first: `backend` posts typed stubs before `frontend` starts.
> New SQLSTATEs allocate above the current `HC0xx` high-water — **HC093** (controlled-docs;
> confirmed by the 2026-07-10 backend sweep), so new codes start at **HC094**.

### F0 — Foundations design gate  *(design; tiny or no migration)*
- **Deliverable:** the conventions ADR (~0065) + ARCHITECTURE.md edits (polymorphism dialects rule;
  Rule 12 merged taxonomy draft; Rule 2 note that participants/attachments tables are additive) +
  CLAUDE.md §3 Rule-12 "two modules" fix + this program's rows in PHASES/PROGRESS.
- **Live-catalog facts (already verified, 2026-07-10 sweep — F0 just records them):** R1 gate
  (per-hospital PQS-operator + per-commission, no `is_multi_org`); the four `dispose_*` bodies in
  `20260711000700_phi_disposal_closure.sql`; `form_items.item_type` = 10 values
  (`multiple_choice,dropdown,checkbox,free_text,short_text,number,date,time,section_text,image`) with
  the D6-flip `else false` already landed; HC high-water **HC093** (new codes at HC094+); no
  `(owner_type,owner_id)` polymorphism today; none of the new tables/flags (`attachments`,
  `case_participants`, `case_types`, `is_exclusive`/`risk_weight`/`behavior_config`) exist yet.
- **Gate:** lead + human sign-off on the conventions (no build to test); 🔴 review of C-α/β/γ/δ.
- **Unblocks:** F1, F2, F3.

### F1 — Case-Participants E0  *(ADR 0064; flags `case_participants`, `case_types` seeded OFF)*
- **Scope (E0 only):** `participants` (org-anchored, `participant_type`, `sensitivity_class` CHECK-
  derived from type, `UNIQUE(id, participant_type)`), `case_participant_roles`, `case_participants`
  (primary-subject partial-unique); `professional_profiles` + `professional_participants` (Class 2 —
  audited reads, `professional_profile.read` on the `log_audit_access` allow-list); `patient_participants`
  + **re-key `case_patient → patient_identifiers(participant_id)`** (N per case, all DML REVOKED,
  atomic DEFINER writer, `get_case_patient → get_participant_patient`); `case_types` +
  `case_type_terminology`; **denormalize `organization_id` onto `cases`** (R2). Subtype↔type
  composite-FK+CHECK invariant (R5). Generalize `dispose_case_phi` to per-participant satellites +
  `patient_xref` purge (R3). **E1/E2 not built** — the m2 hard gate keeps the flags OFF through the pilot.
- **Dependencies:** F0. **Precedes F2** (C-α/β).
- **Reset-OK payoff:** the `case_patient → patient_identifiers` re-key happens while the flag is OFF ⇒
  **zero production PHI migration** (the entire reason to do it pre-pilot).
- **Records:** Rule 12 Class 2 + the ADR-0038 supersession + **the ADR-0033 supersession** (participants
  reverse 0033's deliberate "no participants" non-feature); Rule 2 participant/case-type tables.
- **Gate:** full §6 gate; pgTAP keystones per ADR 0064 §Consequences (subtype↔type guard, patient door
  NULL-out-of-scope with N patients, professional audited read, primary-subject unique, cross-tenant
  isolation, disposal-purges-xref, the verified R1 gate inherited).

### F2 — Centralized Attachments 14e  *(ADR 0063 + phase-14e; flag `attachments` seeded OFF)*
- **Scope:** the core `public.attachments` (single authorizing owner + all six ADR-0063 seams:
  `confidentiality_label`, `scan_status`, `document_group_id`, `supersedes_id`, `legal_hold`,
  `phi_disposed_*`); companion tables `attachment_references` (non-authorizing) and **`attachment_subjects`
  re-keyed to `participant_id → participants` per C-β**; `case_interview_links`; the DEFINER dispatchers
  (`can_read/write_attachment`, `commission_of_attachment`) + immutability guard + audit triple-mirror
  (`attachment.read`); two tiered buckets (PHI-segregated, hard audited door); fold in `case_documents`
  / `meeting_attachments` / `case_interview_attachments` (files) with the B4 FK repoints; action-item
  attachments (first new consumer). `owner_type='form_upload'` reserved-**inert** (C-ζ). Add the D10
  attachment-redaction line to `dispose_*_phi` **on top of F1's participant-keyed `dispose_case_phi`**
  (C-δ); `dispose_attachment_phi`.
- **Confidentiality defaults (resolves ADR 0063 open items a + c; clinical-governance-ratifiable):**
  `case`/`interview` → tier `phi`, label `phi_standard`; `meeting`/`action_item` → tier `standard`,
  label `non_phi_internal` (uploader may **escalate** to `phi`; any `phi_*`/restricted label forces tier
  `phi`); `form_upload` inert. **De-escalation (declassify) stays staff_admin-only + audited**
  (`attachment.reclassified`). Evidence-consolidation scope + fold-in fidelity per **C-θ**.
- **Dependencies:** F0 + **F1** (attachment_subjects references participants; the D10 line composes with
  F1's disposal rewrite).
- **Records:** Rule 12 attachments layer (tier + label aligned to the F0 taxonomy); Rule 6 re-home
  hard-delete footnote.
- **Gate:** full §6 gate; the phase-14e §5 verification set (RLS truth table, PHI-door single-open
  audit, phi-bucket denies authenticated SELECT, fold-in FK-repoint integrity) + an
  `attachment_subjects → participants` FK/RLS test.

### Phase 16 — Standards Crosswalk & Readiness  *(the already-planned next accreditation phase; unchanged)*
- Runs **after F2** so the evidence picker *can* (optionally, later) link an attachment as evidence and
  so the pre-pilot foundations are all in place. Phase 16 does **not** hard-depend on the foundations
  (its evidence picker targets forms/meetings/cases/indicators/controlled-docs), so it may equally run
  before F3. Kept in ADR-0057's slot; this program does not change Phase 16's spec.

### F3 — Flexible-Forms Foundation  *(ADR 0060; structural, no flag)*
- **Scope (create-now bones + frozen answer-data shapes):** widen `form_items.item_type` CHECK
  (+`group`, `repeating_group`, `matrix`, `risk_matrix`, `reference`, inert per type);
  `form_item_options.is_exclusive` + `risk_weight` (options already carry `score` + `analytics_code`);
  `form_versions.behavior_config` jsonb (reserved staging area); the **one live feature** — evaluator
  operators `contains`/`not_contains`/`is_empty`/`is_not_empty` in **both** `app.eval_condition` and
  `evalCondition` with the extended golden/parity matrix (operator × value_type; Rule 3, drift =
  phase-blocking); reserve inert `form_item_validations`. **No** file/upload item type, **no**
  `phi_policy` (C-ζ). Reconcile ARCHITECTURE.md §2 with shipped reality (10 item types etc.) + flip
  ADR 0045/0046 headers to accepted.
- **Rec-A answer-storage contract → fuller inert set (2026-07-10 grill "(b) fuller"):** per the *freeze
  principle* (§2.8), F3 spends the reset-OK window on the **answer-data shapes** the new types need.
  repeating_group storage **already exists** (`response_group_instances` w/ nesting +
  `answers.group_instance_id`) — F3 re-validates it against the dashboard/indicator engine and adds
  **position-uniqueness within a parent** (shape only; write RPCs → FF-1). For the unsolved types, F0/F3
  **first authors the `question_key`→aggregation contract, then** lands the **fuller relational inert
  set**: `form_matrix_rows`, `form_matrix_columns`, `answer_matrix_cells`, `answer_risk_matrix`,
  `answer_references`. All **inert**, all **no `*_snapshot` columns** (rely on published-version
  immutability, not answer-row snapshots — the platform's existing philosophy). `answer_references`
  carries a nullable **`participant_id → participants(id)`** (the A/C bridge, §2.9) + a `reference_kind`
  discriminator; internal-entity lanes deferred-but-additive. **Calculations** and **i18n** are **not**
  landed here — additive anytime, §8 forward-notes.
- **Dependencies:** F0; **now also F1** (the inert `answer_references.participant_id` FK → `participants`
  needs the F1 registry to exist — satisfied by the F0→F1→F2→16→F3 order). Otherwise touches the form
  engine only; `form_items` is F3-only after D6 cancellation (C-ε). Sequenced here per ADR 0060 ("after
  Phase 16, before the pilot reset");
  may move earlier if the team prefers — no dependency forces it after 16.
- **Gate:** full §6 gate; the golden dual-evaluator parity test is the lock. The five inert answer
  tables ship with **RLS from creation** (Rule 1 — scoped to their future `response`/`answer` parent, or
  deny-all until the type activates) + a pgTAP guard that they stay write-inert pre-activation.

### F-cleanup — residual hardening  *(opportunistic, pre-pilot)*
- **D3** (jsonb/array → junction tables for the case-phase result engine) — its own WS-1-style scoped
  plan, done pre-pilot while data is disposable (no reachable defect; prevents future dangling UUIDs).
- **WS-8** — **D10** uniform `updated_at` touch trigger (`cases`/`commissions`/`forms`), **D11**
  harmonize status-enum internal keys to English, **D8** guard/exclude the forward-compat UUID-no-FK
  columns. Do only when an adjacent migration is open.
- Not gated as a phase; folds into whichever wave is open, or a small dedicated gate if batched.

---

## 4. Rule 12 / Rule 2 amendment plan (who writes what, when)

To avoid the C-γ double-amendment, the **merged wording is drafted once in F0**; each phase's Record
step applies its slice:

| Doc surface | F0 | F1 | F2 | F3 |
|---|---|---|---|---|
| ARCHITECTURE **Rule 12** | draft merged taxonomy (Class 1 unchanged · Class 2 · attachments tier/label) | apply Class 2 (professional identity) + ADR-0038 supersession | apply attachments layer (tier + label aligned) | — |
| ARCHITECTURE **Rule 2** | note additive tables | participants / case-type / `patient_identifiers` re-key + `cases.organization_id` | `attachments` + companions | widened `form_items` enum + option/version cols |
| ARCHITECTURE **Rule 6** | — | — | attachment re-home hard-delete footnote | — |
| **CLAUDE.md §3** Rule-12 summary | fix "two modules" → "three modules + professional class" | (verify) | (verify) | — |
| **polymorphism convention** | new rule/appendix (**three** dialects; D12 closure) | conform (registry) | conform (owner-dispatch + registry ref) | — |
| **catalog-vs-enum + freeze conventions** | new rule/appendix | conform | conform | conform (inert answer tables) |
| **docs/backend-state.md** | — | participant/PHI-door surface | attachments surface | form-engine surface |

---

## 5. Disposition of every hardening Wave-3/4 item (initiative D)

| Item | Prior state | Disposition here |
|---|---|---|
| **D12** — pick one polymorphism dialect before Phase 16 | deferred | **DONE at F0** as the ratified two-dialect convention (C-α). |
| **D5 / §6.2** — hospital-scoped patient master + single LGPD door | deferred track | **SUPERSEDED** by the participant model + the key-only `patient_xref` linkage (ADR 0039); no separate master built (C-δ). C-6's single-erasure goal met by generalized per-participant doors. |
| **D6 / §6.3** — full metadata-driven `form_item_types` | deferred track | **CANCELLED** — ADR 0060 keeps the typed CHECK enum (C-ε). Only D6-flip (`ELSE false`) was wanted; already shipped Wave 1. |
| **D3** — jsonb/array → junction (case-phase result engine) | deferred | **F-cleanup** — own scoped plan, pre-pilot while disposable. |
| **P6** — checkpointed `verify_audit_chain` | deferred | **stays deferred** to the pre-Phase-19 evidence track (with §6.5). |
| **P7** — `audit_log` partition | deferred (time-axis rejected) | **stays deferred**; if ever needed, `chain_key` LIST/HASH, not time (a designed track). |
| **§6.1** — single-`memberships` collapse | deferred | **stays deferred** (WS-1 already made C-3/H-6/H-7 structurally impossible). |
| **WS-8** — D8 (guard forward-compat cols), D10 (`updated_at` trigger), D11 (status-key English) | opportunistic | **F-cleanup**, opportunistic. |

Net: initiative D contributes **one design gate (F0/D12) + one cleanup phase (D3/WS-8)**; its two
heaviest deferred tracks (D5, D6/§6.3) are **removed** by A and C rather than built.

---

## 6. Migration batching & ownership (no two teammates touch one file per phase — CLAUDE.md §4)

- **F1** (participants): `…_case_participants_core.sql` (participants/roles/case_participants +
  `cases.organization_id`), `…_professional_registry.sql`, `…_patient_identifiers_rekey.sql`
  (case_patient → participant-keyed + `dispose_case_phi` rewrite + `patient_xref` purge +
  `get_participant_patient`), `…_case_types.sql`, `…_participants_flags.sql` (seed OFF). Regen types.
- **F2** (attachments): the phase-14e B1→B4 set built from the [schema draft](../design/attachments-core-schema-draft.md)
  **with the C-β `attachment_subjects.participant_id` change**, then the fold-in/FK-repoint migration
  (single migration — a half-applied drop breaks `rca_evidence`/`referral_shared_item`), the D10
  disposal line **layered on F1's `dispose_case_phi`**, the flag-enable migration. Regen types.
- **F3** (flexible-forms): `…_flexible_forms_bones.sql` (item_type CHECK widen + option cols
  `is_exclusive`/`risk_weight` + `form_versions.behavior_config` + repeating-group position-uniqueness +
  inert `form_item_validations`) + `…_flexible_forms_answer_shapes.sql` (the frozen inert set:
  `form_matrix_rows`, `form_matrix_columns`, `answer_matrix_cells`, `answer_risk_matrix`,
  `answer_references` incl. `participant_id → participants`; authored against the Rec-A contract; RLS +
  no `*_snapshot` cols) + the dual-evaluator operator change (SQL fn + `src/lib/**/evalCondition` +
  `condition-vectors.json`). Regen types.
- **Remote deploy** is **user-authorized** per wave — `supabase db push` / `db reset --linked` under
  reset-OK (background agents auto-denied; memory `remote-db-push-needs-user-auth`,
  `app-reads-local-migrations-push-remote`). Local first (`supabase migration up`).

---

## 7. Testing & gates

- **pgTAP is the lock** for every security/integrity invariant (each phase's §Consequences names its
  keystones); re-run the **full ordered** `supabase test db` after a fresh reset — never a self-reported
  subset (memory `pgtap-fixture-flag-gaps`), and confirm flag-guarded fixtures actually enable the flag.
- **Dual-evaluator golden parity** (F3) is phase-blocking; the operator × value_type matrix must cover
  every value shape, and any future field type that adds a value shape re-extends it (Rule 3).
- **E2E (Playwright):** the **lead** runs the full suite as a background command against a **prod
  build / standalone server** (`node .next/standalone/server.js`; memory
  `e2e-standalone-server-not-next-start`, `e2e-gate-prod-build`, `subagent-cannot-run-full-e2e`);
  triage failures against the flaky baseline (memory `e2e-prod-build-flaky-baseline`) before calling
  regression. Watch the client-import-from-server-queries build trap (memory
  `client-import-server-query-module-breaks-build`) and the RSC server-fn-prop crash
  (`rsc-server-fn-prop-client-crash`) on the attachment/participant UIs.
- **Each phase is one Phase Gate**: build (lint/tsc/vitest) → tester full-suite green → qa review
  (`docs/reviews/…`) → human approval → Record (PROGRESS + backend-state + graphify `update .`).

---

## 8. Risks & open decisions for the product owner

1. **F1-before-F2 is mandatory** (C-α/β): `attachment_subjects` references `participants`. If the team
   would rather ship attachments first, the fallback is to keep 0063's standalone subject vocabulary
   *and accept a later reconciliation migration* — **not recommended** (it reintroduces the exact
   duplication D12/this plan removes).
2. **F3-vs-Phase-16 interleave — DECIDED (2026-07-10 grill): `F0→F1→F2→16→F3`** (respects 0063 "before
   16" + 0060 "after 16"). The F3 expansion (five inert answer tables + Rec-A contract) *strengthens*
   this — foundations-first would delay Phase 16 behind a bigger, wholly-additive F3 for a benefit F3's
   additivity already provides.
3. **`form_items.phi_policy` dropped** (C-ζ) overrides an explicit ADR-0063/phase-14e reservation.
   Recorded as a deliberate reconciliation; flag if the team still wants the inert column reserved.
4. **The m2 hard gate** (0064): `case_participants`/`case_types` flags **must not** be flipped on real
   ethics data until the post-pilot E1 access-spine lands. F1 ships them dark; the pilot does not use them.
5. **Effort (rough, revised 2026-07-10):** F1 ≈ 4–6 backend days (PHI re-key + registry + disposal) ·
   F2 ≈ 4–6 (the core + fold-in is the heaviest, its risk is the `case_documents` drop reaching
   `rca_evidence`/referral — now an **atomic** repoint, C-θ) · **F3 ≈ 4–6 (up from ~2–3:** the five inert
   answer tables + the Rec-A aggregation contract authored first + the evaluator parity gate) · F0 ≈ 0.5
   · F-cleanup opportunistic. All front-loaded to the gate, not production (reset-OK = no data migration).
6. **Submitted-form correction (Gap 38) — supersession model ratified (§2.10), engine/UX deferred**
   post-pilot. **Accepted pilot risk (no guard):** with no correction UX, standalone forms can still
   accumulate **duplicate submissions** — a blanket uniqueness constraint is unsafe (some forms are
   filled repeatedly, e.g. a monthly audit). Phase-15 aggregation is built **supersession-tolerant** so
   the later feature can't corrupt metrics.
7. **Calculations (derived fields) — deferred, forward-note only.** Fully additive later (enum-widen +
   definition table + engine; the computed answer reuses the existing `value_number`), so **no reset-OK
   penalty** (freeze principle, §2.8). A recognized FF-phase capability that F3's `score`/`risk_weight`/
   `answer_risk_matrix` seams feed.
8. **i18n / translations — deferred entirely, no schema.** Additive later (answers are locale-agnostic —
   they reference stable option ids; default-locale labels already live on the item/option). Recorded as
   a future capability tied to the JCI/international positioning; Rule 10 (pt-BR) stands for the pilot.

**Bottom line:** one program, three builds (F1→F2→F3) on a shared design gate (F0) that folds in the
hardening remainder as its spine. The four initiatives are made collision-free by six resolutions
(§1); the only hard ordering constraint is **participants before attachments**. Everything lands
pre-pilot on a disposable DB, dark behind flags where a flag exists.

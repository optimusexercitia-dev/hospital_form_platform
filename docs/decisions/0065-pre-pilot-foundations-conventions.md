# 0065 — Pre-Pilot Foundations conventions (polymorphism · identity · Rule-12 taxonomy · freeze)

**Date:** 2026-07-10 · **Status:** accepted (design ratified; no migration — the conventions
bind F1–F3). **Owner:** platform lead → `backend`.
**Consolidates the design gate (F0) of the** [Pre-Pilot Foundations Program](../plans/pre-pilot-foundations-program.md),
which sequences four independently-approved initiatives into one collision-free plan:
Flexible-Forms (ADR [0060](./0060-flexible-forms-foundation.md), phase F3), Centralized
Attachments (ADR [0063](./0063-centralized-attachments-substrate.md), phase F2), Case-Participants
(ADR [0064](./0064-case-subject-generalization-participants.md), phase F1), and the DB-hardening
Wave-3/4 remainder ([pre-pilot-db-hardening-program](../plans/pre-pilot-db-hardening-program.md)).
**Binding rules:** Rule 1 (RLS is the boundary), Rule 2 (extend, never contradict), Rule 3 (one
evaluator, mirrored SQL↔TS), Rule 5/6 (published + storage immutability), Rule 11 (audit),
Rule 12 (PHI). **This ADR is the written closure of hardening D12.**

## Context

Three of the four initiatives touch the same schema surfaces (the collision matrix, program §1
C-α…C-θ). Landing them unreconciled would proliferate polymorphism dialects (exactly what
hardening D12 forbids), duplicate the "who/what a row is about" vocabulary, and amend Rule 12
twice with diverging wording. The design grill of 2026-07-10 (verified against the generated
types, not the stale baseline) settled every collision. This ADR transcribes the **already-made,
human-approved** conventions into one durable record so F1–F3 build against a settled contract
and the per-phase 🔴 reviews are conformance checks, not re-litigation. It does **not** introduce
or re-open any decision.

## Decision

### 1. Three sanctioned polymorphism dialects (closes D12)

The platform has, and will keep, **exactly three** cross-reference dialects. A fourth requires a
new ADR. Naming the incumbent (dialect 1) is load-bearing: it keeps the already-unified
`action_items.source_*` from reading as an unsanctioned "fifth site" of an un-blessed pattern.

1. **Named-FK + shape CHECK** *(incumbent).* A `kind`/`source_type` discriminator + explicit
   **named nullable FKs** + a kind-scoped shape CHECK.
   - **Use for** intra-domain source/provenance links where the target set is closed & small and
     real FK integrity + join targets are wanted.
   - **Why:** keeps referential integrity and lets you JOIN; the CHECK makes the shape total.
   - **Instances:** `rca_evidence` (`kind` + `cited_*_id`), `referral_shared_item` (`kind` +
     `source_*_id`), `case_events` (`kind`), `capa_plan` (source-polymorphic), and
     `action_items.source_*` (`source_type` + named `source_meeting_id`/`case_id`, no generic
     `source_id`).

2. **Owner-dispatch polymorphism** — `(owner_type text, owner_id uuid)`, **no FK**; authorization
   dispatched by a `SECURITY DEFINER` `app.can_*` CASE dispatcher; **never a join target**;
   explicit two-step reads.
   - **Use only** for a row *owned by / living under* one of several **heterogeneous** parent
     domains that share no common registry.
   - **Why:** the parents have no shared key to FK against; a text discriminator + a DEFINER
     dispatcher keeps authorization in one auditable place instead of N per-link rules.
   - **Sole sanctioned instance:** the attachments authorizing owner
     (`case|meeting|interview|action_item|form_upload`). `form_upload` is permanently inert (C-ζ).

3. **Typed-identity registry** — a `participants`-style anchor with `UNIQUE(id, type)` + subtype
   tables pinned by **composite FK + CHECK**.
   - **Use for** a **reusable identity that many rows point at** (people, orgs, entities as case
     subjects).
   - **Why:** one identity row is referenced by many rows; the composite-FK+CHECK pin keeps a
     subtype (e.g. `professional`) from ever acquiring the wrong satellite (e.g.
     `patient_identifiers`) — the class-separation invariant (0064 R5).

**Bridging rule (load-bearing).** `attachment_subjects` does **not** get a fourth
`(subject_type, subject_id)` no-FK polymorphism. Its subject is a **participant** —
`attachment_subjects.participant_id → participants(id)` (dialect 3). One subject vocabulary, not
two (C-β). **Consequence: participants (F1) must land before attachments (F2).**

### 2. Identity/subject convention

`participants` is **the** platform's reusable identity registry. Anything that records *who/what a
row is about* references it rather than inventing a parallel subject table. First consumers:
`case_participants` (F1) and `attachment_subjects` (F2, via `participant_id`); the F3 `reference`
item type bridges to it too (convention 9). This is the direct application of dialect 3.

### 3. One Rule-12 sensitivity taxonomy (drafted here, applied per-phase)

Rule 12 is amended by **two** initiatives (0063, 0064); the merged wording is authored **once**
here and each phase's Record step applies its slice (program §4). The three patient-PHI modules
survive intact — this is an **added axis, not a replacement**.

- **Class 1 — patient PHI** (unchanged): the three isolated modules — NSP `event_patient`,
  referral `referral_patient`, case `case_patient`/`patient_identifiers` — under the identical
  posture: isolated REVOKE-ed satellite · audited **single door** · reveal-on-demand · LGPD-erasure
  disposal.
- **Class 2 — professional identity** (0064, lands **F1**): a doctor-under-review is LGPD personal
  data but **not** patient health PHI. Case-scoped RLS + **audited reads**
  (`professional_profile.read` on the `log_audit_access` allow-list, PHI-free metadata) — but **no**
  isolated single door, **no** reveal-on-demand. Lives in `professional_profiles`. No `dispose_*`
  path at E0 (the CFM-retention-vs-erasure posture is designed in E1/E2 — 0064 M2).
- **Attachments layer** (0063, lands **F2**): two orthogonal columns —
  - `sensitivity_tier ∈ {phi, standard}` is the **physical** PHI segregation (picks the bucket);
  - `confidentiality_label` is the **semantic** regime, **aligned to the two classes**: the
    `phi_*` labels map to Class 1; `ethics_investigation` / `credentialing_sensitive` /
    `peer_review_confidential` / `legal_privileged` map to Class 2 or governance-confidential;
    `non_phi_internal` is neither. The label value-set (0063 open item a) is thus finalized
    **together with** the class definitions, as one taxonomy — not twice.

Rule 12's closing "modules that don't need patient identity hold none by design" sentence is
preserved.

### 4. Disposal composition order

`dispose_case_phi` is edited by two initiatives; they **compose in a fixed order** so the edits
never conflict:

1. **F1** rewrites `dispose_case_phi` to the **participant-keyed** shape — per-satellite purge (N
   patients per case) + each participant's `patient_xref` rows (0064 R3), `get_case_patient →
   get_participant_patient`.
2. **F2** then **layers** the D10 per-owner attachment-redaction line
   (keyed `(owner_type, owner_id)`) on top of F1's version, plus `dispose_attachment_phi`.

Because F1 fully lands + types regen before F2 begins, the edits compose cleanly. **No separate
patient-master door.** The standalone hardening D5/§6.2 "hospital-scoped patient master" is
**dropped** — the participant model (`patient_identifiers` off `patient_participants`) + the
existing key-only `patient_xref` linkage (ADR 0039) **are** the identity substrate; a third
patient store would itself be a collision (C-δ). C-6's single-erasure goal is met by the
generalized per-participant doors + xref purge.

### 5. Catalog-table vs CHECK-enum convention

The rule that lets us adopt 0064's catalogs while cancelling D6/§6.3's form-item catalog (C-ε):

- **Tenant-extensible vocabularies → catalog tables.** Vocabulary an org/commission may extend at
  runtime lives in a table: `case_types`, `case_participant_roles`, `action_item_statuses` /
  `action_item_urgency_levels`, `case_status_defs`-style vocab.
- **Code-coupled type systems → CHECK enums.** A type space where each member needs
  renderer/evaluator/immutability support (adding one is a code change, never a data change) stays
  a CHECK-constrained `text` column, widened per feature: `form_items.item_type`. **D6/§6.3's
  metadata-driven `form_item_types` refactor is CANCELLED** — superseded by ADR 0060's explicit
  "keep the CHECK enum, widen per feature." Only the one-line `ELSE false` safety flip (D6-flip)
  was ever wanted, and it already shipped in Wave 1.

### 6. Freeze principle

Defines what the reset-OK window is — and is not — spent on:

- **Freeze answer-DATA shapes now.** The structure that binds *historical answers* is expensive to
  add post-data, so it lands pre-pilot even when inert (F3's inert answer tables:
  `answer_matrix_cells`, `answer_risk_matrix`, `answer_references`, repeating-group position
  uniqueness).
- **Definitions, engines, and enum-widens are additive anytime** and are **NOT** pre-landed —
  they bind no historical answer and carry no reset-OK penalty (calculations/derived fields, i18n,
  the correction/`reopen` engine, per-item validation logic). They are forward-notes, not
  create-now scope.

### 7. Reference → participants bridge

The F3 `reference` item type targets the participants registry:
`answer_references.participant_id → participants(id)` + a `reference_kind` discriminator. This
unifies initiatives A (forms) and C (participants) on one identity vocabulary (convention 2).
Internal-platform-entity reference lanes (dept/committee/user selectors as first-class targets)
are deferred-but-additive. F3 therefore also depends on F1 (the FK needs the registry to exist),
satisfied by the `F0→F1→F2→16→F3` order.

### 8. Supersession correction model

Ratified **now** (design decision recorded), engine/UX **deferred** (0060 Gap 38):

- A future submitted-form correction **supersedes** the prior via a nullable
  `responses.supersedes_id`; aggregation counts only the **latest in a supersession chain**.
- Ratified pre-pilot so Phase-15 / dashboard aggregation is built **supersession-tolerant** — the
  later correction feature then can't corrupt already-shipped metrics. The `reopen`/correction RPC
  + UX defer to a post-pilot ADR (freeze principle §6 — the engine is additive-anytime).
- **Accepted pilot risk (no guard):** without a correction UX, standalone forms can still
  accumulate duplicate submissions; a blanket uniqueness constraint is unsafe (some forms are
  filled repeatedly, e.g. a monthly audit). Recorded, not fixed here.

### 9. Live-catalog facts (verified 2026-07-10 sweep — F0 records them)

So F1/F2/F3 reference these instead of re-deriving (also in `docs/backend-state.md`):

- **R1 gate (0064):** `is_multi_org()` and the cited migration `…629000000` **do not exist** in
  the shipped schema (the review detail was stale). The **actual** gate on
  `app.can_read_case_patient` (`20260710000000_nsp_per_hospital.sql`) is **per-hospital
  PQS-operator** (`is_pqs_operator_of_for(hospital_of_commission(…))`) **+ per-commission**
  (staff-admin / membership / live `case_access` / phase-or-narrative assignee) — no org/multi-org
  boolean. F1's `get_participant_patient` **inherits this predicate unchanged**; professional
  identity is deliberately **not** so gated (LGPD-personal, case-scoped).
- **HC high-water = HC093** (controlled-docs frozen-set guard); new SQLSTATEs start at **HC094+**.
- **`form_items.item_type` = 10 values** — `multiple_choice, dropdown, checkbox, free_text,
  short_text, number, date, time, section_text, image` — with the D6-flip `ELSE false` already
  landed (`20260711000300_schema_integrity_checks.sql`).
- **No `(owner_type, owner_id)` polymorphism exists today** — F2's attachments core introduces the
  first (dialect 2). None of the new tables/flags (`attachments`, `case_participants`,
  `case_types`, `is_exclusive`/`risk_weight`/`behavior_config`) exist yet.
- The four `dispose_*` bodies are the ones in `20260711000700_phi_disposal_closure.sql`.

## Consequences

- Hardening **D12 is closed** — three named dialects with a written "when to use which" rule; a
  fourth needs a new ADR.
- One subject vocabulary (participants), one Rule-12 taxonomy (two classes + the attachments
  layer), one disposal composition order — the 🔴 collisions (C-α/β/γ/δ) are resolved here, so the
  per-phase reviews are conformance checks.
- Two hardening tracks are **removed** rather than built: D5/§6.2 (patient master, superseded by
  participants + `patient_xref`) and D6/§6.3 (form-item catalog, cancelled by ADR 0060).
- `form_items` stays a single-owner (F3) surface; **`form_items.phi_policy` is dropped** (C-ζ) and
  no file/upload item type is added — no B/F3 co-edit of `form_items`.
- Phase-15 aggregation is built supersession-tolerant; correction engine, calculations, and i18n
  are forward-notes (freeze principle), not reset-OK spend.

## ADRs amended by this program (see each ADR's Reconciliation note)

- **0064 → F1:** records Class 2; participants = dialect-3 typed registry; **supersedes ADR 0033's
  "no participants" stance**; precedes attachments.
- **0063 → F2:** `attachment_subjects` re-keyed to `participant_id`; `form_items.phi_policy`
  reservation dropped; label value-set aligned to the merged taxonomy; after F1.
- **0060 → F3:** `action_items.source_*` named as a dialect-1 instance; no upload type, no
  `phi_policy`; D6/§6.3 CONFIRMED CANCELLED.

# 0080 — Committee Charters & Cadence (S4·CH): delegate the regimento to the controlled-doc lifecycle

**Date:** 2026-07-20 · **Status:** accepted (requirements interview / grilling with the PO; binds the
CH build plan). **Owner:** platform lead → `backend` (contract-first) → `frontend`.
**Track:** CH (Phase 21 · Committee Charters & Meeting Cadence) of the
[Pre-Pilot Release Scope Expansion](../plans/pre-pilot-release-scope-expansion.md) (ADR
[0071](./0071-pre-pilot-release-scope-expansion.md)); build plan:
[charters-cadence.md](../plans/charters-cadence.md).
**Binding rules:** Rule 1 (RLS boundary — member-read / staff_admin-write via a DEFINER door), Rule 2
(extend the canonical schema, never contradict), Rule 8 (regen types), Rule 9 (data access via
`src/lib/queries/`), Rule 10 (pt-BR UI / English code), Rule 11 (audit charter edits), **Rule 12 (CH
holds no patient data)**.

## Context

The written CH scope (accreditation-track §21; pre-pilot plan §CH) predates the D11 status-key
anglicization, the action-items-hub fold (ADR 0050), and the delegate decision below — so its text has
**drifted from the live catalog** in five places (verified 2026-07-20 against `pg_catalog`):

1. Meeting status key is **`held`**, not `realizada` (§21 says "last `realizada` meeting").
2. *"commission_default plenary"* = **`meetings.visibility_policy='commission_default'`** (this is how
   `participants_only` ethics hearings are excluded), **not** a meeting-type — `commission_meeting_types`
   has no default/plenary flag.
3. **No "deferred agenda item" state exists** — `meeting_agenda_items` has only a nullable `resolution`.
4. **`meeting_action_items` is gone** — folded into the `action_items` hub (`source_type='meeting'`;
   "open" = a non-terminal `action_item_statuses`).
5. Controlled-doc content is a **file** (`controlled_document_versions.storage_path`), with
   `effective_date`/`review_due_date` on the **version** and `documents_due_for_review()` already
   scanning them; `controlled_documents.doc_type` already allows **`regimento`**;
   `compute_due_notifications()` has **no** docs/review/cadence arm.

§21 also modeled the charter as a standalone table carrying four sanitized-Markdown fields
(`purpose`/`scope`/`authority`/`membership`) **and** its own `effective_date`/`review_due_date` **and**
a nullable `controlled_document_id` — which duplicates everything a `doc_type='regimento'` controlled
document already carries. This ADR records the PO-ratified decisions that reconcile CH to the live
platform and resolve the charter↔controlled-doc modeling fork. It does not contradict the ratified
spine (X-η "quorum stays in `commission_meeting_settings`, CH read-only on `meetings`"; X-ζ additive N
engine); it scopes CH's first increment.

## Decision

**The regimento IS a controlled document; `commission_charters` is a thin cadence-config row that links
to it.** Single source of truth for the charter's content, dates, and review scheduling.

| # | Decision | Choice |
|---|----------|--------|
| 1 | Charter ↔ controlled-document | **Delegate.** The regimento is a `doc_type='regimento'` controlled document riding the shipped Phase-17 draft→submit→approve→publish→sign lifecycle. Not a standalone Markdown record. |
| 2 | Governance text home | **The controlled-document file.** Drop the four Markdown fields — content = the uploaded/approved regimento file (`storage_path`). No inline charter text. |
| 3 | Charter dates | **Delegated to the doc version.** Drop the charter's own `effective_date`/`review_due_date`; the linked `controlled_document_versions` carries them (and drives the review reminder). |
| 4 | `commission_charters` shape | **`{commission_id PK (1:1), meeting_frequency NOT NULL, controlled_document_id NULL}`** (+ `created_by`/`created_at`/`updated_at`). `meeting_frequency ∈ {semanal,quinzenal,mensal,bimestral,trimestral}`. `sem_regimento` = **no row**. |
| 5 | Cadence state model | **4 states, never-met = neutral.** `meeting_cadence_status` returns `em_dia` / `em_atraso` / `sem_reunioes` / `sem_regimento`. A commission with a frequency but zero qualifying meetings = `sem_reunioes` (neutral) until its first meeting — **no anchor date needed**. |
| 6 | Cadence computation | **DEFINER, member-scoped** (denies non-member Organization Users — ADR [0078](./0078-authorization-capability-model.md) A8). Counts meetings with `held_at IS NOT NULL AND visibility_policy='commission_default'`; compliant iff `now() − max(held_at) ≤ window`; **calendar-interval** windows (1 week / 2 weeks / 1 month / 2 months / 3 months). The meetings-list indicator sources from this RPC, **not** the RLS-filtered visible list. |
| 7 | Carry-forward | **Suggestion + selective copy.** `suggest_carry_forward(commission)` is a **pure DEFINER read** returning (a) unresolved agenda items (`resolution IS NULL`) from the most-recent held `commission_default` meeting, (b) open meeting-sourced action items from `commission_default` meetings — **both filtered through `can_read_action_item`** so `case_restricted`/`participants_only` items never leak. The chair ticks agenda items → each becomes a **new** `meeting_agenda_items` row via the existing `create_meeting_agenda_item` (old rows stay as history); action items are **surfaced read-only** (not duplicated, not re-linked). No new write door. |
| 8 | Notifications integration | **Cadence-overdue arm only.** One new `compute_due_notifications` arm: `em_atraso` → a weekly-bucketed reminder to the commission's `staff_admins` (PHI-free body). The regimento **review-due** reminder is **deferred** to a future generic controlled-docs review arm (a Phase-17 concern, not a charter special-case). |
| 9 | UI | **Dedicated `manage/charter` page** ("Regimento & Cadência"): the linked regimento (link-existing or create-new, handing off to the controlled-doc flow), the `meeting_frequency` setting, the live cadence status. Plus the cadence indicator on the meetings list + the carry-forward step in the schedule-meeting flow. |
| 10 | SQLSTATE | **`HC0K·`** (reconciled from the plan's original `HC0D·`, which collides with `delete_ad_hoc_case_*`; `HC0K` verified unused). |
| 11 | Flag | **`charters`** created seed-OFF, flipped ON at the CH gate; `seed.sql` forces ON for local/E2E; **no prod-enabling migration** (prod OFF till pilot, mirroring ETH·E2). Flag-OFF preserves byte-for-byte pre-CH behavior. |

## Consequences

- **The written §21 acceptance criteria are superseded for CH** by the reconciled AC in
  [charters-cadence.md](../plans/charters-cadence.md): the "charter editor (sanitized Markdown)" is
  replaced by the controlled-doc authoring flow + a frequency setting; "last `realizada` meeting" →
  "last `held` `commission_default` meeting"; carry-forward reads the `action_items` hub, not a
  `meeting_action_items` table. §21 gets a reconciliation pointer at the Record step.
- **CH is decoupled from the controlled-doc RPCs at the schema level** (a single nullable FK); the FE
  **reuses** the shipped Phase-17 doc UI for the regimento, so the new FE is thin. No file-ownership
  serialization with any active track — S4's other two tracks (ETH·E2, RV2·R2–R5) are complete.
- **Deferred, all additive (no rebuild):** the regimento review-due reminder (rides a future generic
  docs-review arm); a **stricter never-met** cadence variant (anchor `em_atraso` on the linked doc's
  `effective_date` when a committee declared a cadence but never convenes); email delivery (rides N's
  deferred email channel).
- **Rule 12:** CH holds no patient data — charter text lives in the controlled-doc file, and frequency,
  meeting dates, and commission names are all non-PHI. The cadence-overdue notification body is
  PHI-free by construction (commission name + a fixed pt-BR string).
- **Trade-off accepted:** to *have* a regimento a commission must run the controlled-doc lifecycle
  (author a file, submit, approve, publish) — there is no lightweight inline charter. This is the
  JCI-GLD-correct posture (a charter is a formally approved, versioned document) and maximally reuses
  shipped machinery, at the cost of heavier authoring + seed data needing a storage file + a published
  version.

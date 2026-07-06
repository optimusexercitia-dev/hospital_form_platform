# 0057 — Phase 15/17 revision & pre-pilot re-sequencing (15 → 17 → 16)

**Date:** 2026-07-05 · **Status:** accepted · **Supplements:** ADR 0028 (track roadmap);
touches the surfaces hardened by ADRs 0051/0052/0055.

## Context

The Phase 15 (Quality Indicators) and Phase 17 (Controlled-Document Lifecycle) specs
were written 2026-06-17, before multi-tenancy + the `hospital_admin` tier (ADR 0041/0051),
NSP-per-hospital (ADR 0052), form-model normalization (option `code` identity),
answer-model v2 (typed `answers.value_number`), and the pre-pilot hardening that made
CAPA a hospital-anchored, PQS-operator-only write surface (ADR 0055). Both specs were
re-based against that reality (interview 2026-07-05).

## Decisions

1. **Re-sequencing:** Phase 17 is pulled **pre-pilot**; remaining pre-pilot build order is
   **15 → 17 → 16** (phase numbers unchanged), so Phase 16's evidence picker ships with
   indicators AND controlled documents linkable — no dead `artifact_kind`. Pilot still
   follows Phase 16; Phases 18–21 stay post-pilot.
2. **Scope tier (both phases):** commission-owned rows (`commission_id NOT NULL`,
   member-read / `is_staff_admin_of OR is_commission_admin_of`-write) **plus one read-only
   DEFINER hospital rollup** each (`hospital_indicator_rollup`, `hospital_document_register`
   — the `nsp_org_*` pattern). No new write tier; dual-scope ownership deferred (additive
   widen if the pilot demands it).
3. **Derived indicators:** `percentual`/`contagem` from option **`code`s** (validated on
   save), `tempo_medio` = avg of `answers.value_number`; **`taxa` = hybrid** — derived
   numerator + manually passed denominator in a **one-step**
   `compute_derived_measurement(..., p_denominator)` (recompute preserves the stored
   denominator; no partial-measurement state). Derived values must equal the Phase-8
   dashboard aggregates (pgTAP parity lock).
4. **Off-target → CAPA = two-tier escalation:** CAPA stays NSP-owned. "Abrir CAPA" is
   capability-gated to PQS operators (`open_capa_plan` indicator arm derives `hospital_id`
   from the indicator's commission; `can_write_capa` untouched); `can_read_capa` gains an
   indicator arm (the indicator's commission members read the plan). Non-operator
   staff_admins get an Action-Items-Hub prefill instead. The FK-less hooks
   `capa_plan.source_indicator_id` + `capa_measure.indicator_id` gain real FKs.
5. **Document approvers:** any **active same-hospital user**, named per version at submit;
   a pending `document_approvals` row **grants read** (case_access-style OR-term on
   documents, versions, and storage reads); **all** must sign `aprovado` before publish;
   `rejeitado` → back to `rascunho`. Signature = sign-own-row + `signature_hash`
   (mirror `meeting_signatures`).
6. **Forms as controlled documents = metadata-only:** optional `approved_by/at`,
   `effective_date`, `review_due_date` captured **inside `publish_form_version`**;
   overdue forms join the review-due list. No e-sign workflow on the form lifecycle.
7. **Mechanical re-basing:** indicator SQLSTATEs from **`HC084`** (the spec'd `HC054+` is
   consumed), Phase 17 continues after them; a static in-app pt-BR indicator template
   catalog (no schema); measurements staff_admin-write, audited edits;
   `review_cycle_months` computes the due date at publish (overridable).

## Consequences

Revised specs in `docs/phases/accreditation-track.md`; ordering notes updated in
CLAUDE.md §5, PHASES.md, and `docs/quality-track-context.md`. Widening CAPA authoring to
committees was **rejected** to preserve the two-tier committees-escalate-to-NSP model and
the hardened CAPA write surface.

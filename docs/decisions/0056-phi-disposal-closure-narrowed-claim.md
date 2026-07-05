# ADR 0056 — PHI-disposal closure + narrowed erasure claim (DB-side complete, Storage retained)

**Status:** Accepted (planned) · **Date:** 2026-07-05 · **Feature:** Pre-Pilot DB
Hardening — WS-4 (C-6). The last critical. Completes DB-side PHI disposal across all three
entity graphs, adds the missing meeting-minutes path, closes the §6.4 path/decline leak,
and **narrows the erasure claim** to be truthful. Part of the pre-pilot program
([pre-pilot-db-hardening-program.md](../plans/pre-pilot-db-hardening-program.md) §1 WS-4);
triage in [external-db-audit-2026-07-evaluation.md](../reviews/external-db-audit-2026-07-evaluation.md)
§2 (C-6) + §6.4. Architecture Rule 11/12; the binding regime is LGPD + ANVISA/RDC + CFM
1821/2007 (ADR [0035](./0035-lgpd-anvisa-regulatory-posture.md)). **Supersedes the erasure
language** in the disposal-touching ADRs ([0030](./0030-patient-safety-phi-and-pqs-architecture.md),
[0037](./0037-inter-committee-case-referrals.md), [0038](./0038-case-patient.md),
[0052](./0052-nsp-per-hospital.md)) — those said "erased/disposed" without the DB-vs-Storage
distinction this ADR makes precise.

## Context

The three `dispose_*` RPCs were **materially incomplete**, so "patient erased" was not a
truthful claim. Verified per-graph:

- **`dispose_case_phi`** touched only `case_patient` + `case_narratives.body_md` +
  `case_events.body` + the flag. It LEFT INTACT: case-phase **`answers`** (patient-authored),
  `case_interviews.summary_md`, `case_interview_subjects.note`, `cases.label`,
  `case_documents.{title,description}`, `meeting_cases.{summary,decision}`, `case_events.title`.
- **`dispose_event_phi`** already walked event → triage → rca → capa well, but missed
  `rca_evidence.{title,citation_label}` and `rca_why_chains.root_text`.
- **`dispose_referral_phi`** was nearly complete; missed `referral_reply_attachment.title`.
- **`meetings.minutes_md`** (+ `meeting_agenda_items.*`) had **no disposal path at all**.
- **§6.4:** `get_referral_detail` returned `frozen_storage_path` — and, un-flagged,
  `decline_note` (PHI-classified) — to a **metadata-only (non-PHI) reader**.

## Decision

### 1 · Complete DB-side PHI disposal in every graph
- **`dispose_case_phi`** now also: **DELETEs** the case-phase `answers` (full LGPD erasure of
  patient-authored content — redact-in-place would leave the patient's choice pattern, which
  is still personal data; selections cascade via FK). The **institutional outcome
  survives**: `case_phases.result_id` / `result_computed_at` are stored and NOT recomputed on
  an answer delete (the only recompute trigger is `sync_case_phase_on_submit` on `responses`
  UPDATE), so the committee's categorical result is preserved — institutional, not personal.
  Also nulls `case_interviews.summary_md`; redacts `case_interview_subjects.note`,
  `cases.label` (closes the asymmetry — referral already redacts the identically-warned
  `subject`), `case_documents.{title,description}`, `meeting_cases.{summary,decision}`,
  `case_events.title`.
- **`dispose_event_phi`** gap-fill: `rca_evidence.{title,citation_label}`,
  `rca_why_chains.root_text`.
- **`dispose_referral_phi`** gap-fill: `referral_reply_attachment.title`.

### 2 · `dispose_meeting_minutes(meeting, reason)` — new, standalone, per-meeting
A meeting can discuss **many** cases (`meeting_cases UNIQUE(meeting_id, case_id)`), so
redacting a whole meeting's minutes on a single-case dispose would over-redact minutes about
other cases. Therefore meeting-minutes disposal is **decoupled**: `dispose_case_phi` only
redacts the case-scoped `meeting_cases.{summary,decision}`, never the meeting's own
`minutes_md`. The new coordinator-gated (`is_staff_admin_of(commission_of_meeting) OR
is_commission_admin_of`) one-shot RPC nulls `meetings.minutes_md`, redacts
`meeting_agenda_items.{description,discussion_notes,resolution}`, sets a new
`meetings.phi_disposed_{at,by,reason}` flag (HC056 on re-dispose), and emits a
`meeting_minutes.disposed` mutation audit row (via `audit_write`, which does NOT validate a
verb allow-list — so no C-4 dispatch-map entry; it is a mutation audit, not a read action).

### 3 · §6.4 leak
`get_referral_detail` now gates **both** `frozen_storage_path` **and** `decline_note` on
`v_can_phi` (the referral-PHI reader), matching the already-correct `frozen_body_md` gate.

### 4 · Storage retained — the NARROWED claim (the load-bearing decision)
**Rule-6 Storage immutability is kept: disposal does NOT delete bucket objects.** The
now-truthful claim is:

> **Disposal erases all DB-side PHI. Attachment blobs are retained, encrypted at rest,
> under the LGPD/ANVISA/CFM 20-year record-retention regime.**

Disposal is idempotent (one-shot, HC056) and keeps each function's existing authority gate.
The new redactions run under scoped `set local` GUC bypasses (`app.in_case_rpc`,
`app.in_narrative_rpc`, `app.in_interview_rpc`, `app.in_submit_rpc`, `app.in_meeting_rpc`,
`app.in_referral_rpc`) so the frozen/submitted-child guards don't block the erasure; all
reset at function exit.

## Consequences

- **The erasure claim is now truthful on the DB side.** Every PHI-classified column/table in
  each entity's graph is empty or redacted post-dispose (locked by pgTAP `197`).
- **FE follow-ups (logged):** (a) a `dispose_meeting_minutes` action + UI (none exists);
  (b) the disposal-confirmation copy MUST reflect the narrowed claim — **no "tudo apagado"
  over-claim**; it should say DB PHI is erased and attachments are retained encrypted under
  retention; (c) `decline_note` is now null to a non-PHI reader — if the source-commission
  decline-feedback view showed it to a non-PHI reader, the product needs a separate
  **non-PHI "motivo da recusa"** field (a broken decline-feedback E2E, if any, is a known gap,
  not a regression).
- **Deliberately NOT done:** Storage object deletion (Rule 6 / retention) — the claim is
  narrowed instead, per the locked user decision. A future "hard-delete blobs at
  retention-expiry" job is a separate, retention-clock-driven track, not pre-pilot.

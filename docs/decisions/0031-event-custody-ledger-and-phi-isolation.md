# ADR 0031 — Event Custody Ledger, Access-Follows-Custody RLS & PHI Isolation (Phase 14a)

**Status:** Draft (B1 plan-gate) · **Date:** 2026-06-18 · **Phase:** 14a ·
**Under:** ADR [0030](./0030-patient-safety-phi-and-pqs-architecture.md) (the
umbrella PHI/NSP decision; this is the per-sub-phase backend ADR it requires for
the novel/security-sensitive 14a shape).

## Context

Phase 14a lands the platform's FIRST PHI under HIPAA Rule 12. A committee
notifies the central NSP of a patient-safety **event**; the event may be handed
between the NSP and committees over its life. Three things must hold at the DB
boundary (RLS is the authority — Rule 1): (a) who can see an event must track its
**custody** (current holder) while never dropping the **reporting** committee's
provenance access, with the full hand-off history auditable; (b) patient
identifiers must be **isolated** and never leak onto queue/list/aggregate paths
(minimum-necessary); (c) every PHI read must be **audited** (HIPAA), inverting
Phase-13's "don't log reads" default for these tables.

## Decision

1. **Append-only custody ledger drives access.** `public.event_custody` is an
   append-only ledger (`owner_kind ∈ {pqs, commission}`, `owner_commission_id?`,
   `held_from`, `held_until?`, `assigned_by`, `note`); the current holder is the
   row with `held_until IS NULL`. A guard rejects UPDATE/DELETE (mirror the
   Phase-13 `guard_audit_immutable`). The current owner is **denormalized** onto
   `patient_safety_event` (`current_owner_kind` / `current_owner_commission_id`)
   so RLS reads it without recursing into the ledger; `transfer_event_custody`
   closes the prior row, appends the new one, and updates the denormalized pair
   atomically.

2. **Access-follows-custody RLS shape (the novel core).** For
   `patient_safety_event` + `event_custody` + `event_patient`, member-READ =
   `app.is_member_of(current_owner_commission_id)` (current custodian) **OR**
   `app.is_member_of(reporting_commission_id)` (provenance — never revoked) **OR**
   `app.is_pqs_member(auth.uid())` (= `app.is_admin()` today; membership-ready).
   So a transfer FROM the reporting committee TO the NSP: the NSP gains read, the
   reporting committee KEEPS read (provenance), a foreign committee gains nothing.
   A transfer between two committees: the new holder gains read, the reporter
   keeps it, the previous holder LOSES the custodian path but the reporter (if it
   was the reporter) still has provenance. All WRITES go through the lifecycle
   RPCs (the state machine guard + `app.in_*_rpc` flag funnel); the
   not-the-current-custodian check raises **HC044**.

3. **PHI isolation + audited read.** `public.event_patient` is a 0..1 satellite
   (PK = `event_id`) holding minimum-necessary identifiers (name, MRN, DOB/age,
   sex, encounter ref, unit, attending), encryption-ready (the most sensitive
   columns can move to `extensions.` pgcrypto column-encryption without a shape
   change). It carries the SAME access-follows-custody scope but is read ONLY via
   the dedicated `getEventPatient` path, which emits an explicit
   `event_patient.read` audit row (Rule 11/12) — added to the Phase-13
   `log_audit_access` positive allow-list. Identifiers are NEVER selected on the
   queue (`pqs_inbox`), the committee read-back list, or any aggregate path; the
   event row exposes only a `has_patient` boolean to gate the UI affordance.

4. **Audit never copies PHI.** The mutation-audit triggers on
   `patient_safety_event` + `event_custody` use PHI-free column allow-lists
   (status, owner, codes — excluding `description_md` and every identifier).
   `event_patient` mutations audit only `event_patient.updated` + the actor —
   never an identifier value in `metadata`. The log stays low-sensitivity even
   though the app now holds PHI (Rule 11).

## Alternatives considered

- **Inline patient fields on `patient_safety_event`** — rejected: violates
  isolation (Rule 12); identifiers would ride every event read and be one
  `select *` away from a queue/aggregate leak.
- **Static reporting-committee-only access (no custody)** — rejected: the NSP and
  receiving committees could not act on handed-off events; custody is the whole
  point of the hand-off model (ADR 0030).
- **Audit PHI reads by copying the viewed fields into metadata** — rejected:
  Rule 11 forbids copying PHI/free-text into the log; we record *that* PHI was
  read + *who*, never the values.

## Consequences

- The access-follows-custody predicate is reused by every 14a table and inherited
  by 14b–14d children (triage/RCA/CAPA scope to the event's scope).
- A future real `pqs_members` table ORs into `app.is_pqs_member` with no RLS
  rewrite (the helper is the single seam).
- pgTAP must prove: custodian/reporting/PQS read yes & foreign no, before AND
  after a transfer; custody append-only; PHI never on queue/aggregate reads; the
  `event_patient.read` audit row is written on a scoped read and the audit log
  holds no identifier.

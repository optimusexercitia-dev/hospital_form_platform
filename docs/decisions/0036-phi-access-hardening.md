# ADR 0036 — PHI Access Hardening: PQS Membership, Single-Door Identifier Read, Free-Text Classification & Disposal

**Status:** Accepted · **Date:** 2026-06-20 · **Phase:** PHI/HIPAA-readiness
remediation (post external-consultant review) · **Under:** ADR
[0030](./0030-patient-safety-phi-and-pqs-architecture.md) (PHI posture), ADR
[0031](./0031-event-custody-ledger-and-phi-isolation.md) (PHI isolation), ADR
[0035](./0035-lgpd-anvisa-regulatory-posture.md) (regulatory posture). Implements
ARCHITECTURE.md Rules 11–12.

## Context

The Phase-14 NSP module shipped with PHI isolation (ADR 0031) but an external
review (2026-06-20) found the access controls under-built relative to the
HIPAA/LGPD posture the platform advertises:

- **(C1)** the `event_patient` read-audit lived only in the TypeScript
  data-access layer; because `authenticated` retained a direct table SELECT
  grant, a direct PostgREST call read identifiers with **no audit**;
- **(H2)** `app.is_pqs_member` returned `app.is_admin_for(...)`, so every platform
  admin had blanket NSP/PHI access — no IT/clinical duty separation;
- **(C2/H4)** the clinical free-text columns carried real PHI but were neither
  classified nor read-audited;
- **(H3)** there was no controlled PHI-disposal/erasure path.

The owner approved remediating all of these (the action-item triplication, M1,
was explicitly kept as-is). This ADR records the hardened access model.

## Decision

1. **Real PQS membership; admin is not an NSP actor.** `public.pqs_members`
   (admin-managed, RLS + admin RPCs `add`/`remove`/`list_pqs_members`) backs
   `app.is_pqs_member` (no `is_admin` fallback) and `app.is_pqs_writer`. The
   standalone `OR app.is_admin()` term was stripped from **all 19 NSP PHI SELECT
   policies** and the **7 `rca_*_write` policies**; CAPA writes were already
   PQS-only via `is_pqs_writer`; event/triage/lifecycle writes are DEFINER-RPC-
   only, gated on `is_pqs_member`. Net: a platform admin reads or writes NSP
   content **only** if enrolled in `pqs_members` (disposal is the one admin-or-PQS
   exception — §4).

2. **Single audited door for identifiers.** `event_patient` carries **no direct
   `authenticated` DML** (SELECT/INSERT/UPDATE/DELETE all revoked); the only read
   path is `public.get_event_patient` (`SECURITY DEFINER`), which re-gates on the
   tighter `app.can_read_event_patient` (current-custodian **staff_admins** + PQS
   — no reporting-provenance term, no admin) and emits an **unbypassable**
   `event_patient.read` audit row. Writes stay on the existing `set_event_patient`
   DEFINER. A `patient_safety_event.has_patient` boolean (replacing the now-revoked
   embed) gates the UI affordance. This closes C1 — the audit can no longer be
   skipped via direct PostgREST.

3. **Free-text is classified PHI; detail-opens are audited (two-tier).** The
   clinical free-text/Markdown columns are labeled PHI-bearing (SQL column
   COMMENTs). Per the locked decision these keep their RLS-scoped reads, but each
   detail-open emits an **app-layer** `*.viewed` audit row
   (`safety_event`/`triage`/`rca`/`capa`/`meeting`/`interview`; case narratives +
   events stay on the existing `case.opened`). **Accepted residual:** the
   `.viewed` audit is app-layer and bypassable by a determined insider hitting
   PostgREST directly — unlike the identifiers (§2), which are not. Routing every
   clinical read through DEFINER RPCs (full lockdown) was considered and
   **deferred** as disproportionate: the structured identifiers, not the
   narratives, are the high-value target, and they are fully locked.

4. **Controlled disposal.** `public.dispose_event_phi(event_id, reason)`
   (`SECURITY DEFINER`, admin-or-PQS, runs under `app.in_safety_rpc` so it works
   on frozen records, one-shot → `HC056`) deletes `event_patient`, NULLs the
   nullable PHI free-text, and **redacts** the four NOT-NULL PHI columns
   (`rca_factors.text`, `rca_root_causes.text`, `rca_timeline_entries.description`,
   `capa_action_task.description`) to a `'[PHI removido]'` sentinel, while
   preserving the governance skeleton (codes, status, custody ledger, structured
   non-PHI) and the hash-chained audit log. It stamps `phi_disposed_at/by/reason`
   — `reason` a **constrained category**
   (`retention_expired|subject_request|entered_in_error|duplicate|other`), never
   free text — sets `has_patient = false`, and emits one `event_patient.disposed`
   row whose metadata carries only the enum reason. This is the LGPD Art. 18
   erasure mechanism, reconciled with CFM 20-year retention of the governance
   record (ADR 0035). The disposal's incidental table-mutation audit rows are
   PHI-free (the triggers' column allow-lists exclude every PHI column — ADR 0031
   §4), proven in pgTAP.

## Consequences

- **Duty separation is real:** the first admin must enrol PQS staff via
  `add_pqs_member`; a non-PQS admin opening an NSP route degrades cleanly to a
  pt-BR 404 (the read predicate denies → null). A PQS-membership **management UI**
  and NSP-route gating on `is_pqs_member` (for a tailored "não autorizado") are
  frontend follow-ups.
- **Reporting committees lose identifier access on hand-off:** the panel predicate
  is tighter than the event predicate, so a reporting commission's staff_admin
  keeps the governance event (provenance) but loses the patient panel once custody
  moves — the intended minimum-necessary behaviour.
- **Export must treat free-text as PHI** (Phase 19): the classified columns are
  not safe to ship as "PHI-free"; `*.title`/label fields must be kept PHI-free by
  input policy.
- **Verified** by pgTAP (membership gating, the `event_patient` revoke, the
  single-door read + exactly-one audit, the RCA-write severance, disposal
  null/redact/preserve/one-shot/audit-PHI-safety) and E2E; **no column encryption
  was added** (ADR 0035).
- **Implemented in the consolidated migration baseline** (the 90→12 squash, same
  remediation): no incremental migration — the security deltas are authored into
  the baseline and proven schema-equivalent + intended-delta-only via `db diff`.

# Quality-Track Context — Accreditation & Quality Governance (Phases 13–21)

**Read this first when starting any work in the accreditation track.** It is the
orientation layer: it does **not** restate the platform's binding rules — those
stay in **[CLAUDE.md](../CLAUDE.md)** and **[ARCHITECTURE.md](../ARCHITECTURE.md)**,
which remain the single source of truth for the *whole* platform. This file adds
only the context that is specific to Phases 13–21: how the track is organized,
the conventions every phase inherits, how the quality features couple to the
committee track's data, and the ADR / feature-flag index.

- **Phase specs + acceptance criteria:** [phases/accreditation-track.md](phases/accreditation-track.md)
- **Core-platform plan + track index:** [../PHASES.md](../PHASES.md)
- **What the backend already provides:** [backend-state.md](backend-state.md)

---

## 1. How this track is organized (and why not a physical module)

The accreditation/quality work lives in **the same codebase and the same
Postgres schema** as the committee platform, organized by the existing
**feature-folder convention** (`src/lib/<feature>/`, `src/lib/queries/<feature>.ts`,
`src/components/<feature>/`, route groups under `src/app/c/[slug]/<feature>/` and
`src/app/admin/<feature>/`). New track features add new feature folders
(`patient-safety`, `indicators`, `accreditation`, `documents`, `audits`, …) the same way
Phases 10–13 added `meetings`, `interviews`, `timeline`, and `audit`.

We deliberately **did not** split the platform into physical `/src/modules/*`
packages (e.g. `committees` vs `quality_management`), because:

1. **Next.js App Router pins routes to `src/app`** — route segments define the
   URLs and cannot move under a module dir without splitting routes from their
   logic.
2. **One schema, one RLS surface.** The quality features are *coupled by design*
   to committee data (see §3) — `audit_log` spans every entity, indicators derive
   from form aggregates, CAPA originates from cases/meetings/findings, evidence
   links point at committee artifacts. A hard module boundary would imply an
   independence the domain doesn't have.
3. **The rules are global.** RLS, immutability triggers, the condition evaluator,
   the audit contract, the team protocol, conventions — these must be identical
   across both tracks. A second `CLAUDE.md` per module would be a second source of
   truth that drifts. So there is exactly one CLAUDE.md/ARCHITECTURE.md; this
   track gets *scoped context* (this file) and *split detail*
   (`phases/accreditation-track.md`), never a duplicated rulebook.

What we **did** do is split the *docs*: PHASES.md keeps the core track (0–12) +
the track index; the 13–21 detail moved to `phases/accreditation-track.md`; this
file carries the track-wide context — so the per-spawn read stays small without
relocating a single line of application code.

> An ADR formalizing this organization decision can be added under
> `docs/decisions/` (next free number is `0030`) if/when we want it in the ADR
> log per CLAUDE.md §8; until then this section is the record.

## 2. Conventions inherited by every phase in this track

These are summarized here for orientation; the **authoritative** copy is the
preamble of [phases/accreditation-track.md](phases/accreditation-track.md), and
each derives from a rule in CLAUDE.md/ARCHITECTURE.md (do not re-litigate per
phase):

- **Feature-flagged.** Each feature is inserted **OFF**, flipped **ON** in-phase —
  mirror the `meetings` / `interviews` pattern. Flag index in §4.
- **Error class.** Custom SQLSTATEs continue the **`HC0xx`** class **from `HC042`
  upward** (Phase 13 took `HC042`; ADR [0018](decisions/0018-custom-sqlstate-class.md)).
- **RLS is the authority.** Writes go through RLS; every narrow `SECURITY DEFINER`
  exception is documented in an ADR (Architecture Rule 1).
- **Audit everything.** Every mutation emits an audit row and sensitive reads are
  logged explicitly — Architecture **Rule 11**, established in Phase 13 (§3).
- **pt-BR user-facing text; English code/comments/commits** (Rule 10).
- **Sanitized Markdown, never raw HTML** for all explanatory/free text (Rule 7).
- **Accessibility:** one keyboard-only flow per phase; labels, focus, ARIA.
- **Types regenerated after every migration**, imported only from `src/lib/types/`
  (Rule 8).
- **PHI in scope, minimum-necessary.** PHI is permitted on HIPAA-compliant
  infrastructure (Supabase BAA) and recorded by the **patient-safety / NSP module
  (Phase 14)** under HIPAA safeguards — isolation, access-audit, encryption
  (CLAUDE.md / ARCHITECTURE.md **Rule 12**). Every *other* phase here stays
  **process/measurement-focused and PHI-free by design**. Posture + PQS architecture:
  ADR [0030](decisions/0030-patient-safety-phi-and-pqs-architecture.md) (supersedes
  [0028](decisions/0028-accreditation-governance-roadmap.md)).

## 3. Data-coupling map — how the quality track rides on the committee track

This is the reason the track is one codebase, not a module. Each quality feature
reads or extends committee-track data:

- **Audit trail (13)** — cross-cutting. `public.audit_log` captures mutations
  across **both** tracks via triggers on a curated table set; sensitive reads log
  via explicit `app.audit_write(... '.read'/'.export')`. Every later phase's
  mutations must appear here (integration assertion in each phase's acceptance).
  Hash-chain design: ADR [0029](decisions/0029-audit-trail-hash-chain.md).
- **Patient safety / NSP (14)** — a committee notifies the NSP of an **event**
  (isolated `event_patient` PHI + an append-only `event_custody` ledger;
  **access-follows-custody**), which is triaged → (RCA) → a reusable `capa_plan`
  (`source ∈ {rca, event, indicator, audit_finding, meeting, manual}`; the Phase-15/18
  hooks stay nullable). Case-linked events surface on the **case timeline** (Phase 12).
  The RCA write grant reuses the **interview participant-write** shape (`can_write_rca`);
  CAPA actions reuse `case_action_items` / `app.advance_action_item_core`. PHI-bearing —
  ADR 0030 + Rule 12. Built as sub-phases **14a–14d**.
- **Quality indicators (15)** — *derived* indicators read the **Phase-8 dashboard
  spine** (`app.submitted_form_responses` + `dashboard_distributions`) keyed by the
  stable cross-version **`question_key`**, so a derived value **equals** the
  dashboard for the same window. Off-target → opens a CAPA; a later measurement can
  close the CAPA loop.
- **Standards crosswalk (16)** — `evidence_links.artifact_kind ∈ {form,
  form_version, meeting, case, indicator, capa_plan, controlled_document,
  action_item}`; an `app.artifact_belongs_to_commission` guard rejects linking a
  foreign artifact. Readiness rolls up across the artifacts the other phases produce.
- **Controlled documents (17)** — reuse the immutable-storage pattern
  (`form-assets` / `case-documents`, Rule 6) and the **meetings e-signature
  primitive** (`meeting_signatures.content_hash` → `document_approvals.signature_hash`,
  `app.can_sign_meeting` → sign-own-approval). Form publish (`form_versions`) gains
  approver + review-due metadata.
- **Internal audit (18)** — a `nao_conforme` finding **opens a CAPA**
  (`source_audit_finding_id`) *and* writes a Phase-16 `standard_assessment`; per-round
  auditor write-grant mirrors the **interview participant-write** shape.
- **Surveyor access (19)** — read-only, scope-checked `SECURITY DEFINER` reads over
  the Phase-16 readiness data; **no table write path**; every view/export audited.
  Most security-sensitive phase → **full plan review + dedicated security/RLS review**.
- **Notifications (20)** — `compute_due_notifications()` scans due/overdue signals
  across **sign-offs, meeting signatures, CAPA actions/effectiveness, document
  review-due, indicator measurement-due, audit-round schedules**; reuses the Phase-3
  Mailpit harness.
- **Charters (21)** — a charter **is** a controlled document (Phase 17,
  `doc_type='regimento'`); cadence adherence is computed from `meetings` history vs
  `meeting_frequency`; carry-forward pulls open `meeting_action_items` + deferred
  agenda items.

## 4. Feature-flag index

| Phase | Feature | Flag |
| ----- | ------- | ---- |
| 13 | Audit Trail | `audit_trail` |
| 14 | Patient-Safety Events, Triage, RCA & CAPA (NSP) | `patient_safety` |
| 15 | Quality Indicators | `quality_indicators` |
| 16 | Standards Crosswalk & Readiness/Gap | `accreditation` |
| 17 | Controlled-Document Lifecycle | `controlled_docs` |
| 18 | Self-Assessment / Internal Audit / Mock Tracer | `internal_audit` |
| 19 | Surveyor Access & Evidence Export | `surveyor_access` |
| 20 | Notifications & Escalation | `notifications` |
| 21 | Committee Charters & Meeting Cadence | `charters` |

## 5. ADR index for the track

- [0028 — Accreditation governance roadmap](decisions/0028-accreditation-governance-roadmap.md)
  — why the track exists, the rejected "minimal-identifiers" alternative, sequencing,
  and the pilot-after-Phase-16 plan.
- [0029 — Audit-trail hash chain](decisions/0029-audit-trail-hash-chain.md)
  — the tamper-evidence design behind Phase 13.
- [0030 — Patient-safety PHI posture & PQS/NSP architecture](decisions/0030-patient-safety-phi-and-pqs-architecture.md)
  — the PHI/HIPAA reversal (supersedes 0028's no-patient-data stance) + the event → triage →
  RCA → CAPA model and its 14a–14d phasing.
- *(future)* per-phase ADRs as each lands (CAPA state machine, indicator derived-compute,
  surveyor external-access shape, etc.), continuing the existing numbering.

## 6. Deployment note

Built **ahead of Phase 9 (Deployment)**, which remains pending. The agreed plan
is to **deploy a pilot after Phase 16** (the P0 accreditation core: audit trail,
CAPA, indicators, standards crosswalk) — that also validates the known prod-auth
gap (ADR [0009](decisions/0009-jwt-local-verification-gate.md)) — then sequence
Phases 17–21 informed by pilot feedback (ADR
[0028](decisions/0028-accreditation-governance-roadmap.md)).

# 0071 — Pre-pilot release scope expansion

**Date:** 2026-07-12 · **Status:** accepted (product-owner decision). **Owner:** platform
lead → backend/frontend/tester.
**Scope:** re-sequencing only — moves **twelve** already-specified initiatives from
post-pilot / deferred **into the pre-pilot release**. No new feature design; each item keeps
its own ADR/plan, feature flag, and Phase Gate (CLAUDE.md §6). Supersedes only the *timing*
in the dispositions cited below.
**Implemented by:** the sequenced build plan
[pre-pilot-release-scope-expansion](../plans/pre-pilot-release-scope-expansion.md) — an **S0**
design/spec gate → **S1–S5** dependency stages, one Phase Gate per track (14 gated units). It
resolves the cross-track schema collisions, allocates SQLSTATE/flag blocks, and lists the specs
still to author. This ADR decides *what* moves pre-pilot and *why*; the plan decides *in what order*.

## Context

The pre-pilot plan of record (ADR [0057](0057-indicators-doc-control-replan.md) /
[0028](0028-accreditation-governance-roadmap.md)) was: finish the P0 accreditation core in
order 15 → 17 → 16, **deploy a pilot after Phase 16**, then sequence Phases 18–21 and the
various deferred follow-ups on pilot feedback. The Pre-Pilot Foundations Program (F0–F3 +
F-cleanup) is complete and live on remote (2026-07-12); the only pre-pilot remainder was
Phase 16 + the Coolify app deploy + origin push.

The product owner has decided the pilot should ship a broader, more complete governance
surface. Twelve initiatives that were post-pilot or deferred are **pulled into the pre-pilot
release**.

## Decision

The following are **now pre-pilot** (prior disposition → home):

| # | Item | Prior disposition | Home |
| - | ---- | ----------------- | ---- |
| 1 | **Phase 20 — Notifications & Escalation** | post-pilot (0057/0028) | [accreditation-track](../phases/accreditation-track.md) |
| 2 | **Phase 21 — Committee Charters & Meeting Cadence** | post-pilot | accreditation-track |
| 3 | **Referrals v2 — R1 (Dialogue Core)** | pre-pilot / pilot-critical (already) | ADR [0037](0037-inter-committee-case-referrals.md) A1 · [plan](../plans/referrals-v2-dialogue-governance.md) |
| 4 | **Referrals v2 — R2–R5 (Governance)** | deferred / possible fast-follow | same |
| 5 | **Interviews v2 — Sessions + Reporting/Confidentiality** | pre-pilot planned (already) | ADR [0070](0070-interview-data-model-v2-sessions.md) · [plan](../plans/interviews-v2-sessions.md) |
| 6 | **Ethics E1 — Access spine** | post-pilot (0064 m2 hard gate) | ADR [0064](0064-case-subject-generalization-participants.md) → new ADR |
| 7 | **Ethics E2 — Procedure** | post-pilot | ADR 0064 → new ADR |
| 8 | **Ethics E3 — Terminology/UX + accreditation link** | post-pilot / deferred | ADR 0064 |
| 9 | **Action-items hub satellites** | deferred (0050 partner Ph 2–4) | ADR [0050](0050-action-items-fold-visibility-scope-case-access-expiry.md) |
| 10 | **Action-items case cross-link UI + `visibility_scope` toggle** | deferred FE (0050 F1) | ADR 0050 |
| 11 | **§6.1 — single-`memberships` collapse** | deferred (DB-hardening; WS-1 minimum-viable already shipped) | [audit §6.1](../reviews/external-db-audit-2026-07.md) → new scoped plan |
| 12 | **Supersession correction-model engine + UX** | post-pilot (0060 Gap 38) | ADR [0060](0060-flexible-forms-foundation.md) → new small ADR |

**Only Phases 18 (Self-Assessment / Internal Audit) and 19 (Surveyor Access / Evidence
Export) remain post-pilot.**

### Sequencing & dependencies (within the pre-pilot block; lead schedules)

- **Ethics: E1 → E2 → E3.** E1 is the access spine (confidentiality enforcement,
  respondent-exclusion RLS) and the **m2 hard gate** that lets the `case_participants` /
  `case_types` flags flip on real data; it must land before E2/E3 and before any real
  ethics/complaint data. E1 builds on F1 participants (done).
- **Referrals: R1 → R2–R5.** R1 (dialogue core) first; R2–R5 governance follow.
- **Interviews v2's deferred scope folds into E1** (participant-registry wiring, access-grants
  + confidentiality *enforcement*, attendance, participant-roles M2M, topics, per-audience
  summaries). Interviews v2's "Now" slice (sessions + reporting cols, ADR 0070) is independent
  and can proceed on its own gate.
- **Phase 20 (Notifications)** underpins escalation/reminder features elsewhere (break-glass
  access, overdue-CAPA / review-due / measurement-due reminders); sequence it early enough to
  serve them.
- **§6.1** and the **supersession engine** are independent structural/data items (each
  reset-OK, pre-pilot).

## Consequences

- The **pilot ships materially later** — it now follows Phase 16 **plus** the twelve items
  above (+ the Coolify deploy + origin push), not just Phase 16. Phase 9 (Deployment) still
  gates the pilot.
- **Specs/ADRs still to author before build:** Ethics E1 (was "ADR TBD ~0065"; now needs a
  real ADR), E2, E3; the supersession correction ADR (0060 Gap 38 names the two candidate
  shapes: `reopen_response` vs. an explicit `supersedes` link); the §6.1 scoped plan. Phases
  20 & 21 already have specs in accreditation-track.md; Referrals v2 (plan + ADR 0037 A1) and
  Interviews v2 (plan + ADR 0070) already have theirs.
- **No change to the Phase Gate or the "nothing merges ahead of its phase" rule.** Each item
  keeps its own gate, feature flag, and reset-OK pre-pilot posture; nothing here relaxes
  RLS/PHI rules (Rule 12 unchanged).
- Supersedes the *timing only* in ADR 0057 (18–21 post-pilot), ADR 0064 (E1/E2 post-pilot +
  the m2 "post-pilot" note), ADR 0060 (Gap 38 post-pilot), ADR 0050 (satellite/cross-link
  deferrals), and the DB-hardening §6.1 "stays deferred" disposition — each remains valid on
  its substance; only the schedule moves to pre-pilot.

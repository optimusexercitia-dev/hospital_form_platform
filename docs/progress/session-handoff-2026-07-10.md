# Session Handoff — 2026-07-10 (Pre-Pilot Foundations Program)

Lead-orchestration handoff. **Status source of truth stays PROGRESS.md** — this file is
the "what to do next + gotchas" note for the session that resumes.

## Where we are

**Pre-Pilot Foundations Program** (umbrella plan:
[pre-pilot-foundations-program](../plans/pre-pilot-foundations-program.md)),
sequence **F0 → F1 → F2 → Phase 16 → F3 → F-cleanup → pilot reset**:

- **F0 — Design Gate: ✅ COMPLETE** (signed off 2026-07-10; ADR
  [0065](../decisions/0065-pre-pilot-foundations-conventions.md); commit `ea06bf4`).
- **F1 — Case-Participants E0: ✅ COMPLETE & human-approved 2026-07-10.** Full §6 gate passed.
  Detail → [f1-case-participants.md](f1-case-participants.md). Commits `ef66b0a` (build) +
  `6805bd9` (QA fix) + `24dc9e7` (`phase(F1): complete`). ADR 0064 (E0) + 0066 (xref re-key).
- **F2 — Centralized Attachments: ◀ NEXT (not started).** ADR
  [0063](../decisions/0063-centralized-attachments-substrate.md).

## Immediate next action (resume here)

**Re-spawn the F2 contract-first design task.** A `backend` (opus) agent was spawned to author
the F2 migration contract (plan-in-text) but was **stopped mid-read** — no contract was produced,
nothing to salvage. Re-spawn it fresh. Scope for the F2 contract (backend authors, lead rules the
open questions — the F2 analog of F1's Q1–Q6, before any implementation):

- Polymorphic `attachments` core + `attachment_subjects` **re-keyed to the F1 `participants`
  registry** (ADR 0063 §C-β — the reason F1 preceded F2). Pick the polymorphism dialect per ADR 0065.
- Physically-tiered PHI buckets + a **hard audited PHI-read door** (service-role signed), mirroring
  F1's Class-1 pattern (DML REVOKED → atomic DEFINER writer → audited NULL-out-of-scope reads).
- **Carry the F1 MAJOR-1 lesson**: every RLS read/write policy `to authenticated` MUST be paired with
  a matching table `GRANT`, and the pgTAP plan must include a grant+policy-as-`authenticated` assertion
  (an RLS policy without a grant is an inert boundary — that was F1's blocking finding).
- Disposal: attachment purge (D10 arm) composes AFTER the participant-keyed purge in the generalized
  `dispose_case_phi` (ADR 0065 §C-δ).
- Fold in existing case/meeting/interview docs + new action-item attachments; reserve form-item uploads
  as a **design-only ingress contract** (inert — consistent with F0 §C-ζ `form_upload` stays inert).
- Flag behind a feature flag, seeded **OFF** if there's any real ingress (pre-pilot).
- HC SQLSTATE high-water is **HC095** (F1 used HC094/HC095) → allocate **HC096+**.

Then: lead reviews the contract → backend builds → §6 gate (tester E2E → QA → human → Record).

## Standing constraints & gotchas (carry-forward)

- **Remote Supabase DB is NOT migrated.** All F1 (and F0) migrations are **local-only** — the git
  branch is pushed to origin, but `supabase db push` / `db reset --linked` was **not** run. This is
  intentional: pre-pilot, reset-OK, remote deploy deferred to the pilot cutover. Do not deploy to the
  remote DB without explicit per-wave user authorization.
- **Flags `case_participants` / `case_types` are seeded OFF** — the **m2 hard gate**. Never flip them
  on real ethics data until post-pilot E1/E2. E1 (access spine) + E2 (ethics procedure) are deferred
  post-pilot.
- **E2E gate harness**: the full Playwright suite against `npm run dev` under `--workers=1` for ~1h is
  **flaky** (150s cold-compile stalls, `uncaughtException: aborted`, login `waitForURL` timeouts) — NOT
  rate-limiting (`config.toml` limits are already maxed). The authoritative phase-gate signal is the
  **phase's own specs run short + isolated** (fresh reset) + pgTAP; classify scattered infra-signature
  reds in untouched domains as env-only. See memory `e2e-gate-run-mechanics`. Durable fix (post-pilot):
  prod-standalone harness (`node .next/standalone/server.js` — NOT `next start`, which is incompatible
  with `output:standalone` and silently breaks server actions).
- **graphify**: run `graphify query "<q>"` before reading/grepping source (subagents too); `graphify
  update .` after code changes.
- **File ownership**: `backend` owns migrations / seed / `src/lib/{supabase,queries,types,cases}` /
  middleware / server routes; `tester` owns `e2e/`; never cross. Contract-first for build phases.
- **Every new `public.*` RPC**: `REVOKE ALL … FROM PUBLIC` before `GRANT` (t19 pgTAP guard).

## This session's git (branch `feat/pre-pilot-foundations-plan`, pushed to origin)

`ef66b0a` F1 build · `6805bd9` F1 QA fix · `24dc9e7` `phase(F1): complete` · graphify refreshes
`764a792`/`8800a36` · plus housekeeping (agent tier bumps, docs/design reorg) and this handoff.

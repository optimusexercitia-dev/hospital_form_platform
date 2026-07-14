# Session Handoff — Pre-Pilot Release Scope Expansion (ADR 0071)

**Last updated:** 2026-07-14 · **Branch:** `pre-pilot-release-s0` (pushed to origin) · **Author:** lead session.
**Read this first when resuming.** It's the current-state pointer; the authoritative status is
[PROGRESS.md](../../PROGRESS.md), the settled spine is
[pre-pilot-release-s0-ratification.md](../plans/pre-pilot-release-s0-ratification.md), and the sequenced plan is
[pre-pilot-release-scope-expansion.md](../plans/pre-pilot-release-scope-expansion.md).

## Where we are

Building the 12-initiative pre-pilot release (ADR 0071) in stages **S0→S5**. All work is **local-first, reset-OK,
dark behind flags**; **remote deploy + the pilot DB reset are deferred to the end** (user-authorized).

- **S0** design gate — ✅ signed off.
- **S1 substrate** (MEM · SUP · N) — ✅ complete → [s1-substrate.md](s1-substrate.md).
- **S2 pilot cores** — ✅ **ALL COMPLETE 2026-07-14.** PO build order = **IV2 → RV2 → AI**.
  - **IV2** (Interviews v2 sessions) — ✅ **complete + human-approved** (`phase(11-v2)`) → [iv2-interviews.md](iv2-interviews.md).
  - **RV2·R1** (Referrals v2 dialogue core) — ✅ **complete + human-approved** (`phase(rv2-r1)`) → [rv2-r1-referrals.md](rv2-r1-referrals.md). (R2–R5 governance = S4.)
  - **AI** (action-items satellites + cross-link UI **+ BE-6·N reminder→N scan arm**, PO-directed in-phase) — ✅ **complete + human-approved** (`phase(ai)`) → [ai-satellites.md](ai-satellites.md).
- **S3** ETH·E1 (access spine — releases the m2 flag gate; needs IV2 ✅ + MEM ✅ done) — 🔜 **NEXT** · **S4** ETH·E2 + RV2·R2–R5 + CH · **S5** ETH·E3a. Only Phases 18–19 stay post-pilot.
- **Pre-pilot follow-up (PO-directed 2026-07-14):** **BUG-AIF-001 / FUP-AI-1** — the platform-wide `router.refresh()`-in-`startTransition` deferred-flush stall (freezes a section's controls until reload; data always persists) — is scheduled **before pilot** as its own workstream (surfaced by the AI satellite panels but not AI-introduced; `useSatelliteAction` mirrors incumbent `useCaseAction`/`useMeetingAction`).

## ▶ Resume here: open S3 — ETH·E1 access-spine

**S2 is done.** Next is **S3 = ETH·E1** (Ethics access-spine — releases the F1 `case_participants`/`case_types`
**m2 flag gate** so ethics case data can go live). Both hard-ordering prereqs are satisfied: **MEM ✅** (memberships
collapse, S1) and **IV2 ✅** (E1 folds in IV2's inert `confidentiality_level`/`relationship_to_case` columns).

**On opening E1, first research its spec** (don't build from memory): the settled spine is
[s0-ratification.md](../plans/pre-pilot-release-s0-ratification.md) (§ Ethics E1/E2 decisions) and the sequenced
plan [pre-pilot-release-scope-expansion.md](../plans/pre-pilot-release-scope-expansion.md) (S3 section); the E1 ADR
authored at S0 lives under `docs/decisions/` (grep for the Ethics/E1 ADR). Confirm the SQLSTATE block, flag name,
and migration high-water (**current = `20260720000970`**, next = `20260720000980+`) before spawning backend.

Run the track with the same orchestration pattern below (contract-first backend → frontend → tester → lead-run
`e2e:prod` → qa → human approval → Record).

## How to run the track (the pattern that's worked all of S1 + S2)

The lead is the orchestrator — **does not write feature code**; spawns teammates (warm across the session):
1. **backend** (`backend-engineer`): contract-first. For a migration/RLS/novel track, have it **orient via graphify,
   post a concrete migration+RLS+RPC plan, and STOP for lead ack** before applying. Then build I/R-steps → post the
   **frozen typed contract** + a **frontend punch list**. Local-first only (`supabase migration up`, regen types
   `--local`); **never `db push`**.
2. **frontend** (`frontend-engineer`): build UI against the frozen contract; **invoke the `frontend-design` skill**
   before new screens; verify whole-project `tsc`/`lint`/`next build` green + a dev-server smoke test (its runtime
   verification has caught two real backend bugs pgTAP couldn't — keep it).
3. **tester** (`qa-tester`): extend the phase spec, run chromium (prod-standalone recipe), file bugs. Never edits app code.
4. **Lead runs the full `e2e:prod`** gate (subagents can't — 18-40min). Triage reds against the flaky baseline.
5. **qa** (`qa-reviewer`): writes `docs/reviews/…`; APPROVED/CHANGES.
6. **Human approval** → **Record** (rotate detail to `docs/progress/`, update PROGRESS + `docs/backend-state.md`,
   commit `phase(...): complete`, `graphify update .`).

## ⚠ Caveats / gotchas for the resuming session

- **Local test stack is degraded** — after ~40 `supabase db reset`s this session, `e2e:prod` began hitting
  intermittent **`reset FAILED`** (batches silently don't run). **Before the next `e2e:prod`, run `supabase stop &&
  supabase start`** (and/or `supabase db reset` manually once) to get a clean stack. Not a code issue.
- **`e2e:prod` on Windows** always has a stochastic per-run **flaky/contamination baseline** (~a few reds: form-builder
  `answer-model-v2`/`builder-dialog-ui` stragglers, `ui-batch-2026-07` cross-spec contamination, occasional batch
  env-collapse). **Triage vs isolation** (`SPECS="..." RETRIES=0 npm run e2e:prod`), don't gate on zero — see
  [[e2e-prod-build-flaky-baseline]]. `BATCH_SIZE=4` reduces collapse.
- **[[case-referral-column-grants]]** — `case_referral` has NO table-level authenticated SELECT; every new column
  needs its own `GRANT SELECT (col) … TO authenticated` or the hub 42501s (bit us in RV2·R1). pgTAP now guards it.
- **Audit convention** — mutations via `app.audit_write`; the `log_audit_access` allow-list is for **reads** only
  (S0 §D). Two plans (IV2, RV2) had imprecise wording routing mutation verbs to the read-door — don't.
- **RLS helper** — use `is_commission_admin_of` (ADR 0051); the old `is_org_admin_of_commission` was dropped →
  referencing it fails `db reset` ([[rls-helper-is-commission-admin-of]]).
- **`graphify-first`** is mandatory before grepping source (hook-enforced), for lead + every teammate.

## Remaining to the pilot (after S2)
S3 (ETH·E1) → S4 (ETH·E2 · RV2·R2–R5 · CH) → S5 (ETH·E3a; E3b needs deferred Phase 16) → then the **Coolify app
deploy** + a final **pilot DB reset** (folds all local migrations to remote) + Phase 9. Phases 18–19 stay post-pilot.

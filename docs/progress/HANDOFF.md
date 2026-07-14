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
- **S2 pilot cores** — 🏗️ in progress. PO build order = **IV2 → RV2 → AI**.
  - **IV2** (Interviews v2 sessions) — ✅ **complete + human-approved** (`phase(11-v2)`) → [iv2-interviews.md](iv2-interviews.md).
  - **RV2·R1** (Referrals v2 dialogue core) — ✅ **complete + human-approved** (`phase(rv2-r1)`) → [rv2-r1-referrals.md](rv2-r1-referrals.md). (R2–R5 governance = S4.)
  - **AI** (action-items satellites + cross-link UI) — 🔜 **NEXT — not started.** This is the last S2 track.
- **S3** ETH·E1 (access spine — releases the m2 flag gate; needs IV2 ✅ + MEM ✅ done) · **S4** ETH·E2 + RV2·R2–R5 + CH · **S5** ETH·E3a. Only Phases 18–19 stay post-pilot.

## ▶ Resume here: open the AI track (last S2 track)

**Spec:** [action-items-satellites.md](../plans/action-items-satellites.md) · ADR
[0050](../decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md) · SQLSTATE **`HC0I0–HC0I9`** ·
flags `action_items` + `cases_extras` (both exist, ON). Migration window **`20260720000950+`** (current
high-water = `20260720000940`).

Two slices, one phase (they share `action-items-table.tsx` / `case-action-item-form.tsx` — one owner window):
- **AI·sat** (spoke tables, PO-locked minimal set): **reminders** (pairs with N as a scan arm) · **updates-feed**
  (`action_item_updates`) · **checklists** (`action_item_checklists`). Each = new table (FK `action_item_id`
  CASCADE) + RLS **reusing `can_read_action_item` verbatim** (no new shape) + DEFINER `committee_*` RPCs +
  `action_item.*` audit. **Write authority = stakeholders-only** (assignee / active assignment / `staff_admin`) —
  PO-locked (S0 §J). CAPA stays isolated (not a satellite).
- **AI·ui** (mostly FE over shipped backend): surface the existing `visibility_scope` (`committee`/`case_restricted`/
  `assignees_only`) + `case_id` cross-link + coordinator `p_visibility_scope` override in
  `case-action-item-form.tsx` / `action-items-table.tsx` / `meetings/action-item-form.tsx`; project
  `visibility_scope` in `queries/action-items.ts` + `case-action-items.ts`. **No new RLS** — `can_read_action_item`
  + the default-restrict guard already exist.
- **S0-flagged open decisions to resolve at AI R0** (S0 §I AI): **O-1** `can_read_case(null,uid)` must be
  **fail-closed** (a `case_restricted` item with no `case_id` must be invisible — security-verify + pgTAP-lock
  before the visibility toggle ships); O-3 reminder-recipient case-read gap (defer to N+AI·sat jointly); O-4 cosmetic.

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

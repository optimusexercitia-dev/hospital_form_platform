# E2E gating on a prod standalone build

**Status:** Recommendation · **Date:** 2026-07-11 · **Author:** lead session (form-builder
E2E spec-refresh task).
**Trigger:** running the full Playwright suite against a **prod standalone build** during
BUG-AIF-001 gate work surfaced (a) stale form-builder specs and (b) a latent app
regression — both invisible to the routine `next dev` gate.

This doc is the concrete operational companion to
[pre-pilot-foundations-program.md §7](../plans/pre-pilot-foundations-program.md) and ADR
[0057]. It does not change the plan; it makes the plan's already-stated prod-build E2E
discipline reproducible and explains *why dev-only gating is not sufficient*.

## TL;DR

`playwright.config.ts` boots `next dev` (`webServer: 'npm run dev'`,
`reuseExistingServer: !CI`). The routine green-bar therefore runs against the **dev**
compiler. Two independent classes of failure are structurally invisible that way, and
both bit us on 2026-07-11:

1. **Coverage drift** — specs that aren't in the routine run silently rot. The
   `ConditionBuilder`/FBE refactor renamed a checkbox (`Exibir somente sob condições` →
   context-dependent `Visibilidade condicional` / `Aparência Condicional`); 10 selectors
   across 5 builder specs broke. *(This class fails on dev too — it just wasn't being
   run.)*
2. **Prod-only behaviour** — some failures reproduce **only** on a prod build:
   - BUG-AIF-001 (App-Router `loading.tsx` + action→`router.refresh` deferred-flush
     stall on 16.2.9) — publish/refresh transitions intermittently hang.
   - The `client-import-server-query-module-breaks-build` and
     `rsc-server-fn-prop-client-crash` traps — green on `dev`/`tsc`/`vitest`, they
     **abort `next build`** or crash RSC at runtime on standalone prod.

   A dev-only gate cannot see any of these.

Separately, the prod run surfaced a real, **build-mode-independent** regression
(`answer-model-v2` DV-2 → BUG-AMV2-002, choice-default publish rejected `valor padrão
inválido`, fails identically on dev *and* prod). That one isn't prod-specific — it was
simply never being run. Both stories point to the same fix: **run the whole suite on a
prod build, periodically, and treat the result seriously.**

## The recipe (what actually works here)

The app is `output: 'standalone'` (`next.config`), so `next start` is wrong — it crashes
mid-run (memory `e2e-standalone-server-not-next-start`). Pre-start the prod server on
:3000 yourself; Playwright's `reuseExistingServer` (when `CI` is unset) then reuses it
instead of booting `next dev`:

```bash
# 1. Build (auto-loads .env.local → local Supabase URL baked into the client bundle)
npm run build

# 2. Standalone doesn't include static assets or /public — copy them in
cp -r .next/static  .next/standalone/.next/static
cp -r public        .next/standalone/public
#   (in a git worktree, server.js nests under .next/standalone/<worktree-path>/)

# 3. Inject env + start the prod server on :3000 (HOSTNAME=0.0.0.0 so localhost resolves)
set -a; . ./.env.local; set +a
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js &

# 4. Point Playwright at it (unset CI keeps reuseExistingServer=true, retries=0)
unset CI
npx playwright test --project=chromium --workers=1
```

Prereqs: local Supabase up + seeded (`supabase status`; the specs use the seed personas);
`.env.local` points at `127.0.0.1:54321`. Run the **whole** command tree as ONE process
(server `&` + specs + teardown) so the server survives; the lead runs it as a background
command (memory `subagent-cannot-run-full-e2e`, `e2e-foreground-run-recipe`).

## The batched gate runner — `npm run e2e:prod` (server restart per batch)

The single-server monolith run collapses (see TL;DR): after ~580 tests the standalone
server on Windows starts refusing connections (`net::ERR_CONNECTION_REFUSED` cascade, ~20 min
in). [`scripts/e2e-prod-gate.sh`](../../scripts/e2e-prod-gate.sh) (aliased `npm run e2e:prod`)
defeats this by splitting the suite into **batches** and starting a **fresh server — and, by
default, a fresh seeded DB — for each batch**, so no single server runs long enough to
accumulate the backlog and no cross-spec seed contamination carries over. It builds the
standalone once, then per batch pre-starts `node .next/standalone/server.js` and lets
`reuseExistingServer` (CI unset) reuse it, waiting on both Next `/login` **and** GoTrue
`/auth/v1/health` (the container restarts on reset; skipping this flakes the first logins).

```bash
npm run e2e:prod                 # full suite, batched (default 6 specs/batch, fresh DB+server each)
BATCH_SIZE=4 npm run e2e:prod    # smaller batches → more restarts (use if a batch still collapses)
RESET=0      npm run e2e:prod    # server-restart ONLY, keep the DB (faster; contamination may reappear)
REBUILD=1    npm run e2e:prod    # force a fresh `next build` (otherwise auto-detects source drift)
RETRIES=0    npm run e2e:prod    # stricter: no per-test retry
SPECS="e2e/phase8-dashboard.spec.ts e2e/phi-remediation.spec.ts" npm run e2e:prod   # gate a subset
```

Requires bash (Git Bash on Windows; run `bash scripts/e2e-prod-gate.sh` directly if `npm run`
can't find bash) + local Supabase up/seeded. The **server restart between batches** is the
resource-buildup fix; the per-batch `db reset` (default on) is the orthogonal contamination
fix — set `RESET=0` for just the server-restart behavior. Each batch's Playwright output lands
in `$TMPDIR/e2e-prod-gate/batch-N.log`; the run prints an aggregate `GATE GREEN/RED` and exits
non-zero on any hard failure. Smoke-tested 2026-07-12 (2 batches, fresh server each → 21/21).

## Recommendations

1. **✅ DONE (2026-07-12) — `npm run e2e:prod`** ([`scripts/e2e-prod-gate.sh`](../../scripts/e2e-prod-gate.sh))
   wraps the recipe (build → stage → per-batch serve → `playwright test`) **and restarts the
   server per batch** to defeat the monolith collapse — see the section above. Make the
   phase-gate "declare green" step use it, not `next dev`.
2. **Run the FULL suite on the prod build periodically** — nightly, or as a required
   check before merging to `main` — not per-commit (a prod build + 20–40 min suite is too
   slow for every push). Per-commit stays on `dev` for speed; the periodic prod run is
   what catches drift *between* phase gates.
3. **Triage against the flaky baseline, don't gate on zero.** The prod gate has ~18–27
   known-flaky failures (memory `e2e-prod-build-flaky-baseline`); diff each run against a
   baseline before calling regression.
4. **De-serialize independent tests, and treat "did not run" as a failure.** In this run
   one deterministic failure (`answer-model-v2` DV-2) silently skipped **4** downstream
   tests via `test.describe.configure({ mode: 'serial' })` — they reported as "did not
   run", not failures, so a real gap hid behind a green-ish summary. The `DV-n` tests each
   build their own form (unique `Date.now()` title) and don't share state, so serial mode
   buys nothing here but the masking. Reserve serial mode for genuinely stateful chains,
   and have the gate flag any non-zero "did not run" count for investigation.
5. **Require a real `next build` in the green bar**, per the standing traps (memory
   `client-import-server-query-module-breaks-build`, `rsc-server-fn-prop-client-crash`):
   `tsc`/`vitest`/`dev` passing is not sufficient evidence a change ships.

## Worked example — the 2026-07-11 run

- 5 builder specs, 35 tests, prod standalone build (`next@16.2.9`), `--workers=1`:
  **30 passed / 1 failed / 4 did not run.**
- The 10 renamed-label assertions all pass after the fix (9 in the run + `DV-3` confirmed
  in isolation). Committed as `test(e2e): retarget form-builder condition toggle to
  renamed labels`.
- The 1 failure (`DV-2`) is **not** a stale selector — it's BUG-AMV2-002 regressed
  (choice-default publish rejected). Left untouched (the spec is correctly catching a real
  bug) and flagged for the owning engineers.

## References

- Plan: [pre-pilot-foundations-program.md §7](../plans/pre-pilot-foundations-program.md)
- Memories: `e2e-gate-prod-build`, `e2e-standalone-server-not-next-start`,
  `e2e-prod-build-flaky-baseline`, `e2e-foreground-run-recipe`, `subagent-cannot-run-full-e2e`,
  `case-dialog-prod-refresh-layout-revalidate` (BUG-AIF-001),
  `choice-default-publish-regression` (BUG-AMV2-002).

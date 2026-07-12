# 0067 — Lint gate scope & policy (restore a meaningful `npm run lint`)

**Date:** 2026-07-12 · **Status:** accepted. **Owner:** platform lead. **Scope:** tooling
hygiene only — no application-code or schema change; isolated on `chore/lint-gate-restore`.

## Context

`npm run lint` had silently drifted into noise: `eslint .` reported
**99,554 problems (6,224 errors / 93,330 warnings)**, which masked all real signal and
contradicted the "eslint 0" claims recorded in past phase gates (e.g. administrativo,
2026-07-08).

Root cause (git-blame confirmed):

- `"lint": "eslint"` (bare, whole-tree) has existed since **Phase 0** — it was never a
  scoped `next lint`. The flat config (`eslint.config.mjs`) ignores only Next build dirs
  and Playwright outputs.
- The Agent-Teams workflow later created **`.claude/worktrees/`** (~5.9 GB): transient git
  worktrees, each a full repo checkout **with its own `.next/` build output**. The
  root-anchored `.next/**` ignore does not reach `.claude/worktrees/<id>/.next/`, so eslint
  lints compiled/minified bundles there — **~99.9%** of the reported problems
  (`no-unused-expressions` ×79k, `no-require-imports`, `no-this-alias`, …).
- Actual first-party source was already clean: `src/` **0/0**; `e2e/` had 0 errors and 39
  `no-unused-vars` warnings (dead persona-ID consts, unused helpers, a few captured-but-
  unused locals); one `src` test file had 5 `_args` false positives.
- `eslint-config-next@16.2.9` was version-skewed from `next@16.3.0-preview.5`.

## Decision

1. **Ignore `.claude/**`** in the flat config. It is Claude Code tooling (agents, skills,
   settings, worktrees) — never application source. Analogous to `node_modules/`.
2. **Keep `src/`, `e2e/`, and `*.test.*` in scope.** Test/spec code is first-party and was
   effectively clean; linting it catches real mistakes (forgotten imports, captured-but-
   unasserted values). No blanket relaxation for test files.
3. **Honor the `^_` prefix** for intentionally-unused bindings
   (`{args,vars,caughtErrors}IgnorePattern: "^_"`) — already an in-repo convention
   (`_args`). This is the sanctioned escape hatch; it fixed the 5 false positives.
4. **Burn down the 39 real `e2e` warnings** by removing eslint-verified dead code (dead
   consts / helper functions / locators; write-only vars). Side-effecting `await` captures
   kept their call, dropped only the unused binding.
5. **Enforce zero:** `npm run lint` = `eslint --max-warnings=0`. **0 errors AND 0 warnings**
   is the gate; a single new warning now fails it, preventing silent re-drift.
6. **Reconcile the skew:** pin `eslint-config-next` to `16.3.0-preview.5` (exact match to
   `next`; verified `src/` stays 0/0 and tsc clean under it). Keep the two matched going
   forward.

## Consequences

- `npm run lint` → **0/0, exit 0**; `tsc --noEmit` clean. The gate is meaningful again and
  self-guarding via `--max-warnings=0`.
- `.claude/` is permanently outside the lint scope; new skills/plugins/worktrees add no noise.
- Removing the dead `e2e` bindings surfaced several **incomplete-test smells** worth a
  follow-up (not fixed here — behavior was preserved): the Mailpit invite-email verification
  helper (`waitForMailpitMessage`) in `phase3-admin-members` is now entirely unused; the
  patient-panel-visible locators in `patient-index` (`panelSection`) and `phase22-referrals`
  (`panelRegion`) were set up but never asserted; and `recommend-result` carried module-level
  setup for an "override re-flip test" that does not exist.
- CLAUDE.md §8 updated to state the gate scope and policy.

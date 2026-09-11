---
expires: 2026-09-24
task: pre-AE5 remediation — successors of Batch 10 (no unit open; the PO names the next)
created: 2026-09-10
updated: 2026-09-10
status: live
---

# Handoff — after pre-AE5 Batch 10 (`ADMIN-ARM-IS-ACTIVE`), before the next unit

## ▶ RESUME HERE
Nothing is mid-flight. Batch 10 was opened, built, gated, QA-approved, PO-approved and
fast-forwarded to local `main` on 2026-09-10; the branch is deleted. The pre-AE5 programme is
exhausted by its own plan and three successors are named there, none started; the PO names which.
The single next action is to measure the tree (command below), then read
`docs/plans/pre-ae5-remediation.md` §6 *Where the next session starts* and ask the PO to name
one of: **ADR 0202** (F7 · F8 · `platform_role`; docs-only; before AE5 increment 2), **ADR 0204**
(the `D` ceiling · the `search_path=''` convention; docs-only; both censuses already in the two
follow-up bodies; no ordering constraint), or unit **`AE5-MATRIX-ARM3-CELLS`** (hub exists,
`planned`; enumeration + generated vectors + a full authz sweep at the tip; before increment 1
runs its matrix). ⛔ AE5 itself stays post-pilot (ADR 0155 G1). ⛔ ADR numbers 0202 and 0204 are
reserved; for any other subject take *highest on any live branch + 1*, re-measured.

## Trust
- **Verified, in the tree:** everything Batch 10 claims is witnessed in
  `docs/progress/admin-arm-is-active.md` § Session log (entries dated 2026-09-10, the last one
  *"E2E loop closed"*, then the cut-in *Current state at close* block). Gate figures live there
  and in the ledger row; do not copy them.
- **Not verifiable by a session, stated as such in the record:** Coolify's Automatic-Deployment
  state (why `main` is NOT pushed — the standing instruction; a push is a PO decision and needs
  the changed basis stated again); the PostgREST HTTP hop for the Class-2 denial (asserted from
  ACL + `prosecdef` + the door's own 42501, never over HTTP).
- **Written this session and only lint-checked, not re-read cold:** the three new follow-ups at
  the end of `docs/followups/follow-ups-open.md` (`FUP-ADMIN-ARM-IS-ACTIVE-…`), LEARN-100/101/102,
  the authz seam's Batch 10 slice + its `## Current state` R6 line
  (`docs/backend-state/authorization-and-audit.md`), the three dated notes in ADR 0201 (D2, D4, D5).
- **Per-clone trap:** `.claude/claude-md-review-queue.md` is gitignored. It was processed and
  cleared on THIS clone at Batch 10's open; the Stop hook will have appended this session's own
  entries by the time you read this. `wc -c` it; another clone's state says nothing about it.
- **Unpushed distance** was ~26 commits at close — re-measure, never quote.

## Tree
Branch `main`, HEAD at or after `37f3b3bd` (`ef2625f2` = the phase commit; `37f3b3bd` = the merge
sha recorded in plan §2 row 10 and the ledger). Expected clean. No worktrees. No unit branch.

## Next command
```bash
git status --short && git log --oneline -3 && git rev-list --count origin/main..main && grep -n "in progress" docs/features/INDEX.md | head -2 && sed -n '/^## 6\. Where the next session starts/,$p' docs/plans/pre-ae5-remediation.md | head -80
```

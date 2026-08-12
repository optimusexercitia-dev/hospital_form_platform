# AUDIT-INVOKER-WRAPPER + BUG-REFNOTE-001 — completion record

Rotated out of PROGRESS.md 2026-08-12. Branch `authz-wrapper-refnote` →
`297d3e2` (REFNOTE) · `f22ddab` (ARM 5) · `a8d457c` (gate record).

Authorities live elsewhere and are not duplicated here: ADR
[0113](../decisions/0113-referral-door-return-shape.md) (REFNOTE), ADR
[0079](../decisions/0079-authz-door-blindness-standing-invariant.md) **Amendment 7**
(ARM 5), the sweep report
[authz-invoker-audit-findings.md](../reviews/authz-invoker-audit-findings.md), and the
two harness headers. This file holds only what exists in none of them.

## 1. The disposition, and why it is not 47 keystones

The first sweep returned **47 BLIND** of 88. Reading that as 47 holes would have been
wrong, and the triage is the reusable part:

> **For an INVOKER wrapper the write still runs under RLS.** So the question is never
> "does a keystone notice the gate opening" alone — it is "does the target table's write
> policy already carry the same predicate". Where it does, the wrapper is defence in
> depth, a green suite is CORRECT, and forcing a keystone asserts on a redundant layer.

Final: **41 BLIND allowlisted with per-family RLS proof · 11 COVERED · 34 UNSUPPORTED to
the census backlog · 2 ERROR hand-triaged.**

⚠ **The triage must resolve `app.assert_*` bodies, not read wrapper text.** Family B
(meeting children) looked like "RLS DIFFERS" on a first pass purely because the wrapper
says `app.assert_meeting_staff_admin` while the policy says
`app.is_staff_admin_of(app.commission_of_meeting(meeting_id))` — the same predicate one
level deeper. A triage that compares surface text mis-files a whole family.

## 2. The one real leak, and the persona that finds it

The meeting **verbs** (`cancel` / `distribute` / `update_minutes` / `set_quorum_met`, and
`update_meeting`) gate on `is_staff_admin_of`, while `meetings` RLS *also* admits
`member_can(c,'schedule_meetings')`. The wrapper is **stricter than the policy behind
it**, so it is the sole boundary — and only one persona reveals that: an ADR-0061
delegate. `staff2.ccih@test.local` (plain `staff` + `schedule_meetings`) went from `42501`
to **successfully cancelling a meeting** with the gate opened. Keystoned by
[327_invoker_wrapper_meeting_authority.sql](../../supabase/tests/327_invoker_wrapper_meeting_authority.sql).

**Generalization:** a wrapper stricter than its RLS policy is invisible to every
same-tier test. The persona that exposes it is the one the two layers *disagree* about —
here, a delegated capability holder. When a gate and its policy differ, enumerate the
personas in the gap, not the ones on either side.

## 3. Run history (four passes) and what went wrong in the harness

Pass detail is in the findings report's header. The two defects are in the sweep's own
header. What is recorded nowhere else is that **both were found by hand-checking the
sweep's output against functions whose answer was already known** — not by any gate, and
not by the sweep self-testing. `DRYRUN=1` exists so that check is cheap; it is the reason
the inherited-regex error was caught before a single verdict was trusted.

⚠ Pass 1 left `public.update_meeting` **neutralized in the shared local stack** until a
`db reset`. Anyone running these sweeps should know that is possible; the rollback-point
guard added afterwards is what makes it not possible again.

## 4. Gate

pgTAP **188 files / 5906 tests** · typecheck 0 · vitest 1254 · five lint gates ·
`ARM=census` (540 live gates, up from 452) / `hat` / `floor` / `wrapper` all HOLD ·
`e2e:prod` 1046 passed / 0 failed with batch 4 stranded by `server_dead`, re-run
standalone to 67/67, 68/68 accounted, GREEN.

⚠ **No diff-scoped `ARM=policy` was owed**, and this was verified rather than assumed: the
23 rebuilt REFNOTE doors are `prosecdef` but **neither set-returning nor boolean**, so they
fall in no sweep's worklist — checked against all three worklist queries. No RLS policy and
no boolean gate was touched by either commit.

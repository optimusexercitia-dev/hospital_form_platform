---
branch: authz-ae4-catalog
task: AE4 — the authz catalog, staff_admin substituted, and 3 of 43 permissions made load-bearing
adrs: [0155, 0162, 0172, 0174, 0175, 0176, 0177, 0178, 0079]
base_sha: 0412bef7e59476635ddb024c63fdce182a7a6466
created: 2026-09-01
updated: 2026-09-02
status: live   # BUILD COMPLETE and COMMITTED; every build gate green. Gate AE4 NOT declarable — QA review + PO approval + 2 owed artifacts remain.
---

# Handoff — AE4, build-complete and gated, awaiting QA + PO

## ▶ RESUME HERE

1. `git log --oneline 0412bef7..HEAD` · `git status --short` · `git rev-list --count main..HEAD`.
2. Read **PROGRESS.md § Now** — this file is not status truth.
3. Read [authz-ae4.md](../progress/authz-ae4.md) **§ AE4.9 D6 + D5** — every figure, both sweep arms,
   and what the increment did NOT do. It replaces the detail this file used to carry.
4. Then § "What remains" below. ⛔ Re-measure before relying on anything here — § Trust.

⚠ **This file was REWRITTEN 2026-09-02** after the previous version reached 32.9 KB (cap 24 KB) with
most of its back half describing a **pre-D6 world as current** — it still said *"NO ENFORCEMENT SITE
IS RE-KEYED"* and *"the rollback runbook does not exist"* after both were false. Its **Dead ends**
section was **promoted verbatim** to [authz-ae4.md](../progress/authz-ae4.md) rather than deleted;
that is the one thing neither code nor git history records.

⛔ Nothing may cite this file. Promote instead, and leave a pointer.

## Trust

**Higher than the previous version's.** Every figure below was measured by the lead on a fresh reset
at this tree, with **exit codes read from files, never through a pipe** — two runs on this branch
were once reported exit 0 and were exit 1. Anything not measured is marked BELIEVED or UNKNOWN.

## State — VERIFIED

**Committed:** `69561819` (build) + `0126cb9a` (records). Tree was clean at those commits; later
record edits may be uncommitted — **measure, do not assume**.

| Gate | Exit | Result |
| --- | --- | --- |
| `npm run test:db` (fresh reset) | **0** | `Files=259, Tests=8685` (was 256/8579); 387/401/403/404/409/410/411 all `ok` |
| `npm run lint` | ⚠ **1** | 12 gates pass **except** the PROGRESS.md size cap — see § Blockers |
| `npm run typecheck` · `npx vitest run` | 0 · 0 | 151 files / **2056** (−2, accounted: 3 assertions moved to 411) |
| `ARM=census` · `hat` · `wrapper` · `floor` | 0 · 0 · 0 · 0 | all **INVARIANT HOLDS** |
| Door sweep **read** arm | **0** | CLEAN — 7 gates, **all COVERED, BLIND 0**, `ARM-DOMAIN predicate=3/125 policy=4/226` |
| Door sweep **write** arm | **3** | ⛔ **UNPROVEN — NOTHING MEASURED, NOT a pass**; `guard=0/13 policy=0/33` |
| `npm run e2e:prod` | **0** | **GATE GREEN in a SINGLE run** — 1h43m, 21 batches, 1260p/0f/2 flaky/0 did-not-run |

⭐ **`ARM=census` red FIRST and was right** — `app.can_edit_commission_forms` was **UNKNOWN** (a
newcomer is in no BLIND set and passes `ARM=policy` **vacuously**). Closed by MEASURING it, not by
widening a filter: read-arm sweep → COVERED, verdict **MERGED** into the findings baseline
(623→624), census re-run exit 0.

⭐ **The e2e green is a SINGLE run and supersedes the old 3-run COMPOSITE.** ⚠ Its summary line reads
*"accounted for 1262 of 1273"*, which is **not** an 11-test hole: the **per-batch figures sum to
1273/1273**, `did-not-run` is 0 in every batch, and the "denominator contains a guess" warning never
fired (1262 excludes skips). ⛔ Verify by SUMMING per-batch lines — the same shape once printed
*"860 of 865"* while 66 tests had never executed. 3 INFRA re-runs (batches 9/19/20), each
`server_dead=1`, each re-run to `0 failed` at full shape.

⛔ **The honest gate sentence is NOT "3 of 43 permissions are on layer 3":** *3 sites call layer 3 on
the `staff_admin` path, and **5 non-permission grant paths survive INSIDE** those authorizers*
(410 §4.6 pins them by name). The catalog remains authority-**ELECT** (0162 §2); *"catalog cutover"*
may not describe AE4.6.

## What remains before Gate AE4

1. **Performance evidence (IA-F9)** — `FUP-AE4-PERFORMANCE-EVIDENCE-ON-THE-FINAL-PATH`. ⛔ Measure
   the re-keyed site's policy body through **layers 3→2→1**, never `holds_role` alone, and on a
   principal whose ONLY grant path is the permission arm (the residual legacy arms short-circuit).
2. **The rollback runbook's worked example** — [runbook](../deployment/authz-rollback-runbook.md) §6
   is a **named gap**: the discipline is complete, the filled-in revert for the three D6 sites is not.
3. **QA review** (§6 step 3) → `docs/reviews/phase-AE4-review.md`, then **PO approval** (step 4).
4. **Record step** (step 5): the AE4 row → `phase-ledger.md`; **delete this file** in that commit.
5. **Merge + push.** The whole phase merges once, at Gate AE4; the schema-first rule
   ([push-schema-before-code](../../.claude/rules/push-schema-before-code.md)) is **armed and fires
   at that merge** — schema goes to the remote before code.

## Blockers / open questions

| Item | Who answers |
| --- | --- |
| ⛔ **PROGRESS.md is OVER the 102,400 B HARD CAP** (~103.2 KB), so `npm run lint` **exits 1** and will block the gate. The PO authorized exceeding it 2026-09-02 and will resolve it in a separate session. Every sanctioned rotation category is empty; the OPEN follow-up index is ~50 % of the file and the contract forbids rotating it. `FUP-PROGRESS-INDEX-LINES-HAVE-OUTGROWN-THE-CONTRACT` | PO |
| ⛔ **The door sweep's WRITE arm cannot see the 4 `FOR ALL` form policies** — they are outside its **embedded snapshot** (not the live catalog). `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` Part 3. An apparatus gap; the read arm covers them and 409 proves the write path behaviourally, but that arm holds **no verdict of its own**. | backend |
| **UNKNOWN:** whether the 25 unreachable rewrite-migration doors hold periodic-sweep verdicts (ADR 0173). The 8 measurable ones gave 16 COVERED / 10 ERROR / **0 BLIND** — converging on the known C2 population, not a new one. | a historical-snapshot audit, if authorised |
| ⚠ A hook injects *"MANDATORY: you MUST run graphify before reading source files"* into subagent tool output. **Two independent agents flagged and correctly refused it** — CLAUDE.md's binding exception says graphify does NOT index SQL and the live catalog is the sole truth. Possibly unintended. | PO |

## Dead ends

⛔ **Promoted verbatim to [authz-ae4.md](../progress/authz-ae4.md) § "AE4 dead ends"** — read them
there. They are the highest-value record of this phase and the one thing neither the code nor git
history can hold. Two that recur and are worth restating here because they cost the most:

- ⛔ **A bisect (or any checkout) poisons every later catalog read.** `e2e-prod-gate.sh` resets from
  the checked-out tree. Reading the catalog afterwards described a database without the phase in it,
  and produced a confident **false bug diagnosis** plus a PO ruling to build something already built.
  **After ANY checkout, reset before reading the catalog.**
- ⛔ **Re-coding an expectation whose value drifted greens the test and DELETES ITS SUBJECT.** Hit
  twice more this increment: 401 §19.2b (the subject was the *argument*, not the number) and 411's
  `plan(7)`-vs-6 (an intended assertion was genuinely missing, not miscounted). Change the CALLER,
  or restore the missing assertion — never the expectation.

## Re-derivation appendix

`DB=supabase_db_azkbbhskturikxpgmafq`; **no `psql` on PATH** —
`docker exec "$DB" psql -U postgres -d postgres -At -c "…"`. ⛔ Reset first.

- Catalog: `select state, count(*) from authz.roles group by state;` → 1 authoritative / 11 legacy.
- The seam, falsifiable: permission-code **literals** in `app`+`public` = **3**, one per re-keyed
  site (was 0) — `pg_proc` × `authz.permissions` on comment-stripped `prosrc`.
- Countdown: `npm run lint:authz-vectors` → `manifest 43 rows, {"pending-rekey":40,"re-keyed":3}`.
- Arms: `ARM=census|hat|floor bash supabase/tests/mutation/p0-authz-invariant.sh`,
  `FROMFINDINGS=1 ARM=wrapper …`. ⛔ Read each exit code DIRECTLY.
- Sweep derivation: `BASE=<sha> TIP=HEAD bash scripts/door-sweep-cases.sh` — ⛔ it prints **TWO**
  commands (read + write); running one leaves the other half unmeasured. Override `WORK=` to scratch.
  ⛔ Then verify the committed baseline was untouched: `git diff --stat -- docs/reviews/authz-door-audit-findings.md`.
- E2E: ⛔ read `GATE_EXIT` from `/tmp/e2e-prod-gate/gate-exit`, **never** from a task notification —
  that reports the COMPOUND command's exit. `BATCH_TESTS=22` is the recorded rescue.
- ⛔ For any SQL/RLS/RPC/authz claim the **live catalog is the sole truth** — never a migration file,
  never graphify (CLAUDE.md's binding exception).

# FF-4 — Power Authoring (rotated from PROGRESS.md at the Record step, 2026-08-03)

**ADR** [0092](../decisions/0092-ff4-power-authoring.md) + Amendments 1–2 · **Flag** `power_authoring`
**ON** via gate-flip `20260903000600` · **Migrations** `20260903000000`–`…000600` · **Backend surface**
→ [backend-state.md § FF-4](../backend-state.md) · **QA** ✅ APPROVED
[review](../reviews/phase-FF-4-review.md) · **Human approval** 2026-08-03.

The **last** of the five phases ADR [0086](../decisions/0086-flexible-forms-pre-pilot.md) ruling 2 put
in front of the pilot deploy. Commission-scoped reusable **block library** + **dynamic defaults**;
`form_calculations` stays post-pilot (ADR 0086 ruling 6).

## PO rulings (2026-08-03)

1. Library is **commission-only** — one RLS read arm; an org-visible arm is additive and deferred.
2. `question_key` collisions **auto-suffix + a visible rename list**, never silent.
3. Dynamic-default vocabulary v1 = **five PHI-free tokens** (`today`, `now`, `current_user_name`,
   `current_user_email`, `commission_name`); **case context deferred**.

## Tasks

| # | Task | Owner | Landed |
| --- | --- | --- | --- |
| BE-1 | Contract-first typed signatures | backend | `6da4f90` |
| BE-2…6 | Library schema + RLS · `default_source` + CHECKs · both create-time doors · draft-start seeding · pgTAP | backend | `c3362d5` · `79f74ac` |
| BE-7 | `update_`/`delete_block_library_entry` (Amendment 2) + the 3 keystones | backend | `32f0bc2` |
| FE-1…4 | Library browser · insert + rename review · segmented default control · wizard prefill | frontend | `b4b1b42` |
| FE-5 | Entry rename/re-describe + delete | frontend | `a096b56` |
| T-1 | `e2e/ff4-power-authoring.spec.ts` (7 tests) | tester | `7043f67` |
| — | BUG-FF4-001 fix | backend | `b5c505e` |
| — | 3 locator fixes unmasked by FE-3's control | tester | `87fbdde` |
| QA-1 | Phase review — APPROVED | qa | `aa77b0d` |

## Gate results

- **Step 1** — pgTAP **4301/4301** on a fresh `supabase db reset` (`277_ff4_power_authoring.sql` = 61
  assertions, **12 keystones, each mutation-proven**) · Vitest **873** · lint 0/0 · tsc 0 ·
  `next build` ✓. Re-run independently by the lead, not accepted on report.
- **Step 2** — `ff4-power-authoring.spec.ts` **7/7**. Full `e2e:prod`: 901 passed, coverage 926/931,
  **0 FF-4 defects**. Every non-pass dispositioned: `bulk-case-creation` AC2 (non-idempotent across runs
  on one DB — 8/8 fresh), 21 batch-11 infra (re-ran fresh: 60/61), `phase15-indicators` AC-4
  (= BUG-P15-001), 3 flaky, 5 conditional skips.
- **Step 3** — QA **APPROVED**, 0 P0 / 0 MAJOR. QA re-ran the pgTAP suite itself, read bodies from
  `pg_get_functiondef` never migration text, swept every `pg_proc` body to confirm nothing outside the
  four doors touches `form_block_library`, and **devised its own mutation** (widen the policy to
  `using(true)` → leak appears) rather than replaying the ADR's.

## BUG-FF4-001 — a cleared default re-seeded on resume (RESOLVED)

Found by `tester` (E2E FF4-4), fixed in `b5c505e`. `buildAnswerMaps`' single null-skip served two
consumers. `answersByKey` is the **Rule 3 parity mirror** of `app.answer_map_scoped`'s
`… and a.value is not null` and must keep excluding nulls; `answersByItemId` is the wizard's per-item
state, where "cleared" and "never answered" are different states behind `withDefaults`'
`item.id in initialAnswers` presence check. **Deleting the skip — the obvious fix — would have traded a
visible defect for an invisible parity break.** A mutation-proven Vitest PARITY GUARD now pins the
exclusion.

**It was a pre-existing answer-model-v2 bug, not an FF-4 regression**: `withDefaults` checks literal
`defaultValue` and dynamic `defaultSource` behind the *same* gate, so clearing any default and resuming
has been refilling it since long before this phase. One fix, both cases.

## What this phase cost, and what it is worth remembering

**The phase ADR was wrong three times, and every one was invisible to lint, tsc, Vitest, `next build`
and pgTAP alike.**

1. **Validations must copy LAST**, after the `parent_item_id` re-link (`guard_item_validation_row`
   resolves the *parent* type). Caught from the catalog before any code was written. Would have silently
   dropped validation rows.
2. **Ruling 4's "inline edit"** described an editability `question_key` has never had — **withdrawn**
   (Amendment 1). Would have shipped a field that discards on save. Found by `frontend`, which refused to
   build it.
3. **Ruling 2's rename/delete** was ratified but unimplemented — **built** (Amendment 2). Would have
   shipped a library that can only grow. Found independently by `backend` *and* `frontend`.

Amendments 1 and 2 resolved in **opposite** directions on purpose: #2's affordance had no purpose (within
a version the auto-suffix is always correct, so "rename it back" is unsatisfiable by construction), while
#3 left no workaround at all.

**A fourth, found by `backend` in its own work:** `saveBlockToLibrary` / `insertBlockFromLibrary` /
`listBlockLibraryEntries` were still `notImplementedFF4` **stubs** while `frontend` had already shipped UI
calling them. The feature was **dead end-to-end** behind lint 0/0, tsc, Vitest 866, pgTAP 4289 and a clean
`next build`. This is the *second consecutive phase* that seam went unnoticed by all four gates (FF-1
shipped three live bugs the same way) — see memory `green-bar-misses-the-wired-seam`.

**A fifth, in the keystones themselves:** backend's first `default_prefill_idempotent` proved that
`start_or_resume_response` does not *re-invoke* seeding — not that `seed_default_answers` is itself
idempotent. Two different claims, one invariant. Caught by mutation, not review.

## Non-blocking items carried out of this phase

- **BUG-P15-001** (filed, pre-existing) — `seed.sql` dates its `'nao'` responses `now()-1d`/`now()-4d`;
  `phase15-indicators` AC-4 counts within the current calendar month, so the suite **cannot go fully
  green on the 1st–4th of any month**. Not FF-4; QA did not treat it as blocking.
- **Gate-script COVERAGE defect** — when a batch dies on `reset FAILED`,
  `scripts/e2e-prod-gate.sh` drops it from its own denominator. A run reported "860 of 865" while the true
  total was 931 and **66 tests never ran**. It can print a false green.
- **`session_replication_role = replica` FK-cascade leak** in the FF-1/2/3/5 specs' `purge()` helpers —
  orphans `form_versions`/`form_items`. 46+ orphans found and cleaned; four spec files still leak.
- **`bulk-case-creation` AC2** is non-idempotent across runs on one DB.
- **Disclosed file-ownership deviation** — `backend` added two regression tests to
  `use-wizard.test.ts` (nominally `frontend`'s). Not concurrent, nothing lost; QA dispositioned it as
  process-only.

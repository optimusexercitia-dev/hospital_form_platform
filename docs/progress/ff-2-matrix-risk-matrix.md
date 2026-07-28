# FF-2 — Matrix & Risk Matrix (ADR 0089) — phase record

**Status: ✅ COMPLETE 2026-07-27** · QA **APPROVED** (r2, after CHANGES REQUESTED at r1) ·
human-approved · flag `matrix_fields` **ON** (gate flip `20260830001200`).
Branch `ff/flexible-forms-program`, merged to `main`. **Remote `db push` NOT done** (local only,
as every S-phase — the remote deploy is user-gated).

**36 commits · 107 files · +17,611 / −250 · 16 migrations** (`20260830000000`–`20260830001500`).

**Final bar** — pgTAP **139 files / 4061 tests / PASS** from a clean reset · Vitest **593/593** ·
lint **0 errors 0 warnings** (eslint + the new `[--var]` guard) · `next build` ✅ ·
migrations **216 == 216** · full `e2e:prod` green for FF-2 (`ff2-matrix` 11/11,
`ff2-matrix-views` 5/5, `ff1-repeating-groups` 9/9, `phase5-wizard` 12/12, `phase6-signoffs` ✅).

**Reviews:** [r1 — CHANGES REQUESTED](../reviews/ff-2-review.md) ·
[r2 — APPROVED](../reviews/ff-2-review-r2.md).

> **Why this record is worth reading.** Thirteen defects were found during this phase and **not one**
> was caught by typecheck, lint, unit tests or `next build`; several survived code review because the
> broken code *reads* correct. The two costliest patterns are both documented below in situ:
> **a shipped writer with no caller** (BUG-FF2-001), and **a new door that did not inherit every arm
> its sibling carried** — which recurred **four times in one phase, in a different direction each
> time**. The door-parity rule and its `272_ff2_door_parity.sql` keystone came out of it.

---


### 🚦 FF-2 — Matrix & Risk Matrix · IN FLIGHT (started 2026-07-27)

Worktree `worktrees/ff/flexible-forms-program`, branch `ff/flexible-forms-program`, forked from
`main` at `b656ad4`. Flag `matrix_fields` — **not seeded yet** (FF-2 creates it, OFF).
**Migration window `20260830000000+`** (`20260829…` is ADR 0088's).

**✅ ADR [0089](docs/decisions/0089-ff2-matrix-risk-matrix.md) — accepted 2026-07-27.** Four PO
rulings settled the §3 FF-2 open questions:

1. **Cell contract = radio grid** — columns *are* the options; each row takes exactly one column,
   `value = 'true'::jsonb`. Enforced by a new `UNIQUE (answer_id, row_id)`. Typed cells stay
   reachable later as a constraint drop + config key (no answer-table migration).
2. **Risk score** — new nullable `weight numeric` on **both** axis tables;
   `risk_score = severity.weight * likelihood.weight`, derived server-side, never client-supplied;
   bands as ordered thresholds in `form_items.config.riskBands` (derived for display, not stored).
   ⚠ `form_item_options.risk_weight` is the *options* lane and is unrelated despite the name.
3. **`required` = every row answered** (row-complete), in the flat **and** per-instance loops.
   Item visibility still wins — hidden matrix requires nothing.
4. **Axis `code`s immutable** — relabel/reorder/add/remove yes, re-key never, via a `BEFORE UPDATE`
   trigger that does not consult version status.

**Live-catalog audit at phase start** (200/200 registered, max `20260829000100` = last file; read
from `pg_proc`/`pg_policies`/`pg_constraint`, never migration text) confirmed the plan's scope and
found **one hazard the plan does not record**:

> 🔴 **`app.instance_is_empty` is blind to the matrix tables** (ADR 0089 §A — NEW). It decides
> presence from `answers.value` and `answer_selected_options` only. A matrix answer's payload lives
> in `answer_matrix_cells`/`answer_risk_matrix` with `answers.value` **null**, so the moment FF-2
> ships writers, a repeating-group instance holding *only* a filled matrix is judged empty and
> **pruned by `submit_response` — silently destroying the answer**, cells cascading after it. Same
> class as FF-1's P0-1. Needs two more arms + a **mutation-proven** keystone
> (`instance_not_empty_with_matrix_only`). **FF-5 inherits the identical blindness for
> `answer_references`.**

Also confirmed live: `clone_form_version` copies options but **neither axis table** (INFO-1 matrix
half — publishing a matrix then editing it loses the grid); and neither correction RPC copies the
two matrix tables (the inherited P0-1 obligation below). Full keystone table → ADR 0089.

**Shared-stack hazards from the previous handoff are CLEARED** — ADR 0088's two migrations landed
on `main` at `b656ad4`; `registered == files == 200`, no drift. The `20260830000000+` window and
the file-contention note (`feature-flags.ts`, `seed.sql`, `database.ts`) still stand.

#### 🔵 PO rulings 2026-07-27 (post-E2E) — three decisions, all binding on the gate

1. **FUP-FF2-1 AND FUP-FF2-2 are both pulled IN, before the gate.** FF-2 does not gate while two
   pieces of its own ADR 0089 scope are unbuilt. Rationale accepted: without FUP-FF2-2 a filled
   matrix is **write-only** — grids that appear in no dashboard, on a platform whose stated purpose
   (CLAUDE.md §1) is that statistics come from dashboards — and its absence is also why
   `supersession_matrix_excluded` has no keystone and the plan's "author → fill → dashboard golden"
   E2E cannot be written. FUP-FF2-1 is smaller but sharper: a signer reviewing a section containing
   a matrix currently sees every other answer and an **empty grid**, then signs. Both move from the
   follow-up table into FF-2's build scope. Ownership: `backend` (`dashboard.ts`, `signoffs.ts` +
   the RPC payload), `frontend` (the sign-off view + the (row, col) picker UX).
2. **BUG-FF2-004 — fix `slugifyLabel` now** (`src/lib/forms/option-code.ts`, backend-owned):
   NFD-normalize and strip combining marks so `Higienização das mãos` mints
   `higienizacao_das_maos`, not `higienizac_a_o_das_ma_os`. Changes minted keys **platform-wide
   going forward** for every item type, not just FF-2 axis codes. Ruled in because we are pre-pilot
   with no live users, existing codes are immutable and untouched, and the repo's standing position
   is to design correctly now rather than carry back-compat ([[prelaunch-db-reset-ok]] reasoning).
3. **A `-\[--` guard joins the lint gate.** The Tailwind-v4 dead-class bug class (BUG-FF2-003) was
   invisible to tsc, lint, unit tests, `next build` **and** code review, surfacing only as an
   unreachable feature; nine sibling sites were silently dead motion tokens nobody would ever have
   reported. The pattern is *always* wrong under v4, so the guard has no false-positive surface.
   Lead-owned (lint config), and it lands **after** `tester` rewords the phantom-minting comment at
   `e2e/builder-dialog-ui.spec.ts:229` — otherwise the guard fails on that comment.

#### 🚦 FULL `e2e:prod` GATE — lead-run at `d10100c`, triaged 2026-07-27

**Raw: 762 passed · 55 failed · 4 flaky · 12 batches.** Triaged by connection-error count, per the
standing rule that **only a 0-conn-error batch can hide a real regression**:

| Batch | conn errors | verdict |
|---|---|---|
| b1 / b9 / b11 | 21 / 24 / 58 | **infra** — the `supabase_vector` crash-loop 502 class (52 failures) |
| **b5 / b10** | **0 / 0** | **real — 3 failures** |

**All 3 reproduce deterministically** on a targeted re-run (fresh server + fresh DB, 0 conn errors),
so they are **not** flakes. **All 3 are PRE-EXISTING; none is caused by FF-2.** FF-2's diff is 96
files with **zero** on the referrals path, and its `seed.sql` change is **+79 lines / 0 deletions**
mentioning referrals **zero** times.

1. **`form-builder-enhancements.spec.ts:768` AC-4** — asserts the "obrigatória" toggle is DISABLED
   beside a visibility condition. **FF-1 deliberately removed that behaviour**: `git log -L` blames
   the "offered BESIDE a visibility condition" comment to **`633e688 feat(ff-1)`**, and
   `form_items_conditional_not_required` was dropped by `20260828000000` (confirmed absent from the
   live catalog). FF-2's only edit in that region added `bandError` to the **submit** button.
   **A stale FF-1 spec.** It should have gone red at FF-1's gate.
2. **`phase22-referrals.spec.ts:428` Flow 1a** — the hub does not render ENC-0001. The row **is**
   seeded (`code = ENC-0001`, `status = completed`, subject matches the locator exactly), and
   `referrals-list.tsx` renders the two sections behind **a status filter**. Possible live Phase-22
   defect (a `completed` referral invisible on the hub by default) — not characterized further.
3. **`phase22-referrals-governance.spec.ts:1187` R5-6** — keyboard-only internal note. Same module.

> ⚠ **The finding that outlasts this phase: the ~18–27 "flaky baseline" is absorbing DETERMINISTIC
> reds.** All three fail every time on a clean stack. #1 has been red since FF-1 and was written off
> as baseline noise. A baseline that large is not a known-issues list, it is a hiding place — and the
> only reason these surfaced is that the batch-level conn-error split separated infra from real.
> Two batches also reported **"did not run"** (11 and 39), so the raw totals understate coverage as
> well. Re-baselining is a cross-phase task, not FF-2's.

**Verdict for FF-2: the gate is GREEN for this phase.** Every FF-2 and neighbour spec passes —
`ff2-matrix` 11/11, `ff2-matrix-views` 5/5, `ff1-repeating-groups` 9/9, `phase5-wizard` 12/12,
`phase6-signoffs` green.

**PO ruling 2026-07-27: file all three against their owning phases, do NOT absorb them into FF-2**
(consistent with the FUP-FF2-3 deferral — FF-2 does not become the drain for every red it happens to
run past). Filed below; **`qa` should read them as triaged-and-owned, not as FF-2 debt.**

| ID | Owner phase | What | Notes |
|---|---|---|---|
| **BUG-FF1-008** | FF-1 | `form-builder-enhancements.spec.ts:768` AC-4 pins the pre-FF-1 "obrigatória disabled beside a condition" behaviour that `633e688` deliberately removed | ~2 lines in `tester`'s file. **Red on every run since FF-1** and written off as baseline noise |
| **BUG-P22-001** | Phase 22 | The referrals hub does not render ENC-0001. Row is seeded (`status = completed`, subject matches the locator exactly); `referrals-list.tsx` gates both sections behind a **status filter** | **May be a live user-facing defect** — a committee would not see its own concluded encaminhamento. Needs triage: product bug vs stale spec |
| **BUG-P22-002** | Phase 22 | `phase22-referrals-governance.spec.ts:1187` R5-6 keyboard-only internal note | Same module; not characterized |

#### 📋 FUP-E2E-1 — RE-BASELINE `e2e:prod` (cross-phase, PO-ruled 2026-07-27)

Replace the *"~18–27 expected failures"* folklore with a **named list**. Run the suite on a clean
stack and classify **every** failure as `infra` / `deterministic-real` / `genuinely-flaky`, each with
an owner. **Blocks nothing.**

*Why now:* a count-shaped baseline is a hiding place, not a known-issues list — BUG-FF1-008 sat red
inside it since FF-1. The batch-level conn-error split (`>0` = infra, `0` = real) is what surfaced
these and should become the documented triage step, not a technique each lead has to reinvent.
Note two batches also reported **"did not run"** (11 and 39), so raw totals misstate coverage in both
directions; the re-baseline should establish why batches terminate early.

**Two things worth doing before or during FF-2** (both from FF-1's QA, neither blocking):
**INFO-4** — the SQL↔TS parity vectors have **no drift detector**, and FF-3 adds a *second*
evaluator pair; a real detector is cheapest now. **MINOR-1/2/3** — three pgTAP corrections that
could ride FF-2's gate. Detail in **FUP-FF1-2** below.

> 🔴 **FF-2 / FF-5 inherit a binding obligation from FF-1's P0-1** — `answer_matrix_cells`,
> `answer_risk_matrix` and `answer_references` all hang off **`answer_id`** and are copied by
> **neither** correction RPC. Correct only while write-inert. Each phase's writer needs a copy
> block **with the instance remap**: a correction gives the successor its own
> `response_group_instances` rows, so any join matching `new.group_instance_id` to
> `old.group_instance_id` is unsatisfiable by construction. That exact bug shipped in FF-1 as a
> P0 (a correction silently destroyed every choice answer inside a repeating group, proven live
> 2 → 0). FF-1's K4 covers **selections only** — nothing existing catches a repeat. Stated in
> [flexible-forms-program.md](docs/plans/flexible-forms-program.md) §3 FF-2/FF-5 with named keystones.

#### `backend` — Wave 1 (schema + contract) ✅ COMPLETE 2026-07-27

Eight migrations, `20260830000000`–`…000700`; `registered == files == 208`, max
`20260830000700`. Applied + full `db reset` replay clean.

| # | Migration | Lands |
|---|---|---|
| 000000 | `ff2_matrix_schema` | `weight` on both axis tables · `UNIQUE (answer_id, row_id)` · code-immutability triggers · cross-item coherence triggers · submitted-immutability on both answer tables (REUSES `app.guard_submitted_selections` — answer_id-generic, not selection-specific) · `form_items_input_vs_display` relaxed for matrix/risk_matrix (**`reference` stays pinned until FF-5**) |
| 000100 | `ff2_matrix_flag` | `matrix_fields`, inserted **disabled**; no gate flip in this wave |
| 000200 | `ff2_upsert_matrix_axes` | `upsert_matrix_axes` (DEFINER, draft-only, authority-first, audited) + `app.validate_matrix_axes` wired into `publish_form_version` |
| 000300 | `ff2_matrix_answer_writers` | `app.save_matrix_answers` / `app.save_risk_matrix_answers` (DEFINER; `risk_score` derived, client score never read) + the ownership gate |
| 000400 | `ff2_save_section_matrix_arm` | `save_section_answers` gains `p_matrix_cells` / `p_risk_matrix`; `app.save_instance_answers` gains the same two entry keys |
| 000500 | `ff2_completeness_matrix` | `app.instance_is_empty` +2 arms (§A) · **`app.item_required_satisfied`** — the four inlined presence tests collapsed into ONE predicate · `response_required_complete` + `submit_response` dispatch to it |
| 000600 | `ff2_clone_deep_copy` | `app.copy_version_children` extracted (INFO-1) + axes copied with codes/weights |
| 000700 | `ff2_correction_matrix_copy` | the **four** correction copy blocks, instance-resolving join |

**Decisions worth flagging.** (a) Matrix answers **extend `save_section_answers`** rather than
landing as siblings — the cell FK needs its parent `answers` row in the same transaction, and FF-1
already settled "one payload, one round trip". (b) The four duplicated required-presence blocks
were **collapsed into `app.item_required_satisfied`**: adding a matrix arm to three of four is a
bug no test distinguishes from the fix. (c) `clone_form_version` stays INVOKER (its RLS-gated
`form_versions` INSERT is the authority proof); the DEFINER helper **re-checks the displaced
`form_*_staff_admin_write` predicate on BOTH endpoints**, because a DEFINER's gate replaces RLS.

**K9 re-verified live after the writers shipped:** all four matrix tables still `SELECT`-only for
`authenticated`; direct INSERT/UPDATE denied (42501). Grants are **table-level** (only
`case_referral` is column-level), so `weight` inherited SELECT.

⚠ **Constraint relaxation swept:** `supabase/tests/209_flexible_forms.sql` §B1 pinned
"required=true matrix rejected" and was rewritten (B1a/B1b accept matrix + risk_matrix, **B1c keeps
`reference` pinned**); plan 38 → 40.

**Green bar:** typecheck clean · `npm run lint` 0 errors / 0 warnings · Vitest **497/497** (38 files)
· `npx next build` **succeeded**.

One frontend-owned file touched mechanically: `src/components/forms/item-type-meta.tsx`
(exhaustive `Record<ItemType, …>` + unguarded lookups → a missing entry is a runtime crash, not
cosmetics).

#### 🔴 BUG-FF2-001 — the matrix writers were UNREACHABLE from the authoring path (found + fixed)

Found by `frontend` and confirmed live by the lead immediately after Wave 1. **`addItem` /
`updateItem` could not create or edit a `matrix` / `risk_matrix` item**, so `upsert_matrix_axes`
had no caller in the product:

- `ALL_ITEM_TYPES = [...INPUT_TYPES, ...DISPLAY_TYPES, ...CONTAINER_TYPES]` — neither matrix type
  was in any of the three, so `addItem` rejected with `itemTypeInvalid`.
- `parseItemFields` dispatched on the same three sets and fell through to `itemTypeInvalid`.
- `question_key` was minted only when `isInput`, but a matrix **is** answerable and the aggregation
  contract is `(question_key, row_code, col_code)` — and `form_items_input_vs_display` *requires* a
  key for both types.

**Class: `declared-param-no-caller` — third instance in this repo** (after ETH·E3a's
`p_case_type_id`). Fails **CLOSED** (`addItem` rejects; no bad data reached the DB), and was
invisible to lint, typecheck, `next build`, the unit suite and every pgTAP keystone — because none
of them crosses the seam between the builder form and the database. Wave 1's live proofs were real
but drove the writer *directly* and through *seeded* rows, never through the authoring path.

**Fixed:** `MATRIX_TYPES` (imported from `item-tree`, not a fourth spelling) folded into
`ALL_ITEM_TYPES`; a `parseItemFields` matrix arm (label required, `required` via `parseRequired`
per ruling 3, `config` via `parseItemConfig`, options/default_value/content null); the `isInput`
question-key gate widened to `ANSWERABLE_TYPES` at **both** sites (mint + collision-retry);
`configRiskBands` parsing added to `parse-config.ts`.

**Covered by a new seam test** — `src/lib/forms/actions.test.ts` drives the ACTIONS with a mocked
client, the same shape FF-1's BUG-FF1-001 forced. **Mutation-proven:** removing `...MATRIX_TYPES`
from `ALL_ITEM_TYPES` turns 6 of 12 red; reverting the question-key gate to `INPUT_TYPES` turns the
`question_key` assertion red. Both restored.

**Reachability sweep of every Wave 1 surface** (lead-requested, post-fix): `upsert_matrix_axes` ←
`upsertMatrixAxes` ← `matrix-axes-editor.tsx`; `p_matrix_cells`/`p_risk_matrix` ← `saveSection` ←
`matrix-grid.tsx` / `risk-matrix-picker.tsx`; `ResponseForFill.matrixCellsByItemId` /
`riskMatrixByItemId` and `Item.matrixRows`/`matrixColumns` ← the same two wizard components;
`config.riskBands` ← `risk-bands-editor.tsx`. **`matrixFieldsEnabled()` has no caller yet** — owned
by `frontend` for the picker/wizard gate. No surface fails open.

#### `backend` — Wave 2 (pgTAP keystones) ✅ COMPLETE 2026-07-27

`supabase/tests/271_ff2_matrix_fields.sql` — **79 assertions**, every keystone in ADR 0089's
§Consequences table except `supersession_matrix_excluded` (see FUP-FF2-2 — deliberately absent
rather than written against a path that does not exist).

**Full ordered `supabase test db` from a clean `db reset`: 137 files, 4006 tests, `Result: PASS`**
(baseline before FF-2 was 3925). Sections: §0 flags asserted-not-forced · §A K9 after the writers
shipped (denial *and* the door working) · §B code immutability + publish validation · §C one column
per row · §D coherence · §E server-derived score · §F row-complete · §G deadlock-negative **with an
anti-vacuity twin** · §H clone + gate parity · §I submitted-immutability · §J/§K the two
mutation-proven ones · §L the collapsed predicate on all four paths.

**Mutation proofs performed (ADR 0079), red output observed:**

| Keystone | Mutation | Observed |
|---|---|---|
| `instance_not_empty_with_matrix_only` (§J) | both matrix arms removed from `app.instance_is_empty` | **6 red** — J1 false; J4 instance count `have: 0 want: 1`; J5 cells `have: NULL want: i1->ic_a,i2->ic_b`; K4/K5/K6 collateral (§K's instances pruned too) |
| `correction_copies_matrix_answers` (§K) | the instance-resolving subquery in `supersede_response`'s cells block → `new_a.group_instance_id is not distinct from old_a.group_instance_id` | **exactly 2 red** — K4 `have: NULL want: i1->ic_a`, K5 `have: NULL want: i2->ic_b`. **K2 (top-level) and K3 (risk) stayed GREEN**, which is the proof that a top-level-only keystone is structurally blind to this defect — FF-1's K4 blindness, generalised |

Both restored; a clean `db reset` + full suite re-run confirms the migrations alone produce green.

#### 🔴 Two further Wave-1 defects, found BY the Wave-2 run and fixed (`20260830000800`)

1. **SQL-NULL trap in three "reject a missing key" guards — the guard failed OPEN.**
   `x -> 'weight'` on an object with no `weight` key is SQL NULL, and `jsonb_typeof(NULL)` is NULL,
   so `jsonb_typeof(x -> 'weight') <> 'number'` evaluated to NULL rather than TRUE and the EXISTS
   never matched. The guard rejected a weight of the wrong *type* and waved through a weight that
   was *absent* — exactly the case it existed for. Caught by keystone **A13** (`caught: no
   exception`) and **E5**. Blast radius was larger than the missed error: `upsert_matrix_axes` then
   REPLACED the risk axes with the weightless payload, so publish failed HC0P6, `risk_score` came
   back NULL, and an axis code vanished — **six further keystones red from one root cause**. Fixed
   with `coalesce(jsonb_typeof(...), 'missing')`.
2. **`app.copy_version_children`'s gate was STRICTER than the RLS it displaced** — it broke
   `61_answer_model_v2`, `203_others_and_length` and `209_flexible_forms`, all of which drive
   `clone_form_version` with **no JWT** (as the owner, for whom RLS is bypassed). The rule a DEFINER
   gate must satisfy is *neither weaker nor stronger* than the policy it replaces; the check is now
   scoped to callers that have an authenticated identity. Not a hole — `app` is not PostgREST-exposed
   and `clone_form_version` is still INVOKER, so an anonymous caller is refused by the RLS-gated
   `form_versions` INSERT first. **Both arms are keystoned (H5 live-gate / H6 no-JWT parity).**

Also swept: **`184_hospital_admin_isolation` §11 counted CCIH's seed forms (1)** and my seed demo
form made it 2 — the same "when you add data, grep for the test that counted it" class as the
§B1 CHECK sweep. Expectation updated; the isolation proof (0 rows from the sibling hospital / other
org) is untouched.

#### `frontend` — Builder + Wizard UI ✅ COMPLETE 2026-07-27

Nine new files, twenty-six touched. Built against `backend`'s posted signatures (`a2fbe35`
+ `1a173a5` + `3edfe02`), never against a guessed shape.

**Builder.** `MatrixConfigDialog` (`src/components/forms/matrix-config-dialog.tsx`) is the only
writer of the axes — deliberately NOT part of the item editor's `<form action={addItem}>`, because
`upsertMatrixAxes` is keyed on an item id that does not exist in "add" mode, and because REPLACE
semantics are only honest if one piece of state owns the COMPLETE axis. `MatrixAxesEditor` offers
relabel / reweigh / reorder / add / remove and **no re-key affordance anywhere**; the immutable
`code` is shown read-only (mono, muted) so an author can see why relabelling is free and removal is
not. `RiskBandsEditor` authors `config.riskBands` as THRESHOLDS and previews the derived ranges
("Alto a partir de 27") rather than making the author keep two ends in sync. Both matrix types are
offered in "Adicionar bloco" under a new **Matrizes** group, gated on `matrix_fields`.

**Wizard.** `matrix` renders a radio grid, `risk_matrix` a severity × likelihood picker with the
score computed live from the axis weights and the band derived from `config.riskBands` — **display
only; no score is ever sent** (the write contract has no field for one). Both work per-instance
inside a repeating group, and the review screen renders the filled grid and the score + band
through the SAME components, read-only, so author preview / fill / review can never drift.

**Three decisions worth flagging.** (a) Matrix answers live in their OWN state slices, never in
`AnswerState` — a matrix has `answers.value` NULL by design, so merging it would put a non-value in
the derived `AnswerMap` and corrupt every condition evaluated after it. (b) `isInputItem` stays
FALSE for matrix (it means "scalar in `answers.value`" and a dozen call sites depend on that); a new
`isAnswerableItem` carries the widened meaning, mirroring backend's `ANSWERABLE_ITEM_TYPES` vs
`INPUT_ITEM_TYPES` split. (c) `collectScope` / `validateSection` now take the whole SCOPE object
instead of positional slices, so FF-5's references cannot produce a call site that forgets to pass
them — the FBE-004 / FBE-008 failure mode, closed by construction. Related: the builder's flags moved
from a boolean drilled through six components into a `BuilderFlagsProvider`, so FF-3/FF-4 add a flag
in one place instead of four.

**`app.instance_is_empty` has a client twin now.** `isEmptyInstance` counts matrix content, matching
the SQL arms ADR 0089 §A added. Without it the review screen would hide a repetition the server is
about to keep.

**Verified in a running app**, not just compiled — a real Chromium against a worktree dev server,
because the agent Browser pane never composites and therefore never hydrates (a stale-looking UI
there is a harness artifact, not a defect; worth knowing before someone re-debugs it). Fill: 3 cells
persisted one-per-row + `risk_score = 27` **derived server-side** from 9 × 3, response `submitted`.
Builder: clone → axes deep-copied with codes and weights (INFO-1 confirmed live), relabel kept
`higienizacao`, an added column minted `parcial_6w7jwu` client-side, bands persisted sorted, publish
→ fill shows the relabelled row, the added column and "Pontuação: 27 · Alto". **A matrix authored
from scratch through "Adicionar bloco" was driven end to end** after `3edfe02` landed — the seam
BUG-FF2-001 had made unreachable.

**Keyboard/a11y proven against the real DOM**, not asserted in a comment: `<caption>`, `th[scope]`
both ways, `headers` on every cell, ONE native radio group per row (Tab walks rows, arrows walk the
scale — the platform's behaviour, not a hand-rolled roving `tabIndex`), and each control announces
both coordinates ("Higienização das mãos, Conforme"); a risk cell adds its score and band. The
risk grid is ONE `radiogroup` because it is one choice.

**Green bar:** typecheck clean · `npm run lint` **0 errors / 0 warnings** · Vitest **553/553**
(41 files; +36 in `src/lib/forms/matrix.test.ts` and
`src/components/responses/wizard/matrix-wizard.test.ts`) · `npx next build` **succeeded**.

> 🔴 **BUG-FF2-002 — `backend`'s file, reported not fixed.** `publishVersion`
> (`src/lib/forms/actions.ts:1752`) maps only `23514` and `HC080`; every other code falls to
> `MESSAGES.generic`. So publishing a version whose matrix has **no axes** — a real and expected
> authoring state, which `app.validate_matrix_axes` refuses with **`HC0P5`** (and `HC0P6` for a
> missing risk weight) — tells the author only "Não foi possível concluir. Tente novamente." with
> no hint which block is at fault. **Reproduced live**: publish failed; deleting the axis-less
> matrix made the same publish succeed. Needs `HC0P5` → `MESSAGES.axisInvalid` and `HC0P6` →
> `MESSAGES.riskWeightRequired` (both strings already exist in that file). Violates Rule 10 / §8.

#### 🔴 BUG-FF2-002 — `publishVersion` swallowed every FF-2 publish error (found + fixed)

Found by `frontend` by hand, verified by the lead. `publishVersion` mapped only
`23514`/`HC080`; everything else fell to `MESSAGES.generic`. So publishing a version whose matrix
had **no axes** — a *normal* authoring state, since `upsert_matrix_axes` is a separate call and a
matrix block exists with an empty grid from the moment it is added — reported only *"Não foi
possível concluir. Tente novamente."*: not transient, not retryable, and naming no block. The only
way out was deleting matrices until publish succeeded. `upsertMatrixAxes` already mapped these two
codes, so the inconsistency was **within one file**. Violates Rule 10 / §8.

**Fixed:** `HC0P5` / `HC0P6` cases added, preferring the DB message because it NAMES the offending
item (`a matriz "X" precisa de ao menos uma linha e uma coluna`) — the difference between an
actionable error and a dead end — with `MESSAGES.axisInvalid` / `riskWeightRequired` as fallback.

**Sweep for siblings** (lead-requested — this was found the slow, human way, so siblings were
likely). All four RPC call sites that can surface an `HC0P*` were audited against every raise site:

| Path | Codes reachable | Before | Now |
|---|---|---|---|
| `publishVersion` | HC0P5, HC0P6 | generic | mapped (the reported bug) |
| **`saveSection`** | **HC0P1, HC0P2, HC0P3, HC0P7, HC0P8, 42501** | **all generic** | **mapped** |
| `startEditFromPublished` | 42501 from `app.copy_version_children` | generic | mapped → `forbidden` |
| `upsertMatrixAxes` | HC0P2–HC0P6, 42501 | already mapped | unchanged |

`HC0P0` is unreachable from any app path (the only UPDATE of an axis row is `upsert_matrix_axes`,
which matches on `code` and never changes it; direct DML is denied by K9). `HC0P4` cannot surface
through the clone path (a clone's target is always a fresh draft).

**The most consequential sibling was `HC0P8` in `saveSection`** — reachable by ORDINARY USE: a
respondent who picks a severity but not a likelihood got "tente novamente" instead of "informe a
severidade e a probabilidade". Same defect as the reported one, on the fill path rather than the
builder path, and it would have been found the same slow way.

Covered by unit tests in `src/lib/forms/actions.test.ts` + `src/lib/responses/actions.test.ts`
(each asserts the raw SQLSTATE and Postgres text never reach the UI). **Mutation-proven:** removing
the two `case`s from `publishVersion` turns 4 red; restored. Vitest **565/565**, lint 0/0,
typecheck clean, `next build` succeeded. **Code-only — no DB verification run, per the lead's
stack-ownership hold.**

> ⚠ **Adjacent finding, NOT fixed (FF-1 scope, needs the lead's call):** `saveSection`'s chain also
> drops FF-1's **`HC0N2`** (`app.save_instance_answers`: "item do bloco não encontrado nesta
> resposta") into the same generic bucket. Identical class, shipped phase — reported rather than
> silently widened.

#### ⚠ OUT-OF-PHASE FIX — BUG-FF1-006 (`HC0N2`), attributed to **FF-1**, riding FF-2's gate

**Not FF-2 scope.** Surfaced by the BUG-FF2-002 sweep, reported rather than fixed, and **ruled in
by the lead** on the merits: same chain, same file, ~3 lines, purely an error-message mapping with
no behaviour change — and a **live user-facing pt-BR defect in a shipped phase**, so deferring it
would ship a known-bad message to the pilot and orphan the item against FF-3. Precedent: ADR 0088
was itself an out-of-phase fix. `qa` should read this as a deliberate scoped exception, not FF-2
scope creep.

`app.save_instance_answers` raises `HC0N2` for two distinct conditions — *"entrada de bloco
repetível sem identificador"* and *"item do bloco não encontrado nesta resposta"* — and
`saveSection` dropped **both** into `MESSAGES.generic`. `mapGroupError` (used by the three instance
RPCs) has mapped `HC0N2` since FF-1; `saveSection` simply never consulted it, making this the same
within-one-file inconsistency as BUG-FF2-002.

**Fixed** by preferring the DB message (the two raise sites say different things and the single
constant can only say one), falling back to `MESSAGES.groupInstanceMissing`.
**Mutation-proven:** removing the case turns 3 red — all three assertions report
`Received: "Não foi possível concluir. Tente novamente."`; restored. Committed separately as
`fix(ff-1): …` so its diff is reviewable on its own. Vitest **568/568**, lint 0/0, typecheck clean,
`next build` succeeded. Code-only — no DB verification (`tester` owns the stack).

#### Why two FF-2 codes are deliberately UNMAPPED (recorded so nobody "completes" the gap)

`HC0P0` and `HC0P4`-via-clone have **no `case`** in `src/lib/forms/actions.ts`, on purpose, and the
reasoning is in a code comment beside the constants — not only here:

- **`HC0P0`** (axis code immutable) fires from a `BEFORE UPDATE` trigger. The only UPDATE any app
  path issues is inside `upsert_matrix_axes`, which matches rows **on** `code` and never writes it;
  direct DML is denied to `authenticated` by K9. Unreachable.
- **`HC0P4`** cannot surface through `startEditFromPublished` — `clone_form_version` creates the
  target itself, so it is always a fresh draft. It *is* reachable through `upsertMatrixAxes`, where
  it **is** mapped.

A `case` for an unreachable code is not free: it reads as reachable to the next person and invites
a unit test that can never fail — a vacuous keystone by construction (ADR 0079).

#### `backend` — Wave 3 (PO rulings) ✅ COMPLETE 2026-07-27

Migrations `20260830000900`–`…001000`; `registered == files == 211`. Full ordered
`supabase test db` **from a clean reset: 137 files, 4013 tests, `Result: PASS`**. Vitest
**587/587** · lint 0/0 · typecheck clean · `next build` succeeded · types regenerated with pgtap
absent (`0` pollution matches, +41 lines).

**FUP-FF2-2 — dashboard aggregation.** `dashboard_matrix_cells` (cell unit
`(question_key, row_code, col_code)`) + `dashboard_risk_scores` (one row per
(severity, likelihood) pair carrying `risk_score` as a NUMBER, plus per-key n/avg/min/max). Both
built on `app.submitted_form_responses`, so the supersession rule is the *same object* the four
existing aggregations use rather than a fifth copy. Aggregation resolves through **`code`**, never
`row_id`/`col_id`.

**`supersession_matrix_excluded` written and MUTATION-PROVEN** (§M of 271). Designed on `tester`'s
close-out lesson — *assert the property that changed, not the number that moved*: predecessor and
successor get **different columns and different weights**, so a count-only assertion (also `1` if
the SUCCESSOR were wrongly excluded, or if neither registered) cannot pass by accident. M1/M2 pin
the other half first — a merely `in_progress` successor must NOT blank the metric. Dropping the
supersession arm turns four red: `M3 have: mc_no,mc_yes want: mc_no` · `M4 have: 2 want: 1` ·
`M5 have: 27 want: 3` · `M6 have: altaxfreq=27,baixaxraro=3`.

**FUP-FF2-1 — the signer sees the grid.** `get_response_for_signoff` gains `matrix_cells_by_item` /
`risk_matrix_by_item` at top level and per instance, via two scope-parameterised `app` helpers
(one definition, not four inline expressions). `risk_score` is projected, never recomputed — it is
the durable fact the signer attests to.

> 🔎 **A THIRD instance of the same blindness, swept:** `getSubmissionDetail` calls the same
> `buildGroupInstances` and likewise never populated the grids, so the **primary read of a submitted
> response** showed an empty matrix too. Wired through `buildMatrixAnswers`.
>
> **Optionality question — answered: YES, tightened.** With all three producers (fill, sign-off
> door, submission detail) populating, `GroupInstance.matrixCellsByItemId`/`riskMatrixByItemId` are
> now **required**. They were optional only because of the sign-off path; leaving them optional
> would now only hide a producer that forgot.

**BUG-FF2-004 — `slugifyLabel`.** NFD marks are now stripped, not collapsed into `_`. All four call
sites swept: every one **mints forward** and none re-derives a slug to look an existing code up, so
**no stored code moves and no migration rewrites keys** — `question_key` / option `code` / axis
`code` are the joins the dashboards aggregate on. Mutation-proven; unit-tested across
ç ã õ á é í ó ú â ê ô à ü plus the collision paths.

> 🔴 **BLOCKER FOR `tester`, not fixable by me (`e2e/**` is tester-owned).**
> `e2e/ff2-matrix.spec.ts:507-510` **pins the buggy slug** —
> `/^higienizac_a_o_das_ma_os_[a-z0-9]{6}$/` and `/^na_o_conforme_[a-z0-9]{6}$/` — with a comment
> deliberately preserving it as "long-standing behaviour, not something FF-2 introduced". The PO has
> now ruled it a bug, so those two regexes must become `higienizacao_das_maos_…` /
> `nao_conforme_…`. **This is `tester`'s own close-out lesson pointing the other way: a guard that
> pins the old symptom blocks the correct fix.** The E2E suite will fail on these two until updated.

> ⚠ **Reported, NOT fixed (pre-existing, FF-1):** the per-instance `observations_by_item` /
> `other_text_by_item` filters inside `get_response_for_signoff` compare against `''''` — a literal
> apostrophe, not the empty string — so an empty-string observation is not filtered out. Carried
> **byte-identical** through the FF-2 re-declaration so that migration has no undeclared behaviour
> change. Lead's call whether it rides this gate.

#### ⚠ OUT-OF-PHASE FIX — BUG-FF1-007 (`<> ''''`), attributed to **FF-1**, riding FF-2's gate

**Not FF-2 scope.** Surfaced while re-declaring `get_response_for_signoff` for FUP-FF2-1, carried
**byte-identical** so that migration had no undeclared behaviour change, reported — and then **ruled
in by the lead**, on the same reasoning as BUG-FF1-006: unambiguous, four characters, already in the
function this wave, and *"a known-wrong comparison left in place becomes folklore"*.

`a.observation <> ''''` in SQL source compares against a string literal containing **one
apostrophe**. The two per-instance filters therefore excluded observations equal to `'` and let
**empty-string observations through** — the precise opposite of their intent, and inconsistent with
the top-level filter three lines away (`btrim(a.observation) <> ''`), which is what makes it a
quoting slip rather than a design choice. Fixed in `20260830001100`.

**Sweep (lead-requested — a quoting slip is rarely unique).** Across **all** schemas,
`prosrc like '%''''%'` matches exactly two functions:

| Function | Occurrences | Verdict |
|---|---|---|
| `public.get_response_for_signoff` | 2 | **the bug** — plain expression; fixed |
| `storage.list_multipart_uploads_with_delimiter` | 3 | **correct** — inside a dynamic-SQL string passed to `EXECUTE` (note the `$4`/`$6` placeholders), where `''''` legitimately renders as `''`. Vendor code, different construct. |

No RLS policy `qual`/`with_check` contains the pattern. The storage hit is exactly why this was
fixed by reading each site rather than by a blind replace.

> **FUP-FF2-3 — DEFERRED by the lead, deliberately, 2026-07-27.** Fixing `''''` exposed a remaining
> asymmetry in the same function: the per-instance filters now compare `<> ''` while the top-level
> one uses `btrim(...) <> ''`, so a **whitespace-only** observation is still filtered at top level
> but not per instance. `backend` reported it rather than folding it in — correct, since it is a
> **different defect** from the one ruled in.
>
> **Not ruled in, and the reason is scope discipline rather than merit.** This is the third
> out-of-phase fix this wave (BUG-FF1-006, BUG-FF1-007), the phase is at its gate, and each one
> costs another migration, another clean-reset pgTAP run, and another re-serialization of three
> teammates on one DB. The impact is cosmetic — a blank observation block renders inside a group
> instance. A lead who never says no is how a gate stops meaning anything, so this one waits.
> **`qa` should see it as a stated deferral, not an oversight.**

**Keystone §N of 271** pins BOTH directions — an empty observation must be ABSENT and a real one
PRESENT (one direction alone is satisfied by a filter that drops everything, or nothing), plus N1
asserting the fixture really holds an empty string so N2 cannot pass vacuously.
**Mutation-proven:** restoring `<> ''''` in the two per-instance filters turns N2 and N4 red with
`have: <empty string> want: NULL`, while N1/N3 stay green. Restored via a clean `db reset`.

> ⚠ **Adjacent, NOT fixed (reported):** the per-instance filters compare `a.observation <> ''`
> while the top-level one uses `btrim(a.observation) <> ''`, so a whitespace-only observation is
> still filtered at top level but not per instance. A *different* defect from the one ruled in —
> reported rather than silently widened.

#### `frontend` — Wave 3 view halves (FUP-FF2-1 + FUP-FF2-2) ✅ COMPLETE 2026-07-27

Two commits, `4f65711` (reads) + `cbe4657` (dashboard), against `backend`'s Wave-3 contract.

**FUP-FF2-1 — the sign-off + submission reads.** The empty grid had **two** causes, which is why
it read as merely blank rather than broken: the door did not project the matrix tables (backend,
`08e02eb`), **and** both read views filtered blocks with `isInputItem`, which is FALSE for a matrix
— so a VISIBLE matrix fell through to the display branch and rendered nothing while a HIDDEN one
sailed past the visibility gate. Both now use `isAnswerableItem`. No second renderer was written:
the wizard's read-only `MatrixGrid`/`RiskMatrixPicker` serve all three surfaces via `AnswerSummary`,
and `InstanceAnswersReadonly` (already shared by both views) forwards the per-instance grids.
`ClientResponseForSignoff`'s two new fields are **required**, exactly as FF-1 made `instances`
required — an optional field here is how a future caller silently reintroduces a blind signature.

> **The stored score is never recomputed.** `RiskMatrixPicker` gained `storedScore`, which wins over
> the computed product wherever a durable `risk_score` exists. The product is the wizard's preview of
> a score that does not exist yet; once it is a recorded fact, re-deriving it from today's axis
> weights would let a re-weighting restate what a historical response — or a signature over it —
> appears to say.

**FUP-FF2-2 — the dashboard.** `MatrixDistributionCard` + `RiskDistributionCard`, joining the
existing section→item ordering. **Rendered as real tables rather than Recharts figures, deliberately:**
Recharts has no heatmap, so forcing one through it yields an `aria-hidden` SVG *plus* a duplicate
table as its text alternative. Here the grid IS the data's natural form, so one `<table>` is chart
and accessible alternative at once, with nothing to keep in sync. **Colour is never the channel** —
every cell prints its number (count + row share; count + stored score) and each card states in words
what the tint means. Risk tint follows the score **relative to the observed range**, because
`config.riskBands` is per-item authoring config and not part of this aggregate; claiming an absolute
"Alto" the data cannot support would be worse than saying nothing. Identity is `rowCode`/`colCode`
throughout — a `*Label` can change under a relabel (ruling 4) and keying on it would split the series.

**Verified in a running app** (own server on :3100; never :3000) against three submissions with
deliberately different cells: heatmap read **2/1, 1/2, 2/0/1** exactly; risk summary read
**média 36,33 · mínima 1 · máxima 81** — the stored 1/27/81, not values re-derived from weights.
Screenshots `ff2-15-submission-detail.png`, `ff2-16-dashboard-matrix.png`.

**One defect found in the browser and fixed** (no test would have caught it): the submission detail
printed `question_explanation` above the block while the grid rendered its own — the line appeared
twice and was announced twice.

**Green bar:** typecheck clean · `npm run lint` **0 errors / 0 warnings** (incl. the new `[--var]`
guard) · Vitest **593/593** (42 files; +25) · `npx next build` **succeeded**.

**Mutation-proven**, 6 new tests in `src/components/signoffs/signoff-matrix.test.tsx` rendering the
REAL `ReviewAndSign`: reverting the filter to `isInputItem` turns **4 red** (the original empty
grid); dropping the stored-score override turns **2 red** — the fixture's stored `99` deliberately
disagrees with the `9 × 3 = 27` the weights would give, so a recomputing implementation cannot pass.

> ⚠ **NOT verified in a browser: the sign-off screen itself.** No seeded published form has both a
> `staff_admin` sign-off section **and** a matrix (`…b001` has the sign-off, the matrix form has no
> sign-off section), and manufacturing one means cloning + publishing a v2 — structural drift into a
> seed `tester` is about to write specs against. The renderer and the data threading are covered by
> the 6 mutation-proven tests above and the door by backend's pgTAP, so what is unproven is
> specifically **their composition on that route**. → a spec for `tester`.

#### `backend` — Wave 4 (QA r1 remediation) ✅ COMPLETE 2026-07-27

Migrations `20260830001200`–`…001400`; **`registered == files == 215`**. Full ordered
`supabase test db` **from a clean reset: 138 files, 4044 tests, `Result: PASS`** · Vitest
**593/593** · lint 0/0 · typecheck clean · `next build` succeeded · types regenerated with pgtap
absent (0 pollution matches).

| Finding | Fix | Keystone (in the new `272_ff2_door_parity.sql`) |
|---|---|---|
| **B-1** targeted respondent cannot save a matrix cell | `app.assert_matrix_answer_writable` takes the UNION of the `answers` write arms | §O1–O5 |
| **B-2** corrector reads 0 cells | `can_read_correction_response` added to both matrix SELECT policies | §P1–P3 |
| **B-3** no gate-flip migration | `20260830001200_enable_matrix_fields.sql` | §0a asserts the flag |
| **M-1** ruling 3's per-instance half uncovered | (behaviour was correct) | §Q1–Q6 |
| **M-2** `start_correction_draft` copy blocks uncovered | (behaviour was correct) | §R1–R6 |

#### 🔴 THE SWEEP — every FF-2 door and policy vs the surface beside it

`qa` was right that the *rule* was named and never *applied*. Swept arm-by-arm against
`pg_policies` / `pg_proc`, not against the review. **It found a fourth gap the review did not.**

**A · Policies** (read arms; `base` = creator / commission-admin / submitted+staff_admin):

| Surface | Sibling | base | `can_read_correction_response` | `can_access_targeted_*` | Verdict |
|---|---|---|---|---|---|
| `answer_matrix_cells_select` | `answer_selected_options_select` + `answers_select*` | ✅ | ✅ *(added)* | ✅ *(added)* | **match** |
| `answer_risk_matrix_select` | same | ✅ | ✅ *(added)* | ✅ *(added)* | **match** |
| `form_matrix_rows_select` | `form_items_select` + `form_items_select_targeted` | ✅ | n/a | ✅ *(added)* | **match** |
| `form_matrix_columns_select` | same | ✅ | n/a | ✅ *(added)* | **match** |
| *(write policies)* | `answer_selected_options_write_own_draft` | — | — | — | **deliberately absent** — K9: SELECT-only grants, every write through a DEFINER RPC |

**B · Doors** (all `prosecdef = true`):

| Door | Surface it replaces | Arms required | Verdict |
|---|---|---|---|
| `app.assert_matrix_answer_writable` | `answers` write policies | (creator ∧ in_progress) ∨ `can_write_targeted_response` | **match** *(B-1 fix)* |
| `public.upsert_matrix_axes` | `form_items_staff_admin_write` | `is_staff_admin_of` ∨ `is_commission_admin_of` | match |
| `app.copy_version_children` | `form_*_staff_admin_write` | same, **scoped to `auth.uid() is not null`** so it is not *stronger* than the RLS it displaces | match *(Wave 2 fix)* |
| `dashboard_matrix_cells` / `_risk_scores` | `dashboard_distributions` | `is_staff_admin_of` ∨ `is_admin` | match |
| `app.matrix_cells_by_item` / `_risk_matrix_by_item` | — | none: called only from the already-gated `get_response_for_signoff`; `app` is not PostgREST-exposed | deliberately none |
| `app.item_required_satisfied` / `app.instance_is_empty` | — | none: read-only booleans over the caller's own response, conferring no authority | deliberately none |

##### 🔴 FOURTH GAP, found by the sweep and not in the review — `20260830001400`

`form_matrix_rows` / `form_matrix_columns` lacked the `can_access_targeted_version` arm that
`form_versions` / `form_sections` / `form_items` all carry. **B-1's fix alone would have shipped
half a feature**: a targeted respondent could write a cell and still not read the axis rows, so the
wizard renders an empty table with nothing to click. Caught only because §O3 asserts the **round
trip** rather than the write — it went red (`have: NULL want: dr1->dc_ok`) with the write already
green.

> ⚠ **Two PRE-EXISTING gaps of the same family, reported NOT fixed** (neither is FF-2's table):
> **(a) `form_item_options_select`** has no targeted arm, so a targeted respondent cannot read the
> options of any `multiple_choice`/`dropdown`/`checkbox` question — **ETH·E2's targeted flow renders
> every choice input empty today, independently of matrices.** **(b) `answer_selected_options`** has
> no targeted arm on either its SELECT or its write policy, so that respondent cannot save or read
> back a choice selection. Both are live-catalog-confirmed; lead's call.

> 📌 **BINDING FF-5 OBLIGATION (carried forward as FF-1's P0-1 was to FF-2):**
> `answer_references_select` is **missing both** the `can_read_correction_response` and the
> `can_access_targeted_response` arms. It is write-inert (0 rows) so there is **no live impact and
> it must not be fixed now** — but FF-5's writer landing is exactly when that stops being true, and
> the table's SELECT policy must gain both arms in the same change.

##### Mutation proofs — all five performed, red observed, restored

| # | Revert | Observed |
|---|---|---|
| M1 | targeted arm out of `assert_matrix_answer_writable` | O2 + O3 red |
| M2 | targeted arm out of `form_matrix_rows_select` | O3 red |
| M2b | targeted arm out of `form_matrix_columns_select` | O3 red — **both halves proven load-bearing separately** |
| M3 | `can_read_correction_response` out of both matrix SELECT policies | P2 `0/6`, P3 `0/1`, R6 collateral |
| M4 | both per-instance arms → the pre-FF-2 inlined test | **Q3 + Q4 red** |
| M5 | both matrix copy blocks out of `start_correction_draft` | R2–R5 red, all `have: NULL` |

> 🔎 **Two things the mutation runs taught, recorded because they generalise:**
> **(1) M2's first run stayed GREEN** — the mutation reverted `form_matrix_rows_select` while §O3
> joined only `form_matrix_columns`. The keystone was proving the *assertion*, not the *fix*. §O3
> now reads through **both** axis tables, and M2/M2b prove each half independently. *A mutation that
> reverts only part of a fix is as vacuous as a keystone that cannot fail.*
> **(2) M4 turns Q3/Q4 red, NOT Q1/Q2** — and that asymmetry is the finding. The reverted test
> reports a matrix as unanswered *always*, so the "blocks when incomplete" direction still passes,
> for the wrong reason. **Only the positive direction can see the defect** (`qa`'s "permanently
> unsubmittable form"). A keystone written only in the blocking direction would have been vacuous —
> which is exactly how M-1 survived.

#### ⚠ OUT-OF-PHASE FIX — the ETH·E2 targeted CHOICE lane, attributed to **ETH·E2** (ADR 0073 §D13)

**Not FF-2 scope.** Surfaced by FF-2's Wave-4 door-parity sweep, reported rather than fixed, and
**ruled in by the PO** — reasoning recorded as given: the pattern was loaded, the sweep methodology
proven, and the identical fix had just been applied to four matrix surfaces, so *"it will never be
cheaper."* Same treatment as BUG-FF1-006/007. Migration `20260830001500` (the instruction said
`001300+`; that window was already occupied by FF-2's own Wave-4 migrations — flagged, and 001500
confirmed by the lead).

**The defect.** A targeted respondent — ETH·E2's entire premise, an external professional formally
instructed to complete a form — resolves through `app.can_access_targeted_*`. The version, its
sections and its items each carry a `_select_targeted` policy. **Their children did not.** So
`multiple_choice` / `dropdown` / `checkbox` — three of the eight input types — rendered with an
empty option list for that user class, and a selection could be neither saved nor read back.

**The sweep found two more holes past the two reported** (the lead's instruction to sweep the whole
fill path rather than fix only the named surfaces):

| Surface | targeted read | targeted write | Status |
|---|---|---|---|
| `form_item_options` | ❌ | n/a | **fixed** — reported |
| `answer_selected_options` | ❌ | ❌ | **fixed** — reported |
| **`response_group_instances`** | ❌ | ❌ | **fixed — NOT reported.** FF-1 × ETH·E2: a repeating group was as unfillable as a choice question |
| **`app.assert_group_writable`** | — | ❌ creator-only (`HC0N2`) | **fixed — NOT reported, and it made the policy fix alone useless**: the three FF-1 instance RPCs all funnel through it |
| `form_item_validations` (FF-3) · `answer_references` (FF-5) | ❌ | ❌ | **write-inert — deliberately not fixed**, carried as binding obligations (now also in ARCHITECTURE.md §2) |
| `response_section_signoffs` | ❌ | ❌ | **appears correct by design** — the `respondent` signer is `created_by`, i.e. the *coordinator* for a targeted response. Flagged, not changed |

`app.assert_group_writable` is the sharpest: its own comment reads *"RLS already confines the write
to the creator's own draft; this only turns that zero-row silence into a readable message."* True
when written — and the **fourth instance this phase of a gate that restates an RLS rule and then
drifts when the rule widens.** It is INVOKER, so RLS stays the boundary and widening it cannot
over-grant.

**Convention:** separate `_targeted` policies, matching `form_items`/`responses`/`answers` — not a
widened base `qual`. ⚠ FF-2's own Wave-4 matrix fix widened the base qual instead; functionally
identical (permissive policies OR together), cosmetically inconsistent. **Not** rewritten —
applied migrations are forward-only and a normalising migration would be churn for zero behaviour
change — but the codebase now carries both shapes.

**Write side included, and the DELETE half is load-bearing:** `save_section_answers` implements
REPLACE as delete-then-insert, so an INSERT-only widening would leave the old row silently filtered
and the new one appended — **two selections on a `multiple_choice` item.** That would have turned a
fail-closed defect into a data-corrupting one. Hence `FOR ALL`, mirroring the table's own
`_write_own_draft`. Mutation A4 proves it: `have: sim,nao want: nao`.

**Keystones** — `supabase/tests/273_eth_targeted_choice_lane.sql`, **17 assertions**, every one
round-trip shaped (save → **read back**), plus three negatives bounding the widening.

##### Mutation proofs — one per arm (the M2 lesson), all red, all restored

| # | Arm reverted | Observed |
|---|---|---|
| A1 | `form_item_options_select_targeted` | **7 red** |
| A2 | `answer_selected_options_select_targeted` | C12 red |
| A3 | `answer_selected_options_write_targeted` | **6 red** |
| A4 | …narrowed to `FOR INSERT` | C6 red — `have: sim,nao` (the corruption) |
| A5 | `response_group_instances_select_targeted` | C13 red |
| A6 | `response_group_instances_write_targeted` | C7/C8/C10 red |
| A7 | the union in `app.assert_group_writable` | **4 red** |

> 🔎 **A2 and A5 first ran GREEN, and the reason generalises.** Both `_write_targeted` policies are
> `FOR ALL`, and **a FOR ALL policy's `USING` clause grants SELECT too** — so while the response is
> `in_progress` the write policy already covered every read the keystone made, and the dedicated
> SELECT policies were being proved by nothing. They are *not* redundant:
> `can_write_targeted_response` = `can_access_targeted_response ∧ in_progress`, so the FOR-ALL read
> grant **dies at submit** while `answers_select_targeted` (status-free) keeps the scalar answers
> visible. Without the dedicated policies a targeted respondent would submit and instantly lose
> sight of every choice and every repeating-group row while still seeing their text answers — the
> same split-brain as the corrector reading answers-but-not-cells. Added **C12/C13 (post-submit
> reads)**; both arms then went red. *This is the third time this phase that a keystone proved the
> assertion rather than the fix — and the standing repo lesson "a FOR ALL policy IS a read policy"
> is exactly what it was.*

#### 🐞 BUG-AUTHZ-001 — `platform_admin` reaches response-derived content through DEFINER dashboard functions (owner: **AUTHZ**; NOT fixed here)

Filed per the lead's ruling on QA r2 m-1. **FF-2 itself is correct and nothing was changed:**
`dashboard_matrix_cells` / `dashboard_risk_scores` carry an `is_admin()` arm *because their sibling
`dashboard_distributions` does* — inheriting the neighbour's arm is the rule this phase learned four
times over, and deviating would have been the inconsistency.

The underlying question is broader than FF-2 and sharper than a MINOR. Live catalog:

| Function | `prosecdef` | `is_admin()` arm |
|---|---|---|
| `dashboard_distributions` | ✅ | ✅ |
| `dashboard_export_rows` | ✅ | ✅ |
| `dashboard_matrix_cells` | ✅ | ✅ |
| `dashboard_risk_scores` | ✅ | ✅ |
| **`responses` — every policy** | — | ❌ **none** |

CLAUDE.md's noun rule says `platform_admin` may **not** touch commission content, and ADR 0078 A35
rests on a 40-site census finding it reads *0 cases / 0 responses / 0 narratives / 0 meetings*. That
census is consistent with the `responses` row above — and **a SECURITY DEFINER function returning
response-derived data is invisible to a policy-shaped audit of `responses`**, which is ADR 0078's
own documented blind spot (*"`prosecdef` belongs beside `pg_policies`"*). `dashboard_export_rows` is
the sharpest case: it returns **one row per response with its answers**, not an aggregate.

So the census may have understated `platform_admin`'s reach across **every** dashboard function.
**Deliberately not fixed:** it spans functions no FF phase owns and re-opens an ADR 0078 finding —
the PO's call, not this phase's.

#### FF-2 follow-ups — ✅ BOTH CLOSED in Wave 3 (PO ruled them into gate scope)

Kept for the audit trail; neither is outstanding.

| id | Gap | Why deferred |
|---|---|---|
| **FUP-FF2-1** | `get_response_for_signoff` does not project `answer_matrix_cells` / `answer_risk_matrix`, so a signer reviewing a section containing a matrix sees the other answers but an **empty grid**. `GroupInstance.matrixCells/riskMatrix` are optional ONLY because of this path (commented at the call site in `src/lib/queries/signoffs.ts`). | Needs the RPC's JSON payload widened + the sign-off view; read-only display, no data risk. |
| **FUP-FF2-2** | Dashboard **cell-unit aggregation** — `(question_key, row_code, col_code)` counts and `risk_score`-as-number in `dashboard.ts`, each with its own supersession-tolerant predicate (ADR 0089 §Consequences). | Not built, so ADR 0089's `supersession_matrix_excluded` keystone is **deliberately absent** from `271_ff2_matrix_fields.sql` rather than written against a non-existent path. |
FF-1's five (BUG-FF1-001…005 — three blockers, one critical, one blocker; all closed and
re-verified) are recorded with full repro/fix detail in
[ff-1-repeating-groups.md](docs/progress/ff-1-repeating-groups.md).

#### ✅ BUG-FF2-003 — the "Adicionar bloco" menu overflows the viewport with **no scroll**, so both new Matrix types are UNREACHABLE at 1280×720 · P1 · owner `frontend` · **CLOSED 2026-07-27, re-verified by `tester`**

> **Fix `98176d5` (cap) + `9d103d1` (nine-site sweep). Re-verified — the root cause was not what
> the symptom suggested.** The cap class was **present in the markup and silently dead**: Tailwind
> **3.4**'s bare `[--var]` shorthand (auto-wrapped in `var()`) was **removed in v4**, so the utility
> emitted a `max-height` whose value was the property *name*, which the CSS parser dropped —
> leaving `max-height: none`. The measurement below was right; the declaration never did anything.
>
> **`tester` verification, independent of `frontend`'s:** (a) the **built production CSS bundle**
> now carries `max-height:var(--radix-dropdown-menu-content-available-height)` with **zero**
> remaining bare `prop:--radix…` declarations; (b) at 1280×720 the cap resolves to a px value, the
> menu box ends within the window, `scrollHeight > clientHeight` so it genuinely scrolls, and every
> one of the 14 items is brought into view when focused; (c) `ff1-repeating-groups.spec.ts` is
> **9/9** — FF1-2 went **3.3 min timeout → 6.3 s**, FF1-7 **3.7 min → 7.1 s**, the file **8.2 min →
> 57 s**.
>
> **Guarded so it cannot return silently: `e2e/ff2-matrix.spec.ts` FF2-11**, which asserts the
> **computed** `max-height`, the geometry at 1280×720, real internal scrolling, and
> focus-brings-into-view across all 14 items — then opens a Matrix item by mouse.
> **Mutation-proven:** neutralising the declaration in the built CSS bundle turns FF2-11 red
> (`max-height nunca resolveu para um valor`); bundle restored byte-for-byte, green again.
> `e2e/builder-dialog-ui.spec.ts` did **not** catch this and now says why: it asserted
> `overflow-y` (genuinely present — and inert without a cap) plus last-item clickability at a tall
> viewport where the menu happened to fit. **Asserting a class is present is not asserting it
> works** — this bug's whole shape was a correct-looking class emitting nothing.
>
> ⚠ **Lesson recorded for `qa` and for FF-3+: Tailwind v4 scans `e2e/` as source, comments
> included.** A utility class named in a comment mints a real selector into the production bundle —
> the old comment at `e2e/builder-dialog-ui.spec.ts:229` was shipping ~90 bytes of dead
> `max-h-[--radix-…]` CSS and would read to a grep as an unfixed site. Both that comment and
> `frontend`'s fix comment are now prose with no code sample. **No utility-class literal belongs in
> a comment anywhere under `src/` or `e2e/`.**

*Original report, kept for the record:*

**Filed by `tester` 2026-07-27** (FF-2 test pass). Found by triaging two FF-1 specs that turned red
under FF-2, not by a spec that was looking for it.

*Repro (measured, not inferred — `matrix_fields` ON, staff_admin, a new empty form,
viewport 1280×720):* open **Adicionar bloco**. The `[role="menu"]` renders **909 px tall with
`max-height: none`**, from `y=273` to `y=1182` — **462 px past the bottom of the window**.

| Fact | Measured |
|---|---|
| items whose `bottom > innerHeight` | **7 of 14** — Hora · Texto explicativo · Imagem · **Matriz** · **Matriz de risco** · Grupo · Grupo repetível |
| page scroll while the menu is open | **locked** — `body{overflow:hidden}`, `data-scroll-locked="1"`, `window.scrollBy(0,400)` moves `scrollY` by **0** |
| menu's own scroll | **none** — `overflow-y:auto` but `scrollHeight <= clientHeight`, because nothing constrains the height |
| keyboard escape hatch | **none** — 14×`ArrowDown` lands focus on an item at `bottom 728` with `withinViewport: false`; nothing scrolls it in |

So the two block types FF-2 exists to ship cannot be selected at all on a common laptop viewport,
by mouse **or** by keyboard (violates CLAUDE.md §8's keyboard-accessibility bar).

*Expected:* every offered block type is reachable — the menu is bounded (e.g.
`max-h-[var(--radix-dropdown-menu-content-available-height)]` + `collisionPadding`) and scrolls.
*Actual:* the menu grows unbounded past the viewport and neither it nor the page will scroll.

*Attribution, stated precisely.* The missing `max-height` is **pre-existing** — with
`matrix_fields` **OFF** the same menu is **760 px / 12 items** and already puts 5 items off a
720-px viewport. FF-2 adds **+149 px** (a separator, the "Matrizes" label and 2 items), which is
what pushes the bottom group past viewports that previously fit. **FF-2 is the trigger, not the
root cause**, and both halves need the same fix.

*Regression evidence (deterministic, flag-toggled on the live DB, three flips):*
`e2e/ff1-repeating-groups.spec.ts` **FF1-2** and **FF1-7** fail on
`locator.click … element is outside of the viewport` (retry-until-timeout, 3.3 min / 3.7 min) with
the flag **ON**, and **FF1-2 passes in 17.6 s** with it **OFF**. Both are FF-1 specs at their own
1280×1400 viewport — the menu clears 1400 px only until the trigger sits lower on a page that
already has blocks. `e2e/phase5-wizard.spec.ts` is unaffected (12/12).

> ⚠ **This will surface in the full `e2e:prod` gate as two FF-1 reds with zero connection errors** —
> i.e. NOT the infra class the standing caveat covers. Triage them here, not against the flaky
> baseline.

#### 🟢 BUG-FF2-005 — two source files carry RAW NUL BYTES, so git treats them as BINARY and their diffs are unreviewable · MINOR/review-blindness · owner `frontend` · OPEN

**Filed by `tester` 2026-07-27**, found while orienting on the new dashboard surface — `git diff
--stat` reported `matrix-distribution-card.tsx | Bin 0 -> 7486 bytes` instead of a diff.

*Cause:* a composite map key is built with a **literal NUL byte** typed into the source rather
than the escape `\u0000`:

```
const countAt = new Map(cells.map((c) => [`${c.rowCode}<NUL>${c.colCode}`, c.count]));
…
const count = countAt.get(`${row.code}<NUL>${col.code}`) ?? 0;
```

*Not a live defect* — both sites carry the same byte, so the lookup works, and choosing NUL as a
separator is sound (an axis code is a `[a-z0-9_]` slug and can never contain one). **Three
consequences make it worth fixing anyway:**

1. **`qa` cannot review this file.** Git classifies it as binary, so the phase diff shows
   `Bin 0 -> 7486 bytes` — a file that renders the FF-2 dashboard is structurally invisible to
   diff review. This repo has a documented history of review-blind defects.
2. **It fails SILENTLY if it degrades.** The separator must be byte-identical at both sites; an
   editor, a copy-paste or a lint autofix that strips control characters would break only ONE and
   every lookup would return `?? 0` — a distribution table of all zeros, with no error anywhere.
3. Text tooling (grep, `file`, patch) mis-handles it — `file` reports `data`, and the `Read` tool
   renders the NUL as a **space**, so reading the file suggests the separator is `" "`. Only a
   byte-level check shows what is really there.

*Fix:* write the escape (`\u0000`) instead of the raw byte — identical at runtime, file stays text,
diff stays reviewable.

⚠ **Not FF-2's invention: `src/components/safety/rca/whys-panel.tsx` has the same idiom**
(`.join("<NUL>")`, from `c4e20b3`, Phase 14) and is likewise binary to git. Both are the only
non-`favicon.ico` files under `src/` or `e2e/` containing a NUL, so the sweep is complete. Worth a
one-line convention rather than two point fixes.

#### ✅ BUG-FF2-004 — an axis code minted from an accented label renders mangled in the editor that deliberately SHOWS it · MINOR/cosmetic · **PO-ruled a bug; fixed in `fbada14`** · **CLOSED 2026-07-27, re-verified by `tester`**

> **Re-verified and closed.** `ff2-matrix.spec.ts` is **11/11** against a prod-standalone build of
> committed HEAD, with the five repinned regexes now asserting the folded ASCII slugs
> (`higienizacao_das_maos_…`, `nao_conforme_…`, `provavel_…`). The pins are the guard: a future
> change to the shared slugger is now a deliberate one.

> **Status, precisely.** The PO overruled the "pre-existing, so pinned as-is" disposition below and
> ruled it a bug; `fbada14` makes `slugifyLabel` **delete** NFD combining marks instead of
> collapsing them to `_`, so `Higienização das mãos` mints `higienizacao_das_maos`. My five pins in
> `e2e/ff2-matrix.spec.ts` are updated to the new output (**four in FF2-1, plus a fifth in FF2-2 —
> `prova_vel` → `provavel` — that was not in the hand-off list and would have gone red**). Swept
> `e2e/`, `src/`, `supabase/seed.sql` and `supabase/tests/` for other mangled-slug expectations:
> **none**, and `option-code.test.ts`'s remaining `c_a_o…` strings are correct (its underscores come
> from spaces, and its `resolveOptionCodes` case deliberately preserves a LEGACY code verbatim).
> **Status stays OPEN until I have re-run the specs** — a bug closes only after re-verification, and
> the DB is `backend`'s during Wave 3.
>
> 🔑 **The lesson, recorded because it cuts against my own instinct.** Pinning current behaviour
> *because it is pre-existing* is a bet that the behaviour is **correct**, and that bet can be lost
> to a **ruling** just as easily as to a regression. This is the mirror image of FF2-11's first
> draft, which pinned the old *symptom* (`no item's rect outside the viewport`) and went red on the
> **fixed** build. Same failure mode, opposite direction: a test can be wrong about the past as
> easily as about the future. The pin was not the mistake — the comment is what made this a
> two-minute edit instead of a red-bar mystery. **Pinning silently would have been the mistake.**

*Original report, kept for the record:*

*Repro:* author a matrix, add a row labelled `Higienização das mãos`. `MatrixAxesEditor` prints the
immutable identity as `código: higienizac_a_o_das_ma_os_yi4a1c`.

*Cause:* `slugifyLabel` NFD-decomposes, then collapses every non-`[a-z0-9]` run to `_` — so an
accent's combining mark becomes a `_` rather than being dropped (`ção` → `c_a_o`). Shared with
option codes and `question_key`s, so it is **pre-existing behaviour, not an FF-2 bug** — but FF-2 is
the first surface that **shows a code to the author on purpose** (ADR 0089 ruling 4: "the code is
SHOWN … because an author who can see the identity understands why relabelling is free"). A
mangled identity undercuts the reason it is shown.

*No data risk* — codes are opaque and stable; only legibility suffers. Fixing it means stripping
combining marks before the `_` collapse, which **changes minted codes platform-wide** and so is a
PO call, not a tester call. Pinned as-is by `e2e/ff2-matrix.spec.ts` (FF2-1, FF2-2) so a future
change to the slugger is a deliberate one.


## Live-PROGRESS block, rotated out 2026-07-28 at the FF-3 Record


QA **APPROVED** (r2, after CHANGES REQUESTED at r1) · human-approved · flag `matrix_fields` **ON**
(gate flip `20260830001200`) · merged to `main`. **Remote `db push` NOT done** (local only, as every
S-phase — user-gated). **36 commits · 16 migrations `20260830000000`–`20260830001500`.**

**Full record → [ff-2-matrix-risk-matrix.md](docs/progress/ff-2-matrix-risk-matrix.md)** (the four PO
rulings, all 13 defects with repro/fix, the door-parity sweep, every mutation proof, the gate triage).
Reviews: [r1](docs/reviews/ff-2-review.md) · [r2](docs/reviews/ff-2-review-r2.md).

**Final bar:** pgTAP **139 files / 4061 / PASS** (clean reset) · Vitest **593/593** · lint **0/0**
(eslint + the new `[--var]` guard) · `next build` ✅ · migrations **216 == 216** · `e2e:prod` green
for FF-2.

**Shipped:** radio-grid cell contract (`UNIQUE (answer_id, row_id)`), `weight` on both axis tables
with **server-derived** `risk_score`, `required` = every row answered (flat **and** per-instance),
axis `code`s immutable by trigger; builder axes/bands editors; wizard grid + severity×likelihood
picker; sign-off, submission **and** dashboard cell-unit/risk surfaces (both follow-ups were pulled
into gate scope by PO ruling, so the phase ships its full ADR scope).

> ⚠ **Two rules this phase paid for, binding on FF-3 / FF-5.**
> 1. **A new door or policy must carry EVERY arm its sibling carries** — proven as a table, not
>    asserted. Missed **four times in one phase**, each in a different direction (a DEFINER gate
>    *stricter* than the RLS it replaced; a writer door narrower than the `answers` policy; SELECT
>    policies missing the corrector arm; axis tables missing the targeted arm). Keystone:
>    `272_ff2_door_parity.sql`.
> 2. **`form_item_validations` (FF-3) and `answer_references` (FF-5) are missing the targeted and
>    correction arms**, deliberately unfixed while write-inert. **Their writers landing is when that
>    stops being true** — handed forward the way FF-1 handed FF-2 its P0-1 correction-copy obligation.



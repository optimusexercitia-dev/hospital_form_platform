# FF-3 — Validation Engine (`item_validations`) · COMPLETE 2026-07-28

Rotated out of PROGRESS.md at the §6 Record step. ADR
[0090](../decisions/0090-ff3-validation-engine.md) (+ Amendments 1–4, O-1…O-6) ·
review [ff-3-review.md](../reviews/ff-3-review.md) (r1 CHANGES REQUESTED → r2 APPROVED) ·
backend surface [backend-state.md §FF-3](../backend-state.md).

**Commits** `59587cf`…`b993f23` on `ff/flexible-forms-program`. **8 migrations**
`20260901000000`–`…000800` (the last is the flag flip). Flag `item_validations` **ON**.

---

### 🏗️ FF-3 — Validation Engine (`item_validations`) · IN PROGRESS (started 2026-07-28)

ADR [0090](docs/decisions/0090-ff3-validation-engine.md) **accepted** — PO rulings taken
2026-07-28: rule vocabulary = the plan's set · coverage = scalars + repeating-group children
per-instance (matrix cells **out** of v1) · `error` blocks **submit only**, server-side.
Migration window `20260901000000`+ · SQLSTATEs from **`HC0P9`** (live high-water `HC0P8`) ·
pgTAP **274+** (highest today `273`). Worktree `ff/flexible-forms-program`, branch of the same
name, fast-forwarded to `main` @ `5e6b62d`; **216 == 216** at phase start.

> 🔎 **Catalog finding that changed the scope (ADR 0090 ruling 1).** The plan lists "group
> cardinality" as an FF-3 `rule_type`. It is **already shipped by FF-1** — `minInstances` in
> `app.response_required_complete`'s group arm, `maxInstances` in `add_group_instance` (the only
> `prosrc` in the catalog mentioning it), both via `app.item_cardinality(form_items.config, …)`.
> Adding it as a rule would create a second source of truth for one bound. **FF-3 ships six new
> rule types, not seven**, and the seventh is recorded as already-satisfied rather than dropped.

| # | Task | Owner | Status |
| - | ---- | ----- | ------ |
| B1 | Schema wave — `rule_type` allowlist CHECK + `item_type` coverage (a TRIGGER, not a CHECK — a CHECK cannot subquery `form_items`) · `form_items.required_if` (+ `input_vs_display` arm incl. `reference`) · flag seeded **OFF**, `seed.sql` flips it ON for local/E2E | `backend` | ✅ `20260901000000` |
| B2 | Door parity — `set_item_validations` DEFINER writer · targeted SELECT arm · `staff_admin` FOR-ALL write arm · `app.copy_version_children` validations block, same wave. Grant stays SELECT-only so K9 holds by privilege | `backend` | ✅ `20260901000100` |
| B3 | Evaluator pair — `app.eval_validation` + `evalValidation` in `src/lib/queries/validations.ts` + 47 golden vectors, **plus a real drift DETECTOR** (the pgTAP file embeds the fixture bytes; Vitest asserts they parse equal — FF-1 QA's INFO-4) | `backend` | ✅ `20260901000200` |
| B4 | Authority — `required_if` in **both** arms (visibility wins) · `HC0P9` gate in `submit_response` · `get_response_validation_errors`. The gate and the read path share `app.response_validation_errors`; the legacy `assert_item_bounds` lane was extracted into it so the list can never omit what the gate blocks on | `backend` | ✅ `20260901000300/400` |
| B5 | Operator authorability — `app.is_valid_condition` widened to the four F3 operators; the `value` requirement relaxed for the two unary ones BY NAME (not globally) | `backend` | ✅ `20260901000500` |
| B6 | pgTAP `274_ff3_validations.sql` — **70 assertions**, all 8 ADR-0090 keystones, each mutation-proven (23 mutations run, red output recorded). Re-pins: `209` §B **+4** (the `required_if` freeze on containers/display/`reference`, with a positive twin) and `272` **§S +3** (a TARGETED respondent READS validation ROWS — 274 §C can only prove the policy EXISTS, which ETH·E1 established is a different claim). Also **`20260901000600`**: publish-time validation of `required_if` | `backend` | ✅ **4138** tests PASS |
| F1 | Builder — rules editor (type/config/severity/pt-BR message) + `required_if` authoring via the condition builder + the new operator pickers | `frontend` | ✅ **`5c8c14b` + `2254227`** — lint 0/0 · tsc · Vitest 697 · `next build` |
| F2 | Wizard — inline error/warn from the TS twin, per instance; submit blocked on error; warn badges in review | `frontend` | ✅ **`609ae63`** + marker fix **`5b17b4e`** — lint 0/0 · tsc · Vitest **725** · `next build` |

> **F1 ✅ (`5c8c14b` + `2254227`).** Rules editor as a separate dialog off the block card
> (`ValidationsDialog` + `ValidationRulesEditor`), mirroring `MatrixConfigDialog` for the same two
> contract reasons: the writer is keyed on an existing `form_items.id` that "add" mode lacks, and the
> write is **REPLACE and wholesale** with no `code` to match on — so one piece of state owns the whole
> list, seeded from `item.validations`, mounted only while open, with a destructive save surfaced
> explicitly ("N regras serão removidas") instead of just looking like a shorter list. The type picker
> offers only what `isValidationRuleAllowed` permits, and the card resolves the parent's **TYPE** (not
> its `isChild` boolean) so `unique_within_group` is never offered inside a plain `group`.
> `required_if` authoring rides a third `ConditionBuilder` context, `required`, emitting a **single
> bare** condition — a third context rather than a boolean prop on a shared control. The existing
> `required` checkbox wire contract is untouched; the interaction is explained in copy.
>
> **Unary operators now offered on EVERY target type**, after backend fixed both publish assertions.
> Re-verified through `public.validate_visible_when` on a **cloned draft** — a SECTION `visible_when`
> *and* an ITEM `required_if`, both `is_empty`/`is_not_empty` on a **choice** target, the exact arm
> that raised `42883` before — plus a negative control proving a bogus operator is still refused
> (`23514`). Rolled back; nothing mutated. `contains`/`not_contains` remain **deliberately unpickered**
> (lead ruling (A)); the reason is recorded at the picker so it does not read as an oversight.
>
> **F2 ✅ (`609ae63`).** Rules + `required_if` evaluate through the TS twin as a **separate pass**
> beside the existing required/bounds validators — an optional answer-map param on the old signatures
> would have failed **open** (a caller that forgot it stops enforcing `required_if` while still looking
> validated). Feedback is live, derived during render; safe because an empty value is satisfied on both
> sides of the mirror, so an untouched field never accuses anyone. Placement is per instance on the
> existing `${instanceId}:${itemId}` key, so a violation in repetition 2 leaves repetition 1 alone;
> `unique_within_group` takes peers from each peer's **own** instance map, never the overlay, or a blank
> row would collide against an unrelated top-level answer under the same `question_key`. `warn` never
> uses the `error` channel — that channel drives `aria-invalid`, and marking an input invalid for a rule
> the server accepts misinforms assistive tech; warnings are a polite live region inline and a labelled
> badge list in review. An `HC0P9` refusal places `validationErrors` per field/instance **and navigates
> to the first one**; live errors merge UNDER the server's so an authoritative refusal is never
> overwritten by a recomputed one (that would hide a real SQL↔TS disagreement). Author text is rendered
> as TEXT everywhere (Rule 7).
>
> **Mutation-proven guards (4 mutations, file restored byte-for-byte each time).** Coverage filter
> neutralized → 5 red · the every-rule pre-flight loop reverted to its first-draft-only bug → 2 red ·
> the instance dimension dropped from the error key → 3 red · the empty-instance prune removed → 1 red.
> ⚠ That last one was **VACUOUS on first write**: a bounds rule is satisfied by an empty value under
> *both* readings, so it proved nothing. Rewritten around `required_if` — the only rule that fires ON
> emptiness — plus a positive twin so it cannot be vacuous from the other direction either.
>
> ✅ **D1–D5 all landed and independently re-verified** (not taken on backend's word): the pure module
> is genuinely server-free (`next build` is the proof), `Item.requiredIf`/`Item.validations` arrive
> FK-hinted, `requiredIf` rides the item FormData, `validationErrors` is on both submit paths, and
> `itemValidationsEnabled()` exists. The **P0 I filed in `20260901000700` is fixed** — all four call
> sites now pass the operator and the previously-`42883` version validates clean.
>
> ✅ **Marker fix — lead-ruled in scope, done (`5b17b4e`). The frontend surface is now FINAL for `tester`.**
> An item mandatory only through `required_if` showed no marker and announced itself as **optional** —
> the harmful direction of the same argument that kept `warn` off `aria-invalid`. `InputItem` gains
> `requiredNow`, resolved per instance and feeding the SAME `required` variable the static flag fed, so
> the marker's **DOM shape is unchanged** (no selector moves) and only its input became dynamic;
> omitting the prop falls back to `item.required`, so read-only/review/sign-off contexts are untouched.
>
> ⚠ **`aria-required` did not exist anywhere in the wizard before this** — `required` drove only the
> visual asterisk, so required-ness was never announced for ANY item, statically-required ones
> included. That was a pre-existing a11y gap the ruling surfaced. Added via `useFieldIds` (the five
> single-control fields) and on the two group fieldsets. **One arm would have been missed silently:**
> `DateTimeItem`'s TIME branch hands its a11y attributes to `TimeField` individually instead of
> spreading `controlProps`, so `aria-required` alone would have been dropped there — routed through
> react-aria's `isRequired` instead. Found by enumerating all seven controls rather than trusting the
> spread (the "every sibling arm" rule, applied to a render tree instead of a policy set).
>
> Effective required-ness is resolved ONCE, on `RuleFeedback.requiredNow`, in the walk that already
> computes it — recomputing it in the render tree would be a second implementation of the same
> question, free to disagree with the one that blocks submit. **Mutation-proven:** driving the marker
> from the static flag (the exact defect fixed) turns **5** red, including the two that assert the
> marker independently of the error — a required field that IS answered must still be marked, so one
> assertion cannot cover both. Restored byte-for-byte.

> ✅ **Boundary audit — matrix + risk_matrix `required_if` (`45563c7`).** The lead found the marker
> still static on the two render paths outside `input-item.tsx`. It was the **visible symptom of a
> deeper gap**: both walks gated on `isInputItem`, which is deliberately FALSE for the matrix types
> (their answer is not a scalar in `answers.value`), so the two types were skipped **outright** —
> `required_if` on a matrix was never evaluated client-side at all. Meanwhile
> `form_items_input_vs_display` permits it on both (verified from `pg_constraint`, quoted below) and
> `app.response_required_complete` calls `app.item_is_required` with no `item_type` filter, so it
> genuinely blocks submit. Both walks now gate on `isAnswerableItem`; presence uses the ROW-COMPLETE /
> both-halves reading via a shared `itemAnswered`, so `required_if` cannot acquire a second notion of
> "answered".
>
> **The enumeration, derived from the CHECK rather than from a file** — 10 item types permit
> `required_if`; the 5 excluded ones are forced `required_if IS NULL`:
>
> | `item_type` | renders via | reads effective required-ness |
> |---|---|---|
> | `multiple_choice` · `dropdown` · `checkbox` | `ChoiceGroup` / `DropdownItem` / `CheckboxGroup` (`input-item.tsx`) | ✅ |
> | `free_text` · `short_text` · `number` | `FreeTextItem` / `ShortTextItem` / `NumberItem` (`input-item.tsx`) | ✅ |
> | `date` | `DateTimeItem` date branch | ✅ |
> | `time` | `DateTimeItem` **TIME** branch | ✅ (hands a11y attrs over individually — would have dropped `aria-required` alone) |
> | `matrix` | **`matrix-grid.tsx`** | ✅ **(this fix)** |
> | `risk_matrix` | **`risk-matrix-picker.tsx`** | ✅ **(this fix)** |
> | `reference` · `group` · `repeating_group` · `section_text` · `image` | — | n/a — CHECK forces `required_if IS NULL` |
>
> **An a11y correction the lint gate caught, and it was right:** `aria-required` is invalid on
> `role="radio"`, and `matrix-grid`'s wrapper is deliberately `role="group"` (one radio group **per
> row**), which does not support it either. Required-ness is announced through the group's
> **description** instead — said once for the whole grid, driven by the effective value.
> `risk-matrix-picker`'s wrapper IS a `radiogroup`, so `aria-required` is valid there.
>
> **Mutation-proven twice, files restored byte-for-byte:** reverting both walk gates to `isInputItem`
> → **6 red**; reverting all three render fallbacks to the static flag → **11 of 15 red** in the new
> render-level suite, the 4 survivors being exactly the "falls back when the prop is absent" cases
> that must stay green. ⚠ **That render suite exists because the walk-level assertions CANNOT fail if
> a component goes stale** — the same vacuity trap as the prune test, caught before shipping this time.
>
> ✅ **Ninth path fixed — review only (`a4b95e7`), per the lead's ruling.**
> `AnswerSummary` gains `requiredNow?: boolean` with a static fallback; review threads the
> effective-required set to it (bare ids at top level, `${instanceId}:${itemId}` in a repetition —
> the SAME keying the fill side uses, so one set serves both). Matrix items review THROUGH
> `MatrixGrid`/`RiskMatrixPicker`, so those get it too and review agrees with fill for all 10 types.
> The set is collected in the walk that already crosses every visible section for the review
> warnings — one pass, both facts.
>
> **Scope: the review call site only.** The six historical consumers (`submission-detail-view`,
> `phase-answers-readonly`, `instance-answers-readonly`, `review-and-sign`, two tests) render
> SUBMITTED records and keep the authored flag, untouched.
>
> ⚠ **Correcting my own earlier reasoning, per the lead — it changes O-5's framing.** I argued the
> historical views have "no live answer map to resolve against". **They do:** a submitted response
> carries a **FROZEN** map, which makes effective required-ness *deterministic and reproducible*
> there — more so than during fill. So static required-ness on those six is **not demonstrably
> correct**; it is cheaper and currently harmless. "Was this field mandatory for this record" is
> computable from the record itself. Logged as **O-5, open** — not closed as correct. The frozen map
> is what makes it tractable; the optional-prop-with-fallback shape is what keeps it cheap, so that
> shape stays exactly as is.
>
> **Mutation-proven:** reverting the review marker to the static flag turns **2** red, and the 2 that
> stay green are precisely the fallback cases that MUST stay green — they are the six historical
> consumers' contract. Restored byte-for-byte.
>
> **`next build` note:** this worktree's `.next/standalone` is held by the tester's prod-standalone
> server on `:3100`, so a plain build hits Windows `EBUSY`. Verified via an **env-gated `distDir`** to
> a scratch dir — inert without the env var, so a concurrent tester build was unaffected — then
> `next.config.ts` restored byte-for-byte and git-clean. **The tester's process was not touched**
> (shared-stack rule: one owner).

> ✅ **M-4 fixed + the CONTAINMENT axis enumerated (`e86c2c2`).** `GroupBlock` received neither
> `warnings` nor `requiredNow`, so a `required_if` item inside a plain `group` announced itself
> **optional** during fill while blocking *Próximo* and raising `HC011` at submit, and a `warn` rule on
> such a child was evaluated but never shown inline. Fill and review disagreed, since review already
> threaded it.
>
> **The lesson, in QA's framing:** the **item-type** enumeration was complete — ten types derived from
> `form_items_input_vs_display`, mapped to three render paths, verified programmatically — and the
> **containment** axis was never enumerated at all. *"Which item types can be required?"* and *"which
> containers relay required-ness?"* are different questions; only the first was asked. Fourth instance
> of this family in FF-3, and the first on this axis.
>
> **The containment table (every wrapper that renders answerable children):**
>
> | containment | component | relays `warnings` | relays `requiredNow` | lookup key |
> |---|---|---|---|---|
> | top level | `section-step.tsx` | ✅ | ✅ | bare `item.id` |
> | plain `group` | **`group-block.tsx`** | ✅ **this fix** | ✅ **this fix** | bare `child.id` (children answer at TOP LEVEL — ADR 0087 ruling 6) |
> | `repeating_group` instance | `repeating-group-block.tsx` → `InstanceCard` | ✅ | ✅ | `${instanceId}:${itemId}` |
> | review — top level | `review-screen.tsx` → `AnswerSummary` | n/a (aggregated panel) | ✅ | bare `item.id` |
> | review — plain `group` | `review-screen.tsx` → `ReviewAnswerList` (no `instanceId`) | n/a | ✅ | bare `item.id` |
> | review — repetition | `ReviewRepeatingGroup` → `ReviewAnswerList` (`instanceId` set) | n/a | ✅ | `${instanceId}:${itemId}` |
> | historical read-only ×4 | `submission-detail-view` · `phase-answers-readonly` · `instance-answers-readonly` · `review-and-sign` | n/a | ❌ **by design** | static `item.required` — **O-5** |
>
> ⚠ **The plain-group keying is the trap worth naming:** those children answer at TOP LEVEL, so the
> lookup is the BARE id — the same key `validateSectionRules` writes when it flattens `group` children
> into the flat pass, and the same treatment `app.response_required_complete` gives them. An
> instance-shaped key would look correct in a one-group form and drift the moment anything nested
> differently, so a test asserts an instance-shaped key does **not** match.
>
> **Mutation-proven:** reverting `GroupBlock` to forwarding neither prop → **3 red** (marker,
> `aria-required`, inline warning); the 3 that stay green are the negative cases that must. Restored
> byte-for-byte.
>
> ✅ **m-5a** — the `regex` pattern input had no `<label>`; it leaned on `<legend>Padrão</legend>`,
> which names the FIELDSET, not the control, so it reached assistive tech unnamed while *looking*
> labelled. ✅ **m-5b** — the pre-save error was a lone banner naming the rule by ordinal;
> `validateRuleDrafts` now returns `{ index, message }` and the message renders **inside** the
> offending rule's card (`role="alert"` + `aria-invalid`), banner retained for sighted scanning.
> ✅ **i-2** — the stale `HC0N5` note struck and corrected in place (fixed in `6196b16`).

> ⛔ **STILL OWED — a real click-through. Live UI verification was IMPOSSIBLE from this worktree.**
> The Browser preview tool's session is bound to the **primary checkout** (its processes run from
> `hospital_form_platform
ode_modules` + `...\.next`, not from `worktrees/ff/…`), it holds a cached
> `previewId`, and it ignored a `-p 3100` launch config across four stop/start cycles — so `:3000`
> serves the primary checkout on `main`, which does not contain FF-3 at all. Verifying there would have
> been worthless *and* misleading, and starting a server via Bash is disallowed by the role brief, so
> the escalation is deliberate rather than a skipped step. What WAS verified instead: the DB seam
> (gate acceptance of the exact emitted shape with negative controls; both publish arms end-to-end on
> a cloned draft), `next build` (the client/server boundary), and the mutation proofs above. **The
> untested surface is the rendered interaction itself** — the shield button, the dialog's REPLACE
> save, inline error/warn placement, and the HC0P9 navigation. `tester` owns it; FF-1's lesson is that
> exactly this seam is where a green bar misses three live bugs.

> 🔴 **THREE FINDINGS from B1–B6, all fail-OPEN, none catchable by tsc/lint/unit/build.**
>
> 1. **`app.validation_rule_allowed` returned NULL, not false**, for a top-level item
>    (`p_parent_item_type = NULL` → `NULL and true` = NULL). Every caller wrote
>    `if not allowed(...)`, and `not NULL` is NULL, so the `if` never fired and a forbidden
>    rule/item pair was **accepted**. Same family as FF-2 defect 1 — a three-valued predicate
>    read as if it were two-valued. Caught by keystone **B8** on its first run
>    (`caught: no exception`). Fixed with an outer `coalesce(..., false)`; `app.eval_validation`'s
>    regex arm and `app.item_is_required` were hardened the same way.
> 2. **`validate_visible_when` never validated `required_if`.** A top-level item whose
>    `required_if` points at a repeating-group child resolves that key against the top-level map,
>    where it is absent → the item is **silently never required**. Nothing raises, nothing logs,
>    and a test that only asks "does an unmet `required_if` block" passes. Fixed in
>    `20260901000600` by generalising the item loop over both conditional columns; keystones
>    K1–K3.
> 2b. **One VACUOUS keystone of my own, caught by the mutation sweep.** An earlier `I4`
>    claimed the `not app.instance_is_empty(...)` filter on the peer-map query, and stayed GREEN
>    with that filter removed. It cannot be observed: an empty instance holds no non-null value,
>    so it can never be a peer. Replaced by an `I4`/`I5` pair (empty → 0 violations; re-fill the
>    same value → 2 again) that a peers mutation does turn red, and the unobservable filter is
>    now recorded as unobservable in the file instead of being falsely claimed.
>
> 3. **`HC061` is raised by TWO unrelated conditions** — `app.assert_item_bounds` (a field bound)
>    and `app.compute_case_phase_result` (a MANUAL phase with no result) — and `submitResponse`
>    mapped it to *"Selecione o resultado da fase"*. Reachable by ORDINARY USE: type 2 characters
>    into a `minLength: 5` field and you are told about a phase result. Pre-existing; fixed here
>    (prefer the DB message) because FF-3 extracted that very lane. ~~Adjacent, NOT fixed:
>    `HC0N5` (FF-1 min-instances) still falls to `MESSAGES.generic` in both submit switches.~~
>    **STALE — corrected (QA i-2):** `HC0N5` *was* fixed afterwards in `6196b16`
>    (`fix(ff-1): map HC0N5 (min instances) in both submit switches`) and is mapped in both
>    `submitResponse` and `submitCasePhaseResponse` today. The note above described the tree at
>    the moment it was written and was never revisited.
>
> ⚠ **ADR 0090 §6's parity table is wrong on one cell**, corrected against `pg_policies`: the
> matrix tables carry **no** write policy (one SELECT policy each; their boundary is the
> SELECT-only GRANT + the DEFINER door). `form_item_options` is the outlier — it holds a full DML
> grant, so for it the FOR-ALL policy *is* the boundary. FF-3 took the **stricter** shape: both
> arms added per the ADR, grant left SELECT-only, and keystone **C5** pins both facts.

**Lead notes.** Contract-first: `backend` posts the typed stubs for
`get_response_validation_errors` + the TS validation twin before `frontend` starts F1/F2.
File ownership — `backend` owns `src/lib/queries/**` incl. the new evaluator module and
`conditions.ts`; `frontend` owns `src/components/forms/**` + `src/components/responses/**`.

> ⚠ **Session-limit interruption, 2026-07-28 (lead record).** All three teammates were terminated
> mid-work by an API session limit. HEAD at interruption: **`3a2d927`**; everything through F2 is
> committed and unaffected. **Backend died immediately before applying a mutation proof**, so the
> live catalog could not be trusted — the lead ran `supabase db reset` + the full pgTAP suite to
> restore catalog truth from migrations. Nothing was lost; two coherent partial diffs survived
> uncommitted:
> - `src/components/ui/field.tsx` — `frontend`'s `aria-required` plumbing on `useFieldIds`
>   (backward-compatible: omitted → attribute absent). **Caller wiring + the dynamic visual marker
>   are unfinished.**
> - `supabase/tests/274_ff3_validations.sql` — `backend`'s **§M mixed-severity keystone** (plan
>   78 → 81), asked for by `frontend`. Its rationale is the sharp one: narrowing the read path to
>   `severity='error'` already reds E4, and truncating it reds I2/I5, but **no existing assertion
>   sees a MIXED set** — E2's state holds only errors, E4's only warns — so a refactor suppressing
>   warns *while errors exist* passes every one of them. Same class as the `20260901000700` P0.
>   **Written but not yet mutation-proven or committed.**
>
> **Outstanding at interruption:** (1) the dynamic required marker + `aria-required` wiring
> [`frontend`, lead-ruled in scope]; (2) §M's Mutation A/B/C proofs + commit [`backend`];
> (3) **the FF-3 E2E spec — not started** [`tester`; no spec file exists yet]. The rendered
> interaction therefore remains unverified, which is gate step 2's whole purpose.
>
> ✅ **All three closed 2026-07-28.** Marker `5b17b4e`/`45563c7`/`a4b95e7` · §M `a88f74a` ·
> spec `7d8a92e`→`87f2e46`.

### 🧪 FF-3 gate step 2 — tester result: **19 / 19 green** (`87f2e46`)

Two rounds. **R1 = 16/18, NOT green**, two bugs filed; both fixed; **R2 = 19/19** with
`expected=19 reported=19` and `PIPESTATUS[0]` read directly, on a fresh reset (224==224, flag `t`,
token POST 200), prod-standalone rebuilt at `91f4931` and served from a scratchpad copy.
Neighbours **40/40** (`ff1` 9 · `ff2-matrix` 11 · `phase5-wizard` 12 · `phase4-builder` 8), each
on its own server. FF3-6/6b are **the same tests that were red before the fix and green after** —
the history is the cover, not an assertion written to match the fix.

**BUG-FF3-002 — MAJOR, phase-blocking (fixed `91f4931`).** The unary operators were offered by
every condition picker and could not be saved. **The reported cause was not the cause, twice
over** — `tester` and the **lead** both fingered `if (!('value' in rec)) return false`; the actual
rejection was one line earlier (`CONDITION_OPS` was still the pre-F3 **seven**), and the blamed
check never fired at all because `condition-builder.tsx:204` emits `value: null`, a *present* key.
`backend` **tested the prescribed fix against reality before complying, found it inert, and fixed
the real cause** — mutation-proven both ways. The durable half: the evaluator pair has had golden
vectors since ADR 0005, the **validator pair had none**, which is exactly why a one-sided widening
survived pgTAP (SQL correct), tsc/lint (TS well-formed) and a DB-level UI check (below the seam).
27 vectors now drive both engines (`condition-shape.ts` + `275_condition_validator_parity.sql`).

**BUG-FF3-001 — MINOR (fixed `8d53b3d`).** Clearing now keys on the symmetric rule's participant
set. Trade-off accepted + recorded under ADR 0090 O-6.

### ✅ FF-3 gate steps 1–3 COMPLETE — awaiting human approval (step 4)

**Final bar at `9557d1f`**, each re-run by the lead on a clean tree: pgTAP **141 files / 4167 PASS**
(fresh reset) · Vitest **814/814** · lint **0/0** · typecheck clean · `next build` **EXIT=0**
(exit code captured, not grepped) · migrations **225 == 225**.

**Tester r2: FF-3 spec 25/25 · neighbours 62/62** (`phase4-builder` 8 · `form-builder-enhancements`
15 · `ff1` 9 · `phase5-wizard` 12 · `wizard-others-ux` 7 · `ff2-matrix` 11). **QA r2: APPROVED**
(0 BLOCKING · 1 MAJOR-coverage now closed by `13e4664` · 4 MINOR · 3 INFO) → [review](docs/reviews/ff-3-review.md).

**Final full `e2e:prod` (`BATCH_SIZE=4`, RESET+REBUILD): 794 passed · 16 of 19 batches completely
clean · every batch `accounted N/N` (910 of 914 collected).** The three failing batches are the
documented collapse, triaged not assumed: b7 = **90** connection errors, b14 = **84**, b2 = 4 —
and b2's two failures are `net::ERR_CONNECTION_REFUSED` on `page.goto`, not assertions.
**Zero real failures.** b7 contains `ff3-validations.spec.ts`, exactly as `tester` predicted: that
file has outgrown one standalone server (three full-file runs collapsed at 8/11/9 failures, all
`ERR_CONNECTION_REFUSED`, with 9.9 GB free; two halves on separate servers run clean).

> ⚠ **Triage tell worth keeping:** one collapse run **failed test 1, recovered for 14, then died at
> 16** — so **the first failure is not the collapse point**, which is precisely the inference that
> would mislead a triage into blaming the first failing spec.

**`tester` rejected the "E2E cannot reach M-1/M-2/M-4" claim** that `qa`, `backend` and the lead had
all accepted, and wrote specs for all three (**FF3-17** drives `submit_response` directly; **FF3-18**
calls the read RPC as a rede-B outsider). *Below the UI is not unreachable.* No coverage gap recorded.
**FF3-17 was vacuous on first write and passed** — it refused with `HC0N5` (FF-1's `minInstances`),
not the `required_if` arm, because `handleNext` returns before `persistSection` so the repetition was
simply empty. Caught only by printing the refusal payload. **A refusal is not evidence until you read
which refusal** — the `CONDITION_OPS` misattribution one layer down.

### 🚦 FF-3 gate step 2 — earlier full-suite history (superseded by the run above)

Three full runs (`RESET=1 REBUILD=1`) plus two targeted runs. **Every one of the 908 collected
tests passed under a fresh server, with full `accounted N/N`** — but **no single full run went
green**, and that limitation is environmental and reproducible. Stated plainly so QA and the PO
read the same thing.

| run | result |
|---|---|
| 1 | 630p / 140f / 130 dnr — **2 real defects**, both in `e2e/` (decision-#9 stale contract; BUG-E2E-001 seed-eating cleanup). 0 app regressions |
| 2 | 776p / **0f** / 0 dnr — RED only on b10 `exit127, 0 of 125 ran` (transient harness fault; batch never executed) |
| 3 | 742p / 88f / 69 dnr — **b1–b9 + b13 all 0-failure, conn_errors=0**; every failure in b10/b11/b12 |
| b10 targeted | **125/125, accounted 125/125, GREEN** |
| b11+b12 targeted (`BATCH_SIZE=3`) | **126/126, accounted 126/129 (3 skipped), GREEN** |

**Why the residual is environmental, evidenced not asserted.** Failures track connection-error
density exactly — b1–b9/b13 = **0**, b10/b11/b12 = 36 / **135** / 2 — the server log carries
`Error: The destination stream closed early`, and b11's first failure is a **150 s timeout on a
click** where Playwright reports the element *"visible, enabled and stable"*. No `supabase_vector`
container exists here, so that known 502 path is **not** in play; DB and auth stayed healthy. It is
the Next standalone server degrading late in a ~45-minute process.

> 🔴 **Second coordination finding (QA r2, 2026-07-28): the E2E gate and a catalog audit cannot
> share one local database — and this is the LEAD's sequencing error, not a teammate's.** I ran
> `qa` and `tester` in parallel on the single local stack. The tester's run dropped
> `pgtap`/`test_helpers` mid-audit, so six of QA's mutation runs aborted at `select plan()` and its
> harness — counting only `^(ok|not ok)` lines — read **0-of-0 as a pass**. That is precisely the
> vacuity this phase was grading for, committed by the reviewer, caused by the lead. QA caught it
> itself, pinned a per-file assertion-count guard, and re-ran every r2 number post-fix. A later
> `test:db` FAIL/3693 was the same contamination (`140_patient_safety`, `145_pqs_membership`,
> "planned N, ran 0" cascades, **no FF-3 file among them**), not a regression.
> **Fix: serialize audit and gate, or give them separate stacks.** Belongs with the harness split.

> 🔴 **Finding for the PO: the suite has outgrown a single gate process.** The collapse is
> **cumulative over run time, not per-server size** — the identical b11 specs fail at position 11
> of 13 and pass at position 1 of 4. So a smaller `BATCH_SIZE` makes it **worse** (more restarts,
> longer wall clock), which is why no fourth full run was attempted. The gate needs splitting into
> two sequential processes, or more machine headroom. **This is not FF-3's defect and it will
> block every future phase's gate identically.**

> ⚠ **Two false reports worth keeping, both from scraping rather than executing.** The "no message
> at all" symptom was a **probe regex** (`/A condição/` vs the real *"Condição de aparência
> inválida."*), not a product defect — no `frontend` dispatch was needed. And three specs on one
> long-lived server scored 17/32 with **all 15 failures `net::ERR_CONNECTION_REFUSED`** (count
> matching exactly, after `destination stream closed early`) — the Windows monolith collapse
> `e2e:prod` restarts per batch to avoid. **A tester's multi-spec convenience run reproduces it.**

> 🔴 **FF-3 inherits two obligations from FF-2, both binding.**
> 1. **`form_item_validations` is missing the targeted and correction policy arms** (deliberately
>    unfixed while write-inert). **FF-3's writer landing is when that stops being true** — the same
>    hand-forward FF-1 gave FF-2 for its P0-1 correction-copy obligation, which FF-2 then found had
>    already bitten three surfaces.
> 2. **The door-parity rule:** a new door or policy must carry **every** arm its sibling carries,
>    proven as a **table**, not asserted. FF-2 missed it four times in one phase, each in a different
>    direction. Keystone: `272_ff2_door_parity.sql`.
>
> Also worth reading before FF-3 writes its evaluator: FF-2's **`app.item_required_satisfied`** is now
> the single required-presence predicate for **every** item type platform-wide, and FF-2's QA showed a
> keystone over it needs **both** directions (`select true` must turn the positive arm red, not just
> the blocking one).

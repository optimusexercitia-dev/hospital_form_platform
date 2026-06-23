# QA Review — Form Builder Enhancements (mini-phase)

**Branch:** `feat/form-builder-enhancements`
**Reviewed range:** app code `12a89fc..HEAD`; migrations `20260623120000_form_builder_enhancements.sql`, `20260623130000_signoff_observations.sql`; specs `e2e/form-builder-enhancements.spec.ts`, `supabase/tests/{20_conditions,51_item_visibility_validation,52_submit_item_visibility,80_signoffs}.sql`.
**Date:** 2026-06-23
**Reviewer:** `qa`

## Verdict: CHANGES REQUESTED

The security / RLS / data-integrity surface is **clean** — the relaxed CHECKs are
supersets, immutability and Rule 11 hold, the single-door sign-off read is byte-identical,
and the SQL↔TS evaluator pair agree with no drift. Build is green (typecheck 0, lint 0,
re-verified locally) and the E2E gate is green with 0 net-new failures vs the `main` baseline.

However, one **core spec deliverable is delivered but functionally incorrect**: per-question /
section conditions that TARGET a `number` input (plan capability #6, decision #7 — the new
`gt/gte/lt/lte` ops) silently mis-evaluate for any multi-digit / differing-magnitude
comparison, on EVERY surface (builder → wizard live show/hide → submit RPC stray-clear). The
existing tests miss it because the E2E condition flows use a *choice* target and the shared
numeric vectors feed JSON **numbers**, whereas the builder emits the target value as a
**string**. Per the phase-gate posture an unmet blocking requirement is CHANGES REQUESTED
regardless of how much else is correct. This is MAJOR (functional correctness), not an
RLS/immutability hole — fix is small and local.

---

## Findings

### MAJOR

**MAJOR-1 — Number-target conditions are persisted as a STRING value and silently
mis-evaluate (lexical compare) for multi-digit / differing-magnitude numbers.**
`src/components/forms/condition-builder.tsx:137-143` (`toCondition`) serializes a row's value
as `row.singleValue` — a raw **string** from the native `<input type="number">`
(`ValueControl`, L476-493). So a number condition is stored as
`{"question_key":"qty","op":"gt","value":"5"}` (string `"5"`, not JSON number `5`).

At evaluation, a `number` item's saved answer is a JSON **number** (`NumberItem` →
`onChange(n)`, `input-item.tsx:339-340`). Both evaluators compare numerically ONLY when *both*
operands are JSON numbers:
- TS `orderedCompare` — `src/lib/queries/conditions.ts:159` (`typeof answer === 'number' && typeof target === 'number'`);
- SQL `app.eval_condition` — `20260623120000_…sql:279` (`jsonb_typeof(v_answer)='number' and jsonb_typeof(v_target)='number'`).

A number answer vs a string target falls to the **text** branch, so e.g. `qty gt 5` with
`qty = 10` computes `"10" > "5"` → **false** (question wrongly hidden / its answer wrongly
stray-cleared on submit). Verified by reproduction: `gt 5 / answer 10` → `false` (WRONG);
`gte 100 / answer 90` → `true` (WRONG). The single-digit case (`7 > 5`) coincidentally passes,
which is exactly why AC-8 (choice target only) and `condition-vectors.json` (numeric-JSON
values) both miss it. SQL and TS agree (no drift) — they are *consistently* wrong.

Aggravating: publish-time `app.assert_condition_op_target`
(`20260623120000_…sql:534-542`) validates only the *target type* for ordered ops, not the
*value's* JSON type, so a string-valued number condition passes publish and then silently
mis-evaluates at fill/submit time. And `toDrafts` (`condition-builder.tsx:119`) reads back
`singleValue: typeof c.value === "string" ? c.value : ""`, so even a correctly number-typed
value would be dropped to `""` on a later edit — the builder's value model is string-only end
to end.

*Requirement violated:* plan §"Locked decisions" #7 + §"Condition engine" ("if both operands
are JSON numbers compare numerically") + capability #6 ("conditional appearance … over any
earlier answer"); ARCHITECTURE Rule 3 (the evaluator must produce correct results, vectors
must guard the real authored shapes).

*Suggested fix (small, local):* coerce a `number`-target value to a JSON number when
serializing — in `toCondition` (and mirror on read in `toDrafts`), using the row's target
`type`. Equivalently, normalize in `parseVisibleWhen` (`src/lib/forms/actions.ts:718`) /
`isValidCondition` and tighten `assert_condition_op_target` to require a numeric JSON value
for an ordered op on a `number` target (reject a string) so a malformed condition fails
*publish* loudly instead of mis-evaluating silently. Add a vector that exercises the builder's
real output (number answer vs the authored value, multi-digit, e.g. `gt 5 / 10 → true`,
`gte 100 / 90 → false`) to both `condition-vectors.json` and an E2E number-condition flow so
the gap is covered. `date`/`time` are correct as-is (string on both sides; ISO sorts
lexically) — no change needed there.

---

### MINOR

**MINOR-1 — `DialogContent` missing `DialogDescription`/`aria-describedby`
(`item-editor-dialog.tsx`, `section-meta-dialog.tsx`).** Pre-existing (predates this feature),
but `item-editor-dialog` is the central authoring surface here and Playwright logs the
recurring `Missing Description or aria-describedby for {DialogContent}` warning. Radix surfaces
the dialog body without an accessible description for screen-reader users. Low effort: add a
`<DialogDescription>` (or `aria-describedby` pointing at existing intro copy). Recommend fixing
the `item-editor-dialog` instance in this mini-phase (cheap MINOR before record, per the
team's stated preference); `section-meta-dialog` can be folded in or tracked. CLAUDE.md §8
(accessible inputs).

**MINOR-2 — Stale BE-1 stub comment in `serializeOptions`
(`src/lib/forms/actions.ts:638-643`).** The comment claims "the DB CHECK still only accepts
BARE STRINGS until the BE-2 migration relaxes it … a coloured option would fail the CHECK" —
but BE-2 (`app.is_valid_options`) has landed and `{label,color}` is now accepted. Behaviour is
correct (writes bare string when colourless, object when coloured); only the comment is
misleading. Trim it.

**MINOR-3 — `NumberItem` bounds hint not wired into `aria-describedby`
(`input-item.tsx:366-368`).** The `boundsHint` renders as a second `FieldDescription` with no
`id`, so it is not part of the input's accessible description; it is mitigated by also being
the `placeholder` (which AT may read). Wire it (e.g. append a bounds id to the field's
`describedby`) for parity with `question_explanation`. Cosmetic a11y.

---

### INFO

**INFO-1 — Dead server stub `questionConditionTargets(itemId)` throws
(`src/lib/queries/forms.ts:591-599`).** Left as a BE-1 contract stub
(`throw new Error('not implemented')`); the live caller (`item-editor-dialog.tsx:39,156`)
imports the *pure client* twin `questionConditionTargets(sections, sectionId, itemId)` from
`src/components/forms/condition-targets.ts`. The throwing export is unreachable but invites a
future mis-import. Either implement it or delete it (and drop it from the `conditionTargets`
doc block).

**INFO-2 — `form_items_options_shape` superset is data-dependent (not predicate-pure).** The
relaxed choice arm `app.is_valid_options(options)` requires every element be a
string-or-`{label,color}`; the prior arm required only `array & length>0`. It is a superset
*because all existing rows are bare strings* (proven by the clean `db reset` + backward-compat
run), not because the new predicate is weaker. Correct for this codebase; noted so a future
data shape (e.g. a numeric element) is understood to be newly rejected. The other three
relaxed CHECKs (`item_type`, `input_vs_display`, `form_sections_visible_when_shape`) are
predicate-pure supersets.

**INFO-3 — Pre-existing full-serial-suite contamination (~17–19 failures on BOTH branch and
`main`).** Confirmed by the lead's declaring run (branch 17 ≤ baseline 19; only 2
branch-unique titles, both proven flaky/contamination, not this feature). Per the spawn brief
this is a separate, pre-existing concern (phase13-saga class) — **not** a blocker for this
gate. Tracked here so it is not re-discovered.

**INFO-4 — FBE E2E builds its fixtures inside the seeded CCIH commission
(`COMM_A` / `/c/ccih`)** rather than a throwaway probe commission (cf. P13-005/006 isolation
lessons). The spec is otherwise hermetic (own draft/published forms via service role,
`purgeLeftoverState`, never mutates seeded Form A/B) and ran green at `--workers=1`. Acceptable
for this gate; consider hardening to a probe commission/users if FBE later joins the
full-serial gate matrix, to reduce shared-DB coupling.

---

## What was verified (passing)

**Requirements (plan capabilities + 12 locked decisions):**
- New input types `short_text` / `number` / `date` / `time` — schema (item_type +
  input_vs_display + options-shape arms), types (`InputItemType`+4, `INPUT_ITEM_TYPES`),
  builder labels, fill controls, read formatting. ✓
- Per-option colours on `multiple_choice` + `checkbox` **only** (dropdown excluded; native
  `<select>` renders label only — `input-item.tsx:481-487`); answer still stores the option
  **label** string; colours live inside `options` jsonb and ride the clone for free. ✓
- Per-question AND section conditional appearance via the **one** shared `ConditionBuilder`
  (decision #8); flat ALL/ANY groups; `gt/gte/lt/lte` added; legacy single round-trips. ✓
  (number value-typing is MAJOR-1.)
- Conditional item can't be required — UI (`item-editor-dialog.tsx:259-313` disables the
  toggle), server defence (`actions.ts:785-787` clears `required` when `visible_when` present),
  and DB CHECK `form_items_conditional_not_required`. ✓
- Hidden items skipped + answers stray-cleared on submit — `submit_response` forward pass
  (`20260623120000_…sql:690-704`) deletes the hidden item's answer (guarded by
  `app.in_submit_rpc`) and drops its key from `v_eff`. ✓
- number/date min/max — client (`validation.ts`, `input-item.tsx` min/max attrs) + server
  `app.assert_item_bounds` (HC061), enforced on **visible** items, **present** answer only. ✓
- Observations on every non-free-text input, optional, rendered on ALL read surfaces —
  wizard review/`answer-summary.tsx:44-49`, submission detail (`submission-detail-view.tsx`),
  sign-off review (`review-and-sign.tsx`, BE-8/FE-6). ✓
- Backward-compatible, additive migration, no flag, no data migration. ✓

**Security / RLS / data-integrity:**
- **Relaxed CHECKs are supersets.** `form_items_item_type_check` (6→10, ∪ new),
  `form_items_input_vs_display` (new types reuse the identical input-branch predicate; display
  branch byte-identical), `form_sections_visible_when_shape` (single→single|group;
  single-arm op set ⊇ old), all re-validate every existing row;
  `form_items_options_shape` superset confirmed (see INFO-2). New CHECKs
  (`config_shape`, `visible_when_shape`, `conditional_not_required`) constrain only the
  new/NULL columns. Verified against the pre-feature definitions in
  `20260620003000_forms.sql:356-368,386`. ✓
- **Helpers** `app.is_valid_visibility` / `is_valid_options` / `is_valid_condition` /
  `eval_visibility` / `eval_condition` / `assert_*` are `immutable` with `search_path` pinned
  to `pg_catalog`; owned by `postgres`. ✓
- **Evaluator parity (Rule 3, no drift).** SQL `eval_condition` ordered ops mirror TS
  `orderedCompare`; `eval_visibility` mirrors `evalVisibility`; both vector files
  (`condition-vectors.json`, `visibility-vectors.json`) are consumed by BOTH
  `conditions.test.ts` and `20_conditions.sql`; TS keeps the `never` exhaustiveness guard
  (`conditions.ts:225-229`). The wizard's effective map (`use-wizard.ts:121-124`,
  `effective-visibility.ts`) seeds from the same `question_key → value` shape as SQL
  `app.answer_map` (value-only) and uses the same `evalVisibility`, so the client recompute and
  the submit forward pass match. ✓ (The number value-typing flaw is shared by both sides — a
  consistency, not a drift; still fixed under MAJOR-1.)
- **`validate_visible_when`** walks BOTH section (must reference a strictly-earlier section;
  not on the first section) and item conditions (strictly earlier in document-order tuple —
  rejects self/forward refs), group-aware via `app.visibility_conditions`, with
  operator↔target-type enforced via `assert_condition_op_target`. ✓
- **`submit_response` forward pass** — `v_eff` seeded from `app.answer_map`; hidden
  section/item keys dropped before later sections/items; single forward pass (refs strictly
  earlier); bounds present-only and visible-only. ✓
- **`clone_form_version`** copies `visible_when` + `config`; colours ride `options`;
  `visible_when` references `question_key` so it survives the clone. ✓
- **`save_section_answers`** DROP+CREATE (4-arg → 5-arg, no ambiguous overload) preserves all
  prior semantics — HC013 version guards, `last_section_id`, `updated_at`, `search_path` pin,
  REVOKE/GRANT re-applied; the observation upsert touches ONLY `answers.observation`, the value
  upsert only `value`. ✓
- **`get_response_for_signoff` (BE-8)** — the three access gates (exists+in_progress;
  staff_admin-of-commission; pending visible staff_admin sign-off) are reproduced verbatim;
  `observations_by_item` is a purely additive projection the same caller already gets all
  answer values for. No RLS/scope change. ✓
- **Rule 5 immutability** — `guard_published_structure` is a blanket
  `BEFORE INSERT OR DELETE OR UPDATE` (not `UPDATE OF <cols>`) row-level guard, so the new
  `config`/`visible_when` columns are covered automatically; no trigger change needed (correct
  reasoning). ✓
- **Rule 11** — `observation` is never referenced in any audit migration; `answers` is not an
  audited table; `app.answer_map` reads `value` only — observation free-text never enters the
  audit log or the condition map. No new RLS needed for additive columns (they inherit each
  table's policies; the SECURITY-DEFINER RPCs own their writes — verified). ✓
- Generated `database.ts` regenerated with `config` / `visible_when` / `observation` /
  `p_observations`. ✓

**Code quality / UX / a11y:**
- TypeScript strict respected — **no** `as any` / `@ts-ignore` / `eslint-disable` in the new
  app code; `toOptions` / `toConfig` narrow jsonb defensively; data access stays in
  `src/lib/queries/`; the pure `effective-visibility.ts` is shared by wizard + read views with
  no client/server boundary cost. ✓
- All user-facing strings pt-BR (operator labels, hints, errors); raw Postgres errors mapped
  to friendly pt-BR (`actions.ts` MESSAGES, HC061 parameterized). ✓
- Inputs accessible — `Field`/`FieldLabel`/`FieldDescription`/`FieldError`,
  `fieldset`/`legend` for radio/checkbox groups, `aria-describedby` + `aria-invalid`,
  `sr-only` labels and `aria-label`s in `ConditionBuilder`, colour never the sole signal
  (`input-item.tsx:697-698`); keyboard-only E2E (AC-K) green. (DialogDescription = MINOR-1;
  number bounds hint = MINOR-3.) ✓
- ADR 0040 records the non-trivial backend choices; PROGRESS.md reflects reality; no secrets
  introduced. ✓

---

## Re-review checklist (to clear CHANGES REQUESTED)

1. **MAJOR-1** — number-target conditions evaluate correctly for multi-digit / decimal /
   differing-magnitude values, end to end (builder serialize + read-back, wizard show/hide,
   submit stray-clear). Add a vector exercising the builder's real authored shape (number
   answer vs authored value) to `condition-vectors.json` + an E2E number-condition flow; keep
   SQL↔TS in agreement. Optionally tighten `assert_condition_op_target` to reject a non-numeric
   value on a `number` ordered op (fail publish loudly).
2. **MINOR-1 / MINOR-2 / MINOR-3** — recommended before the §6 Record step (cheap; team
   preference is to clear MINORs at gate close). MINOR-1 (`item-editor-dialog`
   DialogDescription) is the one I'd most encourage given it is the central surface here.

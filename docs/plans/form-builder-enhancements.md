# Form Builder Enhancements

## Context

The form builder (Phase 4) lets staff_admins compose form versions from sections and
items. Today an *input* item is one of four types — `multiple_choice`, `dropdown`,
`checkbox`, `free_text` — with bare-string options, no per-item visibility, and no way
to attach a note to an answer. This branch adds seven author/respondent capabilities so
commissions can build richer, more tailored checklists:

1. Two free-text flavors — **Short** (single-line) and **Long** (multi-line).
2. A **Number** field (decimals + negatives, optional min/max).
3. A **Date** field (date-only, optional min/max).
4. A **Time** field (24h, no bounds).
5. Per-option **colors** on multiple_choice + checkbox, reusing the case-outcome palette.
6. Per-question **conditional appearance** — a flat list of conditions (ALL/ANY) over any
   earlier answer; conditional questions can't be required.
7. A free-text **observation** on every non-free-text question, revealed at fill time.

All changes are **additive and backward-compatible** — published versions stay immutable,
existing forms keep working untouched, **no feature flag**, **no data migration**.

Outcome: a more expressive builder + a tailored fill experience, with the new data
rendering correctly in all human-readable read surfaces. Dashboard aggregation/colored
charts are explicitly **deferred** to a follow-up.

### Locked decisions (from interview)

| # | Decision |
|---|----------|
| 1 | Keep `free_text` = "Resposta longa"; add new `short_text` (single-line). No migration. |
| 2 | Number: decimals + negatives; optional author min/max; validate client + submit RPC; stored as JSON number. |
| 3 | Date: date-only `YYYY-MM-DD`, optional min/max. Time: 24h `HH:mm`, no bounds. |
| 4 | Option colors on multiple_choice + checkbox only; reuse `ColorTokenPicker` + 7-token palette; optional; **answer still stores the option label string**. |
| 5 | Conditions = flat list + one ALL/ANY combinator. No nested trees. |
| 6 | A condition references any input question **strictly earlier in document order** (earlier section OR earlier item in the same section). |
| 7 | Condition targets: choice (`equals`/`not_equals`/`in`) **and** number/date/time (new `gt`/`gte`/`lt`/`lte`). No `between` (express via ALL of two bounds). |
| 8 | One reusable condition-builder component, used for **both** section and question conditions. |
| 9 | Conditional question **cannot be required** — enforced in UI + a DB CHECK. |
| 10 | Hidden questions behave like hidden sections: no answer, skipped in validation, stray answers cleared by submit RPC. |
| 11 | Observations always available on every non-free-text input type; optional; 2-line; stored on the answer row. |
| 12 | Render-correctly in read views; **defer** dashboards. Ship directly, **no flag**. |

---

## Architecture decisions (decided during research — not user-facing)

- **Condition engine = single evaluator + thin group wrapper.** `VisibleWhen` and
  `evalCondition` are reused beyond sections — Phase-7 cross-phase recommendations
  (`RecommendWhen`) and per-phase result rulesets (`ResultRule`/`walkResultRuleset`), and
  the SQL mirror feeds `submit_response`, `compute_case_phase_result`, recommendations. So
  we **keep `evalCondition`'s single-condition semantics stable** (only add the comparison
  ops) and add a **new `evalVisibility(rule, answers)` wrapper** that handles the
  AND/OR group, delegating to `evalCondition` per sub-condition. Sections + items store
  either shape; the legacy single shape evaluates unchanged.
- **New item columns** on `form_items`: `visible_when jsonb` (the group/legacy shape) and
  `config jsonb` (per-type settings — number/date min/max; null otherwise).
- **Option colors live inside the existing `options` jsonb** — each element becomes
  `{ "label": "...", "color": "<token>"|null }`; legacy bare-string elements are accepted
  and normalized at read. This means the clone path copies colors for free.
- **Observation** = new nullable `answers.observation text`. The evaluator + `answer_map`
  read only `value`, so observations never affect conditions. Per Rule 11 the audit log
  must not copy observation text (same as answer values).
- **Shape validation** centralized in an IMMUTABLE `app.is_valid_visibility(jsonb)` used by
  both tables' CHECK constraints (accepts null, legacy single, or group).

---

## Data model — migration (backend)

New additive migration `supabase/migrations/<ts>_form_builder_enhancements.sql`:

**`form_items`**
- Extend `form_items_item_type_check` to add `short_text`, `number`, `date`, `time`.
- Extend `form_items_input_vs_display`: the new types follow the input-item branch
  (`question_key`/`label` NOT NULL, `content` NULL). Keep `options` NULL for them via
  `form_items_options_shape` (add them to the `free_text` "options IS NULL" arm).
- New `visible_when jsonb` column + `CONSTRAINT form_items_visible_when_shape CHECK
  (visible_when IS NULL OR app.is_valid_visibility(visible_when))`.
- New `config jsonb` column + light CHECK (`config IS NULL OR jsonb_typeof(config)='object'`);
  semantic min≤max enforced in the action (and optionally a CHECK).
- New `CONSTRAINT form_items_conditional_not_required CHECK (visible_when IS NULL OR required = false)`.
- Relax `form_items_options_shape` choice arm to allow elements that are **either** a
  string **or** an object `{label, color}` (a helper `app.is_valid_options(jsonb)` keeps
  the CHECK readable and backward-compatible).

**`form_sections`**
- Replace `form_sections_visible_when_shape` with `CHECK (visible_when IS NULL OR
  app.is_valid_visibility(visible_when))` so sections accept both legacy and group shapes.

**`answers`**
- New nullable `observation text`.

**Helper functions** (IMMUTABLE, `app` schema)
- `app.is_valid_visibility(jsonb)` — null/legacy-single/group; validates `match ∈ {all,any}`,
  non-empty `conditions[]`, each condition has `question_key`(string)/`op`(in extended set)/`value`.
- `app.is_valid_options(jsonb)` — array of string-or-`{label,color}` (color in the 7 tokens or null).

After migration: `supabase gen types typescript --local > src/lib/types/database.ts`, then
`supabase db push` to remote (requires the user to authorize the remote deploy — see memory
`remote-db-push-needs-user-auth`).

---

## Condition engine (backend SQL + shared TS)

**SQL** (`responses.sql` evaluator block / new migration):
- Extend `app.eval_condition` with `gt`/`gte`/`lt`/`lte`: if both operands are JSON numbers
  compare numerically (`::numeric`), else compare as text (ISO date/time sorts correctly).
- Add `app.eval_visibility(p_rule jsonb, p_answers jsonb)`: null→true; if `p_rule ? 'conditions'`
  iterate with all/any over `app.eval_condition`; else delegate to `app.eval_condition`
  (legacy single).
- Extend `validate_visible_when(form_version_id)` to also walk **items** with conditions:
  for each sub-condition `question_key`, require it exists as an input item AND its
  `(section.position, item.position)` is strictly less than the dependent item's tuple
  (reject self/forward refs); validate operator↔target-type (`in` ⇒ choice + array value;
  `gt/gte/lt/lte` ⇒ number/date/time). Keep the existing section rules. Called from
  `publish_form_version`.

**TS** (`src/lib/queries/conditions.ts`):
- Extend `ConditionOp` with `'gt'|'gte'|'lt'|'lte'`; add the numeric-or-string compare to
  `evalCondition`'s switch; update the `never` exhaustiveness guard.
- Add `ConditionGroup { match: 'all'|'any'; conditions: SingleCondition[] }`,
  `type Visibility = VisibleWhen | ConditionGroup`, and
  `evalVisibility(rule: Visibility | null, answers: AnswerMap): boolean` (mirror of SQL).
- `walkResultRuleset`, `RecommendWhen`, `ResultRule` keep using `evalCondition` with single
  shapes — unchanged (they gain the new ops for free but never author groups).

**Shared test vectors** (Rule 3 — no drift):
- Add the new comparison-op cases to `src/lib/queries/__fixtures__/condition-vectors.json`
  (consumed by `conditions.test.ts` + `supabase/tests/20_conditions.sql`).
- Add a new `visibility-vectors.json` for the group/`evalVisibility` cases, exercised by a
  new TS test and a new SQL test against `app.eval_visibility`.

---

## Submit RPC + clone (backend SQL)

**`submit_response`** (responses.sql ~1251) — inside the section loop, for each **visible**
section walk its items in `position` order maintaining an *effective* answer map `v_eff`
(starts as `v_answers`):
- Evaluate `app.eval_visibility(item.visible_when, v_eff)`.
- If hidden: delete the item's answer (guarded by `app.in_submit_rpc`) and **remove its
  question_key from `v_eff`** so downstream conditions see it absent (single forward pass
  handles cascades because refs are strictly-earlier).
- If visible: enforce required (existing check, now per visible item) and number/date
  **min/max** from `config` (raise `HC0xx` with a pt-BR message).
- Also drop a hidden section's item keys from `v_eff` before processing later sections.

**`clone_form_version`** (forms.sql:76-85) — add `visible_when` and `config` to the item
copy SELECT/INSERT lists. Option colors copy automatically (inside `options`). `visible_when`
references `question_key`, so it survives cloning unchanged (same property sections rely on).

**`save_section_answers`** (responses.sql ~999) + `saveSection` action — accept an optional
per-item observation and upsert it into `answers.observation`.

No new RLS: columns are additive and inherit each table's existing policies; the
SECURITY-DEFINER RPCs already own their writes. Verify `authenticated` table grants cover
the new columns (Supabase grants are table-wide, so they do).

---

## Backend contract-first signatures (post BEFORE implementing)

`src/lib/queries/forms.ts`:
```ts
export type ColorToken = CaseStatusColorToken            // re-exported from lib/cases/case-status
export interface ItemOption { label: string; color: ColorToken | null }
export type InputItemType =
  | 'multiple_choice' | 'dropdown' | 'checkbox'
  | 'free_text' | 'short_text' | 'number' | 'date' | 'time'
export interface ItemConfig { min?: number | string | null; max?: number | string | null }
export interface Item {
  // ...existing
  options: ItemOption[] | null     // was string[]; toOptions() normalizes legacy strings
  config: ItemConfig | null
  visibleWhen: Visibility | null   // group or legacy single
}
```
- `toOptions()` normalizes DB `options` (string | {label,color}) → `ItemOption[]`.

`src/lib/queries/conditions.ts`: `ConditionOp` (+4 ops), `ConditionGroup`, `Visibility`,
`evalVisibility()`.

`src/lib/forms/actions.ts` — `addItem`/`updateItem` FormData gains: new `itemType` values;
repeated option color alongside each `option`; `configMin`/`configMax`; `visibleWhen` (JSON
group); server clears `required` when `visibleWhen` present (defense for the CHECK).

`src/lib/responses/actions.ts` — `saveSection({ ..., observationsByItemId?: Record<string,string> })`.

---

## Builder UI (frontend)

- `item-type-meta.tsx` + `add-block-menu.tsx`: add pt-BR labels — **Resposta curta**
  (`short_text`), **Resposta longa** (relabel `free_text`), **Número** (`number`), **Data**
  (`date`), **Hora** (`time`), each with a description; group under "Perguntas".
- `item-editor-dialog.tsx`:
  - short/long → no options; number/date → optional **Mínimo/Máximo** inputs (→ `config`);
    time → plain.
  - `options-editor.tsx`: per-row `ColorTokenPicker` (multiple_choice + checkbox only),
    optional, with a small "sem cor" default; reuse `TOKEN_STYLES` for the swatch.
  - **New `ConditionBuilder` component** (`src/components/forms/condition-builder.tsx`),
    rendered at the **end** of the dialog under an **"Aparência condicional"** toggle:
    ALL/ANY selector + add/remove condition rows; each row = target picker (input questions
    strictly earlier in doc order) → operator (filtered by target type) → value control
    (option picker for choice; number/date/time input for those). When ≥1 condition exists,
    **disable + clear the "obrigatória" toggle** with an inline note.
- Refactor `section-settings-dialog.tsx` to use the same `ConditionBuilder` (decision #8);
  it reads/writes the group shape; existing single-shape sections round-trip via
  normalization (legacy single → one-row ALL group on save, or preserved if untouched).

Run the `frontend-design` skill before building `ConditionBuilder` and the colored options.

---

## Fill UI (frontend)

- `input-item.tsx` render switch: add `short_text` (single-line `Input`), `number`
  (numeric input, pt-BR comma display ↔ canonical number), `date` (date input, min/max),
  `time` (time input); `free_text` stays `Textarea` ("long"). Colored options:
  multiple_choice + checkbox rows get a color dot / left-accent always and a stronger tint
  when selected (reuse `TOKEN_STYLES`/`TOKEN_COLOR_VAR`).
- **Observation affordance** on non-free-text items: after the question is answered, show an
  **"Adicionar observação"** button that reveals a 2-line `Textarea`; if an observation
  already exists, render it expanded. Optional, never blocks.
- `types.ts` `AnswerRecord` gains `observation?: string`; `use-wizard.ts` `setObservation`;
  `wizard-client.tsx` threads `observationsByItemId` into `saveSection`.
- `use-wizard.ts`: add **item-level** visibility — a `computeEffectiveVisibility` that walks
  sections+items in document order with an effective answer map (dropping hidden items'
  answers), returning visible section + visible item ids; mirror of the submit RPC pass.
  Extend orphan detection/clear to hidden items.
- `validation.ts`: skip hidden items; add number/date min/max client validation.
- `answer-summary.tsx`: format number (pt-BR), date (pt-BR), time; render selected option as
  a colored chip; show the observation as a muted secondary line.

---

## Risks & sequencing

**Highest-risk:** (a) evaluator drift SQL↔TS — guard with the shared vectors and the
`never` exhaustiveness check; (b) CHECK-constraint backward-compat — every relaxed CHECK
must still accept all existing rows (test against a cloned prod snapshot / `db reset`);
(c) submit-RPC cascade ordering — the effective-map single forward pass must match the
wizard's `computeEffectiveVisibility` exactly (shared vectors + an integration test);
(d) the `options: string[] → ItemOption[]` type change touches every options reader — sweep
all usages; (e) native `<select>` can't show colors — that's why dropdown is excluded.

**Order (contract-first):**
1. **Backend**: post the `forms.ts` / `conditions.ts` / `actions.ts` signatures (stubs).
2. **Backend**: migration (columns, CHECKs, helpers) → regen types → `db push`.
3. **Backend**: evaluator ops + `evalVisibility` + SQL mirror + vectors; `validate_visible_when`,
   `submit_response`, `clone_form_version`, `save_section_answers`.
4. **Frontend (parallel after step 1)**: type labels, item dialog (new types + min/max +
   colors), `ConditionBuilder`, section-dialog refactor.
5. **Frontend**: fill inputs, colored options, observations, item-visibility recompute,
   summary rendering.
6. **Tester** → **QA** per the §6 gate.

Backend owns `supabase/**`, `src/lib/{queries,forms,responses,types}`; Frontend owns
`src/app/**`, `src/components/**`. No shared-file collisions if `forms.ts`/`conditions.ts`/
`actions.ts` land via Backend first.

---

## Verification

- **Unit (vitest):** extended `conditions.test.ts` (new ops) + new `evalVisibility` test;
  both green against `condition-vectors.json` + `visibility-vectors.json`.
- **SQL tests:** `20_conditions.sql` (ops) + new `app.eval_visibility` group test;
  `50_publish_validation.sql` extended — item forward-ref / cycle / self-ref rejection,
  conditional-not-required, operator↔type mismatch; a submit test proving hidden-item answers
  are cleared and min/max enforced.
- **E2E (Playwright):** builder — add each new type, color options, build a question
  condition, confirm "obrigatória" disables; fill — render all new inputs, live show/hide on
  a question condition (incl. same-section ref), add an observation; submit — hidden answer
  cleared, min/max blocks submit. At least one keyboard-only flow (per CLAUDE.md §8).
- **Gate hygiene (memory):** full suite is green only on **local Docker** (remote fails ~16
  by design); run the declaring suite against a **prod build** and triage vs the known
  flaky baseline before calling regression.
- `npm run lint && npm run typecheck` clean; `supabase gen types` committed.

**Branch:** `feat/form-builder-enhancements` (off `main`).

**Execution:** spawn the standing `backend`/`frontend` teammates contract-first, then
`tester`, then `qa`, following the CLAUDE.md §6 Phase Gate (this is run as a mini-phase given
it touches migrations + the condition evaluator + the submit RPC).

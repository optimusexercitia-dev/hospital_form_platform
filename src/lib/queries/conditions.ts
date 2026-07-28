import type { Json } from '@/lib/types/database'

/**
 * Section-visibility condition evaluation — the TypeScript mirror of the SQL
 * `app.eval_condition` function (ARCHITECTURE Rule 3). The wizard uses this for
 * live show/skip; the SQL function is the authority at submission time. The two
 * MUST agree: a shared vector file
 * (`src/lib/queries/__fixtures__/condition-vectors.json`) is exercised against
 * both, and drift is a phase-blocking bug. Any change here must be mirrored in
 * `supabase/migrations/*_condition_evaluator_and_rpcs.sql` and vice versa.
 *
 * v1 shape (ADR 0005): a single condition, no AND/OR trees.
 *
 * Form-builder-enhancements extension: `evalCondition` stays the SINGLE
 * authority over ONE condition (sections, Phase-7 `RecommendWhen`/`ResultRule`
 * keep using it directly), now with four ordered-comparison ops
 * (`gt`/`gte`/`lt`/`lte`) for number/date/time targets. The new AND/OR group is
 * a THIN wrapper, {@link evalVisibility}, that delegates to `evalCondition` per
 * sub-condition — `evalCondition`'s single-condition semantics are unchanged.
 */

/**
 * The condition operators. `equals`/`not_equals`/`in` are the v1 set (choice
 * targets). `gt`/`gte`/`lt`/`lte` are the ordered comparisons added for
 * number/date/time targets (form-builder-enhancements): when BOTH operands are
 * JSON numbers they compare numerically, otherwise as text — so ISO dates
 * (`YYYY-MM-DD`) and 24h times (`HH:mm`) sort correctly lexicographically.
 *
 * `contains`/`not_contains`/`is_empty`/`is_not_empty` are the F3 (ADR 0060 Rec D)
 * additions, mirrored byte-for-byte in SQL `app.eval_condition`:
 *   - `contains` = membership on a choice array (same relation as array-aware
 *     `equals`) OR substring on text (`String.includes`, case-sensitive); every
 *     other value type → false. `not_contains` = its negation.
 *   - `is_empty` (UNARY — `value` ignored) = true iff the answer is absent / null /
 *     `''` / `[]`. `is_not_empty` = its negation.
 * These are deliberately NOT offered by the author picker (see `condition-builder`);
 * they are evaluator-level vocabulary, exercised by the golden vectors. Adding a
 * member here forces every `ConditionOp` consumer (the `evalCondition` switch guard
 * + the pt-BR `OP_LABELS` records) to handle it at compile time.
 */
export type ConditionOp =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty'

export interface VisibleWhen {
  question_key: string
  op: ConditionOp
  value: Json
}

/**
 * An AND/OR group of conditions — the form-builder-enhancements visibility
 * shape for sections AND per-question conditions. `match` is the combinator
 * (`all` = AND, `any` = OR) applied over `conditions` (a flat list, no nesting;
 * decision #5). Mirrors SQL `app.eval_visibility`'s group branch. The legacy
 * single {@link VisibleWhen} shape is still accepted and evaluated unchanged.
 */
export interface ConditionGroup {
  match: 'all' | 'any'
  conditions: VisibleWhen[]
}

/**
 * A stored visibility rule: either the legacy single condition or an AND/OR
 * group. `null` means "always visible". {@link evalVisibility} evaluates either
 * shape; `evalCondition` only ever sees the single shape (a group's
 * sub-conditions are fed to it one at a time).
 */
export type Visibility = VisibleWhen | ConditionGroup

/**
 * A cross-phase recommendation condition (Phase 7, ADR 0017). A strict superset
 * of `VisibleWhen`: it adds `from_phase` — the position of the EARLIER case-phase
 * whose answers the condition reads. The backend strips `from_phase`
 * (`recommend_when - 'from_phase'`) and feeds the remaining `VisibleWhen` to the
 * UNCHANGED `eval_condition`/`evalCondition` against that source phase's
 * (submitted-only) answer map, so the evaluator + its mirror + the shared vector
 * file stay untouched (no drift). The template builder can preview a
 * recommendation by calling `evalCondition({ question_key, op, value }, answers)`
 * (i.e. the `RecommendWhen` minus `from_phase`).
 *
 * This legacy single (answer-only) shape stays valid forever (no data migration,
 * ADR 0043). The combinable {@link RecommendGroup} shape is the superset the
 * editor now emits.
 */
export type RecommendWhen = { from_phase: number } & VisibleWhen

// ---------------------------------------------------------------------------
// Result-based recommendation (ADR 0043) — combinable answer/result conditions
// ---------------------------------------------------------------------------

/**
 * Reserved synthetic question_key for a RESULT-SPECIFIC recommendation condition.
 * Never collides with a real `question_key` (those are author-typed slugs that
 * cannot contain the `__…__` sentinel). The evaluator feeds `eval_condition` a
 * synthetic map `{ [RECOMMEND_RESULT_KEY]: <result_id> }` (key ABSENT when the
 * source phase landed on no result), so the UNCHANGED evaluator handles
 * equals/not_equals/in over the result option id with no drift (ADR 0043).
 */
export const RECOMMEND_RESULT_KEY = '__phase_result__' as const

/**
 * Reserved synthetic question_key for a RESULT-ADVERSE recommendation condition.
 * The evaluator feeds `eval_condition` a synthetic map
 * `{ [RECOMMEND_RESULT_ADVERSE_KEY]: <is_adverse boolean> }` (key ABSENT when no
 * result), `equals` against the requested `adverse` flag.
 */
export const RECOMMEND_RESULT_ADVERSE_KEY = '__phase_result_adverse__' as const

// ---------------------------------------------------------------------------
// Flagged + aggregate result criteria (form-builder-enhancements) — reserved
// synthetic keys for PHASE-RESULT ruleset conditions (NOT recommendations).
// Rides the same synthetic-key precedent: the SQL compute + this TS preview each
// inject these keys into the answer map BEFORE the UNCHANGED evaluator rule-walk,
// so `walkResultRuleset`/`eval_condition` need no change. `__…__` can never
// collide with an author question_key (auto-generated slugs strip leading/trailing
// `_`), the same protection RECOMMEND_RESULT_KEY relies on.
// ---------------------------------------------------------------------------

/**
 * Reserved synthetic question_key for the phase's TOTAL SCORE aggregate — Σ of the
 * phase's selected options' `score` (null → 0). A result rule keyed on this with an
 * ordered op (`> 5` etc.) fires against the injected number.
 */
export const TOTAL_SCORE_KEY = '__total_score__' as const

/**
 * Reserved synthetic question_key for the phase's FLAGGED COUNT aggregate — the
 * combined tally of (selected flagged options, per-option across
 * multiple_choice/dropdown/checkbox) + (number/date/time items whose `flaggedWhen`
 * is satisfied). A result rule keyed on this with an ordered op fires against it.
 */
export const FLAGGED_COUNT_KEY = '__flagged_count__' as const

/**
 * A per-item "Flagged If" condition (number/date/time only): a single
 * self-referential `{ op, value }` compared against the item's OWN answer. Stored
 * in `form_items.config.flaggedWhen`. Reuses the ordered/equality ops; a satisfied
 * flaggedWhen contributes +1 to {@link FLAGGED_COUNT_KEY}. Value type matches the
 * item (number → number; date → ISO `YYYY-MM-DD`; time → `HH:mm`).
 */
export interface FlaggedWhen {
  op: Extract<ConditionOp, 'gt' | 'gte' | 'lt' | 'lte' | 'equals' | 'not_equals'>
  value: Json
}

/**
 * One input to {@link computeAggregateKeys}: a number/date/time item's own answer +
 * its optional `flaggedWhen` condition, so the preview can tally the flaggedWhen
 * half against the SAME value the backend's normalized answer map uses.
 */
export interface FlaggedWhenInput {
  /** The item's current (normalized) answer value, or `undefined`/`null` if empty. */
  answer: Json | undefined
  /** The item's `config.flaggedWhen`, or `null` when the item carries none. */
  flaggedWhen: FlaggedWhen | null
}

/**
 * Compute the two reserved aggregate keys the phase-result preview must inject into
 * its answer map so the builder preview matches `app.compute_case_phase_result`
 * EXACTLY (Rule 3 — no evaluator change; identical synthetic keys on both sides):
 *   - `__total_score__` = Σ of the selected options' scores (null/absent → 0);
 *   - `__flagged_count__` = (count of selected flagged options) + (count of
 *     number/date/time items whose `flaggedWhen` holds against their own answer,
 *     evaluated through the UNCHANGED {@link evalCondition} — the SAME single-key
 *     synthetic map the SQL side builds, so value normalization is identical).
 *
 * `selectedOptionScores` are the scores of the currently-selected options (nulls
 * skipped by the caller); `selectedFlaggedCount` is how many selected options are
 * flagged; `flaggedWhenInputs` are the number/date/time items with a flaggedWhen.
 * Returns a map to MERGE into `previewAnswers` before `walkResultRuleset`.
 */
export function computeAggregateKeys(input: {
  selectedOptionScores: number[]
  selectedFlaggedCount: number
  flaggedWhenInputs: FlaggedWhenInput[]
}): { [TOTAL_SCORE_KEY]: number; [FLAGGED_COUNT_KEY]: number } {
  const totalScore = input.selectedOptionScores.reduce(
    (sum, s) => sum + (Number.isFinite(s) ? s : 0),
    0,
  )
  const flaggedConditions = input.flaggedWhenInputs.reduce((count, fi) => {
    if (!fi.flaggedWhen) return count
    // Feed the item's flaggedWhen to the UNCHANGED evaluator against a one-key map
    // of its own answer — mirroring the SQL side's per-item eval over v_answers.
    const hit = evalCondition(
      {
        question_key: '__flagged_when_self__',
        op: fi.flaggedWhen.op,
        value: fi.flaggedWhen.value,
      },
      { __flagged_when_self__: fi.answer },
    )
    return count + (hit ? 1 : 0)
  }, 0)
  return {
    [TOTAL_SCORE_KEY]: totalScore,
    [FLAGGED_COUNT_KEY]: input.selectedFlaggedCount + flaggedConditions,
  }
}

/**
 * A cross-phase recommendation condition reading an EARLIER phase's ANSWER — the
 * legacy shape, now optionally tagged `source: 'answer'` for symmetry with the
 * result conditions. Ops/value are exactly as today (choice ops only for
 * recommendations: equals | not_equals | in — NO ordered ops; the CHECK + the SQL
 * validator forbid ordered ops here).
 */
export interface RecommendAnswerCond {
  source?: 'answer'
  from_phase: number
  question_key: string
  op: Extract<ConditionOp, 'equals' | 'not_equals' | 'in'>
  value: Json
}

/**
 * A cross-phase recommendation condition reading an EARLIER phase's SPECIFIC
 * RESULT option(s). `value` is a `phase_results` id (string) — or ids
 * (string[]) for `in`. Evaluated over a synthetic `{ [RECOMMEND_RESULT_KEY]: id }`
 * map by the UNCHANGED `eval_condition` (ADR 0043).
 */
export interface RecommendResultSpecificCond {
  source: 'result'
  from_phase: number
  op: Extract<ConditionOp, 'equals' | 'not_equals' | 'in'>
  value: Json
}

/**
 * A cross-phase recommendation condition reading whether an EARLIER phase's
 * result is ADVERSE (the `phase_results.is_adverse` flag). `adverse: true` matches
 * an adverse result; `adverse: false` matches a non-adverse result (false until a
 * real non-adverse result exists — no-result is absent, ADR 0043).
 */
export interface RecommendResultAdverseCond {
  source: 'result'
  from_phase: number
  adverse: boolean
}

/** One condition of a {@link RecommendGroup}: an answer or a result condition. */
export type RecommendCond =
  | RecommendAnswerCond
  | RecommendResultSpecificCond
  | RecommendResultAdverseCond

/**
 * The combinable recommendation rule the editor emits (ADR 0043), even for a
 * single condition: `match` (`all` = AND / `any` = OR) over a non-empty flat list
 * of {@link RecommendCond} (no nesting, mirroring {@link ConditionGroup}). Answer-
 * and result-conditions may be mixed freely in one group.
 */
export interface RecommendGroup {
  match: 'all' | 'any'
  conditions: RecommendCond[]
}

/**
 * A stored recommendation rule: either the legacy single {@link RecommendWhen}
 * (answer-only) or the combinable {@link RecommendGroup}. `null` means "never
 * recommend". A strict SUPERSET — every legacy single row remains valid (no data
 * migration, ADR 0043).
 */
export type RecommendRule = RecommendWhen | RecommendGroup

/**
 * The per-source data of ONE earlier case-phase, supplied by the caller of
 * {@link evalRecommendation} so the TS mirror never touches the database:
 *   - `answers` — the source phase's submitted answer map (for answer conditions);
 *   - `resultId` — its EFFECTIVE result option id, or `null` when it landed on no
 *     result (not concluded, skipped, or concluded without a result);
 *   - `resultAdverse` — whether that result is adverse (`null` when no result).
 * A missing source phase (dangling `from_phase`) resolves to `null`, treated as
 * "no data" (empty answers + no result), matching the SQL side.
 */
export interface RecommendPhaseData {
  answers: AnswerMap
  resultId: string | null
  resultAdverse: boolean | null
}

/** Discriminate the {@link RecommendGroup} shape from the legacy single shape. */
function isRecommendGroup(rule: RecommendRule): rule is RecommendGroup {
  return Array.isArray((rule as RecommendGroup).conditions)
}

/** Discriminate a result-condition from an answer-condition. */
function isResultCond(
  c: RecommendCond,
): c is RecommendResultSpecificCond | RecommendResultAdverseCond {
  return c.source === 'result'
}

/**
 * Evaluate ONE recommendation condition against its resolved source-phase data,
 * by building the synthetic single-condition map the UNCHANGED {@link evalCondition}
 * expects (ADR 0043) — NO change to the shared evaluator or its vectors:
 *   - answer → `evalCondition({question_key, op, value}, source.answers)`;
 *   - result-specific → `evalCondition({RECOMMEND_RESULT_KEY, op, value}, {key:id})`
 *     (key ABSENT when `resultId` is null → answer-style missing-value semantics);
 *   - result-adverse → `evalCondition({RECOMMEND_RESULT_ADVERSE_KEY, equals, adverse},
 *     {key:isAdverse})` (key ABSENT when no result).
 */
function evalRecommendCond(
  c: RecommendCond,
  data: RecommendPhaseData | null,
): boolean {
  const source: RecommendPhaseData = data ?? {
    answers: {},
    resultId: null,
    resultAdverse: null,
  }

  if (!isResultCond(c)) {
    // Answer condition (legacy / source:'answer').
    return evalCondition(
      { question_key: c.question_key, op: c.op, value: c.value },
      source.answers,
    )
  }

  if ('adverse' in c) {
    // Result-adverse: synthetic boolean map; key absent when no result.
    const map: AnswerMap =
      source.resultAdverse === null
        ? {}
        : { [RECOMMEND_RESULT_ADVERSE_KEY]: source.resultAdverse }
    return evalCondition(
      { question_key: RECOMMEND_RESULT_ADVERSE_KEY, op: 'equals', value: c.adverse },
      map,
    )
  }

  // Result-specific: synthetic id map; key absent when no result.
  const map: AnswerMap =
    source.resultId === null ? {} : { [RECOMMEND_RESULT_KEY]: source.resultId }
  return evalCondition(
    { question_key: RECOMMEND_RESULT_KEY, op: c.op, value: c.value },
    map,
  )
}

/**
 * The TypeScript MIRROR of the SQL `recompute_recommendations` group-walk (ADR
 * 0043) — drives the template-builder recommendation preview. Walks a
 * {@link RecommendRule} (legacy single OR group), resolving each condition's
 * `from_phase` via `resolve` to that earlier phase's {@link RecommendPhaseData},
 * then evaluating per condition through the UNCHANGED {@link evalCondition} (NO
 * evaluator drift, shared vectors untouched). Folds `all`→AND / `any`→OR.
 *
 * `null` → `false` (Q1, ADR 0043): null means "never recommend"; a faithful
 * mirror of the SQL side, which only visits non-null rows. A legacy single shape
 * is treated as a one-condition `all` group. An empty group (rejected at the
 * CHECK/validator layer) defensively folds `all` of [] → true, `any` of [] →
 * false (matching `bool_and`/`bool_or` over an empty set).
 */
export function evalRecommendation(
  rule: RecommendRule | null | undefined,
  resolve: (fromPhase: number) => RecommendPhaseData | null,
): boolean {
  if (rule == null) return false

  const conditions: RecommendCond[] = isRecommendGroup(rule)
    ? rule.conditions
    : // Legacy single (answer-only): a one-condition group.
      [
        {
          source: 'answer',
          from_phase: rule.from_phase,
          question_key: rule.question_key,
          // Recommendations only ever carry choice ops; narrow defensively.
          op: rule.op as Extract<ConditionOp, 'equals' | 'not_equals' | 'in'>,
          value: rule.value,
        },
      ]

  const match = isRecommendGroup(rule) ? rule.match : 'all'

  if (match === 'any') {
    return conditions.some((c) => evalRecommendCond(c, resolve(c.from_phase)))
  }
  return conditions.every((c) => evalRecommendCond(c, resolve(c.from_phase)))
}

/**
 * One rule of a per-phase result ruleset (phase-results feature). The `when` is a
 * PLAIN `VisibleWhen` over the phase's OWN answers (NO `from_phase`) so the
 * UNCHANGED `evalCondition` evaluates it directly — no qualifier-stripping, no
 * evaluator drift, shared vectors untouched. `result_id` is the result option
 * emitted when this rule is the FIRST to match (first-match-wins).
 */
export interface ResultRule {
  when: VisibleWhen
  result_id: string
}

/**
 * The ordered result ruleset authored on a template phase and snapshotted onto the
 * case phase. Walked top-to-bottom; the first `rule.when` that evaluates true wins
 * its `result_id`; if none match, `default_result_id` is the fallback (may be
 * `null` → no result). The TS mirror of the SQL rule-walk in
 * `app.compute_case_phase_result`; both reuse the shared `evalCondition` /
 * `app.eval_condition`.
 */
export interface ResultRuleset {
  rules: ResultRule[]
  default_result_id: string | null
}

/** A flat map of question_key -> saved answer value. */
export type AnswerMap = Record<string, Json | undefined>

/**
 * FF-1 (BE-0 contract, ADR 0087 ruling 2) — the INSTANCE-AWARE answer map, as a
 * pure 2-tier overlay. This is the ONLY place the repeating-group answer
 * resolution lives on the TS side; the SQL mirror is
 * `app.overlay_answer_map(jsonb, jsonb)`. Drift between the two is a
 * phase-blocking bug (Rule 3), locked by
 * `__fixtures__/instance-map-vectors.json` + `supabase/tests/20_conditions.sql`.
 *
 * `base` is the response's TOP-LEVEL map (answers with no `group_instance_id` —
 * including a plain `group`'s children, which store top-level per ruling 6).
 * `overlay` is ONE repeating-group instance's own answers. The overlay wins per
 * key ("a same-instance sibling wins"); a key in NEITHER stays **absent**, which
 * is what gives ruling 2's "sibling missing in this instance → absent, never a
 * fallback to another instance" for free: a repeating-group child's answers only
 * ever carry an instance id, so its key can never appear in `base`.
 *
 * Evaluating an item OUTSIDE any repeating group uses `base` alone — never this.
 *
 * INVARIANT: neither map may carry an explicit `undefined` value. `evalCondition`
 * tests key presence with `hasOwnProperty`, so a present-but-`undefined` key
 * would read as "answered with null" in TS while the SQL side has no such state.
 * Both producers (`buildAnswerMaps`, `app.answer_map_scoped`) omit absent keys.
 */
export function overlayAnswerMap(base: AnswerMap, overlay: AnswerMap): AnswerMap {
  return { ...base, ...overlay }
}

/**
 * FF-1 (ADR 0087 ruling 2) — may a condition authored for `ref` target `target`?
 * The TS mirror of the outside-in ban `public.validate_visible_when` enforces at
 * publish. Both arguments are the `repeating_group` id the item lives inside, or
 * `null` for a top-level item, a plain-`group` child (ruling 6 — those answer at
 * top level), or a SECTION condition (a section is never inside a group).
 *
 * The rule in one line: a repeating-group child's key is in scope only from
 * INSIDE that same group.
 *   · target outside any repeating group → always legal;
 *   · target inside group G, ref inside G → legal (inside-out; `overlayAnswerMap`
 *     resolves it to the same-instance sibling);
 *   · target inside group G, ref anywhere else → ILLEGAL (outside-in: with N
 *     instances there is no single value).
 *
 * This is a UI NARROWING, never the authority — the server rejects at publish
 * regardless. Its job is to stop the builder from offering a target that would
 * then fail publish, which is why it must agree with the SQL exactly: a target
 * offered here and refused there is a dead end the author cannot diagnose.
 */
export function isConditionTargetInScope(
  targetRepeatingGroupId: string | null,
  refRepeatingGroupId: string | null,
): boolean {
  return (
    targetRepeatingGroupId === null ||
    targetRepeatingGroupId === refRepeatingGroupId
  )
}

/**
 * Deep structural equality matching Postgres jsonb equality for our values.
 *
 * Exported for FF-3's `unique_within_group`, whose SQL mirror is plain jsonb
 * `=`. A second hand-rolled deep-equal in the validation evaluator would be a
 * second thing to keep in agreement with Postgres.
 */
export function jsonEquals(a: Json | undefined, b: Json | undefined): boolean {
  if (a === b) return true
  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false
    }
    return a.every((el, i) => jsonEquals(el, b[i]))
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a)
    const bk = Object.keys(b)
    if (ak.length !== bk.length) return false
    return ak.every((k) =>
      jsonEquals(
        (a as Record<string, Json>)[k],
        (b as Record<string, Json>)[k],
      ),
    )
  }
  return false
}

/**
 * The "equals" relation, accounting for checkbox answers stored as arrays:
 * when the answer is an array, it matches the target if the target is one of
 * the selected options.
 */
function answerMatchesValue(answer: Json | undefined, target: Json): boolean {
  if (answer === undefined || answer === null) return false
  if (Array.isArray(answer)) {
    return answer.some((sel) => jsonEquals(sel, target))
  }
  return jsonEquals(answer, target)
}

/**
 * Compare an answer against a target for the ordered ops (gt/gte/lt/lte). The
 * SQL mirror (`app.eval_condition`) does the same: if BOTH operands are JSON
 * numbers, compare numerically; otherwise compare as text (`::text`), which
 * sorts ISO dates (`YYYY-MM-DD`) and 24h times (`HH:mm`) correctly. A
 * missing/null answer, or an array (checkbox) answer, never orders → false.
 * Returns the sign of (answer − target): -1, 0, or 1, or `null` when the
 * comparison is undefined.
 */
function orderedCompare(answer: Json | undefined, target: Json): number | null {
  if (answer === undefined || answer === null) return null
  // Checkbox arrays (and any non-scalar) do not participate in ordering.
  if (Array.isArray(answer) || Array.isArray(target)) return null
  if (typeof answer === 'object' || typeof target === 'object') return null

  if (typeof answer === 'number' && typeof target === 'number') {
    if (answer < target) return -1
    if (answer > target) return 1
    return 0
  }

  // Text comparison (covers ISO date/time strings, and number↔string mixes by
  // stringifying both — matches the SQL `::text` cast path).
  const a = String(answer)
  const b = String(target)
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * Evaluate whether a section is visible given the current answers.
 * A null/undefined condition means "always visible".
 */
export function evalCondition(
  visibleWhen: VisibleWhen | null | undefined,
  answers: AnswerMap,
): boolean {
  if (visibleWhen == null) return true

  const { question_key: key, op, value: target } = visibleWhen
  const present = Object.prototype.hasOwnProperty.call(answers, key)
  const answer = answers[key]

  const match = answerMatchesValue(present ? answer : undefined, target)

  switch (op) {
    case 'equals':
      return match
    case 'not_equals':
      return !match
    case 'in': {
      if (
        !present ||
        answer === undefined ||
        answer === null ||
        !Array.isArray(target)
      ) {
        return false
      }
      if (Array.isArray(answer)) {
        return answer.some((sel) => target.some((t) => jsonEquals(sel, t)))
      }
      return target.some((t) => jsonEquals(answer, t))
    }
    case 'gt': {
      const cmp = orderedCompare(present ? answer : undefined, target)
      return cmp !== null && cmp > 0
    }
    case 'gte': {
      const cmp = orderedCompare(present ? answer : undefined, target)
      return cmp !== null && cmp >= 0
    }
    case 'lt': {
      const cmp = orderedCompare(present ? answer : undefined, target)
      return cmp !== null && cmp < 0
    }
    case 'lte': {
      const cmp = orderedCompare(present ? answer : undefined, target)
      return cmp !== null && cmp <= 0
    }
    case 'contains':
    case 'not_contains': {
      // Rec D (mirrors SQL): membership on a choice array; substring on a text
      // scalar (case-sensitive, `String.includes` ⇔ `strpos > 0`); every other
      // value type → false. No number→text coercion.
      let hit: boolean
      if (!present || answer === undefined || answer === null) {
        hit = false
      } else if (Array.isArray(answer)) {
        hit = answer.some((sel) => jsonEquals(sel, target))
      } else if (typeof answer === 'string' && typeof target === 'string') {
        hit = answer.includes(target)
      } else {
        hit = false
      }
      return op === 'contains' ? hit : !hit
    }
    case 'is_empty':
    case 'is_not_empty': {
      // Rec D (mirrors SQL): unary — `target` ignored. Empty iff absent / null /
      // `''` / `[]`. Only the exact empty string / empty array count (no trimming;
      // number 0 and `[null]` are NON-empty).
      const empty =
        !present ||
        answer === undefined ||
        answer === null ||
        answer === '' ||
        (Array.isArray(answer) && answer.length === 0)
      return op === 'is_empty' ? empty : !empty
    }
    default: {
      // Exhaustiveness guard: a new op must be added to both evaluators.
      const _never: never = op
      throw new Error(`unknown condition op: ${String(_never)}`)
    }
  }
}

/**
 * Evaluate a stored {@link Visibility} rule (legacy single OR AND/OR group)
 * against the current answers. The TypeScript mirror of SQL
 * `app.eval_visibility` (form-builder-enhancements):
 *   - `null`/`undefined` → always visible (`true`);
 *   - a group (has a `conditions` array) → fold `all`/`any` over
 *     {@link evalCondition} per sub-condition. An empty group is rejected at the
 *     CHECK/validation layer, but defensively: `all` of [] → true, `any` of []
 *     → false (matches SQL `bool_and`/`bool_or` over an empty set);
 *   - otherwise the legacy single shape → delegate to {@link evalCondition}.
 *
 * `evalCondition` (and `walkResultRuleset`/`RecommendWhen`/`ResultRule`) keep
 * using single shapes directly — they are UNCHANGED and never author groups.
 * Drift between this and `app.eval_visibility` is a phase-blocking bug
 * (exercised by `__fixtures__/visibility-vectors.json`).
 */
export function evalVisibility(
  rule: Visibility | null | undefined,
  answers: AnswerMap,
): boolean {
  if (rule == null) return true
  if (isConditionGroup(rule)) {
    if (rule.match === 'any') {
      return rule.conditions.some((c) => evalCondition(c, answers))
    }
    // 'all' (default/AND)
    return rule.conditions.every((c) => evalCondition(c, answers))
  }
  return evalCondition(rule, answers)
}

/** Discriminate the group shape from the legacy single shape. */
function isConditionGroup(rule: Visibility): rule is ConditionGroup {
  return Array.isArray((rule as ConditionGroup).conditions)
}

/**
 * Walk a per-phase `ResultRuleset` over the phase's own answers and return the
 * winning `result_id` (or `null` when nothing matches and there is no default).
 * The TypeScript MIRROR of the SQL rule-walk in `app.compute_case_phase_result`:
 * iterate `rules` in order, return the FIRST rule whose `when` is true (reusing
 * {@link evalCondition} unchanged), else fall back to `default_result_id`, else
 * `null`. A `null` ruleset yields `null`. Used by the builder preview + the
 * end-of-wizard live computed preview; the SQL function is the authority at
 * conclude time. Drift between the two is a phase-blocking bug.
 */
export function walkResultRuleset(
  ruleset: ResultRuleset | null | undefined,
  answers: AnswerMap,
): string | null {
  if (ruleset == null) return null
  for (const rule of ruleset.rules) {
    if (evalCondition(rule.when, answers)) {
      return rule.result_id
    }
  }
  return ruleset.default_result_id
}

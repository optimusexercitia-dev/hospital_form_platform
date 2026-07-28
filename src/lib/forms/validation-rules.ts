import type { Json } from '@/lib/types/database'
import { evalVisibility, jsonEquals } from '@/lib/queries/conditions'
import type { AnswerMap, VisibleWhen } from '@/lib/queries/conditions'

/**
 * FF-3 (ADR 0090) — the VALIDATION ENGINE contract + the TypeScript half of the
 * second dual evaluator pair.
 *
 * ⚠ THIS MODULE MUST STAY PURE — no value import of anything that reaches
 * `server-only`. It is value-imported by CLIENT components (the rules editor and
 * the wizard), and a client component that value-imports a module which
 * transitively pulls `@/lib/supabase/server` **aborts `next build`** while tsc,
 * lint and Vitest all stay green (BUG-FBE-005, a repeat offender in this repo).
 * Type-only imports are fine — they erase. The RPC read that needs a Supabase
 * client lives in `src/lib/queries/validations.ts`, which re-exports everything
 * here so server callers can keep importing from one place.
 * `validations.test.ts` has a static guard that fails if this module regains a
 * server import.
 *
 * `evalValidation` is the TS mirror of SQL `app.eval_validation` (ARCHITECTURE
 * Rule 3). The wizard uses it for live inline feedback; the SQL function is the
 * authority at submit time (`submit_response` raises `HC0P9`). The two MUST
 * agree: a shared vector file (`__fixtures__/validation-vectors.json`) is
 * exercised against both — Vitest here, pgTAP in
 * `supabase/tests/274_ff3_validations.sql`. Drift is a phase-blocking bug.
 *
 * The pair is deliberately PURE: everything a rule needs is passed in, so the
 * SQL side can be `IMMUTABLE` and the TS side needs no client. The one rule that
 * is not locally decidable — `unique_within_group` — receives its cross-instance
 * peers as an explicit argument rather than reaching for the database.
 */

// ---------------------------------------------------------------------------
// Vocabulary (mirrors the `form_item_validations_rule_type_allowed` CHECK)
// ---------------------------------------------------------------------------

/**
 * The SIX rule types of v1 (ADR 0090 ruling 1). Group cardinality is
 * deliberately NOT here — `minInstances`/`maxInstances` shipped in FF-1 and a
 * second spelling would be a second source of truth for one bound.
 */
export const VALIDATION_RULE_TYPES = [
  'number_range',
  'text_length',
  'regex',
  'date_range',
  'datetime_order',
  'unique_within_group',
] as const

export type ValidationRuleType = (typeof VALIDATION_RULE_TYPES)[number]

/** `error` blocks submit (server-side). `warn` never blocks, anywhere. */
export const VALIDATION_SEVERITIES = ['error', 'warn'] as const
export type ValidationSeverity = (typeof VALIDATION_SEVERITIES)[number]

/**
 * Which `item_type`s may carry which rule (ADR 0090 ruling 2). The SQL mirror is
 * the `app.validation_rule_allowed(rule_type, item_type)` predicate the coverage
 * trigger calls; this record is the builder's pre-flight so the picker never
 * offers a pair the server will refuse.
 *
 * Containers (`group`, `repeating_group`), display items (`section_text`,
 * `image`), `matrix`, `risk_matrix` and `reference` carry NO rules in v1.
 */
export const VALIDATION_RULE_COVERAGE: Record<
  ValidationRuleType,
  readonly string[]
> = {
  number_range: ['number'],
  text_length: ['short_text', 'free_text'],
  regex: ['short_text', 'free_text'],
  date_range: ['date', 'time'],
  datetime_order: ['date', 'time'],
  // Any scalar child of a repeating_group — the PARENT check is the second half
  // of this rule's coverage and lives in `isValidationRuleAllowed`.
  unique_within_group: [
    'short_text',
    'free_text',
    'number',
    'date',
    'time',
    'multiple_choice',
    'dropdown',
  ],
} as const

/** Author-supplied `regex` patterns are capped (ReDoS blast-radius bound). */
export const MAX_REGEX_PATTERN_LENGTH = 200

// ---------------------------------------------------------------------------
// Per-rule config shapes
// ---------------------------------------------------------------------------

/** `{min?, max?}` — inclusive; at least one bound required. */
export interface NumberRangeConfig {
  min?: number
  max?: number
}

/** `{min?, max?}` — `char_length`, inclusive; at least one bound required. */
export interface TextLengthConfig {
  min?: number
  max?: number
}

/** POSIX pattern, matched with `~` (or `~*` when `caseInsensitive`). */
export interface RegexConfig {
  pattern: string
  caseInsensitive?: boolean
}

/** ISO literal bounds (`YYYY-MM-DD` for `date`, `HH:mm` for `time`), inclusive. */
export interface DateRangeConfig {
  min?: string
  max?: string
}

export const DATETIME_ORDER_OPS = [
  'before',
  'after',
  'not_before',
  'not_after',
] as const
export type DatetimeOrderOp = (typeof DATETIME_ORDER_OPS)[number]

/**
 * The ONLY cross-field rule. `question_key` is resolved through the map in
 * scope, so inside a repeating group it means "the sibling in THIS instance"
 * for free (FF-1's `instance_answer_map` / `overlayAnswerMap`).
 */
export interface DatetimeOrderConfig {
  op: DatetimeOrderOp
  question_key: string
}

/** `unique_within_group` takes no configuration. */
export type UniqueWithinGroupConfig = Record<string, never>

/**
 * A rule as one discriminated value. Prefer this over `(ruleType, config)`
 * pairs at call sites — it makes an impossible pairing unrepresentable.
 */
export type ValidationRuleSpec =
  | { ruleType: 'number_range'; config: NumberRangeConfig }
  | { ruleType: 'text_length'; config: TextLengthConfig }
  | { ruleType: 'regex'; config: RegexConfig }
  | { ruleType: 'date_range'; config: DateRangeConfig }
  | { ruleType: 'datetime_order'; config: DatetimeOrderConfig }
  | { ruleType: 'unique_within_group'; config: UniqueWithinGroupConfig }

export type ValidationConfig = ValidationRuleSpec['config']

// ---------------------------------------------------------------------------
// Row + writer shapes
// ---------------------------------------------------------------------------

/**
 * One `form_item_validations` row, camel-cased, as the builder reads it back.
 * `message` is the pt-BR text shown to the filler; the writer REQUIRES it
 * non-blank (a validation with no message is a dead end, and requiring it keeps
 * the SQL and TS evaluators from having to agree on a generated string).
 */
export interface ItemValidationRule {
  id: string
  itemId: string
  formVersionId: string
  position: number
  ruleType: ValidationRuleType
  config: ValidationConfig
  severity: ValidationSeverity
  message: string
}

/**
 * One entry of the `set_item_validations` payload.
 *
 * REPLACE semantics per item: the payload is the COMPLETE desired rule list for
 * that item — omitted rules are DELETED. This mirrors `upsertMatrixAxes`, and it
 * is the only honest contract for a list one piece of builder state owns.
 * Rows have no stable author-visible key, so they are replaced wholesale (a
 * validation rule is not an aggregation key the way an axis `code` is).
 */
export interface ValidationRuleInput {
  ruleType: ValidationRuleType
  config: ValidationConfig
  severity: ValidationSeverity
  message: string
  position: number
}

/**
 * `form_items.required_if` — a SINGLE condition (ADR 0090 ruling 4), validated
 * server-side by `app.is_valid_condition`. NOT the `{match, conditions[]}` group
 * shape `visible_when` accepts: the builder must emit one condition here.
 */
export type RequiredIf = VisibleWhen

// ---------------------------------------------------------------------------
// The error surface (`public.get_response_validation_errors`)
// ---------------------------------------------------------------------------

/**
 * One violation, placed on a field in an instance.
 *
 * `groupInstanceId` is `null` for a top-level item and the instance id for a
 * repeating-group child, so the wizard can put the message on the right row.
 *
 * `ruleId` is `null` for a violation of a legacy `form_items.config` BOUND
 * (`min`/`max`/`minLength`/`maxLength`), which predates FF-3 and is enforced by
 * `app.assert_item_bounds` at submit. Those rows are included so the list the
 * user sees and the gate that blocks them cannot disagree — a submit refused
 * with an empty error list is the failure mode this contract exists to prevent.
 */
export interface ValidationErrorRow {
  itemId: string
  groupInstanceId: string | null
  ruleId: string | null
  ruleType: ValidationRuleType
  severity: ValidationSeverity
  message: string
}

// ---------------------------------------------------------------------------
// The evaluator (TS mirror of `app.eval_validation`)
// ---------------------------------------------------------------------------

/**
 * Everything a rule may consult beyond its own value.
 *
 * `answers` is the map IN SCOPE — the response's top-level map for a flat item,
 * `overlayAnswerMap(base, instance)` for a repeating-group child. Passing the
 * instance-resolved map is what makes `datetime_order` compare against the
 * same-instance sibling without the evaluator knowing instances exist.
 *
 * `peerValues` is the SAME child's value in every OTHER non-empty instance of
 * its group — the only input `unique_within_group` needs, and the reason this
 * evaluator can stay pure.
 */
export interface ValidationContext {
  answers: AnswerMap
  peerValues?: readonly Json[]
}

/**
 * The ONE notion of "empty", shared with `evalCondition`'s `is_empty` operator
 * and mirrored by SQL `app.validation_value_is_empty`: absent / JSON null /
 * `''` / `[]`. Number `0` and `[null]` are NOT empty.
 */
export function validationValueIsEmpty(value: Json | undefined): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

/**
 * Postgres `char_length` counts CHARACTERS; JavaScript `.length` counts UTF-16
 * code units, so a single astral character (an emoji) is 1 in SQL and 2 in JS.
 * Spreading the string iterates code points, which is the agreeing count.
 */
function charLength(text: string): number {
  return [...text].length
}

/**
 * Does `value` SATISFY the rule? `true` = no violation.
 *
 * Absent / null / `''` values always satisfy: presence is `required`'s job
 * (and `required_if`'s), never a validation rule's. A rule that also rejected
 * emptiness would make every optional field secretly mandatory.
 *
 * `value` is the value from the ANSWER MAP in scope, never a raw `answers.value`
 * — a choice item keeps its payload in `answer_selected_options` and resolves to
 * a code string (or an array of codes) only in the map.
 *
 * ⚠ `regex` is the one arm where the two evaluators run DIFFERENT engines:
 * Postgres ARE here, `RegExp` there. They agree on the ordinary patterns an
 * author writes, and the golden vectors pin that agreement, but the SERVER is
 * the authority (Rule 1) — this side is live UX. An expression JS cannot compile
 * yields `true` here rather than a false accusation the server would not make.
 */
/**
 * Rule types the CLIENT deliberately does not evaluate — see the `regex` arm of
 * {@link evalValidation}. Exported so the wizard MAY badge them ("verificado ao
 * enviar") rather than silently showing nothing; it is not required to.
 */
export const CLIENT_UNEVALUATED_RULE_TYPES: readonly ValidationRuleType[] = ['regex']

export function evalValidation(
  spec: ValidationRuleSpec,
  value: Json | undefined,
  ctx: ValidationContext,
): boolean {
  if (validationValueIsEmpty(value)) return true

  switch (spec.ruleType) {
    case 'number_range': {
      if (typeof value !== 'number') return true
      const { min, max } = spec.config
      if (typeof min === 'number' && value < min) return false
      if (typeof max === 'number' && value > max) return false
      return true
    }

    case 'text_length': {
      if (typeof value !== 'string') return true
      const len = charLength(value)
      const { min, max } = spec.config
      if (typeof min === 'number' && len < min) return false
      if (typeof max === 'number' && len > max) return false
      return true
    }

    case 'regex':
      // QA r1 M-3 — THE CLIENT DOES NOT EVALUATE `regex`. It always reports
      // satisfied, and the SERVER is the sole authority for this arm.
      //
      // Postgres ARE and JS RegExp are different dialects, and the two disagree
      // SILENTLY: both compile, both return a boolean, and the booleans differ.
      // Measured on this stack over a 26-construct sample, ELEVEN diverge while
      // storing cleanly — every POSIX bracket expression (`[[:digit:]]`,
      // `[[:alpha:]]`, `[[:space:]]`, negated forms) and every PG-only escape
      // (`\y`, `\m`, `\M`, `\A`, `\Z`), plus `\b`, which is a word boundary in
      // JS and a backspace in ARE. The write-time compile probe in
      // `app.guard_item_validation_row` catches only patterns Postgres cannot
      // COMPILE (`{300}`, named groups, `\p{L}` -> HC0Q2); it cannot catch a
      // pattern that compiles in both and means different things.
      //
      // WHY NOT A WRITE-TIME DIALECT LINT: it would have to be an exhaustive
      // blocklist over two independently-specified, independently-evolving
      // grammars — the same "the specification named one artifact while reality
      // had two" trap one level up, and a lint that is 90% right still leaves the
      // 10% as an UNSUBMITTABLE RESPONSE. Rejecting the constructs would also be
      // wrong on the merits: `[[:digit:]]` is valid Postgres and, with the server
      // as sole authority, now behaves correctly.
      //
      // Not evaluating is total: it closes every divergence including the ones
      // nobody has enumerated, and it restores ruling 3's stated topology
      // ("`error` blocks submit ONLY, server-side"; the client twin is UX). The
      // cost is that a `regex` violation surfaces at submit rather than live —
      // with the author's own pt-BR message, via HC0P9.
      return true

    case 'date_range': {
      if (typeof value !== 'string') return true
      const { min, max } = spec.config
      if (typeof min === 'string' && value < min) return false
      if (typeof max === 'string' && value > max) return false
      return true
    }

    case 'datetime_order': {
      const sibling = ctx.answers[spec.config.question_key]
      // Nothing to compare against: the rule is inert, not violated. Whether the
      // sibling must be answered is the sibling's own business.
      if (validationValueIsEmpty(sibling)) return true
      if (typeof value !== 'string' || typeof sibling !== 'string') return true
      const cmp = value < sibling ? -1 : value > sibling ? 1 : 0
      switch (spec.config.op) {
        case 'before':
          return cmp < 0
        case 'after':
          return cmp > 0
        case 'not_before':
          return cmp >= 0
        case 'not_after':
          return cmp <= 0
      }
      return true
    }

    case 'unique_within_group': {
      const peers = ctx.peerValues ?? []
      return !peers.some((peer) => jsonEquals(peer, value))
    }
  }
}

/**
 * Is this item required RIGHT NOW? The TS mirror of SQL `app.item_is_required`.
 *
 * `answers` must be the map IN SCOPE — the top-level map for a flat item, the
 * instance-overlaid map for a repeating-group child — which is what makes a
 * per-instance `required_if` work with no instance-specific code.
 *
 * ⚠ VISIBILITY IS NOT CONSULTED HERE, and that is deliberate on both sides. A
 * hidden item is never required (ADR 0090 ruling 4), but the check belongs to the
 * CALLER, which must skip hidden items before asking. Folding visibility in here
 * would make the predicate need the item's own `visible_when` and quietly change
 * "visibility wins" from a structural property into a conditional one.
 */
export function itemIsRequired(
  required: boolean,
  requiredIf: RequiredIf | null | undefined,
  answers: AnswerMap,
): boolean {
  if (required) return true
  if (!requiredIf) return false
  // `evalVisibility`, not `evalCondition` — the SQL side calls
  // `app.eval_visibility`, which delegates to `app.eval_condition` for the
  // single-condition shape the CHECK currently allows. Mirroring the outer
  // call means widening that CHECK later needs no change on either side.
  return evalVisibility(requiredIf, answers)
}

/**
 * Builder pre-flight for ADR 0090 ruling 2: may this rule attach to this item?
 * The authority is the SQL coverage trigger (`app.validation_rule_allowed`);
 * this exists so the picker never offers a pair the server will refuse.
 *
 * `parentItemType` is the containing container's type (`null` for a top-level
 * item), which is the second half of `unique_within_group`'s coverage: "unique
 * across the instances of its group" is meaningless for an item with no
 * instances.
 */
export function isValidationRuleAllowed(
  ruleType: ValidationRuleType,
  itemType: string,
  parentItemType: string | null,
): boolean {
  if (!VALIDATION_RULE_COVERAGE[ruleType].includes(itemType)) return false
  if (ruleType === 'unique_within_group') {
    return parentItemType === 'repeating_group'
  }
  return true
}

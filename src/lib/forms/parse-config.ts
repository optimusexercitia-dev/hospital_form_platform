import type { Json } from '@/lib/types/database'

/**
 * Pure parser for a form item's `config` jsonb from the builder dialog's hidden
 * fields. Extracted from the `'use server'` actions module so it is UNIT-TESTABLE
 * directly (the action path — addItem/updateItem — was previously exercised only
 * via the DB, so a missing field-read here could go undetected; see the
 * flaggedWhen gap). `actions.ts` imports {@link parseItemConfig} and wraps its
 * error string into the `ActionState` shape.
 *
 * Per item type:
 *   - number/date        → `min`/`max` bounds (`configMin`/`configMax`);
 *   - free_text/short_text → `minLength`/`maxLength` CHARACTER limits
 *     (`configMinLength`/`configMaxLength`, integers ≥ 0);
 *   - multiple_choice/checkbox → `allowOther` (`configAllowOther` = '1');
 *   - number/date/time   → `flaggedWhen` ("Flagged If"), from `configFlaggedWhen`
 *     (a `JSON.stringify({op, value})` string; blank = none). Shape-validated here
 *     (op in the ordered/equality set + `value` present, scalar); the
 *     value-type-vs-item-type match is deferred to publish-time
 *     `app.is_valid_flagged_when`.
 * `min ≤ max` / `minLength ≤ maxLength` are enforced here (and again at submit).
 * Returns `{config: null}` when the type carries no config OR nothing is set.
 *
 * User-facing strings are pt-BR (raw errors never reach the UI).
 */

const MESSAGES = {
  configInvalid: 'Valores de mínimo/máximo inválidos.',
  configRangeInvalid: 'O valor mínimo não pode ser maior que o máximo.',
  lengthInvalid: 'Os limites de caracteres devem ser números inteiros não negativos.',
  lengthRangeInvalid: 'O mínimo de caracteres não pode ser maior que o máximo.',
  flaggedWhenInvalid: 'A condição "marcado se" é inválida.',
} as const

/** Types that accept optional min/max bounds via `config`. */
const BOUNDED_TYPES = ['number', 'date']
/** Free-text types that accept optional min/max CHARACTER limits via `config`. */
const TEXT_LENGTH_TYPES = ['free_text', 'short_text']
/** Choice types that may offer an "Outros" open option (dropdown excluded). */
const ALLOW_OTHER_TYPES = ['multiple_choice', 'checkbox']
/** Types that may carry a self-referential "Flagged If" (`config.flaggedWhen`). */
const FLAGGED_WHEN_TYPES = ['number', 'date', 'time']
/** The ops accepted in a `flaggedWhen` condition (ordered + equality; NOT `in`). */
const FLAGGED_WHEN_OPS = ['gt', 'gte', 'lt', 'lte', 'equals', 'not_equals']

export type ParseConfigResult = { error: string } | { config: Json }

/**
 * Parse the per-type `config` jsonb from `formData`. Returns `{ error }` (a pt-BR
 * string) on a malformed field, else `{ config }` (the assembled jsonb or `null`).
 */
export function parseItemConfig(
  itemType: string,
  formData: FormData,
): ParseConfigResult {
  const config: Record<string, Json> = {}

  if (BOUNDED_TYPES.includes(itemType)) {
    const rawMin = String(formData.get('configMin') ?? '').trim()
    const rawMax = String(formData.get('configMax') ?? '').trim()
    if (rawMin || rawMax) {
      const coerce = (raw: string): number | string | null => {
        if (!raw) return null
        if (itemType === 'number') {
          const n = Number(raw)
          return Number.isFinite(n) ? n : null
        }
        // date: ISO YYYY-MM-DD (shape only; submit RPC + client validate the value).
        return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
      }
      const min = coerce(rawMin)
      const max = coerce(rawMax)
      if ((rawMin && min === null) || (rawMax && max === null)) {
        return { error: MESSAGES.configInvalid }
      }
      if (
        min !== null &&
        max !== null &&
        ((typeof min === 'number' && typeof max === 'number' && min > max) ||
          (typeof min === 'string' && typeof max === 'string' && min > max))
      ) {
        return { error: MESSAGES.configRangeInvalid }
      }
      if (min !== null) config.min = min
      if (max !== null) config.max = max
    }
  }

  if (TEXT_LENGTH_TYPES.includes(itemType)) {
    const rawMin = String(formData.get('configMinLength') ?? '').trim()
    const rawMax = String(formData.get('configMaxLength') ?? '').trim()
    if (rawMin || rawMax) {
      const coerceLen = (raw: string): number | null => {
        if (!raw) return null
        if (!/^\d+$/.test(raw)) return null
        const n = Number.parseInt(raw, 10)
        return Number.isInteger(n) && n >= 0 ? n : null
      }
      const minLen = coerceLen(rawMin)
      const maxLen = coerceLen(rawMax)
      if ((rawMin && minLen === null) || (rawMax && maxLen === null)) {
        return { error: MESSAGES.lengthInvalid }
      }
      if (minLen !== null && maxLen !== null && minLen > maxLen) {
        return { error: MESSAGES.lengthRangeInvalid }
      }
      if (minLen !== null) config.minLength = minLen
      if (maxLen !== null) config.maxLength = maxLen
    }
  }

  if (ALLOW_OTHER_TYPES.includes(itemType)) {
    if (String(formData.get('configAllowOther') ?? '').trim() === '1') {
      config.allowOther = true
    }
  }

  if (FLAGGED_WHEN_TYPES.includes(itemType)) {
    const rawFlagged = String(formData.get('configFlaggedWhen') ?? '').trim()
    if (rawFlagged) {
      let parsed: unknown
      try {
        parsed = JSON.parse(rawFlagged)
      } catch {
        return { error: MESSAGES.flaggedWhenInvalid }
      }
      // Shape-check ONLY (op in set + scalar `value` present); the
      // value-type-vs-item-type match is deferred to `app.is_valid_flagged_when`.
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { error: MESSAGES.flaggedWhenInvalid }
      }
      const rec = parsed as Record<string, unknown>
      if (typeof rec.op !== 'string' || !FLAGGED_WHEN_OPS.includes(rec.op)) {
        return { error: MESSAGES.flaggedWhenInvalid }
      }
      if (!('value' in rec) || rec.value === null || typeof rec.value === 'object') {
        return { error: MESSAGES.flaggedWhenInvalid }
      }
      config.flaggedWhen = { op: rec.op, value: rec.value as Json }
    }
  }

  return { config: Object.keys(config).length > 0 ? config : null }
}

import {
  PARTICIPANT_TYPES,
  REFERENCE_KINDS,
} from '@/lib/forms/reference-constants'
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
  instancesInvalid:
    'A quantidade mínima/máxima de repetições deve ser um número inteiro não negativo.',
  instancesRangeInvalid:
    'A quantidade mínima de repetições não pode ser maior que a máxima.',
  riskBandsInvalid:
    'As faixas de risco são inválidas: informe uma pontuação mínima numérica e um rótulo para cada faixa.',
  riskBandsDuplicate:
    'Duas faixas de risco não podem ter a mesma pontuação mínima.',
  referenceKindInvalid: 'Selecione um tipo de referência válido.',
  participantTypesInvalid: 'Os tipos de participante selecionados são inválidos.',
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
/** FF-2 (ADR 0089 ruling 2): only a `risk_matrix` bands its derived score. */
const RISK_BANDS_TYPES = ['risk_matrix']
/** The 7-token palette (mirrors ColorToken / COLOR_TOKENS in queries/forms.ts). */
const RISK_BAND_COLORS = ['muted', 'slate', 'blue', 'amber', 'green', 'red', 'violet']

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

  // FF-1 (ADR 0087 substrate correction 1): repeating-group cardinality lives on
  // the CONTAINER item's `form_items.config` — NOT `form_versions.behavior_config`,
  // which is a per-VERSION bag and a different thing. The key names
  // (`minInstances`/`maxInstances`) are the contract with `ItemConfig` in
  // `src/lib/queries/forms.ts`; never rename them on this side.
  //   - `minInstances` is enforced by `submit_response` AFTER empty instances are
  //     pruned (ruling 3) — it is the ONLY required-ness a repeating group has,
  //     which is why the container itself always persists `required = false`.
  //   - `maxInstances` is enforced by the `add_group_instance` RPC.
  // A plain `group` has no instances, so it carries neither.
  if (itemType === 'repeating_group') {
    const rawMin = String(formData.get('configMinInstances') ?? '').trim()
    const rawMax = String(formData.get('configMaxInstances') ?? '').trim()
    if (rawMin || rawMax) {
      const coerceCount = (raw: string): number | null => {
        if (!raw) return null
        if (!/^\d+$/.test(raw)) return null
        const n = Number.parseInt(raw, 10)
        return Number.isInteger(n) && n >= 0 ? n : null
      }
      const minInstances = coerceCount(rawMin)
      const maxInstances = coerceCount(rawMax)
      if ((rawMin && minInstances === null) || (rawMax && maxInstances === null)) {
        return { error: MESSAGES.instancesInvalid }
      }
      if (
        minInstances !== null &&
        maxInstances !== null &&
        minInstances > maxInstances
      ) {
        return { error: MESSAGES.instancesRangeInvalid }
      }
      if (minInstances !== null) config.minInstances = minInstances
      if (maxInstances !== null) config.maxInstances = maxInstances
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

  // FF-2 (ADR 0089 ruling 2) — `config.riskBands`: the ordered score→band
  // mapping a risk_matrix uses to LABEL AND COLOUR its derived `risk_score`.
  //
  // The band is a PRESENTATION of the score, never stored on the answer: the
  // score is the durable fact, so re-banding a form never rewrites history. That
  // is the whole reason this lives in `config` and not in a column.
  //
  // Sorted ASCENDING by `minScore` here, once, so every consumer can take "the
  // last band the score reaches" without re-sorting — `toRiskBands` in
  // queries/forms.ts sorts the read side identically. A blank field yields NO
  // key at all (absent, not `[]`): an empty array would read as "banding is
  // configured and matches nothing".
  if (RISK_BANDS_TYPES.includes(itemType)) {
    const rawBands = String(formData.get('configRiskBands') ?? '').trim()
    if (rawBands) {
      let parsed: unknown
      try {
        parsed = JSON.parse(rawBands)
      } catch {
        return { error: MESSAGES.riskBandsInvalid }
      }
      if (!Array.isArray(parsed)) return { error: MESSAGES.riskBandsInvalid }

      const bands: { minScore: number; label: string; color: string | null }[] = []
      for (const entry of parsed) {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
          return { error: MESSAGES.riskBandsInvalid }
        }
        const rec = entry as Record<string, unknown>
        // `Number.isFinite` and not `typeof === 'number'`: NaN/Infinity survive a
        // JSON round trip through a hand-built payload and would make every
        // comparison against the score false, silently un-banding the item.
        if (typeof rec.minScore !== 'number' || !Number.isFinite(rec.minScore)) {
          return { error: MESSAGES.riskBandsInvalid }
        }
        if (typeof rec.label !== 'string' || rec.label.trim() === '') {
          return { error: MESSAGES.riskBandsInvalid }
        }
        // An unknown token is dropped to null rather than rejected — the palette
        // is presentational, and refusing to save a whole band list over a
        // colour is a worse trade than rendering it uncoloured.
        const color =
          typeof rec.color === 'string' && RISK_BAND_COLORS.includes(rec.color)
            ? rec.color
            : null
        bands.push({ minScore: rec.minScore, label: rec.label.trim(), color })
      }

      // Two bands at the same threshold make "the last band reached" ambiguous —
      // which band wins would depend on sort stability, not on the author.
      if (new Set(bands.map((b) => b.minScore)).size !== bands.length) {
        return { error: MESSAGES.riskBandsDuplicate }
      }

      if (bands.length > 0) {
        config.riskBands = [...bands].sort((a, b) => a.minScore - b.minScore)
      }
    }
  }

  // FF-5 (ADR 0091) — `config.referenceKind` + `config.participantTypes`: WHICH
  // entity lane a `reference` item targets, and (participant lane only) which
  // participant types are offered.
  //
  // ⚠ `referenceKind` IS THE SECURITY-RELEVANT HALF, not a display preference.
  // `app.save_reference_answers` resolves the lane from the stored config and
  // NEVER from the save payload, which is what makes "a commission item paired
  // with a participant target" unrepresentable rather than merely rejected. An
  // unknown value written here would therefore not fail loudly — it would fall
  // through the server's `coalesce(..., 'participant')` and silently turn the
  // item into a participant picker. So this parser REJECTS an unknown kind
  // rather than dropping the key.
  //
  // `participantTypes` takes the opposite treatment, and deliberately: unknown
  // members are DROPPED and an empty result yields NO KEY at all. Absent and
  // empty-array both mean "all types" to the server, so narrowing is a
  // convenience the author can get wrong without breaking the item — while the
  // real boundary (org containment, and case-scoping for `patient`) is
  // `app.guard_reference_coherent`, which this config cannot weaken.
  if (itemType === 'reference') {
    const rawKind = String(formData.get('configReferenceKind') ?? '').trim()
    if (rawKind) {
      // Widened to `readonly string[]` for the membership test: this is the
      // narrowing step itself, so the array cannot be typed as already-narrow.
      if (!(REFERENCE_KINDS as readonly string[]).includes(rawKind)) {
        return { error: MESSAGES.referenceKindInvalid }
      }
      config.referenceKind = rawKind
    }

    const rawTypes = String(formData.get('configParticipantTypes') ?? '').trim()
    if (rawTypes) {
      let parsed: unknown
      try {
        parsed = JSON.parse(rawTypes)
      } catch {
        return { error: MESSAGES.participantTypesInvalid }
      }
      if (!Array.isArray(parsed)) return { error: MESSAGES.participantTypesInvalid }
      const known = parsed.filter(
        (v): v is string =>
          typeof v === 'string' &&
          (PARTICIPANT_TYPES as readonly string[]).includes(v),
      )
      if (known.length > 0) config.participantTypes = known
    }
  }

  return { config: Object.keys(config).length > 0 ? config : null }
}

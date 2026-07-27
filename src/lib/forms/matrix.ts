import type { ColorToken, MatrixAxisEntry, RiskBand } from '@/lib/queries/forms'

import { generateOptionCode } from './option-code'

/**
 * FF-2 (ADR 0089) — the PURE matrix helpers shared by the builder and the
 * wizard.
 *
 * Plain TS, no React, no `'use client'`, no server-only imports — so the builder
 * dialog, the fill grid, the review summary and the unit tests all consume ONE
 * implementation. The type imports are erased at compile time, so importing the
 * domain types from `@/lib/queries/forms` here never drags the server supabase
 * client into a client bundle (BUG-FBE-005 is about VALUE imports).
 *
 * Two invariants this module exists to hold in one place:
 *
 *  1. **A `risk_score` is DERIVED, never round-tripped.** The save contract has
 *     no score field on purpose: the server computes
 *     `severityRow.weight * likelihoodColumn.weight` and ignores anything a
 *     client sends. {@link computeRiskScore} is therefore a DISPLAY computation
 *     only — it exists so the filler sees the consequence of a choice before
 *     saving, and its result must never be written anywhere.
 *  2. **An axis `code` is immutable once its row exists** (ruling 4, enforced by
 *     a BEFORE UPDATE trigger on draft AND published alike). Codes are minted
 *     CLIENT-SIDE by {@link mintAxisCode} exactly as option codes are, and the
 *     builder keeps sending the same code while the author renames the label.
 *     There is deliberately no "re-key" helper here: the fix for a typo'd code
 *     is remove + add, which the REPLACE semantics of `upsertMatrixAxes` handle
 *     in a single call.
 */

// ---------------------------------------------------------------------------
// Answer shapes (client-side mirrors of the BE contract)
// ---------------------------------------------------------------------------

/**
 * One `matrix` answer as the wizard holds it: `{ [rowCode]: colCode }`.
 *
 * Byte-identical to the per-item value of `saveSection`'s `matrixCellsByItemId`
 * and of `getResponseForFill`'s map of the same name, so a saved grid is sent
 * back verbatim. The nested-object shape is what makes ruling 1 ("each row takes
 * exactly ONE column") unrepresentable-if-violated before the DB's
 * `UNIQUE (answer_id, row_id)` ever has to catch it.
 */
export type MatrixCells = Record<string, string>

/** One `risk_matrix` answer as the wizard holds it. NO score: it is derived. */
export interface RiskSelection {
  /** `form_matrix_rows.code` of the chosen severity row. */
  severity: string
  /** `form_matrix_columns.code` of the chosen likelihood column. */
  likelihood: string
}

/** Matrix grids of one SCOPE (top level, or one repeating-group instance). */
export type MatrixCellsState = Record<string, MatrixCells>
/** Risk selections of one SCOPE, keyed by `risk_matrix` item id. */
export type RiskMatrixState = Record<string, RiskSelection>

// ---------------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------------

/**
 * Mint a stable axis `code` for a NEW entry — `slug(label)_suffix`, dodging the
 * codes already taken on that axis. Same generator as option codes, deliberately:
 * both are the clone-stable aggregation identity, and one format keeps the
 * builder, the RPC and the dashboards reading the same thing.
 *
 * Called ONCE, when the entry's label first becomes non-empty. Never call it on
 * an entry that already has a code — that is a re-key, which the DB refuses.
 */
export function mintAxisCode(label: string, taken: Iterable<string>): string {
  return generateOptionCode(label, new Set(taken))
}

// ---------------------------------------------------------------------------
// Risk score + bands
// ---------------------------------------------------------------------------

/**
 * The DISPLAY score for a risk selection: the product of the two axis weights,
 * or `null` when either half is unselected or its entry carries no weight.
 *
 * ⚠ Display only. The durable score is written by `app.save_risk_matrix_answers`
 * from the same two weights; a value produced here is never sent to the server
 * (the write contract has no score field) and never treated as authoritative.
 */
export function computeRiskScore(
  rows: readonly MatrixAxisEntry[],
  columns: readonly MatrixAxisEntry[],
  selection: RiskSelection | undefined,
): number | null {
  if (!selection) return null
  const severity = rows.find((r) => r.code === selection.severity)
  const likelihood = columns.find((c) => c.code === selection.likelihood)
  if (!severity || !likelihood) return null
  if (typeof severity.weight !== 'number' || typeof likelihood.weight !== 'number') {
    return null
  }
  return severity.weight * likelihood.weight
}

/**
 * The band a score falls in: the LAST band whose `minScore` the score reaches.
 *
 * `minScore` is inclusive and the query layer already returns `riskBands` sorted
 * ascending, but this re-sorts defensively — a band list read from a config that
 * was hand-edited (or from a builder preview mid-edit) must not be trusted to be
 * ordered. Returns `null` when there is no banding, or when the score is below
 * every threshold (the raw score is then the whole story).
 */
export function bandForScore(
  bands: readonly RiskBand[] | null | undefined,
  score: number | null,
): RiskBand | null {
  if (score === null || bands == null || bands.length === 0) return null
  const ordered = [...bands].sort((a, b) => a.minScore - b.minScore)
  let match: RiskBand | null = null
  for (const band of ordered) {
    if (score >= band.minScore) match = band
    else break
  }
  return match
}

/** A score as pt-BR text (drops a trailing ".0"; keeps decimals when real). */
export function formatRiskScore(score: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(score)
}

// ---------------------------------------------------------------------------
// Completeness (ruling 3 — the client mirror of `app.item_required_satisfied`)
// ---------------------------------------------------------------------------

/**
 * The row codes of a required `matrix` that are still unanswered.
 *
 * ADR 0089 ruling 3: a required matrix is ROW-COMPLETE — every row must carry a
 * cell, not merely one row somewhere. Axis rows carry no visibility conditions,
 * so "every visible row" reduces to every row; ITEM visibility still wins, and
 * that is the caller's job (a hidden matrix is never validated at all).
 *
 * A cell whose stored column code is not on the axis counts as UNANSWERED: it
 * cannot render, so treating it as an answer would let submit pass on a
 * selection the user cannot see. The coherence trigger makes it unreachable in
 * practice.
 */
export function missingMatrixRows(
  rows: readonly MatrixAxisEntry[],
  columns: readonly MatrixAxisEntry[],
  cells: MatrixCells | undefined,
): string[] {
  const columnCodes = new Set(columns.map((c) => c.code))
  return rows
    .filter((row) => {
      const chosen = cells?.[row.code]
      return chosen === undefined || !columnCodes.has(chosen)
    })
    .map((row) => row.code)
}

/** True when every row of a `matrix` carries a cell (ruling 3). */
export function isMatrixComplete(
  rows: readonly MatrixAxisEntry[],
  columns: readonly MatrixAxisEntry[],
  cells: MatrixCells | undefined,
): boolean {
  if (rows.length === 0) return true
  return missingMatrixRows(rows, columns, cells).length === 0
}

/**
 * True when a `risk_matrix` holds BOTH halves and both resolve on their axis.
 * A half-filled selection is rejected server-side with `HC0P8`; the wizard makes
 * it unreachable by only ever committing a whole cell.
 */
export function isRiskComplete(
  rows: readonly MatrixAxisEntry[],
  columns: readonly MatrixAxisEntry[],
  selection: RiskSelection | undefined,
): boolean {
  if (!selection) return false
  if (!selection.severity || !selection.likelihood) return false
  return (
    rows.some((r) => r.code === selection.severity) &&
    columns.some((c) => c.code === selection.likelihood)
  )
}

/** Whether a matrix answer holds anything at all — the presence test the empty
 *  state and the review screen use. */
export function hasMatrixAnswer(cells: MatrixCells | undefined): boolean {
  return cells != null && Object.keys(cells).length > 0
}

// ---------------------------------------------------------------------------
// Builder-side axis validation (pre-flight for `upsertMatrixAxes`)
// ---------------------------------------------------------------------------

/**
 * One axis entry as the BUILDER holds it while editing. Mirrors
 * `MatrixAxisInput` in `src/lib/forms/actions.ts` — the payload shape, addressed
 * by `code`, never by row id — plus the client-only `key` that keeps React
 * identity attached to a logical entry across add/remove/reorder.
 */
export interface AxisDraft {
  /** Stable client-side row identity. NEVER persisted. */
  key: string
  /** The immutable axis code. Empty only until the label is first typed. */
  code: string
  label: string
  /** `risk_matrix` only; `null` for a plain `matrix`. */
  weight: number | null
}

/**
 * A local-only row key. Avoids `crypto.randomUUID()` on purpose: the Web Crypto
 * API is exposed only in secure contexts, so it throws on a plain-HTTP
 * deployment and would take the whole builder down the instant a matrix block
 * renders (the same reason `options-editor.tsx` avoids it).
 */
export function nextAxisKey(): string {
  return `axis_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

/** A blank axis entry for a freshly-added row/column. */
export function blankAxisEntry(): AxisDraft {
  return { key: nextAxisKey(), code: '', label: '', weight: null }
}

/** Map persisted axis entries to the builder's editable drafts. */
export function toAxisDrafts(
  entries: readonly MatrixAxisEntry[] | null | undefined,
): AxisDraft[] {
  return (entries ?? []).map((entry) => ({
    key: nextAxisKey(),
    code: entry.code,
    label: entry.label,
    weight: entry.weight,
  }))
}

/** The pt-BR problems that would make `upsertMatrixAxes` reject this payload, or
 *  `null` when it is sound. Pre-flight only — the RPC stays the authority. */
export function validateAxes(
  rows: readonly AxisDraft[],
  columns: readonly AxisDraft[],
  weighted: boolean,
): string | null {
  if (rows.length === 0) return 'Adicione ao menos uma linha.'
  if (columns.length === 0) return 'Adicione ao menos uma coluna.'

  for (const [axis, entries] of [
    ['linha', rows],
    ['coluna', columns],
  ] as const) {
    if (entries.some((e) => e.label.trim() === '')) {
      return `Cada ${axis} precisa de um rótulo.`
    }
    const labels = entries.map((e) => e.label.trim().toLocaleLowerCase('pt-BR'))
    if (new Set(labels).size !== labels.length) {
      return `Há ${axis}s com o mesmo rótulo. Use rótulos distintos.`
    }
    const codes = entries.map((e) => e.code)
    if (new Set(codes).size !== codes.length) {
      return `Há ${axis}s com o mesmo código. Remova a duplicada e adicione novamente.`
    }
    // Ruling 2: a risk_matrix needs a weight on EVERY entry of BOTH axes. The
    // RPC rejects a gap with HC0P6 and publish re-checks it; validating here
    // spares the author a round trip to learn it.
    if (weighted && entries.some((e) => e.weight === null || !Number.isFinite(e.weight))) {
      return `Informe o peso de cada ${axis} da matriz de risco.`
    }
  }
  return null
}

/** Serialize the drafts to the `upsertMatrixAxes` payload: the COMPLETE desired
 *  axis, positions by index, weights only when the type uses them. */
export function toAxisPayload(
  entries: readonly AxisDraft[],
  weighted: boolean,
): { code: string; label: string; position: number; weight?: number | null }[] {
  return entries.map((entry, index) => ({
    code: entry.code,
    label: entry.label.trim(),
    position: index,
    weight: weighted ? entry.weight : null,
  }))
}

// ---------------------------------------------------------------------------
// Builder-side band validation
// ---------------------------------------------------------------------------

/** One band as the builder holds it (a `minScore` buffer, so a half-typed
 *  number never collapses to 0). */
export interface BandDraft {
  key: string
  minScore: string
  label: string
  color: ColorToken | null
}

export function blankBand(): BandDraft {
  return {
    key: `band_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
    minScore: '',
    label: '',
    color: null,
  }
}

export function toBandDrafts(bands: readonly RiskBand[] | null | undefined): BandDraft[] {
  return (bands ?? []).map((band) => ({
    key: `band_${Math.random().toString(36).slice(2)}`,
    minScore: String(band.minScore),
    label: band.label,
    color: band.color,
  }))
}

/** The pt-BR problem with the band list, or `null`. An EMPTY list is valid —
 *  no banding means the raw score is shown, which is a legitimate choice. */
export function validateBands(bands: readonly BandDraft[]): string | null {
  const thresholds: number[] = []
  for (const band of bands) {
    if (band.label.trim() === '') return 'Cada faixa precisa de um rótulo.'
    const parsed = Number(band.minScore.trim().replace(',', '.'))
    if (band.minScore.trim() === '' || !Number.isFinite(parsed)) {
      return 'Cada faixa precisa de uma pontuação mínima numérica.'
    }
    thresholds.push(parsed)
  }
  if (new Set(thresholds).size !== thresholds.length) {
    return 'Duas faixas não podem ter a mesma pontuação mínima.'
  }
  return null
}

/** Serialize bands to `config.riskBands`, sorted ascending by `minScore` — the
 *  order every consumer (and `toRiskBands` in the query layer) assumes. */
export function toBandPayload(bands: readonly BandDraft[]): RiskBand[] {
  return bands
    .map((band) => ({
      minScore: Number(band.minScore.trim().replace(',', '.')),
      label: band.label.trim(),
      color: band.color,
    }))
    .filter((band) => Number.isFinite(band.minScore) && band.label !== '')
    .sort((a, b) => a.minScore - b.minScore)
}

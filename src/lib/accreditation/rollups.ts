/**
 * Standards Crosswalk & Readiness/Gap Engine v2 (Phase 16) — presentation
 * rollup math shared by the commission readiness surface and (from Wave 3
 * onward) the hospital consolidated dashboard.
 *
 * Pure, no I/O — importable from client or server. The DB doors
 * (`readiness_report` et al., `src/lib/queries/accreditation.ts`) already do
 * the per-standard work: freshness classification, restricted-artifact
 * masking, and (for the hospital door) worst-wins consolidation. This module
 * does only the ADR 0093 D3 arithmetic that turns those flat per-standard
 * rows into the two presentation shapes the UI needs:
 *
 *  - **Leveled (ONA) frameworks** — every standard carries `level` 1|2|3.
 *    Certification is CUMULATIVE (D3): Level N readiness requires EVERY
 *    standard at level <= N to be "clean" (self-assessed `conforme`, or
 *    legitimately `nao_aplicavel` — D3 does not name `nao_aplicavel`
 *    explicitly, but ADR 0093's own vocabulary doc calls it "a legitimate
 *    terminal state ... distinct from not yet assessed", so it cannot block
 *    a level the way an unassessed or non-conforming standard does).
 *    {@link computeReadinessRollups} returns one {@link LevelRollup} per
 *    level 1..3, each carrying a CUMULATIVE `blockingGaps` list — "o que
 *    bloqueia o Nível N?" — and a `certifiable` flag that is `true` iff that
 *    list is empty. `certifiable` is the single source of truth for whether a
 *    level may be claimed; nothing else in this module or its callers should
 *    re-derive that boolean.
 *  - **Non-leveled (JCI-shaped) frameworks** — every standard has
 *    `level: null`. Standards roll up under their top-level tree node (a
 *    "chapter"); {@link computeReadinessRollups} returns one
 *    {@link ChapterRollup} per top-level node of the supplied
 *    {@link StandardTreeNode} forest, plus an `overallPct` across every
 *    standard in the framework.
 *
 * Freshness is NEVER collapsed (D5 — "a link is a claim, not proof"; stale
 * evidence never silently counts as evidenced). Every rollup shape that
 * surfaces evidence counts carries the full `evidenceValida` /
 * `evidenceAtencao` / `evidenceVencida` / `evidenceRestrita` split as four
 * separate numeric fields — never a combined total. `rollups.test.ts`
 * encodes this as a structural invariant (`describe('freshness split is
 * never collapsed')`) so an edit that introduces a collapsed total fails a
 * test rather than silently regressing.
 */

import type { AssessmentStatus, ReadinessRow, StandardLevel, StandardTreeNode } from './types'

// ---------------------------------------------------------------------------
// Output shapes
// ---------------------------------------------------------------------------

/** One standard that is currently blocking readiness (its own or a level/chapter it belongs to). */
export interface GapItem {
  standardId: string
  standardCode: string
  standardTitle: string
  level: StandardLevel | null
  /** `null` = never assessed — a gap, same as `parcial`/`nao_conforme`. */
  assessmentStatus: AssessmentStatus | null
  evidenceValida: number
  evidenceAtencao: number
  evidenceVencida: number
  evidenceRestrita: number
}

/** Per-level (ONA) rollup — one entry per level 1, 2, 3, always all three. */
export interface LevelRollup {
  level: StandardLevel
  /** Standards whose `level` equals THIS level only (not cumulative). */
  totalStandards: number
  /** Of `totalStandards`, how many are clean (`conforme` or `nao_aplicavel`). */
  cleanStandards: number
  /** `cleanStandards / totalStandards * 100`, own-level only (not cumulative); `100` when `totalStandards` is `0` (vacuously clean). */
  readinessPct: number
  /**
   * Cumulative (D3): `true` iff every standard at level <= this level is
   * clean, i.e. iff `blockingGaps` is empty. This is the ONLY field that
   * answers "may this level be certified?" — `readinessPct` alone is NOT
   * sufficient (a level can read 100% on its own standards while a lower
   * level's gap still blocks it).
   */
  certifiable: boolean
  /**
   * "O que bloqueia o Nível N?" — every gap at this level AND at every level
   * below it, sorted by level then standard code. Empty iff `certifiable`.
   */
  blockingGaps: GapItem[]
  /** Evidence split summed across this level's own standards (not cumulative). */
  evidenceValida: number
  evidenceAtencao: number
  evidenceVencida: number
  evidenceRestrita: number
}

/** Per-chapter (non-leveled / JCI) rollup — one entry per top-level tree node. */
export interface ChapterRollup {
  chapterId: string
  chapterCode: string
  chapterTitle: string
  /** Standards in this chapter's subtree, INCLUDING the chapter node itself. */
  totalStandards: number
  cleanStandards: number
  /** `cleanStandards / totalStandards * 100`; `100` when `totalStandards` is `0`. */
  readinessPct: number
  /** Every non-clean standard in this chapter's subtree, sorted by code. */
  gaps: GapItem[]
  evidenceValida: number
  evidenceAtencao: number
  evidenceVencida: number
  evidenceRestrita: number
}

/** The full result of {@link computeReadinessRollups} for one framework's readiness rows. */
export interface ReadinessRollups {
  /** `true` when any row carries a non-null `level` (ONA-shaped). Derived from the rows, not asserted by the caller. */
  leveled: boolean
  /** Populated only when `leveled`; otherwise `[]`. */
  levels: LevelRollup[]
  /** Populated only when NOT `leveled`; otherwise `[]`. Requires the `tree` argument — `[]` if it was omitted. */
  chapters: ChapterRollup[]
  /** Overall %, non-leveled frameworks only; `null` when leveled or when there are no standards. */
  overallPct: number | null
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const LEVELS: readonly StandardLevel[] = [1, 2, 3]

/**
 * Whether a standard's self-assessment counts as "clean" — i.e. does NOT
 * block certification. `conforme` obviously; `nao_aplicavel` is a deliberate,
 * legitimate terminal state (the standard is out of this commission's scope)
 * and must not be conflated with "not yet assessed". Everything else
 * (`null`, `parcial`, `nao_conforme`) is a gap.
 */
export function isCleanAssessment(status: AssessmentStatus | null): boolean {
  return status === 'conforme' || status === 'nao_aplicavel'
}

function toGapItem(row: ReadinessRow): GapItem {
  return {
    standardId: row.standardId,
    standardCode: row.standardCode,
    standardTitle: row.standardTitle,
    level: row.level,
    assessmentStatus: row.assessmentStatus,
    evidenceValida: row.evidenceValida,
    evidenceAtencao: row.evidenceAtencao,
    evidenceVencida: row.evidenceVencida,
    evidenceRestrita: row.evidenceRestrita,
  }
}

/** Stable order for gap lists: by level (nulls last), then by standard code. */
function gapSort(a: GapItem, b: GapItem): number {
  const levelA = a.level ?? Number.POSITIVE_INFINITY
  const levelB = b.level ?? Number.POSITIVE_INFINITY
  if (levelA !== levelB) return levelA - levelB
  return a.standardCode.localeCompare(b.standardCode, 'pt-BR')
}

/** Round to one decimal place — enough precision for a readiness %, no float noise in the UI. */
function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function pctClean(rows: ReadinessRow[]): number {
  if (rows.length === 0) return 100
  const clean = rows.filter((r) => isCleanAssessment(r.assessmentStatus)).length
  return round1((clean / rows.length) * 100)
}

interface EvidenceTotals {
  evidenceValida: number
  evidenceAtencao: number
  evidenceVencida: number
  evidenceRestrita: number
}

function sumEvidence(rows: ReadinessRow[]): EvidenceTotals {
  return rows.reduce<EvidenceTotals>(
    (acc, r) => ({
      evidenceValida: acc.evidenceValida + r.evidenceValida,
      evidenceAtencao: acc.evidenceAtencao + r.evidenceAtencao,
      evidenceVencida: acc.evidenceVencida + r.evidenceVencida,
      evidenceRestrita: acc.evidenceRestrita + r.evidenceRestrita,
    }),
    { evidenceValida: 0, evidenceAtencao: 0, evidenceVencida: 0, evidenceRestrita: 0 },
  )
}

// ---------------------------------------------------------------------------
// Leveled (ONA) rollup
// ---------------------------------------------------------------------------

function buildLevelRollups(rows: ReadinessRow[]): LevelRollup[] {
  let cumulativeGaps: GapItem[] = []

  return LEVELS.map((level) => {
    const levelRows = rows.filter((r) => r.level === level)
    const ownGaps = levelRows.filter((r) => !isCleanAssessment(r.assessmentStatus)).map(toGapItem)
    // Cumulative BEFORE evaluating certifiability at this level (D3): a lower
    // level's gap must block THIS level even when this level's own standards
    // are all clean.
    cumulativeGaps = [...cumulativeGaps, ...ownGaps].sort(gapSort)

    const cleanCount = levelRows.length - ownGaps.length
    const evidence = sumEvidence(levelRows)

    return {
      level,
      totalStandards: levelRows.length,
      cleanStandards: cleanCount,
      readinessPct: pctClean(levelRows),
      certifiable: cumulativeGaps.length === 0,
      blockingGaps: cumulativeGaps,
      ...evidence,
    }
  })
}

// ---------------------------------------------------------------------------
// Non-leveled (JCI) rollup
// ---------------------------------------------------------------------------

function flattenTree(nodes: StandardTreeNode[]): StandardTreeNode[] {
  const out: StandardTreeNode[] = []
  for (const node of nodes) {
    out.push(node)
    out.push(...flattenTree(node.children))
  }
  return out
}

function buildChapterRollup(
  chapterNode: StandardTreeNode,
  rowsById: Map<string, ReadinessRow>,
): ChapterRollup {
  // Tolerate a tree node without a matching readiness row (defensive only —
  // `readiness_report` should return one row per standard in the framework,
  // but a node that changed between the tree fetch and the report fetch
  // should degrade gracefully rather than crash the dashboard).
  const memberRows = flattenTree([chapterNode])
    .map((node) => rowsById.get(node.id))
    .filter((row): row is ReadinessRow => row !== undefined)

  const gaps = memberRows
    .filter((r) => !isCleanAssessment(r.assessmentStatus))
    .map(toGapItem)
    .sort(gapSort)
  const evidence = sumEvidence(memberRows)

  return {
    chapterId: chapterNode.id,
    chapterCode: chapterNode.code,
    chapterTitle: chapterNode.title,
    totalStandards: memberRows.length,
    cleanStandards: memberRows.length - gaps.length,
    readinessPct: pctClean(memberRows),
    gaps,
    ...evidence,
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Compute the presentation rollups for one framework's readiness rows.
 *
 * @param rows The commission's per-standard readiness rows (`getReadinessReport`).
 * @param tree The framework's standard hierarchy (`getStandardTree`), needed
 *   ONLY for the non-leveled chapter grouping. Omit (or pass `[]`) for a
 *   leveled framework, or when you only need the level rollups.
 *
 * Whether the framework is leveled is DERIVED from `rows` (any row with a
 * non-null `level`) rather than taken as a caller-supplied flag — the rows
 * are the ground truth for what was actually returned. `rows: []` (no
 * standards yet, or the flag is off) resolves to non-leveled with empty
 * output, never a crash.
 */
export function computeReadinessRollups(
  rows: ReadinessRow[],
  tree: StandardTreeNode[] = [],
): ReadinessRollups {
  const leveled = rows.some((r) => r.level !== null)

  if (leveled) {
    return {
      leveled: true,
      levels: buildLevelRollups(rows),
      chapters: [],
      overallPct: null,
    }
  }

  const rowsById = new Map(rows.map((r) => [r.standardId, r]))
  return {
    leveled: false,
    levels: [],
    chapters: tree.map((node) => buildChapterRollup(node, rowsById)),
    overallPct: rows.length === 0 ? null : pctClean(rows),
  }
}

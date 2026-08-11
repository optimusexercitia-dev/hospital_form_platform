import { describe, expect, it } from 'vitest'

import { computeReadinessRollups, isCleanAssessment } from './rollups'
import type { AssessmentStatus, ReadinessRow, StandardTreeNode } from './types'

/**
 * Phase 16 (ADR 0093 D3/D5) — the rollup math shared by the commission and
 * (future) hospital readiness surfaces.
 *
 * These cover the two rules the ADR calls out as easy to get subtly wrong:
 * certification is CUMULATIVE across ONA levels (a clean level can still be
 * blocked by a lower level's gap), and evidence freshness counts are NEVER
 * collapsed into a single total (D5's "a link is a claim, not proof").
 */

let seq = 0
function row(overrides: Partial<ReadinessRow> = {}): ReadinessRow {
  seq += 1
  return {
    standardId: `std-${seq}`,
    standardCode: `${seq}`.padStart(3, '0'),
    standardTitle: `Standard ${seq}`,
    level: null,
    assessmentStatus: null,
    evidenceValida: 0,
    evidenceAtencao: 0,
    evidenceVencida: 0,
    evidenceRestrita: 0,
    ...overrides,
  }
}

function node(
  id: string,
  code: string,
  title: string,
  children: StandardTreeNode[] = [],
): StandardTreeNode {
  return {
    id,
    frameworkId: 'fw-1',
    parentId: null,
    code,
    title,
    descriptionMd: null,
    position: 0,
    level: null,
    children,
  }
}

describe('isCleanAssessment', () => {
  it('treats conforme and nao_aplicavel as clean', () => {
    expect(isCleanAssessment('conforme')).toBe(true)
    expect(isCleanAssessment('nao_aplicavel')).toBe(true)
  })

  it('treats null, parcial, and nao_conforme as gaps', () => {
    expect(isCleanAssessment(null)).toBe(false)
    expect(isCleanAssessment('parcial')).toBe(false)
    expect(isCleanAssessment('nao_conforme')).toBe(false)
  })

  it('is exhaustive over every AssessmentStatus value', () => {
    const statuses: AssessmentStatus[] = ['conforme', 'parcial', 'nao_conforme', 'nao_aplicavel']
    // Sanity check that the fixture list itself matches the type — if a future
    // status value is added and this file isn't updated, this still exercises
    // every value the type PROMISES today.
    expect(statuses).toHaveLength(4)
    expect(statuses.map(isCleanAssessment)).toEqual([true, false, false, true])
  })
})

describe('computeReadinessRollups — leveled (ONA) framework: cumulative level gating', () => {
  it('is certifiable at a level only when every standard at or below it is clean', () => {
    const rows = [
      row({ standardId: 's1', standardCode: '1', level: 1, assessmentStatus: 'conforme' }),
      row({ standardId: 's2', standardCode: '2', level: 2, assessmentStatus: 'conforme' }),
      row({ standardId: 's3', standardCode: '3', level: 3, assessmentStatus: 'nao_conforme' }),
    ]
    const result = computeReadinessRollups(rows)

    expect(result.leveled).toBe(true)
    expect(result.levels).toHaveLength(3)
    const [l1, l2, l3] = result.levels

    expect(l1.certifiable).toBe(true)
    expect(l1.blockingGaps).toEqual([])
    expect(l2.certifiable).toBe(true)
    expect(l2.blockingGaps).toEqual([])
    expect(l3.certifiable).toBe(false)
    expect(l3.blockingGaps.map((g) => g.standardId)).toEqual(['s3'])
  })

  it('THE BOUNDARY CASE: a clean level 2 must NOT certify when level 1 has a gap', () => {
    // Level 1 has a non-conforming standard; level 2's OWN standards are all
    // conforme. Level 2 must still read certifiable=false, and its
    // blockingGaps list must surface the level-1 gap — this is the exact
    // cumulative-gating boundary ADR 0093 D3 calls out.
    const rows = [
      row({ standardId: 's1', standardCode: '1', level: 1, assessmentStatus: 'nao_conforme' }),
      row({ standardId: 's2', standardCode: '2', level: 2, assessmentStatus: 'conforme' }),
      row({ standardId: 's3', standardCode: '3', level: 2, assessmentStatus: 'conforme' }),
    ]
    const result = computeReadinessRollups(rows)
    const [l1, l2, l3] = result.levels

    expect(l1.certifiable).toBe(false)
    expect(l1.blockingGaps.map((g) => g.standardId)).toEqual(['s1'])

    // The load-bearing assertion: level 2's OWN standards are 100% clean...
    expect(l2.totalStandards).toBe(2)
    expect(l2.cleanStandards).toBe(2)
    expect(l2.readinessPct).toBe(100)
    // ...yet level 2 is NOT certifiable, because certification is cumulative.
    expect(l2.certifiable).toBe(false)
    expect(l2.blockingGaps.map((g) => g.standardId)).toEqual(['s1'])

    // Level 3 has no standards of its own but still inherits the level-1 gap.
    expect(l3.totalStandards).toBe(0)
    expect(l3.readinessPct).toBe(100) // vacuous on ITS OWN standards
    expect(l3.certifiable).toBe(false) // but still blocked cumulatively
    expect(l3.blockingGaps.map((g) => g.standardId)).toEqual(['s1'])
  })

  it('a never-assessed standard (null status) blocks its level, same as an explicit gap', () => {
    const rows = [row({ standardId: 's1', level: 1, assessmentStatus: null })]
    const [l1] = computeReadinessRollups(rows).levels
    expect(l1.certifiable).toBe(false)
    expect(l1.blockingGaps.map((g) => g.standardId)).toEqual(['s1'])
    expect(l1.blockingGaps[0].assessmentStatus).toBeNull()
  })

  it('nao_aplicavel does not block its level', () => {
    const rows = [
      row({ standardId: 's1', level: 1, assessmentStatus: 'nao_aplicavel' }),
      row({ standardId: 's2', level: 1, assessmentStatus: 'conforme' }),
    ]
    const [l1] = computeReadinessRollups(rows).levels
    expect(l1.certifiable).toBe(true)
    expect(l1.cleanStandards).toBe(2)
  })

  it('a parcial standard blocks exactly like nao_conforme', () => {
    const rows = [row({ standardId: 's1', level: 1, assessmentStatus: 'parcial' })]
    const [l1] = computeReadinessRollups(rows).levels
    expect(l1.certifiable).toBe(false)
    expect(l1.blockingGaps).toHaveLength(1)
  })

  it('always returns exactly three level entries (1, 2, 3), even when some levels have zero standards', () => {
    const rows = [row({ standardId: 's1', level: 2, assessmentStatus: 'conforme' })]
    const result = computeReadinessRollups(rows)
    expect(result.levels.map((l) => l.level)).toEqual([1, 2, 3])
    expect(result.levels[0].totalStandards).toBe(0)
    expect(result.levels[0].certifiable).toBe(true) // vacuously clean
    expect(result.levels[2].totalStandards).toBe(0)
  })

  it('sorts blockingGaps by level then by standard code', () => {
    const rows = [
      row({ standardId: 's-b', standardCode: '020', level: 1, assessmentStatus: 'nao_conforme' }),
      row({ standardId: 's-a', standardCode: '010', level: 1, assessmentStatus: 'nao_conforme' }),
      row({ standardId: 's-c', standardCode: '005', level: 2, assessmentStatus: 'nao_conforme' }),
    ]
    const [, l2] = computeReadinessRollups(rows).levels
    expect(l2.blockingGaps.map((g) => g.standardCode)).toEqual(['010', '020', '005'])
  })

  it('does not populate chapters or overallPct for a leveled framework', () => {
    const rows = [row({ level: 1, assessmentStatus: 'conforme' })]
    const result = computeReadinessRollups(rows)
    expect(result.chapters).toEqual([])
    expect(result.overallPct).toBeNull()
  })
})

describe('computeReadinessRollups — non-leveled (JCI) framework: chapter % and overall %', () => {
  it('rolls up a chapter subtree (including the chapter node itself) into one %', () => {
    const chapterA = node('ch-a', 'AOP', 'Access & Assessment', [
      node('ch-a-1', 'AOP.1', 'Screening'),
      node('ch-a-2', 'AOP.2', 'Reassessment'),
    ])
    const rows = [
      row({ standardId: 'ch-a', standardCode: 'AOP', assessmentStatus: 'conforme' }),
      row({ standardId: 'ch-a-1', standardCode: 'AOP.1', assessmentStatus: 'conforme' }),
      row({ standardId: 'ch-a-2', standardCode: 'AOP.2', assessmentStatus: 'nao_conforme' }),
    ]
    const result = computeReadinessRollups(rows, [chapterA])

    expect(result.leveled).toBe(false)
    expect(result.chapters).toHaveLength(1)
    const [chapter] = result.chapters
    expect(chapter.chapterId).toBe('ch-a')
    expect(chapter.totalStandards).toBe(3)
    expect(chapter.cleanStandards).toBe(2)
    // 2/3 = 66.666... -> rounded to one decimal
    expect(chapter.readinessPct).toBeCloseTo(66.7, 5)
    expect(chapter.gaps.map((g) => g.standardId)).toEqual(['ch-a-2'])
  })

  it('computes overallPct across every standard in the framework, independent of chapter grouping', () => {
    const tree = [node('ch-a', 'AOP', 'Access'), node('ch-b', 'PCI', 'Infection Control')]
    const rows = [
      row({ standardId: 'ch-a', standardCode: 'AOP', assessmentStatus: 'conforme' }),
      row({ standardId: 'ch-b', standardCode: 'PCI', assessmentStatus: 'nao_conforme' }),
    ]
    const result = computeReadinessRollups(rows, tree)
    expect(result.overallPct).toBe(50)
  })

  it('returns one ChapterRollup per top-level tree node, not per leaf', () => {
    const tree = [
      node('ch-a', 'AOP', 'A', [node('ch-a-1', 'AOP.1', 'A.1')]),
      node('ch-b', 'PCI', 'B'),
    ]
    const rows = [
      row({ standardId: 'ch-a', standardCode: 'AOP', assessmentStatus: 'conforme' }),
      row({ standardId: 'ch-a-1', standardCode: 'AOP.1', assessmentStatus: 'conforme' }),
      row({ standardId: 'ch-b', standardCode: 'PCI', assessmentStatus: 'conforme' }),
    ]
    const result = computeReadinessRollups(rows, tree)
    expect(result.chapters).toHaveLength(2)
    expect(result.chapters[0].totalStandards).toBe(2)
    expect(result.chapters[1].totalStandards).toBe(1)
  })

  it('does not populate levels for a non-leveled framework', () => {
    const rows = [row({ assessmentStatus: 'conforme' })]
    const result = computeReadinessRollups(rows, [])
    expect(result.levels).toEqual([])
  })

  it('tolerates a tree node with no matching readiness row instead of crashing', () => {
    const tree = [node('ch-a', 'AOP', 'Access', [node('ghost', 'AOP.9', 'Not in rows')])]
    const rows = [row({ standardId: 'ch-a', standardCode: 'AOP', assessmentStatus: 'conforme' })]
    const result = computeReadinessRollups(rows, tree)
    expect(result.chapters[0].totalStandards).toBe(1)
    expect(result.chapters[0].gaps).toEqual([])
  })
})

describe('computeReadinessRollups — empty / no-standards cases', () => {
  it('returns empty output for an empty framework with no tree argument', () => {
    const result = computeReadinessRollups([])
    expect(result).toEqual({
      leveled: false,
      levels: [],
      chapters: [],
      overallPct: null,
    })
  })

  it('returns empty chapters for an empty framework even when a tree is supplied', () => {
    // No rows means "leveled" is derived false and the (non-existent) chapters
    // have nothing to map — an empty tree with no rows is likewise empty, not
    // a crash.
    const result = computeReadinessRollups([], [node('ch-a', 'AOP', 'Access')])
    // No rows for the tree node -> the chapter rolls up to zero standards.
    expect(result.chapters).toHaveLength(1)
    expect(result.chapters[0].totalStandards).toBe(0)
    expect(result.chapters[0].readinessPct).toBe(100) // vacuous
  })
})

describe('freshness split is never collapsed (ADR 0093 D5)', () => {
  function assertNeverCollapsed(record: object): void {
    const keys = Object.keys(record)
    // FUP-VACUOUS-AUDIT-1 — this was `if (!hasAnyEvidenceField) return`, which
    // exempted the WORST case: a record that dropped the freshness fields entirely
    // is the most complete collapse there is, and the guard answered it by returning
    // silently. All three call sites assert "carries the full four-way split", so
    // the absence of evidence fields is a failure, never a reason to skip.
    // It also made the caller at "every GapItem …" a test with no reachable
    // assertion at all, since the helper is its only check.
    expect(
      keys.filter((k) => k.startsWith('evidence')),
      'record carries NO evidence fields at all — the freshness split collapsed completely',
    ).not.toHaveLength(0)
    // The four-way split must appear together — never a bare aggregate like
    // `evidenceCount` or `evidenceTotal` standing in for it.
    expect(keys).toEqual(
      expect.arrayContaining(['evidenceValida', 'evidenceAtencao', 'evidenceVencida', 'evidenceRestrita']),
    )
    expect(keys.filter((k) => k.startsWith('evidence'))).toHaveLength(4)
  }

  it('every LevelRollup carries the full four-way split, never a collapsed total', () => {
    const rows = [
      row({
        standardId: 's1',
        level: 1,
        assessmentStatus: 'conforme',
        evidenceValida: 1,
        evidenceAtencao: 2,
        evidenceVencida: 3,
        evidenceRestrita: 4,
      }),
    ]
    const [l1] = computeReadinessRollups(rows).levels
    assertNeverCollapsed(l1)
    // The split is preserved by VALUE too, not just by shape.
    expect(l1.evidenceValida).toBe(1)
    expect(l1.evidenceAtencao).toBe(2)
    expect(l1.evidenceVencida).toBe(3)
    expect(l1.evidenceRestrita).toBe(4)
  })

  it('every ChapterRollup carries the full four-way split, never a collapsed total', () => {
    const tree = [node('ch-a', 'AOP', 'Access')]
    const rows = [
      row({
        standardId: 'ch-a',
        standardCode: 'AOP',
        assessmentStatus: 'conforme',
        evidenceValida: 5,
        evidenceAtencao: 0,
        evidenceVencida: 1,
        evidenceRestrita: 0,
      }),
    ]
    const [chapter] = computeReadinessRollups(rows, tree).chapters
    assertNeverCollapsed(chapter)
    expect(chapter.evidenceValida).toBe(5)
    expect(chapter.evidenceVencida).toBe(1)
  })

  it('every GapItem (inside blockingGaps and gaps) carries the full four-way split', () => {
    const leveled = computeReadinessRollups([
      row({
        standardId: 's1',
        level: 1,
        assessmentStatus: 'nao_conforme',
        evidenceValida: 0,
        evidenceAtencao: 1,
        evidenceVencida: 2,
        evidenceRestrita: 0,
      }),
    ])
    assertNeverCollapsed(leveled.levels[0].blockingGaps[0])

    const tree = [node('ch-a', 'AOP', 'Access')]
    const nonLeveled = computeReadinessRollups(
      [row({ standardId: 'ch-a', standardCode: 'AOP', assessmentStatus: 'nao_conforme' })],
      tree,
    )
    assertNeverCollapsed(nonLeveled.chapters[0].gaps[0])
  })

  it('a stale-only evidenced standard (evidenceVencida > 0, others 0) is never reported as a bare positive count', () => {
    // A standard with 2 links where both are vencida must show 0/0/2/0, never
    // collapse to a single "2 evidências" that reads as "evidenced".
    const rows = [
      row({
        standardId: 's1',
        level: 1,
        assessmentStatus: 'conforme',
        evidenceValida: 0,
        evidenceAtencao: 0,
        evidenceVencida: 2,
        evidenceRestrita: 0,
      }),
    ]
    const [l1] = computeReadinessRollups(rows).levels
    expect(l1.evidenceValida).toBe(0)
    expect(l1.evidenceVencida).toBe(2)
    // Explicitly: nothing in this module ever sums the three into a field
    // exposed to callers (verified structurally above); the raw split
    // survives the rollup untouched.
  })
})

import { describe, expect, it } from 'vitest'

import {
  expectedEmptyNarratives,
  mergeCaseLayout,
  type CaseLayoutItem,
} from './case-narratives'
import type { CaseDetail, CaseNarrative } from './cases'

/**
 * Unit tests for the PURE case-layout helpers (ADR 0032). `mergeCaseLayout` is the
 * read-side authority that interleaves phases + narratives by `displayPosition`;
 * the interleave is RPC-guaranteed, not DB-constrained, so the merge must tolerate
 * gaps/duplicates WITHOUT throwing and order deterministically.
 *
 * Markdown sanitization is covered by the `MarkdownRenderer` tests; the card just
 * uses that renderer (asserted in the component/E2E layer), so it is not retested
 * here.
 */

// ---------------------------------------------------------------------------
// Minimal fixture factories (only the fields the helpers read).
// ---------------------------------------------------------------------------

type DetailPhase = CaseDetail['phases'][number]

function phase(
  partial: Partial<DetailPhase> & { id: string; position: number },
): DetailPhase {
  return {
    caseId: 'case-1',
    formId: 'form-1',
    formVersionId: 'ver-1',
    formTitle: 'Form',
    title: null,
    status: 'pendente',
    recommended: false,
    assignedTo: null,
    assigneeName: null,
    isAdHoc: false,
    blocks: [],
    recommendWhen: null,
    dueDate: null,
    defaultDueDays: null,
    displayPosition: null,
    responseId: null,
    submittedAt: null,
    ...partial,
  }
}

function narrative(
  partial: Partial<CaseNarrative> & { id: string; displayPosition: number },
): CaseNarrative {
  return {
    caseId: 'case-1',
    narrativeTypeId: 'type-1',
    typeLabel: 'Resumo',
    title: null,
    instructions: null,
    isExpected: false,
    bodyMd: null,
    assignedTo: null,
    assigneeName: null,
    status: 'aberta',
    concludedAt: null,
    concludedBy: null,
    updatedAt: '2026-06-19T00:00:00Z',
    ...partial,
  }
}

function detail(
  phases: DetailPhase[],
  narratives: CaseNarrative[],
): CaseDetail {
  return {
    case: {
      id: 'case-1',
      commissionId: 'comm-1',
      templateId: 'tpl-1',
      caseNumber: 1,
      label: null,
      // The macro status (CaseStatus); mergeCaseLayout never reads it.
      status: 'pendente',
      outcomeId: null,
      createdAt: '2026-06-19T00:00:00Z',
      closedAt: null,
      hasPatient: false,
      patientEnabled: false,
    },
    outcome: null,
    offeredOutcomes: [],
    phases,
    narratives,
    // mergeCaseLayout never reads capabilities; coordinator-grade default keeps the
    // CaseDetail fixture valid (matches the flag-OFF mapper default — ADR 0033).
    viewerCapabilities: {
      canRead: true,
      canWriteContent: true,
      canManageLifecycle: true,
    },
  }
}

/** Compact projection of the merged list for readable assertions. */
function shape(items: CaseLayoutItem[]): Array<[CaseLayoutItem['kind'], string]> {
  return items.map((i) => [
    i.kind,
    i.kind === 'phase' ? i.phase.id : i.narrative.id,
  ])
}

// ---------------------------------------------------------------------------
// mergeCaseLayout
// ---------------------------------------------------------------------------

describe('mergeCaseLayout', () => {
  it('returns an empty list for an empty case', () => {
    expect(mergeCaseLayout(detail([], []))).toEqual([])
  })

  it('orders phases-only by displayPosition (falling back to position)', () => {
    const d = detail(
      [
        phase({ id: 'p2', position: 2, displayPosition: 2 }),
        phase({ id: 'p1', position: 1, displayPosition: 1 }),
        // Legacy row: displayPosition null → falls back to position 3.
        phase({ id: 'p3', position: 3, displayPosition: null }),
      ],
      [],
    )
    expect(shape(mergeCaseLayout(d))).toEqual([
      ['phase', 'p1'],
      ['phase', 'p2'],
      ['phase', 'p3'],
    ])
  })

  it('orders narratives-only by displayPosition', () => {
    const d = detail(
      [],
      [
        narrative({ id: 'n2', displayPosition: 2 }),
        narrative({ id: 'n1', displayPosition: 1 }),
      ],
    )
    expect(shape(mergeCaseLayout(d))).toEqual([
      ['narrative', 'n1'],
      ['narrative', 'n2'],
    ])
  })

  it('interleaves phases and narratives: fase / narrativa / fase', () => {
    // The canonical fixture: Fase 1 (1), Resumo (2), Fase 2 (3), Conclusão (4).
    const d = detail(
      [
        phase({ id: 'p1', position: 1, displayPosition: 1 }),
        phase({ id: 'p2', position: 2, displayPosition: 3 }),
      ],
      [
        narrative({ id: 'nResumo', displayPosition: 2 }),
        narrative({ id: 'nConcl', displayPosition: 4 }),
      ],
    )
    expect(shape(mergeCaseLayout(d))).toEqual([
      ['phase', 'p1'],
      ['narrative', 'nResumo'],
      ['phase', 'p2'],
      ['narrative', 'nConcl'],
    ])
  })

  it('breaks an equal-displayPosition tie deterministically: phase before narrative', () => {
    const d = detail(
      [phase({ id: 'p1', position: 1, displayPosition: 5 })],
      [narrative({ id: 'n1', displayPosition: 5 })],
    )
    expect(shape(mergeCaseLayout(d))).toEqual([
      ['phase', 'p1'],
      ['narrative', 'n1'],
    ])
  })

  it('is a STABLE, total order on duplicate positions (within-kind by id)', () => {
    const d = detail(
      [
        phase({ id: 'pB', position: 2, displayPosition: 1 }),
        phase({ id: 'pA', position: 1, displayPosition: 1 }),
      ],
      [
        narrative({ id: 'nB', displayPosition: 1 }),
        narrative({ id: 'nA', displayPosition: 1 }),
      ],
    )
    // All four collide at displayPosition 1: phases first (by position 1,2 → pA,pB),
    // then narratives (by id → nA,nB). Running it twice yields the same order.
    const once = shape(mergeCaseLayout(d))
    const twice = shape(mergeCaseLayout(d))
    expect(once).toEqual(twice)
    expect(once).toEqual([
      ['phase', 'pA'],
      ['phase', 'pB'],
      ['narrative', 'nA'],
      ['narrative', 'nB'],
    ])
  })

  it('tolerates gaps without throwing or inserting placeholders', () => {
    const d = detail(
      [phase({ id: 'p1', position: 1, displayPosition: 1 })],
      [narrative({ id: 'n1', displayPosition: 99 })],
    )
    const out = mergeCaseLayout(d)
    expect(out).toHaveLength(2)
    expect(shape(out)).toEqual([
      ['phase', 'p1'],
      ['narrative', 'n1'],
    ])
  })

  it('does not mutate the input arrays', () => {
    const phases = [
      phase({ id: 'p2', position: 2, displayPosition: 2 }),
      phase({ id: 'p1', position: 1, displayPosition: 1 }),
    ]
    const d = detail(phases, [])
    mergeCaseLayout(d)
    // The original array order is untouched (merge copies before sorting).
    expect(phases.map((p) => p.id)).toEqual(['p2', 'p1'])
  })
})

// ---------------------------------------------------------------------------
// expectedEmptyNarratives (the soft close-warning selector)
// ---------------------------------------------------------------------------

describe('expectedEmptyNarratives', () => {
  it('selects expected narratives with an empty or whitespace-only body', () => {
    const ns = [
      narrative({ id: 'a', displayPosition: 1, isExpected: true, bodyMd: null }),
      narrative({ id: 'b', displayPosition: 2, isExpected: true, bodyMd: '   \n' }),
      narrative({ id: 'c', displayPosition: 3, isExpected: true, bodyMd: 'Conteúdo' }),
      narrative({ id: 'd', displayPosition: 4, isExpected: false, bodyMd: null }),
    ]
    expect(expectedEmptyNarratives(ns).map((n) => n.id)).toEqual(['a', 'b'])
  })

  it('returns an empty list when nothing is expected-and-empty', () => {
    const ns = [
      narrative({ id: 'a', displayPosition: 1, isExpected: false, bodyMd: null }),
      narrative({ id: 'b', displayPosition: 2, isExpected: true, bodyMd: 'ok' }),
    ]
    expect(expectedEmptyNarratives(ns)).toEqual([])
  })
})

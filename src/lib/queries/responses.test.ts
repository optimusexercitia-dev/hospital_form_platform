/**
 * FF-2 (ADR 0089) — unit coverage for `buildMatrixAnswers`, the pure read-side
 * shaper that turns raw `answer_matrix_cells` / `answer_risk_matrix` rows into
 * the code-keyed maps the wizard rehydrates from.
 *
 * The load-bearing property is the ID→CODE resolution: cells are stored against
 * per-version `row_id`/`col_id`, but every contract the frontend touches is
 * addressed by the clone-stable `code`. A shaper that leaked ids would produce a
 * payload that round-trips as an unknown code (HC0P7) — and would do it only
 * after a version clone, which is exactly the kind of defect that survives a
 * green bar.
 */

import { describe, expect, it } from 'vitest'

import {
  TOP_LEVEL_SCOPE,
  buildMatrixAnswers,
  type ScopedMatrixCellRow,
  type ScopedRiskMatrixRow,
} from './responses'
import type { Item, Section, VersionTree } from './forms'

const MATRIX_ITEM = 'item-matrix'
const RISK_ITEM = 'item-risk'
const INSTANCE = 'instance-1'

function item(overrides: Partial<Item> & Pick<Item, 'id' | 'itemType'>): Item {
  return {
    sectionId: 'sec-1',
    position: 0,
    questionKey: null,
    label: null,
    questionExplanation: null,
    options: null,
    config: null,
    visibleWhen: null,
    required: false,
    defaultValue: null,
    parentItemId: null,
    children: [],
    content: null,
    ...overrides,
  }
}

/** A version holding one `matrix` (2x2) and one `risk_matrix` (1x1, weighted). */
function tree(): VersionTree {
  const section: Section = {
    id: 'sec-1',
    position: 0,
    title: null,
    description: null,
    isDefault: true,
    visibleWhen: null,
    requiresSignoff: false,
    signoffRole: null,
    items: [
      item({
        id: MATRIX_ITEM,
        itemType: 'matrix',
        questionKey: 'matriz',
        matrixRows: [
          { id: 'row-a', code: 'higienizacao', label: 'Higienização', weight: null, position: 0 },
          { id: 'row-b', code: 'epi', label: 'EPI', weight: null, position: 1 },
        ],
        matrixColumns: [
          { id: 'col-a', code: 'conforme', label: 'Conforme', weight: null, position: 0 },
          { id: 'col-b', code: 'nao_conforme', label: 'Não conforme', weight: null, position: 1 },
        ],
      }),
      item({
        id: RISK_ITEM,
        itemType: 'risk_matrix',
        questionKey: 'risco',
        matrixRows: [
          { id: 'sev-1', code: 'grave', label: 'Grave', weight: 9, position: 0 },
        ],
        matrixColumns: [
          { id: 'lik-1', code: 'provavel', label: 'Provável', weight: 3, position: 0 },
        ],
      }),
    ],
  }
  return {
    id: 'ver-1',
    formId: 'form-1',
    versionNumber: 1,
    status: 'published',
    publishedAt: null,
    sections: [section],
  }
}

function cell(
  row_id: string,
  col_id: string,
  group_instance_id: string | null = null,
  item_id = MATRIX_ITEM,
): ScopedMatrixCellRow {
  return { row_id, col_id, answers: { item_id, group_instance_id } }
}

describe('buildMatrixAnswers', () => {
  it('resolves row/col IDS to CODES and groups them under the item id', () => {
    const byScope = buildMatrixAnswers(
      tree(),
      [cell('row-a', 'col-a'), cell('row-b', 'col-b')],
      [],
    )

    expect(byScope.get(TOP_LEVEL_SCOPE)?.matrixCellsByItemId).toEqual({
      [MATRIX_ITEM]: { higienizacao: 'conforme', epi: 'nao_conforme' },
    })
  })

  it('keeps an instance-scoped grid OUT of the top-level bucket', () => {
    const byScope = buildMatrixAnswers(
      tree(),
      [cell('row-a', 'col-a'), cell('row-b', 'col-b', INSTANCE)],
      [],
    )

    // Folding instance rows into the top level is the exact defect class ADR 0087
    // substrate correction 5 found on the scalar side: the last writer wins and
    // the answer silently moves scope.
    expect(byScope.get(TOP_LEVEL_SCOPE)?.matrixCellsByItemId).toEqual({
      [MATRIX_ITEM]: { higienizacao: 'conforme' },
    })
    expect(byScope.get(INSTANCE)?.matrixCellsByItemId).toEqual({
      [MATRIX_ITEM]: { epi: 'nao_conforme' },
    })
  })

  it('surfaces the SERVER-DERIVED risk score alongside the two axis codes', () => {
    const risk: ScopedRiskMatrixRow = {
      severity_row_id: 'sev-1',
      likelihood_col_id: 'lik-1',
      risk_score: 27,
      answers: { item_id: RISK_ITEM, group_instance_id: null },
    }

    expect(buildMatrixAnswers(tree(), [], [risk]).get(TOP_LEVEL_SCOPE)?.riskMatrixByItemId).toEqual({
      [RISK_ITEM]: { severity: 'grave', likelihood: 'provavel', riskScore: 27 },
    })
  })

  it('drops a cell whose axis row is not in the tree instead of emitting an id', () => {
    // Unreachable in practice (app.guard_matrix_cell_coherent rejects it at
    // INSERT), but the failure mode if it ever happened must be "no selection",
    // never "a selection keyed by a raw UUID" — the latter would round-trip to
    // the writer and raise HC0P7 on a save the user did not make.
    const byScope = buildMatrixAnswers(tree(), [cell('row-ghost', 'col-a')], [])
    expect(byScope.get(TOP_LEVEL_SCOPE)).toBeUndefined()
  })

  it('returns an empty map when the response has no matrix answers at all', () => {
    expect(buildMatrixAnswers(tree(), [], []).size).toBe(0)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * FF-2 — ACTION-LAYER coverage for the matrix AUTHORING path.
 *
 * WHY THIS FILE EXISTS. FF-2 Wave 1 shipped `upsert_matrix_axes`, the matrix
 * arms of `save_section_answers`, the completeness predicate and the clone /
 * correction copies — all verified live against the database — while
 * `addItem` could not create a `matrix` item at all: neither matrix type was in
 * `ALL_ITEM_TYPES`, so the action rejected with `itemTypeInvalid` before
 * anything else ran. The writer worked, its pgTAP keystones passed, and nothing
 * in the product could reach it.
 *
 * That is the `declared-param-no-caller` shape — third instance in this repo
 * after ETH·E3a's `p_case_type_id`. It fails CLOSED (no bad data), and it is
 * invisible to lint, typecheck, `next build`, pgTAP and every unit test of a
 * pure helper, because none of them crosses the seam between the builder form
 * and the database.
 *
 * So these tests drive the ACTIONS with the Supabase client mocked, and assert
 * the two things the gap left unproven: that a matrix block can be CREATED, and
 * that it is created with the `question_key` the aggregation contract and the
 * `form_items_input_vs_display` CHECK both require. The RPCs' own behaviour is
 * pgTAP's job (271_ff2_matrix_fields.sql) and is not re-tested here.
 */

const rpc = vi.fn()
const insert = vi.fn()
const update = vi.fn()

/** Rows `sectionLayout` sees; empty = the section has no items yet. */
let layoutRows: unknown[] = []
/** What `contextOfSection` / `contextOfItem` resolve to. */
let contextRow: unknown = null

const supabaseMock = {
  rpc,
  from: vi.fn((table: string) => {
    if (table === 'form_items') {
      return {
        // sectionLayout: select().eq().order().returns()
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              returns: vi.fn(async () => ({ data: layoutRows, error: null })),
            })),
            // contextOfItem: select().eq().maybeSingle()
            maybeSingle: vi.fn(async () => ({ data: contextRow, error: null })),
          })),
        })),
        insert: vi.fn((payload: unknown) => {
          insert(payload)
          return {
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: 'item-new' },
                error: null,
              })),
            })),
          }
        }),
        update: vi.fn((payload: unknown) => {
          update(payload)
          return { eq: vi.fn(async () => ({ error: null })) }
        }),
        delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      }
    }
    // form_sections / form_versions / forms: select().eq().maybeSingle()
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: contextRow, error: null })),
        })),
      })),
    }
  }),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabaseMock),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const getSessionContext = vi.fn()
vi.mock('@/lib/queries/session', () => ({
  getSessionContext: () => getSessionContext(),
}))

import { addItem, upsertMatrixAxes } from './actions'

const SECTION_ID = '11111111-1111-4111-8111-111111111111'
const VERSION_ID = '22222222-2222-4222-8222-222222222222'
const COMMISSION_ID = '33333333-3333-4333-8333-333333333333'
const ITEM_ID = '44444444-4444-4444-8444-444444444444'

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  layoutRows = []
  contextRow = {
    form_version_id: VERSION_ID,
    section_id: SECTION_ID,
    form_versions: { forms: { commission_id: COMMISSION_ID } },
  }
  // A platform admin short-circuits authorizeCommission.
  getSessionContext.mockResolvedValue({ isAdmin: true, memberships: [] })
  rpc.mockResolvedValue({ data: null, error: null })
})

describe('addItem — the matrix authoring path (the Wave 1 reachability gap)', () => {
  // MUTATION: remove `...MATRIX_TYPES` from ALL_ITEM_TYPES -> both go red with
  // 'Tipo de item inválido.'
  it.each(['matrix', 'risk_matrix'])(
    'accepts %s as a creatable item type',
    async (itemType) => {
      const result = await addItem(
        undefined,
        form({ sectionId: SECTION_ID, itemType, label: 'Matriz de conformidade' }),
      )

      expect(result.ok).toBe(true)
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({ item_type: itemType }),
      )
    },
  )

  // MUTATION: revert the question_key gate to `INPUT_TYPES.includes(itemType)`
  // -> this goes red (question_key would be null). The DB CHECK would then have
  // rejected the insert outright, so the failure is loud in production — but it
  // is silent in every gate that does not execute this action.
  it('mints a question_key for a matrix — it is ANSWERABLE, not merely an input', async () => {
    await addItem(
      undefined,
      form({ sectionId: SECTION_ID, itemType: 'matrix', label: 'Matriz' }),
    )

    const payload = insert.mock.calls[0][0] as { question_key: string | null }
    expect(payload.question_key).toEqual(expect.stringContaining('matriz'))
  })

  it('persists required=true on a matrix (ruling 3 made it legal)', async () => {
    await addItem(
      undefined,
      form({
        sectionId: SECTION_ID,
        itemType: 'matrix',
        label: 'Matriz',
        required: 'on',
      }),
    )

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ required: true, content: null, default_value: null }),
    )
  })

  it('rejects a matrix with no label', async () => {
    const result = await addItem(
      undefined,
      form({ sectionId: SECTION_ID, itemType: 'matrix', label: '  ' }),
    )
    expect(result.ok).toBe(false)
    expect(result.fieldErrors?.label).toBeTruthy()
  })

  it('still rejects an unknown item type (the widening did not open the gate)', async () => {
    const result = await addItem(
      undefined,
      form({ sectionId: SECTION_ID, itemType: 'bogus', label: 'X' }),
    )
    expect(result.ok).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })

  it('carries config.riskBands through to the insert for a risk_matrix', async () => {
    await addItem(
      undefined,
      form({
        sectionId: SECTION_ID,
        itemType: 'risk_matrix',
        label: 'Risco',
        configRiskBands: JSON.stringify([
          { minScore: 27, label: 'Alto', color: 'red' },
          { minScore: 1, label: 'Baixo', color: 'green' },
        ]),
      }),
    )

    const payload = insert.mock.calls[0][0] as { config: { riskBands: unknown } }
    // Sorted ascending by the parser, so a consumer can take the LAST band a
    // score reaches without re-sorting.
    expect(payload.config.riskBands).toEqual([
      { minScore: 1, label: 'Baixo', color: 'green' },
      { minScore: 27, label: 'Alto', color: 'red' },
    ])
  })
})

describe('upsertMatrixAxes', () => {
  it('reaches the RPC with the item id and both axes', async () => {
    const rows = [{ code: 'r1', label: 'Linha 1', position: 0 }]
    const columns = [{ code: 'c1', label: 'Coluna 1', position: 0 }]

    const result = await upsertMatrixAxes({ itemId: ITEM_ID, rows, columns })

    expect(result.ok).toBe(true)
    expect(rpc).toHaveBeenCalledWith('upsert_matrix_axes', {
      p_item_id: ITEM_ID,
      p_rows: rows,
      p_columns: columns,
    })
  })

  it.each([
    ['HC0P2', 'matrixUnavailable'],
    ['HC0P4', 'notDraft'],
    ['HC0P6', 'riskWeightRequired'],
    ['42501', 'forbidden'],
  ])('translates %s into distinct pt-BR copy, never a raw SQLSTATE', async (code) => {
    rpc.mockResolvedValue({ data: null, error: { code } })

    const result = await upsertMatrixAxes({ itemId: ITEM_ID, rows: [], columns: [] })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(result.error).not.toContain(code)
  })
})

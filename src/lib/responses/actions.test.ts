import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * FF-1 — ACTION-LAYER coverage for the repeating-group instance writers.
 *
 * WHY THIS FILE EXISTS (BUG-FF1-001). The three actions shipped as
 * `throw new Error('not implemented')` and reached a phase gate. Everything was
 * green: `eslint --max-warnings=0` (the `_input` underscore marked the parameters
 * intentionally unused), `tsc --noEmit` (the signatures were valid), a real
 * `next build`, 457 unit tests, and 3919 pgTAP assertions on a fresh reset.
 *
 * Not one of those gates crosses the seam between the UI and the database:
 *   · pgTAP calls the RPCs — it never loads a TypeScript module;
 *   · the unit suite tested pure helpers — it never called an action;
 *   · typecheck/lint/build check SHAPE, and a throwing body has a valid shape.
 * The feature the phase exists to ship was inert, and the bar said green.
 *
 * So these tests drive the ACTIONS, with the Supabase client mocked. They assert
 * the two things the gap left unproven: that each action actually reaches its
 * RPC with the right arguments, and that it never throws. The RPCs' own
 * behaviour is pgTAP's job (270_ff1_repeating_groups.sql) and is not re-tested
 * here — this file owns the seam, nothing else.
 */

const rpc = vi.fn()
const maybeSingle = vi.fn()

const supabaseMock = {
  rpc,
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle })),
    })),
  })),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabaseMock),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const getSessionContext = vi.fn()
vi.mock('@/lib/queries/session', () => ({
  getSessionContext: () => getSessionContext(),
}))

import {
  addGroupInstance,
  removeGroupInstance,
  reorderGroupInstances,
  saveSection,
  searchReferenceCandidates,
  submitCasePhaseResponse,
  submitResponse,
} from './actions'

const RESPONSE_ID = '11111111-1111-4111-8111-111111111111'
const GROUP_ITEM_ID = '22222222-2222-4222-8222-222222222222'
const INSTANCE_ID = '33333333-3333-4333-8333-333333333333'
const COMMISSION_ID = '44444444-4444-4444-8444-444444444444'

/** The caller is a member of the response's commission (the happy path). */
function asMember(): void {
  maybeSingle.mockResolvedValue({
    data: { commission_id: COMMISSION_ID, form_version_id: 'v1' },
  })
  getSessionContext.mockResolvedValue({
    isAdmin: false,
    memberships: [{ commission: { id: COMMISSION_ID } }],
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  asMember()
})

/**
 * FF-5 (QA M-2) — THE TYPEAHEAD ERROR PATH IS REACHABLE.
 *
 * `searchReferenceCandidates` used to end `return { ok: true, candidates }`
 * unconditionally, because `listReferenceCandidates` swallowed every Postgres
 * error into `[]`. The consequence was not a missing message but a CONFIDENT
 * FALSE ONE: with `entity_refs` off the RPC raises HC0Q3, the picker saw an
 * empty list, and told the user the field is empty because the form has no
 * linked case. A feature-flag outage rendered as correct behaviour.
 *
 * The picker's whole error branch was therefore unreachable — and unreachable
 * code passes lint, tsc and every unit test, which is exactly why "the branch
 * exists" is not evidence. These tests force the RPC to raise and assert the
 * caller receives `ok: false` with pt-BR: the check that would have caught it.
 */
describe('searchReferenceCandidates — the RPC error path (QA M-2)', () => {
  const ITEM = '66666666-6666-4666-8666-666666666666'

  it('CONTROL — a successful call returns ok with the mapped candidates', async () => {
    // Without this, every assertion below could pass because the action always
    // fails, which is a different bug wearing the same green.
    rpc.mockResolvedValue({
      data: [{ target_id: 'p-1', label: 'UTI Adulto', sublabel: 'Setor' }],
      error: null,
    })

    const result = await searchReferenceCandidates({
      responseId: RESPONSE_ID,
      itemId: ITEM,
    })

    expect(result.ok).toBe(true)
    expect(result.candidates).toEqual([
      { targetId: 'p-1', label: 'UTI Adulto', sublabel: 'Setor' },
    ])
  })

  it('an EMPTY result stays ok — it is a legitimate answer, not a failure', async () => {
    // The distinction the fix turns on. A `patient` lane on a standalone
    // response genuinely has no candidates; that must NOT look like an error.
    rpc.mockResolvedValue({ data: [], error: null })

    const result = await searchReferenceCandidates({
      responseId: RESPONSE_ID,
      itemId: ITEM,
    })

    expect(result).toEqual({ ok: true, candidates: [] })
  })

  it('HC0Q3 (feature flag OFF) surfaces as ok:false with the flag message', async () => {
    // THE REGRESSION THIS FILE EXISTS FOR. Previously: { ok: true, candidates: [] }.
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'HC0Q3', message: 'o recurso de referências não está disponível' },
    })

    const result = await searchReferenceCandidates({
      responseId: RESPONSE_ID,
      itemId: ITEM,
    })

    expect(result.ok).toBe(false)
    expect(result.candidates).toBeUndefined()
    expect(result.error).toBe('O recurso de referências não está disponível.')
  })

  it('HC0Q4 (not a reference item) surfaces as invalid data', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'HC0Q4', message: 'o item X não é um campo de referência' },
    })

    const result = await searchReferenceCandidates({
      responseId: RESPONSE_ID,
      itemId: ITEM,
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Dados inválidos para este formulário.')
  })

  it('P0002 (response not found / not visible) surfaces as not found', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0002', message: 'resposta X não encontrada' },
    })

    const result = await searchReferenceCandidates({
      responseId: RESPONSE_ID,
      itemId: ITEM,
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Resposta não encontrada.')
  })

  it('an UNMAPPED code still fails closed with generic pt-BR, never ok:true', async () => {
    // The arm that matters most for a code nobody anticipated: the failure must
    // stay a failure. A `default` that fell through to ok:true would reinstate
    // the whole defect for every future SQLSTATE.
    rpc.mockResolvedValue({
      data: null,
      error: { code: '08006', message: 'connection failure' },
    })

    const result = await searchReferenceCandidates({
      responseId: RESPONSE_ID,
      itemId: ITEM,
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Não foi possível concluir. Tente novamente.')
  })

  it('never leaks the raw Postgres message to the UI (CLAUDE.md §8)', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'HC0Q3', message: 'ERROR: relation "x" does not exist' },
    })

    const result = await searchReferenceCandidates({
      responseId: RESPONSE_ID,
      itemId: ITEM,
    })

    expect(result.error).not.toContain('relation')
  })
})

describe('addGroupInstance', () => {
  it('calls add_group_instance and returns the new instance', async () => {
    rpc.mockResolvedValue({
      data: { id: INSTANCE_ID, position: 2 },
      error: null,
    })

    const result = await addGroupInstance({
      responseId: RESPONSE_ID,
      groupItemId: GROUP_ITEM_ID,
    })

    expect(rpc).toHaveBeenCalledWith('add_group_instance', {
      p_response_id: RESPONSE_ID,
      p_group_item_id: GROUP_ITEM_ID,
    })
    // The wizard renders and focuses the new row from these — returning `ok`
    // without them would leave the UI unable to place the instance.
    expect(result).toEqual({ ok: true, instanceId: INSTANCE_ID, position: 2 })
  })

  it('maps HC0N1 (maxInstances) to pt-BR, not a raw Postgres message', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'HC0N1', message: 'este bloco aceita no máximo 3 item(ns)' },
    })

    const result = await addGroupInstance({
      responseId: RESPONSE_ID,
      groupItemId: GROUP_ITEM_ID,
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Este bloco já atingiu o número máximo de itens.')
  })

  it('maps HC0N0 (flag off) to the unavailable message', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'HC0N0', message: 'recurso indisponível' },
    })
    const result = await addGroupInstance({
      responseId: RESPONSE_ID,
      groupItemId: GROUP_ITEM_ID,
    })
    expect(result.error).toBe('O recurso de blocos repetíveis não está disponível.')
  })

  it('refuses a non-member WITHOUT calling the RPC', async () => {
    getSessionContext.mockResolvedValue({ isAdmin: false, memberships: [] })

    const result = await addGroupInstance({
      responseId: RESPONSE_ID,
      groupItemId: GROUP_ITEM_ID,
    })

    expect(result).toEqual({
      ok: false,
      error: 'Você não tem permissão para esta ação.',
    })
    // RLS would deny anyway; not spending the round trip is the point of the
    // pre-check, and calling it here would mean the guard is decorative.
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('removeGroupInstance', () => {
  it('calls remove_group_instance with the instance id', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    const result = await removeGroupInstance({
      responseId: RESPONSE_ID,
      instanceId: INSTANCE_ID,
    })

    expect(rpc).toHaveBeenCalledWith('remove_group_instance', {
      p_response_id: RESPONSE_ID,
      p_instance_id: INSTANCE_ID,
    })
    expect(result).toEqual({ ok: true })
  })

  it('maps HC0N2 (unknown instance) to pt-BR', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'HC0N2' } })
    const result = await removeGroupInstance({
      responseId: RESPONSE_ID,
      instanceId: INSTANCE_ID,
    })
    expect(result.error).toBe('Item do bloco não encontrado nesta resposta.')
  })

  it('maps a submitted response (check_violation) to "já foi enviada"', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '23514' } })
    const result = await removeGroupInstance({
      responseId: RESPONSE_ID,
      instanceId: INSTANCE_ID,
    })
    expect(result.error).toBe('Esta resposta já foi enviada.')
  })
})

describe('reorderGroupInstances', () => {
  it('passes the instance ids through IN ORDER', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    const ids = ['a', 'b', 'c']

    const result = await reorderGroupInstances({
      responseId: RESPONSE_ID,
      groupItemId: GROUP_ITEM_ID,
      instanceIds: ids,
    })

    // Order IS the payload here — the RPC assigns positions by array index, so a
    // reordered or de-duplicated array would silently write the wrong order.
    expect(rpc).toHaveBeenCalledWith('reorder_group_instances', {
      p_response_id: RESPONSE_ID,
      p_group_item_id: GROUP_ITEM_ID,
      p_instance_ids: ['a', 'b', 'c'],
    })
    expect(result).toEqual({ ok: true })
  })

  it('maps HC0N3 (not a permutation) to pt-BR', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'HC0N3' } })
    const result = await reorderGroupInstances({
      responseId: RESPONSE_ID,
      groupItemId: GROUP_ITEM_ID,
      instanceIds: ['a'],
    })
    expect(result.error).toBe('A nova ordem não corresponde aos itens deste bloco.')
  })
})

/**
 * BUG-FF1-005 — `saveSection` destructured seven fields and `instances` was not
 * among them, so `p_instance_answers` was never sent. Every per-instance answer
 * a user typed was silently discarded: zero `answers` rows carried a
 * `group_instance_id` after a real wizard save.
 *
 * It hid because `tester`'s specs FF1-4/5/7/8 filled by calling
 * `save_section_answers` DIRECTLY over RPC — a workaround built to route around
 * BUG-FF1-001 while the instance actions were stubs. The suite's own workaround
 * for the first bug concealed the second: bypassing a broken layer becomes
 * blindness to that layer the moment it is fixed.
 *
 * These assert the ACTION reaches the RPC with the parameter populated — which
 * is exactly what calling the RPC directly can never tell you.
 */
const SECTION_ID = '55555555-5555-4555-8555-555555555555'
const ITEM_ID = '66666666-6666-4666-8666-666666666666'
/** FF-5: the reference TARGET — a participant / commission / profile id. Which
 *  of the three it is never appears on the wire (the lane comes from the item's
 *  config), which is exactly what these tests pin. */
const TARGET_ID = '77777777-7777-4777-8777-777777777777'

describe('saveSection — the FF-1 instance arm (BUG-FF1-005)', () => {
  it('forwards instances as p_instance_answers, TRANSLATED to the RPC key shape', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await saveSection({
      responseId: RESPONSE_ID,
      sectionId: SECTION_ID,
      answersByItemId: {},
      instances: [
        {
          instanceId: INSTANCE_ID,
          answersByItemId: { [ITEM_ID]: 'Dipirona' },
          selectionsByItemId: { [ITEM_ID]: ['op1'] },
          observationsByItemId: { [ITEM_ID]: 'obs' },
          otherTextByItemId: { [ITEM_ID]: 'outro' },
          clearItemIds: [ITEM_ID],
          // FF-2 (ADR 0089): the two matrix sub-maps ride the SAME translation.
          matrixCellsByItemId: { [ITEM_ID]: { linha_a: 'conforme' } },
          riskMatrixByItemId: {
            [ITEM_ID]: { severity: 'grave', likelihood: 'provavel' },
          },
          // FF-5 (ADR 0091): the reference sub-map rides the SAME translation.
          referencesByItemId: { [ITEM_ID]: TARGET_ID },
        },
      ],
    })

    const args = rpc.mock.calls[0][1]
    // The translation is load-bearing: `app.save_instance_answers` reads
    // snake_case keys off each entry. Forwarding the camelCase objects verbatim
    // would be just as broken as dropping them — the RPC would find no
    // `instance_id` and raise HC0N2 on every save.
    expect(args.p_instance_answers).toEqual([
      {
        instance_id: INSTANCE_ID,
        answers: { [ITEM_ID]: 'Dipirona' },
        selections: { [ITEM_ID]: ['op1'] },
        observations: { [ITEM_ID]: 'obs' },
        other_text: { [ITEM_ID]: 'outro' },
        clear_item_ids: [ITEM_ID],
        matrix_cells: { [ITEM_ID]: { linha_a: 'conforme' } },
        risk_matrix: {
          [ITEM_ID]: { severity: 'grave', likelihood: 'provavel' },
        },
        // FF-5: `references`, not `referencesByItemId`. A verbatim forward would
        // be SILENTLY INERT — `app.save_reference_answers` would receive an
        // empty payload, early-return, and every reference inside a repeating
        // group would vanish with no error raised anywhere.
        references: { [ITEM_ID]: TARGET_ID },
      },
    ])
  })

  it('defaults every optional sub-map so a sparse entry is still well-formed', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await saveSection({
      responseId: RESPONSE_ID,
      sectionId: SECTION_ID,
      answersByItemId: {},
      instances: [{ instanceId: INSTANCE_ID, answersByItemId: { [ITEM_ID]: 'x' } }],
    })

    expect(rpc.mock.calls[0][1].p_instance_answers).toEqual([
      {
        instance_id: INSTANCE_ID,
        answers: { [ITEM_ID]: 'x' },
        selections: {},
        observations: {},
        other_text: {},
        clear_item_ids: [],
        matrix_cells: {},
        risk_matrix: {},
        references: {},
      },
    ])
  })

  // FF-2 (ADR 0089) — the TOP-LEVEL matrix params. Same lesson as BUG-FF1-005:
  // lint, typecheck, `next build` and the pgTAP suite were all green while the
  // FF-1 instance arm silently dropped its payload, because none of those gates
  // crosses the seam between the action and the RPC. These two do.
  it('forwards the top-level matrix payloads under their RPC param names', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await saveSection({
      responseId: RESPONSE_ID,
      sectionId: SECTION_ID,
      answersByItemId: {},
      matrixCellsByItemId: { [ITEM_ID]: { linha_a: 'conforme' } },
      riskMatrixByItemId: {
        [ITEM_ID]: { severity: 'grave', likelihood: 'frequente' },
      },
    })

    const args = rpc.mock.calls[0][1]
    expect(args.p_matrix_cells).toEqual({ [ITEM_ID]: { linha_a: 'conforme' } })
    // No score is ever sent: risk_score is derived server-side from the two axis
    // weights, and a client-supplied one is not read.
    expect(args.p_risk_matrix).toEqual({
      [ITEM_ID]: { severity: 'grave', likelihood: 'frequente' },
    })
  })

  it('OMITS both matrix params when the section has no matrix answers', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await saveSection({
      responseId: RESPONSE_ID,
      sectionId: SECTION_ID,
      answersByItemId: { [ITEM_ID]: 'x' },
    })

    // Omitted, not `{}`: the SQL helpers early-return on an empty payload BEFORE
    // asserting the `matrix_fields` flag, so sending `{}` from every ordinary
    // save would be harmless today but would couple every form fill to a flag it
    // has nothing to do with.
    const args = rpc.mock.calls[0][1]
    expect(args.p_matrix_cells).toBeUndefined()
    expect(args.p_risk_matrix).toBeUndefined()
  })

  // FF-5 (ADR 0091) — the TOP-LEVEL reference param, for the same reason and by
  // the same method. `save_section_answers` gained an 11th parameter; a declared
  // param that no caller passes is invisible to tsc, lint, the unit suite, pgTAP
  // AND E2E (E2E specs call the RPC directly, so they exercise the parameter and
  // not the wire to it). This test is the only gate that crosses that seam.
  it('forwards the top-level reference payload as p_references', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await saveSection({
      responseId: RESPONSE_ID,
      sectionId: SECTION_ID,
      answersByItemId: {},
      referencesByItemId: { [ITEM_ID]: TARGET_ID },
    })

    const args = rpc.mock.calls[0][1]
    // The TARGET ID alone — the lane is never on the wire. It is resolved from
    // the item's own `config->>'referenceKind'`, which is what makes "a
    // commission item paired with a participant target" unrepresentable rather
    // than merely rejected.
    expect(args.p_references).toEqual({ [ITEM_ID]: TARGET_ID })
  })

  it('forwards an explicit null target — the CLEAR command must reach the server', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await saveSection({
      responseId: RESPONSE_ID,
      sectionId: SECTION_ID,
      answersByItemId: {},
      referencesByItemId: { [ITEM_ID]: null },
    })

    // A truthiness-based "has references?" guard would drop this payload and
    // make clearing a reference a silent no-op: the user removes the target, the
    // save reports success, and the old reference is still there on reload.
    // Hence the key-count test in the action, and this assertion pinning it.
    expect(rpc.mock.calls[0][1].p_references).toEqual({ [ITEM_ID]: null })
  })

  it('OMITS p_references when the section has no reference answers', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await saveSection({
      responseId: RESPONSE_ID,
      sectionId: SECTION_ID,
      answersByItemId: { [ITEM_ID]: 'x' },
    })

    // Omitted, not `{}` — same reasoning as the two matrix params above:
    // `app.save_reference_answers` early-returns on an empty payload BEFORE
    // asserting the `entity_refs` flag, so sending `{}` from every ordinary save
    // would couple every form fill to a flag it has nothing to do with.
    expect(rpc.mock.calls[0][1].p_references).toBeUndefined()
  })

  it('omits p_instance_answers entirely when the section has no instances', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await saveSection({
      responseId: RESPONSE_ID,
      sectionId: SECTION_ID,
      answersByItemId: { [ITEM_ID]: 'top-level' },
    })

    const args = rpc.mock.calls[0][1]
    expect(args.p_instance_answers).toBeUndefined()
    // …and the top-level arm is untouched by the instance work.
    expect(args.p_answers).toEqual({ [ITEM_ID]: 'top-level' })
  })

  it('still reaches save_section_answers with the response and section', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await saveSection({
      responseId: RESPONSE_ID,
      sectionId: SECTION_ID,
      answersByItemId: {},
    })
    expect(rpc).toHaveBeenCalledWith(
      'save_section_answers',
      expect.objectContaining({
        p_response_id: RESPONSE_ID,
        p_section_id: SECTION_ID,
      }),
    )
  })
})

/**
 * The direct regression guard for BUG-FF1-001. Kept as its own block, and
 * deliberately blunt: every gate the phase ran was satisfied by a body that
 * threw, so the assertion that would have caught it is simply "call it and see
 * that it resolves". If any of these three is ever reverted to a stub — or
 * throws for any other reason — this fails immediately, in under a second,
 * without a database.
 */
describe('BUG-FF1-001 regression: the instance writers are implemented', () => {
  it.each([
    [
      'addGroupInstance',
      () => addGroupInstance({ responseId: RESPONSE_ID, groupItemId: GROUP_ITEM_ID }),
    ],
    [
      'removeGroupInstance',
      () => removeGroupInstance({ responseId: RESPONSE_ID, instanceId: INSTANCE_ID }),
    ],
    [
      'reorderGroupInstances',
      () =>
        reorderGroupInstances({
          responseId: RESPONSE_ID,
          groupItemId: GROUP_ITEM_ID,
          instanceIds: [INSTANCE_ID],
        }),
    ],
  ])('%s resolves instead of throwing, and reaches its RPC', async (_name, call) => {
    rpc.mockResolvedValue({ data: { id: INSTANCE_ID, position: 0 }, error: null })

    await expect(call()).resolves.toMatchObject({ ok: true })
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

describe('saveSection — FF-2 matrix failures reach the user (BUG-FF2-002 siblings)', () => {
  // Found by sweeping every HC0P* raise site against the paths that surface it,
  // after `frontend` hit the publish half by hand. All four codes collapsed into
  // "Não foi possível concluir. Tente novamente." before this.
  // MUTATION: delete the four FF-2 blocks from saveSection's error chain ->
  //   every assertion here goes red.
  it('surfaces HC0P8 — the one an ordinary respondent can trigger', async () => {
    // A user who picks a severity but not a likelihood. The DB sentence is
    // already the right pt-BR, so it is preferred over the constant.
    const message = 'informe a severidade e a probabilidade da matriz de risco'
    rpc.mockResolvedValue({ data: null, error: { code: 'HC0P8', message } })

    const result = await saveSection({
      responseId: RESPONSE_ID,
      sectionId: SECTION_ID,
      answersByItemId: {},
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe(message)
  })

  it.each([
    ['HC0P2', 'o recurso de matrizes não está disponível'],
    ['HC0P7', 'a linha "x" não pertence a esta matriz'],
    ['HC0P3', 'o item x não é uma matriz desta versão do formulário'],
    ['HC0P1', 'a linha da matriz não pertence a esta pergunta'],
    ['42501', 'permission denied'],
  ])('maps %s to actionable pt-BR, never the generic retry copy', async (code, message) => {
    rpc.mockResolvedValue({ data: null, error: { code, message } })

    const result = await saveSection({
      responseId: RESPONSE_ID,
      sectionId: SECTION_ID,
      answersByItemId: {},
    })

    expect(result.ok).toBe(false)
    expect(result.error).not.toBe('Não foi possível concluir. Tente novamente.')
    // And never a raw SQLSTATE or a Postgres string (Rule 10 / §8).
    expect(result.error).not.toContain(code)
    expect(result.error).not.toContain('permission denied')
  })

  it('still falls back to generic for an unmapped code', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'XX999', message: 'boom' } })

    const result = await saveSection({
      responseId: RESPONSE_ID,
      sectionId: SECTION_ID,
      answersByItemId: {},
    })

    expect(result.error).toBe('Não foi possível concluir. Tente novamente.')
  })
})

describe('saveSection — FF-1 HC0N2 reaches the user (out-of-phase fix)', () => {
  // FF-1 scope, ruled in by the lead during FF-2's gate: the same chain, the
  // same file, and a live user-facing pt-BR defect in a SHIPPED phase.
  // `mapGroupError` already maps HC0N2 for the three instance RPCs; saveSection
  // simply never consulted it.
  // MUTATION: delete the GROUP_INSTANCE_NOT_FOUND block from saveSection ->
  //   both assertions here go red.
  it.each([
    'entrada de bloco repetível sem identificador',
    'item do bloco não encontrado nesta resposta',
  ])('surfaces the DB sentence for HC0N2: "%s"', async (message) => {
    // The two raise sites say DIFFERENT things, which is exactly why the DB
    // message is preferred over the single constant.
    rpc.mockResolvedValue({ data: null, error: { code: 'HC0N2', message } })

    const result = await saveSection({
      responseId: RESPONSE_ID,
      sectionId: SECTION_ID,
      answersByItemId: {},
      instances: [{ instanceId: INSTANCE_ID, answersByItemId: {} }],
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe(message)
    expect(result.error).not.toBe('Não foi possível concluir. Tente novamente.')
  })

  it('falls back to the constant when HC0N2 carries no message', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'HC0N2', message: '' } })

    const result = await saveSection({
      responseId: RESPONSE_ID,
      sectionId: SECTION_ID,
      answersByItemId: {},
    })

    expect(result.error).toBe('Item do bloco não encontrado nesta resposta.')
  })
})

// ---------------------------------------------------------------------------
// OUT-OF-PHASE FIX (FF-1) — HC0N5 reaches the user.
//
// `submit_response` raises HC0N5 for an unmet `minInstances`, and BOTH submit
// switches dropped it into the generic retry copy. It escaped `mapGroupError`
// (which has covered the HC0N* lane since FF-1) because it is raised by
// `submit_response`, not by the three instance RPCs — so the one place that knows
// the lane was never consulted from the one path that can raise this member of it.
//
// Reachable by ORDINARY USE: author a repeating block with `minInstances: 2`,
// fill one row, press enviar. Third instance of the class after BUG-FF2-002 and
// BUG-FF1-006 (HC0N2), and the reason the FF-door sweep in this commit exists.
// ---------------------------------------------------------------------------
describe('submit — HC0N5 (min instances) reaches the user', () => {
  const DB_MESSAGE = 'o bloco "Ocorrências" exige ao menos 2 item(ns) preenchido(s)'
  const GENERIC = 'Não foi possível concluir. Tente novamente.'

  it('submitResponse surfaces the DB sentence, which names the block and the count', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'HC0N5', message: DB_MESSAGE } })

    const result = await submitResponse(RESPONSE_ID)

    expect(result.ok).toBe(false)
    expect(result.error).toBe(DB_MESSAGE)
    expect(result.error).not.toBe(GENERIC)
  })

  it('submitCasePhaseResponse surfaces it too — the switch is duplicated, so the test is', async () => {
    // The case-phase submit is a SECOND copy of the same switch. A fix applied to
    // one and not the other is the within-one-file inconsistency BUG-FF2-002 was.
    rpc.mockResolvedValue({ data: null, error: { code: 'HC0N5', message: DB_MESSAGE } })

    const result = await submitCasePhaseResponse(RESPONSE_ID, '', undefined, null)

    expect(result.ok).toBe(false)
    expect(result.error).toBe(DB_MESSAGE)
    expect(result.error).not.toBe(GENERIC)
  })

  it('falls back to the pt-BR constant when HC0N5 carries no message', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'HC0N5', message: '' } })

    const result = await submitResponse(RESPONSE_ID)

    expect(result.error).toBe(
      'Preencha o número mínimo de itens exigido em um dos blocos repetíveis.',
    )
  })
})

// ---------------------------------------------------------------------------
// FF-3 — HC0P9 and the HC061 collision, on the same two switches.
// ---------------------------------------------------------------------------
describe('submit — FF-3 validation gate and the HC061 collision', () => {
  it('HC0P9 surfaces the pt-BR rule message the AUTHOR wrote', async () => {
    // A generic string here would defeat the entire point of letting a
    // staff_admin write the message on the rule.
    const message = 'Informe um valor entre 5 e 10.'
    rpc.mockResolvedValue({ data: null, error: { code: 'HC0P9', message } })

    const result = await submitResponse(RESPONSE_ID)

    expect(result.ok).toBe(false)
    expect(result.error).toBe(message)
  })

  it('HC061 surfaces the DB sentence — it has TWO unrelated raise sites', async () => {
    // `app.assert_item_bounds` (a field bound) and `app.compute_case_phase_result`
    // (a MANUAL phase with no result) share this SQLSTATE, and only the message
    // tells them apart. Mapping it to the phase-result constant told a user who
    // typed two characters into a minLength-5 field about a phase result.
    const message = 'a pergunta "Justificativa" exige ao menos 5 caractere(s)'
    rpc.mockResolvedValue({ data: null, error: { code: 'HC061', message } })

    const result = await submitResponse(RESPONSE_ID)

    expect(result.ok).toBe(false)
    expect(result.error).toBe(message)
    expect(result.error).not.toBe('Selecione o resultado da fase antes de enviar.')
  })
})

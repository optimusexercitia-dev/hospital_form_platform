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

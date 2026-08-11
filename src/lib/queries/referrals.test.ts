import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Pins the A9 `direction` computation in {@link getReferralDetail}.
 *
 * WHY THIS FILE EXISTS. The referral detail page called
 * `getReferralDetail(referralId)` without a `viewerCommissionId`, so `direction`
 * always resolved `'outgoing'` and the receiving committee's header read "saída".
 * The fix threads `access.commission.id` through. But plan D1 then removed the
 * direction chip, so **nothing on the detail page renders `detail.direction` any
 * more** — Phase 4 traced every consumer and found only the hub page reads it.
 * Dropping the argument again would not turn a single test red: a fixed bug with
 * no guard is a bug with a timer on it.
 *
 * These cases therefore assert the COMPUTATION, not the pixel. They are the only
 * thing standing between the A9 fix and a silent regression.
 *
 * Non-vacuity was proven by mutation, not assumed — see the two mutations recorded
 * in the case comments below. Every case names which mutation reddens it, so a
 * future edit that makes one unfalsifiable is visible rather than comfortable.
 */

const rpcMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ rpc: rpcMock }),
}))

import { getReferralDetail } from './referrals'

const SOURCE = 'commission-source'
const TARGET = 'commission-target'

/**
 * The `get_referral_detail` door's payload, reduced to what the mapper reads.
 * Snake_case on purpose: this stands in for the RPC's JSON, not for the domain
 * type, and the whole point of the mapper is the translation between them.
 */
function detailPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'ref-1',
    code: 'ENC-0001',
    status: 'in_review',
    subject: 'Assunto',
    description_md: null,
    referral_type_id: null,
    type_label: 'Parecer',
    response_expected: true,
    priority: 'routine',
    requested_action_id: null,
    requested_action_label: null,
    response_due_at: null,
    decline_reason_code: null,
    parent_referral_id: null,
    source_commission_id: SOURCE,
    source_commission_name: 'CCIH',
    target_commission_id: TARGET,
    target_commission_name: 'Farmácia',
    target_type: 'commission',
    target_hospital_id: null,
    target_hospital_name: null,
    source_case_id: 'case-source',
    source_case_number: 7,
    target_case_id: null,
    target_case_number: null,
    has_patient: false,
    created_by: null,
    created_by_name: null,
    decline_note: null,
    waiting_on_committee_id: null,
    waiting_on_hospital_id: null,
    last_message_at: null,
    can_compose_as_source: false,
    can_compose_as_target: false,
    messages: [],
    shared_items: [],
    read_receipts: [],
    resolutions: [],
    assignments: [],
    links: [],
    reply: null,
    sent_at: '2026-01-02T00:00:00.000Z',
    received_at: null,
    decided_at: null,
    concluded_at: null,
    withdrawn_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

/** A `technical_director` referral (ADR 0094 W4): the destination is a hospital's
 * office, so `target_commission_id` is NULL and there is no target commission at
 * all — the shape that makes a null-blind equality test dangerous. */
function dtPayload(): Record<string, unknown> {
  return detailPayload({
    target_type: 'technical_director',
    target_commission_id: null,
    target_commission_name: null,
    target_hospital_id: 'hospital-1',
    target_hospital_name: 'Hospital Central',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  rpcMock.mockResolvedValue({ data: detailPayload(), error: null })
})

describe('getReferralDetail — the A9 direction computation', () => {
  it('resolves incoming when the viewer IS the target commission', async () => {
    // ⟵ THE BUG ITSELF. This is the case that read "saída" for the receiving
    // committee. Reddens under mutation M1 (`direction` hard-coded 'outgoing',
    // i.e. ignoring viewerCommissionId — the original defect).
    const detail = await getReferralDetail('ref-1', TARGET)
    expect(detail?.direction).toBe('incoming')
  })

  it('resolves outgoing when the viewer IS the source commission', async () => {
    const detail = await getReferralDetail('ref-1', SOURCE)
    expect(detail?.direction).toBe('outgoing')
  })

  it('resolves outgoing for the QPS drill-down (null viewer)', async () => {
    // The QPS dashboard belongs to neither side and shows source→target.
    const detail = await getReferralDetail('ref-1', null)
    expect(detail?.direction).toBe('outgoing')
  })

  it('resolves outgoing when the viewer is neither side', async () => {
    const detail = await getReferralDetail('ref-1', 'commission-unrelated')
    expect(detail?.direction).toBe('outgoing')
  })

  it('defaults to outgoing when viewerCommissionId is omitted entirely', async () => {
    // The literal call shape of the pre-A9 page (`getReferralDetail(referralId)`).
    // Pins that the parameter is OPTIONAL with a null default, so the QPS and
    // hub callers keep compiling — the fix is at the call site, not here.
    const detail = await getReferralDetail('ref-1')
    expect(detail?.direction).toBe('outgoing')
  })

  it('never resolves incoming on a DT referral viewed by a real commission', async () => {
    // `target_commission_id` is NULL and the viewer is non-null: the equality must
    // fail. Asserted as "not incoming" AND as the exact value, because the failure
    // mode worth catching is a NULL-blind comparison quietly labelling the SOURCE
    // committee as the recipient of its own referral.
    rpcMock.mockResolvedValue({ data: dtPayload(), error: null })
    const detail = await getReferralDetail('ref-1', SOURCE)
    expect(detail?.direction).not.toBe('incoming')
    expect(detail?.direction).toBe('outgoing')
  })

  it('resolves outgoing for a DT referral in the QPS drill-down (null === null)', async () => {
    // ⟵ THE NULL-GUARD'S OWN CASE, and the ONLY case that reddens under mutation
    // M2 (dropping the `viewerCommissionId !== null &&` conjunct). Without this
    // test the guard is dead weight no assertion protects: every other case
    // survives M2 because `target_commission_id !== viewerCommissionId` anyway.
    // Here BOTH are null, so a bare `===` returns true and the QPS dashboard
    // would label a technical-direction referral as "incoming".
    rpcMock.mockResolvedValue({ data: dtPayload(), error: null })
    const detail = await getReferralDetail('ref-1', null)
    expect(detail?.direction).toBe('outgoing')
  })

  it('returns null (and computes no direction) when the door refuses', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'denied' } })
    expect(await getReferralDetail('ref-1', TARGET)).toBeNull()
  })

  it('passes the referral id to the door and reads direction from the payload only', async () => {
    // `viewerCommissionId` is a CLIENT-SIDE projection: it must never be sent to
    // the RPC (the door has one parameter, and widening it would move an
    // authorization-adjacent input server-side without a gate).
    await getReferralDetail('ref-1', TARGET)
    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(rpcMock).toHaveBeenCalledWith('get_referral_detail', {
      p_referral_id: 'ref-1',
    })
  })
})

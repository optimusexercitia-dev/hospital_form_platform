import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MintRenderContext } from '@/lib/pdf/provenance'

/**
 * ⭐ THE SEAM KEYSTONE (ADR 0125 D1/D5 · ADR 0126 disposal amendment).
 *
 * `print-source-vectors.test.ts` pins that `printSourceWatermark` is CORRECT.
 * Nothing pinned that the payload provider CALLS IT, or calls it with the right
 * arguments — and those are different claims. The vector suite would stay fully
 * green while a disposed `signed` ata stamped FINAL on paper, because the
 * predicate it exercises is not the code path the renderer takes.
 *
 * This is the `.select()` / `.maybeSingle<T>()` distinction from this project's
 * record: a green bar over a correct rule says nothing about the wired seam.
 *
 * ⚠ Deliberately a SEPARATE file from any future `pdf-payload.test.ts`: it mocks
 * the entire meetings query layer, and a suite that mocks its own dependencies
 * should not share a module registry with one that does not.
 */

const detail = {
  id: 'm1',
  meetingNumber: 7,
  title: 'Reunião ordinária',
  meetingTypeName: 'Ordinária',
  status: 'signed',
  scheduledStart: '2026-01-03T12:00:00.000Z',
  heldAt: '2026-01-03T12:05:00.000Z',
  heldEnd: null,
  modality: null,
  location: null,
  minutesMd: null,
  quorumMet: null,
  presentCount: null,
  eligibleMemberCount: null,
  phiDisposed: false,
}

vi.mock('@/lib/queries/meetings', () => ({
  getMeetingDetail: vi.fn(async () => detail),
  listMeetingAgenda: vi.fn(async () => []),
  listMeetingAttendees: vi.fn(async () => []),
  listMeetingSignatures: vi.fn(async () => []),
  listMeetingCases: vi.fn(async () => []),
}))
vi.mock('@/lib/queries/meeting-action-items', () => ({
  listMeetingActionItems: vi.fn(async () => []),
}))
vi.mock('@/lib/queries/printed-documents', () => ({
  getMeetingPrintContext: vi.fn(async () => ({
    hospitalName: 'Hospital Canônico',
    commissionName: 'CCIH',
  })),
}))

const REGISTERED_CTX: MintRenderContext = {
  kind: 'registered',
  qr: { token: 't'.repeat(32), shortCode: 'ABCDEF2345', url: 'https://x.invalid/verificar/t' },
  emission: { at: '2026-01-03T14:00:00.000Z', byDisplay: 'Maria Fixa' },
}

const { getMeetingDetail } = await import('@/lib/queries/meetings')
const detailMock = vi.mocked(getMeetingDetail)

beforeEach(() => {
  detailMock.mockResolvedValue(detail as never)
})

describe('buildMeetingPayload: the watermark reaches the payload from the DISPATCH', () => {
  it('routes every meeting status through printSourceWatermark, not a local rule', async () => {
    const { buildMeetingPayload } = await import('./pdf-payload')
    const { printSourceWatermark } = await import('@/lib/pdf/documents/print-source')

    // Every status the meeting lifecycle has, end to end through the provider.
    for (const status of [
      'scheduled',
      'held',
      'in_signature',
      'signed',
      'distributed',
      'cancelled',
    ]) {
      detailMock.mockResolvedValue({ ...detail, status } as never)
      const payload = await buildMeetingPayload('m1', REGISTERED_CTX)
      expect(
        payload.provenance.watermark,
        `the rendered payload disagrees with the predicate at status=${status}`,
      ).toBe(printSourceWatermark('meeting', { status, meetingDisposed: false }))
    }
  })

  it('...and agrees with the predicate on the DISPOSED axis too, per status', async () => {
    // The loop above holds `phiDisposed` constant, so it cannot see a provider
    // that reads the flag but inverts it. Cross the second dimension — the same
    // 220-vs-440 lesson, applied to the seam instead of the sweep.
    const { buildMeetingPayload } = await import('./pdf-payload')
    const { printSourceWatermark } = await import('@/lib/pdf/documents/print-source')
    for (const status of ['in_signature', 'signed', 'distributed']) {
      for (const phiDisposed of [false, true]) {
        detailMock.mockResolvedValue({ ...detail, status, phiDisposed } as never)
        const payload = await buildMeetingPayload('m1', REGISTERED_CTX)
        expect(
          payload.provenance.watermark,
          `seam disagrees at status=${status} disposed=${phiDisposed}`,
        ).toBe(printSourceWatermark('meeting', { status, meetingDisposed: phiDisposed }))
      }
    }
  })

  it('⭐ END-TO-END: a DISPOSED signed ata renders RASCUNHO, not FINAL', async () => {
    // The last live instance of ADR 0125 D5's fourth cell in the running product.
    // `dispose_meeting_minutes` empties the content without touching `status`, so
    // before this wiring a disposed `signed` ata still stamped FINAL over minutes
    // that no longer exist.
    const { buildMeetingPayload } = await import('./pdf-payload')

    detailMock.mockResolvedValue({ ...detail, status: 'signed', phiDisposed: true } as never)
    expect((await buildMeetingPayload('m1', REGISTERED_CTX)).provenance.watermark).toBe('draft')

    // ⭐ THE DIFFERENTIAL — without it, a provider hardcoded to 'draft' passes.
    detailMock.mockResolvedValue({ ...detail, status: 'signed', phiDisposed: false } as never)
    expect((await buildMeetingPayload('m1', REGISTERED_CTX)).provenance.watermark).toBe('final')
  })

  it('the seam genuinely DISCRIMINATES — it is not constant across statuses', async () => {
    // Without this, the loop above passes against a provider hardcoded to
    // 'draft' and a predicate hardcoded to 'draft'. Two constants agreeing is
    // not a wired seam.
    const { buildMeetingPayload } = await import('./pdf-payload')
    detailMock.mockResolvedValue({ ...detail, status: 'signed' } as never)
    expect((await buildMeetingPayload('m1', REGISTERED_CTX)).provenance.watermark).toBe('final')
    detailMock.mockResolvedValue({ ...detail, status: 'in_signature' } as never)
    expect((await buildMeetingPayload('m1', REGISTERED_CTX)).provenance.watermark).toBe('draft')
  })

  it('⛔ passes the DISPOSAL flag through — the argument list, not just the function', async () => {
    // THE GAP ALL THREE CALL SITES SHARED. A provider that calls the right
    // function with a short argument list is exactly as broken as one that calls
    // the wrong function, and looks finished.
    //
    // Now end-to-end: `meetingDisposed` reads `MeetingDetail.phiDisposed`, so the
    // spy pins the real value arriving, not merely the key being present. The
    // behavioural half is the `disposed` test below.
    vi.resetModules()
    const spy = vi.fn((_kind: string, _state: Record<string, unknown>) => 'draft' as const)
    vi.doMock('@/lib/pdf/documents/print-source', () => ({
      printSourceWatermark: spy,
      printSourceRegisters: vi.fn(() => true),
    }))
    const { buildMeetingPayload } = await import('./pdf-payload')
    await buildMeetingPayload('m1', REGISTERED_CTX)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(
      'meeting',
      expect.objectContaining({ status: 'signed', meetingDisposed: false }),
    )
    // ...and the key is genuinely present, not merely `undefined`-tolerant.
    const passed = spy.mock.calls[0]![1]
    expect(Object.keys(passed), 'meetingDisposed must be spelled out at the call site').toContain(
      'meetingDisposed',
    )
    vi.doUnmock('@/lib/pdf/documents/print-source')
    vi.resetModules()
  })
})

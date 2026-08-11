import { describe, expect, it } from 'vitest'

import { synthesizeThreadEvents } from './thread-events'
import type {
  ReferralAssignment,
  ReferralDetail,
  ReferralResolution,
} from './types'

/**
 * Unit tests for the pure Diálogo event synthesis (plan D7).
 *
 * The two properties worth pinning are the ones a rendering bug would hide:
 * every lifecycle field produces exactly one event of the right kind, and the
 * ORDER is reproducible — including at identical timestamps, where sort
 * stability alone would be an engine detail rather than a guarantee.
 */

const SOURCE = '11111111-1111-4111-8111-111111111111'
const TARGET = '22222222-2222-4222-8222-222222222222'

function baseDetail(overrides: Partial<ReferralDetail> = {}): ReferralDetail {
  return {
    id: 'ref-1',
    code: 'ENC-0001',
    direction: 'outgoing',
    status: 'draft',
    subject: 'Assunto',
    descriptionMd: null,
    referralTypeId: null,
    typeLabel: 'Parecer',
    typeColorToken: null,
    responseExpected: true,
    priority: 'routine',
    requestedActionId: null,
    requestedActionLabel: null,
    responseDueAt: null,
    overdue: false,
    declineReasonCode: null,
    parentReferralId: null,
    sourceCommissionId: SOURCE,
    sourceCommissionName: 'CCIH',
    targetCommissionId: TARGET,
    targetCommissionName: 'Farmácia',
    targetType: 'commission',
    targetHospitalId: null,
    sourceCaseId: 'case-source',
    sourceCaseNumber: 7,
    targetCaseId: null,
    targetCaseNumber: null,
    hasPatient: false,
    createdById: null,
    createdByName: null,
    waitingOnCommitteeId: null,
    waitingOnHospitalId: null,
    lastMessageAt: null,
    canComposeAsSource: false,
    canComposeAsTarget: false,
    sharedItems: [],
    messages: [],
    reply: null,
    resolutions: [],
    assignments: [],
    links: [],
    readReceipts: [],
    sentAt: null,
    receivedAt: null,
    decidedAt: null,
    concludedAt: null,
    withdrawnAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function assignment(
  overrides: Partial<ReferralAssignment> = {},
): ReferralAssignment {
  return {
    id: 'assign-1',
    referralId: 'ref-1',
    commissionId: TARGET,
    assigneeUserId: 'user-1',
    assigneeName: 'Ana Souza',
    assignmentRole: 'primary_reviewer',
    status: 'pending',
    dueAt: null,
    assignedById: null,
    assignedByName: null,
    assignedAt: '2026-01-05T00:00:00.000Z',
    completedAt: null,
    cancelledAt: null,
    ...overrides,
  }
}

function resolution(
  overrides: Partial<ReferralResolution> = {},
): ReferralResolution {
  return {
    id: 'res-1',
    referralId: 'ref-1',
    resolutionNumber: 1,
    resolvedByCommissionId: SOURCE,
    resolvedByUserId: null,
    resolvedByName: 'Bruno Lima',
    summaryMd: null,
    followUpRequired: false,
    finalReplyId: null,
    resolvedAt: '2026-01-06T00:00:00.000Z',
    reopenedAt: null,
    reopenedById: null,
    reopenedReason: null,
    ...overrides,
  }
}

describe('synthesizeThreadEvents', () => {
  it('returns [] for a referral with nothing set (a fresh draft)', () => {
    // `createdAt` is always populated and deliberately does NOT emit an event.
    expect(synthesizeThreadEvents(baseDetail())).toEqual([])
  })

  it('emits every kind exactly once, in lifecycle order', () => {
    const events = synthesizeThreadEvents(
      baseDetail({
        status: 'completed',
        sentAt: '2026-01-02T00:00:00.000Z',
        receivedAt: '2026-01-03T00:00:00.000Z',
        decidedAt: '2026-01-04T00:00:00.000Z',
        targetCaseId: 'case-target',
        targetCaseNumber: 42,
        assignments: [assignment()],
        resolutions: [resolution()],
        concludedAt: '2026-01-07T00:00:00.000Z',
      }),
    )

    expect(events.map((e) => e.kind)).toEqual([
      'sent',
      'received',
      'decided_accepted',
      // Anchored at `decidedAt`, so it ties with the acceptance and the emission
      // index puts it immediately after.
      'case_linked',
      'assignment',
      'resolution',
      'concluded',
    ])
  })

  it('emits `withdrawn` from withdrawnAt', () => {
    const events = synthesizeThreadEvents(
      baseDetail({
        status: 'withdrawn',
        sentAt: '2026-01-02T00:00:00.000Z',
        withdrawnAt: '2026-01-03T00:00:00.000Z',
      }),
    )
    expect(events.map((e) => e.kind)).toEqual(['sent', 'withdrawn'])
    expect(events[1].at).toBe('2026-01-03T00:00:00.000Z')
  })

  it('carries the PHI-free decline reason + its pt-BR label on the decline path', () => {
    const events = synthesizeThreadEvents(
      baseDetail({
        status: 'rejected',
        sentAt: '2026-01-02T00:00:00.000Z',
        receivedAt: '2026-01-03T00:00:00.000Z',
        decidedAt: '2026-01-04T00:00:00.000Z',
        declineReasonCode: 'wrong_committee',
      }),
    )

    const decided = events.find((e) => e.kind === 'decided_declined')
    expect(decided).toBeDefined()
    expect(events.some((e) => e.kind === 'decided_accepted')).toBe(false)
    if (decided?.kind !== 'decided_declined') throw new Error('wrong kind')
    expect(decided.reasonCode).toBe('wrong_committee')
    expect(decided.reasonLabel).toBe('Comissão incorreta')
  })

  it('leaves the decline label null when no reason code was recorded', () => {
    const events = synthesizeThreadEvents(
      baseDetail({
        status: 'rejected',
        decidedAt: '2026-01-04T00:00:00.000Z',
        declineReasonCode: null,
      }),
    )
    const decided = events[0]
    if (decided.kind !== 'decided_declined') throw new Error('wrong kind')
    expect(decided.reasonLabel).toBeNull()
  })

  it('marks the case-link event approximate and anchors it on the best milestone', () => {
    const withDecision = synthesizeThreadEvents(
      baseDetail({
        status: 'in_review',
        sentAt: '2026-01-02T00:00:00.000Z',
        receivedAt: '2026-01-03T00:00:00.000Z',
        decidedAt: '2026-01-04T00:00:00.000Z',
        targetCaseId: 'case-target',
        targetCaseNumber: 42,
      }),
    ).find((e) => e.kind === 'case_linked')
    if (withDecision?.kind !== 'case_linked') throw new Error('missing event')
    expect(withDecision.at).toBe('2026-01-04T00:00:00.000Z')
    expect(withDecision.approximate).toBe(true)
    expect(withDecision.caseNumber).toBe(42)

    // Falls back down the chain: no decision → received → sent → created.
    const fromReceived = synthesizeThreadEvents(
      baseDetail({
        sentAt: '2026-01-02T00:00:00.000Z',
        receivedAt: '2026-01-03T00:00:00.000Z',
        targetCaseId: 'case-target',
      }),
    ).find((e) => e.kind === 'case_linked')
    expect(fromReceived?.at).toBe('2026-01-03T00:00:00.000Z')

    const fromCreated = synthesizeThreadEvents(
      baseDetail({ targetCaseId: 'case-target' }),
    ).find((e) => e.kind === 'case_linked')
    expect(fromCreated?.at).toBe('2026-01-01T00:00:00.000Z')
  })

  it('orders ties at identical timestamps deterministically (same array every run)', () => {
    const SAME = '2026-01-04T00:00:00.000Z'
    const detail = baseDetail({
      status: 'completed',
      sentAt: SAME,
      receivedAt: SAME,
      decidedAt: SAME,
      targetCaseId: 'case-target',
      assignments: [
        assignment({ id: 'assign-a', assignedAt: SAME }),
        assignment({ id: 'assign-b', assignedAt: SAME }),
      ],
      resolutions: [resolution({ resolvedAt: SAME })],
      concludedAt: SAME,
    })

    const first = synthesizeThreadEvents(detail)
    const second = synthesizeThreadEvents(detail)

    expect(first.map((e) => e.id)).toEqual([
      'sent',
      'received',
      'decided',
      'case_linked:case-target',
      'assignment:assign-a',
      'assignment:assign-b',
      'resolution:res-1',
      'concluded',
    ])
    // Reproducibility is the property under test — not just "some" order.
    expect(second.map((e) => e.id)).toEqual(first.map((e) => e.id))
    expect(first.map((e) => e.seq)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('sorts out-of-order input ascending by timestamp, not by emission order', () => {
    const events = synthesizeThreadEvents(
      baseDetail({
        status: 'completed',
        // The assignment predates the conclusion but is emitted after it in the
        // lifecycle sweep; the sort must place it first.
        concludedAt: '2026-01-09T00:00:00.000Z',
        assignments: [assignment({ assignedAt: '2026-01-05T00:00:00.000Z' })],
        sentAt: '2026-01-02T00:00:00.000Z',
      }),
    )
    expect(events.map((e) => e.at)).toEqual([
      '2026-01-02T00:00:00.000Z',
      '2026-01-05T00:00:00.000Z',
      '2026-01-09T00:00:00.000Z',
    ])
  })

  it('resolves the assignment side against the referral, source and target', () => {
    const events = synthesizeThreadEvents(
      baseDetail({
        assignments: [
          assignment({ id: 'a-src', commissionId: SOURCE }),
          assignment({ id: 'a-tgt', commissionId: TARGET }),
          assignment({ id: 'a-other', commissionId: 'other-commission' }),
        ],
      }),
    )
    expect(
      events.map((e) => (e.kind === 'assignment' ? e.side : null)),
    ).toEqual(['source', 'target', 'unknown'])
  })

  it('never labels an assignment target-side on a DT referral (null targetCommissionId)', () => {
    // ADR 0094 W4: a `technical_director` referral has NO target commission. A
    // naive `commissionId === detail.targetCommissionId` is safe here only
    // because the comparison is null-guarded — the regression this pins is an
    // assignment whose commission id is missing being read as "the DT side".
    const events = synthesizeThreadEvents(
      baseDetail({
        targetType: 'technical_director',
        targetCommissionId: null,
        targetCommissionName: 'Diretoria Técnica — Hospital A',
        targetHospitalId: 'hosp-1',
        sentAt: '2026-01-02T00:00:00.000Z',
        assignments: [assignment({ commissionId: SOURCE })],
      }),
    )

    const sent = events[0]
    if (sent.kind !== 'sent') throw new Error('wrong kind')
    // The composed DT display name is what the rail/thread shows for "Para".
    expect(sent.targetName).toBe('Diretoria Técnica — Hospital A')

    const assign = events.find((e) => e.kind === 'assignment')
    if (assign?.kind !== 'assignment') throw new Error('missing event')
    expect(assign.side).toBe('source')
  })

  it('carries resolution metadata for the timeline row', () => {
    const events = synthesizeThreadEvents(
      baseDetail({
        status: 'resolved',
        resolutions: [
          resolution({ id: 'res-1', resolutionNumber: 1 }),
          resolution({
            id: 'res-2',
            resolutionNumber: 2,
            resolvedAt: '2026-01-08T00:00:00.000Z',
            followUpRequired: true,
          }),
        ],
      }),
    )
    const second = events[1]
    if (second.kind !== 'resolution') throw new Error('wrong kind')
    expect(second.resolutionNumber).toBe(2)
    expect(second.followUpRequired).toBe(true)
    expect(second.resolvedByName).toBe('Bruno Lima')
  })
})

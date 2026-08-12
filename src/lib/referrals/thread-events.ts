/**
 * Synthesized Diálogo system events (referral detail redesign, plan D7).
 *
 * A PURE derivation: it reads ONLY the fields the audited `get_referral_detail`
 * door already returned to this viewer and emits the timeline rows the messenger
 * layout interleaves between message bubbles. Deliberately dependency-free (no
 * Supabase, no `next/*`, no clock) so it runs identically on the server, in a
 * client component, and in Vitest.
 *
 * Two invariants this module upholds, both load-bearing:
 *
 *  1. **No new storage.** There is no `referral_events` table and this phase adds
 *     none. Every event is anchored on a column that already exists — with ONE
 *     documented approximation (`case_linked`, see below). "Just add a
 *     `target_case_linked_at`" was explicitly rejected in the plan.
 *  2. **Deterministic order.** Events sort ascending by timestamp, and events that
 *     share a timestamp break the tie on {@link ReferralThreadEvent.seq} — the
 *     emission index — rather than relying on `Array.prototype.sort` stability or
 *     on object key order. Two runs over the same detail always produce the same
 *     array. (Ties are not hypothetical: a referral that was accepted and linked
 *     to a case lands both events on `decidedAt`.)
 *
 * PHI: an event carries no body text. The decline arm carries the PHI-FREE
 * `decline_reason_code` and its pt-BR label — never the column-REVOKED
 * `decline_note`.
 */

import { REFERRAL_DECLINE_REASON_LABELS } from './types'
import type { ReferralDetail, ReferralThreadEvent } from './types'

/**
 * Which side of the referral a commission id sits on.
 *
 * The target arm is guarded on a non-null `targetCommissionId`: an ADR 0094 W4
 * `technical_director` referral leaves it NULL, and `null === null` would
 * otherwise label an unmatched assignment as target-side.
 */
function sideOf(
  detail: ReferralDetail,
  commissionId: string,
): 'source' | 'target' | 'unknown' {
  if (commissionId === detail.sourceCommissionId) return 'source'
  if (
    detail.targetCommissionId !== null &&
    commissionId === detail.targetCommissionId
  ) {
    return 'target'
  }
  return 'unknown'
}

/**
 * Sort key for an event timestamp. An unparseable value sorts LAST (rather than
 * throwing or landing at epoch 0, either of which would silently reorder a real
 * timeline), and then ties break on `seq` — so even malformed input is ordered
 * reproducibly.
 */
function timeKey(at: string): number {
  const parsed = Date.parse(at)
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}

function compareEvents(a: ReferralThreadEvent, b: ReferralThreadEvent): number {
  const delta = timeKey(a.at) - timeKey(b.at)
  if (delta !== 0 && Number.isFinite(delta)) return delta
  // Equal timestamps (or two unparseable ones): the emission index decides.
  return a.seq - b.seq
}

/**
 * Derive the ordered system-event rows for one referral's Diálogo timeline.
 *
 * Emission order (which is also the tie-break order at equal timestamps) follows
 * the lifecycle: sent → received → decided → case linked → assignments →
 * resolutions → concluded → withdrawn. A referral with nothing set — a fresh
 * draft — yields `[]`; `createdAt` deliberately does NOT emit an event, because
 * the thread already begins at the referral itself.
 */
export function synthesizeThreadEvents(
  detail: ReferralDetail,
): ReferralThreadEvent[] {
  const out: ReferralThreadEvent[] = []

  if (detail.sentAt) {
    out.push({
      kind: 'sent',
      id: 'sent',
      at: detail.sentAt,
      seq: out.length,
      targetName: detail.targetCommissionName,
    })
  }

  if (detail.receivedAt) {
    out.push({
      kind: 'received',
      id: 'received',
      at: detail.receivedAt,
      seq: out.length,
      targetName: detail.targetCommissionName,
    })
  }

  if (detail.decidedAt) {
    if (detail.status === 'rejected') {
      out.push({
        kind: 'decided_declined',
        id: 'decided',
        at: detail.decidedAt,
        seq: out.length,
        reasonCode: detail.declineReasonCode,
        reasonLabel: detail.declineReasonCode
          ? REFERRAL_DECLINE_REASON_LABELS[detail.declineReasonCode]
          : null,
      })
    } else {
      // `decidedAt` is stamped by BOTH accept and decline; `rejected` is terminal,
      // so any other status on a decided referral means it was accepted.
      out.push({
        kind: 'decided_accepted',
        id: 'decided',
        at: detail.decidedAt,
        seq: out.length,
      })
    }
  }

  if (detail.targetCaseId) {
    // ⚠ APPROXIMATION (plan: "no stored timestamp — anchor at best-available and
    // document it; do NOT invent a column"). `case_referral` has no
    // `target_case_linked_at`. B can only link a case once the referral has
    // reached it, so we anchor at the LATEST milestone the link provably follows:
    // decided → received → sent → created. The event therefore never sorts before
    // the referral existed, but it MAY sort earlier than the link truly happened
    // (e.g. a case linked days after acceptance still shows at acceptance). The
    // `approximate: true` flag exists so the UI states this rather than implying
    // precision.
    const anchor =
      detail.decidedAt ?? detail.receivedAt ?? detail.sentAt ?? detail.createdAt
    out.push({
      kind: 'case_linked',
      id: `case_linked:${detail.targetCaseId}`,
      at: anchor,
      seq: out.length,
      caseId: detail.targetCaseId,
      caseNumber: detail.targetCaseNumber,
      approximate: true,
    })
  }

  for (const assignment of detail.assignments) {
    // NOTE: the column is `assigned_at` → `assignedAt`. `ReferralAssignment` has
    // no `createdAt` (the plan text said otherwise).
    out.push({
      kind: 'assignment',
      id: `assignment:${assignment.id}`,
      at: assignment.assignedAt,
      seq: out.length,
      assignmentId: assignment.id,
      assigneeName: assignment.assigneeName,
      commissionId: assignment.commissionId,
      side: sideOf(detail, assignment.commissionId),
      role: assignment.assignmentRole,
      status: assignment.status,
    })
  }

  for (const resolution of detail.resolutions) {
    // Likewise: `referral_resolutions` stamps `resolved_at` → `resolvedAt`.
    out.push({
      kind: 'resolution',
      id: `resolution:${resolution.id}`,
      at: resolution.resolvedAt,
      seq: out.length,
      resolutionId: resolution.id,
      resolutionNumber: resolution.resolutionNumber,
      resolvedByName: resolution.resolvedByName,
      followUpRequired: resolution.followUpRequired,
    })
  }

  if (detail.concludedAt) {
    out.push({
      kind: 'concluded',
      id: 'concluded',
      at: detail.concludedAt,
      seq: out.length,
    })
  }

  if (detail.withdrawnAt) {
    out.push({
      kind: 'withdrawn',
      id: 'withdrawn',
      at: detail.withdrawnAt,
      seq: out.length,
    })
  }

  return out.sort(compareEvents)
}

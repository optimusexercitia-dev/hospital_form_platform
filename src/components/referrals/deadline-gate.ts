import type { ReferralStatus } from "@/lib/referrals/types";

/**
 * The statuses in which either coordinator may set/update the SLA deadline (RV2 R2)
 * — non-terminal and post-draft. `answered` still counts: A owes the closing move.
 */
const DEADLINE_EDITABLE_STATUSES: readonly ReferralStatus[] = [
  "sent",
  "received",
  "accepted",
  "in_review",
  "awaiting_information",
  "answered",
];

/**
 * Whether THIS viewer may set/update the SLA deadline. A convenience gate only — the
 * `set_referral_deadline` RPC re-checks authority (42501) and rejects a past date
 * (HC0A4).
 *
 * ⚠ This lives in a PLAIN module, not beside the button it gates. The button is
 * `"use client"`, and the referral detail page is a Server Component that must ask this
 * question to decide whether to hand the Detalhes card a deadline control at all —
 * calling a function exported from a client module throws at render ("Attempted to call
 * … from the server"), which no typecheck, lint or unit run catches. Two hand-copied
 * status lists would drift apart just as silently, so both callers import this one.
 */
export function canSetReferralDeadline({
  status,
  canManageTarget,
  canManageSource,
}: {
  status: ReferralStatus;
  canManageTarget: boolean;
  canManageSource: boolean;
}): boolean {
  return (
    (canManageTarget || canManageSource) &&
    DEADLINE_EDITABLE_STATUSES.includes(status)
  );
}

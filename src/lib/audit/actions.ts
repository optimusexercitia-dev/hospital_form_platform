'use server'

import { verifyAuditChain, type AuditChainResult } from '@/lib/queries/audit'
import { AUDIT_MESSAGES } from '@/lib/audit/messages'

/**
 * Audit-trail server actions (Phase 13 — Audit Trail; Architecture Rules 9 & 10).
 *
 * The audit log itself is WRITE-ONLY through the `app.audit_write` DEFINER writer
 * (instrumentation triggers + the explicit `.read`/`.export` call sites) — there
 * are NO user-facing mutation actions on the log. The only interactive action is
 * the read-only "Verificar integridade" control, which surfaces the
 * `verify_audit_chain` DEFINER RPC. All user-facing strings are pt-BR
 * (`./messages.ts`); raw Postgres errors never reach the UI (CLAUDE.md §8).
 */

/** The result the "Verificar integridade" control renders: the chain verdict
 * plus a pre-resolved pt-BR message for the success/failure banners. */
export interface VerifyChainState {
  ok: boolean
  /** The chain verdict; `null` when the call failed before producing one. */
  result: AuditChainResult | null
  /** A pre-resolved pt-BR status message (OK / broken / error). */
  message: string
}

/**
 * Run the chain-integrity check for one TIER and return a UI-ready verdict
 * (multi-tenancy Phase B — the audit log is a 3-tier chain). Pass:
 *  - `{ commissionId }` for a commission chain (staff_admin / org_admin gated),
 *  - `{ organizationId }` for the org chain (org_admin gated — `/o/[org]/manage`),
 *  - nothing for the platform chain (platform_admin gated — `/admin`).
 * The `verify_audit_chain` RPC is authz-gated INTERNALLY per tier (the DB is the
 * authority), so no separate pre-check is needed — a forbidden caller's RPC error
 * surfaces as the generic pt-BR message via the query layer's
 * `{ ok: false, brokenSeq: -1 }` sentinel. Never throws.
 */
export async function verifyAuditChainAction(
  scope?: string | { commissionId?: string; organizationId?: string },
): Promise<VerifyChainState> {
  const result = await verifyAuditChain(scope)

  if (result.ok) {
    return { ok: true, result, message: AUDIT_MESSAGES.chainOk }
  }
  // brokenSeq === -1 is the query layer's "could not verify" sentinel (forbidden
  // / RPC error) — distinct from a genuine tamper at a real seq (>= 1).
  if (result.brokenSeq < 1) {
    return { ok: false, result: null, message: AUDIT_MESSAGES.generic }
  }
  return { ok: false, result, message: AUDIT_MESSAGES.chainBroken }
}

'use server'

/**
 * Case ACCESS-CONTROL server actions (Case Access Control increment; ADR 0033;
 * Architecture Rules 1, 9 & 10).
 *
 * Two coordinator-only grant actions over the per-case ACL `public.case_access`
 * (ADR 0033 D6): grant read/write to any commission member, and revoke. Both route
 * through the SECURITY DEFINER RPCs `grant_case_access` / `revoke_case_access`
 * (BE-4), which gate the `case_access` flag, re-check `staff_admin`/admin, and
 * require the target to be a current commission member (`HC021`). Read that flows
 * from ATTRIBUTION (a phase/narrative assignee) is COMPUTED in `app.can_read_case`,
 * never a stored `case_access` row — so these actions manage only the EXPLICIT
 * grants (ADR 0033 D6).
 *
 * RLS is the authority; each action ALSO re-verifies commission-scoped authz
 * server-side for a clean pt-BR "forbidden" before the RPC call. All user-facing
 * strings are pt-BR; raw Supabase/Postgres errors NEVER reach the UI (CLAUDE.md
 * §8). The feature is flag-gated via {@link caseAccessEnabled}.
 *
 * CONTRACT-FIRST STUB MODULE: signatures + result/`ActionState` shapes are frozen
 * for `frontend`; the RPC wiring lands in BE-4 (after the migration + `gen:types`).
 *
 * SQLSTATE → pt-BR (BE-2 continues the HC0xx class from HC055):
 *   HC021 → "O responsável deve ser membro da comissão." (target not a member)
 */

import { getSessionContext } from '@/lib/queries/session'

// ---------------------------------------------------------------------------
// Result shape (the shared `useActionState`-shaped contract)
// ---------------------------------------------------------------------------

/** The shared `useActionState`-shaped result for every case-access mutation. */
export interface ActionState {
  ok: boolean
  /** On failure: a pt-BR error. On success: optional pt-BR confirmation text. */
  error?: string
  fieldErrors?: Record<string, string>
}

/** The two grant levels (write implies read). Mirrors the `case_access.level` check. */
export type CaseAccessLevel = 'read' | 'write'

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  unavailable: 'O controle de acesso ao caso não está disponível.',
  missingCase: 'Caso não encontrado.',
  missingUser: 'Selecione um membro.',
  invalidLevel: 'Nível de acesso inválido.',
  // HC021 — the grant target must be a current member of the case's commission.
  notMember: 'O responsável deve ser membro da comissão.',
  granted: 'Acesso concedido.',
  revoked: 'Acesso removido.',
} as const

// ---------------------------------------------------------------------------
// Feature-flag gate (mirror of `narrativesEnabled` / `interviewsEnabled`)
// ---------------------------------------------------------------------------

/**
 * Feature-flag gate for the case-access surface. Calls the SECURITY DEFINER
 * `public.case_access_enabled()` read (BE-4) so the gate is authoritative
 * server-side (the flag lives in the locked-down `app` schema). Fails closed.
 *
 * CONTRACT-FIRST STUB: wired to the RPC in BE-4. Returns `false` until then so no
 * UI path mistakes the dark feature for live.
 */
export async function caseAccessEnabled(): Promise<boolean> {
  // BE-4: `const { data, error } = await supabase.rpc('case_access_enabled')`.
  return false
}

/** Authorize a case-access action: admin, or a staff_admin of THAT commission. */
async function authorizeCommission(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.memberships.some(
    (m) => m.commission.id === commissionId && m.role === 'staff_admin',
  )
}

// ---------------------------------------------------------------------------
// Grants (coordinator-only)
// ---------------------------------------------------------------------------

/**
 * Grant a commission member read or write access to a case (upsert — re-granting
 * at a new level updates it; `write` implies `read`). Coordinator-only; the target
 * must be a current member of the case's commission (`HC021`). Routed through the
 * DEFINER `grant_case_access`.
 *
 * CONTRACT-FIRST STUB: the body is wired to the RPC in BE-4.
 */
export async function grantCaseAccess(
  caseId: string,
  userId: string,
  level: CaseAccessLevel,
): Promise<ActionState> {
  if (!caseId) return { ok: false, error: MESSAGES.missingCase }
  if (!userId) return { ok: false, fieldErrors: { userId: MESSAGES.missingUser } }
  if (level !== 'read' && level !== 'write') {
    return { ok: false, error: MESSAGES.invalidLevel }
  }
  // BE-4: gate caseAccessEnabled(), resolve+re-check the case's commission via
  // authorizeCommission(...), then call
  // supabase.rpc('grant_case_access', { p_case: caseId, p_user: userId, p_level: level }).
  void authorizeCommission
  throw new Error('não implementado — BE-4')
}

/**
 * Revoke a member's explicit `case_access` grant for a case. Coordinator-only.
 * Routed through the DEFINER `revoke_case_access`. NOTE: revoking a grant does NOT
 * remove attribution-derived read — an assignee of a phase/narrative still reads
 * the full case (ADR 0033 D6); unassign them to remove that.
 *
 * CONTRACT-FIRST STUB: the body is wired to the RPC in BE-4.
 */
export async function revokeCaseAccess(
  caseId: string,
  userId: string,
): Promise<ActionState> {
  if (!caseId) return { ok: false, error: MESSAGES.missingCase }
  if (!userId) return { ok: false, error: MESSAGES.missingUser }
  // BE-4: gate caseAccessEnabled(), re-check commission, then call
  // supabase.rpc('revoke_case_access', { p_case: caseId, p_user: userId }).
  throw new Error('não implementado — BE-4')
}

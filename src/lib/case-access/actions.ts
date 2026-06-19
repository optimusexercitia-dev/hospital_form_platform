'use server'

/**
 * Case ACCESS-CONTROL server actions (Case Access Control increment; ADR 0033;
 * Architecture Rules 1, 9 & 10).
 *
 * Two coordinator-only grant actions over the per-case ACL `public.case_access`
 * (ADR 0033 D6): grant read/write to any commission member, and revoke. Both route
 * through the SECURITY DEFINER RPCs `grant_case_access` / `revoke_case_access`,
 * which gate the `case_access` flag, re-check `staff_admin`/admin, and require the
 * target to be a current commission member (`HC021`). Read that flows from
 * ATTRIBUTION (a phase/narrative assignee) is COMPUTED in `app.can_read_case`,
 * never a stored `case_access` row — so these actions manage only the EXPLICIT
 * grants (ADR 0033 D6).
 *
 * RLS is the authority; each action ALSO re-verifies commission-scoped authz
 * server-side for a clean pt-BR "forbidden" before the RPC call. All user-facing
 * strings are pt-BR; raw Supabase/Postgres errors NEVER reach the UI (CLAUDE.md
 * §8). The feature is flag-gated via {@link caseAccessEnabled}.
 *
 * SQLSTATE → pt-BR:
 *   HC021 → "O responsável deve ser membro da comissão." (target not a member)
 *   42501 → forbidden; 23514 → unavailable (flag off).
 */

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

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

const PG_CHECK_VIOLATION = '23514'
const PG_FORBIDDEN = '42501'
const HC_NOT_MEMBER = 'HC021'

const CASE_PATH = '/c/[slug]/manage/cases/[caseId]'
const STAFF_CASE_PATH = '/c/[slug]/casos/[caseId]'

function revalidateCase(): void {
  revalidatePath(CASE_PATH, 'page')
  revalidatePath(STAFF_CASE_PATH, 'page')
}

/** Map a case-access RPC error to friendly pt-BR (prefer the RPC's own message). */
function mapError(error: { code?: string; message?: string } | null): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case HC_NOT_MEMBER:
      return MESSAGES.notMember
    case PG_FORBIDDEN:
      return MESSAGES.forbidden
    case PG_CHECK_VIOLATION:
      // The flag-off gate (assert_case_access_enabled) raises check_violation.
      return MESSAGES.unavailable
    default:
      return MESSAGES.generic
  }
}

// ---------------------------------------------------------------------------
// Feature-flag gate (mirror of `narrativesEnabled` / `interviewsEnabled`)
// ---------------------------------------------------------------------------

/**
 * Feature-flag gate for the case-access surface. Calls the SECURITY DEFINER
 * `public.case_access_enabled()` read so the gate is authoritative server-side
 * (the flag lives in the locked-down `app` schema). Fails closed.
 */
export async function caseAccessEnabled(): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('case_access_enabled')
  if (error) return false
  return data === true
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

/** Resolve a case's commission (RLS-scoped read). `null` when unreadable/absent. */
async function commissionOfCase(
  supabase: SupabaseClient<Database>,
  caseId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('cases')
    .select('commission_id')
    .eq('id', caseId)
    .maybeSingle()
  return data?.commission_id ?? null
}

// ---------------------------------------------------------------------------
// Grants (coordinator-only)
// ---------------------------------------------------------------------------

/**
 * Grant a commission member read or write access to a case (upsert — re-granting
 * at a new level updates it; `write` implies `read`). Coordinator-only; the target
 * must be a current member of the case's commission (`HC021`). Routed through the
 * DEFINER `grant_case_access`.
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
  if (!(await caseAccessEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfCase(supabase, caseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('grant_case_access', {
    p_case: caseId,
    p_user: userId,
    p_level: level,
  })

  if (error) return { ok: false, error: mapError(error) }

  revalidateCase()
  return { ok: true, error: MESSAGES.granted }
}

/**
 * Revoke a member's explicit `case_access` grant for a case. Coordinator-only.
 * Routed through the DEFINER `revoke_case_access`. NOTE: revoking a grant does NOT
 * remove attribution-derived read — an assignee of a phase/narrative still reads
 * the full case (ADR 0033 D6); unassign them to remove that.
 */
export async function revokeCaseAccess(
  caseId: string,
  userId: string,
): Promise<ActionState> {
  if (!caseId) return { ok: false, error: MESSAGES.missingCase }
  if (!userId) return { ok: false, error: MESSAGES.missingUser }
  if (!(await caseAccessEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfCase(supabase, caseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('revoke_case_access', {
    p_case: caseId,
    p_user: userId,
  })

  if (error) return { ok: false, error: mapError(error) }

  revalidateCase()
  return { ok: true, error: MESSAGES.revoked }
}

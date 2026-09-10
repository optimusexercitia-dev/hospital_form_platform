'use server'

/**
 * Case ACCESS-CONTROL server actions (Case Access Control increment; ADR 0033;
 * Architecture Rules 1, 9 & 10).
 *
 * Two grant actions over the per-case ACL `public.case_access_grants` (ADR 0033 D6;
 * the `case_access` TABLE was dropped and the `case_access` FLAG retired by ADR 0078
 * B4 — verify against the catalog, never this line): grant read/write to a commission
 * member, and revoke. Both route through the SECURITY DEFINER RPCs
 * `grant_case_access` / `revoke_case_access`, which re-check authority
 * (`app.is_staff_admin_of` OR `app.is_tenancy_admin_of` — see
 * {@link authorizeCommission}), the U1 exclusion, and the target's current
 * commission membership (`HC021`). Read that flows from ATTRIBUTION (a
 * phase/narrative assignee) is COMPUTED in `app._case_caps`, never a stored grant
 * row — so these actions manage only the EXPLICIT grants (ADR 0033 D6).
 *
 * RLS is the authority; each action ALSO re-verifies commission-scoped authz
 * server-side for a clean pt-BR "forbidden" before the RPC call. All user-facing
 * strings are pt-BR; raw Supabase/Postgres errors NEVER reach the UI (CLAUDE.md
 * §8). The `case_access` flag was RETIRED at Stage B (ADR 0078 D9); {@link caseAccessEnabled}
 * is a constant kept as the removal seam.
 *
 * SQLSTATE → pt-BR:
 *   HC021 → "O responsável deve ser membro da comissão." (target not a member)
 *   HC0U0 → "Não é possível conceder edição em um caso encerrado." (ADR 0205 D9)
 *   42501 → forbidden; 23514 → unavailable (flag off).
 * A thrown tenancy read (`getCommissionTenancy`'s deliberate throw on a genuine
 * query error) is caught around {@link authorizeCommission} and mapped to
 * "unavailable", never "forbidden" — a transient failure must not read as a
 * denial (QA MINOR-2).
 */

import { revalidatePath } from 'next/cache'

import { isCommissionAdmin } from '@/lib/auth/access'
import { getCommissionTenancy } from '@/lib/queries/commissions'
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

/**
 * The two grant levels (write implies read). Mirrors `grant_case_access`'s `p_level`
 * parameter; the ledger stores boolean capability columns (write ⇒ read), not a level.
 */
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
  invalidExpiry: 'A data de expiração deve ser futura.',
  // HC0U0 (ADR 0205 D9) — the door refuses a WRITE grant on a terminal case.
  // READ grants on a closed case stay legal, so this must never be phrased as
  // "this case is closed" — it is about the LEVEL, not about the case.
  terminalWrite: 'Não é possível conceder edição em um caso encerrado.',
  granted: 'Acesso concedido.',
  revoked: 'Acesso removido.',
} as const

const PG_CHECK_VIOLATION = '23514'
const PG_FORBIDDEN = '42501'
const HC_NOT_MEMBER = 'HC021'
const HC_TERMINAL_WRITE = 'HC0U0'

const CASE_PATH = '/o/[org]/c/[commission]/manage/cases/[caseId]'
const STAFF_CASE_PATH = '/o/[org]/c/[commission]/casos/[caseId]'

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
    case HC_TERMINAL_WRITE:
      return MESSAGES.terminalWrite
    case PG_FORBIDDEN:
      return MESSAGES.forbidden
    case PG_CHECK_VIOLATION:
      // case_access_grants shape CHECKs (e.g. write⇒read, restricted⇒standard) raise
      // check_violation; the retired case_access flag-off gate (ADR 0078 B4) no longer does.
      return MESSAGES.unavailable
    default:
      return MESSAGES.generic
  }
}

// ---------------------------------------------------------------------------
// Feature-flag gate (mirror of `narrativesEnabled` / `interviewsEnabled`)
// ---------------------------------------------------------------------------

/**
 * Whether the case-access surface is enabled. ADR 0078 Stage B (B4/D9) RETIRED the
 * `case_access` feature flag and shipped a single authorization path — cases are
 * permanently ON. This helper is now a constant (kept `async` for its many `await`
 * call sites, and kept as the single seam so the dead "Minhas fases" flag-OFF branches
 * can be removed in the Gate-2 frontend cleanup without re-plumbing every caller).
 */
export async function caseAccessEnabled(): Promise<boolean> {
  return true
}

/**
 * Authorize a case-access action — the TS MIRROR of the door's own authority
 * disjunction, and nothing else (ADR 0205 D12, PO ruling 2026-09-10):
 *
 *     app.is_staff_admin_of(commission) OR app.is_tenancy_admin_of(commission)
 *
 * where tenancy admin = `org_admin` of the commission's organization OR
 * `hospital_admin` of its hospital (live body of `app.is_tenancy_admin_of_for`).
 *
 * ⛔ `context.isAdmin` IS DELIBERATELY NOT AN ARM, and removing it is the point of
 * D12. A platform_admin was passed here and REFUSED by the door with 42501 — this
 * pre-check admitted exactly the principal the DB denies, producing a rendered,
 * clickable affordance that always failed. ADR 0078 A35's noun rule is why the door
 * says no: a platform admin governs tenancy, identity, vocabulary and audit, never
 * commission content. Neither `app.is_staff_admin_of` nor `app.is_tenancy_admin_of`
 * carries an `is_admin` fallback, so neither does this.
 *
 * ⛔ AND THE TENANCY ARMS WERE MISSING, which is the same defect in the opposite
 * direction: the door ACCEPTS an `org_admin` / `hospital_admin` (the B6
 * single-coordinator deadlock exit, stamped `org_admin_deadlock_exit`), and this
 * gate refused them. A gate that both over- and under-admits is not "close enough";
 * it is two bugs sharing a line. The predicate is NOT re-derived here —
 * {@link isCommissionAdmin} already IS the tenancy mirror, and a third copy is how
 * this repo's sibling-axis defects keep recurring.
 *
 * ⚠ RLS is still the authority (Architecture Rule 1). This is UX only: a false
 * negative can never grant what the DB denies, and a false positive is caught by
 * the DEFINER door one layer down.
 *
 * Both DB arms open with `app.is_active(...)` (`app.is_tenancy_admin_of_for`, and
 * the staff_admin arm's catalog path), so this mirror fails closed on an inactive
 * account before checking either arm (QA MINOR-1).
 */
async function authorizeCommission(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false

  // Both DB arms open with app.is_active(...): inactive accounts fail closed
  // (sibling: src/lib/queries/session.ts, `if (context.isInactive) return false`).
  if (context.isInactive) return false

  // ARM 1 — app.is_staff_admin_of(commission).
  if (
    context.memberships.some(
      (m) => m.commission.id === commissionId && m.role === 'staff_admin',
    )
  ) {
    return true
  }

  // ARM 2 — app.is_tenancy_admin_of(commission). The DB predicate resolves the
  // commission's org + hospital itself; the mirror needs the same two coordinates.
  const tenancy = await getCommissionTenancy(commissionId)
  if (!tenancy) return false

  return isCommissionAdmin(context, tenancy)
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
 * updates level/expiry/reason; `write` implies `read`). Coordinator-only; the
 * target must be a current member of the case's commission (`HC021`). Routed
 * through the DEFINER `grant_case_access`.
 *
 * @param expiresAt Optional ISO timestamptz; the grant is DENIED once past. `null`
 *   / omitted = no expiry ("sem prazo"). Must be in the future when provided.
 * @param reason Optional pt-BR justification (LGPD / accreditation evidence).
 */
export async function grantCaseAccess(
  caseId: string,
  userId: string,
  level: CaseAccessLevel,
  expiresAt?: string | null,
  reason?: string | null,
): Promise<ActionState> {
  if (!caseId) return { ok: false, error: MESSAGES.missingCase }
  if (!userId) return { ok: false, fieldErrors: { userId: MESSAGES.missingUser } }
  if (level !== 'read' && level !== 'write') {
    return { ok: false, error: MESSAGES.invalidLevel }
  }

  // Validate an expiry client-side for a clean field error (the RPC re-checks).
  const expiry = expiresAt?.trim() || null
  if (expiry !== null) {
    const d = new Date(expiry)
    if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
      return { ok: false, fieldErrors: { expiresAt: MESSAGES.invalidExpiry } }
    }
  }
  const reasonText = reason?.trim() || null

  if (!(await caseAccessEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfCase(supabase, caseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }

  let authorized: boolean
  try {
    authorized = await authorizeCommission(commissionId)
  } catch {
    // A transient failure on the tenancy read is "unavailable", never "forbidden"
    // and never an unhandled rejection into the error boundary (QA MINOR-2).
    return { ok: false, error: MESSAGES.unavailable }
  }
  if (!authorized) return { ok: false, error: MESSAGES.forbidden }

  const { error } = await supabase.rpc('grant_case_access', {
    p_case: caseId,
    p_user: userId,
    p_level: level,
    p_expires_at: expiry ?? undefined,
    p_reason: reasonText ?? undefined,
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

  let authorized: boolean
  try {
    authorized = await authorizeCommission(commissionId)
  } catch {
    // A transient failure on the tenancy read is "unavailable", never "forbidden"
    // and never an unhandled rejection into the error boundary (QA MINOR-2).
    return { ok: false, error: MESSAGES.unavailable }
  }
  if (!authorized) return { ok: false, error: MESSAGES.forbidden }

  const { error } = await supabase.rpc('revoke_case_access', {
    p_case: caseId,
    p_user: userId,
  })

  if (error) return { ok: false, error: mapError(error) }

  revalidateCase()
  return { ok: true, error: MESSAGES.revoked }
}

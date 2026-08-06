'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

/**
 * Hospital-affiliation server actions (ADR 0097 D13, ADR 0098 W2.1) — the CONTRACT
 * `frontend` builds W3/T3.3 against.
 *
 * ⚠ These run on the COOKIE client and call the `auth.uid()` doors
 * (`affiliate_person` / `end_affiliation`), NOT the `_for` twins. That is deliberate:
 * the `_for` twins take an explicit actor and are granted to `service_role` ONLY,
 * because a caller who can name the actor can name anyone. The service twins exist for
 * exactly one reason — `registerUser` provisions accounts with no `auth.uid()` — and
 * they are used only there (`src/lib/users/actions.ts`).
 *
 * ⚠ NO AUTHORIZATION LIVES HERE. Every refusal — authority, tenant anchor, the
 * any-tier seat block — is inside `app.affiliate_person_impl` /
 * `app.end_affiliation_impl`, re-derived in PostgreSQL for a named actor. This layer
 * only translates SQLSTATEs into pt-BR (CLAUDE.md §8: raw Postgres errors never reach
 * the UI).
 */

export interface AffiliationActionState {
  ok: boolean
  error?: string
  /**
   * Present only on HC0R1: the active seats that block ending the affiliation, so the
   * UI can name them instead of saying "it did not work". Roles + commission (null for
   * a hospital-tier seat).
   */
  blockers?: { role: string; commission: string | null }[]
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  foreignOrg: 'Esta pessoa não pertence a esta organização.',
  notFound: 'Vínculo ativo não encontrado.',
  badDate: 'A data de encerramento é anterior ao início do vínculo.',
  stillSeated:
    'Não é possível encerrar o vínculo: a pessoa ainda ocupa funções ativas neste hospital.',
  affiliated: 'Vínculo hospitalar registrado.',
  ended: 'Vínculo hospitalar encerrado.',
} as const

/** `hospital_affiliations` feeds the roster and the user directory alike. */
function revalidateAffiliationSurfaces(): void {
  revalidatePath('/o/[org]/manage/usuarios', 'page')
  revalidatePath('/o/[org]/manage/hospitais', 'page')
}

interface PgErrorish {
  code?: string
  details?: string | null
}

function parseBlockers(details: string | null | undefined) {
  if (!details) return undefined
  try {
    const parsed: unknown = JSON.parse(details)
    if (!Array.isArray(parsed)) return undefined
    return parsed.map((b) => {
      const row = b as { role?: unknown; commission?: unknown }
      return {
        role: typeof row.role === 'string' ? row.role : '',
        commission: typeof row.commission === 'string' ? row.commission : null,
      }
    })
  } catch {
    // A malformed DETAIL must never break the action — the refusal still stands.
    return undefined
  }
}

function toState(error: PgErrorish): AffiliationActionState {
  switch (error.code) {
    case '42501':
      return { ok: false, error: MESSAGES.forbidden }
    case 'HC0R0':
      return { ok: false, error: MESSAGES.foreignOrg }
    case 'HC0R1':
      return {
        ok: false,
        error: MESSAGES.stillSeated,
        blockers: parseBlockers(error.details),
      }
    case 'HC0R2':
      return { ok: false, error: MESSAGES.notFound }
    case 'HC0R3':
      return { ok: false, error: MESSAGES.badDate }
    default:
      return { ok: false, error: MESSAGES.generic }
  }
}

/**
 * Affiliate a person to a hospital (create the employment row, or refresh the matrícula
 * of the existing active one — the door is idempotent by (person, hospital)).
 *
 * Self-affiliation is ALLOWED by design: affiliation confers no capability, and an
 * administrator absent from their own hospital's roster is a bug.
 */
export async function affiliatePerson(input: {
  userId: string
  hospitalId: string
  employeeId?: string | null
  startedOn?: string | null
}): Promise<AffiliationActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('affiliate_person', {
    p_user: input.userId,
    p_hospital: input.hospitalId,
    // The generated Args mark defaulted params `?: string`, so an explicit `null`
    // is a type error — omitting the key is how you take the SQL default.
    p_employee_id: input.employeeId?.trim() || undefined,
    p_started_on: input.startedOn ?? undefined,
  })

  if (error) return toState(error)

  revalidateAffiliationSurfaces()
  return { ok: true, error: MESSAGES.affiliated }
}

/**
 * End a person's affiliation with a hospital — a SOFT end (`ended_on`), never a delete
 * (D4; `guard_affiliation_no_delete` enforces that in the database).
 *
 * REFUSES while the person holds active seats of ANY tier under that hospital (D5),
 * returning them in {@link AffiliationActionState.blockers}. A governance platform must
 * not revoke or orphan seats as a side effect of an HR action.
 */
export async function endAffiliation(input: {
  userId: string
  hospitalId: string
  endedOn?: string | null
}): Promise<AffiliationActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('end_affiliation', {
    p_user: input.userId,
    p_hospital: input.hospitalId,
    p_ended_on: input.endedOn ?? undefined,
  })

  if (error) return toState(error)

  revalidateAffiliationSurfaces()
  return { ok: true, error: MESSAGES.ended }
}

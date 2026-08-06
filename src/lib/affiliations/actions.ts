'use server'

import { revalidatePath } from 'next/cache'

import { listOrgPeople, type OrgPerson } from '@/lib/queries/affiliations'
import { createClient } from '@/lib/supabase/server'
import { normalizeCpf } from '@/lib/users/cpf'

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
  badDate: 'A data informada é incompatível com o período do vínculo.',
  deactivated:
    'Esta conta está desativada. Reative a conta antes de registrar um vínculo hospitalar.',
  stillSeated:
    'Não é possível encerrar o vínculo: a pessoa ainda ocupa funções ativas neste hospital.',
  affiliated: 'Vínculo hospitalar registrado.',
  ended: 'Vínculo hospitalar encerrado.',
  updated: 'Vínculo hospitalar atualizado.',
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
    case 'HC0R4':
      return { ok: false, error: MESSAGES.deactivated }
    default:
      // ⚠ `default` is why an unmapped code is INVISIBLE: the switch is total, so no
      // compiler, linter or test can report one as unhandled — it just silently
      // degrades into "try again", which is a retry instruction for conditions
      // retrying cannot fix. `door-error-arms.test.ts` enumerates the SQLSTATEs the
      // doors actually raise and fails when one has no arm here.
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
 * Edit an EXISTING active employment: matrícula and/or start date (ADR 0097 D14).
 *
 * ⚠ Deliberately NOT `affiliatePerson`. That door is the idempotent CREATE path and it
 * IGNORES `startedOn` for a row that already exists — a control wired to it would
 * silently no-op on every existing affiliation. This calls `update_affiliation`, which
 * emits `affiliation.updated`; routing a date change through the create door would have
 * mutated a row with no audit arm to record it (Rule 11).
 *
 * Omit a field to leave it alone. Clearing the matrícula is an EXPLICIT
 * `clearEmployeeId`, because "null means leave it" and "null means clear it" cannot
 * both be true of the same argument.
 */
export async function updateAffiliation(input: {
  userId: string
  hospitalId: string
  employeeId?: string | null
  startedOn?: string | null
  clearEmployeeId?: boolean
}): Promise<AffiliationActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('update_affiliation', {
    p_user: input.userId,
    p_hospital: input.hospitalId,
    p_employee_id: input.employeeId?.trim() || undefined,
    p_started_on: input.startedOn ?? undefined,
    p_clear_employee_id: input.clearEmployeeId ?? false,
  })

  if (error) return toState(error)

  revalidateAffiliationSurfaces()
  return { ok: true, error: MESSAGES.updated }
}

/**
 * The identifier-first lookup (ADR 0097 D12), as a SERVER ACTION.
 *
 * ⚠ Why this exists beside the typed query it wraps: `@/lib/queries/affiliations` is
 * `server-only`, so a Client Component cannot import it, and **a CPF must never travel
 * as a URL parameter** — that is a hard privacy rule, so the register screen cannot
 * reach the directory through a route either. A `'use server'` action is the only path
 * that keeps the digits in a POST body.
 *
 * NO authorization is added here, deliberately: the DB door is the boundary, it is
 * gated on `auth.uid()`, and an unauthorized caller already receives `[]`. A TS check
 * layered on top would be a second, weaker copy of a rule that is already enforced
 * where it counts.
 *
 * ⚠ An empty array means "no match OR not allowed" — the door cannot be probed to tell
 * them apart, by design. Do not render it as a permission error.
 */
export async function lookupOrgPeople(input: {
  orgId: string
  cpf?: string | null
  search?: string | null
}): Promise<OrgPerson[]> {
  // Normalized HERE so a formatted CPF from the form matches storage. The door is
  // exact-match and full-length only: partial CPF matching is an enumeration oracle
  // over national IDs (D11) and is refused server-side, not merely unused.
  const cpf = input.cpf ? normalizeCpf(input.cpf) || null : null
  return listOrgPeople({ orgId: input.orgId, search: input.search ?? null, cpf })
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

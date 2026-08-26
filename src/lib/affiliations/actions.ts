'use server'

import { revalidatePath } from 'next/cache'

import { parseBlockers, type AffiliationBlocker } from '@/lib/affiliations/blockers'
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

/**
 * Re-exported on the path the render sites already import from
 * (`@/lib/affiliations/actions`), so consuming it costs no new import. A type re-export is
 * erased at build time and so does not violate the `'use server'` async-exports-only rule.
 */
export type { AffiliationBlocker }

export interface AffiliationActionState {
  ok: boolean
  error?: string
  /**
   * The blockers a refusal enumerated, so the UI can NAME them instead of saying "it did
   * not work" — present on HC0R1 / HC0R6 / HC0R9.
   *
   * ⛔ THE SHAPE IS THE DOOR'S. This was `{ role, commission }`, which silently discarded
   * the `kind` and `hospital` that HC0R6 emits — so a hospital-affiliation blocker, the
   * most common kind, reached the wizard with `role: ''` and no name and rendered as a
   * bare " — cargo do hospital". See {@link AffiliationBlocker} for the per-SQLSTATE
   * payloads, enumerated from the live catalog.
   */
  blockers?: AffiliationBlocker[]
}

/**
 * ADR 0151 D9 — per-employment staff data, carried on every affiliation write.
 *
 * Split from the id fields so `affiliatePerson` and `updateAffiliation` cannot drift
 * apart on what a "job" consists of.
 */
export interface StaffDataInput {
  jobTitle?: string | null
  workEmail?: string | null
  workPhone?: string | null
}

export interface AffiliatePersonInput extends StaffDataInput {
  userId: string
  hospitalId: string
  employeeId?: string | null
  startedOn?: string | null
}

export interface UpdateAffiliationInput extends StaffDataInput {
  userId: string
  hospitalId: string
  employeeId?: string | null
  startedOn?: string | null
  clearEmployeeId?: boolean
  /**
   * ⚠ "Leave alone" and "clear it" cannot both be `null` on the same argument — the
   * `clearEmployeeId` precedent, one flag per clearable field.
   */
  clearJobTitle?: boolean
  clearWorkEmail?: boolean
  clearWorkPhone?: boolean
}

/**
 * ADR 0151 D9 — the staff-data arguments, shared by both write doors.
 *
 * ⚠ `undefined`, NOT `null`. The generated `Args` mark defaulted parameters `?: string`,
 * so an explicit `null` is a type error — omitting the key is how a caller takes the SQL
 * default, which for these means "leave the stored value alone". Clearing is an explicit
 * `clear*` flag on {@link UpdateAffiliationInput}, never a null.
 *
 * A blank string collapses to `undefined` here and is normalised again in the door
 * (`nullif(btrim(...))`), because a whitespace-only box is not a fact and the not-blank
 * CHECKs would reject it as a raw 23514.
 */
function staffDataArgs(input: StaffDataInput) {
  return {
    p_job_title: input.jobTitle?.trim() || undefined,
    p_work_email: input.workEmail?.trim() || undefined,
    p_work_phone: input.workPhone?.trim() || undefined,
  }
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  foreignOrg: 'Esta pessoa não pertence a esta organização.',
  notFound: 'Vínculo ativo não encontrado.',
  badDate: 'A data informada é incompatível com o período do vínculo.',
  missingHospital: 'Hospital não encontrado.',
  deactivated:
    'Esta conta está desativada. Reative a conta antes de registrar um vínculo hospitalar.',
  stillSeated:
    'Não é possível encerrar o vínculo: a pessoa ainda ocupa funções ativas neste hospital.',
  affiliated: 'Vínculo hospitalar registrado.',
  ended: 'Vínculo hospitalar encerrado.',
  updated: 'Vínculo hospitalar atualizado.',
  // AFF4 (ADR 0151). One message per NEW SQLSTATE the AFF4 doors raise.
  orgStillLinked:
    'Não é possível desligar da organização: a pessoa ainda possui vínculos ativos.',
  voidReasonRequired: 'Informe o motivo da anulação.',
  alreadyVoided: 'Este vínculo já foi anulado.',
  voidHasSeats:
    'Este vínculo possui funções registradas e não pode ser anulado. Use o encerramento.',
  orgHasHospitalLinks:
    'A pessoa possui vínculos hospitalares registrados nesta organização.',
  orgEnded: 'Desligamento da organização registrado.',
  orgUpdated: 'Vínculo organizacional atualizado.',
  voided: 'Vínculo anulado.',
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
    case 'HC0R5':
      return { ok: false, error: MESSAGES.missingHospital }
    // ── AFF4 (ADR 0151). Arms exist BEFORE the doors that raise them, deliberately:
    // `toState`'s `default` swallows an unmapped code into "try again", so the arm must
    // never be the thing that is remembered later.
    case 'HC0R6':
      return {
        ok: false,
        error: MESSAGES.orgStillLinked,
        blockers: parseBlockers(error.details),
      }
    case 'HC0R7':
      return { ok: false, error: MESSAGES.voidReasonRequired }
    case 'HC0R8':
      return { ok: false, error: MESSAGES.alreadyVoided }
    case 'HC0R9':
      return {
        ok: false,
        error: MESSAGES.voidHasSeats,
        blockers: parseBlockers(error.details),
      }
    case 'HC0RA':
      // ⚠ The payload here is `[{hospital}]` — NO `role`, NO `commission`, NO `kind`. It was
      // discarded until AFF4 B2 found it: the door computes the blocking hospitals, and the
      // arm threw them away before `parseBlockers` was reached, so the user was told they
      // had hospital links and never told which. A sibling of the B2 defect, one arm over.
      return {
        ok: false,
        error: MESSAGES.orgHasHospitalLinks,
        blockers: parseBlockers(error.details),
      }
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
export async function affiliatePerson(
  input: AffiliatePersonInput,
): Promise<AffiliationActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('affiliate_person', {
    p_user: input.userId,
    p_hospital: input.hospitalId,
    // The generated Args mark defaulted params `?: string`, so an explicit `null`
    // is a type error — omitting the key is how you take the SQL default.
    p_employee_id: input.employeeId?.trim() || undefined,
    p_started_on: input.startedOn ?? undefined,
    ...staffDataArgs(input),
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
export async function updateAffiliation(
  input: UpdateAffiliationInput,
): Promise<AffiliationActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('update_affiliation', {
    p_user: input.userId,
    p_hospital: input.hospitalId,
    p_employee_id: input.employeeId?.trim() || undefined,
    p_started_on: input.startedOn ?? undefined,
    p_clear_employee_id: input.clearEmployeeId ?? false,
    ...staffDataArgs(input),
    // One flag per field: a shared one would make "clear the cargo" and "clear the work
    // phone" inseparable. Defaulted to false so an omitted flag never clears.
    p_clear_job_title: input.clearJobTitle ?? false,
    p_clear_work_email: input.clearWorkEmail ?? false,
    p_clear_work_phone: input.clearWorkPhone ?? false,
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
  return listOrgPeople({
    orgId: input.orgId,
    search: input.search ?? null,
    cpf,
    // ⭐ AFF4 B6b (ADR 0151 D5 / D10, as amended by ADR 0154) — THE SINGLE EXPLICIT
    // WIDENER, and the only place in the codebase that passes this. Every other roster
    // read takes the active-only default.
    //
    // An org-offboarded person MUST stay findable here or D5's one-step rehire is
    // impossible: a hospital admin cannot re-employ someone they cannot find, and the
    // org-tier door is org_admin-only, so failing to find them means waiting on a ticket
    // for someone the hospital is actively trying to hire back. The DIRECTORY defaults to
    // active-only behind a toggle; this ADD-A-PERSON SEARCH reaches ended people. The two
    // surfaces default differently on purpose — see `ListDirectoryOptions.includeEnded`.
    //
    // The result carries `orgAffiliationStatus`, so the UI can say "encerrado" rather than
    // offering an ended person as though nothing had happened.
    includeEnded: true,
  })
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

/* ══════════════════════════════════════════════════════════════════════════════════════
 * AFF4 (ADR 0151) — CONTRACT-FIRST STUBS.
 *
 * Signatures are FINAL and `frontend` builds F2–F6 against them. ⛔ THESE ARE NO LONGER
 * STUBS — all four are wired to their doors as of AFF4 B4 increment 3, so a caller reaches
 * the database rather than an exception. The banner is corrected here rather than left
 * behind: a comment claiming a live path throws is worse than no comment at all, because a
 * teammate who believes a working path is a stub will not test it.
 *
 * ⚠ NO AUTHORIZATION IS ADDED IN THIS LAYER, here as above. Authority, the D3 blocker
 * enumeration, the D8 never-employed precondition and the mandatory void reason all live
 * in the `app.*_impl` kernels, re-derived in PostgreSQL for a named actor. A TS check on
 * top would be a second, weaker copy of a rule enforced where it counts.
 * ══════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Desligar da organização (ADR 0151 D3) — the org tier of offboarding.
 *
 * REFUSES while the person holds, in that organization, any active hospital affiliation
 * or any active membership at any tier, returning them in
 * {@link AffiliationActionState.blockers}. There is NO CASCADE, by design: the wizard
 * composes the steps (D12) so that revoking someone's seats is always a decision a human
 * took, never a side effect of an HR action.
 *
 * An EXPIRED seat never blocks (D6) — "active" means `expires_at IS NULL OR > now()`.
 *
 * ⚠ Ending the last HOSPITAL affiliation never auto-ends this one. Org offboarding is
 * always a deliberate act.
 */
export async function endOrgAffiliation(input: {
  userId: string
  organizationId: string
  endedOn?: string | null
}): Promise<AffiliationActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('end_org_affiliation', {
    p_user: input.userId,
    p_organization: input.organizationId,
    p_ended_on: input.endedOn ?? undefined,
  })

  if (error) return toState(error)

  revalidateAffiliationSurfaces()
  return { ok: true, error: MESSAGES.orgEnded }
}

/**
 * Corrigir a data de início de um vínculo organizacional (ADR 0151 D2).
 *
 * Deliberately separate from {@link endOrgAffiliation} for the reason
 * {@link updateAffiliation} is separate from {@link affiliatePerson}: a door that
 * quietly acquires a date-mutation capability is how doors grow undeclared powers.
 */
export async function updateOrgAffiliation(input: {
  userId: string
  organizationId: string
  startedOn: string
}): Promise<AffiliationActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('update_org_affiliation', {
    p_user: input.userId,
    p_organization: input.organizationId,
    p_started_on: input.startedOn,
  })

  if (error) return toState(error)

  revalidateAffiliationSurfaces()
  return { ok: true, error: MESSAGES.orgUpdated }
}

/**
 * ANULAR a hospital affiliation (ADR 0151 D7) — the third tense, and the mechanism that
 * closes C5.
 *
 * ⛔ VOID IS NOT END, and the UI must not offer them as two spellings of one action.
 * `endAffiliation` says "this employment was true and stopped"; this says "this row was
 * never true" and revokes the read visibility it granted. Since ADR 0148 made person
 * reads EVER-HELD, ending a mis-entered affiliation does NOT withdraw the access it
 * handed out — only voiding does.
 *
 * The reason is MANDATORY (D8) and is written into the audit record, not merely the row.
 *
 * REFUSES if any membership was EVER scoped to that hospital or its commissions for this
 * principal — "ever", with no expiry filter: a record with seats is not consistent with
 * "never employed", and the honest verb there is `end`.
 *
 * An already-ENDED row is still voidable; an already-VOIDED row is refused rather than
 * re-voided, so the original reason and actor cannot be overwritten.
 */
export async function voidAffiliation(input: {
  affiliationId: string
  reason: string
}): Promise<AffiliationActionState> {
  const supabase = await createClient()
  // The reason is sent AS TYPED. Blank-normalisation and the mandatory-reason refusal
  // (HC0R7) both live in the door; a guard here would be a second, weaker copy of a rule
  // already enforced where it counts, and the two would diverge the moment one is edited.
  const { error } = await supabase.rpc('void_affiliation', {
    p_affiliation: input.affiliationId,
    p_reason: input.reason,
  })

  if (error) return toState(error)

  revalidateAffiliationSurfaces()
  return { ok: true, error: MESSAGES.voided }
}

/**
 * ANULAR an organization affiliation (ADR 0151 D7/D8) — the org-tier twin of
 * {@link voidAffiliation}. Authority is `org_admin` of that organization ONLY: there is
 * no hospital-admin arm at this tier, and no platform-admin arm at any tier (the noun
 * rule — a platform admin administers tenancy and identity, not employment).
 *
 * Additionally refuses when the principal has any non-voided hospital affiliation, or any
 * membership ever scoped, inside that organization.
 */
export async function voidOrgAffiliation(input: {
  orgAffiliationId: string
  reason: string
}): Promise<AffiliationActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('void_org_affiliation', {
    p_org_affiliation: input.orgAffiliationId,
    p_reason: input.reason,
  })

  if (error) return toState(error)

  revalidateAffiliationSurfaces()
  return { ok: true, error: MESSAGES.voided }
}

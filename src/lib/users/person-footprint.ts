import { getSessionContext } from '@/lib/queries/session'
import { createAdminClient } from '@/lib/supabase/admin'

import { personScopeAllows, type PersonFootprint } from './person-scope'

/**
 * AFF2 B6 — the person-scope FOOTPRINT RESOLUTION and the authorized detail-page read.
 * ADR 0133 D1–D4 (+ Amendment 1 ruling 1), D9/D10/D12.
 *
 * ⛔ WHY THIS FILE EXISTS AT ALL, AND WHY IT MUST NEVER GAIN `'use server'`.
 * `src/lib/users/actions.ts` opens with `'use server'`, which makes EVERY export of that
 * file a callable server-action endpoint whose return value is serialized to the client.
 * The AFF2 plan says this helper "lives beside the actions", and building it literally
 * inside `actions.ts` would have meant one of two things:
 *   · exporting `resolvePersonFootprint` to share it — publishing a person's HOSPITAL
 *     FOOTPRINT as an endpoint, i.e. a brand-new door in a workstream whose gate record
 *     says "no new door"; or
 *   · exporting `getPersonAdminView` — publishing an oracle that answers "does
 *     hospital-admin X hold authority over person Y?" for an arbitrary `userId`.
 * Neither is needed: F2 is a Server Component and can import a plain function.
 *
 * ⚠ NO GATE WOULD HAVE CAUGHT THAT. `lint:client-server-imports` polices the opposite
 * direction (a client value-importing a server module), and the standing authz census
 * covers `pg_proc` / `pg_policies` — DATABASE doors. A Next server action is an
 * application-layer door in no arm's domain. So the rule here is structural, not
 * reviewed: this module has no directive, and anything that needs to stay unpublished
 * belongs in it rather than beside the actions.
 *
 * ⛔ ARCHITECTURE RULE 9 — A DISTINCT EXCEPTION, NOT A THIRD INSTANCE OF THE EXISTING ONE.
 * Rule 9 routes data access through `src/lib/queries/`, and sanctions exactly TWO modules
 * to read inline with the service-role client, bounded by the property *resolving
 * coordinates in order to sign document bytes*. **This is not that**, and must not be
 * filed under it or counted toward that list's exhaustive-by-intent limit of two.
 *
 * The reason here is different and narrower: **a column-locked field has no RLS path by
 * construction.** `profiles.date_of_birth`, `.phone` and `.cpf` are excluded from every
 * `authenticated` column-list grant (ADR 0133 D10), so a cookie-client query in
 * `src/lib/queries/` cannot read them at all — it fails with 42501. There is no
 * RLS-scoped implementation of this read to prefer; the authorization is the TS predicate
 * below (D4 declines a SQL twin deliberately), and the read must therefore be an
 * authorized SERVICE read or nothing. Putting it in `src/lib/queries/` would either fail
 * outright or push a service-role client into the shared query layer.
 */

/**
 * ADR 0133 D1(c) — the target's HOSPITAL FOOTPRINT.
 *
 * Footprint = active `hospital_affiliations` ∪ the hospitals of the target's
 * COMMISSION-tier memberships (via `commissions.hospital_id`). Both sources are required:
 * the org-wide member picker seats people on commissions of hospitals they hold no
 * affiliation with, so an affiliations-only footprint would make a multi-hospital person
 * look sole-footprint and hand their lifecycle to one hospital's admin (the ADR's
 * Alternatives table rejects that explicitly).
 *
 * ⚠ TIER IS DERIVED STRUCTURALLY, from `commission_id IS NULL`, matching
 * `memberships_scope_shape` — never from a role-name list. That vocabulary has been
 * widened four times (technical_director, technical_director_deputy, quality_reviewer,
 * pqs_member all postdate the original set) and a hardcoded list silently admits the next
 * one. A non-commission-tier row contributes NO hospital to the footprint and instead
 * raises the D2 flag, which denies every capability.
 *
 * ⛔ THIS IS THE ONLY FOOTPRINT DERIVATION IN THE CODEBASE. `actions.ts` imports it rather
 * than keeping a copy; a second derivation beside it is the "same predicate twice,
 * drifting" shape.
 *
 * Read on the service-role client so a foreign caller — who could not SELECT these rows —
 * still gets a correct answer rather than an empty one that reads as "no footprint".
 */
export async function resolvePersonFootprint(
  userId: string,
): Promise<PersonFootprint> {
  const admin = createAdminClient()

  const { data: affiliations } = await admin
    .from('hospital_affiliations')
    .select('hospital_id')
    .eq('principal_id', userId)
    .is('ended_on', null)
    .returns<{ hospital_id: string | null }[]>()

  const { data: memberships } = await admin
    .from('memberships')
    .select('commission_id, hospital_id, commissions:commission_id(hospital_id)')
    .eq('principal_id', userId)
    .returns<
      {
        commission_id: string | null
        hospital_id: string | null
        commissions: { hospital_id: string | null } | null
      }[]
    >()

  const hospitalIds: string[] = []
  for (const a of affiliations ?? []) {
    if (a.hospital_id) hospitalIds.push(a.hospital_id)
  }

  let hasNonCommissionTierMembership = false
  for (const m of memberships ?? []) {
    if (m.commission_id === null) {
      hasNonCommissionTierMembership = true
      continue
    }
    const hospitalId = m.commissions?.hospital_id
    if (hospitalId) hospitalIds.push(hospitalId)
  }

  return { hospitalIds, hasNonCommissionTierMembership }
}

/**
 * Is the caller an `org_admin` of `orgId`? Moved here from `actions.ts` for the same
 * reason as the resolver — B6 needs it, and re-implementing a five-line authority check
 * beside the live one is how two copies of an authorization rule start disagreeing.
 * (`authorizeHospitalOps` stayed in `actions.ts`: nothing here needs it, and moving code
 * nothing calls is churn.)
 *
 * Deliberately NOT platform_admin: ADR 0041 / the noun rule — commission content and
 * person records are not platform_admin's.
 */
export async function authorizeOrgOps(orgId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isInactive) return false
  return context.orgAdminOf.some((o) => o.organization.id === orgId)
}

/**
 * The two authority booleans F2 gates its affordances on — per CAPABILITY, not per person
 * (ADR 0133 D1–D3 + Amendment 1 ruling 1).
 */
export interface PersonAdminAuthority {
  /**
   * Capability `fields` — the INTERSECTION bound. Gates the "Dados pessoais" and
   * "Registros profissionais" edit affordances, and is also what admits the
   * {@link PersonAdminView.personalData} payload.
   */
  canEditPerson: boolean
  /**
   * Capability `lifecycle` — the SUBSET bound. Gates Desativar / Suspender / Reativar
   * **and** the CPF field inside the edit form.
   *
   * ⚠ UNRELATED to `caps.canManageLifecycle` in the CASES domain, which means coordinator
   * authority over a case and maps straight to the string `"coordinator"`
   * (`casos/[caseId]/page.tsx`). Same idea of "lifecycle", entirely different subject.
   * Named with "Account" — D3's own noun — precisely so the two never get confused by a
   * copy-paste between two security booleans.
   */
  canManageAccountLifecycle: boolean
}

/** The column-locked rail values (ADR 0133 D9/D10/D12). */
export interface PersonPersonalData {
  /** ISO `yyyy-mm-dd`, or `null` meaning NOT INFORMED. */
  dateOfBirth: string | null
  /** Digits-only, or `null` meaning NOT INFORMED. Formatting is display-side. */
  phone: string | null
  /**
   * ADR 0133 D12 — PRESENCE ONLY. No CPF digits cross this boundary, masked or otherwise;
   * the full value appears nowhere outside the person's own future `/conta` surface and
   * the edit form's blank write-only field.
   */
  cpfPresent: boolean
}

export interface PersonAdminView {
  /**
   * ⛔ `null` means WITHHELD — the caller lacks the `fields` capability — and NOT "nothing
   * informed". A `null` INSIDE the object means not informed.
   *
   * The distinction is carried by the TYPE rather than by convention because collapsing it
   * manufactures the exact state this codebase bans: F2 would render "Não informado" for a
   * person who HAS a birth date, and an empty cell would silently mean "no permission".
   * The page must branch on the outer null and render the scope-aware note instead.
   */
  personalData: PersonPersonalData | null
  authority: PersonAdminAuthority
}

/**
 * The authorized detail-page read behind the ADR 0133 D1/D4 authorizer (AFF2 B6).
 *
 * ⚠ ONE CALL, ONE FOOTPRINT RESOLUTION, BY DESIGN. Both capabilities are evaluated against
 * a single resolution. Two separate calls would resolve twice and could disagree across a
 * concurrent footprint change — ADR 0133 D4 accepts a TOCTOU residual bounded to ONE
 * write, and a second independent resolution would widen the accepted residual for free.
 *
 * Never raises for an unauthorized caller and never returns CPF digits.
 */
export async function getPersonAdminView(
  userId: string,
): Promise<PersonAdminView> {
  const denied: PersonAdminView = {
    personalData: null,
    authority: { canEditPerson: false, canManageAccountLifecycle: false },
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('home_organization_id, date_of_birth, phone, cpf')
    .eq('id', userId)
    .maybeSingle<{
      home_organization_id: string | null
      date_of_birth: string | null
      phone: string | null
      cpf: string | null
    }>()

  const orgId = profile?.home_organization_id ?? undefined
  if (!profile || !orgId) return denied

  let canEditPerson = false
  let canManageAccountLifecycle = false

  if (await authorizeOrgOps(orgId)) {
    // The org_admin arm is NOT footprint-bounded — it holds both capabilities outright.
    canEditPerson = true
    canManageAccountLifecycle = true
  } else {
    // The hospital_admin arm (D1(a)): the caller must hold hospital_admin in the TARGET'S
    // home org. A hospital administered in some other org is not a claim on this person.
    const context = await getSessionContext()
    if (context && !context.isInactive) {
      const administeredHospitalIds = context.hospitalAdminOf
        .filter((h) => h.organization.id === orgId)
        .map((h) => h.hospital.id)

      if (administeredHospitalIds.length > 0) {
        const footprint = await resolvePersonFootprint(userId)
        canEditPerson = personScopeAllows(
          'fields',
          footprint,
          administeredHospitalIds,
        )
        canManageAccountLifecycle = personScopeAllows(
          'lifecycle',
          footprint,
          administeredHospitalIds,
        )
      }
    }
  }

  return {
    // Gated on `fields`, the same capability that admits editing them. Withheld is the
    // OUTER null; see the type's doc comment for why that is not a stylistic choice.
    personalData: canEditPerson
      ? {
          dateOfBirth: profile.date_of_birth ?? null,
          phone: profile.phone ?? null,
          // D12: the boolean is computed HERE and the column is never returned. The digits
          // do not leave this function under any branch.
          cpfPresent: Boolean(profile.cpf),
        }
      : null,
    authority: { canEditPerson, canManageAccountLifecycle },
  }
}

import 'server-only'

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
    // AFF4 (ADR 0151 D7). A VOIDED row says the employment was never true, so it must not
    // contribute a hospital to a footprint that feeds WRITE authority. Omitting this is
    // AFF2 R1's exact shape one tense over: a row that no longer grants read access still
    // granting person-level write authority.
    .is('voided_at', null)
    .returns<{ hospital_id: string | null }[]>()

  const { data: memberships } = await admin
    .from('memberships')
    .select('commission_id, hospital_id, expires_at, commissions:commission_id(hospital_id)')
    .eq('principal_id', userId)
    .returns<
      {
        commission_id: string | null
        hospital_id: string | null
        expires_at: string | null
        commissions: { hospital_id: string | null } | null
      }[]
    >()

  const hospitalIds: string[] = []
  for (const a of affiliations ?? []) {
    if (a.hospital_id) hospitalIds.push(a.hospital_id)
  }

  const nowMs = Date.now()
  let hasNonCommissionTierMembership = false
  for (const m of memberships ?? []) {
    // ⛔ THE D2 TIER FLAG IGNORES EXPIRY, DELIBERATELY, AND THE ASYMMETRY BELOW IS THE
    // POINT (QA R1). Expiry is applied to what a membership GRANTS (a hospital in the
    // footprint) and NOT to what it WITHHOLDS (org_admin-only status). Reading an expired
    // org-tier seat as "no longer tiered" would WIDEN authority — a person who currently
    // reaches nobody would become manageable by a hospital_admin — and this resolver is the
    // sole authority on a path with no RLS backstop. Narrowing can be wrong and safe;
    // widening cannot. If an expired tier seat should stop locking a person to the
    // org_admin, that is a decision for the ADR, not a side effect of a bug fix.
    if (m.commission_id === null) {
      hasNonCommissionTierMembership = true
      continue
    }
    // ADR 0133 D1(c): the footprint is the hospitals of the target's ACTIVE commission-tier
    // memberships. The affiliations leg has always filtered (`ended_on is null`); this leg
    // did not, so an EXPIRED seat still granted a hospital_admin person-level WRITE
    // authority over someone with no remaining tie to their hospital. Found at QA (R1),
    // PO-ruled to filter.
    //
    // ⚠ FILTERED IN TS, NOT IN THE QUERY, and that is a testability choice rather than a
    // stylistic one: `.or('expires_at.is.null,expires_at.gt.…')` is a string PostgREST
    // evaluates, so no unit test could observe it — the same blind spot documented for the
    // directory's status predicates. Here the rule sits beside the tier derivation, which
    // is already TS-side, and `d14-person-level.test.ts` §4 exercises it for real through
    // the actions. Semantics match `app.has_role`: null expiry, or strictly in the future.
    const expiresAt = m.expires_at
    if (expiresAt !== null && new Date(expiresAt).getTime() <= nowMs) continue

    const hospitalId = m.commissions?.hospital_id
    if (hospitalId) hospitalIds.push(hospitalId)
  }

  return { hospitalIds, hasNonCommissionTierMembership }
}

/**
 * One active tie holding a person to the platform — the *reason* a footprint is not
 * empty, so the offboarding wizard can say what still holds them instead of silently
 * declining to offer the final step.
 */
export interface PlatformFootprintTie {
  kind: 'org_affiliation' | 'hospital_affiliation' | 'membership'
  organizationId: string | null
  hospitalId: string | null
  commissionId: string | null
  /** Seat role for a `membership` tie; null for the two affiliation kinds. */
  role: string | null
}

/**
 * "Does this person still hold anything, ANYWHERE on the platform?" (ADR 0151 D12.)
 */
export interface PlatformFootprint {
  /** True iff {@link ties} is empty. Precomputed so no caller re-derives the rule. */
  isEmpty: boolean
  ties: PlatformFootprintTie[]
}

/**
 * The D12 deactivation-offer signal: may the offboarding wizard OFFER account
 * deactivation as an optional final step?
 *
 * ⛔ THIS ANSWERS A DIFFERENT QUESTION FROM {@link resolvePersonFootprint}, and the two
 * must not be collapsed. That one answers "which hospitals bound person-level WRITE
 * authority over this person" (AFF2's INTERSECTION/SUBSET); this one answers "is this
 * person still tied to anything at all". They differ in ways that make substitution a
 * live bug, not a style choice:
 *   - `PersonFootprint.hospitalIds` is EMPTY for someone whose only seat is org-tier or
 *     hospital-tier — those rows raise `hasNonCommissionTierMembership` and contribute no
 *     hospital. Reading `hospitalIds.length === 0` as "nothing holds them" would offer to
 *     deactivate a sitting org admin.
 *   - That resolver deliberately IGNORES expiry when setting the tier flag (narrowing is
 *     safe, widening is not). Here expiry MUST apply per D6, or an expired seat blocks
 *     offboarding forever and the offer is never reached.
 *
 * ⚠ PLATFORM-WIDE, AND THAT IS THE WHOLE POINT. Read on the SERVICE-ROLE client, exactly
 * as {@link resolvePersonFootprint} is and for the same reason: an RLS-scoped read returns
 * the caller's slice, so a person with live ties in an organization the caller does not
 * administer would come back EMPTY — and the caller has no way to notice. Deactivation is
 * the platform-wide kill switch (ADR 0048 D4), so a false "empty" disables an account that
 * is still active somewhere invisible. ⛔ Never reimplement this over `getOrgUser`'s
 * `affiliations`/`committees`, which ARE RLS-scoped.
 *
 * ⚠ "Active" is D6, once: affiliations `ended_on IS NULL AND voided_at IS NULL`;
 * memberships `expires_at IS NULL OR expires_at > now()`. The voided exclusion is
 * load-bearing here — a voided row keeping a footprint non-empty means offboarding can
 * never reach the offer.
 *
 * ⚠ This module must NEVER gain `'use server'` (see the file header): that would turn the
 * footprint resolver into a client-callable authority oracle. Call it from a Server
 * Component and pass the result down as props, the way {@link getPersonAdminView} is used.
 *
 * ⚠ NOT AN AUTHORIZATION CHECK. An empty footprint means deactivation may be OFFERED, not
 * that this caller may perform it — D12 keeps the step optional and refusable, and the
 * lifecycle SUBSET bound still applies at the door.
 */
export async function resolvePlatformFootprint(
  userId: string,
): Promise<PlatformFootprint> {
  const admin = createAdminClient()

  const [orgAffiliations, hospAffiliations, memberships] = await Promise.all([
    admin
      .from('organization_affiliations')
      .select('organization_id')
      .eq('principal_id', userId)
      .is('ended_on', null)
      .is('voided_at', null)
      .returns<{ organization_id: string | null }[]>(),
    admin
      .from('hospital_affiliations')
      .select('organization_id, hospital_id')
      .eq('principal_id', userId)
      .is('ended_on', null)
      .is('voided_at', null)
      .returns<{ organization_id: string | null; hospital_id: string | null }[]>(),
    admin
      .from('memberships')
      .select('organization_id, hospital_id, commission_id, role, expires_at')
      .eq('principal_id', userId)
      .returns<
        {
          organization_id: string | null
          hospital_id: string | null
          commission_id: string | null
          role: string | null
          expires_at: string | null
        }[]
      >(),
  ])

  // ⛔ FAIL CLOSED. THIS IS THE WHOLE SAFETY ARGUMENT OF THIS FUNCTION, and it is the one
  // property that cannot be recovered downstream.
  //
  // Every read below feeds a single boolean, `isEmpty`, whose TRUE branch offers to
  // DEACTIVATE AN ACCOUNT — the platform-wide kill switch (ADR 0048 D4). A dropped error
  // makes `data` null; `?? []` would turn that into "no ties found"; and "no ties found"
  // is indistinguishable from "this person holds nothing". A transient PostgREST failure
  // would therefore offer to disable an account with a full live footprint, silently, with
  // nothing anywhere reporting a problem. An absent answer must never be reported as an
  // empty one.
  //
  // ⚠ THE ASYMMETRIC FAILURE IS THE DANGEROUS ONE, not the total failure. If ONE read
  // errors and the others succeed, the surviving ties look like the whole truth — which is
  // exactly the state that reads most like a correct answer. Hence all three are checked,
  // individually, before any of them is consumed.
  //
  // A throw is correct here rather than a degraded return: the action layer maps it to a
  // pt-BR message (CLAUDE.md §8) and the wizard step surfaces "could not determine", which
  // is the honest answer. ⛔ Do not reintroduce `?? []` on these reads, and do not "make it
  // resilient" by catching this throw at the call site — a caught error renders as an empty
  // footprint again, one layer up. Keystone: `person-footprint.test.ts`.
  for (const [label, result] of [
    ['organization_affiliations', orgAffiliations],
    ['hospital_affiliations', hospAffiliations],
    ['memberships', memberships],
  ] as const) {
    if (result.error) {
      throw new Error(
        `resolvePlatformFootprint: ${label} read failed (${result.error.message}) — refusing to report an undetermined footprint as empty`,
      )
    }
  }

  const ties: PlatformFootprintTie[] = []

  for (const a of orgAffiliations.data ?? []) {
    ties.push({
      kind: 'org_affiliation',
      organizationId: a.organization_id,
      hospitalId: null,
      commissionId: null,
      role: null,
    })
  }

  for (const a of hospAffiliations.data ?? []) {
    ties.push({
      kind: 'hospital_affiliation',
      organizationId: a.organization_id,
      hospitalId: a.hospital_id,
      commissionId: null,
      role: null,
    })
  }

  // ⚠ EVERY TIER COUNTS HERE, unlike `resolvePersonFootprint` above, which pushes a
  // hospital only for commission-tier rows. An org-tier seat holds a person to the
  // platform just as firmly as a commission seat does — treating it as "no footprint"
  // is what would offer to deactivate a sitting org admin.
  //
  // ⚠ Expiry filtered in TS rather than in the query, for the reason recorded on the
  // resolver above: `.or('expires_at.is.null,expires_at.gt.…')` is a string PostgREST
  // evaluates, so no unit test could observe it. Semantics match `app.has_role` and D6:
  // null expiry, or strictly in the future.
  const nowMs = Date.now()
  for (const m of memberships.data ?? []) {
    const expiresAt = m.expires_at
    if (expiresAt !== null && new Date(expiresAt).getTime() <= nowMs) continue
    ties.push({
      kind: 'membership',
      organizationId: m.organization_id,
      hospitalId: m.hospital_id,
      commissionId: m.commission_id,
      role: m.role,
    })
  }

  return { isEmpty: ties.length === 0, ties }
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

/**
 * Mask a stored CPF for display — ADR 0147 (amends ADR 0133 D12).
 *
 * `AAABBBCCCDD` → `AAA.•••.•CC-DD`: digits 1–3 visible, digits 4–7 hidden behind `•`,
 * digits 8–11 visible. Returns `null` for an absent value or anything that is not
 * exactly 11 digits after punctuation is stripped — a partial or malformed key is shown
 * as "not informed" rather than as a broken string, because a half-rendered identifier
 * invites the reader to believe it.
 *
 * ⛔ NEVER GIVEN THE RAW COLUMN BY A CALLER OUTSIDE THIS MODULE, and not exported for
 * that reason: the whole point of D12-as-amended is that the masking happens on the
 * server, beside the only authorized read of `profiles.cpf`, so the wire never carries
 * the four hidden digits. An exported masker would invite a call site that had to hold
 * the raw value first, which is precisely the boundary crossing the ADR forbids.
 *
 * Punctuation-tolerant on input because the CHECK constraint (`app.is_valid_cpf`,
 * `^[0-9]{11}$`) is an invariant declared in another file: stripping here is correct
 * under either answer, exactly as `updateUserProfile` normalises both sides of its
 * comparison rather than trusting the stored shape.
 */
function maskCpf(raw: string | null): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 11) return null
  const bullet = '•'
  return (
    digits.slice(0, 3) +
    '.' +
    bullet.repeat(3) +
    '.' +
    bullet +
    digits.slice(7, 9) +
    '-' +
    digits.slice(9, 11)
  )
}

/** The column-locked rail values (ADR 0133 D9/D10/D12, D12 amended by ADR 0147). */
export interface PersonPersonalData {
  /** ISO `yyyy-mm-dd`, or `null` meaning NOT INFORMED. */
  dateOfBirth: string | null
  /** Digits-only, or `null` meaning NOT INFORMED. Formatting is display-side. */
  phone: string | null
  /**
   * Whether a CPF is stored at all.
   *
   * ⚠ KEPT ALONGSIDE {@link cpfMasked}, not replaced by it — but NOT for the reason
   * this comment used to give. It claimed `cpfMasked` is `null` both when nothing is
   * stored AND when the stored value fails the 11-digit shape. ⛔ **The second half is
   * unreachable through the only producer**, and stating it as live sent one reviewer
   * looking for a render branch that cannot be entered (QA M11, refuted by measurement).
   * `profiles_cpf_valid` is a VALIDATED check constraint admitting only
   * `NULL OR app.is_valid_cpf(cpf)`, and that predicate rejects anything but
   * `^[0-9]{11}$` — so a stored CPF is always maskable and `cpfMasked === null` means
   * exactly "nothing stored". The malformed null path exists in `maskCpf` read in
   * isolation; it does not exist in the system.
   *
   * The field stays because ADR 0147 D4 requires presence as a fact in its own right, not
   * because display needs it to disambiguate. ⚠ **It has NO consumer today** — `grep -rn
   * cpfPresent src/` returns only this declaration, its producer below, and the tests that
   * pin it. An earlier version of this note claimed it was "what the edit form and any
   * completeness check consume"; that was false, and was written INTO the correction of a
   * finding about exactly this class. Say what it is FOR, never what reads it. ⚠ Its correctness therefore RESTS ON A DATABASE CONSTRAINT that
   * no lint, tsc or vitest run can see; the guards are pgTAP
   * `359_profiles_dob_phone.sql:249` and `301_hospital_affiliation_substrate.sql:228`,
   * which red if that CHECK is dropped or weakened.
   */
  cpfPresent: boolean
  /**
   * ADR 0147 (amends ADR 0133 D12) — the MASKED CPF, e.g. `412.•••.•84-20`, or `null`
   * when nothing is stored / the stored value is not 11 digits.
   *
   * ⛔ D12 ORIGINALLY SAID PRESENCE ONLY — "no digits, masked or otherwise". The PO
   * REVERSED that: administrators could not tell two same-named people apart, nor confirm
   * they were editing the right record, from a boolean. Do not "restore" the stricter
   * reading; it was decided against, not overlooked.
   *
   * ⛔ WHAT SURVIVES THE REVERSAL, and it is the load-bearing half: the RAW value still
   * never crosses this boundary. Masking happens server-side, inside
   * {@link getPersonAdminView}, so the four hidden digits are never serialized to the
   * client under any branch. Adding `cpf` to the returned object — or masking in the
   * renderer — re-opens exactly what the amendment preserved.
   */
  cpfMasked: string | null
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
 * Never raises for an unauthorized caller, and never returns the RAW CPF — the four
 * hidden digits stay server-side under every branch (ADR 0147, amending ADR 0133 D12).
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
          // D12 as amended by ADR 0147: BOTH derived values are computed HERE and the raw
          // column is never returned. The masked form carries digits 1-3 and 8-11 by
          // design; digits 4-7 do not leave this function under any branch.
          cpfPresent: Boolean(profile.cpf),
          cpfMasked: maskCpf(profile.cpf),
        }
      : null,
    authority: { canEditPerson, canManageAccountLifecycle },
  }
}

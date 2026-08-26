import 'server-only'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import { maskCpf } from '@/lib/users/cpf'
import type {
  OrgAffiliation,
  OwnPersonRecord,
  ProfessionalCredential,
  UserAffiliation,
} from '@/lib/users/types'

import { listAffiliationsFor } from './affiliations'

/**
 * "Meus dados" — the `/conta` self record (ADR 0151 D14), read through the self-only
 * DEFINER door `public.get_own_person_record`.
 *
 * ⚠ WHY A DOOR AND NOT A QUERY OVER `profiles`. Three columns are COLUMN-LOCKED even for
 * their owner: measured on the live catalog, `profiles.cpf`, `profiles.date_of_birth` and
 * `profiles.phone` carry NULL `attacl` and the table grants `authenticated` only `dxtm`
 * (no `r`). So `select cpf from profiles where id = auth.uid()` returns 42501 for the
 * person the row is about. The door is how someone reads their own record — not a
 * loophole around a restriction, but the only path the grants leave open. Pinned by
 * pgTAP 379 §6.3/§6.4, which assert the door returns it AND the direct select still
 * refuses, so §6.3 cannot be satisfied by a widened grant.
 *
 * ⚠ THE DOOR TAKES NO TARGET PARAMETER, and that is the whole security argument. It keys
 * on `auth.uid()`, so "self-only" is a property of its SHAPE rather than of a check a
 * later edit could weaken. For the same reason there is deliberately NO
 * `get_own_person_record_for` service twin — that function would be "fetch any person's
 * column-locked fields", the exact door this design exists to not build. pgTAP 379 §1.4
 * asserts its ABSENCE, because prose cannot defend one.
 *
 * ⚠ CPF MASKING HAPPENS HERE, and {@link OwnPersonRecord} carries no raw `cpf` field at
 * all. The door returns the digits — they are the caller's own, so masking is a
 * shoulder-surfing mitigation, not a confidentiality boundary against the subject — and
 * this layer applies ADR 0147's single `maskCpf`. Do not add a second mask in SQL, and do
 * not widen the return type: the ABSENCE of the raw field is what makes "we remembered to
 * mask" a type-level guarantee instead of a convention.
 *
 * ⚠ READ-ONLY BY DESIGN. Corrections are administrative (ADR 0133 Amdt 1 r5's Art. 18
 * posture). There is no self-edit counterpart and none should be added beside it.
 *
 * Reads here are UNAUDITED, stated rather than assumed (ADR 0151 D9): ordinary personal
 * data read by its own subject, not the Class-2 professional-identity register, not PHI.
 *
 * @returns the caller's own record, or `null` when there is no authenticated session.
 */
export async function getOwnPersonRecord(): Promise<OwnPersonRecord | null> {
  // The caller's own id comes from the SESSION, not from the door. The door deliberately
  // returns no `id`: it takes no subject and identifies one, so echoing the id back would
  // be the first step toward a signature that accepts one.
  const context = await getSessionContext()
  if (!context) return null
  const userId = context.userId

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_own_person_record')
  if (error) throw error

  // The door returns a set; a session that exists always yields exactly one row (pgTAP
  // 379 §6.1). An empty set here means the profile row is gone underneath a live session.
  const row = data?.[0]
  if (!row) return null

  // The three related lists come through the tables' OWN self legs, not through the door.
  // The door exists solely for the column-locked triple; widening it to carry these would
  // put a `to_jsonb`-shaped temptation in front of the next author for no benefit.
  const [credentialsResult, affiliationsMap, orgAffiliationsResult, categoryResult] =
    await Promise.all([
    supabase
      .from('professional_credentials')
      .select(
        'id, user_id, issuing_country, issuing_state, issuing_authority, registration_number, verified_at, expires_on, created_at, updated_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    listAffiliationsFor([userId]),
    supabase
      .from('organization_affiliations')
      .select(
        'id, organization_id, started_on, ended_on, voided_at, void_reason, organization:organizations(name)',
      )
      .eq('principal_id', userId)
      .order('started_on', { ascending: false }),
    // The category is public vocabulary, fetched whole rather than reconstructed from the
    // door's label: `OwnPersonRecord` carries the shared `ProfessionalCategory` type, and
    // half-populating a shared type is how a `key` or `issuingAuthority` silently reads as
    // absent on one screen and present on another.
    row?.professional_category_id
      ? supabase
          .from('professional_categories')
          .select('id, key, label_pt, issuing_authority, is_active')
          .eq('id', row.professional_category_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (credentialsResult.error) throw credentialsResult.error
  if (orgAffiliationsResult.error) throw orgAffiliationsResult.error

  const credentials: ProfessionalCredential[] = (credentialsResult.data ?? []).map((c) => ({
    id: c.id,
    userId: c.user_id,
    issuingCountry: c.issuing_country,
    issuingState: c.issuing_state,
    issuingAuthority: c.issuing_authority,
    registrationNumber: c.registration_number,
    verifiedAt: c.verified_at,
    expiresOn: c.expires_on,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }))

  const orgAffiliations: OrgAffiliation[] = (orgAffiliationsResult.data ?? []).map((o) => ({
    id: o.id,
    organizationId: o.organization_id,
    organizationName:
      (o.organization as { name: string } | null)?.name ?? null,
    startedOn: o.started_on,
    endedOn: o.ended_on,
    voidedAt: o.voided_at,
    voidReason: o.void_reason,
  }))

  // `HospitalAffiliation` extends `UserAffiliation` with the scope ids the UI has no use
  // for; the spread keeps them off the self record rather than publishing them.
  const affiliations: UserAffiliation[] = (affiliationsMap.get(userId) ?? []).map(
    (a) => ({
      id: a.id,
      hospitalId: a.hospitalId,
      hospitalName: a.hospitalName,
      hospitalEmployeeId: a.hospitalEmployeeId,
      startedOn: a.startedOn,
      endedOn: a.endedOn,
      voidedAt: a.voidedAt,
      voidReason: a.voidReason,
      jobTitle: a.jobTitle,
      workEmail: a.workEmail,
      workPhone: a.workPhone,
    }),
  )

  return {
    fullName: row.full_name,
    email: row.email,
    professionalCategory: categoryResult.data
      ? {
          id: categoryResult.data.id,
          key: categoryResult.data.key,
          labelPt: categoryResult.data.label_pt,
          issuingAuthority: categoryResult.data.issuing_authority,
          isActive: categoryResult.data.is_active,
        }
      : null,
    cpfMasked: maskCpf(row.cpf),
    dateOfBirth: row.date_of_birth,
    phone: row.phone,
    credentials,
    affiliations,
    orgAffiliations,
  }
}

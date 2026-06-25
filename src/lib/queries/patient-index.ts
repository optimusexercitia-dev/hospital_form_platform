/**
 * Patient Identity & Cross-Committee Linkage data-access (Phase 23 —
 * `patient_index`; Architecture Rule 9 — all reads go through `src/lib/queries/`;
 * Rule 11 — audited PHI access; Rule 12 — PHI/HIPAA handling; ADR 0039). Backs the
 * QPS-only cross-committee patient view (`/admin/nsp/pacientes`) and the referral
 * receiver-hint ("aparece em N outros registros").
 *
 * The domain TYPES are the FROZEN contract the frontend builds against; they live
 * in the CLIENT-SAFE `@/lib/patient-index/types` (ZERO imports) and are re-exported
 * here so existing `import … from '@/lib/queries/patient-index'` consumers resolve
 * unchanged WITHOUT a `"use client"` component dragging this server-only module
 * (→ `@/lib/supabase/server` → `next/headers`) into the client bundle.
 *
 * RLS / PHI (the security boundary — Rule 1 + Rule 12):
 *  - Direct SELECT on `patient_xref` is REVOKED from `authenticated`; the only read
 *    paths are the SECURITY DEFINER RPCs below. {@link searchPatient} /
 *    {@link getPatientAccessAudit} re-gate on `app.is_pqs_member(auth.uid())` and
 *    return NOTHING to a non-PQS caller (incl. a non-PQS platform admin — duty
 *    separation, ADR 0030/0031/0039).
 *  - {@link searchPatient} hashes the supplied MRN/encounter SERVER-SIDE (inside
 *    the DEFINER RPC, under the deployment pepper), matches the key-only
 *    `patient_xref`, and assembles a PHI-FREE trajectory. A successful match emits
 *    one `patient.searched` row on the GLOBAL audit chain with KEY-ONLY metadata
 *    (`patient_key` truncated, match count) — never the raw MRN/name (Rule 11). A
 *    ZERO-match search emits nothing.
 *  - {@link patientXrefCount} is the ONE exception that serves a non-QPS reader: it
 *    is gated on `app.can_read_referral_phi(...)` so the B-side of a referral can
 *    see "this patient appears in N other records" WITHOUT ever learning which
 *    records or the patient identity — a COUNT only.
 *  - This module NEVER returns a patient identifier. Drilling into a record's MRN
 *    still funnels through that module's existing audited door
 *    (`getCasePatient` / `getEventPatient` / `getReferralPatient` → `*_patient.read`).
 *
 * The function signatures are the frozen contract `frontend` compiles against; keep
 * them stable (a shape change goes through the lead so `frontend` adapts). The
 * `.rpc(...)` calls depend on the RPCs landed by migration
 * `20260620019000_patient_index.sql` + regenerated types (Rule 8).
 */

import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type {
  PatientAccessAuditRow,
  PatientSearchResult,
  PatientXrefModule,
  TrajectoryEntry,
} from '@/lib/patient-index/types'

// Re-export the CLIENT-SAFE domain types + label maps so server callers and
// `"use client"` components share one import surface (the referrals pattern).
export type {
  PatientXrefModule,
  PatientMatchBasis,
  TrajectoryEntry,
  PatientSearchResult,
  PatientAccessAuditRow,
  PatientSearchInput,
  PatientSearchState,
} from '@/lib/patient-index/types'
export {
  PATIENT_XREF_MODULE_LABELS,
  PATIENT_XREF_MODULE_TOKENS,
  PATIENT_MATCH_BASIS_LABELS,
} from '@/lib/patient-index/types'

// ---------------------------------------------------------------------------
// RPC row shapes (snake_case from the DEFINER doors) + mappers -> domain types.
// ---------------------------------------------------------------------------

/** The jsonb `search_patient_xref` / `get_patient_trajectory_for_entity` return. */
interface PatientSearchJson {
  matchedOn: string | null
  matchCount: number
  entries: {
    module: string
    entityId: string
    entityCode: string
    commissionId: string | null
    commissionName: string | null
    matchedOn: string | null
    disposed: boolean
    disposedAt: string | null
    createdAt: string
  }[]
}

/** Map the PHI-free search jsonb -> {@link PatientSearchResult}. The DB already
 * shapes camelCase keys (jsonb_build_object), so this is a typed narrowing of the
 * union values + a defensive default for the empty bundle. */
function mapSearchResult(j: PatientSearchJson): PatientSearchResult {
  return {
    matchedOn: (j.matchedOn ?? 'patient') as PatientSearchResult['matchedOn'],
    matchCount: j.matchCount ?? 0,
    entries: (j.entries ?? []).map((e) => ({
      module: e.module as PatientXrefModule,
      entityId: e.entityId,
      entityCode: e.entityCode,
      commissionId: e.commissionId ?? '',
      commissionName: e.commissionName,
      matchedOn: (e.matchedOn ?? 'patient') as TrajectoryEntry['matchedOn'],
      disposed: e.disposed,
      disposedAt: e.disposedAt,
      createdAt: e.createdAt,
    })),
  }
}

/** One row of the `patient_access_audit` jsonb array. */
interface PatientAccessAuditJson {
  id: string
  occurredAt: string
  actorId: string | null
  actorName: string | null
  action: string
  entityType: string
  entityId: string | null
  commissionId: string | null
  commissionName: string | null
}

/** Map one access-audit jsonb row -> {@link PatientAccessAuditRow}. */
function mapAccessAuditRow(r: PatientAccessAuditJson): PatientAccessAuditRow {
  return {
    id: r.id,
    occurredAt: r.occurredAt,
    actorId: r.actorId,
    actorName: r.actorName,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    commissionId: r.commissionId,
    commissionName: r.commissionName,
  }
}

// ---------------------------------------------------------------------------
// Feature-flag probe
// ---------------------------------------------------------------------------

/**
 * Whether the `patient_index` feature flag is ON (probes the
 * `public.patient_index_enabled()` DEFINER RPC, mirroring `casePatientEnabled`).
 * Gates the QPS page + the referral hint; `false` on any error (fail-closed).
 */
export async function patientIndexEnabled(): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('patient_index_enabled')
  if (error) return false
  return data === true
}

// ---------------------------------------------------------------------------
// QPS cross-committee search (PQS-gated; PHI-FREE result; audited on match)
// ---------------------------------------------------------------------------

// ===========================================================================
// NSP-per-org (sub-phase A; ADR 0042) — the FOURTH PHI surface goes ORG-SCOPED.
//
// `patient_xref` aggregates across ALL commissions with NO org filter today — safe
// only because the global PQS roster is inert. Once per-org membership is real it
// would leak org-B patients to an org-A NSP member. So the QPS reads become
// ORG-SCOPED: the caller passes the `orgId` whose console it is (the UI always knows
// it); the DEFINER RPCs gate on enrollment in THAT org and filter the trajectory +
// audit to that org's xref rows.
//
// HERMETIC sub-phase A (lead ruling): the per-org variants ship under NEW names
// (`searchPatientForOrg` / `getPatientAccessAuditForOrg`) so NO existing exported
// signature a `src/components/**` caller already uses is changed — A5's whole-tree
// typecheck stays green with ZERO frontend edits. The OLD names remain as DEPRECATED
// throwing stubs; sub-phase B swaps `patient-search-view.tsx` to the new names + the
// per-org route's `orgId`, then deletes the stubs. `getPatientTrajectoryForEntity` /
// `patientXrefCount` resolve the entity's org SERVER-SIDE → their arity is UNCHANGED.
// ===========================================================================

/**
 * @deprecated NSP-per-org: the global (org-blind) search is removed; use
 * {@link searchPatientForOrg}. Kept only so the existing single-org call site
 * (`patient-search-view.tsx`) keeps compiling until sub-phase B re-homes the page to
 * `/o/[org]/nsp/pacientes` and supplies `orgId`.
 */
// TODO(nsp-per-org B): remove when the per-org route supplies orgId
export async function searchPatient(
  _input: { mrn: string | null; encounter: string | null },
): Promise<PatientSearchResult | null> {
  void _input
  throw new Error(
    'searchPatient is org-blind and removed under NSP-per-org; use searchPatientForOrg(orgId, …)',
  )
}

/**
 * Search `orgId`'s cross-committee patient index by MRN and/or encounter, returning
 * the patient's PHI-FREE trajectory across that org's committees. Routes through the
 * `search_patient_xref(p_mrn, p_encounter, p_org_id)` SECURITY DEFINER RPC, which
 * hashes the inputs under the deployment pepper, matches the key-only `patient_xref`
 * **restricted to `orgId`**, assembles the trajectory, and (on matches ≥ 1) emits one
 * `patient.searched` audit row on the ORG chain with key-only metadata. Gated on
 * enrollment in `orgId`'s roster: a non-member (incl. a member of a DIFFERENT org
 * passing this `orgId`) gets `null`; a zero-match search returns a result with empty
 * {@link PatientSearchResult.entries} and emits no audit row.
 *
 * @param orgId      the organization whose QPS console this is (enrollment gate +
 *                   trajectory scope; the UI always knows it from the route).
 * @param mrn        prontuário to match (exact, after conservative normalization).
 * @param encounter  atendimento to match (exact). At least one of the two must be
 *                   non-blank, else the function returns `null` (the action also
 *                   validates this for a friendly field error).
 */
export async function searchPatientForOrg(
  orgId: string,
  mrn: string | null,
  encounter: string | null,
): Promise<PatientSearchResult | null> {
  void orgId
  void mrn
  void encounter
  throw new Error('not implemented: searchPatientForOrg (NSP-per-org A3/A5)')
}

/**
 * The cross-committee trajectory reached by DEEP-LINKING from one known entity (a
 * QPS user clicks a record on the access-audit table / a module detail page). The
 * entity's `patient_key` is resolved SERVER-SIDE from `patient_xref` (PQS-gated),
 * then the SAME {@link PatientSearchResult} bundle is assembled as
 * {@link searchPatient} — but this emits **`patient.viewed`** (the trajectory was
 * opened, not searched), global chain, key-only metadata. Routes through the
 * `get_patient_trajectory_for_entity` SECURITY DEFINER RPC.
 *
 * Returns `null` for a non-PQS caller, an unknown/keyless entity (name-only PHI →
 * not in the index), or any error. The caller never supplies or learns a key.
 *
 * ORG-SCOPED (NSP-per-org): the entity's org is resolved SERVER-SIDE (its
 * commission → org), the caller is gated on enrollment in THAT org, and the
 * assembled trajectory is filtered to that org — so its arity is UNCHANGED (no
 * `orgId` param: the pivot entity already pins the org). A caller not enrolled in
 * the entity's org gets `null`.
 *
 * @param module    the entity's PHI module (`'event' | 'referral' | 'case'`).
 * @param entityId  the module-native entity id to pivot from.
 */
export async function getPatientTrajectoryForEntity(
  module: PatientXrefModule,
  entityId: string,
): Promise<PatientSearchResult | null> {
  if (!entityId) return null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_patient_trajectory_for_entity', {
    p_module: module,
    p_entity_id: entityId,
  })
  if (error || !data) return null
  return mapSearchResult(data as unknown as PatientSearchJson)
}

// ---------------------------------------------------------------------------
// Patient-scoped access audit (PQS-gated; PHI-FREE; not re-audited)
// ---------------------------------------------------------------------------

/**
 * The patient-scoped ACCESS AUDIT — every `audit_log` row (read/mutation/disposal)
 * touching any entity that shares this patient's `patient_key`, newest-first.
 * Routes through the `patient_access_audit` SECURITY DEFINER RPC, which is
 * PQS-gated and bypasses per-commission audit RLS BY DESIGN (a QPS-only
 * cross-committee view), selecting NON-PHI columns only. Reading the audit is NOT
 * itself re-audited. Returns `[]` for a non-PQS caller or no match.
 *
 * The patient is identified the same way as {@link searchPatientForOrg} (by MRN
 * and/or encounter, hashed server-side); the RPC resolves the `patient_key`
 * internally so no key is ever shaped on the client.
 *
 * @deprecated NSP-per-org: org-blind; use {@link getPatientAccessAuditForOrg}. Kept
 * only so the existing single-org call site keeps compiling until sub-phase B.
 */
// TODO(nsp-per-org B): remove when the per-org route supplies orgId
export async function getPatientAccessAudit(
  _input: { mrn: string | null; encounter: string | null },
): Promise<PatientAccessAuditRow[]> {
  void _input
  throw new Error(
    'getPatientAccessAudit is org-blind and removed under NSP-per-org; use getPatientAccessAuditForOrg(orgId, …)',
  )
}

/**
 * The patient-scoped ACCESS AUDIT for `orgId` — every `audit_log` row touching any
 * entity in `orgId` that shares this patient's `patient_key`, newest-first. Routes
 * through the `patient_access_audit(p_mrn, p_encounter, p_org_id)` SECURITY DEFINER
 * RPC, gated on enrollment in `orgId`'s roster, restricting the entity subquery to
 * that org's xref rows AND `audit_log.organization_id = orgId`. PHI-free; reading the
 * audit is not itself re-audited. A non-member (incl. another org's member passing
 * this `orgId`) gets `[]`.
 *
 * @param orgId      the organization whose QPS console this is.
 */
export async function getPatientAccessAuditForOrg(
  orgId: string,
  mrn: string | null,
  encounter: string | null,
): Promise<PatientAccessAuditRow[]> {
  void orgId
  void mrn
  void encounter
  throw new Error('not implemented: getPatientAccessAuditForOrg (NSP-per-org A3/A5)')
}

// ---------------------------------------------------------------------------
// Referral receiver hint (NON-QPS door — count only, can_read_referral_phi)
// ---------------------------------------------------------------------------

/**
 * The count of OTHER non-disposed `patient_xref` rows that share this entity's
 * `patient_key` (excluding the entity itself) — i.e. "this patient appears in N
 * other records across the hospital". Routes through the `patient_xref_count`
 * SECURITY DEFINER RPC, gated on `app.can_read_referral_phi(...)`, so a referral's
 * B-side coordinator/analyst gets the COUNT without QPS membership and WITHOUT ever
 * learning which records or the patient identity. Returns `0` when out of scope,
 * when the entity has no `patient_key` (name-only PHI), or on any error.
 *
 * v1 callers pass `module: 'referral'` (the only consumer is the B-side referral
 * detail hint); the `module` param keeps the door reusable for future hints
 * without a signature change.
 *
 * @param module    the entity's PHI module (`'referral'` for the current hint).
 * @param entityId  the module-native entity id (the referral id for the hint).
 */
export async function patientXrefCount(
  module: PatientXrefModule,
  entityId: string,
): Promise<number> {
  if (!entityId) return 0
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('patient_xref_count', {
    p_module: module,
    p_entity_id: entityId,
  })
  if (error || typeof data !== 'number') return 0
  return data
}

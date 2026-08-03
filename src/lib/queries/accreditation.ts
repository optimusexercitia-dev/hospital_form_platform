/**
 * Standards Crosswalk & Readiness/Gap Engine v2 (Phase 16) data-access
 * (Architecture Rule 9 — all reads go through `src/lib/queries/`). Backs the
 * standards tree, the evidence picker, the standard panel (assessment +
 * evidence list), the commission readiness dashboard, and the hospital-wide
 * consolidated readiness surface.
 *
 * ============================ CONTRACT-FIRST STUB (Wave 0) ============================
 * Typed SIGNATURES + domain types are the frozen contract `frontend` builds
 * against starting Wave 2. Bodies `throw new Error('not implemented')` until
 * Wave 1 (schema + belongs/freshness) and Wave 2 (RPCs/doors) land. The
 * exported shapes/types are the stable contract — do NOT change them without
 * telling the lead so the frontend can adapt.
 * ==========================================================================
 *
 * The domain TYPES are the FROZEN contract; they live in the import-free,
 * client-safe `@/lib/accreditation/types` (re-exported here for convenience,
 * mirroring the `queries/indicators.ts` re-export pattern).
 *
 * RLS / capability posture (the security boundary — Rule 1; ADR 0093):
 *  - `accreditation_frameworks` / `accreditation_standards`: SELECT = owner
 *    IS NULL (global pack, readable by all authenticated) OR
 *    `app.is_member_of(owner)` (commission-owned clone — Amendment 1 A1·2,
 *    narrowing D10's letter so pasted licensed text never leaks cross-tenant).
 *  - `evidence_links` / `standard_assessments`: member-READ (RLS SELECT) /
 *    staff_admin DEFINER-RPC-only WRITE — no direct write grant.
 *  - `standard_ownerships`: SELECT = members of the hospital's commissions +
 *    hospital_admin; WRITE = `is_hospital_admin_of` only (D7).
 *  - The three read doors (`readiness_report`, `readiness_evidence`,
 *    `hospital_readiness`) are DEFINER, structurally mirroring
 *    `hospital_document_register` but WITHOUT its `is_admin()` arm (D6, the
 *    noun rule) — platform_admin gets ZERO rows from all of them, proven by
 *    construction (the BUG-AUTHZ-001 shape).
 *  - `evidence_candidates` is a staff_admin DEFINER search feeding the
 *    picker; per-kind SELECTs already apply `can_read_case` /
 *    `can_read_capa` so restricted artifacts never appear as candidates.
 *
 * PHI-FREE (Rule 12 N/A) — the module never stores or surfaces PHI payloads;
 * restricted case/ethics_procedure evidence is masked (D8), never disclosed.
 */

import { createClient } from '@/lib/supabase/server'
import type {
  AccreditationFramework,
  AccreditationStandard,
  ArtifactKind,
  EvidenceCandidate,
  EvidenceItem,
  HospitalReadinessRow,
  ReadinessRow,
  StandardTreeNode,
} from '@/lib/accreditation/types'

// Re-export the client-safe contract so consumers can import types/labels from
// the query module too (mirrors queries/indicators.ts).
export type {
  AccreditationFramework,
  AccreditationStandard,
  ArtifactKind,
  AssessmentStatus,
  EvidenceCandidate,
  EvidenceItem,
  EvidenceStatus,
  FrameworkStatus,
  HospitalReadinessResolution,
  HospitalReadinessRow,
  ReadinessRow,
  StandardLevel,
  StandardTreeNode,
} from '@/lib/accreditation/types'
export {
  ARTIFACT_KIND_LABELS,
  ASSESSMENT_STATUS_LABELS,
  EVIDENCE_STATUS_LABELS,
  FRAMEWORK_STATUS_LABELS,
  HOSPITAL_READINESS_RESOLUTION_LABELS,
  STANDARD_LEVEL_LABELS,
} from '@/lib/accreditation/types'

// ---------------------------------------------------------------------------
// Framework / standard tree
// ---------------------------------------------------------------------------

/**
 * Every framework the caller may see: global packs (`ownerCommissionId:
 * null`) plus any custom framework owned by `commissionId` (Amendment 1
 * A1·2). `[]` when the `accreditation` flag is off or the caller is out of
 * scope.
 */
export async function listFrameworks(commissionId: string): Promise<AccreditationFramework[]> {
  void (await createClient())
  void commissionId
  throw new Error('not implemented')
}

/**
 * A framework's full standard hierarchy, nested for the progressive-
 * disclosure tree (`StandardTreeNode.children`). `null` when the framework
 * does not exist or is out of the caller's read scope.
 */
export async function getStandardTree(frameworkId: string): Promise<StandardTreeNode[]> {
  void (await createClient())
  void frameworkId
  throw new Error('not implemented')
}

/** The flat standard rows of a framework (no hierarchy nesting). */
export async function listStandards(frameworkId: string): Promise<AccreditationStandard[]> {
  void (await createClient())
  void frameworkId
  throw new Error('not implemented')
}

// ---------------------------------------------------------------------------
// Readiness report (commission-scoped)
// ---------------------------------------------------------------------------

/**
 * The commission's per-standard readiness against one framework — the input
 * to `computeReadinessRollups()` (frontend `@/lib/accreditation/rollups`).
 * Backed by the `readiness_report` DEFINER RPC (gate `is_member_of`); `[]`
 * when out of scope or the flag is off.
 */
export async function getReadinessReport(
  commissionId: string,
  frameworkId: string,
): Promise<ReadinessRow[]> {
  void (await createClient())
  void commissionId
  void frameworkId
  throw new Error('not implemented')
}

/**
 * The evidence links backing one standard, for the standard panel's evidence
 * list. Restricted links (case/ethics_procedure the caller cannot read) come
 * back masked per D8. Backed by the `readiness_evidence` DEFINER RPC; `[]`
 * when out of scope.
 */
export async function getReadinessEvidence(
  commissionId: string,
  standardId: string,
): Promise<EvidenceItem[]> {
  void (await createClient())
  void commissionId
  void standardId
  throw new Error('not implemented')
}

/**
 * Candidate artifacts of one kind for the evidence picker, filtered by a
 * search query. Backed by the `evidence_candidates` DEFINER RPC
 * (staff_admin-only); `[]` when out of scope, the flag is off, or no
 * candidates match.
 */
export async function getEvidenceCandidates(
  commissionId: string,
  kind: ArtifactKind,
  query: string,
): Promise<EvidenceCandidate[]> {
  void (await createClient())
  void commissionId
  void kind
  void query
  throw new Error('not implemented')
}

// ---------------------------------------------------------------------------
// Hospital-wide consolidated readiness
// ---------------------------------------------------------------------------

/**
 * The PHI-FREE, counts-only consolidated readiness for one hospital against
 * one framework — worst-status-wins across commissions, or the designated
 * `standard_ownerships` commission's answer when set (D7). Backed by the
 * `hospital_readiness` DEFINER RPC, gated `is_hospital_admin_of OR
 * is_org_admin_of(org_of_hospital)` ONLY — platform_admin gets `[]` (D6, the
 * noun rule; the BUG-AUTHZ-001 shape tested by construction).
 */
export async function getHospitalReadiness(
  hospitalId: string,
  frameworkId: string,
): Promise<HospitalReadinessRow[]> {
  void (await createClient())
  void hospitalId
  void frameworkId
  throw new Error('not implemented')
}

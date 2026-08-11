/**
 * Standards Crosswalk & Readiness/Gap Engine v2 (Phase 16) data-access
 * (Architecture Rule 9 — all reads go through `src/lib/queries/`). Backs the
 * standards tree, the evidence picker, the standard panel (assessment +
 * evidence list), the commission readiness dashboard, and the hospital-wide
 * consolidated readiness surface.
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
 *    `listFrameworks`/`listGlobalFrameworks`/`listStandards`/`getStandardTree`
 *    read these tables DIRECTLY (no RPC needed — RLS is the whole gate).
 *  - `evidence_links` / `standard_assessments`: member-READ (RLS SELECT) /
 *    staff_admin DEFINER-RPC-only WRITE — no direct write grant.
 *  - `standard_ownerships`: SELECT = members of the hospital's commissions +
 *    hospital_admin; WRITE = `is_hospital_admin_of` only (D7).
 *  - The three read doors (`readiness_report`, `readiness_evidence`,
 *    `hospital_readiness`) are DEFINER, structurally mirroring
 *    `hospital_document_register` but WITHOUT its `is_admin()` arm (D6, the
 *    noun rule) — platform_admin gets ZERO rows from all of them, proven by
 *    construction (the BUG-AUTHZ-001 shape, pgTAP 283/284).
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
// Framework / standard tree — direct RLS-scoped reads, no RPC needed.
// ---------------------------------------------------------------------------

interface FrameworkRow {
  id: string
  key: string
  name: string
  version: string
  description: string | null
  owner_commission_id: string | null
  cloned_from_framework_id: string | null
  status: string
}

function mapFramework(r: FrameworkRow): AccreditationFramework {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    version: r.version,
    description: r.description,
    ownerCommissionId: r.owner_commission_id,
    clonedFromFrameworkId: r.cloned_from_framework_id,
    status: r.status as FrameworkStatus,
  }
}

const FRAMEWORK_SELECT =
  'id, key, name, version, description, owner_commission_id, cloned_from_framework_id, status'

/**
 * Every framework the caller may see: global packs (`ownerCommissionId:
 * null`) plus any custom framework owned by `commissionId` (Amendment 1
 * A1·2). `[]` when the caller is out of scope for the commission-owned
 * arm (RLS drops those rows silently, matching every other list reader).
 */
export async function listFrameworks(commissionId: string): Promise<AccreditationFramework[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('accreditation_frameworks')
    .select(FRAMEWORK_SELECT)
    .or(`owner_commission_id.is.null,owner_commission_id.eq.${commissionId}`)
    .order('owner_commission_id', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true })
    .returns<FrameworkRow[]>()

  return (data ?? []).map(mapFramework)
}

/**
 * Global (ONA/JCI) packs ONLY — no commission context needed. For surfaces
 * with no natural commission anchor (the hospital-wide tab strip); avoids
 * the "pass the org's first commission id and rely on RLS returning global
 * rows identically regardless" workaround, which silently breaks for an org
 * with zero commissions.
 */
export async function listGlobalFrameworks(): Promise<AccreditationFramework[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('accreditation_frameworks')
    .select(FRAMEWORK_SELECT)
    .is('owner_commission_id', null)
    .order('name', { ascending: true })
    .returns<FrameworkRow[]>()

  return (data ?? []).map(mapFramework)
}

interface StandardRow {
  id: string
  framework_id: string
  parent_id: string | null
  code: string
  title: string
  description_md: string | null
  position: number
  level: number | null
}

function mapStandard(r: StandardRow): AccreditationStandard {
  return {
    id: r.id,
    frameworkId: r.framework_id,
    parentId: r.parent_id,
    code: r.code,
    title: r.title,
    descriptionMd: r.description_md,
    position: r.position,
    level: r.level as StandardLevel | null,
  }
}

const STANDARD_SELECT =
  'id, framework_id, parent_id, code, title, description_md, "position", level'

/** The flat standard rows of a framework (no hierarchy nesting), position-ordered. */
export async function listStandards(frameworkId: string): Promise<AccreditationStandard[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('accreditation_standards')
    .select(STANDARD_SELECT)
    .eq('framework_id', frameworkId)
    .order('position', { ascending: true })
    .returns<StandardRow[]>()

  return (data ?? []).map(mapStandard)
}

/**
 * A framework's full standard hierarchy, nested for the progressive-
 * disclosure tree (`StandardTreeNode.children`). `[]` when the framework
 * does not exist or is out of the caller's read scope (RLS silently returns
 * no rows). Built client-side from the flat `listStandards` shape — not a
 * distinct DB read.
 */
export async function getStandardTree(frameworkId: string): Promise<StandardTreeNode[]> {
  const flat = await listStandards(frameworkId)

  const byId = new Map<string, StandardTreeNode>(flat.map((s) => [s.id, { ...s, children: [] }]))
  const roots: StandardTreeNode[] = []

  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

// ---------------------------------------------------------------------------
// Readiness report (commission-scoped)
// ---------------------------------------------------------------------------

interface ReadinessReportRow {
  standard_id: string
  standard_code: string
  standard_title: string
  level: number | null
  assessment_status: string | null
  evidence_valida: number
  evidence_atencao: number
  evidence_vencida: number
  evidence_restrita: number
}

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
  const supabase = await createClient()
  const { data } = await supabase
    .rpc('readiness_report', { p_commission: commissionId, p_framework: frameworkId })
    .returns<ReadinessReportRow[]>()

  return (data ?? []).map((r) => ({
    standardId: r.standard_id,
    standardCode: r.standard_code,
    standardTitle: r.standard_title,
    level: r.level as StandardLevel | null,
    assessmentStatus: r.assessment_status as AssessmentStatus | null,
    evidenceValida: r.evidence_valida,
    evidenceAtencao: r.evidence_atencao,
    evidenceVencida: r.evidence_vencida,
    evidenceRestrita: r.evidence_restrita,
  }))
}

interface ReadinessEvidenceRow {
  id: string
  standard_id: string
  artifact_kind: string
  artifact_id: string
  status: string
  label: string
  note: string | null
  restricted: boolean
  linked_by_name: string | null
  linked_at: string
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
  const supabase = await createClient()
  const { data } = await supabase
    .rpc('readiness_evidence', { p_commission: commissionId, p_standard: standardId })
    .returns<ReadinessEvidenceRow[]>()

  return (data ?? []).map((r) => ({
    id: r.id,
    standardId: r.standard_id,
    artifactKind: r.artifact_kind as ArtifactKind,
    artifactId: r.artifact_id,
    status: r.status as EvidenceStatus,
    label: r.label,
    note: r.note,
    restricted: r.restricted,
    linkedByName: r.linked_by_name,
    linkedAt: r.linked_at,
  }))
}

interface EvidenceCandidateRow {
  id: string
  label: string
  sublabel: string | null
}

/**
 * Candidate artifacts of one kind for the evidence picker, filtered by a
 * search query. Backed by the `evidence_candidates` DEFINER RPC
 * (staff_admin-only); `[]` when out of scope, the flag is off, or no
 * candidates match. `kind` is echoed back from the request — the RPC itself
 * does not return it (every row in one call shares the same requested kind).
 */
export async function getEvidenceCandidates(
  commissionId: string,
  kind: ArtifactKind,
  query: string,
): Promise<EvidenceCandidate[]> {
  return (await findEvidenceCandidates(commissionId, kind, query)).candidates
}

/**
 * The same read, but REPORTING the door's error instead of swallowing it.
 *
 * Two callers want opposite things from a failure and both are right:
 * `getEvidenceCandidates` above renders a list, where `[]` is the correct
 * degradation; the `searchEvidenceCandidates` server action renders a picker
 * with an error banner, and collapsing a failure into "no results" there would
 * tell the user their search succeeded and found nothing. So the primitive
 * returns both halves and each caller decides — rather than the action reaching
 * past the query layer to the RPC, which is what it did until FUP-P16-2
 * (Architecture Rule 9).
 *
 * The error is returned RAW, not mapped: pt-BR mapping is the action layer's
 * job (`mapAccreditationError`), and this module has no business owning
 * user-facing copy.
 */
export async function findEvidenceCandidates(
  commissionId: string,
  kind: ArtifactKind,
  query: string,
): Promise<{
  candidates: EvidenceCandidate[]
  error: { code?: string; message?: string } | null
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('evidence_candidates', {
      p_commission: commissionId,
      p_kind: kind,
      p_query: query.trim() || undefined,
    })
    .returns<EvidenceCandidateRow[]>()

  if (error) return { candidates: [], error }

  return {
    candidates: (data ?? []).map((r) => ({
      id: r.id,
      kind,
      label: r.label,
      subtitle: r.sublabel,
    })),
    error: null,
  }
}

// ---------------------------------------------------------------------------
// Single standard assessment detail (the edit form's prefill)
// ---------------------------------------------------------------------------

/** A single standard's assessment detail, for the edit form's prefill. */
export interface StandardAssessmentDetail {
  status: AssessmentStatus
  noteMd: string | null
  assessedAt: string
  assessedByName: string | null
}

/**
 * Read one commission's current assessment for one standard — the prefill
 * BUG-P16-001's root-cause half needed. Routes to `get_standard_assessment`
 * (backend's `3ece65f`, landed mid-Wave-3), a member-scoped read
 * DELIBERATELY separate from `getReadinessReport`/`getReadinessEvidence`
 * (D8 — those carry no `note` field by design; this door does, and is
 * commission-scoped only, never reachable from the hospital tier). Returns
 * `null` when there is no assessment yet (never assessed) OR the caller is
 * out of scope — the door returns zero rows either way, and the two are
 * handled identically here (an empty textarea), matching
 * `ReadinessRow.assessmentStatus: null`'s existing "never assessed" meaning.
 *
 * Lived in `@/lib/accreditation/actions` until FUP-P16-2 (Rule 9) — it is a
 * READ, and its only caller is a Server Component that can call this directly.
 */
export async function getStandardAssessmentDetail(
  commissionId: string,
  standardId: string,
): Promise<StandardAssessmentDetail | null> {
  if (!commissionId || !standardId) return null

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_standard_assessment', {
    p_commission: commissionId,
    p_standard: standardId,
  })

  if (error || !data || data.length === 0) return null

  const row = data[0]
  return {
    status: row.status as AssessmentStatus,
    // The generated Args/Returns type marks these non-null, but the RPC's
    // own SQL is a nullable column (`note_md`) and a LEFT JOIN
    // (`assessed_by_name`) — defend against both actually being null at
    // runtime regardless of what the generator asserts.
    noteMd: row.note_md ?? null,
    assessedAt: row.assessed_at,
    assessedByName: row.assessed_by_name ?? null,
  }
}

// ---------------------------------------------------------------------------
// Hospital-wide consolidated readiness
// ---------------------------------------------------------------------------

interface HospitalReadinessRpcRow {
  standard_id: string
  standard_code: string
  standard_title: string
  level: number | null
  consolidated_status: string | null
  resolution: string
  responsible_commission_id: string | null
  evidence_valida: number
  evidence_atencao: number
  evidence_vencida: number
  evidence_restrita: number
}

/**
 * The PHI-FREE, counts-only consolidated readiness for one hospital against
 * one framework — worst-status-wins across commissions, or the designated
 * `standard_ownerships` commission's answer when set (D7). Backed by the
 * `hospital_readiness` DEFINER RPC, gated `is_hospital_admin_of OR
 * is_org_admin_of(org_of_hospital)` ONLY — platform_admin gets `[]` (D6, the
 * noun rule; the BUG-AUTHZ-001 shape tested by construction, pgTAP 284).
 * Returns `[]` — never throws — for a foreign hospital or a flag outage, so
 * a `Promise.all` over many hospitals never fails the whole page on one
 * out-of-scope hospital.
 */
export async function getHospitalReadiness(
  hospitalId: string,
  frameworkId: string,
): Promise<HospitalReadinessRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .rpc('hospital_readiness', { p_hospital: hospitalId, p_framework: frameworkId })
    .returns<HospitalReadinessRpcRow[]>()

  return (data ?? []).map((r) => ({
    standardId: r.standard_id,
    standardCode: r.standard_code,
    standardTitle: r.standard_title,
    level: r.level as StandardLevel | null,
    consolidatedStatus: r.consolidated_status as AssessmentStatus | null,
    resolution: r.resolution as HospitalReadinessResolution,
    responsibleCommissionId: r.responsible_commission_id,
    evidenceValida: r.evidence_valida,
    evidenceAtencao: r.evidence_atencao,
    evidenceVencida: r.evidence_vencida,
    evidenceRestrita: r.evidence_restrita,
  }))
}

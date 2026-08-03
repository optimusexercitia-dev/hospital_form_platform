/**
 * Standards Crosswalk & Readiness/Gap Engine v2 (Phase 16) — CLIENT-SAFE domain
 * types + label maps.
 *
 * **Purity contract** (the `indicators/types.ts` / `safety/capa-types.ts`
 * discipline). This module has ZERO runtime imports of server-only code — it
 * stays importable from CLIENT components (the standards tree, the evidence
 * picker, the readiness dashboard). It must NEVER import `@/lib/supabase/*`,
 * `next/headers`, `server-only`, or any data-access/action module. The
 * server-only reader (`@/lib/queries/accreditation`) imports its types FROM
 * here.
 *
 * The authority for every shape below is ADR 0093 (decisions D1–D10 +
 * Amendment 1) and `docs/plans/phase-16-standards-crosswalk-program.md`
 * (Wave 0 section). Commissions link the artifacts they already produce as
 * **evidence** against ONA/JCI/custom framework standards, self-assess
 * conformity, and get a readiness/gap report. PHI-FREE by design (D8) — the
 * module never stores or surfaces PHI payloads, only masked counts for
 * restricted (case/ethics_procedure) evidence links.
 *
 * ⚠ Rollup math (per-level ONA gating, per-chapter %, "o que bloqueia o Nível
 * N?" gap lists) is NOT here — it is `computeReadinessRollups()` in
 * `@/lib/accreditation/rollups.ts` (frontend-owned, Vitest-tested, consumes
 * {@link ReadinessRow}[]). This module only carries the DB-computed per-
 * standard/per-link/per-hospital-standard row shapes.
 */

// ---------------------------------------------------------------------------
// Domain unions — the FIXED vocabulary (ASCII storage values; pt-BR via labels)
// ---------------------------------------------------------------------------

/**
 * What an evidence link points at. The 2026-07 eight (`form`, `form_version`,
 * `meeting`, `case`, `indicator`, `controlled_document`, `action_item`,
 * `capa_plan`) plus `charter` and `ethics_procedure` (ADR 0093 D4, closing
 * ETH·E3b). Safety-event / RCA evidence is deliberately NOT a kind (declined,
 * post-pilot demand-driven). CHECK-enforced on `evidence_links.artifact_kind`
 * — every dispatch (`app.artifact_belongs_to_commission`,
 * `app.evidence_status_of`) must carry one arm per value, enumerated from the
 * CHECK, never invented (the "every sibling arm" rule).
 */
export type ArtifactKind =
  | 'form'
  | 'form_version'
  | 'meeting'
  | 'case'
  | 'indicator'
  | 'controlled_document'
  | 'action_item'
  | 'capa_plan'
  | 'charter'
  | 'ethics_procedure'

/**
 * A commission's self-assessed conformity against one standard.
 * `nao_aplicavel` is a legitimate terminal state (the standard does not apply
 * to this commission's scope), not an empty state — it is distinct from "not
 * yet assessed" (a {@link ReadinessRow} with no `standard_assessments` row,
 * represented as `assessmentStatus: null`).
 */
export type AssessmentStatus = 'conforme' | 'parcial' | 'nao_conforme' | 'nao_aplicavel'

/**
 * Whether a linked artifact still backs its claim (ADR 0093 D5 — "a link is a
 * claim, not proof"). Computed from the artifact's OWN lifecycle at read time
 * (`app.evidence_status_of`), never stored on `evidence_links`. `valida` (the
 * artifact is current/on-target/effective), `atencao` (borderline — e.g. an
 * indicator `off_target` measurement, a document `em_aprovacao`), `vencida`
 * (stale — overdue review, archived form version, no measurement in window).
 * Stale evidence NEVER silently counts toward "evidenced": every consuming
 * shape splits counts by this status instead of reporting one total.
 */
export type EvidenceStatus = 'valida' | 'atencao' | 'vencida'

/** A global (ONA/JCI) or commission-owned custom accreditation framework. */
export type FrameworkStatus = 'ativo' | 'arquivado'

/**
 * ONA's three-tier certification level (ADR 0093 D3). `1` = Segurança,
 * `2` = Gestão Integrada, `3` = Excelência. `null` for non-leveled frameworks
 * (JCI-shaped — chapter/overall % rollup instead). Certification is
 * cumulative: level N readiness requires levels ≤ N clean.
 */
export type StandardLevel = 1 | 2 | 3

/**
 * How a hospital-wide {@link HospitalReadinessRow} arrived at its
 * `consolidatedStatus` (ADR 0093 D7). `unanime` — every reporting commission
 * agreed. `pior_caso` — they disagreed and worst-status-wins
 * (`nao_conforme > parcial > conforme`; `nao_aplicavel` only counts toward
 * unanimity, never toward the worst-case order) picked the answer.
 * `responsavel` — a `standard_ownerships` row designates one commission whose
 * assessment IS the institutional answer, overriding the multi-commission
 * rollup entirely.
 */
export type HospitalReadinessResolution = 'unanime' | 'pior_caso' | 'responsavel'

// ---------------------------------------------------------------------------
// Framework / standard tree (global packs + commission-owned clones)
// ---------------------------------------------------------------------------

/**
 * A framework: a global admin-curated pack (`ownerCommissionId: null` — ONA,
 * JCI; skeleton-only, never `descriptionMd` manual text, ADR 0093 D2) or a
 * commission-owned clone (`clonedFromFrameworkId` set) a `staff_admin` pasted
 * licensed text into. Global packs are SELECT-able by all authenticated
 * users; commission-owned frameworks are readable ONLY by that commission's
 * members (Amendment 1 A1·2 — a clone carries licensed text that must not
 * leak cross-tenant).
 */
export interface AccreditationFramework {
  id: string
  key: string
  name: string
  version: string
  description: string | null
  ownerCommissionId: string | null
  clonedFromFrameworkId: string | null
  status: FrameworkStatus
}

/**
 * One node of a framework's standard hierarchy. `descriptionMd` is `null` on
 * every global-pack row (skeleton-only, D2) and populated only on a
 * commission-owned clone. `level` is non-null only inside a leveled (ONA)
 * framework.
 */
export interface AccreditationStandard {
  id: string
  frameworkId: string
  parentId: string | null
  code: string
  title: string
  descriptionMd: string | null
  position: number
  level: StandardLevel | null
}

/**
 * An {@link AccreditationStandard} with its children materialized, for the
 * standards tree's progressive-disclosure `<ul>` (a semantic nested list per
 * branch — never a `role=tree` widget). Built client-side (or by the query
 * layer) from the flat `listStandards` result; not a distinct DB shape.
 */
export interface StandardTreeNode extends AccreditationStandard {
  children: StandardTreeNode[]
}

// ---------------------------------------------------------------------------
// Readiness report (commission-scoped) — per-standard rows
// ---------------------------------------------------------------------------

/**
 * One standard's readiness inside a commission's `readiness_report`. Evidence
 * counts are split by {@link EvidenceStatus} — never a bare total, per D5.
 * `evidenceRestrita` counts links whose target the CALLER cannot read (a
 * restricted case/ethics_procedure — D8), disjoint from the three status
 * counts (a restricted link's freshness is not disclosed either).
 *
 * ⚠ Deliberately carries NO `note` field (ADR 0093 D8) — assessment notes are
 * commission-internal free text and never ride the readiness rollup; a caller
 * wanting the note reads `getReadinessEvidence` / the standard panel
 * directly, which is itself RLS/capability-gated per link.
 */
export interface ReadinessRow {
  standardId: string
  standardCode: string
  standardTitle: string
  level: StandardLevel | null
  /** `null` = no `standard_assessments` row yet (never assessed). */
  assessmentStatus: AssessmentStatus | null
  evidenceValida: number
  evidenceAtencao: number
  evidenceVencida: number
  evidenceRestrita: number
}

/**
 * One evidence link inside a standard's detail panel
 * (`getReadinessEvidence`). When the artifact is restricted and the caller
 * lacks the read capability (`can_read_case` for case/ethics_procedure,
 * `can_read_capa` for capa_plan — D8), the door MASKS the row: `label`
 * becomes the literal "Evidência restrita", `note` is forced `null`, and
 * `restricted` is `true` — the row still counts, but discloses nothing about
 * its target. An unrestricted row's `label` is the artifact's own display
 * title (form/meeting/document title, case code, …).
 */
export interface EvidenceItem {
  id: string
  standardId: string
  artifactKind: ArtifactKind
  artifactId: string
  status: EvidenceStatus
  label: string
  note: string | null
  restricted: boolean
  linkedByName: string | null
  linkedAt: string
}

/**
 * A candidate artifact offered by the evidence picker
 * (`evidence_candidates` DEFINER search, staff_admin-only). Per-kind SELECTs
 * already apply the reader's own visibility (`can_read_case` /
 * `can_read_capa` for the restricted kinds) — a candidate never appears if
 * the caller could not read it, unlike an already-linked {@link EvidenceItem}
 * which may be masked post-hoc.
 */
export interface EvidenceCandidate {
  id: string
  kind: ArtifactKind
  label: string
  subtitle: string | null
}

// ---------------------------------------------------------------------------
// Hospital-wide consolidated readiness (hospital_admin / org_admin surface)
// ---------------------------------------------------------------------------

/**
 * One standard's CONSOLIDATED readiness across a hospital's commissions
 * (`hospital_readiness` — gated `is_hospital_admin_of` / org-admin ONLY, D6;
 * platform_admin receives ZERO rows, the BUG-AUTHZ-001 shape tested by
 * construction). Counts-only, no note text (D8) — this is the
 * minimum-necessary hospital-tier read, mirroring
 * `hospital_document_register` / `hospital_indicator_rollup`.
 */
export interface HospitalReadinessRow {
  standardId: string
  standardCode: string
  standardTitle: string
  level: StandardLevel | null
  consolidatedStatus: AssessmentStatus | null
  resolution: HospitalReadinessResolution
  responsibleCommissionId: string | null
  evidenceValida: number
  evidenceAtencao: number
  evidenceVencida: number
  evidenceRestrita: number
}

// ---------------------------------------------------------------------------
// pt-BR label maps (user-facing strings; storage stays ASCII — Rule 10)
// ---------------------------------------------------------------------------

export const ARTIFACT_KIND_LABELS: Record<ArtifactKind, string> = {
  form: 'Formulário',
  form_version: 'Versão de formulário',
  meeting: 'Reunião',
  case: 'Caso',
  indicator: 'Indicador',
  controlled_document: 'Documento controlado',
  action_item: 'Item de ação',
  capa_plan: 'Plano CAPA',
  charter: 'Regimento',
  ethics_procedure: 'Procedimento ético',
}

export const ASSESSMENT_STATUS_LABELS: Record<AssessmentStatus, string> = {
  conforme: 'Conforme',
  parcial: 'Parcial',
  nao_conforme: 'Não conforme',
  nao_aplicavel: 'Não aplicável',
}

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  valida: 'Válida',
  atencao: 'Atenção',
  vencida: 'Vencida',
}

export const FRAMEWORK_STATUS_LABELS: Record<FrameworkStatus, string> = {
  ativo: 'Ativo',
  arquivado: 'Arquivado',
}

export const STANDARD_LEVEL_LABELS: Record<StandardLevel, string> = {
  1: 'Segurança',
  2: 'Gestão Integrada',
  3: 'Excelência',
}

export const HOSPITAL_READINESS_RESOLUTION_LABELS: Record<HospitalReadinessResolution, string> = {
  unanime: 'Unânime',
  pior_caso: 'Pior caso',
  responsavel: 'Responsável designado',
}

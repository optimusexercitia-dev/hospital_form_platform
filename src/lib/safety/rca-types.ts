/**
 * Patient-safety / NSP RCA WORKSPACE — CLIENT-SAFE domain types + label maps
 * (Phase 14c — Root Cause Analysis).
 *
 * **Purity contract (the Phase-12 `event-model.ts` / Phase-14a `safety/types.ts`
 * discipline).** This module has ZERO imports — it must remain importable from
 * CLIENT components (the 4-stage RCA workspace, the team / timeline / evidence
 * panels). It must NEVER import `@/lib/supabase/*`, `next/headers`, `server-only`,
 * or any data-access/action module. The server-only query functions
 * (`@/lib/queries/rca`) and the `"use server"` actions (`@/lib/safety/rca-actions`)
 * IMPORT their types from here — so a `"use client"` component never transitively
 * drags `@/lib/supabase/server` (→ `next/headers`) into the client bundle.
 *
 * The RCA is the investigation a sentinel triage mandates (`docs/design/README_rca.md`):
 * a team frames the problem (stage 1), builds an Ishikawa fishbone + 5-Whys drill
 * (stage 2), and distils classified root causes (stage 3) — the structured causal
 * model Phase 14d's CAPA actions then FK into. (README stage 4 / PDCA is Phase 14d.)
 *
 * Stable ASCII union slugs are storage/logic values; all user-facing strings are
 * pt-BR, resolved via the label maps below (Rule 10). Markdown bodies are sanitized
 * (Rule 7) and NEVER copied into the audit log (Rule 11).
 */

// ---------------------------------------------------------------------------
// Domain unions — the FIXED vocabulary (ASCII storage values; pt-BR via labels)
// ---------------------------------------------------------------------------

/**
 * The RCA lifecycle. `draft` (the shell minted by `confirm_triage` when a triage
 * mandates an RCA) → `in_progress` (the team is working) → `in_review` (submitted
 * for review) → `completed` (frozen). `reopen_rca` returns `completed → in_progress`.
 * DB-enforced by `app.guard_rca_status` (HC047 wrong-state/frozen).
 */
export type RcaStatus = 'draft' | 'in_progress' | 'in_review' | 'completed'

/**
 * The fixed RCA team-member role. A platform-user member with ANY role EXCEPT
 * `observer` gains row-level write on the RCA (`app.can_write_rca`); an `observer`
 * is read-only. `lead`/`facilitator` run the analysis; `sme` = subject-matter
 * expert; `reviewer` reviews; `executive_sponsor` sponsors.
 */
export type RcaMemberRole =
  | 'lead'
  | 'facilitator'
  | 'sme'
  | 'reviewer'
  | 'executive_sponsor'
  | 'observer'

/** The six fixed Ishikawa (fishbone) categories (`README_rca §1.1`). */
export type FishboneCategory =
  | 'people'
  | 'communication'
  | 'process'
  | 'equipment'
  | 'environment'
  | 'policy'

/** The fixed root-cause classification (`README_rca §1.2`). */
export type RootCauseClassification = 'system' | 'human' | 'environment' | 'external'

/** Root cause vs contributing factor (`README_rca §1.2`). */
export type RootCauseType = 'root' | 'contributing'

/**
 * How a piece of evidence is attached: an uploaded `document` (in the immutable
 * `nsp-evidence` bucket), an external `link` (https), or a `citation` to an
 * existing interview / meeting / case document. Exactly one mode is populated per
 * kind (DB CHECK + the RPC's pre-validation → `check_violation`).
 */
export type EvidenceKind = 'document' | 'link' | 'citation'

/** Which entity a `citation`-kind evidence row references. */
export type CitationTarget = 'interview' | 'meeting' | 'document'

// ---------------------------------------------------------------------------
// pt-BR display labels (Rule 10) — UI maps the ASCII slug → label
// ---------------------------------------------------------------------------

export const RCA_STATUS_LABELS: Record<RcaStatus, string> = {
  draft: 'Rascunho',
  in_progress: 'Em andamento',
  in_review: 'Em revisão',
  completed: 'Concluída',
}

export const RCA_MEMBER_ROLE_LABELS: Record<RcaMemberRole, string> = {
  lead: 'Líder',
  facilitator: 'Facilitador',
  sme: 'Especialista (SME)',
  reviewer: 'Revisor',
  executive_sponsor: 'Patrocinador executivo',
  observer: 'Observador',
}

export const FISHBONE_CATEGORY_LABELS: Record<FishboneCategory, string> = {
  people: 'Pessoas e equipe',
  communication: 'Comunicação',
  process: 'Processo e procedimento',
  equipment: 'Equipamento e tecnologia',
  environment: 'Ambiente',
  policy: 'Política e organização',
}

export const ROOT_CAUSE_CLASSIFICATION_LABELS: Record<RootCauseClassification, string> = {
  system: 'Sistêmica',
  human: 'Humana',
  environment: 'Ambiental',
  external: 'Externa',
}

export const ROOT_CAUSE_TYPE_LABELS: Record<RootCauseType, string> = {
  root: 'Causa raiz',
  contributing: 'Fator contribuinte',
}

export const EVIDENCE_KIND_LABELS: Record<EvidenceKind, string> = {
  document: 'Arquivo',
  link: 'Link',
  citation: 'Citação',
}

/** Ordered fishbone categories for rendering the six ribs left→right / top→bottom. */
export const FISHBONE_CATEGORY_ORDER: FishboneCategory[] = [
  'people',
  'communication',
  'process',
  'equipment',
  'environment',
  'policy',
]

// ---------------------------------------------------------------------------
// Domain types — the RCA workspace contract
// ---------------------------------------------------------------------------

/**
 * One RCA as the workspace consumes it. PHI-FREE governance metadata; the problem
 * / expected / summary fields are sanitized Markdown (Rule 7), clinical free text
 * NEVER copied into the audit log (Rule 11). Loaded for an event whose triage
 * mandated an RCA (`pathway = rca`).
 */
export interface Rca {
  id: string
  eventId: string
  /** The event's per-NSP code (e.g. `EV-0003`) for the breadcrumb / header. */
  eventCode: string | null
  status: RcaStatus
  /** The 45-day (configurable) due date minted at triage confirm. */
  dueDate: string | null
  // Stage 1 — Problem (sanitized Markdown / free text)
  whatMd: string | null
  expectedMd: string | null
  detected: string | null
  impact: string | null
  scope: string | null
  /** Findings narrative (sanitized Markdown). */
  summaryMd: string | null
  submittedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  /** Whether the viewer may write this RCA (`app.can_write_rca`) — drives the UI's
   * write-gating without trusting UI hiding (RLS is the boundary). */
  viewerCanWrite: boolean
}

/**
 * One RCA team member. A platform user (`userId`) XOR an external participant
 * (`externalName`). A platform-user member with any role except `observer` gains
 * row-level write (`app.can_write_rca`).
 */
export interface RcaMember {
  id: string
  rcaId: string
  /** The platform user id when this is a registered member; `null` for an external. */
  userId: string | null
  /** Resolved display name (profile name for a user; the free-text name for an external). */
  name: string | null
  /** Free-text name when `userId` is null (external SME / sponsor). */
  externalName: string | null
  role: RcaMemberRole
}

/** One incident-chronology entry (stage 2 context). */
export interface RcaTimelineEntry {
  id: string
  rcaId: string
  occurredAt: string
  description: string
  position: number
}

/**
 * One piece of RCA evidence. Exactly one mode is populated per {@link kind}:
 * `document` → `openUrl` (signed URL for the uploaded file); `link` → `externalUrl`;
 * `citation` → `citationTarget` + `citationLabel` (a SNAPSHOT of the referenced
 * artifact, so the reference survives the target's later change) + the matching id.
 */
export interface RcaEvidence {
  id: string
  rcaId: string
  kind: EvidenceKind
  title: string
  /** Signed URL for a `document`-kind uploaded file; `null` otherwise. */
  openUrl: string | null
  /** External https link for a `link`-kind row; `null` otherwise. */
  externalUrl: string | null
  /** Which entity a `citation` references; `null` for document/link. */
  citationTarget: CitationTarget | null
  /** Snapshot label of the cited artifact (viewable-forever); `null` for document/link. */
  citationLabel: string | null
  /** The cited entity id (interview / meeting / document) when `kind = citation`. */
  citedEntityId: string | null
  createdAt: string
}

/** One fishbone factor (a contributing factor on a category rib). */
export interface RcaFactor {
  id: string
  rcaId: string
  category: FishboneCategory
  text: string
  /** Flagged → carried into a 5-Whys chain (drives `keyFactors`). */
  isKey: boolean
  position: number
}

/**
 * The 5-Whys drill for one KEY factor (lazily created on first write). `steps` is
 * an ordered array of up to 5 "because…" answers (`''` = not yet answered).
 */
export interface RcaWhyChain {
  id: string
  rcaId: string
  /** The key factor this chain drills (1:1 with an `rca_factors` row). */
  factorId: string
  steps: string[]
  rootText: string | null
}

/**
 * One distilled root cause (stage 3). The `id` is the STABLE PK that Phase 14d's
 * `capa_action.root_cause_id` FKs into — do not repurpose it.
 */
export interface RcaRootCause {
  id: string
  rcaId: string
  text: string
  /** Which fishbone category it came from; `null` if unmapped. */
  category: FishboneCategory | null
  classification: RootCauseClassification
  type: RootCauseType
  position: number
}

// ---------------------------------------------------------------------------
// Action input shapes (a `"use server"` module cannot export types, so the shapes
// the client binds its forms to live here; the result `ActionState` is reused from
// `@/lib/safety/types`)
// ---------------------------------------------------------------------------

/** The stage-1 problem-statement edit (+ findings summary). All fields optional —
 * the workspace autosaves partial edits. */
export interface UpdateRcaInput {
  whatMd: string | null
  expectedMd: string | null
  detected: string | null
  impact: string | null
  scope: string | null
  summaryMd: string | null
}

/** Add a team member: a platform user XOR an external name, with a fixed role. */
export interface RcaMemberInput {
  /** The platform user id; mutually exclusive with {@link externalName}. */
  userId: string | null
  /** Free-text external participant name; mutually exclusive with {@link userId}. */
  externalName: string | null
  role: RcaMemberRole
}

/** Add/edit an incident-timeline entry. */
export interface RcaTimelineEntryInput {
  occurredAt: string
  description: string
}

/**
 * Add a piece of evidence. The caller supplies exactly one mode matching {@link kind}:
 * `document` → `storagePath` (the upload action mints it in `nsp-evidence`); `link`
 * → `externalUrl` (https); `citation` → `citationTarget` + `citedEntityId` (+ the
 * snapshot `citationLabel`). The RPC pre-validates the three-way shape.
 */
export interface RcaEvidenceInput {
  kind: EvidenceKind
  title: string
  storagePath: string | null
  externalUrl: string | null
  citationTarget: CitationTarget | null
  citedEntityId: string | null
  citationLabel: string | null
}

/** Add/edit a fishbone factor. */
export interface RcaFactorInput {
  category: FishboneCategory
  text: string
}

/** Add/edit a root cause (stage 3). */
export interface RcaRootCauseInput {
  text: string
  category: FishboneCategory | null
  classification: RootCauseClassification
  type: RootCauseType
}

// ---------------------------------------------------------------------------
// Picker support types — the team member picker + the citation picker
// ---------------------------------------------------------------------------

/**
 * An assignable platform user for the RCA team-member picker (the `user_id` option).
 * Admin/PQS-wide roster — cross-functional RCAs pull SMEs from anywhere, so this is
 * deliberately NOT commission-scoped.
 */
export interface AssignableUser {
  id: string
  name: string | null
  email: string | null
}

/**
 * One citable in-scope artifact for the evidence `citation` picker. Feeds
 * `addRcaEvidence(kind:'citation', …)`, which SNAPSHOTS `label` so the reference
 * survives the target's later change.
 */
export interface RcaCitationTarget {
  kind: CitationTarget
  id: string
  label: string
  /** A display date for the artifact (e.g. the meeting/interview date); optional. */
  date: string | null
}

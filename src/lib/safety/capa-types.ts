/**
 * Patient-safety / NSP CAPA — CLIENT-SAFE domain types + label maps (Phase 14d —
 * Corrective Action Plan, Effectiveness & Closure).
 *
 * **Purity contract (the Phase-12 `event-model.ts` / Phase-14a `safety/types.ts`
 * discipline).** This module has ZERO imports — it must remain importable from
 * CLIENT components (the CAPA workspace: PDCA wheels, measures grid, effectiveness
 * + closure editors). It must NEVER import `@/lib/supabase/*`, `next/headers`,
 * `server-only`, or any data-access/action module. The server-only query functions
 * (`@/lib/queries/capa`) and the `"use server"` actions (`@/lib/safety/capa-actions`)
 * IMPORT their types from here.
 *
 * The CAPA plan is the closed improvement loop a finding drives (README_rca §7 /
 * stage 4): corrective/preventive actions (with a JC action-strength hierarchy),
 * execution tasks + implementation evidence, measures → results, an effectiveness
 * verdict, and closure with lessons learned. `capa_plan` is the REUSABLE PRIMITIVE
 * Phases 15/18 also reach (the `source` polymorphism). PHI-free; the `*_md` bodies
 * are sanitized Markdown (Rule 7) and NEVER copied into the audit log (Rule 11).
 *
 * Stable ASCII union slugs are storage/logic values; user-facing strings are pt-BR.
 */

// ---------------------------------------------------------------------------
// Domain unions — the FIXED vocabulary (ASCII storage values; pt-BR via labels)
// ---------------------------------------------------------------------------

/**
 * What a CAPA plan was opened FROM. `rca`/`event`/`meeting` have real FK sources
 * now; `indicator` (Phase 15) and `audit_finding` (Phase 18) are FK-less forward
 * hooks; `manual` carries no source. Exactly one source column matches (DB CHECK).
 */
export type CapaSource =
  | 'rca'
  | 'event'
  | 'indicator'
  | 'audit_finding'
  | 'meeting'
  | 'manual'

/** The CAPA classification (corrective / preventive / improvement). */
export type CapaClassification = 'corretiva' | 'preventiva' | 'melhoria'

/**
 * The CAPA plan lifecycle. `aberto` (opened) → `em_execucao` (actions running) →
 * `em_verificacao` (effectiveness being verified) → `concluido` (closed); plus
 * `cancelado`. DB-enforced by `app.guard_capa_status` (HC049 wrong-state).
 */
export type CapaStatus =
  | 'aberto'
  | 'em_execucao'
  | 'em_verificacao'
  | 'concluido'
  | 'cancelado'

/** The fixed Joint-Commission action-strength hierarchy (stronger = more reliable). */
export type CapaActionStrength = 'forte' | 'intermediaria' | 'fraca'

/** A single corrective action's status. The assignee advances it via the narrow path. */
export type CapaActionStatus = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'

/** How implementation evidence is attached: an uploaded file (immutable bucket) XOR a link. */
export type CapaEvidenceKind = 'document' | 'link'

/** The effectiveness verdict (effective / partial / ineffective). */
export type CapaEffectivenessVerdict = 'eficaz' | 'parcial' | 'ineficaz'

// ---------------------------------------------------------------------------
// pt-BR display labels (Rule 10)
// ---------------------------------------------------------------------------

export const CAPA_SOURCE_LABELS: Record<CapaSource, string> = {
  rca: 'Análise de causa raiz',
  event: 'Evento de segurança',
  indicator: 'Indicador',
  audit_finding: 'Achado de auditoria',
  meeting: 'Reunião',
  manual: 'Manual',
}

export const CAPA_CLASSIFICATION_LABELS: Record<CapaClassification, string> = {
  corretiva: 'Corretiva',
  preventiva: 'Preventiva',
  melhoria: 'Melhoria',
}

export const CAPA_STATUS_LABELS: Record<CapaStatus, string> = {
  aberto: 'Aberto',
  em_execucao: 'Em execução',
  em_verificacao: 'Em verificação',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export const CAPA_ACTION_STRENGTH_LABELS: Record<CapaActionStrength, string> = {
  forte: 'Forte',
  intermediaria: 'Intermediária',
  fraca: 'Fraca',
}

export const CAPA_ACTION_STATUS_LABELS: Record<CapaActionStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export const CAPA_EVIDENCE_KIND_LABELS: Record<CapaEvidenceKind, string> = {
  document: 'Arquivo',
  link: 'Link',
}

export const CAPA_EFFECTIVENESS_VERDICT_LABELS: Record<CapaEffectivenessVerdict, string> = {
  eficaz: 'Eficaz',
  parcial: 'Parcialmente eficaz',
  ineficaz: 'Ineficaz',
}

/** Action-strength order (strongest first) for rendering the JC hierarchy. */
export const CAPA_ACTION_STRENGTH_ORDER: CapaActionStrength[] = [
  'forte',
  'intermediaria',
  'fraca',
]

// ---------------------------------------------------------------------------
// Domain types — the CAPA contract
// ---------------------------------------------------------------------------

/**
 * One CAPA plan. The reusable primitive: `source` + the matching source id/label.
 * `lessons_learned_md` is sanitized Markdown (Rule 7) — never audited. `viewerCanManage`
 * reflects PQS/admin write authority (CAPA write is PQS/admin, not a participant grant).
 */
export interface CapaPlan {
  id: string
  /** Per-NSP minted human code (e.g. `CAPA-0001`). */
  code: string
  source: CapaSource
  /** The matching source entity id (rca/event/meeting/indicator/audit_finding); null for manual. */
  sourceId: string | null
  /** The event this plan is scoped to (for event/rca-sourced plans); null otherwise. */
  eventId: string | null
  eventCode: string | null
  classification: CapaClassification
  status: CapaStatus
  /** Sanitized-Markdown lessons-learned narrative (written at closure; never audited). */
  lessonsLearnedMd: string | null
  openedAt: string
  closedAt: string | null
  /** Whether the viewer (PQS/admin) may manage this plan. */
  viewerCanManage: boolean
}

/**
 * One corrective action. `owner` is the displayed free-text responsible party;
 * `assigneeUserId` is the platform user the narrow advance gate keys on (nullable).
 * `rootCauseId` links back to the 14c RCA root cause it addresses.
 */
export interface CapaAction {
  id: string
  capaId: string
  title: string
  /** Free-text responsible party (displayed). */
  owner: string | null
  /** The platform user who may self-advance this action; null if unassigned. */
  assigneeUserId: string | null
  assigneeName: string | null
  dueDate: string | null
  actionStrength: CapaActionStrength
  successMeasure: string | null
  /** The 14c RCA root cause this action addresses; null for a non-RCA CAPA. */
  rootCauseId: string | null
  status: CapaActionStatus
  position: number
}

/** One execution step (task) of an action. */
export interface CapaActionTask {
  id: string
  actionId: string
  description: string
  isDone: boolean
  position: number
}

/**
 * One piece of implementation evidence for an action: an uploaded file (signed
 * `openUrl`) XOR an https `externalUrl`.
 */
export interface CapaActionEvidence {
  id: string
  actionId: string
  kind: CapaEvidenceKind
  title: string
  openUrl: string | null
  externalUrl: string | null
  createdAt: string
}

/** A measure of success for the plan (numerator/target/definition). */
export interface CapaMeasure {
  id: string
  capaId: string
  name: string
  target: string | null
  definition: string | null
  /** Phase-15 indicator hook (FK-less for now); null until wired. */
  indicatorId: string | null
  position: number
}

/** One recorded result for a measure over a period. */
export interface CapaMeasureResult {
  id: string
  measureId: string
  period: string
  value: number | null
  note: string | null
  createdAt: string
}

/**
 * The 1:1 effectiveness verdict for a plan (required before closure; revoked on
 * reopen). `methodMd` is sanitized Markdown — never audited.
 */
export interface CapaEffectiveness {
  capaId: string
  verdict: CapaEffectivenessVerdict
  methodMd: string | null
  verifiedByName: string | null
  verifiedAt: string
}

/** NSP-wide CAPA KPIs for the dashboard. */
export interface CapaKpis {
  open: number
  inVerification: number
  overdueActions: number
  closedYtd: number
}

// ---------------------------------------------------------------------------
// Action input shapes (a `"use server"` module cannot export types)
// ---------------------------------------------------------------------------

/** Open a CAPA plan. Exactly one source field matches `source` (the RPC validates). */
export interface OpenCapaInput {
  source: CapaSource
  classification: CapaClassification
  /** The matching source entity id (null for `manual`). */
  sourceId: string | null
}

/** Edit a plan's classification. (Status flows through the lifecycle RPCs.) */
export interface UpdateCapaInput {
  classification: CapaClassification
}

/** Add/edit a corrective action. */
export interface CapaActionInput {
  title: string
  owner: string | null
  assigneeUserId: string | null
  dueDate: string | null
  actionStrength: CapaActionStrength
  successMeasure: string | null
  /** The 14c RCA root cause this action addresses; null for a non-RCA CAPA. */
  rootCauseId: string | null
}

/** Add/edit a measure. */
export interface CapaMeasureInput {
  name: string
  target: string | null
  definition: string | null
}

/** Record a measure result for a period. */
export interface CapaMeasureResultInput {
  period: string
  value: number | null
  note: string | null
}

/** Add a piece of implementation evidence (upload XOR link). */
export interface CapaEvidenceInput {
  kind: CapaEvidenceKind
  title: string
  storagePath: string | null
  externalUrl: string | null
}

/** Record the effectiveness verdict (the close precondition). */
export interface CapaEffectivenessInput {
  verdict: CapaEffectivenessVerdict
  methodMd: string | null
}

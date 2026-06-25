/**
 * Patient-safety / NSP TRIAGE — CLIENT-SAFE domain types + label maps (Phase 14b).
 *
 * **Purity contract (the Phase-12 `event-model.ts` / Phase-14a `safety/types.ts`
 * discipline).** This module has ZERO imports — it must remain importable from
 * CLIENT components (the three-pane triage workstation, the NSP config area). It
 * must NEVER import `@/lib/supabase/*`, `next/headers`, `server-only`, or any
 * data-access/action module. The server-only query functions
 * (`@/lib/queries/triage`) and the `"use server"` actions
 * (`@/lib/safety/triage-actions`) IMPORT their types from here — so a
 * `"use client"` component that needs a type/label never transitively drags
 * `@/lib/supabase/server` (→ `next/headers`) into the client bundle. (A
 * `"use server"` module also cannot export types at all, which is the other
 * reason the action INPUT types live here.)
 *
 * The triage worksheet is the front door of the platform: a committee reports an
 * event to the NSP, which triages it through the Joint Commission patient-safety-
 * event framework (`docs/design/README_triage.md`) to a disposition — culminating
 * in whether a Root Cause Analysis (RCA) is mandated. The decision logic lives in
 * exactly one SQL place (`app.compute_sentinel_determination` + the `confirm_triage`
 * /`triage_disposition` RPCs); the frontend mirrors `deriveVerdict` for live UX
 * using the ordered metadata exported here. The SQL is the authority.
 *
 * Stable ASCII union slugs are storage/logic values; all user-facing strings are
 * pt-BR, resolved via the label maps below (Rule 10).
 */

// ---------------------------------------------------------------------------
// Domain unions — the FIXED vocabulary (ASCII storage values; pt-BR via labels)
// ---------------------------------------------------------------------------

/**
 * The reach-and-harm spectrum (Joint Commission, `README_triage §1.2`). FIXED
 * CHECK enum (5 levels) — NOT configurable. `unsafe`/`near_miss` did not reach
 * the patient; `no_harm`/`adverse`/`sentinel` reached the patient. Drives the
 * cross-field rules + the sentinel determination.
 */
export type TriageReach =
  | 'unsafe'
  | 'near_miss'
  | 'no_harm'
  | 'adverse'
  | 'sentinel'

/**
 * The NCC-MERP / JC harm-severity scale (`README_triage §1.3`). FIXED CHECK enum
 * (6 tiers) — NOT configurable. `severe`/`permanent`/`death` are the "sentinel
 * tier" that can elevate an adverse event to sentinel.
 */
export type HarmSeverity =
  | 'none'
  | 'mild'
  | 'moderate'
  | 'severe'
  | 'permanent'
  | 'death'

/**
 * The not-a-PSE closure reason (`README_triage §1.5`). Recorded when `isPse =
 * false`; the event routes to `closed`. A bounded enum (audit-safe — it IS
 * carried in the triage audit allow-list, unlike the free-text disposition notes).
 */
export type PseClosureReason =
  | 'natural'
  | 'expected'
  | 'nonclinical'
  | 'duplicate'

/**
 * The disposition / review pathway. `rca` is MANDATORY (non-overridable) when the
 * event is sentinel-determined; for a non-sentinel PSE the NSP freely chooses one
 * of the lighter pathways. `tracking_only` = monitor with no formal review.
 */
export type ReviewPathway =
  | 'rca'
  | 'peer_review'
  | 'mm'
  | 'fmea'
  | 'tracking_only'

/**
 * The derived verdict (mirror of `README_triage §6 deriveVerdict`). `pending`
 * until the steps are complete; `closed` for a non-PSE; `rca` when sentinel;
 * `review` for a non-sentinel PSE. The SQL `triage_disposition` RPC is the
 * authority; the frontend mirrors it for the live disposition rail.
 */
export type TriageVerdict = 'pending' | 'closed' | 'rca' | 'review'

// ---------------------------------------------------------------------------
// pt-BR display labels (Rule 10) — UI maps the ASCII slug → label
// ---------------------------------------------------------------------------

/** pt-BR labels for the reach-spectrum stops. */
export const REACH_LABELS: Record<TriageReach, string> = {
  unsafe: 'Condição insegura',
  near_miss: 'Quase-erro (near miss)',
  no_harm: 'Evento sem dano',
  adverse: 'Evento adverso',
  sentinel: 'Evento sentinela',
}

/** pt-BR labels for the harm-severity tiers. */
export const HARM_SEVERITY_LABELS: Record<HarmSeverity, string> = {
  none: 'Sem dano',
  mild: 'Dano temporário leve',
  moderate: 'Dano temporário moderado',
  severe: 'Dano temporário grave',
  permanent: 'Dano permanente',
  death: 'Óbito',
}

/** pt-BR labels for the not-a-PSE closure reasons. */
export const PSE_CLOSURE_REASON_LABELS: Record<PseClosureReason, string> = {
  natural: 'Curso natural da doença',
  expected: 'Complicação conhecida / esperada',
  nonclinical: 'Questão não clínica',
  duplicate: 'Notificação duplicada',
}

/** pt-BR labels for the review pathway. */
export const REVIEW_PATHWAY_LABELS: Record<ReviewPathway, string> = {
  rca: 'Análise de causa raiz (RCA)',
  peer_review: 'Revisão por pares',
  mm: 'Sessão de morbimortalidade',
  fmea: 'FMEA (análise prospectiva)',
  tracking_only: 'Apenas monitoramento',
}

/** pt-BR labels for the derived verdict (disposition rail headline). */
export const TRIAGE_VERDICT_LABELS: Record<TriageVerdict, string> = {
  pending: 'Triagem pendente',
  closed: 'Encerrar — não é evento de segurança',
  rca: 'RCA obrigatória',
  review: 'Revisão pelo comitê de origem',
}

// ---------------------------------------------------------------------------
// Ordered spectrum / scale metadata — the SHARED source the frontend mirror reads
// ---------------------------------------------------------------------------
// `reached`/`harmful` (reach) and `severe` (harm) are the exact predicates the SQL
// `app.compute_sentinel_determination` evaluates; the frontend's `deriveVerdict`
// reads these so the two sides cannot drift. Order matches the spectrum/scale.

/** Per-reach metadata (spectrum position + the gating predicates). */
export const REACH_META: Record<
  TriageReach,
  { level: number; reached: boolean; harmful: boolean }
> = {
  unsafe: { level: 0, reached: false, harmful: false },
  near_miss: { level: 1, reached: false, harmful: false },
  no_harm: { level: 2, reached: true, harmful: false },
  adverse: { level: 3, reached: true, harmful: true },
  sentinel: { level: 4, reached: true, harmful: true },
}

/** Per-harm metadata (scale tier + the "sentinel tier" predicate). */
export const HARM_META: Record<HarmSeverity, { tier: number; severe: boolean }> = {
  none: { tier: 0, severe: false },
  mild: { tier: 1, severe: false },
  moderate: { tier: 2, severe: false },
  severe: { tier: 3, severe: true },
  permanent: { tier: 4, severe: true },
  death: { tier: 5, severe: true },
}

/** Ordered reach stops for rendering the spectrum left→right. */
export const REACH_ORDER: TriageReach[] = [
  'unsafe',
  'near_miss',
  'no_harm',
  'adverse',
  'sentinel',
]

/** Ordered harm tiers for rendering the scale. */
export const HARM_ORDER: HarmSeverity[] = [
  'none',
  'mild',
  'moderate',
  'severe',
  'permanent',
  'death',
]

// ---------------------------------------------------------------------------
// Domain types — the triage worksheet / config-vocab / disposition contract
// ---------------------------------------------------------------------------

/**
 * The 1:1 triage worksheet for one event. All clinical free text (`dispositionNotesMd`)
 * is sanitized Markdown (Rule 7) and is NEVER copied into the audit log (Rule 11).
 * `null` fields are "not yet decided". `sentinelDetermination` is auto-computed by
 * the SQL (general-criteria path OR any designated-category flag) — the UI does not
 * set it directly.
 */
export interface Triage {
  eventId: string
  /** Step 1 gate: is this a patient-safety event? `null` until answered. */
  isPse: boolean | null
  /** The closure reason when `isPse = false`; `null` otherwise. */
  pseClosureReason: PseClosureReason | null
  /** Step 2: the reach-and-harm spectrum position. */
  reach: TriageReach | null
  /** Step 3: harm severity (forced `none` for a non-harmful reach). */
  harmSeverity: HarmSeverity | null
  /** Step 4: related to the natural course of illness? Drives the general-criteria
   * sentinel path (`naturalCourse === false` is one of the three criteria). */
  naturalCourse: boolean | null
  /** Auto-computed (read-only to the UI): meets sentinel criteria. */
  sentinelDetermination: boolean
  /** The chosen disposition pathway (forced `rca` when sentinel). */
  reviewPathway: ReviewPathway | null
  /** Sanitized-Markdown disposition notes (clinical free text; never audited). */
  dispositionNotesMd: string | null
  /** The designated-category flags chosen on the sentinel screen (the permanent
   * record — each carries a snapshot of the criterion at flag time). */
  sentinelFlags: TriageSentinelFlag[]
  triagedAt: string | null
  triagedByName: string | null
  updatedAt: string
}

/**
 * One flagged sentinel criterion on a triage worksheet (the permanent record).
 * The `criterionKey`/`criterionLabel` are SNAPSHOTTED at flag time so the record
 * stays "viewable forever" even if the configurable criterion is later renamed or
 * archived.
 */
export interface TriageSentinelFlag {
  criterionId: string
  criterionKey: string
  criterionLabel: string
}

/**
 * A configurable always-review sentinel criterion (`pqs_sentinel_criteria`). JC
 * "designated category" defaults are seeded; the NSP may add/rename/archive.
 * Selecting any active criterion on the worksheet auto-qualifies the event as
 * sentinel regardless of harm tier.
 */
export interface SentinelCriterion {
  id: string
  key: string
  label: string
  description: string | null
  position: number
  isActive: boolean
}

/**
 * A configurable event-type vocabulary entry (`pqs_event_types`). NSP/WHO defaults
 * are seeded; reporter-supplied at intake (`patient_safety_event.event_type_id`)
 * and refined by the NSP at triage. Non-PHI.
 */
export interface EventType {
  id: string
  key: string
  label: string
  description: string | null
  position: number
  isActive: boolean
}

/**
 * The derived disposition (the SQL `triage_disposition` RPC's projection — the
 * authority the disposition rail renders). Mirrors `README_triage §6`.
 */
export interface TriageDisposition {
  eventId: string
  isPse: boolean | null
  /** `reach.reached` — did it reach the patient? */
  reached: boolean
  /** `harm.severe` — is the harm in the sentinel tier? */
  severe: boolean
  /** Meets sentinel criteria (general-criteria path OR any designated flag). */
  isSentinel: boolean
  verdict: TriageVerdict
  /** The resolved pathway (forced `rca` when sentinel; `null` while pending). */
  reviewPathway: ReviewPathway | null
  /** The 45-day (configurable) RCA due date when the verdict is `rca`; else null. */
  rcaDueDate: string | null
}

// ---------------------------------------------------------------------------
// Action input shapes (a `"use server"` module cannot export types, so the shapes
// the client binds its forms to live here; the result `ActionState` is reused from
// `@/lib/safety/types`)
// ---------------------------------------------------------------------------

/**
 * The structured triage save. The server applies the authoritative cross-field
 * rules (non-harmful reach → harm `none` + clears `naturalCourse`; sentinel reach
 * → harm floored to `severe`) and recomputes `sentinelDetermination`, so the client
 * sends its raw selections and re-reads the normalized worksheet afterwards.
 * `sentinelCriteriaIds` is the full set of designated-category flags (replace
 * semantics — the server delete-then-inserts).
 */
export interface SaveTriageInput {
  isPse: boolean | null
  pseClosureReason: PseClosureReason | null
  reach: TriageReach | null
  harmSeverity: HarmSeverity | null
  naturalCourse: boolean | null
  reviewPathway: ReviewPathway | null
  dispositionNotesMd: string | null
  /** The designated-category criterion ids flagged on the sentinel screen. */
  sentinelCriteriaIds: string[]
}

/** Create/edit payload for a configurable event type or sentinel criterion. */
export interface VocabInput {
  key: string
  label: string
  description: string | null
}

/**
 * The per-org NSP/PQS-department config (non-PHI; one row per org under NSP-per-org,
 * ADR 0042). `defaultDueDays` is the RCA window (DB column `rca_default_due_days`)
 * confirm_triage uses to mint the RCA due date; editable in the per-org NSP config
 * area via `setPqsRcaDueWindow(orgId, days)` (`@/lib/pqs/actions`).
 */
export interface PqsDepartment {
  name: string
  defaultDueDays: number
}

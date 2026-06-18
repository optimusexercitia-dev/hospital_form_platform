/**
 * Patient-safety / NSP — CLIENT-SAFE domain types + label maps (Phase 14a).
 *
 * **Purity contract (the Phase-12 `event-model.ts` discipline).** This module has
 * ZERO imports — it must remain importable from CLIENT components (the notify form,
 * the event panels, the NSP workspaces). It must NEVER import `@/lib/supabase/*`,
 * `next/headers`, `server-only`, or any data-access/action module. The server-only
 * query functions (`@/lib/queries/{safety-events,pqs}`) and the `"use server"`
 * actions (`@/lib/safety/actions`) IMPORT their types from here — so a `"use client"`
 * component that needs a type/label never transitively drags `@/lib/supabase/server`
 * (→ `next/headers`) into the client bundle. (A `"use server"` module also cannot
 * export types at all, which is the other reason the action INPUT types live here.)
 *
 * Stable ASCII union slugs are storage/logic values; all user-facing strings are
 * pt-BR, resolved via the label maps below (Rule 10).
 */

// ---------------------------------------------------------------------------
// Domain unions — the FROZEN vocabulary (ASCII storage values; pt-BR via labels)
// ---------------------------------------------------------------------------

/**
 * The patient-safety event lifecycle. Coarse 5-state machine with an explicit
 * acknowledge step and freeze-at-`triaged` (ADR 0030/0031): `reported` (a
 * committee member filed it) → `acknowledged` (the NSP took receipt) → `triaged`
 * (the triage worksheet is confirmed and FROZEN — Phase 14b) → `closed`; plus
 * `cancelled` (a wrongly-filed / duplicate event). DB-enforced by
 * `app.guard_event_status` (HC043 wrong-state).
 */
export type EventStatus =
  | 'reported'
  | 'acknowledged'
  | 'triaged'
  | 'closed'
  | 'cancelled'

/** Who currently holds an event: the central NSP, or a specific committee. */
export type OwnerKind = 'pqs' | 'commission'

/**
 * The reporter-supplied suspected harm level (a coarse first impression captured
 * at notification — NOT the structured NCC-MERP `harm_severity` the NSP assigns
 * during triage in Phase 14b). Fixed vocabulary; pt-BR via {@link SUSPECTED_HARM_LABELS}.
 */
export type SuspectedHarmLevel =
  | 'none'
  | 'mild'
  | 'moderate'
  | 'severe'
  | 'death'
  | 'unknown'

/** Patient biological sex on the isolated PHI record (minimum-necessary). */
export type PatientSex = 'female' | 'male' | 'other' | 'unknown'

// ---------------------------------------------------------------------------
// pt-BR display labels (Rule 10) — UI maps the ASCII slug → label
// ---------------------------------------------------------------------------

/** pt-BR labels for the event status chip / filter. */
export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  reported: 'Notificado',
  acknowledged: 'Reconhecido',
  triaged: 'Triado',
  closed: 'Encerrado',
  cancelled: 'Cancelado',
}

/** pt-BR labels for the suspected-harm select / chip. */
export const SUSPECTED_HARM_LABELS: Record<SuspectedHarmLevel, string> = {
  none: 'Sem dano',
  mild: 'Dano leve',
  moderate: 'Dano moderado',
  severe: 'Dano grave',
  death: 'Óbito',
  unknown: 'Não sei avaliar',
}

/** pt-BR labels for the current-owner chip. */
export const OWNER_KIND_LABELS: Record<OwnerKind, string> = {
  pqs: 'NSP',
  commission: 'Comissão',
}

/** pt-BR labels for patient sex on the PHI panel. */
export const PATIENT_SEX_LABELS: Record<PatientSex, string> = {
  female: 'Feminino',
  male: 'Masculino',
  other: 'Outro',
  unknown: 'Não informado',
}

// ---------------------------------------------------------------------------
// Domain types — the event / custody / PHI contract
// ---------------------------------------------------------------------------

/**
 * One patient-safety event as the UI consumes it. GOVERNANCE METADATA ONLY — it
 * carries NO patient identifiers (those live on the isolated {@link EventPatient}
 * loaded only via the audited `getEventPatient`). `descriptionMd` is the reporter's
 * sanitized-Markdown narrative (Rule 7); it is clinical free text and is NEVER
 * copied into the audit log (Rule 11).
 */
export interface SafetyEvent {
  id: string
  /** Per-NSP minted human code (e.g. `EV-0001`), stable for the event's life. */
  code: string
  /** The committee that filed the event (provenance — always retains read). */
  reportingCommissionId: string
  reportingCommissionName: string | null
  /** The case the event was raised from; `null` for a stand-alone event. */
  caseId: string | null
  /** The case's human number when case-linked (for the read-back / timeline UI). */
  caseNumber: number | null
  status: EventStatus
  /** Reporter's coarse first-impression severity (refined at triage in 14b). */
  suspectedHarmLevel: SuspectedHarmLevel
  /** The reporter-chosen event-type id (vocabulary configured in 14b); `null`
   * if not categorized at intake. */
  eventTypeId: string | null
  eventTypeName: string | null
  title: string
  /** Sanitized-Markdown narrative (clinical free text; never audited). */
  descriptionMd: string | null
  /** Where the event occurred (free text — e.g. "UTI Adulto, leito 3"). */
  location: string | null
  /** When the event was discovered (clinical date). */
  discoveredAt: string | null
  /** When it was reported to the NSP (defaults to now() at notification). */
  reportedAt: string
  reportedBy: string | null
  reportedByName: string | null
  /** Denormalized current custody (the head of the {@link EventCustodyEntry}
   * ledger) — drives access-follows-custody RLS + the owner chip without a join. */
  currentOwnerKind: OwnerKind
  /** The holding commission when `currentOwnerKind = 'commission'`; `null` at PQS. */
  currentOwnerCommissionId: string | null
  currentOwnerCommissionName: string | null
  acknowledgedAt: string | null
  acknowledgedByName: string | null
  closedAt: string | null
  closedByName: string | null
  /** Whether an isolated PHI record exists (so the UI shows the panel affordance)
   * WITHOUT loading any identifier — a boolean is not PHI. */
  hasPatient: boolean
  createdAt: string
}

/**
 * A condensed event row for the committee read-back list (`c/[slug]/eventos`).
 * PHI-FREE by construction — the list path never loads identifiers.
 */
export interface SafetyEventListItem {
  id: string
  code: string
  title: string
  status: EventStatus
  suspectedHarmLevel: SuspectedHarmLevel
  caseId: string | null
  caseNumber: number | null
  currentOwnerKind: OwnerKind
  reportedAt: string
}

/**
 * The isolated PHI satellite (0..1 per event). LOADED ONLY via the audited
 * `getEventPatient`; every successful load emits an `event_patient.read` audit row
 * (Rule 12). Minimum-necessary identifiers only.
 */
export interface EventPatient {
  eventId: string
  /** Patient full name (PHI). */
  name: string | null
  /** Medical record number / prontuário (PHI). */
  mrn: string | null
  /** Date of birth (PHI); the UI prefers DOB, falling back to `ageYears`. */
  dateOfBirth: string | null
  /** Age in years when DOB is unavailable/withheld (less-identifying fallback). */
  ageYears: number | null
  sex: PatientSex
  /** Admission / encounter reference in the EHR (PHI). */
  encounterRef: string | null
  /** Care unit / ward at the time of the event. */
  unit: string | null
  /** Attending physician (free text). */
  attending: string | null
  updatedAt: string
}

/**
 * One row of the append-only custody ledger (provenance + full hand-off history).
 * The current holder is the row with `heldUntil = null`. Member-readable in the
 * same access-follows-custody scope as the event; the table is append-only (no
 * UPDATE/DELETE).
 */
export interface EventCustodyEntry {
  id: string
  eventId: string
  ownerKind: OwnerKind
  /** The holding commission when `ownerKind = 'commission'`; `null` at PQS. */
  ownerCommissionId: string | null
  ownerCommissionName: string | null
  heldFrom: string
  /** `null` for the current holder; set when custody is transferred away. */
  heldUntil: string | null
  assignedByName: string | null
  /** Transfer rationale (short free text; never audited as a body). */
  note: string | null
}

/**
 * One PQS-inbox row — the triage queue item. PHI-FREE: governance metadata only
 * (code, reporting committee, suspected harm, status, dates). The patient panel is
 * loaded separately (and audited) once the analyst opens an event.
 */
export interface PqsInboxItem {
  id: string
  code: string
  title: string
  status: EventStatus
  /** Reporter's coarse first-impression severity (the queue's priority signal). */
  suspectedHarmLevel: SuspectedHarmLevel
  reportingCommissionId: string
  reportingCommissionName: string | null
  currentOwnerKind: OwnerKind
  currentOwnerCommissionId: string | null
  caseId: string | null
  caseNumber: number | null
  reportedAt: string
  acknowledgedAt: string | null
}

/**
 * Filters for the NSP inbox. All optional. `status` defaults (impl) to the open
 * set (`reported`/`acknowledged`); `suspectedHarmLevel` and `reportingCommissionId`
 * narrow the queue. The inbox is PHI-free, so there is no patient-identifier filter.
 */
export interface PqsInboxFilters {
  status?: EventStatus
  suspectedHarmLevel?: SuspectedHarmLevel
  reportingCommissionId?: string
}

// ---------------------------------------------------------------------------
// Action result + input shapes (a `"use server"` module cannot export types, so
// the shapes the client binds its forms to + the result states live here)
// ---------------------------------------------------------------------------

/** The shared `useActionState`-shaped result for every safety mutation. */
export interface ActionState {
  ok: boolean
  error?: string
  /** A pt-BR success confirmation on the `ok: true` path. Kept SEPARATE from
   * `error` so success text never overloads the semantically-error field (QA N1/I2);
   * consumers read `error` only when `!ok` and `message` only when `ok`. */
  message?: string
  fieldErrors?: Record<string, string>
}

/** A notify action that returns the new event's id (+ code) on success. */
export interface NotifyEventState extends ActionState {
  eventId?: string
  /** The per-NSP minted code (e.g. `EV-0001`) for the success toast. */
  code?: string
}

/** Fields accepted when a committee notifies the NSP of an event. */
export interface NotifyEventInput {
  /** The reporting commission (the actor must be a member — RPC-enforced). */
  reportingCommissionId: string
  /** Optional case the event was raised from; `null` for a stand-alone event. */
  caseId: string | null
  title: string
  /** Sanitized-Markdown narrative (Rule 7); clinical free text — never audited. */
  descriptionMd: string | null
  /** Reporter's coarse first-impression severity (refined at triage in 14b). */
  suspectedHarmLevel: SuspectedHarmLevel
  /** Reporter-chosen event-type id (vocabulary configured in 14b); `null` if
   * uncategorized at intake. */
  eventTypeId: string | null
  /** Where the event occurred (free text). */
  location: string | null
  /** When the event was discovered (clinical date `YYYY-MM-DD`); `null` if unknown. */
  discoveredAt: string | null
}

/** Editable governance fields of an existing event (NOT status — that flows
 * through the lifecycle RPCs; NOT PHI — that is {@link SetEventPatientInput}). */
export interface UpdateEventInput {
  title: string
  descriptionMd: string | null
  suspectedHarmLevel: SuspectedHarmLevel
  eventTypeId: string | null
  location: string | null
  discoveredAt: string | null
}

/** The isolated PHI write (Rule 12). Minimum-necessary identifiers; the form
 * collects only what the clinical analysis needs. */
export interface SetEventPatientInput {
  name: string | null
  mrn: string | null
  /** `YYYY-MM-DD`; prefer DOB, fall back to {@link ageYears}. */
  dateOfBirth: string | null
  ageYears: number | null
  sex: PatientSex
  encounterRef: string | null
  unit: string | null
  attending: string | null
}

/** The custody-transfer destination. `commission` requires `commissionId`. */
export interface TransferCustodyInput {
  toOwnerKind: OwnerKind
  /** The receiving commission when `toOwnerKind = 'commission'`; ignored at PQS. */
  commissionId: string | null
  /** Short transfer rationale (free text; stored on the ledger row). */
  note: string | null
}

/**
 * Patient-safety event data-access (Phase 14a — NSP Foundation, Event Intake &
 * Hand-off; Architecture Rule 9 — all reads go through `src/lib/queries/`;
 * Rule 12 — PHI/HIPAA handling). Backs the committee-side reporting + read-back
 * (`c/[slug]/eventos`, the case-detail "Notificar evento ao NSP" entry, the
 * Phase-12 case timeline) and feeds the PQS inbox/triage workspaces under
 * `/admin/nsp`.
 *
 * The domain TYPES below are the FROZEN contract the frontend builds against
 * (mirroring how meetings/interviews froze their contract types). The reads compose
 * the RLS-scoped cookie client; the new tables' shapes are mapped explicitly (the
 * generated row types live in `@/lib/types/database` post-B4).
 *
 * RLS (the security boundary — Rule 1 + Rule 12, access-follows-custody):
 *  - `patient_safety_event` + `event_custody` member-READ = the CURRENT custodian
 *    commission OR the `reporting_commission_id` (provenance) OR PQS/admin. A
 *    foreign committee that neither holds nor reported the event reads NOTHING, so
 *    these list/detail reads go through the ordinary RLS-scoped cookie client (an
 *    unauthorized caller simply gets an empty result).
 *  - `event_patient` (ISOLATED PHI, 0..1) carries the SAME scope but its READ is
 *    AUDITED: {@link getEventPatient} emits an explicit `event_patient.read`
 *    audit row (Rule 11/12 — HIPAA requires logging PHI access). PHI is NEVER
 *    selected on the queue/list/aggregate paths (minimum-necessary) — only the
 *    dedicated, audited panel read loads it.
 */

import { createClient } from '@/lib/supabase/server'
import { logAuditAccess } from '@/lib/audit/access'
import type {
  EventStatus,
  EventCustodyEntry,
  EventPatient,
  OwnerKind,
  PatientSex,
  SafetyEvent,
  SafetyEventListItem,
  SuspectedHarmLevel,
} from '@/lib/safety/types'

// The CLIENT-SAFE domain types + label maps live in `@/lib/safety/types` (ZERO
// imports — Phase-12 `event-model.ts` discipline) so a `"use client"` component can
// import them WITHOUT dragging this server-only module (→ `@/lib/supabase/server` →
// `next/headers`) into the client bundle (P14a-002). Re-exported here so existing
// `import … from '@/lib/queries/safety-events'` consumers keep resolving unchanged.
export type {
  EventStatus,
  EventCustodyEntry,
  EventPatient,
  OwnerKind,
  PatientSex,
  SafetyEvent,
  SafetyEventListItem,
  SuspectedHarmLevel,
} from '@/lib/safety/types'
export {
  EVENT_STATUS_LABELS,
  SUSPECTED_HARM_LABELS,
  OWNER_KIND_LABELS,
  PATIENT_SEX_LABELS,
} from '@/lib/safety/types'

// ---------------------------------------------------------------------------
// Row shapes (PostgREST embeds) + mappers — PHI-FREE on the governance reads
// ---------------------------------------------------------------------------

interface EventListRow {
  id: string
  code: string
  title: string
  status: string
  suspected_harm_level: string
  case_id: string | null
  current_owner_kind: string
  reported_at: string
  cases: { case_number: number } | null
}

interface SafetyEventRow {
  id: string
  code: string
  reporting_commission_id: string
  case_id: string | null
  status: string
  suspected_harm_level: string
  event_type_id: string | null
  title: string
  description_md: string | null
  location: string | null
  discovered_at: string | null
  reported_at: string
  reported_by: string | null
  current_owner_kind: string
  current_owner_commission_id: string | null
  acknowledged_at: string | null
  closed_at: string | null
  created_at: string
  reporting_commission: { name: string } | null
  owner_commission: { name: string } | null
  reporter: { full_name: string | null } | null
  acknowledger: { full_name: string | null } | null
  closer: { full_name: string | null } | null
  cases: { case_number: number } | null
  // A 0..1 embed used ONLY to derive `hasPatient` — selects NO identifier column.
  // PostgREST returns this one-to-one embed as a single OBJECT (not an array)
  // because `event_id` is both PK and FK on event_patient (P14a-003).
  event_patient: { event_id: string } | null
}

interface EventCustodyRow {
  id: string
  event_id: string
  owner_kind: string
  owner_commission_id: string | null
  held_from: string
  held_until: string | null
  note: string | null
  owner_commission: { name: string } | null
  assigner: { full_name: string | null } | null
}

interface EventPatientRow {
  event_id: string
  name: string | null
  mrn: string | null
  date_of_birth: string | null
  age_years: number | null
  sex: string
  encounter_ref: string | null
  unit: string | null
  attending: string | null
  updated_at: string
}

/** Governance-only event select (NO identifier column; `event_patient(event_id)`
 * derives `hasPatient` without loading any PHI). */
const SAFETY_EVENT_SELECT =
  'id, code, reporting_commission_id, case_id, status, suspected_harm_level, ' +
  'event_type_id, title, description_md, location, discovered_at, reported_at, ' +
  'reported_by, current_owner_kind, current_owner_commission_id, acknowledged_at, ' +
  'closed_at, created_at, ' +
  'reporting_commission:reporting_commission_id(name), ' +
  'owner_commission:current_owner_commission_id(name), ' +
  'reporter:reported_by(full_name), ' +
  'acknowledger:acknowledged_by(full_name), ' +
  'closer:closed_by(full_name), ' +
  'cases:case_id(case_number), ' +
  'event_patient(event_id)'

function mapSafetyEvent(r: SafetyEventRow): SafetyEvent {
  return {
    id: r.id,
    code: r.code,
    reportingCommissionId: r.reporting_commission_id,
    reportingCommissionName: r.reporting_commission?.name ?? null,
    caseId: r.case_id,
    caseNumber: r.cases?.case_number ?? null,
    status: r.status as EventStatus,
    suspectedHarmLevel: r.suspected_harm_level as SuspectedHarmLevel,
    eventTypeId: r.event_type_id,
    // The 14b vocab table doesn't exist yet; the name resolves once that lands.
    eventTypeName: null,
    title: r.title,
    descriptionMd: r.description_md,
    location: r.location,
    discoveredAt: r.discovered_at,
    reportedAt: r.reported_at,
    reportedBy: r.reported_by,
    reportedByName: r.reporter?.full_name ?? null,
    currentOwnerKind: r.current_owner_kind as OwnerKind,
    currentOwnerCommissionId: r.current_owner_commission_id,
    currentOwnerCommissionName: r.owner_commission?.name ?? null,
    acknowledgedAt: r.acknowledged_at,
    acknowledgedByName: r.acknowledger?.full_name ?? null,
    closedAt: r.closed_at,
    closedByName: r.closer?.full_name ?? null,
    hasPatient: r.event_patient != null,
    createdAt: r.created_at,
  }
}

// ---------------------------------------------------------------------------
// Queries — list/detail are RLS-scoped (cookie client); the PHI read is audited
// ---------------------------------------------------------------------------

/**
 * The committee read-back list: events this commission reported OR currently
 * holds, newest-first. RLS-scoped — a foreign committee gets `[]`. PHI-free.
 */
export async function listCommissionEvents(
  commissionId: string,
): Promise<SafetyEventListItem[]> {
  const supabase = await createClient()
  // RLS already scopes to the access-follows-custody set; we additionally bound the
  // committee read-back to events this commission reported OR currently holds.
  const { data } = await supabase
    .from('patient_safety_event')
    .select(
      'id, code, title, status, suspected_harm_level, case_id, ' +
        'current_owner_kind, reported_at, cases:case_id(case_number)',
    )
    .or(
      `reporting_commission_id.eq.${commissionId},current_owner_commission_id.eq.${commissionId}`,
    )
    .order('reported_at', { ascending: false })
    .returns<EventListRow[]>()

  return (data ?? []).map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    status: r.status as EventStatus,
    suspectedHarmLevel: r.suspected_harm_level as SuspectedHarmLevel,
    caseId: r.case_id,
    caseNumber: r.cases?.case_number ?? null,
    currentOwnerKind: r.current_owner_kind as OwnerKind,
    reportedAt: r.reported_at,
  }))
}

/**
 * One event's governance metadata (no PHI). Returns `null` when the event does
 * not exist or the caller is outside the access-follows-custody scope.
 */
export async function getSafetyEvent(eventId: string): Promise<SafetyEvent | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('patient_safety_event')
    .select(SAFETY_EVENT_SELECT)
    .eq('id', eventId)
    .maybeSingle()
    .returns<SafetyEventRow | null>()

  return data ? mapSafetyEvent(data) : null
}

/**
 * The append-only custody ledger for one event, oldest-first (the hand-off
 * timeline). RLS-scoped to the event's access scope; `[]` when out of scope.
 */
export async function getEventCustody(
  eventId: string,
): Promise<EventCustodyEntry[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('event_custody')
    .select(
      'id, event_id, owner_kind, owner_commission_id, held_from, held_until, note, ' +
        'owner_commission:owner_commission_id(name), assigner:assigned_by(full_name)',
    )
    .eq('event_id', eventId)
    .order('held_from', { ascending: true })
    .returns<EventCustodyRow[]>()

  return (data ?? []).map((r) => ({
    id: r.id,
    eventId: r.event_id,
    ownerKind: r.owner_kind as OwnerKind,
    ownerCommissionId: r.owner_commission_id,
    ownerCommissionName: r.owner_commission?.name ?? null,
    heldFrom: r.held_from,
    heldUntil: r.held_until,
    assignedByName: r.assigner?.full_name ?? null,
    note: r.note,
  }))
}

/**
 * The isolated PHI panel for one event — THE AUDITED READ. On a successful load
 * this emits an explicit `event_patient.read` audit row attributing the caller
 * (Rule 12). Returns `null` when no PHI record exists OR the caller is out of
 * scope (in which case NO audit row is written — there was nothing read). NEVER
 * call this from a list/queue/aggregate path; use {@link SafetyEvent.hasPatient}
 * to gate the affordance.
 */
export async function getEventPatient(
  eventId: string,
): Promise<EventPatient | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('event_patient')
    .select(
      'event_id, name, mrn, date_of_birth, age_years, sex, encounter_ref, unit, ' +
        'attending, updated_at',
    )
    .eq('event_id', eventId)
    .maybeSingle()
    .returns<EventPatientRow | null>()

  // No row (or RLS-denied): nothing was actually read → write NO audit row.
  if (!data) return null

  // HIPAA: a successful PHI load MUST emit an explicit `.read` audit row (Rule 12).
  // Resolve the event's commission for the (commission-scoped) audit row; the audit
  // metadata stays identifier-free (we pass none). Best-effort — never block the read.
  const { data: ownerRow } = await supabase
    .from('patient_safety_event')
    .select('reporting_commission_id')
    .eq('id', eventId)
    .maybeSingle()
    .returns<{ reporting_commission_id: string } | null>()

  if (ownerRow) {
    await logAuditAccess({
      action: 'event_patient.read',
      entityType: 'event_patient',
      entityId: eventId,
      commissionId: ownerRow.reporting_commission_id,
      summary: 'Dados do paciente do evento visualizados',
    })
  }

  return {
    eventId: data.event_id,
    name: data.name,
    mrn: data.mrn,
    dateOfBirth: data.date_of_birth,
    ageYears: data.age_years,
    sex: data.sex as PatientSex,
    encounterRef: data.encounter_ref,
    unit: data.unit,
    attending: data.attending,
    updatedAt: data.updated_at,
  }
}

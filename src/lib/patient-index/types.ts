/**
 * Patient Identity & Cross-Committee Linkage — CLIENT-SAFE domain types + label
 * maps (Phase 23 — `patient_index`; ADR 0039).
 *
 * **Purity contract (the Phase-22 `referrals/types.ts` / Phase-14 `safety/types.ts`
 * discipline).** This module has ZERO imports — it MUST remain importable from
 * CLIENT components (the QPS search form, the trajectory table, the access-audit
 * table, the referral receiver-hint panel). It must NEVER import
 * `@/lib/supabase/*`, `next/headers`, `server-only`, or any data-access/action
 * module. The server-only query functions (`@/lib/queries/patient-index`) and the
 * `"use server"` action (`@/lib/patient-index/actions`) IMPORT their types from
 * here — so a `"use client"` component that needs a type/label never transitively
 * drags `@/lib/supabase/server` (→ `next/headers`) into the client bundle. (A
 * `"use server"` module also cannot export types at all, which is the other reason
 * the action INPUT/RESULT types live here.)
 *
 * **The privacy model this layer enforces (ADR 0039; Rule 12).** The raw MRN /
 * prontuário and encounter / atendimento NEVER leave their locked per-committee
 * PHI tables (`event_patient` / `referral_patient` / `case_patient`). Only a
 * NON-REVERSIBLE keyed-hash (`patient_key` / `encounter_key`, HMAC-SHA256 under a
 * deployment pepper) crosses committee lines, lives in the key-only
 * `patient_xref`, and may appear (TRUNCATED) in the audit log. Only QPS
 * (`app.is_pqs_member`) can reassemble the cross-committee trajectory, and every
 * lookup is audited on the GLOBAL chain. **Consequently every type in this file is
 * PHI-FREE BY CONSTRUCTION** — entity codes/numbers, commission names, dates, and
 * booleans only. No `name`, no `mrn`, no `encounterRef`, no `dateOfBirth` is ever
 * shaped here; the patient identifiers stay behind the existing audited per-module
 * doors (`getCasePatient` / `getEventPatient` / `getReferralPatient`).
 *
 * Stable ASCII union values are storage/logic values; the `module` slug is stored
 * verbatim in `patient_xref.module`. All user-facing strings are pt-BR, resolved
 * via the label maps below (Rule 10).
 */

// ---------------------------------------------------------------------------
// Domain unions — the FROZEN vocabulary (stored slugs; pt-BR via labels)
// ---------------------------------------------------------------------------

/**
 * Which PHI module an xref / trajectory entry originates from. Stored verbatim in
 * `patient_xref.module` (CHECK in ('event','referral','case')). Each value maps to
 * exactly one isolated PHI table + its audited identifier door:
 *   - `event`    → `event_patient`     (NSP patient-safety event)
 *   - `referral` → `referral_patient`  (inter-committee referral)
 *   - `case`     → `case_patient`      (cases module)
 */
export type PatientXrefModule = 'event' | 'referral' | 'case'

/**
 * Which identifier a QPS search matched on. A search may supply an MRN, an
 * encounter number, or both; the result reports which key(s) produced the hits so
 * the UI can caption the trajectory ("por prontuário" / "por atendimento").
 * `both` = the same trajectory was reached via both keys.
 */
export type PatientMatchBasis = 'patient' | 'encounter' | 'both'

// ---------------------------------------------------------------------------
// pt-BR display labels (Rule 10) — UI maps the stored slug → label
// ---------------------------------------------------------------------------

/** pt-BR labels for the originating module chip on a trajectory row. */
export const PATIENT_XREF_MODULE_LABELS: Record<PatientXrefModule, string> = {
  event: 'Evento de segurança',
  referral: 'Encaminhamento',
  case: 'Caso',
}

/**
 * Module → design-token name (Rule 10). The UI resolves a chip/badge variant from
 * this map rather than hard-coding a colour per module, keeping the "Clinical
 * Calm" palette centralized. Values are token keys the frontend maps to its
 * `Badge` variants — NOT raw colours.
 */
export const PATIENT_XREF_MODULE_TOKENS: Record<PatientXrefModule, string> = {
  event: 'warning',
  referral: 'info',
  case: 'accent',
}

/** pt-BR labels for which identifier a search matched on. */
export const PATIENT_MATCH_BASIS_LABELS: Record<PatientMatchBasis, string> = {
  patient: 'Prontuário',
  encounter: 'Atendimento',
  both: 'Prontuário e atendimento',
}

// ---------------------------------------------------------------------------
// Domain types — the trajectory / search-result / access-audit contract
// ---------------------------------------------------------------------------

/**
 * One entity on a patient's cross-committee trajectory — a single
 * case / safety-event / referral that touched the patient (or the encounter)
 * across ALL committees. PHI-FREE by construction (ADR 0039): the human entity
 * code/number, the owning commission's NAME, lifecycle dates, and the disposed
 * flag — never a patient identifier. Assembled by `search_patient_xref` from the
 * key-only `patient_xref` joined to each module's governance skeleton.
 *
 * The `entityId` is the module-native id (case_id / event_id / referral_id) so the
 * QPS view can deep-link to that record's existing detail page, where opening the
 * identifiers still funnels through that module's AUDITED door
 * (`*_patient.read`) — this view never reveals PHI itself.
 */
export interface TrajectoryEntry {
  /** Which PHI module this entry came from (drives the module chip + deep-link). */
  module: PatientXrefModule
  /** The module-native entity id (case/event/referral) — for the deep-link only. */
  entityId: string
  /**
   * The stable human code/number for the entity, PHI-FREE:
   *   - `event`    → `EV-NNNN` (patient_safety_event.code)
   *   - `referral` → `ENC-NNNN` (case_referral.code)
   *   - `case`     → the per-commission case number rendered as text (e.g. "Caso 12")
   * Resolved server-side; the UI shows it verbatim.
   */
  entityCode: string
  /** The owning/attributing commission id (for grouping/filtering). */
  commissionId: string
  /** The owning/attributing commission NAME (PHI-free governance metadata). */
  commissionName: string | null
  /** Which key(s) on this xref row matched the search (caption only). */
  matchedOn: PatientMatchBasis
  /**
   * Whether this entity's PHI has been DISPOSED (LGPD Art. 18). The xref row is
   * RETAINED (the keys are non-identifying) and stamped `disposed_at`, so the
   * trajectory still shows the patient touched this entity — but the UI renders a
   * "PHI descartado" badge and the per-module identifier door now returns nothing.
   */
  disposed: boolean
  /** When the PHI was disposed (`null` unless `disposed`); PHI-free stamp. */
  disposedAt: string | null
  /** When this xref entry was first created (the linkage timestamp). */
  createdAt: string
}

/**
 * The full result of a QPS cross-committee patient search
 * ({@link import('@/lib/queries/patient-index').searchPatient}). PHI-FREE.
 * Returned ONLY to a PQS member; a non-PQS caller (incl. a non-PQS platform
 * admin) gets `null` (duty separation, ADR 0030/0039). A zero-match search
 * returns an empty {@link entries} and emits NO audit row (the audit fires only on
 * matches ≥ 1, ADR 0039).
 */
export interface PatientSearchResult {
  /** Which key(s) the supplied MRN/encounter resolved to overall. */
  matchedOn: PatientMatchBasis
  /** The number of distinct entities the patient/encounter touches (== entries.length). */
  matchCount: number
  /** The cross-committee trajectory, newest-first. Empty on a zero-match search. */
  entries: TrajectoryEntry[]
}

/**
 * One patient-scoped ACCESS-AUDIT row
 * ({@link import('@/lib/queries/patient-index').getPatientAccessAudit}) — WHO read
 * (or disposed) this patient's PHI, across all committees, drawn from the
 * `audit_log` for every entity sharing the patient's `patient_key`. PHI-FREE: the
 * actor, the action verb, the entity reference, and the timestamp — never the
 * clinical payload (Rule 11). The DEFINER door bypasses per-commission audit RLS
 * BY DESIGN (a QPS-only cross-committee view) and selects non-PHI columns only;
 * reading the audit is NOT itself re-audited.
 */
export interface PatientAccessAuditRow {
  /** The `audit_log` row id (stable key for the table). */
  id: string
  /** When the access/mutation occurred. */
  occurredAt: string
  /** The actor's user id (`null` for a system action). */
  actorId: string | null
  /** The actor's display name, resolved PHI-free (`null` if unavailable/system). */
  actorName: string | null
  /** The audit action verb (e.g. `event_patient.read`, `case_patient.disposed`). */
  action: string
  /** The entity type the action targeted (`event_patient` / `referral_patient` / …). */
  entityType: string
  /** The entity id the action targeted (deep-link target; PHI-free). */
  entityId: string | null
  /** The attributing commission id (`null` for a global-chain row). */
  commissionId: string | null
  /** The attributing commission NAME, resolved PHI-free (`null` if global/unknown). */
  commissionName: string | null
}

// ---------------------------------------------------------------------------
// Action result + input shapes (a `"use server"` module cannot export types, so
// the shapes the client binds its form to + the result state live here)
// ---------------------------------------------------------------------------

/**
 * Fields the QPS search form binds to. At least one of `mrn` / `encounter` must be
 * non-blank (the action enforces it). The raw values are sent to a `"use server"`
 * action and hashed SERVER-SIDE inside the DEFINER RPC — they are never persisted,
 * never logged raw, and never round-trip back to the client (the result is
 * PHI-free). Keeping the form behind a server action also keeps the MRN off the
 * client JS bundle.
 */
export interface PatientSearchInput {
  /**
   * The organization whose QPS console this search runs in (NSP-per-org, ADR 0042).
   * The search is gated on enrollment in THIS org's PQS roster and filtered to its
   * xref rows — no accidental cross-org union for a multi-org member. Sub-phase B's
   * `/o/[org]/nsp/pacientes` page supplies it from the route segment.
   */
  orgId: string
  /** Medical record number / prontuário to match (exact, after normalization). */
  mrn: string | null
  /** Encounter / atendimento number to match (exact, after normalization). */
  encounter: string | null
}

/**
 * The `useActionState`-shaped result of the QPS search action. Mirrors the
 * referral module's `ReferralActionState`: `error` is read only when `!ok`; the
 * PHI-free {@link PatientSearchResult} rides on `result` when `ok`. A non-PQS
 * caller or a flag-off deployment returns `{ ok: false, error }` (no result).
 */
export interface PatientSearchState {
  ok: boolean
  error?: string
  /** The PHI-free trajectory result on success; absent (or empty entries) otherwise. */
  result?: PatientSearchResult
  fieldErrors?: Record<string, string>
}

/**
 * Cases — CLIENT-SAFE patient-identifier domain types + label maps (the THIRD
 * PHI module; ADR 0038; feature flag `case_patient`).
 *
 * **Purity contract (the Phase-12 `event-model.ts` / Phase-14 `safety/types.ts` /
 * Phase-22 `referrals/types.ts` discipline).** This module has ZERO imports — it
 * must remain importable from CLIENT components (the "Novo caso" PHI block, the
 * case-detail reveal panel, the coordinator edit dialog). It must NEVER import
 * `@/lib/supabase/*`, `next/headers`, `server-only`, or any data-access/action
 * module. The server-only query functions (`@/lib/queries/cases`) and the
 * `"use server"` actions (`@/lib/cases/actions`) IMPORT their types from here — so
 * a `"use client"` component that needs a type/label never transitively drags
 * `@/lib/supabase/server` (→ `next/headers`) into the client bundle. (A
 * `"use server"` module also cannot export types at all, which is the other reason
 * the action INPUT types live here.)
 *
 * Stable ASCII union slugs are storage/logic values; all user-facing strings are
 * pt-BR, resolved via the label maps below (Rule 10).
 *
 * **PHI posture (Rule 12 / ADR 0038).** Patient identifiers live ONLY on
 * {@link CasePatient}, loaded through the audited `getCasePatient` door (emits
 * `case_patient.read`). The READ scope is the BROAD `can_read_case` (assignees need
 * the MRN); WRITES are coordinators-only. Minimum-necessary identifiers only.
 */

// ---------------------------------------------------------------------------
// Domain unions — the FROZEN vocabulary (stored slugs; pt-BR via labels)
// ---------------------------------------------------------------------------

/** Patient biological sex on the isolated PHI record (minimum-necessary).
 * Mirrors `event_patient` / `referral_patient`. */
export type CasePatientSex = 'female' | 'male' | 'other' | 'unknown'

/** The CONSTRAINED PHI-disposal justification category (never free text; Rule 11
 * + LGPD Art. 18). Mirrors the `cases.phi_disposed_reason` CHECK; the UI's reason
 * select binds to these. Identical to the NSP module's `PhiDisposeReason`. */
export type PhiDisposeReason =
  | 'retention_expired'
  | 'subject_request'
  | 'entered_in_error'
  | 'duplicate'
  | 'other'

// ---------------------------------------------------------------------------
// pt-BR display labels (Rule 10) — UI maps the ASCII slug → label
// ---------------------------------------------------------------------------

/** pt-BR labels for patient sex on the case PHI panel. */
export const CASE_PATIENT_SEX_LABELS: Record<CasePatientSex, string> = {
  female: 'Feminino',
  male: 'Masculino',
  other: 'Outro',
  unknown: 'Não informado',
}

/** pt-BR labels for the PHI-disposal reason category. */
export const CASE_PHI_DISPOSE_REASON_LABELS: Record<PhiDisposeReason, string> = {
  retention_expired: 'Prazo de retenção expirado',
  subject_request: 'Solicitação do titular',
  entered_in_error: 'Registrado por engano',
  duplicate: 'Registro duplicado',
  other: 'Outro',
}

// ---------------------------------------------------------------------------
// Domain shapes
// ---------------------------------------------------------------------------

/**
 * The isolated PHI satellite (0..1 per case), modeled exactly on `EventPatient` /
 * `ReferralPatient`. LOADED ONLY via the audited {@link import('@/lib/queries/cases').getCasePatient};
 * every successful, entitled load emits a `case_patient.read` audit row (Rule 12).
 * Minimum-necessary identifiers only.
 */
export interface CasePatient {
  caseId: string
  /** Patient full name (PHI). */
  name: string | null
  /** Medical record number / prontuário (PHI). */
  mrn: string | null
  /** Date of birth (PHI); the UI prefers DOB, falling back to `ageYears`. */
  dateOfBirth: string | null
  /** Age in years when DOB is unavailable/withheld (less-identifying fallback). */
  ageYears: number | null
  sex: CasePatientSex
  /** Admission / encounter reference in the EHR (PHI). */
  encounterRef: string | null
  /** Care unit / ward at the time (free text). */
  unit: string | null
  /** Attending physician (free text). */
  attending: string | null
  updatedAt: string
}

/**
 * The isolated PHI write (Rule 12), same 9-arg shape as `SetEventPatientInput` /
 * `SetReferralPatientInput`. Minimum-necessary identifiers; entitlement is
 * coordinators-only on a `patient_enabled` case (the RPC raises 42501 / check
 * otherwise). The name-or-MRN floor is enforced in the action layer.
 */
export interface SetCasePatientInput {
  name: string | null
  mrn: string | null
  /** `YYYY-MM-DD`; prefer DOB, fall back to {@link ageYears}. */
  dateOfBirth: string | null
  ageYears: number | null
  sex: CasePatientSex
  encounterRef: string | null
  unit: string | null
  attending: string | null
}

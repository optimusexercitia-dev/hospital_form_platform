'use server'

import {
  getPatientAccessAuditForOrg,
  searchPatientForOrg,
} from '@/lib/queries/patient-index'
import type {
  PatientAccessAuditRow,
  PatientSearchInput,
  PatientSearchState,
} from '@/lib/patient-index/types'

/**
 * Patient Identity & Cross-Committee Linkage — `"use server"` actions (Phase 23 —
 * `patient_index`; ADR 0039).
 *
 * Result + input shapes live in the CLIENT-SAFE `@/lib/patient-index/types` (a
 * `"use server"` module may export only async functions, and the QPS search form
 * binds to these). This module exports ONLY the action functions below.
 *
 * Why a server action at all: it keeps the MRN/encounter SEARCH off the client JS
 * bundle and ensures the raw identifiers are hashed SERVER-SIDE inside the DEFINER
 * RPC — they are never persisted, never logged raw, and never round-trip back to
 * the client (the {@link PatientSearchState.result} is PHI-FREE by construction —
 * codes / commission names / dates only). The audit (`patient.searched`, global
 * chain, key-only metadata) fires INSIDE `search_patient_xref` on matches ≥ 1.
 *
 * Authority is the DEFINER RPC's own PQS gate (`app.is_pqs_member`) + RLS — these
 * actions add only the client-side field validation that shapes a friendly error.
 * All user-facing strings are pt-BR (CLAUDE.md Rule 10); raw Supabase/Postgres
 * errors NEVER reach the UI (§8).
 */

const MESSAGES = {
  /** At least one of MRN / encounter must be supplied. */
  identifierRequired:
    'Informe o prontuário e/ou o número de atendimento para pesquisar.',
  /** Generic fail-closed (incl. non-PQS caller, flag off, RPC error). */
  searchUnavailable:
    'Não foi possível realizar a pesquisa de paciente no momento.',
} as const

/**
 * Run a QPS cross-committee patient search. Returns a PHI-FREE
 * {@link PatientSearchState}: on success, `result` carries the trajectory (empty
 * `entries` on a zero-match); on a missing identifier, a `fieldErrors`-shaped
 * validation error; otherwise a generic pt-BR failure (a non-PQS caller / flag-off
 * deployment fails closed here, the DEFINER RPC having returned nothing).
 */
export async function searchPatientAction(
  orgId: string,
  input: PatientSearchInput,
): Promise<PatientSearchState> {
  const mrn = input.mrn?.trim() || null
  const encounter = input.encounter?.trim() || null

  if (!mrn && !encounter) {
    return {
      ok: false,
      error: MESSAGES.identifierRequired,
      fieldErrors: { mrn: MESSAGES.identifierRequired },
    }
  }

  // NSP-per-org (ADR 0042): scoped to the route's org — the DEFINER RPC gates on
  // enrollment in `orgId` + filters the trajectory to that org. A non-enrolled caller
  // (incl. a member of a DIFFERENT org passing this orgId) gets null → fail closed.
  const result = await searchPatientForOrg(orgId, mrn, encounter)
  if (!result) {
    return { ok: false, error: MESSAGES.searchUnavailable }
  }

  return { ok: true, result }
}

/**
 * On-demand patient-scoped ACCESS AUDIT for the QPS view (the page composes
 * "trajectory + access audit"). A thin `"use server"` wrapper over the server-only
 * {@link getPatientAccessAuditForOrg} query (Rule 9), so the `"use client"` audit
 * table can request it after a search. PHI-FREE; org-scoped + enrollment-gated inside
 * the DEFINER RPC (returns `[]` to a non-member). Reading the audit is not re-audited.
 */
export async function loadPatientAccessAudit(
  orgId: string,
  input: PatientSearchInput,
): Promise<PatientAccessAuditRow[]> {
  const mrn = input.mrn?.trim() || null
  const encounter = input.encounter?.trim() || null
  if (!mrn && !encounter) return []
  // NSP-per-org: org-scoped (enrollment gate + org-filtered audit rows).
  return getPatientAccessAuditForOrg(orgId, mrn, encounter)
}

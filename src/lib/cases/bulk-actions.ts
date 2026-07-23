'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/types/database'
import type { CasePatientSex, SetCasePatientInput } from '@/lib/cases/types'

/**
 * Bulk case creation ("Múltiplos casos") server action (Architecture Rules 9 & 10).
 *
 * A single JSON-shaped action (NOT FormData — up to 200 nested PHI rows) backing
 * the bulk wizard's final commit. It is a thin adapter over the `bulk_create_cases`
 * DEFINER RPC, which is the SOLE authority and the atomic (all-or-nothing) unit:
 * it deals each row's case across the chosen members, activates each first phase
 * (assigned + due-dated), optionally pre-assigns downstream phases + narratives,
 * and writes optional PHI through the audited coordinator-only single door
 * (Rule 12). See supabase/migrations/20260823000000_bulk_create_cases.sql.
 *
 * Error handling: the RPC raises already-pt-BR messages, RE-RAISED with a
 * `linha N:` prefix on the offending row. We prefer that message (so raw
 * Supabase/Postgres text never reaches the UI, CLAUDE.md §8), map the bare
 * `42501` to a clean "forbidden", and parse the `linha N:` prefix into
 * `failedRowIndex` (1-based) so the grid can jump back to the bad row.
 *
 * NOTE on reuse: `actions.ts`'s `mapCaseError` / `mapCasePatientError` /
 * `revalidateCases` are module-private SYNCHRONOUS helpers; a `'use server'` module
 * may only export async functions, so they cannot be imported across that boundary.
 * The equivalent minimal behavior is reimplemented here (the RPC's messages are
 * already user-facing pt-BR, so the mapping is thin).
 */

const CASES_LIST_PATH = '/o/[org]/c/[commission]/manage/cases'
const CASE_PATH = '/o/[org]/c/[commission]/manage/cases/[caseId]'

const GENERIC_ERROR =
  'Não foi possível criar os casos. Tente novamente.'
const FORBIDDEN_ERROR = 'Você não tem permissão para esta ação.'

export interface BulkCaseCustomFieldValue {
  key: string
  /** Coerced by the FRONTEND per field type; a `number` field stays a JSON number. */
  value: Json
}

export interface BulkCaseRow {
  /** NON-IDENTIFYING title (the UI warns it must never be the patient name). */
  label: string | null
  /** The member (auth user id) who owns the whole case; must be a commission member. */
  assignedTo: string
  customFields: BulkCaseCustomFieldValue[]
  /** Optional PHI (Rule 12) — only for PHI-collecting templates; null otherwise. */
  patient: SetCasePatientInput | null
}

export interface BulkCreateCasesInput {
  templateId: string
  /** Optional absolute deadline (`YYYY-MM-DD`); rides the FIRST phase's due_date only. */
  deadline: string | null
  phaseScope: 'first_only' | 'all_phases'
  rows: BulkCaseRow[]
}

export type BulkCreateCasesResult =
  | { ok: true; createdCount: number }
  | { ok: false; error: string; failedRowIndex?: number }

/** Validate a `YYYY-MM-DD` string is a real calendar date (or null/blank). */
function normalizeDeadline(raw: string | null): string | null | 'invalid' {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return 'invalid'
  const d = new Date(`${trimmed}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return 'invalid'
  if (d.toISOString().slice(0, 10) !== trimmed) return 'invalid'
  return trimmed
}

const VALID_SEX: readonly CasePatientSex[] = ['female', 'male', 'other', 'unknown']

/**
 * Serialize a wizard patient into the RPC's snake_case JSON shape. A patient below
 * the minimum-necessary floor (neither name nor mrn) is treated as "nothing to
 * write" -> null (matching `createCaseFromTemplate`'s dialog behavior); the RPC
 * re-enforces the floor for anything above it.
 */
function serializePatient(patient: SetCasePatientInput | null): Json | null {
  if (!patient) return null
  const name = patient.name?.trim() || null
  const mrn = patient.mrn?.trim() || null
  if (!name && !mrn) return null
  const sex: CasePatientSex = VALID_SEX.includes(patient.sex) ? patient.sex : 'unknown'
  return {
    name,
    mrn,
    date_of_birth: patient.dateOfBirth?.trim() || null,
    age_years: patient.ageYears ?? null,
    sex,
    encounter_ref: patient.encounterRef?.trim() || null,
    unit: patient.unit?.trim() || null,
    attending: patient.attending?.trim() || null,
  }
}

/** Extract the RPC's `linha N:` row index (1-based) from its message, if present. */
function parseFailedRowIndex(message: string | undefined): number | undefined {
  if (!message) return undefined
  const m = /^linha\s+(\d+)\s*:/i.exec(message.trim())
  if (!m) return undefined
  const n = Number.parseInt(m[1], 10)
  return Number.isFinite(n) ? n : undefined
}

/**
 * SQLSTATEs the RPC + its composed doors raise INTENTIONALLY, whose (row-indexed)
 * messages are user-facing pt-BR and may be surfaced verbatim. Mirrors
 * `actions.ts::mapCaseError`'s allowlist. Anything OUTSIDE this set is an
 * unexpected low-level Postgres error whose message is raw English — mapped to the
 * generic pt-BR instead (Architecture Rule 8: raw Postgres text never reaches the UI).
 */
const PT_BR_SQLSTATES = new Set<string>([
  '23514', // check_violation — scope/cap/count/template-status/PHI-floor/patient-not-enabled
  'P0002', // no_data_found — processo/caso não encontrado
  'HC017', // no published version for a phase form
  'HC018', // phase blocked (its blockers unsettled)
  'HC019', // phase not pending
  'HC020', // case not open
  'HC021', // assignee not a member
  'HC055', // narrative not in the required state
  'HC068', // required custom field missing
  'HC0F1', // case-excluded (exclusion perimeter)
])

function mapError(error: { code?: string; message?: string } | null): string {
  if (!error) return GENERIC_ERROR
  if (error.code === '42501') return FORBIDDEN_ERROR
  // Only the RPC's intentional pt-BR SQLSTATEs pass their message through; any other
  // code is unexpected raw-English Postgres → generic pt-BR (Rule 8).
  if (error.code && PT_BR_SQLSTATES.has(error.code)) {
    return error.message?.trim() || GENERIC_ERROR
  }
  return GENERIC_ERROR
}

/**
 * Create many cases from one template in a single atomic transaction, dealing them
 * across the chosen members (each first phase goes live, assigned + optionally
 * due-dated). The client computes the deal; the SERVER never randomizes — it
 * validates authority + membership and executes exactly the submitted owner map.
 * Returns the number created, or a mapped pt-BR error (+ the failing row index).
 */
export async function bulkCreateCases(
  input: BulkCreateCasesInput,
): Promise<BulkCreateCasesResult> {
  if (!input.templateId) return { ok: false, error: GENERIC_ERROR }
  if (input.phaseScope !== 'first_only' && input.phaseScope !== 'all_phases') {
    return { ok: false, error: GENERIC_ERROR }
  }
  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    return { ok: false, error: 'Informe ao menos um caso.' }
  }
  if (input.rows.length > 200) {
    return { ok: false, error: 'No máximo 200 casos por lote.' }
  }

  const deadline = normalizeDeadline(input.deadline)
  if (deadline === 'invalid') {
    return { ok: false, error: 'Data limite inválida.' }
  }

  const rows: Json = input.rows.map((row) => ({
    label: row.label?.trim() || null,
    assigned_to: row.assignedTo,
    custom_fields: (row.customFields ?? []).map((f) => ({ key: f.key, value: f.value })),
    patient: serializePatient(row.patient),
  }))

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('bulk_create_cases', {
    p_template_id: input.templateId,
    // The generated Args type non-nulls p_deadline (no SQL DEFAULT), but the `date`
    // param accepts null ("no deadline"). Cast only this field to keep full arg
    // type-checking on the rest.
    p_deadline: deadline as string,
    p_phase_scope: input.phaseScope,
    p_rows: rows,
  })

  if (error || data === null) {
    return {
      ok: false,
      error: mapError(error),
      failedRowIndex: parseFailedRowIndex(error?.message),
    }
  }

  revalidatePath(CASES_LIST_PATH, 'page')
  revalidatePath(CASE_PATH, 'page')
  return { ok: true, createdCount: data }
}

'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import type {
  CaseConfidentialityLevel,
  ConflictType,
  VisibilityPolicy,
} from '@/lib/queries/cases'

/**
 * Ethics coordinator write actions (ADR 0072 D8 · ETH·E1 + AUTHZ handoff decision 8,
 * wired in ETH·E2 BE-10).
 *
 * All five mutations are SECURITY DEFINER RPCs (never a direct table write): each REVOKEs
 * PUBLIC then GRANTs `authenticated, service_role` (t19), asserts the relevant flag, and
 * authorizes per D8 — `declareConflict` is self-service (any case reader); `recordRecusal`
 * is coordinator-or-self; `liftRecusal` / `setCaseConfidentiality` / `setCaseVisibility`
 * are coordinator-only. Once a recusal is LIVE the target IMMEDIATELY loses case-read via
 * the `can_read_case` deny-term (RLS is the boundary — Rule 1); `liftRecusal` restores it.
 *
 * Recusal/COI/confidentiality doors raise the `HC0E·` block (ADR 0072 D9); the visibility
 * door raises `HC0F5`/`HC0F6`/`HC0F1` (ADR 0078 M1·4). Raw Postgres errors never reach the
 * UI (CLAUDE.md §8) — {@link mapCoordinatorError} maps to pt-BR (preferring the RPC's own
 * message, the `mapNarrativeError` precedent). Reads live in `src/lib/queries/cases.ts`
 * (Rule 9); the ethics procedure read is `getEthicsCaseProcedure` (`src/lib/queries/ethics.ts`).
 */

// ---------------------------------------------------------------------------
// Result shapes (the shared `useActionState`-shaped contract)
// ---------------------------------------------------------------------------

/** The shared `useActionState`-shaped result for every coordinator mutation. */
export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/** A declare action that returns the new `case_conflict_declarations.id` on success. */
export interface DeclareConflictState extends ActionState {
  declarationId?: string
}

/** A recusal action that returns the new `case_recusals.id` on success. */
export interface RecordRecusalState extends ActionState {
  recusalId?: string
}

// ---------------------------------------------------------------------------
// Error mapping (pt-BR; prefer the door's own message — the mapNarrativeError idiom).
// ---------------------------------------------------------------------------

const CASE_PATH = '/o/[org]/c/[commission]/manage/cases/[caseId]'

const MESSAGES = {
  generic: 'Não foi possível concluir. Tente novamente.',
  unavailable: 'O módulo de ética não está disponível.',
  forbidden: 'Apenas a coordenação pode executar esta ação.',
} as const

function mapCoordinatorError(error: { code?: string; message?: string } | null): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    // HC0E· (ADR 0072 D9) — recusal / COI / confidentiality doors.
    case 'HC0E0': // live-recusal clash
    case 'HC0E1': // recusal missing / already lifted
    case 'HC0E2': // duplicate declaration
    case 'HC0E5': // invalid confidentiality level
      return error.message || MESSAGES.generic
    case 'HC0E4': // write-authority gate
      return error.message || MESSAGES.forbidden
    // HC0F· (ADR 0078 M1·4) — the set_case_visibility door.
    case 'HC0F5': // authority
      return error.message || MESSAGES.forbidden
    case 'HC0F6': // invalid policy
      return error.message || MESSAGES.generic
    case 'HC0F1': // the caller is excluded from the case
      return error.message || MESSAGES.forbidden
    case 'HC000': // feature flag off
      return MESSAGES.unavailable
    case '42501':
      return MESSAGES.forbidden
    default:
      return MESSAGES.generic
  }
}

function revalidateCase(): void {
  revalidatePath(CASE_PATH, 'page')
}

// ---------------------------------------------------------------------------
// Conflict-of-interest + recusal (D8)
// ---------------------------------------------------------------------------

/** Declare one's own conflict of interest on a case (`declare_conflict`; self-service).
 * Returns the new declaration id. `HC0E2` if a declaration already exists for the caller. */
export async function declareConflict(
  caseId: string,
  conflictType: ConflictType,
  descriptionMd: string,
): Promise<DeclareConflictState> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('declare_conflict', {
    p_case_id: caseId,
    p_conflict_type: conflictType,
    p_description_md: descriptionMd,
  })
  if (error) return { ok: false, error: mapCoordinatorError(error) }
  revalidateCase()
  return { ok: true, declarationId: data ?? undefined }
}

/** Record a recusal (`record_recusal`; coordinator-gated, or self with `source='self'`).
 * Inserts a LIVE `case_recusals` row (the target loses read at once); resolves a linked
 * declaration → `recused`. Returns the new recusal id. `HC0E0` on a live-recusal clash. */
export async function recordRecusal(
  caseId: string,
  userId: string,
  reasonMd: string,
  conflictDeclarationId?: string | null,
): Promise<RecordRecusalState> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('record_recusal', {
    p_case_id: caseId,
    p_user_id: userId,
    p_reason_md: reasonMd,
    p_conflict_declaration_id: conflictDeclarationId ?? undefined,
  })
  if (error) return { ok: false, error: mapCoordinatorError(error) }
  revalidateCase()
  return { ok: true, recusalId: data ?? undefined }
}

/** Soft-lift a recusal (`lift_recusal`; coordinator-gated; sets `lifted_at`). Read is
 * restored. `HC0E1` if the recusal is missing or already lifted. */
export async function liftRecusal(
  recusalId: string,
  reasonMd: string,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('lift_recusal', {
    p_recusal_id: recusalId,
    p_reason_md: reasonMd,
  })
  if (error) return { ok: false, error: mapCoordinatorError(error) }
  revalidateCase()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Case confidentiality ceiling + visibility policy (D8 + AUTHZ decision 8)
// ---------------------------------------------------------------------------

/** Raise/lower a case's confidentiality ceiling (`set_case_confidentiality`;
 * coordinator-gated; audited `case.confidentiality_changed`). `HC0E5` on an invalid
 * level. Never a direct write to `cases.confidentiality_level`. */
export async function setCaseConfidentiality(
  caseId: string,
  level: CaseConfidentialityLevel,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_case_confidentiality', {
    p_case_id: caseId,
    p_level: level,
  })
  if (error) return { ok: false, error: mapCoordinatorError(error) }
  revalidateCase()
  return { ok: true }
}

/** Change a case's access model (`set_case_visibility`; coordinator-gated; audited
 * `case.visibility_changed`). `HC0F5` (authority) / `HC0F6` (invalid policy) / `HC0F1`
 * (the caller is excluded from the case). The 5th coordinator door — its live DEFINER
 * function existed since ADR 0078 M1·4 but no app action wrapped it until BE-10. */
export async function setCaseVisibility(
  caseId: string,
  policy: VisibilityPolicy,
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_case_visibility', {
    p_case_id: caseId,
    p_policy: policy,
  })
  if (error) return { ok: false, error: mapCoordinatorError(error) }
  revalidateCase()
  return { ok: true }
}

// Re-export the union types the recusal/confidentiality/visibility forms bind to.
export type { CaseConfidentialityLevel, ConflictType, VisibilityPolicy }

'use server'

import type {
  CaseConfidentialityLevel,
  ConflictType,
} from '@/lib/queries/cases'

/**
 * Recusal / conflict-of-interest + case-confidentiality write authority
 * (ADR 0072 D8 · ETH·E1).
 *
 * All four mutations are SECURITY DEFINER RPCs (never a direct table write): each
 * REVOKEs PUBLIC then GRANTs `authenticated, service_role` (t19), asserts the relevant
 * flag, and authorizes per D8 — `declareConflict` is self-service (any case reader);
 * `recordRecusal` is coordinator-or-self; `liftRecusal` + `setCaseConfidentiality` are
 * coordinator-only. Once a recusal is LIVE the target IMMEDIATELY loses case-read via
 * the `can_read_case` deny-term (RLS is the boundary — Rule 1); `liftRecusal` restores
 * it. SQLSTATEs from the `HC0E·` block (D9).
 *
 * CONTRACT-FIRST STUB (BE-1): signatures are the frozen contract the E2/E3 ethics UI
 * binds to. Bodies land in BE-5. User-facing strings will be pt-BR (Rule 10); raw
 * Postgres errors never reach the UI (CLAUDE.md §8). Reads live in
 * `src/lib/queries/cases.ts` (Rule 9).
 */

// ---------------------------------------------------------------------------
// Result shapes (the shared `useActionState`-shaped contract)
// ---------------------------------------------------------------------------

/** The shared `useActionState`-shaped result for every recusal/COI mutation. */
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
// Not-implemented stub helper (BE-1). References every arg so the frozen param
// names stay lint-clean; BE-5 replaces each body with the real RPC call.
// ---------------------------------------------------------------------------

function notImplemented(fn: string, ..._args: unknown[]): never {
  throw new Error(`${fn} not implemented (ETH·E1 BE-5 — contract stub)`)
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
  return notImplemented('declareConflict', caseId, conflictType, descriptionMd)
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
  return notImplemented(
    'recordRecusal',
    caseId,
    userId,
    reasonMd,
    conflictDeclarationId,
  )
}

/** Soft-lift a recusal (`lift_recusal`; coordinator-gated; sets `lifted_at`). Read is
 * restored. `HC0E1` if the recusal is missing or already lifted. */
export async function liftRecusal(
  recusalId: string,
  reasonMd: string,
): Promise<ActionState> {
  return notImplemented('liftRecusal', recusalId, reasonMd)
}

// ---------------------------------------------------------------------------
// Case confidentiality ceiling (D8)
// ---------------------------------------------------------------------------

/** Raise/lower a case's confidentiality ceiling (`set_case_confidentiality`;
 * coordinator-gated; audited `case.confidentiality_changed`). `HC0E5` on an invalid
 * level. Never a direct write to `cases.confidentiality_level`. */
export async function setCaseConfidentiality(
  caseId: string,
  level: CaseConfidentialityLevel,
): Promise<ActionState> {
  return notImplemented('setCaseConfidentiality', caseId, level)
}

// Re-export the union types the recusal/confidentiality forms bind to.
export type { CaseConfidentialityLevel, ConflictType }

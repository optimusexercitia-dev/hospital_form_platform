/**
 * Committee Charters & Meeting Cadence (S4·CH, Phase 21) — pt-BR message catalog +
 * SQLSTATE → friendly-text mapping (Architecture Rule 9 — data access centralized;
 * user-facing text pt-BR, CLAUDE.md §8 — raw Supabase/Postgres errors NEVER reach the
 * UI).
 *
 * ============================ CONTRACT-FIRST STUB (CH-BE-1) ============================
 * Mirrors the referrals/meetings convention (`src/lib/referrals/messages.ts`,
 * `src/lib/meetings/messages.ts`): one centralized source of truth that the charter
 * data-access layer (`src/lib/queries/charters.ts`, its `upsertCharter` write) imports.
 * The `HC0xx` custom class (docs/decisions/0018-custom-sqlstate-class.md) is returned by
 * the CH RPCs; PostgREST surfaces it as a 400 + JSON `{code,message}`, so the RPC's own
 * pt-BR text is preferred, with these constants as the fallback.
 *
 * SQLSTATE allocation — the `HC0K·` family (ADR 0080 D10; reconciled from the plan's
 * original `HC0D·`, which collided with `delete_ad_hoc_case_*`; `HC0K` verified unused):
 *   HC0K0 not-staff_admin (upsert authority), HC0K1 invalid-regimento-link,
 *   HC0K2 not-a-member (cadence / carry-forward member-scope entry check).
 * The strings below are FIRST-CUT (Rule 10); the keys/structure are the frozen contract.
 * =======================================================================================
 */

/** The caller is not a `staff_admin` of the commission (upsert authority). */
export const HC_CHARTER_NOT_STAFF_ADMIN = 'HC0K0'
/** The linked controlled document is not a same-commission `doc_type='regimento'`. */
export const HC_CHARTER_INVALID_REGIMENTO_LINK = 'HC0K1'
/** The caller is not a member of the commission (cadence / carry-forward entry check). */
export const HC_CHARTER_NOT_MEMBER = 'HC0K2'

/** Generic Postgres SQLSTATEs the charter RPCs/policies may surface. */
export const PG_CHECK_VIOLATION = '23514'
export const PG_FORBIDDEN = '42501'
export const PG_NO_DATA_FOUND = 'P0002' // raised by `no_data_found` in PL/pgSQL

/** Centralized pt-BR strings for the charter actions. Keys are stable; the UI localizes
 * the union-type labels (frequency / cadence status) separately. */
export const CHARTER_MESSAGES = {
  // Authorization / availability
  forbidden: 'Você não tem permissão para esta ação.',
  unavailable: 'O recurso de regimento e cadência ainda não está disponível.',
  generic: 'Não foi possível concluir. Tente novamente.',

  // Not-found
  missingCommission: 'Comissão não encontrada.',
  missingCharter: 'Regimento não configurado para esta comissão.',

  // Validation (client-side pre-checks before the RPC)
  frequencyRequired: 'Selecione a periodicidade das reuniões.',
  frequencyInvalid: 'Periodicidade de reuniões inválida.',

  // Authority / domain (mapped from HC0K0–HC0K2)
  notStaffAdmin:
    'Apenas a coordenação da comissão pode configurar o regimento e a cadência.',
  invalidRegimentoLink:
    'O documento selecionado não é um regimento válido desta comissão.',
  notMember: 'Você não é membro desta comissão.',

  // Success
  charterSaved: 'Regimento e cadência atualizados.',
} as const

/**
 * Map a charter RPC/Postgres error to friendly pt-BR. Prefers the RPC's own `message`
 * (raised in pt-BR by the `HC0K·` RAISEs) and falls back to the catalog above; an
 * unknown code degrades to the generic message so a raw Postgres string never reaches
 * the UI. Wired into {@link import('@/lib/queries/charters').upsertCharter} at CH-BE-5.
 */
export function mapCharterError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return CHARTER_MESSAGES.generic
  switch (error.code) {
    case HC_CHARTER_NOT_STAFF_ADMIN:
      return error.message || CHARTER_MESSAGES.notStaffAdmin
    case HC_CHARTER_INVALID_REGIMENTO_LINK:
      return error.message || CHARTER_MESSAGES.invalidRegimentoLink
    case HC_CHARTER_NOT_MEMBER:
      return error.message || CHARTER_MESSAGES.notMember
    case PG_FORBIDDEN:
      return CHARTER_MESSAGES.forbidden
    case PG_NO_DATA_FOUND:
      return error.message || CHARTER_MESSAGES.missingCharter
    case PG_CHECK_VIOLATION:
      // The RPC raises shape/validation check_violations with their own distinct pt-BR
      // text; prefer it, falling back to the generic.
      return error.message || CHARTER_MESSAGES.generic
    default:
      return CHARTER_MESSAGES.generic
  }
}

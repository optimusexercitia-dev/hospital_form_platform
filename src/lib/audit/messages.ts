/**
 * Audit-trail pt-BR message catalog + SQLSTATE → friendly-text mapping
 * (Architecture Rule 9 — data access is centralized; user-facing text is pt-BR,
 * CLAUDE.md §8 — raw Supabase/Postgres errors NEVER reach the UI).
 *
 * CONVENTION NOTE (mirrors meetings/interviews): the audit feature centralizes
 * its SQLSTATE map here so every audit action/route imports one source of truth.
 *
 * IMPORTANT (Phase 13 B1 contract): `HC042` (append-only violation) is an
 * INTERNAL invariant — the `app.guard_audit_immutable` BEFORE UPDATE/DELETE
 * trigger raises it if anyone (including the service role) attempts to mutate or
 * delete an audit row. The application code NEVER issues such a write, so this
 * code path is unreachable from the UI. The constant + mapping exist only so
 * that, if a future code path ever did trip it, it degrades to a generic pt-BR
 * message instead of leaking a raw Postgres error (defense in depth).
 */

/** Audit-trail SQLSTATE allocation (the `HC0xx` class continues from `HC042`,
 * per ADR 0028 — the accreditation track starts at HC042). */
// HC042 — append-only violation (internal; never surfaced to the UI).
export const HC_AUDIT_APPEND_ONLY = 'HC042'

/** Generic Postgres SQLSTATEs the audit RPCs/policies may surface. */
export const PG_CHECK_VIOLATION = '23514'
export const PG_FORBIDDEN = '42501'
export const PG_NO_DATA_FOUND = 'P0002'

/**
 * Centralized pt-BR strings for the audit-trail UI + actions. Keys are stable;
 * the UI localizes the action/entity union labels separately (see
 * `AUDIT_ACTION_LABELS` / `AUDIT_ENTITY_LABELS` in `@/lib/queries/audit`).
 */
export const AUDIT_MESSAGES = {
  // Authorization / availability
  forbidden: 'Você não tem permissão para ver a trilha de auditoria.',
  unavailable: 'A trilha de auditoria ainda não está disponível.',
  generic: 'Não foi possível concluir. Tente novamente.',

  // Integrity verification (the "Verificar integridade" control)
  chainOk: 'Integridade verificada: a trilha está intacta.',
  chainBroken:
    'Falha de integridade detectada na trilha de auditoria. Contate o administrador.',

  // Export
  exportFailed: 'Não foi possível exportar a trilha. Tente novamente.',

  // Internal-only (append-only guard; not expected to reach the UI)
  appendOnly: 'Os registros de auditoria não podem ser alterados nem excluídos.',
} as const

/**
 * Map an audit RPC/Postgres error to friendly pt-BR. Prefers the RPC's own
 * `message` and falls back to the catalog; an unknown code degrades to the
 * generic message so a raw Postgres string never reaches the UI.
 */
export function mapAuditError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return AUDIT_MESSAGES.generic
  switch (error.code) {
    case HC_AUDIT_APPEND_ONLY:
      return AUDIT_MESSAGES.appendOnly
    case PG_FORBIDDEN:
      return AUDIT_MESSAGES.forbidden
    case PG_CHECK_VIOLATION:
      return error.message || AUDIT_MESSAGES.unavailable
    case PG_NO_DATA_FOUND:
      return error.message || AUDIT_MESSAGES.generic
    default:
      return AUDIT_MESSAGES.generic
  }
}

/**
 * Shared display helpers for the org-admin area cards (Comissões, Hospitais,
 * Administradores) — mirrors the per-feature `format.ts` convention used by
 * `src/components/cases/format.ts` and `src/components/meetings/format.ts`.
 */

/** Two-letter initials from a name; "?" when empty. */
export function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Format an ISO timestamp as a pt-BR short date, for "desde {date}" captions. */
export function formatGrantedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

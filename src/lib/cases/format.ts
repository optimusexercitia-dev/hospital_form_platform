/**
 * How a case is IDENTIFIED in text — the per-commission minted number, shown
 * zero-padded ("Caso 0042").
 *
 * ⭐ **Why this lives in `src/lib` (PDF·P3 / F4).** The printed dossier renders
 * the same identity the app renders, and `src/lib/cases/pdf-payload.ts` cannot
 * import upward from `src/components`. Before this move the dossier's running
 * header read **`Caso 1`** while every screen read **`Caso 0001`** — the same
 * case, numbered two ways, and both forms appeared on ONE page of a real PDF
 * (page 5 carried a user-authored "Entrevista sobre o Caso 0001" directly under
 * a header reading "Caso 1"). `backend` correctly refused to add another inline
 * `padStart` rather than duplicate the rule; this is the shared home instead.
 *
 * ⛔ **THIS MODULE IS NOT YET THE ONLY AUTHORITY, AND MUST NOT BE DESCRIBED AS
 * ONE.** `padStart(4, '0')` is reimplemented inline at **7+ further sites that
 * never call these functions** — `itens-de-acao/[itemId]/page.tsx`,
 * `nsp/[eventId]/page.tsx`, `action-items-table.tsx`, `interviews/format.ts`,
 * `meetings/action-item-form.tsx`. F4 made the DOSSIER agree with one of eight
 * implementations; it did not reduce the count. Tracked as
 * `FUP-CASE-NUMBER-FORMAT-HAS-EIGHT-AUTHORITIES` and deliberately out of the
 * printing phase — an eight-file sweep does not belong inside a print commit.
 *
 * ⚠ Consequently the two `padStart` calls below are **NOT** factored into a
 * shared private helper, even though they are visibly the same expression.
 * Collapsing them is that follow-up's work, done across all eight sites at once
 * with one test; doing two of them here would look like the rule had been
 * consolidated while six copies survived elsewhere — the partial fix that reads
 * as a complete one.
 *
 * **Purity.** ZERO imports, no React, no `lucide-react`, no `next/*`, no data
 * access — the same contract `./registro-kinds` advertises. Safe from a
 * `"use client"` component and from a server module alike. ⛔ Never add
 * `@/lib/supabase/*`, `server-only`, or an actions module here.
 */

/** "Caso 0042" — zero-padded to at least 4 digits, the per-commission counter. */
export function formatCaseNumber(caseNumber: number): string {
  return `Caso ${String(caseNumber).padStart(4, '0')}`
}

/**
 * The case's display heading using its case-TYPE terminology (ETH·E3a; ADR 0064
 * D4) — e.g. "Denúncia 0042" for an ethics case, "Caso 0042" for a type-less case
 * (whose `terminology.case.singular` falls back to the platform default "Caso", so
 * this is byte-for-byte {@link formatCaseNumber} there). Used ONLY on the case
 * DETAIL surface; the board keeps the type-agnostic {@link formatCaseNumber}
 * (per-card labels unaffected — plan §2.5).
 *
 * ⚠ Moved together with {@link formatCaseNumber} rather than left behind: the two
 * carry the SAME padding rule, and separating them across the layer boundary is
 * precisely the split that let the dossier and the app disagree. The dossier also
 * needs this one specifically — an ethics case must print "Denúncia 0042", not
 * "Caso 0042".
 */
export function formatCaseNumberWithTerm(
  caseTerm: string,
  caseNumber: number,
): string {
  return `${caseTerm} ${String(caseNumber).padStart(4, '0')}`
}

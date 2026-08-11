/**
 * pt-BR text primitives shared across every feature area.
 *
 * Distinct from the per-domain `format.ts` modules (`components/cases/format.ts`,
 * `components/safety/format.ts`, …): those format DOMAIN values (case numbers,
 * dates, file sizes), this holds LANGUAGE primitives that belong to no domain.
 * `plural` lived in `components/accreditation/format.ts` until FUP-P16-4, which
 * needed it from notifications, safety, documents and cases — importing an
 * accreditation module from the notification bell is the wrong dependency.
 */

/**
 * Resolve a literal pt-BR singular/plural PAIR against a count. Returns only
 * the WORD — callers place `{count}` wherever the sentence needs it, which is
 * not always immediately next to the word it agrees with (see
 * `readiness-dashboard.tsx`'s `LevelCard`: one sentence pluralizes the noun
 * against `totalStandards` and the verb+adjective against a DIFFERENT count,
 * `cleanStandards` — call `plural()` once per count, never share one call
 * across two counts).
 *
 * Deliberately NOT a pluralization ALGORITHM. pt-BR has no single suffix
 * rule — `-ão` alone splits three ways (`mão` → `mãos`, `pão` → `pães`,
 * `padrão` → `padrões`) — so a rule-based helper would produce a PLAUSIBLE
 * wrong word instead of an obviously wrong one, which is harder to catch in
 * review than a bare `+ "s"`. This function's entire value is making the
 * literal pair the ONLY way to express a plural here: there is no path back
 * to string-concatenated pluralization, which is exactly what shipped
 * BUG-P16-005 twice in one phase — `readiness-dashboard.tsx` rendered
 * "padrãoes" (`"padrão" + "es"`) and, found only by sweeping for the same
 * PATTERN rather than trusting the single reported line, `evidence-count-
 * badge.tsx` rendered "em atençãos" (`"em atenção" + "s"`) the moment more
 * than one link carried that status.
 *
 * A future author reaching for `${word}s` here has no helper to reach for
 * instead that would let them skip supplying both forms — `plural` always
 * demands the literal plural spelling at the call site, where a reviewer can
 * read it directly.
 */
export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

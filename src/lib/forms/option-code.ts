/**
 * Client-safe option/question-key code generation. Plain TS module — NO
 * 'use server' and no server-only imports (no `next/*`, no supabase server
 * client) — so it can be imported by BOTH the server actions (`actions.ts`)
 * and client components (e.g. the builder's option editor, which needs to
 * mint a real option code as soon as an option's label is typed, so a
 * choice-type default set on a brand-new item references a real code instead
 * of the placeholder `""` — see BUG-AMV2-002).
 *
 * This is the SINGLE generator for both option codes and question_key bases;
 * `actions.ts` imports it rather than redefining it, so server and client
 * never drift. Format is unchanged: `slug(label)_suffix` (or a double-suffix
 * fallback on collision) — existing pgTAP/E2E may assume this exact shape.
 */

/**
 * Derive a stable, URL-safe slug base from a question/option label.
 * question_keys are auto-generated (hidden from the user) and unique per
 * VERSION; a short random suffix (added by the caller) disambiguates
 * collisions. Empty/diacritic-only labels fall back to 'pergunta'.
 */
export function slugifyLabel(label: string): string {
  // NFD decomposes accented letters into base + combining mark; lowercasing
  // then collapsing any non-[a-z0-9] run (which includes the now-separate
  // combining marks and all punctuation/whitespace) to '_' yields an ASCII slug.
  const base = label
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return base || 'pergunta'
}

/** A short random suffix for question_key / option code disambiguation. */
export function shortSuffix(): string {
  return Math.random().toString(36).slice(2, 8)
}

/**
 * Generate a unique option code for a NEW option row of an item: `slug(label)`
 * + a short suffix, retried against the existing codes (in-memory uniqueness is
 * enough — the DB `unique(item_id, code)` is the backstop). Mirrors the
 * question_key generation (slugifyLabel + shortSuffix).
 *
 * Used server-side (`reconcileOptionRows` in `actions.ts`)
 * AND client-side (the builder's option editor, so a newly-authored option
 * row's code — and any default value referencing it — is a real code from the
 * moment the label is typed, rather than the server-only-minted placeholder).
 */
export function generateOptionCode(label: string, taken: Set<string>): string {
  const base = slugifyLabel(label)
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `${base}_${shortSuffix()}`
    if (!taken.has(code)) {
      taken.add(code)
      return code
    }
  }
  // Astronomically unlikely; fall back to a longer suffix.
  const code = `${base}_${shortSuffix()}${shortSuffix()}`
  taken.add(code)
  return code
}

/**
 * Decide the final `code` for every submitted option row of an item, in order —
 * the single authority both `reconcileOptionRows` (server, `actions.ts`) and the
 * unit tests use.
 *
 * BUG-AMV2-002: a choice-type "Valor padrão" set while authoring an item stores
 * the option's `code` — minted client-side by the OptionsEditor the moment the
 * label is typed. The server MUST persist that SAME code, or the stored default
 * is orphaned and `publish_form_version` rejects it (HC080, "valor padrão
 * inválido"). So a row that arrives WITH a non-empty code keeps it — whether it
 * is an existing (kept) row or a brand-new client-minted one. Only a row that
 * arrives without a code (`code === ''`, e.g. a legacy client) is minted a fresh
 * one here.
 *
 * `existingCodes` are the item's current option codes (EMPTY when adding a new
 * item — which is exactly why the old `existingCodes.has(code)` gate regenerated
 * every new row's code and broke the default). `options` is the ordered
 * submitted set; the return value is one code per option, aligned by index.
 * Server-minted codes never collide with a code already assigned to an earlier
 * row, and duplicate submitted codes are de-collided (first wins, the rest are
 * regenerated) so the reconcile RPC never sees a duplicate (HC013).
 */
export function resolveOptionCodes(
  existingCodes: Iterable<string>,
  options: readonly { code: string; label: string }[],
): string[] {
  const existing = new Set<string>(existingCodes)
  const assigned = new Set<string>()
  return options.map((option) => {
    const submitted = option.code.trim()
    if (submitted && !assigned.has(submitted)) {
      assigned.add(submitted)
      return submitted
    }
    // No code, or a duplicate of an earlier row → mint one, dodging both the
    // existing DB codes (a kept row we must not shadow) and this payload's
    // already-assigned codes.
    const code = generateOptionCode(option.label, new Set([...existing, ...assigned]))
    assigned.add(code)
    return code
  })
}

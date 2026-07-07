/**
 * Client-safe form-option constants. A PURE module — ZERO imports (no `next/*`,
 * no supabase client, no server-only code) — so BOTH server modules (`forms.ts`)
 * and Client Components may value-import these without dragging the server
 * supabase client into the client bundle (FBE-005: value-importing from the
 * server-only `forms.ts` aborted `next build`). `forms.ts` re-exports these for
 * existing server-side importers.
 */

/**
 * The reserved "Outros" open-option code. The backend mints/manages the reserved
 * option row (`reconcile_item_options`); the frontend NEVER emits this code — it
 * only sets `config.allowOther`. Selecting the reserved option (identified by
 * `ItemOption.isOther`) reveals the "Outro" free-text input.
 */
export const OTHER_OPTION_CODE = '__other__' as const

/** The fixed display label for the reserved "Outros" option. */
export const OTHER_OPTION_LABEL = 'Outro' as const

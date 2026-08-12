/**
 * The MANUAL "Registro" kind vocabulary — the single source of truth shared by the
 * case timeline (`case_events.kind`) and the referral detail page's private
 * "Registros internos" (`referral_internal_notes.kind`).
 *
 * **Purity contract (the `referrals/types.ts` discipline).** This module has ZERO
 * imports and no side effects, so it is safe to import from a `"use client"`
 * component AND from a server data-access module. Never add an import of
 * `@/lib/supabase/*`, `next/headers`, `server-only`, or any data-access/action
 * module here — several client bundles depend on this staying inert.
 *
 * Values are stable ASCII snake_case slugs stored verbatim in the two `kind`
 * columns and CHECK-enforced there; every user-facing string is pt-BR and resolved
 * through {@link CASE_EVENT_KIND_LABELS} (Architecture Rule 10).
 *
 * ⚠ This list is mirrored by TWO SQL CHECK constraints — `case_events_kind_check`
 * (which additionally allows the system/procedural kinds, see
 * `ProceduralCaseEventKind`) and `referral_internal_notes_kind_check` (which allows
 * exactly this list) — AND by the SQL function `app.is_manual_case_event_kind`,
 * which is the `kind` arm of all four user-role write policies on `case_events`
 * (BUG-CASEKIND-001). Adding a kind here means widening all three.
 *
 * This module is a CONVENIENCE mirror, not the security boundary: the CHECK
 * constrains the *domain* of `kind`, and the policy arm constrains *who may write
 * which value*, so a forged `kind = 'decision_issued'` is refused by the database
 * even if this guard is bypassed. The ten system kinds are writable only by the
 * SECURITY DEFINER RPCs that emit them (they bypass RLS as the table owner).
 */

/**
 * A manually authored registro kind. The case timeline's `case_events_kind_check`
 * additionally allows system "registry echo" and ethics-procedural kinds that are
 * never hand-authored — those live in `ProceduralCaseEventKind`
 * (`@/lib/queries/case-documents`) and stay OUT of this union so the create-select
 * and both `kind` pickers can be driven straight off {@link CASE_EVENT_KINDS}.
 */
export type CaseEventKind =
  | 'note'
  | 'meeting'
  | 'decision'
  | 'update'
  | 'follow_up'
  | 'other'

/**
 * Every manual kind, in PICKER ORDER (not alphabetical): the three original
 * record-of-fact kinds, then the two progress kinds, then the catch-all. Drives
 * the case "Adicionar registro" dialog and the referral registro composer/editor,
 * so both offer the identical list.
 */
export const CASE_EVENT_KINDS: readonly CaseEventKind[] = [
  'note',
  'meeting',
  'decision',
  'update',
  'follow_up',
  'other',
] as const

/** pt-BR display labels for the manual kinds (Rule 10). */
export const CASE_EVENT_KIND_LABELS: Record<CaseEventKind, string> = {
  note: 'Nota',
  meeting: 'Reunião',
  decision: 'Decisão',
  update: 'Atualização',
  follow_up: 'Acompanhamento',
  other: 'Outro',
}

/** Whether an arbitrary string is a manual registro kind (form-input guard). */
export function isCaseEventKind(value: string): value is CaseEventKind {
  return (CASE_EVENT_KINDS as readonly string[]).includes(value)
}

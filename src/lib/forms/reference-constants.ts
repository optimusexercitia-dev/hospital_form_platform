/**
 * FF-5 (ADR 0091) — the CLIENT-SAFE reference-lane constants.
 *
 * `src/lib/queries/forms.ts` owns the canonical domain types but value-imports
 * the server Supabase client at module top, so a Client Component that
 * value-imports ANYTHING from it drags `next/headers` into the browser bundle
 * and aborts `next build` (BUG-FBE-005 — a failure that lint, typecheck and the
 * unit suite all miss). This module is the pure mirror the builder dialog and
 * the wizard typeahead consume, exactly as `option-constants.ts` mirrors the
 * reserved "Outros" code and `item-tree.ts` mirrors the container walkers.
 *
 * One implementation, two specifiers — never two implementations.
 */

/**
 * The three lanes a `reference` item may target (ADR 0086 ruling 5, ADR 0091
 * ruling 8). Hospital / org lanes are deferred; both the `reference_kind` CHECK
 * and the kind↔target XOR extend by one arm when they land, which is why this is
 * an explicit enumeration rather than an open string.
 */
export type ReferenceKind = 'participant' | 'commission' | 'user'

export const REFERENCE_KINDS: readonly ReferenceKind[] = [
  'participant',
  'commission',
  'user',
]

/** pt-BR labels for the lane picker in the builder. */
export const REFERENCE_KIND_LABELS: Readonly<Record<ReferenceKind, string>> = {
  participant: 'Participante',
  commission: 'Comissão',
  user: 'Pessoa (usuário da plataforma)',
}

/**
 * `participants.participant_type`, mirroring the live
 * `participants_participant_type_check`. Used by the builder to offer
 * `config.participantTypes` — the per-item narrowing of the participant lane.
 */
export type ParticipantType =
  | 'patient'
  | 'professional'
  | 'external_person'
  | 'department'
  | 'institution'
  | 'regulatory_body'
  | 'other'

export const PARTICIPANT_TYPES: readonly ParticipantType[] = [
  'patient',
  'professional',
  'external_person',
  'department',
  'institution',
  'regulatory_body',
  'other',
]

/**
 * pt-BR display labels (Architecture Rule 10: user-facing text is pt-BR,
 * identifiers stay English).
 *
 * ⚠ THE TS HALF OF A MIRRORED PAIR. `app.participant_type_label` is the SQL
 * authority, used by `public.reference_candidates` and by the sign-off
 * projection `app.references_by_item`; this is the TS one, used by
 * `buildReferenceAnswers` and by the builder's type picker. Two copies are
 * structurally necessary — the builder renders labels for types the user has not
 * chosen yet, entirely client-side, while the projection is DEFINER SQL — so
 * this is the same mirrored-SQL/TS situation as the condition evaluator, and it
 * carries the same obligation: the pair must not drift.
 *
 * Both sides are pinned to the same seven pairs — this one by
 * `participant-type-labels.test.ts`, the SQL one by the FF-5 pgTAP suite.
 * Changing one without the other REDS. Do not "fix" a label here alone.
 */
export const PARTICIPANT_TYPE_LABELS: Readonly<Record<ParticipantType, string>> = {
  patient: 'Paciente',
  professional: 'Profissional',
  external_person: 'Pessoa externa',
  department: 'Setor',
  institution: 'Instituição',
  regulatory_body: 'Órgão regulador',
  other: 'Outro',
}

/**
 * A participant type's pt-BR label, for a value of unknown provenance (a DB row,
 * a payload). Mirrors `app.participant_type_label` INCLUDING its fallback:
 * an unmapped value returns ITSELF rather than null, so a future eighth type
 * degrades to a visible English identifier instead of silently blanking the
 * disambiguator — a blank sublabel on the patient lane, where every label is the
 * identical surrogate 'Paciente', is indistinguishable from "these rows are the
 * same person". `null`/`undefined` in still yields `null` out.
 */
export function participantTypeLabel(value: string | null | undefined): string | null {
  if (value == null) return null
  return (
    PARTICIPANT_TYPE_LABELS[value as ParticipantType] ??
    // Unmapped: return the raw value, exactly as the SQL twin's `else` does.
    value
  )
}

/**
 * ⚠ The `patient` type is CASE-SCOPED (ADR 0091 ruling 2), not org-scoped like
 * every other type: its candidates come only from the `case_participants` of the
 * case owning the response. A STANDALONE (non-case) response therefore yields
 * ZERO patient candidates, by design and at BOTH layers — the search filters
 * them out and `app.guard_reference_coherent` refuses them outright, so the
 * picker is a convenience and the trigger is the boundary (Rule 1).
 *
 * Exported so the builder can WARN the author at authoring time instead of
 * letting them ship a field that is silently always empty on a standalone form.
 */
export const CASE_SCOPED_PARTICIPANT_TYPES: readonly ParticipantType[] = ['patient']

/**
 * One typeahead candidate for a reference item — and, with `kind` added, the
 * shape of a SAVED reference on the read side ({@link ReferenceAnswer} in
 * `src/lib/queries/responses.ts`).
 *
 * Declared HERE, in the pure module, rather than beside the query that produces
 * it: the wizard typeahead is a Client Component, and a type imported from
 * `src/lib/queries/references.ts` is one dropped `import type` away from
 * dragging the server Supabase client into the browser bundle (BUG-FBE-005).
 * A pure module makes that mistake impossible instead of merely discouraged.
 *
 * `targetId` is the DURABLE identity — what the answer stores and what
 * dashboards aggregate on. `label`/`sublabel` are presentation, resolved live at
 * every read and never snapshotted (ADR 0091 ruling 4).
 *
 * `sublabel` is the disambiguator, and it is load-bearing on the patient lane:
 * every patient's `display_name` is the identical surrogate 'Paciente', so
 * without the sublabel (that participant's role in the case) a picker renders N
 * indistinguishable rows. On the commission lane it is the hospital; on the user
 * lane, the e-mail.
 */
export interface ReferenceCandidate {
  targetId: string
  label: string
  sublabel: string | null
}

/** True when this item type is the reference lane. */
export function isReferenceItem(itemType: string): boolean {
  return itemType === 'reference'
}

/** Narrow an unknown `config.referenceKind` to a {@link ReferenceKind}, else null. */
export function toReferenceKind(value: unknown): ReferenceKind | null {
  return typeof value === 'string' &&
    (REFERENCE_KINDS as readonly string[]).includes(value)
    ? (value as ReferenceKind)
    : null
}

/**
 * Narrow an unknown `config.participantTypes` to a {@link ParticipantType}[],
 * else null. Unknown members are DROPPED rather than rejecting the whole list —
 * a stale type name should narrow the picker, not break the item. An empty
 * result yields `null` ("all types"), which is the same thing the DB reads when
 * the key is absent.
 */
export function toParticipantTypes(value: unknown): ParticipantType[] | null {
  if (!Array.isArray(value)) return null
  const known = value.filter(
    (v): v is ParticipantType =>
      typeof v === 'string' && (PARTICIPANT_TYPES as readonly string[]).includes(v),
  )
  return known.length > 0 ? known : null
}

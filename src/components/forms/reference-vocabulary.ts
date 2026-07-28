import {
  CASE_SCOPED_PARTICIPANT_TYPES,
  PARTICIPANT_TYPE_LABELS,
  REFERENCE_KIND_LABELS,
  participantTypeLabel,
  type ParticipantType,
  type ReferenceKind,
} from "@/lib/forms/reference-constants";

/**
 * FF-5 (ADR 0091) — the pt-BR COPY of the entity-reference lanes: the
 * explanatory sentences, the field placeholders and the two empty states, in one
 * place so the builder's lane picker and the wizard's picker say the same words
 * for the same thing.
 *
 * ⚠ It deliberately holds NO second copy of the lane NAMES or the participant
 * type names. Those live in `@/lib/forms/reference-constants` beside the enums
 * they label, and are re-exported through here so a consumer needs one import
 * without there being two sources that can drift. A duplicated label is the
 * cheapest possible way to ship a screen that disagrees with itself.
 */

export { PARTICIPANT_TYPE_LABELS };

/** The prose that belongs to a lane but not to its enum: what it reaches, how
 *  to ask for it, and what "nothing here" means. */
export interface LaneCopy {
  /** One line telling the author what this lane actually reaches. */
  description: string;
  /** The wizard's field placeholder, phrased as an instruction to the filler. */
  searchPlaceholder: string;
  /** The wizard's empty state when the SEARCH matched nothing. */
  noMatches: string;
  /** The wizard's empty state when the lane has no candidates at all. */
  noCandidates: string;
}

export const REFERENCE_LANE_COPY: Record<ReferenceKind, LaneCopy> = {
  participant: {
    description:
      "Pessoa, setor ou instituição já registrada como participante — o vínculo aponta para o cadastro, não para um texto digitado.",
    searchPlaceholder: "Busque um participante pelo nome…",
    noMatches: "Nenhum participante corresponde à busca.",
    noCandidates: "Nenhum participante disponível para referenciar.",
  },
  commission: {
    description:
      "Outra comissão da instituição — útil para registrar corresponsabilidade ou encaminhamento entre comitês.",
    searchPlaceholder: "Busque uma comissão pelo nome…",
    noMatches: "Nenhuma comissão corresponde à busca.",
    noCandidates: "Nenhuma comissão disponível para referenciar.",
  },
  user: {
    description:
      "Alguém com acesso à plataforma — o vínculo acompanha a conta, mesmo que o nome mude depois.",
    searchPlaceholder: "Busque uma pessoa pelo nome…",
    noMatches: "Nenhuma pessoa corresponde à busca.",
    noCandidates: "Nenhuma pessoa disponível para referenciar.",
  },
};

/** The lane's display name — the ONE source, re-exported so callers need not
 *  reach into two modules to render a picker row. */
export function referenceKindLabel(kind: ReferenceKind): string {
  return REFERENCE_KIND_LABELS[kind];
}

/**
 * Render a candidate's `sublabel` as pt-BR text (Rule 10).
 *
 * ## Status: idempotent belt-and-braces, NOT the fix
 *
 * The source normalizes already. `app.participant_type_label` is the SQL
 * authority (used by `reference_candidates` and `app.references_by_item`) and
 * `participantTypeLabel` the TS one (used by `buildReferenceAnswers`), pinned to
 * each other by pgTAP 276 §L + `participant-type-labels.test.ts` — backend
 * `3c997eb`. So on every path this component can reach today, this call returns
 * its input unchanged.
 *
 * It stays because it costs nothing and is exactly idempotent: it delegates to
 * that same `participantTypeLabel`, whose mapping is EXACT-MATCH-ONLY over the
 * seven `participant_type` identifiers and returns anything else untouched. A
 * case role, a hospital name or an e-mail (the patient, commission and user
 * lanes) therefore cannot be rewritten by accident, and an already-pt-BR label
 * cannot be double-translated.
 *
 * ⚠ It is NOT a general defence. It guards this component tree only — the
 * sign-off projection renders references through a different tree entirely, so
 * the same defect there (found by backend's `pg_proc` sweep, not by this) was
 * invisible to it. The lesson to carry, if a raw identifier ever surfaces again:
 * fix the producer and sweep for siblings; a render-layer map is the symptom's
 * bandage, never the cure.
 */
export function displaySublabel(sublabel: string | null): string | null {
  return participantTypeLabel(sublabel);
}

/**
 * Whether an allowed-types selection reaches a CASE-SCOPED participant type,
 * i.e. whether the author needs to be told the form must be a case phase.
 *
 * An EMPTY/absent selection means "all types", which includes every case-scoped
 * one — so the warning shows there too. Getting that backwards would hide the
 * one thing an author most needs to know: that on a standalone checklist the
 * patient half of this field is legitimately, permanently empty.
 *
 * Derived from `CASE_SCOPED_PARTICIPANT_TYPES` rather than testing for
 * `'patient'` directly, so the day a second type becomes case-scoped this
 * warning follows it instead of quietly under-reporting.
 */
export function reachesCaseScopedLane(
  participantTypes: readonly ParticipantType[] | null | undefined,
): boolean {
  if (participantTypes == null || participantTypes.length === 0) return true;
  return participantTypes.some((t) => CASE_SCOPED_PARTICIPANT_TYPES.includes(t));
}

/**
 * Whether the selection is EXCLUSIVELY case-scoped — the case in which a
 * standalone response shows an empty picker and nothing else, so the copy can be
 * definite ("este formulário não está vinculado a um caso") instead of hedged.
 */
export function isCaseScopedOnlyLane(
  participantTypes: readonly ParticipantType[] | null | undefined,
): boolean {
  return (
    participantTypes != null &&
    participantTypes.length > 0 &&
    participantTypes.every((t) => CASE_SCOPED_PARTICIPANT_TYPES.includes(t))
  );
}

/** A short pt-BR summary of a reference item's configuration, for the builder's
 *  block card and the dialog footer ("Participante · Paciente, Profissional"). */
export function describeReferenceConfig(
  kind: ReferenceKind,
  participantTypes: readonly ParticipantType[] | null | undefined,
): string {
  const lane = referenceKindLabel(kind);
  if (kind !== "participant") return lane;
  if (participantTypes == null || participantTypes.length === 0) {
    return `${lane} · todos os tipos`;
  }
  return `${lane} · ${participantTypes
    .map((t) => PARTICIPANT_TYPE_LABELS[t])
    .join(", ")}`;
}

/**
 * The pt-BR case vocabularies that BOTH layers need — the UI and the printed
 * dossier (PDF·P3, ADR 0144).
 *
 * ⭐ **Why these live in `src/lib` and not in `src/components`.** They used to sit
 * under `src/components/cases/`, which was correct while the only consumer was a
 * screen. `src/lib/cases/pdf-payload.ts` now renders the same enums onto paper,
 * and `src/lib` importing upward from `src/components` is not legal here. The
 * rejected alternative was a second copy in `src/lib` — which gives one
 * vocabulary two authorities, and the failure it ends in is specific: the dossier
 * printing a **stale pt-BR label for a kind the UI renamed**, on a document that
 * claims to be an authoritative record of what a committee did. One authority,
 * two importers.
 *
 * ⛔ **STRINGS ONLY — no icons, no class names, no React.** Measured 2026-08-25:
 * **zero** modules under `src/lib/**` import `lucide-react` (406 under
 * `src/components/**` do). The correction maps in `src/components` are
 * `{ label, icon, className }` triples; only the **label** belongs here, because
 * this module is imported by a payload builder whose output is data for
 * Gotenberg, where an icon component and a Tailwind class are meaningless. The
 * presentation halves stay in `src/components/cases/correction-labels.ts` and
 * consume the words from here.
 *
 * **Purity.** Type-only imports from the query modules (erased at build, so no
 * `next/headers` reaches a client bundle — `lint:client-server-imports` is the
 * gate) plus one value import from the already-pure `./registro-kinds`. Safe to
 * import from a `"use client"` component and from a server module alike. ⛔ Never
 * add `@/lib/supabase/*`, `server-only`, or an actions module here.
 *
 * ⭐ **Every map here carries an EXPLICIT `Record<Union, …>` annotation, and that
 * annotation is the control — not the comments.** Each of these vocabularies now
 * has a presentation-side sibling one layer up, keyed on the SAME union
 * (`ACTION_ITEM_STATUS_STYLE`, `CORRECTION_KIND_META`,
 * `CORRECTION_STATUS_META`). Splitting a vocabulary across a layer boundary is
 * exactly how one half gains a member and the other silently does not. With both
 * halves annotated, widening the union is a **compile error in both files in the
 * same `tsc` run**; the pointer comments below are navigation only.
 *
 * ⛔ Never "simplify" one of these annotations to an inferred object literal. It
 * changes nothing visible, passes every gate, and removes the only thing that
 * makes the pairing enforceable — a comment cannot fail, and this repo has been
 * bitten by that shape repeatedly.
 */

import type { AnyCaseEventKind } from '@/lib/queries/case-documents'
import type { ActionItemStatus } from '@/lib/queries/case-action-items'
import type {
  CorrectionClassification,
  CorrectionKind,
  CorrectionStatus,
} from '@/lib/queries/corrections'

import { CASE_EVENT_KIND_LABELS } from '@/lib/cases/registro-kinds'

/**
 * Every case-event kind the DB `case_events_kind_check` allows (R1 + ETH·E3a).
 *
 * ⭐ EXHAUSTIVE over {@link AnyCaseEventKind}, and that is the property that makes
 * it the one to use: `CASE_EVENT_KIND_LABELS` next door covers the **manual kinds
 * only** and is a strict subset, so it is not a substitute for anything that must
 * label an auto-derived procedural event. This map spreads it and adds the rest,
 * so the manual words are still declared exactly once.
 *
 * The `Record<AnyCaseEventKind, string>` annotation is load-bearing: a new kind in
 * the union is a COMPILE ERROR here, not a blank label on a printed dossier.
 *
 * The manual create-select (`case-event-form.tsx`) still offers only the manual
 * kinds; the rest are system-emitted and read-only.
 */
export const EVENT_KIND_LABEL: Record<AnyCaseEventKind, string> = {
  // Manually authored via CaseEventForm. Spread from the shared vocabulary the
  // referral "Registros internos" panel files under too — one list, two surfaces.
  ...CASE_EVENT_KIND_LABELS,
  // System "registry echo" kinds (deduped off the timeline; labeled for completeness).
  interview: 'Entrevista',
  safety_event: 'Evento de segurança',
  // Ethics procedural kinds (E3a) — auto-derived by the E2 procedure RPCs.
  admissibility_decided: 'Admissibilidade decidida',
  allegation_added: 'Alegação registrada',
  finding_recorded: 'Parecer registrado',
  notification_issued: 'Notificação emitida',
  hearing_scheduled: 'Audiência agendada',
  vote_cast: 'Voto registrado',
  decision_issued: 'Decisão emitida',
  appeal_submitted: 'Recurso interposto',
}

/**
 * Action-item lifecycle statuses (R4).
 *
 * ⚠ Paired with `ACTION_ITEM_STATUS_STYLE` in
 * `src/components/cases/case-extras-labels.ts` (Tailwind classes, same union).
 * Navigation pointer only — what ENFORCES the pairing is that both carry an
 * explicit `Record<ActionItemStatus, …>`, so a new status fails to compile in
 * both files at once.
 */
export const ACTION_ITEM_STATUS_LABEL: Record<ActionItemStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  done: 'Concluído',
  cancelled: 'Cancelado',
}

/**
 * What a correction request does to its target (ADR 0085). `void` = "Anulação".
 *
 * ⚠ The WORDS only. `CORRECTION_KIND_META` in
 * `src/components/cases/correction-labels.ts` pairs each of these with an icon, a
 * Tailwind class and a verb-phrase menu label ("Solicitar correção"); those are
 * presentation and stay there, reading their `label` from here.
 */
export const CORRECTION_KIND_LABEL: Record<CorrectionKind, string> = {
  correction: 'Correção',
  addendum: 'Adendo',
  void: 'Anulação',
}

/**
 * The correction workflow state (ADR 0085). `rejected` is a RESTING state (the
 * corrector's next edit flips it back to `in_progress`); `approved` / `withdrawn`
 * are terminal.
 *
 * ⚠ Words only — see {@link CORRECTION_KIND_LABEL}. On screen these are conveyed
 * by icon + text + shape (never colour alone, a11y); on paper only the text
 * survives, which is why the text has to carry the meaning on its own.
 */
export const CORRECTION_STATUS_LABEL: Record<CorrectionStatus, string> = {
  requested: 'Solicitada',
  in_progress: 'Em edição',
  resubmitted: 'Reenviada',
  under_review: 'Em revisão',
  rejected: 'Reprovada',
  approved: 'Aprovada',
  withdrawn: 'Retirada',
}

/**
 * The descriptive correction classification (ADR 0085) — pure copy, `label` +
 * `hint`, no icon and no class, which is why it travels whole rather than split.
 *
 * ⚠ **Descriptive, NEVER a gate.** It tells the approver what KIND of change to
 * expect when reviewing the diff; nothing branches on it. On paper it is part of
 * what a correction entry *means* (ADR 0144 D2 renders corrections inline), which
 * is why the dossier needs the words and not just the slug.
 *
 * The `hint` is written for the picker, where it sits under the label as guidance.
 * A renderer that has no room for it should drop it rather than reflow it — it is
 * a second sentence, not a subtitle.
 */
export const CORRECTION_CLASSIFICATION_LABEL: Record<
  CorrectionClassification,
  { label: string; hint: string }
> = {
  clerical: {
    label: 'Correção material',
    hint: 'Erro de digitação ou formatação, sem mudança de conteúdo.',
  },
  factual: {
    label: 'Correção factual',
    hint: 'Um dado registrado estava incorreto.',
  },
  interpretative: {
    label: 'Reinterpretação',
    hint: 'Nova leitura dos mesmos fatos.',
  },
  substantive: {
    label: 'Alteração substantiva',
    hint: 'Mudança relevante de conteúdo ou conclusão.',
  },
  compliance_related: {
    label: 'Conformidade regulatória',
    hint: 'Ajuste exigido por norma ou auditoria.',
  },
}

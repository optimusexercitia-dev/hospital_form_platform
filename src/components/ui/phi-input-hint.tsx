"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";
import { FieldDescription } from "./field";

/**
 * ⭐ THE SOFT PREVENTIVE CONTROL for ADR
 * [0131](../../../docs/decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md).
 *
 * That decision bounds PHI erasure to DESIGNATED PHI fields and accepts, as residual
 * risk, PHI an operator types into free text or a title. Amendment 1 PROMOTED this
 * helper text out of the deferred backlog with the reason that makes it load-bearing
 * rather than cosmetic: it is *"the only software support for the training control
 * this decision now depends on"*, and it defends the very title invariant WS B's
 * exclusion rests on (23 columns carry a `PHI-BEARING free text` catalog comment and
 * **zero** of them are a `title`).
 *
 * ⛔ SOFT GUIDANCE ONLY. No validation, no blocking, no submit gate. The platform
 * cannot detect PHI in prose; a hard block would only teach operators to work around
 * it, and ADR 0131 chose training precisely because detection is not available.
 *
 * ## ⛔ Why the reason given is VISIBILITY and never erasure
 *
 * The obvious reason to give — *"titles are not erased when patient data is
 * discarded"* — is FALSE for a large share of the columns this hint annotates.
 * Measured in the live catalog (2026-08-20), these title-family columns ARE inside a
 * disposal door's redaction reach: `cases.label` and `case_events.title`
 * (`dispose_case_phi`), `documents.title` (`dispose_case_phi` + `dispose_referral_phi`),
 * `rca_evidence.title` (`dispose_event_phi`), `case_referral.subject`
 * (`dispose_referral_phi`), `meeting_agenda_items.title` (`dispose_meeting_minutes`) —
 * while `patient_safety_event.title`, `meetings.title`, `capa_action.title` and
 * `case_interviews.title` are NOT. One constant claiming either direction would ship a
 * false compliance statement on roughly half its sites, which is exactly the failure
 * `D12_TITLE_GUIDANCE`'s docblock warns about: *a false blanket warning teaches
 * clinicians to skip guidance.*
 *
 * ⛔ So these constants make NO CLAIM, in either direction, about whether the field is
 * erased on descarte. They give the reason that is true at EVERY site: the text is
 * stored and read by people who may not be able to open the record itself. A per-lane
 * erasure statement, if it is ever wanted, is a separate per-column change with its own
 * evidence — not an edit to a shared constant.
 *
 * Precedent this follows: {@link D12_TITLE_GUIDANCE} in
 * `src/components/documents/document-labels.ts`, whose own docblock establishes that
 * the REASON is what makes guidance followable.
 */

/**
 * For `*.title` / short-name inputs on governance records — the WS B/C FE item's
 * named lanes (case · event · RCA · CAPA · meeting · interview) plus the referral
 * lane.
 *
 * The reason is true of every one of them without exception: a title is what rides
 * queue, list, board and dashboard projections, which is precisely why those
 * projections are safe to serve broadly — and why a title is the worst place in the
 * product to put a name or an MRN.
 */
export const PHI_TITLE_HINT =
  "Não inclua dados do paciente. O título aparece em listas, painéis e relatórios — inclusive para quem não pode abrir o registro.";

/**
 * For persisted free-text fields that are read by someone other than their author
 * (the DSR lane's rationale, legal-reference and review-note fields).
 *
 * Deliberately does NOT say "aparece em listas": that is the title's property, not
 * this one's. Same discipline as the erasure split above — a reason has to be true of
 * the field it sits under.
 */
export const PHI_FREE_TEXT_HINT =
  "Não inclua dados do paciente. Este texto fica registrado e é lido por outras pessoas.";

const HINT_TEXT = {
  title: PHI_TITLE_HINT,
  freeText: PHI_FREE_TEXT_HINT,
} as const;

/**
 * Wraps ONE legacy field — a `<label>`-wrapping-`<input>` control — and renders the hint
 * beneath it, wired by an id it generates.
 *
 * ## The census, re-derived 2026-08-21 (QA M5)
 *
 * ⛔ This block previously carried FOUR different figures for one population (17 / 16 / 14 /
 * 12) and **none was reproducible**. Re-derived from the sites actually changed, each digit
 * checkable by the command beside it, and each saying what it counts:
 *
 *   · **14 render-prop hosts** — `grep -rn '<PhiInputHint' src/ --include=*.tsx | grep -v
 *     '\.test\.'` returns 15 lines; one is the `@example` in THIS file, leaving 14 call sites
 *     in 14 files. These are the legacy `<label>`-wrap forms.
 *   · **5 constant-only hosts / 6 rendered hints** — `grep -rn 'PHI_TITLE_HINT|PHI_FREE_TEXT_HINT'`
 *     outside this file and outside tests: `dsr-adjudication-panel` (×2), `dsr-attest-form`,
 *     `dsr-intake-panel`, `dsr-task-inbox`, `case-bulk-grid`. They import the CONSTANT and skip
 *     this component entirely.
 *
 * **19 hosts, 20 rendered hints.** Those two numbers differ only because
 * `dsr-adjudication-panel` renders the constant twice.
 *
 * ## ⛔ Why a render prop — and the honest version of the reason
 *
 * The instruction that prompted this was *"wire it through `useFieldIds(name, {
 * hasDescription: true })`"*. The reason not to do that everywhere is **not** that the hosts
 * lack the field primitives — the split is by what each host ALREADY IS, and all three arms
 * were the right call for their arm:
 *
 *   · **4 hosts already sit on `Field`/`useFieldIds`** (the DSR panels). They take the
 *     CONSTANT straight into their EXISTING `FieldDescription`. Wrapping them in this
 *     component would have added a redundant SECOND description to a field that already had
 *     one — worse a11y, not better.
 *   · **1 host is a data grid** (`case-bulk-grid`), where a per-cell hint is the wrong shape:
 *     200 rows of the same sentence is noise a screen-reader user hears on every arrow-key
 *     move. It hand-rolls one `useId()` for a COLUMN-level hint that every title cell points
 *     at.
 *   · **14 hosts are the legacy `<label>`-wrap idiom** with no field primitives at all. Those
 *     get this component.
 *
 * ⚠ **AND THE MIGRATION RISK IS REAL BUT BOUNDED — the earlier claim overstated it.** This
 * block used to say *"every one of these forms reads `formData.get("title")`"*. Measured:
 * **3 of the 14** wrap a control carrying a DOM `name=` (`add-ad-hoc-narrative-dialog`,
 * `add-ad-hoc-phase-dialog`, `case-event-form`); the other 11 are controlled React state with
 * no `name` at all. `useFieldIds` emits **no DOM `name`** unless the caller declares
 * `nameRequiredFor`, so converting those 3 without it breaks their server action and stays
 * GREEN in tsc, lint and vitest. That is a genuine trap on 3 files — it is not, as written
 * before, a property of all 14. The load-bearing reason for the render prop is the
 * accessible-name constraint below, which holds for every one of the 14 regardless.
 *
 * ⛔ The hint CANNOT live inside the `<label>`: `<p>` is not phrasing content, and text inside
 * a label is folded into the control's ACCESSIBLE NAME — the name would silently become
 * "Título Não inclua dados do paciente…", moving every `getByLabel` locator in the E2E suite.
 * Hence the wrapper `<div>`: it preserves the label's accessible name byte-for-byte while
 * giving the hint a sibling slot at the right spacing.
 *
 * @example
 * <PhiInputHint>
 *   {(hintId) => (
 *     <label className="flex flex-col gap-1.5 text-sm">
 *       <span className="font-medium">Título</span>
 *       <input name="title" className={FIELD_CLASS} aria-describedby={hintId} />
 *     </label>
 *   )}
 * </PhiInputHint>
 */
export function PhiInputHint({
  variant = "title",
  className,
  children,
}: {
  /** Which reason to give. See the two constants above — they are not interchangeable. */
  variant?: keyof typeof HINT_TEXT;
  /** Extra classes for the wrapper, e.g. a grid span. */
  className?: string;
  /**
   * The field markup. Receives the hint's DOM id — put it on the CONTROL's
   * `aria-describedby`, which is the one part that cannot be wired automatically
   * without cloning children.
   */
  children: (hintId: string) => React.ReactNode;
}) {
  // ⛔ React's `useId`, never a module-level counter: the id must be unique PER
  // RENDERED INSTANCE, and these controls appear inside dialogs that mount more than
  // once per page. A duplicate id makes `aria-describedby` resolve to whichever node
  // is first in document order — the BUG-A11Y-001 class, one attribute over.
  const hintId = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {children(hintId)}
      <FieldDescription id={hintId} className="text-xs text-pretty">
        {HINT_TEXT[variant]}
      </FieldDescription>
    </div>
  );
}

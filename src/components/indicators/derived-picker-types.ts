/**
 * CLIENT-SAFE plain shapes the derived-config picker binds to (Phase 15, F1).
 *
 * Zero runtime imports — importable from the `"use client"` builder without
 * dragging any server module into the bundle. The server page composes these
 * from the existing form-tree readers (`listForms` + `getVersionTree` of each
 * form's latest published version) and passes them down as plain props; the
 * picker never fetches. The values the picker emits are the STABLE identities the
 * derived config stores: the form's `id`, an input's `questionKey`, and option
 * `code`s (never labels or option-row ids — the cross-version identity per
 * ARCHITECTURE Rule 2 / form-model normalization).
 */

/** One selectable option of a choice question: the stored `code` + its display `label`. */
export interface PickerOption {
  code: string;
  label: string;
}

/** One answerable input of a form's published version, for the picker. */
export interface PickerQuestion {
  questionKey: string;
  label: string;
  /** The input type — `'choice'` questions carry `options`; `'number'` questions are the tempo_medio source. */
  kind: "choice" | "number" | "other";
  /** Choice options (`{code,label}`); empty for non-choice questions. */
  options: PickerOption[];
}

/**
 * One form of the commission, with the answerable questions of its LATEST
 * PUBLISHED version. A form with no published version has `questions: []` (it
 * can't back a derived indicator yet) — the picker shows it disabled with a hint.
 */
export interface PickerForm {
  formId: string;
  title: string;
  /** True when the form has a published version to derive from. */
  hasPublishedVersion: boolean;
  questions: PickerQuestion[];
}

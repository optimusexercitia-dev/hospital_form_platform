/**
 * The ADR 0056 Consequence (b) OVER-CLAIM property, defined once for every disposal
 * surface that asserts it. Test-support: nothing in the component graph imports this.
 *
 * ⭐ WHY IT IS A MODULE AND NOT A REGEX IN EACH TEST. The property is asserted from
 * two files (`dsr-disposal-overclaim.test.tsx` for the three DSR surfaces,
 * `referral-dispose-dialog.test.tsx` claim 2 for the referral dialog, where it is also
 * `FUP-DISPOSE-DIALOG-OVERCLAIM`'s closure instrument). Two copies of a pattern drift,
 * and a pattern that drifts loosens silently in whichever copy nobody edited.
 *
 * ⛔ READ `.claude/rules/ui-copy-forbidden-strings.md` BEFORE CHANGING ANY OF THIS.
 * These patterns are applied to RENDERED DOM TEXT and to nothing else. Running them
 * over source would make every comment describing the defect a hit — the measured
 * failure that retired the previous instrument.
 */

import { DSR_MEETING_DISPOSAL_WARNING } from '@/lib/dsr/messages'

/**
 * The CLASS the shipped over-claim belonged to: a universal quantifier over the erased
 * set. The defect paired a permanence adverb with a universal quantifier over the
 * sensitive fields, and the load-bearing half was the QUANTIFIER — ADR 0056 (b) forbids
 * the *completeness* claim, not the *finality* one. Permanence is deliberately left
 * alone: "exclusão definitiva" and "Apagar definitivamente" assert that the action
 * cannot be undone, which is true, and both are qualified by the residue lines beside
 * them.
 */
export const TOTALITY_QUANTIFIER =
  /\b(todos?|todas?|tudo|quaisquer|qualquer|integral(mente)?|completa(mente)?|por completo)\b/i

/**
 * Proof-of-life. An absence assertion passes just as happily on a surface that says
 * nothing about erasing anything, so every use of {@link TOTALITY_QUANTIFIER} pairs
 * with this one first.
 */
export const ERASURE_CLAIM =
  /\b(apaga|apagar|apagad|remove|remover|exclus|excluir|descart)/i

/**
 * ⭐ THE DISTINCTION THE PATTERN CANNOT DRAW ITSELF IS POLARITY, NOT SYNTAX — and this
 * is the whole reason the property is a subtraction rather than a wider regex.
 *
 * Both shapes pair a universal quantifier with an erasure verb:
 *   · FORBIDDEN — quantifies over THE SUBJECT'S DATA as the erased set, in a
 *     REASSURING frame ("everything of yours is gone"). ADR 0056 (b).
 *   · REQUIRED  — quantifies over OTHER PEOPLE'S RECORDS, in a WARNING frame ("this
 *     also destroys all of that"). ADR 0130 Amdt 2 item 3.
 * Identical syntax, inverted semantics. A lexical gate keyed on the quantifier family
 * reds on the second, and the cheapest way to green it is to soften the warning — the
 * one edit `DSR_MEETING_DISPOSAL_WARNING`'s docblock forbids outright. So the
 * deliberately warning-framed strings are removed BY IDENTITY (imported, never
 * re-typed) before the property is applied to what remains.
 *
 * ⛔ ADDING TO THIS SET IS NOT A WAY TO GREEN A BUILD. Each entry is a centrally
 * reviewed constant whose docblock states why its quantifier is load-bearing. A new
 * bespoke string in a component is never an entry here — that is the defect.
 *
 * ⚠ SUBTRACTION BUYS BLINDNESS UNLESS IT IS PAIRED. Removing the warning also removes
 * the property's ability to notice the warning vanishing, so every surface that renders
 * one carries a POSITIVE pin that it renders verbatim. Subtract here, pin there.
 */
export const WARNING_FRAMED: readonly string[] = [DSR_MEETING_DISPOSAL_WARNING]

/**
 * ⛔ THE RENDERED TEXT, WITH ELEMENT BOUNDARIES PRESERVED — never bare `textContent`,
 * and this is not a style preference.
 *
 * `Element.textContent` concatenates descendant text with NO separator, so the last word
 * of one element fuses to the first word of the next: a heading reading "TUDO foi
 * apagado" placed after a reviewer chip "Ana Souza" yields `…SouzaTUDO foi apagado…`.
 * There is no word boundary before that `T`, so `\btudo\b` DOES NOT MATCH and the
 * over-claim passes. Measured: a deliberate over-claim injected into
 * `dsr-outcome-record.tsx` left the whole suite green until this helper existed.
 *
 * ⚠ THE PREVIOUS INSTRUMENT HAD THIS BLIND SPOT TOO. `FUP-DISPOSE-DIALOG-OVERCLAIM`'s
 * closure assertion read `dialog.textContent` directly, so it could only ever have
 * caught a quantifier sitting mid-element — which the shipped defect happened to be.
 * The property was never as wide as it read.
 *
 * Joining text NODES with a space restores every boundary the DOM already had. It cannot
 * hide a quantifier (a separator is only ever added, never removed), so the failure
 * direction is toward detection.
 */
export function renderedText(root: HTMLElement): string {
  const parts: string[] = []
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    parts.push(node.textContent ?? '')
  }
  return parts.join(' ')
}

/**
 * The rendered text with every warning-framed string removed — i.e. the REASSURANCE
 * frame, which is where the over-claim is forbidden.
 *
 * ⚠ Deliberately NOT scoped to the residue/reassurance *region* of the DOM, which is
 * what this was expected to be. Measured on all four surfaces: that region renders
 * `DSR_RESIDUE_NOTICE` (and `DSR_MEETING_RESIDUE_RETAINED`) and nothing else, so an
 * assertion scoped to it would only ever re-check constants that claim 1 already pins —
 * while the shipped defect lived in the dialog's own BESPOKE copy, outside it. Scoping
 * to the region would have moved the assertion away from the only place the defect has
 * ever appeared.
 */
export function reassuranceText(text: string): string {
  return WARNING_FRAMED.reduce(
    (acc, warning) => acc.split(warning).join(' '),
    text,
  )
}

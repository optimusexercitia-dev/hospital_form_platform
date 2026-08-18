import type { PrintedDocumentStatus } from "@/lib/pdf/types";

/**
 * CURRENCY — the third derived axis (ADR 0126 D2/D3/D4), as the UI consumes it.
 *
 * > current ⇔ the source STILL satisfies the registration predicate AND the
 * > source is still the HEAD of its series.
 *
 * Derived at READ time and never stamped (D3): `printed_documents.status` keeps
 * its own meaning — **deliberate acts only**, re-mint supersession and
 * revocation. So a print may be `status = 'active'` **and not current**, which is
 * a new and legal combination both `/verificar` and the in-app panel must
 * express. Authenticity, registry status and currency are THREE separate facts
 * and the page states them separately, because they are.
 *
 * ⛔ **WHY THIS IS A UNION AND NOT `boolean | null`.**
 *
 * The wire shape is `isCurrent: boolean | null`, where `null` means *"not
 * evaluated"* — which happens for exactly one case, `status = 'revoked'`,
 * preserving the no-join independence `312` t76 pins (a paper-holder can still
 * verify a document whose source was later discarded).
 *
 * Handed that shape directly, the UI has a silent failure mode with no red bar
 * anywhere: the natural adapter `isCurrent: row.is_current ?? null` turns an
 * ABSENT field into `null`, `null` reads as *"not evaluated"*, and the page
 * states *"currency not assessed"* for **every** document — including current
 * ones. It renders cleanly, tells every surveyor nothing, and no test fails.
 * (Found by `backend` before it shipped; the column genuinely does not exist
 * yet.)
 *
 * The defect is that **absent and not-evaluated are the same value**. So the UI
 * is never given that shape: `notApplicable` cannot be produced by accident
 * because only {@link printCurrencyFrom} can produce it, and that function
 * distinguishes the two cases. A missing value is {@link indeterminate} — a
 * CONTRACT VIOLATION, which is a different fact from *deliberately not computed*
 * and says different words on the page.
 */
export type PrintCurrency =
  /** The source still registers and is still the head of its series. */
  | { kind: "current" }
  /** Authentic, but emitted from a revision that is no longer the current one.
   * ADR 0126 D4's THIRD term — deliberately not `Substituído`, which would
   * assert that a newer print exists when none does. */
  | { kind: "outdated" }
  /** Currency was deliberately NOT evaluated. `revoked` only: the lookup door
   * reports `ANULADO` with no join at all (D3), so there is nothing to assess
   * and the page must say nothing about it. */
  | { kind: "notApplicable" }
  /**
   * Currency could not be determined — a CONTRACT VIOLATION, never a normal
   * state.
   *
   * ⚠ Deliberately distinct from {@link notApplicable}. Collapsing them is the
   * exact defect this module exists to prevent, and the collapse fails in the
   * direction that looks fine. A page that degrades honestly ("could not be
   * determined") is recoverable; one that silently claims currency was not
   * assessed is a lie a surveyor cannot detect.
   *
   * ⭐ **The general form, because this is a class and not an instance: TWO
   * ABSENCES THAT MEAN DIFFERENT THINGS MUST NOT SHARE A REPRESENTATION.**
   * *"Nobody computed this"* and *"we deliberately do not compute this here"*
   * are different facts about the world. Given one encoding they become
   * indistinguishable at exactly the moment the first one starts happening —
   * and the surface that reports them keeps rendering, which is what removes
   * the red bar.
   */
  | { kind: "indeterminate" };

/**
 * The ONE adapter from the wire shape to {@link PrintCurrency}. Total: every
 * input maps, nothing throws — `/verificar` is a public page and a paper-holder
 * must still be able to verify authenticity even when currency is unavailable.
 *
 * ⚠ `isCurrent` is typed `boolean | null` and **NOT** `| undefined` on purpose.
 * The RPC does not return the column today, so a direct read is `undefined` and
 * a call site that passes it is a **tsc error** rather than something `?? null`
 * quietly launders into "not evaluated".
 */
export function printCurrencyFrom(
  status: PrintedDocumentStatus,
  isCurrent: boolean | null,
): PrintCurrency {
  // Revoked wins over any value: D3 authorizes NO join for this arm, so the
  // door reports nothing to assess. A value arriving here would itself be a
  // contract drift, but ignoring it is the safe reading — `ANULADO` is already
  // the strongest statement the page makes, and currency cannot soften it.
  if (status === "revoked") return { kind: "notApplicable" };
  if (isCurrent === null) return { kind: "indeterminate" };
  return isCurrent ? { kind: "current" } : { kind: "outdated" };
}

import { Printer, ShieldAlert } from "lucide-react";

import {
  PREVIA_BUTTON_LABEL,
  PREVIA_HELPER_COPY,
  PREVIA_PHI_BUTTON_LABEL,
  PREVIA_PHI_HELPER_COPY,
  previaHref,
} from "@/components/printing/labels";
import type { PrintedDocumentSourceKind } from "@/lib/pdf/types";

/** Shared chrome for a prévia anchor. Both variants are the SAME visual weight
 * — see the `phiCapable` note on {@link PreviaLink} for why the identified one
 * is not styled as a lesser, easier-to-miss affordance. */
const PREVIA_LINK_CLASS =
  "inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none";

/**
 * "Imprimir prévia" — the EPHEMERAL half of ADR 0125 D1's split.
 *
 * ⭐ **A SERVER component and a plain `<a>`, deliberately — not a sibling of
 * `MintDocumentButton`.** That button is a client island with a confirm dialog
 * because minting is *not a view*: it creates a permanent, hash-pinned RECORD
 * that supersedes the previous print and cannot be deleted. A prévia is the
 * opposite in every one of those respects — nothing is stored, nothing enters
 * the registry, nothing is superseded, and it can be repeated freely. Wrapping
 * it in the same confirmation would tell the user a lie about its weight, and
 * would ship dialog JS to screens that never mint.
 *
 * The route streams `Content-Disposition: inline` (ADR 0125 D4), so the browser
 * shows the PDF rather than filing it — a prévia is meant to be looked at.
 *
 * ⚠ **The user never chooses this** (D1). Which affordance renders is DERIVED
 * from `printSourceRegisters`; the caller decides nothing. Two buttons offered
 * side by side was the rejected alternative — it would make *"is this a
 * record?"* a user decision, which is ADR 0104 D7's "free text" by another name.
 *
 * ⚠ Under load the route answers **503 + `Retry-After`** with the pt-BR
 * `PREVIA_BUSY_MESSAGE` (D9 — the prévia is the one that yields). Opening in a
 * new tab surfaces that text directly, which is honest and already in pt-BR; a
 * richer in-page retry would need a client island and is not worth one here.
 *
 * ---
 *
 * ⭐ **`phiCapable` adds a SECOND LINK, never a toggle** (ADR 0144 D9).
 *
 * A toggle would make the identified prévia reachable by flipping a control and
 * pressing the same button — one act, two possible meanings, and no moment where
 * the user states which one they intended. Two links make choosing the
 * identified variant a distinct, named act with its own destination.
 *
 * ⚠ **It is deliberately NOT the mint dialog's shape.** The mint has a confirm
 * step, so a checkbox inside it is still followed by an explicit commit. A prévia
 * link has no confirm step at all — a checkbox beside a single link would let a
 * mis-click on the box silently change what the next click produces.
 *
 * ⚠ The identified link is NOT visually demoted. Hiding it behind lesser styling
 * would be safety theatre: it does not reduce the authority required (the same
 * `app.can_read_case_patient` door decides), it only makes the legitimate reader
 * hunt. What governs access is the door; what this component governs is whether
 * the user knows which variant they asked for.
 *
 * ⛔ **The caller never passes a kind here** — `phiCapable` is read from the
 * provider registry by the server page (ADR 0104 D9 v2-readiness). A `sourceKind
 * === "case"` test in this file would be a phase-blocking review finding.
 */
export function PreviaLink({
  sourceKind,
  sourceId,
  phiCapable,
}: {
  sourceKind: PrintedDocumentSourceKind;
  sourceId: string;
  /** Whether this kind's provider declares it can print patient identifiers.
   * DERIVED from `PDF_PROVIDERS` by the server page — never from the kind. */
  phiCapable: boolean;
}) {
  const helperId = "previa-helper";
  const phiHelperId = "previa-phi-helper";

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-col items-start gap-1.5">
        <a
          href={previaHref(sourceKind, sourceId)}
          target="_blank"
          rel="noopener noreferrer"
          aria-describedby={helperId}
          className={PREVIA_LINK_CLASS}
        >
          <Printer aria-hidden="true" className="size-4" />
          {PREVIA_BUTTON_LABEL}
        </a>
        <p
          id={helperId}
          className="max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground"
        >
          {PREVIA_HELPER_COPY}
        </p>
      </div>

      {phiCapable ? (
        <div className="flex flex-col items-start gap-1.5">
          <a
            href={previaHref(sourceKind, sourceId, true)}
            target="_blank"
            rel="noopener noreferrer"
            aria-describedby={phiHelperId}
            className={PREVIA_LINK_CLASS}
          >
            <ShieldAlert aria-hidden="true" className="size-4 text-warning" />
            {PREVIA_PHI_BUTTON_LABEL}
          </a>
          <p
            id={phiHelperId}
            className="max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground"
          >
            {PREVIA_PHI_HELPER_COPY}
          </p>
        </div>
      ) : null}
    </div>
  );
}

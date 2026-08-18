import { Printer } from "lucide-react";

import {
  PREVIA_BUTTON_LABEL,
  PREVIA_HELPER_COPY,
  previaHref,
} from "@/components/printing/labels";
import type { PrintedDocumentSourceKind } from "@/lib/pdf/types";

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
 */
export function PreviaLink({
  sourceKind,
  sourceId,
}: {
  sourceKind: PrintedDocumentSourceKind;
  sourceId: string;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <a
        href={previaHref(sourceKind, sourceId)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <Printer aria-hidden="true" className="size-4" />
        {PREVIA_BUTTON_LABEL}
      </a>
      <p className="max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">
        {PREVIA_HELPER_COPY}
      </p>
    </div>
  );
}

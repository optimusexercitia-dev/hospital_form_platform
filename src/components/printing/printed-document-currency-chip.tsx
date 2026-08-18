import { AlertTriangle, History } from "lucide-react";

import { cn } from "@/lib/utils";
import { printCurrencyChipLabel } from "@/components/printing/labels";
import type { PrintCurrency } from "@/components/printing/currency";

/**
 * Currency pill for one printed document (ADR 0126 D2/D4) — the SIBLING of
 * `PrintedDocumentStatusChip`, and deliberately not an extension of it.
 *
 * ⛔ **Registry status and currency are different facts and must not share a
 * chip.** `status` records deliberate acts (re-mint supersession, revocation);
 * currency is derived at read time from the source. ADR 0126 D3 makes
 * `active` + NOT current a new and legal combination — so a single chip would
 * have to choose which fact to hide, and the row would look ordinary in exactly
 * the case that needs attention.
 *
 * Renders NOTHING for `current` (the ordinary case — chipping every row would
 * bury the one that matters) and nothing for `notApplicable` (a revoked document
 * says nothing about currency; the door performs no join for that arm).
 *
 * State is carried by icon + text + shape, never colour alone (design system
 * §6), matching the status chip's idiom so a "past state" reads the same
 * everywhere.
 *
 * ⚠ **Not yet mounted.** `PrintedDocumentSummary` does not carry currency —
 * `lookup_printed_document` has no such column today (measured). This ships as a
 * tested presentation primitive awaiting its data, the same way
 * `renderPreviaPdf` shipped awaiting its route. The panel mounts it when the
 * query widens; until then the panel states nothing about currency, which beats
 * stating "não apurada" on every row.
 */
export function PrintedDocumentCurrencyChip({
  currency,
  className,
}: {
  currency: PrintCurrency;
  className?: string;
}) {
  const label = printCurrencyChipLabel(currency);
  if (!label) return null;

  const Icon = currency.kind === "outdated" ? History : AlertTriangle;

  return (
    <span
      data-currency={currency.kind}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase",
        // Muted, not a warning tone: a print from a superseded revision is not
        // an error — it is authentic paper that is no longer the latest. The
        // same distinction the public verification page is required to preserve.
        currency.kind === "outdated"
          ? "bg-muted text-muted-foreground"
          : "bg-warning/12 text-warning",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {label}
    </span>
  );
}

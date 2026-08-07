import { Ban, CheckCircle2, History } from "lucide-react";

import { cn } from "@/lib/utils";
import { DOCUMENT_STATUS_LABELS } from "@/components/printing/labels";
import type { PrintedDocumentStatus } from "@/lib/pdf/types";

const CHIP_STYLES: Record<PrintedDocumentStatus, string> = {
  active: "bg-success/12 text-success",
  superseded: "bg-muted text-muted-foreground",
  revoked: "bg-destructive/10 text-destructive",
};

const CHIP_ICONS: Record<PrintedDocumentStatus, typeof CheckCircle2> = {
  active: CheckCircle2,
  superseded: History,
  revoked: Ban,
};

/**
 * Lifecycle pill for one printed document (ADR 0104 D6).
 *
 * Status is carried by icon + text + shape, never colour alone (design system
 * §6), and matches the platform's existing pill idiom (`SupersessionBadgePill`)
 * so a "past state" reads the same everywhere. `superseded` is deliberately the
 * MUTED treatment rather than a warning one: a superseded print is not a
 * problem, it is simply no longer the latest — the same distinction the public
 * verification page is required to preserve.
 */
export function PrintedDocumentStatusChip({
  status,
  className,
}: {
  status: PrintedDocumentStatus;
  className?: string;
}) {
  const Icon = CHIP_ICONS[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase",
        CHIP_STYLES[status],
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {DOCUMENT_STATUS_LABELS[status]}
    </span>
  );
}

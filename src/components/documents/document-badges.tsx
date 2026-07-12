import { cn } from "@/lib/utils";
import type { DocStatus, DocType } from "@/lib/documents/types";
import {
  DOC_STATUS_LABELS,
  DOC_TYPE_LABELS,
} from "@/lib/documents/types";

/**
 * Shared, server-safe status/type chips for controlled documents (Phase 17).
 * No badge primitive exists in the design system; the indicators area builds
 * these inline with design tokens, so we mirror that here. Reused by the register
 * (F1), the detail view (F3), and the hospital-wide rollup (F6) so a document's
 * lifecycle reads identically everywhere.
 *
 * Pure presentational — no client state, safe to render in Server Components.
 */

/** Tailwind token classes per lifecycle status (background + text + border). */
const STATUS_CLASSES: Record<DocStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  in_approval: "bg-warning/15 text-warning",
  effective: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  obsolete: "bg-muted text-muted-foreground line-through decoration-1",
};

/**
 * A document/version lifecycle chip. `status` is the derived header status (F1/F6)
 * or a version's own status (F3). Text is pt-BR via {@link DOC_STATUS_LABELS}.
 */
export function DocumentStatusChip({
  status,
  className,
}: {
  status: DocStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_CLASSES[status],
        className,
      )}
    >
      {DOC_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * A document-type badge (Política / POP / Protocolo / …). Neutral, quieter than
 * the status chip so the two never compete. Text is pt-BR via
 * {@link DOC_TYPE_LABELS}.
 */
export function DocumentTypeBadge({
  docType,
  className,
}: {
  docType: DocType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium text-foreground/80",
        className,
      )}
    >
      {DOC_TYPE_LABELS[docType]}
    </span>
  );
}

/**
 * A small "review overdue" flag, shown only when a document's `reviewDueDate` has
 * passed. Uses the destructive token so it reads as an alert without shouting.
 */
export function ReviewOverdueChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive",
        className,
      )}
    >
      Revisão vencida
    </span>
  );
}

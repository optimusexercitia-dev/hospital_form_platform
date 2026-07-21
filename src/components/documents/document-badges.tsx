import { cn } from "@/lib/utils";
import type { DocStatus, DocType, ObsoleteKind } from "@/lib/documents/types";
import {
  DOC_STATUS_LABELS,
  DOC_TYPE_LABELS,
  OBSOLETE_KIND_LABELS,
} from "@/lib/documents/types";

/**
 * The display-only "Em revisão" state — an `effective` document that carries an
 * open draft/in-approval version above its in-force one (ADR 0081; derived FE-side,
 * NOT a stored status). It reads as amber (`warning`), the handoff's "under
 * revision" tone.
 */
export type DerivedDocStatus = DocStatus | "revision";

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
  effective: "bg-success/15 text-success",
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
 * A document/version chip that also renders the derived "Em revisão" state. Use
 * on the register (F-A) and detail (F-C) where an `effective` header may carry an
 * open revision; falls through to {@link DocumentStatusChip} for the 4 canonical
 * statuses.
 */
export function DerivedStatusChip({
  status,
  className,
}: {
  status: DerivedDocStatus;
  className?: string;
}) {
  if (status === "revision") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning",
          className,
        )}
      >
        Em revisão
      </span>
    );
  }
  return <DocumentStatusChip status={status} className={className} />;
}

/**
 * A chip distinguishing WHY an obsolete version was archived — `Substituído`
 * (superseded) vs `Descontinuado` (retired). pt-BR via {@link OBSOLETE_KIND_LABELS}.
 * Neutral/muted so it reads as an archival note, not an alert.
 */
export function ObsoleteKindChip({
  kind,
  className,
}: {
  kind: ObsoleteKind;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {OBSOLETE_KIND_LABELS[kind]}
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

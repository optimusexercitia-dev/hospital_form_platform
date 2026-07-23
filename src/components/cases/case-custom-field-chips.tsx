"use client";

import type { CaseCustomFieldValue } from "@/lib/queries/cases";
import { cn } from "@/lib/utils";
import { customFieldDisplay } from "@/components/cases/custom-field-input";

/**
 * Compact "label: value" chips for a case's `show_in_list` custom-field values
 * (ADR 0083 D8), shared by the cases table cell + the kanban card. Because
 * different processes yield heterogeneous fields, each row renders its own set;
 * a blank value is skipped, and a single-select code resolves to its option
 * label. Renders nothing when the row carries no non-blank values.
 */
export function CaseCustomFieldChips({
  fields,
  className,
  emptyDash = true,
}: {
  fields: CaseCustomFieldValue[];
  className?: string;
  /** Render an em-dash when there are no non-blank values (table cell); `false`
   * renders nothing (compact kanban card). Default `true`. */
  emptyDash?: boolean;
}) {
  const shown = fields
    .map((f) => ({ field: f, display: customFieldDisplay(f) }))
    .filter((x) => x.display !== "");

  if (shown.length === 0) {
    return emptyDash ? <span className="text-muted-foreground/70">—</span> : null;
  }

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {shown.map(({ field, display }) => (
        <span
          key={field.id}
          className="inline-flex max-w-full items-baseline gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[0.7rem] text-muted-foreground"
        >
          <span className="font-medium text-foreground/80">{field.label}:</span>
          <span className="truncate">{display}</span>
        </span>
      ))}
    </div>
  );
}

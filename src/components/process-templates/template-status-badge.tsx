import { cn } from "@/lib/utils";

import type { ProcessTemplateStatus } from "@/lib/queries/process-templates";

/**
 * Small status pill for a process template (Rascunho / Ativo / Arquivado).
 * Mirrors the form-version {@link StatusBadge} language but for the template
 * lifecycle (`draft → active → archived`): `active` is the "live" state and gets
 * the petrol accent fill; `draft` reads as a warm in-progress amber; `archived`
 * is muted/neutral. Pure presentational, Server-Component-safe; the type is
 * imported from the query layer so the union can't drift.
 */
const STATUS_LABEL: Record<ProcessTemplateStatus, string> = {
  draft: "Rascunho",
  active: "Ativo",
  archived: "Arquivado",
};

const STATUS_STYLES: Record<ProcessTemplateStatus, string> = {
  active: "bg-accent text-accent-foreground",
  draft: "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200",
  archived: "bg-muted text-muted-foreground",
};

export function TemplateStatusBadge({
  status,
  className,
}: {
  status: ProcessTemplateStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase",
        STATUS_STYLES[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

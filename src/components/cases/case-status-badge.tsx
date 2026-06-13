import { cn } from "@/lib/utils";

import type { CaseStatus } from "@/lib/queries/cases";

/**
 * Small status pill for a case (Aberto / Concluído / Cancelado). `aberto` is the
 * live state (petrol accent); `concluido` a calm positive; `cancelado` muted.
 * Pure presentational, Server-Component-safe; the union is imported from the
 * query layer so it can't drift.
 */
const STATUS_LABEL: Record<CaseStatus, string> = {
  aberto: "Aberto",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const STATUS_STYLES: Record<CaseStatus, string> = {
  aberto: "bg-accent text-accent-foreground",
  concluido: "bg-primary/10 text-primary dark:bg-primary/15",
  cancelado: "bg-muted text-muted-foreground",
};

export function CaseStatusBadge({
  status,
  className,
}: {
  status: CaseStatus;
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

import { CheckCircle2, CircleDashed, MinusCircle, PlayCircle } from "lucide-react";

import type { CasePhaseStatus } from "@/lib/queries/cases";
import { cn } from "@/lib/utils";

/**
 * Status pill for one phase of a case. Conveys state by ICON + TEXT + SHAPE
 * (never colour alone, per the a11y rules): pendente / ativa / concluída / não
 * necessária. The petrol accent is reserved for the "live" (ativa) state;
 * concluída reads as a calm positive, pendente as neutral, não necessária as
 * muted. A separate `recommended` highlight is layered by the consumer (a ring),
 * not encoded here — `recommended` is independent of status.
 *
 * Pure presentational, Server-Component-safe. The status union is imported from
 * the query layer so it can't drift.
 */
const STATUS_META: Record<
  CasePhaseStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  pendente: {
    label: "Pendente",
    icon: CircleDashed,
    className: "bg-muted text-muted-foreground",
  },
  ativa: {
    label: "Ativa",
    icon: PlayCircle,
    className: "bg-accent text-accent-foreground",
  },
  concluida: {
    label: "Concluída",
    icon: CheckCircle2,
    className:
      "bg-primary/10 text-primary dark:bg-primary/15",
  },
  nao_necessaria: {
    label: "Não necessária",
    icon: MinusCircle,
    className: "bg-muted/60 text-muted-foreground/80",
  },
};

export function PhaseStatusPill({
  status,
  className,
}: {
  status: CasePhaseStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase",
        meta.className,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {meta.label}
    </span>
  );
}

/** Small standalone "recomendada" highlight chip (status-independent). */
export function RecommendedChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[0.7rem] font-medium tracking-wide text-secondary-foreground uppercase",
        className,
      )}
    >
      Recomendada
    </span>
  );
}

import {
  Ban,
  CheckCircle2,
  CircleDashed,
  MinusCircle,
  PenLine,
  PlayCircle,
} from "lucide-react";

import type { CasePhaseStatus } from "@/lib/queries/cases";
import { cn } from "@/lib/utils";

/**
 * Status pill for one phase of a case. Conveys state by ICON + TEXT + SHAPE
 * (never colour alone, per the a11y rules): pendente / ativa / concluída / não
 * necessária / anulada. The petrol accent is reserved for the "live" (ativa)
 * state; concluída reads as a calm positive, pendente as neutral, não necessária
 * as muted, and anulada (voided — Case Correction Lifecycle, ADR 0085) as a muted
 * destructive terminal. A separate `recommended` highlight is layered by the
 * consumer (a ring), not encoded here — `recommended` is independent of status.
 *
 * Pure presentational, Server-Component-safe. The status union is imported from
 * the query layer so it can't drift.
 */
const STATUS_META: Record<
  CasePhaseStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  pending: {
    label: "Pendente",
    icon: CircleDashed,
    className: "bg-muted text-muted-foreground",
  },
  active: {
    label: "Ativa",
    icon: PlayCircle,
    className: "bg-accent text-accent-foreground",
  },
  completed: {
    label: "Concluída",
    icon: CheckCircle2,
    className:
      "bg-primary/10 text-primary dark:bg-primary/15",
  },
  not_required: {
    label: "Não necessária",
    icon: MinusCircle,
    className: "bg-muted/60 text-muted-foreground/80",
  },
  voided: {
    label: "Anulada",
    icon: Ban,
    className: "bg-destructive/10 text-destructive",
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

/**
 * "Em correção" chip — a completed phase (or narrative) with an OPEN correction
 * request (Case Correction Lifecycle, ADR 0085). Driven by open-request PRESENCE,
 * NOT by phase status: the phase stays `completed` for the whole correction, so this
 * is a companion signal layered beside the status pill, never a status value.
 */
export function InCorrectionChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[0.7rem] font-medium tracking-wide text-warning uppercase",
        className,
      )}
    >
      <PenLine aria-hidden="true" className="size-3" />
      Em correção
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

import { CheckCircle2, PenLine } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A case narrative's lifecycle status (Case Access Control increment, ADR 0033
 * D5): `aberta` (assignable + fillable) → `concluida` (body frozen; a coordinator
 * may reopen). A stable ASCII union mirrored from the DB `case_narratives.status`
 * check. Kept here (pure, no server import) so the "Meus Casos" card, the detail
 * narrative card, and the focused editor share one source of labels + styling.
 */
export type NarrativeStatus = "aberta" | "concluida";

const STATUS_META: Record<
  NarrativeStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  aberta: {
    label: "Aberta",
    icon: PenLine,
    className: "bg-warning/15 text-warning",
  },
  concluida: {
    label: "Concluída",
    icon: CheckCircle2,
    className: "bg-success/12 text-success dark:bg-success/15",
  },
};

/** Narrow an arbitrary status string to a {@link NarrativeStatus} (defaults `aberta`). */
export function asNarrativeStatus(status: string): NarrativeStatus {
  return status === "concluida" ? "concluida" : "aberta";
}

/**
 * Status pill for a case narrative — conveys state by ICON + TEXT + SHAPE (never
 * colour alone, per the a11y rules). Pure presentational, Server-Component-safe.
 */
export function NarrativeStatusPill({
  status,
  className,
}: {
  status: NarrativeStatus;
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

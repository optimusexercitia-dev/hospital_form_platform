import { AlertTriangle, CalendarCheck2, CalendarOff, Settings2 } from "lucide-react";

import type { CadenceStatus } from "@/lib/charters/types";
import { cn } from "@/lib/utils";
import { CADENCE_STATUS_LABELS } from "./labels";

/**
 * The live meeting-cadence status badge (S4·CH, Phase 21 — ADR 0080 D5). Pure,
 * server-safe presentational chip: it maps the four cadence keys to distinct pt-BR
 * labels + tones. Status is conveyed by icon + text + colour (never colour alone —
 * accessibility). `em_atraso` reads as attention (warning), `em_dia` as positive
 * (success), the two never-configured/never-met states are muted/neutral.
 *
 * Sourced from `getMeetingCadenceStatus` (the member-scoped DEFINER RPC); the caller
 * omits the badge entirely when that returns `null` (non-member). No PHI (Rule 12).
 */

const CADENCE_TONE: Record<
  CadenceStatus,
  { className: string; Icon: typeof AlertTriangle }
> = {
  em_dia: { className: "bg-success/12 text-success", Icon: CalendarCheck2 },
  em_atraso: { className: "bg-warning/15 text-warning", Icon: AlertTriangle },
  sem_reunioes: { className: "bg-muted text-muted-foreground", Icon: CalendarOff },
  sem_regimento: { className: "bg-muted text-muted-foreground", Icon: Settings2 },
};

export function CadenceStatusBadge({
  status,
  className,
}: {
  status: CadenceStatus;
  className?: string;
}) {
  const { className: tone, Icon } = CADENCE_TONE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
        tone,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {CADENCE_STATUS_LABELS[status]}
    </span>
  );
}

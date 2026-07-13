import { CheckCircle2, History } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SupersessionBadge as SupersessionBadgeValue } from "@/lib/queries/submissions";

/**
 * Supersession pill (SUP / ADR 0074) — shown in the submissions list AND the
 * detail header (plan §5). `'substituido'`: this response has been corrected
 * (a submitted successor points at it) — muted, matching the platform's other
 * "past state" pills (e.g. "Em andamento"). `'atual'`: this response IS the
 * correction — accent token, matching "Fase de caso" and other emphasis pills.
 * Renders nothing for `null` (no supersession relationship).
 *
 * Status is conveyed by icon + text + shape, never color alone (mirrors
 * `SubmissionRow`'s existing badges).
 */
export function SupersessionBadgePill({
  badge,
  className,
}: {
  badge: SupersessionBadgeValue;
  className?: string;
}) {
  if (badge === "substituido") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase",
          className,
        )}
      >
        <History aria-hidden="true" className="size-3" />
        Substituído
      </span>
    );
  }

  if (badge === "atual") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-accent-foreground uppercase",
          className,
        )}
      >
        <CheckCircle2 aria-hidden="true" className="size-3" />
        Atual
      </span>
    );
  }

  return null;
}

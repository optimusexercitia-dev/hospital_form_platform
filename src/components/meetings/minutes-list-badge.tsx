import { Loader2, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { MINUTES_UI } from "./minutes-labels";

/**
 * F4 — the meetings-list row badge for a meeting with an active/reviewable audio job
 * (ADR 0099 D11). Pure presentational pill, Server-Component-safe (no `"use client"`,
 * same tier as `meeting-badges.tsx`'s exports) — `meetings-list.tsx` renders it inline
 * per row from the already-batched `minutesJobStatus` field, no data fetching here.
 */
export function MinutesListBadge({
  status,
  className,
}: {
  status: "processing" | "done";
  className?: string;
}) {
  const done = status === "done";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase",
        done ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {done ? (
        <Sparkles aria-hidden="true" className="size-3" />
      ) : (
        <Loader2 aria-hidden="true" className="size-3 animate-spin" />
      )}
      {done ? MINUTES_UI.f4BadgeDone : MINUTES_UI.f4BadgeProcessing}
    </span>
  );
}

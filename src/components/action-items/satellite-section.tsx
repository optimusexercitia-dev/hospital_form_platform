import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Shared presentational shell for the three satellite sub-panels (reminders /
 * updates / checklist) so they read as one cohesive block: a compact uppercase
 * micro-heading with a leading icon and an optional count pill. Pure
 * presentational, Server-Component-safe.
 */
export function SatelliteSection({
  icon: Icon,
  title,
  count,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  /** Count pill next to the heading; omitted/`0` renders no pill. */
  count?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-2.5", className)}>
      <header className="flex items-center gap-1.5">
        <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </h4>
        {count != null && count > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted-foreground tabular-nums">
            {count}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

/** Muted, dashed empty-state line shared by the satellite sub-panels. */
export function SatelliteEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-3 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}

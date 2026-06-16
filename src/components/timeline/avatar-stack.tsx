"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { TimelinePerson } from "@/lib/timeline/event-model";
import { cn } from "@/lib/utils";

/**
 * Overlapping initials avatars (README §5). Reuses the shadcn `Avatar`
 * primitive; in this phase we only render initials (no uploaded images yet).
 * Each avatar after the first overlaps the previous by `-7px` and carries a 2px
 * surface ring so the stack reads as distinct circles. When the roster exceeds
 * `max`, a trailing "+N" counter chip is shown.
 *
 * Used on cards/bars (the primary owner — typically one avatar) and in the Sheet
 * (the full roster placeholder).
 */
export function AvatarStack({
  people,
  max = 4,
  size = "sm",
  className,
}: {
  people: TimelinePerson[];
  max?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  if (people.length === 0) return null;

  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;
  const dim = size === "sm" ? "size-6 text-[0.625rem]" : "size-8 text-xs";

  return (
    <div className={cn("flex items-center", className)}>
      {shown.map((person, i) => (
        <Avatar
          key={`${person.initials}-${i}`}
          title={person.name}
          className={cn(
            dim,
            "ring-2 ring-card",
            i > 0 && "-ml-1.5",
          )}
        >
          <AvatarFallback className="bg-accent font-medium text-accent-foreground">
            {person.initials}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            dim,
            "-ml-1.5 inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-card",
          )}
          aria-label={`mais ${overflow}`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

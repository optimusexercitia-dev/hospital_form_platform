import { cn } from "@/lib/utils";

/**
 * A committee member title badge (ADR 0051 Decision 6) — "Presidente",
 * "Vice-Presidente", "Secretário(a)"… DISPLAY-ONLY, no access semantics.
 * Rendered on the member-management page, member overview, meeting attendee
 * lists, and meeting signature blocks / exported atas.
 *
 * A neutral outlined pill (distinct from {@link RoleBadge}'s filled pills, so a
 * title never reads as an access-role indicator).
 */
export function TitleBadge({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-primary/30 bg-primary/8 px-2 py-0.5 text-[0.7rem] font-medium text-primary",
        className,
      )}
    >
      {name}
    </span>
  );
}

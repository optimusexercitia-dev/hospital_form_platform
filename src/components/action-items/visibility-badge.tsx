import { cn } from "@/lib/utils";
import type { VisibilityScope } from "@/lib/queries/action-items";

import { VISIBILITY_BADGE_META } from "./satellite-labels";

/**
 * A small, informational read-scope badge for a shared `action_items` row
 * (ADR 0050). Rendered ONLY for the two restricted scopes — `case_restricted`
 * and `assignees_only` — so a `committee` (the default) row stays unbadged and
 * the badge always means "narrower than the whole committee can see".
 *
 * This is purely informational, NOT an access-control affordance: every row it
 * decorates is already one the viewer can read (the RLS did the gating). It just
 * makes the scope legible where a list mixes scopes ("Meus itens de ação").
 * Pure presentational, Server-Component-safe.
 */
export function VisibilityScopeBadge({
  scope,
  className,
}: {
  scope: VisibilityScope;
  className?: string;
}) {
  if (scope === "committee") return null;

  const meta = VISIBILITY_BADGE_META[scope];
  const Icon = meta.icon;

  return (
    <span
      title={meta.title}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-medium",
        meta.className,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {meta.label}
    </span>
  );
}

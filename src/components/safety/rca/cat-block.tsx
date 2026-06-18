"use client";

import { Plus } from "lucide-react";

import {
  FISHBONE_CATEGORY_LABELS,
  type FishboneCategory,
  type RcaFactor,
} from "@/lib/safety/rca-types";
import { addRcaFactor } from "@/lib/safety/rca-actions";
import { cn } from "@/lib/utils";
import { useSafetyAction } from "../use-safety-action";
import { CauseCard } from "./cause-card";
import { CATEGORY_VISUAL } from "./rca-visuals";

/**
 * One fishbone CATEGORY block (README_rca §5.1): a header (icon chip in the
 * category color + label + count badge) and the vertical list of its
 * {@link CauseCard}s, plus a text "+ Adicionar fator" that appends a blank factor
 * (`addRcaFactor`, focused for inline editing on the next render). The interactive
 * heart of the diagram — the ribs/spine around it are decorative.
 */
export function CatBlock({
  rcaId,
  category,
  factors,
  canEdit,
}: {
  rcaId: string;
  category: FishboneCategory;
  factors: RcaFactor[];
  canEdit: boolean;
}) {
  const visual = CATEGORY_VISUAL[category];
  const Icon = visual.icon;
  const { run, isPending } = useSafetyAction();

  return (
    <section
      aria-label={FISHBONE_CATEGORY_LABELS[category]}
      className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3"
    >
      <header className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
            visual.chip,
          )}
        >
          <Icon aria-hidden="true" className={cn("size-3.5", visual.iconText)} />
          {FISHBONE_CATEGORY_LABELS[category]}
        </span>
        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
          {factors.length}
        </span>
      </header>

      <div className="flex flex-col gap-1.5">
        {factors.map((f) => (
          <CauseCard key={f.id} factor={f} category={category} canEdit={canEdit} />
        ))}
        {factors.length === 0 && !canEdit && (
          <p className="px-1 py-2 text-xs text-muted-foreground italic">
            Sem fatores.
          </p>
        )}
      </div>

      {canEdit && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => addRcaFactor(rcaId, { category, text: "" }))}
          className={cn(
            "inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition-colors hover:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-50",
            visual.iconText,
          )}
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Adicionar fator
        </button>
      )}
    </section>
  );
}

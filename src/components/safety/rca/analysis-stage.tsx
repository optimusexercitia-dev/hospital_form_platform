"use client";

import { useState } from "react";
import { Fish, ListChecks } from "lucide-react";

import type {
  FishboneCategory,
  RcaFactor,
  RcaWhyChain,
} from "@/lib/safety/rca-types";
import { cn } from "@/lib/utils";
import { Fishbone } from "./fishbone";
import { WhysPanel } from "./whys-panel";

type SubView = "fishbone" | "whys";

/**
 * Stage 2 — Causal analysis (README_rca §5). A segmented toggle switches between the
 * Ishikawa **Fishbone** and the **5 Whys** (each with a count badge). Key factors
 * flagged in the fishbone drive the 5-Whys chains.
 */
export function AnalysisStage({
  rcaId,
  effect,
  factorsByCategory,
  factorCount,
  keyFactors,
  canEdit,
}: {
  rcaId: string;
  effect: string;
  factorsByCategory: Map<FishboneCategory, RcaFactor[]>;
  factorCount: number;
  keyFactors: { factor: RcaFactor; chain: RcaWhyChain | null }[];
  canEdit: boolean;
}) {
  const [view, setView] = useState<SubView>("fishbone");

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Modo de análise causal"
        className="flex w-fit items-center gap-1 rounded-lg bg-muted p-0.5"
      >
        <Tab
          active={view === "fishbone"}
          onClick={() => setView("fishbone")}
          icon={<Fish aria-hidden="true" className="size-3.5" />}
          label="Ishikawa"
          count={factorCount}
        />
        <Tab
          active={view === "whys"}
          onClick={() => setView("whys")}
          icon={<ListChecks aria-hidden="true" className="size-3.5" />}
          label="5 porquês"
          count={keyFactors.length}
        />
      </div>

      {view === "fishbone" ? (
        <Fishbone
          rcaId={rcaId}
          effect={effect}
          factorsByCategory={factorsByCategory}
          canEdit={canEdit}
        />
      ) : (
        <WhysPanel keyFactors={keyFactors} canEdit={canEdit} />
      )}
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
        active
          ? "bg-card text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
      <span className="rounded-full bg-muted px-1.5 text-[0.7rem] font-semibold tabular-nums">
        {count}
      </span>
    </button>
  );
}

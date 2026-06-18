import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { CapaPlan } from "@/lib/safety/capa-types";
import { CapaClassificationChip, CapaStatusChip } from "./capa-badges";
import { formatDate } from "../format";

/**
 * A compact CAPA-plan summary card linking to its workspace. Used in the RCA stage-4
 * list and the event detail. Server-Component-safe (no client hooks).
 */
export function CapaPlanCard({ plan }: { plan: CapaPlan }) {
  return (
    <Link
      href={`/admin/nsp/capa/${plan.id}`}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="font-mono text-xs text-muted-foreground">{plan.code}</span>
        <div className="flex flex-wrap items-center gap-2">
          <CapaStatusChip status={plan.status} />
          <CapaClassificationChip classification={plan.classification} />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          Aberto em {formatDate(plan.openedAt)}
        </span>
      </div>
      <ArrowRight
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

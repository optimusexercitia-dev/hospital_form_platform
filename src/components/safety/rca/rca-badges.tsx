import { AlertTriangle, CircleDot } from "lucide-react";

import {
  RCA_MEMBER_ROLE_LABELS,
  RCA_STATUS_LABELS,
  ROOT_CAUSE_TYPE_LABELS,
  type RcaMemberRole,
  type RcaStatus,
  type RootCauseType,
} from "@/lib/safety/rca-types";
import { cn } from "@/lib/utils";

const CHIP_BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium";

const STATUS_CLASS: Record<RcaStatus, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  in_progress: "border-primary/30 bg-primary/10 text-primary",
  in_review: "border-warning/30 bg-warning/12 text-warning",
  completed: "border-success/30 bg-success/12 text-success",
};

/** The RCA lifecycle chip. */
export function RcaStatusChip({ status }: { status: RcaStatus }) {
  return (
    <span className={cn(CHIP_BASE, STATUS_CLASS[status])}>
      <CircleDot aria-hidden="true" className="size-3.5" />
      {RCA_STATUS_LABELS[status]}
    </span>
  );
}

/** The team-member role badge (neutral; observer flagged read-only-ish in copy). */
export function RcaMemberRoleBadge({ role }: { role: RcaMemberRole }) {
  return (
    <span
      className={cn(
        CHIP_BASE,
        role === "observer"
          ? "border-border bg-muted text-muted-foreground"
          : "border-primary/25 bg-primary/8 text-primary",
      )}
    >
      {RCA_MEMBER_ROLE_LABELS[role]}
    </span>
  );
}

/** Root cause (danger) vs Contributing factor (warning) pill. */
export function RootCauseTypePill({ type }: { type: RootCauseType }) {
  return (
    <span
      className={cn(
        CHIP_BASE,
        type === "root"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-warning/30 bg-warning/12 text-warning",
      )}
    >
      {type === "root" && (
        <AlertTriangle aria-hidden="true" className="size-3.5" />
      )}
      {ROOT_CAUSE_TYPE_LABELS[type]}
    </span>
  );
}

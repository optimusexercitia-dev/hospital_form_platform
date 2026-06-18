/**
 * Patient-safety status / severity / owner CHIPS (Phase 14a). Small, pure
 * presentational pills used across the read-back list, the NSP inbox, and the
 * event detail. Convey state by icon + text + shape, never colour alone (design
 * system §2). pt-BR labels come from the frozen `*_LABELS` maps.
 *
 * Server-Component-safe (no client hooks) so list/detail server pages render
 * them directly.
 */

import {
  CircleCheck,
  CircleDot,
  CircleSlash,
  Clock3,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

import {
  EVENT_STATUS_LABELS,
  OWNER_KIND_LABELS,
  SUSPECTED_HARM_LABELS,
  type EventStatus,
  type OwnerKind,
  type SuspectedHarmLevel,
} from "@/lib/safety/types";
import { cn } from "@/lib/utils";
import { eventStatusChipClass, suspectedHarmChipClass } from "./format";

const STATUS_ICON: Record<EventStatus, LucideIcon> = {
  reported: Clock3,
  acknowledged: CircleDot,
  triaged: ListChecks,
  closed: CircleCheck,
  cancelled: CircleSlash,
};

const CHIP_BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium";

/** The event lifecycle chip (icon + pt-BR label + tone). */
export function EventStatusChip({ status }: { status: EventStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={cn(CHIP_BASE, eventStatusChipClass(status))}>
      <Icon aria-hidden="true" className="size-3.5" />
      {EVENT_STATUS_LABELS[status]}
    </span>
  );
}

/** The reporter's suspected-harm chip (the queue's priority signal). */
export function SuspectedHarmChip({ level }: { level: SuspectedHarmLevel }) {
  return (
    <span className={cn(CHIP_BASE, suspectedHarmChipClass(level))}>
      {SUSPECTED_HARM_LABELS[level]}
    </span>
  );
}

/** The current-owner chip (NSP vs a holding commission). Neutral tone. */
export function OwnerChip({
  ownerKind,
  commissionName,
}: {
  ownerKind: OwnerKind;
  /** Holding commission name when `ownerKind = 'commission'`. */
  commissionName?: string | null;
}) {
  const label =
    ownerKind === "commission" && commissionName
      ? commissionName
      : OWNER_KIND_LABELS[ownerKind];
  return (
    <span
      className={cn(
        CHIP_BASE,
        "border-border bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

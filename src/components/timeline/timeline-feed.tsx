"use client";

import type { CaseTimelineEvent } from "@/lib/timeline/event-model";
import {
  anchor,
  durationDays,
  statusOf,
} from "@/lib/timeline/event-model";
import { cn } from "@/lib/utils";
import { PhaseResultBadge } from "@/components/cases/phase-result-badge";
import { timelineResultToResolved } from "@/components/cases/phase-result-options";

import { AvatarStack } from "./avatar-stack";
import type { TimelineDensity } from "./timeline-density-switch";
import {
  durationSuffix,
  formatEventDate,
  formatFull,
  formatShort,
  pillFor,
} from "./format";
import { EventIcon, TYPE_META } from "./type-meta";

/**
 * Feed (vertical) layout — README §4. A continuous spine threads equal-height
 * nodes; duration appears ONLY as `· N dias` text (never as height — the
 * deliberate contrast with the Duration view). Events are oldest-first by
 * `anchor`. A "Hoje" divider is inserted immediately before the first `upcoming`
 * event (open cases only — a closed case has no reference, so no upcoming and no
 * divider).
 *
 * Pure presentational: a function of `(events, reference, density)`. Each card is
 * a button that opens the detail Sheet via `onSelect`.
 */
export function TimelineFeed({
  events,
  reference,
  density,
  onSelect,
}: {
  events: CaseTimelineEvent[];
  reference: string | null;
  density: TimelineDensity;
  onSelect: (event: CaseTimelineEvent) => void;
}) {
  const ordered = [...events].sort((a, b) => anchor(a).localeCompare(anchor(b)));
  const firstUpcomingIdx = reference
    ? ordered.findIndex((e) => statusOf(e, reference) === "upcoming")
    : -1;

  const gap = density === "compact" ? "gap-2.5" : "gap-4";

  return (
    <ol
      className={cn("relative flex flex-col", gap)}
      aria-label="Linha do tempo do caso"
    >
      {ordered.map((event, idx) => (
        <li key={event.id} className="contents">
          {idx === firstUpcomingIdx && reference ? (
            <TodayDivider reference={reference} />
          ) : null}
          <FeedRow
            event={event}
            reference={reference}
            density={density}
            onSelect={onSelect}
            index={idx}
          />
        </li>
      ))}
    </ol>
  );
}

function FeedRow({
  event,
  reference,
  density,
  onSelect,
  index,
}: {
  event: CaseTimelineEvent;
  reference: string | null;
  density: TimelineDensity;
  onSelect: (event: CaseTimelineEvent) => void;
  index: number;
}) {
  const meta = TYPE_META[event.type];
  const status = statusOf(event, reference);
  const pill = pillFor(event, status);
  const isPhase = event.type === "phase";
  const isUpcoming = status === "upcoming";
  const anchorIso = anchor(event);
  const days = durationDays(event, reference ?? anchorIso);

  return (
    <div
      data-rise
      style={{ "--rise-delay": `${index * 60}ms` } as React.CSSProperties}
      className="grid grid-cols-[3rem_1.875rem_1fr] items-stretch"
    >
      {/* Date rail */}
      <div className="flex flex-col items-end pr-2 pt-2 text-right">
        <span className="text-base leading-none font-semibold tabular-nums">
          {formatShort(anchorIso).split(" ")[0]}
        </span>
        <span className="mt-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground/80 uppercase">
          {monthLabel(anchorIso)}
        </span>
      </div>

      {/* Spine + node */}
      <div className="relative flex justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border"
        />
        <span
          aria-hidden="true"
          data-node
          className={cn(
            "relative z-10 mt-1.5 inline-flex size-7 items-center justify-center rounded-full ring-4 ring-background",
            isUpcoming
              ? "border border-dashed border-muted-foreground/50 bg-card text-muted-foreground"
              : "border",
          )}
          style={
            isUpcoming
              ? undefined
              : {
                  backgroundColor: meta.softVar,
                  borderColor: meta.colorVar,
                  color: meta.colorVar,
                }
          }
        >
          <EventIcon event={event} className="size-3.5" />
        </span>
      </div>

      {/* Card */}
      <button
        type="button"
        onClick={() => onSelect(event)}
        className={cn(
          "group ml-1 w-full rounded-2xl border border-border bg-card text-left shadow-xs transition-all duration-[--dur-fast] ease-[--ease-out-soft] hover:-translate-y-px hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
          density === "compact" ? "px-4 py-2.5" : "px-4 py-3.5",
          status === "active" && "ring-1 ring-primary/40",
          (isUpcoming || event.muted) && "opacity-90",
        )}
      >
        <div className="flex items-start gap-2">
          <h3 className="flex-1 text-pretty text-sm leading-snug font-semibold sm:text-[0.95rem]">
            {event.title}
          </h3>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase",
              pill.className,
            )}
          >
            {pill.dot ? (
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-current"
              />
            ) : null}
            {pill.label}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium"
            style={{ backgroundColor: meta.softVar, color: meta.colorVar }}
          >
            <EventIcon event={event} className="size-3" />
            {meta.label}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{formatEventDate(event)}</span>
          {isPhase ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{durationSuffix(days, true)}</span>
            </>
          ) : null}
          {isPhase && event.result ? (
            <PhaseResultBadge result={timelineResultToResolved(event.result)} />
          ) : null}
          {event.note ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate text-muted-foreground">
                {event.note}
              </span>
            </>
          ) : null}
          {event.owner ? (
            <AvatarStack people={[event.owner]} className="ml-auto" />
          ) : null}
        </div>
      </button>
    </div>
  );
}

/** The "Hoje" divider — full-width row before the first upcoming event (§4.4). */
function TodayDivider({ reference }: { reference: string }) {
  return (
    <div className="grid grid-cols-[3rem_1.875rem_1fr] items-center py-1">
      <span className="pr-2 text-right text-[0.65rem] font-semibold tracking-wide text-primary uppercase">
        Hoje
      </span>
      <div className="relative flex justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border"
        />
        <span
          aria-hidden="true"
          className="relative z-10 size-3 rounded-full bg-primary ring-4 ring-background"
        />
      </div>
      <div className="ml-1 flex items-center gap-3">
        <span className="text-sm font-medium text-primary tabular-nums">
          {formatFull(reference)}
        </span>
        <span
          aria-hidden="true"
          className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent"
        />
      </div>
    </div>
  );
}

/** "JUN" — uppercase 3-letter month for the date rail. */
function monthLabel(iso: string): string {
  const short = formatShort(iso);
  // "16 de jun." → "JUN"
  const parts = short.split(" ");
  const month = parts[parts.length - 1].replace(/\.$/, "");
  return month.toUpperCase();
}

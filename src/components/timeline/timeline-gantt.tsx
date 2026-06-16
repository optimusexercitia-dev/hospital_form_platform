"use client";

import { useMemo } from "react";

import type { CaseTimelineEvent } from "@/lib/timeline/event-model";
import { anchor, endDay, statusOf } from "@/lib/timeline/event-model";
import { cn } from "@/lib/utils";

import { AvatarStack } from "./avatar-stack";
import { buildAxis, nearRightEdge, type Axis } from "./gantt-axis";
import type { TimelineDensity } from "./timeline-density-switch";
import { formatEventDate } from "./format";
import { EventIcon, TYPE_META } from "./type-meta";

const ROW_H = { comfortable: 64, compact: 50 } as const;
const HEADER_H = 56;

/**
 * Duration (horizontal / Gantt) layout — README §3, adapted to the adaptive
 * ISO-date axis (`gantt-axis.ts`). One event per row, top-to-bottom in `anchor`
 * order. Phases render as width=duration bars; every other type renders as a
 * single-day pin (icon chip + inline card) anchored to its column — right-anchored
 * near the grid edge so it never overflows (§3.5). A sticky 2-row header (month
 * group + unit cells), weekend bands (day unit only), grid lines, and a today
 * marker (open cases) / terminal `closed_at` marker (closed cases) sit behind the
 * cards. Horizontal scroll appears only when the grid is wider than the viewport.
 *
 * Pure presentational: a function of `(events, reference, closedAt, density)`.
 */
export function TimelineGantt({
  events,
  reference,
  closedAt,
  density,
  onSelect,
}: {
  events: CaseTimelineEvent[];
  reference: string | null;
  closedAt: string | null;
  density: TimelineDensity;
  onSelect: (event: CaseTimelineEvent) => void;
}) {
  const ordered = useMemo(
    () => [...events].sort((a, b) => anchor(a).localeCompare(anchor(b))),
    [events],
  );
  const axis = useMemo(
    () => buildAxis(ordered, reference, closedAt),
    [ordered, reference, closedAt],
  );

  const rowH = ROW_H[density];
  const bodyH = ordered.length * rowH;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <div className="relative" style={{ width: axis.width, minWidth: "100%" }}>
        <AxisHeader axis={axis} />

        <div className="relative" style={{ height: bodyH }}>
          {/* Background layers (behind cards) */}
          <Bands axis={axis} height={bodyH} />
          <Marker axis={axis} height={bodyH} />

          {/* Event rows */}
          {ordered.map((event, i) => (
            <GanttRow
              key={event.id}
              event={event}
              axis={axis}
              reference={reference}
              top={i * rowH}
              rowH={rowH}
              index={i}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AxisHeader({ axis }: { axis: Axis }) {
  return (
    <div
      className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur-sm"
      style={{ height: HEADER_H }}
    >
      {/* Row 1 — month groups */}
      <div className="relative h-6">
        {axis.groups.map((g) => (
          <span
            key={`${g.label}-${g.x}`}
            className="absolute top-1.5 truncate px-2 text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase"
            style={{ left: g.x, width: g.width }}
          >
            {g.label}
          </span>
        ))}
      </div>
      {/* Row 2 — unit cells */}
      <div className="relative h-8">
        {axis.columns.map((c) => (
          <div
            key={c.startIso}
            className={cn(
              "absolute top-0 flex h-full flex-col items-center justify-center gap-px",
              c.weekend && "bg-muted/50",
            )}
            style={{ left: c.x, width: c.width }}
          >
            {c.sub ? (
              <span className="text-[0.6rem] leading-none text-muted-foreground/70">
                {c.sub}
              </span>
            ) : null}
            <span
              className={cn(
                "text-[0.7rem] leading-none tabular-nums",
                c.isToday
                  ? "font-bold text-primary"
                  : "font-medium text-muted-foreground",
              )}
            >
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Weekend bands (day unit) + grid lines, behind everything. */
function Bands({ axis, height }: { axis: Axis; height: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{ height }}
    >
      {axis.columns.map((c) => (
        <div key={c.startIso}>
          {c.weekend ? (
            <div
              className="absolute top-0 bg-muted/40"
              style={{
                left: c.x,
                width: c.width,
                height,
                backgroundImage:
                  "repeating-linear-gradient(-45deg, transparent 0 5px, var(--border) 5px 6px)",
                opacity: 0.5,
              }}
            />
          ) : null}
          <div
            className="absolute top-0 w-px bg-border/50"
            style={{ left: c.x, height }}
          />
        </div>
      ))}
    </div>
  );
}

/** Today marker (open) or terminal closed marker (closed), behind the cards. */
function Marker({ axis, height }: { axis: Axis; height: number }) {
  const x = axis.todayX ?? axis.closedX;
  if (x == null) return null;
  const isToday = axis.todayX != null;
  return (
    <div
      aria-hidden="true"
      data-marker
      className="pointer-events-none absolute top-0 z-[2]"
      style={{ left: x - 1, height }}
    >
      <div
        className={cn(
          "h-full w-0.5",
          isToday ? "bg-primary" : "bg-muted-foreground/60",
        )}
        style={!isToday ? { borderLeft: "2px dashed var(--muted-foreground)" } : undefined}
      />
      <div
        className={cn(
          "absolute -top-0 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
          isToday ? "bg-primary" : "bg-muted-foreground/70",
        )}
      />
    </div>
  );
}

function GanttRow({
  event,
  axis,
  reference,
  top,
  rowH,
  index,
  onSelect,
}: {
  event: CaseTimelineEvent;
  axis: Axis;
  reference: string | null;
  top: number;
  rowH: number;
  index: number;
  onSelect: (event: CaseTimelineEvent) => void;
}) {
  const status = statusOf(event, reference);
  const isPhase = event.type === "phase";

  return (
    <div
      className="group absolute inset-x-0 hover:bg-primary/[0.04]"
      style={{ top, height: rowH }}
    >
      {isPhase ? (
        <PhaseBar
          event={event}
          axis={axis}
          reference={reference}
          status={status}
          rowH={rowH}
          index={index}
          onSelect={onSelect}
        />
      ) : (
        <Pin
          event={event}
          axis={axis}
          status={status}
          rowH={rowH}
          index={index}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

function PhaseBar({
  event,
  axis,
  reference,
  status,
  rowH,
  index,
  onSelect,
}: {
  event: CaseTimelineEvent;
  axis: Axis;
  reference: string | null;
  status: ReturnType<typeof statusOf>;
  rowH: number;
  index: number;
  onSelect: (event: CaseTimelineEvent) => void;
}) {
  const meta = TYPE_META.phase;
  const start = anchor(event);
  const end = endDay(event, reference ?? start);
  const left = axis.xOf(start) + 2;
  const width = Math.max(axis.colWidth - 4, axis.spanWidth(start, end) - 4);
  const barH = Math.min(44, rowH - 16);
  const upcoming = status === "upcoming";
  const showMeta = width >= 116;
  const showAvatars = width >= 232 && event.owner;

  return (
    <button
      type="button"
      data-bar
      onClick={() => onSelect(event)}
      style={{
        left,
        width,
        top: (rowH - barH) / 2,
        height: barH,
        "--rise-delay": `${index * 50}ms`,
      } as React.CSSProperties}
      className={cn(
        "absolute flex items-center gap-2 overflow-hidden rounded-lg border bg-card pr-2 pl-3 text-left shadow-xs transition-all duration-[--dur-fast] ease-[--ease-out-soft] hover:-translate-y-px hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
        upcoming
          ? "border-dashed border-muted-foreground/50 bg-muted/40"
          : "border-border",
        status === "active" && "ring-1 ring-primary/50",
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: upcoming ? "var(--muted-foreground)" : meta.colorVar, opacity: upcoming ? 0.5 : 1 }}
      />
      <EventIcon
        event={event}
        className="size-3.5 shrink-0"
        style={{ color: upcoming ? undefined : meta.colorVar }}
      />
      <span className="truncate text-[0.8rem] font-semibold">{event.title}</span>
      {showMeta ? (
        <span className="shrink-0 truncate text-[0.7rem] text-muted-foreground tabular-nums">
          {formatEventDate(event)}
        </span>
      ) : null}
      {showAvatars && event.owner ? (
        <AvatarStack people={[event.owner]} className="ml-auto" />
      ) : null}
    </button>
  );
}

function Pin({
  event,
  axis,
  status,
  rowH,
  index,
  onSelect,
}: {
  event: CaseTimelineEvent;
  axis: Axis;
  status: ReturnType<typeof statusOf>;
  rowH: number;
  index: number;
  onSelect: (event: CaseTimelineEvent) => void;
}) {
  const meta = TYPE_META[event.type];
  const day = anchor(event);
  const cx = axis.centerOf(day);
  const rightAnchor = nearRightEdge(axis, day);
  const upcoming = status === "upcoming";
  const chipH = Math.min(40, rowH - 16);

  const pinStyle: React.CSSProperties & Record<string, string | number> = {
    top: (rowH - chipH) / 2,
    height: chipH,
    "--rise-delay": `${index * 50}ms`,
  };
  if (rightAnchor) {
    pinStyle.right = axis.width - cx;
    pinStyle.flexDirection = "row-reverse";
  } else {
    pinStyle.left = cx;
  }

  return (
    <button
      type="button"
      data-pin
      onClick={() => onSelect(event)}
      style={pinStyle}
      className={cn(
        "absolute flex max-w-[260px] items-center gap-2 rounded-lg border bg-card px-1.5 text-left shadow-xs transition-all duration-[--dur-fast] ease-[--ease-out-soft] hover:-translate-y-px hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
        upcoming
          ? "border-dashed border-muted-foreground/50 bg-muted/40"
          : "border-border",
        status === "active" && "ring-1 ring-primary/50",
        event.muted && "opacity-80",
      )}
    >
      <span
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: meta.softVar }}
      >
        <EventIcon
          event={event}
          className="size-3.5"
          style={{ color: meta.colorVar }}
        />
      </span>
      <span className="truncate pr-1 text-[0.78rem] font-medium">
        {event.title}
      </span>
    </button>
  );
}

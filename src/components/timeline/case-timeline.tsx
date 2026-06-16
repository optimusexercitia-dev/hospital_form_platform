"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";

import type {
  CaseTimelineEvent,
  TimelineEventType,
} from "@/lib/timeline/event-model";

import { TimelineDensitySwitch, type TimelineDensity } from "./timeline-density-switch";
import { TimelineEventSheet } from "./timeline-event-sheet";
import { TimelineFeed } from "./timeline-feed";
import { TimelineGantt } from "./timeline-gantt";
import { TimelineLegend } from "./timeline-legend";
import { TimelineMotion } from "./timeline-motion";
import { buildQuery } from "./timeline-params";
import { TimelineViewSwitch, type TimelineView } from "./timeline-view-switch";
import { TYPE_ORDER } from "./type-meta";

/**
 * Client shell for the case Timeline (Phase 12). Holds the view / density /
 * type-filter state and renders the toolbar (view switch + density toggle +
 * legend/filter) over the active layout, plus the shared detail Sheet.
 *
 * **URL persistence (F2).** The three controls are shareable search params
 * (`view`, `density`, `types`). The SERVER page decodes the initial values from
 * `searchParams` and passes them in as `initial*` props, so the first render and
 * hydration agree (no flash). On every change the shell mirrors the new state
 * into the URL via `router.replace({ scroll: false })` — shallow, so neither the
 * page scroll nor the server data refetches; only the address bar updates, which
 * makes the current view shareable. The default state (feed · comfortable · all
 * types) serializes to an empty query, keeping the URL clean.
 *
 * Both layouts stay PURE functions of `(events, reference, closedAt, density)` —
 * this shell only chooses which to render and which events pass the type filter.
 * The legend never blanks the timeline: toggling off the last visible type is a
 * no-op.
 *
 * `reference` = today's ISO for an OPEN case (drives the today marker / divider /
 * upcoming state) or `null` for a CLOSED case (static history). `closedAt` is the
 * terminal marker for closed cases.
 */
export function CaseTimeline({
  events,
  reference,
  closedAt = null,
  initialView = "feed",
  initialDensity = "comfortable",
  initialTypes,
}: {
  events: CaseTimelineEvent[];
  reference: string | null;
  closedAt?: string | null;
  initialView?: TimelineView;
  initialDensity?: TimelineDensity;
  /** Visible-type set decoded from the URL; defaults to all 8 when omitted. */
  initialTypes?: Set<TimelineEventType>;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [view, setView] = useState<TimelineView>(initialView);
  const [density, setDensity] = useState<TimelineDensity>(initialDensity);
  const [visible, setVisible] = useState<Set<TimelineEventType>>(
    () => initialTypes ?? new Set(TYPE_ORDER),
  );
  const [selected, setSelected] = useState<CaseTimelineEvent | null>(null);

  // Mirror state → URL on EVERY user change (single source of truth — avoids the
  // stale-closure trap of writing the URL inside each handler). Skips the first
  // run so the initial render never re-writes the URL it was hydrated from (keeps
  // SSR correct, no flash). `replace({ scroll: false })` is shallow: the address
  // bar updates and the view becomes shareable without scrolling or refetching.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const query = buildQuery({ view, density, types: visible });
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [view, density, visible, router, pathname]);

  function toggleType(type: TimelineEventType) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size === 1) return prev; // never blank the timeline
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  const filtered = useMemo(
    () => events.filter((e) => visible.has(e.type)),
    [events, visible],
  );

  const noEvents = events.length === 0;
  const noMatches = !noEvents && filtered.length === 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <TimelineLegend visible={visible} onToggle={toggleType} />
        <div className="flex shrink-0 items-center gap-2">
          <TimelineDensitySwitch value={density} onChange={setDensity} />
          <TimelineViewSwitch value={view} onChange={setView} />
        </div>
      </div>

      {/* Active layout */}
      {noEvents ? (
        <EmptyState
          title="Sem eventos na linha do tempo"
          body="Este caso ainda não registrou eventos. Eles aparecerão aqui conforme o caso avança."
        />
      ) : noMatches ? (
        <EmptyState
          title="Nenhum evento para os filtros atuais"
          body="Reative um ou mais tipos na legenda para ver os eventos do caso."
        />
      ) : (
        <TimelineMotion view={view}>
          {view === "feed" ? (
            <div className="mx-auto w-full max-w-3xl">
              <TimelineFeed
                events={filtered}
                reference={reference}
                density={density}
                onSelect={setSelected}
              />
            </div>
          ) : (
            <TimelineGantt
              events={filtered}
              reference={reference}
              closedAt={closedAt}
              density={density}
              onSelect={setSelected}
            />
          )}
        </TimelineMotion>
      )}

      <TimelineEventSheet
        event={selected}
        reference={reference}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <span className="inline-flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CalendarClock aria-hidden="true" className="size-5" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

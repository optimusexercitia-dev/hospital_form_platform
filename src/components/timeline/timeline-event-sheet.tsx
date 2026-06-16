"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { ArrowUpRight, X } from "lucide-react";

import type {
  CaseTimelineEvent,
  TimelinePerson,
} from "@/lib/timeline/event-model";
import { statusOf } from "@/lib/timeline/event-model";
import { cn } from "@/lib/utils";

import { AvatarStack } from "./avatar-stack";
import {
  durationSuffix,
  formatEventDate,
  pillFor,
} from "./format";
import { EventIcon, TYPE_META } from "./type-meta";

/**
 * The consistent right-side detail panel (plan decision 7) — SAME shape for all
 * 8 types. Built on Radix Dialog (a proper modal `dialog`: focus trap +
 * restoration, `Escape` to close, scroll-lock, `aria-*` wiring) styled as a
 * right-anchored sheet rather than a centered modal, since the repo ships no
 * `Sheet` primitive yet.
 *
 * Shows: a coloured type header (icon chip + label + status pill), the title,
 * the date/range (+ duration for phases), the full participant roster
 * (placeholder for F1 — owner only until the backend supplies it), and the note.
 * An "Abrir registro" deep-link is rendered ONLY when `href` is non-null; a
 * `null` href is Sheet-only (phases/documents/events/actions render inline on the
 * detail tab today).
 */
export function TimelineEventSheet({
  event,
  reference,
  roster,
  onOpenChange,
}: {
  event: CaseTimelineEvent | null;
  reference: string | null;
  /** Full participant roster for the Sheet; falls back to the owner for F1. */
  roster?: TimelinePerson[];
  onOpenChange: (open: boolean) => void;
}) {
  const open = event != null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col gap-5 overflow-y-auto border-l border-border bg-card p-6 text-card-foreground shadow-xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right data-[state=open]:duration-[--dur-base]",
          )}
        >
          {event ? (
            <SheetBody
              event={event}
              reference={reference}
              roster={roster ?? (event.owner ? [event.owner] : [])}
            />
          ) : null}
          <DialogPrimitive.Close
            aria-label="Fechar"
            className="absolute top-5 right-5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <X aria-hidden="true" className="size-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SheetBody({
  event,
  reference,
  roster,
}: {
  event: CaseTimelineEvent;
  reference: string | null;
  roster: TimelinePerson[];
}) {
  const meta = TYPE_META[event.type];
  const status = statusOf(event, reference);
  const pill = pillFor(event, status);
  const isPhase = event.type === "phase";
  const duration = isPhase
    ? durationSuffix(
        // inclusive day count; for F1 the Sheet shows it as text only
        diffPhaseDays(event, reference),
        true,
      )
    : "";

  return (
    <div className={cn("flex flex-col gap-5", event.muted && "opacity-90")}>
      {/* Type header */}
      <div className="flex items-center gap-2 pr-8">
        <span
          className="inline-flex size-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: meta.softVar }}
        >
          <EventIcon
            event={event}
            className="size-4"
            style={{ color: meta.colorVar }}
          />
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          {meta.label}
        </span>
        <span
          className={cn(
            "ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase",
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

      <DialogPrimitive.Title className="text-xl leading-snug font-semibold text-balance">
        {event.title}
      </DialogPrimitive.Title>

      {/* Visually-hidden description: satisfies Radix's dialog a11y contract and
          gives screen readers type + date context on open (P12-MINOR-1). */}
      <DialogPrimitive.Description className="sr-only">
        {meta.label} · {formatEventDate(event)}
      </DialogPrimitive.Description>

      <dl className="flex flex-col gap-3 text-sm">
        <Row label="Data">
          {formatEventDate(event)}
          {duration ? (
            <span className="text-muted-foreground"> · {duration}</span>
          ) : null}
        </Row>
        {roster.length > 0 ? (
          <Row label="Pessoas">
            <div className="flex items-center gap-2">
              <AvatarStack people={roster} max={6} />
              <span className="text-muted-foreground">
                {roster.map((p) => p.name).join(", ")}
              </span>
            </div>
          </Row>
        ) : null}
        {event.note ? <Row label="Observação">{event.note}</Row> : null}
      </dl>

      {event.href ? (
        <a
          href={event.href}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          Abrir registro
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">
          Este registro é exibido apenas aqui na linha do tempo.
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

/** Inclusive phase day count for the Sheet's duration text (UTC, DST-safe). */
function diffPhaseDays(
  event: CaseTimelineEvent,
  reference: string | null,
): number {
  if (event.type !== "phase" || !event.start) return 1;
  const end = event.end ?? reference ?? event.start;
  const a = Date.parse(`${event.start.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${end.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  const days = Math.floor((b - a) / 86_400_000) + 1;
  return days < 1 ? 1 : days;
}

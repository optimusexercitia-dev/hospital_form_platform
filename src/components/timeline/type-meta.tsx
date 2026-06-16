/**
 * Case Timeline — central type metadata (Phase 12).
 *
 * The single source of truth that turns a stable {@link TimelineEventType} slug
 * (from `@/lib/timeline/event-model`) into its presentation: a lucide icon, a
 * pt-BR legend label, and the CSS-variable names for its strong + soft colour
 * (declared in `globals.css` as `--event-*` / `--event-*-soft`, each reusing an
 * existing semantic token). The legend/filter, both layouts (Feed + Duration),
 * and the detail Sheet ALL read from here so a type looks identical everywhere.
 *
 * Pure presentational + Server-Component-safe (no client-only imports): the
 * colour values are returned as `var(--event-…)` strings, resolved to concrete
 * styling only where a component sets them (Rule: tokens, never raw hex).
 *
 * `lifecycle` is special: its icon depends on the `subtype` (opened vs closed),
 * so {@link iconForEvent} takes the whole event; the static {@link TYPE_META}
 * map carries the default (opened) icon for the legend.
 */

import { createElement } from "react";
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  FolderPlus,
  Paperclip,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react";

import type {
  CaseTimelineEvent,
  TimelineEventType,
} from "@/lib/timeline/event-model";

export interface TypeMeta {
  /** pt-BR label shown in the legend, the meta chip and the Sheet (Rule 10). */
  label: string;
  /** Default lucide icon for the type (lifecycle = opened icon — see {@link iconForEvent}). */
  icon: LucideIcon;
  /** The strong colour CSS var (`var(--event-<type>)`) — icon glyph, border, strip. */
  colorVar: string;
  /** The soft tint CSS var (`var(--event-<type>-soft)`) — chip / node background. */
  softVar: string;
}

/**
 * The 8-type taxonomy → presentation. Order here is the canonical LEGEND order
 * (lifecycle first, then the chronological "kinds" of activity, note last).
 * Colours map 1:1 to the `--event-*` tokens; see the plan's type table.
 */
export const TYPE_META: Record<TimelineEventType, TypeMeta> = {
  lifecycle: {
    label: "Ciclo do caso",
    icon: FolderPlus,
    colorVar: "var(--event-lifecycle)",
    softVar: "var(--event-lifecycle-soft)",
  },
  phase: {
    label: "Fase",
    icon: Clock,
    colorVar: "var(--event-phase)",
    softVar: "var(--event-phase-soft)",
  },
  milestone: {
    label: "Marco",
    icon: Flag,
    colorVar: "var(--event-milestone)",
    softVar: "var(--event-milestone-soft)",
  },
  interview: {
    label: "Entrevista",
    icon: Users,
    colorVar: "var(--event-interview)",
    softVar: "var(--event-interview-soft)",
  },
  meeting: {
    label: "Reunião",
    icon: Calendar,
    colorVar: "var(--event-meeting)",
    softVar: "var(--event-meeting-soft)",
  },
  document: {
    label: "Documento",
    icon: Paperclip,
    colorVar: "var(--event-document)",
    softVar: "var(--event-document-soft)",
  },
  action: {
    label: "Ação",
    icon: Check,
    colorVar: "var(--event-action)",
    softVar: "var(--event-action-soft)",
  },
  note: {
    label: "Nota",
    icon: StickyNote,
    colorVar: "var(--event-note)",
    softVar: "var(--event-note-soft)",
  },
};

/** The legend / filter order (also the order types are listed in the toolbar). */
export const TYPE_ORDER: readonly TimelineEventType[] = [
  "lifecycle",
  "phase",
  "milestone",
  "interview",
  "meeting",
  "document",
  "action",
  "note",
] as const;

/**
 * The icon for a specific event. Lifecycle resolves by `subtype`: a `closed`
 * event reads as a lock-in/conclusion (check-circle), an `opened` event as a new
 * folder; every other type uses its static {@link TYPE_META} icon.
 */
export function iconForEvent(event: CaseTimelineEvent): LucideIcon {
  if (event.type === "lifecycle" && event.subtype === "closed") {
    return CheckCircle2;
  }
  return TYPE_META[event.type].icon;
}

/**
 * Stable wrapper that renders an event's icon. A component (rather than a
 * `const Icon = iconForEvent(...)` local at each call site) so the lint rule
 * `react-hooks/static-components` is satisfied — the icon is chosen internally,
 * not re-created during the parent's render. Forwards `className`/`style` to the
 * underlying lucide glyph; always `aria-hidden` (decorative — the title carries
 * the meaning).
 */
export function EventIcon({
  event,
  className,
  style,
}: {
  event: CaseTimelineEvent;
  className?: string;
  style?: React.CSSProperties;
}) {
  // `createElement` (not JSX of a local) keeps `react-hooks/static-components`
  // happy: the icon is resolved from the stable `TYPE_META` map, never a
  // component re-declared during render.
  return createElement(iconForEvent(event), {
    "aria-hidden": true,
    className,
    style,
  });
}

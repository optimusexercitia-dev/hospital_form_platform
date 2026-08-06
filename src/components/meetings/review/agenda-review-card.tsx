"use client";

import { Link2 } from "lucide-react";

import type { MinutesDraftAgendaItem, MinutesDraftLooseResolution } from "@/lib/minutes-jobs/types";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatAttachResolutionLabel, MINUTES_UI } from "../minutes-labels";

const FIELD_CLASS =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * F3 — one card per extracted agenda entry (ADR 0099 D6).
 *
 * Matched (`ref` set): the LIVE existing text is shown side-by-side with the extracted
 * text so every overwrite is a seen decision before it happens; only `discussion_notes`/
 * `resolution` are editable — apply never rewrites a matched item's title. New (`ref`
 * null): the title is editable and required. Striking an item is `include: false`, never
 * a delete — the SQL comment is explicit that an empty string would erase authored
 * minutes on an autosave gap, so this card never offers a destructive "remove".
 *
 * Also owns the D6 "attach a loose resolution" control: a resolution the service could
 * not tie to any agenda item (`looseResolutions`, keyed by index service-side) can be
 * folded onto THIS card's resolution text — `onAttachResolution` removes it from the
 * shared pool (owned by `review-shell.tsx`) so it cannot be attached twice.
 */
export function AgendaReviewCard({
  item,
  onChange,
  looseResolutions,
  onAttachResolution,
}: {
  item: MinutesDraftAgendaItem;
  onChange: (next: MinutesDraftAgendaItem) => void;
  /** Resolutions still unattached — offered here AND on every other card. */
  looseResolutions: MinutesDraftLooseResolution[];
  onAttachResolution: (resolution: MinutesDraftLooseResolution) => void;
}) {
  const isNew = item.ref === null;

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-4",
        !item.include && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span
            className={cn(
              "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase",
              isNew ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {isNew ? MINUTES_UI.agendaNewTag : MINUTES_UI.agendaMatchedTag}
          </span>
          {isNew ? (
            <input
              type="text"
              value={item.title}
              onChange={(e) => onChange({ ...item, title: e.target.value })}
              disabled={!item.include}
              placeholder={MINUTES_UI.agendaNewTitlePlaceholder}
              className={FIELD_CLASS}
              aria-label="Título do item de pauta"
            />
          ) : (
            <p className="text-sm font-medium text-foreground">{item.title}</p>
          )}
        </div>

        {/* I6: a STABLE accessible name — Radix's `Checkbox` already exposes `aria-checked`
            from `checked`, so the label never needs to rename itself on toggle (which
            would otherwise announce as a totally different control each time). */}
        <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
          <Checkbox
            checked={item.include}
            onCheckedChange={(c) => onChange({ ...item, include: c === true })}
          />
          {MINUTES_UI.agendaIncludeToggle}
        </label>
      </div>

      <div className={cn("grid gap-3", !isNew && "sm:grid-cols-2")}>
        {!isNew && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {MINUTES_UI.agendaExistingLabel}
            </span>
            <div className="rounded-lg border border-border bg-card p-2.5 text-sm text-muted-foreground">
              {item.existing_discussion_notes?.trim() || "—"}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {isNew ? "Discussão" : MINUTES_UI.agendaExtractedLabel}
          </span>
          <Textarea
            value={item.discussion_notes}
            onChange={(e) => onChange({ ...item, discussion_notes: e.target.value })}
            disabled={!item.include}
            className="min-h-20 text-sm"
            aria-label={`Discussão — ${item.title || "item de pauta"}`}
          />
        </div>
      </div>

      <div className={cn("grid gap-3", !isNew && "sm:grid-cols-2")}>
        {!isNew && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {MINUTES_UI.agendaExistingLabel} — resolução
            </span>
            <div className="rounded-lg border border-border bg-card p-2.5 text-sm text-muted-foreground">
              {item.existing_resolution?.trim() || "—"}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Resolução {isNew ? "" : `— ${MINUTES_UI.agendaExtractedLabel.toLowerCase()}`}
          </span>
          <Textarea
            value={item.resolution ?? ""}
            onChange={(e) => onChange({ ...item, resolution: e.target.value })}
            disabled={!item.include}
            className="min-h-16 text-sm"
            aria-label={`Resolução — ${item.title || "item de pauta"}`}
          />
        </div>
      </div>

      {looseResolutions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2.5">
          <Link2 aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {MINUTES_UI.looseResolutionAttachTo}
          </span>
          {looseResolutions.map((r) => (
            <Button
              key={r.key}
              type="button"
              variant="outline"
              size="xs"
              disabled={!item.include}
              onClick={() => onAttachResolution(r)}
              title={r.text}
              aria-label={formatAttachResolutionLabel(r.text)}
            >
              {MINUTES_UI.looseResolutionAttach}
            </Button>
          ))}
        </div>
      )}
    </li>
  );
}

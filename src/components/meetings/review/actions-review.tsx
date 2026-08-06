"use client";

import type { MinutesDraftActionItem } from "@/lib/minutes-jobs/types";
import type { AssigneeOption } from "../action-item-form";
import { NativeSelect } from "@/components/ui/native-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { MINUTES_UI } from "../minutes-labels";

const FIELD_CLASS =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * F3 — one row per extracted action item (ADR 0099 D7, B0 §4 R2).
 *
 * ⚠ The owner select offers ONLY commission members (`assignees`) — never a guest
 * attendee, even though `owner_ref` may have resolved to one. `create_committee_
 * action_item` rejects a non-member assignee with HC021; `apply_minutes_review`
 * downgrades that case to unassigned rather than aborting (PO decision O2), but
 * offering a guest here would let the reviewer pick an owner that silently vanishes at
 * "Concluir" — so the option never exists in the first place.
 *
 * The "item de pauta relacionado" select offers only agenda entries with a live `ref`
 * (an existing `meeting_agenda_items` row) — apply resolves `agenda_ref` against a live
 * row OR a same-transaction creation for a DANGLING ref it remembers from `draft`, but a
 * genuinely new (`ref: null`) entry has no stable id to link against before apply runs.
 */
export function ActionsReview({
  item,
  onChange,
  assignees,
  agendaOptions,
}: {
  item: MinutesDraftActionItem;
  onChange: (next: MinutesDraftActionItem) => void;
  assignees: AssigneeOption[];
  agendaOptions: { ref: string; title: string }[];
}) {
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-4",
        !item.include && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <input
          type="text"
          value={item.title}
          onChange={(e) => onChange({ ...item, title: e.target.value })}
          disabled={!item.include}
          className={cn(FIELD_CLASS, "flex-1")}
          aria-label="Título do item de ação"
        />
        {/* I6: a STABLE accessible name — see the identical note in agenda-review-card.tsx. */}
        <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
          <Checkbox
            checked={item.include}
            onCheckedChange={(c) => onChange({ ...item, include: c === true })}
          />
          {MINUTES_UI.actionIncludeToggle}
        </label>
      </div>

      <Textarea
        value={item.description}
        onChange={(e) => onChange({ ...item, description: e.target.value })}
        disabled={!item.include}
        placeholder="Descrição (opcional)"
        className="min-h-16 text-sm"
        aria-label={`Descrição — ${item.title || "item de ação"}`}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {MINUTES_UI.actionOwnerLabel}
          </span>
          <NativeSelect
            value={item.assigned_to ?? ""}
            onChange={(e) => onChange({ ...item, assigned_to: e.target.value || null })}
            disabled={!item.include}
            className="h-9"
            aria-label={MINUTES_UI.actionOwnerLabel}
          >
            <option value="">{MINUTES_UI.actionOwnerUnassigned}</option>
            {assignees.map((a) => (
              <option key={a.userId} value={a.userId}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
          {!item.assigned_to && item.owner_text && (
            <span className="text-xs text-muted-foreground">
              {MINUTES_UI.actionOwnerHint}: {item.owner_text}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {MINUTES_UI.actionDueLabel}
          </span>
          <DatePicker
            value={item.due_date ?? ""}
            onChange={(v) => onChange({ ...item, due_date: v || null })}
            disabled={!item.include}
            aria-label={`${MINUTES_UI.actionDueLabel} — ${item.title || "item de ação"}`}
          />
          {!item.due_date && item.deadline_text && (
            <span className="text-xs text-muted-foreground">
              {MINUTES_UI.actionDueHint}: {item.deadline_text}
            </span>
          )}
        </div>
      </div>

      {agendaOptions.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {MINUTES_UI.actionAgendaLabel}
          </span>
          <NativeSelect
            value={item.agenda_ref ?? ""}
            onChange={(e) => onChange({ ...item, agenda_ref: e.target.value || null })}
            disabled={!item.include}
            className="h-9"
            aria-label={MINUTES_UI.actionAgendaLabel}
          >
            <option value="">{MINUTES_UI.actionAgendaNone}</option>
            {agendaOptions.map((a) => (
              <option key={a.ref} value={a.ref}>
                {a.title}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
    </li>
  );
}

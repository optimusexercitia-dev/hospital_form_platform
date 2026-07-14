import { Lock, Users } from "lucide-react";

import type { ReminderType } from "@/lib/queries/action-item-reminders";
import type { ActionItemUpdateType } from "@/lib/queries/action-item-updates";
import type { VisibilityScope } from "@/lib/queries/action-items";

/**
 * Shared pt-BR labels + token styling for the action-item SATELLITE surfaces
 * (reminders / updates / checklist) and the `visibility_scope` badge. Pure data
 * (Server-Component-safe); the components import from here so the vocabulary
 * stays consistent across the case panel, the meeting panel, and "Meus itens de
 * ação" (Rule 10 — user-facing strings pt-BR).
 */

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

/** When a reminder fires, relative to the item's due date. */
export const REMINDER_TYPE_LABEL: Record<ReminderType, string> = {
  before_due: "Antes do prazo",
  on_due: "No dia do prazo",
  after_due: "Após o prazo",
};

/** Reminder types that require an `offsetDays` (everything except `on_due`). */
export const OFFSET_REMINDER_TYPES: ReminderType[] = ["before_due", "after_due"];

/**
 * A human sentence describing one reminder rule, e.g. "3 dias antes do prazo",
 * "No dia do prazo", "1 dia após o prazo". Defensive against a malformed
 * `offsetDays` (falls back to the bare type label).
 */
export function describeReminder(
  reminderType: ReminderType,
  offsetDays: number | null,
): string {
  if (reminderType === "on_due" || offsetDays == null) {
    return REMINDER_TYPE_LABEL[reminderType];
  }
  const unit = offsetDays === 1 ? "dia" : "dias";
  const when = reminderType === "before_due" ? "antes" : "após";
  return `${offsetDays} ${unit} ${when} do prazo`;
}

// ---------------------------------------------------------------------------
// Updates feed
// ---------------------------------------------------------------------------

/** pt-BR label + accent token per narrative update type. */
export const UPDATE_TYPE_META: Record<
  ActionItemUpdateType,
  { label: string; dotClassName: string; chipClassName: string }
> = {
  note: {
    label: "Nota",
    dotClassName: "bg-muted-foreground/60",
    chipClassName: "bg-muted text-muted-foreground",
  },
  progress: {
    label: "Progresso",
    dotClassName: "bg-accent-foreground",
    chipClassName: "bg-accent text-accent-foreground",
  },
  blocker: {
    label: "Impedimento",
    dotClassName: "bg-destructive",
    chipClassName: "bg-destructive/10 text-destructive",
  },
  deadline_change: {
    label: "Alteração de prazo",
    dotClassName: "bg-warning",
    chipClassName: "bg-warning/12 text-warning dark:bg-warning/15",
  },
};

/** The update types offered in the composer, in a natural authoring order. */
export const UPDATE_TYPE_ORDER: ActionItemUpdateType[] = [
  "progress",
  "note",
  "blocker",
  "deadline_change",
];

// ---------------------------------------------------------------------------
// Visibility scope
// ---------------------------------------------------------------------------

/** pt-BR label for every read-scope value (ADR 0050). */
export const VISIBILITY_SCOPE_LABEL: Record<VisibilityScope, string> = {
  committee: "Comitê",
  case_restricted: "Restrito ao caso",
  assignees_only: "Somente responsáveis",
};

/**
 * Badge metadata for the NON-default scopes only. `committee` is the platform
 * default and deliberately unbadged (a badge on every row is noise); the badge
 * flags the two restricted scopes a reader should notice.
 */
export const VISIBILITY_BADGE_META: Record<
  Exclude<VisibilityScope, "committee">,
  { label: string; icon: typeof Lock; className: string; title: string }
> = {
  case_restricted: {
    label: "Restrito ao caso",
    icon: Lock,
    className: "border-warning/30 bg-warning/10 text-warning dark:bg-warning/15",
    title: "Visível apenas a quem pode ver o caso vinculado",
  },
  assignees_only: {
    label: "Somente responsáveis",
    icon: Users,
    className: "border-border bg-secondary text-secondary-foreground",
    title: "Visível apenas aos responsáveis e à coordenação",
  },
};

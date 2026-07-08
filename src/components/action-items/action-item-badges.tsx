import { FolderOpen, CalendarDays, CircleDot } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  ActionItemSource,
  MyActionItemStatus,
} from "@/lib/queries/action-items";

/**
 * Badges for the "Meus itens de ação" list. Two distinct, honest visual roles:
 *
 *  - {@link ActionItemStatusBadge} — a colored STATUS pill mapping the action-item
 *    lifecycle vocabulary (open/in_progress/done/cancelled), NOT the case-status
 *    enum. It reuses the same semantic token classes as the cases status pill so
 *    the palette stays consistent app-wide, but owns its own mapping so the labels
 *    are correct for action items.
 *  - {@link ActionItemSourceBadge} — a neutral, OUTLINE type discriminator
 *    (Caso / Reunião) with a leading icon. Deliberately styled unlike a status
 *    pill so it never reads as a second colored status sitting in the row.
 *
 * Both are pure presentational, Server-Component-safe.
 */

/** pt-BR label + token classes per action-item status. */
const STATUS_META: Record<
  MyActionItemStatus,
  { label: string; className: string }
> = {
  // Awaiting work — a calm slate, not alarming.
  open: { label: "Aberto", className: "bg-secondary text-secondary-foreground" },
  // Actively in progress — the blue accent tint.
  in_progress: {
    label: "Em andamento",
    className: "bg-accent text-accent-foreground",
  },
  // Completed — positive.
  done: {
    label: "Concluído",
    className: "bg-success/12 text-success dark:bg-success/15",
  },
  // Cancelled — inert / muted.
  cancelled: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground",
  },
};

export function ActionItemStatusBadge({
  status,
  className,
}: {
  status: MyActionItemStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase",
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

/** pt-BR label + icon per source type. */
const SOURCE_META: Record<
  ActionItemSource,
  { label: string; icon: typeof FolderOpen }
> = {
  case: { label: "Caso", icon: FolderOpen },
  meeting: { label: "Reunião", icon: CalendarDays },
  // Standalone committee task, not tied to a case or meeting — hence no source
  // detail to link to. "Avulso" (pt-BR: standalone) + a single-dot glyph.
  manual: { label: "Avulso", icon: CircleDot },
};

/**
 * The "Gerado de" TYPE discriminator (Caso / Reunião / Avulso). Neutral outline
 * chip with a leading icon — visually distinct from the colored status pill so the
 * two never blur together. For linked sources (case/meeting) the label alongside
 * is the clickable link to the source detail (rendered by the caller); a `manual`
 * item has no detail page, so the caller renders it as the badge alone. This badge
 * is the icon+word prefix.
 */
export function ActionItemSourceBadge({
  source,
  className,
}: {
  source: ActionItemSource;
  className?: string;
}) {
  const meta = SOURCE_META[source];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-full border border-border bg-transparent px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {meta.label}
    </span>
  );
}

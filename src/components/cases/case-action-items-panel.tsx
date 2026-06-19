"use client";

import { useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ListTodo,
  Pencil,
  Plus,
  User,
} from "lucide-react";

import type {
  ActionItemStatus,
  CaseActionItem,
} from "@/lib/queries/case-action-items";
import {
  advanceActionItem,
  completeActionItem,
  deleteActionItem,
} from "@/lib/cases/action-items-actions";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { AssigneeOption } from "@/components/cases/case-phase-list";
import { CaseActionItemForm, type PhaseOption } from "./case-action-item-form";
import { ConfirmDeleteButton } from "./confirm-delete-button";
import {
  ACTION_ITEM_STATUS_LABEL,
  ACTION_ITEM_STATUS_STYLE,
} from "./case-extras-labels";
import { useCaseAction } from "./use-case-action";
import { formatDueDate } from "./format";

/** Statuses offered in the "advance" menu, in lifecycle order. */
const STATUS_ORDER: ActionItemStatus[] = [
  "open",
  "in_progress",
  "done",
  "cancelled",
];

/** Past due AND still actionable (not done/cancelled) = overdue. */
function isItemOverdue(item: CaseActionItem): boolean {
  if (!item.dueDate) return false;
  if (item.status === "done" || item.status === "cancelled") return false;
  const parts = item.dueDate.split("-");
  if (parts.length !== 3) return false;
  const [y, m, d] = parts.map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return false;
  const due = new Date(y, m - 1, d);
  if (Number.isNaN(due.getTime())) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return due.getTime() < today.getTime();
}

function ActionItemRow({
  item,
  assignees,
  phases,
  caseId,
  canWrite,
}: {
  item: CaseActionItem;
  assignees: AssigneeOption[];
  phases: PhaseOption[];
  caseId: string;
  canWrite: boolean;
}) {
  const { run, isPending, error } = useCaseAction();
  const [editOpen, setEditOpen] = useState(false);
  const overdue = isItemOverdue(item);
  const isClosed = item.status === "done" || item.status === "cancelled";

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase",
                ACTION_ITEM_STATUS_STYLE[item.status],
              )}
            >
              {ACTION_ITEM_STATUS_LABEL[item.status]}
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                isClosed
                  ? "text-muted-foreground line-through"
                  : "text-foreground",
              )}
            >
              {item.title}
            </span>
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground text-pretty">
              {item.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <User aria-hidden="true" className="size-3.5" />
              {item.assigneeName ?? "Sem responsável"}
            </span>
            {item.dueDate && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 tabular-nums",
                  overdue && "font-medium text-destructive",
                )}
              >
                <CalendarClock aria-hidden="true" className="size-3.5" />
                Prazo: {formatDueDate(item.dueDate)}
                {overdue && " · Atrasado"}
              </span>
            )}
          </div>
        </div>

        {canWrite && (
          <div className="flex shrink-0 items-center gap-0.5">
            {!isClosed && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={isPending}
                onClick={() => run(() => completeActionItem(item.id))}
                aria-label={`Concluir ${item.title}`}
                className="text-muted-foreground hover:text-success"
              >
                <Check aria-hidden="true" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  aria-label={`Alterar estado de ${item.title}`}
                >
                  Estado
                  <ChevronDown aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Definir estado</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STATUS_ORDER.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    disabled={s === item.status}
                    onSelect={() => run(() => advanceActionItem(item.id, s))}
                  >
                    {ACTION_ITEM_STATUS_LABEL[s]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditOpen(true)}
              aria-label={`Editar ${item.title}`}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <ConfirmDeleteButton
              action={() => deleteActionItem(item.id)}
              label={`Remover ${item.title}`}
              title="Remover este item de ação?"
              description={`O item “${item.title}” será removido permanentemente. Esta ação não pode ser desfeita.`}
            />
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {canWrite && (
        <CaseActionItemForm
          mode="edit"
          open={editOpen}
          onOpenChange={setEditOpen}
          caseId={caseId}
          item={item}
          assignees={assignees}
          phases={phases}
        />
      )}
    </li>
  );
}

/**
 * Case ACTION ITEMS panel (R4): systemic-improvement follow-ups with a light
 * lifecycle (aberto / em andamento / concluído / cancelado), an optional
 * assignee + due date, and an optional origin phase. staff_admin authors / edits
 * / deletes; the status controls funnel through the narrow advance/complete RPCs.
 * Overdue items are flagged. Client component fed plain props.
 */
export function CaseActionItemsPanel({
  caseId,
  items,
  assignees,
  phases,
  canWrite = true,
}: {
  caseId: string;
  items: CaseActionItem[];
  assignees: AssigneeOption[];
  phases: PhaseOption[];
  /**
   * Whether the viewer may author/edit action items (`canWriteContent`; ADR 0033).
   * Default `true` preserves the coordinator call-sites; a read-only viewer passes
   * `false` to render the list without any mutating affordance.
   */
  canWrite?: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  const openCount = items.filter(
    (i) => i.status === "open" || i.status === "in_progress",
  ).length;

  return (
    <section
      aria-labelledby="case-action-items-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListTodo aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2
            id="case-action-items-heading"
            className="text-base font-semibold"
          >
            Itens de ação
          </h2>
          {openCount > 0 && (
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[0.7rem] font-semibold text-accent-foreground tabular-nums">
              {openCount} em aberto
            </span>
          )}
        </div>
        {canWrite && (
          <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
            <Plus aria-hidden="true" />
            Novo item
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {canWrite
            ? "Nenhum item de ação. Registre melhorias sistêmicas e ações de acompanhamento decorrentes deste caso."
            : "Nenhum item de ação registrado."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <ActionItemRow
              key={item.id}
              item={item}
              assignees={assignees}
              phases={phases}
              caseId={caseId}
              canWrite={canWrite}
            />
          ))}
        </ul>
      )}

      {canWrite && (
        <CaseActionItemForm
          mode="create"
          open={addOpen}
          onOpenChange={setAddOpen}
          caseId={caseId}
          assignees={assignees}
          phases={phases}
        />
      )}
    </section>
  );
}

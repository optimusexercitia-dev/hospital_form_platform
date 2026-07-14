"use client";

import { useState } from "react";
import { Check, ListChecks, Pencil, Plus, X } from "lucide-react";

import type { ActionItemChecklistRow } from "@/lib/queries/action-item-checklists";
import {
  createActionItemChecklist,
  toggleActionItemChecklist,
  updateActionItemChecklist,
  deleteActionItemChecklist,
} from "@/lib/action-items/satellite-actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import { SatelliteSection, SatelliteEmpty } from "./satellite-section";
import { SatelliteConfirmDelete } from "./satellite-confirm-delete";
import { useSatelliteAction } from "./use-satellite-action";
import { formatDateTime } from "./format";

/**
 * CHECKLIST sub-panel — lightweight ordered subtasks scoped to one action item.
 * A row is a binary subtask (`is_done`); a toggle stamps who completed it and
 * when. Create/toggle/edit/delete are all stakeholder-gated (HC0I2 otherwise),
 * so the write controls render only for `canContribute`; a plain reader sees the
 * list with disabled checkboxes.
 */
export function ChecklistSection({
  actionItemId,
  itemTitle,
  checklist,
  canContribute,
  onMutated,
}: {
  actionItemId: string;
  itemTitle: string;
  checklist: ActionItemChecklistRow[];
  canContribute: boolean;
  onMutated: () => void | Promise<void>;
}) {
  const { run, isPending, error } = useSatelliteAction();
  const [newTitle, setNewTitle] = useState("");

  const total = checklist.length;
  const doneCount = checklist.filter((row) => row.isDone).length;
  const canAdd = newTitle.trim().length > 0 && !isPending;

  function handleAdd() {
    if (!canAdd) return;
    run(() => createActionItemChecklist(actionItemId, newTitle), {
      onSuccess: () => {
        setNewTitle("");
        return onMutated();
      },
    });
  }

  return (
    <SatelliteSection icon={ListChecks} title="Checklist" count={total}>
      {total > 0 && (
        <p className="text-xs text-muted-foreground tabular-nums">
          {doneCount}/{total} concluído{total === 1 ? "" : "s"}
        </p>
      )}

      {total === 0 ? (
        <SatelliteEmpty>
          {canContribute
            ? "Nenhuma subtarefa. Divida esta ação em passos verificáveis."
            : "Nenhuma subtarefa."}
        </SatelliteEmpty>
      ) : (
        <ul className="flex flex-col gap-1">
          {checklist.map((row) => (
            <ChecklistItem
              key={row.id}
              row={row}
              itemTitle={itemTitle}
              canContribute={canContribute}
              onMutated={onMutated}
            />
          ))}
        </ul>
      )}

      {canContribute && (
        <div className="flex items-center gap-2">
          <Input
            className="h-8 py-1 text-sm"
            placeholder="Nova subtarefa…"
            value={newTitle}
            disabled={isPending}
            aria-label="Título da nova subtarefa"
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canAdd}
            onClick={handleAdd}
          >
            <Plus aria-hidden="true" />
            Adicionar
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </SatelliteSection>
  );
}

/** One checklist subtask row, with inline title editing and a done toggle. */
function ChecklistItem({
  row,
  itemTitle,
  canContribute,
  onMutated,
}: {
  row: ActionItemChecklistRow;
  itemTitle: string;
  canContribute: boolean;
  onMutated: () => void | Promise<void>;
}) {
  const { run, isPending, error } = useSatelliteAction();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.title);

  const draftValid = draft.trim().length > 0;

  function handleSaveEdit() {
    if (!draftValid) return;
    run(() => updateActionItemChecklist(row.id, draft), {
      onSuccess: () => {
        setEditing(false);
        return onMutated();
      },
    });
  }

  return (
    <li className="flex flex-col gap-1 rounded-lg border border-border/70 bg-card px-3 py-2">
      <div className="flex items-center gap-2.5">
        <Checkbox
          checked={row.isDone}
          disabled={!canContribute || isPending}
          onCheckedChange={(next) =>
            run(() => toggleActionItemChecklist(row.id, next === true), {
              onSuccess: onMutated,
            })
          }
          aria-label={
            row.isDone
              ? `Reabrir subtarefa: ${row.title}`
              : `Concluir subtarefa: ${row.title}`
          }
        />

        {editing ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <Input
              autoFocus
              className="h-8 py-1 text-sm"
              value={draft}
              disabled={isPending}
              aria-label={`Editar subtarefa: ${row.title}`}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSaveEdit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setDraft(row.title);
                  setEditing(false);
                }
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={!draftValid || isPending}
              onClick={handleSaveEdit}
              aria-label="Salvar subtarefa"
              className="text-muted-foreground hover:text-success"
            >
              <Check aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={isPending}
              onClick={() => {
                setDraft(row.title);
                setEditing(false);
              }}
              aria-label="Cancelar edição"
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <span
            className={cn(
              "min-w-0 flex-1 text-sm",
              row.isDone
                ? "text-muted-foreground line-through"
                : "text-foreground",
            )}
          >
            {row.title}
          </span>
        )}

        {canContribute && !editing && (
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={isPending}
              onClick={() => {
                setDraft(row.title);
                setEditing(true);
              }}
              aria-label={`Editar subtarefa: ${row.title}`}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <SatelliteConfirmDelete
              action={() => deleteActionItemChecklist(row.id)}
              onDeleted={onMutated}
              label={`Remover subtarefa "${row.title}" de "${itemTitle}"`}
              title="Remover esta subtarefa?"
              description={`A subtarefa “${row.title}” será removida. Esta ação não pode ser desfeita.`}
            />
          </div>
        )}
      </div>

      {row.isDone && row.completedByName && (
        <p className="pl-7.5 text-[0.7rem] text-muted-foreground">
          Concluído por {row.completedByName}
          {row.completedAt ? ` · ${formatDateTime(row.completedAt)}` : ""}
        </p>
      )}

      {error && (
        <p role="alert" className="pl-7.5 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}

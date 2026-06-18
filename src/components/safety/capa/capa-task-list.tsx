"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import type { CapaActionTask } from "@/lib/safety/capa-types";
import {
  addCapaActionTask,
  removeCapaActionTask,
  setCapaActionTaskDone,
} from "@/lib/safety/capa-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSafetyAction } from "../use-safety-action";
import { RcaConfirmDelete } from "../rca/rca-confirm-delete";

/**
 * The execution-task checklist for one CAPA action. Each task toggles via
 * `setCapaActionTaskDone`; the writer adds/removes. Editable while the viewer may
 * manage the plan OR is the action's assignee (`canEdit` decided by the parent).
 */
export function CapaTaskList({
  actionId,
  tasks,
  canEdit,
}: {
  actionId: string;
  tasks: CapaActionTask[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { run } = useSafetyAction();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  const doneCount = tasks.filter((t) => t.isDone).length;

  function toggle(task: CapaActionTask) {
    run(() => setCapaActionTaskDone(task.id, !task.isDone));
  }

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    startTransition(async () => {
      const result = await addCapaActionTask(actionId, value);
      if (result.ok) {
        setText("");
        setAdding(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Tarefas
          {tasks.length > 0 && (
            <span className="ml-1.5 tabular-nums">
              {doneCount}/{tasks.length}
            </span>
          )}
        </h4>
        {canEdit && !adding && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAdding(true)}
          >
            <Plus aria-hidden="true" />
            Tarefa
          </Button>
        )}
      </div>

      {tasks.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground italic">
          Nenhuma tarefa.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-2">
              <Checkbox
                id={`task-${task.id}`}
                checked={task.isDone}
                disabled={!canEdit}
                onCheckedChange={() => toggle(task)}
              />
              <label
                htmlFor={`task-${task.id}`}
                className={cn(
                  "flex-1 text-sm",
                  task.isDone && "text-muted-foreground line-through",
                )}
              >
                {task.description}
              </label>
              {canEdit && (
                <RcaConfirmDelete
                  action={() => removeCapaActionTask(task.id)}
                  label={`Remover tarefa ${task.description}`}
                  title="Remover esta tarefa?"
                  description="A tarefa será removida da ação."
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && adding && (
        <form onSubmit={submitNew} className="flex items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            required
            placeholder="Descreva a tarefa…"
            className="h-9 flex-1 rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "…" : "Adicionar"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setAdding(false);
              setText("");
            }}
          >
            Cancelar
          </Button>
        </form>
      )}
    </div>
  );
}

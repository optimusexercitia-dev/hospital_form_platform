"use client";

import { useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronRight,
  GitBranch,
  Pencil,
  Target,
  UserRound,
} from "lucide-react";

import type {
  CapaAction,
  CapaActionEvidence,
  CapaActionTask,
} from "@/lib/safety/capa-types";
import type { AssignableUser, RcaRootCause } from "@/lib/safety/rca-types";
import {
  advanceCapaAction,
  completeCapaAction,
  removeCapaAction,
} from "@/lib/safety/capa-actions";
import { Button } from "@/components/ui/button";
import { useSafetyAction } from "../use-safety-action";
import { RcaConfirmDelete } from "../rca/rca-confirm-delete";
import { formatDate } from "../format";
import { CapaActionStatusChip, CapaStrengthPill } from "./capa-badges";
import { CapaActionForm } from "./capa-action-form";
import { CapaTaskList } from "./capa-task-list";
import { CapaEvidenceList } from "./capa-evidence-list";

/**
 * One CAPA corrective-action card: header (title · strength pill · status chip ·
 * root-cause link), meta (owner/assignee/due/measure), the assignee-OR-PQS advance
 * controls, and the tasks + implementation-evidence sub-panels.
 *
 * `canManage` (plan-level write) gates editing the action itself + tasks/evidence;
 * `canAdvance` (manager OR this action's assignee) gates the status controls.
 */
export function CapaActionCard({
  index,
  capaId,
  action,
  tasks,
  evidence,
  rootCauseText,
  users,
  rootCauses,
  canManage,
  canAdvance,
}: {
  index: number;
  capaId: string;
  action: CapaAction;
  tasks: CapaActionTask[];
  evidence: CapaActionEvidence[];
  /** Resolved root-cause statement text (when `action.rootCauseId` is set). */
  rootCauseText: string | null;
  users: AssignableUser[];
  rootCauses: RcaRootCause[];
  canManage: boolean;
  canAdvance: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const { run, isPending, error } = useSafetyAction();

  const isSettled =
    action.status === "concluida" || action.status === "cancelada";

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-start gap-2">
        <span className="mt-0.5 font-mono text-xs font-semibold text-muted-foreground tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h3 className="min-w-0 flex-1 text-base leading-snug text-pretty">
          {action.title}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          <CapaStrengthPill strength={action.actionStrength} />
          <CapaActionStatusChip status={action.status} />
          {canManage && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setEditOpen(true)}
                aria-label="Editar ação"
              >
                <Pencil aria-hidden="true" />
              </Button>
              <RcaConfirmDelete
                action={() => removeCapaAction(action.id)}
                label="Remover ação"
                title="Remover esta ação?"
                description="A ação corretiva e suas tarefas e evidências serão removidas."
              />
            </>
          )}
        </div>
      </div>

      {rootCauseText && (
        <p className="inline-flex items-start gap-1.5 text-xs text-primary">
          <GitBranch aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span className="text-pretty">
            Vinculado à causa raiz: {rootCauseText}
          </span>
        </p>
      )}

      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        {action.owner && (
          <span className="inline-flex items-center gap-1.5">
            <UserRound aria-hidden="true" className="size-4" />
            {action.owner}
          </span>
        )}
        {action.assigneeName && (
          <span className="inline-flex items-center gap-1.5">
            <UserRound aria-hidden="true" className="size-4 text-primary" />
            {action.assigneeName}
          </span>
        )}
        {action.dueDate && (
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <CalendarClock aria-hidden="true" className="size-4" />
            {formatDate(action.dueDate)}
          </span>
        )}
      </dl>

      {action.successMeasure && (
        <p className="inline-flex items-start gap-1.5 rounded-lg bg-muted/40 px-3 py-2 text-sm text-foreground">
          <Target aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="text-pretty">{action.successMeasure}</span>
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {/* Advance / complete controls (assignee-OR-PQS) */}
      {canAdvance && !isSettled && (
        <div className="flex flex-wrap items-center gap-2">
          {action.status === "pendente" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run(() => advanceCapaAction(action.id, "em_andamento"))}
            >
              <ChevronRight aria-hidden="true" />
              Iniciar
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() => run(() => completeCapaAction(action.id))}
          >
            <Check aria-hidden="true" />
            Concluir ação
          </Button>
          {canManage && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => run(() => advanceCapaAction(action.id, "cancelada"))}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancelar ação
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 border-t border-border/60 pt-3 sm:grid-cols-2">
        <CapaTaskList actionId={action.id} tasks={tasks} canEdit={canAdvance} />
        <CapaEvidenceList
          capaId={capaId}
          actionId={action.id}
          evidence={evidence}
          canEdit={canAdvance}
        />
      </div>

      {canManage && (
        <CapaActionForm
          mode="edit"
          open={editOpen}
          onOpenChange={setEditOpen}
          capaId={capaId}
          action={action}
          users={users}
          rootCauses={rootCauses}
        />
      )}
    </li>
  );
}

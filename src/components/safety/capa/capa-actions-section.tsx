"use client";

import { useState } from "react";
import { ListTodo, Plus } from "lucide-react";

import type {
  CapaAction,
  CapaActionEvidence,
  CapaActionTask,
  CapaPlan,
} from "@/lib/safety/capa-types";
import type { AssignableUser, RcaRootCause } from "@/lib/safety/rca-types";
import { Button } from "@/components/ui/button";
import { canAdvanceAction } from "./capa-derive";
import { CapaActionCard } from "./capa-action-card";
import { CapaActionForm } from "./capa-action-form";

/**
 * The CAPA actions section: the "Adicionar ação" affordance (plan-managers only) +
 * the list of {@link CapaActionCard}s in `position` order. Per-action advance
 * entitlement is computed from the plan manager flag OR the action's assignee vs the
 * session user.
 */
export function CapaActionsSection({
  plan,
  actions,
  tasksByAction,
  evidenceByAction,
  rootCauseTextById,
  users,
  rootCauses,
  sessionUserId,
}: {
  plan: CapaPlan;
  actions: CapaAction[];
  tasksByAction: Map<string, CapaActionTask[]>;
  evidenceByAction: Map<string, CapaActionEvidence[]>;
  /** root cause id → statement text (for the "Vinculado à causa raiz: …" line). */
  rootCauseTextById: Map<string, string>;
  users: AssignableUser[];
  rootCauses: RcaRootCause[];
  sessionUserId: string | null;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const canManage = plan.viewerCanManage;

  return (
    <section
      aria-labelledby="capa-actions-heading"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListTodo aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2 id="capa-actions-heading" className="text-lg">
            Ações corretivas
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {actions.length}
          </span>
        </div>
        {canManage && (
          <Button type="button" onClick={() => setAddOpen(true)}>
            <Plus aria-hidden="true" />
            Adicionar ação
          </Button>
        )}
      </div>

      {actions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
          {canManage
            ? "Nenhuma ação ainda. Adicione a primeira ação corretiva."
            : "Nenhuma ação registrada."}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {actions.map((action, index) => (
            <CapaActionCard
              key={action.id}
              index={index}
              capaId={plan.id}
              action={action}
              tasks={tasksByAction.get(action.id) ?? []}
              evidence={evidenceByAction.get(action.id) ?? []}
              rootCauseText={
                action.rootCauseId
                  ? rootCauseTextById.get(action.rootCauseId) ?? null
                  : null
              }
              users={users}
              rootCauses={rootCauses}
              canManage={canManage}
              canAdvance={canAdvanceAction(plan, action, sessionUserId)}
            />
          ))}
        </ol>
      )}

      {canManage && (
        <CapaActionForm
          mode="create"
          open={addOpen}
          onOpenChange={setAddOpen}
          capaId={plan.id}
          users={users}
          rootCauses={rootCauses}
        />
      )}
    </section>
  );
}

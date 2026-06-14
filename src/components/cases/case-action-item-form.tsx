"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  createActionItem,
  updateActionItem,
  type ActionState,
  type CreateActionItemState,
} from "@/lib/cases/action-items-actions";
import type { CaseActionItem } from "@/lib/queries/case-action-items";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import type { AssigneeOption } from "@/components/cases/case-phase-list";

const FIELD_CLASS =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** One phase option for the "origin phase" picker (id + label). */
export interface PhaseOption {
  id: string;
  label: string;
}

/**
 * Create / edit a case action item (R4) — a systemic-improvement follow-up.
 * `useActionState`-shaped against {@link createActionItem} /
 * {@link updateActionItem}; on success the dialog closes and the route refreshes.
 * The `sourceCasePhaseId` (origin phase) is only offered on create.
 */
export function CaseActionItemForm({
  mode,
  open,
  onOpenChange,
  caseId,
  item,
  assignees,
  phases,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  /** Required for `edit`; ignored for `create`. */
  item?: CaseActionItem;
  assignees: AssigneeOption[];
  phases: PhaseOption[];
}) {
  const action = mode === "create" ? createActionItem : updateActionItem;
  const [state, formAction, isPending] = useActionState<
    (CreateActionItemState & ActionState) | undefined,
    FormData
  >(action, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo item de ação" : "Editar item de ação"}
          </DialogTitle>
          <DialogDescription>
            Registre uma melhoria sistêmica ou ação de acompanhamento decorrente
            deste caso. Nunca inclua dados de paciente.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4" noValidate>
          {mode === "create" ? (
            <input type="hidden" name="caseId" value={caseId} />
          ) : (
            <input type="hidden" name="actionItemId" value={item?.id ?? ""} />
          )}

          {state && !state.ok && !state.fieldErrors?.title && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Título</span>
            <input
              name="title"
              type="text"
              required
              className={FIELD_CLASS}
              defaultValue={item?.title ?? ""}
              placeholder="Ex.: Revisar protocolo de higienização"
              aria-invalid={state?.fieldErrors?.title ? true : undefined}
            />
            {state?.fieldErrors?.title && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.title}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Descrição{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <textarea
              name="description"
              rows={3}
              className={FIELD_CLASS}
              defaultValue={item?.description ?? ""}
              placeholder="Detalhe a ação a ser tomada…"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Responsável{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </span>
              <select
                name="assignedTo"
                className={FIELD_CLASS}
                defaultValue={item?.assignedTo ?? ""}
              >
                <option value="">Sem responsável</option>
                {assignees.map((a) => (
                  <option key={a.userId} value={a.userId}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Prazo{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </span>
              <input
                name="dueDate"
                type="date"
                className={FIELD_CLASS}
                defaultValue={item?.dueDate ?? ""}
              />
            </label>
          </div>

          {mode === "create" && phases.length > 0 && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Fase de origem{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </span>
              <select name="sourceCasePhaseId" className={FIELD_CLASS} defaultValue="">
                <option value="">Nenhuma</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">
                A fase cuja revisão gerou esta ação, se houver.
              </span>
            </label>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending
                ? "Salvando…"
                : mode === "create"
                  ? "Criar item"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

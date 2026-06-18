"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  CAPA_ACTION_STRENGTH_LABELS,
  CAPA_ACTION_STRENGTH_ORDER,
  type CapaAction,
  type CapaActionInput,
  type CapaActionStrength,
} from "@/lib/safety/capa-types";
import type { AssignableUser, RcaRootCause } from "@/lib/safety/rca-types";
import type { ActionState } from "@/lib/safety/types";
import { addCapaAction, updateCapaAction } from "@/lib/safety/capa-actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60";

function userLabel(u: AssignableUser): string {
  return u.name ?? u.email ?? "Usuário";
}

/**
 * Create/edit a CAPA corrective action. Captures the JC action-strength, the
 * free-text owner + an optional platform assignee (who may self-advance), due date,
 * success measure, and the root-cause link (`rootCauseId` → the 14c RCA root cause).
 * When opened from a specific root cause, `defaultRootCauseId` pre-selects it.
 */
export function CapaActionForm({
  mode,
  open,
  onOpenChange,
  capaId,
  action,
  users,
  rootCauses,
  defaultRootCauseId,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  capaId: string;
  /** Required for `edit`. */
  action?: CapaAction;
  /** Assignable-user roster for the assignee picker. */
  users: AssignableUser[];
  /** The source RCA's root causes (empty for a non-RCA plan). */
  rootCauses: RcaRootCause[];
  /** Pre-selected root cause on create (when opened from a specific root cause). */
  defaultRootCauseId?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState | null>(null);

  const [title, setTitle] = useState(action?.title ?? "");
  const [owner, setOwner] = useState(action?.owner ?? "");
  const [assigneeUserId, setAssigneeUserId] = useState(action?.assigneeUserId ?? "");
  const [dueDate, setDueDate] = useState(action?.dueDate ?? "");
  const [strength, setStrength] = useState<CapaActionStrength>(
    action?.actionStrength ?? "intermediaria",
  );
  const [successMeasure, setSuccessMeasure] = useState(action?.successMeasure ?? "");
  const [rootCauseId, setRootCauseId] = useState(
    action?.rootCauseId ?? defaultRootCauseId ?? "",
  );

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setTitle(action?.title ?? "");
      setOwner(action?.owner ?? "");
      setAssigneeUserId(action?.assigneeUserId ?? "");
      setDueDate(action?.dueDate ?? "");
      setStrength(action?.actionStrength ?? "intermediaria");
      setSuccessMeasure(action?.successMeasure ?? "");
      setRootCauseId(action?.rootCauseId ?? defaultRootCauseId ?? "");
    }
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: CapaActionInput = {
      title: title.trim(),
      owner: owner.trim() || null,
      assigneeUserId: assigneeUserId || null,
      dueDate: dueDate || null,
      actionStrength: strength,
      successMeasure: successMeasure.trim() || null,
      rootCauseId: rootCauseId || null,
    };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await addCapaAction(capaId, input)
          : await updateCapaAction(action!.id, input);
      setState(result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nova ação corretiva" : "Editar ação"}
          </DialogTitle>
          <DialogDescription>
            Defina a ação, sua força (hierarquia Joint Commission), o responsável e a
            medida de sucesso.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Título da ação</span>
            <Textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              rows={2}
              className="text-sm"
              placeholder="Ex.: Implementar via clínica padronizada de escalonamento"
            />
          </label>

          <fieldset className="flex flex-col gap-1.5 text-sm">
            <legend className="font-medium">Força da ação</legend>
            <div
              role="radiogroup"
              aria-label="Força da ação"
              className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-0.5"
            >
              {CAPA_ACTION_STRENGTH_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={strength === s}
                  onClick={() => setStrength(s)}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                    strength === s
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {CAPA_ACTION_STRENGTH_LABELS[s]}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              Ações fortes (mudanças de sistema) são mais confiáveis que ações fracas
              (treinamento, alertas).
            </span>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Responsável (texto)</span>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className={FIELD_CLASS}
                placeholder="Ex.: Dra. Okafor"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Prazo</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={FIELD_CLASS}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Encarregado (avança a própria ação)</span>
            <select
              value={assigneeUserId}
              onChange={(e) => setAssigneeUserId(e.target.value)}
              className={FIELD_CLASS}
            >
              <option value="">Sem encarregado</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {userLabel(u)}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              O encarregado pode avançar e concluir esta ação, mesmo sem gerenciar o
              plano.
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Medida de sucesso</span>
            <Textarea
              value={successMeasure}
              onChange={(e) => setSuccessMeasure(e.target.value)}
              rows={2}
              className="text-sm"
              placeholder="Ex.: Tempo mediano até escalonamento < 10 min"
            />
          </label>

          {rootCauses.length > 0 && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Causa raiz endereçada (opcional)</span>
              <select
                value={rootCauseId}
                onChange={(e) => setRootCauseId(e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">Nenhuma</option>
                {rootCauses.map((rc, i) => (
                  <option key={rc.id} value={rc.id}>
                    {String(i + 1).padStart(2, "0")} — {rc.text || "Causa sem texto"}
                  </option>
                ))}
              </select>
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
                  ? "Adicionar ação"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

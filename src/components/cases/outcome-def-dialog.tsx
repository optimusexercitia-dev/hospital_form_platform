"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CaseOutcome, CaseOutcomeColorToken } from "@/lib/queries/case-outcomes";
import {
  createCaseOutcome,
  updateCaseOutcome,
  type ActionState,
  type CaseOutcomeInput,
} from "@/lib/cases/outcomes-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import { ColorTokenPicker } from "./color-token-picker";
import { cn } from "@/lib/utils";
import { TOKEN_STYLES } from "./case-status-badge";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Create / edit a case outcome definition (D8–D11): label + colour + the two
 * advisory flags ("Requer plano de ação" / "Evento adverso"). Arg-based actions
 * run inside a transition; errors stay on screen and the route refreshes on
 * success. A live chip previews the name + colour. Flag edits propagate to every
 * case/process referencing the outcome (D11).
 */
export function OutcomeDefDialog({
  mode,
  open,
  onOpenChange,
  commissionId,
  outcome,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commissionId: string;
  /** Required for `edit`. */
  outcome?: CaseOutcome;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState | null>(null);

  const [label, setLabel] = useState(outcome?.label ?? "");
  const [colorToken, setColorToken] = useState<CaseOutcomeColorToken>(
    outcome?.colorToken ?? "blue",
  );
  const [requiresActionPlan, setRequiresActionPlan] = useState(
    outcome?.requiresActionPlan ?? false,
  );
  const [isAdverse, setIsAdverse] = useState(outcome?.isAdverse ?? false);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setLabel(outcome?.label ?? "");
      setColorToken(outcome?.colorToken ?? "blue");
      setRequiresActionPlan(outcome?.requiresActionPlan ?? false);
      setIsAdverse(outcome?.isAdverse ?? false);
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
    const input: CaseOutcomeInput = {
      label: label.trim(),
      colorToken,
      requiresActionPlan,
      isAdverse,
    };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createCaseOutcome(commissionId, input)
          : await updateCaseOutcome(outcome!.id, input);
      setState(result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo desfecho" : "Editar desfecho"}
          </DialogTitle>
          <DialogDescription>
            Desfechos registram a conclusão de cada caso e alimentam os relatórios
            (incluindo a proporção de eventos adversos).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && !state.fieldErrors?.label && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Nome</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              className={FIELD_CLASS}
              placeholder="Ex.: Resolvido sem dano"
              aria-invalid={state?.fieldErrors?.label ? true : undefined}
            />
            {state?.fieldErrors?.label && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.label}
              </span>
            )}
          </label>

          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Cor</span>
            <ColorTokenPicker value={colorToken} onChange={setColorToken} />
          </div>

          <fieldset className="flex flex-col gap-2.5 text-sm">
            <legend className="font-medium">Sinalizações</legend>
            <label className="flex items-start gap-2.5">
              <Checkbox
                checked={requiresActionPlan}
                onCheckedChange={(c) => setRequiresActionPlan(c === true)}
                className="mt-0.5"
              />
              <span className="flex flex-col">
                <span>Requer plano de ação</span>
                <span className="text-xs text-muted-foreground">
                  Exibe um lembrete ao concluir um caso com este desfecho. Não
                  impede a conclusão.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5">
              <Checkbox
                checked={isAdverse}
                onCheckedChange={(c) => setIsAdverse(c === true)}
                className="mt-0.5"
              />
              <span className="flex flex-col">
                <span>Evento adverso</span>
                <span className="text-xs text-muted-foreground">
                  Conta na proporção de eventos adversos do painel. Apenas para
                  acompanhamento.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Pré-visualização</span>
            <span
              className={cn(
                "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                TOKEN_STYLES[colorToken] ?? TOKEN_STYLES.muted,
              )}
            >
              {label.trim() || "Sem nome"}
            </span>
          </div>

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
                  ? "Criar desfecho"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

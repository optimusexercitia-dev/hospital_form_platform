"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  PhaseResult,
  PhaseResultColorToken,
} from "@/lib/queries/phase-results";
import {
  createPhaseResult,
  updatePhaseResult,
  type ActionState,
  type PhaseResultInput,
} from "@/lib/cases/result-actions";
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
 * Create / edit a per-phase RESULT definition (phase-results feature): label +
 * colour + the single advisory `isAdverse` flag. Mirrors {@link OutcomeDefDialog}
 * but result options carry NO `requiresActionPlan` field. Arg-based actions run
 * inside a transition; errors stay on screen and the route refreshes on success.
 * A live chip previews the name + colour. Edits propagate LIVE to every
 * case/template referencing the result (shared-row vocabulary).
 */
export function ResultDefDialog({
  mode,
  open,
  onOpenChange,
  commissionId,
  result,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commissionId: string;
  /** Required for `edit`. */
  result?: PhaseResult;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState | null>(null);

  const [label, setLabel] = useState(result?.label ?? "");
  const [colorToken, setColorToken] = useState<PhaseResultColorToken>(
    result?.colorToken ?? "blue",
  );
  const [isAdverse, setIsAdverse] = useState(result?.isAdverse ?? false);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setLabel(result?.label ?? "");
      setColorToken(result?.colorToken ?? "blue");
      setIsAdverse(result?.isAdverse ?? false);
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
    const input: PhaseResultInput = {
      label: label.trim(),
      colorToken,
      isAdverse,
    };
    startTransition(async () => {
      const next =
        mode === "create"
          ? await createPhaseResult(commissionId, input)
          : await updatePhaseResult(result!.id, input);
      setState(next);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo resultado" : "Editar resultado"}
          </DialogTitle>
          <DialogDescription>
            Resultados registram o desfecho categórico de uma fase quando o
            formulário é enviado e alimentam os relatórios.
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
              placeholder="Ex.: Conforme"
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
                checked={isAdverse}
                onCheckedChange={(c) => setIsAdverse(c === true)}
                className="mt-0.5"
              />
              <span className="flex flex-col">
                <span>Resultado adverso</span>
                <span className="text-xs text-muted-foreground">
                  Marca o resultado como sinal adverso para acompanhamento no
                  painel. Apenas informativo.
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
                  ? "Criar resultado"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

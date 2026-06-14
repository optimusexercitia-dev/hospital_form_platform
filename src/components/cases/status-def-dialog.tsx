"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  CaseStatusColorToken,
  CaseStatusDef,
} from "@/lib/queries/case-statuses";
import {
  createCaseStatus,
  updateCaseStatus,
  type ActionState,
  type CaseStatusInput,
} from "@/lib/cases/status-actions";
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
import { ColorTokenPicker } from "./color-token-picker";
import { CaseStatusBadge } from "./case-status-badge";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Create / edit a case-status definition (Cases-Extras R2): label, palette
 * colour, and the `is_initial` / `is_terminal` flags. The `key` is immutable
 * (it's the value stored on existing cases) — shown read-only on edit, derived
 * server-side on create. A live badge previews the chosen label + colour.
 *
 * The arg-based actions (`createCaseStatus`/`updateCaseStatus`) return an
 * `ActionState`; run inside a transition so field/top-level errors stay on screen
 * and the route refreshes on success.
 */
export function StatusDefDialog({
  mode,
  open,
  onOpenChange,
  commissionId,
  def,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commissionId: string;
  /** Required for `edit`. */
  def?: CaseStatusDef;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState | null>(null);

  const [label, setLabel] = useState(def?.label ?? "");
  const [colorToken, setColorToken] = useState<CaseStatusColorToken>(
    def?.colorToken ?? "slate",
  );
  const [isInitial, setIsInitial] = useState(def?.isInitial ?? false);
  const [isTerminal, setIsTerminal] = useState(def?.isTerminal ?? false);

  // Reset the form to the def's values each time the dialog OPENS (render-phase
  // prop-sync, the project's "adjust state when a prop changes" pattern).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setLabel(def?.label ?? "");
      setColorToken(def?.colorToken ?? "slate");
      setIsInitial(def?.isInitial ?? false);
      setIsTerminal(def?.isTerminal ?? false);
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
    const input: CaseStatusInput = {
      label: label.trim(),
      colorToken,
      isInitial,
      isTerminal,
    };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createCaseStatus(commissionId, input)
          : await updateCaseStatus(def!.key, commissionId, input);
      setState(result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo estado" : "Editar estado"}
          </DialogTitle>
          <DialogDescription>
            Defina como o estado aparece e se ele é o estado inicial ou um estado
            final.
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
              placeholder="Ex.: Em revisão"
              aria-invalid={state?.fieldErrors?.label ? true : undefined}
            />
            {state?.fieldErrors?.label && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.label}
              </span>
            )}
          </label>

          {mode === "edit" && def && (
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-muted-foreground">Chave</span>
              <span className="font-mono text-xs text-muted-foreground">
                {def.key}{" "}
                <span className="font-sans not-italic">
                  (não pode ser alterada)
                </span>
              </span>
            </div>
          )}

          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Cor</span>
            <ColorTokenPicker value={colorToken} onChange={setColorToken} />
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Pré-visualização</span>
            <CaseStatusBadge
              label={label.trim() || "Sem nome"}
              colorToken={colorToken}
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Comportamento do estado</legend>
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={isInitial}
                onChange={(e) => setIsInitial(e.target.checked)}
                className="mt-0.5 size-4 rounded border-input accent-primary"
              />
              <span className="flex flex-col">
                <span className="font-medium">Estado inicial</span>
                <span className="text-xs text-muted-foreground">
                  Novos casos entram neste estado. Só um por comissão.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={isTerminal}
                onChange={(e) => setIsTerminal(e.target.checked)}
                className="mt-0.5 size-4 rounded border-input accent-primary"
              />
              <span className="flex flex-col">
                <span className="font-medium">Estado final</span>
                <span className="text-xs text-muted-foreground">
                  Um caso neste estado é congelado e suas fases abertas são
                  encerradas.
                </span>
              </span>
            </label>
          </fieldset>

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
                  ? "Criar estado"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

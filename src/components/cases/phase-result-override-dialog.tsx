"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ResolvedPhaseResult } from "@/lib/queries/phase-results";
import {
  overrideCasePhaseResult,
  type ActionState,
} from "@/lib/cases/result-actions";
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
import { cn } from "@/lib/utils";
import { TOKEN_STYLES } from "./case-status-badge";

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

const TEXTAREA_CLASS =
  "min-h-20 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Staff-admin POST-CONCLUSION result correction (phase-results feature; task #10).
 * A coordinator-only "Corrigir resultado" surface on a `concluida` phase: pick any
 * active result option (or clear to fall back to the computed result) + an optional
 * reason, calling {@link overrideCasePhaseResult}. The server stashes the override
 * and recomputes the effective result honoring it (`source = 'manual'`); the
 * case-detail path revalidates so the {@link PhaseResultBadge} reflects the
 * correction. Distinct from the wizard's pre-submit override (task #8) — this is
 * the after-the-fact correction once the phase is locked.
 */
export function PhaseResultOverrideDialog({
  open,
  onOpenChange,
  casePhaseId,
  options,
  currentResultId,
  phaseLabel,
  allowClear = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  casePhaseId: string;
  /**
   * The result options the picker offers. For a MANUAL phase this is the phase's
   * author-selected allowed subset (the host narrows it); for an automatic phase
   * it is the commission's full active vocabulary.
   */
  options: ResolvedPhaseResult[];
  /** The phase's CURRENT effective result id (pre-selects the picker); `null` if none. */
  currentResultId: string | null;
  /** A label for the dialog title (e.g. "Fase 2 — Revisão"). */
  phaseLabel: string;
  /**
   * Whether the result may be CLEARED (automatic phases — revert to the computed
   * result). `false` for a MANUAL phase: the result is mandatory, so the "use the
   * computed result" option is hidden and a selection is required before saving.
   * Default `true`.
   */
  allowClear?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState | null>(null);

  const [resultId, setResultId] = useState<string>(currentResultId ?? "");
  const [reason, setReason] = useState<string>("");

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setResultId(currentResultId ?? "");
      setReason("");
    }
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  // A MANUAL phase requires a selection (clearing is rejected server-side, HC062).
  const missingRequired = !allowClear && !resultId;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (missingRequired) return;
    // "" → null clears any override (revert to the computed result). For a manual
    // phase clearing is disallowed, so `resultId` is always set when we reach here.
    const chosen = resultId || null;
    const trimmedReason = reason.trim() || null;
    startTransition(async () => {
      const next = await overrideCasePhaseResult(
        casePhaseId,
        chosen,
        trimmedReason,
      );
      setState(next);
    });
  }

  const selected = options.find((o) => o.id === resultId) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corrigir resultado</DialogTitle>
          <DialogDescription>
            {allowClear
              ? `Ajuste o resultado registrado para ${phaseLabel}. O resultado corrigido é marcado como manual.`
              : `Esta fase tem resultado manual: escolha uma das opções permitidas para ${phaseLabel}. O resultado é obrigatório e não pode ser removido.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Resultado
              {!allowClear && (
                <span className="text-destructive" aria-hidden="true">
                  {" "}
                  *
                </span>
              )}
            </span>
            <select
              className={SELECT_CLASS}
              value={resultId}
              onChange={(e) => setResultId(e.target.value)}
              disabled={isPending}
              required={!allowClear}
              aria-required={!allowClear}
            >
              {allowClear ? (
                <option value="">Limpar (usar o resultado calculado)</option>
              ) : (
                // Manual phase: no "clear" option — a result is mandatory. The
                // disabled placeholder only shows until a choice is made.
                !resultId && (
                  <option value="" disabled>
                    Selecione um resultado…
                  </option>
                )
              )}
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {selected && (
            <p className="inline-flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">Será registrado como:</span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  TOKEN_STYLES[selected.colorToken] ?? TOKEN_STYLES.muted,
                )}
              >
                {selected.label}
              </span>
            </p>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Justificativa{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </span>
            <textarea
              className={TEXTAREA_CLASS}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isPending}
              placeholder="Descreva o motivo da correção…"
            />
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={isPending || missingRequired}
            >
              {isPending ? "Salvando…" : "Salvar correção"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

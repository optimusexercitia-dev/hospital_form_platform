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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  casePhaseId: string;
  /** The commission's active result options. */
  options: ResolvedPhaseResult[];
  /** The phase's CURRENT effective result id (pre-selects the picker); `null` if none. */
  currentResultId: string | null;
  /** A label for the dialog title (e.g. "Fase 2 — Revisão"). */
  phaseLabel: string;
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // "" → null clears any override (revert to the computed result).
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
            Ajuste o resultado registrado para {phaseLabel}. O resultado corrigido
            é marcado como manual.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Resultado</span>
            <select
              className={SELECT_CLASS}
              value={resultId}
              onChange={(e) => setResultId(e.target.value)}
              disabled={isPending}
            >
              <option value="">Limpar (usar o resultado calculado)</option>
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
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar correção"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

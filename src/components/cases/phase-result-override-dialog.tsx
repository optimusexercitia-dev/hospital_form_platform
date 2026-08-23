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
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { TOKEN_STYLES } from "./case-status-badge";


const TEXTAREA_CLASS =
  "min-h-20 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The case-detail result surface (phase-results feature; task #10): pick a result
 * option (or clear it, on an automatic phase, to fall back to the computed one) +
 * an optional reason, calling {@link overrideCasePhaseResult}.
 *
 * Two modes, mirroring the door's two branches:
 *   - `correct` — POST-CONCLUSION correction of a `completed` phase, coordinator
 *     only. The server stashes the override AND recomputes the effective result
 *     honoring it (`source = 'manual'`), so it applies immediately.
 *   - `set` — on an `active` phase, offered to that phase's OWN assignee as well as
 *     a coordinator. The server only STASHES the override; it takes effect when the
 *     phase concludes. Same entry point as the wizard's pre-submit override (task
 *     #8), reachable without re-entering the wizard.
 *
 * The case-detail path revalidates either way, so the {@link PhaseResultBadge}
 * reflects the change.
 */
export function PhaseResultOverrideDialog({
  open,
  onOpenChange,
  casePhaseId,
  options,
  currentResultId,
  phaseLabel,
  allowClear = true,
  mode = "correct",
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
  /**
   * `correct` = a settled `completed` phase (the server recomputes now); `set` = an
   * `active` phase (the result is stashed and applies on conclusion). Drives the
   * title, the description and the submit label. Default `correct`.
   */
  mode?: "set" | "correct";
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

  // Copy per mode. On an ACTIVE phase nothing is being fixed — the result is being
  // recorded ahead of conclusion, and saying "correção" there would tell an assignee
  // they are undoing a mistake. A MANUAL phase's mandatory-pick wording wins over
  // both, because that constraint is what the server will actually enforce (HC062).
  const isSet = mode === "set";
  const description = !allowClear
    ? `Esta fase tem resultado manual: escolha uma das opções permitidas para ${phaseLabel}. O resultado é obrigatório e não pode ser removido.`
    : isSet
      ? `Registre o resultado de ${phaseLabel}. Ele fica guardado e passa a valer quando a fase for concluída.`
      : `Ajuste o resultado registrado para ${phaseLabel}. O resultado corrigido é marcado como manual.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isSet ? "Definir resultado" : "Corrigir resultado"}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
            <NativeSelect
              className="h-10"
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
            </NativeSelect>
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
              placeholder={
                isSet
                  ? "Descreva o motivo desta escolha…"
                  : "Descreva o motivo da correção…"
              }
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
              {isPending ? "Salvando…" : isSet ? "Salvar resultado" : "Salvar correção"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";

import type { AnswerMap, ResultRuleset } from "@/lib/queries/conditions";
import { walkResultRuleset } from "@/lib/queries/conditions";
import type { ResolvedPhaseResult } from "@/lib/queries/phase-results";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { TOKEN_STYLES } from "@/components/cases/case-status-badge";

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

const TEXTAREA_CLASS =
  "min-h-20 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The end-of-wizard per-phase RESULT panel (phase-results feature; task #8),
 * rendered on the review screen as a sibling of the sign-off blocks and gated on
 * `WizardData.phaseResult` being present (case-phase fills only — never standalone
 * forms).
 *
 * It shows the LIVE COMPUTED result — the client-side {@link walkResultRuleset}
 * over the wizard's current answer map, the exact mirror of what the conclusion
 * trigger will compute at submit — and an optional manual OVERRIDE: a result-option
 * picker (the active `options`) plus a reason textarea. The override is owned by
 * `WizardClient`; on submit it routes through `submitCasePhaseResponse` (vs plain
 * `submitResponse`), which stashes the override on the still-`ativa` phase before
 * the conclusion trigger honors it. Clearing the picker reverts to the computed
 * result.
 */
export function PhaseResultPanel({
  ruleset,
  options,
  answerMap,
  overrideEnabled,
  overrideResultId,
  reason,
  saving,
  onToggleOverride,
  onChangeOverrideResult,
  onChangeReason,
}: {
  /** The phase's snapshotted ruleset (drives the live computed preview). */
  ruleset: ResultRuleset | null;
  /** The commission's active result options for the override picker. */
  options: ResolvedPhaseResult[];
  /** The wizard's current answer map (question_key → value). */
  answerMap: AnswerMap;
  /** Whether the manual override is enabled (the picker is shown). */
  overrideEnabled: boolean;
  /** The chosen override option id, or "" when none picked yet. */
  overrideResultId: string;
  /** The optional override justification. */
  reason: string;
  /** Whether a submit is in flight — disables the controls. */
  saving: boolean;
  onToggleOverride: (enabled: boolean) => void;
  onChangeOverrideResult: (resultId: string) => void;
  onChangeReason: (reason: string) => void;
}) {
  const optionsById = useMemo(() => {
    const map = new Map<string, ResolvedPhaseResult>();
    for (const o of options) map.set(o.id, o);
    return map;
  }, [options]);

  // The live computed result (first-match-wins → default → none), exactly as the
  // backend will compute it at conclude. A plain pure call — no memo needed, but we
  // keep it lightweight.
  const computedId = useMemo(
    () => walkResultRuleset(ruleset, answerMap),
    [ruleset, answerMap],
  );
  const computed = computedId ? optionsById.get(computedId) ?? null : null;

  const overrideResult = overrideResultId
    ? optionsById.get(overrideResultId) ?? null
    : null;

  return (
    <section
      aria-labelledby="phase-result-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Resultado da fase
        </span>
        <h2 id="phase-result-heading" className="text-lg font-semibold">
          Resultado ao enviar
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          Com base nas respostas, esta fase emitirá o resultado abaixo ao ser
          enviada. Você pode ajustá-lo manualmente, se necessário.
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Sparkles aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <span className="text-muted-foreground">Resultado calculado:</span>
        {computed ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              TOKEN_STYLES[computed.colorToken] ?? TOKEN_STYLES.muted,
            )}
          >
            {computed.label}
          </span>
        ) : (
          <span className="text-muted-foreground italic">Nenhum</span>
        )}
      </div>

      <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
        <legend className="sr-only">Ajuste manual do resultado</legend>
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox
            checked={overrideEnabled}
            onCheckedChange={(c) => onToggleOverride(c === true)}
            disabled={saving}
            className="mt-0.5"
          />
          <span className="flex flex-col">
            <span className="font-medium">Ajustar o resultado manualmente</span>
            <span className="text-xs text-muted-foreground">
              Substitui o resultado calculado pelo que você escolher abaixo.
            </span>
          </span>
        </label>

        {overrideEnabled && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Resultado escolhido</span>
              <select
                className={SELECT_CLASS}
                value={overrideResultId}
                onChange={(e) => onChangeOverrideResult(e.target.value)}
                disabled={saving}
              >
                <option value="">Selecione um resultado…</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            {overrideResult && (
              <p className="inline-flex items-center gap-1.5 text-sm">
                <span className="text-muted-foreground">Será registrado como:</span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    TOKEN_STYLES[overrideResult.colorToken] ?? TOKEN_STYLES.muted,
                  )}
                >
                  {overrideResult.label}
                </span>
              </p>
            )}

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Justificativa{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </span>
              <textarea
                className={TEXTAREA_CLASS}
                value={reason}
                onChange={(e) => onChangeReason(e.target.value)}
                disabled={saving}
                placeholder="Descreva o motivo do ajuste…"
              />
            </label>
          </div>
        )}
      </fieldset>
    </section>
  );
}

"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";

import type { AnswerMap, ResultRuleset } from "@/lib/queries/conditions";
import { walkResultRuleset } from "@/lib/queries/conditions";
import type { ResolvedPhaseResult } from "@/lib/queries/phase-results";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { TOKEN_COLOR_VAR, TOKEN_STYLES } from "@/components/cases/case-status-badge";

const TEXTAREA_CLASS =
  "min-h-20 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The end-of-wizard per-phase RESULT panel (phase-results feature; extended by
 * phase-result-manual-mode), rendered on the review screen as a sibling of the
 * sign-off blocks and gated on `WizardData.phaseResult` (case-phase fills only).
 *
 * Two modes:
 *   - AUTOMATIC: shows the LIVE COMPUTED result — the client-side
 *     {@link walkResultRuleset} over the wizard's current answer map, the exact
 *     mirror of what the conclusion trigger computes at submit — plus an OPTIONAL
 *     manual override (a picker over the active vocabulary + a reason).
 *   - MANUAL: no automatic rules — the filler MUST pick a result from `options`
 *     (the author-selected allowed subset) before submit. The picker is REQUIRED;
 *     `WizardClient` blocks submit until a choice is made (the server enforces it
 *     too).
 *
 * Either way the chosen id is owned by `WizardClient`; on submit it routes through
 * `submitCasePhaseResponse`, which stashes it on the still-`ativa` phase before the
 * conclusion trigger honors it.
 */
export function PhaseResultPanel({
  mode,
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
  /** `automatic` (computed + optional override) or `manual` (required picker). */
  mode: "automatic" | "manual";
  /** The phase's snapshotted ruleset (drives the live computed preview). */
  ruleset: ResultRuleset | null;
  /** AUTOMATIC: active vocabulary. MANUAL: the author-selected allowed subset. */
  options: ResolvedPhaseResult[];
  /** The wizard's current answer map (question_key → value). */
  answerMap: AnswerMap;
  /** AUTOMATIC only: whether the optional override is enabled (the picker shows). */
  overrideEnabled: boolean;
  /** The chosen option id, or "" when none picked yet. */
  overrideResultId: string;
  /** AUTOMATIC only: the optional override justification. */
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

  const chosen = overrideResultId
    ? optionsById.get(overrideResultId) ?? null
    : null;

  // ---- MANUAL: a required result picker (no computed result; no reason) ----
  if (mode === "manual") {
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
            Selecione o resultado
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground text-pretty">
            Esta fase exige que você selecione um resultado antes de enviar.
          </p>
        </div>

        <fieldset className="flex flex-col gap-1.5 text-sm">
          <legend className="font-medium">
            Resultado da fase{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </legend>
          <ResultChoiceGroup
            name="phase-result-manual"
            options={options}
            value={overrideResultId}
            onChange={onChangeOverrideResult}
            disabled={saving}
            required
          />
        </fieldset>

        {chosen ? (
          <p className="inline-flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Será registrado como:</span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                TOKEN_STYLES[chosen.colorToken] ?? TOKEN_STYLES.muted,
              )}
            >
              {chosen.label}
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Escolha um resultado para poder enviar a fase.
          </p>
        )}
      </section>
    );
  }

  // ---- AUTOMATIC: live computed result + optional override ----
  const computedId = walkResultRuleset(ruleset, answerMap);
  const computed = computedId ? optionsById.get(computedId) ?? null : null;

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
            <fieldset className="flex flex-col gap-1.5 text-sm">
              <legend className="font-medium">Resultado escolhido</legend>
              <ResultChoiceGroup
                name="phase-result-override"
                options={options}
                value={overrideResultId}
                onChange={onChangeOverrideResult}
                disabled={saving}
              />
            </fieldset>

            {chosen && (
              <p className="inline-flex items-center gap-1.5 text-sm">
                <span className="text-muted-foreground">Será registrado como:</span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    TOKEN_STYLES[chosen.colorToken] ?? TOKEN_STYLES.muted,
                  )}
                >
                  {chosen.label}
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

/**
 * A colour-aware single-select radio group over the phase's result options —
 * the picker the filler uses to choose a result. Replaces the former native
 * `<select>` so every allowed result is visible at once (multiple-choice), and
 * mirrors the wizard's `multiple_choice` option rows (left accent + colour dot +
 * a faint tint on hover/selection). Render inside a `<fieldset>` so the group
 * carries its own label/legend.
 */
function ResultChoiceGroup({
  name,
  options,
  value,
  onChange,
  disabled,
  required,
}: {
  /** Stable radio `name` (one group per panel instance). */
  name: string;
  /** The allowed result options (author-selected subset or active vocabulary). */
  options: ResolvedPhaseResult[];
  /** The chosen option id, or "" when none picked yet. */
  value: string;
  onChange: (resultId: string) => void;
  disabled: boolean;
  /** MANUAL mode: marks the group required (a choice is mandatory). */
  required?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-required={required ? true : undefined}
      className="flex flex-col gap-1.5"
    >
      {options.map((o, i) => {
        const id = `${name}-opt-${i}`;
        const selected = value === o.id;
        const color = TOKEN_COLOR_VAR[o.colorToken] ?? TOKEN_COLOR_VAR.muted;
        return (
          <label
            key={o.id}
            htmlFor={id}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-lg border border-l-4 border-border bg-card px-3.5 py-2.5 text-sm transition-colors",
              "hover:bg-[var(--opt-tint)] has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
              selected && "border-primary bg-[var(--opt-tint)]",
              disabled && "cursor-not-allowed opacity-50",
            )}
            style={{
              borderLeftColor: color,
              ["--opt-tint" as string]: `color-mix(in oklch, ${color} 12%, transparent)`,
            }}
          >
            <input
              type="radio"
              id={id}
              name={name}
              value={o.id}
              checked={selected}
              onChange={() => onChange(o.id)}
              disabled={disabled}
              required={required}
              className="size-4 shrink-0 accent-primary"
            />
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span>{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}

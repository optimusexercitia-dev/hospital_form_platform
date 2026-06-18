"use client";

import { Check, ShieldCheck } from "lucide-react";

import {
  HARM_META,
  HARM_ORDER,
  HARM_SEVERITY_LABELS,
  REACH_LABELS,
  type HarmSeverity,
  type TriageReach,
} from "@/lib/safety/triage-types";
import { cn } from "@/lib/utils";
import { StepCard } from "./step-card";
import { HARM_TONE } from "./triage-visuals";
import { isHarmful } from "./triage-derive";

const HARM_DEFINITIONS: Record<HarmSeverity, string> = {
  none: "Sem dano detectável ao paciente.",
  mild: "Dano temporário leve; intervenção mínima ou nenhuma.",
  moderate: "Dano temporário moderado; exigiu intervenção.",
  severe: "Dano temporário grave; exigiu intervenção significativa.",
  permanent: "Dano permanente ou perda de função.",
  death: "O evento contribuiu para o óbito do paciente.",
};

/**
 * Step 3 — the NCC-MERP harm SCALE (README_triage §5). For a non-harmful reach
 * (`unsafe`/`near_miss`/`no_harm`) it resolves to a "Sem dano" banner (no picker).
 * Otherwise six tiles whose bar width grows with the tier, the sentinel tier
 * (`severe`/`permanent`/`death`) tagged. Radiogroup semantics.
 */
export function HarmScale({
  reach,
  harmSeverity,
  disabled,
  onChange,
}: {
  reach: TriageReach | null;
  harmSeverity: HarmSeverity | null;
  disabled: boolean;
  onChange: (value: HarmSeverity) => void;
}) {
  const harmful = isHarmful(reach);
  const state = !harmful
    ? reach != null
      ? "done"
      : "todo"
    : harmSeverity != null
      ? "done"
      : disabled
        ? "todo"
        : "active";

  return (
    <StepCard
      step={3}
      title="Gravidade do dano"
      sub="Classifique a gravidade do dano causado ao paciente."
      state={state}
      disabled={disabled}
      headingId="triage-step-3"
    >
      {!harmful ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">
          <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
          <p className="text-pretty">
            <span className="font-medium">Sem dano.</span>{" "}
            {reach
              ? `Um evento do tipo "${REACH_LABELS[reach]}" não atinge o paciente com dano — a graduação de gravidade não se aplica.`
              : "A graduação de gravidade não se aplica a este alcance."}
          </p>
        </div>
      ) : (
        <>
          <div
            role="radiogroup"
            aria-label="Escala de gravidade do dano"
            className="grid gap-2 sm:grid-cols-2"
          >
            {HARM_ORDER.map((k) => {
              const meta = HARM_META[k];
              const tone = HARM_TONE[k];
              const checked = harmSeverity === k;
              const width = 30 + meta.tier * 12;
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => onChange(k)}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border p-3 text-left transition-[box-shadow,border-color,background-color] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                    checked
                      ? cn(tone.selected, "shadow-sm")
                      : "border-border bg-card hover:shadow-sm",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  >
                    <span
                      className={cn("block h-full rounded-full", tone.bar)}
                      style={{ width: `${width}%` }}
                    />
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {checked && (
                        <Check aria-hidden="true" className="size-3.5" />
                      )}
                      {HARM_SEVERITY_LABELS[k]}
                    </span>
                    {meta.severe && (
                      <span className="rounded-full border border-destructive/30 bg-destructive/8 px-1.5 py-0.5 text-[0.6rem] font-medium tracking-wide text-destructive uppercase">
                        Faixa sentinela
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {harmSeverity && (
            <p className="text-sm text-muted-foreground text-pretty">
              <span className="font-medium text-foreground">
                {HARM_SEVERITY_LABELS[harmSeverity]}.
              </span>{" "}
              {HARM_DEFINITIONS[harmSeverity]}
            </p>
          )}
        </>
      )}
    </StepCard>
  );
}

"use client";

import { Check, UserCheck, UserX } from "lucide-react";

import {
  REACH_LABELS,
  REACH_META,
  REACH_ORDER,
  type TriageReach,
} from "@/lib/safety/triage-types";
import { cn } from "@/lib/utils";
import { StepCard } from "./step-card";
import { REACH_TONE } from "./triage-visuals";

const REACH_DEFINITIONS: Record<TriageReach, string> = {
  unsafe:
    "Circunstância que aumenta a probabilidade de um evento. Nada ocorreu ainda.",
  near_miss: "Não chegou ao paciente — interceptado ou evitado a tempo.",
  no_harm: "Chegou ao paciente, mas não causou dano detectável.",
  adverse: "Chegou ao paciente e resultou em dano.",
  sentinel:
    "Resultou em óbito, dano permanente ou dano temporário grave. Exige análise abrangente.",
};

/**
 * Step 2 — the reach-and-harm SPECTRUM hero (README_triage §5). Five ordered stops
 * rendered as an escalation ramp (green→red), grouped under two reach brackets
 * ("Não chegou ao paciente" over stops 0–1, "Chegou ao paciente" over 2–4). The
 * selection reveals a tinted definition card. Radiogroup semantics — arrow/Tab
 * operable.
 */
export function ReachSpectrum({
  reach,
  disabled,
  onChange,
}: {
  reach: TriageReach | null;
  disabled: boolean;
  onChange: (value: TriageReach) => void;
}) {
  const state = reach == null ? (disabled ? "todo" : "active") : "done";
  const selectedMeta = reach ? REACH_META[reach] : null;

  return (
    <StepCard
      step={2}
      title="O evento chegou ao paciente?"
      sub="Posicione o evento no espectro de alcance e dano (Joint Commission)."
      state={state}
      disabled={disabled}
      headingId="triage-step-2"
    >
      {/* Reach brackets */}
      <div className="grid grid-cols-[2fr_3fr] gap-2 text-center text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
        <Bracket label="Não chegou ao paciente" />
        <Bracket label="Chegou ao paciente" />
      </div>

      <div
        role="radiogroup"
        aria-label="Espectro de alcance e dano"
        className="grid grid-cols-5 gap-2"
      >
        {REACH_ORDER.map((k) => {
          const meta = REACH_META[k];
          const tone = REACH_TONE[k];
          const checked = reach === k;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(k)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition-[transform,box-shadow,border-color,background-color] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                checked
                  ? cn(tone.selected, "-translate-y-0.5 shadow-sm")
                  : "border-border bg-card hover:-translate-y-0.5 hover:shadow-sm",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-1.5 w-full rounded-full transition-opacity",
                  tone.bar,
                  checked ? "opacity-100" : "opacity-50",
                )}
              />
              <span className="flex items-center gap-1 font-mono text-[0.7rem] text-muted-foreground tabular-nums">
                {meta.level}
                {checked && <Check aria-hidden="true" className="size-3" />}
              </span>
              <span className="text-[0.72rem] leading-tight font-medium text-pretty">
                {REACH_LABELS[k]}
              </span>
            </button>
          );
        })}
      </div>

      {reach && selectedMeta && (
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-xl border p-3 text-sm",
            REACH_TONE[reach].selected,
          )}
        >
          {selectedMeta.reached ? (
            <UserCheck aria-hidden="true" className="size-4 shrink-0" />
          ) : (
            <UserX aria-hidden="true" className="size-4 shrink-0" />
          )}
          <p className="text-pretty">
            <span className="font-medium">{REACH_LABELS[reach]}.</span>{" "}
            {REACH_DEFINITIONS[reach]}
          </p>
        </div>
      )}
    </StepCard>
  );
}

function Bracket({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      <span>{label}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}

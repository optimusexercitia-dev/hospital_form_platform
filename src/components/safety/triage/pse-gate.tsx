"use client";

import { ShieldCheck, ShieldX, Check } from "lucide-react";

import {
  PSE_CLOSURE_REASON_LABELS,
  type PseClosureReason,
} from "@/lib/safety/triage-types";
import { cn } from "@/lib/utils";
import { StepCard } from "./step-card";

const CLOSURE_DESCRIPTIONS: Record<PseClosureReason, string> = {
  natural: "Desfecho atribuível à condição de base, não ao cuidado.",
  expected: "Risco documentado e consentido do procedimento ou terapia.",
  nonclinical: "Questão de serviço, faturamento ou infraestrutura — encaminhar.",
  duplicate: "Já registrado sob outro evento.",
};

const CLOSURE_ORDER: PseClosureReason[] = [
  "natural",
  "expected",
  "nonclinical",
  "duplicate",
];

/**
 * Step 1 — the PSE gate (README_triage §5). Two large choice cards (Sim / Não).
 * Choosing "Não" reveals a 2×2 grid of closure reasons and ENDS the flow (steps
 * 2–4 stay dimmed). Radio semantics so the whole gate is keyboard-operable.
 */
export function PseGate({
  isPse,
  pseClosureReason,
  disabled,
  onChange,
  onChangeReason,
}: {
  isPse: boolean | null;
  pseClosureReason: PseClosureReason | null;
  disabled: boolean;
  onChange: (value: boolean) => void;
  onChangeReason: (reason: PseClosureReason) => void;
}) {
  const state = isPse == null ? "active" : "done";

  return (
    <StepCard
      step={1}
      title="É um evento de segurança do paciente?"
      sub="Confirme se a notificação descreve um evento de segurança antes de prosseguir."
      state={state}
      disabled={disabled}
      headingId="triage-step-1"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">É um evento de segurança do paciente?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            name="pse"
            checked={isPse === true}
            onSelect={() => onChange(true)}
            tone="accent"
            icon={<ShieldCheck aria-hidden="true" className="size-5" />}
            title="Sim — evento de segurança"
            sub="Prosseguir com a triagem completa."
          />
          <ChoiceCard
            name="pse"
            checked={isPse === false}
            onSelect={() => onChange(false)}
            tone="neutral"
            icon={<ShieldX aria-hidden="true" className="size-5" />}
            title="Não — não é evento de segurança"
            sub="Classificar o motivo de encerramento."
          />
        </div>
      </fieldset>

      {isPse === false && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-foreground">
            Motivo de encerramento
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CLOSURE_ORDER.map((reason) => {
              const checked = pseClosureReason === reason;
              return (
                <label
                  key={reason}
                  className={cn(
                    "flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 transition-colors focus-within:ring-[3px] focus-within:ring-ring/40",
                    checked
                      ? "border-primary/40 bg-accent"
                      : "border-border bg-card hover:bg-muted/40",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="radio"
                      name="pse-reason"
                      className="sr-only"
                      checked={checked}
                      onChange={() => onChangeReason(reason)}
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-4 place-items-center rounded-full border",
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border",
                      )}
                    >
                      {checked && <Check className="size-3" />}
                    </span>
                    {PSE_CLOSURE_REASON_LABELS[reason]}
                  </span>
                  <span className="pl-6 text-xs text-muted-foreground text-pretty">
                    {CLOSURE_DESCRIPTIONS[reason]}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </StepCard>
  );
}

function ChoiceCard({
  name,
  checked,
  onSelect,
  tone,
  icon,
  title,
  sub,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  tone: "accent" | "neutral";
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 focus-within:ring-[3px] focus-within:ring-ring/40",
        checked
          ? tone === "accent"
            ? "border-primary/50 bg-accent shadow-sm"
            : "border-foreground/30 bg-muted/60 shadow-sm"
          : "border-border bg-card hover:shadow-sm",
      )}
    >
      <input
        type="radio"
        name={name}
        className="sr-only"
        checked={checked}
        onChange={onSelect}
      />
      <span
        aria-hidden="true"
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg",
          checked && tone === "accent"
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground text-pretty">{sub}</span>
      </span>
    </label>
  );
}

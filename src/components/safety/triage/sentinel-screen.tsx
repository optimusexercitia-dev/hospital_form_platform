"use client";

import { AlertTriangle, Check, CircleCheck, X } from "lucide-react";

import type { SentinelCriterion, TriageReach, HarmSeverity } from "@/lib/safety/triage-types";
import { cn } from "@/lib/utils";
import { StepCard } from "./step-card";
import { isReached, isSevere } from "./triage-derive";

/**
 * Step 4 — the sentinel SCREEN (README_triage §5). Two columns:
 *  - general criteria (auto-evaluated checks): reached · severe · UNRELATED to the
 *    natural course (a segmented Não-relacionado / Curso natural toggle drives the
 *    last one);
 *  - the configurable designated-category checklist — any flag auto-qualifies as
 *    sentinel.
 * A full-width determination banner flips danger/success.
 *
 * `sentinelDetermination` is computed authoritatively by the server; this screen
 * mirrors it live (`localIsSentinel`, passed in) so the banner reacts instantly.
 */
export function SentinelScreen({
  reach,
  harmSeverity,
  naturalCourse,
  criteria,
  selectedCriteriaIds,
  localIsSentinel,
  disabled,
  onChangeNaturalCourse,
  onToggleCriterion,
}: {
  reach: TriageReach | null;
  harmSeverity: HarmSeverity | null;
  naturalCourse: boolean | null;
  criteria: SentinelCriterion[];
  selectedCriteriaIds: string[];
  localIsSentinel: boolean;
  disabled: boolean;
  onChangeNaturalCourse: (value: boolean) => void;
  onToggleCriterion: (id: string, checked: boolean) => void;
}) {
  const reached = isReached(reach);
  const severe = isSevere(harmSeverity);
  const unrelated = naturalCourse === false;
  const hasDesignated = selectedCriteriaIds.length > 0;
  const state = localIsSentinel || naturalCourse != null ? "done" : disabled ? "todo" : "active";

  return (
    <StepCard
      step={4}
      title="Triagem de evento sentinela"
      sub="Avalie os critérios gerais e as categorias designadas (Joint Commission)."
      state={state}
      disabled={disabled}
      headingId="triage-step-4"
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-foreground">
            Critérios gerais
          </legend>
          <CriterionRow met={reached} label="Chegou ao paciente" />
          <CriterionRow
            met={severe}
            label="Óbito, dano permanente ou dano temporário grave"
          />

          <div
            className={cn(
              "flex flex-col gap-2 rounded-xl border p-3",
              unrelated ? "border-success/30 bg-success/8" : "border-border",
            )}
          >
            <span className="flex items-center gap-2 text-sm">
              {unrelated ? (
                <Check aria-hidden="true" className="size-4 text-success" />
              ) : (
                <X aria-hidden="true" className="size-4 text-muted-foreground" />
              )}
              Não relacionado ao curso natural da doença
            </span>
            <div
              role="radiogroup"
              aria-label="Relação com o curso natural da doença"
              className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-0.5"
            >
              <SegToggle
                checked={naturalCourse === false}
                onSelect={() => onChangeNaturalCourse(false)}
                label="Não relacionado"
              />
              <SegToggle
                checked={naturalCourse === true}
                onSelect={() => onChangeNaturalCourse(true)}
                label="Curso natural"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-foreground">
            Categorias designadas
            <span className="ml-1 font-normal text-muted-foreground">
              (qualquer uma qualifica como sentinela)
            </span>
          </legend>
          {criteria.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card/50 px-3 py-6 text-center text-xs text-muted-foreground">
              Nenhum critério configurado.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {criteria.map((c) => {
                const checked = selectedCriteriaIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 text-sm transition-colors focus-within:ring-[3px] focus-within:ring-ring/40",
                      checked
                        ? "border-destructive/30 bg-destructive/8"
                        : "border-border hover:bg-muted/40",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={(e) => onToggleCriterion(c.id, e.target.checked)}
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 grid size-4 shrink-0 place-items-center rounded border",
                        checked
                          ? "border-destructive bg-destructive text-primary-foreground"
                          : "border-border",
                      )}
                    >
                      {checked && <Check className="size-3" />}
                    </span>
                    <span className="text-pretty">{c.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>
      </div>

      <DeterminationBanner
        isSentinel={localIsSentinel}
        byDesignated={hasDesignated}
      />
    </StepCard>
  );
}

function CriterionRow({ met, label }: { met: boolean; label: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
        met ? "border-success/30 bg-success/8" : "border-border",
      )}
    >
      {met ? (
        <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
      ) : (
        <X aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="text-pretty">{label}</span>
    </div>
  );
}

function SegToggle({
  checked,
  onSelect,
  label,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        "rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
        checked
          ? "bg-card text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function DeterminationBanner({
  isSentinel,
  byDesignated,
}: {
  isSentinel: boolean;
  byDesignated: boolean;
}) {
  if (isSentinel) {
    return (
      <div
        role="status"
        className="flex flex-col gap-1 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <AlertTriangle aria-hidden="true" className="size-4" />
          Atende aos critérios de evento sentinela
          <span className="ml-auto rounded-full border border-destructive/30 bg-destructive/12 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase">
            RCA obrigatória
          </span>
        </span>
        <p className="text-xs text-destructive/90 text-pretty">
          {byDesignated
            ? "Categoria designada selecionada — qualifica como sentinela independentemente da gravidade."
            : "Critérios gerais atendidos: chegou ao paciente, dano grave e não relacionado ao curso natural."}
        </p>
      </div>
    );
  }
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3.5 text-sm text-success"
    >
      <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
      <p className="text-pretty">
        Não atende aos critérios de evento sentinela — encaminhar ao comitê de
        origem para revisão padrão.
      </p>
    </div>
  );
}

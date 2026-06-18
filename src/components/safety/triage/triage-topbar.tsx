"use client";

import { Check, Loader2, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export type SaveState = "idle" | "saving" | "saved";

/**
 * The department TOPBAR (README_triage §3): the NSP shield + title/subtitle, the
 * right-aligned stat readouts (awaiting / sentinel YTD / active RCAs), and the
 * autosave pill (Salvando… → Salvo). The pill is a polite live region so a
 * keyboard/AT user hears the save settle.
 */
export function TriageTopbar({
  awaitingCount,
  sentinelCount,
  rcaCount,
  saveState,
}: {
  awaitingCount: number;
  sentinelCount: number;
  rcaCount: number;
  saveState: SaveState;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border pb-4">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-xl bg-primary/12 text-primary"
        >
          <ShieldAlert className="size-5" />
        </span>
        <div className="flex flex-col">
          <h1 className="text-lg leading-tight">Núcleo de Segurança do Paciente</h1>
          <p className="text-xs text-muted-foreground">
            Entrada e triagem de eventos · framework Joint Commission
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-5">
        <dl className="hidden items-center gap-5 sm:flex">
          <Stat label="Aguardando" value={awaitingCount} tone="warning" />
          <Stat label="Sentinela" value={sentinelCount} tone="danger" />
          <Stat label="RCAs ativas" value={rcaCount} tone="accent" />
        </dl>

        <span
          role="status"
          aria-live="polite"
          className={cn(
            "inline-flex min-w-20 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            saveState === "saved"
              ? "border-success/30 bg-success/12 text-success"
              : saveState === "saving"
                ? "border-border bg-muted text-muted-foreground"
                : "border-transparent text-transparent",
          )}
        >
          {saveState === "saving" && (
            <>
              <Loader2 aria-hidden="true" className="size-3 animate-spin" />
              Salvando…
            </>
          )}
          {saveState === "saved" && (
            <>
              <Check aria-hidden="true" className="size-3" />
              Salvo
            </>
          )}
        </span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warning" | "danger" | "accent";
}) {
  return (
    <div className="flex flex-col items-end">
      <dt className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-destructive",
          tone === "accent" && "text-primary",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

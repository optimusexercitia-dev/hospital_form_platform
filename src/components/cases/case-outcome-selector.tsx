"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Stethoscope } from "lucide-react";

import type { OfferedCaseOutcome, ResolvedCaseOutcome } from "@/lib/queries/cases";
import { setCaseOutcome } from "@/lib/cases/outcomes-actions";
import { cn } from "@/lib/utils";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The case-detail OUTCOME selector (D9/D15): choose the case's single outcome from
 * its FROZEN offered set. Rendered ONLY while the case is non-terminal and ONLY
 * when the process offered any outcomes (D15 — a no-outcome process never shows
 * this). Writes via `setCaseOutcome` (server-gated: HC025 terminal, HC029 not
 * offered). The two flags are ADVISORY signals (D10), shown as informational
 * markers — they do NOT gate anything here.
 */
export function CaseOutcomeSelector({
  caseId,
  offeredOutcomes,
  current,
}: {
  caseId: string;
  offeredOutcomes: OfferedCaseOutcome[];
  /** The currently-assigned outcome (resolved label/flags), or `null`. */
  current: ResolvedCaseOutcome | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState<string>(current?.id ?? "");

  // D15 guard: with no offered outcomes there is nothing to choose.
  if (offeredOutcomes.length === 0) return null;

  const selected = offeredOutcomes.find((o) => o.id === value) ?? null;

  function change(next: string) {
    const prev = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const res = await setCaseOutcome(caseId, next === "" ? null : next);
      if (!res.ok) {
        setValue(prev);
        setError(res.error ?? "Não foi possível concluir. Tente novamente.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="case-outcome-heading"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-col gap-0.5">
        <h2 id="case-outcome-heading" className="text-base font-semibold">
          Desfecho do caso
        </h2>
        <p className="text-xs text-muted-foreground text-pretty">
          Registre o desfecho deste caso. É possível alterá-lo enquanto o caso não
          estiver concluído ou cancelado.
        </p>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Desfecho</span>
        <select
          value={value}
          onChange={(e) => change(e.target.value)}
          disabled={isPending}
          aria-label="Desfecho do caso"
          className={SELECT_CLASS}
        >
          <option value="">Sem desfecho</option>
          {offeredOutcomes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <div className="flex flex-wrap items-center gap-2">
          <CaseStatusBadge
            label={selected.label}
            colorToken={selected.colorToken}
          />
          {selected.requiresActionPlan && (
            <span className="inline-flex items-center gap-1 text-[0.72rem] font-medium text-warning">
              <Stethoscope aria-hidden="true" className="size-3.5" />
              Requer plano de ação
            </span>
          )}
          {selected.isAdverse && (
            <span className="inline-flex items-center gap-1 text-[0.72rem] font-medium text-destructive">
              <AlertTriangle aria-hidden="true" className="size-3.5" />
              Evento adverso
            </span>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className={cn("text-sm font-medium text-destructive")}
        >
          {error}
        </p>
      )}
    </section>
  );
}

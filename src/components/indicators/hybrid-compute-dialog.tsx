"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { formatIndicatorValue } from "@/components/indicators/indicator-format";
import { PeriodWindowFields } from "@/components/indicators/period-window-fields";
import type {
  Indicator,
  IndicatorMeasurement,
} from "@/lib/indicators/types";
import type { ComputeMeasurementState } from "@/lib/indicators/actions";

type ComputeAction = (
  prev: ComputeMeasurementState | undefined,
  formData: FormData,
) => Promise<ComputeMeasurementState>;

/**
 * Hybrid `taxa` compute dialog (Phase 15, F3). The numerator is DERIVED from the
 * submitted responses; the denominator is supplied MANUALLY per period. The
 * compute is ONE-STEP (`computeDerivedMeasurement` with the denominator inline;
 * the row is born complete). On success the action echoes the derived numerator +
 * the computed value, which we surface so the coordinator can confirm the taxa.
 *
 * Preserve-on-recompute: when editing an existing row, the denominator field is
 * OPTIONAL — leaving it blank re-derives the numerator and keeps the stored
 * denominator (backend §3.4). On first compute a denominator is required
 * (HC088 otherwise, surfaced as a pt-BR error).
 */
export function HybridComputeDialog({
  indicator,
  computeAction,
  existing,
}: {
  indicator: Indicator;
  computeAction: ComputeAction;
  existing?: IndicatorMeasurement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(computeAction, undefined);
  const [periodLabel, setPeriodLabel] = useState(existing?.periodLabel ?? "");
  const successRef = useRef(false);

  const editing = Boolean(existing);

  useEffect(() => {
    if (open) successRef.current = false;
  }, [open]);

  // On a successful compute we keep the dialog open briefly so the coordinator
  // sees the echoed numerator/value, then refresh the page data. We refresh
  // immediately (server data re-reads) but leave the confirmation visible.
  useEffect(() => {
    if (state?.ok && !successRef.current) {
      successRef.current = true;
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={editing ? "ghost" : "default"} size="sm">
          {editing ? "Recalcular" : "Calcular período"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Calcular taxa</DialogTitle>
          <DialogDescription>
            O numerador é calculado automaticamente a partir das respostas
            enviadas. Informe o denominador do período (ex.: pacientes-dia).
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="indicatorId" value={indicator.id} />

          {state?.error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              {state.error}
            </p>
          ) : null}

          {state?.ok ? (
            <div
              role="status"
              className="animate-fade-in flex flex-col gap-1 rounded-lg border border-success/30 bg-success/12 px-3 py-2.5 text-sm text-success"
            >
              <span className="font-semibold">Taxa calculada</span>
              <span className="text-foreground/80">
                Numerador derivado:{" "}
                <strong className="tabular-nums">
                  {state.numerator != null
                    ? new Intl.NumberFormat("pt-BR").format(state.numerator)
                    : "—"}
                </strong>
                {state.value != null ? (
                  <>
                    {" · "}Valor:{" "}
                    <strong className="tabular-nums">
                      {formatIndicatorValue(state.value, indicator.unit)}
                    </strong>
                  </>
                ) : null}
              </span>
            </div>
          ) : null}

          <Field>
            <FieldLabel htmlFor="hybridPeriodLabel">Período</FieldLabel>
            <Input
              id="hybridPeriodLabel"
              name="periodLabel"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              readOnly={editing}
              required
              placeholder="Ex.: 2026-06"
              aria-invalid={state?.fieldErrors?.periodLabel ? true : undefined}
            />
            <FieldError>{state?.fieldErrors?.periodLabel}</FieldError>
          </Field>

          <PeriodWindowFields
            periodLabel={periodLabel}
            initialStart={existing?.periodStart}
            initialEnd={existing?.periodEnd}
            startError={state?.fieldErrors?.periodStart}
            endError={state?.fieldErrors?.periodEnd}
          />

          <Field>
            <FieldLabel htmlFor="hybridDenominator">
              {indicator.denominatorLabel || "Denominador"}
              {!editing ? "" : " (opcional)"}
            </FieldLabel>
            <Input
              id="hybridDenominator"
              name="denominator"
              type="number"
              step="any"
              inputMode="decimal"
              defaultValue={existing?.denominator ?? ""}
              required={!editing}
              aria-describedby="hybridDenominator-description"
              aria-invalid={state?.fieldErrors?.denominator ? true : undefined}
            />
            <FieldDescription id="hybridDenominator-description">
              {editing
                ? "Deixe em branco para recalcular o numerador e manter o denominador registrado."
                : "Necessário no primeiro cálculo do período."}
            </FieldDescription>
            <FieldError>{state?.fieldErrors?.denominator}</FieldError>
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Calculando…" : "Calcular"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

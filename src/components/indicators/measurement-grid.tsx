"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  MeasurementStatusChip,
  formatIndicatorValue,
  formatPeriodLabel,
} from "@/components/indicators/indicator-format";
import { HybridComputeDialog } from "@/components/indicators/hybrid-compute-dialog";
import { PeriodWindowFields } from "@/components/indicators/period-window-fields";
import type {
  Indicator,
  IndicatorMeasurement,
} from "@/lib/indicators/types";
import type {
  ActionState,
  ComputeMeasurementState,
} from "@/lib/indicators/actions";

type RecordAction = (
  prev: ActionState | undefined,
  formData: FormData,
) => Promise<ActionState>;
type ComputeAction = (
  prev: ComputeMeasurementState | undefined,
  formData: FormData,
) => Promise<ComputeMeasurementState>;

/**
 * Measurement entry grid (Phase 15, F3). A period-by-period table of an
 * indicator's measurements with the actions to record/correct them, keyed off
 * the indicator's `dataSource`:
 *   - `manual`   → the "Registrar medição" dialog (numerator/denominator).
 *   - `derivado` → the "Calcular" action (compute from submitted responses).
 *   - `hibrido`  → the one-step {@link HybridComputeDialog} (derived numerator +
 *     manual denominator).
 *
 * All actions upsert on `(indicator, period)`; every change is audited server-side
 * (Rule 11). pt-BR errors from HC084–HC088 surface inline.
 */
export function MeasurementGrid({
  indicator,
  measurements,
  recordAction,
  computeAction,
}: {
  indicator: Indicator;
  measurements: IndicatorMeasurement[];
  recordAction: RecordAction;
  computeAction: ComputeAction;
}) {
  const isManual = indicator.dataSource === "manual";
  const isHybrid = indicator.dataSource === "hibrido";

  return (
    <section
      aria-labelledby="measurements-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="measurements-heading" className="text-lg font-semibold">
          Medições
        </h2>
        {indicator.status === "active" ? (
          isManual ? (
            <RecordMeasurementDialog
              indicator={indicator}
              recordAction={recordAction}
            />
          ) : isHybrid ? (
            <HybridComputeDialog
              indicator={indicator}
              computeAction={computeAction}
            />
          ) : (
            <ComputeDerivedDialog
              indicator={indicator}
              computeAction={computeAction}
            />
          )
        ) : null}
      </div>

      {measurements.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
          Nenhuma medição registrada ainda.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Medições do indicador por período
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Período
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Numerador
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Denominador
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Valor
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Situação
                </th>
                {indicator.status === "active" ? (
                  <th scope="col" className="py-2 font-medium">
                    <span className="sr-only">Ações</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {measurements.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <th
                    scope="row"
                    className="py-2 pr-3 font-normal text-foreground/90"
                  >
                    {formatPeriodLabel(m.periodLabel)}
                  </th>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {m.numerator != null
                      ? new Intl.NumberFormat("pt-BR", {
                          maximumFractionDigits: 2,
                        }).format(m.numerator)
                      : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {m.denominator != null
                      ? new Intl.NumberFormat("pt-BR", {
                          maximumFractionDigits: 2,
                        }).format(m.denominator)
                      : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right font-medium tabular-nums">
                    {formatIndicatorValue(m.value, indicator.unit)}
                  </td>
                  <td className="py-2 pr-3">
                    <MeasurementStatusChip status={m.status} />
                  </td>
                  {indicator.status === "active" ? (
                    <td className="py-2 text-right">
                      {isManual ? (
                        <RecordMeasurementDialog
                          indicator={indicator}
                          recordAction={recordAction}
                          existing={m}
                        />
                      ) : isHybrid ? (
                        <HybridComputeDialog
                          indicator={indicator}
                          computeAction={computeAction}
                          existing={m}
                        />
                      ) : (
                        <ComputeDerivedDialog
                          indicator={indicator}
                          computeAction={computeAction}
                          existing={m}
                        />
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Manual numerator/denominator entry (record or correct). */
function RecordMeasurementDialog({
  indicator,
  recordAction,
  existing,
}: {
  indicator: Indicator;
  recordAction: RecordAction;
  existing?: IndicatorMeasurement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(recordAction, undefined);
  const [periodLabel, setPeriodLabel] = useState(existing?.periodLabel ?? "");
  const closedRef = useRef(false);

  useEffect(() => {
    if (open) closedRef.current = false;
  }, [open]);

  useEffect(() => {
    if (state?.ok && !closedRef.current) {
      closedRef.current = true;
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  const editing = Boolean(existing);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={editing ? "ghost" : "default"} size="sm">
          {editing ? (
            "Editar"
          ) : (
            <>
              <Plus aria-hidden="true" className="size-3.5" />
              Registrar medição
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Corrigir medição" : "Registrar medição"}
          </DialogTitle>
          <DialogDescription>
            Informe os valores do período. As correções ficam registradas na
            trilha de auditoria.
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
          <Field>
            <FieldLabel htmlFor="periodLabel">Período</FieldLabel>
            <Input
              id="periodLabel"
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="numerator">
                {indicator.numeratorLabel || "Numerador"}
              </FieldLabel>
              <Input
                id="numerator"
                name="numerator"
                type="number"
                step="any"
                inputMode="decimal"
                defaultValue={existing?.numerator ?? ""}
                required
                aria-invalid={state?.fieldErrors?.numerator ? true : undefined}
              />
              <FieldError>{state?.fieldErrors?.numerator}</FieldError>
            </Field>
            {indicator.kind !== "contagem" ? (
              <Field>
                <FieldLabel htmlFor="denominator">
                  {indicator.denominatorLabel || "Denominador"}
                </FieldLabel>
                <Input
                  id="denominator"
                  name="denominator"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  defaultValue={existing?.denominator ?? ""}
                  aria-invalid={
                    state?.fieldErrors?.denominator ? true : undefined
                  }
                />
                <FieldError>{state?.fieldErrors?.denominator}</FieldError>
              </Field>
            ) : null}
          </div>
          <Field>
            <FieldLabel htmlFor="note">Observação (opcional)</FieldLabel>
            <Textarea
              id="note"
              name="note"
              rows={2}
              defaultValue={existing?.note ?? ""}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Fully-derived compute (percentual/contagem/tempo_medio) — period only. */
function ComputeDerivedDialog({
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
  const closedRef = useRef(false);

  useEffect(() => {
    if (open) closedRef.current = false;
  }, [open]);

  useEffect(() => {
    if (state?.ok && !closedRef.current) {
      closedRef.current = true;
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  const editing = Boolean(existing);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={editing ? "ghost" : "default"} size="sm">
          {editing ? "Recalcular" : "Calcular período"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Calcular medição</DialogTitle>
          <DialogDescription>
            O valor é calculado automaticamente a partir das respostas enviadas
            no período.
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
          <Field>
            <FieldLabel htmlFor="periodLabel">Período</FieldLabel>
            <Input
              id="periodLabel"
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

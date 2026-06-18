"use client";

import { useState } from "react";
import { Gauge, Pencil, Plus, Target } from "lucide-react";

import type {
  CapaMeasure,
  CapaMeasureResult,
  CapaPlan,
} from "@/lib/safety/capa-types";
import { removeCapaMeasure } from "@/lib/safety/capa-actions";
import { Button } from "@/components/ui/button";
import { RcaConfirmDelete } from "../rca/rca-confirm-delete";
import { CapaMeasureForm } from "./capa-measure-form";
import { CapaMeasureResultForm } from "./capa-measure-result-form";

/**
 * The measures→results grid: each {@link CapaMeasure} with its target/definition and
 * a history of recorded {@link CapaMeasureResult}s. Plan-managers add/edit measures
 * and record results.
 */
export function CapaMeasuresSection({
  plan,
  measures,
  resultsByMeasure,
}: {
  plan: CapaPlan;
  measures: CapaMeasure[];
  resultsByMeasure: Map<string, CapaMeasureResult[]>;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const canManage = plan.viewerCanManage;

  return (
    <section
      aria-labelledby="capa-measures-heading"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gauge aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2 id="capa-measures-heading" className="text-lg">
            Medidas de sucesso
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {measures.length}
          </span>
        </div>
        {canManage && (
          <Button type="button" onClick={() => setAddOpen(true)}>
            <Plus aria-hidden="true" />
            Adicionar medida
          </Button>
        )}
      </div>

      {measures.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
          {canManage
            ? "Nenhuma medida. Defina como medir a eficácia do plano."
            : "Nenhuma medida registrada."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {measures.map((measure) => (
            <MeasureRow
              key={measure.id}
              plan={plan}
              measure={measure}
              results={resultsByMeasure.get(measure.id) ?? []}
              canManage={canManage}
            />
          ))}
        </ul>
      )}

      {canManage && (
        <CapaMeasureForm
          mode="create"
          open={addOpen}
          onOpenChange={setAddOpen}
          capaId={plan.id}
        />
      )}
    </section>
  );
}

function MeasureRow({
  plan,
  measure,
  results,
  canManage,
}: {
  plan: CapaPlan;
  measure: CapaMeasure;
  results: CapaMeasureResult[];
  canManage: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-base">{measure.name}</h3>
          {measure.target && (
            <span className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground">
              <Target aria-hidden="true" className="size-3.5" />
              Meta: {measure.target}
            </span>
          )}
          {measure.definition && (
            <p className="text-xs text-muted-foreground text-pretty">
              {measure.definition}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {canManage && (
            <>
              <CapaMeasureResultForm
                measureId={measure.id}
                measureName={measure.name}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setEditOpen(true)}
                aria-label={`Editar a medida ${measure.name}`}
              >
                <Pencil aria-hidden="true" />
              </Button>
              <RcaConfirmDelete
                action={() => removeCapaMeasure(measure.id)}
                label={`Remover a medida ${measure.name}`}
                title="Remover esta medida?"
                description="A medida e seus resultados serão removidos do plano."
              />
            </>
          )}
        </div>
      </div>

      {results.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Nenhum resultado registrado.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-4 font-medium">Período</th>
                <th className="py-1.5 pr-4 font-medium">Valor</th>
                <th className="py-1.5 font-medium">Observação</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 pr-4 tabular-nums">{r.period}</td>
                  <td className="py-1.5 pr-4 tabular-nums">
                    {r.value != null ? r.value : "—"}
                  </td>
                  <td className="py-1.5 text-muted-foreground">
                    {r.note ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && (
        <CapaMeasureForm
          mode="edit"
          open={editOpen}
          onOpenChange={setEditOpen}
          capaId={plan.id}
          measure={measure}
        />
      )}
    </li>
  );
}

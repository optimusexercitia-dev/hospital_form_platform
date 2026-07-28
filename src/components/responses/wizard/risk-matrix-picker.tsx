"use client";

import { memo, useId } from "react";
import { Eraser } from "lucide-react";

import type { Item } from "@/lib/queries/forms";
import {
  bandForScore,
  computeRiskScore,
  formatRiskScore,
  type RiskSelection,
} from "@/lib/forms/matrix";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldError } from "@/components/ui/field";
import { TOKEN_STYLES } from "@/components/cases/case-status-badge";

import { RequiredMark } from "./matrix-grid";

/**
 * FF-2 (ADR 0089 ruling 2) — a `risk_matrix`: ONE severity row × ONE likelihood
 * column, with the resulting score shown live.
 *
 * ## The score is a preview, never a payload
 *
 * The number under the grid is computed here from the two axis weights purely so
 * the filler sees the consequence of a choice before saving. The write contract
 * deliberately has NO score field: `app.save_risk_matrix_answers` derives
 * `risk_score` from the same two weights and ignores anything a client sends. So
 * this component may never round-trip its own number, and the band it shows is
 * derived from `config.riskBands` for display only — the score is the durable
 * fact, the band is a presentation of it.
 *
 * ## Accessibility
 *
 * Unlike a plain `matrix` (one radio group per row), a risk matrix is a SINGLE
 * exclusive choice over the whole grid, so it is ONE native radio group: one tab
 * stop, arrow keys walking the cells. Each radio names both coordinates plus the
 * consequence — "Grave, Provável, pontuação 27, Alto" — because a cell that
 * announced only its score would make the two axes unreadable, and one that
 * announced only its colour would convey the risk level by colour alone.
 */
export const RiskMatrixPicker = memo(function RiskMatrixPicker({
  item,
  instanceId,
  selection,
  onChange,
  onClear,
  error,
  requiredNow,
  readOnly = false,
  storedScore = null,
}: {
  item: Item;
  instanceId?: string;
  /** The saved/in-flight selection; `riskScore` is never held here. */
  selection: RiskSelection | undefined;
  /**
   * FF-2 (FUP-FF2-1) — the DURABLE `answer_risk_matrix.risk_score` as stored,
   * for the read paths (sign-off review, submission detail).
   *
   * When present it WINS over the locally computed product. The computed value
   * exists for the wizard, where nothing is stored yet; once a score is a
   * recorded fact, recomputing it from the axis weights would let a later
   * re-weighting silently restate what a historical response — or a signature
   * attesting to it — appears to say. A signer must see the number the record
   * holds, not a number derived under today's weights.
   */
  storedScore?: number | null;
  /** Commit a whole cell. Both halves always move together, so the half-filled
   *  state the server rejects with `HC0P8` is unreachable from the UI. */
  onChange: (next: RiskSelection) => void;
  onClear?: () => void;
  error?: string;
  /**
   * FF-3 (ADR 0090 ruling 4) — EFFECTIVE required-ness now.
   *
   * `form_items_input_vs_display` permits `required_if` on BOTH matrix types (only
   * `reference`, containers and display items are excluded), and
   * `app.response_required_complete` calls `app.item_is_required` with no
   * `item_type` filter — so a matrix mandatory only through `required_if` really
   * does block submit. Resolved by the parent, per instance. Absent → falls back
   * to the static `item.required`, so the builder preview and the review summary
   * are unchanged.
   */
  requiredNow?: boolean;
  readOnly?: boolean;
}) {
  const reactId = useId();
  const rows = item.matrixRows ?? [];
  const columns = item.matrixColumns ?? [];
  const bands = item.config?.riskBands ?? null;

  const scope = instanceId
    ? `risk-${item.id}-inst-${instanceId}`
    : `risk-${item.id}`;
  const titleId = `${scope}-title`;
  const descriptionId = `${scope}-description`;
  const errorId = `${scope}-error`;
  const describedBy =
    [item.questionExplanation ? descriptionId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  const required = requiredNow ?? item.required;
  const label = item.label ?? "Matriz de risco";
  // The stored fact wins wherever there is one; the product is the wizard's
  // live preview of a score that does not exist yet.
  const computed = computeRiskScore(rows, columns, selection);
  const score = storedScore ?? computed;
  const band = bandForScore(bands, score);

  if (rows.length === 0 || columns.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 id={titleId} className="text-sm font-medium">
          {label}
          {required ? <RequiredMark /> : null}
        </h3>
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground text-pretty">
          Esta matriz de risco ainda não tem severidade e probabilidade
          definidas.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <h3 id={titleId} className="text-sm font-medium">
          {label}
          {required ? <RequiredMark /> : null}
        </h3>
        {onClear && !readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onClear}
            disabled={selection == null}
            aria-label={`Limpar a classificação de ${label}`}
            title="Limpar"
          >
            <Eraser aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      {item.questionExplanation ? (
        <FieldDescription id={descriptionId}>
          {item.questionExplanation}
        </FieldDescription>
      ) : null}

      <div
        // ONE exclusive choice over the whole grid, so `radiogroup` is the
        // truthful role here (unlike the per-row groups of a plain matrix).
        role={readOnly ? "group" : "radiogroup"}
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        aria-required={required && !readOnly ? true : undefined}
        className="overflow-x-auto rounded-xl border border-border"
      >
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            {`${label}. Severidade nas linhas, probabilidade nas colunas. Escolha uma célula; a pontuação é o produto dos pesos.`}
          </caption>
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th scope="col" className="px-3 py-2 text-left">
                <span className="sr-only">Severidade</span>
                <span
                  aria-hidden="true"
                  className="flex flex-col text-[0.65rem] leading-tight font-medium tracking-wide text-muted-foreground uppercase"
                >
                  <span>Severidade ↓</span>
                  <span>Probabilidade →</span>
                </span>
              </th>
              {columns.map((column) => (
                <th
                  key={column.code}
                  scope="col"
                  id={`${scope}-col-${column.code}`}
                  className="px-3 py-2 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {column.label}
                  {column.weight !== null ? (
                    <span className="ml-1 font-normal normal-case">
                      ({formatRiskScore(column.weight)})
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowHeaderId = `${scope}-row-${row.code}`;
              return (
                <tr
                  key={row.code}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <th
                    scope="row"
                    id={rowHeaderId}
                    className="max-w-56 px-3 py-2 text-left font-medium text-pretty"
                  >
                    {row.label}
                    {row.weight !== null ? (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        ({formatRiskScore(row.weight)})
                      </span>
                    ) : null}
                  </th>
                  {columns.map((column) => {
                    const colHeaderId = `${scope}-col-${column.code}`;
                    const inputId = `${reactId}-${row.code}-${column.code}`;
                    const selected =
                      selection?.severity === row.code &&
                      selection?.likelihood === column.code;
                    const cellScore = computeRiskScore(rows, columns, {
                      severity: row.code,
                      likelihood: column.code,
                    });
                    const cellBand = bandForScore(bands, cellScore);
                    const scoreText =
                      cellScore === null ? "—" : formatRiskScore(cellScore);
                    return (
                      <td
                        key={column.code}
                        headers={`${rowHeaderId} ${colHeaderId}`}
                        className="p-0 text-center"
                      >
                        <label
                          htmlFor={readOnly ? undefined : inputId}
                          className={cn(
                            "flex h-full min-h-12 items-center justify-center gap-2 px-3 py-2 transition-colors",
                            "focus-within:ring-[3px] focus-within:ring-ring/40 focus-within:outline-none",
                            selected && "ring-2 ring-ring ring-inset",
                            !readOnly && "cursor-pointer",
                          )}
                        >
                          {readOnly ? null : (
                            <input
                              type="radio"
                              id={inputId}
                              // ONE group for the whole grid — a risk matrix is
                              // a single choice, not one per row.
                              name={`${scope}-cell`}
                              value={`${row.code}:${column.code}`}
                              checked={selected}
                              onChange={() =>
                                onChange({
                                  severity: row.code,
                                  likelihood: column.code,
                                })
                              }
                              aria-label={`${row.label}, ${column.label}${
                                cellScore === null
                                  ? ""
                                  : `, pontuação ${scoreText}`
                              }${cellBand ? `, ${cellBand.label}` : ""}`}
                              className="size-4 shrink-0 accent-primary"
                            />
                          )}
                          <span
                            aria-hidden={readOnly ? undefined : "true"}
                            className={cn(
                              "inline-flex min-w-9 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold",
                              cellBand?.color
                                ? TOKEN_STYLES[cellBand.color]
                                : "border border-border bg-card text-foreground",
                            )}
                          >
                            {scoreText}
                          </span>
                          {readOnly ? (
                            <span className="sr-only">
                              {`${row.label}, ${column.label}: ${
                                selected ? "selecionado" : "não selecionado"
                              }`}
                            </span>
                          ) : null}
                        </label>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* The live consequence. Polite, because it updates as a side effect of
          the user's own action rather than interrupting it. */}
      <p
        role="status"
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        <span className="text-muted-foreground">Pontuação:</span>
        {score === null ? (
          <span className="text-muted-foreground italic">
            selecione uma célula
          </span>
        ) : (
          <>
            <span className="font-semibold tabular-nums">
              {formatRiskScore(score)}
            </span>
            {band ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  band.color
                    ? TOKEN_STYLES[band.color]
                    : "border border-border bg-card text-foreground",
                )}
              >
                {band.label}
              </span>
            ) : null}
          </>
        )}
      </p>

      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
});

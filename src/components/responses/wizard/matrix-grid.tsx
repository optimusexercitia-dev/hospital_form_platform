"use client";

import { memo, useId } from "react";
import { Eraser } from "lucide-react";

import type { Item } from "@/lib/queries/forms";
import { type MatrixCells, missingMatrixRows } from "@/lib/forms/matrix";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldError } from "@/components/ui/field";

/**
 * FF-2 (ADR 0089 ruling 1) — a `matrix` rendered as a RADIO GRID: each row takes
 * exactly one column. The cell IS the selection; there is no per-cell input.
 *
 * ## Why a real `<table>`, and why native radios
 *
 * A grid of controls is the classic screen-reader trap, so the semantics are the
 * design, not decoration on top of it:
 *
 *  - a real `<table>` with a `<caption>`, `<th scope="col">` per column and
 *    `<th scope="row">` per row, so table navigation announces the two headers
 *    of whatever cell the user lands on;
 *  - every radio additionally carries `aria-labelledby="{rowHeader} {colHeader}"`,
 *    so it announces BOTH coordinates in forms mode too, where table headers are
 *    not read — "Higienização das mãos, Conforme", never a bare "Conforme"
 *    repeated once per row;
 *  - **one native radio group per ROW** (`name` scoped to item + instance + row
 *    code). That is what produces the required keyboard behaviour — ONE tab stop
 *    per row, arrow keys moving and selecting within it — and it produces it from
 *    the platform rather than from a hand-rolled roving `tabIndex`, which is the
 *    version that rots. Tab therefore walks row to row; arrows walk the scale.
 *  - the `name` includes the instance id for the same reason `InputItem` does
 *    (BUG-FF1-004): two repetitions of one matrix sharing a `name` would be ONE
 *    exclusivity group to the browser, and answering repetition 2 would silently
 *    clear repetition 1.
 *
 * Selection is never conveyed by colour alone: the checked radio is a real,
 * visible radio, and the cell's accessible state comes from the input itself.
 * The focus ring is the project's `focus-visible:ring-[3px]` on the CELL, so it
 * survives the grid's own tinting and is visible against a filled row.
 *
 * Motion is a token-eased colour transition only, which the global
 * `prefers-reduced-motion` rule collapses to a single frame — nothing here
 * animates position or gates meaning on an animation.
 */
export const MatrixGrid = memo(function MatrixGrid({
  item,
  instanceId,
  cells,
  onChange,
  onClear,
  error,
  requiredNow,
  readOnly = false,
}: {
  item: Item;
  /** The repeating-group instance this grid renders inside, or undefined at top
   *  level. Namespaces every control id and every radio `name`. */
  instanceId?: string;
  /** The saved/in-flight grid: `{ [rowCode]: colCode }`. */
  cells: MatrixCells | undefined;
  /** Commit one cell — the row's WHOLE selection, since a row takes one column. */
  onChange: (rowCode: string, colCode: string) => void;
  /** Clear the whole grid; absent in read-only contexts. */
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
  /** Render without inputs — the builder preview and the review summary. */
  readOnly?: boolean;
}) {
  const reactId = useId();
  const rows = item.matrixRows ?? [];
  const columns = item.matrixColumns ?? [];

  const required = requiredNow ?? item.required;
  const scope = instanceId
    ? `matrix-${item.id}-inst-${instanceId}`
    : `matrix-${item.id}`;
  const titleId = `${scope}-title`;
  const descriptionId = `${scope}-description`;
  const errorId = `${scope}-error`;
  const statusId = `${scope}-status`;
  const requiredId = `${scope}-required`;
  const describedBy =
    [
      item.questionExplanation ? descriptionId : null,
      required ? requiredId : null,
      error ? errorId : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const label = item.label ?? "Matriz";
  const answeredCount = rows.filter((row) => cells?.[row.code] != null).length;
  // Only surfaced while an error is showing: highlighting gaps unprompted would
  // nag a half-filled optional matrix.
  const missing = error ? new Set(missingMatrixRows(rows, columns, cells)) : null;

  if (rows.length === 0 || columns.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 id={titleId} className="text-sm font-medium">
          {label}
          {required ? <RequiredMark /> : null}
        </h3>
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground text-pretty">
          Esta matriz ainda não tem linhas e colunas definidas.
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
            disabled={answeredCount === 0}
            aria-label={`Limpar as respostas de ${label}`}
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

      {/* Required-ness reaches assistive tech through the group's DESCRIPTION,
          not `aria-required`. That attribute is only valid on the role that owns
          the choice — `radiogroup` — and this wrapper is deliberately a `group`
          (one radio group PER ROW), while putting it on the individual radios is
          invalid on `role="radio"` and the lint gate rejects it. A described-by
          note is the standards-clean way to say it once for the whole grid, and
          it is driven by the EFFECTIVE value so a `required_if` matrix announces
          it too. */}
      {required ? (
        <span id={requiredId} className="sr-only">
          Resposta obrigatória.
        </span>
      ) : null}
      {/* A `group`, not a `radiogroup`: there is one radio group PER ROW, and
          mislabelling the wrapper would make a screen reader promise a single
          exclusive choice across the whole grid. */}
      <div
        role="group"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        className="overflow-x-auto rounded-xl border border-border"
      >
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            {`${label}. Grade de ${rows.length} ${
              rows.length === 1 ? "linha" : "linhas"
            } por ${columns.length} ${
              columns.length === 1 ? "coluna" : "colunas"
            }. Cada linha recebe uma única coluna.`}
          </caption>
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th scope="col" className="px-3 py-2 text-left">
                <span className="sr-only">Critério</span>
              </th>
              {columns.map((column) => (
                <th
                  key={column.code}
                  scope="col"
                  id={`${scope}-col-${column.code}`}
                  className="px-3 py-2 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowHeaderId = `${scope}-row-${row.code}`;
              const chosen = cells?.[row.code];
              const isMissing = missing?.has(row.code) === true;
              return (
                <tr
                  key={row.code}
                  className={cn(
                    "border-b border-border/60 last:border-b-0",
                    isMissing && "bg-destructive/5",
                  )}
                >
                  <th
                    scope="row"
                    id={rowHeaderId}
                    className="max-w-56 px-3 py-2 text-left font-medium text-pretty"
                  >
                    {row.label}
                  </th>
                  {columns.map((column) => {
                    const colHeaderId = `${scope}-col-${column.code}`;
                    const inputId = `${reactId}-${row.code}-${column.code}`;
                    const selected = chosen === column.code;
                    return (
                      <td
                        key={column.code}
                        headers={`${rowHeaderId} ${colHeaderId}`}
                        className="p-0 text-center"
                      >
                        <label
                          htmlFor={readOnly ? undefined : inputId}
                          className={cn(
                            "flex h-full min-h-11 items-center justify-center px-3 py-2 transition-colors",
                            "focus-within:ring-[3px] focus-within:ring-ring/40 focus-within:outline-none",
                            selected && "bg-accent",
                            !readOnly && !selected && "hover:bg-muted/60",
                            !readOnly && "cursor-pointer",
                          )}
                        >
                          {readOnly ? (
                            <span
                              aria-hidden="true"
                              className={cn(
                                "grid size-4 place-items-center rounded-full border",
                                selected
                                  ? "border-primary bg-primary"
                                  : "border-input",
                              )}
                            >
                              {selected ? (
                                <span className="size-1.5 rounded-full bg-primary-foreground" />
                              ) : null}
                            </span>
                          ) : (
                            <input
                              type="radio"
                              id={inputId}
                              // One native group per ROW — the whole keyboard
                              // contract comes from this line.
                              name={`${scope}-row-group-${row.code}`}
                              value={column.code}
                              checked={selected}
                              onChange={() => onChange(row.code, column.code)}
                              aria-labelledby={`${rowHeaderId} ${colHeaderId}`}
                              className="size-4 accent-primary"
                            />
                          )}
                          {/* The read-only mark carries no accessible name of
                              its own, so state is spelled out for a reader. */}
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

      {!readOnly ? (
        <p
          id={statusId}
          role="status"
          className="text-xs text-muted-foreground"
        >
          {`${answeredCount} de ${rows.length} ${
            rows.length === 1 ? "linha respondida" : "linhas respondidas"
          }`}
        </p>
      ) : null}

      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
});

/** The obligatory-answer mark, named for a screen reader (never colour alone). */
export function RequiredMark() {
  return (
    <span className="ml-0.5 text-destructive" aria-label="obrigatória">
      *
    </span>
  );
}

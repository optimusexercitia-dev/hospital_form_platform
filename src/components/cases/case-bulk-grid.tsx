"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ClipboardPaste, Plus, ShieldAlert, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CustomFieldValueDraft } from "@/components/cases/custom-field-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  MAX_BULK_ROWS,
  autoTitle,
  buildRowsFromPaste,
  coercePatientCell,
  defaultPasteMapping,
  isBulkPaste,
  makeEmptyRow,
  parsePasteMatrix,
  VALID_SEX,
  type BulkGridRow,
  type CellSource,
  type GridValidation,
  type PasteMapping,
  type TargetColumn,
} from "@/lib/cases/bulk-grid-model";
import { CASE_PATIENT_SEX_LABELS } from "@/lib/cases/types";

const CELL_INPUT = "h-9 px-2.5 text-sm";

/**
 * The bulk-case GRID (Design #6) — a native `<table>` of controlled cells: one row
 * per case, columns = Título + the chosen custom fields + (PHI templates) the
 * patient columns. Entry is hybrid: type directly, PASTE a block from a spreadsheet
 * (a one-time column-mapping panel maps pasted columns → grid columns, with a
 * per-column "constant" fill-down), or add a straggler with "Adicionar caso".
 *
 * Rows are memoized (module-level {@link GridRowView}) with stable id-keyed
 * callbacks, so typing in one cell never re-renders the other 199 (a 200-row grid is
 * ~2000 controlled inputs). All validation is derived in the parent and passed in;
 * this component only renders + edits.
 */
export function CaseBulkGrid({
  rows,
  onRowsChange,
  columns,
  labelPrefix,
  validation,
  highlightRowNumber,
}: {
  rows: BulkGridRow[];
  /** Functional updater (prev → next) so the memoized-row callbacks stay stable. */
  onRowsChange: (updater: (prev: BulkGridRow[]) => BulkGridRow[]) => void;
  columns: TargetColumn[];
  labelPrefix: string;
  validation: GridValidation;
  /** 1-based grid row the server flagged on a failed commit (scroll + ring it). */
  highlightRowNumber: number | null;
}) {
  const [paste, setPaste] = useState<string[][] | null>(null);

  // Whether any PHI column is currently shown (E1 — driven by the Step-1 selection).
  const hasPhiColumns = useMemo(
    () => columns.some((c) => c.kind === "phi"),
    [columns],
  );

  // Stable, id-keyed mutators via functional setState (rerender-functional-setstate)
  // so the memoized rows keep referential-equal callbacks across re-renders.
  const updateRow = useCallback(
    (id: string, patch: (row: BulkGridRow) => BulkGridRow) => {
      onRowsChange((prev) => prev.map((r) => (r.id === id ? patch(r) : r)));
    },
    [onRowsChange],
  );

  const removeRow = useCallback(
    (id: string) => {
      onRowsChange((prev) => prev.filter((r) => r.id !== id));
    },
    [onRowsChange],
  );

  const addRow = useCallback(() => {
    onRowsChange((prev) =>
      prev.length >= MAX_BULK_ROWS ? prev : [...prev, makeEmptyRow()],
    );
  }, [onRowsChange]);

  const invalidByIndex = useMemo(() => {
    const map = new Map<number, { missing: Set<string>; floor: boolean }>();
    for (const iv of validation.invalidRows) {
      map.set(iv.index, {
        missing: new Set(iv.missingRequired),
        floor: iv.phiFloorViolated,
      });
    }
    return map;
  }, [validation.invalidRows]);

  const duplicateLabelSet = useMemo(
    () => new Set(validation.duplicateLabelRows),
    [validation.duplicateLabelRows],
  );
  const duplicateMrnSet = useMemo(
    () => new Set(validation.duplicateMrnRows),
    [validation.duplicateMrnRows],
  );

  // Scroll the server-flagged failed row into view (reduced-motion-safe).
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlightRowNumber == null) return;
    const el = scrollRef.current?.querySelector(
      `[data-bulk-row="${highlightRowNumber}"]`,
    );
    if (!el) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  }, [highlightRowNumber]);

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const text = event.clipboardData.getData("text/plain");
    const matrix = parsePasteMatrix(text);
    if (!isBulkPaste(matrix)) return; // single cell → default input paste
    event.preventDefault();
    setPaste(matrix);
  }

  function applyPaste(next: BulkGridRow[], mode: "replace" | "append") {
    onRowsChange((prev) =>
      (mode === "replace" ? next : [...prev, ...next]).slice(0, MAX_BULK_ROWS),
    );
    setPaste(null);
  }

  const atCap = rows.length >= MAX_BULK_ROWS;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground">
            {rows.length}
          </span>
          <span>de {MAX_BULK_ROWS} casos</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            disabled={atCap}
          >
            <Plus aria-hidden="true" className="size-4" />
            Adicionar caso
          </Button>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-primary/20 bg-accent/30 px-3 py-2.5 text-sm text-foreground text-pretty">
        <ClipboardPaste aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          Cole (Ctrl+V ou ⌘V) dados de uma planilha em qualquer lugar da tabela
          para preencher várias linhas de uma vez — você poderá mapear as colunas
          antes de aplicar.
        </span>
      </p>

      {hasPhiColumns ? (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive text-pretty">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            As colunas de paciente contêm dados sensíveis (PHI). Informe o mínimo
            necessário; cada linha com paciente exige ao menos nome ou prontuário.
          </span>
        </p>
      ) : null}

      {paste ? (
        <PasteMappingPanel
          matrix={paste}
          columns={columns}
          onCancel={() => setPaste(null)}
          onApply={applyPaste}
        />
      ) : null}

      <div
        ref={scrollRef}
        className="overflow-x-auto rounded-2xl border border-border"
        onPaste={handlePaste}
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/40 text-left">
              <th
                scope="col"
                className="sticky left-0 z-10 w-12 border-b border-border bg-muted/40 px-3 py-2.5 text-xs font-semibold text-muted-foreground"
              >
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className="border-b border-border px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-muted-foreground"
                >
                  {col.label}
                  {col.required ? (
                    <span className="ml-1 text-destructive" aria-hidden="true">
                      *
                    </span>
                  ) : null}
                  {col.kind === "phi" ? (
                    <span className="ml-1 font-normal text-muted-foreground/70">
                      (PHI)
                    </span>
                  ) : null}
                </th>
              ))}
              <th scope="col" className="w-12 border-b border-border px-2 py-2.5">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <GridRowView
                key={row.id}
                row={row}
                rowNumber={index + 1}
                columns={columns}
                labelPrefix={labelPrefix}
                invalid={invalidByIndex.get(index) ?? null}
                duplicateLabel={duplicateLabelSet.has(index + 1)}
                duplicateMrn={duplicateMrnSet.has(index + 1)}
                highlighted={highlightRowNumber === index + 1}
                canRemove={rows.length > 1}
                onUpdate={updateRow}
                onRemove={removeRow}
              />
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma linha. Adicione um caso ou cole dados de uma planilha.
        </p>
      ) : null}

      {atCap ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-warning"
        >
          <AlertTriangle aria-hidden="true" className="size-4" />
          Limite de {MAX_BULK_ROWS} casos por lote atingido.
        </p>
      ) : null}

      {validation.duplicateLabelRows.length > 0 ||
      validation.duplicateMrnRows.length > 0 ? (
        <div
          role="status"
          className="flex flex-col gap-1 rounded-lg border border-warning/30 bg-warning/12 px-3 py-2.5 text-sm text-warning"
        >
          <span className="flex items-center gap-2 font-medium">
            <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
            Possíveis duplicidades (não impedem a criação)
          </span>
          {validation.duplicateLabelRows.length > 0 ? (
            <span className="text-pretty">
              Títulos repetidos nas linhas{" "}
              {formatRowList(validation.duplicateLabelRows)}.
            </span>
          ) : null}
          {validation.duplicateMrnRows.length > 0 ? (
            <span className="text-pretty">
              Prontuários repetidos nas linhas{" "}
              {formatRowList(validation.duplicateMrnRows)}.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Compact pt-BR list of row numbers ("3, 5 e 8"). */
function formatRowList(rows: number[]): string {
  if (rows.length === 1) return String(rows[0]);
  return `${rows.slice(0, -1).join(", ")} e ${rows[rows.length - 1]}`;
}

// ---------------------------------------------------------------------------
// One grid row (memoized — id-keyed callbacks keep it referentially stable)
// ---------------------------------------------------------------------------

interface RowInvalid {
  missing: Set<string>;
  floor: boolean;
}

const GridRowView = memo(function GridRowView({
  row,
  rowNumber,
  columns,
  labelPrefix,
  invalid,
  duplicateLabel,
  duplicateMrn,
  highlighted,
  canRemove,
  onUpdate,
  onRemove,
}: {
  row: BulkGridRow;
  rowNumber: number;
  columns: TargetColumn[];
  labelPrefix: string;
  invalid: RowInvalid | null;
  duplicateLabel: boolean;
  duplicateMrn: boolean;
  highlighted: boolean;
  canRemove: boolean;
  onUpdate: (id: string, patch: (row: BulkGridRow) => BulkGridRow) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <tr
      data-bulk-row={rowNumber}
      className={cn(
        "border-b border-border/60 last:border-b-0",
        highlighted && "bg-destructive/8",
      )}
    >
      <td className="sticky left-0 z-10 bg-card px-3 py-1.5 text-center font-mono text-xs tabular-nums text-muted-foreground">
        {rowNumber}
      </td>
      {columns.map((col) => (
        <td key={col.id} className="px-2 py-1.5 align-top">
          <GridCell
            row={row}
            rowNumber={rowNumber}
            col={col}
            labelPrefix={labelPrefix}
            invalid={Boolean(
              (col.kind === "custom" &&
                col.customField &&
                invalid?.missing.has(col.customField.key)) ||
                (col.kind === "phi" &&
                  (col.phiKey === "name" || col.phiKey === "mrn") &&
                  invalid?.floor),
            )}
            duplicate={
              (col.kind === "title" && duplicateLabel) ||
              (col.kind === "phi" && col.phiKey === "mrn" && duplicateMrn)
            }
            onUpdate={onUpdate}
          />
        </td>
      ))}
      <td className="px-2 py-1.5 text-center align-top">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(row.id)}
          disabled={!canRemove}
          aria-label={`Remover linha ${rowNumber}`}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </td>
    </tr>
  );
});

// ---------------------------------------------------------------------------
// One cell — dispatches on the target-column kind/type
// ---------------------------------------------------------------------------

function GridCell({
  row,
  rowNumber,
  col,
  labelPrefix,
  invalid,
  duplicate,
  onUpdate,
}: {
  row: BulkGridRow;
  rowNumber: number;
  col: TargetColumn;
  labelPrefix: string;
  invalid: boolean;
  duplicate: boolean;
  onUpdate: (id: string, patch: (row: BulkGridRow) => BulkGridRow) => void;
}) {
  const ariaLabel = `${col.label}, linha ${rowNumber}`;
  const ring = cn(duplicate && !invalid && "border-warning/60 ring-[2px] ring-warning/20");

  if (col.kind === "title") {
    return (
      <Input
        value={row.title}
        onChange={(e) =>
          onUpdate(row.id, (r) => ({ ...r, title: e.target.value }))
        }
        placeholder={autoTitle(labelPrefix, rowNumber)}
        aria-label={ariaLabel}
        maxLength={120}
        className={cn(CELL_INPUT, "min-w-[12rem]", ring)}
      />
    );
  }

  if (col.kind === "custom" && col.customField) {
    const field = col.customField;
    const value = row.customFields[field.key] ?? null;
    const setValue = (v: CustomFieldValueDraft) =>
      onUpdate(row.id, (r) => ({
        ...r,
        customFields: { ...r.customFields, [field.key]: v },
      }));

    if (field.fieldType === "dropdown" || field.fieldType === "multiple_choice") {
      return (
        <NativeSelect
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setValue(e.target.value === "" ? null : e.target.value)}
          aria-label={ariaLabel}
          aria-invalid={invalid ? true : undefined}
          className={cn(CELL_INPUT, "min-w-[10rem]")}
        >
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      );
    }

    if (field.fieldType === "number") {
      return (
        <Input
          type="number"
          inputMode="decimal"
          value={typeof value === "number" ? String(value) : ""}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === "") return setValue(null);
            const n = Number(raw);
            setValue(Number.isFinite(n) ? n : null);
          }}
          aria-label={ariaLabel}
          aria-invalid={invalid ? true : undefined}
          className={cn(CELL_INPUT, "min-w-[7rem]")}
        />
      );
    }

    if (field.fieldType === "date") {
      return (
        <Input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setValue(e.target.value === "" ? null : e.target.value)}
          aria-label={ariaLabel}
          aria-invalid={invalid ? true : undefined}
          className={cn(CELL_INPUT, "min-w-[9rem]")}
        />
      );
    }

    // short_text
    return (
      <Input
        value={typeof value === "string" ? value : ""}
        onChange={(e) => setValue(e.target.value)}
        aria-label={ariaLabel}
        aria-invalid={invalid ? true : undefined}
        maxLength={200}
        className={cn(CELL_INPUT, "min-w-[10rem]")}
      />
    );
  }

  if (col.kind === "phi" && col.phiKey) {
    const key = col.phiKey;
    const value = row.patient[key];
    const setValue = (v: string) =>
      onUpdate(row.id, (r) => ({
        ...r,
        patient: { ...r.patient, [key]: v },
      }));

    if (key === "sex") {
      return (
        <NativeSelect
          value={value || "unknown"}
          onChange={(e) => setValue(e.target.value)}
          aria-label={ariaLabel}
          className={cn(CELL_INPUT, "min-w-[9rem]")}
        >
          {VALID_SEX.map((s) => (
            <option key={s} value={s}>
              {CASE_PATIENT_SEX_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
      );
    }

    if (key === "dateOfBirth") {
      return (
        <Input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={ariaLabel}
          className={cn(CELL_INPUT, "min-w-[9rem]")}
        />
      );
    }

    if (key === "ageYears") {
      return (
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={150}
          value={value}
          onChange={(e) => setValue(coercePatientCell("ageYears", e.target.value))}
          aria-label={ariaLabel}
          className={cn(CELL_INPUT, "min-w-[5.5rem]")}
        />
      );
    }

    // name / mrn / encounterRef / attending
    return (
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={ariaLabel}
        aria-invalid={invalid ? true : undefined}
        autoComplete="off"
        maxLength={200}
        className={cn(CELL_INPUT, "min-w-[10rem]", ring)}
      />
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Paste column-mapping panel (one-time, per paste)
// ---------------------------------------------------------------------------

function PasteMappingPanel({
  matrix,
  columns,
  onCancel,
  onApply,
}: {
  matrix: string[][];
  columns: TargetColumn[];
  onCancel: () => void;
  onApply: (rows: BulkGridRow[], mode: "replace" | "append") => void;
}) {
  const sourceColCount = useMemo(
    () => matrix.reduce((max, r) => Math.max(max, r.length), 0),
    [matrix],
  );
  const [mapping, setMapping] = useState<PasteMapping>(() =>
    defaultPasteMapping(columns, sourceColCount),
  );

  function setColumn(id: string, source: CellSource) {
    setMapping((prev) => ({ ...prev, [id]: source }));
  }

  const built = () => buildRowsFromPaste(matrix, columns, mapping);

  return (
    <section
      aria-label="Mapeamento de colunas coladas"
      className="animate-fade-in flex flex-col gap-4 rounded-2xl border border-primary/30 bg-accent/20 p-5"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Mapear colunas coladas</h3>
        <p className="text-sm text-muted-foreground text-pretty">
          {matrix.length} linha{matrix.length === 1 ? "" : "s"} · {sourceColCount}{" "}
          coluna{sourceColCount === 1 ? "" : "s"} coladas. Indique de qual coluna
          colada (ou de um valor fixo) cada campo do caso deve ser preenchido.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {columns.map((col) => (
          <MappingRow
            key={col.id}
            col={col}
            source={mapping[col.id]}
            sourceColCount={sourceColCount}
            firstRow={matrix[0]}
            onChange={(s) => setColumn(col.id, s)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onApply(built(), "append")}
        >
          Adicionar às linhas
        </Button>
        <Button type="button" size="sm" onClick={() => onApply(built(), "replace")}>
          Substituir linhas
        </Button>
      </div>
    </section>
  );
}

function MappingRow({
  col,
  source,
  sourceColCount,
  firstRow,
  onChange,
}: {
  col: TargetColumn;
  source: CellSource | undefined;
  sourceColCount: number;
  firstRow: string[] | undefined;
  onChange: (source: CellSource) => void;
}) {
  const mode = source?.mode ?? "ignore";
  const selectValue =
    mode === "source"
      ? `src:${source && source.mode === "source" ? source.sourceIndex : 0}`
      : mode === "constant"
        ? "const"
        : "ignore";
  const selectId = `map-${col.id}`;

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3">
      <label htmlFor={selectId} className="text-xs font-medium">
        {col.label}
        {col.required ? <span className="ml-1 text-destructive">*</span> : null}
      </label>
      <NativeSelect
        id={selectId}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "ignore") onChange({ mode: "ignore" });
          else if (v === "const") onChange({ mode: "constant", value: "" });
          else onChange({ mode: "source", sourceIndex: Number(v.slice(4)) });
        }}
        className="h-9 text-sm"
      >
        <option value="ignore">Ignorar</option>
        {Array.from({ length: sourceColCount }, (_, i) => (
          <option key={i} value={`src:${i}`}>
            Coluna {i + 1}
            {firstRow?.[i] ? ` — ${truncate(firstRow[i])}` : ""}
          </option>
        ))}
        <option value="const">Valor fixo (preencher todas)</option>
      </NativeSelect>
      {mode === "constant" ? (
        <Input
          value={source && source.mode === "constant" ? source.value : ""}
          onChange={(e) => onChange({ mode: "constant", value: e.target.value })}
          placeholder="Valor aplicado a todas as linhas"
          aria-label={`Valor fixo para ${col.label}`}
          className="h-9 px-2.5 text-sm"
        />
      ) : null}
    </div>
  );
}

function truncate(value: string): string {
  const s = value.trim();
  return s.length > 18 ? `${s.slice(0, 18)}…` : s;
}

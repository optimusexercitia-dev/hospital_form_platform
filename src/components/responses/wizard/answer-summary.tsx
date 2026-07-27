"use client";

import type { Json } from "@/lib/types/database";
import type { Item, ItemOption } from "@/lib/queries/forms";
import { cn } from "@/lib/utils";
import { TOKEN_STYLES } from "@/components/cases/case-status-badge";

import type { MatrixCells, RiskSelection } from "@/lib/forms/matrix";

import { isEmptyValue, isMatrixItem } from "./use-wizard";
import { MatrixGrid } from "./matrix-grid";
import { RiskMatrixPicker } from "./risk-matrix-picker";

// Stable no-ops — a read-only grid never invokes its handler props.
const NO_OP_CELL: (rowCode: string, colCode: string) => void = () => {};
const NO_OP_RISK: (next: RiskSelection) => void = () => {};

/**
 * Renders one answered input as a read-only label/value pair for the review
 * screen (F5) and the submission detail view. Display blocks are not summarized
 * here. A blank answer reads "Sem resposta" in muted text so the reviewer sees
 * the gap.
 *
 * form-builder-enhancements: the value is formatted by item type — number
 * (pt-BR), date (pt-BR `dd/mm/aaaa`), time (24h `HH:mm`) — a selected
 * multiple_choice/checkbox/dropdown option renders by its current LABEL (a
 * multiple_choice/checkbox option as a COLOURED chip in its authored palette
 * token), and any per-item observation note is shown as a muted secondary line
 * beneath.
 *
 * form-model-normalization: a choice answer now stores the option CODE, so each
 * selected code is resolved → `{ label, color }` via the item's option rows for
 * display (an unknown code — e.g. an option deleted in a later draft — falls back
 * to showing the raw code so nothing silently disappears).
 */
export function AnswerSummary({
  item,
  value,
  observation,
  otherText,
  matrixCells,
  riskSelection,
}: {
  item: Item;
  value: Json | undefined;
  /** FF-2 — the saved grid of a `matrix` item in THIS scope. */
  matrixCells?: MatrixCells;
  /**
   * FF-2 — the saved risk answer of a `risk_matrix` item in THIS scope.
   *
   * Accepts the read paths' {@link RiskMatrixAnswer} as well as the wizard's
   * bare {@link RiskSelection}: when `riskScore` is present it is the DURABLE
   * stored value and is rendered verbatim rather than recomputed from the axis
   * weights (FUP-FF2-1). A reviewer and a signer must see the number the record
   * holds.
   */
  riskSelection?: RiskSelection & { riskScore?: number | null };
  /** Optional observation note shown as a muted secondary line. */
  observation?: string | null;
  /**
   * Optional "Outros" free text ("Outros" open option), shown as "Outro: <valor>"
   * beneath the answer when the reserved `__other__` option is selected. Only a
   * NON-blank value renders (blank "Outro" is a valid answer but has nothing to
   * show — the "Outro" chip itself already appears in the value).
   */
  otherText?: string | null;
}) {
  const note = observation?.trim();
  const other = otherText?.trim();

  // FF-2 — a matrix reviews as the GRID ITSELF, not as a label/value pair.
  // Flattening a 3×3 grid to "linha: coluna, linha: coluna, …" is exactly the
  // manual tabulation this platform exists to remove, and a risk answer's whole
  // meaning is the score and its band — which are derived from the axis weights
  // here rather than stored, so a re-banded form re-reads history correctly.
  if (isMatrixItem(item.itemType)) {
    return (
      <div className="flex flex-col gap-2 border-b border-border/60 py-3 last:border-b-0">
        {item.itemType === "risk_matrix" ? (
          <RiskMatrixPicker
            item={item}
            selection={riskSelection}
            storedScore={riskSelection?.riskScore ?? null}
            onChange={NO_OP_RISK}
            readOnly
          />
        ) : (
          <MatrixGrid item={item} cells={matrixCells} onChange={NO_OP_CELL} readOnly />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-2.5 last:border-b-0">
      <dt className="flex items-center gap-1 text-sm font-medium">
        {item.label ?? "Pergunta"}
        {item.required && (
          <span className="text-destructive" aria-label="obrigatória">
            *
          </span>
        )}
      </dt>
      <dd className="text-sm text-foreground/90">{renderValue(item, value)}</dd>
      {other && (
        <dd className="text-xs text-muted-foreground">
          <span className="font-medium">Outro:</span>{" "}
          <span className="whitespace-pre-wrap">{other}</span>
        </dd>
      )}
      {note && (
        <dd className="text-xs text-muted-foreground">
          <span className="font-medium">Observação:</span>{" "}
          <span className="whitespace-pre-wrap">{note}</span>
        </dd>
      )}
    </div>
  );
}

function renderValue(item: Item, value: Json | undefined) {
  if (value === undefined || isEmptyValue(value)) {
    return <span className="text-muted-foreground italic">Sem resposta</span>;
  }

  // form-model-normalization: choice answers store the option CODE. Resolve each
  // code → its option row for the current label + colour (mc/checkbox carry
  // colours). An unknown code falls back to showing the raw code.
  const byCode = new Map<string, ItemOption>(
    (item.options ?? []).map((o) => [o.code, o]),
  );
  const labelFor = (code: string) => byCode.get(code)?.label ?? code;
  const colorFor = (code: string) => byCode.get(code)?.color ?? null;

  // checkbox → an array of selected option codes, rendered as coloured chips.
  if (Array.isArray(value)) {
    return (
      <ul className="flex flex-wrap gap-1.5">
        {value.map((v, i) => (
          <li key={i}>
            <OptionChip label={labelFor(String(v))} color={colorFor(String(v))} />
          </li>
        ))}
      </ul>
    );
  }

  // multiple_choice → a single coloured chip (resolved from the code).
  if (item.itemType === "multiple_choice" && typeof value === "string") {
    return <OptionChip label={labelFor(value)} color={colorFor(value)} />;
  }

  // dropdown → the resolved label (no colour — a native <select> can't render it).
  if (item.itemType === "dropdown" && typeof value === "string") {
    return <span>{labelFor(value)}</span>;
  }

  // number / date / time → pt-BR formatting.
  if (item.itemType === "number" && typeof value === "number") {
    return <span>{new Intl.NumberFormat("pt-BR").format(value)}</span>;
  }
  if (item.itemType === "date" && typeof value === "string") {
    return <span>{formatIsoDate(value)}</span>;
  }
  // time is already a 24h `HH:mm` string; short/long text render as-is.
  return <span className="whitespace-pre-wrap">{String(value)}</span>;
}

/** A selected option as a chip — coloured by its palette token, or neutral. */
function OptionChip({
  label,
  color,
}: {
  label: string;
  color: ItemOption["color"];
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs",
        color
          ? TOKEN_STYLES[color]
          : "border border-border bg-card text-foreground",
      )}
    >
      {label}
    </span>
  );
}

/** Format an ISO `YYYY-MM-DD` as a pt-BR `dd/mm/aaaa` (no timezone shift). */
function formatIsoDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

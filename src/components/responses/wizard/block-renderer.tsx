"use client";

import type { Json } from "@/lib/types/database";
import type {
  ImageContent,
  Item,
  SectionTextContent,
} from "@/lib/queries/forms";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { ImagePreview } from "@/components/forms/image-preview";

import { InputItem } from "./input-item";
import { MatrixGrid } from "./matrix-grid";
import { RiskMatrixPicker } from "./risk-matrix-picker";

// Stable no-ops for a read-only render (the grids require the handler props).
const NO_OP_CELL: (rowCode: string, colCode: string) => void = () => {};
const NO_OP_RISK: (next: { severity: string; likelihood: string }) => void =
  () => {};

/**
 * Renders one block within a section (F3): display blocks (`section_text`,
 * `image`) render-only; input blocks collect an answer.
 *
 *  - `section_text` → the project's ONE sanitizing Markdown renderer (Rule 7);
 *    never `dangerouslySetInnerHTML`.
 *  - `image` → `ImagePreview` from a pre-resolved signed URL (the route page
 *    resolves `storage_path → signed URL` server-side, same as the builder).
 *  - input items → `InputItem` (state-managed, accessible).
 */
export function BlockRenderer({
  item,
  imageUrls,
  value,
  onChange,
  error,
  warning,
  observation,
  onObservationChange,
  otherText,
  onOtherTextChange,
  onClear,
  instanceId,
  matrixCells,
  onMatrixCellChange,
  riskSelection,
  onRiskChange,
}: {
  item: Item;
  imageUrls: Record<string, string>;
  value: Json | undefined;
  onChange: (value: Json) => void;
  error?: string;
  /** FF-3 — a failing `warn` rule. Advisory; never blocks. */
  warning?: string;
  /** FF-2 — this scope's saved grid for a `matrix` item. */
  matrixCells?: Record<string, string>;
  onMatrixCellChange?: (rowCode: string, colCode: string) => void;
  /** FF-2 — this scope's saved selection for a `risk_matrix` item. */
  riskSelection?: { severity: string; likelihood: string };
  onRiskChange?: (selection: { severity: string; likelihood: string }) => void;
  observation?: string;
  onObservationChange?: (value: string) => void;
  /** Current "Outros" free text ("Outros" open option); input items only. */
  otherText?: string;
  onOtherTextChange?: (value: string) => void;
  /** Clear the whole input block (answer + observação + "Outros"); input items only. */
  onClear?: () => void;
  /**
   * FF-1 (BUG-FF1-004) — the repeating-group instance this block renders inside,
   * or undefined at top level. Forwarded verbatim to {@link InputItem}, which
   * derives every control id and radio `name` from it. Without it, two
   * repetitions of one `multiple_choice` question share a `name` and the browser
   * treats them as ONE radio group.
   */
  instanceId?: string;
}) {
  if (item.itemType === "section_text" && item.content) {
    return (
      <div className="rounded-xl border border-border bg-background/60 p-4">
        <MarkdownRenderer
          content={(item.content as SectionTextContent).markdown}
        />
      </div>
    );
  }

  if (item.itemType === "image" && item.content) {
    const content = item.content as ImageContent;
    return (
      <div className="rounded-xl border border-border bg-background/60 p-4">
        <ImagePreview
          url={imageUrls[content.storage_path] ?? null}
          alt={content.alt}
          caption={content.caption ?? null}
        />
      </div>
    );
  }

  // FF-2 — the matrix types. Dispatched BEFORE the InputItem fallback and never
  // through it: `InputItem` is built around a scalar `value`, which a matrix
  // does not have. Both grids carry their own labelling, help text and error
  // region, so they sit in the same card chrome as any other block.
  if (item.itemType === "matrix") {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <MatrixGrid
          item={item}
          instanceId={instanceId}
          cells={matrixCells}
          onChange={onMatrixCellChange ?? NO_OP_CELL}
          onClear={onClear}
          error={error}
          readOnly={onMatrixCellChange == null}
        />
      </div>
    );
  }

  if (item.itemType === "risk_matrix") {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <RiskMatrixPicker
          item={item}
          instanceId={instanceId}
          selection={riskSelection}
          onChange={onRiskChange ?? NO_OP_RISK}
          onClear={onClear}
          error={error}
          readOnly={onRiskChange == null}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <InputItem
        item={item}
        instanceId={instanceId}
        value={value}
        onChange={onChange}
        error={error}
        warning={warning}
        observation={observation}
        onObservationChange={onObservationChange}
        otherText={otherText}
        onOtherTextChange={onOtherTextChange}
        onClear={onClear}
      />
    </div>
  );
}

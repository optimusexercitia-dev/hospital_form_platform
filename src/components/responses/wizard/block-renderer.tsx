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
import { ReferencePicker } from "./reference-picker";
import type { ReferenceAnswerRecord, ReferenceCandidateRow } from "./references";

// Stable no-ops for a read-only render (the grids require the handler props).
const NO_OP_CELL: (rowCode: string, colCode: string) => void = () => {};
const NO_OP_RISK: (next: { severity: string; likelihood: string }) => void =
  () => {};
const NO_OP_REFERENCE: (next: ReferenceAnswerRecord | null) => void = () => {};
/** A read-only reference never searches; a stable resolved promise keeps the
 *  prop total without minting a new function per render. */
const NO_OP_SEARCH: () => Promise<{
  ok: boolean;
  candidates?: ReferenceCandidateRow[];
}> = () => Promise.resolve({ ok: true, candidates: [] });

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
  requiredNow,
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
  reference,
  onReferenceChange,
  onReferenceSearch,
}: {
  item: Item;
  imageUrls: Record<string, string>;
  value: Json | undefined;
  onChange: (value: Json) => void;
  error?: string;
  /** FF-3 — a failing `warn` rule. Advisory; never blocks. */
  warning?: string;
  /** FF-3 — effective required-ness now (drives the marker + `aria-required`). */
  requiredNow?: boolean;
  /** FF-2 — this scope's saved grid for a `matrix` item. */
  matrixCells?: Record<string, string>;
  onMatrixCellChange?: (rowCode: string, colCode: string) => void;
  /** FF-2 — this scope's saved selection for a `risk_matrix` item. */
  riskSelection?: { severity: string; likelihood: string };
  onRiskChange?: (selection: { severity: string; likelihood: string }) => void;
  /** FF-5 — this scope's committed reference for a `reference` item. */
  reference?: ReferenceAnswerRecord | null;
  onReferenceChange?: (next: ReferenceAnswerRecord | null) => void;
  /**
   * FF-5 — search this item's candidates. Injected all the way down from the
   * runner (which binds the server action) rather than imported, so no component
   * in the wizard tree value-imports a data module.
   */
  onReferenceSearch?: (query: string) => Promise<{
    ok: boolean;
    error?: string;
    candidates?: ReferenceCandidateRow[];
  }>;
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
          requiredNow={requiredNow}
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
          requiredNow={requiredNow}
          readOnly={onRiskChange == null}
        />
      </div>
    );
  }

  // FF-5 — the reference type. Dispatched BEFORE the InputItem fallback and
  // never through it, for the identical reason as the matrix types above:
  // `InputItem` is built around a scalar `value`, which a reference does not
  // have. The picker carries its own label, help text, live region and error
  // region, so it sits in the same card chrome as any other block.
  //
  // i-2, considered and DELIBERATELY LEFT: `readOnly` is derived from handler
  // presence here and on both matrix types above, so a broken handler chain
  // would degrade a live fill field to read-only rather than erroring. That IS
  // the same optional-prop opt-out shape as BUG-FF5-002 — but the failure mode
  // is categorically different, which is why it is treated differently:
  //
  //   · BUG-FF5-002 was missing DATA rendering as "unanswered" — a plausible,
  //     silent, permanently-wrong record that nobody would question.
  //   · This would be a visibly INERT control in a fill flow: the filler cannot
  //     answer, and every E2E fill spec for the item fails immediately. It
  //     cannot reach the durable record at all.
  //
  // Loud-and-blocking does not need a type-level guard the way silent-and-wrong
  // does. Tightening it for `reference` alone would also split the idiom inside
  // one dispatcher while `matrix`/`risk_matrix` keep it — worse than either
  // choice applied uniformly. If it is ever changed, change all three together;
  // the read-only consumers (`AnswerSummary`) rely on passing no handlers.
  if (item.itemType === "reference") {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <ReferencePicker
          item={item}
          instanceId={instanceId}
          value={reference}
          onChange={onReferenceChange ?? NO_OP_REFERENCE}
          onSearch={onReferenceSearch ?? NO_OP_SEARCH}
          error={error}
          requiredNow={requiredNow}
          readOnly={onReferenceChange == null}
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
        requiredNow={requiredNow}
        observation={observation}
        onObservationChange={onObservationChange}
        otherText={otherText}
        onOtherTextChange={onOtherTextChange}
        onClear={onClear}
      />
    </div>
  );
}

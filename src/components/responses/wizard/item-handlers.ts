import type { Json } from "@/lib/types/database";
import type { Item } from "@/lib/queries/forms";

import { isInputItem, isMatrixItem } from "./effective-visibility";

/**
 * The per-item callbacks handed to one `BlockRenderer`/`InputItem`, precomputed
 * once per item so they stay referentially stable across keystroke re-renders.
 *
 * Extracted from `section-step.tsx` in FF-1 so the three renderers that now need
 * them — the section itself, a plain `GroupBlock`, and each repeating-group
 * INSTANCE — build them identically. Instances especially: each one needs its
 * OWN closure set (bound to its instance id), and re-minting them per render
 * would defeat `memo(InputItem)` for every question in every instance at once,
 * which is exactly where the cost multiplies.
 */
export interface ItemHandlers {
  onChange: (value: Json) => void;
  onObservationChange?: (value: string) => void;
  onOtherTextChange?: (value: string) => void;
  onClear?: () => void;
  /**
   * FF-2 — the matrix verbs. Present only on a `matrix` / `risk_matrix` item, so
   * a renderer that reaches for one on a scalar item gets `undefined` rather
   * than a handler writing into a slice that item does not use.
   */
  onMatrixCellChange?: (rowCode: string, colCode: string) => void;
  onRiskChange?: (selection: { severity: string; likelihood: string }) => void;
}

/** `item_id → its stable callbacks`. */
export type ItemHandlerMap = Map<string, ItemHandlers>;

/**
 * Stable no-op for a display block's required `onChange` prop. Display items
 * (`section_text` / `image`) never invoke it — `BlockRenderer` returns before
 * wiring it — but the prop is required, and a single shared reference keeps
 * every display block's `onChange` referentially stable across re-renders so
 * `memo(InputItem)` isn't defeated for its input-item siblings (audit #10).
 */
export const NO_OP: (value: Json) => void = () => {};

/** The identity-carrying callbacks a caller binds per item. */
export interface ItemCallbacks {
  onChange: (item: { id: string; questionKey: string }, value: Json) => void;
  onObservationChange?: (itemId: string, value: string) => void;
  onOtherTextChange?: (
    item: { id: string; questionKey: string },
    value: string,
  ) => void;
  onClear?: (item: { id: string; questionKey: string }) => void;
  /** FF-2 — commit one row of a `matrix` (the row's whole selection). */
  onMatrixCellChange?: (
    itemId: string,
    rowCode: string,
    colCode: string,
  ) => void;
  /** FF-2 — clear a whole matrix / risk answer. */
  onMatrixClear?: (itemId: string) => void;
  /** FF-2 — commit a whole `risk_matrix` cell (both halves together). */
  onRiskChange?: (
    itemId: string,
    selection: { severity: string; likelihood: string },
  ) => void;
  onRiskClear?: (itemId: string) => void;
}

/**
 * Build one stable {@link ItemHandlers} per INPUT item in `items`. Call inside a
 * `useMemo` keyed on the item list + the callbacks, all of which are
 * `useCallback`-stable, so the map is rebuilt only when the form structure or a
 * handler changes — never on a keystroke, which only mutates answers/errors.
 */
export function buildItemHandlers(
  items: Item[],
  callbacks: ItemCallbacks,
): ItemHandlerMap {
  const {
    onChange,
    onObservationChange,
    onOtherTextChange,
    onClear,
    onMatrixCellChange,
    onMatrixClear,
    onRiskChange,
    onRiskClear,
  } = callbacks;
  const map: ItemHandlerMap = new Map();
  for (const item of items) {
    // FF-2 — a matrix gets its OWN handler shape. It shares nothing with the
    // scalar path: no value, no observação, no "Outros".
    if (isMatrixItem(item.itemType)) {
      const isRisk = item.itemType === "risk_matrix";
      map.set(item.id, {
        onChange: NO_OP,
        onMatrixCellChange:
          !isRisk && onMatrixCellChange
            ? (rowCode, colCode) =>
                onMatrixCellChange(item.id, rowCode, colCode)
            : undefined,
        onRiskChange:
          isRisk && onRiskChange
            ? (selection) => onRiskChange(item.id, selection)
            : undefined,
        onClear: isRisk
          ? onRiskClear
            ? () => onRiskClear(item.id)
            : undefined
          : onMatrixClear
            ? () => onMatrixClear(item.id)
            : undefined,
      });
      continue;
    }
    if (!isInputItem(item.itemType)) continue;
    const questionKey = item.questionKey;
    map.set(item.id, {
      onChange: questionKey
        ? (value) => onChange({ id: item.id, questionKey }, value)
        : NO_OP,
      onObservationChange: onObservationChange
        ? (value) => onObservationChange(item.id, value)
        : undefined,
      onOtherTextChange:
        questionKey && onOtherTextChange
          ? (value) => onOtherTextChange({ id: item.id, questionKey }, value)
          : undefined,
      onClear:
        questionKey && onClear
          ? () => onClear({ id: item.id, questionKey })
          : undefined,
    });
  }
  return map;
}

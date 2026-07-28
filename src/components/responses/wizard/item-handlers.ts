import type { Json } from "@/lib/types/database";
import type { Item } from "@/lib/queries/forms";

import { isInputItem, isMatrixItem, isReferenceItem } from "./effective-visibility";
import type {
  ReferenceAnswerRecord,
  ReferenceCandidateRow,
} from "./references";

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
  /**
   * FF-5 — commit or clear this item's entity reference. Present only on a
   * `reference` item, so a renderer reaching for it on any other type gets
   * `undefined` rather than a handler writing into a slice that item never uses.
   */
  onReferenceChange?: (next: ReferenceAnswerRecord | null) => void;
  /**
   * FF-5 — search THIS item's candidates, already bound to its item id (and,
   * through the caller, to its instance).
   *
   * Bound HERE rather than composed in the renderer on purpose: `ReferencePicker`
   * is `memo`, and a fresh `onSearch` closure minted per render would defeat that
   * for every reference on the page — including, in a repeating group, once per
   * repetition. This map is rebuilt only when the form structure or a parent
   * callback changes, which is the same stability guarantee the other verbs get.
   */
  onReferenceSearch?: (query: string) => Promise<{
    ok: boolean;
    error?: string;
    candidates?: ReferenceCandidateRow[];
  }>;
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
  /** FF-5 — commit/clear one item's reference (null = clear). One verb, because
   *  a reference is single-target: picking REPLACES and null clears. */
  onReferenceChange?: (
    itemId: string,
    next: ReferenceAnswerRecord | null,
  ) => void;
  /** FF-5 — search one item's candidates. The caller has already bound the
   *  response (and, for an instance handler set, nothing else: the RPC scopes by
   *  `(response_id, item_id)` and derives the case from the response). */
  onReferenceSearch?: (
    itemId: string,
    query: string,
  ) => Promise<{
    ok: boolean;
    error?: string;
    candidates?: ReferenceCandidateRow[];
  }>;
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
    onReferenceChange,
    onReferenceSearch,
  } = callbacks;
  const map: ItemHandlerMap = new Map();
  for (const item of items) {
    // FF-5 — a reference gets its OWN handler shape, and shares nothing with the
    // scalar path: no value, no observação, no "Outros". Its "Limpar" IS
    // `onReferenceChange(null)` — one verb, so the clear can never take a
    // different code path from the pick and disagree with it.
    if (isReferenceItem(item.itemType)) {
      map.set(item.id, {
        onChange: NO_OP,
        onReferenceChange: onReferenceChange
          ? (next) => onReferenceChange(item.id, next)
          : undefined,
        onClear: onReferenceChange
          ? () => onReferenceChange(item.id, null)
          : undefined,
        onReferenceSearch: onReferenceSearch
          ? (query: string) => onReferenceSearch(item.id, query)
          : undefined,
      });
      continue;
    }
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

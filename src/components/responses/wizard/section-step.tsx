"use client";

import { useMemo } from "react";

import type { Json } from "@/lib/types/database";
import type { Section } from "@/lib/queries/forms";
import type { MatrixCellsState, RiskMatrixState } from "@/lib/forms/matrix";

import type { AnswerState } from "./types";
import { BlockRenderer } from "./block-renderer";
import { GroupBlock } from "./group-block";
import { RepeatingGroupBlock } from "./repeating-group-block";
import { buildItemHandlers, NO_OP, type ItemCallbacks } from "./item-handlers";
import type { InstanceState } from "./instances";
import { isAnswerableItem, isInputItem } from "./use-wizard";

/**
 * Renders one wizard section as a page (F2/F3): a semantic `<section>` labelled
 * by its `<h2>`, with the ordered blocks beneath. Display blocks render only;
 * input blocks are controlled by the wizard's answer state. `index` is the
 * 0-based position within the VISIBLE step list (for the "Seção N" eyebrow).
 *
 * FF-1 (ADR 0087) adds the two CONTAINER blocks, dispatched by type:
 *   - `group` → {@link GroupBlock}, a nested sub-section with NO instance chrome
 *     (ruling 6 — it has no instance rows at all). Its children are ordinary
 *     top-level answers and share the section's handler map.
 *   - `repeating_group` → {@link RepeatingGroupBlock}, N instances with
 *     add/remove/reorder. Its children answer PER INSTANCE and get their own
 *     per-instance handler sets, so nothing about them touches `answers`.
 */
export function SectionStep({
  section,
  index,
  imageUrls,
  answers,
  matrixCells,
  riskMatrix,
  errors,
  warnings,
  requiredNow,
  onChange,
  onMatrixCellChange,
  onMatrixClear,
  onRiskChange,
  onRiskClear,
  visibleItemIds,
  visibleContainerIds,
  instancesByGroup,
  visibleItemIdsByInstance,
  instanceErrors,
  instanceWarnings,
  instanceRequiredNow,
  saving = false,
  onObservationChange,
  onOtherTextChange,
  onClear,
  onAddInstance,
  onRemoveInstance,
  onMoveInstance,
  onInstanceChange,
  onInstanceObservationChange,
  onInstanceOtherTextChange,
  onInstanceClear,
  onInstanceMatrixCellChange,
  onInstanceMatrixClear,
  onInstanceRiskChange,
  onInstanceRiskClear,
}: {
  section: Section;
  index: number;
  imageUrls: Record<string, string>;
  answers: AnswerState;
  /** FF-2 — the section's TOP-LEVEL matrix slices (a plain `group`'s children
   *  answer at top level too, so they read from these). */
  matrixCells?: MatrixCellsState;
  riskMatrix?: RiskMatrixState;
  errors: Record<string, string>;
  /** FF-3 — failing `warn` rules, keyed by item id. Advisory; never blocks. */
  warnings?: Record<string, string>;
  /** FF-3 — item ids required RIGHT NOW (plain `required` OR a holding `required_if`). */
  requiredNow?: Set<string>;
  onChange: (item: { id: string; questionKey: string }, value: Json) => void;
  /** FF-2 — commit one row of a `matrix`. */
  onMatrixCellChange?: (
    itemId: string,
    rowCode: string,
    colCode: string,
  ) => void;
  onMatrixClear?: (itemId: string) => void;
  /** FF-2 — commit a whole `risk_matrix` cell. */
  onRiskChange?: (
    itemId: string,
    selection: { severity: string; likelihood: string },
  ) => void;
  onRiskClear?: (itemId: string) => void;
  /**
   * The item ids currently VISIBLE under item-level conditions
   * (form-builder-enhancements). When provided, hidden input items are skipped;
   * display items always render. FF-1: a plain `group`'s children are in this
   * set too (they answer at top level).
   */
  visibleItemIds?: Set<string>;
  /** FF-1 — the CONTAINER ids currently visible; a hidden container renders
   *  nothing and requires nothing. */
  visibleContainerIds?: Set<string>;
  /** FF-1 — repeating-group instances by container item id, position-ordered. */
  instancesByGroup?: Record<string, InstanceState[]>;
  /** FF-1 — per-instance visible child ids (the inside-out overlay result). */
  visibleItemIdsByInstance?: Map<string, Set<string>>;
  /** FF-1 — validation errors keyed `${instanceId}:${itemId}`. */
  instanceErrors?: Record<string, string>;
  /** FF-3 — failing `warn` rules inside repetitions, keyed `${instanceId}:${itemId}`. */
  instanceWarnings?: Record<string, string>;
  /** FF-3 — per-instance keys required RIGHT NOW, keyed `${instanceId}:${itemId}`. */
  instanceRequiredNow?: Set<string>;
  /** True while a save or instance action is in flight. */
  saving?: boolean;
  /** Persist a per-item observation note (form-builder-enhancements). */
  onObservationChange?: (itemId: string, value: string) => void;
  /** Persist a per-item "Outros" free text ("Outros" open option). Takes the
   *  item identity so the wizard can UPSERT the record (BUG-FBE-008). */
  onOtherTextChange?: (
    item: { id: string; questionKey: string },
    value: string,
  ) => void;
  /** Clear an input block (answer + observação + "Outros" text). */
  onClear?: (item: { id: string; questionKey: string }) => void;
  // --- FF-1 instance lifecycle + per-instance edits.
  onAddInstance?: (groupItemId: string) => void;
  onRemoveInstance?: (instanceId: string) => void;
  onMoveInstance?: (instanceId: string, direction: "up" | "down") => void;
  onInstanceChange?: (
    instanceId: string,
    child: { id: string; questionKey: string },
    value: Json,
  ) => void;
  onInstanceObservationChange?: (
    instanceId: string,
    itemId: string,
    value: string,
  ) => void;
  onInstanceOtherTextChange?: (
    instanceId: string,
    child: { id: string; questionKey: string },
    value: string,
  ) => void;
  onInstanceClear?: (
    instanceId: string,
    child: { id: string; questionKey: string },
  ) => void;
  // --- FF-2: the per-instance matrix verbs, forwarded to RepeatingGroupBlock.
  onInstanceMatrixCellChange?: (
    instanceId: string,
    itemId: string,
    rowCode: string,
    colCode: string,
  ) => void;
  onInstanceMatrixClear?: (instanceId: string, itemId: string) => void;
  onInstanceRiskChange?: (
    instanceId: string,
    itemId: string,
    selection: { severity: string; likelihood: string },
  ) => void;
  onInstanceRiskClear?: (instanceId: string, itemId: string) => void;
}) {
  const headingId = `section-${section.id}-heading`;
  const heading =
    section.title || (section.isDefault ? null : "Seção sem título");

  // Precompute one stable set of callbacks per item (audit #10). The parent
  // handlers are all `useCallback`-stable and `section.items` is the immutable
  // form structure, so this map is rebuilt only when the form (or a handler)
  // changes — NEVER on a keystroke, which only mutates `answers`/`errors`. That
  // keeps every input item's callback props referentially stable, so
  // `memo(InputItem)` skips re-rendering the siblings of the item being edited.
  //
  // FF-1: a plain `group`'s children are built here too (they are top-level
  // answers). A `repeating_group`'s children are NOT — each instance owns its
  // own handler set, bound to its instance id.
  const callbacks = useMemo<ItemCallbacks>(
    () => ({
      onChange,
      onObservationChange,
      onOtherTextChange,
      onClear,
      onMatrixCellChange,
      onMatrixClear,
      onRiskChange,
      onRiskClear,
    }),
    [
      onChange,
      onObservationChange,
      onOtherTextChange,
      onClear,
      onMatrixCellChange,
      onMatrixClear,
      onRiskChange,
      onRiskClear,
    ],
  );
  const itemHandlers = useMemo(() => {
    const flat = section.items.flatMap((item) =>
      item.itemType === "group" ? [item, ...item.children] : [item],
    );
    return buildItemHandlers(flat, callbacks);
  }, [section.items, callbacks]);

  return (
    <section
      aria-labelledby={heading ? headingId : undefined}
      aria-label={heading ? undefined : "Formulário"}
      className="animate-fade-in flex flex-col gap-5"
    >
      {heading && (
        <header className="flex flex-col gap-1.5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Seção {index + 1}
          </span>
          <h2 id={headingId} className="text-2xl text-balance">
            {heading}
          </h2>
          {section.description && (
            <p className="max-w-prose text-muted-foreground text-pretty">
              {section.description}
            </p>
          )}
        </header>
      )}

      <div className="flex flex-col gap-4">
        {section.items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
            Esta seção não tem conteúdo.
          </p>
        ) : (
          section.items.map((item) => {
            // --- FF-1: CONTAINERS.
            if (item.itemType === "group" || item.itemType === "repeating_group") {
              // A hidden container renders nothing (and requires nothing).
              if (visibleContainerIds && !visibleContainerIds.has(item.id)) {
                return null;
              }
              if (item.itemType === "group") {
                return (
                  <GroupBlock
                    key={item.id}
                    item={item}
                    imageUrls={imageUrls}
                    answers={answers}
                    matrixCells={matrixCells}
                    riskMatrix={riskMatrix}
                    errors={errors}
                    visibleItemIds={visibleItemIds}
                    handlers={itemHandlers}
                  />
                );
              }
              return (
                <RepeatingGroupBlock
                  key={item.id}
                  item={item}
                  instances={instancesByGroup?.[item.id] ?? EMPTY_INSTANCES}
                  imageUrls={imageUrls}
                  errors={instanceErrors ?? EMPTY_ERRORS}
                  warnings={instanceWarnings ?? EMPTY_ERRORS}
                  requiredNow={instanceRequiredNow}
                  visibleItemIdsByInstance={
                    visibleItemIdsByInstance ?? EMPTY_VISIBILITY
                  }
                  saving={saving}
                  onAddInstance={onAddInstance ?? NO_OP_GROUP}
                  onRemoveInstance={onRemoveInstance ?? NO_OP_GROUP}
                  onMoveInstance={onMoveInstance ?? NO_OP_MOVE}
                  onInstanceChange={onInstanceChange ?? NO_OP_INSTANCE_CHANGE}
                  onInstanceObservationChange={
                    onInstanceObservationChange ?? NO_OP_INSTANCE_TEXT
                  }
                  onInstanceOtherTextChange={
                    onInstanceOtherTextChange ?? NO_OP_INSTANCE_OTHER
                  }
                  onInstanceClear={onInstanceClear ?? NO_OP_INSTANCE_CLEAR}
                  onInstanceMatrixCellChange={
                    onInstanceMatrixCellChange ?? NO_OP_INSTANCE_CELL
                  }
                  onInstanceMatrixClear={
                    onInstanceMatrixClear ?? NO_OP_INSTANCE_ITEM
                  }
                  onInstanceRiskChange={
                    onInstanceRiskChange ?? NO_OP_INSTANCE_RISK
                  }
                  onInstanceRiskClear={
                    onInstanceRiskClear ?? NO_OP_INSTANCE_ITEM
                  }
                />
              );
            }

            // FF-2: a matrix is answerable but NOT an input item, so both are
            // needed — `answerable` gates the visibility skip and the error
            // lookup, `scalar` gates the value/observação/Outros plumbing that
            // only a scalar answer has.
            const answerable = isAnswerableItem(item.itemType);
            const scalar = isInputItem(item.itemType);
            // Skip answerable items hidden by an item-level condition; display
            // items always render (they collect no answer).
            if (answerable && visibleItemIds && !visibleItemIds.has(item.id)) {
              return null;
            }
            // Stable per-item callbacks (see `itemHandlers` above); display
            // items have none, so `onChange` falls back to the shared no-op.
            const handlers = itemHandlers.get(item.id);
            return (
              <BlockRenderer
                key={item.id}
                item={item}
                imageUrls={imageUrls}
                value={scalar ? answers[item.id]?.value : undefined}
                error={answerable ? errors[item.id] : undefined}
                warning={answerable ? warnings?.[item.id] : undefined}
                requiredNow={requiredNow?.has(item.id)}
                onChange={handlers?.onChange ?? NO_OP}
                observation={
                  scalar ? answers[item.id]?.observation : undefined
                }
                onObservationChange={handlers?.onObservationChange}
                otherText={scalar ? answers[item.id]?.otherText : undefined}
                onOtherTextChange={handlers?.onOtherTextChange}
                onClear={handlers?.onClear}
                matrixCells={matrixCells?.[item.id]}
                onMatrixCellChange={handlers?.onMatrixCellChange}
                riskSelection={riskMatrix?.[item.id]}
                onRiskChange={handlers?.onRiskChange}
              />
            );
          })
        )}
      </div>
    </section>
  );
}

// Stable empty fallbacks — shared references so an omitted optional prop can
// never remint an object per render and defeat the child memoization.
const EMPTY_INSTANCES: InstanceState[] = [];
const EMPTY_ERRORS: Record<string, string> = {};
const EMPTY_VISIBILITY: Map<string, Set<string>> = new Map();
const NO_OP_GROUP: (id: string) => void = () => {};
const NO_OP_MOVE: (id: string, direction: "up" | "down") => void = () => {};
const NO_OP_INSTANCE_CHANGE: (
  instanceId: string,
  child: { id: string; questionKey: string },
  value: Json,
) => void = () => {};
const NO_OP_INSTANCE_TEXT: (
  instanceId: string,
  itemId: string,
  value: string,
) => void = () => {};
const NO_OP_INSTANCE_OTHER: (
  instanceId: string,
  child: { id: string; questionKey: string },
  value: string,
) => void = () => {};
const NO_OP_INSTANCE_CLEAR: (
  instanceId: string,
  child: { id: string; questionKey: string },
) => void = () => {};
const NO_OP_INSTANCE_CELL: (
  instanceId: string,
  itemId: string,
  rowCode: string,
  colCode: string,
) => void = () => {};
const NO_OP_INSTANCE_ITEM: (instanceId: string, itemId: string) => void =
  () => {};
const NO_OP_INSTANCE_RISK: (
  instanceId: string,
  itemId: string,
  selection: { severity: string; likelihood: string },
) => void = () => {};

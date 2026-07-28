"use client";

import type { Json } from "@/lib/types/database";
import type { Item } from "@/lib/queries/forms";
import type { MatrixCellsState, RiskMatrixState } from "@/lib/forms/matrix";

import type { AnswerState } from "./types";
import { BlockRenderer } from "./block-renderer";
import { isAnswerableItem, isInputItem } from "./use-wizard";
import { ItemHandlerMap } from "./item-handlers";

/**
 * FF-1 (ADR 0087 ruling 6) — a plain `group` rendered as a NESTED SUB-SECTION.
 *
 * Deliberately no instance chrome of any kind: a plain group has no instance
 * rows, so there is nothing to add, remove or reorder. Its children answer at
 * TOP LEVEL exactly like flat items — same answer state, same handlers, same
 * `question_key` visibility — which is also why their keys stay ordinary
 * condition targets everywhere. The only thing this component adds is
 * STRUCTURE: a heading, optional guidance, and an indented rail so the
 * relatedness is visible.
 *
 * Rendered as a real `<section>` labelled by its heading, so a screen reader
 * announces the grouping rather than a run of unrelated questions.
 */
export function GroupBlock({
  item,
  imageUrls,
  answers,
  matrixCells,
  riskMatrix,
  errors,
  warnings,
  requiredNow,
  visibleItemIds,
  handlers,
}: {
  item: Item;
  imageUrls: Record<string, string>;
  answers: AnswerState;
  /** FF-2 — a plain group's children answer at TOP LEVEL (ruling 6), so a matrix
   *  inside one reads from the section's top-level slices, not from an instance. */
  matrixCells?: MatrixCellsState;
  riskMatrix?: RiskMatrixState;
  errors: Record<string, string>;
  /**
   * FF-3 — failing `warn` rules and the effective-required set, both keyed by
   * BARE item id.
   *
   * A plain group's children answer at TOP LEVEL (ADR 0087 ruling 6), which is
   * why these are the section's top-level maps and not instance-scoped ones:
   * `validateSectionRules` flattens `group` children into the SAME flat pass and
   * keys them by `item.id`, and `app.response_required_complete` treats them as
   * top-level too. Keying them like repeating-group children would look right in
   * a one-group form and drift the moment anything nests differently.
   */
  warnings?: Record<string, string>;
  requiredNow?: Set<string>;
  /** Top-level visible item ids — a plain group's children are in this set. */
  visibleItemIds?: Set<string>;
  handlers: ItemHandlerMap;
}) {
  const headingId = `group-${item.id}-heading`;
  const descriptionId = item.questionExplanation
    ? `group-${item.id}-description`
    : undefined;

  const visibleChildren = item.children.filter((child) => {
    // FF-2: a matrix child is answerable and therefore condition-gated too.
    if (!isAnswerableItem(child.itemType)) return true; // display blocks always render
    return !visibleItemIds || visibleItemIds.has(child.id);
  });

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <header className="flex flex-col gap-1">
        <h3 id={headingId} className="text-lg font-medium text-balance">
          {item.label}
        </h3>
        {item.questionExplanation ? (
          <p
            id={descriptionId}
            className="max-w-prose text-sm text-muted-foreground text-pretty"
          >
            {item.questionExplanation}
          </p>
        ) : null}
      </header>

      <div className="flex flex-col gap-4 border-l-2 border-border/70 pl-4">
        {visibleChildren.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Nenhuma pergunta a responder neste grupo.
          </p>
        ) : (
          visibleChildren.map((child) => {
            const answerable = isAnswerableItem(child.itemType);
            const scalar = isInputItem(child.itemType);
            const childHandlers = handlers.get(child.id);
            return (
              <BlockRenderer
                key={child.id}
                item={child}
                imageUrls={imageUrls}
                value={scalar ? answers[child.id]?.value : undefined}
                error={answerable ? errors[child.id] : undefined}
                warning={answerable ? warnings?.[child.id] : undefined}
                requiredNow={requiredNow?.has(child.id)}
                onChange={childHandlers?.onChange ?? NO_OP}
                observation={
                  scalar ? answers[child.id]?.observation : undefined
                }
                onObservationChange={childHandlers?.onObservationChange}
                otherText={scalar ? answers[child.id]?.otherText : undefined}
                onOtherTextChange={childHandlers?.onOtherTextChange}
                onClear={childHandlers?.onClear}
                matrixCells={matrixCells?.[child.id]}
                onMatrixCellChange={childHandlers?.onMatrixCellChange}
                riskSelection={riskMatrix?.[child.id]}
                onRiskChange={childHandlers?.onRiskChange}
              />
            );
          })
        )}
      </div>
    </section>
  );
}

/** Shared stable no-op for a display block's required `onChange` (see
 *  `section-step.tsx` — one reference keeps `memo(InputItem)` effective). */
const NO_OP: (value: Json) => void = () => {};

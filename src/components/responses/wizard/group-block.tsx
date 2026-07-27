"use client";

import type { Json } from "@/lib/types/database";
import type { Item } from "@/lib/queries/forms";

import type { AnswerState } from "./types";
import { BlockRenderer } from "./block-renderer";
import { isInputItem } from "./use-wizard";
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
  errors,
  visibleItemIds,
  handlers,
}: {
  item: Item;
  imageUrls: Record<string, string>;
  answers: AnswerState;
  errors: Record<string, string>;
  /** Top-level visible item ids — a plain group's children are in this set. */
  visibleItemIds?: Set<string>;
  handlers: ItemHandlerMap;
}) {
  const headingId = `group-${item.id}-heading`;
  const descriptionId = item.questionExplanation
    ? `group-${item.id}-description`
    : undefined;

  const visibleChildren = item.children.filter((child) => {
    if (!isInputItem(child.itemType)) return true; // display blocks always render
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
            const answerable = isInputItem(child.itemType);
            const childHandlers = handlers.get(child.id);
            return (
              <BlockRenderer
                key={child.id}
                item={child}
                imageUrls={imageUrls}
                value={answerable ? answers[child.id]?.value : undefined}
                error={answerable ? errors[child.id] : undefined}
                onChange={childHandlers?.onChange ?? NO_OP}
                observation={
                  answerable ? answers[child.id]?.observation : undefined
                }
                onObservationChange={childHandlers?.onObservationChange}
                otherText={answerable ? answers[child.id]?.otherText : undefined}
                onOtherTextChange={childHandlers?.onOtherTextChange}
                onClear={childHandlers?.onClear}
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

"use client";

import { useMemo } from "react";

import type { Json } from "@/lib/types/database";
import type { Section } from "@/lib/queries/forms";

import type { AnswerState } from "./types";
import { BlockRenderer } from "./block-renderer";
import { isInputItem } from "./use-wizard";

/**
 * Stable no-op for a display block's required `onChange` prop. Display items
 * (`section_text` / `image`) never invoke it — `BlockRenderer` returns before
 * wiring it — but the prop is required, and a single shared reference keeps
 * every display block's `onChange` referentially stable across re-renders so
 * `memo(InputItem)` isn't defeated for its input-item siblings (audit #10).
 */
const NO_OP: (value: Json) => void = () => {};

/** The per-item callbacks handed to one `BlockRenderer`/`InputItem`, precomputed
 *  once per item so they stay referentially stable across keystroke re-renders. */
interface ItemHandlers {
  onChange: (value: Json) => void;
  onObservationChange?: (value: string) => void;
  onOtherTextChange?: (value: string) => void;
  onClear?: () => void;
}

/**
 * Renders one wizard section as a page (F2/F3): a semantic `<section>` labelled
 * by its `<h2>`, with the ordered blocks beneath. Display blocks render only;
 * input blocks are controlled by the wizard's answer state. `index` is the
 * 0-based position within the VISIBLE step list (for the "Seção N" eyebrow).
 */
export function SectionStep({
  section,
  index,
  imageUrls,
  answers,
  errors,
  onChange,
  visibleItemIds,
  onObservationChange,
  onOtherTextChange,
  onClear,
}: {
  section: Section;
  index: number;
  imageUrls: Record<string, string>;
  answers: AnswerState;
  errors: Record<string, string>;
  onChange: (item: { id: string; questionKey: string }, value: Json) => void;
  /**
   * The item ids currently VISIBLE under item-level conditions
   * (form-builder-enhancements). When provided, hidden input items are skipped;
   * display items always render.
   */
  visibleItemIds?: Set<string>;
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
}) {
  const headingId = `section-${section.id}-heading`;
  const heading =
    section.title || (section.isDefault ? null : "Seção sem título");

  // Precompute one stable set of callbacks per item (audit #10). The parent
  // handlers (`onChange`/`onObservationChange`/`onOtherTextChange`/`onClear`)
  // are all `useCallback`-stable and `section.items` is the immutable form
  // structure, so this map is rebuilt only when the form (or a handler) changes
  // — NEVER on a keystroke, which only mutates `answers`/`errors`. That keeps
  // every input item's callback props referentially stable across keystrokes,
  // so `memo(InputItem)` skips re-rendering the siblings of the item being
  // edited (previously each render minted fresh per-item closures, defeating
  // the memo). Behavior is identical to the former inline closures.
  const itemHandlers = useMemo(() => {
    const map = new Map<string, ItemHandlers>();
    for (const item of section.items) {
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
  }, [section.items, onChange, onObservationChange, onOtherTextChange, onClear]);

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
            const answerable = isInputItem(item.itemType);
            // Skip input items hidden by an item-level condition; display items
            // always render (they collect no answer).
            if (
              answerable &&
              visibleItemIds &&
              !visibleItemIds.has(item.id)
            ) {
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
                value={answerable ? answers[item.id]?.value : undefined}
                error={answerable ? errors[item.id] : undefined}
                onChange={handlers?.onChange ?? NO_OP}
                observation={
                  answerable ? answers[item.id]?.observation : undefined
                }
                onObservationChange={handlers?.onObservationChange}
                otherText={
                  answerable ? answers[item.id]?.otherText : undefined
                }
                onOtherTextChange={handlers?.onOtherTextChange}
                onClear={handlers?.onClear}
              />
            );
          })
        )}
      </div>
    </section>
  );
}

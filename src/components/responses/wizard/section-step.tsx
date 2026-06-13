"use client";

import type { Json } from "@/lib/types/database";
import type { Section } from "@/lib/queries/forms";

import type { AnswerState } from "./types";
import { BlockRenderer } from "./block-renderer";
import { isInputItem } from "./use-wizard";

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
}: {
  section: Section;
  index: number;
  imageUrls: Record<string, string>;
  answers: AnswerState;
  errors: Record<string, string>;
  onChange: (item: { id: string; questionKey: string }, value: Json) => void;
}) {
  const headingId = `section-${section.id}-heading`;
  const heading = section.isDefault
    ? null
    : section.title || "Seção sem título";

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
            return (
              <BlockRenderer
                key={item.id}
                item={item}
                imageUrls={imageUrls}
                value={answerable ? answers[item.id]?.value : undefined}
                error={answerable ? errors[item.id] : undefined}
                onChange={(value) =>
                  answerable &&
                  item.questionKey &&
                  onChange({ id: item.id, questionKey: item.questionKey }, value)
                }
              />
            );
          })
        )}
      </div>
    </section>
  );
}

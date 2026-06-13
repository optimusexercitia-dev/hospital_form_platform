"use client";

import { Pencil } from "lucide-react";

import type { Section } from "@/lib/queries/forms";
import { Button } from "@/components/ui/button";

import type { AnswerState } from "./types";
import { AnswerSummary } from "./answer-summary";
import { isInputItem } from "./use-wizard";

/**
 * Review screen scaffold (F5): every VISIBLE section with its answers, grouped
 * semantically — a `<section>` per form section with an `<h2>`, and the answers
 * in a `<fieldset>`/`<dl>`. Each section offers "Editar" to jump back to its
 * step. Submission (via `submitResponse`) and the confirmation screen are wired
 * when B3 lands; the submit affordance is rendered by the parent (`WizardClient`)
 * which owns the action state.
 *
 * `visibleSections` is the live list (conditional sections already filtered),
 * so the review faithfully shows only what will be submitted.
 */
export function ReviewScreen({
  visibleSections,
  answers,
  onEditSection,
  submitSlot,
}: {
  visibleSections: Section[];
  answers: AnswerState;
  onEditSection: (sectionId: string) => void;
  /** Submit button + server-rejection banner, owned by the parent (F5). */
  submitSlot?: React.ReactNode;
}) {
  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Revisão
        </span>
        <h2 className="text-2xl text-balance">Revise suas respostas</h2>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Confira as respostas abaixo antes de enviar. Após o envio, elas não
          poderão ser alteradas.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {visibleSections.map((section, index) => (
          <ReviewSection
            key={section.id}
            section={section}
            index={index}
            answers={answers}
            onEdit={() => onEditSection(section.id)}
          />
        ))}
      </div>

      {submitSlot}
    </div>
  );
}

function ReviewSection({
  section,
  index,
  answers,
  onEdit,
}: {
  section: Section;
  index: number;
  answers: AnswerState;
  onEdit: () => void;
}) {
  const headingId = `review-section-${section.id}`;
  const heading = section.isDefault
    ? "Respostas"
    : section.title || "Seção sem título";
  const inputItems = section.items.filter((it) => isInputItem(it.itemType));

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          {!section.isDefault && (
            <span className="text-xs font-medium text-muted-foreground">
              Seção {index + 1}
            </span>
          )}
          <h2 id={headingId} className="text-lg font-semibold">
            {heading}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onEdit}
        >
          <Pencil aria-hidden="true" />
          Editar
        </Button>
      </div>

      {inputItems.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Esta seção não tem perguntas.
        </p>
      ) : (
        <fieldset>
          <legend className="sr-only">{heading}</legend>
          <dl className="flex flex-col">
            {inputItems.map((item) => (
              <AnswerSummary
                key={item.id}
                item={item}
                value={answers[item.id]?.value}
              />
            ))}
          </dl>
        </fieldset>
      )}
    </section>
  );
}

"use client";

import { Pencil } from "lucide-react";

import type { Section } from "@/lib/queries/forms";
import { Button } from "@/components/ui/button";
import type { SectionSignoff } from "@/components/signoffs/types";

import type { AnswerState } from "./types";
import { AnswerSummary } from "./answer-summary";
import { RespondentSignoff } from "./respondent-signoff";
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
  signoffs,
  saving,
  onSignSection,
  onEditSection,
  phaseResultSlot,
  submitSlot,
}: {
  visibleSections: Section[];
  answers: AnswerState;
  /** Existing sign-off rows by section_id (F3). */
  signoffs: Record<string, SectionSignoff>;
  /** Whether an action (sign/submit) is in flight — disables the sign button. */
  saving: boolean;
  /** Record a respondent sign-off for a section (F3). */
  onSignSection: (sectionId: string, note: string | null) => void;
  onEditSection: (sectionId: string) => void;
  /**
   * The per-phase result panel (phase-results feature; task #8), a sibling of the
   * sign-off blocks — case-phase fills only; `null`/undefined for standalone forms.
   */
  phaseResultSlot?: React.ReactNode;
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
            signoff={signoffs[section.id] ?? null}
            saving={saving}
            onSign={(note) => onSignSection(section.id, note)}
            onEdit={() => onEditSection(section.id)}
          />
        ))}
      </div>

      {phaseResultSlot}

      {submitSlot}
    </div>
  );
}

function ReviewSection({
  section,
  index,
  answers,
  signoff,
  saving,
  onSign,
  onEdit,
}: {
  section: Section;
  index: number;
  answers: AnswerState;
  signoff: SectionSignoff | null;
  saving: boolean;
  onSign: (note: string | null) => void;
  onEdit: () => void;
}) {
  const headingId = `review-section-${section.id}`;
  // A named default section shows its title + eyebrow like any other section; an
  // untitled default keeps the neutral "Respostas" heading with no eyebrow.
  const showSectionNumber = Boolean(section.title) || !section.isDefault;
  const heading =
    section.title || (section.isDefault ? "Respostas" : "Seção sem título");
  const inputItems = section.items.filter((it) => isInputItem(it.itemType));

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            {showSectionNumber && (
              <span className="text-xs font-medium text-muted-foreground">
                Seção {index + 1}
              </span>
            )}
            {section.requiresSignoff && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-accent-foreground uppercase">
                assinatura
              </span>
            )}
          </div>
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

      {section.requiresSignoff && (
        <RespondentSignoff
          role={section.signoffRole}
          signoff={signoff}
          saving={saving}
          onSign={onSign}
        />
      )}
    </section>
  );
}

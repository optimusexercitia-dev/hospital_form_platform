"use client";

import { Pencil } from "lucide-react";

import type { Item, Section } from "@/lib/queries/forms";
import { Button } from "@/components/ui/button";
import type { SectionSignoff } from "@/components/signoffs/types";

import type { AnswerState } from "./types";
import { AnswerSummary } from "./answer-summary";
import { RespondentSignoff } from "./respondent-signoff";
import {
  survivingInstances,
  type InstancesByGroup,
  type InstanceState,
} from "./instances";
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
  visibleItemIds,
  visibleContainerIds,
  instancesByGroup,
  visibleItemIdsByInstance,
  answers,
  signoffs,
  saving,
  onSignSection,
  onEditSection,
  phaseResultSlot,
  submitSlot,
}: {
  visibleSections: Section[];
  /** Input item ids visible under item-level conditions
   *  (form-builder-enhancements); hidden items are not reviewed. */
  visibleItemIds: Set<string>;
  /** FF-1 - visible CONTAINER ids; a hidden group is not reviewed at all. */
  visibleContainerIds?: Set<string>;
  /** FF-1 - repeating-group instances by container item id, position-ordered. */
  instancesByGroup?: InstancesByGroup;
  /** FF-1 - per-instance visible child ids (the inside-out overlay result). */
  visibleItemIdsByInstance?: Map<string, Set<string>>;
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
            visibleItemIds={visibleItemIds}
            visibleContainerIds={visibleContainerIds}
            instancesByGroup={instancesByGroup}
            visibleItemIdsByInstance={visibleItemIdsByInstance}
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
  visibleItemIds,
  visibleContainerIds,
  instancesByGroup,
  visibleItemIdsByInstance,
  signoff,
  saving,
  onSign,
  onEdit,
}: {
  section: Section;
  index: number;
  answers: AnswerState;
  visibleItemIds: Set<string>;
  visibleContainerIds?: Set<string>;
  instancesByGroup?: InstancesByGroup;
  visibleItemIdsByInstance?: Map<string, Set<string>>;
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
  // FF-1 - the review is now GROUPED, mirroring how the form was filled: flat
  // questions and plain-`group` sub-sections read as one list of answers, while
  // each `repeating_group` is reviewed repetition by repetition. Only visible
  // items are reviewed (hidden ones collect no answer), and a hidden container
  // is skipped whole.
  const blocks = section.items.filter((item) => {
    if (item.itemType === "group" || item.itemType === "repeating_group") {
      return !visibleContainerIds || visibleContainerIds.has(item.id);
    }
    return isInputItem(item.itemType) && visibleItemIds.has(item.id);
  });

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

      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Esta seção não tem perguntas.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {blocks.map((block) => {
            if (block.itemType === "repeating_group") {
              return (
                <ReviewRepeatingGroup
                  key={block.id}
                  container={block}
                  instances={instancesByGroup?.[block.id] ?? []}
                  visibleItemIdsByInstance={visibleItemIdsByInstance}
                />
              );
            }
            if (block.itemType === "group") {
              return (
                <ReviewAnswerList
                  key={block.id}
                  heading={block.label ?? "Grupo"}
                  items={block.children.filter(
                    (child) =>
                      isInputItem(child.itemType) &&
                      visibleItemIds.has(child.id),
                  )}
                  answers={answers}
                />
              );
            }
            return (
              <fieldset key={block.id}>
                <legend className="sr-only">{heading}</legend>
                <dl className="flex flex-col">
                  <AnswerSummary
                    item={block}
                    value={answers[block.id]?.value}
                    observation={answers[block.id]?.observation}
                    otherText={answers[block.id]?.otherText}
                  />
                </dl>
              </fieldset>
            );
          })}
        </div>
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

/** A labelled list of answers - used for a plain `group` and for one
 *  repeating-group repetition, so both read identically in the review. */
function ReviewAnswerList({
  heading,
  items,
  answers,
}: {
  heading: string;
  items: Item[];
  answers: AnswerState;
}) {
  return (
    <fieldset className="rounded-xl border border-border bg-background/60 p-4">
      <legend className="px-1 text-sm font-semibold">{heading}</legend>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Nenhuma resposta neste grupo.
        </p>
      ) : (
        <dl className="flex flex-col">
          {items.map((item) => (
            <AnswerSummary
              key={item.id}
              item={item}
              value={answers[item.id]?.value}
              observation={answers[item.id]?.observation}
              otherText={answers[item.id]?.otherText}
            />
          ))}
        </dl>
      )}
    </fieldset>
  );
}

/**
 * FF-1 - a `repeating_group` reviewed repetition by repetition.
 *
 * Only the repetitions that will SURVIVE submit are shown: `submit_response`
 * prunes fully-empty instances before evaluating (ruling 3), so showing a blank
 * one here would promise the reviewer a row that is about to disappear.
 */
function ReviewRepeatingGroup({
  container,
  instances,
  visibleItemIdsByInstance,
}: {
  container: Item;
  instances: InstanceState[];
  visibleItemIdsByInstance?: Map<string, Set<string>>;
}) {
  const kept = survivingInstances(instances);
  const label = container.label ?? "Grupo repetível";

  if (kept.length === 0) {
    return (
      <fieldset className="rounded-xl border border-border bg-background/60 p-4">
        <legend className="px-1 text-sm font-semibold">{label}</legend>
        <p className="text-sm text-muted-foreground italic">
          Nenhuma repetição preenchida.
        </p>
      </fieldset>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {kept.map((instance, index) => (
        <ReviewAnswerList
          key={instance.id}
          heading={`${label} ${index + 1} de ${kept.length}`}
          items={container.children.filter((child) => {
            if (!isInputItem(child.itemType)) return false;
            const visible = visibleItemIdsByInstance?.get(instance.id);
            return !visible || visible.has(child.id);
          })}
          answers={instance.answers}
        />
      ))}
    </div>
  );
}

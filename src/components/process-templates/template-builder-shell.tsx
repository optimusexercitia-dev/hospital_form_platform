"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import type {
  ProcessTemplate,
  PhaseConditionTarget,
} from "@/lib/queries/process-templates";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { TemplateStatusBadge } from "@/components/process-templates/template-status-badge";
import { PhaseSlotCard } from "@/components/process-templates/phase-slot-card";
import { PhaseSlotDialog } from "@/components/process-templates/phase-slot-dialog";
import { PublishTemplateButton } from "@/components/process-templates/publish-template-button";
import { ArchiveTemplateButton } from "@/components/process-templates/archive-template-button";
import { attachTargets } from "@/components/process-templates/phase-with-targets";
import { useFlipReorder } from "@/components/forms/use-flip-reorder";

/** A publishable form the picker can bind a phase-slot to. */
export interface SlotForm {
  id: string;
  title: string;
}

/**
 * The interactive builder over one process template. Orchestrates the ordered
 * list of phase-slots; every mutation persists immediately via its own server
 * action and the view refreshes from the server (no client-side draft buffer) —
 * the same model as the form {@link BuilderShell}, minus the block/item layer
 * (a slot is a leaf node bound to a whole form).
 *
 * Editing is draft-only at the DB level: once the template is `active`, the slot
 * controls below are read-only (the RPCs reject non-draft edits). We reflect that
 * by disabling the add/edit/reorder affordances and hiding the publish button.
 */
export function TemplateBuilderShell({
  slug,
  template,
  forms,
  conditionTargetsByForm,
}: {
  slug: string;
  template: ProcessTemplate;
  forms: SlotForm[];
  /** `{ formId -> choice-question targets }` for every bound form (server-resolved). */
  conditionTargetsByForm: Record<string, PhaseConditionTarget[]>;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const { containerRef, captureBeforeReorder } =
    useFlipReorder<HTMLDivElement>();

  const isDraft = template.status === "draft";
  // Augment phases with their bound-form choice targets for the recommend editor.
  const phases = attachTargets(template.phases, conditionTargetsByForm);
  const hasForms = forms.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-3">
              <Link
                href={`/c/${slug}/manage/process-templates`}
                className="inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Processos
              </Link>
              <TemplateStatusBadge status={template.status} />
            </div>
            <h1 className="text-3xl text-balance">{template.title}</h1>
            {template.description && (
              <p className="max-w-prose text-muted-foreground text-pretty">
                {template.description}
              </p>
            )}
          </div>

          {isDraft && (
            <div className="flex shrink-0 items-center gap-2">
              <ArchiveTemplateButton templateId={template.id} />
              <PublishTemplateButton
                templateId={template.id}
                canPublish={phases.length > 0}
              />
            </div>
          )}
        </div>

        {!isDraft && (
          <FormBanner tone="info">
            Este processo está {template.status === "active" ? "ativo" : "arquivado"} e
            não pode mais ser editado. Os casos criados a partir dele preservam as
            fases definidas no momento da criação.
          </FormBanner>
        )}
      </header>

      {isDraft && !hasForms && (
        <FormBanner tone="info">
          Esta comissão ainda não tem formulários publicados. Publique ao menos um
          formulário antes de montar as fases do processo.
        </FormBanner>
      )}

      {phases.length === 0 ? (
        <section
          aria-label="Nenhuma fase"
          className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
        >
          <h2 className="text-lg font-semibold">Nenhuma fase ainda</h2>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            Adicione a primeira fase do processo escolhendo um formulário
            publicado.
          </p>
          {isDraft && (
            <div className="mt-2">
              <Button
                type="button"
                size="lg"
                onClick={() => setAddOpen(true)}
                disabled={!hasForms}
              >
                <Plus aria-hidden="true" />
                Adicionar fase
              </Button>
            </div>
          )}
        </section>
      ) : (
        <div ref={containerRef} className="flex flex-col gap-4">
          {phases.map((phase, index) => (
            <PhaseSlotCard
              key={phase.id}
              phase={phase}
              phases={phases}
              forms={forms}
              isFirst={index === 0}
              isLast={index === phases.length - 1}
              editable={isDraft}
              onBeforeReorder={captureBeforeReorder}
            />
          ))}
          {isDraft && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setAddOpen(true)}
              disabled={!hasForms}
              className="w-fit"
            >
              <Plus aria-hidden="true" />
              Adicionar fase
            </Button>
          )}
        </div>
      )}

      {isDraft && (
        <PhaseSlotDialog
          mode="create"
          open={addOpen}
          onOpenChange={setAddOpen}
          templateId={template.id}
          forms={forms}
          phases={phases}
        />
      )}
    </div>
  );
}

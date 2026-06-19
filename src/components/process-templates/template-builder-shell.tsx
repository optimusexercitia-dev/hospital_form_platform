"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Plus } from "lucide-react";

import type {
  ProcessTemplate,
  ProcessTemplateNarrative,
  PhaseConditionTarget,
} from "@/lib/queries/process-templates";
import type { CaseOutcome } from "@/lib/queries/case-outcomes";
import type { CaseNarrativeType } from "@/lib/queries/case-narratives";
import {
  reorderCaseLayout,
  removeTemplateNarrative,
} from "@/lib/case-narratives/actions";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { TemplateStatusBadge } from "@/components/process-templates/template-status-badge";
import { PhaseSlotCard } from "@/components/process-templates/phase-slot-card";
import { PhaseSlotDialog } from "@/components/process-templates/phase-slot-dialog";
import { NarrativeSlotCard } from "@/components/process-templates/narrative-slot-card";
import { NarrativeSlotDialog } from "@/components/process-templates/narrative-slot-dialog";
import { ProcessOutcomesPicker } from "@/components/process-templates/process-outcomes-picker";
import { PublishTemplateButton } from "@/components/process-templates/publish-template-button";
import { ArchiveTemplateButton } from "@/components/process-templates/archive-template-button";
import {
  attachTargets,
  type PhaseWithTargets,
} from "@/components/process-templates/phase-with-targets";
import { useFlipReorder } from "@/components/forms/use-flip-reorder";
import { useNarrativeAction } from "@/components/cases/use-narrative-action";

/** A publishable form the picker can bind a phase-slot to. */
export interface SlotForm {
  id: string;
  title: string;
}

/**
 * A merged builder-layout item: a phase-slot OR a narrative-slot, tagged by
 * `kind` and ordered by the shared `displayPosition` (the SAME comparator as
 * `mergeCaseLayout`). The phase variant carries its condition-target augmentation
 * for the recommend editor.
 */
type LayoutItem =
  | { kind: "phase"; sortKey: number; tiebreak: number; phase: PhaseWithTargets }
  | {
      kind: "narrative";
      sortKey: number;
      tiebreak: number;
      narrative: ProcessTemplateNarrative;
    };

/**
 * Build the ONE ordered phase+narrative list for the builder, mirroring
 * `mergeCaseLayout`'s rules: sort by `displayPosition` (a phase falls back to its
 * immutable `position` when `displayPosition` is null); on a tie a phase sorts
 * before a narrative, then by `position` (phases) / `displayPosition` then nothing
 * else (narratives). Defensive against gaps/duplicates — the interleave is
 * RPC-guaranteed, not DB-constrained.
 */
function mergeTemplateLayout(
  phases: PhaseWithTargets[],
  narratives: ProcessTemplateNarrative[],
): LayoutItem[] {
  const items: LayoutItem[] = [
    ...phases.map((phase): LayoutItem => ({
      kind: "phase",
      sortKey: phase.displayPosition ?? phase.position,
      tiebreak: phase.position,
      phase,
    })),
    ...narratives.map((narrative): LayoutItem => ({
      kind: "narrative",
      sortKey: narrative.displayPosition,
      tiebreak: narrative.displayPosition,
      narrative,
    })),
  ];
  return items.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    // Stable tiebreaker: phase before narrative, then by each kind's own order.
    if (a.kind !== b.kind) return a.kind === "phase" ? -1 : 1;
    return a.tiebreak - b.tiebreak;
  });
}

/** The `{kind,id}` of a merged item (the `reorderCaseLayout` payload entry). */
function itemRef(item: LayoutItem): { kind: "phase" | "narrative"; id: string } {
  return item.kind === "phase"
    ? { kind: "phase", id: item.phase.id }
    : { kind: "narrative", id: item.narrative.id };
}

/**
 * The interactive builder over one process template. Orchestrates the ordered
 * list of slots; every mutation persists immediately via its own server action
 * and the view refreshes from the server (no client-side draft buffer) — the same
 * model as the form {@link BuilderShell}, minus the block/item layer.
 *
 * With the Case Narratives increment (ADR 0032) the list is a single combined
 * sequence of phase-slots AND narrative-slots interleaved by `display_position`.
 * Reorder then renumbers BOTH tables via `reorderCaseLayout` (the phase `position`
 * — the immutable phase number referenced by blocks/recommend — is never touched).
 * When the feature is OFF (`narrativesEnabled=false`) the builder is exactly the
 * legacy phase-only list: `PhaseSlotCard` reorders via the per-table
 * `moveTemplatePhase` and there is no "Adicionar narrativa" affordance.
 *
 * Editing is draft-only at the DB level: once the template is `active`, the slot
 * controls below are read-only (the RPCs reject non-draft edits).
 */
export function TemplateBuilderShell({
  slug,
  template,
  forms,
  conditionTargetsByForm,
  outcomes,
  narrativeTypes,
  narrativesEnabled,
}: {
  slug: string;
  template: ProcessTemplate;
  forms: SlotForm[];
  /** `{ formId -> choice-question targets }` for every bound form (server-resolved). */
  conditionTargetsByForm: Record<string, PhaseConditionTarget[]>;
  /** The commission's non-archived outcome vocabulary (the offered-outcomes picker). */
  outcomes: CaseOutcome[];
  /** The commission's non-archived narrative vocabulary (the narrative-slot picker). */
  narrativeTypes: CaseNarrativeType[];
  /** Whether the `case_narratives` feature is on (gates the merged list + Add-narrativa). */
  narrativesEnabled: boolean;
}) {
  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [addNarrativeOpen, setAddNarrativeOpen] = useState(false);
  const { containerRef, captureBeforeReorder } =
    useFlipReorder<HTMLDivElement>();
  const { run: runReorder, isPending: reorderPending, error: reorderError } =
    useNarrativeAction();

  const isDraft = template.status === "draft";
  // Augment phases with their bound-form choice targets for the recommend editor.
  const phases = attachTargets(template.phases, conditionTargetsByForm);
  const hasForms = forms.length > 0;

  // The merged sequence (phases + narratives) when the feature is on; phase-only
  // otherwise. `mergeTemplateLayout` of phases + [] is just the phases in order.
  const items = mergeTemplateLayout(
    phases,
    narrativesEnabled ? template.narratives : [],
  );
  const hasItems = items.length > 0;

  /**
   * Persist a cross-table move of the item at `index` one step up/down by
   * rebuilding the full `{kind,id}` order and calling `reorderCaseLayout`. The
   * Flip capture runs first so the swap animates (best-effort).
   */
  function moveItem(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    captureBeforeReorder();
    runReorder(() => reorderCaseLayout(template.id, next.map(itemRef)));
  }

  function removeNarrative(narrativeId: string) {
    runReorder(() => removeTemplateNarrative(narrativeId));
  }

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

      {reorderError && <FormBanner tone="error">{reorderError}</FormBanner>}

      {!hasItems ? (
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
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="lg"
                onClick={() => setAddPhaseOpen(true)}
                disabled={!hasForms}
              >
                <Plus aria-hidden="true" />
                Adicionar fase
              </Button>
              {narrativesEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => setAddNarrativeOpen(true)}
                >
                  <FileText aria-hidden="true" />
                  Adicionar narrativa
                </Button>
              )}
            </div>
          )}
        </section>
      ) : (
        <div ref={containerRef} className="flex flex-col gap-4">
          {items.map((item, index) =>
            item.kind === "phase" ? (
              <PhaseSlotCard
                key={`phase-${item.phase.id}`}
                phase={item.phase}
                phases={phases}
                forms={forms}
                isFirst={index === 0}
                isLast={index === items.length - 1}
                editable={isDraft}
                onBeforeReorder={captureBeforeReorder}
                // Merged-layout reorder (cross-table) only when narratives are on;
                // otherwise the card keeps its legacy per-table `moveTemplatePhase`.
                onMove={
                  narrativesEnabled
                    ? (direction) => moveItem(index, direction)
                    : undefined
                }
                busy={narrativesEnabled ? reorderPending : undefined}
              />
            ) : (
              <NarrativeSlotCard
                key={`narrative-${item.narrative.id}`}
                narrative={item.narrative}
                narrativeTypes={narrativeTypes}
                isFirst={index === 0}
                isLast={index === items.length - 1}
                editable={isDraft}
                isPending={reorderPending}
                onMove={(direction) => moveItem(index, direction)}
                onRemove={() => removeNarrative(item.narrative.id)}
              />
            ),
          )}
          {isDraft && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setAddPhaseOpen(true)}
                disabled={!hasForms}
                className="w-fit"
              >
                <Plus aria-hidden="true" />
                Adicionar fase
              </Button>
              {narrativesEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => setAddNarrativeOpen(true)}
                  className="w-fit"
                >
                  <FileText aria-hidden="true" />
                  Adicionar narrativa
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {isDraft && (
        <ProcessOutcomesPicker
          commissionId={template.commissionId}
          templateId={template.id}
          outcomes={outcomes}
          offeredOutcomeIds={template.offeredOutcomeIds}
        />
      )}

      {isDraft && (
        <PhaseSlotDialog
          mode="create"
          open={addPhaseOpen}
          onOpenChange={setAddPhaseOpen}
          templateId={template.id}
          forms={forms}
          phases={phases}
        />
      )}

      {isDraft && narrativesEnabled && (
        <NarrativeSlotDialog
          mode="create"
          open={addNarrativeOpen}
          onOpenChange={setAddNarrativeOpen}
          templateId={template.id}
          narrativeTypes={narrativeTypes}
        />
      )}
    </div>
  );
}

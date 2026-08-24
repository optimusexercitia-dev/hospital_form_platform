"use client";

import { commissionHref } from "@/lib/routing";
import { cn } from "@/lib/utils";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Plus } from "lucide-react";

import type {
  ProcessTemplateWithVersion,
  ProcessTemplateNarrative,
  PhaseConditionTarget,
} from "@/lib/queries/process-templates";
import type { CaseOutcome } from "@/lib/queries/case-outcomes";
import type { CaseNarrativeType } from "@/lib/queries/case-narratives";
import type { PhaseResult } from "@/lib/queries/phase-results";
import {
  reorderCaseLayout,
  removeTemplateNarrative,
} from "@/lib/case-narratives/actions";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { TemplateVersionStatusBadge } from "@/components/process-templates/template-version-status-badge";
import { VersionHistoryPanel } from "@/components/process-templates/version-history-panel";
import { VersionWorkflowBanner } from "@/components/process-templates/version-workflow-banner";
import { BeginTemplateEditButton } from "@/components/process-templates/begin-template-edit-button";
import { DiscardTemplateDraftButton } from "@/components/process-templates/discard-template-draft-button";
import { PhaseSlotCard } from "@/components/process-templates/phase-slot-card";
import { PhaseSlotDialog } from "@/components/process-templates/phase-slot-dialog";
import { NarrativeSlotCard } from "@/components/process-templates/narrative-slot-card";
import { NarrativeSlotDialog } from "@/components/process-templates/narrative-slot-dialog";
import { ProcessOutcomesPicker } from "@/components/process-templates/process-outcomes-picker";
import { PublishedOutcomesCard } from "@/components/process-templates/published-outcomes-card";
import { PatientModePicker } from "@/components/process-templates/collects-patient-picker";
import { CaseTypePicker } from "@/components/process-templates/case-type-picker";
import type { CaseType } from "@/lib/cases/case-types";
import { CustomFieldsCard } from "@/components/process-templates/custom-fields-card";
import { PublishTemplateVersionButton } from "@/components/process-templates/publish-template-version-button";
import { ArchiveTemplateVersionsButton } from "@/components/process-templates/archive-template-versions-button";
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
 * Static — one builder shell mounts per page (the route renders exactly one
 * version), so a stable id keeps the work card's `aria-labelledby` simple. Mirrors
 * `case-phase-list.tsx`'s `WORK_HEADING_ID`.
 */
const TEMPLATE_WORK_HEADING_ID = "template-work-heading";

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
 * ## Versioning (ADR 0096)
 *
 * The shell renders ONE version of the template — the one the page resolved (from
 * `?v=`, else draft → published → newest). Editing is draft-only, and that is a DB
 * invariant, not a UI convention: every authoring RPC refuses a non-draft version.
 * So `editable` is read from the version rather than recomputed here — a UI that
 * disagreed with the substrate would produce a pt-BR error, never a silent write.
 *
 * Two grains coexist and must not be confused:
 *  - **identity** (`data.template.id`) — "edit this process" and "archive this
 *    process" act on the template across all its versions;
 *  - **version** (`data.version.id`) — publish, discard, and EVERY child-authoring
 *    action act on one version, and are refused unless it is the draft.
 */
export function TemplateBuilderShell({
  org,
  slug,
  data,
  forms,
  conditionTargetsByForm,
  outcomes,
  narrativeTypes,
  narrativesEnabled,
  casePatientEnabled,
  caseCustomFieldsEnabled = false,
  phaseResultsEnabled = false,
  phaseResults = [],
  caseTypesEnabled = false,
  caseTypes = [],
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  /** The template identity, the version in view, and the history for the picker. */
  data: ProcessTemplateWithVersion;
  forms: SlotForm[];
  /**
   * `{ formId -> choice-question targets }` for every bound + publishable form
   * (server-resolved). Powers the recommend_when editor (earlier phases) and the
   * per-phase result-ruleset editor (the form selected in the slot dialog).
   */
  conditionTargetsByForm: Record<string, PhaseConditionTarget[]>;
  /** The commission's non-archived outcome vocabulary (the offered-outcomes picker). */
  outcomes: CaseOutcome[];
  /** The commission's non-archived narrative vocabulary (the narrative-slot picker). */
  narrativeTypes: CaseNarrativeType[];
  /** Whether the `case_narratives` feature is on (gates the merged list + Add-narrativa). */
  narrativesEnabled: boolean;
  /** Whether the `case_patient` feature is on (gates the draft-only collects-patient toggle; ADR 0038). */
  casePatientEnabled: boolean;
  /** Whether the `case_custom_fields` feature is on (gates the custom-fields card; ADR 0083). */
  caseCustomFieldsEnabled?: boolean;
  /** Whether the `case_phase_results` feature is on (gates the per-phase result-ruleset editor). */
  phaseResultsEnabled?: boolean;
  /** The commission's active result vocabulary (the ruleset editor's option pickers). */
  phaseResults?: PhaseResult[];
  /** Whether the `case_types` feature is on (gates the case-type picker; ADR 0064 D4). */
  caseTypesEnabled?: boolean;
  /** The organization's ACTIVE case types (the picker's options). */
  caseTypes?: CaseType[];
}) {
  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [addNarrativeOpen, setAddNarrativeOpen] = useState(false);
  const { containerRef, captureBeforeReorder } =
    useFlipReorder<HTMLDivElement>();
  const { run: runReorder, isPending: reorderPending, error: reorderError } =
    useNarrativeAction();

  const { template, version, versions, publishedVersionId, draftVersionId } = data;

  // Mirrored from the DB (`status === 'draft'`), never recomputed — see the docs.
  const isDraft = version.editable;
  // Augment phases with their bound-form choice targets for the recommend editor.
  const phases = attachTargets(version.phases, conditionTargetsByForm);
  const hasForms = forms.length > 0;

  const templatePath = commissionHref(
    org,
    slug,
    "manage",
    "process-templates",
    template.id,
  );
  const listPath = commissionHref(org, slug, "manage", "process-templates");

  // Version-picker cross-links. Each is `null` when it IS the version in view, so
  // the banner never offers a link back to the page you are already on.
  const published = versions.find((v) => v.id === publishedVersionId) ?? null;
  const draft = versions.find((v) => v.id === draftVersionId) ?? null;
  const otherPublished = published && published.id !== version.id ? published : null;
  const otherDraft = draft && draft.id !== version.id ? draft : null;

  // The right-hand rail: version history (always) + the per-case DATA-COLLECTION
  // config (feature-gated). History makes the rail unconditional — versioning is
  // the point of this screen, so the picker is never hidden.
  // ⚠ FLAG ONLY — the `isDraft` arm was removed 2026-08-24; the card must survive
  // publication (see its mount below). `editable={isDraft}` carries the draft rule.
  const showPatientMode = casePatientEnabled;

  // The merged sequence (phases + narratives) when the feature is on; phase-only
  // otherwise. `mergeTemplateLayout` of phases + [] is just the phases in order.
  const items = mergeTemplateLayout(
    phases,
    narrativesEnabled ? version.narratives : [],
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
    runReorder(() => reorderCaseLayout(version.id, next.map(itemRef)));
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
                href={commissionHref(org, slug, "manage", "process-templates")}
                className="inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Processos
              </Link>
              <span className="font-mono text-sm text-muted-foreground">
                v{version.versionNumber}
              </span>
              <TemplateVersionStatusBadge status={version.status} />
            </div>
            <h1 className="text-3xl text-balance">{version.title}</h1>
            {version.description && (
              <p className="max-w-prose text-muted-foreground text-pretty">
                {version.description}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {/* Draft: finish or abandon THIS version. Non-draft: the only way
                forward is to fork, which is what BeginTemplateEditButton explains. */}
            {isDraft ? (
              <>
                <DiscardTemplateDraftButton
                  templateVersionId={version.id}
                  versionNumber={version.versionNumber}
                  templatePath={templatePath}
                  publishedVersionId={publishedVersionId}
                  publishedVersionNumber={published?.versionNumber ?? null}
                />
                <PublishTemplateVersionButton
                  templateVersionId={version.id}
                  versionNumber={version.versionNumber}
                  supersededVersionNumber={otherPublished?.versionNumber ?? null}
                  canPublish={phases.length > 0}
                />
              </>
            ) : (
              <BeginTemplateEditButton
                templateId={template.id}
                templatePath={templatePath}
                existingDraftVersionNumber={draft?.versionNumber ?? null}
                publishedVersionNumber={published?.versionNumber ?? null}
              />
            )}
            <ArchiveTemplateVersionsButton
              templateId={template.id}
              listPath={listPath}
            />
          </div>
        </div>

        {/* The D2 workflow, explained in place — see VersionWorkflowBanner. */}
        <VersionWorkflowBanner
          status={version.status}
          versionNumber={version.versionNumber}
          caseCount={version.caseCount}
          publishedVersionNumber={published?.versionNumber ?? null}
          publishedVersionHref={
            otherPublished ? `${templatePath}?v=${otherPublished.id}` : null
          }
          draftVersionNumber={otherDraft?.versionNumber ?? null}
          draftVersionHref={otherDraft ? `${templatePath}?v=${otherDraft.id}` : null}
        />
      </header>

      {isDraft && !hasForms && (
        <FormBanner tone="info">
          Esta comissão ainda não tem formulários publicados. Publique ao menos um
          formulário antes de montar as fases do processo.
        </FormBanner>
      )}

      {reorderError && <FormBanner tone="error">{reorderError}</FormBanner>}

      {/* Two-column workspace, mirroring the case detail page: the process CONTENT
          (its type, the phase/narrative sequence, the offered outcomes) on the left;
          the per-case data-collection config in a narrow reference rail on the right.
          The rail stacks under the main column below `lg`. */}
      <div
        className={cn(
          "flex flex-col gap-6",
          "lg:grid lg:grid-cols-[minmax(0,1fr)_384px] lg:items-start lg:gap-8",
        )}
      >
        <div className="flex flex-col gap-6">
          {/* ADR 0137 **D14** — the template DECLARES the case type its cases inherit
              (and with it their default visibility/confidentiality), and that
              declaration is now DRAFT-ONLY like every other authoring control here.
              ⛔ The comment that stood in this spot attributed the OPPOSITE rule
              ("Not draft-gated: … a live untyped process must stay fixable") to
              **ADR 0064 D4**. ⚠ D14 justified the reversal by claiming ADR 0064
              carries no numbered decisions at all — MEASURED FALSE at QA (C-4): it
              carries `Decision 1`…`Decision 4`. What survives is the CONCLUSION on
              a different premise: Decision 4 defines the `case_types` table and says
              nothing about WHEN the picker is editable, so the draft-gating rule did
              live only in that comment and D14 is the first ratified rule on the
              question. D14 accepts the risk the comment named: a published Process
              with `case_type_id = null` becomes unfixable in place and must be
              re-drafted to be typed.
              Leads the column: it frames every phase below it. */}
          {caseTypesEnabled && (
            <CaseTypePicker
              templateVersionId={version.id}
              caseTypeId={version.caseTypeId}
              caseTypes={caseTypes}
              editable={isDraft}
            />
          )}

          {/* The process's WORK ZONE (ADR 0137 **D13**) — the same titled frame as the
              case's "Trabalho do caso", so a coordinator reads a template and the
              cases it mints in the same shape. The slot cards nest INSIDE it and the
              authoring pair sits in its bordered footer.
              ⛔ SHELL ONLY: no progress meter and no status bar. A template has no
              progress to report — the case card's ratio counts CONCLUDED work, and a
              slot DEFINITION is never concluded, so a copied meter would read a
              permanent "0 de N". */}
          <section
            aria-labelledby={TEMPLATE_WORK_HEADING_ID}
            className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5"
          >
            <header className="border-b border-border pb-4">
              <h2
                id={TEMPLATE_WORK_HEADING_ID}
                className="text-base font-semibold"
              >
                Trabalho do processo
              </h2>
              <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
                Fases e narrativas que cada caso deste processo receberá
              </p>
            </header>

            {!hasItems ? (
              <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-pretty text-muted-foreground">
                Nenhuma fase ou narrativa neste processo ainda. Adicione a primeira
                escolhendo um formulário publicado.
              </p>
            ) : (
              <div ref={containerRef} className="mt-4 flex flex-col gap-4">
              {items.map((item, index) =>
                item.kind === "phase" ? (
                  <PhaseSlotCard
                    key={`phase-${item.phase.id}`}
                    phase={item.phase}
                    phases={phases}
                    forms={forms}
                    conditionTargetsByForm={conditionTargetsByForm}
                    phaseResults={phaseResults}
                    phaseResultsEnabled={phaseResultsEnabled}
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
              </div>
            )}

            {/* Authoring footer — the SINGLE "Adicionar fase" / "Adicionar narrativa"
                pair, whether the list is empty or not (it used to be duplicated
                between the empty state and the end of the list). Mirrors the case
                work card's footer: bordered, below the list, `outline`/`sm`.
                Draft-only, because every authoring RPC refuses a non-draft version —
                a DB invariant, not a UI convention. */}
            {isDraft && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
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
                    size="sm"
                    onClick={() => setAddNarrativeOpen(true)}
                    className="w-fit"
                  >
                    <FileText aria-hidden="true" />
                    Adicionar narrativa
                  </Button>
                )}
              </div>
            )}
          </section>

          {isDraft && (
            <ProcessOutcomesPicker
              commissionId={version.commissionId}
              templateVersionId={version.id}
              outcomes={outcomes}
              offeredOutcomeIds={version.offeredOutcomeIds}
            />
          )}

          {/* Published/archived process: the offered outcomes are frozen — show them
              read-only (the editable picker only mounts for drafts). */}
          {!isDraft && (
            <PublishedOutcomesCard
              outcomes={outcomes}
              offeredOutcomeIds={version.offeredOutcomeIds}
            />
          )}
        </div>

        {/* The rail is now UNCONDITIONAL: version history is the point of this
            screen, so the picker is never hidden behind a feature flag. The
            data-collection cards below it stay feature-gated as before. */}
        <aside aria-label="Versões e dados do processo" className="flex flex-col gap-4">
          <VersionHistoryPanel
            org={org}
            slug={slug}
            templateId={template.id}
            versions={versions}
            currentVersionId={version.id}
          />

          {/* ADR 0137 **D1/D2** — the three-mode PHI collection setting plus, in
              `required` mode, the field set the case must carry. This is the ONLY
              user-reachable channel to `patient_mode = 'required'`; the DB, the
              minting DEFINERs and the pgTAP suite supported the mode while nothing
              in the product could select it (QA C-1).

              ⛔ NOT draft-gated any more (2026-08-24). It used to mount only while
              `isDraft`, so the moment a coordinator PUBLISHED the version the card
              vanished — and with it the only statement of whether cases from this
              process carry patient identifiers at all. That is a fact about every
              case the version mints, so it must stay readable for the version's whole
              life; `editable` now carries the draft rule instead, matching
              `CustomFieldsCard` and the outcomes picker → published-card pair. It
              renders for `none` too: "does this process collect PHI?" is a question
              whose answer is worth stating even when the answer is no.

              It leads the data-collection pair because PHI outranks custom fields. */}
          {showPatientMode && (
            <PatientModePicker
              templateVersionId={version.id}
              patientMode={version.patientMode}
              patientRequiredFields={version.patientRequiredFields}
              editable={isDraft}
            />
          )}

          {/* Custom fields (ADR 0083) — editable while draft, read-only once published
              (mirrors the outcomes picker → published-card treatment). */}
          {caseCustomFieldsEnabled && (
            <CustomFieldsCard
              templateVersionId={version.id}
              fields={version.customFields}
              editable={isDraft}
            />
          )}
        </aside>
      </div>

      {/* Both create-mode dialogs author CHILDREN of the version, so they take
          `version.id` — and only ever mount while `isDraft`, because every
          authoring RPC refuses a non-draft version anyway. */}
      {isDraft && (
        <PhaseSlotDialog
          mode="create"
          open={addPhaseOpen}
          onOpenChange={setAddPhaseOpen}
          templateVersionId={version.id}
          forms={forms}
          phases={phases}
          conditionTargetsByForm={conditionTargetsByForm}
          phaseResults={phaseResults}
          phaseResultsEnabled={phaseResultsEnabled}
        />
      )}

      {isDraft && narrativesEnabled && (
        <NarrativeSlotDialog
          mode="create"
          open={addNarrativeOpen}
          onOpenChange={setAddNarrativeOpen}
          templateVersionId={version.id}
          narrativeTypes={narrativeTypes}
        />
      )}
    </div>
  );
}

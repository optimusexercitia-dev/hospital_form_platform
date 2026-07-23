"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Layers, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { commissionHref } from "@/lib/routing";
// Type-only — the action is passed in as a prop (WizardRunner boundary); this client
// component never value-imports the `"use server"` module or a server query module.
import type {
  BulkCaseRow,
  BulkCreateCasesInput,
} from "@/lib/cases/bulk-actions";
import { balancedDeal } from "@/lib/cases/distribute";
import {
  DEFAULT_PHI_KEYS,
  buildTargetColumns,
  makeEmptyRow,
  phiSelectionValid,
  serializeDraftCase,
  validateGrid,
  type BulkGridRow,
} from "@/lib/cases/bulk-grid-model";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { CaseBulkGrid } from "@/components/cases/case-bulk-grid";
import { BulkStepProcess } from "@/components/cases/bulk-step-process";
import { BulkStepMembers } from "@/components/cases/bulk-step-members";
import { BulkStepDeal } from "@/components/cases/bulk-step-deal";
import {
  type BulkCreateAction,
  type BulkMember,
  type BulkTemplateOption,
  type PhaseScope,
} from "@/components/cases/bulk-create-types";

const STEPS = [
  { label: "Processo" },
  { label: "Responsáveis" },
  { label: "Casos" },
  { label: "Distribuição" },
];

const GRID_STEP = 2;
const DEAL_STEP = 3;

/**
 * "Múltiplos casos" — the full-page bulk-case wizard (ADR 0084), cloning the
 * documents `create-wizard` skeleton (Stepper, step state, `runAction` transition,
 * ChecklistRail). Four steps: pick the process + columns + deadline + scope, choose
 * the members, fill the grid (paste-friendly), then preview + commit the balanced
 * deal. The deal is computed here; the server action executes the exact owner map.
 */
export function BulkCreateWizard({
  org,
  slug,
  templates,
  members,
  action,
  casePatientEnabled,
  caseCustomFieldsEnabled,
  casesMultiPhaseEnabled,
  caseNarrativesEnabled,
}: {
  org: string;
  slug: string;
  templates: BulkTemplateOption[];
  members: BulkMember[];
  action: BulkCreateAction;
  casePatientEnabled: boolean;
  caseCustomFieldsEnabled: boolean;
  casesMultiPhaseEnabled: boolean;
  caseNarrativesEnabled: boolean;
}) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);

  // Step 1 — process + config.
  const [templateId, setTemplateId] = useState("");
  const [selectedOptionalKeys, setSelectedOptionalKeys] = useState<Set<string>>(
    new Set(),
  );
  const [deadline, setDeadline] = useState("");
  const [phaseScope, setPhaseScope] = useState<PhaseScope>("first_only");
  const [labelPrefix, setLabelPrefix] = useState("");
  // Selected PHI columns (E1) — default the common minimum-necessary pair.
  const [selectedPhiKeys, setSelectedPhiKeys] = useState<Set<string>>(
    () => new Set(DEFAULT_PHI_KEYS),
  );

  // Step 2 — members (default ALL).
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    () => new Set(members.map((m) => m.userId)),
  );

  // Step 3 — the grid (seed a few empty rows so it is never blank).
  const [rows, setRows] = useState<BulkGridRow[]>(() => [
    makeEmptyRow(),
    makeEmptyRow(),
    makeEmptyRow(),
  ]);

  // Step 4 — the deal (owner per row, parallel to `rows`).
  const [owners, setOwners] = useState<string[]>([]);

  const [banner, setBanner] = useState<string | null>(null);
  const [highlightRow, setHighlightRow] = useState<number | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  // The chosen custom-field columns: required ∪ selected-optional, in template order.
  const chosenFields = useMemo(() => {
    if (!caseCustomFieldsEnabled || !selectedTemplate) return [];
    return selectedTemplate.customFields.filter(
      (f) => f.required || selectedOptionalKeys.has(f.key),
    );
  }, [caseCustomFieldsEnabled, selectedTemplate, selectedOptionalKeys]);

  const chosenFieldKeys = useMemo(
    () => chosenFields.map((f) => f.key),
    [chosenFields],
  );
  const requiredKeys = useMemo(
    () => chosenFields.filter((f) => f.required).map((f) => f.key),
    [chosenFields],
  );

  const collectsPhi = Boolean(
    casePatientEnabled && selectedTemplate?.collectsPatient,
  );

  const columns = useMemo(
    () => buildTargetColumns(chosenFields, collectsPhi, selectedPhiKeys),
    [chosenFields, collectsPhi, selectedPhiKeys],
  );

  const validation = useMemo(
    () => validateGrid(rows, requiredKeys, labelPrefix),
    [rows, requiredKeys, labelPrefix],
  );

  const selectedMembers = useMemo(
    () => members.filter((m) => selectedMemberIds.has(m.userId)),
    [members, selectedMemberIds],
  );

  // Step 1 also enforces the PHI column-selection floor (E1): if the template
  // collects PHI and any identifier column is selected, Nome or Prontuário must be
  // among them (zero PHI columns is valid — no identifiers collected).
  const phiSelectionOk = !collectsPhi || phiSelectionValid(selectedPhiKeys);

  const stepValid = [
    templateId !== "" && phiSelectionOk,
    selectedMembers.length > 0,
    validation.canAdvance,
    owners.length === rows.length && owners.every(Boolean),
  ];

  const effectivePreviewScope: PhaseScope = casesMultiPhaseEnabled
    ? phaseScope
    : "first_only";

  const checklist: BulkChecklistItem[] = [
    { label: "Processo selecionado", done: templateId !== "" },
    { label: "Ao menos um responsável", done: selectedMembers.length > 0 },
    { label: `Casos preenchidos (${rows.length})`, done: validation.canAdvance },
  ];

  function focusHeading() {
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function deal() {
    const memberIds = selectedMembers.map((m) => m.userId);
    if (memberIds.length === 0 || rows.length === 0) {
      setOwners([]);
      return;
    }
    setOwners(balancedDeal(rows.length, memberIds));
  }

  function goTo(next: number) {
    // Entering the deal step (forward OR via a Stepper jump) always re-deals for
    // the current rows + members, so the preview never shows a stale owner map.
    if (next === DEAL_STEP) deal();
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
    focusHeading();
  }

  function goNext() {
    if (step >= STEPS.length - 1 || !stepValid[step]) return;
    goTo(step + 1);
  }

  function goBack() {
    if (step > 0) goTo(step - 1);
  }

  function changeTemplate(id: string) {
    setTemplateId(id);
    setSelectedOptionalKeys(new Set());
    setSelectedPhiKeys(new Set(DEFAULT_PHI_KEYS));
  }

  function toggleField(key: string) {
    setSelectedOptionalKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function togglePhi(key: string) {
    setSelectedPhiKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleMember(userId: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function overrideOwner(rowIndex: number, userId: string) {
    setOwners((prev) => {
      const next = prev.slice();
      next[rowIndex] = userId;
      return next;
    });
  }

  // Functional updater (stable) so the memoized grid rows keep referentially-equal
  // callbacks; any edit clears a stale server row-highlight.
  const updateRows = useCallback(
    (updater: (prev: BulkGridRow[]) => BulkGridRow[]) => {
      setRows(updater);
      setHighlightRow((h) => (h != null ? null : h));
    },
    [],
  );

  function commit() {
    setBanner(null);
    const effectiveScope: PhaseScope = casesMultiPhaseEnabled
      ? phaseScope
      : "first_only";
    const payloadRows: BulkCaseRow[] = rows.map((row, i) => {
      const draft = serializeDraftCase(
        row,
        labelPrefix,
        i + 1,
        chosenFieldKeys,
        collectsPhi,
      );
      return {
        label: draft.label,
        assignedTo: owners[i],
        customFields: draft.customFields,
        patient: draft.patient,
      };
    });
    const input: BulkCreateCasesInput = {
      templateId,
      deadline: deadline.trim() || null,
      phaseScope: effectiveScope,
      rows: payloadRows,
    };

    startTransition(async () => {
      const result = await action(input);
      if (result.ok) {
        router.push(
          `${commissionHref(org, slug, "manage", "cases")}?criados=${result.createdCount}`,
        );
        return;
      }
      setBanner(result.error);
      if (result.failedRowIndex != null) {
        setHighlightRow(result.failedRowIndex);
        goTo(GRID_STEP);
      }
    });
  }

  const cancelHref = commissionHref(org, slug, "manage", "cases");
  const readyToCommit = stepValid.every(Boolean);

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-5">
        <Stepper
          steps={STEPS}
          current={step}
          maxReached={maxReached}
          onStepClick={(i) => goTo(i)}
        />

        {banner ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
          >
            {banner}
          </p>
        ) : null}

        <section
          key={step}
          className="animate-fade-in flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
        >
          {step === 0 ? (
            <BulkStepProcess
              headingRef={headingRef}
              templates={templates}
              templateId={templateId}
              onTemplateChange={changeTemplate}
              selectedOptionalKeys={selectedOptionalKeys}
              onToggleField={toggleField}
              selectedPhiKeys={selectedPhiKeys}
              onTogglePhi={togglePhi}
              deadline={deadline}
              onDeadlineChange={setDeadline}
              phaseScope={phaseScope}
              onPhaseScopeChange={setPhaseScope}
              labelPrefix={labelPrefix}
              onLabelPrefixChange={setLabelPrefix}
              casePatientEnabled={casePatientEnabled}
              caseCustomFieldsEnabled={caseCustomFieldsEnabled}
              casesMultiPhaseEnabled={casesMultiPhaseEnabled}
              caseNarrativesEnabled={caseNarrativesEnabled}
            />
          ) : null}

          {step === 1 ? (
            <BulkStepMembers
              headingRef={headingRef}
              members={members}
              selectedIds={selectedMemberIds}
              onToggle={toggleMember}
              onSelectAll={() =>
                setSelectedMemberIds(new Set(members.map((m) => m.userId)))
              }
              onSelectNone={() => setSelectedMemberIds(new Set())}
            />
          ) : null}

          {step === GRID_STEP ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-lg font-semibold outline-none"
                >
                  Casos do lote
                </h2>
                <p className="text-sm text-muted-foreground">
                  Preencha uma linha por caso. Cole de uma planilha para agilizar.
                </p>
              </div>
              <CaseBulkGrid
                rows={rows}
                onRowsChange={updateRows}
                columns={columns}
                labelPrefix={labelPrefix}
                validation={validation}
                highlightRowNumber={highlightRow}
              />
            </div>
          ) : null}

          {step === 3 ? (
            <BulkStepDeal
              headingRef={headingRef}
              rows={rows}
              labelPrefix={labelPrefix}
              owners={owners}
              members={selectedMembers}
              onReshuffle={deal}
              onOverride={overrideOwner}
              deadline={deadline.trim() || null}
              phaseScope={casesMultiPhaseEnabled ? phaseScope : "first_only"}
            />
          ) : null}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="lg">
            <a href={cancelHref}>Cancelar</a>
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={goBack}
                disabled={isPending}
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Voltar
              </Button>
            ) : null}

            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                size="lg"
                onClick={goNext}
                disabled={!stepValid[step]}
              >
                Continuar
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={commit}
                disabled={isPending || !readyToCommit}
              >
                <Layers aria-hidden="true" className="size-4" />
                {isPending ? "Criando…" : `Criar ${rows.length} casos`}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="lg:sticky lg:top-6">
        <BulkRail items={checklist} phaseScope={effectivePreviewScope} hasDeadline={deadline.trim() !== ""} />
      </div>
    </div>
  );
}

/** One readiness item in the right rail. */
interface BulkChecklistItem {
  label: string;
  done: boolean;
}

/**
 * The bulk wizard's right rail: a "Pronto para criar" progress card + a short
 * "Como funciona" explainer specific to bulk creation (the documents ChecklistRail's
 * explainer is approval-specific, so it is not reused here).
 */
function BulkRail({
  items,
  phaseScope,
  hasDeadline,
}: {
  items: BulkChecklistItem[];
  phaseScope: PhaseScope;
  hasDeadline: boolean;
}) {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const complete = done === total && total > 0;

  return (
    <aside className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Pronto para criar</h3>
          <span
            className={cn(
              "font-mono text-sm tabular-nums",
              complete ? "text-success" : "text-muted-foreground",
            )}
          >
            {percent}%
          </span>
        </div>
        <div
          className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso do lote"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-[--dur-base] ease-[--ease-out-soft]",
              complete ? "bg-success" : "bg-primary",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        <ul className="mt-4 flex flex-col gap-2.5">
          {items.map((item) => (
            <li key={item.label} className="flex items-center gap-2.5 text-sm">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                  item.done
                    ? "border-success bg-success text-success-foreground"
                    : "border-border bg-card",
                )}
              >
                {item.done ? <Check className="size-3" /> : null}
              </span>
              <span
                className={cn(
                  item.done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-muted/20 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles aria-hidden="true" className="size-4 text-primary" />
          Como funciona
        </h3>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-xs text-muted-foreground text-pretty">
          <li>A criação é feita de uma vez — tudo ou nada.</li>
          <li>Cada caso pertence inteiramente a um responsável.</li>
          <li>
            {phaseScope === "all_phases"
              ? "Todas as fases são pré-atribuídas ao responsável do caso."
              : "A primeira fase é ativada e atribuída ao responsável."}
          </li>
          {hasDeadline ? <li>O prazo se aplica à primeira fase de cada caso.</li> : null}
        </ul>
      </div>
    </aside>
  );
}

"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Layers,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

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
  requiredPhiColumns,
  rowHasAnyPhi,
  serializeDraftCase,
  validateGrid,
  type BulkGridRow,
} from "@/lib/cases/bulk-grid-model";
import { PATIENT_REQUIRED_FIELD_LABELS } from "@/components/safety/patient-fields";
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
  canUseAllPhases,
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
  /**
   * Whether the caller may choose the `all_phases` scope — coordinator-only, mirroring
   * a refusal `bulk_create_cases` already makes at its gate (ADR 0134 Amendment 7).
   */
  canUseAllPhases: boolean;
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
    casePatientEnabled && selectedTemplate && selectedTemplate.patientMode !== "none",
  );

  // ADR 0137 D2/D3, bulk path. Empty unless the chosen process is `'required'`, so
  // every batch from an `optional` template behaves exactly as before.
  const requiredPhiFields = useMemo(
    () =>
      collectsPhi && selectedTemplate?.patientMode === "required"
        ? selectedTemplate.patientRequiredFields
        : [],
    [collectsPhi, selectedTemplate],
  );

  // The columns a `required` template FORCES into the selection. Welded, not merely
  // pre-ticked: `bulk-step-process.tsx` renders them `aria-disabled` and refuses the
  // toggle, mirroring how the builder welds `mrn`. Deselecting one would offer a
  // batch the door is guaranteed to refuse.
  const weldedPhiKeys = useMemo(
    () => requiredPhiColumns(requiredPhiFields),
    [requiredPhiFields],
  );

  // ⛔ Derived, NOT a second piece of state. Seeding `selectedPhiKeys` in an effect
  // when the template changes would leave a render in which the grid's columns and
  // the validator disagree about which identifiers this batch collects — and the
  // reconciliation would be invisible in every test that renders once.
  const effectivePhiKeys = useMemo(() => {
    if (weldedPhiKeys.length === 0) return selectedPhiKeys;
    return new Set<string>([...selectedPhiKeys, ...weldedPhiKeys]);
  }, [selectedPhiKeys, weldedPhiKeys]);

  const columns = useMemo(
    () => buildTargetColumns(chosenFields, collectsPhi, effectivePhiKeys),
    [chosenFields, collectsPhi, effectivePhiKeys],
  );

  const validation = useMemo(
    () => validateGrid(rows, requiredKeys, labelPrefix, requiredPhiFields),
    [rows, requiredKeys, labelPrefix, requiredPhiFields],
  );

  /** 1-based row numbers short of a required identifier — drives the grid summary. */
  const phiIncompleteRows = useMemo(
    () =>
      validation.invalidRows
        .filter((iv) => iv.missingRequiredPhi.length > 0)
        .map((iv) => iv.index + 1),
    [validation.invalidRows],
  );

  const selectedMembers = useMemo(
    () => members.filter((m) => selectedMemberIds.has(m.userId)),
    [members, selectedMemberIds],
  );

  // Step 1 also enforces the PHI column-selection floor (E1): if the template
  // collects PHI and any identifier column is selected, Nome or Prontuário must be
  // among them (zero PHI columns is valid — no identifiers collected).
  // ⚠ Over the EFFECTIVE set, not the raw one: on a `required` template the welded
  // columns are part of what this batch collects, and checking the raw set would let
  // step 1 advance on a floor the grid does not actually stand on.
  const phiSelectionOk = !collectsPhi || phiSelectionValid(effectivePhiKeys);
  /**
   * How many rows actually carry identifiers — drives the A2.4 review note.
   * `rowHasAnyPhi` is the grid model's own predicate; do not re-express the
   * name-or-MRN floor here, or the note and the validator can disagree.
   */
  const rowsWithPatient = collectsPhi
    ? rows.filter((row) => rowHasAnyPhi(row.patient)).length
    : 0;

  const stepValid = [
    templateId !== "" && phiSelectionOk,
    selectedMembers.length > 0,
    validation.canAdvance,
    owners.length === rows.length && owners.every(Boolean),
  ];

  /**
   * ⛔ ONE derivation, used by the rail preview, the "Distribuição" step AND the
   * committed payload — they were three separate expressions, which is how a preview
   * comes to describe something other than what is submitted.
   *
   * `canUseAllPhases` is enforced HERE, not only by hiding the option in step 1:
   * hiding is a rendering decision, and a `phaseScope` already sitting in state would
   * otherwise still be submitted. The door refuses it regardless (Rule 1) — this just
   * means the wizard never asks for something guaranteed to be refused.
   */
  const effectiveScope: PhaseScope =
    casesMultiPhaseEnabled && canUseAllPhases ? phaseScope : "first_only";

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
    // Welded by the template's `required` mode — refused here as well as in the
    // renderer, so a stale click or a keyboard Space cannot strip a column the door
    // will then demand. Mirrors the builder's `mrn` weld.
    if (weldedPhiKeys.includes(key as (typeof weldedPhiKeys)[number])) return;
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
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
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
              selectedPhiKeys={effectivePhiKeys}
              weldedPhiKeys={weldedPhiKeys}
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
              canUseAllPhases={canUseAllPhases}
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
              {/* ADR 0137 D2/D3 (bulk). NAMES the fields and the row numbers rather
                  than only greying "Avançar" — on a 200-row grid an unexplained
                  disabled button is indistinguishable from a broken one. `role=
                  "status"` (polite): it updates on every keystroke, and an assertive
                  region would interrupt typing.
                  ⛔ The cell rings are the per-row half; this is the summary. Both,
                  because one of 1 200 cells is not findable by scanning. */}
              {phiIncompleteRows.length > 0 ? (
                <p role="status" className="text-sm font-medium text-muted-foreground">
                  Este processo exige{" "}
                  {requiredPhiFields
                    .map((f) => PATIENT_REQUIRED_FIELD_LABELS[f])
                    .join(", ")}{" "}
                  em todas as linhas. Faltam preencher na(s) linha(s){" "}
                  {phiIncompleteRows.join(", ")}.
                </p>
              ) : null}
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
              phaseScope={effectiveScope}
            />
          ) : null}
        </section>

        {/* ADR 0134 §A2.4 — the bulk lane's typo mitigation. Deliberately a POINTER
            back to the editable grid rather than an echo of the values: the identifiers
            are still one step away and still correctable, and re-printing up to 200
            patients' data onto a second screen would widen the PHI surface to buy
            nothing. The creator can neither read them back after creation nor, if they
            are an Administrativo, correct them — so the review has to happen here. */}
        {step === DEAL_STEP && rowsWithPatient > 0 ? (
          <p
            role="note"
            className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/12 px-3 py-2.5 text-sm text-warning text-pretty"
          >
            <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              {rowsWithPatient === 1
                ? "1 caso leva identificadores de paciente. "
                : `${rowsWithPatient} casos levam identificadores de paciente. `}
              Confira-os na etapa “Casos” antes de criar: depois da criação, quem não
              tem permissão para editar identificadores não consegue corrigi-los.
            </span>
          </p>
        ) : null}

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
        <BulkRail items={checklist} phaseScope={effectiveScope} hasDeadline={deadline.trim() !== ""} />
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
              "h-full rounded-full transition-[width] duration-[var(--dur-base)] ease-[var(--ease-out-soft)]",
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

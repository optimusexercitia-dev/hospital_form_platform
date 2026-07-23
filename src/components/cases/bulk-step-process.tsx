"use client";

import { GitBranchPlus, Layers, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import {
  PATIENT_COLUMNS,
  phiSelectionValid,
} from "@/lib/cases/bulk-grid-model";
import type {
  BulkTemplateOption,
  PhaseScope,
} from "@/components/cases/bulk-create-types";

/**
 * Step 1 — pick the Process, choose which custom fields become grid columns
 * (required fields are always-on), set an optional deadline, the phase scope, and
 * the title prefix. All state lives in the wizard; this step is controlled.
 */
export function BulkStepProcess({
  headingRef,
  templates,
  templateId,
  onTemplateChange,
  selectedOptionalKeys,
  onToggleField,
  selectedPhiKeys,
  onTogglePhi,
  deadline,
  onDeadlineChange,
  phaseScope,
  onPhaseScopeChange,
  labelPrefix,
  onLabelPrefixChange,
  casePatientEnabled,
  caseCustomFieldsEnabled,
  casesMultiPhaseEnabled,
  caseNarrativesEnabled,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  templates: BulkTemplateOption[];
  templateId: string;
  onTemplateChange: (id: string) => void;
  selectedOptionalKeys: Set<string>;
  onToggleField: (key: string) => void;
  selectedPhiKeys: Set<string>;
  onTogglePhi: (key: string) => void;
  deadline: string;
  onDeadlineChange: (v: string) => void;
  phaseScope: PhaseScope;
  onPhaseScopeChange: (s: PhaseScope) => void;
  labelPrefix: string;
  onLabelPrefixChange: (v: string) => void;
  casePatientEnabled: boolean;
  caseCustomFieldsEnabled: boolean;
  casesMultiPhaseEnabled: boolean;
  caseNarrativesEnabled: boolean;
}) {
  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
  const customFields =
    caseCustomFieldsEnabled && selectedTemplate
      ? selectedTemplate.customFields
      : [];
  const collectsPhi = Boolean(
    casePatientEnabled && selectedTemplate?.collectsPatient,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold outline-none"
        >
          Processo e configuração
        </h2>
        <p className="text-sm text-muted-foreground">
          Todos os casos do lote são criados a partir de um único processo
          publicado.
        </p>
      </div>

      <Field>
        <FieldLabel htmlFor="bulk-template">Processo</FieldLabel>
        <NativeSelect
          id="bulk-template"
          value={templateId}
          onChange={(e) => onTemplateChange(e.target.value)}
        >
          <option value="" disabled>
            Selecione um processo…
          </option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </NativeSelect>
        <FieldDescription>
          Apenas processos ativos com ao menos uma fase podem gerar casos em lote.
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="bulk-prefix">Prefixo do título</FieldLabel>
        <Input
          id="bulk-prefix"
          value={labelPrefix}
          onChange={(e) => onLabelPrefixChange(e.target.value)}
          maxLength={80}
          placeholder="Ex.: Amostra de auditoria"
        />
        <FieldDescription>
          Cada caso recebe o título{" "}
          <span className="font-mono">
            {labelPrefix.trim() ? `${labelPrefix.trim()} #1` : "#1"}
          </span>
          , <span className="font-mono">#2</span>… (editável por linha). Nunca use
          o nome do paciente.
        </FieldDescription>
      </Field>

      {caseCustomFieldsEnabled && selectedTemplate && customFields.length > 0 ? (
        <fieldset className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4">
          <legend className="px-1 text-sm font-medium">
            Campos personalizados (colunas da grade)
          </legend>
          <PhiCaution>
            Não inclua dados de paciente nos campos personalizados (nome,
            prontuário, data de nascimento ou qualquer identificador).
          </PhiCaution>
          <div className="flex flex-col gap-2">
            {customFields.map((field) => {
              const checked = field.required || selectedOptionalKeys.has(field.key);
              return (
                <label
                  key={field.key}
                  className={cn(
                    "flex items-start gap-2.5 text-sm",
                    field.required && "opacity-90",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={field.required}
                    onCheckedChange={() => onToggleField(field.key)}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col">
                    <span className="font-medium">
                      {field.label}
                      {field.required ? (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          (obrigatório — sempre incluído)
                        </span>
                      ) : null}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {collectsPhi ? (
        <fieldset className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4">
          <legend className="px-1 text-sm font-medium">
            Identificadores do paciente (colunas da grade)
          </legend>
          <PhiCaution>
            Dados sensíveis de paciente (PHI). Selecione apenas os identificadores
            necessários — cada um vira uma coluna da grade.
          </PhiCaution>
          <div className="flex flex-col gap-2">
            {PATIENT_COLUMNS.map((col) => (
              <label key={col.key} className="flex items-start gap-2.5 text-sm">
                <Checkbox
                  checked={selectedPhiKeys.has(col.key)}
                  onCheckedChange={() => onTogglePhi(col.key)}
                  className="mt-0.5"
                />
                <span className="font-medium">{col.label}</span>
              </label>
            ))}
          </div>
          {!phiSelectionValid(selectedPhiKeys) ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              Selecione ao menos Nome ou Prontuário para coletar identificadores de
              paciente.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="bulk-deadline">Prazo (opcional)</FieldLabel>
          <Input
            id="bulk-deadline"
            type="date"
            value={deadline}
            onChange={(e) => onDeadlineChange(e.target.value)}
          />
          <FieldDescription>
            Aplica-se apenas à primeira fase de cada caso.
          </FieldDescription>
        </Field>
      </div>

      {casesMultiPhaseEnabled ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium">Fases atribuídas</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <ScopeOption
              icon={<Layers aria-hidden="true" className="size-4" />}
              title="Apenas a primeira fase"
              description={
                caseNarrativesEnabled
                  ? "Só a primeira fase é ativada e atribuída. As demais fases e narrativas ficam sem responsável."
                  : "Só a primeira fase é ativada e atribuída. As demais fases ficam sem responsável."
              }
              selected={phaseScope === "first_only"}
              onSelect={() => onPhaseScopeChange("first_only")}
            />
            <ScopeOption
              icon={<GitBranchPlus aria-hidden="true" className="size-4" />}
              title="Todas as fases"
              description={
                caseNarrativesEnabled
                  ? "Todas as fases e narrativas são pré-atribuídas ao mesmo responsável do caso."
                  : "Todas as fases são pré-atribuídas ao mesmo responsável do caso."
              }
              selected={phaseScope === "all_phases"}
              onSelect={() => onPhaseScopeChange("all_phases")}
            />
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

/**
 * Compact PHI/PII caution — small destructive TEXT with a subtle inline icon, no
 * bordered/tinted box (PO tweak: three heavy red boxes were too much for a
 * coordinator who fills this). Local to Step 1; the single-case dialog keeps its
 * boxed `LabelPiiWarning` / `CustomFieldsPiiWarning`.
 */
function PhiCaution({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="note"
      className="flex items-start gap-1.5 text-xs text-destructive text-pretty"
    >
      <ShieldAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function ScopeOption({
  icon,
  title,
  description,
  selected,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
        selected
          ? "border-primary bg-accent/40"
          : "border-border bg-card hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-2 text-sm font-semibold",
          selected ? "text-primary" : "text-foreground",
        )}
      >
        {icon}
        {title}
      </span>
      <span className="text-xs text-muted-foreground text-pretty">
        {description}
      </span>
    </button>
  );
}

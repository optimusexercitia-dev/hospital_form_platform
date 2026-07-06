"use client";

import { useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import type { DataSource, IndicatorKind } from "@/lib/indicators/types";
import type {
  PickerForm,
  PickerQuestion,
} from "@/components/indicators/derived-picker-types";

/**
 * The derived-config picker (Phase 15, F1). Renders the form → question →
 * option-`code` selection for a `derivado` or `hibrido` indicator, bound to the
 * commission's real published forms (passed in as plain props — no fetching).
 *
 * Emits the config as discrete named form fields consumed by `createIndicator` /
 * `updateIndicator` (the builder is ONE native `<form>` submission):
 *   - `derivedFormId`
 *   - `numeratorQuestionKey`, `numeratorOptionCodes` (repeated; checkbox multi-select)
 *   - `denominatorMode` ∈ {question, respondentes}  (percentual/contagem only)
 *   - `denominatorQuestionKey`                       (when denominatorMode=question)
 *   - `valueQuestionKey`                             (tempo_medio only)
 * The server action / RPC re-validates every code against the published version
 * (HC084) — this is UX convenience, not the authority.
 *
 * Config shape by kind (backend contract §3):
 *   - percentual/contagem → numerator (codes) + denominator (question | 'respondentes')
 *   - tempo_medio         → a single number question (averaged)
 *   - taxa (hibrido)      → numerator (codes) only; denominator entered per measurement
 */
export function DerivedConfigPicker({
  forms,
  kind,
  dataSource,
  initial,
  fieldErrors,
}: {
  forms: PickerForm[];
  kind: IndicatorKind;
  dataSource: DataSource;
  /** Prefilled values when editing an existing indicator. */
  initial?: {
    formId?: string;
    numeratorQuestionKey?: string;
    numeratorOptionCodes?: string[];
    denominatorMode?: "question" | "respondentes";
    denominatorQuestionKey?: string;
    valueQuestionKey?: string;
  };
  fieldErrors?: Record<string, string>;
}) {
  const [formId, setFormId] = useState(initial?.formId ?? "");
  const [numeratorKey, setNumeratorKey] = useState(
    initial?.numeratorQuestionKey ?? "",
  );
  const [selectedCodes, setSelectedCodes] = useState<string[]>(
    initial?.numeratorOptionCodes ?? [],
  );
  const [denominatorMode, setDenominatorMode] = useState<
    "question" | "respondentes"
  >(initial?.denominatorMode ?? "respondentes");
  const [denominatorKey, setDenominatorKey] = useState(
    initial?.denominatorQuestionKey ?? "",
  );
  const [valueKey, setValueKey] = useState(initial?.valueQuestionKey ?? "");

  const selectedForm = useMemo(
    () => forms.find((f) => f.formId === formId) ?? null,
    [forms, formId],
  );
  const choiceQuestions = useMemo(
    () => (selectedForm?.questions ?? []).filter((q) => q.kind === "choice"),
    [selectedForm],
  );
  const numberQuestions = useMemo(
    () => (selectedForm?.questions ?? []).filter((q) => q.kind === "number"),
    [selectedForm],
  );
  const numeratorQuestion: PickerQuestion | null = useMemo(
    () => choiceQuestions.find((q) => q.questionKey === numeratorKey) ?? null,
    [choiceQuestions, numeratorKey],
  );

  const needsNumeratorCodes = kind !== "tempo_medio";
  const isTempoMedio = kind === "tempo_medio";
  // Only percentual/contagem carry a denominator ref; taxa's denominator is
  // supplied per measurement (hibrido), tempo_medio has none.
  const needsDenominator =
    (kind === "percentual" || kind === "contagem") && dataSource === "derivado";

  function toggleCode(code: string) {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  const formsWithPublished = forms.filter((f) => f.hasPublishedVersion);

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-muted/20 p-4">
      <p className="text-sm font-semibold text-foreground">
        Origem dos dados
      </p>

      {formsWithPublished.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground">
          Nenhum formulário desta comissão possui versão publicada. Publique um
          formulário para vincular um indicador derivado, ou use a origem manual.
        </p>
      ) : (
        <>
          <Field>
            <FieldLabel htmlFor="derivedFormId">Formulário de origem</FieldLabel>
            <NativeSelect
              id="derivedFormId"
              name="derivedFormId"
              value={formId}
              onChange={(e) => {
                setFormId(e.target.value);
                // Reset dependent selections when the form changes.
                setNumeratorKey("");
                setSelectedCodes([]);
                setDenominatorKey("");
                setValueKey("");
              }}
              aria-describedby="derivedFormId-description"
              aria-invalid={fieldErrors?.derivedFormId ? true : undefined}
            >
              <option value="">Selecione um formulário…</option>
              {formsWithPublished.map((f) => (
                <option key={f.formId} value={f.formId}>
                  {f.title}
                </option>
              ))}
            </NativeSelect>
            <FieldDescription id="derivedFormId-description">
              As respostas enviadas deste formulário alimentam o cálculo.
            </FieldDescription>
            <FieldError>{fieldErrors?.derivedFormId}</FieldError>
          </Field>

          {isTempoMedio ? (
            <Field>
              <FieldLabel htmlFor="valueQuestionKey">
                Pergunta numérica (média)
              </FieldLabel>
              <NativeSelect
                id="valueQuestionKey"
                name="valueQuestionKey"
                value={valueKey}
                onChange={(e) => setValueKey(e.target.value)}
                disabled={!selectedForm}
                aria-describedby="valueQuestionKey-description"
                aria-invalid={fieldErrors?.valueQuestionKey ? true : undefined}
              >
                <option value="">Selecione uma pergunta numérica…</option>
                {numberQuestions.map((q) => (
                  <option key={q.questionKey} value={q.questionKey}>
                    {q.label}
                  </option>
                ))}
              </NativeSelect>
              <FieldDescription id="valueQuestionKey-description">
                O indicador é a média dos valores respondidos nesta pergunta.
              </FieldDescription>
              <FieldError>{fieldErrors?.valueQuestionKey}</FieldError>
            </Field>
          ) : null}

          {needsNumeratorCodes ? (
            <>
              <Field>
                <FieldLabel htmlFor="numeratorQuestionKey">
                  Pergunta do numerador
                </FieldLabel>
                <NativeSelect
                  id="numeratorQuestionKey"
                  name="numeratorQuestionKey"
                  value={numeratorKey}
                  onChange={(e) => {
                    setNumeratorKey(e.target.value);
                    setSelectedCodes([]);
                  }}
                  disabled={!selectedForm}
                  aria-invalid={
                    fieldErrors?.numeratorQuestionKey ? true : undefined
                  }
                >
                  <option value="">Selecione uma pergunta de escolha…</option>
                  {choiceQuestions.map((q) => (
                    <option key={q.questionKey} value={q.questionKey}>
                      {q.label}
                    </option>
                  ))}
                </NativeSelect>
                <FieldError>{fieldErrors?.numeratorQuestionKey}</FieldError>
              </Field>

              {numeratorQuestion ? (
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-medium text-foreground">
                    Opções que contam para o numerador
                  </legend>
                  <p className="text-sm text-muted-foreground">
                    Selecione as respostas consideradas eventos do numerador.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {numeratorQuestion.options.map((opt) => {
                      const checked = selectedCodes.includes(opt.code);
                      return (
                        <label
                          key={opt.code}
                          className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent/40"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleCode(opt.code)}
                          />
                          <span className="flex-1">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {/* Emit each selected code as a repeated hidden field. */}
                  {selectedCodes.map((code) => (
                    <input
                      key={code}
                      type="hidden"
                      name="numeratorOptionCodes"
                      value={code}
                    />
                  ))}
                  <FieldError>{fieldErrors?.numeratorOptionCodes}</FieldError>
                </fieldset>
              ) : null}
            </>
          ) : null}

          {needsDenominator ? (
            <Field>
              <FieldLabel htmlFor="denominatorMode">Denominador</FieldLabel>
              <NativeSelect
                id="denominatorMode"
                name="denominatorMode"
                value={denominatorMode}
                onChange={(e) =>
                  setDenominatorMode(
                    e.target.value as "question" | "respondentes",
                  )
                }
                disabled={!selectedForm}
              >
                <option value="respondentes">
                  Total de respostas enviadas
                </option>
                <option value="question">
                  Respostas que responderam a uma pergunta
                </option>
              </NativeSelect>
              {denominatorMode === "question" ? (
                <NativeSelect
                  className="mt-2"
                  name="denominatorQuestionKey"
                  value={denominatorKey}
                  onChange={(e) => setDenominatorKey(e.target.value)}
                  aria-label="Pergunta do denominador"
                  aria-invalid={
                    fieldErrors?.denominatorQuestionKey ? true : undefined
                  }
                >
                  <option value="">Selecione a pergunta do denominador…</option>
                  {choiceQuestions.map((q) => (
                    <option key={q.questionKey} value={q.questionKey}>
                      {q.label}
                    </option>
                  ))}
                </NativeSelect>
              ) : null}
              <FieldError>{fieldErrors?.denominatorQuestionKey}</FieldError>
            </Field>
          ) : null}

          {kind === "taxa" && dataSource === "hibrido" ? (
            <p className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-muted-foreground">
              O numerador é calculado automaticamente a partir do formulário; o
              denominador é informado a cada medição (ex.: pacientes-dia do
              período).
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { commissionHref } from "@/lib/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { DerivedConfigPicker } from "@/components/indicators/derived-config-picker";
import { TemplateCatalogDialog } from "@/components/indicators/template-catalog-dialog";
import type { PickerForm } from "@/components/indicators/derived-picker-types";
import type { IndicatorTemplate } from "@/components/indicators/indicator-templates";
import type {
  DataSource,
  Indicator,
  IndicatorDirection,
  IndicatorFrequency,
  IndicatorKind,
  TargetComparator,
} from "@/lib/indicators/types";
import {
  DATA_SOURCE_LABELS,
  INDICATOR_DIRECTION_LABELS,
  INDICATOR_FREQUENCY_LABELS,
  INDICATOR_KIND_LABELS,
} from "@/lib/indicators/types";
// Type-only imports of the server action module — the action functions are passed
// in as props by the server page (the WizardRunner boundary pattern), so this
// client component never value-imports a `"use server"` module.
import type {
  ActionState,
  CreateIndicatorState,
} from "@/lib/indicators/actions";

type CreateAction = (
  prev: CreateIndicatorState | undefined,
  formData: FormData,
) => Promise<CreateIndicatorState>;
type UpdateAction = (
  prev: ActionState | undefined,
  formData: FormData,
) => Promise<ActionState>;

const KINDS: IndicatorKind[] = ["percentual", "taxa", "contagem", "tempo_medio"];
const DIRECTIONS: IndicatorDirection[] = ["maior_melhor", "menor_melhor"];
const COMPARATORS: TargetComparator[] = [">=", "<=", "=", ">", "<"];
const FREQUENCIES: IndicatorFrequency[] = [
  "mensal",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
];

/**
 * Which data sources are valid for a given kind (backend CHECK coherence, ADR 0057):
 *   - taxa ∈ {manual, hibrido}
 *   - percentual/contagem/tempo_medio ∈ {manual, derivado}
 */
function allowedSources(kind: IndicatorKind): DataSource[] {
  return kind === "taxa" ? ["manual", "hibrido"] : ["manual", "derivado"];
}

/**
 * The indicator builder (Phase 15, F1 + F2). One native `<form>` posting to
 * `createIndicator` (or `updateIndicator` when editing) via `useActionState`.
 * Coordinator-only screen — the RPC is the write authority; this is the UX.
 *
 * A template (F2) prefills the definition fields via {@link TemplateCatalogDialog}.
 * The data-source picker binds to the commission's real published forms.
 */
export function IndicatorBuilder({
  createAction,
  updateAction,
  commissionId,
  forms,
  org,
  commission,
  listHref,
  existing,
}: {
  createAction?: CreateAction;
  updateAction?: UpdateAction;
  commissionId: string;
  forms: PickerForm[];
  /**
   * The org + commission slugs — the post-create/edit detail href is built HERE
   * via the pure, client-safe `commissionHref`. A function/closure must never
   * cross the server→client prop boundary (RSC serialization error; BUG-QI-001).
   */
  org: string;
  commission: string;
  /** The list href (cancel / post-edit target — a plain serializable string). */
  listHref: string;
  /** When present, the builder edits this indicator instead of creating one. */
  existing?: Indicator;
}) {
  const router = useRouter();
  const isEditing = Boolean(existing);

  const indicatorHref = (indicatorId: string) =>
    commissionHref(org, commission, "manage", "indicadores", indicatorId);

  const [kind, setKind] = useState<IndicatorKind>(existing?.kind ?? "percentual");
  const [dataSource, setDataSource] = useState<DataSource>(
    existing?.dataSource ?? "manual",
  );
  const [direction, setDirection] = useState<IndicatorDirection>(
    existing?.direction ?? "maior_melhor",
  );
  const [comparator, setComparator] = useState<TargetComparator>(
    existing?.targetComparator ?? ">=",
  );
  const [frequency, setFrequency] = useState<IndicatorFrequency>(
    existing?.frequency ?? "mensal",
  );
  const [name, setName] = useState(existing?.name ?? "");
  const [descriptionMd, setDescriptionMd] = useState(
    existing?.descriptionMd ?? "",
  );
  const [unit, setUnit] = useState(existing?.unit ?? "");
  const [numeratorLabel, setNumeratorLabel] = useState(
    existing?.numeratorLabel ?? "",
  );
  const [denominatorLabel, setDenominatorLabel] = useState(
    existing?.denominatorLabel ?? "",
  );
  const [targetValue, setTargetValue] = useState(
    existing?.targetValue != null ? String(existing.targetValue) : "",
  );
  const [lowerWarn, setLowerWarn] = useState(
    existing?.lowerWarn != null ? String(existing.lowerWarn) : "",
  );
  const [upperWarn, setUpperWarn] = useState(
    existing?.upperWarn != null ? String(existing.upperWarn) : "",
  );
  const [showPreview, setShowPreview] = useState(false);

  const sources = allowedSources(kind);

  // Changing the kind may invalidate the selected data source (e.g. taxa→percentual
  // leaves `hibrido` selected, which is not allowed for percentual). Reset it to
  // `manual` in the change handler (an event — not an effect) so the source is
  // always coherent with the kind's allowed set.
  function changeKind(next: IndicatorKind) {
    setKind(next);
    if (!allowedSources(next).includes(dataSource)) {
      setDataSource("manual");
    }
  }

  function applyTemplate(t: IndicatorTemplate) {
    setName(t.name);
    setDescriptionMd(t.description);
    setKind(t.kind);
    setDirection(t.direction);
    setComparator(t.targetComparator);
    setTargetValue(String(t.targetValue));
    setUnit(t.unit);
    setNumeratorLabel(t.numeratorLabel);
    setDenominatorLabel(t.denominatorLabel);
    setFrequency(t.frequency);
    // Templates seed the definition only; the coordinator picks the data source.
    setDataSource("manual");
  }

  const initialDerived = useMemo(() => {
    if (!existing?.derivedConfig) return undefined;
    const c = existing.derivedConfig;
    if ("value" in c) {
      return { formId: c.formId, valueQuestionKey: c.value.questionKey };
    }
    if ("denominator" in c) {
      const denom = c.denominator;
      return {
        formId: c.formId,
        numeratorQuestionKey: c.numerator.questionKey,
        numeratorOptionCodes: c.numerator.optionCodes,
        denominatorMode:
          denom === "respondentes"
            ? ("respondentes" as const)
            : ("question" as const),
        denominatorQuestionKey:
          denom === "respondentes" ? undefined : denom.questionKey,
      };
    }
    // Hybrid: numerator only.
    return {
      formId: c.formId,
      numeratorQuestionKey: c.numerator.questionKey,
      numeratorOptionCodes: c.numerator.optionCodes,
    };
  }, [existing]);

  return isEditing ? (
    <EditForm
      updateAction={updateAction!}
      listHref={listHref}
      indicatorId={existing!.id}
      onDone={() => router.push(indicatorHref(existing!.id))}
      controlled={{
        kind,
        setKind: changeKind,
        dataSource,
        setDataSource,
        direction,
        setDirection,
        comparator,
        setComparator,
        frequency,
        setFrequency,
        name,
        setName,
        descriptionMd,
        setDescriptionMd,
        unit,
        setUnit,
        numeratorLabel,
        setNumeratorLabel,
        denominatorLabel,
        setDenominatorLabel,
        targetValue,
        setTargetValue,
        lowerWarn,
        setLowerWarn,
        upperWarn,
        setUpperWarn,
        showPreview,
        setShowPreview,
        applyTemplate,
        sources,
        commissionId,
        forms,
        initialDerived,
      }}
    />
  ) : (
    <CreateForm
      createAction={createAction!}
      listHref={listHref}
      onCreated={(id) => router.push(indicatorHref(id))}
      controlled={{
        kind,
        setKind: changeKind,
        dataSource,
        setDataSource,
        direction,
        setDirection,
        comparator,
        setComparator,
        frequency,
        setFrequency,
        name,
        setName,
        descriptionMd,
        setDescriptionMd,
        unit,
        setUnit,
        numeratorLabel,
        setNumeratorLabel,
        denominatorLabel,
        setDenominatorLabel,
        targetValue,
        setTargetValue,
        lowerWarn,
        setLowerWarn,
        upperWarn,
        setUpperWarn,
        showPreview,
        setShowPreview,
        applyTemplate,
        sources,
        commissionId,
        forms,
        initialDerived,
      }}
    />
  );
}

interface ControlledState {
  kind: IndicatorKind;
  setKind: (k: IndicatorKind) => void;
  dataSource: DataSource;
  setDataSource: (d: DataSource) => void;
  direction: IndicatorDirection;
  setDirection: (d: IndicatorDirection) => void;
  comparator: TargetComparator;
  setComparator: (c: TargetComparator) => void;
  frequency: IndicatorFrequency;
  setFrequency: (f: IndicatorFrequency) => void;
  name: string;
  setName: (v: string) => void;
  descriptionMd: string;
  setDescriptionMd: (v: string) => void;
  unit: string;
  setUnit: (v: string) => void;
  numeratorLabel: string;
  setNumeratorLabel: (v: string) => void;
  denominatorLabel: string;
  setDenominatorLabel: (v: string) => void;
  targetValue: string;
  setTargetValue: (v: string) => void;
  lowerWarn: string;
  setLowerWarn: (v: string) => void;
  upperWarn: string;
  setUpperWarn: (v: string) => void;
  showPreview: boolean;
  setShowPreview: (v: boolean) => void;
  applyTemplate: (t: IndicatorTemplate) => void;
  sources: DataSource[];
  commissionId: string;
  forms: PickerForm[];
  initialDerived?: React.ComponentProps<typeof DerivedConfigPicker>["initial"];
}

function CreateForm({
  createAction,
  listHref,
  onCreated,
  controlled,
}: {
  createAction: CreateAction;
  listHref: string;
  onCreated: (id: string) => void;
  controlled: ControlledState;
}) {
  const [state, formAction, pending] = useActionState(createAction, undefined);
  const createdRef = useRef(false);

  useEffect(() => {
    if (state?.ok && state.indicatorId && !createdRef.current) {
      createdRef.current = true;
      onCreated(state.indicatorId);
    }
  }, [state, onCreated]);

  return (
    <BuilderFields
      formAction={formAction}
      pending={pending}
      error={state?.error}
      fieldErrors={state?.fieldErrors}
      submitLabel="Criar indicador"
      listHref={listHref}
      controlled={controlled}
    />
  );
}

function EditForm({
  updateAction,
  listHref,
  indicatorId,
  onDone,
  controlled,
}: {
  updateAction: UpdateAction;
  listHref: string;
  indicatorId: string;
  onDone: () => void;
  controlled: ControlledState;
}) {
  const [state, formAction, pending] = useActionState(updateAction, undefined);
  const doneRef = useRef(false);

  useEffect(() => {
    if (state?.ok && !doneRef.current) {
      doneRef.current = true;
      onDone();
    }
  }, [state, onDone]);

  return (
    <BuilderFields
      formAction={formAction}
      pending={pending}
      error={state?.error}
      fieldErrors={state?.fieldErrors}
      submitLabel="Salvar alterações"
      listHref={listHref}
      hiddenIndicatorId={indicatorId}
      controlled={controlled}
    />
  );
}

function BuilderFields({
  formAction,
  pending,
  error,
  fieldErrors,
  submitLabel,
  listHref,
  hiddenIndicatorId,
  controlled: c,
}: {
  formAction: (formData: FormData) => void;
  pending: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  submitLabel: string;
  listHref: string;
  hiddenIndicatorId?: string;
  controlled: ControlledState;
}) {
  const derived = c.dataSource !== "manual";

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="commissionId" value={c.commissionId} />
      {hiddenIndicatorId ? (
        <input type="hidden" name="indicatorId" value={hiddenIndicatorId} />
      ) : null}
      {/* Selects are controlled; mirror the value into a hidden field so it always
          posts even if the browser skips a disabled/controlled select edge case. */}
      <input type="hidden" name="kind" value={c.kind} />
      <input type="hidden" name="direction" value={c.direction} />
      <input type="hidden" name="dataSource" value={c.dataSource} />
      <input type="hidden" name="frequency" value={c.frequency} />
      <input type="hidden" name="targetComparator" value={c.comparator} />

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}

      {/* --- Definition ----------------------------------------------------- */}
      <section
        aria-labelledby="def-heading"
        className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="def-heading" className="text-lg font-semibold">
            Definição
          </h2>
          {!hiddenIndicatorId ? (
            <TemplateCatalogDialog onApply={c.applyTemplate} />
          ) : null}
        </div>

        <Field>
          <FieldLabel htmlFor="name">Nome do indicador</FieldLabel>
          <Input
            id="name"
            name="name"
            value={c.name}
            onChange={(e) => c.setName(e.target.value)}
            required
            maxLength={200}
            placeholder="Ex.: Taxa de adesão à higiene das mãos"
            aria-invalid={fieldErrors?.name ? true : undefined}
          />
          <FieldError>{fieldErrors?.name}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="descriptionMd">
            Descrição (Markdown, opcional)
          </FieldLabel>
          <Textarea
            id="descriptionMd"
            name="descriptionMd"
            value={c.descriptionMd}
            onChange={(e) => c.setDescriptionMd(e.target.value)}
            rows={4}
            placeholder="Descreva o que o indicador mede, a fonte dos dados e a fórmula."
            aria-describedby="descriptionMd-description"
          />
          <FieldDescription id="descriptionMd-description">
            Aceita formatação Markdown. Use a pré-visualização para conferir.
          </FieldDescription>
          {c.descriptionMd.trim() ? (
            <div className="mt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => c.setShowPreview(!c.showPreview)}
                aria-expanded={c.showPreview}
              >
                {c.showPreview ? "Ocultar pré-visualização" : "Pré-visualizar"}
              </Button>
              {c.showPreview ? (
                <div className="animate-fade-in mt-2 rounded-lg border border-border bg-muted/20 p-3">
                  <MarkdownRenderer content={c.descriptionMd} />
                </div>
              ) : null}
            </div>
          ) : null}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="kind">Tipo</FieldLabel>
            <NativeSelect
              id="kind"
              value={c.kind}
              onChange={(e) => c.setKind(e.target.value as IndicatorKind)}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {INDICATOR_KIND_LABELS[k]}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="direction">Direção</FieldLabel>
            <NativeSelect
              id="direction"
              value={c.direction}
              onChange={(e) =>
                c.setDirection(e.target.value as IndicatorDirection)
              }
            >
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {INDICATOR_DIRECTION_LABELS[d]}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="unit">Unidade</FieldLabel>
            <Input
              id="unit"
              name="unit"
              value={c.unit}
              onChange={(e) => c.setUnit(e.target.value)}
              placeholder="Ex.: %, por 1.000 pacientes-dia, dias"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="frequency">Periodicidade</FieldLabel>
            <NativeSelect
              id="frequency"
              value={c.frequency}
              onChange={(e) =>
                c.setFrequency(e.target.value as IndicatorFrequency)
              }
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {INDICATOR_FREQUENCY_LABELS[f]}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="numeratorLabel">Rótulo do numerador</FieldLabel>
            <Input
              id="numeratorLabel"
              name="numeratorLabel"
              value={c.numeratorLabel}
              onChange={(e) => c.setNumeratorLabel(e.target.value)}
              placeholder="Ex.: Eventos observados"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="denominatorLabel">
              Rótulo do denominador
            </FieldLabel>
            <Input
              id="denominatorLabel"
              name="denominatorLabel"
              value={c.denominatorLabel}
              onChange={(e) => c.setDenominatorLabel(e.target.value)}
              placeholder="Ex.: Total de oportunidades"
            />
          </Field>
        </div>
      </section>

      {/* --- Target + warning band ------------------------------------------ */}
      <section
        aria-labelledby="target-heading"
        className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
      >
        <h2 id="target-heading" className="text-lg font-semibold">
          Meta
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="targetComparator">Comparador</FieldLabel>
            <NativeSelect
              id="targetComparator"
              value={c.comparator}
              onChange={(e) =>
                c.setComparator(e.target.value as TargetComparator)
              }
            >
              {COMPARATORS.map((cmp) => (
                <option key={cmp} value={cmp}>
                  {cmp}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="targetValue">Valor da meta</FieldLabel>
            <Input
              id="targetValue"
              name="targetValue"
              type="number"
              step="any"
              inputMode="decimal"
              value={c.targetValue}
              onChange={(e) => c.setTargetValue(e.target.value)}
              placeholder="Ex.: 90"
              aria-invalid={fieldErrors?.targetValue ? true : undefined}
            />
            <FieldError>{fieldErrors?.targetValue}</FieldError>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="lowerWarn">
              Limite de alerta inferior (opcional)
            </FieldLabel>
            <Input
              id="lowerWarn"
              name="lowerWarn"
              type="number"
              step="any"
              inputMode="decimal"
              value={c.lowerWarn}
              onChange={(e) => c.setLowerWarn(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="upperWarn">
              Limite de alerta superior (opcional)
            </FieldLabel>
            <Input
              id="upperWarn"
              name="upperWarn"
              type="number"
              step="any"
              inputMode="decimal"
              value={c.upperWarn}
              onChange={(e) => c.setUpperWarn(e.target.value)}
            />
          </Field>
        </div>
      </section>

      {/* --- Data source ---------------------------------------------------- */}
      <section
        aria-labelledby="source-heading"
        className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
      >
        <h2 id="source-heading" className="text-lg font-semibold">
          Como o indicador é medido
        </h2>
        <Field>
          <FieldLabel htmlFor="dataSourceSelect">Origem dos dados</FieldLabel>
          <NativeSelect
            id="dataSourceSelect"
            value={c.dataSource}
            onChange={(e) => c.setDataSource(e.target.value as DataSource)}
          >
            {c.sources.map((s) => (
              <option key={s} value={s}>
                {DATA_SOURCE_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
          <FieldDescription>
            {c.dataSource === "manual"
              ? "Você lançará numerador e denominador manualmente a cada período."
              : c.dataSource === "derivado"
                ? "O valor é calculado automaticamente a partir das respostas enviadas."
                : "O numerador é calculado a partir das respostas; o denominador é informado a cada período."}
          </FieldDescription>
        </Field>

        {derived ? (
          <DerivedConfigPicker
            forms={c.forms}
            kind={c.kind}
            dataSource={c.dataSource}
            initial={c.initialDerived}
            fieldErrors={fieldErrors}
          />
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvando…" : submitLabel}
        </Button>
        <Button asChild variant="ghost" size="lg">
          <a href={listHref}>Cancelar</a>
        </Button>
      </div>
    </form>
  );
}

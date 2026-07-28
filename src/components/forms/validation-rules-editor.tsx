"use client";

import { useId } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { DATETIME_ORDER_OPS } from "@/lib/forms/validation-rules";
import type {
  DatetimeOrderOp,
  ValidationRuleType,
  ValidationSeverity,
} from "@/lib/forms/validation-rules";
import {
  DATETIME_ORDER_OP_LABELS,
  MAX_REGEX_PATTERN_LENGTH,
  allowedRuleTypes,
  blankDraft,
  dateRangeInputType,
  ruleTypeHint,
  ruleTypeLabel,
  type RuleDraft,
} from "@/components/forms/validation-drafts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * FF-3 (ADR 0090) — the rules list editor. Controlled + presentational: the
 * parent dialog owns the draft array and does the saving, so this component is
 * pure UI over {@link RuleDraft}[] and is exercised directly by unit tests.
 *
 * Two things the layout is deliberately built around:
 *
 *  1. **`message` is the point of a rule, not an afterthought.** The server
 *     requires it non-blank (a CHECK plus the writer), and a rule that fires
 *     with no explanation is a dead end for whoever is filling the form. So it
 *     is a first-class field on every row, not tucked behind a disclosure.
 *  2. **Order is authored, not incidental.** `position` is the array index, so
 *     the move up/down controls ARE the position editor. They are real buttons
 *     (not drag-only) because the whole flow must be keyboard-operable.
 *
 * The type picker only ever offers what `isValidationRuleAllowed` permits for
 * this item and its parent, so the author cannot build a pair the coverage
 * trigger will refuse.
 */
export function ValidationRulesEditor({
  drafts,
  onChange,
  itemType,
  parentItemType,
  datetimeTargets,
  problem,
  disabled = false,
}: {
  drafts: RuleDraft[];
  onChange: (next: RuleDraft[]) => void;
  itemType: string;
  parentItemType: string | null;
  /** Date/time questions in scope for a `datetime_order` comparison. */
  datetimeTargets: { questionKey: string; label: string }[];
  /**
   * m-5b — the failed pre-flight, if any. Rendered INSIDE the offending rule's
   * card as well as in the dialog banner, so the message is where the rule is
   * rather than something to go looking for.
   */
  problem?: { index: number; message: string } | null;
  disabled?: boolean;
}) {
  const groupId = useId();
  const types = allowedRuleTypes(itemType, parentItemType);

  function update(key: string, patch: Partial<RuleDraft>) {
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function remove(key: string) {
    onChange(drafts.filter((d) => d.key !== key));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= drafts.length) return;
    const next = [...drafts];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  if (types.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground text-pretty">
        Este tipo de bloco não aceita regras de validação.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {drafts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground text-pretty">
          Nenhuma regra ainda. As regras conferem a resposta no envio; um
          <strong className="font-medium"> erro</strong> impede o envio e um
          <strong className="font-medium"> aviso</strong> apenas alerta.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {drafts.map((draft, index) => {
            const rowId = `${groupId}-${draft.key}`;
            return (
              <li
                key={draft.key}
                aria-invalid={problem?.index === index ? true : undefined}
                className={
                  problem?.index === index
                    ? "flex flex-col gap-3 rounded-xl border border-destructive/50 bg-card p-4"
                    : "flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">
                    Regra {index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled || index === 0}
                      onClick={() => move(index, -1)}
                      aria-label={`Mover a regra ${index + 1} para cima`}
                    >
                      <ChevronUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled || index === drafts.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label={`Mover a regra ${index + 1} para baixo`}
                    >
                      <ChevronDown aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled}
                      onClick={() => remove(draft.key)}
                      aria-label={`Remover a regra ${index + 1}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                {problem?.index === index ? (
                  <p
                    role="alert"
                    className="text-sm font-medium text-destructive text-pretty"
                  >
                    {problem.message}
                  </p>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium">Tipo de regra</span>
                    <NativeSelect
                      id={`${rowId}-type`}
                      className="h-10"
                      value={draft.ruleType}
                      disabled={disabled}
                      onChange={(e) =>
                        update(draft.key, {
                          ruleType: e.target.value as ValidationRuleType,
                        })
                      }
                    >
                      {types.map((t) => (
                        <option key={t} value={t}>
                          {ruleTypeLabel(t)}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>

                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium">Gravidade</span>
                    <NativeSelect
                      id={`${rowId}-severity`}
                      className="h-10"
                      value={draft.severity}
                      disabled={disabled}
                      onChange={(e) =>
                        update(draft.key, {
                          severity: e.target.value as ValidationSeverity,
                        })
                      }
                    >
                      <option value="error">Erro — impede o envio</option>
                      <option value="warn">Aviso — não impede o envio</option>
                    </NativeSelect>
                  </label>
                </div>

                <p className="text-xs text-muted-foreground text-pretty">
                  {ruleTypeHint(draft.ruleType)}
                </p>

                <RuleConfigFields
                  rowId={rowId}
                  draft={draft}
                  itemType={itemType}
                  datetimeTargets={datetimeTargets}
                  disabled={disabled}
                  onPatch={(patch) => update(draft.key, patch)}
                />

                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">
                    Mensagem exibida quando a resposta não passa
                  </span>
                  <Textarea
                    id={`${rowId}-message`}
                    value={draft.message}
                    disabled={disabled}
                    onChange={(e) =>
                      update(draft.key, { message: e.target.value })
                    }
                    placeholder="Ex.: Informe uma temperatura entre 30 e 45 °C."
                    className="min-h-16"
                    aria-describedby={`${rowId}-message-hint`}
                  />
                  <span
                    id={`${rowId}-message-hint`}
                    className="text-xs text-muted-foreground text-pretty"
                  >
                    Obrigatória. É o texto que a pessoa vê — escreva o que ela
                    precisa fazer, não o que deu errado.
                  </span>
                </label>
              </li>
            );
          })}
        </ol>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={disabled}
        onClick={() => onChange([...drafts, blankDraft(itemType, parentItemType)])}
      >
        <Plus aria-hidden="true" />
        Adicionar regra
      </Button>
    </div>
  );
}

/** The type-specific `config` controls for one rule. */
function RuleConfigFields({
  rowId,
  draft,
  itemType,
  datetimeTargets,
  disabled,
  onPatch,
}: {
  rowId: string;
  draft: RuleDraft;
  itemType: string;
  datetimeTargets: { questionKey: string; label: string }[];
  disabled: boolean;
  onPatch: (patch: Partial<RuleDraft>) => void;
}) {
  switch (draft.ruleType) {
    case "number_range":
      return (
        <BoundPair
          rowId={rowId}
          legend="Limites (pelo menos um)"
          type="number"
          step="any"
          min={draft.min}
          max={draft.max}
          disabled={disabled}
          onPatch={onPatch}
        />
      );

    case "text_length":
      return (
        <BoundPair
          rowId={rowId}
          legend="Caracteres (pelo menos um limite)"
          type="number"
          step="1"
          nonNegative
          min={draft.min}
          max={draft.max}
          disabled={disabled}
          onPatch={onPatch}
        />
      );

    case "date_range":
      return (
        <BoundPair
          rowId={rowId}
          legend="Intervalo permitido (pelo menos um limite)"
          type={dateRangeInputType(itemType)}
          min={draft.min}
          max={draft.max}
          disabled={disabled}
          onPatch={onPatch}
        />
      );

    case "regex":
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Padrão</legend>
          {/* m-5a — an explicit `<label>`, matching every other field in this
              editor. A `<legend>` names the FIELDSET, not the input inside it, so
              the control was reaching assistive tech unnamed while its sighted
              label looked present. */}
          <label
            htmlFor={`${rowId}-pattern`}
            className="mb-1 text-sm font-medium"
          >
            Padrão
          </label>
          <Input
            id={`${rowId}-pattern`}
            type="text"
            value={draft.pattern}
            disabled={disabled}
            maxLength={MAX_REGEX_PATTERN_LENGTH}
            onChange={(e) => onPatch({ pattern: e.target.value })}
            placeholder="Ex.: ^[0-9]{11}$"
            className="h-10 font-mono"
            aria-describedby={`${rowId}-pattern-hint`}
          />
          <span
            id={`${rowId}-pattern-hint`}
            className="text-xs text-muted-foreground text-pretty"
          >
            Até {MAX_REGEX_PATTERN_LENGTH} caracteres. Prefira padrões simples:
            expressões muito complexas deixam o preenchimento lento.
          </span>
          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox
              checked={draft.caseInsensitive}
              disabled={disabled}
              onCheckedChange={(c) => onPatch({ caseInsensitive: c === true })}
            />
            Ignorar maiúsculas e minúsculas
          </label>
        </fieldset>
      );

    case "datetime_order":
      if (datetimeTargets.length === 0) {
        return (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground text-pretty">
            Não há outra pergunta de data ou hora no mesmo escopo para comparar.
          </p>
        );
      }
      return (
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-medium">Comparação</legend>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="sr-only">Tipo de comparação</span>
            <NativeSelect
              id={`${rowId}-op`}
              className="h-10"
              value={draft.op}
              disabled={disabled}
              onChange={(e) =>
                onPatch({
                  op: e.target.value as DatetimeOrderOp,
                })
              }
            >
              {DATETIME_ORDER_OPS.map((op) => (
                <option key={op} value={op}>
                  {DATETIME_ORDER_OP_LABELS[op]}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="sr-only">Pergunta comparada</span>
            <NativeSelect
              id={`${rowId}-question`}
              className="h-10"
              value={draft.questionKey}
              disabled={disabled}
              onChange={(e) => onPatch({ questionKey: e.target.value })}
            >
              <option value="">Selecione a pergunta…</option>
              {datetimeTargets.map((t) => (
                <option key={t.questionKey} value={t.questionKey}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </label>
        </fieldset>
      );

    case "unique_within_group":
      return null;
  }
}

/** The shared min/max pair used by the three bounded rule types. */
function BoundPair({
  rowId,
  legend,
  type,
  step,
  nonNegative = false,
  min,
  max,
  disabled,
  onPatch,
}: {
  rowId: string;
  legend: string;
  type: "number" | "date" | "time";
  step?: string;
  nonNegative?: boolean;
  min: string;
  max: string;
  disabled: boolean;
  onPatch: (patch: Partial<RuleDraft>) => void;
}) {
  return (
    <fieldset className="grid grid-cols-2 gap-3">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Mínimo</span>
        <Input
          id={`${rowId}-min`}
          type={type}
          step={step}
          min={nonNegative ? 0 : undefined}
          inputMode={type === "number" ? "numeric" : undefined}
          value={min}
          disabled={disabled}
          onChange={(e) => onPatch({ min: e.target.value })}
          className="h-10"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Máximo</span>
        <Input
          id={`${rowId}-max`}
          type={type}
          step={step}
          min={nonNegative ? 0 : undefined}
          inputMode={type === "number" ? "numeric" : undefined}
          value={max}
          disabled={disabled}
          onChange={(e) => onPatch({ max: e.target.value })}
          className="h-10"
        />
      </label>
    </fieldset>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from "lucide-react";

import type { PhaseConditionTarget } from "@/lib/queries/process-templates";
import type {
  ConditionOp,
  ResultRule,
  ResultRuleset,
  VisibleWhen,
} from "@/lib/queries/conditions";
import { walkResultRuleset } from "@/lib/queries/conditions";
import type { PhaseResult } from "@/lib/queries/phase-results";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { TOKEN_STYLES } from "@/components/cases/case-status-badge";

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

const OP_LABELS: Record<ConditionOp, string> = {
  equals: "for igual a",
  not_equals: "for diferente de",
  in: "for uma das opções",
};

/** A locally-edited rule row (UI state; serialized to a {@link ResultRule}). */
interface DraftRule {
  /** Stable local key for React (not persisted). */
  uid: string;
  questionKey: string;
  op: ConditionOp;
  singleValue: string;
  multiValue: string[];
  resultId: string;
}

let uidCounter = 0;
function nextUid(): string {
  uidCounter += 1;
  return `rule-${uidCounter}`;
}

/** Parse an incoming serialized ruleset into draft rows for editing. */
function toDrafts(ruleset: ResultRuleset | null): DraftRule[] {
  if (!ruleset) return [];
  return ruleset.rules.map((rule) => {
    const value = rule.when.value;
    return {
      uid: nextUid(),
      questionKey: rule.when.question_key,
      op: rule.when.op,
      singleValue: typeof value === "string" ? value : "",
      multiValue: Array.isArray(value) ? value.map(String) : [],
      resultId: rule.result_id,
    };
  });
}

/** A single draft rule is COMPLETE (serializable) when every picker is filled. */
function isRuleComplete(
  rule: DraftRule,
  target: PhaseConditionTarget | undefined,
): boolean {
  if (!target || !rule.resultId) return false;
  return rule.op === "in" ? rule.multiValue.length > 0 : rule.singleValue !== "";
}

/** Serialize a complete draft rule to a {@link ResultRule}. */
function toResultRule(rule: DraftRule): ResultRule {
  const when: VisibleWhen = {
    question_key: rule.questionKey,
    op: rule.op,
    value: rule.op === "in" ? rule.multiValue : rule.singleValue,
  };
  return { when, result_id: rule.resultId };
}

/**
 * The per-phase RESULT-ruleset editor (phase-results feature). Builds a
 * {@link ResultRuleset} — an ORDERED list of rules over THIS phase's OWN choice
 * questions (NO `from_phase`, unlike {@link RecommendWhenEditor}) plus a default
 * fallback — that emits a categorical result when the phase's form is submitted.
 *
 * Each rule row picks:
 *   1. a CHOICE question of this phase's form (from `targets`),
 *   2. an operator (equals / not_equals / in),
 *   3. a discrete value (single option, or a multi-select for `in`),
 *   4. the RESULT option emitted when this rule is the FIRST to match.
 * Plus a default-result picker (the fallback when no rule matches; "Nenhum" = no
 * result).
 *
 * It serializes a `{ rules, default_result_id }` JSON string via `onChange`
 * (or "" when there is nothing to author), which {@link PhaseSlotDialog} sends in
 * the `resultRuleset` hidden field. The pickers are discrete so an author can only
 * build a structurally valid ruleset; the backend deep-validates at publish time.
 *
 * Live preview — the author picks a hypothetical answer per referenced question and
 * we run the EXACT mirror the backend evaluates ({@link walkResultRuleset}) to show
 * which result WOULD be emitted (first-match-wins, else default, else none).
 */
export function ResultRulesetEditor({
  targets,
  results,
  value,
  onChange,
  error,
  disabled = false,
}: {
  /** THIS phase's bound-form choice questions (server-resolved). */
  targets: PhaseConditionTarget[];
  /** The commission's ACTIVE result vocabulary (the result-option pickers). */
  results: PhaseResult[];
  /** Current serialized ResultRuleset JSON ("" = none). */
  value: string;
  onChange: (next: string) => void;
  error?: string;
  /** Read-only (non-draft template) — hides the editing affordances. */
  disabled?: boolean;
}) {
  const initial = useMemo<ResultRuleset | null>(() => {
    if (!value) return null;
    try {
      return JSON.parse(value) as ResultRuleset;
    } catch {
      return null;
    }
  }, [value]);

  const [enabled, setEnabled] = useState<boolean>(initial !== null);
  const [rules, setRules] = useState<DraftRule[]>(() => toDrafts(initial));
  const [defaultResultId, setDefaultResultId] = useState<string>(
    initial?.default_result_id ?? "",
  );
  // Hypothetical answers for the live preview, keyed by question_key (not persisted).
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});

  const resultsById = useMemo(() => {
    const map = new Map<string, PhaseResult>();
    for (const r of results) map.set(r.id, r);
    return map;
  }, [results]);

  const targetByKey = useMemo(() => {
    const map = new Map<string, PhaseConditionTarget>();
    for (const t of targets) map.set(t.questionKey, t);
    return map;
  }, [targets]);

  // Serialize up to the parent whenever the ruleset changes. We emit only the
  // COMPLETE rules; an in-progress half-filled row simply doesn't serialize yet.
  // "" is emitted when disabled, when there are no complete rules AND no default.
  useEffect(() => {
    if (!enabled) {
      onChange("");
      return;
    }
    const completeRules = rules
      .filter((r) => isRuleComplete(r, targetByKey.get(r.questionKey)))
      .map(toResultRule);
    const hasDefault = defaultResultId !== "";
    if (completeRules.length === 0 && !hasDefault) {
      onChange("");
      return;
    }
    const ruleset: ResultRuleset = {
      rules: completeRules,
      default_result_id: hasDefault ? defaultResultId : null,
    };
    onChange(JSON.stringify(ruleset));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, rules, defaultResultId, targetByKey]);

  function addRule() {
    setRules((prev) => [
      ...prev,
      {
        uid: nextUid(),
        questionKey: "",
        op: "equals",
        singleValue: "",
        multiValue: [],
        resultId: "",
      },
    ]);
  }

  function updateRule(uid: string, patch: Partial<DraftRule>) {
    setRules((prev) =>
      prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)),
    );
  }

  function removeRule(uid: string) {
    setRules((prev) => prev.filter((r) => r.uid !== uid));
  }

  function moveRule(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= rules.length) return;
    setRules((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // Live preview: build a hypothetical answer map from the per-question pickers and
  // walk the COMPLETE ruleset exactly as the backend does. Result label or "none".
  const previewResultId = useMemo<string | null>(() => {
    const completeRules = rules
      .filter((r) => isRuleComplete(r, targetByKey.get(r.questionKey)))
      .map(toResultRule);
    if (completeRules.length === 0 && defaultResultId === "") return null;
    const ruleset: ResultRuleset = {
      rules: completeRules,
      default_result_id: defaultResultId || null,
    };
    return walkResultRuleset(ruleset, previewAnswers);
  }, [rules, defaultResultId, targetByKey, previewAnswers]);

  const previewResult = previewResultId
    ? resultsById.get(previewResultId)
    : null;

  // The distinct questions referenced by complete rules drive the preview pickers.
  const previewQuestions = useMemo(() => {
    const keys = new Set<string>();
    for (const r of rules) {
      if (isRuleComplete(r, targetByKey.get(r.questionKey))) keys.add(r.questionKey);
    }
    return [...keys]
      .map((k) => targetByKey.get(k))
      .filter((t): t is PhaseConditionTarget => t != null);
  }, [rules, targetByKey]);

  const hasCompleteRuleset =
    rules.some((r) => isRuleComplete(r, targetByKey.get(r.questionKey))) ||
    defaultResultId !== "";

  if (targets.length === 0 || results.length === 0) {
    return (
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">Resultado da fase</legend>
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground text-pretty">
          {results.length === 0
            ? "Cadastre ao menos um resultado nas configurações da comissão para definir o resultado desta fase."
            : "O formulário desta fase não tem perguntas de múltipla escolha para condicionar um resultado."}
        </p>
      </fieldset>
    );
  }

  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="text-sm font-semibold">Resultado da fase</legend>
      <p className="text-sm text-muted-foreground text-pretty">
        Ao enviar o formulário, esta fase pode emitir um resultado conforme as
        respostas. As regras são avaliadas em ordem — a primeira que corresponder
        define o resultado; se nenhuma corresponder, vale o resultado padrão.
      </p>

      <label className="flex items-center gap-2.5 text-sm">
        <Checkbox
          checked={enabled}
          onCheckedChange={(c) => setEnabled(c === true)}
          disabled={disabled}
        />
        Emitir um resultado automático para esta fase
      </label>

      {enabled && (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-3">
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium">Regras</span>
            {rules.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                Nenhuma regra ainda. Adicione uma regra ou defina apenas um
                resultado padrão abaixo.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {rules.map((rule, index) => (
                  <RuleRow
                    key={rule.uid}
                    rule={rule}
                    index={index}
                    total={rules.length}
                    targets={targets}
                    target={targetByKey.get(rule.questionKey)}
                    results={results}
                    disabled={disabled}
                    onUpdate={(patch) => updateRule(rule.uid, patch)}
                    onRemove={() => removeRule(rule.uid)}
                    onMove={(d) => moveRule(index, d)}
                  />
                ))}
              </ul>
            )}
            {!disabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRule}
                className="w-fit"
              >
                <Plus aria-hidden="true" />
                Adicionar regra
              </Button>
            )}
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Resultado padrão</span>
            <select
              className={SELECT_CLASS}
              value={defaultResultId}
              onChange={(e) => setDefaultResultId(e.target.value)}
              disabled={disabled}
            >
              <option value="">Nenhum (sem resultado padrão)</option>
              {results.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              Aplicado quando nenhuma regra acima corresponde.
            </span>
          </label>

          {/* Live preview against hypothetical answers */}
          {hasCompleteRuleset && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3">
              <span className="text-sm font-medium">
                Pré-visualizar: se as respostas fossem
              </span>
              {previewQuestions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-pretty">
                  Sem regras com perguntas — o resultado padrão será sempre
                  aplicado.
                </p>
              ) : (
                previewQuestions.map((target) => (
                  <label
                    key={target.questionKey}
                    className="flex flex-col gap-1.5 text-sm"
                  >
                    <span className="font-medium">
                      {target.label || target.questionKey}
                    </span>
                    <select
                      className={SELECT_CLASS}
                      value={previewAnswers[target.questionKey] ?? ""}
                      onChange={(e) =>
                        setPreviewAnswers((prev) => ({
                          ...prev,
                          [target.questionKey]: e.target.value,
                        }))
                      }
                    >
                      <option value="">Sem resposta</option>
                      {target.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>
                ))
              )}
              <p className="animate-fade-in inline-flex items-center gap-2 text-sm">
                <Sparkles
                  aria-hidden="true"
                  className="size-4 shrink-0 text-primary"
                />
                {previewResult ? (
                  <span className="inline-flex items-center gap-1.5">
                    Resultado:
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        TOKEN_STYLES[previewResult.colorToken] ??
                          TOKEN_STYLES.muted,
                      )}
                    >
                      {previewResult.label}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Nenhum resultado seria emitido.
                  </span>
                )}
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}

function RuleRow({
  rule,
  index,
  total,
  targets,
  target,
  results,
  disabled,
  onUpdate,
  onRemove,
  onMove,
}: {
  rule: DraftRule;
  index: number;
  total: number;
  targets: PhaseConditionTarget[];
  target: PhaseConditionTarget | undefined;
  results: PhaseResult[];
  disabled: boolean;
  onUpdate: (patch: Partial<DraftRule>) => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
}) {
  function toggleMulti(option: string) {
    const next = rule.multiValue.includes(option)
      ? rule.multiValue.filter((o) => o !== option)
      : [...rule.multiValue, option];
    onUpdate({ multiValue: next });
  }

  return (
    <li className="flex gap-2 rounded-lg border border-border bg-background/50 p-3">
      {!disabled && (
        <div className="flex shrink-0 flex-col">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onMove("up")}
            disabled={index === 0}
            aria-label={`Mover regra ${index + 1} para cima`}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onMove("down")}
            disabled={index === total - 1}
            aria-label={`Mover regra ${index + 1} para baixo`}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Regra {index + 1}
          </span>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onRemove}
              aria-label={`Remover regra ${index + 1}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 aria-hidden="true" />
            </Button>
          )}
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Quando a resposta de</span>
          <select
            className={SELECT_CLASS}
            value={rule.questionKey}
            onChange={(e) =>
              onUpdate({
                questionKey: e.target.value,
                singleValue: "",
                multiValue: [],
              })
            }
            disabled={disabled}
          >
            <option value="">Selecione uma pergunta…</option>
            {targets.map((t) => (
              <option key={t.questionKey} value={t.questionKey}>
                {t.label || t.questionKey}
              </option>
            ))}
          </select>
        </label>

        {target && (
          <>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">A condição</span>
              <select
                className={SELECT_CLASS}
                value={rule.op}
                onChange={(e) =>
                  onUpdate({
                    op: e.target.value as ConditionOp,
                    singleValue: "",
                    multiValue: [],
                  })
                }
                disabled={disabled}
              >
                {(["equals", "not_equals", "in"] as ConditionOp[]).map((o) => (
                  <option key={o} value={o}>
                    {OP_LABELS[o]}
                  </option>
                ))}
              </select>
            </label>

            {target.options.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Esta pergunta não tem opções definidas.
              </p>
            ) : rule.op === "in" ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">
                  Opções selecionadas
                </legend>
                {target.options.map((opt) => (
                  <label key={opt} className="flex items-center gap-2.5 text-sm">
                    <Checkbox
                      checked={rule.multiValue.includes(opt)}
                      onCheckedChange={() => toggleMulti(opt)}
                      disabled={disabled}
                    />
                    {opt}
                  </label>
                ))}
              </fieldset>
            ) : (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Valor</span>
                <select
                  className={SELECT_CLASS}
                  value={rule.singleValue}
                  onChange={(e) => onUpdate({ singleValue: e.target.value })}
                  disabled={disabled}
                >
                  <option value="">Selecione…</option>
                  {target.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Então o resultado é</span>
          <select
            className={SELECT_CLASS}
            value={rule.resultId}
            onChange={(e) => onUpdate({ resultId: e.target.value })}
            disabled={disabled}
          >
            <option value="">Selecione um resultado…</option>
            {results.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </li>
  );
}

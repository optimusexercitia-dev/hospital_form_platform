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
import {
  FLAGGED_COUNT_KEY,
  TOTAL_SCORE_KEY,
  walkResultRuleset,
} from "@/lib/queries/conditions";
import type { PhaseResult } from "@/lib/queries/phase-results";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { TOKEN_STYLES } from "@/components/cases/case-status-badge";


const OP_LABELS: Record<ConditionOp, string> = {
  equals: "for igual a",
  not_equals: "for diferente de",
  in: "for uma das opções",
  gt: "for maior que",
  gte: "for maior ou igual a",
  lt: "for menor que",
  lte: "for menor ou igual a",
};

/**
 * The criterion a result rule keys on (form-builder-enhancements):
 *   - `answer`  → an earlier CHOICE question's answer (today's behaviour);
 *   - `score`   → the phase's `__total_score__` aggregate (ordered/equality op);
 *   - `flagged` → the phase's `__flagged_count__` aggregate (ordered/equality op).
 * The two aggregates serialize to a {@link VisibleWhen} keyed on the reserved
 * synthetic question_key, so the UNCHANGED evaluator handles `> 5` etc. (Rule 3).
 */
type Criterion = "answer" | "score" | "flagged";

/** The ops the AGGREGATE criteria (score/flagged) offer — ordered comparisons
 *  plus equality/inequality against a whole number. No `in`. */
const AGGREGATE_OPS: ConditionOp[] = [
  "gt",
  "gte",
  "lt",
  "lte",
  "equals",
  "not_equals",
];

/** The reserved synthetic key a given aggregate criterion serializes onto. */
function aggregateKeyFor(criterion: Exclude<Criterion, "answer">): string {
  return criterion === "score" ? TOTAL_SCORE_KEY : FLAGGED_COUNT_KEY;
}

/** Reverse-map a rule's synthetic question_key to its criterion (or `answer`). */
function criterionForKey(questionKey: string): Criterion {
  if (questionKey === TOTAL_SCORE_KEY) return "score";
  if (questionKey === FLAGGED_COUNT_KEY) return "flagged";
  return "answer";
}

/** The number of allowed results an emitting phase must select to be saved. */
export const MIN_ALLOWED_RESULTS = 2;

/** The consolidated value the editor emits (phase-result-manual-mode): the three
 *  fields the {@link PhaseSlotDialog} submits. `resultRuleset` is "" unless
 *  AUTOMATIC; `allowedResultIds` is the author-selected subset, present (for both
 *  modes) whenever `emitsResult`. */
export interface PhaseResultValue {
  emitsResult: boolean;
  /** Serialized {@link ResultRuleset} JSON, or "" — AUTOMATIC only. */
  resultRuleset: string;
  /** The author-selected allowed result subset (both modes when emitting). */
  allowedResultIds: string[];
}

/** A locally-edited rule row (UI state; serialized to a {@link ResultRule}). */
interface DraftRule {
  uid: string;
  /** The criterion this rule keys on (answer / total-score / flagged-count). */
  criterion: Criterion;
  /** ANSWER criterion: the earlier choice question's `question_key` ("" until picked). */
  questionKey: string;
  op: ConditionOp;
  /** ANSWER (single-op) → option code; AGGREGATE → the numeric threshold as text. */
  singleValue: string;
  /** ANSWER `in` → the selected option codes. */
  multiValue: string[];
  resultId: string;
}

let uidCounter = 0;
function nextUid(): string {
  uidCounter += 1;
  return `rule-${uidCounter}`;
}

/** Parse an incoming serialized ruleset into draft rows for editing. An
 *  aggregate rule (`question_key` = a reserved synthetic key) reverse-maps to its
 *  `score`/`flagged` criterion with the numeric threshold in `singleValue`. */
function toDrafts(ruleset: ResultRuleset | null): DraftRule[] {
  if (!ruleset) return [];
  return ruleset.rules.map((rule) => {
    const value = rule.when.value;
    const criterion = criterionForKey(rule.when.question_key);
    const singleValue =
      criterion === "answer"
        ? typeof value === "string"
          ? value
          : ""
        : // Aggregate threshold: stored as a JSON number, edited as text.
          typeof value === "number"
          ? String(value)
          : typeof value === "string"
            ? value
            : "";
    return {
      uid: nextUid(),
      criterion,
      questionKey: criterion === "answer" ? rule.when.question_key : "",
      op: rule.when.op,
      singleValue,
      multiValue: Array.isArray(value) ? value.map(String) : [],
      resultId: rule.result_id,
    };
  });
}

function parseRuleset(value: string): ResultRuleset | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as ResultRuleset;
  } catch {
    return null;
  }
}

/** A single draft rule is COMPLETE (serializable) when every picker is filled.
 *  ANSWER needs a resolved target + a chosen value; AGGREGATE (score/flagged)
 *  needs only a numeric threshold (no target question). */
function isRuleComplete(
  rule: DraftRule,
  target: PhaseConditionTarget | undefined,
): boolean {
  if (!rule.resultId) return false;
  if (rule.criterion !== "answer") {
    // Aggregate: a well-formed number threshold.
    const n = Number(rule.singleValue);
    return rule.singleValue.trim() !== "" && Number.isFinite(n);
  }
  if (!target) return false;
  return rule.op === "in" ? rule.multiValue.length > 0 : rule.singleValue !== "";
}

/** Serialize a complete draft rule to a {@link ResultRule}. ANSWER keeps today's
 *  choice-code shape; an AGGREGATE serializes to the reserved synthetic key with
 *  a NUMERIC value so the unchanged evaluator compares numerically. */
function toResultRule(rule: DraftRule): ResultRule {
  if (rule.criterion !== "answer") {
    const when: VisibleWhen = {
      question_key: aggregateKeyFor(rule.criterion),
      op: rule.op,
      value: Number(rule.singleValue),
    };
    return { when, result_id: rule.resultId };
  }
  const when: VisibleWhen = {
    question_key: rule.questionKey,
    op: rule.op,
    value: rule.op === "in" ? rule.multiValue : rule.singleValue,
  };
  return { when, result_id: rule.resultId };
}

/**
 * The per-phase RESULT editor (phase-results feature, extended by
 * phase-result-manual-mode). The "Resultado da fase" section of the
 * {@link PhaseSlotDialog}, structured as a two-step choice:
 *
 *   1. "Esta fase emite um resultado" (outer toggle → `emitsResult`). Off ⇒ NONE.
 *   2. When emitting, FIRST pick the **"Resultados permitidos"** — the allowed
 *      result subset (≥ {@link MIN_ALLOWED_RESULTS}, gated by the dialog). THEN:
 *      "Emitir um resultado automático para esta fase" (inner toggle, initially
 *      OFF). OFF ⇒ MANUAL — the filler picks one of the allowed results at the end
 *      of the wizard. ON ⇒ AUTOMATIC — an ordered ruleset decides the result, and
 *      every rule/default RESULT picker is restricted to the allowed subset.
 *
 * It emits a {@link PhaseResultValue} via `onChange` (the dialog stores it and
 * submits `emitsResult` / `resultRuleset` / `allowedResultIds`). The pickers are
 * discrete so an author can only build a structurally valid config; the backend
 * deep-validates at publish time.
 */
export function PhaseResultEditor({
  targets,
  results,
  value,
  onChange,
  error,
  disabled = false,
}: {
  /** THIS phase's bound-form choice questions (server-resolved). */
  targets: PhaseConditionTarget[];
  /** The commission's ACTIVE result vocabulary (the option pickers). */
  results: PhaseResult[];
  /** The current consolidated value (emits + ruleset + allowed subset). */
  value: PhaseResultValue;
  onChange: (next: PhaseResultValue) => void;
  error?: string;
  /** Read-only (non-draft template) — hides the editing affordances. */
  disabled?: boolean;
}) {
  const initialRuleset = useMemo(
    () => parseRuleset(value.resultRuleset),
    // Parse once on mount; subsequent edits flow through local state + onChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [emits, setEmits] = useState<boolean>(value.emitsResult);
  // The automatic toggle defaults OFF (manual) for a new emitting phase; an
  // existing AUTOMATIC phase (serialized ruleset present) seeds it ON.
  const [automatic, setAutomatic] = useState<boolean>(
    value.resultRuleset !== "",
  );
  const [allowedIds, setAllowedIds] = useState<string[]>(value.allowedResultIds);

  // AUTOMATIC sub-state.
  const [rules, setRules] = useState<DraftRule[]>(() => toDrafts(initialRuleset));
  const [defaultResultId, setDefaultResultId] = useState<string>(
    initialRuleset?.default_result_id ?? "",
  );
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>(
    {},
  );
  // Simulated aggregate inputs for the AUTOMATIC preview (form-builder-
  // enhancements): the author types a hypothetical __total_score__ /
  // __flagged_count__ so the preview can show whether a score/flagged rule fires,
  // WITHOUT the editor loading per-option score/flagged metadata. Injected as the
  // reserved synthetic keys (as NUMBERS — the computeAggregateKeys shape) before
  // walkResultRuleset, so builder-preview == backend-compute exactly (Rule 3).
  const [previewScore, setPreviewScore] = useState<string>("");
  const [previewFlagged, setPreviewFlagged] = useState<string>("");

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

  // The allowed results, in vocabulary order — what the automatic rule/default
  // pickers may reference.
  const allowedResults = useMemo(
    () => results.filter((r) => allowedIds.includes(r.id)),
    [results, allowedIds],
  );

  // Serialize the AUTOMATIC ruleset from the complete rules + default.
  const serializedRuleset = useMemo<string>(() => {
    const completeRules = rules
      .filter((r) => isRuleComplete(r, targetByKey.get(r.questionKey)))
      .map(toResultRule);
    const hasDefault = defaultResultId !== "";
    if (completeRules.length === 0 && !hasDefault) return "";
    const ruleset: ResultRuleset = {
      rules: completeRules,
      default_result_id: hasDefault ? defaultResultId : null,
    };
    return JSON.stringify(ruleset);
  }, [rules, defaultResultId, targetByKey]);

  // Emit the consolidated value whenever any input changes.
  useEffect(() => {
    if (!emits) {
      onChange({ emitsResult: false, resultRuleset: "", allowedResultIds: [] });
      return;
    }
    onChange({
      emitsResult: true,
      resultRuleset: automatic ? serializedRuleset : "",
      allowedResultIds: allowedIds,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emits, automatic, serializedRuleset, allowedIds]);

  function addRule() {
    setRules((prev) => [
      ...prev,
      {
        uid: nextUid(),
        criterion: "answer",
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

  function toggleAllowed(id: string) {
    const removing = allowedIds.includes(id);
    setAllowedIds(
      removing ? allowedIds.filter((x) => x !== id) : [...allowedIds, id],
    );
    // Removing an allowed result invalidates any rule/default that referenced it.
    if (removing) {
      setRules((prev) =>
        prev.map((r) => (r.resultId === id ? { ...r, resultId: "" } : r)),
      );
      setDefaultResultId((d) => (d === id ? "" : d));
    }
  }

  // Which aggregate criteria are actually used by a COMPLETE rule — drives which
  // simulated inputs the preview shows.
  const usesScore = useMemo(
    () =>
      rules.some(
        (r) =>
          r.criterion === "score" &&
          isRuleComplete(r, targetByKey.get(r.questionKey)),
      ),
    [rules, targetByKey],
  );
  const usesFlagged = useMemo(
    () =>
      rules.some(
        (r) =>
          r.criterion === "flagged" &&
          isRuleComplete(r, targetByKey.get(r.questionKey)),
      ),
    [rules, targetByKey],
  );

  // The preview answer map = the choice-answer simulations MERGED with the two
  // simulated aggregate keys (as numbers, mirroring computeAggregateKeys), so the
  // unchanged walkResultRuleset sees exactly what the backend compute injects.
  const previewMap = useMemo(() => {
    const map: Record<string, string | number> = { ...previewAnswers };
    if (usesScore && previewScore.trim() !== "") {
      const n = Number(previewScore);
      if (Number.isFinite(n)) map[TOTAL_SCORE_KEY] = n;
    }
    if (usesFlagged && previewFlagged.trim() !== "") {
      const n = Number(previewFlagged);
      if (Number.isFinite(n)) map[FLAGGED_COUNT_KEY] = n;
    }
    return map;
  }, [previewAnswers, usesScore, usesFlagged, previewScore, previewFlagged]);

  // Live preview (AUTOMATIC): walk the COMPLETE ruleset exactly as the backend does.
  const previewResultId = useMemo<string | null>(() => {
    const completeRules = rules
      .filter((r) => isRuleComplete(r, targetByKey.get(r.questionKey)))
      .map(toResultRule);
    if (completeRules.length === 0 && defaultResultId === "") return null;
    const ruleset: ResultRuleset = {
      rules: completeRules,
      default_result_id: defaultResultId || null,
    };
    return walkResultRuleset(ruleset, previewMap);
  }, [rules, defaultResultId, targetByKey, previewMap]);

  const previewResult = previewResultId
    ? resultsById.get(previewResultId)
    : null;

  const previewQuestions = useMemo(() => {
    const keys = new Set<string>();
    for (const r of rules) {
      // Only ANSWER criteria have a preview question; aggregates use the
      // simulated numeric inputs instead.
      if (
        r.criterion === "answer" &&
        isRuleComplete(r, targetByKey.get(r.questionKey))
      )
        keys.add(r.questionKey);
    }
    return [...keys]
      .map((k) => targetByKey.get(k))
      .filter((t): t is PhaseConditionTarget => t != null);
  }, [rules, targetByKey]);

  const hasCompleteRuleset =
    rules.some((r) => isRuleComplete(r, targetByKey.get(r.questionKey))) ||
    defaultResultId !== "";

  // No vocabulary at all — nothing can be emitted; offer no toggles.
  if (results.length === 0) {
    return (
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">Resultado da fase</legend>
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground text-pretty">
          Cadastre ao menos um resultado nas configurações da comissão para
          definir o resultado desta fase.
        </p>
      </fieldset>
    );
  }

  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="text-sm font-semibold">Resultado da fase</legend>
      <p className="text-sm text-muted-foreground text-pretty">
        Defina se esta fase emite um resultado ao ser concluída — escolhido
        manualmente por quem preenche ou calculado automaticamente pelas
        respostas.
      </p>

      <label className="flex items-center gap-2.5 text-sm">
        <Checkbox
          checked={emits}
          onCheckedChange={(c) => setEmits(c === true)}
          disabled={disabled}
        />
        Esta fase emite um resultado
      </label>

      {emits && (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-3">
          <AllowedResultsPicker
            results={results}
            selectedIds={allowedIds}
            onToggle={toggleAllowed}
            disabled={disabled}
          />

          <label className="flex items-start gap-2.5 border-t border-border pt-4 text-sm">
            <Checkbox
              checked={automatic}
              onCheckedChange={(c) => setAutomatic(c === true)}
              disabled={disabled}
              className="mt-0.5"
            />
            <span className="flex flex-col">
              <span className="font-medium">
                Emitir um resultado automático para esta fase
              </span>
              <span className="text-xs text-muted-foreground">
                As respostas decidem o resultado por regras (entre os resultados
                permitidos). Se desmarcado, quem preenche escolhe o resultado
                manualmente.
              </span>
            </span>
          </label>

          {automatic && (
            <AutomaticEditor
              targets={targets}
              results={allowedResults}
              rules={rules}
              defaultResultId={defaultResultId}
              previewAnswers={previewAnswers}
              previewQuestions={previewQuestions}
              previewResult={previewResult ?? null}
              hasCompleteRuleset={hasCompleteRuleset}
              targetByKey={targetByKey}
              usesScore={usesScore}
              usesFlagged={usesFlagged}
              previewScore={previewScore}
              previewFlagged={previewFlagged}
              disabled={disabled}
              onAddRule={addRule}
              onUpdateRule={updateRule}
              onRemoveRule={removeRule}
              onMoveRule={moveRule}
              onChangeDefault={setDefaultResultId}
              onChangePreviewAnswer={(key, val) =>
                setPreviewAnswers((prev) => ({ ...prev, [key]: val }))
              }
              onChangePreviewScore={setPreviewScore}
              onChangePreviewFlagged={setPreviewFlagged}
            />
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

/** The always-shown "Resultados permitidos" checklist (drives `allowedResultIds`),
 *  with a live hint until the minimum is selected. */
function AllowedResultsPicker({
  results,
  selectedIds,
  onToggle,
  disabled,
}: {
  results: PhaseResult[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled: boolean;
}) {
  const tooFew = selectedIds.length < MIN_ALLOWED_RESULTS;
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="text-sm font-medium">Resultados permitidos</legend>
      <p className="text-xs text-muted-foreground text-pretty">
        Selecione ao menos {MIN_ALLOWED_RESULTS} resultados que esta fase pode
        emitir.
      </p>
      <ul className="flex flex-col gap-2">
        {results.map((r) => (
          <li key={r.id}>
            <label className="flex items-center gap-2.5 text-sm">
              <Checkbox
                checked={selectedIds.includes(r.id)}
                onCheckedChange={() => onToggle(r.id)}
                disabled={disabled}
              />
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  TOKEN_STYLES[r.colorToken] ?? TOKEN_STYLES.muted,
                )}
              >
                {r.label}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {tooFew && (
        <p className="text-sm font-medium text-destructive">
          Selecione ao menos {MIN_ALLOWED_RESULTS} resultados permitidos.
        </p>
      )}
    </fieldset>
  );
}

/** AUTOMATIC mode: the ordered ruleset + default + live preview (over the allowed
 *  result subset passed as `results`). */
function AutomaticEditor({
  targets,
  results,
  rules,
  defaultResultId,
  previewAnswers,
  previewQuestions,
  previewResult,
  hasCompleteRuleset,
  targetByKey,
  usesScore,
  usesFlagged,
  previewScore,
  previewFlagged,
  disabled,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
  onMoveRule,
  onChangeDefault,
  onChangePreviewAnswer,
  onChangePreviewScore,
  onChangePreviewFlagged,
}: {
  targets: PhaseConditionTarget[];
  results: PhaseResult[];
  rules: DraftRule[];
  defaultResultId: string;
  previewAnswers: Record<string, string>;
  previewQuestions: PhaseConditionTarget[];
  previewResult: PhaseResult | null;
  hasCompleteRuleset: boolean;
  targetByKey: Map<string, PhaseConditionTarget>;
  /** Whether a COMPLETE rule uses the score / flagged aggregate (drives the
   *  simulated preview inputs). */
  usesScore: boolean;
  usesFlagged: boolean;
  previewScore: string;
  previewFlagged: string;
  disabled: boolean;
  onAddRule: () => void;
  onUpdateRule: (uid: string, patch: Partial<DraftRule>) => void;
  onRemoveRule: (uid: string) => void;
  onMoveRule: (index: number, direction: "up" | "down") => void;
  onChangeDefault: (id: string) => void;
  onChangePreviewAnswer: (key: string, value: string) => void;
  onChangePreviewScore: (value: string) => void;
  onChangePreviewFlagged: (value: string) => void;
}) {
  if (results.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground text-pretty">
        Selecione os resultados permitidos acima para usá-los nas regras.
      </p>
    );
  }

  // A phase with NO choice questions can still build score/flagged aggregate
  // rules (they need no target), so a missing choice-question set is only an
  // informational note now — never a block.
  const noAnswerTargets = targets.length === 0;

  return (
    <>
      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium">Regras</span>
        {noAnswerTargets ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground text-pretty">
            O formulário desta fase não tem perguntas de múltipla escolha. Você
            ainda pode usar critérios de <strong>pontuação total</strong> ou{" "}
            <strong>itens marcados</strong> abaixo, ou definir apenas um resultado
            padrão.
          </p>
        ) : null}
        {rules.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
            Nenhuma regra ainda. Adicione uma regra ou defina apenas um resultado
            padrão abaixo.
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
                onUpdate={(patch) => onUpdateRule(rule.uid, patch)}
                onRemove={() => onRemoveRule(rule.uid)}
                onMove={(d) => onMoveRule(index, d)}
              />
            ))}
          </ul>
        )}
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddRule}
            className="w-fit"
          >
            <Plus aria-hidden="true" />
            Adicionar regra
          </Button>
        )}
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Resultado padrão</span>
        <NativeSelect
          className="h-10"
          value={defaultResultId}
          onChange={(e) => onChangeDefault(e.target.value)}
          disabled={disabled}
        >
          <option value="">Nenhum (sem resultado padrão)</option>
          {results.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </NativeSelect>
        <span className="text-xs text-muted-foreground">
          Aplicado quando nenhuma regra acima corresponde.
        </span>
      </label>

      {hasCompleteRuleset && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3">
          <span className="text-sm font-medium">
            Pré-visualizar: se as respostas fossem
          </span>
          {previewQuestions.length === 0 && !usesScore && !usesFlagged ? (
            <p className="text-sm text-muted-foreground text-pretty">
              Sem regras com perguntas — o resultado padrão será sempre aplicado.
            </p>
          ) : (
            <>
              {previewQuestions.map((target) => (
                <label
                  key={target.questionKey}
                  className="flex flex-col gap-1.5 text-sm"
                >
                  <span className="font-medium">
                    {target.label || target.questionKey}
                  </span>
                  {/* The preview feeds answers into walkResultRuleset over a
                      code-keyed answer map, so it stores the option CODE (shows
                      label) — form-model-normalization. */}
                  <NativeSelect
                    className="h-10"
                    value={previewAnswers[target.questionKey] ?? ""}
                    onChange={(e) =>
                      onChangePreviewAnswer(target.questionKey, e.target.value)
                    }
                  >
                    <option value="">Sem resposta</option>
                    {target.options.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              ))}
              {/* Simulated aggregate inputs (form-builder-enhancements): the
                  author types a hypothetical total-score / flagged-count to see
                  whether the aggregate rules fire — the same synthetic keys the
                  backend compute injects. */}
              {usesScore ? (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">Pontuação total</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={previewScore}
                    onChange={(e) => onChangePreviewScore(e.target.value)}
                    placeholder="Ex.: 8"
                    className="h-10"
                  />
                </label>
              ) : null}
              {usesFlagged ? (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">Itens marcados</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={previewFlagged}
                    onChange={(e) => onChangePreviewFlagged(e.target.value)}
                    placeholder="Ex.: 2"
                    className="h-10"
                  />
                </label>
              ) : null}
            </>
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
                    TOKEN_STYLES[previewResult.colorToken] ?? TOKEN_STYLES.muted,
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
    </>
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
  // form-model-normalization: the rule's answer condition STORES the option code
  // (the code-keyed answer_map evaluates on codes); the picker shows the label.
  function toggleMulti(code: string) {
    const next = rule.multiValue.includes(code)
      ? rule.multiValue.filter((c) => c !== code)
      : [...rule.multiValue, code];
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

        {/* Criterion: an earlier CHOICE answer, or the phase's aggregate
            pontuação total / itens marcados (form-builder-enhancements). Changing
            it resets the value pickers + the op (aggregate ops differ). */}
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Critério</span>
          <NativeSelect
            className="h-10"
            value={rule.criterion}
            onChange={(e) => {
              const criterion = e.target.value as Criterion;
              onUpdate({
                criterion,
                questionKey: "",
                singleValue: "",
                multiValue: [],
                // Answer criteria default to equality; aggregates to "maior que".
                op: criterion === "answer" ? "equals" : "gt",
              });
            }}
            disabled={disabled}
          >
            <option value="answer">Resposta de uma pergunta</option>
            <option value="score">Pontuação total da fase</option>
            <option value="flagged">Itens marcados da fase</option>
          </NativeSelect>
        </label>

        {rule.criterion === "answer" ? (
          <>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Quando a resposta de</span>
              <NativeSelect
                className="h-10"
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
              </NativeSelect>
            </label>

            {target && (
              <>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">A condição</span>
                  <NativeSelect
                    className="h-10"
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
                    {(["equals", "not_equals", "in"] as ConditionOp[]).map(
                      (o) => (
                        <option key={o} value={o}>
                          {OP_LABELS[o]}
                        </option>
                      ),
                    )}
                  </NativeSelect>
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
                      <label
                        key={opt.code}
                        className="flex items-center gap-2.5 text-sm"
                      >
                        <Checkbox
                          checked={rule.multiValue.includes(opt.code)}
                          onCheckedChange={() => toggleMulti(opt.code)}
                          disabled={disabled}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </fieldset>
                ) : (
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium">Valor</span>
                    <NativeSelect
                      className="h-10"
                      value={rule.singleValue}
                      onChange={(e) => onUpdate({ singleValue: e.target.value })}
                      disabled={disabled}
                    >
                      <option value="">Selecione…</option>
                      {target.options.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                )}
              </>
            )}
          </>
        ) : (
          // AGGREGATE criterion (score / flagged): ordered-op + numeric threshold.
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium">A condição</span>
              <NativeSelect
                className="h-10"
                value={rule.op}
                onChange={(e) =>
                  onUpdate({ op: e.target.value as ConditionOp })
                }
                disabled={disabled}
              >
                {AGGREGATE_OPS.map((o) => (
                  <option key={o} value={o}>
                    {OP_LABELS[o]}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium">Valor</span>
              <Input
                type="number"
                inputMode="numeric"
                value={rule.singleValue}
                onChange={(e) => onUpdate({ singleValue: e.target.value })}
                placeholder="Ex.: 5"
                className="h-10"
                disabled={disabled}
              />
            </label>
          </div>
        )}

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Então o resultado é</span>
          <NativeSelect
            className="h-10"
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
          </NativeSelect>
        </label>
      </div>
    </li>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import type { PhaseConditionTarget } from "@/lib/queries/process-templates";
import type { ConditionOp, RecommendWhen } from "@/lib/queries/conditions";
import { evalCondition } from "@/lib/queries/conditions";
import { Checkbox } from "@/components/ui/checkbox";
import type { PhaseWithTargets } from "@/components/process-templates/phase-with-targets";

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

const OP_LABELS: Record<ConditionOp, string> = {
  equals: "for igual a",
  not_equals: "for diferente de",
  in: "for uma das opções",
};

/**
 * The cross-phase `recommend_when` editor (F2). Builds a `RecommendWhen`
 * (`{ from_phase, question_key, op, value }`) by picking:
 *   1. an EARLIER phase (sets `from_phase`),
 *   2. a CHOICE question of that phase's form (from `conditionTargetsByForm`),
 *   3. an operator (equals / not_equals / in),
 *   4. a discrete value (single option, or a multi-select for `in`).
 *
 * It serializes the result to a JSON string via `onChange` (or "" for none),
 * which {@link PhaseSlotDialog} sends in the `recommendWhen` hidden field. The
 * pickers are discrete so an author can only build a structurally valid
 * condition; the backend re-validates at add/update/publish (P0016).
 *
 * Two affordances beyond the section condition editor:
 *  - **Live preview** — the author picks a hypothetical answer and we run the
 *    EXACT mirror the backend evaluates (`evalCondition` with `from_phase`
 *    stripped) to show "Recomendaria / Não recomendaria".
 *  - **`not_equals` footgun warning** — any phase can be skipped at runtime, and
 *    `not_equals` over an empty (skipped/unfilled) answer map evaluates TRUE. We
 *    warn on EVERY `not_equals` so the author understands the phase would be
 *    recommended even when the source phase was never filled. Non-blocking.
 */
export function RecommendWhenEditor({
  phasePosition,
  phases,
  value,
  onChange,
  error,
}: {
  /** 1-based position of the phase being edited (only earlier phases qualify). */
  phasePosition: number;
  phases: PhaseWithTargets[];
  /** Current serialized RecommendWhen JSON ("" = none). */
  value: string;
  onChange: (next: string) => void;
  error?: string;
}) {
  // Earlier phases only (strictly lower position). Each carries the bound form's
  // choice questions, pre-resolved server-side and attached below.
  const earlierPhases = useMemo(
    () => phases.filter((p) => p.position < phasePosition),
    [phases, phasePosition],
  );

  // Parse the incoming value once for initial local state.
  const initial = useMemo<RecommendWhen | null>(() => {
    if (!value) return null;
    try {
      return JSON.parse(value) as RecommendWhen;
    } catch {
      return null;
    }
  }, [value]);

  const [enabled, setEnabled] = useState<boolean>(initial !== null);
  const [fromPhase, setFromPhase] = useState<number | "">(
    initial?.from_phase ?? "",
  );
  const [questionKey, setQuestionKey] = useState<string>(
    initial?.question_key ?? "",
  );
  const [op, setOp] = useState<ConditionOp>(initial?.op ?? "equals");
  const [singleValue, setSingleValue] = useState<string>(
    typeof initial?.value === "string" ? initial.value : "",
  );
  const [multiValue, setMultiValue] = useState<string[]>(
    Array.isArray(initial?.value) ? initial.value.map(String) : [],
  );
  // The hypothetical answer for the live preview (not persisted).
  const [previewAnswer, setPreviewAnswer] = useState<string>("");

  // Targets of the selected source phase.
  const sourcePhase = earlierPhases.find((p) => p.position === fromPhase) ?? null;
  const targets: PhaseConditionTarget[] = sourcePhase?.conditionTargets ?? [];
  const selectedTarget =
    targets.find((t) => t.questionKey === questionKey) ?? null;

  const conditionComplete =
    enabled &&
    fromPhase !== "" &&
    selectedTarget !== null &&
    (op === "in" ? multiValue.length > 0 : singleValue !== "");

  // Serialize up to the parent whenever the condition changes.
  useEffect(() => {
    if (!conditionComplete || typeof fromPhase !== "number" || !selectedTarget) {
      onChange("");
      return;
    }
    const condition: RecommendWhen = {
      from_phase: fromPhase,
      question_key: questionKey,
      op,
      value: op === "in" ? multiValue : singleValue,
    };
    onChange(JSON.stringify(condition));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditionComplete, fromPhase, questionKey, op, singleValue, multiValue]);

  function resetCondition() {
    setFromPhase("");
    setQuestionKey("");
    setOp("equals");
    setSingleValue("");
    setMultiValue([]);
    setPreviewAnswer("");
  }

  function toggleMulti(option: string) {
    setMultiValue((prev) =>
      prev.includes(option)
        ? prev.filter((o) => o !== option)
        : [...prev, option],
    );
  }

  // Live preview: run the exact mirror the backend evaluates (from_phase
  // stripped) against the hypothetical answer. A plain computed value — the
  // evaluator is a trivial pure call, no memoization needed.
  const previewResult: boolean | null =
    conditionComplete && selectedTarget && previewAnswer !== ""
      ? evalCondition(
          {
            question_key: questionKey,
            op,
            value: op === "in" ? multiValue : singleValue,
          },
          { [questionKey]: previewAnswer },
        )
      : null;

  const showNotEqualsWarning = enabled && op === "not_equals" && fromPhase !== "";

  if (phasePosition <= 1 || earlierPhases.length === 0) {
    return (
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">Recomendação automática</legend>
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
          A primeira fase não pode depender de uma fase anterior. Adicione fases
          anteriores para condicionar a recomendação desta fase.
        </p>
      </fieldset>
    );
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-semibold">Recomendação automática</legend>
      <p className="text-sm text-muted-foreground text-pretty">
        Esta fase pode ser recomendada automaticamente conforme a resposta de uma
        fase anterior. A recomendação é apenas uma sugestão — a coordenação confirma
        a ativação.
      </p>

      <label className="flex items-center gap-2.5 text-sm">
        <Checkbox
          checked={enabled}
          onCheckedChange={(c) => {
            const on = c === true;
            setEnabled(on);
            if (!on) resetCondition();
          }}
        />
        Recomendar esta fase com base em uma fase anterior
      </label>

      {enabled && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Fase de origem</span>
            <select
              className={SELECT_CLASS}
              value={fromPhase === "" ? "" : String(fromPhase)}
              onChange={(e) => {
                const next = e.target.value === "" ? "" : Number(e.target.value);
                setFromPhase(next);
                setQuestionKey("");
                setSingleValue("");
                setMultiValue([]);
                setPreviewAnswer("");
              }}
            >
              <option value="">Selecione uma fase…</option>
              {earlierPhases.map((p) => (
                <option key={p.id} value={p.position}>
                  Fase {p.position}
                  {p.title ? ` — ${p.title}` : p.formTitle ? ` — ${p.formTitle}` : ""}
                </option>
              ))}
            </select>
          </label>

          {fromPhase !== "" && targets.length === 0 && (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
              O formulário desta fase de origem não tem perguntas de múltipla
              escolha para condicionar a recomendação.
            </p>
          )}

          {fromPhase !== "" && targets.length > 0 && (
            <>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Quando a resposta de</span>
                <select
                  className={SELECT_CLASS}
                  value={questionKey}
                  onChange={(e) => {
                    setQuestionKey(e.target.value);
                    setSingleValue("");
                    setMultiValue([]);
                    setPreviewAnswer("");
                  }}
                >
                  <option value="">Selecione uma pergunta…</option>
                  {targets.map((t) => (
                    <option key={t.questionKey} value={t.questionKey}>
                      {t.label || t.questionKey}
                    </option>
                  ))}
                </select>
              </label>

              {selectedTarget && (
                <>
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium">A condição</span>
                    <select
                      className={SELECT_CLASS}
                      value={op}
                      onChange={(e) => {
                        setOp(e.target.value as ConditionOp);
                        setSingleValue("");
                        setMultiValue([]);
                        setPreviewAnswer("");
                      }}
                    >
                      {(["equals", "not_equals", "in"] as ConditionOp[]).map((o) => (
                        <option key={o} value={o}>
                          {OP_LABELS[o]}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedTarget.options.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Esta pergunta não tem opções definidas.
                    </p>
                  ) : op === "in" ? (
                    <fieldset className="flex flex-col gap-2">
                      <legend className="text-sm font-medium">
                        Opções selecionadas
                      </legend>
                      {selectedTarget.options.map((opt) => (
                        <label
                          key={opt}
                          className="flex items-center gap-2.5 text-sm"
                        >
                          <Checkbox
                            checked={multiValue.includes(opt)}
                            onCheckedChange={() => toggleMulti(opt)}
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
                        value={singleValue}
                        onChange={(e) => setSingleValue(e.target.value)}
                      >
                        <option value="">Selecione…</option>
                        {selectedTarget.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {showNotEqualsWarning && (
                    <p
                      role="status"
                      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive text-pretty"
                    >
                      <AlertTriangle
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                      />
                      <span>
                        Atenção: “for diferente de” também recomenda esta fase
                        quando a fase de origem não é preenchida (por exemplo, se
                        ela for ignorada). Nesse caso a recomendação aparece sem que
                        haja resposta de origem.
                      </span>
                    </p>
                  )}

                  {/* Live preview against a hypothetical answer */}
                  {selectedTarget.options.length > 0 && conditionComplete && (
                    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
                      <label className="flex flex-col gap-1.5 text-sm">
                        <span className="font-medium">
                          Pré-visualizar: se a resposta fosse
                        </span>
                        <select
                          className={SELECT_CLASS}
                          value={previewAnswer}
                          onChange={(e) => setPreviewAnswer(e.target.value)}
                        >
                          <option value="">Selecione uma resposta…</option>
                          {selectedTarget.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                      {previewResult !== null && (
                        <p
                          className={
                            previewResult
                              ? "animate-fade-in inline-flex items-center gap-1.5 text-sm font-medium text-primary"
                              : "animate-fade-in inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground"
                          }
                        >
                          {previewResult ? (
                            <CheckCircle2 aria-hidden="true" className="size-4" />
                          ) : (
                            <XCircle aria-hidden="true" className="size-4" />
                          )}
                          {previewResult
                            ? "Recomendaria esta fase."
                            : "Não recomendaria esta fase."}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
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

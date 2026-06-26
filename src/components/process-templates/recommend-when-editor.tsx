"use client";

import { useId, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, Trash2, XCircle } from "lucide-react";

import type { PhaseConditionTarget } from "@/lib/queries/process-templates";
import type {
  RecommendAnswerCond,
  RecommendCond,
  RecommendGroup,
  RecommendRule,
  RecommendWhen,
} from "@/lib/queries/conditions";
import {
  evalRecommendation,
  type RecommendPhaseData,
} from "@/lib/queries/conditions";
import type { PhaseResult } from "@/lib/queries/phase-results";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { PhaseWithTargets } from "@/components/process-templates/phase-with-targets";

// ---------------------------------------------------------------------------
// Shared style constants (matches the rest of this feature tree)
// ---------------------------------------------------------------------------

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

// ---------------------------------------------------------------------------
// Types — per-row draft state
// ---------------------------------------------------------------------------

/**
 * Which kind of source this row reads.
 *  - `'answer'` — reads a choice answer from an earlier phase's submitted form.
 *  - `'result-specific'` — reads which specific result option a phase landed on.
 *  - `'result-adverse'` — reads whether the phase's result is marked as adverse.
 */
type RowSource = "answer" | "result-specific" | "result-adverse";

/** Local draft state for one condition row in the group builder. */
interface DraftRow {
  uid: string;
  source: RowSource;
  // --- Answer fields ---
  /** Position of the source phase (earlier phase). */
  fromPhase: number | "";
  /** Selected question key (answer rows). */
  questionKey: string;
  /** Operator (equals / not_equals / in) for answer or result-specific rows. */
  op: "equals" | "not_equals" | "in";
  /** Single value (equals/not_equals for both answer and result-specific). */
  singleValue: string;
  /** Multi-select values (`in` op). For answer rows these are option labels;
   *  for result-specific rows these are result ids. */
  multiValue: string[];
  // --- Result-adverse fields ---
  /** Whether we're matching adverse=true or adverse=false. */
  adverseValue: boolean;
  // --- Live preview state ---
  /** Hypothetical answer option for the live-preview select (answer rows). */
  previewAnswer: string;
  /** Hypothetical result id for the live-preview select (result-specific rows). */
  previewResultId: string;
  /** Hypothetical adverse value for the live-preview toggle (result-adverse rows). */
  previewAdverse: boolean | "";
}

let uidCounter = 0;
function nextUid(): string {
  uidCounter += 1;
  return `rw-${uidCounter}`;
}

function emptyRow(): DraftRow {
  return {
    uid: nextUid(),
    source: "answer",
    fromPhase: "",
    questionKey: "",
    op: "equals",
    singleValue: "",
    multiValue: [],
    adverseValue: true,
    previewAnswer: "",
    previewResultId: "",
    previewAdverse: "",
  };
}

// ---------------------------------------------------------------------------
// Parse helpers — `RecommendRule` → draft rows
// ---------------------------------------------------------------------------

/**
 * Discriminate: does this stored shape look like the legacy single `RecommendWhen`
 * (has `from_phase` at top level, not a `conditions` array)?
 */
function isLegacySingle(rule: RecommendRule): rule is RecommendWhen {
  return !Array.isArray((rule as RecommendGroup).conditions);
}

/**
 * Convert a `RecommendCond` from a `RecommendGroup` into a `DraftRow`.
 * The legacy single `RecommendWhen` is normalised to one answer-source row by
 * the caller before arriving here.
 */
function condToRow(c: RecommendCond): DraftRow {
  const row = emptyRow();
  row.fromPhase = c.from_phase;

  if (c.source !== "result") {
    // Answer condition (legacy or explicit `source:'answer'`).
    const ac = c as RecommendAnswerCond;
    row.source = "answer";
    row.questionKey = ac.question_key;
    row.op = ac.op;
    if (Array.isArray(ac.value)) {
      row.multiValue = ac.value.map(String);
    } else {
      row.singleValue = ac.value != null ? String(ac.value) : "";
    }
    return row;
  }

  if ("adverse" in c) {
    // Result-adverse condition.
    row.source = "result-adverse";
    row.adverseValue = c.adverse;
    return row;
  }

  // Result-specific condition.
  row.source = "result-specific";
  row.op = c.op;
  if (Array.isArray(c.value)) {
    row.multiValue = c.value.map(String);
  } else {
    row.singleValue = c.value != null ? String(c.value) : "";
  }
  return row;
}

/**
 * Parse the incoming `value` string (JSON `RecommendRule`, or "") into draft
 * rows + match combinator. Handles BOTH the legacy single shape and the new
 * group shape.
 *
 * A legacy single is normalised to a one-row group with `match:'all'` — the
 * editor always re-serializes as a group (desired per ADR 0043).
 */
function initialToRows(value: string): {
  enabled: boolean;
  match: "all" | "any";
  rows: DraftRow[];
} {
  if (!value) return { enabled: false, match: "all", rows: [] };
  let rule: RecommendRule;
  try {
    rule = JSON.parse(value) as RecommendRule;
  } catch {
    return { enabled: false, match: "all", rows: [] };
  }

  if (isLegacySingle(rule)) {
    // Legacy single (answer-only) — normalise to one row, match:'all'.
    const row = emptyRow();
    row.fromPhase = rule.from_phase;
    row.source = "answer";
    row.questionKey = rule.question_key;
    row.op = rule.op as "equals" | "not_equals" | "in";
    if (Array.isArray(rule.value)) {
      row.multiValue = rule.value.map(String);
    } else {
      row.singleValue = rule.value != null ? String(rule.value) : "";
    }
    return { enabled: true, match: "all", rows: [row] };
  }

  // Group shape.
  const g = rule as RecommendGroup;
  const rows = g.conditions.map(condToRow);
  return { enabled: rows.length > 0, match: g.match, rows };
}

// ---------------------------------------------------------------------------
// Serialize helpers — draft rows → `RecommendGroup` JSON
// ---------------------------------------------------------------------------

/** Whether a draft row has enough information to emit a valid `RecommendCond`. */
function isRowComplete(row: DraftRow, hasTargets: boolean): boolean {
  if (row.fromPhase === "") return false;
  if (row.source === "answer") {
    if (!row.questionKey) return false;
    if (!hasTargets) return false;
    if (row.op === "in") return row.multiValue.length > 0;
    return row.singleValue !== "";
  }
  if (row.source === "result-specific") {
    if (row.op === "in") return row.multiValue.length > 0;
    return row.singleValue !== "";
  }
  // result-adverse: adverseValue is always set (boolean).
  return true;
}

/** Serialize a complete `DraftRow` to a `RecommendCond`. */
function rowToCond(row: DraftRow): RecommendCond {
  if (row.source === "answer") {
    return {
      source: "answer",
      from_phase: row.fromPhase as number,
      question_key: row.questionKey,
      op: row.op,
      value: row.op === "in" ? row.multiValue : row.singleValue,
    };
  }
  if (row.source === "result-adverse") {
    return {
      source: "result",
      from_phase: row.fromPhase as number,
      adverse: row.adverseValue,
    };
  }
  // result-specific
  return {
    source: "result",
    from_phase: row.fromPhase as number,
    op: row.op,
    value: row.op === "in" ? row.multiValue : row.singleValue,
  };
}

// ---------------------------------------------------------------------------
// Live-preview helper
// ---------------------------------------------------------------------------

/**
 * Build a `RecommendPhaseData` from a hypothetical pick for a SINGLE row, so we
 * can call `evalRecommendation` with a one-row group to show "Recomendaria / Não
 * recomendaria" inline on each row. We build a single-condition `all` group on
 * the fly — the exported `evalRecommendation` handles both shapes.
 */
function rowPreviewResult(row: DraftRow): boolean | null {
  // Not enough state for a preview.
  if (row.fromPhase === "") return null;

  const cond = rowToCond(row);
  const syntheticRule: RecommendGroup = { match: "all", conditions: [cond] };

  if (row.source === "answer") {
    if (!row.questionKey || row.previewAnswer === "") return null;
    const data: RecommendPhaseData = {
      answers: { [row.questionKey]: row.previewAnswer },
      resultId: null,
      resultAdverse: null,
    };
    return evalRecommendation(syntheticRule, () => data);
  }

  if (row.source === "result-specific") {
    const hasValue = row.op === "in" ? row.multiValue.length > 0 : row.singleValue !== "";
    if (!hasValue || row.previewResultId === "") return null;
    const data: RecommendPhaseData = {
      answers: {},
      resultId: row.previewResultId,
      resultAdverse: null,
    };
    return evalRecommendation(syntheticRule, () => data);
  }

  // result-adverse: preview is controlled directly by previewAdverse toggle.
  if (row.previewAdverse === "") return null;
  const data: RecommendPhaseData = {
    answers: {},
    resultId: "synthetic",
    resultAdverse: row.previewAdverse as boolean,
  };
  return evalRecommendation(syntheticRule, () => data);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * The cross-phase `recommend_when` group builder (FR1, ADR 0043). Replaces the
 * single-condition editor with a full TODAS/QUALQUER (AND/OR) group builder that
 * supports BOTH answer conditions (existing behaviour, fully preserved) AND result
 * conditions: specific result option (`equals/not_equals/in`) or adverse flag.
 *
 * Controlled: the parent owns the serialized JSON (`value`/`onChange`). The
 * editor always emits a `RecommendGroup` even for a single row (re-normalisation
 * of any legacy single shape is transparent). "" = disabled / incomplete.
 *
 * New props over the legacy editor:
 *   - `phaseResults`        — the commission's result vocabulary (for result rows).
 *   - `phaseResultsEnabled` — when false the "Resultado de fase" source option is
 *                             hidden and result rows are not buildable.
 */
export function RecommendWhenEditor({
  phasePosition,
  phases,
  phaseResults,
  phaseResultsEnabled,
  value,
  onChange,
  error,
}: {
  /** 1-based position of the phase being edited (only EARLIER phases qualify). */
  phasePosition: number;
  phases: PhaseWithTargets[];
  /** The commission's active result vocabulary (used by result-source rows). */
  phaseResults: PhaseResult[];
  /** Whether `case_phase_results` feature is on (gates the result-source option). */
  phaseResultsEnabled: boolean;
  /** Current serialized `RecommendGroup` JSON ("" = none). */
  value: string;
  onChange: (next: string) => void;
  error?: string;
}) {
  const groupId = useId();

  // Earlier phases only (strictly lower position).
  const earlierPhases = useMemo(
    () => phases.filter((p) => p.position < phasePosition),
    [phases, phasePosition],
  );

  // Parse incoming value once for initial local state.
  const initial = useMemo(() => initialToRows(value), [value]);

  const [enabled, setEnabled] = useState<boolean>(initial.enabled);
  const [match, setMatch] = useState<"all" | "any">(initial.match);
  const [rows, setRows] = useState<DraftRow[]>(
    initial.rows.length > 0 ? initial.rows : [],
  );

  // ---------------------------------------------------------------------------
  // Serialization — emit up to parent on every state change
  // ---------------------------------------------------------------------------

  /** Build and emit the serialized `RecommendGroup` (or "" if invalid). */
  function emitGroup(nextRows: DraftRow[], nextMatch: "all" | "any", on: boolean) {
    if (!on) {
      onChange("");
      return;
    }

    const completeRows = nextRows.filter((row) => {
      const sourcePhase = earlierPhases.find((p) => p.position === row.fromPhase);
      const hasAnswerTargets = (sourcePhase?.conditionTargets ?? []).length > 0;
      return isRowComplete(row, row.source === "answer" ? hasAnswerTargets : true);
    });

    if (completeRows.length === 0) {
      onChange("");
      return;
    }

    const group: RecommendGroup = {
      match: nextMatch,
      conditions: completeRows.map(rowToCond),
    };
    onChange(JSON.stringify(group));
  }

  function setRowsAndEmit(next: DraftRow[]) {
    setRows(next);
    emitGroup(next, match, enabled);
  }

  function toggleEnabled(on: boolean) {
    setEnabled(on);
    let next = rows;
    if (on && rows.length === 0) {
      next = [emptyRow()];
      setRows(next);
    }
    if (!on) {
      // Keep rows in local state so re-enabling restores them, but emit "".
      onChange("");
      return;
    }
    emitGroup(next, match, on);
  }

  function changeMatch(next: "all" | "any") {
    setMatch(next);
    emitGroup(rows, next, enabled);
  }

  function addRow() {
    setRowsAndEmit([...rows, emptyRow()]);
  }

  function removeRow(uid: string) {
    setRowsAndEmit(rows.filter((r) => r.uid !== uid));
  }

  function updateRow(uid: string, patch: Partial<DraftRow>) {
    setRowsAndEmit(rows.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  }

  // ---------------------------------------------------------------------------
  // Empty state: first phase (or no earlier phases)
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-semibold">Recomendação automática</legend>
      <p className="text-sm text-muted-foreground text-pretty">
        Esta fase pode ser recomendada automaticamente com base em respostas ou
        resultados de fases anteriores. A recomendação é apenas uma sugestão — a
        coordenação confirma a ativação.
      </p>

      <label className="flex items-center gap-2.5 text-sm">
        <Checkbox
          checked={enabled}
          onCheckedChange={(c) => toggleEnabled(c === true)}
        />
        Recomendar esta fase com base em fases anteriores
      </label>

      {enabled && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
          {/* TODAS / QUALQUER combinator — only shown when >1 row */}
          {rows.length > 1 && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Combinar condições</span>
              <select
                className={SELECT_CLASS}
                value={match}
                onChange={(e) => changeMatch(e.target.value as "all" | "any")}
                aria-label="Combinar condições de recomendação"
              >
                <option value="all">Atender a TODAS as condições</option>
                <option value="any">Atender a QUALQUER condição</option>
              </select>
            </label>
          )}

          {/* Condition rows */}
          <ul className="flex flex-col gap-3" aria-label="Condições de recomendação">
            {rows.map((row, index) => (
              <ConditionRow
                key={row.uid}
                row={row}
                index={index}
                match={match}
                rowCount={rows.length}
                groupId={groupId}
                earlierPhases={earlierPhases}
                phaseResults={phaseResults}
                phaseResultsEnabled={phaseResultsEnabled}
                onUpdate={(patch) => updateRow(row.uid, patch)}
                onRemove={() => removeRow(row.uid)}
              />
            ))}
          </ul>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            className="w-fit"
          >
            <Plus aria-hidden="true" />
            Adicionar condição
          </Button>

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

// ---------------------------------------------------------------------------
// ConditionRow — renders one condition row in the group
// ---------------------------------------------------------------------------

function ConditionRow({
  row,
  index,
  match,
  rowCount,
  groupId,
  earlierPhases,
  phaseResults,
  phaseResultsEnabled,
  onUpdate,
  onRemove,
}: {
  row: DraftRow;
  index: number;
  match: "all" | "any";
  rowCount: number;
  groupId: string;
  earlierPhases: PhaseWithTargets[];
  phaseResults: PhaseResult[];
  phaseResultsEnabled: boolean;
  onUpdate: (patch: Partial<DraftRow>) => void;
  onRemove: () => void;
}) {
  const rowId = `${groupId}-row-${row.uid}`;

  // Source phase for this row.
  const sourcePhase =
    row.fromPhase !== ""
      ? (earlierPhases.find((p) => p.position === row.fromPhase) ?? null)
      : null;

  // Filter earlier phases by what the source type allows.
  // For result-source rows we only show phases with `emitsResult === true`.
  const qualifyingPhases =
    row.source === "answer"
      ? earlierPhases
      : earlierPhases.filter((p) => p.emitsResult);

  const answerTargets: PhaseConditionTarget[] =
    sourcePhase?.conditionTargets ?? [];
  const selectedTarget =
    answerTargets.find((t) => t.questionKey === row.questionKey) ?? null;

  // Result options available for this source phase (limited to allowedResultIds).
  const allowedResultIds = sourcePhase?.allowedResultIds ?? null;
  const availableResults = phaseResults.filter(
    (r) =>
      !r.archived &&
      (allowedResultIds === null || allowedResultIds.includes(r.id)),
  );

  // Whether any result-emitting phase exists at all.
  const hasResultPhases = earlierPhases.some((p) => p.emitsResult);

  // Per-row preview result.
  const preview = rowPreviewResult(row);

  // not_equals footgun warning: applies to answer AND result-specific rows.
  const showNotEqualsWarning =
    row.op === "not_equals" && row.fromPhase !== "";

  // Connector label (first row, "E quando", "Ou quando").
  const connectorLabel =
    index === 0
      ? "Recomendar quando"
      : match === "all"
        ? "E quando"
        : "Ou quando";

  return (
    <li className="flex flex-col gap-2.5 rounded-lg border border-border/70 bg-background/50 p-3">
      {/* Row header: connector label + remove button */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{connectorLabel}</p>
        {rowCount > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label={`Remover condição ${index + 1}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* Source type toggle: "Resposta de fase" | "Resultado de fase" */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium">Tipo de origem</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${rowId}-source`}
              value="answer"
              checked={row.source === "answer"}
              onChange={() =>
                onUpdate({
                  source: "answer",
                  fromPhase: "",
                  questionKey: "",
                  op: "equals",
                  singleValue: "",
                  multiValue: [],
                  previewAnswer: "",
                  previewResultId: "",
                  previewAdverse: "",
                })
              }
              className="size-4 accent-primary focus-visible:ring-[3px] focus-visible:ring-ring/40"
            />
            Resposta de fase
          </label>
          {phaseResultsEnabled && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${rowId}-source`}
                value="result"
                checked={
                  row.source === "result-specific" ||
                  row.source === "result-adverse"
                }
                onChange={() =>
                  onUpdate({
                    source: "result-specific",
                    fromPhase: "",
                    questionKey: "",
                    op: "equals",
                    singleValue: "",
                    multiValue: [],
                    previewAnswer: "",
                    previewResultId: "",
                    previewAdverse: "",
                  })
                }
                className="size-4 accent-primary focus-visible:ring-[3px] focus-visible:ring-ring/40"
              />
              Resultado de fase
            </label>
          )}
        </div>
      </fieldset>

      {/* Source phase picker */}
      <label className="flex flex-col gap-1.5 text-sm" htmlFor={`${rowId}-from-phase`}>
        <span className="font-medium">Fase de origem</span>
        <select
          id={`${rowId}-from-phase`}
          className={SELECT_CLASS}
          value={row.fromPhase === "" ? "" : String(row.fromPhase)}
          onChange={(e) => {
            const next = e.target.value === "" ? "" : Number(e.target.value);
            onUpdate({
              fromPhase: next,
              questionKey: "",
              singleValue: "",
              multiValue: [],
              previewAnswer: "",
              previewResultId: "",
              previewAdverse: "",
            });
          }}
        >
          <option value="">Selecione uma fase…</option>
          {qualifyingPhases.map((p) => (
            <option key={p.id} value={p.position}>
              Fase {p.position}
              {p.title
                ? ` — ${p.title}`
                : p.formTitle
                  ? ` — ${p.formTitle}`
                  : ""}
            </option>
          ))}
        </select>

        {/* Hint when no result-emitting phase qualifies */}
        {(row.source === "result-specific" || row.source === "result-adverse") &&
          !hasResultPhases && (
            <span className="text-xs text-muted-foreground">
              Nenhuma fase anterior está configurada para emitir resultado.
            </span>
          )}
        {(row.source === "result-specific" || row.source === "result-adverse") &&
          hasResultPhases &&
          qualifyingPhases.length === 0 && (
            <span className="text-xs text-muted-foreground">
              Nenhuma fase anterior com emissão de resultado encontrada.
            </span>
          )}
      </label>

      {/* === ANSWER ROW CONTROLS === */}
      {row.source === "answer" && row.fromPhase !== "" && (
        <AnswerRowControls
          rowId={rowId}
          row={row}
          targets={answerTargets}
          selectedTarget={selectedTarget}
          onUpdate={onUpdate}
        />
      )}

      {/* === RESULT ROW CONTROLS === */}
      {(row.source === "result-specific" || row.source === "result-adverse") &&
        row.fromPhase !== "" && (
          <ResultRowControls
            rowId={rowId}
            row={row}
            availableResults={availableResults}
            sourcePhaseHasResult={sourcePhase?.emitsResult ?? false}
            onUpdate={onUpdate}
          />
        )}

      {/* not_equals footgun warning */}
      {showNotEqualsWarning && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive text-pretty"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Atenção: &quot;for diferente de&quot; também recomenda esta fase quando a fase
            de origem não tem resultado ou resposta (por exemplo, se ela for
            ignorada). Nesse caso a recomendação aparece sem que haja dados de
            origem.
          </span>
        </p>
      )}

      {/* Per-row live preview */}
      <PreviewPanel
        rowId={rowId}
        row={row}
        selectedTarget={selectedTarget}
        availableResults={availableResults}
        preview={preview}
        onUpdate={onUpdate}
      />
    </li>
  );
}

// ---------------------------------------------------------------------------
// AnswerRowControls — question picker + op + value for an answer-source row
// ---------------------------------------------------------------------------

function AnswerRowControls({
  rowId,
  row,
  targets,
  selectedTarget,
  onUpdate,
}: {
  rowId: string;
  row: DraftRow;
  targets: PhaseConditionTarget[];
  selectedTarget: PhaseConditionTarget | null;
  onUpdate: (patch: Partial<DraftRow>) => void;
}) {
  if (targets.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
        O formulário desta fase de origem não tem perguntas de múltipla escolha
        para condicionar a recomendação.
      </p>
    );
  }

  return (
    <>
      <label className="flex flex-col gap-1.5 text-sm" htmlFor={`${rowId}-question`}>
        <span className="font-medium">Quando a resposta de</span>
        <select
          id={`${rowId}-question`}
          className={SELECT_CLASS}
          value={row.questionKey}
          onChange={(e) =>
            onUpdate({
              questionKey: e.target.value,
              op: "equals",
              singleValue: "",
              multiValue: [],
              previewAnswer: "",
            })
          }
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
          <label className="flex flex-col gap-1.5 text-sm" htmlFor={`${rowId}-op`}>
            <span className="font-medium">A condição</span>
            <select
              id={`${rowId}-op`}
              className={SELECT_CLASS}
              value={row.op}
              onChange={(e) =>
                onUpdate({
                  op: e.target.value as "equals" | "not_equals" | "in",
                  singleValue: "",
                  multiValue: [],
                  previewAnswer: "",
                })
              }
            >
              <option value="equals">for igual a</option>
              <option value="not_equals">for diferente de</option>
              <option value="in">for uma das opções</option>
            </select>
          </label>

          {selectedTarget.options.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Esta pergunta não tem opções definidas.
            </p>
          ) : row.op === "in" ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Opções selecionadas</legend>
              {selectedTarget.options.map((opt) => (
                <label key={opt} className="flex items-center gap-2.5 text-sm">
                  <Checkbox
                    checked={row.multiValue.includes(opt)}
                    onCheckedChange={() => {
                      const next = row.multiValue.includes(opt)
                        ? row.multiValue.filter((o) => o !== opt)
                        : [...row.multiValue, opt];
                      onUpdate({ multiValue: next });
                    }}
                  />
                  {opt}
                </label>
              ))}
            </fieldset>
          ) : (
            <label className="flex flex-col gap-1.5 text-sm" htmlFor={`${rowId}-value`}>
              <span className="font-medium">Valor</span>
              <select
                id={`${rowId}-value`}
                className={SELECT_CLASS}
                value={row.singleValue}
                onChange={(e) => onUpdate({ singleValue: e.target.value })}
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
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// ResultRowControls — result-mode selector + value controls for a result-source row
// ---------------------------------------------------------------------------

function ResultRowControls({
  rowId,
  row,
  availableResults,
  sourcePhaseHasResult,
  onUpdate,
}: {
  rowId: string;
  row: DraftRow;
  availableResults: PhaseResult[];
  sourcePhaseHasResult: boolean;
  onUpdate: (patch: Partial<DraftRow>) => void;
}) {
  if (!sourcePhaseHasResult) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
        A fase de origem selecionada não está configurada para emitir resultado.
      </p>
    );
  }

  return (
    <>
      {/* Sub-toggle: specific result vs adverse flag */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium">Verificar</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${rowId}-result-mode`}
              value="specific"
              checked={row.source === "result-specific"}
              onChange={() =>
                onUpdate({
                  source: "result-specific",
                  op: "equals",
                  singleValue: "",
                  multiValue: [],
                  previewResultId: "",
                  previewAdverse: "",
                })
              }
              className="size-4 accent-primary focus-visible:ring-[3px] focus-visible:ring-ring/40"
            />
            Resultado específico
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${rowId}-result-mode`}
              value="adverse"
              checked={row.source === "result-adverse"}
              onChange={() =>
                onUpdate({
                  source: "result-adverse",
                  op: "equals",
                  singleValue: "",
                  multiValue: [],
                  previewResultId: "",
                  previewAdverse: "",
                })
              }
              className="size-4 accent-primary focus-visible:ring-[3px] focus-visible:ring-ring/40"
            />
            Resultado adverso
          </label>
        </div>
      </fieldset>

      {/* === specific result === */}
      {row.source === "result-specific" && (
        <>
          <label className="flex flex-col gap-1.5 text-sm" htmlFor={`${rowId}-result-op`}>
            <span className="font-medium">A condição</span>
            <select
              id={`${rowId}-result-op`}
              className={SELECT_CLASS}
              value={row.op}
              onChange={(e) =>
                onUpdate({
                  op: e.target.value as "equals" | "not_equals" | "in",
                  singleValue: "",
                  multiValue: [],
                  previewResultId: "",
                })
              }
            >
              <option value="equals">for igual a</option>
              <option value="not_equals">for diferente de</option>
              <option value="in">for um dos resultados</option>
            </select>
          </label>

          {availableResults.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
              Nenhum resultado disponível para esta fase de origem.
            </p>
          ) : row.op === "in" ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Resultados selecionados</legend>
              {availableResults.map((r) => (
                <label key={r.id} className="flex items-center gap-2.5 text-sm">
                  <Checkbox
                    checked={row.multiValue.includes(r.id)}
                    onCheckedChange={() => {
                      const next = row.multiValue.includes(r.id)
                        ? row.multiValue.filter((id) => id !== r.id)
                        : [...row.multiValue, r.id];
                      onUpdate({ multiValue: next });
                    }}
                  />
                  {r.label}
                  {r.isAdverse && (
                    <span className="text-xs text-muted-foreground">(adverso)</span>
                  )}
                </label>
              ))}
            </fieldset>
          ) : (
            <label
              className="flex flex-col gap-1.5 text-sm"
              htmlFor={`${rowId}-result-value`}
            >
              <span className="font-medium">Resultado</span>
              <select
                id={`${rowId}-result-value`}
                className={SELECT_CLASS}
                value={row.singleValue}
                onChange={(e) => onUpdate({ singleValue: e.target.value })}
              >
                <option value="">Selecione um resultado…</option>
                {availableResults.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                    {r.isAdverse ? " (adverso)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}

      {/* === adverse toggle === */}
      {row.source === "result-adverse" && (
        <label
          className="flex flex-col gap-1.5 text-sm"
          htmlFor={`${rowId}-adverse-value`}
        >
          <span className="font-medium">Resultado adverso</span>
          <select
            id={`${rowId}-adverse-value`}
            className={SELECT_CLASS}
            value={row.adverseValue ? "true" : "false"}
            onChange={(e) =>
              onUpdate({ adverseValue: e.target.value === "true" })
            }
          >
            <option value="true">for adverso</option>
            <option value="false">não for adverso</option>
          </select>
        </label>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// PreviewPanel — per-row live preview via `evalRecommendation`
// ---------------------------------------------------------------------------

function PreviewPanel({
  rowId,
  row,
  selectedTarget,
  availableResults,
  preview,
  onUpdate,
}: {
  rowId: string;
  row: DraftRow;
  selectedTarget: PhaseConditionTarget | null;
  availableResults: PhaseResult[];
  preview: boolean | null;
  onUpdate: (patch: Partial<DraftRow>) => void;
}) {
  // Show the preview panel only when there is something meaningful to preview.
  const canPreview =
    row.fromPhase !== "" &&
    (row.source === "answer"
      ? selectedTarget !== null && selectedTarget.options.length > 0
      : row.source === "result-specific"
        ? availableResults.length > 0 &&
          (row.op === "in" ? row.multiValue.length > 0 : row.singleValue !== "")
        : true); // result-adverse always previewable if phase picked

  if (!canPreview) return null;

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3"
      role="status"
      aria-live="polite"
      aria-label={`Pré-visualização da condição ${rowId}`}
    >
      {/* Answer preview */}
      {row.source === "answer" && selectedTarget && (
        <label
          className="flex flex-col gap-1.5 text-sm"
          htmlFor={`${rowId}-preview-answer`}
        >
          <span className="font-medium">Pré-visualizar: se a resposta fosse</span>
          <select
            id={`${rowId}-preview-answer`}
            className={SELECT_CLASS}
            value={row.previewAnswer}
            onChange={(e) => onUpdate({ previewAnswer: e.target.value })}
          >
            <option value="">Selecione uma resposta…</option>
            {selectedTarget.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Result-specific preview */}
      {row.source === "result-specific" && availableResults.length > 0 && (
        <label
          className="flex flex-col gap-1.5 text-sm"
          htmlFor={`${rowId}-preview-result`}
        >
          <span className="font-medium">Pré-visualizar: se o resultado fosse</span>
          <select
            id={`${rowId}-preview-result`}
            className={SELECT_CLASS}
            value={row.previewResultId}
            onChange={(e) => onUpdate({ previewResultId: e.target.value })}
          >
            <option value="">Selecione um resultado…</option>
            {availableResults.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
                {r.isAdverse ? " (adverso)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Result-adverse preview */}
      {row.source === "result-adverse" && (
        <label
          className="flex flex-col gap-1.5 text-sm"
          htmlFor={`${rowId}-preview-adverse`}
        >
          <span className="font-medium">Pré-visualizar: se o resultado fosse</span>
          <select
            id={`${rowId}-preview-adverse`}
            className={SELECT_CLASS}
            value={row.previewAdverse === "" ? "" : String(row.previewAdverse)}
            onChange={(e) =>
              onUpdate({
                previewAdverse: e.target.value === "" ? "" : e.target.value === "true",
              })
            }
          >
            <option value="">Selecione…</option>
            <option value="true">adverso</option>
            <option value="false">não adverso</option>
          </select>
        </label>
      )}

      {/* Preview result badge */}
      {preview !== null && (
        <p
          className={
            preview
              ? "animate-fade-in inline-flex items-center gap-1.5 text-sm font-medium text-primary"
              : "animate-fade-in inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground"
          }
        >
          {preview ? (
            <CheckCircle2 aria-hidden="true" className="size-4" />
          ) : (
            <XCircle aria-hidden="true" className="size-4" />
          )}
          {preview ? "Recomendaria esta fase." : "Não recomendaria esta fase."}
        </p>
      )}
    </div>
  );
}

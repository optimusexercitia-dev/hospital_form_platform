"use client";

import { useId, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import type {
  ConditionGroup,
  ConditionOp,
  ConditionTarget,
  InputItemType,
  VisibleWhen,
  Visibility,
} from "@/lib/queries/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * The ONE reusable visibility-condition builder (decision #8), used for BOTH
 * section and per-question `visible_when`. It edits the {@link Visibility} shape
 * — a legacy single condition OR an AND/OR group — and always serializes to a
 * group `{ match, conditions[] }` once ≥1 condition exists (a 1-row group is the
 * normalized form of a legacy single; the backend `eval_visibility` handles
 * either). `null` = always visible.
 *
 * Each row picks an earlier-in-document-order input question (`targets`), an
 * operator filtered by that target's type (choice ⇒ equals/not_equals/in;
 * number/date/time ⇒ equals/not_equals/gt/gte/lt/lte), and a value control
 * (option picker for choice — the value is the option LABEL string; a
 * number/date/time input otherwise). The pickers are discrete so an author can
 * only build a structurally valid condition; publish-time
 * `validate_visible_when` is the server authority on forward/self refs and
 * operator↔type compatibility.
 *
 * Presentational + controlled: the parent owns the `Visibility` value and feeds
 * it into the item/section action. In a QUESTION context the parent disables the
 * "obrigatória" toggle whenever the emitted value is non-null (a conditional
 * question can never be required — decision #9).
 */

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** pt-BR operator labels (the full extended set). */
const OP_LABELS: Record<ConditionOp, string> = {
  equals: "é igual a",
  not_equals: "é diferente de",
  in: "é uma das opções",
  gt: "é maior que",
  gte: "é maior ou igual a",
  lt: "é menor que",
  lte: "é menor ou igual a",
};

/** Operators offered for a choice target (the answer is a discrete label). */
const CHOICE_OPS: ConditionOp[] = ["equals", "not_equals", "in"];
/** Operators offered for an ordered (number/date/time) target. */
const ORDERED_OPS: ConditionOp[] = [
  "equals",
  "not_equals",
  "gt",
  "gte",
  "lt",
  "lte",
];

const CHOICE_TARGET_TYPES: InputItemType[] = [
  "multiple_choice",
  "dropdown",
  "checkbox",
];

function isChoiceTarget(type: InputItemType): boolean {
  return CHOICE_TARGET_TYPES.includes(type);
}

function opsForType(type: InputItemType): ConditionOp[] {
  return isChoiceTarget(type) ? CHOICE_OPS : ORDERED_OPS;
}

/** A locally-edited condition row (UI state; serialized to a sub-condition).
 *  Exported for unit tests. */
export interface DraftRow {
  uid: string;
  questionKey: string;
  op: ConditionOp;
  /** Scalar value for equals/not_equals + ordered ops (option label, number,
   *  date or time string). */
  singleValue: string;
  /** Selected option labels for `in`. */
  multiValue: string[];
}

let uidCounter = 0;
function nextUid(): string {
  uidCounter += 1;
  return `cond-${uidCounter}`;
}

/** Parse an incoming {@link Visibility} into draft rows + the combinator.
 *  Exported for unit tests (the round-trip with {@link toCondition}). */
export function toDrafts(value: Visibility | null): {
  enabled: boolean;
  match: "all" | "any";
  rows: DraftRow[];
} {
  if (value == null) {
    return { enabled: false, match: "all", rows: [] };
  }
  const conditions: VisibleWhen[] = isGroup(value)
    ? value.conditions
    : [value];
  const match = isGroup(value) ? value.match : "all";
  return {
    enabled: conditions.length > 0,
    match,
    rows: conditions.map((c) => ({
      uid: nextUid(),
      questionKey: c.question_key,
      op: c.op,
      // Scalar values (choice label string OR number/date/time) are held as a
      // STRING in the input buffer. A number condition's value is a JSON number
      // (post MAJOR-1 fix), so `String(...)` is required to show it in the
      // `<input type="number">` on reopen; arrays belong to `in` (multiValue).
      singleValue:
        c.value == null || Array.isArray(c.value) ? "" : String(c.value),
      multiValue: Array.isArray(c.value) ? c.value.map(String) : [],
    })),
  };
}

function isGroup(value: Visibility): value is ConditionGroup {
  return Array.isArray((value as ConditionGroup).conditions);
}

/** Whether a row is COMPLETE (a valid, selectable target + a value). */
function isRowComplete(row: DraftRow, target: ConditionTarget | undefined): boolean {
  if (!target) return false;
  if (row.op === "in") return row.multiValue.length > 0;
  if (row.singleValue === "") return false;
  // A number target must parse to a finite number, else it is incomplete (don't
  // emit a NaN). date/time/choice accept any non-empty string.
  if (target.type === "number") return Number.isFinite(Number(row.singleValue));
  return true;
}

/**
 * Serialize a complete row to a sub-condition. The value type is keyed on the
 * TARGET's type so it matches how the answer is stored (MAJOR-1):
 *   - `in` → the selected option-label array;
 *   - number target → a JSON **number** (`Number(...)`), so both evaluators
 *     compare numerically (a string would fall to lexical compare and
 *     mis-evaluate, e.g. `"10" < "5"`);
 *   - date/time target → the ISO string (`YYYY-MM-DD` / `HH:mm`), which sorts
 *     correctly lexically;
 *   - choice target → the option-label string (equals/not_equals).
 */
export function toCondition(row: DraftRow, target: ConditionTarget): VisibleWhen {
  let value: VisibleWhen["value"];
  if (row.op === "in") {
    value = row.multiValue;
  } else if (target.type === "number") {
    value = Number(row.singleValue);
  } else {
    value = row.singleValue;
  }
  return { question_key: row.questionKey, op: row.op, value };
}

export function ConditionBuilder({
  targets,
  value,
  onChange,
  context,
}: {
  targets: ConditionTarget[];
  value: Visibility | null;
  onChange: (next: Visibility | null) => void;
  context: "section" | "question";
}) {
  const groupId = useId();
  const initial = useMemo(() => toDrafts(value), [value]);
  const [enabled, setEnabled] = useState<boolean>(initial.enabled);
  const [match, setMatch] = useState<"all" | "any">(initial.match);
  const [rows, setRows] = useState<DraftRow[]>(initial.rows);

  const targetByKey = useMemo(() => {
    const map = new Map<string, ConditionTarget>();
    for (const t of targets) map.set(t.questionKey, t);
    return map;
  }, [targets]);

  /** Recompute the serialized Visibility from the local rows and notify parent. */
  function emit(nextRows: DraftRow[], nextMatch: "all" | "any", on: boolean) {
    if (!on) {
      onChange(null);
      return;
    }
    const complete = nextRows.filter((r) =>
      isRowComplete(r, targetByKey.get(r.questionKey)),
    );
    if (complete.length === 0) {
      onChange(null);
      return;
    }
    const group: ConditionGroup = {
      match: nextMatch,
      // Each `complete` row passed isRowComplete → its target is present.
      conditions: complete.map((r) =>
        toCondition(r, targetByKey.get(r.questionKey) as ConditionTarget),
      ),
    };
    onChange(group);
  }

  function setRowsAndEmit(next: DraftRow[]) {
    setRows(next);
    emit(next, match, enabled);
  }

  function toggleEnabled(on: boolean) {
    setEnabled(on);
    // Seed the first empty row when turning on with none yet.
    let next = rows;
    if (on && rows.length === 0) {
      next = [emptyRow()];
      setRows(next);
    }
    emit(next, match, on);
  }

  function changeMatch(next: "all" | "any") {
    setMatch(next);
    emit(rows, next, enabled);
  }

  function emptyRow(): DraftRow {
    const firstType = targets[0]?.type;
    return {
      uid: nextUid(),
      questionKey: "",
      op: firstType ? opsForType(firstType)[0] : "equals",
      singleValue: "",
      multiValue: [],
    };
  }

  function addRow() {
    setRowsAndEmit([...rows, emptyRow()]);
  }

  function removeRow(uid: string) {
    setRowsAndEmit(rows.filter((r) => r.uid !== uid));
  }

  function updateRow(uid: string, patch: Partial<DraftRow>) {
    setRowsAndEmit(
      rows.map((r) => (r.uid === uid ? { ...r, ...patch } : r)),
    );
  }

  function onPickTarget(uid: string, questionKey: string) {
    const target = targetByKey.get(questionKey);
    // Reset op + value to defaults valid for the new target type.
    const ops = target ? opsForType(target.type) : CHOICE_OPS;
    updateRow(uid, {
      questionKey,
      op: ops[0],
      singleValue: "",
      multiValue: [],
    });
  }

  function onPickOp(uid: string, op: ConditionOp) {
    // value shape differs between scalar and array (`in`) ops.
    updateRow(uid, { op, singleValue: "", multiValue: [] });
  }

  const toggleLabel =
    context === "question" ? "Aparência condicional" : "Visibilidade condicional";
  const showWhenLabel =
    context === "question"
      ? "Mostrar a pergunta quando"
      : "Mostrar a seção quando";

  if (targets.length === 0) {
    const subject = context === "question" ? "esta pergunta" : "esta seção";
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">{toggleLabel}</legend>
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
          Não há perguntas anteriores que possam controlar a visibilidade. Por
          isso, {subject} é sempre exibida.
        </p>
      </fieldset>
    );
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <legend className="text-sm font-semibold">{toggleLabel}</legend>
        <label className="flex items-center gap-2.5 text-sm">
          <Checkbox
            checked={enabled}
            onCheckedChange={(c) => toggleEnabled(c === true)}
          />
          <span>Exibir somente sob condições</span>
        </label>
      </div>

      {enabled && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
          {rows.length > 1 && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Combinar condições</span>
              <select
                className={SELECT_CLASS}
                value={match}
                onChange={(e) => changeMatch(e.target.value as "all" | "any")}
              >
                <option value="all">Atender a TODAS as condições</option>
                <option value="any">Atender a QUALQUER condição</option>
              </select>
            </label>
          )}

          <ul className="flex flex-col gap-3">
            {rows.map((row, index) => {
              const target = targetByKey.get(row.questionKey);
              const rowId = `${groupId}-row-${row.uid}`;
              return (
                <li
                  key={row.uid}
                  className="flex flex-col gap-2.5 rounded-lg border border-border/70 bg-background/50 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {index === 0
                        ? showWhenLabel
                        : match === "all"
                          ? "E quando"
                          : "Ou quando"}
                    </p>
                    {rows.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeRow(row.uid)}
                        aria-label={`Remover a condição ${index + 1}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </div>

                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="sr-only">Pergunta controladora</span>
                    <select
                      id={`${rowId}-target`}
                      className={SELECT_CLASS}
                      value={row.questionKey}
                      onChange={(e) => onPickTarget(row.uid, e.target.value)}
                    >
                      <option value="">Selecione a pergunta…</option>
                      {targets.map((t) => (
                        <option key={t.questionKey} value={t.questionKey}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {target && (
                    <div className="flex flex-col gap-2.5">
                      <label className="flex flex-col gap-1.5 text-sm">
                        <span className="sr-only">Operador</span>
                        <select
                          id={`${rowId}-op`}
                          className={SELECT_CLASS}
                          value={row.op}
                          onChange={(e) =>
                            onPickOp(row.uid, e.target.value as ConditionOp)
                          }
                        >
                          {opsForType(target.type).map((o) => (
                            <option key={o} value={o}>
                              {OP_LABELS[o]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <ValueControl
                        rowId={rowId}
                        target={target}
                        op={row.op}
                        singleValue={row.singleValue}
                        multiValue={row.multiValue}
                        onSingleChange={(v) =>
                          updateRow(row.uid, { singleValue: v })
                        }
                        onMultiToggle={(opt) => {
                          const set = new Set(row.multiValue);
                          if (set.has(opt)) set.delete(opt);
                          else set.add(opt);
                          // Preserve option order for stable, comparable values.
                          updateRow(row.uid, {
                            multiValue: target.options.filter((o) =>
                              set.has(o),
                            ),
                          });
                        }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
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
        </div>
      )}
    </fieldset>
  );
}

/** The value control for one condition row, by target type + operator. */
function ValueControl({
  rowId,
  target,
  op,
  singleValue,
  multiValue,
  onSingleChange,
  onMultiToggle,
}: {
  rowId: string;
  target: ConditionTarget;
  op: ConditionOp;
  singleValue: string;
  multiValue: string[];
  onSingleChange: (value: string) => void;
  onMultiToggle: (option: string) => void;
}) {
  // CHOICE target → discrete option picker (value is the option label string).
  if (isChoiceTarget(target.type)) {
    if (target.options.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          Esta pergunta não tem opções definidas.
        </p>
      );
    }
    if (op === "in") {
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Opções selecionadas</legend>
          {target.options.map((opt) => (
            <label key={opt} className="flex items-center gap-2.5 text-sm">
              <Checkbox
                checked={multiValue.includes(opt)}
                onCheckedChange={() => onMultiToggle(opt)}
              />
              {opt}
            </label>
          ))}
        </fieldset>
      );
    }
    return (
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Valor</span>
        <select
          id={`${rowId}-value`}
          className={SELECT_CLASS}
          value={singleValue}
          onChange={(e) => onSingleChange(e.target.value)}
        >
          <option value="">Selecione…</option>
          {target.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  // number / date / time → the matching native input control.
  const inputType =
    target.type === "number"
      ? "number"
      : target.type === "date"
        ? "date"
        : "time";
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">Valor</span>
      <Input
        id={`${rowId}-value`}
        type={inputType}
        value={singleValue}
        onChange={(e) => onSingleChange(e.target.value)}
        // number accepts decimals + negatives (decision #2).
        step={target.type === "number" ? "any" : undefined}
        className="h-10"
      />
    </label>
  );
}

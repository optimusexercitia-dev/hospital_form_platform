"use client";

import { useState } from "react";
import { Eraser, MessageSquarePlus } from "lucide-react";

import type { Json } from "@/lib/types/database";
import type { Item, ItemOption } from "@/lib/queries/forms";
import { OTHER_OPTION_CODE } from "@/lib/forms/option-constants";
import { cn } from "@/lib/utils";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TimeField } from "@/components/ui/time-field";
import { TOKEN_COLOR_VAR } from "@/components/cases/case-status-badge";
import { hasAnswer } from "./use-wizard";

/**
 * Renders one INPUT item (F3): the choice types (`multiple_choice`, `dropdown`,
 * `checkbox`) plus the text/number/date/time types (`free_text` = long,
 * `short_text` = single line, `number`, `date`, `time`). State-managed
 * (controlled) via the wizard's answer state.
 *
 * form-builder-enhancements:
 *  - multiple_choice + checkbox options render a colour dot / left-accent always,
 *    a stronger tint when selected (reuses the shared palette tokens);
 *  - every NON-free-text input offers an optional "Adicionar observação" note,
 *    revealed after the question is answered (or expanded if one already exists);
 *  - number accepts decimals + negatives with pt-BR comma display; date honours
 *    optional min/max from `config`; time is 24h.
 *
 * Accessibility (hard requirement):
 *  - every control has an associated label;
 *  - `question_explanation` renders as muted helper text AND is wired as the
 *    input's accessible description via `aria-describedby`;
 *  - multiple_choice (radios) and checkbox groups are wrapped in a
 *    `<fieldset>`/`<legend>` so the group has an accessible name;
 *  - validation errors are surfaced via `aria-invalid` + a `role="alert"`
 *    `FieldError`, also referenced from `aria-describedby`.
 */
export function InputItem({
  item,
  value,
  onChange,
  error,
  observation,
  onObservationChange,
  otherText,
  onOtherTextChange,
  onClear,
}: {
  item: Item;
  value: Json | undefined;
  onChange: (value: Json) => void;
  error?: string;
  /** Current observation note (form-builder-enhancements). */
  observation?: string;
  /** Persist an observation note; absent for read-only contexts. */
  onObservationChange?: (value: string) => void;
  /** Current "Outros" free text ("Outros" open option). */
  otherText?: string;
  /** Persist the "Outros" free text; absent for read-only contexts. */
  onOtherTextChange?: (value: string) => void;
  /**
   * Clear the WHOLE block — the answer AND the observação AND the "Outro" text.
   * Absent in read-only contexts. Rendered as a top-right ghost icon-button,
   * enabled only while the block holds something to clear.
   */
  onClear?: () => void;
}) {
  const label = item.label ?? "Pergunta";
  const required = item.required;

  const control = renderControl({
    item,
    label,
    required,
    value,
    onChange,
    error,
    otherText,
    onOtherTextChange,
  });

  const answered = hasAnswer({
    itemId: item.id,
    questionKey: item.questionKey ?? item.id,
    value: value ?? null,
  });

  // Observation affordance: every non-free-text input (decision #11). Never on
  // free_text (it is already a free-text answer).
  const observationEnabled =
    item.itemType !== "free_text" && onObservationChange != null;

  // The block has something to clear when it holds an answer, an observação, or
  // an "Outros" free text.
  const hasObservation = (observation ?? "").trim() !== "";
  const hasOtherText = (otherText ?? "").trim() !== "";
  const clearable =
    Boolean(onClear) && (answered || hasObservation || hasOtherText);

  return (
    <div className="flex flex-col gap-2">
      {onClear && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={onClear}
            disabled={!clearable}
            aria-label={`Limpar a resposta de ${label}`}
            title="Limpar"
          >
            <Eraser aria-hidden="true" />
          </Button>
        </div>
      )}
      {control}
      {observationEnabled && (
        <ObservationField
          itemId={item.id}
          questionLabel={label}
          answered={answered}
          observation={observation ?? ""}
          onChange={onObservationChange}
        />
      )}
    </div>
  );
}

function renderControl({
  item,
  label,
  required,
  value,
  onChange,
  error,
  otherText,
  onOtherTextChange,
}: {
  item: Item;
  label: string;
  required: boolean;
  value: Json | undefined;
  onChange: (value: Json) => void;
  error?: string;
  otherText?: string;
  onOtherTextChange?: (value: string) => void;
}) {
  switch (item.itemType) {
    case "free_text":
      return (
        <FreeTextItem
          item={item}
          label={label}
          required={required}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          error={error}
        />
      );
    case "short_text":
      return (
        <ShortTextItem
          item={item}
          label={label}
          required={required}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          error={error}
        />
      );
    case "number":
      return (
        <NumberItem
          item={item}
          label={label}
          required={required}
          value={typeof value === "number" ? value : null}
          onChange={onChange}
          error={error}
        />
      );
    case "date":
      return (
        <DateTimeItem
          item={item}
          label={label}
          required={required}
          inputType="date"
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          error={error}
        />
      );
    case "time":
      return (
        <DateTimeItem
          item={item}
          label={label}
          required={required}
          inputType="time"
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          error={error}
        />
      );
    case "dropdown":
      return (
        <DropdownItem
          item={item}
          label={label}
          required={required}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          error={error}
        />
      );
    case "multiple_choice":
      return (
        <ChoiceGroup
          item={item}
          label={label}
          required={required}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          error={error}
          otherText={otherText}
          onOtherTextChange={onOtherTextChange}
        />
      );
    case "checkbox":
      return (
        <CheckboxGroup
          item={item}
          label={label}
          required={required}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          error={error}
          otherText={otherText}
          onOtherTextChange={onOtherTextChange}
        />
      );
    default:
      // Display items are not rendered here; the dispatcher routes them away.
      return null;
  }
}

/** Shared "* obrigatória" marker for input labels. */
function RequiredMark({ required }: { required: boolean }) {
  if (!required) return null;
  return (
    <span className="ml-0.5 text-destructive" aria-label="obrigatória">
      *
    </span>
  );
}

function FreeTextItem({
  item,
  label,
  required,
  value,
  onChange,
  error,
}: {
  item: Item;
  label: string;
  required: boolean;
  value: string;
  onChange: (value: Json) => void;
  error?: string;
}) {
  const hasDescription = Boolean(item.questionExplanation);
  const { descriptionId, errorId, controlProps } = useFieldIds(`item-${item.id}`, {
    hasError: Boolean(error),
    hasDescription,
  });

  return (
    <Field>
      <FieldLabel htmlFor={controlProps.id}>
        {label}
        <RequiredMark required={required} />
      </FieldLabel>
      {hasDescription && (
        <FieldDescription id={descriptionId}>
          {item.questionExplanation}
        </FieldDescription>
      )}
      <Textarea
        {...controlProps}
        // Long free-text answers get twice the default starting height (still
        // auto-grows via `field-sizing-content`) so multi-line answers have room.
        className="min-h-40"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  );
}

function ShortTextItem({
  item,
  label,
  required,
  value,
  onChange,
  error,
}: {
  item: Item;
  label: string;
  required: boolean;
  value: string;
  onChange: (value: Json) => void;
  error?: string;
}) {
  const hasDescription = Boolean(item.questionExplanation);
  const { descriptionId, errorId, controlProps } = useFieldIds(`item-${item.id}`, {
    hasError: Boolean(error),
    hasDescription,
  });

  return (
    <Field>
      <FieldLabel htmlFor={controlProps.id}>
        {label}
        <RequiredMark required={required} />
      </FieldLabel>
      {hasDescription && (
        <FieldDescription id={descriptionId}>
          {item.questionExplanation}
        </FieldDescription>
      )}
      <Input
        {...controlProps}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  );
}

/**
 * Numeric input with pt-BR comma display ↔ canonical JSON-number value. The
 * stored value is always a number (or cleared when blank/partial); the field
 * uses `inputMode="decimal"` and accepts a comma OR dot as the decimal mark so
 * the user can type "3,5". A lone "-"/","/empty clears the answer.
 */
function NumberItem({
  item,
  label,
  required,
  value,
  onChange,
  error,
}: {
  item: Item;
  label: string;
  required: boolean;
  value: number | null;
  onChange: (value: Json) => void;
  error?: string;
}) {
  const hasDescription = Boolean(item.questionExplanation);
  const { descriptionId, errorId, controlProps } = useFieldIds(`item-${item.id}`, {
    hasError: Boolean(error),
    hasDescription,
  });

  // Local text buffer so the user can type freely (trailing comma, lone minus)
  // without the controlled number value snapping the caret. Seeded from the
  // canonical value (pt-BR comma display).
  const [text, setText] = useState<string>(
    value === null ? "" : String(value).replace(".", ","),
  );

  function handleChange(raw: string) {
    setText(raw);
    const normalized = raw.trim().replace(",", ".");
    if (normalized === "" || normalized === "-" || normalized === ".") {
      onChange(null);
      return;
    }
    const n = Number(normalized);
    onChange(Number.isFinite(n) ? n : null);
  }

  const min = typeof item.config?.min === "number" ? item.config.min : undefined;
  const max = typeof item.config?.max === "number" ? item.config.max : undefined;
  const boundsHint = formatBoundsHint(min, max);
  const boundsId = `item-${item.id}-bounds`;
  // Announce BOTH the explanation and the bounds hint: useFieldIds only wires
  // the explanation/error, so append the bounds id ourselves (MINOR-3).
  const describedBy =
    [controlProps["aria-describedby"], boundsHint ? boundsId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <Field>
      <FieldLabel htmlFor={controlProps.id}>
        {label}
        <RequiredMark required={required} />
      </FieldLabel>
      {hasDescription && (
        <FieldDescription id={descriptionId}>
          {item.questionExplanation}
        </FieldDescription>
      )}
      <Input
        {...controlProps}
        aria-describedby={describedBy}
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={boundsHint ?? undefined}
      />
      {boundsHint && (
        <FieldDescription id={boundsId}>{boundsHint}</FieldDescription>
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  );
}

/** Date (ISO `YYYY-MM-DD`, optional min/max) or time (24h `HH:mm`) input. */
function DateTimeItem({
  item,
  label,
  required,
  inputType,
  value,
  onChange,
  error,
}: {
  item: Item;
  label: string;
  required: boolean;
  inputType: "date" | "time";
  value: string;
  onChange: (value: Json) => void;
  error?: string;
}) {
  const hasDescription = Boolean(item.questionExplanation);
  const { descriptionId, errorId, controlProps } = useFieldIds(`item-${item.id}`, {
    hasError: Boolean(error),
    hasDescription,
  });

  // Date bounds (ISO strings) — time carries no bounds (decision #3).
  const min =
    inputType === "date" && typeof item.config?.min === "string"
      ? item.config.min
      : undefined;
  const max =
    inputType === "date" && typeof item.config?.max === "string"
      ? item.config.max
      : undefined;

  return (
    <Field>
      <FieldLabel htmlFor={controlProps.id}>
        {label}
        <RequiredMark required={required} />
      </FieldLabel>
      {hasDescription && (
        <FieldDescription id={descriptionId}>
          {item.questionExplanation}
        </FieldDescription>
      )}
      {inputType === "time" ? (
        // 24h masked numeric field (type `930` → `09:30`), validated 00:00–23:59.
        <div className="w-40">
          <TimeField
            id={controlProps.id}
            aria-describedby={controlProps["aria-describedby"]}
            aria-invalid={controlProps["aria-invalid"]}
            value={value}
            onChange={(next) => onChange(next === "" ? null : next)}
          />
        </div>
      ) : (
        <Input
          {...controlProps}
          type={inputType}
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          className="w-fit"
        />
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  );
}

function DropdownItem({
  item,
  label,
  required,
  value,
  onChange,
  error,
}: {
  item: Item;
  label: string;
  required: boolean;
  value: string;
  onChange: (value: Json) => void;
  error?: string;
}) {
  const hasDescription = Boolean(item.questionExplanation);
  const { descriptionId, errorId, controlProps } = useFieldIds(`item-${item.id}`, {
    hasError: Boolean(error),
    hasDescription,
  });
  const options = item.options ?? [];

  return (
    <Field>
      <FieldLabel htmlFor={controlProps.id}>
        {label}
        <RequiredMark required={required} />
      </FieldLabel>
      {hasDescription && (
        <FieldDescription id={descriptionId}>
          {item.questionExplanation}
        </FieldDescription>
      )}
      <NativeSelect
        {...controlProps}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(value === "" && "text-muted-foreground/70")}
      >
        <option value="" disabled>
          Selecione uma opção…
        </option>
        {/* Dropdown options never carry colour (a native <select> can't render
            it — decision #4); render the label only. form-model-normalization:
            the stored value is the option CODE, the displayed text the label. */}
        {options.map((opt) => (
          <option key={opt.code} value={opt.code} className="text-foreground">
            {opt.label}
          </option>
        ))}
      </NativeSelect>
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  );
}

/** Single-select radio group (colour-aware). */
function ChoiceGroup({
  item,
  label,
  required,
  value,
  onChange,
  error,
  otherText,
  onOtherTextChange,
}: {
  item: Item;
  label: string;
  required: boolean;
  value: string;
  onChange: (value: Json) => void;
  error?: string;
  otherText?: string;
  onOtherTextChange?: (value: string) => void;
}) {
  const options = item.options ?? [];
  const descriptionId = `item-${item.id}-description`;
  const errorId = `item-${item.id}-error`;
  const describedBy =
    [item.questionExplanation ? descriptionId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  // "Outros" open option: reveal the free-text input when the reserved __other__
  // option is the current selection (form-builder-enhancements).
  const otherSelected = value === OTHER_OPTION_CODE;

  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
    >
      <legend className="text-sm font-medium">
        {label}
        <RequiredMark required={required} />
      </legend>
      {item.questionExplanation && (
        <FieldDescription id={descriptionId}>
          {item.questionExplanation}
        </FieldDescription>
      )}
      <div className="flex flex-col gap-1.5">
        {options.map((opt, i) => {
          const id = `item-${item.id}-opt-${i}`;
          // form-model-normalization: the wizard state stores the option CODE
          // (the clone-stable identity the evaluator keys on); the label is shown.
          const selected = value === opt.code;
          return (
            <label
              key={opt.code}
              htmlFor={id}
              className={optionRowClass(opt, selected)}
              style={optionRowStyle(opt)}
            >
              <input
                type="radio"
                id={id}
                name={`item-${item.id}`}
                value={opt.code}
                checked={selected}
                onChange={() => onChange(opt.code)}
                className="size-4 shrink-0 accent-primary"
              />
              <OptionDot option={opt} />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
      {otherSelected && onOtherTextChange && (
        <OtherTextField
          itemId={item.id}
          value={otherText ?? ""}
          onChange={onOtherTextChange}
        />
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </fieldset>
  );
}

/** Multi-select checkbox group (colour-aware); value is a string array. */
function CheckboxGroup({
  item,
  label,
  required,
  value,
  onChange,
  error,
  otherText,
  onOtherTextChange,
}: {
  item: Item;
  label: string;
  required: boolean;
  value: string[];
  onChange: (value: Json) => void;
  error?: string;
  otherText?: string;
  onOtherTextChange?: (value: string) => void;
}) {
  const options = item.options ?? [];
  const descriptionId = `item-${item.id}-description`;
  const errorId = `item-${item.id}-error`;
  const describedBy =
    [item.questionExplanation ? descriptionId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  // "Outros" open option: reveal the free-text input when the reserved __other__
  // option is among the selections (form-builder-enhancements).
  const otherSelected = value.includes(OTHER_OPTION_CODE);

  function toggle(code: string, checked: boolean) {
    const set = new Set(value);
    if (checked) set.add(code);
    else set.delete(code);
    // Preserve option order for stable, comparable values. form-model-
    // normalization: the stored values are option CODEs, not labels.
    onChange(options.map((o) => o.code).filter((c) => set.has(c)));
  }

  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
    >
      <legend className="text-sm font-medium">
        {label}
        <RequiredMark required={required} />
      </legend>
      {item.questionExplanation && (
        <FieldDescription id={descriptionId}>
          {item.questionExplanation}
        </FieldDescription>
      )}
      <div className="flex flex-col gap-1.5">
        {options.map((opt, i) => {
          const id = `item-${item.id}-opt-${i}`;
          // form-model-normalization: checkbox state is an array of option CODEs.
          const checked = value.includes(opt.code);
          return (
            <label
              key={opt.code}
              htmlFor={id}
              className={optionRowClass(opt, checked)}
              style={optionRowStyle(opt)}
            >
              <input
                type="checkbox"
                id={id}
                value={opt.code}
                checked={checked}
                onChange={(e) => toggle(opt.code, e.target.checked)}
                className="size-4 shrink-0 accent-primary"
              />
              <OptionDot option={opt} />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
      {otherSelected && onOtherTextChange && (
        <OtherTextField
          itemId={item.id}
          value={otherText ?? ""}
          onChange={onOtherTextChange}
        />
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </fieldset>
  );
}

/**
 * The "Outros" open-option free-text input, revealed when the reserved
 * `__other__` option is selected (form-builder-enhancements). Blank is a VALID
 * answer ("Outro" selected is enough), so it is optional/encouraged, never
 * required. Accessible: an associated `<label>` + `aria-describedby`.
 */
function OtherTextField({
  itemId,
  value,
  onChange,
}: {
  itemId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const fieldId = `item-${itemId}-other`;
  const hintId = `${fieldId}-hint`;
  return (
    <div className="mt-0.5 flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium">
        Outro{" "}
        <span className="font-normal text-muted-foreground">(opcional)</span>
      </label>
      <Input
        id={fieldId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Especifique…"
        aria-describedby={hintId}
        autoComplete="off"
      />
      <FieldDescription id={hintId}>
        Descreva a opção escolhida em “Outro”.
      </FieldDescription>
    </div>
  );
}

/**
 * The optional per-item observation note (decision #11): a collapsed
 * "Adicionar observação" button that reveals a 2-line textarea. The button is
 * ALWAYS rendered but DISABLED (greyed) until the block is at least partially
 * answered (`answered`), so the affordance is discoverable up front; it enables
 * once there is an answer. Pre-expanded when an observation already exists (a
 * resumed note stays visible + editable even before re-answering). Never blocks.
 */
function ObservationField({
  itemId,
  questionLabel,
  answered,
  observation,
  onChange,
}: {
  itemId: string;
  /** The parent question's label — folded into the button's accessible name so
   *  multiple "Adicionar observação" buttons on one page are distinguishable to
   *  assistive tech (the visible text is identical on every input). */
  questionLabel: string;
  answered: boolean;
  observation: string;
  onChange: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState<boolean>(observation.trim() !== "");
  const fieldId = `item-${itemId}-observation`;

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-fit text-muted-foreground"
        onClick={() => setExpanded(true)}
        // Enabled once the question is at least partially answered.
        disabled={!answered}
        // Distinguishing accessible name; the visible text stays "Adicionar
        // observação" for every input, so scope it to the question for a11y.
        aria-label={`Adicionar observação — ${questionLabel}`}
      >
        <MessageSquarePlus aria-hidden="true" />
        Adicionar observação
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-muted-foreground">
        Observação{" "}
        <span className="font-normal text-muted-foreground">(opcional)</span>
      </label>
      <Textarea
        id={fieldId}
        value={observation}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="min-h-16"
        placeholder="Acrescente um comentário sobre esta resposta."
      />
    </div>
  );
}

/** A small colour dot for an option (presentation only; the label carries the
 *  meaning, so colour is never the sole signal). */
function OptionDot({ option }: { option: ItemOption }) {
  if (!option.color) return null;
  return (
    <span
      aria-hidden="true"
      className="size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: TOKEN_COLOR_VAR[option.color] }}
    />
  );
}

/** Row class for a choice/checkbox option, with a stronger tint when selected. */
function optionRowClass(option: ItemOption, selected: boolean): string {
  return cn(
    "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm transition-colors",
    "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
    option.color
      ? // Coloured option: a left accent + (when selected) a stronger tint, via
        // inline CSS variables set in optionRowStyle.
        cn(
          "border-l-4 border-border bg-card hover:bg-[var(--opt-tint)]",
          selected && "border-primary bg-[var(--opt-tint)]",
        )
      : cn(
          "border-border bg-card",
          "hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-accent/40",
        ),
  );
}

/** Inline CSS variables for a coloured option's left accent + selected tint. */
function optionRowStyle(option: ItemOption): React.CSSProperties | undefined {
  if (!option.color) return undefined;
  const color = TOKEN_COLOR_VAR[option.color];
  return {
    borderLeftColor: color,
    // A faint wash of the option colour for hover/selected (color-mix keeps it
    // subtle and theme-aware).
    ["--opt-tint" as string]: `color-mix(in oklch, ${color} 12%, transparent)`,
  };
}

/** A pt-BR "entre X e Y" / "mínimo X" / "máximo Y" hint for numeric bounds. */
function formatBoundsHint(
  min: number | undefined,
  max: number | undefined,
): string | null {
  const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(n);
  if (min !== undefined && max !== undefined) {
    return `Entre ${fmt(min)} e ${fmt(max)}`;
  }
  if (min !== undefined) return `Mínimo ${fmt(min)}`;
  if (max !== undefined) return `Máximo ${fmt(max)}`;
  return null;
}

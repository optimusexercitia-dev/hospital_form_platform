"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";

import type { Json } from "@/lib/types/database";
import type { Item, ItemOption } from "@/lib/queries/forms";
import { cn } from "@/lib/utils";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
}: {
  item: Item;
  value: Json | undefined;
  onChange: (value: Json) => void;
  error?: string;
  /** Current observation note (form-builder-enhancements). */
  observation?: string;
  /** Persist an observation note; absent for read-only contexts. */
  onObservationChange?: (value: string) => void;
}) {
  const label = item.label ?? "Pergunta";
  const required = item.required;

  const control = renderControl({ item, label, required, value, onChange, error });

  // Observation affordance: every non-free-text input (decision #11). Never on
  // free_text (it is already a free-text answer).
  const observationEnabled =
    item.itemType !== "free_text" && onObservationChange != null;

  return (
    <div className="flex flex-col gap-2">
      {control}
      {observationEnabled && (
        <ObservationField
          itemId={item.id}
          answered={hasAnswer({
            itemId: item.id,
            questionKey: item.questionKey ?? item.id,
            value: value ?? null,
          })}
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
}: {
  item: Item;
  label: string;
  required: boolean;
  value: Json | undefined;
  onChange: (value: Json) => void;
  error?: string;
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
        inputMode="decimal"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={boundsHint ?? undefined}
      />
      {boundsHint && (
        <FieldDescription>{boundsHint}</FieldDescription>
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
      <Input
        {...controlProps}
        type={inputType}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        className="w-fit"
      />
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
      <select
        {...controlProps}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "flex h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3.5 py-2 text-base text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color]",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
          "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
          "md:text-sm",
          value === "" && "text-muted-foreground/70",
        )}
      >
        <option value="" disabled>
          Selecione uma opção…
        </option>
        {/* Dropdown options never carry colour (a native <select> can't render
            it — decision #4); render the label only. */}
        {options.map((opt, i) => (
          <option key={i} value={opt.label} className="text-foreground">
            {opt.label}
          </option>
        ))}
      </select>
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
}: {
  item: Item;
  label: string;
  required: boolean;
  value: string;
  onChange: (value: Json) => void;
  error?: string;
}) {
  const options = item.options ?? [];
  const descriptionId = `item-${item.id}-description`;
  const errorId = `item-${item.id}-error`;
  const describedBy =
    [item.questionExplanation ? descriptionId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

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
          const selected = value === opt.label;
          return (
            <label
              key={i}
              htmlFor={id}
              className={optionRowClass(opt, selected)}
              style={optionRowStyle(opt)}
            >
              <input
                type="radio"
                id={id}
                name={`item-${item.id}`}
                value={opt.label}
                checked={selected}
                onChange={() => onChange(opt.label)}
                className="size-4 shrink-0 accent-primary"
              />
              <OptionDot option={opt} />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
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
}: {
  item: Item;
  label: string;
  required: boolean;
  value: string[];
  onChange: (value: Json) => void;
  error?: string;
}) {
  const options = item.options ?? [];
  const descriptionId = `item-${item.id}-description`;
  const errorId = `item-${item.id}-error`;
  const describedBy =
    [item.questionExplanation ? descriptionId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  function toggle(opt: string, checked: boolean) {
    const set = new Set(value);
    if (checked) set.add(opt);
    else set.delete(opt);
    // Preserve option order for stable, comparable values.
    onChange(options.map((o) => o.label).filter((o) => set.has(o)));
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
          const checked = value.includes(opt.label);
          return (
            <label
              key={i}
              htmlFor={id}
              className={optionRowClass(opt, checked)}
              style={optionRowStyle(opt)}
            >
              <input
                type="checkbox"
                id={id}
                value={opt.label}
                checked={checked}
                onChange={(e) => toggle(opt.label, e.target.checked)}
                className="size-4 shrink-0 accent-primary"
              />
              <OptionDot option={opt} />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
      <FieldError id={errorId}>{error}</FieldError>
    </fieldset>
  );
}

/**
 * The optional per-item observation note (decision #11): a collapsed
 * "Adicionar observação" button that reveals a 2-line textarea once the question
 * is answered; pre-expanded when an observation already exists. Never blocks.
 */
function ObservationField({
  itemId,
  answered,
  observation,
  onChange,
}: {
  itemId: string;
  answered: boolean;
  observation: string;
  onChange: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState<boolean>(observation.trim() !== "");
  const fieldId = `item-${itemId}-observation`;

  // The affordance only appears once the question is answered (or an
  // observation already exists, keeping a resumed note visible).
  if (!answered && observation.trim() === "") return null;

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-fit text-muted-foreground"
        onClick={() => setExpanded(true)}
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

"use client";

import type { Json } from "@/lib/types/database";
import type { Item } from "@/lib/queries/forms";
import { cn } from "@/lib/utils";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

/**
 * Renders one INPUT item (F3): `multiple_choice`, `dropdown`, `checkbox`,
 * `free_text`. State-managed (controlled) via the wizard's answer state.
 *
 * Accessibility (hard requirement):
 *  - every control has an associated label;
 *  - `question_explanation` renders as muted helper text AND is wired as the
 *    input's accessible description via `aria-describedby` (ARCHITECTURE Rule
 *    appendix / role file);
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
}: {
  item: Item;
  value: Json | undefined;
  onChange: (value: Json) => void;
  error?: string;
}) {
  const label = item.label ?? "Pergunta";
  const required = item.required;

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
        {options.map((opt, i) => (
          <option key={i} value={opt} className="text-foreground">
            {opt}
          </option>
        ))}
      </select>
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  );
}

/** Single-select radio group. */
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
          return (
            <label
              key={i}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm transition-colors",
                "hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-accent/40",
                "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
              )}
            >
              <input
                type="radio"
                id={id}
                name={`item-${item.id}`}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="size-4 shrink-0 accent-primary"
              />
              <span>{opt}</span>
            </label>
          );
        })}
      </div>
      <FieldError id={errorId}>{error}</FieldError>
    </fieldset>
  );
}

/** Multi-select checkbox group; value is a string array. */
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
    onChange(options.filter((o) => set.has(o)));
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
          const checked = value.includes(opt);
          return (
            <label
              key={i}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm transition-colors",
                "hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-accent/40",
                "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
              )}
            >
              <input
                type="checkbox"
                id={id}
                value={opt}
                checked={checked}
                onChange={(e) => toggle(opt, e.target.checked)}
                className="size-4 shrink-0 accent-primary"
              />
              <span>{opt}</span>
            </label>
          );
        })}
      </div>
      <FieldError id={errorId}>{error}</FieldError>
    </fieldset>
  );
}

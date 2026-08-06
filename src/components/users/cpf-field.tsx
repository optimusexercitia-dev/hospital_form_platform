"use client";

import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";

/**
 * The CPF input (AFF, ADR 0097 D7 — CPF is the person key).
 *
 * Presentation is masked (`000.000.000-00`) because that is how a CPF is written on
 * every Brazilian document an admin will be reading from; STORAGE is digits-only, so
 * the caller keeps the digit string in state and this component only ever renders it
 * masked. `normalizeCpf` / `isValidCpf` (`@/lib/users/cpf`) are pure and client-safe by
 * design — they are the TS half of a rule mirrored in SQL (`app.is_valid_cpf`).
 *
 * Accessibility: a real `<label>`, `inputMode="numeric"` for a numeric soft keyboard,
 * and the format help wired through `aria-describedby` by `useFieldIds` — the mask is
 * never the only place the expected format is stated.
 */

/** Render a digits-only CPF in the familiar `000.000.000-00` form, progressively. */
export function formatCpf(digits: string): string {
  const d = digits.slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function CpfField({
  value,
  onChange,
  label = "CPF",
  description,
  error,
  required = true,
  disabled = false,
  inputRef,
}: {
  /** Digits only — the storage form. The mask lives in the rendered value. */
  value: string;
  onChange: (digits: string) => void;
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /**
   * Lets the caller move focus here after a user-initiated step change (e.g. "buscar
   * outro CPF"). Deliberately NOT `autoFocus`: stealing focus on first paint is a
   * different, worse thing than restoring it after an action the admin just took.
   */
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const field = useFieldIds("cpf", {
    hasError: Boolean(error),
    hasDescription: Boolean(description),
    required,
  });

  return (
    <Field>
      <FieldLabel htmlFor={field.controlProps.id}>{label}</FieldLabel>
      <Input
        {...field.controlProps}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        // 14 = 11 digits + two dots + one dash.
        maxLength={14}
        placeholder="000.000.000-00"
        required={required}
        disabled={disabled}
        value={formatCpf(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
      />
      {description ? (
        <FieldDescription id={field.descriptionId}>{description}</FieldDescription>
      ) : null}
      <FieldError id={field.errorId}>{error}</FieldError>
    </Field>
  );
}

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
 * The telephone input (AFF2, ADR 0133 D9 — optional contact data on `profiles.phone`).
 *
 * Deliberately shaped as a sibling of `CpfField`, because the storage rule is the same
 * one: **digits-only in state, mask only in the rendered value**. ADR 0133 Amendment 1
 * ruling 6 pins it — `phone` is stored digits-only with *no* CHECK constraint, and
 * "formatting is display-side". The caller therefore holds the digit string and this
 * component never hands anything else back.
 *
 * ⛔ NO VALIDATION BEYOND A LENGTH CAP, and that is deliberate rather than an omission.
 * The column has no CHECK precisely because a phone number is optional contact data and
 * not an identifier (Amdt 1 r6), unlike CPF which is the person key and is validated in
 * both TS and SQL. Inventing a client-side format rule the backend does not share would
 * reject numbers the database accepts — a UI stricter than its own schema, which reads
 * to the admin as a bug in the person's phone number.
 *
 * Accessibility: a real `<label>`, `type="tel"` + `inputMode="tel"` for a numeric soft
 * keyboard, and the format help wired through `aria-describedby` by `useFieldIds` — the
 * mask is never the only place the expected shape is stated.
 */

/**
 * Render a digits-only Brazilian number progressively as `(11) 98765-4321`.
 *
 * Handles both lengths in use: 10 digits is a landline (`(11) 3456-7890`), 11 a mobile
 * with its leading 9 (`(11) 98765-4321`). The break is at 10 because that is where the
 * subscriber part grows from four digits to five.
 */
export function formatPhone(digits: string): string {
  const d = digits.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function PhoneField({
  value,
  onChange,
  label = "Telefone",
  description,
  error,
  required = false,
  disabled = false,
}: {
  /** Digits only — the storage form. The mask lives in the rendered value. */
  value: string;
  onChange: (digits: string) => void;
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const field = useFieldIds("phone", {
    hasError: Boolean(error),
    hasDescription: Boolean(description),
    required,
  });

  return (
    <Field>
      <FieldLabel htmlFor={field.controlProps.id}>{label}</FieldLabel>
      {/* ⛔ THIS CONTROL MUST NEVER CARRY A DOM `name` — the same measured reason as
          `cpf-field.tsx`. A <form> whose JS has not hydrated still submits NATIVELY on
          Enter, and a native GET serialises every NAMED input into the QUERY STRING:
          address bar, history, and every proxy log in front of the app.
          `preventDefault()` cannot stop it, because pre-hydration there is no handler
          to run. That exact leak was measured on this route with a CPF in it. A
          personal telephone number is LGPD personal data on the same footing, and this
          value comes from React state rather than `FormData`, so it has no legitimate
          reason to be named. ⛔ Do not add `nameRequiredFor` here. */}
      <Input
        {...field.controlProps}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        spellCheck={false}
        // 15 = 11 digits + parens, space and dash.
        maxLength={15}
        placeholder="(11) 98765-4321"
        required={required}
        disabled={disabled}
        value={formatPhone(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
      />
      {description ? (
        <FieldDescription id={field.descriptionId}>{description}</FieldDescription>
      ) : null}
      <FieldError id={field.errorId}>{error}</FieldError>
    </Field>
  );
}

"use client";

// Type-only imports — `@/lib/queries/cases` is `server-only`, but a type import is
// erased at compile time and never pulls the runtime module into this client bundle.
import type {
  CustomFieldOption,
  CustomFieldType,
} from "@/lib/queries/process-templates";
import type { CaseCustomFieldValue } from "@/lib/queries/cases";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DatePicker } from "@/components/ui/date-picker";

/**
 * Shared custom-field controls (ADR 0083 D3 — "reuse the input-type controls").
 * ONE control component keyed by `fieldType`, used by BOTH the "Novo caso" dialog
 * and the case-detail edit dialog, plus a read-only renderer for display surfaces
 * (case detail + list chips). Keeping the per-type coercion + code→label resolution
 * in one place is what keeps the create/edit/display paths in agreement.
 *
 * The value model matches the backend `customFieldsFromForm` contract: a `number`
 * field carries a JS `number` (so it serializes as a JSON number — the
 * lexical-compare pitfall is avoided); `date` / single-select / `short_text` carry
 * a `string`; a blank field is `null`.
 */

/** A typed custom-field value as held in the UI: number, string, or blank. */
export type CustomFieldValueDraft = string | number | null;

/** The minimum a control needs — satisfied by both `CustomFieldDef` and a value row. */
export interface CustomFieldControl {
  key: string;
  label: string;
  fieldType: CustomFieldType;
  options: CustomFieldOption[];
}

/** Whether a single-select type carries an `options` list. */
function isChoice(fieldType: CustomFieldType): boolean {
  return fieldType === "dropdown" || fieldType === "multiple_choice";
}

/** True when a draft value is "unset" (blank text/select, or an empty number). */
export function isCustomFieldBlank(value: CustomFieldValueDraft): boolean {
  return value === null || value === "";
}

/**
 * The hidden-input payload one field submits (`name="customField"`), per the
 * backend contract: `JSON.stringify({ key, value })` with `value` correctly typed
 * (a number stays a number). A blank value is normalized to `null`.
 */
export function serializeCustomField(
  key: string,
  value: CustomFieldValueDraft,
): string {
  return JSON.stringify({ key, value: isCustomFieldBlank(value) ? null : value });
}

/**
 * Resolve a stored value to its display string: a single-select `value` (an option
 * `code`) resolves to its option label (falling back to the raw code if the option
 * was removed); a number/text value renders verbatim. Returns `""` when blank — the
 * caller decides how to render the empty state (usually an em-dash).
 */
export function customFieldDisplay(field: {
  fieldType: CustomFieldType;
  options: CustomFieldOption[];
  value: CustomFieldValueDraft;
}): string {
  if (isCustomFieldBlank(field.value)) return "";
  if (isChoice(field.fieldType) && typeof field.value === "string") {
    return (
      field.options.find((o) => o.code === field.value)?.label ?? field.value
    );
  }
  return String(field.value);
}

/**
 * The controlled per-type input. `date` uses the project `DatePicker` in a `<div>` +
 * `<label htmlFor>` (NEVER a native `<label>` wrapping the composite picker — a tap
 * would forward to the calendar; see `held-window-fields.tsx`). `number` emits a JS
 * `number` (or `null`); the others emit a `string`.
 */
export function CustomFieldInput({
  field,
  value,
  onChange,
  required = false,
  disabled = false,
  idBase,
  invalid = false,
}: {
  field: CustomFieldControl;
  value: CustomFieldValueDraft;
  onChange: (value: CustomFieldValueDraft) => void;
  required?: boolean;
  disabled?: boolean;
  /** A stable id prefix so the label/control pair is associated (looped fields). */
  idBase: string;
  /** Render the invalid ring (e.g. a required field left blank on submit). */
  invalid?: boolean;
}) {
  const id = `${idBase}-${field.key}`;

  const control = (() => {
    switch (field.fieldType) {
      case "number":
        return (
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            value={typeof value === "number" ? String(value) : ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === "") {
                onChange(null);
                return;
              }
              const n = Number(raw);
              onChange(Number.isFinite(n) ? n : null);
            }}
            disabled={disabled}
            required={required}
            aria-invalid={invalid ? true : undefined}
          />
        );
      case "date":
        return (
          <DatePicker
            id={id}
            labelId={`${id}-label`}
            value={typeof value === "string" ? value : ""}
            onChange={(v) => onChange(v === "" ? null : v)}
            clearable
            disabled={disabled}
            aria-invalid={invalid ? true : undefined}
          />
        );
      case "dropdown":
      case "multiple_choice":
        return (
          <NativeSelect
            id={id}
            className="h-10"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
            disabled={disabled}
            required={required}
            aria-invalid={invalid ? true : undefined}
          >
            <option value="">Selecione…</option>
            {field.options.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        );
      case "short_text":
      default:
        return (
          <Input
            id={id}
            type="text"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            required={required}
            maxLength={200}
            aria-invalid={invalid ? true : undefined}
          />
        );
    }
  })();

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label id={`${id}-label`} htmlFor={id} className="font-medium">
        {field.label}
        {required && (
          <span className="ml-1 font-normal text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {control}
      {required && invalid && (
        <span role="alert" className="text-xs font-medium text-destructive">
          Campo obrigatório.
        </span>
      )}
    </div>
  );
}

/**
 * Read-only "label: value" renderer for one custom-field value (case detail + any
 * static display). Resolves a single-select code to its option label; shows an
 * em-dash for a blank value.
 */
export function CustomFieldValue({ field }: { field: CaseCustomFieldValue }) {
  const display = customFieldDisplay(field);
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {field.label}
      </dt>
      <dd className="text-sm text-foreground text-pretty">
        {display === "" ? (
          <span className="text-muted-foreground/70">—</span>
        ) : (
          display
        )}
      </dd>
    </div>
  );
}

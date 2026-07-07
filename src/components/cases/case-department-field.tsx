"use client";

import { useState } from "react";

import type { Department } from "@/lib/hospitals/departments";
import {
  Field,
  FieldDescription,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";

/** Sentinel select value that reveals the free-text "Outros" input. */
const OTHER = "__other__";

/**
 * The Novo-caso "Unidade / setor" field: a case-level, NON-PHI department
 * selector (Hospital Departments). Renders a dropdown of the hospital's ACTIVE
 * departments plus a visually-distinct "Outros" option that reveals a custom
 * text input. Emits EXACTLY ONE of the hidden fields the create-case actions
 * read — `departmentId` (a managed department) OR `departmentOther` (the custom
 * value) — and the whole field is OPTIONAL (both empty = unspecified).
 *
 * The exactly-one invariant is enforced client-side too (the backend CHECK is
 * the authority): selecting a real department clears any stale "Outros" text,
 * and selecting "Outros" clears the department id. So only ONE hidden field ever
 * carries a value.
 */
export function CaseDepartmentField({
  departments,
  disabled = false,
  idPrefix = "case-department",
}: {
  /** The hospital's ACTIVE departments (archived ones are not selectable). */
  departments: Department[];
  disabled?: boolean;
  idPrefix?: string;
}) {
  // "" = unspecified, OTHER = the custom-text branch, else a department id.
  const [selection, setSelection] = useState<string>("");
  const [otherText, setOtherText] = useState<string>("");

  const isOther = selection === OTHER;
  const departmentId = isOther || selection === "" ? "" : selection;
  const departmentOther = isOther ? otherText : "";

  const { descriptionId, controlProps } = useFieldIds(idPrefix, {
    hasDescription: true,
  });
  const otherId = `${idPrefix}-other`;

  function handleSelect(next: string) {
    setSelection(next);
    // Switching AWAY from "Outros" drops any stale custom text so a real
    // department never rides alongside `departmentOther` (exactly-one).
    if (next !== OTHER) setOtherText("");
  }

  return (
    <div className="flex flex-col gap-2">
      {/* The action reads exactly one of these; the other stays empty. */}
      <input type="hidden" name="departmentId" value={departmentId} />
      <input type="hidden" name="departmentOther" value={departmentOther} />

      <Field>
        <FieldLabel htmlFor={controlProps.id}>
          Unidade / setor{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </FieldLabel>
        <NativeSelect
          id={controlProps.id}
          aria-describedby={controlProps["aria-describedby"]}
          className="h-10"
          value={selection}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={disabled}
        >
          <option value="">Não especificado</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
          {/* Visually distinct "Outros" — separated + em-dash framed. */}
          <option value={OTHER}>— Outros (especificar) —</option>
        </NativeSelect>
        <FieldDescription id={descriptionId}>
          A unidade / setor onde o caso ocorreu. Escolha da lista ou selecione
          &ldquo;Outros&rdquo; para informar um valor.
        </FieldDescription>
      </Field>

      {isOther && (
        <label htmlFor={otherId} className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Outra unidade / setor</span>
          <Input
            id={otherId}
            type="text"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            disabled={disabled}
            placeholder="Ex.: Ambulatório de Cardiologia"
            maxLength={120}
            autoComplete="off"
          />
        </label>
      )}
    </div>
  );
}

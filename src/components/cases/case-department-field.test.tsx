/**
 * Component tests for the Novo-caso {@link CaseDepartmentField} (Hospital
 * Departments): the "Outros" reveal + the EXACTLY-ONE hidden-field emission
 * (`departmentId` XOR `departmentOther`), and that the whole field is optional.
 * Deterministic under jsdom (the shared dev-server preview is contended by
 * concurrent teammate work).
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import type { Department } from "@/lib/hospitals/departments";
import { CaseDepartmentField } from "./case-department-field";

const DEPARTMENTS: Department[] = [
  { id: "d1", hospitalId: "h1", name: "UTI Adulto", position: 0, archived: false },
  { id: "d2", hospitalId: "h1", name: "Pronto-Socorro", position: 1, archived: false },
];

/** Read the two hidden fields the create-case actions consume. */
function hiddenValues(container: HTMLElement) {
  const id = container.querySelector<HTMLInputElement>(
    'input[name="departmentId"]',
  );
  const other = container.querySelector<HTMLInputElement>(
    'input[name="departmentOther"]',
  );
  return { departmentId: id?.value ?? null, departmentOther: other?.value ?? null };
}

describe("CaseDepartmentField", () => {
  it("emits both empty when unspecified (the field is optional)", () => {
    const { container } = render(
      <CaseDepartmentField departments={DEPARTMENTS} />,
    );
    expect(hiddenValues(container)).toEqual({
      departmentId: "",
      departmentOther: "",
    });
    // No "Outros" text input until "Outros" is chosen.
    expect(screen.queryByLabelText(/Outra unidade/i)).toBeNull();
  });

  it("emits ONLY departmentId when a real department is picked", () => {
    const { container } = render(
      <CaseDepartmentField departments={DEPARTMENTS} />,
    );
    fireEvent.change(screen.getByLabelText(/Unidade \/ setor/i), {
      target: { value: "d1" },
    });
    expect(hiddenValues(container)).toEqual({
      departmentId: "d1",
      departmentOther: "",
    });
  });

  it("reveals the text input and emits ONLY departmentOther when 'Outros' is chosen", () => {
    const { container } = render(
      <CaseDepartmentField departments={DEPARTMENTS} />,
    );
    fireEvent.change(screen.getByLabelText(/Unidade \/ setor/i), {
      target: { value: "__other__" },
    });
    const otherInput = screen.getByLabelText(/Outra unidade/i);
    expect(otherInput).toBeInTheDocument();
    fireEvent.change(otherInput, { target: { value: "Ambulatório de Cardiologia" } });

    expect(hiddenValues(container)).toEqual({
      departmentId: "",
      departmentOther: "Ambulatório de Cardiologia",
    });
  });

  it("clears a stale 'Outros' text when switching back to a real department (exactly-one)", () => {
    const { container } = render(
      <CaseDepartmentField departments={DEPARTMENTS} />,
    );
    const select = screen.getByLabelText(/Unidade \/ setor/i);

    // Pick "Outros" + type a custom value…
    fireEvent.change(select, { target: { value: "__other__" } });
    fireEvent.change(screen.getByLabelText(/Outra unidade/i), {
      target: { value: "Custom" },
    });
    // …then switch to a real department: the custom text must NOT ride along.
    fireEvent.change(select, { target: { value: "d2" } });

    expect(hiddenValues(container)).toEqual({
      departmentId: "d2",
      departmentOther: "",
    });
    // The "Outros" input is gone.
    expect(screen.queryByLabelText(/Outra unidade/i)).toBeNull();
  });

  it("only lists active departments as options (archived are pre-filtered upstream) plus 'Outros'", () => {
    render(<CaseDepartmentField departments={DEPARTMENTS} />);
    const select = screen.getByLabelText(/Unidade \/ setor/i) as HTMLSelectElement;
    const optionLabels = [...select.options].map((o) => o.textContent);
    expect(optionLabels).toContain("UTI Adulto");
    expect(optionLabels).toContain("Pronto-Socorro");
    expect(optionLabels.some((l) => l?.includes("Outros"))).toBe(true);
    expect(optionLabels.some((l) => l?.includes("Não especificado"))).toBe(true);
  });
});

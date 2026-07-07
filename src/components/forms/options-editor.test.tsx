/**
 * Component tests for the task-#4 OptionsEditor changes: the per-row "Opções"
 * (metadata) toggle revealing Pontuação + Código + Flagged, the Flagged toggle
 * driving `opt.flagged`, and — critically — the reserved `isOther` row being
 * HIDDEN from the editable list (never rendered, reordered, deleted, or emitted).
 * Deterministic under jsdom.
 */

import { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import type { ItemOption } from "@/lib/queries/forms";
import { OptionsEditor, blankOption } from "./options-editor";

function option(overrides: Partial<ItemOption> = {}): ItemOption {
  return { ...blankOption(0), ...overrides };
}

/** A controlled harness so onChange updates re-render the editor. */
function Harness({
  initial,
  onChangeSpy,
  colorable = false,
}: {
  initial: ItemOption[];
  onChangeSpy?: (next: ItemOption[]) => void;
  colorable?: boolean;
}) {
  const [options, setOptions] = useState<ItemOption[]>(initial);
  return (
    <OptionsEditor
      options={options}
      onChange={(next) => {
        setOptions(next);
        onChangeSpy?.(next);
      }}
      colorable={colorable}
    />
  );
}

describe("OptionsEditor — task #4", () => {
  it("hides score/código/flagged behind the per-row Opções toggle", () => {
    render(
      <Harness
        initial={[
          option({ code: "a", label: "Conforme" }),
          option({ code: "b", label: "Não conforme" }),
        ]}
      />,
    );
    // Metadata not shown by default.
    expect(screen.queryByText("Pontuação")).toBeNull();
    expect(screen.queryByText(/Marcar como sinalizado/)).toBeNull();

    // Toggle the first row's "Opções" panel open.
    fireEvent.click(
      screen.getByRole("button", { name: /Mostrar opções da opção 1/i }),
    );
    expect(screen.getByText("Pontuação")).toBeInTheDocument();
    expect(screen.getByText("Código de análise")).toBeInTheDocument();
    expect(screen.getByText(/Marcar como sinalizado/)).toBeInTheDocument();
  });

  it("opens the metadata panel expanded for a row that already has metadata", () => {
    render(
      <Harness
        initial={[
          option({ code: "a", label: "Grave", flagged: true }),
          option({ code: "b", label: "Leve" }),
        ]}
      />,
    );
    // Row 1 (flagged) opens expanded; row 2 stays collapsed.
    expect(screen.getByText(/Marcar como sinalizado/)).toBeInTheDocument();
  });

  it("Flagged toggle drives opt.flagged", () => {
    const onChange = vi.fn();
    render(
      <Harness
        initial={[option({ code: "a", label: "Grave" })]}
        onChangeSpy={onChange}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Mostrar opções da opção 1/i }),
    );
    const flaggedCheckbox = screen.getByRole("checkbox");
    fireEvent.click(flaggedCheckbox);
    const last = onChange.mock.calls.at(-1)![0] as ItemOption[];
    expect(last[0].flagged).toBe(true);
  });

  it("HIDES the reserved isOther row from the editable list", () => {
    render(
      <Harness
        initial={[
          option({ code: "a", label: "Sim" }),
          option({ code: "b", label: "Não" }),
          option({ code: "__other__", label: "Outro", isOther: true }),
        ]}
      />,
    );
    // The two real options render; the reserved "Outro" row is NOT editable.
    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(2);
    // No editable input holds the reserved label.
    const inputs = screen.getAllByRole("textbox");
    expect(inputs.some((i) => (i as HTMLInputElement).value === "Outro")).toBe(
      false,
    );
    // Reorder controls reflect only the two visible rows (row 2 = last → its
    // "down" is disabled).
    expect(
      screen.getByRole("button", { name: /Mover a opção 2 para baixo/i }),
    ).toBeDisabled();
  });

  it("does not disturb the hidden isOther row when reordering visible rows", () => {
    const onChange = vi.fn();
    render(
      <Harness
        initial={[
          option({ code: "a", label: "Sim" }),
          option({ code: "b", label: "Não" }),
          option({ code: "__other__", label: "Outro", isOther: true }),
        ]}
        onChangeSpy={onChange}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Mover a opção 1 para baixo/i }),
    );
    const next = onChange.mock.calls.at(-1)![0] as ItemOption[];
    // Visible rows swapped; the __other__ row stays LAST and untouched.
    expect(next.map((o) => o.code)).toEqual(["b", "a", "__other__"]);
    expect(next[2].isOther).toBe(true);
  });

  it("prevents deleting the last remaining (visible) option", () => {
    render(<Harness initial={[option({ code: "a", label: "Única" })]} />);
    const rowActions = within(screen.getByRole("listitem"));
    expect(
      rowActions.getByRole("button", { name: /Remover a opção 1/i }),
    ).toBeDisabled();
  });
});

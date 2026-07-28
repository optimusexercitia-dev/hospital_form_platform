/**
 * Component tests for the FF-5 {@link ReferencePicker} (ADR 0091).
 *
 * These cover the three things that were either BROKEN or UNVERIFIABLE at the
 * FF-5 gate, which is why they are worth locking down rather than left to E2E:
 *
 *  1. **The error path had never executed.** `listReferenceCandidates` swallowed
 *     every Postgres error into an empty array (QA M-2, backend `b94785f`), so
 *     `ok: false` never reached this component: the error line, the `searchError`
 *     state and the error arm of the live region were all dead code. Now that the
 *     query layer propagates failures, this is the first thing that exercises them.
 *  2. **An error must not masquerade as an empty lane.** That was M-2's visible
 *     harm — with `entity_refs` off, an HC0Q3 exception produced a zero-row
 *     baseline, which this component then explained as "no patients because the
 *     form is not case-linked". A correct-sounding sentence about a flag outage.
 *     The two must render differently, and that is asserted here directly.
 *  3. **`aria-selected` must follow the ACTIVE option, not the committed value**
 *     (QA m-2). Arrowing the list previously announced "not selected" on the very
 *     row the user was on. This is the one accessibility property the browser
 *     pane could not verify during the build, so it is pinned in jsdom instead.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import type { Item } from "@/lib/queries/forms";
import { ReferencePicker } from "./reference-picker";
import type { ReferenceCandidateRow } from "./references";

function referenceItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "item-ref-1",
    sectionId: "sec-1",
    position: 1,
    itemType: "reference",
    questionKey: "referencia_setor",
    label: "Setor envolvido",
    questionExplanation: null,
    options: null,
    config: { referenceKind: "participant" },
    visibleWhen: null,
    required: false,
    defaultValue: null,
    parentItemId: null,
    children: [],
    content: null,
    ...overrides,
  };
}

const CANDIDATES: ReferenceCandidateRow[] = [
  { targetId: "p-1", label: "UTI Adulto", sublabel: "Setor" },
  { targetId: "p-2", label: "Centro Cirúrgico", sublabel: "Setor" },
];

/** Open the combobox the way a user does, and wait for the baseline fetch. */
async function openPicker() {
  fireEvent.focus(screen.getByRole("combobox"));
  await waitFor(() =>
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "true"),
  );
}

describe("ReferencePicker — search failures (QA M-2: the path that never ran)", () => {
  it("surfaces the action's pt-BR message instead of an empty list", async () => {
    render(
      <ReferencePicker
        item={referenceItem()}
        value={undefined}
        onChange={vi.fn()}
        onSearch={vi.fn().mockResolvedValue({
          ok: false,
          error: "O recurso de referências não está disponível.",
        })}
      />,
    );
    await openPicker();

    // Two matches EXPECTED, and that is the assertion: the message renders in
    // the popup AND in the polite live region. A list that opens under the caret
    // is invisible to a screen reader otherwise, so "visible only" would be a
    // half-fix.
    await waitFor(() =>
      expect(
        screen.getAllByText("O recurso de referências não está disponível."),
      ).toHaveLength(2),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "O recurso de referências não está disponível.",
    );
  });

  it("does NOT explain a failure as an empty lane", async () => {
    // The M-2 harm, asserted as a negative: a failed call must never render the
    // "no patients because this form has no case" copy, which is a statement
    // about scope and would be a confident lie about a flag outage.
    render(
      <ReferencePicker
        item={referenceItem({ config: { referenceKind: "participant" } })}
        value={undefined}
        onChange={vi.fn()}
        onSearch={vi.fn().mockResolvedValue({ ok: false, error: "Falha." })}
      />,
    );
    await openPicker();

    await waitFor(() =>
      expect(screen.getAllByText("Falha.").length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(/vinculad/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/formulário avulso/i)).not.toBeInTheDocument();
  });

  it("renders the empty-lane copy when the call SUCCEEDS with zero rows", async () => {
    // The other half of the same distinction: a genuine empty is still explained,
    // so the fix above did not simply suppress the useful message.
    render(
      <ReferencePicker
        item={referenceItem()}
        value={undefined}
        onChange={vi.fn()}
        onSearch={vi.fn().mockResolvedValue({ ok: true, candidates: [] })}
      />,
    );
    await openPicker();

    await waitFor(() =>
      expect(screen.getAllByText(/Pacientes aparecem aqui/i).length).toBeGreaterThan(0),
    );
    // And it is announced, not merely drawn.
    expect(screen.getByRole("status")).toHaveTextContent(/Pacientes aparecem aqui/i);
  });
});

describe("ReferencePicker — combobox ARIA (QA m-1 / m-2)", () => {
  it("points aria-selected at the ACTIVE option, not the committed one", async () => {
    render(
      <ReferencePicker
        item={referenceItem()}
        // A value is already committed, and it is the SECOND candidate — so if
        // aria-selected tracked the commit, the wrong row would claim selection.
        value={{
          kind: "participant",
          targetId: "p-2",
          label: "Centro Cirúrgico",
          sublabel: "Setor",
        }}
        onChange={vi.fn()}
        onSearch={vi.fn().mockResolvedValue({ ok: true, candidates: CANDIDATES })}
      />,
    );
    await openPicker();
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));

    const options = screen.getAllByRole("option");
    // Baseline: activeIndex starts at 0, so the FIRST row is selected even
    // though the SECOND is the committed value.
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");

    // Arrow down: selection follows focus to the second row.
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    const afterArrow = screen.getAllByRole("option");
    expect(afterArrow[0]).toHaveAttribute("aria-selected", "false");
    expect(afterArrow[1]).toHaveAttribute("aria-selected", "true");
  });

  it("keeps aria-activedescendant on the active option's id", async () => {
    render(
      <ReferencePicker
        item={referenceItem()}
        value={undefined}
        onChange={vi.fn()}
        onSearch={vi.fn().mockResolvedValue({ ok: true, candidates: CANDIDATES })}
      />,
    );
    await openPicker();
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));

    const combobox = screen.getByRole("combobox");
    const active = () => combobox.getAttribute("aria-activedescendant");
    expect(active()).toBe(screen.getAllByRole("option")[0].id);

    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    expect(active()).toBe(screen.getAllByRole("option")[1].id);
  });

  it("drops aria-controls while closed so the IDREF never dangles", () => {
    render(
      <ReferencePicker
        item={referenceItem()}
        value={undefined}
        onChange={vi.fn()}
        onSearch={vi.fn().mockResolvedValue({ ok: true, candidates: CANDIDATES })}
      />,
    );
    // Closed: no listbox is mounted, so pointing at one would be a broken IDREF.
    const combobox = screen.getByRole("combobox");
    expect(combobox).toHaveAttribute("aria-expanded", "false");
    expect(combobox).not.toHaveAttribute("aria-controls");
  });
});

describe("ReferencePicker — keyboard (QA m-4)", () => {
  it("does not open the list on a bare modifier key", () => {
    const onSearch = vi.fn().mockResolvedValue({ ok: true, candidates: [] });
    render(
      <ReferencePicker
        item={referenceItem()}
        value={undefined}
        onChange={vi.fn()}
        onSearch={onSearch}
      />,
    );
    const combobox = screen.getByRole("combobox");
    for (const key of ["Shift", "Control", "Alt", "CapsLock", "F5"]) {
      fireEvent.keyDown(combobox, { key });
    }
    expect(combobox).toHaveAttribute("aria-expanded", "false");
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("opens on a printable key", () => {
    render(
      <ReferencePicker
        item={referenceItem()}
        value={undefined}
        onChange={vi.fn()}
        onSearch={vi.fn().mockResolvedValue({ ok: true, candidates: [] })}
      />,
    );
    const combobox = screen.getByRole("combobox");
    fireEvent.keyDown(combobox, { key: "a" });
    expect(combobox).toHaveAttribute("aria-expanded", "true");
  });

  it("Escape closes without committing the highlighted option", async () => {
    const onChange = vi.fn();
    render(
      <ReferencePicker
        item={referenceItem()}
        value={undefined}
        onChange={onChange}
        onSearch={vi.fn().mockResolvedValue({ ok: true, candidates: CANDIDATES })}
      />,
    );
    await openPicker();
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Enter commits the active option", async () => {
    const onChange = vi.fn();
    render(
      <ReferencePicker
        item={referenceItem()}
        value={undefined}
        onChange={onChange}
        onSearch={vi.fn().mockResolvedValue({ ok: true, candidates: CANDIDATES })}
      />,
    );
    await openPicker();
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith({
      kind: "participant",
      targetId: "p-1",
      label: "UTI Adulto",
      sublabel: "Setor",
    });
  });
});

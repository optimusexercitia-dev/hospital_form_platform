/**
 * Component tests for the wizard {@link InputItem}'s grouped-adjustments §E UX:
 *   - the top-right "Limpar" (Clear) button — present, disabled until the block
 *     holds an answer/observação, and clears the whole block when pressed;
 *   - the "Adicionar observação" button — ALWAYS rendered but disabled until the
 *     block is at least partially answered (excluded for `free_text`).
 * Deterministic under jsdom (the dev-server preview is flaky here).
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import type { Item } from "@/lib/queries/forms";
import { InputItem } from "./input-item";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "item-1",
    sectionId: "sec-1",
    position: 1,
    itemType: "short_text",
    questionKey: "q1",
    label: "Nome do paciente",
    questionExplanation: null,
    options: null,
    config: null,
    visibleWhen: null,
    required: false,
    defaultValue: null,
    parentItemId: null,
    children: [],
    content: null,
    ...overrides,
  };
}

describe("InputItem — Clear (Limpar) button", () => {
  it("is disabled while the block is empty and enabled once answered", () => {
    const { rerender } = render(
      <InputItem
        item={makeItem()}
        value={undefined}
        onChange={vi.fn()}
        onObservationChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const clearBtn = screen.getByRole("button", {
      name: /limpar a resposta/i,
    });
    expect(clearBtn).toBeDisabled();

    rerender(
      <InputItem
        item={makeItem()}
        value="Maria"
        onChange={vi.fn()}
        onObservationChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /limpar a resposta/i }),
    ).toBeEnabled();
  });

  it("is enabled when only an observação exists (no answer yet)", () => {
    render(
      <InputItem
        item={makeItem()}
        value={undefined}
        observation="uma nota"
        onChange={vi.fn()}
        onObservationChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /limpar a resposta/i }),
    ).toBeEnabled();
  });

  it("invokes onClear when pressed", () => {
    const onClear = vi.fn();
    render(
      <InputItem
        item={makeItem()}
        value="Maria"
        onChange={vi.fn()}
        onObservationChange={vi.fn()}
        onClear={onClear}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /limpar a resposta/i }),
    );
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("is absent in read-only contexts (no onClear)", () => {
    render(
      <InputItem item={makeItem()} value="Maria" onChange={vi.fn()} />,
    );
    expect(
      screen.queryByRole("button", { name: /limpar a resposta/i }),
    ).toBeNull();
  });
});

describe("InputItem — always-visible observation button", () => {
  it("renders the observation button disabled before an answer, enabled after", () => {
    const { rerender } = render(
      <InputItem
        item={makeItem()}
        value={undefined}
        onChange={vi.fn()}
        onObservationChange={vi.fn()}
      />,
    );
    const obsBtn = screen.getByRole("button", {
      name: /adicionar observação/i,
    });
    expect(obsBtn).toBeInTheDocument();
    expect(obsBtn).toBeDisabled();

    rerender(
      <InputItem
        item={makeItem()}
        value="Maria"
        onChange={vi.fn()}
        onObservationChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /adicionar observação/i }),
    ).toBeEnabled();
  });

  it("never offers an observation for free_text", () => {
    render(
      <InputItem
        item={makeItem({ itemType: "free_text" })}
        value="algum texto"
        onChange={vi.fn()}
        onObservationChange={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /adicionar observação/i }),
    ).toBeNull();
  });
});

/**
 * Component tests for the "Others" open-option FILL + DISPLAY (task #6): the
 * `__other__` reveal in the wizard (multiple_choice single + checkbox multi), the
 * otherText binding, that Clear wipes otherText, and the read-only "Outro:
 * <valor>" display in AnswerSummary. Deterministic under jsdom.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import type { Item, ItemOption } from "@/lib/queries/forms";
import {
  OTHER_OPTION_CODE,
  OTHER_OPTION_LABEL,
} from "@/lib/forms/option-constants";
import { InputItem } from "./input-item";
import { AnswerSummary } from "./answer-summary";

function opt(over: Partial<ItemOption>): ItemOption {
  return {
    id: "",
    code: "",
    label: "",
    color: null,
    score: null,
    analyticsCode: null,
    flagged: false,
    isOther: false,
    position: 0,
    ...over,
  };
}

/** An mc/checkbox item with two real options + the reserved __other__ row. */
function choiceItem(itemType: "multiple_choice" | "checkbox"): Item {
  return {
    id: "item-1",
    sectionId: "sec-1",
    position: 0,
    itemType,
    questionKey: "q1",
    label: "Motivo",
    questionExplanation: null,
    options: [
      opt({ code: "a", label: "Infecção", position: 0 }),
      opt({ code: "b", label: "Queda", position: 1 }),
      opt({
        code: OTHER_OPTION_CODE,
        label: OTHER_OPTION_LABEL,
        isOther: true,
        position: 2,
      }),
    ],
    config: { allowOther: true },
    visibleWhen: null,
    required: false,
    defaultValue: null,
    parentItemId: null,
    children: [],
    content: null,
  };
}

describe("Others fill — reveal (task #6)", () => {
  it("does NOT show the Outro text input until __other__ is the mc selection", () => {
    const { rerender } = render(
      <InputItem
        item={choiceItem("multiple_choice")}
        value="a"
        onChange={vi.fn()}
        onOtherTextChange={vi.fn()}
      />,
    );
    expect(screen.queryByPlaceholderText("Especifique…")).toBeNull();

    rerender(
      <InputItem
        item={choiceItem("multiple_choice")}
        value={OTHER_OPTION_CODE}
        onChange={vi.fn()}
        onOtherTextChange={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("Especifique…")).toBeInTheDocument();
  });

  it("shows the Outro input when __other__ is among checkbox selections", () => {
    render(
      <InputItem
        item={choiceItem("checkbox")}
        value={["a", OTHER_OPTION_CODE]}
        onChange={vi.fn()}
        onOtherTextChange={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("Especifique…")).toBeInTheDocument();
  });

  it("binds typing to onOtherTextChange (blank allowed)", () => {
    const onOtherTextChange = vi.fn();
    render(
      <InputItem
        item={choiceItem("multiple_choice")}
        value={OTHER_OPTION_CODE}
        otherText=""
        onChange={vi.fn()}
        onOtherTextChange={onOtherTextChange}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Especifique…"), {
      target: { value: "Reação alérgica" },
    });
    expect(onOtherTextChange).toHaveBeenLastCalledWith("Reação alérgica");
  });

  it("does NOT reveal the Outro input in a read-only context (no handler)", () => {
    render(
      <InputItem
        item={choiceItem("multiple_choice")}
        value={OTHER_OPTION_CODE}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByPlaceholderText("Especifique…")).toBeNull();
  });
});

describe("Others — Clear also wipes otherText (task #6)", () => {
  it("the block is clearable when only otherText is present, and Clear fires", () => {
    const onClear = vi.fn();
    render(
      <InputItem
        item={choiceItem("multiple_choice")}
        value={undefined}
        otherText="algum texto"
        onChange={vi.fn()}
        onOtherTextChange={vi.fn()}
        onClear={onClear}
      />,
    );
    const clearBtn = screen.getByRole("button", { name: /Limpar a resposta/i });
    expect(clearBtn).toBeEnabled();
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

/**
 * The answer-payload props `AnswerSummary` requires as of BUG-FF5-002 (m-3).
 * Spread FIRST so a test can override just the one it exercises.
 *
 * A shared constant, not optional props: the required-prop change exists to make
 * a PRODUCTION caller unable to omit saved data silently. Tests are not that
 * guard, and spelling five `undefined`s at every call site would obscure what
 * each test is actually asserting.
 */
const NO_PAYLOAD = {
  matrixCells: undefined,
  riskSelection: undefined,
  reference: undefined,
  observation: undefined,
  otherText: undefined,
} as const;

describe("Others display — AnswerSummary (task #6)", () => {
  it("renders 'Outro: <valor>' beneath the answer when otherText is present", () => {
    render(
      <dl>
        <AnswerSummary
          {...NO_PAYLOAD}
          item={choiceItem("multiple_choice")}
          value={OTHER_OPTION_CODE}
          otherText="Reação alérgica"
        />
      </dl>,
    );
    expect(screen.getByText("Outro:")).toBeInTheDocument();
    expect(screen.getByText("Reação alérgica")).toBeInTheDocument();
  });

  it("omits the Outro line when otherText is blank (Outro selected is still valid)", () => {
    render(
      <dl>
        <AnswerSummary
          {...NO_PAYLOAD}
          item={choiceItem("multiple_choice")}
          value={OTHER_OPTION_CODE}
          otherText=""
        />
      </dl>,
    );
    expect(screen.queryByText("Outro:")).toBeNull();
    // The reserved option's chip label ("Outro") still shows as the value.
    expect(screen.getByText(OTHER_OPTION_LABEL)).toBeInTheDocument();
  });
});

/**
 * FF-3 (ADR 0090 ruling 4) — the EFFECTIVE required marker, at the RENDER level.
 *
 * `validation-rules.test.ts` proves the walk computes `requiredNow` correctly.
 * That is a different claim from "the components read it", and only these tests
 * can fail if a component reverts to the static `item.required`: a walk-level
 * assertion stays green while the marker silently goes stale. All three fill
 * renderers are covered — `InputItem` plus the two matrix paths that live
 * OUTSIDE it, which is exactly where the first enumeration stopped.
 *
 * Each renderer is asserted three ways, because they are separable failures:
 *   1. `requiredNow: true` over `item.required: false` → marked  (the fix);
 *   2. `requiredNow: false` over `item.required: true`  → NOT marked
 *      (proves the prop is really consulted, not OR-ed in);
 *   3. prop absent → falls back to `item.required` (read-only/review untouched).
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import type { Item, MatrixAxisEntry } from "@/lib/queries/forms";

import { InputItem } from "./input-item";
import { MatrixGrid } from "./matrix-grid";
import { RiskMatrixPicker } from "./risk-matrix-picker";
import { AnswerSummary } from "./answer-summary";

function baseItem(over: Partial<Item> = {}): Item {
  return {
    id: "item-1",
    sectionId: "sec-1",
    position: 1,
    itemType: "short_text",
    questionKey: "q1",
    label: "Justificativa",
    questionExplanation: null,
    options: null,
    config: null,
    visibleWhen: null,
    required: false,
    defaultValue: null,
    parentItemId: null,
    children: [],
    content: null,
    ...over,
  } as Item;
}

function axis(code: string, position: number, weight: number | null = null): MatrixAxisEntry {
  return { id: `id-${code}`, code, label: code.toUpperCase(), weight, position };
}

/** The marker is a `*` carrying an "obrigatória" accessible label. */
function markers(): HTMLElement[] {
  return screen.queryAllByLabelText("obrigatória");
}

describe("InputItem — effective required marker", () => {
  const props = {
    value: "",
    onChange: () => {},
  };

  it("marks a field made required only by required_if", () => {
    render(
      <InputItem item={baseItem({ required: false })} {...props} requiredNow />,
    );
    expect(markers()).toHaveLength(1);
  });

  it("does NOT mark when requiredNow is false, even if item.required is true", () => {
    render(
      <InputItem
        item={baseItem({ required: true })}
        {...props}
        requiredNow={false}
      />,
    );
    expect(markers()).toHaveLength(0);
  });

  it("falls back to item.required when the prop is absent", () => {
    render(<InputItem item={baseItem({ required: true })} {...props} />);
    expect(markers()).toHaveLength(1);
  });

  it("sets aria-required on the control from the EFFECTIVE value", () => {
    render(
      <InputItem item={baseItem({ required: false })} {...props} requiredNow />,
    );
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-required", "true");
  });

  it("leaves aria-required off when not effectively required", () => {
    render(<InputItem item={baseItem({ required: false })} {...props} />);
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-required");
  });
});

describe("MatrixGrid — effective required marker", () => {
  const matrixItem = (required: boolean) =>
    baseItem({
      id: "m1",
      itemType: "matrix",
      questionKey: "m1",
      label: "Conformidade",
      required,
      matrixRows: [axis("a", 0), axis("b", 1)],
      matrixColumns: [axis("sim", 0), axis("nao", 1)],
    } as Partial<Item>);

  const props = { cells: undefined, onChange: () => {} };

  it("marks a matrix made required only by required_if", () => {
    render(<MatrixGrid item={matrixItem(false)} {...props} requiredNow />);
    expect(markers().length).toBeGreaterThan(0);
  });

  it("does NOT mark when requiredNow is false, even if item.required is true", () => {
    render(
      <MatrixGrid item={matrixItem(true)} {...props} requiredNow={false} />,
    );
    expect(markers()).toHaveLength(0);
  });

  it("falls back to item.required when the prop is absent", () => {
    render(<MatrixGrid item={matrixItem(true)} {...props} />);
    expect(markers().length).toBeGreaterThan(0);
  });

  /**
   * The wrapper is a `group`, not a `radiogroup` (one radio group PER ROW), and
   * `aria-required` is invalid on both `group` and `role="radio"` — the lint gate
   * rejects the latter. So required-ness is announced through the group's
   * DESCRIPTION, and it must be driven by the effective value.
   */
  it("announces required-ness via the group description, from the effective value", () => {
    const { container } = render(
      <MatrixGrid item={matrixItem(false)} {...props} requiredNow />,
    );
    const group = screen.getByRole("group");
    const describedBy = group.getAttribute("aria-describedby") ?? "";
    const note = describedBy
      .split(" ")
      .map((id) => container.querySelector(`#${id}`))
      .find((el) => el?.textContent?.includes("obrigatória"));
    expect(note).toBeTruthy();
  });

  it("omits that note when not effectively required", () => {
    const { container } = render(<MatrixGrid item={matrixItem(true)} {...props} requiredNow={false} />);
    const describedBy =
      screen.getByRole("group").getAttribute("aria-describedby") ?? "";
    const note = describedBy
      .split(" ")
      .filter(Boolean)
      .map((id) => container.querySelector(`#${id}`))
      .find((el) => el?.textContent?.includes("obrigatória"));
    expect(note).toBeUndefined();
  });
});

/**
 * The REVIEW path (`AnswerSummary`). A field marked mandatory during fill must
 * not read as optional seconds later on the way to a signature.
 *
 * The fallback case is load-bearing here in a way it is not elsewhere: SIX other
 * consumers render submitted records through this component and must keep the
 * authored flag, so "prop absent → static" is a contract, not a convenience.
 */
describe("AnswerSummary — effective required marker (review)", () => {
  it("marks a field made required only by required_if", () => {
    render(
      <AnswerSummary item={baseItem({ required: false })} value="algo" requiredNow />,
    );
    expect(markers()).toHaveLength(1);
  });

  it("does NOT mark when requiredNow is false, even if item.required is true", () => {
    render(
      <AnswerSummary
        item={baseItem({ required: true })}
        value="algo"
        requiredNow={false}
      />,
    );
    expect(markers()).toHaveLength(0);
  });

  it("falls back to item.required when absent — the six historical consumers", () => {
    render(<AnswerSummary item={baseItem({ required: true })} value="algo" />);
    expect(markers()).toHaveLength(1);
  });

  it("stays unmarked when neither the prop nor the flag says required", () => {
    render(<AnswerSummary item={baseItem({ required: false })} value="algo" />);
    expect(markers()).toHaveLength(0);
  });
});

describe("RiskMatrixPicker — effective required marker", () => {
  const riskItem = (required: boolean) =>
    baseItem({
      id: "r1",
      itemType: "risk_matrix",
      questionKey: "r1",
      label: "Risco",
      required,
      matrixRows: [axis("leve", 0, 1), axis("grave", 1, 9)],
      matrixColumns: [axis("rara", 0, 1), axis("frequente", 1, 9)],
    } as Partial<Item>);

  const props = { selection: undefined, onChange: () => {} };

  it("marks a risk matrix made required only by required_if", () => {
    render(<RiskMatrixPicker item={riskItem(false)} {...props} requiredNow />);
    expect(markers().length).toBeGreaterThan(0);
  });

  it("does NOT mark when requiredNow is false, even if item.required is true", () => {
    render(
      <RiskMatrixPicker item={riskItem(true)} {...props} requiredNow={false} />,
    );
    expect(markers()).toHaveLength(0);
  });

  it("falls back to item.required when the prop is absent", () => {
    render(<RiskMatrixPicker item={riskItem(true)} {...props} />);
    expect(markers().length).toBeGreaterThan(0);
  });

  it("sets aria-required on its radiogroup from the EFFECTIVE value", () => {
    render(<RiskMatrixPicker item={riskItem(false)} {...props} requiredNow />);
    expect(screen.getByRole("radiogroup")).toHaveAttribute(
      "aria-required",
      "true",
    );
  });

  it("leaves aria-required off when not effectively required", () => {
    render(
      <RiskMatrixPicker item={riskItem(true)} {...props} requiredNow={false} />,
    );
    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-required");
  });
});

/**
 * BUG-FF3-001, the a11y half: `aria-invalid` must follow the error prop exactly.
 *
 * The state fix (`clearPeerFieldErrors`) is what stops a stale message reaching
 * an untouched peer; this pins the consequence that made it a defect worth fixing
 * rather than a cosmetic one — a field with no error must not be announced
 * invalid, which is the same rule that keeps `warn` off this channel.
 */
describe("InputItem — aria-invalid follows the error prop (BUG-FF3-001)", () => {
  const props = { value: "", onChange: () => {} };

  it("is announced invalid ONLY while an error is present", () => {
    const { unmount } = render(
      <InputItem item={baseItem()} {...props} error="Valor repetido." />,
    );
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    unmount();

    // The peer, once its stale message is cleared, must be clean again.
    render(<InputItem item={baseItem()} {...props} />);
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid");
  });

  it("does not announce invalid for a WARNING (the same channel argument)", () => {
    render(<InputItem item={baseItem()} {...props} warning="Confira o valor." />);
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("status")).toHaveTextContent("Confira o valor.");
  });
});

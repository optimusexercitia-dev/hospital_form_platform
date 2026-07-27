import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import type { Item, ItemOption } from "@/lib/queries/forms";

import { BlockRenderer } from "./block-renderer";

/**
 * Regression coverage for BUG-FF1-004 (Blocker).
 *
 * `input-item.tsx` derived every control id — and every radio `name` — from the
 * static `item.id`. Rendered twice, once per repeating-group instance, that
 * produced two controls sharing one `name`. An HTML radio group is keyed by
 * `name` within a form, so the browser treated both repetitions as ONE
 * exclusivity group: selecting in repetition 2 silently cleared repetition 1.
 * The wizard's per-instance state was correct underneath — the rendered control
 * layer was destroying answers behind it.
 *
 * The two properties are asserted SEPARATELY because they fail independently:
 * ids could be made unique while the `name` stayed shared (uniqueness passes,
 * data still corrupts), and in principle the reverse. The behavioural case
 * asserts the FIRST instance's state after acting on the SECOND — a test that
 * only checks instance 2 passes against this bug unchanged.
 *
 * This is also the gap FE-5 missed: the keyboard-only pass PASSED while this was
 * broken, because with a single instance there is no collision. Everything here
 * renders TWO.
 */

function option(code: string, label: string, position: number): ItemOption {
  return {
    id: `opt-${code}`,
    code,
    label,
    color: null,
    score: null,
    analyticsCode: null,
    flagged: false,
    isOther: false,
    position,
  };
}

const CHOICE: Item = {
  id: "tipo",
  sectionId: "sec-1",
  position: 0,
  itemType: "multiple_choice",
  questionKey: "tipo",
  label: "Tipo",
  questionExplanation: null,
  options: [option("medicacao", "Medicação", 0), option("material", "Material", 1)],
  config: null,
  visibleWhen: null,
  required: false,
  defaultValue: null,
  parentItemId: null,
  children: [],
  content: null,
};

/**
 * Two repetitions of the SAME question inside ONE form — the exact shape the
 * wizard produces for a repeating group, and the shape that had never been
 * rendered before BUG-FF1-001 was fixed (which is why this went unnoticed).
 */
function renderTwoInstances(props: {
  value1?: string;
  value2?: string;
  onChange1?: (v: unknown) => void;
  onChange2?: (v: unknown) => void;
}) {
  return render(
    <form>
      <div data-testid="inst-1">
        <BlockRenderer
          item={CHOICE}
          instanceId="i1"
          imageUrls={{}}
          value={props.value1}
          onChange={props.onChange1 ?? vi.fn()}
        />
      </div>
      <div data-testid="inst-2">
        <BlockRenderer
          item={CHOICE}
          instanceId="i2"
          imageUrls={{}}
          value={props.value2}
          onChange={props.onChange2 ?? vi.fn()}
        />
      </div>
    </form>,
  );
}

function radios(testId: string): HTMLInputElement[] {
  return within(screen.getByTestId(testId)).getAllByRole(
    "radio",
  ) as HTMLInputElement[];
}

describe("BUG-FF1-004 · property 1 — ids and names are instance-unique", () => {
  it("gives the two instances DIFFERENT radio group names", () => {
    renderTwoInstances({});
    const n1 = new Set(radios("inst-1").map((r) => r.name));
    const n2 = new Set(radios("inst-2").map((r) => r.name));
    // Each instance is internally ONE group (its options share a name)…
    expect(n1.size).toBe(1);
    expect(n2.size).toBe(1);
    // …and the two groups are distinct, which is the whole fix.
    expect([...n1][0]).not.toBe([...n2][0]);
  });

  it("gives every control a unique id across both instances", () => {
    renderTwoInstances({});
    const ids = [...radios("inst-1"), ...radios("inst-2")].map((r) => r.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });

  it("keeps each radio reachable by its own accessible name", () => {
    // The WCAG half: before the fix, duplicate ids meant every instance after
    // the first was unreachable by label association.
    renderTwoInstances({});
    for (const testId of ["inst-1", "inst-2"]) {
      const scope = within(screen.getByTestId(testId));
      expect(scope.getByRole("radio", { name: "Medicação" })).toBeInTheDocument();
      expect(scope.getByRole("radio", { name: "Material" })).toBeInTheDocument();
    }
  });

  it("leaves TOP-LEVEL ids byte-identical to the pre-FF-1 form", () => {
    // Deliberate: existing selectors and specs address `item-<id>-opt-<i>`, and
    // this fix must not move them. Only an instance adds a suffix.
    render(
      <form>
        <BlockRenderer
          item={CHOICE}
          imageUrls={{}}
          value={undefined}
          onChange={vi.fn()}
        />
      </form>,
    );
    const all = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(all.map((r) => r.id)).toEqual(["item-tipo-opt-0", "item-tipo-opt-1"]);
    expect(all[0].name).toBe("item-tipo");
  });
});

/**
 * Property 2 — the two repetitions are SEPARATE browser exclusivity groups.
 *
 * A NOTE ON WHY THIS IS NOT A CLICK TEST, because the obvious version is a trap.
 * The intuitive assertion is "click in instance 2, expect instance 1 still
 * checked". Written that way it PASSES AGAINST THE BUG in jsdom, and I confirmed
 * that empirically before trusting it: React DOM's controlled-input machinery
 * re-asserts sibling radios that share a `name` after a discrete event
 * (`restoreControlledState`), so the DOM is repaired before any assertion runs.
 * A probe with two deliberately name-colliding controlled groups showed the
 * first group's radio still `checked === true`. Such a test cannot fail, and a
 * test that cannot fail is not evidence — the exact standard this phase has been
 * held to.
 *
 * What IS deterministic, and IS the root cause, is the grouping itself. HTML
 * keys radio exclusivity by `name` within a form owner, which the DOM exposes
 * directly: `form.elements.namedItem(name)` returns a `RadioNodeList` of every
 * radio in that group. With the bug, all four radios collapse into ONE list —
 * one exclusivity group, so the browser is entitled to clear across
 * repetitions. With the fix there are two lists of two. That is the corruption
 * expressed at the layer where it actually originates, and it goes red under
 * mutation.
 *
 * The end-to-end behavioural proof in a REAL browser is `tester`'s Playwright
 * case, which is where the symptom was originally captured.
 */
describe("BUG-FF1-004 · property 2 — separate browser exclusivity groups", () => {
  function formOf(): HTMLFormElement {
    return document.querySelector("form") as HTMLFormElement;
  }

  it("does NOT collapse both repetitions into one radio group", () => {
    renderTwoInstances({});
    const form = formOf();
    const names = [...radios("inst-1"), ...radios("inst-2")].map((r) => r.name);
    const distinct = [...new Set(names)];

    // Two groups, not one — the whole defect in a single assertion.
    expect(distinct).toHaveLength(2);

    // And each group contains only ITS OWN two options. Under the bug this list
    // held all four, which is precisely why selecting in one cleared the other.
    for (const name of distinct) {
      const group = form.elements.namedItem(name) as RadioNodeList;
      expect(group.length).toBe(2);
    }
  });

  it("keeps each group's value independent", () => {
    // A group's `.value` is the selected option of THAT group. With one shared
    // group there is a single value for both repetitions — the data loss.
    renderTwoInstances({ value1: "medicacao", value2: "material" });
    const form = formOf();
    const n1 = radios("inst-1")[0].name;
    const n2 = radios("inst-2")[0].name;

    expect((form.elements.namedItem(n1) as RadioNodeList).value).toBe(
      "medicacao",
    );
    expect((form.elements.namedItem(n2) as RadioNodeList).value).toBe(
      "material",
    );
  });

  it("routes a change to the acting instance's handler only", () => {
    // Guards a DIFFERENT axis than the name collision: that threading
    // `instanceId` did not cross-wire the per-instance callbacks. Recorded
    // honestly — this one does NOT discriminate BUG-FF1-004 on its own.
    const onChange1 = vi.fn();
    const onChange2 = vi.fn();
    renderTwoInstances({ value1: "medicacao", onChange1, onChange2 });

    fireEvent.click(radios("inst-2").find((r) => r.value === "material")!);

    expect(onChange2).toHaveBeenCalledWith("material");
    expect(onChange1).not.toHaveBeenCalled();
  });
});

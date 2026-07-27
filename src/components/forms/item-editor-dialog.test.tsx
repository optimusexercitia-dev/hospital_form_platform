/**
 * Contract tests for the task-#4 ItemEditorDialog: the hidden-field emission the
 * backend `parseOptions`/`parseConfig` layer reads must be exact (contract drift
 * caused Phase-6 rework). Asserts the §0 fields still emit + the new task-#4
 * fields (`optionFlagged`, `configAllowOther`, `configMinLength/MaxLength`,
 * `configFlaggedWhen`) under the right types/conditions, and the required
 * interlock (forced-uncheck + disabled when conditional). Deterministic under
 * jsdom; the server-only actions module is mocked.
 */

import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";

import type { Item, Section } from "@/lib/queries/forms";

// Radix Dialog (via @radix-ui/react-use-size) needs ResizeObserver, which jsdom
// does not implement — polyfill a no-op so the portal mounts under test.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

// The dialog + image-item-editor import from the `'use server'` actions module,
// which pulls next/headers and cannot load in jsdom — stub it. The dialog only
// PASSES these to useActionState; we never invoke them here.
vi.mock("@/lib/forms/actions", () => ({
  addItem: vi.fn(),
  updateItem: vi.fn(),
  uploadFormAsset: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { ItemEditorDialog } from "./item-editor-dialog";

const SECTION: Section = {
  id: "sec-1",
  position: 0,
  title: null,
  description: null,
  isDefault: true,
  visibleWhen: null,
  requiresSignoff: false,
  signoffRole: null,
  items: [],
};

/** Read a hidden input's value(s) by name from the rendered dialog. */
function hiddenValues(name: string): string[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `input[type="hidden"][name="${name}"]`,
    ),
  ).map((el) => el.value);
}

function renderAdd(itemType: Item["itemType"]) {
  return render(
    <ItemEditorDialog
      open
      onOpenChange={() => {}}
      mode="add"
      itemType={itemType}
      sectionId="sec-1"
      sections={[SECTION]}
      commissionId="c1"
      imageUrl={null}
    />,
  );
}

describe("ItemEditorDialog — hidden-field contract (task #4)", () => {
  it("emits the §0 option fields + optionFlagged at the same index", () => {
    renderAdd("multiple_choice");

    // Type a label into the first option so it becomes a clean (emitted) row.
    const optionInput = screen.getByPlaceholderText("Opção 1");
    fireEvent.change(optionInput, { target: { value: "Conforme" } });

    // The §0 parallel fields all present for the one clean option.
    expect(hiddenValues("option")).toEqual(["Conforme"]);
    expect(hiddenValues("optionCode")).toHaveLength(1);
    expect(hiddenValues("optionColor")).toEqual([""]);
    expect(hiddenValues("optionScore")).toEqual([""]);
    expect(hiddenValues("optionAnalyticsCode")).toEqual([""]);
    // task #4: optionFlagged at the SAME index, '' when not flagged.
    expect(hiddenValues("optionFlagged")).toEqual([""]);
    // The mint-on-first-keystroke code is non-empty (BUG-AMV2-002).
    expect(hiddenValues("optionCode")[0]).not.toBe("");
  });

  it("emits optionFlagged='1' when the row's Flagged toggle is on", () => {
    renderAdd("multiple_choice");
    fireEvent.change(screen.getByPlaceholderText("Opção 1"), {
      target: { value: "Grave" },
    });
    // Open the row's metadata panel + flip Flagged.
    fireEvent.click(
      screen.getByRole("button", { name: /Mostrar opções da opção 1/i }),
    );
    // The only checkbox in the revealed panel is the Flagged toggle.
    const flagged = screen
      .getAllByRole("checkbox")
      .find((c) => within(c.closest("label")!).queryByText(/sinalizado/i));
    fireEvent.click(flagged!);
    expect(hiddenValues("optionFlagged")).toEqual(["1"]);
  });

  it("emits configAllowOther='1' when 'Incluir opção Outros' is on (mc/checkbox)", () => {
    renderAdd("checkbox");
    // Off by default.
    expect(hiddenValues("configAllowOther")).toEqual([""]);
    fireEvent.click(screen.getByRole("checkbox", { name: /Incluir opção/i }));
    expect(hiddenValues("configAllowOther")).toEqual(["1"]);
  });

  it("does NOT offer the Others toggle for dropdown", () => {
    renderAdd("dropdown");
    expect(screen.queryByText(/Incluir opção/i)).toBeNull();
    expect(hiddenValues("configAllowOther")).toEqual([]);
  });

  it("emits configMinLength/configMaxLength for free_text", () => {
    renderAdd("free_text");
    fireEvent.change(screen.getByPlaceholderText("Ex.: 10"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ex.: 280"), {
      target: { value: "280" },
    });
    expect(hiddenValues("configMinLength")).toEqual(["10"]);
    expect(hiddenValues("configMaxLength")).toEqual(["280"]);
  });

  it("emits configFlaggedWhen JSON for a number item when enabled", () => {
    renderAdd("number");
    // Blank until enabled.
    expect(hiddenValues("configFlaggedWhen")).toEqual([""]);
    // Enable "Marcar como sinalizado quando…".
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Marcar como sinalizado quando/i }),
    );
    // Default op is gt; set a value.
    const valueInput = screen.getByLabelText("Valor") as HTMLInputElement;
    fireEvent.change(valueInput, { target: { value: "10" } });
    expect(hiddenValues("configFlaggedWhen")).toEqual([
      JSON.stringify({ op: "gt", value: 10 }),
    ]);
  });

  it("does NOT render the flaggedWhen editor for a choice type", () => {
    renderAdd("multiple_choice");
    expect(screen.queryByText(/Marcar como sinalizado quando/i)).toBeNull();
    expect(hiddenValues("configFlaggedWhen")).toEqual([]);
  });

  it("keeps the required checkbox submittable + enabled when NOT conditional", () => {
    renderAdd("short_text");
    const required = screen.getByRole("checkbox", {
      name: /Resposta obrigatória/i,
    });
    // Not conditional → enabled. Radix Checkbox with a `name` renders a hidden
    // bubble <input name="required" value="on"> for form submission (the button
    // itself carries no name), so assert the submission contract on that input.
    expect(required).toBeEnabled();
    const bubble = document.querySelector<HTMLInputElement>(
      'input[name="required"]',
    );
    expect(bubble).not.toBeNull();
    expect(bubble!.value).toBe("on");
  });

  it("OFFERS required alongside a condition, and says it applies only when shown", () => {
    // FF-1 / ADR 0087 ruling 4 REVERSES the old interlock. The CHECK
    // `form_items_conditional_not_required` is dropped platform-wide, because
    // `app.response_required_complete` already carries the "visibility wins"
    // branch that made the combination safe — it was unreachable dead code only
    // because the CHECK made it unconstructible. "Se tipo = medicação, o nome do
    // medicamento é obrigatório" is the ordinary authoring case FF-1 exists for.
    //
    // KEYSTONE INTENT: restore the interlock (re-add `disabled`/`checked={false}`)
    // and this test must go red on BOTH assertions — the control's state and the
    // copy that explains the semantics.
    const conditionalItem: Item = {
      id: "it-1",
      sectionId: "sec-1",
      position: 0,
      itemType: "short_text",
      questionKey: "q1",
      label: "Detalhe",
      questionExplanation: null,
      options: null,
      config: null,
      visibleWhen: { question_key: "prev", op: "equals", value: "x" },
      required: true, // conditional AND required — now a legal, authorable state
      defaultValue: null,
      parentItemId: null,
      children: [],
      content: null,
    };
    render(
      <ItemEditorDialog
        open
        onOpenChange={() => {}}
        mode="edit"
        item={conditionalItem}
        sectionId="sec-1"
        sections={[SECTION]}
        commissionId="c1"
        imageUrl={null}
      />,
    );
    const required = screen.getByRole("checkbox", {
      name: /Resposta obrigatória/i,
    });
    // The control is live and reflects the item's stored `required`.
    expect(required).toBeEnabled();
    expect(required).toHaveAttribute("aria-checked", "true");
    // …and it submits, so a conditional+required item can actually be authored.
    const bubble = document.querySelector<HTMLInputElement>(
      'input[name="required"]',
    );
    expect(bubble).not.toBeNull();
    expect(bubble!.value).toBe("on");
    // The copy states the resolved semantics rather than a prohibition: the
    // requirement binds only while the condition shows the question.
    expect(
      screen.getByText(/apenas quando aparecer/i),
    ).toBeInTheDocument();
    // The old prohibition must be gone — not merely hidden behind new copy.
    expect(
      screen.queryByText(/não pode ser obrigatória/i),
    ).toBeNull();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { renderedText } from "@/components/dsr/disposal-copy-property";
import type { MintPrintedDocumentInput } from "@/lib/pdf-mint/actions";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

import { MintDocumentButton } from "./mint-document-button";
import { PHI_BAND_NOTICE, PHI_CHOICE_LABEL } from "./labels";

/**
 * PDF·P3 — the per-mint PHI choice, asserted on the COMPOSED DIALOG.
 *
 * ⭐ The string-level suite (`phi-fork.test.ts`) proves the copy says the right
 * thing and that no component reads the kind. Neither can see the two failures
 * that actually reach a user:
 *
 * 1. **The choice never reaches the action.** A checkbox whose state is read but
 *    not sent produces a de-identified document from a mint the user identified —
 *    silently, with a success banner. Every string assertion still passes.
 * 2. **The D6 notice is rendered CONDITIONALLY on the box.** A reader who only
 *    ever sees it while the box is ticked learns the exact opposite of what it
 *    says: that the band follows the choice.
 *
 * ⛔ Every assertion pairs with its differential. "The action received
 * `includePhi: true`" is worthless without "and it received `false`/absent when
 * the box was left alone" — a component hardcoding `true` passes the first.
 */

const SOURCE_ID = "11111111-2222-3333-4444-555555555555";

const MINTED = {
  id: "doc-1",
  verificationShortCode: "ABCD-1234",
  downloadPath: "/api/documentos/doc-1",
} as const;

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

let action: ReturnType<typeof vi.fn>;

beforeEach(() => {
  refresh.mockReset();
  action = vi.fn().mockResolvedValue({ ok: true, document: MINTED });
});

async function openDialog(phiCapable: boolean) {
  const user = userEvent.setup();
  render(
    <MintDocumentButton
      sourceKind={phiCapable ? "case" : "meeting"}
      sourceId={SOURCE_ID}
      watermark="final"
      scopeLabel="Caso 0042"
      phiCapable={phiCapable}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the mock stands in for the server action; typing it fully would assert nothing this suite is about.
      action={action as any}
    />,
  );
  await user.click(screen.getByRole("button", { name: /emitir documento/i }));
  return user;
}

/** The `includePhi` the action was called with, or `undefined` if unset. */
function sentIncludePhi(): boolean | undefined {
  const input = action.mock.calls[0]?.[0] as MintPrintedDocumentInput | undefined;
  return input?.includePhi;
}

describe("⭐ the PHI choice reaches the action (ADR 0104 D9)", () => {
  it("⛔ DEFAULT OFF — an untouched dialog does not mint identified", async () => {
    const user = await openDialog(true);
    const box = screen.getByRole("checkbox", { name: new RegExp(PHI_CHOICE_LABEL, "i") });
    expect(box).toHaveProperty("ariaChecked", "false");

    await user.click(screen.getByRole("button", { name: "Emitir documento" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    // Not merely "not true" — an absent field and `false` are both acceptable
    // here, but `true` is the failure this pins.
    expect(sentIncludePhi()).not.toBe(true);
  });

  it("⭐ ticking the box sends includePhi: true — the DIFFERENTIAL of the above", async () => {
    const user = await openDialog(true);
    await user.click(
      screen.getByRole("checkbox", { name: new RegExp(PHI_CHOICE_LABEL, "i") }),
    );
    await user.click(screen.getByRole("button", { name: "Emitir documento" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(sentIncludePhi()).toBe(true);
  });

  it("⛔ a PHI-INCAPABLE kind offers no choice and sends no field", async () => {
    const user = await openDialog(false);
    // POSITIVE half — the dialog really opened, so the absence below is a
    // finding about the control and not about a dialog that never rendered.
    expect(screen.getByRole("button", { name: "Emitir documento" })).toBeDefined();
    expect(screen.queryByRole("checkbox")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Emitir documento" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(sentIncludePhi()).toBeUndefined();
  });

  it("⛔ NO MEMORY between mints — reopening the dialog unticks the box", async () => {
    // ADR 0104 D9's "no memory of the choice". A remembered `true` silently
    // identifies a later print nobody chose to identify.
    const user = await openDialog(true);
    const label = new RegExp(PHI_CHOICE_LABEL, "i");
    await user.click(screen.getByRole("checkbox", { name: label }));
    expect(screen.getByRole("checkbox", { name: label })).toHaveProperty(
      "ariaChecked",
      "true",
    );

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("checkbox")).toBeNull());
    await user.click(screen.getByRole("button", { name: /emitir documento/i }));

    expect(screen.getByRole("checkbox", { name: label })).toHaveProperty(
      "ariaChecked",
      "false",
    );
  });
});

describe("⭐ ADR 0144 D6 — the band notice is UNCONDITIONAL on the surface", () => {
  it("⛔ it is visible BEFORE the box is ticked, which is when it matters", async () => {
    await openDialog(true);
    // The whole point: the user about to mint a "de-identified" dossier reads
    // this. Rendering it only alongside a ticked box teaches the opposite rule.
    const notice = screen.getByText(PHI_BAND_NOTICE);
    expect(notice).toBeDefined();
  });

  it("it stays visible AFTER ticking — it is not a warning about the choice", async () => {
    const user = await openDialog(true);
    await user.click(
      screen.getByRole("checkbox", { name: new RegExp(PHI_CHOICE_LABEL, "i") }),
    );
    expect(screen.getByText(PHI_BAND_NOTICE)).toBeDefined();
  });

  it("the choice is DESCRIBED BY the notice, so a screen reader reaches it", async () => {
    await openDialog(true);
    const box = screen.getByRole("checkbox", {
      name: new RegExp(PHI_CHOICE_LABEL, "i"),
    });
    const describedBy = box.getAttribute("aria-describedby");
    expect(describedBy, "the choice has no description").toBeTruthy();
    const ids = describedBy!.split(/\s+/);
    // Two descriptions: what ticking adds, and the band caveat. A control that
    // pointed only at the hint would leave the D6 sentence unreachable to anyone
    // navigating control-to-control.
    expect(ids.length).toBe(2);
    const described = ids.map((id) => document.getElementById(id)?.textContent ?? "");
    expect(described.join(" ")).toContain(PHI_BAND_NOTICE);
  });
});

describe("⭐ the keyboard path still completes mint → download", () => {
  it("opening focuses the CHOICE, not the commit", async () => {
    await openDialog(true);
    // With a consequential choice on screen, landing on the confirm button would
    // put the commit ahead of the decision in the tab order — Enter on the
    // focused control would mint without the choice entering the user's path.
    await waitFor(() =>
      expect(document.activeElement?.getAttribute("role")).toBe("checkbox"),
    );
  });

  it("⛔ a PHI-INCAPABLE kind still opens on the commit — unchanged from P1/P2", async () => {
    await openDialog(false);
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe("Emitir documento"),
    );
  });

  it("⭐ focus lands on the download link after a successful mint", async () => {
    const user = await openDialog(true);
    await user.click(screen.getByRole("button", { name: "Emitir documento" }));
    await waitFor(() => {
      const active = document.activeElement as HTMLAnchorElement | null;
      expect(active?.tagName).toBe("A");
      expect(active?.getAttribute("href")).toBe(MINTED.downloadPath);
    });
  });

  it("⭐ an identified mint SAYS SO on success; a de-identified one claims nothing", async () => {
    const user = await openDialog(true);
    await user.click(
      screen.getByRole("checkbox", { name: new RegExp(PHI_CHOICE_LABEL, "i") }),
    );
    await user.click(screen.getByRole("button", { name: "Emitir documento" }));
    await waitFor(() =>
      expect(screen.getByText(/com a identificação do paciente/i)).toBeDefined(),
    );
  });

  it("⛔ the de-identified success state promises NO absence", async () => {
    // The differential for the test above — and the safety half. Any
    // "sem dados do paciente" here would be a guarantee the artifact cannot
    // honour (D6), stated at the exact moment the user decides who to send it to.
    const user = await openDialog(true);
    await user.click(screen.getByRole("button", { name: "Emitir documento" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    // ⚠ `renderedText`, not `textContent` — an ABSENCE property, where fused
    // sibling text nodes turn a miss into a false green. See the twin note in
    // previa-link.test.tsx.
    const text = renderedText(document.body);
    expect(text).toMatch(/ABCD-1234/); // the success state really rendered
    expect(text).not.toMatch(/sem identificação|sem dados do paciente|an[ôo]nim/i);
    expect(text).not.toMatch(/com a identificação do paciente/i);
  });
});

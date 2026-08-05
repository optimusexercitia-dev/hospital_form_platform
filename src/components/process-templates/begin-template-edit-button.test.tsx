/**
 * Component tests for {@link BeginTemplateEditButton} (ADR 0096 D2).
 *
 * The thing under test is a BEHAVIOURAL FORK that is invisible to tsc:
 *
 *  - **no open draft** → clicking must NOT act. It opens a confirm dialog first,
 *    because the click is about to FORK a published process and the author needs
 *    to learn that the published version keeps serving new cases until they
 *    publish the new draft.
 *  - **an open draft exists** → clicking must act immediately. `beginTemplateEdit`
 *    is idempotent (it returns the existing draft and clones nothing), so there is
 *    nothing to confirm and a dialog would be a toll booth on "resume my work".
 *
 * A refactor collapsing these into always-confirm or never-confirm compiles, lints,
 * builds, and passes every other gate in this repo. The load-bearing assertion is
 * therefore the NEGATIVE one — "clicking the trigger did not call the action" —
 * not the presence of a dialog.
 *
 * The `'use server'` actions module is stubbed (it pulls `next/headers`, and its
 * real body throws until backend's M5); we assert on the spy.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const beginTemplateEdit = vi.fn();
const push = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/process-templates/actions", () => ({
  beginTemplateEdit: (...args: unknown[]) => beginTemplateEdit(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh, replace: vi.fn() }),
}));

import { BeginTemplateEditButton } from "./begin-template-edit-button";

const TEMPLATE_PATH = "/o/rede-a/c/ccih/manage/process-templates/t1";

beforeAll(() => {
  // Radix needs ResizeObserver; jsdom lacks it.
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

beforeEach(() => {
  beginTemplateEdit.mockReset();
  push.mockReset();
  refresh.mockReset();
  beginTemplateEdit.mockResolvedValue({ ok: true, templateVersionId: "v4" });
});

function renderFork() {
  return render(
    <BeginTemplateEditButton
      templateId="t1"
      templatePath={TEMPLATE_PATH}
      existingDraftVersionNumber={null}
      publishedVersionNumber={3}
    />,
  );
}

function renderResume() {
  return render(
    <BeginTemplateEditButton
      templateId="t1"
      templatePath={TEMPLATE_PATH}
      existingDraftVersionNumber={4}
      publishedVersionNumber={3}
    />,
  );
}

describe("BeginTemplateEditButton", () => {
  describe("fork arm — no open draft", () => {
    it("labels the action as editing the process", () => {
      renderFork();
      expect(screen.getByRole("button", { name: /Editar processo/ })).toBeTruthy();
    });

    it("does NOT call the action on the first click", async () => {
      // THE load-bearing assertion. A collapse to never-confirm would fork the
      // published process on a single click and this is the only gate that notices.
      renderFork();
      fireEvent.click(screen.getByRole("button", { name: /Editar processo/ }));
      await waitFor(() => expect(screen.getByRole("alertdialog")).toBeTruthy());
      expect(beginTemplateEdit).not.toHaveBeenCalled();
    });

    it("explains that the published version keeps serving new cases", async () => {
      renderFork();
      fireEvent.click(screen.getByRole("button", { name: /Editar processo/ }));
      const dialog = await screen.findByRole("alertdialog");
      expect(dialog.textContent).toContain(
        "novos casos continuam sendo abertos com a versão 3",
      );
    });

    it("calls the action only after the confirm", async () => {
      renderFork();
      fireEvent.click(screen.getByRole("button", { name: /Editar processo/ }));
      await screen.findByRole("alertdialog");
      fireEvent.click(screen.getByRole("button", { name: "Criar rascunho" }));
      await waitFor(() => expect(beginTemplateEdit).toHaveBeenCalledWith("t1"));
    });
  });

  describe("resume arm — a draft already exists", () => {
    it("labels the action as continuing the existing draft", () => {
      renderResume();
      expect(
        screen.getByRole("button", { name: /Continuar rascunho \(v4\)/ }),
      ).toBeTruthy();
    });

    it("calls the action immediately, with no confirmation step", async () => {
      // The other half of the fork: a collapse to always-confirm would put a
      // dialog in front of "resume what I was doing". Nothing else catches it.
      renderResume();
      fireEvent.click(
        screen.getByRole("button", { name: /Continuar rascunho \(v4\)/ }),
      );
      await waitFor(() => expect(beginTemplateEdit).toHaveBeenCalledWith("t1"));
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
  });

  describe("navigation contract", () => {
    it("navigates to the RETURNED draft id on an absolute path", async () => {
      // Absolute, not relative: the version lives in `?v=`, so a relative push
      // would resolve against whichever version URL happened to be current.
      // And the id must be the one the action returned, never the template id.
      renderResume();
      fireEvent.click(
        screen.getByRole("button", { name: /Continuar rascunho \(v4\)/ }),
      );
      await waitFor(() =>
        expect(push).toHaveBeenCalledWith(`${TEMPLATE_PATH}?v=v4`),
      );
    });

    it("does not navigate when the action fails", async () => {
      beginTemplateEdit.mockResolvedValue({
        ok: false,
        error: "Você não tem permissão para esta ação.",
      });
      renderResume();
      fireEvent.click(
        screen.getByRole("button", { name: /Continuar rascunho \(v4\)/ }),
      );
      await screen.findByText("Você não tem permissão para esta ação.");
      expect(push).not.toHaveBeenCalled();
    });

    it("does not navigate when the action succeeds without an id", async () => {
      // Defensive: `ok: true` with no id is not a usable destination.
      beginTemplateEdit.mockResolvedValue({ ok: true });
      renderResume();
      fireEvent.click(
        screen.getByRole("button", { name: /Continuar rascunho \(v4\)/ }),
      );
      await waitFor(() => expect(beginTemplateEdit).toHaveBeenCalled());
      expect(push).not.toHaveBeenCalled();
    });
  });
});

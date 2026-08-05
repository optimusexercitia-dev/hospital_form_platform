/**
 * Render tests for {@link VersionWorkflowBanner} (ADR 0096 D2).
 *
 * This component exists to stop ONE specific failure: an author edits a published
 * process, walks away satisfied, and nothing they changed ever reaches a case
 * because they never published the draft. The copy is the entire mitigation, so
 * the copy is what these tests pin — specifically that the DRAFT state names the
 * version still in force, which is the sentence doing the work.
 *
 * The archived state's `preservedCasesSentence` is also covered at 0 / 1 / many.
 * That helper exists because the inline-ternary version of it was unreviewable
 * (pt-BR agreement there spans an article, a noun, a verb and two participles),
 * and a silent regression to a wrong plural is exactly the kind of thing no other
 * gate in this repo would catch.
 *
 * Assertions read `textContent` because the copy interleaves `<strong>` and JSX
 * whitespace expressions, which defeat a whole-string `getByText`.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { VersionWorkflowBanner } from "./version-workflow-banner";

/** Defaults for the "viewing the draft, v3 is live" situation. */
const DRAFT_PROPS = {
  status: "draft" as const,
  versionNumber: 4,
  caseCount: 0,
  publishedVersionNumber: 3,
  publishedVersionHref: "/t/t1?v=v3",
  draftVersionNumber: null,
  draftVersionHref: null,
};

describe("VersionWorkflowBanner", () => {
  describe("draft — the state that carries the workflow risk", () => {
    it("names the version still in force for new cases", () => {
      // The whole point: "what you are editing is NOT what cases are using".
      const { container } = render(<VersionWorkflowBanner {...DRAFT_PROPS} />);
      expect(container.textContent).toContain(
        "Novos casos continuam sendo abertos com a",
      );
      expect(container.textContent).toContain("versão 3");
    });

    it("says the changes do not reach cases until published", () => {
      const { container } = render(<VersionWorkflowBanner {...DRAFT_PROPS} />);
      expect(container.textContent).toContain(
        "enquanto este rascunho não for publicado",
      );
    });

    it("heads with the draft version being edited", () => {
      render(<VersionWorkflowBanner {...DRAFT_PROPS} />);
      expect(
        screen.getByRole("heading", {
          name: "Você está editando o rascunho da versão 4",
        }),
      ).toBeTruthy();
    });

    it("offers a way back to the version in force", () => {
      render(<VersionWorkflowBanner {...DRAFT_PROPS} />);
      expect(
        screen.getByRole("link", { name: "Ver a versão 3, em vigor" }),
      ).toBeTruthy();
    });

    it("says cases cannot be opened yet when nothing was ever published", () => {
      const { container } = render(
        <VersionWorkflowBanner
          {...DRAFT_PROPS}
          versionNumber={1}
          publishedVersionNumber={null}
          publishedVersionHref={null}
        />,
      );
      expect(container.textContent).toContain(
        "ainda não é possível abrir casos com ele",
      );
      // No published version means no "in force" link to offer.
      expect(screen.queryByRole("link")).toBeNull();
    });
  });

  describe("published — explains that editing forks rather than mutates", () => {
    const publishedProps = {
      status: "published" as const,
      versionNumber: 3,
      caseCount: 12,
      publishedVersionNumber: 3,
      publishedVersionHref: null,
      draftVersionNumber: null,
      draftVersionHref: null,
    };

    it("states it is in force and no longer alterable", () => {
      const { container } = render(
        <VersionWorkflowBanner {...publishedProps} />,
      );
      expect(
        screen.getByRole("heading", { name: "Versão 3 — em vigor" }),
      ).toBeTruthy();
      expect(container.textContent).toContain("não pode mais ser alterada");
    });

    it("explains that editing creates a draft and this version keeps valendo", () => {
      const { container } = render(
        <VersionWorkflowBanner {...publishedProps} />,
      );
      expect(container.textContent).toContain("criamos um rascunho a partir dela");
      expect(container.textContent).toContain("continua valendo");
    });

    it("surfaces an already-open draft so it is not forgotten", () => {
      const { container } = render(
        <VersionWorkflowBanner
          {...publishedProps}
          draftVersionNumber={4}
          draftVersionHref="/t/t1?v=v4"
        />,
      );
      expect(container.textContent).toContain("Já existe um rascunho em aberto");
      expect(
        screen.getByRole("link", { name: "Continuar o rascunho da versão 4" }),
      ).toBeTruthy();
    });
  });

  describe("archived — history, framed as preserved rather than broken", () => {
    const archivedProps = {
      status: "archived" as const,
      versionNumber: 1,
      caseCount: 5,
      publishedVersionNumber: 3,
      publishedVersionHref: "/t/t1?v=v3",
      draftVersionNumber: null,
      draftVersionHref: null,
    };

    it("says it is no longer used for new cases", () => {
      const { container } = render(<VersionWorkflowBanner {...archivedProps} />);
      expect(
        screen.getByRole("heading", { name: "Versão 1 — arquivada" }),
      ).toBeTruthy();
      expect(container.textContent).toContain(
        "não é mais usada para abrir novos casos",
      );
    });

    it("uses plural agreement for many cases", () => {
      const { container } = render(<VersionWorkflowBanner {...archivedProps} />);
      expect(container.textContent).toContain(
        "Os 5 casos abertos sob ela seguem preservados exatamente como estavam",
      );
    });

    it("uses singular agreement for exactly one case", () => {
      const { container } = render(
        <VersionWorkflowBanner {...archivedProps} caseCount={1} />,
      );
      expect(container.textContent).toContain(
        "O único caso aberto sob ela segue preservado exatamente como estava",
      );
    });

    it("uses the none-at-all wording for zero cases", () => {
      const { container } = render(
        <VersionWorkflowBanner {...archivedProps} caseCount={0} />,
      );
      expect(container.textContent).toContain(
        "Nenhum caso chegou a ser aberto sob ela.",
      );
      // Never claim preservation of cases that do not exist.
      expect(container.textContent).not.toContain("seguem preservados");
    });

    it("points at the version now in force", () => {
      render(<VersionWorkflowBanner {...archivedProps} />);
      expect(
        screen.getByRole("link", { name: "Ver a versão 3, em vigor" }),
      ).toBeTruthy();
    });
  });

  describe("accessibility", () => {
    it("labels the section by its own heading in every state", () => {
      for (const props of [
        DRAFT_PROPS,
        { ...DRAFT_PROPS, status: "published" as const },
        { ...DRAFT_PROPS, status: "archived" as const },
      ]) {
        const { container, unmount } = render(
          <VersionWorkflowBanner {...props} />,
        );
        const section = container.querySelector("section");
        const heading = container.querySelector("h2");
        expect(section?.getAttribute("aria-labelledby")).toBe(heading?.id);
        unmount();
      }
    });
  });
});

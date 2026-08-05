/**
 * Render tests for {@link CaseTemplateProvenance} (ADR 0096 D3).
 *
 * The load-bearing claim here is the `null` one: `getCaseTemplateProvenance`
 * returns `null` for a PROCESSLESS case, and that is a supported answer, not a
 * failed load. That rule lives in a doc comment today, which means nothing
 * enforces it — a future refactor that turns the `null` branch into an early
 * `return null`, a skeleton, or an error state would pass tsc, lint and the whole
 * build. These tests encode it executably instead (the repo's standing lesson:
 * a comment is an assertion that goes stale silently).
 *
 * Text is asserted via `textContent` rather than `getByText` because the rendered
 * output deliberately interleaves an `sr-only` label, a link and a badge — a
 * whole-string `getByText` would not match across those element boundaries.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import type { CaseTemplateProvenance as TemplateProvenance } from "@/lib/queries/process-templates";
import { CaseTemplateProvenance } from "./case-template-provenance";

const PUBLISHED: TemplateProvenance = {
  templateId: "t1",
  templateVersionId: "v3",
  versionNumber: 3,
  title: "Revisão de óbito",
  status: "published",
  publishedAt: "2026-07-01T12:00:00Z",
};

describe("CaseTemplateProvenance", () => {
  describe("processless case (provenance === null)", () => {
    it("states 'Sem processo' rather than rendering nothing", () => {
      const { container } = render(
        <CaseTemplateProvenance provenance={null} />,
      );
      expect(container.textContent).toContain("Sem processo");
    });

    it("renders no error or alert role — null is a supported answer", () => {
      render(<CaseTemplateProvenance provenance={null} />);
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("renders no link, since there is no version to open", () => {
      render(
        <CaseTemplateProvenance
          provenance={null}
          templateVersionHref="/o/a/c/ccih/manage/process-templates/t1?v=v3"
        />,
      );
      expect(screen.queryByRole("link")).toBeNull();
    });
  });

  describe("case running a template version", () => {
    it("shows the version's own title and number", () => {
      const { container } = render(
        <CaseTemplateProvenance provenance={PUBLISHED} />,
      );
      expect(container.textContent).toContain("Revisão de óbito · versão 3");
    });

    it("omits the status badge while the version is still the published one", () => {
      // `Publicada` on a case running the current version is noise, not signal.
      render(<CaseTemplateProvenance provenance={PUBLISHED} />);
      expect(screen.queryByText("Publicada")).toBeNull();
    });

    it("shows the status badge once the version is archived", () => {
      // This is the governance signal: the case predates the current process.
      render(
        <CaseTemplateProvenance
          provenance={{ ...PUBLISHED, status: "archived" }}
        />,
      );
      expect(screen.getByText("Arquivada")).toBeTruthy();
    });

    it("keeps the version title as authored, not the template's current one", () => {
      const { container } = render(
        <CaseTemplateProvenance
          provenance={{
            ...PUBLISHED,
            title: "Revisão de óbito — piloto",
            versionNumber: 1,
            status: "archived",
          }}
        />,
      );
      expect(container.textContent).toContain(
        "Revisão de óbito — piloto · versão 1",
      );
    });
  });

  describe("link affordance", () => {
    it("links to the exact version when a href is supplied", () => {
      const href = "/o/a/c/ccih/manage/process-templates/t1?v=v3";
      render(
        <CaseTemplateProvenance
          provenance={PUBLISHED}
          templateVersionHref={href}
        />,
      );
      expect(screen.getByRole("link").getAttribute("href")).toBe(href);
    });

    it("degrades to plain text when the viewer cannot open the builder", () => {
      // The staff case view passes no href — it must still show the same fact.
      const { container } = render(
        <CaseTemplateProvenance provenance={PUBLISHED} />,
      );
      expect(screen.queryByRole("link")).toBeNull();
      expect(container.textContent).toContain("Revisão de óbito · versão 3");
    });
  });
});

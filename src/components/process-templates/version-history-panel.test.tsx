/**
 * Component tests for {@link VersionHistoryPanel} (ADR 0096 D3).
 *
 * This is the surface a coordinator — or a surveyor reading over their shoulder —
 * uses to answer "which version was in force when". A silent ordering or
 * status-label regression here is a governance defect, not a cosmetic one, so the
 * two load-bearing assertions are:
 *
 *  1. **Order is preserved verbatim.** The query layer's contract is newest-first;
 *     the panel must render what it is given and must NOT re-sort. A stray
 *     `.sort()` — the obvious "tidy-up" edit — would silently reorder history.
 *  2. **The per-version title appears only when it DIFFERS from the version in
 *     view.** D1 moved `title` onto the version precisely so a rename is visible
 *     in history; showing an identical title on every row buries the one time it
 *     changed, and dropping the conditional entirely hides a rename outright.
 *
 * `matchMedia` is polyfilled as reduced-motion so the shared `RiseInGroup` bails
 * out of its dynamic GSAP import. That keeps the DOM exactly what was rendered —
 * deterministic, and it exercises the accessibility-mandated path.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeAll } from "vitest";

import type { ProcessTemplateVersionSummary } from "@/lib/queries/process-templates";
import { VersionHistoryPanel } from "./version-history-panel";

beforeAll(() => {
  if (typeof window.matchMedia === "undefined") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: true, // reduced motion → RiseInGroup no-ops
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
      }),
    });
  }
});

function version(
  over: Partial<ProcessTemplateVersionSummary> &
    Pick<ProcessTemplateVersionSummary, "id" | "versionNumber" | "status">,
): ProcessTemplateVersionSummary {
  return {
    templateId: "t1",
    title: "Revisão de óbito",
    description: null,
    createdBy: "u1",
    createdAt: "2026-06-01T10:00:00Z",
    publishedAt: null,
    caseCount: 0,
    ...over,
  };
}

// Newest first, as the query layer returns them.
const VERSIONS: ProcessTemplateVersionSummary[] = [
  version({ id: "v4", versionNumber: 4, status: "draft" }),
  version({
    id: "v3",
    versionNumber: 3,
    status: "published",
    publishedAt: "2026-07-01T12:00:00Z",
    caseCount: 12,
  }),
  version({
    id: "v2",
    versionNumber: 2,
    status: "archived",
    publishedAt: "2026-06-15T12:00:00Z",
    caseCount: 1,
  }),
  version({ id: "v1", versionNumber: 1, status: "archived", caseCount: 0 }),
];

function renderPanel(currentVersionId = "v3", versions = VERSIONS) {
  return render(
    <VersionHistoryPanel
      org="rede-a"
      slug="ccih"
      templateId="t1"
      versions={versions}
      currentVersionId={currentVersionId}
    />,
  );
}

describe("VersionHistoryPanel", () => {
  describe("ordering", () => {
    it("renders versions in the exact order supplied, without re-sorting", () => {
      renderPanel();
      const rendered = screen
        .getAllByRole("link")
        .map((a) => /Versão (\d+)/.exec(a.textContent ?? "")?.[1]);
      expect(rendered).toEqual(["4", "3", "2", "1"]);
    });

    it("still preserves order when the input is not descending", () => {
      // Proves the assertion above is about PRESERVATION, not about the panel
      // happening to agree with a sort it applied itself.
      renderPanel("v3", [...VERSIONS].reverse());
      const rendered = screen
        .getAllByRole("link")
        .map((a) => /Versão (\d+)/.exec(a.textContent ?? "")?.[1]);
      expect(rendered).toEqual(["1", "2", "3", "4"]);
    });
  });

  describe("status labels", () => {
    it("renders the version lifecycle vocabulary", () => {
      renderPanel();
      expect(screen.getByText("Rascunho")).toBeTruthy();
      expect(screen.getByText("Publicada")).toBeTruthy();
      expect(screen.getAllByText("Arquivada")).toHaveLength(2);
    });
  });

  describe("case counts — the weight of each row", () => {
    it("uses pt-BR agreement at none / one / many", () => {
      const { container } = renderPanel();
      expect(container.textContent).toContain("12 casos");
      expect(container.textContent).toContain("1 caso");
      expect(container.textContent).toContain("Nenhum caso");
    });

    it("never renders '1 casos'", () => {
      const { container } = renderPanel();
      expect(container.textContent).not.toContain("1 casos");
    });
  });

  describe("timing line", () => {
    it("shows a publication date for a published version", () => {
      // Asserting the prefix, not the formatted date — the exact rendering is
      // timezone-dependent and would make this test flaky by locale.
      const { container } = renderPanel();
      expect(container.textContent).toContain("Publicada em");
    });

    it("marks an open draft as not yet published", () => {
      const { container } = renderPanel();
      expect(container.textContent).toContain("Ainda não publicada");
    });

    it("falls back to the creation date for a never-published version", () => {
      const { container } = renderPanel();
      expect(container.textContent).toContain("Criada em");
    });
  });

  describe("per-version title (D1 rename visibility)", () => {
    it("hides the title when it matches the version in view", () => {
      renderPanel();
      // Every fixture shares one title, so nothing should be echoed per row.
      expect(screen.queryByText("Revisão de óbito")).toBeNull();
    });

    it("shows the title on a version that was named differently", () => {
      renderPanel("v3", [
        VERSIONS[0],
        VERSIONS[1],
        version({
          id: "v2",
          versionNumber: 2,
          status: "archived",
          title: "Revisão de óbito — piloto",
        }),
      ]);
      expect(screen.getByText("Revisão de óbito — piloto")).toBeTruthy();
    });
  });

  describe("navigation and current-version marking", () => {
    it("links each row to its own version via ?v=", () => {
      renderPanel();
      const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
      expect(hrefs).toContain(
        "/o/rede-a/c/ccih/manage/process-templates/t1?v=v3",
      );
      expect(hrefs).toContain(
        "/o/rede-a/c/ccih/manage/process-templates/t1?v=v1",
      );
    });

    it("marks exactly the version in view with aria-current", () => {
      renderPanel("v2");
      const current = screen
        .getAllByRole("link")
        .filter((a) => a.getAttribute("aria-current") === "true");
      expect(current).toHaveLength(1);
      expect(current[0].textContent).toContain("Versão 2");
    });
  });
});

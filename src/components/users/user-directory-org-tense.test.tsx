/**
 * The user directory's ORG-AFFILIATION TENSE chip, and the `?includeEnded=` vocabulary
 * that brings the rows it marks into view (AFF4 F6; ADR 0151 D10 / ADR 0154).
 *
 * ⛔ WHY THE CHIP EXISTS AT ALL. The toggle and the chip are a PAIR. `includeEnded` widens
 * the roster to people whose org affiliation has ENDED; without a marker those rows are
 * indistinguishable from current staff, so the widening silently misinforms rather than
 * informs. Neither half is complete alone, which is why both are asserted here.
 *
 * ⚠ `null` IS NOT A THIRD TENSE, and the assertions below are deliberately shaped to say
 * so. `listOrgUsers` cannot return null (its roster predicate IS an org affiliation, so a
 * row without one cannot appear) and `listHospitalUsers` always returns null (it never
 * reads `organization_affiliations`). Those two directions are pinned on the query side in
 * `src/lib/queries/org-roster-predicate.test.ts`; what is pinned HERE is that the render
 * path does not invent a rendering for null — putting a "desconhecido" chip on the
 * hospital directory would show users a scope limitation as though it were a fact about
 * the person.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { UserDirectoryList } from "@/components/users/user-directory-list";
import {
  INCLUDE_ENDED_PARAM,
  includeEndedValue,
  parseIncludeEnded,
} from "@/components/users/user-directory-ended-filter";
import type { OrgUserListItem } from "@/lib/users/types";

function person(overrides: Partial<OrgUserListItem> = {}): OrgUserListItem {
  return {
    id: "p1",
    fullName: "Ana Ribeiro",
    email: "ana@test.local",
    categoryLabel: "Enfermagem",
    status: "active",
    orgAffiliationStatus: "ativo",
    orgAffiliationEndedOn: null,
    hospitalNames: ["Hospital Central"],
    committees: [],
    councilRegistration: null,
    ...overrides,
  };
}

function renderRow(user: OrgUserListItem) {
  return render(
    <UserDirectoryList org="rede-a" users={[user]} total={1} filtered={false} />,
  );
}

/** Proof of life: the row rendered at all, so an absent chip means absent, not blank page. */
function expectsRowRendered() {
  expect(screen.getByText("Ana Ribeiro")).toBeInTheDocument();
}

describe("directory row — the org-affiliation tense chip", () => {
  it("⭐ marks an ENCERRADO row, and names the fact it reports", () => {
    renderRow(person({ orgAffiliationStatus: "encerrado", orgAffiliationEndedOn: "2026-02-01" }));
    expectsRowRendered();

    const badge = screen.getByText("Encerrado");
    expect(badge).toBeInTheDocument();
    // ⛔ The `sr-only` prefix is what separates this from the ACCOUNT badge in the
    // "Situação" cell, which a screen-reader user hears moments later in the same row and
    // which can also read a tense-like word. Without it the two are one undifferentiated
    // run of statuses.
    expect(
      screen.getByText("Vínculo com a organização:", { exact: false }),
    ).toBeInTheDocument();
  });

  it("renders NO chip for an active affiliation — the default roster stays quiet", () => {
    renderRow(person({ orgAffiliationStatus: "ativo" }));
    expectsRowRendered();
    expect(screen.queryByText("Encerrado")).toBeNull();
    expect(screen.queryByText("Vínculo com a organização:", { exact: false })).toBeNull();
  });

  it("⛔ renders NO chip for `null`, indistinguishably from `ativo` — the hospital arm", () => {
    // `null` means "this surface cannot resolve the tense", never "unknown status". The
    // honest rendering is silence: a "desconhecido" pill would put the hospital
    // directory's scope limitation in front of users as a fact about the person.
    renderRow(person({ orgAffiliationStatus: null, orgAffiliationEndedOn: null }));
    expectsRowRendered();
    expect(screen.queryByText("Encerrado")).toBeNull();
    expect(screen.queryByText(/desconhecid/i)).toBeNull();
  });

  it("⛔ keeps the class-keyed name node an E2E spec selects on", () => {
    // `e2e/aff2-directory.spec.ts` resolves the display name by exactly
    // `span.truncate.text-sm.font-semibold` (grep the selector; a cited line number
    // rots, and that spec is `tester`'s to change). The chip was added in a NEW flex
    // parent rather than onto that node so the locator keeps resolving — this repo has a
    // recorded incident of a restyle silently re-scoping E2E locators, and a spec is not
    // this component's to edit.
    const { container } = renderRow(
      person({ orgAffiliationStatus: "encerrado", orgAffiliationEndedOn: "2026-02-01" }),
    );
    const node = container.querySelector("span.truncate.text-sm.font-semibold");
    expect(node).not.toBeNull();
    expect(within(node as HTMLElement).getByText("Ana Ribeiro")).toBeInTheDocument();
  });
});

describe("`?includeEnded=` — the widening vocabulary, and its one default", () => {
  it("⭐ narrows by DEFAULT: absence, and every value that is not the ON token", () => {
    // *Narrowing can be wrong and safe; widening cannot.* A truthiness test would widen on
    // all three of these, and `?includeEnded=false` widening is the exact shape of that
    // bug — it reads, to whoever typed it, as the opposite of what it does.
    expect(parseIncludeEnded(undefined)).toBe(false);
    expect(parseIncludeEnded("")).toBe(false);
    expect(parseIncludeEnded("0")).toBe(false);
    expect(parseIncludeEnded("false")).toBe(false);
    expect(parseIncludeEnded("true")).toBe(false);
    expect(parseIncludeEnded("yes")).toBe(false);
  });

  it("widens only for the exact ON token", () => {
    expect(parseIncludeEnded("1")).toBe(true);
  });

  it("round-trips: what the control writes is what the page reads", () => {
    // The two live in one module precisely so they cannot drift; this walks the seam
    // rather than trusting that co-location is enough.
    expect(parseIncludeEnded(includeEndedValue(true))).toBe(true);
    expect(parseIncludeEnded(includeEndedValue(false))).toBe(false);
  });

  it("⛔ expresses OFF as ABSENCE, never as an explicit falsy value", () => {
    // A URL that spells out its own default accumulates noise on every toggle and stops
    // the clean directory link being the canonical one.
    expect(includeEndedValue(false)).toBeUndefined();
    expect(includeEndedValue(true)).toBe("1");
    expect(INCLUDE_ENDED_PARAM).toBe("includeEnded");
  });
});

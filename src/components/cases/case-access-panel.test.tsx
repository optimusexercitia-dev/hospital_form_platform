/**
 * Regression test for the grantee picker's actor exclusion (ADR 0205 Amendment 1
 * D6·5·1): `grant_case_access` now refuses a self-grant (`p_user = auth.uid()`) at
 * the door, so {@link CaseAccessPanel}'s picker must never list the acting user as
 * a candidate — independent of role. Before this fix the list only dropped
 * `staff_admin` rows, which left a PLAIN member row for the actor visible whenever
 * the viewer reached the panel while holding a non-`staff_admin` membership (the
 * exact shape of the exploit persona named in D6·5·1: a tenancy admin who also
 * holds a plain commission membership).
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";

// The panel imports the `'use server'` actions module (pulls next/headers) — stub it.
vi.mock("@/lib/case-access/actions", () => ({
  grantCaseAccess: vi.fn(),
  revokeCaseAccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

import { CaseAccessPanel } from "./case-access-panel";
import type { CaseDetail } from "@/lib/queries/cases";
import type { MemberListItem } from "@/lib/queries/members";

// Radix Dialog needs both — jsdom ships neither (only exercised if a row's grant
// dialog is opened, but the fixtures below share this file's render helper).
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

// The panel reads only `.phases` / `.narratives` off `CaseDetail` (attribution
// derivation) — a minimal stand-in for the large query-result type is standard
// practice in this test file's siblings (activate-phase-dialog.test.tsx).
const emptyDetail = { phases: [], narratives: [] } as unknown as CaseDetail;

const ACTOR_ID = "user-actor";

const members: MemberListItem[] = [
  {
    memberId: "mem-actor",
    userId: ACTOR_ID,
    fullName: "Atuante Admin",
    email: "actor@test.local",
    // A PLAIN membership, deliberately — the exact shape of the exploit persona
    // D6·5·1 names: a tenancy admin who ALSO holds a plain `staff` membership.
    // The old `role !== 'staff_admin'` filter alone would have let this row
    // through.
    role: "staff",
    joinedAt: "2026-01-01T00:00:00Z",
    titleId: null,
    titleName: null,
    isActive: true,
  },
  {
    memberId: "mem-other",
    userId: "user-other",
    fullName: "Outro Membro",
    email: "other@test.local",
    role: "staff",
    joinedAt: "2026-01-01T00:00:00Z",
    titleId: null,
    titleName: null,
    isActive: true,
  },
  {
    memberId: "mem-coordinator",
    userId: "user-coordinator",
    fullName: "Coordenadora",
    email: "coord@test.local",
    role: "staff_admin",
    joinedAt: "2026-01-01T00:00:00Z",
    titleId: null,
    titleName: null,
    isActive: true,
  },
];

function renderPanel() {
  return render(
    <CaseAccessPanel
      caseId="case-1"
      members={members}
      detail={emptyDetail}
      grants={[]}
      caseOpen
      actorId={ACTOR_ID}
    />,
  );
}

describe("CaseAccessPanel — grantee picker excludes the actor", () => {
  it("never lists the acting user, even as a plain (non-staff_admin) member", () => {
    renderPanel();
    expect(screen.queryByText("Atuante Admin")).not.toBeInTheDocument();
  });

  it("still lists other non-coordinator members", () => {
    renderPanel();
    expect(screen.getByText("Outro Membro")).toBeInTheDocument();
  });

  it("still excludes staff_admin coordinators (unrelated, pre-existing rule)", () => {
    renderPanel();
    expect(screen.queryByText("Coordenadora")).not.toBeInTheDocument();
  });
});

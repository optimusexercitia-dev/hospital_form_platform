/**
 * Component tests for the meeting "Participantes" section (task #9 / plan step H):
 * the zero-config default (convocar todos, no checklist), the toggle-off reveal +
 * subset selection, and the seed routing on submit —
 * `seedExpectedAttendees(meetingId)` for "all" vs
 * `seedSelectedAttendees(meetingId, userIds)` for a subset. Deterministic under
 * jsdom; the server-only actions module is mocked.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

import type { CommissionMeetingType } from "@/lib/queries/meetings";
import type { MemberListItem } from "@/lib/queries/members";

const createMeeting = vi.fn();
const updateMeeting = vi.fn();
const seedExpectedAttendees = vi.fn();
const seedSelectedAttendees = vi.fn();

// The dialog imports the `'use server'` actions module (pulls next/headers) —
// stub it; we assert on these spies instead.
vi.mock("@/lib/meetings/actions", () => ({
  createMeeting: (...args: unknown[]) => createMeeting(...args),
  updateMeeting: (...args: unknown[]) => updateMeeting(...args),
  seedExpectedAttendees: (...args: unknown[]) => seedExpectedAttendees(...args),
  seedSelectedAttendees: (...args: unknown[]) => seedSelectedAttendees(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

import { MeetingFormDialog } from "./meeting-form-dialog";

// Radix Dialog needs ResizeObserver (jsdom lacks it) — polyfill a no-op.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

beforeEach(() => {
  createMeeting.mockReset();
  seedExpectedAttendees.mockReset();
  seedSelectedAttendees.mockReset();
  createMeeting.mockResolvedValue({ ok: true, meetingId: "m1" });
  seedExpectedAttendees.mockResolvedValue({ ok: true });
  seedSelectedAttendees.mockResolvedValue({ ok: true });
});

const TYPES: CommissionMeetingType[] = [];

const MEMBERS: MemberListItem[] = [
  {
    memberId: "cm1",
    userId: "u1",
    fullName: "Ana Coordenadora",
    email: "ana@x.test",
    role: "staff_admin",
    joinedAt: "2026-01-01",
    titleId: null,
    titleName: "Presidente",
    isActive: true,
  },
  {
    memberId: "cm2",
    userId: "u2",
    fullName: "Bruno Membro",
    email: "bruno@x.test",
    role: "staff",
    joinedAt: "2026-01-02",
    titleId: null,
    titleName: null,
    isActive: true,
  },
];

function renderCreate() {
  return render(
    <MeetingFormDialog
      mode="create"
      open
      onOpenChange={() => {}}
      org="org-a"
      slug="ccih"
      commissionId="c1"
      meetingTypes={TYPES}
      members={MEMBERS}
    />,
  );
}

/** Fill the minimum required fields so the form submits (title + start). */
function fillRequired() {
  fireEvent.change(screen.getByPlaceholderText(/Reunião ordinária/i), {
    target: { value: "Reunião de teste" },
  });
  // The DateTimePicker renders a hidden input for the start; the create action is
  // mocked, so a valid start value isn't required to route through submit — but we
  // set the title (the only client-required field here) and submit.
}

describe("MeetingFormDialog — Participantes (task #9)", () => {
  it("shows the section with 'Convocar todos os membros' ON by default (no checklist)", () => {
    renderCreate();
    expect(screen.getByText("Participantes")).toBeInTheDocument();
    const toggle = screen.getByRole("checkbox", {
      name: /Convocar todos os membros/i,
    });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    // Zero-config: no member checklist while "all" is on.
    expect(screen.queryByText("Ana Coordenadora")).toBeNull();
  });

  it("reveals a member checklist when 'all' is toggled OFF", () => {
    renderCreate();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Convocar todos os membros/i }),
    );
    expect(screen.getByText("Ana Coordenadora")).toBeInTheDocument();
    expect(screen.getByText("Bruno Membro")).toBeInTheDocument();
    // Both members start selected (default = all) → count reflects it.
    expect(screen.getByText(/2 membros convocados/i)).toBeInTheDocument();
  });

  it("updates the convocados count as members are toggled", () => {
    renderCreate();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Convocar todos os membros/i }),
    );
    // Uncheck Bruno.
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Bruno Membro/i }),
    );
    expect(screen.getByText(/1 membro convocado/i)).toBeInTheDocument();
  });

  it("routes 'all' → seedExpectedAttendees(meetingId) on submit", async () => {
    renderCreate();
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: /Agendar reunião/i }));
    await waitFor(() => expect(createMeeting).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(seedExpectedAttendees).toHaveBeenCalledWith("m1"),
    );
    expect(seedSelectedAttendees).not.toHaveBeenCalled();
  });

  it("routes a subset → seedSelectedAttendees(meetingId, userIds) on submit", async () => {
    renderCreate();
    fillRequired();
    // Toggle off "all", then deselect Bruno → only u1 remains.
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Convocar todos os membros/i }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Bruno Membro/i }));
    fireEvent.click(screen.getByRole("button", { name: /Agendar reunião/i }));
    await waitFor(() => expect(createMeeting).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(seedSelectedAttendees).toHaveBeenCalledWith("m1", ["u1"]),
    );
    expect(seedExpectedAttendees).not.toHaveBeenCalled();
  });

  it("does NOT render the Participantes section in edit mode", () => {
    render(
      <MeetingFormDialog
        mode="edit"
        open
        onOpenChange={() => {}}
        org="org-a"
        slug="ccih"
        commissionId="c1"
        meetingTypes={TYPES}
        members={MEMBERS}
        meeting={
          {
            id: "m9",
            title: "Existente",
            meetingTypeId: null,
            modality: "presencial",
            scheduledStart: null,
            scheduledEnd: null,
            locationText: null,
            meetingUrl: null,
          } as never
        }
      />,
    );
    expect(screen.queryByText("Participantes")).toBeNull();
  });
});

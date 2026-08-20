/**
 * The MEETING lane's retention disclosure (ADR 0056 Amendment 1).
 *
 * ⭐ WHAT THIS EXISTS TO PREVENT. The rule the door-widening was built on is that a
 * PHI-capable column may not be left both UNREDACTED and UNNAMED. PO ruled
 * `meetings.title` is kept, so it must be *named as kept* — until
 * {@link DSR_MEETING_RESIDUE_RETAINED} actually renders, the platform sits in exactly
 * the state `FUP-MEETING-DISPOSAL-LEAVES-CHILD-TEXT` forbids. "The constant exists"
 * is not the requirement; "an operator confirming a meeting disposal reads it" is.
 *
 * ⛔ THE TWO CONSTANTS MUST STAY TWO, and that is what the negative arm pins.
 * `DSR_RESIDUE_NOTICE` is shared by the referral and case lanes, whose doors have
 * different reaches — a claim about meeting titles or signature notes is FALSE there.
 * The cheap fix someone will reach for is a fifth line on the shared constant; these
 * tests red if anyone does.
 *
 * Both arms are pinned in the same file so neither can go vacuous: a surface hard-wired
 * to always show the meeting lines fails the negative tests, one hard-wired never to
 * show them fails the positive tests. Only the real conditional satisfies both.
 */

import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const disposeMeetingMinutesTask = vi.fn();
const completeDsrTask = vi.fn();
const executeDisposalTask = vi.fn();
const disposeReferralPhi = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/dsr/actions", () => ({
  disposeMeetingMinutesTask: (...a: unknown[]) => disposeMeetingMinutesTask(...a),
  completeDsrTask: (...a: unknown[]) => completeDsrTask(...a),
  executeDisposalTask: (...a: unknown[]) => executeDisposalTask(...a),
}));

vi.mock("@/lib/referrals/actions", () => ({
  disposeReferralPhi: (...a: unknown[]) => disposeReferralPhi(...a),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

import type {
  DsrTaskRow,
  DsrOutcomeRecord as DsrOutcomeRecordType,
} from "@/lib/queries/dsr";
import {
  DSR_MEETING_RESIDUE_RETAINED,
  DSR_RESIDUE_NOTICE,
} from "@/lib/dsr/messages";
import { DsrMeetingDisposeDialog } from "./dsr-meeting-dispose-dialog";
import { DsrTaskInbox } from "./dsr-task-inbox";
import { DsrOutcomeRecord } from "./dsr-outcome-record";
import { ReferralDisposeDialog } from "@/components/referrals/referral-dispose-dialog";

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
  disposeMeetingMinutesTask.mockReset();
  completeDsrTask.mockReset();
  executeDisposalTask.mockReset();
  disposeReferralPhi.mockReset();
  refresh.mockReset();
});

/**
 * A disposal task of the given kind. `canExecute: false` deliberately — an
 * executable meeting task ALSO mounts `DsrMeetingDisposeDialog`, whose own copy of
 * the constants would make every `getByText` below ambiguous. The residue disclosure
 * is not gated on `canExecute`, so this isolates the inbox's own rendering.
 */
function task(kind: DsrTaskRow["kind"], module: DsrTaskRow["module"]): DsrTaskRow {
  return {
    id: "task-1",
    requestId: "req-1",
    kind,
    module,
    entityId: "entity-1",
    commissionId: "c1",
    commissionName: "CCIH",
    commissionSlug: "ccih",
    hospitalId: "h1",
    status: "pending",
    note: null,
    completionNote: null,
    attestedByName: null,
    attestedRedactions: null,
    completedAt: null,
    createdAt: "2026-08-20T00:00:00Z",
    canExecute: false,
  };
}

function renderInbox(kind: DsrTaskRow["kind"], module: DsrTaskRow["module"]) {
  return render(<DsrTaskInbox org="rede-a" tasks={[task(kind, module)]} />);
}

function openMeetingDialog(): HTMLElement {
  render(
    <DsrMeetingDisposeDialog
      org="rede-a"
      taskId="task-1"
      meetingId="meeting-1"
      label="Reunião de agosto"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Descartar a ata/ }));
  return screen.getByRole("alertdialog");
}

/**
 * A closed, granted outcome record. Both tiers' parts sum exactly, because the
 * component holds itself to `total === disposed + pending + retired` and a fixture
 * that violated it would be testing a state the query layer cannot produce.
 */
function outcomeRecord(meetingMinutesDisposed: boolean): DsrOutcomeRecordType {
  return {
    requestId: "req-1",
    hospitalId: "h1",
    fileRef: "PROC-2026-001",
    status: "closed",
    outcome: "granted",
    outcomeBasis: null,
    legalConsultationRef: null,
    receivedAt: "2026-08-01T00:00:00Z",
    dueDate: "2026-08-16T00:00:00Z",
    adjudicatedAt: "2026-08-05T00:00:00Z",
    closedAt: "2026-08-10T00:00:00Z",
    mechanical: { total: 2, disposed: 2, pending: 0, retired: 0 },
    attested: {
      total: 1,
      completed: 1,
      retired: 0,
      pending: 0,
      redactions: 0,
      reviewers: ["Ana Souza"],
    },
    residue: DSR_RESIDUE_NOTICE,
    meetingMinutesDisposed,
  };
}

function openReferralDialog(): HTMLElement {
  render(<ReferralDisposeDialog referralId="ref-1" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Apagar dados do paciente" }),
  );
  return screen.getByRole("alertdialog");
}

describe("the two residue constants are separate and stay separate", () => {
  it("shares no line between them", () => {
    // Anti-vacuity: both sets must be non-empty before any disjointness claim.
    expect(DSR_RESIDUE_NOTICE.length).toBeGreaterThan(0);
    expect(DSR_MEETING_RESIDUE_RETAINED.length).toBeGreaterThan(0);

    // ⛔ The merge guard. If someone "simplifies" by appending the meeting lines to
    // the shared constant, this reds — and so does every negative test below.
    const shared = new Set<string>(DSR_RESIDUE_NOTICE);
    for (const line of DSR_MEETING_RESIDUE_RETAINED) {
      expect(shared.has(line), `meeting line leaked into the shared notice: ${line.slice(0, 40)}…`).toBe(false);
    }
  });

  it("names the title as retained — the column PO ruled is kept", () => {
    // The specific obligation: `meetings.title` unredacted must not also be unnamed.
    expect(DSR_MEETING_RESIDUE_RETAINED.some((l) => /título/i.test(l))).toBe(true);
  });

  it("carries no remedy guidance in the shared copy", () => {
    // ⚠ MEASURED, AND DELIBERATELY NOT THE ABSOLUTE CLAIM. An earlier version of this
    // comment said the title "cannot be edited by any door"; that is false as stated,
    // and the first correction to it was also too absolute. The accurate form:
    //
    //   · A remedy corridor DOES exist — reopen → edit → re-sign — but only for
    //     `in_signature` and `signed`.
    //   · `app.guard_meeting_status` has NO transition arm for `distributed` or
    //     `cancelled`. On those two terminal states the title genuinely cannot be
    //     changed by any door.
    //   · `reopen_meeting` gates on `is_staff_admin_of` alone, while the disposal door
    //     also admits `is_tenancy_admin_of` — so an operator entitled to dispose is
    //     not necessarily entitled to reopen.
    //
    // Guidance to "edit the title first" would therefore be wrong for a large share of
    // readers — two of the four locked states, plus every tenancy-admin disposer. That
    // is why the shared copy names the retention and stops there.
    const text = DSR_MEETING_RESIDUE_RETAINED.join(" ");
    expect(text).not.toMatch(/edite|editar|altere|alterar|corrija|corrigir|renomeie/i);
  });
});

describe("MEETING disposal surfaces render BOTH constants (positive arm)", () => {
  it("the meeting dispose dialog renders the shared notice AND the retained list", () => {
    // Unconditional first: iterating an empty constant would assert nothing at all.
    expect(DSR_RESIDUE_NOTICE).toHaveLength(4);
    expect(DSR_MEETING_RESIDUE_RETAINED).toHaveLength(4);

    const dialog = openMeetingDialog();
    for (const line of DSR_RESIDUE_NOTICE) {
      expect(within(dialog).getByText(line)).toBeInTheDocument();
    }
    for (const line of DSR_MEETING_RESIDUE_RETAINED) {
      expect(within(dialog).getByText(line)).toBeInTheDocument();
    }
  });

  it("the OUTCOME RECORD renders both when a meeting disposal completed", () => {
    // ⭐ The artifact handed to the DATA SUBJECT — the one surface where a false
    // statement is a false statement to them.
    expect(DSR_RESIDUE_NOTICE).toHaveLength(4);
    expect(DSR_MEETING_RESIDUE_RETAINED).toHaveLength(4);

    render(<DsrOutcomeRecord record={outcomeRecord(true)} />);
    for (const line of DSR_RESIDUE_NOTICE) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
    for (const line of DSR_MEETING_RESIDUE_RETAINED) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
  });

  it("the inbox card for a dispose_meeting task renders both", () => {
    expect(DSR_RESIDUE_NOTICE).toHaveLength(4);
    expect(DSR_MEETING_RESIDUE_RETAINED).toHaveLength(4);

    renderInbox("dispose_meeting", "meeting");
    for (const line of DSR_RESIDUE_NOTICE) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
    for (const line of DSR_MEETING_RESIDUE_RETAINED) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
  });
});

describe("NON-MEETING disposal surfaces render ONLY the shared notice (negative arm)", () => {
  // Every non-meeting disposal kind the inbox can show. Enumerated from
  // DSR_TASK_KIND_LABELS' disposal entries, not from a hand-kept list.
  const NON_MEETING: Array<[DsrTaskRow["kind"], DsrTaskRow["module"]]> = [
    ["dispose_case", "case"],
    ["dispose_event", "event"],
    ["dispose_referral", "referral"],
  ];

  for (const [kind, module] of NON_MEETING) {
    it(`${kind} shows the shared notice and NOT the meeting retention`, () => {
      expect(DSR_RESIDUE_NOTICE).toHaveLength(4);
      expect(DSR_MEETING_RESIDUE_RETAINED).toHaveLength(4);

      renderInbox(kind, module);

      // Proof-of-life: the card really did render a residue disclosure. Without
      // this, a card that rendered nothing at all would pass the negative half.
      for (const line of DSR_RESIDUE_NOTICE) {
        expect(screen.getByText(line)).toBeInTheDocument();
      }
      for (const line of DSR_MEETING_RESIDUE_RETAINED) {
        expect(
          screen.queryByText(line),
          `meeting retention must NOT appear on a ${kind} task`,
        ).toBeNull();
      }
    });
  }

  it("the OUTCOME RECORD omits the retention when NO meeting disposal completed", () => {
    // ⛔ THE ARM THAT IS THE WHOLE POINT. `meetingMinutesDisposed` is derived from
    // the POSITIVE completion signal, so a request that disposed no meeting — or
    // whose meeting task was retired, erasing nothing — must not claim a retention
    // that never happened. That is the over-claim pointing the other way, in the
    // document the subject receives.
    expect(DSR_RESIDUE_NOTICE).toHaveLength(4);
    expect(DSR_MEETING_RESIDUE_RETAINED).toHaveLength(4);

    render(<DsrOutcomeRecord record={outcomeRecord(false)} />);

    // Proof-of-life: the record DID render its residue disclosure.
    for (const line of DSR_RESIDUE_NOTICE) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
    for (const line of DSR_MEETING_RESIDUE_RETAINED) {
      expect(
        screen.queryByText(line),
        "outcome record must not claim a retention that never happened",
      ).toBeNull();
    }
  });

  it("the referral dispose dialog shows the shared notice and NOT the meeting retention", () => {
    // The other lane that renders the shared constant directly. A meeting-title
    // claim here would be simply false — this referral has no minutes.
    expect(DSR_RESIDUE_NOTICE).toHaveLength(4);
    expect(DSR_MEETING_RESIDUE_RETAINED).toHaveLength(4);

    const dialog = openReferralDialog();
    for (const line of DSR_RESIDUE_NOTICE) {
      expect(within(dialog).getByText(line)).toBeInTheDocument();
    }
    for (const line of DSR_MEETING_RESIDUE_RETAINED) {
      expect(within(dialog).queryByText(line)).toBeNull();
    }
  });
});

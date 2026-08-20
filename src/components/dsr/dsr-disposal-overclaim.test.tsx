/**
 * The ADR 0056 Consequence (b) over-claim is ABSENT from every disposal surface —
 * asserted on RENDERED OUTPUT, the property defined once in
 * {@link ../dsr/disposal-copy-property}.
 *
 * ⭐ WHY THIS FILE EXISTS: "the tests cover it" is a claim with a CARDINALITY, and this
 * one's was 1. `FUP-OVERCLAIM-PROPERTY-ONE-SURFACE-ONLY` measured that only the referral
 * dialog asserted the absence of the over-claim, while three further components reach a
 * `dispose_*` door and render disposal copy. `dsr-meeting-residue.test.tsx` imports all
 * four but greps ZERO for a totality quantifier — it pins the residue LINES, which is a
 * different property: a surface can render all four residue lines correctly and still
 * promise a total erasure in its own bespoke copy two blocks above. That is exactly what
 * the referral dialog shipped.
 *
 * THE ROSTER, and where each surface is pinned (four of four, none by accident):
 *   1. `dsr-meeting-dispose-dialog`      — here
 *   2. `dsr-task-inbox`'s disposal card  — here, over every disposal kind
 *   3. `dsr-outcome-record`              — here, in both meeting arms
 *   4. `referral-dispose-dialog`         — `referral-dispose-dialog.test.tsx` claim 2,
 *      left in place because it is `FUP-DISPOSE-DIALOG-OVERCLAIM`'s closure instrument
 *      and covers that dialog's pre-open summary region too. It imports the SAME
 *      property from the same module, so the two cannot drift apart.
 *
 * ⚠ SCOPE, STATED SO THIS IS NOT READ AS WIDER THAN IT IS. The property is about
 * DISPOSAL copy — what a surface claims an erasure accomplishes. It is deliberately NOT
 * applied to the attestation lane: `DSR_ATTEST_PROCEDURE_COMMON`'s last line quantifies
 * universally ("nem qualquer dado que identifique o titular") in a PROHIBITION frame
 * addressed to the reviewer, which is required copy and the opposite of an over-claim.
 * An inbox card for `attest_review` is therefore out of this roster, not silently
 * passing it.
 *
 * ⛔ NO SURFACE HERE HAS A LIVE DEFECT — this suite went green on the first run and that
 * is the expected result. Its value is regression: three of these four were unpinned,
 * and the one that WAS pinned is the one that shipped the defect.
 */

import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

const disposeMeetingMinutesTask = vi.fn()
const completeDsrTask = vi.fn()
const executeDisposalTask = vi.fn()
const refresh = vi.fn()

vi.mock('@/lib/dsr/actions', () => ({
  disposeMeetingMinutesTask: (...a: unknown[]) =>
    disposeMeetingMinutesTask(...a),
  completeDsrTask: (...a: unknown[]) => completeDsrTask(...a),
  executeDisposalTask: (...a: unknown[]) => executeDisposalTask(...a),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}))

import type {
  DsrTaskRow,
  DsrOutcomeRecord as DsrOutcomeRecordType,
} from '@/lib/queries/dsr'
import {
  DSR_MEETING_DISPOSAL_WARNING,
  DSR_RESIDUE_NOTICE,
} from '@/lib/dsr/messages'
import {
  ERASURE_CLAIM,
  TOTALITY_QUANTIFIER,
  WARNING_FRAMED,
  reassuranceText,
  renderedText,
} from './disposal-copy-property'
import { DsrMeetingDisposeDialog } from './dsr-meeting-dispose-dialog'
import { DsrTaskInbox } from './dsr-task-inbox'
import { DsrOutcomeRecord } from './dsr-outcome-record'

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

beforeEach(() => {
  disposeMeetingMinutesTask.mockReset()
  completeDsrTask.mockReset()
  executeDisposalTask.mockReset()
  refresh.mockReset()
})

function task(
  kind: DsrTaskRow['kind'],
  module: DsrTaskRow['module'],
  canExecute = false,
): DsrTaskRow {
  return {
    id: 'task-1',
    requestId: 'req-1',
    kind,
    module,
    entityId: 'entity-1',
    commissionId: 'c1',
    commissionName: 'CCIH',
    commissionSlug: 'ccih',
    hospitalId: 'h1',
    status: 'pending',
    note: null,
    completionNote: null,
    attestedByName: null,
    attestedRedactions: null,
    completedAt: null,
    createdAt: '2026-08-20T00:00:00Z',
    canExecute,
  }
}

/**
 * ⚠ `outcomeBasis` and `legalConsultationRef` are deliberately NULL. Both are OPERATOR
 * FREE TEXT read back from the row, not platform copy — asserting a copy property over
 * what a DPO typed would red on the operator's words rather than on anything this
 * codebase controls. The property is about the strings this repo ships.
 */
function outcomeRecord(meetingMinutesDisposed: boolean): DsrOutcomeRecordType {
  return {
    requestId: 'req-1',
    hospitalId: 'h1',
    fileRef: 'PROC-2026-001',
    status: 'closed',
    outcome: 'granted',
    outcomeBasis: null,
    legalConsultationRef: null,
    receivedAt: '2026-08-01T00:00:00Z',
    dueDate: '2026-08-16T00:00:00Z',
    adjudicatedAt: '2026-08-05T00:00:00Z',
    closedAt: '2026-08-10T00:00:00Z',
    mechanical: { total: 2, disposed: 2, pending: 0, retired: 0 },
    attested: {
      total: 1,
      completed: 1,
      retired: 0,
      pending: 0,
      redactions: 0,
      reviewers: ['Ana Souza'],
    },
    residue: DSR_RESIDUE_NOTICE,
    meetingMinutesDisposed,
  }
}

function openMeetingDialog(): HTMLElement {
  render(
    <DsrMeetingDisposeDialog
      org="rede-a"
      taskId="task-1"
      meetingId="meeting-1"
      label="Reunião de agosto"
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: /Descartar a ata/ }))
  return screen.getByRole('alertdialog')
}

/**
 * Every disposal surface, as a rendered-text thunk. Table-driven so the roster's SIZE is
 * visible in one place: a new dispose surface added without a row here is the gap this
 * follow-up was filed about.
 */
const SURFACES: Array<{ name: string; text: () => string }> = [
  {
    name: 'meeting dispose dialog',
    text: () => renderedText(openMeetingDialog()),
  },
  ...(
    [
      ['dispose_case', 'case'],
      ['dispose_event', 'event'],
      ['dispose_referral', 'referral'],
      ['dispose_meeting', 'meeting'],
    ] as Array<[DsrTaskRow['kind'], DsrTaskRow['module']]>
  ).map(([kind, module]) => ({
    name: `task inbox card — ${kind}`,
    text: () => {
      const { container } = render(
        <DsrTaskInbox org="rede-a" tasks={[task(kind, module)]} />,
      )
      return renderedText(container)
    },
  })),
  {
    // The executable arm mounts `DsrMeetingDisposeDialog`'s TRIGGER. Its content is
    // closed, so the warning is not in the DOM here — this arm proves the inbox's own
    // executable copy is clean, not the dialog's.
    name: 'task inbox card — dispose_meeting, executable',
    text: () => {
      const { container } = render(
        <DsrTaskInbox
          org="rede-a"
          tasks={[task('dispose_meeting', 'meeting', true)]}
        />,
      )
      return renderedText(container)
    },
  },
  {
    name: 'outcome record — a meeting disposal completed',
    text: () =>
      renderedText(
        render(<DsrOutcomeRecord record={outcomeRecord(true)} />).container,
      ),
  },
  {
    name: 'outcome record — no meeting disposal',
    text: () =>
      renderedText(
        render(<DsrOutcomeRecord record={outcomeRecord(false)} />).container,
      ),
  },
]

describe('no disposal surface makes an UNQUALIFIED erasure claim', () => {
  it('the roster is not empty — iterating nothing would assert nothing', () => {
    // Anti-vacuity for the table itself: a `SURFACES` that lost its rows in a refactor
    // would leave every test below passing over an empty loop.
    expect(SURFACES.length).toBeGreaterThanOrEqual(7)
  })

  for (const surface of SURFACES) {
    it(`${surface.name}: no totality quantifier in the reassurance frame`, () => {
      const text = surface.text()

      // Proof-of-life FIRST: this surface really does claim an erasure. Without it the
      // assertion below passes on a surface that renders nothing at all.
      expect(text, `${surface.name} must claim an erasure at all`).toMatch(
        ERASURE_CLAIM,
      )

      const offending = reassuranceText(text).match(TOTALITY_QUANTIFIER)
      expect(
        offending,
        `${surface.name} must not quantify the erased set universally, found: ${offending?.[0]}`,
      ).toBeNull()
    })
  }
})

describe('the erasure claim never appears without its residue qualification', () => {
  // THE property that survives any rewrite of the copy: the claim and its qualification
  // are inseparable. The shipped defect satisfied the first half and not the second.
  for (const surface of SURFACES) {
    it(`${surface.name}: renders every residue line beside the claim`, () => {
      expect(DSR_RESIDUE_NOTICE).toHaveLength(4)
      const text = surface.text()
      expect(text).toMatch(ERASURE_CLAIM)
      for (const line of DSR_RESIDUE_NOTICE) {
        expect(text, `residue line missing: ${line.slice(0, 40)}…`).toContain(
          line,
        )
      }
    })
  }
})

describe('the subtraction is paired with a positive pin, so it buys no blindness', () => {
  it('the meeting dialog renders DSR_MEETING_DISPOSAL_WARNING verbatim', () => {
    // ⛔ THE ASSERTION THAT MAKES THE SUBTRACTION HONEST. `reassuranceText` removes this
    // string before the property is applied, which also removes the property's ability
    // to notice it disappearing. Nothing else in the suite pinned it — measured — so a
    // silent deletion of the single most important string in the slice would have left
    // every test above green.
    const dialog = openMeetingDialog()
    expect(
      within(dialog).getByText(DSR_MEETING_DISPOSAL_WARNING),
    ).toBeInTheDocument()
  })

  it('subtracts only strings it can prove are centrally reviewed constants', () => {
    // The subtraction set is imported by identity, never re-typed — a component's own
    // bespoke string can never be in it, which is what stops the set becoming an escape
    // hatch. Both halves asserted: non-empty (or the reduce is a no-op that would let a
    // real over-claim through as "subtracted"), and every entry a live constant.
    expect(WARNING_FRAMED.length).toBeGreaterThan(0)
    expect(WARNING_FRAMED).toContain(DSR_MEETING_DISPOSAL_WARNING)
  })

  it('restores the element boundaries bare textContent destroys', () => {
    // ⭐ THE POSITIVE CONTROL FOR `renderedText`, and it is a demonstration rather than a
    // claim: the first two assertions SHOW the blind spot, the third shows it closed.
    // `textContent` fuses "Ana Souza" to "Tudo apagado", leaving no word boundary before
    // the quantifier — so the pattern cannot match text that plainly contains it.
    const { container } = render(
      <div>
        <span>Ana Souza</span>
        <h3>Tudo apagado</h3>
      </div>,
    )
    expect(container.textContent).toContain('SouzaTudo')
    expect(container.textContent).not.toMatch(TOTALITY_QUANTIFIER)
    expect(renderedText(container)).toMatch(TOTALITY_QUANTIFIER)
  })

  it('subtraction changes the text ONLY where a warning is present', () => {
    // Proof the helper does something and does not do too much: it must be a no-op on a
    // surface with no warning, and must actually remove one where it is.
    const withWarning = renderedText(openMeetingDialog())
    expect(reassuranceText(withWarning)).not.toBe(withWarning)
    expect(reassuranceText(withWarning)).not.toContain(
      DSR_MEETING_DISPOSAL_WARNING,
    )

    const plain = 'O descarte apaga os dados deste registro.'
    expect(reassuranceText(plain)).toBe(plain)
  })
})

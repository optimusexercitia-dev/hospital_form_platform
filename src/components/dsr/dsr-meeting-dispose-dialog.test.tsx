/**
 * The DESTRUCTIVE-PATH behaviour of {@link DsrMeetingDisposeDialog} — arming,
 * near-miss rejection, the action call, and the pt-BR failure surface.
 *
 * ⭐ WHY THIS FILE APPEARED ON 2026-08-21. It did not exist. `referral-dispose-dialog.test.tsx`
 * was the ONLY place in the repo asserting the type-to-confirm arming pattern
 * (`toBeDisabled` / `toBeEnabled` appeared in that file and nowhere else), and that file was
 * deleted with its component under the PO ruling that no hat can reach the referral dialog.
 * This dialog has the IDENTICAL arming pattern — `disabled={isPending || !armed}` on
 * "Apagar a ata definitivamente" — and had no test for it at all.
 *
 * ⛔ So the deletion would have taken the arming property from **1 surface to 0**, on the
 * control this module's own docblock calls the most dangerous button in it. Nothing would
 * have gone red: the property lived entirely inside the file being removed. Porting it here
 * is not scope creep, it is the difference between removing a dead affordance and removing
 * the only test of a live one.
 *
 * ⚠ ONE ASYMMETRY, deliberate. The referral dialog armed on TWO inputs (a reason category
 * AND the phrase) and its test proved each was independently necessary. This dialog has only
 * the phrase — the escalation already carries its reason, per ADR 0130 Amdt 2 item 3 — so the
 * two-input independence half has no subject here and is NOT reproduced. Stated rather than
 * silently dropped: it is a property of a control that no longer exists, not one that moved.
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

const disposeMeetingMinutesTask = vi.fn()
const refresh = vi.fn()

vi.mock('@/lib/dsr/actions', () => ({
  disposeMeetingMinutesTask: (...a: unknown[]) => disposeMeetingMinutesTask(...a),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}))

import { DsrMeetingDisposeDialog } from './dsr-meeting-dispose-dialog'

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
  refresh.mockReset()
  disposeMeetingMinutesTask.mockResolvedValue({ ok: true })
})

function openDialog(): HTMLElement {
  render(
    <DsrMeetingDisposeDialog
      org="rede-a"
      taskId="task-1"
      meetingId="meeting-1"
      label="Reunião de agosto"
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Descartar a ata' }))
  return screen.getByRole('alertdialog')
}

/** ⛔ The accessible NAME is frozen — E2E locates this control by the phrase. */
function confirmInput(dialog: HTMLElement): HTMLInputElement {
  return within(dialog).getByLabelText(
    /Digite\s+APAGAR\s+para confirmar/,
  ) as HTMLInputElement
}

function destructiveButton(dialog: HTMLElement): HTMLButtonElement {
  return within(dialog).getByRole('button', {
    name: 'Apagar a ata definitivamente',
  }) as HTMLButtonElement
}

describe('DsrMeetingDisposeDialog — the type-to-confirm arming', () => {
  it('starts DISARMED, and the confirm field accepts input', () => {
    const dialog = openDialog()
    // Proof-of-life before the negative: the control exists and is reachable, so
    // "disabled" is a real state rather than a missing element.
    const input = confirmInput(dialog)
    expect(input).toBeInTheDocument()
    expect(destructiveButton(dialog)).toBeDisabled()

    fireEvent.change(input, { target: { value: 'APAGAR' } })
    expect(input.value).toBe('APAGAR')
  })

  it('arms ONLY on the exact phrase', () => {
    const dialog = openDialog()
    fireEvent.change(confirmInput(dialog), { target: { value: 'APAGAR' } })
    expect(destructiveButton(dialog)).toBeEnabled()
  })

  it('rejects a near-miss phrase', () => {
    // Both directions in the suite: a component hard-wired to stay disabled passes the
    // near-miss test and fails "arms ONLY on the exact phrase". Only the real predicate
    // satisfies both.
    const dialog = openDialog()
    fireEvent.change(confirmInput(dialog), { target: { value: 'APAGA' } })
    expect(destructiveButton(dialog)).toBeDisabled()
  })

  it('disarms again when the phrase is cleared', () => {
    const dialog = openDialog()
    fireEvent.change(confirmInput(dialog), { target: { value: 'APAGAR' } })
    expect(destructiveButton(dialog)).toBeEnabled()
    fireEvent.change(confirmInput(dialog), { target: { value: '' } })
    expect(destructiveButton(dialog)).toBeDisabled()
  })
})

describe('DsrMeetingDisposeDialog — the action call and its failure surface', () => {
  it('calls the task action with org, task and meeting', async () => {
    const dialog = openDialog()
    fireEvent.change(confirmInput(dialog), { target: { value: 'APAGAR' } })
    fireEvent.click(destructiveButton(dialog))

    await waitFor(() =>
      expect(disposeMeetingMinutesTask).toHaveBeenCalledWith({
        org: 'rede-a',
        taskId: 'task-1',
        meetingId: 'meeting-1',
      }),
    )
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('surfaces the door\u2019s pt-BR refusal and does NOT close', async () => {
    // CLAUDE.md §8: a raw Postgres error must never reach the UI. And the dialog must
    // stay open — closing on failure reads as success to an operator discharging a legal
    // obligation.
    disposeMeetingMinutesTask.mockResolvedValue({
      ok: false,
      error: 'Você não tem permissão para esta ação.',
    })
    const dialog = openDialog()
    fireEvent.change(confirmInput(dialog), { target: { value: 'APAGAR' } })
    fireEvent.click(destructiveButton(dialog))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Você não tem permissão para esta ação.')
    expect(refresh).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })
})

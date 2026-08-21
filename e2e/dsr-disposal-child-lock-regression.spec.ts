import { test, expect } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import {
  createDsrFixture,
  destroyDsrFixture,
  svcSelect,
  DSR_ORG,
  type DsrFixture,
} from './helpers/dsr-fixture'

/**
 * DSR operational remediation — a BROWSER-LEVEL regression guard for the P0
 * (BUG-DISPOSAL-CHILD-LOCK-RCA-CAPA-INTERVIEW / ADR 0129 Amendment 3).
 *
 * ⭐ WHAT THIS FILE IS FOR. pgTAP `353` proves the four fixed child-lock guards
 * at the DB layer (60 tests, 4 lanes, mutation-proven both directions). What no
 * test did before this file is prove the SAME property through the PRODUCT: a
 * DSR disposal task, executed from the task inbox by a real signed-in
 * executor, against an entity whose child is in the exact terminal state that
 * used to abort the door — never a direct RPC POST, and never a fixture that
 * happens to avoid the locked state.
 *
 * ⛔ THE BUG'S OWN SHAPE IS WHY THE ASSERTION DISCIPLINE BELOW MATTERS MOST
 * HERE. `dispose_case_phi` DELETEs `patient_identifiers` as its very FIRST
 * effect, then reaches the interview-subject redaction dozens of statements
 * later. Before this round's fix, `app.guard_interview_child_lock` raised on
 * that later statement and rolled the WHOLE transaction back — so the failure
 * mode is "the identifiers row SURVIVES, `phi_disposed_at` stays NULL", not an
 * absent row. A `.not.toBeNull()` check on a possibly-absent destructured row
 * is exactly the vacuity class `FUP-E2E-ABSENT-ROW-ASSERTIONS` names (T3 of
 * this round) — undefined passes it. Every erasure assertion below therefore
 * COUNTS rows (`toHaveLength`), never asks whether a column is null on a
 * subject whose existence was never separately established.
 *
 * ⛔ CONSTRUCTED, NEVER SEEDED. Disposal is irreversible and `seed.sql` is a
 * contract ~900 other tests share — this fixture builds its own case,
 * participant and patient identifiers under a unique MRN
 * (`e2e/helpers/dsr-fixture.ts`), extended by this round with an OPTIONAL
 * `completed` interview (`completedInterview: true`) specifically because the
 * seed cannot reproduce that locked state and no other DSR spec needs it.
 *
 * Covers the `case_interview_subjects` lane — item 9 of the P0's ten
 * statements, guarded by `app.guard_interview_child_lock`
 * (`case_interviews.status in ('completed','cancelled')` → `23514`). The
 * `meeting_cases` lane (item 10) is NOT covered by this file: the fixture's
 * meeting stays `scheduled` (unlocked), so that stand-aside window never fires
 * under lock here — recorded as an explicit boundary, not silently assumed
 * covered by the shared fixture's unrelated meeting/agenda-item scaffolding.
 *
 * Personas (password `Test1234!`), org `rede-a` / Hospital Central A:
 *   staff1.ccih@test.local   the seeded Encarregado (DPO) — registers the request.
 *   chefe.ccih@test.local    staff_admin of CCIH — executes the disposal from the inbox.
 */

test.use({ viewport: { width: 1280, height: 900 } })
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

const RUN = Date.now().toString(36)
const TAG = `P0LOCK-${RUN}`
const FILE_REF = `PROC-${TAG}`
const CONSOLE_URL = `/o/${DSR_ORG}/titulares`

let fixture: DsrFixture | null = null

test.beforeAll(async ({ request }) => {
  fixture = await createDsrFixture(request, TAG, { completedInterview: true })
})

test.afterAll(async ({ request }) => {
  await destroyDsrFixture(request, fixture, [FILE_REF])
})

test('a disposal executed from the inbox erases Class-1 PHI even though the case has a COMPLETED (locked) interview', async ({
  page,
  request,
}) => {
  const subject = fixture as DsrFixture

  // ── Precondition: the locked child really exists, asserted (not assumed) ──
  const interviewRows = await svcSelect<{ status: string }>(
    request,
    'case_interviews',
    `select=status&id=eq.${subject.interviewId}`,
  )
  expect(
    interviewRows,
    'fixture precondition: the interview row is missing',
  ).toHaveLength(1)
  expect(
    interviewRows[0].status,
    'fixture precondition: the interview must be a LOCKED (completed) child, ' +
      'or this test exercises nothing the P0 fix changed',
  ).toBe('completed')

  const subjectRowsBefore = await svcSelect<{ note: string }>(
    request,
    'case_interview_subjects',
    `select=note&interview_id=eq.${subject.interviewId}`,
  )
  expect(
    subjectRowsBefore,
    'fixture precondition: the interview subject row is missing',
  ).toHaveLength(1)
  expect(subjectRowsBefore[0].note).toBe(subject.interviewSubjectNote)

  // ── Intake: the real fan-out, as the Encarregado — never a service-role shortcut ──
  await cachedSignIn(page, 'staff1.ccih@test.local')
  await page.goto(CONSOLE_URL)
  const form = page.getByRole('form', { name: /registrar solicitação de titular/i })
  await form.getByLabel(/prontuário do titular/i).fill(subject.mrn)
  await form.getByLabel(/referência do processo/i).fill(FILE_REF)
  await form.getByRole('button', { name: /registrar solicitação/i }).click()
  await expect(page.getByText(/tarefas de execução distribuídas/i)).toBeVisible()

  const requestRows = await svcSelect<{ id: string }>(
    request,
    'dsr_requests',
    `select=id&file_ref=eq.${encodeURIComponent(FILE_REF)}`,
  )
  expect(requestRows, 'the DSR request was not created').toHaveLength(1)
  const requestId = requestRows[0].id

  const disposeTaskRows = await svcSelect<{ entity_id: string; status: string }>(
    request,
    'dsr_tasks',
    `select=entity_id,status&request_id=eq.${requestId}&kind=eq.dispose_case`,
  )
  expect(
    disposeTaskRows,
    'the fan-out must have enumerated exactly one dispose_case task for this fixture',
  ).toHaveLength(1)
  expect(disposeTaskRows[0].entity_id).toBe(subject.caseId)
  expect(disposeTaskRows[0].status).toBe('pending')

  // ── Execution: a REAL browser click through the inbox, never a direct RPC POST ──
  // DsrTaskInbox -> executeDisposalTask -> dispose_case_phi. pgTAP 353 already
  // proves the door itself at the SQL layer; this is the wiring the door is
  // reached through, on the exact fixture shape that used to abort it.
  await cachedSignIn(page, 'chefe.ccih@test.local')
  await page.goto(CONSOLE_URL)
  const card = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'Descartar dados do caso', exact: true }),
  })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: /executar descarte e concluir/i }).click()
  await expect(card.getByText('Concluída', { exact: true })).toBeVisible()

  // ── THE PIN. Class-1 PHI is GONE — by COUNT, not by a null check — despite ──
  // the locked interview. Before the fix, `guard_interview_child_lock` raised
  // on the `case_interview_subjects` UPDATE dozens of statements after this
  // exact DELETE, rolling back the WHOLE RPC: this row would have SURVIVED at
  // count 1. Fixed in migration `20261003000000` (ADR 0129 Amendment 3).
  const identifiersAfter = await svcSelect(
    request,
    'patient_identifiers',
    `select=participant_id&participant_id=eq.${subject.participantId}`,
  )
  expect(
    identifiersAfter,
    'Class-1 PHI must be GONE — a rolled-back RPC (the pre-fix P0) would leave this row present at count 1',
  ).toHaveLength(0)

  // The governance skeleton survives (Rule 12) and carries the erasure stamp —
  // asserted on a row whose existence is proven first, never on `caseRows[0]?.…`.
  const caseRows = await svcSelect<{ phi_disposed_at: string | null; has_patient: boolean }>(
    request,
    'cases',
    `select=phi_disposed_at,has_patient&id=eq.${subject.caseId}`,
  )
  expect(caseRows, 'the case row itself must still exist — disposal never deletes it').toHaveLength(1)
  expect(caseRows[0].has_patient).toBe(false)
  expect(caseRows[0].phi_disposed_at).not.toBeNull()

  // ── THE LANE THE P0 SPECIFICALLY BROKE: the locked child's own write actually ──
  // ran. Not merely "the RPC returned 200" — the redaction UPDATE inside the
  // stand-aside window completed, proving window 1 (not just window 2 / the
  // parent-table bypass) took effect. Existence is already proven above.
  const subjectRowsAfter = await svcSelect<{ note: string }>(
    request,
    'case_interview_subjects',
    `select=note&interview_id=eq.${subject.interviewId}`,
  )
  expect(subjectRowsAfter, 'the interview subject row must still exist').toHaveLength(1)
  expect(
    subjectRowsAfter[0].note,
    'the LOCKED interview subject note must be redacted — this is the exact ' +
      'statement app.guard_interview_child_lock used to block',
  ).not.toBe(subject.interviewSubjectNote)

  // And the completed task is the module row's own effect, not a copy of the gate.
  const finalTask = await svcSelect<{ status: string }>(
    request,
    'dsr_tasks',
    `select=status&request_id=eq.${requestId}&kind=eq.dispose_case`,
  )
  expect(finalTask, 'the dispose_case task row must still exist').toHaveLength(1)
  expect(finalTask[0].status).toBe('done')
})

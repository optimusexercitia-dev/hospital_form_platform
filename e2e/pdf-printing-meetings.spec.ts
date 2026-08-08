import { test, expect } from '@playwright/test'

import { focusByTabbing, serviceQuery } from './helpers/documents'
import { articleForShortCode, SHORT_CODE_RE } from './helpers/pdf-printing'
import {
  addAttendee,
  createScheduledMeeting,
  getOwnerToken,
  markHeld,
  meetingHref,
  meetingStatus,
  setMeetingVisibilityParticipantsOnly,
  signInAs,
  signMeetingToSigned,
  CHEFE_CCIH_ID,
} from './helpers/pdf-printing-meetings'

/**
 * PDF·P2 — PDF document printing, Meetings (ata) (ADR 0104; plan
 * docs/plans/pdf-document-printing.md §3).
 *
 * The binding review question for this phase is exactly one: did P2 touch
 * anything outside provider + template + RLS arm + tests? This suite's own
 * existence answers half of that from the tester's side — `mintViaDialog`
 * and `articleForShortCode` (`./helpers/pdf-printing`, written for P1's FORM
 * responses) are reused here UNCHANGED for MEETINGS, because the mint/revoke
 * dialog components themselves never changed (PROGRESS.md M-F1: "zero
 * printing components changed").
 *
 * `e2e/pdf-printing.spec.ts` (P1) is run once, UNMODIFIED, as the no-
 * regression check — see the run log in PROGRESS.md M-T1, not a test here.
 *
 * Fixtures: every meeting is created fresh via the real `create_meeting` /
 * `conclude_meeting` / `sign_meeting` RPCs (never a seed row, never a raw
 * status UPDATE) — the one deliberate exception is
 * `setMeetingVisibilityParticipantsOnly` (test 3), which flips a column no
 * product RPC exposes; see its doc comment. Local Supabase stack + Gotenberg
 * sidecar (:3010) are preconditions, like the seeded DB itself.
 *
 * Run: prod-standalone server foreground + `npx playwright test
 * e2e/pdf-printing-meetings.spec.ts --project=chromium --workers=1`.
 */

test.describe('PDF·P2 — printing (meetings)', () => {
  test('ata lifecycle: mint -> download -> verify (logged out) -> revoke -> overlay download -> re-verify', async ({
    page,
    browser,
  }) => {
    const token = await getOwnerToken(page, 'chefe.ccih@test.local')
    const meetingId = await createScheduledMeeting(page, token, 'PDF·P2 T1 — ata lifecycle')
    await markHeld(page, token, meetingId)
    await signMeetingToSigned(page, token, meetingId, CHEFE_CCIH_ID)
    expect(await meetingStatus(page, meetingId)).toBe('signed')

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(meetingHref(meetingId))

    // The panel starts empty for this fresh fixture (BUG-PDF2-001: the empty
    // state's copy hardcodes "desta resposta" regardless of source kind — a
    // pre-existing, unchanged P1 string, filed separately, not asserted here).
    await expect(page.getByText('Documentos emitidos')).toBeVisible()

    // A signed meeting mints FINAL, exactly like a submitted form response.
    await page.getByRole('button', { name: 'Emitir documento', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('FINAL', { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: 'Emitir documento', exact: true }).click()

    const success = page.getByRole('alert')
    await expect(success).toBeVisible({ timeout: 20_000 })
    const shortCode = (await success.getByText(SHORT_CODE_RE).innerText()).trim()

    const downloadLink = dialog.getByRole('link', { name: /baixar pdf/i })
    const downloadPath = (await downloadLink.getAttribute('href'))!
    expect(downloadPath).toMatch(/^\/api\/documents\/[0-9a-f-]{36}$/)

    await dialog.getByText('Fechar', { exact: true }).click()
    await expect(dialog).toBeHidden()

    const article = articleForShortCode(page, shortCode)
    await expect(article.getByText('Ativo', { exact: true })).toBeVisible()

    const resp1 = await page.request.get(downloadPath)
    expect(resp1.status()).toBe(200)
    expect(resp1.headers()['content-type']).toContain('application/pdf')
    const bytes1 = await resp1.body()
    expect(bytes1.subarray(0, 5).toString('latin1')).toBe('%PDF-')

    // Logged-out verification: the anemic tuple, with the MEETING kind wording.
    const anonContext = await browser.newContext()
    const anonPage = await anonContext.newPage()
    await anonPage.goto(`/verificar/${shortCode}?via=codigo`)
    await expect(anonPage.getByRole('heading', { name: 'Documento autêntico' })).toBeVisible()
    await expect(anonPage.getByText('Ata de reunião')).toBeVisible()
    await expect(anonPage.getByText('Hospital Central A')).toBeVisible()
    await expect(anonPage.getByRole('link', { name: /baixar o documento/i })).toHaveCount(0)
    await anonContext.close()

    // Revoke as chefe.ccih (staff_admin coordinator).
    await page.reload()
    await articleForShortCode(page, shortCode).getByRole('button', { name: 'Anular' }).click()
    const revokeDialog = page.getByRole('dialog')
    await expect(revokeDialog).toBeVisible()
    await revokeDialog.getByLabel('Motivo da anulação').selectOption('minted_in_error')
    await revokeDialog
      .getByLabel('Descrição do motivo')
      .fill('Emissão de teste automatizado — anulação administrativa (sem dados de paciente).')
    await revokeDialog.getByRole('button', { name: 'Anular documento' }).click()
    await expect(revokeDialog).toBeHidden()
    await expect(articleForShortCode(page, shortCode).getByText('Anulado', { exact: true })).toBeVisible()

    // Re-verify logged out — flips to anulado.
    const anonContext2 = await browser.newContext()
    const anonPage2 = await anonContext2.newPage()
    await anonPage2.goto(`/verificar/${shortCode}?via=codigo`)
    await expect(anonPage2.getByRole('heading', { name: 'Documento anulado' })).toBeVisible()
    await anonContext2.close()

    // Overlay download still succeeds, bytes differ from the pre-revoke download.
    const resp2 = await page.request.get(downloadPath)
    expect(resp2.status()).toBe(200)
    const bytes2 = await resp2.body()
    expect(bytes2.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(Buffer.compare(bytes1, bytes2)).not.toBe(0)
  })

  test('RASCUNHO vs FINAL preview tracks the real meeting lifecycle', async ({ page }) => {
    const token = await getOwnerToken(page, 'chefe.ccih@test.local')
    const meetingId = await createScheduledMeeting(page, token, 'PDF·P2 T2 — RASCUNHO/FINAL preview')
    await markHeld(page, token, meetingId)
    expect(await meetingStatus(page, meetingId)).toBe('held')

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(meetingHref(meetingId))

    // held — NOT signed/distributed — previews RASCUNHO.
    await page.getByRole('button', { name: 'Emitir documento', exact: true }).click()
    let dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('RASCUNHO', { exact: true })).toBeVisible()
    await expect(dialog.getByText('FINAL', { exact: true })).toHaveCount(0)
    await dialog.getByRole('button', { name: /^cancelar$/i }).click()
    await expect(dialog).toBeHidden()

    // Drive the SAME meeting to `signed` through the real sign_meeting path.
    await signMeetingToSigned(page, token, meetingId, CHEFE_CCIH_ID)
    expect(await meetingStatus(page, meetingId)).toBe('signed')

    await page.reload()
    await page.getByRole('button', { name: 'Emitir documento', exact: true }).click()
    dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('FINAL', { exact: true })).toBeVisible()
    await expect(dialog.getByText('RASCUNHO', { exact: true })).toHaveCount(0)
  })

  test('restricted (participants_only) meeting: a non-attendee commission member cannot reach it', async ({
    page,
  }) => {
    const token = await getOwnerToken(page, 'chefe.ccih@test.local')
    const meetingId = await createScheduledMeeting(page, token, 'PDF·P2 T3 — restricted visibility')
    await markHeld(page, token, meetingId)
    // Roster must be non-empty BEFORE the flip (trg_meetings_roster) — chefe.ccih
    // is the sole attendee; staff1.ccih (a real CCIH member) is deliberately left off.
    await addAttendee(page, token, meetingId, CHEFE_CCIH_ID, 'presidente')
    setMeetingVisibilityParticipantsOnly(meetingId)
    const [row] = await serviceQuery<{ visibility_policy: string }>(
      page,
      `meetings?id=eq.${meetingId}&select=visibility_policy`,
    )
    expect(row?.visibility_policy).toBe('participants_only')

    // Control: the attendee (chefe.ccih) still reaches the meeting and its mint surface.
    await signInAs(page, 'chefe.ccih@test.local')
    const controlResp = await page.goto(meetingHref(meetingId))
    expect(controlResp?.status()).toBe(200)
    await expect(page.getByRole('button', { name: 'Emitir documento', exact: true })).toBeVisible()

    // staff1.ccih is a real CCIH commission member but NOT an attendee of this
    // participants_only meeting. `meetings_select` RLS and `can_reach_meeting`
    // share the exact same predicate, so assert the RLS boundary directly first
    // (decoupled from any app-layer rendering quirk): a raw PostgREST read under
    // staff1's own JWT returns zero rows for this meeting id.
    const staff1Token = await getOwnerToken(page, 'staff1.ccih@test.local')
    const rlsProbe = await page.request.get(
      `http://127.0.0.1:54321/rest/v1/meetings?id=eq.${meetingId}&select=id`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${staff1Token}`,
        },
      },
    )
    expect(await rlsProbe.json()).toEqual([])

    // Observed app-layer boundary: the meeting-detail route calls notFound()
    // (getMeetingDetail returns null under RLS) and renders the platform's
    // custom 404 UI — no meeting content, no mint button, no printed-documents
    // panel leaks. BUG-PDF2-002 (filed separately, pre-existing, NOT a P2
    // regression): this route's notFound() returns HTTP 200 rather than 404 on
    // the prod-standalone build — reproduced even for a plain nonexistent
    // meeting id, so it predates this phase. The content-level boundary below
    // is what's asserted; the status-code mismatch does not leak data.
    await signInAs(page, 'staff1.ccih@test.local')
    await page.goto(meetingHref(meetingId))
    await expect(page.getByRole('heading', { name: 'Não encontramos esta página.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Emitir documento' })).toHaveCount(0)
    await expect(page.getByText('Documentos emitidos')).toHaveCount(0)
  })

  test('keyboard-only: mint -> download-link focus, no mouse', async ({ page }) => {
    const token = await getOwnerToken(page, 'chefe.ccih@test.local')
    const meetingId = await createScheduledMeeting(page, token, 'PDF·P2 T4 — keyboard-only mint')
    await markHeld(page, token, meetingId)

    // A non-coordinator member (staff1.ccih, commission_default visibility, not
    // an attendee) sees the read-only projection of every panel — no edit/add/
    // manage affordances render — keeping the tab-stop count on this much
    // richer page tractable, exactly the way P1's response-detail keyboard test
    // did on its (staff_admin-only) simpler page. Mint itself is NOT
    // coordinator-gated (D11: anyone who can view the source may mint), so the
    // button is present regardless.
    await signInAs(page, 'staff1.ccih@test.local')
    await page.goto(meetingHref(meetingId))

    const trigger = page.getByRole('button', { name: 'Emitir documento', exact: true })
    await focusByTabbing(page, () => trigger.evaluate((el) => el === document.activeElement), 200)
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const confirmButton = dialog.getByRole('button', { name: 'Emitir documento', exact: true })
    await expect
      .poll(() => confirmButton.evaluate((el) => el === document.activeElement))
      .toBe(true)
    await page.keyboard.press('Enter')

    const success = page.getByRole('alert')
    await expect(success).toBeVisible({ timeout: 20_000 })

    const downloadLink = dialog.getByRole('link', { name: /baixar pdf/i })
    await expect
      .poll(() => downloadLink.evaluate((el) => el === document.activeElement))
      .toBe(true)

    const downloadPromise = page.waitForEvent('download')
    await page.keyboard.press('Enter')
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })
})

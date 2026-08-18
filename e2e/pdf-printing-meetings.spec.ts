import { test, expect } from '@playwright/test'

import { focusByTabbing, serviceQuery } from './helpers/documents'
import {
  articleForShortCode,
  mintViaDialog,
  printedDocumentRowsFor,
  SHORT_CODE_RE,
} from './helpers/pdf-printing'
import {
  addAgendaItemWithDescription,
  addAttendee,
  concludeMeeting,
  concludeMeetingToSignature,
  createScheduledMeeting,
  disposeMeetingMinutes,
  getOwnerToken,
  linkMeetingCase,
  markHeld,
  meetingHref,
  meetingStatus,
  setMeetingVisibilityParticipantsOnly,
  signAttendee,
  signInAs,
  signMeetingToSigned,
  CHEFE_CCIH_ID,
  RESPONDENT_STAFF4_EMAIL,
  SEED_ETHICS_CASE_ID,
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
 * `e2e/pdf-printing.spec.ts` (P1) runs in the same regression gate. ⚠ It is no
 * longer literally unmodified: both files now ALSO cover the ADR 0125/0126
 * print-source split (`Imprimir prévia`, ephemeral, vs. `Emitir documento`,
 * registered) — the case-numbered tests below (and P1's own case-1/case-2
 * tests) are that coverage, added by `tester`, not a functional regression to
 * the original P1/P2 mint-lifecycle assertions, which are untouched.
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

  /**
   * REWRITTEN for ADR 0125/0126 (print-source split) — do not delete.
   *
   * The original T2 minted from a `held` meeting and asserted RASCUNHO. Under
   * the split `held` is no longer LOCKED, so it no longer registers at all —
   * that fixture shape is unconstructible as a registered mint. This walks the
   * SAME lifecycle through all three states the split actually separates:
   *
   *   held         — freely editable    -> EPHEMERAL prévia ONLY
   *   in_signature — LOCKED, non-final  -> REGISTERS, stamped RASCUNHO (⭐⭐
   *                  case 3 — the case most likely to be mis-specified from
   *                  the button alone: "Emitir documento" genuinely mints a
   *                  permanent, QR-verifiable row here, even though the
   *                  content is not yet approved)
   *   signed       — locked AND final   -> REGISTERS, stamped FINAL (the
   *                  original, unchanged behaviour — kept as this lifecycle's
   *                  closing leg rather than split into its own fixture)
   */
  test('print-source split: held→prévia only, in_signature→REGISTERS as RASCUNHO (case 3), signed→REGISTERS as FINAL', async ({
    page,
    browser,
  }) => {
    const token = await getOwnerToken(page, 'chefe.ccih@test.local')
    const meetingId = await createScheduledMeeting(page, token, 'PDF·P2 T2 — prévia/RASCUNHO/FINAL lifecycle')
    await markHeld(page, token, meetingId)
    expect(await meetingStatus(page, meetingId)).toBe('held')

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(meetingHref(meetingId))

    // ── held: still editable -> EPHEMERAL ONLY, two-sided ──────────────────
    await expect(page.getByRole('link', { name: 'Imprimir prévia', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Emitir documento', exact: true })).toHaveCount(0)
    expect(await printedDocumentRowsFor(page, 'meeting', meetingId)).toHaveLength(0)

    // ── in_signature: LOCKED, non-final -> REGISTERS, stamped RASCUNHO ──────
    // (case 3 — the ⭐⭐ separation this ADR pair exists to prove)
    const attendeeId = await concludeMeetingToSignature(page, token, meetingId)
    expect(await meetingStatus(page, meetingId)).toBe('in_signature')
    await page.reload()

    await expect(page.getByRole('link', { name: 'Imprimir prévia', exact: true })).toHaveCount(0)
    const mintButton = page.getByRole('button', { name: 'Emitir documento', exact: true })
    await expect(mintButton).toBeVisible()
    await mintButton.click()
    let dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('RASCUNHO', { exact: true })).toBeVisible()
    await expect(dialog.getByText('FINAL', { exact: true })).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Emitir documento', exact: true }).click()
    const success = page.getByRole('alert')
    await expect(success).toBeVisible({ timeout: 20_000 })
    const rascunhoCode = (await success.getByText(SHORT_CODE_RE).innerText()).trim()
    await dialog.getByText('Fechar', { exact: true }).click()
    await expect(dialog).toBeHidden()

    // It genuinely REGISTERED — a real row, `status = 'active'` — while
    // stamped RASCUNHO. Not just the dialog's promise: a real DB row and a
    // real QR-verifiable code, exactly what the ⭐⭐ separation claims.
    const rowsAtSignature = await printedDocumentRowsFor(page, 'meeting', meetingId)
    expect(rowsAtSignature).toHaveLength(1)
    expect(rowsAtSignature[0].status).toBe('active')
    await expect(articleForShortCode(page, rascunhoCode).getByText('Ativo', { exact: true })).toBeVisible()

    const anonContext = await browser.newContext()
    const anonPage = await anonContext.newPage()
    await anonPage.goto(`/verificar/${rascunhoCode}?via=codigo`)
    await expect(anonPage.getByRole('heading', { name: 'Documento autêntico' })).toBeVisible()
    await anonContext.close()

    // ── signed: locked AND final -> REGISTERS, stamped FINAL (unchanged) ────
    await signAttendee(page, token, attendeeId)
    expect(await meetingStatus(page, meetingId)).toBe('signed')
    await page.reload()

    await expect(page.getByRole('link', { name: 'Imprimir prévia', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Emitir documento', exact: true }).click()
    dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('FINAL', { exact: true })).toBeVisible()
    await expect(dialog.getByText('RASCUNHO', { exact: true })).toHaveCount(0)
    // Not minted again here on purpose — the very next test is exactly this
    // second mint, plus the supersession assertion a throwaway mint here
    // would not check.
    await dialog.getByRole('button', { name: /^cancelar$/i }).click()
    await expect(dialog).toBeHidden()
  })

  /**
   * ADR 0125 Consequences: "A supersession chain now records which version
   * circulated when" — the ADR's own stated accreditation answer ("show me
   * the minutes that circulated on the 12th"), and nothing pinned it for
   * MEETINGS before this build (P1 has a form_response analogue; this is the
   * first to cross a LOCK-state boundary — in_signature, already registering,
   * -> signed — rather than re-mint twice from the same terminal state).
   */
  test('case 4: supersession chain crosses the lock boundary — mint at in_signature, re-mint at signed, the first flips SUBSTITUÍDO', async ({
    page,
    browser,
  }) => {
    const token = await getOwnerToken(page, 'chefe.ccih@test.local')
    const meetingId = await createScheduledMeeting(
      page,
      token,
      'PDF·P2 case 4 — supersession crossing in_signature→signed',
    )
    await markHeld(page, token, meetingId)
    const attendeeId = await concludeMeetingToSignature(page, token, meetingId)
    expect(await meetingStatus(page, meetingId)).toBe('in_signature')

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(meetingHref(meetingId))

    const first = await mintViaDialog(page)

    await signAttendee(page, token, attendeeId)
    expect(await meetingStatus(page, meetingId)).toBe('signed')
    await page.reload()

    const second = await mintViaDialog(page)
    expect(second.shortCode).not.toBe(first.shortCode)

    await expect(
      articleForShortCode(page, first.shortCode).getByText('Substituído', { exact: true }),
    ).toBeVisible()
    await expect(articleForShortCode(page, second.shortCode).getByText('Ativo', { exact: true })).toBeVisible()

    // Logged-out verify of the FIRST (now superseded) short code: still
    // authentic, D6 recency wording, never "not found"/"anulado" — "which
    // version circulated on the 12th" has a real, verifiable answer.
    const anonContext = await browser.newContext()
    const anonPage = await anonContext.newPage()
    await anonPage.goto(`/verificar/${first.shortCode}?via=codigo`)
    await expect(anonPage.getByRole('heading', { name: 'Documento autêntico' })).toBeVisible()
    await expect(
      anonPage.getByText(/existe uma emissão mais recente deste documento/i),
    ).toBeVisible()
    await expect(anonPage.getByRole('heading', { name: 'Documento não reconhecido' })).toHaveCount(0)
    await expect(anonPage.getByRole('heading', { name: 'Documento anulado' })).toHaveCount(0)
    await anonContext.close()

    // The SECOND (current) short code verifies clean, with NO recency notice —
    // the two-sided pairing for the assertion above.
    const anonContext2 = await browser.newContext()
    const anonPage2 = await anonContext2.newPage()
    await anonPage2.goto(`/verificar/${second.shortCode}?via=codigo`)
    await expect(anonPage2.getByRole('heading', { name: 'Documento autêntico' })).toBeVisible()
    await expect(
      anonPage2.getByText(/existe uma emissão mais recente deste documento/i),
    ).toHaveCount(0)
    await anonContext2.close()
  })

  /**
   * ADR 0126 Amendment 1 §F — disposal is a THIRD registration conjunct for
   * `meeting`, placed in registration (not currency) on D10's symmetry: a
   * deliberate, terminal annulment of the source record, exactly like a
   * voided case phase. `dispose_meeting_minutes` touches neither `status` nor
   * `revision`, so only the registration predicate itself can see it.
   */
  test('case 6: disposal flips a signed ata back to the prévia — it no longer registers', async ({ page }) => {
    /**
     * Deliberately ZERO agenda items — see `disposeMeetingMinutes`'s doc
     * comment: `dispose_meeting_minutes` cannot complete on a LOCKED meeting
     * that has any (FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE, filed
     * separately, not fixed here). An empty meeting is the one fixture shape
     * the RPC can actually complete on today, and it is sufficient to
     * exercise the REGISTRATION axis this case is about.
     */
    const token = await getOwnerToken(page, 'chefe.ccih@test.local')
    const meetingId = await createScheduledMeeting(page, token, 'PDF·P2 case 6 — disposal drops registration')
    await markHeld(page, token, meetingId)
    await signMeetingToSigned(page, token, meetingId, CHEFE_CCIH_ID)
    expect(await meetingStatus(page, meetingId)).toBe('signed')

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(meetingHref(meetingId))

    // Differential control, BEFORE disposal: a signed ata registers, as always.
    await expect(page.getByRole('button', { name: 'Emitir documento', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Imprimir prévia', exact: true })).toHaveCount(0)

    await disposeMeetingMinutes(page, token, meetingId, 'retention_expired')
    const [row] = await serviceQuery<{ phi_disposed_at: string | null; status: string }>(
      page,
      `meetings?id=eq.${meetingId}&select=phi_disposed_at,status`,
    )
    expect(row?.phi_disposed_at, 'the RPC actually disposed this fixture').not.toBeNull()
    expect(row?.status, 'disposal does not touch status (ADR 0126 Amendment 1 §F)').toBe('signed')

    // The SAME differential, AFTER: flips to the ephemeral affordance only —
    // still `signed`/locked, but no longer registers.
    await page.reload()
    await expect(page.getByRole('link', { name: 'Imprimir prévia', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Emitir documento', exact: true })).toHaveCount(0)

    // The prévia corridor itself still works on a disposed source (ADR 0125
    // D2: paper stays available on demand even when nothing may register).
    const href = await page
      .getByRole('link', { name: 'Imprimir prévia', exact: true })
      .getAttribute('href')
    const resp = await page.request.get(href!)
    expect(resp.status()).toBe(200)
    expect(resp.headers()['content-type']).toContain('application/pdf')
    expect((await resp.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-')

    // And disposal never registered anything of its own either.
    expect(await printedDocumentRowsFor(page, 'meeting', meetingId)).toHaveLength(0)
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
    // The visibility flip is a raw SQL UPDATE on `meetings` — it must land
    // BEFORE the meeting locks: `app.guard_meeting_status` blocks ordinary
    // UPDATEs from `in_signature` onward, not only DELETE (confirmed
    // empirically), so setting it here (while still `held`) and concluding
    // AFTER is the only order that works.
    setMeetingVisibilityParticipantsOnly(meetingId)
    // ADR 0125/0126: also drives the meeting to `in_signature` so the
    // "control" mint-surface check below exercises a REGISTERING state —
    // `held` no longer shows "Emitir documento" at all (a still-editable
    // source is ephemeral-only), which is unrelated to this test's actual
    // subject (visibility, not print-source state). The attendee is already
    // on the roster (above), so this uses the bare conclude step, not
    // `concludeMeetingToSignature` (which would add a SECOND attendee row).
    await concludeMeeting(page, token, meetingId)
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
    // panel leaks. BUG-PDF2-002 (RESOLVED by-design 2026-08-08): the HTTP
    // status here is 200, and that is Next's DOCUMENTED streamed-response
    // contract, not an app defect — the page's guard needs a fresh DB read
    // below this route's `loading.tsx`, so the skeleton flushes (locking the
    // status) before notFound() can fire; Next compensates by injecting
    // `<meta name="robots" content="noindex">`. A guard moved into a nested
    // layout.tsx was empirically disproven (parent loading boundaries wrap
    // nested layouts — still 200). P1's platform_admin 404 is NOT a
    // counterexample: that denial fires in the COMMISSION layout, which no
    // loading boundary wraps, hence pre-stream. The assertions below pin the
    // full contract: 200 + noindex + 404 UI + zero content leak. If a future
    // Next version starts returning a real 404 here, the status assertion
    // going red is the signal to upgrade this to `toBe(404)` and close the
    // book — not a regression.
    await signInAs(page, 'staff1.ccih@test.local')
    const deniedResp = await page.goto(meetingHref(meetingId))
    expect(deniedResp?.status()).toBe(200)
    // BUG-ACT-NOTFOUND-COPY-1: /não encontr/i, the shared pt-BR stem — this
    // meeting-detail route hits the commission not-found boundary (ACT ADR
    // 0106's sibling), verified live across the QO·B CUT_ROUTES sample.
    await expect(page.getByText(/não encontr/i).first()).toBeVisible()
    expect(/<meta[^>]+robots[^>]+noindex/i.test((await deniedResp?.text()) ?? '')).toBe(true)
    await expect(page.getByRole('button', { name: 'Emitir documento' })).toHaveCount(0)
    await expect(page.getByText('Documentos emitidos')).toHaveCount(0)
  })

  test('keyboard-only: mint -> download-link focus, no mouse', async ({ page }) => {
    const token = await getOwnerToken(page, 'chefe.ccih@test.local')
    const meetingId = await createScheduledMeeting(page, token, 'PDF·P2 T4 — keyboard-only mint')
    await markHeld(page, token, meetingId)
    // ADR 0125/0126: `held` no longer registers at all (ephemeral prévia only)
    // — advance to `in_signature` so "Emitir documento" exists to keyboard-mint.
    // chefe.ccih is the attendee added here; staff1.ccih (below) stays a
    // non-attendee throughout, unaffected.
    await concludeMeetingToSignature(page, token, meetingId, CHEFE_CCIH_ID)

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

  /**
   * ADR 0104 A7 (QA r1 BLOCKER-1 fix): printed-document sight over a
   * per-caller-masked domain is source reach AND unmasked full-content sight,
   * for MINT and DOWNLOAD alike. Fixture: a fresh meeting whose agenda item
   * links the SEEDED ETH·E1 ethics case (`supabase/seed.sql`), on which
   * `staff4.ccih` is already the `respondent_doctor` (a real platform user,
   * professional-identity chain pre-wired) and `chefe.ccih` already holds an
   * explicit `read_case_deliberation` grant. Only the meeting/agenda-item/link
   * are freshly created here, all via real RPCs — the case and its
   * participants are READ-ONLY seed data, never mutated.
   */
  test('A7: the linked case respondent cannot mint or download the ata', async ({ page }) => {
    const token = await getOwnerToken(page, 'chefe.ccih@test.local')
    const meetingId = await createScheduledMeeting(page, token, 'PDF·P2 A7 — respondent denial')
    const agendaItemId = await addAgendaItemWithDescription(
      page,
      token,
      meetingId,
      'Processo disciplinar em pauta',
      'Substância deliberativa presente.',
    )
    await linkMeetingCase(page, token, meetingId, SEED_ETHICS_CASE_ID, agendaItemId)

    // ADR 0125/0126: registration now requires a LOCKED source — advance to
    // in_signature so "Emitir documento" — and therefore this whole A7
    // mint/download-denial corridor — exists to click at all. Unrelated to
    // A7's actual subject (masked-content authorization).
    // ⛔ ORDER IS LOAD-BEARING, not incidental: the agenda item + case link
    // above MUST land before this, never after — `app.guard_meeting_child_lock`
    // sits on `meeting_agenda_items`/`meeting_cases` (among others) and reads
    // no rpc flag, so it refuses those exact inserts once locked, even from
    // inside a meeting RPC (see `concludeMeetingToSignature`'s STANDING RULE,
    // `e2e/helpers/pdf-printing-meetings.ts`).
    await markHeld(page, token, meetingId)
    await concludeMeetingToSignature(page, token, meetingId, CHEFE_CCIH_ID)

    // Coordinator: full sight (explicit read_case_deliberation grant on the
    // seed case) -> mints fine.
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(meetingHref(meetingId))
    const { shortCode, downloadPath } = await mintViaDialog(page)
    const documentId = downloadPath.split('/').pop()!

    // A8: presence-derived PHI label + tier-pinned bucket bifurcation. DM5 D7
    // retired `printed_documents.storage_path` — the row now binds a core
    // `document_version_id`, and the bytes are that version's `printed_pdf`
    // rendition on `file_objects` (D11). The bucket is not read-back trivia:
    // `file_objects_bucket_from_tier` CHECKs it against `sensitivity_tier`, so
    // asserting the bucket here still proves the PHI ata landed on the PHI
    // tier — same property this assertion always checked, new coordinate
    // (locator, not property; e2e/helpers/documents.ts:143-152). The panel/
    // dialog UI carries no PHI indicator to assert through, so this is DB truth.
    const [row] = await serviceQuery<{ contains_phi: boolean; document_version_id: string }>(
      page,
      `printed_documents?id=eq.${documentId}&select=contains_phi,document_version_id`,
    )
    expect(row?.contains_phi).toBe(true)

    const [binding] = await serviceQuery<{ file_object_id: string }>(
      page,
      `document_version_files?document_version_id=eq.${row!.document_version_id}` +
        `&rendition_kind=eq.printed_pdf&select=file_object_id`,
    )
    expect(binding?.file_object_id, 'the printed version has a printed_pdf binding').toBeTruthy()

    const [fileObject] = await serviceQuery<{ storage_bucket: string; storage_path: string }>(
      page,
      `file_objects?id=eq.${binding.file_object_id}&select=storage_bucket,storage_path`,
    )
    expect(fileObject?.storage_bucket).toBe('documents-phi')
    expect(fileObject?.storage_path).toBe(`printed/${documentId}.pdf`)

    const coordinatorDownload = await page.request.get(downloadPath)
    expect(coordinatorDownload.status()).toBe(200)
    expect((await coordinatorDownload.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-')

    // staff4.ccih is the case's respondent AND a real CCIH member — the BASE
    // reach predicate (`can_reach_meeting`, commission_default) admits them,
    // so the meeting page itself is reachable (200, no BUG-PDF2-002 status-
    // code confusion here — no notFound() path is taken at all). A7's
    // full-sight conjunction is what must deny mint and download.
    await signInAs(page, RESPONDENT_STAFF4_EMAIL)
    const resp = await page.goto(meetingHref(meetingId))
    expect(resp?.status()).toBe(200)
    await expect(page.getByRole('button', { name: 'Emitir documento', exact: true })).toBeVisible()

    // The coordinator's minted ata does not appear in the respondent's own
    // panel — RLS on printed_documents denies the SELECT (no data leakage).
    await expect(articleForShortCode(page, shortCode)).toHaveCount(0)

    // Mint attempt fails server-side with the door's own pt-BR 42501 message
    // (SURFACEABLE_CODES lets it through verbatim — see src/lib/pdf-mint/actions.ts).
    await page.getByRole('button', { name: 'Emitir documento', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Emitir documento', exact: true }).click()
    await expect(dialog.getByText(/sem autorização/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('alert')).toHaveCount(0) // never reaches the success state

    // Download-path denial, probed directly under the respondent's own
    // session (mirrors the P1 logged-out probe; here AUTHENTICATED-but-denied):
    // open_printed_document returns no row for them, even for the coordinator's
    // already-minted document — the serving route answers 404, never bytes.
    const respondentDownload = await page.request.get(downloadPath)
    expect(respondentDownload.status()).toBe(404)
  })

  /**
   * ADR 0120 D18 — a print's OWN `documents` row (D13: homed on its source,
   * never appended to content) is filtered OUT of the Wave-A "Documentos"
   * projection. D18 is PRESENTATION, never an access control (Architecture
   * Rule 1) — the byte door (`open_printed_document`, D12's conjunction) is
   * the whole answer to who may read a print; this filter only changes what
   * a list means. Three things, deliberately in one test so the twin makes
   * the absence mean something (a vacuous "not found" passes with no fixture
   * at all):
   *
   *   1. the print's `documents` row genuinely EXISTS and is homed on this
   *      meeting, and IS referenced by `printed_documents` — the D18
   *      discriminator — so anything below is the FILTER's doing, not a
   *      missing fixture;
   *   2. the meeting's "Anexos" panel (`AttachmentsPanel` ->
   *      `DocumentsPanel` -> `listDocumentsForResource('meeting', …)`,
   *      `src/lib/queries/documents.ts`) never shows it — stays in its empty
   *      state on a fixture meeting that has zero real attachments, and the
   *      print's stable title never appears anywhere on the page;
   *   3. the corridor stays alive regardless: the print still downloads
   *      through its own route with real bytes. Two exclusions plus a
   *      re-signatured byte door is exactly the shape where every static
   *      gate is green and the feature is dead (see Task 1's storage_path
   *      fix above) — this closes that gap for the presentation half.
   *
   * NOT COVERED here, named for the record (see tester's report):
   * `form_response` is not in `DocumentHomeResourceType` at all — no product
   * surface renders a Wave-A documents panel for that home, so there is
   * nothing for a form_response print to leak into and nothing to assert.
   * The document-DETAIL projection (`documents.ts`'s own `getDocument`,
   * distinct from the Wave-B `controlled-documents.ts` one of the same
   * name) has zero importers anywhere under `src/` — no route mounts it —
   * so its half of D18 is unverifiable through the UI today.
   */
  test('D18: a meeting print is excluded from the Anexos panel, though its own row exists and would be listed without the filter, and its byte corridor still works', async ({
    page,
  }) => {
    const token = await getOwnerToken(page, 'chefe.ccih@test.local')
    const meetingId = await createScheduledMeeting(page, token, 'PDF·P2 D18 — panel exclusion')
    await markHeld(page, token, meetingId)
    await signMeetingToSigned(page, token, meetingId, CHEFE_CCIH_ID)

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(meetingHref(meetingId))

    // Fresh meeting fixture: the Anexos panel starts genuinely empty.
    const anexos = page.getByRole('region', { name: 'Anexos' })
    await expect(anexos.getByText('Nenhum anexo.', { exact: false })).toBeVisible()

    const { downloadPath } = await mintViaDialog(page)
    // The download route's :id is the `printed_documents.id` (the satellite
    // row), NOT `documents.id` — resolved separately below, exactly the
    // distinction D7 turns the satellite on.
    const printedDocId = downloadPath.split('/').pop()!

    // The twin: the print's own `documents` row is real, homed on THIS
    // meeting (D13), and referenced by `printed_documents` (D18's
    // discriminator) — service-role, RLS bypassed, so this is DB truth
    // independent of the panel's own query.
    const [printedRow] = await serviceQuery<{ id: string; document_id: string }>(
      page,
      `printed_documents?id=eq.${printedDocId}&select=id,document_id`,
    )
    expect(printedRow?.document_id, 'referenced by printed_documents — would be listed without the filter').toBeTruthy()

    const [docRow] = await serviceQuery<{
      id: string
      home_resource_id: string
      title: string
      kind: string | null
    }>(page, `documents?id=eq.${printedRow!.document_id}&select=id,home_resource_id,title,kind`)
    expect(docRow?.id, 'the print minted its own documents row').toBe(printedRow!.document_id)
    expect(docRow?.home_resource_id, 'homed on the meeting itself, not appended to content (D13)').toBe(
      meetingId,
    )
    expect(docRow?.kind).toBe('printed_rendition')

    // The exclusion: reload and confirm the print's own row never surfaces in
    // the Anexos panel — neither by title anywhere on the page, nor by the
    // panel leaving its empty state.
    await page.reload()
    await expect(page.getByText(docRow!.title, { exact: true })).toHaveCount(0)
    await expect(anexos.getByText('Nenhum anexo.', { exact: false })).toBeVisible()

    // The corridor stays alive: invisible to the content panel, the print
    // still downloads through its own route with real bytes.
    const resp = await page.request.get(downloadPath)
    expect(resp.status()).toBe(200)
    expect((await resp.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})

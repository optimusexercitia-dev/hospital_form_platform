import { test, expect, type Page } from '@playwright/test'
import { pickDate } from './helpers/date-pickers'
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  COMMISSION_A_ID,
  signInAs,
  serviceQuery,
  servicePost,
  docIdByCode,
  commissionDocHref,
  pickApprover,
  pdfPayload,
  publishViaDialog,
  ownerToken,
  pastDateIso,
  addMonthsIso,
  focusByTabbing,
  setControlledDocsFlag,
  selectSegmented,
  toggleReviewer,
  continuarButton,
  enviarButton,
  salvarRascunhoButton,
} from './helpers/documents'

/**
 * Phase 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados),
 * ported to the Phase 17 v2 / Controlled-Document Redesign UI (ADR 0081).
 *
 * Test contract: the original Acceptance list of
 * docs/phases/accreditation-track.md §Phase 17 (~490–506) + ADR 0057, RE-DRIVEN
 * through the redesigned surfaces (the all-in-one create/new-version wizards,
 * the table+chips register) and the B0 enum-key anglicization (ADR 0081):
 * `doc_type` keys are now English (`protocol`/`sop`/`policy`/…) and approval
 * `decision` keys are `approved`/`rejected` — DB-truth assertions use the new
 * keys; the UI still renders pt-BR labels (covered by
 * `documents-redesign.spec.ts` RW-10). New/changed-surface coverage (wizards,
 * register KPIs/chips, compare, Remind, notifications, retire-vs-superseded,
 * description) lives in `documents-redesign.spec.ts` — this file is the
 * regression backbone. Runs against the LOCAL Supabase stack (seeded personas).
 * Run `supabase db reset --local` before a full run; `--workers=1`, chromium.
 *
 * ⚠ Known trap: `code`s are PER-COMMISSION unique, not global — Farmácia (S4·CH)
 * seeded its own regimento as its first doc, so a bare `DOC-0001`/`DOC-0002` text
 * match can be ambiguous on cross-commission pages. Anchor on the row/table that
 * also carries a commission-specific marker where that matters (see AC-6/AC-10).
 *
 * Seeded Phase-17 dataset (supabase/seed.sql, commission A / CCIH, org rede-a,
 * hospital central-a; `controlled_docs` flag flipped ON locally by seed.sql):
 *   DOC-0001  "Política de Higienização das Mãos"  policy, EFFECTIVE, review_due
 *             2026-01-15 (PAST → overdue). Two approved approvers (staff1.ccih +
 *             staff1.farm — "Farmacêutico Um", same hospital, NOT a CCIH member).
 *   DOC-0002  "POP de Isolamento de Contato"  sop, IN_APPROVAL. Two PENDING
 *             approvers: staff1.ccih (in-commission) + chefe.farm (OUTSIDE CCIH,
 *             same hospital — the outside-commission approver persona).
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin of CCIH — the document author/coordinator.
 *   staff1.ccih@test.local  plain staff of CCIH — an in-commission approver on DOC-0002.
 *   staff2.ccih@test.local  plain staff of CCIH — a second in-commission approver.
 *   chefe.farm@test.local   staff_admin of Farmácia (commission B, SAME hospital,
 *                           NOT a CCIH member) — the outside-commission approver
 *                           named on DOC-0002.
 *   admin@test.local        org_admin of rede-a (⇒ staff_admin on CCIH pages).
 *   hospitaladmin.a1@test.local  hospital_admin of central-a — the register rollup.
 *   orgadmin.b@test.local   org_admin of rede-b — foreign-hospital register (empty).
 *
 * Route base: /o/rede-a/c/ccih/manage/documentos(/{id}); org queue
 * /o/rede-a/documentos-pendentes(/{id}); hospital register /o/rede-a/manage/documentos.
 */

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ===========================================================================
// AC-1: Full lifecycle with TWO approvers, one outside-commission (chefe.farm),
// driven end-to-end through the ALL-IN-ONE CREATE WIZARD (F-B).
// ===========================================================================

test('AC-1: full lifecycle — create wizard submits with two approvers, both e-sign, publish', async ({ page }) => {
  const uniqueTitle = `Protocolo Lifecycle ${Date.now()}`

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')
  await page.getByLabel('Título').fill(uniqueTitle)
  await selectSegmented(page, 'Protocolo')
  await page.getByLabel('Ciclo de revisão (meses)').fill('12')
  await continuarButton(page).click()

  await page.locator('#wizard-file').setInputFiles(pdfPayload)
  await continuarButton(page).click()

  // Approvers: staff1.ccih (in-commission) + chefe.farm (OUTSIDE CCIH, same hospital).
  await toggleReviewer(page, 'Enfermeiro CCIH Um')
  await toggleReviewer(page, 'Chefe Farmácia')
  await continuarButton(page).click()
  await enviarButton(page).click()

  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}\?aviso=enviado$/, { timeout: 20_000 })
  const docId = page.url().split('/').pop()!.split('?')[0]
  await expect(page.getByRole('heading', { name: uniqueTitle })).toBeVisible()

  // DB-truth: the version is in_approval with exactly two pending approval rows.
  const versionId = (
    await serviceQuery<{ id: string; status: string }>(
      page,
      `controlled_document_versions?document_id=eq.${docId}&select=id,status`,
    )
  )[0]
  expect(versionId.status, 'version → in_approval after submit').toBe('in_approval')

  const approvals = await serviceQuery<{ approver_id: string; decision: string | null }>(
    page,
    `document_approvals?document_version_id=eq.${versionId.id}&select=approver_id,decision`,
  )
  expect(approvals.length, 'two pending approvals created').toBe(2)
  expect(approvals.every((a) => a.decision === null), 'both pending').toBeTruthy()

  // --- Approver 1 (staff1.ccih) e-signs from the org queue. ---
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/documentos-pendentes/${docId}`)
  await expect(page.getByRole('heading', { name: uniqueTitle })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /^aprovar$/i }).click()
  await page.getByRole('button', { name: /confirmar aprovação/i }).click()

  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ decision: string | null }>(
        page,
        `document_approvals?document_version_id=eq.${versionId.id}&order=created_at&select=decision`,
      )
      return rows.filter((r) => r.decision === 'approved').length
    }, { timeout: 15_000, message: 'staff1 signed approved' })
    .toBe(1)

  // --- Approver 2 (chefe.farm, OUTSIDE commission) e-signs. ---
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/documentos-pendentes/${docId}`)
  await expect(page.getByRole('heading', { name: uniqueTitle })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /^aprovar$/i }).click()
  await page.getByRole('button', { name: /confirmar aprovação/i }).click()

  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ decision: string | null }>(
        page,
        `document_approvals?document_version_id=eq.${versionId.id}&select=decision`,
      )
      return rows.filter((r) => r.decision === 'approved').length
    }, { timeout: 15_000, message: 'both approvers signed approved' })
    .toBe(2)

  // --- Coordinator publishes (chefe.ccih). Cycle is 12 months → review_due =
  //     effective + 12 months (computed by the RPC). ---
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(commissionDocHref(docId))
  const effective = await publishViaDialog(page)
  const expectedReview = addMonthsIso(effective, 12)

  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ status: string; effective_date: string; review_due_date: string }>(
        page,
        `controlled_document_versions?id=eq.${versionId.id}&select=status,effective_date,review_due_date`,
      )
      return rows[0]
    }, { timeout: 15_000, message: 'version published effective with computed dates' })
    .toMatchObject({ status: 'effective', effective_date: effective, review_due_date: expectedReview })

  await page.reload()
  await expect(page.getByText('Vigente', { exact: true }).first()).toBeVisible()
  const versionsSection = page.locator('section').filter({ hasText: 'Versões' })
  await expect(versionsSection.getByRole('link', { name: /baixar/i }).first()).toBeVisible()
})

// ===========================================================================
// AC-2: Approver isolation (security-critical). chefe.farm (NOT a CCIH member)
//   sees only DOC-0002 in the org queue, can open + download it, and canNOT
//   reach DOC-0001 or the CCIH commission surface.
// ===========================================================================

test('AC-2: outside-commission approver sees only her named document; no CCIH data leak', async ({ page }) => {
  const doc0001 = await docIdByCode(page, 'DOC-0001') // effective, chefe.farm NOT named
  const doc0002 = await docIdByCode(page, 'DOC-0002') // in_approval, chefe.farm named

  await signInAs(page, 'chefe.farm@test.local')

  await page.goto('/o/rede-a/documentos-pendentes')
  await expect(page.getByRole('heading', { name: /aprovações pendentes/i })).toBeVisible()
  await expect(page.getByText('DOC-0002')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('DOC-0001')).toHaveCount(0)

  await page.goto(`/o/rede-a/documentos-pendentes/${doc0002}`)
  await expect(page.getByRole('heading', { name: /POP de Isolamento/i })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /arquivo em aprovação/i })).toBeVisible()

  const resp = await page.goto(`/o/rede-a/documentos-pendentes/${doc0001}`)
  expect(resp?.status(), 'DOC-0001 approver-detail 404 for non-approver').toBe(404)

  const regResp = await page.goto('/o/rede-a/c/ccih/manage/documentos')
  expect(regResp?.status(), 'CCIH register 404 for non-CCIH-coordinator').toBe(404)

  const detResp = await page.goto(commissionDocHref(doc0001))
  expect(detResp?.status(), 'DOC-0001 coordinator detail 404').toBe(404)
})

// ===========================================================================
// AC-3: Publish rejected (pt-BR) while ANY approval is pending. DOC-0002 has
// two PENDING approvers → publish must be blocked (HC090).
// ===========================================================================

test('AC-3: publish is rejected in pt-BR while an approval is pending', async ({ page }) => {
  const doc0002 = await docIdByCode(page, 'DOC-0002')

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(commissionDocHref(doc0002))
  await expect(page.getByRole('heading', { name: /POP de Isolamento/i })).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: /^publicar$/i }).click()
  const dialog = page.getByRole('dialog')
  await pickDate(dialog, page, { trigger: dialog.locator('button[aria-haspopup="dialog"]').first() })
  await dialog.getByRole('button', { name: /^publicar$/i }).click()

  await expect(dialog.getByRole('alert')).toContainText(/aprovadores devem aprovar/i, { timeout: 15_000 })

  const rows = await serviceQuery<{ status: string }>(page, `controlled_documents?id=eq.${doc0002}&select=status`)
  expect(rows[0].status, 'DOC-0002 remains in_approval').toBe('in_approval')
})

// ===========================================================================
// AC-4: Rejection flow — a `rejected` decision returns the version to `draft`
// (note preserved); resubmit works via the detail page's SubmitForApprovalForm
// (the file stays attached from the wizard submit — resubmit needs no re-upload).
// ===========================================================================

test('AC-4: a rejection returns the version to draft with the note; resubmit works', async ({ page }) => {
  const title = `Doc Rejeição ${Date.now()}`

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')
  await page.getByLabel('Título').fill(title)
  await selectSegmented(page, 'POP')
  await page.locator('#wizard-file').setInputFiles(pdfPayload)
  await continuarButton(page).click()
  await toggleReviewer(page, 'Enfermeiro CCIH Um')
  await continuarButton(page).click()
  await enviarButton(page).click()
  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}\?aviso=enviado$/, { timeout: 20_000 })
  const docId = page.url().split('/').pop()!.split('?')[0]

  const versionId = (
    await serviceQuery<{ id: string }>(page, `controlled_document_versions?document_id=eq.${docId}&select=id`)
  )[0].id

  const rejectNote = `Revisar seção 3 — ${Date.now()}`
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/documentos-pendentes/${docId}`)
  await page.getByRole('button', { name: /^rejeitar$/i }).click()
  await page.getByLabel(/motivo da rejeição/i).fill(rejectNote)
  await page.getByRole('button', { name: /confirmar rejeição/i }).click()

  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ status: string }>(
        page,
        `controlled_document_versions?id=eq.${versionId}&select=status`,
      )
      return rows[0]?.status
    }, { timeout: 15_000, message: 'version returned to draft after rejection' })
    .toBe('draft')

  const noteRows = await serviceQuery<{ note: string | null; decision: string | null }>(
    page,
    `document_approvals?document_version_id=eq.${versionId}&select=note,decision`,
  )
  expect(noteRows.some((r) => r.decision === 'rejected' && r.note === rejectNote), 'note preserved').toBeTruthy()

  // Resubmit via the detail page's SubmitForApprovalForm (file already attached).
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(commissionDocHref(docId))
  const resubmit = page.locator('form').filter({ hasText: 'Enviar para aprovação' })
  await expect(resubmit).toBeVisible({ timeout: 15_000 })
  await pickApprover(resubmit, 'Enfermeiro CCIH Um')
  await resubmit.getByRole('button', { name: /enviar para aprovação/i }).click()

  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ status: string }>(
        page,
        `controlled_document_versions?id=eq.${versionId}&select=status`,
      )
      return rows[0]?.status
    }, { timeout: 15_000, message: 'resubmit → in_approval again' })
    .toBe('in_approval')
})

// ===========================================================================
// AC-5: Supersede (the INLINE fallback — a blank draft, not the wizard, which
// is covered separately) retires the prior version to obsolete/superseded but
// retained + downloadable.
// ===========================================================================

test('AC-5: inline supersede retires the prior version to obsolete/superseded (retained + downloadable)', async ({
  page,
}) => {
  const title = `Doc Supersede ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const docId = await buildPublishedDoc(page, title)

  const v1 = (
    await serviceQuery<{ id: string; version_number: number }>(
      page,
      `controlled_document_versions?document_id=eq.${docId}&select=id,version_number&order=version_number`,
    )
  )[0]

  // The INLINE fallback ("Criar rascunho em branco") — button-only, no file input.
  await page.goto(commissionDocHref(docId))
  await page.getByRole('button', { name: /criar rascunho em branco/i }).click()

  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ version_number: number }>(
        page,
        `controlled_document_versions?document_id=eq.${docId}&select=version_number`,
      )
      return rows.length
    }, { timeout: 15_000, message: 'a second version was created' })
    .toBe(2)

  const v2 = (
    await serviceQuery<{ id: string; version_number: number; status: string }>(
      page,
      `controlled_document_versions?document_id=eq.${docId}&version_number=eq.2&select=id,version_number,status`,
    )
  )[0]

  await page.reload()
  const fileForm = page.locator('form').filter({ hasText: 'Arquivo da versão' })
  await expect(fileForm).toBeVisible({ timeout: 15_000 })
  await fileForm.locator('input[type="file"]').setInputFiles(pdfPayload)
  await fileForm.getByRole('button', { name: /enviar arquivo/i }).click()
  await expect
    .poll(async () => (await serviceQuery<{ storage_path: string | null }>(page, `controlled_document_versions?id=eq.${v2.id}&select=storage_path`))[0]?.storage_path ?? null, { timeout: 15_000, message: 'v2 file uploaded' })
    .not.toBeNull()
  await page.reload()
  const submitForm = page.locator('form').filter({ hasText: 'Enviar para aprovação' })
  await pickApprover(submitForm, 'Enfermeiro CCIH Um')
  await submitForm.getByRole('button', { name: /enviar para aprovação/i }).click()
  await expect
    .poll(async () => (await serviceQuery<{ status: string }>(page, `controlled_document_versions?id=eq.${v2.id}&select=status`))[0]?.status, { timeout: 15_000 })
    .toBe('in_approval')

  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/documentos-pendentes/${docId}`)
  await page.getByRole('button', { name: /^aprovar$/i }).click()
  await page.getByRole('button', { name: /confirmar aprovação/i }).click()
  await expect
    .poll(async () => (await serviceQuery<{ decision: string | null }>(page, `document_approvals?document_version_id=eq.${v2.id}&select=decision`))[0]?.decision, { timeout: 15_000 })
    .toBe('approved')

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(commissionDocHref(docId))
  await publishViaDialog(page)

  // DB-truth: v2 effective; v1 retired to obsolete/superseded but RETAINED with its storage_path.
  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ id: string; status: string; obsolete_kind: string | null; storage_path: string | null }>(
        page,
        `controlled_document_versions?document_id=eq.${docId}&select=id,status,obsolete_kind,storage_path&order=version_number`,
      )
      const v1row = rows.find((r) => r.id === v1.id)
      const v2row = rows.find((r) => r.id === v2.id)
      return `${v1row?.status}/${v1row?.obsolete_kind}/${v2row?.status}/${v1row?.storage_path ? 'kept' : 'gone'}`
    }, { timeout: 15_000, message: 'v1 obsolete+superseded+retained, v2 effective' })
    .toBe('obsolete/superseded/effective/kept')

  await page.reload()
  const versionsSection = page.locator('section').filter({ hasText: 'Versões' })
  await expect(versionsSection.getByRole('link', { name: /baixar/i })).toHaveCount(2)
})

// ===========================================================================
// AC-6: Review-due — the past-due DOC-0001 surfaces in the commission review-due
// list AND (as hospital_admin) the hospital register; an overdue published FORM
// joins the review-due list (form arm).
// ===========================================================================

test('AC-6: past-due document surfaces in the commission review-due list and hospital register', async ({ page }) => {
  const doc0001 = await docIdByCode(page, 'DOC-0001') // effective — NO draft

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos/revisoes')
  await expect(page.getByRole('heading', { name: /revis/i }).first()).toBeVisible({ timeout: 15_000 })

  const doc0001Row = page.locator('li').filter({ hasText: 'DOC-0001' })
  await expect(doc0001Row).toBeVisible({ timeout: 15_000 })
  await expect(doc0001Row.getByText(/vencida/i)).toBeVisible()

  // DOC-0001 is effective with no draft → editing by URL is not allowed (404 UI).
  await page.goto(`/o/rede-a/c/ccih/manage/documentos/${doc0001}/editar`)
  await expect(page.getByRole('heading', { name: /Editar documento$/ })).toHaveCount(0)
  await expect(page.locator('input[name="title"]')).toHaveCount(0)
  await expect(
    page.getByText(/não encontramos esta página|Erro 404|página não encontrada/i).first(),
  ).toBeVisible({ timeout: 10_000 })

  // Hospital register (as hospital_admin): DOC-0001 present + flagged review-overdue.
  // Codes are per-commission — Farmácia's regimento is also a "DOC-0001" at this
  // hospital, so scope to the row that ALSO carries the overdue chip (deterministic).
  await signInAs(page, 'hospitaladmin.a1@test.local')
  await page.goto('/o/rede-a/manage/documentos')
  const doc0001OverdueRow = page
    .locator('tr')
    .filter({ hasText: 'DOC-0001' })
    .filter({ hasText: /vencida/i })
  await expect(doc0001OverdueRow).toBeVisible({ timeout: 15_000 })
})

test('AC-6b: an overdue published form joins the review-due list (form arm)', async ({ page }) => {
  const token = await ownerToken(page, 'chefe.ccih@test.local')

  const formId = crypto.randomUUID()
  const versionId = crypto.randomUUID()
  const sectionId = crypto.randomUUID()
  await servicePost(page, 'forms', {
    id: formId,
    commission_id: COMMISSION_A_ID,
    title: `Form Revisão Vencida ${Date.now()}`,
    created_by: '00000000-0000-0000-0000-000000000002',
  })
  await servicePost(page, 'form_versions', {
    id: versionId,
    form_id: formId,
    version_number: 1,
    status: 'draft',
  })
  await servicePost(page, 'form_sections', {
    id: sectionId,
    form_version_id: versionId,
    position: 0,
    is_default: true,
  })

  const publishResp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/publish_form_version`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      p_form_version_id: versionId,
      p_effective_date: pastDateIso(400),
      p_review_cycle_months: 1,
    },
  })
  expect(publishResp.ok(), 'publish_form_version with review metadata').toBeTruthy()

  const fvRows = await serviceQuery<{ review_due_date: string | null; status: string }>(
    page,
    `form_versions?id=eq.${versionId}&select=review_due_date,status`,
  )
  expect(fvRows[0].status).toBe('published')
  expect(fvRows[0].review_due_date, 'review_due computed from cycle').not.toBeNull()

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos/revisoes')
  const formRow = page.locator('li').filter({ hasText: 'Formulário' })
  await expect(formRow.first()).toBeVisible({ timeout: 15_000 })
})

// ===========================================================================
// AC-7: Immutable storage (Rule 6) — each version upload lands at a NEW path.
// ===========================================================================

test('AC-7: each version upload lands at a NEW storage path (Rule 6)', async ({ page }) => {
  const title = `Doc Paths ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const docId = await buildPublishedDoc(page, title)

  await page.goto(commissionDocHref(docId))
  await page.getByRole('button', { name: /criar rascunho em branco/i }).click()
  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ version_number: number }>(
        page,
        `controlled_document_versions?document_id=eq.${docId}&select=version_number`,
      )
      return rows.length
    }, { timeout: 15_000 })
    .toBe(2)
  await page.reload()
  const fileForm = page.locator('form').filter({ hasText: 'Arquivo da versão' })
  await fileForm.locator('input[type="file"]').setInputFiles(pdfPayload)
  await fileForm.getByRole('button', { name: /enviar arquivo/i }).click()

  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ storage_path: string | null }>(
        page,
        `controlled_document_versions?document_id=eq.${docId}&select=storage_path,version_number&order=version_number`,
      )
      return rows.length === 2 && rows.every((r) => r.storage_path)
    }, { timeout: 15_000 })
    .toBeTruthy()

  const paths = await serviceQuery<{ storage_path: string }>(
    page,
    `controlled_document_versions?document_id=eq.${docId}&select=storage_path&order=version_number`,
  )
  expect(paths.length).toBe(2)
  expect(paths[0].storage_path, 'v1 and v2 have distinct immutable paths').not.toBe(paths[1].storage_path)
})

// ===========================================================================
// AC-8: Form-publish metadata (F7/B4) — unrelated to the document redesign;
// publishing a form WITH the fields captures approver/effective/review-due;
// publishing WITHOUT them stays NULL (compat).
// ===========================================================================

test('AC-8: publish_form_version captures metadata with fields and leaves it NULL without', async ({ page }) => {
  const token = await ownerToken(page, 'chefe.ccih@test.local')

  const f1 = crypto.randomUUID(), v1 = crypto.randomUUID(), s1 = crypto.randomUUID()
  await servicePost(page, 'forms', { id: f1, commission_id: COMMISSION_A_ID, title: `Meta ${Date.now()}`, created_by: '00000000-0000-0000-0000-000000000002' })
  await servicePost(page, 'form_versions', { id: v1, form_id: f1, version_number: 1, status: 'draft' })
  await servicePost(page, 'form_sections', { id: s1, form_version_id: v1, position: 0, is_default: true })
  const farmId = (await serviceQuery<{ id: string }>(page, `profiles?full_name=eq.Chefe%20Farm%C3%A1cia&select=id`))[0]?.id
    ?? '00000000-0000-0000-0000-000000000005'
  const withResp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/publish_form_version`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { p_form_version_id: v1, p_approved_by: farmId, p_effective_date: '2024-03-01', p_review_cycle_months: 6 },
  })
  expect(withResp.ok()).toBeTruthy()
  const withRows = await serviceQuery<{ approved_by: string | null; effective_date: string | null; review_due_date: string | null; approved_at: string | null }>(
    page,
    `form_versions?id=eq.${v1}&select=approved_by,effective_date,review_due_date,approved_at`,
  )
  expect(withRows[0]).toMatchObject({ approved_by: farmId, effective_date: '2024-03-01', review_due_date: '2024-09-01' })
  expect(withRows[0].approved_at, 'approved_at stamped').not.toBeNull()

  const f2 = crypto.randomUUID(), v2 = crypto.randomUUID(), s2 = crypto.randomUUID()
  await servicePost(page, 'forms', { id: f2, commission_id: COMMISSION_A_ID, title: `Plain ${Date.now()}`, created_by: '00000000-0000-0000-0000-000000000002' })
  await servicePost(page, 'form_versions', { id: v2, form_id: f2, version_number: 1, status: 'draft' })
  await servicePost(page, 'form_sections', { id: s2, form_version_id: v2, position: 0, is_default: true })
  const plainResp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/publish_form_version`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { p_form_version_id: v2 },
  })
  expect(plainResp.ok()).toBeTruthy()
  const plainRows = await serviceQuery<{ approved_by: string | null; approved_at: string | null; effective_date: string | null; review_due_date: string | null }>(
    page,
    `form_versions?id=eq.${v2}&select=approved_by,approved_at,effective_date,review_due_date`,
  )
  expect(plainRows[0]).toEqual({ approved_by: null, approved_at: null, effective_date: null, review_due_date: null })
})

// ===========================================================================
// AC-9: Foreign-hospital approver rejected (HC091 → pt-BR) at submit.
// ===========================================================================

test('AC-9: a foreign-hospital user cannot be named approver (pt-BR error)', async ({ page }) => {
  const token = await ownerToken(page, 'chefe.ccih@test.local')

  // Build a fresh draft with a file via the wizard's "Salvar rascunho" (reached
  // from step 1, where the Dropzone input exists), so we have a version to submit.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')
  await page.getByLabel('Título').fill(`Doc Foreign ${Date.now()}`)
  await selectSegmented(page, 'Política')
  await continuarButton(page).click()
  await page.locator('#wizard-file').setInputFiles(pdfPayload)
  await salvarRascunhoButton(page).click()
  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}\?aviso=rascunho$/, { timeout: 20_000 })
  const docId = page.url().split('/').pop()!.split('?')[0]
  await expect
    .poll(async () => (await serviceQuery<{ storage_path: string | null }>(page, `controlled_document_versions?document_id=eq.${docId}&select=storage_path`))[0]?.storage_path ?? null, { timeout: 15_000 })
    .not.toBeNull()
  const versionId = (await serviceQuery<{ id: string }>(page, `controlled_document_versions?document_id=eq.${docId}&select=id`))[0].id

  const foreignId = (await serviceQuery<{ id: string }>(page, `profiles?full_name=eq.Analista%20Qualidade%20B&select=id`))[0]?.id
  expect(foreignId, 'a foreign-hospital user exists in seed').toBeTruthy()

  const resp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/submit_document_for_approval`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { p_version_id: versionId, p_approvers: [{ approver_id: foreignId }] },
  })
  expect(resp.status(), 'foreign-hospital approver rejected').toBe(400)
  const body = await resp.json()
  expect(body.code, 'HC091 raised').toBe('HC091')
})

// ===========================================================================
// AC-10: Hospital-wide register — a hospital_admin sees the cross-commission
// register; a foreign-hospital admin sees empty.
// ===========================================================================

test('AC-10: hospital_admin sees the cross-commission register; a foreign-hospital admin sees empty', async ({ page }) => {
  // Codes are per-commission, so DOC-0001 alone is no longer unique on this
  // cross-commission page — Farmácia (same hospital) also has a DOC-0001 (its
  // S4·CH regimento). Anchor on DOC-0002 (still unique) to find CCIH's own
  // per-commission table, then assert DOC-0001 is in THAT same table.
  await signInAs(page, 'hospitaladmin.a1@test.local')
  await page.goto('/o/rede-a/manage/documentos')
  const doc0002Row = page.locator('tr').filter({ hasText: 'DOC-0002' })
  await expect(doc0002Row).toBeVisible({ timeout: 15_000 })
  const ccihTable = page.locator('table').filter({ has: doc0002Row })
  await expect(ccihTable.locator('tr').filter({ hasText: 'DOC-0001' })).toBeVisible()

  await signInAs(page, 'orgadmin.b@test.local')
  const resp = await page.goto('/o/rede-a/manage/documentos')
  expect([403, 404]).toContain(resp?.status() ?? 0)
})

// ===========================================================================
// AC-11: Audit — lifecycle actions emit audit rows; the metadata never contains
// title/summary_of_changes_md/note/storage_path/description/category/tags.
// ===========================================================================

test('AC-11: document lifecycle emits audit rows with no sensitive fields', async ({ page }) => {
  const title = `Doc Audit ${Date.now()}`
  const description = 'Descrição sensível que não deve vazar no audit_log.'
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')
  await page.getByLabel('Título').fill(title)
  await selectSegmented(page, 'Manual')
  await page.getByLabel('Categoria').fill('Categoria Audit E2E')
  await page.getByLabel('Descrição').fill(description)
  const tagsInput = page.getByLabel('Etiquetas')
  await tagsInput.fill('audit-tag')
  await tagsInput.press('Enter')
  await salvarRascunhoButton(page).click()
  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}\?aviso=rascunho$/, { timeout: 20_000 })
  const docId = page.url().split('/').pop()!.split('?')[0]

  await expect
    .poll(
      async () =>
        (
          await serviceQuery<{ action: string }>(
            page,
            `audit_log?entity_id=eq.${docId}&action=eq.document.created&select=action`,
          )
        ).length,
      { timeout: 15_000, message: 'document.created audit row' },
    )
    .toBeGreaterThanOrEqual(1)

  const rows = await serviceQuery<{ action: string; entity_id: string; metadata: unknown }>(
    page,
    `audit_log?entity_id=eq.${docId}&action=eq.document.created&select=action,entity_id,metadata`,
  )
  expect(rows.length, 'document.created row present').toBeGreaterThanOrEqual(1)

  const serialized = JSON.stringify(rows)
  expect(serialized).not.toContain(title) // title never audited
  expect(serialized).not.toContain(description) // description never audited
  expect(serialized).not.toContain('audit-tag') // tags never audited
  expect(serialized.toLowerCase()).not.toContain('summary_of_changes')
  expect(serialized.toLowerCase()).not.toContain('storage_path')
  expect(serialized).not.toContain('Categoria Audit E2E') // category never audited
})

// ===========================================================================
// AC-12: Flag gating — with controlled_docs OFF the whole surface 404s; ON reveals it.
// ===========================================================================

test('AC-12: OFF → the controlled-documents RPCs reject (flag gate); ON → the surface renders', async ({ page }) => {
  const token = await ownerToken(page, 'chefe.ccih@test.local')

  await signInAs(page, 'chefe.ccih@test.local')
  const onResp = await page.goto('/o/rede-a/c/ccih/manage/documentos')
  expect(onResp?.status(), 'register renders with flag ON').toBe(200)
  await expect(page.getByRole('heading', { name: /documentos controlados/i })).toBeVisible()

  const listOn = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/list_approver_candidates`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { p_commission: COMMISSION_A_ID },
  })
  expect(listOn.ok(), 'a controlled-docs RPC succeeds while ON').toBeTruthy()

  try {
    setControlledDocsFlag(false)
    const createOff = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/create_controlled_document`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { p_commission: COMMISSION_A_ID, p_title: 'Bloqueado', p_doc_type: 'sop' },
    })
    expect(createOff.status(), 'create_controlled_document rejected while OFF').toBe(400)
    const body = await createOff.json()
    expect(String(body.message ?? ''), 'pt-BR unavailable message').toMatch(/não está disponível/i)

    const listOff = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/list_approver_candidates`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { p_commission: COMMISSION_A_ID },
    })
    expect(listOff.status(), 'list_approver_candidates rejected while OFF').toBe(400)
  } finally {
    setControlledDocsFlag(true)
  }
})

// ===========================================================================
// AC-13: One fully keyboard-only flow — chefe.ccih Tabs the register → opens
// DOC-0002; then chefe.farm reaches documentos-pendentes → opens DOC-0002 →
// Tab to Aprovar/Rejeitar → sign. Confirms chefe.farm is not blocked at the
// org-level approver route. (A second, wizard-focused keyboard pass lives in
// documents-redesign.spec.ts RW-1b.)
// ===========================================================================

test('AC-13: keyboard-only — coordinator opens a doc; outside approver signs via keyboard', async ({ page }) => {
  const doc0002 = await docIdByCode(page, 'DOC-0002')

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos')
  await expect(page.getByRole('heading', { name: /documentos controlados/i })).toBeVisible()

  const doc0002Row = page.getByRole('link').filter({ hasText: 'DOC-0002' })
  await expect(doc0002Row).toBeVisible({ timeout: 15_000 })
  await focusByTabbing(page, async () => {
    return page.evaluate((id) => {
      const el = document.activeElement as HTMLAnchorElement | null
      return el?.tagName === 'A' && (el.getAttribute('href') ?? '').endsWith(`/documentos/${id}`)
    }, doc0002)
  })
  await page.keyboard.press('Enter')
  await page.waitForURL(new RegExp(`/documentos/${doc0002}$`), { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /POP de Isolamento/i })).toBeVisible()

  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/documentos-pendentes/${doc0002}`)
  await expect(page.getByRole('heading', { name: /POP de Isolamento/i })).toBeVisible({ timeout: 15_000 })

  const aprovarBtn = page.getByRole('button', { name: /^aprovar$/i })
  await expect(aprovarBtn).toBeVisible()

  await focusByTabbing(page, async () => {
    return page.evaluate(() => {
      const el = document.activeElement
      return el?.tagName === 'BUTTON' && /aprovar/i.test(el.textContent ?? '') && !/rejeitar/i.test(el.textContent ?? '')
    })
  })
  await page.keyboard.press('Enter')
  await expect(page.getByLabel(/observação/i)).toBeVisible()
  await page.getByRole('button', { name: /confirmar aprovação/i }).focus()
  await page.keyboard.press('Enter')

  const farmId = (await serviceQuery<{ id: string }>(page, `profiles?full_name=eq.Chefe%20Farm%C3%A1cia&select=id`))[0].id
  const versionId = (await serviceQuery<{ current_version_id: string }>(page, `controlled_documents?id=eq.${doc0002}&select=current_version_id`))[0].current_version_id
  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ decision: string | null }>(
        page,
        `document_approvals?document_version_id=eq.${versionId}&approver_id=eq.${farmId}&select=decision`,
      )
      return rows[0]?.decision
    }, { timeout: 15_000, message: 'chefe.farm signed via keyboard' })
    .toBe('approved')
})

// ---------------------------------------------------------------------------
// Shared scaffolding helper (local to this file — the CREATE-wizard variant
// used across several ACs; distinct from the redesign spec's own helper which
// selects a different doc type / approver mix).
// ---------------------------------------------------------------------------

/**
 * Build + publish a controlled document end-to-end via the create wizard
 * (create → file → one approver (staff1.ccih) → submit → sign → publish).
 * Returns the document id. Signed in as chefe.ccih on entry; leaves the
 * session on chefe.ccih.
 */
async function buildPublishedDoc(page: Page, title: string): Promise<string> {
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')
  await page.getByLabel('Título').fill(title)
  await selectSegmented(page, 'Protocolo')
  await page.locator('#wizard-file').setInputFiles(pdfPayload)
  await continuarButton(page).click()
  await toggleReviewer(page, 'Enfermeiro CCIH Um')
  await continuarButton(page).click()
  await enviarButton(page).click()
  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}\?aviso=enviado$/, { timeout: 20_000 })
  const docId = page.url().split('/').pop()!.split('?')[0]

  const versionId = (
    await serviceQuery<{ id: string }>(page, `controlled_document_versions?document_id=eq.${docId}&select=id`)
  )[0].id

  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/documentos-pendentes/${docId}`)
  await page.getByRole('button', { name: /^aprovar$/i }).click()
  await page.getByRole('button', { name: /confirmar aprovação/i }).click()
  await expect
    .poll(async () => (await serviceQuery<{ decision: string | null }>(page, `document_approvals?document_version_id=eq.${versionId}&select=decision`))[0]?.decision, { timeout: 15_000 })
    .toBe('approved')

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(commissionDocHref(docId))
  await publishViaDialog(page)
  await expect
    .poll(async () => (await serviceQuery<{ status: string }>(page, `controlled_document_versions?id=eq.${versionId}&select=status`))[0]?.status, { timeout: 15_000 })
    .toBe('effective')

  return docId
}

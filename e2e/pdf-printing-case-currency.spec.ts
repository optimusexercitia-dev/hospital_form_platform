import { test, expect, type APIRequestContext } from '@playwright/test'

import { cachedSignIn as signInAs } from './helpers/auth'
import { createDraftTemplateDirect } from './helpers/process-templates'
import {
  articleForShortCode,
  mintViaDialog,
  printedDocumentRowsFor,
  submissionDetailHref,
} from './helpers/pdf-printing'

/**
 * ADR 0126 D10 (print-source split, case 5) — a VOIDED case phase's response
 * neither REGISTERS nor stays CURRENT. The void mechanism itself (`file_
 * correction_request`/`approve_correction`, `kind = 'void'`) is ADR 0085's
 * case-correction lifecycle, exercised end to end here through the real UI;
 * this file's own subject is the PRINT CONSEQUENCE ADR 0126 D10 attaches to
 * it, which no other spec covers — `e2e/case-void-reopen.spec.ts` proves the
 * case-domain side (Anulada pill, result cleared, downstream unblock) and
 * never mints anything.
 *
 * Two conjuncts, both asserted, both two-sided, with an UN-VOIDED SIBLING as
 * the differential (a predicate stubbed "always current" or "never current"
 * must not be able to pass this file):
 *   registers — the voided response's dashboard flips from "Emitir
 *               documento" to "Imprimir prévia"; the sibling's does not.
 *   currency  — the voided response's EXISTING print (minted BEFORE the
 *               void, while it still legitimately registered) flips from
 *               current to not-current; the sibling's stays current.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * HERMETICITY DESIGN (mirrors case-void-reopen.spec.ts / case-corrections.spec.ts)
 * ──────────────────────────────────────────────────────────────────────────────
 * beforeAll builds ONE spec-owned form (1 required multiple_choice item,
 * Sim/Não — the house minimal shape) + ONE spec-owned single-phase process
 * template (no ruleset, no narrative slot — this file needs neither) + TWO
 * cases from it: VOID and CONTROL. Phase 1 of both is driven to `completed`
 * via RPC (activate → start → save → submit, staff1 as assignee, "Sim"),
 * which is ALL a void request needs (`file_correction_request` requires the
 * TARGET `completed`, not any particular ruleset result). Only VOID's phase
 * is ever voided; CONTROL is never touched again after its phase completes —
 * that asymmetry is the whole test.
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin, CCIH — files AND approves the void
 *                           (approval strictly requires staff_admin/admin;
 *                           filing itself only needs case-content read, but
 *                           every existing case-correction spec files and
 *                           approves in one session with no persona switch,
 *                           and this file follows that precedent) — also the
 *                           one who mints (D11: mint follows source sight).
 *   staff1.ccih@test.local  staff, CCIH — the phase's assignee/filler.
 *
 * Run `npx supabase db reset` before this run; `--workers=1` (stateful,
 * serial — matches every sibling case-domain spec's own stated precondition).
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

const COMM_A = 'a0000000-0000-0000-0000-0000000000a1'
const ORG = 'rede-a'
const SLUG = 'ccih'
const MANAGE_BASE = `/o/${ORG}/c/${SLUG}/manage/cases`

const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002'
const UID_STAFF_1 = '00000000-0000-0000-0000-000000000003'

const SPEC_TAG = 'PDFCUR-SPEC'
const FORM_TITLE = `Checklist ${SPEC_TAG}`
const TEMPLATE_TITLE = `Template ${SPEC_TAG}`

// ---------------------------------------------------------------------------
// Fixture state (populated in beforeAll)
// ---------------------------------------------------------------------------

let specSectionId: string
let specItemId: string
let templateId: string

let caseVoidId: string
let caseControlId: string
let phaseVoidId: string

let responseVoidId: string
let responseControlId: string

// ---------------------------------------------------------------------------
// Helpers — mirrors case-corrections.spec.ts / case-void-reopen.spec.ts's own
// local (unexported) scaffolding verbatim, scoped to this file's SPEC_TAG.
// ---------------------------------------------------------------------------

async function getToken(req: APIRequestContext, email: string): Promise<string> {
  const resp = await req.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password: 'Test1234!' },
  })
  expect(resp.ok(), `getToken(${email}) failed: ${resp.status()}`).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

async function svcInsert<T>(req: APIRequestContext, table: string, data: Record<string, unknown>): Promise<T> {
  const resp = await req.post(`${SUPABASE_URL}/rest/v1/${table}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data,
  })
  expect(resp.ok(), `svcInsert(${table}) failed ${resp.status()}: ${await resp.text()}`).toBeTruthy()
  const rows = (await resp.json()) as T[]
  return rows[0]
}

async function svcGet<T>(req: APIRequestContext, path: string): Promise<T[]> {
  const resp = await req.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

async function rpc(req: APIRequestContext, fn: string, bearer: string, body: Record<string, unknown>) {
  return req.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })
}

function slug(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

async function insertChoiceOptions(
  req: APIRequestContext,
  itemId: string,
  formVersionId: string,
  labels: string[],
): Promise<void> {
  for (let i = 0; i < labels.length; i++) {
    await svcInsert(req, 'form_item_options', {
      item_id: itemId,
      form_version_id: formVersionId,
      position: i,
      code: slug(labels[i]),
      label: labels[i],
    })
  }
}

/** Purge any state left by a previous (possibly aborted) run of this suite. */
async function purgeLeftoverState() {
  const { spawnSync } = await import('child_process')

  /**
   * ⛔ FULLY EXPLICIT, dependency-ordered — nothing here relies on an FK's
   * `ON DELETE CASCADE` to do the work, even where one is declared.
   * `session_replication_role = replica` is NOT optional (it is what lets
   * this bypass `guard_case_phase_status_trg` / `guard_case_status_trg` /
   * `guard_published_version_trg` / `guard_published_template_version_trg`
   * — real BEFORE DELETE guards, confirmed against `information_schema.
   * triggers`, that would otherwise correctly refuse to let a completed
   * phase, a published form version, etc. be deleted at all) — but replica
   * mode ALSO disables the internal constraint triggers that implement
   * CASCADE, exactly like the `replica-mode-disables-fk-cascade` class of
   * defect: a declared `ON DELETE CASCADE` does nothing while this is set.
   * Every child table below is therefore deleted by hand, children first.
   *
   * ⚠ THIS is what made the original (5-statement) version fail with ZERO
   * signal: it relied on `cases`/`forms`/`process_templates` cascading to
   * `case_phases`/`process_template_phases`/`form_versions` and friends,
   * which never happened under replica mode — so the LAST statement
   * (`DELETE FROM forms`, still blocked by orphan-in-waiting child rows)
   * failed, and because `psql -c "stmt1; stmt2; …"` sends every statement as
   * ONE simple-query message that Postgres runs as ONE implicit transaction,
   * that single failure rolled back every delete before it in the same
   * batch. The exit-code/stderr check below is what makes that loud instead
   * of silent; this explicit chain is what makes it not happen at all.
   */
  const sql = [
    'SET session_replication_role = replica',
    `DELETE FROM answers WHERE response_id IN (
       SELECT r.id FROM responses r
       JOIN case_phases cp ON cp.id = r.case_phase_id
       JOIN cases c ON c.id = cp.case_id
       WHERE c.label LIKE 'Caso ${SPEC_TAG}%'
     )`,
    `DELETE FROM case_correction_requests WHERE case_id IN (
       SELECT id FROM cases WHERE label LIKE 'Caso ${SPEC_TAG}%'
     )`,
    `DELETE FROM printed_documents WHERE source_id IN (
       SELECT r.id FROM responses r
       JOIN case_phases cp ON cp.id = r.case_phase_id
       JOIN cases c ON c.id = cp.case_id
       WHERE c.label LIKE 'Caso ${SPEC_TAG}%'
     )`,
    `DELETE FROM responses WHERE case_phase_id IN (
       SELECT cp.id FROM case_phases cp
       JOIN cases c ON c.id = cp.case_id
       WHERE c.label LIKE 'Caso ${SPEC_TAG}%'
     )`,
    `DELETE FROM case_phases WHERE case_id IN (
       SELECT id FROM cases WHERE label LIKE 'Caso ${SPEC_TAG}%'
     )`,
    `DELETE FROM cases WHERE label LIKE 'Caso ${SPEC_TAG}%'`,
    // `process_templates` carries NO `title` column at all — it is a bare
    // identity row (id, commission_id, created_by); `title` lives on
    // `process_template_versions` (measured from `information_schema.
    // columns` after `psql` rejected `pt.title does not exist`, not
    // assumed). A temp table materializes the target id set ONCE, before any
    // delete, so the LAST of these three statements does not depend on a
    // `process_template_versions` row a PRIOR statement already removed —
    // the same ordering trap `purge-forms.ts` avoids the same way.
    `CREATE TEMP TABLE _purge_template_ids AS
       SELECT DISTINCT pt.id FROM process_templates pt
       JOIN process_template_versions ptv ON ptv.template_id = pt.id
       WHERE ptv.title = '${TEMPLATE_TITLE}' AND pt.commission_id = '${COMM_A}'`,
    `DELETE FROM process_template_phases WHERE template_version_id IN (
       SELECT id FROM process_template_versions WHERE template_id IN (SELECT id FROM _purge_template_ids)
     )`,
    `DELETE FROM process_template_versions WHERE template_id IN (SELECT id FROM _purge_template_ids)`,
    `DELETE FROM process_templates WHERE id IN (SELECT id FROM _purge_template_ids)`,
    `DELETE FROM form_item_options WHERE form_version_id IN (
       SELECT id FROM form_versions WHERE form_id IN (
         SELECT id FROM forms WHERE title = '${FORM_TITLE}' AND commission_id = '${COMM_A}'
       )
     )`,
    `DELETE FROM form_items WHERE form_version_id IN (
       SELECT id FROM form_versions WHERE form_id IN (
         SELECT id FROM forms WHERE title = '${FORM_TITLE}' AND commission_id = '${COMM_A}'
       )
     )`,
    `DELETE FROM form_sections WHERE form_version_id IN (
       SELECT id FROM form_versions WHERE form_id IN (
         SELECT id FROM forms WHERE title = '${FORM_TITLE}' AND commission_id = '${COMM_A}'
       )
     )`,
    `DELETE FROM form_versions WHERE form_id IN (
       SELECT id FROM forms WHERE title = '${FORM_TITLE}' AND commission_id = '${COMM_A}'
     )`,
    `DELETE FROM forms WHERE title = '${FORM_TITLE}' AND commission_id = '${COMM_A}'`,
    'SET session_replication_role = DEFAULT',
  ].join('; ')

  const result = spawnSync(
    'docker',
    [
      'exec',
      'supabase_db_azkbbhskturikxpgmafq',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ],
    { cwd: process.cwd(), stdio: 'pipe', encoding: 'utf8' },
  )

  // ⛔ A purge that fails silently is WORSE than no purge: it manufactures a
  // belief that state is clean, which is exactly what the NEXT spec file
  // acts on — measured: this is precisely how the missing deletes above went
  // unnoticed. `spawnSync`'s result was never inspected before; a detector
  // that never checks its own outcome cannot fail, so it never did. Assert
  // BOTH the exit code and stderr, not just one — `-v ON_ERROR_STOP=1` is
  // what guarantees a nonzero exit on the first failing statement rather
  // than relying on default psql behaviour for a semicolon-joined `-c` batch.
  expect(
    result.status,
    `purgeLeftoverState: psql exited ${result.status} (signal ${result.signal}) — stderr: ${result.stderr}`,
  ).toBe(0)
  expect(
    (result.stderr ?? '').toLowerCase(),
    `purgeLeftoverState: psql wrote to stderr: ${result.stderr}`,
  ).not.toContain('error')
}

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

test.beforeAll(async ({ request }) => {
  await purgeLeftoverState()

  const chefeToken = await getToken(request, 'chefe.ccih@test.local')
  const staff1Token = await getToken(request, 'staff1.ccih@test.local')

  // 1. Spec-owned form: ONE required multiple_choice item (Sim/Não) — the
  // house minimal shape (case-corrections.spec.ts / case-void-reopen.spec.ts).
  const formRow = await svcInsert<{ id: string }>(request, 'forms', {
    commission_id: COMM_A,
    title: FORM_TITLE,
    description: 'Spec-owned form for pdf-printing-case-currency E2E tests.',
    created_by: UID_CHEFE_A,
  })
  const versionRow = await svcInsert<{ id: string }>(request, 'form_versions', {
    form_id: formRow.id,
    version_number: 1,
    status: 'draft',
    created_by: UID_CHEFE_A,
  })
  const sectionRow = await svcInsert<{ id: string }>(request, 'form_sections', {
    form_version_id: versionRow.id,
    position: 0,
    is_default: true,
    title: null,
  })
  specSectionId = sectionRow.id
  const itemRow = await svcInsert<{ id: string; form_version_id: string }>(request, 'form_items', {
    section_id: specSectionId,
    position: 0,
    item_type: 'multiple_choice',
    question_key: 'inspecao_ok',
    label: 'A inspeção foi aprovada?',
    required: true,
  })
  specItemId = itemRow.id
  await insertChoiceOptions(request, specItemId, itemRow.form_version_id, ['Sim', 'Não'])

  const publishFormResp = await rpc(request, 'publish_form_version', chefeToken, {
    p_form_version_id: versionRow.id,
  })
  expect(publishFormResp.ok(), `publish_form_version failed: ${await publishFormResp.text()}`).toBeTruthy()

  // 2. Spec-owned template: ONE phase-slot on that form. No ruleset, no
  // narrative — this file's subject is print registration/currency, not
  // results or blocking.
  const draftTpl = await createDraftTemplateDirect(
    request,
    { baseUrl: SUPABASE_URL, apikey: SUPABASE_SERVICE_KEY, bearerToken: SUPABASE_SERVICE_KEY },
    {
      commissionId: COMM_A,
      title: TEMPLATE_TITLE,
      description: 'Template criado pela suite pdf-printing-case-currency.spec.ts.',
      createdBy: UID_CHEFE_A,
    },
  )
  templateId = draftTpl.templateId

  const phaseResp = await rpc(request, 'add_template_phase', chefeToken, {
    p_template_version_id: draftTpl.versionId,
    p_form_id: formRow.id,
    p_title: 'Fase 1 — Inspeção',
    p_recommend_when: null,
    p_default_due_days: null,
    p_blocks: [],
    p_result_ruleset: null,
  })
  expect(phaseResp.ok(), `add_template_phase failed: ${await phaseResp.text()}`).toBeTruthy()

  const publishTemplateResp = await rpc(request, 'publish_process_template', chefeToken, {
    p_template_id: templateId,
  })
  expect(
    publishTemplateResp.ok(),
    `publish_process_template failed: ${await publishTemplateResp.text()}`,
  ).toBeTruthy()

  // 3. Two cases from the SAME template — VOID and its un-voided CONTROL sibling.
  async function createCase(label: string): Promise<string> {
    const r = await rpc(request, 'create_case_from_template', chefeToken, {
      p_template_id: templateId,
      p_label: label,
    })
    expect(r.ok(), `create_case_from_template (${label}) failed: ${await r.text()}`).toBeTruthy()
    return ((await r.json()) as { id: string }).id
  }
  caseVoidId = await createCase(`Caso ${SPEC_TAG} — Void`)
  caseControlId = await createCase(`Caso ${SPEC_TAG} — Control`)

  async function getPhaseId(caseId: string): Promise<string> {
    const rows = await svcGet<{ id: string }>(request, `case_phases?case_id=eq.${caseId}&position=eq.1&select=id`)
    expect(rows.length, `phase 1 not found for case ${caseId}`).toBeGreaterThan(0)
    return rows[0].id
  }
  phaseVoidId = await getPhaseId(caseVoidId)
  const phaseControlId = await getPhaseId(caseControlId)

  // 4. Drive BOTH phases to `completed` (assignee staff1, answer "Sim") — this
  // is ALL `file_correction_request` requires of its target (HC0M0 otherwise);
  // no ruleset result is needed for either.
  async function completePhase(phaseId: string): Promise<string> {
    const activateResp = await rpc(request, 'activate_phase', chefeToken, {
      p_case_phase_id: phaseId,
      p_assigned_to: UID_STAFF_1,
    })
    expect(activateResp.ok(), `activate_phase(${phaseId}) failed: ${await activateResp.text()}`).toBeTruthy()

    const startResp = await rpc(request, 'start_or_resume_phase', staff1Token, { p_case_phase_id: phaseId })
    expect(startResp.ok(), `start_or_resume_phase(${phaseId}) failed: ${await startResp.text()}`).toBeTruthy()
    const responseId = ((await startResp.json()) as { id: string }).id

    const saveResp = await rpc(request, 'save_section_answers', staff1Token, {
      p_response_id: responseId,
      p_section_id: specSectionId,
      p_answers: {},
      p_selections: { [specItemId]: [slug('Sim')] },
    })
    expect(saveResp.ok(), `save_section_answers(${responseId}) failed: ${await saveResp.text()}`).toBeTruthy()

    const submitResp = await rpc(request, 'submit_response', staff1Token, { p_response_id: responseId })
    expect(submitResp.ok(), `submit_response(${responseId}) failed: ${await submitResp.text()}`).toBeTruthy()

    return responseId
  }
  responseVoidId = await completePhase(phaseVoidId)
  responseControlId = await completePhase(phaseControlId)

  // Sanity: both phases genuinely completed, bound to the response just built
  // (the `sync_case_phase_on_submit` trigger's own effect — not asserted
  // again in the test body, so the fixture is provably not the reason for
  // whatever the test finds).
  const [voidPhaseRow] = await svcGet<{ status: string; current_response_id: string | null }>(
    request,
    `case_phases?id=eq.${phaseVoidId}&select=status,current_response_id`,
  )
  expect(voidPhaseRow.status).toBe('completed')
  expect(voidPhaseRow.current_response_id).toBe(responseVoidId)
})

test.afterAll(async () => {
  await purgeLeftoverState()
})

// ---------------------------------------------------------------------------
// The corridor
// ---------------------------------------------------------------------------

test('case 5 / D10: a voided phase\'s response stops registering AND stops reading current — the un-voided sibling does neither', async ({
  page,
  browser,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')

  // ── Mint BOTH responses BEFORE anything is voided — both are ordinary,
  // freshly-submitted, phase-bound responses, so both must register and both
  // must read current. This is the shared baseline the differential needs.
  await page.goto(submissionDetailHref(responseVoidId))
  await expect(page.getByRole('button', { name: 'Emitir documento', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Imprimir prévia', exact: true })).toHaveCount(0)
  const voidPrint = await mintViaDialog(page)

  await page.goto(submissionDetailHref(responseControlId))
  await expect(page.getByRole('button', { name: 'Emitir documento', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Imprimir prévia', exact: true })).toHaveCount(0)
  const controlPrint = await mintViaDialog(page)

  // Positive control (both prints, both currently the sole/head print of
  // their own series): the active arm DOES render a currency verdict.
  const voidCtxBefore = await browser.newContext()
  const voidPageBefore = await voidCtxBefore.newPage()
  await voidPageBefore.goto(`/verificar/${voidPrint.shortCode}?via=codigo`)
  await expect(voidPageBefore.getByText('Esta é a revisão atual do documento.', { exact: true })).toBeVisible()
  await voidCtxBefore.close()

  // ── Void VOID's phase via the REAL UI (ADR 0085's mechanism; this file's
  // own subject is only what happens to the print because of it). Locators
  // copied verbatim from case-void-reopen.spec.ts's AC-1, including the
  // deliberate asymmetry between the trigger's and the dialog container's
  // text ("Aprovar anulação" vs. "Aprovar A anulação").
  await page.goto(`${MANAGE_BASE}/${caseVoidId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${caseVoidId}`), { timeout: 15_000 })
  const phaseArticle = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phaseArticle).toBeVisible({ timeout: 10_000 })

  await phaseArticle.getByRole('button', { name: /^Corrigir…/ }).click()
  await page.getByRole('menuitem', { name: /Solicitar anulação/i }).click()
  const voidDialog = page.getByRole('dialog').filter({ hasText: /Solicitar anulação/i })
  await expect(voidDialog).toBeVisible({ timeout: 5_000 })
  await voidDialog.getByLabel(/Motivo/i).fill('Fase registrada em duplicidade — anulação de teste automatizado.')
  await voidDialog.getByRole('button', { name: /^Solicitar anulação$/ }).click()
  await expect(voidDialog).not.toBeVisible({ timeout: 10_000 })

  const correctionsPanel = phaseArticle.getByRole('region', { name: /Solicitações de correção/i })
  const requestCard = correctionsPanel.locator('li').first()
  await expect(requestCard).toBeVisible({ timeout: 10_000 })
  await requestCard.getByRole('button', { name: /Aprovar anulação/i }).click()
  const approveDialog = page.getByRole('alertdialog').filter({ hasText: /Aprovar a anulação/i })
  await expect(approveDialog).toBeVisible({ timeout: 5_000 })
  await approveDialog.getByRole('button', { name: /Aprovar anulação/i }).click()
  await expect(approveDialog).not.toBeVisible({ timeout: 15_000 })
  await expect(phaseArticle.getByText(/^Anulada$/i)).toBeVisible({ timeout: 15_000 })

  // DB truth: the void genuinely completed (not asserted again below — the
  // whole rest of this test asserts its CONSEQUENCE, not its mechanism).
  const [voidedPhaseRow] = await svcGet<{ status: string }>(
    page.request as unknown as APIRequestContext,
    `case_phases?id=eq.${phaseVoidId}&select=status`,
  )
  expect(voidedPhaseRow?.status).toBe('voided')

  // ── REGISTRATION axis (D10, first conjunct), two-sided: VOID's response
  // flips to the ephemeral affordance; CONTROL's does not.
  await page.goto(submissionDetailHref(responseVoidId))
  await expect(page.getByRole('link', { name: 'Imprimir prévia', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Emitir documento', exact: true })).toHaveCount(0)

  await page.goto(submissionDetailHref(responseControlId))
  await expect(page.getByRole('button', { name: 'Emitir documento', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Imprimir prévia', exact: true })).toHaveCount(0)

  // ── CURRENCY axis (D10, second conjunct — derived from the SAME void, a
  // DIFFERENT mechanism than registration per D2's two conjuncts), two-sided
  // via the panel chip AND the public page, both with the sibling contrast.
  await page.goto(submissionDetailHref(responseVoidId))
  await expect(articleForShortCode(page, voidPrint.shortCode).getByText('Revisão anterior', { exact: true })).toBeVisible()

  await page.goto(submissionDetailHref(responseControlId))
  await expect(
    articleForShortCode(page, controlPrint.shortCode).getByText('Revisão anterior', { exact: true }),
  ).toHaveCount(0)

  const voidCtxAfter = await browser.newContext()
  const voidPageAfter = await voidCtxAfter.newPage()
  await voidPageAfter.goto(`/verificar/${voidPrint.shortCode}?via=codigo`)
  await expect(voidPageAfter.getByRole('heading', { name: 'Documento autêntico' })).toBeVisible()
  await expect(
    voidPageAfter.getByText('Documento autêntico — emitido de uma revisão que não é mais a atual.', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(voidPageAfter.getByText('Esta é a revisão atual do documento.', { exact: true })).toHaveCount(0)
  await voidCtxAfter.close()

  const controlCtxAfter = await browser.newContext()
  const controlPageAfter = await controlCtxAfter.newPage()
  await controlPageAfter.goto(`/verificar/${controlPrint.shortCode}?via=codigo`)
  await expect(controlPageAfter.getByText('Esta é a revisão atual do documento.', { exact: true })).toBeVisible()
  await expect(controlPageAfter.getByText(/não é mais a atual/i)).toHaveCount(0)
  await controlCtxAfter.close()

  // No NEW print was minted by anything above — exactly the two rows made
  // right at the start of this test, one per response.
  expect(await printedDocumentRowsFor(page, 'form_response', responseVoidId)).toHaveLength(1)
  expect(await printedDocumentRowsFor(page, 'form_response', responseControlId)).toHaveLength(1)
})

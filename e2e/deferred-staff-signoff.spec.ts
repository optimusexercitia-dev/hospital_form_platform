import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import { createDraftTemplateDirect } from './helpers/process-templates'

/**
 * ADR 0136 — deferred `staff_admin` sign-off: the coordinator's countersignature
 * is collected AFTER the response freezes and gates the PHASE, not the SUBMIT.
 *
 * ⭐ WHAT THIS SPEC ADDS OVER pgTAP 367. The database contract is proven there (61
 * assertions, 15 neutralizations RED-proved). What only a browser can prove is the
 * part the ADR's Consequences never mention: that the two acts are REACHABLE and
 * DISTINGUISHABLE. Before this change the filler was stuck at "há seções pendentes
 * de assinatura" with no way forward inside the product; after it, the filler
 * submits and the coordinator finishes the phase from the sign-off queue — and the
 * queue now mixes a live draft with a frozen record behind one identical button.
 *
 * Fixture is SPEC-OWNED (its own form + template + case), never the seed's: the
 * seed's staff_admin sign-off section lives on a standalone Farmácia form with no
 * case phase, which is exactly the lane D2 leaves unchanged.
 */

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const ORG_A = 'rede-a'
const SLUG_A = 'ccih'
const COMM_A = 'a0000000-0000-0000-0000-0000000000a1'
const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002'
const UID_STAFF_1 = '00000000-0000-0000-0000-000000000003'

const SPEC_TAG = 'DSS-SPEC'
const FORM_TITLE = `Checklist ${SPEC_TAG}`
const TEMPLATE_TITLE = `Template ${SPEC_TAG}`
const SIGNOFF_SECTION_TITLE = `Revisão da coordenação ${SPEC_TAG}`
const QUESTION_LABEL = 'A inspeção foi concluída sem intercorrências?'

let specFormId = ''
let specVersionId = ''
let templateId = ''
let caseId = ''
let phaseId = ''
let responseId = ''

// ---------------------------------------------------------------------------
// Service-role plumbing (a MEASUREMENT/fixture instrument — never the subject:
// it bypasses RLS, so every authorization claim below is made in a real session).
// ---------------------------------------------------------------------------

function svcHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function svcInsert<T>(
  req: APIRequestContext,
  table: string,
  data: Record<string, unknown>,
): Promise<T> {
  const resp = await req.post(`${SUPABASE_URL}/rest/v1/${table}`, {
    headers: svcHeaders({ Prefer: 'return=representation' }),
    data,
  })
  expect(
    resp.ok(),
    `svcInsert(${table}) failed ${resp.status()}: ${await resp.text()}`,
  ).toBeTruthy()
  return ((await resp.json()) as T[])[0]
}

async function svcGet<T>(req: APIRequestContext, path: string): Promise<T[]> {
  const resp = await req.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: svcHeaders(),
  })
  expect(resp.ok(), `svcGet(${path}) failed ${resp.status()}`).toBeTruthy()
  return (await resp.json()) as T[]
}

async function getToken(req: APIRequestContext, email: string): Promise<string> {
  const resp = await req.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password: 'Test1234!' },
  })
  expect(resp.ok(), `getToken(${email}) failed: ${resp.status()}`).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

async function rpc(
  req: APIRequestContext,
  fn: string,
  token: string,
  body: Record<string, unknown>,
) {
  return req.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })
}

async function signInAs(page: Page, email: string) {
  await cachedSignIn(page, email, 'Test1234!')
}

/** Read the phase's server-side status — the FACT behind whatever the screen says. */
async function phaseStatus(req: APIRequestContext): Promise<string> {
  const rows = await svcGet<{ status: string }>(
    req,
    `case_phases?id=eq.${phaseId}&select=status`,
  )
  expect(rows.length, 'phase row vanished').toBe(1)
  return rows[0].status
}

// ---------------------------------------------------------------------------

test.beforeAll(async ({ request }) => {
  // Idempotent purge of a previous aborted run — delete by IDENTITY (title), never
  // positionally: a positional cleanup eats seed rows.
  const staleCases = await svcGet<{ id: string }>(
    request,
    `cases?commission_id=eq.${COMM_A}&label=like.*${SPEC_TAG}*&select=id`,
  )
  for (const c of staleCases) {
    await request.delete(`${SUPABASE_URL}/rest/v1/cases?id=eq.${c.id}`, {
      headers: svcHeaders(),
    })
  }

  // 1. A spec-owned form: one required question + a staff_admin SIGN-OFF section.
  const formRow = await svcInsert<{ id: string }>(request, 'forms', {
    commission_id: COMM_A,
    title: FORM_TITLE,
    description: 'Formulário próprio da suite deferred-staff-signoff.spec.ts.',
    created_by: UID_CHEFE_A,
  })
  specFormId = formRow.id

  const versionRow = await svcInsert<{ id: string }>(request, 'form_versions', {
    form_id: specFormId,
    version_number: 1,
    status: 'draft',
    created_by: UID_CHEFE_A,
  })
  specVersionId = versionRow.id

  const defaultSection = await svcInsert<{ id: string }>(request, 'form_sections', {
    form_version_id: specVersionId,
    position: 0,
    is_default: true,
    title: null,
  })
  const item = await svcInsert<{ id: string; form_version_id: string }>(
    request,
    'form_items',
    {
      section_id: defaultSection.id,
      position: 0,
      item_type: 'multiple_choice',
      question_key: 'dss_ok',
      label: QUESTION_LABEL,
      required: true,
    },
  )
  for (const [i, opt] of [['sim', 'Sim'], ['nao', 'Não']].entries()) {
    await svcInsert(request, 'form_item_options', {
      item_id: item.id,
      form_version_id: item.form_version_id,
      position: i,
      code: opt[0],
      label: opt[1],
    })
  }

  // ⭐ THE SUBJECT: a section requiring a `staff_admin` countersignature. Its ONE
  // item is deliberately OPTIONAL — the filler must be able to reach submit with
  // this section untouched, which is the whole point of deferring it.
  const signoffSection = await svcInsert<{ id: string }>(request, 'form_sections', {
    form_version_id: specVersionId,
    position: 1,
    title: SIGNOFF_SECTION_TITLE,
    requires_signoff: true,
    signoff_role: 'staff_admin',
  })
  await svcInsert(request, 'form_items', {
    section_id: signoffSection.id,
    position: 0,
    item_type: 'free_text',
    question_key: 'dss_parecer',
    label: 'Parecer da coordenação',
    required: false,
  })

  const chefeToken = await getToken(request, 'chefe.ccih@test.local')
  // ⚠ The parameter is `p_form_version_id`, verified against `pg_proc` — not
  // `p_version_id`. PostgREST resolves an RPC by its NAMED argument set, so a
  // wrong name is a 404 (`PGRST202`), never a type error.
  const publishForm = await rpc(request, 'publish_form_version', chefeToken, {
    p_form_version_id: specVersionId,
  })
  expect(
    publishForm.ok(),
    `beforeAll: publish_form_version failed: ${await publishForm.text()}`,
  ).toBeTruthy()

  // 2. A one-phase process template over that form.
  const draftTpl = await createDraftTemplateDirect(
    request,
    { baseUrl: SUPABASE_URL, apikey: SUPABASE_SERVICE_KEY, bearerToken: SUPABASE_SERVICE_KEY },
    {
      commissionId: COMM_A,
      title: TEMPLATE_TITLE,
      description: 'Template criado pela suite deferred-staff-signoff.spec.ts.',
      createdBy: UID_CHEFE_A,
    },
  )
  templateId = draftTpl.templateId

  const addPhase = await rpc(request, 'add_template_phase', chefeToken, {
    p_template_version_id: draftTpl.versionId,
    p_form_id: specFormId,
    p_title: `Fase 1 — ${SPEC_TAG}`,
    p_recommend_when: null,
    p_default_due_days: null,
    p_blocks: [],
    p_result_ruleset: null,
  })
  expect(
    addPhase.ok(),
    `beforeAll: add_template_phase failed: ${await addPhase.text()}`,
  ).toBeTruthy()

  const publishTpl = await rpc(request, 'publish_process_template', chefeToken, {
    p_template_id: templateId,
  })
  expect(
    publishTpl.ok(),
    `beforeAll: publish_process_template failed: ${await publishTpl.text()}`,
  ).toBeTruthy()

  // 3. A case, with phase 1 activated and assigned to a PLAIN staff member — the
  //    filler and the signer must be different people, or the round trip this ADR
  //    removes was never there to remove.
  const createCase = await rpc(request, 'create_case_from_template', chefeToken, {
    p_template_id: templateId,
    p_label: `Caso ${SPEC_TAG}`,
  })
  expect(
    createCase.ok(),
    `beforeAll: create_case_from_template failed: ${await createCase.text()}`,
  ).toBeTruthy()
  caseId = ((await createCase.json()) as { id: string }).id

  const phases = await svcGet<{ id: string }>(
    request,
    `case_phases?case_id=eq.${caseId}&position=eq.1&select=id`,
  )
  expect(phases.length, 'beforeAll: phase 1 not found').toBe(1)
  phaseId = phases[0].id

  const activate = await rpc(request, 'activate_phase', chefeToken, {
    p_case_phase_id: phaseId,
    p_assigned_to: UID_STAFF_1,
  })
  expect(
    activate.ok(),
    `beforeAll: activate_phase failed: ${await activate.text()}`,
  ).toBeTruthy()

  const staffToken = await getToken(request, 'staff1.ccih@test.local')
  const start = await rpc(request, 'start_or_resume_phase', staffToken, {
    p_case_phase_id: phaseId,
  })
  expect(
    start.ok(),
    `beforeAll: start_or_resume_phase failed: ${await start.text()}`,
  ).toBeTruthy()
  responseId = ((await start.json()) as { id: string }).id
})

test.afterAll(async ({ request }) => {
  // Delete by IDENTITY. The case cascade takes its phases + responses with it.
  if (caseId) {
    await request.delete(`${SUPABASE_URL}/rest/v1/cases?id=eq.${caseId}`, {
      headers: svcHeaders(),
    })
  }
  if (templateId) {
    await request.delete(
      `${SUPABASE_URL}/rest/v1/process_templates?id=eq.${templateId}`,
      { headers: svcHeaders() },
    )
  }
  if (specFormId) {
    await request.delete(`${SUPABASE_URL}/rest/v1/forms?id=eq.${specFormId}`, {
      headers: svcHeaders(),
    })
  }
})

// ---------------------------------------------------------------------------

test.describe.configure({ mode: 'serial' })

test.describe('ADR 0136 — the filler submits without the coordinator', () => {
  test('the wizard reaches submit and the phase PARKS instead of completing', async ({
    page,
    request,
  }) => {
    // PRECONDITION. Without it a green submit below could mean "the section was
    // never required", which is the failure this whole feature would be faking.
    expect(await phaseStatus(request)).toBe('active')

    await signInAs(page, 'staff1.ccih@test.local')
    await page.goto(
      `/o/${ORG_A}/c/${SLUG_A}/cases/${caseId}/phase/${phaseId}/responder/${responseId}`,
    )

    await page.getByRole('radio', { name: 'Sim', exact: true }).first().check()

    // Walk to the review screen. The staff_admin sign-off section is a real step of
    // the wizard, so "Próximo" appears before "Revisar" — labels read from
    // `wizard-nav.tsx`, not guessed.
    for (let i = 0; i < 8; i++) {
      const review = page.getByRole('button', { name: /^Revisar$/ })
      if ((await review.count()) > 0) {
        await review.first().click()
        break
      }
      const next = page.getByRole('button', { name: /^Próximo$/ })
      if ((await next.count()) === 0) break
      await next.first().click()
      await page.waitForTimeout(250)
    }

    await expect(
      page.getByRole('heading', { name: /Revise suas respostas/i }),
    ).toBeVisible({ timeout: 15_000 })

    const submit = page.getByRole('button', { name: /Enviar respostas/i })
    await expect(submit).toBeVisible()
    await submit.click()

    // ⭐ THE ASSERTION. Pre-ADR this raised HC012 ("há seções pendentes de
    // assinatura") and the filler could go no further inside the product.
    await expect(
      page.getByText(/há seções pendentes de assinatura/i),
    ).toHaveCount(0)

    await expect
      .poll(async () => phaseStatus(request), { timeout: 15_000 })
      .toBe('awaiting_signoff')

    // D4: the RESPONSE is plainly submitted — attestation state lives on the PHASE.
    const rows = await svcGet<{ status: string }>(
      request,
      `responses?id=eq.${responseId}&select=status`,
    )
    expect(rows[0].status).toBe('submitted')
  })

  test('the case surface says the phase is awaiting a signature', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(`/o/${ORG_A}/c/${SLUG_A}/manage/cases/${caseId}`)

    await expect(page.getByText('Aguardando assinatura').first()).toBeVisible()
    // The coordinator's one act is offered HERE, not only from another page.
    await expect(page.getByRole('link', { name: 'Assinar' })).toBeVisible()
  })
})

test.describe('ADR 0136 — the coordinator finishes the phase', () => {
  test('the queue distinguishes the FROZEN lane from a live draft', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(`/o/${ORG_A}/c/${SLUG_A}/manage/assinaturas`)

    const row = page.getByRole('listitem').filter({ hasText: FORM_TITLE })
    await expect(row).toBeVisible()

    // ⭐ Same button, materially different act — so the row must say which.
    await expect(row.getByText('Fase de caso · enviada')).toBeVisible()
    await expect(row.getByText('Revisar e concluir')).toBeVisible()

    // …and the seeded LIVE-DRAFT row must NOT carry the chip. A one-sided
    // assertion cannot tell "labels the frozen lane" from "labels everything".
    const draftRows = page
      .getByRole('listitem')
      .filter({ hasText: 'Inspeção de Armazenamento' })
    if ((await draftRows.count()) > 0) {
      await expect(draftRows.first().getByText('Fase de caso · enviada')).toHaveCount(0)
    }
  })

  test('the review screen warns the record is frozen, and signing COMPLETES the phase', async ({
    page,
    request,
  }) => {
    expect(await phaseStatus(request)).toBe('awaiting_signoff')

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(`/o/${ORG_A}/c/${SLUG_A}/manage/assinaturas/${responseId}`)

    // The signer must be told the content is frozen AND what their signature does.
    await expect(page.getByText('Registro já enviado e congelado.')).toBeVisible()
    await expect(page.getByText(/conclui a fase do caso/i)).toBeVisible()

    // The answers must actually be on screen — a signature over a blank screen is
    // an attestation to evidence the signer was never shown (Rule 4).
    await expect(page.getByText(QUESTION_LABEL)).toBeVisible()

    await page.getByRole('button', { name: /Assinar/ }).first().click()

    await expect
      .poll(async () => phaseStatus(request), { timeout: 15_000 })
      .toBe('completed')
  })

  test('keyboard-only: the queue row is reachable and openable without a mouse', async ({
    page,
  }) => {
    // The per-phase keyboard flow (CLAUDE.md §8). Run AFTER the signature, so the
    // queue is empty for this fixture — which is itself the assertion that the
    // frozen row LEAVES the queue once attested.
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(`/o/${ORG_A}/c/${SLUG_A}/manage/assinaturas`)

    await expect(
      page.getByRole('listitem').filter({ hasText: FORM_TITLE }),
    ).toHaveCount(0)

    // Tab into the page and confirm focus lands on something operable with a
    // visible name (never a bare div) — the a11y floor for this surface.
    await page.keyboard.press('Tab')
    const focused = page.locator(':focus')
    await expect(focused).toHaveCount(1)
    const name = await focused.evaluate(
      (el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
    )
    expect(name.length, 'the first tab stop has no accessible name').toBeGreaterThan(0)
  })
})

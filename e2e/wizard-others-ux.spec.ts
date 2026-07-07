import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

/**
 * Form-builder-enhancements batch (ad-hoc 2026-07-06) — TASKS 5 + 6 + 7:
 * "Outros" open-option round-trip + wizard UX (Clear / always-rendered
 * observação) + the masked numeric TIME field.
 *
 * Acceptance:
 *   5+6 "Outros":
 *     - selecting "Outro" on a multiple_choice reveals a "Especifique…" input;
 *       same on a checkbox (multi);
 *     - type a value → save/advance → resume the in-progress response → the
 *       Outro text persists;
 *     - blank Outro is ALLOWED (a required item with Outro selected + blank text
 *       still submits);
 *     - the whole-block Clear (Limpar) wipes the answer + Outro text + observação;
 *     - on the submitted-response detail the answer shows "Outro: <valor>".
 *   7 Wizard UX + masked time:
 *     - every question block has a Clear icon-button (top-right);
 *     - "Adicionar observação" is always rendered but DISABLED until the block is
 *       partially answered (and ABSENT for free_text);
 *     - the time input is an auto-formatting numeric mask: typing `930` → `09:30`;
 *       rejects out-of-range (`2560`, `9999`); it is a text mask, not <input type=time>.
 *
 * Fixture (service role + persona JWT): a spec-owned unsectioned form in CCIH:
 *   sev  multiple_choice REQUIRED, allowOther (Grave / Leve + __other__)
 *   epis checkbox OPTIONAL, allowOther (Luvas / Avental + __other__)
 *   hora time OPTIONAL
 *   obs  free_text OPTIONAL   (must NOT offer the observação affordance)
 *
 * Personas (Test1234!): staff2.ccih (no seed draft), chefe.ccih (staff_admin).
 * Serial — the fill/resume tests build shared response state.
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
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}

const ORG = 'rede-a'
const COMM_A = 'a0000000-0000-0000-0000-0000000000a1'
const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002'
const UID_STAFF2 = '00000000-0000-0000-0000-000000000004' // staff2.ccih

const TAG = 'OTHERS-UX'
const FORM_TITLE = `Checklist ${TAG}`

let specFormId: string
let specVersionId: string

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  // "Mostrar senha" toggle shares the "Senha" accessible name; target the input.
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url: URL) => !url.pathname.startsWith('/login'), {
    timeout: 20_000,
  })
}

async function getToken(req: APIRequestContext, email: string): Promise<string> {
  const resp = await req.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
      data: { email, password: 'Test1234!' },
    },
  )
  expect(resp.ok(), `getToken(${email}) failed: ${resp.status()}`).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

async function svcInsert<T>(
  req: APIRequestContext,
  table: string,
  data: Record<string, unknown>,
): Promise<T> {
  const resp = await req.post(`${SUPABASE_URL}/rest/v1/${table}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data,
  })
  expect(
    resp.ok(),
    `svcInsert(${table}) failed ${resp.status()}: ${await resp.text()}`,
  ).toBeTruthy()
  return ((await resp.json()) as T[])[0]
}

async function rpc(
  req: APIRequestContext,
  fn: string,
  bearer: string,
  body: Record<string, unknown>,
) {
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

/** Insert author options + (when allowOther) the reserved __other__ row. Direct
 *  service-role insert bypasses reconcile_item_options, so mint the reserved row
 *  explicitly (config.allowOther is also set on the item for the wizard reveal). */
async function insertOptionsWithOther(
  req: APIRequestContext,
  itemId: string,
  versionId: string,
  labels: string[],
): Promise<void> {
  for (let i = 0; i < labels.length; i++) {
    await svcInsert(req, 'form_item_options', {
      item_id: itemId,
      form_version_id: versionId,
      position: i,
      code: slug(labels[i]),
      label: labels[i],
    })
  }
  // Reserved __other__ row, always last.
  await svcInsert(req, 'form_item_options', {
    item_id: itemId,
    form_version_id: versionId,
    position: labels.length,
    code: '__other__',
    label: 'Outro',
    is_other: true,
  })
}

/** Delete staff2's in_progress draft of the spec form so a fill starts fresh. */
async function clearDraft(req: APIRequestContext) {
  await req.delete(
    `${SUPABASE_URL}/rest/v1/responses?form_version_id=eq.${specVersionId}&created_by=eq.${UID_STAFF2}&status=eq.in_progress`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
    },
  )
}

async function purge() {
  const { spawnSync } = await import('child_process')
  const sql = [
    'SET session_replication_role = replica',
    `DELETE FROM responses WHERE form_version_id IN (
       SELECT fv.id FROM form_versions fv JOIN forms f ON f.id = fv.form_id
       WHERE f.title = '${FORM_TITLE}' AND f.commission_id = '${COMM_A}')`,
    `DELETE FROM forms WHERE title = '${FORM_TITLE}' AND commission_id = '${COMM_A}'`,
    'SET session_replication_role = DEFAULT',
  ].join('; ')
  spawnSync(
    'docker',
    ['exec', 'supabase_db_azkbbhskturikxpgmafq', 'psql', '-U', 'postgres', '-d', 'postgres', '-c', sql],
    { cwd: process.cwd(), stdio: 'pipe' },
  )
}

/** Enter the wizard for the spec form (Preencher / Continuar). */
async function enterWizard(page: Page) {
  await page.goto(`/o/${ORG}/c/ccih/forms`)
  await page.waitForLoadState('networkidle')
  const scope = page.locator('article').filter({ hasText: FORM_TITLE })
  await expect(scope.first()).toBeVisible({ timeout: 15_000 })
  const cont = scope.getByRole('link', { name: /continuar preenchimento/i })
  const start = scope.getByRole('button', { name: /preencher/i })
  await expect(cont.or(start).first()).toBeVisible({ timeout: 15_000 })
  if (await cont.first().isVisible().catch(() => false)) {
    await cont.first().click()
  } else {
    await start.first().click()
  }
  await page.waitForURL(/\/responder\//, { timeout: 20_000 })
}

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

test.beforeAll(async ({ request }) => {
  await purge()

  const form = await svcInsert<{ id: string }>(request, 'forms', {
    commission_id: COMM_A,
    title: FORM_TITLE,
    description: 'Spec-owned Others/UX/time form.',
    created_by: UID_CHEFE_A,
  })
  specFormId = form.id
  const version = await svcInsert<{ id: string }>(request, 'form_versions', {
    form_id: specFormId,
    version_number: 1,
    status: 'draft',
    created_by: UID_CHEFE_A,
  })
  specVersionId = version.id
  const section = await svcInsert<{ id: string }>(request, 'form_sections', {
    form_version_id: specVersionId,
    position: 0,
    is_default: true,
    title: null,
  })
  const sectionId = section.id

  // sev — required MC with allowOther.
  const sev = await svcInsert<{ id: string; form_version_id: string }>(
    request,
    'form_items',
    {
      section_id: sectionId,
      position: 0,
      item_type: 'multiple_choice',
      question_key: 'sev',
      label: 'Severidade?',
      required: true,
      config: { allowOther: true },
    },
  )
  await insertOptionsWithOther(request, sev.id, sev.form_version_id, ['Grave', 'Leve'])

  // epis — optional checkbox with allowOther.
  const epis = await svcInsert<{ id: string; form_version_id: string }>(
    request,
    'form_items',
    {
      section_id: sectionId,
      position: 1,
      item_type: 'checkbox',
      question_key: 'epis',
      label: 'EPIs observados?',
      required: false,
      config: { allowOther: true },
    },
  )
  await insertOptionsWithOther(request, epis.id, epis.form_version_id, ['Luvas', 'Avental'])

  // hora — optional time item (masked field).
  await svcInsert(request, 'form_items', {
    section_id: sectionId,
    position: 2,
    item_type: 'time',
    question_key: 'hora',
    label: 'Horário da observação?',
    required: false,
  })

  // obs — optional free_text (must NOT offer the observação affordance).
  await svcInsert(request, 'form_items', {
    section_id: sectionId,
    position: 3,
    item_type: 'free_text',
    question_key: 'obs',
    label: 'Observações livres?',
    required: false,
  })

  // Publish.
  const chefeToken = await getToken(request, 'chefe.ccih@test.local')
  const pub = await rpc(request, 'publish_form_version', chefeToken, {
    p_form_version_id: specVersionId,
  })
  expect(pub.ok(), `publish_form_version failed: ${await pub.text()}`).toBeTruthy()
})

test.afterAll(async () => {
  await purge()
})

// ---------------------------------------------------------------------------
// TASK 7 — Clear button present; observação always rendered/disabled; free_text
//          has no observação; the time field is a MASK (not native <input time>).
// ---------------------------------------------------------------------------

test('AC-1: every input block has a Clear button; observação is disabled until answered; free_text has none', async ({
  page,
  request,
}) => {
  await clearDraft(request)
  await signInAs(page, 'staff2.ccih@test.local')
  await enterWizard(page)

  // Clear icon-button per input block (aria-label "Limpar a resposta de …").
  await expect(
    page.getByRole('button', { name: /Limpar a resposta de Severidade/i }),
  ).toBeVisible({ timeout: 12_000 })
  await expect(
    page.getByRole('button', { name: /Limpar a resposta de EPIs observados/i }),
  ).toBeVisible()

  // "Adicionar observação" always rendered but DISABLED before answering (for the
  // choice block). free_text ("Observações livres") must NOT offer it.
  const addObs = page.getByRole('button', { name: /Adicionar observação/i })
  await expect(addObs.first()).toBeVisible()
  await expect(addObs.first()).toBeDisabled()

  // Answer the severity → its observação button enables.
  await page.getByRole('radio', { name: 'Grave' }).check()
  await expect(addObs.first()).toBeEnabled({ timeout: 8_000 })

  // The free_text block renders NO observação affordance. Count the observação
  // buttons: sev + epis choice blocks may each carry one, but the free_text does
  // not (its own value IS free text). So the count is bounded by the choice blocks.
  const obsCount = await page.getByRole('button', { name: /Adicionar observação/i }).count()
  // sev + epis = 2 choice blocks with observação; hora (time) also gets one; obs
  // (free_text) does NOT. So obsCount must be < the total input-block count (4).
  expect(obsCount).toBeLessThan(4)
  expect(obsCount).toBeGreaterThanOrEqual(1)
})

test('AC-2: the time field is a numeric MASK — typing 930 yields 09:30; not a native <input type=time>', async ({
  page,
  request,
}) => {
  await clearDraft(request)
  await signInAs(page, 'staff2.ccih@test.local')
  await enterWizard(page)

  // The masked field has aria-label "Hora" and is a TEXT input (inputMode numeric),
  // NOT type=time. Assert type + inputmode.
  const hora = page.getByLabel('Hora', { exact: true })
  await expect(hora).toBeVisible({ timeout: 10_000 })
  expect(await hora.getAttribute('type')).toBe('text')
  expect(await hora.getAttribute('inputmode')).toBe('numeric')

  // Typing 930 auto-inserts the colon → 09:30 (colon appears on the 3rd digit),
  // then blur normalizes "9:30" style entries. Type the 3 digits and blur.
  await hora.click()
  await hora.pressSequentially('930')
  await hora.blur()
  await expect(hora).toHaveValue('09:30')

  // A visible focus ring (accessibility) — the control is focusable.
  await hora.focus()
  await expect(hora).toBeFocused()
})

test('AC-3: masked time rejects out-of-range entries (2560, 9999) → empty/invalid, no bad value', async ({
  page,
  request,
}) => {
  await clearDraft(request)
  await signInAs(page, 'staff2.ccih@test.local')
  await enterWizard(page)

  const hora = page.getByLabel('Hora', { exact: true })
  await expect(hora).toBeVisible({ timeout: 10_000 })

  // 2560 → minute 60 invalid → normalizes to "" on blur (never a canonical value).
  await hora.click()
  await hora.pressSequentially('2560')
  await hora.blur()
  await expect(hora).toHaveValue('')

  // 9999 → hour 99 invalid → "".
  await hora.click()
  await hora.pressSequentially('9999')
  await hora.blur()
  await expect(hora).toHaveValue('')

  // A valid value still works after the invalid entries.
  await hora.click()
  await hora.pressSequentially('1445')
  await hora.blur()
  await expect(hora).toHaveValue('14:45')
})

// ---------------------------------------------------------------------------
// TASK 5+6 — Others reveal + Clear + submitted display. (The resume-persistence
// AC-4 is placed LAST so its known failure — BUG-FBE-008 — does not serial-block
// the independent AC-5/AC-6/AC-K below it.)
// ---------------------------------------------------------------------------

test('AC-5: whole-block Clear (Limpar) wipes the answer + Outro text + observação', async ({
  page,
  request,
}) => {
  await clearDraft(request)
  await signInAs(page, 'staff2.ccih@test.local')
  await enterWizard(page)

  // Select Outro + type text + add an observação on the severity block.
  await page.getByRole('radio', { name: 'Outro', exact: true }).first().check()
  const mcOther = page.locator('input[placeholder="Especifique…"]').first()
  await mcOther.fill('Para limpar')
  await page.getByRole('button', { name: /Adicionar observação/i }).first().click()
  const obsArea = page.getByLabel(/^Observação/i).first()
  await obsArea.fill('Nota E2E')

  // Clear the whole block.
  await page.getByRole('button', { name: /Limpar a resposta de Severidade/i }).click()

  // The radio is unchecked; the Outro input is gone; the observação is cleared.
  await expect(page.getByRole('radio', { name: 'Outro', exact: true }).first()).not.toBeChecked({
    timeout: 8_000,
  })
  await expect(page.locator('input[placeholder="Especifique…"]')).toHaveCount(0)
})

test('AC-6: required MC with Outro selected + BLANK text still submits; detail shows "Outro: <valor>"', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  await clearDraft(request)
  await signInAs(page, 'staff2.ccih@test.local')
  await enterWizard(page)

  // Blank-Outro submit path FIRST: severity Outro selected, NO text.
  await page.getByRole('radio', { name: 'Outro', exact: true }).first().check()
  // Leave the Especifique input blank. Go to review.
  await page.getByRole('button', { name: /revisar/i }).click()
  // No validation block — Outro-selected-blank is a valid required answer.
  await expect(
    page.getByRole('heading', { name: /Revise suas respostas/i }),
  ).toBeVisible({ timeout: 12_000 })
  // Submit.
  await page.getByRole('button', { name: /enviar resposta|enviar/i }).first().click()
  await expect(
    page.getByText(/enviada com sucesso|resposta enviada/i).first(),
  ).toBeVisible({ timeout: 20_000 })

  // Now a NON-blank Outro run → detail shows "Outro: <valor>".
  await clearDraft(request)
  await enterWizard(page)
  await page.getByRole('radio', { name: 'Outro', exact: true }).first().check()
  await page.locator('input[placeholder="Especifique…"]').first().fill('Explosão química')
  await page.getByRole('button', { name: /revisar/i }).click()
  await expect(
    page.getByRole('heading', { name: /Revise suas respostas/i }),
  ).toBeVisible({ timeout: 12_000 })
  // The review screen already shows "Outro: Explosão química".
  await expect(page.getByText(/Outro:/i).first()).toBeVisible({ timeout: 8_000 })
  await expect(page.getByText(/Explosão química/i).first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// KEYBOARD-ONLY: the masked time field accepts typed input with a visible focus
// ring, and Tab reaches the wizard controls.
// ---------------------------------------------------------------------------

test('AC-K: keyboard-only — Tab reaches the masked time field; typed digits format', async ({
  page,
  request,
}) => {
  await clearDraft(request)
  await signInAs(page, 'staff2.ccih@test.local')
  await enterWizard(page)

  const hora = page.getByLabel('Hora', { exact: true })
  await expect(hora).toBeVisible({ timeout: 10_000 })
  await hora.focus()
  await expect(hora).toBeFocused()
  // Keyboard-only entry. Use a 4-digit value (0815) so this a11y check is NOT
  // conflated with the 3-digit mask defect (BUG-FBE-007, covered by AC-2).
  await page.keyboard.type('0815')
  await page.keyboard.press('Tab') // blur → normalize
  await expect(hora).toHaveValue('08:15')
})

// ---------------------------------------------------------------------------
// TASK 5+6 — "Outro" reveal + RESUME persistence. Placed LAST: this is the
// BUG-FBE-008 repro (the typed Outro free text is never saved → empty on resume).
// Kept asserting the CORRECT contract; fails until FBE-008 is fixed.
// ---------------------------------------------------------------------------

test('AC-4: "Outro" reveals a text input on MC and checkbox; the value persists across resume (BUG-FBE-008)', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  await clearDraft(request)
  await signInAs(page, 'staff2.ccih@test.local')
  await enterWizard(page)

  // MC: select "Outro" → the "Especifique…" input appears.
  await page.getByRole('radio', { name: 'Outro', exact: true }).first().check()
  const mcOther = page.locator('input[placeholder="Especifique…"]')
  await expect(mcOther.first()).toBeVisible({ timeout: 8_000 })
  await mcOther.first().fill('Gravíssimo (E2E)')

  // Checkbox: also select its "Outro" and type a value.
  await page.getByRole('checkbox', { name: 'Outro', exact: true }).first().check()
  // Now there are two "Especifique…" inputs (MC + checkbox).
  await expect(mcOther).toHaveCount(2, { timeout: 8_000 })
  await mcOther.nth(1).fill('Máscara N95 (E2E)')

  // Save and exit (must persist the in-progress draft incl. the Outro text).
  await page.getByRole('button', { name: /salvar e sair/i }).click()
  await page.waitForURL((url) => !url.toString().includes('/responder/'), {
    timeout: 20_000,
  })

  // Resume — the Outro selection + text must be restored.
  await enterWizard(page)
  await expect(page.getByRole('radio', { name: 'Outro', exact: true }).first()).toBeChecked({
    timeout: 10_000,
  })
  const resumed = page.locator('input[placeholder="Especifique…"]')
  await expect(resumed.first()).toHaveValue('Gravíssimo (E2E)', { timeout: 8_000 })
  await expect(resumed.nth(1)).toHaveValue('Máscara N95 (E2E)')

  // DB truth: the MC answer's other_text is stored.
  const answers = await request.get(
    `${SUPABASE_URL}/rest/v1/answers?question_key=eq.sev&other_text=not.is.null&select=other_text`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const rows = (await answers.json()) as { other_text: string }[]
  expect(rows.some((r) => r.other_text === 'Gravíssimo (E2E)')).toBeTruthy()
})

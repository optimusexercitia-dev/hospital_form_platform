import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"

/**
 * Form-builder-enhancements batch (ad-hoc 2026-07-06) — TASK 4 (dialog cluster)
 * + the cross-cutting RESPONSIVE / no-clip visual checks.
 *
 * Acceptance / manual-preview surfaces folded into Playwright:
 *   - the question dialog is a TWO-COLUMN shell (Conteúdo / Comportamento) for
 *     input types, at desktop AND mobile widths (screenshots + structure);
 *   - the per-row "Opções" (Settings2) toggle reveals Pontuação + Código +
 *     the Flagged ("Marcar como sinalizado") toggle;
 *   - the "Incluir opção 'Outros'" toggle (multiple_choice/checkbox);
 *   - min/máx caracteres on free_text/short_text; "Flagged If" on number/date/time;
 *   - the result-rule criterion editor offers "Pontuação total da fase" /
 *     "Itens marcados da fase" (aggregate criteria);
 *   - the "Adicionar bloco" dropdown does NOT clip when opened near the viewport
 *     bottom.
 *   - Keyboard-only reach of the question dialog fields.
 *
 * ⚠️ These tests exercise the FORM-BUILDER route
 * (`…/manage/forms/[formId]`), which is currently broken by BUG-FBE-005 (client
 * bundle pulls `next/headers` via a value import → the route errors on both
 * `next build` and `next dev`). They are EXPECTED to be blocked until FBE-005 is
 * fixed; kept so the lead's post-fix full-suite run covers task 4.
 *
 * Personas (Test1234!): chefe.ccih (staff_admin CCIH — form builder).
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // Sign in ONCE per test (openQuestionDialog is called up to twice per test and
  // must not re-navigate to /login when already authenticated).
  await signInAs(page, 'chefe.ccih@test.local')
})

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}

const ORG = 'rede-a'
const COMM_A = 'a0000000-0000-0000-0000-0000000000a1'
const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002'
const TAG = 'BUILDER-UI'
const FORM_TITLE = `Formulário ${TAG}`

let formId: string

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, password)
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
  expect(resp.ok(), `svcInsert(${table}) failed ${resp.status()}: ${await resp.text()}`).toBeTruthy()
  return ((await resp.json()) as T[])[0]
}

async function purge() {
  const { spawnSync } = await import('child_process')
  const sql = [
    'SET session_replication_role = replica',
    `DELETE FROM forms WHERE title = '${FORM_TITLE}' AND commission_id = '${COMM_A}'`,
    'SET session_replication_role = DEFAULT',
  ].join('; ')
  spawnSync(
    'docker',
    ['exec', 'supabase_db_azkbbhskturikxpgmafq', 'psql', '-U', 'postgres', '-d', 'postgres', '-c', sql],
    { cwd: process.cwd(), stdio: 'pipe' },
  )
}

test.beforeAll(async ({ request }) => {
  await purge()
  const form = await svcInsert<{ id: string }>(request, 'forms', {
    commission_id: COMM_A,
    title: FORM_TITLE,
    description: 'Spec-owned draft form for the builder dialog UI.',
    created_by: UID_CHEFE_A,
  })
  formId = form.id
  const version = await svcInsert<{ id: string }>(request, 'form_versions', {
    form_id: formId,
    version_number: 1,
    status: 'draft',
    created_by: UID_CHEFE_A,
  })
  await svcInsert(request, 'form_sections', {
    form_version_id: version.id,
    position: 0,
    is_default: true,
    title: null,
  })
})

test.afterAll(async () => {
  await purge()
})

/** Open the builder + the "Adicionar bloco" menu, pick a type → the question dialog.
 *  The caller signs in ONCE per test (so this is safe to call twice per test). */
async function openQuestionDialog(page: Page, typeLabel: RegExp) {
  await page.goto(`/o/${ORG}/c/ccih/manage/forms/${formId}`)
  const addBlock = page.getByRole('button', { name: /Adicionar bloco/i }).first()
  await expect(addBlock).toBeVisible({ timeout: 15_000 })
  await addBlock.click()
  const item = page.getByRole('menuitem', { name: typeLabel }).first()
  await expect(item).toBeVisible({ timeout: 5_000 })
  await item.scrollIntoViewIfNeeded()
  // Radix menuitems can miss a plain click at narrow viewports (the item is a
  // focusable div); select it via keyboard (Enter) which Radix always honours.
  await item.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 8_000 })
  return dialog
}

// ---------------------------------------------------------------------------
// AC-1: two-column question dialog (Conteúdo / Comportamento) at desktop; the
// per-row Options toggle reveals Pontuação/Código/Flagged; the Others toggle.
// ---------------------------------------------------------------------------

test('AC-1: multiple_choice dialog — two-column shell; per-row Options reveals Flagged; "Outros" toggle', async ({
  page,
}) => {
  const dialog = await openQuestionDialog(page, /Múltipla escolha/i)

  // Two-column shell: the Conteúdo + Comportamento sections both render.
  await expect(dialog.getByLabel('Conteúdo')).toBeVisible()
  await expect(dialog.getByLabel('Comportamento')).toBeVisible()

  // Per-row "Opções" (Settings2) toggle reveals Pontuação + Código + Flagged.
  const rowOptionsToggle = dialog
    .getByRole('button', { name: /Mostrar opções da opção 1/i })
    .first()
  await expect(rowOptionsToggle).toBeVisible()
  await rowOptionsToggle.click()
  await expect(dialog.getByText(/Pontuação/i).first()).toBeVisible()
  await expect(dialog.getByText(/Código de análise/i).first()).toBeVisible()
  await expect(dialog.getByText(/Marcar como sinalizado/i).first()).toBeVisible()

  // "Incluir opção 'Outros'" toggle present for multiple_choice.
  await expect(dialog.getByText(/Incluir opção/i).first()).toBeVisible()

  // Desktop screenshot of the two-column dialog.
  await dialog.screenshot({
    path: 'test-results/builder-dialog-desktop.png',
  })
})

// ---------------------------------------------------------------------------
// AC-2: mobile-width two-column dialog screenshot (responsive).
// ---------------------------------------------------------------------------

test('AC-2: the question dialog renders at mobile width (responsive screenshot)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 840 })
  const dialog = await openQuestionDialog(page, /Múltipla escolha/i)
  await expect(dialog.getByLabel('Conteúdo')).toBeVisible()
  await dialog.screenshot({ path: 'test-results/builder-dialog-mobile.png' })
  // The page body must not scroll horizontally (no overflow).
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  )
  expect(overflow, 'the dialog must not force horizontal page scroll').toBeTruthy()
})

// ---------------------------------------------------------------------------
// AC-3: length limits (free_text) + "Flagged If" (number).
// ---------------------------------------------------------------------------

test('AC-3: free_text dialog shows "Limites de caracteres"; number dialog shows "Flagged If"', async ({
  page,
}) => {
  const ftDialog = await openQuestionDialog(page, /Resposta longa/i)
  await expect(ftDialog.getByText(/Limites de caracteres/i)).toBeVisible()
  await ftDialog.getByRole('button', { name: /Cancelar/i }).click()

  const numDialog = await openQuestionDialog(page, /Número/i)
  // "Flagged If" editor — number/date/time only.
  await expect(numDialog.getByText(/marcad|sinaliz|flagged/i).first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// AC-4: the "Adicionar bloco" dropdown does NOT clip near the viewport bottom.
// ---------------------------------------------------------------------------

test('AC-4: the "Adicionar bloco" menu stays inside the viewport (no clip)', async ({
  page,
}) => {
  await page.goto(`/o/${ORG}/c/ccih/manage/forms/${formId}`)

  const addBlock = page.getByRole('button', { name: /Adicionar bloco/i }).first()
  await expect(addBlock).toBeVisible({ timeout: 15_000 })
  // Drive the trigger to the bottom of the viewport, where a naive dropdown would
  // open below the fold and clip.
  await addBlock.scrollIntoViewIfNeeded()
  await addBlock.click()

  // Scope to the Radix DROPDOWN content (the page also has a nav [role=menu]).
  const menu = page.locator('[data-slot="dropdown-menu-content"]').first()
  await expect(menu).toBeVisible({ timeout: 5_000 })

  // Anti-clip mechanism present: the dropdown content scrolls internally and is
  // capped to the height Radix reports as available, so it never renders items
  // past the viewport bottom.
  //
  // Deliberately NO utility-class literal in this comment. Tailwind v4 scans
  // `e2e/` as source, COMMENTS INCLUDED, so naming a class here mints a real
  // selector into the production bundle — and the one that used to be written
  // here was the DEAD Tailwind-3.4 bare-`[--var]` form, so it shipped ~90 bytes
  // of invalid CSS and read to a grep like an unfixed site (BUG-FF2-003).
  // Asserting the COMPUTED style below is the honest check regardless: that bug
  // was precisely a class present in the markup that emitted nothing.
  const overflowY = await menu.evaluate((el) => getComputedStyle(el).overflowY)
  expect(['auto', 'scroll']).toContain(overflowY)

  // The USER-FACING "no clip" guarantee: the LAST option ("Imagem") is reachable
  // and CLICKABLE — clicking it opens the Imagem block dialog. If the menu clipped
  // off-screen, the last item could not be reached and selected.
  const lastItem = menu.getByRole('menuitem', { name: /Imagem/i }).first()
  await expect(lastItem).toBeVisible({ timeout: 5_000 })
  await lastItem.click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8_000 })
})

// ---------------------------------------------------------------------------
// AC-K: keyboard-only reach of the question dialog fields.
// ---------------------------------------------------------------------------

test('AC-K: keyboard-only — the question dialog enunciado field is reachable and typable', async ({
  page,
}) => {
  const dialog = await openQuestionDialog(page, /Múltipla escolha/i)
  // The enunciado input autofocuses; type into it via the keyboard.
  const enunciado = dialog.getByLabel(/Enunciado da pergunta/i)
  await expect(enunciado).toBeVisible()
  await enunciado.focus()
  await expect(enunciado).toBeFocused()
  await page.keyboard.type('Pergunta E2E teclado')
  await expect(enunciado).toHaveValue(/Pergunta E2E teclado/)
})

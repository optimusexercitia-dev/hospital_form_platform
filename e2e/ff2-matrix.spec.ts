import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { test, expect, type Page, type Locator } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"
import { purgeFormsByTag } from './helpers/purge-forms'

/**
 * FF-2 — Matrix & Risk Matrix (ADR 0089, four PO rulings). Acceptance criteria
 * translated from the ADR's four rulings + §Gate keystones:
 *
 *   FF2-1 (ruling 1 + the BUG-FF2-001 seam): a matrix authored FROM SCRATCH
 *         through "Adicionar bloco" → axes dialog → publish → fill. Each row
 *         takes exactly one column; a second column on the same row REPLACES
 *         the first, never adds. Review renders the grid; submit persists one
 *         cell per row.
 *   FF2-2 (ruling 2): a risk_matrix authored from scratch with 1/3/9 weights
 *         and score bands; grave × provável shows 27 + "Alto" and the DB stores
 *         risk_score = 27 — DERIVED, never sent.
 *   FF2-3 (ruling 3): required = ROW-COMPLETE. A partial grid blocks submit in
 *         the UI with "Responda todas as linhas desta matriz." AND is refused
 *         by `submit_response` itself; completing it clears both. Also: a risk
 *         matrix with NO `config.riskBands` shows the score and no band chip.
 *   FF2-4 (ruling 3, deadlock-negative): a required matrix hidden by its own
 *         condition requires nothing — UI submits, `submit_response` accepts,
 *         no cells are written.
 *   FF2-5 (ruling 4): axis codes survive relabel and survive publish → clone.
 *         Weights survive the clone. The source version is untouched. The
 *         editor offers no re-key affordance at all.
 *   FF2-6 (FF-1 substrate): a matrix INSIDE a repeating group answers per
 *         instance, and an instance whose ONLY content is a matrix answer
 *         survives submit (ADR 0089 §A — `app.instance_is_empty`).
 *   FF2-7 (keyboard-only, CLAUDE.md §8): the grid is one native radio group per
 *         row — Tab walks rows, arrows walk the scale — driven end to end with
 *         no mouse.
 *   FF2-8 (server authority): the canonical `save_section_answers` path refuses
 *         a half-answered risk matrix (HC0P8) and an unknown axis code (HC0P7),
 *         and ignores a client-supplied `risk_score`.
 *
 * ## The `riskBands` decision (stated deliberately)
 *
 * The SEEDED `matriz_risco` carries weights but **no `config.riskBands`** — so
 * it shows "Pontuação: 27" with no band chip. Rather than assert a band label
 * against a form that has none (a spec that reads like it tests banding while
 * testing nothing), this file covers BOTH halves against its own fixtures:
 * FF2-2 AUTHORS bands through `RiskBandsEditor` and asserts the derived band
 * label; FF2-3 asserts the band-LESS case shows the score and no chip. Nothing
 * here asserts a band against seeded data.
 *
 * Hermetic: every form is spec-owned (title carries SPEC_TAG), created either
 * through the real authoring UI (where the authoring path IS the subject) or by
 * a postgres fixture that mirrors what `supabase/seed.sql` does for the seeded
 * matrix form. Cleanup deletes by title pattern. Run with --workers=1.
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin, CCIH (…002) — author
 *   staff1.ccih@test.local  staff, CCIH       (…003) — respondent
 */

test.use({ viewport: { width: 1280, height: 1400 } })

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

const DB_CONTAINER = 'supabase_db_azkbbhskturikxpgmafq'
const SPEC_TAG = 'FF2-SPEC'
const ORG = 'rede-a'
const SLUG = 'ccih'
const COMMISSION_CCIH = 'a0000000-0000-0000-0000-0000000000a1'
const USER_CHEFE = '00000000-0000-0000-0000-000000000002'

// ---------------------------------------------------------------------------
// Auth / RPC helpers (mirror ff1-repeating-groups.spec.ts)
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, password)
}

/** A real JWT for a persona so RLS + every DEFINER gate sees their identity. */
async function getToken(page: Page, email: string, password = 'Test1234!'): Promise<string> {
  const resp = await page.request.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
      data: { email, password },
    },
  )
  expect(resp.ok(), `token for ${email}: ${await resp.text()}`).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

/** Call an RPC under a persona's JWT — the canonical server path. */
async function rpcAs<T>(
  page: Page,
  token: string,
  fn: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: T; text: string }> {
  const resp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })
  const text = await resp.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { ok: resp.ok(), status: resp.status(), json: json as T, text }
}

// ---------------------------------------------------------------------------
// DB helpers — FIXTURE setup/cleanup and DB-TRUTH reads only. Application
// behaviour is never driven from here; every write the product performs goes
// through the UI or through an RPC under a real persona token.
//
// psql reads stdin (no -c), so no shell escaping of pt-BR text is involved:
// accents and quotes travel verbatim. Reads use `-tA -F '|'` → bare rows.
// ---------------------------------------------------------------------------

function psql(sqlText: string): string {
  return execSync(
    `docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -tA -F "|"`,
    { input: sqlText, encoding: 'utf8' },
  )
    .toString()
    .trim()
}

/** Rows as string cells. An empty result is `[]`, never `['']`. */
function sqlRows(query: string): string[][] {
  const out = psql(query)
  if (out === '') return []
  return out.split(/\r?\n/).map((line) => line.split('|'))
}

function sqlOne(query: string): string {
  const rows = sqlRows(query)
  expect(rows.length, `esperava exatamente uma linha de: ${query}`).toBe(1)
  return rows[0][0]
}

/**
 * Delete every spec-owned form, child-first.
 *
 * The delete still runs under `session_replication_role = replica` to get past
 * the immutability guards — but it no longer relies on FK CASCADE, which that
 * same switch silently disables. See `./helpers/purge-forms` (BUG-E2EISO-002).
 */
function purge() {
  purgeFormsByTag(SPEC_TAG)
}

test.beforeAll(() => {
  purge()
})
test.afterAll(() => {
  purge()
})

// ---------------------------------------------------------------------------
// Fixture builders — the same shape `supabase/seed.sql` uses for the seeded
// matrix form: insert the axes directly as postgres, because
// `upsert_matrix_axes` is a DEFINER door that reads `auth.uid()` (NULL in a
// seed session) and would correctly raise 42501.
// ---------------------------------------------------------------------------

type Axis = { code: string; label: string; weight?: number }

const CONFORMIDADE_ROWS: Axis[] = [
  { code: 'higienizacao', label: 'Higienização das mãos' },
  { code: 'epi', label: 'Uso de EPI' },
  { code: 'descarte', label: 'Descarte de perfurocortantes' },
]
const CONFORMIDADE_COLS: Axis[] = [
  { code: 'conforme', label: 'Conforme' },
  { code: 'nao_conforme', label: 'Não conforme' },
  { code: 'na', label: 'Não se aplica' },
]
const SEVERITY_ROWS: Axis[] = [
  { code: 'leve', label: 'Leve', weight: 1 },
  { code: 'moderada', label: 'Moderada', weight: 3 },
  { code: 'grave', label: 'Grave', weight: 9 },
]
const LIKELIHOOD_COLS: Axis[] = [
  { code: 'rara', label: 'Rara', weight: 1 },
  { code: 'provavel', label: 'Provável', weight: 3 },
  { code: 'frequente', label: 'Frequente', weight: 9 },
]

function axisInsert(
  table: 'form_matrix_rows' | 'form_matrix_columns',
  itemId: string,
  versionId: string,
  axis: Axis[],
): string {
  const values = axis
    .map(
      (entry, index) =>
        `('${itemId}','${versionId}',${index},'${entry.code}','${entry.label}',` +
        `${entry.weight === undefined ? 'null' : entry.weight})`,
    )
    .join(',\n    ')
  return `insert into public.${table} (item_id, form_version_id, position, code, label, weight) values\n    ${values};`
}

type FixtureForm = {
  formId: string
  versionId: string
  sectionId: string
  items: Record<string, string>
}

/**
 * Build + PUBLISH a spec-owned form. `body` receives the ids and returns the
 * item/axis SQL; the helper wraps it with the form/version/section rows and the
 * `publish_form_version` call (which re-validates the axes — HC0P5/HC0P6 — so a
 * malformed fixture fails loudly here rather than mid-test).
 */
function seedForm(
  title: string,
  build: (ids: { versionId: string; sectionId: string; id: (name: string) => string }) => string,
): FixtureForm {
  const formId = randomUUID()
  const versionId = randomUUID()
  const sectionId = randomUUID()
  const items: Record<string, string> = {}
  const id = (name: string) => {
    if (!items[name]) items[name] = randomUUID()
    return items[name]
  }
  const body = build({ versionId, sectionId, id })
  psql(
    `set client_encoding to 'UTF8';\n` +
      `insert into public.forms (id, commission_id, title, description, created_by)\n` +
      `values ('${formId}','${COMMISSION_CCIH}','${title}','Fixture ${SPEC_TAG}','${USER_CHEFE}');\n` +
      `insert into public.form_versions (id, form_id, version_number, status, created_by)\n` +
      `values ('${versionId}','${formId}',1,'draft','${USER_CHEFE}');\n` +
      `insert into public.form_sections (id, form_version_id, position, title, is_default)\n` +
      `values ('${sectionId}','${versionId}',0,null,true);\n` +
      `${body}\n` +
      `select public.publish_form_version('${versionId}');`,
  )
  return { formId, versionId, sectionId, items }
}

// ---------------------------------------------------------------------------
// Builder-UI helpers
// ---------------------------------------------------------------------------

async function createForm(page: Page, title: string): Promise<string> {
  await page.goto(`/o/${ORG}/c/${SLUG}/manage/forms`)
  await page.getByRole('button', { name: 'Novo formulário' }).click()
  await page.getByLabel('Título do formulário').fill(title)
  await page.getByRole('button', { name: 'Criar formulário' }).click()
  await page.waitForURL(/\/manage\/forms\/[0-9a-f-]+$/, { timeout: 20_000 })
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({
    timeout: 20_000,
  })
  const url = page.url()
  return url.slice(url.lastIndexOf('/') + 1)
}

async function openAddBlock(page: Page, menuName: RegExp): Promise<Locator> {
  const trigger = page.getByRole('button', { name: 'Adicionar bloco' })
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  await page.getByRole('menuitem', { name: menuName }).click()
  return page.getByRole('dialog')
}

async function submitAddDialog(dialog: Locator) {
  await dialog.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })
}

async function publishForm(page: Page) {
  const publishBtn = page.getByRole('button', { name: 'Publicar' })
  await expect(publishBtn).toBeVisible({ timeout: 15_000 })
  await publishBtn.click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toBeVisible({ timeout: 10_000 })
  await confirm.getByRole('button', { name: 'Publicar' }).click()
  await expect(page.getByRole('button', { name: /Editar publicado/ })).toBeVisible({
    timeout: 40_000,
  })
}

/** The block card of ONE item, located by its unique label text. */
function blockCard(page: Page, label: string): Locator {
  return page.locator('article').filter({ hasText: label }).first()
}

/** Open the axes editor from a matrix block's grid button. */
async function openAxesDialog(page: Page, label: string, isRisk = false): Promise<Locator> {
  const card = blockCard(page, label)
  const trigger = card.getByRole('button', {
    name: isRisk ? 'Editar severidade e probabilidade' : 'Editar linhas e colunas',
  })
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByRole('heading', {
      name: isRisk ? 'Severidade e probabilidade' : 'Linhas e colunas',
    }),
  ).toBeVisible({ timeout: 10_000 })
  return dialog
}

/**
 * Fill ONE axis of the axes dialog. `singular` is the pt-BR unit the editor uses
 * in its sr-only labels ("linha" / "coluna"). Entries are appended one at a
 * time: a fresh matrix starts with zero, so every entry needs its own click.
 */
async function fillAxis(
  dialog: Locator,
  addLabel: string,
  singular: 'linha' | 'coluna',
  entries: { label: string; weight?: number }[],
) {
  for (let i = 0; i < entries.length; i++) {
    await dialog.getByRole('button', { name: addLabel }).click()
    await dialog.getByLabel(`Rótulo da ${singular} ${i + 1}`).fill(entries[i].label)
    if (entries[i].weight !== undefined) {
      await dialog
        .getByLabel(`Peso da ${singular} ${i + 1}`)
        .fill(String(entries[i].weight))
    }
  }
}

async function saveAxes(dialog: Locator) {
  await dialog.getByRole('button', { name: 'Salvar matriz' }).click()
  await expect(dialog).toBeHidden({ timeout: 20_000 })
}

// ---------------------------------------------------------------------------
// Wizard helpers
// ---------------------------------------------------------------------------

async function enterWizard(page: Page, formTitle: string) {
  await page.goto(`/o/${ORG}/c/${SLUG}/forms`)
  const cardScope = page.locator('article').filter({ hasText: formTitle })
  const continuarLink = cardScope.getByRole('link', { name: /continuar preenchimento/i })
  const preencherBtn = cardScope.getByRole('button', { name: /preencher/i })
  await expect(continuarLink.or(preencherBtn).first()).toBeVisible({ timeout: 20_000 })
  if (await continuarLink.first().isVisible()) {
    await continuarLink.first().click()
  } else {
    await preencherBtn.first().click()
  }
  await page.waitForURL(/\/responder\//, { timeout: 25_000 })
}

function responseIdFromUrl(page: Page): string {
  const m = page.url().match(/\/responder\/([0-9a-f-]{36})/)
  if (!m) throw new Error(`URL não é um wizard de resposta: ${page.url()}`)
  return m[1]
}

/**
 * One cell of a plain matrix. Its accessible name comes from
 * `aria-labelledby="{rowHeader} {colHeader}"` — both coordinates, in that order
 * — which is exactly the a11y contract ADR 0089 ruling 1 asks the grid to keep.
 * Asserting through it means a regression that drops a header id fails HERE
 * rather than silently degrading a screen reader.
 */
function cell(scope: Page | Locator, row: string, col: string): Locator {
  return scope.getByRole('radio', { name: `${row} ${col}`, exact: true })
}

/** One cell of a risk matrix — `aria-label` carries both coordinates + score. */
function riskCell(scope: Page | Locator, severity: string, likelihood: string): Locator {
  return scope.getByRole('radio', { name: new RegExp(`^${severity}, ${likelihood}(,|$)`) })
}

async function goToReview(page: Page) {
  await page.getByRole('button', { name: 'Revisar' }).click({ timeout: 15_000 })
}

async function submitFromReview(page: Page) {
  await page.getByRole('button', { name: /Enviar respostas/i }).click({ timeout: 15_000 })
}

// ---------------------------------------------------------------------------
// DB-truth readers
// ---------------------------------------------------------------------------

/** `rowCode|colCode` pairs of one item's cells in one response, ordered. */
function cellsOf(responseId: string, itemId: string): string[][] {
  return sqlRows(
    `select r.code, c.code
       from public.answer_matrix_cells amc
       join public.answers a on a.id = amc.answer_id
       join public.form_matrix_rows r on r.id = amc.row_id
       join public.form_matrix_columns c on c.id = amc.col_id
      where a.response_id = '${responseId}' and a.item_id = '${itemId}'
      order by r.position;`,
  )
}

/** `severityCode|likelihoodCode|risk_score` of one risk item in one response. */
function riskOf(responseId: string, itemId: string): string[][] {
  return sqlRows(
    `select r.code, c.code, arm.risk_score::text
       from public.answer_risk_matrix arm
       join public.answers a on a.id = arm.answer_id
       join public.form_matrix_rows r on r.id = arm.severity_row_id
       join public.form_matrix_columns c on c.id = arm.likelihood_col_id
      where a.response_id = '${responseId}' and a.item_id = '${itemId}';`,
  )
}

function responseStatus(responseId: string): string {
  return sqlOne(`select status from public.responses where id = '${responseId}';`)
}

// ===========================================================================
// FF2-1 — Ruling 1: the radio grid, authored FROM SCRATCH
//
// This is the seam BUG-FF2-001 had made unreachable (`ALL_ITEM_TYPES` did not
// contain either matrix type, so `addItem` rejected every matrix). Everything
// downstream of it — `upsert_matrix_axes`, the wizard grid, the answer writer —
// had no caller in the product. It is therefore the highest-value regression
// guard in the phase and is driven entirely through the real UI.
// ===========================================================================

test('FF2-1 (ruling 1): a matrix authored from scratch fills as a radio grid — one column per row, a second click REPLACES, submit persists one cell per row', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const title = `Grade ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const formId = await createForm(page, title)

  // --- Author the matrix through "Adicionar bloco" → Matrizes ---------------
  const dialog = await openAddBlock(page, /^Matriz Vários critérios/)
  await dialog.getByLabel('Enunciado da pergunta').fill('Avalie cada critério')
  await dialog.getByRole('checkbox', { name: 'Resposta obrigatória' }).click()
  await submitAddDialog(dialog)
  await expect(page.getByText('Avalie cada critério').first()).toBeVisible()

  // A matrix with no axes is a real authoring state — the builder says so
  // rather than rendering an empty grid.
  await expect(
    page.getByText('Defina as linhas e as colunas antes de publicar.'),
  ).toBeVisible()

  // --- The axes, through the dialog that is their ONLY writer ---------------
  const axes = await openAxesDialog(page, 'Avalie cada critério')
  await fillAxis(axes, 'Adicionar linha', 'linha', [
    { label: 'Higienização das mãos' },
    { label: 'Uso de EPI' },
  ])
  await fillAxis(axes, 'Adicionar coluna', 'coluna', [
    { label: 'Conforme' },
    { label: 'Não conforme' },
  ])
  await saveAxes(axes)

  // DB truth: the axes persisted with client-minted codes. A minted code is
  // `slug(label)_<6 random chars>` (option-code.ts), so the CODES are asserted
  // by shape and captured for the fill assertions below — the literal values
  // are not knowable in advance, and pretending otherwise would be a spec that
  // passes for the wrong reason.
  const versionId = sqlOne(
    `select id from public.form_versions where form_id = '${formId}' and status = 'draft';`,
  )
  const itemId = sqlOne(
    `select id from public.form_items where form_version_id = '${versionId}' and item_type = 'matrix';`,
  )
  const rowAxis = sqlRows(
    `select code, label from public.form_matrix_rows where item_id = '${itemId}' order by position;`,
  )
  const colAxis = sqlRows(
    `select code, label from public.form_matrix_columns where item_id = '${itemId}' order by position;`,
  )
  expect(rowAxis.map((r) => r[1])).toEqual(['Higienização das mãos', 'Uso de EPI'])
  expect(colAxis.map((c) => c[1])).toEqual(['Conforme', 'Não conforme'])
  // `mintAxisCode` → `generateOptionCode` → `slugifyLabel`: a clean ASCII slug of
  // the label plus a 6-char suffix — an accent is FOLDED to its base letter, so
  // "Higienização das mãos" mints `higienizacao_das_maos_<suffix>`.
  //
  // This pin was the other way round until BUG-FF2-004. `slugifyLabel`
  // NFD-decomposed and then collapsed every non-[a-z0-9] run to `_`, so a
  // combining mark became an underscore (`higienizac_a_o_das_ma_os`) — and this
  // spec pinned THAT, on the reasoning that it was long-standing shared
  // behaviour (option codes, question_keys) rather than anything FF-2
  // introduced, so it was not the tester's to assert away. The PO ruled it a
  // bug: FF-2 is the first surface that shows a code to the author on purpose
  // (ADR 0089 ruling 4), and a mangled identity defeats the reason for showing
  // it. `fbada14` now deletes the combining marks instead of collapsing them.
  //
  // Kept as a note because the old reasoning was sound and the correction is the
  // lesson: pinning current behaviour *because it is pre-existing* is a bet that
  // the behaviour is CORRECT, and that bet can be lost to a ruling as easily as
  // to a regression. The pin is not the mistake — pinning silently would be.
  // Same shape as FF2-11's first draft, which asserted the old symptom
  // ("no item's rect outside the viewport") and went red on the FIXED build.
  expect(rowAxis[0][0]).toMatch(/^higienizacao_das_maos_[a-z0-9]{6}$/)
  expect(rowAxis[1][0]).toMatch(/^uso_de_epi_[a-z0-9]{6}$/)
  expect(colAxis[0][0]).toMatch(/^conforme_[a-z0-9]{6}$/)
  expect(colAxis[1][0]).toMatch(/^nao_conforme_[a-z0-9]{6}$/)
  const [rowHigiene, rowEpi] = rowAxis.map((r) => r[0])
  const [colConforme, colNaoConforme] = colAxis.map((c) => c[0])
  // Ruling 3 rode along: a matrix may now be `required` (the relaxed
  // `form_items_input_vs_display` arm) and the checkbox actually persisted it.
  expect(
    sqlOne(`select required::text from public.form_items where id = '${itemId}';`),
  ).toBe('true')

  await publishForm(page)

  // --- Fill it as the respondent -------------------------------------------
  await signInAs(page, 'staff1.ccih@test.local')
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)

  await expect(cell(page, 'Higienização das mãos', 'Conforme')).toBeVisible({
    timeout: 20_000,
  })

  // Row 1 → Conforme, then → Não conforme. The second selection must REPLACE.
  await cell(page, 'Higienização das mãos', 'Conforme').check()
  await expect(cell(page, 'Higienização das mãos', 'Conforme')).toBeChecked()
  await expect(page.getByText('1 de 2 linhas respondidas')).toBeVisible()

  await cell(page, 'Higienização das mãos', 'Não conforme').check()
  await expect(cell(page, 'Higienização das mãos', 'Não conforme')).toBeChecked()
  await expect(cell(page, 'Higienização das mãos', 'Conforme')).not.toBeChecked()
  // Still ONE answered row — a replacement, not an accumulation.
  await expect(page.getByText('1 de 2 linhas respondidas')).toBeVisible()

  await cell(page, 'Uso de EPI', 'Conforme').check()
  await expect(page.getByText('2 de 2 linhas respondidas')).toBeVisible()

  // --- Review renders the grid BY VALUE, read-only --------------------------
  await goToReview(page)
  await expect(
    page.getByText('Higienização das mãos, Não conforme: selecionado'),
  ).toBeAttached()
  await expect(
    page.getByText('Higienização das mãos, Conforme: não selecionado'),
  ).toBeAttached()
  await expect(page.getByText('Uso de EPI, Conforme: selecionado')).toBeAttached()
  // No input survives into review — it is a rendering of the answer, not a copy
  // of the form.
  await expect(page.getByRole('radio')).toHaveCount(0)

  await submitFromReview(page)
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })

  // --- DB truth: exactly one cell per row, with the chosen column -----------
  expect(responseStatus(responseId)).toBe('submitted')
  expect(cellsOf(responseId, itemId)).toEqual([
    [rowHigiene, colNaoConforme],
    [rowEpi, colConforme],
  ])
  // The invariant, stated as a count: 2 rows answered → 2 cells, never 3.
  expect(
    sqlOne(
      `select count(*)::text from public.answer_matrix_cells amc
         join public.answers a on a.id = amc.answer_id
        where a.response_id = '${responseId}';`,
    ),
  ).toBe('2')
  // A matrix answers in `answer_matrix_cells`; `answers.value` stays NULL.
  expect(
    sqlOne(
      `select coalesce(value::text,'NULL') from public.answers
        where response_id = '${responseId}' and item_id = '${itemId}';`,
    ),
  ).toBe('NULL')
})

// ===========================================================================
// FF2-2 — Ruling 2: risk_matrix, weights on the axes, score derived server-side
// ===========================================================================

test('FF2-2 (ruling 2): a risk matrix authored with 1/3/9 weights and bands shows 27 · Alto, and the DB stores a SERVER-derived risk_score = 27', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const title = `Risco ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const formId = await createForm(page, title)

  // --- Author: enunciado + the three score bands (config.riskBands) ---------
  const dialog = await openAddBlock(page, /^Matriz de risco/)
  await dialog.getByLabel('Enunciado da pergunta').fill('Classifique o risco do achado')
  for (const [i, band] of [
    { min: '1', label: 'Baixo' },
    { min: '9', label: 'Médio' },
    { min: '27', label: 'Alto' },
  ].entries()) {
    await dialog.getByRole('button', { name: 'Adicionar faixa' }).click()
    await dialog.getByLabel(`Pontuação mínima da faixa ${i + 1}`).fill(band.min)
    await dialog.getByLabel(`Rótulo da faixa ${i + 1}`).fill(band.label)
  }
  // The editor previews the derived ranges rather than asking the author to
  // keep two ends in sync.
  await expect(dialog.getByText('Alto a partir de 27')).toBeVisible()
  await submitAddDialog(dialog)

  // --- The weighted axes ----------------------------------------------------
  const axes = await openAxesDialog(page, 'Classifique o risco do achado', true)
  await fillAxis(axes, 'Adicionar severidade', 'linha', [
    { label: 'Leve', weight: 1 },
    { label: 'Moderada', weight: 3 },
    { label: 'Grave', weight: 9 },
  ])
  await fillAxis(axes, 'Adicionar probabilidade', 'coluna', [
    { label: 'Rara', weight: 1 },
    { label: 'Provável', weight: 3 },
    { label: 'Frequente', weight: 9 },
  ])
  await saveAxes(axes)

  const versionId = sqlOne(
    `select id from public.form_versions where form_id = '${formId}' and status = 'draft';`,
  )
  const itemId = sqlOne(
    `select id from public.form_items where form_version_id = '${versionId}' and item_type = 'risk_matrix';`,
  )
  // Weights are the factors of the score, so they are asserted by VALUE; the
  // codes are minted with a random suffix and are asserted by shape + captured.
  const sevAxis = sqlRows(
    `select code, label, weight::text from public.form_matrix_rows where item_id = '${itemId}' order by position;`,
  )
  const likAxis = sqlRows(
    `select code, label, weight::text from public.form_matrix_columns where item_id = '${itemId}' order by position;`,
  )
  expect(sevAxis.map((r) => [r[1], r[2]])).toEqual([
    ['Leve', '1'],
    ['Moderada', '3'],
    ['Grave', '9'],
  ])
  expect(likAxis.map((c) => [c[1], c[2]])).toEqual([
    ['Rara', '1'],
    ['Provável', '3'],
    ['Frequente', '9'],
  ])
  // Accent folding, same as FF2-1: "Provável" → `provavel` (was `prova_vel`
  // before BUG-FF2-004 — see the longer note there for why that was pinned and
  // why the pin was overturned by a PO ruling rather than by a regression).
  expect(sevAxis[2][0]).toMatch(/^grave_[a-z0-9]{6}$/)
  expect(likAxis[1][0]).toMatch(/^provavel_[a-z0-9]{6}$/)
  const codeGrave = sevAxis[2][0]
  const codeProvavel = likAxis[1][0]
  // Bands are stored SORTED ascending — the order every consumer assumes.
  expect(
    sqlOne(
      `select jsonb_agg(b ->> 'label' order by (b ->> 'minScore')::numeric)::text
         from public.form_items i, jsonb_array_elements(i.config -> 'riskBands') b
        where i.id = '${itemId}';`,
    ),
  ).toBe('["Baixo", "Médio", "Alto"]')

  await publishForm(page)

  // --- Fill: grave (9) × provável (3) = 27 ---------------------------------
  await signInAs(page, 'staff1.ccih@test.local')
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)

  await expect(page.getByRole('radiogroup')).toBeVisible({ timeout: 20_000 })
  // Before any choice the score is a prompt, never a zero.
  await expect(page.getByText('selecione uma célula')).toBeVisible()

  await riskCell(page, 'Grave', 'Provável').check()
  const status = page.getByRole('status').filter({ hasText: 'Pontuação:' })
  await expect(status).toContainText('27')
  await expect(status).toContainText('Alto')

  // A different cell re-derives both: moderada (3) × rara (1) = 3 → Baixo.
  await riskCell(page, 'Moderada', 'Rara').check()
  await expect(status).toContainText('3')
  await expect(status).toContainText('Baixo')

  // Back to the cell under test and submit.
  await riskCell(page, 'Grave', 'Provável').check()
  await expect(status).toContainText('27')

  await goToReview(page)
  await expect(page.getByText('Grave, Provável: selecionado')).toBeAttached()
  await submitFromReview(page)
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })

  // --- DB truth: the score is the PRODUCT of the two weights ----------------
  expect(responseStatus(responseId)).toBe('submitted')
  expect(riskOf(responseId, itemId)).toEqual([[codeGrave, codeProvavel, '27']])
  // The band is NOT stored — it is a presentation of the score (ruling 2).
  expect(
    sqlOne(
      `select count(*)::text from information_schema.columns
        where table_name = 'answer_risk_matrix' and column_name like '%band%';`,
    ),
  ).toBe('0')
})

// ===========================================================================
// FF2-3 — Ruling 3: `required` on a matrix means EVERY ROW is answered
// ===========================================================================

test('FF2-3 (ruling 3): a partial required grid blocks submit in pt-BR AND is refused by submit_response; completing it clears both. A band-less risk matrix shows the score alone', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const title = `Obrigatória ${SPEC_TAG} ${Date.now()}`
  const fixture = seedForm(title, ({ versionId, sectionId, id }) => {
    const matrixId = id('matrix')
    const riskId = id('risk')
    return (
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required)\n` +
      `values ('${matrixId}','${sectionId}',0,'matrix','ff2_conformidade','Avalie cada critério de conformidade',true);\n` +
      axisInsert('form_matrix_rows', matrixId, versionId, CONFORMIDADE_ROWS) +
      '\n' +
      axisInsert('form_matrix_columns', matrixId, versionId, CONFORMIDADE_COLS) +
      '\n' +
      // Deliberately NO `config.riskBands` — the seeded `matriz_risco` has none
      // either, and the band-less rendering is a real state worth pinning.
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required)\n` +
      `values ('${riskId}','${sectionId}',1,'risk_matrix','ff2_risco','Classifique o risco',false);\n` +
      axisInsert('form_matrix_rows', riskId, versionId, SEVERITY_ROWS) +
      '\n' +
      axisInsert('form_matrix_columns', riskId, versionId, LIKELIHOOD_COLS)
    )
  })

  await signInAs(page, 'staff1.ccih@test.local')
  const token = await getToken(page, 'staff1.ccih@test.local')
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)

  // --- Two of three rows: the UI must refuse, naming the rule ---------------
  await cell(page, 'Higienização das mãos', 'Conforme').check()
  await cell(page, 'Uso de EPI', 'Não conforme').check()
  await expect(page.getByText('2 de 3 linhas respondidas')).toBeVisible()

  await goToReview(page)
  await expect(page.getByText('Responda todas as linhas desta matriz.')).toBeVisible({
    timeout: 15_000,
  })
  // It never reached the review step, so there is nothing to send.
  await expect(page.getByRole('button', { name: /Enviar respostas/i })).toHaveCount(0)

  // --- The SERVER is the authority, not the client mirror -------------------
  //
  // ⚠ The client-side block above does NOT persist: `goToReview` fails
  // validation and never navigates, so nothing is flushed. Calling
  // `submit_response` here directly would therefore test an EMPTY grid, and an
  // empty grid is refused by the weaker "at least one cell anywhere" reading
  // too — the assertion would pass no matter which rule shipped. (Proven, not
  // assumed: with `app.item_required_satisfied`'s matrix arm weakened to
  // any-cell, that version of this test stayed GREEN.)
  //
  // So the PARTIAL state is written through the canonical path first, and its
  // presence asserted, before the refusal is claimed.
  const savePartial = await rpcAs<unknown>(page, token, 'save_section_answers', {
    p_response_id: responseId,
    p_section_id: fixture.sectionId,
    p_matrix_cells: {
      [fixture.items.matrix]: { higienizacao: 'conforme', epi: 'nao_conforme' },
    },
  })
  expect(savePartial.ok, `save_section_answers (parcial): ${savePartial.text}`).toBeTruthy()
  expect(
    cellsOf(responseId, fixture.items.matrix),
    'a grade parcial precisa existir no servidor — senão a recusa abaixo só prova que uma grade VAZIA é recusada',
  ).toEqual([
    ['higienizacao', 'conforme'],
    ['epi', 'nao_conforme'],
  ])

  const partial = await rpcAs<unknown>(page, token, 'submit_response', {
    p_response_id: responseId,
  })
  expect(
    partial.ok,
    `submit_response aceitou uma matriz obrigatória com 2 de 3 linhas: ${partial.text}`,
  ).toBeFalsy()
  expect(responseStatus(responseId)).toBe('in_progress')

  // --- The band-less risk matrix: a score, and no band chip ----------------
  await riskCell(page, 'Grave', 'Provável').check()
  const riskStatus = page.getByRole('status').filter({ hasText: 'Pontuação:' })
  await expect(riskStatus).toContainText('27')
  // Exactly one child span (the number). A band would add a second.
  expect(await riskStatus.locator('span').count()).toBe(2) // "Pontuação:" + the score
  await expect(riskStatus).not.toContainText(/Alto|Médio|Baixo/)

  // --- Complete the third row: both the UI and the server relent ------------
  await cell(page, 'Descarte de perfurocortantes', 'Não se aplica').check()
  await expect(page.getByText('3 de 3 linhas respondidas')).toBeVisible()
  await expect(page.getByText('Responda todas as linhas desta matriz.')).toHaveCount(0)

  await goToReview(page)
  await submitFromReview(page)
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })

  expect(responseStatus(responseId)).toBe('submitted')
  expect(cellsOf(responseId, fixture.items.matrix)).toEqual([
    ['higienizacao', 'conforme'],
    ['epi', 'nao_conforme'],
    ['descarte', 'na'],
  ])
  expect(riskOf(responseId, fixture.items.risk)).toEqual([['grave', 'provavel', '27']])
})

// ===========================================================================
// FF2-4 — Ruling 3, the deadlock-negative: item visibility WINS over `required`
//
// ADR 0089 restates this rather than inheriting FF-1's precedent, because it
// "must be re-proven per arm". A required matrix that is hidden must require
// nothing — otherwise a form is unsubmittable with no visible control to fix.
// ===========================================================================

test('FF2-4 (ruling 3, deadlock-negative): a required matrix hidden by its own condition never blocks submit — UI and submit_response agree, and no cells are written', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const title = `Oculta ${SPEC_TAG} ${Date.now()}`
  const fixture = seedForm(title, ({ versionId, sectionId, id }) => {
    const gateId = id('gate')
    const matrixId = id('matrix')
    return (
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required)\n` +
      `values ('${gateId}','${sectionId}',0,'multiple_choice','ff2_houve_achado','Houve achado de não conformidade?',true);\n` +
      `insert into public.form_item_options (item_id, form_version_id, position, code, label) values\n` +
      `  ('${gateId}','${versionId}',0,'sim','Sim'),\n` +
      `  ('${gateId}','${versionId}',1,'nao','Não');\n` +
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required, visible_when)\n` +
      `values ('${matrixId}','${sectionId}',1,'matrix','ff2_detalhe_achado','Detalhe o achado',true,\n` +
      `        jsonb_build_object('question_key','ff2_houve_achado','op','equals','value','sim'));\n` +
      axisInsert('form_matrix_rows', matrixId, versionId, CONFORMIDADE_ROWS) +
      '\n' +
      axisInsert('form_matrix_columns', matrixId, versionId, CONFORMIDADE_COLS)
    )
  })

  await signInAs(page, 'staff1.ccih@test.local')
  const token = await getToken(page, 'staff1.ccih@test.local')
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)

  // "Sim" reveals the required matrix — the anti-vacuity half: if the condition
  // never fired, the rest of this test would prove nothing.
  // The grid's own <caption> repeats the label, so the heading is addressed by
  // role rather than by text (the caption is the a11y feature, not a duplicate).
  const matrixHeading = page.getByRole('heading', { name: /^Detalhe o achado/ })
  await page.getByRole('radio', { name: 'Sim', exact: true }).check()
  await expect(matrixHeading).toBeVisible()
  await expect(cell(page, 'Uso de EPI', 'Conforme')).toBeVisible()

  // "Não" hides it. The grid is gone, and with it the obligation.
  await page.getByRole('radio', { name: 'Não', exact: true }).check()
  await expect(matrixHeading).toHaveCount(0)

  await goToReview(page)
  await expect(page.getByText('Responda todas as linhas desta matriz.')).toHaveCount(0)
  await submitFromReview(page)
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })

  // The submit above went through `submit_response` — the server authority, not
  // the client mirror — so a status of `submitted` IS the server's verdict that
  // a HIDDEN required matrix demands nothing. Asserted explicitly because that
  // is the whole point of the deadlock-negative.
  expect(
    responseStatus(responseId),
    'submit_response recusou uma resposta cuja única pendência é uma matriz OCULTA',
  ).toBe('submitted')
  // No cells for the hidden matrix — including none left over from the moment
  // it WAS visible (the wizard clears a matrix a later answer hides).
  expect(cellsOf(responseId, fixture.items.matrix)).toEqual([])

  // The ANTI-VACUITY twin. "Submit succeeded" is equally consistent with a
  // completeness arm that never runs for matrices AT ALL, so the same fixture is
  // driven again with the gate answered 'sim' — matrix VISIBLE and empty — and
  // `submit_response` must REFUSE. Both steps go through the RPC so nothing
  // depends on when the wizard happens to flush.
  await enterWizard(page, title)
  const visibleId = responseIdFromUrl(page)
  await expect(cell(page, 'Uso de EPI', 'Conforme')).toHaveCount(0)
  const saveGate = await rpcAs<unknown>(page, token, 'save_section_answers', {
    p_response_id: visibleId,
    p_section_id: fixture.sectionId,
    p_selections: { [fixture.items.gate]: ['sim'] },
  })
  expect(saveGate.ok, `save_section_answers (gate=sim): ${saveGate.text}`).toBeTruthy()

  const refused = await rpcAs<unknown>(page, token, 'submit_response', {
    p_response_id: visibleId,
  })
  expect(
    refused.ok,
    `submit_response aceitou uma matriz obrigatória VISÍVEL e vazia: ${refused.text}`,
  ).toBeFalsy()
  expect(responseStatus(visibleId)).toBe('in_progress')

  // …and the refusal is about the MATRIX, not about anything else left open:
  // filling every row makes the very same response submittable.
  const fillAll = await rpcAs<unknown>(page, token, 'save_section_answers', {
    p_response_id: visibleId,
    p_section_id: fixture.sectionId,
    p_matrix_cells: {
      [fixture.items.matrix]: {
        higienizacao: 'conforme',
        epi: 'conforme',
        descarte: 'na',
      },
    },
  })
  expect(fillAll.ok, `save_section_answers (grade completa): ${fillAll.text}`).toBeTruthy()
  const accepted = await rpcAs<unknown>(page, token, 'submit_response', {
    p_response_id: visibleId,
  })
  expect(accepted.ok, `submit_response recusou uma grade completa: ${accepted.text}`).toBeTruthy()
  expect(responseStatus(visibleId)).toBe('submitted')
})

// ===========================================================================
// FF2-5 — Ruling 4: axis codes are immutable; the clone deep-copies them
// ===========================================================================

test('FF2-5 (ruling 4): relabel keeps the code, publish → clone deep-copies codes AND weights, the source version is untouched, and the editor offers no re-key affordance', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const title = `Códigos ${SPEC_TAG} ${Date.now()}`
  const fixture = seedForm(title, ({ versionId, sectionId, id }) => {
    const matrixId = id('matrix')
    const riskId = id('risk')
    return (
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required)\n` +
      `values ('${matrixId}','${sectionId}',0,'matrix','ff2_codigos','Avalie cada critério',false);\n` +
      axisInsert('form_matrix_rows', matrixId, versionId, CONFORMIDADE_ROWS) +
      '\n' +
      axisInsert('form_matrix_columns', matrixId, versionId, CONFORMIDADE_COLS) +
      '\n' +
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required)\n` +
      `values ('${riskId}','${sectionId}',1,'risk_matrix','ff2_codigos_risco','Classifique o risco',false);\n` +
      axisInsert('form_matrix_rows', riskId, versionId, SEVERITY_ROWS) +
      '\n' +
      axisInsert('form_matrix_columns', riskId, versionId, LIKELIHOOD_COLS)
    )
  })

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/${SLUG}/manage/forms/${fixture.formId}`)

  // --- Clone the published version into a draft -----------------------------
  await page.getByRole('button', { name: /Editar publicado/ }).click()
  await expect(page.getByRole('button', { name: 'Publicar' })).toBeVisible({
    timeout: 40_000,
  })
  const draftVersionId = sqlOne(
    `select id from public.form_versions where form_id = '${fixture.formId}' and status = 'draft';`,
  )
  expect(draftVersionId).not.toBe(fixture.versionId)

  // INFO-1 (matrix half): the clone must deep-copy BOTH axis tables, with codes
  // and weights intact. Before FF-2 it copied neither and the grid vanished.
  expect(
    sqlRows(
      `select r.code, r.label, coalesce(r.weight::text,'-')
         from public.form_matrix_rows r join public.form_items i on i.id = r.item_id
        where i.form_version_id = '${draftVersionId}' and i.item_type = 'matrix'
        order by r.position;`,
    ),
  ).toEqual([
    ['higienizacao', 'Higienização das mãos', '-'],
    ['epi', 'Uso de EPI', '-'],
    ['descarte', 'Descarte de perfurocortantes', '-'],
  ])
  expect(
    sqlRows(
      `select r.code, r.weight::text
         from public.form_matrix_rows r join public.form_items i on i.id = r.item_id
        where i.form_version_id = '${draftVersionId}' and i.item_type = 'risk_matrix'
        order by r.position;`,
    ),
  ).toEqual([
    ['leve', '1'],
    ['moderada', '3'],
    ['grave', '9'],
  ])
  expect(
    sqlRows(
      `select c.code, c.weight::text
         from public.form_matrix_columns c join public.form_items i on i.id = c.item_id
        where i.form_version_id = '${draftVersionId}' and i.item_type = 'risk_matrix'
        order by c.position;`,
    ),
  ).toEqual([
    ['rara', '1'],
    ['provavel', '3'],
    ['frequente', '9'],
  ])

  // --- Relabel a row in the draft; the code must not move -------------------
  const axes = await openAxesDialog(page, 'Avalie cada critério')
  // The immutable identity is SHOWN, read-only — never an input.
  await expect(axes.getByText('higienizacao')).toBeVisible()
  await expect(axes.getByRole('textbox', { name: /Código/ })).toHaveCount(0)
  const codeInputs = await axes
    .locator('input')
    .evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLInputElement).value).filter((v) => v === 'higienizacao'),
    )
  expect(codeInputs, 'nenhum input deve carregar o código — re-keying não é ofertado').toEqual(
    [],
  )

  await axes.getByLabel('Rótulo da linha 1').fill('Higiene das mãos (revisado)')
  await saveAxes(axes)

  const draftMatrixItem = sqlOne(
    `select id from public.form_items where form_version_id = '${draftVersionId}' and item_type = 'matrix';`,
  )
  expect(
    sqlRows(
      `select code, label from public.form_matrix_rows where item_id = '${draftMatrixItem}' order by position;`,
    ),
  ).toEqual([
    // Relabelled, RE-KEYED NEVER: `higienizacao` is the aggregation identity.
    ['higienizacao', 'Higiene das mãos (revisado)'],
    ['epi', 'Uso de EPI'],
    ['descarte', 'Descarte de perfurocortantes'],
  ])

  // --- The published source is untouched (Rule 5) ---------------------------
  expect(
    sqlRows(
      `select r.code, r.label
         from public.form_matrix_rows r join public.form_items i on i.id = r.item_id
        where i.form_version_id = '${fixture.versionId}' and i.item_type = 'matrix'
        order by r.position;`,
    ),
  ).toEqual([
    ['higienizacao', 'Higienização das mãos'],
    ['epi', 'Uso de EPI'],
    ['descarte', 'Descarte de perfurocortantes'],
  ])

  // --- An ADDED entry mints a NEW code; it never reuses a removed one -------
  const axes2 = await openAxesDialog(page, 'Higiene das mãos (revisado)')
  await axes2.getByRole('button', { name: 'Adicionar coluna' }).click()
  await axes2.getByLabel('Rótulo da coluna 4').fill('Parcialmente conforme')
  await saveAxes(axes2)
  const cols = sqlRows(
    `select code from public.form_matrix_columns where item_id = '${draftMatrixItem}' order by position;`,
  ).map((r) => r[0])
  expect(cols.slice(0, 3)).toEqual(['conforme', 'nao_conforme', 'na'])
  expect(cols).toHaveLength(4)
  expect(cols[3]).toMatch(/^parcialmente_conforme/)
})

// ===========================================================================
// FF2-6 — A matrix INSIDE a repeating group (FF-1's instance engine underneath)
//
// Also the E2E half of ADR 0089 §A: `app.instance_is_empty` was blind to the
// matrix tables, so an instance whose ONLY content is a filled matrix was
// judged empty and PRUNED by `submit_response` — silently destroying the
// answer, cells cascading after it. Here every instance holds a matrix and
// nothing else, so a regression of that arm deletes the data this test reads.
// ===========================================================================

test('FF2-6 (repeating group): a matrix answers per instance, and an instance whose ONLY content is a matrix survives submit', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const title = `Repetição ${SPEC_TAG} ${Date.now()}`
  const fixture = seedForm(title, ({ versionId, sectionId, id }) => {
    const groupId = id('group')
    const matrixId = id('matrix')
    return (
      `insert into public.form_items (id, section_id, position, item_type, label, config)\n` +
      `values ('${groupId}','${sectionId}',0,'repeating_group','Setor auditado',\n` +
      `        jsonb_build_object('minInstances',1,'maxInstances',5));\n` +
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required, parent_item_id)\n` +
      `values ('${matrixId}','${sectionId}',1,'matrix','ff2_setor_grade','Avalie o setor',true,'${groupId}');\n` +
      axisInsert('form_matrix_rows', matrixId, versionId, CONFORMIDADE_ROWS) +
      '\n' +
      axisInsert('form_matrix_columns', matrixId, versionId, CONFORMIDADE_COLS)
    )
  })

  await signInAs(page, 'staff1.ccih@test.local')
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)

  // An instance region is named "{grupo} {n} de {total}" (FF-1), so the ordinal
  // shifts as repetitions are added. How many the wizard opens with is FF-1's
  // `minInstances` behaviour, not ADR 0089's, so this reaches exactly two
  // without asserting which of the two it started from.
  const addBtn = page.getByRole('button', { name: 'Adicionar repetição' })
  await expect(addBtn).toBeVisible({ timeout: 20_000 })
  const instances = page.getByRole('region', { name: /^Setor auditado \d+ de \d+$/ })
  for (let n = await instances.count(); n < 2; n++) {
    await addBtn.click()
    await expect(instances).toHaveCount(n + 1, { timeout: 20_000 })
  }
  await expect(instances).toHaveCount(2)
  const first = page.getByRole('region', { name: 'Setor auditado 1 de 2' })
  const second = page.getByRole('region', { name: 'Setor auditado 2 de 2' })
  await expect(first).toBeVisible()
  await expect(second).toBeVisible()

  // Two grids, two independent answer sets. If the two repetitions shared a
  // radio `name`, answering the second would silently clear the first
  // (BUG-FF1-004's shape) — so both are asserted after BOTH are filled.
  for (const [scope, col] of [
    [first, 'Conforme'],
    [second, 'Não conforme'],
  ] as const) {
    await cell(scope, 'Higienização das mãos', col).check()
    await cell(scope, 'Uso de EPI', col).check()
    await cell(scope, 'Descarte de perfurocortantes', col).check()
  }
  await expect(cell(first, 'Higienização das mãos', 'Conforme')).toBeChecked()
  await expect(cell(second, 'Higienização das mãos', 'Não conforme')).toBeChecked()
  await expect(cell(first, 'Higienização das mãos', 'Não conforme')).not.toBeChecked()

  await goToReview(page)
  await submitFromReview(page)
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })

  // --- DB truth: BOTH instances survived, each with its own three cells -----
  expect(responseStatus(responseId)).toBe('submitted')
  expect(
    sqlOne(
      `select count(*)::text from public.response_group_instances
        where response_id = '${responseId}';`,
    ),
    'ADR 0089 §A — uma instância cujo único conteúdo é uma matriz foi podada no submit',
  ).toBe('2')
  expect(
    sqlRows(
      `select gi.position::text, r.code, c.code
         from public.answer_matrix_cells amc
         join public.answers a on a.id = amc.answer_id
         join public.response_group_instances gi on gi.id = a.group_instance_id
         join public.form_matrix_rows r on r.id = amc.row_id
         join public.form_matrix_columns c on c.id = amc.col_id
        where a.response_id = '${responseId}' and a.item_id = '${fixture.items.matrix}'
        order by gi.position, r.position;`,
    ),
  ).toEqual([
    ['0', 'higienizacao', 'conforme'],
    ['0', 'epi', 'conforme'],
    ['0', 'descarte', 'conforme'],
    ['1', 'higienizacao', 'nao_conforme'],
    ['1', 'epi', 'nao_conforme'],
    ['1', 'descarte', 'nao_conforme'],
  ])
})

// ===========================================================================
// FF2-7 — Keyboard-only (CLAUDE.md §8)
//
// The grid's whole keyboard contract comes from ONE native radio group per row:
// Tab walks ROWS (one stop each), arrows walk the SCALE within a row. That is
// the platform's behaviour rather than a hand-rolled roving tabIndex, so it is
// asserted against the real DOM — which control actually holds focus — not
// against a rendered class name.
// ===========================================================================

test('FF2-7 (keyboard-only): Tab walks rows, arrows walk the scale, the whole grid is completed and submitted with no mouse', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const title = `Teclado ${SPEC_TAG} ${Date.now()}`
  const fixture = seedForm(title, ({ versionId, sectionId, id }) => {
    const matrixId = id('matrix')
    return (
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required)\n` +
      `values ('${matrixId}','${sectionId}',0,'matrix','ff2_teclado','Avalie cada critério',true);\n` +
      axisInsert('form_matrix_rows', matrixId, versionId, CONFORMIDADE_ROWS) +
      '\n' +
      axisInsert('form_matrix_columns', matrixId, versionId, CONFORMIDADE_COLS)
    )
  })

  await signInAs(page, 'staff1.ccih@test.local')
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)
  await expect(cell(page, 'Higienização das mãos', 'Conforme')).toBeVisible({
    timeout: 20_000,
  })

  /** The focused control's accessible coordinates, read from the live DOM. */
  const focusedCell = () =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLInputElement | null
      if (!el || el.tagName !== 'INPUT' || el.type !== 'radio') return null
      const labels = (el.getAttribute('aria-labelledby') ?? '')
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
      return { name: labels.join(' · '), group: el.name, checked: el.checked }
    })

  // Row 1: focus the first cell directly by keyboard reachability, then walk.
  await cell(page, 'Higienização das mãos', 'Conforme').focus()
  expect(await focusedCell()).toMatchObject({
    name: 'Higienização das mãos · Conforme',
  })

  // ArrowRight inside a native radio group moves AND selects — the platform
  // behaviour the design deliberately inherits.
  await page.keyboard.press('ArrowRight')
  expect(await focusedCell()).toMatchObject({
    name: 'Higienização das mãos · Não conforme',
    checked: true,
  })
  await expect(cell(page, 'Higienização das mãos', 'Não conforme')).toBeChecked()

  // Focus is VISIBLE: the cell wrapper carries the project's focus-visible ring
  // (`focus-within:ring-[3px]`), so a keyboard user can see where they are.
  const ringed = await page.evaluate(() => {
    const el = document.activeElement
    const label = el?.closest('label')
    return label ? label.className.includes('focus-within:ring-[3px]') : false
  })
  expect(ringed, 'a célula focada precisa de um anel de foco visível').toBeTruthy()

  // ONE tab stop per row: Tab from a selected row-1 cell lands in row 2's group,
  // never on another row-1 cell.
  await page.keyboard.press('Tab')
  const afterTab = await focusedCell()
  expect(afterTab?.name).toBe('Uso de EPI · Conforme')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  expect(await focusedCell()).toMatchObject({
    name: 'Uso de EPI · Não se aplica',
    checked: true,
  })

  await page.keyboard.press('Tab')
  expect((await focusedCell())?.name).toBe('Descarte de perfurocortantes · Conforme')
  await page.keyboard.press('Space')
  await expect(cell(page, 'Descarte de perfurocortantes', 'Conforme')).toBeChecked()
  await expect(page.getByText('3 de 3 linhas respondidas')).toBeVisible()

  // Leaving the grid takes exactly one more Tab — the grid is 3 stops, not 9.
  await page.keyboard.press('Tab')
  expect(
    await focusedCell(),
    'um quarto Tab não pode continuar dentro da grade de 3 linhas',
  ).toBeNull()

  // Submit without touching the mouse.
  await page.getByRole('button', { name: 'Revisar' }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: /Enviar respostas/i }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })

  expect(responseStatus(responseId)).toBe('submitted')
  expect(cellsOf(responseId, fixture.items.matrix)).toEqual([
    ['higienizacao', 'nao_conforme'],
    ['epi', 'na'],
    ['descarte', 'conforme'],
  ])
})

// ===========================================================================
// FF2-8 — The server writer is the authority (canonical `save_section_answers`)
//
// The wizard commits both halves of a risk cell together, so the half-answered
// state is unreachable from the UI — which is exactly why it is driven at the
// RPC here: a malformed or older client must not be able to write one.
// ===========================================================================

test('FF2-8 (server authority): save_section_answers refuses a half-answered risk matrix (HC0P8) and an unknown axis code (HC0P7), and ignores a client-supplied risk_score', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const title = `Servidor ${SPEC_TAG} ${Date.now()}`
  const fixture = seedForm(title, ({ versionId, sectionId, id }) => {
    const matrixId = id('matrix')
    const riskId = id('risk')
    return (
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required)\n` +
      `values ('${matrixId}','${sectionId}',0,'matrix','ff2_srv_grade','Avalie cada critério',false);\n` +
      axisInsert('form_matrix_rows', matrixId, versionId, CONFORMIDADE_ROWS) +
      '\n' +
      axisInsert('form_matrix_columns', matrixId, versionId, CONFORMIDADE_COLS) +
      '\n' +
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required)\n` +
      `values ('${riskId}','${sectionId}',1,'risk_matrix','ff2_srv_risco','Classifique o risco',false);\n` +
      axisInsert('form_matrix_rows', riskId, versionId, SEVERITY_ROWS) +
      '\n' +
      axisInsert('form_matrix_columns', riskId, versionId, LIKELIHOOD_COLS)
    )
  })

  await signInAs(page, 'staff1.ccih@test.local')
  const token = await getToken(page, 'staff1.ccih@test.local')
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)

  const save = (body: Record<string, unknown>) =>
    rpcAs<{ code?: string; message?: string }>(page, token, 'save_section_answers', {
      p_response_id: responseId,
      p_section_id: fixture.sectionId,
      ...body,
    })

  // --- A severity with no likelihood: refused, in pt-BR ---------------------
  const half = await save({
    p_risk_matrix: { [fixture.items.risk]: { severity: 'grave' } },
  })
  expect(half.ok, 'uma matriz de risco pela metade foi aceita').toBeFalsy()
  expect(half.json?.code).toBe('HC0P8')
  expect(half.json?.message).toMatch(/severidade e a probabilidade/i)

  // --- An axis code that belongs to no axis of this item -------------------
  const bogus = await save({
    p_matrix_cells: { [fixture.items.matrix]: { nao_existe: 'conforme' } },
  })
  expect(bogus.ok, 'um código de linha inexistente foi aceito').toBeFalsy()
  expect(bogus.json?.code).toBe('HC0P7')

  // A row of THIS item paired with a column of ANOTHER item is refused too —
  // the cross-item coherence arm (INFO-4).
  const crossed = await save({
    p_matrix_cells: { [fixture.items.matrix]: { higienizacao: 'provavel' } },
  })
  expect(crossed.ok, 'uma coluna de outro item foi aceita').toBeFalsy()
  expect(crossed.json?.code).toBe('HC0P7')

  // Nothing partial leaked from any of the three rejected calls.
  expect(cellsOf(responseId, fixture.items.matrix)).toEqual([])
  expect(riskOf(responseId, fixture.items.risk)).toEqual([])

  // --- A client-supplied score is IGNORED, not trusted ---------------------
  // 9 × 3 = 27. The payload also carries `risk_score: 999`; the writer derives
  // from the axis weights and never reads it (ruling 2).
  const good = await save({
    p_risk_matrix: {
      [fixture.items.risk]: { severity: 'grave', likelihood: 'provavel', risk_score: 999 },
    },
  })
  expect(good.ok, `save_section_answers: ${good.text}`).toBeTruthy()
  expect(riskOf(responseId, fixture.items.risk)).toEqual([['grave', 'provavel', '27']])

  // The same call again with a DIFFERENT cell re-derives rather than accumulates
  // (one risk answer per response — `answer_risk_matrix` is unique on answer_id).
  const again = await save({
    p_risk_matrix: {
      [fixture.items.risk]: { severity: 'leve', likelihood: 'frequente', risk_score: 1 },
    },
  })
  expect(again.ok, `save_section_answers (re-save): ${again.text}`).toBeTruthy()
  expect(riskOf(responseId, fixture.items.risk)).toEqual([['leve', 'frequente', '9']])
})

// ===========================================================================
// FF2-9 — BUG-FF2-002: publish must NAME the offending block, not say "tente
// novamente"
//
// `app.validate_matrix_axes` runs inside `publish_form_version`, and an
// axis-less matrix is a NORMAL authoring state (the axes are a separate write,
// so a matrix block exists with an empty grid from the moment it is added).
// `publishVersion` mapped only 23514 and HC080, so both matrix refusals fell to
// MESSAGES.generic — "Não foi possível concluir. Tente novamente." for a
// condition that is neither transient nor retryable, naming no block. This test
// is the guard for the fix, and it asserts the SPECIFIC sentence: an assertion
// that merely required "some error" would have passed before the fix too.
// ===========================================================================

test('FF2-9 (BUG-FF2-002): publishing an axis-less matrix / a weightless risk matrix names the block in pt-BR instead of the generic retry message', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const GENERIC = 'Não foi possível concluir. Tente novamente.'

  // --- HC0P5: a matrix with no axes, authored exactly as an author would ---
  const title = `Publicação ${SPEC_TAG} ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  await createForm(page, title)
  const dialog = await openAddBlock(page, /^Matriz Vários critérios/)
  await dialog.getByLabel('Enunciado da pergunta').fill('Matriz sem grade')
  await submitAddDialog(dialog)

  await page.getByRole('button', { name: 'Publicar' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toBeVisible({ timeout: 10_000 })
  await confirm.getByRole('button', { name: 'Publicar' }).click()

  const banner = page.getByText(/precisa de ao menos uma linha e uma coluna/)
  await expect(banner, 'HC0P5 precisa chegar ao autor nomeando o bloco').toBeVisible({
    timeout: 25_000,
  })
  await expect(banner).toContainText('Matriz sem grade')
  await expect(page.getByText(GENERIC)).toHaveCount(0)
  // The version really did stay a draft — the message is about a refusal.
  const stillDraft = sqlOne(
    `select count(*)::text from public.form_versions v
       join public.forms f on f.id = v.form_id
      where f.title = '${title}' and v.status = 'published';`,
  )
  expect(stillDraft).toBe('0')

  // --- HC0P6: a risk matrix whose axes carry no weights --------------------
  // Unreachable through the axes dialog (it validates weights client-side), so
  // the DRAFT is seeded weightless and published through the real UI button —
  // which is the path a legacy draft or an import would take.
  const riskTitle = `Publicação peso ${SPEC_TAG} ${Date.now()}`
  const formId = randomUUID()
  const versionId = randomUUID()
  const sectionId = randomUUID()
  const riskId = randomUUID()
  psql(
    `set client_encoding to 'UTF8';\n` +
      `insert into public.forms (id, commission_id, title, created_by)\n` +
      `values ('${formId}','${COMMISSION_CCIH}','${riskTitle}','${USER_CHEFE}');\n` +
      `insert into public.form_versions (id, form_id, version_number, status, created_by)\n` +
      `values ('${versionId}','${formId}',1,'draft','${USER_CHEFE}');\n` +
      `insert into public.form_sections (id, form_version_id, position, title, is_default)\n` +
      `values ('${sectionId}','${versionId}',0,null,true);\n` +
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required)\n` +
      `values ('${riskId}','${sectionId}',0,'risk_matrix','ff2_sem_peso','Risco sem peso',false);\n` +
      axisInsert(
        'form_matrix_rows',
        riskId,
        versionId,
        SEVERITY_ROWS.map((r) => ({ code: r.code, label: r.label })),
      ) +
      '\n' +
      axisInsert(
        'form_matrix_columns',
        riskId,
        versionId,
        LIKELIHOOD_COLS.map((c) => ({ code: c.code, label: c.label })),
      ),
  )

  await page.goto(`/o/${ORG}/c/${SLUG}/manage/forms/${formId}`)
  await page.getByRole('button', { name: 'Publicar' }).click()
  const confirm2 = page.getByRole('alertdialog')
  await expect(confirm2).toBeVisible({ timeout: 10_000 })
  await confirm2.getByRole('button', { name: 'Publicar' }).click()

  const banner2 = page.getByText(/exige um peso em todas as linhas e colunas/)
  await expect(banner2, 'HC0P6 precisa chegar ao autor nomeando o bloco').toBeVisible({
    timeout: 25_000,
  })
  await expect(banner2).toContainText('Risco sem peso')
  await expect(page.getByText(GENERIC)).toHaveCount(0)
})

// ===========================================================================
// FF2-10 — Resume (Architecture Rule 3): a saved grid is READ BACK
//
// Every other test in this file asserts the WRITE direction — what reaches the
// database. None of them reloads, so none would notice if `getResponseForFill`
// stopped projecting `matrixCellsByItemId` / `riskMatrixByItemId`: the wizard
// would simply re-render from its own client state and still submit correctly.
// This one exits, re-enters, and asserts the grid comes back CHECKED.
// ===========================================================================

test('FF2-10 (resume): a matrix and a risk selection saved with "Salvar e sair" come back checked, with the score re-derived, and submit from the resumed state', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const title = `Retomada ${SPEC_TAG} ${Date.now()}`
  const fixture = seedForm(title, ({ versionId, sectionId, id }) => {
    const matrixId = id('matrix')
    const riskId = id('risk')
    return (
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required, config)\n` +
      `values ('${matrixId}','${sectionId}',0,'matrix','ff2_retomada','Avalie cada critério',true,null);\n` +
      axisInsert('form_matrix_rows', matrixId, versionId, CONFORMIDADE_ROWS) +
      '\n' +
      axisInsert('form_matrix_columns', matrixId, versionId, CONFORMIDADE_COLS) +
      '\n' +
      // WITH bands this time, so the resumed score also re-derives its band.
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required, config)\n` +
      `values ('${riskId}','${sectionId}',1,'risk_matrix','ff2_retomada_risco','Classifique o risco',false,\n` +
      `        jsonb_build_object('riskBands', jsonb_build_array(\n` +
      `          jsonb_build_object('minScore',1,'label','Baixo'),\n` +
      `          jsonb_build_object('minScore',9,'label','Médio'),\n` +
      `          jsonb_build_object('minScore',27,'label','Alto'))));\n` +
      axisInsert('form_matrix_rows', riskId, versionId, SEVERITY_ROWS) +
      '\n' +
      axisInsert('form_matrix_columns', riskId, versionId, LIKELIHOOD_COLS)
    )
  })

  await signInAs(page, 'staff1.ccih@test.local')
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)

  await cell(page, 'Higienização das mãos', 'Conforme').check()
  await cell(page, 'Uso de EPI', 'Não se aplica').check()
  await riskCell(page, 'Grave', 'Provável').check()
  await expect(page.getByRole('status').filter({ hasText: 'Pontuação:' })).toContainText('27')

  await page.getByRole('button', { name: 'Salvar e sair' }).click()
  await page.waitForURL((url: URL) => !url.pathname.includes('/responder/'), {
    timeout: 25_000,
  })

  // It really is on the server, mid-fill — the read-back below is a read-back,
  // not a re-render of state that never left the browser.
  expect(responseStatus(responseId)).toBe('in_progress')
  expect(cellsOf(responseId, fixture.items.matrix)).toEqual([
    ['higienizacao', 'conforme'],
    ['epi', 'na'],
  ])
  expect(riskOf(responseId, fixture.items.risk)).toEqual([['grave', 'provavel', '27']])

  // --- Re-enter with a COLD page (new context state, fresh load) ------------
  await page.goto('/')
  await enterWizard(page, title)
  expect(responseIdFromUrl(page)).toBe(responseId)

  await expect(cell(page, 'Higienização das mãos', 'Conforme')).toBeChecked({
    timeout: 20_000,
  })
  await expect(cell(page, 'Uso de EPI', 'Não se aplica')).toBeChecked()
  await expect(cell(page, 'Higienização das mãos', 'Não conforme')).not.toBeChecked()
  await expect(page.getByText('2 de 3 linhas respondidas')).toBeVisible()

  // The risk half resumes too, and its score + band are re-DERIVED from the
  // axis weights on load (neither is stored).
  await expect(riskCell(page, 'Grave', 'Provável')).toBeChecked()
  const status = page.getByRole('status').filter({ hasText: 'Pontuação:' })
  await expect(status).toContainText('27')
  await expect(status).toContainText('Alto')

  // --- Finish from the resumed state ---------------------------------------
  await cell(page, 'Descarte de perfurocortantes', 'Não conforme').check()
  await goToReview(page)
  await submitFromReview(page)
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })

  expect(responseStatus(responseId)).toBe('submitted')
  expect(cellsOf(responseId, fixture.items.matrix)).toEqual([
    ['higienizacao', 'conforme'],
    ['epi', 'na'],
    ['descarte', 'nao_conforme'],
  ])
  expect(riskOf(responseId, fixture.items.risk)).toEqual([['grave', 'provavel', '27']])
})

// ===========================================================================
// FF2-11 — BUG-FF2-003 regression guard: the block-type menu stays INSIDE the
// viewport, and both Matrix types stay reachable
//
// FF-2 grew this menu by a separator, a group label and 2 items (+149 px). The
// height cap that should have absorbed that was present in the markup and
// SILENTLY DEAD — a Tailwind 3.4 bare-`[--var]` shorthand that v4 removed, so it
// emitted invalid CSS the parser dropped and `max-height` computed to `none`.
// The menu then rendered 909 px tall past the bottom of a 720-px window, with
// page scroll locked by the modal and no internal scroll of its own: 7 of 14
// items — including both Matrix types — unreachable by mouse AND keyboard.
//
// `e2e/builder-dialog-ui.spec.ts` already asserted `overflow-y` and that the
// last item was clickable, and it did NOT catch this: `overflow-y: auto` was
// genuinely present (it is inert without a cap), and that test runs at a tall
// viewport where the menu happened to fit. So this guard asserts the two things
// that actually distinguish fixed from broken — a RESOLVED px cap, and geometry
// at the viewport where it bit — rather than the presence of a class, which is
// exactly the check that was fooled.
// ===========================================================================

test('FF2-11 (BUG-FF2-003): the block-type menu is capped to the viewport and scrolls, so both Matrix types stay reachable by mouse and keyboard at 1280×720', async ({
  page,
}) => {
  test.setTimeout(180_000)
  // The height the bug was measured at. Explicit, not inherited: this file's
  // test.use() is 1400 px tall, which is precisely where the defect hid.
  await page.setViewportSize({ width: 1280, height: 720 })

  await signInAs(page, 'chefe.ccih@test.local')
  await createForm(page, `Menu ${SPEC_TAG} ${Date.now()}`)
  await page.getByRole('button', { name: 'Adicionar bloco' }).click()
  const menu = page.locator('[data-slot="dropdown-menu-content"]').first()
  await expect(menu).toBeVisible({ timeout: 10_000 })
  // Radix sizes the content from a measured variable; let it settle.
  await expect
    .poll(
      async () => menu.evaluate((el) => getComputedStyle(el).maxHeight !== 'none'),
      { timeout: 10_000, message: 'max-height nunca resolveu para um valor' },
    )
    .toBe(true)

  const geom = await page.evaluate(() => {
    const el = document.querySelector(
      '[data-slot="dropdown-menu-content"]',
    ) as HTMLElement | null
    if (!el) return null
    const r = el.getBoundingClientRect()
    const items = Array.from(el.querySelectorAll('[role="menuitem"]')) as HTMLElement[]
    return {
      maxHeight: getComputedStyle(el).maxHeight,
      overflowY: getComputedStyle(el).overflowY,
      bottom: Math.round(r.bottom),
      viewportH: window.innerHeight,
      scrolls: el.scrollHeight > el.clientHeight,
      itemCount: items.length,
      offscreen: items.filter(
        (i) => i.getBoundingClientRect().bottom > window.innerHeight,
      ).length,
    }
  })
  expect(geom).not.toBeNull()

  // 1. The cap RESOLVED. `none` is the broken state — and note the class was
  //    present in the markup in that state, which is why this asserts the
  //    computed value and not the className.
  expect(geom!.maxHeight, 'o cap de altura precisa resolver para um valor em px').toMatch(
    /^\d+(\.\d+)?px$/,
  )
  // 2. The menu BOX fits the window.
  //
  //    Deliberately NOT asserted: "no item's rect is inside the viewport". Once
  //    the menu scrolls correctly, the items below its fold legitimately have
  //    layout rects past the window — they are CLIPPED by the scroll container,
  //    not lost — so that count is 7 on a healthy menu and would be a false
  //    red. (Measured: it is 7 both before and after the fix; only the reason
  //    differs.) Reachability is the property that actually changed, and step 4
  //    is where it is asserted.
  expect(geom!.bottom).toBeLessThanOrEqual(geom!.viewportH)
  // 3. It really scrolls — `overflow-y: auto` is inert without a cap, so the
  //    overflow assertion only means something alongside this one.
  expect(['auto', 'scroll']).toContain(geom!.overflowY)
  expect(geom!.scrolls, 'o menu precisa rolar internamente, não crescer').toBe(true)

  // 4. The USER-FACING guarantee, keyboard first: walk the whole menu and
  //    require that focusing an item BRINGS IT INTO VIEW. This is what was
  //    impossible before the fix (page scroll locked, menu not scrollable) and
  //    what a user actually needs.
  for (let i = 0; i < geom!.itemCount; i++) {
    await page.keyboard.press('ArrowDown')
    const ok = await page.evaluate(() => {
      const el = document.activeElement
      if (!el) return { within: false, label: null as string | null }
      const r = el.getBoundingClientRect()
      return {
        within: r.top >= 0 && r.bottom <= window.innerHeight,
        label: el.textContent?.slice(0, 30) ?? null,
      }
    })
    expect(ok.within, `item focado fora da viewport: ${ok.label}`).toBe(true)
  }

  // 5. …and by mouse: the FF-2 items themselves open their editor.
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Adicionar bloco' }).click()
  const riskItem = page.getByRole('menuitem', { name: /^Matriz de risco/ })
  await riskItem.scrollIntoViewIfNeeded()
  await riskItem.click({ timeout: 15_000 })
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByLabel('Enunciado da pergunta')).toBeVisible()
})

import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { test, expect, type Page, type Locator } from '@playwright/test'
import { cachedSignIn, accessToken } from './helpers/auth'
import { purgeFormsByTag } from './helpers/purge-forms'

/**
 * FF-3 — Validation Engine (`item_validations`). Acceptance criteria translated
 * from ADR 0090 (rulings 1–5 + Amendments 1–2) and its §Gate keystones.
 *
 * ## Why this file leans on the RENDERED interaction
 *
 * Everything UNDER the UI was already proven by the engineers: the DB seam, both
 * publish arms, `next build`, and 23+4 mutation proofs. What no one had exercised
 * when this spec was written is the **rendered interaction** — and FF-1's lesson is
 * that exactly that seam hid three live bugs behind a green lint/typecheck/unit/
 * pgTAP bar. So the four surfaces frontend named as unverified get first-class
 * tests, driven through the real UI rather than asserted from state:
 *
 *   FF3-1  the rules-editor ENTRY POINT (the shield button on the block card) and
 *          the type picker's coverage restriction.
 *   FF3-2  the dialog's **REPLACE save** — the one with teeth. `setItemValidations`
 *          replaces the item's whole rule list, so if the read-back ever regresses,
 *          opening and saving the dialog silently destroys every rule on the item.
 *          Asserted as: two rules → reopen → save UNTOUCHED → BOTH survive.
 *   FF3-7  inline error placement **per instance** — a violation in repetition 2
 *          must leave repetition 1 unmarked (the arm FF-2's analogous bug hid in).
 *   FF3-8  the `HC0P9` refusal's placement + navigation to the first offender.
 *
 * ## The rest of the contract
 *
 *   FF3-3  `severity=error` blocks submit; an IDENTICAL violation at `warn` does
 *          not, and a `warn` never sets `aria-invalid` (ruling 3 — the error
 *          channel drives that attribute, so a non-blocking rule must stay off it).
 *   FF3-4  `save_section_answers` NEVER rejects on a validation rule (the resume
 *          contract, Rule 3). Asserted on the canonical server path AND as a real
 *          resume of a violating draft.
 *   FF3-5  `required_if`: true→blocks, false→passes, **hidden+required_if→never
 *          blocks** (visibility wins, ruling 4), plus the dynamic required marker
 *          and `aria-required` reflecting the EFFECTIVE value.
 *   FF3-6  the two unary operators are authorable AND **publishable** on choice,
 *          number, date and time targets (the storable-but-unpublishable gap).
 *   FF3-9  keyboard-only, no mouse: rules editor → publish → fill → blocked → fix.
 *   FF3-10 Rule 7 — an author message containing HTML renders as TEXT, never markup.
 *   FF3-11 `required_if` on `matrix` / `risk_matrix` (the client walk skipped these
 *          entirely until 2026-07-28). Row-completeness refusal is **HC011**, not
 *          HC0P9 — HC0P9 is the validation-rule gate; required-ness is its own.
 *   FF3-12 the legacy config-bound lane (Amendment 1) — rows come back with
 *          `ruleId === null` and must still land on the field.
 *   FF3-13 the grant boundary: direct DML on `form_item_validations` is denied to
 *          `authenticated` even though the DEFINER writer succeeds (keystone C5).
 *
 * `contains` / `not_contains` are ABSENT from the operator pickers on purpose
 * (ADR 0090 Amendment 2). Nothing here treats that as a defect.
 *
 * Hermetic: every form is spec-owned (title carries SPEC_TAG), built either
 * through the real authoring UI (where authoring IS the subject) or by a postgres
 * fixture mirroring what `supabase/seed.sql` does. Cleanup deletes by title.
 * Run with --workers=1.
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
const SPEC_TAG = 'FF3-SPEC'
const ORG = 'rede-a'
const SLUG = 'ccih'
const COMMISSION_CCIH = 'a0000000-0000-0000-0000-0000000000a1'
const USER_CHEFE = '00000000-0000-0000-0000-000000000002'
const CHEFE = 'chefe.ccih@test.local'
const STAFF1 = 'staff1.ccih@test.local'
/** Rede B — a different ORGANISATION entirely; the outsider for the read-path boundary. */
const STAFF_B = 'staff1.qual.b@test.local'

/** The banner `handleNext` raises when any field is highlighted. */
const REVISE_BANNER = 'Revise os campos destacados antes de continuar.'

// ---------------------------------------------------------------------------
// Auth / RPC helpers (mirror ff2-matrix.spec.ts)
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await cachedSignIn(page, email, password)
}

/** A real JWT so RLS and every DEFINER gate see the persona's identity. */
async function getToken(
  page: Page,
  email: string,
  password = 'Test1234!',
  actAs?: string,
): Promise<string> {
  // ACT (ADR 0106) — delegates to the shared, hat-aware accessToken
  // (BUG-ACT-RAWGRANT-HATLESS-1): STAFF_B/staff1.qual.b@test.local (staff +
  // staff_admin, 2 role types) otherwise comes back with no active_role claim.
  return accessToken(page, email, password, actAs)
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
// DB helpers — FIXTURE setup/cleanup and DB-TRUTH reads only. No application
// behaviour is ever driven from here; every product write goes through the UI
// or through an RPC under a real persona token.
// ---------------------------------------------------------------------------

function psql(sqlText: string): string {
  return execSync(
    `docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -tA -F "|"`,
    { input: sqlText, encoding: 'utf8' },
  )
    .toString()
    .trim()
}

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
// Fixture builders
// ---------------------------------------------------------------------------

type FixtureForm = {
  formId: string
  versionId: string
  sectionIds: string[]
  items: Record<string, string>
}

/**
 * Build + PUBLISH a spec-owned form. `build` receives id minters and returns the
 * item/option/axis/validation SQL. The helper wraps form/version/section rows
 * and calls `publish_form_version`, so a malformed fixture fails loudly here
 * rather than mid-test.
 */
function seedForm(
  title: string,
  build: (ids: {
    versionId: string
    section: (n?: number) => string
    id: (name: string) => string
  }) => string,
  sectionCount = 1,
): FixtureForm {
  const formId = randomUUID()
  const versionId = randomUUID()
  const sectionIds = Array.from({ length: sectionCount }, () => randomUUID())
  const items: Record<string, string> = {}
  const id = (name: string) => {
    if (!items[name]) items[name] = randomUUID()
    return items[name]
  }
  const section = (n = 0) => sectionIds[n]
  const body = build({ versionId, section, id })
  const sectionSql = sectionIds
    .map(
      (sid, i) =>
        `insert into public.form_sections (id, form_version_id, position, title, is_default)\n` +
        `values ('${sid}','${versionId}',${i},${
          sectionCount === 1 ? 'null' : `'Seção ${i + 1}'`
        },${sectionCount === 1 ? 'true' : 'false'});`,
    )
    .join('\n')
  psql(
    `set client_encoding to 'UTF8';\n` +
      `insert into public.forms (id, commission_id, title, description, created_by)\n` +
      `values ('${formId}','${COMMISSION_CCIH}','${title}','Fixture ${SPEC_TAG}','${USER_CHEFE}');\n` +
      `insert into public.form_versions (id, form_id, version_number, status, created_by)\n` +
      `values ('${versionId}','${formId}',1,'draft','${USER_CHEFE}');\n` +
      `${sectionSql}\n` +
      `${body}\n` +
      `select public.publish_form_version('${versionId}');`,
  )
  return { formId, versionId, sectionIds, items }
}

type ItemSpec = {
  id: string
  section: string
  version: string
  position: number
  type: string
  key?: string | null
  label: string
  required?: boolean
  config?: string | null
  visibleWhen?: string | null
  requiredIf?: string | null
  parent?: string | null
}

function itemInsert(s: ItemSpec): string {
  const j = (v: string | null | undefined) => (v ? `'${v}'::jsonb` : 'null')
  return (
    `insert into public.form_items (id, section_id, form_version_id, position, item_type,` +
    ` question_key, label, required, config, visible_when, required_if, parent_item_id) values (` +
    `'${s.id}','${s.section}','${s.version}',${s.position},'${s.type}',` +
    `${s.key === null ? 'null' : `'${s.key ?? ''}'`},'${s.label}',${s.required ? 'true' : 'false'},` +
    `${j(s.config)},${j(s.visibleWhen)},${j(s.requiredIf)},` +
    `${s.parent ? `'${s.parent}'` : 'null'});`
  )
}

function optionsInsert(
  itemId: string,
  versionId: string,
  opts: { code: string; label: string }[],
): string {
  const values = opts
    .map((o, i) => `('${itemId}','${versionId}',${i},'${o.code}','${o.label}')`)
    .join(',\n    ')
  return `insert into public.form_item_options (item_id, form_version_id, position, code, label) values\n    ${values};`
}

type RuleSpec = {
  item: string
  version: string
  position?: number
  ruleType: string
  config?: string
  severity?: 'error' | 'warn'
  message: string
}

function ruleInsert(r: RuleSpec): string {
  // `message` travels through psql stdin verbatim, so pt-BR accents and the
  // deliberately-HTML-shaped FF3-10 message need no shell escaping. Single
  // quotes inside a message must still be doubled by the caller.
  return (
    `insert into public.form_item_validations (item_id, form_version_id, position, rule_type, config, severity, message) values (` +
    `'${r.item}','${r.version}',${r.position ?? 0},'${r.ruleType}',` +
    `'${r.config ?? '{}'}'::jsonb,'${r.severity ?? 'error'}','${r.message}');`
  )
}

function axisInsert(
  table: 'form_matrix_rows' | 'form_matrix_columns',
  itemId: string,
  versionId: string,
  axis: { code: string; label: string }[],
): string {
  const values = axis
    .map((a, i) => `('${itemId}','${versionId}',${i},'${a.code}','${a.label}')`)
    .join(',\n    ')
  return `insert into public.${table} (item_id, form_version_id, position, code, label) values\n    ${values};`
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

function blockCard(page: Page, label: string): Locator {
  return page.locator('article').filter({ hasText: label }).first()
}

async function openChildAddBlock(
  page: Page,
  parentLabel: string,
  menuName: RegExp,
): Promise<Locator> {
  const card = blockCard(page, parentLabel)
  const trigger = card.getByRole('button', { name: 'Adicionar pergunta ao grupo' })
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  await page.getByRole('menuitem', { name: menuName }).click()
  return page.getByRole('dialog')
}

async function submitAddDialog(dialog: Locator) {
  await dialog.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })
}

async function addQuestion(dialog: Locator, question: string) {
  await dialog.getByLabel('Enunciado da pergunta').fill(question)
  await submitAddDialog(dialog)
}

async function addMultipleChoice(dialog: Locator, question: string, options: string[]) {
  await dialog.getByLabel('Enunciado da pergunta').fill(question)
  await dialog.getByLabel('Opção 1', { exact: true }).fill(options[0])
  for (let i = 1; i < options.length; i++) {
    await dialog.getByRole('button', { name: 'Adicionar opção' }).click()
    await dialog.getByLabel(`Opção ${i + 1}`, { exact: true }).fill(options[i])
  }
  await submitAddDialog(dialog)
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

/**
 * The FF-3 rules editor, opened from ONE block card's shield button. The
 * button's accessible name carries the persisted rule count, which is exactly
 * the read-back FF3-2 depends on — so this helper asserts it rather than
 * matching a count-agnostic pattern.
 */
async function openValidationsDialog(
  page: Page,
  label: string,
  expectCount: number,
): Promise<Locator> {
  const card = blockCard(page, label)
  const expected =
    expectCount === 0
      ? 'Adicionar regras de validação'
      : expectCount === 1
        ? 'Editar regras de validação (1 regra)'
        : `Editar regras de validação (${expectCount} regras)`
  const trigger = card.getByRole('button', { name: expected, exact: true })
  await trigger.scrollIntoViewIfNeeded()
  await expect(trigger).toBeVisible({ timeout: 15_000 })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByRole('heading', { name: 'Regras de validação' }),
  ).toBeVisible({ timeout: 10_000 })
  return dialog
}

/** One rule row of the editor — `<li>`s under the rules `<ol>`, 1-based. */
function ruleRow(dialog: Locator, index: number): Locator {
  return dialog.locator('ol > li').nth(index - 1)
}

async function saveRules(dialog: Locator) {
  await dialog.getByRole('button', { name: 'Salvar regras' }).click()
  await expect(dialog).toBeHidden({ timeout: 20_000 })
}

/**
 * Author one rule into the editor. Every control is addressed by its stable id
 * SUFFIX (validation-rules-editor.tsx) rather than by label text: the `Mínimo` /
 * `Máximo` labels collide with the repeating-group cardinality fields elsewhere
 * in the builder, and Chrome folds a nested <select>'s selected-option text into
 * its accessible name, so `getByLabel` is unreliable for the pickers.
 */
async function fillRule(
  row: Locator,
  spec: {
    ruleType?: string
    severity?: 'error' | 'warn'
    min?: string
    max?: string
    pattern?: string
    op?: string
    questionKey?: string
    message: string
  },
) {
  if (spec.ruleType) {
    await row.locator('select[id$="-type"]').selectOption(spec.ruleType)
  }
  if (spec.severity) {
    await row.locator('select[id$="-severity"]').selectOption(spec.severity)
  }
  if (spec.min !== undefined) await row.locator('input[id$="-min"]').fill(spec.min)
  if (spec.max !== undefined) await row.locator('input[id$="-max"]').fill(spec.max)
  if (spec.pattern !== undefined) {
    await row.locator('input[id$="-pattern"]').fill(spec.pattern)
  }
  if (spec.op) await row.locator('select[id$="-op"]').selectOption(spec.op)
  if (spec.questionKey) {
    await row.locator('select[id$="-question"]').selectOption(spec.questionKey)
  }
  await row.locator('textarea[id$="-message"]').fill(spec.message)
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
  // The URL lands before the wizard renders — without this, the first field
  // lookup races an empty <main> and fails as "label not found" rather than as
  // whatever it is actually testing.
  await waitForWizard(page)
}

/** Block until the wizard has rendered its navigation controls. */
async function waitForWizard(page: Page) {
  await page
    .getByRole('button', { name: /Revisar|Próximo|Continuar|Enviar respostas/ })
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 })
}

function responseIdFromUrl(page: Page): string {
  const m = page.url().match(/\/responder\/([0-9a-f-]{36})/)
  if (!m) throw new Error(`URL não é um wizard de resposta: ${page.url()}`)
  return m[1]
}

/**
 * Advance one step. On the LAST section the control reads "Revisar"; on any
 * earlier one it reads "Próximo" (verified live — not "Continuar").
 */
async function advance(page: Page) {
  const revisar = page.getByRole('button', { name: 'Revisar' })
  const proximo = page.getByRole('button', { name: /^(Próximo|Continuar)/ })
  await revisar.or(proximo).first().waitFor({ state: 'visible', timeout: 20_000 })
  if (await revisar.isVisible()) await revisar.click()
  else await proximo.first().click()
}

/**
 * The visible required marker for ONE question, scoped to its own `<label>` /
 * `<legend>`.
 *
 * NOT scoped with `blockCard`: wizard question blocks are `<section>`/`<div>`,
 * not `<article>` (the builder's cards are), so an `article`-scoped lookup finds
 * zero elements on every wizard page and would report a MISSING marker whether or
 * not one was rendered. Asserted in both directions by FF3-5.
 */
function requiredMarker(page: Page, labelText: string): Locator {
  return page
    .locator('label, legend')
    .filter({ hasText: labelText })
    .locator('[aria-label="obrigatória"]')
}

async function submitFromReview(page: Page) {
  await page.getByRole('button', { name: /Enviar respostas/i }).click({ timeout: 15_000 })
}

/** The response's lifecycle status, straight from the DB. */
function responseStatus(responseId: string): string {
  return sqlOne(`select status from public.responses where id = '${responseId}';`)
}

/**
 * ONE form control, by its accessible label.
 *
 * `getByLabel` alone is ambiguous in this wizard: every input block also renders
 * a "Limpar a resposta de <label>" button and an "Adicionar observação — <label>"
 * button, so a bare label lookup resolves to three elements and fails strict mode
 * with a message that looks like the field is missing. Intersecting with the
 * control tags keeps the assertion about the field itself.
 */
const CONTROL_TAGS = 'input, textarea, select'

function field(scope: Page | Locator, label: string | RegExp): Locator {
  return scope.getByLabel(label).and(scope.locator(CONTROL_TAGS))
}

/** A field's `aria-invalid`, resolved through its accessible label. */
async function ariaInvalid(scope: Page | Locator, label: string | RegExp) {
  return field(scope, label).first().getAttribute('aria-invalid')
}

// ===========================================================================
// FF3-1 — the rules-editor ENTRY POINT + coverage-restricted type picker
// ===========================================================================

test('FF3-1 the shield button opens the rules editor, and the type picker offers only permitted types', async ({
  page,
}) => {
  await signInAs(page, CHEFE)
  const title = `${SPEC_TAG} picker de tipos`
  await createForm(page, title)

  // A top-level number, a short_text, a repeating group with a number child, and
  // a PLAIN group with a number child — the pair that separates
  // `unique_within_group`'s real precondition (a `repeating_group` PARENT) from
  // "is a child of something".
  await addQuestion(await openAddBlock(page, /^Número/), 'Temperatura ambiente')
  await addQuestion(await openAddBlock(page, /^Resposta curta/), 'Código do lote')

  const rgDialog = await openAddBlock(page, /^Grupo repetível/)
  await rgDialog.getByLabel('Título do grupo').fill('Leituras repetidas')
  await submitAddDialog(rgDialog)
  await addQuestion(
    await openChildAddBlock(page, 'Leituras repetidas', /^Número/),
    'Leitura da repetição',
  )

  const gDialog = await openAddBlock(page, /^Grupo Sub-seção/)
  await gDialog.getByLabel('Título do grupo').fill('Bloco simples')
  await submitAddDialog(gDialog)
  await addQuestion(
    await openChildAddBlock(page, 'Bloco simples', /^Número/),
    'Leitura do grupo simples',
  )

  // --- the entry point itself (untested surface 1) ---------------------------
  let dialog = await openValidationsDialog(page, 'Temperatura ambiente', 0)
  await expect(
    dialog.getByText('Nenhuma regra ainda.', { exact: false }),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Adicionar regra' }).click()

  // A top-level number: `number_range` and nothing else.
  const typeSelect = ruleRow(dialog, 1).locator('select[id$="-type"]')
  await expect(typeSelect.locator('option')).toHaveText(['Faixa numérica'])
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toBeHidden()

  // A TOP-LEVEL short_text: the two text rules and nothing else.
  // `unique_within_group` is correctly absent — see FF3-1b for why that is the
  // contract and not an omission.
  dialog = await openValidationsDialog(page, 'Código do lote', 0)
  await dialog.getByRole('button', { name: 'Adicionar regra' }).click()
  await expect(ruleRow(dialog, 1).locator('select[id$="-type"] option')).toHaveText([
    'Quantidade de caracteres',
    'Formato (expressão regular)',
  ])
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toBeHidden()

  // A number child of a REPEATING group: `unique_within_group` IS offered.
  dialog = await openValidationsDialog(page, 'Leitura da repetição', 0)
  await dialog.getByRole('button', { name: 'Adicionar regra' }).click()
  await expect(ruleRow(dialog, 1).locator('select[id$="-type"] option')).toHaveText([
    'Faixa numérica',
    'Sem repetição entre as repetições',
  ])
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toBeHidden()

  // A number child of a PLAIN group: it MUST NOT be offered (ruling 1 coverage).
  dialog = await openValidationsDialog(page, 'Leitura do grupo simples', 0)
  await dialog.getByRole('button', { name: 'Adicionar regra' }).click()
  await expect(ruleRow(dialog, 1).locator('select[id$="-type"] option')).toHaveText([
    'Faixa numérica',
  ])
})

test('FF3-1b unique_within_group is not offered on a TOP-LEVEL item', async ({ page }) => {
  await signInAs(page, CHEFE)
  const title = `${SPEC_TAG} top-level sem unicidade`
  await createForm(page, title)
  await addQuestion(await openAddBlock(page, /^Resposta curta/), 'Texto solto')

  const dialog = await openValidationsDialog(page, 'Texto solto', 0)
  await dialog.getByRole('button', { name: 'Adicionar regra' }).click()
  // ADR 0090 ruling 1: `unique_within_group` applies to "any scalar child of a
  // repeating_group". A top-level item has no group, so the rule is meaningless
  // there and `isValidationRuleAllowed` refuses it server-side
  // (parentItemType !== 'repeating_group'). Offering it in the picker would let
  // an author build a pair the coverage trigger rejects — which is precisely
  // what the picker exists to prevent.
  await expect(
    ruleRow(dialog, 1).locator('select[id$="-type"] option'),
  ).toHaveText(['Quantidade de caracteres', 'Formato (expressão regular)'])
})

// ===========================================================================
// FF3-2 — the REPLACE save. The one with teeth.
// ===========================================================================

test('FF3-2 REPLACE save: two rules survive a no-op reopen-and-save; removing one removes exactly one', async ({
  page,
}) => {
  await signInAs(page, CHEFE)
  const title = `${SPEC_TAG} replace save`
  const formId = await createForm(page, title)
  await addQuestion(await openAddBlock(page, /^Resposta curta/), 'Registro do lote')

  const itemId = sqlOne(
    `select i.id from public.form_items i join public.form_versions v on v.id = i.form_version_id` +
      ` where v.form_id = '${formId}' and i.question_key is not null;`,
  )
  const rulesOf = () =>
    sqlRows(
      `select rule_type, severity, message, position from public.form_item_validations` +
        ` where item_id = '${itemId}' order by position;`,
    )

  // --- author TWO rules in one save ------------------------------------------
  let dialog = await openValidationsDialog(page, 'Registro do lote', 0)
  await dialog.getByRole('button', { name: 'Adicionar regra' }).click()
  await fillRule(ruleRow(dialog, 1), {
    ruleType: 'text_length',
    min: '5',
    message: 'Escreva ao menos 5 caracteres.',
  })
  await dialog.getByRole('button', { name: 'Adicionar regra' }).click()
  await fillRule(ruleRow(dialog, 2), {
    ruleType: 'regex',
    pattern: '^LOTE-',
    severity: 'warn',
    message: 'O padrão usual começa com LOTE-.',
  })
  await saveRules(dialog)

  expect(rulesOf()).toEqual([
    ['text_length', 'error', 'Escreva ao menos 5 caracteres.', '0'],
    ['regex', 'warn', 'O padrão usual começa com LOTE-.', '1'],
  ])

  // --- THE teeth: reopen and save WITHOUT touching anything ------------------
  // `setItemValidations` REPLACES the whole list. If the read-back that seeds
  // the drafts ever regresses, this save sends an empty (or short) list and
  // silently destroys the author's rules. So: both rules must still be there,
  // in the same order, with the same severities — and the dialog must NOT have
  // offered a removal warning, because nothing was removed.
  dialog = await openValidationsDialog(page, 'Registro do lote', 2)
  await expect(ruleRow(dialog, 1).locator('select[id$="-type"]')).toHaveValue(
    'text_length',
  )
  await expect(ruleRow(dialog, 2).locator('select[id$="-type"]')).toHaveValue('regex')
  await expect(ruleRow(dialog, 2).locator('select[id$="-severity"]')).toHaveValue('warn')
  await expect(dialog.getByText(/regras? ser(á|ão) removidas?/)).toHaveCount(0)
  await saveRules(dialog)

  expect(rulesOf()).toEqual([
    ['text_length', 'error', 'Escreva ao menos 5 caracteres.', '0'],
    ['regex', 'warn', 'O padrão usual começa com LOTE-.', '1'],
  ])

  // --- now remove ONE and confirm exactly one goes --------------------------
  dialog = await openValidationsDialog(page, 'Registro do lote', 2)
  await dialog.getByRole('button', { name: 'Remover a regra 1' }).click()
  // The destructive save is surfaced, not silent.
  await expect(dialog.getByText('Ao salvar, 1 regra será removida desta versão.')).toBeVisible()
  await saveRules(dialog)

  // Exactly one gone, and the SURVIVOR is the one that was kept — repositioned
  // to 0, which is what makes `position` the authored order rather than a gap.
  expect(rulesOf()).toEqual([['regex', 'warn', 'O padrão usual começa com LOTE-.', '0']])

  // And the block card's own count reflects it, which is the read path the
  // dialog seeds from.
  await expect(
    blockCard(page, 'Registro do lote').getByRole('button', {
      name: 'Editar regras de validação (1 regra)',
      exact: true,
    }),
  ).toBeVisible()
})

// ===========================================================================
// FF3-3 — error blocks submit, an identical warn does not, warn ≠ aria-invalid
// ===========================================================================

test('FF3-3 an error rule blocks submit; an identical warn rule does not, and never sets aria-invalid', async ({
  page,
}) => {
  const title = `${SPEC_TAG} erro vs aviso`
  const f = seedForm(title, ({ versionId, section, id }) =>
    [
      itemInsert({
        id: id('erro'),
        section: section(),
        version: versionId,
        position: 0,
        type: 'number',
        key: 'temp_erro',
        label: 'Temperatura com erro',
      }),
      itemInsert({
        id: id('aviso'),
        section: section(),
        version: versionId,
        position: 1,
        type: 'number',
        key: 'temp_aviso',
        label: 'Temperatura com aviso',
      }),
      ruleInsert({
        item: id('erro'),
        version: versionId,
        ruleType: 'number_range',
        config: '{"min": 30, "max": 45}',
        severity: 'error',
        message: 'Informe uma temperatura entre 30 e 45 graus.',
      }),
      ruleInsert({
        item: id('aviso'),
        version: versionId,
        ruleType: 'number_range',
        config: '{"min": 30, "max": 45}',
        severity: 'warn',
        message: 'Confira: valor fora da faixa usual.',
      }),
    ].join('\n'),
  )

  await signInAs(page, STAFF1)
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)

  // IDENTICAL violation on both fields — same bounds, same value, different severity.
  await field(page, 'Temperatura com erro').fill('99')
  await field(page, 'Temperatura com aviso').fill('99')

  // The error: author's own pt-BR message, on the error channel.
  await expect(page.getByText('Informe uma temperatura entre 30 e 45 graus.')).toBeVisible()
  expect(await ariaInvalid(page, 'Temperatura com erro')).toBe('true')

  // The warn: visible, advisory, and deliberately NOT on the error channel —
  // marking an input invalid for a rule the server accepts misinforms AT.
  const warnNote = page.getByText('Confira: valor fora da faixa usual.')
  await expect(warnNote).toBeVisible()
  expect(await ariaInvalid(page, 'Temperatura com aviso')).toBeNull()
  // It is a polite live region, not an alert.
  await expect(page.locator('[role="status"]').filter({ hasText: 'valor fora da faixa usual' })).toHaveCount(1)

  // The error blocks progression, so review is unreachable while it stands.
  await advance(page)
  await expect(page.getByText(REVISE_BANNER)).toBeVisible()
  expect(responseStatus(responseId)).toBe('in_progress')

  // Fix ONLY the error. The warn violation is left standing on purpose.
  await field(page, 'Temperatura com erro').fill('37')
  await expect(page.getByText('Informe uma temperatura entre 30 e 45 graus.')).toHaveCount(0)
  await advance(page)

  // The still-violating warn shows on review as an advisory badge and does NOT
  // gate the submit button (ADR 0090 O-1: badge only, no acknowledgement in v1).
  await expect(page.getByRole('heading', { name: '1 alerta a revisar' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('Alertas não impedem o envio.', { exact: false })).toBeVisible()
  await submitFromReview(page)

  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })
  expect(responseStatus(responseId)).toBe('submitted')
  // And the warn-violating value really was accepted, byte for byte.
  expect(
    sqlOne(
      `select a.value::text from public.answers a where a.response_id = '${responseId}'` +
        ` and a.item_id = '${f.items['aviso']}';`,
    ),
  ).toBe('99')
})

// ===========================================================================
// FF3-4 — save_section_answers NEVER rejects on a validation rule
// ===========================================================================

test('FF3-4 save_section_answers accepts a violating value and the draft resumes with it', async ({
  page,
}) => {
  const title = `${SPEC_TAG} contrato de retomada`
  const f = seedForm(title, ({ versionId, section, id }) =>
    [
      itemInsert({
        id: id('n'),
        section: section(),
        version: versionId,
        position: 0,
        type: 'number',
        key: 'medida',
        label: 'Medida controlada',
      }),
      ruleInsert({
        item: id('n'),
        version: versionId,
        ruleType: 'number_range',
        config: '{"min": 10, "max": 20}',
        message: 'Informe um valor entre 10 e 20.',
      }),
    ].join('\n'),
  )

  await signInAs(page, STAFF1)
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)
  const token = await getToken(page, STAFF1)

  // The CANONICAL server path (Rule 3's authority for drafts), with a value that
  // an `error` rule refuses at submit. It must persist regardless: a draft that
  // cannot hold a mid-edit value has no resume contract.
  const saved = await rpcAs(page, token, 'save_section_answers', {
    p_response_id: responseId,
    p_section_id: f.sectionIds[0],
    p_answers: { [f.items['n']]: 999 },
  })
  expect(
    saved.ok,
    `save_section_answers rejeitou um valor que viola uma regra (contrato de retomada): ${saved.text}`,
  ).toBeTruthy()
  expect(sqlOne(`select value::text from public.answers where response_id = '${responseId}';`)).toBe(
    '999',
  )

  // RESUME: reopen the draft. The violating value comes back AND the inline
  // error is shown — resumable and honest at the same time.
  await page.reload()
  await expect(field(page, 'Medida controlada')).toHaveValue('999')
  await expect(page.getByText('Informe um valor entre 10 e 20.')).toBeVisible()
  expect(responseStatus(responseId)).toBe('in_progress')

  // And the submit gate still refuses it, so "save accepts" never means "submit accepts".
  await advance(page)
  await expect(page.getByText(REVISE_BANNER)).toBeVisible()
  expect(responseStatus(responseId)).toBe('in_progress')
})

// ===========================================================================
// FF3-5 — required_if: true blocks, false passes, hidden NEVER blocks
// ===========================================================================

test('FF3-5 required_if blocks when true, passes when false, and never blocks when hidden', async ({
  page,
}) => {
  const title = `${SPEC_TAG} required_if`
  const cond = `{"question_key": "houve", "op": "equals", "value": "sim"}`
  const f = seedForm(title, ({ versionId, section, id }) =>
    [
      itemInsert({
        id: id('gatilho'),
        section: section(),
        version: versionId,
        position: 0,
        type: 'multiple_choice',
        key: 'houve',
        label: 'Houve intercorrência?',
        required: true,
      }),
      optionsInsert(id('gatilho'), versionId, [
        { code: 'sim', label: 'Sim' },
        { code: 'nao', label: 'Não' },
      ]),
      // Always visible; mandatory ONLY when the trigger says "sim".
      itemInsert({
        id: id('detalhe'),
        section: section(),
        version: versionId,
        position: 1,
        type: 'short_text',
        key: 'detalhe',
        label: 'Detalhe da intercorrência',
        requiredIf: cond,
      }),
      // HIDDEN by a condition that is the OPPOSITE of its required_if, so the
      // two can never both hold: visibility must win unconditionally (ruling 4).
      itemInsert({
        id: id('oculto'),
        section: section(),
        version: versionId,
        position: 2,
        type: 'short_text',
        key: 'oculto',
        label: 'Campo oculto exigido',
        visibleWhen: `{"question_key": "houve", "op": "equals", "value": "nao"}`,
        requiredIf: cond,
      }),
    ].join('\n'),
  )

  await signInAs(page, STAFF1)
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)

  const detalhe = field(page, /Detalhe da intercorrência/)

  // --- condition FALSE: not required, no marker, no aria-required ------------
  await page.getByRole('radio', { name: 'Não', exact: true }).check()
  await expect(detalhe).toHaveCount(1)
  expect(await detalhe.getAttribute('aria-required')).toBeNull()
  // No marker while the condition is false — the other half of the pair that
  // makes the "marker appears" assertion below a real observation.
  await expect(requiredMarker(page, 'Detalhe da intercorrência')).toHaveCount(0)
  // The hidden-when-"sim" item is VISIBLE under "não" here — its own required_if
  // is false, so it must not be marked either.
  await expect(field(page, /Campo oculto exigido/)).toBeVisible()

  // Leaving both blank submits cleanly: nothing is effectively required.
  await advance(page)
  await submitFromReview(page)
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })
  expect(responseStatus(responseId)).toBe('submitted')

  // --- condition TRUE: required, marked, announced, and BLOCKING -------------
  await enterWizard(page, title)
  const responseId2 = responseIdFromUrl(page)
  await page.getByRole('radio', { name: 'Sim', exact: true }).check()

  const detalhe2 = field(page, /Detalhe da intercorrência/)
  // The DYNAMIC required marker + aria-required reflect the EFFECTIVE value —
  // this item's `required` column is false; only `required_if` makes it mandatory.
  await expect(detalhe2).toHaveAttribute('aria-required', 'true', { timeout: 10_000 })
  await expect(requiredMarker(page, 'Detalhe da intercorrência')).toHaveCount(1)
  await expect(requiredMarker(page, 'Detalhe da intercorrência')).toBeVisible()

  // Blank → blocked, client and server both.
  await advance(page)
  await expect(page.getByText(REVISE_BANNER)).toBeVisible()
  expect(responseStatus(responseId2)).toBe('in_progress')

  // The hidden item is genuinely absent from the DOM under "sim" — and its
  // required_if is TRUE there. It must still not block. Filling only `detalhe`
  // proves it: if visibility did not win, this submit would be refused.
  await expect(field(page, /Campo oculto exigido/)).toHaveCount(0)
  await detalhe2.fill('Queda sem lesão')
  await advance(page)
  await submitFromReview(page)
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })
  expect(responseStatus(responseId2)).toBe('submitted')

  // DB truth: the hidden+required_if item holds no answer and did not block.
  expect(
    sqlOne(
      `select count(*) from public.answers where response_id = '${responseId2}'` +
        ` and item_id = '${f.items['oculto']}';`,
    ),
  ).toBe('0')
})

// ===========================================================================
// FF3-6 — the two unary operators, authored through the UI and published
//
// This is the regression test for BUG-FF3-002 (fixed in 91f4931), and it is the
// ONLY layer that caught it: the operators were storable per
// `app.is_valid_condition` and publishable per `validate_visible_when`, both
// verified directly against the database, while the one path the UI can actually
// reach — the server action — refused them. It failed CLOSED, so lint, tsc,
// Vitest and pgTAP were all green throughout.
//
// A note against repeating my own mistake when this file is next read: the first
// bug report blamed `isValidCondition`'s `'value' in rec` check. That was WRONG.
// The rejection was one line earlier — `CONDITION_OPS` still held the pre-F3
// seven operators, so `is_empty` failed the allowlist before the value check ran;
// and the builder emits `value: null`, a PRESENT key, so the blamed line never
// fired at all. A visible failing line is a hypothesis until something mutates
// it; the repro only ever proved the symptom.
//
// Hence the publish step below is not decoration. It is the half that had been
// verified only at the DB layer — the layer that missed the bug.
// ===========================================================================

/** Open the item editor for one block by its label. */
async function openItemEditor(page: Page, label: string): Promise<Locator> {
  await blockCard(page, label).getByRole('button', { name: 'Editar bloco' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  return dialog
}

/**
 * Author ONE condition row in a given ConditionBuilder context, scoped to that
 * context's own fieldset — the item editor renders two builders, so an unscoped
 * id-suffix match is ambiguous.
 */
async function authorCondition(
  dialog: Locator,
  contextLabel: string,
  targetLabel: string,
  op: string,
) {
  const toggle = dialog.getByRole('checkbox', { name: contextLabel })
  if ((await toggle.getAttribute('aria-checked')) !== 'true') await toggle.click()
  const row = dialog
    .locator('fieldset')
    .filter({ hasText: contextLabel })
    .locator('li')
    .first()
  await row.locator('select[id$="-target"]').selectOption({ label: targetLabel })
  await row.locator('select[id$="-op"]').selectOption(op)
  // A unary operator takes no operand — the value control is removed outright,
  // so there is no dead control in the keyboard path.
  await expect(row.locator('[id$="-value"]')).toHaveCount(0)
}

async function saveItemEditor(dialog: Locator) {
  await dialog.getByRole('button', { name: /^Salvar/ }).first().click()
  await expect(
    dialog,
    'o editor de perguntas continuou aberto — a gravacao foi recusada',
  ).toBeHidden({ timeout: 15_000 })
}

test('FF3-6 required_if with a unary operator saves and publishes on choice, number, date and time targets', async ({
  page,
}) => {
  await signInAs(page, CHEFE)

  const targets: { block: RegExp; label: string; op: string; options?: string[] }[] = [
    // A CHOICE target first: that is the arm that raised a raw 42883 at publish.
    {
      block: /^Múltipla escolha/,
      label: 'Setor auditado',
      op: 'is_empty',
      options: ['UTI', 'Enfermaria'],
    },
    { block: /^Número/, label: 'Leitos ocupados', op: 'is_not_empty' },
    { block: /^Data/, label: 'Data da auditoria', op: 'is_empty' },
    { block: /^Hora/, label: 'Hora da auditoria', op: 'is_not_empty' },
  ]

  for (const t of targets) {
    const title = `${SPEC_TAG} unario ${t.label} ${t.op}`
    const formId = await createForm(page, title)
    if (t.options) {
      await addMultipleChoice(await openAddBlock(page, t.block), t.label, t.options)
    } else {
      await addQuestion(await openAddBlock(page, t.block), t.label)
    }
    await addQuestion(await openAddBlock(page, /^Resposta curta/), 'Observação final')

    const dialog = await openItemEditor(page, 'Observação final')
    await authorCondition(dialog, 'Obrigatória apenas em certas situações', t.label, t.op)
    await saveItemEditor(dialog)

    // Stored…
    const stored = sqlOne(
      `select coalesce(i.required_if::text, '(null)') from public.form_items i` +
        ` join public.form_versions v on v.id = i.form_version_id` +
        ` where v.form_id = '${formId}' and i.label = 'Observação final';`,
    )
    expect(stored, `required_if gravado para ${t.label}/${t.op}`).toContain(`"op": "${t.op}"`)

    // …and PUBLISHABLE, which is the half that used to raise a raw 42883.
    await publishForm(page)
    expect(
      sqlOne(`select status from public.form_versions where form_id = '${formId}';`),
      `publish com required_if ${t.op} sobre ${t.label}`,
    ).toBe('published')
  }
})

test('FF3-6b item VISIBILITY with a unary operator saves and publishes', async ({ page }) => {
  // The same `isValidCondition` guards `visibleWhen`, so BUG-FF3-002 is not
  // confined to `required_if`: FF-3 added the unary pickers to EVERY condition
  // builder, and this is the long-shipped visibility surface they also appear on.
  await signInAs(page, CHEFE)
  const title = `${SPEC_TAG} visibilidade unaria`
  const formId = await createForm(page, title)
  await addMultipleChoice(await openAddBlock(page, /^Múltipla escolha/), 'Setor auditado', [
    'UTI',
    'Enfermaria',
  ])
  await addQuestion(await openAddBlock(page, /^Resposta curta/), 'Observação final')

  const dialog = await openItemEditor(page, 'Observação final')
  await authorCondition(dialog, 'Aparência Condicional', 'Setor auditado', 'is_not_empty')
  await saveItemEditor(dialog)

  expect(
    sqlOne(
      `select coalesce(i.visible_when::text, '(null)') from public.form_items i` +
        ` join public.form_versions v on v.id = i.form_version_id` +
        ` where v.form_id = '${formId}' and i.label = 'Observação final';`,
    ),
  ).toContain('"op": "is_not_empty"')

  await publishForm(page)
  expect(sqlOne(`select status from public.form_versions where form_id = '${formId}';`)).toBe(
    'published',
  )
})

test('FF3-6c the pickers offer exactly the two unary operators, and no contains/not_contains', async ({
  page,
}) => {
  // ADR 0090 Amendment 2: `contains` / `not_contains` are deliberately absent.
  // This passes today — it is the half of ruling 5 that DID land — and it is what
  // makes BUG-FF3-002 a dead end rather than a missing feature: the operators are
  // offered, and choosing one makes the question unsaveable.
  await signInAs(page, CHEFE)
  const title = `${SPEC_TAG} vocabulario de operadores`
  await createForm(page, title)
  await addMultipleChoice(await openAddBlock(page, /^Múltipla escolha/), 'Setor auditado', [
    'UTI',
    'Enfermaria',
  ])
  await addQuestion(await openAddBlock(page, /^Resposta curta/), 'Observação final')

  const dialog = await openItemEditor(page, 'Observação final')
  const toggle = dialog.getByRole('checkbox', {
    name: 'Obrigatória apenas em certas situações',
  })
  if ((await toggle.getAttribute('aria-checked')) !== 'true') await toggle.click()
  const row = dialog
    .locator('fieldset')
    .filter({ hasText: 'Obrigatória apenas em certas situações' })
    .locator('li')
    .first()
  await row.locator('select[id$="-target"]').selectOption({ label: 'Setor auditado' })

  await expect(row.locator('select[id$="-op"] option')).toHaveText([
    'é igual a',
    'é diferente de',
    'é uma das opções',
    'não foi respondida',
    'foi respondida',
  ])
})

// ===========================================================================
// FF3-7 — per-instance placement + unique_within_group
// ===========================================================================

test('FF3-7 a violation in repetition 2 leaves repetition 1 unmarked; unique_within_group catches a duplicate', async ({
  page,
}) => {
  const title = `${SPEC_TAG} por repetição`
  seedForm(title, ({ versionId, section, id }) =>
    [
      itemInsert({
        id: id('grupo'),
        section: section(),
        version: versionId,
        position: 0,
        type: 'repeating_group',
        key: null,
        label: 'Leituras',
        config: '{"minInstances": 1, "maxInstances": 5}',
      }),
      itemInsert({
        id: id('medida'),
        section: section(),
        version: versionId,
        position: 1,
        type: 'number',
        key: 'medida',
        label: 'Medida',
        parent: id('grupo'),
      }),
      itemInsert({
        id: id('codigo'),
        section: section(),
        version: versionId,
        position: 2,
        type: 'short_text',
        key: 'codigo',
        label: 'Código',
        parent: id('grupo'),
      }),
      ruleInsert({
        item: id('medida'),
        version: versionId,
        ruleType: 'number_range',
        config: '{"min": 0, "max": 10}',
        message: 'Informe um valor entre 0 e 10.',
      }),
      ruleInsert({
        item: id('codigo'),
        version: versionId,
        ruleType: 'unique_within_group',
        message: 'Este código já foi usado em outra repetição.',
      }),
    ].join('\n'),
  )

  await signInAs(page, STAFF1)
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)

  // The group starts EMPTY — `minInstances: 1` is a submit-time bound, not an
  // auto-created first repetition (verified live), so both repetitions are added
  // here.
  const addBtn = page.getByRole('button', { name: 'Adicionar repetição' })
  await expect(addBtn).toBeVisible({ timeout: 15_000 })
  await addBtn.click()
  // One repetition card is an <li> headed "Leituras N de M".
  const rep = (n: number) =>
    page.locator('li').filter({ hasText: new RegExp(`Leituras ${n} de`) }).first()
  await expect(rep(1)).toBeVisible({ timeout: 15_000 })
  await addBtn.click()
  const rep1 = rep(1)
  const rep2 = rep(2)
  await expect(rep2).toBeVisible({ timeout: 15_000 })
  await expect(field(rep2, 'Medida')).toBeVisible({ timeout: 15_000 })

  // Legal in 1, violating in 2 — the arm FF-2's analogous bug hid in.
  await field(rep1, 'Medida').fill('5')
  await field(rep2, 'Medida').fill('77')

  // The message appears exactly ONCE, and it is repetition 2 that is marked.
  await expect(page.getByText('Informe um valor entre 0 e 10.')).toHaveCount(1)
  expect(await field(rep2, 'Medida').getAttribute('aria-invalid')).toBe('true')
  expect(await field(rep1, 'Medida').getAttribute('aria-invalid')).toBeNull()

  // Fix repetition 2, then make the two repetitions COLLIDE on `codigo`.
  await field(rep2, 'Medida').fill('6')
  await expect(page.getByText('Informe um valor entre 0 e 10.')).toHaveCount(0)

  await field(rep1, 'Código').fill('AAA')
  await field(rep2, 'Código').fill('AAA')
  // Both instances hold the same value, so both are in violation — the rule is
  // symmetric, unlike a bounds rule.
  await expect(page.getByText('Este código já foi usado em outra repetição.')).toHaveCount(2)
  await advance(page)
  await expect(page.getByText(REVISE_BANNER)).toBeVisible()
  expect(responseStatus(responseId)).toBe('in_progress')

  // Distinct values clear it on BOTH sides. `unique_within_group` is the only
  // SYMMETRIC rule in the vocabulary — two repetitions violate it jointly, so
  // resolving it on one resolves it on both, including on the peer the user
  // never touched. This is the full contract restored after BUG-FF3-001 (fixed
  // in 8d53b3d); the assertion covers the message AND the a11y channel, since
  // the bug left `aria-invalid="true"` on a field that had become valid.
  await field(rep2, 'Código').fill('BBB')
  await expect(page.getByText('Este código já foi usado em outra repetição.')).toHaveCount(0)
  expect(await field(rep1, 'Código').getAttribute('aria-invalid')).toBeNull()
  expect(await field(rep2, 'Código').getAttribute('aria-invalid')).toBeNull()
  await advance(page)
  await submitFromReview(page)
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })
  expect(responseStatus(responseId)).toBe('submitted')
})

// ===========================================================================
// FF3-6d — SECTION-level `visible_when` with a unary operator
//
// FF3-6b covers the ITEM-level case. This one exists because the first report of
// BUG-FF3-002 asserted the section-level path was "almost certainly identical,
// since it goes through the same `parseVisibleWhen`" — and reasoning from a
// shared code path instead of executing it is precisely how that bug survived
// F1's own verification. So it is executed.
// ===========================================================================

test('FF3-6d section visible_when with a unary operator saves and publishes', async ({
  page,
}) => {
  await signInAs(page, CHEFE)
  const title = `${SPEC_TAG} secao unaria`
  const formId = await createForm(page, title)

  // A question in the DEFAULT section, then a second section conditioned on it.
  // A section may only reference an EARLIER one, so the order matters.
  await addMultipleChoice(await openAddBlock(page, /^Múltipla escolha/), 'Setor auditado', [
    'UTI',
    'Enfermaria',
  ])
  await page.getByRole('button', { name: 'Adicionar seção' }).click()

  const untitled = page.getByRole('region', { name: 'Seção sem título' }).first()
  await untitled.getByRole('button', { name: 'Renomear seção' }).click()
  const rename = page.getByRole('dialog')
  await rename.getByLabel('Título da seção').fill('Detalhes')
  await rename.getByRole('button', { name: 'Salvar' }).click()
  await expect(rename).toBeHidden({ timeout: 15_000 })

  const detalhes = page.getByRole('region', { name: 'Detalhes' })
  await detalhes
    .getByRole('button', { name: 'Configurações da seção (condição e assinatura)' })
    .click()
  const settings = page.getByRole('dialog')
  await settings.getByRole('checkbox', { name: /Visibilidade condicional/i }).check()
  await settings.locator('select[id$="-target"]').selectOption({ label: 'Setor auditado' })
  await settings.locator('select[id$="-op"]').selectOption('is_not_empty')
  // No operand for a unary op — the value control is gone, not merely disabled.
  await expect(settings.locator('[id$="-value"]')).toHaveCount(0)
  await settings.getByRole('button', { name: 'Salvar' }).click()
  await expect(
    settings,
    'as configurações da seção continuaram abertas — a gravação foi recusada',
  ).toBeHidden({ timeout: 15_000 })

  expect(
    sqlOne(
      `select coalesce(sec.visible_when::text, '(null)') from public.form_sections sec` +
        ` join public.form_versions v on v.id = sec.form_version_id` +
        ` where v.form_id = '${formId}' and sec.title = 'Detalhes';`,
    ),
  ).toContain('"op": "is_not_empty"')

  // Publish is the half that raised a raw 42883 on a SECTION condition before.
  await publishForm(page)
  expect(sqlOne(`select status from public.form_versions where form_id = '${formId}';`)).toBe(
    'published',
  )
})

// ===========================================================================
// FF3-6e — the item editor's error channel is not swallowed
//
// Re-check the cell the first bug report called "no message at all". That claim
// was WRONG and the fault was mine: the probe scraped for /A condição/ while the
// action's copy is "Condição de aparência inválida." — no leading article. The
// dialog was refusing with a message the probe could not see.
//
// The input that produced it now SAVES (FF3-6b), so that exact refusal is gone.
// And the builder cannot emit an invalid condition any more: it gates on
// `isRowComplete` and only offers operators from `opsForType`, while
// `app.is_valid_condition` rejects an unknown op outright (verified: it returns
// `f`, so a bogus op is not even insertable to seed one). The invalid-condition
// branch is therefore unreachable from the UI by construction.
//
// What CAN still be proven — and is what the swallow question really asks — is
// that a server-action refusal reaches the user at all. `min > max` on the
// character-limit fields is a reachable action error, so it stands in as the
// positive control for the same `state.error` channel.
// ===========================================================================

test('FF3-6e a server-action refusal surfaces in the item editor instead of hanging it', async ({
  page,
}) => {
  await signInAs(page, CHEFE)
  const title = `${SPEC_TAG} canal de erro`
  const formId = await createForm(page, title)
  await addQuestion(await openAddBlock(page, /^Resposta curta/), 'Campo com limites')

  const dialog = await openItemEditor(page, 'Campo com limites')
  // Deliberately inverted bounds.
  await dialog.getByLabel('Mínimo').fill('9')
  await dialog.getByLabel('Máximo').fill('2')
  await dialog.getByRole('button', { name: /^Salvar/ }).first().click()

  // The refusal is VISIBLE and ANNOUNCED: the dialog stays open and the reason
  // lands in a live region, not merely somewhere in the DOM.
  //
  // Asserted on the live region rather than on one exact sentence, because the
  // copy comes from whichever layer refuses FIRST — here a client pre-flight
  // ("O mínimo de caracteres não pode ser maior que o máximo."), which is more
  // specific than the server action's `configInvalid` and therefore pre-empts it.
  // Pinning the server's wording would have made this test fail while the product
  // behaved correctly, which is exactly what it did on first write.
  const alert = dialog.locator('[role="alert"], [role="status"]')
  await expect(alert.filter({ hasText: /mínimo.*máximo/i })).toHaveCount(1, {
    timeout: 15_000,
  })
  await expect(dialog).toBeVisible()
  // Nothing was persisted behind the refusal.
  expect(
    sqlOne(
      `select coalesce(i.config::text, '(null)') from public.form_items i` +
        ` join public.form_versions v on v.id = i.form_version_id` +
        ` where v.form_id = '${formId}' and i.label = 'Campo com limites';`,
    ),
  ).toBe('(null)')

  // And it recovers: correcting the bounds saves and the bounds land.
  await dialog.getByLabel('Máximo').fill('20')
  await dialog.getByRole('button', { name: /^Salvar/ }).first().click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })
  expect(
    sqlOne(
      `select i.config::text from public.form_items i` +
        ` join public.form_versions v on v.id = i.form_version_id` +
        ` where v.form_id = '${formId}' and i.label = 'Campo com limites';`,
    ),
  ).toContain('"minLength": 9')
})

// ===========================================================================
// FF3-8 — the HC0P9 refusal: placement + navigation to the first offender
// ===========================================================================

test('FF3-8 an HC0P9 refusal places the message on the offending field and navigates to it', async ({
  page,
}) => {
  // Two sections, so "navigates to the first offender" is a real navigation and
  // not a no-op. The offending field lives in section 1; the user submits from
  // the review screen, three steps away.
  const title = `${SPEC_TAG} HC0P9`
  const f = seedForm(
    title,
    ({ versionId, section, id }) =>
      [
        itemInsert({
          id: id('alvo'),
          section: section(0),
          version: versionId,
          position: 0,
          type: 'number',
          key: 'alvo',
          label: 'Valor auditado',
        }),
        itemInsert({
          id: id('outro'),
          section: section(1),
          version: versionId,
          position: 0,
          type: 'short_text',
          key: 'outro',
          label: 'Comentário livre',
        }),
        ruleInsert({
          item: id('alvo'),
          version: versionId,
          ruleType: 'number_range',
          config: '{"min": 1, "max": 9}',
          message: 'O valor auditado precisa ficar entre 1 e 9.',
        }),
      ].join('\n'),
    2,
  )

  await signInAs(page, STAFF1)
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)
  const token = await getToken(page, STAFF1)

  // Fill LEGALLY and walk to review, so the client's own state is clean and it
  // will genuinely attempt the submit (the client is not the boundary — the
  // server is, and this test is about what happens when they disagree).
  await field(page, 'Valor auditado').fill('5')
  await advance(page)
  await field(page, 'Comentário livre').fill('Sem observações')
  await advance(page)
  await expect(page.getByRole('button', { name: /Enviar respostas/i })).toBeVisible({
    timeout: 15_000,
  })

  // Out-of-band, exactly as a second tab would: make the persisted answer
  // violate the rule. `save_section_answers` accepts it (FF3-4's contract), so
  // the disagreement is now real and only `submit_response` can catch it.
  const saved = await rpcAs(page, token, 'save_section_answers', {
    p_response_id: responseId,
    p_section_id: f.sectionIds[0],
    p_answers: { [f.items['alvo']]: 500 },
  })
  expect(saved.ok, `save out-of-band: ${saved.text}`).toBeTruthy()

  await submitFromReview(page)

  // The refusal carries the AUTHOR's own text, and the wizard takes the user to
  // the field — not a bare banner on a screen three steps from the problem.
  await expect(
    page.getByText('O valor auditado precisa ficar entre 1 e 9.').first(),
  ).toBeVisible({ timeout: 25_000 })
  const alvo = field(page, 'Valor auditado')
  await expect(alvo).toBeVisible({ timeout: 15_000 })
  expect(await alvo.getAttribute('aria-invalid')).toBe('true')
  // Deliberately NOT asserted: that the field shows the server's 500. It shows
  // the client's own 5, because the wizard places the refusal onto the existing
  // answer state without re-reading it. That is outside ADR 0090's contract (it
  // only arises under concurrent modification, which is what this test staged on
  // purpose) — recorded as an observation, not asserted as a requirement.
  expect(responseStatus(responseId)).toBe('in_progress')

  // Fixing it lets the submit through, proving the gate was the only obstacle.
  await alvo.fill('4')
  await advance(page)
  await advance(page)
  await submitFromReview(page)
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })
  expect(responseStatus(responseId)).toBe('submitted')
})

// ===========================================================================
// FF3-9 — keyboard-only (CLAUDE.md §8, mandatory)
// ===========================================================================

test('FF3-9 keyboard-only: author a rule in the editor, then hit and clear it in the wizard', async ({
  page,
}) => {
  await signInAs(page, CHEFE)
  const title = `${SPEC_TAG} teclado`
  const formId = await createForm(page, title)
  await addQuestion(await openAddBlock(page, /^Número/), 'Dose administrada')

  const itemId = sqlOne(
    `select i.id from public.form_items i join public.form_versions v on v.id = i.form_version_id` +
      ` where v.form_id = '${formId}' and i.question_key is not null;`,
  )

  // --- the rules editor, no mouse -------------------------------------------
  // Reaching the shield button by Tab alone would walk the whole builder, so the
  // dialog is OPENED from the keyboard on a focused trigger: focus is moved
  // programmatically, then every interaction is a real key event. That keeps the
  // subject honest (the editor's keyboard operability) without asserting the
  // builder's global tab order, which is not FF-3's contract.
  const shield = blockCard(page, 'Dose administrada').getByRole('button', {
    name: 'Adicionar regras de validação',
    exact: true,
  })
  await shield.focus()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Regras de validação' })).toBeVisible({
    timeout: 10_000,
  })

  // "Adicionar regra" — reached by Tab from the dialog, activated by Space.
  const addRule = dialog.getByRole('button', { name: 'Adicionar regra' })
  await addRule.focus()
  await page.keyboard.press(' ')
  await expect(ruleRow(dialog, 1)).toBeVisible()

  // Type picker (single option here), severity, bounds and message — all keys.
  const row = ruleRow(dialog, 1)
  await row.locator('select[id$="-severity"]').focus()
  // A native <select> takes keyboard selection; assert the value actually moved.
  await page.keyboard.press('ArrowDown')
  await expect(row.locator('select[id$="-severity"]')).toHaveValue('warn')
  await page.keyboard.press('ArrowUp')
  await expect(row.locator('select[id$="-severity"]')).toHaveValue('error')

  await row.locator('input[id$="-min"]').focus()
  await page.keyboard.type('1')
  await page.keyboard.press('Tab') // → Máximo
  await page.keyboard.type('10')
  await expect(row.locator('input[id$="-max"]')).toHaveValue('10')

  await row.locator('textarea[id$="-message"]').focus()
  await page.keyboard.type('Dose permitida: de 1 a 10.')

  const save = dialog.getByRole('button', { name: 'Salvar regras' })
  await save.focus()
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden({ timeout: 20_000 })

  expect(
    sqlRows(
      `select rule_type, severity, config::text, message from public.form_item_validations where item_id = '${itemId}';`,
    ),
  ).toEqual([['number_range', 'error', '{"max": 10, "min": 1}', 'Dose permitida: de 1 a 10.']])

  // Publish from the keyboard too — the confirm is an alertdialog.
  const publishBtn = page.getByRole('button', { name: 'Publicar' })
  await publishBtn.focus()
  await page.keyboard.press('Enter')
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toBeVisible({ timeout: 10_000 })
  await confirm.getByRole('button', { name: 'Publicar' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /Editar publicado/ })).toBeVisible({
    timeout: 40_000,
  })

  // --- the wizard's error surface, no mouse ---------------------------------
  await signInAs(page, STAFF1)
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)

  const dose = field(page, 'Dose administrada')
  await dose.focus()
  await page.keyboard.type('50')
  // The error is announced through the field's own error channel.
  await expect(page.getByText('Dose permitida: de 1 a 10.')).toBeVisible()
  expect(await dose.getAttribute('aria-invalid')).toBe('true')
  // `aria-describedby` must actually point at the message, or a screen-reader
  // user hears an invalid field with no reason.
  const describedBy = await dose.getAttribute('aria-describedby')
  expect(describedBy, 'aria-describedby ausente no campo com erro').toBeTruthy()
  const described = page.locator(
    (describedBy ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((v) => `#${v}`)
      .join(', '),
  )
  await expect(described.filter({ hasText: 'Dose permitida: de 1 a 10.' })).toHaveCount(1)

  // Advance by keyboard → blocked.
  const revisar = page.getByRole('button', { name: 'Revisar' })
  await revisar.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText(REVISE_BANNER)).toBeVisible()

  // Clear it by keyboard and submit by keyboard.
  await dose.focus()
  await page.keyboard.press('Control+a')
  await page.keyboard.type('7')
  await expect(page.getByText('Dose permitida: de 1 a 10.')).toHaveCount(0)
  await revisar.focus()
  await page.keyboard.press('Enter')
  const send = page.getByRole('button', { name: /Enviar respostas/i })
  await expect(send).toBeVisible({ timeout: 15_000 })
  await send.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })
  expect(responseStatus(responseId)).toBe('submitted')
})

// ===========================================================================
// FF3-10 — Rule 7: an author message with HTML renders as TEXT
// ===========================================================================

test('FF3-10 an author message containing HTML renders literally, never as markup', async ({
  page,
}) => {
  const title = `${SPEC_TAG} rule 7`
  // Doubled single quotes for psql; the message is otherwise verbatim.
  const evil = '<b>Corrija</b> o valor <img src=x onerror=alert(1)> agora'
  seedForm(title, ({ versionId, section, id }) =>
    [
      itemInsert({
        id: id('n'),
        section: section(),
        version: versionId,
        position: 0,
        type: 'number',
        key: 'n',
        label: 'Valor com marcação',
      }),
      ruleInsert({
        item: id('n'),
        version: versionId,
        ruleType: 'number_range',
        config: '{"min": 1, "max": 5}',
        message: evil,
      }),
    ].join('\n'),
  )

  await signInAs(page, STAFF1)
  await enterWizard(page, title)
  await field(page, 'Valor com marcação').fill('900')

  // The message is present as TEXT, with its angle brackets intact.
  const msg = page.getByText(evil, { exact: false })
  await expect(msg.first()).toBeVisible({ timeout: 15_000 })
  // And no element was created from it: no <b>, no <img>. Scoped to the whole
  // page because the message also travels to the review screen and the banner.
  await expect(page.locator('b', { hasText: 'Corrija' })).toHaveCount(0)
  await expect(page.locator('img[src="x"]')).toHaveCount(0)
  // textContent carries the literal source, which is the positive proof that it
  // was escaped rather than merely stripped.
  expect(await msg.first().textContent()).toContain('<b>Corrija</b>')
})

// ===========================================================================
// FF3-11 — required_if on matrix / risk_matrix (the walk skipped these)
// ===========================================================================

test('FF3-11 a conditionally-required matrix blocks on row-completeness, and never blocks when false or hidden', async ({
  page,
}) => {
  const title = `${SPEC_TAG} matriz required_if`
  const cond = `{"question_key": "auditar", "op": "equals", "value": "sim"}`
  seedForm(title, ({ versionId, section, id }) =>
    [
      itemInsert({
        id: id('gatilho'),
        section: section(),
        version: versionId,
        position: 0,
        type: 'multiple_choice',
        key: 'auditar',
        label: 'Auditar conformidade?',
        required: true,
      }),
      optionsInsert(id('gatilho'), versionId, [
        { code: 'sim', label: 'Sim' },
        { code: 'nao', label: 'Não' },
      ]),
      // Visible always; required ONLY when auditing. `required` is false — the
      // grid's mandatory-ness comes from required_if alone.
      itemInsert({
        id: id('grade'),
        section: section(),
        version: versionId,
        position: 1,
        type: 'matrix',
        key: 'grade',
        label: 'Conformidade observada',
        requiredIf: cond,
      }),
      axisInsert('form_matrix_rows', id('grade'), versionId, [
        { code: 'maos', label: 'Higienização das mãos' },
        { code: 'epi', label: 'Uso de EPI' },
      ]),
      axisInsert('form_matrix_columns', id('grade'), versionId, [
        { code: 'conforme', label: 'Conforme' },
        { code: 'nao_conforme', label: 'Não conforme' },
      ]),
      // Hidden when auditing, required when auditing — they can never both hold.
      itemInsert({
        id: id('oculta'),
        section: section(),
        version: versionId,
        position: 2,
        type: 'matrix',
        key: 'grade_oculta',
        label: 'Matriz oculta exigida',
        visibleWhen: `{"question_key": "auditar", "op": "equals", "value": "nao"}`,
        requiredIf: cond,
      }),
      axisInsert('form_matrix_rows', id('oculta'), versionId, [
        { code: 'a', label: 'Linha A' },
      ]),
      axisInsert('form_matrix_columns', id('oculta'), versionId, [
        { code: 's', label: 'Sim' },
        { code: 'n', label: 'Não' },
      ]),
    ].join('\n'),
  )

  await signInAs(page, STAFF1)
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)

  // --- condition FALSE: the grid requires nothing ---------------------------
  await page.getByRole('radio', { name: 'Não', exact: true }).check()
  // The hidden-when-"sim" matrix is VISIBLE here, which is what makes its
  // absence in the "sim" branch below a real observation rather than a locator
  // that never matches anything.
  await expect(
    page.getByRole('heading', { name: 'Matriz oculta exigida' }),
  ).toBeVisible({ timeout: 10_000 })
  await advance(page)
  await submitFromReview(page)
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })
  expect(responseStatus(responseId)).toBe('submitted')

  // --- condition TRUE: row-completeness is enforced -------------------------
  await enterWizard(page, title)
  const responseId2 = responseIdFromUrl(page)
  await page.getByRole('radio', { name: 'Sim', exact: true }).check()

  // The grid announces its required-ness through the group description
  // (`aria-required` is invalid on role="group" and on role="radio").
  await expect(
    page
      .locator('section, div')
      .filter({ has: page.getByRole('heading', { name: 'Conformidade observada' }) })
      .getByText('Resposta obrigatória.')
      .first(),
  ).toBeVisible({ timeout: 10_000 })

  // Answer ONE of two rows → incomplete → blocked.
  await page.getByRole('radio', { name: 'Higienização das mãos Conforme', exact: true }).check()
  await advance(page)
  await expect(page.getByText(REVISE_BANNER)).toBeVisible()
  expect(responseStatus(responseId2)).toBe('in_progress')

  // Complete it → submits. The hidden matrix is genuinely gone from the DOM —
  // asserted on its rendered LABEL, because a matrix has no labelled form
  // control and `getByLabel` would resolve to 0 whether it were hidden or not.
  await expect(page.getByRole('heading', { name: 'Matriz oculta exigida' })).toHaveCount(0)
  await page.getByRole('radio', { name: 'Uso de EPI Conforme', exact: true }).check()
  await advance(page)
  await submitFromReview(page)
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })
  expect(responseStatus(responseId2)).toBe('submitted')
})

// ===========================================================================
// FF3-12 — the legacy config-bound lane (Amendment 1), ruleId === null
// ===========================================================================

test('FF3-12 a legacy config bound is reported with rule_id null and gates submit server-side, with no authored rule behind it', async ({
  page,
}) => {
  const title = `${SPEC_TAG} limite legado`
  const f = seedForm(title, ({ versionId, section, id }) =>
    [
      // config-bound ONLY — no form_item_validations row at all.
      itemInsert({
        id: id('txt'),
        section: section(),
        version: versionId,
        position: 0,
        type: 'short_text',
        key: 'legado',
        label: 'Campo legado',
        config: '{"minLength": 5}',
      }),
    ].join('\n'),
  )
  expect(
    sqlOne(
      `select count(*) from public.form_item_validations where item_id = '${f.items['txt']}';`,
    ),
    'a faixa legada não deve ter regra autorada por trás',
  ).toBe('0')

  await signInAs(page, STAFF1)
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)
  const token = await getToken(page, STAFF1)

  // The read path must REPORT it — Amendment 1's whole point is that the gate and
  // the list cannot disagree. `ruleId` is null for this lane; the row must still
  // arrive, keyed on the item.
  const savedShort = await rpcAs(page, token, 'save_section_answers', {
    p_response_id: responseId,
    p_section_id: f.sectionIds[0],
    p_answers: { [f.items['txt']]: 'ab' },
  })
  expect(savedShort.ok, `save de valor curto: ${savedShort.text}`).toBeTruthy()

  const errs = await rpcAs<{ item_id: string; rule_id: string | null; message: string }[]>(
    page,
    token,
    'get_response_validation_errors',
    { p_response_id: responseId },
  )
  expect(errs.ok, errs.text).toBeTruthy()
  const rows = errs.json ?? []
  expect(
    rows.length,
    'get_response_validation_errors não reportou a faixa legada (Amendment 1: bloqueado sem nada exibido)',
  ).toBeGreaterThan(0)
  const legacy = rows.find((r) => r.item_id === f.items['txt'])
  expect(legacy, `nenhuma linha para o item legado em ${errs.text}`).toBeTruthy()
  expect(legacy?.rule_id, 'a faixa legada não tem regra autorada, logo rule_id é null').toBeNull()

  // --- and now what the USER experiences, which is NOT the authored-rule path.
  //
  // Verified live: the legacy lane has no client twin at all. It produces no live
  // message, no `aria-invalid`, and does NOT block the advance — the wizard walks
  // happily to the review screen. Enforcement is entirely server-side, and it
  // raises `HC061`, not `HC0P9`; only `HC0P9` carries `validationErrors`, so this
  // refusal arrives as a banner rather than as a message placed on the field.
  //
  // That is asserted here as-is rather than as a defect: the banner carries the
  // author's own question label ("a pergunta \"Campo legado\" exige ao menos 5
  // caractere(s)"), so Amendment 1's actual promise — that being blocked and being
  // told why cannot come apart — holds. What differs from an authored rule is
  // placement and navigation, recorded as an observation for the phase report.
  await page.reload()
  await expect(field(page, 'Campo legado')).toHaveValue('ab')
  expect(
    await ariaInvalid(page, 'Campo legado'),
    'a faixa legada não tem gêmeo no cliente — nada é marcado antes do envio',
  ).toBeNull()

  await advance(page)
  // No client block: the review screen is reached.
  await expect(page.getByRole('button', { name: /Enviar respostas/i })).toBeVisible({
    timeout: 20_000,
  })
  await submitFromReview(page)

  // The SERVER refuses, and says why, naming the question.
  await expect(page.getByText(/exige ao menos 5 caractere/).first()).toBeVisible({
    timeout: 25_000,
  })
  await expect(page.getByText(/Campo legado/).first()).toBeVisible()
  expect(responseStatus(responseId)).toBe('in_progress')

  // A long-enough value submits — proving the bound was the only obstacle.
  const fixed = await rpcAs(page, token, 'save_section_answers', {
    p_response_id: responseId,
    p_section_id: f.sectionIds[0],
    p_answers: { [f.items['txt']]: 'abcdef' },
  })
  expect(fixed.ok, fixed.text).toBeTruthy()
  const after = await rpcAs<unknown[]>(page, token, 'get_response_validation_errors', {
    p_response_id: responseId,
  })
  expect(after.ok, after.text).toBeTruthy()
  expect(after.json ?? []).toEqual([])

  await page.reload()
  await expect(field(page, 'Campo legado')).toHaveValue('abcdef')
  await advance(page)
  await submitFromReview(page)
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })
  expect(responseStatus(responseId)).toBe('submitted')
})

// ===========================================================================
// FF3-14 — the two DATE rule types: `date_range` and `datetime_order`
//
// The remaining two of the six. Values are set through the canonical
// `save_section_answers` path rather than the calendar popover: a `date` renders
// as a `DatePicker` (a button + hidden input), so driving it would test
// react-day-picker's month navigation, not the rule engine. The SUBJECT here is
// the rendered evaluation and the submit gate, and both are asserted after a
// real reload of the wizard.
// ===========================================================================

test('FF3-14 date_range and datetime_order evaluate, render and gate submit', async ({
  page,
}) => {
  const title = `${SPEC_TAG} regras de data`
  const f = seedForm(title, ({ versionId, section, id }) =>
    [
      itemInsert({
        id: id('inicio'),
        section: section(),
        version: versionId,
        position: 0,
        type: 'date',
        key: 'inicio',
        label: 'Início da vigência',
      }),
      itemInsert({
        id: id('fim'),
        section: section(),
        version: versionId,
        position: 1,
        type: 'date',
        key: 'fim',
        label: 'Fim da vigência',
      }),
      ruleInsert({
        item: id('inicio'),
        version: versionId,
        ruleType: 'date_range',
        config: '{"min": "2026-01-01", "max": "2026-12-31"}',
        message: 'A vigência precisa começar dentro de 2026.',
      }),
      // The ONLY cross-field rule in the vocabulary (ADR 0090 ruling 1).
      ruleInsert({
        item: id('fim'),
        version: versionId,
        ruleType: 'datetime_order',
        config: '{"op": "not_before", "question_key": "inicio"}',
        message: 'O fim não pode ser anterior ao início.',
      }),
    ].join('\n'),
  )

  await signInAs(page, STAFF1)
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)
  const token = await getToken(page, STAFF1)

  const save = async (inicio: string, fim: string) => {
    const r = await rpcAs(page, token, 'save_section_answers', {
      p_response_id: responseId,
      p_section_id: f.sectionIds[0],
      p_answers: { [f.items['inicio']]: inicio, [f.items['fim']]: fim },
    })
    // Still the resume contract: a draft holds violating dates too.
    expect(r.ok, `save_section_answers recusou ${inicio}/${fim}: ${r.text}`).toBeTruthy()
    await page.reload()
    await waitForWizard(page)
  }

  const rangeMsg = 'A vigência precisa começar dentro de 2026.'
  const orderMsg = 'O fim não pode ser anterior ao início.'

  // --- date_range: out of bounds, order fine -------------------------------
  await save('2025-06-01', '2025-07-01')
  await expect(page.getByText(rangeMsg)).toHaveCount(1)
  await expect(page.getByText(orderMsg)).toHaveCount(0)
  await advance(page)
  await expect(page.getByText(REVISE_BANNER)).toBeVisible()
  expect(responseStatus(responseId)).toBe('in_progress')

  // --- datetime_order: in bounds, but `fim` precedes `inicio` --------------
  await save('2026-06-01', '2026-03-01')
  await expect(page.getByText(rangeMsg)).toHaveCount(0)
  await expect(page.getByText(orderMsg)).toHaveCount(1)
  await advance(page)
  await expect(page.getByText(REVISE_BANNER)).toBeVisible()
  expect(responseStatus(responseId)).toBe('in_progress')

  // --- the boundary is INCLUSIVE, both rules ------------------------------
  // Equal dates satisfy `not_before`, and 2026-01-01 is exactly `min`. If either
  // bound were exclusive this would still be blocked.
  await save('2026-01-01', '2026-01-01')
  await expect(page.getByText(rangeMsg)).toHaveCount(0)
  await expect(page.getByText(orderMsg)).toHaveCount(0)
  await advance(page)
  await submitFromReview(page)
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })
  expect(responseStatus(responseId)).toBe('submitted')
})

// ===========================================================================
// FF3-15 (ADR 0090 Amendment 4) — `regex` has NO client twin; the server is its
// sole authority.
//
// This is a DELIBERATE removal of live feedback, not a regression. The two
// engines disagree on 13 of 26 measured constructs — `\b` is a word boundary in
// JS and a BACKSPACE in POSIX ARE — and because `handleNext` blocks on
// client-computed errors, a dialect disagreement produced an UNSUBMITTABLE
// response with no server recourse.
//
// The absence is asserted explicitly, per the amendment: if anyone re-mirrors the
// arm, the live message reappears and this test reds. Asserting only "submit is
// refused" would stay green under a re-mirroring.
// ===========================================================================

test('FF3-15 a regex rule gives NO live feedback and is enforced only at submit', async ({
  page,
}) => {
  const title = `${SPEC_TAG} regex sem espelho`
  seedForm(title, ({ versionId, section, id }) =>
    [
      itemInsert({
        id: id('lote'),
        section: section(),
        version: versionId,
        position: 0,
        type: 'short_text',
        key: 'lote',
        label: 'Código do lote',
      }),
      ruleInsert({
        item: id('lote'),
        version: versionId,
        ruleType: 'regex',
        config: '{"pattern": "^LOTE-[0-9]+$"}',
        message: 'Use o formato LOTE-123.',
      }),
    ].join('\n'),
  )

  await signInAs(page, STAFF1)
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)

  await field(page, 'Código do lote').fill('nao-bate')

  // NOTHING live: no message, no `aria-invalid`. The client does not evaluate it.
  await expect(page.getByText('Use o formato LOTE-123.')).toHaveCount(0)
  expect(await ariaInvalid(page, 'Código do lote')).toBeNull()

  // And it does not block navigation either — the client has no opinion at all,
  // which is the whole point: it cannot be wrong and blocking.
  await advance(page)
  await expect(page.getByRole('button', { name: /Enviar respostas/i })).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByText(REVISE_BANNER)).toHaveCount(0)

  // The SERVER refuses, with the author's own pt-BR message placed on the field.
  await submitFromReview(page)
  await expect(page.getByText('Use o formato LOTE-123.').first()).toBeVisible({
    timeout: 25_000,
  })
  expect(responseStatus(responseId)).toBe('in_progress')
  expect(await ariaInvalid(page, 'Código do lote')).toBe('true')

  // A conforming value submits.
  await field(page, 'Código do lote').fill('LOTE-42')
  await advance(page)
  await submitFromReview(page)
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })
  expect(responseStatus(responseId)).toBe('submitted')
})

// ===========================================================================
// FF3-16 (QA r1 M-4) — a `required_if` child of a PLAIN group
//
// `GroupBlock` never received FF-3's props, so such an item announced itself
// OPTIONAL while blocking `Próximo` and `HC011` — the worst pairing for a screen
// reader, since the only signal that the field is mandatory was the refusal.
//
// The keying is the point: a plain-group child answers at TOP LEVEL, so its
// feedback key is the bare item id, NOT the `${instanceId}:${itemId}` shape a
// repeating-group child uses. A fix that reused the instance key would look right
// and mark nothing.
// ===========================================================================

test('FF3-16 a required_if child of a plain group is marked, announced and blocking', async ({
  page,
}) => {
  const title = `${SPEC_TAG} grupo simples required_if`
  const cond = `{"question_key": "houve", "op": "equals", "value": "sim"}`
  seedForm(title, ({ versionId, section, id }) =>
    [
      itemInsert({
        id: id('gatilho'),
        section: section(),
        version: versionId,
        position: 0,
        type: 'multiple_choice',
        key: 'houve',
        label: 'Houve desvio?',
        required: true,
      }),
      optionsInsert(id('gatilho'), versionId, [
        { code: 'sim', label: 'Sim' },
        { code: 'nao', label: 'Não' },
      ]),
      itemInsert({
        id: id('grupo'),
        section: section(),
        version: versionId,
        position: 1,
        type: 'group',
        key: null,
        label: 'Detalhamento',
      }),
      itemInsert({
        id: id('filho'),
        section: section(),
        version: versionId,
        position: 2,
        type: 'short_text',
        key: 'detalhe',
        label: 'Descrição do desvio',
        requiredIf: cond,
        parent: id('grupo'),
      }),
    ].join('\n'),
  )

  await signInAs(page, STAFF1)
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)

  // --- condition FALSE: optional, unmarked, unannounced ---------------------
  await page.getByRole('radio', { name: 'Não', exact: true }).check()
  await expect(field(page, 'Descrição do desvio')).toBeVisible()
  expect(await ariaInvalid(page, 'Descrição do desvio')).toBeNull()
  expect(await field(page, 'Descrição do desvio').getAttribute('aria-required')).toBeNull()
  await expect(requiredMarker(page, 'Descrição do desvio')).toHaveCount(0)

  // --- condition TRUE: marked, announced AND blocking ----------------------
  await page.getByRole('radio', { name: 'Sim', exact: true }).check()
  await expect(field(page, 'Descrição do desvio')).toHaveAttribute('aria-required', 'true', {
    timeout: 10_000,
  })
  await expect(requiredMarker(page, 'Descrição do desvio')).toHaveCount(1)

  // The announcement and the block must agree — that they disagreed is the bug.
  await advance(page)
  await expect(page.getByText(REVISE_BANNER)).toBeVisible()
  expect(responseStatus(responseId)).toBe('in_progress')

  await field(page, 'Descrição do desvio').fill('Temperatura fora da faixa')
  await advance(page)
  await submitFromReview(page)
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })
  expect(responseStatus(responseId)).toBe('submitted')
})

// ===========================================================================
// FF3-17 (QA r1 M-1) — an unanswered PER-INSTANCE `required_if` reaching
// `submit_response`.
//
// QA recorded this as unreachable by E2E. It is reachable — not through the
// wizard's own buttons (the client blocks first, which FF3-5 already proves) but
// through the CANONICAL SERVER PATH, which is where the authority lives anyway.
// The draft is built in the real UI, then `submit_response` is called directly,
// exactly as the section-signoff and matrix specs do for their server arms.
// ===========================================================================

test('FF3-17 submit_response refuses an unanswered per-instance required_if, and accepts once filled', async ({
  page,
}) => {
  const title = `${SPEC_TAG} required_if por repetição`
  const cond = `{"question_key": "tipo", "op": "equals", "value": "sim"}`
  seedForm(title, ({ versionId, section, id }) =>
    [
      itemInsert({
        id: id('grupo'),
        section: section(),
        version: versionId,
        position: 0,
        type: 'repeating_group',
        key: null,
        label: 'Amostras',
        config: '{"minInstances": 1, "maxInstances": 5}',
      }),
      itemInsert({
        id: id('tipo'),
        section: section(),
        version: versionId,
        position: 1,
        type: 'multiple_choice',
        key: 'tipo',
        label: 'Houve não conformidade?',
        parent: id('grupo'),
      }),
      optionsInsert(id('tipo'), versionId, [
        { code: 'sim', label: 'Sim' },
        { code: 'nao', label: 'Não' },
      ]),
      itemInsert({
        id: id('justificativa'),
        section: section(),
        version: versionId,
        position: 2,
        type: 'short_text',
        key: 'justificativa',
        label: 'Justificativa',
        requiredIf: cond,
        parent: id('grupo'),
      }),
    ].join('\n'),
  )

  await signInAs(page, STAFF1)
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)
  const token = await getToken(page, STAFF1)

  const add = page.getByRole('button', { name: 'Adicionar repetição' })
  await add.click()
  const rep1 = page.locator('li').filter({ hasText: /Amostras 1 de/ }).first()
  await expect(rep1).toBeVisible({ timeout: 15_000 })

  // Answer the trigger INSIDE the repetition; leave the conditional child blank.
  await rep1.getByRole('radio', { name: 'Sim', exact: true }).check()

  // The per-instance announcement fires too (the FF-1 instance key path).
  await expect(field(rep1, 'Justificativa')).toHaveAttribute('aria-required', 'true', {
    timeout: 10_000,
  })

  // PERSIST the incomplete state. This has to go through "Salvar e sair", NOT
  // `Revisar`: `handleNext` returns before `persistSection` whenever the client
  // has an error, so navigating would save nothing and leave the instance EMPTY.
  //
  // That distinction is the whole test. On the first draft of this spec the
  // instance was never persisted, `submit_response` refused with **HC0N5** —
  // FF-1's `minInstances` bound, "o bloco Amostras exige ao menos 1 item(ns)
  // preenchido(s)" — and the test passed while never once exercising M-1's arm.
  // A refusal is not evidence until you read WHICH refusal.
  await page.getByRole('button', { name: 'Salvar e sair' }).click()
  await page.waitForURL(/\/forms(\?|$)/, { timeout: 25_000 })

  // The instance is now NON-EMPTY in the database, which is what removes the
  // `minInstances` arm from the picture entirely.
  expect(
    sqlOne(
      `select count(*) from public.answers a` +
        ` where a.response_id = '${responseId}' and a.group_instance_id is not null;`,
    ),
    'the repetition did not persist — the gate below would refuse on minInstances instead',
  ).toBe('1')

  // Now the gate itself, called directly. THIS is M-1's arm.
  const refused = await rpcAs<{ code?: string; message?: string }>(
    page,
    token,
    'submit_response',
    { p_response_id: responseId },
  )
  expect(
    refused.ok,
    'submit_response ACCEPTED a response whose per-instance required_if is unanswered',
  ).toBeFalsy()
  // Pinned NEGATIVELY as well: whatever the completeness arm raises, it must not
  // be the cardinality bound this test was accidentally measuring before.
  expect(
    refused.json?.code,
    `refused with the WRONG rule (${refused.text}) — HC0N5 is minInstances, not required_if`,
  ).not.toBe('HC0N5')
  expect(responseStatus(responseId)).toBe('in_progress')

  // Fill it and the same call succeeds — the positive twin, so the refusal above
  // cannot be passing for an unrelated reason.
  await enterWizard(page, title)
  const rep1again = page.locator('li').filter({ hasText: /Amostras 1 de/ }).first()
  await expect(rep1again).toBeVisible({ timeout: 15_000 })
  await field(rep1again, 'Justificativa').fill('Amostra reprocessada')
  await advance(page)
  await submitFromReview(page)
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })
  expect(responseStatus(responseId)).toBe('submitted')
})

// ===========================================================================
// FF3-18 (QA r1 M-2) — the read path's authorization boundary.
//
// Also recorded as unreachable by E2E; also reachable, because
// `get_response_validation_errors` is a PostgREST RPC an outsider can simply
// call. This is the standard foreign-tenant probe the brief asks for, pointed at
// FF-3's new read path: a rede-B member must learn NOTHING about a rede-A
// response — not the messages, not the item ids, not even the row count.
// ===========================================================================

test('FF3-18 an outsider gets no validation errors for a foreign response, and no leakage', async ({
  page,
}) => {
  const title = `${SPEC_TAG} porta de leitura`
  const f = seedForm(title, ({ versionId, section, id }) =>
    [
      itemInsert({
        id: id('n'),
        section: section(),
        version: versionId,
        position: 0,
        type: 'number',
        key: 'n',
        label: 'Valor auditado',
      }),
      ruleInsert({
        item: id('n'),
        version: versionId,
        ruleType: 'number_range',
        config: '{"min": 1, "max": 9}',
        message: 'Segredo da rede A: informe de 1 a 9.',
      }),
    ].join('\n'),
  )

  await signInAs(page, STAFF1)
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)
  const ownerToken = await getToken(page, STAFF1)

  // A real violation exists, so "no rows" for the outsider cannot be vacuous.
  const saved = await rpcAs(page, ownerToken, 'save_section_answers', {
    p_response_id: responseId,
    p_section_id: f.sectionIds[0],
    p_answers: { [f.items['n']]: 500 },
  })
  expect(saved.ok, saved.text).toBeTruthy()

  const mine = await rpcAs<{ item_id: string; message: string }[]>(
    page,
    ownerToken,
    'get_response_validation_errors',
    { p_response_id: responseId },
  )
  expect(mine.ok, mine.text).toBeTruthy()
  expect(
    (mine.json ?? []).length,
    'the OWNER must see the violation — otherwise the outsider check below proves nothing',
  ).toBeGreaterThan(0)

  // The outsider: a member of a different ORGANISATION entirely.
  // ACT (ADR 0106): either of her 2 real hats denies identically here (a
  // foreign-org negative control) — 'staff_admin' picked arbitrarily.
  const outsiderToken = await getToken(page, STAFF_B, undefined, 'staff_admin')
  // PROVE THE TOKEN IS LIVE first. Without this the boundary assertion below is
  // vacuous by construction — a dead or malformed token yields the same "no rows"
  // as a working authorization gate, and the test would pass with the gate
  // removed entirely.
  const outsiderSelf = await page.request.get(
    `${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`,
    {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${outsiderToken}` },
    },
  )
  expect(
    outsiderSelf.ok(),
    `the outsider token is not usable at all (${await outsiderSelf.text()}) — the ` +
      'boundary check below would prove nothing',
  ).toBeTruthy()
  expect((await outsiderSelf.json()).length, 'the outsider reads nothing at all').toBeGreaterThan(0)
  const theirs = await rpcAs<unknown[]>(page, outsiderToken, 'get_response_validation_errors', {
    p_response_id: responseId,
  })
  // Either a refusal or an empty set is acceptable; leaking a row is not.
  if (theirs.ok) {
    expect(
      theirs.json ?? [],
      'an outsider received validation rows for a foreign response',
    ).toEqual([])
  } else {
    expect([401, 403, 404]).toContain(theirs.status)
  }
  // And the author's message must not appear ANYWHERE in the response body —
  // not in a row, not in an error string.
  expect(
    theirs.text.includes('Segredo da rede A'),
    'the author-supplied message leaked to an outsider',
  ).toBe(false)
})

// ===========================================================================
// FF3-19 (QA r1 B-1) — the flag is flipped by a MIGRATION, not only by seed.sql
//
// `supabase db push` carries migrations, not the seed, and `db reset` will not be
// run against the data-bearing pilot database. With the flip living only in
// `seed.sql`, local dev and this entire suite would be green *because the seed
// turns it on* while the deployed pilot ran with the phase dark.
// ===========================================================================

test('FF3-19 item_validations is enabled by its own migration, not by the seed alone', async ({
  page,
}) => {
  expect(
    sqlOne(
      `select count(*) from supabase_migrations.schema_migrations where version = '20260901000800';`,
    ),
    'the enable migration is not registered — db push would leave the phase dark',
  ).toBe('1')
  expect(sqlOne(`select enabled::text from app.feature_flags where key = 'item_validations';`)).toBe(
    'true',
  )

  // And the user-visible consequence: the rules editor is offered at all. The
  // builder is flag-gated fail-closed, so this is the same claim from the UI side.
  await signInAs(page, CHEFE)
  const title = `${SPEC_TAG} flag por migracao`
  await createForm(page, title)
  await addQuestion(await openAddBlock(page, /^Número/), 'Campo com flag')
  await expect(
    blockCard(page, 'Campo com flag').getByRole('button', {
      name: 'Adicionar regras de validação',
      exact: true,
    }),
  ).toBeVisible({ timeout: 15_000 })
})

// ===========================================================================
// FF3-20 — the builder's regex pre-flight is ADVISORY, never blocking
//
// `'literal' ~ '***=literal'` is TRUE in Postgres while `new RegExp` throws, so a
// JS-compilability gate refused a CORRECT rule. The note stays as a hint; the
// server keeps the real veto (`HC0Q2`).
// ===========================================================================

test('FF3-20 a pattern JS cannot compile is advised against but still saves', async ({ page }) => {
  await signInAs(page, CHEFE)
  const title = `${SPEC_TAG} regex advisory`
  const formId = await createForm(page, title)
  await addQuestion(await openAddBlock(page, /^Resposta curta/), 'Campo com padrão')

  const dialog = await openValidationsDialog(page, 'Campo com padrão', 0)
  await dialog.getByRole('button', { name: 'Adicionar regra' }).click()
  await fillRule(ruleRow(dialog, 1), {
    ruleType: 'regex',
    // Valid POSIX ARE, uncompilable by `new RegExp`.
    pattern: '***=literal',
    message: 'Precisa conter o literal.',
  })

  // Advisory: a polite live region, NOT the blocking error banner.
  await expect(
    dialog.locator('[role="status"]').filter({ hasText: /não foi reconhecido aqui/i }),
  ).toHaveCount(1, { timeout: 10_000 })

  // …and the save goes through anyway.
  await saveRules(dialog)
  const itemId = sqlOne(
    `select i.id from public.form_items i join public.form_versions v on v.id = i.form_version_id` +
      ` where v.form_id = '${formId}' and i.question_key is not null;`,
  )
  expect(
    sqlRows(
      `select rule_type, config::text from public.form_item_validations where item_id = '${itemId}';`,
    ),
  ).toEqual([['regex', '{"pattern": "***=literal"}']])

  // The block card reflects the stored rule, so the save was real.
  await expect(
    blockCard(page, 'Campo com padrão').getByRole('button', {
      name: 'Editar regras de validação (1 regra)',
      exact: true,
    }),
  ).toBeVisible()
})

// ===========================================================================
// FF3-13 — the grant boundary (keystone C5, through an app-reachable door)
// ===========================================================================

test('FF3-13 direct DML on form_item_validations is denied to authenticated, while the DEFINER writer succeeds', async ({
  page,
}) => {
  const title = `${SPEC_TAG} porta`
  const f = seedForm(title, ({ versionId, section, id }) =>
    itemInsert({
      id: id('n'),
      section: section(),
      version: versionId,
      position: 0,
      type: 'number',
      key: 'n',
      label: 'Campo da porta',
    }),
  )
  // Clone to a DRAFT: the published version is immutable, so the writer needs a
  // draft to write into (Rule 5).
  const draftVersion = sqlOne(
    `select public.clone_form_version('${f.versionId}')::text;`,
  )
  const draftItem = sqlOne(
    `select id from public.form_items where form_version_id = '${draftVersion}' and question_key = 'n';`,
  )

  await signInAs(page, CHEFE)
  const token = await getToken(page, CHEFE)

  // The DEFINER door works for the staff_admin who owns the commission.
  const viaDoor = await rpcAs(page, token, 'set_item_validations', {
    p_item_id: draftItem,
    p_rules: [
      {
        rule_type: 'number_range',
        config: { min: 1, max: 3 },
        severity: 'error',
        message: 'Entre 1 e 3.',
        position: 0,
      },
    ],
  })
  expect(viaDoor.ok, `set_item_validations pela porta: ${viaDoor.text}`).toBeTruthy()
  expect(
    sqlOne(`select count(*) from public.form_item_validations where item_id = '${draftItem}';`),
  ).toBe('1')

  // The same identity writing DIRECTLY is refused at the GRANT, not merely at a
  // policy — `authenticated` holds SELECT only on this table (ADR 0090 §6
  // correction: the stricter matrix-table posture, not form_item_options').
  const direct = await page.request.post(`${SUPABASE_URL}/rest/v1/form_item_validations`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      item_id: draftItem,
      form_version_id: draftVersion,
      position: 9,
      rule_type: 'number_range',
      config: { min: 0 },
      severity: 'error',
      message: 'Inserida por fora.',
    },
  })
  const directBody = await direct.text()
  expect(direct.status(), `INSERT direto deveria ser negado: ${directBody}`).toBe(403)
  // 42501 = denied at the GRANT, which is the stronger claim than "a policy
  // filtered it": `authenticated` holds SELECT only on this table (ADR 0090 §6
  // correction — the stricter matrix-table posture, not form_item_options').
  expect(JSON.parse(directBody).code).toBe('42501')
  // Nothing landed.
  expect(
    sqlOne(`select count(*) from public.form_item_validations where item_id = '${draftItem}';`),
  ).toBe('1')

  // A reader may still READ (the base member/admin SELECT arm survives).
  const read = await page.request.get(
    `${SUPABASE_URL}/rest/v1/form_item_validations?item_id=eq.${draftItem}&select=rule_type`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` } },
  )
  expect(read.ok(), await read.text()).toBeTruthy()
  expect(await read.json()).toEqual([{ rule_type: 'number_range' }])
})

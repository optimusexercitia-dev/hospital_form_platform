import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { test, expect, type Page, type Locator } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'

/**
 * FF-4 — Power Authoring (`power_authoring`). Acceptance criteria translated from
 * ADR 0092 (rulings 1-9) and BOTH amendments.
 *
 * ## What this file does NOT re-test
 *
 * The DB layer (the 4 DEFINER doors, the 9 gate keystones incl. the over-grant
 * twin, `library_reader_non_writer`'s DELETE arm) is already mutation-proven in
 * pgTAP. What that does NOT prove is the WIRED SEAM — the lesson every FF phase
 * has repeated: FF-1 shipped actions still throwing `not implemented` past a
 * fully green DB+unit bar, and only E2E caught it. This file exercises exactly
 * that seam, through the REAL dialogs (`SaveToLibraryDialog`, `BlockLibraryPicker`,
 * `EditLibraryEntryDialog`) a real author clicks.
 *
 *   FF4-1  the headline round trip — save a RICH block (choice options + a LIVE
 *          validation rule + a matrix + a reference config, inside a repeating
 *          group) → insert into another draft of the same commission → publish →
 *          fill → submit. Every child survives, under NEW ids (a real copy).
 *   FF4-2  ruling 4 / Amendment 1 — inserting the SAME block into the SAME
 *          version twice forces a collision; the rename list is READ-ONLY (no
 *          edit affordance — `question_key` has no rename door anywhere), and a
 *          ZERO-collision insert renders no rename panel at all.
 *   FF4-3  ruling 3 — a subtree whose internal condition reaches a `question_key`
 *          OUTSIDE itself is refused at SAVE, in pt-BR, naming the offending key.
 *   FF4-4  rulings 5-6 — `today` + `current_user_name` prefill the wizard from
 *          the response's OWN `started_at` (never a live clock); the segmented
 *          control's literal/dynamic modes are mutually exclusive BY
 *          CONSTRUCTION (switching modes removes the other control, and the DB
 *          XOR is proven); resuming an edited-or-cleared answer never re-seeds it.
 *   FF4-5  ruling 1 — a staff_admin of a DIFFERENT commission (same org) neither
 *          sees nor can insert another commission's entries — through the UI,
 *          through a direct RPC call, and through a direct REST read.
 *   FF4-6  Amendment 2 — rename/re-describe and delete are real, live doors; the
 *          load-bearing assertion is that deleting an entry never disturbs a
 *          form already built from it (inserts materialize copies, not links).
 *   FF4-7  keyboard-only (CLAUDE.md §8) — open the library, browse to an entry,
 *          insert it, then delete a DIFFERENT entry through its confirm. No mouse.
 *
 * `power_authoring` is ON via `seed.sql`; `form_block_library` starts EMPTY.
 * `Adicionar bloco`'s menu order puts "Da biblioteca…" LAST (after Perguntas,
 * Conteúdo, Matrizes, Referências, Estrutura) — every flag that gates an earlier
 * section (`repeating_groups`/`matrix_fields`/`entity_refs`) is also ON, so the
 * keyboard walk in FF4-7 budgets generously for it.
 *
 * Hermetic: every form/library-entry name carries SPEC_TAG; cleanup deletes by
 * NAME/TITLE, never by position (the "positional cleanup eats seed rows" scar —
 * `form_block_library` starts at 0 rows and this file is the only writer to it
 * during its own run, but cleanup still filters by the tag rather than assuming
 * that). Run with --workers=1.
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin, CCIH (Rede A)      — author
 *   chefe.farm@test.local   staff_admin, Farmácia (Rede A)  — cross-commission
 *   staff1.ccih@test.local  staff, CCIH ("Enfermeiro CCIH Um") — respondent
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
const SPEC_TAG = 'FF4-SPEC'
const ORG = 'rede-a'
const SLUG_CCIH = 'ccih'
const SLUG_FARM = 'farmacia'
const COMMISSION_CCIH = 'a0000000-0000-0000-0000-0000000000a1'
const USER_CHEFE = '00000000-0000-0000-0000-000000000002'
const CHEFE = 'chefe.ccih@test.local'
const CHEFE_FARM = 'chefe.farm@test.local'
const STAFF1 = 'staff1.ccih@test.local'
const STAFF1_NAME = 'Enfermeiro CCIH Um'

/** The two seeded org-A "department" participants (FF-5's fixture, non-PHI). */
const PART_UTI = 'e0000000-0000-0000-0000-0000000000d1' // "UTI Adulto"

/** Curly quotes — every FF-4 aria-label/heading uses “ ”, never straight quotes. */
const LQ = '“'
const RQ = '”'
const q = (s: string) => `${LQ}${s}${RQ}`

// ---------------------------------------------------------------------------
// Auth / RPC helpers (mirror ff5-references.spec.ts)
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await cachedSignIn(page, email, password)
}

/** A real JWT so RLS and every DEFINER gate see the persona's identity. */
async function getToken(page: Page, email: string, password = 'Test1234!'): Promise<string> {
  const resp = await page.request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password },
  })
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
 * Delete every spec-owned form AND every spec-owned library entry, by NAME —
 * never by position (the seed-eating scar). `form_block_library` starts at 0
 * rows for this whole environment, so a name-scoped delete here can never
 * touch a row this file did not create.
 *
 * ⚠ Deliberately EXPLICIT, table-by-table, rather than one `delete from forms`
 * under `session_replication_role = replica`. That single-statement pattern
 * (copied from ff1/ff2/ff3/ff5's own `purge()`) turns out NOT to be hermetic:
 * `replica` mode disables the FK-CASCADE triggers themselves, not merely the
 * app-level immutability guards it is meant to bypass — so a bare
 * `delete from forms` under `replica` deletes the `forms` row while leaving
 * `form_versions`/`form_items`/… ORPHANED (no parent, unreachable by any
 * query the app ever issues). Proven live: this file's own early iterations
 * left 4 orphaned draft versions behind, and a database-wide sweep during
 * debugging found 46 MORE pre-existing orphans plus 2 orphaned PUBLISHED
 * versions with real `responses`/`answers` under them — evidence this is a
 * standing, silent leak in the shared pattern, not a one-off. (Confirmed by
 * controlled test: deleting the SAME row under a NORMAL, non-replica session
 * cascades correctly.) Filed for the team; this file works around it instead
 * of depending on a fix landing first.
 */
function purge() {
  psql(
    `set session_replication_role = replica;\n` +
      `create temp table _purge_versions as\n` +
      `  select fv.id from public.form_versions fv join public.forms f on f.id = fv.form_id\n` +
      `   where f.title like '%${SPEC_TAG}%';\n` +
      `create temp table _purge_responses as\n` +
      `  select r.id from public.responses r where r.form_version_id in (select id from _purge_versions);\n` +
      `delete from public.answer_selected_options where answer_id in (select a.id from public.answers a where a.response_id in (select id from _purge_responses));\n` +
      `delete from public.answer_matrix_cells where answer_id in (select a.id from public.answers a where a.response_id in (select id from _purge_responses));\n` +
      `delete from public.answer_risk_matrix where answer_id in (select a.id from public.answers a where a.response_id in (select id from _purge_responses));\n` +
      `delete from public.answer_references where answer_id in (select a.id from public.answers a where a.response_id in (select id from _purge_responses));\n` +
      `delete from public.answers where response_id in (select id from _purge_responses);\n` +
      `delete from public.response_group_instances where response_id in (select id from _purge_responses);\n` +
      `delete from public.response_section_signoffs where response_id in (select id from _purge_responses);\n` +
      `delete from public.responses where id in (select id from _purge_responses);\n` +
      `delete from public.form_item_options where form_version_id in (select id from _purge_versions);\n` +
      `delete from public.form_matrix_rows where form_version_id in (select id from _purge_versions);\n` +
      `delete from public.form_matrix_columns where form_version_id in (select id from _purge_versions);\n` +
      `delete from public.form_item_validations where form_version_id in (select id from _purge_versions);\n` +
      `delete from public.form_items where form_version_id in (select id from _purge_versions);\n` +
      `delete from public.form_sections where form_version_id in (select id from _purge_versions);\n` +
      `delete from public.form_versions where id in (select id from _purge_versions);\n` +
      `delete from public.forms where title like '%${SPEC_TAG}%';\n` +
      `delete from public.form_block_library where name like '%${SPEC_TAG}%';`,
  )
}

test.beforeAll(() => {
  purge()
})
test.afterAll(() => {
  purge()
})

// ---------------------------------------------------------------------------
// Fixture builder — a DRAFT-only form (never published), so `BlockCard`'s
// authoring controls ("Salvar na biblioteca" included) render on it. Mirrors
// ff3-validations.spec.ts's `seedForm`, minus the `publish_form_version` call.
// ---------------------------------------------------------------------------

type DraftFixture = {
  formId: string
  versionId: string
  sectionId: string
  items: Record<string, string>
}

function seedDraftForm(
  title: string,
  build: (ids: { versionId: string; sectionId: string; id: (name: string) => string }) => string,
): DraftFixture {
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
      `${body}\n`,
  )
  return { formId, versionId, sectionId, items }
}

// ---------------------------------------------------------------------------
// Builder-UI helpers (mirror ff1/ff5)
// ---------------------------------------------------------------------------

async function createForm(page: Page, title: string): Promise<string> {
  await page.goto(`/o/${ORG}/c/${SLUG_CCIH}/manage/forms`)
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

/** One block card, by the label text it contains (ff1/ff5's convention). */
function blockCard(page: Page, label: string): Locator {
  return page.locator('article').filter({ hasText: label }).first()
}

async function saveToLibrary(
  page: Page,
  itemLabel: string,
  name: string,
  description?: string,
): Promise<void> {
  const card = blockCard(page, itemLabel)
  await card.getByRole('button', { name: 'Salvar na biblioteca' }).scrollIntoViewIfNeeded()
  await card.getByRole('button', { name: 'Salvar na biblioteca' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await dialog.getByLabel('Nome').fill(name)
  if (description) await dialog.getByLabel(/Descrição/).fill(description)
  await dialog.getByRole('button', { name: 'Salvar na biblioteca' }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })
}

/** FF-4 — open the "Da biblioteca…" picker from the top-level "Adicionar bloco"
 *  menu. The returned locator is name-scoped to the BROWSE/RESULT headings only,
 *  so it never collides with a nested edit dialog (`Editar “X”`) or the delete
 *  confirm (a DIFFERENT role, `alertdialog`). */
async function openLibraryPicker(page: Page): Promise<Locator> {
  const trigger = page.getByRole('button', { name: 'Adicionar bloco' })
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  await page.getByRole('menuitem', { name: /^Da biblioteca/ }).click()
  const dialog = page.getByRole('dialog', { name: /Biblioteca de blocos|Bloco inserido/ })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  return dialog
}

async function insertFromLibrary(dialog: Locator, entryName: string): Promise<void> {
  await dialog.getByRole('button', { name: `Inserir ${q(entryName)}` }).click()
  await expect(dialog.getByRole('heading', { name: 'Bloco inserido' })).toBeVisible({
    timeout: 15_000,
  })
}

async function closeResultDialog(dialog: Locator): Promise<void> {
  await dialog.getByRole('button', { name: 'Concluir' }).click()
  await expect(dialog).toBeHidden({ timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// Wizard helpers (mirror ff1/ff2/ff5)
// ---------------------------------------------------------------------------

async function enterWizard(page: Page, formTitle: string) {
  await page.goto(`/o/${ORG}/c/${SLUG_CCIH}/forms`)
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

async function advance(page: Page) {
  const revisar = page.getByRole('button', { name: 'Revisar' })
  const proximo = page.getByRole('button', { name: /^(Próximo|Continuar)/ })
  await revisar.or(proximo).first().waitFor({ state: 'visible', timeout: 20_000 })
  if (await revisar.isVisible()) await revisar.click()
  else await proximo.first().click()
}

async function submitFromReview(page: Page) {
  await page.getByRole('button', { name: /Enviar respostas/i }).click({ timeout: 15_000 })
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })
}

function responseStatus(responseId: string): string {
  return sqlOne(`select status from public.responses where id = '${responseId}';`)
}

function instanceRegion(page: Page, groupLabel: string, ordinal: string): Locator {
  return page.getByRole('region', { name: `${groupLabel} ${ordinal}` })
}

async function addInstance(page: Page) {
  await page.getByRole('button', { name: 'Adicionar repetição' }).click({ timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// Keyboard-only helpers (FF4-7). The established convention (ff3-9) is to
// FOCUS the entry-point trigger programmatically — reaching it by Tab alone
// would assert the whole builder's global tab order, which is not this
// phase's contract — then drive every subsequent step with real key events.
// ---------------------------------------------------------------------------

/** Press ArrowDown (Radix menu roving focus) until the focused menu item's own
 *  text matches. Mirrors ff5's `arrowToOption`. Reports the whole observed
 *  sequence on failure — cheaper to read than a trace when the menu never
 *  opened at all (every step reads the trigger's own label). */
async function arrowDownUntilLabelled(page: Page, matchText: RegExp, maxSteps = 30): Promise<void> {
  const seen: string[] = []
  for (let i = 0; i < maxSteps; i++) {
    const label = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.textContent?.trim() ?? '',
    )
    seen.push(label)
    if (matchText.test(label)) return
    await page.keyboard.press('ArrowDown')
    // Radix's roving-tabindex focus() lands a beat after the keydown handler
    // runs (observed empirically: reading immediately re-sees the PREVIOUS
    // item for several steps before it starts to move at all) — a short
    // settle avoids racing that.
    await page.waitForTimeout(60)
  }
  throw new Error(
    `arrowDownUntilLabelled: never reached an item matching ${matchText}. Saw: ${JSON.stringify(seen)}`,
  )
}

/** The `DialogContent` close-X (`aria-label="Fechar"`, icon-only, no visible
 *  text) and the picker's own footer "Fechar" button share the SAME
 *  accessible name — `hasText` disambiguates because only the footer button
 *  has actual text content (the X icon is `aria-hidden`). */
function closeBrowseButton(dialog: Locator): Locator {
  return dialog.getByRole('button', { name: 'Fechar', exact: true }).filter({ hasText: 'Fechar' })
}

/** Press Tab until the focused element's `aria-label` (or text) matches. A
 *  dialog traps focus, so this is safe to run inside one — it can never Tab
 *  out to the page behind it. Budgeted generously: earlier tests in this file
 *  may leave OTHER spec-owned entries in the list (cleanup runs once, in
 *  `afterAll`), each adding up to 3 more tab stops. */
async function tabUntilLabelled(
  page: Page,
  matchText: string,
  opts: { exact?: boolean } = {},
  maxSteps = 60,
): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      // Only a REAL <button> counts. When a view swap (browse → result)
      // unmounts the previously-focused element, the browser drops focus
      // back to a large ancestor (often <body>, sometimes the dialog's own
      // content container) — and that ancestor's textContent can trivially
      // CONTAIN the target string (e.g. document.body contains everything on
      // the page), producing a false "match" on an element Enter cannot
      // actually activate. Requiring BUTTON rules that out; every target this
      // helper is used for in this file (Concluir / Excluir / Inserir "X" /
      // Editar "X") really is a <button>.
      if (!el || el.tagName !== 'BUTTON') return null
      return el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''
    })
    const hit = label !== null && (opts.exact ? label === matchText : label.includes(matchText))
    if (hit) return
    await page.keyboard.press('Tab')
    // Same settle as `arrowDownUntilLabelled` — matters most right after a
    // view swap (browse → result), where the whole focused subtree is
    // replaced and focus needs a beat to land on the new DOM.
    await page.waitForTimeout(60)
  }
  throw new Error(`tabUntilLabelled: never focused an element matching "${matchText}"`)
}

// ===========================================================================
// FF4-1 — the headline round trip
// ===========================================================================

test('FF4-1 save a rich block (options + a LIVE validation rule + a matrix + a reference, inside a repeating group) → insert → publish → fill → submit, every child intact under NEW ids', async ({
  page,
}) => {
  test.setTimeout(150_000)
  await signInAs(page, CHEFE)

  // --- source: a draft-only SQL fixture. The SUBJECT here is the round trip,
  // not authoring a matrix/validation/choice item — each is already proven by
  // FF-2/FF-3/FF-5's own E2E suites (mirrors FF5-10's identical justification).
  // NOTE: the source title deliberately shares NO words with `libraryName`
  // below — the picker's provenance line ("de "{sourceFormTitle}"") would
  // otherwise substring-collide with a plain `getByText(libraryName)` lookup.
  const rich = seedDraftForm(`${SPEC_TAG} origem 1`, ({ versionId, sectionId, id }) => {
    const container = id('container')
    const choice = id('choice')
    const text = id('text')
    const matrix = id('matrix')
    const reference = id('reference')
    return [
      `insert into public.form_items (id, section_id, form_version_id, position, item_type, label, required)`,
      `values ('${container}','${sectionId}','${versionId}',0,'repeating_group','Registros de auditoria',false);`,
      `insert into public.form_items (id, section_id, form_version_id, position, item_type, question_key, label, required, parent_item_id)`,
      `values ('${choice}','${sectionId}','${versionId}',1,'multiple_choice','classificacao_seed','Classificação do achado',true,'${container}');`,
      `insert into public.form_items (id, section_id, form_version_id, position, item_type, question_key, label, required, parent_item_id)`,
      `values ('${text}','${sectionId}','${versionId}',2,'short_text','codigo_registro_seed','Código do registro',false,'${container}');`,
      `insert into public.form_items (id, section_id, form_version_id, position, item_type, question_key, label, required, parent_item_id)`,
      `values ('${matrix}','${sectionId}','${versionId}',3,'matrix','avaliacao_criterio_seed','Avaliação do critério',false,'${container}');`,
      `insert into public.form_items (id, section_id, form_version_id, position, item_type, question_key, label, required, parent_item_id, config)`,
      `values ('${reference}','${sectionId}','${versionId}',4,'reference','setor_envolvido_seed','Setor envolvido no achado',false,'${container}',`,
      `  jsonb_build_object('referenceKind','participant','participantTypes',jsonb_build_array('department')));`,
      `insert into public.form_item_options (item_id, form_version_id, position, code, label) values`,
      `  ('${choice}','${versionId}',0,'leve','Leve'),`,
      `  ('${choice}','${versionId}',1,'moderado','Moderado'),`,
      `  ('${choice}','${versionId}',2,'grave','Grave');`,
      `insert into public.form_matrix_rows (item_id, form_version_id, position, code, label) values`,
      `  ('${matrix}','${versionId}',0,'criterio_a','Critério A'),`,
      `  ('${matrix}','${versionId}',1,'criterio_b','Critério B');`,
      `insert into public.form_matrix_columns (item_id, form_version_id, position, code, label) values`,
      `  ('${matrix}','${versionId}',0,'atende','Atende'),`,
      `  ('${matrix}','${versionId}',1,'nao_atende','Não atende');`,
      `insert into public.form_item_validations (item_id, form_version_id, position, rule_type, config, severity, message)`,
      `values ('${text}','${versionId}',0,'text_length','{"min":3}'::jsonb,'error','Informe ao menos 3 caracteres.');`,
    ].join('\n')
  })

  await page.goto(`/o/${ORG}/c/${SLUG_CCIH}/manage/forms/${rich.formId}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })

  const libraryName = `${SPEC_TAG} Bloco rico`
  await saveToLibrary(page, 'Registros de auditoria', libraryName, 'Bloco completo para o round-trip.')

  // DB truth: exactly one new row, right commission.
  const libRows = sqlRows(
    `select id, commission_id from public.form_block_library where name = '${libraryName}';`,
  )
  expect(libRows.length).toBe(1)
  expect(libRows[0][1]).toBe(COMMISSION_CCIH)

  // --- destination: a brand-new draft form, same commission
  const destTitle = `${SPEC_TAG} destino round-trip`
  const destFormId = await createForm(page, destTitle)

  const dialog = await openLibraryPicker(page)
  await expect(dialog.getByText(libraryName)).toBeVisible({ timeout: 10_000 })
  await insertFromLibrary(dialog, libraryName)
  // First-ever insert into a brand-new version: zero collisions, so the rename
  // panel must render NOTHING (ruling 4 / FF4-2's zero-case, proven here too).
  await expect(dialog.getByText(/chaves? renomeadas?/i)).toHaveCount(0)
  await closeResultDialog(dialog)

  // --- UI-level corroboration (light — the load-bearing proof is the DB
  // comparison and the live fill below, not the builder's cosmetic preview).
  const destContainer = blockCard(page, 'Registros de auditoria')
  await expect(destContainer).toBeVisible({ timeout: 10_000 })
  await expect(destContainer.getByText('Leve')).toBeVisible()
  await expect(destContainer.getByText('Moderado')).toBeVisible()
  await expect(destContainer.getByText('Grave')).toBeVisible()
  // exact: true — the matrix grid ALSO carries sr-only cell-state text
  // ("Critério A, Atende: não selecionado") that otherwise substring-collides.
  await expect(destContainer.getByText('Critério A', { exact: true })).toBeVisible()
  await expect(destContainer.getByText('Atende', { exact: true })).toBeVisible()
  await expect(
    destContainer.getByRole('button', { name: /regras de validação \(1 regra\)/i }),
  ).toBeVisible()

  // --- DB truth: the copy carries the FULL child set, under NEW item/option/
  // row/col ids (never the source's — a real materialized copy, not a link).
  const destVersionId = sqlOne(`select id from public.form_versions where form_id = '${destFormId}';`)
  const destChoiceId = sqlOne(
    `select id from public.form_items where form_version_id='${destVersionId}' and label='Classificação do achado';`,
  )
  const destTextId = sqlOne(
    `select id from public.form_items where form_version_id='${destVersionId}' and label='Código do registro';`,
  )
  const destMatrixId = sqlOne(
    `select id from public.form_items where form_version_id='${destVersionId}' and label='Avaliação do critério';`,
  )
  const destRefId = sqlOne(
    `select id from public.form_items where form_version_id='${destVersionId}' and label='Setor envolvido no achado';`,
  )
  expect(destChoiceId).not.toBe(rich.items.choice)
  expect(destTextId).not.toBe(rich.items.text)

  expect(
    sqlRows(`select code, label from public.form_item_options where item_id='${destChoiceId}' order by position;`),
  ).toEqual([
    ['leve', 'Leve'],
    ['moderado', 'Moderado'],
    ['grave', 'Grave'],
  ])
  expect(
    sqlRows(`select code, label from public.form_matrix_rows where item_id='${destMatrixId}' order by position;`),
  ).toEqual([
    ['criterio_a', 'Critério A'],
    ['criterio_b', 'Critério B'],
  ])
  expect(
    sqlRows(
      `select code, label from public.form_matrix_columns where item_id='${destMatrixId}' order by position;`,
    ),
  ).toEqual([
    ['atende', 'Atende'],
    ['nao_atende', 'Não atende'],
  ])
  expect(
    sqlRows(
      `select rule_type, config::text, severity, message from public.form_item_validations where item_id='${destTextId}';`,
    ),
  ).toEqual([['text_length', '{"min": 3}', 'error', 'Informe ao menos 3 caracteres.']])
  expect(sqlOne(`select config::text from public.form_items where id='${destRefId}';`)).toContain(
    '"referenceKind": "participant"',
  )

  await publishForm(page)

  // --- fill + submit as a real respondent
  await signInAs(page, STAFF1)
  await enterWizard(page, destTitle)
  const responseId = responseIdFromUrl(page)

  await addInstance(page)
  const inst = instanceRegion(page, 'Registros de auditoria', '1 de 1')
  await expect(inst).toBeVisible({ timeout: 15_000 })

  await inst.getByRole('radio', { name: 'Moderado', exact: true }).check()

  // The COPIED validation rule is LIVE, not a dangling row: violate it first.
  // role=textbox, not getByLabel — the wizard also renders a "Limpar a
  // resposta de Código do registro" clear-button and an "Adicionar
  // observação — Código do registro" button, both of which substring-match
  // the plain label text via their aria-labels.
  const codigo = inst.getByRole('textbox', { name: 'Código do registro', exact: true })
  await codigo.fill('ab')
  await expect(inst.getByText('Informe ao menos 3 caracteres.')).toBeVisible()
  expect(await codigo.getAttribute('aria-invalid')).toBe('true')
  await codigo.fill('AB123')
  await expect(inst.getByText('Informe ao menos 3 caracteres.')).toHaveCount(0)

  await inst.getByRole('radio', { name: 'Critério A Atende', exact: true }).check()
  await inst.getByRole('radio', { name: 'Critério B Não atende', exact: true }).check()

  const refInput = inst.getByRole('combobox', { name: 'Setor envolvido no achado' })
  await refInput.click()
  await refInput.fill('UTI')
  await inst.getByRole('option', { name: /UTI Adulto/ }).click()

  await advance(page)
  await expect(page.getByRole('heading', { name: /Revise suas respostas/i })).toBeVisible({
    timeout: 15_000,
  })
  await submitFromReview(page)
  expect(responseStatus(responseId)).toBe('submitted')

  // --- DB truth on the SUBMITTED answers: every copied child answered correctly
  expect(
    sqlOne(
      `select fio.code from public.answer_selected_options aso` +
        ` join public.answers a on a.id=aso.answer_id join public.form_item_options fio on fio.id=aso.option_id` +
        ` where a.response_id='${responseId}' and a.item_id='${destChoiceId}';`,
    ),
  ).toBe('moderado')
  expect(
    sqlOne(
      `select a.value #>> '{}' from public.answers a where a.response_id='${responseId}' and a.item_id='${destTextId}';`,
    ),
  ).toBe('AB123')
  expect(
    sqlRows(
      `select r.code, c.code from public.answer_matrix_cells amc` +
        ` join public.answers a on a.id=amc.answer_id` +
        ` join public.form_matrix_rows r on r.id=amc.row_id join public.form_matrix_columns c on c.id=amc.col_id` +
        ` where a.response_id='${responseId}' and a.item_id='${destMatrixId}' order by r.position;`,
    ),
  ).toEqual([
    ['criterio_a', 'atende'],
    ['criterio_b', 'nao_atende'],
  ])
  expect(
    sqlOne(
      `select ar.participant_id::text from public.answer_references ar` +
        ` join public.answers a on a.id=ar.answer_id` +
        ` where a.response_id='${responseId}' and a.item_id='${destRefId}';`,
    ),
  ).toBe(PART_UTI)
})

// ===========================================================================
// FF4-2 — collision → rename list (ruling 4 / Amendment 1)
// ===========================================================================

test('FF4-2 inserting the SAME block into the SAME version twice forces a collision — the rename list is READ-ONLY, and a zero-collision insert renders nothing', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, CHEFE)

  const src = seedDraftForm(`${SPEC_TAG} origem 2`, ({ versionId, sectionId, id }) => {
    const item = id('campo')
    return (
      `insert into public.form_items (id, section_id, form_version_id, position, item_type, question_key, label, required)` +
      ` values ('${item}','${sectionId}','${versionId}',0,'short_text','campo_duplicavel_seed','Campo duplicável',false);`
    )
  })
  await page.goto(`/o/${ORG}/c/${SLUG_CCIH}/manage/forms/${src.formId}`)
  const libName = `${SPEC_TAG} Colisão`
  await saveToLibrary(page, 'Campo duplicável', libName)

  const destTitle = `${SPEC_TAG} destino colisão`
  const destFormId = await createForm(page, destTitle)

  // First insert: zero collision (fresh version) → the rename panel renders NOTHING.
  let dialog = await openLibraryPicker(page)
  await insertFromLibrary(dialog, libName)
  await expect(dialog.getByText(/chaves? renomeadas?/i)).toHaveCount(0)
  await closeResultDialog(dialog)

  // Second insert of the SAME entry into the SAME version: a real collision.
  dialog = await openLibraryPicker(page)
  await insertFromLibrary(dialog, libName)
  await expect(dialog.getByText('1 chave renomeada')).toBeVisible()
  // READ-ONLY: old→new is plain text, never an input/textarea/contenteditable
  // anywhere in the result view (Amendment 1 — no rename door exists).
  await expect(dialog.locator('input, textarea, [contenteditable="true"]')).toHaveCount(0)

  const destVersionId = sqlOne(`select id from public.form_versions where form_id='${destFormId}';`)
  const rows = sqlRows(
    `select question_key from public.form_items where form_version_id='${destVersionId}' and label='Campo duplicável' order by position;`,
  )
  expect(rows.length).toBe(2)
  const [firstKey, secondKey] = [rows[0][0], rows[1][0]]
  // The FIRST insert (zero collisions) kept the source's literal key unchanged.
  expect(firstKey).toBe('campo_duplicavel_seed')
  // The SECOND collided and was suffixed — deterministically, per the ADR's own
  // example (`peso` → `peso_2`).
  expect(secondKey).toBe('campo_duplicavel_seed_2')
  // The list shown to the author names exactly this old→new pair.
  await expect(dialog.getByText(firstKey, { exact: true })).toBeVisible()
  await expect(dialog.getByText(secondKey, { exact: true })).toBeVisible()

  await closeResultDialog(dialog)
})

// ===========================================================================
// FF4-3 — closure refusal (ruling 3)
// ===========================================================================

test('FF4-3 a subtree whose condition reaches a question_key OUTSIDE itself is refused at save, in pt-BR, naming the offending key', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await signInAs(page, CHEFE)

  const src = seedDraftForm(`${SPEC_TAG} origem 3`, ({ versionId, sectionId, id }) => {
    const trigger = id('gatilho')
    const container = id('container')
    const child = id('detalhe')
    return [
      `insert into public.form_items (id, section_id, form_version_id, position, item_type, question_key, label, required) values`,
      `  ('${trigger}','${sectionId}','${versionId}',0,'multiple_choice','gatilho_seed','Necessita detalhamento?',false);`,
      `insert into public.form_item_options (item_id, form_version_id, position, code, label) values`,
      `  ('${trigger}','${versionId}',0,'sim','Sim'),('${trigger}','${versionId}',1,'nao','Não');`,
      `insert into public.form_items (id, section_id, form_version_id, position, item_type, label, required) values`,
      `  ('${container}','${sectionId}','${versionId}',1,'repeating_group','Bloco com condição externa',false);`,
      `insert into public.form_items (id, section_id, form_version_id, position, item_type, question_key, label, required, parent_item_id, visible_when) values`,
      `  ('${child}','${sectionId}','${versionId}',2,'short_text','detalhe_seed','Detalhe',false,'${container}',`,
      `   jsonb_build_object('question_key','gatilho_seed','op','equals','value','sim'));`,
    ].join('\n')
  })

  await page.goto(`/o/${ORG}/c/${SLUG_CCIH}/manage/forms/${src.formId}`)
  const libName = `${SPEC_TAG} Fechamento`
  const card = blockCard(page, 'Bloco com condição externa')
  await card.getByRole('button', { name: 'Salvar na biblioteca' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await dialog.getByLabel('Nome').fill(libName)
  await dialog.getByRole('button', { name: 'Salvar na biblioteca' }).click()

  await expect(
    dialog.getByText('Este bloco tem condições que dependem de perguntas fora dele.'),
  ).toBeVisible({ timeout: 10_000 })
  await expect(dialog.getByText('gatilho_seed')).toBeVisible()
  // The dialog stayed open — a refusal the author can act on, not a silent no-op.
  await expect(dialog).toBeVisible()

  // Refused server-side: nothing landed in the library.
  expect(sqlOne(`select count(*)::text from public.form_block_library where name='${libName}';`)).toBe(
    '0',
  )

  await dialog.getByRole('button', { name: 'Cancelar' }).click()
})

// ===========================================================================
// FF4-4 — dynamic defaults (rulings 5-6)
// ===========================================================================

test('FF4-4 today + current_user_name prefill the wizard from the response itself, the segmented control is exclusive by construction, and resume never re-seeds an edited/cleared answer', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, CHEFE)
  const title = `${SPEC_TAG} valores dinâmicos`
  const formId = await createForm(page, title)
  const versionId = sqlOne(`select id from public.form_versions where form_id = '${formId}';`)

  // --- date item: dynamic "today" — the ONLY eligible token for `date`, so the
  // picker degrades to a plain descriptive line (no dead single-option select).
  let dialog = await openAddBlock(page, /^Data/)
  await dialog.getByLabel('Enunciado da pergunta').fill('Data do evento')
  await dialog.getByRole('radio', { name: 'Valor dinâmico' }).click()
  // (The item editor ALSO carries unrelated legacy min/max bound `<input
  // type="date">` fields, so a bare `input[type="date"]` count is not a safe
  // exclusivity probe here — the short_text item below proves exclusivity
  // with an unambiguous locator instead.)
  await expect(dialog.getByText('Data de hoje')).toBeVisible()
  await submitAddDialog(dialog)

  // --- short_text item: literal → dynamic proves the EXCLUSIVITY (only one
  // control ever shows — switching modes REPLACES the config wholesale), then
  // saved dynamic (current_user_name).
  dialog = await openAddBlock(page, /^Resposta curta/)
  await dialog.getByLabel('Enunciado da pergunta').fill('Responsável pelo registro')
  await dialog.getByRole('radio', { name: 'Valor fixo' }).click()
  const literalInput = dialog.getByPlaceholder('Texto pré-preenchido ao abrir o formulário.')
  await literalInput.fill('Rascunho')
  await expect(literalInput).toHaveValue('Rascunho')
  await dialog.getByRole('radio', { name: 'Valor dinâmico' }).click()
  // The literal control is GONE, not merely cleared — the two can never coexist.
  await expect(literalInput).toHaveCount(0)
  // exact: true — the wrapping radiogroup's OWN aria-label is "Origem do valor
  // padrão", which substring-contains this select's label.
  const sourceSelect = dialog.getByLabel('Origem do valor', { exact: true })
  await expect(sourceSelect).toBeVisible()
  await expect(sourceSelect).toHaveValue('current_user_name')
  await submitAddDialog(dialog)

  // Scoped by THIS test's own version id, never a bare label search — a
  // generic label like "Data do evento" is not guaranteed unique across the
  // whole table (and must not be relied on to be, hermetic cleanup aside).
  const dateItemId = sqlOne(
    `select id from public.form_items where form_version_id='${versionId}' and label='Data do evento';`,
  )
  const textItemId = sqlOne(
    `select id from public.form_items where form_version_id='${versionId}' and label='Responsável pelo registro';`,
  )
  // DB truth: the XOR. The literal typed BEFORE switching modes was NEVER
  // persisted — the discriminated-union control makes an impossible pairing
  // unrepresentable, and the CHECK confirms nothing snuck past it either.
  expect(
    sqlRows(
      `select default_value, default_source from public.form_items where id in ('${dateItemId}','${textItemId}') order by position;`,
    ),
  ).toEqual([
    ['', 'today'],
    ['', 'current_user_name'],
  ])

  await publishForm(page)

  await signInAs(page, STAFF1)
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)

  // `today` resolves from THIS response's own `started_at` (never a live clock —
  // FE-4's contract), so the expected value is DB truth, not `new Date()`.
  const expectedToday = sqlOne(
    `select to_char(started_at at time zone 'utc', 'YYYY-MM-DD') from public.responses where id='${responseId}';`,
  )
  // role=textbox, not getByLabel — the wizard's "Limpar"/"Adicionar
  // observação" buttons carry aria-labels that substring-contain the plain
  // question label too (the same shape as FF4-1's "Código do registro").
  const dateField = page.getByRole('textbox', { name: 'Data do evento', exact: true })
  const respField = page.getByRole('textbox', {
    name: 'Responsável pelo registro',
    exact: true,
  })
  await expect(dateField).toHaveValue(expectedToday)
  await expect(respField).toHaveValue(STAFF1_NAME)

  // --- idempotency: edit one, clear the OTHER via its dedicated "Limpar"
  // affordance (the field's actual clear control, not a raw `.fill('')` —
  // this is what a real filler clicks), leave, resume — NEITHER is re-seeded.
  await respField.fill('Editado pelo respondente')
  await page.getByRole('button', { name: 'Limpar a resposta de Data do evento' }).click()
  await expect(dateField).toHaveValue('')
  await page.getByRole('button', { name: 'Salvar e sair' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/responder/'), { timeout: 15_000 })
  expect(responseStatus(responseId)).toBe('in_progress')

  // DB truth: the clear DID persist — a real `answers` row exists with an
  // explicit jsonb `null` (not merely "no row"), proving the SAVE path is not
  // the culprit if the resume check below still finds the field re-seeded.
  expect(
    sqlRows(
      `select value::text from public.answers where response_id='${responseId}' and item_id='${dateItemId}';`,
    ),
  ).toEqual([['null']])

  await enterWizard(page, title)
  expect(responseIdFromUrl(page)).toBe(responseId)
  await expect(dateField).toHaveValue('') // NOT re-seeded — BUG-FF4-001, see PROGRESS.md
  await expect(respField).toHaveValue('Editado pelo respondente') // NOT reverted

  await advance(page)
  await expect(page.getByRole('heading', { name: /Revise suas respostas/i })).toBeVisible({
    timeout: 15_000,
  })
  await submitFromReview(page)
  expect(responseStatus(responseId)).toBe('submitted')
})

// ===========================================================================
// FF4-5 — security negative (ruling 1)
// ===========================================================================

test('FF4-5 a staff_admin of a DIFFERENT commission neither sees nor can insert another commission entries — UI, RPC, and REST', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await signInAs(page, CHEFE)
  const src = seedDraftForm(`${SPEC_TAG} origem 5`, ({ versionId, sectionId, id }) => {
    const item = id('campo')
    return (
      `insert into public.form_items (id, section_id, form_version_id, position, item_type, question_key, label, required)` +
      ` values ('${item}','${sectionId}','${versionId}',0,'short_text','seguranca_seed','Campo CCIH',false);`
    )
  })
  await page.goto(`/o/${ORG}/c/${SLUG_CCIH}/manage/forms/${src.formId}`)
  const libName = `${SPEC_TAG} Segurança CCIH`
  await saveToLibrary(page, 'Campo CCIH', libName)
  const libraryEntryId = sqlOne(`select id from public.form_block_library where name='${libName}';`)

  // --- UI-level: Farmácia's OWN picker never shows CCIH's entry.
  await signInAs(page, CHEFE_FARM)
  const destTitle = `${SPEC_TAG} destino farmácia`
  await page.goto(`/o/${ORG}/c/${SLUG_FARM}/manage/forms`)
  await page.getByRole('button', { name: 'Novo formulário' }).click()
  await page.getByLabel('Título do formulário').fill(destTitle)
  await page.getByRole('button', { name: 'Criar formulário' }).click()
  await page.waitForURL(/\/manage\/forms\/[0-9a-f-]+$/, { timeout: 20_000 })
  const destFarmFormId = page.url().slice(page.url().lastIndexOf('/') + 1)
  await expect(page.getByRole('heading', { level: 1, name: destTitle })).toBeVisible({
    timeout: 20_000,
  })

  const dialog = await openLibraryPicker(page)
  await expect(dialog.getByText(libName)).toHaveCount(0)
  await expect(dialog.getByText(/Nenhum bloco salvo ainda nesta comissão/)).toBeVisible()
  await closeBrowseButton(dialog).click()

  const farmSectionId = sqlOne(
    `select fs.id from public.form_sections fs join public.form_versions fv on fv.id=fs.form_version_id where fv.form_id='${destFarmFormId}';`,
  )

  // --- RPC-level: even a direct call under Farmácia's OWN token is refused.
  const farmToken = await getToken(page, CHEFE_FARM)
  const before = sqlOne(`select count(*)::text from public.form_items where section_id='${farmSectionId}';`)
  const res = await rpcAs<{ code?: string; message?: string }>(page, farmToken, 'insert_block_from_library', {
    p_library_entry_id: libraryEntryId,
    p_section_id: farmSectionId,
  })
  expect(res.ok, `Farmácia inseriu um bloco de outra comissão: ${res.text}`).toBeFalsy()
  const after = sqlOne(`select count(*)::text from public.form_items where section_id='${farmSectionId}';`)
  expect(after).toBe(before)

  // --- REST-level no-leakage: a direct SELECT under Farmácia's token never
  // returns the CCIH row (the RLS boundary itself, not merely the UI's choice
  // not to render it).
  const restRes = await page.request.get(
    `${SUPABASE_URL}/rest/v1/form_block_library?id=eq.${libraryEntryId}`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${farmToken}` } },
  )
  const restBody = (await restRes.json()) as unknown[]
  expect(Array.isArray(restBody) ? restBody.length : 0).toBe(0)
})

// ===========================================================================
// FF4-6 — rename/delete metadata (Amendment 2) — the load-bearing assertion
// ===========================================================================

test('FF4-6 renaming/re-describing a library entry updates it in place; deleting it never disturbs a form already built from it', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, CHEFE)
  const srcTitle = `${SPEC_TAG} origem 6`
  await createForm(page, srcTitle)
  const addDialog = await openAddBlock(page, /^Resposta curta/)
  await addDialog.getByLabel('Enunciado da pergunta').fill('Nota simples')
  await submitAddDialog(addDialog)

  const originalName = `${SPEC_TAG} Entrada simples`
  await saveToLibrary(page, 'Nota simples', originalName, 'Descrição original.')

  // Build a form that DEPENDS on the materialized copy BEFORE any rename/delete.
  const destTitle = `${SPEC_TAG} destino rename-delete`
  const destFormId = await createForm(page, destTitle)
  let dialog = await openLibraryPicker(page)
  await insertFromLibrary(dialog, originalName)
  await closeResultDialog(dialog)

  // --- rename + re-describe
  dialog = await openLibraryPicker(page)
  const card = dialog.locator('li').filter({ hasText: originalName })
  await card.getByRole('button', { name: `Editar ${q(originalName)}` }).click()
  const editDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'Apenas o nome e a descrição podem ser alterados' })
  await expect(editDialog).toBeVisible({ timeout: 10_000 })
  const renamedName = `${SPEC_TAG} Entrada renomeada`
  await editDialog.getByLabel('Nome').fill(renamedName)
  await editDialog.getByLabel(/Descrição/).fill('Descrição atualizada.')
  await editDialog.getByRole('button', { name: 'Salvar' }).click()
  await expect(editDialog).toBeHidden({ timeout: 15_000 })
  await expect(dialog.getByText(`${q(renamedName)} atualizado.`)).toBeVisible({ timeout: 10_000 })
  await expect(dialog.getByText(renamedName)).toBeVisible()
  await expect(dialog.getByText('Descrição atualizada.')).toBeVisible()

  expect(sqlOne(`select description from public.form_block_library where name='${renamedName}';`)).toBe(
    'Descrição atualizada.',
  )

  // --- delete: the confirm NAMES the safety property this whole ruling rests on.
  const renamedCard = dialog.locator('li').filter({ hasText: renamedName })
  await renamedCard.getByRole('button', { name: `Excluir ${q(renamedName)}` }).click()
  const confirmDialog = page.getByRole('alertdialog')
  await expect(confirmDialog).toBeVisible({ timeout: 10_000 })
  await expect(confirmDialog.getByText(/copia o conteúdo, nunca vincula/)).toBeVisible()
  await confirmDialog.getByRole('button', { name: 'Excluir' }).click()
  await expect(dialog.getByText(`${q(renamedName)} excluído da biblioteca.`)).toBeVisible({
    timeout: 10_000,
  })
  // The success banner legitimately repeats the name, so check the CARD is
  // gone, not that the name is absent from the whole dialog.
  await expect(dialog.locator('li').filter({ hasText: renamedName })).toHaveCount(0)
  await closeBrowseButton(dialog).click()

  expect(sqlOne(`select count(*)::text from public.form_block_library where name='${renamedName}';`)).toBe(
    '0',
  )

  // --- THE LOAD-BEARING ASSERTION: the destination form built from this entry
  // is completely unaffected — inserts materialize copies, never links.
  await page.goto(`/o/${ORG}/c/${SLUG_CCIH}/manage/forms/${destFormId}`)
  await expect(blockCard(page, 'Nota simples')).toBeVisible({ timeout: 15_000 })
  const destVersionId = sqlOne(`select id from public.form_versions where form_id='${destFormId}';`)
  expect(
    sqlOne(
      `select count(*)::text from public.form_items where form_version_id='${destVersionId}' and label='Nota simples';`,
    ),
  ).toBe('1')
})

// ===========================================================================
// FF4-7 — keyboard-only (CLAUDE.md §8): open, browse, insert, delete-confirm
// ===========================================================================

test('FF4-7 keyboard-only: open the library, browse to an entry, insert it, then delete a DIFFERENT entry through its confirm — no mouse', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, CHEFE)

  // --- setup (clicks) — two small entries. Saved in this order so "KB Excluir"
  // (saved SECOND) sits ahead of "KB Inserir" in the newest-first list; the
  // Tab-walk below finds either regardless of position.
  const srcTitle = `${SPEC_TAG} origem 7`
  await createForm(page, srcTitle)
  let d = await openAddBlock(page, /^Resposta curta/)
  await d.getByLabel('Enunciado da pergunta').fill('Campo A teclado')
  await submitAddDialog(d)
  d = await openAddBlock(page, /^Resposta curta/)
  await d.getByLabel('Enunciado da pergunta').fill('Campo B teclado')
  await submitAddDialog(d)

  const insertName = `${SPEC_TAG} KB Inserir`
  const deleteName = `${SPEC_TAG} KB Excluir`
  await saveToLibrary(page, 'Campo A teclado', insertName)
  await saveToLibrary(page, 'Campo B teclado', deleteName)

  const destTitle = `${SPEC_TAG} destino teclado`
  await createForm(page, destTitle)

  // --- keyboard-only from here. The trigger is focused PROGRAMMATICALLY (the
  // ff3-9 convention) so this exercises the menu's own operability rather than
  // the builder's whole tab order.
  const trigger = page.getByRole('button', { name: 'Adicionar bloco' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await arrowDownUntilLabelled(page, /Da biblioteca/)
  await page.keyboard.press('Enter')

  await expect(page.getByRole('dialog', { name: /Biblioteca de blocos/ })).toBeVisible({
    timeout: 10_000,
  })

  await tabUntilLabelled(page, `Inserir ${q(insertName)}`)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Bloco inserido' })).toBeVisible({ timeout: 15_000 })
  await tabUntilLabelled(page, 'Concluir')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await expect(blockCard(page, 'Campo A teclado')).toBeVisible({ timeout: 10_000 })

  // --- reopen, browse to the OTHER entry, delete it through its confirm — keys only.
  await trigger.focus()
  await page.keyboard.press('Enter')
  await arrowDownUntilLabelled(page, /Da biblioteca/)
  await page.keyboard.press('Enter')
  const dialog2 = page.getByRole('dialog', { name: /Biblioteca de blocos/ })
  await expect(dialog2).toBeVisible({ timeout: 10_000 })

  await tabUntilLabelled(page, `Excluir ${q(deleteName)}`)
  await page.keyboard.press('Enter')
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toBeVisible({ timeout: 10_000 })
  await tabUntilLabelled(page, 'Excluir', { exact: true })
  await page.keyboard.press('Enter')
  await expect(dialog2.getByText(`${q(deleteName)} excluído da biblioteca.`)).toBeVisible({
    timeout: 10_000,
  })
  // The success banner legitimately repeats the name, so check the CARD is
  // gone, not that the name is absent from the whole dialog.
  await expect(dialog2.locator('li').filter({ hasText: deleteName })).toHaveCount(0)

  expect(sqlOne(`select count(*)::text from public.form_block_library where name='${deleteName}';`)).toBe(
    '0',
  )
  expect(sqlOne(`select count(*)::text from public.form_block_library where name='${insertName}';`)).toBe(
    '1',
  )
})

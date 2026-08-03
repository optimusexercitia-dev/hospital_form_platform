import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { test, expect, type Page, type Locator } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import {
  purgeDraftVersionsByIds,
  purgeFormsByTag,
  purgeResponsesByIds,
} from './helpers/purge-forms'

/**
 * FF-5 — Entity Reference (ADR 0091). Acceptance criteria translated from the
 * ADR's rulings + Amendments 1-2.
 *
 * ## What this file does NOT re-test
 *
 * `supabase/tests/276_ff5_references.sql` already carries 53 mutation-proven
 * keystones (§A-L: reader-non-writer, door parity + its over-grant twin, the
 * XOR CHECK, restrict-delete, cross-tenant (hardcoded ids), patient case-scoping,
 * the structural PHI-reach proof, both completeness arms, correction-copy,
 * supersession exclusion, the label mirror). None of that is reasoned about
 * here — the DB layer is trusted. What a green DB layer and a green unit layer
 * do NOT prove is the WIRED SEAM: FF-1 shipped actions still throwing
 * `not implemented` past lint+tsc+build+457 unit+3919 pgTAP, and only E2E caught
 * it. This file exercises exactly that seam:
 *
 *   FF5-1 happy path per lane, authored in the BUILDER, published, filled,
 *         submitted — value survives to review AND the submissions view, BY
 *         LABEL (never a raw uuid).
 *   FF5-2 in-group composition: a reference inside a repeating group, two
 *         instances, DIFFERENT targets, surviving a real reload (the separate
 *         `app.save_instance_answers` path — "works by construction" is the
 *         assumption that has failed in this program before).
 *   FF5-3 resume (dedicated, minimal): "Salvar e sair" then re-enter — the
 *         field renders the LABEL, never the target uuid.
 *   FF5-4 required gating: a required reference blocks submit with the same
 *         pt-BR banner every other required field uses; answering releases it.
 *   FF5-5 correction survival: a reference (both a top-level item AND the
 *         in-group child) survives `start_correction_draft` BY VALUE, on the
 *         CORRECT instance — ADR 0091 ruling 7, FF-1's P0-1 trap restated.
 *   FF5-6 cross-tenant negative: `save_section_answers` refuses a Rede-B
 *         target on a Rede-A response (HC0Q5) with a clean pt-BR message, not
 *         a raw SQLSTATE — plus a same-call positive control (own-org target
 *         succeeds) so the negative isn't vacuous, plus a UI-level no-leakage
 *         check on the candidate search itself.
 *   FF5-7 keyboard-only: focus, type, arrow to a candidate, Enter to select,
 *         Escape to close-without-committing, then Tab+Enter to clear.
 *
 * ## Fixture
 *
 * FF5-1 builds its own spec-owned form (title carries SPEC_TAG) — the ONE test
 * whose subject IS the authoring UI. Everything else reuses the SEEDED "FORM D"
 * (`supabase/seed.sql` ~L2206-2321, commission CCIH): one `reference` item per
 * lane (item 0 participant/REQUIRED, item 1 commission, item 2 user) plus a
 * repeating group whose child is a participant-lane reference restricted to
 * `department`. The two seeded org-A `department` participants (UTI Adulto /
 * Centro Cirúrgico) are the participant-lane candidates throughout.
 *
 * Distinct CCIH personas per test avoid draft collisions (one in_progress
 * response per user/version): staff1 (FF5-1's own form + FF5-6's RPC probe),
 * staff2 (FF5-2, FF5-7), staff3 (FF5-4), staff4... no — chefe (FF5-3, FF5-5).
 * Every response this file creates is submitted (or explicitly torn down) by
 * the end of its test; ids are tracked and deleted in `afterAll`. Hermetic —
 * Form D itself, its items and the two department participants are SEEDED and
 * are asserted to SURVIVE this file's run (the "positional cleanup eats seed
 * rows" scar: cleanup here deletes by exact id, never by position).
 *
 * Run with --workers=1 (stateful, shares Form D's single draft-per-user slot
 * across tests): `npx playwright test e2e/ff5-references.spec.ts --project=chromium --workers=1`
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local    staff_admin, CCIH (Rede A) — builder author + corrector
 *   staff1.ccih@test.local   staff, CCIH
 *   staff2.ccih@test.local   staff, CCIH
 *   staff3.ccih@test.local   staff, CCIH
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
const SPEC_TAG = 'FF5-SPEC'
const ORG = 'rede-a'
const SLUG = 'ccih'
const COMMISSION_CCIH = 'a0000000-0000-0000-0000-0000000000a1'
const USER_CHEFE = '00000000-0000-0000-0000-000000000002'
const CHEFE = 'chefe.ccih@test.local'
const STAFF1 = 'staff1.ccih@test.local'
const STAFF2 = 'staff2.ccih@test.local'
const STAFF3 = 'staff3.ccih@test.local'

/** Seeded "FORM D" (supabase/seed.sql ~L2206-2321) — the FF-5 demo fixture. */
const FORM_D_TITLE = 'Registro de Ocorrência com Referências'
const FORM_D_FORM_ID = 'f0000000-0000-0000-0000-00000000a003'
const FORM_D_SECTION = 'c0000000-0000-0000-0000-00000000a003'
const FORM_D_ITEM_COMMISSION = 'd0000000-0000-0000-0000-00000000a302'
const FORM_D_GROUP_CHILD = 'd0000000-0000-0000-0000-00000000a305' // "Setor" (participant/department)
const FORM_D_GROUP_LABEL = 'Outros setores envolvidos'

/** The two seeded department participants (org A, non-PHI). */
const PART_UTI = 'e0000000-0000-0000-0000-0000000000d1' // "UTI Adulto"
const PART_CC = 'e0000000-0000-0000-0000-0000000000d2' // "Centro Cirúrgico"

/** A Rede-B (org b) commission — the fixed seed id, HARDCODED per the pgTAP
 *  file's own §E lesson: resolving a foreign id through an `authenticated`
 *  query would RLS-null it and the negative test would assert nothing. */
const REDE_B_COMMISSION = 'c0000000-0000-0000-0000-0000000000c1' // "Comissão de Qualidade e Segurança"

/** The banner `handleNext` raises when any field is highlighted (shared across
 *  every FF phase's required/validation gating — ff3-validations.spec.ts). */
const REVISE_BANNER = 'Revise os campos destacados antes de continuar.'

// ---------------------------------------------------------------------------
// Auth / RPC helpers (mirror ff2-matrix.spec.ts / ff3-validations.spec.ts)
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
// DB helpers — FIXTURE cleanup and DB-TRUTH reads only. No application
// behaviour is ever driven from here; every write goes through the UI or an
// RPC under a real persona token.
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

/** Response ids this file creates, torn down (with cascading answers) in
 *  `afterAll` — never by position, always by exact id (the seed-eating scar). */
const createdResponseIds: string[] = []

/**
 * Draft `form_versions` this file clones off the SEEDED Form D (FF5-8's
 * updateItem coverage — editing a published version clones to a draft, Rule
 * 5). Torn down by exact id in `afterAll`; Form D's own published v1 is never
 * touched. A draft is freely deletable (only a PUBLISHED version is immutable),
 * so no `session_replication_role` bypass is needed for these.
 */
const createdDraftVersionIds: string[] = []

test.afterAll(() => {
  // `guard_submitted_response` blocks a DELETE on any submitted response, so the
  // `session_replication_role = replica` bypass is required here too — most of
  // this file's responses ARE submitted by the time cleanup runs. Each helper
  // keeps that bypass and adds the explicit child-first deletes it can no longer
  // get from FK CASCADE, which `replica` disables right alongside the guards
  // (BUG-E2EISO-002 — see ./helpers/purge-forms).
  purgeResponsesByIds(createdResponseIds)
  purgeDraftVersionsByIds(createdDraftVersionIds)
  // The ONE spec-owned form (FF5-1's builder-authored 3-lane form).
  purgeFormsByTag(SPEC_TAG)

  // Tripwire: the seed's own FF-5 fixture must survive this file untouched.
  expect(
    sqlRows(
      `select display_name from public.participants where id in ('${PART_UTI}','${PART_CC}') order by display_name;`,
    ),
  ).toEqual([['Centro Cirúrgico'], ['UTI Adulto']])
  expect(
    sqlOne(`select count(*)::text from public.form_items where section_id = '${FORM_D_SECTION}';`),
  ).toBe('5')
  expect(sqlOne(`select title from public.forms where id = (select form_id from public.form_versions where id = (select form_version_id from public.form_sections where id = '${FORM_D_SECTION}'));`)).toBe(
    FORM_D_TITLE,
  )
  // No stray draft left behind by FF5-8's clone-to-edit round trip.
  expect(
    sqlOne(
      `select count(*)::text from public.form_versions where form_id = '${FORM_D_FORM_ID}' and status = 'draft';`,
    ),
  ).toBe('0')
})

// ---------------------------------------------------------------------------
// Builder-UI helpers (mirror ff3-validations.spec.ts)
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

/**
 * Author one `reference` block: the enunciado, optionally the lane (default is
 * `participant`) and — participant lane only — the allowed types, optionally
 * "Resposta obrigatória". Mirrors `addQuestion`/`addMultipleChoice` shape.
 */
async function addReferenceItem(
  dialog: Locator,
  label: string,
  opts?: {
    kind?: 'commission' | 'user'
    participantTypes?: string[]
    required?: boolean
  },
) {
  await dialog.getByLabel('Enunciado da pergunta').fill(label)
  if (opts?.kind) {
    const kindLabel = opts.kind === 'commission' ? 'Comissão' : 'Pessoa (usuário da plataforma)'
    const radioLabel = dialog.locator('label').filter({ hasText: kindLabel }).first()
    await radioLabel.locator('input[type="radio"]').check()
  }
  for (const t of opts?.participantTypes ?? []) {
    await dialog.getByRole('checkbox', { name: t }).click()
  }
  if (opts?.required) {
    await dialog.getByRole('checkbox', { name: 'Resposta obrigatória' }).click()
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

/** One block card, by the label text it contains (ff3's convention). */
function blockCard(page: Page, label: string): Locator {
  return page.locator('article').filter({ hasText: label }).first()
}

/** Add a block INSIDE a repeating group (the "Adicionar pergunta ao grupo" menu). */
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

/**
 * Open a PUBLISHED form's builder and clone it to a draft ("Editar publicado" →
 * `clone_form_version`, Rule 5). Returns the draft's `form_versions.id` so the
 * caller can track it for cleanup — never mutates the published version.
 */
async function startEditFromPublished(page: Page, formId: string): Promise<string> {
  await page.goto(`/o/${ORG}/c/${SLUG}/manage/forms/${formId}`)
  await page.getByRole('button', { name: /Editar publicado/ }).click()
  await expect(page.getByRole('button', { name: 'Publicar' })).toBeVisible({ timeout: 20_000 })
  return sqlOne(
    `select id from public.form_versions where form_id = '${formId}' and status = 'draft';`,
  )
}

/** Open the item editor ("Editar bloco") for one existing block. */
async function openItemEditor(page: Page, label: string): Promise<Locator> {
  await blockCard(page, label).getByRole('button', { name: 'Editar bloco' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  return dialog
}

async function saveEditDialog(dialog: Locator) {
  await dialog.getByRole('button', { name: /^Salvar/ }).first().click()
  await expect(
    dialog,
    'o editor de perguntas continuou aberto — a gravação foi recusada',
  ).toBeHidden({ timeout: 15_000 })
}

// ---------------------------------------------------------------------------
// Wizard helpers (mirror ff1/ff2/ff3)
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
  await waitForWizard(page)
}

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

/** The visible required marker for one question (ff3's convention). */
function requiredMarker(page: Page, labelText: string): Locator {
  return page
    .locator('label, legend')
    .filter({ hasText: labelText })
    .locator('[aria-label="obrigatória"]')
}

/** The repeating-group instance region: `role=region`, named "{groupLabel} {ordinal}". */
function instanceRegion(page: Page, groupLabel: string, ordinal: string): Locator {
  return page.getByRole('region', { name: `${groupLabel} ${ordinal}` })
}

async function addInstance(page: Page) {
  await page.getByRole('button', { name: 'Adicionar repetição' }).click({ timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// Reference-picker helpers
// ---------------------------------------------------------------------------

/** The combobox input for one reference question, scoped to `within`. Name
 *  matching is a SUBSTRING (Playwright default) because a required item's
 *  accessible name also carries the "obrigatória" suffix from its marker. */
function referenceInput(within: Page | Locator, questionLabel: string): Locator {
  return within.getByRole('combobox', { name: questionLabel })
}

/** Open a reference typeahead, filter by `query`, click the matching option. */
async function pickReference(
  within: Page | Locator,
  questionLabel: string,
  query: string,
  optionName: string | RegExp,
) {
  const input = referenceInput(within, questionLabel)
  await input.click()
  await input.fill(query)
  await within.getByRole('option', { name: optionName }).first().click()
}

/**
 * Keyboard-only: press ArrowDown until `aria-activedescendant` names an option
 * whose OWN text contains `matchText`. The picker auto-highlights index 0 the
 * moment any search resolves (baseline-on-open included), so a fixed "press
 * ArrowDown once" assumes the wanted candidate sits at a particular position —
 * unsafe on an ORG-scoped lane where other specs' fixtures share the same
 * candidate pool. Walking until the highlighted text matches proves the same
 * contract (arrow moves the highlight) without assuming an ordering.
 */
async function arrowToOption(
  page: Page,
  input: Locator,
  matchText: string,
  maxSteps = 8,
): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    const activeId = await input.getAttribute('aria-activedescendant')
    if (activeId) {
      const text = await page.locator(`#${activeId}`).textContent()
      if (text?.includes(matchText)) return
    }
    await page.keyboard.press('ArrowDown')
  }
  throw new Error(`arrowToOption: nunca destacou uma opção contendo "${matchText}"`)
}

// ===========================================================================
// FF5-1 — happy path per lane, authored in the builder
// ===========================================================================

test('FF5-1 a reference item per lane, authored/published in the builder, survives to review and the submissions view by label', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await signInAs(page, CHEFE)
  const title = `${SPEC_TAG} três lanes`
  await createForm(page, title)

  // REQUIRED, authored fresh through the builder this time (FF5-4 exercises
  // required gating on the SEEDED item; this is the first proof that
  // `addItem`'s `reference` arm honours "Resposta obrigatória" too).
  await addReferenceItem(await openAddBlock(page, /^Referência/), 'Setor envolvido', {
    participantTypes: ['Setor'],
    required: true,
  })
  await addReferenceItem(await openAddBlock(page, /^Referência/), 'Comissão de acompanhamento', {
    kind: 'commission',
  })
  await addReferenceItem(await openAddBlock(page, /^Referência/), 'Responsável pela apuração', {
    kind: 'user',
  })
  await publishForm(page)

  await signInAs(page, STAFF1)
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)
  createdResponseIds.push(responseId)

  // The "Resposta obrigatória" checkbox authored above actually reaches the
  // wizard as a real required marker on this fresh, builder-created item.
  await expect(requiredMarker(page, 'Setor envolvido')).toBeVisible()

  await pickReference(page, 'Setor envolvido', 'UTI', /UTI Adulto/)
  await pickReference(page, 'Comissão de acompanhamento', 'Infecção', /Controle de Infecção/)
  await pickReference(page, 'Responsável pela apuração', 'Chefe CCIH', /Chefe CCIH/)

  await advance(page)
  await expect(page.getByRole('heading', { name: /Revise suas respostas/i })).toBeVisible({
    timeout: 15_000,
  })
  // The review screen shows the picked entities BY LABEL, not a raw uuid.
  await expect(page.getByText('UTI Adulto').first()).toBeVisible()
  await expect(page.getByText(/Controle de Infecção Hospitalar/).first()).toBeVisible()
  await expect(page.getByText('Chefe CCIH').first()).toBeVisible()

  await submitFromReview(page)
  expect(responseStatus(responseId)).toBe('submitted')

  // DB truth: exactly the right target per lane (assert on VALUES, not rendering).
  const rows = sqlRows(
    `select ar.reference_kind, coalesce(ar.participant_id::text, ar.commission_id::text, ar.profile_id::text)` +
      ` from public.answer_references ar join public.answers a on a.id = ar.answer_id join public.form_items i on i.id = a.item_id` +
      ` where a.response_id = '${responseId}' order by i.position;`,
  )
  expect(rows).toEqual([
    ['participant', PART_UTI],
    ['commission', COMMISSION_CCIH],
    ['user', USER_CHEFE],
  ])

  // The submissions view (dashboard read side) renders the SAME labels.
  await signInAs(page, CHEFE)
  await page.goto(`/o/${ORG}/c/${SLUG}/dashboard/submissions/${responseId}`)
  await expect(page.getByText('UTI Adulto').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Controle de Infecção Hospitalar/).first()).toBeVisible()
  await expect(page.getByText('Chefe CCIH').first()).toBeVisible()
})

// ===========================================================================
// FF5-2 — in-group composition: two instances, DIFFERENT targets, survives reload
// ===========================================================================

test('FF5-2 a reference inside a repeating group holds a DIFFERENT target per instance and survives a reload', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await signInAs(page, STAFF2)
  await enterWizard(page, FORM_D_TITLE)
  const responseId = responseIdFromUrl(page)
  createdResponseIds.push(responseId)

  // The required top-level participant lane, so this response is submittable later.
  await pickReference(page, 'Setor envolvido', 'UTI', /UTI Adulto/)

  await addInstance(page)
  const inst1 = instanceRegion(page, FORM_D_GROUP_LABEL, '1 de 1')
  await expect(inst1).toBeVisible({ timeout: 15_000 })
  await pickReference(inst1, 'Setor', 'Centro', /Centro Cirúrgico/)

  await addInstance(page)
  const inst1of2 = instanceRegion(page, FORM_D_GROUP_LABEL, '1 de 2')
  const inst2of2 = instanceRegion(page, FORM_D_GROUP_LABEL, '2 de 2')
  await expect(inst2of2).toBeVisible({ timeout: 15_000 })
  await pickReference(inst2of2, 'Setor', 'UTI', /UTI Adulto/)

  // inst1 kept its OWN value — the two instances never share state.
  await expect(inst1of2.getByText('Centro Cirúrgico')).toBeVisible()
  await expect(inst2of2.getByText('UTI Adulto')).toBeVisible()

  // Navigate away with a REAL round trip through the server (picking a value
  // commits it to component state; only an explicit save — "Salvar e sair", or
  // advancing a section — persists it, so the trip away must go through one of
  // those, not a bare reload of unsaved state) and back via a fresh "Continuar
  // preenchimento".
  await page.getByRole('button', { name: 'Salvar e sair' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/responder/'), { timeout: 15_000 })
  await enterWizard(page, FORM_D_TITLE)
  expect(responseIdFromUrl(page)).toBe(responseId)
  const r1 = instanceRegion(page, FORM_D_GROUP_LABEL, '1 de 2')
  const r2 = instanceRegion(page, FORM_D_GROUP_LABEL, '2 de 2')
  await expect(r1).toBeVisible({ timeout: 15_000 })
  await expect(r1.getByText('Centro Cirúrgico')).toBeVisible()
  await expect(r2.getByText('UTI Adulto')).toBeVisible()
  // And it is rendered as a LABEL, never the raw target uuid, in either slot.
  await expect(r1.getByText(/^[0-9a-f]{8}-/)).toHaveCount(0)
  await expect(r2.getByText(/^[0-9a-f]{8}-/)).toHaveCount(0)

  await advance(page)
  await expect(page.getByRole('heading', { name: /Revise suas respostas/i })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('Centro Cirúrgico').first()).toBeVisible()
  await expect(page.getByText('UTI Adulto').first()).toBeVisible()
  await submitFromReview(page)
  expect(responseStatus(responseId)).toBe('submitted')

  // DB truth: one answer_references row per instance, mapped to the RIGHT
  // group_instance by position, distinct targets.
  const rows = sqlRows(
    `select rgi.position, ar.participant_id::text from public.answer_references ar` +
      ` join public.answers a on a.id = ar.answer_id` +
      ` join public.response_group_instances rgi on rgi.id = a.group_instance_id` +
      ` where a.response_id = '${responseId}' and a.item_id = '${FORM_D_GROUP_CHILD}' order by rgi.position;`,
  )
  expect(rows).toEqual([
    ['0', PART_CC],
    ['1', PART_UTI],
  ])
})

// ===========================================================================
// FF5-3 — resume: the field renders the LABEL, never the raw uuid
// ===========================================================================

test('FF5-3 a saved reference resumes rendering its label, not a raw uuid', async ({ page }) => {
  test.setTimeout(60_000)
  await signInAs(page, STAFF3)
  await enterWizard(page, FORM_D_TITLE)
  const responseId = responseIdFromUrl(page)
  createdResponseIds.push(responseId)

  await pickReference(page, 'Setor envolvido', 'Centro', /Centro Cirúrgico/)

  // The success toast is transient and the redirect can outrace an assertion on
  // it; the URL leaving /responder/ is the reliable, non-racy completion signal
  // (confirmed live: the draft is genuinely persisted by this point).
  await page.getByRole('button', { name: 'Salvar e sair' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/responder/'), { timeout: 15_000 })
  expect(responseStatus(responseId)).toBe('in_progress')

  // Re-enter — a REAL resume (server round trip), not client-held state.
  await enterWizard(page, FORM_D_TITLE)
  expect(responseIdFromUrl(page)).toBe(responseId)
  const input = referenceInput(page, 'Setor envolvido')
  await expect(input).toHaveValue('Centro Cirúrgico')
  // Never a raw uuid anywhere on the page.
  await expect(page.getByText(/^[0-9a-f]{8}-[0-9a-f]{4}-/)).toHaveCount(0)

  // Finish it off cleanly (fill the other two optional lanes are not needed —
  // only the participant lane is required).
  await advance(page)
  await submitFromReview(page)
  expect(responseStatus(responseId)).toBe('submitted')
})

// ===========================================================================
// FF5-4 — required gating: blocks submit in pt-BR, answering releases it
// ===========================================================================

test('FF5-4 a required reference blocks with the shared pt-BR banner; answering it releases submit', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await signInAs(page, STAFF1)
  await enterWizard(page, FORM_D_TITLE)
  const responseId = responseIdFromUrl(page)
  createdResponseIds.push(responseId)

  // The marker is present from the start — this is STATIC `required`, not
  // `required_if` — so this assertion holds before any interaction.
  await expect(requiredMarker(page, 'Setor envolvido')).toBeVisible()

  await advance(page)
  await expect(page.getByText(REVISE_BANNER)).toBeVisible()
  // `checkReference` (validation.ts) has its OWN message, distinct from the
  // generic scalar-required copy — it names the field as a reference, not just
  // "obrigatória".
  await expect(page.getByText('Selecione uma opção para esta referência.')).toBeVisible()
  expect(await referenceInput(page, 'Setor envolvido').getAttribute('aria-invalid')).toBe('true')
  expect(responseStatus(responseId)).toBe('in_progress')

  await pickReference(page, 'Setor envolvido', 'UTI', /UTI Adulto/)
  await expect(page.getByText('Selecione uma opção para esta referência.')).toHaveCount(0)
  expect(await referenceInput(page, 'Setor envolvido').getAttribute('aria-invalid')).toBeNull()

  await advance(page)
  await expect(page.getByRole('heading', { name: /Revise suas respostas/i })).toBeVisible({
    timeout: 15_000,
  })
  await submitFromReview(page)
  expect(responseStatus(responseId)).toBe('submitted')
})

// ===========================================================================
// FF5-5 — correction survival, by value, on the correct instance (ruling 7 /
// FF-1's P0-1 trap restated for references)
// ===========================================================================

test('FF5-5 a correction copies references by value — the top-level lane AND the in-group child on the correct instance', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await signInAs(page, CHEFE)

  // --- build the PREDECESSOR: top-level + 2 group instances, distinct targets
  await enterWizard(page, FORM_D_TITLE)
  const predecessorId = responseIdFromUrl(page)
  createdResponseIds.push(predecessorId)

  await pickReference(page, 'Setor envolvido', 'UTI', /UTI Adulto/)
  await addInstance(page)
  const p1 = instanceRegion(page, FORM_D_GROUP_LABEL, '1 de 1')
  await pickReference(p1, 'Setor', 'Centro', /Centro Cirúrgico/)
  await addInstance(page)
  const p2 = instanceRegion(page, FORM_D_GROUP_LABEL, '2 de 2')
  await pickReference(p2, 'Setor', 'UTI', /UTI Adulto/)

  await advance(page)
  await submitFromReview(page)
  expect(responseStatus(predecessorId)).toBe('submitted')

  // --- correct it
  await page.goto(`/o/${ORG}/c/${SLUG}/dashboard/submissions/${predecessorId}`)
  const correctBtn = page.getByRole('button', { name: /corrigir envio/i })
  await expect(correctBtn).toBeVisible({ timeout: 15_000 })
  await correctBtn.click()
  const dialog = page.getByRole('dialog', { name: /corrigir envio/i })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await dialog
    .getByLabel(/motivo da correção/i)
    .fill(`${SPEC_TAG} correção de referências`)
  await dialog.getByRole('button', { name: /iniciar correção/i }).click()

  await page.waitForURL(/\/responder\//, { timeout: 20_000 })
  await waitForWizard(page)
  const successorId = responseIdFromUrl(page)
  createdResponseIds.push(successorId)
  expect(successorId).not.toBe(predecessorId)

  // Pre-populated BY VALUE — top-level.
  await expect(referenceInput(page, 'Setor envolvido')).toHaveValue('UTI Adulto')
  // Pre-populated BY VALUE, ON THE CORRECT INSTANCE — this is the P0-1 trap:
  // a naive remap could swap, collapse or drop these two.
  const s1 = instanceRegion(page, FORM_D_GROUP_LABEL, '1 de 2')
  const s2 = instanceRegion(page, FORM_D_GROUP_LABEL, '2 de 2')
  await expect(s1).toBeVisible({ timeout: 15_000 })
  await expect(referenceInput(s1, 'Setor')).toHaveValue('Centro Cirúrgico')
  await expect(referenceInput(s2, 'Setor')).toHaveValue('UTI Adulto')

  await advance(page)
  await submitFromReview(page)
  expect(responseStatus(successorId)).toBe('submitted')
  expect(sqlOne(`select supersedes_id from public.responses where id = '${successorId}';`)).toBe(
    predecessorId,
  )

  // DB truth: the SUCCESSOR's group-child references, by position, match the
  // predecessor's exactly — copied through (group_item_id, position), never a
  // direct group_instance_id comparison (Amendment 1.3 gives the successor its
  // own instance rows).
  const successorRows = sqlRows(
    `select rgi.position, ar.participant_id::text from public.answer_references ar` +
      ` join public.answers a on a.id = ar.answer_id` +
      ` join public.response_group_instances rgi on rgi.id = a.group_instance_id` +
      ` where a.response_id = '${successorId}' and a.item_id = '${FORM_D_GROUP_CHILD}' order by rgi.position;`,
  )
  expect(successorRows).toEqual([
    ['0', PART_CC],
    ['1', PART_UTI],
  ])
})

// ===========================================================================
// FF5-6 — cross-tenant negative: HC0Q5, clean pt-BR, not a raw SQLSTATE; plus
// a positive control (not vacuous) and a UI-level no-leakage check
// ===========================================================================

test('FF5-6 save_section_answers refuses a Rede-B target on a Rede-A response (HC0Q5, clean pt-BR) and the candidate search never leaks it', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await signInAs(page, STAFF1)
  const token = await getToken(page, STAFF1)
  await enterWizard(page, FORM_D_TITLE)
  const responseId = responseIdFromUrl(page)
  createdResponseIds.push(responseId)

  // --- the negative: a hardcoded Rede-B commission id (never resolved through
  // an `authenticated` query — that would RLS-null it and prove nothing) -----
  const crossTenant = await rpcAs<{ code?: string; message?: string }>(
    page,
    token,
    'save_section_answers',
    {
      p_response_id: responseId,
      p_section_id: FORM_D_SECTION,
      p_references: { [FORM_D_ITEM_COMMISSION]: REDE_B_COMMISSION },
    },
  )
  expect(crossTenant.ok, 'um alvo de outra organização foi aceito').toBeFalsy()
  expect(crossTenant.json?.code).toBe('HC0Q5')
  expect(crossTenant.json?.message).toMatch(/não pertence a esta organização/i)
  // Never a raw Postgres/SQLSTATE leak — the phase-blocking bug CLAUDE.md §8 names.
  expect(crossTenant.json?.message).not.toMatch(/constraint|violates|sqlstate|^23|^42/i)
  expect(
    sqlOne(
      `select count(*)::text from public.answer_references ar join public.answers a on a.id = ar.answer_id` +
        ` where a.response_id = '${responseId}' and a.item_id = '${FORM_D_ITEM_COMMISSION}';`,
    ),
  ).toBe('0')

  // --- the positive control: the SAME call shape, own-org target, succeeds —
  // proves the rejection above is really about tenancy, not a general failure.
  const sameOrg = await rpcAs<unknown>(page, token, 'save_section_answers', {
    p_response_id: responseId,
    p_section_id: FORM_D_SECTION,
    p_references: { [FORM_D_ITEM_COMMISSION]: COMMISSION_CCIH },
  })
  expect(sameOrg.ok, `o próprio alvo da organização foi recusado: ${sameOrg.text}`).toBeTruthy()
  expect(
    sqlOne(
      `select commission_id::text from public.answer_references ar join public.answers a on a.id = ar.answer_id` +
        ` where a.response_id = '${responseId}' and a.item_id = '${FORM_D_ITEM_COMMISSION}';`,
    ),
  ).toBe(COMMISSION_CCIH)

  // --- UI-level no-leakage: the real typeahead never OFFERS the Rede-B row,
  // searched broadly (empty query = the baseline/unfiltered fetch).
  await page.reload()
  await waitForWizard(page)
  const input = referenceInput(page, 'Comissão responsável pelo acompanhamento')
  await input.click()
  await expect(page.getByRole('option', { name: /Controle de Infecção Hospitalar/ })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByRole('option', { name: /Qualidade e Segurança/ })).toHaveCount(0)
})

// ===========================================================================
// FF5-7 — keyboard-only (CLAUDE.md §8, mandatory). The ARIA combobox wiring
// was written but never interactively proven — `frontend` could not verify it
// (the Browser pane wasn't compositing, so synthetic clicks never landed).
// This is the first real check on it.
// ===========================================================================

test('FF5-7 keyboard-only: focus, type, arrow to a candidate, Enter to select, Escape to close, then clear', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await signInAs(page, STAFF2)
  await enterWizard(page, FORM_D_TITLE)
  const responseId = responseIdFromUrl(page)
  createdResponseIds.push(responseId)

  const input = referenceInput(page, 'Setor envolvido')

  // Focus programmatically (reaching it by Tab alone would assert the whole
  // page's tab order, which is not this field's contract — ff3-9's convention)
  // then every subsequent interaction is a real key event.
  await input.focus()
  await expect(input).toHaveAttribute('aria-expanded', 'true')

  // Type the FULL display name — the participant lane is ORG-scoped, so other
  // specs' fixtures share the same candidate pool and the exact string is what
  // makes the option unambiguous to find (arrowToOption still walks to it
  // rather than assuming it lands first).
  await page.keyboard.type('UTI Adulto')
  await expect(page.getByRole('option', { name: /UTI Adulto/ })).toBeVisible({ timeout: 10_000 })
  await arrowToOption(page, input, 'UTI Adulto')
  await page.keyboard.press('Enter')
  await expect(input).toHaveValue('UTI Adulto')
  await expect(input).toHaveAttribute('aria-expanded', 'false')

  // Reopen with an EMPTY query (the baseline/unfiltered fetch — BOTH
  // candidates are visible even though nothing has been typed) and arrow to
  // the OTHER, uncommitted candidate. `aria-selected` must follow the ACTIVE
  // row, not the committed one — QA's m-2 a11y fix. Before it, this was
  // inverted: the committed-but-inactive row read "selected" to a screen
  // reader and the row the user was actually arrowed onto did not.
  //
  // The field is ALREADY focused (Enter, above, does not blur it) — calling
  // `.focus()` again would be a no-op and never reopen the closed list.
  // ArrowDown is what a keyboard user actually presses here, and the
  // component's own handler opens a closed list on it.
  await page.keyboard.press('ArrowDown')
  const utiOptionRow = page.getByRole('option', { name: /UTI Adulto/ })
  const centroOptionRow = page.getByRole('option', { name: /Centro Cirúrgico/ })
  await expect(centroOptionRow).toBeVisible({ timeout: 10_000 })
  await arrowToOption(page, input, 'Centro Cirúrgico')
  await expect(centroOptionRow).toHaveAttribute('aria-selected', 'true')
  await expect(utiOptionRow).toHaveAttribute('aria-selected', 'false')

  // Then type a DIFFERENT query, ESCAPE — closes WITHOUT committing (the
  // field keeps its previously committed value, not the in-progress draft text).
  await page.keyboard.type('Centro Cirúrgico')
  await expect(page.getByRole('option', { name: /Centro Cirúrgico/ })).toBeVisible({
    timeout: 10_000,
  })
  await page.keyboard.press('Escape')
  await expect(input).toHaveValue('UTI Adulto')
  await expect(input).toHaveAttribute('aria-expanded', 'false')

  // Reopen, arrow to the OTHER candidate this time, Enter commits a DIFFERENT
  // value than before — proving the arrow really drives which one gets picked.
  await input.focus()
  await page.keyboard.type('Centro Cirúrgico')
  await expect(page.getByRole('option', { name: /Centro Cirúrgico/ })).toBeVisible({
    timeout: 10_000,
  })
  await arrowToOption(page, input, 'Centro Cirúrgico')
  await page.keyboard.press('Enter')
  await expect(input).toHaveValue('Centro Cirúrgico')

  // Clear it: Tab from the input reaches the "Remover" button; Enter activates it.
  await page.keyboard.press('Tab')
  const clearBtn = page.getByRole('button', { name: /Remover a referência de Setor envolvido/i })
  await expect(clearBtn).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(input).toHaveValue('')

  // Clearing returns focus to the input, which its own onFocus handler opens
  // (the baseline fetch) — close it with Escape to get to the CLOSED
  // baseline this check actually needs. A bare modifier key must NOT reopen
  // it — QA's m-4 a11y fix. The previous catch-all fired on Shift/Ctrl/Alt/
  // CapsLock/F5 and every other non-editing key, so merely holding Shift
  // re-opened a closed list and fired an unwanted baseline search.
  await expect(input).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(input).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('Shift')
  await expect(input).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('Control')
  await expect(input).toHaveAttribute('aria-expanded', 'false')

  // Leave it answered (required) so the response can be finished off cleanly.
  // Pressing Enter without arrowing would be racy here: the field just reopened
  // with NOTHING typed yet, so the instant baseline (unfiltered) fetch shows
  // BOTH candidates and auto-highlights index 0 — which may still be the
  // baseline's ordering when "UTI Adulto" first becomes visible in the DOM, if
  // that debounced, FILTERED fetch has not yet landed. `arrowToOption` re-checks
  // the actually-highlighted text rather than assuming the first render is the
  // settled one.
  await input.focus()
  await page.keyboard.type('UTI Adulto')
  await expect(page.getByRole('option', { name: /UTI Adulto/ })).toBeVisible({ timeout: 10_000 })
  await arrowToOption(page, input, 'UTI Adulto')
  await page.keyboard.press('Enter')
  await expect(input).toHaveValue('UTI Adulto')

  const revisar = page.getByRole('button', { name: 'Revisar' })
  await revisar.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: /Revise suas respostas/i })).toBeVisible({
    timeout: 15_000,
  })
  const send = page.getByRole('button', { name: /Enviar respostas/i })
  await send.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText(/resposta enviada|enviada com sucesso/i).first()).toBeVisible({
    timeout: 25_000,
  })
  expect(responseStatus(responseId)).toBe('submitted')
})

// ===========================================================================
// FF5-8 — updateItem coverage: editing an EXISTING reference item. This path
// had ZERO prior coverage (the seeded FORM D was inserted directly via SQL,
// never through the builder) and was broken INDEPENDENTLY of BUG-FF5-001:
// `updateItem` calls the same `parseItemFields` that had no `reference` arm at
// all, so editing a reference item failed with no `addItem` involved.
// ===========================================================================

test('FF5-8 editing an existing reference item (label) round-trips through updateItem, and the published version stays untouched', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, CHEFE)

  const originalQuestionKey = sqlOne(
    `select question_key from public.form_items where id = 'd0000000-0000-0000-0000-00000000a301';`,
  )

  // Rule 5: editing a PUBLISHED version clones to a draft. Tracked for cleanup;
  // v1 (what every other test in this file fills) is never mutated.
  const draftVersionId = await startEditFromPublished(page, FORM_D_FORM_ID)
  createdDraftVersionIds.push(draftVersionId)

  // Read-back FIRST: the editor pre-fills the item's EXISTING config correctly
  // — required, participant lane, both seeded allowed types. This is the
  // "round trips" `backend` asked for, checked before touching anything.
  let dialog = await openItemEditor(page, 'Setor envolvido')
  await expect(dialog.getByLabel('Enunciado da pergunta')).toHaveValue('Setor envolvido')
  await expect(dialog.getByRole('checkbox', { name: 'Resposta obrigatória' })).toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: 'Setor' })).toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: 'Profissional' })).toBeChecked()

  // The actual edit: exactly what `updateItem` could not do before the fix
  // (`parseItemFields` fell through to its own `itemTypeInvalid` for `reference`).
  const newLabel = `${SPEC_TAG} setor envolvido (editado)`
  await dialog.getByLabel('Enunciado da pergunta').fill(newLabel)
  await saveEditDialog(dialog)
  await expect(blockCard(page, newLabel)).toBeVisible({ timeout: 10_000 })

  // DB truth: the CLONED item on the draft — new label, the SAME question_key
  // (stability contract, Rule 5), still `item_type = 'reference'`, config intact.
  const row = sqlRows(
    `select label, item_type, question_key, config::text from public.form_items` +
      ` where form_version_id = '${draftVersionId}' and question_key = 'referencia_setor';`,
  )
  expect(row.length).toBe(1)
  expect(row[0][0]).toBe(newLabel)
  expect(row[0][1]).toBe('reference')
  expect(row[0][2]).toBe(originalQuestionKey)
  expect(row[0][3]).toContain('"referenceKind": "participant"')

  // Reopening reads the edit back, closing the round trip.
  dialog = await openItemEditor(page, newLabel)
  await expect(dialog.getByLabel('Enunciado da pergunta')).toHaveValue(newLabel)
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toBeHidden()

  // The PUBLISHED v1 — what FF5-2 through FF5-7 fill — is untouched.
  expect(
    sqlOne(`select label from public.form_items where id = 'd0000000-0000-0000-0000-00000000a301';`),
  ).toBe('Setor envolvido')
})

// ===========================================================================
// FF5-9 — a reference authored INSIDE a repeating group, THROUGH THE BUILDER
// (not the seeded SQL fixture) — the other half of BUG-FF5-001's blast radius
// that FF5-1's flat 3-lane form doesn't reach: `addItem` with a `parentItemId`
// set, for a `reference` child.
// ===========================================================================

test('FF5-9 a reference authored inside a repeating group (through the builder) fills and submits', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, CHEFE)
  const title = `${SPEC_TAG} grupo construído`
  await createForm(page, title)

  const groupDialog = await openAddBlock(page, /^Grupo repetível/)
  await groupDialog.getByLabel('Título do grupo').fill('Registros')
  await submitAddDialog(groupDialog)

  await addReferenceItem(await openChildAddBlock(page, 'Registros', /^Referência/), 'Setor do registro', {
    participantTypes: ['Setor'],
  })
  await publishForm(page)

  await signInAs(page, STAFF3)
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)
  createdResponseIds.push(responseId)

  await addInstance(page)
  const inst1 = instanceRegion(page, 'Registros', '1 de 1')
  await expect(inst1).toBeVisible({ timeout: 15_000 })
  await pickReference(inst1, 'Setor do registro', 'UTI', /UTI Adulto/)
  await expect(inst1.getByText('UTI Adulto')).toBeVisible()

  await advance(page)
  await expect(page.getByRole('heading', { name: /Revise suas respostas/i })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('UTI Adulto').first()).toBeVisible()
  await submitFromReview(page)
  expect(responseStatus(responseId)).toBe('submitted')

  // DB truth: the reference answers to a target inside the NEWLY-AUTHORED group.
  const rows = sqlRows(
    `select ar.participant_id::text from public.answer_references ar` +
      ` join public.answers a on a.id = ar.answer_id` +
      ` join public.form_items i on i.id = a.item_id` +
      ` where a.response_id = '${responseId}' and i.label = 'Setor do registro';`,
  )
  expect(rows).toEqual([[PART_UTI]])
})

// ===========================================================================
// FF5-10 — the SIGN-OFF review screen (`/manage/assinaturas/{responseId}`), a
// SEPARATE call site from the dashboard submissions view that BUG-FF5-002 hit.
// `backend` asked for this once BUG-FF5-002 was root-caused to a missing prop
// at ONE call site (`getResponseForSignoff` → `adapt.ts` → `review-and-sign.tsx`
// already threads `referencesByItemId` end to end, by inspection) — this is
// the regression guard so a future drop of that prop reds a spec instead of
// shipping silently, exactly as BUG-FF5-002 did for its own call site.
//
// Fixture is a raw-SQL section+item (mirrors ff3's `seedForm` convention) —
// the SUBJECT here is the review/sign screen's rendering, not the section
// sign-off authoring UI (that is phase6-signoffs.spec.ts's job).
// ===========================================================================

test('FF5-10 the sign-off review screen renders a top-level reference answer by label, not "Sem resposta", and a top-level observation is never contaminated by an instance one', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const formId = randomUUID()
  const versionId = randomUUID()
  const sectionId = randomUUID()
  const itemId = randomUUID()
  // QA m-4: `observations_by_item` had no `group_instance_id is null` filter
  // at the TOP level, so an instance's observation could win the
  // `jsonb_object_agg` collapse and render attached to a top-level question.
  // `noteItemId` (top-level) and `descItemId` (a repeating-group CHILD, so it
  // gets its own per-instance observation) exercise exactly that boundary.
  const noteItemId = randomUUID()
  const groupItemId = randomUUID()
  const descItemId = randomUUID()
  const title = `${SPEC_TAG} assinatura com referência`

  psql(
    `set client_encoding to 'UTF8';\n` +
      `insert into public.forms (id, commission_id, title, description, created_by)\n` +
      `values ('${formId}','${COMMISSION_CCIH}','${title}','Fixture ${SPEC_TAG}','${USER_CHEFE}');\n` +
      `insert into public.form_versions (id, form_id, version_number, status, created_by)\n` +
      `values ('${versionId}','${formId}',1,'draft','${USER_CHEFE}');\n` +
      `insert into public.form_sections (id, form_version_id, position, title, description, is_default, requires_signoff, signoff_role)\n` +
      `values ('${sectionId}','${versionId}',0,'Assinatura da chefia','Conferência final pela chefia.',false,true,'staff_admin');\n` +
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required, config)\n` +
      `values ('${itemId}','${sectionId}',0,'reference','setor_assinatura','Setor responsável',false,` +
      `jsonb_build_object('referenceKind','participant','participantTypes',jsonb_build_array('department')));\n` +
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required)\n` +
      `values ('${noteItemId}','${sectionId}',1,'short_text','nota_chefia','Nota da chefia',false);\n` +
      `insert into public.form_items (id, section_id, position, item_type, label, required, config)\n` +
      `values ('${groupItemId}','${sectionId}',2,'repeating_group','Ocorrências',false,` +
      `jsonb_build_object('minInstances',0,'maxInstances',5));\n` +
      `insert into public.form_items (id, section_id, position, item_type, question_key, label, required, parent_item_id)\n` +
      `values ('${descItemId}','${sectionId}',3,'short_text','descricao_ocorrencia','Descrição',false,'${groupItemId}');\n` +
      `select public.publish_form_version('${versionId}');`,
  )

  // Fill it and leave it IN_PROGRESS — sign-offs happen only while in_progress
  // (Rule 4), so this must NOT reach submit.
  await signInAs(page, STAFF1)
  await enterWizard(page, title)
  const responseId = responseIdFromUrl(page)
  createdResponseIds.push(responseId)
  await pickReference(page, 'Setor responsável', 'Centro', /Centro Cirúrgico/)

  // The top-level observation.
  await page.getByLabel('Nota da chefia', { exact: true }).fill('Nota geral')
  await page
    .getByRole('button', { name: /Adicionar observação — Nota da chefia/i })
    .click()
  await page.getByLabel(/^Observação/i).fill('Observação do nível superior')

  // The INSTANCE observation, on a DIFFERENT item (a repeating-group child).
  await page.getByRole('button', { name: 'Adicionar repetição' }).click()
  const inst1 = instanceRegion(page, 'Ocorrências', '1 de 1')
  await expect(inst1).toBeVisible({ timeout: 15_000 })
  await inst1.getByLabel('Descrição', { exact: true }).fill('Ocorrência 1')
  await inst1.getByRole('button', { name: /Adicionar observação — Descrição/i }).click()
  await inst1.getByLabel(/^Observação/i).fill('Observação da ocorrência')

  await page.getByRole('button', { name: 'Salvar e sair' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/responder/'), { timeout: 15_000 })
  expect(responseStatus(responseId)).toBe('in_progress')

  // Review + sign, as the staff_admin whose role gates this section.
  await signInAs(page, CHEFE)
  await page.goto(`/o/${ORG}/c/${SLUG}/manage/assinaturas/${responseId}`)
  // level: 2 — the section ALSO renders a smaller `<h4>` echo elsewhere on the
  // page (e.g. a sign-off summary/queue), so an unscoped role query is ambiguous.
  await expect(
    page.getByRole('heading', { name: /Assinatura da chefia/i, level: 2 }),
  ).toBeVisible({
    timeout: 15_000,
  })
  // The reference renders BY LABEL — the exact regression BUG-FF5-002 was.
  await expect(page.getByText('Centro Cirúrgico').first()).toBeVisible()
  await expect(page.getByText('Sem resposta')).toHaveCount(0)

  // QA m-4: the top-level observation shows ITS OWN text, never the
  // instance's — and the instance's observation shows only under its OWN
  // instance card, never floating at the top level. `SectionBody` renders
  // each top-level item as a `<dt>`/`<dd>` pair sharing one parent `<div>`
  // (answer-summary.tsx); `InstanceAnswersReadonly` renders each repetition
  // as a `<fieldset>` legended "{label} N de M".
  const noteBlock = page.locator('dt', { hasText: 'Nota da chefia' }).locator('xpath=..')
  await expect(noteBlock.getByText('Observação do nível superior')).toBeVisible()
  await expect(noteBlock.getByText('Observação da ocorrência')).toHaveCount(0)
  const instBlock = page.locator('fieldset').filter({ hasText: 'Ocorrências 1 de' }).first()
  await expect(instBlock.getByText('Observação da ocorrência')).toBeVisible()
  await expect(instBlock.getByText('Observação do nível superior')).toHaveCount(0)
  // And the top-level observation appears EXACTLY once anywhere on the page —
  // no duplicate slipped in from the instance side of the old, unscoped map.
  await expect(page.getByText('Observação do nível superior')).toHaveCount(1)

  // Complete the realistic flow too: signing succeeds with the reference present.
  await page.getByRole('button', { name: /Assinar seção/i }).click()
  await expect(page.getByRole('button', { name: /Assinar seção/i })).toHaveCount(0, {
    timeout: 15_000,
  })
  expect(
    sqlOne(
      `select count(*)::text from public.response_section_signoffs where response_id = '${responseId}' and section_id = '${sectionId}';`,
    ),
  ).toBe('1')
})

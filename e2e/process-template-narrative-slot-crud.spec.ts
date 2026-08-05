import { test, expect, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import { createDraftTemplateDirect } from './helpers/process-templates'

/**
 * Process-template NARRATIVE-SLOT edit + remove — E2E coverage for QA finding
 * F-2 (CHANGES REQUESTED on the bundled PCI + Template-Versioning phase).
 *
 * This spec asserts the CORRECT, intended behavior — a staff_admin can edit a
 * narrative slot's title and remove a narrative slot from their own commission's
 * draft template — exactly as `NarrativeSlotDialog` / `NarrativeSlotCard` /
 * `template-builder-shell.tsx` wire it up. It must go RED against current HEAD
 * (F-1, not yet fixed) and GREEN once backend fixes it; a spec authored to match
 * the current broken output cannot prove the coverage gap, so this one asserts
 * what SHOULD happen, not what currently does.
 *
 * BACKGROUND (F-1, backend-owned, NOT fixed as of this spec's authoring):
 * `commissionOfTemplateNarrative` (src/lib/case-narratives/actions.ts:232) selects
 * the PostgREST embed `process_templates(commission_id)` from
 * `.from('process_template_narratives')`. ADR-0096 dropped
 * `process_template_narratives.template_id` (the FK that embed relied on), so
 * PostgREST now rejects the embed at parse time with PGRST200. The helper
 * discards `error` and returns `null` from `data?.process_templates?.commission_id
 * ?? null`, so both `updateTemplateNarrative` and `removeTemplateNarrative` take
 * the `!commissionId` early-return and answer with the generic
 * "Narrativa não encontrada." (slot not found) — a friendly pt-BR toast, not a
 * crash. Both actions are fully wired to the UI, so this is a deterministic,
 * silent dead end: commission A's own staff_admin, editing/removing a slot on a
 * template they just created, gets told it doesn't exist.
 *
 * WHY THIS WAS MISSED: a 963/963 green E2E gate shipped alongside this defect —
 * there was zero coverage exercising slot EDIT or REMOVE (only CREATE is
 * exercised elsewhere, and CREATE does not touch `commissionOfTemplateNarrative`
 * — it resolves commission via `commissionOfTemplateVersion`, an unaffected
 * embed). This file closes that gap.
 *
 * Each test builds and owns its OWN single fresh draft template (never the
 * seeded M&M template process-template-versioning.spec.ts / cases specs
 * mutate, and never shared with each other) — deliberately independent, not
 * `serial`: in `serial` mode a single failing test cascades and SKIPS the
 * rest of the file, which would hide the remove-path proof behind the
 * edit-path failure (observed while authoring this spec). Independent
 * fixtures mean both prove red on their own.
 *
 * ASSERTION SHAPE (per the phase's own "green bar misses the wired seam" +
 * "friendly-failure toast, not a crash" lessons): each test asserts the RENDERED
 * value, not mere rendering/absence-of-crash —
 *   1. edit: the card shows the NEW title (not just "no error banner" — a UI that
 *      silently no-op'd would also show no error);
 *   2. remove: the card is GONE from the DOM;
 *   3. the DB row itself reflects the change (service-role read) — belt-and-
 *      suspenders against stale optimistic UI over a no-op mutation.
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin of CCIH (Rede A) — builds the template,
 *                           adds/edits/removes its narrative slots.
 */

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}

const ORG = 'rede-a'
const SLUG = 'ccih'
const BASE = `/o/${ORG}/c/${SLUG}`
const COMM_CCIH_ID = 'a0000000-0000-0000-0000-0000000000a1'
// Seeded narrative-type vocabulary for CCIH (supabase/seed.sql ~L1010-1032).
const NT_RESUMO_CLINICO_LABEL = 'Resumo Clínico'
const NT_ACHADOS_LABEL = 'Achados e Discussão'

const NOT_FOUND_MESSAGE = 'Narrativa não encontrada.'

/** Service-role SELECT — DB-truth assertions (RLS deliberately bypassed). */
async function dbGet<T = Record<string, unknown>>(
  request: APIRequestContext,
  path: string,
): Promise<T[]> {
  const resp = await request.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  expect(resp.ok(), `dbGet(${path}) failed: ${await resp.text()}`).toBeTruthy()
  return (await resp.json()) as T[]
}

interface NarrativeRow {
  id: string
  title: string | null
  template_version_id: string
}

async function getNarrativeByVersionAndTitle(
  request: APIRequestContext,
  versionId: string,
  title: string,
): Promise<NarrativeRow> {
  const rows = await dbGet<NarrativeRow>(
    request,
    `process_template_narratives?template_version_id=eq.${versionId}&title=eq.${encodeURIComponent(title)}&select=id,title,template_version_id`,
  )
  expect(rows.length, `narrative slot titled "${title}" not found under version ${versionId}`).toBe(1)
  return rows[0]
}

const suffix = Date.now()
const editSlotOriginalTitle = `Slot Original ${suffix}`
const editSlotNewTitle = `Slot EDITADO ${suffix}`
const removeSlotTitle = `Slot Para Remover ${suffix}`

test('narrative-slot EDIT: staff_admin can rename their own draft template narrative slot', async ({
  page,
}) => {
  test.setTimeout(90_000)

  await cachedSignIn(page, 'chefe.ccih@test.local')

  // ── Fixture: a fresh draft template owned by THIS test only ──
  const draft = await createDraftTemplateDirect(
    page.request,
    { baseUrl: SUPABASE_URL, apikey: SUPABASE_SERVICE_KEY, bearerToken: SUPABASE_SERVICE_KEY },
    {
      commissionId: COMM_CCIH_ID,
      title: `NarrSlotCRUD Edit E2E ${suffix}`,
      createdBy: '00000000-0000-0000-0000-000000000002', // chefe.ccih@test.local
    },
  )
  const templateId = draft.templateId
  const versionId = draft.versionId

  await page.goto(`${BASE}/manage/process-templates/${templateId}`)
  await page.waitForURL(/\/manage\/process-templates\//, { timeout: 15_000 })

  // ── Add a narrative slot via the UI (this path is NOT broken — it resolves
  // commission via `commissionOfTemplateVersion`, a different, unaffected embed
  // — establishing the baseline that the fixture itself is sound). ──
  await page.getByRole('button', { name: /Adicionar narrativa/i }).click()
  const addDialog = page.getByRole('dialog').filter({ hasText: /Nova narrativa/i })
  await expect(addDialog).toBeVisible({ timeout: 10_000 })
  await addDialog.locator('select[name="narrativeTypeId"]').selectOption({ label: NT_RESUMO_CLINICO_LABEL })
  await addDialog.getByLabel(/Título/i).fill(editSlotOriginalTitle)
  await addDialog.getByRole('button', { name: /Adicionar narrativa/i }).click()
  await expect(addDialog).toHaveCount(0, { timeout: 15_000 })

  const originalCard = page.getByRole('region', { name: editSlotOriginalTitle })
  await expect(originalCard).toBeVisible({ timeout: 10_000 })

  // DB truth: the slot exists with the original title.
  const narrativeRow = await getNarrativeByVersionAndTitle(page.request, versionId, editSlotOriginalTitle)

  // ── Perform the EDIT: open the slot's edit dialog, change the title, submit ──
  await originalCard.getByRole('button', { name: /^Editar a narrativa/i }).click()
  const editDialog = page.getByRole('dialog').filter({ hasText: /Editar narrativa/i })
  await expect(editDialog).toBeVisible({ timeout: 10_000 })

  const titleField = editDialog.getByLabel(/Título/i)
  await titleField.fill(editSlotNewTitle)
  await editDialog.getByRole('button', { name: /^Salvar$/i }).click()

  // ── The dialog must CLOSE on a genuine success (an unclosed dialog, or one
  // that closed while showing the misleading "Narrativa não encontrada."
  // banner, are both failures — not what this asserts). ──
  await expect(editDialog).toHaveCount(0, { timeout: 10_000 })

  // ── Assert the RENDERED value actually changed: the card now shows the NEW
  // title, and the OLD title is gone — not merely "no error was shown". ──
  await expect(page.getByRole('region', { name: editSlotNewTitle })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('region', { name: editSlotOriginalTitle })).toHaveCount(0)
  await expect(page.getByText(editSlotOriginalTitle)).toHaveCount(0)

  // ── Assert the DB ROW itself reflects the change (service-role truth). ──
  const rowAfter = await dbGet<NarrativeRow>(
    page.request,
    `process_template_narratives?id=eq.${narrativeRow.id}&select=id,title,template_version_id`,
  )
  expect(rowAfter.length).toBe(1)
  expect(rowAfter[0].title, 'DB title must reflect the edit, not the PGRST200 false "not found"').toBe(
    editSlotNewTitle,
  )
})

test('narrative-slot REMOVE: staff_admin can remove their own draft template narrative slot', async ({
  page,
}) => {
  test.setTimeout(90_000)

  await cachedSignIn(page, 'chefe.ccih@test.local')

  // ── Fixture: a fresh draft template owned by THIS test only (independent
  // of the EDIT test's template — see the file-header note on avoiding
  // `serial`'s cascading skip). ──
  const draft = await createDraftTemplateDirect(
    page.request,
    { baseUrl: SUPABASE_URL, apikey: SUPABASE_SERVICE_KEY, bearerToken: SUPABASE_SERVICE_KEY },
    {
      commissionId: COMM_CCIH_ID,
      title: `NarrSlotCRUD Remove E2E ${suffix}`,
      createdBy: '00000000-0000-0000-0000-000000000002', // chefe.ccih@test.local
    },
  )
  const templateId = draft.templateId
  const versionId = draft.versionId

  await page.goto(`${BASE}/manage/process-templates/${templateId}`)
  await page.waitForURL(/\/manage\/process-templates\//, { timeout: 15_000 })

  await page.getByRole('button', { name: /Adicionar narrativa/i }).click()
  const addDialog = page.getByRole('dialog').filter({ hasText: /Nova narrativa/i })
  await expect(addDialog).toBeVisible({ timeout: 10_000 })
  await addDialog.locator('select[name="narrativeTypeId"]').selectOption({ label: NT_ACHADOS_LABEL })
  await addDialog.getByLabel(/Título/i).fill(removeSlotTitle)
  await addDialog.getByRole('button', { name: /Adicionar narrativa/i }).click()
  await expect(addDialog).toHaveCount(0, { timeout: 15_000 })

  const card = page.getByRole('region', { name: removeSlotTitle })
  await expect(card).toBeVisible({ timeout: 10_000 })

  // DB truth: the slot exists before the removal.
  const narrativeRow = await getNarrativeByVersionAndTitle(page.request, versionId, removeSlotTitle)

  // ── Perform the REMOVE: trash icon → confirm in the AlertDialog ──
  await card.getByRole('button', { name: /^Remover a narrativa/i }).click()
  const confirmDialog = page.getByRole('alertdialog').filter({ hasText: /Remover esta narrativa\?/i })
  await expect(confirmDialog).toBeVisible({ timeout: 10_000 })
  await confirmDialog.getByRole('button', { name: /^Remover narrativa$/i }).click()
  await expect(confirmDialog).toHaveCount(0, { timeout: 10_000 })

  // ── No error banner (specifically NOT the misleading "not found" toast —
  // asserted by name, not just "some banner appeared/didn't"). ──
  await expect(page.getByRole('status').filter({ hasText: NOT_FOUND_MESSAGE })).toHaveCount(0)

  // ── Assert the RENDERED slot is GONE, identified by its own title, never
  // positionally (deleting-by-position has eaten seed rows here before). ──
  await expect(page.getByRole('region', { name: removeSlotTitle })).toHaveCount(0, { timeout: 10_000 })
  await expect(page.getByText(removeSlotTitle)).toHaveCount(0)

  // ── Assert the DB ROW itself is gone (service-role truth). ──
  const rowAfter = await dbGet<NarrativeRow>(
    page.request,
    `process_template_narratives?id=eq.${narrativeRow.id}&select=id,title,template_version_id`,
  )
  expect(rowAfter.length, 'the narrative-slot row must be GONE — a real removal, not a PGRST200 false "not found" leaving it in place').toBe(
    0,
  )
})

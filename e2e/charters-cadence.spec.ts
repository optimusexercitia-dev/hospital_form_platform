import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"

/**
 * Committee Charters & Meeting Cadence (S4·CH, Phase 21; ADR 0080; build plan
 * docs/plans/charters-cadence.md §9) — E2E acceptance.
 *
 * Route surface: charter page `/o/[org]/c/[commission]/manage/charter`
 * ("Regimento & Cadência"); meetings-list cadence indicator
 * `/o/[org]/c/[commission]/meetings`; carry-forward panel on the meeting
 * detail page, after the agenda, gated `chartersEnabled() && canEdit`
 * (staff_admin + an editable-status meeting). Flag `charters` is seed-ON
 * (prod stays OFF till pilot — ADR 0080 D11).
 *
 * Seeded, lead-verified cadence anchors (supabase/seed.sql "S4·CH" block):
 *   em_dia        Farmácia e Terapêutica  b0…b1  rede-a/farmacia    chefe.farm@test.local   (mensal + linked regimento DOC-0001)
 *   em_atraso     Farmácia B              c0…c2  rede-b/farmacia-b  staff1.qual.b@test.local (semanal, 30d-stale held meeting)
 *   sem_reunioes  Qualidade e Segurança   c0…c1  rede-b/qualidade   orgadmin.b@test.local    (mensal, no meeting)
 *   sem_regimento CCIH                    a0…a1  rede-a/ccih        chefe.ccih@test.local    (no charter row)
 * Password for every persona: Test1234!
 *
 * ⚠ The regimento's `code` renders the REAL auto-minted value `DOC-0001` (a
 * `mint_case_number`-style trigger), NOT the plan's stale "REG-0001" literal
 * — confirmed live (docker exec psql). AC-2 asserts title + review-due date,
 * never the code.
 *
 * Confidentiality-filter fixture note: `cases.visibility_policy` only has 2
 * values live (`commission_default` | `explicit_grants_only` — no
 * `participants_only`, that value belongs to `meetings.visibility_policy`).
 * `action_items.visibility_scope='case_restricted'` reads
 * `app.can_read_case(coalesce(source_case_id, linked_case_id), uid)` — CH-BE-3's
 * pgTAP exercised the same `can_read_action_item` call via an
 * `assignees_only` item; this spec exercises the `case_restricted` branch
 * specifically: a meeting-sourced item (`source_type='meeting'`) cross-linked
 * via `linked_case_id` to an `explicit_grants_only` case with no grant.
 *
 * This spec builds its OWN carry-forward/confidentiality world in
 * `beforeAll`/`afterAll` (service-role REST, mirrors
 * e2e/ethics-e2-procedure.spec.ts) on top of Farmácia (em_dia) — a
 * dedicated, most-recent `held` `commission_default` "source" meeting +
 * unresolved/resolved agenda items + a `committee` and a `case_restricted`
 * action item, plus a new `scheduled` "destination" meeting. Cleanup deletes
 * both meetings (cascades agenda/action items) + the restricted case, and
 * restores Farmácia's charter to its seeded `{mensal, DOC-0001}` regardless
 * of AC-4's outcome.
 *
 * Coverage map (plan §9 / CH-TEST brief):
 *   AC-1a..d  Cadence indicator, all 4 states (meetings list)
 *   AC-2      Regimento render (title + review-due date; not the code)
 *   AC-3      Foreign-commission denial (RPC HC0K2 + route 404, no leakage)
 *   AC-4      Charter save round-trip (frequency + regimento link),
 *             KEYBOARD-ONLY save, reload-persistence, restore
 *   AC-5      charter.upserted audit row, PHI-free (follows AC-4)
 *   AC-6      Carry-forward round-trip: tick + copy agenda onto a NEW
 *             meeting; originals untouched (history preserved); open action
 *             items render read-only
 *   AC-7      Confidentiality filter (RPC-level, integration proof): a
 *             case_restricted action item ABSENT for a member who cannot
 *             read the case; a committee item present (positive twin)
 *
 * No `waitForLoadState('networkidle')` (purged repo-wide) — web-first
 * assertions only. Runs against a dev or prod-standalone server per the
 * caller's harness.
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants (from supabase/seed.sql)
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY missing — set it in .env.local.')
}

const PW = 'Test1234!'

const ORG_A = 'rede-a'
const ORG_B = 'rede-b'

const FARM_SLUG = 'farmacia'
const FARM_COMM = 'b0000000-0000-0000-0000-0000000000b1'
const FARM_ORG_ID = '0c000000-0000-0000-0000-00000000000a'
const FARM_SA_EMAIL = 'chefe.farm@test.local'
const FARM_SA_UID = '00000000-0000-0000-0000-000000000005'
const FARM_STAFF_EMAIL = 'staff1.farm@test.local' // plain staff — no grant, no assignment
const REGIMENTO_DOC_ID = 'd0c00000-0000-0000-0000-0000000000f1'

const FARMB_SLUG = 'farmacia-b'
const FARMB_SA_EMAIL = 'staff1.qual.b@test.local'

const QUALB_SLUG = 'qualidade'
const QUALB_SA_EMAIL = 'orgadmin.b@test.local'

const CCIH_SLUG = 'ccih'
const CCIH_SA_EMAIL = 'chefe.ccih@test.local'

// Rede B user with ZERO membership anywhere in Rede A — the cross-org subject.
const FOREIGN_EMAIL = 'staff1.qual.b@test.local'

// ---------------------------------------------------------------------------
// Service-role REST helpers (mirrors e2e/ethics-e2-procedure.spec.ts)
// ---------------------------------------------------------------------------

const SERVICE_HEADERS = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
}

async function dbGet<T = Record<string, unknown>>(
  table: string,
  params: Record<string, string>,
): Promise<T[]> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, { headers: SERVICE_HEADERS })
  if (!res.ok) return []
  const data: unknown = await res.json()
  return Array.isArray(data) ? (data as T[]) : []
}

async function dbInsert<T = Record<string, unknown>>(
  table: string,
  row: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      ...SERVICE_HEADERS,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  })
  if (!res.ok) {
    throw new Error(`dbInsert ${table} failed: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as T[]
  return data[0]
}

async function dbDelete(table: string, params: Record<string, string>): Promise<void> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, { method: 'DELETE', headers: SERVICE_HEADERS })
}

/** Direct service-role PATCH — used ONLY by the file-level safety-net `afterAll`. */
async function dbPatch(
  table: string,
  params: Record<string, string>,
  fields: Record<string, unknown>,
): Promise<void> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    method: 'PATCH',
    headers: { ...SERVICE_HEADERS, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(fields),
  })
}

async function getOwnerToken(
  request: APIRequestContext,
  email: string,
  password = PW,
): Promise<string> {
  const resp = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password },
  })
  expect(resp.ok()).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

async function callRpc(
  request: APIRequestContext,
  fn: string,
  bearer: string,
  body: Record<string, unknown>,
) {
  return request.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, pw = PW) {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, pw)
}

/** pt-BR long date — byte-for-byte the same formatting as
 *  `manage/charter/page.tsx`'s `formatDateOnly` (day/month "long"/year, no tz shift). */
function formatPtBrLongDate(dateOnly: string): string {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, (m ?? 1) - 1, d ?? 1))
}

// ---------------------------------------------------------------------------
// Fixtures — the carry-forward + confidentiality world on Farmácia (em_dia)
// ---------------------------------------------------------------------------

let sourceMeetingId: string
let newMeetingId: string
let restrictedCaseId: string
let committeeActionId: string
let restrictedActionId: string
const AGENDA_UNRESOLVED_TITLES = ['CH-E2E Pendência A', 'CH-E2E Pendência B']
const AGENDA_RESOLVED_TITLE = 'CH-E2E Resolvida C'
const COMMITTEE_ACTION_TITLE = 'CH-E2E Ação comitê'
const RESTRICTED_ACTION_TITLE = 'CH-E2E Ação restrita'

let regimentoTitle: string
let regimentoReviewDueLabel: string
let auditBaselineCount: number

test.beforeAll(async () => {
  // Live regimento content (Rule: assert values, not literals — the review-due
  // date is `current_date + 335d` at seed time, so it is read back, not hardcoded).
  const [doc] = await dbGet<{ title: string; current_version_id: string }>('controlled_documents', {
    id: `eq.${REGIMENTO_DOC_ID}`,
    select: 'title,current_version_id',
  })
  const [ver] = await dbGet<{ review_due_date: string }>('controlled_document_versions', {
    id: `eq.${doc.current_version_id}`,
    select: 'review_due_date',
  })
  regimentoTitle = doc.title
  regimentoReviewDueLabel = formatPtBrLongDate(ver.review_due_date)

  // AC-5 baseline: seed inserts the charter row DIRECTLY (not via the RPC), so
  // there should be 0 pre-existing `charter.upserted` rows for Farmácia — but
  // read it live rather than assume, so the AC-5 assertion stays relative.
  const baseline = await dbGet('audit_log', {
    commission_id: `eq.${FARM_COMM}`,
    action: 'eq.charter.upserted',
    select: 'id',
  })
  auditBaselineCount = baseline.length

  // A same-commission case only a coordinator/assignee/grantee can read (no
  // grant issued to anyone here) — the confidentiality-filter target.
  const restrictedCase = await dbInsert<{ id: string }>('cases', {
    commission_id: FARM_COMM,
    organization_id: FARM_ORG_ID,
    label: 'CH-E2E Caso restrito (confidencialidade)',
    created_by: FARM_SA_UID,
    visibility_policy: 'explicit_grants_only',
  })
  restrictedCaseId = restrictedCase.id

  // The dedicated, most-recent HELD commission_default "source" meeting (direct
  // `held` insert is safe — `guard_meeting_status` only fires on UPDATE/DELETE,
  // per the seed's own precedent).
  const nowIso = new Date().toISOString()
  const source = await dbInsert<{ id: string }>('meetings', {
    commission_id: FARM_COMM,
    title: 'CH-E2E Reunião fonte (carry-forward)',
    modality: 'presencial',
    scheduled_start: nowIso,
    status: 'held',
    visibility_policy: 'commission_default',
    held_at: nowIso,
    created_by: FARM_SA_UID,
  })
  sourceMeetingId = source.id

  await dbInsert('meeting_agenda_items', {
    meeting_id: sourceMeetingId,
    position: 0,
    title: AGENDA_UNRESOLVED_TITLES[0],
    created_by: FARM_SA_UID,
  })
  await dbInsert('meeting_agenda_items', {
    meeting_id: sourceMeetingId,
    position: 1,
    title: AGENDA_UNRESOLVED_TITLES[1],
    created_by: FARM_SA_UID,
  })
  await dbInsert('meeting_agenda_items', {
    meeting_id: sourceMeetingId,
    position: 2,
    title: AGENDA_RESOLVED_TITLE,
    resolution: 'Encaminhado à direção',
    created_by: FARM_SA_UID,
  })

  const [openStatus] = await dbGet<{ id: string }>('action_item_statuses', {
    key: 'eq.open',
    commission_id: 'is.null',
    select: 'id',
  })

  const committeeItem = await dbInsert<{ id: string }>('action_items', {
    commission_id: FARM_COMM,
    source_type: 'meeting',
    source_meeting_id: sourceMeetingId,
    title: COMMITTEE_ACTION_TITLE,
    status_id: openStatus.id,
    visibility_scope: 'committee',
    created_by: FARM_SA_UID,
  })
  committeeActionId = committeeItem.id

  const restrictedItem = await dbInsert<{ id: string }>('action_items', {
    commission_id: FARM_COMM,
    source_type: 'meeting',
    source_meeting_id: sourceMeetingId,
    title: RESTRICTED_ACTION_TITLE,
    status_id: openStatus.id,
    visibility_scope: 'case_restricted',
    linked_case_id: restrictedCaseId,
    created_by: FARM_SA_UID,
  })
  restrictedActionId = restrictedItem.id

  // The new "destination" meeting AC-6 schedules the plenary content into.
  const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
  const dest = await dbInsert<{ id: string }>('meetings', {
    commission_id: FARM_COMM,
    title: 'CH-E2E Reunião agendada (destino)',
    modality: 'presencial',
    scheduled_start: future,
    status: 'scheduled',
    visibility_policy: 'commission_default',
    created_by: FARM_SA_UID,
  })
  newMeetingId = dest.id
})

test.afterAll(async () => {
  // Deleting the meetings cascades their agenda items + action items
  // (ON DELETE CASCADE on both FKs) — including anything AC-6 copied onto
  // newMeetingId.
  if (sourceMeetingId) await dbDelete('meetings', { id: `eq.${sourceMeetingId}` })
  if (newMeetingId) await dbDelete('meetings', { id: `eq.${newMeetingId}` })
  if (restrictedCaseId) await dbDelete('cases', { id: `eq.${restrictedCaseId}` })

  // Safety net: restore Farmácia's seeded charter regardless of AC-4's outcome
  // (mirrors ethics-e2-procedure.spec.ts's afterAll force-restore).
  await dbPatch(
    'commission_charters',
    { commission_id: `eq.${FARM_COMM}` },
    { meeting_frequency: 'mensal', controlled_document_id: REGIMENTO_DOC_ID },
  )
})

// ---------------------------------------------------------------------------
// AC-1 — Cadence indicator (meetings list), all 4 states
// ---------------------------------------------------------------------------

test('AC-1a — cadence indicator: Farmácia (em_dia) shows "Em dia"', async ({ page }) => {
  await signInAs(page, FARM_SA_EMAIL)
  await page.goto(`/o/${ORG_A}/c/${FARM_SLUG}/meetings`)
  await expect(page.getByRole('heading', { name: /reuniões/i }).first()).toBeVisible({ timeout: 10_000 })

  const cadenceRow = page.locator('div', { has: page.getByText('Cadência das reuniões:') }).first()
  await expect(cadenceRow.getByText('Em dia', { exact: true })).toBeVisible()
})

test('AC-1b — cadence indicator: Farmácia B (em_atraso) shows "Reunião em atraso"', async ({ page }) => {
  await signInAs(page, FARMB_SA_EMAIL)
  await page.goto(`/o/${ORG_B}/c/${FARMB_SLUG}/meetings`)
  await expect(page.getByRole('heading', { name: /reuniões/i }).first()).toBeVisible({ timeout: 10_000 })

  const cadenceRow = page.locator('div', { has: page.getByText('Cadência das reuniões:') }).first()
  await expect(cadenceRow.getByText('Reunião em atraso', { exact: true })).toBeVisible()
})

test('AC-1c — cadence indicator: Qualidade e Segurança (sem_reunioes) shows "Sem reuniões registradas"', async ({
  page,
}) => {
  await signInAs(page, QUALB_SA_EMAIL)
  await page.goto(`/o/${ORG_B}/c/${QUALB_SLUG}/meetings`)
  await expect(page.getByRole('heading', { name: /reuniões/i }).first()).toBeVisible({ timeout: 10_000 })

  const cadenceRow = page.locator('div', { has: page.getByText('Cadência das reuniões:') }).first()
  await expect(cadenceRow.getByText('Sem reuniões registradas', { exact: true })).toBeVisible()
})

test('AC-1d — cadence indicator: CCIH (sem_regimento, no charter row) shows "Regimento/cadência não configurado"', async ({
  page,
}) => {
  await signInAs(page, CCIH_SA_EMAIL)
  await page.goto(`/o/${ORG_A}/c/${CCIH_SLUG}/meetings`)
  await expect(page.getByRole('heading', { name: /reuniões/i }).first()).toBeVisible({ timeout: 10_000 })

  const cadenceRow = page.locator('div', { has: page.getByText('Cadência das reuniões:') }).first()
  await expect(cadenceRow.getByText('Regimento/cadência não configurado', { exact: true })).toBeVisible()
})

// ---------------------------------------------------------------------------
// AC-2 — Regimento render (title + review-due date; NOT the doc code)
// ---------------------------------------------------------------------------

test('AC-2 — charter page renders the linked regimento (title + review-due date, not the literal code)', async ({
  page,
}) => {
  await signInAs(page, FARM_SA_EMAIL)
  await page.goto(`/o/${ORG_A}/c/${FARM_SLUG}/manage/charter`)
  await expect(page.getByRole('heading', { name: /regimento & cadência/i }).first()).toBeVisible({
    timeout: 10_000,
  })

  const regimentoSection = page.locator('section', {
    has: page.getByRole('heading', { name: /documento do regimento/i }),
  })
  await expect(regimentoSection.getByText(regimentoTitle)).toBeVisible()
  await expect(regimentoSection.getByText(`Revisão prevista até ${regimentoReviewDueLabel}.`)).toBeVisible()
  await expect(regimentoSection.getByRole('link', { name: /ver documento/i })).toBeVisible()
})

// ---------------------------------------------------------------------------
// AC-3 — Foreign-commission denial (RPC HC0K2 + route 404, no data leakage)
// ---------------------------------------------------------------------------

test('AC-3 — a foreign-commission (Rede B) user gets no cadence read and no route access on a Rede A commission', async ({
  page,
  request,
}) => {
  // RPC-level: FOREIGN_EMAIL is a Rede B user with zero membership anywhere
  // in Rede A — meeting_cadence_status must refuse HC0K2, not silently
  // return some default status.
  const token = await getOwnerToken(request, FOREIGN_EMAIL)
  const resp = await callRpc(request, 'meeting_cadence_status', token, { p_commission: FARM_COMM })
  expect(resp.ok()).toBeFalsy()
  const body = (await resp.json()) as { code?: string; message?: string }
  expect(body.code).toBe('HC0K2')
  const bodyText = JSON.stringify(body)
  expect(bodyText).not.toMatch(/em_dia|em_atraso|sem_reunioes|sem_regimento/)

  // UI-level: the meetings route 404s — no content leaks through the shell.
  await signInAs(page, FOREIGN_EMAIL)
  await page.goto(`/o/${ORG_A}/c/${FARM_SLUG}/meetings`)
  await expect(page.getByText(/não encontramos esta página/i)).toBeVisible({ timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// AC-4 — Charter save round-trip, KEYBOARD-ONLY, reload-persistence, restore
// ---------------------------------------------------------------------------

test('AC-4 — charter save round-trip (frequency + regimento link), keyboard-only, persists on reload', async ({
  page,
}) => {
  await signInAs(page, FARM_SA_EMAIL)
  await page.goto(`/o/${ORG_A}/c/${FARM_SLUG}/manage/charter`)
  await expect(page.getByRole('heading', { name: /regimento & cadência/i }).first()).toBeVisible({
    timeout: 10_000,
  })

  const freqSelect = page.locator('#meetingFrequency')
  await expect(freqSelect).toHaveValue('mensal')

  // KEYBOARD-ONLY: focus the native select, jump to "Bimestral" via native
  // type-ahead (a unique first letter among the 5 options — no mouse), then
  // focus + activate Save with Enter.
  await freqSelect.focus()
  await expect(freqSelect).toBeFocused()
  await page.keyboard.press('b')
  await expect(freqSelect).toHaveValue('bimestral')

  const saveBtn = page.getByRole('button', { name: /salvar configuração/i })
  await saveBtn.focus()
  await expect(saveBtn).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('status')).toContainText('Regimento e cadência atualizados.', {
    timeout: 10_000,
  })

  // Reload — the value sticks (a real server round-trip, not optimistic UI).
  await page.reload()
  await expect(page.locator('#meetingFrequency')).toHaveValue('bimestral', { timeout: 10_000 })
  // The single-upsert form posts both fields together — the regimento link
  // must survive a frequency-only change untouched.
  await expect(page.locator('#controlledDocumentId')).toHaveValue(REGIMENTO_DOC_ID)
  // Farmácia's held meeting (2 days old) sits inside BOTH the mensal AND the
  // bimestral windows, so the cadence badge stays "Em dia" across this change.
  const cadenceSection = page.locator('section', {
    has: page.getByRole('heading', { name: /situação da cadência/i }),
  })
  await expect(cadenceSection.getByText('Em dia', { exact: true })).toBeVisible()

  // Restore the seeded value through the SAME UI door (a genuine regression
  // test of the door, not a one-way mutation — mirrors ethics-e2's convention).
  await page.locator('#meetingFrequency').selectOption('mensal')
  await page.getByRole('button', { name: /salvar configuração/i }).click()
  await expect(page.getByRole('status')).toContainText('Regimento e cadência atualizados.', {
    timeout: 10_000,
  })
  await page.reload()
  await expect(page.locator('#meetingFrequency')).toHaveValue('mensal', { timeout: 10_000 })
  await expect(page.locator('#controlledDocumentId')).toHaveValue(REGIMENTO_DOC_ID)
})

// ---------------------------------------------------------------------------
// AC-5 — charter.upserted audit row, PHI-free (follows AC-4's 2 saves)
// ---------------------------------------------------------------------------

test('AC-5 — the charter save(s) in AC-4 emit charter.upserted audit rows, PHI-free', async () => {
  const rows = await dbGet<{
    entity_type: string
    entity_id: string
    commission_id: string
    metadata: Record<string, unknown>
    occurred_at: string
  }>('audit_log', {
    commission_id: `eq.${FARM_COMM}`,
    action: 'eq.charter.upserted',
    select: '*',
    order: 'occurred_at.desc',
  })

  expect(rows.length).toBeGreaterThan(auditBaselineCount)

  const latest = rows[0]
  expect(latest.entity_type).toBe('commission')
  expect(latest.entity_id).toBe(FARM_COMM)
  // PHI-free (Rule 12): config-level metadata only — frequency + whether a
  // regimento is linked, nothing else (no names, no free text).
  expect(Object.keys(latest.metadata).sort()).toEqual(['has_regimento', 'meeting_frequency'])
  expect(latest.metadata.has_regimento).toBe(true)
  // AC-4's LAST save was the restore-to-mensal.
  expect(latest.metadata.meeting_frequency).toBe('mensal')
})

// ---------------------------------------------------------------------------
// AC-6 — Carry-forward round-trip: tick + copy agenda; originals untouched
// ---------------------------------------------------------------------------

test('AC-6 — carry-forward: unresolved agenda copies onto the new meeting; originals + open action items stay untouched', async ({
  page,
}) => {
  await signInAs(page, FARM_SA_EMAIL)
  await page.goto(`/o/${ORG_A}/c/${FARM_SLUG}/meetings/${newMeetingId}`)

  const panel = page.locator('section', {
    has: page.getByRole('heading', { name: /continuidade da última reunião/i }),
  })
  await expect(panel).toBeVisible({ timeout: 10_000 })
  await expect(panel.getByText(`Pauta pendente (${AGENDA_UNRESOLVED_TITLES.length})`)).toBeVisible()
  for (const title of AGENDA_UNRESOLVED_TITLES) {
    await expect(panel.getByText(title, { exact: true })).toBeVisible()
  }
  // The resolved item is never suggested.
  await expect(panel.getByText(AGENDA_RESOLVED_TITLE)).toHaveCount(0)

  // Open meeting-sourced action items render READ-ONLY beside the agenda.
  await expect(panel.getByText(COMMITTEE_ACTION_TITLE)).toBeVisible()
  await expect(panel.getByText('ainda em aberto').first()).toBeVisible()

  // Tick both unresolved items and copy them forward.
  for (const title of AGENDA_UNRESOLVED_TITLES) {
    const item = panel.locator('li', { hasText: title })
    await item.getByRole('checkbox').click()
  }
  const bringBtn = panel.getByRole('button', {
    name: `Trazer ${AGENDA_UNRESOLVED_TITLES.length} para a pauta`,
  })
  await expect(bringBtn).toBeVisible()
  await bringBtn.click()

  await expect(panel.getByRole('status')).toContainText(
    `${AGENDA_UNRESOLVED_TITLES.length} itens de pauta trazidos para esta reunião.`,
    { timeout: 10_000 },
  )

  // DB-level proof (assert on values, not rendering): the NEW meeting has 2
  // fresh unresolved rows; the SOURCE meeting's 3 rows are byte-for-byte
  // untouched (history preserved).
  const newRows = await dbGet<{ title: string; resolution: string | null }>('meeting_agenda_items', {
    meeting_id: `eq.${newMeetingId}`,
    select: 'title,resolution',
  })
  expect(newRows.map((r) => r.title).sort()).toEqual([...AGENDA_UNRESOLVED_TITLES].sort())
  for (const row of newRows) expect(row.resolution).toBeNull()

  const sourceRows = await dbGet<{ title: string; resolution: string | null }>('meeting_agenda_items', {
    meeting_id: `eq.${sourceMeetingId}`,
    select: 'title,resolution',
    order: 'position.asc',
  })
  expect(sourceRows.map((r) => r.title)).toEqual([...AGENDA_UNRESOLVED_TITLES, AGENDA_RESOLVED_TITLE])
  expect(sourceRows.filter((r) => r.resolution === null).length).toBe(2)
  expect(sourceRows.find((r) => r.title === AGENDA_RESOLVED_TITLE)?.resolution).toBe('Encaminhado à direção')
})

// ---------------------------------------------------------------------------
// AC-7 — Confidentiality filter (RPC-level, integration proof)
// ---------------------------------------------------------------------------

test('AC-7 — carry-forward confidentiality filter: a case_restricted action item is absent for a member who cannot read the case (committee item present as a positive twin)', async ({
  request,
}) => {
  // FARM_STAFF_EMAIL is a plain 'staff' of Farmácia — member (passes HC0K2),
  // but not staff_admin, not assigned, not granted on restrictedCaseId.
  const token = await getOwnerToken(request, FARM_STAFF_EMAIL)
  const resp = await callRpc(request, 'suggest_carry_forward', token, { p_commission: FARM_COMM })
  expect(resp.ok()).toBeTruthy()
  const body = (await resp.json()) as { actionItems: Array<{ id: string; title: string }> }

  const ids = body.actionItems.map((a) => a.id)
  const titles = body.actionItems.map((a) => a.title)

  // Positive twin — proves the list isn't just blanket-empty.
  expect(ids).toContain(committeeActionId)
  expect(titles).toContain(COMMITTEE_ACTION_TITLE)

  // Confidentiality filter — absent by id AND by title (no leakage either way).
  expect(ids).not.toContain(restrictedActionId)
  expect(titles).not.toContain(RESTRICTED_ACTION_TITLE)
})

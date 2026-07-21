import { expect, type Cookie, type Locator, type Page } from '@playwright/test'
import { execSync } from 'node:child_process'

/**
 * Shared scaffolding for the controlled-documents E2E suites (Phase 17 v2 —
 * Controlled-Document Redesign, ADR 0081). Split out of the single-file Phase-17
 * spec so both `phase17-documents.spec.ts` (lifecycle/regression) and
 * `documents-redesign.spec.ts` (the redesign's new surfaces) share one source of
 * truth for auth, DB-truth reads, and the seeded fixture ids — avoiding drift
 * between the two files' personas/hrefs.
 *
 * Local Supabase stack only; never mutates data under test via anything but the
 * documented RPCs/actions (the `sql`/`servicePost` helpers are fixture/flag
 * scaffolding ONLY).
 */

export const SUPABASE_URL = 'http://127.0.0.1:54321'
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

export const COMMISSION_A_ID = 'a0000000-0000-0000-0000-0000000000a1' // CCIH
export const DB_CONTAINER = 'supabase_db_azkbbhskturikxpgmafq'

/** Run SQL as postgres via docker exec — fixture/flag scaffold ONLY (never data under test). */
export function sql(query: string): string {
  const escaped = query.replace(/"/g, '\\"')
  return execSync(`docker exec ${DB_CONTAINER} psql -U postgres -d postgres -tA -c "${escaped}"`, {
    encoding: 'utf8',
  })
    .toString()
    .trim()
}

/** Flip the controlled_docs flag (the surface gate lives in app.feature_flags, not PostgREST-reachable). */
export function setControlledDocsFlag(enabled: boolean): void {
  sql(`update app.feature_flags set enabled = ${enabled} where key = 'controlled_docs';`)
}

/**
 * Per-persona auth-cookie cache. These specs switch personas MANY times; a fresh
 * `/login` on every switch exhausts the local GoTrue rate-limit (→ "Não foi
 * possível concluir"). So we log each persona in ONCE, cache its cookies, and on
 * later switches just restore the cookies (no login round-trip). Scoped by
 * browser-context (cleared on re-login). Shared across spec FILES within a run
 * since each file gets its own worker/module instance in practice, but the cache
 * being per-module is harmless — worst case it just re-logs in once per file.
 */
const cookieJar = new Map<string, Cookie[]>()

async function loginFresh(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 })
}

export async function signInAs(page: Page, email: string, password = 'Test1234!'): Promise<void> {
  // Always clear first — navigating to /login while still authenticated redirects to
  // the previous user's home (no login form appears).
  await page.context().clearCookies()

  const cached = cookieJar.get(email)
  if (cached && cached.length > 0) {
    await page.context().addCookies(cached)
    return
  }

  await loginFresh(page, email, password)
  cookieJar.set(email, await page.context().cookies())
}

/** Service-role REST query (DB-truth assertions only — never mutates data under test). */
export async function serviceQuery<T>(page: Page, path: string): Promise<T[]> {
  const resp = await page.request.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

/** Service-role INSERT (test scaffold only). */
export async function servicePost(page: Page, path: string, body: unknown): Promise<void> {
  const resp = await page.request.post(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    data: body,
  })
  expect(resp.ok(), `service POST ${path}`).toBeTruthy()
}

export async function docIdByCode(page: Page, code: string, commissionId = COMMISSION_A_ID): Promise<string> {
  const rows = await serviceQuery<{ id: string }>(
    page,
    `controlled_documents?commission_id=eq.${commissionId}&code=eq.${code}&select=id`,
  )
  expect(rows.length, `document ${code} seeded`).toBe(1)
  return rows[0].id
}

export const commissionDocHref = (id: string) => `/o/rede-a/c/ccih/manage/documentos/${id}`
export const newVersionHref = (id: string) => `/o/rede-a/c/ccih/manage/documentos/${id}/nova-versao`

/**
 * Choose an approver in the DETAIL PAGE's submit-for-approval `NativeSelect`
 * picker (the resubmit-after-reject / inline-supersede flows still use this
 * `<select>`+"Adicionar" form — distinct from the wizard's `ReviewerPicker`
 * member-card grid) by a display-name substring, then click "Adicionar".
 */
export async function pickApprover(form: Locator, nameSubstring: string): Promise<void> {
  const picker = form.getByLabel(/adicionar aprovador/i)
  const value = await picker
    .locator('option')
    .evaluateAll(
      (opts, needle) => {
        const match = (opts as HTMLOptionElement[]).find(
          (o) => o.value && o.textContent?.toLowerCase().includes(needle.toLowerCase()),
        )
        return match?.value ?? ''
      },
      nameSubstring,
    )
  if (!value) throw new Error(`approver option matching "${nameSubstring}" not found in picker`)
  await picker.selectOption(value)
  await form.getByRole('button', { name: /^adicionar$/i }).click()
}

// A tiny inline PDF as a Playwright file payload.
export const pdfPayload = {
  name: 'doc.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
  ),
}

/**
 * Publish the current em_aprovacao version from the coordinator detail via the
 * publish dialog: pick an effective date in the calendar, submit, and return the
 * chosen `YYYY-MM-DD`. (The DatePicker is a custom popover with a hidden input —
 * driven via the shared pickDate helper, never `input[name].fill()`.)
 */
export async function publishViaDialog(page: Page): Promise<string> {
  // Lazy import to avoid a hard module cycle at the top (date-pickers has no
  // dependency back on this file, but keeping the import local documents why).
  const { pickDate, readHiddenDateValue } = await import('./date-pickers')
  await page.getByRole('button', { name: /^publicar$/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await pickDate(dialog, page, { trigger: dialog.locator('button[aria-haspopup="dialog"]').first() })
  const effective = await readHiddenDateValue(dialog, 'effectiveDate')
  await dialog.getByRole('button', { name: /^publicar$/i }).click()
  return effective
}

const ownerTokenCache = new Map<string, string>()

/** An owner (persona) JWT — RLS evaluated under it; used for owner-token RPC calls. */
export async function ownerToken(page: Page, email: string, password = 'Test1234!'): Promise<string> {
  const cached = ownerTokenCache.get(email)
  if (cached) return cached
  const resp = await page.request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password },
  })
  expect(resp.ok(), `token for ${email}`).toBeTruthy()
  const token = ((await resp.json()) as { access_token: string }).access_token
  ownerTokenCache.set(email, token)
  return token
}

/** ISO date `daysAgo` days in the past. */
export function pastDateIso(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

/** ISO date `daysAhead` days in the future. */
export function futureDateIso(daysAhead: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().slice(0, 10)
}

/**
 * Add `months` to a `YYYY-MM-DD` date the way Postgres `date + make_interval(months=>n)`
 * does (month arithmetic clamps to the last valid day).
 */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  const targetMonthIndex = base.getUTCMonth() + months
  const target = new Date(Date.UTC(base.getUTCFullYear(), targetMonthIndex, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

/**
 * Press Tab repeatedly (up to a cap) until `isTarget()` returns true. Keyboard-only
 * navigation helper for the a11y flows. Throws if the target is never focused.
 */
export async function focusByTabbing(page: Page, isTarget: () => Promise<boolean>, max = 60): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await isTarget()) return
    await page.keyboard.press('Tab')
  }
  if (await isTarget()) return
  throw new Error('keyboard: target element was never focused within the tab budget')
}

// ---------------------------------------------------------------------------
// Create/new-version wizard helpers (CreateWizard — F-B)
// ---------------------------------------------------------------------------

/** Click a Segmented `role="radio"` option by its pt-BR label (e.g. "Protocolo"). */
export async function selectSegmented(page: Page, label: string): Promise<void> {
  await page.getByRole('radio', { name: label, exact: true }).click()
}

/** Toggle a `ReviewerPicker` candidate card (role=checkbox) by a name substring. */
export async function toggleReviewer(page: Page, nameSubstring: string): Promise<void> {
  await page.getByRole('checkbox', { name: new RegExp(nameSubstring, 'i') }).click()
}

export const continuarButton = (page: Page) => page.getByRole('button', { name: /^continuar$/i })
export const voltarButton = (page: Page) => page.getByRole('button', { name: /^voltar$/i })
export const enviarButton = (page: Page) => page.getByRole('button', { name: /enviar para aprovação/i })
export const salvarRascunhoButton = (page: Page) => page.getByRole('button', { name: /salvar rascunho/i })

/**
 * Build + publish a controlled document end-to-end via the CREATE WIZARD
 * (title/type → file+dates → one approver → submit), then sign as staff1.ccih
 * and publish as chefe.ccih. Returns the document id. Signed in as chefe.ccih on
 * entry; leaves the session on chefe.ccih. Used by specs that need a ready
 * `effective` fixture doc without re-deriving the wizard steps each time.
 */
export async function buildPublishedDocViaWizard(page: Page, title: string): Promise<string> {
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')
  await page.getByLabel('Título').fill(title)
  await selectSegmented(page, 'Protocolo')
  await page.locator('#wizard-file').setInputFiles(pdfPayload)
  await continuarButton(page).click()
  await toggleReviewer(page, 'Enfermeiro CCIH Um')
  await continuarButton(page).click()
  await enviarButton(page).click()

  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}\?aviso=enviado$/, { timeout: 20_000 })
  const docId = page.url().split('/').pop()!.split('?')[0]

  const versionId = (
    await expect
      .poll(
        async () =>
          (
            await serviceQuery<{ id: string; status: string }>(
              page,
              `controlled_document_versions?document_id=eq.${docId}&select=id,status`,
            )
          )[0]?.status === 'in_approval'
            ? true
            : null,
        { timeout: 15_000 },
      )
      .not.toBeNull()
      .then(
        async () =>
          (await serviceQuery<{ id: string }>(page, `controlled_document_versions?document_id=eq.${docId}&select=id`))[0]
            .id,
      )
  )

  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/documentos-pendentes/${docId}`)
  await page.getByRole('button', { name: /^aprovar$/i }).click()
  await page.getByRole('button', { name: /confirmar aprovação/i }).click()
  await expect
    .poll(
      async () =>
        (await serviceQuery<{ decision: string | null }>(page, `document_approvals?document_version_id=eq.${versionId}&select=decision`))[0]
          ?.decision,
      { timeout: 15_000 },
    )
    .toBe('approved')

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(commissionDocHref(docId))
  await publishViaDialog(page)
  await expect
    .poll(
      async () =>
        (await serviceQuery<{ status: string }>(page, `controlled_document_versions?id=eq.${versionId}&select=status`))[0]?.status,
      { timeout: 15_000 },
    )
    .toBe('effective')

  return docId
}

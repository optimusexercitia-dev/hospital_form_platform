import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { expect, type Page, type Locator } from '@playwright/test'
import { purgeFormsByTag } from './purge-forms'

/**
 * Shared primitives for the FF-2 matrix specs (ADR 0089).
 *
 * Extracted for `ff2-matrix-views.spec.ts` (the READ surfaces: sign-off,
 * submission detail, dashboard). `ff2-matrix.spec.ts` keeps its own inline
 * copies deliberately — it is green and re-running it is the gate for
 * BUG-FF2-004, so it is not worth churning a passing file to save duplication.
 */

export const SUPABASE_URL = 'http://127.0.0.1:54321'
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

export const DB_CONTAINER = 'supabase_db_azkbbhskturikxpgmafq'
export const ORG = 'rede-a'
export const SLUG = 'ccih'
export const COMMISSION_CCIH = 'a0000000-0000-0000-0000-0000000000a1'
export const USER_CHEFE = '00000000-0000-0000-0000-000000000002'

// ---------------------------------------------------------------------------
// Auth / RPC
// ---------------------------------------------------------------------------

// Shared session cache — see ./auth. Re-exported so existing imports keep working.
export { cachedSignIn as signInAs } from './auth'

export async function getToken(
  page: Page,
  email: string,
  password = 'Test1234!',
): Promise<string> {
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

export async function rpcAs<T>(
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
// DB — fixture setup / cleanup and DB-truth reads only. psql reads stdin, so no
// shell escaping of pt-BR text is involved.
// ---------------------------------------------------------------------------

export function psql(sqlText: string): string {
  return execSync(
    `docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -tA -F "|"`,
    { input: sqlText, encoding: 'utf8' },
  )
    .toString()
    .trim()
}

/**
 * ⚠ `psql -tA` prints an empty string for BOTH "no rows" and "one row whose
 * only column is `''`", and this helper reports the first. When a column can
 * legitimately be the empty string, select a SENTINEL instead of the raw value
 * (`case when x = '' then 'EMPTY' … end`) — otherwise the state under test is
 * indistinguishable from its own absence, which reads as a passing test on an
 * arrange that silently did nothing.
 */
export function sqlRows(query: string): string[][] {
  const out = psql(query)
  if (out === '') return []
  return out.split(/\r?\n/).map((line) => line.split('|'))
}

export function sqlOne(query: string): string {
  const rows = sqlRows(query)
  expect(rows.length, `esperava exatamente uma linha de: ${query}`).toBe(1)
  return rows[0][0]
}

/**
 * Delete every form tagged `tag`, child-first.
 *
 * The delete still runs under `session_replication_role = replica` to get past
 * the immutability guards — but it no longer relies on FK CASCADE, which that
 * same switch silently disables. See `./purge-forms` (BUG-E2EISO-002).
 */
export function purgeByTag(tag: string) {
  purgeFormsByTag(tag)
}

// ---------------------------------------------------------------------------
// Axis fixtures
// ---------------------------------------------------------------------------

export type Axis = { code: string; label: string; weight?: number }

export const CONFORMIDADE_ROWS: Axis[] = [
  { code: 'higienizacao', label: 'Higienização das mãos' },
  { code: 'epi', label: 'Uso de EPI' },
  { code: 'descarte', label: 'Descarte de perfurocortantes' },
]
export const CONFORMIDADE_COLS: Axis[] = [
  { code: 'conforme', label: 'Conforme' },
  { code: 'nao_conforme', label: 'Não conforme' },
  { code: 'na', label: 'Não se aplica' },
]
export const SEVERITY_ROWS: Axis[] = [
  { code: 'leve', label: 'Leve', weight: 1 },
  { code: 'moderada', label: 'Moderada', weight: 3 },
  { code: 'grave', label: 'Grave', weight: 9 },
]
export const LIKELIHOOD_COLS: Axis[] = [
  { code: 'rara', label: 'Rara', weight: 1 },
  { code: 'provavel', label: 'Provável', weight: 3 },
  { code: 'frequente', label: 'Frequente', weight: 9 },
]

/** The riskBands used across these fixtures: 1 Baixo · 9 Médio · 27 Alto. */
export const RISK_BANDS_SQL =
  `jsonb_build_object('riskBands', jsonb_build_array(` +
  `jsonb_build_object('minScore',1,'label','Baixo'),` +
  `jsonb_build_object('minScore',9,'label','Médio'),` +
  `jsonb_build_object('minScore',27,'label','Alto')))`

export function axisInsert(
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

export type FixtureForm = {
  formId: string
  versionId: string
  sectionId: string
  /** Named, sign-off-bearing section when the fixture asked for one. */
  signoffSectionId: string
  items: Record<string, string>
}

/**
 * Build + PUBLISH a spec-owned form.
 *
 * `signoff: true` adds a SECOND, NAMED section carrying
 * `requires_signoff` / `signoff_role = 'staff_admin'` and puts the items there.
 * That shape is forced by the schema, not by taste:
 * `form_sections_default_shape` refuses `requires_signoff` on an `is_default`
 * section, so a sign-off fixture is necessarily two sections.
 */
export function seedForm(
  title: string,
  build: (ids: {
    versionId: string
    sectionId: string
    id: (name: string) => string
  }) => string,
  opts: { signoff?: boolean } = {},
): FixtureForm {
  const formId = randomUUID()
  const versionId = randomUUID()
  const defaultSectionId = randomUUID()
  const signoffSectionId = randomUUID()
  const items: Record<string, string> = {}
  const id = (name: string) => {
    if (!items[name]) items[name] = randomUUID()
    return items[name]
  }
  // Items land in the sign-off section when there is one.
  const itemSectionId = opts.signoff ? signoffSectionId : defaultSectionId
  const body = build({ versionId, sectionId: itemSectionId, id })

  psql(
    `set client_encoding to 'UTF8';\n` +
      `insert into public.forms (id, commission_id, title, description, created_by)\n` +
      `values ('${formId}','${COMMISSION_CCIH}','${title}','Fixture','${USER_CHEFE}');\n` +
      `insert into public.form_versions (id, form_id, version_number, status, created_by)\n` +
      `values ('${versionId}','${formId}',1,'draft','${USER_CHEFE}');\n` +
      `insert into public.form_sections (id, form_version_id, position, title, is_default)\n` +
      `values ('${defaultSectionId}','${versionId}',0,null,true);\n` +
      (opts.signoff
        ? `insert into public.form_sections\n` +
          `  (id, form_version_id, position, title, is_default, requires_signoff, signoff_role)\n` +
          `values ('${signoffSectionId}','${versionId}',1,'Verificação em campo',false,true,'staff_admin');\n`
        : '') +
      `${body}\n` +
      `select public.publish_form_version('${versionId}');`,
  )
  return {
    formId,
    versionId,
    sectionId: itemSectionId,
    signoffSectionId,
    items,
  }
}

// ---------------------------------------------------------------------------
// Wizard / grid locators
// ---------------------------------------------------------------------------

export async function enterWizard(page: Page, formTitle: string) {
  await page.goto(`/o/${ORG}/c/${SLUG}/forms`)
  const cardScope = page.locator('article').filter({ hasText: formTitle })
  const continuar = cardScope.getByRole('link', { name: /continuar preenchimento/i })
  const preencher = cardScope.getByRole('button', { name: /preencher/i })
  await expect(continuar.or(preencher).first()).toBeVisible({ timeout: 20_000 })
  if (await continuar.first().isVisible()) await continuar.first().click()
  else await preencher.first().click()
  await page.waitForURL(/\/responder\//, { timeout: 25_000 })
}

export function responseIdFromUrl(page: Page): string {
  const m = page.url().match(/\/responder\/([0-9a-f-]{36})/)
  if (!m) throw new Error(`URL não é um wizard de resposta: ${page.url()}`)
  return m[1]
}

/** A read-only matrix cell's sr-only state line: "linha, coluna: selecionado". */
export function readonlyCell(
  scope: Page | Locator,
  row: string,
  col: string,
  state: 'selecionado' | 'não selecionado' = 'selecionado',
): Locator {
  return scope.getByText(`${row}, ${col}: ${state}`, { exact: true })
}

/** DB truth: `rowCode|colCode` for one item's cells in one response. */
export function cellsOf(responseId: string, itemId: string): string[][] {
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

export function riskOf(responseId: string, itemId: string): string[][] {
  return sqlRows(
    `select r.code, c.code, arm.risk_score::text
       from public.answer_risk_matrix arm
       join public.answers a on a.id = arm.answer_id
       join public.form_matrix_rows r on r.id = arm.severity_row_id
       join public.form_matrix_columns c on c.id = arm.likelihood_col_id
      where a.response_id = '${responseId}' and a.item_id = '${itemId}';`,
  )
}

export function responseStatus(responseId: string): string {
  return sqlOne(`select status from public.responses where id = '${responseId}';`)
}

/** Start an `in_progress` response for a version, under a persona's own token. */
export async function startResponse(
  page: Page,
  title: string,
): Promise<string> {
  await enterWizard(page, title)
  return responseIdFromUrl(page)
}

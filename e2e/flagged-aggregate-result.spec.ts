import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"

/**
 * Form-builder-enhancements batch (ad-hoc 2026-07-06) — TASKS 3 + 4:
 * Flagged options + aggregate phase-result criteria (`__total_score__` /
 * `__flagged_count__`) — build → fill → compute.
 *
 * Acceptance:
 *   - A form with (a) flagged options, (b) a number item with a "Flagged If"
 *     condition, (c) scored options; attached to a process phase whose result
 *     ruleset uses the NEW criterion types "Pontuação total" (`__total_score__`)
 *     and "Itens marcados" (`__flagged_count__`).
 *   - Filling a case through that phase and submitting yields a COMPUTED phase
 *     result equal to what the builder's live preview shows for the same inputs.
 *   - The integer SCORE system still works in parallel (not replaced by flagged).
 *
 * The evaluator is byte-for-byte unchanged (Rule 3): the two aggregates are
 * synthetic reserved keys injected into the answer map by
 * `app.compute_case_phase_result` (migration …000700). This spec proves the
 * INJECTION → RULE-WALK path end-to-end via the RPC + UI.
 *
 * Hermeticity: mirrors case-phase-result.spec.ts — a spec-owned form + templates
 * built via the service role (bypasses RLS), published + filled via persona JWTs,
 * asserted through the UI. Purged before + after (idempotent).
 *
 * Personas (Test1234!): chefe.ccih (staff_admin CCIH), staff1.ccih (staff CCIH).
 * Serial mode — shared fixtures + flag posture.
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

const COMM_A = 'a0000000-0000-0000-0000-0000000000a1'
const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002'
const UID_STAFF_1 = '00000000-0000-0000-0000-000000000003'

const TAG = 'FLAG-AGG'
const FORM_TITLE = `Checklist ${TAG}`
const TEMPLATE_TITLE = `Template ${TAG}`

// Result vocabulary labels this spec owns.
const R_CRITICO = `Crítico ${TAG}`
const R_ATENCAO = `Atenção ${TAG}`
const R_NORMAL = `Normal ${TAG}`

// ---------------------------------------------------------------------------
// Fixture state
// ---------------------------------------------------------------------------

let specVersionId: string
let specSectionId: string
let severityItemId: string // multiple_choice: Grave(3,flag) / Moderado(3) / Leve(1)
let tempItemId: string // number with flaggedWhen gt 38

let criticoId: string
let atencaoId: string
let normalId: string
let templateId: string

let caseCritico: string // Grave + temp 39 → flagged_count 2 → Crítico
let caseNormal: string // Leve + temp 37 → nothing → Normal (default)
let caseAtencao: string // Moderado + temp 37 → score 3, flagged 0 → Atenção

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, password)
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

async function svcGet<T>(req: APIRequestContext, path: string): Promise<T[]> {
  const resp = await req.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
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

/** Insert flagged/scored option rows for a choice item. */
async function insertOptions(
  req: APIRequestContext,
  itemId: string,
  versionId: string,
  opts: Array<{ label: string; score?: number; flagged?: boolean }>,
): Promise<void> {
  for (let i = 0; i < opts.length; i++) {
    const o = opts[i]
    await svcInsert(req, 'form_item_options', {
      item_id: itemId,
      form_version_id: versionId,
      position: i,
      code: slug(o.label),
      label: o.label,
      score: o.score ?? null,
      flagged: o.flagged ?? false,
    })
  }
}

async function purge() {
  const { spawnSync } = await import('child_process')
  const sql = [
    'SET session_replication_role = replica',
    `DELETE FROM responses WHERE case_phase_id IN (
       SELECT cp.id FROM case_phases cp JOIN cases c ON c.id = cp.case_id
       WHERE c.label LIKE 'Caso ${TAG}%')`,
    `DELETE FROM cases WHERE label LIKE 'Caso ${TAG}%'`,
    `DELETE FROM process_templates WHERE title LIKE 'Template ${TAG}%' AND commission_id = '${COMM_A}'`,
    `DELETE FROM forms WHERE title = '${FORM_TITLE}' AND commission_id = '${COMM_A}'`,
    `DELETE FROM phase_results WHERE commission_id = '${COMM_A}' AND label LIKE '%${TAG}'`,
    'SET session_replication_role = DEFAULT',
  ].join('; ')
  spawnSync(
    'docker',
    [
      'exec', 'supabase_db_azkbbhskturikxpgmafq',
      'psql', '-U', 'postgres', '-d', 'postgres', '-c', sql,
    ],
    { cwd: process.cwd(), stdio: 'pipe' },
  )
}

// ---------------------------------------------------------------------------
// Suite setup — build the whole flagged/aggregate fixture via service role + RPC
// ---------------------------------------------------------------------------

test.beforeAll(async ({ request }) => {
  await purge()

  // 1. Form + draft version + default section.
  const form = await svcInsert<{ id: string }>(request, 'forms', {
    commission_id: COMM_A,
    title: FORM_TITLE,
    description: 'Spec-owned flagged/aggregate form.',
    created_by: UID_CHEFE_A,
  })
  const version = await svcInsert<{ id: string }>(request, 'form_versions', {
    form_id: form.id,
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
  specSectionId = section.id

  // 2a. Severity multiple_choice (required): Grave(3,flag) / Moderado(3) / Leve(1).
  const severity = await svcInsert<{ id: string; form_version_id: string }>(
    request,
    'form_items',
    {
      section_id: specSectionId,
      position: 0,
      item_type: 'multiple_choice',
      question_key: 'severidade',
      label: 'Severidade observada?',
      required: true,
    },
  )
  severityItemId = severity.id
  await insertOptions(request, severityItemId, severity.form_version_id, [
    { label: 'Grave', score: 3, flagged: true },
    { label: 'Moderado', score: 3, flagged: false },
    { label: 'Leve', score: 1, flagged: false },
  ])

  // 2b. Temperature number item with flaggedWhen gt 38 (config.flaggedWhen).
  const temp = await svcInsert<{ id: string }>(request, 'form_items', {
    section_id: specSectionId,
    position: 1,
    item_type: 'number',
    question_key: 'temperatura',
    label: 'Temperatura (°C)?',
    required: false,
    config: { flaggedWhen: { op: 'gt', value: 38 } },
  })
  tempItemId = temp.id

  // 3. Publish the form (chefe.ccih).
  const chefeToken = await getToken(request, 'chefe.ccih@test.local')
  const pub = await rpc(request, 'publish_form_version', chefeToken, {
    p_form_version_id: specVersionId,
  })
  expect(pub.ok(), `publish_form_version failed: ${await pub.text()}`).toBeTruthy()

  // 4. Result vocabulary.
  async function createResult(label: string, color: string, adverse: boolean) {
    const r = await rpc(request, 'create_phase_result', chefeToken, {
      p_commission_id: COMM_A,
      p_label: label,
      p_color_token: color,
      p_is_adverse: adverse,
    })
    expect(r.ok(), `create_phase_result(${label}) failed: ${await r.text()}`).toBeTruthy()
    return ((await r.json()) as { id: string }).id
  }
  criticoId = await createResult(R_CRITICO, 'red', true)
  atencaoId = await createResult(R_ATENCAO, 'amber', false)
  normalId = await createResult(R_NORMAL, 'green', false)

  // 5. Template with ONE phase carrying an AGGREGATE ruleset:
  //    Rule 1: __flagged_count__ > 0   → Crítico
  //    Rule 2: __total_score__  >= 3   → Atenção
  //    default                          → Normal
  const template = await svcInsert<{ id: string }>(request, 'process_templates', {
    commission_id: COMM_A,
    title: TEMPLATE_TITLE,
    description: 'Spec-owned aggregate ruleset template.',
    status: 'draft',
    created_by: UID_CHEFE_A,
  })
  templateId = template.id

  const ruleset = {
    rules: [
      { when: { question_key: '__flagged_count__', op: 'gt', value: 0 }, result_id: criticoId },
      { when: { question_key: '__total_score__', op: 'gte', value: 3 }, result_id: atencaoId },
    ],
    default_result_id: normalId,
  }
  const phaseResp = await rpc(request, 'add_template_phase', chefeToken, {
    p_template_id: templateId,
    p_form_id: form.id,
    p_title: 'Fase — Triagem agregada',
    p_recommend_when: null,
    p_default_due_days: null,
    p_blocks: [],
    p_result_ruleset: ruleset,
    p_emits_result: true,
    p_allowed_result_ids: [criticoId, atencaoId, normalId],
  })
  expect(phaseResp.ok(), `add_template_phase failed: ${await phaseResp.text()}`).toBeTruthy()

  const pubT = await rpc(request, 'publish_process_template', chefeToken, {
    p_template_id: templateId,
  })
  expect(pubT.ok(), `publish_process_template failed: ${await pubT.text()}`).toBeTruthy()

  // 6. Three cases, each filled to a DISTINCT aggregate outcome.
  const staff1Token = await getToken(request, 'staff1.ccih@test.local')

  async function createCase(label: string): Promise<string> {
    const r = await rpc(request, 'create_case_from_template', chefeToken, {
      p_template_id: templateId,
      p_label: label,
    })
    expect(r.ok(), `create_case(${label}) failed: ${await r.text()}`).toBeTruthy()
    return ((await r.json()) as { id: string }).id
  }
  async function getPhaseId(caseId: string): Promise<string> {
    const rows = await svcGet<{ id: string }>(
      request,
      `case_phases?case_id=eq.${caseId}&position=eq.1&select=id`,
    )
    expect(rows.length, `phase not found for ${caseId}`).toBeGreaterThan(0)
    return rows[0].id
  }
  async function activate(phaseId: string) {
    const r = await rpc(request, 'activate_phase', chefeToken, {
      p_case_phase_id: phaseId,
      p_assigned_to: UID_STAFF_1,
    })
    expect(r.ok(), `activate_phase failed: ${await r.text()}`).toBeTruthy()
  }
  async function startResp(phaseId: string): Promise<string> {
    const r = await rpc(request, 'start_or_resume_phase', staff1Token, {
      p_case_phase_id: phaseId,
    })
    expect(r.ok(), `start_or_resume_phase failed: ${await r.text()}`).toBeTruthy()
    return ((await r.json()) as { id: string }).id
  }
  async function saveAndSubmit(
    respId: string,
    severityLabel: string,
    temperature: number,
  ) {
    const save = await rpc(request, 'save_section_answers', staff1Token, {
      p_response_id: respId,
      p_section_id: specSectionId,
      // number answer via p_answers (scalar); the choice via p_selections (code).
      p_answers: { [tempItemId]: temperature },
      p_selections: { [severityItemId]: [slug(severityLabel)] },
    })
    expect(save.ok(), `save_section_answers failed: ${await save.text()}`).toBeTruthy()
    const submit = await rpc(request, 'submit_response', staff1Token, {
      p_response_id: respId,
    })
    expect(submit.ok(), `submit_response failed: ${await submit.text()}`).toBeTruthy()
  }

  // Case A — Grave (flagged, score 3) + 39°C (flaggedWhen fires) → flagged_count 2 → Crítico
  caseCritico = await createCase(`Caso ${TAG} — Crítico`)
  const pA = await getPhaseId(caseCritico)
  await activate(pA)
  await saveAndSubmit(await startResp(pA), 'Grave', 39)

  // Case B — Leve (score 1, no flag) + 37°C → flagged 0, score 1 → default Normal
  caseNormal = await createCase(`Caso ${TAG} — Normal`)
  const pB = await getPhaseId(caseNormal)
  await activate(pB)
  await saveAndSubmit(await startResp(pB), 'Leve', 37)

  // Case C — Moderado (score 3, NO flag) + 37°C → flagged 0, score 3 → Atenção.
  // PROVES the integer-score criterion fires INDEPENDENTLY of flagged.
  caseAtencao = await createCase(`Caso ${TAG} — Atenção`)
  const pC = await getPhaseId(caseAtencao)
  await activate(pC)
  await saveAndSubmit(await startResp(pC), 'Moderado', 37)
})

test.afterAll(async () => {
  await purge()
})

// ---------------------------------------------------------------------------
// AC-1: __flagged_count__ rule fires → "Crítico" (flagged option + flaggedWhen)
// ---------------------------------------------------------------------------

test('AC-1: flagged option + flaggedWhen → __flagged_count__ rule → "Crítico"', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${caseCritico}`)

  await expect(
    page
      .getByText(new RegExp(`Resultado:?\\s*${escapeRe(R_CRITICO)}`, 'i'))
      .or(page.getByText(new RegExp(`^${escapeRe(R_CRITICO)}$`)))
      .first(),
  ).toBeVisible({ timeout: 12_000 })

  // DB truth: computed (not manual).
  const rows = await dbPhase(page, caseCritico)
  expect(rows[0]?.result_source).toBe('computed')
  expect(rows[0]?.result_id).toBe(criticoId)
})

// ---------------------------------------------------------------------------
// AC-2: no flags, low score → default "Normal"
// ---------------------------------------------------------------------------

test('AC-2: no flag + score below threshold → default "Normal"', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${caseNormal}`)

  await expect(
    page
      .getByText(new RegExp(`Resultado:?\\s*${escapeRe(R_NORMAL)}`, 'i'))
      .or(page.getByText(new RegExp(`^${escapeRe(R_NORMAL)}$`)))
      .first(),
  ).toBeVisible({ timeout: 12_000 })

  const rows = await dbPhase(page, caseNormal)
  expect(rows[0]?.result_id).toBe(normalId)
})

// ---------------------------------------------------------------------------
// AC-3: integer SCORE criterion still works in parallel (no flags, score>=3 → Atenção)
// ---------------------------------------------------------------------------

test('AC-3: __total_score__ criterion fires independently of flagged → "Atenção"', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${caseAtencao}`)

  await expect(
    page
      .getByText(new RegExp(`Resultado:?\\s*${escapeRe(R_ATENCAO)}`, 'i'))
      .or(page.getByText(new RegExp(`^${escapeRe(R_ATENCAO)}$`)))
      .first(),
  ).toBeVisible({ timeout: 12_000 })

  const rows = await dbPhase(page, caseAtencao)
  expect(rows[0]?.result_id).toBe(atencaoId)
  // Crucially NOT crítico — flagged_count was 0, so only the score rule matched.
  expect(rows[0]?.result_id).not.toBe(criticoId)
})

// ---------------------------------------------------------------------------
// Helpers reading the case phase result from the DB (service role).
// ---------------------------------------------------------------------------

async function dbPhase(
  page: Page,
  caseId: string,
): Promise<{ result_id: string | null; result_source: string | null }[]> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/case_phases?case_id=eq.${caseId}&position=eq.1&select=result_id,result_source`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  return (await resp.json()) as {
    result_id: string | null
    result_source: string | null
  }[]
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

import { test, expect, type Locator, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import { createDraftTemplateDirect } from './helpers/process-templates'

/**
 * ADR 0136 — deferred `staff_admin` sign-off: the coordinator's countersignature
 * is collected AFTER the response freezes and gates the PHASE, not the SUBMIT.
 *
 * ⭐ WHAT THIS SPEC ADDS OVER pgTAP 367. The database contract is proven there (61
 * assertions, 15 neutralizations RED-proved). What only a browser can prove is the
 * part the ADR's Consequences never mention: that the two acts are REACHABLE and
 * DISTINGUISHABLE. Before this change the filler was stuck at "há seções pendentes
 * de assinatura" with no way forward inside the product; after it, the filler
 * submits and the coordinator finishes the phase from the sign-off queue — and the
 * queue now mixes a live draft with a frozen record behind one identical button.
 *
 * Fixture is SPEC-OWNED (its own form + template + case), never the seed's: the
 * seed's staff_admin sign-off section lives on a standalone Farmácia form with no
 * case phase, which is exactly the lane D2 leaves unchanged.
 */

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const ORG_A = 'rede-a'
const SLUG_A = 'ccih'
const COMM_A = 'a0000000-0000-0000-0000-0000000000a1'
const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002'
const UID_STAFF_1 = '00000000-0000-0000-0000-000000000003'

const SPEC_TAG = 'DSS-SPEC'
/**
 * A per-RUN suffix on every name this spec searches by.
 *
 * ⛔ IT IS NOT COSMETIC. This spec's whole subject is a FROZEN record, and a submitted
 * response CANNOT be deleted — `submitted responses are immutable (delete blocked)` is a
 * product trigger, and `responses.case_phase_id -> case_phases` is NO ACTION (measured),
 * so the case and the form behind it cannot be deleted either. This spec therefore
 * OUTLIVES its own run by design, and the old cleanup's premise ("the case cascade takes
 * its phases + responses with it") was false — silently, because it never checked a
 * delete's status. Three forms, four cases and four responses accumulated in one
 * afternoon, and the symptom surfaced two tests away as a strict-mode violation on the
 * sign-off queue: three rows matching one form title, which reads exactly like a product
 * bug. Run-scoping the titles is what makes a leftover harmless instead of confusing.
 * `supabase db reset` remains the only real cleaner.
 */
const RUN_TAG = `R${String(Date.now()).slice(-7)}`
const FORM_TITLE = `Checklist ${SPEC_TAG} ${RUN_TAG}`
const TEMPLATE_TITLE = `Template ${SPEC_TAG} ${RUN_TAG}`
const SIGNOFF_SECTION_TITLE = `Revisão da coordenação ${SPEC_TAG}`
const QUESTION_LABEL = 'A inspeção foi concluída sem intercorrências?'

let specFormId = ''
let specVersionId = ''
let specSectionId = ''
let specItemId = ''
let templateId = ''
let caseId = ''
let phaseId = ''
let responseId = ''

// The KEYBOARD fixture's own case/phase/response (FUP-DSS-KEYBOARD-FLOW-IS-THIN).
// A SECOND frozen record, because the keyboard flow must actually SIGN and the
// first fixture's signature is consumed by the pointer-driven test above it.
let kbPhaseId = ''
let kbResponseId = ''

// The lane-guard test's standalone draft. Module-level ONLY so `afterAll` can still
// remove it if that test dies before its own `finally` runs — unlike the cases, it is
// not covered by the RUN_TAG sweep, because a response carries no title of its own.
let laneStandaloneId = ''

// ---------------------------------------------------------------------------
// Service-role plumbing (a MEASUREMENT/fixture instrument — never the subject:
// it bypasses RLS, so every authorization claim below is made in a real session).
// ---------------------------------------------------------------------------

function svcHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function svcInsert<T>(
  req: APIRequestContext,
  table: string,
  data: Record<string, unknown>,
): Promise<T> {
  const resp = await req.post(`${SUPABASE_URL}/rest/v1/${table}`, {
    headers: svcHeaders({ Prefer: 'return=representation' }),
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
    headers: svcHeaders(),
  })
  expect(resp.ok(), `svcGet(${path}) failed ${resp.status()}`).toBeTruthy()
  return (await resp.json()) as T[]
}

async function getToken(req: APIRequestContext, email: string): Promise<string> {
  const resp = await req.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password: 'Test1234!' },
  })
  expect(resp.ok(), `getToken(${email}) failed: ${resp.status()}`).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

async function rpc(
  req: APIRequestContext,
  fn: string,
  token: string,
  body: Record<string, unknown>,
) {
  return req.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })
}

/**
 * Delete, tolerating exactly TWO refusals — both faces of ONE cause, and nothing else:
 *   `23514` the submitted-immutable trigger refusing the frozen response itself;
 *   `23503` the FK refusing the case / form that frozen response still hangs from
 *           (`responses.case_phase_id` and `case_phases.form_version_id` are NO ACTION).
 * Both are product invariants this spec must not fight, and neither leaves anything a
 * run-scoped selector can trip over. ⛔ Every OTHER failure still fails the run —
 * swallowing all errors is exactly how the previous cleanup leaked for weeks.
 */
async function svcDelete(req: APIRequestContext, path: string): Promise<void> {
  const resp = await req.delete(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: svcHeaders(),
  })
  if (resp.ok()) return
  const body = await resp.text()
  if (body.includes('23514') || body.includes('23503')) return
  expect(false, `svcDelete(${path}) failed ${resp.status()}: ${body}`).toBeTruthy()
}

/**
 * Remove what THIS RUN created, in foreign-key order, best-effort.
 *
 * ⛔ THE ORDER IS LOAD-BEARING and the previous version had it wrong. Measured on the
 * live catalog: `responses.case_phase_id -> case_phases` is **NO ACTION**, as are
 * `responses.form_version_id -> form_versions` and `case_phases.form_version_id ->
 * form_versions` — so "delete the case, the cascade takes its phases and responses with
 * it" is false in both directions, and the old code never checked a delete's status, so
 * it failed silently and leaked every run.
 *
 * ⚠ It is BEST-EFFORT because it must be: a submitted response cannot be deleted at all
 * (see {@link RUN_TAG}). What survives is inert — run-scoped names keep it out of every
 * selector here — and `supabase db reset` clears it.
 */
async function purgeSpecFixtures(req: APIRequestContext): Promise<void> {
  const forms = await svcGet<{ id: string }>(
    req,
    `forms?commission_id=eq.${COMM_A}&title=like.*${RUN_TAG}*&select=id`,
  )

  // 1. responses — they block both the case and the form.
  for (const f of forms) {
    const versions = await svcGet<{ id: string }>(
      req,
      `form_versions?form_id=eq.${f.id}&select=id`,
    )
    for (const v of versions) await svcDelete(req, `responses?form_version_id=eq.${v.id}`)
  }
  // A lane-guard standalone draft, if that test died before its own `finally`.
  if (laneStandaloneId) await svcDelete(req, `responses?id=eq.${laneStandaloneId}`)

  // 2. cases — phases DO cascade from here (measured: confdeltype 'c').
  await svcDelete(req, `cases?commission_id=eq.${COMM_A}&label=like.*${RUN_TAG}*`)

  // 3. templates — nothing references them once the cases are gone. `process_templates`
  //    carries no title column, so they are identified through their versions.
  const tplVersions = await svcGet<{ template_id: string }>(
    req,
    `process_template_versions?title=like.*${RUN_TAG}*&select=template_id`,
  )
  for (const t of new Set(tplVersions.map((v) => v.template_id))) {
    await svcDelete(req, `process_templates?id=eq.${t}`)
  }

  // 4. forms — versions, sections and items cascade from here.
  for (const f of forms) await svcDelete(req, `forms?id=eq.${f.id}`)
}

async function signInAs(page: Page, email: string) {
  await cachedSignIn(page, email, 'Test1234!')
}

/** Read the phase's server-side status — the FACT behind whatever the screen says. */
async function phaseStatus(req: APIRequestContext): Promise<string> {
  return phaseStatusOf(req, phaseId)
}

/** The same read for any phase — the keyboard fixture owns a second one. */
async function phaseStatusOf(req: APIRequestContext, id: string): Promise<string> {
  const rows = await svcGet<{ status: string }>(
    req,
    `case_phases?id=eq.${id}&select=status`,
  )
  expect(rows.length, `phase row ${id} vanished`).toBe(1)
  return rows[0].status
}

/**
 * Build ANOTHER frozen case-phase record on the spec's template: create the case,
 * activate phase 1 onto the plain staff member, fill the one required question and
 * submit. The phase parks in `awaiting_signoff` — a queue row owing a signature.
 *
 * ⚠ FIXTURE PLUMBING, NOT THE SUBJECT: the fill/submit run over the RPCs rather
 * than the wizard, because what the caller is about to test is the SIGNING, and
 * re-driving the browser wizard would make a wizard regression red a keyboard test.
 * The wizard path itself is covered by the first test in this file.
 */
async function freezeNewPhaseResponse(
  req: APIRequestContext,
  tag: string,
): Promise<{ caseId: string; phaseId: string; responseId: string }> {
  const started = await startNewPhaseResponse(req, tag)
  const staffToken = await getToken(req, 'staff1.ccih@test.local')

  // form-model-normalization: a multiple_choice selection goes through
  // `p_selections` as the option CODE, not `p_answers` with the label.
  const save = await rpc(req, 'save_section_answers', staffToken, {
    p_response_id: started.responseId,
    p_section_id: specSectionId,
    p_answers: {},
    p_selections: { [specItemId]: ['sim'] },
  })
  expect(
    save.ok(),
    `freezeNewPhaseResponse(${tag}): save_section_answers failed: ${await save.text()}`,
  ).toBeTruthy()

  const submit = await rpc(req, 'submit_response', staffToken, {
    p_response_id: started.responseId,
  })
  expect(
    submit.ok(),
    `freezeNewPhaseResponse(${tag}): submit_response failed: ${await submit.text()}`,
  ).toBeTruthy()

  return started
}

/**
 * The first half of the above: a case whose phase 1 is ACTIVE and holds a fresh
 * `in_progress` response. Split out because the lane-guard test needs a case-phase
 * response that is still a DRAFT — and needs its OWN, never the shared one.
 */
async function startNewPhaseResponse(
  req: APIRequestContext,
  tag: string,
): Promise<{ caseId: string; phaseId: string; responseId: string }> {
  const chefeToken = await getToken(req, 'chefe.ccih@test.local')
  const staffToken = await getToken(req, 'staff1.ccih@test.local')

  const created = await rpc(req, 'create_case_from_template', chefeToken, {
    p_template_id: templateId,
    p_label: `Caso ${SPEC_TAG} ${RUN_TAG} ${tag}`,
  })
  expect(
    created.ok(),
    `freezeNewPhaseResponse(${tag}): create_case_from_template failed: ${await created.text()}`,
  ).toBeTruthy()
  const newCaseId = ((await created.json()) as { id: string }).id

  const phases = await svcGet<{ id: string }>(
    req,
    `case_phases?case_id=eq.${newCaseId}&position=eq.1&select=id`,
  )
  expect(phases.length, `freezeNewPhaseResponse(${tag}): phase 1 not found`).toBe(1)
  const newPhaseId = phases[0].id

  const activate = await rpc(req, 'activate_phase', chefeToken, {
    p_case_phase_id: newPhaseId,
    p_assigned_to: UID_STAFF_1,
  })
  expect(
    activate.ok(),
    `freezeNewPhaseResponse(${tag}): activate_phase failed: ${await activate.text()}`,
  ).toBeTruthy()

  const start = await rpc(req, 'start_or_resume_phase', staffToken, {
    p_case_phase_id: newPhaseId,
  })
  expect(
    start.ok(),
    `freezeNewPhaseResponse(${tag}): start_or_resume_phase failed: ${await start.text()}`,
  ).toBeTruthy()
  const newResponseId = ((await start.json()) as { id: string }).id

  return { caseId: newCaseId, phaseId: newPhaseId, responseId: newResponseId }
}

/**
 * Walk focus to `target` with real Tab presses and nothing else.
 *
 * ⛔ Deliberately NOT `locator.focus()` — that sets focus programmatically and would
 * pass over a control the Tab order cannot actually reach, which is precisely the
 * defect a keyboard test exists to find (and `.focus()` does not auto-wait either).
 * The bound is generous but finite: an unbounded walk on an unreachable control
 * hangs until the suite timeout, which reads as flake rather than as a finding.
 */
async function tabUntilFocused(
  page: Page,
  target: Locator,
  what: string,
  max = 60,
): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) {
      break
    }
    await page.keyboard.press('Tab')
  }
  await expect(
    target,
    `${what} was never reached after ${max} Tab presses — keyboard-unreachable`,
  ).toBeFocused()
}

// ---------------------------------------------------------------------------

test.beforeAll(async ({ request }) => {
  // Idempotent purge of a previous aborted run — delete by IDENTITY (title/label),
  // never positionally: a positional cleanup eats seed rows.
  await purgeSpecFixtures(request)

  // 1. A spec-owned form: one required question + a staff_admin SIGN-OFF section.
  const formRow = await svcInsert<{ id: string }>(request, 'forms', {
    commission_id: COMM_A,
    title: FORM_TITLE,
    description: 'Formulário próprio da suite deferred-staff-signoff.spec.ts.',
    created_by: UID_CHEFE_A,
  })
  specFormId = formRow.id

  const versionRow = await svcInsert<{ id: string }>(request, 'form_versions', {
    form_id: specFormId,
    version_number: 1,
    status: 'draft',
    created_by: UID_CHEFE_A,
  })
  specVersionId = versionRow.id

  const defaultSection = await svcInsert<{ id: string }>(request, 'form_sections', {
    form_version_id: specVersionId,
    position: 0,
    is_default: true,
    title: null,
  })
  specSectionId = defaultSection.id
  const item = await svcInsert<{ id: string; form_version_id: string }>(
    request,
    'form_items',
    {
      section_id: defaultSection.id,
      position: 0,
      item_type: 'multiple_choice',
      question_key: 'dss_ok',
      label: QUESTION_LABEL,
      required: true,
    },
  )
  specItemId = item.id
  for (const [i, opt] of [['sim', 'Sim'], ['nao', 'Não']].entries()) {
    await svcInsert(request, 'form_item_options', {
      item_id: item.id,
      form_version_id: item.form_version_id,
      position: i,
      code: opt[0],
      label: opt[1],
    })
  }

  // ⭐ THE SUBJECT: a section requiring a `staff_admin` countersignature. Its ONE
  // item is deliberately OPTIONAL — the filler must be able to reach submit with
  // this section untouched, which is the whole point of deferring it.
  const signoffSection = await svcInsert<{ id: string }>(request, 'form_sections', {
    form_version_id: specVersionId,
    position: 1,
    title: SIGNOFF_SECTION_TITLE,
    requires_signoff: true,
    signoff_role: 'staff_admin',
  })
  await svcInsert(request, 'form_items', {
    section_id: signoffSection.id,
    position: 0,
    item_type: 'free_text',
    question_key: 'dss_parecer',
    label: 'Parecer da coordenação',
    required: false,
  })

  const chefeToken = await getToken(request, 'chefe.ccih@test.local')
  // ⚠ The parameter is `p_form_version_id`, verified against `pg_proc` — not
  // `p_version_id`. PostgREST resolves an RPC by its NAMED argument set, so a
  // wrong name is a 404 (`PGRST202`), never a type error.
  const publishForm = await rpc(request, 'publish_form_version', chefeToken, {
    p_form_version_id: specVersionId,
  })
  expect(
    publishForm.ok(),
    `beforeAll: publish_form_version failed: ${await publishForm.text()}`,
  ).toBeTruthy()

  // 2. A one-phase process template over that form.
  const draftTpl = await createDraftTemplateDirect(
    request,
    { baseUrl: SUPABASE_URL, apikey: SUPABASE_SERVICE_KEY, bearerToken: SUPABASE_SERVICE_KEY },
    {
      commissionId: COMM_A,
      title: TEMPLATE_TITLE,
      description: 'Template criado pela suite deferred-staff-signoff.spec.ts.',
      createdBy: UID_CHEFE_A,
    },
  )
  templateId = draftTpl.templateId

  const addPhase = await rpc(request, 'add_template_phase', chefeToken, {
    p_template_version_id: draftTpl.versionId,
    p_form_id: specFormId,
    p_title: `Fase 1 — ${SPEC_TAG}`,
    p_recommend_when: null,
    p_default_due_days: null,
    p_blocks: [],
    p_result_ruleset: null,
  })
  expect(
    addPhase.ok(),
    `beforeAll: add_template_phase failed: ${await addPhase.text()}`,
  ).toBeTruthy()

  const publishTpl = await rpc(request, 'publish_process_template', chefeToken, {
    p_template_id: templateId,
  })
  expect(
    publishTpl.ok(),
    `beforeAll: publish_process_template failed: ${await publishTpl.text()}`,
  ).toBeTruthy()

  // 3. A case, with phase 1 activated and assigned to a PLAIN staff member — the
  //    filler and the signer must be different people, or the round trip this ADR
  //    removes was never there to remove.
  const createCase = await rpc(request, 'create_case_from_template', chefeToken, {
    p_template_id: templateId,
    p_label: `Caso ${SPEC_TAG} ${RUN_TAG}`,
  })
  expect(
    createCase.ok(),
    `beforeAll: create_case_from_template failed: ${await createCase.text()}`,
  ).toBeTruthy()
  caseId = ((await createCase.json()) as { id: string }).id

  const phases = await svcGet<{ id: string }>(
    request,
    `case_phases?case_id=eq.${caseId}&position=eq.1&select=id`,
  )
  expect(phases.length, 'beforeAll: phase 1 not found').toBe(1)
  phaseId = phases[0].id

  const activate = await rpc(request, 'activate_phase', chefeToken, {
    p_case_phase_id: phaseId,
    p_assigned_to: UID_STAFF_1,
  })
  expect(
    activate.ok(),
    `beforeAll: activate_phase failed: ${await activate.text()}`,
  ).toBeTruthy()

  const staffToken = await getToken(request, 'staff1.ccih@test.local')
  const start = await rpc(request, 'start_or_resume_phase', staffToken, {
    p_case_phase_id: phaseId,
  })
  expect(
    start.ok(),
    `beforeAll: start_or_resume_phase failed: ${await start.text()}`,
  ).toBeTruthy()
  responseId = ((await start.json()) as { id: string }).id
})

test.afterAll(async ({ request }) => {
  await purgeSpecFixtures(request)
})

// ---------------------------------------------------------------------------

test.describe.configure({ mode: 'serial' })

test.describe('ADR 0136 — the filler submits without the coordinator', () => {
  /**
   * FUP-DSS-STANDALONE-ROUTE-DISABLES-SUBMIT — WHICH LANE EACH ROUTE SERVES.
   *
   * Nothing structurally kept a CASE-PHASE response off the standalone
   * `/forms/[formId]/responder/[responseId]` route: `getResponseForFill` filters
   * on `id` alone, and that page's own guards (formId · commission · status) are
   * ALL satisfied by a case-phase response — its form IS `formId`, its commission
   * IS the caller's. ADR 0136 made that visible rather than causing it:
   * `deferStaffSignoff` is resolved on the case-phase route only, so the same
   * response rendered here showed a DISABLED submit for a submit `submit_response`
   * would have accepted. One response, two behaviours, chosen by which URL was
   * typed.
   *
   * ⛔ RUNS FIRST, DELIBERATELY. `responseId` is still `in_progress` at this point
   * — the exact state the divergence lived in. Later tests freeze it.
   *
   * ⚠ THREE ASSERTIONS, NOT ONE. "It 404s" is also true of a route that 404s
   * EVERYTHING, and of a response the caller simply cannot read — both would pass a
   * one-sided test with the guard deleted. So the SAME response is walked through
   * its OWN route (twin 1: the response and the session are fine), and a STANDALONE
   * response of the SAME user is walked through the SAME route (twin 2: the route is
   * fine). Only the LANE differs across the three.
   */
  test('the standalone forms route refuses a CASE-PHASE response, and only that', async ({
    page,
    request,
  }) => {
    // ⛔ OWN FIXTURES, CREATED AND DESTROYED INSIDE THIS TEST. Rendering a wizard is
    // not read-only — the wizard persists resume state on navigation — and an earlier
    // draft of this test drove the SHARED response's wizard, which left it resumed at
    // a later section and reddened the submit test two tests down. An `in_progress`
    // case-phase response also joins the sign-off queue as a live draft under the same
    // form title, which would break the queue tests below; hence the `finally`.
    const lane = await startNewPhaseResponse(request, 'LANE')

    // A STANDALONE draft for the SAME user on the SAME version. Inserted directly
    // rather than through `start_or_resume_response`, which would hand back the
    // case-phase draft instead: its resume query filters on (version, creator,
    // in_progress) and — unlike the `responses_one_draft_per_user_idx` index behind it
    // — carries no `case_phase_id is null` conjunct.
    const standalone = await svcInsert<{ id: string }>(request, 'responses', {
      form_version_id: specVersionId,
      commission_id: COMM_A,
      created_by: UID_STAFF_1,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    laneStandaloneId = standalone.id

    try {
      await signInAs(page, 'staff1.ccih@test.local')

      // (1) THE SUBJECT — case-phase response, standalone route: refused.
      // ⚠ Asserted on CONTENT, never on the HTTP status: a streamed `notFound()`
      // is served as 200 by design in this Next version.
      await page.goto(
        `/o/${ORG_A}/c/${SLUG_A}/forms/${specFormId}/responder/${lane.responseId}`,
      )
      await expect(page.getByText(/404|não encontrad/i).first()).toBeVisible()
      await expect(page.getByRole('button', { name: /salvar e sair/i })).toHaveCount(0)

      // (2) TWIN 1 — SAME response, SAME session, its OWN route: renders.
      // Fails if the 404 above came from a broken response or a lost session.
      await page.goto(
        `/o/${ORG_A}/c/${SLUG_A}/cases/${lane.caseId}/phase/${lane.phaseId}` +
          `/responder/${lane.responseId}`,
      )
      await expect(page.getByRole('button', { name: /salvar e sair/i })).toBeVisible()

      // (3) TWIN 2 — SAME user, SAME route, SAME form version, a STANDALONE draft:
      // renders. Fails if the guard were widened into "this route 404s everything".
      // Only the LANE differs between (1) and (3).
      await page.goto(
        `/o/${ORG_A}/c/${SLUG_A}/forms/${specFormId}/responder/${standalone.id}`,
      )
      await expect(page.getByRole('button', { name: /salvar e sair/i })).toBeVisible()
    } finally {
      await request.delete(`${SUPABASE_URL}/rest/v1/responses?id=eq.${standalone.id}`, {
        headers: svcHeaders(),
      })
      laneStandaloneId = ''
      await request.delete(`${SUPABASE_URL}/rest/v1/cases?id=eq.${lane.caseId}`, {
        headers: svcHeaders(),
      })
    }
  })

  test('the wizard reaches submit and the phase PARKS instead of completing', async ({
    page,
    request,
  }) => {
    // PRECONDITION. Without it a green submit below could mean "the section was
    // never required", which is the failure this whole feature would be faking.
    expect(await phaseStatus(request)).toBe('active')

    await signInAs(page, 'staff1.ccih@test.local')
    await page.goto(
      `/o/${ORG_A}/c/${SLUG_A}/cases/${caseId}/phase/${phaseId}/responder/${responseId}`,
    )

    await page.getByRole('radio', { name: 'Sim', exact: true }).first().check()

    // Walk to the review screen. The staff_admin sign-off section is a real step of
    // the wizard, so "Próximo" appears before "Revisar" — labels read from
    // `wizard-nav.tsx`, not guessed.
    for (let i = 0; i < 8; i++) {
      const review = page.getByRole('button', { name: /^Revisar$/ })
      if ((await review.count()) > 0) {
        await review.first().click()
        break
      }
      const next = page.getByRole('button', { name: /^Próximo$/ })
      if ((await next.count()) === 0) break
      await next.first().click()
      await page.waitForTimeout(250)
    }

    await expect(
      page.getByRole('heading', { name: /Revise suas respostas/i }),
    ).toBeVisible({ timeout: 15_000 })

    const submit = page.getByRole('button', { name: /Enviar respostas/i })
    await expect(submit).toBeVisible()
    await submit.click()

    // ⭐ THE ASSERTION. Pre-ADR this raised HC012 ("há seções pendentes de
    // assinatura") and the filler could go no further inside the product.
    await expect(
      page.getByText(/há seções pendentes de assinatura/i),
    ).toHaveCount(0)

    await expect
      .poll(async () => phaseStatus(request), { timeout: 15_000 })
      .toBe('awaiting_signoff')

    // D4: the RESPONSE is plainly submitted — attestation state lives on the PHASE.
    const rows = await svcGet<{ status: string }>(
      request,
      `responses?id=eq.${responseId}&select=status`,
    )
    expect(rows[0].status).toBe('submitted')
  })

  test('the case surface says the phase is awaiting a signature', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(`/o/${ORG_A}/c/${SLUG_A}/manage/cases/${caseId}`)

    await expect(page.getByText('Aguardando assinatura').first()).toBeVisible()
    // The coordinator's one act is offered HERE, not only from another page.
    await expect(page.getByRole('link', { name: 'Assinar' })).toBeVisible()
  })
})

test.describe('ADR 0136 — the coordinator finishes the phase', () => {
  test('the queue distinguishes the FROZEN lane from a live draft', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(`/o/${ORG_A}/c/${SLUG_A}/manage/assinaturas`)

    const row = page.getByRole('listitem').filter({ hasText: FORM_TITLE })
    await expect(row).toBeVisible()

    // ⭐ Same button, materially different act — so the row must say which.
    await expect(row.getByText('Fase de caso · enviada')).toBeVisible()
    await expect(row.getByText('Revisar e concluir')).toBeVisible()

    // …and the seeded LIVE-DRAFT row must NOT carry the chip. A one-sided
    // assertion cannot tell "labels the frozen lane" from "labels everything".
    const draftRows = page
      .getByRole('listitem')
      .filter({ hasText: 'Inspeção de Armazenamento' })
    if ((await draftRows.count()) > 0) {
      await expect(draftRows.first().getByText('Fase de caso · enviada')).toHaveCount(0)
    }
  })

  test('the review screen warns the record is frozen, and signing COMPLETES the phase', async ({
    page,
    request,
  }) => {
    expect(await phaseStatus(request)).toBe('awaiting_signoff')

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(`/o/${ORG_A}/c/${SLUG_A}/manage/assinaturas/${responseId}`)

    // The signer must be told the content is frozen AND what their signature does.
    await expect(page.getByText('Registro já enviado e congelado.')).toBeVisible()
    await expect(page.getByText(/conclui a fase do caso/i)).toBeVisible()

    // The answers must actually be on screen — a signature over a blank screen is
    // an attestation to evidence the signer was never shown (Rule 4).
    await expect(page.getByText(QUESTION_LABEL)).toBeVisible()

    await page.getByRole('button', { name: /Assinar/ }).first().click()

    await expect
      .poll(async () => phaseStatus(request), { timeout: 15_000 })
      .toBe('completed')
  })

  /**
   * FUP-DSS-KEYBOARD-FLOW-IS-THIN — the per-phase keyboard flow (CLAUDE.md §8).
   *
   * ⛔ THE ACT MUST BE THE SIGNATURE, not the arrival. The previous version of this
   * test asserted that the attested row had left the queue and that the first tab
   * stop had an accessible name — an a11y FLOOR, in the place the requirement
   * points at, which reads as the requirement being met. It never signed anything.
   * What this ADR creates is a signature that CONCLUDES a case phase and releases
   * everything downstream of it, so a keyboard trap on THAT control is materially
   * worse than one on a draft.
   *
   * ⚠ SECOND FIXTURE, ON PURPOSE. Signing needs an unsigned frozen record and the
   * pointer-driven test above consumed the only one. Building a second case (rather
   * than converting that test to keyboard) keeps the two failure modes separable:
   * a red here means the KEYBOARD path broke, not that signing broke.
   */
  test('keyboard-only: reach the queue row, open it, and SIGN — no pointer', async ({
    page,
    request,
  }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(`/o/${ORG_A}/c/${SLUG_A}/manage/assinaturas`)

    // Carried over from the thin version, and still worth asserting: the record
    // attested above LEFT the queue. It also guarantees the fixture built next is
    // the ONLY row here, so the tab walk cannot land on a stale one.
    await expect(
      page.getByRole('listitem').filter({ hasText: FORM_TITLE }),
    ).toHaveCount(0)

    // A second frozen record: same template, same form, its own case.
    const kb = await freezeNewPhaseResponse(request, 'KB')
    kbPhaseId = kb.phaseId
    kbResponseId = kb.responseId
    expect(await phaseStatusOf(request, kbPhaseId)).toBe('awaiting_signoff')

    await page.reload()
    const queueRow = page.getByRole('link', { name: new RegExp(FORM_TITLE, 'i') })
    await expect(queueRow).toHaveCount(1)

    // ── KEYBOARD ONLY FROM HERE. No click(), no tap(), no .focus(): every move is
    //    a real Tab/Enter, which is what makes a focus trap or an unreachable
    //    control fail this test instead of being stepped over.
    await tabUntilFocused(page, queueRow, 'the sign-off queue row')
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(new RegExp(`/manage/assinaturas/${kbResponseId}$`))
    // The signer must be looking at the frozen record's own content, reached
    // without a pointer — a signature over a screen nobody could reach by keyboard
    // is the trap this test exists to catch.
    await expect(page.getByText('Registro já enviado e congelado.')).toBeVisible()

    const signButton = page.getByRole('button', { name: /Assinar/ }).first()
    await tabUntilFocused(page, signButton, 'the "Assinar" button')
    await page.keyboard.press('Enter')

    // THE ASSERTION THAT MATTERS: the phase concluded, from a keyboard alone.
    await expect
      .poll(async () => phaseStatusOf(request, kbPhaseId), { timeout: 15_000 })
      .toBe('completed')
  })
})

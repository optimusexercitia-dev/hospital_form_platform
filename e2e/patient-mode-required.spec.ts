import { test, expect, type Page, type APIRequestContext, type Locator } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import { createDraftTemplateDirect } from './helpers/process-templates'
import { pickDate, readHiddenDateValue } from './helpers/date-pickers'
import { SUPABASE_URL, svcHeaders, svcSelect } from './helpers/service-role'

/**
 * `patient_mode = 'required'` (ADR 0137 D1–D3) — the mode the QA batch review
 * (`docs/reviews/adr-0137-batch-review.md` § C-1) found "admitted by the CHECK
 * constraint and written by nothing": zero `.tsx` files referenced it, the
 * builder was an untouched boolean toggle, and the live catalog showed
 * `patient_mode ∈ {none, optional}` — 7,125 pgTAP assertions reached `required`
 * only by direct `INSERT` as `postgres`; the 1,178 E2E assertions never touched
 * it. `frontend` has since built the three-mode picker
 * (`collects-patient-picker.tsx`), the required-marking layer
 * (`patient-fields.tsx`) and the create-dialog gate (`create-case-dialog.tsx`
 * D3 layer 3). This spec is what turns that into gate-enforced coverage.
 *
 * **Fixture isolation (the "fixture trap" — do not publish into the shared CCIH
 * pool).** This spec's template lives in the **Farmácia** commission
 * (`b0000000-0000-0000-0000-0000000000b1`, slug `farmacia`), never CCIH
 * (`COMM_A` in `case-patient.spec.ts`). `e2e/helpers/process-templates.ts`'s
 * `getAnyPublishedTemplateVersion` — the helper an unrelated spec could use to
 * pick up an arbitrary published version — has exactly two call sites in the
 * whole suite (`case-patient.spec.ts:588`, `orphan-administrativo-
 * reachability.spec.ts:325`) and BOTH pass the CCIH commission id explicitly.
 * `publishedVersionLookup`'s first step is `process_templates?commission_id=
 * eq.<id>` — a commission it never queries cannot return a row from it. This is
 * a STRUCTURAL exclusion (the caller never asks Farmácia), not a coincidence of
 * arbitrary ordering or a hopeful title. Every OTHER caller in the suite uses
 * `getPublishedTemplateVersion`, which takes an exact `title` — see that
 * function's own docstring for why an omitted title used to be a silent trap.
 * So even if this spec's fixture stayed in the shared pool, no title-anchored
 * caller could resolve it by accident; the commission boundary is the actual
 * guarantee.
 *
 * **Personas (password Test1234!):** `chefe.farm@test.local` (staff_admin,
 * Comissão de Farmácia e Terapêutica, `00000000-0000-0000-0000-000000000005`).
 *
 * **Seeded fixture reused (read-only):** the published form "Inspeção de
 * Armazenamento de Medicamentos" (Farmácia) — needed to add a phase before the
 * draft template can be published (`HC016`).
 *
 * Every RPC signature, constraint, trigger and error message below was read
 * from the LIVE local catalog (`pg_get_functiondef`, `pg_get_constraintdef`),
 * never from migration text — the CLAUDE.md binding exception. In particular:
 *   - `app.assert_patient_required_fields` raises `HC0T1`, pt-BR, naming only
 *     the fields actually missing, in canonical order (name, mrn,
 *     date_of_birth, sex, encounter_ref, attending).
 *   - `app.patient_required_missing`'s `sex` arm treats `'unknown'` as MISSING
 *     even though it is the column default — the sentinel D2/D3 call out.
 *   - `set_template_patient_mode` WELDS `mrn` into the stored set server-side
 *     too (not merely in the picker), so a UI defect that let a caller strip it
 *     would still be caught by the RPC.
 *   - `guard_case_patient_required_trg` is an `AFTER INSERT DEFERRABLE INITIALLY
 *     DEFERRED` trigger — `create_case_from_template` only runs the EAGER
 *     `assert_patient_required_fields` check when `p_patient IS NOT NULL`; an
 *     entirely OMITTED payload is caught only by this deferred trigger at
 *     commit. AC-R4 below drives both paths separately because they are
 *     genuinely different code.
 *   - `cases.template_version_id` is `ON DELETE RESTRICT` — `afterAll` deletes
 *     any case this spec created BEFORE deleting the template identity, or the
 *     cleanup itself would fail.
 *
 * Serial mode: all tests share one draft-then-published template version.
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY missing — set it in .env.local (Playwright loads it via @next/env).',
  )
}

const ORG = 'rede-a'
const SLUG = 'farmacia'
const COMM_FARM = 'b0000000-0000-0000-0000-0000000000b1' // Comissão de Farmácia e Terapêutica
const UID_CHEFE_FARM = '00000000-0000-0000-0000-000000000005'

/** Canonical order (matches `app.patient_required_missing`'s `unnest ... ord`). */
const REQUIRED_FIELDS = ['name', 'mrn', 'date_of_birth', 'sex'] as const

const PHI_NAME = 'Paciente Obrigatório E2E'
const PHI_MRN = 'MRN-REQ-E2E-0001'

let draftTemplateId: string
let draftVersionId: string
const createdCaseIds: string[] = []
let flagBeforeSpec: boolean

// ---------------------------------------------------------------------------
// Local helpers (mirrors the established per-file pattern — case-patient.spec.ts,
// case-referral-usability-batch.spec.ts — rather than a new shared dependency).
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await cachedSignIn(page, email, password)
}

async function getToken(req: APIRequestContext, email: string): Promise<string> {
  const resp = await req.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password: 'Test1234!' },
  })
  expect(resp.ok(), `getToken(${email}) failed: ${resp.status()}`).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

/**
 * Real DOM `.focus()` — deliberately NOT Playwright's `Locator.focus()`.
 * Verified empirically (against the prod standalone build, the same one the
 * gate runs): Playwright's own `.focus()` reliably moves focus early in a
 * test, but partway through a longer interaction sequence in THIS app it can
 * silently fail to move focus — the same call, on the same element, whose
 * native `HTMLElement.focus()` succeeds every time. `Locator.evaluate()` runs
 * genuine browser code and is not subject to Playwright's own actionability
 * opinions (which — separately verified — also refuse `.focus()`/`.click()`
 * on an `aria-disabled` element even though the real browser does not).
 */
async function focusReal(locator: Locator) {
  await locator.evaluate((el) => (el as HTMLElement).focus())
}

/**
 * Press real Tab keys until `target` is `document.activeElement`, or throw.
 *
 * ⚠ Necessary, not merely stylistic. Verified empirically against the prod
 * standalone build (the same one the gate runs): `persist()` in
 * `collects-patient-picker.tsx` calls `router.refresh()` on every mode/field
 * change, and after that refresh, BOTH Playwright's `Locator.focus()` and a
 * raw `element.focus()` evaluated in-page silently stop moving
 * `document.activeElement` for the rest of the page's life — reading it back
 * (`toBeFocused()`, or comparing `document.activeElement` directly) still
 * works fine; only the WRITE side (`.focus()`) goes inert. Genuine Tab
 * keypresses are unaffected — `document.activeElement` reliably advances
 * through the checkbox fieldset in the correct order even immediately after a
 * refresh. This is a Next.js `router.refresh()` interaction, not a defect in
 * the component under test (a real screen-reader/keyboard user tabbing
 * through the page is not calling `element.focus()` either).
 */
async function tabUntilFocused(page: Page, target: Locator, maxSteps = 80) {
  for (let i = 0; i < maxSteps; i++) {
    await page.keyboard.press('Tab')
    const onTarget = await target.evaluate((el) => document.activeElement === el).catch(() => false)
    if (onTarget) return
  }
  throw new Error(`tabUntilFocused: target never received focus within ${maxSteps} Tab presses`)
}

/**
 * Wait for `persist()`'s async tail (the server action + `router.refresh()`)
 * to fully settle, not just the immediate optimistic client re-render.
 * `router.refresh()` is a SEPARATE, LATER network round-trip after the RPC
 * resolves — a visible fieldset only proves the fast local `setState` landed,
 * not that the slower RSC re-fetch is done. Doing a Tab-walk while that is
 * still in flight is what produced inconsistent Tab counts (6 one run, 38 the
 * next) while probing this. `case-patient.spec.ts` accepts the same shape of
 * wait ("allow the server action") for the same reason.
 */
async function settleAfterPersist(page: Page) {
  await page.waitForTimeout(2_000)
}

/** Call a public RPC under a persona JWT — the canonical server path. */
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

async function getFormIdByTitle(req: APIRequestContext, title: string): Promise<string> {
  const rows = await svcSelect<{ id: string }>(
    req,
    'forms',
    `commission_id=eq.${COMM_FARM}&title=eq.${encodeURIComponent(title)}&select=id&limit=1`,
  )
  expect(rows.length, `form "${title}" not found in Farmácia`).toBeGreaterThan(0)
  return rows[0].id
}

/**
 * `app.feature_flags` is in the `app` schema, which `supabase/config.toml`
 * does NOT expose over PostgREST (only `public`/`graphql_public` are —
 * `orphan-administrativo-reachability.spec.ts`'s header measures this the same
 * way). So flag read/write goes over the SQL channel, mirroring
 * `case-patient.spec.ts`'s `setFeatureFlag`/`captureFeatureFlags` exactly
 * (never `seed.sql`, never a migration — this is a live-DB-only toggle).
 */
async function setFeatureFlag(flagKey: string, enabled: boolean) {
  const { execSync } = await import('child_process')
  execSync(
    `npx supabase db query --local "UPDATE app.feature_flags SET enabled = ${enabled} WHERE key = '${flagKey}'"`,
    { cwd: process.cwd(), stdio: 'pipe' },
  )
}

async function readFeatureFlagLive(flagKey: string): Promise<boolean> {
  const { execSync } = await import('child_process')
  const out = execSync(
    `npx supabase db query --local "SELECT 'FLAGCAP:' || enabled::text AS probe FROM app.feature_flags WHERE key = '${flagKey}'"`,
    { cwd: process.cwd(), stdio: 'pipe' },
  ).toString()
  const m = out.match(/FLAGCAP:(true|false)/)
  if (!m) {
    throw new Error(`readFeatureFlagLive: no app.feature_flags row for '${flagKey}'`)
  }
  return m[1] === 'true'
}

// ---------------------------------------------------------------------------
// Suite setup — a Farmácia-scoped draft template, added phase, mode='none'
// ---------------------------------------------------------------------------

test.beforeAll(async ({ request }) => {
  // `case_patient` is force-set TRUE by baseline (20260620000000_baseline.sql) in
  // every environment; still capture+restore rather than assume, in case another
  // spec file's mid-suite flip (case-patient.spec.ts AC-8a/AC-8b) races this one.
  flagBeforeSpec = await readFeatureFlagLive('case_patient')
  await setFeatureFlag('case_patient', true)

  const tpl = await createDraftTemplateDirect(request, {
    baseUrl: SUPABASE_URL,
    apikey: SUPABASE_SERVICE_KEY,
    bearerToken: SUPABASE_SERVICE_KEY,
  }, {
    commissionId: COMM_FARM,
    title: 'PATIENT-REQUIRED spec fixture — Farmácia (draft)',
    description: 'Draft template for the patient_mode=required E2E coverage (ADR 0137 D1–D3).',
    createdBy: UID_CHEFE_FARM,
  })
  draftTemplateId = tpl.templateId
  draftVersionId = tpl.versionId

  const chefeFarmToken = await getToken(request, 'chefe.farm@test.local')
  const formId = await getFormIdByTitle(request, 'Inspeção de Armazenamento de Medicamentos')
  const addPhaseResp = await rpc(request, 'add_template_phase', chefeFarmToken, {
    p_template_version_id: draftVersionId,
    p_form_id: formId,
    p_title: 'Fase única',
  })
  expect(addPhaseResp.ok(), `add_template_phase failed: ${await addPhaseResp.text()}`).toBeTruthy()
})

test.afterAll(async ({ request }) => {
  // `cases.template_version_id` is ON DELETE RESTRICT — delete created cases
  // FIRST, or the template-identity delete below would hit a live FK error.
  for (const id of createdCaseIds) {
    await request.delete(`${SUPABASE_URL}/rest/v1/cases?id=eq.${id}`, { headers: svcHeaders() })
  }
  // Best-effort, and — verified — it ALWAYS fails once AC-R2 has published the
  // version: a DB trigger refuses `DELETE process_templates` for any identity
  // carrying a published/archived version (23514, "versões publicadas ou
  // arquivadas do processo não podem ser excluídas") — the same one-way-door
  // ADR 0096 D2 the AC-1b comment in `case-patient.spec.ts` already documents,
  // and that spec's own `afterAll` is equally "best-effort" for the same
  // reason (its CCIH fixture template is never actually deleted either — see
  // `getAnyPublishedTemplateVersion`'s docstring: CCIH accumulates published
  // fixtures over the suite's lifetime "routinely"). The leftover row here is
  // harmless by the SAME structural argument as the rest of this file's
  // isolation story: it sits in Farmácia, which no `getAnyPublishedTemplateVersion`
  // caller in the suite ever queries. Kept attempted (not removed) in case a
  // draft-only run (a failed test before AC-R2 publishes) leaves something
  // that CAN still be deleted.
  if (draftTemplateId) {
    await request.delete(`${SUPABASE_URL}/rest/v1/process_templates?id=eq.${draftTemplateId}`, {
      headers: svcHeaders(),
    })
  }
  if (flagBeforeSpec !== undefined) {
    await setFeatureFlag('case_patient', flagBeforeSpec)
  }
})

// ---------------------------------------------------------------------------
// AC-R1 — the welded `mrn` checkbox is INVARIANT under both a click and a
// Space press: `aria-disabled`, never `disabled` (stays focusable, stays in
// the tab order, keeps an accessible name+description). A positive control
// (the "Nome" checkbox, genuinely interactive) proves the click/aria-checked
// detection in this test can actually observe a state change — so the mrn
// assertions below are not vacuously "always pass because nothing moves".
// ---------------------------------------------------------------------------

test('AC-R1: builder — Prontuário (mrn) checkbox is non-interactive to click AND keyboard; stays focusable/perceivable; Nome checkbox (positive control) toggles normally', async ({
  page,
}) => {
  // Each `router.refresh()` (persist()'s tail) resets document.activeElement to
  // BODY, so reaching a checkbox afterward costs a full Tab-walk from the top
  // of the page's tab order (~40 presses) rather than one relative Tab — see
  // `tabUntilFocused`'s docblock. This test does two such walks.
  test.setTimeout(90_000)
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/${ORG}/c/${SLUG}/manage/process-templates/${draftTemplateId}`)

  const section = page.locator('section', { has: page.getByRole('heading', { name: /Identificação do paciente/i }) })
  await expect(section).toBeVisible({ timeout: 10_000 })

  // The mode radios are native `sr-only` inputs (the same pattern
  // `case-events-timeline.tsx`'s kind picker uses) — focus + Space is the
  // proven-working idiom for them in this codebase
  // (`case-referral-usability-batch.spec.ts:431-434`), so it is used here too
  // rather than `.check()`.
  const requiredRadio = section.getByRole('radio', { name: /Obrigatória/i })
  await focusReal(requiredRadio)
  await expect(requiredRadio).toBeFocused()
  await page.keyboard.press('Space')
  await expect(requiredRadio).toBeChecked()

  const fieldsFieldset = section.getByText('Campos obrigatórios na criação')
  await expect(fieldsFieldset).toBeVisible({ timeout: 5_000 })
  await settleAfterPersist(page)

  const nomeCheckbox = section.getByRole('checkbox', { name: /^Nome$/ })
  const mrnCheckbox = section.getByRole('checkbox', { name: /Prontuário/i })

  // ⚠ ORDERING IS LOAD-BEARING, and `.focus()` is AVOIDED past this point.
  // Verified empirically against the prod standalone build (the same one the
  // gate runs): `persist()` calls `router.refresh()` on every change, and once
  // that has fired even once, programmatic `.focus()` (Playwright's or a raw
  // `element.focus()` evaluated in-page) stops moving `document.activeElement`
  // — but genuine Tab keypresses keep working correctly. `tabUntilFocused`
  // (above) is the mechanism used for everything from here on, which is also
  // the more faithful proof: a real keyboard user tabs, they do not call
  // `element.focus()`.

  // --- Reachability: real Tab keypresses land on Nome, then on mrn, in the
  // `PATIENT_REQUIRED_FIELD_ORDER` sequence (welded fields keep their place —
  // `aria-disabled`, never `disabled`). ---
  await tabUntilFocused(page, nomeCheckbox)
  await expect(nomeCheckbox).toHaveAttribute('aria-checked', 'false')

  // --- Positive control: a GENUINELY interactive checkbox in the same
  // fieldset toggles on Space — proves the aria-checked reads below are
  // sensitive to a real state change, not vacuously always-true. ---
  await page.keyboard.press('Space')
  await expect(
    nomeCheckbox,
    'positive control failed to toggle on Space — the checked-state detection itself is broken, so the mrn assertions below would prove nothing',
  ).toHaveAttribute('aria-checked', 'true')
  // Settling (the refresh landing) is itself what resets focus to BODY — so
  // re-find Nome via a fresh Tab-walk before the SECOND Space, rather than
  // assuming the keypress still lands on it.
  await settleAfterPersist(page)
  await tabUntilFocused(page, nomeCheckbox)
  await page.keyboard.press('Space')
  await expect(nomeCheckbox).toHaveAttribute('aria-checked', 'false')
  await settleAfterPersist(page)

  // The Nome toggles above ALSO called `router.refresh()` — re-search rather
  // than assume a fixed Tab count from wherever focus now sits.
  await tabUntilFocused(page, mrnCheckbox)

  await expect(mrnCheckbox).toHaveAttribute('aria-checked', 'true')
  await expect(mrnCheckbox).toHaveAttribute('aria-disabled', 'true')
  // Perceivable, not merely present: a description points at the "always
  // required" note, and the visible "Sempre exigido" badge is in its label.
  await expect(mrnCheckbox).toHaveAttribute('aria-describedby', /.+/)
  await expect(section.getByText('Sempre exigido', { exact: true })).toBeVisible()

  // --- Space (still focused from the Tab above) must NOT change state. ---
  await page.keyboard.press('Space')
  await expect(mrnCheckbox, 'a Space press changed the welded mrn checkbox\'s state').toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(mrnCheckbox).toHaveAttribute('aria-disabled', 'true')

  // --- Click (last — no further focus-dependent assertion follows). Must NOT
  // change state either (the no-op handler + literal `checked` prop).
  // `{ force: true }` bypasses PLAYWRIGHT's own actionability pre-check, which
  // treats `aria-disabled="true"` as "not enabled" and refuses to click at all
  // (verified: without `force`, the click blocks for the full 30s timeout,
  // never reaching the assertion). A REAL mouse user is not stopped this way —
  // the Checkbox's `disabled:` Tailwind variant targets the native `:disabled`
  // pseudo-class, which `aria-disabled` does not trigger, so nothing here is
  // visually greyed out or `pointer-events: none`. Forcing the click is what
  // makes this test faithful to what a sighted mouse user could actually do,
  // and is exactly the scenario D2's "aria-disabled, never disabled" choice
  // has to defend against: the click reaches the button, and the handler is
  // what must no-op it. ---
  await mrnCheckbox.click({ force: true })
  await expect(mrnCheckbox, 'a click changed the welded mrn checkbox\'s state').toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(mrnCheckbox).toHaveAttribute('aria-disabled', 'true')
})

// ---------------------------------------------------------------------------
// AC-R5 (KEYBOARD, §8) — the picker KEEPS the user's place across a persist.
// `FUP-0137-PERSIST-REFRESH-DROPS-FOCUS`.
//
// ⛔ ORDER IS LOAD-BEARING: this runs BEFORE AC-R2, which PUBLISHES the version. The
// picker mounts for DRAFT versions only, so placed after the publish its own
// `<section>` does not exist and the test fails on the fixture rather than on the
// property (measured — that is exactly how the first placement failed).
// ---------------------------------------------------------------------------

test('AC-R5 (keyboard): the picker restores focus after a persist, so a keyboard user keeps their place', async ({
  page,
}) => {
  // ⛔⛔ THE FOLLOW-UP NAMED THE WRONG MECHANISM, AND THE DIFFERENCE IS THE WHOLE
  // TEST. It attributed the lost focus to `persist()` + `router.refresh()`. Measured
  // in Chromium 2026-08-24, on a page isolating the three candidates:
  //   · an ancestor <fieldset> becoming `disabled` while a descendant holds focus
  //     -> document.activeElement === BODY
  //   · sibling churn around a REUSED node (what reconciliation does)  -> unchanged
  //   · the focused node being REPLACED                                 -> BODY
  // So it is the `disabled={isPending}` the transition toggles — which fires the
  // instant `startTransition` runs, BEFORE any refresh — and `router.refresh()` is
  // innocent. `usePendingFocus` parks the focused control and restores it when the
  // write settles.
  //
  // ⚠ THIS TEST IS ALSO THE ANSWER TO `tabUntilFocused`'s docblock, which records
  // that in-page `element.focus()` "silently stops moving document.activeElement for
  // the rest of the page's life" after a refresh. Whatever that observation was, it
  // does NOT prevent the component's own restore from working: the assertion below
  // fails without `usePendingFocus` and passes with it, driven the same way.
  test.setTimeout(150_000)
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/${ORG}/c/${SLUG}/manage/process-templates/${draftTemplateId}`)

  const section = page.locator('section', {
    has: page.getByRole('heading', { name: /Identificação do paciente/i }),
  })
  await expect(section).toBeVisible({ timeout: 10_000 })

  // ⚠ LANDING is `focusReal`, the same idiom AC-R1/AC-R2 use — a Tab walk to the mode
  // radio does not fit inside `tabUntilFocused`'s 80-press budget from a cold page
  // (measured: it threw). That costs this test nothing, because the property under
  // test is what happens AFTER the persist, and every keypress from here on is real.
  const requiredRadio = section.getByRole('radio', { name: /Obrigatória/i })
  const optionalRadio = section.getByRole('radio', { name: /Opcional/i })

  // Space on an ALREADY-CHECKED radio changes nothing and starts no transition, so a
  // test that assumed the starting mode would measure focus across a persist that
  // never happened. AC-R1 leaves the version in `required`, so step down first.
  if (await requiredRadio.isChecked()) {
    await focusReal(optionalRadio)
    await page.keyboard.press('Space')
    await expect(optionalRadio).toBeChecked()
    await settleAfterPersist(page)
  }
  await focusReal(requiredRadio)
  await expect(requiredRadio).toBeFocused()
  await page.keyboard.press('Space')
  await expect(requiredRadio).toBeChecked()
  await settleAfterPersist(page)

  // ⭐ THE ASSERTION. Without the fix `document.activeElement` is `<body>` here and
  // stays there — the coordinator Tabs from the top of the page to reach the next
  // required field, ~40 presses, for every field they tick.
  const active = await page.evaluate(() => document.activeElement?.tagName ?? 'NULL')
  expect(active, 'focus was dropped to <body> by the persist').not.toBe('BODY')
  await expect(requiredRadio).toBeFocused()

  // …and the SAME property on the required-field checkboxes, which live in a SECOND
  // `disabled={isPending}` fieldset. One fieldset passing proves nothing about the
  // other: they are two independent renders of the same mistake.
  const nome = section.getByRole('checkbox', { name: /^Nome$/ })
  await tabUntilFocused(page, nome)
  await page.keyboard.press('Space')
  await settleAfterPersist(page)
  await expect(nome).toBeFocused()
})

// ---------------------------------------------------------------------------
// AC-R2 (KEYBOARD-ONLY, §8) — configure Obrigatória + {Nome, Data de
// nascimento, Sexo} entirely via keyboard (focus + Space, the same idiom
// `case-referral-usability-batch.spec.ts:431-434` already uses for this
// codebase's native-radio composer); persists across a reload; then publishes
// the version (fixture setup for AC-R3/AC-R4 below — not itself the subject).
// ---------------------------------------------------------------------------

test('AC-R2 (keyboard-only): builder sets Obrigatória + {Nome, Data de nascimento, Sexo} via keyboard; persists across reload', async ({
  page, request,
}) => {
  // Six full Tab-walks (one per field checked/verified) at ~40 presses each,
  // plus settle waits — see AC-R1's comment and `tabUntilFocused`'s docblock.
  test.setTimeout(150_000)
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/${ORG}/c/${SLUG}/manage/process-templates/${draftTemplateId}`)

  const section = page.locator('section', { has: page.getByRole('heading', { name: /Identificação do paciente/i }) })
  await expect(section).toBeVisible({ timeout: 10_000 })

  const requiredRadio = section.getByRole('radio', { name: /Obrigatória/i })
  await focusReal(requiredRadio)
  await expect(requiredRadio).toBeFocused()
  await page.keyboard.press('Space')
  await expect(requiredRadio).toBeChecked()
  await settleAfterPersist(page)

  // Idempotent: Tab-to + read + Space-only-if-needed, so this is correct
  // regardless of any leftover state AC-R1 left behind. Real Tab keypresses,
  // never `.focus()` — see `tabUntilFocused`'s docblock for why: every toggle
  // here calls `router.refresh()`, which leaves programmatic `.focus()` inert
  // for the rest of the page's life on this build.
  async function ensureCheckedKeyboard(name: RegExp, want: boolean) {
    const cb = section.getByRole('checkbox', { name })
    await tabUntilFocused(page, cb)
    const current = (await cb.getAttribute('aria-checked')) === 'true'
    if (current !== want) {
      await page.keyboard.press('Space')
      await expect(cb).toHaveAttribute('aria-checked', want ? 'true' : 'false')
      await settleAfterPersist(page)
    } else {
      await expect(cb).toHaveAttribute('aria-checked', want ? 'true' : 'false')
    }
  }

  await ensureCheckedKeyboard(/^Nome$/, true)
  await ensureCheckedKeyboard(/^Data de nascimento$/, true)
  await ensureCheckedKeyboard(/^Sexo$/, true)
  // Deliberately left UNCHECKED — proves the marking is selective, not "every
  // field becomes required once the mode is Obrigatória".
  await ensureCheckedKeyboard(/^Atendimento$/, false)
  await ensureCheckedKeyboard(/Profissional responsável/, false)

  // --- Persistence: reload and re-read from the server, not from local state. ---
  await page.reload()
  const sectionAfter = page.locator('section', { has: page.getByRole('heading', { name: /Identificação do paciente/i }) })
  await expect(sectionAfter).toBeVisible({ timeout: 10_000 })
  await expect(sectionAfter.getByRole('radio', { name: /Obrigatória/i })).toBeChecked()
  await expect(sectionAfter.getByRole('checkbox', { name: /^Nome$/ })).toHaveAttribute('aria-checked', 'true')
  await expect(sectionAfter.getByRole('checkbox', { name: /^Data de nascimento$/ })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(sectionAfter.getByRole('checkbox', { name: /^Sexo$/ })).toHaveAttribute('aria-checked', 'true')
  await expect(sectionAfter.getByRole('checkbox', { name: /^Atendimento$/ })).toHaveAttribute(
    'aria-checked',
    'false',
  )
  await expect(sectionAfter.getByRole('checkbox', { name: /Profissional responsável/ })).toHaveAttribute(
    'aria-checked',
    'false',
  )
  await expect(sectionAfter.getByRole('checkbox', { name: /Prontuário/i })).toHaveAttribute(
    'aria-checked',
    'true',
  )

  // Cross-check against the DB directly (not just what the page re-renders).
  const rows = await svcSelect<{ patient_mode: string; patient_required_fields: string[] }>(
    request,
    'process_template_versions',
    `id=eq.${draftVersionId}&select=patient_mode,patient_required_fields`,
  )
  expect(rows[0]?.patient_mode).toBe('required')
  expect([...rows[0]!.patient_required_fields].sort()).toEqual([...REQUIRED_FIELDS].sort())

  // --- Fixture step (not the subject of this test): publish so AC-R3/AC-R4 can
  // mint cases from a PUBLISHED version — the Novo-caso dialog only offers
  // published versions, and publishing is a one-way door (ADR 0096 D2). ---
  const chefeFarmToken = await getToken(request, 'chefe.farm@test.local')
  const publishResp = await rpc(request, 'publish_process_template', chefeFarmToken, {
    p_template_id: draftTemplateId,
  })
  expect(publishResp.ok(), `publish_process_template failed: ${await publishResp.text()}`).toBeTruthy()

  const publishedRows = await svcSelect<{ status: string }>(
    request,
    'process_template_versions',
    `id=eq.${draftVersionId}&select=status`,
  )
  expect(publishedRows[0]?.status).toBe('published')
})

// ---------------------------------------------------------------------------
// AC-R3 — Novo caso (Farmácia) from the required-mode template: the required
// PHI inputs carry the marker IN THE ACCESSIBLE NAME (not colour alone) plus
// `aria-required`; a required Sexo excludes the `unknown` sentinel; submit is
// blocked until every required field carries a value, naming the outstanding
// ones in pt-BR; completing them creates the case with the exact stored
// mode/fields/PHI.
// ---------------------------------------------------------------------------

test('AC-R3: Novo caso marks required PHI fields (accessible name + aria-required), excludes unknown Sexo, blocks submit until complete, and stores the exact mode/fields/PHI', async ({
  page, request,
}) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/${ORG}/c/${SLUG}/manage/cases`)

  const novoCasoBtn = page.getByRole('button', { name: /novo caso/i })
  await expect(novoCasoBtn).toBeVisible({ timeout: 10_000 })
  await novoCasoBtn.click()

  const dialog = page.getByRole('dialog', { name: /novo caso/i })
    .or(page.getByRole('dialog').filter({ hasText: /novo caso/i }))
  await expect(dialog).toBeVisible({ timeout: 8_000 })

  const templateSelect = dialog.locator('select[name="templateId"]')
  await templateSelect.selectOption({ value: draftTemplateId })

  // The "this process requires patient identification" warning + the legend's
  // "(obrigatória)" suffix (never "(opcional)").
  await expect(
    dialog.getByText(/Este processo exige a identificação do paciente\. Preencha/i),
  ).toBeVisible({ timeout: 8_000 })
  await expect(dialog.getByText('(obrigatória)')).toBeVisible()

  // --- Required marking is IN THE ACCESSIBLE NAME, plus aria-required. ---
  const nameInput = dialog.getByRole('textbox', { name: /^Nome \(obrigatório\)$/ })
  await expect(nameInput).toBeVisible()
  await expect(nameInput).toHaveAttribute('aria-required', 'true')

  const mrnInput = dialog.getByRole('textbox', { name: /^Prontuário \(obrigatório\)$/ })
  await expect(mrnInput).toBeVisible()
  await expect(mrnInput).toHaveAttribute('aria-required', 'true')

  // ⚠ NO trailing `$`, unlike the two textboxes above, and the difference is real
  // rather than sloppy. This control is a DatePicker trigger, whose accessible name
  // now carries its own displayed value after the label ("Data de nascimento
  // (obrigatório) 01/03/2023", or "… Selecionar data" while empty) — the fix for
  // FUP-DATEPICKER-VALUE-ABSENT-FROM-ACCESSIBLE-NAME, without which a screen-reader
  // user could not learn the selected date at all. Anchoring the END would assert
  // the value is ABSENT, i.e. pin the defect.
  // ⛔ The `^…\(obrigatório\)` prefix still carries this assertion's whole point:
  // measured against the real rendered DOM, it matches the required variant and
  // does NOT match the non-required one, so the selectivity this block exists to
  // prove is intact.
  const dobTrigger = dialog.getByRole('button', { name: /^Data de nascimento \(obrigatório\)/ })
  await expect(dobTrigger).toBeVisible()

  const sexSelect = dialog.locator('#create-case-patient-sex')
  await expect(sexSelect).toHaveAttribute('aria-required', 'true')

  // Contrast: a field NOT in the required set carries neither the suffix nor
  // aria-required — the marking is selective, not a blanket "required" flag.
  const attendingInput = dialog.getByRole('textbox', { name: /^Profissional responsável$/ })
  await expect(attendingInput).toBeVisible()
  await expect(attendingInput).not.toHaveAttribute('aria-required', 'true')

  // --- `unknown` Sexo must not be offered as a real answer while required:
  // `app.patient_required_missing` counts it as MISSING, so offering it would
  // present an answer the DB refuses. ---
  const unknownOption = sexSelect.locator('option[value="unknown"]')
  await expect(unknownOption).toHaveText('Selecione…')
  // `toBeDisabled()` does not recognize a plain `<option disabled>` (verified:
  // it reports "enabled" against a real `<option disabled>` element) — assert
  // the DOM property directly instead.
  await expect(await unknownOption.evaluate((el) => (el as HTMLOptionElement).disabled)).toBe(true)
  // The draft's default sex is 'unknown' — before any pick, the select reads
  // as a PROMPT, not an answer.
  await expect(sexSelect).toHaveValue('unknown')

  // --- Submit blocked, naming ALL FOUR outstanding fields in canonical order. ---
  const submitBtn = dialog.getByRole('button', { name: /criar caso/i })
  await expect(submitBtn).toBeDisabled()
  await expect(
    dialog.getByText('Faltam preencher: Nome, Prontuário, Data de nascimento, Sexo.'),
  ).toBeVisible()

  // Fill Nome + Prontuário; the message must narrow to what is STILL missing.
  await nameInput.fill(PHI_NAME)
  await mrnInput.fill(PHI_MRN)
  await expect(submitBtn).toBeDisabled()
  await expect(dialog.getByText('Faltam preencher: Data de nascimento, Sexo.')).toBeVisible()

  await pickDate(dialog, page, { trigger: dobTrigger })
  const dobValue = await readHiddenDateValue(dialog, 'patientDateOfBirth')
  expect(dobValue, 'DatePicker pick did not propagate to the hidden mirror').toMatch(/^\d{4}-\d{2}-\d{2}$/)
  await expect(submitBtn).toBeDisabled()
  await expect(dialog.getByText('Faltam preencher: Sexo.')).toBeVisible()

  await sexSelect.selectOption('female')
  await expect(dialog.getByText(/^Faltam preencher:/)).not.toBeVisible()
  await expect(submitBtn).toBeEnabled()

  // --- Submit; the post-create confirmation (ADR 0134 §A2.4) shows what was typed. ---
  await submitBtn.click()
  await expect(dialog.getByText(/O caso foi criado\. Confira os identificadores/i)).toBeVisible({
    timeout: 10_000,
  })
  await expect(dialog.getByText(PHI_NAME)).toBeVisible()
  await expect(dialog.getByText(PHI_MRN)).toBeVisible()

  await dialog.getByRole('button', { name: /continuar para o caso/i }).click()
  await page.waitForURL(/\/manage\/cases\/[0-9a-f-]{36}/i, { timeout: 10_000 })
  const match = page.url().match(/\/manage\/cases\/([0-9a-f-]{36})/i)
  expect(match, `could not extract caseId from ${page.url()}`).not.toBeNull()
  const caseId = match![1]
  createdCaseIds.push(caseId)

  // --- Stored row: exact mode + fields, never merely "some row exists". ---
  const caseRows = await svcSelect<{
    patient_mode: string
    patient_required_fields: string[]
    commission_id: string
  }>(request, 'cases', `id=eq.${caseId}&select=patient_mode,patient_required_fields,commission_id`)
  expect(caseRows.length).toBe(1)
  expect(caseRows[0]!.patient_mode).toBe('required')
  expect([...caseRows[0]!.patient_required_fields].sort()).toEqual([...REQUIRED_FIELDS].sort())
  expect(caseRows[0]!.commission_id).toBe(COMM_FARM)

  const links = await svcSelect<{ participant_id: string }>(
    request,
    'case_participants',
    `case_id=eq.${caseId}&removed_at=is.null&select=participant_id`,
  )
  expect(links.length, 'no live participant on the created case').toBeGreaterThan(0)
  const ids = links.map((l) => l.participant_id)
  const phiRows = await svcSelect<{
    name: string | null
    mrn: string | null
    date_of_birth: string | null
    sex: string
  }>(request, 'patient_identifiers', `participant_id=in.(${ids.join(',')})&select=name,mrn,date_of_birth,sex`)
  expect(phiRows.length).toBe(1)
  expect(phiRows[0]!.name).toBe(PHI_NAME)
  expect(phiRows[0]!.mrn).toBe(PHI_MRN)
  expect(phiRows[0]!.date_of_birth).toBe(dobValue)
  expect(phiRows[0]!.sex).toBe('female')
})

// ---------------------------------------------------------------------------
// AC-R4 — the canonical server path REFUSES a required-mode case whose patient
// payload is incomplete (eager check inside `create_case_from_template`) OR
// entirely omitted (the deferred `guard_case_patient_required_trg` backstop —
// genuinely different code, driven separately). Both name the missing fields
// in pt-BR (HC0T1) — this is the "bypass the client gate" server-rejection
// equivalent of "remove a required answer in a second tab".
// ---------------------------------------------------------------------------

test('AC-R4: create_case_from_template REFUSES an incomplete or omitted patient payload — HC0T1, naming the missing fields in pt-BR', async ({
  request,
}) => {
  const chefeFarmToken = await getToken(request, 'chefe.farm@test.local')

  const countBefore = (
    await svcSelect<{ id: string }>(
      request,
      'cases',
      `template_version_id=eq.${draftVersionId}&select=id`,
    )
  ).length

  // --- Case A: p_patient SUPPLIED but incomplete (only mrn) — the EAGER check
  // inside the RPC (runs because p_patient IS NOT NULL). ---
  const respA = await rpc(request, 'create_case_from_template', chefeFarmToken, {
    p_template_id: draftTemplateId,
    p_label: `patient-mode-required-negative-probe-A-${Date.now()}`,
    p_patient: { mrn: 'MRN-ONLY-NEGATIVE-PROBE' },
  })
  expect(respA.ok(), 'create_case_from_template must REFUSE an incomplete required payload').toBeFalsy()
  const bodyA = await respA.json()
  expect(JSON.stringify(bodyA)).toContain('HC0T1')
  const messageA = String((bodyA as { message?: string }).message ?? '')
  expect(messageA).toMatch(/preencha/i)
  expect(messageA).toMatch(/nome/i)
  expect(messageA).toMatch(/data de nascimento/i)
  expect(messageA).toMatch(/sexo/i)
  // mrn WAS supplied — the message must not also claim it is missing.
  expect(messageA).not.toMatch(/prontuário/i)

  // --- Case B: p_patient OMITTED entirely — the eager check is skipped
  // (`if p_patient is not null`), so this is caught ONLY by the deferred
  // AFTER-INSERT trigger at commit. Distinct code path from Case A. ---
  const respB = await rpc(request, 'create_case_from_template', chefeFarmToken, {
    p_template_id: draftTemplateId,
    p_label: `patient-mode-required-negative-probe-B-${Date.now()}`,
  })
  expect(
    respB.ok(),
    'create_case_from_template must REFUSE a required-mode case with NO patient payload at all (deferred trigger)',
  ).toBeFalsy()
  const bodyB = await respB.json()
  expect(JSON.stringify(bodyB)).toContain('HC0T1')
  const messageB = String((bodyB as { message?: string }).message ?? '')
  // No patient at all -> ALL FOUR required fields are reported missing.
  expect(messageB).toMatch(/nome/i)
  expect(messageB).toMatch(/prontuário/i)
  expect(messageB).toMatch(/data de nascimento/i)
  expect(messageB).toMatch(/sexo/i)

  // Both refusals rolled back their transaction — no orphan case persisted.
  const countAfter = (
    await svcSelect<{ id: string }>(
      request,
      'cases',
      `template_version_id=eq.${draftVersionId}&select=id`,
    )
  ).length
  expect(countAfter, 'a refused create_case_from_template call still left a case row behind').toBe(
    countBefore,
  )
})

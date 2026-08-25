import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

import { focusByTabbing, serviceQuery, signInAs } from './helpers/documents'
import {
  articleForShortCode,
  auditRowsFor,
  printedDocumentRowsFor,
  SHORT_CODE_RE,
} from './helpers/pdf-printing'

/**
 * PDF·P3 — Printing Cases (ADR 0104 phase 3, decided in ADR 0144 + its four
 * Amendments; plan `docs/plans/case-printing-p3.md` §2.5/§3).
 *
 * Walks the CORRIDORS a user walks. The D14 predicate floor (vector parity,
 * fail-open-standalone, both PHI-door directions, the disposal arm) is pgTAP's
 * — `supabase/tests/368_printed_documents_cases.sql` — and is deliberately NOT
 * restated here.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PRECONDITIONS (none of them are checked by any gate — check them yourself)
 * ═══════════════════════════════════════════════════════════════════════════
 *  - Gotenberg sidecar on :3010 (`docker start gotenberg-pdf`; `/health` = 200).
 *    Its ABSENCE renders as a generic pt-BR error that reads exactly like a
 *    product defect. Check `/health` before believing any print failure here.
 *  - `--workers=1`. Against `next dev` these specs otherwise fail as uniform
 *    30 s `/login` timeouts while `curl` answers the same URL in ~73 ms.
 *  - A seeded local Supabase stack.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * FIXTURES — SPEC-OWNED, never the seed
 * ═══════════════════════════════════════════════════════════════════════════
 * `seed.sql` is a contract ~900 tests depend on, so every case this file mints
 * from is created by `beforeAll` and purged BY IDENTITY (a `PDFCASE-SPEC`
 * label prefix) in `beforeAll` and `afterAll`. Positional cleanup has eaten
 * seed rows in this repo before.
 *
 * ⭐ WHY THE FIXTURES MUST BE BUILT AT ALL, stated so nobody "simplifies" them
 * back to a seed row: the seed's ONLY `completed` case is
 * `d0000000-…-c2`, and it has `has_patient = false`. `get_case_patients` then
 * answers `[]`, and per ADR 0144 Amendment 2 pt 5 the identified path THROWS on
 * both `null` and `[]` — deliberately, so `variant: 'identified'` is provably
 * equivalent to "the identification section was rendered". A PHI-fork test
 * pointed at the seed's completed case would fail for that reason and read as a
 * product defect. There is no seeded completed-with-patient case; this file
 * makes its own.
 *
 * ⚠ ONE seed row IS used, READ-ONLY: `d0000000-…-c1` (CCIH, pending), for the
 * card-absence differential. See that test's own note.
 *
 * ⛔ `dispose_case_phi` is NEVER called from this file. It is irreversible on
 * whatever case it touches. The disposed-case degradation branch is covered at
 * two other levels (pgTAP 368, and a committed `disposed` template
 * fingerprint) and is recorded as a KNOWN E2E BOUND, not as coverage.
 *
 * Personas (password `Test1234!`):
 *   chefe.ccih@test.local   staff_admin CCIH — coordinator: creates, closes,
 *                           mints both variants, revokes, holds the PHI door.
 *   staff1.ccih@test.local  plain staff — given a per-case WRITE grant with
 *                           `read_standard_phi = false`, i.e. a caller who
 *                           passes the print door but NOT the PHI door.
 *   staff3.ccih@test.local  seeded per-case write-grantee on the seed case —
 *                           opens the manage surface, refused by the print door.
 *
 * Run: `npx playwright test e2e/pdf-printing-cases.spec.ts --project=chromium
 * --workers=1` (house recipe, docs/testing/e2e-prod-build-gate.md).
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

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

const COMM_A = 'a0000000-0000-0000-0000-0000000000a1'
const ORG = 'rede-a'
const SLUG = 'ccih'

const manageCaseHref = (caseId: string) => `/o/${ORG}/c/${SLUG}/manage/cases/${caseId}`
const previaHref = (caseId: string, phi?: string) =>
  `/api/previa/case/${caseId}${phi === undefined ? '' : `?phi=${phi}`}`

const UID_STAFF_1 = '00000000-0000-0000-0000-000000000003'

const CHEFE = 'chefe.ccih@test.local'
const STAFF_1 = 'staff1.ccih@test.local'

/**
 * The seeded per-case WRITE-grantee used for the card-absence differential.
 * `staff3.ccih` holds a `case_access_grants` row on `SEED_MASKED_CASE` with
 * `write_case_content = true`, so `canOpenCaseManagement`'s arm 3 opens the
 * manage surface for them — while `app.can_read_full_case_content` refuses.
 */
const DOOR_REFUSED_PERSONA = 'staff3.ccih@test.local'
const SEED_MASKED_CASE = 'd0000000-0000-0000-0000-0000000000c1'

const SPEC_TAG = 'PDFCASE-SPEC'
const LABEL_PREFIX = `Caso ${SPEC_TAG}`

/** The pt-BR copy the panel/dialog/route contracts are keyed on. */
const PANEL_HEADING = 'Documentos emitidos'
const MINT_LABEL = 'Emitir documento'
const PHI_CHOICE_LABEL = 'Incluir identificação do paciente'
const PREVIA_LABEL = 'Imprimir prévia'
const PREVIA_PHI_LABEL = 'Imprimir prévia identificada'
/**
 * The prévia route's SHARED refusal body (BUG-P3-PREVIA-404-COPY, ratified).
 *
 * ⛔ **NOT PHI-SPECIFIC, AND THE ASSERTIONS MUST NOT READ AS THOUGH IT WERE.**
 * All THREE 404 exits of `src/app/api/previa/[kind]/[id]/route.ts` return this
 * one body — bad kind/uuid, provider refusal (which includes an unentitled
 * identified request), and an audit-door refusal. That is deliberate: a
 * distinguishable body would leak the very existence bit the 404 status exists
 * to hide. The test below therefore pins the SHARING as its primary claim, with
 * this literal as a secondary check.
 *
 * ⚠ This literal was copied out of the route file BY SCRIPT, never retyped —
 * two people typing the same accented pt-BR sentence independently is a
 * desynchronised pair waiting to happen, and it would surface as a red in a gate
 * whose baseline is zero failures.
 */
const PREVIA_NOT_FOUND_BODY =
  'Não foi possível gerar a prévia. Verifique se o registro existe e se você tem autorização para a versão solicitada.'
const EMPTY_PANEL_COPY = 'Nenhum documento emitido a partir deste caso ainda.'

// ---------------------------------------------------------------------------
// Fixture state
// ---------------------------------------------------------------------------

/** One spec-owned case per test that mutates registry state — two tests minting
 * the same source would silently supersede each other. */
let caseMintId = ''
let caseForkId = ''
let caseKeyboardId = ''
let caseRevokeId = ''
let caseNoPhiMinterId = ''
let caseNoPatientId = ''
let caseOpenId = ''

// ---------------------------------------------------------------------------
// Scaffolding — mirrors pdf-printing-case-currency.spec.ts's own local shape
// ---------------------------------------------------------------------------

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

/** `create_case` returns `public.cases`; PostgREST renders a composite as an
 * object, but a defensive unwrap keeps this from turning a shape change into a
 * confusing `undefined` id further down. */
async function createSpecCase(
  req: APIRequestContext,
  token: string,
  suffix: string,
  patient: Record<string, unknown> | null,
): Promise<string> {
  const resp = await rpc(req, 'create_case', token, {
    p_commission_id: COMM_A,
    p_label: `${LABEL_PREFIX} — ${suffix}`,
    p_patient_enabled: patient !== null,
    p_patient: patient,
  })
  expect(resp.ok(), `create_case(${suffix}) failed: ${await resp.text()}`).toBeTruthy()
  const body = (await resp.json()) as { id?: string } | Array<{ id?: string }>
  const row = Array.isArray(body) ? body[0] : body
  const id = row?.id
  // ⛔ `expect(row?.id).not.toBeNull()` would PASS on `undefined`. `toMatch`
  // rejects a missing value outright.
  expect(id ?? '', `create_case(${suffix}) returned an id`).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  )
  return id as string
}

async function closeSpecCase(req: APIRequestContext, token: string, caseId: string): Promise<void> {
  const resp = await rpc(req, 'close_case', token, { p_case_id: caseId })
  expect(resp.ok(), `close_case(${caseId}) failed: ${await resp.text()}`).toBeTruthy()
}

/**
 * A per-case WRITE grant WITHOUT `read_standard_phi` — the shape that makes a
 * plain member (a) able to open the manage surface (`canOpenCaseManagement`
 * arm 3), (b) able to pass `app.can_read_full_case_content` on a case with no
 * masked content, and (c) refused by `app.can_read_case_patient`.
 */
async function grantWriteAccessNoPhi(
  req: APIRequestContext,
  token: string,
  caseId: string,
  userId: string,
): Promise<void> {
  const resp = await rpc(req, 'grant_case_access', token, {
    p_case: caseId,
    p_user: userId,
    p_level: 'write',
    p_reason: 'Fixture E2E PDF·P3 — leitor de conteúdo sem porta de PHI.',
    p_read_standard_phi: false,
    p_read_restricted_phi: false,
  })
  expect(resp.ok(), `grant_case_access(${caseId}) failed: ${await resp.text()}`).toBeTruthy()
}

/**
 * Purge every row this file owns, by identity (`LABEL_PREFIX`), children first.
 *
 * `session_replication_role = replica` is what lets this bypass the real
 * BEFORE-DELETE guards on `cases` — and it ALSO disables the internal
 * constraint triggers that implement `ON DELETE CASCADE`, so nothing here may
 * rely on a declared cascade. Every child is deleted by hand.
 *
 * ⛔ A purge that fails silently is WORSE than no purge: it manufactures a
 * belief that state is clean. `-v ON_ERROR_STOP=1` plus BOTH an exit-code and a
 * stderr assertion is what makes a failure loud.
 */
async function purgeLeftoverState(): Promise<void> {
  const { spawnSync } = await import('child_process')

  const CASE_SET = `SELECT id FROM cases WHERE label LIKE '${LABEL_PREFIX}%'`

  const sql = [
    'SET session_replication_role = replica',
    `CREATE TEMP TABLE _spec_cases AS ${CASE_SET}`,
    `CREATE TEMP TABLE _spec_docs AS
       SELECT id FROM documents WHERE home_resource_id IN (SELECT id FROM _spec_cases)`,
    `CREATE TEMP TABLE _spec_participants AS
       SELECT DISTINCT participant_id AS id FROM case_participants
        WHERE case_id IN (SELECT id FROM _spec_cases)`,
    `DELETE FROM printed_documents WHERE source_kind = 'case' AND source_id IN (SELECT id FROM _spec_cases)`,
    `DELETE FROM printed_documents WHERE document_id IN (SELECT id FROM _spec_docs)`,
    `DELETE FROM document_versions WHERE document_id IN (SELECT id FROM _spec_docs)`,
    `DELETE FROM documents WHERE id IN (SELECT id FROM _spec_docs)`,
    `DELETE FROM patient_identifiers WHERE participant_id IN (SELECT id FROM _spec_participants)`,
    `DELETE FROM patient_participants WHERE participant_id IN (SELECT id FROM _spec_participants)`,
    `DELETE FROM case_participants WHERE case_id IN (SELECT id FROM _spec_cases)`,
    `DELETE FROM participants WHERE id IN (SELECT id FROM _spec_participants)`,
    `DELETE FROM case_access_grants WHERE case_id IN (SELECT id FROM _spec_cases)`,
    `DELETE FROM case_events WHERE case_id IN (SELECT id FROM _spec_cases)`,
    `DELETE FROM case_print_revisions WHERE case_id IN (SELECT id FROM _spec_cases)`,
    `DELETE FROM cases WHERE id IN (SELECT id FROM _spec_cases)`,
    'SET session_replication_role = DEFAULT',
  ].join('; ')

  const result = spawnSync(
    'docker',
    [
      'exec',
      'supabase_db_azkbbhskturikxpgmafq',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ],
    { cwd: process.cwd(), stdio: 'pipe', encoding: 'utf8' },
  )

  expect(
    result.status,
    `purgeLeftoverState: psql exited ${result.status} (signal ${result.signal}) — stderr: ${result.stderr}`,
  ).toBe(0)
  expect(
    (result.stderr ?? '').toLowerCase(),
    `purgeLeftoverState: psql wrote to stderr: ${result.stderr}`,
  ).not.toContain('error')
}

/**
 * Drives the "Emitir documento" dialog with an explicit PHI choice.
 *
 * ⚠ The checkbox is unchecked on every open (`useState(false)` + a reset in
 * `onOpenChange`, ADR 0104 D9 "no memory of the choice"), so `includePhi` is
 * applied by CHECKING it, never by toggling from an unknown state — and the
 * default is ASSERTED before the choice is made.
 */
async function mintCaseDocument(
  page: Page,
  opts: { includePhi: boolean },
): Promise<{ shortCode: string; downloadPath: string }> {
  await page.getByRole('button', { name: MINT_LABEL, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  const phiChoice = dialog.getByRole('checkbox', { name: PHI_CHOICE_LABEL })
  // ADR 0104 D9 / ADR 0144 D5: the fork defaults to DE-IDENTIFIED, every time.
  await expect(phiChoice).not.toBeChecked()
  if (opts.includePhi) {
    await phiChoice.check()
    await expect(phiChoice).toBeChecked()
  }

  await dialog.getByRole('button', { name: MINT_LABEL, exact: true }).click()

  const success = page.getByRole('alert')
  await expect(success).toBeVisible({ timeout: 30_000 })
  const shortCode = (await success.getByText(SHORT_CODE_RE).innerText()).trim()

  const downloadLink = dialog.getByRole('link', { name: /baixar pdf/i })
  const downloadPath = (await downloadLink.getAttribute('href'))!
  expect(downloadPath).toMatch(/^\/api\/documents\/[0-9a-f-]{36}$/)

  await dialog.getByText('Fechar', { exact: true }).click()
  await expect(dialog).toBeHidden()

  return { shortCode, downloadPath }
}

/** DB truth for one case's print registry, ordered so assertions are stable. */
async function printRowsForCase(
  page: Page,
  caseId: string,
): Promise<Array<{ template_key: string; status: string; contains_phi: boolean; source_revision: number }>> {
  return serviceQuery<{
    template_key: string
    status: string
    contains_phi: boolean
    source_revision: number
  }>(
    page,
    `printed_documents?source_kind=eq.case&source_id=eq.${caseId}` +
      `&select=template_key,status,contains_phi,source_revision&order=minted_at.asc`,
  )
}

async function assertRealPdf(bytes: Buffer, what: string): Promise<void> {
  expect(bytes.subarray(0, 5).toString('latin1'), `${what}: PDF magic bytes`).toBe('%PDF-')
  expect(bytes.byteLength, `${what}: non-trivial length`).toBeGreaterThan(1000)
}

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

test.beforeAll(async ({ request }) => {
  await purgeLeftoverState()

  const chefe = await getToken(request, CHEFE)

  const patient = (n: number) => ({
    name: `Paciente ${SPEC_TAG} ${n}`,
    mrn: `MRN-${SPEC_TAG}-${n}`,
    date_of_birth: '1971-03-04',
    age_years: 55,
    sex: 'female',
    unit: 'UTI Adulto',
    attending: `Dra. Responsável ${n}`,
  })

  caseMintId = await createSpecCase(request, chefe, 'emissão', patient(1))
  caseForkId = await createSpecCase(request, chefe, 'bifurcação PHI', patient(2))
  caseKeyboardId = await createSpecCase(request, chefe, 'teclado', patient(3))
  caseRevokeId = await createSpecCase(request, chefe, 'anulação', patient(4))
  caseNoPhiMinterId = await createSpecCase(request, chefe, 'sem porta de PHI', patient(5))
  // ⛔ Deliberately WITHOUT a patient: `get_case_patients` answers `[]` for an
  // ENTITLED caller here, which is the OTHER designed throw (see its test).
  caseNoPatientId = await createSpecCase(request, chefe, 'sem paciente', null)
  caseOpenId = await createSpecCase(request, chefe, 'em andamento', patient(6))

  // Six terminal, one deliberately left non-terminal — the prévia corridor.
  for (const id of [
    caseMintId,
    caseForkId,
    caseKeyboardId,
    caseRevokeId,
    caseNoPhiMinterId,
    caseNoPatientId,
  ]) {
    await closeSpecCase(request, chefe, id)
  }

  // The content-reader-without-PHI persona, on the two cases that need them.
  await grantWriteAccessNoPhi(request, chefe, caseNoPhiMinterId, UID_STAFF_1)
  await grantWriteAccessNoPhi(request, chefe, caseOpenId, UID_STAFF_1)
})

test.afterAll(async () => {
  await purgeLeftoverState()
})

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Corridor 1 — a completed case: card -> mint -> list -> download -> verify
// ---------------------------------------------------------------------------

test.describe('PDF·P3 — printing cases', () => {
  test('completed case: the card renders, "Emitir documento" mints, the row lists, the bytes download, /verificar says authentic AND current', async ({
    page,
    browser,
  }) => {
    await signInAs(page, CHEFE)
    const resp = await page.goto(manageCaseHref(caseMintId))
    expect(resp?.status(), 'the manage-detail route renders for the coordinator').toBe(200)

    // Fixture sanity, asserted rather than assumed: the corridor's whole premise
    // is a case that REGISTERS — `status IN ('completed','cancelled') AND
    // phi_disposed_at IS NULL`.
    const [caseRow] = await serviceQuery<{ status: string; phi_disposed_at: string | null }>(
      page,
      `cases?id=eq.${caseMintId}&select=status,phi_disposed_at`,
    )
    expect(caseRow?.status, 'fixture: the case is terminal').toBe('completed')
    expect(caseRow?.phi_disposed_at ?? null, 'fixture: PHI is not disposed').toBeNull()

    // ⚠ Longer timeout on THIS pair only, and it is not a weakened assertion —
    // the claim is identical, only the patience differs. This is the first
    // navigation of the file, so against `next dev` it can land on a cold
    // compile of the manage-detail route: measured once as a `toBeVisible`
    // "element(s) not found" on the very first run after a hot edit, then 5/5
    // green on a quiet tree. The prod-standalone gate builds ahead of time and
    // has no compile-on-demand, so this only ever bit the dev loop.
    await expect(page.getByRole('heading', { name: PANEL_HEADING })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText(EMPTY_PANEL_COPY)).toBeVisible({ timeout: 20_000 })

    // ADR 0125 D1: a REGISTERING source offers the mint and NEVER the prévia.
    // The user does not choose between them.
    await expect(page.getByRole('link', { name: PREVIA_LABEL, exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: PREVIA_PHI_LABEL, exact: true })).toHaveCount(0)

    // The mark the dialog states BEFORE minting must read FINAL on a locked
    // source (ADR 0104 D7 / 0144 D3 — the two arms move in tandem).
    await page.getByRole('button', { name: MINT_LABEL, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('FINAL', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('checkbox', { name: PHI_CHOICE_LABEL })).not.toBeChecked()
    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialog).toBeHidden()

    const { shortCode, downloadPath } = await mintCaseDocument(page, { includePhi: false })
    expect(shortCode).toMatch(SHORT_CODE_RE)

    const article = articleForShortCode(page, shortCode)
    await expect(article.getByText('Ativo', { exact: true })).toBeVisible()

    // DB truth for the registry row — VALUES, not mere rendering.
    const rows = await printRowsForCase(page, caseMintId)
    expect(rows.map((r) => r.template_key)).toEqual(['case'])
    expect(rows[0].status).toBe('active')
    // ⚠ Revision is 0 at close, not 1: entering a terminal state does NOT bump
    // (`trg_bump_case_revision_self` returns early when the case was not
    // ALREADY terminal). This asserts the stored value, not a delta.
    expect(rows[0].source_revision).toBe(0)

    const bytes = Buffer.from(await (await page.request.get(downloadPath)).body())
    await assertRealPdf(bytes, 'the minted case dossier')

    // Logged-out verification: authentic AND current.
    const anonContext = await browser.newContext()
    const anonPage = await anonContext.newPage()
    await anonPage.goto(`/verificar/${shortCode}?via=codigo`)
    await expect(anonPage.getByRole('heading', { name: 'Documento autêntico' })).toBeVisible()
    await expect(
      anonPage.getByText('Esta é a revisão atual do documento.', { exact: true }),
    ).toBeVisible()
    await expect(anonPage.getByRole('heading', { name: 'Documento não reconhecido' })).toHaveCount(0)
    await anonContext.close()
  })

  // -------------------------------------------------------------------------
  // Corridor 2 — the PHI fork, end to end
  // -------------------------------------------------------------------------

  test('PHI fork: both variants mint from ONE case, stay active SIMULTANEOUSLY, and a re-mint supersedes only its own variant', async ({
    page,
  }) => {
    /**
     * ADR 0144 D7 as amended (Amendment 1): the variant carrier is the TEMPLATE
     * KEY, not a variant column — `source_series_id = case_id` for both, and
     * `printed_documents_one_active` is already keyed
     * `(source_kind, source_series_id, template_key)`. So two documents are
     * active on one case at the same time, and each supersedes only its own key.
     *
     * That "simultaneously current" property is the whole reason D7 exists: a
     * shared series would make /verificar report a valid identified dossier as
     * superseded the moment someone printed the de-identified variant for an
     * auditor — a false statement on an UNAUTHENTICATED surface.
     */
    await signInAs(page, CHEFE)
    await page.goto(manageCaseHref(caseForkId))
    await expect(page.getByRole('heading', { name: PANEL_HEADING })).toBeVisible()

    const deid = await mintCaseDocument(page, { includePhi: false })
    const ident = await mintCaseDocument(page, { includePhi: true })
    expect(ident.shortCode).not.toBe(deid.shortCode)

    // The identified mint states its own outcome in the success panel.
    // (Re-read from the DB below; this is the user-visible half.)
    await expect(articleForShortCode(page, deid.shortCode).getByText('Ativo', { exact: true })).toBeVisible()
    await expect(articleForShortCode(page, ident.shortCode).getByText('Ativo', { exact: true })).toBeVisible()

    const afterBoth = await printRowsForCase(page, caseForkId)
    expect(afterBoth.map((r) => r.template_key)).toEqual(['case', 'case_identified'])
    expect(afterBoth.map((r) => r.status)).toEqual(['active', 'active'])
    // ADR 0144 D6 + Amendment 2 pt 4: `contains_phi` is ONE rule covering both
    // variants (masked-class free text present OR any `patient_identifiers`-
    // sourced field rendered). Both variants render age/sex/unit, so BOTH are
    // PHI-tier and both land in `documents-phi`. ⛔ If the de-identified row
    // ever reads `false`, it survives an Art. 18 erasure in Storage — block (f)
    // of `dispose_case_phi` filters on `sensitivity_tier = 'phi'`.
    expect(afterBoth.map((r) => r.contains_phi)).toEqual([true, true])

    // Re-mint the DE-IDENTIFIED variant only. Its predecessor supersedes; the
    // identified one must not move.
    const deid2 = await mintCaseDocument(page, { includePhi: false })
    expect(deid2.shortCode).not.toBe(deid.shortCode)

    await expect(
      articleForShortCode(page, deid.shortCode).getByText('Substituído', { exact: true }),
    ).toBeVisible()
    await expect(
      articleForShortCode(page, ident.shortCode).getByText('Ativo', { exact: true }),
    ).toBeVisible()

    const afterRemint = await printRowsForCase(page, caseForkId)
    expect(afterRemint.length).toBe(3)
    const byKey = (key: string) => afterRemint.filter((r) => r.template_key === key)
    expect(byKey('case').map((r) => r.status)).toEqual(['superseded', 'active'])
    // ⭐ THE ASSERTION THE WHOLE TEST EXISTS FOR: the identified variant is
    // untouched by a de-identified re-mint.
    expect(byKey('case_identified').map((r) => r.status)).toEqual(['active'])
  })

  // -------------------------------------------------------------------------
  // Corridor 3 — a non-terminal case: prévia, never an emission
  // -------------------------------------------------------------------------

  test('non-terminal case: the prévia links replace the mint button, the streamed PDF arrives, and NOTHING is registered', async ({
    page,
  }) => {
    await signInAs(page, CHEFE)
    await page.goto(manageCaseHref(caseOpenId))
    await expect(page.getByRole('heading', { name: PANEL_HEADING })).toBeVisible()

    const [caseRow] = await serviceQuery<{ status: string }>(
      page,
      `cases?id=eq.${caseOpenId}&select=status`,
    )
    expect(
      ['completed', 'cancelled'],
      'fixture: the prévia corridor needs a NON-terminal case',
    ).not.toContain(caseRow?.status)

    // ADR 0125 D1, the other direction: no mint affordance at all.
    await expect(page.getByRole('button', { name: MINT_LABEL, exact: true })).toHaveCount(0)
    const previaLink = page.getByRole('link', { name: PREVIA_LABEL, exact: true })
    await expect(previaLink).toBeVisible()
    expect(await previaLink.getAttribute('href')).toBe(previaHref(caseOpenId))

    // `phiCapable` is what makes the identified prévia link exist — it comes
    // from the provider registry, never from a hardcoded kind.
    const previaPhiLink = page.getByRole('link', { name: PREVIA_PHI_LABEL, exact: true })
    await expect(previaPhiLink).toBeVisible()
    expect(await previaPhiLink.getAttribute('href')).toBe(previaHref(caseOpenId, '1'))

    // Both variants stream real PDF bytes to the coordinator.
    for (const [what, href] of [
      ['de-identified prévia', previaHref(caseOpenId)],
      ['identified prévia', previaHref(caseOpenId, '1')],
    ] as const) {
      const r = await page.request.get(href)
      expect(r.status(), `${what}: status`).toBe(200)
      expect(r.headers()['content-type'], `${what}: content-type`).toContain('application/pdf')
      expect(r.headers()['content-disposition'] ?? '', `${what}: inline, not filed`).toContain(
        'inline',
      )
      expect(r.headers()['cache-control'] ?? '', `${what}: never cached`).toContain('no-store')
      await assertRealPdf(Buffer.from(await r.body()), what)
    }

    // ADR 0125 D3/D9 — no bytes at rest, no registry row, ANY number of times.
    // ⚠ Neutralization-proven 2026-08-25: pointed at `caseMintId` (which HAS a
    // minted row by this point in the serial run) this line goes RED with
    // "Expected 0, Received 1". It is an absence assertion that can fail.
    expect(await printedDocumentRowsFor(page, 'case', caseOpenId)).toEqual([])

    // ...but the prévia DOES leave its own Rule 11 row, and for a case it
    // records WHICH VARIANT — the only registry-side trace an identified prévia
    // leaves, since ADR 0144 D9 gives it no `document.minted` row.
    const previaAudit = await auditRowsFor(page, 'document.previa_printed', 'case', caseOpenId)
    const keys = previaAudit.map((r) => (r.metadata ?? {})['template_key'])
    expect(keys, 'both prévia variants logged, each under its OWN template key').toEqual([
      'case',
      'case_identified',
    ])
  })

  test('a REGISTERING case refuses a prévia (HC0DV) — 404 is the contract, not a defect', async ({
    page,
  }) => {
    /**
     * `log_document_previa` raises HC0DV on a source that registers: "a source
     * that REGISTERS must be EMITTED, never served under a footer that
     * disclaims it" (ADR 0125 D5, the other direction). The route logs BEFORE it
     * streams, so the raise means no bytes leave. Pinned here so a future reader
     * does not file this 404 as a bug.
     *
     * The DIFFERENTIAL is what makes it non-vacuous: the SAME caller, the SAME
     * route, gets 200 on the non-terminal case above and 404 here.
     */
    await signInAs(page, CHEFE)

    const locked = await page.request.get(previaHref(caseMintId))
    expect(locked.status(), 'prévia of a completed case').toBe(404)
    const lockedBody = await locked.text()
    expect(lockedBody).toBe(PREVIA_NOT_FOUND_BODY)

    /**
     * ⭐ THE NO-ORACLE CLAIM, and it is the primary one. A case id that does not
     * exist AT ALL must be **byte-indistinguishable** from a real, locked case
     * this caller can see. If the two bodies ever diverge, the 404 status stops
     * hiding the existence bit it exists to hide — and that divergence is
     * invisible to a test that only checks each body against a constant, because
     * both would still be "a 404 with some pt-BR in it".
     *
     * ⚠ Same session, same route, one nonexistent id and one real one — so the
     * only variable is whether the record exists.
     */
    const absent = await page.request.get(previaHref('00000000-0000-4000-8000-00000000dead'))
    expect(absent.status(), 'prévia of a nonexistent case').toBe(404)
    const absentBody = await absent.text()
    expect(
      absentBody,
      'a nonexistent case and a locked real one must be indistinguishable',
    ).toBe(lockedBody)

    const open = await page.request.get(previaHref(caseOpenId))
    expect(open.status(), 'differential: the same route, a non-terminal case').toBe(200)

    // And the refusal wrote no audit row for the locked case — the door raises
    // before `audit_write`.
    expect(await auditRowsFor(page, 'document.previa_printed', 'case', caseMintId)).toEqual([])
  })

  // -------------------------------------------------------------------------
  // Corridor 4 — `?phi=1` without PHI authority, and the ONE recognised spelling
  // -------------------------------------------------------------------------

  test('?phi=1 without PHI authority is 404, while the same caller gets a de-identified prévia — and ?phi=true is de-identified, not identified', async ({
    page,
  }) => {
    /**
     * ADR 0144 D5's load-bearing sentence: this phase adds ZERO new PHI
     * authorization surface. The gate is the domain's own audited reader —
     * `get_case_patients` answers `null` to an unentitled caller, so
     * `buildCasePayload` throws and the route collapses to 404 (not-found and
     * not-authorized are ONE answer, deliberately: a 403 would confirm the case
     * exists).
     *
     * ⛔ EXACTLY ONE RECOGNISED SPELLING. `?phi=true` / `?phi=yes` / bare `phi`
     * / garbage all yield the DE-IDENTIFIED variant, because the failure
     * direction here is a PHI EXPORT and a typo in a URL must not become a
     * disclosure. Asserted against a caller who is REFUSED for `?phi=1`, so a
     * regression that widened the spelling would flip this from 200 to 404 and
     * be caught rather than being invisible.
     */
    await signInAs(page, STAFF_1)

    // The caller reaches the case at all — otherwise every 404 below would be
    // for the wrong reason.
    const pageResp = await page.goto(manageCaseHref(caseOpenId))
    expect(pageResp?.status(), 'the write-grantee opens the manage surface').toBe(200)
    await expect(page.getByRole('heading', { name: PANEL_HEADING })).toBeVisible()

    const deid = await page.request.get(previaHref(caseOpenId))
    expect(deid.status(), 'de-identified prévia for a content reader').toBe(200)
    await assertRealPdf(Buffer.from(await deid.body()), 'de-identified prévia (no PHI door)')

    const identified = await page.request.get(previaHref(caseOpenId, '1'))
    expect(identified.status(), '?phi=1 without the PHI door').toBe(404)
    expect(await identified.text()).toBe(PREVIA_NOT_FOUND_BODY)

    // The single-spelling contract: an UNRECOGNISED value is de-identified, so
    // this same caller — refused for `?phi=1` — is SERVED here.
    for (const spelling of ['true', 'yes', '0', 'sim']) {
      const r = await page.request.get(previaHref(caseOpenId, spelling))
      expect(r.status(), `?phi=${spelling} must be the DE-IDENTIFIED variant`).toBe(200)
    }

    // Every prévia this caller obtained was logged under the DE-IDENTIFIED key.
    // ⛔ `case_identified` must appear ZERO times for this actor — a
    // request-derived (rather than payload-derived) template key would mislabel
    // exactly here (ADR 0144 Amendment 1's rejected repair).
    const [staff1] = await serviceQuery<{ id: string }>(
      page,
      `profiles?email=eq.${encodeURIComponent(STAFF_1)}&select=id`,
    )
    expect(staff1?.id, 'the persona resolves to a profile').toMatch(/^[0-9a-f-]{36}$/)
    const rows = await auditRowsFor(page, 'document.previa_printed', 'case', caseOpenId)
    const mine = rows.filter((r) => r.actor_id === staff1.id)
    // NON-VACUITY FIRST: this caller really did generate prévias. ⚠ Asserted as
    // a floor, not an equality — the exact number is 5 (one plain + four
    // unrecognised spellings; the `?phi=1` attempt is refused before the log, so
    // it contributes none), but a retry of this serial group replays them and an
    // equality would turn a retried PASS into a spurious RED. The claim that
    // matters is the KEY SET, which a replay cannot change.
    expect(mine.length, 'this caller generated prévias (expected 5 per pass)').toBeGreaterThanOrEqual(5)
    expect(
      [...new Set(mine.map((r) => (r.metadata ?? {})['template_key']))].sort(),
      'every prévia this unentitled caller obtained was logged DE-IDENTIFIED',
    ).toEqual(['case'])

    // DIFFERENTIAL — the 404 is about the CALLER, not about the route: the
    // coordinator gets 200 on the identical URL.
    const chefePage = await page.context().browser()!.newPage()
    await signInAs(chefePage, CHEFE)
    const asChefe = await chefePage.request.get(previaHref(caseOpenId, '1'))
    expect(asChefe.status(), 'the PHI-capable caller gets the identified prévia').toBe(200)
    await chefePage.close()
  })

  // -------------------------------------------------------------------------
  // Corridor 5 — the designed THROW on an identified mint without the PHI door
  // -------------------------------------------------------------------------

  test('a content reader WITHOUT the PHI door: ticking the PHI box is refused in pt-BR and registers nothing; unticked, the same caller mints', async ({
    page,
  }) => {
    /**
     * Two behaviours, both DESIGNED, both easy to "helpfully" break:
     *
     *  1. ADR 0144 Amendment 2 pt 5 — the identified path THROWS on both `null`
     *     and `[]`, so `variant: 'identified'` is PROVABLY equivalent to "the
     *     identification section was rendered". ⛔ A silent downgrade to
     *     de-identified was rejected by name: it would make the committed
     *     `case_identified` fingerprint pin a structure that need not exist.
     *  2. ADR 0144 Amendment 2 pt 2/3 — the de-identified variant IS mintable by
     *     a caller without `read_standard_phi`; it simply renders without
     *     age/sex/unit, WITH NO MARKER (a marker would print the minter's
     *     entitlement onto the page). Refusing it instead would delete the
     *     variant's purpose for the readers it was built for.
     *
     * The known residue this walks over, named rather than papered over: the
     * checkbox is rendered from `phiCapable` (a KIND fact) while the refusal
     * comes from `can_read_case_patient` (a CALLER fact), so the control is
     * offered and refused on submit. That is the current, documented shape.
     */
    await signInAs(page, STAFF_1)
    await page.goto(manageCaseHref(caseNoPhiMinterId))
    await expect(page.getByRole('heading', { name: PANEL_HEADING })).toBeVisible()

    await page.getByRole('button', { name: MINT_LABEL, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('checkbox', { name: PHI_CHOICE_LABEL }).check()
    await dialog.getByRole('button', { name: MINT_LABEL, exact: true }).click()

    /**
     * ⛔ THE DISCRIMINATOR IS "NO SUCCESS PANEL", NOT "SOME MATCHING TEXT".
     *
     * The first draft of this block asserted `getByText(/paciente|identifica/i)`
     * — and a neutralization run (this same test as `chefe.ccih`, who HOLDS the
     * PHI door) exposed it as VACUOUS: that pattern also matches the checkbox's
     * own label and the confidentiality-band hint, both of which are on screen
     * unconditionally. It passed while the mint SUCCEEDED. Assert the exact
     * refusal copy, in the error banner (`FormBanner` → `role="status"`), and
     * pair it with the absence of `MintSuccess` (`role="alert"`).
     */
    const banner = dialog.getByRole('status')
    await expect(banner).toBeVisible({ timeout: 30_000 })
    // ⛔ The refusal is READABLE pt-BR, never a raw driver error (Rule 10).
    // ⚠ WHICH message it is belongs to its own test at the foot of this file —
    // that assertion is currently RED (BUG-P3-PHI-REFUSAL-MESSAGE) and keeping
    // it here would abort this serial file before the corridors below run.
    await expect(banner).toHaveText(/^[^<>{}]{20,}$/)
    await expect(banner).not.toHaveText(/error|exception|PGRST|42501|violates/i)
    // ADR 0144 Amendment 2 pt 5 — REFUSED, never silently downgraded to the
    // de-identified variant. A downgrade would render the success panel here.
    await expect(page.getByRole('alert')).toHaveCount(0)

    // ⛔ NOTHING was registered. Proven non-vacuous by the successful mint two
    // steps below — this same case, this same caller, box unticked, DOES yield
    // a row. Without that half, "no row" would also be what a broken fixture
    // produces.
    expect(await printedDocumentRowsFor(page, 'case', caseNoPhiMinterId)).toEqual([])

    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialog).toBeHidden()

    // The de-identified variant, by the SAME caller: allowed.
    const { shortCode, downloadPath } = await mintCaseDocument(page, { includePhi: false })
    const rows = await printRowsForCase(page, caseNoPhiMinterId)
    expect(rows.map((r) => r.template_key)).toEqual(['case'])
    expect(rows[0].status).toBe('active')

    await expect(articleForShortCode(page, shortCode).getByText('Ativo', { exact: true })).toBeVisible()

    const bytes = Buffer.from(await (await page.request.get(downloadPath)).body())
    await assertRealPdf(bytes, 'de-identified dossier minted without the PHI door')

    // ADR 0104 D11 — revocation is a governance act scoped to the coordinator
    // role, not the minter's undo.
    await expect(
      articleForShortCode(page, shortCode).getByRole('button', { name: /anular/i }),
    ).toHaveCount(0)
  })

  test('the PHI-capable coordinator on a case with NO patient on file: the identified mint is refused in pt-BR, not silently downgraded', async ({
    page,
  }) => {
    /**
     * The SECOND designed throw, and the one most at risk of a "helpful" fix.
     * `get_case_patients` has THREE answers — `null` (unentitled), `[]`
     * (entitled, nothing on file) and rows — and ADR 0144 Amendment 2 pt 5 makes
     * the identified path throw on BOTH `null` and `[]`. That is what makes
     * `variant: 'identified'` PROVABLY equivalent to "the identification section
     * was rendered", which is what the committed `case_identified` fingerprint
     * pins.
     *
     * ⛔ A silent downgrade to de-identified was rejected BY NAME. If someone
     * ever "fixes" this into a downgrade, the mint below would succeed under the
     * `case` key and this test is what says no.
     *
     * The caller here HOLDS the PHI door (coordinator), so this is provably the
     * `[]` arm and not the `null` arm the previous test covers.
     */
    await signInAs(page, CHEFE)

    const [row] = await serviceQuery<{ has_patient: boolean; status: string }>(
      page,
      `cases?id=eq.${caseNoPatientId}&select=has_patient,status`,
    )
    expect(row?.has_patient, 'fixture: no patient on file').toBe(false)
    expect(row?.status, 'fixture: terminal, so it registers').toBe('completed')

    await page.goto(manageCaseHref(caseNoPatientId))
    await page.getByRole('button', { name: MINT_LABEL, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('checkbox', { name: PHI_CHOICE_LABEL }).check()
    await dialog.getByRole('button', { name: MINT_LABEL, exact: true }).click()

    const banner = dialog.getByRole('status')
    await expect(banner).toBeVisible({ timeout: 30_000 })
    await expect(banner).toHaveText(
      'Este caso não possui dados de paciente registrados; emita a versão não identificada.',
    )
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(await printedDocumentRowsFor(page, 'case', caseNoPatientId)).toEqual([])

    // The advice the message gives is TRUE — the de-identified variant works.
    // (Also the non-vacuity control for the empty-registry assertion above.)
    await dialog.getByRole('checkbox', { name: PHI_CHOICE_LABEL }).uncheck()
    await dialog.getByRole('button', { name: MINT_LABEL, exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 30_000 })
    const rows = await printRowsForCase(page, caseNoPatientId)
    expect(rows.map((r) => r.template_key)).toEqual(['case'])
    // ADR 0144 D6 — no patient identifiers rendered AND no masked free text on a
    // bare case, so this is the one shape where `contains_phi` derives FALSE.
    // Recorded as a measurement: it is the only place the de-identified variant
    // is not PHI-tier, and it is exactly the shape Amendment 2 pt 4 warns about
    // if it ever occurred WITH identifiers rendered.
    expect(rows[0].contains_phi).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Corridor 6 — revocation, and /verificar reporting REVOKED (not missing)
  // -------------------------------------------------------------------------

  test('revocation: the row flips to Anulado, the bytes still serve with an overlay, and /verificar reports ANULADO rather than not-found', async ({
    page,
    browser,
  }) => {
    await signInAs(page, CHEFE)
    await page.goto(manageCaseHref(caseRevokeId))
    const { shortCode, downloadPath } = await mintCaseDocument(page, { includePhi: true })

    const beforeBytes = Buffer.from(await (await page.request.get(downloadPath)).body())
    await assertRealPdf(beforeBytes, 'identified dossier before revocation')

    // Positive control for the /verificar assertion below: while active, the
    // public page DOES render a currency verdict. Without this half, its later
    // absence could mean "revoked correctly says nothing" or "nothing ever
    // renders here" — indistinguishable.
    const anonBefore = await browser.newContext()
    const anonBeforePage = await anonBefore.newPage()
    await anonBeforePage.goto(`/verificar/${shortCode}?via=codigo`)
    await expect(anonBeforePage.getByRole('heading', { name: 'Documento autêntico' })).toBeVisible()
    // ⚠ The `[data-currency]` marker means DIFFERENT things on the two surfaces
    // and they must not be conflated: in the panel it is rendered only for a
    // NON-current verdict, so its absence there reads "current"; on /verificar
    // it carries the verdict itself, so an active print HAS one. Measured, not
    // assumed — the first draft of this line asserted the panel's semantics here
    // and went red against correct behaviour.
    await expect(anonBeforePage.locator('[data-currency]')).toHaveCount(1)
    await expect(
      anonBeforePage.getByText('Esta é a revisão atual do documento.', { exact: true }),
    ).toBeVisible()
    await anonBefore.close()

    await page.reload()
    await articleForShortCode(page, shortCode).getByRole('button', { name: 'Anular' }).click()
    const revokeDialog = page.getByRole('dialog')
    await expect(revokeDialog).toBeVisible()
    await revokeDialog.getByLabel('Motivo da anulação').selectOption('minted_in_error')
    await revokeDialog
      .getByLabel('Descrição do motivo')
      .fill('Emissão de teste automatizado — anulação administrativa do dossiê.')
    await revokeDialog.getByRole('button', { name: 'Anular documento' }).click()
    await expect(revokeDialog).toBeHidden()

    await expect(
      articleForShortCode(page, shortCode).getByText('Anulado', { exact: true }),
    ).toBeVisible()

    const [row] = await printRowsForCase(page, caseRevokeId)
    expect(row?.status, 'the registry row is revoked, not deleted').toBe('revoked')
    expect(row?.template_key).toBe('case_identified')

    // The bytes still serve — with the ANULADO stamp, so they must NOT match.
    const afterResp = await page.request.get(downloadPath)
    expect(afterResp.status()).toBe(200)
    const afterBytes = Buffer.from(await afterResp.body())
    await assertRealPdf(afterBytes, 'identified dossier after revocation')
    expect(Buffer.compare(beforeBytes, afterBytes)).not.toBe(0)

    // ⭐ The claim ADR 0144 D10 rests on: /verificar reports a REVOKED document,
    // never a MISSING one. A missing verdict would be a false statement on an
    // unauthenticated surface.
    const anonContext = await browser.newContext()
    const anonPage = await anonContext.newPage()
    await anonPage.goto(`/verificar/${shortCode}?via=codigo`)
    await expect(anonPage.getByRole('heading', { name: 'Documento anulado' })).toBeVisible()
    await expect(anonPage.getByRole('heading', { name: 'Documento não reconhecido' })).toHaveCount(0)
    await expect(anonPage.getByRole('heading', { name: 'Documento autêntico' })).toHaveCount(0)
    await expect(anonPage.locator('[data-currency]')).toHaveCount(0)
    await anonContext.close()
  })

  // -------------------------------------------------------------------------
  // Corridor 7 — keyboard-only (CLAUDE.md §8: one per phase)
  // -------------------------------------------------------------------------

  test('keyboard-only: mint a case dossier and download it without a mouse', async ({ page }) => {
    await signInAs(page, CHEFE)
    await page.goto(manageCaseHref(caseKeyboardId))
    await expect(page.getByRole('heading', { name: PANEL_HEADING })).toBeVisible()

    const trigger = page.getByRole('button', { name: MINT_LABEL, exact: true })
    await focusByTabbing(page, () => trigger.evaluate((el) => el === document.activeElement))
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // The PHI choice must be REACHABLE by keyboard, and reachable is not the
    // same as present: tab to it and toggle it with Space, then untick it again
    // so this test mints the de-identified variant deterministically.
    const phiChoice = dialog.getByRole('checkbox', { name: PHI_CHOICE_LABEL })
    await focusByTabbing(page, () => phiChoice.evaluate((el) => el === document.activeElement), 20)
    await page.keyboard.press('Space')
    await expect(phiChoice).toBeChecked()
    await page.keyboard.press('Space')
    await expect(phiChoice).not.toBeChecked()

    const confirmButton = dialog.getByRole('button', { name: MINT_LABEL, exact: true })
    await focusByTabbing(
      page,
      () => confirmButton.evaluate((el) => el === document.activeElement),
      20,
    )
    await page.keyboard.press('Enter')

    const success = page.getByRole('alert')
    await expect(success).toBeVisible({ timeout: 30_000 })

    const downloadLink = dialog.getByRole('link', { name: /baixar pdf/i })
    await expect
      .poll(() => downloadLink.evaluate((el) => el === document.activeElement))
      .toBe(true)

    const downloadPromise = page.waitForEvent('download')
    await page.keyboard.press('Enter')
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.pdf$/)

    const rows = await printRowsForCase(page, caseKeyboardId)
    expect(rows.map((r) => r.template_key)).toEqual(['case'])
    expect(rows[0].status).toBe('active')
  })

  // -------------------------------------------------------------------------
  // Corridor 8 — the card's ABSENCE for a caller the print door refuses
  // -------------------------------------------------------------------------

  test('door-refused caller: the manage page RENDERS and the "Documentos emitidos" card is absent — no error, no empty panel', async ({
    page,
  }) => {
    /**
     * ⭐ THE ONE NOBODY HAD VERIFIED. `getCasePrintContext` returns `null` on a
     * door refusal (`public.print_source_state` returns NO ROW — "no oracle" —
     * when `app.can_view_printed_document` says no), and the page renders the
     * card only when that context is non-null. So a refused caller must see NO
     * CARD, not an error and not an empty panel.
     *
     * The fixture needs a caller who passes `canOpenCaseManagement`
     * (`staff_admin ∨ isAdministrativo ∨ canWriteContent(case)`) and FAILS
     * `app.can_read_full_case_content`. Measured on the live catalog
     * 2026-08-25, seed case `d0000000-…-c1` has exactly that:
     *
     *   staff3.ccih  case_access_grants: write_case_content = true  → arm 3 opens
     *                the surface; can_read_case = true; can_read_full_case_content
     *                = FALSE.
     *
     * ⭐ AND THE REFUSAL IS ON THE RIGHT AXES. staff3 holds BOTH
     * `read_case_content` AND `read_case_deliberation`, so this is NOT an axis-A
     * (oversight-only) refusal — it is axes C/D/F/G: the seed case carries a
     * phase response, an interview, a meeting link and a referral that this
     * caller is not entitled to. Those are the axes P3 wrote; an axis-A fixture
     * would have passed for the wrong reason.
     *
     * ⛔ READ-ONLY on the seed. This test creates and mutates nothing.
     */

    // Precondition 1 — the grant that opens the surface still exists. Asserted,
    // not assumed: if the seed ever drops it, this test must go RED rather than
    // silently start proving "a caller who cannot reach the page sees no card".
    const [profile] = await serviceQuery<{ id: string }>(
      page,
      `profiles?email=eq.${encodeURIComponent(DOOR_REFUSED_PERSONA)}&select=id`,
    )
    expect(profile?.id ?? '', 'the seeded persona exists').toMatch(/^[0-9a-f-]{36}$/)
    const grants = await serviceQuery<{ write_case_content: boolean; revoked_at: string | null }>(
      page,
      `case_access_grants?case_id=eq.${SEED_MASKED_CASE}&principal_id=eq.${profile.id}` +
        `&select=write_case_content,revoked_at`,
    )
    expect(grants.length, 'the seeded per-case grant is present').toBe(1)
    expect(grants[0].write_case_content, 'the grant is what opens the manage surface').toBe(true)
    expect(grants[0].revoked_at ?? null).toBeNull()

    // Precondition 2 — the case still carries maskable content on at least one
    // of axes C/D/F/G. Without this, the predicate would pass and the test
    // would prove nothing.
    const maskable = await Promise.all([
      serviceQuery<{ id: string }>(page, `case_interviews?case_id=eq.${SEED_MASKED_CASE}&select=id`),
      serviceQuery<{ case_id: string }>(page, `meeting_cases?case_id=eq.${SEED_MASKED_CASE}&select=case_id`),
      serviceQuery<{ id: string }>(page, `case_referral?source_case_id=eq.${SEED_MASKED_CASE}&select=id`),
    ])
    expect(
      maskable.reduce((n, rows) => n + rows.length, 0),
      'the seed case still carries maskable content (axes D/F/G)',
    ).toBeGreaterThan(0)

    // ── The subject ────────────────────────────────────────────────────────
    await signInAs(page, DOOR_REFUSED_PERSONA)
    const resp = await page.goto(manageCaseHref(SEED_MASKED_CASE))

    // The PAGE RENDERED. This is what stops "no card" from meaning "no page":
    // an absence assertion on a 404 would pass for entirely the wrong reason.
    // ⚠ A 200 alone is NOT proof: a streamed `notFound()` below a `loading.tsx`
    // boundary is a 200 by design in this app. The positive render proof is the
    // case's own H1, matched on the case NUMBER read from the DB rather than a
    // hardcoded string, so a renumbered seed reds this instead of silently
    // turning the absence assertions vacuous.
    expect(resp?.status(), 'the write-grantee reaches the manage surface').toBe(200)
    const [seedCase] = await serviceQuery<{ case_number: number }>(
      page,
      `cases?id=eq.${SEED_MASKED_CASE}&select=case_number`,
    )
    expect(seedCase?.case_number ?? -1, 'the seed case has a number').toBeGreaterThan(0)
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toBeVisible()
    await expect(h1).toContainText(String(seedCase.case_number).padStart(4, '0'))

    // ⭐ THE ASSERTION. No card, no empty panel, no error copy — nothing.
    await expect(page.getByRole('heading', { name: PANEL_HEADING })).toHaveCount(0)
    await expect(page.getByText(EMPTY_PANEL_COPY)).toHaveCount(0)
    await expect(page.getByRole('button', { name: MINT_LABEL, exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: PREVIA_LABEL, exact: true })).toHaveCount(0)
    await expect(
      page.getByText(/não foi possível carregar os documentos emitidos/i),
    ).toHaveCount(0)

    // The door refuses the bytes too, not just the surface (Rule 1: the UI is
    // never the boundary).
    const previa = await page.request.get(previaHref(SEED_MASKED_CASE))
    expect(previa.status(), 'the same refusal on the byte-serving path').toBe(404)

    // ── THE DIFFERENTIAL — this is what makes the absence falsifiable ───────
    // The SAME case, the SAME route, a caller the door ADMITS: the card is
    // there. Without this half, a card that never renders for anyone (a broken
    // import, a flag off, a query returning null always) would pass the block
    // above with full marks.
    const admitted = await page.context().browser()!.newPage()
    await signInAs(admitted, CHEFE)
    const admittedResp = await admitted.goto(manageCaseHref(SEED_MASKED_CASE))
    expect(admittedResp?.status()).toBe(200)
    await expect(admitted.getByRole('heading', { name: PANEL_HEADING })).toBeVisible()
    await admitted.close()
  })

  // -------------------------------------------------------------------------
  // FILED DEFECT — kept LAST so a red here does not abort the corridors above
  // -------------------------------------------------------------------------

  test('BUG-P3-PHI-REFUSAL-MESSAGE: an UNENTITLED caller is told the case has no patient data, instead of that they lack authorisation', async ({
    page,
  }) => {
    /**
     * ⛔ EXPECTED RED until the defect is fixed. Filed as
     * BUG-P3-PHI-REFUSAL-MESSAGE / BUG-P3-PATIENT-FIELD-MAPPING (one root cause).
     *
     * `public.get_case_patients` has THREE answers by design and the substrate
     * brief, ADR 0144 Amendment 2 and `pdf-payload.ts`'s own header all depend on
     * telling them apart:
     *     null → unentitled       []   → entitled, none on file      rows → data
     *
     * `src/lib/queries/cases.ts` `getCasePatients` collapses `null` into `[]`
     * (`if (!data) return []`, and its signature is `Promise<CasePatient[]>` —
     * it can never return null), so `pdf-payload.ts`'s
     *     if (rows === null) throw new Error(NO_PATIENT_ACCESS)
     * is UNREACHABLE and every unentitled caller falls through to the `[]`
     * branch. MEASURED, not inferred: `get_case_patients` returns literal `null`
     * over PostgREST for this persona on this case, and the dialog still shows
     * the "no patient data on record" copy.
     *
     * Why it is worth a test rather than a comment: the platform tells a reader
     * who is NOT entitled to the case's patient data that the case HAS NO
     * patient data — a false statement about a record's contents, and a false
     * diagnostic for whoever is asked to fix the access problem.
     */
    await signInAs(page, STAFF_1)

    const [row] = await serviceQuery<{ has_patient: boolean }>(
      page,
      `cases?id=eq.${caseNoPhiMinterId}&select=has_patient`,
    )
    // The premise: this case DOES have patient data, so "none on file" is false.
    expect(row?.has_patient, 'the case genuinely has patient data on file').toBe(true)

    await page.goto(manageCaseHref(caseNoPhiMinterId))
    await page.getByRole('button', { name: MINT_LABEL, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('checkbox', { name: PHI_CHOICE_LABEL }).check()
    await dialog.getByRole('button', { name: MINT_LABEL, exact: true }).click()

    const banner = dialog.getByRole('status')
    await expect(banner).toBeVisible({ timeout: 30_000 })
    await expect(banner).toHaveText(
      'Sem autorização para emitir a versão identificada deste caso.',
    )
  })
})

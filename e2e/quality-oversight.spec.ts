import { execSync } from 'node:child_process'
import { test, expect, type Page, type Locator } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'

/**
 * Quality-Office Oversight, Phase A (ADR 0100) — E2E for the `quality_reviewer`
 * arm: the `/o/[org]/qualidade` console, the read-only viewer branch on the
 * commission case page, D6 lockdown, D8 classification, D9 admin-only toggle,
 * and cross-org isolation.
 *
 * ⚠ THE DISCRIMINATOR IS THE PRINCIPAL'S REACH, NEVER A ROW COUNT (same
 * discipline as `cases-board-access.spec.ts`). Every negative below is paired
 * with a positive control proving the SAME surface genuinely has content for
 * someone who should see it — an unpaired `expect(count).toBe(0)` passes on an
 * empty fixture and proves nothing.
 *
 * Ground truth (live-probed against the branch's fresh `db reset`, 2026-08-07,
 * via `rpc/quality_board_summary` and `rpc/list_cases_board` under
 * `set local role authenticated` + a forged `request.jwt.claims.sub`, and a
 * direct `select` against `public.cases`/`case_phases`/`case_narratives`):
 *
 *   CCIH (Comissão de Controle de Infecção Hospitalar, Hospital Central A,
 *   Rede A) is `quality_oversight = 'visible'`. Every other commission
 *   (Farmácia — same hospital; Ética/Segurança — Hospital Secundário A;
 *   everything in Rede B) stays the `'excluded'` default.
 *
 *   quality.a's `quality_board_summary('rede-a')` returns EXACTLY one row:
 *   CCIH — total_cases=5, open_cases=4, locked_cases=1. Her
 *   `list_cases_board('ccih')` returns EXACTLY case_numbers 1–5; case_number 6
 *   (the seeded `explicit_grants_only` ethics fixture, id
 *   ca000000-0000-0000-0000-0000000000e1, label "Denúncia Ética (fixture
 *   E1)") never appears — D6 lockdown beats the oversight-visible arm.
 *
 *   Case 1 (id d0000000-0000-0000-0000-0000000000c1, "Óbito UTI leito 7",
 *   status `pending`, `patient_enabled = true`) has 2 phases ("Fase 1 —
 *   Coleta inicial" completed, "Fase 2 — Revisão do comitê" pending), 2
 *   narratives with body text containing "leito 7", and one PHI-tier
 *   attachment ("Prescrição digitalizada") — the door a coordinator opens via
 *   the AUDITED `OpenAttachmentButton` ("Baixar Prescrição digitalizada"),
 *   which the M8 bytes-cut closes for the oversight reader specifically
 *   (`canDownload={!isOversight}` suppresses both the direct anchor AND the
 *   audited-door fallback — buildnotes row 17 / case-detail-view.tsx).
 *
 *   Case 2 (id d0000000-0000-0000-0000-0000000000c2, "Óbito UTI leito 3",
 *   status `completed`) is the "Reabrir caso" fixture (only a coordinator on
 *   a COMPLETED case sees that control — testing it on case 1, which is
 *   `pending`, would be vacuous for everyone).
 *
 *   Farmácia (Comissão de Farmácia e Terapêutica, slug `farmacia`, same
 *   hospital as CCIH) has one case, case_number 1, id
 *   dba00000-0000-0000-0000-0000000000b1 — the same-hospital EXCLUDED-
 *   commission denial fixture.
 *
 * ⚠ FINDING, not a bug (reported to the lead in this run's summary, not filed
 * as PROGRESS.md Bug Log row): `QualityCommissionFilter` (the chip row) only
 * mounts when `commissions.length > 1` (`quality-board-view.tsx`), and under
 * the CURRENT seed no persona reviews more than one oversight-visible
 * commission at once — CCIH is the only commission ever `'visible'`, so the
 * chip UI is structurally unreachable by any seeded fixture today. Assertions
 * below verify the commission's identity is legible on the board via the
 * table's Comissão column instead, and the KPI "Comissões" count.
 *
 * Personas (password `Test1234!`):
 *   quality.a@test.local        quality_reviewer, Hospital Central A / Rede A.
 *   quality.a2@test.local       quality_reviewer, Hospital Secundário A (unused
 *                               here — no assertion in this file needs the
 *                               second-hospital scoping fixture).
 *   quality.b@test.local        quality_reviewer, Hospital Central B / Rede B —
 *                               cross-org isolation fixture.
 *   chefe.ccih@test.local       staff_admin / coordinator of CCIH — the
 *                               no-lockout control throughout.
 *   chefe.farm@test.local       staff_admin / coordinator of Farmácia.
 *   hospitaladmin.a1@test.local hospital_admin of Hospital Central A ONLY —
 *                               flips the CCIH toggle.
 *   orgadmin.a@test.local       org_admin of Rede A — the toggle's no-lockout
 *                               control (D9 admits EITHER authority).
 *
 * Reset with `npx supabase db reset --local` before a clean run if the DB
 * looks mutated by a prior session (the counts above hold only against the
 * seeded fixture) — but the toggle test below restores its own mutation, so a
 * repeat run of this file alone does not require one.
 */

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

const ORG = 'rede-a'
const QUALIDADE = `/o/${ORG}/qualidade`
const CCIH = `/o/${ORG}/c/ccih`
const FARMACIA = `/o/${ORG}/c/farmacia`
const COMISSOES = `/o/${ORG}/manage/comissoes`

const CASE_1 = 'd0000000-0000-0000-0000-0000000000c1' // "Óbito UTI leito 7" — open, patient_enabled
const CASE_2_COMPLETED = 'd0000000-0000-0000-0000-0000000000c2' // "Óbito UTI leito 3" — completed
const LOCKED_CASE = 'ca000000-0000-0000-0000-0000000000e1' // case_number 6, explicit_grants_only
const FARMACIA_CASE = 'dba00000-0000-0000-0000-0000000000b1' // case_number 1

// BUG-ACT-NOTFOUND-COPY-1: a RegExp stem, not the pinned old global string —
// ACT ADR 0106 added area-specific not-found siblings with different exact
// copy ("...não encontrada"). Denial verified per call site before widening:
// casos/[id] routes (commission-tier) confirmed live against the QO·B
// CUT_ROUTES sample; the qualidade-layout org-denial call site (line ~634)
// keeps its own detailed live-proven comment explaining why THAT one still
// hits the true global boundary by Next.js App Router design, unaffected.
const NOT_FOUND_GLOBAL = /não encontr/i
const CCIH_SWITCH_NAME =
  'Supervisão da qualidade — Comissão de Controle de Infecção Hospitalar'
const FARMACIA_SWITCH_NAME =
  'Supervisão da qualidade — Comissão de Farmácia e Terapêutica'

/**
 * Read a KPI card's VALUE paragraph by its label text.
 *
 * ⚠ Deliberately walks from the EXACT label text node to its own parent,
 * rather than `region.locator('div').filter({ hasText: label })` (the
 * original shape, which broke silently after `quality-kpi-strip.tsx` grew a
 * wrapping <div> around the grid — commit 7ca0207). Once that wrapper
 * exists, a `hasText`-filtered `div` search matches BOTH the wrapper (every
 * label's text is somewhere in its subtree) AND the specific card, and a
 * chained `.locator('p').nth(1)` over two matched roots does not reliably
 * resolve to the card's own value paragraph. Locating the unique exact-text
 * label first and taking its immediate parent is robust to any number of
 * ancestor wrappers introduced above the card, because it never searches
 * downward through them in the first place.
 */
function kpiValue(region: Locator, label: string): Locator {
  return region
    .getByText(label, { exact: true })
    .locator('xpath=..')
    .locator('p')
    .nth(1)
}

/**
 * The "strip agrees with the board" invariants — used in place of hard-coded
 * KPI totals wherever the full `e2e:prod` gate can contaminate them.
 *
 * ⚠ WHY THIS EXISTS: the gate batches specs on a SHARED, un-reset-between-
 * specs DB within a batch. `process-template-versioning.spec.ts`,
 * `process-template-narrative-slot-crud.spec.ts` and `processless-cases.spec.ts`
 * all create CCIH cases via `create_case_from_template` — a real batch-15 run
 * observed "Casos visíveis" go from the seeded 5 to 15 for exactly this
 * reason. A hard-coded total is a claim about the SEED, not about the page;
 * this file's job is to test the page. Deriving the expectation from the
 * SAME rendered DOM the KPI is summarizing is not just contamination-proof,
 * it is the STRONGER property: it catches a strip that drifts out of sync
 * with its own table, which a magic number never could.
 *
 * NOT converted (kept as hard values, and why):
 *   - `Comissões` in the single-commission test — never case-count-derived;
 *     the earlier `toHaveCount(0)` check on the chip row already establishes
 *     there is exactly one commission in scope.
 *   - `Casos restritos` (D6's locked count) — verified (not assumed) that
 *     none of batch 15's case-creating siblings
 *     (process-template-narrative-slot-crud / process-template-versioning /
 *     processless-cases, plus phase8-dashboard / phi-remediation /
 *     platform-org-admin-provisioning) reference `visibility_policy` or a
 *     `case_type_id` at all (grepped 2026-08-07), so every case they create
 *     takes the platform default (`commission_default`), never
 *     `explicit_grants_only`. This value stays hard-coded, but the
 *     verification is what makes that safe, not an assumption.
 *   - Every REACH assertion (cases 1–5 present, Caso 0006 invisible,
 *     Farmácia absent, a chip selection hiding the sibling's cases) —
 *     contamination ADDS rows with NEW, higher case numbers; it does not
 *     remove existing ones or reveal a locked one. These were never the
 *     problem and stay exactly as authored.
 */

/** Every case-number link currently rendered on the board (each row has
 * exactly one), scoped to the table to avoid matching anything else on the
 * page. `\d+`, not a fixed 4 digits — `formatCaseNumber` zero-pads to a
 * FLOOR of 4, so a contamination-heavy run can mint a 5-digit case number. */
function renderedCaseLinks(page: Page): Locator {
  return page.getByRole('table').getByRole('link', { name: /^Caso \d+$/ })
}

/** The DB's own definition of "open" (`quality_board_summary`: `status not
 * in ('completed','cancelled')`, mirrored client-side by
 * `isTerminalCaseStatus`) applied to whatever is actually rendered: total
 * rows minus the two terminal-status badge texts ("Concluído"/"Cancelado" —
 * `CASE_STATUS_META`), not a recount of what the seed was expected to hold. */
async function renderedOpenCaseCount(page: Page): Promise<number> {
  const table = page.getByRole('table')
  const [total, concluded, cancelled] = await Promise.all([
    renderedCaseLinks(page).count(),
    table.getByText('Concluído', { exact: true }).count(),
    table.getByText('Cancelado', { exact: true }).count(),
  ])
  return total - concluded - cancelled
}

async function signIn(page: Page, email: string) {
  await cachedSignIn(page, email)
}

// ---------------------------------------------------------------------------
// DB-truth confirmation — mirrors the sqlOne/psql pattern already used
// elsewhere in e2e/ (e.g. e2e/helpers/accreditation.ts, per its own header
// note, itself mirroring ff5-references.spec.ts — this project's convention
// is a local copy per file/helper rather than one shared cross-domain
// import). Out-of-process (a synchronous `docker exec … psql`, no browser
// involved), which is why it can replace a page.reload() confirmation
// entirely rather than merely supplement it: it is strictly STRONGER
// evidence that a mutation landed — it observes the row itself, not a
// rendering of it — and it costs a single fast query instead of a full page
// load. Used ONLY to confirm plumbing ("did the write land before moving
// on"), never for the behavior actually under test (the reviewer's board
// reacting, which stays a real UI read).
const DB_CONTAINER = 'supabase_db_azkbbhskturikxpgmafq'

function sqlOne(query: string): string {
  const out = execSync(
    `docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -tA`,
    { input: query, encoding: 'utf8' },
  )
    .toString()
    .trim()
  const rows = out === '' ? [] : out.split(/\r?\n/)
  expect(rows.length, `expected exactly one row from: ${query}`).toBe(1)
  return rows[0]
}

function oversightOf(slug: 'ccih' | 'farmacia'): string {
  return sqlOne(
    `select quality_oversight from public.commissions where slug = '${slug}';`,
  )
}

const COMMISSION_ID: Record<'ccih' | 'farmacia', string> = {
  ccih: 'a0000000-0000-0000-0000-0000000000a1',
  farmacia: 'b0000000-0000-0000-0000-0000000000b1',
}
const HOSPITALADMIN_A1_UID = '00000000-0000-0000-0000-0000000000e1'

/**
 * Set a commission's oversight classification DIRECTLY through the real
 * door (`public.set_commission_oversight`), out-of-process, as
 * hospitaladmin.a1 — never a raw UPDATE (the guard trigger blocks that
 * outside the RPC's own GUC bracket anyway, mirroring `seed.sql`'s own
 * `app.in_commission_rpc` usage). Used to ESTABLISH a precondition for a
 * READ-path test without first driving an admin through the UI: the write
 * path is proven end-to-end by its own sibling test (keyboard flip → real
 * DB change), so a read-path test only needs the precondition to already be
 * true, not to re-derive it live. This is what lets the read-path tests
 * sign in as exactly one principal (lead ruling 2026-08-07, after three
 * rounds of UI-based confirmation pushed the combined admin+reviewer test
 * over its timeout budget — an admin in one session and a reviewer in
 * another are two different people at two different desks; nothing about
 * the product requires them to share a browser context).
 */
function setOversightViaDoor(
  slug: 'ccih' | 'farmacia',
  value: 'visible' | 'excluded',
): void {
  execSync(
    `docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -tA`,
    {
      input: `
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"${HOSPITALADMIN_A1_UID}","role":"authenticated","active_role":"hospital_admin"}', true);
select public.set_commission_oversight('${COMMISSION_ID[slug]}', '${value}');
commit;
`,
      encoding: 'utf8',
    },
  )
}

// ---------------------------------------------------------------------------
// 1. Root landing (FUP-QO-2) — load-bearing: three principals of this shape
//    (hospital-tier membership, commission_id NULL) have previously landed on
//    "Você ainda não tem acesso" because every branch of the root router
//    stepped over them (Diretor Técnico, hospital_admin, and now the reviewer
//    would have been the third).
// ---------------------------------------------------------------------------

test.describe('QO·A — root landing', () => {
  test('quality.a signing in LANDS on the qualidade console, not "Você ainda não tem acesso"', async ({
    page,
  }) => {
    await signIn(page, 'quality.a@test.local')
    await expect(page).toHaveURL(new RegExp(`${QUALIDADE}$`), {
      timeout: 15_000,
    })
    await expect(
      page.getByRole('heading', { name: 'Você ainda não tem acesso' }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('heading', { name: 'Casos sob supervisão' }),
    ).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// 2. Board renders — specific seeded case numbers, exact KPI values, and the
//    locked case's number/label appearing NOWHERE on the page.
// ---------------------------------------------------------------------------

test.describe('QO·A — oversight board', () => {
  test('quality.a: exactly 5 readable CCIH cases + exact KPI values; Caso 0006 (locked) is invisible', async ({
    page,
  }) => {
    await signIn(page, 'quality.a@test.local')
    await page.goto(QUALIDADE)
    await expect(
      page.getByRole('heading', { name: 'Casos sob supervisão' }),
    ).toBeVisible({ timeout: 10_000 })

    // The region's accessible name comes from its own visible <h2> via
    // aria-labelledby (commit 7ca0207) — matching that heading, not an
    // aria-label string that could drift from what's on screen.
    const kpi = page.getByRole('region', { name: 'Visão geral' })
    await expect(kpi).toBeVisible()
    await expect(kpiValue(kpi, 'Comissões')).toHaveText('1')

    // "Casos visíveis"/"Em aberto" — asserted against what's ACTUALLY
    // rendered (the "strip agrees with the board" invariant, see the
    // helpers' doc comment), not the seeded 5/4. The full gate batches
    // specs on a shared DB; sibling specs in the same batch
    // (process-template-*, processless-cases) mint additional CCIH cases
    // before this test runs, and a hard-coded total reds on the row count
    // moving for a reason that has nothing to do with this feature.
    const totalRendered = await renderedCaseLinks(page).count()
    const openRendered = await renderedOpenCaseCount(page)
    await expect(kpiValue(kpi, 'Casos visíveis')).toHaveText(
      String(totalRendered),
    )
    await expect(kpiValue(kpi, 'Em aberto')).toHaveText(String(openRendered))
    // A FLOOR, not just an invariant: the seeded 5 must still be present so
    // this cannot pass vacuously if the reviewer regressed to reading ZERO
    // cases (0 rendered === "0" KPI is internally consistent but wrong).
    expect(totalRendered).toBeGreaterThanOrEqual(5)

    await expect(kpiValue(kpi, 'Casos restritos')).toHaveText('1')
    // FUP-QO-4's scope note is conditional on commissions.length > 1 — for
    // this single-commission reviewer it must NOT render (there is nothing
    // for it to disambiguate: the strip and the one-row table already agree).
    await expect(
      page.getByText(
        'Somatório de todas as comissões sob supervisão — não muda com o filtro de comissão abaixo.',
      ),
    ).toHaveCount(0)

    // POSITIVE — specific seeded case numbers, never a bare row count.
    for (const n of ['0001', '0002', '0003', '0004', '0005']) {
      await expect(
        page.getByRole('link', { name: `Caso ${n}` }),
      ).toBeVisible({ timeout: 10_000 })
    }
    // The commission's identity is legible on the board (Comissão column) even
    // though the filter-chip UI never mounts for a single-commission reviewer
    // (see the file header finding). Asserted explicitly, not just implied:
    // the chip row (>1 gate) must not render here.
    await expect(
      page.getByRole('group', { name: 'Filtrar casos por comissão' }),
    ).toHaveCount(0)
    await expect(
      page.getByText('Comissão de Controle de Infecção Hospitalar').first(),
    ).toBeVisible()
    // A commission from a DIFFERENT hospital under the same org (not merely
    // excluded — outside quality.a's hospital scope entirely) never leaks
    // onto the board. Relocated here from the multi-commission test's old
    // "BEFORE" section when that test was split (2026-08-07) — this is the
    // single-commission instance of the same property; the 2-commission
    // instance (does it still hold once the board is busier) stays in the
    // multi-commission read test.
    const singleCommissionBody = (await page.locator('body').textContent()) ?? ''
    expect(singleCommissionBody).not.toContain('Comissão de Ética')
    // D6's PHI-free note line.
    await expect(
      page.getByText('1 caso restrito não aparece nesta lista.'),
    ).toBeVisible()

    // NEGATIVE — the locked case's number AND label appear nowhere.
    await expect(
      page.getByRole('link', { name: 'Caso 0006' }),
    ).toHaveCount(0)
    const body = (await page.locator('body').textContent()) ?? ''
    expect(body).not.toContain('Denúncia Ética')
  })
})

// ---------------------------------------------------------------------------
// 3–6. Case opens read-only: content PRESENT (proves the read arm works),
//    the three D7-critical write controls + the rest of the write surface
//    ABSENT, the member sidebar ABSENT (F1), the documents panel with NO
//    download, and interviews/meetings OMITTED (not empty — Q4). Every
//    negative here is paired against chefe.ccih on the IDENTICAL case URL.
// ---------------------------------------------------------------------------

test.describe('QO·A — case opens read-only (paired against a real coordinator)', () => {
  const CASE_URL = `${CCIH}/casos/${CASE_1}`

  test('quality.a: content renders; every write affordance + the member sidebar are absent; documents panel has no download', async ({
    page,
  }) => {
    await signIn(page, 'quality.a@test.local')
    await page.goto(CASE_URL)

    // CONTENT PRESENT — proves the S7 read arm actually works (D3).
    await expect(
      page.getByRole('heading', { name: 'Caso 0001', level: 1 }),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Fase 1 — Coleta inicial')).toBeVisible()
    await expect(page.getByText('Fase 2 — Revisão do comitê')).toBeVisible()
    await expect(
      page.getByText('Paciente do leito 7 da UTI', { exact: false }).first(),
    ).toBeVisible()
    await expect(
      page.getByText('Escritório da Qualidade · somente leitura'),
    ).toBeVisible()

    // ABSENT — the three named explicitly (D7/D5 breach if any render).
    await expect(
      page.getByRole('button', { name: 'Notificar evento ao NSP' }),
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Corrigir…' })).toHaveCount(
      0,
    )
    await expect(
      page.getByRole('button', { name: 'Exibir identificação' }),
    ).toHaveCount(0)
    // Plus the rest of the write surface named in the frontend plan's matrix.
    await expect(
      page.getByRole('button', { name: 'Editar', exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: 'Gerenciar caso' }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Reabrir caso' }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Nova entrevista' }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: /^Adicionar/ }),
    ).toHaveCount(0)

    // MEMBER SIDEBAR ABSENT (F1) — the reduced shell, not a hidden menu.
    await expect(
      page.getByRole('link', { name: 'Construtor' }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: 'Gerenciar', exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: 'Painel', exact: true }),
    ).toHaveCount(0)
    // TWO legitimate matches, not a bug: the QualityViewerShell's own header
    // back link AND CaseDetailView's internal `backHref` link (the same
    // "Meus Casos" slot every member route uses) both carry this label —
    // `.first()` is enough since both point at the same href.
    const backLink = page
      .getByRole('link', { name: 'Escritório da Qualidade' })
      .first()
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', QUALIDADE)

    // DOCUMENTS PANEL — renders (metadata), but the seeded doc's download
    // control is gone (M8 bytes-cut; closes BOTH the anchor and the audited
    // OpenAttachmentButton fallback, not just the direct link).
    await expect(
      page.getByRole('heading', { name: 'Documentos' }),
    ).toBeVisible()
    await expect(page.getByText('Prescrição digitalizada')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Baixar Prescrição digitalizada' }),
    ).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Baixar/ })).toHaveCount(0)

    // INTERVIEWS + MEETINGS — OMITTED entirely (Q4), never an empty card. An
    // empty card reading "Nenhuma entrevista" would falsely assert "nothing
    // exists" when the truth is "not visible to you".
    await expect(
      page.getByRole('heading', { name: 'Entrevistas' }),
    ).toHaveCount(0)
    await expect(
      page.getByText('Nenhuma entrevista registrada'),
    ).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Reuniões' })).toHaveCount(
      0,
    )
  })

  test('no-lockout control: chefe.ccih reaches the SAME case URL with full content + every write affordance intact', async ({
    page,
  }) => {
    await signIn(page, 'chefe.ccih@test.local')
    await page.goto(CASE_URL)

    await expect(
      page.getByRole('heading', { name: 'Caso 0001', level: 1 }),
    ).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByRole('button', { name: 'Notificar evento ao NSP' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Corrigir…' }).first(),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Exibir identificação' }),
    ).toBeVisible()
    // Scoped to <header>: the case ALSO has per-narrative "Editar" buttons
    // (a different, narrative-content control) with the same accessible
    // name — the header scope isolates the EditCaseMetaDialog trigger this
    // test means to pair against quality.a's absence check.
    await expect(
      page.locator('header').getByRole('button', { name: 'Editar', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Gerenciar caso' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Nova entrevista' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Baixar Prescrição digitalizada' }),
    ).toBeVisible()
  })

  test('"Reabrir caso" pairing on a COMPLETED case (case 1 is pending, so testing it there would be vacuous for everyone)', async ({
    page,
  }) => {
    const completedUrl = `${CCIH}/casos/${CASE_2_COMPLETED}`

    await signIn(page, 'chefe.ccih@test.local')
    await page.goto(completedUrl)
    await expect(
      page.getByRole('button', { name: 'Reabrir caso' }),
    ).toBeVisible({ timeout: 10_000 })

    await signIn(page, 'quality.a@test.local')
    await page.goto(completedUrl)
    await expect(
      page.getByRole('heading', { name: 'Caso 0002', level: 1 }),
    ).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByRole('button', { name: 'Reabrir caso' }),
    ).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
// 7. Excluded commission — Farmácia (same hospital as CCIH) never appears on
//    the board and its case URL 404s, paired against a real Farmácia
//    coordinator reaching the identical URL.
// ---------------------------------------------------------------------------

test.describe('QO·A — excluded commission (Farmácia)', () => {
  test('quality.a: Farmácia never appears on the board and its case URL 404s', async ({
    page,
  }) => {
    await signIn(page, 'quality.a@test.local')
    await page.goto(QUALIDADE)
    const body = (await page.locator('body').textContent()) ?? ''
    expect(body).not.toContain('Farmácia')

    await page.goto(`${FARMACIA}/casos/${FARMACIA_CASE}`)
    await expect(
      page.getByRole('heading', { name: NOT_FOUND_GLOBAL }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('no-lockout control: chefe.farm (Farmácia coordinator) reaches the SAME case URL fine', async ({
    page,
  }) => {
    await signIn(page, 'chefe.farm@test.local')
    await page.goto(`${FARMACIA}/casos/${FARMACIA_CASE}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Caso 0001',
      { timeout: 10_000 },
    )
  })
})

// ---------------------------------------------------------------------------
// 8. Locked case — D6 lockdown beats the arm even inside an oversight-visible
//    commission, paired against chefe.ccih reaching the identical URL.
// ---------------------------------------------------------------------------

test.describe('QO·A — D6 lockdown beats the arm', () => {
  test('quality.a: the locked case (case_number 6, explicit_grants_only) 404s even though CCIH itself is oversight-visible', async ({
    page,
  }) => {
    await signIn(page, 'quality.a@test.local')
    await page.goto(`${CCIH}/casos/${LOCKED_CASE}`)
    await expect(
      page.getByRole('heading', { name: NOT_FOUND_GLOBAL }),
    ).toBeVisible({ timeout: 10_000 })
    const body = (await page.locator('body').textContent()) ?? ''
    expect(body).not.toContain('Denúncia Ética')
  })

  test('no-lockout control: chefe.ccih (real coordinator) reaches the SAME locked-case URL fine', async ({
    page,
  }) => {
    await signIn(page, 'chefe.ccih@test.local')
    await page.goto(`${CCIH}/casos/${LOCKED_CASE}`)
    // Ethics cases use the case-TYPE terminology ("Denúncia 0006"), not the
    // platform default — assert the number, not the exact term.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      '0006',
      { timeout: 10_000 },
    )
    await expect(page.getByText('Denúncia Ética (fixture E1)')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 9. Cross-org isolation — quality.b (Rede B) reaches nothing in Rede A,
//    paired against her reaching her OWN console fine (proves the 404 is a
//    boundary, not a broken account).
// ---------------------------------------------------------------------------

test.describe('QO·A — cross-org isolation', () => {
  test('quality.b (Rede B reviewer) reaches nothing in Rede A: /o/rede-a/qualidade 404s with no data leakage', async ({
    page,
  }) => {
    await signIn(page, 'quality.b@test.local')
    await page.goto(QUALIDADE)
    // ⚠ FINDING (live-proven, not the spec author's assumption): the console
    // has its OWN `qualidade/not-found.tsx` ("Página não encontrada"), but a
    // `notFound()` thrown by `qualidade/layout.tsx` itself — the ORG-denial
    // path, which is what this test exercises — is caught by the GLOBAL
    // `src/app/not-found.tsx` instead, per Next.js App Router boundary rules
    // (a segment's co-located not-found.tsx cannot catch a notFound() thrown
    // by that same segment's own layout — a layout wraps its sibling
    // not-found.tsx, not the other way around). Both `page.tsx` and
    // `dashboards/page.tsx` re-run the SAME `cache()`-wrapped
    // `getQualidadeAccessByOrg`, so their own notFound() calls can never
    // diverge from the layout's — meaning the qualidade-scoped 404 copy is
    // effectively unreachable today. No security impact (RLS + the layout
    // gate are still the real boundary, and this 404 leaks nothing either),
    // but worth a note to `frontend`/lead: reported, not filed as a bug.
    await expect(
      page.getByRole('heading', { name: NOT_FOUND_GLOBAL }),
    ).toBeVisible({ timeout: 10_000 })
    const body = (await page.locator('body').textContent()) ?? ''
    expect(body).not.toContain('Controle de Infecção')
    expect(body).not.toContain('Óbito')
  })

  test('no-lockout control: quality.b reaches her OWN console (Rede B) fine', async ({
    page,
  }) => {
    await signIn(page, 'quality.b@test.local')
    await page.goto('/o/rede-b/qualidade')
    await expect(
      page.getByRole('heading', { name: 'Casos sob supervisão' }),
    ).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// 10. Admin toggles oversight (D9) — split 2026-08-07 (lead ruling, iteration
//    4 of the same test) into a WRITE-path test (hospitaladmin.a1 only:
//    proves the keyboard flip reaches the database) and a READ-path test
//    (quality.a only, precondition set directly through the door: proves the
//    reviewer's board honours the database). Chained, they cover the same
//    property the original single combined test did — an admin in one
//    session and a reviewer in another are two different people at two
//    different desks; nothing about the product requires them to share a
//    browser context, and three rounds of tightening the combined test's UI
//    confirmations (reload, response-wait, then SQL) never fixed the actual
//    problem, which was simply too many sign-ins in one test (each
//    `cachedSignIn` costs a cookie clear + a login round-trip). A staff_admin
//    (the committee itself) still cannot reach the toggle at all, paired
//    against org_admin who can — both stay single-persona, unchanged.
// ---------------------------------------------------------------------------

test.describe('QO·A — admin toggles oversight (D9)', () => {
  test('WRITE PATH: hospitaladmin.a1 flips CCIH to excluded by keyboard, and the database actually changes', async ({
    page,
  }) => {
    await signIn(page, 'hospitaladmin.a1@test.local')
    await page.goto(COMISSOES)

    const toggle = page.getByRole('switch', { name: CCIH_SWITCH_NAME })
    await expect(toggle).toBeVisible({ timeout: 10_000 })
    await expect(toggle).toBeChecked()

    try {
      // KEYBOARD-ONLY activation — focus + Space, no .click() anywhere. This
      // IS the a11y path under test; the optimistic check right after is
      // part of that behavior (the switch visibly responding to Space).
      await toggle.focus()
      await expect(toggle).toBeFocused()
      await page.keyboard.press('Space')
      await expect(toggle).not.toBeChecked({ timeout: 10_000 })
      // CONFIRM IN THE DATABASE, not via reload/response-wait — a single
      // out-of-process `sqlOne` query is strictly STRONGER evidence the
      // mutation landed than any UI-based confirmation (it observes the row
      // itself, not a rendering of it), and this is what actually fixed the
      // false-positive/hang history this file went through (2026-08-07).
      expect(
        oversightOf('ccih'),
        'CCIH oversight did not actually flip to excluded in the database',
      ).toBe('excluded')
    } finally {
      // RESTORE — this DB is shared with other tests in this file and other
      // sessions. Best-effort even if an assertion above threw.
      //
      // ⚠ CLEANUP USES .click(), NOT KEYBOARD, even though the FLIP under
      // test above is deliberately keyboard-driven (that IS this test's
      // a11y point). Live-diagnosed 2026-08-07 (the lead's batch-15 re-run +
      // an immediate audit_log query): a real, flaky CCIH revert attempt
      // left NO `commission.oversight_changed` audit row at all — a plain
      // no-op, not a refusal (which still emits one). `.focus()` is not
      // auto-waiting — it races RSC streaming and can no-op silently, a
      // documented precedent in this repo. The cleanup is not under test,
      // so it uses the most reliable interaction available.
      const toggleAgain = page.getByRole('switch', { name: CCIH_SWITCH_NAME })
      await expect(toggleAgain).toBeVisible({ timeout: 10_000 })
      if (!(await toggleAgain.isChecked())) {
        await toggleAgain.click()
        await expect(toggleAgain).toBeChecked({ timeout: 10_000 })
      }
      // Confirmed in the DATABASE, computed alongside the scoped,
      // non-empty-text alert check (a bare `page.getByRole('alert')`
      // false-positived on an unrelated, empty element elsewhere on the
      // page — live-caught 2026-08-07) so a failure still says WHY: refused
      // vs. a silent no-op.
      //
      // ⚠ `.allTextContents()`, NOT `.textContent()` — live-diagnosed
      // 2026-08-07 (single instrumented run, timestamped): on the SUCCESS
      // path no alert renders at all, so this locator matches ZERO
      // elements. `.textContent()` is an ACTION, not an assertion — on a
      // zero-match locator it RETRIES (does not reject) until its timeout,
      // and with none given here that means the test's own global timeout;
      // `.catch(() => null)` never sees a rejection until that full wait
      // elapses. This was the actual mechanism behind both write-path
      // tests hanging to exactly the test timeout after the split — the
      // toggle interaction itself (proven above) took ~1.2s end-to-end.
      // `.allTextContents()` resolves immediately with whatever currently
      // matches, empty array included — no wait-for-existence.
      const ccihFinal = oversightOf('ccih')
      const ccihAlertTexts = await toggleAgain
        .locator('xpath=../..')
        .getByRole('alert')
        .allTextContents()
      const ccihAlertText = (ccihAlertTexts[0] ?? '').trim()
      expect(
        ccihFinal,
        ccihAlertText
          ? `revert REFUSED by the door: ${ccihAlertText}`
          : 'revert click registered but the database still shows the wrong value (silent no-op)',
      ).toBe('visible')
    }
  })

  test('READ PATH: quality.a\'s board loses CCIH once the database says excluded', async ({
    page,
  }) => {
    // Precondition set DIRECTLY through the door, not by driving
    // hospitaladmin.a1 through the UI first — the write path is proven
    // end-to-end by the sibling test above. This test is about whether the
    // reviewer's board honours the database, which needs exactly one
    // signed-in principal, not two.
    setOversightViaDoor('ccih', 'excluded')
    try {
      await signIn(page, 'quality.a@test.local')
      await page.goto(QUALIDADE)
      await expect(
        page.getByRole('heading', { name: 'Nenhuma comissão sob supervisão' }),
      ).toBeVisible({ timeout: 10_000 })
      const body = (await page.locator('body').textContent()) ?? ''
      expect(body).not.toContain('Controle de Infecção')
    } finally {
      setOversightViaDoor('ccih', 'visible')
      expect(
        oversightOf('ccih'),
        'CCIH restore via the door did not land',
      ).toBe('visible')
    }
  })

  test('D9: the committee cannot opt itself in — chefe.ccih (staff_admin) has no reach to /manage/comissoes at all', async ({
    page,
  }) => {
    await signIn(page, 'chefe.ccih@test.local')
    await page.goto(COMISSOES)
    await expect(
      page.getByRole('heading', { name: NOT_FOUND_GLOBAL }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('no-lockout control: orgadmin.a DOES reach /manage/comissoes and sees the toggle', async ({
    page,
  }) => {
    await signIn(page, 'orgadmin.a@test.local')
    await page.goto(COMISSOES)
    await expect(
      page.getByRole('switch', { name: CCIH_SWITCH_NAME }),
    ).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// 12. Multi-commission board (D10 cross-committee) — the reason the console
//    exists: a reviewer seeing ACROSS committees, not just one. No seed
//    fixture provides a second oversight-visible commission for quality.a —
//    `backend` proved adding one reds tenant-isolation keystones 171/189 or
//    destroys the quality.a2 / same-hospital-excluded fixtures — so these
//    tests establish the precondition themselves, via the SAME door the D9
//    toggle tests above use (`set_commission_oversight`). This exercises the
//    real onboarding flow ADR 0100 D8 describes (an admin opts a committee
//    in, the board gains it) rather than testing a seed state that arrived
//    by magic.
//
//    Split 2026-08-07 (lead ruling, same rationale as the D9 toggle split
//    above — and this test carried the SAME multi-sign-in shape, one worse:
//    it interleaved quality.a/hospitaladmin.a1 THREE times, not two) into a
//    WRITE-path test (hospitaladmin.a1 only: proves the keyboard flip
//    reaches the database, in both directions — visible then back to
//    excluded, mirroring the CCIH write-path test) and a READ-path test
//    (quality.a only, precondition set directly through the door: proves
//    the reviewer's board honours the database once TWO commissions are
//    visible, and again once reverted to one). Chained, they cover the same
//    property the original combined test did. Restored by commission
//    NAME/id (never positionally); each restore is ASSERTED, not trusted.
//
//    Ground truth (live-probed via the real RPC path, then reverted —
//    2026-08-07): with CCIH + Farmácia both visible, quality.a's
//    `quality_board_summary` returns CCIH (5/4/1, unchanged) + Farmácia
//    (total=1, open=1, locked=0 — its one case is case_number 1, "Análise
//    de parecer — CCIH", pending). Both commissions mint case_number
//    independently, so "Caso 0001" is NOT a unique accessible name once
//    both are visible — disambiguated below by label text, never the bare
//    case number, to avoid a strict-mode collision.
//
//    ⚠ VERIFIED, not assumed, and deliberately asserted rather than
//    omitted: the KPI strip and the locked-count note are both computed
//    server-side from the FULL oversight-visible commission set and
//    rendered as SIBLINGS of the client-filtered board (`page.tsx`) — no
//    prop path carries the chip's client-side selection state back up to
//    them. They stay the GLOBAL aggregate regardless of which chip is
//    active; only the table ROWS narrow. Confirmed a design question, not a
//    defect (lead ruling 2026-08-07) — recorded as FUP-QO-4. Asserting the
//    constant-across-selection behavior explicitly (not omitting it) means
//    this test notices if a later change makes the strip recompute.
// ---------------------------------------------------------------------------

test.describe('QO·A — multi-commission board (D10 cross-committee)', () => {
  test('WRITE PATH: hospitaladmin.a1 flips Farmácia to visible by keyboard, and the database actually changes', async ({
    page,
  }) => {
    await signIn(page, 'hospitaladmin.a1@test.local')
    await page.goto(COMISSOES)
    const toggle = page.getByRole('switch', { name: FARMACIA_SWITCH_NAME })
    await expect(toggle).toBeVisible({ timeout: 10_000 })
    await expect(toggle).not.toBeChecked()

    try {
      // KEYBOARD-ONLY activation — mirrors the CCIH write-path test's
      // discipline (this IS the a11y point under test).
      await toggle.focus()
      await expect(toggle).toBeFocused()
      await page.keyboard.press('Space')
      await expect(toggle).toBeChecked({ timeout: 10_000 })
      // CONFIRM IN THE DATABASE — same discipline as the CCIH write-path
      // test: a single out-of-process query is strictly stronger evidence
      // than any UI-based confirmation, and every UI-based one tried here
      // eventually cost too much wall clock.
      expect(
        oversightOf('farmacia'),
        'Farmácia oversight did not actually flip to visible in the database',
      ).toBe('visible')
    } finally {
      // RESTORE — .click(), not keyboard (cleanup is not under test, the
      // flip above is deliberately keyboard-driven and stays that way).
      // Same discipline as the CCIH write-path test's `finally`:
      // live-diagnosed 2026-08-07, a real revert attempt can leave NO
      // `commission.oversight_changed` audit row at all (a silent no-op,
      // not a refusal — which still emits one), so the DB check is paired
      // with a scoped, non-empty-text alert check so a failure still says
      // WHY: refused vs. a silent no-op.
      //
      // ⚠ `.allTextContents()`, NOT `.textContent()` — same fix as the CCIH
      // write-path test's `finally` (live-diagnosed 2026-08-07, single
      // instrumented run): on the SUCCESS path no alert renders, so this
      // locator matches ZERO elements, and `.textContent()` RETRIES on a
      // zero-match locator until its timeout instead of rejecting — with
      // none given here that's the test's own global timeout, and
      // `.catch(() => null)` never sees a rejection until that full wait
      // elapses. This was the actual mechanism behind both write-path tests
      // hanging to exactly the test timeout after the split.
      const toggleAgain = page.getByRole('switch', {
        name: FARMACIA_SWITCH_NAME,
      })
      await expect(toggleAgain).toBeVisible({ timeout: 10_000 })
      if (await toggleAgain.isChecked()) {
        await toggleAgain.click()
        await expect(toggleAgain).not.toBeChecked({ timeout: 10_000 })
      }
      const farmaciaFinal = oversightOf('farmacia')
      const farmaciaAlertTexts = await toggleAgain
        .locator('xpath=../..')
        .getByRole('alert')
        .allTextContents()
      const farmaciaAlertText = (farmaciaAlertTexts[0] ?? '').trim()
      expect(
        farmaciaFinal,
        farmaciaAlertText
          ? `revert REFUSED by the door: ${farmaciaAlertText}`
          : 'revert click registered but the database still shows the wrong value (silent no-op)',
      ).toBe('excluded')
    }
  })

  test("READ PATH: quality.a's board gains Farmácia once the database says visible — chip row, global KPI aggregate, per-chip narrowing, cross-consistency, and the excluded-elsewhere commission stays absent throughout", async ({
    page,
  }) => {
    // Precondition set DIRECTLY through the door, not by driving
    // hospitaladmin.a1 through the UI first — the write path is proven
    // end-to-end by the sibling test above. This test is about whether the
    // reviewer's board honours the database once TWO commissions are
    // visible, which needs exactly one signed-in principal, not two.
    setOversightViaDoor('farmacia', 'visible')
    try {
      await signIn(page, 'quality.a@test.local')
      await page.goto(QUALIDADE)
      await expect(
        page.getByRole('heading', { name: 'Casos sob supervisão' }),
      ).toBeVisible({ timeout: 10_000 })

      // CHIP ROW MOUNTS — lists both commissions. Default selection is
      // "Todas" (no `?comissao=`), so the table already shows every
      // readable row from BOTH commissions before any click.
      const chips = page.getByRole('group', {
        name: 'Filtrar casos por comissão',
      })
      await expect(chips).toBeVisible({ timeout: 10_000 })
      const ccihChip = chips.getByRole('button', {
        name: /^Comissão de Controle de Infecção Hospitalar/,
      })
      const farmaciaChip = chips.getByRole('button', {
        name: /^Comissão de Farmácia e Terapêutica/,
      })
      await expect(ccihChip).toBeVisible()
      await expect(farmaciaChip).toBeVisible()
      // D6: Farmácia's real seed data carries no locked case — this is a
      // stable NEGATIVE regardless of how many open cases contaminate it.
      await expect(farmaciaChip).not.toContainText('restrito')

      // KPI + locked-count note: the GLOBAL aggregate (FUP-QO-4), derived
      // from "Todas" (the default view) — the SAME "strip agrees with the
      // board" invariant as the single-commission test, not the seeded
      // 5+1=6 / 4+1=5. Region located by its visible <h2> (commit 7ca0207),
      // not an aria-label string.
      //
      // ⚠ COVERAGE LIMIT, stated so it isn't mistaken for tested: Farmácia's
      // real seed data is locked=0, so "Casos restritos: 1" below is
      // consistent with BOTH correct per-commission attribution (1 + 0) AND
      // a bug that sums wrong (also 1 + 0 = 1, indistinguishable at this
      // value). This test cannot discriminate "attributes locked counts per
      // commission" from "sums them wrong" — that property is pinned at the
      // DB layer instead, in pgTAP `310` §4's deliberate 1-vs-2 fixture,
      // mutation-proven by `q1`'s `drop_board_correlation` case. A second
      // temporary flip here to get a real 1-vs-2 at the UI layer was
      // considered and declined (lead ruling 2026-08-07): marginal coverage
      // for more mutation/restore surface in the flakiest layer in the
      // suite. If this value ever needs re-deriving, `310` §4 is where the
      // real coverage lives, not here. Verified (not assumed): none of
      // batch 15's case-creating siblings reference `visibility_policy` or
      // a `case_type_id` (grepped 2026-08-07), so nothing they create can
      // be `explicit_grants_only`.
      const kpi = page.getByRole('region', { name: 'Visão geral' })
      const totalRendered = await renderedCaseLinks(page).count()
      const openRendered = await renderedOpenCaseCount(page)
      await expect(kpiValue(kpi, 'Comissões')).toHaveText('2')
      await expect(kpiValue(kpi, 'Casos visíveis')).toHaveText(
        String(totalRendered),
      )
      await expect(kpiValue(kpi, 'Em aberto')).toHaveText(String(openRendered))
      await expect(kpiValue(kpi, 'Casos restritos')).toHaveText('1')
      // FLOOR: the seeded CCIH(5) + Farmácia(1), so this cannot pass
      // vacuously on a regressed empty board.
      expect(totalRendered).toBeGreaterThanOrEqual(6)
      await expect(
        page.getByText('1 caso restrito não aparece nesta lista.'),
      ).toBeVisible()
      // FUP-QO-4's own scope note, IN the strip — must render now that >1
      // commission is visible (the exact condition that makes "Casos
      // visíveis" above the per-commission table ambiguous otherwise).
      await expect(
        page.getByText(
          'Somatório de todas as comissões sob supervisão — não muda com o filtro de comissão abaixo.',
        ),
      ).toBeVisible()

      // "Todas": both commissions' case_number-1 rows coexist — a genuine
      // number collision (each commission mints its own sequence), so the
      // bare case-number link now matches BOTH; disambiguate by label.
      await expect(
        page.getByRole('link', { name: 'Caso 0001' }),
      ).toHaveCount(2)
      await expect(page.getByText('Óbito UTI leito 7')).toBeVisible()
      await expect(page.getByText('Análise de parecer — CCIH')).toBeVisible()

      // SELECT Farmácia — narrows to its case only; CCIH's cases (incl. the
      // still-locked case 6) disappear from the table. The chip's own count
      // is checked against WHAT SELECTING IT ACTUALLY RENDERS, not a magic
      // number: a fixed `toContainText('1')` would keep PASSING under
      // contamination purely because e.g. "11" also contains "1" —
      // passing for the wrong reason, which is worse than failing outright.
      await farmaciaChip.click()
      const farmaciaRendered = await renderedCaseLinks(page).count()
      await expect(farmaciaChip).toContainText(String(farmaciaRendered))
      expect(farmaciaRendered).toBeGreaterThanOrEqual(1)
      await expect(page.getByText('Análise de parecer — CCIH')).toBeVisible()
      await expect(page.getByText('Óbito UTI leito 7')).toHaveCount(0)
      await expect(
        page.getByRole('link', { name: 'Caso 0001' }),
      ).toHaveCount(1)

      // KPI/locked-count UNCHANGED by the selection (FUP-QO-4) — re-asserted
      // against the CAPTURED "Todas" totals above, never re-derived from the
      // now-filtered subset (which would give a smaller, wrong number).
      await expect(kpiValue(kpi, 'Casos visíveis')).toHaveText(
        String(totalRendered),
      )
      await expect(kpiValue(kpi, 'Casos restritos')).toHaveText('1')

      // SELECT CCIH — narrows the other way; Farmácia's case disappears.
      // Same chip-count-matches-its-own-filter discipline as Farmácia's.
      await ccihChip.click()
      const ccihRendered = await renderedCaseLinks(page).count()
      await expect(ccihChip).toContainText(String(ccihRendered))
      await expect(ccihChip).toContainText('1 restrito')
      expect(ccihRendered).toBeGreaterThanOrEqual(5)
      await expect(page.getByText('Óbito UTI leito 7')).toBeVisible()
      await expect(
        page.getByText('Análise de parecer — CCIH'),
      ).toHaveCount(0)
      await expect(
        page.getByRole('link', { name: 'Caso 0006' }),
      ).toHaveCount(0) // the locked case — still invisible under this filter too

      // Internal consistency: the two per-commission filtered counts sum to
      // the unfiltered "Todas" total — catches a row double-counted or
      // silently dropped by the client-side filter, independent of any
      // particular contamination amount.
      expect(ccihRendered + farmaciaRendered).toBe(totalRendered)

      // The fully out-of-scope commission stayed absent through the whole
      // 2-commission board — a materially different condition from the
      // single-commission instance of this same check in the oversight-
      // board test above, so it is kept here rather than treated as
      // redundant with it.
      const body = (await page.locator('body').textContent()) ?? ''
      expect(body).not.toContain('Comissão de Ética')
    } finally {
      // RESTORE through the SAME door used to set the precondition — no
      // second hospitaladmin.a1 sign-in needed; the write path is proven
      // end-to-end by the sibling test above.
      setOversightViaDoor('farmacia', 'excluded')
      expect(
        oversightOf('farmacia'),
        'Farmácia restore via the door did not land',
      ).toBe('excluded')
    }

    // ASSERT the restore is honoured from the READER's side too — Farmácia
    // disappears from quality.a's board again (the chip row un-mounts, and
    // the same-hospital-excluded denial fixture the rest of this file
    // relies on is genuinely back). Reuses the already-signed-in session
    // above — no additional cachedSignIn cost. Only reached if the `try`
    // block above passed, same as the original combined test's shape.
    await page.goto(QUALIDADE)
    await expect(
      page.getByRole('group', { name: 'Filtrar casos por comissão' }),
    ).toHaveCount(0)
    const finalBody = (await page.locator('body').textContent()) ?? ''
    expect(finalBody).not.toContain('Farmácia')
  })
})

// ---------------------------------------------------------------------------
// 11. Keyboard-only flow (house rule) — console nav -> board -> case, entirely
//    via focus() + Enter, no .click() anywhere. (`.focus()` races RSC
//    streaming if called before the target is confirmed visible — every
//    focus() below is preceded by a `toBeVisible()` wait, mirroring the
//    proven pattern in cases-board-access.spec.ts.)
// ---------------------------------------------------------------------------

test.describe('QO·A — keyboard-only flow', () => {
  test('quality.a navigates console nav -> dashboards -> board -> a case entirely by keyboard', async ({
    page,
  }) => {
    await signIn(page, 'quality.a@test.local')
    await page.goto(QUALIDADE)
    await expect(
      page.getByRole('heading', { name: 'Casos sob supervisão' }),
    ).toBeVisible({ timeout: 10_000 })

    const nav = page.getByRole('navigation', {
      name: 'Escritório da Qualidade',
    })
    const painelLink = nav.getByRole('link', { name: 'Painéis' })
    await expect(painelLink).toBeVisible({ timeout: 10_000 })
    await painelLink.focus()
    await expect(painelLink).toBeFocused()
    await page.keyboard.press('Enter')
    await page.waitForURL(`**${QUALIDADE}/dashboards`, { timeout: 15_000 })
    await expect(
      page.getByRole('heading', { name: 'Painéis de conformidade' }),
    ).toBeVisible({ timeout: 10_000 })

    const casosLink = nav.getByRole('link', { name: 'Casos' })
    await expect(casosLink).toBeVisible({ timeout: 10_000 })
    await casosLink.focus()
    await expect(casosLink).toBeFocused()
    await page.keyboard.press('Enter')
    await page.waitForURL((url) => url.pathname === QUALIDADE, {
      timeout: 15_000,
    })

    const caseLink = page.getByRole('link', { name: 'Caso 0001' })
    await expect(caseLink).toBeVisible({ timeout: 10_000 })
    await caseLink.focus()
    await expect(caseLink).toBeFocused()
    await page.keyboard.press('Enter')
    await page.waitForURL(`**${CCIH}/casos/${CASE_1}`, { timeout: 15_000 })
    await expect(
      page.getByRole('heading', { name: 'Caso 0001', level: 1 }),
    ).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('CAD — read-only meeting cadence on the committee registry', () => {
  /**
   * PO ruling 2026-08-09 (charter ③). `manage/charter` stays coordinator-only; the
   * accreditation question it raised — "which of my committees are behind on meetings?" —
   * is answered HERE instead, read-only, on the registry the tenancy admin already owns.
   *
   * Backed by `commission_cadence_overview()` (`20260917000300`), which takes NO argument:
   * it derives its own row set from `is_tenancy_admin_of`, so a caller cannot ask about a
   * commission it does not administer. pgTAP `261` §CAD pins the isolation (CAD-4/CAD-5,
   * mutation-proven); these assert the surface actually renders and stays read-only.
   */
  test('orgadmin.a sees a cadence badge per committee, with the real per-committee status', async ({
    page,
  }) => {
    await signIn(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/comissoes')

    // Farmácia has a charter + a recent plenary in the seed → "Em dia". CCIH has no
    // charter → "Regimento/cadência não configurado". Asserting DIFFERENT statuses on
    // purpose: a badge that rendered one constant for every row would satisfy a
    // "badge is visible" check and prove nothing about the data behind it.
    await expect(
      page.getByRole('status', {
        name: /Cadência de reuniões de Comissão de Farmácia e Terapêutica: Em dia/i,
      }),
    ).toBeVisible({ timeout: 15_000 })

    await expect(
      page.getByRole('status', {
        name: /Cadência de reuniões de Comissão de Controle de Infecção Hospitalar: Regimento\/cadência não configurado/i,
      }),
    ).toBeVisible()

    // The accessible name carries the COMMITTEE, not just the status — with a dozen
    // cards on screen, "Em dia" alone is ambiguous to a screen-reader user.
    const badges = page.getByRole('status', { name: /Cadência de reuniões de/i })
    expect(await badges.count()).toBeGreaterThan(1)
  })

  test('the cadence surface is READ-ONLY — no charter edit affordance reached the registry', async ({
    page,
  }) => {
    await signIn(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/comissoes')
    await expect(
      page.getByRole('status', { name: /Cadência de reuniões de/i }).first(),
    ).toBeVisible({ timeout: 15_000 })

    // The whole point of the ruling: oversight WITHOUT handing out the coordinator's
    // editor. If a future change wires an edit control in here, this reddens.
    await expect(
      page.getByRole('link', { name: /Regimento|Cadência/i }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: /Regimento|Periodicidade|Definir cadência/i }),
    ).toHaveCount(0)
  })

  test('...and the charter page itself STILL 404s for the same tenancy admin', async ({
    page,
  }) => {
    await signIn(page, 'orgadmin.a@test.local')
    // The ruling's other half. Without this, the registry badge could be read as
    // "cadence was opened up", when what was opened is a read-only projection of it.
    await page.goto('/o/rede-a/c/ccih/manage/charter')
    await expect(
      page.getByRole('heading', { name: /Regimento & Cadência/i }),
    ).toHaveCount(0)
  })
})

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

const NOT_FOUND_GLOBAL = 'Não encontramos esta página.'
const CCIH_SWITCH_NAME =
  'Supervisão da qualidade — Comissão de Controle de Infecção Hospitalar'

/** Read a KPI card's VALUE paragraph by its label text (see quality-kpi-strip.tsx:
 *  each card is one <div> with 3 <p> children — label, value, sub-line — and no
 *  nested <div>s, so filtering the region's <div>s by label text isolates exactly
 *  one card. */
function kpiValue(region: Locator, label: string): Locator {
  return region.locator('div').filter({ hasText: label }).locator('p').nth(1)
}

async function signIn(page: Page, email: string) {
  await cachedSignIn(page, email)
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

    const kpi = page.getByRole('region', { name: 'Indicadores da supervisão' })
    await expect(kpi).toBeVisible()
    await expect(kpiValue(kpi, 'Comissões')).toHaveText('1')
    await expect(kpiValue(kpi, 'Casos visíveis')).toHaveText('5')
    await expect(kpiValue(kpi, 'Em aberto')).toHaveText('4')
    await expect(kpiValue(kpi, 'Casos restritos')).toHaveText('1')

    // POSITIVE — specific seeded case numbers, never a bare row count.
    for (const n of ['0001', '0002', '0003', '0004', '0005']) {
      await expect(
        page.getByRole('link', { name: `Caso ${n}` }),
      ).toBeVisible({ timeout: 10_000 })
    }
    // The commission's identity is legible on the board (Comissão column) even
    // though the filter-chip UI never mounts for a single-commission reviewer
    // (see the file header finding).
    await expect(
      page.getByText('Comissão de Controle de Infecção Hospitalar').first(),
    ).toBeVisible()
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
// 10. Admin toggles oversight (D9) — hospital_admin flips CCIH; quality.a's
//    board reflects it live; a staff_admin (the committee itself) cannot
//    reach the toggle at all, paired against org_admin who can. The toggle
//    is operated by KEYBOARD (Space on the Switch), covering the second
//    keyboard path the frontend plan names.
// ---------------------------------------------------------------------------

test.describe('QO·A — admin toggles oversight (D9)', () => {
  test('hospitaladmin.a1 flips CCIH to excluded (keyboard); quality.a\'s board loses it live; restored after', async ({
    page,
  }) => {
    await signIn(page, 'hospitaladmin.a1@test.local')
    await page.goto(COMISSOES)

    const toggle = page.getByRole('switch', { name: CCIH_SWITCH_NAME })
    await expect(toggle).toBeVisible({ timeout: 10_000 })
    await expect(toggle).toBeChecked()

    try {
      // KEYBOARD-ONLY activation — focus + Space, no .click() anywhere.
      await toggle.focus()
      await expect(toggle).toBeFocused()
      await page.keyboard.press('Space')
      await expect(toggle).not.toBeChecked({ timeout: 10_000 })

      await signIn(page, 'quality.a@test.local')
      await page.goto(QUALIDADE)
      await expect(
        page.getByRole('heading', { name: 'Nenhuma comissão sob supervisão' }),
      ).toBeVisible({ timeout: 10_000 })
      const body = (await page.locator('body').textContent()) ?? ''
      expect(body).not.toContain('Controle de Infecção')
    } finally {
      // RESTORE — this DB is shared with other tests in this file and other
      // sessions. Best-effort even if an assertion above threw.
      await signIn(page, 'hospitaladmin.a1@test.local')
      await page.goto(COMISSOES)
      const toggleAgain = page.getByRole('switch', { name: CCIH_SWITCH_NAME })
      await expect(toggleAgain).toBeVisible({ timeout: 10_000 })
      if (!(await toggleAgain.isChecked())) {
        await toggleAgain.focus()
        await page.keyboard.press('Space')
        await expect(toggleAgain).toBeChecked({ timeout: 10_000 })
      }
    }

    // Confirm the restore actually landed from quality.a's side too.
    await signIn(page, 'quality.a@test.local')
    await page.goto(QUALIDADE)
    await expect(page.getByRole('link', { name: 'Caso 0001' })).toBeVisible({
      timeout: 10_000,
    })
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

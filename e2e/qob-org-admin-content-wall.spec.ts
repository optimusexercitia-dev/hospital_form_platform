import { test, expect, type Page } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'

/**
 * QO·B — the org_admin / hospital_admin CONTENT WALL, end to end.
 * ADR 0100 D12; PO rulings Q1–Q9 (2026-08-08); migrations 20260915000000..000300.
 *
 * WHAT THIS FILE PINS, and what it deliberately does not.
 *
 * It pins the settled half: through the real UI, a tenancy admin reaches NO row-level
 * committee content, while the committee's own coordinator reaches it unchanged and the
 * tenancy admin's ADMINISTRATION surfaces keep working. Those three together are the
 * wall — a spec that only proved the denial would pass just as happily if QO·B had
 * broken the product for everyone, or if the admin had been locked out of their own job.
 *
 * ⚠ IT DELIBERATELY DOES NOT PIN THE COORDINATOR-AFFORDANCE BEHAVIOUR, because that is
 * an OPEN QUESTION, filed as BUG-QOB-003. src/lib/queries/session.ts resolves a tenancy
 * admin holding no membership row to `role: 'staff_admin'`, and `canUseCapability` opens
 * on exactly that — so after QO·B the UI still renders coordinator affordances that the
 * DB now refuses. Whether the fix is a flag (Phase A's answer for quality_reviewer), a
 * 404 (the cases-board precedent), or acceptance is a PO ruling. Asserting today's
 * behaviour here would PIN A DEFECT and make the fix look like a regression, so this
 * file asserts only what is settled and names the gap instead.
 *
 * ⚠ REACH, NEVER ROW COUNT (the cases-board-access.spec.ts discipline). "The list is
 * empty for org_admin" proves nothing — it would pass if the commission simply had no
 * responses. Every denial below is paired with the SAME surface, SAME commission, read
 * by a principal who genuinely sees content, so an empty screen can never be mistaken
 * for a wall.
 *
 * Personas (password Test1234!): orgadmin.a@test.local (org_admin Rede A, no CCIH
 * membership) · chefe.ccih@test.local (staff_admin of CCIH — the control) ·
 * hospitaladmin.a1@test.local (hospital_admin — Q4 says the SAME wall applies).
 */

const ORG = 'rede-a'
const COMMISSION = 'ccih'

test.describe('QO·B — org_admin/hospital_admin content wall', () => {
  // ⚠ SURFACE CORRECTED AFTER THE FIRST E2E RUN WENT RED, and the red was RIGHT.
  // These three originally pointed at /respostas — which is "Minhas respostas", the
  // caller's OWN responses. That surface is empty for a tenancy admin REGARDLESS of
  // QO·B, because they never created any: precisely the reach-not-row-count trap this
  // file's own header warns about, walked into anyway. It also matched a nav link
  // rather than a row, which is how it surfaced. The wall can only be observed on a
  // surface that shows OTHER people's responses, so they now target the commission
  // submissions browser, whose list is `ul[aria-label="Respostas"]`.
  const SUBMISSIONS = `/o/${ORG}/c/${COMMISSION}/dashboard/submissions`

  test('CONTROL: the committee coordinator reads the commission submissions', async ({ page }) => {
    // Runs FIRST on purpose. If this fails, every denial below is meaningless — they
    // would be denials of content that is not there.
    await cachedSignIn(page, 'chefe.ccih@test.local')
    await page.goto(SUBMISSIONS)

    const list = page.getByRole('list', { name: 'Respostas' })
    await expect(list).toBeVisible()
    expect(await list.getByRole('listitem').count()).toBeGreaterThan(0)
  })

  test('WALL: org_admin reads no commission submissions on the same surface', async ({ page }) => {
    await cachedSignIn(page, 'orgadmin.a@test.local')
    await page.goto(SUBMISSIONS)

    // ⚠ ASSERTED UNCONDITIONALLY. An earlier draft wrapped this in
    // `if (refused === 0)`, so a 404 branch would have made the test assert NOTHING and
    // still pass — a test that cannot fail. The wall may legitimately express itself
    // either way (the route refuses the tenancy admin, or it renders with an empty
    // list), and the list's ABSENCE is true in both, so no branch is needed.
    // What must never appear is a readable submission row belonging to a committee
    // member — the SAME rows the control just read.
    await expect(page.getByRole('list', { name: 'Respostas' })).toHaveCount(0)
  })

  test('WALL (Q4): hospital_admin gets the same treatment as org_admin', async ({ page }) => {
    await cachedSignIn(page, 'hospitaladmin.a1@test.local')
    await page.goto(SUBMISSIONS)

    await expect(page.getByRole('list', { name: 'Respostas' })).toHaveCount(0)
  })

  test('KEEP: org_admin retains its administration surface', async ({ page }) => {
    // The wall subtracts CONTENT, never the admin's nouns. Without this assertion the
    // suite would be equally green if QO·B had walled the org_admin out of the product
    // altogether — the over-cut failure, which no "did we remove enough?" check sees.
    await cachedSignIn(page, 'orgadmin.a@test.local')
    await page.goto(`/o/${ORG}/manage/comissoes`)

    await expect(page).toHaveURL(new RegExp(`/o/${ORG}/manage/comissoes`))
    await expect(page.getByText(/não encontrad/i)).toHaveCount(0)
    // A commission the admin administers is listed by name — the admin nouns survive.
    await expect(page.getByText(/infecção hospitalar/i).first()).toBeVisible()
  })

  test('KEEP: org_admin still reaches the PHI-free aggregate dashboard', async ({ page }) => {
    // D12 ⑥ keeps the aggregates explicitly. This is the other half of the over-cut
    // guard: the wall must not have taken the dashboards with it.
    await cachedSignIn(page, 'orgadmin.a@test.local')
    await page.goto(`/o/${ORG}/c/${COMMISSION}/dashboard`)

    await expect(page).toHaveURL(new RegExp(`/o/${ORG}/c/${COMMISSION}/dashboard`))
  })

  test('keyboard-only: the admin surface is reachable without a mouse', async ({ page }) => {
    // House rule: at least one keyboard-only flow per phase.
    await cachedSignIn(page, 'orgadmin.a@test.local')
    await page.goto(`/o/${ORG}/manage/comissoes`)
    await page.keyboard.press('Tab')
    const focused = page.locator(':focus')
    await expect(focused).toBeVisible()
  })
})

/**
 * QO·B UI half — BUG-QOB-003 (commit 1dfc3fb). The wall spec above pins the
 * DB/RLS boundary; these pin what the browser actually renders for the two
 * shapes `navScope` distinguishes today: a BARE tenancy admin
 * (`"configuration"`) and an unaffected member/coordinator (`"member"`).
 * Route inventory + nav shape verified against
 * src/app/o/[org]/c/[commission]/layout.tsx +
 * src/components/shell/app-sidebar.tsx (commit 1dfc3fb's own NAV_GROUPS +
 * `configuration: true` allowlist), not re-derived by hand.
 *
 * ⚠ A third shape existed pre-ACT: a real member who was ALSO a tenancy admin
 * got the union `"member-and-configuration"` (member items PLUS the KEEP
 * allowlist). ACT (ADR 0106) made that union structurally unreachable — a
 * session wears exactly one hat, and `partitionGrants` routes membership
 * roles and tenancy-admin roles into disjoint buckets — and S4 DELETED the
 * branch that selected it, plus the `SidebarNavScope` union member that named
 * it (commit 7429919, closing QA MINOR-1 of
 * docs/reviews/act-as-stage-3-review.md; ADR 0106 D14). `SidebarNavScope` is
 * now `"member" | "configuration"` only, and
 * src/components/shell/nav-scope-exclusivity.test.ts (Vitest) guards the
 * exclusion that keeps the third shape gone. The describe block below,
 * titled for the deleted case, still earns its keep post-deletion — see its
 * own header comment.
 */

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

const FARMACIA = 'farmacia'
// BUG-ACT-NOTFOUND-COPY-1: a RegExp stem, not the pinned old global string. The
// commission-scoped not-found boundary (src/app/o/[org]/c/[commission]/not-found.tsx,
// ACT ADR 0106's new sibling) reads "Página não encontrada", not the global's
// "Não encontramos esta página." — same pt-BR stem, different exact copy.
// Denial verified independently of copy before this widening: for orgadmin.a on
// EVERY one of CUT_ROUTES (live diagnostic run, all 14), the page rendered this
// exact boundary's OWN distinctive body text ("...você não tem acesso a esta
// comissão.") and its "Voltar ao início" recovery link — signals unique to the
// real denial boundary, not generic 404-shaped text — never the old copy.
const NOT_FOUND_HEADING = /não encontr/i

/** Service-role REST query (DB-truth lookups only — never mutates data under test). */
async function serviceQuery<T>(page: Page, path: string): Promise<T[]> {
  const resp = await page.request.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

/** The 7-item KEEP allowlist a BARE tenancy admin gets, per NAV_GROUPS' `configuration: true` marks. */
const KEEP_NAV_ITEMS = [
  'Visão geral',
  'Construtor',
  'Processos',
  'Indicadores',
  'Trilha de auditoria',
  'Gerenciar',
  'Configurações',
]

/** Every commission-scoped route the QO·B classification CUT for a bare tenancy admin. */
const CUT_ROUTES = [
  'dashboard',
  'dashboard/submissions',
  'manage/assinaturas',
  'manage/documentos',
  'manage/cases',
  'meetings',
  'encaminhamentos',
  'eventos',
  'respostas',
  'manage/charter',
  'manage/acreditacao',
  'minhas-fases',
  'meus-casos',
  'meus-itens-de-acao',
]

test.describe('QO·B UI — bare tenancy admin nav shape (orgadmin.a on ccih)', () => {
  test('nav is EXACTLY the 7-item configuration allowlist, under one honest eyebrow', async ({ page }) => {
    await cachedSignIn(page, 'orgadmin.a@test.local')
    await page.goto(`/o/${ORG}/c/${COMMISSION}`)

    const nav = page.getByRole('navigation', { name: /navegação da comissão/i })
    await expect(nav).toBeVisible({ timeout: 10_000 })

    const names = (await nav.getByRole('link').allTextContents()).map((t) => t.trim())
    expect(names.sort()).toEqual([...KEEP_NAV_ITEMS].sort())

    // Collapsed under "Configuração da comissão" — never the member eyebrows,
    // which would misdescribe a principal holding no membership here.
    await expect(nav.getByText('Configuração da comissão')).toBeVisible()
    await expect(nav.getByText('Coordenação')).toHaveCount(0)
    await expect(nav.getByText('Meu trabalho')).toHaveCount(0)

    // The CUT surface is INVISIBLE, never merely present-but-disabled.
    for (const cut of ['Formulários', 'Minhas respostas', 'Reuniões', 'Painel', 'Documentos', 'Assinaturas']) {
      await expect(nav.getByRole('link', { name: cut })).toHaveCount(0)
    }
    await expect(nav.getByRole('link', { name: /^Casos(\s|$)/ })).toHaveCount(0)
  })

  test('the commission root is a CONFIGURATION landing, never the member overview', async ({ page }) => {
    await cachedSignIn(page, 'orgadmin.a@test.local')
    await page.goto(`/o/${ORG}/c/${COMMISSION}`)

    await expect(page.getByText(/você administra a estrutura desta comissão/i)).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('link', { name: 'Construtor de formulários' })).toBeVisible()

    // The MEMBER overview's own cards must never render for a bare tenancy admin —
    // every one of them links to a surface this principal cannot reach.
    await expect(page.getByText('Casos não concluídos')).toHaveCount(0)
    await expect(page.getByText('Reuniões não concluídas')).toHaveCount(0)
    await expect(page.getByText('Respostas em andamento')).toHaveCount(0)
  })

  test('the form builder opens', async ({ page }) => {
    await cachedSignIn(page, 'orgadmin.a@test.local')
    await page.goto(`/o/${ORG}/c/${COMMISSION}/manage/forms`)
    await expect(page.getByRole('heading', { name: 'Construtor', level: 1 })).toBeVisible({
      timeout: 10_000,
    })
  })

  test('a settings page opens', async ({ page }) => {
    await cachedSignIn(page, 'orgadmin.a@test.local')
    await page.goto(`/o/${ORG}/c/${COMMISSION}/manage/settings`)
    await expect(page).toHaveURL(new RegExp('/manage/settings/desfechos$'))
    await expect(page.getByRole('heading', { name: 'Configurações', level: 1 })).toBeVisible({
      timeout: 10_000,
    })
  })

  test('member management opens, with the add-member affordance', async ({ page }) => {
    await cachedSignIn(page, 'orgadmin.a@test.local')
    await page.goto(`/o/${ORG}/c/${COMMISSION}/manage/members`)
    await expect(page.getByRole('heading', { name: /membros/i, level: 1 })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('button', { name: /adicionar membro/i })).toBeVisible()
  })

  test('the audit trail opens and its CSV export downloads', async ({ page }) => {
    await cachedSignIn(page, 'orgadmin.a@test.local')
    await page.goto(`/o/${ORG}/c/${COMMISSION}/manage/audit`)
    await expect(page.getByRole('heading', { name: 'Trilha de auditoria', level: 1 })).toBeVisible({
      timeout: 10_000,
    })

    const exportLink = page.getByRole('link', { name: /exportar csv/i })
    await expect(exportLink).toBeVisible()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportLink.click(),
    ])
    expect(await download.path()).toBeTruthy()
  })

  test('the indicator detail page renders the DEFINITION and withholds the measurement half (Q3 split)', async ({
    page,
  }) => {
    await cachedSignIn(page, 'orgadmin.a@test.local')
    const rows = await serviceQuery<{ id: string }>(
      page,
      `indicators?commission_id=eq.a0000000-0000-0000-0000-0000000000a1&code=eq.IND-0001&select=id`,
    )
    expect(rows.length, 'IND-0001 seeded for CCIH').toBe(1)
    const id = rows[0].id

    await page.goto(`/o/${ORG}/c/${COMMISSION}/manage/indicadores/${id}`)

    // The DEFINITION renders.
    await expect(
      page.getByRole('heading', { name: 'Adesão à higienização das mãos', level: 1 }),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/90/)).toBeVisible()

    // The MEASUREMENT half is WITHHELD, not empty — neither the trend region nor
    // the CAPA affordance render; an explicit note replaces them.
    await expect(page.getByRole('region', { name: /tendência vs\. meta/i })).toHaveCount(0)
    await expect(page.getByRole('region', { name: /plano de ação/i })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Medições', level: 2 })).toBeVisible()
    await expect(
      page.getByText(/pertencem à comissão e não são exibidos à administração/i),
    ).toBeVisible()
    // No leaked seeded measurement value (84 % is IND-0001's first off-target month).
    await expect(page.getByText('84%')).toHaveCount(0)
  })

  test('every CUT surface 404s, with no content leaked first', async ({ page }) => {
    await cachedSignIn(page, 'orgadmin.a@test.local')

    for (const route of CUT_ROUTES) {
      await page.goto(`/o/${ORG}/c/${COMMISSION}/${route}`)
      // Content-based, never status-code-based: a route below a `loading.tsx`
      // streams 200 before its own `notFound()` resolves (the platform's pinned
      // streamed-notFound contract) — assert the rendered not-found UI.
      await expect(
        page.getByRole('heading', { name: NOT_FOUND_HEADING }),
        `${route} must 404 a bare tenancy admin`,
      ).toBeVisible({ timeout: 10_000 })
    }

    // No leak check on the two content-richest of the above (dashboard aggregates
    // + the submissions browser the WALL test above already exercises row-by-row).
    const body = (await page.locator('body').textContent()) ?? ''
    expect(body).not.toContain('Denúncia Ética')
  })
})

test.describe('QO·B UI — coordinator no-regression (chefe.ccih)', () => {
  test('the coordinator keeps the full nav and every content surface', async ({ page }) => {
    await cachedSignIn(page, 'chefe.ccih@test.local')
    await page.goto(`/o/${ORG}/c/${COMMISSION}`)

    const nav = page.getByRole('navigation', { name: /navegação da comissão/i })
    await expect(nav).toBeVisible({ timeout: 10_000 })
    // A genuine coordinator's nav is grouped under the member eyebrows, never
    // collapsed into the tenancy-admin's single "Configuração da comissão" group —
    // and holds items no `configuration: true` mark ever grants (Casos, Painel).
    await expect(nav.getByText('Coordenação')).toBeVisible()
    await expect(nav.getByText('Configuração da comissão')).toHaveCount(0)
    await expect(nav.getByRole('link', { name: /^Casos(\s|$)/ })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Painel' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Formulários' })).toBeVisible()

    // The commission root is the MEMBER overview, not the configuration landing.
    await expect(page.getByText(/você administra a estrutura desta comissão/i)).toHaveCount(0)

    await page.goto(`/o/${ORG}/c/${COMMISSION}/dashboard`)
    await expect(page).toHaveURL(new RegExp(`/o/${ORG}/c/${COMMISSION}/dashboard$`))
    await expect(page.getByRole('heading', { name: NOT_FOUND_HEADING })).toHaveCount(0)
  })
})

test.describe('QO·B UI — cross-org boundary (orgadmin.b on rede-a)', () => {
  test('orgadmin.b (org_admin of rede-b) still 404s on a rede-a commission', async ({ page }) => {
    await cachedSignIn(page, 'orgadmin.b@test.local', undefined, 'org_admin')
    await page.goto(`/o/${ORG}/c/${COMMISSION}`)

    await expect(page.getByRole('heading', { name: NOT_FOUND_HEADING })).toBeVisible({
      timeout: 10_000,
    })
    const body = (await page.locator('body').textContent()) ?? ''
    expect(body).not.toContain('Configuração da comissão')
    expect(body).not.toContain('Infecção Hospitalar')
  })
})

test.describe('QO·B UI — keyboard-only: reaching a KEEP surface without a mouse', () => {
  test('orgadmin.a tabs to "Gerenciar" and activates it with Enter', async ({ page }) => {
    await cachedSignIn(page, 'orgadmin.a@test.local')
    await page.goto(`/o/${ORG}/c/${COMMISSION}`)

    const nav = page.getByRole('navigation', { name: /navegação da comissão/i })
    const link = nav.getByRole('link', { name: 'Gerenciar' })
    await expect(link).toBeVisible({ timeout: 10_000 })
    await link.focus()
    await expect(link).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(new RegExp(`/o/${ORG}/c/${COMMISSION}/manage/members$`), {
      timeout: 10_000,
    })
    await expect(page.getByRole('heading', { name: /membros/i, level: 1 })).toBeVisible()
  })
})

test.describe.serial(
  'QO·B UI — the member-and-configuration nav case, proven unreachable per hat (scope DELETED in ACT S4 / commit 7429919; manufactured via the real member-add door)',
  () => {
    // No seed persona holds BOTH a bare `staff` membership AND tenancy-admin
    // standing in the SAME commission. `orgadmin.b`/"Qualidade B" comes close
    // but is `staff_admin` there — which already carries every KEEP item via
    // its OWN `roles` array, so it never exercises `navScope`'s actual
    // differentiator: a `staff` role additionally gaining the KEEP allowlist
    // purely from `configuration: true`, independent of `roles`. Manufactured
    // here through the real coordinator UI (the `AddMemberPicker` door,
    // `addStaff` — always adds role 'staff'), on FARMÁCIA (rede-a) rather than
    // CCIH, so no other spec's "orgadmin.a holds zero CCIH memberships"
    // assumption (cases-board-access.spec.ts, this file's own WALL tests) is
    // disturbed. Torn down by IDENTITY — the row matching the target's e-mail,
    // never a positional `.first()` (memory: a positional cleanup once ate
    // seed rows and cascaded 140 reds).
    const TARGET_EMAIL = 'orgadmin.a@test.local'

    test.afterAll(async ({ browser }) => {
      // Guaranteed cleanup even if an assertion above threw mid-test — a
      // stray membership here would spuriously fail every OTHER spec that
      // assumes orgadmin.a holds none.
      const page = await browser.newPage()
      try {
        await cachedSignIn(page, 'chefe.farm@test.local')
        await page.goto(`/o/${ORG}/c/${FARMACIA}/manage/members`)
        const row = page.locator('li').filter({ hasText: TARGET_EMAIL })
        if ((await row.count()) > 0) {
          await row.getByRole('button', { name: /remover/i }).click()
          const dialog = page.getByRole('alertdialog')
          await dialog.getByRole('button', { name: 'Remover', exact: true }).click()
          await expect(page.locator('li').filter({ hasText: TARGET_EMAIL })).toHaveCount(0, {
            timeout: 10_000,
          })
        }
      } finally {
        await page.close()
      }
    })

    test('setup: add orgadmin.a as a plain staff member of Farmácia via the real door', async ({
      page,
    }) => {
      await cachedSignIn(page, 'chefe.farm@test.local')
      await page.goto(`/o/${ORG}/c/${FARMACIA}/manage/members`)

      await page.getByRole('button', { name: /adicionar membro/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 10_000 })
      await dialog.getByLabel('Buscar pessoa').fill('orgadmin.a')

      const candidates = dialog.getByRole('list', { name: 'Pessoas cadastradas disponíveis' })
      const candidate = candidates.getByRole('listitem').filter({ hasText: TARGET_EMAIL })
      await expect(candidate).toBeVisible({ timeout: 10_000 })
      await candidate.getByRole('button').click()
      await dialog.getByRole('button', { name: 'Adicionar', exact: true }).click()
      await expect(dialog.getByText('Usuário adicionado à comissão com sucesso.')).toBeVisible({
        timeout: 10_000,
      })
      await page.keyboard.press('Escape')

      await expect(page.locator('li').filter({ hasText: TARGET_EMAIL })).toBeVisible({
        timeout: 10_000,
      })
    })

    // ACT ADR 0106 (D5/D12) RE-SCOPE — the original test here asserted the UNION
    // nav ("member-and-configuration": member items PLUS the KEEP allowlist) in a
    // single hatless session. Under strict role assumption that union is
    // STRUCTURALLY unreachable: the staff hat filters out the tenancy-admin
    // grants (isTenancyAdmin=false) and the org_admin hat filters out the
    // membership (role=null) — no single hat satisfies both conditions at once.
    // `navScope="member-and-configuration"` was a dead branch in layout.tsx for
    // exactly this reason, and ACT S4 has since DELETED it — along with the
    // `SidebarNavScope` union member that named it — rather than leaving it
    // dead (commit 7429919, closing QA MINOR-1 of
    // docs/reviews/act-as-stage-3-review.md; ADR 0106 D14). The removal's own
    // regression guard lives in
    // src/components/shell/nav-scope-exclusivity.test.ts (Vitest), driven off
    // the live `memberships_role_check` vocabulary — outside this file's
    // concern, but the reason a widening would be caught before it ever
    // reached a browser. The two tests below still earn their keep
    // post-deletion: no E2E can assert a branch that no longer exists, so
    // they instead prove each hat's nav individually AND — by each asserting
    // the ABSENCE of the other scope's items — that the combined nav this
    // describe block is named for genuinely cannot occur, the same shape the
    // PO ruled for AC-5b/Flow 3d/5a.
    test('under the staff hat: member nav only — the KEEP allowlist does NOT ride along', async ({
      page,
    }) => {
      await cachedSignIn(page, 'orgadmin.a@test.local', undefined, 'staff')
      await page.goto(`/o/${ORG}/c/${FARMACIA}`)

      const nav = page.getByRole('navigation', { name: /navegação da comissão/i })
      await expect(nav).toBeVisible({ timeout: 10_000 })

      // MEMBER items a plain `staff` role always gets...
      await expect(nav.getByRole('link', { name: 'Formulários' })).toBeVisible()
      await expect(nav.getByRole('link', { name: 'Minhas respostas' })).toBeVisible()
      // ...and NO KEEP configuration item — the org_admin grant is inactive
      // under this hat, and a `staff` role's OWN `roles` array never has these.
      await expect(nav.getByText('Configuração da comissão')).toHaveCount(0)
      await expect(nav.getByRole('link', { name: 'Construtor' })).toHaveCount(0)
      await expect(nav.getByRole('link', { name: 'Gerenciar' })).toHaveCount(0)
      await expect(nav.getByRole('link', { name: 'Configurações' })).toHaveCount(0)

      // Coordinator-only items stay absent under any reading — role is `staff`.
      await expect(nav.getByRole('link', { name: /^Casos(\s|$)/ })).toHaveCount(0)
      await expect(nav.getByRole('link', { name: 'Painel' })).toHaveCount(0)

      // A held (active-hat) membership means `role !== null` — the commission
      // root shows the MEMBER overview, never the configuration landing.
      await expect(
        page.getByText(/você administra a estrutura desta comissão/i),
      ).toHaveCount(0)
    })

    test('under the org_admin hat: configuration nav only — the membership does NOT ride along', async ({
      page,
    }) => {
      await cachedSignIn(page, 'orgadmin.a@test.local', undefined, 'org_admin')
      await page.goto(`/o/${ORG}/c/${FARMACIA}`)

      const nav = page.getByRole('navigation', { name: /navegação da comissão/i })
      await expect(nav).toBeVisible({ timeout: 10_000 })

      // The bare-tenancy-admin KEEP allowlist...
      await expect(nav.getByText('Configuração da comissão')).toBeVisible()
      await expect(nav.getByRole('link', { name: 'Construtor' })).toBeVisible()
      await expect(nav.getByRole('link', { name: 'Gerenciar' })).toBeVisible()
      await expect(nav.getByRole('link', { name: 'Configurações' })).toBeVisible()
      // ...and NO member content item — the staff membership is inactive under
      // this hat, so the union nav the pre-ACT test pinned is provably gone.
      await expect(nav.getByRole('link', { name: 'Formulários' })).toHaveCount(0)
      await expect(nav.getByRole('link', { name: 'Minhas respostas' })).toHaveCount(0)

      // The commission root is the configuration landing for a bare tenancy admin.
      await expect(
        page.getByText(/você administra a estrutura desta comissão/i),
      ).toBeVisible()
    })
  },
)

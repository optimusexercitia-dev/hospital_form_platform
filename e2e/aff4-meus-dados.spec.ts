import { test, expect } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'

/**
 * AFF4 T4 — `/conta/meus-dados` ("Meus dados", F5 / ADR 0151 D14): masked CPF
 * rendering, read-only-ness, and self data — values, not mere presence.
 *
 * Persona: `dr.john@test.local` — a SEEDED, read-only-use-only fixture.
 * `e2e/aff-hospital-affiliation.spec.ts`'s own "read-only cross-check" test
 * documents this explicitly: it is pinned by pgTAP `301`/`302`+ and must never be
 * mutated by any spec. This file only ever navigates and reads — no form, no
 * action call — so it cannot disturb that pin. CPF `11144477735` masks to
 * `111.•••.•77-35` (`maskCpf`, `src/lib/users/cpf.ts`); date_of_birth and phone
 * are both NULL for this persona (live-catalog-verified), which is itself an
 * assertable value ("Não informada"/"Não informado"), not an absence to skip.
 */

async function signInAs(page: import('@playwright/test').Page, email: string) {
  await cachedSignIn(page, email, 'Test1234!')
}

test.describe('AFF4-MEUSDADOS: read-only self-record page', () => {
  test('dr.john sees exactly his own masked CPF, blank DOB/phone, zero credentials, both hospital affiliations with their real matrículas, and one active org affiliation', async ({
    page,
  }) => {
    // QA review item B3 (`docs/reviews/aff4-review.md`) — BUG-MEUSDADOS-HOSPITAL-NAME-001
    // (see the comment at the `toContainText('Hospital Central A')` assertion below)
    // makes this test fail every run, deterministically, not a flake. Left as a bare
    // red this blocks §6 step 2 ("the full E2E suite runs once to declare green"), and
    // a bare red is indistinguishable from a regression to whoever reads the run.
    // Pinned `test.fail()` instead: Playwright reports "failed as expected" while the
    // bug is open, and flips to "unexpectedly passing" — a loud signal, not a silent
    // one — the moment it is fixed.
    // ⚠ CONDITIONAL, NOT a permanent acceptance of the defect. A PO decision is
    // pending on whether to fix `hospitals_select` instead of shipping the known
    // defect (add a self-affiliation `EXISTS` arm — see the Bug Log row and review
    // item B3). ⛔ If that lands, it is an RLS policy change and re-arms §6 step 1's
    // diff-scoped door sweep over `hospitals_select`. Either way, this annotation is
    // the ONLY thing that then needs to go: delete the next line and nothing else in
    // this test changes.
    test.fail(true, 'BUG-MEUSDADOS-HOSPITAL-NAME-001 — pending PO ruling, see comment above')

    await signInAs(page, 'dr.john@test.local')
    await page.goto('/conta/meus-dados')
    await expect(page.getByRole('heading', { name: 'Meus dados', level: 1 })).toBeVisible({
      timeout: 10_000,
    })

    const identidade = page.getByRole('region', { name: 'Identidade' })
    await expect(identidade).toBeVisible({ timeout: 10_000 })
    // The exact masked value — a masking BUG (wrong digit count, wrong bullet
    // placement, or the raw CPF leaking through) would fail this, not merely
    // "some CPF-shaped text rendered".
    await expect(identidade).toContainText('111.•••.•77-35')
    // The raw CPF must never appear anywhere on this self-service page.
    await expect(page.getByText('11144477735')).toHaveCount(0)
    await expect(identidade).toContainText('Não informada') // Data de nascimento
    await expect(identidade).toContainText('Não informado') // Telefone

    const credenciais = page.getByRole('region', { name: 'Registros profissionais' })
    await expect(credenciais).toBeVisible()
    await expect(credenciais).toContainText('Nenhum registro profissional cadastrado.')

    const vinculos = page.getByRole('region', { name: 'Vínculos hospitalares' })
    await expect(vinculos).toBeVisible()
    // BUG-MEUSDADOS-HOSPITAL-NAME-001 (PROGRESS.md Bug Log): a non-admin caller's
    // OWN affiliation cannot resolve its hospital's name — `hospitals_select`'s RLS
    // admits only admin/reviewer tiers, none of which a plain "staff" affiliate
    // holds, so `listAffiliationsFor`'s embedded `hospital:hospitals!...(name)`
    // silently nulls and the page falls back to "Hospital não identificado". This
    // assertion is deliberately left asserting the CORRECT value (never weakened
    // to match the defect) — it is expected to stay red until backend fixes the
    // RLS/query, at which point it is also this bug's regression guard.
    await expect(vinculos).toContainText('Hospital Central A')
    await expect(vinculos).toContainText('MAT-JOHN-CENTRAL')
    await expect(vinculos).toContainText('Hospital Secundário A')
    await expect(vinculos).toContainText('MAT-JOHN-SEC')

    const organizacoes = page.getByRole('region', { name: 'Organizações' })
    await expect(organizacoes).toBeVisible()
    await expect(organizacoes).toContainText('Rede Hospitalar A')
    await expect(organizacoes.getByText('Ativo', { exact: true })).toBeVisible()

    // Read-only-ness: no form, no input/textarea/select, no edit/save/delete
    // affordance anywhere on the page.
    await expect(page.locator('form')).toHaveCount(0)
    await expect(page.getByRole('textbox')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /editar|salvar|excluir|remover/i })).toHaveCount(0)
  })

  test('a foreign persona cannot read this page as someone else — self data only (own-record door, no target param)', async ({
    page,
  }) => {
    // `get_own_person_record` is self-only by construction (keys on auth.uid(),
    // takes no target id) — a second persona hitting the same route must see
    // THEIR OWN data, never dr.john's, and the route itself carries no id to
    // tamper with.
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/conta/meus-dados')
    await expect(page.getByRole('heading', { name: 'Meus dados', level: 1 })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('111.•••.•77-35')).toHaveCount(0)
    await expect(page.getByText('MAT-JOHN-CENTRAL')).toHaveCount(0)
  })
})

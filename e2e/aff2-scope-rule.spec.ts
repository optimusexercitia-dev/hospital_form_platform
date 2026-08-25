import { test, expect } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import { uniqueCpf } from './helpers/cpf'

/**
 * AFF2 T2 — the affiliation-scoped administration authority rule end to end.
 *
 * ADR 0133 Decisions 1-4 + Amendment 1 ruling 1: a hospital_admin's authority over a
 * target person now splits by CAPABILITY, not by person:
 *   - `fields` (name/category/DOB/phone) and `credentials` widen to FOOTPRINT
 *     INTERSECTION — any hospital the caller administers that the target's footprint
 *     touches is enough.
 *   - `cpf_change` and `lifecycle` (deactivate/reactivate/suspend) keep the SUBSET
 *     bound — the target's ENTIRE footprint must be inside the caller's administered
 *     set.
 *   - Any org-tier or hospital-tier membership on the target, OR an empty footprint,
 *     denies every capability outright (Decision 2) regardless of hospital overlap.
 *
 * Fixtures, chosen by COMPUTING footprints against the live catalog (not by persona
 * name — measured 2026-08-23):
 *   - Caller: hospitaladmin.a1@test.local, administers Hospital Central A ONLY.
 *   - Differential caller: orgadmin.a@test.local (org_admin — every capability,
 *     unconditionally).
 *   - Sole-footprint target: registered FRESH by hospitaladmin.a1's own wizard
 *     (hospital pre-locked) — guaranteed sole-footprint BY CONSTRUCTION rather than by
 *     a fact about the seed that could drift. Freely mutated (edited, deactivated,
 *     reactivated) since nothing else in this suite depends on it.
 *   - Cross-hospital target: dr.john@test.local (footprint = Central A + Secundário A
 *     — the pinned T3.5 fixture other pgTAP suites assert against BY NUMBER).
 *     READ-ONLY here: opened for inspection, never submitted.
 *   - Hospital-tier-at-own-hospital target: dt.a@test.local (technical_director @
 *     Central A — the sharp Decision-2 case: a seat at the CALLER'S OWN hospital still
 *     denies every capability). READ-ONLY.
 *   - Zero-footprint target: registered FRESH by org_admin with BOTH step 2 (Vínculo
 *     hospitalar) and step 3 (Comissões) skipped.
 *
 * ⚠ PREMISE CORRECTED (verified against the live `pg_policies` catalog, not assumed):
 * "an unaffiliated person renders with the full note and no affordances" is NOT
 * reachable as a rendered page. `profiles_select_self_or_admin` / `profiles_admin_select`
 * admit a hospital_admin only via an active `hospital_affiliations` row OR a
 * `memberships` row (hospital- or commission-tier) at an administered hospital — a
 * genuinely empty-footprint person satisfies NEITHER leg, so `getOrgUser`'s RLS-scoped
 * read returns nothing and the page 404s before `getPersonAdminView` is ever consulted
 * — the identical mechanism as the pre-existing AFF-3 sibling-hospital negative, just
 * emptier. The "renders with the full note" DENY case is carried by dt.a instead (the
 * ADR's own "sharp" D2 example), which the profiles policy DOES admit via the
 * hospital-tier membership leg.
 *
 * ⚠ SCOPE, DELIBERATE: DOB/Telefone are asserted PRESENT + ENABLED for ALLOW targets,
 * never filled — `DatePicker` is a calendar popover (react-day-picker), not a plain
 * `<input type="date">`, and driving it precisely is unrelated to what this spec exists
 * to prove (the capability split, not per-field data plumbing — F3's own build-time
 * checks already cover DOB/phone surviving the wizard). The "assert the value, not a
 * toast" rigor this file DOES apply is spent on Nome (trivial fill+reload), CPF (the
 * ADR's own novel widening — service-role read, since D12 renders it presence-only),
 * and lifecycle (status badge, independent confirmation).
 *
 * ⚠ KNOWN, FILED, NOT WORKED AROUND: BUG-AFF2-PROFILE-SAVE-BANNER-UNMOUNTS means the
 * "Perfil atualizado." banner is never visible (mounts and unmounts in the same React
 * commit). This file does not assert on it — it verifies persistence via reload / a
 * service-role read instead, which is the established "assert the value" idiom in this
 * suite regardless of the banner bug.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}

const DR_JOHN_UID = '00000000-0000-0000-0000-0000000000a1'
const DR_JOHN_CPF = '11144477735'
const DT_A_UID = '00000000-0000-0000-0000-0000000000f1'

/**
 * ⚠ THE EDITORS ARE MODALS SINCE `2f6b0635` (redesign 3a/3b), and that changes what a
 * scoped lookup means, not merely where it points. `DialogContent` portals to
 * `document.body`, so `region.getByLabel('CPF')` resolves to ZERO elements once a
 * control moves into a dialog — an ALLOW assertion turns red, and (the dangerous half) a
 * DENY assertion turns green FOR THE WRONG REASON. Every capability check below
 * therefore names the surface it means: the CARD for what the page states about the
 * caller's authority, the DIALOG for the fields that authority admits.
 *
 * ⛔ The credentials trigger's accessible name is its `aria-label`, NOT its visible text
 * ("Editar"), because three cards on this page now offer an "Editar". A DENY check
 * written against the retired "Cadastrar registro profissional" would pass forever
 * without ever being able to fail — the ADR 0078 "keystone that could not fail" trap,
 * arrived at by a UI rename rather than a policy change.
 */
const CREDENTIALS_TRIGGER = 'Editar registros profissionais'

/** Dialog 3a — "Editar dados pessoais", portaled out of the Dados pessoais card. */
function personalDataDialog(page: import('@playwright/test').Page) {
  return page.getByRole('dialog', { name: 'Editar dados pessoais' })
}

async function signInAs(page: import('@playwright/test').Page, email: string) {
  await cachedSignIn(page, email, 'Test1234!')
}

/** Service-role REST read of a profile's raw `cpf` column — bypasses the write-only
 * column-lock posture (D12) to confirm a change actually landed, the same "assert the
 * value via the service role" idiom aff-hospital-affiliation.spec.ts already uses for
 * `memberships`/`hospital_affiliations` (same fixture shape: the `playwright.request`
 * factory, not the bare `request` context fixture — `APIRequest` is what carries
 * `newContext()`). */
async function readProfileCpf(
  apiRequest: import('@playwright/test').APIRequest,
  userId: string,
): Promise<string | null> {
  const ctx = await apiRequest.newContext()
  try {
    const res = await ctx.get(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=cpf`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      },
    )
    expect(res.ok()).toBeTruthy()
    const rows = (await res.json()) as { cpf: string | null }[]
    return rows[0]?.cpf ?? null
  } finally {
    await ctx.dispose()
  }
}

/** Fills the (fresh, sole-hospital) wizard's step-1 fields and walks Continuar to the
 * end, submitting with no hospital interaction and no committee — the shape every
 * fixture-creation test in this file needs, whether the caller is a locked
 * hospital_admin or an org_admin. Returns the created person's profile URL userId. */
async function registerFreshPersonAllStepsDefault(
  page: import('@playwright/test').Page,
  fullName: string,
  email: string,
): Promise<string> {
  await page.getByRole('textbox', { name: 'CPF' }).fill(uniqueCpf())
  await page.getByRole('button', { name: /buscar pessoa/i }).click()
  await expect(page.getByLabel('Nome completo')).toBeVisible({ timeout: 10_000 })

  await page.getByLabel('Nome completo').fill(fullName)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha inicial').fill('Test1234!')
  const categorySelect = page.getByLabel('Categoria profissional')
  const opts = await categorySelect.locator('option').all()
  const firstReal = await opts[1].getAttribute('value')
  if (firstReal) await categorySelect.selectOption(firstReal)

  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: /registrar pessoa/i }).click()
  // Must positively match a UUID — the pre-submit URL is already "/usuarios/novo",
  // which would trivially satisfy a looser `[^/]+$` pattern with no navigation at all.
  await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/i, { timeout: 15_000 })
  return page.url().match(/\/usuarios\/([0-9a-f-]{36})/i)?.[1] ?? ''
}

test.describe('AFF2-SCOPE: sole-hospital target — hospitaladmin.a1 gets every capability', () => {
  test('fields, CPF, credential and lifecycle all ALLOW on a person created within the caller\'s own footprint, and each persists', async ({
    page,
    playwright,
  }) => {
    const ts = Date.now()
    const fullName = `AFF2 Scope Sole ${ts}`
    const email = `aff2.scope.sole.${ts}@test.local`

    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto('/o/rede-a/manage/usuarios/novo')
    // hospitaladmin.a1's hospital is LOCKED (no chooser) — the affiliation is created
    // regardless (D8), guaranteeing this person's footprint is exactly {Central A}.
    const soleUserId = await registerFreshPersonAllStepsDefault(page, fullName, email)
    expect(soleUserId).toBeTruthy()

    // ---- fields + CPF: open dialog 3a once, edit both, save once. ----
    const dadosPessoais = page.getByRole('region', { name: 'Dados pessoais' })
    await dadosPessoais.getByRole('button', { name: 'Editar', exact: true }).click()
    const personalDialog = personalDataDialog(page)
    await expect(personalDialog).toBeVisible({ timeout: 10_000 })

    // Amdt 1 r1 — the SUBSET bound is what admits the CPF field here, since this
    // target's footprint is a subset of (not merely intersects) the caller's.
    const cpfInput = personalDialog.getByLabel('CPF', { exact: true })
    await expect(cpfInput).toBeVisible({ timeout: 10_000 })
    // Presence-only in the read state; the edit control itself is write-only and
    // must never carry the CURRENT digits — D12 applies to admins editing too.
    await expect(cpfInput).toHaveValue('')

    // Intersection-editable fields are reachable (not filled — see file header).
    await expect(personalDialog.getByLabel('Nascimento')).toBeEnabled()
    await expect(personalDialog.getByLabel('Telefone')).toBeEnabled()

    const editedName = `${fullName} (editado)`
    await personalDialog.getByLabel('Nome completo').fill(editedName)
    const newCpf = uniqueCpf()
    await cpfInput.fill(newCpf)
    await personalDialog.getByRole('button', { name: /salvar alterações/i }).click()
    await expect(personalDialog).not.toBeVisible({ timeout: 15_000 })

    // BUG-AFF2-PROFILE-SAVE-BANNER-UNMOUNTS, FIXED (`d23d1045`) — the confirmation
    // lives in `PersonalDataCard`, which survives the editor going away. Asserted here
    // on purpose, not skipped: the fix's own remaining risk is `router.refresh()` —
    // called BEFORE `onSaved()` in `personal-data-dialog.tsx` — REMOUNTING
    // `PersonalDataCard` instead of reconciling it in place, which would reset `saved`
    // to `false` by a different route to the identical silence. This assertion is the
    // only thing that can catch that; a value-only check (skipping straight to reload)
    // cannot, because the value persists either way. If this reds, it is a REAL
    // regression to re-open the bug on — not a reason to relax back to a reload-only
    // check.
    //
    // ⚠ The hazard got SHARPER with the redesign, not softer: the editor is a MODAL
    // now (3a) and closing one unmounts its entire subtree, so the banner is only
    // reachable at all because it was deliberately parked in the card. Scoped to the
    // card for exactly that reason — a page-wide match would go green on a banner that
    // had (wrongly) moved back into some other surface.
    await expect(dadosPessoais.getByText('Perfil atualizado.')).toBeVisible({
      timeout: 10_000,
    })

    // Assert the VALUE too, via reload — a visible banner is not proof the ROW changed.
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(editedName)
    await expect(await readProfileCpf(playwright.request, soleUserId)).toBe(newCpf)

    // ---- credential: ALLOW admits the live editor (3b), not the read-only summary. ----
    const registros = page.getByRole('region', { name: 'Registros profissionais' })
    await registros.getByRole('button', { name: CREDENTIALS_TRIGGER }).click()
    const credentialsDialog = page.getByRole('dialog', {
      name: 'Editar registros profissionais',
    })
    await expect(credentialsDialog).toBeVisible({ timeout: 10_000 })
    const credentialNumber = `E2E-${ts}`
    // Conselho/UF are <select>s in 3b (they were free-text before), so they are driven
    // as selects — `fill()` on a <select> throws rather than silently doing nothing,
    // which is the only reason this drift was ever visible.
    await credentialsDialog.getByLabel('Conselho').selectOption('CRM')
    await credentialsDialog.getByLabel('UF').selectOption('SP')
    await credentialsDialog.getByLabel('Número').fill(credentialNumber)
    await credentialsDialog.getByRole('button', { name: /salvar registros/i }).click()
    await expect(credentialsDialog).not.toBeVisible({ timeout: 15_000 })
    await expect(registros.getByText(credentialNumber)).toBeVisible({ timeout: 10_000 })
    await page.reload()
    await expect(
      page.getByRole('region', { name: 'Registros profissionais' }).getByText(credentialNumber),
    ).toBeVisible({ timeout: 10_000 })

    // ---- lifecycle: deactivate then reactivate, each persisted through a reload. ----
    //
    // ⚠ SCOPED TO THE IDENTITY BAND. "Ativo" is no longer unique on this page: every
    // ACTIVE AFFILIATION row now carries an "Ativo" status pill, and this person has
    // one by construction (D8 forced the wizard to affiliate them). An unscoped
    // `getByText('Ativo', { exact: true })` therefore matches the account badge AND the
    // affiliation pill — two different facts that must not be allowed to stand in for
    // each other, since ending a hospital vínculo is precisely the thing that does NOT
    // deactivate an account. The band is where the ACCOUNT's status lives.
    const identityBand = page
      .getByRole('region')
      .filter({ has: page.getByRole('heading', { level: 1 }) })

    await identityBand.getByRole('button', { name: /^Desativar$/ }).click()
    const deactivateDialog = page.getByRole('alertdialog')
    await expect(deactivateDialog).toBeVisible({ timeout: 5_000 })
    await deactivateDialog.getByRole('button', { name: /^Desativar$/ }).click()
    await expect(deactivateDialog).not.toBeVisible({ timeout: 10_000 })
    await expect(identityBand.getByText('Desativado', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await page.reload()
    await expect(identityBand.getByText('Desativado', { exact: true })).toBeVisible({
      timeout: 10_000,
    })

    await identityBand.getByRole('button', { name: /^Reativar$/ }).click()
    const reactivateDialog = page.getByRole('alertdialog')
    await expect(reactivateDialog).toBeVisible({ timeout: 5_000 })
    await reactivateDialog.getByRole('button', { name: /^Reativar$/ }).click()
    await expect(reactivateDialog).not.toBeVisible({ timeout: 10_000 })
    await expect(identityBand.getByText('Ativo', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await page.reload()
    await expect(identityBand.getByText('Ativo', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
  })
})

test.describe('AFF2-SCOPE: cross-hospital target (dr.john) — the split, and the two-caller differential', () => {
  // dr.john is READ-ONLY throughout this describe block — a pinned T3.5 fixture other
  // pgTAP suites assert against BY NUMBER (aff-hospital-affiliation.spec.ts's own
  // header note). Both tests open dialog 3a to inspect it, then Cancelar rather than
  // Salvar.

  test('hospitaladmin.a1: fields/credentials ALLOW, CPF/lifecycle DENY, on the SAME target — the split, not two separate rules', async ({
    page,
  }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto(`/o/rede-a/manage/usuarios/${DR_JOHN_UID}`)

    const dadosPessoais = page.getByRole('region', { name: 'Dados pessoais' })
    // The split, in the admin's own words — read on the CLOSED (read-only) card, where
    // `PersonalDataCard` actually renders it (the `else` branch, not inside the form).
    await expect(
      dadosPessoais.getByText(
        'Esta pessoa atua em mais de um hospital. Alterações de CPF e a desativação ou reativação da conta são da administração da organização.',
      ),
    ).toBeVisible({ timeout: 10_000 })

    await dadosPessoais.getByRole('button', { name: 'Editar', exact: true }).click()
    const personalDialog = personalDataDialog(page)
    await expect(personalDialog).toBeVisible({ timeout: 10_000 })
    // INTERSECTION bound: dr.john's footprint (Central A + Secundário A) intersects
    // hospitaladmin.a1's administered set (Central A) — fields ALLOW.
    await expect(personalDialog.getByLabel('Nome completo')).toBeEnabled()
    await expect(personalDialog.getByLabel('Nascimento')).toBeEnabled()
    await expect(personalDialog.getByLabel('Telefone')).toBeEnabled()
    // SUBSET bound: dr.john's footprint is NOT a subset of {Central A} — no CPF field
    // inside the form at all (not merely disabled).
    //
    // ⛔ THIS DENY IS ONLY MEANINGFUL BECAUSE THE THREE ALLOWs ABOVE SHARE ITS SCOPE.
    // Asked of the CARD, `getByLabel('CPF')` would now return 0 for every caller alive
    // — the field is portaled into the dialog — and the check would be unfalsifiable.
    // The sibling test proves the same locator DOES resolve for org_admin, which is
    // what keeps this one honest.
    await expect(personalDialog.getByLabel('CPF', { exact: true })).toHaveCount(0)
    await personalDialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(personalDialog).not.toBeVisible({ timeout: 10_000 })

    // Credentials: canEditPerson admits the LIVE editor (3b), not the read-only
    // summary — dr.john has zero credentials seeded, so the tell is the edit
    // affordance, not any particular row.
    const registros = page.getByRole('region', { name: 'Registros profissionais' })
    await expect(registros.getByRole('button', { name: CREDENTIALS_TRIGGER })).toBeVisible()
    // ...and "no credentials" reads as exactly that, never as "withheld" (D13 / trap
    // B2). The affordance and the empty-state wording have to be TRUE TOGETHER: either
    // alone is compatible with the ambiguity the widening was meant to remove.
    await expect(
      registros.getByText('Nenhum registro profissional cadastrado.'),
    ).toBeVisible()

    // Lifecycle: zero buttons, plus the identity band's OWN (separately computed, same
    // verdict) restriction note. Scoped to <main> — the account menu in the sidebar
    // shows the SIGNED-IN caller's own role label ("Administração da organização" for
    // an org_admin elsewhere in this file), an unrelated false-positive substring match
    // for an unscoped page-wide search.
    const main = page.getByRole('main')
    await expect(main.getByRole('button', { name: /^Desativar$/ })).toHaveCount(0)
    await expect(main.getByRole('button', { name: /^Suspender$/ })).toHaveCount(0)
    await expect(
      main.getByText(/é feito por um administrador da organização/i),
    ).toBeVisible()

    // Invariants that hold regardless of the split: the section keeps its name, and no
    // CPF digit reaches the page under either bound.
    await expect(page.getByRole('region', { name: 'Vínculos hospitalares' })).toBeVisible()
    await expect(page.getByText(DR_JOHN_CPF)).toHaveCount(0)
  })

  test('orgadmin.a on the SAME dr.john: every capability, and CPF stays presence-only even for the caller who CAN change it', async ({
    page,
  }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto(`/o/rede-a/manage/usuarios/${DR_JOHN_UID}`)

    const dadosPessoais = page.getByRole('region', { name: 'Dados pessoais' })
    await dadosPessoais.getByRole('button', { name: 'Editar', exact: true }).click()
    const personalDialog = personalDataDialog(page)
    await expect(personalDialog).toBeVisible({ timeout: 10_000 })

    // The differential: the SAME person, a DIFFERENT caller, and now the CPF field —
    // and the lifecycle buttons — are both present. This is what proves the split
    // tracks the CALLER's footprint, not a property of dr.john.
    const cpfInput = personalDialog.getByLabel('CPF', { exact: true })
    await expect(cpfInput).toBeVisible({ timeout: 10_000 })
    // D12 is presence-only for EVERY caller, including one who may change it — the
    // field is write-only and must load blank, never dr.john's real digits.
    await expect(cpfInput).toHaveValue('')
    await personalDialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(personalDialog).not.toBeVisible({ timeout: 10_000 })

    // Scoped to <main> — the account menu names the SIGNED-IN caller's own role
    // ("Administração da organização" for orgadmin.a), an unrelated substring match
    // for a page-wide search that has nothing to do with dr.john's restrictions.
    const main = page.getByRole('main')
    await expect(main.getByRole('button', { name: /^Desativar$/ })).toBeVisible()
    await expect(main.getByRole('button', { name: /^Suspender$/ })).toBeVisible()
    // The SPLIT NOTE is retired for this caller — nothing names a restriction that does
    // not apply to them.
    //
    // ⚠ ASSERTED ON THE SENTENCE, NOT ON THE PHRASE "administração da organização". The
    // redesign gave the card a permanent footnote ("Fatos sobre a pessoa — editáveis
    // apenas pela administração da organização.", handoff 2a rail), which contains that
    // phrase for EVERY caller and is a statement about who owns the fields, not a
    // restriction on the person reading it. A regex broad enough to catch the footnote
    // stops being able to tell the two apart — and the thing under test is the note in
    // the sibling test above, verbatim.
    await expect(
      main.getByText(
        'Esta pessoa atua em mais de um hospital. Alterações de CPF e a desativação ou reativação da conta são da administração da organização.',
      ),
    ).toHaveCount(0)
    await expect(
      main.getByText(/é feito por um administrador da organização/i),
    ).toHaveCount(0)

    // No CPF digit anywhere on the page, this caller included.
    //
    // ⚠ ADR 0144 moved the rail's CPF from presence-only to a server-computed MASK
    // (`111.•••.•77-35`). That is a deliberate widening and this assertion survives it
    // unchanged, because it looks for the UNBROKEN 11-digit string — which the mask, by
    // construction, never reconstitutes.
    await expect(page.getByText(DR_JOHN_CPF)).toHaveCount(0)
  })
})

test.describe('AFF2-SCOPE: hospital-tier-at-own-hospital target (dt.a) — full DENY, the sharp Decision-2 case', () => {
  test('hospitaladmin.a1: a technical_director AT THE CALLER\'S OWN HOSPITAL still denies every capability, with the withheld note — never "Não informado"', async ({
    page,
  }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto(`/o/rede-a/manage/usuarios/${DT_A_UID}`)

    const dadosPessoais = page.getByRole('region', { name: 'Dados pessoais' })
    await expect(dadosPessoais).toBeVisible({ timeout: 10_000 })
    // WITHHELD, not empty: no Editar affordance exists to reveal a form that would
    // otherwise show "Não informado" for a person who may well have a birth date.
    // `exact` — the card's own trigger is a bare "Editar", and a substring match would
    // silently widen this DENY to the other cards' triggers on a future layout change.
    await expect(
      dadosPessoais.getByRole('button', { name: 'Editar', exact: true }),
    ).toHaveCount(0)
    await expect(
      dadosPessoais.getByText(
        'Os dados pessoais desta pessoa são administrados pela organização. O vínculo com o seu hospital e a matrícula você gerencia em “Vínculos hospitalares”.',
      ),
    ).toBeVisible()
    await expect(dadosPessoais.getByText('Não informado')).toHaveCount(0)

    // Credentials: read-only summary, never the live editor — the "empty means
    // no-permission" trap B2 exists to close (the caption states the reason, the
    // section never simply vanishes).
    //
    // ⛔ THIS DENY WAS SILENTLY DEFANGED BY THE REDESIGN and is repaired here, not
    // merely re-pointed. It named "Cadastrar registro profissional", a control the
    // `2f6b0635` rename retired everywhere — so it had become a check that could not
    // fail for any caller, on any target, ever: exactly the ADR 0078 keystone trap,
    // reached through a UI rename instead of a policy edit. The name it asserts now is
    // the SAME one the ALLOW arm above proves is present for hospitaladmin.a1 over
    // dr.john, so the two arms can only both hold if the capability really differs.
    const registros = page.getByRole('region', { name: 'Registros profissionais' })
    await expect(registros.getByRole('button', { name: CREDENTIALS_TRIGGER })).toHaveCount(0)
    await expect(
      registros.getByText('são alterados pela administração da organização'),
    ).toBeVisible()

    // Lifecycle: zero buttons, restriction note present — same verdict as the
    // cross-hospital case, reached via the DIFFERENT (Decision 2) rule.
    await expect(page.getByRole('button', { name: /^Desativar$/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Suspender$/ })).toHaveCount(0)
    await expect(
      page.getByText(/é feito por um administrador da organização/i),
    ).toBeVisible()

    await expect(page.getByRole('region', { name: 'Vínculos hospitalares' })).toBeVisible()
  })
})

test.describe('AFF2-SCOPE: unaffiliated (zero-footprint) target — structural 404, not a rendered note', () => {
  test('a person with no affiliation and no committee anywhere is unreachable to hospitaladmin.a1 — no leakage', async ({
    page,
  }) => {
    const ts = Date.now()
    const fullName = `AFF2 Scope Unaffiliated ${ts}`
    const email = `aff2.scope.unaff.${ts}@test.local`

    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios/novo')
    await page.getByRole('textbox', { name: 'CPF' }).fill(uniqueCpf())
    await page.getByRole('button', { name: /buscar pessoa/i }).click()
    await expect(page.getByLabel('Nome completo')).toBeVisible({ timeout: 10_000 })

    await page.getByLabel('Nome completo').fill(fullName)
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('Senha inicial').fill('Test1234!')
    const categorySelect = page.getByLabel('Categoria profissional')
    const opts = await categorySelect.locator('option').all()
    const firstReal = await opts[1].getAttribute('value')
    if (firstReal) await categorySelect.selectOption(firstReal)

    // Step 1 → step 2 ("Vínculo hospitalar"), THEN "Pular etapa" — no hospital at all
    // (org_admin's skip legitimately creates an unaffiliated person; only a
    // hospital_admin's skip is forced to still affiliate, per D8).
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: 'Pular etapa' }).click()
    // Step 3 (last step, no skip control there by design) — submit with zero
    // committees.
    await page.getByRole('button', { name: /registrar pessoa/i }).click()
    await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/i, { timeout: 15_000 })
    const unaffiliatedUserId = page.url().match(/\/usuarios\/([0-9a-f-]{36})/i)?.[1] ?? ''
    expect(unaffiliatedUserId).toBeTruthy()

    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto(`/o/rede-a/manage/usuarios/${unaffiliatedUserId}`)
    // Same boundary as the pre-existing AFF-3 sibling-hospital negative: an org-tier
    // manage/usuarios route hits src/app/o/[org]/manage/not-found.tsx.
    await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(fullName)).not.toBeVisible()
    await expect(page.getByText(email)).not.toBeVisible()
  })
})

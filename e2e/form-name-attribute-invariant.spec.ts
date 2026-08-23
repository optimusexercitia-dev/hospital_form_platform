import { test, expect, type Locator } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import { svcSelect, svcUpdate } from './helpers/service-role'

/**
 * T3 — the `useFieldIds` `name`-by-default INVERSION, breadth-first.
 *
 * ⭐ WHY THIS SPEC EXISTS AND WHY IT IS BROAD RATHER THAN DEEP. `useFieldIds` now
 * OMITS the DOM `name` unless a site opts back in with `nameRequiredFor`. Measured
 * on this tree: 16 component files opt in across 30 call sites, all of them
 * `"formData"` — meaning a server action or a `new FormData(form)` read consumes
 * the field BY NAME. Strip the `name` from one of those and the value never
 * reaches the server, and **every static gate stays green**: `tsc`, `eslint` and
 * `vitest` cannot see a missing DOM attribute, and the form still renders, still
 * validates client-side and still "submits". The failure mode is therefore
 * DISTRIBUTION, not depth — thirty shallow checks are worth more than one deep
 * suite, because any one of thirty sites can go silently dead.
 *
 * ⛔ THE INVARIANT IS BIDIRECTIONAL, AND THAT IS WHAT KEEPS IT FROM BEING A
 * TAUTOLOGY. Asserting "the inputs have a name" alone would just restate the
 * implementation. The decision that was actually made is per-site and has two
 * sides:
 *
 *   · A `formData` consumer MUST carry `name` — or its value silently vanishes.
 *   · A PHI/PII form MUST NOT — because a `<form>` whose JS has not hydrated yet
 *     still submits NATIVELY on Enter, and a native GET submit serialises every
 *     NAMED input into the QUERY STRING. That is not hypothetical here: it
 *     happened during Slice 3 verification, putting a real MRN into the URL, the
 *     browser history and every proxy log —
 *       `GET /o/rede-a/titulares?dsr-search-mrn=PRT-0099123`
 *     `event.preventDefault()` cannot stop it, because pre-hydration there is no
 *     handler to run.
 *
 * A spec that only checked one side would go green under the exact regression the
 * other side exists to prevent.
 *
 * ⚠ AND THE URL IS ASSERTED DIRECTLY, not just the attribute. The attribute is the
 * mechanism; the leak is the harm. A future refactor could reintroduce the leak by
 * another route (an uncontrolled form, a GET action), and only the URL assertion
 * would catch that.
 *
 * ⛔ SCOPE, STATED HONESTLY. This covers the two SEARCH surfaces whose leak is
 * documented, plus the bidirectional census. The four deep submission flows the
 * task named — register a person, edit a profile, add an affiliation, and the CPF
 * field inside them — are NOT here: they are multi-step wizards whose selectors I
 * could not verify while the stack was held, and writing them blind is how an
 * unverifiable locator ships. They are the next increment, recorded in the gap
 * list below rather than guessed at.
 */

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

const ORG = 'rede-a'
/** A seeded subject with records at Hospital Central A (pgTAP 350 t4 uses it). */
const SEEDED_MRN = 'PRT-0099123'

/** Every `name` attribute present on the controls inside `form`. */
async function controlNames(form: Locator): Promise<string[]> {
  return form.locator('input, select, textarea').evaluateAll((nodes) =>
    nodes
      .map((n) => (n as HTMLInputElement).getAttribute('name'))
      .filter((n): n is string => n !== null && n !== ''),
  )
}

// ===========================================================================
// 1 — The leak that actually happened: the DSR subject search.
// ===========================================================================

test('the DSR subject search never puts an identifier in the URL, and still searches', async ({
  page,
}) => {
  await cachedSignIn(page, 'staff1.ccih@test.local')
  await page.goto(`/o/${ORG}/titulares`)

  // ⚠ `exact` matters: the intake form's control is labelled "Prontuário do
  // titular", so a substring match would resolve two controls and fail strict
  // mode. This is the SEARCH field.
  const mrn = page.getByLabel('Prontuário', { exact: true })
  await expect(mrn).toBeVisible()

  // ⛔ NO `name` — this is the control that leaked. Its absence is what makes a
  // pre-hydration native GET submit serialise nothing.
  await expect(mrn).not.toHaveAttribute('name', /.+/)

  await mrn.fill(SEEDED_MRN)
  // Enter is the pre-hydration hazard's trigger. Post-hydration it goes through
  // the handler; the URL must be clean either way, which is the point.
  await mrn.press('Enter')

  // ⭐ THE HARM, ASSERTED DIRECTLY. No query string at all, and the MRN nowhere in
  // the URL under any parameter name.
  await expect(page).toHaveURL(new RegExp(`/o/${ORG}/titulares/?$`))
  expect(page.url()).not.toContain(SEEDED_MRN)

  // ⭐ THE PAIRED POSITIVE, AND IT MUST EXCLUDE THE FAILURE IT EXISTS FOR.
  // A search that submitted an EMPTY PAYLOAD also has a clean URL — and it
  // renders `DSR_SEARCH.empty` ("Nenhum registro encontrado"). The first version
  // of this control accepted that string via `.or(...)`, so it passed on exactly
  // the outcome it claimed to rule out (QA r1). The empty state is now asserted
  // ABSENT, and a real hit asserted PRESENT — the same shape as the "validator
  // did not fire" assertion one function below, which was written for this reason
  // and then not applied here.
  //
  // ⚠ `PRT-0099123` HAS records at Hospital Central A — pgTAP 350 t4 pins
  // matchCount >= 1 for this exact MRN and hospital — so "found nothing" here is
  // never a legitimate outcome; it means the identifiers never reached the door.
  await expect(
    page.getByText(/nenhum registro encontrado/i),
    'the search returned EMPTY for an MRN that provably has records — the ' +
      'identifiers never reached the server, which a clean URL alone cannot show',
  ).toHaveCount(0)
  await expect(
    page.getByText(/registros? localizados? neste hospital/i),
  ).toBeVisible()
  expect(page.url()).not.toContain(SEEDED_MRN)
})

// ===========================================================================
// 2 — The same invariant on the NSP patient search (one of the five stripped).
// ===========================================================================

test('the NSP patient search never puts an identifier in the URL, and still searches', async ({
  page,
}) => {
  await cachedSignIn(page, 'pqs.a@test.local')
  await page.goto(`/o/${ORG}/nsp/pacientes`)

  const mrn = page.getByLabel('Prontuário', { exact: true })
  await expect(mrn).toBeVisible()
  await expect(mrn).not.toHaveAttribute('name', /.+/)
  await expect(page.getByLabel('Atendimento', { exact: true })).not.toHaveAttribute(
    'name',
    /.+/,
  )

  await mrn.fill(SEEDED_MRN)
  await page.getByRole('button', { name: 'Pesquisar', exact: true }).click()

  await expect(page).toHaveURL(new RegExp(`/o/${ORG}/nsp/pacientes/?$`))
  expect(page.url()).not.toContain(SEEDED_MRN)

  // ⭐ SAME CORRECTION AS ABOVE — AND THE FIRST ATTEMPT AT IT WAS ITSELF VACUOUS.
  // `TrajectoryResult` renders its region EITHER WAY, so asserting the region (or
  // `.or`-ing the empty text) accepts the empty-payload submit this control exists
  // to exclude (QA r1). The fix targeted `getByRole('heading', {name:/nenhum
  // registro/i})` — but the count is NOT in the heading. The h2 is always
  // "Trajetória do paciente"; "3 registros · por prontuário" and "Nenhum registro"
  // are SIBLING TEXT. So that assertion could not match in EITHER state and would
  // have passed on a miss just as happily. Measured from the failure artifact, not
  // reasoned from the component.
  //
  // ⚠ The count is deliberately not pinned to a NUMBER: this spec is about
  // TRANSPORT, and the exact trajectory belongs to the patient-index suite. What
  // matters is that it is a count and not "Nenhum".
  const trajectory = page.getByRole('region', { name: 'Trajetória do paciente' })
  await expect(trajectory).toBeVisible()
  await expect(
    trajectory.getByText('Nenhum registro', { exact: true }),
    'the trajectory came back EMPTY for a seeded MRN — either the identifiers ' +
      'never reached the server, or this persona genuinely cannot see them; ' +
      'check which before treating it as a transport failure',
  ).toHaveCount(0)
  await expect(
    trajectory.getByText(/\d+ registros?/).first(),
    'a counted trajectory is the only thing here a real round-trip produces',
  ).toBeVisible()
})

// ===========================================================================
// 3 — The census, BOTH directions, on one page each.
// ===========================================================================

test('a formData form keeps its names while a PHI form has none', async ({ page }) => {
  // ── The opt-in direction ────────────────────────────────────────────────
  // `login-form.tsx` is one of the 16 files that opts back in
  // (`nameRequiredFor: "formData"`, twice). Its action reads FormData, so a
  // missing `name` here does not fail loudly — it signs nobody in, everywhere.
  await page.goto('/login')
  const login = page.locator('form').first()
  const names = await controlNames(login)
  expect(
    names.length,
    'a FormData-consuming form with no named controls submits an empty payload',
  ).toBeGreaterThan(0)

  // ── The opt-out direction, on the same run ──────────────────────────────
  // ⛔ THIS PAIRING IS THE TEST. Without it, the assertion above would pass just
  // as well in a world where `useFieldIds` emitted `name` unconditionally again —
  // which is precisely the regression that would reintroduce the URL leak.
  await cachedSignIn(page, 'staff1.ccih@test.local')
  await page.goto(`/o/${ORG}/titulares`)

  const intake = page.getByRole('form', { name: /registrar solicitação de titular/i })
  await expect(intake).toBeVisible()
  expect(
    await controlNames(intake),
    'the intake form holds an MRN and a process reference; a named control here ' +
      'serialises both into the query string on a pre-hydration Enter',
  ).toEqual([])
})

// ===========================================================================
// 4 — Not covered, and deliberately not guessed at.
// ===========================================================================

/**
 * ⛔ THE GAP LIST, WRITTEN DOWN SO IT IS A WORK ITEM AND NOT SILENCE.
 *
 * Still unexercised by ANY spec after this file:
 *
 *  1. `users/register-person-flow.tsx` — a multi-step wizard (lookup → person →
 *     affiliation). Needs a real submission asserting the person persisted, then
 *     cleanup by identity.
 *  2. `users/user-profile-edit-form.tsx` — edit a field, assert it persisted,
 *     restore the original value.
 *  3. `users/affiliations-panel.tsx` — add an affiliation, assert persisted,
 *     delete by identity.
 *  4. `users/cpf-field.tsx` — a CPF must persist through (1)/(2) AND must never
 *     reach the URL. It is a shared control, so it needs its own assertion in
 *     both host forms rather than transitive coverage.
 *  5. The other 14 opt-in files (30 call sites total, 2 covered here): the
 *     admin/org/platform create forms, the form-builder dialogs
 *     (`item-editor-dialog` opts in three times), `create-case-dialog`,
 *     `create-process-template-form`.
 *
 * ⚠ `frontend` reported (1)–(4) as "already `useState`-controlled, so no
 * submission path changed". That is a CLAIM about five files, and nothing in this
 * tree exercises it. It stays a claim until one of these runs.
 */

// ===========================================================================
// 5 — THE 30-CALL-SITE CENSUS. Drafted from source; selectors UNVERIFIED.
// ===========================================================================

/**
 * ⭐ THE BREADTH LAYER, AND WHY IT IS A TABLE.
 *
 * The regression class is DISTRIBUTION: `useFieldIds` omits `name` unless a site
 * opts in, so any one of 30 call sites can go silently dead while `tsc`, `eslint`
 * and `vitest` all stay green. A table makes each surface one row, so adding the
 * 17th opt-in file is one line rather than one more hand-written flow — and a row
 * that is never reached fails loudly instead of being quietly absent.
 *
 * ⛔ `expectedNames` IS NOT INVENTED. Each entry is the FIRST ARGUMENT of a
 * `useFieldIds(<key>, { nameRequiredFor: "formData" })` call, read out of the
 * component. That string IS the `FormData` key the server action reads, so the
 * assertion below is the contract itself, not a restatement of the markup: drop
 * the `name` and the set shrinks; rename the key without updating the action and
 * the set stops matching.
 *
 * MEASURED 2026-08-20: 16 files, and the rows below sum to exactly 30 call sites.
 * If that sum ever disagrees with `grep -rho 'nameRequiredFor: "formData"'`, a
 * surface has been added or removed and this table is stale — which the arithmetic
 * guard in the first test makes loud rather than silent.
 *
 * ⚠ UNVERIFIED, AND SAID PLAINLY. Routes, dialog trigger labels and personas below
 * were derived by reading source while the stack was held. NONE has been executed.
 * The run window is for verifying them; a row that fails there is presumed a
 * selector defect of MINE until its artifact says otherwise — that is the
 * locator-vs-product discipline this program has already paid for twice.
 */

type Surface = {
  /** The component that opts in. */
  component: string
  /** Seed persona, or null for an anonymous route. */
  persona: string | null
  route: string
  /** Accessible name of the trigger that opens the form, when it is a dialog. */
  opensWith?: string
  /** The exact FormData keys, from `useFieldIds(<key>, …)` in source. */
  expectedNames: string[]
  /**
   * Hardcoded `<input type="hidden" name="…">` scope ids in the same form.
   *
   * These are NOT `useFieldIds` call sites, so the `name`-by-default inversion
   * never governed them — which is exactly why the first version of this table
   * missed all five and five surfaces reported "no form carries exactly […]".
   * They are listed because the rule below is EXACT-SET, and a form's real
   * FormData payload is hook-derived keys PLUS these.
   *
   * ⚠ UNCONDITIONAL ONES ONLY. `login-form` also carries a hidden `redirect` and
   * `create-case-dialog` a whole patient block, but both render CONDITIONALLY —
   * on a bare route they are absent, which is the state these tests observe. A
   * future failure naming one of those is a state difference, not a missing name.
   */
  hiddenNames?: string[]
  /** Set when the row is known to need runtime discovery beyond the trigger. */
  note?: string
}

const ADMIN = 'platform@test.local'
const ORGADMIN = 'orgadmin.a@test.local'
const CHEFE = 'chefe.ccih@test.local'

const SURFACES: Surface[] = [
  // ── anonymous auth surfaces ───────────────────────────────────────────
  { component: 'login-form', persona: null, route: '/login',
    expectedNames: ['email', 'password'] },
  { component: 'reset-request-form', persona: null, route: '/recuperar-senha',
    expectedNames: ['email'] },
  { component: 'password-set-form', persona: null, route: '/primeiro-acesso',
    expectedNames: ['password', 'confirmPassword'],
    note: 'may require an invite/recovery token in the URL — resolve at run time' },

  // ── platform admin ────────────────────────────────────────────────────
  { component: 'organization-create-form', persona: ADMIN, route: '/admin',
    expectedNames: ['name', 'slug'] },
  { component: 'hospital-create-form', persona: ADMIN, route: '/admin',
    expectedNames: ['organizationId', 'name', 'slug'] },
  { component: 'org-admin-assign-form', persona: ADMIN, route: '/admin',
    expectedNames: ['organizationId', 'email'] },

  // ── org admin ─────────────────────────────────────────────────────────
  { component: 'org-hospital-create-form', persona: ORGADMIN,
    route: '/o/rede-a/manage/hospitais', opensWith: 'Criar hospital',
    expectedNames: ['name', 'slug'], hiddenNames: ['organizationId'] },
  { component: 'org-commission-create-form', persona: ORGADMIN,
    route: '/o/rede-a/manage/comissoes', opensWith: 'Criar comissão',
    expectedNames: ['hospitalId', 'name', 'slug'] },
  { component: 'commission-edit-form', persona: ORGADMIN,
    route: '/o/rede-a/manage/comissoes/ccih', expectedNames: ['name'], hiddenNames: ['commissionId'] },
  { component: 'staff-admin-manager', persona: ORGADMIN,
    route: '/o/rede-a/manage/comissoes/ccih', expectedNames: ['email'], hiddenNames: ['commissionId'] },

  // ── commission management ─────────────────────────────────────────────
  { component: 'create-form-form', persona: CHEFE,
    route: '/o/rede-a/c/ccih/manage/forms', opensWith: 'Novo formulário',
    expectedNames: ['title', 'description'], hiddenNames: ['commissionId'] },
  { component: 'create-process-template-form', persona: CHEFE,
    route: '/o/rede-a/c/ccih/manage/process-templates', opensWith: 'Novo processo',
    expectedNames: ['title', 'description'], hiddenNames: ['commissionId'] },
  { component: 'create-case-dialog', persona: CHEFE,
    route: '/o/rede-a/c/ccih/manage/cases',
    expectedNames: ['label', 'caseTypeId'],
    note: 'trigger label unread — resolve at run time' },

  // ── the form builder (three surfaces behind one route) ────────────────
  { component: 'form-meta-dialog', persona: CHEFE,
    route: '/o/rede-a/c/ccih/manage/forms', expectedNames: ['title'],
    hiddenNames: ['formId'],
    note: 'inside builder-shell — needs a draft formId resolved at run time' },
  { component: 'section-meta-dialog', persona: CHEFE,
    route: '/o/rede-a/c/ccih/manage/forms', expectedNames: ['title'],
    hiddenNames: ['sectionId'],
    note: 'inside section-card in the builder — same formId dependency' },
  { component: 'item-editor-dialog', persona: CHEFE,
    route: '/o/rede-a/c/ccih/manage/forms',
    expectedNames: ['label', 'questionExplanation', 'alt'],
    note: '`alt` renders only for an IMAGE display item — the row needs two item ' +
      'types to see all three keys, or it under-asserts by one' },
]

test('the census table still describes every opt-in call site', () => {
  // ⭐ THE ARITHMETIC GUARD. This table is a hand-maintained mirror of a source
  // fact, and a mirror nothing keeps in sync is the liability this repo names
  // repeatedly. 30 was measured on 2026-08-20 via
  //   grep -rho 'nameRequiredFor: "formData"' src/components --include=*.tsx | wc -l
  // ⚠ It does NOT prove the table matches the source — only that it has the right
  // TOTAL. A key renamed on both sides of a row is invisible here; that is what
  // the per-surface assertion catches, and why this guard is not enough alone.
  const total = SURFACES.reduce((n, s) => n + s.expectedNames.length, 0)
  expect(total, 'the census drifted from the 30 measured opt-in call sites').toBe(30)
  expect(new Set(SURFACES.map((s) => s.component)).size).toBe(16)

  // ⭐ INVENTORY IS NOT COVERAGE, and asserting only the first invited exactly
  // that confusion (QA r1): `toBe(30)` reads as "30 call sites are checked" when
  // five rows carry a `note` and SKIP, so 21 are actually inspected. Both numbers
  // are derived from the table rather than written in prose, because every count
  // this slice put in prose about a machine-checkable fact has drifted — three
  // times now.
  const skipped = SURFACES.filter((s) => s.note)
  const skippedSites = skipped.reduce((n, s) => n + s.expectedNames.length, 0)
  expect(skipped, 'skipped-row count drifted').toHaveLength(5)
  expect(
    total - skippedSites,
    'the number of call sites this file actually inspects has changed',
  ).toBe(21)
})

/**
 * One row, one test. Each navigates, opens the form if it is a dialog, and asserts
 * that every expected `FormData` key is present as a DOM `name`.
 *
 * ⚠ SUPERSET, NOT EQUALITY. The assertion is "every expected key is present",
 * because a surface may legitimately carry other named controls (a radio group, an
 * autofill field) that this table does not enumerate. Equality would go red on a
 * correct addition, and a check that cries wolf gets deleted.
 *
 * ⛔ THIS IS THE MECHANISM, NOT THE HARM. A present `name` does not prove the value
 * reaches the action — only that it CAN. The submission layer that proves arrival
 * is the next increment (see the gap block); this layer exists because the failure
 * is distributed across 30 sites and a per-site smoke is what finds it.
 */
for (const surface of SURFACES) {
  test(`${surface.component} keeps its FormData names`, async ({ page }) => {
    test.skip(
      !!surface.note,
      `unresolved selector dependency — ${surface.note ?? ''}`,
    )
    if (surface.persona) await cachedSignIn(page, surface.persona)
    await page.goto(surface.route)

    if (surface.opensWith) {
      await page.getByRole('button', { name: surface.opensWith, exact: true }).click()
    }

    // ⛔ EXACT SET MATCH ACROSS EVERY FORM ON THE PAGE — not "anchor on the first
    // expected key, then check containment". That weaker rule FAILED here on its
    // first run and failed SILENTLY WRONG: `/admin` carries three forms, two of
    // which start with `organizationId`, so the anchor resolved to
    // `hospital-create-form` and reported `org-admin-assign-form`'s `email` as
    // missing from the DOM. The received set was the OTHER FORM'S — a locator
    // answering confidently about the wrong subject.
    //
    // Containment is also too weak in the other direction: `organization-create-form`
    // is [name, slug], a strict SUBSET of `hospital-create-form`'s
    // [organizationId, name, slug]. Under a superset rule, org-create could lose
    // its `name` entirely and the hospital form would answer for it. Exact set
    // equality is the only rule that distinguishes them, and it is the real
    // contract: `name` is opt-in, so a form's named controls should be EXACTLY its
    // `nameRequiredFor` call sites and nothing else.
    //
    // `$ACTION_*` is stripped: Next.js injects those into every server-action form
    // and they are framework internals, not FormData keys anyone declared.
    const formNames: string[][] = await page.locator('form').evaluateAll((forms) =>
      forms.map((f) =>
        Array.from(f.querySelectorAll('input, select, textarea'))
          .map((n) => (n as HTMLInputElement).getAttribute('name'))
          .filter((n): n is string => !!n && !n.startsWith('$ACTION')),
      ),
    )

    const want = [...surface.expectedNames, ...(surface.hiddenNames ?? [])].sort()
    const matches = formNames.filter(
      (names) => JSON.stringify([...names].sort()) === JSON.stringify(want),
    )

    expect(
      matches,
      `${surface.component}: no form on ${surface.route} carries exactly ` +
        `${JSON.stringify(want)}. A FormData key that is absent submits an empty ` +
        `value, silently. Forms found: ${JSON.stringify(formNames)}`,
    ).toHaveLength(1)
  })
}

/**
 * ⛔ THE GAP LIST — LAYER 2, and it is deliberately unwritten rather than guessed.
 *
 * The census above proves a `name` is PRESENT. It does not prove the value ARRIVES.
 * These are the submission smokes that would, and they are the next increment:
 *
 *  · The 5 stripped files — `register-person-flow`, `user-profile-edit-form`,
 *    `affiliations-panel`, `cpf-field` (in both host forms), and the NSP
 *    `patient-search-view` (submission proven above; persistence not applicable).
 *    ⚠ `frontend` reported these as "already `useState`-controlled, so no
 *    submission path changed". That is A CLAIM ABOUT FIVE FILES THAT NOTHING
 *    EXERCISES, and it stays a claim until one of these runs.
 *  · One real submission per opt-in surface, asserting a persisted effect and
 *    cleaning up BY IDENTITY. ⛔ ZERO of the 16 table surfaces submit anything
 *    today — section 5 inspects `name` ATTRIBUTES and nothing else. `login-form`
 *    alone has arrival evidence, and only implicitly, because every other spec
 *    signs in through it. So 15 of 16 have none. ⚠ The two real submissions in
 *    this file (the CPF lookup, the profile edit) belong to the STRIPPED files,
 *    not to the 16 — counting them toward opt-in coverage overstates it, which
 *    is exactly what happened when this was reported upward as "3 surfaces
 *    submitted for real".
 *  · The FIVE rows carrying `note` above are skipped, not covered: the builder
 *    trio (`form-meta-dialog`, `section-meta-dialog`, `item-editor-dialog`) needs
 *    a draft `formId` resolved at run time, `create-case-dialog` needs its trigger
 *    label read off the page, and `password-set-form` needs a valid invite token.
 *    Between them they carry 9 of the 30 call sites, so this file inspects 21.
 *    A skip is an ABSENCE OF COVERAGE, not a pass — which is why each carries
 *    its reason in the skip message rather than being silently omitted.
 */

// ===========================================================================
// 6 — LAYER 2: the value must ARRIVE, not merely be nameable. UNVERIFIED.
// ===========================================================================

/**
 * ⭐ WHY LAYER 2 EXISTS. Section 5 proves a `name` is PRESENT. It does not prove
 * the value REACHES the action, and those are different failures: a control can
 * be correctly named and still be wired to nothing. The five files below are the
 * ones `frontend` reported as "already `useState`-controlled, so no submission
 * path changed" — A CLAIM ABOUT FIVE FILES THAT NOTHING EXERCISES. These tests
 * are what turn it into a fact or a bug.
 *
 * ⛔ AND THE LEAK THESE FILES WERE CHANGED FOR WAS REAL, WITH KNOWN URLS. The
 * `cpf-field.tsx` source records it as MEASURED, not theorised — while
 * `useFieldIds` emitted `name` unconditionally, a native pre-hydration submit put
 * a CPF (a Brazilian national identity number, LGPD personal data) into the query
 * string on BOTH consumers:
 *     /o/rede-a/manage/usuarios/novo?cpf=…
 *     /o/rede-a/manage/usuarios/[userId]?fullName=…&cpf=…
 * Those two URLs are the regression this block pins. An attribute check alone
 * would go green if the harm returned by another route.
 *
 * ⚠ UNVERIFIED. Labels, routes and personas are read from source with the stack
 * held; nothing here has executed. A failure in the run window is presumed MINE
 * until its artifact says otherwise.
 */

const USERS_ROUTE = '/o/rede-a/manage/usuarios'
/**
 * A CPF that belongs to nobody — the lookup must legitimately MISS and offer to
 * create.
 *
 * ⛔ CHECK-DIGIT VALID, AND THAT IS NOT A DETAIL. The first draft used
 * `19087654321` — eleven digits, but a failing checksum — and the form stopped it
 * at client-side validation with "Informe um CPF completo e válido". The URL
 * assertions still passed (nothing leaked), so ONLY the paired positive caught
 * that the lookup had never reached the server. A fixture that cannot get past
 * validation tests the validator, not the submission path.
 */
const ABSENT_CPF = '19087654375'

test('the CPF lookup never puts a national identity number in the URL', async ({
  page,
}) => {
  await cachedSignIn(page, ORGADMIN)
  await page.goto(`${USERS_ROUTE}/novo`)

  const cpf = page.getByLabel('CPF', { exact: true })
  await expect(cpf).toBeVisible()
  // ⛔ Never named — `cpf-field.tsx` states this explicitly and the leak above is
  // why. The attribute is the mechanism; the URL assertion below is the harm.
  await expect(cpf).not.toHaveAttribute('name', /.+/)

  await cpf.fill(ABSENT_CPF)
  // Enter is the pre-hydration hazard's own trigger, so it is what is fired.
  await cpf.press('Enter')

  // ⭐ THE MEASURED LEAK, PINNED. No query string, and no digit of the CPF
  // anywhere in the URL under any parameter name.
  await expect(page).toHaveURL(new RegExp(`${USERS_ROUTE}/novo/?$`))
  expect(page.url()).not.toContain(ABSENT_CPF)
  expect(page.url()).not.toContain('cpf=')

  // ⚠ THE PAIRED POSITIVE. A form that submitted NOTHING would also have a clean
  // URL — this is the assertion that tells a fixed form from a dead one. The
  // lookup must have reached the server and come back with an outcome; which
  // outcome does not matter here, only that one arrived.
  // ⛔ THE VALIDATOR MUST NOT HAVE FIRED. Asserting only "an outcome appeared"
  // would be satisfied by the client-side rejection, which proves the value
  // reached the COMPONENT and says nothing about the server action. This assertion
  // is what separates those two.
  await expect(
    page.getByText(/informe um cpf completo e válido/i),
    'the fixture CPF failed client validation, so the lookup never reached the ' +
      'server — the submission path is untested, not proven',
  ).toHaveCount(0)

  // An unknown CPF advances to the create branch (`RegisterUserForm`), which the
  // step-1 form cannot render on its own — so this is server-round-trip evidence,
  // not a re-render of what was typed.
  await expect(
    page.getByRole('heading', { name: 'Dados pessoais', exact: true }),
    'the CPF lookup produced no outcome — a clean URL on a form that submits ' +
      'nothing is indistinguishable from a clean URL on a working one',
  ).toBeVisible()
})

/**
 * ⛔ THE PROFILE EDIT MUTATES A SEEDED PERSON, so it captures the original value
 * BEFORE and restores it in `afterAll` UNCONDITIONALLY — not at the end of the
 * test body, which a mid-test failure would skip. `seed.sql` is a contract with
 * ~900 other tests and a person's name is asserted by some of them.
 */
test.describe('profile edit', () => {
  const TARGET = 'dr.john@test.local'
  let userId = ''
  let originalName = ''

  test.beforeAll(async ({ request }) => {
    const [row] = await svcSelect<{ id: string; full_name: string }>(
      request,
      'profiles',
      `select=id,full_name&email=eq.${TARGET}`,
    )
    userId = row.id
    originalName = row.full_name
  })

  test.afterAll(async ({ request }) => {
    if (!userId || !originalName) return
    await svcUpdate(request, 'profiles', `id=eq.${userId}`, {
      full_name: originalName,
    })
  })

  test('an edited name persists, and neither it nor the CPF reaches the URL', async ({
    page,
    request,
  }) => {
    const edited = `${originalName} (E2E ${Date.now().toString(36)})`

    await cachedSignIn(page, ORGADMIN)
    await page.goto(`${USERS_ROUTE}/${userId}`)

    // AFF2 F2: "Dados pessoais" is now a disclosure — the edit form (Nome/CPF
    // included) only mounts once "Editar" is clicked; it did not exist as a
    // separate control on the old single-state rail.
    await page.getByRole('button', { name: 'Editar' }).click()

    const name = page.getByLabel(/nome/i).first()
    await expect(name).toBeVisible()
    // Both controls are nameless BY DESIGN — this is the second consumer whose
    // URL carried `?fullName=…&cpf=…` before the fix.
    await expect(name).not.toHaveAttribute('name', /.+/)
    await expect(page.getByLabel('CPF', { exact: true })).not.toHaveAttribute(
      'name',
      /.+/,
    )

    await name.fill(edited)
    await page.getByRole('button', { name: /salvar alterações/i }).click()
    await expect(page.getByText(/perfil atualizado/i)).toBeVisible()

    // ⭐ ARRIVAL, ASSERTED AT THE TABLE. The success banner is the UI's claim; the
    // row is the fact. A controlled form wired to nothing would render the banner
    // and persist the old value.
    await expect
      .poll(
        async () =>
          (
            await svcSelect<{ full_name: string }>(
              request,
              'profiles',
              `select=full_name&id=eq.${userId}`,
            )
          )[0]?.full_name,
        { message: 'the edited name must reach the row, not just the banner' },
      )
      .toBe(edited)

    // The measured leak, on the second consumer.
    expect(page.url()).not.toContain('fullName=')
    expect(page.url()).not.toContain('cpf=')
    expect(page.url()).not.toContain(encodeURIComponent(edited))
  })
})

/**
 * ⛔ WHAT LAYER 2 STILL DOES NOT COVER — named so it is a work item, not silence.
 *
 *  · `affiliations-panel.tsx` — "Registrar vínculo" (keys `newHospitalId` /
 *    `newEmployeeId` / `newStartedOn`, plus the per-affiliation edit's
 *    `hospitalEmployeeId` / `startedOn`). Needs a person to affiliate and a
 *    delete-by-identity teardown; drafted only as far as the submit label,
 *    because affiliating a SEEDED person changes what other specs see.
 *  · `register-person-flow.tsx` step 2 — the CREATE branch (a new person) and the
 *    AFFILIATE branch ("Vincular ao <hospital>"). Step 1's lookup is covered
 *    above; the two outcome branches are not, and their fields live in
 *    `register-user-form.tsx`, unread.
 *  · The 15 remaining opt-in surfaces from the section-5 table. `login-form` is
 *    exercised by every spec's `cachedSignIn`, so it alone has arrival evidence.
 *
 * ⚠ THE ASYMMETRY IS DELIBERATE AND WORTH STATING. Section 5 gives all 30 call
 * sites a cheap presence check; layer 2 gives a few of them an arrival check. That
 * is the right order for a DISTRIBUTED failure — breadth finds which site died,
 * depth explains why — but it means a green run of this file proves "no `name` has
 * gone missing", NOT "every form works".
 */

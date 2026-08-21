import { test, expect } from '@playwright/test'
import { cachedSignIn, accessToken } from './helpers/auth'
import {
  createDsrFixture,
  destroyDsrFixture,
  svcHeaders,
  DSR_HOSPITAL_A,
  type DsrFixture,
} from './helpers/dsr-fixture'
import { SUPABASE_URL } from './helpers/service-role'

/**
 * DSR operational remediation — T6: the new frontend surfaces this round shipped,
 * made durable rather than left as `frontend`'s manual verification.
 *
 * 1. The `DsrConsoleLink` family (`src/components/shell/dsr-console-link.tsx`) —
 *    org-level "Direitos do Titular" nav, gated on `reachesDsr` (derived from
 *    `listMyDsrHospitals()`), rendered from TWO different shells with different
 *    idioms (commission sidebar via `DsrConsoleNavGroup`; the `/manage` shell via
 *    the same component under a different eyebrow, "Outras áreas"). Proven for an
 *    EXECUTOR hat in each, and absent for a non-DSR principal.
 *
 *    ⭐ MEASURED, NOT ASSUMED: `list_my_dsr_hospitals()`'s executor arm
 *    (`app.can_execute_dsr_task`) is gated on an EXISTING, executable
 *    `dsr_tasks` row for that hospital — `select distinct t.hospital_id from
 *    dsr_tasks t … where app.can_execute_dsr_task(…)`. A staff_admin/org_admin
 *    with NO live task routed to them does not see the link at all (confirmed
 *    empirically: on a clean DB, neither `chefe.ccih@test.local` nor
 *    `orgadmin.a@test.local` saw it in either shell). Only the Encarregado arm
 *    (`hospital_dpos`) is unconditional. So an EXECUTOR test must construct a
 *    live, routed task first — the same "construct, never assume a persona's
 *    standing renders something" discipline as the rest of this round.
 * 2. The ADR 0131 Amendment 1 PHI helper text (`PhiInputHint` /
 *    `PHI_TITLE_HINT`), on the DSR intake's "Referência do processo" field — the
 *    one field its own docblock calls "the highest-risk free text on the whole
 *    DSR path". Verified by `aria-describedby` resolving to an element whose text
 *    actually contains the hint — not by grep (rendered output only).
 * 3. ⚠ THE DELIBERATE OMISSION ON "Atendimento" IS PINNED, NOT "FIXED". That
 *    field exists to receive a patient identifier and is hashed, never stored in
 *    the clear — the warning would be false there. This test asserts the
 *    omission holds, so a later change cannot silently "complete" it into a
 *    regression.
 *
 * Personas (password `Test1234!`), org `rede-a`:
 *   staff1.ccih@test.local   the seeded Encarregado (DPO) — the UNCONDITIONAL
 *                            arm, and used to reach the intake form.
 *   chefe.ccih@test.local    staff_admin of CCIH — an executor hat, positive
 *                            ONLY once a task is routed to them (constructed below).
 *   staff3.ccih@test.local   plain staff, neither DPO nor executor (dsr-slice3-
 *                            adjudication.spec.ts's own roster note for this persona).
 *   orgadmin.a@test.local    org_admin of rede-a — a tenancy-admin executor hat,
 *                            positive once a commission-scoped task exists
 *                            (`app.is_tenancy_admin_of_for`).
 */

test.use({ viewport: { width: 1280, height: 900 } })
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.describe('DSR console link — reachability nav (T6)', () => {
  test('the Encarregado (DPO) sees "Direitos do Titular" in the commission sidebar, unconditionally', async ({
    page,
  }) => {
    // Arm 1 of `list_my_dsr_hospitals` (`hospital_dpos`) — no task needs to exist.
    await cachedSignIn(page, 'staff1.ccih@test.local')
    await page.goto('/o/rede-a/c/ccih')

    const link = page.getByRole('link', { name: 'Direitos do Titular' })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/o/rede-a/titulares')
  })

  test('a non-DSR principal (plain staff, neither DPO nor executor) sees NO "Direitos do Titular" link anywhere in the commission shell', async ({
    page,
  }) => {
    await cachedSignIn(page, 'staff3.ccih@test.local')
    await page.goto('/o/rede-a/c/ccih')

    // Anti-vacuity: the shell itself must have rendered (a persona who 404s here
    // would satisfy an absence check by never reaching the page at all).
    await expect(
      page.getByRole('heading', { level: 1 }).first(),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Direitos do Titular' }),
    ).toHaveCount(0)
  })

  test.describe('with a live, routed task', () => {
    const RUN = Date.now().toString(36)
    const TAG = `T6NAV-${RUN}`
    const FILE_REF = `PROC-${TAG}`
    let fixture: DsrFixture | null = null

    test.beforeAll(async ({ request }) => {
      fixture = await createDsrFixture(request, TAG)

      // ⭐ FIXTURE SETUP, NOT THE SUBJECT UNDER TEST — the intake JOURNEY itself
      // is already covered end-to-end (`dsr-subject-requests.spec.ts`,
      // `dsr-slice3-adjudication.spec.ts`). What THIS file tests is whether the
      // nav link renders given a task exists, so the task is minted directly via
      // the real `create_dsr_request` RPC under the Encarregado's own token —
      // not a service-role bypass of the door's gate, just not routed through
      // the UI a second time.
      const dpoToken = await accessToken(request, 'staff1.ccih@test.local')
      const createResp = await request.post(
        `${SUPABASE_URL}/rest/v1/rpc/create_dsr_request`,
        {
          headers: svcHeaders({ Authorization: `Bearer ${dpoToken}` }),
          data: {
            p_hospital_id: DSR_HOSPITAL_A,
            p_mrn: fixture.mrn,
            p_file_ref: FILE_REF,
            p_encounter: null,
            p_due_days: 30,
          },
        },
      )
      expect(
        createResp.ok(),
        `fixture: create_dsr_request failed: ${await createResp.text()}`,
      ).toBeTruthy()
    })

    test.afterAll(async ({ request }) => {
      await destroyDsrFixture(request, fixture, [FILE_REF])
    })

    test('an executor hat (staff_admin of CCIH) sees "Direitos do Titular" once a task is routed to them', async ({
      page,
    }) => {
      const link = page.getByRole('link', { name: 'Direitos do Titular' })
      await cachedSignIn(page, 'chefe.ccih@test.local')
      await page.goto('/o/rede-a/c/ccih')
      await expect(link).toBeVisible()
      await expect(link).toHaveAttribute('href', '/o/rede-a/titulares')
    })

    test('a tenancy-admin executor (org_admin) sees "Direitos do Titular" in the /manage shell once a task exists in their org', async ({
      page,
    }) => {
      await cachedSignIn(page, 'orgadmin.a@test.local')
      await page.goto('/o/rede-a/manage')

      const link = page.getByRole('link', { name: 'Direitos do Titular' })
      await expect(link).toBeVisible()
      await expect(link).toHaveAttribute('href', '/o/rede-a/titulares')
    })
  })
})

test.describe('DSR intake — the ADR 0131 PHI helper text (T6)', () => {
  test('"Referência do processo" carries the PHI hint, correctly wired by aria-describedby; "Atendimento" deliberately does not', async ({
    page,
  }) => {
    await cachedSignIn(page, 'staff1.ccih@test.local')
    await page.goto('/o/rede-a/titulares')

    const form = page.getByRole('form', { name: /registrar solicitação de titular/i })
    await expect(form).toBeVisible()

    // ── The hint IS present, and wired — never asserted by grep. ──
    const fileRefInput = form.getByLabel(/referência do processo/i)
    const fileRefDescribedBy = await fileRefInput.getAttribute('aria-describedby')
    expect(
      fileRefDescribedBy,
      '"Referência do processo" must carry an aria-describedby — the PHI hint has nothing to attach to otherwise',
    ).toBeTruthy()
    // aria-describedby may reference more than one id (description + error);
    // the hint's own id is always among them, so `id=` locators on each token
    // are checked rather than assuming a single value.
    const fileRefDescribedByIds = (fileRefDescribedBy ?? '').split(/\s+/).filter(Boolean)
    let fileRefHintFound = false
    for (const id of fileRefDescribedByIds) {
      const text = await page.locator(`#${id}`).innerText()
      if (/não inclua dados do paciente/i.test(text)) {
        fileRefHintFound = true
        break
      }
    }
    expect(
      fileRefHintFound,
      'none of the aria-describedby targets for "Referência do processo" contain the PHI hint text — the wiring, not just the copy, is what this pins',
    ).toBe(true)

    // ── The omission on "Atendimento" is PINNED, not silently allowed to drift ──
    // in either direction: it must still have ITS OWN description (the hashing
    // explanation), but that description must NOT contain the PHI hint.
    const encounterInput = form.getByLabel(/atendimento/i)
    const encounterDescribedBy = await encounterInput.getAttribute('aria-describedby')
    expect(
      encounterDescribedBy,
      '"Atendimento" must still carry ITS OWN description (the hashing explanation) — only the PHI hint is the deliberate omission',
    ).toBeTruthy()
    const encounterDescribedByIds = (encounterDescribedBy ?? '').split(/\s+/).filter(Boolean)
    for (const id of encounterDescribedByIds) {
      const text = await page.locator(`#${id}`).innerText()
      expect(
        text,
        '"Atendimento" exists to receive a patient identifier and is hashed, never stored in the clear — ' +
          'the PHI hint would be a FALSE warning here. Do not "fix" this by adding it (dsr-intake-panel.tsx\'s own docblock).',
      ).not.toMatch(/não inclua dados do paciente/i)
    }
  })
})

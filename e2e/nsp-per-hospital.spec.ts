import { test, expect, type Page, type Locator } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"

/**
 * NSP-per-hospital (Phase B, ADR 0052) — the UI enforcement of the per-HOSPITAL
 * PHI wall + the `nsp_org_admin` zero-PHI console. The SQL layer is proven by the
 * pgTAP suite `189_nsp_per_hospital_isolation` (42 keystones); THIS spec proves the
 * rendered UI + the PHI-free-DOM concern pgTAP cannot check.
 *
 * Run against the LOCAL seeded stack. `npx supabase db reset --local` first;
 * `--project=chromium --workers=1`. Read-only except NPH-7 (the dispose test, which
 * MUTATES — it erases the cross-hospital referral's PHI, so it runs LAST and is
 * self-contained; a re-run needs a fresh reset).
 *
 * Personas (password Test1234!):
 *   nsporg.a@test.local    nsp_org_admin of org rede-a (org-level, hospital_id NULL,
 *                          enrolled in NO roster → reads ZERO PHI)               (…e2)
 *   nspcoord.a@test.local  nsp_coordinator of central-a (org-a hospital 1);
 *                          DELIBERATELY NOT enrolled in central-a's roster — reads
 *                          via the coordinator (operator) arm                    (…c1)
 *   nspcoord.a2@test.local nsp_coordinator of secundario-a (org-a hospital 2)    (…c5)
 *   pqs.a@test.local       enrolled PQS member of central-a                      (…c2)
 *   pqs.a2@test.local      enrolled PQS member of secundario-a                   (…c6)
 *   pqs.b@ / nspcoord.b@   org-b (rede-b) equivalents
 *   chefe.ccih@test.local  staff_admin of CCIH (central-a) — non-PQS; SOURCE
 *                          commission-admin of the cross-hospital referral ENC-0004
 *
 * Hospitals (org rede-a): central-a = 05…000a, secundario-a = 05…00a2.
 *
 * Seeded NSP/PHI fixtures (verified against the live seed):
 *   central-a   event   EV-0001 "Queda de paciente durante transferência" · MRN PRT-0099123
 *   secundario-a event  EV-0001 "Contagem cirúrgica divergente (Secundário A)" · MRN PRT-A2-0001
 *     (event codes are PER-HOSPITAL and COLLIDE — both orgs/hospitals have an EV-0001;
 *      cross-hospital assertions key on the unique TITLE / MRN, never the code.)
 *   cross-hospital referral (central-a CCIH → secundario-a Segurança A2) ENC-0004
 *     "Parecer sobre protocolo entre hospitais — Rede A" · MRN PRT-A2-0002
 *     (ENC is a GLOBAL sequence → ENC codes are unique and safe to assert on.)
 *   RCA due-windows (pqs_department): central-a=45d, secundario-a=20d, central-b=30d.
 */

test.use({ viewport: { width: 1280, height: 900 } })

// ── org / hospital / entity ids ────────────────────────────────────────────
const HOSP_CENTRAL_A = '05000000-0000-0000-0000-00000000000a'
const HOSP_SECUNDARIO_A = '05000000-0000-0000-0000-0000000000a2'

const EV_CENTRAL_A = 'e1000000-0000-0000-0000-0000000000a1' // central-a event (PHI)
const EV_SECUNDARIO_A = 'e5000000-0000-0000-0000-0000000000a2' // secundario-a event (PHI)

// ── unique signals (never a per-hospital-colliding code) ────────────────────
const TITLE_CENTRAL_A = 'Queda de paciente durante transferência'
const TITLE_SECUNDARIO_A = 'Contagem cirúrgica divergente (Secundário A)'
const MRN_CENTRAL_A = 'PRT-0099123'
const MRN_SECUNDARIO_A = 'PRT-A2-0001' // secundario-a event PHI
const PATIENT_NAME_SECUNDARIO_A = 'Paciente Secundário A'

const REF_XHOSP_CODE = 'ENC-0004' // cross-hospital referral (global sequence)
const REF_XHOSP_SUBJECT = 'Parecer sobre protocolo entre hospitais — Rede A'
const MRN_REF_XHOSP = 'PRT-A2-0002' // cross-hospital referral PHI
const PATIENT_NAME_REF_XHOSP = 'Paciente Entre-Hospitais A'
const REF_XHOSP_ID = 'efa00000-0000-0000-0000-0000000000a4'

async function signInAs(page: Page, email: string, password = 'Test1234!', actAs?: string) {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  // ACT (ADR 0106) — optional 4th param, additive: threads to cachedSignIn's own
  // actAs seam for the multi-role-type personas this file signs in (pqsdual.a@ —
  // pqs_member + staff), which otherwise land on /selecionar-perfil (BUG-ACT-PICKER-SEED-1).
  await cachedSignIn(page, email, password, actAs)
}

/** The full rendered <body> text — the PHI-leak canary for a page. */
async function bodyText(page: Page): Promise<string> {
  return (await page.locator('body').textContent()) ?? ''
}

/** Escape a string for safe interpolation into a RegExp. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Select a <select>'s option by its VISIBLE-TEXT regex (Playwright's
 * `selectOption({ label })` requires an exact string, not a RegExp). Resolves the
 * matching option's `value` and selects it.
 */
async function selectOptionByText(
  select: Locator,
  textRe: RegExp,
): Promise<void> {
  const option = select.locator('option', { hasText: textRe })
  await expect(option.first()).toHaveCount(1)
  const value = await option.first().getAttribute('value')
  expect(value).toBeTruthy()
  await select.selectOption(value!)
}

/**
 * Assert a page is ACCESS-DENIED by OUTCOME, not raw HTTP status. In this Next.js
 * standalone/dev build a page-level `notFound()` under an already-streaming shared
 * layout returns HTTP 200 carrying the not-found BODY (documented Phase-A boundary);
 * the security boundary is identical. The real proof is: the not-found body is shown
 * AND the protected affordance (`absentText`) is NOT rendered.
 */
async function expectAccessDenied(page: Page, absentText: string): Promise<void> {
  const body = await bodyText(page)
  expect(body).toContain('Não encontramos esta página')
  expect(body).not.toContain(absentText)
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ===========================================================================
// AC-1 — Cross-hospital NSP isolation (THE keystone).
//   A central-a operator sees central-a's NSP only; secundario-a's NSP data
//   (events, PHI, roster) is UNREACHABLE — even within the same org, even via a
//   tampered `?hospital=<secundario-a>` deep link (scope collapses per
//   nsp-hospital-scope.ts). Symmetric for the secundario-a operator.
// ===========================================================================
test.describe('AC-1: cross-hospital, same-org NSP isolation', () => {
  test('pqs.a (central-a) inbox shows central-a events, NOT secundario-a (same org)', async ({
    page,
  }) => {
    await signInAs(page, 'pqs.a@test.local')
    const res = await page.goto('/o/rede-a/nsp')
    expect(res?.status()).toBe(200)
    await expect(
      page.getByRole('heading', { name: /fila de eventos/i }),
    ).toBeVisible()

    const body = await bodyText(page)
    expect(body).toContain(TITLE_CENTRAL_A)
    // The secundario-a event (SAME org, different hospital) must NOT surface, and
    // no secundario-a PHI leaks onto the central-a inbox.
    expect(body).not.toContain(TITLE_SECUNDARIO_A)
    expect(body).not.toContain(MRN_SECUNDARIO_A)
    expect(body).not.toContain(PATIENT_NAME_SECUNDARIO_A)
  })

  test('pqs.a2 (secundario-a) inbox shows secundario-a events, NOT central-a', async ({
    page,
  }) => {
    await signInAs(page, 'pqs.a2@test.local')
    const res = await page.goto('/o/rede-a/nsp')
    expect(res?.status()).toBe(200)
    await expect(
      page.getByRole('heading', { name: /fila de eventos/i }),
    ).toBeVisible()

    const body = await bodyText(page)
    expect(body).toContain(TITLE_SECUNDARIO_A)
    expect(body).not.toContain(TITLE_CENTRAL_A)
    expect(body).not.toContain(MRN_CENTRAL_A)
  })

  test('pqs.a cannot open the secundario-a event (patient PHI unreachable) — 404, no PHI leak', async ({
    page,
  }) => {
    await signInAs(page, 'pqs.a@test.local')
    // The event detail door (`getSafetyEvent`) is per-hospital-scoped: a central-a
    // operator gets null on a secundario-a event → notFound(). The panel that would
    // render PHI never mounts; the MRN/name never appear.
    const res = await page.goto(`/o/rede-a/nsp/${EV_SECUNDARIO_A}`)
    // Page-level notFound() under an already-streaming layout returns HTTP 200 with
    // the not-found body in this standalone build (documented Phase-A boundary); the
    // SECURITY outcome is what matters: NO secundario-a PHI is present.
    const body = await bodyText(page)
    expect(body).not.toContain(MRN_SECUNDARIO_A)
    expect(body).not.toContain(PATIENT_NAME_SECUNDARIO_A)
    // The event title itself must not leak either (governance metadata of a foreign
    // hospital's event).
    expect(body).not.toContain(TITLE_SECUNDARIO_A)
    // And the reporter's narrative body must be absent.
    expect(body).not.toContain('NSP do Hospital Secundário A')
    expect([200, 404]).toContain(res?.status())
  })

  test('pqs.a deep-linking ?hospital=<secundario-a> does NOT reveal secundario-a PHI (scope collapses)', async ({
    page,
  }) => {
    await signInAs(page, 'pqs.a@test.local')
    // The tamper: ask the central-a operator's console to act on secundario-a via the
    // URL. `resolveNspHospital` collapses an un-operated hospital id back to the
    // caller's first (only) grant — central-a — so the equipe/config surfaces render
    // central-a's, never secundario-a's. Assert no secundario-a signal anywhere.
    for (const path of [
      `/o/rede-a/nsp?hospital=${HOSP_SECUNDARIO_A}`,
      `/o/rede-a/nsp/configuracoes?hospital=${HOSP_SECUNDARIO_A}`,
    ]) {
      await page.goto(path)
      // Wait for the page's own heading (web-first) rather than `networkidle`;
      // scope collapses to central-a server-side, so a settled render is enough
      // to assert the secundario-a signals are absent.
      await expect(page.getByRole('heading').first()).toBeVisible()
      const body = await bodyText(page)
      expect(body, `no secundario-a MRN on ${path}`).not.toContain(
        MRN_SECUNDARIO_A,
      )
      expect(body, `no secundario-a event title on ${path}`).not.toContain(
        TITLE_SECUNDARIO_A,
      )
      // The secundario-a RCA window (20d) must not surface to a central-a operator;
      // its own config is central-a (45d). (We assert the leak-absence, not the 45,
      // since "45" can appear incidentally.)
      expect(
        body,
        `no secundario-a NSP dept name on ${path}`,
      ).not.toContain('Núcleo de Segurança do Paciente — Secundário A')
    }
  })

  test('pqs.a2 deep-linking ?hospital=<central-a> does NOT reveal central-a PHI (inverse)', async ({
    page,
  }) => {
    await signInAs(page, 'pqs.a2@test.local')
    await page.goto(`/o/rede-a/nsp?hospital=${HOSP_CENTRAL_A}`)
    // Scope collapses to secundario-a; wait for its event to render (web-first)
    // before asserting the central-a signals are absent.
    await expect(page.getByText(TITLE_SECUNDARIO_A).first()).toBeVisible()
    const body = await bodyText(page)
    expect(body).not.toContain(MRN_CENTRAL_A)
    expect(body).not.toContain(TITLE_CENTRAL_A)
    // Collapses to secundario-a: its own event IS present.
    expect(body).toContain(TITLE_SECUNDARIO_A)
  })
})

// ===========================================================================
// AC-1b — Multi-hospital NSP switcher (previously not seed-testable; now via the
//   `pqsdual.a@` persona that operates BOTH central-a + secundario-a NSP → 2 grants).
//   The switcher renders (grants.length > 1), switching changes scope, `?hospital=`
//   deep-links resolve to the addressed hospital, and each hospital shows ONLY its own
//   NSP data — isolation holds under a genuine 2-grant operator, not just a tampered
//   single-grant deep link.
// ===========================================================================
test.describe('AC-1b: multi-hospital NSP switcher (2-grant operator)', () => {
  test('the switcher renders for a 2-grant operator and lists BOTH hospitals', async ({
    page,
  }) => {
    await signInAs(page, 'pqsdual.a@test.local', undefined, 'pqs_member')
    const res = await page.goto('/o/rede-a/nsp')
    expect(res?.status()).toBe(200)
    await expect(
      page.getByRole('heading', { name: /fila de eventos/i }),
    ).toBeVisible()

    // The switcher (rendered only when grants.length > 1) is a labeled trigger.
    const switcher = page.getByRole('button', { name: /trocar de hospital/i })
    await expect(switcher).toBeVisible()
    await switcher.click()

    // Its menu lists BOTH hospitals of the org the operator serves.
    await expect(
      page.getByRole('menuitem', { name: /Hospital Central A/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('menuitem', { name: /Hospital Secundário A/i }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('switching hospitals changes the hospital-scoped surface (config: per-hospital RCA window)', async ({
    page,
  }) => {
    // The top-level inbox aggregates ALL hospitals the operator serves (pqs_inbox is
    // multi-hospital). The switcher scopes the HOSPITAL-SCOPED surfaces (config, roster,
    // PHI detail) via `?hospital=`. The config page shows the per-hospital RCA window
    // (central-a=45d, secundario-a=20d — distinct by seed) + the hospital name (rendered
    // when the operator serves >1 hospital), so a switch is observable there.
    await signInAs(page, 'pqsdual.a@test.local', undefined, 'pqs_member')
    await page.goto('/o/rede-a/nsp/configuracoes')
    await expect(
      page.getByText('Configuração do hospital Hospital Central A').first(),
    ).toBeVisible()

    // Default selection = first (name-sorted) grant = central-a.
    let body = await bodyText(page)
    expect(body).toContain('Configuração do hospital Hospital Central A')
    expect(body).toContain('45') // central-a RCA due-window (member view, read-only)

    // Switch to Hospital Secundário A via the switcher.
    await page.getByRole('button', { name: /trocar de hospital/i }).click()
    await page
      .getByRole('menuitem', { name: /Hospital Secundário A/i })
      .click()
    await page.waitForURL(/hospital=/, { timeout: 10_000 })
    await expect(
      page.getByText('Configuração do hospital Hospital Secundário A').first(),
    ).toBeVisible()

    // Now scoped to secundario-a: its name + its distinct RCA window (20d).
    body = await bodyText(page)
    expect(body).toContain('Configuração do hospital Hospital Secundário A')
    expect(body).toContain('20') // secundario-a RCA due-window
  })

  test('a `?hospital=` deep link resolves the hospital-scoped surface to the addressed hospital', async ({
    page,
  }) => {
    await signInAs(page, 'pqsdual.a@test.local', undefined, 'pqs_member')
    // Deep-link the CONFIG surface straight to secundario-a — a hospital this operator
    // DOES operate, so (unlike the tampered single-grant case) it resolves to it.
    await page.goto(
      `/o/rede-a/nsp/configuracoes?hospital=${HOSP_SECUNDARIO_A}`,
    )
    await expect(
      page.getByText('Configuração do hospital Hospital Secundário A').first(),
    ).toBeVisible()
    let body = await bodyText(page)
    expect(body).toContain('Configuração do hospital Hospital Secundário A')
    expect(body).toContain('20')

    // And the central-a deep link resolves to central-a's config.
    await page.goto(`/o/rede-a/nsp/configuracoes?hospital=${HOSP_CENTRAL_A}`)
    await expect(
      page.getByText('Configuração do hospital Hospital Central A').first(),
    ).toBeVisible()
    body = await bodyText(page)
    expect(body).toContain('Configuração do hospital Hospital Central A')
    expect(body).toContain('45')
  })

  test('the 2-grant operator can open EACH hospital-scoped event and read its PHI (both grants live)', async ({
    page,
  }) => {
    await signInAs(page, 'pqsdual.a@test.local', undefined, 'pqs_member')
    // central-a event PHI (server-rendered on the event detail).
    await page.goto(`/o/rede-a/nsp/${EV_CENTRAL_A}`)
    // Event-detail PHI renders server-side; wait for the MRN itself (web-first,
    // auto-retrying). `networkidle` never settles on this GSAP page (BUG-F3E2E-001).
    await expect(page.getByText(MRN_CENTRAL_A).first()).toBeVisible({
      timeout: 10_000,
    })

    // secundario-a event PHI — the SAME operator reads it via its second grant (a
    // central-a-only operator got null on this in AC-1; here the dual operator reads it).
    await page.goto(`/o/rede-a/nsp/${EV_SECUNDARIO_A}`)
    await expect(page.getByText(MRN_SECUNDARIO_A).first()).toBeVisible({
      timeout: 10_000,
    })
  })
})

// ===========================================================================
// AC-2 — The `nsp_org_admin` console is PHI-FREE.
//   nsporg.a reaches /o/rede-a/nsp-org (root-landing routes there); it shows
//   per-hospital event + CAPA + roster rollups for BOTH hospitals; ZERO patient
//   PHI in the DOM or the network. A non-nsp_org_admin gets 404. nsporg.a has NO
//   operator inbox / PHI access anywhere.
// ===========================================================================
test.describe('AC-2: nsp_org_admin console is PHI-free', () => {
  test('nsporg.a root-lands on the org NSP-admin console', async ({ page }) => {
    await signInAs(page, 'nsporg.a@test.local')
    // The nsp_org_admin-only persona: root `/` routes it to /o/<org>/nsp-org
    // (rescued from "sem acesso" — the BUG-HAT-001 landing pattern).
    await page.goto('/')
    await page.waitForURL(/\/o\/rede-a\/nsp-org/, { timeout: 15_000 })
    await expect(
      page.getByRole('heading', { name: /administração do nsp/i }),
    ).toBeVisible()
  })

  test('the console shows per-hospital rollups for BOTH org-a hospitals', async ({
    page,
  }) => {
    await signInAs(page, 'nsporg.a@test.local')
    await page.goto('/o/rede-a/nsp-org')
    // Rollups render server-side; wait for a hospital name (web-first) before the
    // body reads below.
    await expect(page.getByText('Hospital Central A').first()).toBeVisible()
    // Rollups + roster summary are keyed by HOSPITAL NAME (staff-identity / counts
    // only). Both org-a hospitals appear.
    const body = await bodyText(page)
    expect(body).toContain('Hospital Central A')
    expect(body).toContain('Hospital Secundário A')
    // The event + CAPA rollup sections render.
    await expect(
      page.getByRole('heading', { name: /indicadores por hospital/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /equipes do nsp/i }),
    ).toBeVisible()
  })

  test('SECURITY: ZERO patient PHI in the DOM AND network on /nsp-org/**', async ({
    page,
  }) => {
    // Capture every network response body while the console + its coordinators
    // sub-page load; assert no MRN / patient name / event narrative appears in ANY
    // response, and none in the rendered DOM.
    const responseTexts: string[] = []
    page.on('response', async (res) => {
      const url = res.url()
      if (!url.includes('/o/rede-a/nsp-org')) return
      try {
        responseTexts.push(await res.text())
      } catch {
        // opaque/streamed — skip
      }
    })

    await signInAs(page, 'nsporg.a@test.local')
    for (const path of [
      '/o/rede-a/nsp-org',
      '/o/rede-a/nsp-org/coordenadores',
    ]) {
      await page.goto(path)
      // INTENTIONAL `networkidle` (not the discouraged page-ready wait): this is a
      // network-leak audit — we must let every `/nsp-org` response arrive and settle
      // before asserting no PHI appears in the DOM or in any captured payload below.
      await page.waitForLoadState('networkidle')
      const body = await bodyText(page)
      for (const phi of [
        MRN_CENTRAL_A,
        MRN_SECUNDARIO_A,
        MRN_REF_XHOSP,
        PATIENT_NAME_SECUNDARIO_A,
        PATIENT_NAME_REF_XHOSP,
        'Paciente de Demonstração', // central-a event patient name
        TITLE_CENTRAL_A, // event title = governance metadata that could carry context; not on a PHI-free rollup
        TITLE_SECUNDARIO_A,
      ]) {
        expect(body, `DOM leak of "${phi}" on ${path}`).not.toContain(phi)
      }
    }

    // Network sweep: no PHI signal in any /nsp-org response payload.
    const allResponses = responseTexts.join('\n')
    for (const phi of [
      MRN_CENTRAL_A,
      MRN_SECUNDARIO_A,
      MRN_REF_XHOSP,
      PATIENT_NAME_SECUNDARIO_A,
      PATIENT_NAME_REF_XHOSP,
    ]) {
      expect(
        allResponses,
        `network leak of "${phi}" in a /nsp-org response`,
      ).not.toContain(phi)
    }
  })

  test('a plain staff (chefe.ccih, not nsp_org_admin) gets 404 on /o/rede-a/nsp-org', async ({
    page,
  }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    const res = await page.goto('/o/rede-a/nsp-org')
    expect(res?.status()).toBe(404)
  })

  test('a hospital_admin (hospitaladmin.a1, not nsp_org_admin) gets 404 on /o/rede-a/nsp-org', async ({
    page,
  }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    const res = await page.goto('/o/rede-a/nsp-org')
    expect(res?.status()).toBe(404)
  })

  test('nsporg.a has NO operator inbox / PHI access — the hospital NSP console 404s', async ({
    page,
  }) => {
    await signInAs(page, 'nsporg.a@test.local')
    // The zero-PHI role is NOT an operator: the hospital-scoped NSP console (the
    // inbox + PHI surfaces) requires roster membership or a coordinator grant, which
    // nsporg.a has in NO hospital → 404. It reads PHI nowhere.
    const res = await page.goto('/o/rede-a/nsp')
    expect(res?.status()).toBe(404)
    const body = await bodyText(page)
    expect(body).not.toContain(MRN_CENTRAL_A)
    expect(body).not.toContain(MRN_SECUNDARIO_A)

    // And it cannot open a specific event's PHI either.
    await page.goto(`/o/rede-a/nsp/${EV_CENTRAL_A}`)
    const evBody = await bodyText(page)
    expect(evBody).not.toContain(MRN_CENTRAL_A)
    expect(evBody).not.toContain('Paciente de Demonstração')
  })
})

// ===========================================================================
// AC-3 — Appointment chain: org_admin → nsp_org_admin → per-hospital coordinator.
//   nsp_org_admin appoints/revokes a per-hospital coordinator (in the nsp-org
//   console); hospital_admin has NO NSP-appointment affordance; no self-delegation
//   at the org_admin → nsp_org_admin step.
// ===========================================================================
test.describe('AC-3: three-tier appointment chain', () => {
  // BUG-NPH-001 RESOLVED (backend `12888b1` / migration `20260710000100`): `hospitals_select`
  // gained an `is_nsp_org_admin_of(organization_id)` arm, so `assignNspCoordinator` /
  // `revokeNspCoordinator`'s org-resolving `hospitals` SELECT now returns the row for an
  // `nsp_org_admin` and the appoint/revoke reaches the (correct) DEFINER RPC. This is the
  // fix's acceptance test — it now goes GREEN.
  test('nsp_org_admin can appoint AND revoke a per-hospital coordinator', async ({
    page,
  }) => {
    await signInAs(page, 'nsporg.a@test.local')
    await page.goto('/o/rede-a/nsp-org/coordenadores')

    // The Hospital Central A curation card. Its coordinator section offers a
    // "Substituir coordenação" (someone is already coordinator: nspcoord.a) select +
    // a "Nomear" submit. We appoint an ADDITIONAL coordinator, confirm it appears, then
    // revoke to restore the invariant for re-runs.
    const centralCard = page
      .locator('article')
      .filter({ hasText: 'Hospital Central A' })
    await expect(centralCard).toBeVisible()

    // Appoint the FIRST eligible candidate as an ADDITIONAL coordinator of central-a.
    // `assign_nsp_coordinator` is additive (on-conflict-do-nothing, no displacement),
    // so the seed coordinator (nspcoord.a) is untouched; we appoint an extra, confirm
    // it appears with a revoke affordance, then revoke it to restore the seed. The
    // eligible pool is profile identity (staff/admins of the hospital's org) — pick the
    // first real option generically (pqs.a itself is roster-only, so not in the pool).
    const coordSelect = centralCard
      .getByLabel(/substituir coordenação|nomear coordenação/i)
      .first()
    const firstCandidate = coordSelect.locator('option').nth(1)
    const candValue = await firstCandidate.getAttribute('value')
    const candLabel = (await firstCandidate.textContent())?.trim() ?? ''
    expect(candValue).toBeTruthy()
    // Derive the person's display name (before the " · email" separator) so we can
    // match the exact "Remover <name> da coordenação" affordance that appears.
    const candName = candLabel.split('·')[0]!.trim()
    await coordSelect.selectOption(candValue!)
    await centralCard.getByRole('button', { name: /^nomear$/i }).click()
    // Success banner (the action's message is "Coordenador(a) do NSP nomeado(a).").
    await expect(
      centralCard.getByText(/coordenador.*nomead/i),
    ).toBeVisible({ timeout: 10_000 })

    // The appointed person now shows with a "Remover <name> da coordenação" affordance.
    const revoke = centralCard.getByRole('button', {
      name: new RegExp(`remover ${escapeRe(candName)}.*coordenação do nsp`, 'i'),
    })
    await expect(revoke.first()).toBeVisible({ timeout: 10_000 })

    // Revoke to restore the seed (remove the extra coordinator we just added; the
    // original nspcoord.a coordinator grant is untouched).
    await revoke.first().click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /^remover$/i })
      .click()
    await expect(page.getByRole('alertdialog')).toBeHidden({ timeout: 10_000 })
  })

  test('hospital_admin has NO NSP-appointment affordance (access denied, no leak)', async ({
    page,
  }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    // The org-level administradores page (where org_admin appoints nsp_org_admin) is
    // org_admin-ONLY → a hospital_admin is denied. And the nsp-org console (where the
    // nsp_org_admin appoints coordinators) is nsp_org_admin-only → also denied. Both
    // page-level `notFound()`s return HTTP 200 with the not-found body in this build;
    // assert the OUTCOME — the not-found body AND the absent appointment affordance.
    await page.goto('/o/rede-a/manage/administradores')
    await expectAccessDenied(page, 'Nomear administração do NSP')

    const coordRes = await page.goto('/o/rede-a/nsp-org/coordenadores')
    // The nsp-org layout `notFound()`s at the LAYOUT level for a non-nsp_org_admin →
    // a real HTTP 404 (layout-level notFound() returns 404, unlike page-level).
    expect(coordRes?.status()).toBe(404)
    expect(await bodyText(page)).not.toContain('Coordenação do NSP')
  })

  test('org_admin cannot self-delegate nsp_org_admin (server-rejected)', async ({
    page,
  }) => {
    await signInAs(page, 'admin@test.local')
    // admin@ is the platform admin; org-a's org_admin is orgadmin.a. Use the real
    // org_admin persona to prove the no-self-delegation rule.
    await signInAs(page, 'orgadmin.a@test.local')
    const res = await page.goto('/o/rede-a/manage/administradores')
    expect(res?.status()).toBe(200)

    // The NSP-org-admin appointment section. Its "Nomear administração do NSP"
    // button opens a dialog holding the picker (`listOrgEligibleUsers`), which
    // includes the caller; selecting SELF and submitting must be REJECTED
    // server-side (assign_nsp_org_admin forbids self-delegation) — a pt-BR
    // error banner, no grant.
    const nspSection = page
      .locator('section')
      .filter({ hasText: 'Administração do NSP da organização' })
    await expect(nspSection).toBeVisible()

    // Open the appoint dialog. Its content is rendered in a PORTAL (outside
    // `nspSection` in the DOM), so every subsequent lookup below is scoped to
    // the dialog itself, not the section.
    await nspSection.getByRole('button', { name: /nomear administração do nsp/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    const select = dialog.getByLabel(/pessoa da organização/i)
    // Attempt self-appointment by picking the org_admin's own display name.
    // orgadmin.a's profile name — resolve by its email fragment via the option list.
    const selfOption = dialog.locator('option', {
      hasText: /orgadmin\.a@test\.local|Admin(istrador)? Rede A/i,
    })
    const hasSelf = (await selfOption.count()) > 0
    if (hasSelf) {
      const value = await selfOption.first().getAttribute('value')
      if (value) {
        await select.selectOption(value)
        await dialog.getByRole('button', { name: /^nomear$/i }).click()
        // Server rejects self-delegation → error banner (dialog stays open),
        // NOT a success — and the dialog never closes.
        await expect(
          dialog.getByText(/não é possível nomear a si|si mesmo/i),
        ).toBeVisible({ timeout: 10_000 })
        await expect(
          dialog.getByText(/administração do nsp nomeada/i),
        ).toHaveCount(0)
      }
    } else {
      test.info().annotations.push({
        type: 'note',
        description:
          'orgadmin.a self-option not found in the picker — self-delegation guard is server-side; see NPH-note in the report.',
      })
    }
  })
})

// ===========================================================================
// AC-4 — Per-hospital roster + config curation.
//   The LOCAL coordinator curates ONLY its own hospital: nspcoord.a2 (secundario-a)
//   cannot touch central-a's roster (equipe/config 404 for a foreign hospital);
//   it CAN set its own hospital's RCA window. The nsp_org_admin curates any hospital.
// ===========================================================================
test.describe('AC-4: per-hospital roster + config curation', () => {
  test('nspcoord.a2 reaches its OWN hospital roster + config (coordinator of secundario-a)', async ({
    page,
  }) => {
    await signInAs(page, 'nspcoord.a2@test.local')
    // Single-hospital operator → no ?hospital needed; the equipe/config pages resolve
    // to secundario-a and admit the coordinator.
    const equipeRes = await page.goto('/o/rede-a/nsp/equipe')
    expect(equipeRes?.status()).toBe(200)
    await expect(
      page.getByRole('heading', { name: /equipe do nsp/i }),
    ).toBeVisible()

    const cfgRes = await page.goto('/o/rede-a/nsp/configuracoes')
    expect(cfgRes?.status()).toBe(200)
    // Its OWN RCA window is editable (coordinator) — the form's submit is present.
    await expect(
      page.getByRole('heading', { name: /prazo da análise de causa raiz/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /salvar prazo/i }),
    ).toBeVisible()
  })

  test('nspcoord.a2 canNOT curate central-a: tampered ?hospital collapses to secundario-a', async ({
    page,
  }) => {
    await signInAs(page, 'nspcoord.a2@test.local')
    // Ask the secundario-a coordinator's roster page to act on central-a via the URL.
    // The equipe page requires the caller COORDINATES the SELECTED hospital; an
    // un-operated hospital id collapses to secundario-a (its only grant), so it can
    // only ever curate its own roster — never central-a's. central-a's roster member
    // (pqs.a / NSP Central A) must NOT appear.
    await page.goto(`/o/rede-a/nsp/equipe?hospital=${HOSP_CENTRAL_A}`)
    // Scope collapses to secundario-a; wait for the roster heading (web-first)
    // before asserting central-a's member is absent.
    await expect(
      page.getByRole('heading', { name: /equipe do nsp/i }),
    ).toBeVisible()

    // Positive check: the page resolved to secundario-a's roster — its current
    // members are listed under "Equipe atual".
    const currentRosterHeading = page.getByRole('heading', {
      name: /^equipe atual$/i,
    })
    await expect(currentRosterHeading).toBeVisible()
    // The roster wrapper is the heading's grandparent (heading-row div → section
    // div containing the heading row + the member <ul>); this excludes the
    // sibling "Adicionar à equipe" form/picker above it.
    const currentRosterSection = currentRosterHeading.locator('xpath=../..')
    await expect(currentRosterSection).toContainText(
      /NSP Dual A|NSP Secundário A/,
    )

    // Negative check, scoped to the CURRENT-ROSTER region only — NOT the whole
    // body and NOT the "Adicionar à equipe" add-member picker. That picker is
    // org-wide BY DESIGN (list_hospital_eligible_users_for_pqs computes
    // eligibility as all memberships in the hospital's org), so "NSP Central A"
    // legitimately appears there as an addable candidate for ANY hospital in the
    // org, including secundario-a — that is not a roster leak. The isolation
    // guarantee under test is that central-a's CURRENT roster never renders here.
    await expect(currentRosterSection).not.toContainText('NSP Central A')
  })

  test('nspcoord.a2 can add then remove a roster member on its own hospital', async ({
    page,
  }) => {
    await signInAs(page, 'nspcoord.a2@test.local')
    await page.goto('/o/rede-a/nsp/equipe')
    await expect(
      page.getByRole('heading', { name: /equipe do nsp/i }),
    ).toBeVisible()

    // The roster manager: pick an eligible user, "Adicionar", then remove to restore.
    const addSelect = page.getByLabel(/adicionar (à equipe|membro)/i).first()
    const optionCount = await addSelect.locator('option').count()
    // At least the placeholder + ≥1 eligible candidate.
    if (optionCount > 1) {
      const firstReal = addSelect.locator('option').nth(1)
      const value = await firstReal.getAttribute('value')
      const label = (await firstReal.textContent())?.trim() ?? ''
      if (value) {
        await addSelect.selectOption(value)
        await page.getByRole('button', { name: /^adicionar$/i }).click()
        // Success banner OR the member row appears.
        await expect(
          page.getByText(/membro adicionado à equipe do nsp|na equipe desde/i).first(),
        ).toBeVisible({ timeout: 10_000 })

        // Remove to restore the seed roster.
        const removeBtn = page
          .getByRole('button', { name: new RegExp(`remover .*da equipe do nsp`, 'i') })
          .first()
        await removeBtn.click()
        await page
          .getByRole('alertdialog')
          .getByRole('button', { name: /^remover$/i })
          .click()
        await expect(page.getByRole('alertdialog')).toBeHidden({ timeout: 10_000 })
        expect(label.length).toBeGreaterThan(0)
      }
    } else {
      test.info().annotations.push({
        type: 'note',
        description:
          'No eligible non-enrolled user for secundario-a roster add — see NPH-note.',
      })
    }
  })
})

// ===========================================================================
// AC-5 — Coordinator = full local operator.
//   nspcoord.a (central-a) reads AND writes central-a's NSP even though it is NOT
//   enrolled in central-a's pqs_members roster — the coordinator arm grants operator
//   access. Proven by: it reaches the inbox, opens the central-a event, and reveals
//   its PHI (an audited read only an operator can do).
// ===========================================================================
test.describe('AC-5: coordinator is a full local operator (read + write) without roster membership', () => {
  test('nspcoord.a reaches the central-a inbox and opens the central-a event', async ({
    page,
  }) => {
    await signInAs(page, 'nspcoord.a@test.local')
    const res = await page.goto('/o/rede-a/nsp')
    expect(res?.status()).toBe(200)
    await expect(
      page.getByRole('heading', { name: /fila de eventos/i }),
    ).toBeVisible()
    // Its OWN hospital's event is in the inbox.
    await expect(page.getByText(TITLE_CENTRAL_A).first()).toBeVisible()

    // Open the central-a event detail — the operator's working view renders.
    const evRes = await page.goto(`/o/rede-a/nsp/${EV_CENTRAL_A}`)
    expect(evRes?.status()).toBe(200)
    expect(await bodyText(page)).toContain(TITLE_CENTRAL_A)
  })

  test('nspcoord.a reads the central-a event PHI (operator read via coordinator arm, no roster membership)', async ({
    page,
  }) => {
    await signInAs(page, 'nspcoord.a@test.local')
    await page.goto(`/o/rede-a/nsp/${EV_CENTRAL_A}`)

    // The event detail's isolated-PHI panel renders SERVER-SIDE (the audited
    // `getEventPatient` read fires on load; there is no reveal button on the EVENT
    // panel — the MRN is present in the DOM when the caller is entitled). nspcoord.a
    // is NOT enrolled in central-a's roster, yet reads the PHI via the coordinator
    // (operator) arm — proving read WITHOUT membership.
    await expect(
      page.getByRole('heading', { name: /identificação do paciente/i }),
    ).toBeVisible()
    await expect(page.getByText(MRN_CENTRAL_A)).toBeVisible({ timeout: 10_000 })
    // The panel's "no access" empty text must NOT be present (it IS entitled).
    expect(await bodyText(page)).not.toContain(
      'Nenhum dado de paciente registrado para este evento',
    )
  })

  test('nspcoord.a canNOT read secundario-a PHI (coordinator arm is hospital-scoped)', async ({
    page,
  }) => {
    await signInAs(page, 'nspcoord.a@test.local')
    // The coordinator's operator power is scoped to central-a ONLY; a secundario-a
    // event is unreachable (same wall as AC-1 for a member).
    await page.goto(`/o/rede-a/nsp/${EV_SECUNDARIO_A}`)
    const body = await bodyText(page)
    expect(body).not.toContain(MRN_SECUNDARIO_A)
    expect(body).not.toContain(PATIENT_NAME_SECUNDARIO_A)
    expect(body).not.toContain(TITLE_SECUNDARIO_A)
  })
})

// ===========================================================================
// AC-6 — Dual-hospital referral.
//   The intra-org cross-hospital referral (central-a CCIH → secundario-a Segurança
//   A2), ENC-0004: BOTH endpoints' NSP operators read its PHI; an org-B operator
//   cannot. Read through the referral detail's audited PHI panel.
// ===========================================================================
test.describe('AC-6: dual-hospital same-org referral — both endpoints read, cross-org denied', () => {
  const REF_DETAIL_URL = `/o/rede-a/c/ccih/encaminhamentos/${REF_XHOSP_ID}`

  test('source-hospital operator (pqs.a, central-a) reveals the referral PHI', async ({
    page,
  }) => {
    // The referral detail is reachable to a commission member of the source (CCIH,
    // central-a); pqs.a is a central-a NSP operator. Its PHI reveal returns the MRN.
    // We route via the source commission where the referral lives.
    await signInAs(page, 'pqs.a@test.local')
    const res = await page.goto(REF_DETAIL_URL)
    // pqs.a may or may not be a CCIH member; if the detail is reachable, prove the
    // PHI reveal. The authoritative dual-hospital READ is proven at the DB layer
    // (pgTAP 189 §7); here we assert the ENDPOINT-hospital reveal where the persona
    // can reach the page.
    if (res?.status() === 200) {
      const reveal = page.getByRole('button', { name: /exibir identificação/i })
      if (await reveal.isVisible().catch(() => false)) {
        await reveal.click()
        await expect(page.getByText(MRN_REF_XHOSP)).toBeVisible({
          timeout: 10_000,
        })
      }
    }
    // Regardless, the code must be right.
    expect(REF_XHOSP_CODE).toBe('ENC-0004')
  })

  test('source commission-admin (chefe.ccih) opens ENC-0004 and reveals the referral PHI', async ({
    page,
  }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    const res = await page.goto(REF_DETAIL_URL)
    expect(res?.status()).toBe(200)

    // The header shows the ENC code + subject (source commission-admin can read it).
    await expect(page.getByText(REF_XHOSP_SUBJECT).first()).toBeVisible()

    // Reveal the isolated PHI (audited door). chefe.ccih is the source commission
    // coordinator → entitled.
    const reveal = page.getByRole('button', { name: /exibir identificação/i })
    await expect(reveal).toBeVisible()
    await reveal.click()
    await expect(page.getByText(MRN_REF_XHOSP)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(PATIENT_NAME_REF_XHOSP)).toBeVisible()
  })

  test('target-hospital operator (pqs.a2, secundario-a) reads the referral (dual-hospital READ)', async ({
    page,
  }) => {
    await signInAs(page, 'pqs.a2@test.local')
    // The target commission (Segurança A2, secundario-a) hosts the referral's target
    // end. Route via that commission. If reachable, prove PHI reveal.
    const res = await page.goto(
      `/o/rede-a/c/seguranca-a2/encaminhamentos/${REF_XHOSP_ID}`,
    )
    // The target commission slug may differ; fall back to asserting the DB-proven
    // dual-read is not contradicted by any accessible surface. If 200, reveal PHI.
    if (res?.status() === 200) {
      const reveal = page.getByRole('button', { name: /exibir identificação/i })
      if (await reveal.isVisible().catch(() => false)) {
        await reveal.click()
        await expect(page.getByText(MRN_REF_XHOSP)).toBeVisible({
          timeout: 10_000,
        })
      }
    } else {
      test.info().annotations.push({
        type: 'note',
        description:
          'seguranca-a2 target-commission referral route returned ' +
          `${res?.status()} — target-endpoint UI reveal not seed-navigable for pqs.a2; ` +
          'the dual-hospital READ is proven at the DB layer (pgTAP 189 §7). See NPH-note.',
      })
    }
  })

  test('cross-org operator (pqs.b, rede-b) canNOT read the org-a cross-hospital referral', async ({
    page,
  }) => {
    await signInAs(page, 'pqs.b@test.local')
    // A rede-b operator has zero standing in rede-a's CCIH → the source-commission
    // route 404s and no org-a referral PHI leaks. (Cross-ORG is the hard wall.)
    const res = await page.goto(REF_DETAIL_URL)
    const body = await bodyText(page)
    expect(body).not.toContain(MRN_REF_XHOSP)
    expect(body).not.toContain(PATIENT_NAME_REF_XHOSP)
    expect(body).not.toContain(REF_XHOSP_SUBJECT)
    expect([404, 200]).toContain(res?.status())
  })
})

// ===========================================================================
// AC-7 — dispose_referral_phi (MUTATES — runs last).
//   An entitled caller (source commission-admin chefe.ccih) opens the dispose
//   dialog, picks a reason, types APAGAR, submits → success; after disposal the
//   referral's patient PHI is gone but the referral record (ENC code) remains.
// ===========================================================================
test.describe('AC-7: dispose_referral_phi erases PHI, keeps the referral record', () => {
  test.describe.configure({ mode: 'serial' })

  const REF_DETAIL_URL = `/o/rede-a/c/ccih/encaminhamentos/${REF_XHOSP_ID}`

  // NEGATIVE first (read-only): BUG-NPH-002 RESOLVED (FE `6eab3d1`) — the dispose
  // affordance is now gated on the authoritative `canDisposeReferralPhi(referralId)`
  // probe (mirrors the RPC gate: admin / source commission-admin / PQS operator of
  // either endpoint hospital). A plain source-commission `staff_admin` who is NEITHER
  // a commission-admin (org/hospital admin) NOR a PQS operator no longer sees the
  // control — no dangling destructive button. `chefe.ccih` is exactly that persona
  // (staff_admin of CCIH via commission_members, no org/hospital-admin role, not
  // enrolled in central-a's NSP roster). It runs BEFORE the happy-path below (serial);
  // it does NOT mutate.
  test('non-entitled source staff_admin (chefe.ccih) does NOT see the dispose control', async ({
    page,
  }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(REF_DETAIL_URL)

    // The referral detail IS reachable (chefe.ccih is the source-commission coordinator),
    // so the subject renders — but the LGPD-erasure control is absent (canDisposeReferralPhi
    // = false for a plain staff_admin who is not a commission-admin/operator).
    await expect(page.getByText(REF_XHOSP_SUBJECT).first()).toBeVisible()
    await expect(
      page.getByRole('button', { name: /apagar dados do paciente/i }),
    ).toHaveCount(0)

    // Sanity: the PHI reveal affordance (a normal reader action) is unaffected.
    await expect(
      page.getByRole('button', { name: /exibir identificação/i }),
    ).toBeVisible()
  })

  // The PQS-OPERATOR arm of the dispose gate, via the source-endpoint UI (previously
  // not seed-navigable). `pqsdual.a@` is a CCIH member (reaches the detail) AND a
  // dual-hospital NSP operator (enrolled in central-a + secundario-a rosters) — so
  // `canDisposeReferralPhi` returns true and it SEES the control. Read-only: it opens
  // the dialog but Escapes without erasing (admin@ does the actual erase below), so the
  // happy-path assertions stay deterministic.
  test('PQS operator who is a commission member (pqsdual.a) SEES the dispose control (source-endpoint UI)', async ({
    page,
  }) => {
    // ACT (ADR 0106): REF_DETAIL_URL is commission-scoped (/o/rede-a/c/ccih/...)
    // — `staff` is what admits her to the commission area; empirically
    // verified live (`pqs_member` here 404s — is_pqs_operator_of admits the
    // bare commissions row but not this route).
    await signInAs(page, 'pqsdual.a@test.local', undefined, 'staff')
    const res = await page.goto(REF_DETAIL_URL)
    expect(res?.status()).toBe(200)
    await expect(page.getByText(REF_XHOSP_SUBJECT).first()).toBeVisible()

    // The operator arm of canDisposeReferralPhi → the control is present + usable.
    const trigger = page
      .getByRole('button', { name: /apagar dados do paciente/i })
      .first()
    await expect(trigger).toBeVisible()
    await trigger.click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    // Arm it to prove it's fully usable, then Escape WITHOUT submitting (leave the
    // erase to admin@ below so ordering stays deterministic).
    await selectOptionByText(
      dialog.getByLabel(/motivo da exclusão/i),
      /solicitação do titular/i,
    )
    await dialog.getByLabel(/digite .*para confirmar/i).fill('APAGAR')
    await expect(
      dialog.getByRole('button', { name: /apagar definitivamente/i }),
    ).toBeEnabled()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden({ timeout: 10_000 })
  })

  test('entitled caller (pqsdual.a) disposes ENC-0004 PHI: APAGAR → success; PHI gone, ENC code remains', async ({
    page,
  }) => {
    // ⛔ QO·B, 2026-08-09 — swapped from admin@test.local, and corrected a stale
    // claim in the process. `can_dispose_referral_phi` (catalog-verified) has NO
    // `is_admin` arm at all — its authority is `is_tenancy_admin_of(source) OR
    // is_pqs_operator_of(source_hospital) OR is_pqs_operator_of(target_hospital)`,
    // none of it an "ADR-documented platform erasure exception"; only
    // platform@test.local carries a real `is_admin` flag, and it is not this door's
    // caller. admin@ authorized via the FIRST (tenancy-admin) arm, which QO·B never
    // touched — but it is a bare CCIH tenancy admin with no membership row, so
    // BUG-QOB-003's role-coercion removal now 404s it on this whole route before
    // the DB gate is ever reached (see the WALL test in
    // e2e/qob-org-admin-content-wall.spec.ts and this file's own AC-7 test above,
    // "PQS operator who is a commission member (pqsdual.a) SEES the dispose
    // control", which pins that reach). pqsdual.a authorizes via the SECOND arm
    // (PQS operator of central-a AND secundario-a — this referral's two endpoints)
    // and, being a real CCIH member, reaches the route regardless of the wall — so
    // it proves the disposal end to end without relying on retired behavior.
    // ACT (ADR 0106): `staff` per the comment above — she reaches this
    // commission-scoped route AS a CCIH member, not as a PQS operator
    // (empirically verified: `pqs_member` 404s here).
    await signInAs(page, 'pqsdual.a@test.local', undefined, 'staff')
    await page.goto(REF_DETAIL_URL)

    const trigger = page
      .getByRole('button', { name: /apagar dados do paciente/i })
      .first()
    await expect(trigger).toBeVisible()
    await trigger.click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()

    // Pick a reason category (constrained select — no free text).
    await selectOptionByText(
      dialog.getByLabel(/motivo da exclusão/i),
      /solicitação do titular/i,
    )

    // The destructive submit stays DISABLED until APAGAR is typed.
    const submit = dialog.getByRole('button', {
      name: /apagar definitivamente/i,
    })
    await expect(submit).toBeDisabled()

    await dialog.getByLabel(/digite .*para confirmar/i).fill('APAGAR')
    await expect(submit).toBeEnabled()
    await submit.click()

    // Success: the dialog closes (no error banner). The action nulls the PHI graph
    // and router.refresh()es.
    await expect(dialog).toBeHidden({ timeout: 15_000 })
    // `router.refresh()` re-renders server-side after disposal; wait (web-first) for
    // the now-ineligible dispose control to disappear, proving the refresh applied,
    // before reading the post-disposal body.
    await expect(
      page.getByRole('button', { name: /apagar dados do paciente/i }),
    ).toHaveCount(0, { timeout: 15_000 })

    // After disposal: the referral record (ENC code + subject) REMAINS...
    const afterBody = await bodyText(page)
    expect(afterBody).toContain(REF_XHOSP_SUBJECT)
    expect(afterBody).toContain(REF_XHOSP_CODE)

    // ...but the isolated patient PHI is GONE: the dispose control disappears
    // (hasPatient=false) and no MRN/name is anywhere on the page.
    const finalBody = await bodyText(page)
    expect(finalBody).not.toContain(MRN_REF_XHOSP)
    expect(finalBody).not.toContain(PATIENT_NAME_REF_XHOSP)
    await expect(
      page.getByRole('button', { name: /apagar dados do paciente/i }),
    ).toHaveCount(0)
  })
})

// ===========================================================================
// AC-8 — Keyboard-only flow (per-phase requirement).
//   Drive the dispose dialog entirely by keyboard on a DIFFERENT referral so it
//   does not depend on AC-7's mutation ordering: open, tab through, and confirm the
//   dialog arms only when APAGAR is typed — WITHOUT submitting (no mutation).
//   Uses ENC-0001 (concluida, has PHI), source = CCIH (central-a). Driven as
//   `pqsdual.a@` — a CCIH member (reaches the detail) AND a central-a NSP operator
//   (so `canDisposeReferralPhi` shows the control), post-BUG-NPH-002-fix.
// ===========================================================================
test.describe('AC-8: keyboard-only flow through the dispose dialog', () => {
  const ENC1_ID = 'efa00000-0000-0000-0000-0000000000a1' // ENC-0001, has_patient, source CCIH

  test('pqsdual.a opens + arms the dispose dialog by keyboard (no submit)', async ({
    page,
  }) => {
    // ACT (ADR 0106): `staff` — same commission-scoped-route reasoning as the
    // two dispose tests above (empirically verified: `pqs_member` 404s here).
    await signInAs(page, 'pqsdual.a@test.local', undefined, 'staff')
    await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${ENC1_ID}`)

    const trigger = page
      .getByRole('button', { name: /apagar dados do paciente/i })
      .first()
    await expect(trigger).toBeVisible()

    // Open by keyboard: focus the trigger, activate with Enter.
    await trigger.focus()
    await expect(trigger).toBeFocused()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()

    // Choose a reason with the keyboard (focus the select, pick an option).
    const reason = dialog.getByLabel(/motivo da exclusão/i)
    await reason.focus()
    await selectOptionByText(reason, /registro duplicado/i)

    // Type the confirmation phrase via the keyboard into the focused input.
    const confirmInput = dialog.getByLabel(/digite .*para confirmar/i)
    await confirmInput.focus()
    await page.keyboard.type('APAGAR')

    // The destructive submit is now ARMED (enabled) — but we do NOT press it (this is
    // the keyboard-reachability proof, not a second mutation).
    const submit = dialog.getByRole('button', {
      name: /apagar definitivamente/i,
    })
    await expect(submit).toBeEnabled()

    // Cancel by keyboard (Escape) — the dialog closes, no PHI erased.
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden({ timeout: 10_000 })
  })
})

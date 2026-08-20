import { test, expect, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'

/**
 * DSR — "Direitos do Titular" (LGPD Art. 18 subject requests), ADR 0130 Slice 2.
 *
 * ⭐ WHAT THIS SPEC IS ACTUALLY FOR. Pilot-gate item 0 (`FUP-ACT-DISPOSE-UI`) says
 * no persona could both REACH a dispose affordance and PASS its gate: the referral
 * dialog existed but the case/event disposal actions had NO caller anywhere in the
 * app. The corridor below is that item, executed end to end in a browser —
 * Encarregado opens a request → the fan-out routes the work → a PQS operator
 * disposes from the inbox under their OWN session → the Encarregado closes with an
 * outcome and its legal basis.
 *
 * ⛔ THE FIXTURE IS BUILT, NOT BORROWED, AND THAT IS DELIBERATE. Disposal is
 * IRREVERSIBLE. Pointing this spec at a seeded event/referral would erase PHI that
 * ~900 other tests share, and the damage would outlive the run (`seed.sql` is a
 * contract). So the spec mints its own safety event + `event_patient` under a
 * unique MRN via the service role, disposes THAT, and deletes it afterwards by
 * IDENTITY (never by position — a positional cleanup has eaten seed rows here
 * before).
 *
 * Personas (password Test1234!), all org `rede-a` / Hospital Central A:
 *   staff1.ccih@test.local  seeded Encarregado (DPO) — a PLAIN staff member, which
 *                           is the point: they hold NO disposal-door arm.
 *   pqs.a@test.local        PQS operator — passes `dispose_event_phi`'s gate.
 *   staff3.ccih@test.local  plain staff, neither DPO nor executor → 404.
 *   platform@test.local     platform admin → 404 (ADR 0078 A35 noun rule).
 *
 * Serial — the tests share one request and mutate it in order. Run --workers=1.
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}

const ORG = 'rede-a'
const CONSOLE_URL = `/o/${ORG}/titulares`
const COMM_CCIH = 'a0000000-0000-0000-0000-0000000000a1'

/** Unique per run so a re-run never collides with a previous fixture. */
const RUN = Date.now().toString(36)
const FIXTURE_MRN = `DSR-E2E-${RUN}`
const FIXTURE_CODE = `DSRE2E-${RUN}`
const FILE_REF = `PROC-E2E-${RUN}`

let fixtureEventId = ''

function svcHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function svcInsert<T>(
  req: APIRequestContext,
  table: string,
  row: Record<string, unknown>,
): Promise<T> {
  const res = await req.post(`${SUPABASE_URL}/rest/v1/${table}`, {
    headers: svcHeaders({ Prefer: 'return=representation' }),
    data: row,
  })
  expect(res.ok(), `insert ${table}: ${await res.text()}`).toBeTruthy()
  return ((await res.json()) as T[])[0]
}

async function svcSelect<T = Record<string, unknown>>(
  req: APIRequestContext,
  table: string,
  qs: string,
): Promise<T[]> {
  const res = await req.get(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: svcHeaders(),
  })
  if (!res.ok()) return []
  return (await res.json()) as T[]
}

test.beforeAll(async ({ request }) => {
  // The fixture event lives in CCIH (Hospital Central A) and carries a unique MRN,
  // so `app.trg_xref_maintain` indexes exactly one patient_xref row for it.
  const event = await svcInsert<{ id: string }>(request, 'patient_safety_event', {
    code: FIXTURE_CODE,
    reporting_commission_id: COMM_CCIH,
    title: 'Evento de fixture — DSR E2E',
    has_patient: true,
  })
  fixtureEventId = event.id

  await svcInsert(request, 'event_patient', {
    event_id: fixtureEventId,
    sex: 'unknown',
    mrn: FIXTURE_MRN,
  })
})

test.afterAll(async ({ request }) => {
  // Cleanup BY IDENTITY. `dsr_tasks` cascades from `dsr_requests`; the xref row is
  // retained-and-stamped by design, so it is removed explicitly.
  for (const ref of [FILE_REF, `PROC-KB-${RUN}`]) {
    await request.delete(
      `${SUPABASE_URL}/rest/v1/dsr_requests?file_ref=eq.${encodeURIComponent(ref)}`,
      { headers: svcHeaders() },
    )
  }
  if (fixtureEventId) {
    await request.delete(
      `${SUPABASE_URL}/rest/v1/patient_xref?module=eq.event&entity_id=eq.${fixtureEventId}`,
      { headers: svcHeaders() },
    )
    await request.delete(
      `${SUPABASE_URL}/rest/v1/event_patient?event_id=eq.${fixtureEventId}`,
      { headers: svcHeaders() },
    )
    await request.delete(
      `${SUPABASE_URL}/rest/v1/patient_safety_event?id=eq.${fixtureEventId}`,
      { headers: svcHeaders() },
    )
  }
})

test('a plain member and a platform admin both get 404 on the console', async ({
  page,
}) => {
  await cachedSignIn(page, 'staff3.ccih@test.local')
  await page.goto(CONSOLE_URL)
  await expect(
    page.getByRole('heading', { name: /não encontramos esta página/i }),
  ).toBeVisible()

  // ⛔ The noun rule: platform_admin administers tenancy and identity, never
  // commission content or adjudication (ADR 0078 A35 / ADR 0130 D2).
  await cachedSignIn(page, 'platform@test.local')
  await page.goto(CONSOLE_URL)
  await expect(
    page.getByRole('heading', { name: /não encontramos esta página/i }),
  ).toBeVisible()
})

test('the console is reachable from the commission sidebar, and only by those it admits', async ({
  page,
}) => {
  // ⛔ A console nothing links to is a door nothing can reach. The Encarregado is a
  // plain committee member by design, so `/` lands them on their commission and
  // this sidebar entry is their ONLY route in — the same dual-hat problem the NSP
  // and quality-office entries beside it solve.
  await cachedSignIn(page, 'staff1.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih`)
  const link = page.getByRole('link', { name: 'Direitos do Titular' })
  await expect(link).toBeVisible()
  await link.click()
  await expect(
    page.getByRole('heading', { name: 'Direitos do Titular', level: 1 }),
  ).toBeVisible()

  // The vacuity control: a member of the SAME commission with neither the office
  // nor a routed task gets no entry at all. Without this, the assertion above
  // would pass just as well if the link were shown to everyone.
  await cachedSignIn(page, 'staff3.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih`)
  await expect(
    page.getByRole('link', { name: 'Direitos do Titular' }),
  ).toHaveCount(0)
})

test('the Encarregado opens a request and the fan-out routes the work', async ({
  page,
  request,
}) => {
  await cachedSignIn(page, 'staff1.ccih@test.local')
  await page.goto(CONSOLE_URL)

  await expect(
    page.getByRole('heading', { name: 'Direitos do Titular', level: 1 }),
  ).toBeVisible()

  const form = page.getByRole('form', { name: /registrar solicitação de titular/i })
  await form.getByLabel(/prontuário do titular/i).fill(FIXTURE_MRN)
  await form.getByLabel(/referência do processo/i).fill(FILE_REF)
  await form.getByRole('button', { name: /registrar solicitação/i }).click()

  await expect(page.getByText(/tarefas de execução distribuídas/i)).toBeVisible()
  await expect(page.getByRole('heading', { name: FILE_REF })).toBeVisible()

  // The fan-out is MECHANICAL: exactly one disposal task for the one indexed
  // record, plus the one residue check per request (Q12a).
  const tasks = await svcSelect<{ kind: string; entity_id: string | null }>(
    request,
    'dsr_tasks',
    `select=kind,entity_id&request_id=in.(${(
      await svcSelect<{ id: string }>(
        request,
        'dsr_requests',
        `select=id&file_ref=eq.${encodeURIComponent(FILE_REF)}`,
      )
    )
      .map((r) => r.id)
      .join(',')})`,
  )
  expect(tasks.map((t) => t.kind).sort()).toEqual([
    'dispose_event',
    'notify_scrub_check',
  ])
  expect(tasks.find((t) => t.kind === 'dispose_event')?.entity_id).toBe(
    fixtureEventId,
  )

  // ⚠ The Encarregado is a plain staff member and holds NO disposal-door arm —
  // the disposal task is routed to the PQS operators, not to them.
  await expect(
    page.getByRole('button', { name: /executar descarte/i }),
  ).toHaveCount(0)
})

test('the PQS executor disposes from the inbox under their own session', async ({
  page,
  request,
}) => {
  await cachedSignIn(page, 'pqs.a@test.local')
  await page.goto(CONSOLE_URL)

  const card = page
    .getByRole('article')
    .filter({ hasText: /descartar dados do evento/i })
    .first()
  await expect(card).toBeVisible()

  // The narrowed residue language is shown BEFORE the irreversible click — this
  // surface never ships ADR 0056's "tudo apagado" over-claim.
  await card.getByText(/o que o descarte apaga — e o que permanece/i).click()
  await expect(
    card.getByText(/preserva o histórico de governança/i),
  ).toBeVisible()

  await card.getByRole('button', { name: /executar descarte e concluir/i }).click()
  await expect(card.getByText('Concluída')).toBeVisible()

  // The module row — not the task — is the record of truth.
  const [event] = await svcSelect<{ phi_disposed_at: string | null }>(
    request,
    'patient_safety_event',
    `select=phi_disposed_at&id=eq.${fixtureEventId}`,
  )
  expect(event?.phi_disposed_at).not.toBeNull()

  const patient = await svcSelect(
    request,
    'event_patient',
    `select=event_id&event_id=eq.${fixtureEventId}`,
  )
  expect(patient).toHaveLength(0)
})

test('only the Encarregado closes it, and a refusal must carry its basis', async ({
  page,
}) => {
  // The executor who did the work still cannot close the request (Q16iii): they
  // never see the request lane at all.
  await cachedSignIn(page, 'pqs.a@test.local')
  await page.goto(CONSOLE_URL)
  await expect(
    page.getByRole('heading', { name: /solicitações \(encarregado\)/i }),
  ).toHaveCount(0)

  await cachedSignIn(page, 'staff1.ccih@test.local')
  await page.goto(CONSOLE_URL)

  const card = page.getByRole('article').filter({ hasText: FILE_REF }).first()
  await expect(card).toBeVisible()

  // ⚠ The basis cites the INSTITUTIONAL RETENTION POLICY, never CFM 1821/2007 —
  // counsel held that statute does not cover committee records, so citing it to a
  // data subject would be a false legal basis (ADR 0035 Amendment 1).
  await card.getByLabel(/desfecho/i).selectOption('refused_retention')
  await card
    .getByLabel(/fundamento informado ao titular/i)
    .fill('Política institucional de retenção de 20 anos.')
  await card.getByRole('button', { name: /encerrar solicitação/i }).click()

  // Refused: the substantive adjudication needs its recorded legal consultation
  // (ADR 0130 Amendment 1 item 3, PO-confirmed).
  // ⚠ Assert the REFUSAL MESSAGE, not the field label — the label is rendered as
  // soon as the outcome is picked, so asserting it would pass either way.
  await expect(
    card.getByText(/informe a referência da consulta jurídica/i),
  ).toBeVisible()

  await card.getByLabel(/consulta jurídica/i).fill(`Parecer ${RUN}/2026`)
  await card.getByRole('button', { name: /encerrar solicitação/i }).click()

  await expect(
    page
      .getByRole('article')
      .filter({ hasText: FILE_REF })
      .getByText(/recusada — retenção obrigatória/i),
  ).toBeVisible()
})

test('the intake form is fully keyboard-operable', async ({ page }) => {
  await cachedSignIn(page, 'staff1.ccih@test.local')
  await page.goto(CONSOLE_URL)

  const mrn = page.getByLabel(/prontuário do titular/i)
  await mrn.focus()
  await expect(mrn).toBeFocused()

  await page.keyboard.type('DSR-KEYBOARD-CHECK')
  await page.keyboard.press('Tab') // → atendimento
  await page.keyboard.press('Tab') // → referência do processo
  await expect(page.getByLabel(/referência do processo/i)).toBeFocused()
  await page.keyboard.type(`PROC-KB-${RUN}`)

  await page.keyboard.press('Tab') // → submit
  await expect(
    page.getByRole('button', { name: /registrar solicitação/i }),
  ).toBeFocused()

  // Submitting an MRN nobody has is legitimate and must succeed with an empty
  // mechanical tier — "we searched and found nothing" is a real DSR outcome.
  await page.keyboard.press('Enter')
  await expect(page.getByText(/tarefas de execução distribuídas/i)).toBeVisible()
  // The request this creates is removed by `afterAll`, by file_ref.
})

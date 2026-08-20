import { test, expect } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import { svcDelete, svcInsert, svcSelect } from './helpers/service-role'

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

const ORG = 'rede-a'
const CONSOLE_URL = `/o/${ORG}/titulares`
const COMM_CCIH = 'a0000000-0000-0000-0000-0000000000a1'
const COMM_FARMACIA = 'b0000000-0000-0000-0000-0000000000b1'

/** Unique per run so a re-run never collides with a previous fixture. */
const RUN = Date.now().toString(36)
const FIXTURE_MRN = `DSR-E2E-${RUN}`
const FIXTURE_CODE = `DSRE2E-${RUN}`
const FILE_REF = `PROC-E2E-${RUN}`

let fixtureEventId = ''
/** Captured at intake — the close/adjudication surface is per-request (Slice 3). */
let requestId = ''

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
    await svcDelete(
      request,
      'dsr_requests',
      `file_ref=eq.${encodeURIComponent(ref)}`,
    )
  }
  if (fixtureEventId) {
    await svcDelete(request, 'patient_xref', `module=eq.event&entity_id=eq.${fixtureEventId}`)
    await svcDelete(request, 'event_patient', `event_id=eq.${fixtureEventId}`)
    await svcDelete(request, 'patient_safety_event', `id=eq.${fixtureEventId}`)
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

  // ⭐ THE FAN-OUT HAS TWO TIERS AND THIS PIN MUST SEE BOTH (ADR 0130 Amdt 3
  // item 5). Mechanical: exactly one disposal task for the one indexed record,
  // plus the one residue check per request (Q12a). Attested: one `attest_review`
  // per commission of the hospital that HOLDS non-case free-text prose.
  //
  // ⚠ THE KIND MULTISET ALONE IS A WEAK PIN, and saying so here is the point.
  // Hospital Central A has exactly TWO commissions and BOTH hold prose (measured
  // 2026-08-20), so "one per prose-bearing commission" and "one per commission,
  // unconditionally" mint the identical array on this fixture — a regression that
  // deleted the predicate would keep this green. The differential that CAN see it
  // is pinned at the door, on Hospital B's two prose-free commissions
  // (`supabase/tests/350` t13/t14). What this spec adds that nothing else has is
  // the ROUTING: which commission each attestation landed on, and that the
  // per-commission ones carry NO entity while the disposal one carries the
  // fixture's.
  const [row] = await svcSelect<{ id: string }>(
    request,
    'dsr_requests',
    `select=id&file_ref=eq.${encodeURIComponent(FILE_REF)}`,
  )
  requestId = row.id

  const tasks = await svcSelect<{
    kind: string
    entity_id: string | null
    commission_id: string | null
    module: string | null
  }>(
    request,
    'dsr_tasks',
    `select=kind,entity_id,commission_id,module&request_id=eq.${requestId}`,
  )
  expect(tasks.map((t) => t.kind).sort()).toEqual([
    'attest_review',
    'attest_review',
    'dispose_event',
    'notify_scrub_check',
  ])

  const attestations = tasks.filter((t) => t.kind === 'attest_review')
  // Routed to the two commissions of THIS hospital, and to no other.
  expect(attestations.map((t) => t.commission_id).sort()).toEqual(
    [COMM_CCIH, COMM_FARMACIA].sort(),
  )
  // Entity-LESS: the per-commission sweep has no mechanical subject. An
  // entity-bearing attestation is the per-MEETING flavour, which needs a
  // `meeting_cases` link this fixture deliberately does not have.
  expect(attestations.map((t) => t.entity_id)).toEqual([null, null])
  expect(attestations.map((t) => t.module)).toEqual([null, null])

  const disposal = tasks.find((t) => t.kind === 'dispose_event')
  expect(disposal?.entity_id).toBe(fixtureEventId)
  expect(disposal?.commission_id).toBe(COMM_CCIH)
  // The residue check is hospital-scoped, not commission-scoped (Q12a).
  expect(
    tasks.find((t) => t.kind === 'notify_scrub_check')?.commission_id,
  ).toBeNull()

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
  //
  // ⛔ THIS IS THE KEYSTONE OF THE WHOLE PHI-DISPOSAL CORRIDOR, and it was
  // vacuous in TWO independent ways at once (QA r1 B2):
  //   1. the local `svcSelect` returned `[]` on a FAILED READ, turning "the
  //      request errored" into "the table is empty" — now fixed at the source by
  //      importing the asserting helper, which every spec should use;
  //   2. `event?.phi_disposed_at` yields `undefined` for an ABSENT ROW, and
  //      `undefined` PASSES `.not.toBeNull()`. Optional chaining is what converts
  //      a missing subject into a passing assertion.
  // Both had to go: fixing only (1) leaves a legitimately empty result set still
  // reporting that PHI was erased. The row's EXISTENCE is asserted first, so the
  // value assertion below can only ever be about a row that is really there.
  const events = await svcSelect<{ phi_disposed_at: string | null }>(
    request,
    'patient_safety_event',
    `select=phi_disposed_at&id=eq.${fixtureEventId}`,
  )
  expect(
    events,
    'the fixture event row is gone — an absent row must not be read as "disposed"',
  ).toHaveLength(1)
  expect(events[0].phi_disposed_at).not.toBeNull()

  const patient = await svcSelect(
    request,
    'event_patient',
    `select=event_id&event_id=eq.${fixtureEventId}`,
  )
  expect(patient).toHaveLength(0)
})

/**
 * ⭐ REWRITTEN FOR SLICE 3'S RELOCATION, AND THE PAIRING IS WHAT WAS PRESERVED.
 *
 * Slice 3 moved adjudication and close off the console card and onto the
 * request's own page (`/o/[org]/titulares/[requestId]`); the card is now a
 * `Link`. That broke this test's selectors — but relocating the selectors alone
 * would have destroyed its POINT. Its purpose was never "the outcome form works":
 * it was **"only the Encarregado closes it" (Q16iii) paired against an executor
 * who cannot**, and a pairing only means something when both principals are
 * measured against the SAME surface. So the executor half now targets the
 * relocated surface too — `pqs.a` is a real executor who DID the disposal in the
 * previous test and still 404s on the request itself, which is the actual
 * boundary now that close lives there. Asserting only that they see no request
 * lane on the console would be a UI-hiding check, and Rule 1 says UI hiding is
 * never the boundary.
 *
 * ⚠ AND THE REFUSAL HALF GOT STRONGER, NOT JUST MOVED. Slice 3 made close a
 * TWO-PHASE act: `adjudicate_dsr_request` records the decision, `close_dsr_request`
 * CONSUMES it. The legal-consultation refusal this test has always asserted now
 * belongs to the adjudication step, so that is where it is asserted — and the
 * prefilled basis is checked to cite the institutional retention policy and NOT
 * CFM 1821/2007, which is the substantive claim ADR 0035 Amdt 1 turns on.
 */
test('only the Encarregado closes it, and a refusal must carry its basis', async ({
  page,
  request,
}) => {
  const detailUrl = `${CONSOLE_URL}/${requestId}`

  // ── The executor half of the pairing, on BOTH surfaces ──────────────────
  // They did the work in the previous test and still cannot decide or close it.
  await cachedSignIn(page, 'pqs.a@test.local')
  await page.goto(CONSOLE_URL)
  await expect(
    page.getByRole('heading', { name: /solicitações \(encarregado\)/i }),
  ).toHaveCount(0)
  // ⛔ THE REAL BOUNDARY: close now lives on the request page, so the executor
  // must be refused THERE, not merely un-shown a heading.
  await page.goto(detailUrl)
  await expect(
    page.getByRole('heading', { name: /não encontramos esta página/i }),
  ).toBeVisible()
  await expect(page.getByText(FILE_REF)).toHaveCount(0)

  // ── The Encarregado half, same URL ──────────────────────────────────────
  await cachedSignIn(page, 'staff1.ccih@test.local')
  await page.goto(detailUrl)
  await expect(page.getByRole('heading', { name: FILE_REF, level: 1 })).toBeVisible()

  const panel = page.getByRole('region', { name: 'Registrar decisão' })
  await panel.getByLabel('Desfecho', { exact: true }).selectOption('refused_retention')

  // ⚠ THE BASIS IS PREFILLED FROM `DSR_REFUSAL_RETENTION_BASIS`, and what it says
  // is the point: the INSTITUTIONAL 20-year retention policy, never CFM
  // 1821/2007. Counsel held that statute does not attach to committee records, so
  // citing it to a data subject would be a FALSE LEGAL BASIS (ADR 0035 Amdt 1
  // holding 1). This text is delivered to the subject verbatim.
  const basis = panel.getByLabel(/fundamento informado ao titular/i)
  await expect(basis).toHaveValue(/política institucional de retenção/i)
  await expect(basis).not.toHaveValue(/CFM/i)
  await expect(basis).not.toHaveValue(/1821/)

  await panel.getByRole('button', { name: 'Registrar decisão', exact: true }).click()

  // Refused: the substantive adjudication needs its recorded legal consultation
  // (ADR 0130 Amendment 1 item 3, PO-confirmed).
  // ⚠ Assert the REFUSAL MESSAGE, not the field label — the label is rendered as
  // soon as the outcome is picked, so asserting it would pass either way.
  await expect(
    panel.getByText(/informe a referência da consulta jurídica/i),
  ).toBeVisible()
  expect(
    (
      await svcSelect<{ adjudicated_at: string | null }>(
        request,
        'dsr_requests',
        `select=adjudicated_at&id=eq.${requestId}`,
      )
    )[0].adjudicated_at,
    'the refused submit must not have recorded a decision',
  ).toBeNull()

  await panel.getByLabel(/consulta jurídica/i).fill(`Parecer ${RUN}/2026`)
  await panel.getByRole('button', { name: 'Registrar decisão', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: /decisão: recusada — retenção obrigatória/i }),
  ).toBeVisible()

  // ⚠ A REFUSAL CLOSES OVER OUTSTANDING WORK, AND THAT IS BY DESIGN — measured
  // from the live door: `close_dsr_request` counts pending tasks ONLY for
  // `granted`/`granted_partial`. The attestations are still open here, and the
  // close must still succeed; a spec that assumed otherwise would report a
  // correct refusal path as broken.
  const pendingBefore = await svcSelect<{ id: string }>(
    request,
    'dsr_tasks',
    `select=id&request_id=eq.${requestId}&status=eq.pending`,
  )
  expect(pendingBefore.length).toBeGreaterThan(0)

  await page
    .getByRole('region', { name: 'Encerrar solicitação' })
    .getByRole('button', { name: 'Encerrar solicitação', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Solicitação encerrada', exact: true }),
  ).toBeVisible()

  const [closed] = await svcSelect<{
    status: string
    outcome: string
    outcome_basis: string
    legal_consultation_ref: string
    closed_by: string | null
  }>(
    request,
    'dsr_requests',
    `select=status,outcome,outcome_basis,legal_consultation_ref,closed_by&id=eq.${requestId}`,
  )
  expect(closed.status).toBe('closed')
  expect(closed.outcome).toBe('refused_retention')
  expect(closed.legal_consultation_ref).toBe(`Parecer ${RUN}/2026`)
  // The basis delivered to the subject, in the record — and still not CFM.
  expect(closed.outcome_basis).toMatch(/política institucional de retenção/i)
  expect(closed.outcome_basis).not.toMatch(/CFM|1821/)
  expect(closed.closed_by).not.toBeNull()

  // ⭐ THE OTHER HALF, AND PINNING ONLY THE FIRST WOULD ENDORSE A DEFECT THAT NO
  // LONGER EXISTS. A non-erasing close does not merely tolerate outstanding work —
  // it RETIRES it. The decision was to RETAIN, so the erasure was withdrawn, and
  // leaving those tasks actionable would let someone execute an erasure the
  // adjudication refused.
  //
  // ⚠ `blocked` HERE MEANS *RETIRED BY DECISION*, NOT *WAITING*. The value alone
  // cannot say which — the distinction lives one join away, in this request's
  // `status = 'closed'` plus a non-granting `outcome`, both asserted above. That
  // is why this assertion sits after those and not on its own.
  const after = await svcSelect<{ id: string; status: string }>(
    request,
    'dsr_tasks',
    `select=id,status&request_id=eq.${requestId}`,
  )
  const retiredIds = after.filter((t) => t.status === 'blocked').map((t) => t.id)
  expect(
    retiredIds.sort(),
    'every task left pending at a refusing close must be retired, not left open',
  ).toEqual(pendingBefore.map((t) => t.id).sort())
  expect(after.filter((t) => t.status === 'pending')).toHaveLength(0)

  // And retired means NOT ACTIONABLE on screen — an affordance the door refuses is
  // the mismatch ADR 0130 Amdt 2 item 5 was written about.
  const retiredCard = page
    .getByRole('article')
    .filter({
      has: page.getByRole('heading', {
        name: 'Revisar e atestar o texto livre da comissão',
        exact: true,
      }),
    })
    .first()
  await expect(retiredCard.getByText('Encerrada', { exact: true })).toBeVisible()
  await expect(
    retiredCard.getByRole('button', { name: /atestar revisão/i }),
    'a retired task must not offer the attestation the door now refuses',
  ).toHaveCount(0)

  // ⛔ AND THE REVOKE-CORRIDOR PROCEDURE MUST BE GONE WITH IT. A retired card that
  // still printed "reabrir a reunião, redigir o trecho e assinar novamente" would
  // instruct an executor to reopen and re-sign a meeting on a request that ordered
  // NO erasure — directly above the sentence telling them not to act. The regex
  // covers both voices because the minted `note` is infinitive and the attestation
  // form's "Como proceder" block is imperative; suppressing one and leaving the
  // other would satisfy a narrower assertion.
  //
  // ⚠ THIS IS ONE ARM OF A PAIR. Its twin — the procedure PRESENT on a LIVE
  // attestation — is asserted in `dsr-slice3-adjudication.spec.ts` test 7. Without
  // that twin this assertion is satisfied by never rendering the corridor at all,
  // which would silently turn a safety fix into the loss of an ADR 0130 D7 record.
  await expect(
    retiredCard.getByText(/rea(brir|bra) a reunião/i),
    'a retired task must not carry the revoke-corridor procedure',
  ).toHaveCount(0)

  // ── The pairing's vacuity control ───────────────────────────────────────
  // The executor still cannot reach the closed request. Without this, the 404
  // above could have been a transient state of an open request rather than a
  // property of who they are.
  await cachedSignIn(page, 'pqs.a@test.local')
  await page.goto(detailUrl)
  await expect(
    page.getByRole('heading', { name: /não encontramos esta página/i }),
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

/**
 * ⭐ TERMINAL, AND CURRENTLY RED — BUG-DSR-S3-007.
 *
 * Placed last because this file is a serial chain: a red anywhere earlier aborts
 * every test after it and reports "1 failed" while hiding them. Terminally, it
 * costs exactly one red and hides nothing.
 *
 * ⛔ THE OUTCOME RECORD'S PARTS DO NOT SUM. `getDsrOutcomeRecord` computes a
 * `retired` count for BOTH tiers, and states the invariant in its own comment:
 *
 *     ⚠ THE PARTS MUST SUM: `total === disposed + pending + retired`. … A closed
 *     refusal reporting "0 pendentes" with no `retired` reads as completion.
 *
 * `dsr-outcome-record.tsx` renders three tallies per tier — total, disposed,
 * pending — and NEVER renders `retired` (measured: zero occurrences of the field
 * in `src/components/dsr/`). So after the refusal closed above, this request's
 * mechanical tier reports records located ≥ 1, descartados 0, pendentes 0, and
 * the difference is invisible.
 *
 * ⚠ WHY THIS IS A REAL DEFECT AND NOT COSMETIC. This is the artifact delivered to
 * the data subject, and the whole subject of ADR 0130 is that its claims be
 * honest. A census whose parts do not sum is wrong; one that silently drops the
 * retired remainder reads as COMPLETION of work that was deliberately withdrawn —
 * the over-claim family this program exists to end, reappearing one layer up from
 * where it was fixed. The data layer already reports the number; only the
 * presentation drops it.
 *
 * ⛔ DO NOT "FIX" THIS BY ASSERTING THE CURRENT NUMBERS. The current numbers are
 * the defect.
 *
 * Owner: `frontend` (`src/components/dsr/dsr-outcome-record.tsx`).
 */
test('the outcome record accounts for retired work instead of dropping it', async ({
  page,
  request,
}) => {
  await cachedSignIn(page, 'staff1.ccih@test.local')
  await page.goto(`${CONSOLE_URL}/${requestId}`)
  await expect(page.getByRole('heading', { name: FILE_REF, level: 1 })).toBeVisible()

  // The table is the truth this record must reflect.
  const rows = await svcSelect<{ kind: string; status: string }>(
    request,
    'dsr_tasks',
    `select=kind,status&request_id=eq.${requestId}`,
  )
  const attested = rows.filter((t) => t.kind === 'attest_review')
  const retired = attested.filter((t) => t.status === 'blocked').length
  // The precondition, asserted rather than assumed: with nothing retired there is
  // no remainder to drop and this pin would pass vacuously.
  expect(
    retired,
    'no retired attestation on this request — the sum cannot be shown broken',
  ).toBeGreaterThan(0)

  const tier = page
    .getByRole('region', { name: 'Registro de desfecho' })
    .getByRole('article')
    .filter({
      has: page.getByRole('heading', { name: 'Nível atestado', exact: true }),
    })
  const tally = (label: string) =>
    tier
      .locator('div')
      .filter({ has: page.locator('dt', { hasText: label }) })
      .locator('[data-countup]')

  const read = async (label: string) =>
    Number(await tally(label).getAttribute('data-countup'))

  const total = await read('Revisões solicitadas')
  const completed = await read('Revisões concluídas')
  expect(total).toBe(attested.length)

  // ⭐ THE PIN. Either the record shows the retired remainder, or its parts sum
  // without one. Today it does neither: total is 3, completed is 0, and nothing
  // on the page accounts for the 3 that were withdrawn.
  const shown = tier.locator('div').filter({
    has: page.locator('dt', { hasText: 'Retiradas' }),
  })
  await expect(
    shown,
    `BUG-DSR-S3-007 — ${retired} retired review(s) are reported nowhere; ` +
      'a closed refusal showing "0 concluídas" with no remainder reads as completion',
  ).toHaveCount(1)

  // ⭐ THE STRONGEST FORM AVAILABLE IS CROSS-LAYER, so that is what is asserted:
  // the RENDERED remainder must equal the count of `blocked` rows in the table.
  // A within-page arithmetic check can only ever restate what the component
  // computed; this one can catch the component computing it wrongly.
  expect(Number(await read('Retiradas'))).toBe(retired)

  // ⭐ EXACT SUM, NOT AT-MOST — and the reason it is now legitimate is a MEASURED
  // change, not a preference. The attested tier previously exposed no `pending`
  // field, so pending was a DERIVED remainder and an exact-sum check over it was a
  // tautology that could never fail. `getDsrOutcomeRecord` now returns a real
  // `attested.pending` (a filter on `status = 'pending'`, measured in the query
  // layer), and `TierAtMost` is deleted — 0 references remain. With three real
  // fields the sum is falsifiable again: a build that dropped `retired` would
  // render `0 + 0 = 2` and fail this.
  //
  // ⚠ THE TWO TIERS RENDER THEIR PARTS IN DIFFERENT ORDERS — measured from
  // `dsr-outcome-record.tsx`, not assumed: mechanical is
  // [disposed, pending, retired] and attested is [completed, retired, pending].
  // Reusing one order for both would produce a passing assertion on one tier and a
  // confusing red on the other.
  //
  // ⛛ The expected string is DERIVED FROM THE TABLE, never hardcoded. A literal
  // would encode this fixture's shape and go quietly wrong the moment the fixture
  // changed — while still passing on the day it was written.
  const attCompleted = attested.filter((t) => t.status === 'done').length
  const attPending = attested.filter((t) => t.status === 'pending').length
  await expect(
    tier.getByText(
      `${attCompleted} + ${retired} + ${attPending} = ${attested.length}`,
      { exact: true },
    ),
    'the attested tier must state its arithmetic, and it must be the real one',
  ).toBeVisible()
  expect(completed).toBe(attCompleted)

  // The mechanical tier, in ITS order.
  const mech = rows.filter((t) => t.kind.startsWith('dispose_'))
  const mechTier = page
    .getByRole('region', { name: 'Registro de desfecho' })
    .getByRole('article')
    .filter({
      has: page.getByRole('heading', { name: 'Nível mecânico', exact: true }),
    })
  await expect(
    mechTier.getByText(
      `${mech.filter((t) => t.status === 'done').length} + ` +
        `${mech.filter((t) => t.status === 'pending').length} + ` +
        `${mech.filter((t) => t.status === 'blocked').length} = ${mech.length}`,
      { exact: true },
    ),
  ).toBeVisible()

  // No discrepancy is reported on this record. ⛔ This is NOT coverage of
  // `TierSum`'s alert arm — see the canary below for why that arm cannot fire.
  await expect(
    page.getByRole('region', { name: 'Registro de desfecho' }).getByRole('alert'),
  ).toHaveCount(0)
})

/**
 * ⛔ THIS IS A DATA CANARY, NOT COVERAGE OF `TierSum`'s DISCREPANCY ARM — and the
 * previous version of this test claimed otherwise in its own name, which is the
 * defect QA r1 (m1) named.
 *
 * WHAT IT ACTUALLY DOES: samples the statuses present on THIS request and checks
 * each is one the outcome record's tiers count. That fires only once a rogue
 * status is already in the data, which is strictly weaker than pinning the
 * constraint that keeps it out.
 *
 * WHY NOT PIN THE CONSTRAINT HERE: the claim is about
 * `dsr_tasks_status_check: status = ANY (ARRAY['pending','done','blocked'])` plus
 * `status NOT NULL`, both read from the live catalog. PostgREST does not expose
 * `pg_catalog`, so an E2E spec structurally cannot assert it; that belongs in
 * pgTAP, which is `backend`'s.
 *
 * ⭐ WHY THE ARM STILL MATTERS. Three exhaustive, mutually exclusive filters over
 * a NOT NULL column PARTITION the rows, so the parts sum identically and the arm
 * cannot fire today. It is NOT dead code: it becomes reachable the instant a
 * FOURTH status is admitted — such a row counts in `total` but matches none of the
 * filters. That is exactly the class that bit this slice, when `blocked` sat in
 * the CHECK admitted-but-unwritten until a writer began producing it.
 *
 * ⛔ THE PROPER INSTRUMENT IS A UNIT TEST, AND IT IS NOT MINE TO WRITE.
 * `TierSum` is a PURE function, so the arm is directly constructible —
 * `<TierSum total={3} parts={[1, 1, 0]} />` must render the `role="alert"`
 * discrepancy text. It is module-private in `dsr-outcome-record.tsx`, so it needs
 * exporting first; both that export and a colocated
 * `src/components/dsr/dsr-outcome-record.test.tsx` are `frontend`'s files, and the
 * precedent exists (`src/components/forms/item-editor-dialog.test.tsx`).
 * Recommended to `frontend`; until it exists, THE ARM IS UNTESTED and this test
 * does not pretend otherwise.
 */
test('every live task status is one the outcome record actually counts', async ({
  request,
}) => {
  const rows = await svcSelect<{ status: string }>(
    request,
    'dsr_tasks',
    `select=status&request_id=eq.${requestId}`,
  )
  // Anti-vacuity: with no rows the partition claim is empty.
  expect(rows.length, 'no tasks on this request — nothing to partition').toBeGreaterThan(0)

  const admitted = new Set(['pending', 'done', 'blocked'])
  const rogue = rows.map((r) => r.status).filter((s) => !admitted.has(s))
  expect(
    rogue,
    'a status outside the three values admitted by dsr_tasks_status_check is ' +
      'live. The TierSum discrepancy arm is now REACHABLE and has never been ' +
      'tested: write its test before trusting any outcome-record arithmetic.',
  ).toEqual([])
})

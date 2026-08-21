import { test, expect } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import {
  createDsrFixture,
  destroyDsrFixture,
  svcSelect,
  DSR_COMM_CCIH,
  DSR_ORG,
  type DsrFixture,
} from './helpers/dsr-fixture'

/**
 * DSR Slice 3 — the MEETING ESCALATION, on its own, because it is the one
 * corridor nothing had ever executed and it does not work (BUG-DSR-S3-001).
 *
 * ⭐ WHY THIS IS A SEPARATE FILE. `dsr-slice3-adjudication.spec.ts` is a serial
 * chain: a failure at the escalation step would abort the seven tests after it,
 * and "1 failed" would silently hide them (a fixture abort has already hidden 37
 * tests behind a single red in this program). The escalation therefore gets its
 * own file, so this red stays exactly one red and the rest of the lane keeps
 * reporting.
 *
 * ⛔ WHAT IS BROKEN, measured. `adjudicate_dsr_request(p_dispose_meeting_ids)`
 * validates and mints against MEETING ids:
 *
 *     where not exists (select 1 from public.dsr_tasks t
 *       where t.request_id = p_request_id and t.kind = 'attest_review'
 *         and t.module = 'meeting' and t.entity_id = u.id)
 *     ...
 *     from public.meetings m where m.id = any(v_ids)
 *
 * while `DsrAdjudicationPanel` posts `meeting.taskId` — a `dsr_tasks.id`.
 * `list_dsr_disposable_meetings` returns BOTH keys (`'taskId', t.id` and
 * `'meetingId', m.id`) and the panel picks the wrong one, so every escalation is
 * refused HCDS2 with "N reunião(ões) informada(s) não pertence(m) à enumeração
 * desta solicitação".
 *
 * ⛔ THE CONSEQUENCE IS BIGGER THAN ONE FORM. The adjudication escalation is the
 * ONLY minter of `dispose_meeting` anywhere (ADR 0130 Amendment 2 item 3 removed
 * it from the intake fan-out deliberately). So while this is broken, the
 * meetings-dispose UI — ADR 0056 Consequence (a)'s never-built affordance, which
 * ADR 0130 Amendment 3 records as discharged in Slice 3 — is a door nothing can
 * reach, exactly the failure the amendment says moving it to Slice 3 avoided.
 *
 * ⚠ THIS SPEC MUST NOT BE "FIXED" BY ASSERTING THE REFUSAL. The refusal is the
 * defect. Asserting it would turn a red pin into a green one that documents the
 * bug as intended behaviour — the pin-goes-vacuous family.
 *
 * Serial; run --workers=1.
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

const RUN = Date.now().toString(36)
const TAG = `S3ESC-${RUN}`
const FILE_REF = `PROC-${TAG}`
const CONSOLE_URL = `/o/${DSR_ORG}/titulares`

let fixture: DsrFixture | null = null
let requestId = ''

test.beforeAll(async ({ request }) => {
  fixture = await createDsrFixture(request, TAG)
})

test.afterAll(async ({ request }) => {
  await destroyDsrFixture(request, fixture, [FILE_REF])
})

test('escalating an ata in the adjudication mints its dispose_meeting task', async ({
  page,
  request,
}) => {
  const subject = fixture as DsrFixture

  await cachedSignIn(page, 'staff1.ccih@test.local')
  await page.goto(CONSOLE_URL)

  const form = page.getByRole('form', { name: /registrar solicitação de titular/i })
  await form.getByLabel(/prontuário do titular/i).fill(subject.mrn)
  await form.getByLabel(/referência do processo/i).fill(FILE_REF)
  await form.getByRole('button', { name: /registrar solicitação/i }).click()
  await expect(page.getByText(/tarefas de execução distribuídas/i)).toBeVisible()

  const [row] = await svcSelect<{ id: string }>(
    request,
    'dsr_requests',
    `select=id&file_ref=eq.${encodeURIComponent(FILE_REF)}`,
  )
  requestId = row.id

  // The precondition, asserted rather than assumed: the fan-out enumerated this
  // ata as an `attest_review`, which is what makes it escalatable at all. If this
  // were absent the escalation SHOULD be refused, and the pin below would be
  // measuring the wrong thing.
  const [ataTask] = await svcSelect<{ entity_id: string }>(
    request,
    'dsr_tasks',
    `select=entity_id&request_id=eq.${requestId}&kind=eq.attest_review&module=eq.meeting`,
  )
  expect(ataTask?.entity_id).toBe(subject.meetingId)

  await page.goto(`${CONSOLE_URL}/${requestId}`)
  const panel = page.getByRole('region', { name: 'Registrar decisão' })
  await panel.getByLabel('Desfecho', { exact: true }).selectOption('granted')
  await panel.getByLabel(/consulta jurídica/i).fill(`Parecer ${TAG}`)

  // ⛔ THE FIELDSET'S PRESENCE IS ASSERTED BEFORE ITS CONTENTS, and that ordering
  // is the anti-vacuity guard. The escalation fieldset renders ONLY when the
  // fan-out enumerated at least one non-disposed linked ata; on seed-only state it
  // never renders at all, because the seed's single `meeting_cases` row points at
  // a different case than the seeded MRN resolves to. A spec that went straight to
  // `getByRole('checkbox')` would fail with "expected 1, got 0" — indistinguishable
  // from a product regression, and worse, a spec that only ever asserted the
  // MINTED ROW would go GREEN having escalated nothing. Name the fieldset first,
  // so an absent one accuses the fixture and a present one licenses the rest.
  const escalation = page.getByRole('group', {
    name: /escalar reuniões para descarte da ata/i,
  })
  await expect(
    escalation,
    'the escalation fieldset did not render — the fixture failed to link a ' +
      'non-disposed ata to the enumerated case, so nothing below proves anything',
  ).toBeVisible()

  const box = escalation.getByRole('checkbox')
  await expect(box).toHaveCount(1)
  await box.check()
  // Checked BEFORE submitting: an unchecked box submits an empty escalation set,
  // and the door would then correctly mint nothing — a red that would read as the
  // bug still being present.
  await expect(box).toBeChecked()

  await panel.getByRole('button', { name: 'Registrar decisão', exact: true }).click()

  // ⭐ THE PIN. The decision must be recorded AND the escalation must mint exactly
  // one `dispose_meeting` task, for the ata that was ticked.
  await expect(
    page.getByRole('heading', { name: /decisão: atendida/i }),
    'the adjudication must be accepted — an escalation the door refuses (HCDS2) ' +
      'leaves the decision unrecorded as well',
  ).toBeVisible()

  const minted = await svcSelect<{ entity_id: string; commission_id: string; status: string }>(
    request,
    'dsr_tasks',
    `select=entity_id,commission_id,status&request_id=eq.${requestId}&kind=eq.dispose_meeting`,
  )
  expect(minted).toHaveLength(1)
  expect(minted[0].entity_id).toBe(subject.meetingId)
  expect(minted[0].commission_id).toBe(DSR_COMM_CCIH)
  expect(minted[0].status).toBe('pending')

  // And the affordance it exists for becomes reachable — ADR 0056 Consequence
  // (a)'s meetings-dispose UI, which has no other route in.
  await cachedSignIn(page, 'chefe.ccih@test.local')
  await page.goto(CONSOLE_URL)
  await expect(
    page
      .getByRole('article')
      .filter({
        has: page.getByRole('heading', {
          name: 'Descartar a ata da reunião',
          exact: true,
        }),
      })
      .getByRole('button', { name: 'Descartar a ata', exact: true }),
  ).toBeVisible()
})

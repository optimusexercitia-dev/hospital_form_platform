import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import { svcDelete, svcInsert, svcSelect } from './helpers/service-role'

/**
 * DSR Slice 3 — adjudication, the attested tier, the meetings-dispose lane
 * (ADR 0130 Amendment 3).
 *
 * ⭐ WHAT THIS SPEC IS ACTUALLY FOR. Slice 2's spec proved a request can be
 * OPENED and one event disposed. Slice 3 added four corridors that, at the point
 * this spec was written, NOTHING had executed end to end: `frontend` verified the
 * affordances RENDER and said plainly it fired none of them; `backend`'s pgTAP
 * covers the DOORS. So every test below drives a real browser through a real
 * server action into a real door, and asserts the DB effect — never the fact that
 * a button exists.
 *
 * The four:
 *   1. A disposal EXECUTED from the inbox, and — the load-bearing half — proof
 *      that the task moves to done BECAUSE the disposal happened. The DSR never
 *      fires a door on the executor's behalf (ADR 0130 Decision 2); the door's
 *      EFFECT check (`phi_disposed_at`) is what completes the task (Amdt 2 item 2).
 *      The test therefore tries to complete the task FIRST and requires HCDS3.
 *   2. `adjudicate_dsr_request` submitted through the form, including the per-
 *      meeting escalation that mints the ONLY `dispose_meeting` task the system
 *      can ever mint (Amdt 2 item 3 / Amdt 3 item 4).
 *   3. The two-phase close: refused (HCDS4) while work is outstanding, and
 *      succeeding once it is not.
 *   4. `dispose_meeting` COMPLETED, plus the attested tier attested — so the
 *      outcome record reports numbers that came from work that actually happened.
 *
 * ⚠ THIS DOCBLOCK USED TO LIST `notify_scrub_check` ALONGSIDE `dispose_meeting`
 * IN ITEM 4. `create_dsr_request` no longer mints that kind at all (ADR 0130
 * Amdt 4 reached the code in `20261003000100` — the withdrawal had been sitting
 * in the ADR, unenacted, since 2026-08-20): the residue class it existed to
 * check was proved absent, not merely reviewed. Test 7 below no longer drives a
 * minted scrub card; test 11 (BUG-DSR-S3-003) constructs one directly, because
 * it is the file's only live specimen of a hospital-scoped, commission-less
 * task, and its docblock explains why that construction is necessary.
 *

 * ⛔ THE FIXTURE IS BUILT, NOT BORROWED. Disposal is IRREVERSIBLE and this spec
 * disposes a case AND a whole meeting's ata. Pointing either at a seeded row
 * would erase records ~900 other tests share, and the damage would outlive the
 * run (`seed.sql` is a contract). So the spec mints its own case + patient
 * participant under a unique MRN, its own meeting with its own agenda prose, and
 * the `meeting_cases` link between them — then removes all of it BY IDENTITY.
 *
 * ⚠ THE ONE FIXTURE SHAPE THAT IS NOT OBVIOUS. `patient_xref` keys the CASE module
 * on a `patient_participants` id, NOT a case id (ADR 0130 plan § Slice 2), and the
 * meeting lane fires off `meeting_cases` — which is why the fixture needs the
 * participant, the case, the meeting AND the link. Take any one away and the
 * fan-out silently mints a smaller set.
 *
 * Personas (password Test1234!), org `rede-a` / Hospital Central A:
 *   staff1.ccih@test.local  the seeded Encarregado (DPO). A PLAIN staff member —
 *                           they hold NO disposal-door arm, which is the point.
 *   chefe.ccih@test.local   staff_admin of CCIH — passes `dispose_case_phi` AND
 *                           `dispose_meeting_minutes` for CCIH.
 *   staff3.ccih@test.local  plain staff, neither DPO nor executor → 404.
 *   pqs.a@test.local        an executor who is NOT the DPO → 404 on the request.
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
const CCIH_NAME = 'Comissão de Controle de Infecção Hospitalar'
const FARMACIA_NAME = 'Comissão de Farmácia e Terapêutica'

/** Unique per run so a re-run never collides with a previous fixture. */
const RUN = Date.now().toString(36)
const FIXTURE_MRN = `DSR-S3-${RUN}`
const FILE_REF = `PROC-S3-${RUN}`
const CASE_LABEL = `Caso de fixture DSR S3 ${RUN}`
const MEETING_TITLE = `Reunião de fixture DSR S3 ${RUN}`
const AGENDA_TITLE = `Pauta de fixture ${RUN}`
const AGENDA_PROSE = `Discussão de fixture ${RUN} — texto livre que o descarte da ata apaga.`
const MINUTES = `Ata de fixture ${RUN}. Este texto deve desaparecer no descarte integral.`

let caseId = ''
let participantId = ''
let meetingId = ''
let requestId = ''
let detailUrl = ''

type TaskRow = {
  id: string
  kind: string
  module: string | null
  entity_id: string | null
  commission_id: string | null
  status: string
  attested_by_name: string | null
  attested_redactions: number | null
}

/** Every task of the fixture request, straight from the table. */
async function tasks(req: APIRequestContext): Promise<TaskRow[]> {
  return svcSelect<TaskRow>(
    req,
    'dsr_tasks',
    `select=id,kind,module,entity_id,commission_id,status,attested_by_name,attested_redactions&request_id=eq.${requestId}`,
  )
}

/** One tier of the two-tier outcome record. */
function tier(page: Page, name: 'Nível mecânico' | 'Nível atestado') {
  return page
    .getByRole('region', { name: 'Registro de desfecho' })
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name, exact: true }) })
}

/**
 * One tally of the outcome record, read from `data-countup`.
 *
 * ⚠ THE ATTRIBUTE, NOT THE TEXT, AND THAT IS THE POINT. The visible numeral is
 * animated from 0 by `DsrRecordMotion`, which rewrites `textContent` on the
 * `aria-hidden` node — but it never touches `data-countup`. So this reads the
 * SERVER-RENDERED value and is immune to the animation BY CONSTRUCTION, where
 * reading text is only safe as long as `prefers-reduced-motion` keeps behaving. A
 * test whose correctness rests on an animation preference has a hidden
 * precondition.
 *
 * ⛔ SCOPED TO ONE TIER, DELIBERATELY. "Menções removidas" is NOT unique on this
 * page — the outcome record has one and every completed attestation card renders
 * another in its own `<dl>` (four matches in a finished request). An unscoped
 * lookup is a strict-mode failure waiting for whichever assertion reaches it
 * first. The tier's `<article>` is named by its heading, so this cannot drift onto
 * a task card.
 *
 * ⚠ `dt`/`dd` BY TAG, NOT BY `getByRole('term')`. The `term`/`definition` roles
 * were part of the locator chain that resolved to nothing in the gate run
 * (`:822`); the tags are structural and cannot be wrong. `hasText` is a substring
 * match, which is safe ONLY because it is bounded to one tier whose three labels
 * share no substring.
 */
function tally(
  page: Page,
  tierName: 'Nível mecânico' | 'Nível atestado',
  label: string,
) {
  return tier(page, tierName)
    .locator('div')
    .filter({ has: page.locator('dt', { hasText: label }) })
    .locator('[data-countup]')
}

/** The task card whose heading is exactly `heading`, optionally in `commission`. */
function taskCard(page: Page, heading: string, commission?: string) {
  const card = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: heading, exact: true }) })
  return commission ? card.filter({ hasText: commission }) : card
}

test.beforeAll(async ({ request }) => {
  // ⚠ The template version is a GENERATED uuid — it changes on every
  // `supabase db reset`, so it is looked up, never hardcoded.
  const [seededCase] = await svcSelect<{ template_version_id: string }>(
    request,
    'cases',
    `select=template_version_id&commission_id=eq.${COMM_CCIH}&template_version_id=not.is.null&limit=1`,
  )
  const [chefe] = await svcSelect<{ id: string }>(
    request,
    'profiles',
    `select=id&email=eq.chefe.ccih@test.local`,
  )
  const [org] = await svcSelect<{ id: string }>(
    request,
    'organizations',
    `select=id&slug=eq.${ORG}`,
  )
  const [role] = await svcSelect<{ id: string }>(
    request,
    'case_participant_roles',
    `select=id&key=eq.affected_patient&organization_id=eq.${org.id}&limit=1`,
  )

  const kase = await svcInsert<{ id: string }>(request, 'cases', {
    commission_id: COMM_CCIH,
    template_version_id: seededCase.template_version_id,
    label: CASE_LABEL,
    created_by: chefe.id,
    // ADR 0137 D1 — `cases.patient_enabled` (boolean) was DROPPED; `patient_mode`
    // replaces it (`true` backfilled to `'optional'`). Set at INSERT — it is
    // immutable afterward (`app.guard_case_patient_mode_immutable`, HC0T3).
    patient_mode: 'optional',
    has_patient: true,
  })
  caseId = kase.id

  const participant = await svcInsert<{ id: string }>(request, 'participants', {
    organization_id: org.id,
    participant_type: 'patient',
    sensitivity_class: 'patient_phi',
    display_name: 'Paciente',
  })
  participantId = participant.id
  await svcInsert(request, 'patient_participants', {
    participant_id: participantId,
  })
  await svcInsert(request, 'case_participants', {
    case_id: caseId,
    participant_id: participantId,
    role_id: role.id,
    is_primary_subject: true,
    added_by: chefe.id,
  })
  // The insert that makes the xref exist: `trg_xref_maintain_patient_identifiers`
  // indexes the PARTICIPANT under module 'case'.
  await svcInsert(request, 'patient_identifiers', {
    participant_id: participantId,
    name: 'Paciente de Fixture',
    mrn: FIXTURE_MRN,
    sex: 'unknown',
  })

  const meeting = await svcInsert<{ id: string }>(request, 'meetings', {
    commission_id: COMM_CCIH,
    title: MEETING_TITLE,
    scheduled_start: new Date().toISOString(),
    created_by: chefe.id,
    minutes_md: MINUTES,
  })
  meetingId = meeting.id
  await svcInsert(request, 'meeting_agenda_items', {
    meeting_id: meetingId,
    position: 1,
    title: AGENDA_TITLE,
    description: AGENDA_PROSE,
    discussion_notes: AGENDA_PROSE,
    resolution: AGENDA_PROSE,
    created_by: chefe.id,
  })
  // The ONLY mechanical signal linking a meeting to a subject (ADR 0130 Amdt 2
  // item 3). Without this row the meeting lane cannot fire at all.
  await svcInsert(request, 'meeting_cases', {
    meeting_id: meetingId,
    case_id: caseId,
  })
})

test.afterAll(async ({ request }) => {
  // ⛔ CLEANUP BY IDENTITY, NEVER BY POSITION — a positional cleanup has eaten
  // seed rows in this repo. `dsr_tasks` cascades from `dsr_requests`; deleting
  // the participant cascades `patient_participants` / `patient_identifiers` /
  // `case_participants`; the xref row is retained-and-stamped by design and so
  // is removed explicitly.
  await svcDelete(
    request,
    'dsr_requests',
    `file_ref=eq.${encodeURIComponent(FILE_REF)}`,
  )
  if (meetingId) {
    await svcDelete(request, 'meeting_cases', `meeting_id=eq.${meetingId}`)
    await svcDelete(request, 'meeting_agenda_items', `meeting_id=eq.${meetingId}`)
    await svcDelete(request, 'meetings', `id=eq.${meetingId}`)
  }
  if (participantId) {
    await svcDelete(
      request,
      'patient_xref',
      `module=eq.case&entity_id=eq.${participantId}`,
    )
    await svcDelete(request, 'patient_identifiers', `participant_id=eq.${participantId}`)
    await svcDelete(request, 'case_participants', `participant_id=eq.${participantId}`)
    await svcDelete(request, 'patient_participants', `participant_id=eq.${participantId}`)
    await svcDelete(request, 'participants', `id=eq.${participantId}`)
  }
  if (caseId) {
    await svcDelete(request, 'case_participants', `case_id=eq.${caseId}`)
    await svcDelete(request, 'cases', `id=eq.${caseId}`)
  }
})

// ===========================================================================
// 1 — Intake: the fan-out enumerates BOTH tiers, and routes each correctly.
// ===========================================================================

test('the fan-out enumerates the case, its ata and the prose-bearing commissions', async ({
  page,
  request,
}) => {
  await cachedSignIn(page, 'staff1.ccih@test.local')
  await page.goto(CONSOLE_URL)

  const form = page.getByRole('form', { name: /registrar solicitação de titular/i })
  await form.getByLabel(/prontuário do titular/i).fill(FIXTURE_MRN)
  await form.getByLabel(/referência do processo/i).fill(FILE_REF)
  await form.getByRole('button', { name: /registrar solicitação/i }).click()
  await expect(page.getByText(/tarefas de execução distribuídas/i)).toBeVisible()

  const [row] = await svcSelect<{ id: string; status: string }>(
    request,
    'dsr_requests',
    `select=id,status&file_ref=eq.${encodeURIComponent(FILE_REF)}`,
  )
  requestId = row.id
  detailUrl = `${CONSOLE_URL}/${requestId}`
  expect(row.status).toBe('open')

  const minted = await tasks(request)

  // ⭐ THE WHOLE FAN-OUT, both tiers, with routing. A kind multiset alone would
  // not distinguish "one attestation per PROSE-BEARING commission" from "one per
  // commission" — Hospital Central A has exactly two commissions and both hold
  // prose (measured). The differential is pinned at the door on Hospital B's
  // prose-free commissions (supabase/tests/350 t13/t14); what is pinned HERE is
  // that each task landed on the right scope with the right subject.
  // ⚠ NO `notify_scrub_check` HERE ANY MORE (ADR 0130 Amdt 4 reached the code in
  // `20261003000100`) — see the file docblock and BUG-DSR-S3-003 below.
  expect(minted.map((t) => t.kind).sort()).toEqual([
    'attest_review',
    'attest_review',
    'attest_review',
    'dispose_case',
  ])

  // The mechanical tier: the CASE, not the participant. The xref keys this module
  // on a `patient_participants` id and `dispose_case_phi` takes a CASE id — a
  // fan-out that carried the participant through would fail closed forever.
  const disposal = minted.find((t) => t.kind === 'dispose_case')
  expect(disposal?.entity_id).toBe(caseId)
  expect(disposal?.entity_id).not.toBe(participantId)
  expect(disposal?.commission_id).toBe(COMM_CCIH)

  // The attested tier, two flavours. Entity-BEARING = this ata; entity-LESS = a
  // whole commission's non-case free text.
  const attestations = minted.filter((t) => t.kind === 'attest_review')
  const perMeeting = attestations.filter((t) => t.module === 'meeting')
  const perCommission = attestations.filter((t) => t.module === null)
  expect(perMeeting).toHaveLength(1)
  expect(perMeeting[0].entity_id).toBe(meetingId)
  expect(perMeeting[0].commission_id).toBe(COMM_CCIH)
  expect(perCommission.map((t) => t.commission_id).sort()).toEqual(
    [COMM_CCIH, COMM_FARMACIA].sort(),
  )
  expect(perCommission.map((t) => t.entity_id)).toEqual([null, null])

  // ⛔ THE FAN-OUT NEVER MINTS `dispose_meeting` (ADR 0130 Amdt 2 item 3): the
  // door erases the WHOLE ata, and firing it because one agenda item touched the
  // subject's case would destroy other committees' records. Only an explicit
  // human adjudication escalates — proven by test 4, which mints it.
  expect(minted.filter((t) => t.kind === 'dispose_meeting')).toHaveLength(0)
})

// ===========================================================================
// 2 — The security boundary of the detail route, before anything mutates it.
// ===========================================================================

test('the request detail route is DPO-only: an executor, a plain member and a platform admin all 404', async ({
  page,
}) => {
  // ⚠ THE PAIRING IS THE TEST. `pqs.a` is a real executor who WILL be shown DSR
  // tasks; `staff3` holds nothing at all. Both must 404 on the request, and for
  // the same reason (`getDsrOutcomeRecord` returns null for a non-DPO) — which is
  // only visible when a principal who CAN see the console is checked too.
  for (const persona of [
    'pqs.a@test.local',
    'staff3.ccih@test.local',
    'platform@test.local',
  ]) {
    await cachedSignIn(page, persona)
    await page.goto(detailUrl)
    await expect(
      page.getByRole('heading', { name: /não encontramos esta página/i }),
      `${persona} must not reach the request detail`,
    ).toBeVisible()
    // No leakage: neither the process reference nor the fixture identifiers.
    await expect(page.getByText(FILE_REF)).toHaveCount(0)
    await expect(page.getByText(FIXTURE_MRN)).toHaveCount(0)
  }

  // The vacuity control: `staff3` also 404s on the CONSOLE, so the assertions
  // above are not merely "this persona 404s everywhere for an unrelated reason"
  // — and the DPO, by contrast, reaches both.
  await cachedSignIn(page, 'staff3.ccih@test.local')
  await page.goto(CONSOLE_URL)
  await expect(
    page.getByRole('heading', { name: /não encontramos esta página/i }),
  ).toBeVisible()

  await cachedSignIn(page, 'staff1.ccih@test.local')
  await page.goto(detailUrl)
  await expect(page.getByRole('heading', { name: FILE_REF, level: 1 })).toBeVisible()
})

// ===========================================================================
// 3 — A disposal task completes BECAUSE the disposal happened, never before.
// ===========================================================================

test('a disposal task refuses completion until the door has actually run, then executes from the inbox', async ({
  page,
  request,
}) => {
  await cachedSignIn(page, 'chefe.ccih@test.local')
  await page.goto(CONSOLE_URL)

  const card = taskCard(page, 'Descartar dados do caso')
  await expect(card).toBeVisible()

  // ⭐ THE LOAD-BEARING NEGATIVE (ADR 0130 Amdt 2 item 2). `complete_dsr_task`
  // verifies the EFFECT — the module row's own `phi_disposed_at` — rather than
  // mirroring the door's gate. So "Concluir tarefa" MUST be refused while the
  // case is undisposed. Without this assertion, test-3's positive half would pass
  // just as well against a door that closed the task on a click.
  await card.getByRole('button', { name: 'Concluir tarefa', exact: true }).click()
  await expect(
    card.getByText(/o descarte ainda não foi realizado neste registro/i),
  ).toBeVisible()

  let [kase] = await svcSelect<{ phi_disposed_at: string | null }>(
    request,
    'cases',
    `select=phi_disposed_at&id=eq.${caseId}`,
  )
  expect(kase.phi_disposed_at, 'the refused click must not have disposed').toBeNull()
  expect(
    (await tasks(request)).find((t) => t.kind === 'dispose_case')?.status,
  ).toBe('pending')

  // The residue language is shown BEFORE the irreversible click, and it is the
  // NARROWED text — this surface never ships ADR 0056's "tudo apagado".
  await card.getByText(/o que o descarte apaga — e o que permanece/i).click()
  await expect(card.getByText(/preserva o histórico de governança/i)).toBeVisible()

  await card.getByRole('button', { name: /executar descarte e concluir/i }).click()
  await expect(card.getByText('Concluída', { exact: true })).toBeVisible()

  // The module row is the record of truth — the task merely follows it.
  ;[kase] = await svcSelect<{ phi_disposed_at: string | null }>(
    request,
    'cases',
    `select=phi_disposed_at&id=eq.${caseId}`,
  )
  expect(kase.phi_disposed_at).not.toBeNull()
  expect(
    (await tasks(request)).find((t) => t.kind === 'dispose_case')?.status,
  ).toBe('done')

  // And the PHI itself is gone: the patient identifiers row the fan-out found.
  expect(
    await svcSelect(
      request,
      'patient_identifiers',
      `select=participant_id&participant_id=eq.${participantId}`,
    ),
  ).toHaveLength(0)
})

// ===========================================================================
// 4 — Adjudication, and the ONLY path that mints a `dispose_meeting` task.
// ===========================================================================

test('the Encarregado adjudicates the request, and the decision is write-once', async ({
  page,
  request,
}) => {
  await cachedSignIn(page, 'staff1.ccih@test.local')
  await page.goto(detailUrl)

  const panel = page.getByRole('region', { name: 'Registrar decisão' })
  await expect(panel).toBeVisible()

  // ⚠ THE ESCALATION FIELDSET IS CONDITIONAL ON AN ERASING OUTCOME. Asserting it
  // absent first is what makes its later presence mean something.
  await expect(
    page.getByRole('group', { name: /escalar reuniões para descarte da ata/i }),
  ).toHaveCount(0)

  await panel.getByLabel('Desfecho', { exact: true }).selectOption('granted')

  const escalation = page.getByRole('group', {
    name: /escalar reuniões para descarte da ata/i,
  })
  await expect(escalation).toBeVisible()
  // ⛔ Never softened: the operator is told, in these words, that the ata of
  // OTHER committees' items goes too.
  await expect(
    escalation.getByText(/inclusive os que não têm relação com o titular/i),
  ).toBeVisible()

  // Only meetings THIS request enumerated are offerable — exactly one here.
  // ⛔ TICKING IT IS **NOT** EXERCISED HERE. The escalation submit is broken
  // (BUG-DSR-S3-001: the panel posts the TASK id where the door expects the
  // MEETING id), and its pin lives in `dsr-slice3-meeting-escalation.spec.ts`
  // so that one red does not abort this whole serial corridor. This test
  // adjudicates WITHOUT escalating — the normal path, which is what leaves each
  // linked ata as an `attest_review` (ADR 0130 Amdt 2 item 3).
  await expect(escalation.getByRole('checkbox')).toHaveCount(1)

  // A granted outcome requires the recorded legal consultation (Amdt 1 item 3).
  // ⚠ Assert the REFUSAL, not the field: the field renders as soon as the outcome
  // is picked, so asserting the label would pass either way.
  await panel.getByRole('button', { name: 'Registrar decisão', exact: true }).click()
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

  await panel.getByLabel(/consulta jurídica/i).fill(`Parecer S3-${RUN}/2026`)

  // ⭐ THE REAL ESCALATION, replacing the service-role workaround this corridor
  // carried while BUG-DSR-S3-001 was open. The ata is ticked HERE, by a human, in
  // the adjudication — which is the ONLY minter of `dispose_meeting` anywhere
  // (ADR 0130 Amdt 2 item 3 removed it from the intake fan-out deliberately). Test
  // 6 then disposes what this mints, so the lane now runs end to end through its
  // real entry point. ⛔ Do not reintroduce a direct mint: a workaround that
  // outlives its bug is a green that hides the entry point.
  await expect(escalation.getByRole('checkbox')).toBeChecked({ checked: false })
  await escalation.getByRole('checkbox').check()
  await expect(escalation.getByRole('checkbox')).toBeChecked()

  await panel.getByRole('button', { name: 'Registrar decisão', exact: true }).click()

  await expect(
    page.getByRole('heading', { name: /decisão: atendida/i }),
  ).toBeVisible()

  const [decided] = await svcSelect<{
    outcome: string
    legal_consultation_ref: string
    adjudicated_at: string | null
    adjudicated_by: string | null
    status: string
  }>(
    request,
    'dsr_requests',
    `select=outcome,legal_consultation_ref,adjudicated_at,adjudicated_by,status&id=eq.${requestId}`,
  )
  expect(decided.outcome).toBe('granted')
  expect(decided.legal_consultation_ref).toBe(`Parecer S3-${RUN}/2026`)
  expect(decided.adjudicated_at).not.toBeNull()
  expect(decided.adjudicated_by).not.toBeNull()
  // ⚠ STATUS IS THE WORK STATE, not the decision fact (ADR 0130 Amdt 3 item 3):
  // execution already began in test 3, so the request stays `executing` and the
  // decision lives on `adjudicated_at`. Reporting `adjudicated` here would read
  // as a regression of work that happened.
  expect(decided.status).toBe('executing')

  // ⭐ THE ESCALATION MINTED EXACTLY ONE TASK, for the ata that was ticked — and
  // "exactly one" is the load-bearing half. Minting per linked meeting rather than
  // per ticked box is the over-broad erasure ADR 0130 Amdt 2 item 3 refused to
  // automate, and it would still look like a working feature.
  const escalated = (await tasks(request)).filter(
    (t) => t.kind === 'dispose_meeting',
  )
  expect(escalated).toHaveLength(1)
  expect(escalated[0].entity_id).toBe(meetingId)
  expect(escalated[0].commission_id).toBe(COMM_CCIH)
  expect(escalated[0].status).toBe('pending')

  // Write-once: the decision cannot be rewritten, so the form is gone.
  await page.reload()
  await expect(
    page.getByRole('region', { name: 'Registrar decisão' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('region', { name: 'Encerrar solicitação' }),
  ).toBeVisible()
})

// ===========================================================================
// 5 — Phase one of the close: refused while execution work is outstanding.
// ===========================================================================

test('closing as attended is refused while execution work is outstanding', async ({
  page,
  request,
}) => {
  await cachedSignIn(page, 'staff1.ccih@test.local')
  await page.goto(detailUrl)

  // ⭐ THE RETIRED COPY, ON THE GRANTING PATH — the string that was live-false.
  // It told a granted request that "a decisão não determinou erasão" when the
  // decision had ordered a FULLER erasure. It is cause-neutral now, and this is
  // the path that had no coverage: the refusal path is pinned in
  // `dsr-subject-requests.spec.ts`, and a run that exercised only that one would
  // have left this exact sentence unexercised.
  await expect(
    page.getByText(/revisões retiradas pela decisão registrada/i),
  ).toBeVisible()
  const body = (await page.locator('body').innerText()).toLowerCase()
  expect(
    body,
    'the retired copy must not attribute a CAUSE it cannot know — three outcomes ' +
      'retire tasks, and on THIS path the decision ordered MORE erasure, not none',
  ).not.toContain('não determinou eras')

  // ⛔ THE CONSOLE CARD IS COUNTED, NOT SUBTRACTED. `total - pending` folds
  // RETIRED into "concluídas" and would report 6/6 done on a request where one
  // task was withdrawn. Derived from the table so the assertion cannot restate
  // whatever the component computed.
  const rows = await tasks(request)
  const done = rows.filter((t) => t.status === 'done').length
  const pend = rows.filter((t) => t.status === 'pending').length
  const ret = rows.filter((t) => t.status === 'blocked').length
  expect(done + pend + ret).toBe(rows.length)
  await page.goto(CONSOLE_URL)
  await expect(
    page
      .getByRole('link', { name: new RegExp(FILE_REF) })
      .getByText(
        `${done} concluída${done === 1 ? '' : 's'} · ${pend} pendente${pend === 1 ? '' : 's'}` +
          ` · ${ret} retirada${ret === 1 ? '' : 's'} de ${rows.length}`,
      ),
  ).toBeVisible()
  await page.goto(detailUrl)

  const panel = page.getByRole('region', { name: 'Encerrar solicitação' })
  await panel
    .getByRole('button', { name: 'Encerrar solicitação', exact: true })
    .click()

  // HCDS4 — the door's own pt-BR, surfaced. ⚠ This refusal is specific to the
  // ERASING outcomes: `close_dsr_request` counts pending tasks only for
  // `granted`/`granted_partial` (measured from the live body), which is exactly
  // why this corridor adjudicated `granted`.
  await expect(
    panel.getByText(/conclua a execução antes de encerrar como atendida/i),
  ).toBeVisible()

  const [row] = await svcSelect<{ status: string; closed_at: string | null }>(
    request,
    'dsr_requests',
    `select=status,closed_at&id=eq.${requestId}`,
  )
  expect(row.status).toBe('executing')
  expect(row.closed_at).toBeNull()
})

// ===========================================================================
// 6 — The ata disposal: ADR 0056 Consequence (a)'s never-built affordance, fired.
// ===========================================================================

test('the ata is disposed from the inbox dialog, and the whole minutes go with it', async ({
  page,
  request,
}) => {
  // ⭐ THE TASK THIS DISPOSES WAS MINTED BY THE REAL ESCALATION IN TEST 4 — no
  // service-role shortcut. While BUG-DSR-S3-001 was open this block minted the row
  // directly, so the rest of the lane could be measured rather than assumed; that
  // workaround was removed the moment the escalation was proven to work, because a
  // workaround that outlives its bug turns the lane green while its real entry
  // point is broken. What follows is now ADR 0056 Consequence (a)'s never-built
  // affordance, reached the only way a user can reach it.
  const escalatedBefore = (await tasks(request)).filter(
    (t) => t.kind === 'dispose_meeting',
  )
  expect(
    escalatedBefore,
    'test 4 must have minted the dispose_meeting task through the adjudication',
  ).toHaveLength(1)

  await cachedSignIn(page, 'chefe.ccih@test.local')
  await page.goto(CONSOLE_URL)

  const card = taskCard(page, 'Descartar a ata da reunião')
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Descartar a ata', exact: true }).click()

  const dialog = page.getByRole('alertdialog')
  await expect(
    dialog.getByRole('heading', { name: /descartar a ata inteira desta reunião/i }),
  ).toBeVisible()
  await expect(
    dialog.getByText(/inclusive os que não têm relação com o titular/i),
  ).toBeVisible()

  // ⚠ ARMED ONLY BY THE TYPED PHRASE — asserting the button is disabled first is
  // what makes "it fired" mean the arming worked, not that it was never gated.
  const confirm = dialog.getByRole('button', {
    name: /apagar a ata definitivamente/i,
  })
  await expect(confirm).toBeDisabled()
  await dialog.getByLabel(/digite apagar para confirmar/i).fill('APAGAR')
  await expect(confirm).toBeEnabled()
  await confirm.click()

  await expect(card.getByText('Concluída', { exact: true })).toBeVisible()

  const [meeting] = await svcSelect<{
    phi_disposed_at: string | null
    phi_disposed_reason: string | null
    minutes_md: string | null
    title: string
  }>(
    request,
    'meetings',
    `select=phi_disposed_at,phi_disposed_reason,minutes_md,title&id=eq.${meetingId}`,
  )
  expect(meeting.phi_disposed_at).not.toBeNull()
  expect(meeting.phi_disposed_reason).toBe('subject_request')
  expect(meeting.minutes_md).toBeNull()
  // The governance history survives — that is the narrowed claim, and asserting
  // only the erasure would let a door that deleted the row pass.
  expect(meeting.title).toBe(MEETING_TITLE)

  // ⭐ THE WARNING WAS TRUE: every agenda item's prose is gone, not just the
  // subject's. This is the claim `DSR_MEETING_DISPOSAL_WARNING` makes, verified.
  //
  // ⚠ `item.title` USED TO BE PINNED SURVIVING (`.toBe(AGENDA_TITLE)`), copying the
  // MEETING-title assertion two lines above as if the two were the same invariant.
  // They are not: `meetings.title` (the meeting's OWN title) is the one column PO
  // Amdt 1 keeps and DISCLOSES (`DSR_MEETING_RESIDUE_RETAINED`, asserted above via
  // `meeting.title`); the agenda ITEM's own title carries no such exemption. Already
  // shipped on `main` (commit `3d5e9a9c`, pre-dating this remediation branch):
  // `dispose_meeting_minutes` was widened to its "composition closure" (closing
  // `FUP-MEETING-DISPOSAL-LEAVES-CHILD-TEXT`) and now redacts `meeting_agenda_items
  // .title` along with `description`/`discussion_notes`/`resolution` — verified
  // against the LIVE function body (`pg_get_functiondef`), never against migration
  // text. This assertion was never updated to match, which the DSR program's own
  // close narrative explains: `e2e:prod` was not re-run after that slice shipped.
  const [item] = await svcSelect<{
    title: string
    description: string | null
    discussion_notes: string | null
    resolution: string | null
  }>(
    request,
    'meeting_agenda_items',
    `select=title,description,discussion_notes,resolution&meeting_id=eq.${meetingId}`,
  )
  expect(item.title).not.toBe(AGENDA_TITLE)
  expect(item.description).not.toBe(AGENDA_PROSE)
  expect(item.discussion_notes).not.toBe(AGENDA_PROSE)
  expect(item.resolution).not.toBe(AGENDA_PROSE)

  expect(
    (await tasks(request)).find((t) => t.kind === 'dispose_meeting')?.status,
  ).toBe('done')
})

// ===========================================================================
// 7 — The attested tier, COMPLETED (not merely rendered).
// ===========================================================================
//
// ⚠ THIS SECTION USED TO ALSO DRIVE A MINTED `notify_scrub_check` CARD THROUGH
// ITS NOTE-COMPLETION FLOW. `create_dsr_request` no longer mints that kind (ADR
// 0130 Amdt 4 reached the code in `20261003000100`), so there is no scrub card
// on this request any more — see BUG-DSR-S3-003's docblock (test 11) for where
// that rendering branch is now covered instead.

test('the attested tier is attested by a named human', async ({
  page,
  request,
}) => {
  await cachedSignIn(page, 'staff1.ccih@test.local')
  await page.goto(detailUrl)

  // ⭐ THE ATA'S ATTESTATION WAS RETIRED BY THE ESCALATION IN TEST 4 — and this
  // is the SECOND WRITER of `blocked`, the one that had no coverage until now.
  // `adjudicate_dsr_request` retires the sibling `attest_review` in the SAME
  // statement that mints `dispose_meeting`: the decision just ordered this ata
  // erased wholesale, so an executor following the revoke corridor would reopen
  // and re-sign a meeting about to be destroyed, bumping `revision` and
  // invalidating registered prints (ADR 0126) on a record that is going away.
  //
  // ⚠ THE REFUSAL PATH AND THIS PATH ARE DIFFERENT WRITERS OF THE SAME STATE, and
  // a run that exercised only the refusal (subject-requests test 5) would leave
  // this one unexercised — which is exactly where the copy was live-false: the
  // record told a granted request that "a decisão não determinou erasão" when it
  // had ordered a FULLER one. The copy is cause-neutral now, and it is asserted
  // HERE, on the granting path.
  const ataCard = taskCard(page, 'Revisar e atestar a ata')
  await expect(ataCard).toBeVisible()
  await expect(ataCard.getByText('Encerrada', { exact: true })).toBeVisible()
  await expect(
    ataCard.getByText(/esta tarefa não deve ser executada/i),
    'a retired card must SAY why it is inert — a silent one is the BUG-006 family',
  ).toBeVisible()
  await expect(
    ataCard.getByRole('button', { name: /atestar revisão/i }),
    'a retired attestation must offer no form: the door refuses it',
  ).toHaveCount(0)
  await expect(
    ataCard.getByRole('button', { name: 'Concluir tarefa', exact: true }),
  ).toHaveCount(0)

  // ⛔ AND THE REVOKE CORRIDOR MUST BE GONE, IN BOTH VOICES. The minted `note` is
  // infinitive, the attestation form's block is imperative; suppressing one and
  // leaving the other would satisfy a narrower assertion while still instructing
  // an executor to re-sign a meeting that is about to be erased.
  await expect(
    ataCard.getByText(/rea(brir|bra) a reunião/i),
    'a retired ata must not carry the revoke-corridor procedure',
  ).toHaveCount(0)

  // The two per-commission sweeps, with DIFFERENT counts so the outcome record's
  // total can only come from summing them.
  //
  // ⚠ NOT SELECTED BY THE COMMISSION NAME ON THE CARD. The DPO is a plain member
  // of ONE commission, so the sibling commission's name is unreadable to them
  // through `commissions`' RLS and the card renders "Comissão fora do seu acesso"
  // instead (BUG-DSR-S3-002, pinned as the terminal test of this file). The two
  // cards are therefore taken one at a time as "the one that still has an
  // attestation form", and WHICH commission received WHICH count is asserted from
  // the table afterwards — the property under test is that each per-commission
  // sweep is separately attestable and that the counts are recorded per task, not
  // the pairing of a count to a commission.
  const openSweeps = () =>
    page
      .getByRole('article')
      .filter({
        has: page.getByRole('heading', {
          name: 'Revisar e atestar o texto livre da comissão',
          exact: true,
        }),
      })
      .filter({ has: page.getByRole('button', { name: /atestar revisão/i }) })

  /** How many per-commission sweeps are PERSISTED as done, from the table. */
  const attestedCount = async () =>
    (await tasks(request)).filter(
      (t) => t.kind === 'attest_review' && t.module === null && t.status === 'done',
    ).length

  // ⛔ THE COMPLETION SIGNAL IS PERSISTENCE, NEVER THE CARD'S DISAPPEARANCE.
  // The previous shape waited for the open-card SET to shrink, and that made this
  // test flaky in the gate (`:714` — first attempt read `attested_redactions`
  // [2, null]). `router.refresh()` REMOUNTS the whole list, so the filtered set
  // passes transiently through the expected count during the remount;
  // `toHaveCount` succeeds on the first matching poll, which makes a remount gap
  // indistinguishable from a completed attestation. A signal built out of an
  // ABSENCE cannot tell "finished" from "not rendered yet" — the vacuity family.
  // Polling the row instead asserts the thing the corridor is actually about: a
  // named human's statement reached the record.
  // ⭐ THE "PRESENT WHEN LIVE" ARM OF BUG-DSR-S3-008, RELOCATED. It used to sit on
  // the ata card, which this corridor now retires — leaving it there would have
  // turned a safety fix into the silent loss of the D7 record with nothing to
  // notice. A per-commission sweep is still live at this point, and its minted
  // note carries the same corridor, so the pair "present when live / absent when
  // retired" stays complete.
  const liveSweep = openSweeps().first()
  await expect(
    liveSweep.getByText(/reabrir a reunião, redigir o trecho e assinar novamente/i),
    'the minted note carries the D7 corridor on a LIVE attestation',
  ).toBeVisible()
  await expect(
    liveSweep.getByText(/reabra a reunião, edite o trecho e assine novamente/i),
    'the attestation form states the corridor before the fields (Decision 7)',
  ).toBeVisible()

  const counts = ['2', '3']
  for (let i = 0; i < counts.length; i++) {
    await expect(openSweeps()).toHaveCount(counts.length - i)
    const card = openSweeps().first()
    await card.getByLabel(/quem revisou/i).fill(`Dra. Revisora ${RUN}`)
    await card.getByLabel(/menções removidas/i).fill(counts[i])
    await card.getByLabel(/o que foi revisado/i).fill('Texto livre revisado.')
    await card.getByRole('button', { name: /atestar revisão/i }).click()

    await expect
      .poll(attestedCount, {
        message: `attestation ${i + 1} of ${counts.length} must be PERSISTED before the next one starts`,
        timeout: 15_000,
      })
      .toBe(i + 1)
    // Only now is the UI count meaningful: the row is committed, so a shrunken
    // set is settled state rather than a remount gap.
    await expect(openSweeps()).toHaveCount(counts.length - i - 1)
  }

  const perCommission = (await tasks(request)).filter(
    (t) => t.kind === 'attest_review' && t.module === null,
  )
  expect(perCommission.map((t) => t.commission_id).sort()).toEqual(
    [COMM_CCIH, COMM_FARMACIA].sort(),
  )
  expect(perCommission.map((t) => t.attested_redactions).sort()).toEqual([2, 3])

  // ⚠ THIS USED TO ALSO DRIVE A MINTED `notify_scrub_check` CARD THROUGH THE
  // PLAIN NOTE-COMPLETION FLOW HERE. That kind is no longer minted (ADR 0130
  // Amdt 4 reached the code in `20261003000100`) — there is nothing left on this
  // request to complete, so the block is gone rather than pointed at nothing.

  const all = await tasks(request)
  // One fewer than before `notify_scrub_check` was retired: 3 `attest_review` +
  // 1 `dispose_case` (test 1) + 1 `dispose_meeting` (test 4) = 5.
  expect(all).toHaveLength(5)
  // ⚠ NOT "all done" ANY MORE. The escalated ata's attestation is `blocked`, so
  // the invariant that actually matters for a granted close is that NOTHING is
  // PENDING — `close_dsr_request` counts pending, not not-done.
  expect(all.filter((t) => t.status === 'pending')).toHaveLength(0)
  expect(
    all.filter((t) => t.status === 'blocked').map((t) => t.entity_id),
    'exactly the escalated ata is retired',
  ).toEqual([meetingId])

  const attestations = all.filter((t) => t.kind === 'attest_review')
  // The retired one carries NO count — null is "nobody said", and coalescing it
  // to 0 would report a review nobody did.
  expect(
    attestations.filter((t) => t.status === 'done').map((t) => t.attested_redactions).sort(),
  ).toEqual([2, 3])
  expect(
    attestations.find((t) => t.status === 'blocked')?.attested_redactions,
  ).toBeNull()
  expect(
    attestations
      .filter((t) => t.status === 'done')
      .every((t) => t.attested_by_name === `Dra. Revisora ${RUN}`),
  ).toBe(true)
})

// ===========================================================================
// 8 — Phase two of the close, and the two-tier outcome record's numbers.
// ===========================================================================

test('the outcome record states both tiers exactly, and the close now succeeds', async ({
  page,
  request,
}) => {
  await cachedSignIn(page, 'staff1.ccih@test.local')
  await page.goto(detailUrl)

  // ⭐ VALUES, NOT RENDERING — AND EVERY ONE DERIVED FROM THE TABLE.
  // These were hardcoded literals and went stale the moment a SECOND writer of
  // `blocked` appeared: the escalation retires the ata's attestation, so
  // "Revisões concluídas" fell from 3 to 2 and this test failed on a number, not
  // on a defect. A literal encodes the fixture's shape at the moment it was
  // written and cannot survive the product changing underneath it — the same
  // class as every prose count this slice has had to correct.
  //
  // ⚠ Mechanical counts every `dispose_*` task, so it includes the ESCALATED ata
  // as well as the xref-found case. Reported as an observation, not asserted as
  // correct: the tier's copy reads "Registros localizados pelo índice do
  // paciente", which an escalated ata is not — a human decided it.
  const rows = await tasks(request)
  const mech = rows.filter((t) => t.kind.startsWith('dispose_'))
  const att = rows.filter((t) => t.kind === 'attest_review')
  const attDone = att.filter((t) => t.status === 'done')
  const n = (v: number) => String(v)

  const MECH = 'Nível mecânico'
  const ATT = 'Nível atestado'
  await expect(tally(page, MECH, 'Registros localizados')).toHaveAttribute(
    'data-countup',
    n(mech.length),
  )
  await expect(tally(page, MECH, 'Descartados')).toHaveAttribute(
    'data-countup',
    n(mech.filter((t) => t.status === 'done').length),
  )
  await expect(tally(page, MECH, 'Pendentes')).toHaveAttribute(
    'data-countup',
    n(mech.filter((t) => t.status === 'pending').length),
  )
  await expect(tally(page, ATT, 'Revisões solicitadas')).toHaveAttribute(
    'data-countup',
    n(att.length),
  )
  await expect(tally(page, ATT, 'Revisões concluídas')).toHaveAttribute(
    'data-countup',
    n(attDone.length),
  )
  // ⛔ SUMMED OVER COMPLETED ATTESTATIONS ONLY. The retired one has a NULL count
  // — "nobody said" — and coalescing it to 0 would report a review nobody did.
  await expect(tally(page, ATT, 'Menções removidas')).toHaveAttribute(
    'data-countup',
    n(attDone.reduce((acc, t) => acc + (t.attested_redactions ?? 0), 0)),
  )
  // Anti-vacuity: with nothing retired, this tier would prove nothing about the
  // second writer of `blocked`.
  expect(
    att.filter((t) => t.status === 'blocked'),
    'the escalated ata must be retired here, or this tier tests only the fan-out',
  ).toHaveLength(1)

  // The attestation is NOMINAL and the name reaches the record delivered to the
  // subject — that is the whole difference between the two tiers.
  await expect(
    page.getByRole('listitem').filter({ hasText: `Dra. Revisora ${RUN}` }).first(),
  ).toBeVisible()

  const panel = page.getByRole('region', { name: 'Encerrar solicitação' })
  await panel
    .getByRole('button', { name: 'Encerrar solicitação', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Solicitação encerrada', exact: true }),
  ).toBeVisible()

  const [closed] = await svcSelect<{
    status: string
    outcome: string
    closed_at: string | null
    closed_by: string | null
    adjudicated_at: string
  }>(
    request,
    'dsr_requests',
    `select=status,outcome,closed_at,closed_by,adjudicated_at&id=eq.${requestId}`,
  )
  expect(closed.status).toBe('closed')
  // ⛔ CLOSE CONSUMED THE DECISION, it did not author one (Amdt 3 item 2): the
  // outcome is the adjudicated one and the earlier stamp survives untouched.
  expect(closed.outcome).toBe('granted')
  expect(closed.closed_at).not.toBeNull()
  expect(closed.closed_by).not.toBeNull()
  expect(new Date(closed.adjudicated_at).getTime()).toBeLessThan(
    new Date(closed.closed_at as string).getTime(),
  )
})

// ===========================================================================
// 9 — The constraint negatives, on the finished record.
// ===========================================================================

test('the finished record carries no patient identity, no CFM basis and no over-claim', async ({
  page,
}) => {
  await cachedSignIn(page, 'staff1.ccih@test.local')
  await page.goto(detailUrl)
  await expect(page.getByRole('heading', { name: FILE_REF, level: 1 })).toBeVisible()

  const body = (await page.locator('body').innerText()).toLowerCase()

  // ⛔ Decision 5 / Q6 — the platform never stores or displays WHO a request is
  // about. Only the process reference, which points at the hospital's own file.
  expect(body).not.toContain(FIXTURE_MRN.toLowerCase())
  expect(body).not.toContain('paciente de fixture')

  // ⛔ Counsel held CFM 1821/2007 does not attach to committee records; citing it
  // to a data subject would be a FALSE LEGAL BASIS (ADR 0035 Amdt 1).
  expect(body).not.toContain('cfm')
  expect(body).not.toContain('1821')

  // ⛔ ADR 0056's over-claim family (`FUP-DISPOSE-DIALOG-OVERCLAIM`) — this
  // surface never ships it.
  expect(body).not.toContain('tudo apagado')
  expect(body).not.toContain('apaga permanentemente')

  // The vacuity control for the four negatives above: the page DOES render the
  // narrowed residue language, so "not found" is a fact about the copy and not
  // about an empty page.
  expect(body).toContain('preserva o histórico de governança')
  expect(body).toContain('20 anos')
})

// ===========================================================================
// 10 — Keyboard-only (§8 accessibility bar).
// ===========================================================================

test('the attestation form is fully keyboard-operable, on a second request', async ({
  page,
  request,
}) => {
  // A fresh request, because the one above is closed. The MRN resolves to
  // nothing now (the case is disposed), which is a legitimate DSR — the
  // mechanical tier is empty and the attested tier is not.
  const KB_REF = `PROC-S3KB-${RUN}`
  await cachedSignIn(page, 'staff1.ccih@test.local')
  await page.goto(CONSOLE_URL)

  const form = page.getByRole('form', { name: /registrar solicitação de titular/i })
  await form.getByLabel(/prontuário do titular/i).focus()
  await page.keyboard.type(`DSR-KB-${RUN}`)
  await page.keyboard.press('Tab') // → atendimento
  await page.keyboard.press('Tab') // → referência do processo
  await expect(form.getByLabel(/referência do processo/i)).toBeFocused()
  await page.keyboard.type(KB_REF)
  await page.keyboard.press('Tab') // → submit
  await expect(
    form.getByRole('button', { name: /registrar solicitação/i }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText(/tarefas de execução distribuídas/i)).toBeVisible()

  const [kbRequest] = await svcSelect<{ id: string }>(
    request,
    'dsr_requests',
    `select=id&file_ref=eq.${encodeURIComponent(KB_REF)}`,
  )
  await page.goto(`${CONSOLE_URL}/${kbRequest.id}`)

  // Attest one commission sweep with the keyboard alone. Taken as "a card that
  // still offers the form" for the same reason as test 7 (BUG-DSR-S3-002).
  const openSweeps = page
    .getByRole('article')
    .filter({
      has: page.getByRole('heading', {
        name: 'Revisar e atestar o texto livre da comissão',
        exact: true,
      }),
    })
    .filter({ has: page.getByRole('button', { name: /atestar revisão/i }) })
  await expect(openSweeps).toHaveCount(2)
  const card = openSweeps.first()
  await card.getByLabel(/quem revisou/i).focus()
  await expect(card.getByLabel(/quem revisou/i)).toBeFocused()
  await page.keyboard.type('Dr. Teclado')
  await page.keyboard.press('Tab') // → menções removidas
  await expect(card.getByLabel(/menções removidas/i)).toBeFocused()
  await page.keyboard.type('0')
  await page.keyboard.press('Tab') // → o que foi revisado
  await expect(card.getByLabel(/o que foi revisado/i)).toBeFocused()
  await page.keyboard.type('Revisado por teclado.')
  await page.keyboard.press('Tab') // → submit
  await expect(card.getByRole('button', { name: /atestar revisão/i })).toBeFocused()
  await page.keyboard.press('Enter')

  // ⛔ PERSISTENCE FIRST, PIXELS SECOND — the same correction as test 7. Waiting
  // for the card to leave the open set would accept a `router.refresh()` remount
  // gap as success.
  const kbDone = async () =>
    (
      await svcSelect<{ attested_by_name: string; attested_redactions: number }>(
        request,
        'dsr_tasks',
        `select=attested_by_name,attested_redactions&request_id=eq.${kbRequest.id}&status=eq.done`,
      )
    ).length
  await expect
    .poll(kbDone, {
      message: 'the keyboard-only attestation must be PERSISTED',
      timeout: 15_000,
    })
    .toBe(1)
  await expect(openSweeps).toHaveCount(1)

  const done = await svcSelect<{
    attested_by_name: string
    attested_redactions: number
  }>(
    request,
    'dsr_tasks',
    `select=attested_by_name,attested_redactions&request_id=eq.${kbRequest.id}&status=eq.done`,
  )
  expect(done).toHaveLength(1)
  expect(done[0].attested_by_name).toBe('Dr. Teclado')
  // ⚠ 0 IS THE ANSWER, not the absence of one — and it had to be typed.
  expect(done[0].attested_redactions).toBe(0)

  await svcDelete(
    request,
    'dsr_requests',
    `file_ref=eq.${encodeURIComponent(KB_REF)}`,
  )
})

// ===========================================================================
// 11 — TERMINAL: the attested tier names what it asks a human to review
// (BUG-DSR-S3-002 / BUG-DSR-S3-003, both app-fixed; pinned here).
// ===========================================================================

/**
 * ⭐ WHY THIS IS THE LAST TEST IN THE FILE. It was authored as a failing pin for
 * two live defects, and this file is a serial chain — a red anywhere earlier
 * would abort every test after it and report "1 failed" while hiding them.
 * Placed terminally, a red here costs exactly one failure and hides nothing.
 *
 * ⛔ DO NOT "FIX" A RED HERE BY ASSERTING WHAT THE PAGE CURRENTLY SAYS. If either
 * bug regresses, the fix is in the app, never in this assertion — asserting the
 * broken copy would convert a red pin into a green one that documents a bug as
 * intended behaviour.
 *
 * BUG-DSR-S3-002 — ✅ FIXED 2026-08-20 (`docs/bugs/archive.md`). The
 * per-commission attestation card did not name its commission for the
 * Encarregado. `listMyDsrTasks` used to read the name through a PostgREST embed
 * on `commissions`, which is RLS-filtered; the Encarregado is a plain member of
 * ONE commission by design (ADR 0130 Decision 2), so a sibling commission's name
 * was unreadable and the card rendered "Comissão fora do seu acesso". The task's
 * own procedure text says "Revise o conteúdo em texto livre DESTA COMISSÃO" — and
 * the surface said nothing about which one. Fixed with the DEFINER lister
 * `list_my_dsr_task_commissions` (same class as ADR 0130 Amendment 2 item 5's
 * HOSPITAL-name fix, one grain down at the commission).
 *
 * BUG-DSR-S3-003 — ✅ FIXED 2026-08-20 (`docs/bugs/archive.md`).
 * `notify_scrub_check` was hospital-scoped BY DESIGN (Q12a: one residue check
 * per request, `commission_id` null), yet its card rendered the same "Comissão
 * fora do seu acesso" — a permission problem where none existed, collapsing two
 * different facts ("this task has no commission" / "you may not read this
 * commission's name") into one string. `dsr-task-inbox.tsx` now renders a third,
 * correct string for the null-commission case.
 *
 * ⚠ DSR OPERATIONAL REMEDIATION (2026-08-21): `create_dsr_request` no longer
 * mints ANY `notify_scrub_check` task (ADR 0130 Amdt 4 reached the code in
 * `20261003000100`) — the residue class it existed to check was proved absent.
 * Backend confirmed from the catalog that both `dsr_tasks` writers otherwise
 * always set `commission_id`, so this was the file's ONLY live specimen of a
 * hospital-scoped, commission-less task; without it, `dsr-task-inbox.tsx`'s
 * null-commission branch (BUG-DSR-S3-003's fix) is reachable only for
 * HISTORICAL rows a migration deliberately never backfills (a surviving
 * `pending` row must stay completable exactly as today). So this test now
 * CONSTRUCTS one such row directly via `svcInsert` rather than relying on the
 * mint — still a valid `kind` (the CHECK constraint keeps it), still
 * completable, still rendered by the unchanged component branch. Removing the
 * construction (or breaking the branch) must turn this RED — proven, not
 * assumed: see the repair note beside the insert below.
 */
test('the attested tier names the commission it asks a human to review', async ({
  page,
  request,
}) => {
  await cachedSignIn(page, 'staff1.ccih@test.local')

  // ⭐ THE CONSTRUCTED SPECIMEN (DSR operational remediation, T2). No writer
  // mints a commission-less task any more, so the hospital-scoped rendering
  // branch this test exists to pin would otherwise never be exercised by
  // anything live — the pin would keep PASSING while proving NOTHING (the
  // exact vacuity class `FUP-E2E-ABSENT-ROW-ASSERTIONS` is filed under).
  // Attached to the file's own fixture request rather than a fresh one: RLS
  // (`dsr_tasks_select`: `app.is_dpo_of(hospital_id) OR
  // app.can_execute_dsr_task(...)`) and the page's own task read
  // (`listMyDsrTasks(hospitalId)` filtered to `t.requestId === requestId`,
  // `src/app/o/[org]/titulares/[requestId]/page.tsx`) both key on
  // `hospital_id`/`request_id`, never on `dsr_requests.status` — so a closed
  // request (this one was closed in test 8) still renders it. `hospital_id` is
  // read off the request row itself rather than hardcoded, so this does not
  // silently drift if the fixture's hospital ever changes.
  //
  // RED-PROOF (run once, not part of the committed suite): commenting out the
  // `svcInsert` below reproduces exactly the failure this construction now
  // prevents — `taskCard(page, 'Verificar resíduo em notificações')` matches
  // ZERO elements, so every assertion against `scrub` below (starting with
  // `scrub.getByText(/tarefa do hospital/i)).toBeVisible()`) times out unable
  // to find the locator at all. Restored immediately after confirming the red.
  // A pin nobody has watched fail is not a pin.
  const [dsrRequest] = await svcSelect<{ hospital_id: string }>(
    request,
    'dsr_requests',
    `select=hospital_id&id=eq.${requestId}`,
  )
  await svcInsert(request, 'dsr_tasks', {
    request_id: requestId,
    kind: 'notify_scrub_check',
    hospital_id: dsrRequest.hospital_id,
    note: 'Verificar resíduo de dados do titular em notificações (título e corpo) das entidades descartadas e registrar o resultado.',
  })
  // No explicit cleanup: `dsr_tasks` cascades from `dsr_requests` (`on delete
  // cascade`), and `afterAll` deletes the fixture request by its `file_ref`.

  await page.goto(detailUrl)

  const sweeps = page.getByRole('article').filter({
    has: page.getByRole('heading', {
      name: 'Revisar e atestar o texto livre da comissão',
      exact: true,
    }),
  })
  await expect(sweeps).toHaveCount(2)

  // Each sweep must name a real commission of this hospital. The vacuity control
  // is built in: BOTH names must be present across the two cards, so a page that
  // named only the DPO's own commission twice would still fail.
  const names = await sweeps.allInnerTexts()
  const joined = names.join('\n')
  expect(
    joined,
    'BUG-DSR-S3-002 — an attestation whose scope the reviewer cannot see',
  ).toContain(CCIH_NAME)
  expect(
    joined,
    'BUG-DSR-S3-002 — the sibling commission is unreadable through the RLS embed',
  ).toContain(FARMACIA_NAME)

  // BUG-DSR-S3-003 — the residue check has no commission BY DESIGN (Q12a:
  // `commission_id` null), so it must not claim one is out of reach.
  //
  // ⛔ BIDIRECTIONAL, because the absence half alone is satisfied by a card that
  // says NOTHING. The fix introduced a third string precisely so the two facts
  // stop being conflated — "this task has no commission" and "you may not read
  // this commission's name" are different statements and only one of them is true
  // here. Pin both: the by-design string present, the access statement absent.
  const scrub = taskCard(page, 'Verificar resíduo em notificações')
  await expect(
    scrub.getByText(/tarefa do hospital/i),
    'BUG-DSR-S3-003 — a hospital-scoped task must say so in its own words',
  ).toBeVisible()
  await expect(scrub.getByText(/sem comissão vinculada/i)).toBeVisible()
  await expect(
    scrub.getByText('Comissão fora do seu acesso', { exact: true }),
    'BUG-DSR-S3-003 — a hospital-scoped task is not an access failure',
  ).toHaveCount(0)
})

import { expect, type APIRequestContext } from '@playwright/test'
import {
  svcDelete,
  svcInsert,
  svcSelect,
} from './service-role'

// Re-exported so DSR specs keep one import site.
export { svcDelete, svcHeaders, svcInsert, svcSelect } from './service-role'

/**
 * The DSR subject fixture: a case with a patient participant under a unique MRN,
 * a meeting with its own agenda prose, and the `meeting_cases` link between them.
 *
 * ⛔ WHY THIS EXISTS AT ALL. The DSR corridor DISPOSES what it enumerates, and
 * disposal is IRREVERSIBLE. Pointing a disposal test at a seeded case or meeting
 * would erase records ~900 other tests share, and the damage would outlive the run
 * (`seed.sql` is a contract). Every DSR spec that executes a door therefore builds
 * its own subject here and removes it BY IDENTITY — never positionally, because a
 * positional cleanup has eaten seed rows in this repo before.
 *
 * ⚠ THE SHAPE THAT IS NOT OBVIOUS, and the reason this is one helper rather than
 * four inserts copied per spec:
 *   · `patient_xref` keys the CASE module on a `patient_participants` id, NOT a
 *     case id — so the fixture needs the participant, and the fan-out resolves it.
 *   · the xref row only appears when `patient_identifiers` is written (that is
 *     where `trg_xref_maintain_patient_identifiers` fires), not when the case or
 *     the case_participants link is.
 *   · the MEETING lane fires off `meeting_cases` alone — meetings are not in
 *     `patient_xref` and never will be.
 * Drop any one of those and the fan-out silently mints a SMALLER set, which reads
 * as a product change rather than a broken fixture.
 */

export const DSR_ORG = 'rede-a'
export const DSR_HOSPITAL_A = '05000000-0000-0000-0000-00000000000a'
export const DSR_COMM_CCIH = 'a0000000-0000-0000-0000-0000000000a1'
export const DSR_COMM_FARMACIA = 'b0000000-0000-0000-0000-0000000000b1'
export const DSR_CCIH_NAME = 'Comissão de Controle de Infecção Hospitalar'
export const DSR_FARMACIA_NAME = 'Comissão de Farmácia e Terapêutica'

/**
 * The SEED-ANCHORED path, kept as a documented alternative to building a fixture.
 * Measured by `frontend`: the seed MRN `PRT-0099123` fans out to this case, in
 * Farmacia (NOT CCIH).
 *
 * *** DO NOT HARDCODE THE MEETING ID. *** The meeting in that commission is
 * REGENERATED on every `supabase db reset`, so a literal survives exactly one
 * reset and then links nothing - silently, because a fan-out that mints no
 * meeting attestation renders no escalation fieldset, and a spec asserting only
 * the minted row goes GREEN having escalated nothing. Derive it by commission at
 * run time.
 *
 * *** `guard_meeting_cases` requires the meeting and the case to share a
 * commission ***, so any link built here must live inside DSR_COMM_FARMACIA or
 * the insert is refused.
 *
 * The default path remains `createDsrFixture` below: it owns everything it
 * disposes, and disposal is irreversible.
 */
export const DSR_SEED_CASE_FARMACIA = 'dba00000-0000-0000-0000-0000000000b1'

export type DsrFixture = {
  mrn: string
  caseId: string
  participantId: string
  meetingId: string
  caseLabel: string
  meetingTitle: string
  agendaTitle: string
  agendaProse: string
  minutes: string
}

/**
 * Build one subject fixture in CCIH / Hospital Central A.
 *
 * `tag` must be unique per run AND per spec file, so two specs running in the
 * same suite never enumerate each other's records.
 */
export async function createDsrFixture(
  req: APIRequestContext,
  tag: string,
): Promise<DsrFixture> {
  const fixture: DsrFixture = {
    mrn: `DSR-${tag}`,
    caseId: '',
    participantId: '',
    meetingId: '',
    caseLabel: `Caso de fixture DSR ${tag}`,
    meetingTitle: `Reunião de fixture DSR ${tag}`,
    agendaTitle: `Pauta de fixture ${tag}`,
    agendaProse: `Discussão de fixture ${tag} — texto livre que o descarte da ata apaga.`,
    minutes: `Ata de fixture ${tag}. Este texto deve desaparecer no descarte integral.`,
  }

  // ⚠ The template version is a GENERATED uuid — it changes on every
  // `supabase db reset`, so it is looked up, never hardcoded.
  const [seededCase] = await svcSelect<{ template_version_id: string }>(
    req,
    'cases',
    `select=template_version_id&commission_id=eq.${DSR_COMM_CCIH}&template_version_id=not.is.null&limit=1`,
  )
  const [chefe] = await svcSelect<{ id: string }>(
    req,
    'profiles',
    `select=id&email=eq.chefe.ccih@test.local`,
  )
  const [org] = await svcSelect<{ id: string }>(
    req,
    'organizations',
    `select=id&slug=eq.${DSR_ORG}`,
  )
  const [role] = await svcSelect<{ id: string }>(
    req,
    'case_participant_roles',
    `select=id&key=eq.affected_patient&organization_id=eq.${org.id}&limit=1`,
  )

  const kase = await svcInsert<{ id: string }>(req, 'cases', {
    commission_id: DSR_COMM_CCIH,
    template_version_id: seededCase.template_version_id,
    label: fixture.caseLabel,
    created_by: chefe.id,
    patient_enabled: true,
    has_patient: true,
  })
  fixture.caseId = kase.id

  const participant = await svcInsert<{ id: string }>(req, 'participants', {
    organization_id: org.id,
    participant_type: 'patient',
    sensitivity_class: 'patient_phi',
    display_name: 'Paciente',
  })
  fixture.participantId = participant.id
  await svcInsert(req, 'patient_participants', {
    participant_id: fixture.participantId,
  })
  await svcInsert(req, 'case_participants', {
    case_id: fixture.caseId,
    participant_id: fixture.participantId,
    role_id: role.id,
    is_primary_subject: true,
    added_by: chefe.id,
  })
  // The insert that makes the xref exist.
  await svcInsert(req, 'patient_identifiers', {
    participant_id: fixture.participantId,
    name: 'Paciente de Fixture',
    mrn: fixture.mrn,
    sex: 'unknown',
  })

  const meeting = await svcInsert<{ id: string }>(req, 'meetings', {
    commission_id: DSR_COMM_CCIH,
    title: fixture.meetingTitle,
    scheduled_start: new Date().toISOString(),
    created_by: chefe.id,
    minutes_md: fixture.minutes,
  })
  fixture.meetingId = meeting.id
  await svcInsert(req, 'meeting_agenda_items', {
    meeting_id: fixture.meetingId,
    position: 1,
    title: fixture.agendaTitle,
    description: fixture.agendaProse,
    discussion_notes: fixture.agendaProse,
    resolution: fixture.agendaProse,
    created_by: chefe.id,
  })
  // The ONLY mechanical signal linking a meeting to a subject (ADR 0130 Amdt 2
  // item 3). Without this row the meeting lane cannot fire at all.
  //
  // ⛔ NEVER SUBSTITUTE THE SEED'S `meeting_cases` ROW FOR THIS ONE. The seed has
  // exactly one, and it links a CCIH meeting to a DIFFERENT case than the one the
  // seeded MRN `PRT-0099123` resolves to — so a fan-out driven off the seed mints
  // NO meeting attestation and the escalation fieldset never renders at all. That
  // trap has now cost two verification runs (pgTAP 349's header records it, and
  // `frontend`'s first BUG-001 verification failed on it). A spec that "passes"
  // against seed-only state has proven that a fieldset which never rendered also
  // never misbehaved — the purest vacuous green available in this lane.
  await svcInsert(req, 'meeting_cases', {
    meeting_id: fixture.meetingId,
    case_id: fixture.caseId,
  })

  // ⭐ THE FIXTURE PROVES ITSELF, rather than trusting that seven inserts landed.
  // Each assertion below is a precondition some spec's keystone silently depends
  // on, and each failure mode is a SMALLER fan-out that reads as a product change:
  // no xref → no `dispose_case`; no `meeting_cases` → no meeting `attest_review`
  // → no escalation fieldset → an escalation pin that passes by never rendering.
  // Failing loudly HERE names the fixture; failing later names the product.
  const link = await svcSelect(
    req,
    'meeting_cases',
    `select=meeting_id&meeting_id=eq.${fixture.meetingId}&case_id=eq.${fixture.caseId}`,
  )
  expect(
    link,
    'fixture: the meeting_cases link is missing — the meeting lane cannot fire, ' +
      'and every escalation assertion downstream would pass vacuously',
  ).toHaveLength(1)

  const xref = await svcSelect<{ module: string; commission_id: string | null }>(
    req,
    'patient_xref',
    `select=module,commission_id&module=eq.case&entity_id=eq.${fixture.participantId}`,
  )
  expect(
    xref,
    'fixture: no patient_xref row for the participant — `trg_xref_maintain_' +
      'patient_identifiers` did not fire, so the mechanical tier would be empty',
  ).toHaveLength(1)
  expect(
    xref[0].commission_id,
    'fixture: the xref row is unroutable (null commission) — `create_dsr_request` ' +
      'raises HCDS2 rather than enumerating',
  ).not.toBeNull()

  return fixture
}

/**
 * Remove a fixture BY IDENTITY, plus every `dsr_requests` row whose `file_ref` is
 * listed (`dsr_tasks` cascades from it).
 *
 * ⛔ Never positional. Deleting the participant cascades `patient_participants` /
 * `patient_identifiers` / `case_participants`; the `patient_xref` row is
 * retained-and-stamped by design, so it is removed explicitly.
 */
export async function destroyDsrFixture(
  req: APIRequestContext,
  fixture: DsrFixture | null,
  fileRefs: string[],
): Promise<void> {
  for (const ref of fileRefs) {
    await svcDelete(req, 'dsr_requests', `file_ref=eq.${encodeURIComponent(ref)}`)
  }
  if (!fixture) return

  if (fixture.meetingId) {
    await svcDelete(req, 'meeting_cases', `meeting_id=eq.${fixture.meetingId}`)
    await svcDelete(req, 'meeting_agenda_items', `meeting_id=eq.${fixture.meetingId}`)
    await svcDelete(req, 'meetings', `id=eq.${fixture.meetingId}`)
  }
  if (fixture.participantId) {
    await svcDelete(
      req,
      'patient_xref',
      `module=eq.case&entity_id=eq.${fixture.participantId}`,
    )
    await svcDelete(
      req,
      'patient_identifiers',
      `participant_id=eq.${fixture.participantId}`,
    )
    await svcDelete(
      req,
      'case_participants',
      `participant_id=eq.${fixture.participantId}`,
    )
    await svcDelete(
      req,
      'patient_participants',
      `participant_id=eq.${fixture.participantId}`,
    )
    await svcDelete(req, 'participants', `id=eq.${fixture.participantId}`)
  }
  if (fixture.caseId) {
    await svcDelete(req, 'case_participants', `case_id=eq.${fixture.caseId}`)
    await svcDelete(req, 'cases', `id=eq.${fixture.caseId}`)
  }
}

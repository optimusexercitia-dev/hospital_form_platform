import { printSourceWatermark } from '@/lib/pdf/documents/print-source'
import { formatDate } from '@/lib/pdf/format'
import { documentProvenance } from '@/lib/pdf/provenance'
import type {
  DocumentPayload,
  MeetingAgendaEntry,
  MeetingAttendanceEntry,
  MeetingActionItemRef,
  SignatureAttestation,
} from '@/lib/pdf/types'
import {
  listMeetingActionItems,
  type MeetingActionItemStatus,
} from '@/lib/queries/meeting-action-items'
import {
  getMeetingDetail,
  listMeetingAgenda,
  listMeetingAttendees,
  listMeetingCases,
  listMeetingSignatures,
  type AttendanceStatus,
  type AttendeeRole,
  type MeetingModality,
  type MeetingStatus,
} from '@/lib/queries/meetings'
import { getMeetingPrintContext } from '@/lib/queries/printed-documents'
import type { MintRenderContext } from '@/lib/pdf/provenance'

/**
 * The meeting (ata) DATA PROVIDER (PDF·P2; ADR 0104 D15 step 2; plan §3).
 * Reads run UNDER THE CALLER'S SESSION via `src/lib/queries/` (Rule 9) — every
 * leg routes `can_reach_meeting` through RLS, so a caller who cannot reach the
 * meeting gets nulls and the mint fails closed. The provider grants nothing.
 *
 * FINAL ⇔ `meetings.status ∈ {signed, distributed}` (approved+signed minutes,
 * ADR 0104 D7); everything earlier — including `in_signature` and `cancelled`
 * — mints RASCUNHO.
 *
 * Signatures: `meeting_signatures` rows with `status = 'signed'` become the
 * ENVELOPE's `SignatureAttestation[]` (whole-document scope, D13). Declined /
 * revoked rows are NOT attestations. The DB's `internal_eauth` method maps to
 * `platform_signoff` — the honest caption ("Assinatura eletrônica registrada
 * na plataforma"), never an overclaim.
 */

const STATUS_DISPLAY: Record<MeetingStatus, string> = {
  scheduled: 'Agendada',
  held: 'Realizada',
  in_signature: 'Em assinatura',
  signed: 'Assinada',
  distributed: 'Distribuída',
  cancelled: 'Cancelada',
}

const MODALITY_DISPLAY: Record<MeetingModality, string> = {
  presencial: 'Presencial',
  remoto: 'Remota',
  hibrido: 'Híbrida',
}

const ROLE_DISPLAY: Record<AttendeeRole, string> = {
  presidente: 'Presidente',
  secretario: 'Secretário(a)',
  membro: 'Membro',
  convidado: 'Convidado(a)',
}

const ATTENDANCE_DISPLAY: Record<AttendanceStatus, string> = {
  summoned: 'Convocado(a)',
  present: 'Presente',
  absent: 'Ausente',
  excused: 'Justificado(a)',
}

const ACTION_STATUS_DISPLAY: Record<MeetingActionItemStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  done: 'Concluído',
  cancelled: 'Cancelado',
}

/** QA MINOR-7: a NEW DB enum value must never print its raw English key onto a
 * permanent record (Rule 10) — every display map falls back to the neutral
 * pt-BR-safe "—", never the identifier. The maps stay TOTAL over their unions,
 * so the fallback is dead code until the union widens under our feet. */
const ENUM_FALLBACK = '—'

/** Build the full {@link DocumentPayload} for a meeting the caller can reach.
 * Throws a pt-BR Error when it is unreachable (indistinguishable from
 * nonexistent, deliberately). */
export async function buildMeetingPayload(
  meetingId: string,
  ctx: MintRenderContext,
): Promise<DocumentPayload> {
  const [detail, context, agenda, attendees, signatureRows, actionItems, caseLinks] =
    await Promise.all([
      getMeetingDetail(meetingId),
      getMeetingPrintContext(meetingId),
      listMeetingAgenda(meetingId),
      listMeetingAttendees(meetingId),
      listMeetingSignatures(meetingId),
      listMeetingActionItems(meetingId),
      listMeetingCases(meetingId),
    ])
  if (!detail || !context) {
    throw new Error('Reunião não encontrada ou sem autorização de leitura.')
  }

  const attendeeById = new Map(attendees.map((a) => [a.id, a] as const))

  const signatures: SignatureAttestation[] = signatureRows
    .filter((s) => s.status === 'signed' && s.signedAt !== null)
    .map((s) => {
      const attendee = attendeeById.get(s.attendeeId)
      return {
        name: s.signerName ?? attendee?.displayName ?? 'Membro da comissão',
        title: attendee ? (ROLE_DISPLAY[attendee.role] ?? ENUM_FALLBACK) : null,
        scope: null, // whole-document attestation (ata footer, D13)
        timestamp: s.signedAt as string,
        method: 'platform_signoff' as const,
      }
    })

  const agendaEntries: MeetingAgendaEntry[] = agenda.map((item) => ({
    title: item.title ?? '—', // masked-title projection can null it at runtime
    description: item.description,
    discussionNotes: item.discussionNotes,
    resolution: item.resolution,
  }))

  const attendance: MeetingAttendanceEntry[] = attendees.map((a) => ({
    name:
      a.displayName ??
      (a.externalName
        ? a.externalOrg
          ? `${a.externalName} (${a.externalOrg})`
          : a.externalName
        : 'Participante'),
    roleDisplay: ROLE_DISPLAY[a.role] ?? ENUM_FALLBACK,
    attendanceDisplay: ATTENDANCE_DISPLAY[a.attendance] ?? ENUM_FALLBACK,
  }))

  const actionRefs: MeetingActionItemRef[] = actionItems.map((item) => ({
    title: item.title,
    statusDisplay: ACTION_STATUS_DISPLAY[item.status] ?? ENUM_FALLBACK,
    assigneeDisplay: item.assignedToName,
    dueDisplay: item.dueDate ? formatDate(item.dueDate) : null,
  }))

  // A8 (PO-ratified, QA MAJOR-1) — CONSERVATIVE PHI LABELING, presence-derived,
  // never a user choice (and NOT the D9 per-mint patient-identifier choice,
  // which remains absent for meetings): the ata carries masked-class content
  // when any agenda item is CASE-LINKED (its title is the process number the
  // projection masks from a respondent) or any PHI-BEARING free-text column is
  // present (minutes_md + the three deliberation-gated agenda fields — the
  // catalog's own column classification). A7 guarantees this provider only
  // runs UNMASKED, so presence here is the true content, minter-independent.
  // Meeting-level case links with no agenda item are NOT rendered by the
  // template and carry no printed identity — they do not trigger the label.
  const containsPhi =
    caseLinks.some((link) => link.agendaItemId !== null) ||
    detail.minutesMd !== null ||
    agenda.some(
      (item) =>
        item.description !== null ||
        item.discussionNotes !== null ||
        item.resolution !== null,
    )

  const hasQuorumData =
    detail.quorumMet !== null ||
    detail.presentCount !== null ||
    detail.eligibleMemberCount !== null

  return {
    letterhead: {
      hospitalName: context.hospitalName,
      hospitalAddress: null,
      logoDataUri: null,
      commissionName: context.commissionName,
    },
    // QA MINOR-5, RESTATED — the ONE shared derivation. ⚠ The former wording
    // ("the dialog previews the same") was an assertion that went FALSE the
    // moment this site moved to the kind-dispatch: the meeting detail page still
    // called `meetingWatermarkFor` directly. Both now route through
    // `printSourceWatermark`, so the claim is true again — and it is a claim that
    // must be re-checked whenever either side moves, not a decoration.
    //
    // ⚠ `printSourceWatermark`'s meeting arm composes ON TOP of
    // `meetingWatermarkFor`, which ADR 0125 leaves byte-identical — an
    // `in_signature` ata registers stamped RASCUNHO on purpose.
    provenance: documentProvenance(
      ctx,
      printSourceWatermark('meeting', {
        status: detail.status,
        // ADR 0126 disposal amendment — `dispose_meeting_minutes` empties the
        // content while leaving `status` and `revision` untouched, so neither the
        // status term nor D9's revision match can see it. A disposed ata
        // therefore stamps RASCUNHO and stops registering.
        meetingDisposed: detail.phiDisposed,
      }),
    ),
    signatures,
    containsPhi,
    // ADR 0126 D9 — the revision OBSERVED here, at build time, before the
    // out-of-band render. `mint_printed_document` compares it against the
    // source's current value and raises HC0DU if `reopen_meeting` fired
    // mid-corridor. ⛔ Must never be re-read closer to the mint call: the door
    // would then compare its own current value against itself.
    sourceRevision: detail.revision,
    body: {
      kind: 'meeting',
      meetingNumber: detail.meetingNumber,
      title: detail.title,
      meetingTypeDisplay: detail.meetingTypeName,
      statusDisplay: STATUS_DISPLAY[detail.status] ?? ENUM_FALLBACK,
      scheduledStart: detail.scheduledStart,
      heldAt: detail.heldAt,
      heldEnd: detail.heldEnd,
      modalityDisplay: MODALITY_DISPLAY[detail.modality] ?? ENUM_FALLBACK,
      locationDisplay: detail.locationText ?? detail.meetingUrl,
      quorum: hasQuorumData
        ? {
            met: detail.quorumMet,
            presentCount: detail.presentCount,
            eligibleCount: detail.eligibleMemberCount,
          }
        : null,
      minutesMd: detail.minutesMd,
      agenda: agendaEntries,
      attendance,
      actionItems: actionRefs,
    },
  }
}

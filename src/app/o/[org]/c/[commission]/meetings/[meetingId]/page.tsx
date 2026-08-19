import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import {
  getMeetingDetail,
  getMeetingSettings,
  listClosedSessions,
  listMeetingAgenda,
  listMeetingAttendees,
  listMeetingCases,
  listMeetingSignatures,
  listMeetingTypes,
  listReservedSessionItems,
} from "@/lib/queries/meetings";
import { listMeetingActionItems } from "@/lib/queries/meeting-action-items";
import { actionItemsEnabled } from "@/lib/queries/action-items";
import { meetingsEnabled } from "@/lib/meetings/actions";
import {
  audioMinutesEnabled,
  chartersEnabled,
  featureEnabled,
} from "@/lib/queries/feature-flags";
import { getCarryForwardSuggestions } from "@/lib/queries/charters";
import { getActiveMinutesJob } from "@/lib/minutes-jobs/queries";
import { listMembers, sortMembers } from "@/lib/queries/members";
import { listCasesBoard } from "@/lib/queries/cases";
import { MeetingHeader } from "@/components/meetings/meeting-header";
import { CarryForwardPanel } from "@/components/charters/carry-forward-panel";
import { MeetingMinutesEditor } from "@/components/meetings/meeting-minutes-editor";
import { MinutesAppliedBanner } from "@/components/meetings/minutes-applied-banner";
import { AgendaPanel } from "@/components/meetings/agenda-panel";
import { AttendeesPanel } from "@/components/meetings/attendees-panel";
import { CaseLinker } from "@/components/meetings/case-linker";
import { ActionItemsPanel } from "@/components/meetings/action-items-panel";
import { AttachmentsPanel } from "@/components/meetings/attachments-panel";
import { SignaturesPanel } from "@/components/meetings/signatures-panel";
import { ReservedSessionsPanel } from "@/components/meetings/reserved-sessions-panel";
import { isEditableStatus } from "@/components/meetings/meeting-labels";
import { formatMeetingNumber } from "@/components/meetings/format";
import { PrintedDocumentsSection } from "@/components/printing/printed-documents-panel";
import {
  printSourceRegisters,
  printSourceWatermark,
} from "@/lib/pdf/documents/print-source";
import {
  mintPrintedDocument,
  revokePrintedDocument,
} from "@/lib/pdf-mint/actions";

export const metadata: Metadata = {
  title: "Detalhe da reunião",
};

/**
 * The meeting detail / registry hub (F1–F4). Every member of the commission
 * reads it (RLS-scoped); staff_admins author. Sections: header + lifecycle,
 * minutes, agenda, attendees + quorum, cases discussed, action items,
 * attachments, signatures.
 *
 * Gated behind the `meetings` flag (404 when off). The meeting must belong to
 * this commission (defends a tampered id). Editing-capable controls are gated by
 * `canEdit` (staff_admin AND an unlocked status); members and locked meetings see
 * everything read-only. The server actions/RLS are the real authority.
 */
export default async function MeetingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; commission: string; meetingId: string }>;
  /** `ata_aplicada=1` — MIN's F3 redirect carries the post-apply success banner (§9.5). */
  searchParams: Promise<{ ata_aplicada?: string }>;
}) {
  const { org, commission, meetingId } = await params;
  const { ata_aplicada } = await searchParams;
  const slug = commission;

  if (!(await meetingsEnabled())) {
    notFound();
  }

  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role === null) {
    notFound();
  }

  // ADR 0078 C7: the meetings surface is for actual commission MEMBERS. A
  // commission-admin without a membership row (an org_admin/hospital_admin whose
  // coordinator `role` is resolved, not held — see getCommissionAccessByOrg) now
  // gets an EMPTY meeting record, so we hide the route rather than render a silent
  // zero-state. This mirrors the resolver's own `memberRole` derivation and gates
  // the nav item the same way; the meeting-type/settings config (Configurações →
  // Reuniões) stays reachable via its own route. UX gate only — RLS/C7 is the
  // security boundary.
  const isCommissionMember = access.context.memberships.some(
    (m) => m.commission.id === access.commission.id,
  );
  if (!isCommissionMember) {
    notFound();
  }

  const meeting = await getMeetingDetail(meetingId);
  if (!meeting || meeting.commissionId !== access.commission.id) {
    notFound();
  }

  const isCoordinator =
    access.role === "staff_admin";
  // Content is editable only by a coordinator AND while the meeting is unlocked.
  const canEdit = isCoordinator && isEditableStatus(meeting.status);

  const [
    agenda,
    attendees,
    caseLinks,
    signatures,
    actionItems,
    actionItemsOn,
    closedSessions,
    reservedItems,
    audioMinutesOn,
    activeMinutesJob,
    documentPrintingOn,
  ] = await Promise.all([
    listMeetingAgenda(meetingId),
    listMeetingAttendees(meetingId),
    listMeetingCases(meetingId),
    listMeetingSignatures(meetingId),
    listMeetingActionItems(meetingId),
    actionItemsEnabled(),
    // Reserved (closed) sessions + their tier-projected items (ADR 0078 C5). Read
    // for EVERY member; the `get_reserved_session_items` RPC masks each row to the
    // caller's tier, so the panel renders the projection — full substance/decision
    // where authorized, else the non-identifying stub.
    listClosedSessions(meetingId),
    listReservedSessionItems(meetingId),
    // MIN (ADR 0099 F1): the flag + the Ata card's audio slot state. Both request-
    // memoized/RLS-scoped; a member reads no job row and the slot renders nothing.
    audioMinutesEnabled(),
    getActiveMinutesJob(meetingId),
    // PDF·P2 (ADR 0104 D15): the printing module's platform-wide flag. Joins the
    // existing parallel batch rather than a separate await — it is independent
    // of every other read here.
    featureEnabled("document_printing"),
  ]);

  // Coordinator-only authoring data: the roster (member picker, assignees), the
  // meeting types (edit dialog), the quorum settings, and linkable cases. Members
  // never see the authoring controls, so we skip these reads for them.
  const [members, meetingTypes, settings, { rows: caseRows }] =
    await Promise.all([
      isCoordinator
        ? listMembers(access.commission.id)
        : Promise.resolve([]),
      isCoordinator
        ? listMeetingTypes(access.commission.id)
        : Promise.resolve([]),
      isCoordinator
        ? getMeetingSettings(access.commission.id)
        : Promise.resolve(null),
      isCoordinator
        ? listCasesBoard(access.commission.id)
        : Promise.resolve({ rows: [], nextCursor: null }),
    ]);

  // Carry-forward suggestions (S4·CH, ADR 0080 D7): unresolved agenda + open action
  // items from the last held plenary, shown beside the agenda when planning THIS
  // meeting. Gated on the `charters` flag AND agenda-edit capability (`canEdit`) —
  // the panel copies into the agenda, so a member/locked meeting never sees it. The
  // read is a pure, confidentiality-filtered DEFINER (member-scoped).
  const chartersOn = await chartersEnabled();
  const carryForward =
    chartersOn && canEdit
      ? await getCarryForwardSuggestions(access.commission.id)
      : null;

  const memberOptions = sortMembers(members).map((m) => ({
    userId: m.userId,
    name: m.fullName ?? m.email ?? "Membro",
  }));

  const linkableCases = caseRows.map((row) => ({
    id: row.case.id,
    caseNumber: row.case.caseNumber,
    label: row.case.label,
  }));

  // The quorum denominator (count of commission members). For coordinators we
  // have the roster; for members fall back to the conclusion snapshot if present.
  const totalMembers = isCoordinator
    ? members.length
    : (meeting.eligibleMemberCount ?? 0);

  // ADR 0125 D1 — ONE source-state object feeds BOTH print axes.
  //
  // ⚠ Written twice, these drift by construction: the two derivations are pure
  // functions of the same state, so sharing the FUNCTION is not enough — the
  // ARGUMENT LISTS must be the same object, or one edit updates a single axis and
  // the dialog starts promising a mark the renderer will not stamp. Must stay
  // identical to what `src/lib/meetings/pdf-payload.ts` passes (same
  // `getMeetingDetail` fields).
  const meetingPrintState = {
    status: meeting.status,
    meetingDisposed: meeting.phiDisposed,
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
      <MeetingHeader
        meeting={meeting}
        org={org} slug={slug}
        commissionId={access.commission.id}
        meetingTypes={meetingTypes}
        isCoordinator={isCoordinator}
      />

      <MinutesAppliedBanner applied={ata_aplicada === "1"} />

      <MeetingMinutesEditor
        meetingId={meeting.id}
        minutesMd={meeting.minutesMd}
        canEdit={canEdit}
        meetingStatus={meeting.status}
        org={org}
        slug={slug}
        audioMinutesEnabled={audioMinutesOn}
        activeMinutesJob={activeMinutesJob}
        attendees={attendees.map((a) => ({ id: a.id, displayName: a.displayName }))}
      />

      <AgendaPanel meetingId={meeting.id} items={agenda} canEdit={canEdit} />

      {carryForward && (
        <CarryForwardPanel meetingId={meeting.id} suggestions={carryForward} />
      )}

      <AttendeesPanel
        meeting={meeting}
        attendees={attendees}
        members={memberOptions}
        settings={settings}
        totalMembers={totalMembers}
        canEdit={canEdit}
      />

      <SignaturesPanel
        meeting={meeting}
        attendees={attendees}
        signatures={signatures}
        currentUserId={access.context.userId}
      />

      <CaseLinker
        meetingId={meeting.id}
        links={caseLinks}
        cases={linkableCases}
        agendaItems={agenda}
        canEdit={canEdit}
        org={org} slug={slug}
      />

      <ReservedSessionsPanel
        meetingId={meeting.id}
        sessions={closedSessions}
        items={reservedItems}
        canEdit={canEdit}
        cases={linkableCases}
        members={memberOptions}
      />

      <ActionItemsPanel
        meetingId={meeting.id}
        org={org}
        commission={slug}
        items={actionItems}
        assignees={memberOptions}
        agendaItems={agenda}
        cases={linkableCases}
        canManage={isCoordinator}
        currentUserId={access.context.userId}
        actionItemsEnabled={actionItemsOn}
      />

      <AttachmentsPanel meetingId={meeting.id} canEdit={isCoordinator} />

      {/* Printed documents (PDF·P2; ADR 0104). The P1 components are reused
          unchanged — a new kind is a provider + a template + an RLS arm, and
          wiring this screen needed no edit to any of them.

          Watermark comes from `printSourceWatermark` — the SAME kind-dispatch the
          payload provider calls, not a second copy of the rule. The dialog
          promises a mark before the document exists, so if its derivation could
          drift from the renderer's it would eventually lie about what goes on
          paper.

          ⚠ This used to call `meetingWatermarkFor` (status-only) directly, and
          the claim "sharing the function makes that drift impossible" quietly
          stopped being true when ADR 0126's disposal amendment gave the
          derivation STATE beyond status: two callers of one pure function drift
          the moment they pass different arguments. Sharing the function is
          necessary, not sufficient — the ARGUMENT LISTS must match too, which is
          why the flags below are spelled out rather than defaulted.

          `canRevoke` reuses this page's existing coordinator signal; no new
          permission check. And note what is deliberately ABSENT: meeting
          visibility has no admin arm, so an org_admin who is not a member is
          already turned away by the `isCommissionMember` gate above and never
          reaches a mint surface. That is the domain's gate doing its job — not
          something for this module to reproduce or compensate for. */}
      {documentPrintingOn ? (
        <PrintedDocumentsSection
          sourceKind="meeting"
          sourceId={meeting.id}
          registers={printSourceRegisters("meeting", meetingPrintState)}
          watermark={printSourceWatermark("meeting", meetingPrintState)}
          scopeLabel={`${formatMeetingNumber(meeting.meetingNumber)} · ${meeting.title}`}
          canRevoke={isCoordinator}
          mintAction={mintPrintedDocument}
          revokeAction={revokePrintedDocument}
        />
      ) : null}
    </div>
  );
}

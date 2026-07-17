import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import {
  getMeetingDetail,
  getMeetingSettings,
  listClosedSessions,
  listMeetingAgenda,
  listMeetingAttachments,
  listMeetingAttendees,
  listMeetingCases,
  listMeetingSignatures,
  listMeetingTypes,
  listReservedSessionItems,
} from "@/lib/queries/meetings";
import { listMeetingActionItems } from "@/lib/queries/meeting-action-items";
import { actionItemsEnabled } from "@/lib/queries/action-items";
import { meetingsEnabled } from "@/lib/meetings/actions";
import { listMembers, sortMembers } from "@/lib/queries/members";
import { listCasesBoard } from "@/lib/queries/cases";
import { MeetingHeader } from "@/components/meetings/meeting-header";
import { MeetingMinutesEditor } from "@/components/meetings/meeting-minutes-editor";
import { AgendaPanel } from "@/components/meetings/agenda-panel";
import { AttendeesPanel } from "@/components/meetings/attendees-panel";
import { CaseLinker } from "@/components/meetings/case-linker";
import { ActionItemsPanel } from "@/components/meetings/action-items-panel";
import { AttachmentsPanel } from "@/components/meetings/attachments-panel";
import { SignaturesPanel } from "@/components/meetings/signatures-panel";
import { ReservedSessionsPanel } from "@/components/meetings/reserved-sessions-panel";
import { isEditableStatus } from "@/components/meetings/meeting-labels";

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
}: {
  params: Promise<{ org: string; commission: string; meetingId: string }>;
}) {
  const { org, commission, meetingId } = await params;
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
    attachments,
    actionItems,
    actionItemsOn,
    closedSessions,
    reservedItems,
  ] = await Promise.all([
    listMeetingAgenda(meetingId),
    listMeetingAttendees(meetingId),
    listMeetingCases(meetingId),
    listMeetingSignatures(meetingId),
    listMeetingAttachments(meetingId),
    listMeetingActionItems(meetingId),
    actionItemsEnabled(),
    // Reserved (closed) sessions + their tier-projected items (ADR 0078 C5). Read
    // for EVERY member; the `get_reserved_session_items` RPC masks each row to the
    // caller's tier, so the panel renders the projection — full substance/decision
    // where authorized, else the non-identifying stub.
    listClosedSessions(meetingId),
    listReservedSessionItems(meetingId),
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
      <MeetingHeader
        meeting={meeting}
        org={org} slug={slug}
        commissionId={access.commission.id}
        meetingTypes={meetingTypes}
        isCoordinator={isCoordinator}
      />

      <MeetingMinutesEditor
        meetingId={meeting.id}
        minutesMd={meeting.minutesMd}
        canEdit={canEdit}
      />

      <AgendaPanel meetingId={meeting.id} items={agenda} canEdit={canEdit} />

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

      <AttachmentsPanel
        meetingId={meeting.id}
        attachments={attachments}
        canEdit={isCoordinator}
      />
    </div>
  );
}

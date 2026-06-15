import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccess } from "@/lib/queries/session";
import {
  getInterviewDetail,
  interviewsEnabled,
  listInterviewAttachments,
  listInterviewInterviewers,
  listInterviewSubjects,
} from "@/lib/queries/interviews";
import { getCaseDetail } from "@/lib/queries/cases";
import { listMembers, sortMembers } from "@/lib/queries/members";
import { InterviewHeader } from "@/components/interviews/interview-header";
import { InterviewSummaryEditor } from "@/components/interviews/interview-summary-editor";
import { SubjectsPanel } from "@/components/interviews/subjects-panel";
import { InterviewersPanel } from "@/components/interviews/interviewers-panel";
import { AttachmentsPanel } from "@/components/interviews/attachments-panel";
import type { InterviewPhaseOption } from "@/components/interviews/interview-form-dialog";
import { isEditableInterviewStatus } from "@/components/interviews/interview-labels";

export const metadata: Metadata = {
  title: "Detalhe da entrevista",
};

/**
 * The interview detail hub (Phase 11), nested under the case. Unlike the
 * coordinator-only case-detail page, this page is gated at COMMISSION MEMBERSHIP
 * so a plain-`staff` registered interviewer can reach it by direct link; every
 * WRITE control is driven by `viewerCanWrite` (the server/RLS is the authority).
 *
 * Gated behind the `interviews` flag (404 when off). The interview must belong to
 * this commission AND this case (defends a tampered id / mismatched URL). The
 * phase picker (edit dialog) needs the case's phases, which only a coordinator may
 * read (`get_case_detail` is `is_staff_admin_of`-gated); non-coordinator writers
 * get an empty phase list and the picker is simply hidden (their edits preserve
 * the existing phase link).
 */
export default async function InterviewDetailPage({
  params,
}: {
  params: Promise<{ slug: string; caseId: string; interviewId: string }>;
}) {
  const { slug, caseId, interviewId } = await params;

  if (!(await interviewsEnabled())) {
    notFound();
  }

  const access = await getCommissionAccess(slug);
  if (!access) {
    notFound();
  }

  const interview = await getInterviewDetail(interviewId);
  if (
    !interview ||
    interview.commissionId !== access.commission.id ||
    interview.caseId !== caseId
  ) {
    notFound();
  }

  const isCoordinator =
    access.role === "staff_admin" || access.context.isAdmin;
  // The authoritative write signal: staff_admin/admin OR a registered interviewer
  // on this interview (even a plain `staff`), computed by the backend via
  // `can_write_interview`. The server/RLS is the real authority; this drives UX.
  const canWrite = interview.viewerCanWrite;
  // Content edits to the summary + participant panels require write AND an unlocked
  // status; the server re-enforces the content-freeze (locked once concluida).
  const canEditContent =
    canWrite && isEditableInterviewStatus(interview.status);
  // Attachments are DELIBERATELY excluded from the conclusion content-freeze (ADR
  // 0026 / `add_interview_attachment` has no status check) — a late signed
  // transcript can be uploaded AFTER conclusion. So attachment management is
  // available whenever the viewer may write and the interview is not the one
  // terminal state (`cancelada`); `concluida` keeps upload/add-link/soft-delete.
  const canManageAttachments = canWrite && interview.status !== "cancelada";

  // The roster backs the subject/interviewer member pickers — load it for ANY
  // writer (a plain-staff interviewer needs it too), but skip the read entirely
  // for read-only viewers. The phases back the edit dialog's phase picker and are
  // coordinator-readable only.
  const [subjects, interviewers, attachments, members, caseDetail] =
    await Promise.all([
      listInterviewSubjects(interviewId),
      listInterviewInterviewers(interviewId),
      listInterviewAttachments(interviewId),
      canWrite ? listMembers(access.commission.id) : Promise.resolve([]),
      isCoordinator ? getCaseDetail(caseId) : Promise.resolve(null),
    ]);

  const memberOptions = sortMembers(members).map((m) => ({
    userId: m.userId,
    name: m.fullName ?? m.email ?? "Membro",
  }));

  const phaseOptions: InterviewPhaseOption[] = (caseDetail?.phases ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((p) => ({ id: p.id, label: p.title || `Fase ${p.position}` }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-7">
      <InterviewHeader
        interview={interview}
        slug={slug}
        caseId={caseId}
        phases={phaseOptions}
        isCoordinator={isCoordinator}
        canWrite={canWrite}
      />

      <InterviewSummaryEditor
        interviewId={interview.id}
        summaryMd={interview.summaryMd}
        canEdit={canEditContent}
      />

      <SubjectsPanel
        interviewId={interview.id}
        subjects={subjects}
        members={memberOptions}
        canEdit={canEditContent}
      />

      <InterviewersPanel
        interviewId={interview.id}
        interviewers={interviewers}
        members={memberOptions}
        canEdit={canEditContent}
      />

      <AttachmentsPanel
        interviewId={interview.id}
        attachments={attachments}
        canEdit={canManageAttachments}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { commissionHref } from "@/lib/routing";
import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { audioMinutesEnabled } from "@/lib/queries/feature-flags";
import { getActiveMinutesJob, getMinutesJobForReview } from "@/lib/minutes-jobs/queries";
import { listMeetingTypes } from "@/lib/queries/meetings";
import { listMembers, sortMembers } from "@/lib/queries/members";
import { ReviewShell } from "@/components/meetings/review/review-shell";

export const metadata: Metadata = {
  title: "Revisão da ata",
};

/**
 * MIN's F3 review page (ADR 0099 D12). Sub-route of the meeting detail hub — there is
 * no `jobId` in the URL; the reviewable job is resolved FROM the meeting id via
 * `getActiveMinutesJob` (at most one `done` job per meeting, the partial unique index).
 *
 * Guarded, ALL failures redirecting to the meeting page (never a dead-end 404) except
 * the two conditions the base meeting-detail page itself already treats as `notFound()`
 * — no session/role, or not a commission member (ADR 0078 C7) — mirrored here so a
 * tampered `meetingId` behaves identically on both routes:
 * flag off → redirect; non-canEdit → redirect (same `canEdit` predicate as the Ata
 * editor, B0 §1: `access.role === "staff_admin"`); no `done` job → redirect; meeting no
 * longer `held` → redirect (RLS/the RPCs are the real authority — this is UX only).
 */
export default async function ReviewAtaPage({
  params,
}: {
  params: Promise<{ org: string; commission: string; meetingId: string }>;
}) {
  const { org, commission, meetingId } = await params;
  const meetingHref = commissionHref(org, commission, "meetings", meetingId);

  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role === null) {
    notFound();
  }

  const isCommissionMember = access.context.memberships.some(
    (m) => m.commission.id === access.commission.id,
  );
  if (!isCommissionMember) {
    notFound();
  }

  const canEdit = access.role === "staff_admin";
  if (!(await audioMinutesEnabled()) || !canEdit) {
    redirect(meetingHref);
  }

  const activeJob = await getActiveMinutesJob(meetingId);
  if (!activeJob || activeJob.status !== "done") {
    redirect(meetingHref);
  }

  const review = await getMinutesJobForReview(activeJob.id);
  if (
    !review ||
    review.meeting.id !== meetingId ||
    review.meeting.commissionId !== access.commission.id
  ) {
    redirect(meetingHref);
  }
  if (review.meeting.status !== "held") {
    redirect(meetingHref);
  }

  const [members, meetingTypes] = await Promise.all([
    listMembers(access.commission.id),
    listMeetingTypes(access.commission.id),
  ]);

  const assignees = sortMembers(members).map((m) => ({
    userId: m.userId,
    name: m.fullName ?? m.email ?? "Membro",
  }));

  // `review.draft.unassigned_resolutions` (D6) is fixed backend-side as of commit
  // cadc5da: it round-trips ON `MinutesDraft` itself (never a sibling field — see that
  // type's own doc comment on why), so it's already present here with no extra work.
  return (
    <ReviewShell
      jobId={activeJob.id}
      meetingId={meetingId}
      org={org}
      slug={commission}
      commissionId={access.commission.id}
      meetingTitle={review.meeting.title}
      meetingNumber={review.meeting.meetingNumber}
      currentMinutesMd={review.meeting.minutesMd}
      initialDraft={review.draft}
      assignees={assignees}
      meetingTypes={meetingTypes}
      members={members}
    />
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Mic, Sparkles, X } from "lucide-react";

import { commissionHref } from "@/lib/routing";
import type { MinutesJobSummary } from "@/lib/minutes-jobs/types";
import { cancelMinutesJob } from "@/lib/minutes-jobs/actions";
import type { MeetingStatus } from "@/lib/queries/meetings";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatElapsed, MINUTES_UI } from "./minutes-labels";
import { useMinutesAction } from "./use-minutes-action";
import { MinutesUploadDialog } from "./minutes-upload-dialog";

/** How often the page refreshes itself while a job is live (D11 — a nicety; the durable signal is the notification). */
const POLL_MS = 45_000;
/** The elapsed-time chip ticks once a minute — no need for a faster interval. */
const TICK_MS = 60_000;

function CancelButton({ jobId, processing }: { jobId: string; processing: boolean }) {
  const { run, isPending, error } = useMinutesAction();
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        aria-label={MINUTES_UI.cancelChipLabel}
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <X aria-hidden="true" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{MINUTES_UI.cancelConfirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {processing
              ? MINUTES_UI.cancelConfirmProcessing
              : MINUTES_UI.cancelConfirmUploading}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {MINUTES_UI.cancelConfirmDismiss}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() =>
              run(() => cancelMinutesJob(jobId), { onSuccess: () => setOpen(false) })
            }
          >
            {MINUTES_UI.cancelConfirmAction}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * F1 — the Ata card header's audio-minutes slot (ADR 0099 D1/D11).
 *
 * A flat state machine over `activeJob?.status` (`getActiveMinutesJob` already
 * collapses `cancelled`/`applied` to `null`, so this component never sees those two —
 * D13's "a fresh attempt is always available" lands back on the plain button, not a
 * lingering chip) plus `meetingStatus` for the two `null`-job cases. Renders nothing
 * for `!audioMinutesEnabled` or `!canEdit` — the latter already covers members, locked
 * lifecycle statuses, and `administrativo` uniformly, since `canEdit` here is the SAME
 * boolean the page computes for the whole Ata editor (design brief §1.4).
 */
export function MinutesAudioSlot({
  meetingId,
  org,
  slug,
  meetingStatus,
  canEdit,
  audioMinutesEnabled,
  activeJob,
  attendees,
}: {
  meetingId: string;
  /** Org slug — a plain string; the review-page href is built here. */
  org: string;
  slug: string;
  meetingStatus: MeetingStatus;
  canEdit: boolean;
  audioMinutesEnabled: boolean;
  activeJob: MinutesJobSummary | null;
  /** For F2 step 1's roster + zero-attendee block. */
  attendees: { id: string; displayName: string | null }[];
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [, forceTick] = useState(0);
  const attendeesHref = `${commissionHref(org, slug, "meetings", meetingId)}#meeting-attendees-heading`;

  const live = activeJob?.status === "uploading" || activeJob?.status === "processing";

  // Light poll while a job is live on the open page (D11) — the durable signal stays
  // the notification; this is a nicety for someone watching the tab.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [live, router]);

  // Elapsed-time tick for the processing chip. A plain text update, not a motion
  // concern (design brief §6.3) — re-renders once a minute to recompute `formatElapsed`.
  useEffect(() => {
    if (activeJob?.status !== "processing") return;
    const id = setInterval(() => forceTick((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, [activeJob?.status]);

  if (!audioMinutesEnabled || !canEdit) return null;

  if (!activeJob) {
    if (meetingStatus === "scheduled") {
      return (
        <span className="text-xs text-muted-foreground">
          {MINUTES_UI.nudgeScheduled}
        </span>
      );
    }
    if (meetingStatus !== "held") return null;
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
        >
          <Mic aria-hidden="true" />
          {MINUTES_UI.startButton}
        </Button>
        <MinutesUploadDialog
          meetingId={meetingId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          attendees={attendees}
          attendeesHref={attendeesHref}
        />
      </>
    );
  }

  if (activeJob.status === "uploading" || activeJob.status === "processing") {
    const processing = activeJob.status === "processing";
    return (
      <div
        key={activeJob.status}
        className="animate-fade-in inline-flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-xs font-medium text-muted-foreground"
      >
        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        <span>
          {processing ? MINUTES_UI.processingChip : MINUTES_UI.uploadingChip}
          {processing && ` ${formatElapsed(activeJob.createdAt)}`}
        </span>
        <CancelButton jobId={activeJob.id} processing={processing} />
      </div>
    );
  }

  if (activeJob.status === "done") {
    return (
      <Button asChild size="sm" className="animate-fade-in">
        <Link
          href={commissionHref(org, slug, "meetings", meetingId, "revisao-ata")}
        >
          <Sparkles aria-hidden="true" />
          {MINUTES_UI.reviewButton}
        </Link>
      </Button>
    );
  }

  // status === 'failed'
  return (
    <>
      <div className="animate-fade-in inline-flex items-center gap-2 rounded-full bg-destructive/10 py-1 pr-1 pl-2.5 text-xs font-medium text-destructive">
        <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="max-w-[16rem] truncate" title={activeJob.errorMessage ?? undefined}>
          {activeJob.errorMessage ?? MINUTES_UI.step2UploadFailed}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-destructive hover:bg-destructive/15 hover:text-destructive"
          onClick={() => setDialogOpen(true)}
        >
          {MINUTES_UI.retryButton}
        </Button>
      </div>
      <MinutesUploadDialog
        meetingId={meetingId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        attendees={attendees}
        attendeesHref={attendeesHref}
      />
    </>
  );
}

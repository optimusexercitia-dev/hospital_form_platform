import { commissionHref } from "@/lib/routing";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  MapPin,
  Video,
} from "lucide-react";

import type { InterviewDetail } from "@/lib/queries/interviews";
import {
  InterviewModalityChip,
  InterviewStatusBadge,
} from "./interview-badges";
import { InterviewLifecycleActions } from "./interview-lifecycle-actions";
import type { InterviewPhaseOption } from "./interview-form-dialog";
import {
  formatCaseNumber,
  formatInterviewNumber,
  formatSchedule,
  interviewTitle,
} from "./format";

/**
 * The interview detail header: a back link, the number + title + status + modality,
 * the schedule / location / call-url metadata, and — when the viewer may write —
 * the lifecycle action bar. Server-Component shell; only the action bar (and the
 * edit dialog inside it) is a client island.
 *
 * Back-link routing (lead decision): the parent case-detail page is
 * coordinator-only, so a plain-`staff` interviewer would 404 there. Coordinators
 * get "← Caso N" to the case detail; non-coordinator viewers get "← Início" to the
 * commission home instead — never point a non-coordinator at the coordinator page.
 */
export function InterviewHeader({
  interview,
  org,
  slug,
  caseId,
  phases,
  isCoordinator,
  canWrite,
}: {
  interview: InterviewDetail;
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  caseId: string;
  phases: InterviewPhaseOption[];
  isCoordinator: boolean;
  canWrite: boolean;
}) {
  const backHref = isCoordinator
    ? commissionHref(org, slug, "manage", "cases", caseId)
    : commissionHref(org, slug);
  const backLabel = isCoordinator
    ? interview.caseNumber != null
      ? formatCaseNumber(interview.caseNumber)
      : "Caso"
    : "Início";

  const remote =
    interview.modality === "remoto" || interview.modality === "hibrido";

  return (
    <header className="flex flex-col gap-4">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {backLabel}
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {formatInterviewNumber(interview.interviewNumber)}
            </span>
            <InterviewStatusBadge status={interview.status} />
            <InterviewModalityChip modality={interview.modality} />
          </div>
          <h1 className="text-3xl text-balance">
            {interviewTitle(interview.title, interview.interviewNumber)}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            {interview.scheduledStart ? (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <CalendarClock aria-hidden="true" className="size-4" />
                {formatSchedule(
                  interview.scheduledStart,
                  interview.scheduledEnd,
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock aria-hidden="true" className="size-4" />
                Sem data definida
              </span>
            )}
            {interview.locationText && (
              <span className="inline-flex items-center gap-1.5">
                {remote ? (
                  <Video aria-hidden="true" className="size-4" />
                ) : (
                  <MapPin aria-hidden="true" className="size-4" />
                )}
                {interview.locationText}
              </span>
            )}
            {interview.meetingUrl && (
              <a
                href={interview.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <ExternalLink aria-hidden="true" className="size-3.5" />
                Entrar na chamada
              </a>
            )}
          </div>
        </div>

        {canWrite && (
          <InterviewLifecycleActions
            interview={interview}
            org={org} slug={slug}
            caseId={caseId}
            phases={phases}
          />
        )}
      </div>
    </header>
  );
}

import { MapPin, Video } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  InterviewModality,
  InterviewStatus,
  InterviewerRole,
} from "@/lib/queries/interviews";
import {
  INTERVIEWER_ROLE_LABEL,
  INTERVIEW_STATUS_LABEL,
  INTERVIEW_STATUS_STYLE,
  MODALITY_LABEL,
} from "./interview-labels";

/**
 * Small presentational pills for the Interviews UI. All Server-Component-safe and
 * styled exclusively through the semantic colour tokens (see `interview-labels`).
 * Status is always carried by text + shape, never colour alone. Mirrors
 * `meeting-badges.tsx`.
 */

const PILL_BASE =
  "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase";

/** The interview lifecycle status pill (panel row / detail header). */
export function InterviewStatusBadge({
  status,
  className,
}: {
  status: InterviewStatus;
  className?: string;
}) {
  return (
    <span className={cn(PILL_BASE, INTERVIEW_STATUS_STYLE[status], className)}>
      {INTERVIEW_STATUS_LABEL[status]}
    </span>
  );
}

/** A modality chip with a leading icon (presencial / remoto / híbrido). */
export function InterviewModalityChip({
  modality,
  className,
}: {
  modality: InterviewModality;
  className?: string;
}) {
  const remote = modality === "remoto" || modality === "hibrido";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[0.7rem] font-medium text-secondary-foreground",
        className,
      )}
    >
      {remote ? (
        <Video aria-hidden="true" className="size-3" />
      ) : (
        <MapPin aria-hidden="true" className="size-3" />
      )}
      {MODALITY_LABEL[modality]}
    </span>
  );
}

/** An interviewer committee-role pill. */
export function InterviewerRoleBadge({
  role,
  className,
}: {
  role: InterviewerRole;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase",
        className,
      )}
    >
      {INTERVIEWER_ROLE_LABEL[role]}
    </span>
  );
}

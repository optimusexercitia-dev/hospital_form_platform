import { MapPin, Tag, Video } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  InterviewCategory,
  InterviewConfidentiality,
  InterviewModality,
  InterviewStatus,
  InterviewerRole,
  RelationshipToCase,
  SessionStatus,
  SessionType,
} from "@/lib/queries/interviews";
import {
  CONFIDENTIALITY_HELPER_TEXT,
  CONFIDENTIALITY_LABEL,
  CONFIDENTIALITY_STYLE,
  INTERVIEWER_ROLE_LABEL,
  INTERVIEW_CATEGORY_LABEL,
  INTERVIEW_STATUS_LABEL,
  INTERVIEW_STATUS_STYLE,
  MODALITY_LABEL,
  RELATIONSHIP_TO_CASE_LABEL,
  SESSION_STATUS_LABEL,
  SESSION_STATUS_STYLE,
  SESSION_TYPE_LABEL,
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

/** The dashboard-classification pill (IV2 — required at create). */
export function InterviewCategoryBadge({
  category,
  className,
}: {
  category: InterviewCategory;
  className?: string;
}) {
  return (
    <span
      className={cn(
        PILL_BASE,
        "bg-secondary text-secondary-foreground",
        className,
      )}
    >
      {INTERVIEW_CATEGORY_LABEL[category]}
    </span>
  );
}

/**
 * The confidentiality-level tag (E1 taxonomy; ADR 0072). Most levels are
 * informational; the two ENFORCING levels (`legal_privileged` /
 * `credentialing_sensitive`) render in the elevated `warning` tier (see
 * `CONFIDENTIALITY_STYLE`). Pairs a tag icon with the label and carries the
 * sensitivity/clearance clarification as a native tooltip (`title`) plus
 * screen-reader text, so the meaning never rests on colour alone.
 */
export function ConfidentialityBadge({
  level,
  className,
}: {
  level: InterviewConfidentiality;
  className?: string;
}) {
  return (
    <span
      className={cn(PILL_BASE, "gap-1", CONFIDENTIALITY_STYLE[level], className)}
      title={CONFIDENTIALITY_HELPER_TEXT}
    >
      <Tag aria-hidden="true" className="size-3" />
      {CONFIDENTIALITY_LABEL[level]}
      <span className="sr-only"> — {CONFIDENTIALITY_HELPER_TEXT}</span>
    </span>
  );
}

/** A modality chip with a leading icon (presencial / remoto / híbrido). Used on
 * SESSIONS (IV2 — modality moved off the interview onto its encounters). */
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

/** A subject's relationship-to-the-case pill (IV2 — required at add; staff-only). */
export function RelationshipBadge({
  relationship,
  className,
}: {
  relationship: RelationshipToCase;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase",
        className,
      )}
    >
      {RELATIONSHIP_TO_CASE_LABEL[relationship]}
    </span>
  );
}

/** A session's own lifecycle-status pill (IV2). */
export function SessionStatusBadge({
  status,
  className,
}: {
  status: SessionStatus;
  className?: string;
}) {
  return (
    <span className={cn(PILL_BASE, SESSION_STATUS_STYLE[status], className)}>
      {SESSION_STATUS_LABEL[status]}
    </span>
  );
}

/** A session-type chip (IV2 — inicial / follow-up / …). */
export function SessionTypeChip({
  type,
  className,
}: {
  type: SessionType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase",
        className,
      )}
    >
      {SESSION_TYPE_LABEL[type]}
    </span>
  );
}

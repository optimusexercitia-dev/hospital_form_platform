import { cn } from "@/lib/utils";
import type {
  AttendanceStatus,
  MeetingStatus,
  SignatureStatus,
} from "@/lib/queries/meetings";
import type { MeetingActionItemStatus } from "@/lib/queries/meeting-action-items";
import { TOKEN_STYLES } from "@/components/cases/case-status-badge";
import type { CaseStatusColorToken } from "@/lib/cases/case-status";
import {
  ACTION_ITEM_STATUS_LABEL,
  ACTION_ITEM_STATUS_STYLE,
  ATTENDANCE_LABEL,
  ATTENDANCE_STYLE,
  MEETING_STATUS_LABEL,
  MEETING_STATUS_STYLE,
  SIGNATURE_STATUS_LABEL,
  SIGNATURE_STATUS_STYLE,
} from "./meeting-labels";

/**
 * Small presentational pills for the Meetings UI. All Server-Component-safe and
 * styled exclusively through the semantic colour tokens (see `meeting-labels`).
 * Status is always carried by text + shape, never colour alone.
 */

const PILL_BASE =
  "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase";

/** The meeting lifecycle status pill (board / detail header). */
export function MeetingStatusBadge({
  status,
  className,
}: {
  status: MeetingStatus;
  className?: string;
}) {
  return (
    <span className={cn(PILL_BASE, MEETING_STATUS_STYLE[status], className)}>
      {MEETING_STATUS_LABEL[status]}
    </span>
  );
}

/**
 * A meeting-type chip. The type's `colorToken` is a free string in the contract;
 * we resolve it through the shared 7-token palette (the same one used by case
 * tags/outcomes), defaulting to `muted` for any unknown token so styling stays
 * consistent app-wide.
 */
export function MeetingTypeChip({
  name,
  colorToken,
  className,
}: {
  name: string;
  colorToken: string | null;
  className?: string;
}) {
  const token = (colorToken ?? "muted") as CaseStatusColorToken;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TOKEN_STYLES[token] ?? TOKEN_STYLES.muted,
        className,
      )}
    >
      {name}
    </span>
  );
}

/** An attendance-status pill (presente / ausente / …). */
export function AttendanceBadge({
  attendance,
  className,
}: {
  attendance: AttendanceStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(PILL_BASE, ATTENDANCE_STYLE[attendance], className)}
    >
      {ATTENDANCE_LABEL[attendance]}
    </span>
  );
}

/** A signature-status pill (assinada / pendente / revogada). */
export function SignatureBadge({
  status,
  className,
}: {
  status: SignatureStatus;
  className?: string;
}) {
  return (
    <span className={cn(PILL_BASE, SIGNATURE_STATUS_STYLE[status], className)}>
      {SIGNATURE_STATUS_LABEL[status]}
    </span>
  );
}

/** An action-item status pill (mirror of the cases variant). */
export function ActionItemStatusBadge({
  status,
  className,
}: {
  status: MeetingActionItemStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase",
        ACTION_ITEM_STATUS_STYLE[status],
        className,
      )}
    >
      {ACTION_ITEM_STATUS_LABEL[status]}
    </span>
  );
}

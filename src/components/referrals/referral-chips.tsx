/**
 * Inter-committee referral CHIPS (Phase 22 — `case_referrals`; ADR 0037). Small,
 * pure presentational pills used across the hub list, the case-detail card, the
 * B-side detail header, and the QPS dashboard. Convey state by icon + text +
 * shape, never colour alone (design system §2). pt-BR labels come from the frozen
 * `*_LABELS` maps in the contract.
 *
 * Server-Component-safe (no client hooks) so list/detail server pages render them
 * directly. PHI-FREE — these render only governance metadata (status, type,
 * direction); patient context never reaches a chip.
 */

import {
  AlarmClockOff,
  ArrowDownLeft,
  ArrowUp,
  ArrowUpRight,
  BadgeCheck,
  ChevronsUp,
  CircleCheck,
  CircleDot,
  CircleSlash,
  Clock3,
  CornerDownRight,
  FileEdit,
  Flag,
  Inbox,
  Info,
  MessageCircleQuestion,
  MessageSquareReply,
  MessageSquareText,
  Microscope,
  Target,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import {
  MESSAGE_TYPE_LABELS,
  REFERRAL_DIRECTION_LABELS,
  REFERRAL_PRIORITY_LABELS,
  REFERRAL_PRIORITY_TOKENS,
  REFERRAL_STATUS_LABELS,
  REFERRAL_STATUS_TOKENS,
  type MessageType,
  type ReferralDirection,
  type ReferralPriority,
  type ReferralStatus,
} from "@/lib/referrals/types";
import { cn } from "@/lib/utils";
import {
  REFERRAL_META_CHIP_BASE,
  referralStatusChipClass,
  referralTypeChipClass,
} from "./format";

const CHIP_BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium";

/** Lifecycle-ordered icon per status (paired with the pt-BR label — never colour
 * alone). `rascunho` = draft, `enviada` = sent, `recebida` = inbox, `aceita` =
 * dot, `em_analise` = microscope, `respondida` = reply, `resolvida` = badge-check,
 * `concluida` = check, `recusada` = slash, `retirada` = slash (withdrawn). RV2 R3
 * widened the union with `answered` + `resolved` (the resolution split). */
const STATUS_ICON: Record<ReferralStatus, LucideIcon> = {
  draft: FileEdit,
  sent: ArrowUpRight,
  received: Inbox,
  accepted: CircleDot,
  rejected: CircleSlash,
  in_review: Microscope,
  awaiting_information: MessageCircleQuestion,
  answered: MessageSquareReply,
  resolved: BadgeCheck,
  completed: CircleCheck,
  withdrawn: CircleSlash,
};

/** The referral lifecycle chip (icon + pt-BR label + tone resolved from the
 * contract's {@link REFERRAL_STATUS_TOKENS} map). */
export function ReferralStatusChip({ status }: { status: ReferralStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={cn(CHIP_BASE, referralStatusChipClass(REFERRAL_STATUS_TOKENS[status]))}>
      <Icon aria-hidden="true" className="size-3.5" />
      {REFERRAL_STATUS_LABELS[status]}
    </span>
  );
}

/** The direction chip on the hub (incoming = received, outgoing = sent). */
export function ReferralDirectionChip({
  direction,
}: {
  direction: ReferralDirection;
}) {
  const Icon = direction === "incoming" ? ArrowDownLeft : ArrowUpRight;
  return (
    <span
      className={cn(
        CHIP_BASE,
        "border-border bg-muted text-muted-foreground",
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {REFERRAL_DIRECTION_LABELS[direction]}
    </span>
  );
}

/**
 * The referral-type chip — a quiet metadata pill (the snapshotted `type_label`
 * with the vocab row's optional `color_token`). No icon: it's a category, not a
 * state. Reused for the reply outcome label too.
 */
export function ReferralTypeChip({
  label,
  colorToken,
}: {
  label: string;
  colorToken?: string | null;
}) {
  return (
    <span className={cn(REFERRAL_META_CHIP_BASE, referralTypeChipClass(colorToken))}>
      {label}
    </span>
  );
}

/**
 * Message-type chip on the dialogue thread (RV2 R1). Convey the kind by icon +
 * text + tone (never colour alone): the `information_request` / `information_response`
 * clarification pair carries a caution/primary tone; a `general` comment /
 * `clarification` note stays quiet (metadata, not a control). PHI-FREE — the chip
 * is the message KIND, never its body.
 */
export function ReferralMessageTypeChip({ type }: { type: MessageType }) {
  const config: Record<
    MessageType,
    { icon: LucideIcon; className: string }
  > = {
    general: {
      icon: MessageSquareText,
      className: "border-border bg-muted text-muted-foreground",
    },
    information_request: {
      icon: MessageCircleQuestion,
      className: "border-warning/30 bg-warning/10 text-warning",
    },
    information_response: {
      icon: CornerDownRight,
      className: "border-primary/30 bg-primary/10 text-primary",
    },
    clarification: {
      icon: Info,
      className: "border-border bg-muted text-muted-foreground",
    },
  };
  const { icon: Icon, className } = config[type];
  return (
    <span className={cn(CHIP_BASE, className)}>
      <Icon aria-hidden="true" className="size-3.5" />
      {MESSAGE_TYPE_LABELS[type]}
    </span>
  );
}

/** A small "aguarda resposta" affordance chip for reply-expecting referrals
 * (Decision 5 — these are the close-case blockers). Neutral caution tone. */
export function ResponseExpectedChip() {
  return (
    <span
      className={cn(
        CHIP_BASE,
        "border-warning/30 bg-warning/10 text-warning",
      )}
    >
      <Clock3 aria-hidden="true" className="size-3.5" />
      Aguarda resposta
    </span>
  );
}

/** Triage-priority icon per severity (RV2 R2). Severity conveyed by icon SHAPE +
 * text + tone (never colour alone). `routine` = flag, `high` = up, `urgent` =
 * double-up, `critical` = alert triangle. */
const PRIORITY_ICON: Record<ReferralPriority, LucideIcon> = {
  routine: Flag,
  high: ArrowUp,
  urgent: ChevronsUp,
  critical: TriangleAlert,
};

/**
 * The triage-priority chip (RV2 R2) — icon + pt-BR label + tone resolved from the
 * contract's {@link REFERRAL_PRIORITY_TOKENS} map (reusing the status chip's token
 * → class resolver). Callers may hide it for the quiet `routine` default; it always
 * renders whatever priority it is given. PHI-free.
 */
export function ReferralPriorityChip({
  priority,
}: {
  priority: ReferralPriority;
}) {
  const Icon = PRIORITY_ICON[priority];
  return (
    <span
      className={cn(
        CHIP_BASE,
        referralStatusChipClass(REFERRAL_PRIORITY_TOKENS[priority]),
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {REFERRAL_PRIORITY_LABELS[priority]}
    </span>
  );
}

/** The SLA overdue chip (RV2 R2) — a firm "Atrasado" pill for a referral past its
 * response deadline (computed via `isReferralOverdue`; never a stored flag).
 * Destructive tone + a distinct icon (never colour alone). PHI-free. */
export function ReferralOverdueChip() {
  return (
    <span
      className={cn(
        CHIP_BASE,
        "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      <AlarmClockOff aria-hidden="true" className="size-3.5" />
      Prazo vencido
    </span>
  );
}

/**
 * The requested-action chip (RV2 R2) — the snapshotted "o que se pede" label a
 * quiet metadata pill (with a Target icon so it reads as a request, not a state).
 * PHI-free. */
export function ReferralRequestedActionChip({ label }: { label: string }) {
  return (
    <span className={cn(REFERRAL_META_CHIP_BASE, referralTypeChipClass(null))}>
      <Target aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  );
}

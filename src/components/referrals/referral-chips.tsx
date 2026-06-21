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
  ArrowDownLeft,
  ArrowUpRight,
  CircleCheck,
  CircleDot,
  CircleSlash,
  Clock3,
  FileEdit,
  Inbox,
  Microscope,
  type LucideIcon,
} from "lucide-react";

import {
  REFERRAL_DIRECTION_LABELS,
  REFERRAL_STATUS_LABELS,
  REFERRAL_STATUS_TOKENS,
  type ReferralDirection,
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
 * dot, `em_analise` = microscope, `concluida` = check, `recusada` = slash,
 * `retirada` = slash (withdrawn). */
const STATUS_ICON: Record<ReferralStatus, LucideIcon> = {
  rascunho: FileEdit,
  enviada: ArrowUpRight,
  recebida: Inbox,
  aceita: CircleDot,
  recusada: CircleSlash,
  em_analise: Microscope,
  concluida: CircleCheck,
  retirada: CircleSlash,
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

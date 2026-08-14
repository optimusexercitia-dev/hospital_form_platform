import { EyeOff, Paperclip } from "lucide-react";

/**
 * A referral file that is LISTED but cannot be opened — shared by both DM4
 * lanes (the frozen snapshot's documents and the reply's attachments) so the
 * two are visually identical and the next fix lands in one place.
 *
 * ## Why this is not a disabled button
 *
 * A greyed "Baixar" reads as "try again in a moment". That is true for exactly
 * one state (`pending`) and false for every other one this row serves — most of
 * all for `canOpen: false`, which is a settled authorization answer, not a
 * transient one. A badge plus a sentence says WHICH it is, and says it in text
 * and shape rather than colour alone.
 *
 * ## Why the row exists at all
 *
 * Denial is not absence here. In Wave A a document above the reader's clearance
 * is absent from the list entirely, because the ceiling is a single RLS
 * predicate — so Wave A deleted its equivalent of this row as unreachable. The
 * referral lane is the opposite BY DESIGN: row visibility is
 * `can_read_referral_metadata` and byte access is `can_read_referral_phi`, two
 * different predicates, so the state is genuinely reachable. Hiding the row
 * would tell a reader entitled to the referral's metadata that a reply had no
 * attachments, or that nothing was shared. Something was; they simply cannot
 * open it, and the row says exactly that.
 */
export function ReferralInertFileRow({
  title,
  size,
  badge,
  detail,
  reason,
}: {
  title: string;
  /** Pre-formatted size string; `""` renders nothing. */
  size: string;
  /** Short badge text — always paired with {@link detail}. */
  badge: string;
  /** The pt-BR sentence explaining why this file cannot be opened. */
  detail: string;
  /**
   * Which KIND of refusal this is. `authorization` = "not for you" (the
   * two-tier asymmetry); `state` = "not for anyone right now" (tombstoned,
   * failed upload, module off). Only the icon differs — the two are never
   * conveyed by colour, and both are equally non-interactive.
   */
  reason: "authorization" | "state";
}) {
  const Icon = reason === "authorization" ? EyeOff : Paperclip;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-3 text-muted-foreground">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{title}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-semibold text-muted-foreground">
            {badge}
          </span>
          {size && <span className="text-xs tabular-nums">{size}</span>}
        </span>
        <span className="text-xs text-pretty">{detail}</span>
      </span>
    </div>
  );
}

import {
  ArrowUpRight,
  BadgeCheck,
  CircleCheck,
  CircleDot,
  CircleSlash,
  FolderOpen,
  Inbox,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import {
  REFERRAL_ASSIGNMENT_ROLE_LABELS,
  type ReferralThreadEvent,
} from "@/lib/referrals/types";
import { formatCaseNumber, formatDateTime } from "./format";

/**
 * One SYNTHESIZED system row on the Diálogo timeline (RDR plan D7). These rows are
 * derived by `synthesizeThreadEvents` from fields the audited detail door already
 * returned — there is no `referral_events` table — so a row can never disclose more
 * than its reader already holds. PHI-FREE by construction: only governance metadata
 * (timestamps, committee/assignee display names, PHI-free decline reason codes).
 *
 * Rendered as a centred, muted rule between the message bubbles so the timeline
 * reads as a conversation punctuated by lifecycle facts. Pure + Server-Component
 * safe (no client hooks), and state is conveyed by ICON + TEXT (never colour alone).
 */
export function ReferralThreadEventRow({
  event,
  index,
}: {
  event: ReferralThreadEvent;
  /** Row index within the interleaved timeline, for the staggered entrance. */
  index: number;
}) {
  const { icon: Icon, text } = describe(event);

  return (
    <li
      // Paired with `data-thread-row="message"` on a bubble — the timeline mixes
      // both, so a bare `li` no longer identifies a message.
      data-thread-row="event"
      data-thread-event={event.kind}
      className="flex animate-rise-in items-center gap-2 py-0.5"
      style={{ "--rise-delay": `${index * 40}ms` } as React.CSSProperties}
    >
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="text-pretty">{text}</span>
        <span className="tabular-nums opacity-70">
          {/* An approximate anchor is spelled out rather than shown as a precise
              moment — `case_referral` stores no `target_case_linked_at`. */}
          {event.kind === "case_linked" ? "· após " : "· "}
          {formatDateTime(event.at)}
        </span>
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </li>
  );
}

/** The pt-BR sentence + icon for one event kind (Rule 10). */
function describe(event: ReferralThreadEvent): {
  icon: LucideIcon;
  text: string;
} {
  switch (event.kind) {
    case "sent":
      return {
        icon: ArrowUpRight,
        text: event.targetName
          ? `Encaminhado para ${event.targetName}`
          : "Encaminhado",
      };
    case "received":
      return { icon: Inbox, text: "Recebido pela comissão de destino" };
    case "decided_accepted":
      return { icon: CircleDot, text: "Aceito pela comissão de destino" };
    case "decided_declined":
      return {
        icon: CircleSlash,
        text: event.reasonLabel
          ? `Recusado — ${event.reasonLabel}`
          : "Recusado pela comissão de destino",
      };
    case "assignment":
      return {
        icon: UserRound,
        text: `${event.assigneeName ?? "Membro"} designado como ${
          REFERRAL_ASSIGNMENT_ROLE_LABELS[event.role]
        }`,
      };
    case "case_linked":
      return {
        icon: FolderOpen,
        text: `${formatCaseNumber(event.caseNumber)} vinculado ao encaminhamento`,
      };
    case "resolution":
      return {
        icon: BadgeCheck,
        text: `Resolução ${event.resolutionNumber} registrada${
          event.resolvedByName ? ` por ${event.resolvedByName}` : ""
        }${event.followUpRequired ? " — com acompanhamento" : ""}`,
      };
    case "concluded":
      return { icon: CircleCheck, text: "Encaminhamento concluído" };
    case "withdrawn":
      return { icon: CircleSlash, text: "Encaminhamento retirado pela origem" };
  }
}

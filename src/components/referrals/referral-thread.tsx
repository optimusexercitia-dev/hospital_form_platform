import { MessagesSquare } from "lucide-react";

import type {
  ReferralMessage,
  ReferralReadReceipt,
} from "@/lib/referrals/types";
import { ReferralThreadItem } from "./referral-thread-item";

/**
 * The inter-committee dialogue thread (RV2 R1 — ADR 0037 Amendment 1). Renders the
 * ordered {@link ReferralMessage} list a referral accumulates while the two
 * committees clarify before B concludes: each message shows the sender committee,
 * its {@link ReferralMessageTypeChip}, a timestamp, and the body.
 *
 * **PHI posture (plan §2.2 / Rule 12).** The message `body` is PHI-bearing and
 * arrives ONLY through the audited detail door; it is `null` for a metadata-only
 * reader. When `body === null` this renders a muted **"Conteúdo restrito"**
 * placeholder — NEVER the body, and never a body preview anywhere else (the hub /
 * inbox / dashboard show only counts + `last_message_at` metadata).
 *
 * Server-Component shell (no client hooks) — the `composer` slot (a client island)
 * is passed in by the page, gated on the viewer's side + status. The optional
 * `waitingOnLabel` surfaces the waiting-on indicator while `awaiting_information`.
 */
export function ReferralThread({
  messages,
  readReceipts,
  viewerUserId,
  canRedact,
  waitingOnLabel,
  composer,
}: {
  messages: ReferralMessage[];
  /** RV2 R5: PHI-free read/ack receipts across all messages (grouped per message
   * here for the per-message indicators). */
  readReceipts: ReferralReadReceipt[];
  /** The viewing user's id (for the "have I read/acked?" receipt checks). */
  viewerUserId: string | null;
  /** RV2 R5: whether the viewer may redact a message (a coordinator of either side). */
  canRedact: boolean;
  /** Waiting-on indicator text while `awaiting_information`; `null` otherwise. */
  waitingOnLabel: string | null;
  /** The gated write affordance (a client island), or `null` for read-only viewers. */
  composer?: React.ReactNode;
}) {
  const ordered = [...messages].sort(
    (a, b) => a.sequenceNumber - b.sequenceNumber,
  );

  // Group receipts by message id for the per-message indicators.
  const receiptsByMessage = new Map<string, ReferralReadReceipt[]>();
  for (const rc of readReceipts) {
    const list = receiptsByMessage.get(rc.messageId);
    if (list) list.push(rc);
    else receiptsByMessage.set(rc.messageId, [rc]);
  }

  return (
    <section
      aria-labelledby="referral-thread-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-center gap-2">
        <MessagesSquare aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 id="referral-thread-heading" className="text-base font-semibold">
          Diálogo
        </h2>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
          {messages.length}
        </span>
      </div>

      {waitingOnLabel && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning"
        >
          <MessagesSquare aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{waitingOnLabel}</span>
        </p>
      )}

      {ordered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          Ainda não há mensagens neste encaminhamento.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {ordered.map((m, i) => (
            <ReferralThreadItem
              key={m.id}
              message={m}
              receipts={receiptsByMessage.get(m.id) ?? []}
              viewerUserId={viewerUserId}
              canRedact={canRedact}
              index={i}
            />
          ))}
        </ul>
      )}

      {composer}
    </section>
  );
}

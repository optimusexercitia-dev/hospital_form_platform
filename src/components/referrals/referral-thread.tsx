import { MessagesSquare } from "lucide-react";

import type {
  ReferralMessage,
  ReferralReadReceipt,
  ReferralThreadEvent,
} from "@/lib/referrals/types";
import { ReferralThreadItem } from "./referral-thread-item";
import { ReferralThreadEventRow } from "./referral-thread-event";

/**
 * The inter-committee dialogue thread (RV2 R1 — ADR 0037 Amendment 1), redesigned
 * by RDR D7 as a MESSENGER timeline: each message is a bubble aligned by committee
 * (the viewer's own side on the right, the other side on the left), and the
 * SYNTHESIZED lifecycle {@link ReferralThreadEvent}s are interleaved between them as
 * centred system rows, so "what happened" and "what was said" read as one story.
 *
 * **PHI posture (plan §2.2 / Rule 12).** The message `body` is PHI-bearing and
 * arrives ONLY through the audited detail door; it is `null` for a metadata-only
 * reader. When `body === null` this renders a muted **"Conteúdo restrito"**
 * placeholder — NEVER the body. The events are derived from fields the same door
 * already returned, so they can disclose nothing extra.
 *
 * Server-Component shell (no client hooks) — the `composer` slot (a client island)
 * is passed in by the page, gated on the viewer's side + status. The optional
 * `waitingOnLabel` surfaces the waiting-on indicator while `awaiting_information`.
 */
export function ReferralThread({
  messages,
  events,
  readReceipts,
  viewerUserId,
  viewerCommissionId,
  canRedact,
  waitingOnLabel,
  composer,
}: {
  messages: ReferralMessage[];
  /** RDR D7: derived system rows (`synthesizeThreadEvents`), interleaved by time. */
  events: ReferralThreadEvent[];
  /** RV2 R5: PHI-free read/ack receipts across all messages (grouped per message
   * here for the per-message indicators). */
  readReceipts: ReferralReadReceipt[];
  /** The viewing user's id (for the "have I read/acked?" receipt checks). */
  viewerUserId: string | null;
  /** The viewer's own committee side — decides which bubbles align right; `null`
   * for a neither-side reader (QPS), whose bubbles then all read as incoming. */
  viewerCommissionId: string | null;
  /** RV2 R5: whether the viewer may redact a message (a coordinator of either side). */
  canRedact: boolean;
  /** Waiting-on indicator text while `awaiting_information`; `null` otherwise. */
  waitingOnLabel: string | null;
  /** The gated write affordance (a client island), or `null` for read-only viewers. */
  composer?: React.ReactNode;
}) {
  // Group receipts by message id for the per-message indicators.
  const receiptsByMessage = new Map<string, ReferralReadReceipt[]>();
  for (const rc of readReceipts) {
    const list = receiptsByMessage.get(rc.messageId);
    if (list) list.push(rc);
    else receiptsByMessage.set(rc.messageId, [rc]);
  }

  const rows = interleave(messages, events);

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

      {waitingOnLabel ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning"
        >
          <MessagesSquare aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{waitingOnLabel}</span>
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          Ainda não há mensagens neste encaminhamento.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row, i) =>
            row.kind === "message" ? (
              <ReferralThreadItem
                key={`m-${row.message.id}`}
                message={row.message}
                receipts={receiptsByMessage.get(row.message.id) ?? []}
                viewerUserId={viewerUserId}
                mine={
                  viewerCommissionId != null &&
                  row.message.senderCommissionId === viewerCommissionId
                }
                canRedact={canRedact}
                index={i}
              />
            ) : (
              <ReferralThreadEventRow
                key={`e-${row.event.id}`}
                event={row.event}
                index={i}
              />
            ),
          )}
        </ul>
      )}

      {composer}
    </section>
  );
}

type ThreadRow =
  | { kind: "message"; message: ReferralMessage; at: number; ord: number }
  | { kind: "event"; event: ReferralThreadEvent; at: number; ord: number };

/** ISO → epoch ms; an unparseable stamp sorts last rather than throwing. */
function timeKey(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

/**
 * Merge messages and synthesized events into ONE time-ordered timeline.
 *
 * Sorting is `(timestamp, ord)`. `ord` keeps ties deterministic across renders
 * instead of leaning on sort stability: an event that shares a timestamp with a
 * message (e.g. the `sent` event and the first message) sorts BEFORE it, because a
 * lifecycle transition is what makes the message possible. Messages keep their
 * server-assigned `sequenceNumber` ordering among themselves.
 */
function interleave(
  messages: ReferralMessage[],
  events: ReferralThreadEvent[],
): ThreadRow[] {
  const rows: ThreadRow[] = [
    ...events.map<ThreadRow>((event) => ({
      kind: "event",
      event,
      at: timeKey(event.at),
      ord: event.seq,
    })),
    ...messages.map<ThreadRow>((message) => ({
      kind: "message",
      message,
      at: timeKey(message.createdAt),
      // Offset past every event `seq` so a tie always resolves event-then-message.
      ord: 1_000_000 + message.sequenceNumber,
    })),
  ];

  return rows.sort((a, b) => (a.at === b.at ? a.ord - b.ord : a.at - b.at));
}

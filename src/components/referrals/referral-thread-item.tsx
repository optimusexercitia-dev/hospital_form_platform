"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, EyeOff } from "lucide-react";

import {
  recordReferralMessageReceipt,
  redactReferralMessage,
} from "@/lib/referrals/actions";
import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";
import type {
  ReferralMessage,
  ReferralReadReceipt,
} from "@/lib/referrals/types";
import { Button } from "@/components/ui/button";
import { ReferralMessageTypeChip } from "./referral-chips";
import { ReferralRedactDialog } from "./referral-redact-dialog";
import { formatDateTime } from "./format";

/**
 * One dialogue-thread message (RV2 R1 + R5). A `"use client"` island layering the
 * R5 receipts + redaction onto the R1 message:
 *  - **Receipts** — shows how many readers have read/acknowledged this message
 *    (from the PHI-free `readReceipts`), records the viewer's OWN `read` receipt
 *    once on mount (self-scoped — never forgeable, K-R5-5), and offers a
 *    "Confirmar ciência" action (`acknowledged`).
 *  - **Redaction** — a coordinator of either side may redact the message
 *    (append-only, audited); a redacted message renders `[redigido]` to EVERY reader
 *    (the door already replaced the body server-side).
 *
 * PHI posture (Rule 12): a restricted body (`null` for a metadata-only reader)
 * renders a muted placeholder, never the text. Recording a receipt does NOT
 * revalidate, so the auto-`read` fire is a quiet background signal.
 */
export function ReferralThreadItem({
  message: m,
  receipts,
  viewerUserId,
  canRedact,
  index,
}: {
  message: ReferralMessage;
  /** The read receipts for THIS message (PHI-free). */
  receipts: ReferralReadReceipt[];
  /** The viewing user's id, to scope the "have I read/acked?" checks. */
  viewerUserId: string | null;
  /** Whether the viewer may redact (a coordinator of either side). */
  canRedact: boolean;
  /** Row index, for the staggered entrance delay. */
  index: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [redactOpen, setRedactOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoReadFired = useRef(false);

  const redacted = Boolean(m.redactedAt);
  const restricted = m.body === null;
  const authoredByViewer =
    viewerUserId != null && m.senderUserId === viewerUserId;

  const viewerReceipt = receipts.find((r) => r.userId === viewerUserId);
  const viewerAcked = Boolean(viewerReceipt?.acknowledgedAt);
  const readCount = receipts.filter((r) => r.readAt).length;
  const ackCount = receipts.filter((r) => r.acknowledgedAt).length;

  // Record the viewer's OWN `read` receipt once, on mount, for a message they did
  // not author + can actually read. Fire-and-forget (no revalidation) — a quiet
  // background signal, never blocking. Self-scoped server-side (K-R5-5).
  useEffect(() => {
    if (autoReadFired.current) return;
    if (!viewerUserId || authoredByViewer || restricted || redacted) return;
    if (viewerReceipt?.readAt) return;
    autoReadFired.current = true;
    void recordReferralMessageReceipt({ messageId: m.id, event: "read" });
  }, [
    viewerUserId,
    authoredByViewer,
    restricted,
    redacted,
    viewerReceipt,
    m.id,
  ]);

  function acknowledge() {
    setError(null);
    startTransition(async () => {
      const result = await recordReferralMessageReceipt({
        messageId: m.id,
        event: "acknowledged",
      });
      if (!result.ok) {
        setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li
      className="flex animate-rise-in flex-col gap-1.5 rounded-xl border border-border/70 bg-muted/20 p-4"
      style={{ "--rise-delay": `${index * 50}ms` } as React.CSSProperties}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          #{m.sequenceNumber}
        </span>
        <span className="text-sm font-medium text-foreground">
          {m.senderCommissionName ?? "Comissão"}
        </span>
        <ReferralMessageTypeChip type={m.messageType} />
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {formatDateTime(m.createdAt)}
        </span>
      </div>

      {m.senderUserName && (
        <span className="text-xs text-muted-foreground">
          por {m.senderUserName}
        </span>
      )}

      {redacted ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground italic">
          <EyeOff aria-hidden="true" className="size-3.5" />
          [redigido]
        </p>
      ) : restricted ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground italic">
          <EyeOff aria-hidden="true" className="size-3.5" />
          Conteúdo restrito — você não tem acesso ao teor desta mensagem.
        </p>
      ) : (
        <p className="text-sm whitespace-pre-wrap text-foreground text-pretty">
          {m.body}
        </p>
      )}

      {/* Receipts + controls — only meaningful for a readable, non-redacted body. */}
      {!redacted && !restricted && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            title="Leituras"
          >
            <Check aria-hidden="true" className="size-3.5" />
            {readCount} {readCount === 1 ? "leitura" : "leituras"}
          </span>
          <span
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            title="Confirmações de ciência"
          >
            <CheckCheck aria-hidden="true" className="size-3.5" />
            {ackCount} {ackCount === 1 ? "ciente" : "cientes"}
          </span>

          {viewerUserId && !authoredByViewer && (
            viewerAcked ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                <CheckCheck aria-hidden="true" className="size-3.5" />
                Ciência confirmada
              </span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={acknowledge}
                disabled={isPending}
              >
                <CheckCheck aria-hidden="true" />
                Confirmar ciência
              </Button>
            )
          )}

          {canRedact && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setRedactOpen(true)}
            >
              <EyeOff aria-hidden="true" />
              Tarjar
            </Button>
          )}
        </div>
      )}

      {error && (
        <span role="alert" className="text-xs font-medium text-destructive">
          {error}
        </span>
      )}

      {canRedact && (
        <ReferralRedactDialog
          open={redactOpen}
          onOpenChange={setRedactOpen}
          kind="message"
          onRedact={(reason) =>
            redactReferralMessage({ messageId: m.id, reason })
          }
        />
      )}
    </li>
  );
}

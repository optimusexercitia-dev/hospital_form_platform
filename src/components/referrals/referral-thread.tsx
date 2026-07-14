import { EyeOff, MessagesSquare } from "lucide-react";

import type { ReferralMessage } from "@/lib/referrals/types";
import { ReferralMessageTypeChip } from "./referral-chips";
import { formatDateTime } from "./format";

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
  waitingOnLabel,
  composer,
}: {
  messages: ReferralMessage[];
  /** Waiting-on indicator text while `awaiting_information`; `null` otherwise. */
  waitingOnLabel: string | null;
  /** The gated write affordance (a client island), or `null` for read-only viewers. */
  composer?: React.ReactNode;
}) {
  const ordered = [...messages].sort(
    (a, b) => a.sequenceNumber - b.sequenceNumber,
  );

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
            <li
              key={m.id}
              className="flex animate-rise-in flex-col gap-1.5 rounded-xl border border-border/70 bg-muted/20 p-4"
              style={{ "--rise-delay": `${i * 50}ms` } as React.CSSProperties}
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

              {m.body === null ? (
                <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground italic">
                  <EyeOff aria-hidden="true" className="size-3.5" />
                  Conteúdo restrito — você não tem acesso ao teor desta mensagem.
                </p>
              ) : (
                <p className="text-sm whitespace-pre-wrap text-foreground text-pretty">
                  {m.body}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {composer}
    </section>
  );
}

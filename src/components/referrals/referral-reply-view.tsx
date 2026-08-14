import type { CSSProperties } from "react";
import { MessageSquareReply, Paperclip } from "lucide-react";

import type { ReferralReply, ReferralReplyDocument } from "@/lib/referrals/types";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { AVAILABILITY_PRESENTATION } from "@/components/documents/document-labels";
import { ReferralOpenFileButton } from "./referral-open-file-button";
import { ReferralInertFileRow } from "./referral-inert-file-row";
import {
  REFERRAL_ATTACHMENT_NO_ACCESS_DETAIL,
  REFERRAL_FILE_NO_ACCESS_LABEL,
} from "./referral-document-labels";
import { ReferralTypeChip } from "./referral-chips";
import { formatDateTime, formatFileSize } from "./format";

/**
 * The delivered reply A receives (Decision 10), shown on the referral detail once
 * concluded. A pure Server Component: `resultMd` is PHI-bearing clinical free
 * text (the audited detail door already gated it), rendered through the ONE
 * sanitizing Markdown renderer (Rule 7). The structured outcome label is a quiet
 * chip.
 *
 * An acknowledgment-only conclusion (no-reply-expected referrals) carries no
 * result/outcome — we render a calm "concluído com ciência" line instead.
 *
 * ## DM4 (ADR 0114 Wave C / PO ruling R1) — attachments are real, and re-pointed
 *
 * The legacy `reply.attachments` lane is gone from this view. It was rendered
 * from render-time signed URLs passed in as an `attachmentId → url` map, over a
 * table that never had a single UI writer — so the list this component
 * faithfully rendered was, for its whole life, guaranteed empty.
 *
 * What renders now is `ReferralReplyDocument[]`: referral-homed documents on the
 * core document model, opened through the audited click-time byte door.
 */
export function ReferralReplyView({
  reply,
  replyDocuments,
}: {
  reply: ReferralReply;
  /**
   * DM4: the B-side attachments from `listReferralReplyDocuments`. Empty while
   * `documents_wave_c` is off — the host does not query them, so the corridor
   * has nothing to render rather than rows whose every open would refuse.
   *
   * Read from this prop rather than `reply.replyDocuments`: the audited detail
   * door projects the reply, and the attachment lane is its own query, so the
   * page names which one fed this list.
   */
  replyDocuments: ReferralReplyDocument[];
}) {
  return (
    <section
      aria-labelledby="referral-reply-heading"
      className="flex flex-col gap-4 rounded-2xl border border-success/30 bg-success/8 p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center gap-2">
        <MessageSquareReply aria-hidden="true" className="size-4 text-success" />
        <h2 id="referral-reply-heading" className="text-base font-semibold">
          Resposta da análise
        </h2>
        {reply.outcomeLabel && (
          <ReferralTypeChip label={reply.outcomeLabel} colorToken="success" />
        )}
      </div>

      {reply.acknowledgedOnly ? (
        <p className="text-sm text-foreground/90 text-pretty">
          Encaminhamento concluído com ciência, sem resultado a registrar.
        </p>
      ) : reply.resultMd?.trim() ? (
        <MarkdownRenderer content={reply.resultMd} />
      ) : (
        <p className="text-sm text-muted-foreground">Sem resultado registrado.</p>
      )}

      {replyDocuments.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
            <Paperclip
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            Anexos
          </h3>
          <ul className="flex flex-col gap-2">
            {replyDocuments.map((doc, i) => (
              <li
                key={doc.documentId}
                className="animate-rise-in"
                style={{ "--rise-delay": `${i * 60}ms` } as CSSProperties}
              >
                <ReplyDocumentRow document={doc} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground tabular-nums">
        {reply.repliedAt ? `Concluído em ${formatDateTime(reply.repliedAt)}` : ""}
        {reply.repliedByName ? ` por ${reply.repliedByName}` : ""}
      </p>
    </section>
  );
}

/**
 * One reply attachment. TWO independent axes, resolved in this order — the same
 * discipline as the Wave-A document row:
 *
 * 1. **Availability** — the state of the FILE. A non-servable file has nothing
 *    to open regardless of who is asking, so it is answered first and its own
 *    sentence explains why.
 * 2. **`canOpen`** — SERVER-computed, obeyed verbatim. This component never
 *    re-derives access, never inspects anything to guess it, and — the rule that
 *    matters most here — **never calls the open door to find out**. Calling the
 *    audited door to discover whether the reader may open a file would write an
 *    audit row for a read that never happened, and would turn a permission
 *    question into a PHI-corridor event.
 *
 * This is where the referral's deliberate two-tier asymmetry becomes visible
 * (plan §3.2): the row is listed to a `can_read_referral_metadata` reader, while
 * the bytes need `can_read_referral_phi`. A metadata-tier reader therefore sees
 * `available` + `canOpen: false` — a legitimate, expected state, NOT an error.
 *
 * ⚠ Unlike Wave A, that state is REACHABLE here, so the row must render it.
 * Wave A removed its equivalent branch because its clearance ceiling is an RLS
 * predicate — a document above your clearance is absent from the list entirely,
 * so "visible but restricted" was unreachable and the copy was dead. The
 * referral lane is the opposite by design: visibility and byte access are gated
 * by two DIFFERENT predicates, so hiding the row would tell a reader entitled to
 * the referral's metadata that the reply had no attachments. It had one; they
 * simply cannot open it, and the row says exactly that.
 */
function ReplyDocumentRow({ document: doc }: { document: ReferralReplyDocument }) {
  const size = formatFileSize(doc.sizeBytes);

  // Axis 1 — the FILE's state. Narrowed on the union member rather than read
  // from `DOCUMENT_AVAILABILITY_ALLOWS_OPEN`, because narrowing is what makes
  // the presentation lookup TOTAL without a cast: every state but `available`
  // has an entry, by the type of that record. The two agree today (the map is
  // `true` for `available` alone), and if a sixth availability is ever added,
  // the contract's own `Record` stops compiling — the vocabulary catches it
  // rather than this row silently mis-rendering.
  //
  // The one deliberate divergence from the Wave-A row: `pending` renders NO
  // control here, not a disabled one. A reply attachment is uploaded by the
  // committee that is about to answer, in a dialog that reports its own
  // progress — by the time this list is read the wait is somebody else's, and a
  // greyed button would promise bytes this reader cannot make arrive.
  if (doc.availability !== "available") {
    const presentation = AVAILABILITY_PRESENTATION[doc.availability];
    return (
      <ReferralInertFileRow
        title={doc.title}
        size={size}
        badge={presentation.label}
        detail={presentation.detail}
        reason="state"
      />
    );
  }

  // Axis 2 — the SERVER's answer about THIS caller. Obeyed, never re-derived,
  // and never discovered by calling the door.
  if (!doc.canOpen) {
    return (
      <ReferralInertFileRow
        title={doc.title}
        size={size}
        badge={REFERRAL_FILE_NO_ACCESS_LABEL}
        detail={REFERRAL_ATTACHMENT_NO_ACCESS_DETAIL}
        reason="authorization"
      />
    );
  }

  return (
    <ReferralOpenFileButton
      door={{ kind: "reply", documentVersionId: doc.documentVersionId }}
      // Distinct prefix from the shared-document list — both render on a
      // concluded referral, and two rows with the same title would otherwise
      // share one accessible name.
      label={`Baixar anexo da resposta ${doc.title}`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">
          {doc.title}
        </span>
        {size && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {size}
          </span>
        )}
      </span>
    </ReferralOpenFileButton>
  );
}


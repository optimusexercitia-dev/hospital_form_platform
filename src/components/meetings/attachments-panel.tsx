import { Download, Paperclip } from "lucide-react";

import type { MeetingAttachmentWithUrl } from "@/lib/queries/meetings";
import { deleteMeetingAttachment } from "@/lib/meetings/actions";
import { attachmentsEnabled } from "@/lib/attachments/actions";
import { OpenAttachmentButton } from "@/components/attachments/open-attachment-button";
import { AttachmentUpload } from "./attachment-upload";
import { ConfirmDeleteButton } from "./confirm-delete-button";
import { ATTACHMENT_KIND_LABEL } from "./meeting-labels";
import { formatDate } from "./format";

/**
 * Meeting ATTACHMENTS panel (F4; rewired onto the centralized-attachments
 * substrate in F2 — ADR 0063): file-backed artifacts (pauta, apresentação,
 * literatura, lista de presença, ata assinada, outro), newest-first, each with a
 * download and a soft-delete. Server-Component shell — the data (incl. fresh
 * signed URLs where available) arrives as props; the upload + delete are client
 * islands. Soft-deleted rows are already filtered out by `listMeetingAttachments`.
 *
 * Meetings default to the STANDARD tier, so most rows carry a usable inline
 * `signedUrl` and open directly; a row with `signedUrl: null` (an escalated
 * phi-tier attachment, or a batch-signing failure) opens via the audited
 * {@link OpenAttachmentButton} instead — never pre-fetched, only on click.
 *
 * Upload/delete AND the audited open door are gated on the `attachments` feature
 * flag (`attachmentsEnabled()`); while off, existing rows render read-only and the
 * escalated-open control is disabled rather than hidden (list reads themselves are
 * never gated).
 */
export async function AttachmentsPanel({
  meetingId,
  attachments,
  canEdit,
}: {
  meetingId: string;
  attachments: MeetingAttachmentWithUrl[];
  canEdit: boolean;
}) {
  const flagOn = await attachmentsEnabled();
  const canEditNow = canEdit && flagOn;
  return (
    <section
      aria-labelledby="meeting-attachments-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Paperclip
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2
            id="meeting-attachments-heading"
            className="text-base font-semibold"
          >
            Anexos
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {attachments.length}
          </span>
        </div>
        {canEditNow && <AttachmentUpload meetingId={meetingId} />}
      </div>

      {attachments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {canEditNow
            ? "Nenhum anexo. Envie a pauta, apresentações ou a ata assinada."
            : "Nenhum anexo."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/70">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {att.title}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-secondary-foreground uppercase">
                    {ATTACHMENT_KIND_LABEL[att.kind]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  Enviado em {formatDate(att.createdAt)}
                  {att.uploadedByName ? ` por ${att.uploadedByName}` : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-start gap-0.5">
                {att.signedUrl ? (
                  <a
                    href={att.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Baixar ${att.title}`}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    <Download aria-hidden="true" className="size-4" />
                  </a>
                ) : (
                  <OpenAttachmentButton
                    attachmentId={att.id}
                    label={`Baixar ${att.title}`}
                    disabled={!flagOn}
                  />
                )}
                {canEditNow && (
                  <ConfirmDeleteButton
                    // Bound server-action reference (NOT an inline closure): this
                    // panel is a Server Component, and a closure — even one
                    // wrapping a `"use server"` action — is not serializable across
                    // the RSC→Client boundary into `ConfirmDeleteButton`
                    // (`"use client"`), which crashes the page on the
                    // delete-with-attachments path (P10-LATENT-001, found in the
                    // Phase 11 audit). `.bind(null, …)` IS serializable.
                    action={deleteMeetingAttachment.bind(null, att.id)}
                    label={`Remover ${att.title}`}
                    title="Remover este anexo?"
                    description={`O anexo “${att.title}” deixará de aparecer. O arquivo enviado é mantido por imutabilidade.`}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

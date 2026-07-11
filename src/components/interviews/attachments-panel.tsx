import { Download, ExternalLink, Paperclip } from "lucide-react";

import type { InterviewAttachmentWithUrl } from "@/lib/queries/interviews";
import { softDeleteInterviewAttachment } from "@/lib/interviews/actions";
import { attachmentsEnabled } from "@/lib/attachments/actions";
import { OpenAttachmentButton } from "@/components/attachments/open-attachment-button";
import { AttachmentUpload } from "./attachment-upload";
import { AttachmentLinkForm } from "./attachment-link-form";
import { ConfirmDeleteButton } from "./confirm-delete-button";
import { ATTACHMENT_KIND_LABEL } from "./interview-labels";
import { formatDate } from "./format";

/**
 * Interview ATTACHMENTS panel (F3; the file side rewired onto the
 * centralized-attachments substrate in F2 — ADR 0063): unified evidence — stored
 * FILES (transcrição assinada, evidência, …) opened via the audited attachments
 * door, AND external LINKS (e.g. an audio-recording URL) opened directly. Newest-
 * first; the writer uploads files, adds links, and soft-deletes (Storage objects
 * retained — Rule 6). Server-Component shell — the data arrives as props; the
 * upload, add-link, and delete are client islands. Soft-deleted rows are already
 * filtered out by `listInterviewAttachments`.
 *
 * The row discriminates file-vs-link WITHOUT guessing: exactly one of
 * `openUrl`/`externalUrl` is non-null. A LINK's `externalUrl` opens directly in a
 * new tab (unaudited — it is just a stored URL, never a blob). A FILE's `openUrl`
 * is always `null` (interviews default to the PHI tier), so files open via the
 * audited {@link OpenAttachmentButton} instead — never pre-fetched, only on click.
 *
 * Upload/add-link/delete AND the file-open door are gated on the `attachments`
 * feature flag; while off, existing rows render read-only and the file-open
 * control is disabled (list reads + link opens are never gated).
 */
export async function AttachmentsPanel({
  interviewId,
  attachments,
  canEdit,
}: {
  interviewId: string;
  attachments: InterviewAttachmentWithUrl[];
  canEdit: boolean;
}) {
  const flagOn = await attachmentsEnabled();
  const canEditNow = canEdit && flagOn;
  return (
    <section
      aria-labelledby="interview-attachments-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Paperclip
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2
            id="interview-attachments-heading"
            className="text-base font-semibold"
          >
            Anexos e gravações
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {attachments.length}
          </span>
        </div>
        {canEditNow && (
          <div className="flex flex-wrap items-center gap-2">
            <AttachmentLinkForm interviewId={interviewId} />
            <AttachmentUpload interviewId={interviewId} />
          </div>
        )}
      </div>

      {attachments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {canEditNow
            ? "Nenhum anexo. Envie a transcrição assinada ou vincule a gravação de áudio."
            : "Nenhum anexo."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/70">
          {attachments.map((att) => {
            const isLink = att.externalUrl != null;
            return (
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
                    {isLink && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6rem] font-medium tracking-wide text-muted-foreground uppercase">
                        Link
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Adicionado em {formatDate(att.createdAt)}
                    {att.uploadedByName ? ` por ${att.uploadedByName}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-start gap-0.5">
                  {isLink ? (
                    att.externalUrl && (
                      <a
                        href={att.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Abrir ${att.title}`}
                        className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                      >
                        <ExternalLink aria-hidden="true" className="size-4" />
                      </a>
                    )
                  ) : att.openUrl ? (
                    // Standard-tier file (not the default for interviews, but
                    // possible after a future reclassification): direct inline URL.
                    <a
                      href={att.openUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Baixar ${att.title}`}
                      className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                    >
                      <Download aria-hidden="true" className="size-4" />
                    </a>
                  ) : (
                    // PHI-tier file (the default): audited open, on click only.
                    <OpenAttachmentButton
                      attachmentId={att.id}
                      label={`Baixar ${att.title}`}
                      disabled={!flagOn}
                    />
                  )}
                  {canEditNow && (
                    <ConfirmDeleteButton
                      // Bound server-action reference (NOT an inline closure):
                      // this panel is a Server Component, and a closure — even one
                      // wrapping a `"use server"` action — is not serializable
                      // across the RSC→Client boundary into `ConfirmDeleteButton`
                      // (`"use client"`), which crashes the page on this render
                      // path (P11-001). `.bind(null, …)` IS serializable.
                      action={softDeleteInterviewAttachment.bind(null, att.id)}
                      label={`Remover ${att.title}`}
                      title="Remover este anexo?"
                      description={
                        isLink
                          ? `O link “${att.title}” deixará de aparecer.`
                          : `O anexo “${att.title}” deixará de aparecer. O arquivo enviado é mantido por imutabilidade.`
                      }
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

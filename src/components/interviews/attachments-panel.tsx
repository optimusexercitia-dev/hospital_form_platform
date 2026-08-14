import { ExternalLink, Link2 } from "lucide-react";

import type { InterviewAttachmentWithUrl } from "@/lib/queries/interviews";
import { softDeleteInterviewAttachment } from "@/lib/interviews/actions";
import { documentsWaveAEnabled } from "@/lib/documents/actions";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { AttachmentLinkForm } from "./attachment-link-form";
import { ConfirmDeleteButton } from "./confirm-delete-button";
import { formatDate } from "./format";

/**
 * Interview evidence — RE-POINTED to the core document model (DM2·S3 Wave A;
 * ADR 0114), and the one HYBRID surface in Wave A.
 *
 * Interviews carry two genuinely different things, and Wave A stops pretending
 * they are one:
 *
 * 1. **Stored FILES** (transcrição assinada, evidência, …) — now `documents`
 *    homed on the interview's `securable_resources` row, rendered by the shared
 *    {@link DocumentsPanel} and opened through the single audited byte corridor.
 * 2. **External LINKS** (e.g. an audio-recording URL) — these stay on
 *    `case_interview_links` and OUTSIDE the document model. A link has no bytes,
 *    no version, no file object and no disposal state; representing it as a
 *    document would mean inventing all four.
 *
 * They are rendered as two sections rather than one mixed list because they are
 * two substrates with two lifecycles — an availability state means something for
 * a file and nothing for a URL.
 *
 * ## Why links ride `documents_wave_a`
 *
 * Lead ruling (DM2·S3): links are dark TODAY because F2 folded them behind the
 * now-dead `attachments` flag, so riding the Wave-A flag is not a new
 * restriction — it restores them coherently and keeps the interview surface from
 * showing links with no files. Recorded as a deliberate INTERIM: a later slice
 * may give links their own gate, and that decision should be made on its own
 * merits rather than inherited from this one.
 *
 * Interview files may contain patient data (the case module is Class-1 under
 * Rule 12) — their titles may not. The shared upload dialog carries that D12
 * distinction.
 */
export async function AttachmentsPanel({
  interviewId,
  attachments,
  canEdit,
}: {
  interviewId: string;
  /** Interview evidence rows; only the LINK half is consumed here (the file half
   * now arrives through the document model). */
  attachments: InterviewAttachmentWithUrl[];
  canEdit: boolean;
}) {
  const flagOn = await documentsWaveAEnabled();
  const canEditNow = canEdit && flagOn;

  // Discriminate WITHOUT guessing: a link is exactly a row carrying an
  // `externalUrl`. The file half of this query is inert post-DM1 and is replaced
  // by `DocumentsPanel` below, so anything else here is ignored rather than
  // rendered as a broken file row.
  const links = attachments.filter((a) => a.externalUrl != null);

  return (
    <>
      <DocumentsPanel
        home={{ type: "interview", id: interviewId }}
        access={{ canWrite: canEdit, canDownload: true }}
      />

      <section
        aria-labelledby="interview-links-heading"
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link2 aria-hidden="true" className="size-4 text-muted-foreground" />
            <h2 id="interview-links-heading" className="text-base font-semibold">
              Gravações e links
            </h2>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
              {links.length}
            </span>
          </div>
          {canEditNow && <AttachmentLinkForm interviewId={interviewId} />}
        </div>

        {links.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            {canEditNow
              ? "Nenhuma gravação vinculada. Adicione o endereço da gravação de áudio."
              : "Nenhuma gravação vinculada."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border/70">
            {links.map((link, i) => (
              <li
                key={link.id}
                className="animate-rise-in flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                style={{ "--rise-delay": `${i * 60}ms` } as React.CSSProperties}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm font-medium text-foreground">
                    {link.title}
                  </span>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Adicionado em {formatDate(link.createdAt)}
                    {link.uploadedByName ? ` por ${link.uploadedByName}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-start gap-0.5">
                  {link.externalUrl && (
                    // A stored URL, never a blob: opened directly, unaudited,
                    // because no platform-held bytes are involved.
                    <a
                      href={link.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Abrir ${link.title}`}
                      className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                    >
                      <ExternalLink aria-hidden="true" className="size-4" />
                    </a>
                  )}
                  {canEditNow && (
                    <ConfirmDeleteButton
                      // Bound server-action reference, NOT an inline closure: a
                      // closure is not serializable across the RSC → Client
                      // boundary and crashes this render path (P11-001).
                      action={softDeleteInterviewAttachment.bind(null, link.id)}
                      label={`Remover ${link.title}`}
                      title="Remover esta gravação?"
                      description={`O link “${link.title}” deixará de aparecer.`}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

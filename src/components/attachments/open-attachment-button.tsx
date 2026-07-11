"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";

import { openAttachment } from "@/lib/attachments/actions";
import { Button } from "@/components/ui/button";

/**
 * The AUDITED attachment-open control (Phase F2; ADR 0063). Used everywhere a list
 * row has no usable inline `signedUrl` — every PHI-tier row (case documents,
 * escalated meeting attachments, interview files) plus any standard-tier row whose
 * batch signing failed. Shared across the meeting/interview/case panels because the
 * door itself (`openAttachment`) is a single cross-cutting action, not a per-module
 * one — three copies of this click→audit→open flow would be a correctness-sensitive
 * duplication (ARCHITECTURE Rule 11).
 *
 * The RPC is called strictly ON CLICK, never on render: each phi-tier open writes
 * one `attachment.read` audit row, so pre-fetching would spam the trail. A `null`
 * result (unauthorized / missing / soft-deleted / infected / flag-off / signing
 * failure) is treated uniformly — a calm inline pt-BR message, nothing sensitive
 * rendered. `disabled` additionally covers the flag-off case pre-emptively (skips a
 * doomed round trip when the caller already knows `attachmentsEnabled()` is false).
 */
export function OpenAttachmentButton({
  attachmentId,
  label,
  disabled = false,
}: {
  /** The underlying `attachments.id` — passed to the audited `openAttachment` door. */
  attachmentId: string;
  /** Accessible label for the trigger, e.g. `Baixar Prescrição.pdf`. */
  label: string;
  /** Disables the control (e.g. the `attachments` feature flag is off). */
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function handleOpen() {
    setFailed(false);
    startTransition(async () => {
      const { signedUrl } = await openAttachment(attachmentId);
      if (signedUrl) {
        window.open(signedUrl, "_blank", "noopener,noreferrer");
      } else {
        setFailed(true);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleOpen}
        disabled={disabled || isPending}
        aria-label={label}
        title={disabled ? "Recurso de anexos indisponível" : undefined}
        className="text-muted-foreground hover:text-foreground"
      >
        {isPending ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <Download aria-hidden="true" className="size-4" />
        )}
      </Button>
      {failed && (
        <span
          role="alert"
          className="text-right text-[0.65rem] leading-tight font-medium text-destructive"
        >
          Não foi possível abrir o anexo.
        </span>
      )}
    </div>
  );
}

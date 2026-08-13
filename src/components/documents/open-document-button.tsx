"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";

import { openDocumentVersion } from "@/lib/documents/actions";
import { Button } from "@/components/ui/button";

/**
 * THE audited document-open control (DM2·S3; ADR 0114 D8/D10/D11).
 *
 * Every byte of every Wave-A document moves through this one control, because
 * `open_document_version` is the platform's single byte corridor: it authorizes
 * through the kernel (D15 ceiling included), refuses non-servable states, records
 * the audit row, and only then signs a short-TTL URL. There is deliberately no
 * inline `<a href>` fast path anywhere in the Wave-A UI — the projections carry no
 * storage coordinates at all, so there is nothing to link to. That is the F-01
 * class dying structurally rather than by convention.
 *
 * The action runs strictly ON CLICK, never on render: each open may write an
 * audit row, so pre-fetching would spam the trail.
 *
 * Failure is uniform and calm. Unauthorized, missing, disposed, still-scanning,
 * flag-off and signing-failure all render the same inline pt-BR message: the
 * differences between them are exactly the information a denied caller must not
 * receive. A THROWN action (the S2 contract stub throws until the command lands)
 * is caught here too, so this control degrades to "não foi possível" rather than
 * crashing the row.
 */
export function OpenDocumentButton({
  documentVersionId,
  label,
}: {
  /** The `document_versions.id` handed to the audited door. */
  documentVersionId: string;
  /** Accessible label for the trigger, e.g. `Baixar Ata da reunião`. */
  label: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function handleOpen() {
    setFailed(false);
    startTransition(async () => {
      try {
        const result = await openDocumentVersion(documentVersionId);
        if (result.ok) {
          window.open(result.url, "_blank", "noopener,noreferrer");
        } else {
          setFailed(true);
        }
      } catch {
        // Never surface a raw server error (CLAUDE.md §8) — and never let a
        // rejected action escape into the error boundary and blank the panel.
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
        disabled={isPending}
        aria-label={label}
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
          Não foi possível abrir o documento.
        </span>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";

import { openControlledDocumentVersion } from "@/lib/controlled-documents/actions";
import { documentErrorMessage } from "@/components/documents/document-labels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * THE audited open control for a CONTROLLED-document version (DM3·S2; ADR 0114
 * D8/D11, ADR 0118 §1).
 *
 * ## What this replaces, and why it is not a refactor
 *
 * Until DM3 a controlled document had two download chains, and NEITHER was a
 * serving route: both minted a signed Storage URL during RSC render and handed
 * the browser a plain `<a href>`. Authority was therefore checked exactly once,
 * at page render, by the `controlled_documents_obj_select_member` Storage policy
 * — and the resulting bearer URL stayed valid for its whole TTL with no
 * download-time re-check and no audit row. DM3 M5 drops that policy, so there is
 * no longer anything signable outside the door.
 *
 * Now every byte moves through `open_document_version`, which authorizes through
 * the kernel, refuses non-servable states, writes the D11 audit row, and only
 * then signs a short-TTL URL. The action runs strictly ON CLICK, never on render:
 * an open may write an audit row, so pre-fetching one per listed version would
 * spam the trail with reads nobody performed.
 *
 * ⚠ This control is an AFFORDANCE, not a boundary. Hiding or disabling it hides
 * a button; it does not stop a request. `open_document_version` is the boundary,
 * and it re-checks every caller on every call regardless of what rendered here.
 * Nothing in this file may be cited as an access control.
 *
 * ## Prior versions
 *
 * The door takes a version id and never consults `current_version_id` or the
 * domain status, so an authorized member opening v1 of a document now at v4
 * passes exactly the same kernel as one opening v4. Prior-version download is a
 * DM3 exit criterion, and this control is what serves it.
 *
 * ## Failure
 *
 * Uniform and calm. `not_found`, `forbidden`, `unavailable`, `disposed` and
 * `module_disabled` are distinct codes to the caller but read as one kind of
 * outcome here — the differences between them are largely the information a
 * denied caller must not receive. The pt-BR wording comes from the shared
 * `documentErrorMessage` map (the same one Wave A uses — one dialect, not two),
 * and a THROWN action is caught too, so this degrades to a message rather than
 * blanking the surrounding card through the error boundary.
 */
export function OpenControlledVersionButton({
  versionId,
  label,
  className,
}: {
  /** The DOMAIN `controlled_document_versions.id` — the door resolves the core
   * version itself; the UI never handles a core id or a storage coordinate. */
  versionId: string;
  /** Visible + accessible button text, e.g. `Baixar versão vigente`. */
  label: string;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await openControlledDocumentVersion(versionId);
        if (result.ok) {
          window.open(result.url, "_blank", "noopener,noreferrer");
        } else {
          setError(documentErrorMessage(result.error));
        }
      } catch {
        // Never surface a raw server error (CLAUDE.md §8), and never let a
        // rejected action escape into the error boundary and blank the card.
        setError(documentErrorMessage("unknown"));
      }
    });
  }

  return (
    <div className={cn("flex flex-col items-start gap-1.5", className)}>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={handleOpen}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <Download aria-hidden="true" className="size-4" />
        )}
        {isPending ? "Abrindo…" : label}
      </Button>
      {error ? (
        <p
          role="alert"
          className="text-sm font-medium text-pretty text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

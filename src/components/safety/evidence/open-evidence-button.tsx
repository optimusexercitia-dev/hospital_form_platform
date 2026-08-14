"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";

import type {
  NspEvidenceActionState,
  NspEvidenceErrorCode,
} from "@/lib/safety/evidence-contract";
import { Button } from "@/components/ui/button";
import { nspEvidenceOpenMessage } from "./nsp-evidence-labels";

/** What an injected open door answers. Matches `openRcaEvidence` /
 *  `openCapaEvidence` exactly (DM5 S2 contract). */
export type OpenEvidenceAction = () => Promise<
  NspEvidenceActionState & { url?: string }
>;

/**
 * THE audited evidence-open control (DM5·S2; ADR 0114 D8, ADR 0120).
 *
 * Before S2, `listRcaEvidence` called `createSignedUrl(path, 3600)` for EVERY
 * document row while building the list, and the row rendered a plain
 * `<a href>`. That did two bad things at once: it handed out reach to files
 * nobody asked for, and — once the door became audited — it would have written
 * a `document.opened` row for every file merely LISTED. The projection now
 * carries no storage coordinate at all, so there is nothing to link to, and the
 * byte resolves here, one at a time, on click.
 *
 * The action runs strictly ON CLICK, never on render.
 *
 * ⚠ This is a deliberate FORK of `@/components/documents/open-document-button`,
 * not a reuse. The shell is the same ~25 lines, but that component's contract
 * is "every byte of every Wave-A document moves through THIS one control,
 * calling `open_document_version`" — parameterizing its door would falsify the
 * one sentence that makes it meaningful. NSP evidence resolves through a
 * different door (`openRcaEvidence` / `openCapaEvidence`). The merge candidate
 * is a shared presentational async-icon-button, which is a refactor for its own
 * change, not a rider on DM5.
 *
 * ## `canOpen` is not enforced here, and must not be
 *
 * The caller decides whether to RENDER this control from the server-computed
 * `canOpen`. That is an affordance, never a boundary (Architecture Rule 1): the
 * door itself authorizes, and a caller who reaches it without rights is refused
 * there. This component therefore never re-derives access, never inspects
 * availability, and never guesses.
 */
export function OpenEvidenceButton({
  onOpen,
  label,
}: {
  /** The audited door for this row, already bound to its evidence id. */
  onOpen: OpenEvidenceAction;
  /** Accessible label for the trigger, e.g. `Abrir Protocolo da SRPA`. */
  label: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [failure, setFailure] = useState<NspEvidenceErrorCode | null>(null);

  function handleOpen() {
    setFailure(null);
    startTransition(async () => {
      try {
        const result = await onOpen();
        if (result.ok && result.url) {
          window.open(result.url, "_blank", "noopener,noreferrer");
        } else {
          setFailure(result.ok ? "unknown" : result.code);
        }
      } catch {
        // Never surface a raw server error (CLAUDE.md §8), and never let a
        // rejected action escape into the error boundary and blank the panel.
        // The S2 contract stubs THROW until the commands land, so this branch
        // is the live path today.
        setFailure("unknown");
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
      {failure && (
        <span
          role="alert"
          className="max-w-52 text-right text-[0.65rem] leading-tight font-medium text-destructive"
        >
          {nspEvidenceOpenMessage(failure)}
        </span>
      )}
    </div>
  );
}

/**
 * The disabled twin for a `pending` row. Disabled rather than absent: the bytes
 * are genuinely on the way, so the affordance is a promise, not a dead end. It
 * stays in the accessibility tree and points at the row's explanation, so a
 * screen-reader user learns WHY it is inert instead of meeting a silent button.
 */
export function PendingEvidenceButton({
  label,
  describedBy,
}: {
  label: string;
  describedBy?: string;
}) {
  return (
    <button
      type="button"
      disabled
      aria-label={label}
      aria-describedby={describedBy}
      className="grid size-7 place-items-center rounded-md text-muted-foreground/50 disabled:cursor-not-allowed"
    >
      <Download aria-hidden="true" className="size-4" />
    </button>
  );
}

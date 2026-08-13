import type { CSSProperties } from "react";
import { Download } from "lucide-react";

import type { DocumentListItem } from "@/lib/documents/types";
import {
  AVAILABILITY_PRESENTATION,
  DOCUMENT_AVAILABILITY_ALLOWS_OPEN,
  DOCUMENT_AVAILABILITY_ALLOWS_WRITE,
  DOCUMENT_NO_VERSION,
  DOCUMENT_RESTRICTED,
  kindLabel,
} from "./document-labels";
import {
  DocumentAvailabilityBadge,
  DocumentConfidentialityBadge,
  DocumentKindBadge,
  DocumentNoVersionBadge,
  DocumentPhiBadge,
  DocumentRestrictedBadge,
} from "./document-badges";
import { DocumentDeleteButton } from "./document-delete-button";
import { OpenDocumentButton } from "./open-document-button";
import { formatDate } from "./format";

/**
 * One Wave-A document row (DM2·S3). Server Component — the only interactive
 * parts (open, delete) are their own client islands.
 *
 * ## How a row decides what to render
 *
 * Two INDEPENDENT axes, resolved in this order:
 *
 * 1. **Availability** — the state of the FILE (`DocumentAvailability`, a real
 *    5-member union). Each member gets its own badge, its own explanatory
 *    sentence, and its own affordance set. `failed` and `disposed` are pulled as
 *    far apart as the design system allows.
 * 2. **`canOpen`** — whether the SERVER would serve this version to THIS caller.
 *    Server-computed, obeyed verbatim. This component never re-derives access,
 *    never inspects the confidentiality level to decide it, and never guesses:
 *    a label is a thing to display, `canOpen` is the thing to obey.
 *
 * ## There is no "visible but restricted" row — denial is ABSENCE (BUG-DM2-002)
 *
 * An earlier version of this file rendered a "Restrito" badge for
 * `available && !canOpen`, described as the D15 ceiling denying an ordinary
 * reader. **That cell is unreachable and the description was wrong.** The
 * ceiling lives in `app.can_read_document`, which is the predicate behind the
 * `documents_select` RLS policy — so a document above the caller's clearance is
 * absent from the result set entirely, not present-and-locked. Verified live:
 * an uncleared reader gets zero rows, including the document's own creator.
 * The enforcement is real and STRICTER than the UI assumed, and it matches
 * ADR 0072's original contract, whose first pin was "absent-from-list".
 *
 * The branch is therefore gone rather than repaired. If it ever needs to come
 * back, the trigger is **ADR 0114 D16**: Phase 19's access plane must cover
 * narrowing AND widening, and a plane that makes documents visible-but-
 * restricted is exactly what would make this affordance meaningful again.
 * Until then, a row you can see is a row the server was willing to show you.
 */
export function DocumentRow({
  document: doc,
  canWrite,
  canDownload,
  index = 0,
}: {
  document: DocumentListItem;
  /** Position in the list — drives the staggered entrance only. */
  index?: number;
  /**
   * Whether the Wave-A write surface is live for this viewer at all (capability
   * + feature flag). Per-ROW delete authority is NOT this — it is the
   * server-computed `canDelete`, below.
   */
  canWrite: boolean;
  /**
   * Viewer may obtain document BYTES at all (ADR 0100 D3/D7 — the quality
   * reviewer reads metadata but never downloads). Suppresses the audited door
   * outright; there is no second byte path to also remember to suppress.
   */
  canDownload: boolean;
}) {
  const version = doc.latestVersion;
  const availability = version?.availability ?? null;
  const kind = kindLabel(doc.kind);

  // Which explanatory sentence, if any, sits under the title. A servable row
  // needs none — the enabled download control is the whole message.
  const detail =
    version == null
      ? DOCUMENT_NO_VERSION.detail
      : availability === "available"
        ? null
        : AVAILABILITY_PRESENTATION[availability!].detail;

  // `canOpen` is still consulted rather than inferred from `availability`, even
  // though the query currently defines it as exactly that. It is the server's
  // answer, and obeying it is what keeps this component correct if the
  // definition ever tightens (see the D16 note above).
  const showOpen =
    canDownload &&
    version != null &&
    DOCUMENT_AVAILABILITY_ALLOWS_OPEN[version.availability] &&
    version.canOpen;

  // `pending` is the one non-servable state that still offers a (disabled)
  // control: bytes are genuinely on the way, so the affordance is a promise
  // rather than a dead end. Every other non-servable state renders none.
  const showPendingOpen =
    canDownload && version != null && availability === "pending";

  // Delete authority is SERVER-computed (`canDelete`), folding write authority
  // and "no live legal hold" together in one batched door. Deliberately NOT
  // derived here, and deliberately NOT branched off `underLegalHold`: hold
  // VISIBILITY and delete AUTHORITY have different audiences, so an ordinary
  // writer can hold delete rights while being unable to see holds. Branching on
  // the hold would either leak its existence or get the affordance wrong.
  //
  // The two local conditions remain because they are UI facts the server does
  // not model: the Wave-A write surface being live at all, and a disposed row
  // being a tombstone rather than a document.
  const showWrite =
    canWrite &&
    doc.canDelete &&
    (availability == null || DOCUMENT_AVAILABILITY_ALLOWS_WRITE[availability]);

  const detailId = detail ? `doc-${doc.id}-state` : undefined;

  return (
    <li
      className="animate-rise-in flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
      style={{ "--rise-delay": `${index * 60}ms` } as CSSProperties}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {doc.title}
          </span>
          {kind && <DocumentKindBadge label={kind} />}
          {/* The PHI badge asserts something about a FILE ("o arquivo contém
              dados de paciente"), so it is suppressed when no file exists — a
              row with no version otherwise claimed both "Sem arquivo" and
              "Dados de paciente" at once.

              ⚠ This suppresses the BADGE only. `containsPhi` itself falls back
              to the home rule when there is no file object, which is the correct
              fail-safe (over-warn, never under-warn) and must NOT be changed.
              The contradiction is only reachable for a `latestVersion: null` row,
              a state `begin_document_upload` cannot produce. */}
          {doc.containsPhi && version != null && <DocumentPhiBadge />}
          {doc.confidentialityLevel && (
            <DocumentConfidentialityBadge level={doc.confidentialityLevel} />
          )}
          {version == null ? (
            <DocumentNoVersionBadge />
          ) : (
            // Renders nothing for `available` — a servable row needs no badge.
            <DocumentAvailabilityBadge availability={version.availability} />
          )}
        </div>

        {doc.description && (
          <p className="text-xs text-pretty text-muted-foreground">{doc.description}</p>
        )}

        {detail && (
          <p id={detailId} className="text-xs text-pretty text-muted-foreground">
            {detail}
          </p>
        )}

        <p className="text-xs text-muted-foreground tabular-nums">
          {/* The document's real-world date, distinct from upload time — an ata
              dated last month can be uploaded today. Restored to the contract
              after the F2 panel's `occurredAt` went missing from the first
              projection draft. */}
          {doc.occurredAt ? `Data: ${formatDate(doc.occurredAt)} · ` : ""}
          Enviado em {formatDate(doc.createdAt)}
          {doc.createdByName ? ` por ${doc.createdByName}` : ""}
        </p>
      </div>

      <div className="flex shrink-0 items-start gap-0.5">
        {showOpen && (
          <OpenDocumentButton
            documentVersionId={version.id}
            label={`Baixar ${doc.title}`}
          />
        )}
        {showPendingOpen && (
          // Disabled rather than absent: the file is genuinely on the way, so the
          // control is a promise, not a dead end. It stays in the accessibility
          // tree and points at the explanation, so a screen-reader user learns WHY
          // it is disabled instead of meeting a silent dead button.
          <button
            type="button"
            disabled
            aria-label={`Baixar ${doc.title}`}
            aria-describedby={detailId}
            className="grid size-7 place-items-center rounded-md text-muted-foreground/50 disabled:cursor-not-allowed"
          >
            <Download aria-hidden="true" className="size-4" />
          </button>
        )}
        {showWrite && (
          <DocumentDeleteButton
            documentId={doc.id}
            title={doc.title}
            description={
              availability === "failed"
                ? `O envio de “${doc.title}” não foi concluído. Remover este item permite enviar o arquivo novamente.`
                : `O documento “${doc.title}” deixará de aparecer. O arquivo enviado é mantido por imutabilidade.`
            }
          />
        )}
      </div>
    </li>
  );
}

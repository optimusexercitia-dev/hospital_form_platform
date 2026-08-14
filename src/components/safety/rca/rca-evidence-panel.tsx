"use client";

import type { CSSProperties } from "react";
import { ExternalLink, FileText, Quote } from "lucide-react";

import { EVIDENCE_KIND_LABELS } from "@/lib/safety/rca-types";
import type { RcaEvidenceView } from "@/lib/safety/evidence-contract";
import { deleteRcaEvidence, openRcaEvidence } from "@/lib/safety/rca-actions";
import { DocumentAvailabilityBadge } from "@/components/documents/document-badges";
import {
  NSP_EVIDENCE_ALLOWS_OPEN,
  NSP_EVIDENCE_ALLOWS_WRITE,
  NSP_EVIDENCE_AVAILABILITY,
} from "@/components/safety/evidence/nsp-evidence-labels";
import {
  OpenEvidenceButton,
  PendingEvidenceButton,
} from "@/components/safety/evidence/open-evidence-button";
import { RcaConfirmDelete } from "./rca-confirm-delete";
import {
  EvidenceCitationForm,
  EvidenceLinkForm,
  EvidenceUpload,
  type RcaCitationTarget,
} from "./rca-evidence-forms";
import { formatDate } from "../format";

/**
 * The RCA EVIDENCE panel (DM5·S2) — three input modes: uploaded FILES on the
 * core document substrate, external LINKS, and CITATIONS of an existing
 * interview / meeting / document. Newest-first; soft-delete retains the
 * immutable object (Rule 6).
 *
 * ⚠ `openUrl` is GONE. This panel used to receive a signed URL per document row
 * — `listRcaEvidence` minted `createSignedUrl(storage_path, 3600)` for EVERY
 * row while building the list, on the private `nsp-evidence` bucket, against
 * PO-ruled TTLs of 120 s (PHI) / 300 s, and recorded nothing about having minted
 * a bearer token (the Rule 11 gap). The projection now carries no storage
 * coordinate at all, so there is nothing to link to: bytes resolve one at a
 * time through the audited door, on click (ADR 0114 D8, ADR 0120).
 *
 * What replaces the href is a STATE. Because a caller-minted path could never be
 * non-servable, this UI has never had to say "still being verified", "the upload
 * failed" or "eliminated under retention"; all three are now real, and the last
 * is a normal governance outcome rather than a fault.
 */
export function RcaEvidencePanel({
  rcaId,
  evidence,
  citationTargets,
  canEdit,
}: {
  rcaId: string;
  evidence: RcaEvidenceView[];
  /** Citable artifacts. S2 un-parks the `document` target; the picker renders
   *  whatever the server offers and never branches on the kind. */
  citationTargets: RcaCitationTarget[];
  canEdit: boolean;
}) {
  return (
    <section
      aria-labelledby="rca-evidence-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2 id="rca-evidence-heading" className="text-base font-semibold">
            Evidências
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {evidence.length}
          </span>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <EvidenceUpload rcaId={rcaId} />
            <EvidenceLinkForm rcaId={rcaId} />
            {citationTargets.length > 0 && (
              <EvidenceCitationForm rcaId={rcaId} targets={citationTargets} />
            )}
          </div>
        )}
      </div>

      {evidence.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {canEdit
            ? "Nenhuma evidência. Envie um arquivo, adicione um link ou cite um registro."
            : "Nenhuma evidência registrada."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/70">
          {evidence.map((ev, i) => (
            <EvidenceRow key={ev.id} evidence={ev} canEdit={canEdit} index={i} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EvidenceRow({
  evidence: ev,
  canEdit,
  index,
}: {
  evidence: RcaEvidenceView;
  canEdit: boolean;
  index: number;
}) {
  // `availability` is null unless `kind = 'document'` — a link or a citation has
  // no bytes, so there is no state for them to be in.
  const availability = ev.availability;
  const detail =
    availability && availability !== "available"
      ? NSP_EVIDENCE_AVAILABILITY[availability].detail
      : null;
  const detailId = detail ? `rca-ev-${ev.id}-state` : undefined;

  // `canOpen` is the SERVER's answer and is obeyed verbatim — never re-derived
  // here, never inferred from `availability`, and never treated as a boundary
  // (Architecture Rule 1: the audited door authorizes; this decides what to draw).
  const showOpen =
    ev.kind === "document" &&
    availability != null &&
    NSP_EVIDENCE_ALLOWS_OPEN[availability] &&
    ev.canOpen;
  const showPending = ev.kind === "document" && availability === "pending";
  const showWrite =
    canEdit && (availability == null || NSP_EVIDENCE_ALLOWS_WRITE[availability]);

  return (
    <li
      className="animate-rise-in flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
      style={{ "--rise-delay": `${index * 60}ms` } as CSSProperties}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {ev.title}
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.6rem] font-medium tracking-wide text-secondary-foreground uppercase">
            {EVIDENCE_KIND_LABELS[ev.kind]}
          </span>
          {availability && (
            /* Renders nothing for `available` — a servable row needs no badge,
               the enabled control is the signal. */
            <DocumentAvailabilityBadge availability={availability} />
          )}
        </div>
        {ev.kind === "citation" && ev.citationLabel && (
          <p className="truncate text-xs text-muted-foreground">{ev.citationLabel}</p>
        )}
        {detail && (
          <p id={detailId} className="text-xs text-pretty text-muted-foreground">
            {detail}
          </p>
        )}
        <p className="text-xs text-muted-foreground tabular-nums">
          Adicionado em {formatDate(ev.createdAt)}
        </p>
      </div>

      <div className="flex shrink-0 items-start gap-0.5">
        {showOpen && (
          <OpenEvidenceButton
            onOpen={() => openRcaEvidence(ev.id)}
            label={`Abrir ${ev.title}`}
          />
        )}
        {showPending && (
          <PendingEvidenceButton label={`Abrir ${ev.title}`} describedBy={detailId} />
        )}
        {ev.kind === "link" && ev.externalUrl && (
          <a
            href={ev.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir ${ev.title}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        )}
        {ev.kind === "citation" && (
          /* A citation points at a record inside the platform, not at bytes —
             the icon marks the row's nature and is decorative, so it is not a
             control and must not read as one. */
          <span
            aria-hidden="true"
            className="grid size-7 place-items-center rounded-md text-muted-foreground"
          >
            <Quote className="size-4" />
          </span>
        )}
        {showWrite && (
          <RcaConfirmDelete
            action={() => deleteRcaEvidence(ev.id)}
            label={`Remover ${ev.title}`}
            title="Remover esta evidência?"
            description={
              availability === "failed"
                ? `O envio de “${ev.title}” não foi concluído. Remover esta evidência permite enviar o arquivo novamente.`
                : ev.kind === "document"
                  ? `A evidência “${ev.title}” deixará de aparecer. O arquivo enviado é mantido por imutabilidade.`
                  : `A evidência “${ev.title}” deixará de aparecer.`
            }
          />
        )}
      </div>
    </li>
  );
}

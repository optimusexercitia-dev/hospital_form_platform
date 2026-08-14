"use client";

import type { CSSProperties } from "react";
import { ExternalLink } from "lucide-react";

import { CAPA_EVIDENCE_KIND_LABELS } from "@/lib/safety/capa-types";
import type { CapaActionEvidenceView } from "@/lib/safety/evidence-contract";
import { deleteCapaActionEvidence, openCapaEvidence } from "@/lib/safety/capa-actions";
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
import { RcaConfirmDelete } from "../rca/rca-confirm-delete";
import { formatDate } from "../format";
import { CapaEvidenceLinkForm, CapaEvidenceUpload } from "./capa-evidence-forms";

/**
 * The implementation-evidence list for one CAPA action (DM5·S2): uploaded FILES
 * on the core document substrate + external LINKS, newest-first.
 *
 * ⚠ `openUrl` is GONE. The list used to carry a signed URL per document row,
 * minted eagerly by `listCapaActionEvidence` while building the list, rendered
 * as a plain `<a href>`. The projection now carries no storage coordinate at
 * all — bytes resolve one at a time through the audited door, on click (ADR 0114
 * D8). What replaces the href is a STATE: a file that is still being verified,
 * whose upload failed, or that has been eliminated under retention now says so
 * instead of presenting a link that goes nowhere.
 */
export function CapaEvidenceList({
  actionId,
  evidence,
  canEdit,
}: {
  actionId: string;
  evidence: CapaActionEvidenceView[];
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Evidências
          {evidence.length > 0 && (
            <span className="ml-1.5 tabular-nums">{evidence.length}</span>
          )}
        </h4>
        {canEdit && (
          <div className="flex items-center gap-1.5">
            <CapaEvidenceUpload actionId={actionId} />
            <CapaEvidenceLinkForm actionId={actionId} />
          </div>
        )}
      </div>

      {evidence.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Nenhuma evidência de implementação.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60">
          {evidence.map((ev, i) => (
            <CapaEvidenceRow
              key={ev.id}
              evidence={ev}
              canEdit={canEdit}
              index={i}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CapaEvidenceRow({
  evidence: ev,
  canEdit,
  index,
}: {
  evidence: CapaActionEvidenceView;
  canEdit: boolean;
  index: number;
}) {
  // `availability` is null for a `link` row — there are no bytes to be in a
  // state. Only a `document` row has one.
  const availability = ev.availability;
  const detail =
    availability && availability !== "available"
      ? NSP_EVIDENCE_AVAILABILITY[availability].detail
      : null;
  const detailId = detail ? `capa-ev-${ev.id}-state` : undefined;

  // `canOpen` is the SERVER's answer and is obeyed verbatim — never re-derived
  // here, and never used as a boundary (Architecture Rule 1: the door
  // authorizes; this only decides what to draw).
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
      className="animate-rise-in flex items-start justify-between gap-2 py-2 first:pt-0 last:pb-0"
      style={{ "--rise-delay": `${index * 40}ms` } as CSSProperties}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm text-foreground">{ev.title}</span>
          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[0.6rem] font-medium tracking-wide text-secondary-foreground uppercase">
            {CAPA_EVIDENCE_KIND_LABELS[ev.kind]}
          </span>
          {availability && (
            /* Renders nothing for `available` — a servable row needs no badge,
               the enabled control is the signal. */
            <DocumentAvailabilityBadge availability={availability} />
          )}
        </span>
        {detail && (
          <span id={detailId} className="text-xs text-pretty text-muted-foreground">
            {detail}
          </span>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDate(ev.createdAt)}
        </span>
      </div>

      <div className="flex shrink-0 items-start gap-0.5">
        {showOpen && (
          <OpenEvidenceButton
            onOpen={() => openCapaEvidence(ev.id)}
            label={`Abrir ${ev.title}`}
          />
        )}
        {showPending && (
          <PendingEvidenceButton
            label={`Abrir ${ev.title}`}
            describedBy={detailId}
          />
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
        {showWrite && (
          <RcaConfirmDelete
            action={() => deleteCapaActionEvidence(ev.id)}
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

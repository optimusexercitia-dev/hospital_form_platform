"use client";

import { Download, ExternalLink, FileText, Quote } from "lucide-react";

import {
  EVIDENCE_KIND_LABELS,
  type RcaEvidence,
} from "@/lib/safety/rca-types";
import { deleteRcaEvidence } from "@/lib/safety/rca-actions";
import { cn } from "@/lib/utils";
import { RcaConfirmDelete } from "./rca-confirm-delete";
import {
  EvidenceCitationForm,
  EvidenceLinkForm,
  EvidenceUpload,
  type RcaCitationTarget,
} from "./rca-evidence-forms";
import { formatDate } from "../format";

/**
 * The RCA EVIDENCE panel (track-doc deliverable): three input modes — uploaded
 * FILES (immutable `nsp-evidence` bucket, opened via a signed URL), external LINKS,
 * and CITATIONS to an existing interview / meeting / document (snapshot label).
 * Newest-first; soft-delete retains the immutable object (Rule 6). Mirrors the
 * interview attachments panel.
 */
export function RcaEvidencePanel({
  rcaId,
  evidence,
  citationTargets,
  canEdit,
}: {
  rcaId: string;
  evidence: RcaEvidence[];
  /** Citable artifacts (empty until backend's `listRcaCitationTargets` lands). */
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
          {evidence.map((ev) => (
            <EvidenceRow key={ev.id} evidence={ev} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EvidenceRow({
  evidence: ev,
  canEdit,
}: {
  evidence: RcaEvidence;
  canEdit: boolean;
}) {
  const openHref =
    ev.kind === "document" ? ev.openUrl : ev.kind === "link" ? ev.externalUrl : null;
  const Icon =
    ev.kind === "document" ? Download : ev.kind === "link" ? ExternalLink : Quote;

  return (
    <li className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {ev.title}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[0.6rem] font-medium tracking-wide uppercase",
              "bg-secondary text-secondary-foreground",
            )}
          >
            {EVIDENCE_KIND_LABELS[ev.kind]}
          </span>
        </div>
        {ev.kind === "citation" && ev.citationLabel && (
          <p className="truncate text-xs text-muted-foreground">
            {ev.citationLabel}
          </p>
        )}
        <p className="text-xs text-muted-foreground tabular-nums">
          Adicionado em {formatDate(ev.createdAt)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {openHref ? (
          <a
            href={openHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir ${ev.title}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <Icon aria-hidden="true" className="size-4" />
          </a>
        ) : ev.kind === "citation" ? (
          <span
            aria-hidden="true"
            className="grid size-7 place-items-center rounded-md text-muted-foreground"
          >
            <Quote className="size-4" />
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/70 italic">
            indisponível
          </span>
        )}
        {canEdit && (
          <RcaConfirmDelete
            action={() => deleteRcaEvidence(ev.id)}
            label={`Remover ${ev.title}`}
            title="Remover esta evidência?"
            description={
              ev.kind === "document"
                ? `A evidência “${ev.title}” deixará de aparecer. O arquivo enviado é mantido por imutabilidade.`
                : `A evidência “${ev.title}” deixará de aparecer.`
            }
          />
        )}
      </div>
    </li>
  );
}

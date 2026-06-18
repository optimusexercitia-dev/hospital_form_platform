"use client";

import { Download, ExternalLink } from "lucide-react";

import {
  CAPA_EVIDENCE_KIND_LABELS,
  type CapaActionEvidence,
} from "@/lib/safety/capa-types";
import { deleteCapaActionEvidence } from "@/lib/safety/capa-actions";
import { RcaConfirmDelete } from "../rca/rca-confirm-delete";
import { formatDate } from "../format";
import {
  CapaEvidenceLinkForm,
  CapaEvidenceUpload,
} from "./capa-evidence-forms";

/**
 * The implementation-evidence list for one CAPA action: uploaded FILES (signed
 * `openUrl`) + external LINKS, newest-first. Soft-delete retains the immutable
 * object (Rule 6). Mirrors the RCA evidence rows.
 */
export function CapaEvidenceList({
  capaId,
  actionId,
  evidence,
  canEdit,
}: {
  capaId: string;
  actionId: string;
  evidence: CapaActionEvidence[];
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
            <CapaEvidenceUpload capaId={capaId} actionId={actionId} />
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
          {evidence.map((ev) => {
            const href = ev.kind === "document" ? ev.openUrl : ev.externalUrl;
            const Icon = ev.kind === "document" ? Download : ExternalLink;
            return (
              <li
                key={ev.id}
                className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm text-foreground">
                      {ev.title}
                    </span>
                    <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[0.6rem] font-medium tracking-wide text-secondary-foreground uppercase">
                      {CAPA_EVIDENCE_KIND_LABELS[ev.kind]}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(ev.createdAt)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Abrir ${ev.title}`}
                      className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                    >
                      <Icon aria-hidden="true" className="size-4" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground/70 italic">
                      indisponível
                    </span>
                  )}
                  {canEdit && (
                    <RcaConfirmDelete
                      action={() => deleteCapaActionEvidence(ev.id)}
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
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LinkIcon, Quote, Upload } from "lucide-react";

import type { CitationTarget, RcaCitationTarget } from "@/lib/safety/rca-types";
import type {
  NspEvidenceErrorCode,
  NspEvidenceUploadRequest,
} from "@/lib/safety/evidence-contract";
import {
  addRcaEvidenceCitation,
  addRcaEvidenceLink,
  beginRcaEvidenceUpload,
  finalizeRcaEvidenceUpload,
} from "@/lib/safety/rca-actions";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import { EvidenceUploadDialog } from "@/components/safety/evidence/evidence-upload-dialog";
import {
  NSP_EVIDENCE_TITLE_GUIDANCE,
  nspEvidenceErrorMessage,
} from "@/components/safety/evidence/nsp-evidence-labels";

// The citation-picker source type is the backend's contract type; re-exported so the
// existing `import { …, type RcaCitationTarget } from "./rca-evidence-forms"` sites
// (panel, workspace, page) keep resolving unchanged.
export type { RcaCitationTarget } from "@/lib/safety/rca-types";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60";

const CITATION_KIND_LABELS: Record<CitationTarget, string> = {
  interview: "Entrevista",
  meeting: "Reunião",
  document: "Documento",
};

/* ------------------------------------------------------------------ Upload */

/**
 * Upload an evidence FILE for an RCA (DM5·S2).
 *
 * ⚠ The one-step flow this replaces had the CLIENT mint `{event}/{rca}/{uuid}`,
 * PUT it straight to the `nsp-evidence` bucket, and pass the invented path into
 * `add_rca_evidence(p_storage_path …)`. Bucket and path are now derived
 * server-side and the bytes ride the core document substrate (ADR 0114 D8/D9,
 * ADR 0120). The whole choreography lives in the shared dialog; this wrapper
 * exists to bind THIS home's two doors and its three sentences of pt-BR — the
 * explicit-variant shape, so there is no `isRca` boolean anywhere.
 */
export function EvidenceUpload({ rcaId }: { rcaId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Upload aria-hidden="true" />
        Enviar arquivo
      </Button>
      <EvidenceUploadDialog
        open={open}
        onOpenChange={setOpen}
        idPrefix="rca-evidence"
        dialogTitle="Enviar arquivo de evidência"
        fileGuidance="Anexe um documento de apoio à análise. Não anexe arquivos com dados de paciente: a análise de causa raiz é um registro de processo, não um módulo de dados de paciente."
        titleGuidance={NSP_EVIDENCE_TITLE_GUIDANCE}
        titlePlaceholder="Ex.: Protocolo da SRPA"
        begin={(request: NspEvidenceUploadRequest) =>
          beginRcaEvidenceUpload(rcaId, request)
        }
        finalize={finalizeRcaEvidenceUpload}
      />
    </>
  );
}

/* -------------------------------------------------------------------- Link */

/** Add an external https LINK as evidence (`kind:'link'`). No bytes, so the
 *  substrate move does not touch it beyond the typed result union. */
export function EvidenceLinkForm({ rcaId }: { rcaId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<NspEvidenceErrorCode | null>(null);
  const [isPending, startTransition] = useTransition();

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle("");
      setUrl("");
      setError(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await addRcaEvidenceLink(rcaId, {
          title: title.trim(),
          externalUrl: url.trim(),
        });
        if (!result.ok) {
          setError(result.code);
          return;
        }
        setOpen(false);
        router.refresh();
      } catch {
        setError("unknown");
      }
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <LinkIcon aria-hidden="true" />
        Adicionar link
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar link de evidência</DialogTitle>
            <DialogDescription>
              Vincule um recurso externo (https). Nunca inclua dados de paciente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {error && (
              <FormBanner tone="error">{nspEvidenceErrorMessage(error)}</FormBanner>
            )}
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Título</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className={FIELD_CLASS}
                placeholder="Ex.: Diretriz institucional"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">URL</span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                className={FIELD_CLASS}
                placeholder="https://…"
              />
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="lg" disabled={isPending}>
                {isPending ? "Salvando…" : "Adicionar link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------------------------------------------------------------- Citation */

/**
 * Cite an existing interview / meeting / DOCUMENT as evidence (`kind:'citation'`).
 *
 * ⚠ The `document` target is the seam S2 UN-PARKS, and it is the SECOND,
 * INDEPENDENT document seam on `rca_evidence` — `cited_document_id` (a citation,
 * mutually exclusive with an uploaded byte) is not the same thing as the
 * uploaded file above, and the two were re-pointed by separate work. Until S2 a
 * document citation was refused outright (`HC0DM` + the table CHECK
 * `rca_evidence_cited_document_parked`) and `listRcaCitationTargets` offered no
 * document rows, so this picker simply never showed one. Nothing here gates on
 * the kind: the picker renders whatever the server offers, so the un-parking
 * lands as data appearing, not as a UI branch flipping.
 *
 * The label is SNAPSHOT at insert time, so the citation survives the target
 * being renamed later.
 */
export function EvidenceCitationForm({
  rcaId,
  targets,
}: {
  rcaId: string;
  targets: RcaCitationTarget[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<NspEvidenceErrorCode | null>(null);
  const [isPending, startTransition] = useTransition();

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelectedId("");
      setError(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const target = targets.find((t) => t.id === selectedId);
    if (!target) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await addRcaEvidenceCitation(rcaId, {
          title: target.label,
          citationTarget: target.kind,
          citedEntityId: target.id,
          // Snapshot the label so the citation survives the target's later change.
          citationLabel: target.label,
        });
        if (!result.ok) {
          setError(result.code);
          return;
        }
        setOpen(false);
        router.refresh();
      } catch {
        setError("unknown");
      }
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Quote aria-hidden="true" />
        Citar registro
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Citar um registro existente</DialogTitle>
            <DialogDescription>
              Referencie uma entrevista, reunião ou documento já registrado no escopo
              do evento.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {error && (
              <FormBanner tone="error">{nspEvidenceErrorMessage(error)}</FormBanner>
            )}
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Registro</span>
              <NativeSelect
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                required
                className="h-10"
              >
                <option value="">Selecione…</option>
                {targets.map((t) => (
                  <option key={`${t.kind}-${t.id}`} value={t.id}>
                    [{CITATION_KIND_LABELS[t.kind]}] {t.label}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="lg" disabled={isPending || !selectedId}>
                {isPending ? "Salvando…" : "Citar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

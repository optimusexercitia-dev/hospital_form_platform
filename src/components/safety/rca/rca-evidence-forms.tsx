"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LinkIcon, Quote, Upload } from "lucide-react";

import type {
  CitationTarget,
  RcaCitationTarget,
  RcaEvidenceInput,
} from "@/lib/safety/rca-types";
import type { ActionState } from "@/lib/safety/types";
import {
  addRcaEvidence,
  uploadRcaEvidenceFile,
} from "@/lib/safety/rca-actions";
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

// The citation-picker source type is the backend's contract type; re-exported so the
// existing `import { …, type RcaCitationTarget } from "./rca-evidence-forms"` sites
// (panel, workspace, page) keep resolving unchanged.
export type { RcaCitationTarget } from "@/lib/safety/rca-types";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60";

const ACCEPT = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
].join(",");

const CITATION_KIND_LABELS: Record<CitationTarget, string> = {
  interview: "Entrevista",
  meeting: "Reunião",
  document: "Documento",
};

/* ------------------------------------------------------------------ Upload */

/**
 * Upload an evidence FILE to the immutable `nsp-evidence` bucket, then register the
 * row. Two-step (the contract's `uploadRcaEvidenceFile` mints the path; we pass it to
 * `addRcaEvidence` with `kind:'document'`). Mirrors the interview attachment upload.
 */
export function EvidenceUpload({ rcaId }: { rcaId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Upload aria-hidden="true" />
        Enviar arquivo
      </Button>
      <UploadDialog rcaId={rcaId} open={open} onOpenChange={setOpen} />
    </>
  );
}

function UploadDialog({
  rcaId,
  open,
  onOpenChange,
}: {
  rcaId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setFileName(null);
      setTitle("");
      setError(null);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      // Step 1: upload the bytes → minted storage path.
      const up = await uploadRcaEvidenceFile(rcaId, formData);
      if (!up.ok || !up.storagePath) {
        setError(up.error ?? "Não foi possível enviar o arquivo.");
        return;
      }
      // Step 2: register the evidence row referencing the path.
      const input: RcaEvidenceInput = {
        kind: "document",
        title: title.trim(),
        storagePath: up.storagePath,
        externalUrl: null,
        citationTarget: null,
        citedEntityId: null,
        citationLabel: null,
      };
      const result = await addRcaEvidence(rcaId, input);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível registrar a evidência.");
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar arquivo de evidência</DialogTitle>
          <DialogDescription>
            Anexe um documento de apoio à análise. Nunca inclua dados de paciente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && <FormBanner tone="error">{error}</FormBanner>}
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Arquivo</span>
            <input
              type="file"
              name="file"
              accept={ACCEPT}
              required
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-muted focus-visible:outline-none"
            />
            {fileName && (
              <span className="text-xs text-muted-foreground">{fileName}</span>
            )}
            <span className="text-xs text-muted-foreground">
              PDF, imagem, Word, Excel, CSV ou texto, até 25 MB.
            </span>
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Título</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={FIELD_CLASS}
              placeholder="Ex.: Protocolo da SRPA"
            />
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Enviando…" : "Enviar arquivo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------- Link */

/** Add an external https LINK as evidence (`kind:'link'`). */
export function EvidenceLinkForm({ rcaId }: { rcaId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [state, setState] = useState<ActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle("");
      setUrl("");
      setState(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: RcaEvidenceInput = {
      kind: "link",
      title: title.trim(),
      storagePath: null,
      externalUrl: url.trim(),
      citationTarget: null,
      citedEntityId: null,
      citationLabel: null,
    };
    startTransition(async () => {
      const result = await addRcaEvidence(rcaId, input);
      setState(result);
      if (result.ok) {
        setOpen(false);
        router.refresh();
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
            {state && !state.ok && (
              <FormBanner tone="error">{state.error}</FormBanner>
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
 * Cite an existing interview / meeting / document as evidence (`kind:'citation'`).
 * The picker source (`targets`) comes from backend's `listRcaCitationTargets`; until
 * it lands the picker is empty and this affordance is hidden by the panel.
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
  const [state, setState] = useState<ActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelectedId("");
      setState(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const target = targets.find((t) => t.id === selectedId);
    if (!target) return;
    const input: RcaEvidenceInput = {
      kind: "citation",
      title: target.label,
      storagePath: null,
      externalUrl: null,
      citationTarget: target.kind,
      citedEntityId: target.id,
      // Snapshot the label so the citation survives the target's later change.
      citationLabel: target.label,
    };
    startTransition(async () => {
      const result = await addRcaEvidence(rcaId, input);
      setState(result);
      if (result.ok) {
        setOpen(false);
        router.refresh();
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
            {state && !state.ok && (
              <FormBanner tone="error">{state.error}</FormBanner>
            )}
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Registro</span>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                required
                className={FIELD_CLASS}
              >
                <option value="">Selecione…</option>
                {targets.map((t) => (
                  <option key={`${t.kind}-${t.id}`} value={t.id}>
                    [{CITATION_KIND_LABELS[t.kind]}] {t.label}
                  </option>
                ))}
              </select>
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

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LinkIcon, Upload } from "lucide-react";

import type { CapaEvidenceInput } from "@/lib/safety/capa-types";
import type { ActionState } from "@/lib/safety/types";
import {
  addCapaActionEvidence,
  uploadCapaEvidenceFile,
} from "@/lib/safety/capa-actions";
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

/**
 * Upload an implementation-evidence FILE for a CAPA action to the immutable
 * `nsp-evidence` bucket, then register the row. Two-step (the contract's
 * `uploadCapaEvidenceFile` mints the path; we pass it to `addCapaActionEvidence`
 * with `kind:'document'`). Mirrors the RCA evidence upload.
 */
export function CapaEvidenceUpload({
  capaId,
  actionId,
}: {
  capaId: string;
  actionId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Upload aria-hidden="true" />
        Enviar arquivo
      </Button>
      <UploadDialog
        capaId={capaId}
        actionId={actionId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

function UploadDialog({
  capaId,
  actionId,
  open,
  onOpenChange,
}: {
  capaId: string;
  actionId: string;
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
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const up = await uploadCapaEvidenceFile(capaId, actionId, formData);
      if (!up.ok || !up.storagePath) {
        setError(up.error ?? "Não foi possível enviar o arquivo.");
        return;
      }
      const input: CapaEvidenceInput = {
        kind: "document",
        title: title.trim(),
        storagePath: up.storagePath,
        externalUrl: null,
      };
      const result = await addCapaActionEvidence(actionId, input);
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
          <DialogTitle>Enviar evidência de implementação</DialogTitle>
          <DialogDescription>
            Anexe a evidência de que a ação foi executada. Nunca inclua dados de
            paciente.
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
              placeholder="Ex.: Protocolo publicado"
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

/** Add an external https LINK as implementation evidence (`kind:'link'`). */
export function CapaEvidenceLinkForm({ actionId }: { actionId: string }) {
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
    const input: CapaEvidenceInput = {
      kind: "link",
      title: title.trim(),
      storagePath: null,
      externalUrl: url.trim(),
    };
    startTransition(async () => {
      const result = await addCapaActionEvidence(actionId, input);
      setState(result);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <LinkIcon aria-hidden="true" />
        Adicionar link
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar link de evidência</DialogTitle>
            <DialogDescription>
              Vincule um recurso externo (https) que comprove a implementação.
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
                placeholder="Ex.: Registro de treinamento"
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

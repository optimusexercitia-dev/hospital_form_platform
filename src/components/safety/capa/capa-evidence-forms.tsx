"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LinkIcon, Upload } from "lucide-react";

import type {
  NspEvidenceErrorCode,
  NspEvidenceUploadRequest,
} from "@/lib/safety/evidence-contract";
import {
  addCapaEvidenceLink,
  beginCapaEvidenceUpload,
  finalizeCapaEvidenceUpload,
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
import { PhiInputHint } from "@/components/ui/phi-input-hint";
import { EvidenceUploadDialog } from "@/components/safety/evidence/evidence-upload-dialog";
import {
  NSP_EVIDENCE_TITLE_GUIDANCE,
  nspEvidenceErrorMessage,
} from "@/components/safety/evidence/nsp-evidence-labels";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Upload an implementation-evidence FILE for a CAPA action (DM5·S2).
 *
 * ⚠ The path this replaces (`uploadCapaEvidenceFile`) was BROKEN FOR EVERY USER
 * — `BUG-DM5-CAPA-1`, ADR 0120 D15. It wrote `{capa_id}/{action_id}/…` while the
 * Storage policy `capa_evidence_obj_insert_writable` resolved `foldername[1]`
 * through `app.hospital_of_event`, an EVENT resolver, so the arm was false for
 * every CAPA and every persona. It failed CLOSED — refused, never leaked — which
 * is why it went unnoticed: the suite has never had an upload-kind E2E here.
 *
 * Backend fixes the policy in its own migration, deliberately separate from the
 * substrate migrations so its red is provable against today's catalog. Nothing
 * in this component works around it, and nothing here should: a UI that
 * compensated for a broken write policy would hide the fix's own evidence.
 *
 * ⚠ CAPA has NO citation seam — `capa_action_evidence.kind` is `document | link`
 * only. There is deliberately no "Citar registro" affordance here.
 */
export function CapaEvidenceUpload({ actionId }: { actionId: string }) {
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
      <EvidenceUploadDialog
        open={open}
        onOpenChange={setOpen}
        idPrefix={`capa-evidence-${actionId}`}
        dialogTitle="Enviar evidência de implementação"
        fileGuidance="Anexe a evidência de que a ação foi executada. Não anexe arquivos com dados de paciente: o plano de ação é um registro de processo, não um módulo de dados de paciente."
        titleGuidance={NSP_EVIDENCE_TITLE_GUIDANCE}
        titlePlaceholder="Ex.: Protocolo publicado"
        begin={(request: NspEvidenceUploadRequest) =>
          beginCapaEvidenceUpload(actionId, request)
        }
        finalize={finalizeCapaEvidenceUpload}
      />
    </>
  );
}

/** Add an external https LINK as implementation evidence (`kind:'link'`). */
export function CapaEvidenceLinkForm({ actionId }: { actionId: string }) {
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
        const result = await addCapaEvidenceLink(actionId, {
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
            {error && (
              <FormBanner tone="error">{nspEvidenceErrorMessage(error)}</FormBanner>
            )}
            <PhiInputHint>
              {(hintId) => (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">Título</span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className={FIELD_CLASS}
                    placeholder="Ex.: Registro de treinamento"
                    aria-describedby={hintId}
                  />
                </label>
              )}
            </PhiInputHint>
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

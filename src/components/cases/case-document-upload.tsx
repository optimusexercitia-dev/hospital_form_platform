"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Upload } from "lucide-react";

import {
  uploadCaseDocument,
  type UploadCaseDocumentState,
} from "@/lib/cases/documents-actions";
import type { CaseDocumentType } from "@/lib/queries/case-documents";
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
import { DOC_TYPE_LABEL } from "./case-extras-labels";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Accepted document MIME types — mirrors the `case-documents` bucket allow-list
 * (PDF, common images, Word/Excel, CSV/plain). The server re-validates; this is
 * the picker hint only.
 */
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

const DOC_TYPES: CaseDocumentType[] = [
  "ata",
  "digitalizacao",
  "registro",
  "other",
];

/**
 * Upload a file-backed document to a case (R1). Owns the dialog `open` state and
 * renders the trigger + the dialog (the parent-owns-open pattern used across the
 * builder, so the dialog's success effect calls the `onOpenChange` PROP +
 * `router.refresh()` — no local setState in an effect). Clones the form-asset
 * upload UX (`image-item-editor`) plus the document metadata.
 */
export function CaseDocumentUpload({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Upload aria-hidden="true" />
        Anexar
      </Button>
      <UploadDialog caseId={caseId} open={open} onOpenChange={setOpen} />
    </>
  );
}

function UploadDialog({
  caseId,
  open,
  onOpenChange,
}: {
  caseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, isPending] = useActionState<
    UploadCaseDocumentState | undefined,
    FormData
  >(uploadCaseDocument, undefined);
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);

  // Clear the chosen-file label each time the dialog opens (render-phase
  // prop-sync, not an effect).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setFileName(null);
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar documento</DialogTitle>
          <DialogDescription>
            Anexe uma ata, digitalização ou registro a este caso. Nunca inclua
            dados de paciente.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="caseId" value={caseId} />

          {state && !state.ok && !state.fieldErrors?.file && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Arquivo</span>
            <input
              type="file"
              name="file"
              accept={ACCEPT}
              required
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              aria-invalid={state?.fieldErrors?.file ? true : undefined}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-muted focus-visible:outline-none"
            />
            {fileName && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Paperclip aria-hidden="true" className="size-3" />
                {fileName}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              PDF, imagem, Word, Excel, CSV ou texto, até 25 MB.
            </span>
            {state?.fieldErrors?.file && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.file}
              </span>
            )}
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Tipo</span>
            <select name="docType" className={FIELD_CLASS} defaultValue="ata">
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DOC_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Título</span>
            <input
              name="title"
              type="text"
              required
              className={FIELD_CLASS}
              placeholder="Ex.: Ata da reunião de revisão"
              aria-invalid={state?.fieldErrors?.title ? true : undefined}
            />
            {state?.fieldErrors?.title && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.title}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Descrição{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <input
              name="description"
              type="text"
              className={FIELD_CLASS}
              placeholder="Breve descrição do documento"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Data do documento{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <input name="occurredAt" type="date" className={FIELD_CLASS} />
            <span className="text-xs text-muted-foreground">
              Data real do documento, se diferente da data de envio.
            </span>
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
              {isPending ? "Enviando…" : "Enviar documento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Upload } from "lucide-react";

import {
  uploadInterviewAttachment,
  type AddAttachmentState,
} from "@/lib/interviews/actions";
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
import {
  ATTACHMENT_KIND_LABEL,
  ATTACHMENT_KIND_ORDER,
  FILE_ATTACHMENT_DEFAULT_KIND,
} from "./interview-labels";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Accepted attachment MIME types — mirrors the `interview-attachments` bucket
 * allow-list (PDF, common images, Word/Excel, CSV/plain). Audio BYTES are NOT
 * accepted (an audio recording is added as an external link instead). The server
 * re-validates; this is the picker hint only.
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

/**
 * Upload a FILE-backed attachment to an interview (F3). Mirrors the meeting /
 * case-document upload flow: a `useActionState` form posting
 * `interviewId`/`file`/`kind`/`title`. The object is written to a fresh immutable
 * path server-side (Rule 6). The parent owns the dialog open state.
 */
export function AttachmentUpload({ interviewId }: { interviewId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Upload aria-hidden="true" />
        Enviar anexo
      </Button>
      <UploadDialog
        interviewId={interviewId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

function UploadDialog({
  interviewId,
  open,
  onOpenChange,
}: {
  interviewId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, isPending] = useActionState<
    AddAttachmentState | undefined,
    FormData
  >(uploadInterviewAttachment, undefined);
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);

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
          <DialogTitle>Enviar anexo</DialogTitle>
          <DialogDescription>
            Anexe a transcrição assinada, uma evidência ou outro documento. Nunca
            inclua dados de paciente.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="interviewId" value={interviewId} />

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
              PDF, imagem, Word, Excel, CSV ou texto, até 25 MB. Para gravações de
              áudio, use “Adicionar gravação”.
            </span>
            {state?.fieldErrors?.file && (
              <span
                role="alert"
                className="text-sm font-medium text-destructive"
              >
                {state.fieldErrors.file}
              </span>
            )}
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Tipo</span>
            <select
              name="kind"
              className={FIELD_CLASS}
              defaultValue={FILE_ATTACHMENT_DEFAULT_KIND}
            >
              {ATTACHMENT_KIND_ORDER.map((k) => (
                <option key={k} value={k}>
                  {ATTACHMENT_KIND_LABEL[k]}
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
              placeholder="Ex.: Transcrição assinada"
              aria-invalid={state?.fieldErrors?.title ? true : undefined}
            />
            {state?.fieldErrors?.title && (
              <span
                role="alert"
                className="text-sm font-medium text-destructive"
              >
                {state.fieldErrors.title}
              </span>
            )}
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
              {isPending ? "Enviando…" : "Enviar anexo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

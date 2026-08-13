"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Upload } from "lucide-react";

import type {
  DocumentActionErrorCode,
  DocumentConfidentialityLevel,
  DocumentHomeResourceType,
  DocumentUploadCredential,
} from "@/lib/documents/types";
import {
  DOCUMENT_ACCEPTED_MIME_TYPES,
  DOCUMENT_MAX_SIZE_BYTES,
} from "@/lib/documents/types";
import { beginDocumentUpload, finalizeDocumentUpload } from "@/lib/documents/actions";
import { uploadDocumentFile } from "@/lib/documents/upload-client";
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
import { NativeSelect } from "@/components/ui/native-select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  CONFIDENTIALITY_HELPER_TEXT,
  CONFIDENTIALITY_LABEL,
  D12_TITLE_GUIDANCE,
  DOCUMENT_FILE_HINT,
  DOCUMENT_HOME_CONFIG,
  confidentialityOptionsForHome,
  documentErrorMessage,
  kindOptionsForHome,
} from "./document-labels";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** Where the three-step flow currently is — drives the live progress region. */
type UploadPhase = "idle" | "preparing" | "uploading" | "finalizing";

const PHASE_MESSAGE: Record<Exclude<UploadPhase, "idle">, string> = {
  preparing: "Preparando o envio…",
  uploading: "Enviando arquivo…",
  finalizing: "Verificando arquivo…",
};

/** Upload trigger + dialog. */
export function DocumentUpload({
  homeType,
  homeId,
}: {
  homeType: DocumentHomeResourceType;
  homeId: string;
}) {
  const [open, setOpen] = useState(false);
  const config = DOCUMENT_HOME_CONFIG[homeType];
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Upload aria-hidden="true" />
        {config.uploadLabel}
      </Button>
      <UploadDialog
        homeType={homeType}
        homeId={homeId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

/**
 * The Wave-A upload dialog (DM2·S3).
 *
 * ## D12 — the metadata contract, said plainly
 *
 * Two sentences carry it. The dialog description states whether the FILE may
 * contain patient data, which differs by home: the case and interview modules
 * are Class-1 under Rule 12 and their files MAY; meetings are not a patient-data
 * module and theirs must not. The Título guidance states that the TITLE never
 * may, in every home, and gives the reason — titles stay member-readable,
 * including to people who cannot open the file.
 *
 * This corrects copy that was not merely awkward but FALSE: the case dialog
 * previously read "Nunca inclua dados de paciente" while sitting on a Class-1
 * PHI module whose documents default to the PHI tier. Guidance that is false
 * teaches clinicians to skip guidance.
 *
 * ## The three-step transport (ADR 0114 D8/D9)
 *
 *   begin → PUT the bytes to the signed credential → finalize
 *
 * The client never learns a bucket, a path or a token: the credential's URL
 * carries its own authority and expires. Size and MIME are checked here only to
 * refuse before a pointless wait — `finalize` re-derives both server-side, and
 * the caller's values are hints (D9).
 *
 * **Retry is real, not cosmetic.** A failed or partial PUT leaves NO object, so
 * `finalize` answers `upload_incomplete` and the RESERVATION stays valid. The
 * dialog therefore keeps the session and offers "Tentar novamente", which
 * re-PUTs into the same reservation rather than starting over — until the
 * reservation expires (`upload_expired`), which is the one failure that sends
 * the user back to the beginning.
 */
function UploadDialog({
  homeType,
  homeId,
  open,
  onOpenChange,
}: {
  homeType: DocumentHomeResourceType;
  homeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const config = DOCUMENT_HOME_CONFIG[homeType];
  const levels = confidentialityOptionsForHome(homeType);
  const kinds = kindOptionsForHome(homeType);

  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ file?: string; title?: string }>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  /** A live reservation kept across a failed PUT so the retry reuses it. */
  const [session, setSession] = useState<{
    id: string;
    credential: DocumentUploadCredential;
  } | null>(null);

  const isBusy = phase !== "idle";

  // Reset on each open (render-phase prop-sync, not an effect).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setFile(null);
      setErrors({});
      setBanner(null);
      setPhase("idle");
      setSession(null);
    }
  }

  function fail(code: DocumentActionErrorCode) {
    setBanner(documentErrorMessage(code));
    setPhase("idle");
    // `upload_expired` is the one code that invalidates the reservation: drop it
    // so the next attempt begins a fresh one instead of re-PUTting to a dead URL.
    if (code === "upload_expired") setSession(null);
  }

  /** Steps 2–3. Split out so a retry re-enters here with the SAME reservation. */
  async function putAndFinalize(
    sessionId: string,
    credential: DocumentUploadCredential,
    bytes: File,
  ) {
    setPhase("uploading");
    const put = await uploadDocumentFile(credential, bytes);
    if (!put.ok) {
      // No object was left behind; the reservation is still good.
      fail("upload_incomplete");
      return;
    }

    setPhase("finalizing");
    try {
      const finalized = await finalizeDocumentUpload(sessionId);
      if (!finalized.ok) {
        fail(finalized.error);
        return;
      }
      setPhase("idle");
      onOpenChange(false);
      router.refresh();
    } catch {
      fail("unknown");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;

    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();

    const next: { file?: string; title?: string } = {};
    if (!file) {
      next.file = "Escolha um arquivo para enviar.";
    } else if (file.size > DOCUMENT_MAX_SIZE_BYTES) {
      next.file = "O arquivo excede o tamanho máximo de 25 MB.";
    } else if (file.type && !DOCUMENT_ACCEPTED_MIME_TYPES.includes(file.type)) {
      next.file = "Este tipo de arquivo não é aceito.";
    }
    if (title.length === 0) {
      next.title = "Informe um título para o documento.";
    }
    setErrors(next);
    setBanner(null);
    if (Object.keys(next).length > 0 || !file) return;

    // A live reservation from a previous failed PUT: retry into it.
    if (session) {
      await putAndFinalize(session.id, session.credential, file);
      return;
    }

    setPhase("preparing");
    const description = String(form.get("description") ?? "").trim();
    const occurredOn = String(form.get("occurredOn") ?? "").trim();
    const level = String(form.get("confidentialityLevel") ?? "").trim();

    try {
      const begun = await beginDocumentUpload({
        homeResourceType: homeType,
        homeResourceId: homeId,
        title,
        ...(description ? { description } : {}),
        kind: String(form.get("kind") ?? kinds[0]?.value ?? ""),
        ...(occurredOn ? { occurredOn } : {}),
        ...(level
          ? { confidentialityLevel: level as DocumentConfidentialityLevel }
          : {}),
        declaredFileName: file.name,
        declaredMimeType: file.type || "application/octet-stream",
        declaredSizeBytes: file.size,
      });
      if (!begun.ok) {
        fail(begun.error);
        return;
      }
      setSession({ id: begun.uploadSessionId, credential: begun.upload });
      await putAndFinalize(begun.uploadSessionId, begun.upload, file);
    } catch {
      // A thrown action must never escape into the error boundary and blank the
      // page behind the dialog, and must never surface a raw server message.
      fail("unknown");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{config.dialogTitle}</DialogTitle>
          {/* D12 — the FILE sentence, per home. */}
          <DialogDescription>{config.fileGuidance}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {banner && <FormBanner tone="error">{banner}</FormBanner>}

          {/* Progress is announced, not just animated: a keyboard/screen-reader
              user submitting a slow upload must hear that something is happening. */}
          <p role="status" aria-live="polite" className="sr-only">
            {isBusy ? PHASE_MESSAGE[phase] : ""}
          </p>

          <div className="flex flex-col gap-1.5 text-sm">
            <label htmlFor="document-file" className="font-medium">
              Arquivo
            </label>
            <input
              id="document-file"
              type="file"
              name="file"
              accept={DOCUMENT_ACCEPTED_MIME_TYPES.join(",")}
              disabled={isBusy}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                // A different file needs a different reservation.
                setSession(null);
              }}
              aria-invalid={errors.file ? true : undefined}
              aria-describedby="document-file-hint"
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-muted focus-visible:outline-none"
            />
            {file && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Paperclip aria-hidden="true" className="size-3" />
                {file.name}
              </span>
            )}
            <span id="document-file-hint" className="text-xs text-muted-foreground">
              {DOCUMENT_FILE_HINT}
            </span>
            {errors.file && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {errors.file}
              </span>
            )}
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Tipo</span>
            <NativeSelect
              name="kind"
              className="h-10"
              disabled={isBusy}
              defaultValue={kinds[0]?.value}
            >
              {kinds.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </NativeSelect>
          </label>

          <div className="flex flex-col gap-1.5 text-sm">
            <label htmlFor="document-title" className="font-medium">
              Título
            </label>
            <input
              id="document-title"
              name="title"
              type="text"
              disabled={isBusy}
              className={FIELD_CLASS}
              placeholder={config.titlePlaceholder}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby="document-title-guidance"
            />
            {/* D12 — the TITLE rule. The load-bearing sentence of this dialog:
                it gives the REASON, which is what makes it followable. */}
            <span id="document-title-guidance" className="text-xs text-muted-foreground">
              {D12_TITLE_GUIDANCE}
            </span>
            {errors.title && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {errors.title}
              </span>
            )}
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Descrição{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </span>
            <input
              name="description"
              type="text"
              disabled={isBusy}
              className={FIELD_CLASS}
              placeholder="Breve descrição do documento"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Data do documento{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </span>
            <DatePicker name="occurredOn" />
            <span className="text-xs text-muted-foreground">
              Data real do documento, se diferente da data de envio.
            </span>
          </label>

          <div className="flex flex-col gap-1.5 text-sm">
            <label htmlFor="document-confidentiality" className="font-medium">
              Classificação
            </label>
            {/* Enforcing levels appear ONLY on homes where the database accepts
                them. On a meeting or action_item home they are absent from this
                list rather than disabled: an option the DB answers with HC0D6
                should never be offerable. Both the enforcing SET and the set of
                homes that can carry one are read from the contract — no literal
                here, and no index into the display order. */}
            <NativeSelect
              id="document-confidentiality"
              name="confidentialityLevel"
              className="h-10"
              disabled={isBusy}
              defaultValue=""
              aria-describedby="document-confidentiality-help"
            >
              <option value="">Não classificado</option>
              {levels.map((level: DocumentConfidentialityLevel) => (
                <option key={level} value={level}>
                  {CONFIDENTIALITY_LABEL[level]}
                </option>
              ))}
            </NativeSelect>
            <span
              id="document-confidentiality-help"
              className="text-xs text-muted-foreground"
            >
              {CONFIDENTIALITY_HELPER_TEXT}
            </span>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isBusy}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isBusy}>
              {isBusy
                ? PHASE_MESSAGE[phase]
                : session
                  ? "Tentar novamente"
                  : "Enviar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

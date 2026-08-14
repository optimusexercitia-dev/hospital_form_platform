"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";

import type { DocumentUploadCredential } from "@/lib/documents/types";
import {
  DOCUMENT_ACCEPTED_MIME_TYPES,
  DOCUMENT_MAX_SIZE_BYTES,
} from "@/lib/documents/types";
import { uploadDocumentFile } from "@/lib/documents/upload-client";
import {
  beginControlledVersionUpload,
  finalizeControlledVersionUpload,
} from "@/lib/controlled-documents/actions";
import {
  DOCUMENT_UPLOAD_TERMINAL_MESSAGE,
  documentErrorMessage,
} from "@/components/documents/document-labels";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";

/** Accepted document formats — the bucket + `finalize` enforce the same set. */
const ACCEPT = DOCUMENT_ACCEPTED_MIME_TYPES.join(",");

/** Where the three-step flow currently is — drives the live progress region. */
type UploadPhase = "idle" | "preparing" | "uploading" | "finalizing";

const PHASE_MESSAGE: Record<Exclude<UploadPhase, "idle">, string> = {
  preparing: "Preparando o envio…",
  uploading: "Enviando arquivo…",
  finalizing: "Verificando arquivo…",
};

/**
 * Attach (or replace) the file of a controlled document's working draft
 * (DM3·S2, replacing the Phase-17 F2/F3 form).
 *
 * ## The shape of the flow changed, not just the call
 *
 * This used to be one native `<form>` that POSTed the FILE ITSELF to a server
 * action, which uploaded it server-side and then pointed the version at the raw
 * `storage_path`. Both halves of that are gone: `set_document_version_file` was
 * dropped in DM3 M4 and the column with it. Bytes now move the DM2 way —
 *
 *   beginControlledVersionUpload → the CLIENT PUTs to a signed credential
 *                                → finalizeControlledVersionUpload
 *
 * — so the file never travels through a server action at all, and the version
 * binds to a core `document_versions` row rather than to a path. The dialog in
 * `@/components/documents/document-upload-dialog` is the Wave-A original; this
 * follows it deliberately rather than growing a second dialect of the same flow.
 *
 * The version must ALREADY EXIST: `begin` needs `{commissionId, documentId,
 * versionId}`, which is why this form attaches to a draft and never creates one.
 *
 * ## Retry, and the one case where it must not be offered
 *
 * A failed or partial PUT leaves NO object behind, so the RESERVATION is still
 * good and re-PUTting into it is the correct recovery — the button becomes
 * "Tentar novamente" and reuses the same credential.
 *
 * ONE failure ends the reservation instead, and it must not show a retry: a
 * `terminal` finalize result. The bytes LANDED and failed verification, so the
 * file object is `failed` — a state with no outbound arc, over bytes that are
 * immutable (Rule 6). Every "retry" click would re-enter the same dead end
 * forever, which is precisely what Wave A shipped once (QA r1 MAJOR-3). The
 * form goes TERMINAL: the reservation is dropped, the inputs lock, and the copy
 * names the only recovery there is — start a fresh upload.
 *
 * The failure is discriminated on the RESULT's `terminal` marker, never on the
 * message text: the same wording can describe both outcomes.
 */
export function AddVersionForm({
  commissionId,
  documentId,
  versionId,
  title,
  description,
  submitLabel,
}: {
  /** The document's commission — resolves the upload's tenant scope. */
  commissionId: string;
  documentId: string;
  /** The target `draft`/`changes_requested` version the file attaches to. */
  versionId: string;
  title: string;
  description: string;
  submitLabel: string;
}) {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [banner, setBanner] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  /**
   * A live reservation kept across a failed PUT so the retry reuses it.
   *
   * It carries the core version id as well as the session id because `finalize`
   * needs BOTH, and `begin` is the only place either is minted — holding just
   * the session id would make the retry path uncompletable.
   */
  const [session, setSession] = useState<{
    id: string;
    coreDocumentVersionId: string;
    credential: DocumentUploadCredential;
  } | null>(null);
  /**
   * This upload can never be completed from this reservation (MAJOR-3). Held
   * apart from `banner` because it governs AFFORDANCES, not just copy — a
   * message telling the user to start over while a submit button still invites
   * another attempt is the defect, not the fix.
   */
  const [terminal, setTerminal] = useState(false);

  const isBusy = phase !== "idle";
  /** No further input is meaningful once the reservation is spent. */
  const isLocked = isBusy || terminal;

  /** Steps 2–3. Split out so a retry re-enters here with the SAME reservation. */
  async function putAndFinalize(
    reservation: {
      id: string;
      coreDocumentVersionId: string;
      credential: DocumentUploadCredential;
    },
    bytes: File,
  ) {
    setPhase("uploading");
    const put = await uploadDocumentFile(reservation.credential, bytes);
    if (!put.ok) {
      // No object was left behind; the reservation is still good.
      setBanner(documentErrorMessage("upload_incomplete"));
      setPhase("idle");
      return;
    }

    setPhase("finalizing");
    try {
      const finalized = await finalizeControlledVersionUpload({
        versionId,
        uploadSessionId: reservation.id,
        coreDocumentVersionId: reservation.coreDocumentVersionId,
        summaryOfChangesMd: summary.trim() || null,
        expiryDate: expiryDate || null,
      });
      if (!finalized.ok) {
        const isTerminal = finalized.terminal === true;
        // The action already resolved this to pt-BR (it never returns raw
        // Postgres text); the generic fallback covers an `ok:false` with no
        // message rather than rendering an empty alert.
        setBanner(
          isTerminal
            ? DOCUMENT_UPLOAD_TERMINAL_MESSAGE
            : (finalized.error ?? documentErrorMessage("unknown")),
        );
        setFileError(finalized.fieldErrors?.file ?? null);
        setPhase("idle");
        if (isTerminal) {
          // The reservation is spent — drop it so nothing re-finalizes it, and
          // lock the form so no control offers an attempt that cannot work.
          setSession(null);
          setTerminal(true);
        }
        // Non-terminal: the reservation survives and the button becomes
        // "Tentar novamente", which re-PUTs into the SAME credential.
        return;
      }
      setPhase("idle");
      setSession(null);
      setFile(null);
      router.refresh();
    } catch {
      setBanner(documentErrorMessage("unknown"));
      setSession(null);
      setPhase("idle");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // `terminal` guards the ACTION as well as the button: a form still reachable
    // by Enter must not re-enter a flow whose reservation is spent.
    if (isLocked) return;

    setBanner(null);
    setFileError(null);

    if (!file) {
      setFileError("Selecione o arquivo do documento.");
      return;
    }
    if (file.size > DOCUMENT_MAX_SIZE_BYTES) {
      setFileError(documentErrorMessage("file_too_large"));
      return;
    }
    if (file.type && !DOCUMENT_ACCEPTED_MIME_TYPES.includes(file.type)) {
      setFileError(documentErrorMessage("file_type_not_allowed"));
      return;
    }

    // A live reservation from a previous failed PUT: retry into it.
    if (session) {
      await putAndFinalize(session, file);
      return;
    }

    setPhase("preparing");
    try {
      const begun = await beginControlledVersionUpload({
        commissionId,
        documentId,
        versionId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      if (!begun.ok) {
        // Machine-readable code → pt-BR here (never branch on message text).
        setBanner(documentErrorMessage(begun.code));
        setPhase("idle");
        return;
      }
      const reservation = {
        id: begun.uploadSessionId,
        coreDocumentVersionId: begun.coreDocumentVersionId,
        credential: begun.credential,
      };
      setSession(reservation);
      await putAndFinalize(reservation, file);
    } catch {
      // A thrown action must never escape into the error boundary and blank the
      // page around this card, and must never surface a raw server message.
      setBanner(documentErrorMessage("unknown"));
      setPhase("idle");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground text-pretty">{description}</p>
      </div>

      {banner ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {banner}
        </p>
      ) : null}

      {/* Progress is announced, not just animated: a keyboard or screen-reader
          user submitting a slow upload must hear that something is happening. */}
      <p role="status" aria-live="polite" className="sr-only">
        {isBusy ? PHASE_MESSAGE[phase] : ""}
      </p>

      <Field>
        <FieldLabel htmlFor="documentFile">Arquivo</FieldLabel>
        <input
          id="documentFile"
          name="file"
          type="file"
          accept={ACCEPT}
          disabled={isLocked}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setFileError(null);
            // A different file needs a different reservation.
            setSession(null);
          }}
          aria-invalid={fileError ? true : undefined}
          aria-describedby="documentFile-description"
          className="block w-full rounded-lg border border-input bg-card text-sm text-foreground shadow-xs outline-none file:mr-3 file:border-0 file:bg-muted file:px-3.5 file:py-2.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
        <FieldDescription id="documentFile-description">
          PDF, Word, planilha, imagem ou texto, até 25 MB. Cada envio gera um
          arquivo novo — o anterior é preservado.
        </FieldDescription>
        {file ? (
          <p className="text-sm text-muted-foreground">
            Selecionado: <span className="font-medium">{file.name}</span>
          </p>
        ) : null}
        <FieldError>{fileError ?? undefined}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="summaryOfChangesMd">
          Resumo das alterações (Markdown, opcional)
        </FieldLabel>
        <Textarea
          id="summaryOfChangesMd"
          name="summaryOfChangesMd"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
          disabled={isLocked}
          placeholder="Descreva o que mudou nesta versão."
          aria-describedby="summaryOfChangesMd-description"
        />
        <FieldDescription id="summaryOfChangesMd-description">
          Aceita formatação Markdown. Use a pré-visualização para conferir.
        </FieldDescription>
        {summary.trim() ? (
          <div className="mt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              aria-expanded={showPreview}
            >
              {showPreview ? "Ocultar pré-visualização" : "Pré-visualizar"}
            </Button>
            {showPreview ? (
              <div className="animate-fade-in mt-2 rounded-lg border border-border bg-muted/20 p-3">
                <MarkdownRenderer content={summary} />
              </div>
            ) : null}
          </div>
        ) : null}
      </Field>

      <Field>
        <FieldLabel htmlFor="expiryDate">Data de expiração (opcional)</FieldLabel>
        <DatePicker
          id="expiryDate"
          value={expiryDate}
          onChange={setExpiryDate}
          clearable
          disabled={isLocked}
          className="w-auto"
          aria-describedby="expiryDate-description"
        />
        <FieldDescription id="expiryDate-description">
          Data após a qual o documento deixa de valer, se aplicável.
        </FieldDescription>
      </Field>

      <div>
        {terminal ? (
          /* MAJOR-3: no submit at all. A disabled "Tentar novamente" would still
             name an action that does not exist. The recovery is a NEW upload,
             so the only control left is the one that gets you there. */
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => {
              setTerminal(false);
              setBanner(null);
              setFileError(null);
              setFile(null);
            }}
          >
            <FileUp aria-hidden="true" className="size-4" />
            Escolher outro arquivo
          </Button>
        ) : (
          <Button type="submit" size="lg" disabled={isBusy}>
            <FileUp aria-hidden="true" className="size-4" />
            {isBusy
              ? PHASE_MESSAGE[phase]
              : session
                ? "Tentar novamente"
                : submitLabel}
          </Button>
        )}
      </div>
    </form>
  );
}

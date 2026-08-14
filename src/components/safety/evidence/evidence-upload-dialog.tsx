"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";

import {
  DOCUMENT_ACCEPTED_MIME_TYPES,
  DOCUMENT_MAX_SIZE_BYTES,
} from "@/lib/documents/types";
import type {
  NspEvidenceActionState,
  NspEvidenceErrorCode,
  NspEvidenceUploadRequest,
  NspEvidenceUploadTicket,
} from "@/lib/safety/evidence-contract";
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
import { DOCUMENT_FILE_HINT } from "@/components/documents/document-labels";
import {
  NSP_EVIDENCE_UPLOAD_TERMINAL_MESSAGE,
  nspEvidenceErrorMessage,
} from "./nsp-evidence-labels";

/** Reserve an upload. Matches `beginRcaEvidenceUpload` / `beginCapaEvidenceUpload`. */
export type BeginEvidenceUpload = (
  request: NspEvidenceUploadRequest,
) => Promise<NspEvidenceActionState & { ticket?: NspEvidenceUploadTicket }>;

/** Verify server-side + create the row. Matches `finalize{Rca,Capa}EvidenceUpload`. */
export type FinalizeEvidenceUpload = (
  uploadSessionId: string,
) => Promise<NspEvidenceActionState & { evidenceId?: string }>;

/** Where the three-step flow currently is — drives the live progress region. */
type UploadPhase = "idle" | "preparing" | "uploading" | "finalizing";

const PHASE_MESSAGE: Record<Exclude<UploadPhase, "idle">, string> = {
  preparing: "Preparando o envio…",
  uploading: "Enviando arquivo…",
  finalizing: "Verificando arquivo…",
};

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The shared NSP evidence upload dialog (DM5·S2) — one component, both homes.
 *
 * ## The three-step transport (ADR 0114 D8/D9)
 *
 *   begin → PUT the bytes to the signed credential → finalize
 *
 * This replaces a one-step flow in which the CLIENT minted `{event}/{rca}/{uuid}`,
 * PUT straight to the `nsp-evidence` bucket, and handed the path it invented to
 * `add_rca_evidence(p_storage_path …)` — which stored it with no bucket check,
 * no existence check and no size / MIME / hash. Bucket and path are now derived
 * server-side; every value declared below is a HINT that finalize re-derives and
 * re-verifies (D9). The size and MIME checks here exist only to refuse before a
 * pointless wait, never as the authority.
 *
 * ## Why it is parameterized rather than forked per home
 *
 * RCA and CAPA differ in exactly two things: which pair of server actions runs,
 * and three sentences of pt-BR. Both are injected. There is no `isRca` boolean
 * and no home enum — the explicit variant wrappers (`RcaEvidenceUpload`,
 * `CapaEvidenceUpload`) bind their own doors and copy.
 *
 * ⚠ It IS a fork of `@/components/documents/document-upload-dialog`, whose form
 * carries kind / confidentiality / occurredOn / per-home config that NSP
 * evidence has none of. The transport choreography is the shared part and the
 * shared part is what is mirrored; the form is genuinely different.
 *
 * ## Retry, and the one failure that must not offer it
 *
 * A failed or partial PUT leaves NO object, so finalize answers
 * `upload_incomplete` and the RESERVATION stays valid: the dialog keeps the
 * session and offers "Tentar novamente", re-PUTting into the same reservation.
 *
 * Two failures end that reservation instead and must show no retry:
 *
 * - `upload_expired` — the reservation lapsed; a new one must be begun. Also
 *   pre-empted locally from the credential's `expiresAt`, because the PO-ruled
 *   TTLs are 120 s (PHI) / 300 s (ADR 0114 O4), so lapsing while the dialog
 *   sits open is routine rather than an edge case, and "expired" must never
 *   read as "broken".
 * - the bytes LANDED and failed verification — `file_objects` is `failed`, a
 *   state the D9 machine has no outbound arc from, over bytes that are
 *   immutable (Rule 6). Every "retry" click re-enters the same dead end forever
 *   (DM2 QA r1 MAJOR-3).
 *
 * ⚠ The second is discriminated on the result's `terminal` marker, NEVER on the
 * error code: `upload_incomplete` is returned for both outcomes, which is the
 * whole reason the marker exists (contract amendment 1).
 */
export function EvidenceUploadDialog({
  open,
  onOpenChange,
  dialogTitle,
  fileGuidance,
  titleGuidance,
  titlePlaceholder,
  begin,
  finalize,
  idPrefix,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** pt-BR dialog heading. */
  dialogTitle: string;
  /** pt-BR sentence stating what the FILE may contain (the D12 file rule). */
  fileGuidance: string;
  /** pt-BR sentence stating what the TITLE may never contain (the D12 title rule). */
  titleGuidance: string;
  titlePlaceholder: string;
  begin: BeginEvidenceUpload;
  finalize: FinalizeEvidenceUpload;
  /** DOM id stem, so two dialogs on one page never collide on label wiring. */
  idPrefix: string;
}) {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [errors, setErrors] = useState<{ file?: string; title?: string }>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  /** A live reservation kept across a failed PUT so the retry reuses it. */
  const [session, setSession] = useState<NspEvidenceUploadTicket | null>(null);
  /** This upload can never be completed from here. Governs AFFORDANCES, not
   *  just copy: a message telling the user to remove the item while a submit
   *  button still invites another attempt is the defect, not the fix. */
  const [terminal, setTerminal] = useState(false);

  const isBusy = phase !== "idle";
  const isLocked = isBusy || terminal;

  // Reset on each open (render-phase prop-sync, not an effect).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setFile(null);
      setTitle("");
      setErrors({});
      setBanner(null);
      setPhase("idle");
      setSession(null);
      setTerminal(false);
    }
  }

  /**
   * @param options.terminal the result's `terminal` marker — the failure is
   * final for this reservation, so no retry may be offered.
   */
  function fail(code: NspEvidenceErrorCode, options?: { terminal?: boolean }) {
    const isTerminal = options?.terminal === true;
    setBanner(
      isTerminal ? NSP_EVIDENCE_UPLOAD_TERMINAL_MESSAGE : nspEvidenceErrorMessage(code),
    );
    setPhase("idle");
    // Two failures invalidate the reservation and must drop it, so nothing
    // re-PUTs into a dead URL or re-finalizes a spent session: `upload_expired`
    // (the reservation lapsed) and a terminal verification failure (the bytes
    // landed and are `failed` — MAJOR-3).
    if (isTerminal || code === "upload_expired") setSession(null);
    if (isTerminal) {
      setTerminal(true);
      // The failed row BOUND itself to the analysis, so the item the banner
      // tells the user to remove now exists — refresh so it is actually on
      // screen behind this dialog, with its own "Remover" control, instead of
      // an instruction pointing at a row only a manual reload would reveal.
      router.refresh();
    }
  }

  /** Steps 2–3. Split out so a retry re-enters here with the SAME reservation. */
  async function putAndFinalize(ticket: NspEvidenceUploadTicket, bytes: File) {
    // A reservation that lapsed while the dialog sat open cannot be PUT into,
    // and its failure must read as "expired", never as "the upload broke". At a
    // 120 s PHI TTL this is a routine path, not a defensive one.
    if (Date.parse(ticket.upload.expiresAt) <= Date.now()) {
      fail("upload_expired");
      return;
    }

    setPhase("uploading");
    const put = await uploadDocumentFile(ticket.upload, bytes);
    if (!put.ok) {
      // No object was left behind; the reservation is still good.
      fail("upload_incomplete");
      return;
    }

    setPhase("finalizing");
    try {
      const finalized = await finalize(ticket.uploadSessionId);
      if (!finalized.ok) {
        fail(finalized.code, { terminal: finalized.terminal === true });
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
    // Guards the ACTION as well as the button: a form still reachable by Enter
    // must not re-enter a flow whose reservation is spent.
    if (isLocked) return;

    const trimmed = title.trim();
    const next: { file?: string; title?: string } = {};
    if (!file) {
      next.file = "Escolha um arquivo para enviar.";
    } else if (file.size > DOCUMENT_MAX_SIZE_BYTES) {
      next.file = nspEvidenceErrorMessage("file_too_large");
    } else if (file.type && !DOCUMENT_ACCEPTED_MIME_TYPES.includes(file.type)) {
      next.file = nspEvidenceErrorMessage("file_type_not_allowed");
    }
    if (trimmed.length === 0) {
      next.title = "Informe um título para a evidência.";
    }
    setErrors(next);
    setBanner(null);
    if (Object.keys(next).length > 0 || !file) return;

    // A live reservation from a previous failed PUT: retry into it.
    if (session) {
      await putAndFinalize(session, file);
      return;
    }

    setPhase("preparing");
    try {
      const begun = await begin({
        title: trimmed,
        declaredFileName: file.name,
        declaredMime: file.type || "application/octet-stream",
        declaredSize: file.size,
      });
      if (!begun.ok) {
        fail(begun.code);
        return;
      }
      if (!begun.ticket) {
        fail("unknown");
        return;
      }
      setSession(begun.ticket);
      await putAndFinalize(begun.ticket, file);
    } catch {
      // A thrown action must never escape into the error boundary and blank the
      // page behind the dialog, and must never surface a raw server message.
      fail("unknown");
    }
  }

  const fileFieldId = `${idPrefix}-file`;
  const fileHintId = `${idPrefix}-file-hint`;
  const titleFieldId = `${idPrefix}-title`;
  const titleHintId = `${idPrefix}-title-hint`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{fileGuidance}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {banner && <FormBanner tone="error">{banner}</FormBanner>}

          {/* Progress is announced, not just animated: a keyboard/screen-reader
              user submitting a slow upload must hear that something is happening. */}
          <p role="status" aria-live="polite" className="sr-only">
            {isBusy ? PHASE_MESSAGE[phase] : ""}
          </p>

          <div className="flex flex-col gap-1.5 text-sm">
            <label htmlFor={fileFieldId} className="font-medium">
              Arquivo
            </label>
            <input
              id={fileFieldId}
              type="file"
              name="file"
              accept={DOCUMENT_ACCEPTED_MIME_TYPES.join(",")}
              disabled={isLocked}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                // A different file needs a different reservation.
                setSession(null);
              }}
              aria-invalid={errors.file ? true : undefined}
              aria-describedby={fileHintId}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            />
            {file && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Paperclip aria-hidden="true" className="size-3" />
                {file.name}
              </span>
            )}
            <span id={fileHintId} className="text-xs text-muted-foreground">
              {DOCUMENT_FILE_HINT}
            </span>
            {errors.file && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {errors.file}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5 text-sm">
            <label htmlFor={titleFieldId} className="font-medium">
              Título
            </label>
            <input
              id={titleFieldId}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLocked}
              className={FIELD_CLASS}
              placeholder={titlePlaceholder}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={titleHintId}
            />
            <span id={titleHintId} className="text-xs text-muted-foreground">
              {titleGuidance}
            </span>
            {errors.title && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {errors.title}
              </span>
            )}
          </div>

          <DialogFooter>
            {terminal ? (
              /* No submit at all. A disabled "Tentar novamente" would still name
                 an action that does not exist; the recovery lives in the list
                 behind this dialog, so the only thing left here is to leave. */
              <Button type="button" size="lg" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            ) : (
              <>
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
                      : "Enviar arquivo"}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

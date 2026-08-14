"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Paperclip, Plus } from "lucide-react";

import type {
  ReferralDocumentErrorCode,
  ReferralReplyDocument,
} from "@/lib/referrals/types";
import type { DocumentUploadCredential } from "@/lib/documents/types";
import {
  DOCUMENT_ACCEPTED_MIME_TYPES,
  DOCUMENT_MAX_SIZE_BYTES,
} from "@/lib/documents/types";
import {
  beginReferralReplyAttachmentUpload,
  finalizeReferralReplyAttachmentUpload,
} from "@/lib/referrals/actions";
import { uploadDocumentFile } from "@/lib/documents/upload-client";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { DOCUMENT_FILE_HINT } from "@/components/documents/document-labels";
import {
  REFERRAL_ATTACHMENT_TITLE_GUIDANCE,
  REFERRAL_UPLOAD_TERMINAL_MESSAGE,
  referralDocumentErrorMessage,
} from "./referral-document-labels";
import { formatFileSize } from "./format";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** Where the three-step transport currently is. Drives the live status region. */
type UploadPhase = "idle" | "preparing" | "uploading" | "finalizing";

const PHASE_MESSAGE: Record<Exclude<UploadPhase, "idle">, string> = {
  preparing: "Preparando o envio…",
  uploading: "Enviando arquivo…",
  finalizing: "Verificando arquivo…",
};

/** One row in the in-dialog list: either an attachment that already existed
 * when the dialog opened, or one uploaded in this session. */
interface AttachedRow {
  key: string;
  title: string;
  sizeBytes: number | null;
  /** `true` for a row uploaded in this session (drives the "Anexado" affordance). */
  fresh: boolean;
}

/**
 * The B-side reply-attachment control (DM4 / ADR 0114 Wave C, PO ruling R1).
 *
 * ## What it replaced
 *
 * A disabled placeholder reading "Anexos da resposta poderão ser adicionados
 * após concluir." That sentence was doubly wrong: nothing could add them after
 * concluding either (`add_referral_reply_attachment` had never had a UI caller
 * in its life), and the upload authority is `accepted`/`in_review` — so "após
 * concluir" named the one window in which it is refused. This control sits
 * where the authority actually is: inside the reply dialog, BEFORE the
 * conclusion, while the referral is still `in_review`.
 *
 * ## The corridor, and where the flag cuts it
 *
 * begin (reserves document + file object + session, server-derived coordinates,
 * tier pinned `phi`) → PUT the bytes to the signed credential → finalize
 * (server-side byte verification + rendition binding).
 *
 * `documents_wave_c` gates this at the FIRST residue-producing step by making
 * the whole control ABSENT — the host does not render it, so there is no
 * trigger that can call `begin`, no reservation, and no PUT. DM3 shipped the
 * opposite defect (a flag on the LAST step, while the earlier steps still
 * reserved paths and landed real bytes), which is exactly what "gate the
 * corridor, not its last step" was written about.
 *
 * ## Retry, and the one failure that must not offer it
 *
 * A failed or partial PUT leaves NO object behind the reservation, so finalize
 * answers `upload_incomplete` and the reservation stays valid — "Tentar
 * novamente" re-PUTs into the SAME reservation. Two failures end it instead and
 * neither may show a retry: `upload_expired` (lapsed) and a `terminal` finalize
 * result (bytes landed, verification failed, over immutable bytes). The
 * discriminator is the result's `terminal` marker, never the error code — both
 * outcomes return `upload_incomplete`.
 *
 * ## Not a nested form
 *
 * This lives INSIDE the reply dialog's `<form>`, so it is a `<div>` with
 * `type="button"` controls: a nested `<form>` is invalid HTML, and — the part
 * that actually bites — an un-intercepted Enter in the título field would
 * submit the OUTER form and conclude the referral. Enter here attaches instead.
 */
export function ReferralReplyAttachmentUpload({
  referralId,
  initialDocuments,
}: {
  referralId: string;
  /** Attachments already on this referral when the dialog opened — so a
   * coordinator who uploaded, closed the dialog and came back does not upload
   * the same file twice. Empty while `documents_wave_c` is off (the host never
   * queried them). */
  initialDocuments: ReferralReplyDocument[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    file?: string;
    title?: string;
  }>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  /** A live reservation kept across a failed PUT so the retry reuses it. The
   * credential contract is the document module's — DM4 reuses the Wave-A/B
   * transport rather than minting a second one (plan S4). */
  const [session, setSession] = useState<{
    id: string;
    credential: DocumentUploadCredential;
  } | null>(null);
  /** Rows uploaded in THIS dialog session, newest last. */
  const [uploaded, setUploaded] = useState<AttachedRow[]>([]);
  /**
   * Remounts the file input after a successful attach. `<input type="file">` is
   * uncontrolled — clearing the `file` STATE leaves the picker still displaying
   * the consumed filename, so the control would read "Documento.pdf selected"
   * while refusing the next click with "Escolha um arquivo para anexar". A key
   * bump is the only way to clear a file input's own value.
   */
  const [pickerKey, setPickerKey] = useState(0);

  const isBusy = phase !== "idle";

  /**
   * The rendered list, merged BY `documentId` — never concatenated (BUG-DM4-DUP-1).
   *
   * ## Why a concat was wrong
   *
   * `finalizeReferralReplyAttachmentUpload` calls `revalidatePath` on the
   * referral detail, so a successful upload makes Next refetch the RSC payload
   * WHILE this dialog stays mounted. The page re-runs
   * `listReferralReplyDocuments`, which now includes the attachment just
   * created, and hands it back down as `initialDocuments` — while `uploaded`
   * still holds the optimistic copy of the same row. Concatenating rendered the
   * document TWICE, under the same React key.
   *
   * ⚠ It is a RACE, not a condition: whether the duplicate is on screen depends
   * on whether the refetch resolved before the render being observed. A run that
   * does not reproduce it has lost the race, not avoided the bug — which is
   * exactly how this survived dev-loop verification and surfaced only on
   * prod-standalone.
   *
   * ## Why the optimistic row is NOT the thing to drop
   *
   * `initialDocuments` is server-rendered and legitimately STALE for the whole
   * upload window — that is the reason the optimistic row exists. Removing it
   * would trade a duplicated row for a disappearing one, which is the worse
   * failure: the user would attach a file and watch it vanish.
   *
   * ## Insertion order is load-bearing
   *
   * Optimistic rows are inserted FIRST so each one already occupies the position
   * it will keep once the server catches up. Seeding from `initialDocuments`
   * first would put a fresh upload at the END of the list pre-refetch and at the
   * FRONT after it (the query returns newest-first) — a second timing-dependent
   * DOM change, of the same family as the bug being fixed here. Keys are unique
   * because they are `Map` keys, by construction rather than by luck.
   */
  const byId = new Map<string, AttachedRow>();
  for (const row of uploaded) byId.set(row.key, row);
  for (const d of initialDocuments) {
    // The optimistic row wins the tie; `set` here would overwrite it (and drop
    // its `fresh` marker) the moment the server caught up.
    if (byId.has(d.documentId)) continue;
    byId.set(d.documentId, {
      key: d.documentId,
      title: d.title,
      sizeBytes: d.sizeBytes,
      fresh: false,
    });
  }
  const rows: AttachedRow[] = [...byId.values()];

  function fail(code: ReferralDocumentErrorCode, options?: { terminal?: boolean }) {
    const isTerminal = options?.terminal === true;
    setBanner(
      isTerminal ? REFERRAL_UPLOAD_TERMINAL_MESSAGE : referralDocumentErrorMessage(code),
    );
    setPhase("idle");
    // Both of these invalidate the reservation: nothing may re-PUT into a dead
    // URL or re-finalize a spent session.
    if (isTerminal || code === "upload_expired") setSession(null);
  }

  /** Steps 2–3. Split out so a retry re-enters with the SAME reservation. */
  async function putAndFinalize(
    sessionId: string,
    credential: DocumentUploadCredential,
    bytes: File,
    attachedTitle: string,
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
      const finalized = await finalizeReferralReplyAttachmentUpload(sessionId);
      if (!finalized.ok) {
        fail(finalized.error, { terminal: finalized.terminal === true });
        return;
      }
      setUploaded((prev) => [
        ...prev,
        {
          key: finalized.documentId,
          title: attachedTitle,
          sizeBytes: bytes.size,
          fresh: true,
        },
      ]);
      // Clear the composer for the next file; the reservation is spent.
      setSession(null);
      setFile(null);
      setTitle("");
      setPickerKey((k) => k + 1);
      setFieldErrors({});
      setPhase("idle");
      setBanner(null);
    } catch {
      fail("unknown");
    }
  }

  async function attach() {
    if (isBusy) return;

    const trimmed = title.trim();
    const next: { file?: string; title?: string } = {};
    if (!file) {
      next.file = "Escolha um arquivo para anexar.";
    } else if (file.size > DOCUMENT_MAX_SIZE_BYTES) {
      next.file = `O arquivo excede o tamanho máximo de ${Math.round(
        DOCUMENT_MAX_SIZE_BYTES / (1024 * 1024),
      )} MB.`;
    } else if (file.type && !DOCUMENT_ACCEPTED_MIME_TYPES.includes(file.type)) {
      next.file = "Este tipo de arquivo não é aceito.";
    }
    if (trimmed.length === 0) {
      next.title = "Informe um título para o anexo.";
    }
    setFieldErrors(next);
    setBanner(null);
    if (Object.keys(next).length > 0 || !file) return;

    // A live reservation from a previous failed PUT: retry into it.
    if (session) {
      await putAndFinalize(session.id, session.credential, file, trimmed);
      return;
    }

    setPhase("preparing");
    try {
      const begun = await beginReferralReplyAttachmentUpload({
        referralId,
        title: trimmed,
        // HINTS only — finalize re-derives name/MIME/size server-side (D9).
        declaredFileName: file.name,
        declaredMimeType: file.type || "application/octet-stream",
        declaredSizeBytes: file.size,
      });
      if (!begun.ok) {
        fail(begun.error);
        return;
      }
      setSession({ id: begun.uploadSessionId, credential: begun.upload });
      await putAndFinalize(begun.uploadSessionId, begun.upload, file, trimmed);
    } catch {
      // A thrown action must never escape into the error boundary and blank the
      // dialog, and must never surface a raw server message.
      fail("unknown");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/10 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
          <Paperclip aria-hidden="true" className="size-4 text-muted-foreground" />
          Anexos da resposta
        </h3>
        <p className="text-xs text-pretty text-muted-foreground">
          Anexe laudos, pareceres ou evidências que acompanham a resposta. Cada
          arquivo é enviado assim que você escolhe &ldquo;Anexar arquivo&rdquo;.
        </p>
      </div>

      {banner && <FormBanner tone="error">{banner}</FormBanner>}

      {/* Progress is announced, not just animated: a keyboard/screen-reader user
          waiting on a slow upload must hear that something is happening. */}
      <p role="status" aria-live="polite" className="sr-only">
        {isBusy ? PHASE_MESSAGE[phase] : ""}
      </p>

      {rows.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <li
              key={row.key}
              className="animate-rise-in flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2"
              style={{ "--rise-delay": `${i * 60}ms` } as CSSProperties}
            >
              {row.fresh ? (
                <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success" />
              ) : (
                <Paperclip
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
              )}
              <span className="min-w-0 flex-1 truncate text-sm">{row.title}</span>
              {formatFileSize(row.sizeBytes) && (
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatFileSize(row.sizeBytes)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reply-attachment-file" className="text-sm font-medium">
          Arquivo do anexo
        </label>
        <input
          key={pickerKey}
          id="reply-attachment-file"
          type="file"
          accept={DOCUMENT_ACCEPTED_MIME_TYPES.join(",")}
          disabled={isBusy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            // A different file needs a different reservation.
            setSession(null);
          }}
          aria-invalid={fieldErrors.file ? true : undefined}
          aria-describedby="reply-attachment-file-hint"
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-muted focus-visible:outline-none"
        />
        <span id="reply-attachment-file-hint" className="text-xs text-muted-foreground">
          {DOCUMENT_FILE_HINT}
        </span>
        {fieldErrors.file && (
          <span role="alert" className="text-sm font-medium text-destructive">
            {fieldErrors.file}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reply-attachment-title" className="text-sm font-medium">
          Título do anexo
        </label>
        <input
          id="reply-attachment-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            // The outer element is the reply dialog's `<form>`: an unhandled
            // Enter here would CONCLUDE the referral. Attach instead.
            if (e.key === "Enter") {
              e.preventDefault();
              void attach();
            }
          }}
          disabled={isBusy}
          className={FIELD_CLASS}
          placeholder="Ex.: Parecer técnico da análise"
          aria-invalid={fieldErrors.title ? true : undefined}
          aria-describedby="reply-attachment-title-guidance"
        />
        {/* D12, referral wording: the title crosses to the other committee and
            is readable by people the byte door refuses. */}
        <span
          id="reply-attachment-title-guidance"
          className="text-xs text-pretty text-muted-foreground"
        >
          {REFERRAL_ATTACHMENT_TITLE_GUIDANCE}
        </span>
        {fieldErrors.title && (
          <span role="alert" className="text-sm font-medium text-destructive">
            {fieldErrors.title}
          </span>
        )}
      </div>

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void attach()}
          disabled={isBusy}
        >
          {isBusy ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : session ? (
            <AlertTriangle aria-hidden="true" />
          ) : (
            <Plus aria-hidden="true" />
          )}
          {isBusy
            ? PHASE_MESSAGE[phase]
            : session
              ? "Tentar novamente"
              : "Anexar arquivo"}
        </Button>
      </div>
    </div>
  );
}

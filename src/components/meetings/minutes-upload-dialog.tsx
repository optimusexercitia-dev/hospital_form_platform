"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ExternalLink, FileAudio, Loader2 } from "lucide-react";

import { startMinutesJob, submitMinutesJob } from "@/lib/minutes-jobs/actions";
import { AUDIO_ACCEPT_ATTRIBUTE, isAllowedAudioType, MAX_AUDIO_BYTES } from "@/lib/minutes-jobs/constants";
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
import { MINUTES_UI } from "./minutes-labels";

type Phase = "idle" | "preparing" | "uploading" | "finalizing" | "error";

interface UploadState {
  phase: Phase;
  progress: number;
  error: string | null;
  jobId: string | null;
  uploadUrl: string | null;
}

const INITIAL_UPLOAD: UploadState = {
  phase: "idle",
  progress: 0,
  error: null,
  jobId: null,
  uploadUrl: null,
};

/**
 * F2 — the two-step "Usar áudio" dialog (ADR 0099 D1/D3/D11/D13).
 *
 * Step 1: the current attendee roster + the D12 speaker-attribution warning, a link to
 * edit them, and the D13 multi-part note; zero attendees blocks continuing. Step 2: pick
 * a file, upload it directly to the signed URL, and hand the job to the service.
 *
 * The upload itself is a hand-rolled `XMLHttpRequest` PUT, not the supabase-js helper —
 * `@supabase/storage-js` 2.108.1's `uploadToSignedUrl` is fetch-based and cannot report
 * progress, and a 500 MB upload with no progress reads as a hung app. The exact recipe
 * (empty-named `FormData` field, no auth headers, no `Content-Type`) is verified against
 * the running stack in `startMinutesJob`'s doc comment (`src/lib/minutes-jobs/actions.ts`).
 */
export function MinutesUploadDialog({
  meetingId,
  open,
  onOpenChange,
  attendees,
  attendeesHref,
}: {
  meetingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendees: { id: string; displayName: string | null }[];
  /** Precomputed link to the meeting's attendees section (same tab — house convention, no `target="_blank"` in this codebase). */
  attendeesHref: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadState>(INITIAL_UPLOAD);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset local state each time the dialog opens (render-phase prop-sync, house pattern).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep(1);
      setFile(null);
      setFileError(null);
      setUpload(INITIAL_UPLOAD);
    }
  }

  // Move focus to the file input on the step 1 → 2 transition (design brief §6.2).
  useEffect(() => {
    if (step === 2) fileInputRef.current?.focus();
  }, [step]);

  const busy = upload.phase === "preparing" || upload.phase === "uploading" || upload.phase === "finalizing";
  const zeroAttendees = attendees.length === 0;

  function handleFileChange(next: File | null) {
    setFile(next);
    setFileError(null);
    setUpload(INITIAL_UPLOAD);
    if (!next) return;
    if (next.size > MAX_AUDIO_BYTES) {
      setFileError(MINUTES_UI.step2FileTooLarge);
      return;
    }
    if (!isAllowedAudioType(next.type)) {
      setFileError(MINUTES_UI.step2FileTypeInvalid);
    }
  }

  function abortInFlight() {
    xhrRef.current?.abort();
    xhrRef.current = null;
  }

  async function handleClose(open: boolean) {
    if (!open) abortInFlight();
    onOpenChange(open);
  }

  async function handleSubmit() {
    if (!file) {
      setFileError(MINUTES_UI.step2FileMissing);
      return;
    }
    if (fileError) return;

    setUpload({ ...INITIAL_UPLOAD, phase: "preparing" });
    const started = await startMinutesJob(meetingId, file.name, file.type, file.size);
    if (!started.ok || !started.uploadUrl || !started.jobId) {
      setUpload({ ...INITIAL_UPLOAD, phase: "error", error: started.error ?? MINUTES_UI.step2UploadFailed });
      return;
    }

    doUpload(started.jobId, started.uploadUrl, file);
  }

  function doUpload(jobId: string, uploadUrl: string, uploadFile: File) {
    setUpload((s) => ({ ...s, phase: "uploading", progress: 0, jobId, uploadUrl, error: null }));

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", uploadFile); // empty field name — verified recipe, actions.ts doc comment

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUpload((s) => ({ ...s, progress: Math.round((e.loaded / e.total) * 100) }));
      }
    };
    xhr.onerror = () => {
      xhrRef.current = null;
      setUpload((s) => ({ ...s, phase: "error", error: MINUTES_UI.step2UploadFailed }));
    };
    xhr.onabort = () => {
      xhrRef.current = null;
    };
    xhr.onload = () => {
      xhrRef.current = null;
      if (xhr.status < 200 || xhr.status >= 300) {
        setUpload((s) => ({ ...s, phase: "error", error: MINUTES_UI.step2UploadFailed }));
        return;
      }
      void finalize(jobId);
    };
    // No apikey/authorization header, no Content-Type — the signed token in the URL is
    // the whole authorization, and the browser must set the multipart boundary itself.
    xhr.open("PUT", uploadUrl);
    xhr.send(form);
  }

  async function finalize(jobId: string) {
    setUpload((s) => ({ ...s, phase: "finalizing" }));
    const submitted = await submitMinutesJob(jobId);
    if (!submitted.ok) {
      setUpload((s) => ({ ...s, phase: "error", error: submitted.error ?? MINUTES_UI.step2UploadFailed }));
      return;
    }
    router.refresh();
    onOpenChange(false);
  }

  function retryUpload() {
    if (!file || !upload.jobId || !upload.uploadUrl) return;
    doUpload(upload.jobId, upload.uploadUrl, file);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{MINUTES_UI.dialogTitle}</DialogTitle>
          <DialogDescription>
            {step === 1 ? MINUTES_UI.step1Title : MINUTES_UI.step2Title}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <FormBanner tone="info">{MINUTES_UI.step1Warning}</FormBanner>

            {zeroAttendees ? (
              <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                {MINUTES_UI.step1ZeroAttendees}
              </p>
            ) : (
              <ul className="flex flex-col gap-1 rounded-xl border border-border bg-muted/20 p-3">
                {attendees.map((a) => (
                  <li key={a.id} className="truncate text-sm text-foreground">
                    {a.displayName ?? "Participante"}
                  </li>
                ))}
              </ul>
            )}

            <Link
              href={attendeesHref}
              className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              {MINUTES_UI.step1LinkToAttendees}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </Link>

            <p className="text-xs text-muted-foreground text-pretty">
              {MINUTES_UI.step1MultiPart}
            </p>

            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
                {MINUTES_UI.step2Cancel}
              </Button>
              <Button
                type="button"
                size="lg"
                disabled={zeroAttendees}
                onClick={() => setStep(2)}
              >
                {MINUTES_UI.step1Continue}
                <ArrowRight aria-hidden="true" />
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 text-sm">
              <label htmlFor="minutes-upload-file" className="font-medium">
                {MINUTES_UI.step2FileLabel}
              </label>
              <input
                ref={fileInputRef}
                id="minutes-upload-file"
                type="file"
                accept={AUDIO_ACCEPT_ATTRIBUTE}
                disabled={busy}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                aria-invalid={fileError ? true : undefined}
                aria-describedby="minutes-upload-hint"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-muted focus-visible:outline-none disabled:opacity-50"
              />
              <span id="minutes-upload-hint" className="text-xs text-muted-foreground">
                {MINUTES_UI.step2Accept}
              </span>
              {file && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileAudio aria-hidden="true" className="size-3.5" />
                  {file.name}
                </span>
              )}
              {fileError && (
                <span role="alert" className="text-sm font-medium text-destructive">
                  {fileError}
                </span>
              )}
            </div>

            {upload.phase === "error" && (
              <FormBanner tone="error">{upload.error}</FormBanner>
            )}

            {(upload.phase === "preparing" || upload.phase === "uploading" || upload.phase === "finalizing") && (
              <div className="flex flex-col gap-1.5">
                {/* N2: the percentage ticks on every `onprogress` event (many times a second
                    on a 500 MB upload) — it lives OUTSIDE any aria-live region, as a
                    role="progressbar" a screen reader can query on demand rather than a
                    continuous stream. Only the PHASE text below is in the live region, and
                    that changes only a handful of times per upload. */}
                <div
                  role="progressbar"
                  aria-label={MINUTES_UI.step2ProgressLabel}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={
                    upload.phase === "uploading" ? upload.progress : upload.phase === "finalizing" ? 100 : 0
                  }
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{
                      width: `${upload.phase === "uploading" ? upload.progress : upload.phase === "finalizing" ? 100 : 0}%`,
                    }}
                  />
                </div>
                <span role="status" aria-live="polite" className="text-xs text-muted-foreground tabular-nums">
                  {upload.phase === "preparing" && MINUTES_UI.step2Preparing}
                  {upload.phase === "uploading" && (
                    <>
                      {MINUTES_UI.step2Uploading} <span aria-hidden="true">{upload.progress}%</span>
                    </>
                  )}
                  {upload.phase === "finalizing" && MINUTES_UI.step2Finalizing}
                </span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">{MINUTES_UI.step2RetryFromScratch}</p>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={upload.phase === "finalizing"}
                onClick={() => {
                  if (upload.jobId) abortInFlight();
                  onOpenChange(false);
                }}
              >
                {MINUTES_UI.step2Cancel}
              </Button>
              {upload.phase === "error" && upload.jobId ? (
                <Button type="button" size="lg" onClick={retryUpload}>
                  {MINUTES_UI.retryButton}
                </Button>
              ) : (
                <Button type="button" size="lg" disabled={!file || !!fileError || busy} onClick={handleSubmit}>
                  {busy && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
                  {MINUTES_UI.step2Submit}
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

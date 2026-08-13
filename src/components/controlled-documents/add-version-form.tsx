"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";

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
import type { AddVersionState } from "@/lib/controlled-documents/actions";

type AddVersionAction = (
  prev: AddVersionState | undefined,
  formData: FormData,
) => Promise<AddVersionState>;

/** Accepted document formats — the server (bucket policy) enforces the same set. */
const ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Add-version file form (Phase 17, F2/F3). One native `<form>` posting the FILE
 * together with the metadata to `addDocumentVersion` — a SINGLE server action that
 * uploads to a new immutable path AND attaches it to the target `rascunho` version
 * ATOMICALLY (never a racy post-create round-trip; memory
 * `phi-write-atomic-with-create`, Rule 6). It attaches the file to an EXISTING
 * draft version (`versionId`), so the action needs `commissionId` + `documentId` +
 * `versionId` (the exact fields `addDocumentVersion` reads) — the supersede flow is
 * a separate step that first creates the new draft version, then routes back here.
 *
 * The action is passed in as a prop (never value-imported).
 */
export function AddVersionForm({
  action,
  commissionId,
  documentId,
  versionId,
  title,
  description,
  submitLabel,
  onDone,
}: {
  action: AddVersionAction;
  /** The document's commission — part of the immutable upload path. */
  commissionId: string;
  documentId: string;
  /** The target `rascunho` version the uploaded file attaches to. */
  versionId: string;
  title: string;
  description: string;
  submitLabel: string;
  /** Called with the new version id after a successful upload (parent refreshes). */
  onDone?: (versionId: string) => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, undefined);
  const [fileName, setFileName] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (state?.ok && !doneRef.current) {
      doneRef.current = true;
      if (state.versionId && onDone) {
        onDone(state.versionId);
      } else {
        router.refresh();
      }
    }
  }, [state, onDone, router]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
    >
      <input type="hidden" name="commissionId" value={commissionId} />
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="versionId" value={versionId} />

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground text-pretty">{description}</p>
      </div>

      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <Field>
        <FieldLabel htmlFor="documentFile">Arquivo</FieldLabel>
        <input
          ref={inputRef}
          id="documentFile"
          name="file"
          type="file"
          accept={ACCEPT}
          required
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          aria-describedby="documentFile-description"
          className="block w-full rounded-lg border border-input bg-card text-sm text-foreground shadow-xs outline-none file:mr-3 file:border-0 file:bg-muted file:px-3.5 file:py-2.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
        <FieldDescription id="documentFile-description">
          PDF ou Word (DOC/DOCX), até 25 MB. Cada versão gera um arquivo novo — o
          anterior é preservado.
        </FieldDescription>
        {fileName ? (
          <p className="text-sm text-muted-foreground">
            Selecionado: <span className="font-medium">{fileName}</span>
          </p>
        ) : null}
        <FieldError>{state?.fieldErrors?.file}</FieldError>
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
        <FieldLabel htmlFor="expiryDate">
          Data de expiração (opcional)
        </FieldLabel>
        <DatePicker
          id="expiryDate"
          name="expiryDate"
          clearable
          className="w-auto"
          aria-describedby="expiryDate-description"
        />
        <FieldDescription id="expiryDate-description">
          Data após a qual o documento deixa de valer, se aplicável.
        </FieldDescription>
      </Field>

      <div>
        <Button type="submit" size="lg" disabled={pending}>
          <FileUp aria-hidden="true" className="size-4" />
          {pending ? "Enviando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

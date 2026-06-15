"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Lock } from "lucide-react";

import { updateInterviewSummary } from "@/lib/interviews/actions";
import { SectionTextEditor } from "@/components/forms/section-text-editor";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";

/**
 * The interview SUMMARY narrative: a free-form sanitized-Markdown body
 * (Architecture Rule 7) rendered through the platform's one renderer.
 *
 * Editable only while the viewer may write AND the interview is unlocked; once
 * concluded/cancelled it is shown read-only (the server also rejects writes).
 * `canEdit` is decided by the parent from `viewerCanWrite` + the status.
 */
export function InterviewSummaryEditor({
  interviewId,
  summaryMd,
  canEdit,
}: {
  interviewId: string;
  summaryMd: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(summaryMd ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = value !== (summaryMd ?? "");

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateInterviewSummary(interviewId, value);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar. Tente novamente.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="interview-summary-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2
            id="interview-summary-heading"
            className="text-base font-semibold"
          >
            Resumo
          </h2>
          {!canEdit && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
              <Lock aria-hidden="true" className="size-3" />
              Bloqueado
            </span>
          )}
        </div>
        {canEdit && (
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isPending || !dirty}
          >
            {isPending ? "Salvando…" : "Salvar resumo"}
          </Button>
        )}
      </div>

      {error && <FormBanner tone="error">{error}</FormBanner>}
      {saved && !dirty && <FormBanner tone="success">Resumo salvo.</FormBanner>}

      {canEdit ? (
        <SectionTextEditor
          value={value}
          onChange={(next) => {
            setValue(next);
            setSaved(false);
          }}
          disabled={isPending}
          textareaId={`summary-${interviewId}`}
          placeholder="Escreva o resumo da entrevista em Markdown… Nunca inclua dados de paciente."
        />
      ) : value.trim().length > 0 ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <MarkdownRenderer content={value} />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum resumo registrado.
        </p>
      )}
    </section>
  );
}

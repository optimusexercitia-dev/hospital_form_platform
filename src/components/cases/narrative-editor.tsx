"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, User } from "lucide-react";

import { saveNarrativeBody } from "@/lib/case-narratives/actions";
import { SectionTextEditor } from "@/components/forms/section-text-editor";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { NarrativeStatusPill } from "@/components/cases/narrative-status-pill";
import { ConcludeNarrativeButton } from "@/components/cases/conclude-narrative-button";
import type { CaseNarrative } from "@/lib/queries/cases";

/**
 * The FOCUSED narrative editor body (Case Access Control increment, ADR 0033 D7;
 * FE-4) — the narrative analogue of the phase-fill wizard. The assignee opens it
 * from "Meus Casos" (or anyone via "Abrir" on the detail card) to author the
 * de-identified Markdown body (Architecture Rule 7) in a calm, single-column focus
 * shell, then Salvar (autosave-free, explicit) and Concluir (freezes the body).
 *
 * - `canEdit` (decided server-side via {@link import('./narrative-access').canEditNarrative},
 *   Q14) gates the editor; a viewer without write rights gets a read-only render of
 *   the body (or an empty-state note).
 * - `canConclude` (assignee/coordinator + `aberta`) shows the Concluir action.
 * - A `concluida` narrative is read-only with a "Bloqueada" note; the server also
 *   rejects writes (HC055).
 */
export function NarrativeEditor({
  narrative,
  canEdit,
  canConclude,
  doneHref,
}: {
  narrative: CaseNarrative;
  canEdit: boolean;
  canConclude: boolean;
  /** Where "Concluir" / the body save returns focus context (the back target). */
  doneHref: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(narrative.bodyMd ?? "");
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const hasBody = (narrative.bodyMd ?? "").trim().length > 0;
  const isConcluded = narrative.status === "concluida";

  function handleSave() {
    setError(null);
    setSavedNote(null);
    startTransition(async () => {
      const result = await saveNarrativeBody(narrative.id, value);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar. Tente novamente.");
        return;
      }
      setSavedNote(result.error ?? "Narrativa salva.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <NarrativeStatusPill status={narrative.status} />
        {isConcluded && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
            <Lock aria-hidden="true" className="size-3" />
            Bloqueada
          </span>
        )}
        {narrative.assigneeName && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <User aria-hidden="true" className="size-3.5" />
            {narrative.assigneeName}
          </span>
        )}
      </div>

      {narrative.instructions && (
        <p className="max-w-prose rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground text-pretty">
          {narrative.instructions}
        </p>
      )}

      {error && <FormBanner tone="error">{error}</FormBanner>}
      {savedNote && (
        <p role="status" className="text-sm font-medium text-success">
          {savedNote}
        </p>
      )}

      {canEdit ? (
        <div className="flex flex-col gap-4">
          <SectionTextEditor
            value={value}
            onChange={(next) => {
              setValue(next);
              setSavedNote(null);
            }}
            disabled={isPending}
            textareaId={`narrative-editor-${narrative.id}`}
            placeholder="Escreva esta narrativa em Markdown… Nunca inclua dados de paciente."
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canConclude ? (
              <ConcludeNarrativeButton
                narrativeId={narrative.id}
                onConcluded={() => router.push(doneHref)}
              />
            ) : (
              <span aria-hidden="true" />
            )}
            <Button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              aria-busy={isPending || undefined}
            >
              <CheckCircle2 aria-hidden="true" />
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      ) : hasBody ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <MarkdownRenderer content={narrative.bodyMd ?? ""} />
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground text-pretty">
          Esta narrativa ainda não tem conteúdo.
        </p>
      )}
    </div>
  );
}

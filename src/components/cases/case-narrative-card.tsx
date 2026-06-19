"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Lock, Pencil } from "lucide-react";

import type { CaseNarrative } from "@/lib/queries/cases";
import { upsertNarrativeBody } from "@/lib/case-narratives/actions";
import { SectionTextEditor } from "@/components/forms/section-text-editor";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";

/**
 * One per-case NARRATIVE (`case_narratives`; ADR 0032) on the case-detail left
 * column — a free-form sanitized-Markdown body (Architecture Rule 7) rendered
 * through the platform's one renderer, interleaved with the phase articles by
 * {@link import('@/lib/queries/case-narratives').mergeCaseLayout}.
 *
 * It is the narrative-side analogue of {@link CasePhaseList}'s phase `<article>`,
 * and clones {@link InterviewSummaryEditor}'s inline Markdown pattern — but as an
 * EXPAND-TO-EDIT card: the coordinator reads the rendered prose and clicks
 * "Editar" to switch the same card into an in-place {@link SectionTextEditor}
 * (Editar / Pré-visualizar live preview) with Salvar / Cancelar.
 *
 * - `canEdit` is decided by the parent from `isOpen && coordinator`. While the
 *   case is open and the viewer is a coordinator, the card is editable; once the
 *   case is concluído/cancelado (or the viewer is a plain member) it is read-only
 *   and shows a "Bloqueado" pill (the server also rejects writes — HC054).
 * - Read mode renders the body when set; an EMPTY body shows a muted placeholder
 *   ONLY to a coordinator (`canEdit`). A read-only viewer with an empty body sees
 *   nothing — the parent already filters empty narratives out for non-editors, and
 *   this is the belt-and-suspenders guard.
 * - `instructions` (authoring guidance snapshotted from the template slot) render
 *   as a muted helper line under the heading.
 */
export function CaseNarrativeCard({
  narrative,
  canEdit,
}: {
  narrative: CaseNarrative;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(narrative.bodyMd ?? "");
  const [error, setError] = useState<string | null>(null);

  const heading = narrative.title || narrative.typeLabel;
  const hasBody = (narrative.bodyMd ?? "").trim().length > 0;
  const headingId = `narrative-${narrative.id}-heading`;

  function handleEdit() {
    setError(null);
    setValue(narrative.bodyMd ?? "");
    setEditing(true);
  }

  function handleCancel() {
    setError(null);
    setValue(narrative.bodyMd ?? "");
    setEditing(false);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await upsertNarrativeBody(narrative.id, value);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar. Tente novamente.");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  // A read-only viewer with no body has nothing to show (the parent filters these
  // out before rendering; this keeps the card honest if one slips through).
  if (!canEdit && !hasBody) return null;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <FileText aria-hidden="true" className="size-3.5" />
              Narrativa
            </span>
            {!canEdit && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                <Lock aria-hidden="true" className="size-3" />
                Bloqueado
              </span>
            )}
          </div>
          <h2 id={headingId} className="text-base font-semibold">
            {heading}
          </h2>
          {narrative.instructions && (
            <p className="max-w-prose text-xs text-muted-foreground text-pretty">
              {narrative.instructions}
            </p>
          )}
        </div>

        {canEdit && !editing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="shrink-0"
          >
            <Pencil aria-hidden="true" />
            Editar
          </Button>
        )}
      </div>

      {error && <FormBanner tone="error">{error}</FormBanner>}

      {editing ? (
        <div className="flex flex-col gap-3">
          <SectionTextEditor
            value={value}
            onChange={setValue}
            disabled={isPending}
            textareaId={`narrative-body-${narrative.id}`}
            placeholder="Escreva esta narrativa em Markdown… Nunca inclua dados de paciente."
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      ) : hasBody ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <MarkdownRenderer content={narrative.bodyMd ?? ""} />
        </div>
      ) : (
        // Coordinator-only placeholder (the early return handles read-only viewers).
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground text-pretty">
          Nenhum conteúdo ainda. Clique em <span className="font-medium">Editar</span> para
          preencher.
        </p>
      )}
    </section>
  );
}

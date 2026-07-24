"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, History, Send } from "lucide-react";

import type { CaseNarrative } from "@/lib/queries/cases";
import type {
  CorrectionRequest,
  NarrativeRevision,
} from "@/lib/queries/corrections";
import {
  resubmitCorrection,
  saveCorrectionDraftBody,
} from "@/lib/corrections/actions";
import {
  canContinueCorrection,
  type CorrectionCaps,
} from "@/components/cases/correction-labels";
import { CorrectionStatusChip } from "@/components/cases/correction-chips";
import { FileCorrectionControl } from "@/components/cases/file-correction-control";
import { SectionTextEditor } from "@/components/forms/section-text-editor";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import type { AssigneeOption } from "@/components/cases/case-phase-list";
import { formatDate } from "@/components/cases/format";

/**
 * The Case Correction Lifecycle surface for ONE narrative (ADR 0085), rendered by
 * {@link CaseNarrativeCard} beneath the body when the `case_corrections` flag is on.
 * Three parts, any of which may be absent:
 *  - **File** — a "Corrigir…" menu on a CONCLUDED narrative with no open request
 *    (correction / adendo / anulação), when the viewer may file (flag + case open).
 *  - **Correct** — the designated corrector's draft editor (a sanitized-Markdown
 *    body via {@link SectionTextEditor}) bound to `save_correction_draft_body`, plus
 *    "Enviar para revisão" (`resubmit_correction`). Shown while the request is in a
 *    resting/editing state and the kind carries a draft (not `void`).
 *  - **History** — the append-only revision snapshots (superseded bodies), collapsed.
 *
 * A `void` request shows only its status chip here (it is decided in the panel).
 */
export function NarrativeCorrectionPanel({
  narrative,
  heading,
  caps,
  openCorrection,
  revisions,
  assignees,
}: {
  narrative: CaseNarrative;
  /** The narrative's display heading (dialog target label). */
  heading: string;
  caps: CorrectionCaps;
  openCorrection: CorrectionRequest | null;
  revisions: NarrativeRevision[];
  assignees: AssigneeOption[];
}) {
  const isConcluded = narrative.status === "completed";
  const showFile =
    caps.enabled && caps.canFile && isConcluded && openCorrection == null;
  const showCorrectorEditor =
    openCorrection != null &&
    canContinueCorrection(openCorrection, caps.viewerId);

  // Nothing to render → the card omits this section entirely.
  if (!showFile && openCorrection == null && revisions.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      {openCorrection && !showCorrectorEditor && (
        <div className="flex flex-wrap items-center gap-2">
          <CorrectionStatusChip status={openCorrection.status} />
          <span className="text-xs text-muted-foreground">
            Correção da narrativa em andamento.
          </span>
        </div>
      )}

      {showCorrectorEditor && openCorrection && (
        <NarrativeDraftEditor
          request={openCorrection}
          fallbackBody={narrative.bodyMd ?? ""}
        />
      )}

      {showFile && (
        <div className="flex justify-end">
          <FileCorrectionControl
            target={{ kind: "narrative", caseNarrativeId: narrative.id }}
            targetLabel={heading}
            assignees={assignees}
            caps={caps}
            defaultCorrectorId={narrative.assignedTo}
          />
        </div>
      )}

      {revisions.length > 0 && (
        <NarrativeRevisionHistory revisions={revisions} />
      )}
    </div>
  );
}

/** The corrector's draft editor for a narrative correction/addendum request. */
function NarrativeDraftEditor({
  request,
  fallbackBody,
}: {
  request: CorrectionRequest;
  /** The narrative's current body — the seed when no draft has been saved yet. */
  fallbackBody: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(request.draftBodyMd ?? fallbackBody);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const canResubmit = value.trim().length > 0;

  function handleSave() {
    setError(null);
    setSavedNote(null);
    startTransition(async () => {
      const result = await saveCorrectionDraftBody(request.id, value);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar. Tente novamente.");
        return;
      }
      setSavedNote("Rascunho salvo.");
      router.refresh();
    });
  }

  function handleResubmit() {
    setError(null);
    setSavedNote(null);
    startTransition(async () => {
      // Persist the latest text first, then submit for review — so the reviewer
      // always sees exactly what is on screen.
      const saved = await saveCorrectionDraftBody(request.id, value);
      if (!saved.ok) {
        setError(saved.error ?? "Não foi possível salvar. Tente novamente.");
        return;
      }
      const result = await resubmitCorrection(request.id);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível reenviar. Tente novamente.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <CorrectionStatusChip status={request.status} />
        <span className="text-xs text-muted-foreground">
          Você é o corretor desta narrativa.
        </span>
      </div>

      {request.status === "rejected" && request.lastRejectedReason && (
        <div
          role="status"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <span className="font-medium">Reprovada:</span>{" "}
          {request.lastRejectedReason}
        </div>
      )}

      {error && <FormBanner tone="error">{error}</FormBanner>}
      {savedNote && (
        <p role="status" className="text-sm font-medium text-success">
          {savedNote}
        </p>
      )}

      <SectionTextEditor
        value={value}
        onChange={(next) => {
          setValue(next);
          setSavedNote(null);
        }}
        disabled={isPending}
        textareaId={`narrative-correction-${request.id}`}
        placeholder="Reescreva esta narrativa em Markdown… Nunca inclua dados de paciente."
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? "Salvando…" : "Salvar rascunho"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleResubmit}
          disabled={isPending || !canResubmit}
        >
          <Send aria-hidden="true" />
          Enviar para revisão
        </Button>
      </div>
    </div>
  );
}

/** Collapsible append-only history of a narrative's superseded bodies. */
function NarrativeRevisionHistory({
  revisions,
}: {
  revisions: NarrativeRevision[];
}) {
  const [open, setOpen] = useState(false);
  const regionId = `narrative-revisions-${revisions[0]?.caseNarrativeId ?? "x"}`;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={regionId}
        className="inline-flex w-fit items-center gap-1.5 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <History aria-hidden="true" className="size-3.5" />
        Histórico de revisões ({revisions.length})
        <ChevronDown
          aria-hidden="true"
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul id={regionId} className="flex flex-col gap-2">
          {revisions.map((rev) => (
            <li
              key={rev.id}
              className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/20 p-3"
            >
              <p className="text-xs font-medium text-muted-foreground">
                Revisão {rev.revisionNumber} · {formatDate(rev.snapshottedAt)}
              </p>
              <div className="rounded-md border border-border bg-card p-3">
                <MarkdownRenderer content={rev.bodyMd} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

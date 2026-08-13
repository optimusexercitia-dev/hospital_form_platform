"use client";

import { useState } from "react";
import { Check, GitCompare } from "lucide-react";

import type { ControlledDocumentVersion, ObsoleteKind } from "@/lib/controlled-documents/types";
import { cn } from "@/lib/utils";
import {
  DocumentStatusChip,
  ObsoleteKindChip,
} from "@/components/controlled-documents/document-badges";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import {
  formatDateOnly,
  formatVersionNumber,
  versionFileLabel,
} from "@/components/controlled-documents/format";
import { OpenControlledVersionButton } from "@/components/controlled-documents/open-controlled-version-button";
import { VersionCompareModal } from "@/components/controlled-documents/version-compare-modal";

/**
 * Document version history (Phase 17 v2, F-C; doc-detail redesign). Newest-first
 * spine of `VersionCard`s; the in-force version is accent-bordered, and so is the
 * working draft under revision (when it differs from the in-force card). Each
 * card carries a compare-select toggle — selecting exactly two enables
 * "Comparar", opening the focus-trapped `VersionCompareModal`. Selecting a third
 * replaces the oldest of the pair. Client component; compare is pure over
 * already-loaded data (no backend call).
 *
 * `activeDraftSlot` is the RSC slot pattern: the server page renders the
 * draft-authoring / approvals / publish affordances as a plain ReactNode and
 * passes it down as a prop — this component only decides WHICH card hosts it
 * (`version.id === activeDraftId`); it never executes server-only code itself
 * (BUG-QI-001 — never pass a closure here, only serializable/element props).
 *
 * DM3·S2: versions arrive as the plain projection. There is no longer a
 * per-version signed URL minted during render — every card's download is the
 * audited on-click door (`OpenControlledVersionButton`), and PRIOR versions go
 * through exactly the same door as the current one.
 */
export function DocumentVersionHistory({
  versions,
  currentVersionId,
  activeDraftId = null,
  activeDraftSlot,
}: {
  versions: ControlledDocumentVersion[];
  currentVersionId: string | null;
  /** The working draft's version id (`draft` or `in_approval`) — or null/absent. */
  activeDraftId?: string | null;
  /** Rendered INSIDE the working-draft's card, after its summary of changes. */
  activeDraftSlot?: React.ReactNode;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((v) => v !== id);
      if (prev.length < 2) return [...prev, id];
      // Replace the oldest of the pair (drop the first-selected).
      return [prev[1], id];
    });
  }

  const canCompare = selected.length === 2;
  const pair = canCompare
    ? selected
        .map((id) => versions.find((v) => v.id === id))
        .filter((v): v is ControlledDocumentVersion => v != null)
    : [];

  return (
    <section aria-labelledby="versions-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 id="versions-heading" className="text-lg font-semibold">
            Versões
          </h2>
          <span className="text-sm text-muted-foreground tabular-nums">
            {versions.length}{" "}
            {versions.length === 1 ? "versão" : "versões"}
          </span>
        </div>
        {versions.length >= 2 ? (
          <button
            type="button"
            disabled={!canCompare}
            onClick={() => setCompareOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
          >
            <GitCompare aria-hidden="true" className="size-4" />
            Comparar {selected.length > 0 ? `(${selected.length}/2)` : "versões"}
          </button>
        ) : null}
      </div>

      {versions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma versão ainda. Envie o arquivo da primeira versão para começar.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {versions.map((version) => (
            <VersionCard
              key={version.id}
              version={version}
              isCurrentVersion={version.id === currentVersionId}
              isActiveDraft={version.id === activeDraftId}
              isSelected={selected.includes(version.id)}
              canSelectMore={selected.length < 2}
              comparable={versions.length >= 2}
              onToggleSelect={() => toggleSelect(version.id)}
              draftSlot={version.id === activeDraftId ? activeDraftSlot : null}
            />
          ))}
        </ul>
      )}

      {pair.length === 2 ? (
        <VersionCompareModal
          open={compareOpen}
          onOpenChange={setCompareOpen}
          a={pair[0]}
          b={pair[1]}
        />
      ) : null}
    </section>
  );
}

function VersionCard({
  version,
  isCurrentVersion,
  isActiveDraft,
  isSelected,
  canSelectMore,
  comparable,
  onToggleSelect,
  draftSlot,
}: {
  version: ControlledDocumentVersion;
  /** The in-force version (`document.currentVersionId`) — shows the "Versão atual" pill. */
  isCurrentVersion: boolean;
  /** The working draft under revision — accent-bordered, hosts `draftSlot`. */
  isActiveDraft: boolean;
  isSelected: boolean;
  canSelectMore: boolean;
  /** Only offer the compare toggle when there is more than one version to compare. */
  comparable: boolean;
  onToggleSelect: () => void;
  /** Draft-authoring / approvals / publish affordances, rendered inside this card. */
  draftSlot?: React.ReactNode;
}) {
  const obsoleteKind: ObsoleteKind | null =
    version.status === "obsolete" ? version.obsoleteKind : null;
  const accent = isCurrentVersion || isActiveDraft;

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-5",
        accent ? "border-primary/50 shadow-md" : "border-border shadow-xs",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">
              {formatVersionNumber(version.versionNumber)}
            </span>
            <DocumentStatusChip status={version.status} />
            {obsoleteKind ? <ObsoleteKindChip kind={obsoleteKind} /> : null}
            {isCurrentVersion ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Versão atual
              </span>
            ) : null}
          </div>
          {version.createdByName ? (
            <p className="text-sm text-muted-foreground">
              Por {version.createdByName} · {formatDateOnly(version.createdAt)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {comparable ? (
            <button
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              aria-label={`Selecionar ${formatVersionNumber(version.versionNumber)} para comparar`}
              disabled={!isSelected && !canSelectMore}
              onClick={onToggleSelect}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-40",
                isSelected
                  ? "border-primary bg-accent/40 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-4 items-center justify-center rounded border",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card",
                )}
              >
                {isSelected ? <Check className="size-3" /> : null}
              </span>
              Comparar
            </button>
          ) : null}
          {/* `available` is the ONE state that means a usable file is present:
              the shared predicate returns it exactly when `open_document_version`
              would serve. Every other state — including a version that HAS a
              bound core version whose bytes are still scanning, failed, or were
              disposed — gets the label instead of a control that would only
              produce a refusal. The door re-checks regardless (Rule 1). */}
          {version.availability === "available" ? (
            <OpenControlledVersionButton
              versionId={version.id}
              label="Baixar"
            />
          ) : (
            <span className="text-sm text-muted-foreground">
              {versionFileLabel(version)}
            </span>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div className="flex flex-col">
          <dt className="text-xs text-muted-foreground">Vigência</dt>
          <dd className="tabular-nums">{formatDateOnly(version.effectiveDate)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-muted-foreground">Revisão</dt>
          <dd className="tabular-nums">{formatDateOnly(version.reviewDueDate)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-muted-foreground">Expiração</dt>
          <dd className="tabular-nums">{formatDateOnly(version.expiryDate)}</dd>
        </div>
      </dl>

      {version.summaryOfChangesMd ? (
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Resumo das alterações
          </p>
          <MarkdownRenderer content={version.summaryOfChangesMd} />
        </div>
      ) : null}

      {draftSlot ? <div className="flex flex-col gap-4">{draftSlot}</div> : null}
    </li>
  );
}

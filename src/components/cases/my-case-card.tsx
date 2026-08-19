import { commissionHref } from "@/lib/routing";
import Link from "next/link";
import { ArrowRight, FileText, Layers, PenLine } from "lucide-react";

import type { MyCase, MyCaseItem } from "@/lib/queries/cases";
import { StartPhaseButton } from "@/components/cases/start-phase-button";
import { CaseRoleChip } from "@/components/cases/case-role-chip";
import { CaseStatusBadgeFixed } from "@/components/cases/case-status-badge";
import { PhaseStatusPill } from "@/components/cases/phase-status-pill";
import {
  NarrativeStatusPill,
  asNarrativeStatus,
} from "@/components/cases/narrative-status-pill";
import { ConcludeNarrativeButton } from "@/components/cases/conclude-narrative-button";
import { ContinueCorrectionButton } from "@/components/cases/continue-correction-button";
import { CorrectionStatusChip } from "@/components/cases/correction-chips";
import { CORRECTION_KIND_META } from "@/components/cases/correction-labels";
import type { CorrectionStatus } from "@/lib/queries/corrections";
import { formatCaseNumber } from "@/components/cases/format";
import type { CasePhaseStatus } from "@/lib/queries/cases";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * One card of "Meus Casos" (Case Access Control increment, ADR 0033 D7): every case
 * the member can access — attributed (a phase/narrative assignee) OR granted — one
 * per card, replacing "Minhas fases". Shows the case number + optional label, the
 * case status, and the viewer's role chip. The member's own attributed `items`
 * (phases + narratives, ordered by `displayPosition`) are listed inline with a
 * DIRECT action when actionable: "Preencher" for an active assigned phase, "Abrir"
 * (the focused editor) + "Concluir" for an open assigned narrative. The card always
 * offers "Ver caso completo" → the capability-gated staff detail page.
 *
 * A read-only case (a pure read grant, no attribution) still appears, with an empty
 * `items` list — only "Ver caso completo". Server-Component shell; the per-item
 * Preencher / Concluir are client islands.
 */
export function MyCaseCard({
  org,
  slug,
  myCase,
  index,
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  myCase: MyCase;
  index: number;
}) {
  const caseHref = commissionHref(org, slug, "casos", myCase.caseId);
  const headingId = `my-case-${myCase.caseId}-heading`;

  // Phases on this card that carry one of the viewer's OWN open corrections. The
  // corrector defaults to the target's assignee, so a viewer very commonly holds
  // BOTH items — and then the card would read "Fase 2 · Concluída" directly above
  // "Correção · Em edição". Same contradiction the phase article suppresses, same
  // resolution: the phase row drops its pill and the correction row carries the
  // state. Derived from the items already on the card — no extra read.
  const phasesInCorrection = new Set(
    myCase.items
      .filter((i) => i.kind === "correction" && i.casePhaseId != null)
      .map((i) => i.casePhaseId as string),
  );

  return (
    <article
      style={{ ["--rise-delay" as string]: `${index * 60}ms` }}
      aria-labelledby={headingId}
      className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={headingId} className="font-mono text-sm text-muted-foreground">
              {formatCaseNumber(myCase.caseNumber)}
            </h2>
            <CaseStatusBadgeFixed status={myCase.status} />
            <CaseRoleChip role={myCase.myRole} />
          </div>
          {myCase.label && (
            <p className="max-w-prose text-sm text-foreground text-pretty">
              {myCase.label}
            </p>
          )}
        </div>

        <Link
          href={caseHref}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "shrink-0",
          )}
        >
          Ver caso completo
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>

      {myCase.items.length > 0 && (
        <ul className="flex flex-col gap-2.5 border-t border-border/70 pt-4">
          {myCase.items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <MyCaseItemRow
                org={org}
                slug={slug}
                caseId={myCase.caseId}
                item={item}
                inCorrection={
                  item.kind === "phase" && phasesInCorrection.has(item.id)
                }
              />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/** One attributed item (phase, narrative or correction) inside a "Meus Casos" card. */
function MyCaseItemRow({
  org,
  slug,
  caseId,
  item,
  inCorrection,
}: {
  org: string;
  slug: string;
  caseId: string;
  item: MyCaseItem;
  /**
   * Phase items only — this phase carries one of the viewer's own open corrections,
   * which is rendered as its own row below. Suppresses this row's status pill so
   * "Concluída" doesn't contradict it (see {@link MyCaseCard}).
   */
  inCorrection: boolean;
}) {
  const Icon =
    item.kind === "phase"
      ? Layers
      : item.kind === "narrative"
        ? FileText
        : PenLine;
  // A correction takes its KIND as the row label ("Correção" / "Adendo" /
  // "Anulação") — which of the three it is changes what the corrector has to do.
  const kindLabel =
    item.kind === "phase"
      ? "Fase"
      : item.kind === "narrative"
        ? "Narrativa"
        : CORRECTION_KIND_META[item.correctionKind ?? "correction"].label;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Icon aria-hidden="true" className="size-3.5" />
            {kindLabel}
          </span>
          {item.kind === "phase" &&
            (inCorrection ? null : (
              <PhaseStatusPill status={item.status as CasePhaseStatus} />
            ))}
          {item.kind === "narrative" && (
            <NarrativeStatusPill status={asNarrativeStatus(item.status)} />
          )}
          {item.kind === "correction" && (
            <CorrectionStatusChip status={item.status as CorrectionStatus} />
          )}
        </div>
        <span className="truncate text-sm font-medium text-foreground">
          {item.title}
        </span>
      </div>

      <div className="shrink-0">
        <MyCaseItemAction org={org} slug={slug} caseId={caseId} item={item} />
      </div>
    </div>
  );
}

/**
 * The direct action for an attributed item. Only an `actionable` item gets a
 * mutating affordance (a phase `ativa`+mine → "Preencher"; a narrative `aberta`+mine
 * → "Abrir" the focused editor + a quick "Concluir"). A non-actionable item (a
 * concluded narrative, a not-yet-active phase) renders as context only.
 */
function MyCaseItemAction({
  org,
  slug,
  caseId,
  item,
}: {
  org: string;
  slug: string;
  caseId: string;
  item: MyCaseItem;
}) {
  if (item.kind === "phase") {
    // A phase is actionable only when ativa AND assigned to the viewer — the same
    // condition StartPhaseButton's server action (start_or_resume_phase) enforces.
    if (!item.actionable) return null;
    return (
      <StartPhaseButton
        org={org}
        slug={slug}
        caseId={caseId}
        phaseId={item.id}
      />
    );
  }

  if (item.kind === "correction") {
    // `actionable` already mirrors canContinueCorrection (kind ≠ void, and the
    // request is resting on the CORRECTOR). A non-actionable correction still
    // renders its row — the corrector should see the request exists and where it
    // sits — but the button belongs to the approver's turn, not theirs.
    //
    // The phase id is required, not merely expected: `start_correction_draft`
    // refuses a narrative request outright, and the responder route it lands on is
    // phase-scoped. A narrative correction is edited from the case page instead.
    if (!item.actionable || !item.casePhaseId) return null;
    return (
      <ContinueCorrectionButton
        org={org}
        slug={slug}
        caseId={caseId}
        phaseId={item.casePhaseId}
        requestId={item.id}
      />
    );
  }

  // Narrative: "Abrir" always navigates to the focused editor (read or edit per the
  // editor's own auth); when actionable (aberta + mine) also offer a quick Concluir.
  const editorHref = commissionHref(org, slug, "casos", caseId, "narrativa", item.id);
  return (
    <div className="flex items-center gap-2">
      {item.actionable && <ConcludeNarrativeButton narrativeId={item.id} />}
      <Link
        href={editorHref}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Abrir
        <ArrowRight aria-hidden="true" />
      </Link>
    </div>
  );
}

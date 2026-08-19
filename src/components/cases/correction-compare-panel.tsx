import Link from "next/link";
import { GitCompareArrows } from "lucide-react";

import { commissionHref } from "@/lib/routing";
import { cn } from "@/lib/utils";

/**
 * The side/version PICKER for the correction review screen — which of a corrected
 * phase's two submitted responses is on screen.
 *
 * Deliberately the {@link import('../process-templates/version-history-panel').VersionHistoryPanel}
 * idiom rather than a client tab set: every row is a plain `?v=` link, so switching
 * sides is a NAVIGATION, not client state. The panel ships zero JS, no server
 * function crosses a client boundary (BUG-QI-001), and the coordinator can deep-link
 * or open the two sides in separate tabs — which is how a real side-by-side read of a
 * long form actually happens on one screen.
 *
 * This panel navigates; it does not DIFF. Computing a field-level diff needs a
 * question_key-wise walk of two version trees and a rendering per answer type — a
 * feature in its own right, not a detail of this screen. Toggling shows the two
 * records exactly as they were submitted, which is what a reviewer has to sign off on.
 */

/** Which side is being shown. The `?v=` values are part of the URL contract. */
export type CorrectionCompareSide = "anterior" | "corrigida";

/** The metadata one side's row shows beneath its name. */
export interface CompareSideMeta {
  /** ISO submission timestamp, or `null` when the response is not submitted yet. */
  submittedAt: string | null;
  /** Who submitted it; `null` when the profile is gone (a removed member). */
  memberName: string | null;
}

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function timingLabel(meta: CompareSideMeta): string {
  if (!meta.submittedAt) return "Ainda não enviada";
  try {
    return `Enviada em ${DATE_FMT.format(new Date(meta.submittedAt))}`;
  } catch {
    return "Enviada";
  }
}

export function CorrectionComparePanel({
  org,
  slug,
  caseId,
  requestId,
  current,
  previous,
  corrected,
  className,
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  caseId: string;
  requestId: string;
  /** The side currently rendered in the main column — gets `aria-current`. */
  current: CorrectionCompareSide;
  /** The superseded record (`predecessor_response_id`). */
  previous: CompareSideMeta;
  /** The correction the corrector resubmitted (`draft_response_id`). */
  corrected: CompareSideMeta;
  className?: string;
}) {
  const basePath = commissionHref(
    org,
    slug,
    "manage",
    "cases",
    caseId,
    "correcoes",
    requestId,
  );

  const sides: {
    key: CorrectionCompareSide;
    label: string;
    hint: string;
    meta: CompareSideMeta;
  }[] = [
    {
      key: "corrigida",
      label: "Versão corrigida",
      hint: "O que o corretor reenviou para revisão.",
      meta: corrected,
    },
    {
      key: "anterior",
      label: "Envio anterior",
      hint: "O que estava registrado antes da correção.",
      meta: previous,
    },
  ];

  return (
    <section
      aria-labelledby="correction-compare-heading"
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <GitCompareArrows
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
        <h2 id="correction-compare-heading" className="text-sm font-semibold">
          Versões da fase
        </h2>
      </div>

      <p className="text-xs text-muted-foreground text-pretty">
        Alterne entre o envio anterior e a correção para comparar as respostas
        antes de aprovar ou reprovar.
      </p>

      <nav aria-label="Comparar versões da fase">
        <ul className="flex flex-col gap-1.5">
          {sides.map((side) => {
            const isCurrent = side.key === current;
            return (
              <li key={side.key}>
                <Link
                  href={`${basePath}?v=${side.key}`}
                  aria-current={isCurrent ? "true" : undefined}
                  className={cn(
                    "flex flex-col gap-1 rounded-xl border px-3 py-2.5 transition-[border-color,background-color] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                    isCurrent
                      ? "border-primary/50 bg-accent/40"
                      : "border-border bg-card hover:border-primary/30 hover:bg-accent/20",
                  )}
                >
                  <span className="text-sm font-semibold">{side.label}</span>
                  <span className="text-xs text-muted-foreground text-pretty">
                    {side.hint}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {timingLabel(side.meta)}
                    {side.meta.memberName ? ` · ${side.meta.memberName}` : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </section>
  );
}

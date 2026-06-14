import Link from "next/link";
import { ChevronRight, Clock, Layers } from "lucide-react";

import type { SubmissionRow as SubmissionRowData } from "@/lib/queries/submissions";

/** pt-BR date + time for a submission timestamp. */
function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * One row in the submissions browser (F4).
 *
 *  - A SUBMITTED row is a link into the version-faithful detail (F5).
 *  - An IN_PROGRESS row is METADATA-ONLY: a non-interactive row with an
 *    "em andamento" badge and NO open affordance — a staff_admin must never be
 *    able to open another member's in-progress answers (the Phase-7 invariant).
 *  - A case-phase submitted row is badged "Fase de caso" (it belongs to a case
 *    workflow, not a standalone form-fill).
 *
 * Status is conveyed by icon + text + shape, never color alone.
 */
export function SubmissionRow({
  slug,
  row,
  index,
}: {
  slug: string;
  row: SubmissionRowData;
  index: number;
}) {
  const isSubmitted = row.status === "submitted";
  const member = row.memberName ?? "Membro removido";
  const when = isSubmitted
    ? row.submittedAt
      ? `Enviada em ${formatDateTime(row.submittedAt)}`
      : "Enviada"
    : `Atualizada em ${formatDateTime(row.updatedAt)}`;

  const inner = (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{row.formTitle}</span>
          <span className="text-xs text-muted-foreground">
            v{row.versionNumber}
          </span>
          {row.isCasePhase && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-accent-foreground uppercase">
              <Layers aria-hidden="true" className="size-3" />
              Fase de caso
            </span>
          )}
          {!isSubmitted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
              <Clock aria-hidden="true" className="size-3" />
              Em andamento
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {member} · {when}
        </p>
      </div>
      {isSubmitted && (
        <ChevronRight
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground transition-transform group-hover/row:translate-x-0.5"
        />
      )}
    </>
  );

  const baseClasses =
    "animate-rise-in flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs";
  const style = { "--rise-delay": `${index * 60}ms` } as React.CSSProperties;

  if (!isSubmitted) {
    // Metadata-only: a plain, non-interactive card. No link, no answers.
    return (
      <li className={baseClasses} style={style}>
        {inner}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={`/c/${slug}/dashboard/submissions/${row.responseId}`}
        style={style}
        className="group/row flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs transition-colors hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none animate-rise-in"
      >
        {inner}
      </Link>
    </li>
  );
}

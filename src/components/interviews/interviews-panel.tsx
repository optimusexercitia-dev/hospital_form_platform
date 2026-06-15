import Link from "next/link";
import { CalendarClock, MessagesSquare } from "lucide-react";

import type { InterviewListItem } from "@/lib/queries/interviews";
import {
  InterviewModalityChip,
  InterviewStatusBadge,
} from "./interview-badges";
import {
  NewInterviewButton,
  type InterviewPhaseOption,
} from "./interview-form-dialog";
import { formatInterviewNumber, formatSchedule, interviewTitle } from "./format";

/**
 * The "Entrevistas" panel on the coordinator case-detail page (F1). Lists the
 * case's interviews newest-scheduled-first, each linking into the interview detail
 * hub; the staff_admin sees the "Nova entrevista" action. Server-Component shell —
 * the data arrives as props; only the create button is a client island.
 *
 * Discovery for plain-`staff` interviewers is via direct link only in v1 (no
 * "Minhas entrevistas" surface — noted follow-up); this panel lives on the
 * coordinator-gated case page, so `canCreate` here always implies a coordinator.
 */
export function InterviewsPanel({
  slug,
  caseId,
  interviews,
  phases,
  canCreate,
}: {
  slug: string;
  caseId: string;
  interviews: InterviewListItem[];
  /** The case's phases, for the create dialog's optional phase picker. */
  phases: InterviewPhaseOption[];
  canCreate: boolean;
}) {
  // Newest scheduled first; drafts (no start) sort to the top by created order.
  const ordered = [...interviews].sort((a, b) => {
    const sa = a.scheduledStart ?? "";
    const sb = b.scheduledStart ?? "";
    if (sa === sb) return b.createdAt.localeCompare(a.createdAt);
    return sb.localeCompare(sa);
  });

  return (
    <section
      aria-labelledby="case-interviews-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessagesSquare
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2 id="case-interviews-heading" className="text-base font-semibold">
            Entrevistas
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {interviews.length}
          </span>
        </div>
        {canCreate && (
          <NewInterviewButton slug={slug} caseId={caseId} phases={phases} />
        )}
      </div>

      {ordered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {canCreate
            ? "Nenhuma entrevista registrada. Crie a primeira entrevista deste caso."
            : "Nenhuma entrevista registrada."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {ordered.map((iv, i) => (
            <li
              key={iv.id}
              className="animate-rise-in"
              style={
                { "--rise-delay": `${i * 60}ms` } as React.CSSProperties
              }
            >
              <Link
                href={`/c/${slug}/manage/cases/${caseId}/interviews/${iv.id}`}
                className="group flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/20 p-4 transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-border hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatInterviewNumber(iv.interviewNumber)}
                    </span>
                    <span className="truncate text-sm font-medium text-foreground">
                      {interviewTitle(iv.title, iv.interviewNumber)}
                    </span>
                  </div>
                  <InterviewStatusBadge status={iv.status} />
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                  {iv.scheduledStart && (
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <CalendarClock aria-hidden="true" className="size-3.5" />
                      {formatSchedule(iv.scheduledStart, iv.scheduledEnd)}
                    </span>
                  )}
                  <InterviewModalityChip modality={iv.modality} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

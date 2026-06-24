import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getCaseDetail } from "@/lib/queries/cases";
import { getCaseTimeline } from "@/lib/queries/case-timeline";
import { CaseTimeline } from "@/components/timeline/case-timeline";
import {
  parseDensity,
  parseTypes,
  parseView,
  type ParamValue,
} from "@/components/timeline/timeline-params";

export const metadata: Metadata = {
  title: "Linha do tempo do caso",
};

/**
 * The "Linha do tempo" tab — a read-only chronological view of the case,
 * aggregating its real sub-entities (lifecycle, phases, interviews, meetings,
 * documents, action items, manual events) into ONE event array driving two
 * interchangeable layouts (Feed + Duration). The header spine + tab bar come from
 * the `(detail)` layout; this page renders only the timeline body (a small
 * section label, then the client shell).
 *
 * Coordinator-gated + commission-scoped (defense in depth; the layout gates
 * identically, both `cache()`-memoized → no extra cost). The shareable view state
 * (`view`/`density`/`types`) is decoded from `searchParams` and passed as the
 * shell's initial state, so the server's first render matches the client (no
 * hydration flash); the shell then mirrors changes back to the URL.
 */
export default async function CaseTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; commission: string; caseId: string }>;
  searchParams: Promise<Record<string, ParamValue>>;
}) {
  const { org, commission, caseId } = await params;
  const sp = await searchParams;
  const access = await getCommissionAccessByOrg(org, commission);

  if (!access || (access.role !== "staff_admin" && !access.context.isAdmin)) {
    notFound();
  }

  // Guard the case belongs to this commission BEFORE composing its timeline
  // (defends a tampered id; `getCaseDetail` is cache()-shared with the layout).
  const detail = await getCaseDetail(caseId);
  if (!detail || detail.case.commissionId !== access.commission.id) {
    notFound();
  }

  const timeline = await getCaseTimeline(caseId);

  return (
    <section aria-labelledby="timeline-heading" className="flex flex-col gap-4">
      <h2
        id="timeline-heading"
        className="text-sm font-medium tracking-wide text-muted-foreground uppercase"
      >
        Linha do tempo
      </h2>
      <CaseTimeline
        events={timeline.events}
        reference={timeline.reference}
        closedAt={timeline.closedAt}
        initialView={parseView(sp.view)}
        initialDensity={parseDensity(sp.density)}
        initialTypes={parseTypes(sp.types)}
      />
    </section>
  );
}

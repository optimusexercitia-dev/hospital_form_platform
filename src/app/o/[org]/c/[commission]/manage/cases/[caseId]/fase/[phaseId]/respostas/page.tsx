import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getCaseDetail } from "@/lib/queries/cases";
import { getResponseForFill } from "@/lib/queries/responses";
import { listCaseCorrectionRequests } from "@/lib/queries/corrections";
import { PhaseStatusPill } from "@/components/cases/phase-status-pill";
import { SupersessionBadgePill } from "@/components/dashboard/supersession-badge";
import { PhaseAnswersReadonly } from "@/components/cases/phase-answers-readonly";
import { formatCaseNumber, formatDate } from "@/components/cases/format";

export const metadata: Metadata = {
  title: "Respostas da fase",
};

/**
 * Read-only view of a completed phase's answers, for the coordinator (guardrail
 * 1, decision ii). Sourced from the phase's SUBMITTED response: `get_case_detail`
 * gives the `responseId` ONLY for `concluida` phases (the Phase-7 invariant), and
 * a staff_admin may read a submitted response + answers via RLS
 * (`responses_select` / `answers_select` line 248/283). We render with the
 * wizard's presentational answer components — NOT the Phase-8 submissions browser.
 *
 * Coordinator-gated; the case + phase must belong to this commission/case.
 */
export default async function PhaseAnswersPage({
  params,
}: {
  params: Promise<{ org: string; commission: string; caseId: string; phaseId: string }>;
}) {
  const { org, commission, caseId, phaseId } = await params;

  // These reads depend only on path params, not on each other's results.
  const [access, detail, corrections] = await Promise.all([
    getCommissionAccessByOrg(org, commission),
    getCaseDetail(caseId),
    listCaseCorrectionRequests(caseId),
  ]);

  if (!access || access.role !== "staff_admin") {
    notFound();
  }
  if (!detail || detail.case.commissionId !== access.commission.id) {
    notFound();
  }

  const phase = detail.phases.find((p) => p.id === phaseId);
  // Only a submitted (concluida) phase exposes a responseId to read.
  if (!phase || !phase.responseId) notFound();

  const response = await getResponseForFill(phase.responseId);
  if (!response || response.status !== "submitted") notFound();

  const heading = phase.title || `Fase ${phase.position}`;

  // Case Correction Lifecycle (ADR 0085): if this phase carries any APPROVED
  // correction, the answers shown here ARE the corrected (current) revision — the
  // `current_response_id` pointer already resolves to the successor. Surface the
  // supersession chain with the shared "Atual" pill (SUP/ADR 0074). `[]` when the
  // `case_corrections` flag is off (no badge).
  const wasCorrected = corrections.some(
    (r) => r.casePhaseId === phaseId && r.status === "approved",
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          href={commissionHref(org, commission, "manage", "cases", caseId)}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {formatCaseNumber(detail.case.caseNumber)}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl text-balance">{heading}</h1>
          <PhaseStatusPill status={phase.status} />
          {wasCorrected && <SupersessionBadgePill badge="atual" />}
        </div>
        <p className="text-sm text-muted-foreground">
          {response.formTitle}
          {phase.submittedAt ? ` · Enviada em ${formatDate(phase.submittedAt)}` : ""}
        </p>
        {wasCorrected && (
          <p className="text-sm text-muted-foreground text-pretty">
            Esta fase foi corrigida — estas são as respostas atuais. O envio anterior
            fica preservado no histórico da solicitação de correção.
          </p>
        )}
      </header>

      <PhaseAnswersReadonly response={response} />
    </div>
  );
}

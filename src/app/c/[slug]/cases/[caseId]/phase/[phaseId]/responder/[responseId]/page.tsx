import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCommissionAccess } from "@/lib/queries/session";
import { getResponseForFill } from "@/lib/queries/responses";
import { getCasePhaseForFill } from "@/lib/queries/cases";
import { getResponseSignoffs } from "@/lib/queries/signoffs";
import { WizardRunner } from "@/components/responses/wizard/wizard-runner";
import { ConfirmationScreen } from "@/components/responses/wizard/confirmation-screen";
import {
  resolveImageUrls,
  toWizardData,
} from "@/components/responses/wizard/prepare";

export const metadata: Metadata = {
  title: "Preencher fase",
};

/**
 * The phase-fill wizard route (F5). Reuses the UNCHANGED wizard: loads the
 * phase's in_progress response (created/resumed by `start_or_resume_phase`),
 * gated by commission membership. The response read is RLS-scoped to the caller's
 * own in_progress responses, so a foreign or cross-commission `responseId`
 * returns null → `notFound()` with no data leak — this is what enforces "the
 * assignee fills only their own phase" at the fill route.
 *
 * A SUBMITTED phase response is immutable (the phase is now `concluida`); we show
 * the confirmation rather than an editable wizard, linking back to "Minhas
 * fases". The coordinator reviews a completed phase's answers from the case
 * detail (a separate read-only route).
 */
export default async function PhaseResponderPage({
  params,
}: {
  params: Promise<{
    slug: string;
    caseId: string;
    phaseId: string;
    responseId: string;
  }>;
}) {
  const { slug, caseId, phaseId, responseId } = await params;
  const access = await getCommissionAccess(slug);
  if (!access) notFound();

  const response = await getResponseForFill(responseId);
  // null = not found OR not the caller's (RLS). Either way: 404.
  if (!response) notFound();

  // Never trust the path's commission over the row.
  if (response.commissionId !== access.commission.id) notFound();

  // Defend the path: confirm the phase is readable, belongs to the path's case,
  // and binds the same form as the loaded response — so a tampered case/phase id
  // can't dress up an unrelated response with the wrong case context.
  const fill = await getCasePhaseForFill(phaseId);
  if (
    !fill ||
    fill.phase.caseId !== caseId ||
    fill.phase.formId !== response.formId
  ) {
    notFound();
  }

  const backHref = `/c/${slug}/minhas-fases`;

  if (response.status === "submitted") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <ConfirmationScreen slug={slug} formTitle={response.formTitle} />
      </div>
    );
  }

  const signoffs = await getResponseSignoffs(responseId);
  const data = toWizardData(
    response,
    slug,
    access.context.fullName ?? "Você",
    signoffs,
  );
  const imageUrls = await resolveImageUrls(response);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Minhas fases
        </Link>
        <h1 className="text-3xl text-balance">{response.formTitle}</h1>
      </header>

      <WizardRunner data={data} imageUrls={imageUrls} />
    </div>
  );
}

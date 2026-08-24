import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PencilLine } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getResponseForFill } from "@/lib/queries/responses";
import { getCasePhaseForFill } from "@/lib/queries/cases";
import { getResponseSignoffs } from "@/lib/queries/signoffs";
import { listCaseCorrectionRequests } from "@/lib/queries/corrections";
import { resolveTreeImageUrls } from "@/lib/queries/forms";
import { isOpenCorrection } from "@/components/cases/correction-labels";
import { WizardRunner } from "@/components/responses/wizard/wizard-runner";
import { ConfirmationScreen } from "@/components/responses/wizard/confirmation-screen";
import { toWizardData } from "@/components/responses/wizard/prepare";
import { featureEnabled } from "@/lib/queries/feature-flags";

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
  params: Promise<{ org: string; commission: string;
    caseId: string;
    phaseId: string;
    responseId: string;
  }>;
}) {
  const { org, commission, caseId, phaseId, responseId } = await params;
  const slug = commission;

  // The three reads below only depend on path params, not on each other's
  // results — fetch them concurrently instead of three sequential RTTs.
  const [access, response, fill] = await Promise.all([
    getCommissionAccessByOrg(org, commission),
    getResponseForFill(responseId),
    getCasePhaseForFill(phaseId),
  ]);
  if (!access || access.role === null) notFound();

  // null = not found OR not the caller's (RLS). Either way: 404.
  if (!response) notFound();

  // Never trust the path's commission over the row.
  if (response.commissionId !== access.commission.id) notFound();

  // Defend the path: confirm the phase is readable, belongs to the path's case,
  // and binds the same form as the loaded response — so a tampered case/phase id
  // can't dress up an unrelated response with the wrong case context.
  if (
    !fill ||
    fill.phase.caseId !== caseId ||
    fill.phase.formId !== response.formId
  ) {
    notFound();
  }

  const backHref = commissionHref(org, commission, "minhas-fases");

  if (response.status === "submitted") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <ConfirmationScreen org={org} slug={slug} formTitle={response.formTitle} />
      </div>
    );
  }

  // Case Correction Lifecycle (ADR 0085): is this draft a CORRECTION? An OPEN
  // correction request pointing at THIS draft response (set by `start_correction_draft`
  // before "Continuar correção" routed here) means the corrector is revising a
  // completed phase, not first-filling it. `listCaseCorrectionRequests` no-ops (`[]`)
  // when the `case_corrections` flag is off, so this is a single indexed read only on
  // flag-on installs; a plain first-fill resolves `correction = null`.
  const openCorrection = (await listCaseCorrectionRequests(caseId)).find(
    (r) => r.draftResponseId === responseId && isOpenCorrection(r.status),
  );
  const correction = openCorrection
    ? {
        requestId: openCorrection.id,
        // A route every corrector can reach (staff or staff_admin) — the case-detail
        // management route is staff_admin-gated. String href, never a closure (BUG-QI-001).
        doneHref: commissionHref(org, commission, "meus-casos"),
      }
    : null;

  const signoffs = await getResponseSignoffs(responseId);
  // Thread the case-phase RESULT context (phase-results feature) so the wizard's
  // end-of-wizard override panel renders. `getCasePhaseForFill` returns `result:
  // null` when the feature is off, leaving the panel hidden. In CORRECTION mode the
  // panel is suppressed entirely (the recompute is owned by `approve_correction`), so
  // pass no result context and hand the wizard the correction context instead.
  // ADR 0136 — resolve the deferral HERE, on the server. This page is by
  // definition the case-phase lane (D2), so the flag alone decides. ⛔ Without
  // this the wizard's own submit gate keeps the button `disabled` no matter what
  // the database allows, and the feature is unreachable in the product.
  const deferStaffSignoff = await featureEnabled("deferred_staff_signoff");
  const data = toWizardData(
    response,
    org,
    slug,
    access.context.fullName ?? "Você",
    access.context.email,
    access.commission.name,
    signoffs,
    correction ? null : { casePhaseId: fill.phase.id, result: fill.result },
    correction,
    deferStaffSignoff,
  );
  const imageUrls = await resolveTreeImageUrls(response.tree);

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

      {correction && (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-2xl border border-border bg-accent p-4 text-sm text-accent-foreground"
        >
          <PencilLine aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p className="text-pretty">
            Você está <strong>corrigindo o envio anterior</strong> desta fase. As
            respostas já vêm preenchidas com o conteúdo registrado — ajuste o que for
            necessário e envie para revisão. O envio original é preservado até a
            aprovação.
          </p>
        </div>
      )}

      <WizardRunner data={data} imageUrls={imageUrls} />
    </div>
  );
}

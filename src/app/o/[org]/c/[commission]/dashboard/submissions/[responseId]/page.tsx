import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Layers } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getSubmissionDetail } from "@/lib/queries/submissions";
import { resolveTreeImageUrls } from "@/lib/queries/forms";
import { SubmissionDetailView } from "@/components/dashboard/submission-detail-view";
import { SupersessionBadgePill } from "@/components/dashboard/supersession-badge";
import { CorrectSubmissionButton } from "@/components/dashboard/correct-submission-button";
import { PrintedDocumentsSection } from "@/components/printing/printed-documents-panel";
import { supersedeResponseAction } from "@/lib/responses/actions";
import { featureEnabled } from "@/lib/queries/feature-flags";
import { getResponsePrintContext } from "@/lib/queries/printed-documents";
import {
  printSourceRegisters,
  printSourceWatermark,
} from "@/lib/pdf/documents/print-source";
import {
  mintPrintedDocument,
  revokePrintedDocument,
} from "@/lib/pdf-mint/actions";
import { PDF_PROVIDERS } from "@/lib/pdf-mint/providers";

export const metadata: Metadata = {
  title: "Resposta enviada",
};

/**
 * Version-faithful, read-only detail of one submitted response (F5).
 *
 * Security: the page is staff_admin-gated, AND `getSubmissionDetail` returns
 * `null` for anything the caller may not read — a foreign-commission response, a
 * foreign member's in_progress response (the Phase-7 invariant), or a missing
 * id. We ALSO defensively confirm the detail's commission matches the slug. Any
 * of these → the friendly in-shell 404 with no data leakage (mirrors
 * `PhaseAnswersPage`).
 */
export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ org: string; commission: string; responseId: string }>;
}) {
  const { org, commission, responseId } = await params;
  const access = await getCommissionAccessByOrg(org, commission);

  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  // Independent reads — the flag lookup must not queue behind the detail fetch.
  // This screen is authenticated, so it uses the ordinary request-memoized
  // reader (the service-role `documentPrintingEnabled()` exists for the public
  // `/verificar` pages, which have no session to read flags with).
  const [detail, printingEnabled] = await Promise.all([
    getSubmissionDetail(responseId),
    featureEnabled("document_printing"),
  ]);
  if (!detail || detail.commissionId !== access.commission.id) {
    notFound();
  }

  const imageUrls = await resolveTreeImageUrls(detail.tree);
  const member = detail.memberName ?? "Membro removido";
  const isSubmitted = detail.status === "submitted";

  // ADR 0125 D1 + Amendment 2 · ADR 0126 D5/D10 — BOTH print axes derive from
  // the same source state, read once here and passed to the panel as one object
  // so the two arguments cannot drift apart.
  //
  // ⛔ Fails CLOSED: a null context (RLS withheld, or the row vanished between
  // reads) yields `correctionOpen: true`, which makes the source non-registering
  // and offers a PRÉVIA. That is the safe direction on both counts — paper is
  // still available (D2's protected interest), and nothing enters the registry
  // on state we could not confirm.
  const printContext = printingEnabled
    ? await getResponsePrintContext(responseId)
    : null;
  const printState = {
    status: detail.status,
    correctionOpen: printContext?.correctionOpen ?? true,
    phaseVoided: printContext?.phaseVoided ?? true,
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          href={commissionHref(org, commission, "dashboard", "submissions")}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Respostas enviadas
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl text-balance">{detail.formTitle}</h1>
          <span className="text-sm text-muted-foreground">
            v{detail.versionNumber}
          </span>
          {detail.isCasePhase && (
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
          <SupersessionBadgePill badge={detail.badge} />
        </div>
        <p className="text-sm text-muted-foreground">
          {member}
          {detail.submittedAt
            ? ` · Enviada em ${formatDateTime(detail.submittedAt)}`
            : ""}
        </p>
        {detail.canCorrect && (
          <div>
            <CorrectSubmissionButton
              responseId={detail.responseId}
              formId={detail.formId}
              org={org}
              slug={commission}
              action={supersedeResponseAction}
            />
          </div>
        )}
      </header>

      <SubmissionDetailView
        tree={detail.tree}
        answersByItemId={detail.answersByItemId}
        answersByKey={detail.answersByKey}
        observationsByItemId={detail.observationsByItemId}
        otherTextByItemId={detail.otherTextByItemId}
        matrixCellsByItemId={detail.matrixCellsByItemId}
        riskMatrixByItemId={detail.riskMatrixByItemId}
        referencesByItemId={detail.referencesByItemId}
        instances={detail.instances}
        signoffs={detail.signoffs}
        imageUrls={imageUrls}
      />

      {/* Printed documents (PDF·P1; ADR 0104). Flag-gated platform-wide.
          `canRevoke` reuses THIS page's existing staff_admin gate (asserted at
          the top) rather than introducing a second permission signal — ADR 0104
          D11 puts revocation with `staff_admin` of the owning commission, which
          is exactly who can reach this screen at all. The server action
          re-checks it regardless; hiding the affordance is not the control. */}
      {printingEnabled ? (
        <PrintedDocumentsSection
          sourceKind="form_response"
          sourceId={detail.responseId}
          registers={printSourceRegisters("form_response", printState)}
          watermark={printSourceWatermark("form_response", printState)}
          scopeLabel={`${detail.formTitle} · versão ${detail.versionNumber}`}
          canRevoke={access.role === "staff_admin"}
          // Read from the provider registry, NOT written as a literal `false`
          // (ADR 0104 D9). A literal would be correct today and silently wrong
          // the day this kind's provider gained the capability — and nothing
          // would fail: the backend would honour `includePhi` while the screen
          // offered no way to ask for it.
          phiCapable={PDF_PROVIDERS.form_response?.phiCapable ?? false}
          mintAction={mintPrintedDocument}
          revokeAction={revokePrintedDocument}
        />
      ) : null}
    </div>
  );
}

/** pt-BR date + time. */
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

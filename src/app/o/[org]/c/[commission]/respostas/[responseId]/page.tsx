import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Layers } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getSubmissionDetail } from "@/lib/queries/submissions";
import { resolveTreeImageUrls } from "@/lib/queries/forms";
import { SubmissionDetailView } from "@/components/dashboard/submission-detail-view";
import { SupersessionBadgePill } from "@/components/dashboard/supersession-badge";
import { PrintedDocumentsSection } from "@/components/printing/printed-documents-panel";
import { featureEnabled } from "@/lib/queries/feature-flags";
import {
  mintPrintedDocument,
  revokePrintedDocument,
} from "@/lib/pdf-mint/actions";

export const metadata: Metadata = {
  title: "Resposta enviada",
};

/**
 * The RESPONDENT's read-only view of one of their own submitted responses —
 * the creator-side twin of the staff_admin screen at
 * `…/dashboard/submissions/[responseId]` (FUP-PDF-1).
 *
 * Why it exists: ADR 0104 D11 grants mint to *anyone who can view the source*,
 * and the doors already honour that (`app.can_view_printed_document`'s
 * `form_response` arm opens on `created_by = uid`). But the only response-detail
 * screen was wholly `staff_admin`-gated, so a respondent had no surface from
 * which to print their own submission. The door was never over-tight; the UI was
 * under-built. This route is that surface, and it also retires the long-standing
 * "the full read-only viewer arrives in Phase 7" placeholder — a submitted row
 * in "Minhas respostas" used to lead back to the wizard's confirmation screen.
 *
 * Authority: membership of the commission, then RLS. We deliberately do NOT
 * re-derive "is the caller the creator" here — `getSubmissionDetail` returns
 * `null` for anything `responses_select` withholds, and RLS is the boundary
 * (Rule 1). The practical effect is creator-only for `staff`; a `staff_admin`
 * arriving with a foreign id sees the same content their own dashboard screen
 * would show, and `getSubmissionDetail` emits the `response.opened_foreign`
 * audit row exactly as it does there (Rule 11).
 *
 * Deliberately ABSENT: "Corrigir envio". `detail.canCorrect` can be true here for
 * a staff_admin viewing their own submission, but correction is an admin act and
 * its affordance stays on the admin screen — one home per governance action, the
 * same reasoning that keeps `canRevoke` there. Omission, not oversight.
 *
 * ⚠ `notFound()` below this segment's `loading.tsx` renders the not-found UI
 * with HTTP 200 — Next's streamed-notFound contract, by design, not a bug here.
 */
export default async function MyResponseDetailPage({
  params,
}: {
  params: Promise<{ org: string; commission: string; responseId: string }>;
}) {
  const { org, commission, responseId } = await params;
  const access = await getCommissionAccessByOrg(org, commission);

  // Any member may reach the route; RLS decides which response they see.
  if (!access || access.role === null) notFound();

  // Independent reads — the flag lookup must not queue behind the detail fetch.
  const [detail, printingEnabled] = await Promise.all([
    getSubmissionDetail(responseId),
    featureEnabled("document_printing"),
  ]);
  // null = missing OR withheld by RLS; the commission check defends a tampered
  // path. Either way: the friendly in-shell 404 with no data leakage.
  if (!detail || detail.commissionId !== access.commission.id) notFound();

  // An in_progress response is a draft, not a record — send the respondent back
  // into the wizard to resume rather than showing a half-filled "envio". No
  // loop risk: the wizard route's inverse branch RENDERS for a submitted
  // response (its confirmation screen), it does not redirect here.
  if (detail.status !== "submitted") {
    redirect(
      commissionHref(
        org,
        commission,
        "forms",
        detail.formId,
        "responder",
        detail.responseId,
      ),
    );
  }

  const imageUrls = await resolveTreeImageUrls(detail.tree);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          href={commissionHref(org, commission, "respostas")}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Minhas respostas
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
          <SupersessionBadgePill badge={detail.badge} />
        </div>
        <p className="text-sm text-muted-foreground">
          {detail.memberName ?? "Membro removido"}
          {detail.submittedAt
            ? ` · Enviada em ${formatDateTime(detail.submittedAt)}`
            : ""}
        </p>
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

      {/* Printed documents (ADR 0104 D11 — mint follows source sight, which is
          precisely why this screen exists). Always `final`: the redirect above
          means only a SUBMITTED response reaches here. `canRevoke` stays with
          `staff_admin` of the owning commission — revocation is a governance
          act, not the minter's undo (D11) — and the server action re-checks it
          regardless, since a hidden button is not a control (Rule 1). */}
      {printingEnabled ? (
        <PrintedDocumentsSection
          sourceKind="form_response"
          sourceId={detail.responseId}
          watermark="final"
          scopeLabel={`${detail.formTitle} · versão ${detail.versionNumber}`}
          canRevoke={access.role === "staff_admin"}
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

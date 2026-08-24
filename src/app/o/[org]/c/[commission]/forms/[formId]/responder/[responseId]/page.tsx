import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getResponseForFill } from "@/lib/queries/responses";
import { getResponseSignoffs } from "@/lib/queries/signoffs";
import { resolveTreeImageUrls } from "@/lib/queries/forms";
import { WizardRunner } from "@/components/responses/wizard/wizard-runner";
import { ConfirmationScreen } from "@/components/responses/wizard/confirmation-screen";
import { toWizardData } from "@/components/responses/wizard/prepare";

export const metadata: Metadata = {
  title: "Preencher formulário",
};

/**
 * The wizard route (F2). Loads one in_progress response for the wizard, gated
 * by commission membership (staff AND staff_admin both fill). The response read
 * is RLS-scoped to the caller's own in_progress responses, so a foreign or
 * cross-commission `responseId` returns null → `notFound()` with no data leak.
 *
 * A SUBMITTED response is immutable — it can't be filled, so we redirect to the
 * read-only history ("minhas respostas") rather than render an editable wizard.
 */
export default async function ResponderPage({
  params,
}: {
  params: Promise<{ org: string; commission: string; formId: string; responseId: string }>;
}) {
  const { org, commission, formId, responseId } = await params;
  const slug = commission;

  // Both reads depend only on path params, not on each other's results.
  const [access, response] = await Promise.all([
    getCommissionAccessByOrg(org, commission),
    getResponseForFill(responseId),
  ]);

  // Any member (staff or staff_admin) or a global admin may fill.
  if (!access || access.role === null) notFound();

  // null = not found OR not visible to the caller (RLS). Either way: 404.
  if (!response) notFound();

  // Defend against a tampered URL where the path's formId/commission doesn't
  // match the response — never trust the path over the row.
  if (response.formId !== formId || response.commissionId !== access.commission.id) {
    notFound();
  }

  // ⛔ THIS ROUTE SERVES THE STANDALONE LANE ONLY (ADR 0136 /
  // FUP-DSS-STANDALONE-ROUTE-DISABLES-SUBMIT). A case-phase response satisfies
  // every guard above — its form IS `formId`, its commission IS the caller's —
  // so nothing structural kept it off this route, and `getResponseForFill`
  // filters on `id` alone. The lane is a property of the ROW, so read it there.
  //
  // Why refuse rather than adapt: `deferStaffSignoff` is resolved on the
  // case-phase route only, so the same response rendered here shows a DISABLED
  // submit for a submit `submit_response` would accept — one response, two
  // behaviours, chosen by which URL was typed. Everything else on this page is
  // written for the standalone lane too (the "Formulários" back-link, the
  // confirmation screen's onward link), so serving a case phase here was always
  // wrong; the deferral is what made it visible.
  if (response.casePhaseId !== null) notFound();

  // A submitted response is immutable — it can't be filled. We render the
  // confirmation here (rather than redirecting) so that the post-submit
  // revalidation of this route lands on the confirmation screen instead of
  // racing the client `ConfirmationScreen` with a redirect. The full read-only,
  // version-faithful viewer for a submitted response is Phase 7; for now this
  // confirms the submission and links onward to the history.
  if (response.status === "submitted") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <ConfirmationScreen org={org} slug={slug} formTitle={response.formTitle} />
      </div>
    );
  }

  // Existing sign-off rows for this response (F3) — loaded separately since the
  // backend did NOT extend `getResponseForFill`. RLS-scoped: the creator always
  // sees their own respondent sign-off plus any staff_admin counter-signs.
  const signoffs = await getResponseSignoffs(responseId);

  const data = toWizardData(
    response,
    org,
    slug,
    access.context.fullName ?? "Você",
    access.context.email,
    access.commission.name,
    signoffs,
  );
  const imageUrls = await resolveTreeImageUrls(response.tree);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href={commissionHref(org, commission, "forms")}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Formulários
        </Link>
        <h1 className="text-3xl text-balance">{response.formTitle}</h1>
      </header>

      <WizardRunner data={data} imageUrls={imageUrls} />
    </div>
  );
}

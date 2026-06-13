import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getCommissionAccess } from "@/lib/queries/session";
import { getResponseForFill } from "@/lib/queries/responses";
import { WizardRunner } from "@/components/responses/wizard/wizard-runner";
import { ConfirmationScreen } from "@/components/responses/wizard/confirmation-screen";
import {
  resolveImageUrls,
  toWizardData,
} from "@/components/responses/wizard/prepare";

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
  params: Promise<{ slug: string; formId: string; responseId: string }>;
}) {
  const { slug, formId, responseId } = await params;
  const access = await getCommissionAccess(slug);

  // Any member (staff or staff_admin) or a global admin may fill.
  if (!access) notFound();

  const response = await getResponseForFill(responseId);
  // null = not found OR not visible to the caller (RLS). Either way: 404.
  if (!response) notFound();

  // Defend against a tampered URL where the path's formId/commission doesn't
  // match the response — never trust the path over the row.
  if (response.formId !== formId || response.commissionId !== access.commission.id) {
    notFound();
  }

  // A submitted response is immutable — it can't be filled. We render the
  // confirmation here (rather than redirecting) so that the post-submit
  // revalidation of this route lands on the confirmation screen instead of
  // racing the client `ConfirmationScreen` with a redirect. The full read-only,
  // version-faithful viewer for a submitted response is Phase 7; for now this
  // confirms the submission and links onward to the history.
  if (response.status === "submitted") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <ConfirmationScreen slug={slug} formTitle={response.formTitle} />
      </div>
    );
  }

  const data = toWizardData(response, slug);
  const imageUrls = await resolveImageUrls(response);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href={`/c/${slug}/forms`}
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

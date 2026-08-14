import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { listApproverCandidates, listDocuments } from "@/lib/queries/controlled-documents";
import type { DocType } from "@/lib/controlled-documents/types";
import { commissionHref } from "@/lib/routing";
import { CreateWizard } from "@/components/controlled-documents/create-wizard";

export const metadata: Metadata = {
  title: "Novo documento controlado",
};

const DOC_TYPES = new Set<DocType>([
  "policy",
  "sop",
  "protocol",
  "bylaws",
  "manual",
  "other",
]);

/** Validate a raw `?docType=` param against the known union, else drop it. */
function asDocType(value: string | undefined): DocType | undefined {
  return value && DOC_TYPES.has(value as DocType)
    ? (value as DocType)
    : undefined;
}

/**
 * New controlled document (Phase 17 v2, F-B — create). Coordinator area (flag +
 * role gated by the layout). The wizard collects everything, then DRIVES the
 * chain itself (DM3·S2): `createDraftOnly` → begin → client PUT → finalize →
 * `submitDocumentForApproval`, or stops after the create+upload legs for the
 * "Salvar rascunho" exit (`allowDraftExit`).
 *
 * This Server Component's job is now only to load the approver candidates and
 * the existing categories. It no longer binds actions: `createAndSubmitDocument`
 * and `createDraftOnly` used to be passed down as props, but the terminal step
 * can no longer be one server action — bytes move client-side to a signed
 * credential, and the upload cannot begin until the version exists.
 */
export default async function NewDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; commission: string }>;
  searchParams: Promise<{ docType?: string }>;
}) {
  const { org, commission } = await params;
  const { docType } = await searchParams;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const commissionId = access.commission.id;
  const [candidates, documents] = await Promise.all([
    listApproverCandidates(commissionId),
    listDocuments(commissionId),
  ]);

  const categories = Array.from(
    new Set(
      documents
        .map((d) => d.category)
        .filter((c): c is string => c != null && c.trim() !== ""),
    ),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const listHref = commissionHref(org, commission, "manage", "documentos");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <Link
          href={listHref}
          className="inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Voltar aos documentos
        </Link>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {access.commission.name}
          </p>
          <h1 className="text-3xl text-balance">Novo documento controlado</h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Preencha os detalhes, anexe o arquivo e indique os aprovadores. Ao
            enviar, o documento entra em aprovação; você também pode salvar como
            rascunho.
          </p>
        </div>
      </header>

      <CreateWizard
        org={org}
        commission={commission}
        commissionId={commissionId}
        candidates={candidates}
        categories={categories}
        defaultDocType={asDocType(docType)}
        allowDraftExit
      />
    </div>
  );
}

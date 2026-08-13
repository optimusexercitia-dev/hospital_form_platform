import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getDocument } from "@/lib/queries/controlled-documents";
import { updateControlledDocument } from "@/lib/controlled-documents/actions";
import { selectWorkingDraft } from "@/lib/controlled-documents/version-select";
import { commissionHref } from "@/lib/routing";
import { DocumentEditor } from "@/components/controlled-documents/document-editor";

export const metadata: Metadata = {
  title: "Editar documento controlado",
};

/**
 * Edit a controlled document's header (Phase 17, F2 — edit). Coordinator area
 * (flag + role gated by the layout). Edits title/type/review-cycle; the RPC allows
 * this ONLY while the document's current version is `rascunho` (HC089 otherwise, a
 * pt-BR message surfaced by the editor). The document FILE is managed as a version
 * on the detail page, not here.
 */
export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ org: string; commission: string; documentId: string }>;
}) {
  const { org, commission, documentId } = await params;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const detail = await getDocument(documentId);
  if (!detail || detail.document.commissionId !== access.commission.id) {
    notFound();
  }

  // Header edit is only valid while the document has an open `rascunho` working
  // draft — the sole state `update_controlled_document` accepts (HC089 otherwise).
  // 404 cleanly for a doc past that state (e.g. `vigente`/`em_aprovacao`/`obsoleto`
  // reached by URL) rather than rendering the editor and letting the action fail
  // with a generic error. Mirrors the other coordinator routes' state gating.
  const workingDraft = selectWorkingDraft(detail.versions);
  if (!workingDraft || workingDraft.status !== "draft") {
    notFound();
  }

  const listHref = commissionHref(org, commission, "manage", "documentos");
  const detailHref = commissionHref(
    org,
    commission,
    "manage",
    "documentos",
    documentId,
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <Link
          href={detailHref}
          className="inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Voltar ao documento
        </Link>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {access.commission.name}
          </p>
          <h1 className="text-3xl text-balance">Editar documento</h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Ajuste o título, o tipo e o ciclo de revisão. A edição só é possível
            enquanto a versão atual está em rascunho.
          </p>
        </div>
      </header>

      <DocumentEditor
        updateAction={updateControlledDocument}
        commissionId={access.commission.id}
        org={org}
        commission={commission}
        listHref={listHref}
        existing={detail.document}
      />
    </div>
  );
}

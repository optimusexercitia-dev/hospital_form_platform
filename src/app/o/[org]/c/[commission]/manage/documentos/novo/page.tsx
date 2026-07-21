import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { createControlledDocument } from "@/lib/documents/actions";
import type { DocType } from "@/lib/documents/types";
import { commissionHref } from "@/lib/routing";
import { DocumentEditor } from "@/components/documents/document-editor";

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
 * New controlled document (Phase 17, F2 — create). Coordinator area (flag + role
 * gated by the layout). Creates the header + its initial `rascunho` version, then
 * routes to the detail view where the author uploads the first version file (the
 * atomic `addDocumentVersion` upload).
 *
 * The action is imported here (a Server Component) and passed as a prop to the
 * client editor — the client never value-imports the `"use server"` module.
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
            Defina o título, o tipo e o ciclo de revisão. Depois de criado, envie
            o arquivo da primeira versão na página do documento.
          </p>
        </div>
      </header>

      <DocumentEditor
        createAction={createControlledDocument}
        commissionId={access.commission.id}
        org={org}
        commission={commission}
        listHref={listHref}
        defaultDocType={asDocType(docType)}
      />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Plus } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import {
  listDocuments,
  type DocumentListFilters,
} from "@/lib/queries/documents";
import type { DocStatus, DocType } from "@/lib/documents/types";
import { commissionHref } from "@/lib/routing";
import { Button } from "@/components/ui/button";
import { DocumentRegisterList } from "@/components/documents/document-register-list";
import { DocumentFilterBar } from "@/components/documents/document-filter-bar";

export const metadata: Metadata = {
  title: "Documentos controlados",
};

const DOC_TYPES = new Set<DocType>([
  "politica",
  "pop",
  "protocolo",
  "regimento",
  "manual",
  "outro",
]);
const DOC_STATUSES = new Set<DocStatus>([
  "draft",
  "in_approval",
  "effective",
  "obsolete",
]);

/** Validate a raw URL param against a known union, else drop it (null). */
function asDocType(value: string | undefined): DocType | null {
  return value && DOC_TYPES.has(value as DocType) ? (value as DocType) : null;
}
function asDocStatus(value: string | undefined): DocStatus | null {
  return value && DOC_STATUSES.has(value as DocStatus)
    ? (value as DocStatus)
    : null;
}

/**
 * Controlled-document register (Phase 17, F1). Coordinator area — the flag + role
 * are enforced by the `manage/documentos` layout. Lists the commission's
 * documents with a derived status chip and review-due state. All filters are
 * URL-driven so this stays a Server Component that re-queries.
 *
 * `listDocuments` returns `ControlledDocumentListItem` (each with the embedded
 * current-version summary), so the list renders the status chip + review-due flag
 * WITHOUT a per-document detail round trip.
 */
export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; commission: string }>;
  searchParams: Promise<{
    docType?: string;
    status?: string;
    reviewOverdue?: string;
  }>;
}) {
  const { org, commission } = await params;
  const sp = await searchParams;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const docType = asDocType(sp.docType);
  const status = asDocStatus(sp.status);
  const reviewOverdue = sp.reviewOverdue === "1";

  const filters: DocumentListFilters = {
    docType: docType ?? undefined,
    status: status ?? undefined,
    reviewOverdueOnly: reviewOverdue || undefined,
  };

  const documents = await listDocuments(access.commission.id, filters);
  const hasFilters = Boolean(docType || status || reviewOverdue);

  const newHref = commissionHref(
    org,
    commission,
    "manage",
    "documentos",
    "novo",
  );
  const reviewsHref = commissionHref(
    org,
    commission,
    "manage",
    "documentos",
    "revisoes",
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {access.commission.name}
          </p>
          <h1 className="text-3xl text-balance">Documentos controlados</h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Políticas, POPs, protocolos e regimentos desta comissão sob controle
            de versão, aprovação por assinatura, vigência e ciclo de revisão.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href={newHref}>
              <Plus aria-hidden="true" className="size-4" />
              Novo documento
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={reviewsHref}>
              <CalendarClock aria-hidden="true" className="size-4" />
              Revisões pendentes
            </Link>
          </Button>
        </div>
      </header>

      <DocumentFilterBar
        docType={docType}
        status={status}
        reviewOverdue={reviewOverdue}
      />

      <DocumentRegisterList
        documents={documents}
        org={org}
        commission={commission}
        hasFilters={hasFilters}
      />
    </div>
  );
}

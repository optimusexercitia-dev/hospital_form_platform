import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Plus } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { listDocuments } from "@/lib/queries/controlled-documents";
import type { ControlledDocumentListItem } from "@/lib/controlled-documents/types";
import { commissionHref } from "@/lib/routing";
import { Button } from "@/components/ui/button";
import type { DerivedDocStatus } from "@/components/controlled-documents/document-badges";
import {
  DocumentKpiStrip,
  type DocumentKpis,
} from "@/components/controlled-documents/document-kpi-strip";
import { DocumentRegisterFilters } from "@/components/controlled-documents/document-register-filters";
import {
  DocumentRegisterTable,
  type ApprovalProgress,
  type RegisterItem,
} from "@/components/controlled-documents/document-register-table";

export const metadata: Metadata = {
  title: "Documentos controlados",
};

/** Resolve the display status, promoting an `effective` doc under revision. */
function deriveStatus(doc: ControlledDocumentListItem): DerivedDocStatus {
  if (doc.status === "effective" && doc.hasOpenRevision) return "revision";
  return doc.status;
}

/**
 * The `in_approval` approval mini-bar progress, sourced from the list contract
 * (Wave 2.5a — `list_commission_documents` computes signed/total DB-side, removing
 * the former `getDocument` N+1). `undefined` unless the doc is `in_approval`. A
 * version in `in_approval` carries no rejection by construction (a single rejection
 * returns it to `draft`), so `hasRejection` is always false here.
 */
function approvalProgress(
  doc: ControlledDocumentListItem,
): ApprovalProgress | undefined {
  if (doc.status !== "in_approval") return undefined;
  return {
    approved: doc.approvalsSignedCount,
    total: doc.approvalsTotalCount,
    hasRejection: false,
  };
}

/** Does a register item match the active `view` chip? */
function matchesView(item: RegisterItem, view: string): boolean {
  switch (view) {
    case "awaiting":
      return item.status === "in_approval";
    case "effective":
      return item.derivedStatus === "effective";
    case "draft":
      return item.status === "draft";
    case "revision":
      return item.derivedStatus === "revision";
    case "archived":
      return item.status === "obsolete";
    default:
      return true;
  }
}

/**
 * Controlled-document register (Phase 17 v2, F-A). Coordinator area — the flag +
 * role are enforced by the `manage/documentos` layout. The full list is fetched
 * once (KPIs + category autocomplete need the whole set); the view/search/category
 * filters are applied in-memory so the KPI strip always reflects the complete
 * register. All filters are URL-driven, keeping this a Server Component.
 */
export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; commission: string }>;
  searchParams: Promise<{ view?: string; q?: string; category?: string }>;
}) {
  const { org, commission } = await params;
  const sp = await searchParams;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const documents = await listDocuments(access.commission.id);

  const allItems: RegisterItem[] = documents.map((doc) => ({
    ...doc,
    derivedStatus: deriveStatus(doc),
    approval: approvalProgress(doc),
  }));

  const kpis: DocumentKpis = {
    total: allItems.length,
    awaitingApproval: allItems.filter((i) => i.status === "in_approval").length,
    effective: allItems.filter((i) => i.derivedStatus === "effective").length,
    draftOrRevision: allItems.filter(
      (i) => i.status === "draft" || i.derivedStatus === "revision",
    ).length,
    reviewOverdue: allItems.filter((i) => i.isReviewOverdue).length,
  };

  const categories = Array.from(
    new Set(
      documents
        .map((d) => d.category)
        .filter((c): c is string => c != null && c.trim() !== ""),
    ),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  // In-memory URL-driven filters (view chip + title/code search + category).
  const view = sp.view ?? "all";
  const q = (sp.q ?? "").trim();
  const category = (sp.category ?? "").trim();
  const qLower = q.toLowerCase();
  const categoryLower = category.toLowerCase();

  const items = allItems.filter((item) => {
    if (!matchesView(item, view)) return false;
    if (
      q &&
      !item.title.toLowerCase().includes(qLower) &&
      !item.code.toLowerCase().includes(qLower)
    ) {
      return false;
    }
    if (
      category &&
      !(item.category ?? "").toLowerCase().includes(categoryLower)
    ) {
      return false;
    }
    return true;
  });

  const hasFilters = view !== "all" || q !== "" || category !== "";

  const newHref = commissionHref(org, commission, "manage", "documentos", "novo");
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

      <DocumentKpiStrip kpis={kpis} />

      <DocumentRegisterFilters
        view={view}
        q={sp.q ?? ""}
        category={sp.category ?? ""}
        categories={categories}
      />

      <DocumentRegisterTable
        items={items}
        org={org}
        commission={commission}
        hasFilters={hasFilters}
      />
    </div>
  );
}

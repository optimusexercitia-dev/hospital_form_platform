import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Plus } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getDocument, listDocuments } from "@/lib/queries/documents";
import type { ControlledDocumentListItem } from "@/lib/documents/types";
import { commissionHref } from "@/lib/routing";
import { Button } from "@/components/ui/button";
import type { DerivedDocStatus } from "@/components/documents/document-badges";
import {
  DocumentKpiStrip,
  type DocumentKpis,
} from "@/components/documents/document-kpi-strip";
import { DocumentRegisterFilters } from "@/components/documents/document-register-filters";
import {
  DocumentRegisterTable,
  type ApprovalProgress,
  type RegisterItem,
} from "@/components/documents/document-register-table";

export const metadata: Metadata = {
  title: "Documentos controlados",
};

/** Per-document extras derived FE-side (ADR 0081 F-A) — not in the list contract. */
interface DocExtras {
  /** `effective` docs: an open draft/in-approval version sits above the in-force one. */
  underRevision: boolean;
  /** `in_approval` docs: signed/total of the version under approval. */
  approval?: ApprovalProgress;
}

/**
 * Fetch the small set of extras the list contract can't express (ADR 0081): the
 * `in_approval` approval progress + whether an `effective` doc has an open
 * revision. Bounded to non-terminal docs (draft/obsolete need nothing) and run in
 * parallel. NOTE: this is a per-doc fan-out over `getDocument`; a future additive
 * list field (`latestVersionNumber` + approval counts) would remove it.
 */
async function loadExtras(
  documents: ControlledDocumentListItem[],
): Promise<Map<string, DocExtras>> {
  const nonTerminal = documents.filter(
    (d) => d.status === "effective" || d.status === "in_approval",
  );
  const details = await Promise.all(nonTerminal.map((d) => getDocument(d.id)));

  const byId = new Map(documents.map((d) => [d.id, d]));
  const extras = new Map<string, DocExtras>();

  for (const detail of details) {
    if (!detail) continue;
    const doc = byId.get(detail.document.id);
    if (!doc) continue;

    if (detail.document.status === "in_approval") {
      const total = detail.approvals.length;
      const approved = detail.approvals.filter(
        (a) => a.decision === "approved",
      ).length;
      const hasRejection = detail.approvals.some(
        (a) => a.decision === "rejected",
      );
      extras.set(doc.id, {
        underRevision: false,
        approval: { approved, total, hasRejection },
      });
    } else {
      const current = doc.currentVersionNumber ?? 0;
      const underRevision = detail.versions.some(
        (v) =>
          v.versionNumber > current &&
          (v.status === "draft" || v.status === "in_approval"),
      );
      extras.set(doc.id, { underRevision });
    }
  }
  return extras;
}

/** Resolve the display status, promoting an `effective` doc under revision. */
function deriveStatus(
  doc: ControlledDocumentListItem,
  extras: DocExtras | undefined,
): DerivedDocStatus {
  if (doc.status === "effective" && extras?.underRevision) return "revision";
  return doc.status;
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
  const extras = await loadExtras(documents);

  const allItems: RegisterItem[] = documents.map((doc) => {
    const ex = extras.get(doc.id);
    return {
      ...doc,
      derivedStatus: deriveStatus(doc, ex),
      approval: ex?.approval,
    };
  });

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

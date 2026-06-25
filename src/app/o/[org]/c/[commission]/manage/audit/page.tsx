import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import {
  listAudit,
  listAuditFilterActors,
  auditTrailEnabled,
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  type AuditAction,
  type AuditEntityType,
  type AuditFilters as AuditQueryFilters,
} from "@/lib/queries/audit";
import { AuditFilters } from "@/components/audit/audit-filters";
import { AuditFeed } from "@/components/audit/audit-feed";
import { AuditPagination } from "@/components/audit/audit-pagination";
import { AuditEmptyState } from "@/components/audit/audit-empty-state";

export const metadata: Metadata = {
  title: "Trilha de auditoria",
};

const PAGE_SIZE = 25;

/**
 * Commission audit trail (F1, coordinator area): a read-only, paginated,
 * filterable timeline of who did what to which entity in THIS commission, newest-
 * first.
 *
 * Gated TWICE on the server: behind the `audit_trail` feature flag (404 when off,
 * mirroring meetings/interviews) AND on staff_admin membership (mirroring the
 * dashboard exactly — a plain `staff`, a member of another commission, or an
 * unknown slug gets `notFound()`). The backing `listAudit` read is RLS-scoped, so
 * RLS remains the ultimate boundary; this gate is the friendly in-shell 404 and
 * the authority that a non-coordinator never reaches the view (Rule 1 — never
 * rely on UI hiding).
 *
 * All filters + pagination are URL-driven (`?actor=&action=&entity=&from=&to=&
 * page=`) so this Server Component re-queries — no client-side data fetching.
 */
export default async function CommissionAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; commission: string }>;
  searchParams: Promise<{
    actor?: string;
    action?: string;
    entity?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const { org, commission } = await params;

  // Flag gate first (cheap, no commission read needed if the feature is off).
  if (!(await auditTrailEnabled())) {
    notFound();
  }

  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const sp = await searchParams;
  const pageNum = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const filters: AuditQueryFilters = {
    // The actor filter encodes the system actor as the literal "system" (a null
    // actorId is not URL-addressable); the query treats undefined as "all".
    actorId: sp.actor || undefined,
    action: (sp.action as AuditAction) || undefined,
    entityType: (sp.entity as AuditEntityType) || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
    page: pageNum,
    pageSize: PAGE_SIZE,
  };

  const [pageData, actors] = await Promise.all([
    listAudit(access.commission.id, filters),
    listAuditFilterActors(access.commission.id),
  ]);

  const hasFilters = Boolean(
    sp.actor || sp.action || sp.entity || sp.from || sp.to,
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Trilha de auditoria</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Registro de quem fez o quê, em qual entidade e quando. Os registros são
          apenas de leitura e não podem ser alterados nem excluídos.
        </p>
      </header>

      <AuditFilters
        actors={actors}
        actionOptions={Object.entries(AUDIT_ACTION_LABELS)}
        entityOptions={Object.entries(AUDIT_ENTITY_LABELS)}
        actor={sp.actor ?? null}
        action={sp.action ?? null}
        entity={sp.entity ?? null}
        from={sp.from ?? null}
        to={sp.to ?? null}
        exportBasePath={commissionHref(org, commission, "manage", "audit", "export")}
        commissionId={access.commission.id}
      />

      {pageData.entries.length === 0 ? (
        <AuditEmptyState filtered={hasFilters} />
      ) : (
        <>
          <AuditFeed
            entries={pageData.entries}
            actionLabels={AUDIT_ACTION_LABELS}
            entityLabels={AUDIT_ENTITY_LABELS}
            runKey={`p${pageData.page}`}
          />
          <AuditPagination
            total={pageData.total}
            page={pageData.page}
            pageSize={pageData.pageSize}
          />
        </>
      )}
    </div>
  );
}

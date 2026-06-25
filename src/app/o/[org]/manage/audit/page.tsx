import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSessionContext } from "@/lib/queries/session";
import {
  listAuditForOrg,
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
 * Org-tier audit trail (multi-tenancy Phase C). The org-scoped variant of the
 * audit timeline: the union of the org chain (`commission_id IS NULL`) AND every
 * commission chain under the org. Access is enforced by the `/o/[org]/manage`
 * layout (`is_org_admin_of(org)`); we re-resolve the org from
 * `context.orgAdminOf` to get its id for the org-scoped read. `listAuditForOrg`
 * is RLS-scoped (the `audit_log_select` org-tier term), so RLS remains the
 * boundary. All filters + pagination are URL-driven. Gated behind the
 * `audit_trail` flag (404 when off). The commission column is shown so each row's
 * commission (or "—" for an org-tier action) is visible.
 */
export default async function OrgAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{
    actor?: string;
    action?: string;
    entity?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const { org } = await params;
  const context = await getSessionContext();
  const organization = context?.orgAdminOf.find(
    (o) => o.organization.slug === org,
  )?.organization;

  // The layout already guarantees access; defensive (never expected).
  if (!organization) {
    notFound();
  }
  if (!(await auditTrailEnabled())) {
    notFound();
  }

  const sp = await searchParams;
  const pageNum = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const filters: AuditQueryFilters = {
    actorId: sp.actor || undefined,
    action: (sp.action as AuditAction) || undefined,
    entityType: (sp.entity as AuditEntityType) || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
    page: pageNum,
    pageSize: PAGE_SIZE,
  };

  const [pageData, actors] = await Promise.all([
    listAuditForOrg(organization.id, filters),
    listAuditFilterActors(null),
  ]);

  const hasFilters = Boolean(
    sp.actor || sp.action || sp.entity || sp.from || sp.to,
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {organization.name}
        </p>
        <h1 className="text-3xl text-balance">Trilha de auditoria</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Registro de quem fez o quê, em qual entidade e quando, em toda a sua
          organização. Os registros são apenas de leitura e não podem ser
          alterados nem excluídos.
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
        exportBasePath={null}
        organizationId={organization.id}
      />

      {pageData.entries.length === 0 ? (
        <AuditEmptyState filtered={hasFilters} />
      ) : (
        <>
          <AuditFeed
            entries={pageData.entries}
            actionLabels={AUDIT_ACTION_LABELS}
            entityLabels={AUDIT_ENTITY_LABELS}
            showCommission
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

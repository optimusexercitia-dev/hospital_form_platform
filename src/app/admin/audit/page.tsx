import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/queries/session";
import { listCommissionsForAdmin } from "@/lib/queries/commissions";
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
 * Global admin audit trail (F2): the cross-commission variant. Same read-only,
 * paginated, filterable timeline as the commission view, with an extra commission
 * column (each row shows its commission, or "—" for a global/admin action) and a
 * commission filter.
 *
 * Gated behind the `audit_trail` flag (404 when off). The admin layout already
 * enforces `isAdmin` (non-admins get `notFound()` before reaching here); we
 * re-derive the context for the feature gate. `listAudit(null, …)` is the cross-
 * commission stream — RLS still scopes a non-admin to nothing, so RLS remains the
 * boundary. All filters + pagination are URL-driven.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    actor?: string;
    action?: string;
    entity?: string;
    from?: string;
    to?: string;
    commission?: string;
    page?: string;
  }>;
}) {
  // Flag gate (the admin layout already gates `isAdmin`); re-check defensively.
  const context = await requireUser();
  if (!context.isAdmin) {
    notFound();
  }
  if (!(await auditTrailEnabled())) {
    notFound();
  }

  const sp = await searchParams;
  const pageNum = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  // The admin commission filter scopes the read to one commission (still the
  // cross-commission RPC path; `null` = every commission). An explicit
  // `?commission=` narrows it without changing the route.
  const scopeCommissionId = sp.commission || null;

  const filters: AuditQueryFilters = {
    actorId: sp.actor || undefined,
    action: (sp.action as AuditAction) || undefined,
    entityType: (sp.entity as AuditEntityType) || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
    page: pageNum,
    pageSize: PAGE_SIZE,
  };

  const [pageData, actors, commissions] = await Promise.all([
    listAudit(scopeCommissionId, filters),
    listAuditFilterActors(scopeCommissionId),
    listCommissionsForAdmin(),
  ]);

  const hasFilters = Boolean(
    sp.actor || sp.action || sp.entity || sp.from || sp.to || sp.commission,
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Administração
        </p>
        <h1 className="text-3xl text-balance">Trilha de auditoria</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Registro global de quem fez o quê, em qual entidade e quando, em todas
          as comissões. Os registros são apenas de leitura e não podem ser
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
        commissions={commissions.map((c) => ({ id: c.id, name: c.name }))}
        commission={sp.commission ?? null}
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

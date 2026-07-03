import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSessionContext } from "@/lib/queries/session";
import { adminedHospitals } from "@/lib/auth/access";
import {
  listAuditForOrg,
  listAuditForHospital,
  listAuditFilterActors,
  auditTrailEnabled,
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  type AuditAction,
  type AuditEntityType,
  type AuditFilters as AuditQueryFilters,
  type AuditPage,
} from "@/lib/queries/audit";
import { HospitalSwitcher } from "@/components/shell/hospital-switcher";
import { AuditFilters } from "@/components/audit/audit-filters";
import { AuditFeed } from "@/components/audit/audit-feed";
import { AuditPagination } from "@/components/audit/audit-pagination";
import { AuditEmptyState } from "@/components/audit/audit-empty-state";

export const metadata: Metadata = {
  title: "Trilha de auditoria",
};

const PAGE_SIZE = 25;

/**
 * Org/hospital-tier audit trail (ADR 0051 — the audit log is a 4-tier chain:
 * platform/org/hospital/commission). Access is enforced by the
 * `/o/[org]/manage` layout (`is_org_admin_of(org)` OR hospital_admin-of-some-
 * hospital-here).
 *
 * An `org_admin` sees the ORG chain — the union of the org chain
 * (`commission_id IS NULL`) AND every commission chain under the org
 * (`listAuditForOrg`). A `hospital_admin` sees its HOSPITAL chain instead — the
 * union of the hospital chain AND every commission chain under that hospital
 * (`listAuditForHospital`, ADR 0051 Decision 10) — with a hospital switcher
 * when it administers more than one (`?hospital=`). Both reads are RLS-scoped
 * (the `audit_log_select` org-tier / hospital-tier terms), so RLS remains the
 * boundary. All filters + pagination are URL-driven. Gated behind the
 * `audit_trail` flag (404 when off). The commission column is shown so each
 * row's commission (or "—" for an org/hospital-tier action) is visible.
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
    hospital?: string;
  }>;
}) {
  const { org } = await params;
  const context = await getSessionContext();
  const orgAdminEntry = context?.orgAdminOf.find(
    (o) => o.organization.slug === org,
  );
  const organization =
    orgAdminEntry?.organization ??
    context?.hospitalAdminOf.find((h) => h.organization.slug === org)
      ?.organization;

  // The layout already guarantees access; defensive (never expected).
  if (!organization || !context) {
    notFound();
  }
  if (!(await auditTrailEnabled())) {
    notFound();
  }

  const isOrgAdmin = Boolean(orgAdminEntry);
  const hospitals = isOrgAdmin ? [] : adminedHospitals(context, organization.id);

  const sp = await searchParams;
  const pageNum = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  // A hospital_admin MUST have a selected hospital (defaults to the first).
  const selectedHospitalId = isOrgAdmin
    ? null
    : (sp.hospital ?? hospitals[0]?.id ?? null);

  const filters: AuditQueryFilters = {
    actorId: sp.actor || undefined,
    action: (sp.action as AuditAction) || undefined,
    entityType: (sp.entity as AuditEntityType) || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
    page: pageNum,
    pageSize: PAGE_SIZE,
  };

  let pageData: AuditPage;
  if (isOrgAdmin) {
    pageData = await listAuditForOrg(organization.id, filters);
  } else if (selectedHospitalId) {
    pageData = await listAuditForHospital(selectedHospitalId, filters);
  } else {
    // No hospital standing at all — defensive; the layout gate should prevent
    // reaching this page without at least org_admin or hospital_admin here.
    pageData = { entries: [], total: 0, page: pageNum, pageSize: PAGE_SIZE };
  }

  const actors = await listAuditFilterActors(null);

  const hasFilters = Boolean(
    sp.actor || sp.action || sp.entity || sp.from || sp.to,
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {organization.name}
          </p>
          {!isOrgAdmin && hospitals.length > 1 ? (
            <HospitalSwitcher
              hospitals={hospitals}
              currentHospitalId={selectedHospitalId}
              allowAll={false}
            />
          ) : null}
        </div>
        <h1 className="text-3xl text-balance">Trilha de auditoria</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          {isOrgAdmin
            ? "Registro de quem fez o quê, em qual entidade e quando, em toda a sua organização. Os registros são apenas de leitura e não podem ser alterados nem excluídos."
            : "Registro de quem fez o quê, em qual entidade e quando, no seu hospital. Os registros são apenas de leitura e não podem ser alterados nem excluídos."}
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
        organizationId={isOrgAdmin ? organization.id : undefined}
        hospitalId={!isOrgAdmin && selectedHospitalId ? selectedHospitalId : undefined}
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

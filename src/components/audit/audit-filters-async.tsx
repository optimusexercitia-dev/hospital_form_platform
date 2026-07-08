import {
  listAuditFilterActors,
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
} from "@/lib/queries/audit";

import { AuditFilters, type AuditCommissionOption } from "./audit-filters";

/**
 * Suspense boundary for {@link AuditFilters}: the actor-dropdown population
 * (`listAuditFilterActors`) is a secondary read that must not block the audit
 * feed's first paint (frontend-audit-2026-07 #2). This Server Component owns
 * that one await; the page renders it inside `<Suspense fallback={<Skeleton
 * .../>}>` alongside the feed, which streams independently.
 */
export async function AuditFiltersAsync({
  commissionScopeId,
  actor,
  action,
  entity,
  from,
  to,
  exportBasePath,
  commissionId,
  organizationId,
  hospitalId,
  commissions,
  commission,
}: {
  /** Scope passed to `listAuditFilterActors` — a commission id, or `null` for
   * the org/hospital-tier (all actors in scope). */
  commissionScopeId: string | null;
  actor: string | null;
  action: string | null;
  entity: string | null;
  from: string | null;
  to: string | null;
  exportBasePath: string | null;
  commissionId?: string;
  organizationId?: string;
  hospitalId?: string;
  commissions?: AuditCommissionOption[];
  commission?: string | null;
}) {
  const actors = await listAuditFilterActors(commissionScopeId);

  return (
    <AuditFilters
      actors={actors}
      actionOptions={Object.entries(AUDIT_ACTION_LABELS)}
      entityOptions={Object.entries(AUDIT_ENTITY_LABELS)}
      actor={actor}
      action={action}
      entity={entity}
      from={from}
      to={to}
      exportBasePath={exportBasePath}
      commissionId={commissionId}
      organizationId={organizationId}
      hospitalId={hospitalId}
      commissions={commissions}
      commission={commission}
    />
  );
}

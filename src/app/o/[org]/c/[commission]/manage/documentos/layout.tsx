import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { controlledDocsEnabled } from "@/lib/queries/feature-flags";

/**
 * Controlled-documents area shell (Phase 17). Server Component.
 *
 * Gated behind the `controlled_docs` flag (404 when OFF — mirrors how the
 * indicators area gates its coordinator surface) AND coordinator access: only a
 * `staff_admin` of this commission (or an org/hospital-admin resolved to that
 * role) reaches the authoring surface. RLS remains the ultimate boundary; this
 * closes the route + resolves the shell. The per-user approval queue lives at
 * ORG level (F4) precisely because an approver may be OUTSIDE this commission.
 */
export default async function DocumentsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;

  if (!(await controlledDocsEnabled())) {
    notFound();
  }

  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  return <>{children}</>;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSessionContext } from "@/lib/queries/session";
import { listPendingApprovalsForUser } from "@/lib/queries/controlled-documents";
import { controlledDocsEnabled } from "@/lib/queries/feature-flags";
import { PendingApprovalsList } from "@/components/documents/pending-approvals-list";

export const metadata: Metadata = {
  title: "Aprovações pendentes",
};

/**
 * Per-user approval queue (Phase 17, F4). ORG-level and NOT commission-gated: an
 * approver may be OUTSIDE the document's commission, so gating on commission
 * coordinator access would lock out the very people this page serves. The gate is
 * therefore: the `controlled_docs` flag on, a valid session, and the caller having
 * SOME standing in this org (member of a commission, or org/hospital admin) — the
 * queue itself is sign-own-row RLS-scoped by `listPendingApprovalsForUser`, so it
 * only ever returns the caller's own pending approvals.
 */
export default async function PendingApprovalsPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;

  // Neither the flag check nor the session read depends on the other.
  const [flagOn, context] = await Promise.all([
    controlledDocsEnabled(),
    getSessionContext(),
  ]);
  if (!flagOn) {
    notFound();
  }
  if (!context) {
    notFound();
  }

  // The caller must have some standing in THIS org (else 404 — leak nothing about
  // which orgs exist). Commission membership, org_admin, or hospital_admin all
  // qualify; all three lists are RLS-scoped reads.
  const belongsToOrg =
    context.memberships.some((m) => m.commission.organization.slug === org) ||
    context.orgAdminOf.some((o) => o.organization.slug === org) ||
    context.hospitalAdminOf.some((h) => h.organization.slug === org);
  if (!belongsToOrg) {
    notFound();
  }

  const rows = await listPendingApprovalsForUser();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Documentos controlados
        </p>
        <h1 className="text-3xl text-balance">Aprovações pendentes</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Documentos que indicaram você como aprovador e aguardam sua assinatura.
        </p>
      </header>

      <PendingApprovalsList rows={rows} org={org} />
    </div>
  );
}

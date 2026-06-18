import { notFound } from "next/navigation";

import { getCommissionAccess } from "@/lib/queries/session";
import { listCasesBoard, listMyAssignedPhases } from "@/lib/queries/cases";
import { isTerminalCaseStatus } from "@/lib/cases/case-status";
import { listSignoffQueue } from "@/lib/queries/signoffs";
import { myPendingMeetingSignatures } from "@/lib/queries/meetings";
import { meetingsEnabled } from "@/lib/meetings/actions";
import { auditTrailEnabled } from "@/lib/queries/audit";
import { patientSafetyEnabled } from "@/lib/queries/pqs";
import { AppSidebar, type SidebarCounts } from "@/components/shell/app-sidebar";

/**
 * Commission area shell. Server Component.
 *
 * `getCommissionAccess(slug)` returns null for an unknown slug OR a commission
 * the caller may not access — the two are indistinguishable by design (RLS),
 * so we render `notFound()` for both and leak nothing about which commissions
 * exist (Phase 2 acceptance: foreign/unknown commission → 404).
 *
 * The sidebar shows live count badges. These reuse existing read queries (no new
 * backend): the coordinator-only counts (open cases, pending sign-offs) are only
 * fetched for staff_admins/admins; "minhas fases" is fetched for everyone (the
 * RPCs are internally role-gated and return [] otherwise, so this never leaks).
 */
export default async function CommissionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const access = await getCommissionAccess(slug);

  if (!access) {
    notFound();
  }

  const commissionId = access.commission.id;
  const isCoordinator =
    access.role === "staff_admin" || access.context.isAdmin;

  // The meetings feature flag gates the "Reuniões" nav item + its pending-
  // signatures badge. When off, skip the pending-signatures read entirely.
  // The audit_trail flag gates the "Trilha de auditoria" coordinator nav item.
  const [meetingsOn, auditOn, patientSafetyOn] = await Promise.all([
    meetingsEnabled(),
    auditTrailEnabled(),
    patientSafetyEnabled(),
  ]);

  const [myPhases, board, signoffQueue, pendingSignatures] = await Promise.all([
    listMyAssignedPhases(commissionId),
    isCoordinator ? listCasesBoard(commissionId) : Promise.resolve([]),
    isCoordinator ? listSignoffQueue(commissionId) : Promise.resolve([]),
    meetingsOn ? myPendingMeetingSignatures() : Promise.resolve([]),
  ]);

  const counts: SidebarCounts = {
    minhasFases: myPhases.length,
    // "Open" cases = those NOT in a terminal status (the FIXED computed enum:
    // nao_iniciado / em_revisao / pendente are open; concluido / cancelado closed).
    casos: board.filter((row) => !isTerminalCaseStatus(row.case.status)).length,
    assinaturas: signoffQueue.length,
    // Meetings awaiting THIS user's signature (any member; derived read).
    reunioesPendentes: pendingSignatures.length,
  };

  const roleLabel =
    access.role === "staff_admin"
      ? "Coordenação"
      : access.role === "staff"
        ? "Membro"
        : "Administrador";

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <AppSidebar
        slug={access.commission.slug}
        role={access.role}
        memberships={access.context.memberships}
        commissionName={access.commission.name}
        fullName={access.context.fullName}
        email={access.context.email}
        roleLabel={roleLabel}
        counts={counts}
        meetingsEnabled={meetingsOn}
        auditEnabled={auditOn}
        patientSafetyEnabled={patientSafetyOn}
      />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

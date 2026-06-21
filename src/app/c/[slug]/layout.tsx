import { notFound } from "next/navigation";

import { getCommissionAccess } from "@/lib/queries/session";
import {
  listCasesBoard,
  listMyAssignedPhases,
  listMyCases,
} from "@/lib/queries/cases";
import { isTerminalCaseStatus } from "@/lib/cases/case-status";
import { listSignoffQueue } from "@/lib/queries/signoffs";
import { myPendingMeetingSignatures } from "@/lib/queries/meetings";
import { meetingsEnabled } from "@/lib/meetings/actions";
import { auditTrailEnabled } from "@/lib/queries/audit";
import { patientSafetyEnabled } from "@/lib/queries/pqs";
import { caseAccessEnabled } from "@/lib/case-access/actions";
import {
  countCommissionReferralActionable,
  referralsEnabled,
} from "@/lib/queries/referrals";
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
  // The case_access flag swaps the "Minhas fases" badge for "Meus Casos" (ADR 0033).
  // The case_referrals flag gates the "Encaminhamentos" nav item + its actionable
  // badge. When off, skip the actionable-count read entirely.
  const [meetingsOn, auditOn, patientSafetyOn, caseAccessOn, referralsOn] =
    await Promise.all([
      meetingsEnabled(),
      auditTrailEnabled(),
      patientSafetyEnabled(),
      caseAccessEnabled(),
      referralsEnabled(),
    ]);

  // The "my work" count is the badge for whichever nav item the flag selects:
  // OFF → "Minhas fases" (active assigned phases, today's read); ON → "Meus Casos"
  // (every accessible case via `list_my_cases`). When OFF we never call the ON-only
  // read, so flag-OFF behavior is byte-for-byte today's.
  const [
    myPhases,
    myCases,
    board,
    signoffQueue,
    pendingSignatures,
    referralsActionable,
  ] = await Promise.all([
    caseAccessOn ? Promise.resolve([]) : listMyAssignedPhases(commissionId),
    caseAccessOn ? listMyCases(commissionId) : Promise.resolve([]),
    isCoordinator ? listCasesBoard(commissionId) : Promise.resolve([]),
    isCoordinator ? listSignoffQueue(commissionId) : Promise.resolve([]),
    meetingsOn ? myPendingMeetingSignatures() : Promise.resolve([]),
    referralsOn
      ? countCommissionReferralActionable(commissionId)
      : Promise.resolve(0),
  ]);

  const counts: SidebarCounts = {
    minhasFases: myPhases.length,
    meusCasos: myCases.length,
    // "Open" cases = those NOT in a terminal status (the FIXED computed enum:
    // nao_iniciado / em_revisao / pendente are open; concluido / cancelado closed).
    casos: board.filter((row) => !isTerminalCaseStatus(row.case.status)).length,
    assinaturas: signoffQueue.length,
    // Meetings awaiting THIS user's signature (any member; derived read).
    reunioesPendentes: pendingSignatures.length,
    // Referrals needing this commission's attention (incoming awaiting +
    // outgoing drafts); 0 when the flag is off or out of scope.
    encaminhamentos: referralsActionable,
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
        referralsEnabled={referralsOn}
        caseAccessEnabled={caseAccessOn}
      />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

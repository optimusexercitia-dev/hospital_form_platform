import { notFound } from "next/navigation";

import { getCommissionAccessByOrg, getNspAccessByOrg } from "@/lib/queries/session";
import {
  casesExtrasEnabled,
  countOpenCasesForBoard,
  listMyAssignedPhases,
  listMyCases,
} from "@/lib/queries/cases";
import { listSignoffQueue } from "@/lib/queries/signoffs";
import { myPendingMeetingSignatures } from "@/lib/queries/meetings";
import { meetingsEnabled } from "@/lib/meetings/actions";
import { auditTrailEnabled } from "@/lib/queries/audit";
import { actionItemsEnabled } from "@/lib/queries/action-items";
import { getMemberOverview } from "@/lib/queries/overview";
import { patientSafetyEnabled } from "@/lib/queries/pqs";
import { caseAccessEnabled } from "@/lib/case-access/actions";
import {
  countCommissionReferralActionable,
  referralsEnabled,
} from "@/lib/queries/referrals";
import {
  qualityIndicatorsEnabled,
  controlledDocsEnabled,
} from "@/lib/queries/feature-flags";
import { AppSidebar, type SidebarCounts } from "@/components/shell/app-sidebar";
import { NotificationBell } from "@/components/notifications/notification-bell";

/**
 * Commission area shell. Server Component.
 *
 * `getCommissionAccessByOrg(org, commission)` returns null for an unknown slug OR a commission
 * the caller may not access — the two are indistinguishable by design (RLS),
 * so we render `notFound()` for both and leak nothing about which commissions
 * exist (Phase 2 acceptance: foreign/unknown commission → 404).
 *
 * We ALSO `notFound()` when `access.role === null`. Under multi-tenancy that role
 * is null for exactly one caller: a platform_admin who is neither a member of this
 * commission nor an org_admin of its org. The platform_admin is walled off from
 * all tenant data, so it must not load a commission area at all (RLS already
 * returns it empty data — this closes the route itself; BUG-MT-005). A legitimate
 * commission-area user is always a member (`staff`/`staff_admin`) OR an org_admin
 * of the org (resolved to the `staff_admin` coordinator role by the resolver), so
 * no real user is denied by this check.
 *
 * The sidebar shows live count badges. These reuse existing read queries (no new
 * backend): the coordinator-only counts (open cases, pending sign-offs) are only
 * fetched for staff_admins; "minhas fases" is fetched for everyone (the RPCs are
 * internally role-gated and return [] otherwise, so this never leaks).
 */
export default async function CommissionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const access = await getCommissionAccessByOrg(org, commission);

  if (!access || access.role === null) {
    notFound();
  }

  const commissionId = access.commission.id;
  // `role` is non-null past the gate (member or org_admin coordinator); a
  // staff_admin role is the coordinator. (Platform admins were 404'd above and
  // never get coordinator powers in a tenant area.)
  const isCoordinator = access.role === "staff_admin";

  // The meetings feature flag gates the "Reuniões" nav item + its pending-
  // signatures badge. When off, skip the pending-signatures read entirely.
  // The audit_trail flag gates the "Trilha de auditoria" coordinator nav item.
  // The case_access flag swaps the "Minhas fases" badge for "Meus Casos" (ADR 0033).
  // The case_referrals flag gates the "Encaminhamentos" nav item + its actionable
  // badge. When off, skip the actionable-count read entirely.
  const [
    meetingsOn,
    auditOn,
    patientSafetyOn,
    caseAccessOn,
    referralsOn,
    casesExtrasOn,
    sharedActionItemsOn,
    qualityIndicatorsOn,
    controlledDocsOn,
    nspAccess,
  ] = await Promise.all([
    meetingsEnabled(),
    auditTrailEnabled(),
    patientSafetyEnabled(),
    caseAccessEnabled(),
    referralsEnabled(),
    casesExtrasEnabled(),
    actionItemsEnabled(),
    qualityIndicatorsEnabled(),
    controlledDocsEnabled(),
    getNspAccessByOrg(org),
  ]);

  // "Meus itens de ação" surfaces items from the shared action_items hub across
  // its three sources: case-sourced (`cases_extras`), meeting-sourced (`meetings`)
  // and manual-sourced (`action_items`) rows. Its nav item shows when ANY of those
  // source flags is on.
  const actionItemsOn = casesExtrasOn || meetingsOn || sharedActionItemsOn;

  // The "my work" count is the badge for whichever nav item the flag selects:
  // OFF → "Minhas fases" (active assigned phases, today's read); ON → "Meus Casos"
  // (every accessible case via `list_my_cases`). When OFF we never call the ON-only
  // read, so flag-OFF behavior is byte-for-byte today's.
  const [
    myPhases,
    myCases,
    openCasesCount,
    signoffQueue,
    pendingSignatures,
    referralsActionable,
    memberOverview,
  ] = await Promise.all([
    caseAccessOn ? Promise.resolve([]) : listMyAssignedPhases(commissionId),
    caseAccessOn ? listMyCases(commissionId) : Promise.resolve([]),
    // P4: count open cases via the dedicated `count_open_cases_for_board` RPC
    // (mirrors the board's `is_staff_admin_of` gate) instead of fetching the
    // capped-200 board with its phase JSON just to badge a number. The other four
    // badges below are counted from their user-scoped reads because those lists
    // are inherently small.
    isCoordinator
      ? countOpenCasesForBoard(commissionId)
      : Promise.resolve(0),
    isCoordinator ? listSignoffQueue(commissionId) : Promise.resolve([]),
    meetingsOn ? myPendingMeetingSignatures() : Promise.resolve([]),
    referralsOn
      ? countCommissionReferralActionable(commissionId)
      : Promise.resolve(0),
    // "Meus itens de ação" badge. Gated on the SAME composite flag as the nav
    // item itself (`actionItemsOn`), so we never read for a disabled feature.
    // `getMemberOverview` is `cache()`-wrapped and self-scoped to auth.uid(), so
    // this dedupes with the overview page's own call — the badge is free.
    actionItemsOn ? getMemberOverview(commissionId) : Promise.resolve(null),
  ]);

  const counts: SidebarCounts = {
    minhasFases: myPhases.length,
    meusCasos: myCases.length,
    // "Open" cases = those NOT in a terminal status (nao_iniciado / em_revisao /
    // pendente open; concluido / cancelado closed), counted server-side by the
    // `count_open_cases_for_board` RPC (P4) rather than derived from the board.
    casos: openCasesCount,
    assinaturas: signoffQueue.length,
    // Meetings awaiting THIS user's signature (any member; derived read).
    reunioesPendentes: pendingSignatures.length,
    // Referrals needing this commission's attention (incoming awaiting +
    // outgoing drafts); 0 when the flag is off or out of scope.
    encaminhamentos: referralsActionable,
    // Action items assigned to this user and not yet concluded; 0 when no
    // action-item source flag is on (the nav item is hidden then anyway).
    meusItensDeAcao: memberOverview?.pendingActionItems ?? 0,
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
        org={org}
        slug={access.commission.slug}
        commissionId={commissionId}
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
        actionItemsEnabled={actionItemsOn}
        qualityIndicatorsEnabled={qualityIndicatorsOn}
        controlledDocsEnabled={controlledDocsOn}
        isNspCoordinator={nspAccess?.isCoordinator ?? false}
        isPqsMember={nspAccess?.isPqsMember ?? false}
        notificationBell={<NotificationBell />}
      />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

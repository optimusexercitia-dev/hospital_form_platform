import { notFound } from "next/navigation";

import {
  getCommissionAccessByOrg,
  getNspAccessByOrg,
  getRawGrants,
} from "@/lib/queries/session";
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
  chartersEnabled,
  accreditationEnabled,
} from "@/lib/queries/feature-flags";
import { AppSidebar, type SidebarCounts } from "@/components/shell/app-sidebar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { QualityViewerShell } from "@/components/quality/quality-viewer-shell";

/**
 * Nav badges for a principal with no committee CONTENT standing (ADR 0100 D12).
 * Every count in `SidebarCounts` counts content — cases, sign-offs, meeting
 * signatures, referrals, action items — so a bare tenancy admin's are all zero
 * by definition, not by a skipped read. Declared once so the type checker reds
 * this branch if a future badge is added without a decision about it.
 */
const EMPTY_COUNTS: SidebarCounts = {
  minhasFases: 0,
  meusCasos: 0,
  casos: 0,
  assinaturas: 0,
  reunioesPendentes: 0,
  encaminhamentos: 0,
  meusItensDeAcao: 0,
};

/**
 * Commission area shell. Server Component.
 *
 * `getCommissionAccessByOrg(org, commission)` returns null for an unknown slug OR a commission
 * the caller may not access — the two are indistinguishable by design (RLS),
 * so we render `notFound()` for both and leak nothing about which commissions
 * exist (Phase 2 acceptance: foreign/unknown commission → 404).
 *
 * `access.role === null` now has THREE callers, so it no longer decides the gate
 * alone (ADR 0100 D10 widened it; D12 widened it again):
 *
 *  - a **platform_admin** who is neither a member nor an org_admin of the org —
 *    walled off from all tenant data, so it must not load a commission area at
 *    all (RLS already returns it empty data; this closes the route itself,
 *    BUG-MT-005). Still `notFound()`.
 *  - a **quality reviewer** (`isQualityViewer`), whose oversight arm confers real
 *    READ access to this commission's cases but no membership and no write
 *    capability. It gets the reduced {@link QualityViewerShell} instead — see the
 *    early return below for why a separate shell rather than a hidden sidebar.
 *  - a **tenancy admin** (`isTenancyAdmin` — org_admin/hospital_admin; ADR 0100
 *    D12, BUG-QOB-003), who administers this commission's CONFIGURATION and
 *    nothing else. Before QO·B the resolver coerced them to `'staff_admin'`, so
 *    they reached the member branch and got the full coordinator menu; the wall
 *    then refused every content surface behind it. They now get the member shell
 *    with `navScope="configuration"` — the KEEP allowlist only.
 *
 * Everyone else reaching the member branch is a member (`staff`/`staff_admin`) —
 * and under ACT (ADR 0106) that is ALL they are, so this branch always renders
 * `navScope="member"`. A principal wears exactly one hat, which makes membership
 * and tenancy-admin standing mutually exclusive; the composite
 * `"member-and-configuration"` scope was deleted with the branch that selected
 * it (S4 / QA MINOR-1). See the `navScope` prop below for the derivation.
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
  // ACT (ADR 0106) — `grants` feeds `UserMenu`'s "Trocar papel" switch across
  // all three branches below (hat-blind by design, D9); fetched once here
  // rather than per-branch.
  const [access, grants] = await Promise.all([
    getCommissionAccessByOrg(org, commission),
    getRawGrants(),
  ]);

  if (
    !access ||
    (access.role === null && !access.isQualityViewer && !access.isTenancyAdmin)
  ) {
    notFound();
  }

  // ADR 0100 D10 — the quality reviewer reaches this commission with `role: null`
  // (a FLAG, never a member role) and gets a DIFFERENT SHELL, returning before
  // the member branch below runs at all.
  //
  // ⚠ This is not a nicety, it is the affordance boundary. `AppSidebar`'s
  // predicate ends `return role === null || item.roles.includes(role)` — `null`
  // is the platform-admin "show everything" branch — so rendering the member
  // shell for a reviewer would light up every coordinator nav item (Construtor,
  // Gerenciar, Painel, Configurações…), each of which then 404s them. Returning
  // early also skips the eleven flag reads and five count queries below, all of
  // which are meaningless for a principal holding no membership.
  if (access.role === null && access.isQualityViewer) {
    return (
      <QualityViewerShell
        org={org}
        commissionName={access.commission.name}
        fullName={access.context.fullName}
        email={access.context.email}
        activeRole={access.context.activeRole}
        grants={grants}
      >
        {children}
      </QualityViewerShell>
    );
  }

  // ADR 0100 D12 (BUG-QOB-003) — the BARE TENANCY ADMIN branch. They hold no
  // membership role, so every content read below would be denied or empty; they
  // get the member shell narrowed to the KEEP configuration allowlist and only
  // the two flag reads that allowlist actually depends on.
  //
  // ⚠ The narrowing is `navScope`, NOT a set of hidden items. `AppSidebar`'s
  // predicate treats `configuration: true` as an opt-in, so a nav item added
  // later is invisible here until someone deliberately marks it — the direction
  // that fails closed. Sibling counts stay 0: every badge counts content.
  if (access.role === null) {
    const [configIndicatorsOn, configAuditOn] = await Promise.all([
      qualityIndicatorsEnabled(),
      auditTrailEnabled(),
    ]);
    return (
      <div className="flex min-h-svh flex-col md:flex-row">
        <AppSidebar
          org={org}
          slug={access.commission.slug}
          commissionId={access.commission.id}
          role={null}
          navScope="configuration"
          memberships={access.context.memberships}
          commissionName={access.commission.name}
          fullName={access.context.fullName}
          email={access.context.email}
          roleLabel="Administração"
          counts={EMPTY_COUNTS}
          qualityIndicatorsEnabled={configIndicatorsOn}
          auditEnabled={configAuditOn}
          notificationBell={<NotificationBell />}
          activeRole={access.context.activeRole}
          grants={grants}
        />
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:px-8">
            {children}
          </div>
        </main>
      </div>
    );
  }

  const commissionId = access.commission.id;
  // `role` is non-null past the gate — the caller HOLDS a membership here (the
  // resolver no longer manufactures one for a tenancy admin; BUG-QOB-003). A
  // staff_admin role is the coordinator.
  const isCoordinator = access.role === "staff_admin";
  // Post-BUG-QOB-003 a non-null role IS a held membership, so this is now
  // tautologically true on this branch. Kept as an explicit derivation rather
  // than hardcoded `true`: it is the predicate "Reuniões" opts into (ADR 0078
  // C7), and pinning it to a literal would silently mis-answer the next
  // standing that reaches this branch without a membership row.
  const isCommissionMember = access.context.memberships.some(
    (m) => m.commission.id === commissionId,
  );
  // Standing in this commission's CASE CONTENT: a membership OR an Administrativo
  // appointment (ADR 0061 — its capabilities survive a membership revocation, and
  // the board still serves such a principal their granted/assigned cases). False
  // only for an administration-only principal, whom the board 404s post-Gate-2.
  // Gates the "Casos" nav item; see manage/cases/page.tsx for the same predicate.
  const hasCaseStanding = isCommissionMember || access.isAdministrativo;

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
    chartersOn,
    accreditationOn,
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
    chartersEnabled(),
    accreditationEnabled(),
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

  const roleLabel = access.role === "staff_admin" ? "Coordenação" : "Membro";

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <AppSidebar
        org={org}
        slug={access.commission.slug}
        commissionId={commissionId}
        role={access.role}
        // ACT (ADR 0106) — unconditionally `"member"` here. This used to read
        // `access.isTenancyAdmin ? "member-and-configuration" : "member"`; the
        // truthy arm went unreachable when ACT made a session wear exactly ONE
        // hat, because `getSessionContext` filters every grant to the active
        // role BEFORE `partitionGrants` splits it, and that partition routes
        // `staff`/`staff_admin` (→ `memberships`, which is what puts a non-null
        // `access.role` on this branch) and `org_admin`/`hospital_admin` (→
        // `orgAdminOf`/`hospitalAdminOf`, which is all `isTenancyAdmin` reads)
        // into DISJOINT buckets. One hat cannot fill both.
        //
        // Deleted outright rather than left as a silent string (QA MINOR-1, ACT
        // S4): a future widening of that exclusion would otherwise have quietly
        // re-lit an authorization-shaped nav scope nothing tested. Removal fails
        // CLOSED — a widened principal gets this NARROWER scope, never extra
        // configuration items — and `canConfigureCommission` still gates each
        // destination, so nobody loses access, only menu entries. The invariant
        // itself is carried by `src/components/shell/nav-scope-exclusivity.test.ts`,
        // which reds in CI before such a widening could ship.
        navScope="member"
        memberships={access.context.memberships}
        commissionName={access.commission.name}
        fullName={access.context.fullName}
        email={access.context.email}
        roleLabel={roleLabel}
        counts={counts}
        isCommissionMember={isCommissionMember}
        hasCaseStanding={hasCaseStanding}
        meetingsEnabled={meetingsOn}
        auditEnabled={auditOn}
        patientSafetyEnabled={patientSafetyOn}
        referralsEnabled={referralsOn}
        caseAccessEnabled={caseAccessOn}
        actionItemsEnabled={actionItemsOn}
        qualityIndicatorsEnabled={qualityIndicatorsOn}
        controlledDocsEnabled={controlledDocsOn}
        chartersEnabled={chartersOn}
        accreditationEnabled={accreditationOn}
        isNspCoordinator={nspAccess?.isCoordinator ?? false}
        isPqsMember={nspAccess?.isPqsMember ?? false}
        // ADR 0100 — the dual-hatted case: a committee member/coordinator who
        // ALSO holds a reviewer seat in this org lands on their commission, so
        // this is their only route into the console.
        isQualityReviewer={access.context.qualityReviewerOf.some(
          (q) => q.organization.id === access.organization.id,
        )}
        notificationBell={<NotificationBell />}
        activeRole={access.context.activeRole}
        grants={grants}
      />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

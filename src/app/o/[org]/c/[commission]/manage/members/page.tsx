import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getCommissionAccessByOrg,
  canConfigureCommission,
} from "@/lib/queries/session";
import {
  listMembers,
  listAddableMembers,
  listAdministrativos,
  listMemberCapabilities,
  type MemberCapability,
} from "@/lib/queries/members";
import { featureEnabled } from "@/lib/queries/feature-flags";
import { casePatientEnabled } from "@/lib/queries/cases";
import { listMemberTitles } from "@/lib/commissions/titles";
import { AddMemberDialog } from "@/components/members/add-member-dialog";
import { MemberList } from "@/components/members/member-list";

export const metadata: Metadata = {
  title: "Gerenciar membros",
};

/**
 * Commission member management (coordinator area). Lists members, adds staff from
 * the org's already-registered users (no invite-by-e-mail — new people are
 * registered by an org_admin), and removes staff.
 *
 * Access is gated HERE on the server in addition to RLS: only a `staff_admin` of
 * this commission OR a global admin may reach it. Everyone else (staff of this
 * commission, members of another commission, unknown slug) gets `notFound()` — a
 * 404 that reveals nothing, mirroring `admin/layout.tsx` and the Phase 2
 * foreign-commission behavior. RLS remains the ultimate boundary for the data.
 */
export default async function ManageMembersPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const access = await getCommissionAccessByOrg(org, commission);

  // Unknown/inaccessible slug, or a caller who is neither coordinator nor admin.
  if (!access || !canConfigureCommission(access)) {
    notFound();
  }

  const administrativoEnabled = await featureEnabled("administrativo");

  const [members, addable, titles, appointments, capabilities, casePatientOn] =
    await Promise.all([
      listMembers(access.commission.id),
      listAddableMembers(access.commission.id),
      listMemberTitles(access.commission.id),
      // Administrativo delegation (ADR 0061): only read when the feature is on.
      administrativoEnabled
        ? listAdministrativos(access.commission.id)
        : Promise.resolve([]),
      administrativoEnabled
        ? listMemberCapabilities(access.commission.id)
        : Promise.resolve([]),
      administrativoEnabled ? casePatientEnabled() : Promise.resolve(false),
    ]);

  // Fold the capability rows into a per-user map for the checklist.
  const capabilitiesByUser: Record<string, MemberCapability[]> = {};
  for (const grant of capabilities) {
    (capabilitiesByUser[grant.userId] ??= []).push(grant.capability);
  }
  const appointedUserIds = appointments.map((a) => a.userId);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Membros</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Adicione pessoas já cadastradas na plataforma a esta comissão e
          gerencie quem tem acesso.
        </p>
      </header>

      <section
        aria-labelledby="membros-heading"
        className="animate-rise-in flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="membros-heading" className="text-lg font-semibold">
            Membros da comissão
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {members.length} {members.length === 1 ? "pessoa" : "pessoas"}
            </span>
            <AddMemberDialog
              commissionId={access.commission.id}
              candidates={addable}
            />
          </div>
        </div>
        <MemberList
          commissionId={access.commission.id}
          members={members}
          currentUserId={access.context.userId}
          titles={titles}
          administrativoEnabled={administrativoEnabled}
          appointedUserIds={appointedUserIds}
          capabilitiesByUser={capabilitiesByUser}
          showPhiNotice={casePatientOn}
        />
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { listMembers, listAddableMembers } from "@/lib/queries/members";
import { AddMemberPicker } from "@/components/members/add-member-picker";
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
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const [members, addable] = await Promise.all([
    listMembers(access.commission.id),
    listAddableMembers(access.commission.id),
  ]);

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
        aria-labelledby="adicionar-heading"
        className="animate-rise-in rounded-2xl border border-border bg-card p-6 sm:p-7"
      >
        <h2 id="adicionar-heading" className="text-lg font-semibold">
          Adicionar membro
        </h2>
        <p className="mt-1 mb-5 max-w-prose text-sm text-muted-foreground">
          Escolha uma pessoa já cadastrada na organização. Membros podem preencher
          os formulários publicados da comissão.
        </p>
        <AddMemberPicker
          commissionId={access.commission.id}
          candidates={addable}
        />
      </section>

      <section
        aria-labelledby="membros-heading"
        className="animate-rise-in flex flex-col gap-4"
        style={{ ["--rise-delay" as string]: "80ms" }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="membros-heading" className="text-lg font-semibold">
            Membros da comissão
          </h2>
          <span className="text-sm text-muted-foreground">
            {members.length} {members.length === 1 ? "pessoa" : "pessoas"}
          </span>
        </div>
        <MemberList
          commissionId={access.commission.id}
          members={members}
          currentUserId={access.context.userId}
        />
      </section>
    </div>
  );
}

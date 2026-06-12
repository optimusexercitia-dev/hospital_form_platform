import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccess } from "@/lib/queries/session";
import { listMembers } from "@/lib/queries/members";
import { InviteStaffForm } from "@/components/members/invite-staff-form";
import { MemberList } from "@/components/members/member-list";

export const metadata: Metadata = {
  title: "Gerenciar membros",
};

/**
 * Commission member management (coordinator area). Lists members, invites staff
 * by e-mail, and removes staff.
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
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const access = await getCommissionAccess(slug);

  // Unknown/inaccessible slug, or a caller who is neither coordinator nor admin.
  if (!access || (access.role !== "staff_admin" && !access.context.isAdmin)) {
    notFound();
  }

  const members = await listMembers(access.commission.id);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Membros</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Convide pessoas para preencher os formulários desta comissão e
          gerencie quem tem acesso.
        </p>
      </header>

      <section
        aria-labelledby="convidar-heading"
        className="animate-rise-in rounded-2xl border border-border bg-card p-6 sm:p-7"
      >
        <h2 id="convidar-heading" className="text-lg font-semibold">
          Convidar membro
        </h2>
        <p className="mt-1 mb-5 max-w-prose text-sm text-muted-foreground">
          Membros podem preencher os formulários publicados da comissão.
        </p>
        <InviteStaffForm commissionId={access.commission.id} />
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

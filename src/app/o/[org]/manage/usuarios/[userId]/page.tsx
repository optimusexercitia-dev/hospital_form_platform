import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { adminedHospitals } from "@/lib/auth/access";
import { getOrgUser, listProfessionalCategories } from "@/lib/queries/org-users";
import {
  listHospitalsForOrg,
  listCommissionsForOrg,
  listManagedCommissions,
} from "@/lib/queries/org";
import { orgHref } from "@/lib/routing";
import { UserStatusBadge } from "@/components/users/user-status-badge";
import { UserProfileEditForm } from "@/components/users/user-profile-edit-form";
import { CredentialsEditor } from "@/components/users/credentials-editor";
import { CommitteeRoleAssigner } from "@/components/users/committee-role-assigner";
import { UserLifecycleActions } from "@/components/users/user-lifecycle-actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ org: string; userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const user = await getOrgUser(userId);
  return { title: user?.fullName ?? "Usuário" };
}

/**
 * Per-user management page (FE-3). Access is enforced by the `/o/[org]/manage`
 * layout (`is_org_admin_of(org)` OR hospital_admin-of-some-hospital-here);
 * `getOrgUser` is itself RLS-scoped (org_admin of the user's home org / a
 * hospital_admin of the user's home hospital / the user themselves /
 * platform_admin), so a foreign user id 404s here without leaking existence.
 * Full management surface: profile + credentials editor, committee/role
 * manager (the shared `CommitteeRoleAssigner`, `mode="live"`), and lifecycle
 * controls. For a `hospital_admin` (ADR 0051 Decision 7) the profile-form
 * hospital list + committee options are scoped to its hospital(s); the write
 * actions are themselves hospital-scoped server-side (RLS is the authority).
 */
export default async function OrgUserDetailPage({
  params,
}: {
  params: Promise<{ org: string; userId: string }>;
}) {
  const { org, userId } = await params;
  const context = await getSessionContext();
  const orgAdminEntry = context?.orgAdminOf.find(
    (o) => o.organization.slug === org,
  );
  const organization =
    orgAdminEntry?.organization ??
    context?.hospitalAdminOf.find((h) => h.organization.slug === org)
      ?.organization;

  // The layout already guarantees access; defensive (never expected).
  if (!organization || !context) {
    notFound();
  }

  const isOrgAdmin = Boolean(orgAdminEntry);
  // A hospital_admin's editable hospital list + commission options are scoped to
  // the hospital(s) it administers; an org_admin gets the org-wide lists.
  const adminHospitals = isOrgAdmin
    ? []
    : adminedHospitals(context, organization.id);

  const [user, categories, hospitals, commissions] = await Promise.all([
    getOrgUser(userId),
    listProfessionalCategories(),
    isOrgAdmin
      ? listHospitalsForOrg(organization.id)
      : Promise.resolve(
          adminHospitals.map((h) => ({
            id: h.id,
            name: h.name,
            slug: h.slug,
            commissionCount: 0,
          })),
        ),
    isOrgAdmin
      ? listCommissionsForOrg(organization.id)
      : listManagedCommissions(organization.id, adminHospitals[0]?.id ?? null),
  ]);

  if (!user) {
    notFound();
  }

  const displayName = user.fullName?.trim() || user.email || "Sem identificação";

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <Link
          href={orgHref(org, "manage", "usuarios")}
          className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Todos os usuários
        </Link>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {organization.name}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl text-balance">{displayName}</h1>
            <UserStatusBadge status={user.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {user.email ?? "Sem e-mail"}
          </p>
        </div>
      </header>

      <section
        aria-labelledby="lifecycle-heading"
        className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-7"
      >
        <h2 id="lifecycle-heading" className="text-lg font-semibold">
          Situação da conta
        </h2>
        <UserLifecycleActions
          userId={user.id}
          status={user.status}
          fullName={displayName}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section
          aria-labelledby="perfil-heading"
          className="animate-rise-in flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 sm:p-7"
          style={{ ["--rise-delay" as string]: "60ms" }}
        >
          <div>
            <h2 id="perfil-heading" className="text-lg font-semibold">
              Perfil
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Dados pessoais e vínculo com o hospital.
            </p>
          </div>
          <UserProfileEditForm
            user={user}
            categories={categories}
            hospitals={hospitals}
          />
        </section>

        <section
          aria-labelledby="credenciais-heading"
          className="animate-rise-in flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 sm:p-7"
          style={{ ["--rise-delay" as string]: "100ms" }}
        >
          <div>
            <h2 id="credenciais-heading" className="text-lg font-semibold">
              Registros profissionais
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Conselhos de classe (CRM, COREN, CRF…). Editar limpa a
              verificação atual.
            </p>
          </div>
          <CredentialsEditor
            mode="live"
            userId={user.id}
            credentials={user.credentials}
          />
        </section>
      </div>

      <section
        aria-labelledby="comissoes-heading"
        className="animate-rise-in flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 sm:p-7"
        style={{ ["--rise-delay" as string]: "140ms" }}
      >
        <div>
          <h2 id="comissoes-heading" className="text-lg font-semibold">
            Comissões
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Comissões das quais esta pessoa participa, e o papel em cada uma.
          </p>
        </div>
        <CommitteeRoleAssigner
          mode="live"
          userId={user.id}
          commissions={commissions}
          assignments={user.committees.map((c) => ({
            commissionId: c.commissionId,
            commissionName: c.commissionName,
            role: c.role,
          }))}
        />
      </section>
    </div>
  );
}

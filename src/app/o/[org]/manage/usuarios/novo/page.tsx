import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { listHospitalsForOrg, listCommissionsForOrg } from "@/lib/queries/org";
import { listProfessionalCategories } from "@/lib/queries/org-users";
import { isEmailVerificationEnabled } from "@/lib/config/auth";
import { orgHref } from "@/lib/routing";
import { RegisterUserForm } from "@/components/users/register-user-form";

export const metadata: Metadata = {
  title: "Registrar pessoa",
};

/**
 * Register-user page (FE-2). Access is enforced by the `/o/[org]/manage`
 * layout (`is_org_admin_of(org)`); we re-resolve the org from
 * `context.orgAdminOf` for the org-scoped reads that feed the form's selects
 * (professional categories are global vocabulary; hospitals/commissions are
 * org-scoped, reusing the existing `listHospitalsForOrg`/`listCommissionsForOrg`
 * — no new backend query needed).
 */
export default async function OrgRegisterUserPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const context = await getSessionContext();
  const organization = context?.orgAdminOf.find(
    (o) => o.organization.slug === org,
  )?.organization;

  // The layout already guarantees access; defensive (never expected).
  if (!organization) {
    notFound();
  }

  const [categories, hospitals, commissions] = await Promise.all([
    listProfessionalCategories(),
    listHospitalsForOrg(organization.id),
    listCommissionsForOrg(organization.id),
  ]);

  // Server-only onboarding flag: when email verification is OFF (default), the
  // admin sets an initial password and the account is created active; when ON,
  // the invite-email flow returns. Read here so the helper never leaks into the
  // client bundle.
  const emailVerificationEnabled = isEmailVerificationEnabled();

  return (
    <div className="flex flex-col gap-8">
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
          <h1 className="text-3xl text-balance">Registrar pessoa</h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            {emailVerificationEnabled
              ? "A pessoa recebe um convite por e-mail para verificar o endereço e definir uma senha. O status começa como pendente até a ativação."
              : "Defina uma senha inicial para a pessoa. A conta é ativada imediatamente e o acesso deve ser repassado com segurança — a pessoa pode alterar a senha depois."}
          </p>
        </div>
      </header>

      <div className="animate-rise-in max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-7">
        <RegisterUserForm
          organizationId={organization.id}
          categories={categories}
          hospitals={hospitals}
          commissions={commissions}
          emailVerificationEnabled={emailVerificationEnabled}
        />
      </div>
    </div>
  );
}

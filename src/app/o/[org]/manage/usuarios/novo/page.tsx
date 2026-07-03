import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { adminedHospitals } from "@/lib/auth/access";
import {
  listHospitalsForOrg,
  listCommissionsForOrg,
  listManagedCommissions,
} from "@/lib/queries/org";
import { listProfessionalCategories } from "@/lib/queries/org-users";
import { isEmailVerificationEnabled } from "@/lib/config/auth";
import { orgHref } from "@/lib/routing";
import { RegisterUserForm } from "@/components/users/register-user-form";

export const metadata: Metadata = {
  title: "Registrar pessoa",
};

/**
 * Register-user page (FE-2). Access is enforced by the `/o/[org]/manage` layout
 * (`is_org_admin_of(org)` OR hospital_admin-of-some-hospital-here).
 *
 * An `org_admin` gets a free home-hospital picker + the org's commissions. A
 * `hospital_admin` (ADR 0051 Decision 7 / Q2) registers people INTO its own
 * hospital: the home hospital is LOCKED to that hospital (a read-only display,
 * not a chooser — the backend hard-sets it server-side regardless) and the
 * commission assigner is scoped to that hospital. The hospital is resolved from
 * `?hospital=` (deep-linked from the directory), defaulting to the admin's first.
 * Professional categories are global vocabulary.
 */
export default async function OrgRegisterUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ hospital?: string }>;
}) {
  const { org } = await params;
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
  const sp = await searchParams;

  // Resolve the locked hospital for a hospital_admin (its selected/first).
  const adminHospitals = isOrgAdmin
    ? []
    : adminedHospitals(context, organization.id);
  const lockedHospitalRef = isOrgAdmin
    ? null
    : (adminHospitals.find((h) => h.id === sp.hospital) ??
      adminHospitals[0] ??
      null);

  // An org_admin gets the org-wide hospital picker + commissions; a
  // hospital_admin gets its hospital's commissions only (the picker is locked).
  const [categories, hospitals, commissions] = await Promise.all([
    listProfessionalCategories(),
    isOrgAdmin
      ? listHospitalsForOrg(organization.id)
      : Promise.resolve([]),
    isOrgAdmin
      ? listCommissionsForOrg(organization.id)
      : listManagedCommissions(organization.id, lockedHospitalRef?.id ?? null),
  ]);

  // Server-only onboarding flag: when email verification is OFF (default), the
  // admin sets an initial password and the account is created active; when ON,
  // the invite-email flow returns. Read here so the helper never leaks into the
  // client bundle.
  const emailVerificationEnabled = isEmailVerificationEnabled();

  const backHref =
    !isOrgAdmin && lockedHospitalRef
      ? `${orgHref(org, "manage", "usuarios")}?hospital=${encodeURIComponent(lockedHospitalRef.id)}`
      : orgHref(org, "manage", "usuarios");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          href={backHref}
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
          lockedHospital={
            lockedHospitalRef
              ? { id: lockedHospitalRef.id, name: lockedHospitalRef.name }
              : undefined
          }
        />
      </div>
    </div>
  );
}

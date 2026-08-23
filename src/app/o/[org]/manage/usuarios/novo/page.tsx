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
import { RegisterPersonFlow } from "@/components/users/register-person-flow";

export const metadata: Metadata = {
  title: "Registrar pessoa",
};

/**
 * Register-person page. Access is enforced by the `/o/[org]/manage` layout
 * (`is_org_admin_of(org)` OR hospital_admin-of-some-hospital-here).
 *
 * ⚠ AFF W3/T3.1 (ADR 0097 D12): this stopped being a create-only surface. It keeps its
 * label and its route, and resolves an identifier BEFORE it creates — one flow with
 * four outcomes, because forcing the admin to know in advance which case they are in
 * is the original defect. The interactive half lives in `RegisterPersonFlow`; this
 * Server Component only resolves scope and loads the vocabulary it needs.
 *
 * An `org_admin` may employ someone at any hospital of the org. A `hospital_admin`
 * (ADR 0051 Decision 7 / Q2) registers people INTO its own hospital: the hospital is
 * LOCKED (a read-only display, not a chooser — the backend hard-sets it server-side
 * regardless) and the commission assigner is scoped to that hospital. The hospital is
 * resolved from `?hospital=` (deep-linked from the directory), defaulting to the
 * admin's first. Professional categories are global vocabulary.
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

  // An org_admin gets the org-wide hospital list + commissions; a hospital_admin gets
  // its hospital's commissions only (the hospital is locked).
  const [categories, hospitals, commissions] = await Promise.all([
    listProfessionalCategories(),
    isOrgAdmin ? listHospitalsForOrg(organization.id) : Promise.resolve([]),
    isOrgAdmin
      ? listCommissionsForOrg(organization.id)
      : listManagedCommissions(organization.id, lockedHospitalRef?.id ?? null),
  ]);

  // Server-only onboarding flag: when email verification is OFF (default), the
  // admin sets an initial password and the account is created active; when ON,
  // the invite-email flow returns. Read here so the helper never leaks into the
  // client bundle.
  const emailVerificationEnabled = isEmailVerificationEnabled();

  const lockedHospital = lockedHospitalRef
    ? { id: lockedHospitalRef.id, name: lockedHospitalRef.name }
    : undefined;

  // Never offer a hospital the door will refuse: an org_admin may employ anywhere in
  // the org, a hospital_admin only at the hospital they administer.
  const affiliableHospitals = isOrgAdmin
    ? hospitals.map((h) => ({ id: h.id, name: h.name }))
    : lockedHospital
      ? [lockedHospital]
      : [];

  const backHref =
    !isOrgAdmin && lockedHospitalRef
      ? `${orgHref(org, "manage", "usuarios")}?hospital=${encodeURIComponent(lockedHospitalRef.id)}`
      : orgHref(org, "manage", "usuarios");

  return (
    // Centered single column (handoff §Screen 3). The header travels with the wizard
    // rather than staying flush left, so the back link, the title and the step card
    // read as one object instead of a narrow card adrift under a wide heading.
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
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
              ? "Comece pelo CPF. Se a pessoa ainda não tiver cadastro, ela recebe um convite por e-mail para verificar o endereço e definir uma senha."
              : "Comece pelo CPF. Se a pessoa ainda não tiver cadastro, você define uma senha inicial e a conta é ativada imediatamente."}
          </p>
        </div>
      </header>

      <RegisterPersonFlow
        org={org}
        organizationId={organization.id}
        organizationName={organization.name}
        isOrgAdmin={isOrgAdmin}
        affiliableHospitals={affiliableHospitals}
        lockedHospital={lockedHospital}
        categories={categories}
        commissions={commissions}
        emailVerificationEnabled={emailVerificationEnabled}
      />
    </div>
  );
}

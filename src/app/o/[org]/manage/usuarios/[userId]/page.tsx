import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";

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
import { AffiliationsPanel } from "@/components/users/affiliations-panel";
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
 * `getOrgUser` is itself RLS-scoped, so a foreign user id 404s here without leaking
 * existence.
 *
 * ⚠ AFF W3/T3.3 (ADR 0097 D14) — FIELD OWNERSHIP splits this page in two.
 * PERSON-level facts (name, CPF, professional category, council credentials) belong to
 * the human and are `org_admin`-only. EMPLOYMENT facts (which hospital, matrícula,
 * start, end) belong to the hospital, and that hospital's own admin owns them. Account
 * deactivation is deliberately unreachable by a hospital admin: `app.is_active` is a
 * platform-wide kill switch, so one hospital's offboarding must never end a
 * professional's access at another — that is `end_affiliation`, in the affiliations
 * panel.
 *
 * Each `can*` flag below is UX ONLY. Every one of these surfaces re-derives the
 * caller's authority server-side and refuses in pt-BR (`MESSAGES.orgAdminOnly`), and
 * the affiliation doors re-derive theirs inside PostgreSQL. Hiding a control is never
 * the protection (Architecture Rule 1).
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
  // A hospital_admin's affiliation rows + commission options are scoped to the
  // hospital(s) it administers; an org_admin gets the org-wide lists.
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
  const manageableHospitals = hospitals.map((h) => ({ id: h.id, name: h.name }));

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
          canManageAccountStatus={isOrgAdmin}
        />
      </section>

      <section
        aria-labelledby="vinculos-heading"
        className="animate-rise-in flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 sm:p-7"
        style={{ ["--rise-delay" as string]: "60ms" }}
      >
        <div>
          <h2 id="vinculos-heading" className="text-lg font-semibold">
            Vínculos hospitalares
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground text-pretty">
            Onde esta pessoa trabalha nesta organização. Cada vínculo tem a sua
            matrícula. Encerrar um vínculo preserva o histórico e não afeta a
            conta nem os outros hospitais.
          </p>
        </div>
        <AffiliationsPanel
          userId={user.id}
          personName={displayName}
          affiliations={user.affiliations}
          manageableHospitalIds={manageableHospitals.map((h) => h.id)}
          addableHospitals={manageableHospitals}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section
          aria-labelledby="perfil-heading"
          className="animate-rise-in flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 sm:p-7"
          style={{ ["--rise-delay" as string]: "100ms" }}
        >
          <div>
            <h2 id="perfil-heading" className="text-lg font-semibold">
              Dados pessoais
            </h2>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              Fatos sobre a pessoa, não sobre um hospital.
            </p>
          </div>
          <UserProfileEditForm
            user={user}
            categories={categories}
            canEditPersonFields={isOrgAdmin}
          />
        </section>

        <section
          aria-labelledby="credenciais-heading"
          className="animate-rise-in flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 sm:p-7"
          style={{ ["--rise-delay" as string]: "140ms" }}
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
          {isOrgAdmin ? (
            <CredentialsEditor
              mode="live"
              userId={user.id}
              credentials={user.credentials}
            />
          ) : (
            <CredentialsReadOnly credentials={user.credentials} />
          )}
        </section>
      </div>

      <section
        aria-labelledby="comissoes-heading"
        className="animate-rise-in flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 sm:p-7"
        style={{ ["--rise-delay" as string]: "180ms" }}
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

/**
 * Council credentials for a caller who does not own them (ADR 0097 D14 — a council
 * registration is a fact about the person, and `upsertCredential` is `org_admin`-only
 * server-side). Read-only, with the reason stated rather than the section vanishing.
 */
function CredentialsReadOnly({
  credentials,
}: {
  credentials: { id: string; issuingAuthority: string; issuingState: string; registrationNumber: string }[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {credentials.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum registro profissional cadastrado.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {credentials.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-sm font-medium"
            >
              {c.issuingAuthority}/{c.issuingState} {c.registrationNumber}
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-start gap-2 text-sm text-muted-foreground text-pretty">
        <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        Registros de conselho são dados da pessoa e só podem ser alterados por um
        administrador da organização.
      </p>
    </div>
  );
}

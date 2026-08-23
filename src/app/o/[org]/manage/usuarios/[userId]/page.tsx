import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, ShieldAlert } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { adminedHospitals } from "@/lib/auth/access";
import { getOrgUser, listProfessionalCategories } from "@/lib/queries/org-users";
import { getPersonAdminView } from "@/lib/users/person-footprint";
import {
  listHospitalsForOrg,
  listCommissionsForOrg,
  listManagedCommissions,
} from "@/lib/queries/org";
import { orgHref } from "@/lib/routing";
import { UserStatusBadge } from "@/components/users/user-status-badge";
import { PersonAvatar } from "@/components/users/person-avatar";
import { PersonalDataCard } from "@/components/users/personal-data-card";
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
 * Per-user management page (AFF2 F2 — handoff §Screen 2, ADR 0133 D1–D3 + Amdt 1).
 * Access is enforced by the `/o/[org]/manage` layout; `getOrgUser` is itself RLS-scoped,
 * so a foreign user id 404s here without leaking existence.
 *
 * ⚠ AUTHORITY IS PER-CAPABILITY, NOT PER-PERSON — the whole point of Amendment 1, and
 * the thing this page's shape exists to express. The two booleans come from B6's
 * `getPersonAdminView`, computed server-side from the SAME footprint inputs the actions
 * use, and are passed down as plain props:
 *
 *   · `canEditPerson`             — INTERSECTION. The person's footprint overlaps the
 *                                   caller's administered hospitals. Gates the Dados
 *                                   pessoais and Registros profissionais edit
 *                                   affordances.
 *   · `canManageAccountLifecycle` — SUBSET. The footprint is entirely inside the
 *                                   caller's set. Gates Desativar / Suspender /
 *                                   Reativar, and the CPF field inside the edit form.
 *
 * They genuinely DISAGREE on a person who works at more than one hospital: that admin
 * may fix a name and may not rewrite the person key or end the account. The old
 * "somente organização" absolute is retired — the copy now names which half is out of
 * reach.
 *
 * ⛔ NEVER RE-DERIVED CLIENT-SIDE. A second derivation is a second thing to drift, and
 * on this boundary drift means an affordance offered where the action will refuse.
 *
 * ⚠ Both flags are UX ONLY (Architecture Rule 1). Every surface re-derives the caller's
 * authority server-side and refuses in pt-BR; the affiliation doors re-derive theirs
 * inside PostgreSQL. Hiding a control is never the protection.
 *
 * ⚠ `personalData === null` means WITHHELD, not "nothing informed" — `PersonalDataCard`
 * owns that branch and must not collapse it into empty values.
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

  const [user, adminView, categories, hospitals, commissions] = await Promise.all([
    getOrgUser(userId),
    getPersonAdminView(userId),
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

  const { personalData, authority } = adminView;
  const displayName = user.fullName?.trim() || user.email || "Sem identificação";
  const manageableHospitals = hospitals.map((h) => ({ id: h.id, name: h.name }));
  const primaryCredential = user.credentials[0] ?? null;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={orgHref(org, "manage", "usuarios")}
        className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Todos os usuários
      </Link>

      {/* Identity band — who this is, at a glance, with the account actions beside it. */}
      <section
        aria-labelledby="identidade-heading"
        className="animate-rise-in flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-6 shadow-xs"
      >
        <PersonAvatar fullName={user.fullName} email={user.email} size="lg" />

        <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 id="identidade-heading" className="text-2xl text-balance">
              {displayName}
            </h1>
            <UserStatusBadge status={user.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {user.email ?? "Sem e-mail"}
            {user.categoryLabel ? ` · ${user.categoryLabel}` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {primaryCredential ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-mono text-[0.7rem] text-foreground">
                {primaryCredential.issuingAuthority}/
                {primaryCredential.issuingState}{" "}
                {primaryCredential.registrationNumber}
                {primaryCredential.verifiedAt ? (
                  <span className="inline-flex items-center gap-1 font-sans font-semibold text-success">
                    <BadgeCheck aria-hidden="true" className="size-3" />
                    verificado
                  </span>
                ) : null}
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[0.7rem] font-medium text-muted-foreground">
              Na organização desde {formatIsoDatePtBr(user.createdAt)}
            </span>
          </div>
        </div>

        <UserLifecycleActions
          userId={user.id}
          status={user.status}
          fullName={displayName}
          canManageAccountStatus={authority.canManageAccountLifecycle}
        />
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <section
            aria-labelledby="vinculos-heading"
            className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-xs"
            style={{ ["--rise-delay" as string]: "40ms" }}
          >
            <div>
              <h2 id="vinculos-heading" className="text-base font-semibold">
                Vínculos hospitalares
              </h2>
              <p className="mt-1 max-w-prose text-sm text-muted-foreground text-pretty">
                Onde esta pessoa trabalha. Encerrar um vínculo preserva o
                histórico e não afeta a conta nem os outros hospitais.
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

          <section
            aria-labelledby="comissoes-heading"
            className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-xs"
            style={{ ["--rise-delay" as string]: "80ms" }}
          >
            <div>
              <h2 id="comissoes-heading" className="text-base font-semibold">
                Comissões
              </h2>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
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

        <aside className="flex min-w-0 flex-col gap-5">
          <PersonalDataCard
            user={user}
            categories={categories}
            personalData={personalData}
            canEditPerson={authority.canEditPerson}
            canManageAccountLifecycle={authority.canManageAccountLifecycle}
          />

          <section
            aria-labelledby="credenciais-heading"
            className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
            style={{ ["--rise-delay" as string]: "140ms" }}
          >
            <h2 id="credenciais-heading" className="text-base font-semibold">
              Registros profissionais
            </h2>
            {authority.canEditPerson ? (
              <CredentialsEditor
                mode="live"
                userId={user.id}
                credentials={user.credentials}
              />
            ) : (
              <CredentialsReadOnly credentials={user.credentials} />
            )}
            <p className="border-t border-border pt-3 text-[0.7rem] text-muted-foreground text-pretty">
              Conselhos de classe (CRM, COREN, CRF…). Editar limpa a verificação
              atual.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

/**
 * Council credentials for a caller without the `fields` capability. Read-only, with the
 * reason stated rather than the section vanishing — a missing section reads as "this
 * person has none", which is the ambiguity ADR 0133 D13 widened the RLS to avoid.
 */
function CredentialsReadOnly({
  credentials,
}: {
  credentials: {
    id: string;
    issuingAuthority: string;
    issuingState: string;
    registrationNumber: string;
  }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {credentials.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum registro profissional cadastrado.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {credentials.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-xs font-medium"
            >
              {c.issuingAuthority}/{c.issuingState} {c.registrationNumber}
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-start gap-2 text-[0.75rem] text-muted-foreground text-pretty">
        <ShieldAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        Registros de conselho são dados da pessoa e são alterados pela
        administração da organização.
      </p>
    </div>
  );
}

/**
 * ISO date → pt-BR, read as LOCAL calendar parts. `new Date(iso)` on a bare date parses
 * as UTC midnight and renders the PREVIOUS day west of Greenwich.
 */
function formatIsoDatePtBr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("pt-BR").format(new Date(y, m - 1, d));
}

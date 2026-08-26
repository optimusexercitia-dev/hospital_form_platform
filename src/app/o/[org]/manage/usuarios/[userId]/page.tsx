import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { adminedHospitals } from "@/lib/auth/access";
import { getOrgUser, listProfessionalCategories } from "@/lib/queries/org-users";
import { formatCouncilRegistration } from "@/lib/users/types";
import {
  getPersonAdminView,
  resolvePlatformFootprint,
} from "@/lib/users/person-footprint";
import { listPersonAccountHistory } from "@/lib/queries/audit";
import {
  listHospitalsForOrg,
  listCommissionsForOrg,
  listManagedCommissions,
} from "@/lib/queries/org";
import { orgHref } from "@/lib/routing";
import { UserStatusBadge } from "@/components/users/user-status-badge";
import { PersonAvatar } from "@/components/users/person-avatar";
import { AccountSituationBanner } from "@/components/users/account-situation-banner";
import { AccountHistoryCard } from "@/components/users/account-history-card";
import { AccessCard } from "@/components/users/access-card";
import { PersonalDataCard } from "@/components/users/personal-data-card";
import { CredentialsCard } from "@/components/users/credentials-card";
import { AffiliationsPanel } from "@/components/users/affiliations-panel";
import { CommitteesPanel } from "@/components/users/committees-panel";
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
 * Per-user profile page (AFF2 F2 — ADR 0133 D1–D3 + Amdt 1; redesign frame 2a).
 * Access is enforced by the `/o/[org]/manage` layout; `getOrgUser` is itself RLS-scoped,
 * so a foreign user id 404s here without leaking existence.
 *
 * ⚠ INFORMATION HIERARCHY IS THE DESIGN, not a layout preference. Reading order is
 * situação da conta → vínculos hospitalares → comissões → histórico, with the person's
 * own facts in the rail. It is ordered by what an admin arrives to DO: the account's
 * state and the two offboarding paths first, the identity fields last — because getting
 * those two paths confused is the expensive mistake this screen exists to prevent
 * (deactivating an account ends access everywhere; ending a vínculo ends it at one
 * hospital).
 *
 * ⚠ AUTHORITY IS PER-CAPABILITY, NOT PER-PERSON — the whole point of ADR 0133
 * Amendment 1, and the thing this page's shape exists to express. The two booleans come
 * from B6's `getPersonAdminView`, computed server-side from the SAME footprint inputs
 * the actions use, and are passed down as plain props:
 *
 *   · `canEditPerson`             — INTERSECTION. The person's footprint overlaps the
 *                                   caller's administered hospitals. Gates the Dados
 *                                   pessoais and Registros profissionais edit
 *                                   affordances.
 *   · `canManageAccountLifecycle` — SUBSET. The footprint is entirely inside the
 *                                   caller's set. Gates Desativar / Suspender /
 *                                   Reativar, and the CPF field inside the edit dialog.
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
 *
 * ⚠ THREE FIELDS THE DESIGN ASKS FOR ARE DELIBERATELY ABSENT: `Especialidade`, `Início
 * na comissão` and `Último acesso` (both the identity chip and the Acesso row — it would
 * need `auth.users.last_sign_in_at`). No column stores any of them. They are omitted
 * cleanly rather than rendered as a placeholder, because a dash in a definition list
 * reads as a fact about the person ("never signed in", "no specialty") rather than as a
 * gap in the schema.
 *
 * ⚠ AFF4 F3 (ADR 0151 D3/D8) adds a THIRD capability, deliberately not folded into the
 * two above: `isOrgAdmin` — computed a few lines up for the layout gate already, and
 * reused here verbatim as `UserLifecycleActions`' `canEndOrgAffiliation` — is org_admin
 * ONLY, with no footprint bound at all, because D8 gives void/end-org authority to
 * org_admin (or that hospital's admin, for the hospital tier) unconditionally. It can
 * disagree with `canManageAccountLifecycle` in either direction once a person can hold
 * more than one org affiliation (home org demoted, AFF4 Phase 2). `resolvePlatformFootprint`
 * is the fourth new input: a platform-wide (non-RLS-scoped), server-only read that gates
 * the org-offboarding wizard's step-3 deactivation OFFER — never permission, which
 * `deactivateUser` still re-derives on its own.
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

  const [user, adminView, footprint, categories, hospitals, commissions, history] =
    await Promise.all([
      getOrgUser(userId),
      getPersonAdminView(userId),
      // AFF4 F3 (ADR 0151 D3/D12) — the platform-wide footprint check that gates the
      // org-offboarding wizard's step 3 offer. Server-only, resolved once here and
      // passed down as a plain prop, same pattern as `getPersonAdminView` on this
      // same screen.
      //
      // ⛔ DELIBERATELY UNWRAPPED — do not add a try/catch here, and do not fall back
      // to a default footprint on error. `resolvePlatformFootprint` FAILS CLOSED: a
      // partial or failed read throws rather than returning `isEmpty: true`, because
      // an undetermined footprint reported as "empty" is precisely what would offer
      // to deactivate an account that still holds one. A throw here is therefore the
      // HONEST outcome, not a defect to route around — it renders through this
      // route's existing `usuarios/error.tsx` boundary (which already covers
      // `[userId]`, see that file's own scope comment), never as a raw message
      // (CLAUDE.md §8), and never as a silent "no offer" that looks like success.
      resolvePlatformFootprint(userId),
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
      listPersonAccountHistory(userId),
    ]);

  if (!user) {
    notFound();
  }

  const { personalData, authority } = adminView;
  const displayName = user.fullName?.trim() || user.email || "Sem identificação";
  const manageableHospitals = hospitals.map((h) => ({ id: h.id, name: h.name }));
  const primaryCredential = user.credentials[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Trilha de navegação">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <li>
            <Link
              href={orgHref(org, "manage", "usuarios")}
              className="rounded-md transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              Usuários
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="min-w-0 truncate font-semibold text-foreground">
            {displayName}
          </li>
        </ol>
      </nav>

      {/* Identity band — who this is, at a glance, with the account actions beside it. */}
      <section
        aria-labelledby="identidade-heading"
        className="animate-rise-in flex flex-wrap items-center gap-4.5 rounded-2xl border border-border bg-card p-6 shadow-xs"
      >
        <PersonAvatar fullName={user.fullName} email={user.email} size="lg" />

        <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 id="identidade-heading" className="text-[1.4rem] text-balance">
              {displayName}
            </h1>
            <UserStatusBadge status={user.status} />
          </div>
          <p className="text-[0.8rem] text-muted-foreground">
            {user.email ?? "Sem e-mail"}
            {user.categoryLabel ? ` · ${user.categoryLabel}` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {primaryCredential ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-mono text-[0.68rem] text-foreground">
                {formatCouncilRegistration(
                  primaryCredential.issuingAuthority,
                  primaryCredential.issuingState,
                  primaryCredential.registrationNumber,
                )}
                {primaryCredential.verifiedAt ? (
                  <span className="inline-flex items-center gap-1 font-sans font-semibold text-success">
                    <BadgeCheck aria-hidden="true" className="size-3" />
                    verificado
                  </span>
                ) : null}
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[0.68rem] font-medium text-muted-foreground">
              Na organização desde {formatIsoDatePtBr(user.createdAt)}
            </span>
          </div>
        </div>

        <UserLifecycleActions
          userId={user.id}
          status={user.status}
          fullName={displayName}
          canManageAccountStatus={authority.canManageAccountLifecycle}
          canEndOrgAffiliation={isOrgAdmin}
          organizationId={organization.id}
          organizationName={organization.name}
          footprint={footprint}
        />
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_19.75rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <AccountSituationBanner
            status={user.status}
            suspendedUntil={user.suspendedUntil}
          />

          <AffiliationsPanel
            userId={user.id}
            personName={displayName}
            affiliations={user.affiliations}
            manageableHospitalIds={manageableHospitals.map((h) => h.id)}
            addableHospitals={manageableHospitals}
          />

          <CommitteesPanel
            userId={user.id}
            personName={displayName}
            memberships={user.committees}
            commissions={commissions.map((c) => ({
              id: c.id,
              name: c.name,
              hospitalName: c.hospitalName,
            }))}
          />

          <AccountHistoryCard events={history} />
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <PersonalDataCard
            user={user}
            categories={categories}
            personalData={personalData}
            canEditPerson={authority.canEditPerson}
            canManageAccountLifecycle={authority.canManageAccountLifecycle}
          />

          <CredentialsCard
            userId={user.id}
            personName={displayName}
            credentials={user.credentials}
            canEdit={authority.canEditPerson}
          />

          <AccessCard
            userId={user.id}
            personName={displayName}
            email={user.email}
            createdAt={user.createdAt}
            emailConfirmedAt={user.emailConfirmedAt}
          />
        </aside>
      </div>
    </div>
  );
}

/**
 * ISO timestamp → pt-BR. `profiles.created_at` is a TIMESTAMP, so parsing it as an
 * instant is correct here; the DATE columns on this page (`started_on`, `date_of_birth`)
 * are read as local calendar parts instead, because parsing those as instants renders
 * the PREVIOUS day west of Greenwich.
 */
function formatIsoDatePtBr(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

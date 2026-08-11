import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Tags } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { getCaseTypeTerminology, listCaseTypes } from "@/lib/queries/case-types";
import { caseTypesEnabled } from "@/lib/queries/feature-flags";
import { CaseTypeManager } from "@/components/org/case-type-manager";
import { listCaseParticipantRolesForAdmin } from "@/lib/queries/participants";
import type { CaseTypeTerminology } from "@/lib/cases/terminology";

export const metadata: Metadata = {
  title: "Tipos de caso",
};

/**
 * The org_admin-only case-TYPE vocabulary surface (ADR 0064 Decision 4).
 *
 * A case type is org-scoped config: a process template declares one, and every case the
 * process opens snapshots it — inheriting the type's default visibility and
 * confidentiality. That makes this an ACCESS surface, which is why it is org-level-only
 * (a hospital_admin does not reach it), mirroring "Administradores".
 *
 * Access is enforced HERE in addition to the `/o/[org]/manage` layout gate and the
 * actions' own `is_org_admin_of` re-check, which RLS (`case_types_admin_write`) backs
 * regardless of what the UI allows.
 *
 * Lists RETIRED types too (`activeOnly: false`) — the manager renders them in a separate
 * group and offers "Reativar".
 */
export default async function OrgCaseTypesPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const context = await getSessionContext();
  const organization = context?.orgAdminOf.find(
    (o) => o.organization.slug === org,
  )?.organization;

  // Org-level-only surface (ADR 0051 Decision 1) — a hospital_admin does not reach it.
  if (!organization) {
    notFound();
  }

  // The vocabulary is inert while the flag is off (the create RPCs skip the type's
  // default-inheritance branch), so the surface would mislead rather than help.
  if (!(await caseTypesEnabled())) {
    notFound();
  }

  const caseTypes = await listCaseTypes(organization.id, { activeOnly: false });

  // ETH·E4 §4 — the org's participant-role vocabulary (active + inactive) and,
  // for each case type, its RESOLVED terminology bundle (override rows merged
  // over the platform default). Both feed `CaseTypeManager`'s new editors.
  // `caseTypes` is a bounded, org-scoped list — fetching every type's
  // terminology upfront (rather than per-dialog-open) keeps the manager a
  // plain server-props component like the rest of this page.
  const [participantRoles, terminologyEntries] = await Promise.all([
    listCaseParticipantRolesForAdmin(organization.id),
    Promise.all(
      caseTypes.map(
        async (t) => [t.id, await getCaseTypeTerminology(t.id)] as const,
      ),
    ),
  ]);
  const terminologyByCaseTypeId: Record<string, CaseTypeTerminology> =
    Object.fromEntries(terminologyEntries);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {organization.name}
        </p>
        <h1 className="inline-flex items-center gap-2.5 text-3xl text-balance">
          <Tags aria-hidden="true" className="size-7 text-primary" />
          Tipos de caso
        </h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Um tipo de caso define como os casos de um processo são chamados e quem
          pode vê-los por padrão. Cada processo declara um tipo, e os casos abertos
          por ele herdam essas definições no momento da criação.
        </p>
      </header>

      <section
        aria-labelledby="case-types-heading"
        className="animate-rise-in flex max-w-3xl flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-7"
      >
        <h2 id="case-types-heading" className="text-lg font-semibold">
          Vocabulário da organização
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          A visibilidade padrão vale apenas para casos criados depois da alteração —
          casos já existentes mantêm o que foi definido na criação. Desativar um tipo
          o remove das listas de seleção sem alterar nada que já o utilize.
        </p>
        <CaseTypeManager
          organizationId={organization.id}
          caseTypes={caseTypes}
          terminologyByCaseTypeId={terminologyByCaseTypeId}
          participantRoles={participantRoles}
        />
      </section>
    </div>
  );
}

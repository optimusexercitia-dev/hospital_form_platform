import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  FolderKanban,
  ScrollText,
  Users,
} from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { adminedHospitals } from "@/lib/auth/access";
import { orgHref } from "@/lib/routing";
import { auditTrailEnabled } from "@/lib/queries/audit";
import { patientSafetyEnabled } from "@/lib/queries/pqs";
import {
  getOrgCommissionOverview,
  listHospitalsForOrg,
  listManagedCommissions,
} from "@/lib/queries/org";
import { HospitalSwitcher } from "@/components/shell/hospital-switcher";
import { RiseInGroup } from "@/components/motion/rise-in-group";
import { StatCount } from "@/components/admin/stat-count";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Administração da organização",
};

interface ManageArea {
  title: string;
  description: string;
  segments: string[];
  icon: typeof Building2;
  requiresFeature?: "audit" | "patientSafety";
  /** Org-level-only surface — hidden for a hospital-scoped `hospital_admin`
   * (ADR 0051 Decision 1). */
  orgAdminOnly?: boolean;
}

const AREAS: ManageArea[] = [
  {
    title: "Comissões",
    description:
      "Crie comissões, atribua coordenadores e administre os dados de cada uma.",
    segments: ["comissoes"],
    icon: FolderKanban,
  },
  {
    title: "Usuários",
    description: "Registre pessoas e gerencie o acesso à plataforma.",
    segments: ["usuarios"],
    icon: Users,
  },
  {
    title: "Hospitais",
    description:
      "Cadastre e organize os hospitais da sua organização.",
    segments: ["hospitais"],
    icon: Building2,
    orgAdminOnly: true,
  },
  {
    title: "Painel",
    description:
      "Acompanhe o volume de respostas enviadas em todas as comissões.",
    segments: ["painel"],
    icon: BarChart3,
  },
  {
    title: "Coordenação do NSP",
    description:
      "Nomeie quem coordena o Núcleo de Segurança do Paciente e gerencia a equipe.",
    segments: ["equipe-nsp"],
    icon: ShieldCheck,
    requiresFeature: "patientSafety",
  },
  {
    title: "Administradores",
    description:
      "Nomeie administradores de hospital e a administração do NSP da organização.",
    segments: ["administradores"],
    icon: Users,
    orgAdminOnly: true,
  },
  {
    title: "Trilha de auditoria",
    description:
      "Reveja o registro das ações de administração da organização.",
    segments: ["audit"],
    icon: ScrollText,
    requiresFeature: "audit",
  },
];

/**
 * Organization-management landing. Server Component — the area gate lives in the
 * layout (`is_org_admin_of(org)` OR hospital_admin-of-some-hospital-here); this
 * resolves the org's display name for the greeting and lists the management
 * areas as cards. The audit card only renders when the `audit_trail` flag is
 * on; org-level-only cards (`orgAdminOnly`) are hidden for a hospital-scoped
 * caller. A caller who administers more than one hospital gets the hospital
 * switcher (ADR 0051 Decision 7).
 */
export default async function OrgManageHomePage({
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
  const hospitals = isOrgAdmin
    ? [] // org_admin sees the org-wide view; the switcher scope is decided per sub-page.
    : adminedHospitals(context, organization.id);

  const sp = await searchParams;
  const currentHospitalId = sp.hospital ?? null;

  // Preserved across the stat strip AND the area-card links so a hospital_admin
  // stays on their selected hospital's commissions on every destination page.
  const effectiveHospitalId = !isOrgAdmin
    ? (currentHospitalId ?? hospitals[0]?.id ?? null)
    : null;

  const [auditOn, patientSafetyOn, orgHospitals, commissions, overviewRows] =
    await Promise.all([
      auditTrailEnabled(),
      patientSafetyEnabled(),
      // Stat-strip reads (C5): org_admin gets the org-wide hospital/commission
      // counts + a 30-day submission rollup; hospital_admin gets only its
      // scoped commission count (existing RLS-scoped reads, no new queries).
      isOrgAdmin ? listHospitalsForOrg(organization.id) : Promise.resolve([]),
      isOrgAdmin
        ? listManagedCommissions(organization.id, null)
        : listManagedCommissions(organization.id, effectiveHospitalId),
      isOrgAdmin
        ? getOrgCommissionOverview(organization.id)
        : Promise.resolve([]),
    ]);

  const stats: { label: string; value: number }[] = isOrgAdmin
    ? [
        { label: "Hospitais", value: orgHospitals.length },
        { label: "Comissões", value: commissions.length },
        {
          label: "Respostas nos últimos 30 dias",
          value: overviewRows.reduce(
            (sum, row) => sum + row.submittedLast30Days,
            0,
          ),
        },
      ]
    : [{ label: "Comissões", value: commissions.length }];

  const areas = AREAS.filter((area) => {
    if (area.orgAdminOnly && !isOrgAdmin) return false;
    if (area.requiresFeature === "audit") return auditOn;
    if (area.requiresFeature === "patientSafety") return patientSafetyOn;
    return true;
  });

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            Administração da organização
          </p>
          {!isOrgAdmin && hospitals.length > 1 ? (
            <HospitalSwitcher
              hospitals={hospitals}
              currentHospitalId={currentHospitalId ?? hospitals[0]?.id ?? null}
              allowAll={false}
            />
          ) : null}
        </div>
        <h1 className="text-3xl text-balance">{organization.name}</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          {isOrgAdmin
            ? "Administre as comissões, os hospitais e os acessos da sua organização. Abra uma comissão para gerenciar sua coordenação."
            : "Administre as comissões do seu hospital. Abra uma comissão para gerenciar sua coordenação."}
        </p>
      </header>

      <RiseInGroup
        className={`grid gap-4 ${
          isOrgAdmin ? "sm:grid-cols-3" : "sm:max-w-xs sm:grid-cols-1"
        }`}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            data-rise
            className="rounded-2xl border border-border bg-card p-5 shadow-xs"
          >
            <p className="text-sm font-medium text-muted-foreground text-pretty">
              {stat.label}
            </p>
            <StatCount
              value={stat.value}
              className="mt-1 block font-display text-3xl leading-none tabular-nums text-foreground"
            />
          </div>
        ))}
      </RiseInGroup>

      <section
        aria-label="Áreas de administração"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {areas.map((area, index) => {
          const Icon = area.icon;
          // effectiveHospitalId is hoisted above (also feeds the stat strip) —
          // preserves the hospital scope across the card link so a hospital_admin
          // stays on their selected hospital's commissions on the destination page.
          const href = effectiveHospitalId
            ? `${orgHref(org, "manage", ...area.segments)}?hospital=${encodeURIComponent(effectiveHospitalId)}`
            : orgHref(org, "manage", ...area.segments);
          return (
            <Link
              key={area.title}
              href={href}
              style={{ ["--rise-delay" as string]: `${index * 50}ms` }}
              className="animate-rise-in group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  aria-hidden="true"
                  className="grid size-10 place-items-center rounded-xl bg-accent/60 text-accent-foreground"
                >
                  <Icon className="size-5" />
                </span>
                <ArrowUpRight
                  className="size-5 shrink-0 text-muted-foreground transition-[color,transform] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                  aria-hidden="true"
                />
              </div>
              <h2 className="text-base font-semibold">{area.title}</h2>
              <p className="text-sm text-muted-foreground text-pretty">
                {area.description}
              </p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

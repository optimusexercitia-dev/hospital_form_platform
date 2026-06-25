import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  FolderKanban,
  ScrollText,
} from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { orgHref } from "@/lib/routing";
import { auditTrailEnabled } from "@/lib/queries/audit";
import { patientSafetyEnabled } from "@/lib/queries/pqs";
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
    title: "Hospitais",
    description:
      "Cadastre e organize os hospitais da sua organização.",
    segments: ["hospitais"],
    icon: Building2,
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
 * layout (`is_org_admin_of(org)`); this resolves the org's display name for the
 * greeting and lists the management areas as cards. The audit card only renders
 * when the `audit_trail` flag is on.
 */
export default async function OrgManageHomePage({
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

  const [auditOn, patientSafetyOn] = await Promise.all([
    auditTrailEnabled(),
    patientSafetyEnabled(),
  ]);
  const areas = AREAS.filter((area) => {
    if (area.requiresFeature === "audit") return auditOn;
    if (area.requiresFeature === "patientSafety") return patientSafetyOn;
    return true;
  });

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Administração da organização
        </p>
        <h1 className="text-3xl text-balance">{organization.name}</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Administre as comissões, os hospitais e os acessos da sua organização.
          Abra uma comissão para gerenciar sua coordenação.
        </p>
      </header>

      <section
        aria-label="Áreas de administração"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {areas.map((area, index) => {
          const Icon = area.icon;
          return (
            <Link
              key={area.title}
              href={orgHref(org, "manage", ...area.segments)}
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

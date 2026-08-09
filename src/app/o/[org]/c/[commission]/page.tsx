import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  FileEdit,
  FolderOpen,
  Gauge,
  ListTodo,
  PenLine,
  PencilLine,
  ScrollText,
  Settings2,
  Users,
  Workflow,
} from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getMemberOverview, type MemberOverview } from "@/lib/queries/overview";
import { caseAccessEnabled } from "@/lib/case-access/actions";
import { auditTrailEnabled } from "@/lib/queries/audit";
import { qualityIndicatorsEnabled } from "@/lib/queries/feature-flags";
import { StatCount } from "@/components/admin/stat-count";

export const metadata: Metadata = {
  title: "Visão geral",
};

/**
 * Commission overview — a per-member "at a glance" dashboard, the same for staff
 * and staff_admin. A personalized greeting sits above five count cards fed by
 * {@link getMemberOverview} (one self-scoped round-trip). Every card renders even
 * at count 0 and links to the relevant member surface. The coordinator AGGREGATE
 * dashboard ("Painel") is a separate, coordinator-only surface.
 *
 * Access is already gated by the layout; we re-read here for the greeting and to
 * resolve the `case_access` flag (which decides whether the cases card links to
 * "Meus Casos" or the legacy "Minhas fases", mirroring the sidebar).
 *
 * ⭐ ADR 0100 D12 (BUG-QOB-003): one href, two bodies. Every card below points at
 * a CONTENT surface a tenancy admin (org_admin/hospital_admin) may no longer
 * reach, and `getMemberOverview` counts work they do not have — so a principal
 * with no membership role gets the CONFIGURATION landing instead. It is a branch
 * rather than a redirect because this is the destination their sidebar's "Visão
 * geral" points at; bouncing them elsewhere would leave the nav lying about where
 * they are.
 */
export default async function CommissionHomePage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const access = await getCommissionAccessByOrg(org, commission);

  // The layout already guarantees access; this is defensive (never expected).
  const commissionName = access?.commission.name ?? "";
  const firstName = access?.context.fullName?.trim().split(/\s+/)[0] ?? null;
  const commissionId = access?.commission.id;

  // A bare tenancy admin: admitted by the layout, holds no membership role.
  // `!isQualityViewer` mirrors the layout's shell precedence exactly — a
  // dual-hatted reviewer/tenancy-admin gets the read-only oversight shell, and
  // this body must not contradict the chrome wrapped around it.
  if (access && access.role === null && access.isTenancyAdmin && !access.isQualityViewer) {
    return (
      <CommissionConfigurationHome
        org={org}
        commission={commission}
        commissionName={commissionName}
        firstName={firstName}
      />
    );
  }

  const [overview, caseAccessOn] = await Promise.all([
    commissionId ? getMemberOverview(commissionId) : Promise.resolve(null),
    caseAccessEnabled(),
  ]);

  const cards = overview
    ? buildCards(org, commission, overview, caseAccessOn)
    : [];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {commissionName}
        </p>
        <h1 className="text-3xl text-balance">
          {firstName ? `Olá, ${firstName}.` : "Olá."}
        </h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Este é o seu panorama da comissão — o que precisa da sua atenção agora.
        </p>
      </header>

      <section
        aria-label="Resumo do seu trabalho"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {cards.map((card, index) => (
          <OverviewCard key={card.title} card={card} index={index} />
        ))}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Configuration landing (ADR 0100 D12 — the tenancy-admin body)
// ---------------------------------------------------------------------------

/**
 * What an org_admin / hospital_admin sees at the commission root. Mirrors the
 * member overview's shape — greeting, then a card grid — but every destination
 * is on the PO-ratified KEEP set (rulings Q1–Q9), and the counts are gone: a
 * count here would be a count of the committee's work.
 *
 * The copy states the boundary in the rulings' own terms rather than apologising
 * for a missing menu. It is the difference between a wall a user understands and
 * a screen they file as broken.
 */
async function CommissionConfigurationHome({
  org,
  commission,
  commissionName,
  firstName,
}: {
  org: string;
  commission: string;
  commissionName: string;
  firstName: string | null;
}) {
  const [indicatorsOn, auditOn] = await Promise.all([
    qualityIndicatorsEnabled(),
    auditTrailEnabled(),
  ]);

  const cards: ConfigurationCardData[] = [
    {
      title: "Construtor de formulários",
      description:
        "Formulários, seções e perguntas — as versões publicadas permanecem imutáveis.",
      href: commissionHref(org, commission, "manage", "forms"),
      icon: PencilLine,
    },
    {
      title: "Processos",
      description: "Modelos de processo que estruturam as fases dos casos.",
      href: commissionHref(org, commission, "manage", "process-templates"),
      icon: Workflow,
    },
    ...(indicatorsOn
      ? [
          {
            title: "Indicadores",
            description:
              "Definição dos indicadores: meta, direção, periodicidade e fonte.",
            href: commissionHref(org, commission, "manage", "indicadores"),
            icon: Gauge,
          },
        ]
      : []),
    {
      title: "Membros",
      description: "Quem participa da comissão, com quais funções e títulos.",
      href: commissionHref(org, commission, "manage", "members"),
      icon: Users,
    },
    {
      title: "Configurações",
      description:
        "Etiquetas, desfechos, resultados de fase, títulos e tipos de reunião.",
      href: commissionHref(org, commission, "manage", "settings"),
      icon: Settings2,
    },
    ...(auditOn
      ? [
          {
            title: "Trilha de auditoria",
            description: "Registro de quem fez o quê, em qual entidade e quando.",
            href: commissionHref(org, commission, "manage", "audit"),
            icon: ScrollText,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {commissionName}
        </p>
        <h1 className="text-3xl text-balance">
          {firstName ? `Olá, ${firstName}.` : "Olá."}
        </h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Você administra a estrutura desta comissão — formulários, processos,
          indicadores, membros e configurações. O trabalho do comitê — respostas,
          casos, reuniões e documentos — pertence à comissão e não é exibido à
          administração da rede ou do hospital.
        </p>
      </header>

      <section
        aria-label="Configuração da comissão"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {cards.map((card, index) => (
          <ConfigurationCard key={card.title} card={card} index={index} />
        ))}
      </section>
    </div>
  );
}

interface ConfigurationCardData {
  title: string;
  description: string;
  href: string;
  icon: typeof FolderOpen;
}

function ConfigurationCard({
  card,
  index,
}: {
  card: ConfigurationCardData;
  index: number;
}) {
  const Icon = card.icon;
  return (
    <Link
      href={card.href}
      style={{ ["--rise-delay" as string]: `${index * 60}ms` }}
      className="animate-rise-in group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Icon aria-hidden="true" className="size-[1.15rem]" />
        </span>
        <ArrowUpRight
          className="size-5 shrink-0 text-muted-foreground transition-[color,transform] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
          aria-hidden="true"
        />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {card.title}
        </h2>
        <p className="text-sm text-muted-foreground text-pretty">
          {card.description}
        </p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Card model
// ---------------------------------------------------------------------------

interface OverviewCardData {
  title: string;
  value: number;
  href: string;
  icon: typeof FolderOpen;
  /** Optional muted secondary line under the count (a hint, not a count). */
  hint: string | null;
}

/**
 * Build the five member cards from the overview. Every card links to a
 * MEMBER-reachable surface: the cases card targets "Meus Casos" (`meus-casos`)
 * when `case_access` is ON, else the legacy "Minhas fases" (`minhas-fases`) —
 * exactly the pair the sidebar switches between — so the link never 404s.
 */
function buildCards(
  org: string,
  commission: string,
  o: MemberOverview,
  caseAccessOn: boolean,
): OverviewCardData[] {
  const casesHref = commissionHref(
    org,
    commission,
    caseAccessOn ? "meus-casos" : "minhas-fases",
  );

  return [
    {
      title: "Casos não concluídos",
      value: o.casesNotConcluded,
      href: casesHref,
      icon: FolderOpen,
      hint: null,
    },
    {
      title: "Itens de ação pendentes",
      value: o.pendingActionItems,
      href: commissionHref(org, commission, "meus-itens-de-acao"),
      icon: ListTodo,
      hint:
        o.pendingActionItemsOverdue > 0
          ? `${o.pendingActionItemsOverdue} em atraso`
          : null,
    },
    {
      title: "Reuniões não concluídas",
      value: o.meetingsNotConcluded,
      href: commissionHref(org, commission, "meetings"),
      icon: CalendarDays,
      hint: o.nextMeetingStart
        ? `próxima em ${formatNextMeeting(o.nextMeetingStart)}`
        : null,
    },
    {
      title: "Assinaturas pendentes",
      value: o.pendingSignatures,
      href: commissionHref(org, commission, "meetings"),
      icon: PenLine,
      hint: null,
    },
    {
      title: "Respostas em andamento",
      value: o.inProgressResponses,
      href: commissionHref(org, commission, "respostas"),
      icon: FileEdit,
      hint: null,
    },
  ];
}

/** The next-meeting hint date (date only — pt-BR `dd/MM/yyyy`). */
function formatNextMeeting(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function OverviewCard({
  card,
  index,
}: {
  card: OverviewCardData;
  index: number;
}) {
  const Icon = card.icon;
  return (
    <Link
      href={card.href}
      style={{ ["--rise-delay" as string]: `${index * 60}ms` }}
      className="animate-rise-in group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Icon aria-hidden="true" className="size-[1.15rem]" />
        </span>
        <ArrowUpRight
          className="size-5 shrink-0 text-muted-foreground transition-[color,transform] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
          aria-hidden="true"
        />
      </div>
      <div className="flex flex-col gap-1">
        <StatCount
          value={card.value}
          className="font-display text-3xl leading-none tabular-nums"
        />
        <h2 className="text-sm font-medium text-muted-foreground">
          {card.title}
        </h2>
        {card.hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
        ) : null}
      </div>
    </Link>
  );
}

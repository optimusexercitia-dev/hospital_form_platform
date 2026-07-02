import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  FileEdit,
  FolderOpen,
  ListTodo,
  PenLine,
} from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getMemberOverview, type MemberOverview } from "@/lib/queries/overview";
import { caseAccessEnabled } from "@/lib/case-access/actions";
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

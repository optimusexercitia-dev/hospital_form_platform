import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CalendarClock, CheckCircle2, User } from "lucide-react";

import { commissionHref } from "@/lib/routing";
import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { actionItemsEnabled, getActionItem } from "@/lib/queries/action-items";
import { caseAccessEnabled } from "@/lib/case-access/actions";
import { loadActionItemSatellites } from "@/components/action-items/satellite-loader";
import { ActionItemSatellitesPanel } from "@/components/action-items/action-item-satellites-panel";
import {
  ActionItemSourceBadge,
  ActionItemStatusBadge,
} from "@/components/action-items/action-item-badges";
import { VisibilityScopeBadge } from "@/components/action-items/visibility-badge";
import {
  formatDateTime,
  formatDueDate,
  isOverdue,
} from "@/components/action-items/format";

export const metadata: Metadata = {
  title: "Item de ação",
};

/**
 * The Action Item DETAIL page. ONE route serves all three sources — case,
 * meeting and manual items are rows of the shared `action_items` hub and `id` is
 * a globally unique uuid, so there is no per-source branching beyond the
 * "voltar para a origem" link and the source badge. It is also the first
 * destination a `manual` item has ever had (it has no parent page to link to).
 *
 * Server Component. It loads the item header AND the three satellites eagerly,
 * then hands the satellites to a small client island for their mutations — on a
 * dedicated page the satellites ARE the content, so the row hosts' lazy-load +
 * disclosure + retry machinery is dropped (see `ActionItemSatellitesPanel`).
 *
 * Access: RLS is the authority — `getActionItem` returns `null` for an item that
 * is absent OR unreadable (deliberately indistinguishable), and we `notFound()`
 * either way, so a 404 never confirms an item's existence.
 *
 * Satellites follow the row hosts' gate exactly: the `action_items` flag. The
 * page itself is NOT flag-gated, matching its `meus-itens-de-acao` neighbour —
 * the nav that leads here is what the composite flag hides.
 */
export default async function ActionItemDetailPage({
  params,
}: {
  params: Promise<{ org: string; commission: string; itemId: string }>;
}) {
  const { org, commission, itemId } = await params;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role === null) notFound();

  const item = await getActionItem(itemId);
  if (!item) notFound();

  // The item id is a GLOBAL uuid, so an item the viewer may read through a
  // DIFFERENT commission's membership would otherwise render happily under this
  // commission's URL — a real cross-tenant confusion (wrong breadcrumb, wrong
  // back-links, an item that isn't this committee's work). Pin the row to the
  // addressed commission; RLS still governs readability.
  if (item.commissionId !== access.commission.id) notFound();

  const isCoordinator = access.role === "staff_admin";
  const isAssignee =
    item.assigneeId != null && item.assigneeId === access.context.userId;
  // Mirrors the row hosts: reminders are a coordinator authority; contributing
  // (updates + checklist) needs a stake — assignee or coordinator. The RPCs are
  // the real boundary; these only hide controls that would always be refused.
  const canManageReminders = isCoordinator;
  const canContribute = isCoordinator || isAssignee;

  const [satellitesOn, caseAccessOn] = await Promise.all([
    actionItemsEnabled(),
    caseAccessEnabled(),
  ]);
  const satellites = satellitesOn ? await loadActionItemSatellites(itemId) : null;

  const overdue = isOverdue(item.dueDate, item.status);
  const source = describeSource(item, { org, commission, caseAccessOn });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href={commissionHref(org, commission, "meus-itens-de-acao")}
          className="group inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft
            aria-hidden="true"
            className="size-4 transition-transform group-hover:-translate-x-0.5"
          />
          Meus itens de ação
        </Link>

        <header className="flex flex-col gap-3">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {access.commission.name}
          </p>
          <h1 className="text-3xl text-balance">{item.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <ActionItemStatusBadge status={item.status} />
            <ActionItemSourceBadge source={item.source} />
            <VisibilityScopeBadge scope={item.visibilityScope} />
          </div>
          {item.description && (
            <p className="max-w-prose text-muted-foreground text-pretty">
              {item.description}
            </p>
          )}
        </header>
      </div>

      <section
        aria-labelledby="action-item-meta-heading"
        className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
        style={{ "--rise-delay": "0ms" } as React.CSSProperties}
      >
        <h2 id="action-item-meta-heading" className="text-base font-semibold">
          Detalhes
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <MetaField label="Responsável">
            <span className="inline-flex items-center gap-1.5">
              <User aria-hidden="true" className="size-3.5 text-muted-foreground" />
              {item.assigneeName ?? "Sem responsável"}
            </span>
          </MetaField>

          <MetaField label="Prazo">
            {item.dueDate ? (
              <span
                className={cnDue(overdue)}
                // Overdue is conveyed by icon + text + color — never color alone.
              >
                <CalendarClock aria-hidden="true" className="size-3.5" />
                {formatDueDate(item.dueDate)}
                {overdue && " · Atrasado"}
              </span>
            ) : (
              <span className="text-muted-foreground">Sem prazo</span>
            )}
          </MetaField>

          <MetaField label="Origem">
            {source.href ? (
              <Link
                href={source.href}
                className="group inline-flex items-center gap-1 font-medium text-foreground transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <span className="underline-offset-2 group-hover:underline">
                  {source.text}
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                />
              </Link>
            ) : (
              <span>{source.text}</span>
            )}
          </MetaField>

          <MetaField label="Criado por">
            {item.createdByName ?? "—"}
            <span className="text-muted-foreground">
              {" "}
              · {formatDateTime(item.createdAt)}
            </span>
          </MetaField>

          {item.completedAt && (
            <MetaField label="Concluído em">
              <span className="inline-flex items-center gap-1.5 text-success">
                <CheckCircle2 aria-hidden="true" className="size-3.5" />
                {formatDateTime(item.completedAt)}
              </span>
            </MetaField>
          )}
        </dl>
      </section>

      {satellites && (
        <section
          aria-labelledby="action-item-satellites-heading"
          className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
          style={{ "--rise-delay": "60ms" } as React.CSSProperties}
        >
          <div className="flex flex-col gap-1">
            <h2
              id="action-item-satellites-heading"
              className="text-base font-semibold"
            >
              Acompanhamento
            </h2>
            <p className="text-sm text-muted-foreground">
              Lembretes, atualizações e checklist deste item.
            </p>
          </div>
          <ActionItemSatellitesPanel
            actionItemId={item.id}
            itemTitle={item.title}
            initialData={satellites}
            canManageReminders={canManageReminders}
            canContribute={canContribute}
          />
        </section>
      )}
    </div>
  );
}

/** One `<dt>/<dd>` pair of the details grid. */
function MetaField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

/** Due-date classes; overdue also carries an icon + the word "Atrasado". */
function cnDue(overdue: boolean): string {
  return overdue
    ? "inline-flex items-center gap-1.5 font-medium text-destructive tabular-nums"
    : "inline-flex items-center gap-1.5 tabular-nums";
}

/**
 * The "Origem" label + optional link back to the parent. A `manual` item has no
 * parent by definition — it renders as text, never a dead link. The case link
 * targets the MEMBER route (`casos/{id}`, reachable by an assignee) and is
 * suppressed when the `case_access` flag is OFF and that route would 404 —
 * mirroring `ActionItemsTable`'s rule exactly.
 */
function describeSource(
  item: {
    source: "case" | "meeting" | "manual";
    caseId: string | null;
    caseNumber: number | null;
    caseLabel: string | null;
    meetingId: string | null;
    meetingNumber: number | null;
    meetingScheduledStart: string | null;
  },
  ctx: { org: string; commission: string; caseAccessOn: boolean },
): { text: string; href: string | null } {
  if (item.source === "case") {
    const numberLabel =
      item.caseNumber != null
        ? `Caso ${String(item.caseNumber).padStart(4, "0")}`
        : "Caso";
    return {
      text: item.caseLabel ? `${numberLabel} — ${item.caseLabel}` : numberLabel,
      href:
        ctx.caseAccessOn && item.caseId
          ? commissionHref(ctx.org, ctx.commission, "casos", item.caseId)
          : null,
    };
  }

  if (item.source === "meeting") {
    const numberLabel =
      item.meetingNumber != null
        ? `Reunião ${String(item.meetingNumber).padStart(4, "0")}`
        : "Reunião";
    const dateLabel = item.meetingScheduledStart
      ? formatDateTime(item.meetingScheduledStart)
      : null;
    return {
      text: dateLabel ? `${numberLabel} — ${dateLabel}` : numberLabel,
      href: item.meetingId
        ? commissionHref(ctx.org, ctx.commission, "meetings", item.meetingId)
        : null,
    };
  }

  // Manual — a standalone committee task with no parent page.
  return { text: "Item avulso desta comissão", href: null };
}

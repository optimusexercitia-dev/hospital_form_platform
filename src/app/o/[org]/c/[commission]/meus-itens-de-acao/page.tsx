import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { listMyActionItems } from "@/lib/queries/action-items";
import { caseAccessEnabled } from "@/lib/case-access/actions";
import { ActionItemsTable } from "@/components/action-items/action-items-table";

export const metadata: Metadata = {
  title: "Meus itens de ação",
};

/**
 * "Meus itens de ação" — the current member's unified, read-only list of action
 * items assigned to them across the case + meeting sources for this commission
 * (NOT CAPA; those live under the NSP/PHI safeguards). Server Component: it
 * fetches the rows (self-scoped by the RPC) and hands them to the client table
 * island for filtering, sorting and the overdue flag.
 *
 * Access is already gated by the layout; we re-read for the guard + heading. The
 * nav item that leads here only shows when `cases_extras` OR `meetings` is on, so
 * an empty list here means "nothing assigned", not "feature off".
 *
 * `caseAccessEnabled()` decides whether a case row links to the member case
 * detail (`casos/{id}`): that route 404s while the flag is OFF, so we suppress the
 * link (plain text) in that case rather than emit a dead link.
 */
export default async function MyActionItemsPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role === null) notFound();

  const [items, caseAccessOn] = await Promise.all([
    listMyActionItems(access.commission.id),
    caseAccessEnabled(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Meus itens de ação</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          As tarefas atribuídas a você em casos e reuniões desta comissão. Abra a
          origem de um item para agir sobre ele.
        </p>
      </header>

      <ActionItemsTable
        org={org}
        commission={commission}
        items={items}
        caseDetailLinkable={caseAccessOn}
      />
    </div>
  );
}

import Link from "next/link";
import { ArrowUpRight, Hospital } from "lucide-react";

import type { OrgCommissionDetail } from "@/lib/queries/org";
import type { CommissionCadenceRow } from "@/lib/charters/types";
import { orgHref } from "@/lib/routing";
import { initials } from "@/components/org/format";
import { CommissionOversightToggle } from "@/components/org/commission-oversight-toggle";
import { CadenceStatusBadge } from "@/components/charters/cadence-status-badge";
import { CADENCE_STATUS_LABELS } from "@/components/charters/labels";

/**
 * Vertical stack of full-width commission cards for the org-admin area
 * (`/o/[org]/manage/comissoes`). Each row shows the commission's name/slug/
 * hospital, its `staff_admin` coordinators, and its member/form counts,
 * linking to the commission's management detail. Server Component; pure
 * presentation — the aggregate counts + coordinator roster come pre-computed
 * from `listManagedCommissionsDetailed`.
 */
export function OrgCommissionList({
  org,
  commissions,
  cadence = {},
}: {
  /** The org slug, for building the detail hrefs. */
  org: string;
  commissions: OrgCommissionDetail[];
  /**
   * Meeting cadence per commission id, from `getCommissionCadenceOverview()`
   * (PO ruling 2026-08-09, charter ③). READ-ONLY oversight: the tenancy admin learns
   * that a committee is behind, never what it was meant to be discussing.
   *
   * Defaults to `{}` so a missing entry — flag off, or a commission this caller does
   * not administer — simply renders no badge rather than an error or an empty chip.
   */
  cadence?: Record<string, CommissionCadenceRow>;
}) {
  if (commissions.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center text-muted-foreground">
        Nenhuma comissão ainda. Crie a primeira com o botão &ldquo;Criar
        comissão&rdquo; acima.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {commissions.map((commission, index) => (
        <li key={commission.id}>
          {/* ⚠ The whole card used to be ONE <Link>. The oversight toggle (ADR
              0100 D9) is an interactive control, and a button inside an anchor is
              invalid HTML — the click target and the keyboard path both break. So
              the card is a container and the commission NAME carries the link.
              Consequence for tests: this row's accessible name moved from the
              whole card to the name, which re-scopes any locator keyed on it. */}
          <div
            style={{ ["--rise-delay" as string]: `${index * 60}ms` }}
            className="animate-rise-in group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-md sm:flex-row sm:flex-wrap sm:items-center sm:gap-6"
          >
            <div className="flex min-w-0 flex-col gap-1 sm:w-64 sm:shrink-0">
              <h3 className="truncate text-lg font-semibold">
                <Link
                  href={orgHref(org, "manage", "comissoes", commission.slug)}
                  className="rounded transition-colors hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  {commission.name}
                </Link>
              </h3>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono">/{commission.slug}</span>
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Hospital className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {commission.hospitalName ?? "Sem hospital"}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {commission.coordinators.length === 0 ? (
                <span className="text-sm text-muted-foreground italic">
                  Sem coordenação
                </span>
              ) : (
                commission.coordinators.map((c) => (
                  <span
                    key={c.userId}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted/60 py-1 pr-2.5 pl-1 text-xs font-medium text-foreground"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[0.65rem] font-semibold text-accent-foreground"
                    >
                      {initials(c.fullName || c.email)}
                    </span>
                    <span className="truncate">{c.fullName || c.email}</span>
                  </span>
                ))
              )}
            </div>

            <div className="flex shrink-0 items-center gap-4 sm:ml-auto">
              {/* Meeting cadence — READ-ONLY. The accessible name carries both the
                  subject and the commission, because "Em atraso" alone is ambiguous
                  when fourteen cards each show a chip. Absent entry → no chip. */}
              {cadence[commission.id] ? (
                <span
                  aria-label={`Cadência de reuniões de ${commission.name}: ${CADENCE_STATUS_LABELS[cadence[commission.id]!.status]}`}
                  role="status"
                >
                  <CadenceStatusBadge
                    status={cadence[commission.id]!.status}
                    className="px-2.5 py-0.5 text-xs"
                  />
                </span>
              ) : null}
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground tabular-nums">
                <span>
                  {commission.memberCount}{" "}
                  {commission.memberCount === 1 ? "membro" : "membros"}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {commission.formCount}{" "}
                  {commission.formCount === 1 ? "formulário" : "formulários"}
                </span>
              </div>
              <CommissionOversightToggle
                commissionId={commission.id}
                commissionName={commission.name}
                oversight={commission.qualityOversight}
              />
              <Link
                href={orgHref(org, "manage", "comissoes", commission.slug)}
                aria-label={`Abrir ${commission.name}`}
                className="rounded focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <ArrowUpRight
                  className="size-5 shrink-0 text-muted-foreground transition-[color,transform] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

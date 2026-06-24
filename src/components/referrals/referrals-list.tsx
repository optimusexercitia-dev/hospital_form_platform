"use client";

import { commissionHref } from "@/lib/routing";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  FolderOpen,
  Inbox,
  Send,
} from "lucide-react";

import {
  REFERRAL_STATUS_LABELS,
  type ReferralDirection,
  type ReferralListItem,
  type ReferralStatus,
} from "@/lib/referrals/types";
import { cn } from "@/lib/utils";
import {
  ReferralStatusChip,
  ReferralTypeChip,
  ResponseExpectedChip,
} from "./referral-chips";
import { formatDate, formatReferralCode } from "./format";

/** Status filter options in lifecycle order; "all" is the default sentinel. */
const STATUS_FILTER_ORDER: ReferralStatus[] = [
  "rascunho",
  "enviada",
  "recebida",
  "aceita",
  "em_analise",
  "concluida",
  "recusada",
  "retirada",
];

const SELECT_CLASS =
  "h-9 rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40";

type SortKey = "code" | "status" | "criado";
type SortDir = "asc" | "desc";

const STATUS_RANK: Record<ReferralStatus, number> = Object.fromEntries(
  STATUS_FILTER_ORDER.map((s, i) => [s, i]),
) as Record<ReferralStatus, number>;

function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        {label}
        <Icon
          aria-hidden="true"
          className={cn(
            "size-3",
            active ? "text-foreground" : "text-muted-foreground/60",
          )}
        />
      </button>
    </th>
  );
}

/**
 * One direction's referral table — incoming ("Recebidos") OR outgoing
 * ("Enviados"), as a sortable, scannable table with a status filter. PHI-FREE by
 * construction (the {@link ReferralListItem} carries only governance metadata).
 * Fed plain props by the hub Server page; RLS already scoped the data.
 *
 * Mirrors the patient-safety read-back list (`events-list.tsx`): a rounded card
 * with a muted header row, striped rows, sortable Encaminhamento/Status/Criado
 * columns. Rows ARE links here (unlike the 14a events list) — every member of
 * either side may open the referral detail (`can_read_referral`); the snapshot
 * + any PHI inside re-gate server-side.
 *
 * The "counterpart committee" column shows the OTHER end relative to this
 * direction: for incoming it's the source (who sent it), for outgoing the target
 * (who received it).
 */
export function ReferralsList({
  org,
  slug,
  direction,
  referrals,
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  direction: ReferralDirection;
  referrals: ReferralListItem[];
}) {
  const [statusFilter, setStatusFilter] = useState<ReferralStatus | "all">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "criado",
    dir: "desc",
  });

  const incoming = direction === "incoming";
  const counterpartHeading = incoming ? "Origem" : "Destino";

  const filtered = useMemo(
    () =>
      referrals.filter(
        (r) => statusFilter === "all" || r.status === statusFilter,
      ),
    [referrals, statusFilter],
  );

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sort.key === "code") cmp = a.code.localeCompare(b.code, "pt-BR");
      else if (sort.key === "status")
        cmp = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );

  const counterpartName = (r: ReferralListItem) =>
    (incoming ? r.sourceCommissionName : r.targetCommissionName) ?? "Comissão";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/50 p-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-muted-foreground">Estado</span>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as ReferralStatus | "all")
            }
            className={SELECT_CLASS}
            aria-label="Filtrar por estado"
          >
            <option value="all">Todos</option>
            {STATUS_FILTER_ORDER.map((s) => (
              <option key={s} value={s}>
                {REFERRAL_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <span
          className={cn(
            "ml-auto text-sm text-muted-foreground tabular-nums",
            filtered.length === 0 && "text-muted-foreground/70",
          )}
        >
          {filtered.length}{" "}
          {filtered.length === 1 ? "encaminhamento" : "encaminhamentos"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <section
          aria-label="Nenhum encaminhamento"
          className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {incoming ? (
              <Inbox aria-hidden="true" className="size-6" />
            ) : (
              <Send aria-hidden="true" className="size-6" />
            )}
          </span>
          <h3 className="text-base font-semibold">
            {statusFilter === "all"
              ? incoming
                ? "Nenhum encaminhamento recebido"
                : "Nenhum encaminhamento enviado"
              : "Nenhum encaminhamento neste estado"}
          </h3>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            {statusFilter === "all"
              ? incoming
                ? "Encaminhamentos enviados por outras comissões a esta comissão aparecerão aqui."
                : "Encaminhamentos que esta comissão enviar a outras aparecerão aqui. Encaminhe um caso a partir do detalhe do caso."
              : "Ajuste o filtro de estado para ver outros encaminhamentos."}
          </p>
        </section>
      ) : (
        <div className="animate-fade-in overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <SortHeader
                  label="Encaminhamento"
                  active={sort.key === "code"}
                  dir={sort.dir}
                  onClick={() => toggle("code")}
                />
                <th
                  scope="col"
                  className="px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  Tipo
                </th>
                <SortHeader
                  label="Status"
                  active={sort.key === "status"}
                  dir={sort.dir}
                  onClick={() => toggle("status")}
                />
                <th
                  scope="col"
                  className="px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {counterpartHeading}
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  Caso
                </th>
                <SortHeader
                  label="Criado"
                  active={sort.key === "criado"}
                  dir={sort.dir}
                  onClick={() => toggle("criado")}
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/70 odd:bg-card even:bg-muted/20 transition-colors hover:bg-muted/30 focus-within:bg-muted/40"
                >
                  <td className="max-w-[24rem] px-3 py-2.5 align-middle">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatReferralCode(r.code)}
                      </span>
                      <Link
                        href={commissionHref(org, slug, "encaminhamentos", r.id)}
                        className="truncate rounded font-medium text-foreground underline-offset-2 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                      >
                        {r.subject}
                      </Link>
                      {r.responseExpected &&
                        !["concluida", "recusada", "retirada"].includes(
                          r.status,
                        ) && (
                          <span className="mt-0.5">
                            <ResponseExpectedChip />
                          </span>
                        )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <ReferralTypeChip
                      label={r.typeLabel}
                      colorToken={r.typeColorToken}
                    />
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <ReferralStatusChip status={r.status} />
                  </td>
                  <td className="max-w-[14rem] truncate px-3 py-2.5 align-middle text-muted-foreground">
                    {counterpartName(r)}
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    {(() => {
                      // The case shown is THIS commission's end: for an outgoing
                      // referral that's the source case; for incoming it's B's
                      // linked case (null until B links one).
                      const caseNumber = incoming
                        ? r.targetCaseNumber
                        : r.sourceCaseNumber;
                      return caseNumber != null ? (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground tabular-nums">
                          <FolderOpen aria-hidden="true" className="size-4" />
                          {String(caseNumber).padStart(4, "0")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/70">—</span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2.5 align-middle text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                    {formatDate(r.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Renders both hub sections (Recebidos + Enviados) with their own headings, fed
 * the pre-split arrays. A thin composition so the page stays declarative. */
export function ReferralsHubSections({
  org,
  slug,
  incoming,
  outgoing,
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  incoming: ReferralListItem[];
  outgoing: ReferralListItem[];
}) {
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="referrals-incoming-heading" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Inbox aria-hidden="true" className="size-5 text-primary" />
          <h2 id="referrals-incoming-heading" className="text-xl">
            Recebidos
          </h2>
        </div>
        <ReferralsList org={org} slug={slug} direction="incoming" referrals={incoming} />
      </section>

      <section aria-labelledby="referrals-outgoing-heading" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Send aria-hidden="true" className="size-5 text-primary" />
          <h2 id="referrals-outgoing-heading" className="text-xl">
            Enviados
          </h2>
        </div>
        <ReferralsList org={org} slug={slug} direction="outgoing" referrals={outgoing} />
      </section>
    </div>
  );
}

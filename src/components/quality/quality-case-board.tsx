"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Search } from "lucide-react";

import type { CaseBoardRow } from "@/lib/queries/cases";
import { CASE_STATUSES, type CaseStatus } from "@/lib/cases/case-status";
import { commissionHref } from "@/lib/routing";
import { cn } from "@/lib/utils";
import { CaseStatusBadge, CaseStatusBadgeFixed } from "@/components/cases/case-status-badge";
import { currentPhase } from "@/components/cases/case-derive";
import { formatCaseNumber, formatDate } from "@/components/cases/format";

type SortKey = "comissao" | "caso" | "status" | "criado";
type SortDir = "asc" | "desc";

/**
 * Status sort rank, DERIVED from the canonical board order rather than
 * transcribed — same construction as `CasesTable`'s. A hand-written map here
 * would be a second enumeration of `CaseStatus` that drifts silently the day a
 * status is added or reordered; deriving it makes `CASE_STATUSES` the single
 * boundary. (Written by hand first, and it was already wrong.)
 */
const STATUS_RANK: Record<CaseStatus, number> = Object.fromEntries(
  CASE_STATUSES.map((s, i) => [s, i]),
) as Record<CaseStatus, number>;

/**
 * The cross-committee oversight board (ADR 0100 D10). ONE table over every
 * oversight-visible commission, rather than the commission board repeated N
 * times — reading across committees is the job the quality office exists to do,
 * so the commission is a COLUMN here, not a page boundary.
 *
 * ⚠ WHY THIS IS NOT `CasesTable` WITH ANOTHER PROP. `CasesTable` builds each row's
 * href from the single `org`/`slug` pair it is given; a cross-commission board
 * needs a per-row slug, which is a different data shape rather than a variant of
 * the same one. Adding a third/fourth behavioural boolean to a component that
 * already carries `staffCaseRoute` + `showCustomFields` is exactly the
 * proliferation `architecture-avoid-boolean-props` warns about, so this is an
 * explicit variant (`patterns-explicit-variants`) that reuses the *pieces*
 * (`CaseStatusBadge`, `currentPhase`, `formatCaseNumber`, `formatDate`) instead
 * of the shell.
 *
 * ⚠ `commissionSlugById` IS A PLAIN OBJECT, NOT A BUILDER. The obvious API here
 * would be a `hrefFor(row)` function prop — and it would crash: this is a Client
 * Component mounted by a Server Component, and a function crossing that boundary
 * is an RSC serialization error that a green `next build` does NOT catch (it
 * fails at render). A serializable map keeps the href construction on this side.
 *
 * READ-ONLY BY CONSTRUCTION: no kanban (dragging a card is an assignment — a
 * write), no create, no bulk, no export. The reviewer holds no write capability
 * (D7) and the board offers nothing that implies one.
 */
export function QualityCaseBoard({
  rows,
  org,
  commissionSlugById,
  commissionNameById,
}: {
  rows: CaseBoardRow[];
  /** Org slug — the `/o/{org}` segment of every row href. */
  org: string;
  /** commissionId → slug. Serializable; see the builder note above. */
  commissionSlugById: Record<string, string>;
  /** commissionId → display name, for the Comissão column. */
  commissionNameById: Record<string, string>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "criado",
    dir: "desc",
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const idText = formatCaseNumber(r.case.caseNumber).toLowerCase();
      const label = r.case.label?.toLowerCase() ?? "";
      const commission =
        commissionNameById[r.case.commissionId]?.toLowerCase() ?? "";
      return (
        idText.includes(needle) ||
        String(r.case.caseNumber).includes(needle) ||
        label.includes(needle) ||
        commission.includes(needle)
      );
    });
  }, [rows, query, commissionNameById]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sort.key === "caso") cmp = a.case.caseNumber - b.case.caseNumber;
      else if (sort.key === "criado")
        cmp =
          new Date(a.case.createdAt).getTime() -
          new Date(b.case.createdAt).getTime();
      else if (sort.key === "status")
        cmp = STATUS_RANK[a.case.status] - STATUS_RANK[b.case.status];
      else
        cmp = (commissionNameById[a.case.commissionId] ?? "").localeCompare(
          commissionNameById[b.case.commissionId] ?? "",
          "pt-BR",
        );
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort, commissionNameById]);

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar caso, rótulo ou comissão"
            aria-label="Buscar caso, rótulo ou comissão"
            className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-8 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none sm:w-72"
          />
        </div>
        <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {sorted.length === rows.length
            ? `${rows.length} ${rows.length === 1 ? "caso" : "casos"}`
            : `${sorted.length} de ${rows.length} casos`}
        </p>
      </div>

      <div className="animate-fade-in overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <caption className="sr-only">
            Casos das comissões sob supervisão da qualidade, somente leitura
          </caption>
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <SortHeader
                label="Comissão"
                active={sort.key === "comissao"}
                dir={sort.dir}
                onClick={() => toggle("comissao")}
              />
              <SortHeader
                label="Caso"
                active={sort.key === "caso"}
                dir={sort.dir}
                onClick={() => toggle("caso")}
              />
              <PlainHeader label="Rótulo" />
              <SortHeader
                label="Status"
                active={sort.key === "status"}
                dir={sort.dir}
                onClick={() => toggle("status")}
              />
              <PlainHeader label="Desfecho" />
              <PlainHeader label="Fase atual" />
              <SortHeader
                label="Criado"
                active={sort.key === "criado"}
                dir={sort.dir}
                onClick={() => toggle("criado")}
              />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhum caso corresponde à busca.
                </td>
              </tr>
            ) : (
              sorted.map((row, index) => {
                const slug = commissionSlugById[row.case.commissionId];
                const href = commissionHref(
                  org,
                  slug,
                  "casos",
                  row.case.id,
                );
                const phase = currentPhase(row);
                return (
                  <tr
                    key={row.case.id}
                    onClick={() => router.push(href)}
                    style={{
                      ["--rise-delay" as string]: `${Math.min(index, 12) * 40}ms`,
                    }}
                    className="animate-rise-in cursor-pointer border-b border-border/70 transition-colors odd:bg-card even:bg-muted/20 hover:bg-accent/40"
                  >
                    <td className="px-3 py-2.5 align-middle">
                      <span className="block max-w-[12rem] truncate font-medium text-foreground">
                        {commissionNameById[row.case.commissionId] ??
                          "Comissão"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <Link
                        href={href}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-[0.8rem] font-semibold text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                      >
                        {formatCaseNumber(row.case.caseNumber)}
                      </Link>
                    </td>
                    <td className="max-w-[16rem] px-3 py-2.5 align-middle">
                      {row.case.label ? (
                        <span className="block truncate text-foreground">
                          {row.case.label}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/70 italic">
                          Sem rótulo
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <CaseStatusBadgeFixed status={row.case.status} />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      {row.outcome ? (
                        <CaseStatusBadge
                          label={row.outcome.label}
                          colorToken={row.outcome.colorToken}
                        />
                      ) : (
                        <span className="text-muted-foreground/70">—</span>
                      )}
                    </td>
                    <td className="max-w-[12rem] px-3 py-2.5 align-middle">
                      <span className="block truncate text-muted-foreground">
                        {phase?.title ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-middle whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatDate(row.case.createdAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const HEADER_CLASS =
  "px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase";

function PlainHeader({ label }: { label: string }) {
  return (
    <th scope="col" className={HEADER_CLASS}>
      {label}
    </th>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  const Icon = dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(HEADER_CLASS, "p-0")}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-1 px-3 py-2.5 text-left transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        {label}
        <Icon
          aria-hidden="true"
          className={cn("size-3 shrink-0", active ? "opacity-100" : "opacity-0")}
        />
      </button>
    </th>
  );
}

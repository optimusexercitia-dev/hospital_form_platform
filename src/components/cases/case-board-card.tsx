import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { CaseBoardRow } from "@/lib/queries/cases";
import {
  PhaseStatusPill,
  RecommendedChip,
} from "@/components/cases/phase-status-pill";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { formatCaseNumber, formatDate } from "@/components/cases/format";

/**
 * One row of the cases board: the case header ("Caso 0042" + label + status) and
 * a horizontal strip of per-phase status pills (each with a `recommended`
 * highlight where set). The whole row links to the per-case detail. Mirrors the
 * {@link SignoffQueueList} row idiom — staggered rise-in, hover lift, arrow
 * affordance. Server-Component-safe: the page loads `listCasesBoard` and passes
 * plain rows.
 *
 * The board carries STATUS ONLY — never answers (the Phase-7 invariant).
 */
export function CaseBoardCard({
  slug,
  row,
  index,
}: {
  slug: string;
  row: CaseBoardRow;
  index: number;
}) {
  const c = row.case;
  const phases = [...row.phases].sort((a, b) => a.position - b.position);

  return (
    <Link
      href={`/c/${slug}/manage/cases/${c.id}`}
      style={{ ["--rise-delay" as string]: `${index * 50}ms` }}
      className="animate-rise-in group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold">
              {formatCaseNumber(c.caseNumber)}
            </h2>
            <CaseStatusBadge status={c.status} />
          </div>
          {c.label ? (
            <p className="truncate text-sm text-muted-foreground text-pretty">
              {c.label}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground/70 italic">Sem rótulo</p>
          )}
          <p className="text-xs text-muted-foreground">
            Criado em {formatDate(c.createdAt)}
          </p>
        </div>
        <ArrowUpRight
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground transition-[color,transform] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
        />
      </div>

      <ul aria-label="Fases do caso" className="flex flex-wrap items-center gap-2">
        {phases.map((p) => (
          <li
            key={p.position}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background/60 px-2 py-1"
          >
            <span className="text-xs font-medium text-muted-foreground">
              Fase {p.position}
            </span>
            <PhaseStatusPill status={p.status} />
            {p.recommended && p.status === "pendente" && (
              <RecommendedChip />
            )}
          </li>
        ))}
      </ul>
    </Link>
  );
}

import Link from "next/link";
import { CalendarClock, FileText, ClipboardList } from "lucide-react";

import { commissionHref } from "@/lib/routing";
import type { ReviewDueRow } from "@/lib/controlled-documents/types";
import { ReviewOverdueChip } from "@/components/documents/document-badges";
import { formatDateOnly } from "@/components/documents/format";

/**
 * Review-due list (Phase 17, F5). Surfaces two feeds together: controlled
 * documents whose `reviewDueDate` has passed/approaches, and published FORM
 * versions acting as controlled documents (the `sourceKind` discriminant). Each
 * row links to the artifact it represents. Server-rendered; this list also feeds
 * the Phase-20 escalation surface later.
 *
 * Hrefs are built internally via the pure `commissionHref` from each row's
 * `commissionId`; the page passes the `commissionId → slug` map so a document
 * links to its detail and a form links to its builder version.
 */
export function ReviewDueList({
  rows,
  org,
  commissionSlugById,
}: {
  rows: ReviewDueRow[];
  org: string;
  /** Map of `commissionId` → URL slug, resolved by the page. */
  commissionSlugById: Record<string, string>;
}) {
  if (rows.length === 0) {
    return (
      <div className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <CalendarClock aria-hidden="true" className="size-6" />
        </span>
        <h2 className="text-lg font-semibold">Nenhuma revisão pendente</h2>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          Nenhum documento ou formulário desta comissão está com revisão vencida
          ou próxima do vencimento.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row, i) => {
        const slug = commissionSlugById[row.commissionId];
        const isDocument = row.sourceKind === "document";
        const href =
          slug && isDocument && row.documentId
            ? commissionHref(
                org,
                slug,
                "manage",
                "documentos",
                row.documentId,
              )
            : slug && !isDocument && row.formVersionId
              ? commissionHref(org, slug, "manage", "forms", row.formVersionId)
              : null;
        const Icon = isDocument ? FileText : ClipboardList;
        const key = row.documentId ?? row.formVersionId ?? `${row.code}-${i}`;

        const inner = (
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {row.code}
                  </span>
                  <span className="rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium text-foreground/80">
                    {isDocument ? "Documento" : "Formulário"}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-balance">
                  {row.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {row.commissionName}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5 text-sm">
              <span className="text-muted-foreground">
                Revisão: {formatDateOnly(row.reviewDueDate)}
              </span>
              {row.isOverdue ? <ReviewOverdueChip /> : null}
            </div>
          </div>
        );

        return (
          <li
            key={key}
            className="animate-rise-in"
            style={{ "--rise-delay": `${i * 60}ms` } as React.CSSProperties}
          >
            {href ? (
              <Link
                href={href}
                className="group block rounded-2xl border border-border bg-card p-5 shadow-xs transition-colors hover:border-primary/30 hover:bg-accent/20 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                {inner}
              </Link>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

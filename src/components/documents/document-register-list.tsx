import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

import { commissionHref } from "@/lib/routing";
import type { ControlledDocumentListItem } from "@/lib/documents/types";
import {
  DocumentStatusChip,
  DocumentTypeBadge,
  ReviewOverdueChip,
} from "@/components/documents/document-badges";
import { formatDateOnly, formatVersionNumber } from "@/components/documents/format";

/**
 * The controlled-document register (Phase 17, F1). Server-rendered cards — code,
 * type badge, title, derived status chip, current version, effective + review-due
 * dates, and a "Revisão vencida" flag when overdue. Staggered entrance per the
 * design system.
 *
 * Takes plain `org`/`commission` slugs and builds each card href internally via
 * the pure `commissionHref` — never a function prop, so this stays safe even if
 * pulled into a client tree (the BUG-QI-001 anti-pattern class).
 */
export function DocumentRegisterList({
  documents,
  org,
  commission,
  hasFilters = false,
}: {
  documents: ControlledDocumentListItem[];
  org: string;
  commission: string;
  /** When filters are active, the empty state explains "no matches" vs "none yet". */
  hasFilters?: boolean;
}) {
  if (documents.length === 0) {
    return (
      <div className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileText aria-hidden="true" className="size-6" />
        </span>
        <h3 className="text-lg font-semibold">
          {hasFilters ? "Nenhum documento encontrado" : "Nenhum documento ainda"}
        </h3>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          {hasFilters
            ? "Ajuste os filtros para ver outros documentos controlados."
            : "Crie o primeiro documento controlado desta comissão para gerenciar sua aprovação, vigência e ciclo de revisão."}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {documents.map((doc, i) => (
        <li
          key={doc.id}
          className="animate-rise-in"
          style={{ "--rise-delay": `${i * 60}ms` } as React.CSSProperties}
        >
          <Link
            href={commissionHref(org, commission, "manage", "documentos", doc.id)}
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs transition-colors hover:border-primary/30 hover:bg-accent/20 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {doc.code}
                  </span>
                  <DocumentTypeBadge docType={doc.docType} />
                  {doc.currentVersionNumber != null ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatVersionNumber(doc.currentVersionNumber)}
                    </span>
                  ) : null}
                </div>
                <h3 className="text-base font-semibold text-balance">
                  {doc.title}
                </h3>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <DocumentStatusChip status={doc.status} />
                {doc.isReviewOverdue ? <ReviewOverdueChip /> : null}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <dl className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <div className="flex items-center gap-1.5">
                  <dt className="text-xs">Vigência</dt>
                  <dd className="tabular-nums">
                    {formatDateOnly(doc.effectiveDate)}
                  </dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <dt className="text-xs">Revisão</dt>
                  <dd className="tabular-nums">
                    {formatDateOnly(doc.reviewDueDate)}
                  </dd>
                </div>
              </dl>
              <ArrowRight
                aria-hidden="true"
                className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

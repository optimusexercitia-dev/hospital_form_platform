import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";

import { commissionHref } from "@/lib/routing";
import type {
  ControlledDocumentListItem,
  ObsoleteKind,
} from "@/lib/documents/types";
import { cn } from "@/lib/utils";
import {
  DerivedStatusChip,
  DocumentTypeBadge,
  ObsoleteKindChip,
  ReviewOverdueChip,
  type DerivedDocStatus,
} from "@/components/documents/document-badges";
import { formatDateOnly, formatVersionNumber } from "@/components/documents/format";

/** Per-version approval progress, computed FE-side for `in_approval` rows. */
export interface ApprovalProgress {
  approved: number;
  total: number;
  hasRejection: boolean;
}

/** A register row = the list item plus the FE-derived status/approval extras. */
export interface RegisterItem extends ControlledDocumentListItem {
  derivedStatus: DerivedDocStatus;
  approval?: ApprovalProgress;
}

/** A slim signed/total progress bar for a version awaiting approval. */
function ApprovalMiniBar({ approval }: { approval: ApprovalProgress }) {
  const pct =
    approval.total === 0
      ? 0
      : Math.round((approval.approved / approval.total) * 100);
  return (
    <div className="flex w-full max-w-40 flex-col gap-1">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={approval.approved}
        aria-valuemin={0}
        aria-valuemax={approval.total}
        aria-label={`${approval.approved} de ${approval.total} aprovações`}
      >
        <div
          className={cn(
            "h-full rounded-full",
            approval.hasRejection ? "bg-warning" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {approval.approved}/{approval.total} aprovados
      </span>
    </div>
  );
}

const EMPTY_TITLE = "Nenhum documento ainda";
const EMPTY_FILTERED = "Nenhum documento encontrado";

/**
 * The controlled-document register table (Phase 17 v2, F-A). A list of whole-row
 * links laid out as a grid (Documento · Categoria · Versão · Situação/aprovação ·
 * chevron), with the derived status chip, the `in_approval` approval mini-bar, and
 * surfaced category + tags. Every variable-text cell is `min-w-0 overflow-hidden`
 * so truncation engages at narrow widths. Server-rendered; staggered entrance.
 */
export function DocumentRegisterTable({
  items,
  org,
  commission,
  hasFilters,
}: {
  items: RegisterItem[];
  org: string;
  commission: string;
  /** When filters are active, the empty state explains "no matches" vs "none yet". */
  hasFilters: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileText aria-hidden="true" className="size-6" />
        </span>
        <h3 className="text-lg font-semibold">
          {hasFilters ? EMPTY_FILTERED : EMPTY_TITLE}
        </h3>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          {hasFilters
            ? "Ajuste a busca ou os filtros para ver outros documentos controlados."
            : "Crie o primeiro documento controlado desta comissão para gerenciar sua aprovação, vigência e ciclo de revisão."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      {/* Column header — hidden on mobile where rows stack. */}
      <div className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_auto_auto_20px] items-center gap-4 border-b border-border bg-muted/40 px-5 py-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase sm:grid">
        <span>Documento</span>
        <span>Categoria</span>
        <span>Versão</span>
        <span>Situação</span>
        <span className="sr-only">Abrir</span>
      </div>

      <ul>
        {items.map((doc, i) => {
          const obsoleteKind: ObsoleteKind | null =
            doc.status === "obsolete" ? doc.obsoleteKind : null;
          return (
            <li
              key={doc.id}
              className="animate-rise-in border-b border-border/70 last:border-b-0"
              style={{ "--rise-delay": `${Math.min(i, 8) * 40}ms` } as React.CSSProperties}
            >
              <Link
                href={commissionHref(org, commission, "manage", "documentos", doc.id)}
                className="group grid grid-cols-1 items-start gap-3 px-5 py-4 outline-none transition-colors odd:bg-transparent even:bg-muted/20 hover:bg-accent/25 focus-visible:bg-accent/25 focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/40 sm:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_auto_auto_20px] sm:items-center sm:gap-4"
              >
                {/* Documento */}
                <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                  <span className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:flex">
                    <FileText aria-hidden="true" className="size-4.5" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-foreground">
                        {doc.title}
                      </h3>
                      <DocumentTypeBadge
                        docType={doc.docType}
                        className="hidden shrink-0 md:inline-flex"
                      />
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 overflow-hidden">
                      <span className="shrink-0 font-mono text-xs text-primary">
                        {doc.code}
                      </span>
                      {doc.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="max-w-28 truncate rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                      {doc.tags.length > 2 ? (
                        <span className="text-[11px] text-muted-foreground">
                          +{doc.tags.length - 2}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Categoria */}
                <div className="min-w-0 overflow-hidden">
                  <span className="block truncate text-sm text-muted-foreground">
                    {doc.category ?? "—"}
                  </span>
                </div>

                {/* Versão */}
                <div className="flex flex-col sm:min-w-24">
                  <span className="font-mono text-sm tabular-nums text-foreground">
                    {formatVersionNumber(doc.currentVersionNumber)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {doc.effectiveDate
                      ? `Vig. ${formatDateOnly(doc.effectiveDate)}`
                      : "Sem vigência"}
                  </span>
                </div>

                {/* Situação / aprovação */}
                <div className="flex flex-col items-start gap-1.5 sm:min-w-40">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <DerivedStatusChip status={doc.derivedStatus} />
                    {obsoleteKind ? <ObsoleteKindChip kind={obsoleteKind} /> : null}
                  </div>
                  {doc.status === "in_approval" && doc.approval ? (
                    <ApprovalMiniBar approval={doc.approval} />
                  ) : null}
                  {doc.isReviewOverdue ? <ReviewOverdueChip /> : null}
                </div>

                {/* Chevron */}
                <ChevronRight
                  aria-hidden="true"
                  className="hidden size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

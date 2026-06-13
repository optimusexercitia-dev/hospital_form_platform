import Link from "next/link";
import { ArrowUpRight, Clock, FileText, User } from "lucide-react";

import type { SignoffQueueRow } from "./types";

/**
 * The staff_admin "pendentes de assinatura" queue (F1) — a list of in_progress
 * responses awaiting THIS commission's coordinator signature. Each row links to
 * the review-and-sign screen (F2). Server-Component-safe (no hooks, no actions):
 * the page loads `listSignoffQueue` and passes plain rows.
 */
export function SignoffQueueList({
  slug,
  rows,
}: {
  slug: string;
  rows: SignoffQueueRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="animate-fade-in flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
        <CheckMark />
        <p className="text-base font-medium">Nenhuma assinatura pendente</p>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          Quando uma resposta precisar da sua assinatura para ser enviada, ela
          aparecerá aqui.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <li key={row.responseId}>
          <Link
            href={`/c/${slug}/manage/assinaturas/${row.responseId}`}
            style={{ ["--rise-delay" as string]: `${index * 50}ms` }}
            className="animate-rise-in group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <h2 className="truncate text-base font-semibold">
                {row.formTitle}
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <User aria-hidden="true" className="size-3.5" />
                  {row.respondentName}
                </span>
                <span className="inline-flex items-center gap-1">
                  <FileText aria-hidden="true" className="size-3.5" />
                  {row.sectionTitle}
                  {row.pendingCount > 1 && (
                    <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                      +{row.pendingCount - 1}
                    </span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock aria-hidden="true" className="size-3.5" />
                  Atualizada em {formatDate(row.updatedAt)}
                </span>
                <span>Versão {row.versionNumber}</span>
              </div>
            </div>

            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
              Revisar e assinar
              <ArrowUpRight
                aria-hidden="true"
                className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CheckMark() {
  return (
    <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Clock aria-hidden="true" className="size-5" />
    </span>
  );
}

/** Format an ISO timestamp as a pt-BR short date. */
function formatDate(iso: string): string {
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

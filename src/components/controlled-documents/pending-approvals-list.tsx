import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";

import { orgHref } from "@/lib/routing";
import type { PendingApprovalRow } from "@/lib/controlled-documents/types";
import { DocumentTypeBadge } from "@/components/controlled-documents/document-badges";
import { formatDateTime, formatVersionNumber } from "@/components/controlled-documents/format";

/**
 * Per-user approval queue (Phase 17, F4). Lists the documents the caller was named
 * to approve and has not yet decided ("pendentes de aprovação"). Each row links to
 * the ORG-LEVEL approver detail (`/o/[org]/documentos-pendentes/[documentId]`) —
 * NOT the commission-scoped F3 — because an approver may be OUTSIDE the document's
 * commission (and is not a `staff_admin` there). The org-level route is gated only
 * on the approver-read RLS arm, so no commission slug is needed. Server-rendered.
 */
export function PendingApprovalsList({
  rows,
  org,
}: {
  rows: PendingApprovalRow[];
  org: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ClipboardCheck aria-hidden="true" className="size-6" />
        </span>
        <h2 className="text-lg font-semibold">Nenhuma aprovação pendente</h2>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          Quando um documento controlado indicar você como aprovador, ele
          aparecerá aqui para sua assinatura.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <li
          key={row.approvalId}
          className="animate-rise-in"
          style={{ "--rise-delay": `${i * 60}ms` } as React.CSSProperties}
        >
          <Link
            href={orgHref(org, "documentos-pendentes", row.documentId)}
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs transition-colors hover:border-primary/30 hover:bg-accent/20 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-primary">
                    {row.code}
                  </span>
                  <DocumentTypeBadge docType={row.docType} />
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatVersionNumber(row.versionNumber)}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-balance">
                  {row.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {row.commissionName} · Enviado em{" "}
                  {formatDateTime(row.submittedAt)}
                </p>
              </div>
              <ArrowRight
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

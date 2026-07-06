import { Check, Clock, X } from "lucide-react";

import type { DocumentApproval } from "@/lib/documents/types";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { formatDateTime } from "@/components/documents/format";

/**
 * Approvals + signature-state panel (Phase 17, F3 + F4). Read-only view of each
 * named approver's e-signature slot for the version under approval: name, title,
 * decision (pending / aprovado / rejeitado), when they decided, and any note
 * (Markdown, Rule 7 — sanitized renderer). Server-rendered; the sign action lives
 * in the separate `<ApprovalSignForm>` for the current approver.
 */
export function ApprovalsPanel({
  approvals,
}: {
  approvals: DocumentApproval[];
}) {
  const decidedCount = approvals.filter((a) => a.decision != null).length;

  return (
    <section
      aria-labelledby="approvals-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="approvals-heading" className="text-lg font-semibold">
          Aprovadores
        </h2>
        {approvals.length > 0 ? (
          <span className="text-sm text-muted-foreground tabular-nums">
            {decidedCount} de {approvals.length} assinaram
          </span>
        ) : null}
      </div>

      {approvals.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          Esta versão ainda não foi enviada para aprovação.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/70">
          {approvals.map((approval) => (
            <li key={approval.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {approval.approverName ?? "Aprovador"}
                  </span>
                  {approval.approverTitle ? (
                    <span className="text-sm text-muted-foreground">
                      {approval.approverTitle}
                    </span>
                  ) : null}
                </div>
                <ApprovalDecisionBadge
                  decision={approval.decision}
                  decidedAt={approval.decidedAt}
                />
              </div>
              {approval.note ? (
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <MarkdownRenderer content={approval.note} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ApprovalDecisionBadge({
  decision,
  decidedAt,
}: {
  decision: DocumentApproval["decision"];
  decidedAt: string | null;
}) {
  if (decision === "aprovado") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
        <Check aria-hidden="true" className="size-4" />
        Aprovado
        {decidedAt ? (
          <span className="font-normal text-muted-foreground">
            · {formatDateTime(decidedAt)}
          </span>
        ) : null}
      </span>
    );
  }
  if (decision === "rejeitado") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive">
        <X aria-hidden="true" className="size-4" />
        Rejeitado
        {decidedAt ? (
          <span className="font-normal text-muted-foreground">
            · {formatDateTime(decidedAt)}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      <Clock aria-hidden="true" className="size-4" />
      Pendente
    </span>
  );
}

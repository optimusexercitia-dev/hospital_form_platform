import { Check, Clock, PenLine } from "lucide-react";

import { APPROVAL_DECISION_LABELS, type DocumentApproval } from "@/lib/controlled-documents/types";
import type { ActionState } from "@/lib/controlled-documents/actions";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { formatDateTime } from "@/components/documents/format";
import { RemindApproverButton } from "@/components/documents/remind-approver-button";

/**
 * Approvals + signature-state panel (Phase 17, F3 + F4). Read-only view of each
 * named approver's e-signature slot for the version under approval: name, title,
 * decision (pending / aprovado / rejeitado), when they decided, and any note
 * (Markdown, Rule 7 — sanitized renderer). The sign action lives in the separate
 * `<ApprovalSignForm>` for the current approver.
 *
 * On the COORDINATOR detail (F-C) a `remindAction` + `versionId` are passed so each
 * still-pending approver gets a "Lembrar" button (`remindDocumentApprover`); the
 * approver sign page omits them (read-only roster).
 *
 * `variant="nested"` (doc-detail redesign) reads as a panel INSIDE the working
 * draft's version card — a muted inner surface, hairline border, tighter padding,
 * no outer shadow — instead of the standalone card. Default `standalone` keeps the
 * original look unchanged (used by the approver sign page).
 */
export function ApprovalsPanel({
  approvals,
  remindAction,
  versionId,
  variant = "standalone",
}: {
  approvals: DocumentApproval[];
  remindAction?: (versionId: string, approverId: string) => Promise<ActionState>;
  /** The version the approvals belong to — required for Remind. */
  versionId?: string;
  variant?: "standalone" | "nested";
}) {
  const decidedCount = approvals.filter((a) => a.decision != null).length;
  const canRemind = remindAction != null && versionId != null;
  const isNested = variant === "nested";

  return (
    <section
      aria-labelledby="approvals-heading"
      className={cn(
        "flex flex-col gap-4",
        isNested
          ? "rounded-xl border border-border bg-muted/20 p-4"
          : "rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6",
      )}
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
                <div className="flex flex-col items-end gap-1.5">
                  <ApprovalDecisionBadge
                    decision={approval.decision}
                    decidedAt={approval.decidedAt}
                  />
                  {canRemind && approval.decision == null ? (
                    <RemindApproverButton
                      versionId={versionId}
                      approverId={approval.approverId}
                      action={remindAction}
                    />
                  ) : null}
                </div>
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
  if (decision === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
        <Check aria-hidden="true" className="size-4" />
        {APPROVAL_DECISION_LABELS.approved}
        {decidedAt ? (
          <span className="font-normal text-muted-foreground">
            · {formatDateTime(decidedAt)}
          </span>
        ) : null}
      </span>
    );
  }
  if (decision === "rejected") {
    // "Alterações solicitadas" — an attention (amber) verdict, distinct from the
    // positive `approved` and the neutral `pending`. Not red: this is a revision
    // request, not a hard failure.
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-warning">
        <PenLine aria-hidden="true" className="size-4" />
        {APPROVAL_DECISION_LABELS.rejected}
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

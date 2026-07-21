import type { ReactNode } from "react";

import type { DocType } from "@/lib/documents/types";
import { DOC_TYPE_LABELS } from "@/lib/documents/types";
import {
  DerivedStatusChip,
  DocumentTypeBadge,
  type DerivedDocStatus,
} from "@/components/documents/document-badges";
import { formatDateOnly } from "@/components/documents/format";

/**
 * Full-width identity card atop the controlled-document detail (doc-detail
 * redesign, approved mockup). Two regions in a wrapping flex row: the left
 * "lead" (code/type/status chips, title, meta line, description) and a right,
 * STATE-DEPENDENT action cluster the caller composes and passes in via
 * `actions` — this component only lays it out, it never decides which actions
 * apply. Server-safe presentational (no client state, no data access).
 */
export function DocumentIdentityCard({
  code,
  docType,
  derivedStatus,
  title,
  reviewCycleMonths,
  effectiveDate,
  effectiveVersionNumber,
  description,
  actions,
}: {
  code: string;
  docType: DocType;
  derivedStatus: DerivedDocStatus;
  title: string;
  reviewCycleMonths: number | null;
  /** The in-force version's effective date, if any — drives "Vigente desde …". */
  effectiveDate: string | null;
  /** The in-force version number, appended to the "Vigente desde" meta item. */
  effectiveVersionNumber: number | null;
  description: string | null;
  /** The state-dependent action cluster (buttons/links/menu), composed by the page. */
  actions?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="doc-identity-heading"
      className="flex flex-wrap gap-6 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
    >
      <div className="flex min-w-72 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-primary">{code}</span>
          <DocumentTypeBadge docType={docType} />
          <DerivedStatusChip status={derivedStatus} />
        </div>
        <h1 id="doc-identity-heading" className="text-3xl text-balance">
          {title}
        </h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{DOC_TYPE_LABELS[docType]}</span>
          {reviewCycleMonths != null ? (
            <>
              <span aria-hidden="true">·</span>
              <span>Revisão a cada {reviewCycleMonths} meses</span>
            </>
          ) : null}
          {effectiveDate ? (
            <>
              <span aria-hidden="true">·</span>
              <span>
                Vigente desde {formatDateOnly(effectiveDate)}
                {effectiveVersionNumber != null
                  ? ` (v${effectiveVersionNumber})`
                  : ""}
              </span>
            </>
          ) : null}
        </p>
        {description ? (
          <p className="max-w-prose text-sm whitespace-pre-wrap text-foreground text-pretty">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:min-w-60 sm:flex-none">
          {actions}
        </div>
      ) : null}
    </section>
  );
}

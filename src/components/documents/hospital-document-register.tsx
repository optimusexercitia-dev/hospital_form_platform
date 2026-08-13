import { FileText } from "lucide-react";

import type { HospitalDocumentRegisterRow } from "@/lib/controlled-documents/types";
import {
  DocumentStatusChip,
  DocumentTypeBadge,
  ReviewOverdueChip,
} from "@/components/documents/document-badges";
import { formatDateOnly, formatVersionNumber } from "@/components/documents/format";

/**
 * Hospital-wide controlled-document register (Phase 17, F6). A PHI-free, read-only
 * per-commission rollup for the hospital-admin surface — code/type/status/version/
 * review-due only (no Markdown bodies or storage paths; mirrors the `nsp_org_*`
 * aggregate screens). Backed by `getHospitalDocumentRegister`; rows are grouped
 * by commission for readability.
 */
export function HospitalDocumentRegister({
  hospitalName,
  rows,
}: {
  hospitalName: string;
  rows: HospitalDocumentRegisterRow[];
}) {
  // Group by commission, preserving the query's (name-then-code) order.
  const groups = new Map<
    string,
    { commissionName: string; rows: HospitalDocumentRegisterRow[] }
  >();
  for (const row of rows) {
    const group = groups.get(row.commissionId);
    if (group) {
      group.rows.push(row);
    } else {
      groups.set(row.commissionId, {
        commissionName: row.commissionName,
        rows: [row],
      });
    }
  }
  const commissionGroups = [...groups.values()];

  return (
    <section
      aria-labelledby={`register-${hospitalName}`}
      className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`register-${hospitalName}`} className="text-lg font-semibold">
          {hospitalName}
        </h2>
        <span className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "documento" : "documentos"}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileText aria-hidden="true" className="size-5" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            Nenhuma comissão deste hospital possui documentos controlados.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {commissionGroups.map((group) => (
            <div key={group.commissionName} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium tracking-[0.12em] text-muted-foreground uppercase">
                {group.commissionName}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">
                    Documentos controlados de {group.commissionName}
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Código
                      </th>
                      <th scope="col" className="py-2 px-3 font-medium">
                        Documento
                      </th>
                      <th scope="col" className="py-2 px-3 font-medium">
                        Situação
                      </th>
                      <th scope="col" className="py-2 px-3 text-right font-medium">
                        Vigência
                      </th>
                      <th scope="col" className="py-2 pl-3 text-right font-medium">
                        Revisão
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr
                        key={row.documentId}
                        className="border-b border-border/60 last:border-b-0 align-top"
                      >
                        <td className="py-2 pr-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {row.code}
                          {row.currentVersionNumber != null ? (
                            <span className="ml-1">
                              {formatVersionNumber(row.currentVersionNumber)}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-foreground/90">
                              {row.title}
                            </span>
                            <DocumentTypeBadge
                              docType={row.docType}
                              className="w-fit"
                            />
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-col items-start gap-1.5">
                            <DocumentStatusChip status={row.status} />
                            {row.isReviewOverdue ? <ReviewOverdueChip /> : null}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                          {formatDateOnly(row.effectiveDate)}
                        </td>
                        <td className="py-2 pl-3 text-right tabular-nums whitespace-nowrap">
                          {formatDateOnly(row.reviewDueDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

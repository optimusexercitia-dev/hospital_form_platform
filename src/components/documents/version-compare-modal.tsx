"use client";

import type { ControlledDocumentVersion } from "@/lib/documents/types";
import { DOC_STATUS_LABELS } from "@/lib/documents/types";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { formatDateOnly, formatVersionNumber } from "@/components/documents/format";

/** A version paired with whether it has a stored file (drives the "Arquivo" row). */
export interface CompareVersion extends ControlledDocumentVersion {
  hasFile: boolean;
}

interface CompareRow {
  label: string;
  before: string;
  after: string;
}

function buildRows(before: CompareVersion, after: CompareVersion): CompareRow[] {
  return [
    { label: "Situação", before: DOC_STATUS_LABELS[before.status], after: DOC_STATUS_LABELS[after.status] },
    { label: "Enviada em", before: formatDateOnly(before.createdAt), after: formatDateOnly(after.createdAt) },
    { label: "Vigência", before: formatDateOnly(before.effectiveDate), after: formatDateOnly(after.effectiveDate) },
    { label: "Revisão", before: formatDateOnly(before.reviewDueDate), after: formatDateOnly(after.reviewDueDate) },
    { label: "Expiração", before: formatDateOnly(before.expiryDate), after: formatDateOnly(after.expiryDate) },
    { label: "Autor", before: before.createdByName ?? "—", after: after.createdByName ?? "—" },
    { label: "Arquivo", before: before.hasFile ? "Anexado" : "Sem arquivo", after: after.hasFile ? "Anexado" : "Sem arquivo" },
  ];
}

/**
 * Side-by-side version comparison (Phase 17 v2, F-C). Compares two versions'
 * metadata + change summary; cells in the newer ("Depois") column that differ from
 * the older are highlighted with an "alterado" tag. Focus-trapped via the platform
 * Dialog (Radix — focus trap/restore, Escape, scrim come for free). Pure client
 * over already-loaded data (no backend call).
 */
export function VersionCompareModal({
  open,
  onOpenChange,
  a,
  b,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  a: CompareVersion;
  b: CompareVersion;
}) {
  // Order older → newer by version number so "Antes"/"Depois" read chronologically.
  const [before, after] = a.versionNumber <= b.versionNumber ? [a, b] : [b, a];
  const rows = buildRows(before, after);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Comparar {formatVersionNumber(before.versionNumber)} →{" "}
            {formatVersionNumber(after.versionNumber)}
          </DialogTitle>
          <DialogDescription>
            Diferenças de metadados e resumo entre as duas versões selecionadas.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="w-32 py-2 pr-3 font-medium text-muted-foreground" scope="col">
                  Campo
                </th>
                <th className="py-2 pr-3 font-mono font-medium text-muted-foreground" scope="col">
                  {formatVersionNumber(before.versionNumber)} · Antes
                </th>
                <th className="py-2 font-mono font-medium text-muted-foreground" scope="col">
                  {formatVersionNumber(after.versionNumber)} · Depois
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const changed = row.before !== row.after;
                return (
                  <tr key={row.label} className="border-b border-border/60">
                    <th
                      scope="row"
                      className="py-2.5 pr-3 text-left align-top font-medium text-muted-foreground"
                    >
                      {row.label}
                    </th>
                    <td className="py-2.5 pr-3 align-top tabular-nums text-foreground">
                      {row.before}
                    </td>
                    <td
                      className={cn(
                        "py-2.5 align-top tabular-nums",
                        changed
                          ? "bg-accent/40 font-medium text-accent-foreground"
                          : "text-foreground",
                      )}
                    >
                      <span className="flex flex-wrap items-center gap-1.5 px-1.5">
                        {row.after}
                        {changed ? (
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            alterado
                          </span>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Resumo das alterações · {formatVersionNumber(after.versionNumber)}
          </p>
          {after.summaryOfChangesMd ? (
            <MarkdownRenderer content={after.summaryOfChangesMd} />
          ) : (
            <p className="text-sm text-muted-foreground">Sem resumo informado.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

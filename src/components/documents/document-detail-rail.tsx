import { ShieldCheck } from "lucide-react";

import type { ControlledDocument } from "@/lib/controlled-documents/types";
import { DOC_TYPE_LABELS } from "@/lib/controlled-documents/types";
import { formatDateOnly } from "@/components/documents/format";

/**
 * Detail right rail (Phase 17 v2, F-C): a "Detalhes do documento" metadata card
 * (ID / type / committee / category / effective / next review / cycle / tags) and a
 * "Documento controlado" info card stating the three read-only guarantees.
 * Server-safe presentational.
 */
export function DocumentDetailRail({
  document,
  commissionName,
  effectiveDate,
  reviewDueDate,
}: {
  document: ControlledDocument;
  commissionName: string;
  effectiveDate: string | null;
  reviewDueDate: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="details-heading"
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
      >
        <h2 id="details-heading" className="text-sm font-semibold">
          Detalhes do documento
        </h2>
        <dl className="flex flex-col gap-3 text-sm">
          <RailRow label="Código">
            <span className="font-mono text-primary">{document.code}</span>
          </RailRow>
          <RailRow label="Tipo">{DOC_TYPE_LABELS[document.docType]}</RailRow>
          <RailRow label="Comissão">{commissionName}</RailRow>
          <RailRow label="Categoria">{document.category ?? "—"}</RailRow>
          <RailRow label="Vigência">
            <span className="tabular-nums">{formatDateOnly(effectiveDate)}</span>
          </RailRow>
          <RailRow label="Próxima revisão">
            <span className="tabular-nums">{formatDateOnly(reviewDueDate)}</span>
          </RailRow>
          <RailRow label="Ciclo de revisão">
            {document.reviewCycleMonths != null
              ? `${document.reviewCycleMonths} meses`
              : "—"}
          </RailRow>
        </dl>
        {document.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
            {document.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/20 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
          Documento controlado
        </h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-xs text-muted-foreground text-pretty">
          <li>Versões vigentes são somente leitura.</li>
          <li>Qualquer alteração exige uma nova versão e nova assinatura.</li>
          <li>Todas as versões anteriores são mantidas para auditoria.</li>
        </ul>
      </section>
    </div>
  );
}

function RailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}

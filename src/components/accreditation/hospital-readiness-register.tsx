import { Award } from "lucide-react";

import type { HospitalReadinessRow } from "@/lib/accreditation/types";
import { plural } from "@/components/accreditation/format";
import {
  AssessmentStatusChip,
  HospitalReadinessResolutionChip,
  LevelBadge,
} from "@/components/accreditation/status-chips";
import { EvidenceCountBadge } from "@/components/accreditation/evidence-count-badge";
import { OwnershipEditor } from "@/components/accreditation/ownership-editor";

/**
 * Hospital-wide consolidated accreditation readiness (Wave 3 hospital
 * surface). A PHI-free, counts-only per-standard rollup across a hospital's
 * commissions (D7/D8) — mirrors `hospital-document-register.tsx`'s shape.
 * `note`/`note_md` never reach this component: {@link HospitalReadinessRow}
 * has no such field at all, so there is nothing to accidentally render.
 */
export function HospitalReadinessRegister({
  hospitalId,
  hospitalName,
  rows,
  canEditOwnership,
  commissionOptions,
  commissionNameById,
}: {
  hospitalId: string;
  hospitalName: string;
  rows: HospitalReadinessRow[];
  /** Whether the viewer is `hospital_admin` of THIS hospital (renders the editable editor; org_admin-only viewers get a read-only chip). */
  canEditOwnership: boolean;
  /** This hospital's own commissions — the ownership editor's option list. */
  commissionOptions: { id: string; name: string }[];
  /** commissionId → name, for the read-only "Responsável" chip. */
  commissionNameById: Record<string, string>;
}) {
  const leveled = rows.some((r) => r.level != null);

  return (
    <section
      aria-labelledby={`hospital-readiness-${hospitalId}`}
      className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`hospital-readiness-${hospitalId}`} className="text-lg font-semibold">
          {hospitalName}
        </h2>
        <span className="text-sm text-muted-foreground">
          {rows.length} {plural(rows.length, "padrão", "padrões")}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Award aria-hidden="true" className="size-5" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            Nenhuma comissão deste hospital avaliou padrões deste framework ainda.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Prontidão consolidada de {hospitalName}</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Código
                </th>
                <th scope="col" className="py-2 px-3 font-medium">
                  Padrão
                </th>
                {leveled && (
                  <th scope="col" className="py-2 px-3 font-medium">
                    Nível
                  </th>
                )}
                <th scope="col" className="py-2 px-3 font-medium">
                  Status
                </th>
                <th scope="col" className="py-2 px-3 font-medium">
                  Resolução
                </th>
                <th scope="col" className="py-2 px-3 font-medium">
                  Evidências
                </th>
                <th scope="col" className="py-2 pl-3 font-medium">
                  Responsável
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.standardId} className="border-b border-border/60 last:border-b-0 align-top">
                  <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap text-muted-foreground">
                    {row.standardCode}
                  </td>
                  <td className="py-2 px-3 font-medium text-foreground/90">{row.standardTitle}</td>
                  {leveled && (
                    <td className="py-2 px-3">
                      {row.level != null ? <LevelBadge level={row.level} /> : null}
                    </td>
                  )}
                  <td className="py-2 px-3">
                    <AssessmentStatusChip status={row.consolidatedStatus} />
                  </td>
                  <td className="py-2 px-3">
                    <HospitalReadinessResolutionChip resolution={row.resolution} />
                  </td>
                  <td className="py-2 px-3">
                    <EvidenceCountBadge
                      valida={row.evidenceValida}
                      atencao={row.evidenceAtencao}
                      vencida={row.evidenceVencida}
                      restrita={row.evidenceRestrita}
                    />
                  </td>
                  <td className="py-2 pl-3">
                    {canEditOwnership ? (
                      <OwnershipEditor
                        hospitalId={hospitalId}
                        standardId={row.standardId}
                        currentCommissionId={row.responsibleCommissionId}
                        commissionOptions={commissionOptions}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {row.responsibleCommissionId
                          ? (commissionNameById[row.responsibleCommissionId] ?? "—")
                          : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

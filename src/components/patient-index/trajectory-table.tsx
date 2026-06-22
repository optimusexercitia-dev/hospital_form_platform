import Link from "next/link";
import { ArrowUpRight, ShieldOff } from "lucide-react";

import {
  PATIENT_MATCH_BASIS_LABELS,
  PATIENT_XREF_MODULE_LABELS,
  PATIENT_XREF_MODULE_TOKENS,
  type TrajectoryEntry,
} from "@/lib/patient-index/types";
import { formatDate } from "./format";
import { PATIENT_META_CHIP_BASE, patientModuleChipClass } from "./format";

/**
 * The QPS cross-committee patient TRAJECTORY table (Phase 23 — `patient_index`;
 * ADR 0039). One row per entity (case / safety-event / referral) the patient (or
 * the encounter) touched across ALL committees.
 *
 * PHI-FREE by construction: entity code, module, owning commission NAME, the
 * matched-on basis, lifecycle dates, and the disposed flag — never a name or MRN.
 * Each row deep-links to that record's existing detail page, where opening the
 * identifiers still funnels through that module's AUDITED door — this view never
 * reveals PHI itself.
 *
 * Presentational + server-safe (no `"use client"`, no data access): the page (or
 * the search view) loads the entries and passes them in. Renders its OWN empty
 * state so both the search-result and deep-link callers get a friendly pt-BR
 * "nenhum registro encontrado" without duplicating copy.
 */

/** Resolve a trajectory entry to its module-native detail-page href (PHI-free). */
function entityHref(entry: TrajectoryEntry): string | null {
  switch (entry.module) {
    case "event":
      // The NSP event detail (QPS-scoped); the audited PHI door lives there.
      return `/admin/nsp/${entry.entityId}`;
    case "referral":
    case "case":
      // Referrals and cases are commission-scoped; without the slug the QPS view
      // cannot build a stable per-commission href, so the code renders inert.
      // (A slug-aware deep-link is a thin follow-up; the trajectory + audit are
      // the QPS value here.)
      return null;
    default:
      return null;
  }
}

export function TrajectoryTable({ entries }: { entries: TrajectoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground text-pretty">
        Nenhum registro encontrado para os identificadores informados.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Trajetória do paciente entre comissões — registros, módulo, comissão,
          situação e datas.
        </caption>
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
            <th scope="col" className="px-4 py-3 font-medium">
              Registro
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Módulo
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Comissão
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Correspondência
            </th>
            <th scope="col" className="px-4 py-3 font-medium tabular-nums">
              Vinculado em
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              <span className="sr-only">Situação dos dados e ação</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const href = entityHref(entry);
            return (
              <tr
                key={`${entry.module}:${entry.entityId}`}
                data-rise
                className="border-b border-border/70 last:border-0 transition-colors hover:bg-muted/30"
              >
                <th
                  scope="row"
                  className="px-4 py-3 text-left font-mono text-sm font-medium text-foreground"
                >
                  {entry.entityCode}
                </th>
                <td className="px-4 py-3">
                  <span
                    className={`${PATIENT_META_CHIP_BASE} ${patientModuleChipClass(
                      PATIENT_XREF_MODULE_TOKENS[entry.module],
                    )}`}
                  >
                    {PATIENT_XREF_MODULE_LABELS[entry.module]}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground text-pretty">
                  {entry.commissionName ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {PATIENT_MATCH_BASIS_LABELS[entry.matchedOn]}
                </td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">
                  {formatDate(entry.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    {entry.disposed && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                        title={
                          entry.disposedAt
                            ? `Dados do paciente descartados em ${formatDate(
                                entry.disposedAt,
                              )}`
                            : "Dados do paciente descartados"
                        }
                      >
                        <ShieldOff aria-hidden="true" className="size-3.5" />
                        PHI descartado
                      </span>
                    )}
                    {href ? (
                      <Link
                        href={href}
                        className="inline-flex items-center gap-1 rounded text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                      >
                        Abrir
                        <ArrowUpRight aria-hidden="true" className="size-4" />
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground/70">—</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import { Users } from "lucide-react";

import {
  PATIENT_MATCH_BASIS_LABELS,
  type PatientSearchResult,
} from "@/lib/patient-index/types";
import { TrajectoryTable } from "./trajectory-table";

/**
 * The PHI-FREE trajectory RESULT block (Phase 23 — `patient_index`; ADR 0039): a
 * match-summary heading + the {@link TrajectoryTable}. Shared by BOTH entry points
 * so they render identically — the typed-search view (client) and the
 * `?entity=<module>:<id>` deep-link (server) — keeping the chrome in one place.
 *
 * Presentational + server-safe (no `"use client"`, no data access): the caller
 * resolves the {@link PatientSearchResult} bundle and passes it in. The trailing
 * `children` slot is where each caller drops its own access-audit affordance (the
 * search path mounts the lazy table; the deep-link path explains it stays on the
 * search — the audit query is MRN-keyed, ADR 0039 contract).
 */
export function TrajectoryResult({
  org,
  result,
  headingId = "patient-trajectory-heading",
  children,
}: {
  /** The org slug whose NSP console this is — builds the per-org entity hrefs. */
  org: string;
  result: PatientSearchResult;
  /** Override when more than one trajectory heading could exist on a page. */
  headingId?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="inline-flex items-center gap-2 text-xl">
          <Users aria-hidden="true" className="size-5 text-primary" />
          Trajetória do paciente
        </h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          {result.matchCount === 0
            ? "Nenhum registro"
            : `${result.matchCount} ${
                result.matchCount === 1 ? "registro" : "registros"
              } · por ${PATIENT_MATCH_BASIS_LABELS[
                result.matchedOn
              ].toLowerCase()}`}
        </span>
      </div>

      <TrajectoryTable org={org} entries={result.entries} />

      {children}
    </div>
  );
}

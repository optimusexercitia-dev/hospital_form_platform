"use client";

import { useState, useTransition } from "react";
import { History, ScrollText } from "lucide-react";

import type { PatientAccessAuditRow } from "@/lib/patient-index/types";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { formatDateTime } from "./format";

/**
 * The patient-scoped ACCESS-AUDIT table (Phase 23 — `patient_index`; Rule 11; ADR
 * 0039) — WHO read (or disposed) this patient's PHI, across ALL committees. Loaded
 * LAZILY on demand (the QPS page composes "trajectory + access audit" as two
 * reads; the audit is the heavier one), so a reviewer pulls the cross-committee
 * access history only when they want it.
 *
 * PHI-FREE: actor name, action verb, entity reference, committee name, timestamp —
 * never the clinical payload (Rule 11). Reading this audit is NOT itself
 * re-audited (the DEFINER door is a QPS-only cross-committee view).
 *
 * The fetch is injected as a prop (`onLoad`) bound by the page/search-view to the
 * resolved identifiers, keeping this client component free of any server-only
 * import (the client-bundle boundary; Rule 9). A non-PQS caller gets `[]` from the
 * door — we render a calm empty state, never a raw error.
 */
export function AccessAuditTable({
  onLoad,
}: {
  /** The audited-history loader, bound by the page to the search identifiers. */
  onLoad: () => Promise<PatientAccessAuditRow[]>;
}) {
  const [isPending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [rows, setRows] = useState<PatientAccessAuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await onLoad();
        setRows(result);
        setLoaded(true);
      } catch {
        setError(
          "Não foi possível carregar o histórico de acesso. Tente novamente.",
        );
      }
    });
  }

  return (
    <section
      aria-labelledby="patient-access-audit-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScrollText aria-hidden="true" className="size-4 text-primary" />
          <h2
            id="patient-access-audit-heading"
            className="text-base font-semibold"
          >
            Histórico de acesso
          </h2>
        </div>
        {!loaded && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={load}
            disabled={isPending}
          >
            <History aria-hidden="true" />
            {isPending ? "Carregando…" : "Carregar histórico"}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-pretty">
        Quem acessou os dados deste paciente em todas as comissões — ator, ação,
        registro e data. Não contém a identificação nem o conteúdo clínico.
      </p>

      {error && <FormBanner tone="error">{error}</FormBanner>}

      {loaded &&
        (rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground text-pretty">
            Nenhum acesso registrado para este paciente.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Histórico de acesso aos dados do paciente entre comissões.
              </caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Ator
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Ação
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Comissão
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 font-medium tabular-nums"
                  >
                    Quando
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/70 last:border-0"
                  >
                    <td className="px-4 py-3 text-foreground text-pretty">
                      {row.actorName ?? "Sistema"}
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                        {row.action}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-pretty">
                      {row.commissionName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {formatDateTime(row.occurredAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </section>
  );
}

import { ClipboardList } from "lucide-react";

import type { CapaPlan } from "@/lib/safety/capa-types";
import type { RcaRootCause } from "@/lib/safety/rca-types";
import { OpenCapaButton } from "./open-capa-button";
import { CapaPlanCard } from "./capa-plan-card";

/**
 * Stage 4 of the RCA workspace — the CAPA entry point (replaces the 14c placeholder).
 * Lists the plans opened from this RCA and offers "Abrir plano de ação" both at the
 * plan level and per root cause (the root-cause→action link is set on the action
 * inside the plan). Server-Component-safe.
 *
 * `canManage` reflects the per-org RCA write authority (`rca.viewerCanWrite`, the
 * server/RLS authority) — a viewer who reaches this stage with write may open CAPA
 * plans.
 *
 * @param org  the org slug whose NSP console this is — builds the per-org CAPA hrefs.
 */
export function CapaStage({
  org,
  rcaId,
  plans,
  rootCauses,
  canManage,
}: {
  org: string;
  rcaId: string;
  plans: CapaPlan[];
  rootCauses: RcaRootCause[];
  canManage: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="capa-stage-plans"
        className="flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList aria-hidden="true" className="size-4 text-muted-foreground" />
            <h3 id="capa-stage-plans" className="text-lg">
              Planos de ação
            </h3>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
              {plans.length}
            </span>
          </div>
          {canManage && (
            <OpenCapaButton source="rca" sourceId={rcaId} />
          )}
        </div>

        {plans.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground text-pretty">
            Nenhum plano de ação ainda. Abra um plano para endereçar as causas raiz
            desta análise com ações corretivas e preventivas (PDCA), medidas e
            verificação de eficácia.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {plans.map((plan) => (
              <li key={plan.id}>
                <CapaPlanCard org={org} plan={plan} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {rootCauses.length > 0 && (
        <section
          aria-labelledby="capa-stage-roots"
          className="flex flex-col gap-3"
        >
          <h3
            id="capa-stage-roots"
            className="text-sm font-semibold tracking-wide text-muted-foreground uppercase"
          >
            Abrir plano por causa raiz
          </h3>
          <ul className="flex flex-col gap-2">
            {rootCauses.map((rc, i) => (
              <li
                key={rc.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-xs"
              >
                <span className="flex min-w-0 items-start gap-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-pretty">{rc.text || "Causa sem texto"}</span>
                </span>
                {canManage && (
                  <OpenCapaButton
                    source="rca"
                    sourceId={rcaId}
                    label="Abrir plano"
                    variant="outline"
                    size="sm"
                    rootCauseHint
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

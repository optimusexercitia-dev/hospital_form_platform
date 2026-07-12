"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ShieldPlus, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ActionItemFallbackDialog } from "@/components/indicators/action-item-fallback-dialog";
import { nspHref } from "@/lib/routing";
import type { CapaPlan } from "@/lib/safety/capa-types";
import { CAPA_STATUS_LABELS } from "@/lib/safety/capa-types";
import type {
  Indicator,
  IndicatorMeasurement,
} from "@/lib/indicators/types";
import type { ActionState } from "@/lib/indicators/actions";
import type { CreateActionItemState } from "@/lib/action-items/actions";

type OpenCapaAction = (
  indicatorId: string,
  measurementId: string,
) => Promise<ActionState>;
type CreateManualAction = (
  prev: CreateActionItemState | undefined,
  formData: FormData,
) => Promise<CreateActionItemState>;

/**
 * Two-tier off-target CAPA affordance (Phase 15, F5).
 *
 * When the LATEST measurement is off target, this panel offers escalation:
 *   - PQS OPERATORS of the indicator's hospital see **"Abrir plano de ação
 *     (CAPA)"** → `openCapaFromIndicator` (the operator arm — built now).
 *   - Non-operator staff_admins see **"Criar item de ação"** → the shared
 *     Action-Items Hub with indicator context pre-filled (the fallback arm —
 *     wired to backend task B7's `manual`-source create action, not yet posted;
 *     marked TODO below).
 *
 * The button visibility is capability-gated on `isPqsOperator` (derived from the
 * session's NSP grants vs the indicator's hospital) — but visibility is display
 * only; `open_capa_plan` (PQS-operator-gated, 42501 otherwise) is the real
 * security boundary. Existing plans opened from this indicator are always listed.
 *
 * NB: the CAPA-detail href is built HERE from the plain `org` slug via the pure,
 * client-safe `nspHref` — a function/closure must never be passed as a prop across
 * the server→client boundary (RSC serialization error; BUG-QI-001).
 */
export function CapaAffordance({
  indicator,
  latestMeasurement,
  isPqsOperator,
  openCapaAction,
  createManualAction,
  org,
  plans,
}: {
  indicator: Indicator;
  /** The most recent measurement (drives the off-target escalation). */
  latestMeasurement: IndicatorMeasurement | null;
  /** Whether the viewer is a PQS operator of the indicator's hospital. */
  isPqsOperator: boolean;
  openCapaAction: OpenCapaAction;
  /** The shared-hub `manual`-source create action for the non-operator fallback (B7). */
  createManualAction: CreateManualAction;
  /** The org slug — the CAPA-detail href is built inside via `nspHref` (serializable prop). */
  org: string;
  plans: CapaPlan[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isOffTarget = latestMeasurement?.status === "off_target";

  function openCapa() {
    if (!latestMeasurement) return;
    setError(null);
    startTransition(async () => {
      const result = await openCapaAction(indicator.id, latestMeasurement.id);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível abrir o plano de ação.");
        return;
      }
      router.refresh();
    });
  }

  // Nothing to show when on target / no data AND no existing plans.
  if (!isOffTarget && plans.length === 0) return null;

  return (
    <section
      aria-labelledby="capa-affordance-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
    >
      <div className="flex items-start gap-3">
        {isOffTarget ? (
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert aria-hidden="true" className="size-5" />
          </span>
        ) : null}
        <div className="flex flex-col gap-1">
          <h2 id="capa-affordance-heading" className="text-lg font-semibold">
            Plano de ação
          </h2>
          {isOffTarget ? (
            <p className="text-sm text-muted-foreground text-pretty">
              A última medição está fora da meta. Escale para um plano de ação
              corretiva (CAPA) do NSP ou registre um item de ação.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground text-pretty">
              Planos de ação abertos a partir deste indicador.
            </p>
          )}
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}

      {isOffTarget ? (
        <div className="flex flex-wrap gap-3">
          {isPqsOperator ? (
            <Button
              type="button"
              onClick={openCapa}
              disabled={pending}
              size="lg"
            >
              <ShieldPlus aria-hidden="true" className="size-4" />
              {pending ? "Abrindo…" : "Abrir plano de ação (CAPA)"}
            </Button>
          ) : (
            // Non-operator fallback (B7): create a committee action item on the
            // shared hub, pre-filled with the indicator context.
            <ActionItemFallbackDialog
              indicator={indicator}
              latestMeasurement={latestMeasurement}
              createManualAction={createManualAction}
            />
          )}
        </div>
      ) : null}

      {plans.length > 0 ? (
        <ul className="flex flex-col gap-2 border-t border-border/60 pt-4">
          {plans.map((plan) => (
            <li key={plan.id}>
              <Link
                href={nspHref(org, "capa", plan.id)}
                className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-2.5 text-sm transition-colors hover:border-primary/30 hover:bg-accent/20 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {plan.code}
                  </span>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                    {CAPA_STATUS_LABELS[plan.status]}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

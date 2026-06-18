import type {
  CapaAction,
  CapaActionEvidence,
  CapaActionTask,
  CapaEffectiveness,
  CapaMeasure,
  CapaMeasureResult,
  CapaPlan,
} from "@/lib/safety/capa-types";
import type { AssignableUser, RcaRootCause } from "@/lib/safety/rca-types";
import { SafetyMotion } from "../safety-motion";
import { CapaHeader } from "./capa-header";
import { PdcaWheel } from "./pdca-wheel";
import { CapaActionsSection } from "./capa-actions-section";
import { CapaMeasuresSection } from "./capa-measures-section";
import { CapaEffectivenessPanel } from "./capa-effectiveness-panel";
import { CapaClosurePanel } from "./capa-closure-panel";
import {
  concludeGate,
  derivePdca,
  groupResultsByMeasure,
} from "./capa-derive";
import { CapaStatusChip } from "./capa-badges";
import { CAPA_STATUS_LABELS } from "@/lib/safety/capa-types";

/** The full payload the server loads for the CAPA workspace. */
export interface CapaWorkspaceData {
  plan: CapaPlan;
  actions: CapaAction[];
  tasksByAction: Map<string, CapaActionTask[]>;
  evidenceByAction: Map<string, CapaActionEvidence[]>;
  measures: CapaMeasure[];
  measureResults: CapaMeasureResult[];
  effectiveness: CapaEffectiveness | null;
  /** The source RCA's root causes (empty for a non-RCA plan). */
  rootCauses: RcaRootCause[];
  users: AssignableUser[];
  sessionUserId: string | null;
}

/**
 * The CAPA workspace (Phase 14d, README_rca stage 4). Server-composed: lays out the
 * header, the plan-level PDCA wheel (purely derived), the actions section (with
 * tasks/evidence/advance), the measures→results grid, the effectiveness panel, and
 * the closure panel with its conclude-gate. Write gating flows from
 * `plan.viewerCanManage` + per-action assignee entitlement (client-computed).
 */
export function CapaWorkspace({ data }: { data: CapaWorkspaceData }) {
  const { plan } = data;
  const resultsByMeasure = groupResultsByMeasure(data.measureResults);
  const cells = derivePdca(plan, data.actions, data.measures, resultsByMeasure);
  const gate = concludeGate(plan, data.actions, data.effectiveness);
  const canManage = plan.viewerCanManage;
  const isClosed = plan.status === "concluido";

  const terminalLabel =
    plan.status === "concluido"
      ? "Concluído"
      : plan.status === "cancelado"
        ? "Cancelado"
        : null;

  const rootCauseTextById = new Map(
    data.rootCauses.map((rc) => [rc.id, rc.text]),
  );

  return (
    <SafetyMotion runKey={`${plan.id}-${plan.status}`} className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
      <div data-rise>
        <CapaHeader plan={plan} />
      </div>

      <div
        data-rise
        className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-card p-6 shadow-xs sm:flex-row sm:items-center sm:gap-8"
      >
        <PdcaWheel cells={cells} terminalLabel={terminalLabel} />
        <div className="flex flex-1 flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <CapaStatusChip status={plan.status} />
            <span className="text-muted-foreground">
              {CAPA_STATUS_LABELS[plan.status]}
            </span>
          </div>
          <p className="text-muted-foreground text-pretty">
            O ciclo PDCA do plano avança conforme as ações são definidas e executadas,
            as medidas são verificadas e a eficácia é confirmada no encerramento.
          </p>
        </div>
      </div>

      <div data-rise>
        <CapaActionsSection
          plan={plan}
          actions={data.actions}
          tasksByAction={data.tasksByAction}
          evidenceByAction={data.evidenceByAction}
          rootCauseTextById={rootCauseTextById}
          users={data.users}
          rootCauses={data.rootCauses}
          sessionUserId={data.sessionUserId}
        />
      </div>

      <div data-rise>
        <CapaMeasuresSection
          plan={plan}
          measures={data.measures}
          resultsByMeasure={resultsByMeasure}
        />
      </div>

      <div data-rise>
        <CapaEffectivenessPanel
          capaId={plan.id}
          effectiveness={data.effectiveness}
          canManage={canManage}
          isClosed={isClosed}
        />
      </div>

      <div data-rise>
        <CapaClosurePanel plan={plan} gate={gate} canManage={canManage} />
      </div>
    </SafetyMotion>
  );
}

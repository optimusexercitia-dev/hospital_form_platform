import type {
  AllegationCategory,
  CaseRecusalRosterEntry,
  EthicsCaseProcedure,
  SanctionType,
} from "@/lib/queries/ethics";

import { EthicsRecusalRoster } from "./ethics-recusal-roster";
import { EthicsAdmissibilityPanel } from "./ethics-admissibility-panel";
import { EthicsAllegationsPanel } from "./ethics-allegations-panel";
import { EthicsDecisionsPanel } from "./ethics-decisions-panel";
import { EthicsHearingsPanel } from "./ethics-hearings-panel";
import { EthicsNotificationsPanel } from "./ethics-notifications-panel";
import { EthicsAppealsPanel } from "./ethics-appeals-panel";

/**
 * The ethics disciplinary procedure surface (ETH·E2 Part 2; ADR 0073) — composes
 * the lifecycle panels over the frozen {@link EthicsCaseProcedure} envelope:
 * impediment roster → admissibility → allegations/findings → decisions/votes →
 * hearings → notifications → appeals. Pure composition (Server-safe); each panel is
 * its own client island wiring the DEFINER-RPC-backed coordinator actions.
 */
export function EthicsProcedure({
  caseId,
  procedure,
  categories,
  sanctionTypes,
  recusals,
}: {
  caseId: string;
  procedure: EthicsCaseProcedure;
  categories: AllegationCategory[];
  sanctionTypes: SanctionType[];
  recusals: CaseRecusalRosterEntry[];
}) {
  const admissibilityStatus = procedure.details?.admissibilityStatus ?? "pending";

  return (
    <div className="flex flex-col gap-6">
      <EthicsRecusalRoster recusals={recusals} />
      <EthicsAdmissibilityPanel caseId={caseId} details={procedure.details} />
      <EthicsAllegationsPanel
        caseId={caseId}
        allegations={procedure.allegations}
        categories={categories}
      />
      <EthicsDecisionsPanel
        caseId={caseId}
        decisions={procedure.decisions}
        sanctionTypes={sanctionTypes}
        admissibilityStatus={admissibilityStatus}
      />
      <EthicsHearingsPanel caseId={caseId} hearings={procedure.hearings} />
      <EthicsNotificationsPanel
        caseId={caseId}
        notifications={procedure.notifications}
      />
      <EthicsAppealsPanel appeals={procedure.appeals} />
    </div>
  );
}

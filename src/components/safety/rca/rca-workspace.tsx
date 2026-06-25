"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type {
  AssignableUser,
  Rca,
  RcaCitationTarget,
  RcaEvidence,
  RcaFactor,
  RcaMember,
  RcaRootCause,
  RcaTimelineEntry,
  RcaWhyChain,
} from "@/lib/safety/rca-types";
import type { CapaPlan } from "@/lib/safety/capa-types";
import {
  completeRca,
  reopenRca,
  submitRcaForReview,
} from "@/lib/safety/rca-actions";
import { FormBanner } from "@/components/auth/form-banner";
import type { SaveState } from "../triage/triage-topbar";
import { RcaHeader } from "./rca-header";
import { RcaStepper } from "./rca-stepper";
import { RcaFooterNav } from "./rca-footer-nav";
import { ProblemStage } from "./problem-stage";
import { AnalysisStage } from "./analysis-stage";
import { RootsStage } from "./roots-stage";
import { CapaStage } from "../capa/capa-stage";
import { RcaTeamPanel } from "./rca-team-panel";
import { RcaTimelinePanel } from "./rca-timeline-panel";
import { RcaEvidencePanel } from "./rca-evidence-panel";
import {
  RCA_STAGE_ORDER,
  countDone,
  deriveDone,
  deriveKeyFactors,
  groupFactorsByCategory,
  rcaCanEdit,
  type RcaStageId,
} from "./rca-derive";

const SAVED_PILL_MS = 1600;

/** The full payload the server loads for the RCA workspace. */
export interface RcaWorkspaceData {
  rca: Rca;
  eventTitle: string;
  commissionName: string | null;
  members: RcaMember[];
  timeline: RcaTimelineEntry[];
  evidence: RcaEvidence[];
  factors: RcaFactor[];
  whyChains: RcaWhyChain[];
  rootCauses: RcaRootCause[];
  /** The admin/PQS-wide assignable-user roster (`listAssignableUsers`). */
  users: AssignableUser[];
  /** In-scope citable artifacts for the citation picker (`listRcaCitationTargets`). */
  citationTargets: RcaCitationTarget[];
  /** CAPA plans opened from this RCA (Phase 14d — stage 4). */
  capaPlans: CapaPlan[];
  /** root cause id → count of CAPA actions addressing it (the 14d linkage surfacing). */
  capaActionCountByRootCause: Record<string, number>;
}

/**
 * The RCA WORKSPACE root (Phase 14c, README_rca). Holds the active stage (URL
 * `?stage=`), the save-state pill, and the lifecycle actions; renders the header +
 * stepper + the active stage body + the team/timeline/evidence right rail. All edits
 * are server-authoritative (each stage component autosaves via its action then
 * refreshes); this root only orchestrates navigation + lifecycle + the pill.
 *
 * Stage 4 is a Phase-14d placeholder. Write controls are gated by `rcaCanEdit`
 * (viewerCanWrite AND not completed); an observer / frozen RCA is fully read-only.
 */
export function RcaWorkspace(props: { org: string; data: RcaWorkspaceData }) {
  const { org, data } = props;
  const { rca } = data;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const canEdit = rcaCanEdit(rca);

  const stageParam = searchParams.get("stage");
  const active: RcaStageId = RCA_STAGE_ORDER.includes(stageParam as RcaStageId)
    ? (stageParam as RcaStageId)
    : "problem";

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, startBusy] = useTransition();

  const done = useMemo(
    () => deriveDone(rca, data.whyChains, data.rootCauses),
    [rca, data.whyChains, data.rootCauses],
  );
  const stagesDone = countDone(done);
  const factorsByCategory = useMemo(
    () => groupFactorsByCategory(data.factors),
    [data.factors],
  );
  const keyFactors = useMemo(
    () => deriveKeyFactors(data.factors, data.whyChains),
    [data.factors, data.whyChains],
  );

  const onSaving = useCallback(() => setSaveState("saving"), []);
  const onSaved = useCallback(() => {
    setSaveState("saved");
    window.setTimeout(() => setSaveState("idle"), SAVED_PILL_MS);
  }, []);
  const onSaveError = useCallback((message: string) => {
    setSaveState("idle");
    setError(message);
  }, []);

  const navigate = useCallback(
    (stage: RcaStageId) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("stage", stage);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  function runLifecycle(thunk: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startBusy(async () => {
      const result = await thunk();
      if (!result.ok) {
        setError(result.error ?? "Não foi possível concluir a ação.");
        return;
      }
      router.refresh();
    });
  }

  const effect = data.eventTitle;

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
      <RcaHeader
        org={org}
        rca={rca}
        eventTitle={data.eventTitle}
        commissionName={data.commissionName}
        stagesDone={stagesDone}
        saveState={saveState}
        canEdit={canEdit}
        isBusy={isBusy}
        onSubmit={() => runLifecycle(() => submitRcaForReview(rca.id))}
        onComplete={() => runLifecycle(() => completeRca(rca.id))}
        onReopen={() => runLifecycle(() => reopenRca(rca.id))}
      />

      {error && <FormBanner tone="error">{error}</FormBanner>}

      <RcaStepper active={active} done={done} onSelect={navigate} />

      <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {active === "problem" && (
            <ProblemStage
              rca={rca}
              canEdit={canEdit}
              onSaving={onSaving}
              onSaved={onSaved}
              onError={onSaveError}
            />
          )}
          {active === "analysis" && (
            <AnalysisStage
              rcaId={rca.id}
              effect={effect}
              factorsByCategory={factorsByCategory}
              factorCount={data.factors.length}
              keyFactors={keyFactors}
              canEdit={canEdit}
            />
          )}
          {active === "roots" && (
            <RootsStage
              rcaId={rca.id}
              rootCauses={data.rootCauses}
              canEdit={canEdit}
              capaActionCountByRootCause={data.capaActionCountByRootCause}
            />
          )}
          {active === "actions" && (
            <CapaStage
              org={org}
              rcaId={rca.id}
              plans={data.capaPlans}
              rootCauses={data.rootCauses}
              canManage={rca.viewerCanWrite}
            />
          )}

          <RcaFooterNav active={active} onNavigate={navigate} />
        </div>

        {/* Right rail: team · timeline · evidence (stacks under xl). */}
        <aside className="flex flex-col gap-6">
          <RcaTeamPanel
            rcaId={rca.id}
            members={data.members}
            users={data.users}
            canEdit={canEdit}
          />
          <RcaTimelinePanel
            rcaId={rca.id}
            entries={data.timeline}
            canEdit={canEdit}
          />
          <RcaEvidencePanel
            rcaId={rca.id}
            evidence={data.evidence}
            citationTargets={data.citationTargets}
            canEdit={canEdit}
          />
        </aside>
      </div>
    </div>
  );
}

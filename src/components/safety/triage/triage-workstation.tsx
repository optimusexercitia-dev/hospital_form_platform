"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { PqsInboxItem, EventPatient, SafetyEvent } from "@/lib/safety/types";
import type {
  HarmSeverity,
  PseClosureReason,
  ReviewPathway,
  SentinelCriterion,
  Triage,
  TriageDisposition,
  TriageReach,
} from "@/lib/safety/triage-types";
import { saveTriage, confirmTriage, reopenTriage } from "@/lib/safety/triage-actions";
import { nspHref } from "@/lib/routing";
import { FormBanner } from "@/components/auth/form-banner";
import { formatDateTime } from "../format";
import { TriageTopbar, type SaveState } from "./triage-topbar";
import { TriageQueue } from "./triage-queue";
import { EventHeader } from "./event-header";
import { PseGate } from "./pse-gate";
import { ReachSpectrum } from "./reach-spectrum";
import { HarmScale } from "./harm-scale";
import { SentinelScreen } from "./sentinel-screen";
import { DispositionRail } from "./disposition-rail";
import {
  applyReachChange,
  isSentinel,
  pathwayForcedToRca,
  type TriageDraft,
} from "./triage-derive";

/** The full payload the server loads for the SELECTED event. */
export interface SelectedEventData {
  event: SafetyEvent;
  commissionName: string | null;
  patient: EventPatient | null;
  triage: Triage | null;
  disposition: TriageDisposition | null;
  criteria: SentinelCriterion[];
  /** The RCA shell's id when the confirmed disposition mandated one; else null. */
  rcaId: string | null;
}

const SAVE_DEBOUNCE_MS = 700;
const SAVED_PILL_MS = 1500;

/** Build the editable draft from a server worksheet (or the blank default). */
function draftFromTriage(triage: Triage | null): TriageDraft {
  if (!triage) {
    return {
      isPse: null,
      pseClosureReason: null,
      reach: null,
      harmSeverity: null,
      naturalCourse: null,
      reviewPathway: null,
      dispositionNotesMd: null,
      sentinelCriteriaIds: [],
    };
  }
  return {
    isPse: triage.isPse,
    pseClosureReason: triage.pseClosureReason,
    reach: triage.reach,
    harmSeverity: triage.harmSeverity,
    naturalCourse: triage.naturalCourse,
    reviewPathway: triage.reviewPathway,
    dispositionNotesMd: triage.dispositionNotesMd,
    sentinelCriteriaIds: triage.sentinelFlags.map((f) => f.criterionId),
  };
}

/**
 * The three-pane triage WORKSTATION (Phase 14b root, README_triage). Holds the
 * client draft for the selected event, autosaves it (debounced) via `saveTriage`,
 * and re-reads the SERVER-normalized worksheet + disposition on each save
 * (`router.refresh`) so the rail always reflects the authority. Selection is
 * URL-driven (`?event=<id>`); the queue is PHI-free.
 *
 * Fed entirely by plain props from the Server page — it value-imports only the
 * `"use server"` action module (allowed) and the client-safe types.
 */
export function TriageWorkstation({
  org,
  items,
  commissionNames,
  selectedId,
  selected,
  awaitingCount,
  sentinelCount,
  rcaCount,
}: {
  /** The org slug whose NSP console this is — builds the per-org RCA href. */
  org: string;
  items: PqsInboxItem[];
  commissionNames: Record<string, string>;
  selectedId: string | null;
  selected: SelectedEventData | null;
  awaitingCount: number;
  sentinelCount: number;
  rcaCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const frozen = selected?.event.status === "triaged";

  const [draft, setDraft] = useState<TriageDraft>(() =>
    draftFromTriage(selected?.triage ?? null),
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, startConfirm] = useTransition();

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-seed the draft from the AUTHORITATIVE server state when the selected event
  // changes OR the server returns a freshly-normalized worksheet for the same event
  // (`router.refresh()` after a save). The React-recommended "adjust state during
  // render" pattern (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  // — synchronous, no cascading effect — keyed on a signature of the server state.
  const syncSig = `${selectedId ?? ""}|${selected?.triage?.updatedAt ?? ""}`;
  const [lastSyncSig, setLastSyncSig] = useState(syncSig);
  if (syncSig !== lastSyncSig) {
    setLastSyncSig(syncSig);
    setDraft(draftFromTriage(selected?.triage ?? null));
    setError(null);
    // Keep a "saved" pill visible briefly across the post-save refresh; otherwise idle.
    setSaveState((prev) => (prev === "saved" ? "saved" : "idle"));
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const persist = useCallback(
    (next: TriageDraft, eventId: string) => {
      setSaveState("saving");
      setError(null);
      void saveTriage(eventId, {
        isPse: next.isPse,
        pseClosureReason: next.pseClosureReason,
        reach: next.reach,
        harmSeverity: next.harmSeverity,
        naturalCourse: next.naturalCourse,
        reviewPathway: next.reviewPathway,
        dispositionNotesMd: next.dispositionNotesMd,
        sentinelCriteriaIds: next.sentinelCriteriaIds,
      }).then((result) => {
        if (!result.ok) {
          setSaveState("idle");
          setError(result.error ?? "Não foi possível salvar a triagem.");
          return;
        }
        setSaveState("saved");
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaveState("idle"), SAVED_PILL_MS);
        // Re-read the SERVER-normalized worksheet + disposition (authority).
        router.refresh();
      });
    },
    [router],
  );

  // Apply a draft change locally (instant preview) + schedule a debounced save.
  const update = useCallback(
    (mutate: (prev: TriageDraft) => TriageDraft) => {
      if (!selectedId || frozen) return;
      setDraft((prev) => {
        const next = mutate(prev);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(
          () => persist(next, selectedId),
          SAVE_DEBOUNCE_MS,
        );
        return next;
      });
    },
    [selectedId, frozen, persist],
  );

  // --- Field handlers (preview the server's cross-field rules locally) ---
  const setPse = (value: boolean) =>
    update((p) => ({
      ...p,
      isPse: value,
      // Choosing "not a PSE" clears the spectrum branch; choosing "PSE" clears reason.
      ...(value
        ? { pseClosureReason: null }
        : {
            pseClosureReason: p.pseClosureReason,
            reach: null,
            harmSeverity: null,
            naturalCourse: null,
            sentinelCriteriaIds: [],
          }),
    }));

  const setReason = (reason: PseClosureReason) =>
    update((p) => ({ ...p, pseClosureReason: reason }));

  const setReach = (reach: TriageReach) =>
    update((p) => {
      const next = applyReachChange(p, reach);
      // Keep the pathway consistent with the sentinel state preview.
      if (pathwayForcedToRca(next)) next.reviewPathway = "rca";
      return next;
    });

  const setHarm = (harm: HarmSeverity) =>
    update((p) => {
      const next = { ...p, harmSeverity: harm };
      if (pathwayForcedToRca(next)) next.reviewPathway = "rca";
      return next;
    });

  const setNaturalCourse = (value: boolean) =>
    update((p) => {
      const next = { ...p, naturalCourse: value };
      if (pathwayForcedToRca(next)) next.reviewPathway = "rca";
      return next;
    });

  const toggleCriterion = (id: string, checked: boolean) =>
    update((p) => {
      const ids = checked
        ? [...p.sentinelCriteriaIds, id]
        : p.sentinelCriteriaIds.filter((x) => x !== id);
      const next = { ...p, sentinelCriteriaIds: ids };
      if (pathwayForcedToRca(next)) next.reviewPathway = "rca";
      return next;
    });

  const setPathway = (value: ReviewPathway) =>
    update((p) => ({ ...p, reviewPathway: value }));

  // --- Selection (URL-driven) ---
  const onSelect = useCallback(
    (id: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("event", id);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // --- Confirm / reopen ---
  const onConfirm = () => {
    if (!selectedId) return;
    setError(null);
    startConfirm(async () => {
      const result = await confirmTriage(selectedId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível confirmar a disposição.");
        return;
      }
      router.refresh();
    });
  };

  const onReopen = () => {
    if (!selectedId) return;
    setError(null);
    startConfirm(async () => {
      const result = await reopenTriage(selectedId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível reabrir a triagem.");
        return;
      }
      router.refresh();
    });
  };

  const onOpenRca = () => {
    // The RCA shell is minted by `confirm_triage` when the disposition is RCA; route
    // to the 14c workspace by its id. The button is disabled until that shell exists.
    if (!selected?.rcaId) return;
    router.push(nspHref(org, "rca", selected.rcaId));
  };

  // --- Gating ---
  const localSentinel = useMemo(() => isSentinel(draft), [draft]);
  const step2Disabled = draft.isPse !== true;
  const step3Disabled = draft.isPse !== true || draft.reach == null;
  const step4Disabled = draft.isPse !== true || draft.reach == null;

  return (
    <div className="flex flex-col gap-5">
      <TriageTopbar
        awaitingCount={awaitingCount}
        sentinelCount={sentinelCount}
        rcaCount={rcaCount}
        saveState={saveState}
      />

      {error && <FormBanner tone="error">{error}</FormBanner>}

      <div className="flex gap-5 overflow-x-auto">
        {/* Queue */}
        <div className="w-[312px] shrink-0">
          <TriageQueue
            items={items}
            commissionNames={commissionNames}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </div>

        {/* Flow */}
        <div className="flex min-w-[468px] flex-1 flex-col gap-5">
          {selected ? (
            <>
              <EventHeader
                event={selected.event}
                commissionName={selected.commissionName}
                patient={selected.patient}
              />
              <PseGate
                isPse={draft.isPse}
                pseClosureReason={draft.pseClosureReason}
                disabled={frozen}
                onChange={setPse}
                onChangeReason={setReason}
              />
              <ReachSpectrum
                reach={draft.reach}
                disabled={frozen || step2Disabled}
                onChange={setReach}
              />
              <HarmScale
                reach={draft.reach}
                harmSeverity={draft.harmSeverity}
                disabled={frozen || step3Disabled}
                onChange={setHarm}
              />
              <SentinelScreen
                reach={draft.reach}
                harmSeverity={draft.harmSeverity}
                naturalCourse={draft.naturalCourse}
                criteria={selected.criteria}
                selectedCriteriaIds={draft.sentinelCriteriaIds}
                localIsSentinel={localSentinel}
                disabled={frozen || step4Disabled}
                onChangeNaturalCourse={setNaturalCourse}
                onToggleCriterion={toggleCriterion}
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
              <h2 className="text-lg font-semibold">Selecione um evento</h2>
              <p className="max-w-sm text-sm text-muted-foreground text-pretty">
                Escolha um evento na fila à esquerda para iniciar a triagem.
              </p>
            </div>
          )}
        </div>

        {/* Disposition */}
        <div className="w-[320px] shrink-0">
          {selected ? (
            <DispositionRail
              draft={draft}
              disposition={selected.disposition}
              commissionName={selected.commissionName}
              reportedAtLabel={formatDateTime(selected.event.reportedAt)}
              reporterName={selected.event.reportedByName}
              frozen={!!frozen}
              isSaving={saveState === "saving"}
              isConfirming={isConfirming}
              onChangePathway={setPathway}
              onConfirm={onConfirm}
              onReopen={onReopen}
              onOpenRca={onOpenRca}
              hasRca={selected.rcaId != null}
            />
          ) : (
            <aside className="flex h-full flex-col gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-5">
              <h2 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Disposição da triagem
              </h2>
              <p className="text-sm text-muted-foreground">
                A disposição aparece ao selecionar um evento.
              </p>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

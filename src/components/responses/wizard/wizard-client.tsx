"use client";

import { commissionHref } from "@/lib/routing";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import type { Json } from "@/lib/types/database";
import type { Section } from "@/lib/queries/forms";

import type { SectionSignoff } from "@/components/signoffs/types";

import type { AnswerState, WizardData } from "./types";
import {
  useWizard,
  hasAnswer,
  isChoiceItem,
  type OrphanedSection,
} from "./use-wizard";
import { validateSection, validateInstances } from "./validation";
import type { InstanceAnswers } from "./collect";
import { collectInstances, collectScope, topLevelItems } from "./collect";
import { WizardProgress } from "./wizard-progress";
import { SectionStep } from "./section-step";
import { WizardNav } from "./wizard-nav";
import { ReviewScreen } from "./review-screen";
import { PhaseResultPanel } from "./phase-result-panel";
import { SubmitPanel } from "./submit-panel";
import { OrphanWarningDialog } from "./orphan-warning-dialog";
import { ConfirmationScreen } from "./confirmation-screen";

/**
 * The wizard orchestrator (F2–F5). Owns navigation + answer state via
 * `useWizard`, runs per-section client validation (UX only — `submit_response`
 * on the server is the authority), persists on every navigation (F4), drives the
 * controlling-answer warn-and-clear (F4), and submits + confirms (F5). It
 * branches flat vs sectioned:
 *  - FLAT (default-section-only): all blocks on one page → review → submit.
 *  - SECTIONED: one-visible-section-per-page with a live progress indicator,
 *    Voltar/Próximo, a final review step, then submit.
 *
 * Data-bound side-effects are injected via `actions` (the route page adapts
 * B3's server actions to this shape) so the client tree never value-imports a
 * `'use server'` module.
 */

/**
 * Persistence surface the wizard calls — bound to B3's server actions
 * (`src/lib/responses/actions.ts`). Answers are keyed by item_id, matching B3
 * exactly (`answers` rows are per-item; no question_key reverse-lookup).
 */
export interface WizardActions {
  /** Persist a section's answers (+ advance `last_section_id`); F4.
   *  `answersByItemId` carries SCALAR answers only (number/date/time/text);
   *  `selectionsByItemId` carries CHOICE selections as arrays of option CODEs
   *  (single-select → a one-element array; checkbox → zero-or-more) — the
   *  form-model-normalization split. `observationsByItemId` carries the optional
   *  per-item observation notes; `otherTextByItemId` carries the optional per-item
   *  "Outros" free text (written server-side only when the item's reserved
   *  `__other__` option is selected — form-builder-enhancements). */
  saveSection: (input: {
    sectionId: string;
    answersByItemId: Record<string, Json>;
    selectionsByItemId?: Record<string, string[]>;
    clearItemIds?: string[];
    observationsByItemId?: Record<string, string>;
    otherTextByItemId?: Record<string, string>;
    /**
     * FF-1 (ADR 0087) — the INSTANCE arm. One payload, one round trip, one
     * transaction for a section with N instances; each entry addresses an
     * EXISTING instance by id (instances are created/destroyed only by the three
     * lifecycle actions, never implicitly by a save).
     */
    instances?: InstanceAnswers[];
  }) => Promise<{ ok: boolean; error?: string }>;
  /** Persist the current section + signal exit; F4. */
  saveAndExit: (input: {
    sectionId: string | null;
    answersByItemId: Record<string, Json>;
    selectionsByItemId?: Record<string, string[]>;
    observationsByItemId?: Record<string, string>;
    otherTextByItemId?: Record<string, string>;
    instances?: InstanceAnswers[];
  }) => Promise<{ ok: boolean; error?: string }>;
  /**
   * Submit through the server authority (`submit_response`); F5. For case-phase
   * fills (phase-results feature) an optional per-phase result OVERRIDE is passed:
   * `overrideResultId` (a chosen option id, or `null` to CLEAR a stashed override,
   * or `undefined` to leave it untouched) + an optional `reason`. The runner routes
   * to `submitCasePhaseResponse` when the phase carries result context, else plain
   * `submitResponse` (which ignores these args).
   */
  submit: (override?: {
    overrideResultId: string | null | undefined;
    reason: string | null;
  }) => Promise<{ ok: boolean; error?: string }>;
  /**
   * Record a respondent sign-off for a `requires_signoff(respondent)` section
   * (F3) via B3's `signSection`. The server (RLS + the RPC's visibility check)
   * is the authority; a rejection is surfaced in pt-BR.
   */
  signSection: (input: {
    sectionId: string;
    note: string | null;
  }) => Promise<{ ok: boolean; error?: string }>;
  /**
   * FF-1 (ADR 0087 ruling 5) — the three repeating-group instance writers. They
   * are INVOKER RPCs and CORRECTNESS doors, not security doors: RLS stays the
   * boundary. They exist because the position uniqueness is a constraint the
   * client cannot satisfy piecewise — `add` needs `max(position)+1` together
   * with the `maxInstances` check atomically, and `remove`/`reorder` rewrite
   * several positions in one statement-safe pass.
   *
   * `addInstance` returns the new instance so the wizard can render and focus it
   * without a refetch.
   */
  addInstance: (groupItemId: string) => Promise<{
    ok: boolean;
    error?: string;
    instanceId?: string;
    position?: number;
  }>;
  removeInstance: (
    instanceId: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  reorderInstances: (
    groupItemId: string,
    instanceIds: string[],
  ) => Promise<{ ok: boolean; error?: string }>;
}

/** A pending controlling-answer change awaiting the user's warn-and-clear. */
interface PendingOrphanChange {
  item: { id: string; questionKey: string };
  value: Json;
  orphans: OrphanedSection[];
}

export function WizardClient({
  data,
  imageUrls,
  actions,
}: {
  data: WizardData;
  imageUrls: Record<string, string>;
  actions: WizardActions;
}) {
  const router = useRouter();
  const wizard = useWizard(data);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // FF-1 — per-instance validation errors, keyed `${instanceId}:${itemId}` (plus
  // the container's own id for a cardinality shortfall), so the SAME child can
  // be invalid in one repetition and fine in another.
  const [instanceErrors, setInstanceErrors] = useState<Record<string, string>>(
    {},
  );
  // Instance add/remove/reorder have no visual anchor for a keyboard or screen
  // reader user, so every outcome is announced politely here (FE-5).
  const [liveMessage, setLiveMessage] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pendingOrphan, setPendingOrphan] =
    useState<PendingOrphanChange | null>(null);
  // Sign-off rows by section_id (F3), seeded from the server and updated
  // optimistically when the respondent signs a section on the review screen. The
  // submit gate reads this; the server (`submit_response` P0012) is the authority.
  const [signoffs, setSignoffs] = useState<Record<string, SectionSignoff>>(
    data.signoffsBySectionId,
  );

  // Per-phase result override state (phase-results feature; task #8). Only used on
  // the case-phase responder (gated on `data.phaseResult`); seeded from the
  // currently-stashed override so a resumed fill keeps the operator's prior choice.
  const phaseResult = data.phaseResult;
  const [overrideEnabled, setOverrideEnabled] = useState<boolean>(
    phaseResult?.currentOverrideId != null,
  );
  const [overrideResultId, setOverrideResultId] = useState<string>(
    phaseResult?.currentOverrideId ?? "",
  );
  const [overrideReason, setOverrideReason] = useState<string>("");

  const {
    isFlat,
    visibleSections,
    visibleItemIds,
    currentSection,
    currentStepIndex,
    stepCount,
    isReview,
    answers,
    answerMap,
    visibleContainerIds,
    instancesByGroup,
    visibleItemIdsByInstance,
    getLatestSnapshot,
    setAnswer,
    setObservation,
    setOtherText,
    setInstanceAnswer,
    setInstanceObservation,
    setInstanceOtherText,
    addInstanceLocal,
    removeInstanceLocal,
    reorderInstancesLocal,
    next,
    back,
    goToSection,
    goToReview,
    previewAnswerChange,
    detectOrphans,
    commitAnswerChange,
  } = wizard;

  /**
   * Collect a section's save payload — BOTH tiers, through the one shared
   * collector (`collectScope`), so the top-level arm and every instance arm can
   * never drift in which optional fields they carry. That drift is exactly what
   * dropped `observationsByItemId` (BUG-FBE-004) and then `otherTextByItemId`
   * (BUG-FBE-008), and N instances would have multiplied it.
   *
   * BUG-FBE-008: reads the LATEST committed state via `getLatestSnapshot()` (a
   * ref) rather than the closed-over render snapshot, so a save handler memoized
   * BEFORE the final keystroke still serializes the final state — now for the
   * instances too, which share the same ref discipline.
   */
  const collectSection = useCallback(
    (
      section: Section,
    ): {
      answersByItemId: Record<string, Json>;
      selectionsByItemId: Record<string, string[]>;
      observationsByItemId: Record<string, string>;
      otherTextByItemId: Record<string, string>;
      instances: InstanceAnswers[];
    } => {
      const {
        answers: latest,
        visibleItemIds: visible,
        instances: latestInstances,
        visibleItemIdsByInstance: latestInstanceVisibility,
      } = getLatestSnapshot();

      const collected = collectScope(topLevelItems(section), latest, visible);

      // Group the latest instances for this section's containers. Built from the
      // ref-sourced list, not the render snapshot, for the same reason as above.
      const byGroup: Record<string, typeof latestInstances> = {};
      for (const instance of latestInstances) {
        (byGroup[instance.groupItemId] ??= []).push(instance);
      }
      for (const list of Object.values(byGroup)) {
        list.sort((a, b) => a.position - b.position);
      }

      return {
        ...collected,
        instances: collectInstances(
          section,
          byGroup,
          latestInstanceVisibility,
          visibleContainerIds,
        ),
      };
    },
    [getLatestSnapshot, visibleContainerIds],
  );

  /** Persist the current section before navigating away from it (F4). */
  const persistSection = useCallback(
    async (section: Section): Promise<boolean> => {
      setSaving(true);
      setBanner(null);
      // One payload for both tiers — a section with N instances is still ONE
      // round trip and one transaction (ADR 0087 "save-path shape").
      const result = await actions.saveSection({
        sectionId: section.id,
        ...collectSection(section),
      });
      setSaving(false);
      if (!result.ok) {
        setBanner(result.error ?? "Não foi possível salvar suas respostas.");
        return false;
      }
      return true;
    },
    [actions, collectSection],
  );

  /**
   * Handle an input change. If the change would HIDE a section that already
   * holds answers, hold it and raise the warn-and-clear dialog (F4); otherwise
   * commit immediately. Clears the field's own error on a meaningful value.
   */
  const onChange = useCallback(
    (item: { id: string; questionKey: string }, value: Json) => {
      const prospective = previewAnswerChange(item, value);
      const allOrphans = detectOrphans(prospective);
      // Cross-section orphans are a data-loss moment ACROSS pages → warn first.
      const crossSection = allOrphans.filter(
        (o) => o.section.id !== currentSection?.id,
      );
      if (crossSection.length > 0) {
        setPendingOrphan({ item, value, orphans: crossSection });
        return;
      }
      // Same-section item-level orphans (an answer hidden by THIS change within
      // the current section): clear them silently alongside the change — the UI
      // stops rendering them and they leave the save payload; the submit RPC is
      // the backstop for any already-persisted stray row.
      const sameSectionClearIds = allOrphans
        .filter((o) => o.section.id === currentSection?.id)
        .flatMap((o) => o.itemIds);
      if (sameSectionClearIds.length > 0) {
        commitAnswerChange(item, value, sameSectionClearIds);
      } else {
        setAnswer(item, value);
      }
      setErrors((prev) => {
        if (!prev[item.id]) return prev;
        if (!hasAnswer({ itemId: item.id, questionKey: item.questionKey, value }))
          return prev;
        const nextErrors = { ...prev };
        delete nextErrors[item.id];
        return nextErrors;
      });
    },
    [
      previewAnswerChange,
      detectOrphans,
      currentSection?.id,
      setAnswer,
      commitAnswerChange,
    ],
  );

  /**
   * Clear a whole question block: the answer AND its observação AND its "Outro"
   * free text (both ride on the answer record). Routes the answer-clear through
   * `onChange` with an empty value so the controlling-answer warn-and-clear (F4)
   * still fires if clearing this answer would hide a section.
   */
  const handleClearBlock = useCallback(
    (item: { id: string; questionKey: string }) => {
      // A null value clears the answer for every item type: `collectSection`
      // normalizes a choice item's null → an empty selection array, and
      // `hasAnswer`/`isEmptyValue` treat null as empty for orphan detection.
      onChange(item, null);
      setObservation(item.id, "");
      setOtherText(item, "");
    },
    [onChange, setObservation, setOtherText],
  );

  /** Confirm the warn-and-clear: commit the change + clear orphans (local + DB). */
  const confirmOrphanClear = useCallback(async () => {
    const pending = pendingOrphan;
    if (!pending) return;
    const clearItemIds = pending.orphans.flatMap((o) => o.itemIds);

    // Update local state first so the UI reflects the cleared sections.
    commitAnswerChange(pending.item, pending.value, clearItemIds);
    setPendingOrphan(null);

    // Persist the controlling section's answers AND the orphan-clear atomically.
    if (currentSection) {
      setSaving(true);
      setBanner(null);
      // `collectSection` reads the render-time `answers` (the just-committed
      // change hasn't flushed yet), so merge the controlling item's NEW value in
      // explicitly — routing it to the choice-selection map or the scalar map by
      // the controlling item's type.
      const collected = collectSection(currentSection);
      const { answersByItemId, selectionsByItemId } = collected;
      // The controlling item may be a plain `group`'s child (ruling 6 — those
      // answer at top level), so look it up through the container too.
      const controllingItem = currentSection.items
        .flatMap((it) => (it.itemType === "group" ? [it, ...it.children] : [it]))
        .find((it) => it.id === pending.item.id);
      if (controllingItem && isChoiceItem(controllingItem.itemType)) {
        selectionsByItemId[pending.item.id] = Array.isArray(pending.value)
          ? (pending.value as string[])
          : typeof pending.value === "string" && pending.value !== ""
            ? [pending.value]
            : [];
      } else {
        answersByItemId[pending.item.id] = pending.value;
      }
      const result = await actions.saveSection({
        ...collected,
        sectionId: currentSection.id,
        answersByItemId,
        selectionsByItemId,
        clearItemIds,
      });
      setSaving(false);
      if (!result.ok) {
        setBanner(result.error ?? "Não foi possível salvar suas respostas.");
      }
    }
  }, [pendingOrphan, commitAnswerChange, currentSection, actions, collectSection]);

  // ----- FF-1: repeating-group instance lifecycle -----
  //
  // Each action goes to the server FIRST and the local state mirrors the result
  // — never the reverse. The RPCs own the authoritative positions (`add` is
  // `max(position)+1` under `maxInstances`; `remove` re-packs to 0..n-1), so an
  // optimistic local guess could disagree with the row that actually exists, and
  // the next save would then address an instance id the server does not have.

  /** Persist the current section, then add an empty repetition to a group. */
  const handleAddInstance = useCallback(
    async (groupItemId: string) => {
      setSaving(true);
      setBanner(null);
      const result = await actions.addInstance(groupItemId);
      setSaving(false);
      if (!result.ok || !result.instanceId) {
        setBanner(
          result.error ?? "Não foi possível adicionar a repetição. Tente novamente.",
        );
        return;
      }
      addInstanceLocal({
        id: result.instanceId,
        groupItemId,
        position: result.position ?? 0,
      });
      setLiveMessage("Repetição adicionada.");
    },
    [actions, addInstanceLocal],
  );

  const handleRemoveInstance = useCallback(
    async (instanceId: string) => {
      setSaving(true);
      setBanner(null);
      const result = await actions.removeInstance(instanceId);
      setSaving(false);
      if (!result.ok) {
        setBanner(
          result.error ?? "Não foi possível remover a repetição. Tente novamente.",
        );
        return;
      }
      removeInstanceLocal(instanceId);
      // Drop any field errors that belonged to the removed instance so a stale
      // message can't outlive the row it pointed at.
      setInstanceErrors((prev) => {
        const next: Record<string, string> = {};
        for (const [key, message] of Object.entries(prev)) {
          if (!key.startsWith(`${instanceId}:`)) next[key] = message;
        }
        return next;
      });
      setLiveMessage("Repetição removida.");
    },
    [actions, removeInstanceLocal],
  );

  /** Move one repetition up or down within its group (a full reorder, sent as
   *  the new complete order — the RPC rejects a non-permutation). */
  const handleMoveInstance = useCallback(
    async (instanceId: string, direction: "up" | "down") => {
      const instance = Object.values(instancesByGroup)
        .flat()
        .find((i) => i.id === instanceId);
      if (!instance) return;
      const siblings = instancesByGroup[instance.groupItemId] ?? [];
      const index = siblings.findIndex((i) => i.id === instanceId);
      const target = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || target < 0 || target >= siblings.length) return;

      const ids = siblings.map((i) => i.id);
      [ids[index], ids[target]] = [ids[target], ids[index]];

      setSaving(true);
      setBanner(null);
      const result = await actions.reorderInstances(instance.groupItemId, ids);
      setSaving(false);
      if (!result.ok) {
        setBanner(
          result.error ?? "Não foi possível reordenar as repetições. Tente novamente.",
        );
        return;
      }
      reorderInstancesLocal(instance.groupItemId, ids);
      // Keyboard users lose the visual cue entirely, so announce the outcome.
      setLiveMessage(
        `Repetição movida para a posição ${target + 1} de ${siblings.length}.`,
      );
    },
    [actions, instancesByGroup, reorderInstancesLocal],
  );

  /** Clear a whole question block INSIDE an instance (answer + observação +
   *  "Outro"), mirroring `handleClearBlock` at top level. */
  const handleClearInstanceBlock = useCallback(
    (instanceId: string, item: { id: string; questionKey: string }) => {
      setInstanceAnswer(instanceId, item, null);
      setInstanceObservation(instanceId, item.id, "");
      setInstanceOtherText(instanceId, item, "");
    },
    [setInstanceAnswer, setInstanceObservation, setInstanceOtherText],
  );

  /** A per-instance answer change. A repeating-group child's key never enters
   *  the top-level map, so the cross-section orphan warning (which is driven by
   *  top-level keys) cannot apply here — the change commits directly. */
  const handleInstanceChange = useCallback(
    (
      instanceId: string,
      item: { id: string; questionKey: string },
      value: Json,
    ) => {
      setInstanceAnswer(instanceId, item, value);
      const key = `${instanceId}:${item.id}`;
      setInstanceErrors((prev) => {
        if (!prev[key]) return prev;
        const nextErrors = { ...prev };
        delete nextErrors[key];
        return nextErrors;
      });
    },
    [setInstanceAnswer],
  );

  /** Advance: validate the current section, persist, then move forward. */
  const handleNext = useCallback(async () => {
    const section = currentSection;
    if (!section) return;

    const sectionErrors = validateSection(section, answers, visibleItemIds);
    // FF-1: instances validate separately — prune-then-check, so a fully-empty
    // repetition reports nothing and an unmet minimum reads "adicione ao menos N"
    // rather than "campo obrigatório" inside a blank row (ruling 3).
    const perInstanceErrors = validateInstances(
      section,
      instancesByGroup,
      visibleItemIdsByInstance,
      visibleContainerIds,
    );
    if (
      Object.keys(sectionErrors).length > 0 ||
      Object.keys(perInstanceErrors).length > 0
    ) {
      setErrors(sectionErrors);
      setInstanceErrors(perInstanceErrors);
      setBanner("Revise os campos destacados antes de continuar.");
      return;
    }
    setErrors({});
    setInstanceErrors({});

    const ok = await persistSection(section);
    if (!ok) return;

    if (currentStepIndex >= stepCount - 1) goToReview();
    else next();
  }, [
    currentSection,
    answers,
    visibleItemIds,
    instancesByGroup,
    visibleItemIdsByInstance,
    visibleContainerIds,
    persistSection,
    currentStepIndex,
    stepCount,
    goToReview,
    next,
  ]);

  const handleBack = useCallback(async () => {
    const section = currentSection;
    // Persist on back too (resume fidelity); never block leaving backward on
    // validation — partial answers are allowed mid-fill.
    if (section) await persistSection(section);
    setErrors({});
    setBanner(null);
    back();
  }, [currentSection, persistSection, back]);

  const handleSaveAndExit = useCallback(async () => {
    const section = currentSection;
    const collected = section
      ? collectSection(section)
      : {
          answersByItemId: {},
          selectionsByItemId: {},
          observationsByItemId: {},
          otherTextByItemId: {},
          instances: [],
        };
    setSaving(true);
    const result = await actions.saveAndExit({
      ...collected,
      sectionId: section?.id ?? null,
    });
    setSaving(false);
    if (!result.ok) {
      setBanner(result.error ?? "Não foi possível salvar suas respostas.");
      return;
    }
    router.push(commissionHref(data.org, data.slug, "forms"));
  }, [actions, currentSection, collectSection, router, data.org, data.slug]);

  /** Submit (F5): the server is the authority; surface its pt-BR rejection. */
  const handleSubmit = useCallback(async () => {
    setSaving(true);
    setBanner(null);
    // For a case-phase fill, thread the per-phase result override (phase-results
    // feature). `overrideResultId`: a chosen option id when the operator overrode;
    // `null` to CLEAR a previously-stashed override (toggle off or pick "none");
    // `undefined` for standalone fills (the runner ignores it). The reason is only
    // meaningful alongside a non-null override.
    // MANUAL phases: the picked result is THE result — always send it (the submit
    // gate below guarantees it is non-empty). AUTOMATIC phases: send the optional
    // override only when the operator enabled it (else null clears any stash).
    const override = phaseResult
      ? phaseResult.mode === "manual"
        ? { overrideResultId: overrideResultId || null, reason: null }
        : {
            overrideResultId: overrideEnabled ? overrideResultId || null : null,
            reason: overrideEnabled ? overrideReason.trim() || null : null,
          }
      : undefined;
    const result = await actions.submit(override);
    setSaving(false);
    if (!result.ok) {
      setBanner(
        result.error ?? "Não foi possível enviar a resposta. Tente novamente.",
      );
      return;
    }
    setSubmitted(true);
  }, [actions, phaseResult, overrideEnabled, overrideResultId, overrideReason]);

  /**
   * Record a respondent sign-off for a visible `requires_signoff(respondent)`
   * section (F3). Optimistically stamps the local sign-off state on success so
   * the review badge flips to "Assinado por você em DATA" and the submit gate
   * clears — the server (RLS + the RPC) remains the authority. A rejection is
   * surfaced as a pt-BR banner.
   */
  const handleSignSection = useCallback(
    async (sectionId: string, note: string | null) => {
      setSaving(true);
      setBanner(null);
      const result = await actions.signSection({ sectionId, note });
      setSaving(false);
      if (!result.ok) {
        setBanner(
          result.error ??
            "Não foi possível registrar a assinatura. Tente novamente.",
        );
        return;
      }
      setSignoffs((prev) => ({
        ...prev,
        [sectionId]: {
          sectionId,
          signedByName: data.respondentName,
          signedAt: new Date().toISOString(),
          note: note ?? undefined,
        },
      }));
    },
    [actions, data.respondentName],
  );

  /**
   * Visible sign-off sections still missing a sign-off row. While non-empty the
   * submit affordance is disabled with a clear pt-BR reason; the server's P0012
   * check stays the authority.
   */
  const pendingSignoffSections = visibleSections.filter(
    (s) => s.requiresSignoff && !signoffs[s.id],
  );
  const signoffBlockReason =
    pendingSignoffSections.length > 0
      ? "Há seções pendentes de assinatura. Assine todas as seções marcadas antes de enviar."
      : null;

  // A MANUAL-result phase requires a selection before submit (the server's
  // conclude path enforces this too; this is the UX guard).
  const phaseResultBlockReason =
    phaseResult?.mode === "manual" && !overrideResultId
      ? "Selecione o resultado da fase antes de enviar."
      : null;
  const submitBlockReason = signoffBlockReason ?? phaseResultBlockReason;

  // ----- Confirmation (post-submit) -----
  if (submitted) {
    return (
      <ConfirmationScreen
        org={data.org}
        slug={data.slug}
        formTitle={data.formTitle}
        correction={
          data.correction ? { doneHref: data.correction.doneHref } : null
        }
      />
    );
  }

  // A single polite live region for instance outcomes (FE-5). Rendered in both
  // the flat and sectioned branches so an announcement is never lost on a
  // layout switch.
  const liveRegion = (
    <p role="status" aria-live="polite" className="sr-only">
      {liveMessage}
    </p>
  );

  const orphanDialog = (
    <OrphanWarningDialog
      open={pendingOrphan !== null}
      sections={pendingOrphan?.orphans ?? []}
      onConfirm={confirmOrphanClear}
      onCancel={() => setPendingOrphan(null)}
    />
  );

  const submitPanel = (
    <SubmitPanel
      saving={saving}
      banner={banner}
      onSubmit={handleSubmit}
      blockReason={submitBlockReason}
      // Correction drafts (ADR 0085) go for approval, not to conclude the phase.
      submitLabel={data.correction ? "Enviar para revisão" : undefined}
      hint={
        data.correction
          ? "Ao enviar, a correção vai para aprovação antes de substituir o conteúdo registrado."
          : undefined
      }
    />
  );

  // The end-of-wizard per-phase result panel (phase-results feature; task #8) —
  // case-phase fills only. Rendered on review as a sibling of the sign-off blocks.
  const phaseResultSlot = phaseResult ? (
    <PhaseResultPanel
      mode={phaseResult.mode}
      ruleset={phaseResult.ruleset}
      options={phaseResult.options}
      answerMap={answerMap}
      overrideEnabled={overrideEnabled}
      overrideResultId={overrideResultId}
      reason={overrideReason}
      saving={saving}
      onToggleOverride={(on) => {
        setOverrideEnabled(on);
        if (!on) {
          setOverrideResultId("");
          setOverrideReason("");
        }
      }}
      onChangeOverrideResult={setOverrideResultId}
      onChangeReason={setOverrideReason}
    />
  ) : null;

  // ----- FLAT (default-section-only) -----
  if (isFlat) {
    const section = visibleSections[0];
    if (!section) return null;

    if (isReview) {
      return (
        <>
          <ReviewScreen
            visibleSections={visibleSections}
            visibleItemIds={visibleItemIds}
            visibleContainerIds={visibleContainerIds}
            instancesByGroup={instancesByGroup}
            visibleItemIdsByInstance={visibleItemIdsByInstance}
            answers={answers}
            signoffs={signoffs}
            saving={saving}
            onSignSection={handleSignSection}
            onEditSection={(id) => goToSection(id)}
            phaseResultSlot={phaseResultSlot}
            submitSlot={submitPanel}
          />
          {orphanDialog}
        </>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        {banner && <Banner message={banner} />}
        <SectionStep
          section={section}
          index={0}
          imageUrls={imageUrls}
          answers={answers}
          errors={errors}
          onChange={onChange}
          visibleItemIds={visibleItemIds}
          visibleContainerIds={visibleContainerIds}
          instancesByGroup={instancesByGroup}
          visibleItemIdsByInstance={visibleItemIdsByInstance}
          instanceErrors={instanceErrors}
          saving={saving}
          onObservationChange={setObservation}
          onOtherTextChange={setOtherText}
          onClear={handleClearBlock}
          onAddInstance={handleAddInstance}
          onRemoveInstance={handleRemoveInstance}
          onMoveInstance={handleMoveInstance}
          onInstanceChange={handleInstanceChange}
          onInstanceObservationChange={setInstanceObservation}
          onInstanceOtherTextChange={setInstanceOtherText}
          onInstanceClear={handleClearInstanceBlock}
        />
        <WizardNav
          canGoBack={false}
          isLastSection
          saving={saving}
          onBack={() => {}}
          // Reuse the sectioned next handler: it validates, PERSISTS the
          // section (so the server has saved answers to submit against), then —
          // since the flat form's single section is also the last step — routes
          // to review. Without the persist, submit would reject every required
          // answer (the server is the authority and sees no saved answers).
          onNext={handleNext}
          onSaveAndExit={handleSaveAndExit}
        />
        {orphanDialog}
        {liveRegion}
      </div>
    );
  }

  // ----- SECTIONED wizard -----
  return (
    <div className="flex flex-col gap-7">
      <WizardProgress
        currentStepIndex={currentStepIndex}
        stepCount={stepCount}
        isReview={isReview}
      />

      {banner && !isReview && <Banner message={banner} />}

      {isReview ? (
        <ReviewScreen
          visibleSections={visibleSections}
          visibleItemIds={visibleItemIds}
          visibleContainerIds={visibleContainerIds}
          instancesByGroup={instancesByGroup}
          visibleItemIdsByInstance={visibleItemIdsByInstance}
          answers={answers}
          signoffs={signoffs}
          saving={saving}
          onSignSection={handleSignSection}
          onEditSection={(id) => {
            setBanner(null);
            goToSection(id);
          }}
          phaseResultSlot={phaseResultSlot}
          submitSlot={submitPanel}
        />
      ) : currentSection ? (
        <>
          <SectionStep
            section={currentSection}
            index={currentStepIndex}
            imageUrls={imageUrls}
            answers={answers}
            errors={errors}
            onChange={onChange}
            visibleItemIds={visibleItemIds}
            visibleContainerIds={visibleContainerIds}
            instancesByGroup={instancesByGroup}
            visibleItemIdsByInstance={visibleItemIdsByInstance}
            instanceErrors={instanceErrors}
            saving={saving}
            onObservationChange={setObservation}
            onOtherTextChange={setOtherText}
            onClear={handleClearBlock}
            onAddInstance={handleAddInstance}
            onRemoveInstance={handleRemoveInstance}
            onMoveInstance={handleMoveInstance}
            onInstanceChange={handleInstanceChange}
            onInstanceObservationChange={setInstanceObservation}
            onInstanceOtherTextChange={setInstanceOtherText}
            onInstanceClear={handleClearInstanceBlock}
          />
          <WizardNav
            canGoBack={currentStepIndex > 0}
            isLastSection={currentStepIndex >= stepCount - 1}
            saving={saving}
            onBack={handleBack}
            onNext={handleNext}
            onSaveAndExit={handleSaveAndExit}
          />
        </>
      ) : null}

      {orphanDialog}
      {liveRegion}
    </div>
  );
}

function Banner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive"
    >
      {message}
    </p>
  );
}

export type { AnswerState };

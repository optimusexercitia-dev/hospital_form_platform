"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import type { Json } from "@/lib/types/database";
import type { Section } from "@/lib/queries/forms";

import type { SectionSignoff } from "@/components/signoffs/types";

import type { AnswerState, WizardData } from "./types";
import {
  useWizard,
  hasAnswer,
  type OrphanedSection,
} from "./use-wizard";
import { validateSection } from "./validation";
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
  /** Persist a section's answers (+ advance `last_section_id`); F4. */
  saveSection: (input: {
    sectionId: string;
    answersByItemId: Record<string, Json>;
    clearItemIds?: string[];
  }) => Promise<{ ok: boolean; error?: string }>;
  /** Persist the current section + signal exit; F4. */
  saveAndExit: (input: {
    sectionId: string | null;
    answersByItemId: Record<string, Json>;
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
    currentSection,
    currentStepIndex,
    stepCount,
    isReview,
    answers,
    answerMap,
    setAnswer,
    next,
    back,
    goToSection,
    goToReview,
    previewAnswerChange,
    detectOrphans,
    commitAnswerChange,
  } = wizard;

  /** Collect a section's current answers keyed by item_id (B3's save shape). */
  const answersForSection = useCallback(
    (section: Section): Record<string, Json> => {
      const out: Record<string, Json> = {};
      for (const item of section.items) {
        const rec = answers[item.id];
        if (rec) out[rec.itemId] = rec.value;
      }
      return out;
    },
    [answers],
  );

  /** Persist the current section before navigating away from it (F4). */
  const persistSection = useCallback(
    async (section: Section): Promise<boolean> => {
      setSaving(true);
      setBanner(null);
      const result = await actions.saveSection({
        sectionId: section.id,
        answersByItemId: answersForSection(section),
      });
      setSaving(false);
      if (!result.ok) {
        setBanner(result.error ?? "Não foi possível salvar suas respostas.");
        return false;
      }
      return true;
    },
    [actions, answersForSection],
  );

  /**
   * Handle an input change. If the change would HIDE a section that already
   * holds answers, hold it and raise the warn-and-clear dialog (F4); otherwise
   * commit immediately. Clears the field's own error on a meaningful value.
   */
  const onChange = useCallback(
    (item: { id: string; questionKey: string }, value: Json) => {
      const prospective = previewAnswerChange(item, value);
      const orphans = detectOrphans(prospective).filter(
        // Don't warn about the section being edited itself; only OTHER sections
        // whose visibility this answer controls.
        (o) => o.section.id !== currentSection?.id,
      );
      if (orphans.length > 0) {
        setPendingOrphan({ item, value, orphans });
        return;
      }
      setAnswer(item, value);
      setErrors((prev) => {
        if (!prev[item.id]) return prev;
        if (!hasAnswer({ itemId: item.id, questionKey: item.questionKey, value }))
          return prev;
        const nextErrors = { ...prev };
        delete nextErrors[item.id];
        return nextErrors;
      });
    },
    [previewAnswerChange, detectOrphans, currentSection?.id, setAnswer],
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
      const result = await actions.saveSection({
        sectionId: currentSection.id,
        answersByItemId: {
          ...answersForSection(currentSection),
          [pending.item.id]: pending.value,
        },
        clearItemIds,
      });
      setSaving(false);
      if (!result.ok) {
        setBanner(result.error ?? "Não foi possível salvar suas respostas.");
      }
    }
  }, [pendingOrphan, commitAnswerChange, currentSection, actions, answersForSection]);

  /** Advance: validate the current section, persist, then move forward. */
  const handleNext = useCallback(async () => {
    const section = currentSection;
    if (!section) return;

    const sectionErrors = validateSection(section, answers);
    if (Object.keys(sectionErrors).length > 0) {
      setErrors(sectionErrors);
      setBanner("Revise os campos destacados antes de continuar.");
      return;
    }
    setErrors({});

    const ok = await persistSection(section);
    if (!ok) return;

    if (currentStepIndex >= stepCount - 1) goToReview();
    else next();
  }, [
    currentSection,
    answers,
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
    setSaving(true);
    const result = await actions.saveAndExit({
      sectionId: section?.id ?? null,
      answersByItemId: section ? answersForSection(section) : {},
    });
    setSaving(false);
    if (!result.ok) {
      setBanner(result.error ?? "Não foi possível salvar suas respostas.");
      return;
    }
    router.push(`/c/${data.slug}/forms`);
  }, [actions, currentSection, answersForSection, router, data.slug]);

  /** Submit (F5): the server is the authority; surface its pt-BR rejection. */
  const handleSubmit = useCallback(async () => {
    setSaving(true);
    setBanner(null);
    // For a case-phase fill, thread the per-phase result override (phase-results
    // feature). `overrideResultId`: a chosen option id when the operator overrode;
    // `null` to CLEAR a previously-stashed override (toggle off or pick "none");
    // `undefined` for standalone fills (the runner ignores it). The reason is only
    // meaningful alongside a non-null override.
    const override = phaseResult
      ? {
          overrideResultId: overrideEnabled
            ? overrideResultId || null
            : null,
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

  // ----- Confirmation (post-submit) -----
  if (submitted) {
    return <ConfirmationScreen slug={data.slug} formTitle={data.formTitle} />;
  }

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
      blockReason={signoffBlockReason}
    />
  );

  // The end-of-wizard per-phase result panel (phase-results feature; task #8) —
  // case-phase fills only. Rendered on review as a sibling of the sign-off blocks.
  const phaseResultSlot = phaseResult ? (
    <PhaseResultPanel
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

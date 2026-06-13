"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { ProcessTemplatePhase } from "@/lib/queries/process-templates";
import {
  addTemplatePhase,
  updateTemplatePhase,
  type AddPhaseState,
  type ActionState,
} from "@/lib/process-templates/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import { RecommendWhenEditor } from "@/components/process-templates/recommend-when-editor";
import type { PhaseWithTargets } from "@/components/process-templates/phase-with-targets";
import type { SlotForm } from "@/components/process-templates/template-builder-shell";

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Create / edit a phase-slot. A slot binds a whole PUBLISHED form (the form
 * picker) and carries an optional per-slot title and an optional cross-phase
 * `recommend_when` (the {@link RecommendWhenEditor}). Mirrors the form
 * {@link SectionSettingsDialog} idiom: discrete pickers, server-action submit
 * via `useActionState`, the error kept on screen.
 *
 * - `mode="create"` → {@link addTemplatePhase} (appends at the end).
 * - `mode="edit"`   → {@link updateTemplatePhase} (the slot must already exist).
 *
 * The `recommend_when` value is serialized into the `recommendWhen` hidden field
 * as JSON (the actions `JSON.parse` it). On edit, an explicit
 * `clearRecommendWhen=true` field clears a previously-set condition.
 */
export function PhaseSlotDialog({
  mode,
  open,
  onOpenChange,
  templateId,
  phase,
  forms,
  phases,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  /** Required for `edit`; ignored for `create`. */
  phase?: ProcessTemplatePhase;
  forms: SlotForm[];
  phases: PhaseWithTargets[];
}) {
  const action = mode === "create" ? addTemplatePhase : updateTemplatePhase;
  const [state, formAction, isPending] = useActionState<
    (AddPhaseState & ActionState) | undefined,
    FormData
  >(action, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  const [formId, setFormId] = useState<string>(phase?.formId ?? "");
  const [title, setTitle] = useState<string>(phase?.title ?? "");
  // Serialized RecommendWhen JSON ("" = none) emitted by the editor.
  const [recommendJson, setRecommendJson] = useState<string>(
    phase?.recommendWhen ? JSON.stringify(phase.recommendWhen) : "",
  );

  // The phase's 1-based position drives which earlier phases can be referenced
  // by `recommend_when`. On create, the new slot lands at max(position)+1.
  const newPosition = useMemo(() => {
    if (mode === "edit" && phase) return phase.position;
    return phases.length + 1;
  }, [mode, phase, phases.length]);

  const hadRecommend = Boolean(phase?.recommendWhen);
  const clearRecommend = mode === "edit" && hadRecommend && recommendJson === "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nova fase" : `Editar fase ${phase?.position}`}
          </DialogTitle>
          <DialogDescription>
            Escolha o formulário desta fase e, se desejar, defina quando ela deve
            ser recomendada com base em uma fase anterior.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-6" noValidate>
          {mode === "create" ? (
            <input type="hidden" name="templateId" value={templateId} />
          ) : (
            <input type="hidden" name="phaseId" value={phase?.id ?? ""} />
          )}
          <input type="hidden" name="recommendWhen" value={recommendJson} />
          {clearRecommend && (
            <input type="hidden" name="clearRecommendWhen" value="true" />
          )}

          {state && !state.ok && !state.fieldErrors?.formId && (
            <FormBanner tone="error">
              {state.error ?? state.fieldErrors?.recommendWhen}
            </FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Formulário da fase</span>
            <select
              name="formId"
              className={SELECT_CLASS}
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              required
              aria-invalid={state?.fieldErrors?.formId ? true : undefined}
            >
              <option value="">Selecione um formulário…</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
            {state?.fieldErrors?.formId && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.formId}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Título da fase{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </span>
            <input
              name="title"
              type="text"
              className={SELECT_CLASS}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Fase 2 — Revisão do comitê"
            />
          </label>

          <RecommendWhenEditor
            phasePosition={newPosition}
            phases={phases}
            value={recommendJson}
            onChange={setRecommendJson}
            error={state?.fieldErrors?.recommendWhen}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending
                ? "Salvando…"
                : mode === "create"
                  ? "Adicionar fase"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

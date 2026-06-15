"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ProcessTemplatePhase } from "@/lib/queries/process-templates";
import {
  addTemplatePhase,
  updateTemplatePhase,
  setTemplatePhaseBlocks,
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
import { PhaseBlocksEditor } from "@/components/process-templates/phase-blocks-editor";
import type { PhaseWithTargets } from "@/components/process-templates/phase-with-targets";
import type { SlotForm } from "@/components/process-templates/template-builder-shell";

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** Stable compare of two unordered position arrays. */
function sameBlocks(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

/**
 * Create / edit a phase-slot. A slot binds a whole PUBLISHED form (the form
 * picker) and carries an optional per-slot title, an optional default due-window,
 * an optional cross-phase `recommend_when` (the {@link RecommendWhenEditor}), and
 * the EARLIER phases that BLOCK it (D1/D4 — the {@link PhaseBlocksEditor}).
 *
 * - `mode="create"` → {@link addTemplatePhase} (appends at the end).
 * - `mode="edit"`   → {@link updateTemplatePhase} (the slot must already exist).
 *
 * The submit is click-driven inside a transition (mirrors `TagDefDialog`): the
 * slot's discrete fields go through the form action, then — when the BLOCKERS
 * changed — a SEPARATE {@link setTemplatePhaseBlocks} call persists them against
 * the created/edited phase id (the form actions don't carry a blocks field). The
 * route refreshes once both have landed. The `recommend_when` value is serialized
 * to JSON; on edit, an explicit `clearRecommendWhen=true` field clears a
 * previously-set condition.
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<(AddPhaseState & ActionState) | null>(null);

  const [formId, setFormId] = useState<string>(phase?.formId ?? "");
  const [title, setTitle] = useState<string>(phase?.title ?? "");
  // Optional per-slot default due-window (in days). "" = no default; an explicit
  // empty submit clears a previously-set default (the action handles present-and-empty).
  const [defaultDays, setDefaultDays] = useState<string>(
    phase?.defaultDueDays != null ? String(phase.defaultDueDays) : "",
  );
  // Serialized RecommendWhen JSON ("" = none) emitted by the editor.
  const [recommendJson, setRecommendJson] = useState<string>(
    phase?.recommendWhen ? JSON.stringify(phase.recommendWhen) : "",
  );
  // The selected blocker positions (D1/D4). Persisted separately on success.
  const [blocks, setBlocks] = useState<number[]>(phase?.blocks ?? []);

  // Reset local state each time the dialog opens (render-phase open transition).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setFormId(phase?.formId ?? "");
      setTitle(phase?.title ?? "");
      setDefaultDays(phase?.defaultDueDays != null ? String(phase.defaultDueDays) : "");
      setRecommendJson(phase?.recommendWhen ? JSON.stringify(phase.recommendWhen) : "");
      setBlocks(phase?.blocks ?? []);
    }
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  // The phase's 1-based position drives which earlier phases can be referenced by
  // `recommend_when` / the blockers. On create, the new slot lands at max(position)+1.
  const newPosition = useMemo(() => {
    if (mode === "edit" && phase) return phase.position;
    return phases.length + 1;
  }, [mode, phase, phases.length]);

  const originalBlocks = phase?.blocks ?? [];
  const hadRecommend = Boolean(phase?.recommendWhen);
  const clearRecommend = mode === "edit" && hadRecommend && recommendJson === "";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData();
    if (mode === "create") {
      form.set("templateId", templateId);
    } else {
      form.set("phaseId", phase?.id ?? "");
    }
    form.set("formId", formId);
    form.set("title", title);
    form.set("defaultDays", defaultDays);
    form.set("recommendWhen", recommendJson);
    if (clearRecommend) form.set("clearRecommendWhen", "true");

    startTransition(async () => {
      // The create action echoes the new phase id; edit operates on a known one.
      let result: AddPhaseState & ActionState;
      let newPhaseId: string | null = phase?.id ?? null;
      if (mode === "create") {
        const created = await addTemplatePhase(undefined, form);
        result = created;
        newPhaseId = created.phaseId ?? null;
      } else {
        result = await updateTemplatePhase(undefined, form);
      }

      if (!result.ok) {
        setState(result);
        return;
      }

      // Slot saved — persist the blockers when they changed, against the
      // created/edited phase id.
      const targetPhaseId = newPhaseId;
      if (targetPhaseId && !sameBlocks(blocks, originalBlocks)) {
        const blocksResult = await setTemplatePhaseBlocks(targetPhaseId, blocks);
        if (!blocksResult.ok) {
          // The slot already saved; surface the blockers error and keep the
          // dialog open so the coordinator can retry/adjust.
          setState({
            ok: false,
            error:
              blocksResult.error ?? "Não foi possível salvar os bloqueios.",
          });
          return;
        }
      }

      setState({ ok: true });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nova fase" : `Editar fase ${phase?.position}`}
          </DialogTitle>
          <DialogDescription>
            Escolha o formulário desta fase e, se desejar, defina bloqueios por
            fases anteriores e quando ela deve ser recomendada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
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

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Prazo padrão (dias){" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </span>
            <input
              name="defaultDays"
              type="number"
              min={0}
              inputMode="numeric"
              className={SELECT_CLASS}
              value={defaultDays}
              onChange={(e) => setDefaultDays(e.target.value)}
              placeholder="Ex.: 7"
            />
            <span className="text-xs text-muted-foreground">
              Ao ativar a fase em um caso, o prazo será sugerido com base nesse
              número de dias.
            </span>
          </label>

          <PhaseBlocksEditor
            phasePosition={newPosition}
            phases={phases}
            value={blocks}
            onChange={setBlocks}
          />

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

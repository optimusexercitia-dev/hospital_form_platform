"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CaseNarrativeType } from "@/lib/queries/case-narratives";
import type { ProcessTemplateNarrative } from "@/lib/queries/process-templates";
import {
  addTemplateNarrative,
  updateTemplateNarrative,
  type AddTemplateNarrativeState,
  type ActionState,
  type TemplateNarrativeInput,
} from "@/lib/case-narratives/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import { Textarea } from "@/components/ui/textarea";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Create / edit a NARRATIVE-SLOT in the process builder (ADR 0032), mirroring
 * {@link PhaseSlotDialog}. A slot binds a narrative TYPE (the `<select>`, archived
 * types hidden) and carries an optional per-slot title override, optional
 * authoring instructions, and the advisory `is_expected` close flag.
 *
 * - `mode="create"` → {@link addTemplateNarrative} (appends at the bottom of the
 *   combined phase+narrative list).
 * - `mode="edit"`   → {@link updateTemplateNarrative} (title / instructions /
 *   is_expected only — the bound type is fixed at creation, so it is shown
 *   read-only on edit).
 *
 * Arg-based actions (not FormData) run inside a transition; the route refreshes on
 * success. Draft-only, like the phase controls (the RPCs reject non-draft edits).
 */
export function NarrativeSlotDialog({
  mode,
  open,
  onOpenChange,
  templateId,
  narrative,
  narrativeTypes,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  /** Required for `edit`; ignored for `create`. */
  narrative?: ProcessTemplateNarrative;
  /** The commission's NON-archived narrative vocabulary (the type picker). */
  narrativeTypes: CaseNarrativeType[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<
    (AddTemplateNarrativeState & ActionState) | null
  >(null);

  const [narrativeTypeId, setNarrativeTypeId] = useState<string>(
    narrative?.narrativeTypeId ?? "",
  );
  const [title, setTitle] = useState<string>(narrative?.title ?? "");
  const [instructions, setInstructions] = useState<string>(
    narrative?.instructions ?? "",
  );
  const [isExpected, setIsExpected] = useState<boolean>(
    narrative?.isExpected ?? false,
  );

  // Reset local state each time the dialog opens (render-phase open transition).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setNarrativeTypeId(narrative?.narrativeTypeId ?? "");
      setTitle(narrative?.title ?? "");
      setInstructions(narrative?.instructions ?? "");
      setIsExpected(narrative?.isExpected ?? false);
    }
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  // On edit the bound type is fixed; show its live label (or the snapshot if the
  // type was archived/removed from the vocabulary since binding).
  const boundTypeLabel =
    narrativeTypes.find((t) => t.id === narrative?.narrativeTypeId)?.label ??
    narrative?.typeLabel ??
    "Tipo de narrativa";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input: TemplateNarrativeInput = {
      title: title.trim() === "" ? null : title.trim(),
      instructions: instructions.trim() === "" ? null : instructions.trim(),
      isExpected,
    };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await addTemplateNarrative(templateId, narrativeTypeId, input)
          : await updateTemplateNarrative(narrative?.id ?? "", input);
      setState(result);
    });
  }

  const canSubmit = mode === "edit" || narrativeTypeId !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nova narrativa" : "Editar narrativa"}
          </DialogTitle>
          <DialogDescription>
            Escolha o tipo de narrativa e, se desejar, ajuste o título, as
            orientações de preenchimento e se ela é esperada para concluir o caso.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
          {state && !state.ok && !state.fieldErrors?.narrativeTypeId && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          {mode === "create" ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Tipo de narrativa</span>
              {narrativeTypes.length === 0 ? (
                <span className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
                  Esta comissão ainda não tem narrativas. Crie um tipo em
                  Configurações → Narrativas antes de adicioná-la a um processo.
                </span>
              ) : (
                <select
                  name="narrativeTypeId"
                  className={FIELD_CLASS}
                  value={narrativeTypeId}
                  onChange={(e) => setNarrativeTypeId(e.target.value)}
                  required
                  aria-invalid={
                    state?.fieldErrors?.narrativeTypeId ? true : undefined
                  }
                >
                  <option value="">Selecione um tipo…</option>
                  {narrativeTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              )}
              {state?.fieldErrors?.narrativeTypeId && (
                <span role="alert" className="text-sm font-medium text-destructive">
                  {state.fieldErrors.narrativeTypeId}
                </span>
              )}
            </label>
          ) : (
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Tipo de narrativa</span>
              <span className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                {boundTypeLabel}
              </span>
            </div>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Título{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </span>
            <input
              type="text"
              className={FIELD_CLASS}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Substitui o nome do tipo nesta etapa do processo"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Orientações de preenchimento{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </span>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Mostradas ao coordenador ao redigir esta narrativa no caso."
              className="min-h-20 text-sm"
            />
          </label>

          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox
              checked={isExpected}
              onCheckedChange={(c) => setIsExpected(c === true)}
              className="mt-0.5"
            />
            <span className="flex flex-col">
              <span className="font-medium">Esperada ao concluir</span>
              <span className="text-xs text-muted-foreground">
                Exibe um aviso ao concluir um caso com esta narrativa em branco.
                Não impede a conclusão.
              </span>
            </span>
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending || !canSubmit}>
              {isPending
                ? "Salvando…"
                : mode === "create"
                  ? "Adicionar narrativa"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  addAdHocNarrative,
  type AddAdHocNarrativeState,
} from "@/lib/case-narratives/actions";
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
import { NativeSelect } from "@/components/ui/native-select";
import { PhiInputHint } from "@/components/ui/phi-input-hint";
import type { AssigneeOption } from "@/components/cases/case-phase-list";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20";

/** Sentinel option value that reveals the inline "create new type" text input. */
const NEW_TYPE = "__new__";

/**
 * Append an ad-hoc NARRATIVE to an open case (not from the template) — mirrors
 * {@link import('./add-ad-hoc-phase-dialog').AddAdHocPhaseDialog}. Picks an existing
 * narrative TYPE from the commission's vocabulary, OR inline-creates a new type
 * ("＋ Criar novo tipo…", mirroring the outcome inline-create UX), plus an optional
 * title, instructions, and initial assignee, then calls {@link addAdHocNarrative}.
 * Append-only: the new narrative lands at the end of the merged case layout and
 * starts `aberta`.
 */
export function AddAdHocNarrativeDialog({
  open,
  onOpenChange,
  caseId,
  narrativeTypes,
  assignees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  narrativeTypes: { id: string; label: string }[];
  assignees: AssigneeOption[];
}) {
  const [state, formAction, isPending] = useActionState<
    AddAdHocNarrativeState | undefined,
    FormData
  >(addAdHocNarrative, undefined);
  const router = useRouter();

  // Which type is selected in the picker; `__new__` reveals the label input and
  // makes the submitted `narrativeTypeId` empty so the action falls back to
  // `newTypeLabel` (mirrors the outcome inline-create interaction).
  const [typeChoice, setTypeChoice] = useState("");
  const creatingNew = typeChoice === NEW_TYPE;

  // Reset the local picker state each time the dialog opens (render-phase
  // transition — the pattern used by the conclude / outcome dialogs).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTypeChoice("");
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar narrativa ao caso</DialogTitle>
          <DialogDescription>
            Inclua uma narrativa adicional neste caso. Escolha um tipo existente ou
            crie um novo. A narrativa é acrescentada ao final e começa aberta.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="caseId" value={caseId} />

          {state && !state.ok && !state.fieldErrors?.narrativeTypeId && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Tipo de narrativa</span>
            <NativeSelect
              // When creating a new type we deliberately submit an EMPTY
              // `narrativeTypeId` so the action uses `newTypeLabel` instead.
              name="narrativeTypeId"
              value={creatingNew ? "" : typeChoice}
              onChange={(e) => setTypeChoice(e.target.value)}
              className="h-10"
              required={!creatingNew}
              aria-invalid={
                state?.fieldErrors?.narrativeTypeId ? true : undefined
              }
            >
              <option value="" disabled>
                Selecione um tipo…
              </option>
              {narrativeTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
              <option value={NEW_TYPE}>＋ Criar novo tipo…</option>
            </NativeSelect>
            {/* Keep the sentinel selection controllable while the real select
                submits the empty id above. The picker `value` is driven from
                `typeChoice`, so the sentinel stays visible when chosen. */}
            {state?.fieldErrors?.narrativeTypeId && (
              <span
                role="alert"
                className="text-sm font-medium text-destructive"
              >
                {state.fieldErrors.narrativeTypeId}
              </span>
            )}
          </label>

          {creatingNew && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Nome do novo tipo</span>
              <input
                name="newTypeLabel"
                type="text"
                className={FIELD_CLASS}
                placeholder="Ex.: Resumo Clínico"
                required
                autoFocus
                aria-invalid={
                  state?.fieldErrors?.newTypeLabel ? true : undefined
                }
              />
              {state?.fieldErrors?.newTypeLabel && (
                <span
                  role="alert"
                  className="text-sm font-medium text-destructive"
                >
                  {state.fieldErrors.newTypeLabel}
                </span>
              )}
            </label>
          )}

          <PhiInputHint>
            {(hintId) => (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">
                  Título{" "}
                  <span className="font-normal text-muted-foreground">
                    (opcional)
                  </span>
                </span>
                <input
                  name="title"
                  type="text"
                  className={FIELD_CLASS}
                  placeholder="Ex.: Resumo Clínico"
                  aria-describedby={hintId}
                />
              </label>
            )}
          </PhiInputHint>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Instruções{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <textarea
              name="instructions"
              rows={2}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Orientações para quem for redigir esta narrativa."
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Responsável{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <NativeSelect name="assignedTo" className="h-10" defaultValue="">
              <option value="">Atribuir depois</option>
              {assignees.map((a) => (
                <option key={a.userId} value={a.userId}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
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
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Adicionando…" : "Adicionar narrativa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

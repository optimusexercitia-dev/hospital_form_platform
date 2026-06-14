"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  createCaseEvent,
  updateCaseEvent,
  type ActionState,
} from "@/lib/cases/documents-actions";
import type { CaseEvent, CaseEventKind } from "@/lib/queries/case-documents";
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
import { EVENT_KIND_LABEL } from "./case-extras-labels";

const FIELD_CLASS =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

const EVENT_KINDS: CaseEventKind[] = ["note", "meeting", "decision", "other"];

/**
 * Create / edit a manual case event (R1) — a free-text working note, meeting or
 * decision record. `useActionState`-shaped against {@link createCaseEvent} /
 * {@link updateCaseEvent}; on success the dialog closes and the route refreshes.
 */
export function CaseEventForm({
  mode,
  open,
  onOpenChange,
  caseId,
  event,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  /** Required for `edit`; ignored for `create`. */
  event?: CaseEvent;
}) {
  const action = mode === "create" ? createCaseEvent : updateCaseEvent;
  const [state, formAction, isPending] = useActionState<
    ActionState | undefined,
    FormData
  >(action, undefined);
  const router = useRouter();

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
          <DialogTitle>
            {mode === "create" ? "Adicionar registro" : "Editar registro"}
          </DialogTitle>
          <DialogDescription>
            Registre uma nota, reunião ou decisão deste caso. Nunca inclua dados
            de paciente.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4" noValidate>
          {mode === "create" ? (
            <input type="hidden" name="caseId" value={caseId} />
          ) : (
            <input type="hidden" name="eventId" value={event?.id ?? ""} />
          )}

          {state && !state.ok && !state.fieldErrors?.body && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Tipo</span>
            <select
              name="kind"
              className={FIELD_CLASS}
              defaultValue={event?.kind ?? "note"}
            >
              {EVENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {EVENT_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>

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
              defaultValue={event?.title ?? ""}
              placeholder="Ex.: Reunião de revisão"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Descrição</span>
            <textarea
              name="body"
              required
              rows={4}
              className={FIELD_CLASS}
              defaultValue={event?.body ?? ""}
              placeholder="Descreva a nota, reunião ou decisão…"
              aria-invalid={state?.fieldErrors?.body ? true : undefined}
            />
            {state?.fieldErrors?.body && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.body}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Data{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <input
              name="occurredAt"
              type="date"
              className={FIELD_CLASS}
              defaultValue={event?.occurredAt ?? ""}
            />
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
              {isPending
                ? "Salvando…"
                : mode === "create"
                  ? "Adicionar"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

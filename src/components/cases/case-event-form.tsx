"use client";

import { useActionState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";

import {
  createCaseEvent,
  updateCaseEvent,
  type ActionState,
} from "@/lib/cases/documents-actions";
import type { CaseEvent } from "@/lib/queries/case-documents";
import { CASE_EVENT_KINDS } from "@/lib/cases/registro-kinds";
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
import { Field, FieldError, FieldLabel, useFieldIds } from "@/components/ui/field";
import { DatePicker } from "@/components/ui/date-picker";
import { TimeField } from "@/components/ui/time-field";
import { PhiInputHint } from "@/components/ui/phi-input-hint";
import { EVENT_KIND_LABEL } from "./case-extras-labels";

const FIELD_CLASS =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

const EVENT_KINDS = CASE_EVENT_KINDS;

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
  canSetVisibility = false,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  /** Required for `edit`; ignored for `create`. */
  event?: CaseEvent;
  /**
   * Whether the viewer (a coordinator) may set the record's visibility (ETH·E3a).
   * When `false`, the field is omitted and the record keeps the default
   * `case_readers` visibility (server-side default) — a non-coordinator never sets
   * `coordinator_only`.
   */
  canSetVisibility?: boolean;
}) {
  const action = mode === "create" ? createCaseEvent : updateCaseEvent;
  const [state, formAction, isPending] = useActionState<
    ActionState | undefined,
    FormData
  >(action, undefined);
  const router = useRouter();

  const occurredAtId = useId();
  const visibilityId = useId();
  const visibilityHintId = useId();

  const bodyField = useFieldIds("body", {
    hasError: Boolean(state?.fieldErrors?.body),
    nameRequiredFor: "formData",
  });

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
            Registre uma nota, reunião, decisão, atualização ou acompanhamento
            deste caso. Nunca inclua dados de paciente.
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
            <NativeSelect
              name="kind"
              className="py-2"
              defaultValue={event?.kind ?? "note"}
            >
              {EVENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {EVENT_KIND_LABEL[k]}
                </option>
              ))}
            </NativeSelect>
          </label>

          {/* ETH·E3a: a coordinator may narrow a record to "coordinator_only" — an
              ADDITIONAL restriction on top of `can_read_case` (never a widening). A
              non-coordinator's form omits this field entirely; the record then keeps
              the server-side default `case_readers` (today's behavior). */}
          {canSetVisibility && (
            /* ⛔ THE HINT IS OUTSIDE THE <label> — same family as the body error
                below, and it was live here too. A wrapping `<label>` contributes ALL
                its text to the accessible name, so with the hint inside it this
                select announced as "Visibilidade "Somente coordenação" restringe este
                registro à coordenação da comissão, além das regras de acesso do
                caso." — a whole paragraph where a name belongs, read out on every
                focus. `htmlFor` + `aria-describedby` names it "Visibilidade" and
                offers the explanation as a description instead. */
            <div className="flex flex-col gap-1.5 text-sm">
              <label htmlFor={visibilityId} className="font-medium">
                Visibilidade
              </label>
              <NativeSelect
                id={visibilityId}
                name="visibility"
                className="py-2"
                defaultValue={event?.visibility ?? "case_readers"}
                aria-describedby={visibilityHintId}
              >
                <option value="case_readers">
                  Todos os leitores do caso
                </option>
                <option value="coordinator_only">Somente coordenação</option>
              </NativeSelect>
              <span
                id={visibilityHintId}
                className="text-xs text-muted-foreground text-pretty"
              >
                &quot;Somente coordenação&quot; restringe este registro à coordenação
                da comissão, além das regras de acesso do caso.
              </span>
            </div>
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
                  defaultValue={event?.title ?? ""}
                  placeholder="Ex.: Reunião de revisão"
                  aria-describedby={hintId}
                />
              </label>
            )}
          </PhiInputHint>

          {/* ⛔ THE ERROR MUST NOT BE A CHILD OF THE LABEL — FUP-0137-ALERT-INSIDE-
              LABEL-MUTATES-NAME, the same defect the Atividade card's composer was
              fixed for. A `role="alert"` inside the wrapping `<label>` is part of the
              accessible NAME computation, so on a validation failure this textarea
              silently renamed itself from "Descrição" to "Descrição Descreva o
              registro." — and a user who tabbed BACK to the invalid control heard the
              message not at all, because nothing described it.

              ⚠ It was fixed on the composer and left here, which mattered little
              while the composer was the everyday path. Removing the composer
              (2026-08-24) made THIS the only way to author a record, so the defect
              went from one path of two to the only one. `useFieldIds` + `FieldError`
              is the house pattern; it links the message through `aria-describedby`.

              `nameRequiredFor: "formData"` is DECLARED, not incidental: the action
              reads `formData.get('body')`, so dropping the DOM `name` would post an
              empty record. */}
          <Field className="text-sm">
            <FieldLabel
              htmlFor={bodyField.controlProps.id}
              className="font-medium"
            >
              Descrição
            </FieldLabel>
            <textarea
              {...bodyField.controlProps}
              required
              rows={4}
              className={FIELD_CLASS}
              defaultValue={event?.body ?? ""}
              placeholder="Descreva o registro…"
            />
            <FieldError id={bodyField.errorId}>
              {state?.fieldErrors?.body}
            </FieldError>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 text-sm">
              <label
                id={`${occurredAtId}-label`}
                htmlFor={occurredAtId}
                className="font-medium"
              >
                Data{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </label>
              <DatePicker
                id={occurredAtId}
                labelId={`${occurredAtId}-label`}
                name="occurredAt"
                defaultValue={event?.occurredAt ?? ""}
              />
            </div>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Hora{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </span>
              {/* Uncontrolled — emits a hidden `occurredTime` ("HH:mm" or "")
                  the create/update action reads directly. */}
              <TimeField
                name="occurredTime"
                defaultValue={event?.occurredTime ?? ""}
                aria-label="Hora do registro (opcional)"
                aria-invalid={state?.fieldErrors?.occurredTime ? true : undefined}
              />
              {state?.fieldErrors?.occurredTime && (
                <span role="alert" className="text-sm font-medium text-destructive">
                  {state.fieldErrors.occurredTime}
                </span>
              )}
            </label>
          </div>

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

"use client";

import { useActionState, useEffect } from "react";
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
  initialKind,
  initialBody,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  /** Required for `edit`; ignored for `create`. */
  event?: CaseEvent;
  /**
   * CREATE mode only — seed the kind / body from the Atividade card's inline
   * composer (ADR 0137 D12), so opening "Mais detalhes" carries what the author
   * already typed instead of making them retype it. Ignored in `edit` mode, where
   * `event` is the source.
   *
   * ⚠ Consumed through `defaultValue`, so these apply at MOUNT. The caller mounts
   * this dialog only while it is open — a fresh mount per open IS the prefill
   * mechanism; keeping it permanently mounted would freeze the first values.
   */
  initialKind?: string;
  initialBody?: string;
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
              defaultValue={event?.kind ?? initialKind ?? "note"}
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
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Visibilidade</span>
              <NativeSelect
                name="visibility"
                className="py-2"
                defaultValue={event?.visibility ?? "case_readers"}
              >
                <option value="case_readers">
                  Todos os leitores do caso
                </option>
                <option value="coordinator_only">Somente coordenação</option>
              </NativeSelect>
              <span className="text-xs text-muted-foreground text-pretty">
                &quot;Somente coordenação&quot; restringe este registro à coordenação
                da comissão, além das regras de acesso do caso.
              </span>
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
                  defaultValue={event?.title ?? ""}
                  placeholder="Ex.: Reunião de revisão"
                  aria-describedby={hintId}
                />
              </label>
            )}
          </PhiInputHint>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Descrição</span>
            <textarea
              name="body"
              required
              rows={4}
              className={FIELD_CLASS}
              defaultValue={event?.body ?? initialBody ?? ""}
              placeholder="Descreva o registro…"
              aria-invalid={state?.fieldErrors?.body ? true : undefined}
            />
            {state?.fieldErrors?.body && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.body}
              </span>
            )}
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Data{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </span>
              <DatePicker
                name="occurredAt"
                defaultValue={event?.occurredAt ?? ""}
              />
            </label>

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

"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ListTodo } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { formatPeriodLabel } from "@/components/indicators/indicator-format";
import type {
  Indicator,
  IndicatorMeasurement,
} from "@/lib/indicators/types";
import type { CreateActionItemState } from "@/lib/action-items/actions";

type CreateManualAction = (
  prev: CreateActionItemState | undefined,
  formData: FormData,
) => Promise<CreateActionItemState>;

/**
 * Non-operator fallback for the off-target two-tier escalation (Phase 15, F5).
 *
 * A staff_admin who is NOT a PQS operator of the indicator's hospital cannot open
 * a CAPA (that's an NSP instrument). Instead they create a COMMITTEE action item
 * on the shared Action-Items Hub, pre-filled with the indicator context
 * (name + off-target period), via `createManualActionItem`
 * (`create_committee_action_item` `source_type='manual'`) — ADR 0057, no schema
 * change. This is the committees-escalate-to-NSP two-tier model Phase 14 set.
 */
export function ActionItemFallbackDialog({
  indicator,
  latestMeasurement,
  createManualAction,
}: {
  indicator: Indicator;
  latestMeasurement: IndicatorMeasurement | null;
  createManualAction: CreateManualAction;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createManualAction,
    undefined,
  );
  const closedRef = useRef(false);

  useEffect(() => {
    if (open) closedRef.current = false;
  }, [open]);

  useEffect(() => {
    if (state?.ok && !closedRef.current) {
      closedRef.current = true;
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  const periodLabel = latestMeasurement
    ? formatPeriodLabel(latestMeasurement.periodLabel)
    : "";
  const defaultTitle = `Ação: ${indicator.name}${
    periodLabel ? ` (${periodLabel})` : ""
  }`;
  const defaultDescription = `Indicador "${indicator.name}" (${indicator.code}) fora da meta${
    periodLabel ? ` no período ${periodLabel}` : ""
  }. Registrar e acompanhar a ação corretiva.`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="lg" variant="outline">
          <ListTodo aria-hidden="true" className="size-4" />
          Criar item de ação
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar item de ação</DialogTitle>
          <DialogDescription>
            Registre uma ação de acompanhamento para este indicador. O item fica
            disponível no hub de itens de ação da comissão.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="commissionId" value={indicator.commissionId} />
          {state?.error && !state.ok ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              {state.error}
            </p>
          ) : null}
          <Field>
            <FieldLabel htmlFor="fallbackTitle">Título</FieldLabel>
            <Input
              id="fallbackTitle"
              name="title"
              defaultValue={defaultTitle}
              required
              maxLength={200}
              aria-invalid={state?.fieldErrors?.title ? true : undefined}
            />
            <FieldError>{state?.fieldErrors?.title}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="fallbackDescription">
              Descrição (opcional)
            </FieldLabel>
            <Textarea
              id="fallbackDescription"
              name="description"
              rows={3}
              defaultValue={defaultDescription}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="fallbackDueDate">
              Prazo (opcional)
            </FieldLabel>
            <Input
              id="fallbackDueDate"
              name="dueDate"
              type="date"
              aria-invalid={state?.fieldErrors?.dueDate ? true : undefined}
            />
            <FieldError>{state?.fieldErrors?.dueDate}</FieldError>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Criando…" : "Criar item"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

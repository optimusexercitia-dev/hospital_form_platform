"use client";

import { useId, useState } from "react";
import { BellRing, Plus } from "lucide-react";

import type { ActionItemReminder, ReminderType } from "@/lib/queries/action-item-reminders";
import {
  createActionItemReminder,
  toggleActionItemReminder,
  deleteActionItemReminder,
} from "@/lib/action-items/satellite-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";

import {
  REMINDER_TYPE_LABEL,
  OFFSET_REMINDER_TYPES,
  describeReminder,
} from "./satellite-labels";
import { SatelliteSection, SatelliteEmpty } from "./satellite-section";
import { SatelliteConfirmDelete } from "./satellite-confirm-delete";
import { useSatelliteAction } from "./use-satellite-action";

const REMINDER_TYPE_ORDER: ReminderType[] = ["before_due", "on_due", "after_due"];

/**
 * Reminder RULES sub-panel. Each rule says when to nudge relative to the item's
 * due date (delivery is the Notifications track's job). Managing rules is
 * staff_admin/org_admin only (the RPC raises HC0I0 otherwise), so the write
 * controls render only for `canManage`; everyone who can read the item can still
 * SEE the rules. The composer enforces the DB's `offset_days` XOR: `on_due` has
 * no offset, the other two require a positive whole number of days.
 */
export function ReminderSection({
  actionItemId,
  itemTitle,
  reminders,
  canManage,
  onMutated,
}: {
  actionItemId: string;
  itemTitle: string;
  reminders: ActionItemReminder[];
  canManage: boolean;
  onMutated: () => void | Promise<void>;
}) {
  const { run, isPending, error } = useSatelliteAction();
  const typeFieldId = useId();
  const offsetFieldId = useId();

  const [type, setType] = useState<ReminderType>("before_due");
  const [offset, setOffset] = useState("3");

  const needsOffset = OFFSET_REMINDER_TYPES.includes(type);
  const offsetValue = Number.parseInt(offset, 10);
  const offsetValid = !needsOffset || (Number.isInteger(offsetValue) && offsetValue > 0);

  function handleAdd() {
    run(
      () =>
        createActionItemReminder(
          actionItemId,
          type,
          needsOffset ? offsetValue : null,
        ),
      {
        onSuccess: () => {
          setType("before_due");
          setOffset("3");
          return onMutated();
        },
      },
    );
  }

  return (
    <SatelliteSection icon={BellRing} title="Lembretes" count={reminders.length}>
      {reminders.length === 0 ? (
        <SatelliteEmpty>
          {canManage
            ? "Nenhum lembrete configurado. Adicione uma regra para ser avisado sobre o prazo."
            : "Nenhum lembrete configurado."}
        </SatelliteEmpty>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {reminders.map((reminder) => (
            <li
              key={reminder.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card px-3 py-2"
            >
              <span
                className={
                  reminder.isActive
                    ? "text-sm text-foreground"
                    : "text-sm text-muted-foreground"
                }
              >
                {describeReminder(reminder.reminderType, reminder.offsetDays)}
                {!reminder.isActive && (
                  <span className="ml-2 text-[0.65rem] font-normal text-muted-foreground uppercase">
                    Inativo
                  </span>
                )}
              </span>

              {canManage ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={reminder.isActive}
                    disabled={isPending}
                    onCheckedChange={(next) =>
                      run(() => toggleActionItemReminder(reminder.id, next), {
                        onSuccess: onMutated,
                      })
                    }
                    aria-label={
                      reminder.isActive
                        ? `Desativar lembrete: ${describeReminder(reminder.reminderType, reminder.offsetDays)}`
                        : `Ativar lembrete: ${describeReminder(reminder.reminderType, reminder.offsetDays)}`
                    }
                  />
                  <SatelliteConfirmDelete
                    action={() => deleteActionItemReminder(reminder.id)}
                    onDeleted={onMutated}
                    label={`Remover lembrete de "${itemTitle}"`}
                    title="Remover este lembrete?"
                    description="A regra de lembrete será removida. Esta ação não pode ser desfeita."
                  />
                </div>
              ) : (
                <span className="shrink-0 text-[0.65rem] font-medium text-muted-foreground uppercase">
                  {reminder.isActive ? "Ativo" : "Inativo"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border/70 bg-muted/10 p-2.5">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label
                htmlFor={typeFieldId}
                className="text-[0.7rem] font-medium text-muted-foreground"
              >
                Quando avisar
              </label>
              <NativeSelect
                id={typeFieldId}
                className="h-8 py-1 text-sm"
                value={type}
                disabled={isPending}
                onChange={(e) => setType(e.target.value as ReminderType)}
              >
                {REMINDER_TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {REMINDER_TYPE_LABEL[t]}
                  </option>
                ))}
              </NativeSelect>
            </div>

            {needsOffset && (
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={offsetFieldId}
                  className="text-[0.7rem] font-medium text-muted-foreground"
                >
                  Dias
                </label>
                <Input
                  id={offsetFieldId}
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  className="h-8 w-20 py-1 text-sm"
                  value={offset}
                  disabled={isPending}
                  aria-invalid={!offsetValid || undefined}
                  onChange={(e) => setOffset(e.target.value)}
                />
              </div>
            )}

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending || !offsetValid}
              onClick={handleAdd}
            >
              <Plus aria-hidden="true" />
              Adicionar
            </Button>
          </div>
          {!offsetValid && (
            <p role="alert" className="text-xs font-medium text-destructive">
              Informe um número de dias maior que zero.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </SatelliteSection>
  );
}

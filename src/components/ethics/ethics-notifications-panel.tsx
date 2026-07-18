"use client";

import { useState } from "react";
import { BellPlus, Check, X } from "lucide-react";

import {
  acknowledgeEthicsNotification,
  cancelEthicsNotification,
  issueEthicsNotification,
} from "@/lib/ethics/actions";
import type {
  EthicsNotification,
  NotificationDeliveryMethod,
  NotificationType,
} from "@/lib/queries/ethics";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldDescription, useFieldIds } from "@/components/ui/field";
import { FormBanner } from "@/components/auth/form-banner";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";

import { EthicsSection, EthicsEmpty } from "./ethics-section";
import { useEthicsAction } from "./use-ethics-action";
import { localDateTimeToIso } from "./ethics-datetime";
import {
  NOTIFICATION_METHOD_LABELS,
  NOTIFICATION_METHOD_OPTIONS,
  NOTIFICATION_STATUS_LABELS,
  NOTIFICATION_STATUS_TOKENS,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_OPTIONS,
  formatEthicsDateTime,
} from "./ethics-labels";

/**
 * Formal notices with deadlines (ETH·E2 D5). Lists each notice + its *prazo*
 * (`due_at`, which feeds the notification scan arm) and wires the coordinator
 * doors: issue (`issue_ethics_notification`), acknowledge
 * (`acknowledge_ethics_notification`), cancel (`cancel_ethics_notification`).
 */
export function EthicsNotificationsPanel({
  caseId,
  notifications,
}: {
  caseId: string;
  notifications: EthicsNotification[];
}) {
  return (
    <EthicsSection
      id="ethics-notifications"
      title="Notificações e prazos"
      description="Notificações formais do processo e seus prazos de resposta."
      actions={<IssueNotificationDialog caseId={caseId} />}
    >
      {notifications.length === 0 ? (
        <EthicsEmpty>Nenhuma notificação emitida.</EthicsEmpty>
      ) : (
        <ul className="flex flex-col gap-3">
          {notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} />
          ))}
        </ul>
      )}
    </EthicsSection>
  );
}

function NotificationRow({ notification: n }: { notification: EthicsNotification }) {
  const { run, isPending, error } = useEthicsAction();
  const canAct = n.status === "pending" || n.status === "sent";

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{NOTIFICATION_TYPE_LABELS[n.notificationType]}</span>
          <CaseStatusBadge
            label={NOTIFICATION_STATUS_LABELS[n.status]}
            colorToken={NOTIFICATION_STATUS_TOKENS[n.status]}
          />
        </div>
        {canAct && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => run(() => acknowledgeEthicsNotification(n.id))}
            >
              <Check aria-hidden="true" />
              Confirmar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => run(() => cancelEthicsNotification(n.id))}
            >
              <X aria-hidden="true" />
              Cancelar
            </Button>
          </div>
        )}
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <div className="flex gap-1">
          <dt>Via:</dt>
          <dd>{NOTIFICATION_METHOD_LABELS[n.deliveryMethod]}</dd>
        </div>
        {n.dueAt && (
          <div className="flex gap-1">
            <dt>Prazo:</dt>
            <dd className="font-medium text-foreground">{formatEthicsDateTime(n.dueAt)}</dd>
          </div>
        )}
        {n.acknowledgedAt && (
          <div className="flex gap-1">
            <dt>Confirmada em:</dt>
            <dd>{formatEthicsDateTime(n.acknowledgedAt)}</dd>
          </div>
        )}
      </dl>
      {n.notesMd && <MarkdownRenderer content={n.notesMd} className="text-sm" />}
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}

function IssueNotificationDialog({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<NotificationType>(NOTIFICATION_TYPE_OPTIONS[0].value);
  const [method, setMethod] = useState<NotificationDeliveryMethod>(
    NOTIFICATION_METHOD_OPTIONS[0].value,
  );
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const { run, isPending, error, clearError } = useEthicsAction();
  const typeIds = useFieldIds("ethics-notification-type");
  const methodIds = useFieldIds("ethics-notification-method");
  const dueIds = useFieldIds("ethics-notification-due");
  const notesIds = useFieldIds("ethics-notification-notes");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setType(NOTIFICATION_TYPE_OPTIONS[0].value);
      setMethod(NOTIFICATION_METHOD_OPTIONS[0].value);
      setDueAt("");
      setNotes("");
      clearError();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg">
          <BellPlus aria-hidden="true" />
          Emitir notificação
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Emitir notificação</DialogTitle>
          <DialogDescription>
            Registre uma notificação formal do processo. Um prazo alimenta os
            lembretes automáticos.
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={typeIds.controlProps.id}>Tipo</FieldLabel>
            <NativeSelect
              {...typeIds.controlProps}
              value={type}
              disabled={isPending}
              onChange={(e) => setType(e.target.value as NotificationType)}
            >
              {NOTIFICATION_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor={methodIds.controlProps.id}>Via de entrega</FieldLabel>
            <NativeSelect
              {...methodIds.controlProps}
              value={method}
              disabled={isPending}
              onChange={(e) =>
                setMethod(e.target.value as NotificationDeliveryMethod)
              }
            >
              {NOTIFICATION_METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={dueIds.controlProps.id}>Prazo (opcional)</FieldLabel>
          <Input
            {...dueIds.controlProps}
            type="datetime-local"
            value={dueAt}
            disabled={isPending}
            onChange={(e) => setDueAt(e.target.value)}
          />
          <FieldDescription>
            O prazo de resposta alimenta os lembretes do processo.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={notesIds.controlProps.id}>Observações (opcional)</FieldLabel>
          <Textarea
            {...notesIds.controlProps}
            value={notes}
            disabled={isPending}
            maxLength={2000}
            placeholder="Observações da notificação."
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            Voltar
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={isPending}
            onClick={() =>
              run(
                () =>
                  issueEthicsNotification({
                    caseId,
                    notificationType: type,
                    deliveryMethod: method,
                    dueAt: localDateTimeToIso(dueAt),
                    notesMd: notes.trim() === "" ? null : notes.trim(),
                  }),
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            {isPending ? "Emitindo…" : "Emitir notificação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  Pencil,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";

import type {
  CommissionMeetingType,
  MeetingDetail,
} from "@/lib/queries/meetings";
import {
  cancelMeeting,
  concludeMeeting,
  distributeMeeting,
  markMeetingHeld,
  reopenMeeting,
} from "@/lib/meetings/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMeetingAction } from "./use-meeting-action";
import { isEditableStatus, isTerminalMeetingStatus } from "./meeting-labels";
import { MeetingFormDialog } from "./meeting-form-dialog";

/**
 * Staff_admin lifecycle controls in the meeting detail header. Which actions
 * appear depends on the meeting status (the server re-enforces the state
 * machine; this is UX only):
 *  - `agendada` → **Editar** + **Marcar como realizada** (agendada→realizada) + **Concluir**
 *  - `realizada` → **Editar** + **Concluir** (→ em_assinatura)
 *  - `em_assinatura`/`assinada` → **Reabrir** (revokes signatures)
 *  - `assinada` → **Distribuir** (terminal)
 *  - any non-terminal → **Cancelar** (terminal)
 *
 * "Concluir" is offered in BOTH `agendada` and `realizada` (the `conclude_meeting`
 * RPC accepts both as a one-step shortcut). The typical flow is: Marcar como
 * realizada → draft minutes/agenda/attendees → Concluir → assinaturas.
 *
 * Mark-held/conclude/distribute/cancel/reopen are confirmed via dialogs; reopen
 * warns it revokes signatures. pt-BR errors surface inline.
 */
export function MeetingLifecycleActions({
  meeting,
  org,
  slug,
  commissionId,
  meetingTypes,
}: {
  meeting: MeetingDetail;
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  commissionId: string;
  meetingTypes: CommissionMeetingType[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const status = meeting.status;

  const canEdit = isEditableStatus(status);
  const canMarkHeld = status === "agendada";
  // The conclude RPC accepts BOTH agendada and realizada (one-step shortcut).
  const canConclude = status === "agendada" || status === "realizada";
  const canReopen = status === "em_assinatura" || status === "assinada";
  const canDistribute = status === "assinada";
  // No cancel edge from `assinada` — the state machine allows only
  // assinada→distribuida|realizada (QA Phase 10 MINOR-1).
  const canCancel = !isTerminalMeetingStatus(status) && status !== "assinada";

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      {canEdit && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => setEditOpen(true)}
        >
          <Pencil aria-hidden="true" />
          Editar
        </Button>
      )}

      {canMarkHeld && (
        <ConfirmActionButton
          trigger={
            <Button type="button" variant="outline" size="lg">
              <CalendarCheck aria-hidden="true" />
              Marcar como realizada
            </Button>
          }
          title="Marcar a reunião como realizada?"
          description="A reunião passará para “Realizada”. Você poderá registrar a ata, a pauta e a presença antes de enviá-la para assinatura. A reunião continua editável."
          confirmLabel="Marcar como realizada"
          action={() => markMeetingHeld(meeting.id)}
        />
      )}

      {canConclude && (
        <ConfirmActionButton
          trigger={
            <Button type="button" size="lg">
              <CheckCircle2 aria-hidden="true" />
              Concluir
            </Button>
          }
          title="Concluir a reunião?"
          description="A reunião passará para “Em assinatura”. O quórum será calculado e registrado, os casos vinculados serão lançados nas suas linhas do tempo, e a ata, a pauta e os participantes ficarão bloqueados para edição. É necessário ao menos um participante presente."
          confirmLabel="Concluir reunião"
          action={() => concludeMeeting(meeting.id)}
        />
      )}

      {canReopen && (
        <ConfirmActionButton
          trigger={
            <Button type="button" variant="outline" size="lg">
              <RotateCcw aria-hidden="true" />
              Reabrir
            </Button>
          }
          title="Reabrir a reunião?"
          description="A reunião voltará para “Realizada” e a ata, a pauta e os participantes poderão ser editados novamente. Todas as assinaturas já registradas serão revogadas."
          confirmLabel="Reabrir reunião"
          action={() => reopenMeeting(meeting.id)}
        />
      )}

      {canDistribute && (
        <ConfirmActionButton
          trigger={
            <Button type="button" size="lg">
              <Send aria-hidden="true" />
              Distribuir
            </Button>
          }
          title="Distribuir a ata?"
          description="A ata assinada será marcada como distribuída. Este é o estado final da reunião e não pode ser desfeito."
          confirmLabel="Distribuir ata"
          action={() => distributeMeeting(meeting.id)}
        />
      )}

      {canCancel && (
        <ConfirmActionButton
          trigger={
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="text-destructive hover:text-destructive"
            >
              <XCircle aria-hidden="true" />
              Cancelar
            </Button>
          }
          title="Cancelar a reunião?"
          description="A reunião passará para o estado final “Cancelada”. Esta ação não pode ser desfeita."
          confirmLabel="Cancelar reunião"
          action={() => cancelMeeting(meeting.id)}
        />
      )}

      <MeetingFormDialog
        mode="edit"
        open={editOpen}
        onOpenChange={setEditOpen}
        org={org} slug={slug}
        commissionId={commissionId}
        meetingTypes={meetingTypes}
        meeting={meeting}
      />
    </div>
  );
}

/**
 * A confirm-then-run lifecycle button. The trigger is supplied by the caller so
 * each transition keeps its own icon/variant; the dialog body explains the
 * consequence in pt-BR and surfaces an inline error on failure.
 */
function ConfirmActionButton({
  trigger,
  title,
  description,
  confirmLabel,
  action,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const { run, isPending, error } = useMeetingAction();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              // Keep the dialog logic simple: run the action; the route refresh
              // on success unmounts this. Prevent the default auto-close so a
              // failed action keeps the error visible.
              e.preventDefault();
              run(action);
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

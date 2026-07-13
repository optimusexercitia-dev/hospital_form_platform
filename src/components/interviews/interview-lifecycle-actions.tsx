"use client";

import { useState } from "react";
import { CheckCircle2, Pencil, RotateCcw, XCircle } from "lucide-react";

import type { InterviewDetail } from "@/lib/queries/interviews";
import {
  cancelInterview,
  concludeInterview,
  reopenInterview,
} from "@/lib/interviews/actions";
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
import { useInterviewAction } from "./use-interview-action";
import { isEditableInterviewStatus } from "./interview-labels";
import { InterviewFormDialog } from "./interview-form-dialog";
import type { InterviewPhaseOption } from "./interview-form-dialog";

/**
 * INTERVIEW-level lifecycle controls in the detail header (IV2 — ADR 0070).
 * Scheduling / start / complete now live on SESSIONS (the sessions panel); the
 * interview-level acts are only:
 *  - **Editar** — while unlocked (`rascunho`/`agendada`/`em_andamento`/`aguardando follow-up`)
 *  - **Concluir** — from `em_andamento` OR `aguardando follow-up` (needs ≥1 entrevistado)
 *  - **Reabrir** — from `concluida` (→ `em_andamento`)
 *  - **Cancelar** — from any non-terminal state (cascades non-terminal sessions)
 *
 * `cancelada` is the single terminal state; only `concluida` reopens. Rendered only
 * when the viewer may write (`viewerCanWrite`) — that includes a registered
 * interviewer who is a plain `staff` member, not just coordinators. pt-BR errors
 * surface inline; the server is the authority.
 */
export function InterviewLifecycleActions({
  interview,
  org,
  slug,
  caseId,
  phases,
}: {
  interview: InterviewDetail;
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  caseId: string;
  phases: InterviewPhaseOption[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const status = interview.status;

  const canEdit = isEditableInterviewStatus(status);
  const canConclude =
    status === "in_progress" || status === "awaiting_follow_up";
  const canReopen = status === "completed";
  const canCancel = status !== "completed" && status !== "cancelled";

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

      {canConclude && (
        <ConfirmActionButton
          trigger={
            <Button type="button" size="lg">
              <CheckCircle2 aria-hidden="true" />
              Concluir
            </Button>
          }
          title="Concluir a entrevista?"
          description="A entrevista passará para “Concluída”, será registrada na linha do tempo do caso e o conteúdo ficará bloqueado para edição. É necessário ao menos um entrevistado."
          confirmLabel="Concluir entrevista"
          action={() => concludeInterview(interview.id)}
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
          title="Reabrir a entrevista?"
          description="A entrevista voltará para “Em andamento” e o conteúdo poderá ser editado novamente. Ao concluir de novo, o registro na linha do tempo do caso será atualizado (sem duplicar)."
          confirmLabel="Reabrir entrevista"
          action={() => reopenInterview(interview.id)}
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
          title="Cancelar a entrevista?"
          description="A entrevista passará para o estado final “Cancelada” e as sessões ainda não realizadas também serão canceladas. Você poderá reabri-la depois, se necessário."
          confirmLabel="Cancelar entrevista"
          action={() => cancelInterview(interview.id)}
        />
      )}

      <InterviewFormDialog
        mode="edit"
        open={editOpen}
        onOpenChange={setEditOpen}
        org={org}
        slug={slug}
        caseId={caseId}
        phases={phases}
        interview={interview}
      />
    </div>
  );
}

/**
 * A confirm-then-run lifecycle button. The trigger is supplied by the caller so
 * each transition keeps its own icon/variant; the dialog body explains the
 * consequence in pt-BR and surfaces an inline error on failure. The server
 * re-checks the state machine.
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
  const { run, isPending, error } = useInterviewAction();
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
              // Keep it simple: run the action; the route refresh on success
              // unmounts this. Prevent the default auto-close so a failed action
              // keeps the error visible.
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

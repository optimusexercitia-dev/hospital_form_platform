"use client";

import { useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  MapPin,
  PenLine,
  Play,
  UserX,
  Video,
  XCircle,
} from "lucide-react";

import type { InterviewSession } from "@/lib/queries/interviews";
import type { ActionState } from "@/lib/interviews/actions";
import {
  cancelSession,
  completeSession,
  noShowSession,
  startSession,
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
import {
  InterviewModalityChip,
  SessionStatusBadge,
  SessionTypeChip,
} from "./interview-badges";
import { SessionForm } from "./session-form";
import { formatDateTime, formatSchedule } from "./format";

const FIELD_CLASS =
  "min-h-20 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** A session is terminal once completed / cancelled / no_show. */
function isTerminalSession(status: InterviewSession["status"]): boolean {
  return (
    status === "completed" || status === "cancelled" || status === "no_show"
  );
}

/**
 * A confirm-then-run session lifecycle button. The trigger keeps each transition's
 * own icon/variant; the dialog explains the consequence in pt-BR. Cancel / no-show
 * collect an optional reason (persisted on the session, never hard-deleted). The
 * server (RLS + the RPC state machine) is the authority — this is UX only.
 */
function SessionConfirmButton({
  trigger,
  title,
  description,
  confirmLabel,
  action,
  withReason = false,
  reasonLabel,
  reasonPlaceholder,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  action: (reason: string | null) => Promise<ActionState>;
  withReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
}) {
  const { run, isPending, error } = useInterviewAction();
  const [reason, setReason] = useState("");

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {withReason && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              {reasonLabel}{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={FIELD_CLASS}
              placeholder={reasonPlaceholder}
            />
          </label>
        )}
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
              // Prevent the default auto-close so a failed action keeps the error
              // visible; the route refresh on success unmounts this.
              e.preventDefault();
              run(() => action(reason.trim() || null));
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Per-session lifecycle controls, gated by the session's own status. */
function SessionActions({ session }: { session: InterviewSession }) {
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const { status } = session;

  if (isTerminalSession(status)) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status === "scheduled" && (
        <>
          <SessionConfirmButton
            trigger={
              <Button type="button" size="sm">
                <Play aria-hidden="true" />
                Iniciar
              </Button>
            }
            title="Iniciar a sessão?"
            description="A sessão passará para “Em andamento” e o horário de início será registrado. A entrevista passará para “Em andamento”."
            confirmLabel="Iniciar sessão"
            action={() => startSession(session.id)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRescheduleOpen(true)}
          >
            <PenLine aria-hidden="true" />
            Reagendar
          </Button>
        </>
      )}

      {status === "in_progress" && (
        <SessionConfirmButton
          trigger={
            <Button type="button" size="sm">
              <CheckCircle2 aria-hidden="true" />
              Concluir
            </Button>
          }
          title="Concluir a sessão?"
          description="A sessão passará para “Concluída” e o horário de término será registrado. Se houver outra sessão agendada, a entrevista aguardará o follow-up."
          confirmLabel="Concluir sessão"
          action={() => completeSession(session.id)}
        />
      )}

      <SessionConfirmButton
        trigger={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
          >
            <XCircle aria-hidden="true" />
            Cancelar
          </Button>
        }
        title="Cancelar a sessão?"
        description="A sessão passará para o estado final “Cancelada”. Ela permanece no histórico da entrevista."
        confirmLabel="Cancelar sessão"
        withReason
        reasonLabel="Motivo do cancelamento"
        reasonPlaceholder="Ex.: reagendada a pedido do entrevistado"
        action={(reason) => cancelSession(session.id, reason)}
      />

      {status === "scheduled" && (
        <SessionConfirmButton
          trigger={
            <Button type="button" variant="outline" size="sm">
              <UserX aria-hidden="true" />
              Não compareceu
            </Button>
          }
          title="Registrar não comparecimento?"
          description="A sessão passará para o estado final “Não compareceu”. Ela permanece no histórico da entrevista."
          confirmLabel="Registrar não comparecimento"
          withReason
          reasonLabel="Observação"
          reasonPlaceholder="Ex.: entrevistado não compareceu e não avisou"
          action={(reason) => noShowSession(session.id, reason)}
        />
      )}

      <SessionForm
        mode="edit"
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        session={session}
      />
    </div>
  );
}

function SessionRow({
  session,
  canEdit,
  index,
}: {
  session: InterviewSession;
  canEdit: boolean;
  index: number;
}) {
  const remote =
    session.modality === "remoto" || session.modality === "hibrido";

  return (
    <li
      className="flex animate-rise-in flex-col gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-4"
      style={{ "--rise-delay": `${index * 60}ms` } as React.CSSProperties}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          #{session.sequenceNumber}
        </span>
        <SessionTypeChip type={session.sessionType} />
        <SessionStatusBadge status={session.status} />
        {session.modality && <InterviewModalityChip modality={session.modality} />}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {session.scheduledStart ? (
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <CalendarClock aria-hidden="true" className="size-3.5" />
            {formatSchedule(session.scheduledStart, session.scheduledEnd)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock aria-hidden="true" className="size-3.5" />
            Sem data definida
          </span>
        )}
        {session.locationText && (
          <span className="inline-flex items-center gap-1.5">
            {remote ? (
              <Video aria-hidden="true" className="size-3.5" />
            ) : (
              <MapPin aria-hidden="true" className="size-3.5" />
            )}
            {session.locationText}
          </span>
        )}
        {session.meetingUrl && (
          <a
            href={session.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <ExternalLink aria-hidden="true" className="size-3" />
            Entrar na chamada
          </a>
        )}
      </div>

      {(session.actualStart || session.actualEnd) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
          {session.actualStart && (
            <span>Iniciada em {formatDateTime(session.actualStart)}</span>
          )}
          {session.actualEnd && (
            <span>Concluída em {formatDateTime(session.actualEnd)}</span>
          )}
        </div>
      )}

      {session.cancellationReason && (
        <p className="text-xs text-muted-foreground">
          Motivo: {session.cancellationReason}
        </p>
      )}

      {canEdit && <SessionActions session={session} />}
    </li>
  );
}

/**
 * The interview's SESSIONS panel (IV2 — ADR 0070): the ordered list of encounters,
 * each with its own status badge and lifecycle controls (iniciar / concluir /
 * reagendar / cancelar / não compareceu). The writer schedules new sessions from
 * here while the interview is unlocked; read-only otherwise. The interview status
 * is derived from these sessions on the server — this panel never mutates it
 * directly.
 */
export function SessionsPanel({
  interviewId,
  sessions,
  canEdit,
}: {
  interviewId: string;
  sessions: InterviewSession[];
  canEdit: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <section
      aria-labelledby="interview-sessions-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2 id="interview-sessions-heading" className="text-base font-semibold">
            Sessões
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {sessions.length}
          </span>
        </div>
        {canEdit && (
          <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
            <CalendarPlus aria-hidden="true" />
            Agendar sessão
          </Button>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {canEdit
            ? "Nenhuma sessão agendada. Agende o primeiro encontro desta entrevista."
            : "Nenhuma sessão agendada."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((s, i) => (
            <SessionRow key={s.id} session={s} canEdit={canEdit} index={i} />
          ))}
        </ul>
      )}

      {canEdit && (
        <SessionForm
          mode="create"
          open={addOpen}
          onOpenChange={setAddOpen}
          interviewId={interviewId}
        />
      )}
    </section>
  );
}

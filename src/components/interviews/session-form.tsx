"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  scheduleSession,
  updateSession,
  type ActionState,
  type SessionInput,
} from "@/lib/interviews/actions";
import type {
  InterviewModality,
  InterviewSession,
  SessionType,
} from "@/lib/queries/interviews";
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
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  MODALITY_LABEL,
  MODALITY_ORDER,
  SESSION_TYPE_LABEL,
  SESSION_TYPE_ORDER,
} from "./interview-labels";
import { toDateTimeLocalValue } from "./format";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** Convert a `datetime-local` value back to an ISO string (local tz); "" → null. */
function localToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Schedule a new session on an interview (`create`) OR reschedule/edit an existing,
 * non-terminal session (`edit`) — IV2 (ADR 0070). Collects the session kind,
 * modality, the planned start/end window, and (for a presencial/remoto/híbrido
 * session) a location + call link. A `written_response` (async) session hides the
 * modality/location/call fields and stores no modality.
 *
 * `scheduleSession` / `updateSession` run inside a transition; the pt-BR error stays
 * on screen and the route refreshes on success. The server (RLS + the RPC state
 * machine) is the authority — this is UX only.
 */
export function SessionForm({
  mode,
  open,
  onOpenChange,
  interviewId,
  session,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required for `create` (the parent interview). */
  interviewId?: string;
  /** Required for `edit`. */
  session?: InterviewSession;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState | null>(null);

  const startId = useId();
  const endId = useId();

  const [sessionType, setSessionType] = useState<SessionType>(
    session?.sessionType ?? "follow_up",
  );
  const [modality, setModality] = useState<InterviewModality>(
    session?.modality ?? "presencial",
  );
  const [start, setStart] = useState(
    toDateTimeLocalValue(session?.scheduledStart ?? null),
  );
  const [end, setEnd] = useState(
    toDateTimeLocalValue(session?.scheduledEnd ?? null),
  );
  const [locationText, setLocationText] = useState(session?.locationText ?? "");
  const [meetingUrl, setMeetingUrl] = useState(session?.meetingUrl ?? "");

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setSessionType(session?.sessionType ?? "follow_up");
      setModality(session?.modality ?? "presencial");
      setStart(toDateTimeLocalValue(session?.scheduledStart ?? null));
      setEnd(toDateTimeLocalValue(session?.scheduledEnd ?? null));
      setLocationText(session?.locationText ?? "");
      setMeetingUrl(session?.meetingUrl ?? "");
    }
  }

  useEffect(() => {
    if (!state?.ok) return;
    onOpenChange(false);
    router.refresh();
  }, [state, onOpenChange, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const written = sessionType === "written_response";
    const input: SessionInput = {
      sessionType,
      modality: written ? null : modality,
      scheduledStart: localToIso(start),
      scheduledEnd: localToIso(end),
      locationText: written ? null : locationText.trim() || null,
      meetingUrl: written ? null : meetingUrl.trim() || null,
    };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await scheduleSession(interviewId!, input)
          : await updateSession(session!.id, input);
      setState(result);
    });
  }

  const showRemoteFields = modality === "remoto" || modality === "hibrido";
  const written = sessionType === "written_response";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Agendar sessão" : "Reagendar sessão"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Agende um encontro desta entrevista. Você poderá iniciá-lo e concluí-lo depois."
              : "Ajuste o tipo, a modalidade ou o horário planejado desta sessão."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Tipo de sessão</span>
            <NativeSelect
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value as SessionType)}
              className="h-10"
            >
              {SESSION_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {SESSION_TYPE_LABEL[t]}
                </option>
              ))}
            </NativeSelect>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 text-sm">
              <label id={`${startId}-label`} htmlFor={startId} className="font-medium">
                Início{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </label>
              <DateTimePicker
                id={startId}
                labelId={`${startId}-label`}
                value={start}
                onChange={setStart}
              />
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              <label id={`${endId}-label`} htmlFor={endId} className="font-medium">
                Término{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </label>
              <DateTimePicker
                id={endId}
                labelId={`${endId}-label`}
                value={end}
                onChange={setEnd}
              />
            </div>
          </div>

          {!written && (
            <fieldset className="flex flex-col gap-1.5 text-sm">
              <legend className="font-medium">Modalidade</legend>
              <div className="flex flex-wrap gap-1.5">
                {MODALITY_ORDER.map((m) => {
                  const selected = modality === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setModality(m)}
                      className={
                        "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none " +
                        (selected
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border text-muted-foreground hover:text-foreground")
                      }
                    >
                      {MODALITY_LABEL[m]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {!written && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Local{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </span>
              <input
                type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                className={FIELD_CLASS}
                placeholder="Ex.: Sala da comissão — 2º andar"
              />
            </label>
          )}

          {!written && showRemoteFields && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Link da chamada{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </span>
              <input
                type="url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                className={FIELD_CLASS}
                placeholder="https://…"
              />
            </label>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending
                ? "Salvando…"
                : mode === "create"
                  ? "Agendar sessão"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

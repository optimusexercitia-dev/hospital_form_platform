"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Pencil } from "lucide-react";

import type { MeetingDetail } from "@/lib/queries/meetings";
import { setMeetingHeldWindow } from "@/lib/meetings/actions";
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
import { useMeetingAction } from "./use-meeting-action";
import { HeldWindowFields, useHeldWindowState } from "./held-window-fields";
import { formatSchedule } from "./format";

/**
 * The header's "Realizada em: …" line plus its correction affordance (F3, ADR
 * 0062). Shown only when the parent decides it (coordinator + status
 * `realizada`); once a meeting is concluded (`em_assinatura`+) the window is
 * read-only and the parent renders the plain read-only variant instead.
 *
 * The edit writes ONLY `held_*` (never the schedule) via `setMeetingHeldWindow`;
 * `held_at` is clearable (sent as `null`).
 */
export function MeetingHeldEdit({ meeting }: { meeting: MeetingDetail }) {
  const [open, setOpen] = useState(false);
  const { run, isPending, error, clearError } = useMeetingAction();
  const { start, setStart, end, setEnd, held } = useHeldWindowState(meeting);

  // Reset the error when the dialog opens (the fields reseed on remount).
  useEffect(() => {
    if (open) clearError();
  }, [open, clearError]);

  function handleSave() {
    run(() => setMeetingHeldWindow(meeting.id, held), {
      onSuccess: () => setOpen(false),
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <CalendarCheck aria-hidden="true" className="size-4" />
      {meeting.heldAt ? (
        <span className="tabular-nums">
          Realizada em: {formatSchedule(meeting.heldAt, meeting.heldEnd)}
        </span>
      ) : (
        <span className="text-muted-foreground">
          Realização não registrada
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 gap-1 px-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Pencil aria-hidden="true" className="size-3.5" />
        {meeting.heldAt ? "Editar" : "Registrar"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Data de realização</DialogTitle>
            <DialogDescription>
              Registre quando a reunião efetivamente ocorreu. Isto não altera a
              data agendada.
            </DialogDescription>
          </DialogHeader>

          {error && <FormBanner tone="error">{error}</FormBanner>}

          <HeldWindowFields
            start={start}
            onStartChange={setStart}
            end={end}
            onEndChange={setEnd}
            scheduledStart={meeting.scheduledStart}
            disabled={isPending}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}

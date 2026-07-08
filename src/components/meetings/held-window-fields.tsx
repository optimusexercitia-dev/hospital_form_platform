"use client";

import { useId, useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";

import type { MeetingHeldWindow } from "@/lib/meetings/actions";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { toDateTimeLocalValue } from "./format";

/**
 * Actual-occurrence window fields (ADR 0062) — a start + optional end
 * `DateTimePicker` pair, shared by the "Marcar como realizada" / "Concluir"
 * transition dialogs (F2) and the header correction dialog (F3).
 *
 * `held_at` is CLEARABLE: an empty start means "not recorded now" and is sent to
 * the server as `null` (product decision — allow-null, fill-later). A large
 * divergence from the schedule surfaces a NON-BLOCKING hint (F4); the server
 * never blocks on it.
 */

/** ~1 day in ms — the divergence threshold for the non-blocking hint (F4). */
const DIVERGENCE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** A `datetime-local` value ("YYYY-MM-DDTHH:mm", local tz) → ISO; "" → null. */
function localToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** True when an ISO timestamp is strictly in the future (vs now). */
function isFuture(iso: string | null): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t > Date.now();
}

/**
 * Controlled state for the held-window fields. Seeds start/end from
 * `scheduledStart` / `scheduledEnd` (the picker default per ADR 0062), and
 * exposes the ISO {@link MeetingHeldWindow} the action expects.
 */
export function useHeldWindowState(meeting: {
  scheduledStart: string;
  scheduledEnd: string | null;
  heldAt: string | null;
  heldEnd: string | null;
}) {
  // Correction (F3) starts from the recorded held window when present; the
  // transition dialogs (F2) have no held window yet, so both fall back to the
  // schedule as the sensible default — EXCEPT when the schedule is still in the
  // FUTURE. A meeting is commonly marked held before its scheduled time passes;
  // pre-filling a future `held_at` would be rejected by the server (HC082), so
  // we default to BLANK there. Blank → `held_at=null` (allow-null, fill-later),
  // and the coordinator sets the real occurrence time afterward via the header.
  const seedStart =
    meeting.heldAt ??
    (isFuture(meeting.scheduledStart) ? null : meeting.scheduledStart);
  // Only seed the end when we also seeded a start (blank start = blank window).
  const seedEnd = seedStart ? (meeting.heldEnd ?? meeting.scheduledEnd) : null;

  const [start, setStart] = useState(toDateTimeLocalValue(seedStart));
  const [end, setEnd] = useState(toDateTimeLocalValue(seedEnd));

  const held: MeetingHeldWindow = useMemo(
    () => ({ heldAt: localToIso(start), heldEnd: localToIso(end) }),
    [start, end],
  );

  return { start, setStart, end, setEnd, held };
}

/**
 * The visual fields. Fully controlled by {@link useHeldWindowState}. The start is
 * clearable; clearing it means "não registrar agora". The optional end enables
 * real-duration stats. A divergence hint appears when the chosen start is more
 * than ~1 day from the schedule.
 */
export function HeldWindowFields({
  start,
  onStartChange,
  end,
  onEndChange,
  scheduledStart,
  disabled,
}: {
  start: string;
  onStartChange: (value: string) => void;
  end: string;
  onEndChange: (value: string) => void;
  /** ISO scheduled start, for the divergence comparison. */
  scheduledStart: string;
  disabled?: boolean;
}) {
  const startId = useId();
  const endId = useId();
  const helpId = useId();
  const hintId = useId();

  const diverges = useMemo(() => {
    if (!start) return false;
    const chosen = new Date(start);
    const scheduled = new Date(scheduledStart);
    if (Number.isNaN(chosen.getTime()) || Number.isNaN(scheduled.getTime())) {
      return false;
    }
    return (
      Math.abs(chosen.getTime() - scheduled.getTime()) > DIVERGENCE_THRESHOLD_MS
    );
  }, [start, scheduledStart]);

  return (
    <div className="flex flex-col gap-3">
      <p id={helpId} className="text-sm text-muted-foreground text-pretty">
        Data e hora em que a reunião efetivamente ocorreu.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 text-sm">
          <label htmlFor={startId} className="font-medium">
            Início
          </label>
          <DateTimePicker
            id={startId}
            value={start}
            onChange={onStartChange}
            clearable
            disabled={disabled}
            aria-describedby={diverges ? `${helpId} ${hintId}` : helpId}
          />
        </div>

        <div className="flex flex-col gap-1.5 text-sm">
          <label htmlFor={endId} className="font-medium">
            Término{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <DateTimePicker
            id={endId}
            value={end}
            onChange={onEndChange}
            clearable
            disabled={disabled}
          />
        </div>
      </div>

      {diverges && (
        <p
          id={hintId}
          className="flex items-start gap-1.5 text-sm text-warning"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="text-pretty">
            A data informada está distante da data agendada. Confirme se está
            correta.
          </span>
        </p>
      )}
    </div>
  );
}

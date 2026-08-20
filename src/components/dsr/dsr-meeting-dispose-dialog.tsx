"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";

import { disposeMeetingMinutesTask } from "@/lib/dsr/actions";
import {
  DSR_MEETING_DISPOSAL_WARNING,
  DSR_MEETING_RESIDUE_RETAINED,
  DSR_MESSAGES,
  DSR_RESIDUE_NOTICE,
} from "@/lib/dsr/messages";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** The exact phrase the operator must type to arm the irreversible erasure. */
const CONFIRM_PHRASE = "APAGAR";

/**
 * The MEETINGS DISPOSAL affordance — ADR 0056 Consequence (a)'s never-built UI,
 * discharged here (ADR 0130 Amendment 2 item 3 moved it from Slice 2 to Slice 3,
 * because before adjudication existed there was no way to mint the task and the
 * button would have been a door nothing could reach).
 *
 * ⛔ THIS IS THE MOST DANGEROUS BUTTON IN THE MODULE, and the reason it is gated
 * behind a human adjudication rather than the intake fan-out:
 * `dispose_meeting_minutes` erases the WHOLE minutes — the minutes text plus every
 * agenda item's description, discussion notes and resolution. Firing it because one
 * agenda item touched the subject's case would destroy OTHER COMMITTEES' unrelated
 * records. That is precisely why the fan-out mints `attest_review` instead and why
 * only a deliberate, per-meeting escalation reaches this component.
 *
 * {@link DSR_MEETING_DISPOSAL_WARNING} is therefore rendered at the TOP of the
 * dialog, in destructive tone, before any control — not as a footnote under the
 * confirm button. It is the only thing standing between the operator and other
 * committees' records.
 *
 * ⚠ COPY DISCIPLINE. This reuses the STRUCTURE of `referral-dispose-dialog.tsx`
 * (AlertDialog + type-to-confirm arming + destructive footer) and none of its bespoke
 * copy: what ships here is the narrowed {@link DSR_RESIDUE_NOTICE}, decided ONCE
 * centrally (ADR 0130 Decision 9 / Q12a) and rendered verbatim. Slice 4 brought the
 * referral dialog onto that same constant, closing `FUP-DISPOSE-DIALOG-OVERCLAIM`: its
 * copy had promised a permanent wipe of every sensitive field while saying nothing
 * about retained encrypted attachments, the PITR window, or already-distributed
 * copies — the over-claim ADR 0056's narrowed closure forbids. Both surfaces now draw
 * their language from one file.
 *
 * ⚠ The offending pt-BR strings are deliberately NOT quoted here: that follow-up is
 * verified by a grep over `src/`, which prose about the over-claim would trip as
 * readily as the over-claim itself. The prohibition is repo-wide, not file-local.
 *
 * ⛔ THE DSR NEVER FIRES A DOOR ON THE EXECUTOR'S BEHALF (ADR 0130 Decision 2).
 * `disposeMeetingMinutesTask` calls `dispose_meeting_minutes` under the CALLER'S OWN
 * SESSION — its gate (`is_staff_admin_of` OR `is_tenancy_admin_of` of the meeting's
 * commission) applies unchanged and did not move for this program. A caller who
 * cannot pass it sees that door's own pt-BR refusal, surfaced here rather than
 * hidden.
 */
export function DsrMeetingDisposeDialog({
  org,
  taskId,
  meetingId,
  label,
}: {
  org: string;
  taskId: string;
  meetingId: string;
  /** A PHI-free descriptor of the meeting (code/date) — never a person. */
  label: string;
}) {
  const router = useRouter();
  const confirmId = useId();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const armed = confirmText.trim().toUpperCase() === CONFIRM_PHRASE;

  function reset() {
    setConfirmText("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function handleDispose() {
    if (!armed) return;
    setError(null);
    startTransition(async () => {
      const result = await disposeMeetingMinutesTask({ org, taskId, meetingId });
      if (!result.ok) {
        // The module door's own pt-BR refusal, surfaced — never hidden, and never
        // a raw Postgres error (CLAUDE.md §8).
        setError(result.error ?? DSR_MESSAGES.unexpected);
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 aria-hidden="true" />
          Descartar a ata
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Descartar a ata inteira desta reunião?</AlertDialogTitle>
          <AlertDialogDescription>{label}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-4">
          {/* ⛔ THE WARNING, FIRST AND UNMISSABLE. Not a footnote. */}
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/8 p-3.5">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-destructive"
            />
            <p className="text-sm font-medium text-destructive text-pretty">
              {DSR_MEETING_DISPOSAL_WARNING}
            </p>
          </div>

          {/* The narrowed residue language — verbatim, never improvised. */}
          <div className="flex flex-col gap-1.5">
            <h4 className="text-xs font-semibold tracking-wide uppercase">
              O que o descarte apaga — e o que permanece
            </h4>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-xs text-muted-foreground">
              {DSR_RESIDUE_NOTICE.map((line) => (
                <li key={line} className="text-pretty">
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {/* ⛔ BESIDE the shared notice, never merged into it (ADR 0056 Amdt 1).
              `DSR_RESIDUE_NOTICE` is rendered by the referral and case lanes too,
              where a claim about meeting titles or signature notes would be FALSE. */}
          <div className="flex flex-col gap-1.5">
            <h4 className="text-xs font-semibold tracking-wide uppercase">
              Nesta ata, também permanecem
            </h4>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-xs text-muted-foreground">
              {DSR_MEETING_RESIDUE_RETAINED.map((line) => (
                <li key={line} className="text-pretty">
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={confirmId} className="text-sm font-medium">
              Digite <span className="font-mono">{CONFIRM_PHRASE}</span> para
              confirmar
            </label>
            <input
              id={confirmId}
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={isPending}
              autoComplete="off"
              aria-describedby={`${confirmId}-help`}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p
              id={`${confirmId}-help`}
              className="text-xs text-muted-foreground text-pretty"
            >
              Confirmação exigida: o descarte atinge registros de outras comissões
              e não pode ser desfeito.
            </p>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-sm font-medium text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Cancelar
            </Button>
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending || !armed}
            onClick={handleDispose}
          >
            {isPending ? "Apagando…" : "Apagar a ata definitivamente"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

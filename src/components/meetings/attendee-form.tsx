"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addMeetingAttendee,
  updateMeetingAttendee,
  type ActionState,
  type AddAttendeeState,
  type AttendeeInput,
} from "@/lib/meetings/actions";
import type {
  AttendanceStatus,
  AttendeeRole,
  MeetingAttendee,
} from "@/lib/queries/meetings";
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
import {
  ATTENDANCE_LABEL,
  ATTENDANCE_ORDER,
  ATTENDEE_ROLE_LABEL,
  ATTENDEE_ROLE_ORDER,
} from "./meeting-labels";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** A platform-member option for the picker (already filtered to non-attendees on add). */
export interface AttendeeMemberOption {
  userId: string;
  name: string;
}

type Kind = "member" | "guest";

/**
 * Add / edit a meeting attendee (F3): a platform MEMBER (picked from the roster)
 * XOR an external GUEST (free-text name + org). Both carry a `role` and an
 * `attendance` state. On edit, the kind is fixed (you cannot turn a member into a
 * guest); on add, a toggle chooses which.
 */
export function AttendeeForm({
  mode,
  open,
  onOpenChange,
  meetingId,
  attendee,
  members,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  /** Required for `edit`. */
  attendee?: MeetingAttendee;
  /** Members available to add (already excludes those already attending, on create). */
  members: AttendeeMemberOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<(AddAttendeeState & ActionState) | null>(
    null,
  );

  const initialKind: Kind =
    mode === "edit" && attendee && attendee.userId == null ? "guest" : "member";
  const [kind, setKind] = useState<Kind>(initialKind);
  const [userId, setUserId] = useState(attendee?.userId ?? "");
  const [externalName, setExternalName] = useState(
    attendee?.externalName ?? "",
  );
  const [externalOrg, setExternalOrg] = useState(attendee?.externalOrg ?? "");
  const [role, setRole] = useState<AttendeeRole>(attendee?.role ?? "membro");
  const [attendance, setAttendance] = useState<AttendanceStatus>(
    attendee?.attendance ?? "convocado",
  );
  const [note, setNote] = useState(attendee?.note ?? "");

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setKind(initialKind);
      setUserId(attendee?.userId ?? "");
      setExternalName(attendee?.externalName ?? "");
      setExternalOrg(attendee?.externalOrg ?? "");
      setRole(attendee?.role ?? "membro");
      setAttendance(attendee?.attendance ?? "convocado");
      setNote(attendee?.note ?? "");
    }
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  // On edit a guest defaults role to "convidado"; keep it editable though.
  const lockKind = mode === "edit";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isGuest = kind === "guest";
    const input: AttendeeInput = {
      userId: isGuest ? null : userId || null,
      externalName: isGuest ? externalName.trim() || null : null,
      externalOrg: isGuest ? externalOrg.trim() || null : null,
      role,
      attendance,
      note: note.trim() || null,
    };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await addMeetingAttendee(meetingId, input)
          : await updateMeetingAttendee(attendee!.id, input);
      setState(result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Adicionar participante" : "Editar participante"}
          </DialogTitle>
          <DialogDescription>
            Adicione um membro da comissão ou um convidado externo, e registre sua
            função e presença.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          {!lockKind && (
            <fieldset className="flex flex-col gap-1.5 text-sm">
              <legend className="font-medium">Tipo de participante</legend>
              <div className="flex gap-1.5">
                {(
                  [
                    ["member", "Membro da comissão"],
                    ["guest", "Convidado externo"],
                  ] as const
                ).map(([k, label]) => {
                  const selected = kind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setKind(k)}
                      className={
                        "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none " +
                        (selected
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border text-muted-foreground hover:text-foreground")
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {kind === "member" ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Membro</span>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
                disabled={lockKind}
                className={FIELD_CLASS}
              >
                <option value="" disabled>
                  Selecione um membro…
                </option>
                {/* When editing, the current member may not be in `members`
                    (it is excluded as already-attending), so include it. */}
                {mode === "edit" && attendee?.userId && (
                  <option value={attendee.userId}>
                    {attendee.displayName ?? "Membro"}
                  </option>
                )}
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Nome do convidado</span>
                <input
                  type="text"
                  value={externalName}
                  onChange={(e) => setExternalName(e.target.value)}
                  required
                  className={FIELD_CLASS}
                  placeholder="Ex.: Dra. Ana Lima"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">
                  Organização{" "}
                  <span className="font-normal text-muted-foreground">
                    (opcional)
                  </span>
                </span>
                <input
                  type="text"
                  value={externalOrg}
                  onChange={(e) => setExternalOrg(e.target.value)}
                  className={FIELD_CLASS}
                  placeholder="Ex.: Laboratório central"
                />
              </label>
            </>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Função</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AttendeeRole)}
                className={FIELD_CLASS}
              >
                {ATTENDEE_ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {ATTENDEE_ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Presença</span>
              <select
                value={attendance}
                onChange={(e) =>
                  setAttendance(e.target.value as AttendanceStatus)
                }
                className={FIELD_CLASS}
              >
                {ATTENDANCE_ORDER.map((a) => (
                  <option key={a} value={a}>
                    {ATTENDANCE_LABEL[a]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Observação{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={FIELD_CLASS}
              placeholder="Ex.: justificativa da ausência"
            />
          </label>

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
                  ? "Adicionar"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

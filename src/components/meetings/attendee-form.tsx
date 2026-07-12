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
import { NativeSelect } from "@/components/ui/native-select";
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
    attendee?.attendance ?? "summoned",
  );
  const [note, setNote] = useState(attendee?.note ?? "");
  // Client-side guard for the member picker: the `<select>` is `required`, but the
  // form sets `noValidate`, so the native guard never fires. Without this, a "member"
  // attendee with no selection is sent with `userId: null` and lands as a GUEST row
  // (user_id null) — silently excluded from quorum, which later makes "Concluir"
  // raise HC034. Applies to both add and edit.
  const [memberError, setMemberError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setMemberError(null);
      setKind(initialKind);
      setUserId(attendee?.userId ?? "");
      setExternalName(attendee?.externalName ?? "");
      setExternalOrg(attendee?.externalOrg ?? "");
      setRole(attendee?.role ?? "membro");
      setAttendance(attendee?.attendance ?? "summoned");
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
    // Block a "member" attendee with no member selected (the required-but-noValidate
    // select). Surface a field error instead of sending a userId-less guest row.
    if (!isGuest && !userId) {
      setMemberError("Selecione um membro.");
      return;
    }
    setMemberError(null);
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
              <NativeSelect
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  if (e.target.value) setMemberError(null);
                }}
                required
                disabled={lockKind}
                className="h-10"
                aria-invalid={memberError ? true : undefined}
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
              </NativeSelect>
              {memberError && (
                <span role="alert" className="text-sm font-medium text-destructive">
                  {memberError}
                </span>
              )}
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
              <NativeSelect
                value={role}
                onChange={(e) => setRole(e.target.value as AttendeeRole)}
                className="h-10"
              >
                {ATTENDEE_ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {ATTENDEE_ROLE_LABEL[r]}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Presença</span>
              <NativeSelect
                value={attendance}
                onChange={(e) =>
                  setAttendance(e.target.value as AttendanceStatus)
                }
                className="h-10"
              >
                {ATTENDANCE_ORDER.map((a) => (
                  <option key={a} value={a}>
                    {ATTENDANCE_LABEL[a]}
                  </option>
                ))}
              </NativeSelect>
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

"use client";

import { commissionHref } from "@/lib/routing";
import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";

import {
  createMeeting,
  seedExpectedAttendees,
  seedSelectedAttendees,
  updateMeeting,
  type ActionState,
  type CreateMeetingState,
  type MeetingInput,
} from "@/lib/meetings/actions";
import type {
  CommissionMeetingType,
  MeetingDetail,
  MeetingModality,
} from "@/lib/queries/meetings";
import type { MemberListItem } from "@/lib/queries/members";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { PhiInputHint } from "@/components/ui/phi-input-hint";
import { MODALITY_LABEL, MODALITY_ORDER } from "./meeting-labels";
import { toDateTimeLocalValue } from "./format";

/** Label + fallback for a member in the participants checklist. */
function memberLabel(m: MemberListItem): string {
  return m.fullName?.trim() || m.email || "Membro sem nome";
}

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
 * Schedule a new meeting OR edit an existing meeting header (F1). Arg-based
 * actions (`createMeeting` / `updateMeeting`) run inside a transition; errors stay
 * on screen and the route refreshes on success. On create we navigate into the
 * new meeting's detail.
 *
 * Editing is only offered while the meeting is unlocked (`agendada`/`realizada`);
 * the parent decides whether to render the edit trigger, and the server re-checks.
 */
export function MeetingFormDialog({
  mode,
  open,
  onOpenChange,
  org,
  slug,
  commissionId,
  meetingTypes,
  members = [],
  meeting,
  initialValues,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  commissionId: string;
  meetingTypes: CommissionMeetingType[];
  /**
   * The commission's members — the "Participantes" picker for CREATE mode (plan
   * step H). Server-loaded and passed in (client can't call the server query).
   * `[]` / omitted → the section is not shown (edit mode never shows it).
   */
  members?: MemberListItem[];
  /** Required for `edit`. */
  meeting?: MeetingDetail;
  /**
   * CREATE-mode prefill for a suggestion that has no `MeetingDetail` yet — e.g. MIN's
   * F3 "Agendar próxima reunião" (ADR 0099 D7), seeded from an advisory next-meeting
   * suggestion rather than an existing row. Ignored when `mode !== "create"` or when
   * `meeting` is present (edit always wins). Omitted → defaults exactly as today.
   */
  initialValues?: { title?: string; scheduledStart?: string; locationText?: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<(CreateMeetingState & ActionState) | null>(
    null,
  );

  // Ids wire each field's <label> to the DateTimePicker's date control. The
  // label must NOT wrap the picker: a native <label> forwards a tap to its first
  // labelable control (the date button), so tapping the react-aria time segments
  // — which are not labelable — would open the date calendar. `htmlFor` keeps the
  // segments outside any label (time is keyboard-only; no picker on tap).
  const startId = useId();
  const endId = useId();

  // Participants (CREATE only): default = convocar TODOS os membros (zero-config).
  // Toggling off reveals a checklist to pick a subset (the "Convocados").
  const allUserIds = members.map((m) => m.userId);
  const [convocarTodos, setConvocarTodos] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(allUserIds);

  // Create-mode prefill: `meeting` (edit) always wins; `initialValues` only applies
  // when creating from a suggestion (e.g. MIN's "Agendar próxima reunião").
  const seedTitle = meeting?.title ?? (mode === "create" ? initialValues?.title : undefined) ?? "";
  const seedStart =
    meeting?.scheduledStart ??
    (mode === "create" ? initialValues?.scheduledStart : undefined) ??
    null;
  const seedLocation =
    meeting?.locationText ?? (mode === "create" ? initialValues?.locationText : undefined) ?? "";

  const [title, setTitle] = useState(seedTitle);
  const [meetingTypeId, setMeetingTypeId] = useState(
    meeting?.meetingTypeId ?? "",
  );
  const [modality, setModality] = useState<MeetingModality>(
    meeting?.modality ?? "presencial",
  );
  const [start, setStart] = useState(toDateTimeLocalValue(seedStart));
  const [end, setEnd] = useState(
    toDateTimeLocalValue(meeting?.scheduledEnd ?? null),
  );
  const [locationText, setLocationText] = useState(seedLocation);
  const [meetingUrl, setMeetingUrl] = useState(meeting?.meetingUrl ?? "");

  // Reset local state each time the dialog opens (render-phase prop-sync).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setTitle(seedTitle);
      setMeetingTypeId(meeting?.meetingTypeId ?? "");
      setModality(meeting?.modality ?? "presencial");
      setStart(toDateTimeLocalValue(seedStart));
      setEnd(toDateTimeLocalValue(meeting?.scheduledEnd ?? null));
      setLocationText(seedLocation);
      setMeetingUrl(meeting?.meetingUrl ?? "");
      // Participants reset to the zero-config default (convocar todos).
      setConvocarTodos(true);
      setSelectedUserIds(allUserIds);
    }
  }

  useEffect(() => {
    if (!state?.ok) return;
    if (mode === "create" && state.meetingId) {
      router.push(commissionHref(org, slug, "meetings", state.meetingId));
      return;
    }
    onOpenChange(false);
    router.refresh();
  }, [state, mode, org, slug, router, onOpenChange]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: MeetingInput = {
      title: title.trim(),
      meetingTypeId: meetingTypeId || null,
      scheduledStart: localToIso(start) ?? "",
      scheduledEnd: localToIso(end),
      modality,
      locationText: locationText.trim() || null,
      meetingUrl: meetingUrl.trim() || null,
    };
    startTransition(async () => {
      if (mode !== "create") {
        setState(await updateMeeting(meeting!.id, input));
        return;
      }
      const result = await createMeeting(commissionId, input);
      // Seed the participants BEFORE navigating into the new meeting, so the
      // detail page renders with its Convocados already present. A seed failure
      // is NON-FATAL (the meeting exists; attendees can be added on the detail
      // page), so we do not block navigation on it.
      //
      // "All" → `seedExpectedAttendees(meetingId)` (the RPC seeds every commission
      // member server-side; no id list needed). Subset → `seedSelectedAttendees`
      // with the chosen user ids (the RPC ignores non-members).
      if (result.ok && result.meetingId && members.length > 0) {
        if (convocarTodos) {
          await seedExpectedAttendees(result.meetingId);
        } else if (selectedUserIds.length > 0) {
          await seedSelectedAttendees(result.meetingId, selectedUserIds);
        }
      }
      setState(result);
    });
  }

  const showRemoteFields = modality === "remoto" || modality === "hibrido";
  // The Participantes picker is a CREATE-only affordance and needs a member list.
  const showParticipants = mode === "create" && members.length > 0;

  function toggleMember(userId: string, checked: boolean) {
    setSelectedUserIds((prev) =>
      checked ? [...prev, userId] : prev.filter((id) => id !== userId),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nova reunião" : "Editar reunião"}
          </DialogTitle>
          <DialogDescription>
            Agende a reunião e seus dados. Nunca inclua dados de paciente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && !state.fieldErrors?.title && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <PhiInputHint>
            {(hintId) => (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Título</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className={FIELD_CLASS}
                  placeholder="Ex.: Reunião ordinária de junho"
                  aria-invalid={state?.fieldErrors?.title ? true : undefined}
                  aria-describedby={hintId}
                />
                {state?.fieldErrors?.title && (
                  <span role="alert" className="text-sm font-medium text-destructive">
                    {state.fieldErrors.title}
                  </span>
                )}
              </label>
            )}
          </PhiInputHint>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Tipo{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <NativeSelect
              value={meetingTypeId}
              onChange={(e) => setMeetingTypeId(e.target.value)}
              className="h-10"
            >
              <option value="">Sem tipo</option>
              {meetingTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </label>

          <div className="grid grid-cols-1 gap-4">
            <div className="flex flex-col gap-1.5 text-sm">
              <label id={`${startId}-label`} htmlFor={startId} className="font-medium">
                Início
              </label>
              <DateTimePicker
                id={startId}
                labelId={`${startId}-label`}
                value={start}
                onChange={setStart}
                required
                aria-invalid={
                  state?.fieldErrors?.scheduledStart ? true : undefined
                }
              />
              {state?.fieldErrors?.scheduledStart && (
                <span
                  role="alert"
                  className="text-sm font-medium text-destructive"
                >
                  {state.fieldErrors.scheduledStart}
                </span>
              )}
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
                aria-invalid={
                  state?.fieldErrors?.scheduledEnd ? true : undefined
                }
              />
              {state?.fieldErrors?.scheduledEnd && (
                <span
                  role="alert"
                  className="text-sm font-medium text-destructive"
                >
                  {state.fieldErrors.scheduledEnd}
                </span>
              )}
            </div>
          </div>

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

          {showParticipants && (
            <fieldset className="flex flex-col gap-2.5 rounded-xl border border-border bg-muted/30 p-4 text-sm">
              <legend className="px-1 font-medium">Participantes</legend>

              <label className="flex items-start gap-2.5">
                <Checkbox
                  checked={convocarTodos}
                  onCheckedChange={(c) => setConvocarTodos(c === true)}
                  className="mt-0.5"
                />
                <span className="flex flex-col">
                  <span className="font-medium">
                    Convocar todos os membros
                  </span>
                  <span className="text-xs text-muted-foreground text-pretty">
                    Todos os {members.length}{" "}
                    {members.length === 1 ? "membro" : "membros"} da comissão
                    serão convocados. Desmarque para escolher quem convocar.
                  </span>
                </span>
              </label>

              {!convocarTodos && (
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground">
                    {selectedUserIds.length}{" "}
                    {selectedUserIds.length === 1
                      ? "membro convocado"
                      : "membros convocados"}
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {members.map((m) => {
                      const checked = selectedUserIds.includes(m.userId);
                      return (
                        <li key={m.userId}>
                          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:bg-accent/40">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) =>
                                toggleMember(m.userId, c === true)
                              }
                            />
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate font-medium">
                                {memberLabel(m)}
                              </span>
                              {m.titleName && (
                                <span className="truncate text-xs text-muted-foreground">
                                  {m.titleName}
                                </span>
                              )}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  {selectedUserIds.length === 0 && (
                    <p className="text-xs text-muted-foreground text-pretty">
                      Nenhum membro selecionado — a reunião será criada sem
                      convocados. Você poderá adicioná-los depois.
                    </p>
                  )}
                </div>
              )}
            </fieldset>
          )}

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
              placeholder="Ex.: Sala de reuniões — 3º andar"
            />
          </label>

          {showRemoteFields && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Link da reunião{" "}
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
                aria-invalid={state?.fieldErrors?.meetingUrl ? true : undefined}
              />
              {state?.fieldErrors?.meetingUrl && (
                <span
                  role="alert"
                  className="text-sm font-medium text-destructive"
                >
                  {state.fieldErrors.meetingUrl}
                </span>
              )}
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
                  ? "Agendar reunião"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The "Nova reunião" trigger button (list view, staff_admin only). Owns its own
 * dialog open state so the list page stays a Server Component.
 */
export function NewMeetingButton({
  org,
  slug,
  commissionId,
  meetingTypes,
  members = [],
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  commissionId: string;
  meetingTypes: CommissionMeetingType[];
  /** The commission's members for the "Participantes" picker (server-loaded). */
  members?: MemberListItem[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <CalendarPlus aria-hidden="true" />
        Nova reunião
      </Button>
      <MeetingFormDialog
        mode="create"
        open={open}
        onOpenChange={setOpen}
        org={org} slug={slug}
        commissionId={commissionId}
        meetingTypes={meetingTypes}
        members={members}
      />
    </>
  );
}

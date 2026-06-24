"use client";

import { commissionHref } from "@/lib/routing";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";

import {
  createMeeting,
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
import { MODALITY_LABEL, MODALITY_ORDER } from "./meeting-labels";
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
  meeting,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  commissionId: string;
  meetingTypes: CommissionMeetingType[];
  /** Required for `edit`. */
  meeting?: MeetingDetail;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<(CreateMeetingState & ActionState) | null>(
    null,
  );

  const [title, setTitle] = useState(meeting?.title ?? "");
  const [meetingTypeId, setMeetingTypeId] = useState(
    meeting?.meetingTypeId ?? "",
  );
  const [modality, setModality] = useState<MeetingModality>(
    meeting?.modality ?? "presencial",
  );
  const [start, setStart] = useState(
    toDateTimeLocalValue(meeting?.scheduledStart ?? null),
  );
  const [end, setEnd] = useState(
    toDateTimeLocalValue(meeting?.scheduledEnd ?? null),
  );
  const [locationText, setLocationText] = useState(meeting?.locationText ?? "");
  const [meetingUrl, setMeetingUrl] = useState(meeting?.meetingUrl ?? "");

  // Reset local state each time the dialog opens (render-phase prop-sync).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setTitle(meeting?.title ?? "");
      setMeetingTypeId(meeting?.meetingTypeId ?? "");
      setModality(meeting?.modality ?? "presencial");
      setStart(toDateTimeLocalValue(meeting?.scheduledStart ?? null));
      setEnd(toDateTimeLocalValue(meeting?.scheduledEnd ?? null));
      setLocationText(meeting?.locationText ?? "");
      setMeetingUrl(meeting?.meetingUrl ?? "");
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
      const result =
        mode === "create"
          ? await createMeeting(commissionId, input)
          : await updateMeeting(meeting!.id, input);
      setState(result);
    });
  }

  const showRemoteFields = modality === "remoto" || modality === "hibrido";

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
            />
            {state?.fieldErrors?.title && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.title}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Tipo{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <select
              value={meetingTypeId}
              onChange={(e) => setMeetingTypeId(e.target.value)}
              className={FIELD_CLASS}
            >
              <option value="">Sem tipo</option>
              {meetingTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Início</span>
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
                className={FIELD_CLASS}
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
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Término{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </span>
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className={FIELD_CLASS}
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
            </label>
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
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  commissionId: string;
  meetingTypes: CommissionMeetingType[];
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
      />
    </>
  );
}

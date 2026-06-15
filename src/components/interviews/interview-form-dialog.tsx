"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import {
  createInterview,
  updateInterview,
  type ActionState,
  type CreateInterviewState,
  type InterviewInput,
} from "@/lib/interviews/actions";
import type {
  InterviewDetail,
  InterviewModality,
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
import { MODALITY_LABEL, MODALITY_ORDER } from "./interview-labels";
import { toDateTimeLocalValue } from "./format";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** A case phase the interview may be attached to (id + display label only). */
export interface InterviewPhaseOption {
  id: string;
  label: string;
}

/** Convert a `datetime-local` value back to an ISO string (local tz); "" → null. */
function localToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Create a new interview on a case OR edit an existing interview header. The
 * created interview starts as a `rascunho` draft — the start date is OPTIONAL here
 * and is formally set by the separate "Agendar" lifecycle action; offering it on
 * create is a convenience (the server accepts a null start for a draft). Arg-based
 * actions (`createInterview` / `updateInterview`) run inside a transition; errors
 * stay on screen and the route refreshes on success. On create we navigate into
 * the new interview's detail page.
 *
 * Editing is only offered while the interview is unlocked; the parent decides
 * whether to render the edit trigger, and the server re-checks.
 */
export function InterviewFormDialog({
  mode,
  open,
  onOpenChange,
  slug,
  caseId,
  phases,
  interview,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  caseId: string;
  /** The case's phases, for the optional "attach to phase" picker. */
  phases: InterviewPhaseOption[];
  /** Required for `edit`. */
  interview?: InterviewDetail;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<
    (CreateInterviewState & ActionState) | null
  >(null);

  const [title, setTitle] = useState(interview?.title ?? "");
  const [casePhaseId, setCasePhaseId] = useState(interview?.casePhaseId ?? "");
  const [modality, setModality] = useState<InterviewModality>(
    interview?.modality ?? "presencial",
  );
  const [start, setStart] = useState(
    toDateTimeLocalValue(interview?.scheduledStart ?? null),
  );
  const [end, setEnd] = useState(
    toDateTimeLocalValue(interview?.scheduledEnd ?? null),
  );
  const [locationText, setLocationText] = useState(
    interview?.locationText ?? "",
  );
  const [meetingUrl, setMeetingUrl] = useState(interview?.meetingUrl ?? "");

  // Reset local state each time the dialog opens (render-phase prop-sync).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setTitle(interview?.title ?? "");
      setCasePhaseId(interview?.casePhaseId ?? "");
      setModality(interview?.modality ?? "presencial");
      setStart(toDateTimeLocalValue(interview?.scheduledStart ?? null));
      setEnd(toDateTimeLocalValue(interview?.scheduledEnd ?? null));
      setLocationText(interview?.locationText ?? "");
      setMeetingUrl(interview?.meetingUrl ?? "");
    }
  }

  useEffect(() => {
    if (!state?.ok) return;
    if (mode === "create" && state.interviewId) {
      router.push(
        `/c/${slug}/manage/cases/${caseId}/interviews/${state.interviewId}`,
      );
      return;
    }
    onOpenChange(false);
    router.refresh();
  }, [state, mode, slug, caseId, router, onOpenChange]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: InterviewInput = {
      title: title.trim() || null,
      casePhaseId: casePhaseId || null,
      modality,
      scheduledStart: localToIso(start),
      scheduledEnd: localToIso(end),
      locationText: locationText.trim() || null,
      meetingUrl: meetingUrl.trim() || null,
    };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createInterview(caseId, input)
          : await updateInterview(interview!.id, input);
      setState(result);
    });
  }

  const showRemoteFields = modality === "remoto" || modality === "hibrido";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nova entrevista" : "Editar entrevista"}
          </DialogTitle>
          <DialogDescription>
            Registre uma entrevista com profissionais sobre este caso. Nunca
            inclua dados de paciente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && !state.fieldErrors?.title && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Título{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={FIELD_CLASS}
              placeholder="Ex.: Entrevista com a equipe da UTI"
              aria-invalid={state?.fieldErrors?.title ? true : undefined}
            />
            {state?.fieldErrors?.title && (
              <span
                role="alert"
                className="text-sm font-medium text-destructive"
              >
                {state.fieldErrors.title}
              </span>
            )}
          </label>

          {phases.length > 0 && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Fase do caso{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </span>
              <select
                value={casePhaseId}
                onChange={(e) => setCasePhaseId(e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">Não vincular a uma fase</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Início{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </span>
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
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
              placeholder="Ex.: Sala da comissão — 2º andar"
            />
          </label>

          {showRemoteFields && (
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
                  ? "Criar entrevista"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The "Nova entrevista" trigger button (case detail panel, staff_admin only). Owns
 * its own dialog open state so the panel can stay a Server Component.
 */
export function NewInterviewButton({
  slug,
  caseId,
  phases,
}: {
  slug: string;
  caseId: string;
  phases: InterviewPhaseOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        Nova entrevista
      </Button>
      <InterviewFormDialog
        mode="create"
        open={open}
        onOpenChange={setOpen}
        slug={slug}
        caseId={caseId}
        phases={phases}
      />
    </>
  );
}

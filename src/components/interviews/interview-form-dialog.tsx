"use client";

import { commissionHref } from "@/lib/routing";
import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import {
  createInterview,
  updateInterview,
  type ActionState,
  type CreateInterviewState,
  type InterviewInput,
  type SessionInput,
} from "@/lib/interviews/actions";
import type {
  InterviewCategory,
  InterviewConfidentiality,
  InterviewDetail,
  InterviewModality,
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
import { PhiInputHint } from "@/components/ui/phi-input-hint";
import {
  CONFIDENTIALITY_HELPER_TEXT,
  CONFIDENTIALITY_LABEL,
  CONFIDENTIALITY_ORDER,
  INTERVIEW_CATEGORY_LABEL,
  INTERVIEW_CATEGORY_ORDER,
  MODALITY_LABEL,
  MODALITY_ORDER,
  SESSION_TYPE_LABEL,
  SESSION_TYPE_ORDER,
} from "./interview-labels";

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
 * Create a new interview on a case OR edit an existing interview header (IV2 — ADR
 * 0070). The header now carries the dashboard **category** (required) and a
 * NON-ENFORCING **confidentiality** tag; scheduling has moved onto sessions.
 *
 * On **create** the dialog optionally schedules the FIRST session inline — one user
 * action calling `createInterview(caseId, input, firstSession)` — so the common
 * "create + schedule" flow is a single step; unchecking leaves the interview a
 * `rascunho` draft with no session yet. On **edit** only the header fields show
 * (sessions are managed from the sessions panel).
 *
 * Arg-based actions run inside a transition; errors stay on screen and the route
 * refreshes on success. On create we navigate into the new interview's detail page.
 */
export function InterviewFormDialog({
  mode,
  open,
  onOpenChange,
  org,
  slug,
  caseId,
  phases,
  interview,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Org slug for hrefs. */
  org: string;
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

  // Ids wire each field's <label>/help text to its control.
  const startId = useId();
  const endId = useId();
  const confidentialityHelpId = useId();

  const [title, setTitle] = useState(interview?.title ?? "");
  const [casePhaseId, setCasePhaseId] = useState(interview?.casePhaseId ?? "");
  const [category, setCategory] = useState<InterviewCategory | "">(
    interview?.interviewCategory ?? "",
  );
  const [confidentiality, setConfidentiality] =
    useState<InterviewConfidentiality>(
      interview?.confidentialityLevel ?? "non_phi_internal",
    );
  const [categoryError, setCategoryError] = useState(false);

  // Create-only: schedule the first session inline (the create-then-schedule UX).
  const [scheduleFirst, setScheduleFirst] = useState(true);
  const [sessionType, setSessionType] = useState<SessionType>("initial");
  const [modality, setModality] = useState<InterviewModality>("presencial");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [locationText, setLocationText] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");

  // Reset local state each time the dialog opens (render-phase prop-sync).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setCategoryError(false);
      setTitle(interview?.title ?? "");
      setCasePhaseId(interview?.casePhaseId ?? "");
      setCategory(interview?.interviewCategory ?? "");
      setConfidentiality(interview?.confidentialityLevel ?? "non_phi_internal");
      setScheduleFirst(true);
      setSessionType("initial");
      setModality("presencial");
      setStart("");
      setEnd("");
      setLocationText("");
      setMeetingUrl("");
    }
  }

  useEffect(() => {
    if (!state?.ok) return;
    if (mode === "create" && state.interviewId) {
      router.push(
        commissionHref(
          org,
          slug,
          "manage",
          "cases",
          caseId,
          "interviews",
          state.interviewId,
        ),
      );
      return;
    }
    onOpenChange(false);
    router.refresh();
  }, [state, mode, org, slug, caseId, router, onOpenChange]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) {
      setCategoryError(true);
      return;
    }
    setCategoryError(false);
    const input: InterviewInput = {
      title: title.trim() || null,
      casePhaseId: casePhaseId || null,
      interviewCategory: category,
      confidentialityLevel: confidentiality,
    };

    const written = sessionType === "written_response";
    const firstSession: SessionInput | null =
      mode === "create" && scheduleFirst
        ? {
            sessionType,
            modality: written ? null : modality,
            scheduledStart: localToIso(start),
            scheduledEnd: localToIso(end),
            locationText: written ? null : locationText.trim() || null,
            meetingUrl: written ? null : meetingUrl.trim() || null,
          }
        : null;

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createInterview(caseId, input, firstSession)
          : await updateInterview(interview!.id, input);
      setState(result);
    });
  }

  const showRemoteFields = modality === "remoto" || modality === "hibrido";
  const showSessionFields =
    mode === "create" && scheduleFirst && sessionType !== "written_response";

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

          <PhiInputHint>
            {(hintId) => (
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
                  aria-describedby={hintId}
                />
              </label>
            )}
          </PhiInputHint>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Categoria</span>
            <NativeSelect
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as InterviewCategory);
                setCategoryError(false);
              }}
              required
              aria-invalid={categoryError ? true : undefined}
              className="h-10"
            >
              <option value="" disabled>
                Selecione uma categoria…
              </option>
              {INTERVIEW_CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {INTERVIEW_CATEGORY_LABEL[c]}
                </option>
              ))}
            </NativeSelect>
            {categoryError && (
              <span role="alert" className="text-sm font-medium text-destructive">
                Selecione uma categoria para a entrevista.
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
              <NativeSelect
                value={casePhaseId}
                onChange={(e) => setCasePhaseId(e.target.value)}
                className="h-10"
              >
                <option value="">Não vincular a uma fase</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Confidencialidade</span>
            <NativeSelect
              value={confidentiality}
              onChange={(e) =>
                setConfidentiality(e.target.value as InterviewConfidentiality)
              }
              aria-describedby={confidentialityHelpId}
              className="h-10"
            >
              {CONFIDENTIALITY_ORDER.map((level) => (
                <option key={level} value={level}>
                  {CONFIDENTIALITY_LABEL[level]}
                </option>
              ))}
            </NativeSelect>
            <span
              id={confidentialityHelpId}
              className="text-xs text-muted-foreground"
            >
              {CONFIDENTIALITY_HELPER_TEXT}
            </span>
          </label>

          {mode === "create" && (
            <fieldset className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4">
              <label className="flex items-center gap-2.5 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={scheduleFirst}
                  onChange={(e) => setScheduleFirst(e.target.checked)}
                  className="size-4 rounded border-input accent-primary focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                />
                Agendar a primeira sessão agora
              </label>

              {scheduleFirst && (
                <div className="flex flex-col gap-4">
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium">Tipo de sessão</span>
                    <NativeSelect
                      value={sessionType}
                      onChange={(e) =>
                        setSessionType(e.target.value as SessionType)
                      }
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
                      <label htmlFor={startId} className="font-medium">
                        Início{" "}
                        <span className="font-normal text-muted-foreground">
                          (opcional)
                        </span>
                      </label>
                      <DateTimePicker id={startId} value={start} onChange={setStart} />
                    </div>
                    <div className="flex flex-col gap-1.5 text-sm">
                      <label htmlFor={endId} className="font-medium">
                        Término{" "}
                        <span className="font-normal text-muted-foreground">
                          (opcional)
                        </span>
                      </label>
                      <DateTimePicker id={endId} value={end} onChange={setEnd} />
                    </div>
                  </div>

                  {sessionType !== "written_response" && (
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

                  {showSessionFields && (
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

                  {showSessionFields && showRemoteFields && (
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
                </div>
              )}
            </fieldset>
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
  org,
  slug,
  caseId,
  phases,
}: {
  /** Org slug for hrefs. */
  org: string;
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
        org={org}
        slug={slug}
        caseId={caseId}
        phases={phases}
      />
    </>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";

import {
  SUSPECTED_HARM_LABELS,
  type SuspectedHarmLevel,
  type NotifyEventInput,
  type NotifyEventState,
} from "@/lib/safety/types";
import type { CasePatient } from "@/lib/cases/types";
import { notifySafetyEvent, setEventPatient } from "@/lib/safety/actions";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { SectionTextEditor } from "@/components/forms/section-text-editor";
import {
  EMPTY_PATIENT_DRAFT,
  PatientFields,
  patientDraftHasData,
  patientDraftToInput,
  type PatientDraft,
} from "./patient-fields";

/** Map a case's revealed {@link CasePatient} into the notify form's editable
 * draft (camelCase strings). Used to SEED the optional patient panel when the
 * event is raised from a PHI-collecting case (ADR 0038 — value copy, never a
 * link; the NSP `event_patient` stays independently isolated). */
function casePatientToDraft(patient: CasePatient): PatientDraft {
  return {
    name: patient.name ?? "",
    mrn: patient.mrn ?? "",
    dateOfBirth: patient.dateOfBirth ?? "",
    ageYears: patient.ageYears != null ? String(patient.ageYears) : "",
    sex: patient.sex,
    encounterRef: patient.encounterRef ?? "",
    unit: patient.unit ?? "",
    attending: patient.attending ?? "",
  };
}

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** The harm-level options in clinical order (severity ascending, unknown last). */
const HARM_ORDER: SuspectedHarmLevel[] = [
  "none",
  "mild",
  "moderate",
  "severe",
  "death",
  "unknown",
];

/**
 * The committee "Notificar evento ao NSP" form (F1) — shared by the case-detail
 * dialog and the stand-alone `/c/[slug]/eventos/novo` page. Collects the
 * reporter's narrative (title + sanitized-Markdown description, Rule 7) + coarse
 * `suspected_harm_level` + when/where, plus an OPTIONAL patient panel (PHI).
 *
 * In 14a the reporter gives narrative + suspected harm only — NO event TYPE
 * (`eventTypeId` stays null until the 14b triage vocabulary), so there is no type
 * picker here.
 *
 * Submit flow: `notifySafetyEvent(input)`; on success, if the patient panel
 * carries any data, `setEventPatient(eventId, …)` writes the isolated PHI row
 * (best-effort — a patient-write failure surfaces a warning but the event is
 * already filed). The parent's `onSuccess(state)` then closes/navigates.
 *
 * ANY commission member may file (just-culture); the RPC authorizes membership of
 * the reporting commission, so this form does no role pre-check.
 */
export function EventNotifyForm({
  reportingCommissionId,
  caseId,
  idPrefix,
  submitLabel = "Notificar evento",
  onCancel,
  onSuccess,
  onLoadPatientPrefill,
}: {
  reportingCommissionId: string;
  /** The case the event is raised from; `null` for a stand-alone event. */
  caseId: string | null;
  /** Namespaces field ids so multiple instances on a page stay accessible. */
  idPrefix: string;
  submitLabel?: string;
  /** Rendered as a secondary "cancel/back" button when provided. */
  onCancel?: () => void;
  /** Called with the successful notify state (carries `eventId` + `code`). */
  onSuccess: (state: NotifyEventState) => void;
  /** Lazily seed the optional patient panel from the source case's `case_patient`
   * (ADR 0038 — an AUDITED `case_patient.read` fired on mount, i.e. when the
   * dialog opens, NOT on case-detail render). Absent for a stand-alone event or a
   * PHI-free case. Returns `null` when the case has no identifiers / out of scope.
   * A value copy: the reporter may edit it before filing; the NSP `event_patient`
   * stays independently isolated + disposable. */
  onLoadPatientPrefill?: () => Promise<CasePatient | null>;
}) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<NotifyEventState | null>(null);
  /** A non-fatal warning when the event filed but the PHI write failed. */
  const [patientWarning, setPatientWarning] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [descriptionMd, setDescriptionMd] = useState("");
  const [harmLevel, setHarmLevel] = useState<SuspectedHarmLevel>("unknown");
  const [discoveredAt, setDiscoveredAt] = useState("");
  const [location, setLocation] = useState("");
  const [patient, setPatient] = useState<PatientDraft>(EMPTY_PATIENT_DRAFT);
  /** Whether the patient panel was seeded from the source case (drives a caption). */
  const [patientPrefilled, setPatientPrefilled] = useState(false);

  // Seed the optional patient panel from the source case's identifiers on mount
  // (the dialog remounts this form on each open via `key`, so the audited read
  // fires per open, on intent). Best-effort — a prefill failure must never block
  // manual entry, and we never clobber a value once typed (mount-only).
  useEffect(() => {
    if (!onLoadPatientPrefill) return;
    let active = true;
    void (async () => {
      try {
        const prefill = await onLoadPatientPrefill();
        if (active && prefill) {
          setPatient(casePatientToDraft(prefill));
          setPatientPrefilled(true);
        }
      } catch {
        // Ignore — manual entry remains available.
      }
    })();
    return () => {
      active = false;
    };
    // Mount-only: the loader is bound to a stable case id by the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState(null);
    setPatientWarning(null);

    const input: NotifyEventInput = {
      reportingCommissionId,
      caseId,
      title: title.trim(),
      descriptionMd: descriptionMd.trim() || null,
      suspectedHarmLevel: harmLevel,
      // 14a: no type at intake — categorized at triage (14b).
      eventTypeId: null,
      location: location.trim() || null,
      discoveredAt: discoveredAt.trim() || null,
    };

    startTransition(async () => {
      const result = await notifySafetyEvent(input);
      if (!result.ok) {
        setState(result);
        return;
      }

      // The event is filed. Write the optional isolated PHI row only when the
      // reporter supplied any identifier (minimum-necessary). A failure here is
      // non-fatal — the event already exists and PHI can be added later.
      if (result.eventId && patientDraftHasData(patient)) {
        const phi = await setEventPatient(
          result.eventId,
          patientDraftToInput(patient),
        );
        if (!phi.ok) {
          setPatientWarning(
            phi.error ??
              "O evento foi notificado, mas não foi possível salvar os dados do paciente. Tente registrá-los novamente no evento.",
          );
        }
      }

      onSuccess(result);
    });
  }

  const titleError = state?.fieldErrors?.title;
  const descId = `${idPrefix}-desc-help`;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {state && !state.ok && !titleError && (
        <FormBanner tone="error">{state.error}</FormBanner>
      )}
      {patientWarning && <FormBanner tone="info">{patientWarning}</FormBanner>}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Título do evento</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          disabled={isPending}
          className={FIELD_CLASS}
          placeholder="Ex.: Queda de paciente sem lesão aparente"
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? `${idPrefix}-title-error` : undefined}
        />
        {titleError && (
          <span
            id={`${idPrefix}-title-error`}
            role="alert"
            className="text-sm font-medium text-destructive"
          >
            {titleError}
          </span>
        )}
      </label>

      <div className="flex flex-col gap-1.5 text-sm">
        <label htmlFor={`${idPrefix}-desc`} className="font-medium">
          Descrição{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <p id={descId} className="text-xs text-muted-foreground">
          Descreva o que aconteceu, em texto formatado (Markdown). Não inclua
          dados de paciente aqui — use o campo de identificação abaixo.
        </p>
        <SectionTextEditor
          value={descriptionMd}
          onChange={setDescriptionMd}
          disabled={isPending}
          textareaId={`${idPrefix}-desc`}
          describedById={descId}
          placeholder="Descreva o evento em Markdown…"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Dano suspeito</span>
          <select
            value={harmLevel}
            onChange={(e) =>
              setHarmLevel(e.target.value as SuspectedHarmLevel)
            }
            disabled={isPending}
            className={FIELD_CLASS}
          >
            {HARM_ORDER.map((level) => (
              <option key={level} value={level}>
                {SUSPECTED_HARM_LABELS[level]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">
            Data do evento{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </span>
          <input
            type="date"
            value={discoveredAt}
            onChange={(e) => setDiscoveredAt(e.target.value)}
            disabled={isPending}
            className={FIELD_CLASS}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">
          Local{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </span>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          disabled={isPending}
          className={FIELD_CLASS}
          placeholder="Ex.: UTI Adulto, leito 3"
        />
      </label>

      {patientPrefilled && (
        <p className="-mb-2 text-xs text-muted-foreground text-pretty">
          Identificação pré-preenchida a partir do caso. Revise antes de notificar.
        </p>
      )}
      <PatientFields
        draft={patient}
        onChange={setPatient}
        disabled={isPending}
        idPrefix={`${idPrefix}-patient`}
      />

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancelar
          </Button>
        )}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Notificando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

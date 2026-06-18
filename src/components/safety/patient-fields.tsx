"use client";

import { ShieldAlert } from "lucide-react";

import {
  PATIENT_SEX_LABELS,
  type PatientSex,
  type SetEventPatientInput,
} from "@/lib/safety/types";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

const SEX_ORDER: PatientSex[] = ["female", "male", "other", "unknown"];

/**
 * Controlled local state for the OPTIONAL patient panel (PHI — Rule 12). Kept as
 * camelCase strings so the form can bind 1:1; the parent converts the trimmed
 * values into a {@link SetEventPatientInput} only when at least one identifier is
 * present, and calls `setEventPatient` AFTER the event is notified.
 */
export interface PatientDraft {
  name: string;
  mrn: string;
  dateOfBirth: string;
  ageYears: string;
  sex: PatientSex;
  encounterRef: string;
  unit: string;
  attending: string;
}

export const EMPTY_PATIENT_DRAFT: PatientDraft = {
  name: "",
  mrn: "",
  dateOfBirth: "",
  ageYears: "",
  sex: "unknown",
  encounterRef: "",
  unit: "",
  attending: "",
};

/** Whether the draft carries any identifying field (drives the optional write). */
export function patientDraftHasData(draft: PatientDraft): boolean {
  return Boolean(
    draft.name.trim() ||
      draft.mrn.trim() ||
      draft.dateOfBirth.trim() ||
      draft.ageYears.trim() ||
      draft.encounterRef.trim() ||
      draft.unit.trim() ||
      draft.attending.trim() ||
      draft.sex !== "unknown",
  );
}

/** Convert the draft into the minimum-necessary PHI input (trimmed; "" → null). */
export function patientDraftToInput(draft: PatientDraft): SetEventPatientInput {
  const ageRaw = draft.ageYears.trim();
  const age = ageRaw ? Number.parseInt(ageRaw, 10) : NaN;
  return {
    name: draft.name.trim() || null,
    mrn: draft.mrn.trim() || null,
    dateOfBirth: draft.dateOfBirth.trim() || null,
    ageYears: Number.isFinite(age) ? age : null,
    sex: draft.sex,
    encounterRef: draft.encounterRef.trim() || null,
    unit: draft.unit.trim() || null,
    attending: draft.attending.trim() || null,
  };
}

/**
 * The OPTIONAL patient (PHI) fieldset on the notify form. Minimum-necessary
 * identifiers only (ADR 0030). A muted, clearly-bordered region with an explicit
 * "Identificação do paciente (opcional)" legend and a sensitivity note, so the
 * reporter understands they're entering protected data. Every input is labelled
 * and keyboard-operable.
 */
export function PatientFields({
  draft,
  onChange,
  disabled = false,
  idPrefix,
}: {
  draft: PatientDraft;
  onChange: (next: PatientDraft) => void;
  disabled?: boolean;
  /** Namespaces the field ids so multiple instances stay accessible. */
  idPrefix: string;
}) {
  const set = <K extends keyof PatientDraft>(key: K, value: PatientDraft[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-dashed border-border bg-muted/20 p-4">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
        <ShieldAlert aria-hidden="true" className="size-4 text-muted-foreground" />
        Identificação do paciente{" "}
        <span className="font-normal text-muted-foreground">(opcional)</span>
      </legend>
      <p className="text-xs text-muted-foreground text-pretty">
        Dados sensíveis do paciente, registrados apenas quando necessários para a
        análise. Informe somente o mínimo necessário; deixe em branco se não se
        aplica.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Nome</span>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            disabled={disabled}
            className={FIELD_CLASS}
            autoComplete="off"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Prontuário</span>
          <input
            type="text"
            value={draft.mrn}
            onChange={(e) => set("mrn", e.target.value)}
            disabled={disabled}
            className={FIELD_CLASS}
            autoComplete="off"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Data de nascimento</span>
          <input
            type="date"
            value={draft.dateOfBirth}
            onChange={(e) => set("dateOfBirth", e.target.value)}
            disabled={disabled}
            className={FIELD_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">
            Idade{" "}
            <span className="font-normal text-muted-foreground">
              (se a data não for conhecida)
            </span>
          </span>
          <input
            type="number"
            min={0}
            max={150}
            inputMode="numeric"
            value={draft.ageYears}
            onChange={(e) => set("ageYears", e.target.value)}
            disabled={disabled}
            className={FIELD_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Sexo</span>
          <select
            id={`${idPrefix}-sex`}
            value={draft.sex}
            onChange={(e) => set("sex", e.target.value as PatientSex)}
            disabled={disabled}
            className={FIELD_CLASS}
          >
            {SEX_ORDER.map((s) => (
              <option key={s} value={s}>
                {PATIENT_SEX_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Atendimento / internação</span>
          <input
            type="text"
            value={draft.encounterRef}
            onChange={(e) => set("encounterRef", e.target.value)}
            disabled={disabled}
            className={FIELD_CLASS}
            autoComplete="off"
            placeholder="Ex.: nº do atendimento"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Unidade / setor</span>
          <input
            type="text"
            value={draft.unit}
            onChange={(e) => set("unit", e.target.value)}
            disabled={disabled}
            className={FIELD_CLASS}
            placeholder="Ex.: UTI Adulto"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Profissional responsável</span>
          <input
            type="text"
            value={draft.attending}
            onChange={(e) => set("attending", e.target.value)}
            disabled={disabled}
            className={FIELD_CLASS}
            autoComplete="off"
          />
        </label>
      </div>
    </fieldset>
  );
}

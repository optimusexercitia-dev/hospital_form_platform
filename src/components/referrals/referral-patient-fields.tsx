"use client";

import { ShieldAlert } from "lucide-react";

import {
  REFERRAL_PATIENT_SEX_LABELS,
  type ReferralPatientSex,
  type SetReferralPatientInput,
} from "@/lib/referrals/types";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

const SEX_ORDER: ReferralPatientSex[] = ["female", "male", "other", "unknown"];

/**
 * Controlled local state for the OPTIONAL referral patient block (PHI — Rule 12;
 * ADR 0037). Kept as camelCase strings so the form binds 1:1; the parent converts
 * the trimmed values into a {@link SetReferralPatientInput} only when at least one
 * identifier is present, and calls `setReferralPatient` on the draft. Mirrors the
 * safety module's `PatientDraft` exactly (same minimum-necessary identifiers).
 */
export interface ReferralPatientDraft {
  name: string;
  mrn: string;
  dateOfBirth: string;
  ageYears: string;
  sex: ReferralPatientSex;
  encounterRef: string;
  unit: string;
  attending: string;
}

export const EMPTY_REFERRAL_PATIENT_DRAFT: ReferralPatientDraft = {
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
export function referralPatientDraftHasData(
  draft: ReferralPatientDraft,
): boolean {
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
export function referralPatientDraftToInput(
  draft: ReferralPatientDraft,
): SetReferralPatientInput {
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
 * The OPTIONAL patient (PHI) fieldset on the send wizard. Minimum-necessary
 * identifiers only (ADR 0037). A muted, clearly-bordered region with an explicit
 * legend and a sensitivity note, so the coordinator understands they're entering
 * protected data. Every input is labelled and keyboard-operable.
 */
export function ReferralPatientFields({
  draft,
  onChange,
  disabled = false,
  idPrefix,
}: {
  draft: ReferralPatientDraft;
  onChange: (next: ReferralPatientDraft) => void;
  disabled?: boolean;
  /** Namespaces the field ids so multiple instances stay accessible. */
  idPrefix: string;
}) {
  const set = <K extends keyof ReferralPatientDraft>(
    key: K,
    value: ReferralPatientDraft[K],
  ) => onChange({ ...draft, [key]: value });

  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-dashed border-warning/40 bg-warning/8 p-4">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
        <ShieldAlert aria-hidden="true" className="size-4 text-warning" />
        Identificação do paciente{" "}
        <span className="font-normal text-muted-foreground">(opcional)</span>
      </legend>
      <p className="text-xs text-muted-foreground text-pretty">
        Dados sensíveis do paciente, compartilhados apenas quando necessários
        para a análise da comissão de destino. Informe somente o mínimo
        necessário; deixe em branco se não se aplica. O acesso a estes dados é
        registrado em trilha de auditoria.
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
            onChange={(e) => set("sex", e.target.value as ReferralPatientSex)}
            disabled={disabled}
            className={FIELD_CLASS}
          >
            {SEX_ORDER.map((s) => (
              <option key={s} value={s}>
                {REFERRAL_PATIENT_SEX_LABELS[s]}
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

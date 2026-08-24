"use client";

import { ShieldAlert } from "lucide-react";

import {
  REFERRAL_PATIENT_SEX_LABELS,
  type ReferralPatientSex,
  type SetReferralPatientInput,
} from "@/lib/referrals/types";
import { NativeSelect } from "@/components/ui/native-select";
import { DatePicker } from "@/components/ui/date-picker";

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
      {/* ADR 0137 **D4** — the legend loses "(opcional)". A referral without a
          patient key is undeliverable work: the receiving committee has nothing to
          look up, and a communication that needs no patient is a message, not an
          encaminhamento. */}
      <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
        <ShieldAlert aria-hidden="true" className="size-4 text-warning" />
        Identificação do paciente
      </legend>
      <p className="text-xs text-muted-foreground text-pretty">
        Dados sensíveis do paciente, compartilhados apenas quando necessários
        para a análise da comissão de destino. Informe somente o mínimo
        necessário. O acesso a estes dados é registrado em trilha de auditoria.
      </p>
      {/* ⚠ Says WHEN the requirement bites, because it does not bite here. The
          `save_referral_patient` floor is unchanged (`name` OR `mrn`), so a
          partially-entered draft is still savable — the MRN is enforced at SEND, by
          `send_referral`. Telling the coordinator that up front is what stops the
          requirement reading as a bug when "Salvar rascunho" succeeds without it. */}
      <p className="text-xs text-pretty text-muted-foreground">
        O <span className="font-medium text-foreground">prontuário</span> é
        obrigatório para enviar o encaminhamento. Você pode salvar um rascunho sem
        ele.
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
          <span className="font-medium">
            Prontuário{" "}
            <span className="font-normal text-muted-foreground">
              (obrigatório para enviar)
            </span>
          </span>
          <input
            type="text"
            value={draft.mrn}
            onChange={(e) => set("mrn", e.target.value)}
            disabled={disabled}
            className={FIELD_CLASS}
            autoComplete="off"
            // ⛔ NOT `required`: this fieldset lives inside a wizard whose "Salvar
            // rascunho" path must succeed WITHOUT an MRN (D4 leaves the
            // `save_referral_patient` floor at `name OR mrn`). A native `required`
            // would block the draft save too, which is the opposite of the decision.
            // `send_referral` is the authority and returns a pt-BR refusal.
            aria-describedby={`${idPrefix}-mrn-hint`}
          />
          <span id={`${idPrefix}-mrn-hint`} className="sr-only">
            Obrigatório para enviar o encaminhamento; opcional para salvar um
            rascunho.
          </span>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Data de nascimento</span>
          <DatePicker
            value={draft.dateOfBirth}
            onChange={(v) => set("dateOfBirth", v)}
            disabled={disabled}
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
          <NativeSelect
            id={`${idPrefix}-sex`}
            value={draft.sex}
            onChange={(e) => set("sex", e.target.value as ReferralPatientSex)}
            disabled={disabled}
            className="h-10"
          >
            {SEX_ORDER.map((s) => (
              <option key={s} value={s}>
                {REFERRAL_PATIENT_SEX_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Atendimento</span>
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

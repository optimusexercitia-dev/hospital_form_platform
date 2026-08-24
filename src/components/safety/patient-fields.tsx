"use client";

import { ShieldAlert } from "lucide-react";

import {
  PATIENT_SEX_LABELS,
  type PatientSex,
  type SetEventPatientInput,
} from "@/lib/safety/types";
// ⚠ TYPE-ONLY. `@/lib/queries/cases` is a SERVER query module (it reaches
// `next/headers` through the supabase factory); a value import from a client
// component aborts `next build` while tsc/lint/vitest stay green, which is
// exactly what `lint:client-server-imports` gates.
import type { PatientRequiredField } from "@/lib/queries/cases";
import { NativeSelect } from "@/components/ui/native-select";
import { DatePicker } from "@/components/ui/date-picker";

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
  /**
   * ⛔ NO LONGER WRITTEN BY ANY INPUT. The "Idade" field was removed from every PHI
   * dialog (2026-08-24), extending ADR 0137 **D9** — which had already removed it
   * from the case surfaces — to the safety-event and referral ones, so all four
   * share one layout. A date of birth and a free-typed age are two statements of the
   * same fact that drift apart, and only one is verifiable.
   *
   * ⚠ **HIDING, NOT CLEARING — and no backend change.** This field, its `hasData` /
   * `toInput` arms and the `age_years` column are all untouched, so a record that
   * ALREADY carries an age keeps it through an edit-and-save round trip: the edit
   * dialog seeds the draft from the stored record, and `patientDraftToInput` writes
   * that value straight back. Deleting any of them would silently erase stored ages
   * on the next save.
   */
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

/**
 * pt-BR labels for the identifier fields a `'required'`-mode process may demand
 * (ADR 0137 D2). Exported so the PROCESS BUILDER's required-field picker and this
 * form use the same words — a coordinator ticks "Prontuário" in the builder and
 * reads "Prontuário" on the create dialog.
 *
 * Typed `Record<PatientRequiredField, string>`, so widening the union reds `tsc`
 * here rather than shipping an unlabelled tick box. `age_years` and `unit` are
 * absent BY CONSTRUCTION — they are not members of the union, and a DB CHECK on
 * both `process_template_versions` and `cases` says so too (ADR 0137 D2/D9).
 */
export const PATIENT_REQUIRED_FIELD_LABELS: Record<PatientRequiredField, string> = {
  name: "Nome",
  mrn: "Prontuário",
  date_of_birth: "Data de nascimento",
  sex: "Sexo",
  encounter_ref: "Atendimento",
  attending: "Profissional responsável",
};

/**
 * The canonical field order — the same order the DB reports missing fields in.
 *
 * Mirrors `PATIENT_REQUIRED_FIELDS` in `src/lib/queries/cases.ts`, which a client
 * component may only TYPE-import (see the import note above), so the order is
 * re-declared here as the key order of the label map. The cast is safe because
 * `Record<PatientRequiredField, string>` forces the key set to be exactly the
 * union — `Object.keys` merely loses that in its return type.
 */
export const PATIENT_REQUIRED_FIELD_ORDER = Object.keys(
  PATIENT_REQUIRED_FIELD_LABELS,
) as PatientRequiredField[];

/**
 * The subset of `required` that the draft does NOT satisfy, in canonical order.
 *
 * ⚠ Mirrors `app.patient_required_missing`, including its `sex = 'unknown'`
 * SENTINEL rule: `sex` always carries a value, so a required `sex` would be
 * satisfied by the column default on every row unless `'unknown'` counts as
 * missing. Getting that wrong here would offer a create button the DB refuses.
 *
 * ⛔ This is UX ONLY and is NOT the authority (ADR 0137 D3 — "the DB layer is the
 * one that counts"). If it ever drifts from the SQL predicate the cost is a submit
 * button enabled a moment too early or too late; the refusal still fires from
 * `app.assert_patient_required_fields` and surfaces as a pt-BR message naming the
 * same fields. Never move an enforcement decision into this function.
 */
export function patientDraftMissingRequired(
  draft: PatientDraft,
  required: readonly PatientRequiredField[],
): PatientRequiredField[] {
  if (required.length === 0) return [];
  return PATIENT_REQUIRED_FIELD_ORDER.filter((field) => {
    if (!required.includes(field)) return false;
    switch (field) {
      case "name":
        return !draft.name.trim();
      case "mrn":
        return !draft.mrn.trim();
      case "date_of_birth":
        return !draft.dateOfBirth.trim();
      case "sex":
        return draft.sex === "unknown";
      case "encounter_ref":
        return !draft.encounterRef.trim();
      case "attending":
        return !draft.attending.trim();
    }
  });
}

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
 * The patient (PHI) fieldset. Minimum-necessary identifiers only (ADR 0030). A
 * muted, clearly-bordered region with an explicit legend and a sensitivity note,
 * so the reporter understands they're entering protected data. Every input is
 * labelled and keyboard-operable.
 *
 * OPTIONAL by default — pass {@link requiredFields} to switch the block (and only
 * the named inputs) into the mandatory presentation demanded by ADR 0137 D3's
 * third layer. Safety-event and referral flows never pass it.
 */
export function PatientFields({
  draft,
  onChange,
  disabled = false,
  idPrefix,
  hideUnit = false,
  requiredFields = [],
}: {
  draft: PatientDraft;
  onChange: (next: PatientDraft) => void;
  disabled?: boolean;
  /** Namespaces the field ids so multiple instances stay accessible. */
  idPrefix: string;
  /**
   * Hide the PHI free-text "Unidade / setor" field. Set by every CASE surface —
   * originally only Novo-caso (which collected a case-level, NON-PHI department
   * instead), and since ADR 0137 D9 the case patient-edit dialog too, because the
   * case now collects no unit at all. Safety-event + referral flows keep the
   * free-text unit (default `false`).
   */
  hideUnit?: boolean;
  /**
   * The identifier fields this surface REQUIRES (ADR 0137 **D2/D3 layer 3**).
   * Each named field renders an "(obrigatório)" suffix INSIDE its `<label>` — so
   * the requirement is part of the control's accessible name, not a colour — plus
   * `aria-required`. A required `Sexo` additionally disables the "Não informado"
   * option, because the DB counts that sentinel as MISSING.
   *
   * ⛔ Marking only. The block does not refuse a submit and cannot: the caller owns
   * the submit gate ({@link patientDraftMissingRequired}) and the DB owns the
   * refusal. Default `[]` — every surface that does not pass it is unchanged,
   * byte for byte, from before ADR 0137.
   */
  requiredFields?: readonly PatientRequiredField[];
}) {
  const set = <K extends keyof PatientDraft>(key: K, value: PatientDraft[K]) =>
    onChange({ ...draft, [key]: value });

  const isRequired = (field: PatientRequiredField) => requiredFields.includes(field);
  const anyRequired = requiredFields.length > 0;
  // Suffix, not a standalone marker: it must sit inside the <label> so a screen
  // reader announces "Prontuário obrigatório" as one name. `undefined` keeps the
  // optional labels byte-identical (E2E anchors on /^Prontuário$/).
  const mark = (field: PatientRequiredField) =>
    isRequired(field) ? (
      <span className="font-normal text-muted-foreground"> (obrigatório)</span>
    ) : null;
  const ariaRequired = (field: PatientRequiredField) =>
    isRequired(field) ? true : undefined;
  const labelOf = (field: PatientRequiredField) =>
    isRequired(field)
      ? `${PATIENT_REQUIRED_FIELD_LABELS[field]} (obrigatório)`
      : PATIENT_REQUIRED_FIELD_LABELS[field];

  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-dashed border-border bg-muted/20 p-4">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
        <ShieldAlert aria-hidden="true" className="size-4 text-muted-foreground" />
        Identificação do paciente{" "}
        <span className="font-normal text-muted-foreground">
          {anyRequired ? "(obrigatória)" : "(opcional)"}
        </span>
      </legend>
      <p className="text-xs text-muted-foreground text-pretty">
        {anyRequired
          ? "Dados sensíveis do paciente. Este processo exige os campos marcados como obrigatórios; informe somente o mínimo necessário para a análise."
          : "Dados sensíveis do paciente, registrados apenas quando necessários para a análise. Informe somente o mínimo necessário; deixe em branco se não se aplica."}
      </p>

      {/* THE COMMON PHI LAYOUT (2026-08-24) — shared field-for-field with
          `ReferralPatientFields`, so a coordinator who fills one PHI dialog reads
          the next one in the same shape:
            1. Nome (full width)
            2. Sexo · Data de nascimento
            3. Prontuário · Atendimento
            4. Unidade / setor · Profissional responsável
          ⚠ Row 4 collapses to a single cell on every CASE surface, which passes
          `hideUnit` (ADR 0137 D9 — the case collects a structured, non-PHI
          department instead). That asymmetry is the ONLY permitted deviation;
          keep the row order identical either way. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">
            Nome
            {mark("name")}
          </span>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            disabled={disabled}
            aria-required={ariaRequired("name")}
            className={FIELD_CLASS}
            autoComplete="off"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">
            Sexo
            {mark("sex")}
          </span>
          <NativeSelect
            id={`${idPrefix}-sex`}
            value={draft.sex}
            onChange={(e) => set("sex", e.target.value as PatientSex)}
            disabled={disabled}
            aria-required={ariaRequired("sex")}
            className="h-10"
          >
            {SEX_ORDER.map((s) => (
              // `unknown` is the column DEFAULT, and `app.patient_required_missing`
              // counts it as MISSING. Leaving it selectable would let the user
              // "answer" a required Sexo with the value the DB refuses, so it stays
              // rendered (a disabled <option> still displays when selected) but
              // cannot be chosen, and reads as a prompt rather than an answer.
              <option key={s} value={s} disabled={s === "unknown" && isRequired("sex")}>
                {s === "unknown" && isRequired("sex")
                  ? "Selecione…"
                  : PATIENT_SEX_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">
            Data de nascimento
            {mark("date_of_birth")}
          </span>
          {/* MEASURED (real Chromium AX tree, same class of check that proved the
              welded `mrn` checkbox correctly named): a wrapping <label> DOES name a
              <button> — the premise this comment used to state was false. The
              `aria-label` below is therefore NOT what makes this accessible; it's
              redundant, not load-bearing. `aria-label` wins accname precedence over
              label-wrapping when both are present, but `labelOf` was written to
              mirror `mark`'s rendered text exactly, so the wrapping <label> alone
              would already produce the identical name — belt-and-suspenders, kept
              for that reason, not removed. The "(obrigatório)" suffix still has to
              live IN the name either way (not an `aria-required` attribute),
              because the button role supports no `aria-required`. */}
          <DatePicker
            value={draft.dateOfBirth}
            onChange={(v) => set("dateOfBirth", v)}
            disabled={disabled}
            aria-label={labelOf("date_of_birth")}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">
            Prontuário
            {mark("mrn")}
          </span>
          <input
            type="text"
            value={draft.mrn}
            onChange={(e) => set("mrn", e.target.value)}
            disabled={disabled}
            aria-required={ariaRequired("mrn")}
            className={FIELD_CLASS}
            autoComplete="off"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">
            Atendimento
            {mark("encounter_ref")}
          </span>
          <input
            type="text"
            value={draft.encounterRef}
            onChange={(e) => set("encounterRef", e.target.value)}
            disabled={disabled}
            aria-required={ariaRequired("encounter_ref")}
            className={FIELD_CLASS}
            autoComplete="off"
            placeholder="Ex.: nº do atendimento"
          />
        </label>

        {!hideUnit && (
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
        )}

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">
            Profissional responsável
            {mark("attending")}
          </span>
          <input
            type="text"
            value={draft.attending}
            onChange={(e) => set("attending", e.target.value)}
            disabled={disabled}
            aria-required={ariaRequired("attending")}
            className={FIELD_CLASS}
            autoComplete="off"
          />
        </label>
      </div>
    </fieldset>
  );
}

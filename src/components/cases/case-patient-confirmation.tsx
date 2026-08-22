"use client";

import { CheckCircle2 } from "lucide-react";

import type { PatientDraft } from "@/components/safety/patient-fields";

/**
 * Post-creation confirmation of the patient identifiers the user just typed
 * (ADR 0134 §A2.4). A `create_cases` Administrativo can WRITE identifiers at
 * creation and can never read them back, so a mistyped MRN would otherwise surface
 * months later to a coordinator who cannot know who typed it. This catches it at the
 * keyboard.
 *
 * ⛔ THE VALUES COME FROM THE CLIENT, NEVER FROM THE SERVER — and that is a deliberate
 * narrowing, not a shortcut (ADR 0134 §A2.4, lead ruling 2026-08-22). Option D grants a
 * write and grants no read, ever; a response body carrying identifier values back to a
 * principal with no `read_standard_phi` is a PHI read path wearing a different name.
 * The creation response carries STRUCTURE only — which field names were set — and this
 * component pairs those names with the values the user submitted moments ago and still
 * holds in component state. Do not "simplify" this by having the server echo values.
 *
 * ⚠ WHAT THIS DOES NOT CATCH, stated so the copy never over-claims: it shows what was
 * TYPED, not what was STORED. A server-side normalization difference (trimming, the
 * derived keys, the ADR-0038 name-or-MRN floor) is invisible here by design. The copy
 * therefore says "o que você digitou" and never "o que foi salvo".
 */

/**
 * The server's field names (snake_case, as `patientFieldsSet` returns them) mapped to
 * a pt-BR label and the draft key holding the value the user typed. Labels match
 * `PatientFields`, so the confirmation reads back in the same words as the form.
 * `sex` is absent on purpose: the server never reports it (it always has a value).
 */
const FIELDS: Record<string, { label: string; from: keyof PatientDraft }> = {
  name: { label: "Nome", from: "name" },
  mrn: { label: "Prontuário", from: "mrn" },
  date_of_birth: { label: "Data de nascimento", from: "dateOfBirth" },
  age_years: { label: "Idade", from: "ageYears" },
  encounter_ref: { label: "Atendimento", from: "encounterRef" },
  unit: { label: "Unidade / setor", from: "unit" },
  attending: { label: "Profissional responsável", from: "attending" },
};

export function CasePatientConfirmation({
  fieldsSet,
  draft,
  headingId,
}: {
  /** Field names the creation response reported as set — names only, never values. */
  fieldsSet: readonly string[];
  /** The draft the user submitted; the ONLY source of the values shown. */
  draft: PatientDraft;
  headingId: string;
}) {
  const rows = fieldsSet
    .map((key) => {
      const field = FIELDS[key];
      if (!field) return null;
      const value = String(draft[field.from] ?? "").trim();
      if (!value) return null;
      return { key, label: field.label, value };
    })
    .filter((r): r is { key: string; label: string; value: string } => r !== null);

  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby={headingId}
      className="animate-rise-in flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
    >
      <h3 id={headingId} className="flex items-center gap-2 text-base font-semibold">
        <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
        Caso criado. Confira o que você digitou.
      </h3>
      <p className="max-w-prose text-sm text-muted-foreground text-pretty">
        Estes são os identificadores que você digitou nesta tela, repetidos aqui para
        você conferir agora. Encontrou um erro? Corrija no caso ou avise a coordenação
        da comissão.
      </p>
      <dl className="flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-border/60 pb-2 last:border-b-0 last:pb-0"
          >
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {row.label}
            </dt>
            <dd className="text-sm font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

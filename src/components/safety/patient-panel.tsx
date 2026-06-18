import { ShieldAlert } from "lucide-react";

import {
  PATIENT_SEX_LABELS,
  type EventPatient,
} from "@/lib/safety/types";
import { formatDate } from "./format";

/**
 * The isolated PHI patient panel (F4) on the event detail. Server-rendered: the
 * page loads the patient via the AUDITED `getEventPatient` (which emits the
 * `event_patient.read` audit row server-side — Rule 11/12) and passes the result
 * here. This component does NO data access — it only renders the minimum-necessary
 * identifiers it is handed.
 *
 * NEVER rendered on a list/queue/timeline — only on the in-scope detail. The
 * page gates on {@link SafetyEvent.hasPatient} so the audited read fires only when
 * a record exists. A clearly-marked, slightly-emphasized panel signals that this
 * is protected data.
 *
 * `patient = null` here means "in scope but no PHI record" — the page renders the
 * empty state instead; a caller OUT of scope never reaches this component (the
 * page does not render it).
 */
export function PatientPanel({ patient }: { patient: EventPatient }) {
  const fields: { label: string; value: string | null }[] = [
    { label: "Nome", value: patient.name },
    { label: "Prontuário", value: patient.mrn },
    {
      label: "Data de nascimento",
      value: patient.dateOfBirth ? formatDate(patient.dateOfBirth) : null,
    },
    {
      label: "Idade",
      value:
        patient.ageYears != null ? `${patient.ageYears} anos` : null,
    },
    { label: "Sexo", value: PATIENT_SEX_LABELS[patient.sex] },
    { label: "Atendimento / internação", value: patient.encounterRef },
    { label: "Unidade / setor", value: patient.unit },
    { label: "Profissional responsável", value: patient.attending },
  ].filter((f) => f.value);

  return (
    <section
      aria-labelledby="patient-panel-heading"
      className="flex flex-col gap-4 rounded-2xl border border-warning/30 bg-warning/8 p-5 shadow-xs"
    >
      <div className="flex items-center gap-2">
        <ShieldAlert aria-hidden="true" className="size-4 text-warning" />
        <h2 id="patient-panel-heading" className="text-base font-semibold">
          Identificação do paciente
        </h2>
        <span className="rounded-full border border-warning/30 bg-warning/12 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-warning uppercase">
          Dados sensíveis
        </span>
      </div>

      <p className="text-xs text-muted-foreground text-pretty">
        Acesso registrado em trilha de auditoria. Use apenas para a análise do
        evento (mínimo necessário).
      </p>

      {fields.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
          Registro de paciente sem identificadores informados.
        </p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label} className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {f.label}
              </dt>
              <dd className="text-sm text-foreground">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/**
 * The empty/affordance state when an event has NO isolated PHI record (or the
 * caller is in scope but no record exists). Rendered instead of the panel so the
 * detail stays calm and the audited read is never called for a missing record.
 */
export function PatientPanelEmpty() {
  return (
    <section
      aria-labelledby="patient-panel-empty-heading"
      className="flex flex-col gap-2 rounded-2xl border border-dashed border-border bg-card/50 p-5"
    >
      <div className="flex items-center gap-2">
        <ShieldAlert
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
        <h2
          id="patient-panel-empty-heading"
          className="text-base font-semibold"
        >
          Identificação do paciente
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Nenhum dado de paciente registrado para este evento.
      </p>
    </section>
  );
}

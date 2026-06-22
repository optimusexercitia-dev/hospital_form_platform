"use client";

import { useState, useTransition } from "react";
import { Eye, ShieldAlert } from "lucide-react";

import { CASE_PATIENT_SEX_LABELS, type CasePatient } from "@/lib/cases/types";
import type { SetCasePatientInput } from "@/lib/cases/types";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { formatDate } from "@/components/cases/format";
import { CasePatientEditDialog } from "@/components/cases/case-patient-edit-dialog";

/**
 * The LAZY, AUDITED isolated-PHI panel on the case detail (ADR 0038; Rule 12) —
 * the THIRD PHI module, modeled on the referral panel. Direct SELECT on
 * `case_patient` is REVOKED; the only door is the audited `revealCasePatient`
 * server action, which re-gates the BROAD `can_read_case` predicate and emits a
 * `case_patient.read` audit row SERVER-SIDE. So we load ON CLICK — never on page
 * open — so the audited read fires exactly when a reader chooses to see the
 * identifiers.
 *
 * Access nuance (ADR 0038): the read scope here is DELIBERATELY looser than the
 * other two PHI modules — a phase/narrative assignee or a case grantee CAN reveal,
 * because they need the MRN to do the work. So `null` back (the rare out-of-scope
 * case) gets a calm "sem acesso" state, not a raw error. WRITES stay
 * coordinator-only: the edit affordance renders only when `canEdit`.
 *
 * The reveal + save doors are injected as props (bound by the page to the case id),
 * keeping this client component free of any server-only import (Rule 9).
 */
export function CasePatientPanel({
  hasPatient,
  canEdit,
  onReveal,
  onSave,
}: {
  /** Denormalized flag — an isolated PHI record exists. Gates the revealed body. */
  hasPatient: boolean;
  /** Whether the viewer may edit (coordinator/admin — `canManageLifecycle`). */
  canEdit: boolean;
  /** The audited reveal door, bound by the page to the case id. */
  onReveal: () => Promise<CasePatient | null>;
  /** The PHI upsert door, bound by the page to the case id (coordinator edit). */
  onSave: (input: SetCasePatientInput) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState(false);
  const [patient, setPatient] = useState<CasePatient | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reveal() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await onReveal();
        setRevealed(true);
        if (result) {
          setPatient(result);
          setDenied(false);
        } else {
          // null = out of scope OR no record. The panel only mounts this when
          // `patient_enabled`; the body only renders when `hasPatient`, so null
          // here means the (rare) caller isn't entitled.
          setPatient(null);
          setDenied(true);
        }
      } catch {
        setError(
          "Não foi possível carregar a identificação do paciente. Tente novamente.",
        );
      }
    });
  }

  /** After a coordinator saves, re-fire the audited read so the panel reflects it. */
  function refreshAfterSave() {
    startTransition(async () => {
      try {
        const result = await onReveal();
        setRevealed(true);
        setPatient(result);
        setDenied(!result);
      } catch {
        // Non-fatal — the save succeeded; a refresh failure leaves the prior view.
      }
    });
  }

  const editControl = canEdit ? (
    <CasePatientEditDialog
      hasPatient={hasPatient}
      onReveal={onReveal}
      onSave={onSave}
      onSaved={refreshAfterSave}
    />
  ) : null;

  // No isolated PHI record on this case yet — quiet empty state. A coordinator can
  // add identifiers from here; everyone else sees the calm placeholder.
  if (!hasPatient) {
    return (
      <section
        aria-labelledby="case-patient-empty-heading"
        className="flex flex-col gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-5"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2
            id="case-patient-empty-heading"
            className="text-base font-semibold"
          >
            Identificação do paciente
          </h2>
        </div>
        <p className="text-sm text-muted-foreground text-pretty">
          Nenhum dado de paciente registrado neste caso.
        </p>
        {editControl}
      </section>
    );
  }

  const fields: { label: string; value: string | null }[] = patient
    ? [
        { label: "Nome", value: patient.name },
        { label: "Prontuário", value: patient.mrn },
        {
          label: "Data de nascimento",
          value: patient.dateOfBirth ? formatDate(patient.dateOfBirth) : null,
        },
        {
          label: "Idade",
          value: patient.ageYears != null ? `${patient.ageYears} anos` : null,
        },
        { label: "Sexo", value: CASE_PATIENT_SEX_LABELS[patient.sex] },
        { label: "Atendimento / internação", value: patient.encounterRef },
        { label: "Unidade / setor", value: patient.unit },
        { label: "Profissional responsável", value: patient.attending },
      ].filter((f) => f.value)
    : [];

  return (
    <section
      aria-labelledby="case-patient-heading"
      className="flex flex-col gap-4 rounded-2xl border border-warning/30 bg-warning/8 p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center gap-2">
        <ShieldAlert aria-hidden="true" className="size-4 text-warning" />
        <h2 id="case-patient-heading" className="text-base font-semibold">
          Identificação do paciente
        </h2>
        <span className="rounded-full border border-warning/30 bg-warning/12 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-warning uppercase">
          Dados sensíveis
        </span>
      </div>

      <p className="text-xs text-muted-foreground text-pretty">
        Acesso registrado em trilha de auditoria. Use apenas para o trabalho do
        caso (mínimo necessário).
      </p>

      {error && <FormBanner tone="error">{error}</FormBanner>}

      {!revealed ? (
        <div className="flex flex-wrap items-start gap-3">
          <p className="w-full text-sm text-muted-foreground text-pretty">
            Os dados do paciente estão protegidos. Ao exibir, o acesso será
            registrado em seu nome.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={reveal}
            disabled={isPending}
          >
            <Eye aria-hidden="true" />
            {isPending ? "Carregando…" : "Exibir identificação"}
          </Button>
          {editControl}
        </div>
      ) : denied ? (
        <div className="flex flex-col gap-3">
          <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground text-pretty">
            Você não tem acesso à identificação do paciente deste caso. O acesso é
            liberado à coordenação e aos responsáveis pelo caso.
          </p>
          {editControl}
        </div>
      ) : fields.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
            Registro de paciente sem identificadores informados.
          </p>
          {editControl}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
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
          {editControl}
        </div>
      )}
    </section>
  );
}

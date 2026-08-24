"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";

import type { CasePatient, SetCasePatientInput } from "@/lib/cases/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import {
  EMPTY_PATIENT_DRAFT,
  PATIENT_REQUIRED_FIELD_LABELS,
  PatientFields,
  patientDraftMissingRequired,
  patientDraftToInput,
  type PatientDraft,
} from "@/components/safety/patient-fields";
// ⚠ TYPE-ONLY — `@/lib/queries/cases` is a server query module; a value import from
// a client component aborts `next build` while tsc/lint/vitest stay green.
import type { PatientRequiredField } from "@/lib/queries/cases";

/** Map a revealed {@link CasePatient} into the editable draft (camelCase strings). */
function patientToDraft(patient: CasePatient): PatientDraft {
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

/**
 * The COORDINATOR-only edit dialog for a case's isolated patient identifiers (ADR
 * 0038). Mounted by {@link CasePatientPanel} only when the viewer
 * `canManageLifecycle` (staff_admin of the case's commission / admin) — assignees
 * can REVEAL but not edit. On open, it pre-fills from a fresh audited
 * `revealCasePatient` read (so the form shows the current values without the
 * detail page eagerly loading PHI). Save goes through `setCasePatient`, which
 * enforces the name-or-MRN floor server-side; its pt-BR error surfaces inline.
 *
 * The reveal + save doors are injected as props (bound by the page to the case id)
 * so this client component imports no server-only module (Rule 9).
 */
export function CasePatientEditDialog({
  hasPatient,
  requiredFields = [],
  onReveal,
  onSave,
  onSaved,
}: {
  /** Whether an isolated PHI record already exists — switches label/copy. */
  hasPatient: boolean;
  /**
   * The identifier fields this CASE requires (ADR 0137 D2/D3 layer 3) — the case's
   * OWN snapshotted `patient_required_fields`, never the template's live set: the
   * mode is frozen at creation (`app.guard_case_patient_mode_immutable`, HC0T3) and
   * a later template edit must not retroactively change what an open case demands.
   * Empty for `optional`/`none` cases, which is every case that predates D1.
   *
   * ⛔ OFFER LAYER ONLY. `app._set_participant_patient_unchecked` is D3's enforcement
   * point and refuses regardless (HC0T1, naming the missing fields in pt-BR). This
   * exists so the coordinator is told BEFORE the round trip, which is the whole
   * point of layer 3 — the create dialog has had it since the batch; this dialog
   * marked nothing, so the same template disagreed with itself depending on which
   * surface you reached it from (FUP-0137-CASE-PATIENT-EDIT-NOT-MARKED).
   */
  requiredFields?: readonly PatientRequiredField[];
  /** The audited reveal door (bound to the case id) — pre-fills the form on open. */
  onReveal: () => Promise<CasePatient | null>;
  /** The PHI upsert door (bound to the case id). */
  onSave: (input: SetCasePatientInput) => Promise<{ ok: boolean; error?: string }>;
  /** Called after a successful save so the parent can refresh the revealed view. */
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PatientDraft>(EMPTY_PATIENT_DRAFT);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    // Pre-fill from a fresh audited read each time the dialog opens.
    setError(null);
    setDraft(EMPTY_PATIENT_DRAFT);
    if (!hasPatient) return;
    setLoading(true);
    startTransition(async () => {
      try {
        const current = await onReveal();
        if (current) setDraft(patientToDraft(current));
      } catch {
        setError(
          "Não foi possível carregar a identificação atual. Você ainda pode preencher os campos.",
        );
      } finally {
        setLoading(false);
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await onSave(patientDraftToInput(draft));
      if (!result.ok) {
        setError(
          result.error ??
            "Não foi possível salvar a identificação do paciente. Tente novamente.",
        );
        return;
      }
      setOpen(false);
      onSaved?.();
    });
  }

  const busy = isPending || loading;
  const missingRequired = patientDraftMissingRequired(draft, requiredFields);
  // ⛔ UX gate ONLY, exactly as in `create-case-dialog.tsx` — the DB is the
  // authority. Suppressed while `loading`, because the draft is still EMPTY until
  // the audited reveal lands: gating on it then would tell a coordinator their
  // complete record is missing every field, which is the "a green gate can mean the
  // fixture cannot reach the state" shape pointed the other way.
  const requiredBlocked = !loading && missingRequired.length > 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => handleOpenChange(true)}
      >
        <Pencil aria-hidden="true" />
        {hasPatient ? "Editar identificação" : "Adicionar identificação"}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {hasPatient
                ? "Editar identificação do paciente"
                : "Adicionar identificação do paciente"}
            </DialogTitle>
            <DialogDescription>
              Informe ao menos o nome ou o prontuário. Os dados são sensíveis,
              ficam isolados e todo acesso é registrado em auditoria.
            </DialogDescription>
          </DialogHeader>

          {error && <FormBanner tone="error">{error}</FormBanner>}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            {/* ADR 0137 D9 — a CASE surface collects neither "Unidade / setor" nor
                "Idade". Hiding, not clearing: the draft is prefilled from the audited
                reveal, so a record that already carries either keeps it through a
                save (`patientDraftToInput` still sends the untouched values and the
                columns are unchanged). Safety-event + referral flows keep both. */}
            <PatientFields
              draft={draft}
              onChange={setDraft}
              disabled={busy}
              idPrefix="case-patient-edit"
              hideUnit
              requiredFields={requiredFields}
            />
            {/* Names the outstanding fields rather than only greying the button.
                `role="status"` (polite) — it updates on every keystroke, and an
                assertive region would interrupt typing. Mirrors the create dialog
                word for word so the two surfaces cannot drift into two vocabularies
                for one rule. */}
            {requiredBlocked && (
              <p role="status" className="text-sm font-medium text-muted-foreground">
                Faltam preencher:{" "}
                {missingRequired
                  .map((f) => PATIENT_REQUIRED_FIELD_LABELS[f])
                  .join(", ")}
                .
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => handleOpenChange(false)}
                disabled={busy}
              >
                Cancelar
              </Button>
              <Button type="submit" size="lg" disabled={busy || requiredBlocked}>
                {isPending && !loading ? "Salvando…" : "Salvar identificação"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

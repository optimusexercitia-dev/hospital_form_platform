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
  PatientFields,
  patientDraftToInput,
  type PatientDraft,
} from "@/components/safety/patient-fields";

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
  onReveal,
  onSave,
  onSaved,
}: {
  /** Whether an isolated PHI record already exists — switches label/copy. */
  hasPatient: boolean;
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
            <PatientFields
              draft={draft}
              onChange={setDraft}
              disabled={busy}
              idPrefix="case-patient-edit"
            />
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
              <Button type="submit" size="lg" disabled={busy}>
                {isPending && !loading ? "Salvando…" : "Salvar identificação"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

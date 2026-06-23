"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldAlert } from "lucide-react";

import {
  createCaseFromTemplate,
  type CreateCaseState,
} from "@/lib/cases/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormBanner } from "@/components/auth/form-banner";
import {
  EMPTY_PATIENT_DRAFT,
  PatientFields,
  type PatientDraft,
} from "@/components/safety/patient-fields";

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

interface TemplateOption {
  id: string;
  title: string;
  /**
   * Whether the process collects patient identifiers (ADR 0038). Snapshotted into
   * `cases.patient_enabled` at creation. When `true` AND the `case_patient` flag is
   * on, the dialog offers the optional PHI block. Defaults to `false`.
   */
  collectsPatient: boolean;
}

/**
 * "Novo caso" create flow. Mints a case from a published process template
 * (snapshotting its phases + pinning published versions). On success the action
 * returns the new `{ caseId }`; if the selected process COLLECTS patient
 * identifiers and the reporter filled any, we write the isolated PHI row
 * (`setCasePatient`) BEFORE navigating into the case detail — mirroring the NSP
 * notify→set-patient sequence (a PHI-write failure is non-blocking; the case still
 * exists and the identifiers can be added from the detail panel).
 *
 * Patient identifiers (ADR 0038 — the THIRD PHI module) are captured in the
 * SANCTIONED block below (only when the process collects them and the
 * `case_patient` flag is on). The case is still identified by its minted NUMBER —
 * the free-text LABEL must stay non-identifying (that is what the warning is
 * about), independent of the structured PHI block.
 */
export function CreateCaseDialog({
  slug,
  templates,
  casePatientEnabled = false,
}: {
  slug: string;
  templates: TemplateOption[];
  /** Whether the `case_patient` flag is on (gates the optional PHI block). */
  casePatientEnabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<
    CreateCaseState | undefined,
    FormData
  >(createCaseFromTemplate, undefined);
  const router = useRouter();

  // The selected process — drives whether the optional PHI block is offered.
  const [templateId, setTemplateId] = useState("");
  const [patient, setPatient] = useState<PatientDraft>(EMPTY_PATIENT_DRAFT);

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
  const showPatientBlock = Boolean(
    casePatientEnabled && selectedTemplate?.collectsPatient,
  );

  useEffect(() => {
    if (!state?.ok || !state.caseId) return;
    // Case minted (and its optional PHI written atomically server-side, inside
    // `createCaseFromTemplate` — no separate client round-trip to race the
    // navigation/revalidation, so identifiers are never silently lost). Navigate.
    router.push(`/c/${slug}/manage/cases/${state.caseId}`);
    // Key only on the action result; slug/router are stable for a given mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const labelField = useFieldIds("label", { hasDescription: true });
  const disabled = templates.length === 0;
  const busy = isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" disabled={disabled}>
          <Plus aria-hidden="true" />
          Novo caso
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo caso</DialogTitle>
          <DialogDescription>
            Crie um caso a partir de um processo publicado. As fases do processo
            serão copiadas para o caso no estado atual.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && !state.fieldErrors?.templateId && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Processo</span>
            <select
              name="templateId"
              className={SELECT_CLASS}
              required
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              aria-invalid={state?.fieldErrors?.templateId ? true : undefined}
            >
              <option value="" disabled>
                Selecione um processo…
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            {state?.fieldErrors?.templateId && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.templateId}
              </span>
            )}
          </label>

          <Field>
            <FieldLabel htmlFor={labelField.controlProps.id}>
              Rótulo{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </FieldLabel>
            <Input
              {...labelField.controlProps}
              type="text"
              placeholder="Ex.: Óbito UTI leito 7"
              maxLength={120}
            />
            <FieldDescription id={labelField.descriptionId}>
              Uma referência curta e não identificável para você localizar o caso.
            </FieldDescription>
          </Field>

          {/* Label PII warning — about the free-text RÓTULO only (the structured
              patient block below is the sanctioned place for identifiers). Prominent,
              role=note, never color-only. */}
          <p
            role="note"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive text-pretty"
          >
            <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              Não inclua dados de paciente no rótulo (nome, prontuário, data de
              nascimento ou qualquer identificador). O caso é identificado pelo seu
              número.
            </span>
          </p>

          {/* Sanctioned, optional patient-identifier block (ADR 0038) — rendered
              only when the chosen process collects patient identifiers and the
              `case_patient` flag is on. Reuses the NSP/referral PatientFields. */}
          {showPatientBlock && (
            <>
              <PatientFields
                draft={patient}
                onChange={setPatient}
                disabled={busy}
                idPrefix="create-case-patient"
              />
              {/* The PatientFields inputs are controlled (no `name`), so mirror the
                  draft into hidden fields — this submits the PHI WITH the case in a
                  single request, where `createCaseFromTemplate` writes it
                  atomically (no post-create round-trip to race navigation). */}
              <input type="hidden" name="patientName" value={patient.name} />
              <input type="hidden" name="patientMrn" value={patient.mrn} />
              <input
                type="hidden"
                name="patientDateOfBirth"
                value={patient.dateOfBirth}
              />
              <input
                type="hidden"
                name="patientAgeYears"
                value={patient.ageYears}
              />
              <input type="hidden" name="patientSex" value={patient.sex} />
              <input
                type="hidden"
                name="patientEncounterRef"
                value={patient.encounterRef}
              />
              <input type="hidden" name="patientUnit" value={patient.unit} />
              <input
                type="hidden"
                name="patientAttending"
                value={patient.attending}
              />
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? "Criando…" : "Criar caso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

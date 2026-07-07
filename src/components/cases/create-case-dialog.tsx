"use client";

import { commissionHref } from "@/lib/routing";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldAlert } from "lucide-react";

import {
  createCase,
  createCaseFromTemplate,
  type CreateCaseState,
} from "@/lib/cases/actions";
import type { CaseOutcome } from "@/lib/queries/case-outcomes";
import type { Department } from "@/lib/hospitals/departments";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { NativeSelect } from "@/components/ui/native-select";
import {
  EMPTY_PATIENT_DRAFT,
  PatientFields,
  type PatientDraft,
} from "@/components/safety/patient-fields";
import { OutcomeMultiselect } from "@/components/cases/outcome-multiselect";
import { CaseDepartmentField } from "@/components/cases/case-department-field";


/** The sentinel `templateId` value that switches the dialog into the process-less flow. */
const PROCESSLESS = "__processless__";

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
 * The OPTIONAL patient (PHI) hidden-mirror block — submits the controlled
 * `PatientDraft` WITH the create request in a single round-trip (the create action
 * writes it atomically server-side, so identifiers are never lost to a navigation
 * race). Field names match what `createCase` / `createCaseFromTemplate` read.
 * Rendered only inside a branch that actually collects PHI.
 */
function PatientHiddenFields({ patient }: { patient: PatientDraft }) {
  return (
    <>
      <input type="hidden" name="patientName" value={patient.name} />
      <input type="hidden" name="patientMrn" value={patient.mrn} />
      <input type="hidden" name="patientDateOfBirth" value={patient.dateOfBirth} />
      <input type="hidden" name="patientAgeYears" value={patient.ageYears} />
      <input type="hidden" name="patientSex" value={patient.sex} />
      <input type="hidden" name="patientEncounterRef" value={patient.encounterRef} />
      <input type="hidden" name="patientUnit" value={patient.unit} />
      <input type="hidden" name="patientAttending" value={patient.attending} />
    </>
  );
}

/** The PII warning about the free-text RÓTULO (not the structured PHI block). */
function LabelPiiWarning() {
  return (
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
  );
}

/**
 * "Novo caso" create flow. Two paths share one dialog:
 *
 *  - **Templated** (unchanged): mints a case from a published process template
 *    (snapshotting its phases + pinning published versions) via
 *    `createCaseFromTemplate`. Its optional PHI block stays gated by
 *    `selectedTemplate.collectsPatient && casePatientEnabled`.
 *  - **Process-less** ("Sem processo", `processless_cases`): a top sentinel option
 *    switches the dialog into a TWO-STEP wizard backed by `createCase` — a case
 *    with `template_id` NULL, zero phases, an OPTIONAL hand-picked offered-outcome
 *    set (gated by `casesExtrasEnabled`), and OPTIONAL patient identifiers (gated by
 *    `casePatientEnabled`). The select stays mounted so the user can switch back.
 *
 * On success either action returns the new `{ caseId }`; we navigate into the case
 * detail and close. Patient identifiers (ADR 0038) are written atomically in the
 * SAME request as creation — the case is still identified by its minted NUMBER, so
 * the free-text LABEL must stay non-identifying (that is what the warning is about).
 */
export function CreateCaseDialog({
  org,
  slug,
  templates,
  commissionId,
  departments = [],
  casePatientEnabled = false,
  processlessEnabled = false,
  casesExtrasEnabled = false,
  outcomes = [],
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  templates: TemplateOption[];
  /** The commission id — required for the process-less `create_case` path. */
  commissionId: string;
  /**
   * The case's hospital ACTIVE departments (Hospital Departments) — the options
   * for the case-level, NON-PHI "Unidade / setor" dropdown. `[]` → the field is
   * still shown with only the "Outros" custom option (the field is optional).
   */
  departments?: Department[];
  /** Whether the `case_patient` flag is on (gates the optional PHI block + step). */
  casePatientEnabled?: boolean;
  /** Whether the `processless_cases` flag is on (gates the "Sem processo" option). */
  processlessEnabled?: boolean;
  /** Whether the `cases_extras` flag is on (gates the outcome sub-step). */
  casesExtrasEnabled?: boolean;
  /** The commission's non-archived outcome vocabulary (process-less outcome picker). */
  outcomes?: CaseOutcome[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Two action states: the existing templated minter and the process-less minter.
  // The active one is chosen by `isProcessless`; both feed the same success effect.
  const [templatedState, templatedAction, templatedPending] = useActionState<
    CreateCaseState | undefined,
    FormData
  >(createCaseFromTemplate, undefined);
  const [processlessState, processlessAction, processlessPending] = useActionState<
    CreateCaseState | undefined,
    FormData
  >(createCase, undefined);

  // The selected process — drives the templated PHI block + the flow branch.
  const [templateId, setTemplateId] = useState("");
  const [patient, setPatient] = useState<PatientDraft>(EMPTY_PATIENT_DRAFT);

  // Process-less wizard state.
  const [step, setStep] = useState<1 | 2>(1);
  const [emitsOutcome, setEmitsOutcome] = useState(false);
  const [selectedOutcomeIds, setSelectedOutcomeIds] = useState<string[]>([]);
  const [patientEnabled, setPatientEnabled] = useState(false);

  const isProcessless = processlessEnabled && templateId === PROCESSLESS;
  const state = isProcessless ? processlessState : templatedState;
  const formAction = isProcessless ? processlessAction : templatedAction;
  const busy = isProcessless ? processlessPending : templatedPending;

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
  const showTemplatedPatientBlock = Boolean(
    casePatientEnabled && selectedTemplate?.collectsPatient,
  );

  useEffect(() => {
    if (!state?.ok || !state.caseId) return;
    // Case minted (and its optional PHI written atomically server-side). Navigate
    // into the case detail — the push unmounts the dialog, so no explicit close is
    // needed (mirrors the original templated flow).
    router.push(commissionHref(org, slug, "manage", "cases", state.caseId));
    // Key only on the action result; slug/router are stable for a given mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Reset the wizard whenever the dialog (re)opens, so a re-open starts clean.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep(1);
    }
  }

  // Switching the select always returns to step 1 (the PHI step is only reachable
  // from a process-less step 1 with the PHI toggle on).
  function changeTemplate(next: string) {
    setTemplateId(next);
    setStep(1);
  }

  function toggleOutcome(id: string) {
    setSelectedOutcomeIds((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id],
    );
  }

  const labelField = useFieldIds("label", { hasDescription: true });
  const disabled = !processlessEnabled && templates.length === 0;

  // Whether step 1's primary can submit/advance. With the outcome toggle on, ≥1
  // outcome must be chosen.
  const outcomeBlocked = isProcessless && emitsOutcome && selectedOutcomeIds.length === 0;
  // The PHI step exists only when the case will be PHI-capable AND the flag is on.
  const showPatientStep = isProcessless && casePatientEnabled && patientEnabled;

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
            {isProcessless
              ? "Crie um caso sem processo. Você poderá adicionar fases avulsas conforme o trabalho avançar."
              : "Crie um caso a partir de um processo publicado. As fases do processo serão copiadas para o caso no estado atual."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && !state.fieldErrors?.templateId && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          {/* STEP 1 — process choice + (process-less) outcome config + PHI toggle.
              Hidden (not unmounted) on step 2 so the field values still submit. */}
          <div className={step === 2 ? "hidden" : "flex flex-col gap-4"}>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Processo</span>
              <NativeSelect
                name="templateId"
                className="h-10"
                required
                value={templateId}
                onChange={(e) => changeTemplate(e.target.value)}
                aria-invalid={state?.fieldErrors?.templateId ? true : undefined}
              >
                <option value="" disabled>
                  Selecione um processo…
                </option>
                {processlessEnabled && (
                  <option value={PROCESSLESS}>Sem processo</option>
                )}
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </NativeSelect>
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

            <LabelPiiWarning />

            {/* Case-level, NON-PHI department ("Unidade / setor"). Shown for BOTH
                the templated and process-less flows (it is not gated by PHI). Emits
                exactly one of departmentId / departmentOther; optional. */}
            <CaseDepartmentField departments={departments} disabled={busy} />

            {/* Process-less OUTCOME configuration (cases_extras). The "emite
                desfecho?" toggle mirrors into a hidden `emitsOutcome` input; when
                on, a multiselect over the commission vocabulary drives the repeated
                hidden `outcomeIds` inputs (≥1 required). */}
            {isProcessless && casesExtrasEnabled && (
              <fieldset className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4">
                <label className="flex items-start gap-2.5 text-sm">
                  <Checkbox
                    checked={emitsOutcome}
                    onCheckedChange={(c) => setEmitsOutcome(c === true)}
                    disabled={busy}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col">
                    <span className="font-medium">Emite desfecho?</span>
                    <span className="text-xs text-muted-foreground text-pretty">
                      Escolha os desfechos que este caso poderá receber. Com ao
                      menos um desfecho, será obrigatório registrá-lo ao concluir o
                      caso.
                    </span>
                  </span>
                </label>
                {/* Mirror the toggle into the form so the action reads it. */}
                {emitsOutcome && <input type="hidden" name="emitsOutcome" value="on" />}

                {emitsOutcome && (
                  <>
                    <OutcomeMultiselect
                      commissionId={commissionId}
                      outcomes={outcomes}
                      selected={selectedOutcomeIds}
                      onToggle={toggleOutcome}
                      disabled={busy}
                    />
                    {/* Repeated hidden inputs — one per selected id (backend reads
                        `formData.getAll('outcomeIds')`). */}
                    {selectedOutcomeIds.map((id) => (
                      <input key={id} type="hidden" name="outcomeIds" value={id} />
                    ))}
                    {state?.fieldErrors?.outcomeIds && (
                      <span role="alert" className="text-sm font-medium text-destructive">
                        {state.fieldErrors.outcomeIds}
                      </span>
                    )}
                  </>
                )}
              </fieldset>
            )}

            {/* Process-less PHI toggle (case_patient). On → the case is PHI-capable
                and step 2 reveals the identifier fields. */}
            {isProcessless && casePatientEnabled && (
              <label className="flex items-start gap-2.5 text-sm">
                <Checkbox
                  checked={patientEnabled}
                  onCheckedChange={(c) => setPatientEnabled(c === true)}
                  disabled={busy}
                  className="mt-0.5"
                />
                <span className="flex flex-col">
                  <span className="font-medium">
                    Registra identificadores de paciente?
                  </span>
                  <span className="text-xs text-muted-foreground text-pretty">
                    Permite registrar dados sensíveis do paciente neste caso (agora
                    ou depois). Mantenha desligado se o caso não envolve um paciente
                    identificável.
                  </span>
                </span>
              </label>
            )}
            {/* Mirror the PHI toggle for the action (only meaningful when on). */}
            {isProcessless && patientEnabled && (
              <input type="hidden" name="patientEnabled" value="on" />
            )}

            {/* Templated PHI block (ADR 0038) — only when the chosen process
                collects identifiers and the flag is on. */}
            {!isProcessless && showTemplatedPatientBlock && (
              <>
                <PatientFields
                  draft={patient}
                  onChange={setPatient}
                  disabled={busy}
                  idPrefix="create-case-patient"
                  hideUnit
                />
                <PatientHiddenFields patient={patient} />
              </>
            )}
          </div>

          {/* STEP 2 — process-less PHI fields (only reachable when the PHI toggle is
              on). The hidden mirrors live here too so an unmount of step 1 never
              drops them; step 1 stays mounted-but-hidden anyway. */}
          {showPatientStep && (
            <div className={step === 1 ? "hidden" : "flex flex-col gap-4"}>
              <p
                role="note"
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive text-pretty"
              >
                <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  Dados sensíveis de paciente (PHI). Informe somente o mínimo
                  necessário para a análise; o preenchimento é opcional e pode ser
                  feito depois, pelo painel do caso.
                </span>
              </p>
              <PatientFields
                draft={patient}
                onChange={setPatient}
                disabled={busy}
                idPrefix="create-case-processless-patient"
                hideUnit
              />
              <PatientHiddenFields patient={patient} />
            </div>
          )}

          {/* Always submit the commission id for the process-less path. */}
          <input type="hidden" name="commissionId" value={commissionId} />

          <DialogFooter>
            {/* Stable, DISTINCT keys per branch: without them React reconciles the
                two ternary buttons into ONE DOM node and merely patches `type`, so
                clicking "Próximo" (type=button) flips that same node to
                type=submit mid-click and the browser submits the form. Distinct
                keys force a fresh node per branch (BUG-PL-001). */}
            {showPatientStep && step === 2 ? (
              <Button
                key="back"
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setStep(1)}
                disabled={busy}
              >
                Voltar
              </Button>
            ) : (
              <Button
                key="cancel"
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancelar
              </Button>
            )}

            {showPatientStep && step === 1 ? (
              // PHI toggle on → advance to step 2 instead of submitting.
              <Button
                key="advance"
                type="button"
                size="lg"
                onClick={() => setStep(2)}
                disabled={busy || outcomeBlocked}
              >
                Próximo
              </Button>
            ) : (
              <Button
                key="submit"
                type="submit"
                size="lg"
                disabled={busy || outcomeBlocked}
              >
                {busy ? "Criando…" : "Criar caso"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

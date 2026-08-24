"use client";

import { commissionHref } from "@/lib/routing";
import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldAlert } from "lucide-react";

import {
  createCase,
  createCaseFromTemplate,
  type CreateCaseState,
} from "@/lib/cases/actions";
import type { CaseOutcome } from "@/lib/queries/case-outcomes";
import type { CaseType } from "@/lib/cases/case-types";
import type { CustomFieldDef } from "@/lib/queries/process-templates";
// ⚠ TYPE-ONLY — `@/lib/queries/cases` is a server query module.
import type { PatientMode, PatientRequiredField } from "@/lib/queries/cases";
import { CasePatientConfirmation } from "@/components/cases/case-patient-confirmation";
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
  PATIENT_REQUIRED_FIELD_LABELS,
  PatientFields,
  patientDraftMissingRequired,
  type PatientDraft,
} from "@/components/safety/patient-fields";
import { OutcomeMultiselect } from "@/components/cases/outcome-multiselect";
import {
  CustomFieldInput,
  isCustomFieldBlank,
  serializeCustomField,
  type CustomFieldValueDraft,
} from "@/components/cases/custom-field-input";


/** The sentinel `templateId` value that switches the dialog into the process-less flow. */
const PROCESSLESS = "__processless__";

interface TemplateOption {
  id: string;
  title: string;
  /**
   * How the process collects patient identifiers (ADR 0038; ADR 0137 **D1**).
   * Snapshotted into `cases.patient_mode` at creation and immutable thereafter.
   * With the `case_patient` flag on, `'optional'` and `'required'` both reveal the
   * PHI block; `'required'` additionally marks {@link patientRequiredFields} and
   * gates the submit.
   *
   * ⛔ This was `collectsPatient: boolean` and it named the column
   * `cases.patient_enabled`, which ADR 0137 DROPPED — a boolean cannot express
   * `'required'`, which is why the mode existed in the DB for a release with no
   * user able to select it (QA C-1).
   */
  patientMode: PatientMode;
  /**
   * The identifier fields a `'required'` process demands (ADR 0137 **D2**); `[]`
   * for the other two modes. `mrn` is always a member — the LGPD erasure key.
   */
  patientRequiredFields: PatientRequiredField[];
  /**
   * The template's custom-field definitions (ADR 0083). When non-empty AND the
   * `case_custom_fields` flag is on, the dialog reveals a "Campos personalizados"
   * block (mirrors the PHI block's reveal). `[]` when the process defines none.
   */
  customFields: CustomFieldDef[];
}

/**
 * The patient (PHI) hidden-mirror block — submits the controlled `PatientDraft`
 * WITH the create request in a single round-trip (the create action writes it
 * atomically server-side, so identifiers are never lost to a navigation race).
 * Field names match what `createCase` / `createCaseFromTemplate` read. Rendered
 * only inside a branch that actually collects PHI — under `patient_mode`
 * `'optional'` OR `'required'` (ADR 0137 D1), not under a dropped boolean.
 */
function PatientHiddenFields({ patient }: { patient: PatientDraft }) {
  return (
    <>
      <input type="hidden" name="patientName" value={patient.name} />
      <input type="hidden" name="patientMrn" value={patient.mrn} />
      <input type="hidden" name="patientDateOfBirth" value={patient.dateOfBirth} />
      {/* ⛔ No `patientAgeYears` mirror (ADR 0137 D9): the case surfaces no longer
          COLLECT an age, so submitting one would mirror an input this dialog cannot
          show. `createCase` / `createCaseFromTemplate` still READ the field and the
          `age_years` column is untouched — an absent key is coerced to `null` by the
          action exactly as an empty string was. */}
      <input type="hidden" name="patientSex" value={patient.sex} />
      <input type="hidden" name="patientEncounterRef" value={patient.encounterRef} />
      <input type="hidden" name="patientUnit" value={patient.unit} />
      <input type="hidden" name="patientAttending" value={patient.attending} />
    </>
  );
}

/** The fill-time PHI warning above the custom-fields block (ADR 0083 D4).
 * Exported for reuse by the bulk-case wizard ("Múltiplos casos"). */
export function CustomFieldsPiiWarning() {
  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive text-pretty"
    >
      <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        Não inclua dados de paciente nos campos personalizados (nome, prontuário,
        data de nascimento ou qualquer identificador).
      </span>
    </p>
  );
}

/** The PII warning about the free-text RÓTULO (not the structured PHI block).
 * Exported for reuse by the bulk-case wizard ("Múltiplos casos"). */
export function LabelPiiWarning() {
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
 *    `createCaseFromTemplate`. Its PHI block is gated by
 *    `selectedTemplate.patientMode !== 'none' && casePatientEnabled`, and under
 *    `'required'` (ADR 0137 D3 layer 3) the named inputs are marked required and
 *    the submit is gated until they carry a value.
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
  casePatientEnabled = false,
  caseCustomFieldsEnabled = false,
  processlessEnabled = false,
  casesExtrasEnabled = false,
  outcomes = [],
  caseTypesEnabled = false,
  caseTypes = [],
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  templates: TemplateOption[];
  /** The commission id — required for the process-less `create_case` path. */
  commissionId: string;
  /** Whether the `case_patient` flag is on (gates the optional PHI block + step). */
  casePatientEnabled?: boolean;
  /** Whether the `case_custom_fields` flag is on (gates the custom-fields block; ADR 0083). */
  caseCustomFieldsEnabled?: boolean;
  /** Whether the `processless_cases` flag is on (gates the "Sem processo" option). */
  processlessEnabled?: boolean;
  /** Whether the `cases_extras` flag is on (gates the outcome sub-step). */
  casesExtrasEnabled?: boolean;
  /** The commission's non-archived outcome vocabulary (process-less outcome picker). */
  outcomes?: CaseOutcome[];
  /** Whether the `case_types` flag is on (gates the process-less type picker; ADR 0064 D4). */
  caseTypesEnabled?: boolean;
  /** The organization's ACTIVE case types (process-less type picker options). */
  caseTypes?: CaseType[];
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
  // Custom-field values (ADR 0083), keyed by the field `key`. Reset whenever the
  // selected process changes (each process defines its own field set).
  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, CustomFieldValueDraft>
  >({});

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
    casePatientEnabled && selectedTemplate && selectedTemplate.patientMode !== "none",
  );
  // ADR 0137 D3 layer 3. Empty unless the chosen process is in `'required'` mode —
  // which also means the process-less path never has required fields (it has no
  // template to carry a mode).
  const requiredPatientFields =
    showTemplatedPatientBlock && selectedTemplate?.patientMode === "required"
      ? selectedTemplate.patientRequiredFields
      : [];
  const missingPatientFields = patientDraftMissingRequired(
    patient,
    requiredPatientFields,
  );
  // ⛔ UX gate ONLY. `app.assert_patient_required_fields` is the authority (D3 —
  // "the DB layer is the one that counts") and refuses with a pt-BR message naming
  // the same fields; this only keeps the button from offering a submit that is
  // already known to fail. Never let an enforcement decision rest here.
  const patientBlocked = missingPatientFields.length > 0;
  // Custom fields (ADR 0083) — templated path only (D9: process-less cases get none),
  // and only when the selected process actually defines fields.
  const customFields =
    !isProcessless && caseCustomFieldsEnabled ? (selectedTemplate?.customFields ?? []) : [];
  const showCustomFields = customFields.length > 0;

  /**
   * Whether to hold the dialog open on a confirmation of the identifiers just typed
   * (ADR 0134 §A2.4) instead of navigating straight into the case. Only when the
   * creation actually recorded identifier fields — `patientFieldsSet` is the server's
   * STRUCTURAL report (field names, never values); the values come from `patient`.
   */
  const confirmFields = state?.ok ? (state.patientFieldsSet ?? []) : [];
  const awaitingPatientConfirmation = Boolean(
    state?.ok && state.caseId && confirmFields.length > 0,
  );

  useEffect(() => {
    if (!state?.ok || !state.caseId) return;
    // ⛔ A case that recorded identifiers does NOT auto-navigate: the whole point of
    // the confirmation is that the person who typed them sees them once, at the
    // keyboard. Navigating away is exactly the behaviour A2.4 exists to change.
    if (state.patientFieldsSet && state.patientFieldsSet.length > 0) return;
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
    setCustomFieldValues({});
  }

  function toggleOutcome(id: string) {
    setSelectedOutcomeIds((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id],
    );
  }

  const labelField = useFieldIds("label", {
    nameRequiredFor: "formData", hasDescription: true });
  // `controlProps` supplies both `id` and the form `name` the action reads.
  const caseTypeField = useFieldIds("caseTypeId", {
    nameRequiredFor: "formData", hasDescription: true });
  const disabled = !processlessEnabled && templates.length === 0;

  // Whether step 1's primary can submit/advance. With the outcome toggle on, ≥1
  // outcome must be chosen.
  const outcomeBlocked = isProcessless && emitsOutcome && selectedOutcomeIds.length === 0;
  // A required custom field left blank blocks creation (ADR 0083 D6). The server
  // re-enforces this (HC068); this is the client submit-gate.
  const customFieldsBlocked =
    showCustomFields &&
    customFields.some(
      (f) => f.required && isCustomFieldBlank(customFieldValues[f.key] ?? null),
    );
  // The PHI step exists only when the case will be PHI-capable AND the flag is on.
  const showPatientStep = isProcessless && casePatientEnabled && patientEnabled;
  const patientConfirmationHeadingId = useId();

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
            {awaitingPatientConfirmation
              ? "O caso foi criado. Confira os identificadores antes de continuar."
              : isProcessless
                ? "Crie um caso sem processo. Você poderá adicionar fases avulsas conforme o trabalho avançar."
                : "Crie um caso a partir de um processo publicado. As fases do processo serão copiadas para o caso no estado atual."}
          </DialogDescription>
        </DialogHeader>

        {awaitingPatientConfirmation ? (
          <div className="flex flex-col gap-4">
            <CasePatientConfirmation
              fieldsSet={confirmFields}
              draft={patient}
              headingId={patientConfirmationHeadingId}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                size="lg"
                onClick={() =>
                  router.push(
                    commissionHref(
                      org,
                      slug,
                      "manage",
                      "cases",
                      state!.caseId as string,
                    ),
                  )
                }
              >
                Continuar para o caso
              </Button>
            </div>
          </div>
        ) : (
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

            {/* ⛔ The case-level "Unidade / setor" field is REMOVED (ADR 0137 D9),
                not hidden — this dialog no longer collects a department at all. The
                columns (`department_id` / `department_other`), the RPC arguments and
                every stored value are UNTOUCHED: a case that already carries a
                department still renders it read-only on the detail page. A commission
                that genuinely needs a unit models it as a process CUSTOM FIELD (ADR
                0083).
                ⚠ Measured, and stated because the plan assumed otherwise: this was
                `CaseDepartmentField`'s LAST app call site apart from the edit-meta
                dialog, and after D9 that component had NO non-test consumer at all —
                dead code wearing a green check, since its own test kept `tsc`,
                eslint and `lint:vacuous` satisfied forever. PO-ruled DELETED
                2026-08-24 (FUP-CASE-DEPARTMENT-FIELD-HAS-NO-CONSUMER); the component
                and its test are gone. The hospital-admin surface is unaffected — it
                manages the department VOCABULARY through `DepartmentsManager`, which
                is a different component. */}

            {/* Process-less CASE TYPE (ADR 0064 D4). A templated case INHERITS its
                type from the process, so this only mounts for "Sem processo" — there
                is no template to inherit from and this picker is the sole channel.
                Empty = untyped (today's default). The chosen type supplies the case's
                default visibility + confidentiality, so it is access configuration,
                not just vocabulary. */}
            {isProcessless && caseTypesEnabled && caseTypes.length > 0 && (
              <Field>
                <FieldLabel htmlFor={caseTypeField.controlProps.id}>
                  Tipo de caso
                </FieldLabel>
                <NativeSelect
                  {...caseTypeField.controlProps}
                  defaultValue=""
                  disabled={busy}
                >
                  <option value="">Sem tipo definido</option>
                  {caseTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.displayName}
                    </option>
                  ))}
                </NativeSelect>
                <FieldDescription id={caseTypeField.descriptionId}>
                  Define o vocabulário e o nível de acesso padrão deste caso.
                </FieldDescription>
              </Field>
            )}

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
                collects identifiers (`patient_mode` ≠ `'none'`) and the flag is on.
                Under `'required'` (ADR 0137 D2/D3) the process names the fields that
                must carry a value; `PatientFields` marks exactly those. */}
            {!isProcessless && showTemplatedPatientBlock && (
              <>
                {requiredPatientFields.length > 0 && (
                  <p
                    role="note"
                    className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/12 px-3 py-2.5 text-sm text-pretty"
                  >
                    <ShieldAlert
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-warning"
                    />
                    <span>
                      Este processo exige a identificação do paciente. Preencha os
                      campos marcados como obrigatórios para criar o caso.
                    </span>
                  </p>
                )}
                <PatientFields
                  draft={patient}
                  onChange={setPatient}
                  disabled={busy}
                  idPrefix="create-case-patient"
                  hideUnit
                  requiredFields={requiredPatientFields}
                />
                {/* Names the outstanding fields rather than only greying the button —
                    `role="status"` (polite) because it updates on every keystroke and
                    an assertive region would interrupt typing. */}
                {patientBlocked && (
                  <p role="status" className="text-sm font-medium text-muted-foreground">
                    Faltam preencher:{" "}
                    {missingPatientFields
                      .map((f) => PATIENT_REQUIRED_FIELD_LABELS[f])
                      .join(", ")}
                    .
                  </p>
                )}
                <PatientHiddenFields patient={patient} />
              </>
            )}

            {/* Custom fields (ADR 0083) — templated path only, when the process
                defines fields and the flag is on. Required fields gate creation. */}
            {showCustomFields && (
              <fieldset className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4">
                <legend className="px-1 text-sm font-medium">
                  Campos personalizados
                </legend>
                <CustomFieldsPiiWarning />
                {customFields.map((field) => (
                  <CustomFieldInput
                    key={field.key}
                    field={field}
                    required={field.required}
                    disabled={busy}
                    idBase="create-case-custom"
                    value={customFieldValues[field.key] ?? null}
                    onChange={(v) =>
                      setCustomFieldValues((prev) => ({ ...prev, [field.key]: v }))
                    }
                  />
                ))}
                {/* Hidden mirrors — one `customField` JSON per field for the action. */}
                {customFields.map((field) => (
                  <input
                    key={`hidden-${field.key}`}
                    type="hidden"
                    name="customField"
                    value={serializeCustomField(
                      field.key,
                      customFieldValues[field.key] ?? null,
                    )}
                  />
                ))}
              </fieldset>
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
                disabled={busy || outcomeBlocked || customFieldsBlocked || patientBlocked}
              >
                {busy ? "Criando…" : "Criar caso"}
              </Button>
            )}
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

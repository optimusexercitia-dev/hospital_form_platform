"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldAlert } from "lucide-react";

import { setTemplatePatientMode } from "@/lib/cases/actions";
// ⚠ TYPE-ONLY — `@/lib/queries/cases` is a server query module (see the note in
// `patient-fields.tsx`); a value import here would abort `next build`.
import type { PatientMode, PatientRequiredField } from "@/lib/queries/cases";
import {
  PATIENT_REQUIRED_FIELD_LABELS,
  PATIENT_REQUIRED_FIELD_ORDER,
} from "@/components/safety/patient-fields";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * The process "Identificação do paciente" configuration (ADR 0038 — the THIRD PHI
 * module; ADR 0137 **D1/D2**; draft-only).
 *
 * ⛔ This was a BOOLEAN toggle until ADR 0137, and the file name is the last trace
 * of that. D1 replaced `collects_patient` with a three-mode setting, and this
 * control is the ONLY channel through which any of the three can be chosen — the
 * DB, the DEFINER doors and the pgTAP suite all supported `'required'` for a
 * release in which no user could turn it on (QA C-1). Deleting or narrowing this
 * picker makes the case-side MRN guarantee dormant again.
 *
 * - `none` — cases from this version carry no PHI block at all.
 * - `optional` — the block is offered at creation and may be left empty.
 * - `required` — every field in {@link PatientRequiredField} the coordinator ticks
 *   must be filled before the case can be created.
 *
 * **`mrn` is rendered SELECTED and NON-INTERACTIVE** (D2). It is the LGPD erasure
 * key — the only identifier that can answer *"which rows are this person's?"* on
 * demand — so it is welded into every required set. Non-interactive here means
 * `aria-disabled` on a control that KEEPS its place in the tab order and its
 * accessible name, never a hidden or omitted one: a coordinator must be able to
 * perceive that the prontuário is required and cannot be removed. The server welds
 * it too (`set_template_patient_mode`) with a CHECK constraint as backstop, so this
 * is a statement of the rule, not the rule itself.
 *
 * The setting is VERSION-scoped and snapshotted onto `cases.patient_mode` at
 * creation, so a change here only ever affects cases minted from a later published
 * version; live cases are immutable (`app.guard_case_patient_mode_immutable`).
 *
 * Persists immediately via `setTemplatePatientMode`; optimistic with revert on
 * failure. The shell mounts it for DRAFT versions only, and only while the
 * `case_patient` flag is on — when the flag is off the platform is byte-identical
 * to before this feature.
 */
export function PatientModePicker({
  templateVersionId,
  patientMode,
  patientRequiredFields,
}: {
  templateVersionId: string;
  /** The version's current collection mode (drives the radio group). */
  patientMode: PatientMode;
  /** The version's current required set; `mrn` is always a member when required. */
  patientRequiredFields: readonly PatientRequiredField[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<PatientMode>(patientMode);
  const [fields, setFields] = useState<PatientRequiredField[]>(() =>
    PATIENT_REQUIRED_FIELD_ORDER.filter((f) => patientRequiredFields.includes(f)),
  );
  const descriptionId = useId();
  const mrnNoteId = useId();
  const radioName = useId();

  /**
   * Write the pair, optimistically. Mode and set are ONE decision server-side
   * (`set_template_patient_mode` takes both), so they are sent together — sending
   * them as two calls would leave a `required` version with an empty set visible
   * between the two, which is a state the CHECK constraint refuses anyway.
   */
  function persist(nextMode: PatientMode, nextFields: PatientRequiredField[]) {
    const prevMode = mode;
    const prevFields = fields;
    setMode(nextMode);
    setFields(nextFields);
    setError(null);
    startTransition(async () => {
      const res = await setTemplatePatientMode(templateVersionId, nextMode, nextFields);
      if (!res.ok) {
        setMode(prevMode);
        setFields(prevFields);
        setError(
          res.error ?? "Não foi possível salvar a configuração de identificação.",
        );
        return;
      }
      router.refresh();
    });
  }

  function changeMode(next: PatientMode) {
    if (next === mode) return;
    // Leaving `required` clears the set (the RPC stores `[]` for the other two
    // modes), so a later flip back cannot silently reactivate fields nobody
    // re-picked. Entering it starts at the welded minimum.
    persist(next, next === "required" ? ["mrn"] : []);
  }

  function toggleField(field: PatientRequiredField) {
    if (field === "mrn") return; // welded — see the docblock.
    const next = PATIENT_REQUIRED_FIELD_ORDER.filter((f) =>
      f === field ? !fields.includes(field) : fields.includes(f),
    );
    if (!next.includes("mrn")) next.unshift("mrn");
    persist("required", next);
  }

  return (
    <section
      aria-labelledby="patient-mode-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2
          id="patient-mode-heading"
          className="inline-flex items-center gap-2 text-lg font-semibold"
        >
          <ShieldAlert aria-hidden="true" className="size-4 text-muted-foreground" />
          Identificação do paciente
        </h2>
        <p id={descriptionId} className="max-w-prose text-sm text-muted-foreground text-pretty">
          Define se os casos criados a partir deste processo registram
          identificadores do paciente (nome, prontuário, entre outros). Os dados
          são sensíveis, ficam isolados e todo acesso é registrado em auditoria.
          Aplica-se apenas a casos novos.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <fieldset
        aria-describedby={descriptionId}
        className="flex flex-col gap-2"
        disabled={isPending}
      >
        <legend className="mb-1 text-sm font-medium">
          Coleta nos casos deste processo
        </legend>
        {MODE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm transition-[color,box-shadow,border-color]",
              "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
              mode === option.value
                ? "border-primary bg-primary/8"
                : "border-input bg-card hover:border-ring/60",
              isPending && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="radio"
              name={radioName}
              value={option.value}
              checked={mode === option.value}
              onChange={() => changeMode(option.value)}
              className="sr-only"
            />
            <span className="font-medium">{option.title}</span>
            <span className="text-xs text-muted-foreground text-pretty">
              {option.hint}
            </span>
          </label>
        ))}
      </fieldset>

      {mode === "required" && (
        <fieldset
          className="animate-rise-in flex flex-col gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4"
          disabled={isPending}
        >
          <legend className="px-1 text-sm font-medium">
            Campos obrigatórios na criação
          </legend>
          <p id={mrnNoteId} className="text-xs text-muted-foreground text-pretty">
            O prontuário é sempre exigido: é a chave usada para localizar e apagar
            os registros de um paciente quando o titular solicita (LGPD). Marque os
            demais campos que este processo precisa exigir.
          </p>

          <div className="flex flex-col gap-1">
            {PATIENT_REQUIRED_FIELD_ORDER.map((field) => {
              const welded = field === "mrn";
              return (
                <label
                  key={field}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 text-sm transition-colors",
                    welded ? "cursor-default" : "cursor-pointer hover:bg-accent/40",
                  )}
                >
                  <Checkbox
                    checked={welded ? true : fields.includes(field)}
                    // ⛔ `aria-disabled`, NOT `disabled`. A disabled control leaves
                    // the tab order, and D2 requires the welded prontuário to stay
                    // PERCEIVABLE — a coordinator must be able to reach it and hear
                    // "marcada, indisponível" rather than find it missing. The
                    // no-op handler plus the literal `checked` is what makes it
                    // genuinely non-interactive: a click or Space changes nothing.
                    aria-disabled={welded || undefined}
                    aria-describedby={welded ? mrnNoteId : undefined}
                    onCheckedChange={() => {
                      if (!welded) toggleField(field);
                    }}
                  />
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-medium">
                      {PATIENT_REQUIRED_FIELD_LABELS[field]}
                    </span>
                    {welded && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                        <Lock aria-hidden="true" className="size-3" />
                        Sempre exigido
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          <p
            role="note"
            className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/12 px-3 py-2.5 text-xs text-pretty"
          >
            <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              Ao publicar esta versão, nenhum caso deste processo poderá ser criado
              sem estes campos. Confirme que a equipe tem o prontuário em mãos no
              momento da abertura.
            </span>
          </p>
        </fieldset>
      )}
    </section>
  );
}

/** The three modes, in the order a coordinator escalates through them. */
const MODE_OPTIONS: readonly { value: PatientMode; title: string; hint: string }[] = [
  {
    value: "none",
    title: "Não coletar",
    hint: "Os casos deste processo não registram identificadores de paciente.",
  },
  {
    value: "optional",
    title: "Opcional",
    hint: "O bloco de identificação é oferecido na criação do caso e pode ficar em branco.",
  },
  {
    value: "required",
    title: "Obrigatória",
    hint: "O caso só pode ser criado com os campos obrigatórios preenchidos.",
  },
];

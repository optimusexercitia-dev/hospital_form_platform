"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Search } from "lucide-react";

import { createDsrRequest } from "@/lib/dsr/actions";
import { DSR_MESSAGES } from "@/lib/dsr/messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { PHI_TITLE_HINT } from "@/components/ui/phi-input-hint";
import { FormBanner } from "@/components/auth/form-banner";
import { DsrSubjectSearch } from "@/components/dsr/dsr-subject-search";

/**
 * The DPO INTAKE lane: discovery, then the request itself (ADR 0130 Slice 3).
 *
 * Two steps on one surface, because they are one act: the Encarregado reads an
 * MRN off a paper file, checks that it resolves to anything in THIS hospital, and
 * opens the request. Splitting them across screens would make the DPO retype an
 * identifier the platform deliberately refuses to remember.
 *
 * ⛔ THE PLATFORM NEVER STORES WHO THE REQUEST IS ABOUT (Decision 5 / Q6). The MRN
 * is hashed by `app.derive_patient_key` inside `create_dsr_request` and only the
 * hash is stored; the identity documents stay in the hospital's own files, which is
 * exactly what `file_ref` points at. That is what keeps Rule 12's "exactly three
 * PHI modules" true — an MRN or name column here would make this a fourth.
 *
 * ⚠ The searched identifiers are carried from the search step to the create step
 * in CLIENT MEMORY ONLY, for the life of this panel. They are never written to a
 * URL, never persisted, and are gone on reload.
 *
 * ⛔ NAMELESS BY DESIGN — never add `nameRequiredFor`, and do not reintroduce
 * `FormData`. This form was originally uncontrolled and read through `FormData`,
 * which required a `name` on every input. A `<form>` whose JS has not hydrated yet
 * still submits NATIVELY on Enter, and a native GET submit serialises every NAMED
 * input into the QUERY STRING. The sibling search form did exactly that during
 * verification, putting a real MRN into the URL, the browser history and every
 * proxy log:
 *   `GET /o/rede-a/titulares?dsr-search-mrn=PRT-0099123`
 * `event.preventDefault()` cannot stop it, because pre-hydration there is no
 * handler to run. Both forms are therefore CONTROLLED and unnamed, so a
 * pre-hydration Enter serialises nothing. The a11y wiring (`id`,
 * `aria-describedby`) is unaffected, because `name` is only ever the form key.
 */
export function DsrIntakePanel({
  org,
  hospitalId,
}: {
  org: string;
  hospitalId: string;
}) {
  const [carried, setCarried] = useState<{ mrn: string; encounter: string } | null>(
    null,
  );

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
      <section aria-labelledby="dsr-intake-search-heading" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Search aria-hidden="true" className="size-4 text-primary" />
          <h3 id="dsr-intake-search-heading" className="text-base font-semibold">
            1. Localizar os registros do titular
          </h3>
        </div>
        <DsrSubjectSearch hospitalId={hospitalId} onFound={setCarried} />
      </section>

      <hr className="border-border" />

      <section aria-labelledby="dsr-intake-create-heading" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <FilePlus2 aria-hidden="true" className="size-4 text-primary" />
          <h3 id="dsr-intake-create-heading" className="text-base font-semibold">
            2. Registrar a solicitação
          </h3>
        </div>
        {/* ⚠ `key` IS THE CARRY-OVER MECHANISM, and it is load-bearing.
            The obvious shape — mirror `carried` into the form's state with a
            `useEffect` — is a `react-hooks/set-state-in-effect` violation AND a
            second source of truth for a field holding an MRN. Re-keying instead
            REMOUNTS the form so `useState` re-initialises from the prop: one
            source of truth, no effect, and the inputs stay controlled and
            nameless, which is exactly what the URL-leak fix depends on. */}
        <DsrIntakeForm
          key={carried ? `${carried.mrn} ${carried.encounter}` : "empty"}
          org={org}
          hospitalId={hospitalId}
          carried={carried}
        />
      </section>
    </div>
  );
}

function DsrIntakeForm({
  org,
  hospitalId,
  carried,
}: {
  org: string;
  hospitalId: string;
  carried: { mrn: string; encounter: string } | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    mrn?: string;
    fileRef?: string;
  }>({});
  // ⛔ CONTROLLED, AND UNNAMED — see NAMELESS BY DESIGN below.
  // Seeded ONCE from `carried`; the parent re-keys this component when the
  // searched identifiers change, so a remount re-runs these initialisers. No
  // effect mirrors the prop into state, so there is exactly one source of truth
  // for a field holding an MRN.
  const [mrn, setMrn] = useState(carried?.mrn ?? "");
  const [encounter, setEncounter] = useState(carried?.encounter ?? "");
  const [fileRef, setFileRef] = useState("");
  const router = useRouter();

  const mrnField = useFieldIds("dsr-mrn", {
    hasDescription: true,
    hasError: !!fieldErrors.mrn,
    required: true,
  });
  const encounterField = useFieldIds("dsr-encounter", { hasDescription: true });
  const fileField = useFieldIds("dsr-file-ref", {
    hasDescription: true,
    hasError: !!fieldErrors.fileRef,
    required: true,
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMrn = mrn.trim();
    const trimmedRef = fileRef.trim();

    const next: typeof fieldErrors = {};
    if (!trimmedMrn) next.mrn = DSR_MESSAGES.missingMrn;
    if (!trimmedRef) next.fileRef = DSR_MESSAGES.missingFileRef;
    setFieldErrors(next);
    setBanner(null);
    if (Object.keys(next).length > 0) return;

    startTransition(async () => {
      const result = await createDsrRequest({
        org,
        hospitalId,
        mrn: trimmedMrn,
        fileRef: trimmedRef,
        encounter: encounter.trim(),
      });
      if (result.ok) {
        // Clear the identifiers explicitly — the platform does not remember who a
        // request was about, and neither should this form after it is filed.
        setMrn("");
        setEncounter("");
        setFileRef("");
        setBanner({
          tone: "success",
          text: result.message ?? DSR_MESSAGES.requestCreated,
        });
        router.refresh();
      } else {
        setBanner({ tone: "error", text: result.error ?? DSR_MESSAGES.unexpected });
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4"
      aria-label="Registrar solicitação de titular"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={mrnField.controlProps.id}>
            Prontuário do titular
          </FieldLabel>
          <Input
            {...mrnField.controlProps}
            type="text"
            autoComplete="off"
            value={mrn}
            onChange={(e) => setMrn(e.target.value)}
          />
          <FieldDescription id={mrnField.descriptionId}>
            Usado apenas para localizar os registros. A plataforma armazena somente
            o resumo criptográfico — nunca o número nem o nome do titular.
          </FieldDescription>
          <FieldError id={mrnField.errorId}>{fieldErrors.mrn}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor={encounterField.controlProps.id}>
            Atendimento (opcional)
          </FieldLabel>
          <Input
            {...encounterField.controlProps}
            type="text"
            autoComplete="off"
            value={encounter}
            onChange={(e) => setEncounter(e.target.value)}
          />
          {/* ⛔ DELIBERATELY NOT THE ADR 0131 "não inclua dados do paciente" HINT,
              and the omission is the point. This field EXISTS to receive a patient
              identifier, and `create_dsr_request` hashes it through
              `app.derive_patient_key` into `dsr_requests.encounter_key` — measured:
              there is no raw encounter column on that table. So the warning would be
              false in its reason (nothing typed here is stored in the clear or shown
              anywhere) and contradictory in its instruction (it would tell the
              Encarregado not to do the one thing the field is for). Guidance that is
              false is worse than absent — it teaches operators to skip guidance
              (`D12_TITLE_GUIDANCE`'s docblock). It gets the MRN field's honest
              statement instead, which it was missing entirely. */}
          <FieldDescription id={encounterField.descriptionId}>
            Opcional, e registrado do mesmo modo que o prontuário: a plataforma
            guarda apenas o resumo criptográfico.
          </FieldDescription>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor={fileField.controlProps.id}>
          Referência do processo
        </FieldLabel>
        <Input
          {...fileField.controlProps}
          type="text"
          autoComplete="off"
          value={fileRef}
          onChange={(e) => setFileRef(e.target.value)}
        />
        {/* ⛔ THE HIGHEST-RISK FREE TEXT ON THE WHOLE DSR PATH, and the reason the
            ADR 0131 hint belongs here above all: `file_ref` is stored IN THE CLEAR
            (the only such column on `dsr_requests` — `patient_key`/`encounter_key`
            are digests), it is rendered as the request's <h1>, AND
            `create_dsr_request` interpolates it into the identity note of EVERY task
            it mints. A name typed here fans out to every executor. */}
        <FieldDescription id={fileField.descriptionId}>
          Onde estão os documentos de identidade do titular: processo físico ou
          GED do hospital. É esta referência, e não a identidade, que a plataforma
          guarda. {PHI_TITLE_HINT}
        </FieldDescription>
        <FieldError id={fileField.errorId}>{fieldErrors.fileRef}</FieldError>
      </Field>

      {banner ? <FormBanner tone={banner.tone}>{banner.text}</FormBanner> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Registrando…" : "Registrar solicitação"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Search, ShieldOff } from "lucide-react";

import {
  PATIENT_XREF_MODULE_LABELS,
  type PatientSearchResult,
  type PatientXrefModule,
} from "@/lib/patient-index/types";
import { searchDsrSubjectAction } from "@/lib/dsr/actions";
import { DSR_SEARCH } from "@/lib/dsr/messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { FormBanner } from "@/components/auth/form-banner";

const MODULE_ORDER: PatientXrefModule[] = ["case", "event", "referral"];

/**
 * DISCOVERY for the DPO intake lane (ADR 0130 Decisions 3, 4, 5).
 *
 * ⛔ THE UI NEVER DISPLAYS PATIENT IDENTITY (Decision 5 / Q6). The platform stores
 * only a peppered hash; identity documents stay in the hospital's own files, which
 * is what the request's `file_ref` points at. The MRN typed here is an INPUT: it
 * goes to a `"use server"` action, is hashed SERVER-SIDE inside the
 * `search_patient_xref` DEFINER door, and never persists, never round-trips back,
 * and never enters a URL. The result type is PHI-free by construction — there is
 * no name or MRN field on it to leak.
 *
 * ⛔ EXACT HASHED MRN / ENCOUNTER ONLY (Decision 3 / Q3a). No name search, no
 * substring, no browse, no autocomplete, no "did you mean". That is why this is a
 * single submit-button form with `autoComplete="off"` and no keystroke handler
 * that queries.
 *
 * ⛔ HOSPITAL-SCOPED, SILENTLY (Decision 4 / Q4a). The door filters to this
 * hospital's xref rows and there is no cross-hospital affordance of any kind: "this
 * patient also has records at Hospital B" IS the cross-tenant inference the
 * isolation model exists to prevent. A patient treated at two hospitals files two
 * requests.
 *
 * ⭐ WHY COUNTS AND NOT ROWS — read this before "improving" it into a table.
 * The NSP console renders per-record rows from this same bundle; this lane
 * deliberately renders only record TYPES and COUNTS. That is a DEFERRAL, not a
 * withholding: `dsr_tasks_select` admits `is_dpo_of`, so the moment the request
 * exists the Encarregado sees the full per-record breakdown in the inbox anyway.
 * The preflight answers exactly one question — "does this identifier resolve in
 * this hospital, and roughly how much work is this" — and per-record rows before
 * commit add nothing the DPO will not have thirty seconds later. The NSP surface
 * serves a different purpose and may legitimately show more than this lane may;
 * its behaviour is not this lane's permission.
 *
 * ⛔ NAMELESS BY DESIGN — never add `nameRequiredFor` to these fields.
 * `name` is opt-in on `useFieldIds`, and these controls deliberately decline it.
 * A `<form>` whose JS has not hydrated yet still submits NATIVELY on Enter, and a
 * native GET submit serialises every NAMED input into the QUERY STRING — which put
 * a real MRN in the URL, the browser history and every proxy log during this
 * component's own verification run, back when the hook named every field:
 *   `GET /o/rede-a/titulares?dsr-search-mrn=PRT-0099123`
 * `event.preventDefault()` cannot prevent this, because pre-hydration there is no
 * handler to run. The values here come from React state, never from `FormData`,
 * so a `name` would be pure liability. That measurement is why the hook's default
 * inverted.
 *
 * ⚠ An EMPTY result and a SUPPRESSED result render the identical string. That
 * costs nothing here, because `search_patient_xref` returns an empty bundle rather
 * than raising for an ungated caller — the two are already indistinguishable in
 * the database. Which is also why a genuine FAILURE may show its own message: an
 * authorization refusal structurally cannot reach the error branch, so collapsing
 * real breakage into "nothing found" would hide bugs for no privacy gain.
 */
export function DsrSubjectSearch({
  hospitalId,
  onFound,
}: {
  hospitalId: string;
  /**
   * Hands the searched MRN/encounter up to the intake form so the DPO does not
   * retype them. Stays in client memory for the life of the panel only.
   */
  onFound?: (input: { mrn: string; encounter: string }) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [mrn, setMrn] = useState("");
  const [encounter, setEncounter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [result, setResult] = useState<PatientSearchResult | null>(null);

  const mrnIds = useFieldIds("dsr-search-mrn", {
    hasDescription: true,
    hasError: !!fieldError,
  });
  const encounterIds = useFieldIds("dsr-search-encounter", {
    hasDescription: true,
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldError(null);

    const input = {
      mrn: mrn.trim() || null,
      encounter: encounter.trim() || null,
    };

    startTransition(async () => {
      const state = await searchDsrSubjectAction(hospitalId, input);
      if (!state.ok) {
        setResult(null);
        if (state.fieldErrors?.mrn) {
          setFieldError(state.fieldErrors.mrn);
        } else {
          setError(state.error ?? DSR_SEARCH.unavailable);
        }
        return;
      }
      setResult(
        state.result ?? { matchedOn: "patient", matchCount: 0, entries: [] },
      );
      onFound?.({ mrn: mrn.trim(), encounter: encounter.trim() });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={mrnIds.controlProps.id}>Prontuário</FieldLabel>
            <Input
              {...mrnIds.controlProps}
              // ⛔ NO `name` — see NAMELESS BY DESIGN in the component docblock.
              value={mrn}
              onChange={(e) => setMrn(e.target.value)}
              autoComplete="off"
              inputMode="text"
            />
            <FieldDescription id={mrnIds.descriptionId}>
              {DSR_SEARCH.hint}
            </FieldDescription>
            <FieldError id={mrnIds.errorId}>{fieldError}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor={encounterIds.controlProps.id}>
              Atendimento
            </FieldLabel>
            <Input
              {...encounterIds.controlProps}
              value={encounter}
              onChange={(e) => setEncounter(e.target.value)}
              autoComplete="off"
              inputMode="text"
            />
            <FieldDescription id={encounterIds.descriptionId}>
              Opcional se o prontuário for informado.
            </FieldDescription>
          </Field>
        </div>

        <FormBanner tone="error">{error}</FormBanner>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            <Search aria-hidden="true" />
            {isPending ? "Localizando…" : "Localizar registros"}
          </Button>
          <p className="text-xs text-muted-foreground text-pretty">
            A pesquisa é registrada em trilha de auditoria.
          </p>
        </div>
      </form>

      {/* Announced when it replaces the (empty) initial state. */}
      <div aria-live="polite" role="status">
        {result ? <DsrSearchSummary result={result} /> : null}
      </div>
    </div>
  );
}

/**
 * The PHI-free preflight summary: record TYPES and COUNTS, never a person and
 * never a per-record row. See the component docblock for why this is a deferral
 * rather than a withholding.
 */
function DsrSearchSummary({ result }: { result: PatientSearchResult }) {
  if (result.matchCount === 0 || result.entries.length === 0) {
    // ⚠ ONE STRING FOR EVERY CAUSE. An empty result and a suppressed result must
    // be indistinguishable — a "nothing here, but…" variant would be the
    // cross-tenant hint Decision 4 forbids.
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground text-pretty">
        {DSR_SEARCH.empty}
      </p>
    );
  }

  const counts = new Map<PatientXrefModule, { total: number; disposed: number }>();
  for (const entry of result.entries) {
    const c = counts.get(entry.module) ?? { total: 0, disposed: 0 };
    c.total += 1;
    if (entry.disposed) c.disposed += 1;
    counts.set(entry.module, c);
  }
  const disposedTotal = result.entries.filter((e) => e.disposed).length;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-accent/40 p-4">
      <p className="text-sm font-medium text-accent-foreground">
        {result.entries.length} registro
        {result.entries.length === 1 ? "" : "s"} localizado
        {result.entries.length === 1 ? "" : "s"} neste hospital.
      </p>

      <ul className="flex flex-wrap gap-2">
        {MODULE_ORDER.filter((m) => counts.has(m)).map((m) => {
          const c = counts.get(m)!;
          return (
            <li
              key={m}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium"
            >
              <span className="tabular-nums">{c.total}</span>
              <span className="text-muted-foreground">
                {PATIENT_XREF_MODULE_LABELS[m]}
                {c.total === 1 ? "" : "s"}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Q16iv — disposed entries surface as HISTORY and never re-fire. */}
      {disposedTotal > 0 ? (
        <p className="flex items-start gap-2 text-xs text-muted-foreground text-pretty">
          <ShieldOff aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {disposedTotal} destes registros já teve os dados do paciente
            descartados anteriormente e não será descartado novamente.
          </span>
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground text-pretty">
        O detalhamento por registro aparece nas tarefas de execução assim que a
        solicitação for registrada.
      </p>
    </div>
  );
}

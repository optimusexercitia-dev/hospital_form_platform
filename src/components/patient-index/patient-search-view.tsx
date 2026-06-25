"use client";

import { useId, useState, useTransition } from "react";
import { Search } from "lucide-react";

import {
  loadPatientAccessAudit,
  searchPatientAction,
} from "@/lib/patient-index/actions";
import {
  type PatientSearchInput,
  type PatientSearchResult,
} from "@/lib/patient-index/types";
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
import { TrajectoryResult } from "./trajectory-result";
import { AccessAuditTable } from "./access-audit-table";

/**
 * The QPS cross-committee patient SEARCH view (Phase 23 — `patient_index`; ADR
 * 0039). Owns the typed search form (MRN and/or encounter), runs the audited,
 * PQS-gated `searchPatientAction`, and composes the PHI-FREE result: a match
 * summary + the trajectory table + the lazily-loaded access-audit table (bound to
 * the same identifiers).
 *
 * Privacy: the raw MRN/encounter go to a `"use server"` action and are hashed
 * SERVER-SIDE inside the DEFINER RPC — they never persist, never log raw, and
 * never round-trip back (the result is PHI-free by construction). Keeping the form
 * behind a server action also keeps the identifiers off the client JS bundle.
 *
 * Fully keyboard-operable: a real `<form>` (Enter submits), labeled controls with
 * wired help/error ids, visible focus rings, and `role="status"`/`role="alert"`
 * regions so a screen reader hears the outcome. Empty state on a zero-match.
 *
 * Org-scoping (NSP-per-org, ADR 0042): the search + access-audit actions take the
 * route's `orgId` so they route through `searchPatientForOrg(orgId, …)` /
 * `getPatientAccessAuditForOrg(orgId, …)` — gated on enrollment in THAT org and
 * scoped to its xref rows. The `org` SLUG is also threaded to the trajectory table
 * for per-org entity hrefs (the entity deep-link path resolves its own org).
 *
 * @param org    the org slug whose NSP console this is (entity hrefs).
 * @param orgId  the organization id (the search/audit actions' enrollment + scope).
 */
export function PatientSearchView({
  org,
  orgId,
}: {
  org: string;
  orgId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [mrn, setMrn] = useState("");
  const [encounter, setEncounter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [result, setResult] = useState<PatientSearchResult | null>(null);
  /** The identifiers that produced the CURRENT result — what the audit binds to. */
  const [searched, setSearched] = useState<PatientSearchInput | null>(null);

  const mrnIds = useFieldIds("patient-mrn", {
    hasDescription: true,
    hasError: !!fieldError,
  });
  const encounterIds = useFieldIds("patient-encounter", {
    hasDescription: true,
  });
  const resultsRegionId = useId();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldError(null);

    const input: PatientSearchInput = {
      mrn: mrn.trim() || null,
      encounter: encounter.trim() || null,
    };

    startTransition(async () => {
      // NSP-per-org (ADR 0042): the route's `orgId` scopes the search to THIS org's
      // committees (gated on enrollment) → searchPatientForOrg(orgId, …).
      const state = await searchPatientAction(orgId, input);
      if (!state.ok) {
        setResult(null);
        setSearched(null);
        if (state.fieldErrors?.mrn) {
          setFieldError(state.fieldErrors.mrn);
        } else {
          setError(
            state.error ??
              "Não foi possível realizar a pesquisa de paciente no momento.",
          );
        }
        return;
      }
      setResult(state.result ?? { matchedOn: "patient", matchCount: 0, entries: [] });
      // Bind the audit loader to exactly the identifiers we searched on.
      setSearched(input);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="patient-search-heading"
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
      >
        <div className="flex items-center gap-2">
          <Search aria-hidden="true" className="size-4 text-primary" />
          <h2 id="patient-search-heading" className="text-base font-semibold">
            Pesquisar paciente
          </h2>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error && <FormBanner tone="error">{error}</FormBanner>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={mrnIds.controlProps.id}>
                Prontuário
              </FieldLabel>
              <Input
                {...mrnIds.controlProps}
                value={mrn}
                onChange={(e) => setMrn(e.target.value)}
                placeholder="Número do prontuário"
                autoComplete="off"
                inputMode="text"
              />
              <FieldDescription id={mrnIds.descriptionId}>
                Número do prontuário (MRN) do paciente.
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
                placeholder="Número do atendimento"
                autoComplete="off"
                inputMode="text"
              />
              <FieldDescription id={encounterIds.descriptionId}>
                Número do atendimento / internação (opcional se informar o
                prontuário).
              </FieldDescription>
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending}>
              <Search aria-hidden="true" />
              {isPending ? "Pesquisando…" : "Pesquisar"}
            </Button>
            <p className="text-xs text-muted-foreground text-pretty">
              Informe o prontuário e/ou o atendimento. A pesquisa é registrada em
              trilha de auditoria.
            </p>
          </div>
        </form>
      </section>

      {/* Results — announced when they replace the (empty) initial state. */}
      <section
        id={resultsRegionId}
        aria-labelledby="patient-trajectory-heading"
        aria-live="polite"
        className="flex flex-col gap-4"
      >
        {result && searched && (
          <TrajectoryResult org={org} result={result}>
            {/* The access audit is only meaningful once there's a match; it binds
                to exactly the MRN/encounter we searched on (the audit query is
                MRN-keyed — ADR 0039). */}
            {result.matchCount > 0 && (
              <AccessAuditTable
                onLoad={() => loadPatientAccessAudit(orgId, searched)}
              />
            )}
          </TrajectoryResult>
        )}
      </section>
    </div>
  );
}

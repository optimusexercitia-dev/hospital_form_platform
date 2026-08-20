"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { DsrRequestRow } from "@/lib/queries/dsr";
import { closeDsrRequest, createDsrRequest } from "@/lib/dsr/actions";
import {
  DSR_OUTCOME_LABELS,
  DSR_STATUS_LABELS,
} from "@/lib/dsr/messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Field,
  FieldDescription,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { FormBanner } from "@/components/auth/form-banner";

const REFUSALS = new Set(["refused_retention", "refused_identity"]);
const NEEDS_LEGAL_REF = new Set([
  "granted",
  "granted_partial",
  "refused_retention",
]);

/**
 * The Encarregado (DPO) lane: open a request, and close it with an outcome.
 *
 * ⚠ THE PLATFORM NEVER STORES WHO THE REQUEST IS ABOUT (ADR 0130 Q6). The MRN
 * typed here is hashed by `app.derive_patient_key` inside the door and only the
 * hash is stored; the identity documents stay in the hospital's own files, which
 * is what `file_ref` points at. That is what keeps Rule 12's "exactly three PHI
 * modules" true — a name or MRN column here would make this a fourth.
 *
 * ⚠ THE REFUSAL COPY CITES THE INSTITUTIONAL RETENTION POLICY, NEVER CFM
 * 1821/2007. Counsel held (2026-08-19, ADR 0035 Amendment 1) that committee
 * documentation is the ANALYSIS of a prontuário and not part of it, so that
 * statute does not attach; citing it to a data subject would be a false legal
 * basis. Adjudication with recorded legal consultation is Slice 3's full lane —
 * what ships here is the two-phase close that already demands the reference.
 */
export function DsrRequestPanel({
  org,
  hospitalId,
  requests,
}: {
  org: string;
  hospitalId: string;
  requests: DsrRequestRow[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold tracking-tight">
        Solicitações (Encarregado)
      </h2>
      <DsrIntakeForm org={org} hospitalId={hospitalId} />
      {requests.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Nenhuma solicitação registrada neste hospital.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => (
            <li key={request.id}>
              <DsrRequestCard org={org} request={request} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DsrIntakeForm({
  org,
  hospitalId,
}: {
  org: string;
  hospitalId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const router = useRouter();

  const mrnField = useFieldIds("dsr-mrn", { hasDescription: true });
  const encounterField = useFieldIds("dsr-encounter");
  const fileField = useFieldIds("dsr-file-ref", { hasDescription: true });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBanner(null);
    startTransition(async () => {
      const result = await createDsrRequest({
        org,
        hospitalId,
        mrn: String(data.get("mrn") ?? ""),
        fileRef: String(data.get("fileRef") ?? ""),
        encounter: String(data.get("encounter") ?? ""),
      });
      if (result.ok) {
        form.reset();
        setBanner({ tone: "success", text: result.message ?? "Registrada." });
        router.refresh();
      } else {
        setBanner({ tone: "error", text: result.error ?? "" });
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
      aria-label="Registrar solicitação de titular"
    >
      <Field>
        <FieldLabel htmlFor={mrnField.controlProps.id}>
          Prontuário do titular
        </FieldLabel>
        <Input
          {...mrnField.controlProps}
          name="mrn"
          type="text"
          autoComplete="off"
          required
        />
        <FieldDescription id={mrnField.descriptionId}>
          Usado apenas para localizar os registros. A plataforma armazena somente
          o resumo criptográfico — nunca o número nem o nome do titular.
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor={encounterField.controlProps.id}>
          Atendimento (opcional)
        </FieldLabel>
        <Input
          {...encounterField.controlProps}
          name="encounter"
          type="text"
          autoComplete="off"
        />
      </Field>

      <Field>
        <FieldLabel htmlFor={fileField.controlProps.id}>
          Referência do processo
        </FieldLabel>
        <Input
          {...fileField.controlProps}
          name="fileRef"
          type="text"
          autoComplete="off"
          required
        />
        <FieldDescription id={fileField.descriptionId}>
          Onde estão os documentos de identidade do titular: processo físico ou
          GED do hospital.
        </FieldDescription>
      </Field>

      {banner ? (
        <FormBanner tone={banner.tone}>{banner.text}</FormBanner>
      ) : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Registrando…" : "Registrar solicitação"}
        </Button>
      </div>
    </form>
  );
}

function DsrRequestCard({
  org,
  request,
}: {
  org: string;
  request: DsrRequestRow;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("");
  const router = useRouter();

  const outcomeField = useFieldIds(`outcome-${request.id}`);
  const basisField = useFieldIds(`basis-${request.id}`);
  const legalField = useFieldIds(`legal-${request.id}`, { hasDescription: true });

  const isClosed = request.status === "closed";
  const needsBasis = REFUSALS.has(outcome);
  const needsLegalRef = NEEDS_LEGAL_REF.has(outcome);

  function handleClose(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await closeDsrRequest({
        org,
        requestId: request.id,
        outcome: String(data.get("outcome") ?? ""),
        outcomeBasis: String(data.get("basis") ?? ""),
        legalConsultationRef: String(data.get("legalRef") ?? ""),
      });
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? null);
      }
    });
  }

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">{request.fileRef}</h3>
          <p className="text-xs text-muted-foreground">
            {DSR_STATUS_LABELS[request.status] ?? request.status}
            {" · "}
            {request.totalTasks - request.pendingTasks}/{request.totalTasks}{" "}
            tarefas concluídas
            {" · prazo "}
            {new Date(request.dueDate).toLocaleDateString("pt-BR")}
          </p>
        </div>
        {request.outcome ? (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
            {DSR_OUTCOME_LABELS[request.outcome] ?? request.outcome}
          </span>
        ) : null}
      </div>

      {isClosed ? (
        request.outcomeBasis ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {request.outcomeBasis}
          </p>
        ) : null
      ) : (
        <form onSubmit={handleClose} noValidate className="mt-4 flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor={outcomeField.controlProps.id}>
              Desfecho
            </FieldLabel>
            <NativeSelect
              {...outcomeField.controlProps}
              name="outcome"
              required
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              <option value="">Selecione…</option>
              {Object.entries(DSR_OUTCOME_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          {needsBasis ? (
            <Field>
              <FieldLabel htmlFor={basisField.controlProps.id}>
                Fundamento informado ao titular
              </FieldLabel>
              <Textarea
                {...basisField.controlProps}
                name="basis"
                rows={3}
                required
                placeholder="Ex.: política institucional de retenção de 20 anos aplicável à documentação de comissão."
              />
            </Field>
          ) : null}

          {needsLegalRef ? (
            <Field>
              <FieldLabel htmlFor={legalField.controlProps.id}>
                Consulta jurídica
              </FieldLabel>
              <Input
                {...legalField.controlProps}
                name="legalRef"
                type="text"
                autoComplete="off"
                required
              />
              <FieldDescription id={legalField.descriptionId}>
                Data e referência do parecer que fundamentou a decisão. Cada
                análise de mérito é feita caso a caso, com consulta jurídica.
              </FieldDescription>
            </Field>
          ) : null}

          <FormBanner tone="error">{error}</FormBanner>

          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Encerrando…" : "Encerrar solicitação"}
            </Button>
          </div>
        </form>
      )}
    </article>
  );
}

"use client";

import { useState } from "react";
import { Gavel, Pencil } from "lucide-react";

import {
  decideAdmissibility,
  upsertEthicsCaseDetails,
} from "@/lib/ethics/actions";
import type {
  AdmissibilityStatus,
  ComplaintChannel,
  EthicsCaseDetails,
} from "@/lib/queries/ethics";
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
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, FieldDescription, useFieldIds } from "@/components/ui/field";
import { FormBanner } from "@/components/auth/form-banner";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";

import { EthicsSection } from "./ethics-section";
import { useEthicsAction } from "./use-ethics-action";
import { localDateTimeToIso } from "./ethics-datetime";
import {
  ADMISSIBILITY_DECISION_OPTIONS,
  ADMISSIBILITY_STATUS_LABELS,
  ADMISSIBILITY_STATUS_TOKENS,
  COMPLAINT_CHANNEL_LABELS,
  COMPLAINT_CHANNEL_OPTIONS,
  formatEthicsDateTime,
} from "./ethics-labels";

/**
 * Admissibility & intake (ETH·E2 D1). Shows the ethics case's intake summary +
 * admissibility state and offers the two coordinator doors: edit intake
 * (`upsert_ethics_case_details`) and decide admissibility (`decide_admissibility`)
 * — the lifecycle entry gate before allegations/decisions proceed.
 */
export function EthicsAdmissibilityPanel({
  caseId,
  details,
}: {
  caseId: string;
  details: EthicsCaseDetails | null;
}) {
  const status: AdmissibilityStatus = details?.admissibilityStatus ?? "pending";

  return (
    <EthicsSection
      id="ethics-admissibility"
      title="Admissibilidade e recebimento"
      description="Registro da denúncia e a decisão de admissibilidade que abre (ou encerra) o processo."
      badge={
        <CaseStatusBadge
          label={ADMISSIBILITY_STATUS_LABELS[status]}
          colorToken={ADMISSIBILITY_STATUS_TOKENS[status]}
        />
      }
      actions={
        <>
          <IntakeDialog caseId={caseId} details={details} />
          <DecideAdmissibilityDialog caseId={caseId} currentStatus={status} />
        </>
      }
    >
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Canal da denúncia
          </dt>
          <dd className="mt-1 text-sm">
            {details?.complaintChannel
              ? COMPLAINT_CHANNEL_LABELS[details.complaintChannel]
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Recebida em
          </dt>
          <dd className="mt-1 text-sm">
            {formatEthicsDateTime(details?.complaintReceivedAt ?? null)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Resumo
          </dt>
          <dd className="mt-1">
            {details?.summaryMd ? (
              <MarkdownRenderer content={details.summaryMd} />
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </dd>
        </div>
        {details?.admissibilityRationaleMd && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Fundamentação da admissibilidade
            </dt>
            <dd className="mt-1">
              <MarkdownRenderer content={details.admissibilityRationaleMd} />
            </dd>
            {details.admissibilityDecidedAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Decidida em {formatEthicsDateTime(details.admissibilityDecidedAt)}
              </p>
            )}
          </div>
        )}
      </dl>
    </EthicsSection>
  );
}

function IntakeDialog({
  caseId,
  details,
}: {
  caseId: string;
  details: EthicsCaseDetails | null;
}) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<ComplaintChannel | "">(
    details?.complaintChannel ?? "",
  );
  const [receivedAt, setReceivedAt] = useState(
    toLocalInput(details?.complaintReceivedAt ?? null),
  );
  const [summary, setSummary] = useState(details?.summaryMd ?? "");
  const { run, isPending, error, clearError } = useEthicsAction();
  const channelIds = useFieldIds("ethics-intake-channel");
  const receivedIds = useFieldIds("ethics-intake-received");
  const summaryIds = useFieldIds("ethics-intake-summary");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setChannel(details?.complaintChannel ?? "");
      setReceivedAt(toLocalInput(details?.complaintReceivedAt ?? null));
      setSummary(details?.summaryMd ?? "");
      clearError();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg">
          <Pencil aria-hidden="true" />
          Editar recebimento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar recebimento da denúncia</DialogTitle>
          <DialogDescription>
            Registre o canal, a data de recebimento e um resumo do caso. Não inclua
            dados de paciente.
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        <Field>
          <FieldLabel htmlFor={channelIds.controlProps.id}>Canal da denúncia</FieldLabel>
          <NativeSelect
            {...channelIds.controlProps}
            value={channel}
            disabled={isPending}
            onChange={(e) => setChannel(e.target.value as ComplaintChannel | "")}
          >
            <option value="">Não informado</option>
            {COMPLAINT_CHANNEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={receivedIds.controlProps.id}>Recebida em</FieldLabel>
          <Input
            {...receivedIds.controlProps}
            type="datetime-local"
            value={receivedAt}
            disabled={isPending}
            onChange={(e) => setReceivedAt(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={summaryIds.controlProps.id}>Resumo</FieldLabel>
          <Textarea
            {...summaryIds.controlProps}
            value={summary}
            disabled={isPending}
            maxLength={4000}
            placeholder="Resumo do caso (Markdown suportado)."
            onChange={(e) => setSummary(e.target.value)}
          />
          <FieldDescription>Markdown é suportado. Não inclua dados de paciente.</FieldDescription>
        </Field>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            Voltar
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={isPending}
            onClick={() =>
              run(
                () =>
                  upsertEthicsCaseDetails(caseId, {
                    complaintChannel: channel === "" ? null : channel,
                    complaintReceivedAt: localDateTimeToIso(receivedAt),
                    summaryMd: summary.trim() === "" ? null : summary.trim(),
                  }),
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            {isPending ? "Salvando…" : "Salvar recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DecideAdmissibilityDialog({
  caseId,
  currentStatus,
}: {
  caseId: string;
  currentStatus: AdmissibilityStatus;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AdmissibilityStatus>(
    currentStatus === "pending" ? "admissible" : currentStatus,
  );
  const [rationale, setRationale] = useState("");
  const { run, isPending, error, clearError } = useEthicsAction();
  const statusIds = useFieldIds("ethics-admissibility-status");
  const rationaleIds = useFieldIds("ethics-admissibility-rationale");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setStatus(currentStatus === "pending" ? "admissible" : currentStatus);
      setRationale("");
      clearError();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="lg">
          <Gavel aria-hidden="true" />
          Decidir admissibilidade
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decidir admissibilidade</DialogTitle>
          <DialogDescription>
            Uma denúncia admitida segue para instrução e decisão; uma denúncia
            inadmitida pode ser encerrada sem julgamento.
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        <Field>
          <FieldLabel htmlFor={statusIds.controlProps.id}>Decisão</FieldLabel>
          <NativeSelect
            {...statusIds.controlProps}
            value={status}
            disabled={isPending}
            onChange={(e) => setStatus(e.target.value as AdmissibilityStatus)}
          >
            {ADMISSIBILITY_DECISION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={rationaleIds.controlProps.id}>Fundamentação</FieldLabel>
          <Textarea
            {...rationaleIds.controlProps}
            value={rationale}
            disabled={isPending}
            maxLength={4000}
            placeholder="Fundamentação da decisão de admissibilidade."
            onChange={(e) => setRationale(e.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            Voltar
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={isPending || rationale.trim().length === 0}
            onClick={() =>
              run(() => decideAdmissibility(caseId, status, rationale.trim()), {
                onSuccess: () => setOpen(false),
              })
            }
          >
            {isPending ? "Registrando…" : "Registrar decisão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** ISO timestamp → the `datetime-local` input value in the browser's local zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

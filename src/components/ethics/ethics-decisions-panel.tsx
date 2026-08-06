"use client";

import { useState } from "react";
import { Plus, Vote, FileCog, Stamp, Ban, Scale } from "lucide-react";

import {
  castCaseVote,
  createCaseDecision,
  issueDecision,
  setEthicsDecisionDetails,
  submitEthicsAppeal,
  voidDecision,
} from "@/lib/ethics/actions";
import type {
  AdmissibilityStatus,
  CaseDecision,
  ExternalReportingTarget,
  SanctionType,
  VoteValue,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field, FieldLabel, useFieldIds } from "@/components/ui/field";
import { FormBanner } from "@/components/auth/form-banner";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";

import { EthicsSection, EthicsEmpty } from "./ethics-section";
import { useEthicsAction } from "./use-ethics-action";
import { localDateTimeToIso } from "./ethics-datetime";
import {
  DECISION_STATUS_LABELS,
  DECISION_STATUS_TOKENS,
  EXTERNAL_REPORTING_TARGET_LABELS,
  EXTERNAL_REPORTING_TARGET_OPTIONS,
  VOTE_LABELS,
  VOTE_OPTIONS,
  VOTE_TOKENS,
  formatEthicsDate,
  formatEthicsDateTime,
} from "./ethics-labels";

/**
 * Decisions & votes (ETH·E2 D3/D4). Lists each decision with its ethics extension
 * (sanction, remediation, external reporting, appeal deadline) and the vote
 * roster projection (`X de Y membros aptos`, the caller's own ballot). Wires the
 * coordinator/member doors: create decision, set details (sanction from the
 * org catalog), cast vote (a recused/respondent member is refused at the door —
 * `HC0J5`), issue (fires the retention pin), void, and submit an appeal.
 */
export function EthicsDecisionsPanel({
  caseId,
  decisions,
  sanctionTypes,
  admissibilityStatus,
}: {
  caseId: string;
  decisions: CaseDecision[];
  sanctionTypes: SanctionType[];
  admissibilityStatus: AdmissibilityStatus;
}) {
  const admissible = admissibilityStatus === "admissible";
  return (
    <EthicsSection
      id="ethics-decisions"
      title="Decisões e votação"
      description="Decisões da comissão, a votação de cada uma e a sanção aplicada."
      actions={<CreateDecisionDialog caseId={caseId} admissible={admissible} />}
    >
      {!admissible && (
        <FormBanner tone="info">
          A denúncia precisa estar admitida para abrir uma decisão.
        </FormBanner>
      )}
      {decisions.length === 0 ? (
        <EthicsEmpty>Nenhuma decisão registrada.</EthicsEmpty>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {decisions.map((d) => (
            <DecisionCard
              key={d.id}
              caseId={caseId}
              decision={d}
              sanctionTypes={sanctionTypes}
            />
          ))}
        </ul>
      )}
    </EthicsSection>
  );
}

function DecisionCard({
  caseId,
  decision: d,
  sanctionTypes,
}: {
  caseId: string;
  decision: CaseDecision;
  sanctionTypes: SanctionType[];
}) {
  const canVote =
    d.status === "draft" || d.status === "proposed" || d.status === "voted";
  const canIssue =
    d.status === "draft" || d.status === "proposed" || d.status === "voted";
  const canSetDetails = d.status !== "voided";
  const canAppeal = d.status === "issued" || d.status === "appealed";
  const canVoid = d.status !== "voided" && d.status !== "issued";

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{d.decisionType}</span>
          <CaseStatusBadge
            label={DECISION_STATUS_LABELS[d.status]}
            colorToken={DECISION_STATUS_TOKENS[d.status]}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {d.castVoteCount} de {d.eligibleVoterCount} membro(s) apto(s) votaram
        </span>
      </div>

      <MarkdownRenderer content={d.summaryMd} />
      {d.rationaleMd && (
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Fundamentação
          </p>
          <MarkdownRenderer content={d.rationaleMd} className="mt-1 text-sm" />
        </div>
      )}

      {d.details && <DecisionDetailsView details={d.details} />}

      {d.myVote && (
        <p className="text-sm">
          <span className="text-muted-foreground">Seu voto: </span>
          <CaseStatusBadge
            label={VOTE_LABELS[d.myVote.vote]}
            colorToken={VOTE_TOKENS[d.myVote.vote]}
          />
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {canVote && <CastVoteDialog decisionId={d.id} hasVoted={d.myVote !== null} />}
        {canSetDetails && (
          <DecisionDetailsDialog
            decisionId={d.id}
            sanctionTypes={sanctionTypes}
            details={d.details}
          />
        )}
        {canIssue && <IssueDecisionButton decisionId={d.id} />}
        {canAppeal && <SubmitAppealDialog caseId={caseId} decisionId={d.id} />}
        {canVoid && <VoidDecisionDialog decisionId={d.id} />}
      </div>
    </li>
  );
}

function DecisionDetailsView({ details }: { details: NonNullable<CaseDecision["details"]> }) {
  const rows: { label: string; value: string }[] = [];
  if (details.sanctionType) rows.push({ label: "Sanção", value: details.sanctionType.displayName });
  if (details.sanctionStartDate)
    rows.push({ label: "Início da sanção", value: formatEthicsDate(details.sanctionStartDate) });
  if (details.sanctionEndDate)
    rows.push({ label: "Fim da sanção", value: formatEthicsDate(details.sanctionEndDate) });
  if (details.remediationRequired) rows.push({ label: "Remediação", value: "Exigida" });
  if (details.externalReportingRequired && details.externalReportingTarget)
    rows.push({
      label: "Comunicação externa",
      value: EXTERNAL_REPORTING_TARGET_LABELS[details.externalReportingTarget],
    });
  if (details.externalReportingDeadline)
    rows.push({
      label: "Prazo da comunicação",
      value: formatEthicsDateTime(details.externalReportingDeadline),
    });
  if (details.appealDeadline)
    rows.push({ label: "Prazo de recurso", value: formatEthicsDateTime(details.appealDeadline) });

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Detalhes ainda não definidos.</p>
        ) : (
          rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="text-right font-medium">{r.value}</dd>
            </div>
          ))
        )}
      </dl>
      {details.remediationDescriptionMd && (
        <MarkdownRenderer content={details.remediationDescriptionMd} className="mt-2 text-sm" />
      )}
    </div>
  );
}

function CreateDecisionDialog({
  caseId,
  admissible,
}: {
  caseId: string;
  admissible: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [decisionType, setDecisionType] = useState("");
  const [summary, setSummary] = useState("");
  const [rationale, setRationale] = useState("");
  const { run, isPending, error, clearError } = useEthicsAction();
  const typeIds = useFieldIds("ethics-decision-type");
  const summaryIds = useFieldIds("ethics-decision-summary");
  const rationaleIds = useFieldIds("ethics-decision-rationale");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setDecisionType("");
      setSummary("");
      setRationale("");
      clearError();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg" disabled={!admissible}>
          <Plus aria-hidden="true" />
          Nova decisão
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova decisão</DialogTitle>
          <DialogDescription>
            Abra uma decisão da comissão. Os detalhes (sanção, recurso) e a votação
            são definidos em seguida.
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        <Field>
          <FieldLabel htmlFor={typeIds.controlProps.id}>Tipo de decisão</FieldLabel>
          <Input
            {...typeIds.controlProps}
            type="text"
            value={decisionType}
            disabled={isPending}
            maxLength={120}
            placeholder="Ex.: Decisão de mérito"
            onChange={(e) => setDecisionType(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={summaryIds.controlProps.id}>Resumo</FieldLabel>
          <Textarea
            {...summaryIds.controlProps}
            value={summary}
            disabled={isPending}
            maxLength={4000}
            placeholder="Resumo da decisão (Markdown suportado)."
            onChange={(e) => setSummary(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={rationaleIds.controlProps.id}>Fundamentação (opcional)</FieldLabel>
          <Textarea
            {...rationaleIds.controlProps}
            value={rationale}
            disabled={isPending}
            maxLength={4000}
            placeholder="Fundamentação da decisão."
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
            disabled={
              isPending ||
              decisionType.trim().length === 0 ||
              summary.trim().length === 0
            }
            onClick={() =>
              run(
                () =>
                  createCaseDecision(
                    caseId,
                    decisionType.trim(),
                    summary.trim(),
                    rationale.trim() === "" ? null : rationale.trim(),
                  ),
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            {isPending ? "Criando…" : "Criar decisão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CastVoteDialog({
  decisionId,
  hasVoted,
}: {
  decisionId: string;
  hasVoted: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [vote, setVote] = useState<VoteValue>(VOTE_OPTIONS[0].value);
  const [rationale, setRationale] = useState("");
  const { run, isPending, error, clearError } = useEthicsAction();
  // ⚠ PINNED id. `e2e/ethics-e2-procedure.spec.ts` FLOW-7 is the required keyboard-only
  // flow and tabs until it finds `i.id === 'ethics-vote-value'` — an id EQUALITY check,
  // not a `#id` selector, which is why the FUP-A11Y-1 sweep for `#`-selectors did not
  // see it and the generated id broke the spec. This is the `id` option's intended use:
  // a control something addresses by id says so at the source, where the next person to
  // change this line will read it.
  const voteIds = useFieldIds("ethics-vote-value", { id: "ethics-vote-value" });
  const rationaleIds = useFieldIds("ethics-vote-rationale");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setVote(VOTE_OPTIONS[0].value);
      setRationale("");
      clearError();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg">
          <Vote aria-hidden="true" />
          {hasVoted ? "Alterar voto" : "Votar"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar voto</DialogTitle>
          <DialogDescription>
            Seu voto formal nesta decisão. Membros impedidos ou o denunciado não
            podem votar.
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        <Field>
          <FieldLabel htmlFor={voteIds.controlProps.id}>Voto</FieldLabel>
          <NativeSelect
            {...voteIds.controlProps}
            value={vote}
            disabled={isPending}
            onChange={(e) => setVote(e.target.value as VoteValue)}
          >
            {VOTE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={rationaleIds.controlProps.id}>Justificativa (opcional)</FieldLabel>
          <Textarea
            {...rationaleIds.controlProps}
            value={rationale}
            disabled={isPending}
            maxLength={2000}
            placeholder="Justificativa do voto."
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
            disabled={isPending}
            onClick={() =>
              run(
                () =>
                  castCaseVote(
                    decisionId,
                    vote,
                    rationale.trim() === "" ? null : rationale.trim(),
                  ),
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            {isPending ? "Registrando…" : "Registrar voto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DecisionDetailsDialog({
  decisionId,
  sanctionTypes,
  details,
}: {
  decisionId: string;
  sanctionTypes: SanctionType[];
  details: CaseDecision["details"];
}) {
  const [open, setOpen] = useState(false);
  const [sanctionTypeId, setSanctionTypeId] = useState(details?.sanctionTypeId ?? "");
  const [sanctionStart, setSanctionStart] = useState(details?.sanctionStartDate ?? "");
  const [sanctionEnd, setSanctionEnd] = useState(details?.sanctionEndDate ?? "");
  const [remediationRequired, setRemediationRequired] = useState(
    details?.remediationRequired ?? false,
  );
  const [remediationDesc, setRemediationDesc] = useState(
    details?.remediationDescriptionMd ?? "",
  );
  const [externalRequired, setExternalRequired] = useState(
    details?.externalReportingRequired ?? false,
  );
  const [externalTarget, setExternalTarget] = useState<ExternalReportingTarget | "">(
    details?.externalReportingTarget ?? "",
  );
  const [externalDeadline, setExternalDeadline] = useState("");
  const [appealAllowed, setAppealAllowed] = useState(details?.appealAllowed ?? true);
  const [appealDeadline, setAppealDeadline] = useState("");
  const { run, isPending, error, clearError } = useEthicsAction();

  const sanctionIds = useFieldIds("ethics-details-sanction");
  const startIds = useFieldIds("ethics-details-sanction-start");
  const endIds = useFieldIds("ethics-details-sanction-end");
  const remedDescIds = useFieldIds("ethics-details-remediation-desc");
  const targetIds = useFieldIds("ethics-details-target");
  const extDeadlineIds = useFieldIds("ethics-details-external-deadline");
  const appealDeadlineIds = useFieldIds("ethics-details-appeal-deadline");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSanctionTypeId(details?.sanctionTypeId ?? "");
      setSanctionStart(details?.sanctionStartDate ?? "");
      setSanctionEnd(details?.sanctionEndDate ?? "");
      setRemediationRequired(details?.remediationRequired ?? false);
      setRemediationDesc(details?.remediationDescriptionMd ?? "");
      setExternalRequired(details?.externalReportingRequired ?? false);
      setExternalTarget(details?.externalReportingTarget ?? "");
      setExternalDeadline("");
      setAppealAllowed(details?.appealAllowed ?? true);
      setAppealDeadline("");
      clearError();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg">
          <FileCog aria-hidden="true" />
          Definir detalhes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Definir detalhes da decisão</DialogTitle>
          <DialogDescription>
            Sanção, remediação, comunicação externa e prazo de recurso.
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}

        <Field>
          <FieldLabel htmlFor={sanctionIds.controlProps.id}>Sanção</FieldLabel>
          <NativeSelect
            {...sanctionIds.controlProps}
            value={sanctionTypeId}
            disabled={isPending}
            onChange={(e) => setSanctionTypeId(e.target.value)}
          >
            <option value="">Nenhuma sanção</option>
            {sanctionTypes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={startIds.controlProps.id}>Início da sanção</FieldLabel>
            <Input
              {...startIds.controlProps}
              type="date"
              value={sanctionStart}
              disabled={isPending}
              onChange={(e) => setSanctionStart(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={endIds.controlProps.id}>Fim da sanção</FieldLabel>
            <Input
              {...endIds.controlProps}
              type="date"
              value={sanctionEnd}
              disabled={isPending}
              onChange={(e) => setSanctionEnd(e.target.value)}
            />
          </Field>
        </div>

        <ToggleRow
          label="Exigir remediação"
          checked={remediationRequired}
          onChange={setRemediationRequired}
          disabled={isPending}
        />
        {remediationRequired && (
          <Field>
            <FieldLabel htmlFor={remedDescIds.controlProps.id}>Descrição da remediação</FieldLabel>
            <Textarea
              {...remedDescIds.controlProps}
              value={remediationDesc}
              disabled={isPending}
              maxLength={2000}
              placeholder="O que deve ser cumprido."
              onChange={(e) => setRemediationDesc(e.target.value)}
            />
          </Field>
        )}

        <ToggleRow
          label="Comunicar a órgão externo"
          checked={externalRequired}
          onChange={setExternalRequired}
          disabled={isPending}
        />
        {externalRequired && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={targetIds.controlProps.id}>Destino</FieldLabel>
              <NativeSelect
                {...targetIds.controlProps}
                value={externalTarget}
                disabled={isPending}
                onChange={(e) =>
                  setExternalTarget(e.target.value as ExternalReportingTarget | "")
                }
              >
                <option value="">Selecione…</option>
                {EXTERNAL_REPORTING_TARGET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor={extDeadlineIds.controlProps.id}>Prazo</FieldLabel>
              <Input
                {...extDeadlineIds.controlProps}
                type="datetime-local"
                value={externalDeadline}
                disabled={isPending}
                onChange={(e) => setExternalDeadline(e.target.value)}
              />
            </Field>
          </div>
        )}

        <ToggleRow
          label="Permitir recurso"
          checked={appealAllowed}
          onChange={setAppealAllowed}
          disabled={isPending}
        />
        {appealAllowed && (
          <Field>
            <FieldLabel htmlFor={appealDeadlineIds.controlProps.id}>Prazo de recurso</FieldLabel>
            <Input
              {...appealDeadlineIds.controlProps}
              type="datetime-local"
              value={appealDeadline}
              disabled={isPending}
              onChange={(e) => setAppealDeadline(e.target.value)}
            />
          </Field>
        )}

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
                  setEthicsDecisionDetails(decisionId, {
                    sanctionTypeId: sanctionTypeId === "" ? null : sanctionTypeId,
                    sanctionStartDate: sanctionStart === "" ? null : sanctionStart,
                    sanctionEndDate: sanctionEnd === "" ? null : sanctionEnd,
                    remediationRequired,
                    remediationDescriptionMd:
                      remediationDesc.trim() === "" ? null : remediationDesc.trim(),
                    externalReportingRequired: externalRequired,
                    externalReportingTarget:
                      externalRequired && externalTarget !== "" ? externalTarget : null,
                    externalReportingDeadline: externalRequired
                      ? localDateTimeToIso(externalDeadline)
                      : null,
                    appealAllowed,
                    appealDeadline: appealAllowed
                      ? localDateTimeToIso(appealDeadline)
                      : null,
                  }),
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            {isPending ? "Salvando…" : "Salvar detalhes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm font-medium">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}

function IssueDecisionButton({ decisionId }: { decisionId: string }) {
  const { run, isPending, error } = useEthicsAction();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" size="lg" disabled={isPending}>
          <Stamp aria-hidden="true" />
          Emitir decisão
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Emitir a decisão?</AlertDialogTitle>
          <AlertDialogDescription>
            Emitir a decisão a torna oficial e fixa a retenção dos dados do médico
            denunciado (CFM). Confirme para prosseguir.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              run(() => issueDecision(decisionId));
            }}
          >
            {isPending ? "Emitindo…" : "Emitir decisão"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function VoidDecisionDialog({ decisionId }: { decisionId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { run, isPending, error, clearError } = useEthicsAction();
  const reasonIds = useFieldIds("ethics-void-reason");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setReason("");
      clearError();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="text-muted-foreground hover:text-destructive"
        >
          <Ban aria-hidden="true" />
          Anular
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular decisão</DialogTitle>
          <DialogDescription>
            Registre o motivo da anulação. A decisão é marcada como anulada.
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        <Field>
          <FieldLabel htmlFor={reasonIds.controlProps.id}>Motivo</FieldLabel>
          <Textarea
            {...reasonIds.controlProps}
            value={reason}
            disabled={isPending}
            maxLength={2000}
            placeholder="Motivo da anulação."
            onChange={(e) => setReason(e.target.value)}
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
            disabled={isPending || reason.trim().length === 0}
            onClick={() =>
              run(() => voidDecision(decisionId, reason.trim()), {
                onSuccess: () => setOpen(false),
              })
            }
          >
            {isPending ? "Anulando…" : "Anular decisão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubmitAppealDialog({
  caseId,
  decisionId,
}: {
  caseId: string;
  decisionId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { run, isPending, error, clearError } = useEthicsAction();
  const reasonIds = useFieldIds("ethics-appeal-reason");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setReason("");
      clearError();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg">
          <Scale aria-hidden="true" />
          Interpor recurso
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Interpor recurso</DialogTitle>
          <DialogDescription>
            Registre um recurso contra esta decisão emitida. A decisão passa a
            constar &ldquo;em recurso&rdquo;.
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        <Field>
          <FieldLabel htmlFor={reasonIds.controlProps.id}>Razões do recurso</FieldLabel>
          <Textarea
            {...reasonIds.controlProps}
            value={reason}
            disabled={isPending}
            maxLength={4000}
            placeholder="Fundamentação do recurso."
            onChange={(e) => setReason(e.target.value)}
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
            disabled={isPending || reason.trim().length === 0}
            onClick={() =>
              run(
                () => submitEthicsAppeal(caseId, decisionId, reason.trim()),
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            {isPending ? "Interpondo…" : "Interpor recurso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

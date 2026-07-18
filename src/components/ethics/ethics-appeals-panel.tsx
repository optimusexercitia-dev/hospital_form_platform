"use client";

import { useState } from "react";
import { Scale } from "lucide-react";

import { reviewEthicsAppeal } from "@/lib/ethics/actions";
import type { AppealStatus, EthicsAppeal } from "@/lib/queries/ethics";
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
import { Field, FieldLabel, useFieldIds } from "@/components/ui/field";
import { FormBanner } from "@/components/auth/form-banner";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";

import { EthicsSection, EthicsEmpty } from "./ethics-section";
import { useEthicsAction } from "./use-ethics-action";
import {
  APPEAL_REVIEW_OPTIONS,
  APPEAL_STATUS_LABELS,
  APPEAL_STATUS_TOKENS,
  formatEthicsDateTime,
} from "./ethics-labels";

/**
 * Appeals (ETH·E2 D-appeals). Lists appeals against issued decisions and wires the
 * review door (`review_ethics_appeal`). Submitting a NEW appeal happens on the
 * issued decision (Decisões panel).
 */
export function EthicsAppealsPanel({ appeals }: { appeals: EthicsAppeal[] }) {
  return (
    <EthicsSection
      id="ethics-appeals"
      title="Recursos"
      description="Recursos interpostos contra decisões emitidas e sua análise."
    >
      {appeals.length === 0 ? (
        <EthicsEmpty>Nenhum recurso interposto.</EthicsEmpty>
      ) : (
        <ul className="flex flex-col gap-3">
          {appeals.map((ap) => {
            const canReview =
              ap.status === "submitted" || ap.status === "under_review";
            return (
              <li
                key={ap.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">Recurso</span>
                    <CaseStatusBadge
                      label={APPEAL_STATUS_LABELS[ap.status]}
                      colorToken={APPEAL_STATUS_TOKENS[ap.status]}
                    />
                  </div>
                  {canReview && <ReviewAppealDialog appealId={ap.id} />}
                </div>
                <p className="text-xs text-muted-foreground">
                  Interposto em {formatEthicsDateTime(ap.submittedAt)}
                  {ap.reviewedAt
                    ? ` · analisado em ${formatEthicsDateTime(ap.reviewedAt)}`
                    : ""}
                </p>
                <MarkdownRenderer content={ap.appealReasonMd} className="text-sm" />
                {ap.outcome && (
                  <p className="text-sm">
                    <span className="font-medium">Resultado: </span>
                    {ap.outcome}
                  </p>
                )}
                {ap.outcomeRationaleMd && (
                  <MarkdownRenderer content={ap.outcomeRationaleMd} className="text-sm" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </EthicsSection>
  );
}

function ReviewAppealDialog({ appealId }: { appealId: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AppealStatus>(APPEAL_REVIEW_OPTIONS[0].value);
  const [outcome, setOutcome] = useState("");
  const [rationale, setRationale] = useState("");
  const { run, isPending, error, clearError } = useEthicsAction();
  const statusIds = useFieldIds("ethics-appeal-status");
  const outcomeIds = useFieldIds("ethics-appeal-outcome");
  const rationaleIds = useFieldIds("ethics-appeal-rationale");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setStatus(APPEAL_REVIEW_OPTIONS[0].value);
      setOutcome("");
      setRationale("");
      clearError();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="lg">
          <Scale aria-hidden="true" />
          Analisar recurso
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Analisar recurso</DialogTitle>
          <DialogDescription>
            Registre o resultado da análise do recurso.
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        <Field>
          <FieldLabel htmlFor={statusIds.controlProps.id}>Situação</FieldLabel>
          <NativeSelect
            {...statusIds.controlProps}
            value={status}
            disabled={isPending}
            onChange={(e) => setStatus(e.target.value as AppealStatus)}
          >
            {APPEAL_REVIEW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={outcomeIds.controlProps.id}>Resultado (opcional)</FieldLabel>
          <Input
            {...outcomeIds.controlProps}
            type="text"
            value={outcome}
            disabled={isPending}
            maxLength={200}
            placeholder="Resumo do resultado."
            onChange={(e) => setOutcome(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={rationaleIds.controlProps.id}>Fundamentação (opcional)</FieldLabel>
          <Textarea
            {...rationaleIds.controlProps}
            value={rationale}
            disabled={isPending}
            maxLength={4000}
            placeholder="Fundamentação da análise."
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
                  reviewEthicsAppeal(
                    appealId,
                    status,
                    outcome.trim() === "" ? null : outcome.trim(),
                    rationale.trim() === "" ? null : rationale.trim(),
                  ),
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            {isPending ? "Registrando…" : "Registrar análise"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

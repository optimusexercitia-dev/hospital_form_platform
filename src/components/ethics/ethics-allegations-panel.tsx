"use client";

import { useState } from "react";
import { Plus, ClipboardCheck, ListChecks } from "lucide-react";

import {
  addEthicsAllegation,
  recordEthicsFinding,
  updateEthicsAllegation,
} from "@/lib/ethics/actions";
import type {
  AllegationCategory,
  AllegationSeverity,
  AllegationStatus,
  EthicsAllegation,
  FindingValue,
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
import { Field, FieldLabel, useFieldIds } from "@/components/ui/field";
import { FormBanner } from "@/components/auth/form-banner";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";

import { EthicsSection, EthicsEmpty } from "./ethics-section";
import { useEthicsAction } from "./use-ethics-action";
import {
  ALLEGATION_SEVERITY_LABELS,
  ALLEGATION_SEVERITY_OPTIONS,
  ALLEGATION_STATUS_LABELS,
  ALLEGATION_STATUS_OPTIONS,
  ALLEGATION_STATUS_TOKENS,
  FINDING_LABELS,
  FINDING_OPTIONS,
  FINDING_TOKENS,
  formatEthicsDate,
} from "./ethics-labels";

/**
 * Allegations & findings (ETH·E2 D2). Lists each allegation with its embedded
 * current finding (`unique(allegation_id)`), and wires the coordinator doors:
 * add allegation (`add_ethics_allegation`), change its workflow status
 * (`update_ethics_allegation`), and record the finding (`record_ethics_finding` —
 * a second finding on the same allegation is refused, `HC0J3`).
 */
export function EthicsAllegationsPanel({
  caseId,
  allegations,
  categories,
}: {
  caseId: string;
  allegations: EthicsAllegation[];
  categories: AllegationCategory[];
}) {
  return (
    <EthicsSection
      id="ethics-allegations"
      title="Alegações e conclusões"
      description="Cada alegação da denúncia com sua situação e a conclusão da comissão."
      actions={<AddAllegationDialog caseId={caseId} categories={categories} />}
    >
      {allegations.length === 0 ? (
        <EthicsEmpty>Nenhuma alegação registrada.</EthicsEmpty>
      ) : (
        <ul className="flex flex-col gap-4">
          {allegations.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {a.category?.displayName ?? "Categoria arquivada"}
                  </span>
                  {a.severity && (
                    <CaseStatusBadge
                      label={ALLEGATION_SEVERITY_LABELS[a.severity]}
                      colorToken={severityToken(a.severity)}
                    />
                  )}
                  <CaseStatusBadge
                    label={ALLEGATION_STATUS_LABELS[a.status]}
                    colorToken={ALLEGATION_STATUS_TOKENS[a.status]}
                  />
                </div>
                <UpdateStatusDialog allegationId={a.id} current={a.status} />
              </div>

              <MarkdownRenderer content={a.descriptionMd} />

              {a.allegedEventDate && (
                <p className="text-xs text-muted-foreground">
                  Fato alegado em {formatEthicsDate(a.allegedEventDate)}
                </p>
              )}

              {/* Finding */}
              {a.finding ? (
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck aria-hidden="true" className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Conclusão</span>
                    <CaseStatusBadge
                      label={FINDING_LABELS[a.finding.finding]}
                      colorToken={FINDING_TOKENS[a.finding.finding]}
                    />
                  </div>
                  {a.finding.rationaleMd && (
                    <MarkdownRenderer content={a.finding.rationaleMd} className="text-sm" />
                  )}
                  {a.finding.evidenceSummaryMd && (
                    <div>
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Síntese das provas
                      </p>
                      <MarkdownRenderer
                        content={a.finding.evidenceSummaryMd}
                        className="mt-1 text-sm"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <RecordFindingDialog allegationId={a.id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </EthicsSection>
  );
}

function severityToken(sev: AllegationSeverity) {
  switch (sev) {
    case "critical":
      return "red" as const;
    case "high":
      return "amber" as const;
    case "moderate":
      return "slate" as const;
    default:
      return "muted" as const;
  }
}

function AddAllegationDialog({
  caseId,
  categories,
}: {
  caseId: string;
  categories: AllegationCategory[];
}) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<AllegationSeverity | "">("");
  const [eventDate, setEventDate] = useState("");
  const { run, isPending, error, clearError } = useEthicsAction();
  const catIds = useFieldIds("ethics-allegation-category");
  const descIds = useFieldIds("ethics-allegation-description");
  const sevIds = useFieldIds("ethics-allegation-severity");
  const dateIds = useFieldIds("ethics-allegation-date");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setCategoryId("");
      setDescription("");
      setSeverity("");
      setEventDate("");
      clearError();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg">
          <Plus aria-hidden="true" />
          Adicionar alegação
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar alegação</DialogTitle>
          <DialogDescription>
            Descreva uma alegação da denúncia. A conclusão de cada alegação é
            registrada separadamente.
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        {categories.length === 0 && (
          <FormBanner tone="info">
            Nenhuma categoria de alegação cadastrada para esta organização.
          </FormBanner>
        )}
        <Field>
          <FieldLabel htmlFor={catIds.controlProps.id}>Categoria</FieldLabel>
          <NativeSelect
            {...catIds.controlProps}
            value={categoryId}
            disabled={isPending}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Selecione uma categoria…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={descIds.controlProps.id}>Descrição</FieldLabel>
          <Textarea
            {...descIds.controlProps}
            value={description}
            disabled={isPending}
            maxLength={4000}
            placeholder="Descreva a alegação (Markdown suportado)."
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={sevIds.controlProps.id}>Gravidade (opcional)</FieldLabel>
            <NativeSelect
              {...sevIds.controlProps}
              value={severity}
              disabled={isPending}
              onChange={(e) => setSeverity(e.target.value as AllegationSeverity | "")}
            >
              <option value="">Não informada</option>
              {ALLEGATION_SEVERITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor={dateIds.controlProps.id}>Data do fato (opcional)</FieldLabel>
            <Input
              {...dateIds.controlProps}
              type="date"
              value={eventDate}
              disabled={isPending}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </Field>
        </div>
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
              isPending || categoryId === "" || description.trim().length === 0
            }
            onClick={() =>
              run(
                () =>
                  addEthicsAllegation(
                    caseId,
                    categoryId,
                    description.trim(),
                    severity === "" ? null : severity,
                    eventDate === "" ? null : eventDate,
                  ),
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            {isPending ? "Adicionando…" : "Adicionar alegação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdateStatusDialog({
  allegationId,
  current,
}: {
  allegationId: string;
  current: AllegationStatus;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AllegationStatus>(current);
  const { run, isPending, error, clearError } = useEthicsAction();
  const { controlProps } = useFieldIds("ethics-allegation-status");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setStatus(current);
      clearError();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <ListChecks aria-hidden="true" />
          Situação
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar situação da alegação</DialogTitle>
          <DialogDescription>
            Atualize o estágio de análise desta alegação.
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        <Field>
          <FieldLabel htmlFor={controlProps.id}>Situação</FieldLabel>
          <NativeSelect
            {...controlProps}
            value={status}
            disabled={isPending}
            onChange={(e) => setStatus(e.target.value as AllegationStatus)}
          >
            {ALLEGATION_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
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
            disabled={isPending || status === current}
            onClick={() =>
              run(() => updateEthicsAllegation(allegationId, { status }), {
                onSuccess: () => setOpen(false),
              })
            }
          >
            {isPending ? "Salvando…" : "Salvar situação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordFindingDialog({ allegationId }: { allegationId: string }) {
  const [open, setOpen] = useState(false);
  const [finding, setFinding] = useState<FindingValue>(FINDING_OPTIONS[0].value);
  const [rationale, setRationale] = useState("");
  const [evidence, setEvidence] = useState("");
  const { run, isPending, error, clearError } = useEthicsAction();
  const findingIds = useFieldIds("ethics-finding-value");
  const rationaleIds = useFieldIds("ethics-finding-rationale");
  const evidenceIds = useFieldIds("ethics-finding-evidence");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setFinding(FINDING_OPTIONS[0].value);
      setRationale("");
      setEvidence("");
      clearError();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg">
          <ClipboardCheck aria-hidden="true" />
          Registrar conclusão
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar conclusão da alegação</DialogTitle>
          <DialogDescription>
            A conclusão é o registro formal do julgamento desta alegação. Só pode
            ser registrada uma vez.
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        <Field>
          <FieldLabel htmlFor={findingIds.controlProps.id}>Conclusão</FieldLabel>
          <NativeSelect
            {...findingIds.controlProps}
            value={finding}
            disabled={isPending}
            onChange={(e) => setFinding(e.target.value as FindingValue)}
          >
            {FINDING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={rationaleIds.controlProps.id}>Fundamentação (opcional)</FieldLabel>
          <Textarea
            {...rationaleIds.controlProps}
            value={rationale}
            disabled={isPending}
            maxLength={4000}
            placeholder="Fundamentação da conclusão."
            onChange={(e) => setRationale(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={evidenceIds.controlProps.id}>Síntese das provas (opcional)</FieldLabel>
          <Textarea
            {...evidenceIds.controlProps}
            value={evidence}
            disabled={isPending}
            maxLength={4000}
            placeholder="Síntese das provas consideradas."
            onChange={(e) => setEvidence(e.target.value)}
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
                  recordEthicsFinding(
                    allegationId,
                    finding,
                    rationale.trim() === "" ? null : rationale.trim(),
                    evidence.trim() === "" ? null : evidence.trim(),
                  ),
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            {isPending ? "Registrando…" : "Registrar conclusão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

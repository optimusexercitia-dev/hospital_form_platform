"use client";

import { useState } from "react";
import { CalendarPlus, CheckCircle2 } from "lucide-react";

import {
  completeEthicsHearing,
  scheduleEthicsHearing,
} from "@/lib/ethics/actions";
import type { EthicsHearing, HearingType } from "@/lib/queries/ethics";
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
import { localDateTimeToIso } from "./ethics-datetime";
import {
  HEARING_TYPE_LABELS,
  HEARING_TYPE_OPTIONS,
  formatEthicsDateTime,
} from "./ethics-labels";

/**
 * Hearings (ETH·E2 D8) — each rides a `participants_only` meeting created by the
 * `schedule_ethics_hearing` door (its panel roster excludes the recused +
 * respondent by construction). Wires schedule + complete
 * (`complete_ethics_hearing`, records presence flags + outcome).
 */
export function EthicsHearingsPanel({
  caseId,
  hearings,
}: {
  caseId: string;
  hearings: EthicsHearing[];
}) {
  return (
    <EthicsSection
      id="ethics-hearings"
      title="Audiências"
      description="Sessões de audiência do processo. Cada audiência ocorre em uma reunião reservada aos participantes."
      actions={<ScheduleHearingDialog caseId={caseId} />}
    >
      {hearings.length === 0 ? (
        <EthicsEmpty>Nenhuma audiência agendada.</EthicsEmpty>
      ) : (
        <ul className="flex flex-col gap-3">
          {hearings.map((h) => {
            const done = h.completedAt !== null;
            return (
              <li
                key={h.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{HEARING_TYPE_LABELS[h.hearingType]}</span>
                    <CaseStatusBadge
                      label={done ? "Concluída" : "Agendada"}
                      colorToken={done ? "green" : "blue"}
                    />
                  </div>
                  {!done && <CompleteHearingDialog hearingId={h.id} />}
                </div>
                <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <div className="flex gap-1">
                    <dt>Agendada para:</dt>
                    <dd>{formatEthicsDateTime(h.scheduledAt)}</dd>
                  </div>
                  {h.completedAt && (
                    <div className="flex gap-1">
                      <dt>Concluída em:</dt>
                      <dd>{formatEthicsDateTime(h.completedAt)}</dd>
                    </div>
                  )}
                </dl>
                {done && (
                  <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <PresenceChip label="Denunciado" value={h.respondentPresent} />
                    <PresenceChip label="Denunciante" value={h.complainantPresent} />
                    <PresenceChip label="Repr. legal" value={h.legalRepresentativePresent} />
                  </dl>
                )}
                {h.summaryMd && (
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Resumo
                    </p>
                    <MarkdownRenderer content={h.summaryMd} className="mt-1 text-sm" />
                  </div>
                )}
                {h.outcomeMd && (
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Resultado
                    </p>
                    <MarkdownRenderer content={h.outcomeMd} className="mt-1 text-sm" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </EthicsSection>
  );
}

function PresenceChip({ label, value }: { label: string; value: boolean | null }) {
  const text = value === null ? "—" : value ? "presente" : "ausente";
  return (
    <div className="flex gap-1">
      <dt>{label}:</dt>
      <dd>{text}</dd>
    </div>
  );
}

function ScheduleHearingDialog({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<HearingType>(HEARING_TYPE_OPTIONS[0].value);
  const [scheduledAt, setScheduledAt] = useState("");
  const { run, isPending, error, clearError } = useEthicsAction();
  const typeIds = useFieldIds("ethics-hearing-type");
  const schedIds = useFieldIds("ethics-hearing-scheduled");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setType(HEARING_TYPE_OPTIONS[0].value);
      setScheduledAt("");
      clearError();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg">
          <CalendarPlus aria-hidden="true" />
          Agendar audiência
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agendar audiência</DialogTitle>
          <DialogDescription>
            Cria uma reunião reservada aos participantes do processo (membros
            impedidos e o denunciado ficam de fora).
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        <Field>
          <FieldLabel htmlFor={typeIds.controlProps.id}>Tipo de audiência</FieldLabel>
          <NativeSelect
            {...typeIds.controlProps}
            value={type}
            disabled={isPending}
            onChange={(e) => setType(e.target.value as HearingType)}
          >
            {HEARING_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={schedIds.controlProps.id}>Data e hora (opcional)</FieldLabel>
          <Input
            {...schedIds.controlProps}
            type="datetime-local"
            value={scheduledAt}
            disabled={isPending}
            onChange={(e) => setScheduledAt(e.target.value)}
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
                  scheduleEthicsHearing(
                    caseId,
                    type,
                    null,
                    localDateTimeToIso(scheduledAt),
                  ),
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            {isPending ? "Agendando…" : "Agendar audiência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompleteHearingDialog({ hearingId }: { hearingId: string }) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState("");
  const [respondent, setRespondent] = useState<PresenceValue>("");
  const [complainant, setComplainant] = useState<PresenceValue>("");
  const [legal, setLegal] = useState<PresenceValue>("");
  const { run, isPending, error, clearError } = useEthicsAction();
  const summaryIds = useFieldIds("ethics-hearing-summary");
  const outcomeIds = useFieldIds("ethics-hearing-outcome");
  const respIds = useFieldIds("ethics-hearing-respondent");
  const compIds = useFieldIds("ethics-hearing-complainant");
  const legalIds = useFieldIds("ethics-hearing-legal");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSummary("");
      setOutcome("");
      setRespondent("");
      setComplainant("");
      setLegal("");
      clearError();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="lg">
          <CheckCircle2 aria-hidden="true" />
          Registrar resultado
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar resultado da audiência</DialogTitle>
          <DialogDescription>
            Registre a presença das partes, um resumo e o resultado da audiência.
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        <div className="grid gap-4 sm:grid-cols-3">
          <PresenceField label="Denunciado" ids={respIds} value={respondent} onChange={setRespondent} disabled={isPending} />
          <PresenceField label="Denunciante" ids={compIds} value={complainant} onChange={setComplainant} disabled={isPending} />
          <PresenceField label="Repr. legal" ids={legalIds} value={legal} onChange={setLegal} disabled={isPending} />
        </div>
        <Field>
          <FieldLabel htmlFor={summaryIds.controlProps.id}>Resumo</FieldLabel>
          <Textarea
            {...summaryIds.controlProps}
            value={summary}
            disabled={isPending}
            maxLength={4000}
            placeholder="Resumo da audiência."
            onChange={(e) => setSummary(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={outcomeIds.controlProps.id}>Resultado</FieldLabel>
          <Textarea
            {...outcomeIds.controlProps}
            value={outcome}
            disabled={isPending}
            maxLength={4000}
            placeholder="Resultado da audiência."
            onChange={(e) => setOutcome(e.target.value)}
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
              isPending || summary.trim().length === 0 || outcome.trim().length === 0
            }
            onClick={() =>
              run(
                () =>
                  completeEthicsHearing(hearingId, {
                    summaryMd: summary.trim(),
                    outcomeMd: outcome.trim(),
                    respondentPresent: toBool(respondent),
                    complainantPresent: toBool(complainant),
                    legalRepresentativePresent: toBool(legal),
                  }),
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            {isPending ? "Registrando…" : "Registrar resultado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type PresenceValue = "" | "yes" | "no";

function toBool(v: PresenceValue): boolean | null {
  if (v === "yes") return true;
  if (v === "no") return false;
  return null;
}

function PresenceField({
  label,
  ids,
  value,
  onChange,
  disabled,
}: {
  label: string;
  ids: ReturnType<typeof useFieldIds>;
  value: PresenceValue;
  onChange: (v: PresenceValue) => void;
  disabled: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={ids.controlProps.id}>{label}</FieldLabel>
      <NativeSelect
        {...ids.controlProps}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as PresenceValue)}
      >
        <option value="">Não informado</option>
        <option value="yes">Presente</option>
        <option value="no">Ausente</option>
      </NativeSelect>
    </Field>
  );
}

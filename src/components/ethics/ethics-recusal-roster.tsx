"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

import { liftRecusal } from "@/lib/case-recusals/actions";
import type { CaseRecusalRosterEntry } from "@/lib/queries/ethics";
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
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, useFieldIds } from "@/components/ui/field";
import { FormBanner } from "@/components/auth/form-banner";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";

import { EthicsSection, EthicsEmpty } from "./ethics-section";
import { useEthicsAction } from "./use-ethics-action";
import { formatEthicsDateTime } from "./ethics-labels";

const SOURCE_LABELS: Record<CaseRecusalRosterEntry["source"], string> = {
  self: "Autodeclarado",
  coordinator: "Pela coordenação",
  conflict: "Por conflito",
};

/**
 * The case's impediment (recusal) roster (ETH·E2 Part 1, roster half). Reads the
 * coordinator recusal list (`listCaseRecusals` — `can_read_case`-gated, coordinator
 * SELECT arm) so an active recusal on ANY member can be reverted via the live
 * `lift_recusal` door. A live entry (`liftedAt === null`) means the member currently
 * has no case access.
 */
export function EthicsRecusalRoster({
  recusals,
}: {
  recusals: CaseRecusalRosterEntry[];
}) {
  const live = recusals.filter((r) => r.liftedAt === null);
  return (
    <EthicsSection
      id="ethics-recusals"
      title="Impedimentos do processo"
      description="Membros impedidos de participar deste processo ético. Um impedimento ativo remove o acesso ao caso e exclui o membro da votação."
      badge={
        live.length > 0 ? (
          <CaseStatusBadge label={`${live.length} ativo(s)`} colorToken="amber" />
        ) : undefined
      }
    >
      {recusals.length === 0 ? (
        <EthicsEmpty>Nenhum impedimento registrado neste processo.</EthicsEmpty>
      ) : (
        <ul className="flex flex-col gap-3">
          {recusals.map((rec) => {
            const isLive = rec.liftedAt === null;
            return (
              <li
                key={rec.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {rec.userName ?? "Membro"}
                    </span>
                    <CaseStatusBadge
                      label={SOURCE_LABELS[rec.source]}
                      colorToken="slate"
                    />
                    <CaseStatusBadge
                      label={isLive ? "Ativo" : "Revertido"}
                      colorToken={isLive ? "amber" : "muted"}
                    />
                  </div>
                  {isLive && <LiftRecusalDialog recusalId={rec.id} memberName={rec.userName ?? "este membro"} />}
                </div>
                <p className="text-xs text-muted-foreground">
                  Registrado em {formatEthicsDateTime(rec.recusedAt)}
                  {rec.liftedAt
                    ? ` · revertido em ${formatEthicsDateTime(rec.liftedAt)}`
                    : ""}
                </p>
                {rec.reasonMd && (
                  <MarkdownRenderer content={rec.reasonMd} className="text-sm" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </EthicsSection>
  );
}

function LiftRecusalDialog({
  recusalId,
  memberName,
}: {
  recusalId: string;
  memberName: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { run, isPending, error, clearError } = useEthicsAction();
  const reasonIds = useFieldIds("ethics-lift-reason");

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
          <RotateCcw aria-hidden="true" />
          Reverter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reverter impedimento</DialogTitle>
          <DialogDescription>
            Restaura o acesso de <span className="font-medium">{memberName}</span> ao
            processo. O registro do impedimento é preservado para auditoria.
          </DialogDescription>
        </DialogHeader>
        {error && <FormBanner tone="error">{error}</FormBanner>}
        <Field>
          <FieldLabel htmlFor={reasonIds.controlProps.id}>Motivo da reversão</FieldLabel>
          <Textarea
            {...reasonIds.controlProps}
            value={reason}
            disabled={isPending}
            maxLength={2000}
            placeholder="Motivo para reverter o impedimento."
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
              run(() => liftRecusal(recusalId, reason.trim()), {
                onSuccess: () => setOpen(false),
              })
            }
          >
            {isPending ? "Revertendo…" : "Reverter impedimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

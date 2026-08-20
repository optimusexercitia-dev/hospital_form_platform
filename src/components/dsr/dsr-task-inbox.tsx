"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { DsrTaskRow } from "@/lib/queries/dsr";
import {
  completeDsrTask,
  executeDisposalTask,
} from "@/lib/dsr/actions";
import {
  DSR_RESIDUE_NOTICE,
  DSR_TASK_KIND_LABELS,
} from "@/lib/dsr/messages";
import { commissionHref } from "@/lib/routing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, useFieldIds } from "@/components/ui/field";
import { FormBanner } from "@/components/auth/form-banner";

const DISPOSAL_KINDS = new Set([
  "dispose_case",
  "dispose_event",
  "dispose_referral",
  "dispose_meeting",
]);

/**
 * The executor task inbox — the surface that discharges pilot-gate item 0.
 *
 * ⛔ THE BUTTON DOES NOT GRANT ANYTHING. "Executar descarte" calls the module's
 * OWN disposal action under the executor's own session, so `dispose_case_phi` /
 * `dispose_event_phi` / `dispose_referral_phi` each apply their existing gate
 * unchanged; a caller who cannot pass one sees that door's own pt-BR refusal.
 * Only after the module row is actually stamped disposed will `complete_dsr_task`
 * accept the task (ADR 0130 Amdt 2 item 2 — it verifies the effect, not a copy of
 * the gate).
 *
 * ⚠ THE RESIDUE NOTICE IS NOT DECORATION. It is the ADR 0130 Decision 9 fixed
 * language, shown BEFORE the irreversible click, and it is deliberately narrower
 * than the shipped referral dialog's "apaga permanentemente … todos os campos"
 * (`FUP-DISPOSE-DIALOG-OVERCLAIM`). Slice 4 rewrites that dialog with this same
 * constant; this surface simply never ships the over-claim.
 */
export function DsrTaskInbox({
  org,
  tasks,
}: {
  org: string;
  tasks: DsrTaskRow[];
}) {
  const pending = tasks.filter((t) => t.status === "pending");
  const settled = tasks.filter((t) => t.status !== "pending");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Minhas tarefas</h2>
        <span className="text-sm text-muted-foreground">
          {pending.length} pendente{pending.length === 1 ? "" : "s"}
        </span>
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Nenhuma tarefa de titular atribuída a você neste hospital.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {[...pending, ...settled].map((task) => (
            <li key={task.id}>
              <DsrTaskCard org={org} task={task} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DsrTaskCard({ org, task }: { org: string; task: DsrTaskRow }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const router = useRouter();
  const noteField = useFieldIds(`note-${task.id}`);

  const isDisposal = DISPOSAL_KINDS.has(task.kind);
  const isDone = task.status === "done";
  const label = DSR_TASK_KIND_LABELS[task.kind] ?? task.kind;

  const entityHref =
    task.commissionSlug && task.entityId
      ? task.module === "referral"
        ? commissionHref(org, task.commissionSlug, "encaminhamentos", task.entityId)
        : task.module === "case"
          ? commissionHref(org, task.commissionSlug, "casos", task.entityId)
          : task.module === "meeting"
            ? commissionHref(org, task.commissionSlug, "meetings", task.entityId)
            : null
      : null;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
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
          <h3 className="text-sm font-semibold">{label}</h3>
          <p className="text-xs text-muted-foreground">
            {task.commissionName ?? "Comissão fora do seu acesso"}
            {entityHref ? (
              <>
                {" · "}
                <a
                  href={entityHref}
                  className="underline underline-offset-2 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  abrir registro
                </a>
              </>
            ) : null}
          </p>
        </div>
        <span
          className={
            isDone
              ? "rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground"
              : "rounded-full border border-border px-2 py-0.5 text-xs font-medium"
          }
        >
          {isDone ? "Concluída" : "Pendente"}
        </span>
      </div>

      {task.note ? (
        <p className="mt-3 text-sm text-muted-foreground">{task.note}</p>
      ) : null}

      {!isDone ? (
        <div className="mt-4 flex flex-col gap-3">
          {/* ⚠ TWO AFFORDANCES, TWO DIFFERENT RULES, and conflating them was a bug
              in both directions. "Executar descarte" fires a module door, so it is
              shown only to someone who can pass that door's gate — the Encarregado
              holds no disposal arm by design (ADR 0130 D2) and offering it to them
              would contradict the split on screen. "Concluir tarefa" is
              bookkeeping: `complete_dsr_task` accepts anyone the RLS policy lets
              SEE the task (the same `is_dpo_of OR can_execute_dsr_task`
              disjunction), and for a disposal task the EFFECT check is what stops
              a premature close — nobody can mark disposed what is not disposed.
              Gating that button on `canExecute` too would have locked the
              Encarregado out of their own attestation tasks. */}
          {isDisposal && !task.canExecute ? (
            <p className="text-xs text-muted-foreground">
              Aguardando execução pela equipe responsável.
            </p>
          ) : null}
          {isDisposal ? (
            <details className="rounded-md border border-border/70 bg-muted/40 p-3">
              <summary className="cursor-pointer text-xs font-medium">
                O que o descarte apaga — e o que permanece
              </summary>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-xs text-muted-foreground">
                {DSR_RESIDUE_NOTICE.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </details>
          ) : (
            <Field>
              <FieldLabel htmlFor={noteField.controlProps.id}>
                O que foi revisado
              </FieldLabel>
              <Textarea
                {...noteField.controlProps}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Descreva o que foi verificado e o resultado."
              />
            </Field>
          )}

          <FormBanner tone="error">{error}</FormBanner>

          <div className="flex flex-wrap gap-2">
            {isDisposal && task.canExecute && task.module && task.entityId ? (
              <Button
                type="button"
                disabled={isPending}
                onClick={() =>
                  run(() =>
                    executeDisposalTask({
                      org,
                      taskId: task.id,
                      module: task.module as string,
                      entityId: task.entityId as string,
                    }),
                  )
                }
              >
                {isPending ? "Executando…" : "Executar descarte e concluir"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant={isDisposal ? "outline" : "default"}
              disabled={isPending}
              onClick={() =>
                run(() => completeDsrTask({ org, taskId: task.id, note }))
              }
            >
              {isPending ? "Salvando…" : "Concluir tarefa"}
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

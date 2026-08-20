"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Info } from "lucide-react";

import type { DsrTaskRow } from "@/lib/queries/dsr";
import { completeDsrTask, executeDisposalTask } from "@/lib/dsr/actions";
import {
  DSR_MEETING_RESIDUE_RETAINED,
  DSR_MESSAGES,
  DSR_RESIDUE_NOTICE,
  DSR_TASK_EXECUTOR_HINTS,
  dsrTaskLabel,
} from "@/lib/dsr/messages";
import { commissionHref, nspHref } from "@/lib/routing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel, useFieldIds } from "@/components/ui/field";
import { FormBanner } from "@/components/auth/form-banner";
import { DsrAttestForm } from "@/components/dsr/dsr-attest-form";
import { DsrMeetingDisposeDialog } from "@/components/dsr/dsr-meeting-dispose-dialog";

const DISPOSAL_KINDS = new Set([
  "dispose_case",
  "dispose_event",
  "dispose_referral",
  "dispose_meeting",
]);

/**
 * The executor task inbox — the surface that discharged pilot-gate item 0, now
 * carrying all three of Slice 3's task lanes.
 *
 * ⛔ THE BUTTON DOES NOT GRANT ANYTHING. Every disposal affordance calls the
 * module's OWN action under the executor's own session, so `dispose_case_phi` /
 * `dispose_event_phi` / `dispose_referral_phi` / `dispose_meeting_minutes` each
 * apply their existing gate unchanged; a caller who cannot pass one sees that
 * door's own pt-BR refusal. Only after the module row is actually stamped disposed
 * will `complete_dsr_task` accept the task (ADR 0130 Amdt 2 item 2 — it verifies
 * the EFFECT, not a copy of the gate).
 *
 * ⚠ THE RESIDUE NOTICE IS NOT DECORATION. It is the ADR 0130 Decision 9 fixed
 * language, shown BEFORE the irreversible click, and it is deliberately narrower than
 * an unqualified erasure promise: what leaves is the database PHI of the named record,
 * and the notice says exactly that. ⛔ Every dispose surface renders this one shared
 * constant — none writes, paraphrases or extends residue copy of its own — so the
 * platform makes one claim to an operator, from one file, wherever it is made.
 *
 * The discipline exists because a dispose dialog once promised a permanent wipe of
 * every sensitive field while saying nothing about retained encrypted attachments, the
 * PITR window, or already-distributed copies — the over-claim ADR 0056's narrowed
 * closure forbids (`FUP-DISPOSE-DIALOG-OVERCLAIM`).
 *
 * ⚠ THE pt-BR WORDING IS NOT REPRODUCED HERE, but that is now a STYLE CHOICE, not a
 * rule. It used to be load-bearing: the over-claim was policed by a grep over `src/`, so
 * a comment quoting it to warn the next reader was indistinguishable from the defect
 * itself — which happened four times in one day, to authors who knew the rule. That grep
 * was RETIRED on 2026-08-20 (measured record: 0 true, 4 false positives) and replaced by
 * rendered-output assertions, where comments do not exist. ⛔ Do not reinstate the
 * prohibition without reinstating an instrument that could enforce it — see
 * `.claude/rules/ui-copy-forbidden-strings.md`.
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
        <span className="text-sm text-muted-foreground tabular-nums">
          {pending.length} pendente{pending.length === 1 ? "" : "s"}
        </span>
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground text-pretty">
          Nenhuma tarefa de titular atribuída a você neste hospital.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {/* `data-rise` + `.animate-rise-in` is the house pairing: GSAP owns the
              stagger (the console's `RiseInGroup` matches these descendants) and
              the CSS utility is the no-JS / pre-hydration baseline. Deliberately
              NO per-item `--rise-delay` here — the group already staggers, and
              adding a CSS delay on top would stagger twice. */}
          {[...pending, ...settled].map((task) => (
            <li key={task.id} data-rise className="animate-rise-in">
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
  const isAttestation = task.kind === "attest_review";
  const isDone = task.status === "done";
  /**
   * ⛔ RETIRED BY DECISION — NOT "blocked", and the copy must not say so.
   *
   * `'blocked'` has been in {@link DsrTaskStatus} since Slice 2 but NOTHING EVER
   * WROTE IT, so this card was authored when `pending`/`done` were the only
   * reachable values. `close_dsr_request` now retires outstanding tasks on a
   * non-granting close, which is a real defect fix: after a `refused_retention`
   * close every task stayed `pending` and the executor was still offered six
   * executable tasks — three of them PHI ERASURES — on a request whose decision
   * was to RETAIN. The workflow was instructing the opposite of its own decision.
   *
   * ⚠ THE ENUM VALUE'S NAME IS MISLEADING HERE. `blocked` reads as "cannot proceed
   * YET", i.e. queued behind something. These tasks are the opposite: the decision
   * is made and the work is CANCELLED. That distinction is not on the task at all —
   * it lives in `dsr_requests.status === 'closed'` plus a non-granting `outcome`,
   * one join away. So the card states the CONSEQUENCE ("closed with the request,
   * do not execute"), never the raw enum value, which would tell an executor to
   * wait for something that is never coming.
   *
   * ⛔ NO SURFACE MAY NAME THE CAUSE OF A RETIREMENT FROM `status` ALONE, and the
   * copy widened TWICE for that reason:
   *   1. `DsrTaskRow` carries NO `outcome` — measured, not assumed — and THREE
   *      outcomes retire tasks (`refused_retention`, `refused_identity`,
   *      `withdrawn`). Naming retention, as the original suggestion and my first
   *      draft did, is simply false on a withdrawal or an identity refusal.
   *   2. `blocked` now has TWO WRITERS: a non-granting close, AND an escalation
   *      retiring that meeting's own `attest_review` when `dispose_meeting` is
   *      minted. In the second case the request is OPEN and GRANTED, so even
   *      "encerrada com a solicitação" is false — the phrasing my first widening
   *      kept. `dsr_tasks` cannot distinguish the two writers, and the
   *      stamped-reason column is deliberately out of this slice.
   * So the sentence names only what `status` actually supports: a recorded decision
   * retired this task. ⛔ Do not let a later change re-narrow it. Which decision,
   * and why, belongs to the request page where `outcome` is in scope.
   */
  const isRetired = task.status === "blocked";
  /** Neither actionable nor achieved — no affordance, and no "pendente" badge. */
  const isSettled = isDone || isRetired;
  // ⚠ `dsrTaskLabel`, never the bare kind map: `attest_review` covers two
  // different subjects (a specific ata vs. a whole commission's free text) and the
  // map cannot tell them apart. A reviewer must know which one they are attesting.
  const label = dsrTaskLabel(task.kind, task.module);
  const executorHint = DSR_TASK_EXECUTOR_HINTS[task.kind];

  /**
   * The link to the record this task acts on.
   *
   * ⚠ EVERY NULL BELOW IS A DECIDED NULL, and each says why. The previous shape
   * gated the WHOLE expression on `commissionSlug && entityId`, which quietly
   * swallowed `event`: events are NOT commission-scoped, so they never have a
   * commission href to build — but they do have an NSP one, needing only `org` and
   * the id, both of which this card holds. The result was that a `dispose_event`
   * task rendered with no way to open the record it was asking someone to
   * IRREVERSIBLY ERASE. For a PHI-erasure corridor, being unable to confirm you
   * have the right record before an irreversible act is a safety affordance, not
   * navigation polish.
   *
   * ⚠ It was not an unexercised path — `dispose_event` is the very kind pilot-gate
   * item 0 executed. The run proved the disposal BUTTON fires; nothing asserted the
   * link beside it existed. Executing a corridor does not verify the affordances
   * around it.
   *
   * The mirror image is `patient-index/trajectory-table.tsx`, which links `event`
   * via `nspHref` and returns null for case/referral BECAUSE it lacks the
   * commission slug. Its nulls carry that justification; this one's did not.
   */
  const entityHref = (() => {
    if (!task.entityId) return null; // no target to link to at all
    switch (task.module) {
      case "event":
        // Org-scoped NSP detail — deliberately does NOT require `commissionSlug`,
        // which an event never carries.
        return nspHref(org, task.entityId);
      case "referral":
        if (!task.commissionSlug) return null; // commission-scoped: no slug, no href
        return commissionHref(org, task.commissionSlug, "encaminhamentos", task.entityId);
      case "case":
        if (!task.commissionSlug) return null;
        return commissionHref(org, task.commissionSlug, "casos", task.entityId);
      case "meeting":
        if (!task.commissionSlug) return null;
        return commissionHref(org, task.commissionSlug, "meetings", task.entityId);
      default:
        // `module` is null on the entity-less kinds (`attest_review` sweeps,
        // `notify_scrub_check`) — there is no single record to open.
        return null;
    }
  })();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? DSR_MESSAGES.unexpected);
      }
    });
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-border sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">{label}</h3>
          <p className="text-xs text-muted-foreground">
            {/* ⚠ THREE DIFFERENT FACTS, THREE DIFFERENT STRINGS (BUG-DSR-S3-003).
                This rendered "Comissão fora do seu acesso" for every null name,
                which stated a PERMISSION PROBLEM where none existed:
                  · a name           → show it;
                  · no commission AT ALL (`commissionId === null`) → the task is
                    hospital-scoped BY DESIGN. `notify_scrub_check` is the live
                    case (ADR 0130 Q12a): notification residue is scrubbed per
                    hospital, so there is no commission to name. Reporting that as
                    an access failure sends an executor hunting a grant that was
                    never missing;
                  · a commission whose NAME is not readable → the honest access
                    statement, and the only one of the three that is about access.
                "Has no commission" and "you may not read its name" are different
                facts; one string cannot carry both. */}
            {task.commissionName ??
              (task.commissionId === null
                ? "Tarefa do hospital — sem comissão vinculada"
                : "Comissão fora do seu acesso")}
            {entityHref ? (
              <>
                {" · "}
                <a
                  href={entityHref}
                  className="rounded underline underline-offset-2 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
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
              ? "inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-0.5 text-xs font-medium text-success"
              : isRetired
                ? "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                : "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
          }
        >
          {isDone ? <CheckCircle2 aria-hidden="true" className="size-3.5" /> : null}
          {isRetired ? <Ban aria-hidden="true" className="size-3.5" /> : null}
          {isDone ? "Concluída" : isRetired ? "Encerrada" : "Pendente"}
        </span>
      </div>

      {/* The MINTED PROCEDURE text (never overwritten by a completion note — an
          attestation task whose procedure vanished on completion could not
          document the corridor it exists to document).

          ⛔ SUPPRESSED ON A RETIRED TASK. The procedure is step-by-step
          INSTRUCTIONS TO ACT ("reabra a reunião, edite o trecho e assine
          novamente"). On a task the decision has retired, printing them directly
          contradicts the sentence immediately below telling the executor not to
          execute — and an executor who follows them would reopen and re-sign a
          meeting on a request that ordered no erasure. A retired card carries the
          retirement explanation instead; the procedure is still on the record for
          any task that is actually live. */}
      {task.note && !isRetired ? (
        <p className="mt-3 text-sm text-muted-foreground text-pretty">
          {task.note}
        </p>
      ) : null}

      {/* ⛔ WHY THIS TASK IS NOT ACTIONABLE. Without this the card is silent: the
          buttons vanish (`canExecute` now excludes retired tasks) and nothing says
          why, which reads as a permission problem or a bug. It states the DECISION,
          because "do not execute this erasure" is the actionable fact — an executor
          who waits for it to unblock is waiting forever. */}
      {isRetired ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground text-pretty">
          <Ban aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Encerrada pela decisão registrada — esta tarefa não deve ser
            executada.
          </span>
        </p>
      ) : null}

      {/* What the human wrote on completion.
          ⚠ `completionNote` is a SEPARATE COLUMN from `note` above, and that
          separation is load-bearing: `complete_dsr_task` used to overwrite `note`
          with the completion text, which destroyed an attestation task's minted
          revoke-corridor procedure at the exact moment it was completed. `note` is
          the immutable procedure; `completionNote` is the statement.
          `attestedByName`/`attestedRedactions` are attestation-only (CHECK-enforced
          null on the other five kinds), so a completed attestation renders as the
          NAMED STATEMENT it is — matching the record delivered to the subject. */}
      {isSettled && (task.completionNote || task.attestedByName) ? (
        <dl className="mt-3 flex flex-col gap-1 rounded-xl border border-border bg-background/60 p-3 text-xs">
          {isAttestation && task.attestedByName ? (
            <>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Atestado por</dt>
                <dd className="font-medium">{task.attestedByName}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Menções removidas</dt>
                <dd className="font-medium tabular-nums">
                  {task.attestedRedactions ?? 0}
                </dd>
              </div>
            </>
          ) : null}
          {task.completionNote ? (
            <div className="flex flex-col gap-0.5 pt-1">
              <dt className="text-muted-foreground">O que foi revisado</dt>
              <dd className="text-pretty">{task.completionNote}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {!isSettled ? (
        <div className="mt-4 flex flex-col gap-3">
          {/* ⚠ TWO AFFORDANCES, TWO DIFFERENT RULES, and conflating them was a bug
              in both directions.

              ⛔ `canExecute` IS NOT A GATE MIRROR — do not describe it as one.
              This comment used to claim a disposal affordance "is shown only to
              someone who can pass that door's gate". That is FALSE:
              `app.can_execute_dsr_task` is deliberately COARSER than the four
              disposal doors, because mirroring four different gate expressions in a
              fifth place was rejected outright (ADR 0130 Amdt 2 item 2 — a mirror
              nothing keeps in sync is a liability). It over-admits relative to
              `dispose_case_phi` and `dispose_meeting_minutes` in particular. So
              `canExecute === true` means "worth offering", NOT "will succeed"; the
              MODULE DOOR is the only authority, and a caller who cannot pass it
              sees that door's own pt-BR refusal surfaced here rather than hidden.
              Same statement as `DSR_TASK_EXECUTOR_HINTS`' docblock: nothing on this
              side is a boundary.

              What `canExecute` is actually FOR: the Encarregado holds no disposal
              arm by design (D2), so offering them an erasure button would
              contradict the power split on screen.

              "Concluir tarefa" / the attestation form are bookkeeping and are NOT
              gated on it: `complete_dsr_task` accepts anyone the RLS policy lets
              SEE the task, and for a disposal task the EFFECT check is what stops a
              premature close — nobody can mark disposed what is not disposed.
              Gating those on `canExecute` too once locked the Encarregado out of
              their own attestation tasks. */}
          {isDisposal && !task.canExecute ? (
            <p className="flex items-start gap-2 text-xs text-muted-foreground text-pretty">
              <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Aguardando execução pela equipe responsável.
                {executorHint ? ` ${executorHint}` : null}
              </span>
            </p>
          ) : null}

          {isAttestation ? (
            <DsrAttestForm org={org} task={task} />
          ) : isDisposal ? (
            <details className="rounded-xl border border-border/70 bg-muted/40 p-3">
              <summary className="cursor-pointer rounded text-xs font-medium focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none">
                O que o descarte apaga — e o que permanece
              </summary>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-xs text-muted-foreground">
                {DSR_RESIDUE_NOTICE.map((line) => (
                  <li key={line} className="text-pretty">
                    {line}
                  </li>
                ))}
              </ul>
              {/* ⛔ MEETING LANE ONLY. This card renders for every disposal kind,
                  and `DSR_MEETING_RESIDUE_RETAINED` is FALSE of the case, event and
                  referral doors — their reaches differ. Gated on the kind, beside
                  the shared notice, never merged into it (ADR 0056 Amdt 1). */}
              {task.kind === "dispose_meeting" ? (
                <>
                  <p className="mt-3 text-xs font-semibold">
                    Nesta ata, também permanecem
                  </p>
                  <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-xs text-muted-foreground">
                    {DSR_MEETING_RESIDUE_RETAINED.map((line) => (
                      <li key={line} className="text-pretty">
                        {line}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
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

          {/* The attestation form owns its own banner + submit. */}
          {!isAttestation ? (
            <>
              <FormBanner tone="error">{error}</FormBanner>

              <div className="flex flex-wrap gap-2">
                {/* The meetings lane — ADR 0056 Consequence (a)'s never-built
                    affordance. It gets a confirm DIALOG rather than a bare button
                    because `dispose_meeting_minutes` erases the WHOLE minutes,
                    including other committees' agenda items. */}
                {task.kind === "dispose_meeting" &&
                task.canExecute &&
                task.entityId ? (
                  <DsrMeetingDisposeDialog
                    org={org}
                    taskId={task.id}
                    meetingId={task.entityId}
                    label={task.commissionName ?? label}
                  />
                ) : null}

                {isDisposal &&
                task.kind !== "dispose_meeting" &&
                task.canExecute &&
                task.module &&
                task.entityId ? (
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
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

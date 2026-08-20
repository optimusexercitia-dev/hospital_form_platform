"use client";

import Link from "next/link";
import { ArrowUpRight, Gavel } from "lucide-react";

import type { DsrRequestRow } from "@/lib/queries/dsr";
import { DSR_OUTCOME_LABELS, DSR_STATUS_LABELS } from "@/lib/dsr/messages";
import { dsrHref } from "@/lib/routing";
import { DsrDueBadge, DsrDueNotice } from "@/components/dsr/dsr-due-badge";
import { DsrIntakePanel } from "@/components/dsr/dsr-intake-panel";

/**
 * The Encarregado (DPO) lane: open a request, and reach the ones already open.
 *
 * ⚠ ADJUDICATION AND CLOSE LIVE ON THE REQUEST'S OWN PAGE, not here. Both need
 * per-request server reads (the two-tier outcome record and the escalatable
 * meeting list), so inlining them on this list would be one pair of reads per
 * row. Each card is therefore a link into `/o/[org]/titulares/[requestId]`, which
 * is also what makes the detail route reachable — a console nothing links to is a
 * door nothing can reach.
 *
 * ⚠ THE PLATFORM NEVER STORES WHO THE REQUEST IS ABOUT (ADR 0130 Q6), so a card
 * is identified by its FILE REFERENCE — the pointer to the hospital's own paper
 * or GED file where the identity documents live. There is nothing else to show,
 * by design.
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

      <DsrIntakePanel org={org} hospitalId={hospitalId} />

      {requests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground text-pretty">
          Nenhuma solicitação registrada neste hospital.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <DsrDueNotice />
          <ul className="flex flex-col gap-3">
            {requests.map((request) => (
              <li key={request.id} data-rise className="animate-rise-in">
                <DsrRequestCard org={org} request={request} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DsrRequestCard({
  org,
  request,
}: {
  org: string;
  request: DsrRequestRow;
}) {
  // ⛔ EVERY FIGURE BELOW IS COUNTED, NONE IS SUBTRACTED — THIS WAS THE BLOCKER.
  // `listDsrRequests` increments `pending` only for `status === 'pending'`, so
  // `total - pending` silently folds RETIRED tasks into "concluídas": after a
  // `refused_retention` close on a six-task fan-out this card read
  // "6/6 tarefas concluídas" beside the badge "Recusada — retenção" — asserting
  // six PHI erasures that never happened, in the console the controller reads,
  // and contradicting the detail page's "Retirados pela decisão: 6" one click away.
  //
  // `DsrRequestRow` now carries `pendingTasks` / `doneTasks` / `retiredTasks` /
  // `totalTasks`, each counted from rows in `listDsrRequests`, so
  // `pending + done + retired === total` is a real check and not a tautology.
  // ⛔ NEVER reintroduce a remainder here: a derived count has produced a false
  // figure three times in this program (BUG-DSR-S3-007, this blocker, and the
  // `attested.pending` that was caught before it shipped).
  const needsDecision = request.adjudicatedAt === null && request.status !== "closed";

  return (
    <Link
      href={dsrHref(org, request.id)}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="font-mono text-sm font-medium">{request.fileRef}</h3>
          <p className="text-xs text-muted-foreground tabular-nums">
            {request.doneTasks} concluída{request.doneTasks === 1 ? "" : "s"}
            {" · "}
            {request.pendingTasks} pendente
            {request.pendingTasks === 1 ? "" : "s"}
            {request.retiredTasks > 0 ? (
              <>
                {" · "}
                {request.retiredTasks} retirada
                {request.retiredTasks === 1 ? "" : "s"}
              </>
            ) : null}
            {" de "}
            {request.totalTasks}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
          Abrir
          <ArrowUpRight
            aria-hidden="true"
            className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {DSR_STATUS_LABELS[request.status] ?? request.status}
        </span>
        <DsrDueBadge dueDate={request.dueDate} closedAt={request.closedAt} />
        {request.outcome ? (
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
            {DSR_OUTCOME_LABELS[request.outcome] ?? request.outcome}
          </span>
        ) : null}
        {needsDecision ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/8 px-2.5 py-0.5 text-xs font-medium text-primary">
            <Gavel aria-hidden="true" className="size-3.5" />
            Aguardando decisão
          </span>
        ) : null}
      </div>
    </Link>
  );
}

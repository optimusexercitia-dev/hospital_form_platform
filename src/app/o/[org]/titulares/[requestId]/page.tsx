import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  getDsrOutcomeRecord,
  listDsrDisposableMeetings,
  listMyDsrTasks,
} from "@/lib/queries/dsr";
import { dsrHref } from "@/lib/routing";
import { DsrRecordMotion } from "@/components/dsr/dsr-record-motion";
import { DsrOutcomeRecord } from "@/components/dsr/dsr-outcome-record";
import { DsrAdjudicationPanel } from "@/components/dsr/dsr-adjudication-panel";
import { DsrTaskInbox } from "@/components/dsr/dsr-task-inbox";

export const metadata: Metadata = {
  title: "Solicitação de titular",
};

/**
 * One subject request: its two-tier outcome record, the adjudication lane, and
 * the execution tasks it minted (ADR 0130 Slice 3).
 *
 * ACCESS. `getDsrOutcomeRecord` returns `null` for a caller without the
 * Encarregado office, and this page turns that into `notFound()` — so the route
 * is DPO-only and an unentitled caller cannot distinguish "not yours" from "does
 * not exist". ⚠ WHICH MECHANISM produces that null is a question about the data
 * layer, not this file: if the read goes through a `prosecdef` RPC then the gate
 * is the FUNCTION'S OWN and RLS is bypassed for it (a DEFINER body's gate
 * REPLACES RLS — CLAUDE.md's standing warning, and the BUG-AUTHZ-001 confusion in
 * this repo). This page's behaviour is correct either way, and it deliberately
 * asserts nothing about which one it is.
 *
 * ⛔ THE PAGE SHOWS NO PATIENT IDENTITY (Decision 5 / Q6) — there is none to show.
 * A request is identified by its `file_ref`, the pointer to the hospital's own
 * paper/GED file where the identity documents actually live.
 *
 * The task list is the SAME `DsrTaskInbox` the console renders, filtered to this
 * request. Reusing it is deliberate: the completion rules (`canExecute` gates the
 * disposal affordance only; completion is offered to anyone RLS lets see the task)
 * are subtle enough that a second implementation would drift from the first.
 */
export default async function DsrRequestDetailPage({
  params,
}: {
  params: Promise<{ org: string; requestId: string }>;
}) {
  const { org, requestId } = await params;

  const record = await getDsrOutcomeRecord(requestId);
  if (!record) {
    notFound();
  }

  // The record pins the hospital, so the task read needs no `?hospital=` param.
  // Filtering client-side keeps one query rather than adding a request-scoped
  // variant that would have to re-derive the same `canExecute` join.
  const [allTasks, meetings] = await Promise.all([
    listMyDsrTasks(record.hospitalId),
    listDsrDisposableMeetings(requestId),
  ]);
  const tasks = allTasks.filter((t) => t.requestId === requestId);

  return (
    <DsrRecordMotion runKey={requestId} className="flex flex-col gap-8">
      <header data-rise className="animate-rise-in flex flex-col gap-2">
        <Link
          href={dsrHref(org)}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Direitos do Titular
        </Link>
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Solicitação do titular
        </p>
        <h1 className="font-mono text-2xl text-balance">{record.fileRef}</h1>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          A plataforma não guarda a identidade do titular. Os documentos de
          identificação permanecem no processo físico ou no GED do hospital, sob a
          referência acima.
        </p>
      </header>

      <DsrOutcomeRecord record={record} />

      <DsrAdjudicationPanel org={org} record={record} meetings={meetings} />

      <section data-rise className="animate-rise-in">
        <DsrTaskInbox org={org} tasks={tasks} />
      </section>
    </DsrRecordMotion>
  );
}

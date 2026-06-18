"use client";

import Link from "next/link";
import { AlertTriangle, Check, ChevronRight, Loader2, RefreshCw } from "lucide-react";

import type { Rca } from "@/lib/safety/rca-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RcaStatusChip } from "./rca-badges";
import type { SaveState } from "../triage/triage-topbar";
import { formatDate } from "../format";

/**
 * The RCA workspace HEADER (README_rca §3, reconciled to the NSP/event context):
 * breadcrumb (NSP › evento › RCA), the autosave pill, the RCA eyebrow + status chip
 * + Sentinel chip, the serif title (the event), a meta row, the progress readout,
 * and the lifecycle actions (Submit / Complete / Reopen) gated by status + write.
 */
export function RcaHeader({
  rca,
  eventTitle,
  commissionName,
  stagesDone,
  saveState,
  canEdit,
  isBusy,
  onSubmit,
  onComplete,
  onReopen,
}: {
  rca: Rca;
  eventTitle: string;
  commissionName: string | null;
  stagesDone: number;
  saveState: SaveState;
  canEdit: boolean;
  isBusy: boolean;
  onSubmit: () => void;
  onComplete: () => void;
  onReopen: () => void;
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Trilha"
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <Link
            href="/admin/nsp"
            className="rounded transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            NSP
          </Link>
          <ChevronRight aria-hidden="true" className="size-3.5" />
          <Link
            href={`/admin/nsp/${rca.eventId}`}
            className="rounded font-mono text-xs transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            {rca.eventCode ?? "Evento"}
          </Link>
          <ChevronRight aria-hidden="true" className="size-3.5" />
          <span className="text-foreground">RCA</span>
        </nav>

        <div className="flex items-center gap-2">
          <SavePill state={saveState} />
          {canEdit && rca.status === "in_progress" && (
            <Button type="button" onClick={onSubmit} disabled={isBusy}>
              Enviar para revisão
            </Button>
          )}
          {canEdit && rca.status === "in_review" && (
            <Button type="button" onClick={onComplete} disabled={isBusy}>
              <Check aria-hidden="true" />
              Concluir análise
            </Button>
          )}
          {rca.viewerCanWrite && rca.status === "completed" && (
            <Button type="button" variant="outline" onClick={onReopen} disabled={isBusy}>
              <RefreshCw aria-hidden="true" />
              Reabrir análise
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.16em] text-primary uppercase">
            <RefreshCw aria-hidden="true" className="size-3.5" />
            Análise de causa raiz
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <RcaStatusChip status={rca.status} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
              <AlertTriangle aria-hidden="true" className="size-3.5" />
              Evento sentinela
            </span>
          </div>
          <h1 className="text-2xl text-balance">{eventTitle}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground tabular-nums">
            <span className="font-mono text-xs">{rca.eventCode ?? "Evento"}</span>
            {commissionName && <span>· {commissionName}</span>}
            {rca.dueDate && <span>· Prazo {formatDate(rca.dueDate)}</span>}
          </p>
        </div>

        <ProgressReadout stagesDone={stagesDone} />
      </div>
    </header>
  );
}

function ProgressReadout({ stagesDone }: { stagesDone: number }) {
  // Stage 4 (PDCA) is Phase 14d — the reachable ceiling here is 3 of 4.
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-end">
        <span className="text-sm font-semibold tabular-nums">
          {stagesDone}/4 etapas
        </span>
        <span className="text-xs text-muted-foreground">Etapa 4 na Fase 14d</span>
      </div>
      <div className="flex items-end gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "w-1.5 rounded-full",
              i < stagesDone
                ? "h-6 bg-success"
                : i === 3
                  ? "h-4 bg-border"
                  : "h-4 bg-border",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function SavePill({ state }: { state: SaveState }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex min-w-20 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        state === "saved"
          ? "border-success/30 bg-success/12 text-success"
          : state === "saving"
            ? "border-border bg-muted text-muted-foreground"
            : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {state === "saving" ? (
        <>
          <Loader2 aria-hidden="true" className="size-3 animate-spin" />
          Salvando…
        </>
      ) : state === "saved" ? (
        <>
          <Check aria-hidden="true" className="size-3" />
          Salvo
        </>
      ) : (
        "Rascunho"
      )}
    </span>
  );
}

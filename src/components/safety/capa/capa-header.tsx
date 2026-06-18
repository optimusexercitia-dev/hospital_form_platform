"use client";

import Link from "next/link";
import { ChevronRight, RefreshCw } from "lucide-react";

import type { CapaPlan } from "@/lib/safety/capa-types";
import { cancelCapaPlan, reopenCapaPlan } from "@/lib/safety/capa-actions";
import { Button } from "@/components/ui/button";
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
import { useSafetyAction } from "../use-safety-action";
import { formatDate } from "../format";
import {
  CapaClassificationChip,
  CapaSourceBadge,
  CapaStatusChip,
} from "./capa-badges";

/**
 * The CAPA workspace header: breadcrumb (NSP › evento › CAPA), the code (mono),
 * classification + status chips + source badge, and the lifecycle actions
 * (Reabrir — which warns it revokes the effectiveness verdict — and Cancelar).
 */
export function CapaHeader({ plan }: { plan: CapaPlan }) {
  const isClosed = plan.status === "concluido";
  const isTerminal = isClosed || plan.status === "cancelado";

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
          {plan.eventId && (
            <>
              <ChevronRight aria-hidden="true" className="size-3.5" />
              <Link
                href={`/admin/nsp/${plan.eventId}`}
                className="rounded font-mono text-xs transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                {plan.eventCode ?? "Evento"}
              </Link>
            </>
          )}
          <ChevronRight aria-hidden="true" className="size-3.5" />
          <span className="text-foreground">CAPA</span>
        </nav>

        {plan.viewerCanManage && (
          <div className="flex items-center gap-2">
            {isClosed && <ReopenButton capaId={plan.id} />}
            {!isTerminal && <CancelButton capaId={plan.id} />}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs text-muted-foreground">{plan.code}</span>
        <h1 className="text-2xl text-balance">Plano de ação corretivo</h1>
        <div className="flex flex-wrap items-center gap-2">
          <CapaStatusChip status={plan.status} />
          <CapaClassificationChip classification={plan.classification} />
          <CapaSourceBadge source={plan.source} />
          <span className="text-xs text-muted-foreground tabular-nums">
            Aberto em {formatDate(plan.openedAt)}
          </span>
        </div>
      </div>
    </header>
  );
}

function ReopenButton({ capaId }: { capaId: string }) {
  const { run, isPending, error } = useSafetyAction();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" disabled={isPending}>
          <RefreshCw aria-hidden="true" />
          Reabrir
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reabrir este plano?</AlertDialogTitle>
          <AlertDialogDescription>
            Reabrir o plano revoga a verificação de eficácia registrada — será
            necessário registrá-la novamente antes de concluir.
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
            onClick={() => run(() => reopenCapaPlan(capaId))}
          >
            Reabrir plano
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CancelButton({ capaId }: { capaId: string }) {
  const { run, isPending, error } = useSafetyAction();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          className="text-muted-foreground hover:text-foreground"
        >
          Cancelar plano
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar este plano?</AlertDialogTitle>
          <AlertDialogDescription>
            O plano será encerrado como cancelado. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => run(() => cancelCapaPlan(capaId))}
          >
            Cancelar plano
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

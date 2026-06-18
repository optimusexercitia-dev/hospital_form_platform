"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  RCA_STAGE_META,
  RCA_STAGE_ORDER,
  type RcaStageId,
} from "./rca-derive";

/**
 * The sticky-bottom RCA footer nav (README_rca §3): ‹ Voltar (disabled on stage 1),
 * "Etapa N de 4 · {label}", and Continuar › (becomes the conclude affordance on the
 * last reachable stage). Mirrors the stepper's free navigation.
 */
export function RcaFooterNav({
  active,
  onNavigate,
}: {
  active: RcaStageId;
  onNavigate: (stage: RcaStageId) => void;
}) {
  const index = RCA_STAGE_ORDER.indexOf(active);
  const prev = index > 0 ? RCA_STAGE_ORDER[index - 1] : null;
  const next = index < RCA_STAGE_ORDER.length - 1 ? RCA_STAGE_ORDER[index + 1] : null;

  return (
    <div className="sticky bottom-0 z-10 mt-2 flex items-center justify-between gap-3 border-t border-border bg-background/85 py-3 backdrop-blur-md">
      <Button
        type="button"
        variant="outline"
        disabled={!prev}
        onClick={() => prev && onNavigate(prev)}
      >
        <ChevronLeft aria-hidden="true" />
        Voltar
      </Button>

      <span className="text-sm text-muted-foreground tabular-nums">
        Etapa {index + 1} de {RCA_STAGE_ORDER.length} · {RCA_STAGE_META[active].label}
      </span>

      <Button
        type="button"
        disabled={!next}
        onClick={() => next && onNavigate(next)}
      >
        Continuar
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}

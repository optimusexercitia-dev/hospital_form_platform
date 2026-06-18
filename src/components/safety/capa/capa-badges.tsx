import {
  CircleCheck,
  CircleDot,
  CircleSlash,
  Layers,
  ShieldCheck,
  Signal,
  SignalHigh,
  SignalLow,
  type LucideIcon,
} from "lucide-react";

import {
  CAPA_ACTION_STATUS_LABELS,
  CAPA_ACTION_STRENGTH_LABELS,
  CAPA_CLASSIFICATION_LABELS,
  CAPA_EFFECTIVENESS_VERDICT_LABELS,
  CAPA_SOURCE_LABELS,
  CAPA_STATUS_LABELS,
  type CapaActionStatus,
  type CapaActionStrength,
  type CapaClassification,
  type CapaEffectivenessVerdict,
  type CapaSource,
  type CapaStatus,
} from "@/lib/safety/capa-types";
import { cn } from "@/lib/utils";
import {
  ACTION_STATUS_CHIP,
  CHIP,
  CLASSIFICATION_CHIP,
  STATUS_CHIP,
  STRENGTH_CHIP,
  VERDICT_CHIP,
} from "./capa-visuals";

/** Plan classification chip. */
export function CapaClassificationChip({
  classification,
}: {
  classification: CapaClassification;
}) {
  return (
    <span className={cn(CHIP, CLASSIFICATION_CHIP[classification])}>
      <Layers aria-hidden="true" className="size-3.5" />
      {CAPA_CLASSIFICATION_LABELS[classification]}
    </span>
  );
}

const STATUS_ICON: Record<CapaStatus, LucideIcon> = {
  aberto: CircleDot,
  em_execucao: CircleDot,
  em_verificacao: CircleDot,
  concluido: CircleCheck,
  cancelado: CircleSlash,
};

/** Plan status chip. */
export function CapaStatusChip({ status }: { status: CapaStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={cn(CHIP, STATUS_CHIP[status])}>
      <Icon aria-hidden="true" className="size-3.5" />
      {CAPA_STATUS_LABELS[status]}
    </span>
  );
}

const STRENGTH_ICON: Record<CapaActionStrength, LucideIcon> = {
  forte: SignalHigh,
  intermediaria: Signal,
  fraca: SignalLow,
};

/** Action-strength pill (JC hierarchy: forte / intermediária / fraca). */
export function CapaStrengthPill({ strength }: { strength: CapaActionStrength }) {
  const Icon = STRENGTH_ICON[strength];
  return (
    <span className={cn(CHIP, STRENGTH_CHIP[strength])}>
      <Icon aria-hidden="true" className="size-3.5" />
      {CAPA_ACTION_STRENGTH_LABELS[strength]}
    </span>
  );
}

/** Action status chip. */
export function CapaActionStatusChip({ status }: { status: CapaActionStatus }) {
  return (
    <span className={cn(CHIP, ACTION_STATUS_CHIP[status])}>
      {CAPA_ACTION_STATUS_LABELS[status]}
    </span>
  );
}

/** Effectiveness verdict chip. */
export function CapaVerdictChip({
  verdict,
}: {
  verdict: CapaEffectivenessVerdict;
}) {
  return (
    <span className={cn(CHIP, VERDICT_CHIP[verdict])}>
      <ShieldCheck aria-hidden="true" className="size-3.5" />
      {CAPA_EFFECTIVENESS_VERDICT_LABELS[verdict]}
    </span>
  );
}

/** Source badge (neutral). */
export function CapaSourceBadge({ source }: { source: CapaSource }) {
  return (
    <span className={cn(CHIP, "border-border bg-muted text-muted-foreground")}>
      {CAPA_SOURCE_LABELS[source]}
    </span>
  );
}

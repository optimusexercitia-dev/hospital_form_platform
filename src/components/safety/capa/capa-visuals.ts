/**
 * Visual-token mapping for the CAPA workspace (Phase 14d). PURE + client-safe: maps
 * each spec role (README_rca §1.3 / §7.1) to an EXISTING project token — no
 * hard-coded colors/radii/fonts. PDCA `Do` = accent per the spec; the other cells,
 * the classifications, strengths, statuses, and verdicts each resolve to a distinct
 * existing hue. Status is always conveyed by icon + text + shape too.
 */

import type {
  CapaActionStatus,
  CapaActionStrength,
  CapaClassification,
  CapaEffectivenessVerdict,
  CapaStatus,
} from "@/lib/safety/capa-types";
import type { PdcaStageId } from "./capa-derive";

/** PDCA cell stroke/text token (the engaged colour; todo is muted via opacity). */
export const PDCA_TONE: Record<
  PdcaStageId,
  { stroke: string; text: string }
> = {
  // Plan = role B (chart-2)
  plan: { stroke: "var(--chart-2)", text: "text-[var(--chart-2)]" },
  // Do = accent (per spec)
  do: { stroke: "var(--primary)", text: "text-primary" },
  // Check = warning / amber
  check: { stroke: "var(--warning)", text: "text-warning" },
  // Act = success / green
  act: { stroke: "var(--success)", text: "text-success" },
};

const CHIP_BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium";

export const CHIP = CHIP_BASE;

/** Plan classification chip classes. */
export const CLASSIFICATION_CHIP: Record<CapaClassification, string> = {
  corretiva: "border-primary/30 bg-primary/10 text-primary",
  preventiva: "border-[var(--chart-3)]/30 bg-[var(--chart-3)]/12 text-foreground",
  melhoria: "border-success/30 bg-success/12 text-success",
};

/** Plan status chip classes. */
export const STATUS_CHIP: Record<CapaStatus, string> = {
  aberto: "border-border bg-muted text-muted-foreground",
  em_execucao: "border-primary/30 bg-primary/10 text-primary",
  em_verificacao: "border-warning/30 bg-warning/12 text-warning",
  concluido: "border-success/30 bg-success/12 text-success",
  cancelado: "border-border bg-muted text-muted-foreground",
};

/**
 * Action-strength chip classes — a reliability ramp (JC hierarchy): forte = success,
 * intermediária = warning, fraca = muted. Paired with the label + icon, never colour
 * alone.
 */
export const STRENGTH_CHIP: Record<CapaActionStrength, string> = {
  forte: "border-success/30 bg-success/12 text-success",
  intermediaria: "border-warning/30 bg-warning/12 text-warning",
  fraca: "border-border bg-muted text-muted-foreground",
};

/** Action status chip classes. */
export const ACTION_STATUS_CHIP: Record<CapaActionStatus, string> = {
  pendente: "border-border bg-muted text-muted-foreground",
  em_andamento: "border-primary/30 bg-primary/10 text-primary",
  concluida: "border-success/30 bg-success/12 text-success",
  cancelada: "border-border bg-muted text-muted-foreground line-through",
};

/** Effectiveness verdict chip classes. */
export const VERDICT_CHIP: Record<CapaEffectivenessVerdict, string> = {
  eficaz: "border-success/30 bg-success/12 text-success",
  parcial: "border-warning/30 bg-warning/12 text-warning",
  ineficaz: "border-destructive/30 bg-destructive/10 text-destructive",
};

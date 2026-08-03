import { cn } from "@/lib/utils";
import {
  ASSESSMENT_STATUS_LABELS,
  EVIDENCE_STATUS_LABELS,
  FRAMEWORK_STATUS_LABELS,
  STANDARD_LEVEL_LABELS,
  type AssessmentStatus,
  type EvidenceStatus,
  type FrameworkStatus,
  type StandardLevel,
} from "@/lib/accreditation/types";

/**
 * Standards Crosswalk & Readiness/Gap Engine v2 (Phase 16) — shared status
 * chip primitives, reused by the standards tree, the standard panel, and
 * (Wave 3) the readiness dashboard. Pure presentational, Server-Component-safe.
 * Mirrors `src/components/cases/case-status-badge.tsx`'s pill shape/tokens —
 * status is conveyed by icon-free text + a distinct fill token, never colour
 * alone (frontend-design skill §6).
 */

const CHIP_BASE =
  "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase";

const ASSESSMENT_STYLES: Record<AssessmentStatus, string> = {
  conforme: "bg-success/12 text-success",
  parcial: "bg-warning/15 text-warning",
  nao_conforme: "bg-destructive/10 text-destructive",
  nao_aplicavel: "bg-muted text-muted-foreground",
};

/** `status: null` renders "Não avaliado" — distinct from `nao_aplicavel` (a legitimate terminal state). */
export function AssessmentStatusChip({
  status,
  className,
}: {
  status: AssessmentStatus | null;
  className?: string;
}) {
  const label = status ? ASSESSMENT_STATUS_LABELS[status] : "Não avaliado";
  const style = status ? ASSESSMENT_STYLES[status] : "bg-muted text-muted-foreground";
  return <span className={cn(CHIP_BASE, style, className)}>{label}</span>;
}

const EVIDENCE_STYLES: Record<EvidenceStatus, string> = {
  valida: "bg-success/12 text-success",
  atencao: "bg-warning/15 text-warning",
  vencida: "bg-destructive/10 text-destructive",
};

export function EvidenceStatusChip({
  status,
  className,
}: {
  status: EvidenceStatus;
  className?: string;
}) {
  return (
    <span className={cn(CHIP_BASE, EVIDENCE_STYLES[status], className)}>
      {EVIDENCE_STATUS_LABELS[status]}
    </span>
  );
}

/** ONA level badge ("Nível 1 · Segurança"). Only rendered for leveled standards. */
export function LevelBadge({ level, className }: { level: StandardLevel; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-border bg-card px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase",
        className,
      )}
    >
      Nível {level} · {STANDARD_LEVEL_LABELS[level]}
    </span>
  );
}

const FRAMEWORK_STYLES: Record<FrameworkStatus, string> = {
  ativo: "bg-success/12 text-success",
  arquivado: "bg-muted text-muted-foreground",
};

export function FrameworkStatusChip({
  status,
  className,
}: {
  status: FrameworkStatus;
  className?: string;
}) {
  return (
    <span className={cn(CHIP_BASE, FRAMEWORK_STYLES[status], className)}>
      {FRAMEWORK_STATUS_LABELS[status]}
    </span>
  );
}

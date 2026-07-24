import type {
  CorrectionKind,
  CorrectionStatus,
} from "@/lib/queries/corrections";
import {
  CORRECTION_KIND_META,
  CORRECTION_STATUS_META,
} from "@/components/cases/correction-labels";
import { cn } from "@/lib/utils";

/**
 * Small presentational chips for the Case Correction Lifecycle (ADR 0085), shared by
 * the request panel, the phase article and the narrative card. Each conveys state by
 * ICON + TEXT + SHAPE (never colour alone — a11y). Pure, Server-Component-safe.
 */

const CHIP_CLASS =
  "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase";

/** The workflow-state chip (Solicitada / Em edição / … / Aprovada). */
export function CorrectionStatusChip({
  status,
  className,
}: {
  status: CorrectionStatus;
  className?: string;
}) {
  const meta = CORRECTION_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={cn(CHIP_CLASS, meta.className, className)}>
      <Icon aria-hidden="true" className="size-3" />
      {meta.label}
    </span>
  );
}

/** The kind chip (Correção / Adendo / Anulação). */
export function CorrectionKindChip({
  kind,
  className,
}: {
  kind: CorrectionKind;
  className?: string;
}) {
  const meta = CORRECTION_KIND_META[kind];
  const Icon = meta.icon;
  return (
    <span className={cn(CHIP_CLASS, meta.className, className)}>
      <Icon aria-hidden="true" className="size-3" />
      {meta.label}
    </span>
  );
}

/**
 * The "Aprovada pelo próprio corretor" badge — self-approval is permitted but must
 * be VISIBLY recorded (ADR 0085 decision 5). Rendered only on an approved request
 * whose `self_approved` is true.
 */
export function SelfApprovedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-warning/30 bg-warning/12 px-2 py-0.5 text-[0.7rem] font-medium text-warning",
        className,
      )}
      title="A mesma pessoa solicitou e aprovou esta correção."
    >
      Aprovada pelo próprio corretor
    </span>
  );
}

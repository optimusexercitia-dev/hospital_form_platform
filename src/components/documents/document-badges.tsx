import { AlertTriangle, Clock, EyeOff, ShieldAlert, Tag, Trash2 } from "lucide-react";

import type {
  DocumentAvailability,
  DocumentConfidentialityLevel,
} from "@/lib/documents/types";
import { cn } from "@/lib/utils";
import {
  AVAILABILITY_PRESENTATION,
  CONFIDENTIALITY_HELPER_TEXT,
  CONFIDENTIALITY_LABEL,
  CONFIDENTIALITY_STYLE,
  DOCUMENT_NO_VERSION,
} from "./document-labels";

/**
 * Wave-A document badges (DM2·S3). Pure presentational Server Components — no
 * state, no interactivity, so none of them is a client island.
 *
 * Every badge carries icon + text + tone, never tone alone (design system §2 and
 * CLAUDE.md §8: status is never conveyed by colour alone), and every explanatory
 * sentence is available to a screen reader rather than living only in a `title`
 * tooltip.
 */

const PILL_BASE =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase";

const AVAILABILITY_ICON = {
  clock: Clock,
  "alert-triangle": AlertTriangle,
  "eye-off": EyeOff,
  trash: Trash2,
} as const;

/**
 * The availability badge. Renders NOTHING for `available` — a servable document
 * needs no badge, the enabled download control is the signal, and badging every
 * healthy row is noise.
 *
 * `failed` and `disposed` differ here on icon and tone; they differ further on
 * copy and on affordance set at the row level. Four axes, deliberately: "my
 * upload broke" and "this was destroyed on purpose" must never read alike.
 */
export function DocumentAvailabilityBadge({
  availability,
  className,
}: {
  availability: DocumentAvailability;
  className?: string;
}) {
  if (availability === "available") return null;
  const preset = AVAILABILITY_PRESENTATION[availability];
  const Icon = AVAILABILITY_ICON[preset.icon];
  return (
    <span className={cn(PILL_BASE, preset.style, className)}>
      <Icon aria-hidden="true" className="size-3" />
      {preset.label}
    </span>
  );
}

/** A document row that has no version yet (contract permits `latestVersion: null`). */
export function DocumentNoVersionBadge({ className }: { className?: string }) {
  return (
    <span className={cn(PILL_BASE, DOCUMENT_NO_VERSION.style, className)}>
      <Clock aria-hidden="true" className="size-3" />
      {DOCUMENT_NO_VERSION.label}
    </span>
  );
}

/**
 * The confidentiality tag (ADR 0072 taxonomy). Most levels are informational;
 * the two ENFORCING levels render in the elevated `warning` tier via
 * `CONFIDENTIALITY_STYLE`. The clearance clarification is both a native tooltip
 * and screen-reader text, so meaning never rests on colour.
 */
export function DocumentConfidentialityBadge({
  level,
  className,
}: {
  level: DocumentConfidentialityLevel;
  className?: string;
}) {
  return (
    <span
      className={cn(PILL_BASE, CONFIDENTIALITY_STYLE[level], className)}
      title={CONFIDENTIALITY_HELPER_TEXT}
    >
      <Tag aria-hidden="true" className="size-3" />
      {CONFIDENTIALITY_LABEL[level]}
      <span className="sr-only"> — {CONFIDENTIALITY_HELPER_TEXT}</span>
    </span>
  );
}

/**
 * The PHI-tier marker. A projection of `file_objects.sensitivity_tier` (D8) —
 * it says the BYTES are patient data, which is exactly the D12 distinction the
 * upload dialog teaches: the file may carry patient data, the title may not.
 */
export function DocumentPhiBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(PILL_BASE, "bg-accent text-accent-foreground", className)}
    >
      <ShieldAlert aria-hidden="true" className="size-3" />
      Dados de paciente
      <span className="sr-only">
        {" "}
        — o arquivo contém dados de paciente e é aberto por um canal auditado.
      </span>
    </span>
  );
}

/** The document `kind` chip (pt-BR label resolved per home). */
export function DocumentKindBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(PILL_BASE, "bg-secondary text-secondary-foreground", className)}
    >
      {label}
    </span>
  );
}

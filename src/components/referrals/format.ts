/**
 * Shared display helpers for the inter-committee referrals UI (Phase 22 —
 * `case_referrals`; ADR 0037). Pure + client/server-safe: only string
 * formatting and token-name lookups (no data access — that goes through
 * `@/lib/queries/referrals`, Rule 9). All user-facing text is pt-BR (Rule 10);
 * the storage slugs map to labels via the frozen `*_LABELS` maps in the contract
 * (`@/lib/referrals/types`).
 *
 * Mirrors the Phase-14 safety convention (`src/components/safety/format.ts`).
 */

/** "ENC-0001" is already minted server-side; this just guards the empty case. */
export function formatReferralCode(code: string | null | undefined): string {
  return code?.trim() || "Encaminhamento";
}

/** Format a case number as the platform mono code ("Caso 0042"). `null` → "—". */
export function formatCaseNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return `Caso ${String(n).padStart(4, "0")}`;
}

/** Format an ISO timestamp as a pt-BR short date (date only). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Format an ISO timestamp as a pt-BR date + time ("18/06/2026, 14:30"). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Format a byte size as a compact pt-BR string ("1,2 MB"); `null` → "". */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1).replace(".", ",")} ${units[unitIndex]}`;
}

/**
 * Semantic token classes for a referral-status chip (icon + text + shape, never
 * colour alone — design system §2 accessibility). The status → token name map
 * lives in the contract ({@link import('@/lib/referrals/types').REFERRAL_STATUS_TOKENS});
 * this resolves that loose token NAME into the concrete chip classes, keeping the
 * "Clinical Calm" palette centralized:
 *  - `muted`       → inert (rascunho / retirada)
 *  - `info`        → in motion, no NSP attention yet (enviada / recebida)
 *  - `accent`      → accepted (active target work)
 *  - `warning`     → under analysis (the close-case blocker tone)
 *  - `success`     → concluded
 *  - `destructive` → declined
 */
export function referralStatusChipClass(token: string): string {
  switch (token) {
    case "info":
      return "bg-primary/10 text-primary border-primary/30";
    case "accent":
      return "bg-accent text-accent-foreground border-primary/30";
    case "warning":
      return "bg-warning/12 text-warning border-warning/30";
    case "success":
      return "bg-success/12 text-success border-success/30";
    case "destructive":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "muted":
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

/** Resolve a referral-type / outcome `color_token` to soft chip classes (or a
 * calm neutral default when the vocab row carries no token). Type/outcome chips
 * are quieter than the status chip (they're metadata, not state). */
export function referralTypeChipClass(token: string | null | undefined): string {
  switch (token) {
    case "info":
      return "bg-primary/8 text-primary/90 border-primary/20";
    case "accent":
      return "bg-accent/60 text-accent-foreground border-primary/20";
    case "warning":
      return "bg-warning/10 text-warning border-warning/25";
    case "success":
      return "bg-success/10 text-success border-success/25";
    case "destructive":
      return "bg-destructive/8 text-destructive border-destructive/25";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

/** Icon-free chip used for the type/outcome labels (pure metadata pills). */
export const REFERRAL_META_CHIP_BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium";

import { cn } from "@/lib/utils";

import {
  CASE_STATUS_META,
  type CaseStatus,
  type CaseStatusColorToken,
} from "@/lib/cases/case-status";

/**
 * Small status pill for a case. As of the Case data-model adjustments (D12) the
 * per-commission CONFIGURABLE status vocabulary is gone — a case carries one of
 * five FIXED, auto-computed statuses ({@link CaseStatus}). This component renders
 * a badge for a fixed status key via {@link CASE_STATUS_META}, and still owns the
 * single `colorToken → CSS class` mapping (the only place a palette token becomes
 * concrete styling — never raw CSS upstream) shared by the kanban, the colour
 * picker, tags, and the outcome manager.
 *
 * Pure presentational, Server-Component-safe.
 */

/**
 * The constrained palette → Tailwind-token classes. Each token reuses the
 * semantic colour tokens already in `globals.css` (no new CSS): `muted` is the
 * guaranteed fallback. Kept here so the kanban/table and the badge agree on what
 * a token looks like. Shared across case statuses, tags and outcomes.
 */
export const TOKEN_STYLES: Record<CaseStatusColorToken, string> = {
  muted: "bg-muted text-muted-foreground",
  slate: "bg-secondary text-secondary-foreground",
  blue: "bg-accent text-accent-foreground",
  amber: "bg-warning/15 text-warning",
  green: "bg-success/12 text-success dark:bg-success/15",
  red: "bg-destructive/10 text-destructive",
  violet: "bg-[oklch(0.55_0.12_320_/_0.14)] text-[oklch(0.5_0.12_320)] dark:text-[oklch(0.72_0.12_320)]",
};

/**
 * The CSS colour VALUE for each palette token — for the kanban column dot and
 * card left-border tint (where a `background-color`/`border-color` value is
 * needed, not a class). Mirrors {@link TOKEN_STYLES}; consumes the same tokens.
 */
export const TOKEN_COLOR_VAR: Record<CaseStatusColorToken, string> = {
  muted: "var(--muted-foreground)",
  slate: "var(--st-todo)",
  blue: "var(--primary)",
  amber: "var(--warning)",
  green: "var(--success)",
  red: "var(--destructive)",
  violet: "oklch(0.55 0.12 320)",
};

/**
 * A badge for an explicit `{ label, colorToken }` pair. Used by tags and outcomes
 * (their vocabulary rows carry a label + a palette token directly).
 */
export function CaseStatusBadge({
  label,
  colorToken,
  className,
}: {
  label: string;
  colorToken: CaseStatusColorToken;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase",
        TOKEN_STYLES[colorToken] ?? TOKEN_STYLES.muted,
        className,
      )}
    >
      {label}
    </span>
  );
}

/**
 * Render the badge for a FIXED case status — the common call site (board / table
 * / detail header). Resolves the pt-BR label + palette token from
 * {@link CASE_STATUS_META}; the fixed union is exhaustive so there is no unknown
 * key to fall back on.
 */
export function CaseStatusBadgeFixed({
  status,
  className,
}: {
  status: CaseStatus;
  className?: string;
}) {
  const meta = CASE_STATUS_META[status];
  return (
    <CaseStatusBadge
      label={meta.label}
      colorToken={meta.colorToken}
      className={className}
    />
  );
}

import { cn } from "@/lib/utils";

import type {
  CaseStatusColorToken,
  CaseStatusDef,
} from "@/lib/queries/case-statuses";
import type { CaseStatusKey } from "@/lib/queries/cases";

/**
 * Small status pill for a case, DATA-DRIVEN against the per-commission
 * `case_status_defs` (Cases-Extras R2). The hard-coded 3-state map is gone: the
 * caller passes the resolved {@link CaseStatusDef} (label + colour token), and
 * THIS component owns the single `colorToken → CSS class` mapping (the only place
 * a palette token becomes concrete styling — never raw CSS upstream).
 *
 * Resilience (R2 risk #3 — relaxing `CaseStatusKey` removes compile-time
 * exhaustiveness): {@link resolveStatusDef} guarantees a render for ANY key. An
 * orphaned/archived key absent from `defs` falls back to a `muted` pill labelled
 * with the raw key, so a never-styled status never blows up the UI. Pure
 * presentational, Server-Component-safe.
 */

/**
 * The constrained palette → Tailwind-token classes. Each token reuses the
 * semantic colour tokens already in `globals.css` (no new CSS): `muted` is the
 * guaranteed fallback. Kept here so the kanban/table and the badge agree on what
 * a token looks like.
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
 * Resolve a status `key` to a renderable `{ label, colorToken }` against the
 * loaded defs, with a guaranteed fallback for an unknown key (the muted pill
 * labelled with the key itself). The single source of "how do I display this
 * status" used by the badge, kanban, table and pickers.
 */
export function resolveStatusDef(
  defs: CaseStatusDef[],
  key: CaseStatusKey,
): { label: string; colorToken: CaseStatusColorToken } {
  const def = defs.find((d) => d.key === key);
  if (def) return { label: def.label, colorToken: def.colorToken };
  return { label: key, colorToken: "muted" };
}

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
 * Convenience: render a badge straight from a status key + the loaded defs (the
 * common call site). Resolves through {@link resolveStatusDef} so an unknown key
 * still renders.
 */
export function CaseStatusBadgeForKey({
  defs,
  statusKey,
  className,
}: {
  defs: CaseStatusDef[];
  statusKey: CaseStatusKey;
  className?: string;
}) {
  const { label, colorToken } = resolveStatusDef(defs, statusKey);
  return (
    <CaseStatusBadge label={label} colorToken={colorToken} className={className} />
  );
}

import { cn } from "@/lib/utils";

/**
 * Lifecycle status of a form version — mirrors the DB enum
 * `form_versions.status` (draft | published | archived). Declared locally as a
 * pure string-literal union (not a domain type) so this presentational pill has
 * no backend coupling; callers pass the status string straight through from the
 * generated row type.
 */
export type FormVersionStatus = "draft" | "published" | "archived";

const STATUS_LABEL: Record<FormVersionStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

const STATUS_STYLES: Record<FormVersionStatus, string> = {
  // Published gets the petrol accent fill (the "live" state); a draft reads as
  // a warm in-progress amber; archived is muted/neutral. Matches the pill
  // language already used across the shell (RoleBadge, "em breve" tags).
  published: "bg-accent text-accent-foreground",
  draft: "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200",
  archived: "bg-muted text-muted-foreground",
};

/**
 * Small status pill for a form version (Rascunho / Publicado / Arquivado).
 * Pure presentational and Server-Component-safe; reused by the form list, the
 * builder header, and the version-history view.
 */
export function StatusBadge({
  status,
  className,
}: {
  status: FormVersionStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium tracking-wide uppercase",
        STATUS_STYLES[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

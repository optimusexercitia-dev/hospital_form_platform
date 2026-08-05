import { cn } from "@/lib/utils";

import type { TemplateVersionStatus } from "@/lib/queries/process-templates";

/**
 * Small status pill for one process-template VERSION (ADR 0096): Rascunho /
 * Publicada / Arquivada.
 *
 * The lifecycle is now literally `form_versions`' — ADR 0096 retired the old
 * template-level `draft → active → archived` in favour of
 * `draft → published → archived` — so `published` inherits the petrol accent that
 * `active` used to carry, `draft` reads as a warm in-progress amber, and
 * `archived` stays muted.
 *
 * The labels are FEMININE ("Publicada", not "Publicado") because the subject is a
 * *versão*, not a *processo*: this badge only ever renders beside a version number.
 *
 * Pure presentational, Server-Component-safe; the union is imported from the query
 * layer so it can't drift. Replaced the identity-grain `TemplateStatusBadge`, which
 * was deleted with the rest of the pre-versioning surface.
 */
const STATUS_LABEL: Record<TemplateVersionStatus, string> = {
  draft: "Rascunho",
  published: "Publicada",
  archived: "Arquivada",
};

const STATUS_STYLES: Record<TemplateVersionStatus, string> = {
  published: "bg-accent text-accent-foreground",
  draft: "bg-warning/15 text-warning",
  archived: "bg-muted text-muted-foreground",
};

export function TemplateVersionStatusBadge({
  status,
  className,
}: {
  status: TemplateVersionStatus;
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

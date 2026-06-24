import { commissionHref } from "@/lib/routing";
import Link from "next/link";
import { ArrowUpRight, Layers, PencilLine } from "lucide-react";

import type { ProcessTemplate } from "@/lib/queries/process-templates";
import { TemplateStatusBadge } from "@/components/process-templates/template-status-badge";

/**
 * One process template in the per-commission list. Shows the title/description,
 * lifecycle status, and phase count, and links into the builder. Mirrors
 * {@link FormCard}: the whole card is the link, with a staggered rise-in entrance
 * and a hover lift. Pure presentational + Server-Component-safe; `ProcessTemplate`
 * is imported from the query layer so the shape can't drift.
 */
export function ProcessTemplateCard({
  template,
  org,
  slug,
  index = 0,
}: {
  template: ProcessTemplate;
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  index?: number;
}) {
  const href = commissionHref(org, slug, "manage", "process-templates", template.id);
  const phaseCount = template.phases.length;
  const action = template.status === "draft" ? "Continuar edição" : "Ver processo";

  return (
    <Link
      href={href}
      style={{ ["--rise-delay" as string]: `${index * 50}ms` }}
      className="animate-rise-in group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate text-base font-semibold">{template.title}</h2>
          {template.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground text-pretty">
              {template.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground/70 italic">
              Sem descrição
            </p>
          )}
        </div>
        <ArrowUpRight
          className="size-5 shrink-0 text-muted-foreground transition-[color,transform] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
          aria-hidden="true"
        />
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <TemplateStatusBadge status={template.status} />
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Layers aria-hidden="true" className="size-3.5" />
          {phaseCount === 1 ? "1 fase" : `${phaseCount} fases`}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
        <PencilLine aria-hidden="true" className="size-4" />
        {action}
      </div>
    </Link>
  );
}

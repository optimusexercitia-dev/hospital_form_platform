import { commissionHref } from "@/lib/routing";
import Link from "next/link";
import { ArrowUpRight, Layers, PencilLine } from "lucide-react";

import type { ProcessTemplateWithVersion } from "@/lib/queries/process-templates";
import { TemplateVersionStatusBadge } from "@/components/process-templates/template-version-status-badge";

/**
 * One process template in the per-commission list. Shows the title/description,
 * lifecycle status, and phase count, and links into the builder. Mirrors
 * {@link FormCard}: the whole card is the link, with a staggered rise-in entrance
 * and a hover lift. Pure presentational + Server-Component-safe.
 *
 * ## Which version does a card show? (ADR 0096)
 *
 * `listProcessTemplateVersions` resolves each template to the version a LIST should
 * show — the published one if there is any, else the newest. So a card describes
 * the process **as it is in force**, which is what a list of processes is asking
 * about. Title and description come from that version (D1 put them there), not from
 * the identity, so a card can legitimately differ from a draft in progress.
 *
 * The version NUMBER is surfaced deliberately: two cards reading "Revisão de óbito"
 * are not ambiguous once one says `v3`, and it is the fastest way to notice that a
 * process has been revised.
 */
export function ProcessTemplateCard({
  data,
  org,
  slug,
  index = 0,
}: {
  data: ProcessTemplateWithVersion;
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  index?: number;
}) {
  const { template, version, draftVersionId } = data;
  const href = commissionHref(
    org,
    slug,
    "manage",
    "process-templates",
    template.id,
  );
  const phaseCount = version.phases.length;

  // An open draft is the actionable state, so it wins the call-to-action even when
  // the card is describing the published version alongside it.
  const hasOpenDraft = draftVersionId !== null;
  const action = hasOpenDraft ? "Continuar rascunho" : "Ver processo";

  return (
    <Link
      href={href}
      style={{ ["--rise-delay" as string]: `${index * 50}ms` }}
      className="animate-rise-in group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate text-base font-semibold">{version.title}</h2>
          {version.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground text-pretty">
              {version.description}
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
        <span className="font-mono text-xs text-muted-foreground">
          v{version.versionNumber}
        </span>
        <TemplateVersionStatusBadge status={version.status} />
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

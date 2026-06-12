import Link from "next/link";
import { ArrowUpRight, FileText, PencilLine } from "lucide-react";

import type { FormListItem } from "@/lib/queries/forms";
import { StatusBadge } from "@/components/forms/status-badge";

/**
 * One form in the per-commission builder list. Shows the title/description, the
 * lifecycle state (a published-version badge and/or a "rascunho" indicator), and
 * links into the builder. The whole card is the link; the footer label reflects
 * what opening it will do:
 *   - an editable draft exists  → "Continuar edição"
 *   - else a published version  → "Editar publicado" (builder shows it read-only
 *                                  with the clone CTA — F2 refinement)
 * Pure presentational + Server-Component-safe; `FormListItem` is imported from
 * the query layer so the shape can't drift.
 */
export function FormCard({
  form,
  slug,
  index = 0,
}: {
  form: FormListItem;
  slug: string;
  index?: number;
}) {
  const href = `/c/${slug}/manage/forms/${form.id}`;
  const action = form.hasDraft ? "Continuar edição" : "Editar publicado";

  return (
    <Link
      href={href}
      style={{ ["--rise-delay" as string]: `${index * 50}ms` }}
      className="animate-rise-in group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate text-base font-semibold">{form.title}</h2>
          {form.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground text-pretty">
              {form.description}
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
        {form.publishedVersionNumber != null ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <StatusBadge status="published" />
            <span>v{form.publishedVersionNumber}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText aria-hidden="true" className="size-3.5" />
            Ainda não publicado
          </span>
        )}
        {form.hasDraft && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <StatusBadge status="draft" />
            <span className="sr-only">rascunho em edição</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
        <PencilLine aria-hidden="true" className="size-4" />
        {action}
      </div>
    </Link>
  );
}

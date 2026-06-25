"use client";

import { commissionHref } from "@/lib/routing";
import Link from "next/link";
import { ArrowRight, FileText, PlayCircle } from "lucide-react";

import type { FillableForm } from "@/lib/queries/responses";
import { Button } from "@/components/ui/button";

/**
 * One row in the staff form list (F1). PUBLISHED forms only. The primary
 * action depends on whether the current user already has an in_progress
 * response for the form's published version:
 *  - in_progress exists → "Continuar preenchimento" (deep-links to the wizard
 *    at the existing responseId);
 *  - otherwise → "Preencher" (the parent passes the start affordance via
 *    `startSlot`, which calls `startOrResumeResponse` then navigates).
 *
 * Takes B2's `FillableForm` directly so the card's shape can't drift from the
 * data layer.
 */
export function FillableFormCard({
  org,
  slug,
  form,
  index,
  startSlot,
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  form: FillableForm;
  index: number;
  /** Parent-provided "Preencher" affordance (starts a response). */
  startSlot?: React.ReactNode;
}) {
  const resuming = form.inProgressResponseId !== null;

  return (
    <article
      style={{ ["--rise-delay" as string]: `${index * 50}ms` }}
      className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/60 text-accent-foreground">
          <FileText aria-hidden="true" className="size-4.5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-semibold text-balance">{form.title}</h2>
          {form.description && (
            <p className="text-sm text-muted-foreground text-pretty">
              {form.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        {resuming ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/60 px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
            <PlayCircle aria-hidden="true" className="size-3.5" />
            Em andamento
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Versão {form.publishedVersionNumber}
          </span>
        )}

        {resuming && form.inProgressResponseId ? (
          <Button asChild size="sm">
            <Link
              href={commissionHref(org, slug, "forms", form.formId, "responder", form.inProgressResponseId)}
            >
              Continuar preenchimento
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          (startSlot ?? null)
        )}
      </div>
    </article>
  );
}

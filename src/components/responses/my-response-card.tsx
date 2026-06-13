import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock } from "lucide-react";

import type { MyResponse } from "@/lib/queries/responses";
import { Button } from "@/components/ui/button";

/**
 * One row in "minhas respostas" (F6). Shows a response's form, status, and the
 * relevant timestamp, with the matching action:
 *  - in_progress → "Continuar" (back into the wizard);
 *  - submitted → "Ver" (read-only detail — the full read-only viewer is Phase 7;
 *    for now this links to the same route, which redirects submitted responses
 *    to this history; the Phase-7 submissions viewer will replace the target).
 *
 * Status is conveyed by an icon + text label, not colour alone (a11y).
 */
export function MyResponseCard({
  slug,
  response,
  index,
}: {
  slug: string;
  response: MyResponse;
  index: number;
}) {
  const inProgress = response.status === "in_progress";
  const stamp = inProgress
    ? formatDate(response.updatedAt)
    : formatDate(response.submittedAt ?? response.updatedAt);

  return (
    <article
      style={{ ["--rise-delay" as string]: `${index * 50}ms` }}
      className="animate-rise-in flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <h2 className="truncate text-base font-semibold">{response.formTitle}</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {inProgress ? (
            <span className="inline-flex items-center gap-1 font-medium text-accent-foreground">
              <Clock aria-hidden="true" className="size-3.5" />
              Em andamento
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-primary">
              <CheckCircle2 aria-hidden="true" className="size-3.5" />
              Enviada
            </span>
          )}
          <span>
            {inProgress ? "Atualizada em " : "Enviada em "}
            {stamp}
          </span>
          <span>Versão {response.versionNumber}</span>
        </div>
      </div>

      {inProgress ? (
        <Button asChild size="sm" className="shrink-0">
          <Link
            href={`/c/${slug}/forms/${response.formId}/responder/${response.id}`}
          >
            Continuar
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link
            href={`/c/${slug}/forms/${response.formId}/responder/${response.id}`}
          >
            Ver
          </Link>
        </Button>
      )}
    </article>
  );
}

/** Format an ISO timestamp as a pt-BR short date (date only — no time noise). */
function formatDate(iso: string): string {
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

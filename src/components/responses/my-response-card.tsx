import { commissionHref } from "@/lib/routing";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Clock } from "lucide-react";

import type { MyResponse } from "@/lib/queries/responses";
import { TOKEN_STYLES } from "@/components/cases/case-status-badge";
import { cn } from "@/lib/utils";

/**
 * One row in "minhas respostas" (F6) — a divider-separated list row (mirrors the
 * Casos board's scannable rows rather than a standalone card). The WHOLE row is a
 * single link, and the target depends on status:
 *  - in_progress → back into the wizard to resume;
 *  - submitted → the respondent's read-only viewer at `respostas/[responseId]`,
 *    which is also where they print their own PDF (FUP-PDF-1). Before that route
 *    existed, submitted rows led into the wizard, which bounced them straight to
 *    its confirmation screen — a dead end.
 *
 * Status is a pill badge — icon + text, never colour alone (a11y): blue
 * ("accent") for "Em andamento", green ("success") for "Enviada". Renders an
 * `<li>`; the parent supplies the bordered `<ul>` container.
 */
export function MyResponseCard({
  org,
  slug,
  response,
  index,
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  response: MyResponse;
  index: number;
}) {
  const inProgress = response.status === "in_progress";
  const stamp = inProgress
    ? formatDate(response.updatedAt)
    : formatDate(response.submittedAt ?? response.updatedAt);
  const href = inProgress
    ? commissionHref(org, slug, "forms", response.formId, "responder", response.id)
    : commissionHref(org, slug, "respostas", response.id);

  return (
    <li
      style={{ ["--rise-delay" as string]: `${index * 40}ms` }}
      className="animate-rise-in"
    >
      <Link
        href={href}
        className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none focus-visible:ring-inset"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="truncate text-base font-semibold text-foreground">
            {response.formTitle}
          </span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <ResponseStatusBadge inProgress={inProgress} />
            <span>
              {inProgress ? "Atualizada em " : "Enviada em "}
              {stamp}
            </span>
            <span>Versão {response.versionNumber}</span>
          </div>
        </div>
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </li>
  );
}

/**
 * Submission-status pill for a response row. Reuses the shared palette
 * `TOKEN_STYLES` so "blue"/"green" resolve to the exact same tokens the case
 * badges use (blue = accent, green = success) — one source of truth for the
 * token → class mapping. Icon + label, not colour alone.
 */
function ResponseStatusBadge({ inProgress }: { inProgress: boolean }) {
  const Icon = inProgress ? Clock : CheckCircle2;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium",
        TOKEN_STYLES[inProgress ? "blue" : "green"],
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {inProgress ? "Em andamento" : "Enviada"}
    </span>
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

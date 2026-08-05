import Link from "next/link";
import { History } from "lucide-react";

import { commissionHref } from "@/lib/routing";
import { cn } from "@/lib/utils";
import type { ProcessTemplateVersionSummary } from "@/lib/queries/process-templates";
import { TemplateVersionStatusBadge } from "@/components/process-templates/template-version-status-badge";
import { RiseInGroup } from "@/components/motion/rise-in-group";

/**
 * The version HISTORY / picker for one process template (ADR 0096 D3).
 *
 * A Server Component: every row is a plain `?v=<id>` link, so switching versions
 * is a navigation, not client state — no server function ever crosses into a
 * client boundary (BUG-QI-001), and the whole panel ships zero JS beyond the
 * shared {@link RiseInGroup} entrance.
 *
 * What each row has to answer, in the order a coordinator (or a surveyor reading
 * over their shoulder) asks it:
 *
 *  1. **Which version is this?** — `Versão N`, tabular so the column scans.
 *  2. **What state is it in?** — the status badge. `Publicada` is the one in force
 *     for NEW cases; everything else is history or not yet live.
 *  3. **Was it the same process back then?** — the per-version title, but shown
 *     ONLY when it differs from the version currently in view. D1 put
 *     `title`/`description` on the version precisely so a rename is visible in
 *     history; repeating an identical title on every row would bury the one time
 *     it actually changed.
 *  4. **How much does it own?** — the case count. This is also why a published
 *     version can never be deleted (`cases.template_version_id` is
 *     `ON DELETE RESTRICT`), so it doubles as the honest weight of the row.
 *
 * Version DIFFING and cases-by-version reporting are explicitly out of scope
 * (ADR 0096 D3) — this panel navigates, it does not compare.
 */

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

/** pt-BR case count: "Nenhum caso" / "1 caso" / "N casos". */
function caseCountLabel(count: number): string {
  if (count <= 0) return "Nenhum caso";
  return count === 1 ? "1 caso" : `${count} casos`;
}

/**
 * The row's secondary line: when the version reached production, or — for the open
 * draft, which has no `publishedAt` — that it is still being written.
 */
function timingLabel(version: ProcessTemplateVersionSummary): string {
  if (version.publishedAt) {
    return `Publicada em ${DATE_FMT.format(new Date(version.publishedAt))}`;
  }
  return version.status === "draft"
    ? "Ainda não publicada"
    : `Criada em ${DATE_FMT.format(new Date(version.createdAt))}`;
}

export function VersionHistoryPanel({
  org,
  slug,
  templateId,
  versions,
  currentVersionId,
  className,
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  templateId: string;
  /** Newest first (the query layer's contract). */
  versions: ProcessTemplateVersionSummary[];
  /** The version currently being displayed — gets `aria-current`. */
  currentVersionId: string;
  className?: string;
}) {
  const basePath = commissionHref(
    org,
    slug,
    "manage",
    "process-templates",
    templateId,
  );
  const currentTitle = versions.find((v) => v.id === currentVersionId)?.title;

  return (
    <section
      aria-labelledby="version-history-heading"
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <History
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
        <h2 id="version-history-heading" className="text-sm font-semibold">
          Versões
        </h2>
      </div>

      <p className="text-xs text-muted-foreground text-pretty">
        Cada publicação cria uma versão definitiva. Os casos permanecem ligados à
        versão sob a qual foram abertos.
      </p>

      <nav aria-label="Histórico de versões do processo">
        <RiseInGroup runKey={currentVersionId}>
          <ul className="flex flex-col gap-1.5">
            {versions.map((version) => {
              const isCurrent = version.id === currentVersionId;
              // See §3 above: a renamed version is the signal; an identical title
              // is noise, so it only appears when it differs from what's on screen.
              const showTitle =
                currentTitle != null && version.title !== currentTitle;

              return (
                <li key={version.id} data-rise>
                  <Link
                    href={`${basePath}?v=${version.id}`}
                    aria-current={isCurrent ? "true" : undefined}
                    className={cn(
                      "flex flex-col gap-1 rounded-xl border px-3 py-2.5 transition-[border-color,background-color] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                      isCurrent
                        ? "border-primary/50 bg-accent/40"
                        : "border-border bg-card hover:border-primary/30 hover:bg-accent/20",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        Versão {version.versionNumber}
                      </span>
                      <TemplateVersionStatusBadge status={version.status} />
                    </span>

                    {showTitle && (
                      <span className="truncate text-xs text-muted-foreground italic">
                        {version.title}
                      </span>
                    )}

                    <span className="text-xs text-muted-foreground">
                      {timingLabel(version)}
                      {" · "}
                      {caseCountLabel(version.caseCount)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </RiseInGroup>
      </nav>
    </section>
  );
}

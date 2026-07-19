import { BadgeCheck, RotateCcw } from "lucide-react";

import type { ReferralResolution } from "@/lib/referrals/types";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { formatDateTime } from "./format";

/**
 * The append-only resolution history (RV2 R3 — ADR 0037 D4/D5), shown on the
 * referral detail once the SOURCE coordinator first resolves a referral. Each row
 * is one resolution CYCLE (number, who + when, an optional PHI-bearing summary, a
 * follow-up flag, and — if the cycle was later reopened — the reopen who/when/why).
 *
 * A pure Server Component: `summaryMd` is PHI-bearing clinical free text the audited
 * detail door already gated (`null` for a metadata-only reader), rendered through
 * the ONE sanitizing Markdown renderer (Rule 7). The non-PHI history metadata
 * (number, timestamps, follow-up, reopen info) is visible to every metadata-tier
 * reader. Renders nothing when there is no resolution yet.
 */
export function ReferralResolutions({
  resolutions,
}: {
  resolutions: ReferralResolution[];
}) {
  if (resolutions.length === 0) return null;

  // Newest cycle first (highest resolution number at the top).
  const ordered = [...resolutions].sort(
    (a, b) => b.resolutionNumber - a.resolutionNumber,
  );

  return (
    <section
      aria-labelledby="referral-resolutions-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-center gap-2">
        <BadgeCheck aria-hidden="true" className="size-4 text-success" />
        <h2
          id="referral-resolutions-heading"
          className="text-base font-semibold"
        >
          Histórico de resolução
        </h2>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
          {resolutions.length}
        </span>
      </div>

      <ol className="flex flex-col gap-3">
        {ordered.map((r, i) => (
          <li
            key={r.id}
            className="flex animate-rise-in flex-col gap-2 rounded-xl border border-border/70 bg-muted/20 p-4"
            style={{ "--rise-delay": `${i * 50}ms` } as React.CSSProperties}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/12 px-2 py-0.5 text-xs font-medium text-success">
                <BadgeCheck aria-hidden="true" className="size-3.5" />
                Resolução {r.resolutionNumber}
              </span>
              {r.followUpRequired && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                  Requer acompanhamento
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {formatDateTime(r.resolvedAt)}
              </span>
            </div>

            {r.resolvedByName && (
              <span className="text-xs text-muted-foreground">
                Resolvido por {r.resolvedByName}
              </span>
            )}

            {r.summaryMd?.trim() ? (
              <MarkdownRenderer content={r.summaryMd} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Resolvido sem resumo registrado.
              </p>
            )}

            {r.reopenedAt && (
              <p className="mt-1 flex items-start gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm text-muted-foreground text-pretty">
                <RotateCcw
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0"
                />
                <span>
                  Reaberto em{" "}
                  <span className="tabular-nums">
                    {formatDateTime(r.reopenedAt)}
                  </span>
                  {r.reopenedReason ? ` — ${r.reopenedReason}` : ""}
                </span>
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

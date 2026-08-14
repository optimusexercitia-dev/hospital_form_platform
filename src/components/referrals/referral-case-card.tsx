"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderOpen, Lock, SquareArrowOutUpRight } from "lucide-react";

import type { ReferralCaseAccessSummary } from "@/lib/referrals/types";
import { Button } from "@/components/ui/button";
import { ReferralCaseAccessDialog } from "./referral-case-access-dialog";
import {
  ReferralLinkCaseButton,
  type LinkableTargetCase,
} from "./referral-link-case-button";
import { formatCaseNumber } from "./format";

/**
 * The rail card for the CASE this referral is about, on the viewer's own side
 * (RDR D3): the sending side sees its originating case (`source_case_id`, always
 * present); the receiving side sees the case it linked (`target_case_id`), or an
 * empty state while none is linked.
 *
 * The target coordinator's "Vincular caso" control lives in THIS card's header —
 * mirroring how "Casos relacionados" carries its own "Relacionar caso" button — so the
 * act of linking sits on the card that shows the link, not in a distant action panel.
 *
 * A referral case link is a POINTER — it grants no access (the case read predicates
 * never consult it). So the card has two states:
 *  - `summary.canRead` → a primary link straight to `/casos/{caseId}`;
 *  - otherwise → the roster dialog naming who *can* open it, so the reader knows
 *    whom to ask instead of hitting a 404.
 *
 * `caseHref` arrives as a plain STRING built server-side by `commissionHref` — never
 * a builder function, which would be a server reference crossing into a client
 * component (a recurring RSC crash in this repo).
 */
export function ReferralCaseCard({
  heading,
  headingId,
  caseId,
  caseNumber,
  caseHref,
  summary,
  emptyHint,
  linkCase,
}: {
  /** pt-BR card heading ("Caso de origem" / "Caso em análise"). */
  heading: string;
  /** Unique id so two of these cards can coexist with distinct landmarks. */
  headingId: string;
  /** The side-derived case, or `null` when this side has linked none yet. */
  caseId: string | null;
  caseNumber: number | null;
  /** Pre-built `/o/{org}/c/{slug}/casos/{caseId}` route; `null` with no case. */
  caseHref: string | null;
  /** The audited access roster for `caseId`; `null` when unavailable/denied. */
  summary: ReferralCaseAccessSummary | null;
  /** Shown in the empty state — e.g. what to do to get a case linked. */
  emptyHint?: string;
  /**
   * The target coordinator's link affordance. Present ONLY for a viewer the
   * `link_referral_case` RPC would accept in the current status; omitted entirely
   * otherwise (the source side never links, and no status outside accepted/in_review
   * may). The two fields travel together so a call site cannot supply half of one.
   */
  linkCase?: { referralId: string; cases: LinkableTargetCase[] };
}) {
  const [accessOpen, setAccessOpen] = useState(false);
  const caseLabel = formatCaseNumber(caseNumber);
  const canRead = summary?.canRead === true;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FolderOpen
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2 id={headingId} className="text-sm font-semibold">
            {heading}
          </h2>
        </div>
        {linkCase ? (
          <ReferralLinkCaseButton
            referralId={linkCase.referralId}
            cases={linkCase.cases}
            linked={caseId != null}
          />
        ) : null}
      </div>

      {caseId && caseHref ? (
        <>
          <p className="font-mono text-sm text-foreground tabular-nums">
            {caseLabel}
          </p>

          {canRead ? (
            <Button asChild size="lg" className="w-full">
              <Link href={caseHref}>
                <SquareArrowOutUpRight aria-hidden="true" />
                Abrir registro do caso
              </Link>
            </Button>
          ) : (
            <>
              <p className="inline-flex items-start gap-1.5 text-xs text-muted-foreground text-pretty">
                <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                Você não tem acesso a este caso.
              </p>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => setAccessOpen(true)}
              >
                <Lock aria-hidden="true" />
                Quem tem acesso?
              </Button>
              <ReferralCaseAccessDialog
                open={accessOpen}
                onOpenChange={setAccessOpen}
                summary={summary}
                caseNumberLabel={caseLabel}
              />
            </>
          )}
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground text-pretty">
          Nenhum caso vinculado ainda.
          {emptyHint ? ` ${emptyHint}` : ""}
        </p>
      )}
    </section>
  );
}

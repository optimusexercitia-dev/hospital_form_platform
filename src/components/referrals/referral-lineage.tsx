import Link from "next/link";
import { CornerUpLeft, GitBranch, Share2 } from "lucide-react";

/**
 * The referral LINEAGE card (RV2 R3 — ADR 0037 D15): surfaces a referral's place in
 * a forward chain. Two PHI-free affordances:
 *  - **Origem da lineage** — when this referral was forwarded from another (its
 *    `parent_referral_id` back-pointer is set), a link back to the parent. The link
 *    is RLS-gated at the target (the reader sees the parent only if entitled).
 *  - **Encaminhar adiante** — when the viewer coordinates the TARGET side and has
 *    linked a case, an affordance to forward THIS referral onward: it deep-links to
 *    the linked case's detail with a `?encaminharDe` param that pre-opens the send
 *    wizard, seeding the new referral's `parent_referral_id` (D15 — the child shares
 *    NOTHING from the parent automatically).
 *
 * A pure Server Component (links only). Renders nothing when there is neither a
 * parent nor a forward affordance, so the detail's right column stays calm.
 */
export function ReferralLineageCard({
  parentHref,
  forwardHref,
}: {
  /** Link to the parent referral this one was forwarded from; `null` if a root. */
  parentHref: string | null;
  /** Deep-link that opens the forward wizard on the linked case; `null` when the
   * viewer cannot forward (not the target coordinator, or no case linked yet). */
  forwardHref: string | null;
}) {
  if (!parentHref && !forwardHref) return null;

  return (
    <section
      aria-labelledby="referral-lineage-heading"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-center gap-2">
        <GitBranch aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 id="referral-lineage-heading" className="text-base font-semibold">
          Encadeamento
        </h2>
      </div>

      {parentHref && (
        <Link
          href={parentHref}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-primary underline-offset-2 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <CornerUpLeft aria-hidden="true" className="size-4" />
          Encaminhado a partir de outro encaminhamento
        </Link>
      )}

      {forwardHref && (
        <div className="flex flex-col gap-1.5">
          <Link
            href={forwardHref}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-primary bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <Share2 aria-hidden="true" className="size-4" />
            Encaminhar adiante
          </Link>
          <p className="text-xs text-muted-foreground text-pretty">
            Encaminhe o caso vinculado a outra comissão, mantendo o vínculo com
            este encaminhamento.
          </p>
        </div>
      )}
    </section>
  );
}

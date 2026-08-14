"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";

import {
  openReferralReplyAttachment,
  openReferralSnapshotDocument,
} from "@/lib/referrals/actions";
import { referralDocumentErrorMessage } from "./referral-document-labels";

/**
 * THE click-time byte door for referral files (DM4 / ADR 0114 Wave C, F-14).
 *
 * ## Why this replaced render-time pre-signing
 *
 * Both referral detail pages used to mint signed URLs DURING RENDER, one per
 * shared item and one per reply attachment, and hand them to the row as an
 * `href`. On the PHI tier those credentials live **120 seconds** (ADR 0114 O4).
 * A URL minted while the page streams is therefore expired before a reader has
 * finished reading the referral — the affordance looked healthy and failed on
 * click, and it failed for the entitled reader exactly as it did for anyone
 * else. Worse, on a page with N documents the render minted N credentials for
 * files nobody opened.
 *
 * The corridor is now: click → audited DEFINER door authorizes → audit row →
 * short-TTL signature → open. Nothing is signed for a file nobody asked for,
 * and every signature is consumed within its own lifetime.
 *
 * ## Two doors, one control
 *
 * `door` is a discriminated union rather than a `Promise`-returning prop,
 * because a server function handed to a client component as a prop is an RSC
 * crash this repo has hit repeatedly (BUG-QI-001). The client imports both
 * `"use server"` actions directly and picks between them — the same shape as
 * Wave A's `OpenDocumentButton`.
 *
 * ## Failure is uniform and pt-BR
 *
 * Every refusal — flag off, unauthorized, tombstoned snapshot, disposed bytes,
 * signing failure — renders a mapped pt-BR sentence from the DM4 error union.
 * A THROWN action (backend's contract stubs throw until S1/S3 land) is caught
 * here too, so a not-yet-implemented door degrades to a calm inline message
 * rather than blanking the panel through the error boundary.
 *
 * The `children` are the row's visible content, composed by the SERVER parent —
 * so the list keeps its own markup and this island stays a trigger, not a
 * second renderer of the same row.
 */
export function ReferralOpenFileButton({
  door,
  label,
  children,
}: {
  /**
   * Which audited door to call, and with what id. A snapshot opens by
   * `referral_shared_item.id`; a reply attachment opens by
   * `document_versions.id` — they are different keys into different corridors,
   * so the union keeps them from being transposed.
   */
  door:
    | { kind: "snapshot"; sharedItemId: string }
    | { kind: "reply"; documentVersionId: string };
  /**
   * The button's accessible name. MUST contain the visible title text
   * (label-in-name) and MUST NOT collide with a sibling list's names — a
   * concluded referral renders shared documents and reply attachments on the
   * same page, so the two lists use distinct prefixes.
   */
  label: string;
  /** The row's visible content, composed by the server parent. */
  children: ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    setError(null);
    startTransition(async () => {
      try {
        const result =
          door.kind === "snapshot"
            ? await openReferralSnapshotDocument(door.sharedItemId)
            : await openReferralReplyAttachment(door.documentVersionId);
        if (result.ok) {
          window.open(result.url, "_blank", "noopener,noreferrer");
          return;
        }
        setError(referralDocumentErrorMessage(result.error));
      } catch {
        // Never surface a raw server error (CLAUDE.md §8), and never let a
        // rejected action escape into the error boundary and blank the panel.
        setError(referralDocumentErrorMessage("unknown"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Same row treatment the pre-DM4 `<a>` carried, so re-pointing the
          corridor is invisible in the layout. Plain `transition-colors` matches
          every sibling row on these pages — and the bare `[--dur-fast]` form
          the motion tokens invite is dead CSS under Tailwind v4, which
          `lint:css-vars` exists to catch. */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={isPending}
        aria-label={label}
        aria-busy={isPending || undefined}
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/30 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-progress disabled:opacity-70"
      >
        {isPending ? (
          <Loader2
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin text-primary"
          />
        ) : (
          <Download aria-hidden="true" className="size-4 shrink-0 text-primary" />
        )}
        {children}
      </button>
      {error && (
        <p
          role="alert"
          className="text-xs font-medium text-pretty text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

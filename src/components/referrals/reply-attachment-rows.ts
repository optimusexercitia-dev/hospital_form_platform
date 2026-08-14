import type { ReferralReplyDocument } from "@/lib/referrals/types";

/**
 * One row in the reply dialog's attachment list: either an attachment that
 * already existed when the dialog opened (server-rendered), or one uploaded in
 * this session (optimistic).
 */
export interface AttachedRow {
  /** `documents.id` — the merge key AND the React key. */
  key: string;
  title: string;
  sizeBytes: number | null;
  /** `true` for a row uploaded in THIS session (drives the "Anexado" icon). */
  fresh: boolean;
}

/**
 * Merge the optimistic and server-rendered attachment lists into the rendered
 * rows. Pure — no React, no I/O — so the invariants below are pinned by
 * `reply-attachment-rows.test.ts` deterministically, which is the whole reason
 * it lives outside the component (see "why a unit test" at the bottom).
 *
 * ## Why this is a merge and not a concatenation (BUG-DM4-DUP-1)
 *
 * `finalizeReferralReplyAttachmentUpload` calls `revalidatePath` on the referral
 * detail, so a successful upload makes Next refetch the RSC payload WHILE the
 * dialog stays mounted. The page re-runs `listReferralReplyDocuments`, which now
 * includes the attachment just created, and passes it back down as
 * `initialDocuments` — while `uploaded` still holds the optimistic copy of the
 * same document. Concatenating rendered it TWICE, under the same React key.
 *
 * ⚠ It is a RACE, not a condition. Whether the duplicate is on screen depends on
 * whether the refetch resolved before the render being observed, which is why it
 * survived a dev-loop verification entirely and surfaced only on
 * prod-standalone. A run that does not reproduce it lost the race; it did not
 * avoid the bug.
 *
 * ## Two properties, both load-bearing
 *
 * 1. **The optimistic row wins the tie** — via an explicit `has` guard, not a
 *    second `set`. `initialDocuments` is server-rendered and legitimately STALE
 *    for the whole upload window; that staleness is the reason the optimistic
 *    row exists at all. An unguarded `set` would overwrite it — and strip its
 *    `fresh` marker — at exactly the moment the server caught up. Dropping the
 *    optimistic row instead would trade a duplicated row for a *disappearing*
 *    one: the user attaches a file and watches it vanish, which is worse.
 *
 * 2. **Optimistic rows are seeded FIRST, so the refetch reorders nothing.**
 *    Seeding from `initialDocuments` would also fix the duplicate, and would
 *    leave a second timing-dependent DOM change of the same family behind:
 *    `listReferralReplyDocuments` returns NEWEST-FIRST, so a fresh upload sits
 *    at the END of the list before the refetch and jumps to the FRONT after it.
 *    Seeding from `uploaded` means each optimistic row already occupies the
 *    position it keeps once the server catches up.
 *
 * Keys are unique because they are `Map` keys — by construction, not by luck.
 */
export function mergeAttachedRows(
  uploaded: AttachedRow[],
  initialDocuments: ReferralReplyDocument[],
): AttachedRow[] {
  const byId = new Map<string, AttachedRow>();

  // Optimistic first — this is what pins the position across the refetch.
  for (const row of uploaded) byId.set(row.key, row);

  for (const d of initialDocuments) {
    // The optimistic row wins. `set` here would overwrite it.
    if (byId.has(d.documentId)) continue;
    byId.set(d.documentId, {
      key: d.documentId,
      title: d.title,
      sizeBytes: d.sizeBytes,
      fresh: false,
    });
  }

  return [...byId.values()];
}

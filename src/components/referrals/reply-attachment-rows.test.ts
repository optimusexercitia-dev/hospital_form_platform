import { describe, expect, it } from "vitest";

import type { ReferralReplyDocument } from "@/lib/referrals/types";
import { type AttachedRow, mergeAttachedRows } from "./reply-attachment-rows";

/**
 * BUG-DM4-DUP-1 pins — the reply-attachment row merge.
 *
 * ## Why a unit test when DM4-RT-1 already covers this
 *
 * DM4-RT-1 catches the duplicate only when the RACE WINS. The defect is a
 * `revalidatePath` refetch landing while the dialog is still mounted, so
 * whether the duplicate is on screen depends on whether the refetch resolved
 * before the render being asserted. That spec was GREEN through the entire dev
 * loop while the bug was present, and only went red on prod-standalone. An
 * assertion whose failure depends on timing is a weak pin.
 *
 * These are deterministic: they call the merge directly with the two list
 * states the race interleaves, so the invariant holds or it does not.
 *
 * ## RED-FIRST (required — a pin never proven able to fail is not a pin)
 *
 * All four were observed RED against the ORIGINAL concatenation
 * (`[...initialDocuments.map(…), ...uploaded]`) temporarily restored inside
 * `mergeAttachedRows`. Output quoted in the S4 report. Restoring the merge
 * returns all four to GREEN.
 *
 * ## The trap that shaped T3
 *
 * The obvious place to assert ordering is AFTER the refetch — and it would have
 * passed for the wrong reason. Post-refetch the concatenation fails on COUNT (it
 * emits three rows for two documents), so an order assertion there rides on the
 * duplicate rather than on ordering, and would stay green under any
 * dedup-only fix that got the order wrong. T3 therefore uses the PRE-refetch
 * state, where both implementations return the same number of rows and only the
 * order distinguishes them. ([[vacuity-control-anchored-on-a-defect]])
 */

/** A server row as `listReferralReplyDocuments` projects it. Only the four
 * fields the merge reads are meaningful; the rest satisfy the contract. */
function serverDoc(
  documentId: string,
  title: string,
  sizeBytes: number | null = 1024,
): ReferralReplyDocument {
  return {
    documentId,
    documentVersionId: `${documentId}-v1`,
    title,
    mimeType: "application/pdf",
    sizeBytes,
    availability: "available",
    canOpen: true,
    uploadedById: null,
    uploadedByName: null,
    createdAt: "2026-08-14T12:00:00.000Z",
  };
}

/** An optimistic row as the dialog appends it after a successful finalize. */
function optimisticRow(
  documentId: string,
  title: string,
  sizeBytes: number | null = 1024,
): AttachedRow {
  return { key: documentId, title, sizeBytes, fresh: true };
}

describe("mergeAttachedRows", () => {
  it("T1 — renders a document ONCE when it is in both lists (the duplicate)", () => {
    // The post-refetch state: the server now returns the attachment the session
    // just uploaded, and `uploaded` still holds its optimistic copy.
    const uploaded = [optimisticRow("doc-c", "Parecer técnico")];
    const initial = [
      serverDoc("doc-c", "Parecer técnico"),
      serverDoc("doc-b", "Laudo anterior"),
    ];

    const rows = mergeAttachedRows(uploaded, initial);

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.key)).toEqual(["doc-c", "doc-b"]);
    // The React-key invariant, asserted as a property rather than trusted: the
    // strict-mode violation was two <li> under one key.
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });

  it("T2 — the optimistic row wins the tie and keeps its `fresh` marker", () => {
    // The server's projection differs from the optimistic copy, so which side
    // won is observable rather than inferred.
    const uploaded = [optimisticRow("doc-c", "Título otimista", 4096)];
    const initial = [serverDoc("doc-c", "Título do servidor", 8192)];

    const rows = mergeAttachedRows(uploaded, initial);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      key: "doc-c",
      title: "Título otimista",
      sizeBytes: 4096,
      fresh: true,
    });
  });

  it("T3 — an optimistic row sorts FIRST before the server catches up", () => {
    // PRE-refetch: the server has not yet returned doc-c. Both the merge and the
    // old concatenation return exactly two rows here, so this case is decided by
    // ORDER alone — which is what makes it discriminate (see the header note).
    const uploaded = [optimisticRow("doc-c", "Parecer técnico")];
    const initial = [serverDoc("doc-b", "Laudo anterior")];

    const rows = mergeAttachedRows(uploaded, initial);

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.key)).toEqual(["doc-c", "doc-b"]);
  });

  it("T4 — the refetch reorders nothing (the invariant, across both states)", () => {
    // THE property the insertion order exists for. `listReferralReplyDocuments`
    // returns newest-first, so once the server catches up doc-c is at its index
    // 0. Seeding the merge from `initialDocuments` would put doc-c LAST before
    // the refetch and FIRST after it — a second timing-dependent DOM change, of
    // the same family as the bug this file pins. Asserted across BOTH states so
    // it pins the invariant, not a snapshot of one render.
    const uploaded = [optimisticRow("doc-c", "Parecer técnico")];

    const beforeRefetch = mergeAttachedRows(uploaded, [
      serverDoc("doc-b", "Laudo anterior"),
    ]);
    const afterRefetch = mergeAttachedRows(uploaded, [
      serverDoc("doc-c", "Parecer técnico"),
      serverDoc("doc-b", "Laudo anterior"),
    ]);

    expect(beforeRefetch.findIndex((r) => r.key === "doc-c")).toBe(0);
    expect(afterRefetch.findIndex((r) => r.key === "doc-c")).toBe(0);
    // Position is stable AND the row count settles — the refetch adds nothing
    // and moves nothing.
    expect(beforeRefetch.map((r) => r.key)).toEqual(afterRefetch.map((r) => r.key));
  });

  it("T5 — disjoint lists keep every row, optimistic ahead of server", () => {
    const uploaded = [
      optimisticRow("doc-c", "Parecer técnico"),
      optimisticRow("doc-d", "Anexo complementar"),
    ];
    const initial = [
      serverDoc("doc-b", "Laudo anterior"),
      serverDoc("doc-a", "Documento inicial"),
    ];

    const rows = mergeAttachedRows(uploaded, initial);

    expect(rows.map((r) => r.key)).toEqual(["doc-c", "doc-d", "doc-b", "doc-a"]);
    expect(rows.filter((r) => r.fresh).map((r) => r.key)).toEqual([
      "doc-c",
      "doc-d",
    ]);
  });

  it("T6 — an empty session renders the server list unchanged", () => {
    // The dialog's first open: nothing uploaded yet. Guards against a merge that
    // only behaves when `uploaded` is non-empty.
    const initial = [
      serverDoc("doc-b", "Laudo anterior"),
      serverDoc("doc-a", "Documento inicial"),
    ];

    const rows = mergeAttachedRows([], initial);

    expect(rows.map((r) => r.key)).toEqual(["doc-b", "doc-a"]);
    expect(rows.every((r) => r.fresh === false)).toBe(true);
  });
});

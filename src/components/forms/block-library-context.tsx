"use client";

import { createContext, use, useMemo } from "react";

import type { BlockLibraryEntry } from "@/lib/queries/block-library";

/**
 * FF-4 (ADR 0092) — the commission's saved library entries, provided once at
 * the builder root and read by whichever descendant offers a library
 * affordance (`AddBlockMenu`'s "Da biblioteca…" picker today).
 *
 * A SEPARATE context from {@link BuilderFlags} on purpose: that context is
 * documented as ambient BOOLEAN configuration, and `BlockLibraryEntry[]` is
 * DATA, resolved server-side once per page load exactly like `imageUrls`.
 * Folding it into the flags context would blur that contract for every other
 * flag consumer. The reasoning for using a context AT ALL is identical to
 * `BuilderFlagsProvider`'s: threading `libraryEntries` as a prop would run
 * `BuilderShell → BlockList/SectionCard → AddBlockMenu`, through two
 * components that have no opinion about it, for the one that does.
 *
 * Resolved SERVER-side (the builder page awaits `listBlockLibraryEntries`)
 * and passed in as a plain array — no client-side fetch, no round trip. A
 * mutation that changes the library (save-to-library, insert-from-library)
 * refreshes the whole builder route (`router.refresh()`, the established
 * pattern every other builder write already uses), which re-resolves this
 * list from the server — there is no separate client-side cache to keep in
 * sync.
 */
const BlockLibraryEntriesContext = createContext<BlockLibraryEntry[]>([]);

export function BlockLibraryEntriesProvider({
  entries,
  children,
}: {
  entries: BlockLibraryEntry[];
  children: React.ReactNode;
}) {
  // Referentially stable across re-renders driven by an UNRELATED prop change
  // on the same parent — mirrors `BuilderFlagsProvider`'s memoization.
  const value = useMemo(() => entries, [entries]);
  return (
    <BlockLibraryEntriesContext value={value}>
      {children}
    </BlockLibraryEntriesContext>
  );
}

/** The commission's saved blocks, newest-saved first (query-layer order).
 *  `[]` outside a provider AND `[]` when `power_authoring` is off or the
 *  library is genuinely empty — the caller distinguishes "off" via
 *  `useBuilderFlags().powerAuthoring`, never by inspecting this list. */
export function useBlockLibraryEntries(): BlockLibraryEntry[] {
  return use(BlockLibraryEntriesContext);
}

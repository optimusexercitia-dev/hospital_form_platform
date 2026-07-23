/**
 * Client-side balanced "deal" for bulk case creation ("Múltiplos casos", ADR 0084).
 *
 * Pure, dependency-free logic (imported by the `"use client"` deal step): shuffle
 * the cases and the chosen members and deal them like cards, so each member owns a
 * whole-case share whose size differs from any other by at most 1. The distribution
 * runs on the CLIENT (instant re-shuffle + manual owner overrides); the resolved
 * `case → ownerUserId` map is what the server executes verbatim — the server never
 * randomizes (Design #1/#8). Keeping it here (no React, no I/O) is what makes the
 * balanced-deal invariants unit-testable (`distribute.test.ts`).
 */

/** A `[0,1)` RNG, matching `Math.random`. Injected in tests for determinism. */
export type Rng = () => number;

/** `[0, 1, …, n-1]`. */
function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

/**
 * Fisher–Yates shuffle of a COPY (never mutates the input; RNG-injected). An empty
 * or single-element list is returned as a fresh copy unchanged.
 */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Deal `caseCount` cases across `memberIds` like cards: shuffle both, then hand each
 * shuffled case to the next member cyclically. Returns an array of length
 * `caseCount` whose entry `i` is the owner (a member id) of grid case `i`.
 *
 * Invariants (asserted in `distribute.test.ts`):
 *  - every case is owned by exactly one member drawn from `memberIds`;
 *  - per-member workloads differ by at most 1 (each is `floor` or `ceil` of
 *    `caseCount / memberIds.length`);
 *  - the "remainder" extra cases land on a RANDOM-ordered head of the members.
 *
 * @throws when `memberIds` is empty and there is at least one case to place.
 */
export function balancedDeal(
  caseCount: number,
  memberIds: readonly string[],
  rng: Rng = Math.random,
): string[] {
  if (caseCount <= 0) return [];
  if (memberIds.length === 0) {
    throw new Error("balancedDeal requires at least one member to deal to");
  }
  const dealOrder = shuffle(range(caseCount), rng);
  const members = shuffle(memberIds, rng);
  const owners = new Array<string>(caseCount);
  dealOrder.forEach((caseIndex, dealPosition) => {
    owners[caseIndex] = members[dealPosition % members.length];
  });
  return owners;
}

/**
 * Tally how many cases each member owns, given an owners array (grid case → owner).
 * Members with zero cases are absent from the map — callers seed a 0 for the full
 * roster when they need every member represented (the preview cards do).
 */
export function tallyByMember(owners: readonly string[]): Map<string, number> {
  const tally = new Map<string, number>();
  for (const owner of owners) {
    tally.set(owner, (tally.get(owner) ?? 0) + 1);
  }
  return tally;
}

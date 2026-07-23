import { describe, expect, it } from "vitest";

import { balancedDeal, shuffle, tallyByMember, type Rng } from "./distribute";

/**
 * A small deterministic PRNG (mulberry32) so the shuffle-dependent assertions are
 * reproducible across runs. The balanced-deal INVARIANTS must hold for ANY seed, so
 * the property tests sweep many seeds rather than pinning one exact permutation.
 */
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MEMBERS = ["u-a", "u-b", "u-c", "u-d", "u-e"] as const;

describe("balancedDeal", () => {
  it("returns an empty deal for zero cases", () => {
    expect(balancedDeal(0, MEMBERS)).toEqual([]);
  });

  it("throws when there are cases but no members", () => {
    expect(() => balancedDeal(5, [])).toThrow(/at least one member/i);
  });

  it("assigns every case exactly once, only to selected members", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const caseCount of [1, 3, 7, 12, 50, 200]) {
        for (const memberCount of [1, 2, 3, 5]) {
          const members = MEMBERS.slice(0, memberCount);
          const owners = balancedDeal(caseCount, members, mulberry32(seed));

          // Length equals the case count and no hole is left unassigned.
          expect(owners).toHaveLength(caseCount);
          expect(owners.every((o) => typeof o === "string" && o.length > 0)).toBe(
            true,
          );
          // Only selected members are used.
          const allowed = new Set<string>(members);
          expect(owners.every((o) => allowed.has(o))).toBe(true);
        }
      }
    }
  });

  it("keeps per-member workloads within 1 of each other (balanced)", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const caseCount of [1, 4, 7, 13, 50, 199, 200]) {
        for (const memberCount of [1, 2, 3, 4, 5]) {
          const members = MEMBERS.slice(0, memberCount);
          const owners = balancedDeal(caseCount, members, mulberry32(seed));
          const tally = tallyByMember(owners);
          // Members with zero cases must count as 0 for the spread check.
          const counts = members.map((m) => tally.get(m) ?? 0);
          const max = Math.max(...counts);
          const min = Math.min(...counts);
          expect(max - min).toBeLessThanOrEqual(1);
          // The counts sum back to the total (every case placed once).
          expect(counts.reduce((a, b) => a + b, 0)).toBe(caseCount);
          // Exact floor/ceil shape: `remainder` members carry the extra one.
          const floor = Math.floor(caseCount / memberCount);
          const remainder = caseCount % memberCount;
          expect(counts.filter((c) => c === floor + 1)).toHaveLength(remainder);
        }
      }
    }
  });

  it("re-shuffles to a different deal for different seeds (not degenerate)", () => {
    const a = balancedDeal(50, MEMBERS, mulberry32(1));
    const b = balancedDeal(50, MEMBERS, mulberry32(2));
    expect(a).not.toEqual(b);
  });
});

describe("shuffle", () => {
  it("does not mutate the input and preserves the multiset", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, mulberry32(7));
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort((x, y) => x - y)).toEqual(input);
  });
});

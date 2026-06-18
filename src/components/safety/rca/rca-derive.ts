/**
 * The RCA workspace's derived values (Phase 14c). PURE + client-safe (zero data
 * access): the single source of truth for stage completion, key factors, and the
 * header progress readout, recomputed from the REAL contract shapes
 * (`@/lib/safety/rca-types`) — the README formulas reference fields our schema
 * doesn't carry, so these are adapted to the committed types.
 *
 * Stage 4 (corrective actions / PDCA) is Phase 14d — it never counts as complete
 * here and is rendered as a placeholder.
 */

import type {
  Rca,
  RcaFactor,
  RcaRootCause,
  RcaWhyChain,
} from "@/lib/safety/rca-types";

/** The four stages, in order. Stage 4 is a 14d placeholder. */
export type RcaStageId = "problem" | "analysis" | "roots" | "actions";

export const RCA_STAGE_ORDER: RcaStageId[] = [
  "problem",
  "analysis",
  "roots",
  "actions",
];

/** pt-BR stage labels + sub-labels for the stepper / footer. */
export const RCA_STAGE_META: Record<
  RcaStageId,
  { label: string; sub: string }
> = {
  problem: { label: "Problema", sub: "O que aconteceu vs. o esperado" },
  analysis: { label: "Análise causal", sub: "Ishikawa e 5 porquês" },
  roots: { label: "Causas raiz", sub: "Declarações classificadas" },
  actions: { label: "Ações corretivas", sub: "Plano de ação (Fase 14d)" },
};

/** Whether the viewer may edit content (write grant AND not frozen/completed). */
export function rcaCanEdit(rca: Rca): boolean {
  return rca.viewerCanWrite && rca.status !== "completed";
}

/** Per-stage completion (drives the stepper checkmarks + the progress readout). */
export function deriveDone(
  rca: Rca,
  whyChains: RcaWhyChain[],
  rootCauses: RcaRootCause[],
): Record<RcaStageId, boolean> {
  return {
    problem: !!(rca.whatMd?.trim() && rca.expectedMd?.trim()),
    analysis: whyChains.some((w) => !!w.rootText?.trim()),
    roots: rootCauses.length > 0 && rootCauses.every((r) => r.text.trim()),
    // Stage 4 is Phase 14d — always incomplete in 14c.
    actions: false,
  };
}

/**
 * The key factors carried into the 5-Whys (flagged factors), each joined to its
 * lazily-created chain by `factorId` (a flagged factor with no chain yet renders an
 * empty chain). Ordered by the factor's `position`.
 */
export function deriveKeyFactors(
  factors: RcaFactor[],
  whyChains: RcaWhyChain[],
): { factor: RcaFactor; chain: RcaWhyChain | null }[] {
  const byFactor = new Map(whyChains.map((w) => [w.factorId, w]));
  return factors
    .filter((f) => f.isKey)
    .sort((a, b) => a.position - b.position)
    .map((factor) => ({ factor, chain: byFactor.get(factor.id) ?? null }));
}

/** Group factors by their fishbone category (the diagram renders flat rows grouped). */
export function groupFactorsByCategory(
  factors: RcaFactor[],
): Map<RcaFactor["category"], RcaFactor[]> {
  const map = new Map<RcaFactor["category"], RcaFactor[]>();
  for (const f of [...factors].sort((a, b) => a.position - b.position)) {
    const list = map.get(f.category) ?? [];
    list.push(f);
    map.set(f.category, list);
  }
  return map;
}

/**
 * The number of COMPLETE stages for the `N/4` header readout. Stage 4 never counts
 * in 14c (it has no implementation), so the ceiling the user can reach here is 3/4.
 */
export function countDone(done: Record<RcaStageId, boolean>): number {
  return RCA_STAGE_ORDER.filter((s) => done[s]).length;
}

import "server-only";

import { listMyNspHospitals } from "@/lib/queries/pqs";
import type { Indicator } from "@/lib/indicators/types";

/**
 * F5 operator-gate: whether the current user is a PQS operator (enrolled member
 * OR coordinator) of the indicator's HOSPITAL — the capability that decides
 * whether the "Abrir plano de ação (CAPA)" button is shown (backend §4; ADR 0057).
 *
 * This is DISPLAY-ONLY. The real security boundary is `open_capa_plan`, which is
 * PQS-operator-gated in the RPC (42501 otherwise); this just avoids showing an
 * affordance that would fail. Resolves against the caller's own NSP grants
 * (`listMyNspHospitals` → `hospitalId[]`), so it never leaks another user's
 * standing.
 *
 * `indicator.hospitalId` is the CAPA hospital (derived from the indicator's
 * commission, exposed on the `Indicator` shape by backend B7). Fail-closed: if it
 * is somehow absent the button is hidden — the RPC still lets a genuine operator
 * open the CAPA, so nothing is blocked, only the affordance is withheld.
 */
export async function isPqsOperatorOfIndicatorHospital(
  indicator: Indicator,
): Promise<boolean> {
  if (!indicator.hospitalId) return false;
  const grants = await listMyNspHospitals();
  return grants.some((g) => g.hospitalId === indicator.hospitalId);
}

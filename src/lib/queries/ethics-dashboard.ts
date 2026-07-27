/**
 * Ethics dashboard aggregation (ETH·E3a; ADR 0073 procedure surface + ADR 0072
 * access spine). A NEW companion module rather than an extension of `dashboard.ts`,
 * mirroring how E2 chose a companion `get_ethics_case_procedure` over extending
 * `get_case_detail` for the same blast-radius reason.
 *
 * Field types are reconciled to the LIVE catalog (verified 2026-07-26):
 *  - `case_decisions.status`   CHECK = draft | proposed | voted | issued | appealed | voided
 *  - `ethics_case_details.admissibility_status` CHECK = pending | admissible | inadmissible
 *  - sanction outcomes key off `ethics_decision_details.sanction_type_id` →
 *    `ethics_sanction_types` (id, key, display_name), NOT the plan §2.3 free-text
 *    `sanction_type` (which never shipped). We project the catalog label so the FE
 *    renders pt-BR (Rule 10) without a second round-trip.
 */

/** Sanction-outcome tally over ISSUED decisions, joined to the sanction catalog. */
export interface SanctionOutcomeCount {
  /** `ethics_sanction_types.id`. */
  sanctionTypeId: string
  /** `ethics_sanction_types.key` (ASCII slug). */
  key: string
  /** `ethics_sanction_types.display_name` (pt-BR, Rule 10). */
  label: string
  count: number
}

export interface EthicsDashboardSummary {
  commissionId: string
  /** Ethics cases the VIEWER can read (see the invariant on getEthicsDashboard). */
  totalCases: number
  /** By `ethics_case_details.admissibility_status`. */
  byAdmissibilityStatus: Record<'pending' | 'admissible' | 'inadmissible', number>
  /** By `case_decisions.status`. */
  byCaseDecisionStatus: Record<
    'draft' | 'proposed' | 'voted' | 'issued' | 'appealed' | 'voided',
    number
  >
  /**
   * Median days from `ethics_case_details.complaint_received_at` to
   * `case_decisions.decided_at`, over ISSUED decisions only; `null` when none.
   */
  medianCycleTimeDays: number | null
  /**
   * Sanction-type distribution over ISSUED decisions only. Reconciled to the
   * `ethics_sanction_types` catalog (was a free-text `Record<string, number>` in the
   * plan sketch); an array carries the pt-BR label alongside the count.
   */
  sanctionOutcomeCounts: SanctionOutcomeCount[]
}

/**
 * CRITICAL INVARIANT (the E3a acceptance keystone, §4 A-6/A-7): every row this
 * aggregates is FIRST filtered through `app.can_read_case(case_id, auth.uid())` — via
 * an ordinary RLS-scoped select against `cases` / `ethics_case_details` /
 * `case_decisions` under the `authenticated` role, NEVER a service-role or
 * `SECURITY DEFINER` bypass. A viewer who cannot read a given ethics case (respondent,
 * recused, non-granted member of an `explicit_grants_only` case) contributes ZERO to
 * every count/aggregate here — no leakage via a count that reveals "a case exists"
 * even when its detail is hidden. A naive `count(*)` over a service-role connection
 * would silently defeat E1's entire access spine at the reporting layer, so BE-6 uses
 * the same RLS-scoped idiom `dashboard.ts` already follows for form responses.
 *
 * Contract-first stub; BE-6 implements the RLS-scoped read (highest-scrutiny task).
 */
export async function getEthicsDashboard(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stub; BE-6 wires the RLS-scoped read
  commissionId: string,
): Promise<EthicsDashboardSummary> {
  throw new Error('not implemented')
}

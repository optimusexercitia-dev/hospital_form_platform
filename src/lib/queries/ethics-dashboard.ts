import 'server-only'

import { createClient } from '@/lib/supabase/server'

/**
 * Ethics dashboard aggregation (ETH·E3a BE-7; ADR 0073 procedure + ADR 0072 access
 * spine). A companion module to `dashboard.ts`.
 *
 * Field types reconciled to the LIVE catalog (verified 2026-07-26):
 *  - `case_decisions.status` CHECK = draft | proposed | voted | issued | appealed | voided
 *  - `ethics_case_details.admissibility_status` CHECK = pending | admissible | inadmissible
 *  - sanction outcomes key off `ethics_decision_details.sanction_type_id` →
 *    `ethics_sanction_types` (id, key, display_name), NOT a free-text field.
 */

type AdmissibilityStatus = 'pending' | 'admissible' | 'inadmissible'
type CaseDecisionStatus =
  | 'draft'
  | 'proposed'
  | 'voted'
  | 'issued'
  | 'appealed'
  | 'voided'

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
  byAdmissibilityStatus: Record<AdmissibilityStatus, number>
  /** By `case_decisions.status`. */
  byCaseDecisionStatus: Record<CaseDecisionStatus, number>
  /**
   * Median days from `ethics_case_details.complaint_received_at` to
   * `case_decisions.decided_at`, over ISSUED decisions only (rounded to whole days);
   * `null` when none.
   */
  medianCycleTimeDays: number | null
  /**
   * Sanction-type distribution over ISSUED decisions only, joined to the
   * `ethics_sanction_types` catalog (carries the pt-BR label), ordered by label.
   */
  sanctionOutcomeCounts: SanctionOutcomeCount[]
}

// --- Row shapes (RLS-scoped reads) -----------------------------------------
interface EthicsCaseRow {
  case_id: string
  admissibility_status: AdmissibilityStatus
  complaint_received_at: string | null
}
interface DecisionRow {
  id: string
  case_id: string
  status: CaseDecisionStatus
  decided_at: string | null
}
interface SanctionRow {
  sanction_type_id: string | null
  ethics_sanction_types: { id: string; key: string; display_name: string } | null
}

function emptySummary(commissionId: string): EthicsDashboardSummary {
  return {
    commissionId,
    totalCases: 0,
    byAdmissibilityStatus: { pending: 0, admissible: 0, inadmissible: 0 },
    byCaseDecisionStatus: {
      draft: 0,
      proposed: 0,
      voted: 0,
      issued: 0,
      appealed: 0,
      voided: 0,
    },
    medianCycleTimeDays: null,
    sanctionOutcomeCounts: [],
  }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const m =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  return Math.round(m)
}

/**
 * CRITICAL INVARIANT (the E3a acceptance keystone): every row this aggregates is FIRST
 * filtered through `app.can_read_case(case_id, auth.uid())`. This is guaranteed
 * STRUCTURALLY — the function issues ONLY ordinary `authenticated`-role
 * `supabase.from(...).select(...)` reads (via `createClient()`), NEVER a service-role /
 * admin client and NEVER a `.rpc()` to a `SECURITY DEFINER` door. The three source
 * tables (`ethics_case_details` / `case_decisions` / `ethics_decision_details`) each
 * have a SELECT policy `USING app.can_read_case(case_id, auth.uid())`, so Postgres RLS
 * drops every unreadable row BEFORE it reaches this code and thus before any count. A
 * viewer who cannot read a given ethics case (respondent-excluded, recused, or a
 * non-granted member of an `explicit_grants_only` case) contributes ZERO to totalCases /
 * byAdmissibilityStatus / byCaseDecisionStatus / medianCycleTimeDays /
 * sanctionOutcomeCounts — no count reveals a case the viewer cannot read even exists.
 * A foreign-commission call returns the empty summary (the commission filter + RLS).
 *
 * Proof + the multi-role/mutation keystones: `supabase/tests/269_ethics_e3a_dashboard.sql`.
 */
export async function getEthicsDashboard(
  commissionId: string,
): Promise<EthicsDashboardSummary> {
  const supabase = await createClient()

  // (1) ethics cases in the commission the VIEWER can read. RLS
  // (ethics_case_details_select = can_read_case) drops unreadable rows; the inner join
  // on cases scopes to the commission (a foreign commission → zero readable rows).
  const { data: caseRows, error: caseErr } = await supabase
    .from('ethics_case_details')
    .select('case_id, admissibility_status, complaint_received_at, cases!inner(commission_id)')
    .eq('cases.commission_id', commissionId)
    .returns<EthicsCaseRow[]>()

  if (caseErr || !caseRows || caseRows.length === 0) return emptySummary(commissionId)

  const summary = emptySummary(commissionId)
  summary.totalCases = caseRows.length
  const complaintByCase = new Map<string, string | null>()
  for (const r of caseRows) {
    summary.byAdmissibilityStatus[r.admissibility_status]++
    complaintByCase.set(r.case_id, r.complaint_received_at)
  }
  const caseIds = caseRows.map((r) => r.case_id)

  // (2) decisions of those readable ethics cases. RLS (case_decisions_select =
  // can_read_case) re-filters; the `in(caseIds)` scopes to the ethics cases from (1).
  const { data: decRows } = await supabase
    .from('case_decisions')
    .select('id, case_id, status, decided_at')
    .in('case_id', caseIds)
    .returns<DecisionRow[]>()

  const decisions = decRows ?? []
  for (const d of decisions) summary.byCaseDecisionStatus[d.status]++

  const issued = decisions.filter((d) => d.status === 'issued')
  const cycleDays: number[] = []
  for (const d of issued) {
    const complaint = complaintByCase.get(d.case_id)
    if (complaint && d.decided_at) {
      const ms = new Date(d.decided_at).getTime() - new Date(complaint).getTime()
      if (Number.isFinite(ms)) cycleDays.push(ms / 86_400_000)
    }
  }
  summary.medianCycleTimeDays = median(cycleDays)

  // (3) sanctions over ISSUED decisions only, joined to the catalog for the label. RLS
  // (ethics_decision_details_select = can_read_case) re-filters. The sanction catalog
  // join carries only the (non-case) label — the COUNT comes from the case-gated rows.
  const issuedIds = issued.map((d) => d.id)
  if (issuedIds.length > 0) {
    const { data: sancRows } = await supabase
      .from('ethics_decision_details')
      .select('sanction_type_id, ethics_sanction_types!inner(id, key, display_name)')
      .in('decision_id', issuedIds)
      .not('sanction_type_id', 'is', null)
      .returns<SanctionRow[]>()

    const byType = new Map<string, SanctionOutcomeCount>()
    for (const s of sancRows ?? []) {
      const st = s.ethics_sanction_types
      if (!st) continue
      const existing = byType.get(st.id)
      if (existing) existing.count++
      else
        byType.set(st.id, {
          sanctionTypeId: st.id,
          key: st.key,
          label: st.display_name,
          count: 1,
        })
    }
    summary.sanctionOutcomeCounts = [...byType.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    )
  }

  return summary
}

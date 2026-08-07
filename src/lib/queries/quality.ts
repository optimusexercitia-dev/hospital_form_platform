import { createClient } from '@/lib/supabase/server'

/**
 * Quality-office oversight reads (ADR 0100, QO·A) — Architecture Rule 9: the
 * `/o/[org]/qualidade` area reads ONLY through here.
 *
 * The authority is the DB, not this file: the reviewer's reach is the S7 arm of
 * `app._case_caps` (content + overview on oversight-VISIBLE commissions of
 * hospitals they review; never PHI — D5, never deliberation — D4, never write —
 * D7), and the board door `quality_board_summary` gates itself (≥1 unexpired
 * `quality_reviewer` membership in the org, else 42501).
 *
 * Board case rows: reuse {@link import('./cases').listCasesBoard} per visible
 * commission — its per-row `app.can_read_case` filter serves the reviewer
 * exactly the readable rows with no code change here (never re-derive a board
 * read for the reviewer; the commission board IS the board).
 */

/** One commission row of `public.quality_board_summary` (PHI-free by design). */
export interface QualityBoardCommission {
  commissionId: string
  commissionName: string
  commissionSlug: string
  hospitalId: string
  hospitalName: string
  /**
   * The READABLE case population (per-row `app.can_read_case`). Includes a
   * locked case the reviewer holds an explicit grant on. DISJOINT from
   * `lockedCases` by construction — total EXCLUDES locked (pgTAP 310 §2.5).
   */
  totalCases: number
  /** Readable AND open — `status not in ('completed','cancelled')`, the
   * `count_open_cases_for_board` predicate. `openCases <= totalCases`. */
  openCases: number
  /**
   * `explicit_grants_only` cases the reviewer CANNOT read (D6): a PHI-free
   * COUNT is the only oversight awareness of the locked population. Never a
   * list, never ids.
   */
  lockedCases: number
}

interface BoardSummaryRowJson {
  commission_id: string
  commission_name: string
  commission_slug: string
  hospital_id: string
  hospital_name: string
  total_cases: number
  open_cases: number
  locked_cases: number
}

/**
 * The cross-committee board summary for one organization: one row per
 * oversight-VISIBLE commission of each hospital the caller reviews there.
 *
 * Returns `[]` both for "no visible commissions" and for a denied caller (the
 * door raises 42501 for a non-reviewer/cross-org/expired caller — mapped to the
 * empty board here; console ENTRY is decided by `getQualidadeAccessByOrg`, and
 * an empty board page is the correct render for a race between the two).
 */
export async function getQualityBoardSummary(
  organizationId: string,
): Promise<QualityBoardCommission[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('quality_board_summary', {
    p_organization_id: organizationId,
  })

  if (error || !data) return []

  return (data as BoardSummaryRowJson[]).map((r) => ({
    commissionId: r.commission_id,
    commissionName: r.commission_name,
    commissionSlug: r.commission_slug,
    hospitalId: r.hospital_id,
    hospitalName: r.hospital_name,
    totalCases: r.total_cases,
    openCases: r.open_cases,
    lockedCases: r.locked_cases,
  }))
}

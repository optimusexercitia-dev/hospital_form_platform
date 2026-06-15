import { createClient } from '@/lib/supabase/server'
import type { CaseStatusColorToken } from '@/lib/cases/case-status'

/**
 * Case TAGGING data-access (Cases-Extras batch, R3) — a controlled per-commission
 * vocabulary so yearly/trend aggregation stays clean (Architecture Rule 9).
 *
 *   - `case_tags` — the commission's tag vocabulary (`unique(commission_id,
 *     name)`, colour token, archivable).
 *   - `case_tag_assignments` — the (case, tag) join; a BEFORE INSERT guard
 *     asserts the tag and case share a commission (HC026).
 *
 * RLS member-read / staff_admin-write on both. The reporting read
 * `case_tag_report` mirrors the dashboard aggregation pattern (SECURITY DEFINER
 * + internal `is_staff_admin_of` gate + optional date window over
 * `cases.created_at::date`). Reuses the status palette token type for badges.
 */

/** Tag badge colour token (shares the constrained status palette). */
export type CaseTagColorToken = CaseStatusColorToken

/** One tag in a commission's vocabulary. */
export interface CaseTag {
  id: string
  commissionId: string
  /** pt-BR name (unique per commission). */
  name: string
  colorToken: CaseTagColorToken
  archived: boolean
  createdAt: string
}

/** A `{ from, to }` inclusive date window (ISO `YYYY-MM-DD`); omit for all-time. */
export interface DateRange {
  from?: string
  to?: string
}

/** One row of the tag report: a tag + how many cases carry it in the window. */
export interface CaseTagReportRow {
  tagId: string
  name: string
  colorToken: CaseTagColorToken
  /** Count of cases assigned this tag whose `created_at` falls in the window. */
  caseCount: number
}

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

interface CaseTagRow {
  id: string
  commission_id: string
  name: string
  color_token: CaseTagColorToken
  archived: boolean
  created_at: string
}

function mapTag(r: CaseTagRow): CaseTag {
  return {
    id: r.id,
    commissionId: r.commission_id,
    name: r.name,
    colorToken: r.color_token,
    archived: r.archived,
    createdAt: r.created_at,
  }
}

interface TagReportRow {
  tag_id: string
  name: string
  color_token: CaseTagColorToken
  case_count: number
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * The commission's NON-archived tag vocabulary (the picker options), ordered by
 * `name`. RLS-scoped (members read); `[]` when unreadable.
 */
export async function listCaseTags(commissionId: string): Promise<CaseTag[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_tags')
    .select('id, commission_id, name, color_token, archived, created_at')
    .eq('commission_id', commissionId)
    .eq('archived', false)
    .order('name', { ascending: true })
    .returns<CaseTagRow[]>()

  if (error || !data) return []
  return data.map(mapTag)
}

/**
 * The tags assigned to a single case (the case-detail chip panel), ordered by
 * `name`. RLS-scoped; `[]` when unreadable. Archived tags still already assigned
 * to the case ARE shown (so the chip doesn't vanish when a tag is retired).
 */
export async function listCaseTagsForCase(caseId: string): Promise<CaseTag[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_tag_assignments')
    .select(
      'case_tags ( id, commission_id, name, color_token, archived, created_at )',
    )
    .eq('case_id', caseId)
    .returns<{ case_tags: CaseTagRow | null }[]>()

  if (error || !data) return []
  return data
    .map((r) => r.case_tags)
    .filter((t): t is CaseTagRow => t != null)
    .map(mapTag)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

/**
 * Per-tag case counts for a commission over an optional date window (the
 * dashboard tag-report card). Backed by the SECURITY DEFINER `case_tag_report`,
 * internally `is_staff_admin_of`-gated, bounded on `cases.created_at::date` when
 * a range is given. Returns `[]` for a non-staff_admin (no leak).
 */
export async function getCaseTagReport(
  commissionId: string,
  range?: DateRange,
): Promise<CaseTagReportRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('case_tag_report', {
    p_commission_id: commissionId,
    p_from: range?.from ?? undefined,
    p_to: range?.to ?? undefined,
  })

  if (error || !data) return []

  return (data as unknown as TagReportRow[]).map((r) => ({
    tagId: r.tag_id,
    name: r.name,
    colorToken: r.color_token,
    caseCount: Number(r.case_count),
  }))
}

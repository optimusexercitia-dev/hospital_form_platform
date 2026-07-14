import { createClient } from '@/lib/supabase/server'
import { featureEnabled } from '@/lib/queries/feature-flags'

/**
 * "Meus itens de ação" data-access (Architecture Rule 9 — all reads go through
 * `src/lib/queries/`). Backs the current user's unified action-item list at
 * `/o/[org]/c/[commission]/` — a read-only union of the items ASSIGNED TO the
 * caller across these sources — ALL now on the shared `action_items` hub,
 * discriminated by `source_type`:
 *   - `source_type='case'`             (gated by the `cases_extras` flag)
 *   - `source_type in (meeting,manual)` (gated by the `action_items` flag)
 *
 * CAPA action items are intentionally NOT included (they live under the NSP/PHI
 * safeguards and are surfaced elsewhere). A source whose feature flag is OFF is
 * simply OMITTED from the union — never an error.
 *
 * Backed by the SECURITY DEFINER `list_my_action_items(p_commission)`, which
 * self-scopes with an explicit `assigned_to = auth.uid()` predicate on each
 * source and joins the parent case/meeting for PHI-free LABEL columns only
 * (case number/label, meeting number/scheduled_start, creator display name) —
 * so every returned row is the caller's own assigned item and no answers /
 * free-text / PHI are exposed. This is a read of the caller's OWN work
 * (self-scoped), so no audit row is emitted (Rule 11).
 *
 * The list returns ALL statuses; the page default-filters to active
 * (open + in_progress) with a toggle for done/cancelled, offers a source-type
 * filter, and sorts by due date (overdue first, nulls last) — all client-side.
 * All user-facing strings are the caller's (pt-BR).
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/**
 * Which source a unified action item came from. All three (`case`, `meeting`,
 * `manual`) are rows of the shared `action_items` hub, discriminated by its
 * `source_type`.
 */
export type ActionItemSource = 'case' | 'meeting' | 'manual'

/** Shared lifecycle status (the hub status KEY). */
export type MyActionItemStatus = 'open' | 'in_progress' | 'done' | 'cancelled'

/**
 * Per-row read scope of a shared `action_items` hub row (ADR 0050). `committee`
 * (flat membership — the default), `case_restricted` (follows `app.can_read_case`
 * on `coalesce(source_case_id, case_id)`), or `assignees_only` (active assignment /
 * `assigned_to`, plus staff_admin/org_admin). Exported once here and reused across
 * the action-item query modules (`case-action-items`, the three satellites).
 */
export type VisibilityScope = 'committee' | 'case_restricted' | 'assignees_only'

/**
 * One action item ASSIGNED TO the current user, unified across the case +
 * meeting sources. Read-only. `dueDate` is a DATE (`YYYY-MM-DD`) on both source
 * tables. Carries enough per row for the client to build a link to the source
 * detail page and render an "Atribuído por" label, an inline preview, and the
 * default filter/sort.
 */
export interface MyActionItem {
  /** Stable, source-unique row id (the underlying `*_action_items` PK). */
  id: string
  source: ActionItemSource
  title: string
  /** Inline-preview body; `null` if none. */
  description: string | null
  status: MyActionItemStatus
  /** Per-row read scope (ADR 0050); drives the visibility badge (§4.6). */
  visibilityScope: VisibilityScope
  /**
   * ISO `YYYY-MM-DD`; `null` = no deadline. A past date on an active item
   * (`open`/`in_progress`) is overdue — computed client-side.
   */
  dueDate: string | null
  createdAt: string
  /** "Atribuído por" — the creator's display name; `null` if unresolved/system. */
  createdByName: string | null

  // --- link + label material for the source detail page ---
  /** The `case_id`, when `source === 'case'`; else `null`. */
  caseId: string | null
  /** The case's per-commission counter ("Caso 0042"); `null` for meeting rows. */
  caseNumber: number | null
  /** The case's NON-IDENTIFYING label; `null` if none / meeting row. */
  caseLabel: string | null
  /** The `meeting_id`, when `source === 'meeting'`; else `null`. */
  meetingId: string | null
  /** The meeting's per-commission counter ("Reunião 0007"); `null` for case rows. */
  meetingNumber: number | null
  /** The meeting's planned start (ISO timestamp) for the label; `null` for case rows. */
  meetingScheduledStart: string | null
}

// ---------------------------------------------------------------------------
// RPC row shape
// ---------------------------------------------------------------------------

/** One element of the `list_my_action_items` jsonb array (snake_case). */
interface MyActionItemJson {
  id: string
  source: ActionItemSource
  title: string
  description: string | null
  status: MyActionItemStatus
  visibility_scope: VisibilityScope
  due_date: string | null
  created_at: string
  created_by_name: string | null
  case_id: string | null
  case_number: number | null
  case_label: string | null
  meeting_id: string | null
  meeting_number: number | null
  meeting_scheduled_start: string | null
}

// ---------------------------------------------------------------------------
// Feature-flag reader
// ---------------------------------------------------------------------------

/**
 * Whether the shared `action_items` feature flag is ON (probes the public
 * `action_items_enabled` flag-reader RPC; mirrors `casesExtrasEnabled` /
 * `meetingsEnabled`). Gates the shared action-items surface — e.g. the sidebar
 * "Meus itens de ação" item. `false` on any error (fail-closed).
 */
export async function actionItemsEnabled(): Promise<boolean> {
  // P4 (WS-6): delegate to the consolidated, request-memoized flag read.
  return featureEnabled('action_items')
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * The current user's action items across the case + shared (meeting|manual)
 * sources for one commission (`assigned_to = auth.uid()`), ALL statuses. A source
 * whose feature flag is OFF is omitted from the union (never an error). Ordered
 * by the RPC (due_date asc, nulls last, then created_at desc) as a stable
 * default; the page re-sorts/filters client-side. Returns `[]` when
 * unauthenticated or nothing is assigned.
 */
export async function listMyActionItems(
  commissionId: string,
): Promise<MyActionItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('list_my_action_items', {
    p_commission: commissionId,
  })

  if (error || !data) return []

  return (data as unknown as MyActionItemJson[]).map((r) => ({
    id: r.id,
    source: r.source,
    title: r.title,
    description: r.description,
    status: r.status,
    visibilityScope: r.visibility_scope,
    dueDate: r.due_date,
    createdAt: r.created_at,
    createdByName: r.created_by_name,
    caseId: r.case_id,
    caseNumber: r.case_number,
    caseLabel: r.case_label,
    meetingId: r.meeting_id,
    meetingNumber: r.meeting_number,
    meetingScheduledStart: r.meeting_scheduled_start,
  }))
}

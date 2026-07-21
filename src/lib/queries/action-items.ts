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
 * on `coalesce(source_case_id, linked_case_id)`), or `assignees_only` (active assignment /
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

/**
 * ONE action item, with everything an Action Item DETAIL page header needs.
 * Case + meeting + manual items are all rows of the shared `action_items` hub and
 * `id` is a globally unique uuid, so this ONE getter serves all three sources —
 * {@link ActionItemDetail.source} discriminates.
 *
 * PHI-free: the parent case/meeting contribute only NON-identifying label columns
 * (number / label / scheduled_start), never answers or clinical free-text. This is
 * a read of a committee-scoped governance row (RLS-scoped, not another member's
 * PHI), so no audit row is emitted (Rule 11).
 */
export interface ActionItemDetail {
  id: string
  /** Which parent minted the item — drives the "voltar para" link + header label. */
  source: ActionItemSource
  title: string
  description: string | null
  /** The status KEY (stable, code-facing): `open` | `in_progress` | `done` | `cancelled`. */
  status: MyActionItemStatus
  /** The status LABEL (pt-BR, tenant-editable catalog text) — render THIS, not the key. */
  statusLabel: string
  /** `true` when the status is a terminal one (`done`/`cancelled`) per the catalog. */
  statusIsTerminal: boolean
  /** Per-row read scope (ADR 0050); drives the visibility badge. */
  visibilityScope: VisibilityScope
  /** `null` when the item is unassigned. */
  assigneeId: string | null
  /** The assignee's display name; `null` when unassigned / unresolved. */
  assigneeName: string | null
  /** ISO `YYYY-MM-DD`; `null` = no deadline. */
  dueDate: string | null
  /** ISO timestamp of completion; `null` while not completed. */
  completedAt: string | null
  createdAt: string
  /** "Criado por" — the creator's display name; `null` if unresolved/system. */
  createdByName: string | null

  // --- parent ids, so the page can link back ---
  /** ALWAYS set — the owning commission, for building the `/o/[org]/c/[commission]` href. */
  commissionId: string
  /** The parent case id when `source === 'case'`; else `null`. */
  caseId: string | null
  /** The case's per-commission counter ("Caso 0042"); `null` unless a case item. */
  caseNumber: number | null
  /** The case's NON-IDENTIFYING label; `null` if none / not a case item. */
  caseLabel: string | null
  /** The parent meeting id when `source === 'meeting'`; else `null`. */
  meetingId: string | null
  /** The meeting's per-commission counter ("Reunião 0007"); `null` unless a meeting item. */
  meetingNumber: number | null
  /** The meeting's planned start (ISO); `null` unless a meeting item. */
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

/** The FK-hinted embed row for {@link getActionItem}. */
interface ActionItemDetailRow {
  id: string
  source_type: ActionItemSource
  title: string
  description: string | null
  visibility_scope: VisibilityScope
  due_date: string | null
  completed_at: string | null
  created_at: string
  commission_id: string
  assigned_to: string | null
  linked_case_id: string | null
  source_case_id: string | null
  source_meeting_id: string | null
  status: { key: MyActionItemStatus; label: string; is_terminal: boolean } | null
  assignee: { id: string; full_name: string | null } | null
  author: { full_name: string | null } | null
  source_case: { case_number: number | null; label: string | null } | null
  case_ref: { case_number: number | null; label: string | null } | null
  meeting: { meeting_number: number | null; scheduled_start: string | null } | null
}

/**
 * ONE action item by id — the Action Item DETAIL page's header read. Serves all
 * three sources (`case` | `meeting` | `manual`): they share the `action_items` hub
 * and `id` is a globally unique uuid.
 *
 * RLS is the authority — `action_items_select` enforces the per-row
 * `visibility_scope` (committee / case_restricted / assignees_only), so an
 * unreadable item simply returns no row. Returns `null` (never throws) when the
 * item is absent OR unreadable, so the page can `notFound()` — deliberately
 * indistinguishable, so a 404-vs-403 does not leak the item's existence.
 *
 * Every `profiles` embed is FK-HINTED: `action_items` has THREE FKs to `profiles`
 * (assigned_to / created_by / completed_by) and two to `cases` (linked_case_id /
 * source_case_id), so an un-hinted embed would fail with PGRST201 (ambiguous).
 */
export async function getActionItem(
  actionItemId: string,
): Promise<ActionItemDetail | null> {
  if (!actionItemId) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('action_items')
    .select(
      `id, source_type, title, description, visibility_scope, due_date,
       completed_at, created_at, commission_id, assigned_to, linked_case_id,
       source_case_id, source_meeting_id,
       status:action_item_statuses!action_items_status_fkey(key, label, is_terminal),
       assignee:profiles!action_items_assigned_to_fkey(id, full_name),
       author:profiles!action_items_created_by_fkey(full_name),
       source_case:cases!action_items_source_case_fkey(case_number, label),
       case_ref:cases!action_items_linked_case_fkey(case_number, label),
       meeting:meetings!action_items_source_meeting_fkey(meeting_number, scheduled_start)`,
    )
    .eq('id', actionItemId)
    .maybeSingle<ActionItemDetailRow>()

  if (error) {
    // A swallowed error here would render "não encontrado" for what is really a
    // broken query (e.g. PGRST204 after a migration) — log it, then fail closed.
    console.error('[getActionItem] query failed', {
      actionItemId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    return null
  }
  if (!data) return null

  // The hub's shape CHECK pins a case item to `source_case_id` (provenance), but
  // `linked_case_id` is the optional meeting/manual → case cross-link (association)
  // some rows carry — coalesce, exactly as the `action_items_select` RLS policy does.
  const parentCase = data.source_case ?? data.case_ref
  const caseId = data.source_case_id ?? data.linked_case_id

  return {
    id: data.id,
    source: data.source_type,
    title: data.title,
    description: data.description,
    status: data.status?.key ?? 'open',
    statusLabel: data.status?.label ?? '',
    statusIsTerminal: data.status?.is_terminal ?? false,
    visibilityScope: data.visibility_scope,
    assigneeId: data.assigned_to,
    assigneeName: data.assignee?.full_name ?? null,
    dueDate: data.due_date,
    completedAt: data.completed_at,
    createdAt: data.created_at,
    createdByName: data.author?.full_name ?? null,
    commissionId: data.commission_id,
    caseId,
    caseNumber: parentCase?.case_number ?? null,
    caseLabel: parentCase?.label ?? null,
    meetingId: data.source_meeting_id,
    meetingNumber: data.meeting?.meeting_number ?? null,
    meetingScheduledStart: data.meeting?.scheduled_start ?? null,
  }
}

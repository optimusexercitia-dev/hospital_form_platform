import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'
import { featureEnabled } from '@/lib/queries/feature-flags'

/**
 * DSR ("Direitos do Titular") typed reads — Architecture Rule 9 (all data access
 * through `src/lib/queries/`, never inline supabase-js).
 *
 * ⚠ THE BOUNDARY IS RLS, NOT THIS FILE. `dsr_requests` is readable only by the
 * hospital's Encarregado; `dsr_tasks` additionally by whoever holds a qualifying
 * hat in the task's routing scope (`app.can_execute_dsr_task`). Neither policy
 * has a platform-admin arm — ADR 0130 Decision 2 puts platform_admin outside this
 * plane entirely (the ADR-0078 A35 noun rule). Every read below therefore returns
 * "what this caller may see", and a caller with no standing gets an empty list
 * rather than an error.
 */

export type DsrHospital = {
  hospitalId: string
  hospitalName: string
  orgId: string
  isDpo: boolean
}

export type DsrTaskRow = {
  id: string
  requestId: string
  kind: string
  module: string | null
  entityId: string | null
  commissionId: string | null
  commissionName: string | null
  commissionSlug: string | null
  hospitalId: string
  status: string
  note: string | null
  completedAt: string | null
  createdAt: string
  /**
   * Whether the caller may ACT on this task, not merely see it. The Encarregado
   * sees every task of their hospital (they must watch the work) and can execute
   * none of them — the disposal doors are the executors'. An affordance flag, NOT
   * a boundary: the door refuses regardless of what the UI renders.
   */
  canExecute: boolean
}

export type DsrRequestRow = {
  id: string
  hospitalId: string
  fileRef: string
  status: string
  outcome: string | null
  outcomeBasis: string | null
  legalConsultationRef: string | null
  receivedAt: string
  dueDate: string
  closedAt: string | null
  pendingTasks: number
  totalTasks: number
}

export async function dsrEnabled(): Promise<boolean> {
  return featureEnabled('dsr')
}

/**
 * The hospitals this caller reaches in the DSR console — the Encarregado office
 * they hold, plus any hospital where a task is routed to them.
 *
 * Backed by the `list_my_dsr_hospitals()` DEFINER lister rather than a read of
 * `public.hospitals`: that table's SELECT policy admits only platform/org/hospital
 * admins, nsp_org_admin and quality_reviewer, and the Encarregado is typically a
 * plain commission member. Same reason `list_my_nsp_hospitals` exists (ADR 0052).
 * Safe-defaults to `[]` — this is called at layout render time and must not throw.
 */
export const listMyDsrHospitals = cache(async (): Promise<DsrHospital[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_my_dsr_hospitals')
  if (error || !Array.isArray(data)) return []
  return data as unknown as DsrHospital[]
})

/**
 * The caller's task inbox for one hospital, pending first then most recent.
 *
 * The embedded `commissions(name, slug)` is a NULLABLE convenience: every
 * principal `app.can_execute_dsr_task` admits can also read the matching
 * `commissions` row (measured against `commissions_select_member_or_admin` —
 * member / org_admin / hospital_admin / pqs_operator all appear in both), but a
 * DPO who is a plain member of a DIFFERENT commission cannot, and gets null. The
 * UI renders the fallback rather than hiding the task: the task is the caller's
 * work either way.
 */
export async function listMyDsrTasks(hospitalId: string): Promise<DsrTaskRow[]> {
  const supabase = await createClient()
  const [{ data, error }, executable] = await Promise.all([
    supabase
      .from('dsr_tasks')
      .select(
        'id, request_id, kind, module, entity_id, commission_id, hospital_id, status, note, completed_at, created_at, commissions(name, slug)',
      )
      .eq('hospital_id', hospitalId)
      .order('status', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase.rpc('list_my_executable_dsr_tasks', { p_hospital_id: hospitalId }),
  ])

  if (error || !data) return []

  const canExecute = new Set(
    Array.isArray(executable.data) ? (executable.data as string[]) : [],
  )

  return data.map((row) => {
    const commission = row.commissions as { name: string; slug: string } | null
    return {
      id: row.id,
      requestId: row.request_id,
      kind: row.kind,
      module: row.module,
      entityId: row.entity_id,
      commissionId: row.commission_id,
      commissionName: commission?.name ?? null,
      commissionSlug: commission?.slug ?? null,
      hospitalId: row.hospital_id,
      status: row.status,
      note: row.note,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      canExecute: canExecute.has(row.id),
    }
  })
}

/**
 * The requests of one hospital — Encarregado-only by RLS, so a non-DPO caller
 * gets `[]` without an error. Task counts come from a second scoped read rather
 * than an aggregate embed, because the counts must respect the SAME policy.
 */
export async function listDsrRequests(
  hospitalId: string,
): Promise<DsrRequestRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dsr_requests')
    .select(
      'id, hospital_id, file_ref, status, outcome, outcome_basis, legal_consultation_ref, received_at, due_date, closed_at',
    )
    .eq('hospital_id', hospitalId)
    .order('received_at', { ascending: false })

  if (error || !data || data.length === 0) return []

  const { data: taskRows } = await supabase
    .from('dsr_tasks')
    .select('request_id, status')
    .in(
      'request_id',
      data.map((r) => r.id),
    )

  const counts = new Map<string, { pending: number; total: number }>()
  for (const t of taskRows ?? []) {
    const c = counts.get(t.request_id) ?? { pending: 0, total: 0 }
    c.total += 1
    if (t.status === 'pending') c.pending += 1
    counts.set(t.request_id, c)
  }

  return data.map((row) => ({
    id: row.id,
    hospitalId: row.hospital_id,
    fileRef: row.file_ref,
    status: row.status,
    outcome: row.outcome,
    outcomeBasis: row.outcome_basis,
    legalConsultationRef: row.legal_consultation_ref,
    receivedAt: row.received_at,
    dueDate: row.due_date,
    closedAt: row.closed_at,
    pendingTasks: counts.get(row.id)?.pending ?? 0,
    totalTasks: counts.get(row.id)?.total ?? 0,
  }))
}

import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'
import { featureEnabled } from '@/lib/queries/feature-flags'
import { searchPatientForHospital } from '@/lib/queries/patient-index'
import type { PatientSearchResult } from '@/lib/patient-index/types'
import { DSR_RESIDUE_NOTICE } from '@/lib/dsr/messages'

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

export type DsrOutcome =
  | 'granted'
  | 'granted_partial'
  | 'refused_retention'
  | 'refused_identity'
  | 'withdrawn'

export type DsrRequestStatus = 'open' | 'adjudicated' | 'executing' | 'closed'

export type DsrTaskKind =
  | 'dispose_case'
  | 'dispose_event'
  | 'dispose_referral'
  | 'dispose_meeting'
  | 'attest_review'
  | 'notify_scrub_check'

export type DsrTaskStatus = 'pending' | 'done' | 'blocked'

export type DsrModule = 'case' | 'event' | 'referral' | 'meeting'

export type DsrHospital = {
  hospitalId: string
  hospitalName: string
  orgId: string
  isDpo: boolean
}

export type DsrTaskRow = {
  id: string
  requestId: string
  kind: DsrTaskKind
  module: DsrModule | null
  entityId: string | null
  commissionId: string | null
  commissionName: string | null
  commissionSlug: string | null
  hospitalId: string
  status: DsrTaskStatus
  /**
   * The minted PROCEDURE text. Slice 3 stops `complete_dsr_task` overwriting it
   * with the completion note — an attestation task whose procedure vanished the
   * moment it was completed could not document the corridor it exists to document.
   */
  note: string | null
  /**
   * What the human wrote on completion, for ANY kind.
   *
   * ⚠ RENAMED from the B0 contract's `attestationNote`: the column is
   * `completion_note` and carries the executor's statement on a disposal or
   * residue task too, so an "attestation" name would be false on five of the six
   * kinds. `note` (the procedure) and this (the statement) are now two columns
   * because `complete_dsr_task` used to overwrite the first with the second.
   */
  completionNote: string | null
  /** Attested tier (ADR 0130 Decision 6) — null on every non-attestation task. */
  attestedByName: string | null
  attestedRedactions: number | null
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
  status: DsrRequestStatus
  outcome: DsrOutcome | null
  outcomeBasis: string | null
  legalConsultationRef: string | null
  receivedAt: string
  dueDate: string
  /** Slice 3 — when the DPO recorded the decision. Null until adjudicated. */
  adjudicatedAt: string | null
  closedAt: string | null
  /**
   * ⛔ FOUR COUNTS, EACH COUNTED FROM ROWS. None is derived from the others.
   *
   * The console card used to render `totalTasks - pendingTasks` as "concluídas",
   * which put a RETIRED task into the done bucket by subtraction: after a
   * `refused_retention` close on the six-task fan-out it read **"6/6 tarefas
   * concluídas"** beside the badge "Recusada — retenção" — asserting six PHI
   * erasures were carried out when ZERO were, and contradicting the detail page's
   * "Retirados pela decisão: 6" one click away. That is the over-claim family this
   * whole program exists to end (`FUP-DISPOSE-DIALOG-OVERCLAIM`, ADR 0056).
   *
   * ⚠ AND THE INSTRUMENT, NOT ONLY THE VALUE. A two-part subtraction is an
   * IDENTITY — it can never disagree with itself, so no assertion over it can
   * fail. Counting each status separately is what makes
   * `pending + done + retired === total` a real check rather than a tautology.
   * Same reasoning as `attested.pending` on {@link DsrOutcomeRecord}.
   */
  pendingTasks: number
  doneTasks: number
  retiredTasks: number
  totalTasks: number
}

/**
 * ⭐ THE TWO-TIER OUTCOME RECORD (ADR 0130 Decision 6). The honest claim is two
 * tiers, and this type is what makes the record state it rather than imply it:
 *
 * · `mechanical` — what `patient_xref` found and the disposal doors erased. The
 *   platform knows these exactly.
 * · `attested` — what a NAMED HUMAN reviewed in free-text prose, with the count of
 *   mentions they removed. `patient_xref` structurally cannot find a name typed
 *   into prose; no refactor changes that, so this tier is a person's statement and
 *   is reported as one, with their name attached.
 * · `residue` — the FIXED language of ADR 0130 Decision 9. Never improvised.
 */
export type DsrOutcomeRecord = {
  requestId: string
  hospitalId: string
  fileRef: string
  status: DsrRequestStatus
  outcome: DsrOutcome | null
  outcomeBasis: string | null
  legalConsultationRef: string | null
  receivedAt: string
  dueDate: string
  adjudicatedAt: string | null
  closedAt: string | null
  /**
   * ⚠ THE PARTS MUST SUM: `total === disposed + pending + retired`. `retired` was
   * added when `close_dsr_request` began writing `blocked` — before it, a retired
   * task counted as neither disposed nor pending and `total` silently stopped
   * equalling its parts, in the one artifact that must not make false claims.
   * A closed refusal reporting "0 pendentes" with no `retired` reads as completion.
   */
  mechanical: {
    total: number
    disposed: number
    pending: number
    retired: number
  }
  attested: {
    total: number
    completed: number
    /**
     * Retired by the recorded decision — the review was withdrawn, not skipped.
     * ⚠ TWO CAUSES, deliberately not distinguished here: a non-granting close
     * retires everything outstanding, and an escalated meeting disposal retires
     * that meeting's own attestation (reviewing prose in an ata about to be erased
     * wholesale is moot). `dsr_tasks` cannot tell them apart — naming either cause
     * from this number alone is false half the time.
     */
    retired: number
    /**
     * ⚠ COMPUTED INDEPENDENTLY, not derived as `total - completed - retired`.
     * That is the whole reason it exists: a consumer checking
     * `completed + retired + pending === total` over a pending value that was
     * itself the remainder **can never fail** — it is an identity, not an
     * assertion. Counting the rows separately makes the sum falsifiable, which is
     * what lets the UI hold both tiers to the same exact-sum check.
     */
    pending: number
    redactions: number
    reviewers: string[]
  }
  residue: readonly string[]
}

/**
 * A meeting the DPO may ESCALATE to full minutes disposal at adjudication.
 *
 * ⛔ The escalation is per-meeting and EXPLICIT by construction (ADR 0130
 * Amendment 2 item 3): `dispose_meeting_minutes` erases the WHOLE minutes — the
 * minutes text plus every agenda item's description/discussion notes/resolution —
 * so firing it because one agenda item touched the subject's case would destroy
 * other committees' records. Only a human adjudication may escalate, and only a
 * meeting already enumerated on THIS request is offered.
 *
 * ⛔ NO `taskId` FIELD, and that is load-bearing (BUG-DSR-S3-001). It carried one;
 * the adjudication panel posted it to `adjudicate_dsr_request`, which validates
 * MEETING ids, so the door correctly refused (HCDS2) and the escalation silently
 * never happened. Two same-typed uuids in one shape where the caller needs exactly
 * one is a defect generator — and it was wrong-grain anyway: it was the
 * `attest_review` task's id, which is neither the `dispose_meeting` task nor
 * anything an adjudicating caller acts on. Removed from the RPC's jsonb in the
 * same change so the two cannot drift (350 t62 pins the key list).
 */
export type DsrDisposableMeeting = {
  meetingId: string
  commissionId: string | null
  commissionName: string | null
  label: string
  alreadyDisposed: boolean
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
 * ⛔ COMMISSION NAMES COME FROM A DEFINER LISTER, NOT AN EMBED (BUG-DSR-S3-002).
 * The embedded `commissions(name, slug)` this used to carry is RLS-filtered, and
 * the docblock that stood here claimed "every principal `app.can_execute_dsr_task`
 * admits can also read the matching `commissions` row … but a DPO who is a plain
 * member of a DIFFERENT commission cannot, and gets null", filed as a NULLABLE
 * CONVENIENCE. It was not a convenience. The Encarregado is a plain member of ONE
 * commission BY DESIGN (ADR 0130 Decision 2), so the sibling-commission
 * attestation — the task whose whole procedure reads "review THIS COMMISSION's
 * free text" — rendered "Comissão fora do seu acesso". An attestation against a
 * scope the attester cannot see is a NOMINAL one, and the outcome record reports
 * it to the data subject as coverage.
 *
 * `list_my_dsr_task_commissions` names only the commissions of tasks this caller
 * can already see (same predicate as `dsr_tasks_select`); `commissions`' read
 * boundary does not move. 350 t57–t60, including the differential that reds if the
 * copied predicate ever drifts from the policy.
 */
export async function listMyDsrTasks(hospitalId: string): Promise<DsrTaskRow[]> {
  const supabase = await createClient()
  const [{ data, error }, executable, commissions] = await Promise.all([
    supabase
      .from('dsr_tasks')
      .select(
        // ⚠ `.select()` IS A STRING and the row type is an ASSERTION — a field
        // declared on DsrTaskRow but missing here typechecks clean and arrives
        // `undefined` at runtime (the "green bar misses the wired seam" family).
        // Every field of DsrTaskRow appears below.
        'id, request_id, kind, module, entity_id, commission_id, hospital_id, status, note, completion_note, attested_by_name, attested_redactions, completed_at, created_at',
      )
      .eq('hospital_id', hospitalId)
      .order('status', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase.rpc('list_my_executable_dsr_tasks', { p_hospital_id: hospitalId }),
    supabase.rpc('list_my_dsr_task_commissions', { p_hospital_id: hospitalId }),
  ])

  if (error || !data) return []

  const canExecute = new Set(
    Array.isArray(executable.data) ? (executable.data as string[]) : [],
  )

  const commissionById = new Map<string, { name: string; slug: string }>()
  if (Array.isArray(commissions.data)) {
    for (const c of commissions.data as unknown as {
      commissionId: string
      name: string
      slug: string
    }[]) {
      commissionById.set(c.commissionId, { name: c.name, slug: c.slug })
    }
  }

  return data.map((row) => {
    const commission = row.commission_id
      ? (commissionById.get(row.commission_id) ?? null)
      : null
    return {
      id: row.id,
      requestId: row.request_id,
      kind: row.kind as DsrTaskKind,
      module: row.module as DsrModule | null,
      entityId: row.entity_id,
      commissionId: row.commission_id,
      commissionName: commission?.name ?? null,
      commissionSlug: commission?.slug ?? null,
      hospitalId: row.hospital_id,
      status: row.status as DsrTaskStatus,
      note: row.note,
      completionNote: row.completion_note,
      attestedByName: row.attested_by_name,
      attestedRedactions: row.attested_redactions,
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
      // Every field of DsrRequestRow — see the note on listMyDsrTasks's select.
      'id, hospital_id, file_ref, status, outcome, outcome_basis, legal_consultation_ref, received_at, due_date, adjudicated_at, closed_at',
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

  // ⛔ Each bucket counted from rows; NOTHING derived by subtraction. See the
  // note on DsrRequestRow — the subtraction is what silently reclassified a
  // retired task as a completed one.
  const zero = () => ({ pending: 0, done: 0, retired: 0, total: 0 })
  const counts = new Map<string, ReturnType<typeof zero>>()
  for (const t of taskRows ?? []) {
    const c = counts.get(t.request_id) ?? zero()
    c.total += 1
    if (t.status === 'pending') c.pending += 1
    else if (t.status === 'done') c.done += 1
    else if (t.status === 'blocked') c.retired += 1
    counts.set(t.request_id, c)
  }

  return data.map((row) => ({
    id: row.id,
    hospitalId: row.hospital_id,
    fileRef: row.file_ref,
    status: row.status as DsrRequestStatus,
    outcome: row.outcome as DsrOutcome | null,
    outcomeBasis: row.outcome_basis,
    legalConsultationRef: row.legal_consultation_ref,
    receivedAt: row.received_at,
    dueDate: row.due_date,
    adjudicatedAt: row.adjudicated_at,
    closedAt: row.closed_at,
    pendingTasks: counts.get(row.id)?.pending ?? 0,
    doneTasks: counts.get(row.id)?.done ?? 0,
    retiredTasks: counts.get(row.id)?.retired ?? 0,
    totalTasks: counts.get(row.id)?.total ?? 0,
  }))
}

// ===========================================================================
// Slice 3 — the DPO lane: discovery, the outcome record, meeting escalation.
// ===========================================================================

/**
 * Discovery for the intake form: exact hashed MRN / encounter, hospital-scoped.
 *
 * Delegates to {@link searchPatientForHospital}, which routes through the
 * `search_patient_xref` DEFINER door. Slice 3 widens that door's gate by exactly
 * one arm — `app.is_pqs_operator_of(h) OR app.is_dpo_of(h)` — the ONLY
 * authorization gate this whole program changes (ADR 0130 Decision 3). Everything
 * else about the door is unchanged: exact hashed match only (no name, no
 * substring, no browse), hospital-scoped SILENTLY (Decision 4 — a cross-hospital
 * hint is itself the inference isolation prevents), and audited on ≥ 1 match.
 *
 * Re-exported under a DSR name so the console imports one module; the underlying
 * result type is shared with the QPS console.
 */
export async function searchDsrSubject(
  hospitalId: string,
  mrn: string | null,
  encounter: string | null,
): Promise<PatientSearchResult | null> {
  return searchPatientForHospital(hospitalId, mrn, encounter)
}

/**
 * The two-tier outcome record for one request — what the hospital can honestly
 * tell the data subject it did.
 *
 * ⭐ THE GATE IS **RLS**, NOT A DEFINER FUNCTION. This is two ordinary PostgREST
 * reads of `dsr_requests` and `dsr_tasks`; the boundary is the
 * `dsr_requests_select` policy (`app.is_dpo_of(hospital_id)`) and
 * `dsr_tasks_select` (`app.is_dpo_of(hospital_id) OR
 * app.can_execute_dsr_task(...)`). Nothing here is `prosecdef`, so RLS is NOT
 * bypassed and the security claim is a claim about those two policies. (Named
 * explicitly because the DEFINER-vs-RLS confusion is BUG-AUTHZ-001's exact shape:
 * a DEFINER's gate REPLACES RLS, and a claim about the wrong one is worthless.)
 *
 * A non-DPO therefore gets zero rows and this returns `null` — not an error, and
 * not a distinguishable refusal.
 */
export async function getDsrOutcomeRecord(
  requestId: string,
): Promise<DsrOutcomeRecord | null> {
  const supabase = await createClient()
  const { data: request, error } = await supabase
    .from('dsr_requests')
    .select(
      'id, hospital_id, file_ref, status, outcome, outcome_basis, legal_consultation_ref, received_at, due_date, adjudicated_at, closed_at',
    )
    .eq('id', requestId)
    .maybeSingle()

  if (error || !request) return null

  const { data: tasks } = await supabase
    .from('dsr_tasks')
    .select('kind, status, attested_by_name, attested_redactions')
    .eq('request_id', requestId)

  const rows = tasks ?? []
  // The mechanical tier is exactly the four disposal kinds. `notify_scrub_check`
  // is neither tier — it is a residue check on the disposals, so counting it as
  // "mechanically disposed" would inflate the number the record reports.
  const mech = rows.filter((t) => t.kind.startsWith('dispose_'))
  const att = rows.filter((t) => t.kind === 'attest_review')
  const attDone = att.filter((t) => t.status === 'done')

  return {
    requestId: request.id,
    hospitalId: request.hospital_id,
    fileRef: request.file_ref,
    status: request.status as DsrRequestStatus,
    outcome: request.outcome as DsrOutcome | null,
    outcomeBasis: request.outcome_basis,
    legalConsultationRef: request.legal_consultation_ref,
    receivedAt: request.received_at,
    dueDate: request.due_date,
    adjudicatedAt: request.adjudicated_at,
    closedAt: request.closed_at,
    mechanical: {
      total: mech.length,
      disposed: mech.filter((t) => t.status === 'done').length,
      pending: mech.filter((t) => t.status === 'pending').length,
      // Retired by the recorded decision. Distinct from `pending` (still asked
      // for) and from `disposed` (carried out) — collapsing it into either is a
      // false claim.
      //
      // ⛔ DO NOT NAME THE CAUSE FROM THIS COUNT, even though today it has exactly
      // ONE writer (a non-granting close — the meeting escalation retires only
      // `attest_review` rows, which land in the ATTESTED tier, never here). That
      // is the state the attested tier's note was in yesterday, and it went false
      // the moment a second writer appeared. A cause that is true-today and
      // one-writer-from-false is not a fact worth rendering.
      //
      // ⚠ An earlier version of this comment claimed TWO causes reach this bucket.
      // Wrong tier — copied from `attested.retired` without re-deriving it. Being
      // wrong in the cautious direction is still wrong.
      retired: mech.filter((t) => t.status === 'blocked').length,
    },
    attested: {
      total: att.length,
      completed: attDone.length,
      retired: att.filter((t) => t.status === 'blocked').length,
      pending: att.filter((t) => t.status === 'pending').length,
      // ⚠ Summed over COMPLETED attestations only. An open task has no count, and
      // `attested_redactions` is null there by CHECK — coalescing that to 0 would
      // report "0 mentions removed" for a review nobody has done yet.
      redactions: attDone.reduce((n, t) => n + (t.attested_redactions ?? 0), 0),
      reviewers: Array.from(
        new Set(
          attDone
            .map((t) => t.attested_by_name?.trim())
            .filter((n): n is string => !!n),
        ),
      ),
    },
    residue: DSR_RESIDUE_NOTICE,
  }
}

/**
 * The meetings this request enumerated that the DPO may escalate to full minutes
 * disposal. Sourced from the request's own `attest_review` meeting tasks — an
 * arbitrary meeting id is not offerable, and `adjudicate_dsr_request` refuses one
 * anyway (HCDS2).
 *
 * ⚠ THE GATE HERE IS THE **DEFINER FUNCTION'S OWN**, not RLS. The Encarregado is a
 * plain member of ONE commission by design, so a meeting in a sibling commission
 * of the same hospital is unreadable to them through `meetings`' policies;
 * `list_dsr_disposable_meetings` is `prosecdef` and its gate — `app.is_dpo_of` of
 * the request's hospital — REPLACES RLS for this read. It returns governance
 * identifiers only (number, date, commission, disposal flag) and never the title
 * or any minutes content.
 */
export async function listDsrDisposableMeetings(
  requestId: string,
): Promise<DsrDisposableMeeting[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_dsr_disposable_meetings', {
    p_request_id: requestId,
  })
  if (error || !Array.isArray(data)) return []
  return data as unknown as DsrDisposableMeeting[]
}

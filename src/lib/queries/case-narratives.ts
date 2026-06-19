import { createClient } from '@/lib/supabase/server'
import type { CaseDetail, CaseNarrative } from '@/lib/queries/cases'

/**
 * Case NARRATIVES data-access (Case Narratives increment; ADR 0032). The
 * unstructured-prose layer of a Case: committees define a per-commission menu of
 * narrative TYPES, interleave narrative SLOTS with phases in a Process, and
 * coordinators author de-identified Markdown prose that renders inline on the
 * case (Architecture Rule 9 — all reads go through `src/lib/queries/`).
 *
 * Three tables mirror the OUTCOMES triad (`@/lib/queries/case-outcomes`):
 *   - `case_narrative_types` — the commission's narrative vocabulary (mirror
 *     `case_outcomes`: `unique(commission_id, label)`, archivable, ordered by
 *     `position`). Library-only — NO per-type colour token. `archived` only (no
 *     `is_active`), matching `case_outcomes`.
 *   - `process_template_narratives` — the per-template SLOTS, each bound to a
 *     narrative type, interleaved with the phase-slots by `display_position`.
 *   - `case_narratives` — the PER-CASE snapshot + content (the analogue of
 *     `case_phases`): `type_label` snapshotted at creation, plus the authored
 *     `body_md` (sanitized Markdown, Rule 7).
 *
 * The interleave (narratives between phases) is RPC-GUARANTEED, not enforced by a
 * cross-table unique: each table carries its own deferrable `unique(parent,
 * display_position)`, and the reorder RPC renumbers BOTH 1..N. The read side must
 * therefore tolerate gaps/duplicates defensively — see {@link mergeCaseLayout}.
 *
 * `body_md` IS returned on the read path (it is de-identified governance prose for
 * the coordinator, consistent with `case_events.body`); only the AUDIT LOG
 * excludes it. Mutations live in `src/lib/case-narratives/actions.ts`. All
 * user-facing strings are the caller's (pt-BR). CONTRACT-FIRST stub module:
 * signatures + domain types are stable; bodies are filled after the migrations.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** One narrative type in a commission's vocabulary (mirror `CaseOutcome`). */
export interface CaseNarrativeType {
  id: string
  commissionId: string
  /** pt-BR label (unique per commission). */
  label: string
  /** Optional longer description shown in the settings manager; `null` if blank. */
  description: string | null
  /**
   * `true` when retired — hidden from the slot picker, but still renders existing
   * template slots / cases (the snapshot keeps `type_label`).
   */
  archived: boolean
  /** 1-based order within the commission's vocabulary (the settings manager). */
  position: number
}

/**
 * One template narrative-SLOT (`process_template_narratives`), carrying the
 * joined LIVE `typeLabel` for the builder (mirror {@link import('@/lib/queries/process-templates').ProcessTemplatePhase}).
 * `displayPosition` interleaves it with the phase-slots; `title` overrides the
 * type label per slot when set, `instructions` is optional authoring guidance.
 */
export interface ProcessTemplateNarrative {
  id: string
  templateId: string
  narrativeTypeId: string
  /** The LIVE label of the bound type (joined for the builder); `null` if unresolved. */
  typeLabel: string | null
  /** Optional per-slot label override (the effective label snapshotted on cases). */
  title: string | null
  /** Optional authoring guidance shown to the coordinator; `null` if blank. */
  instructions: string | null
  /** Advisory close flag (decision 7): a soft warning if left empty at conclude. */
  isExpected: boolean
  /** Interleave order across BOTH phase- and narrative-slots (RPC-guaranteed). */
  displayPosition: number
}

// Re-export the per-case content type, which lives on the Cases module (it is a
// field of `CaseDetail`), so callers can import either from here or there.
export type { CaseNarrative } from '@/lib/queries/cases'

// ---------------------------------------------------------------------------
// The merged case-layout render model + pure comparator
// ---------------------------------------------------------------------------

/**
 * A discriminated-union render item for the case-detail left column and the
 * process builder: a phase OR a narrative, tagged by `kind` and ordered by the
 * shared `displayPosition`. The case-detail list maps `kind:'phase'` to the
 * existing phase article and `kind:'narrative'` to `<CaseNarrativeCard>`; the
 * builder maps them to `PhaseSlotCard` / `NarrativeSlotCard`.
 */
export type CaseLayoutItem =
  | { kind: 'phase'; displayPosition: number; phase: CaseDetail['phases'][number] }
  | { kind: 'narrative'; displayPosition: number; narrative: CaseNarrative }

/**
 * Merge a case's phases + narratives into ONE ordered render list.
 *
 * Sorts by `displayPosition`; phases fall back to `position` when their
 * `displayPosition` is null (legacy rows pre-backfill / a defensive guard). The
 * tiebreaker on equal `displayPosition` is STABLE and deterministic: a phase
 * sorts before a narrative, then by `position` (phases) / `displayPosition` then
 * `id` (narratives). Gaps and duplicate positions are tolerated WITHOUT throwing —
 * the interleave is RPC-guaranteed, not DB-constrained, so the read side must
 * never crash on a transiently inconsistent set. Pure + unit-tested.
 */
export function mergeCaseLayout(detail: CaseDetail): CaseLayoutItem[] {
  const items: CaseLayoutItem[] = [
    ...detail.phases.map(
      (phase): CaseLayoutItem => ({
        kind: 'phase',
        // Phases fall back to `position` when `displayPosition` is null (legacy
        // rows pre-backfill); `position` is always present.
        displayPosition: phase.displayPosition ?? phase.position,
        phase,
      }),
    ),
    ...detail.narratives.map(
      (narrative): CaseLayoutItem => ({
        kind: 'narrative',
        displayPosition: narrative.displayPosition,
        narrative,
      }),
    ),
  ]

  // Stable, deterministic order. Primary: the effective `displayPosition`.
  // Tiebreaker on an equal position (the interleave is RPC-guaranteed, not
  // DB-constrained, so duplicates/gaps must not throw): phase before narrative,
  // then by the in-kind ordinal (`position` for phases, `displayPosition` for
  // narratives), then by `id` for a fully deterministic final order.
  return items.sort((a, b) => {
    if (a.displayPosition !== b.displayPosition) {
      return a.displayPosition - b.displayPosition
    }
    if (a.kind !== b.kind) {
      return a.kind === 'phase' ? -1 : 1
    }
    if (a.kind === 'phase' && b.kind === 'phase') {
      if (a.phase.position !== b.phase.position) {
        return a.phase.position - b.phase.position
      }
      return a.phase.id < b.phase.id ? -1 : a.phase.id > b.phase.id ? 1 : 0
    }
    if (a.kind === 'narrative' && b.kind === 'narrative') {
      return a.narrative.id < b.narrative.id
        ? -1
        : a.narrative.id > b.narrative.id
          ? 1
          : 0
    }
    return 0
  })
}

/**
 * The advisory close-warning selector (decision 7): the narratives that are
 * `isExpected` but still have an EMPTY body. The conclude dialog shows a
 * NON-BLOCKING warning listing these; `close_case` is untouched. A body of only
 * whitespace counts as empty. Pure + unit-tested; single-sourced here so the
 * dialog and the test agree.
 */
export function expectedEmptyNarratives(
  narratives: CaseNarrative[],
): CaseNarrative[] {
  return narratives.filter(
    (n) => n.isExpected && (n.bodyMd ?? '').trim().length === 0,
  )
}

// ---------------------------------------------------------------------------
// Row shape + mapper
// ---------------------------------------------------------------------------

interface CaseNarrativeTypeRow {
  id: string
  commission_id: string
  label: string
  description: string | null
  archived: boolean
  position: number
}

function mapNarrativeType(r: CaseNarrativeTypeRow): CaseNarrativeType {
  return {
    id: r.id,
    commissionId: r.commission_id,
    label: r.label,
    description: r.description,
    archived: r.archived,
    position: r.position,
  }
}

const NARRATIVE_TYPE_SELECT =
  'id, commission_id, label, description, archived, position' as const

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * The commission's narrative-type vocabulary, ordered by `position`. RLS-scoped
 * (members read); `[]` when unreadable. By default only NON-archived types are
 * returned (the slot picker); pass `includeArchived = true` (the settings
 * manager) for the full vocabulary — an ADDITIVE optional param mirroring
 * `listCaseOutcomes`.
 */
export async function listNarrativeTypes(
  commissionId: string,
  includeArchived = false,
): Promise<CaseNarrativeType[]> {
  const supabase = await createClient()
  let query = supabase
    .from('case_narrative_types')
    .select(NARRATIVE_TYPE_SELECT)
    .eq('commission_id', commissionId)

  if (!includeArchived) {
    query = query.eq('archived', false)
  }

  const { data, error } = await query
    .order('position', { ascending: true })
    .returns<CaseNarrativeTypeRow[]>()

  if (error || !data) return []
  return data.map(mapNarrativeType)
}

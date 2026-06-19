import { createClient } from '@/lib/supabase/server'
import {
  CHOICE_ITEM_TYPES,
  getVersionTree,
  type InputItemType,
} from '@/lib/queries/forms'
import type { RecommendWhen } from '@/lib/queries/conditions'
import type { ProcessTemplateNarrative } from '@/lib/queries/case-narratives'

export type { ProcessTemplateNarrative } from '@/lib/queries/case-narratives'

/**
 * Process-template data-access (Architecture Rule 9 — all reads go through
 * `src/lib/queries/`). Backs the per-commission **process-template builder**
 * (`/c/[slug]/manage/process-templates/**`): a blueprint of ordered phase-slots,
 * each bound to a whole form, with an optional cross-phase `recommend_when`.
 *
 * A template has a plain `draft → active → archived` lifecycle (NO
 * `form_versions`-style cloning/immutability — cases snapshot the phases + pin
 * form versions at creation, so template edits never reach live cases, ADR 0017).
 *
 * Reads are RLS-scoped (members read / staff_admin write); mutations live in
 * `src/lib/process-templates/actions.ts`. All user-facing strings are the
 * caller's (pt-BR). This is the CONTRACT-FIRST stub module: signatures + domain
 * types are stable; bodies are filled in B5.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type ProcessTemplateStatus = 'draft' | 'active' | 'archived'

/** One ordered phase-slot of a template, bound to a whole form. */
export interface ProcessTemplatePhase {
  id: string
  templateId: string
  /** 1-based slot order within the template. */
  position: number
  formId: string
  /** Title of the bound form (joined for display); `null` if unresolved. */
  formTitle: string | null
  /** Optional per-slot label shown on the board ("Fase 2 — Discussão"). */
  title: string | null
  /**
   * Optional cross-phase recommendation condition. When it evaluates true (over
   * an EARLIER phase's submitted answers, qualified by `from_phase`), the
   * materialized case-phase is flagged `recommended`. `null` = never auto-flag.
   */
  recommendWhen: RecommendWhen | null
  /**
   * Optional DEFAULT number of days for this slot — a planning hint authored
   * when the slot is defined. Snapshot-copied into each case-phase at case
   * creation (ADR 0017), where it pre-fills the activation due-date picker.
   * `null` = no default. Non-negative when present.
   */
  defaultDueDays: number | null
  /**
   * The 1-based positions of EARLIER slots that BLOCK this one (D1/D4): a case's
   * materialized phase cannot be activated until every listed earlier phase is
   * `concluida` or `nao_necessaria`. Validated earlier-only on save and remapped
   * on reorder/remove (mirrors `recommend_when`'s renumber machinery);
   * snapshot-copied verbatim into `case_phases` at case creation. `[]` = no
   * blockers.
   */
  blocks: number[]
  /**
   * The slot's order in the MERGED template layout (phases interleaved with
   * narrative-slots; Case Narratives increment, ADR 0032). Distinct from
   * `position`, which stays the immutable phase NUMBER. `null` only for legacy
   * rows pre-backfill; the builder's merge falls back to `position`.
   */
  displayPosition: number | null
}

/** A process template (blueprint) plus its ordered phase-slots. */
export interface ProcessTemplate {
  id: string
  commissionId: string
  title: string
  description: string | null
  status: ProcessTemplateStatus
  createdAt: string
  phases: ProcessTemplatePhase[]
  /**
   * The template's narrative-SLOTS (`process_template_narratives`; ADR 0032),
   * ordered by `displayPosition`, each carrying the joined LIVE type label. The
   * builder interleaves these with `phases` using the SAME `displayPosition`
   * comparator as `mergeCaseLayout`. `[]` when the `case_narratives` feature is
   * off or the template defines none.
   */
  narratives: ProcessTemplateNarrative[]
  /**
   * The ids of the outcomes this template OFFERS (`process_template_outcomes`),
   * for the builder's outcome multiselect to pre-check (D15 — outcomes optional
   * per process; `[]` = offers none). Resolve to labels/flags via
   * `listCaseOutcomes` (the vocabulary) + `listProcessOutcomes` (the offered
   * objects) from `@/lib/queries/case-outcomes`. Order is not significant.
   */
  offeredOutcomeIds: string[]
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Row shapes (the nested select returns phases with the bound form's title)
// ---------------------------------------------------------------------------

interface TemplatePhaseRow {
  id: string
  template_id: string
  position: number
  form_id: string
  title: string | null
  recommend_when: RecommendWhen | null
  default_due_days: number | null
  blocks: number[] | null
  display_position: number | null
  forms: { title: string | null } | null
}

interface TemplateOutcomeRow {
  outcome_id: string
}

/**
 * One `process_template_narratives` row joined to its live type label (ADR 0032).
 * The nested embed surfaces the bound `case_narrative_types.label` for the builder.
 */
interface TemplateNarrativeRow {
  id: string
  template_id: string
  narrative_type_id: string
  title: string | null
  instructions: string | null
  is_expected: boolean
  display_position: number | null
  case_narrative_types: { label: string | null } | null
}

interface TemplateRow {
  id: string
  commission_id: string
  title: string
  description: string | null
  status: ProcessTemplateStatus
  created_at: string
  process_template_phases: TemplatePhaseRow[]
  process_template_narratives: TemplateNarrativeRow[]
  process_template_outcomes: TemplateOutcomeRow[]
}

const TEMPLATE_SELECT = `
  id, commission_id, title, description, status, created_at,
  process_template_phases (
    id, template_id, position, form_id, title, recommend_when, default_due_days,
    blocks, display_position,
    forms ( title )
  ),
  process_template_narratives (
    id, template_id, narrative_type_id, title, instructions, is_expected,
    display_position,
    case_narrative_types ( label )
  ),
  process_template_outcomes ( outcome_id )
` as const

function mapPhase(p: TemplatePhaseRow): ProcessTemplatePhase {
  return {
    id: p.id,
    templateId: p.template_id,
    position: p.position,
    formId: p.form_id,
    formTitle: p.forms?.title ?? null,
    title: p.title,
    recommendWhen: p.recommend_when,
    defaultDueDays: p.default_due_days,
    blocks: p.blocks ?? [],
    displayPosition: p.display_position ?? null,
  }
}

function mapNarrative(n: TemplateNarrativeRow): ProcessTemplateNarrative {
  return {
    id: n.id,
    templateId: n.template_id,
    narrativeTypeId: n.narrative_type_id,
    typeLabel: n.case_narrative_types?.label ?? null,
    title: n.title,
    instructions: n.instructions,
    isExpected: n.is_expected,
    // The builder sorts the merged list; null sorts last via the merge comparator.
    displayPosition: n.display_position ?? 0,
  }
}

function mapTemplate(t: TemplateRow): ProcessTemplate {
  return {
    id: t.id,
    commissionId: t.commission_id,
    title: t.title,
    description: t.description,
    status: t.status,
    createdAt: t.created_at,
    phases: (t.process_template_phases ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(mapPhase),
    narratives: (t.process_template_narratives ?? [])
      .slice()
      .sort((a, b) => (a.display_position ?? 0) - (b.display_position ?? 0))
      .map(mapNarrative),
    offeredOutcomeIds: (t.process_template_outcomes ?? []).map(
      (o) => o.outcome_id,
    ),
  }
}

/**
 * Every process template of a commission (any status), each with its ordered
 * phase-slots, for the template list / builder index. RLS-scoped: returns `[]`
 * for non-members. Ordered most-recently-created first; phases in `position`
 * order.
 */
export async function listProcessTemplates(
  commissionId: string,
): Promise<ProcessTemplate[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('process_templates')
    .select(TEMPLATE_SELECT)
    .eq('commission_id', commissionId)
    .order('created_at', { ascending: false })
    .returns<TemplateRow[]>()

  if (error || !data) return []
  return data.map(mapTemplate)
}

/**
 * One process template by id, with its ordered phase-slots (each with the bound
 * form's title). `null` when the caller may not read it (RLS) or it does not
 * exist. Drives the single-template builder page.
 */
export async function getProcessTemplate(
  templateId: string,
): Promise<ProcessTemplate | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('process_templates')
    .select(TEMPLATE_SELECT)
    .eq('id', templateId)
    .maybeSingle<TemplateRow>()

  if (error || !data) return null
  return mapTemplate(data)
}

// ---------------------------------------------------------------------------
// recommend_when value-picker source
// ---------------------------------------------------------------------------

/**
 * One CHOICE-type input question a `recommend_when` may reference, with its
 * options for the value picker. `free_text` is EXCLUDED — the same codified
 * UI value-picker contract as `conditionTargets` (memory: conditionTargets is
 * choice-types only).
 */
export interface PhaseConditionTarget {
  questionKey: string
  label: string
  options: string[]
}

/**
 * The CHOICE-type input questions (multiple_choice | dropdown | checkbox —
 * EXCLUDING free_text, the SAME filter as `conditionTargets`, single-sourced via
 * `CHOICE_ITEM_TYPES`) of a form's CURRENT published version, for the
 * `recommend_when` editor's question picker. Unlike `conditionTargets` there is
 * NO earlier-section restriction — a phase's `recommend_when` reads ANY question
 * of an EARLIER phase-form (the `from_phase` qualifier resolves which form), so
 * every choice question of that whole published version is a valid target.
 *
 * RLS-scoped: a non-member of the form's commission cannot see the version, so
 * this returns `[]`. Also `[]` when the form has no published version. Ordered
 * by section position then item position (the `getVersionTree` order).
 */
export async function phaseConditionTargets(
  formId: string,
): Promise<PhaseConditionTarget[]> {
  const supabase = await createClient()

  // Resolve the form's current published version (RLS-scoped — a non-member
  // reads nothing → []).
  const { data: published } = await supabase
    .from('form_versions')
    .select('id')
    .eq('form_id', formId)
    .eq('status', 'published')
    .maybeSingle<{ id: string }>()

  if (!published) return []

  const tree = await getVersionTree(published.id)
  if (!tree) return []

  return tree.sections.flatMap((s) =>
    s.items
      .filter(
        (item) =>
          CHOICE_ITEM_TYPES.includes(item.itemType as InputItemType) &&
          item.questionKey != null,
      )
      .map((item) => ({
        questionKey: item.questionKey as string,
        label: item.label ?? '',
        options: item.options ?? [],
      })),
  )
}

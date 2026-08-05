import { createClient } from '@/lib/supabase/server'
import {
  CHOICE_ITEM_TYPES,
  getVersionTree,
  type ConditionTargetOption,
  type InputItemType,
} from '@/lib/queries/forms'
import type { RecommendRule, ResultRuleset } from '@/lib/queries/conditions'
import type { ProcessTemplateNarrative } from '@/lib/queries/case-narratives'

export type { ProcessTemplateNarrative } from '@/lib/queries/case-narratives'

/**
 * Process-template data-access (Architecture Rule 9 — all reads go through
 * `src/lib/queries/`). Backs the per-commission **process-template builder**
 * (`/c/[slug]/manage/process-templates/**`): a blueprint of ordered phase-slots,
 * each bound to a whole form, with an optional cross-phase `recommend_when`.
 *
 * ## Versioning (ADR 0096 — Process-Template Versioning)
 *
 * A template is an IDENTITY (`process_templates`) owning an ordered list of
 * VERSIONS (`process_template_versions`), mirroring `forms` / `form_versions`
 * (Architecture Rule 5): `draft → published → archived`, at most one `published`
 * and at most one `draft` per template, published versions IMMUTABLE, and editing
 * a published version auto-CLONES it to a draft the author must re-publish.
 *
 * ⚠ This supersedes the previous "plain `draft → active → archived` lifecycle,
 * NO `form_versions`-style cloning/immutability" contract that this comment
 * asserted until 2026-08-04. Two consequences worth stating because they are easy
 * to get backwards:
 *
 *  - `title` / `description` / `collectsPatient` / `caseTypeId` live on the
 *    VERSION, not the identity (ADR 0096 D1) — a deliberate divergence from
 *    `forms`, where they sit on the identity and therefore drift across versions.
 *  - The status value `'active'` is retired in favour of `'published'`. This is a
 *    deliberate COMPILE-TIME break so `tsc` enumerates every comparison site;
 *    a silent value change would have been worse.
 *
 * Per-case provenance did NOT depend on this: a case already snapshots its
 * phases and pins `form_version_id` at creation, so template edits never reached
 * live cases. Versioning buys template-level governance/reporting ("which version
 * was in force in Q2"), not a provenance repair — see ADR 0096's Context.
 *
 * Reads are RLS-scoped (members read / staff_admin write); mutations live in
 * `src/lib/process-templates/actions.ts`. All user-facing strings are the
 * caller's (pt-BR).
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------


/**
 * The lifecycle of ONE process-template version (ADR 0096), identical to
 * `form_versions.status`. Invariants enforced in the DB, not the UI:
 *  - at most one `published` version per template (partial unique index);
 *  - at most one `draft` per template (`cloneTemplateVersion` returns the open
 *    draft instead of minting a second);
 *  - `published` and `archived` versions are IMMUTABLE (trigger-enforced);
 *  - publishing ARCHIVES the incumbent `published` version in the same statement.
 */
export type TemplateVersionStatus = 'draft' | 'published' | 'archived'

/**
 * The custom-field type subset (ADR 0083 D3): the form input-type VOCABULARY
 * reused, minus the excluded types (`checkbox`, `free_text`, `time`, display
 * items). Single-select = `dropdown` | `multiple_choice` (both carry `options`).
 */
export type CustomFieldType =
  | 'short_text'
  | 'number'
  | 'date'
  | 'dropdown'
  | 'multiple_choice'

/** A single-select option on a custom field (`{ code, label }`, like form options). */
export interface CustomFieldOption {
  code: string
  label: string
}

/**
 * One template-defined custom-field DEFINITION (`process_template_custom_fields`;
 * ADR 0083). Authored in the template builder (staff_admin) while the template is
 * `draft`; snapshotted onto each case at creation. `options` is non-empty ONLY for
 * the two single-select types. `showInList` (opt-in) surfaces the field as a cases
 * list column/filter; `required` blocks case creation when unfilled.
 */
export interface CustomFieldDef {
  id: string
  /** ADR 0096: custom-field defs are children of a VERSION, not the identity. */
  templateVersionId: string
  /** Slug, unique per version. */
  key: string
  /** pt-BR display label. */
  label: string
  fieldType: CustomFieldType
  /** `[]` unless `fieldType` is a single-select type. */
  options: CustomFieldOption[]
  required: boolean
  showInList: boolean
  position: number
}

/** One ordered phase-slot of a template, bound to a whole form. */
export interface ProcessTemplatePhase {
  id: string
  /** ADR 0096: phase-slots are children of a VERSION, not the identity. */
  templateVersionId: string
  /** 1-based slot order within the version. */
  position: number
  formId: string
  /** Title of the bound form (joined for display); `null` if unresolved. */
  formTitle: string | null
  /** Optional per-slot label shown on the board ("Fase 2 — Discussão"). */
  title: string | null
  /**
   * Optional cross-phase recommendation rule (ADR 0017; combinable since ADR
   * 0043). The legacy single answer-condition OR a {@link RecommendGroup} of
   * answer/result conditions. When it evaluates true (over EARLIER phases'
   * submitted answers + results, each qualified by `from_phase`), the
   * materialized case-phase is flagged `recommended`. `null` = never auto-flag.
   */
  recommendWhen: RecommendRule | null
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
   * `completed` or `not_required`. Validated earlier-only on save and remapped
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
  /**
   * Whether this phase emits a result at all (phase-result-manual-mode). With the
   * two fields below it drives the three modes:
   *   - `emitsResult === false`                  → NONE (no result)
   *   - `emitsResult && resultRuleset !== null`   → AUTOMATIC (rules pick a result)
   *   - `emitsResult && resultRuleset === null`   → MANUAL (filler picks)
   * An emitting phase with no `allowedResultIds` is an incomplete draft, blocked
   * at publish.
   */
  emitsResult: boolean
  /**
   * Optional per-phase RESULT ruleset (phase-results feature): an ordered set of
   * rules over THIS phase's OWN answers (no `from_phase`) that emit a categorical
   * result option when the phase's form is submitted, with a default fallback.
   * The rules may only reference {@link allowedResultIds}. `null` = MANUAL (the
   * filler picks). Mutable only while the template is `draft`.
   */
  resultRuleset: ResultRuleset | null
  /**
   * The author-selected ALLOWED result subset (phase-result-manual-mode): present
   * whenever the phase emits a result, for BOTH modes. MANUAL — the options the
   * filler chooses from; AUTOMATIC — the options the rules/default may reference.
   * `null` when the phase emits no result. Validated (non-archived, in-commission)
   * at publish and snapshotted onto each case-phase.
   */
  allowedResultIds: string[] | null
}


// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Row shapes (the nested select returns phases with the bound form's title)
// ---------------------------------------------------------------------------

interface TemplatePhaseRow {
  id: string
  template_version_id: string
  position: number
  form_id: string
  title: string | null
  recommend_when: RecommendRule | null
  default_due_days: number | null
  blocks: number[] | null
  display_position: number | null
  result_ruleset: ResultRuleset | null
  emits_result: boolean
  // D3 (F-cleanup): the allowed subset is normalized into
  // process_template_phase_allowed_results; re-aggregated to allowedResultIds below.
  process_template_phase_allowed_results:
    | { result_id: string; position: number }[]
    | null
  forms: { title: string | null } | null
}

interface TemplateOutcomeRow {
  outcome_id: string
}

interface TemplateCustomFieldRow {
  id: string
  template_version_id: string
  key: string
  label: string
  field_type: CustomFieldType
  options: CustomFieldOption[] | null
  required: boolean
  show_in_list: boolean
  position: number
}

/**
 * One `process_template_narratives` row joined to its live type label (ADR 0032).
 * The nested embed surfaces the bound `case_narrative_types.label` for the builder.
 */
interface TemplateNarrativeRow {
  id: string
  template_version_id: string
  narrative_type_id: string
  title: string | null
  instructions: string | null
  is_expected: boolean
  display_position: number | null
  case_narrative_types: { label: string | null } | null
}

function mapPhase(p: TemplatePhaseRow): ProcessTemplatePhase {
  return {
    id: p.id,
    templateVersionId: p.template_version_id,
    position: p.position,
    formId: p.form_id,
    formTitle: p.forms?.title ?? null,
    title: p.title,
    recommendWhen: p.recommend_when,
    defaultDueDays: p.default_due_days,
    blocks: p.blocks ?? [],
    displayPosition: p.display_position ?? null,
    resultRuleset: p.result_ruleset ?? null,
    emitsResult: p.emits_result ?? false,
    // D3 (F-cleanup): re-aggregate the allowed junction back to the byte-identical
    // domain shape (ordered string[] | null; empty => null, matching the pre-D3
    // "null = no allowed set" contract so no ProcessTemplatePhase consumer changes).
    allowedResultIds: (() => {
      const rows = p.process_template_phase_allowed_results ?? []
      if (rows.length === 0) return null
      return rows
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((r) => r.result_id)
    })(),
  }
}

function mapNarrative(n: TemplateNarrativeRow): ProcessTemplateNarrative {
  return {
    id: n.id,
    templateVersionId: n.template_version_id,
    narrativeTypeId: n.narrative_type_id,
    typeLabel: n.case_narrative_types?.label ?? null,
    title: n.title,
    instructions: n.instructions,
    isExpected: n.is_expected,
    // The builder sorts the merged list; null sorts last via the merge comparator.
    displayPosition: n.display_position ?? 0,
  }
}

function mapCustomFieldDef(f: TemplateCustomFieldRow): CustomFieldDef {
  return {
    id: f.id,
    templateVersionId: f.template_version_id,
    key: f.key,
    label: f.label,
    fieldType: f.field_type,
    options: f.options ?? [],
    required: f.required ?? false,
    showInList: f.show_in_list ?? false,
    position: f.position ?? 0,
  }
}

// ADR 0096: the legacy identity-grain readers (TEMPLATE_SELECT, TemplateRow,
// mapTemplate, listProcessTemplates, getProcessTemplate) were REMOVED, not
// adapted. They selected process_templates.title/description/status/
// collects_patient/case_type_id — every one of which moved to the version — so
// there was no honest way to keep them: mapping the version status back to
// 'active' would have reinstated the exact lie the enum rename removed.
// Their replacements are getProcessTemplateWithVersion / listProcessTemplateVersions.

// ---------------------------------------------------------------------------
// recommend_when value-picker source
// ---------------------------------------------------------------------------

/**
 * One CHOICE-type input question a `recommend_when` may reference, with its
 * options for the value picker. `free_text` is EXCLUDED — the same codified
 * UI value-picker contract as `conditionTargets` (memory: conditionTargets is
 * choice-types only).
 *
 * form-model-normalization (contract item #2): the recommend_when / result_ruleset
 * answer conditions now STORE the option **code** (the clone-stable identity the
 * code-keyed answer_map evaluates), not the label — so the picker needs BOTH, the
 * `code` to store and the `label` to show. `options` is `ConditionTargetOption[]`
 * (`{ code, label }`), mirroring `conditionTargets`.
 */
export interface PhaseConditionTarget {
  questionKey: string
  label: string
  options: ConditionTargetOption[]
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
        // form-model-normalization: project each option's { code, label }. The
        // condition STORES the code (clone-stable identity the code-keyed
        // answer_map evaluates); the picker SHOWS the label. Item.options is the
        // normalized ItemOption[] (code + label both present). The deep
        // code-existence validation now lives server-side (BE-5): the template
        // validators (validate_template_recommend_when / _result_ruleset) assert a
        // referenced value code exists on the choice question at add/update/publish.
        options: (item.options ?? []).map(
          (o): ConditionTargetOption => ({ code: o.code, label: o.label }),
        ),
      })),
  )
}

// ---------------------------------------------------------------------------
// ADR 0096 — Process-template VERSIONING (contract-first surface)
//
// CONTRACT-FIRST STUBS. Signatures + domain types are the agreed shape the
// `frontend` teammate builds against; the bodies land with the substrate
// migrations and throw until then. Signatures are stable — if one must change,
// it goes through the lead so `frontend` adapts rather than discovering it at
// integration (the Phase-6 rework lesson).
// ---------------------------------------------------------------------------


/**
 * The template IDENTITY row (`process_templates`) after ADR 0096: a bare,
 * commission-scoped anchor owning the version list. Deliberately carries NO
 * `title`, `description`, `status`, `collectsPatient` or `caseTypeId` — D1 moved
 * every one of those onto the version, which is what closes the audit's real
 * provenance gap (template title/description were never snapshotted per-case).
 */
export interface ProcessTemplateIdentity {
  id: string
  commissionId: string
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/**
 * One row of a template's version HISTORY — the lightweight shape for the
 * version picker and history list. Deliberately excludes the children (phases,
 * narratives, outcomes, custom fields); fetch those via
 * {@link getProcessTemplateVersion} for the one version being viewed/edited.
 */
export interface ProcessTemplateVersionSummary {
  id: string
  templateId: string
  /** 1-based, monotonically increasing per template; never reused. */
  versionNumber: number
  status: TemplateVersionStatus
  /** Authored per-version (D1) — this is what makes history readable. */
  title: string
  description: string | null
  createdBy: string | null
  createdAt: string
  /** Set when the version was published; `null` for a draft. */
  publishedAt: string | null
  /**
   * How many cases were started under this version. Drives "v3 — 12 casos" in
   * the picker and is the reason a published version can never be deleted
   * (`cases.template_version_id` is `ON DELETE RESTRICT`).
   */
  caseCount: number
}

/**
 * ONE process-template version in full: the version's own authored fields plus
 * its children. This is the shape the BUILDER edits (when `status === 'draft'`)
 * and the version history VIEWS read-only (when published/archived).
 *
 * The child collections keep the exact element types the pre-versioning builder
 * already consumes ({@link ProcessTemplatePhase}, {@link ProcessTemplateNarrative},
 * {@link CustomFieldDef}) so component internals do not churn — only the
 * `templateId` field on each element becomes a `templateVersionId` (the re-key).
 */
export interface ProcessTemplateVersion extends ProcessTemplateVersionSummary {
  /** The owning commission, resolved through the identity for convenience. */
  commissionId: string
  /**
   * Version-scoped (D1). Cases created from this version snapshot it into
   * `cases.patient_enabled`. Surfaced behind the `case_patient` feature flag.
   */
  collectsPatient: boolean
  /**
   * Version-scoped (D1). Cases INHERIT this type's `default_visibility_policy` /
   * `default_confidentiality_level`, so it sets the access posture of every case
   * this version opens — not just its vocabulary.
   */
  caseTypeId: string | null
  phases: ProcessTemplatePhase[]
  narratives: ProcessTemplateNarrative[]
  offeredOutcomeIds: string[]
  customFields: CustomFieldDef[]
  /**
   * `true` when this version may be structurally edited — exactly
   * `status === 'draft'`. Mirrored from the DB rather than recomputed in the UI:
   * the substrate refuses every authoring RPC on a non-draft version, so a UI
   * that disagrees produces a pt-BR error, never a silent write.
   */
  editable: boolean
}

/**
 * A template together with the ONE version currently in view, plus enough of the
 * history to render the picker. This is the primary builder-page payload and
 * replaces the flat {@link ProcessTemplate}.
 */
export interface ProcessTemplateWithVersion {
  template: ProcessTemplateIdentity
  /** The version being displayed — see {@link getProcessTemplateWithVersion}. */
  version: ProcessTemplateVersion
  /** Newest first. Always includes `version`. */
  versions: ProcessTemplateVersionSummary[]
  /** The published version's id, or `null` if the template has never published. */
  publishedVersionId: string | null
  /**
   * The open draft's id, or `null` when none exists. When `null` the builder
   * shows "Editar" (which clones); when set it shows "Continuar rascunho".
   */
  draftVersionId: string | null
}

/**
 * What a CASE needs to display which template version it ran under (ADR 0096 D3).
 *
 * Note the honest scope: a case is already self-describing (its phases, pinned
 * `form_version_id`s, blocks, rulesets and frozen vocabularies are all snapshotted
 * at creation), so this is PROVENANCE LABELLING, not data the case depends on to
 * render. `versionNumber` + `title` are the two things that genuinely were not
 * recoverable before.
 */
export interface CaseTemplateProvenance {
  templateId: string
  templateVersionId: string
  versionNumber: number
  /** The title as authored ON THAT VERSION — not the template's current title. */
  title: string
  status: TemplateVersionStatus
  publishedAt: string | null
}

/**
 * Row shapes for the version reads. The `cases(count)` embed is what powers
 * `caseCount` in the picker; PostgREST returns it as `[{ count: n }]`.
 */
interface VersionSummaryRow {
  id: string
  template_id: string
  version_number: number
  status: TemplateVersionStatus
  title: string
  description: string | null
  created_by: string | null
  created_at: string
  published_at: string | null
  cases: { count: number }[] | null
}

interface VersionFullRow extends VersionSummaryRow {
  collects_patient: boolean
  case_type_id: string | null
  process_templates: { commission_id: string } | null
  process_template_phases: TemplatePhaseRow[]
  process_template_narratives: TemplateNarrativeRow[]
  process_template_outcomes: TemplateOutcomeRow[]
  process_template_custom_fields: TemplateCustomFieldRow[]
}

const VERSION_SUMMARY_SELECT = `
  id, template_id, version_number, status, title, description,
  created_by, created_at, published_at,
  cases ( count )
` as const

const VERSION_FULL_SELECT = `
  id, template_id, version_number, status, title, description,
  created_by, created_at, published_at, collects_patient, case_type_id,
  cases ( count ),
  process_templates ( commission_id ),
  process_template_phases (
    id, template_version_id, position, form_id, title, recommend_when,
    default_due_days, blocks, display_position, result_ruleset, emits_result,
    process_template_phase_allowed_results ( result_id, position ),
    forms ( title )
  ),
  process_template_narratives (
    id, template_version_id, narrative_type_id, title, instructions, is_expected,
    display_position,
    case_narrative_types ( label )
  ),
  process_template_outcomes ( outcome_id ),
  process_template_custom_fields (
    id, template_version_id, key, label, field_type, options, required,
    show_in_list, position
  )
` as const

function mapVersionSummary(v: VersionSummaryRow): ProcessTemplateVersionSummary {
  return {
    id: v.id,
    templateId: v.template_id,
    versionNumber: v.version_number,
    status: v.status,
    title: v.title,
    description: v.description,
    createdBy: v.created_by,
    createdAt: v.created_at,
    publishedAt: v.published_at,
    caseCount: v.cases?.[0]?.count ?? 0,
  }
}

function mapVersionFull(v: VersionFullRow): ProcessTemplateVersion {
  return {
    ...mapVersionSummary(v),
    commissionId: v.process_templates?.commission_id ?? '',
    collectsPatient: v.collects_patient ?? false,
    caseTypeId: v.case_type_id ?? null,
    phases: (v.process_template_phases ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(mapPhase),
    narratives: (v.process_template_narratives ?? [])
      .slice()
      .sort((a, b) => (a.display_position ?? 0) - (b.display_position ?? 0))
      .map(mapNarrative),
    offeredOutcomeIds: (v.process_template_outcomes ?? []).map(
      (o) => o.outcome_id,
    ),
    customFields: (v.process_template_custom_fields ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(mapCustomFieldDef),
    // Mirrored from the substrate rather than recomputed: every authoring RPC
    // refuses a non-draft version, so a UI that disagreed would produce a pt-BR
    // error, never a silent write.
    editable: v.status === 'draft',
  }
}

/**
 * A template's full version history, newest first, for the version picker.
 * RLS-scoped: `[]` for a non-member of the owning commission.
 */
export async function listTemplateVersions(
  templateId: string,
): Promise<ProcessTemplateVersionSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('process_template_versions')
    .select(VERSION_SUMMARY_SELECT)
    .eq('template_id', templateId)
    .order('version_number', { ascending: false })
    .returns<VersionSummaryRow[]>()

  if (error || !data) return []
  return data.map(mapVersionSummary)
}

/**
 * One version in full, by version id. `null` when it does not exist or RLS hides
 * it. Use for both the draft builder and the read-only historical view — the
 * caller distinguishes them via `version.editable`.
 */
export async function getProcessTemplateVersion(
  templateVersionId: string,
): Promise<ProcessTemplateVersion | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('process_template_versions')
    .select(VERSION_FULL_SELECT)
    .eq('id', templateVersionId)
    .maybeSingle<VersionFullRow>()

  if (error || !data) return null
  return mapVersionFull(data)
}

/** Shared by the published/draft resolvers — both are "one version by status". */
async function versionByStatus(
  templateId: string,
  status: TemplateVersionStatus,
): Promise<ProcessTemplateVersion | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('process_template_versions')
    .select(VERSION_FULL_SELECT)
    .eq('template_id', templateId)
    .eq('status', status)
    .maybeSingle<VersionFullRow>()

  if (error || !data) return null
  return mapVersionFull(data)
}

/**
 * The template's CURRENT published version — the one `create_case_from_template`
 * resolves, so this is what a "start a case from this process" screen must show.
 * `null` when the template has never been published (or its published version was
 * archived without a successor).
 */
export async function getPublishedTemplateVersion(
  templateId: string,
): Promise<ProcessTemplateVersion | null> {
  return versionByStatus(templateId, 'published')
}

/**
 * The template's OPEN DRAFT, or `null` when none exists. Read-only: it does NOT
 * create one. Cloning is a mutation and lives in `actions.ts`
 * (`beginTemplateEdit` / `cloneTemplateVersion`), so a mere page render can never
 * mint a draft as a side effect.
 */
export async function getDraftTemplateVersion(
  templateId: string,
): Promise<ProcessTemplateVersion | null> {
  return versionByStatus(templateId, 'draft')
}

/**
 * The builder-page payload. `templateVersionId` selects the version to display;
 * when omitted the resolution order is **draft → published → newest**, so an
 * author who left a draft open lands back in it.
 */
export async function getProcessTemplateWithVersion(
  templateId: string,
  templateVersionId?: string,
): Promise<ProcessTemplateWithVersion | null> {
  const supabase = await createClient()

  const [identityResult, versions] = await Promise.all([
    supabase
      .from('process_templates')
      .select('id, commission_id, created_by, created_at, updated_at')
      .eq('id', templateId)
      .maybeSingle<{
        id: string
        commission_id: string
        created_by: string | null
        created_at: string
        updated_at: string
      }>(),
    listTemplateVersions(templateId),
  ])

  const identity = identityResult.data
  if (!identity || versions.length === 0) return null

  const publishedVersionId =
    versions.find((v) => v.status === 'published')?.id ?? null
  const draftVersionId = versions.find((v) => v.status === 'draft')?.id ?? null

  // draft → published → newest. `versions` is already newest-first.
  const targetId =
    templateVersionId ?? draftVersionId ?? publishedVersionId ?? versions[0].id

  const version = await getProcessTemplateVersion(targetId)
  if (!version) return null

  // A version id from another template would otherwise render under this one.
  if (version.templateId !== templateId) return null

  return {
    template: {
      id: identity.id,
      commissionId: identity.commission_id,
      createdBy: identity.created_by,
      createdAt: identity.created_at,
      updatedAt: identity.updated_at,
    },
    version,
    versions,
    publishedVersionId,
    draftVersionId,
  }
}

/**
 * Every process template of a commission, each resolved to the version a LIST
 * should show (published if any, else the newest). Replaces the removed
 * identity-grain `listProcessTemplates`. RLS-scoped: `[]` for non-members.
 */
export async function listProcessTemplateVersions(
  commissionId: string,
): Promise<ProcessTemplateWithVersion[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('process_templates')
    .select('id')
    .eq('commission_id', commissionId)
    .order('created_at', { ascending: false })
    .returns<{ id: string }[]>()

  if (error || !data) return []

  const resolved = await Promise.all(
    data.map((t) => getProcessTemplateWithVersion(t.id)),
  )
  return resolved.filter((r): r is ProcessTemplateWithVersion => r != null)
}

/**
 * Which template version a case ran under, for the case detail header.
 * `null` for a PROCESSLESS case (created via `create_case`, no template) — a
 * supported shape, not an error, so callers must handle `null` rather than
 * treating it as a load failure.
 */
export async function getCaseTemplateProvenance(
  caseId: string,
): Promise<CaseTemplateProvenance | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cases')
    .select(
      'template_version_id, process_template_versions(id, template_id, version_number, title, status, published_at)',
    )
    .eq('id', caseId)
    .maybeSingle<{
      template_version_id: string | null
      process_template_versions: {
        id: string
        template_id: string
        version_number: number
        title: string
        status: TemplateVersionStatus
        published_at: string | null
      } | null
    }>()

  if (error || !data?.process_template_versions) return null
  const v = data.process_template_versions
  return {
    templateId: v.template_id,
    templateVersionId: v.id,
    versionNumber: v.version_number,
    title: v.title,
    status: v.status,
    publishedAt: v.published_at,
  }
}

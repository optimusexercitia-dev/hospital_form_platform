import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getSessionContext, type CommissionAccess } from '@/lib/queries/session'
import { featureEnabled } from '@/lib/queries/feature-flags'
import type { Page, PageParams } from '@/lib/types/pagination'
import type { RecommendWhen, ResultRuleset } from '@/lib/queries/conditions'
import type {
  CaseStatus,
  CaseStatusColorToken,
} from '@/lib/cases/case-status'
import type { CasePatient, CasePatientSex } from '@/lib/cases/types'
import { listPhaseResults } from '@/lib/queries/phase-results'
import type { ResolvedPhaseResult } from '@/lib/queries/phase-results'
import type {
  CustomFieldOption,
  CustomFieldType,
} from '@/lib/queries/process-templates'
import type { CaseTypeTerminology } from '@/lib/cases/terminology'
import { getCaseTypeTerminology } from '@/lib/queries/case-types'
// Type-only (erased at compile), so the actions ⇄ queries pair below is NOT a
// runtime cycle. `ProfessionalLinkState` is declared once, in the frozen BE-1
// contract module, and re-exported here so a consumer of `CaseParticipant` gets
// the enum from the same import.
import type { ProfessionalLinkState } from '@/lib/participants/actions'

export type { ProfessionalLinkState } from '@/lib/participants/actions'
export type { CaseTypeTerminology } from '@/lib/cases/terminology'
export { getCaseTypeTerminology } from '@/lib/queries/case-types'
export type { ResolvedPhaseResult } from '@/lib/queries/phase-results'
export type {
  CustomFieldDef,
  CustomFieldOption,
  CustomFieldType,
} from '@/lib/queries/process-templates'

export type { CaseStatus } from '@/lib/cases/case-status'

/**
 * Cases data-access (Architecture Rule 9 — all reads go through
 * `src/lib/queries/`). Backs the **cases board** + **per-case detail**
 * (`/c/[slug]/manage/cases/**`) and the assignee's **phase-fill landing**
 * (`/c/[slug]/cases/[caseId]/phase/...`).
 *
 * A case groups responses into an ordered sequence of phases; `case_phases` is
 * the authority and carries STATUS + ASSIGNEE + RECOMMENDED ONLY — never answers
 * (the Phase-7 in_progress-answers invariant, ADR 0016). Two reads are SECURITY
 * DEFINER RPCs (B3), internally `is_staff_admin_of`-gated, the same narrow
 * envelope pattern as the sign-off queue:
 *   - `list_cases_board(commission_id)` — one row per case + aggregated phase
 *     STATUS (no answers).
 *   - `get_case_detail(case_id)` — case header + phases; `responseId`/`submittedAt`
 *     populated ONLY for phases whose response is SUBMITTED (`completed`, and —
 *     since ADR 0136 — `awaiting_signoff`), so the coordinator can deep-link the
 *     frozen answers via the existing staff_admin submitted-response read path —
 *     never an in-progress answer.
 *
 * `getCasePhaseForFill` is the assignee's RLS-scoped landing read (status +
 * metadata only). Mutations live in `src/lib/cases/actions.ts`. All user-facing
 * strings are the caller's (pt-BR). CONTRACT-FIRST stub module: signatures +
 * domain types are stable; bodies are filled in B5.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/**
 * ⛔ ADDING A MEMBER HERE IS MOSTLY A **SILENT** CHANGE. There is no `assertNever`
 * or `satisfies` guard anywhere over this union, so "the compiler will find the
 * call sites" is FALSE. Measured when `'awaiting_signoff'` was added (ADR 0136):
 * only **4 declaration sites** failed typecheck — the `Record<CasePhaseStatus, …>`
 * maps in `phase-status-pill.tsx`, `cases-kanban.tsx` and `cases-table.tsx` (×2).
 * Every other site is an `if`/`!==` chain that falls through. Sweep by hand.
 */
export type CasePhaseStatus =
  | 'pending'
  | 'active'
  // ADR 0136 D3 — the response is SUBMITTED and frozen, and a visible
  // `signoff_role = 'staff_admin'` section still owes its countersignature. NOT
  // settled: `activate_phase`'s settled set is ('completed','not_required',
  // 'voided'), so every downstream phase stays blocked with no new gating logic.
  // ⛔ The DB is the authority — this union only decides what is RENDERED.
  | 'awaiting_signoff'
  | 'completed'
  | 'not_required'
  // Case Correction Lifecycle (BE-4): a completed phase voided via an approved
  // void request. Terminal, settled (does not block downstream phases), result cleared.
  | 'voided'

/** A case header (no phases). */
/** `case_types.primary_subject_kind` (ADR 0064 D4). */
export type PrimarySubjectKind = 'patient' | 'professional' | 'entity' | 'none'

/**
 * How a process version / case collects patient identifiers (ADR 0137 D1).
 * Replaces the retired `collects_patient` / `patient_enabled` booleans; the
 * mechanical mapping was `true → 'optional'`, `false → 'none'`, and NEVER
 * `'required'` (a boolean carried no evidence of intent to mandate).
 */
export type PatientMode = 'none' | 'optional' | 'required'

/**
 * The identifier fields a `'required'`-mode process may demand (ADR 0137 D2).
 *
 * ⛔ `age_years` and `unit` are NOT members, and that is enforced by a CHECK
 * constraint on both `process_template_versions` and `cases`, not merely by
 * their absence from this union — ADR 0137 D2 (the set) and D9 (removing both
 * inputs from every case surface) are two halves of one decision, and the
 * constraint is what stops them drifting apart one field at a time.
 *
 * `'mrn'` is always present in a required set: it is the LGPD erasure key, and
 * the DB welds it in (`set_template_patient_mode`) with a CHECK as backstop.
 */
export type PatientRequiredField =
  | 'name'
  | 'mrn'
  | 'date_of_birth'
  | 'sex'
  | 'encounter_ref'
  | 'attending'

/** The canonical order the DB reports missing required fields in. */
export const PATIENT_REQUIRED_FIELDS: readonly PatientRequiredField[] = [
  'name',
  'mrn',
  'date_of_birth',
  'sex',
  'encounter_ref',
  'attending',
] as const

/** Narrow an untyped `patient_mode` string from the DB. */
export function toPatientMode(value: string | null | undefined): PatientMode {
  return value === 'optional' || value === 'required' ? value : 'none'
}

/** Narrow an untyped `patient_required_fields` array from the DB. */
export function toPatientRequiredFields(
  value: readonly string[] | null | undefined,
): PatientRequiredField[] {
  if (!value) return []
  return PATIENT_REQUIRED_FIELDS.filter((f) => value.includes(f))
}

export interface Case {
  id: string
  commissionId: string
  /** `null` once detached from its blueprint (template archived/deleted). */
  templateId: string | null
  /**
   * The case's type (ADR 0064 D4; O-1), snapshotted at creation, or `null` for a
   * type-less case (the pre-Ethics default — the overwhelming majority). Drives
   * terminology resolution via {@link CaseDetail.terminology}. The `cases.case_type_id`
   * column lands in BE-2; BE-5 projects it (this read defaults it to `null`).
   */
  caseTypeId: string | null
  /** Per-commission counter ("Caso 0042" is `caseNumber = 42`). */
  caseNumber: number
  /** Optional NON-IDENTIFYING label (never a patient name/MRN). */
  label: string | null
  status: CaseStatus
  /**
   * The id of the assigned outcome (D9 — at most one per case), or `null` if
   * none chosen yet / the process offers no outcomes (D15). Resolve to label +
   * flags via {@link CaseDetail.outcome} / {@link CaseBoardRow.outcome}.
   */
  outcomeId: string | null
  createdAt: string
  closedAt: string | null
  /**
   * `true` when an isolated `case_patient` (PHI) row exists for this case (the
   * THIRD PHI module; ADR 0038). Denormalized boolean (PHI-free) — the identifiers
   * themselves are loaded ONLY through the audited
   * {@link getCasePatient} door. Gates the detail panel BODY. The board/phase-fill
   * reads default this to `false` (the panel only renders on the detail page).
   */
  hasPatient: boolean
  /**
   * How this case collects patient identifiers, snapshotted at creation from the
   * template version's `patient_mode` and IMMUTABLE thereafter (ADR 0137 D1;
   * `app.guard_case_patient_mode_immutable` raises `HC0T3` on any change):
   * `'none'` — no PHI block · `'optional'` — offered, may be left empty ·
   * `'required'` — must be filled to create the case.
   * The board/phase-fill reads default to `'none'`.
   */
  patientMode: PatientMode
  /**
   * When {@link patientMode} is `'required'`, the identifier fields that must
   * carry a value (ADR 0137 D2). `mrn` is ALWAYS a member — it is the LGPD
   * erasure key, and the DB CHECK welds it in. Empty for the other two modes.
   */
  patientRequiredFields: PatientRequiredField[]
  /**
   * The case's department ("Unidade / setor") — a HOSPITAL-SCOPED, NON-PHI
   * attribute (Hospital Departments). At most one of `departmentId` (a managed
   * `hospital_departments` row) / `departmentOther` (the "Outro" custom value) is
   * set; both `null` = unspecified. Case-level (never on the PHI `case_patient`).
   * The board/phase-fill reads default these to `null` (only the detail page
   * resolves the name).
   */
  departmentId: string | null
  departmentOther: string | null
  /**
   * The chosen department's name resolved LIVE from `hospital_departments`
   * (RLS-scoped supplementary read, so a rename propagates), or `departmentOther`
   * when the "Outro" custom value was used, or `null` when unspecified / the
   * department was archived-away. Display-only.
   */
  departmentName: string | null
}

/**
 * A case's assigned outcome RESOLVED for display (D9–D11): the vocabulary row
 * read LIVE (so label/flag edits propagate, D11), joined to the case via
 * `cases.outcome_id`. Present on the board row + detail; `null` when no outcome
 * is assigned. A trimmed projection of {@link CaseOutcome} (no commission /
 * archived / position — the case views don't need them).
 */
export interface ResolvedCaseOutcome {
  id: string
  /** pt-BR label (resolved LIVE — propagates per D11). */
  label: string
  colorToken: CaseStatusColorToken
  /** Advisory: show a "requires action plan" reminder (D10, non-gating). */
  requiresActionPlan: boolean
  /** Adverse-event tracking flag (D10, non-gating; feeds the % adverse KPI). */
  isAdverse: boolean
}

/**
 * One outcome a case OFFERS — its FROZEN offered set (`case_offered_outcomes`,
 * snapshotted at creation), resolved to label + flags for the conclude dialog and
 * the case-detail selector. The same trimmed projection as
 * {@link ResolvedCaseOutcome}.
 */
export type OfferedCaseOutcome = ResolvedCaseOutcome

/** One phase of a case (the authority row — status/assignee/recommended only). */
export interface CasePhase {
  id: string
  caseId: string
  /** 1-based phase order within the case. */
  position: number
  formId: string
  /** The PINNED published form version this phase fills (snapshot). */
  formVersionId: string
  /** Title of the bound form (joined for display); `null` if unresolved. */
  formTitle: string | null
  /** Optional per-phase label. */
  title: string | null
  status: CasePhaseStatus
  /** `true` when `recommendWhen` evaluated true; independent of `status`. */
  recommended: boolean
  /** The member assigned to fill this phase (its response's creator). */
  assignedTo: string | null
  /** Assignee's display name (joined); `null` if unassigned/unresolved. */
  assigneeName: string | null
  /** `true` when appended ad-hoc to this case (not from the template). */
  isAdHoc: boolean
  /**
   * The 1-based positions of EARLIER phases that BLOCK this one (D1/D4): this
   * phase cannot be activated until every listed phase is `completed` or
   * `not_required`. Snapshot-copied from the template slot at case creation;
   * `[]` = no blockers (always activatable). References earlier positions only.
   */
  blocks: number[]
  recommendWhen: RecommendWhen | null
  /**
   * The phase's due date (ISO `YYYY-MM-DD`), set/edited/removed by the
   * coordinator on activation. `null` = no due date. A past date on an open
   * phase renders as overdue.
   */
  dueDate: string | null
  /**
   * The SNAPSHOT of the template slot's default number of days (ADR 0017),
   * copied at case creation; pre-fills the activation due-date picker. `null` =
   * no default. Never changes after creation (template edits don't reach it).
   */
  defaultDueDays: number | null
  /**
   * The phase's order in the MERGED case layout (phases interleaved with
   * narratives; Case Narratives increment, ADR 0032). Distinct from `position`,
   * which stays the immutable phase NUMBER (referenced by `blocks` /
   * `recommendWhen.fromPhase`). `null` only for legacy rows pre-backfill; the
   * merge falls back to `position`. Snapshot-copied at case creation.
   */
  displayPosition: number | null
  /**
   * The EFFECTIVE per-phase result option id (phase-results feature), or `null`
   * when the phase is not concluded, has no snapshotted ruleset and no override,
   * or the feature is off. Written in the SAME statement that flips the phase to
   * `completed` (computed or honored-override); never rewritten afterward. The
   * resolved label/colour for display is the sibling `result` projection on the
   * board/detail phase entries.
   */
  resultId: string | null
  /** When the effective result was written (ISO), or `null` if no result. */
  resultComputedAt: string | null
}

/**
 * One per-case NARRATIVE (`case_narratives`; Case Narratives increment, ADR
 * 0032): a snapshot of a template narrative-slot plus the authored prose. The
 * analogue of {@link CasePhase} on the narrative side. `displayLabel` is the
 * effective label SNAPSHOTTED at case creation (so later vocabulary edits do not
 * rewrite an opened case); `bodyMd` is the de-identified sanitized-Markdown body
 * (Rule 7), authored inline by the coordinator and frozen once the case is
 * concluído/cancelled.
 */
export interface CaseNarrative {
  id: string
  caseId: string
  /** Provenance link to the vocabulary row (`set null` on type delete); `null` if detached. */
  narrativeTypeId: string | null
  /**
   * The effective label SNAPSHOTTED at creation (never rewritten by vocab edits).
   * Renamed from `typeLabel` by ADR 0137 D10 (`case_narratives.type_label` ->
   * `display_label`) — it is the displayed string, not a key into the type
   * vocabulary. ⛔ Unrelated to `ProcessTemplateNarrative.typeLabel` (the LIVE
   * joined `case_narrative_types.label`) and to the referral `typeLabel`
   * (`case_referral.type_label`), NEITHER of which was renamed.
   */
  displayLabel: string
  /** Order in the merged case layout (interleaved with phases by `displayPosition`). */
  displayPosition: number
  /** Optional per-slot label override snapshotted from the template; `null` if none. */
  title: string | null
  /** Optional authoring guidance snapshotted from the template; `null` if none. */
  instructions: string | null
  /** Advisory close flag (decision 7): a soft warning if left empty at conclude. */
  isExpected: boolean
  /**
   * True when the narrative was appended mid-case via `add_ad_hoc_narrative`
   * (ADR 0032 v2) rather than materialized from the process template at creation.
   * Mirrors {@link CasePhase.isAdHoc}; drives the "Ad-hoc" provenance chip.
   */
  isAdHoc: boolean
  /** The authored de-identified Markdown body (Rule 7); `null`/empty when unwritten. */
  bodyMd: string | null
  /**
   * The member assigned to author this narrative (Case Access Control, ADR 0033
   * D5; mirrors {@link CasePhase.assignedTo}), or `null` when un-assigned. The
   * assignee gains full-case read automatically and is the sole non-coordinator who
   * may write an ATTRIBUTED narrative (Q14). Existing rows pre-BE-4 are `null`.
   */
  assignedTo: string | null
  /** The assignee's display name (joined); `null` if unassigned/unresolved. */
  assigneeName: string | null
  /**
   * The narrative's lifecycle status (ADR 0033 D5): `open` (editable by the
   * assignee / un-attributed write-grantee) → `completed` (body frozen). The Case
   * Correction Lifecycle (BE-4) adds `voided` (a concluded narrative voided via an
   * approved void request). Post-conclusion changes go through the correction flow,
   * not an in-place reopen. Defaults to `open` for existing rows.
   */
  status: 'open' | 'completed' | 'voided'
  /** When it was concluded (ISO), or `null` while `aberta`. */
  concludedAt: string | null
  /** Who concluded it (profile id), or `null` while `aberta`. */
  concludedBy: string | null
  updatedAt: string
}

/** One row of the cases board: a case header + its phases' STATUS summary. */
/**
 * One case custom-field VALUE (`case_custom_field_values`; ADR 0083): the frozen
 * snapshot of a template def plus the case's stored value. `value` preserves its
 * JSON type — a `number` field stays a `number` (no lexical-compare pitfall); a
 * `date` / single-select / `short_text` field is a string; `null` when unset. The
 * frontend resolves a single-select `value` (an option `code`) to a label via
 * {@link options}.
 */
export interface CaseCustomFieldValue {
  id: string
  caseId: string
  /** Provenance FK to the live def; `null` if the def was later deleted. */
  templateFieldId: string | null
  key: string
  label: string
  fieldType: CustomFieldType
  /** Frozen option snapshot (`[]` unless the field is a single-select type). */
  options: CustomFieldOption[]
  value: string | number | null
  position: number
}

export interface CaseBoardRow {
  case: Case
  /**
   * The case's assigned outcome resolved for display (label/flags), or `null` if
   * none assigned. Lets the table render the outcome column + the outcome /
   * adverse filters (D14) without a second fetch.
   */
  outcome: ResolvedCaseOutcome | null
  /** Phase status only — NEVER answers (the Phase-7 invariant). */
  phases: Array<
    Pick<
      CasePhase,
      | 'position'
      | 'title'
      | 'status'
      | 'recommended'
      | 'assignedTo'
      | 'assigneeName'
      | 'dueDate'
    > & {
      /**
       * The phase's EFFECTIVE result resolved for display (label/colour/source),
       * or `null` when none / the feature is off. Resolved LIVE from
       * `phase_results` so vocabulary edits propagate; lets the board render the
       * result badge without a second fetch.
       */
      result: ResolvedPhaseResult | null
    }
  >
  /**
   * The count of this case's OPEN narratives (`case_narratives.status = 'open'`).
   * SCALAR only — the board renders no narrative rows (minimum-necessary), so no
   * `narratives[]` array is carried here. `0` when the case has none / the
   * `case_narratives` feature is off. Feeds the "Etapas pendentes" KPI, which sums
   * pending phases + open narratives.
   */
  openNarrativeCount: number
  /**
   * The case's custom-field values whose DEF is flagged `show_in_list` (ADR 0083
   * D8), ordered by `position` — for the opt-in list column/filter. `[]` when the
   * case has none flagged / the `case_custom_fields` feature is off. Read in ONE
   * supplementary batched query (not N+1); see {@link listCasesBoard}.
   */
  customFields: CaseCustomFieldValue[]
}

/**
 * Full per-case detail: the case header + every phase. For each phase,
 * `responseId`/`submittedAt` are non-null ONLY when the phase's response is
 * FROZEN — `completed`, or `awaiting_signoff` (ADR 0136), where the coordinator
 * must read the record in order to attest to it. The coordinator deep-links those
 * to the existing staff_admin submitted-response detail view; every other phase
 * status exposes status only.
 */
export interface CaseDetail {
  case: Case
  /**
   * Resolved UI-label bundle for this case's type (ADR 0064 D4; O-1), merged over the
   * platform defaults per `term_key` — so a type-less case renders today's labels
   * byte-for-byte. Resolved from `case_type_terminology` via
   * {@link getCaseTypeTerminology}. (`caseTypeId` itself lives on the nested {@link case}.)
   */
  terminology: CaseTypeTerminology
  /**
   * The case type's `primary_subject_kind` (ADR 0064 D4), or `'patient'` for a type-less
   * case (today's patient-centric framing). Defense-in-depth for the FE patient-panel
   * omit: a non-`'patient'` kind (e.g. an Ethics case → `'professional'`) means the
   * patient panel does not apply. Read RLS-scoped from `case_types` alongside the envelope.
   */
  primarySubjectKind: PrimarySubjectKind
  /**
   * The case's assigned outcome resolved for display (label/flags + the advisory
   * `requiresActionPlan` / `isAdverse` markers, D10), or `null` if none assigned.
   * Resolved LIVE from the vocabulary so edits propagate (D11).
   */
  outcome: ResolvedCaseOutcome | null
  /**
   * The outcomes this case OFFERS — its FROZEN offered set
   * (`case_offered_outcomes`, snapshotted at creation, D15), resolved to
   * label/flags. The outcome SELECTOR and the conclude dialog choose from THIS.
   * `[]` when the case's process offered none (conclude needs no outcome then).
   */
  offeredOutcomes: OfferedCaseOutcome[]
  phases: Array<
    CasePhase & {
      responseId: string | null
      submittedAt: string | null
      /**
       * The phase's EFFECTIVE result resolved for display (label/colour/source),
       * or `null` when none / the feature is off. Resolved LIVE from
       * `phase_results` (propagates vocabulary edits); the `result_id` it resolves
       * is the `resultId` on the `CasePhase`. Drives the result badge + the
       * "manual" marker on the case detail/timeline.
       */
      result: ResolvedPhaseResult | null
      /**
       * Whether this phase emits a result at all (phase-result-manual-mode):
       * `false` → NONE (no result, no correction picker). Threaded so the
       * post-conclusion correction surface (staff_admin) can hide the affordance
       * on a non-emitting phase. The `get_case_detail` RPC does not carry this, so
       * it is read RLS-scoped alongside the envelope (see {@link getCaseDetail}).
       */
      emitsResult: boolean
      /**
       * For a MANUAL phase (emits a result, no automatic ruleset), the author-
       * selected ALLOWED SUBSET of result option ids (from
       * `case_phases.allowed_result_ids`); `null` for an automatic or non-emitting
       * phase. The post-conclusion correction picker restricts to THIS subset
       * (resolved + ordered against the live vocabulary, like the wizard's manual
       * picker) so the staff_admin never picks an option the server would reject
       * with HC058. Mirrors {@link getCasePhaseForFill}.
       */
      manualResultIds: string[] | null
    }
  >
  /**
   * The case's NARRATIVES (`case_narratives`; ADR 0032), ordered by
   * `displayPosition`, interleaved with `phases` for the merged render via
   * {@link import('@/lib/queries/case-narratives').mergeCaseLayout}. `[]` when the
   * `case_narratives` feature is off or the case has none. `bodyMd` IS present
   * here (de-identified governance prose for the coordinator); only the audit log
   * excludes it.
   */
  narratives: CaseNarrative[]
  /**
   * The CURRENT viewer's capability descriptor for this case (Case Access Control
   * increment, ADR 0033). The capability-gated detail component reads this to show
   * lifecycle/assignment only for `canManageLifecycle`, content editors for
   * `canWriteContent`, and read-only otherwise. With the `case_access` flag OFF
   * the payload is only reachable by a coordinator (today's behavior), so this is
   * `{ canRead: true, canWriteContent: true, canManageLifecycle: true }`. A
   * capability signal, NOT the security boundary (RLS is — Rule 1).
   */
  viewerCapabilities: CaseViewerCapabilities
  /**
   * The case's snapshotted confidentiality ceiling (ADR 0072 D1 · E1). Drives the
   * confidentiality badge + the document-ceiling affordances. Defaults to
   * `non_phi_internal` until BE-2 lands the `cases.confidentiality_level` column +
   * BE-7 surfaces it (the flag-OFF value = today's behaviour).
   */
  confidentialityLevel: CaseConfidentialityLevel
  /**
   * The case's snapshotted access model (ADR 0072 D1 · E1). `explicit_grants_only`
   * (ethics) is grant/attribution-only; `commission_default` is today's member reach.
   * Defaults to `commission_default` until BE-2/BE-7.
   */
  visibilityPolicy: VisibilityPolicy
  /**
   * The case's participants resolved for display (ADR 0064 `case_participants` · E1).
   * `[]` until BE-7 surfaces them / with the `case_participants` flag OFF. Writes go
   * through the D6 DEFINER RPCs (`src/lib/participants/actions.ts`).
   */
  participants: CaseParticipant[]
  /**
   * The CURRENT viewer's LIVE recusal on this case (ADR 0072 D4 · E1), or `null`.
   * Present via the `case_recusals` self-arm so the UI can show the "impedido" banner
   * even though a live recusal denies case-read. `null` until BE-7.
   */
  myRecusal: CaseRecusal | null
  /**
   * The CURRENT viewer's own conflict declaration on this case (ADR 0072 D4 · E1), or
   * `null`. `null` until BE-7.
   */
  myConflict: CaseConflictDeclaration | null
}

/** The assignee's phase-fill landing: the phase + its parent case (metadata). */
export interface CasePhaseForFill {
  phase: CasePhase
  case: Case
  /**
   * Result context for the end-of-wizard override panel (phase-results feature),
   * or `null` when the feature is off. Lets the responder page thread the phase's
   * snapshotted ruleset (for the live computed preview), the active result options
   * (the override picker), and the current stashed override into `WizardData`.
   * Standalone (non-case) fills never carry this.
   */
  result: {
    /**
     * The phase's result MODE (phase-result-manual-mode). `automatic` = the
     * snapshotted ruleset computes the result (the filler may optionally
     * override); `manual` = the filler MUST pick from `options` (the
     * author-selected subset) before submit.
     */
    mode: 'automatic' | 'manual'
    /** The phase's SNAPSHOTTED ruleset (`case_phases.result_ruleset`); `null` for manual. */
    resultRuleset: ResultRuleset | null
    /**
     * The selectable result options. AUTOMATIC: the commission's ACTIVE
     * vocabulary (optional override). MANUAL: only the author-selected allowed
     * subset (the required picker).
     */
    options: ResolvedPhaseResult[]
    /**
     * The currently-stashed selection/override option id (set pre-submit), or
     * `null`. For manual phases this is the filler's chosen result.
     */
    currentOverrideId: string | null
  } | null
}

// ---------------------------------------------------------------------------
// Case Access Control (ADR 0033) — viewer capabilities + "Meus Casos"
// ---------------------------------------------------------------------------

/**
 * The CURRENT viewer's capability descriptor for ONE case (ADR 0033 D7). Drives
 * the single capability-gated detail component (generalizing the interviews
 * `viewerCanWrite` signal): the page renders the lifecycle/assignment controls
 * only when `canManageLifecycle`, the content editors when `canWriteContent`, and
 * read-only otherwise. Computed server-side for `auth.uid()`; this is a
 * CAPABILITY signal, NOT the security boundary — RLS is (Rule 1).
 *
 * ⚠ The three bits below are stated from the LIVE CATALOG (re-measured
 * 2026-08-21: `app._case_caps`, `app.can_write_case_content`,
 * `public.case_viewer_capabilities`, `public.get_case_detail`), which is the only
 * truth for them — migration text is stale by design here. An earlier version of
 * this comment asserted an `/admin` arm on the two write bits and a
 * `case_access(level)` grant shape; BOTH had been gone for months (M7 /
 * BUG-QOB-002 cut the admin arms — pinned by
 * `supabase/tests/314_qob_org_admin_content_wall.sql:845`; ADR 0078 Stage B
 * replaced `case_access(level)` with per-column `case_access_grants`). Re-measure
 * before trusting this paragraph; do not extend it from memory.
 *
 *   - `canRead`            — the viewer may open the full case. Backed by
 *                            `app.can_read_case`, a thin projection of the
 *                            `read_case_content` bit of `app._case_caps` — five
 *                            arms set it: coordinator (S1), a per-case grant (S3),
 *                            phase/narrative ASSIGNMENT (S4), NSP referral-touched
 *                            (S6), quality reviewer on an oversight-visible
 *                            commission (S7).
 *                            ⛔ A plain committee member is NOT among them. S5
 *                            confers `read_case_deliberation` ONLY, and
 *                            `has_case_capability` is a bare bitmask test with no
 *                            lattice closure — so bare membership yields
 *                            `canRead = false`. Measured 2026-08-21 on the seed:
 *                            three CCIH `staff` with zero grants and zero
 *                            assignments (`ativo.registro`, `dr.john`,
 *                            `staff4.ccih`) return `can_read = f` while
 *                            `read_case_deliberation = t`; every seed member who
 *                            reads does so through S3 or S4. Do not restate this
 *                            arm as "members can read" — that inference was made
 *                            here once and the control refuted it.
 *                            On a `get_case_detail` payload the bit is hard-coded
 *                            `true` (you only hold the payload if you could read
 *                            it); `case_viewer_capabilities` evaluates it for real.
 *   - `canWriteContent`    — the viewer may author UN-attributed narratives and
 *                            manage non-identity-bound content (action items,
 *                            documents, tags, events). Backed by
 *                            `app.can_write_case_content` → the
 *                            `write_case_content` bit, which exactly TWO arms set:
 *                            a `staff_admin` MEMBERSHIP of the case's commission
 *                            (S1), or a live `case_access_grants` row whose
 *                            `write_case_content` COLUMN is true (S3 — never
 *                            inferred from a read grant). NO admin arm: a tenancy
 *                            admin gets `manage_case_access` only (S2) and a
 *                            platform_admin gets no arm at all. NO assignment arm
 *                            (ADR 0072 D10 — a deliberate divergence from the read
 *                            side; the SQL says "do not fix it"). Does NOT grant
 *                            phase-fill (identity-bound) nor lifecycle.
 *   - `canManageLifecycle` — `app.is_staff_admin_of_for(commission, uid)` — an
 *                            active `staff_admin` membership of the case's own
 *                            commission, under that hat. No admin arm either
 *                            (that is precisely what M7 cut).
 *                            ⛔ This bit is NOT the whole authority for every door
 *                            it is used to gate. `activate_phase` and
 *                            `reassign_phase` ALSO admit
 *                            `app.member_can(commission, 'assign_case_phases')`
 *                            (ADR 0061), so gate phase assignment on that
 *                            capability — via `canInCommission` — never on this
 *                            bit, or an Administrativo loses an affordance the DB
 *                            grants them. `add_ad_hoc_phase` /
 *                            `add_ad_hoc_narrative` / `assign_narrative` are
 *                            genuinely coordinator-only (verified), and
 *                            `update_case_meta` takes `member_can('create_cases')`.
 *
 * Both write bits sit behind `app._case_caps`' unconditional hard denies: an
 * inactive/suspended principal, a case RESPONDENT, and a RECUSED principal all
 * resolve to zero capabilities before any positive arm is evaluated.
 */
export interface CaseViewerCapabilities {
  canRead: boolean
  canWriteContent: boolean
  canManageLifecycle: boolean
}

/**
 * ONE round trip to `public.case_viewer_capabilities(p_case_id)` for the CURRENT
 * viewer, reduced to the single bit {@link canOpenCaseManagement} needs.
 *
 * `cache()`-wrapped so the two call sites that can co-occur in one render pass
 * (the manage-detail layout gate and a "Gerenciar caso" affordance below it, or
 * several board rows for the same case) collapse to one call — the same
 * treatment {@link getCaseDetail} gets.
 *
 * ⛔ FAIL-CLOSED, unconditionally. Every non-answer — RPC error, a payload that
 * is not a JSON object, a missing/non-`true` key, a thrown client error — yields
 * `false`. A probe failure must never read as "allowed": this predicate decides
 * whether a management surface opens, and the RPC's own contract already returns
 * all-false rather than raising for an unknown case, so a failure here means we
 * genuinely do not know.
 *
 * Verified live 2026-08-21 (local catalog + PostgREST, not migration text): the
 * function exists as `public.case_viewer_capabilities(p_case_id uuid) RETURNS
 * jsonb`, is `SECURITY DEFINER`, and carries an EXPLICIT `authenticated=X/postgres`
 * EXECUTE grant (not a NULL/default ACL) — a plain `staff` member holding only a
 * per-case write grant gets `HTTP 200 {"can_read":true,"can_write_content":true,
 * "can_manage_lifecycle":false}`. "A correct door nothing can reach" does not
 * apply here; no `get_case_detail` fallback is needed.
 */
const probeCaseWriteContent = cache(async (caseId: string): Promise<boolean> => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('case_viewer_capabilities', {
      p_case_id: caseId,
    })
    if (error || typeof data !== 'object' || data === null || Array.isArray(data)) {
      return false
    }
    return data.can_write_content === true
  } catch {
    return false
  }
})

/**
 * **May this viewer open the MANAGE surface for this case?** (ADR 0134 D3.)
 *
 * The predicate is `staff_admin ∨ isAdministrativo ∨ canWriteContent(this case)`.
 * A pure read-grantee, a plain committee member, a quality reviewer, a tenancy
 * admin (org_admin / hospital_admin) and a platform_admin all resolve `false` —
 * their surface is `/casos`.
 *
 * ⭐ SINGLE-POINT PREDICATE — this is the whole reason it exists. It backs BOTH
 * the `manage/cases/[caseId]/(detail)` entry gate (T1) and the "Gerenciar caso"
 * button plus the board/list row links that lead there (T2/T5). Two hand-written
 * copies of this expression is exactly how a gate and the button that points at
 * it drift apart, and the drift is invisible until a user hits a 404 from a
 * control the UI offered them.
 *
 * ⚠ **UX gate, not the security boundary** (Rule 1). Every DB door still decides
 * for itself; passing here opens a surface, never a right. Note the asymmetry
 * this leaves deliberately intact: the layout's SECOND gate (`getCaseDetail`
 * returning null ⇒ `notFound()`) is what stops an appointed Administrativo who
 * cannot actually read THIS case — `isAdministrativo` is independent of both
 * capabilities and per-case read reach until the ADR 0134 D6 `_case_caps` S8 arm
 * lands, so this predicate alone is intentionally wider than reachability.
 *
 * Evaluation order is cheapest-first and short-circuits: the two role/appointment
 * arms are already resolved on `access` and cost NO query, so a coordinator or an
 * Administrativo never reaches the per-case probe. Only the write-grantee arm
 * pays a round trip.
 *
 * @param access  The commission access object from `getCommissionAccessByOrg`.
 *                Narrowed to the two fields actually read, like `canInCommission`,
 *                so callers may pass a synthetic object in tests.
 * @param caseId  The case being opened. Must belong to `access.commission` — this
 *                helper does NOT verify tenancy; the caller's existing
 *                `detail.case.commissionId !== access.commission.id` check does
 *                (a cross-commission id fails the probe anyway, since
 *                `can_write_case_content` is evaluated on the case's OWN
 *                commission).
 * @param knownCapabilities  Optional escape from the round trip for a caller that
 *                ALREADY holds this case's viewer capabilities — the manage
 *                layout fetches `getCaseDetail` a few lines later, so it can pass
 *                `detail.viewerCapabilities` instead of probing a second time.
 *                Pass `null`/omit to probe.
 */
export async function canOpenCaseManagement(
  access: Pick<CommissionAccess, 'role' | 'isAdministrativo'>,
  caseId: string,
  knownCapabilities?: Pick<CaseViewerCapabilities, 'canWriteContent'> | null,
): Promise<boolean> {
  // Arm 1 — the commission coordinator. Membership role only: `access.role` is
  // `'staff' | 'staff_admin' | null` and is populated from the caller's
  // `memberships` row alone (ADR 0100 D12 / BUG-QOB-003 deleted the tenancy-admin
  // -> 'staff_admin' coercion), so no tenancy or platform admin can arrive here.
  if (access.role === 'staff_admin') {
    return true
  }

  // Arm 2 — an appointed Administrativo of THIS commission (ADR 0061). Already
  // flag-aware: `getCommissionAccessByOrg` forces it false when the
  // `administrativo` kill switch is off, mirroring `app.member_can`.
  if (access.isAdministrativo) {
    return true
  }

  // Arm 3 — a per-case content-write grant (`_case_caps` S3). The only arm that
  // costs a query, and the only one that is per-CASE rather than per-commission.
  if (knownCapabilities) {
    return knownCapabilities.canWriteContent === true
  }

  return probeCaseWriteContent(caseId)
}

// ---------------------------------------------------------------------------
// Ethics access spine (ADR 0072 · E1) — confidentiality, participants,
// recusal/COI. CONTRACT-FIRST types: posted at BE-1, populated at BE-2..BE-7.
// ---------------------------------------------------------------------------

/**
 * The platform's SINGLE confidentiality vocabulary (ADR 0072 D1; the F2 label set
 * on `attachments.confidentiality_label`). Snapshotted onto `cases.confidentiality_level`
 * at create and spoken by interviews (post-BE-6 remap) too. Ordinary labels stay at
 * case-read; `legal_privileged` + `credentialing_sensitive` gate above it at the
 * document ceiling (O2). English keys; pt-BR labels in the UI (Rule 10).
 */
export type CaseConfidentialityLevel =
  | 'non_phi_internal'
  | 'phi_standard'
  | 'phi_restricted'
  | 'peer_review_confidential'
  | 'legal_privileged'
  | 'ethics_investigation'
  | 'credentialing_sensitive'

/**
 * The case's ACCESS MODEL (ADR 0072 D1), snapshotted onto `cases.visibility_policy`
 * at create from `case_types.default_visibility_policy`:
 *   - `commission_default`    — today's behaviour (member reach via the board / Meus Casos).
 *   - `explicit_grants_only`  — ethics deliberation; grant/attribution-only, no member-wide read.
 */
export type VisibilityPolicy = 'commission_default' | 'explicit_grants_only'

/** The registry participant kind (`participants.participant_type`; ADR 0064). */
export type ParticipantType =
  | 'patient'
  | 'professional'
  | 'external_person'
  | 'department'
  | 'institution'
  | 'regulatory_body'
  | 'other'

/** A COI declaration's kind (`case_conflict_declarations.conflict_type`; ADR 0072 D4). */
export type ConflictType =
  | 'professional_relationship'
  | 'personal_relationship'
  | 'financial_interest'
  | 'prior_involvement'
  | 'other'

/**
 * One case × participant × role link resolved for display (ADR 0064 `case_participants`
 * + role vocabulary). Writes route through the D6 DEFINER RPCs; this is the read shape
 * `getCaseDetail` surfaces. `displayName` is the org-scoped SURROGATE label — NEVER raw
 * patient identity (Rule 12; that lives behind the audited PHI door).
 */
export interface CaseParticipant {
  /** `case_participants.id` — the link row the remove/set RPCs target. */
  id: string
  /** `participants.id` — the registry identity. */
  participantId: string
  /** The participant kind. */
  participantType: ParticipantType
  /** Org-scoped display label (surrogate for a patient; never raw identity). */
  displayName: string
  /** `case_participant_roles.id`. */
  roleId: string
  /** Stable role key (e.g. `respondent_doctor`, `complainant`). */
  roleKey: string
  /** pt-BR role label. */
  roleLabel: string
  /** At most one LIVE primary subject per case (partial-unique). */
  isPrimarySubject: boolean
  /** Optional free-text involvement note; `null` if unset. */
  involvementSummary: string | null
  /**
   * ETH·E4 (ADR 0108 D3) — `professional_profiles.id` for a professional
   * participant whose profile the CALLER CAN READ; `null` otherwise (a
   * non-professional participant, or a profile outside
   * `app.can_read_professional_profile`). The roster's "Resolver vínculo" dialog
   * targets this id.
   */
  professionalProfileId: string | null
  /**
   * ETH·E4 (ADR 0108 D3) — the LIVE `professional_profiles.full_name`, or `null`
   * when the profile is not a professional's / not readable.
   *
   * `displayName` above is a MINT-TIME SNAPSHOT taken by
   * `ensure_professional_participant`; `update_professional_profile` can move the
   * profile name afterwards and no sync was added (that would modify a second
   * shipped door for a cosmetic property). Render `professionalFullName ??
   * displayName`: readers who can see the profile always get the current name, and
   * the snapshot only ever surfaces to callers who could not read the profile.
   */
  professionalFullName: string | null
  /**
   * ETH·E4 — the professional's platform-account linkage (ADR 0078 M1·1), or
   * `null` when not a professional / not readable. `unknown` is what the roster's
   * "Resolver vínculo" affordance keys off; an unknown-linkage professional cannot
   * be seated OR promoted as `respondent_doctor` (`HC0F0`).
   *
   * Not-readable collapses to `null`, so the affordance FAILS CLOSED: a caller who
   * cannot read the profile is not nudged to fix it.
   */
  linkState: ProfessionalLinkState | null
}

/**
 * The CALLER's recusal state on a case (ADR 0072 D4; `case_recusals`). A LIVE recusal
 * (`liftedAt === null`) denies the caller case-read via the `can_read_case` deny-term,
 * but the D4 self-arm still lets them see THIS row (the "você está impedido" banner).
 */
export interface CaseRecusal {
  id: string
  caseId: string
  userId: string
  reasonMd: string | null
  source: 'self' | 'coordinator' | 'conflict'
  conflictDeclarationId: string | null
  recusedAt: string
  /** `null` while the recusal is LIVE; set once soft-lifted (read restored). */
  liftedAt: string | null
}

/**
 * The CALLER's conflict-of-interest declaration on a case (ADR 0072 D4;
 * `case_conflict_declarations`). Self-service via `declareConflict`; a coordinator may
 * resolve it (→ `recused` / `waived`).
 */
export interface CaseConflictDeclaration {
  id: string
  caseId: string
  declarantId: string
  conflictType: ConflictType
  descriptionMd: string | null
  status: 'declared' | 'recused' | 'waived'
  declaredAt: string
  resolvedAt: string | null
}

/**
 * The viewer's relationship to a case in "Meus Casos" (ADR 0033 D7), surfaced as
 * a role chip on the card:
 *   - `coordinator`  — `staff_admin`/admin of the case's commission.
 *   - `collaborator` — holds a `case_access` row at level `write` (case-wide
 *                      content author; not a coordinator).
 *   - `viewer`       — read-only access: a `case_access` `read` grant OR
 *                      attribution-derived read (a phase/narrative assignee) with
 *                      no write grant.
 */
export type MyCaseRole = 'viewer' | 'collaborator' | 'coordinator'

/**
 * One ITEM the viewer is personally attributed on within a "Meus Casos" card
 * (ADR 0033 D7): a phase they must fill OR a narrative they must author. Rendered
 * inline on the card with a direct action (Preencher / Abrir / Concluir); the
 * card always also offers "Ver caso completo".
 */
export interface MyCaseItem {
  /**
   * Which attributed kind this is. `correction` is the correction-lifecycle arm
   * (ADR 0085): the viewer holds the `permitted_corrector` slot on an OPEN request.
   * It is emitted for the corrector ONLY, and only while the `case_corrections`
   * flag is on.
   */
  kind: 'phase' | 'narrative' | 'correction'
  /**
   * The `case_phases.id` / `case_narratives.id` — or, for `correction`, the
   * `case_correction_requests.id` (the REQUEST, not its target; the target is in
   * {@link casePhaseId} / {@link caseNarrativeId}).
   */
  id: string
  /**
   * Display title (phase: title|form|"Fase N"; narrative: `display_label`/title). A
   * `correction` carries its TARGET's title — the corrector is being asked to fix
   * "Fase 2", and the request's own id is not a thing they recognise.
   */
  title: string
  /**
   * The item's own status slug — a {@link CasePhaseStatus} for a phase, a
   * narrative status (`'open' | 'completed'`) for a narrative, a
   * {@link CorrectionStatus} for a correction. A stable ASCII union the card maps
   * to a pt-BR pill; not itself a label.
   */
  status: string
  /** The item's order in the merged case layout (interleave; phases ∪ narratives). */
  displayPosition: number
  /**
   * `true` when the viewer can act on it RIGHT NOW — a phase that is `active` AND
   * assigned to the viewer (drives "Preencher"); a narrative that is `aberta` AND
   * assigned to the viewer (drives "Abrir"/"Concluir"). `false` renders the item
   * as context only (e.g. a concluded narrative, a not-yet-active phase).
   *
   * For a `correction` this mirrors `canContinueCorrection` exactly: a `void`
   * request has no draft, and `resubmitted`/`under_review` are waiting on the
   * APPROVER — those still render (the corrector should see the request is in
   * flight), just without a button.
   */
  actionable: boolean
  /**
   * `correction` only — what the request does to its target (`correction` /
   * `addendum` / `void`). `null` on a phase/narrative item.
   */
  correctionKind: 'correction' | 'addendum' | 'void' | null
  /**
   * `correction` only — the target `case_phases.id`, or `null` for a narrative
   * correction. "Continuar correção" needs it to route into the phase responder.
   */
  casePhaseId: string | null
  /** `correction` only — the target `case_narratives.id`, or `null` for a phase. */
  caseNarrativeId: string | null
}

/**
 * One card of "Meus Casos" (ADR 0033 D7) — every case the member can access
 * (attributed OR granted), one per card, replacing "Minhas fases". The member's
 * own attributed items are listed inline (`items`) with direct actions; the card
 * always offers "Ver caso completo" (the capability-gated detail page). A case the
 * member can only READ (a pure read grant, no attribution) still appears, with an
 * empty `items` array. Never carries answers (Phase-7 invariant) — status only.
 */
export interface MyCase {
  caseId: string
  /** Per-commission counter ("Caso 0042" is `caseNumber = 42`). */
  caseNumber: number
  /** Optional NON-IDENTIFYING label; `null` if none. */
  label: string | null
  status: CaseStatus
  /** The viewer's role chip for this card. */
  myRole: MyCaseRole
  /**
   * The viewer's personally-attributed items in this case (phases + narratives),
   * ordered by `displayPosition`. `[]` when the viewer only has a read/write GRANT
   * and is attributed on nothing (the card still shows "Ver caso completo").
   */
  items: MyCaseItem[]
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// RPC / row payload shapes
// ---------------------------------------------------------------------------

/** One phase entry inside a `list_cases_board` row's `phases` jsonb array. */
interface BoardPhaseJson {
  position: number
  title: string | null
  status: CasePhaseStatus
  recommended: boolean
  assigned_to: string | null
  assignee_name: string | null
  due_date: string | null
  /** The phase's effective result, resolved LIVE (`null` when none / flag off). */
  result: ResolvedPhaseResultJson | null
}

/** A resolved phase-result inside a board/detail envelope (label + flags + source). */
interface ResolvedPhaseResultJson {
  id: string
  label: string
  color_token: ResolvedPhaseResult['colorToken']
  is_adverse: boolean
  source: 'computed' | 'manual' | null
}

/** Map a resolved-phase-result envelope object to its domain shape (`null`-safe). */
function mapPhaseResultJson(
  r: ResolvedPhaseResultJson | null,
): ResolvedPhaseResult | null {
  if (!r) return null
  return {
    id: r.id,
    label: r.label,
    colorToken: r.color_token,
    isAdverse: r.is_adverse,
    source: r.source,
  }
}

/** A resolved outcome inside a board row / detail envelope (label + flags). */
interface OutcomeJson {
  id: string
  label: string
  color_token: CaseStatusColorToken
  requires_action_plan: boolean
  is_adverse: boolean
}

/** Map a resolved-outcome envelope object to its domain shape (`null`-safe). */
function mapOutcomeJson(o: OutcomeJson | null): ResolvedCaseOutcome | null {
  if (!o) return null
  return {
    id: o.id,
    label: o.label,
    colorToken: o.color_token,
    requiresActionPlan: o.requires_action_plan,
    isAdverse: o.is_adverse,
  }
}

/** One row of `list_cases_board`. */
interface BoardRowJson {
  case_id: string
  case_number: number
  label: string | null
  status: CaseStatus
  outcome_id: string | null
  /** The resolved assigned-outcome object, or `null` if none. */
  outcome: OutcomeJson | null
  created_at: string
  closed_at: string | null
  phases: BoardPhaseJson[]
  /** Scalar count of the case's open narratives (status='open'). */
  open_narrative_count: number
}

/**
 * D3 (F-cleanup): re-aggregate a `case_phase_allowed_results` embed back to the
 * byte-identical `string[] | null` domain shape (ordered by position; empty ⇒ null,
 * matching the pre-D3 "null = no allowed set" contract). Replaces the direct read of
 * the removed `case_phases.allowed_result_ids` jsonb column.
 */
function allowedFromJunction(
  rows: { result_id: string; position: number }[] | null | undefined,
): string[] | null {
  const list = rows ?? []
  if (list.length === 0) return null
  return list
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((r) => r.result_id)
}

/**
 * The result-MODE columns of a `case_phases` row (phase-result-manual-mode),
 * read RLS-scoped to supplement the `get_case_detail` envelope (which omits
 * them). The MODE is the ruleset's presence (ruleset → automatic; none → manual);
 * the allowed subset (D3: `case_phase_allowed_results`) is the author-selected set
 * (present for both modes when emitting). The correction picker derives the
 * MANUAL-only subset from these.
 */
interface CasePhaseModeRow {
  id: string
  emits_result: boolean
  result_ruleset: ResultRuleset | null
  case_phase_allowed_results: { result_id: string; position: number }[] | null
}

/**
 * The MANUAL-only allowed subset of a case phase (for the correction picker): the
 * allowed subset when the phase emits a result with NO automatic ruleset (manual),
 * else `null` (automatic phases keep full-flexibility corrections; non-emitting
 * phases have no result). Mirrors the wizard's `loadPhaseResultContext` mode rule.
 */
function manualSubsetOf(row: CasePhaseModeRow | undefined): string[] | null {
  if (!row || !row.emits_result || row.result_ruleset != null) return null
  return allowedFromJunction(row.case_phase_allowed_results)
}

/** One phase entry inside the `get_case_detail` jsonb envelope. */
interface DetailPhaseJson {
  id: string
  position: number
  form_id: string
  form_version_id: string
  form_title: string | null
  title: string | null
  status: CasePhaseStatus
  recommended: boolean
  assigned_to: string | null
  assignee_name: string | null
  is_ad_hoc: boolean
  blocks: number[] | null
  recommend_when: RecommendWhen | null
  due_date: string | null
  default_due_days: number | null
  display_position: number | null
  response_id: string | null
  submitted_at: string | null
  /** phase-results: the effective result id/stamp + a LIVE-resolved object. */
  result_id: string | null
  result_computed_at: string | null
  result: ResolvedPhaseResultJson | null
}

/**
 * One narrative entry inside the `get_case_detail` jsonb envelope's `narratives`
 * array (Case Narratives increment, ADR 0032). `body_md` IS present — the
 * coordinator read path; only the audit log excludes it.
 */
interface DetailNarrativeJson {
  id: string
  narrative_type_id: string | null
  display_label: string
  display_position: number
  title: string | null
  instructions: string | null
  is_expected: boolean
  /** Ad-hoc provenance (ADR 0032 v2), added to `get_case_detail`. */
  is_ad_hoc?: boolean
  body_md: string | null
  /**
   * Narrative attribution + lifecycle (ADR 0033 D5), added to `get_case_detail` in
   * BE-4. Absent on a pre-BE-4 envelope → the mapper defaults to un-assigned /
   * `aberta` (the correct state for existing rows).
   */
  assigned_to?: string | null
  assignee_name?: string | null
  status?: 'open' | 'completed' | null
  concluded_at?: string | null
  concluded_by?: string | null
  updated_at: string
}

/** Map a `get_case_detail` narrative envelope object to its domain shape. */
function mapNarrativeJson(n: DetailNarrativeJson, caseId: string): CaseNarrative {
  return {
    id: n.id,
    caseId,
    narrativeTypeId: n.narrative_type_id ?? null,
    displayLabel: n.display_label,
    displayPosition: n.display_position,
    title: n.title,
    instructions: n.instructions,
    isExpected: n.is_expected,
    isAdHoc: n.is_ad_hoc ?? false,
    bodyMd: n.body_md,
    // Attribution + lifecycle (ADR 0033). Pre-BE-4 the RPC omits these → un-assigned
    // / aberta, which is exactly the state of an existing narrative row.
    assignedTo: n.assigned_to ?? null,
    assigneeName: n.assignee_name ?? null,
    status: n.status ?? 'open',
    concludedAt: n.concluded_at ?? null,
    concludedBy: n.concluded_by ?? null,
    updatedAt: n.updated_at,
  }
}

/** The `get_case_detail` jsonb envelope. */
interface CaseDetailJson {
  id: string
  commission_id: string
  template_id: string | null
  case_number: number
  label: string | null
  status: CaseStatus
  outcome_id: string | null
  /** The resolved assigned-outcome object, or `null` if none. */
  outcome: OutcomeJson | null
  /** Denormalized "an isolated case_patient (PHI) row exists" flag (ADR 0038). */
  has_patient?: boolean | null
  /**
   * ADR 0137 D1 — the three-mode PHI collection setting.
   *
   * ⛔ **There is NO `patient_enabled` key on this envelope any more, and re-adding one
   * would be a regression, not a convenience** (`FUP-0137-PHI-MODE-SHIMS`, closed
   * 2026-08-24 by migration `20261003001800`). A boolean over a three-valued setting is
   * lossy in exactly one direction — the NEW one: it cannot express `required`, so a
   * screen wired to it is silently unable to configure the compliance mode ADR 0137 was
   * written to introduce, and no gate would ever fire. Keystone: pgTAP `366`.
   */
  patient_mode?: string | null
  /** ADR 0137 D2 — the required identifier set when `patient_mode` is 'required'. */
  patient_required_fields?: string[] | null
  /** The frozen offered-outcome set, resolved to label/flags (`[]` if none). */
  offered_outcomes: OutcomeJson[] | null
  created_at: string
  closed_at: string | null
  phases: DetailPhaseJson[]
  /** The case's narratives, ordered by `display_position` (`[]` if none / flag off). */
  narratives: DetailNarrativeJson[] | null
  /**
   * The viewer's capability descriptor (ADR 0033), added by `get_case_detail` in
   * BE-4. Absent on a pre-BE-4 envelope → the mapper defaults to coordinator-grade
   * (the only way the current `is_staff_admin_of`-gated RPC returns at all).
   */
  viewer_capabilities?: {
    can_read: boolean
    can_write_content: boolean
    can_manage_lifecycle: boolean
  } | null
}

/**
 * One `case_participants` row with its embedded registry + role (ADR 0072 · E1),
 * read RLS-scoped alongside the `get_case_detail` envelope (the to-one embeds resolve
 * to an object or `null`).
 */
interface CaseParticipantRow {
  id: string
  participant_id: string
  is_primary_subject: boolean
  involvement_summary: string | null
  participants: { participant_type: string; display_name: string } | null
  case_participant_roles: { id: string; key: string; display_name: string } | null
}

/**
 * ETH·E4 — the professional-identity enrichment row. Read through
 * `professional_participants_select`, whose USING clause is
 * `app.can_read_professional_profile(professional_profile_id, auth.uid())`, so an
 * unreadable profile simply does not come back and the enrichment collapses to
 * `null` (fail-closed).
 */
interface ProfessionalParticipantRow {
  participant_id: string
  professional_profiles: {
    id: string
    full_name: string
    link_state: string
  } | null
}

/** The board CAP (WS-6 P3). The cases board is a kanban (column-per-status), which
 * a flat keyset cursor cannot page without emptying columns — so it is CAPPED to
 * the most-recent-N cases (by case_number desc) and returned as a single
 * non-cursored page (`nextCursor: null`). N is well above any real pre-pilot
 * per-commission case count. */
const CASES_BOARD_CAP = 200

/**
 * The cases board for a commission: one row per case + each case's phases'
 * STATUS summary (no answers). Backed by the SECURITY DEFINER `list_cases_board`.
 * Ordered by the RPC (most recent first).
 *
 * AUTHORIZATION: every row is filtered by `app.can_read_case` — the single case-read
 * boundary, including ADR 0072 D2's hard deny (a respondent or recused user reads
 * nothing, *even if* they coordinate the commission). Callers therefore see exactly
 * the cases they may read: a coordinator effectively the whole board, a grantee or
 * assignee their subset, an Organization User **none** (A4/D4·1 — administration is
 * not a case source).
 *
 * ⚠ The previous version of this comment said the RPC was "internally gated by
 * `is_staff_admin_of`, so it returns an empty page for non-staff_admins (no leak)".
 * BOTH halves were false, and the second is the dangerous one — it described an
 * invariant the code never had (grantees and assignees always got rows) and would
 * have made an empty board look like the security model working. The RPC did carry
 * an `is_staff_admin_of OR is_tenancy_admin_of` fast-path, but it SHORT-CIRCUITED
 * the per-row filter rather than gating the call: it returned an org_admin an
 * `explicit_grants_only` ethics case, and returned a coordinator his OWN respondent
 * case, both with `can_read_case = false`. Removed in the ADR-0078 Gate-2 wave; a
 * board keystone now pins it. Do not re-add a coordinator short-circuit for speed.
 *
 * CAPPED, NOT keyset-cursored (WS-6 P3 condition-b): the board UI is column-per-
 * status, which a flat cursor can't page. Returns a `Page` for shape uniformity
 * with `nextCursor: null` always. `page.limit` may lower the cap; the RPC hard-caps
 * at whatever is passed (default {@link CASES_BOARD_CAP}).
 */
/** One `case_custom_field_values` row (jsonb `value` arrives as an unknown). */
interface CaseCustomFieldValueRow {
  id: string
  case_id: string
  template_field_id: string | null
  key: string
  label: string
  field_type: CustomFieldType
  options: CustomFieldOption[] | null
  value: unknown
  position: number
}

/** Map a `case_custom_field_values` row to the domain shape, narrowing `value`. */
function mapCaseCustomFieldValue(
  r: CaseCustomFieldValueRow,
): CaseCustomFieldValue {
  return {
    id: r.id,
    caseId: r.case_id,
    templateFieldId: r.template_field_id ?? null,
    key: r.key,
    label: r.label,
    fieldType: r.field_type,
    options: r.options ?? [],
    // number stays a number (no lexical compare); date/select/short_text are
    // strings; anything else (unset / unexpected shape) → null.
    value:
      typeof r.value === 'number' || typeof r.value === 'string'
        ? r.value
        : null,
    position: r.position ?? 0,
  }
}

/**
 * The `show_in_list`-flagged custom-field values for a set of board cases, in ONE
 * query, grouped by case id. Joins values to their live def (inner embed) to apply
 * the `show_in_list` filter. Returns an empty map on error / no ids.
 */
async function fetchBoardCustomFields(
  supabase: Awaited<ReturnType<typeof createClient>>,
  caseIds: string[],
): Promise<Map<string, CaseCustomFieldValue[]>> {
  const byCase = new Map<string, CaseCustomFieldValue[]>()
  if (caseIds.length === 0) return byCase

  const { data, error } = await supabase
    .from('case_custom_field_values')
    .select(
      'id, case_id, template_field_id, key, label, field_type, options, value, position, process_template_custom_fields!inner(show_in_list)',
    )
    .in('case_id', caseIds)
    .eq('process_template_custom_fields.show_in_list', true)
    .order('position', { ascending: true })
    .returns<CaseCustomFieldValueRow[]>()

  if (error || !data) return byCase

  for (const row of data) {
    const mapped = mapCaseCustomFieldValue(row)
    const bucket = byCase.get(mapped.caseId)
    if (bucket) bucket.push(mapped)
    else byCase.set(mapped.caseId, [mapped])
  }
  return byCase
}

/** ETH·E3a — each board case's `case_type_id`, one batched RLS-scoped read (id → typeId). */
async function fetchBoardCaseTypes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  caseIds: string[],
): Promise<Map<string, string | null>> {
  const byCase = new Map<string, string | null>()
  if (caseIds.length === 0) return byCase

  const { data, error } = await supabase
    .from('cases')
    .select('id, case_type_id')
    .in('id', caseIds)
    .returns<{ id: string; case_type_id: string | null }[]>()

  if (error || !data) return byCase
  for (const row of data) byCase.set(row.id, row.case_type_id ?? null)
  return byCase
}

/**
 * All custom-field values of one case (`case_custom_field_values`; ADR 0083),
 * ordered by `position`, for the case-detail header cluster. RLS-scoped via
 * `can_read_case` → `[]` for a caller who cannot read the case (or when the case
 * has none). Unlike the board read, this returns the FULL set (not only
 * `show_in_list`), since detail renders every descriptor.
 */
export async function listCaseCustomFieldValues(
  caseId: string,
): Promise<CaseCustomFieldValue[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('case_custom_field_values')
    .select(
      'id, case_id, template_field_id, key, label, field_type, options, value, position',
    )
    .eq('case_id', caseId)
    .order('position', { ascending: true })
    .returns<CaseCustomFieldValueRow[]>()

  if (error || !data) return []
  return data.map(mapCaseCustomFieldValue)
}

export async function listCasesBoard(
  commissionId: string,
  page?: PageParams,
): Promise<Page<CaseBoardRow>> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('list_cases_board', {
    p_commission_id: commissionId,
    p_limit: page?.limit ?? CASES_BOARD_CAP,
  })

  if (error || !data) return { rows: [], nextCursor: null }

  // ADR 0083 — the `show_in_list` custom-field values for every board case, in ONE
  // batched, RLS-scoped query (not N+1). Keyed by case id; a case with none maps to
  // `[]`. RLS (can_read_case on the values + is_member_of on the def via the inner
  // embed) fails closed for a non-member, so no leak.
  const caseIds = (data as unknown as BoardRowJson[]).map((r) => r.case_id)
  const customFieldsByCase = await fetchBoardCustomFields(supabase, caseIds)

  // ETH·E3a (O-1): project each board case's `case_type_id` in ONE batched RLS-scoped
  // read (the board RPC's TABLE signature doesn't carry it; a batched select avoids a
  // drop/recreate). Board heading stays default per FE's decision — this only carries the
  // id per row. A case the caller can't read via cases-RLS simply maps to null.
  const caseTypeByCase = await fetchBoardCaseTypes(supabase, caseIds)

  const rows = (data as unknown as BoardRowJson[]).map((r) => ({
    case: {
      id: r.case_id,
      commissionId,
      // The board row does not echo templateId (not needed for the board);
      // detail carries it.
      templateId: null,
      caseTypeId: caseTypeByCase.get(r.case_id) ?? null,
      caseNumber: r.case_number,
      label: r.label,
      status: r.status,
      outcomeId: r.outcome_id ?? null,
      createdAt: r.created_at,
      closedAt: r.closed_at,
      // The board row does not surface PHI flags (the panel only renders on the
      // detail page); default to false. The detail read carries the real values.
      hasPatient: false,
      // ADR 0137 D1 — the board row carries no PHI configuration (the panel only
      // renders on the detail page); the detail read carries the real values.
      patientMode: 'none' as PatientMode,
      patientRequiredFields: [],
      // The department name is a detail-page concern (the board renders no setor
      // column); default to null. The detail read resolves the real values.
      departmentId: null,
      departmentOther: null,
      departmentName: null,
    },
    outcome: mapOutcomeJson(r.outcome ?? null),
    phases: (r.phases ?? []).map((p) => ({
      position: p.position,
      title: p.title,
      status: p.status,
      recommended: p.recommended,
      assignedTo: p.assigned_to,
      assigneeName: p.assignee_name,
      dueDate: p.due_date,
      result: mapPhaseResultJson(p.result ?? null),
    })),
    openNarrativeCount: r.open_narrative_count ?? 0,
    customFields: customFieldsByCase.get(r.case_id) ?? [],
  }))

  return { rows, nextCursor: null }
}

/**
 * The OPEN-cases count for the coordinator sidebar badge (WS-6 P4). Backed by the
 * SECURITY DEFINER `count_open_cases_for_board`, which reproduces the board's EXACT
 * visibility (same `is_staff_admin_of` gate + commission scope) and counts only the
 * non-terminal statuses the badge shows — WITHOUT pulling the board rows + phase JSON.
 * Returns 0 for a non-staff_admin (the gate returns before counting) or on any error.
 */
export async function countOpenCasesForBoard(
  commissionId: string,
): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('count_open_cases_for_board', {
    p_commission_id: commissionId,
  })
  if (error || data == null) return 0
  return data
}

/**
 * Full detail for one case. Backed by the SECURITY DEFINER `get_case_detail`
 * (internally `is_staff_admin_of`-gated): case header + phases, with
 * `responseId`/`submittedAt` only for phases whose response is SUBMITTED
 * (`completed` / `awaiting_signoff` — ADR 0136). `null` when the caller
 * is not a staff_admin of the case's commission or the case does not exist (the
 * RPC raises, surfaced here as null).
 */
/**
 * Request-scoped memoized read of {@link getCaseDetail} (React `cache()`): the
 * Phase-12 case route fetches it from BOTH the shared `layout.tsx` (header spine)
 * AND its child (the Detalhes / Timeline tabs), so memoizing by `caseId`
 * collapses that to a single RPC per request. `cache()` is per-request and the
 * RPC is RLS-scoped, so this changes nothing about authorization or freshness —
 * only the number of round trips. Existing single-call sites are unaffected.
 */
export const getCaseDetail = cache(
  async (caseId: string): Promise<CaseDetail | null> => {
    return getCaseDetailUncached(caseId)
  },
)

async function getCaseDetailUncached(
  caseId: string,
): Promise<CaseDetail | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_case_detail', {
    p_case_id: caseId,
  })

  if (error || !data) return null

  const env = data as unknown as CaseDetailJson

  // The `get_case_detail` envelope does NOT carry each phase's result MODE inputs
  // (`emits_result` / `result_ruleset` / the allowed subset). Read them RLS-scoped
  // (commission members may read their case_phases) so the post-conclusion
  // correction picker can gate on emits-result and restrict a MANUAL phase to its
  // allowed subset — the same direct-read pattern as `getCasePhaseForFill`. A row
  // the caller may not read simply defaults to "no result mode". D3: the allowed
  // subset is embedded from case_phase_allowed_results (was allowed_result_ids jsonb).
  // ⚠ THROW. The "a row the caller may not read defaults to no-result-mode" contract
  // above is about RLS, which returns ZERO ROWS — not an error. A genuine error is a
  // different event, and swallowed it silently disables the post-conclusion result
  // correction picker.
  const { data: modeRows, error: modeError } = await supabase
    .from('case_phases')
    .select(
      'id, emits_result, result_ruleset, case_phase_allowed_results ( result_id, position )',
    )
    .eq('case_id', caseId)
    .returns<CasePhaseModeRow[]>()
  if (modeError) throw modeError
  const modeByPhaseId = new Map(
    (modeRows ?? []).map((r) => [r.id, r] as const),
  )

  // The case's department ("Unidade / setor") is NON-PHI + case-level, NOT carried by
  // the `get_case_detail` envelope (which we don't touch). Read it RLS-scoped
  // alongside the envelope, then resolve the name LIVE from `hospital_departments`
  // (the SELECT policy admits any hospital member, so a case viewer resolves it). A
  // department archived-away (or unreadable) simply yields a null name — the case
  // still shows `departmentOther` when that was used instead.
  // Also read the ethics access-spine snapshot fields (ADR 0072 · E1) here — base-table
  // columns on `cases`, RLS-scoped like the department, so the envelope RPC stays
  // untouched. Flag-OFF cases carry the today-defaults (commission_default /
  // non_phi_internal), so this is a no-op until the m2 gate opens.
  // Also read `case_type_id` (ETH·E3a; O-1) + the type's `primary_subject_kind` via the
  // cases→case_types FK embed (unambiguous — the single FK). RLS-scoped; a type-less case
  // yields null → default terminology + a 'patient' subject kind (today's framing).
  // ⚠ THROW — the highest-consequence swallow in this function. `caseTypeId`,
  // `primarySubjectKind` AND `terminology` all derive from this row, so on a
  // swallowed error an Ethics case silently reverts to the PLATFORM DEFAULT
  // vocabulary: "Caso" instead of the procedure's label, primary-subject kind back to
  // `patient` instead of `professional`. The page renders fully and looks right.
  // `.maybeSingle()` reports no-row as `data: null, error: null`, so throwing here
  // cannot break the legitimate empty case.
  const { data: deptRow, error: deptError } = await supabase
    .from('cases')
    .select(
      'department_id, department_other, visibility_policy, confidentiality_level, case_type_id, case_types ( primary_subject_kind )',
    )
    .eq('id', caseId)
    .maybeSingle()
  if (deptError) throw deptError
  const caseTypeId: string | null = deptRow?.case_type_id ?? null
  const primarySubjectKind: PrimarySubjectKind =
    (deptRow?.case_types?.primary_subject_kind as PrimarySubjectKind | undefined) ?? 'patient'
  const terminology = await getCaseTypeTerminology(caseTypeId)
  let departmentName: string | null = deptRow?.department_other ?? null
  if (deptRow?.department_id) {
    // The documented "archived-away or unreadable → null name" fallback is about RLS
    // and missing rows, both of which are `error: null` under `.maybeSingle()`. An
    // actual error is not that case, so it surfaces rather than blanking the label.
    const { data: dept, error: deptNameError } = await supabase
      .from('hospital_departments')
      .select('name')
      .eq('id', deptRow.department_id)
      .maybeSingle()
    if (deptNameError) throw deptNameError
    departmentName = dept?.name ?? null
  }

  // The case's participants (ADR 0064 · E1), RLS-scoped via `case_participants`
  // (already `can_read_case`-gated). `[]` pre-m2 / when the case has none. The
  // registry `display_name` is a SURROGATE for a patient — never raw identity (Rule 12).
  // ⚠ THROW (see the block comment on the professional embed below). Swallowed, a
  // failure here renders the ENTIRE ETH·E4 roster empty — and an empty roster is a
  // legitimate state, so nothing looks wrong. A coordinator then re-seats people who
  // are already seated. Strictly larger blast radius than the embed below.
  const { data: partRows, error: partError } = await supabase
    .from('case_participants')
    .select(
      'id, participant_id, is_primary_subject, involvement_summary, ' +
        'participants ( participant_type, display_name ), ' +
        'case_participant_roles ( id, key, display_name )',
    )
    .eq('case_id', caseId)
    .is('removed_at', null)
    .returns<CaseParticipantRow[]>()
  if (partError) throw partError

  // ETH·E4 (ADR 0108 D3) — resolve the LIVE professional identity for the roster.
  // A SEPARATE query, not an embed off `case_participants`: `participants`' only FK
  // from `professional_participants` is the COMPOSITE
  // `(participant_id, participant_type)` one, and an un-hinted embed across it is
  // the PGRST201 shape. `professional_participants → professional_profiles` has
  // exactly one FK, so THIS embed is unambiguous.
  const professionalParticipantIds = (partRows ?? [])
    .filter((r) => r.participants?.participant_type === 'professional')
    .map((r) => r.participant_id)
  const professionalByParticipant = new Map<
    string,
    { id: string; fullName: string; linkState: ProfessionalLinkState }
  >()
  if (professionalParticipantIds.length > 0) {
    const { data: profRows, error: profError } = await supabase
      .from('professional_participants')
      .select('participant_id, professional_profiles ( id, full_name, link_state )')
      .in('participant_id', professionalParticipantIds)
      .returns<ProfessionalParticipantRow[]>()
    // ⚠ THROW. This read FAILS INVISIBLY when swallowed: `profRows` is null,
    // `?? []` yields an empty map, and every professional participant then renders
    // with `prof = null` — the roster silently falls back to the mint-time
    // `display_name` snapshot instead of the live name, `professionalProfileId`
    // goes missing, and `linkState` comes back undefined, so `showResolveLinkage`
    // is false and the "Resolver vínculo" affordance DISAPPEARS. No error, no log,
    // no visible failure — just deleted functionality.
    //
    // This is also the one invoker-rights path where a future grant mistake would
    // fail this way: suite 321's set_eq pins projection ≡ granted set for the
    // DEFINER door `get_case_professional`, but nothing pins THIS select. Adding a
    // column here without granting it would 42501 — and, swallowed, would have
    // removed a feature in silence instead.
    if (profError) throw profError
    for (const row of profRows ?? []) {
      if (!row.professional_profiles) continue
      professionalByParticipant.set(row.participant_id, {
        id: row.professional_profiles.id,
        fullName: row.professional_profiles.full_name,
        linkState: row.professional_profiles.link_state as ProfessionalLinkState,
      })
    }
  }

  const participants: CaseParticipant[] = (partRows ?? []).map((r) => {
    const prof = professionalByParticipant.get(r.participant_id) ?? null
    return {
      id: r.id,
      participantId: r.participant_id,
      participantType: (r.participants?.participant_type ??
        'other') as ParticipantType,
      displayName: r.participants?.display_name ?? '',
      roleId: r.case_participant_roles?.id ?? '',
      roleKey: r.case_participant_roles?.key ?? '',
      roleLabel: r.case_participant_roles?.display_name ?? '',
      isPrimarySubject: r.is_primary_subject,
      involvementSummary: r.involvement_summary,
      professionalProfileId: prof?.id ?? null,
      professionalFullName: prof?.fullName ?? null,
      linkState: prof?.linkState ?? null,
    }
  })

  // The CURRENT viewer's live recusal + own conflict declaration (ADR 0072 D4 · E1).
  // The `case_recusals` self-arm surfaces a recused viewer's own row even though the
  // case read is denied — so the UI can show the "impedido" banner. `null` pre-m2.
  const viewerId = (await getSessionContext())?.userId ?? null
  let myRecusal: CaseRecusal | null = null
  let myConflict: CaseConflictDeclaration | null = null
  if (viewerId) {
    // ⚠ THROW. Swallowed, `myRecusal` stays null and the "você está impedido" banner
    // never renders — a recused viewer is not told they are impeded, which is a
    // governance-visible silence, not a cosmetic one.
    const { data: recRow, error: recError } = await supabase
      .from('case_recusals')
      .select(
        'id, case_id, user_id, reason_md, source, conflict_declaration_id, recused_at, lifted_at',
      )
      .eq('case_id', caseId)
      .eq('user_id', viewerId)
      .is('lifted_at', null)
      .maybeSingle()
    if (recError) throw recError
    if (recRow) {
      myRecusal = {
        id: recRow.id,
        caseId: recRow.case_id,
        userId: recRow.user_id,
        reasonMd: recRow.reason_md,
        source: recRow.source as CaseRecusal['source'],
        conflictDeclarationId: recRow.conflict_declaration_id,
        recusedAt: recRow.recused_at,
        liftedAt: recRow.lifted_at,
      }
    }
    // ⚠ THROW. Swallowed, the viewer's own COI declaration vanishes and they are
    // invited to declare a conflict they have already declared.
    const { data: coiRow, error: coiError } = await supabase
      .from('case_conflict_declarations')
      .select(
        'id, case_id, declarant_id, conflict_type, description_md, status, declared_at, resolved_at',
      )
      .eq('case_id', caseId)
      .eq('declarant_id', viewerId)
      .maybeSingle()
    if (coiError) throw coiError
    if (coiRow) {
      myConflict = {
        id: coiRow.id,
        caseId: coiRow.case_id,
        declarantId: coiRow.declarant_id,
        conflictType: coiRow.conflict_type as ConflictType,
        descriptionMd: coiRow.description_md,
        status: coiRow.status as CaseConflictDeclaration['status'],
        declaredAt: coiRow.declared_at,
        resolvedAt: coiRow.resolved_at,
      }
    }
  }

  return {
    terminology,
    primarySubjectKind,
    case: {
      id: env.id,
      commissionId: env.commission_id,
      templateId: env.template_id,
      caseTypeId,
      caseNumber: env.case_number,
      label: env.label,
      status: env.status,
      outcomeId: env.outcome_id ?? null,
      createdAt: env.created_at,
      closedAt: env.closed_at,
      hasPatient: env.has_patient ?? false,
      patientMode: toPatientMode(env.patient_mode),
      patientRequiredFields: toPatientRequiredFields(env.patient_required_fields),
      departmentId: deptRow?.department_id ?? null,
      departmentOther: deptRow?.department_other ?? null,
      departmentName,
    },
    outcome: mapOutcomeJson(env.outcome ?? null),
    offeredOutcomes: (env.offered_outcomes ?? [])
      .map(mapOutcomeJson)
      .filter((o): o is OfferedCaseOutcome => o != null),
    phases: (env.phases ?? []).map((p) => ({
      id: p.id,
      caseId: env.id,
      position: p.position,
      formId: p.form_id,
      formVersionId: p.form_version_id,
      formTitle: p.form_title,
      title: p.title,
      status: p.status,
      recommended: p.recommended,
      assignedTo: p.assigned_to,
      assigneeName: p.assignee_name,
      isAdHoc: p.is_ad_hoc,
      blocks: p.blocks ?? [],
      recommendWhen: p.recommend_when,
      dueDate: p.due_date,
      defaultDueDays: p.default_due_days,
      displayPosition: p.display_position ?? null,
      resultId: p.result_id ?? null,
      resultComputedAt: p.result_computed_at ?? null,
      responseId: p.response_id,
      submittedAt: p.submitted_at,
      result: mapPhaseResultJson(p.result ?? null),
      emitsResult: modeByPhaseId.get(p.id)?.emits_result ?? false,
      // The MANUAL-only allowed subset (null for automatic / non-emitting): the
      // correction picker restricts to it ONLY for manual phases (automatic
      // corrections keep full flexibility). MANUAL = emits a result, no ruleset.
      manualResultIds: manualSubsetOf(modeByPhaseId.get(p.id)),
    })),
    narratives: (env.narratives ?? []).map((n) => mapNarrativeJson(n, env.id)),
    // Until BE-4 adds `viewer_capabilities` to the RPC, default to coordinator-
    // grade: today's `get_case_detail` is `is_staff_admin_of`-gated, so any
    // non-null envelope was returned to a coordinator. BE-4 replaces this with the
    // RPC-computed descriptor (read/write/lifecycle for the actual viewer).
    viewerCapabilities: env.viewer_capabilities
      ? {
          canRead: env.viewer_capabilities.can_read,
          canWriteContent: env.viewer_capabilities.can_write_content,
          canManageLifecycle: env.viewer_capabilities.can_manage_lifecycle,
        }
      : { canRead: true, canWriteContent: true, canManageLifecycle: true },
    // Ethics access-spine fields (ADR 0072 · E1), read RLS-scoped above. Flag-OFF cases
    // carry the today-defaults, so this reproduces the flag-OFF invariant exactly.
    confidentialityLevel:
      (deptRow?.confidentiality_level as CaseConfidentialityLevel | undefined) ??
      'non_phi_internal',
    visibilityPolicy:
      (deptRow?.visibility_policy as VisibilityPolicy | undefined) ??
      'commission_default',
    participants,
    myRecusal,
    myConflict,
  }
}

// ---------------------------------------------------------------------------
// case_patient — the audited PHI-identifier read + the flag probe (ADR 0038)
// ---------------------------------------------------------------------------

/**
 * The raw `get_participant_patient` / `get_case_patients` jsonb row (snake_case from
 * `to_jsonb(patient_identifiers)`; re-keyed to the participant layer, ADR 0064 E0 / F1).
 */
interface CasePatientJson {
  participant_id: string
  name: string | null
  mrn: string | null
  date_of_birth: string | null
  age_years: number | null
  sex: string
  encounter_ref: string | null
  unit: string | null
  attending: string | null
  updated_at: string
}

function mapCasePatient(row: CasePatientJson): CasePatient {
  return {
    participantId: row.participant_id,
    name: row.name,
    mrn: row.mrn,
    dateOfBirth: row.date_of_birth,
    ageYears: row.age_years,
    sex: row.sex as CasePatientSex,
    encounterRef: row.encounter_ref,
    unit: row.unit,
    attending: row.attending,
    updatedAt: row.updated_at,
  }
}

/**
 * The ISOLATED patient PHI for ONE patient participant — THE AUDITED READ (Rule 12
 * Class 1; ADR 0038 re-keyed by ADR 0064 E0 / F1). Routes through the
 * `get_participant_patient` SECURITY DEFINER RPC (direct SELECT on `patient_identifiers`
 * is revoked); the RPC re-gates with `can_read_case_patient`
 * and emits `case_patient.read`. ⚠ That predicate is NO LONGER "broad": ADR 0078
 * defect ① / M3 removed the bare phase/narrative assignment arms — assignment is
 * CONTENT reach, never PHI (Context·1 / D10). An assignee who is not a coordinator
 * and holds no case_access grant now gets `null` here. Returns `null` when no PHI
 * exists OR the caller is out of scope (no audit row then). The on-demand reveal is the
 * ONLY place this is read — never on a list/board.
 */
export async function getParticipantPatient(
  participantId: string,
): Promise<CasePatient | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_participant_patient', {
    p_participant_id: participantId,
  })
  if (!data) return null
  return mapCasePatient(data as unknown as CasePatientJson)
}

/**
 * ALL patient identifiers of a case (N-per-case, ADR 0064 E0 / F1) — the audited
 * list door via `get_case_patients`. Emits one `case_patient.read` per returned row;
 * returns `[]` when entitled but no PHI on file, and `null` when out of scope.
 */
export async function getCasePatients(caseId: string): Promise<CasePatient[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_case_patients', { p_case_id: caseId })
  if (!data) return []
  return (data as unknown as CasePatientJson[]).map(mapCasePatient)
}

/**
 * COMPAT (ADR 0038 single-patient UI): the case's lone patient's identifiers, or
 * `null` (no PHI on file / out of scope). Routes through the `get_case_patient` compat
 * RPC (delegates to `get_participant_patient` on the case's single patient participant),
 * emitting the same audited `case_patient.read`. The multi-patient E1 UI uses
 * {@link getCasePatients} / {@link getParticipantPatient} directly.
 */
export async function getCasePatient(caseId: string): Promise<CasePatient | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_case_patient', { p_case_id: caseId })
  if (!data) return null
  return mapCasePatient(data as unknown as CasePatientJson)
}

/** Whether the `case_patient` feature flag is ON (probes `case_patient_enabled`).
 * Gates the create-dialog PHI block, the detail reveal panel, and the builder
 * toggle; `false` on any error (fail-closed). */
export async function casePatientEnabled(): Promise<boolean> {
  // P4 (WS-6): delegate to the consolidated, request-memoized flag read.
  return featureEnabled('case_patient')
}

/** Whether the `processless_cases` feature flag is ON (probes
 * `processless_cases_enabled`). Gates the create-dialog "Sem processo" option,
 * the `create_case` RPC, and the case-detail offered-outcome editor; `false` on
 * any error (fail-closed). */
export async function processlessCasesEnabled(): Promise<boolean> {
  // P4 (WS-6): delegate to the consolidated, request-memoized flag read.
  return featureEnabled('processless_cases')
}

/** Whether the `cases_extras` feature flag is ON (probes `cases_extras_enabled`).
 * Gates the optional outcome sub-step of the process-less create dialog and the
 * offered-outcome editor; `false` on any error (fail-closed). */
export async function casesExtrasEnabled(): Promise<boolean> {
  // P4 (WS-6): delegate to the consolidated, request-memoized flag read.
  return featureEnabled('cases_extras')
}

// ---------------------------------------------------------------------------
// Phase-fill landing (RLS-scoped table reads — no answers)
// ---------------------------------------------------------------------------

interface PhaseFillRow {
  id: string
  case_id: string
  position: number
  form_id: string
  form_version_id: string
  title: string | null
  status: CasePhaseStatus
  recommended: boolean
  assigned_to: string | null
  is_ad_hoc: boolean
  blocks: number[] | null
  recommend_when: RecommendWhen | null
  due_date: string | null
  default_due_days: number | null
  result_ruleset: ResultRuleset | null
  result_override_id: string | null
  emits_result: boolean
  // D3 (F-cleanup): embedded allowed junction (was allowed_result_ids jsonb).
  case_phase_allowed_results: { result_id: string; position: number }[] | null
  forms: { title: string | null } | null
  cases: {
    id: string
    commission_id: string
    // ADR 0096: cases point at a template VERSION; the identity is one hop on.
    template_version_id: string | null
    process_template_versions: { template_id: string } | null
    case_number: number
    label: string | null
    status: CaseStatus
    outcome_id: string | null
    created_at: string
    closed_at: string | null
    has_patient: boolean
    patient_mode: string
    patient_required_fields: string[]
  } | null
}

/**
 * The assignee's phase-fill landing read: the phase row + its parent case
 * (status + metadata, no answers), RLS-scoped (members read). `null` when the
 * caller may not read it or it does not exist. The actual fill happens through
 * `startOrResumePhase` (cases/actions) → the unchanged wizard.
 */
export async function getCasePhaseForFill(
  casePhaseId: string,
): Promise<CasePhaseForFill | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('case_phases')
    .select(
      `
      id, case_id, position, form_id, form_version_id, title, status,
      recommended, assigned_to, is_ad_hoc, blocks, recommend_when, due_date,
      default_due_days, result_ruleset, result_override_id, emits_result,
      case_phase_allowed_results ( result_id, position ),
      forms ( title ),
      cases (
        id, commission_id, template_version_id, case_number, label, status, outcome_id,
        created_at, closed_at, has_patient, patient_mode, patient_required_fields,
        process_template_versions ( template_id )
      )
    `,
    )
    .eq('id', casePhaseId)
    .maybeSingle<PhaseFillRow>()

  if (error || !data || !data.cases) return null

  const c = data.cases
  return {
    phase: {
      id: data.id,
      caseId: data.case_id,
      position: data.position,
      formId: data.form_id,
      formVersionId: data.form_version_id,
      formTitle: data.forms?.title ?? null,
      title: data.title,
      status: data.status,
      recommended: data.recommended,
      assignedTo: data.assigned_to,
      // The fill landing does not need the assignee's name (it IS the caller).
      assigneeName: null,
      isAdHoc: data.is_ad_hoc,
      blocks: data.blocks ?? [],
      recommendWhen: data.recommend_when,
      dueDate: data.due_date,
      defaultDueDays: data.default_due_days,
      // The fill landing renders one phase, not the merged layout — no display order needed.
      displayPosition: null,
      // The fill landing does not surface the effective result (the phase is being
      // filled — it has none yet); the override panel uses the `result` context below.
      resultId: null,
      resultComputedAt: null,
    },
    case: {
      id: c.id,
      commissionId: c.commission_id,
      templateId: c.process_template_versions?.template_id ?? null,
      caseTypeId: null, // BE-5 projects `cases.case_type_id`; fill landing is terminology-agnostic
      caseNumber: c.case_number,
      label: c.label,
      status: c.status,
      outcomeId: c.outcome_id ?? null,
      createdAt: c.created_at,
      closedAt: c.closed_at,
      hasPatient: c.has_patient,
      patientMode: toPatientMode(c.patient_mode),
      patientRequiredFields: toPatientRequiredFields(c.patient_required_fields),
      // The phase-fill landing does not surface the case's department (setor); the
      // detail read carries it. Default to null.
      departmentId: null,
      departmentOther: null,
      departmentName: null,
    },
    // Result context for the end-of-wizard override panel: the phase's snapshotted
    // ruleset (live computed preview), the commission's active result options (the
    // override picker), and the current stashed override. `null` when the feature
    // is off OR the phase carries no ruleset AND no override (nothing to surface).
    result: await loadPhaseResultContext(
      supabase,
      data.emits_result,
      data.result_ruleset,
      allowedFromJunction(data.case_phase_allowed_results),
      data.result_override_id,
      c.commission_id,
    ),
  }
}

/**
 * Build the {@link CasePhaseForFill.result} context. Returns `null` when the
 * feature is off or the phase does NOT emit a result (no panel). The MODE is the
 * snapshotted ruleset's presence (phase-result-manual-mode):
 *   - MANUAL (no ruleset): `options` is the author-selected ALLOWED subset
 *     (resolved + ordered against the live ACTIVE vocabulary) — the REQUIRED
 *     picker;
 *   - AUTOMATIC (ruleset present): `options` is the full ACTIVE vocabulary — the
 *     OPTIONAL override picker — and `resultRuleset` drives the live computed
 *     preview. (The allowed subset constrains rule AUTHORING, not the override.)
 */
async function loadPhaseResultContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  emitsResult: boolean,
  ruleset: ResultRuleset | null,
  allowedResultIds: string[] | null,
  currentOverrideId: string | null,
  commissionId: string,
): Promise<CasePhaseForFill['result']> {
  const { data: enabled } = await supabase.rpc('case_phase_results_enabled')
  if (enabled !== true) return null
  // A phase that emits no result shows no panel (back-compat: legacy automatic
  // phases were back-filled to emits_result = true).
  if (!emitsResult) return null

  const active = (await listPhaseResults(commissionId)).map(
    (o): ResolvedPhaseResult => ({
      id: o.id,
      label: o.label,
      colorToken: o.colorToken,
      isAdverse: o.isAdverse,
      source: null,
    }),
  )

  // No ruleset → MANUAL: the filler picks from the allowed subset (required).
  if (ruleset == null) {
    const byId = new Map(active.map((o) => [o.id, o]))
    // Preserve the author's chosen order; drop any since-archived option.
    const options = (allowedResultIds ?? [])
      .map((id) => byId.get(id))
      .filter((o): o is ResolvedPhaseResult => o != null)
    return { mode: 'manual', resultRuleset: null, options, currentOverrideId }
  }

  // Ruleset present → AUTOMATIC: optional override over the full active vocabulary.
  return {
    mode: 'automatic',
    resultRuleset: ruleset,
    options: active,
    currentOverrideId,
  }
}

// ---------------------------------------------------------------------------
// Member-scoped "my active phases"
// ---------------------------------------------------------------------------

/** One active phase assigned to the caller, with its case context (no answers). */
export interface MyAssignedPhase {
  caseId: string
  caseNumber: number
  caseLabel: string | null
  phaseId: string
  position: number
  phaseTitle: string | null
  formTitle: string
  /** The phase's due date (ISO `YYYY-MM-DD`); `null` = none. */
  dueDate: string | null
}

interface MyAssignedPhaseRow {
  id: string
  position: number
  title: string | null
  updated_at: string
  due_date: string | null
  forms: { title: string | null } | null
  cases: {
    id: string
    case_number: number
    label: string | null
    commission_id: string
  } | null
}

/**
 * The caller's ACTIVE phases in a commission: `case_phases` where
 * `assigned_to = auth.uid()` AND `status = 'active'`, joined to the case. This is
 * the MEMBER-scoped "my work" read — a plain `staff` assignee cannot use
 * `getCaseDetail` (staff_admin-only), so this RLS-scoped read lets them find the
 * phases they must fill (the acceptance criterion: an assignee fills only their
 * own phase). Newest-activity-first (by the phase's `updated_at`, bumped at
 * activation). Returns `[]` when not signed in or none are assigned.
 *
 * RLS: `case_phases_select` / `cases_select` already let a member read the
 * phases + cases of their commission; the `assigned_to = userId` filter narrows
 * to the caller's own work. No new policy needed.
 */
export async function listMyAssignedPhases(
  commissionId: string,
): Promise<MyAssignedPhase[]> {
  const context = await getSessionContext()
  if (!context) return []

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('case_phases')
    .select(
      `
      id, position, title, updated_at, due_date,
      forms ( title ),
      cases!inner ( id, case_number, label, commission_id )
    `,
    )
    .eq('assigned_to', context.userId)
    .eq('status', 'active')
    .eq('cases.commission_id', commissionId)
    .order('updated_at', { ascending: false })
    .returns<MyAssignedPhaseRow[]>()

  if (error || !data) return []

  return data
    .filter((r): r is MyAssignedPhaseRow & { cases: NonNullable<MyAssignedPhaseRow['cases']> } =>
      r.cases != null,
    )
    .map((r) => ({
      caseId: r.cases.id,
      caseNumber: r.cases.case_number,
      caseLabel: r.cases.label,
      phaseId: r.id,
      position: r.position,
      phaseTitle: r.title,
      formTitle: r.forms?.title ?? '',
      dueDate: r.due_date,
    }))
}

// ---------------------------------------------------------------------------
// case_access — explicit grant rows for a case (ADR 0033 D6)
// ---------------------------------------------------------------------------

/**
 * One explicit `case_access` grant on a case: a (user, level) pair. `read` lets
 * the user open the full case read-only; `write` additionally lets them author
 * un-attributed content (write implies read). Attribution-derived read (a phase /
 * narrative assignee) is NOT a grant and is never returned here — only the rows
 * actually stored in `case_access`.
 */
export interface CaseAccessGrant {
  userId: string
  level: 'read' | 'write'
  /** When the grant was made (ISO timestamptz). */
  grantedAt: string
  /** Grant expiry (ISO timestamptz); `null` = no expiry. Past = "Expirada". */
  expiresAt: string | null
  /** Optional pt-BR justification (LGPD / accreditation evidence); `null` if none. */
  reason: string | null
}

/** One row of the `list_case_access` result set. */
interface CaseAccessGrantRow {
  user_id: string
  level: 'read' | 'write'
  granted_at: string
  expires_at: string | null
  reason: string | null
}

/**
 * The explicit `case_access` grants for a case (the "Acesso ao caso" dialog's
 * grant badges). Backed by the SECURITY DEFINER `list_case_access`, which mirrors
 * `grant_case_access` authorization EXACTLY: it respects the `case_access` feature
 * flag and is gated to a coordinator (staff_admin / org-admin of the case's
 * commission). The RPC raises for a non-coordinator (or when the flag is off),
 * surfaced here as `[]` — never a leak. Returns `[]` when the case has no grants.
 * Each row now carries `grantedAt`, `expiresAt` (nullable) and `reason` (nullable)
 * — a row with `expiresAt` in the past is an EXPIRED grant (shown as "Expirada").
 */
export async function listCaseAccessGrants(
  caseId: string,
): Promise<CaseAccessGrant[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('list_case_access', {
    p_case: caseId,
  })

  if (error || !data) return []

  return (data as unknown as CaseAccessGrantRow[]).map((r) => ({
    userId: r.user_id,
    level: r.level,
    grantedAt: r.granted_at,
    expiresAt: r.expires_at,
    reason: r.reason,
  }))
}

// ---------------------------------------------------------------------------
// "Meus Casos" — the unified attributed-or-granted case list (ADR 0033 D7)
// ---------------------------------------------------------------------------

/** One attributed item inside a `list_my_cases` row's `items` jsonb array. */
interface MyCaseItemJson {
  kind: 'phase' | 'narrative' | 'correction'
  id: string
  title: string
  status: string
  display_position: number
  actionable: boolean
  /** Correction arm only — absent on the phase/narrative arms of the RPC's union. */
  correction_kind?: 'correction' | 'addendum' | 'void'
  case_phase_id?: string | null
  case_narrative_id?: string | null
}

/** One row of the `list_my_cases` jsonb array. */
interface MyCaseJson {
  case_id: string
  case_number: number
  label: string | null
  status: CaseStatus
  my_role: MyCaseRole
  items: MyCaseItemJson[]
}

/**
 * The caller's "Meus Casos" for a commission (ADR 0033 D7): every case the member
 * can access — personally ATTRIBUTED (a phase or narrative assignee) OR GRANTED a
 * `case_access` row — one {@link MyCase} per card, replacing the old "Minhas
 * fases". Each card carries the member's own attributed items inline (with direct
 * Preencher/Abrir/Concluir actions) plus context for "Ver caso completo".
 *
 * Backed by the SECURITY DEFINER `list_my_cases` (BE-4), gated by the
 * `case_access` flag and self-scoped to `auth.uid()` — so it NEVER leaks a case
 * the caller cannot access, and returns `[]` for a non-member. Carries STATUS
 * only, never answers (the Phase-7 invariant). Ordered by the RPC.
 *
 * CONTRACT-FIRST STUB: signature + return type are frozen for `frontend`; the body
 * is wired to the RPC in BE-4 (after the migration + `gen:types`).
 */
export async function listMyCases(commissionId: string): Promise<MyCase[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('list_my_cases', {
    p_commission: commissionId,
  })

  if (error || !data) return []

  return (data as unknown as MyCaseJson[]).map((r) => ({
    caseId: r.case_id,
    caseNumber: r.case_number,
    label: r.label,
    status: r.status,
    myRole: r.my_role,
    items: (r.items ?? []).map((it) => ({
      kind: it.kind,
      id: it.id,
      title: it.title,
      status: it.status,
      displayPosition: it.display_position,
      actionable: it.actionable,
      correctionKind: it.correction_kind ?? null,
      casePhaseId: it.case_phase_id ?? null,
      caseNarrativeId: it.case_narrative_id ?? null,
    })),
  }))
}

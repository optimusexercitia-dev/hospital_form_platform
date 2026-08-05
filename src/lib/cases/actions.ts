'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { featureEnabled } from '@/lib/queries/feature-flags'
import { createClient } from '@/lib/supabase/server'
import { getCasePatient } from '@/lib/queries/cases'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/types/database'
import type {
  CasePatient,
  CasePatientSex,
  PhiDisposeReason,
  SetCasePatientInput,
} from '@/lib/cases/types'

/**
 * Cases server actions (Architecture Rules 9 & 10): case creation, phase
 * activation / skip / ad-hoc / reassign, phase fill entry, and case
 * close / cancel. Each is `useActionState`-shaped where it backs a form, or a
 * plain id-arg action where it backs a button. All user-facing strings are
 * pt-BR; raw Supabase/Postgres errors NEVER reach the UI (CLAUDE.md §8).
 *
 * SECURITY: RLS is the authority. Coordinator actions use the cookie
 * (RLS-scoped) client and the B3 RPCs; the staff_admin-write policies + each
 * RPC's internal gate restrict them to staff_admins of the commission (+ admins),
 * and each action re-verifies server-side for a clean pt-BR "forbidden".
 * `startOrResumePhase` is the ASSIGNEE's entry point (a member action, not a
 * coordinator one): it returns the phase's `responseId` to deep-link the
 * UNCHANGED wizard. Phase completion is a DB trigger reacting to
 * `submit_response`, not an action here.
 *
 * SQLSTATEs mapped to pt-BR: HC016 invalid recommend_when, HC017 no published
 * version, HC018 phase blocked (its blockers are unsettled), HC019 phase wrong
 * state, HC020 case not open, HC021 assignee not a member, HC022 caller not the
 * assignee, HC024 invalid status, HC025 case terminal, and the D3 conclude gate
 * (`close_case`) HC028 outcome required + HC031 unsettled phases. The RPCs raise
 * their own pt-BR text; we prefer it and fall back to the constants below.
 */

export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

export interface CreateCaseState extends ActionState {
  caseId?: string
}

export interface AddAdHocPhaseState extends ActionState {
  phaseId?: string
}

export interface StartPhaseState extends ActionState {
  responseId?: string
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  missingCase: 'Caso não encontrado.',
  missingPhase: 'Fase não encontrada.',
  missingTemplate: 'Processo não encontrado.',
  missingCommission: 'Comissão não encontrada.',
  commissionMismatch: 'Este desfecho não pertence à comissão deste caso.',
  outcomeRequiredForCase: 'Selecione ao menos um desfecho.',
  templateRequired: 'Selecione um processo.',
  formRequired: 'Selecione um formulário.',
  assigneeRequired: 'Selecione o responsável pela fase.',
  dueDateInvalid: 'Informe uma data de prazo válida.',
  recommendInvalid:
    'A condição de recomendação é inválida. Verifique a fase de origem e a pergunta.',
  // Phase-7 codes
  noPublishedVersion:
    'O formulário desta fase ainda não foi publicado. Publique-o antes de continuar.',
  notSequential: 'Conclua ou marque as fases anteriores antes de ativar esta.',
  phaseWrongState: 'Esta fase não está no estado necessário para esta ação.',
  caseNotOpen: 'Este caso não está aberto.',
  assigneeNotMember: 'O responsável deve ser membro da comissão.',
  notAssignee: 'Apenas o responsável pode preencher esta fase.',
  // Cases-Extras R2 (configurable case status)
  invalidStatus: 'Estado de caso inválido para esta comissão.',
  caseTerminal: 'Este caso está em um estado final e não pode mais ser alterado.',
  // Case data-model adjustments — the D3 conclude gate (close_case)
  outcomeRequired: 'Selecione um desfecho antes de concluir o caso.',
  phasesUnsettled: 'Conclua ou marque todas as fases antes de concluir o caso.',
  caseCreated: 'Caso criado com sucesso.',
  caseMetaSaved: 'Caso atualizado com sucesso.',
  phaseActivated: 'Fase ativada e atribuída.',
  phaseSkipped: 'Fase marcada como não necessária.',
  adHocAdded: 'Fase adicional incluída.',
  adHocDeleted: 'Fase excluída.',
  // HC0D0 — only ad-hoc (avulsa) phases may be deleted; template phases are part
  // of the process definition.
  phaseNotAdHoc:
    'Apenas fases avulsas podem ser excluídas; esta fase faz parte do processo.',
  // HC0D1 — the PO rule: a phase with any response (any status) is never deleted
  // and never cascades.
  phaseHasResponses: 'Esta fase possui respostas e não pode ser excluída.',
  // HC0D2 — another phase's recommend_when references this phase by position.
  phaseHasDependents:
    'Outra fase depende desta fase para ser recomendada; ajuste a recomendação antes de excluir.',
  phaseReassigned: 'Responsável atualizado.',
  caseClosed: 'Caso concluído.',
  caseCancelled: 'Caso cancelado.',
  // reopen_case (Case Correction Lifecycle)
  caseReopened: 'Caso reaberto.',
  reopenReasonRequired: 'Informe o motivo da reabertura.',
  cancelledFinal: 'Caso cancelado é definitivo e não pode ser reaberto.',
  accountInactive: 'Sua conta está inativa ou suspensa.',
  // Feature flag OFF (HC000) — reopen_case gates on assert_case_corrections_enabled.
  correctionsUnavailable: 'O recurso de correção de casos não está disponível.',
  // case_patient (ADR 0038) — the THIRD PHI module.
  patientNameOrMrnRequired: 'Informe ao menos o nome ou o prontuário do paciente.',
  patientSaved: 'Identificação do paciente salva.',
  phiDisposed: 'Dados do paciente descartados.',
  patientNotCollected: 'Este caso não coleta identificação do paciente.',
  templateNotDraft: 'Apenas processos em rascunho podem ser editados.',
  templateCollectsPatientSaved: 'Configuração de identificação do paciente atualizada.',
  // Hospital Departments — the case's "Unidade / setor" (NON-PHI, case-level).
  departmentBoth: "Selecione um setor da lista OU informe um valor em 'Outro', não ambos.",
  departmentInvalid: 'Este setor não pertence ao hospital deste caso.',
  // Case custom fields (ADR 0083) — administrative descriptors, NON-PHI.
  customFieldRequired: 'Preencha todos os campos personalizados obrigatórios.',
  customFieldsSaved: 'Campos personalizados atualizados.',
} as const

const PG_CHECK_VIOLATION = '23514'
const PG_INSUFFICIENT_PRIVILEGE = '42501'
// Custom SQLSTATE class HC0xx (Hospital Commission). Renumbered from P00xx in
// migration 20260613090009 so PostgREST 14 returns 400 + JSON {code,message}
// (an unknown class) rather than a 500 that drops the body for non-ASCII
// messages. See docs/decisions/0018-custom-sqlstate-class.md.
const HC_INVALID_RECOMMEND = 'HC016'
const HC_NO_PUBLISHED_VERSION = 'HC017'
const HC_NOT_SEQUENTIAL = 'HC018'
const HC_PHASE_WRONG_STATE = 'HC019'
const HC_CASE_NOT_OPEN = 'HC020'
const HC_ASSIGNEE_NOT_MEMBER = 'HC021'
const HC_NOT_ASSIGNEE = 'HC022'
// Cases-Extras R2 (configurable case status).
const HC_INVALID_STATUS = 'HC024'
const HC_CASE_TERMINAL = 'HC025'
// Case data-model adjustments — the D3 conclude gate (close_case).
const HC_OUTCOME_REQUIRED = 'HC028'
const HC_PHASES_UNSETTLED = 'HC031'
// Process-less case creation — outcome/commission mismatch (create_case).
const HC_COMMISSION_MISMATCH = 'HC030'
// Case custom fields (ADR 0083) — a required custom field has no value (both the
// create snapshot and the edit-blank paths raise this).
const HC_CUSTOM_FIELD_REQUIRED = 'HC068'
// Exclusion perimeter (ADR 0078 M1·4) — the caller is excluded from the case; the
// edit-custom-fields RPC (like set_case_visibility) raises HC0F1. Prefer the RPC's
// own "impedido" message, matching case-recusals/actions.ts.
const HC_CASE_EXCLUDED = 'HC0F1'
// Ad-hoc slot deletion (layout adjustments):
const HC_NOT_AD_HOC = 'HC0D0' // the slot is template-derived → not deletable
const HC_PHASE_HAS_RESPONSES = 'HC0D1' // the phase has responses → never cascade
const HC_PHASE_HAS_DEPENDENTS = 'HC0D2' // another phase's recommend_when needs it
// reopen_case (Case Correction Lifecycle): a cancelled case is terminal-forever;
// HC0F4 = the caller's account is inactive/suspended (checked after authority).
const HC_CANCELLED_FINAL = 'HC0M8'
const HC_ACCOUNT_INACTIVE = 'HC0F4'
// Feature-off sentinel (shared HC000 convention) — reopen_case raises this when the
// `case_corrections` flag is OFF, via app.assert_case_corrections_enabled(). Was 23514
// (mapped to the generic fallback); HC000 lets it surface the truthful "não disponível".
const HC_FEATURE_DISABLED = 'HC000'

const CASES_LIST_PATH = '/o/[org]/c/[commission]/manage/cases'
const CASE_PATH = '/o/[org]/c/[commission]/manage/cases/[caseId]'

function revalidateCases() {
  revalidatePath(CASES_LIST_PATH, 'page')
  revalidatePath(CASE_PATH, 'page')
}

async function authorizeCommission(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.memberships.some(
    (m) => m.commission.id === commissionId && m.role === 'staff_admin',
  )
}

/** Resolve a case's commission via the RLS-scoped client (null = unseen). */
async function commissionOfCase(
  supabase: SupabaseClient<Database>,
  caseId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('cases')
    .select('commission_id')
    .eq('id', caseId)
    .maybeSingle()
  return data?.commission_id ?? null
}

/** Resolve a phase's {commissionId, caseId} via the RLS-scoped client. */
async function contextOfPhase(
  supabase: SupabaseClient<Database>,
  casePhaseId: string,
): Promise<{ commissionId: string; caseId: string } | null> {
  const { data } = await supabase
    .from('case_phases')
    .select('case_id, cases(commission_id)')
    .eq('id', casePhaseId)
    .maybeSingle<{
      case_id: string
      cases: { commission_id: string } | null
    }>()
  const commissionId = data?.cases?.commission_id
  if (!commissionId || !data) return null
  return { commissionId, caseId: data.case_id }
}

/** Resolve a template's commission via the RLS-scoped client. */
async function commissionOfTemplate(
  supabase: SupabaseClient<Database>,
  templateId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('process_templates')
    .select('commission_id')
    .eq('id', templateId)
    .maybeSingle()
  return data?.commission_id ?? null
}

/** Map a Phase-7 RPC error to friendly pt-BR (prefer the RPC's own message). */
function mapCaseError(error: { code?: string; message?: string } | null): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case HC_INVALID_RECOMMEND:
      return error.message || MESSAGES.recommendInvalid
    case HC_NO_PUBLISHED_VERSION:
      return error.message || MESSAGES.noPublishedVersion
    case HC_NOT_SEQUENTIAL:
      return error.message || MESSAGES.notSequential
    case HC_PHASE_WRONG_STATE:
      return error.message || MESSAGES.phaseWrongState
    case HC_CASE_NOT_OPEN:
      return error.message || MESSAGES.caseNotOpen
    case HC_ASSIGNEE_NOT_MEMBER:
      return error.message || MESSAGES.assigneeNotMember
    case HC_NOT_ASSIGNEE:
      return error.message || MESSAGES.notAssignee
    case HC_INVALID_STATUS:
      return error.message || MESSAGES.invalidStatus
    case HC_CASE_TERMINAL:
      return error.message || MESSAGES.caseTerminal
    case HC_OUTCOME_REQUIRED:
      return error.message || MESSAGES.outcomeRequired
    case HC_PHASES_UNSETTLED:
      return error.message || MESSAGES.phasesUnsettled
    case HC_COMMISSION_MISMATCH:
      return error.message || MESSAGES.commissionMismatch
    case HC_CUSTOM_FIELD_REQUIRED:
      return error.message || MESSAGES.customFieldRequired
    case HC_NOT_AD_HOC:
      return error.message || MESSAGES.phaseNotAdHoc
    case HC_PHASE_HAS_RESPONSES:
      return error.message || MESSAGES.phaseHasResponses
    case HC_PHASE_HAS_DEPENDENTS:
      return error.message || MESSAGES.phaseHasDependents
    case PG_CHECK_VIOLATION:
      return error.message || MESSAGES.generic
    case PG_INSUFFICIENT_PRIVILEGE:
      return MESSAGES.forbidden
    case HC_CASE_EXCLUDED:
      return error.message || MESSAGES.forbidden
    case HC_CANCELLED_FINAL:
      return error.message || MESSAGES.cancelledFinal
    case HC_ACCOUNT_INACTIVE:
      return error.message || MESSAGES.accountInactive
    case HC_FEATURE_DISABLED:
      // reopen_case with the `case_corrections` flag OFF (mirrors mapCorrectionError).
      return MESSAGES.correctionsUnavailable
    default:
      return MESSAGES.generic
  }
}

function parseRecommendWhen(raw: string): Json | undefined | null {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed) as Json
  } catch {
    return null
  }
}

/**
 * Validate the optional `dueDate` form field (a native date input emits
 * `YYYY-MM-DD`). Returns `undefined` when absent/blank (→ the RPC stores null),
 * the string when it is a real calendar date, or `null` to signal an invalid
 * value. Belt-and-suspenders: a native date input is already safe, but a
 * hand-crafted POST could carry garbage that Postgres would otherwise reject
 * with a raw error.
 */
function parseDueDate(raw: string): string | undefined | null {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const d = new Date(`${trimmed}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  // Reject out-of-range components the regex accepts (e.g. 2026-02-31 rolls over).
  if (d.toISOString().slice(0, 10) !== trimmed) return null
  return trimmed
}

/**
 * Parse the optional patient (PHI) identifiers carried by the create-case form
 * (ADR 0038). The dialog renders these as hidden inputs ONLY when the chosen
 * process collects patient identifiers and the `case_patient` flag is on, so
 * absent fields mean "no PHI to write" (-> null, the write is skipped). Mirrors
 * the minimum-necessary FLOOR (require ≥ name OR mrn): identifiers below the floor
 * are treated as "nothing to write", not an error.
 */
function patientInputFromForm(formData: FormData): SetCasePatientInput | null {
  const name = String(formData.get('patientName') ?? '').trim()
  const mrn = String(formData.get('patientMrn') ?? '').trim()
  if (!name && !mrn) return null

  const ageRaw = String(formData.get('patientAgeYears') ?? '').trim()
  const age = ageRaw ? Number.parseInt(ageRaw, 10) : Number.NaN
  const sexRaw = String(formData.get('patientSex') ?? '').trim()
  const sex: CasePatientSex =
    sexRaw === 'female' || sexRaw === 'male' || sexRaw === 'other'
      ? sexRaw
      : 'unknown'

  return {
    name: name || null,
    mrn: mrn || null,
    dateOfBirth: String(formData.get('patientDateOfBirth') ?? '').trim() || null,
    ageYears: Number.isFinite(age) ? age : null,
    sex,
    encounterRef: String(formData.get('patientEncounterRef') ?? '').trim() || null,
    unit: String(formData.get('patientUnit') ?? '').trim() || null,
    attending: String(formData.get('patientAttending') ?? '').trim() || null,
  }
}

/**
 * The case's department ("Unidade / setor") from the create-case form: EXACTLY one
 * of `departmentId` (a managed `hospital_departments` id) / `departmentOther` (the
 * "Outro" custom value) may be set; both blank = unspecified. NON-PHI, case-level.
 * Returns the parsed pair, or `'invalid'` when BOTH are set (the UI shows a field
 * error). The RPC re-validates (department belongs to the case's hospital + shape).
 */
function departmentFromForm(
  formData: FormData,
): { departmentId: string | null; departmentOther: string | null } | 'invalid' {
  const departmentId = String(formData.get('departmentId') ?? '').trim()
  const departmentOther = String(formData.get('departmentOther') ?? '').trim()
  if (departmentId && departmentOther) return 'invalid'
  return {
    departmentId: departmentId || null,
    departmentOther: departmentOther || null,
  }
}

/**
 * Parse the case custom-field values (ADR 0083) carried by the create / edit forms.
 * Each field is a SINGLE hidden input named `customField` whose value is a JSON
 * string `{ "key": string, "value": string | number | null }`. The FRONTEND does the
 * per-type coercion (it knows each field's `fieldType` from `CustomFieldDef`), so a
 * `number` field arrives as a JSON number here (numbers stay numbers — the
 * lexical-compare pitfall is avoided). Malformed entries are skipped. Returns the
 * `p_custom_fields` / `p_values` payload the RPCs expect (`[]` when none).
 */
function customFieldsFromForm(formData: FormData): Json {
  const raw = formData.getAll('customField')
  const out: { key: string; value: Json }[] = []
  for (const entry of raw) {
    let parsed: unknown
    try {
      parsed = JSON.parse(String(entry))
    } catch {
      continue
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
    const rec = parsed as Record<string, unknown>
    const key = typeof rec.key === 'string' ? rec.key.trim() : ''
    if (!key) continue
    const v = rec.value
    const value: Json = typeof v === 'string' || typeof v === 'number' ? v : null
    out.push({ key, value })
  }
  return out
}

/**
 * Upsert the isolated patient PHI on a case via the `set_case_patient` DEFINER,
 * on a CALLER-PROVIDED (RLS-scoped) client so it can share the same request as
 * case creation. Returns a mapped pt-BR error (or null). The authority + the
 * minimum-necessary FLOOR live in the RPC; callers enforce the floor too where a
 * distinct empty-input UX is wanted (see {@link setCasePatient}).
 */
async function writeCasePatient(
  supabase: SupabaseClient<Database>,
  caseId: string,
  input: SetCasePatientInput,
): Promise<string | null> {
  const { error } = await supabase.rpc('set_case_patient', {
    p_case_id: caseId,
    p_name: input.name ?? undefined,
    p_mrn: input.mrn ?? undefined,
    p_date_of_birth: input.dateOfBirth ?? undefined,
    p_age_years: input.ageYears ?? undefined,
    p_sex: input.sex,
    p_encounter_ref: input.encounterRef ?? undefined,
    p_unit: input.unit ?? undefined,
    p_attending: input.attending ?? undefined,
  })
  return error ? mapCasePatientError(error) : null
}

/**
 * Create a case from a published template (snapshot: materialize phases, pin
 * each form's currently-published version, copy `recommend_when`, initial
 * recommendation pass). Fields: `templateId`, `label?` (NON-IDENTIFYING — the UI
 * warns it must not contain patient identifiers), plus the OPTIONAL patient (PHI)
 * identifiers (ADR 0038) when the process collects them.
 *
 * The patient write is folded INTO this action (same RLS-scoped request, right
 * after the case is minted) rather than a separate post-create client round-trip:
 * the old fire-and-forget `setCasePatient` from the dialog raced the
 * `revalidatePath` + `router.push` in the same tick and its aborted POST was
 * silently swallowed, so the case landed with `has_patient=false` and no row. Now
 * a failed PHI write is surfaced (it never silently disappears). Returns the new
 * `caseId`.
 */
export async function createCaseFromTemplate(
  _prev: CreateCaseState | undefined,
  formData: FormData,
): Promise<CreateCaseState> {
  const templateId = String(formData.get('templateId') ?? '')
  const label = String(formData.get('label') ?? '').trim()

  if (!templateId) {
    return { ok: false, fieldErrors: { templateId: MESSAGES.templateRequired } }
  }

  const department = departmentFromForm(formData)
  if (department === 'invalid') {
    return { ok: false, fieldErrors: { departmentId: MESSAGES.departmentBoth } }
  }

  const supabase = await createClient()
  // Existence/readability check only. The `create_case_from_template` RPC is the SOLE
  // authority (coordinator/commission-admin OR a `create_cases` Administrativo, ADR 0061);
  // a coordinator-only `authorizeCommission` pre-gate here shadowed the widened RPC and
  // rejected Administrativos before it (BUG-ADM-001). An unauthorized caller still gets a
  // clean pt-BR error via the RPC's `42501` → `MESSAGES.forbidden` (mapCaseError).
  const commissionId = await commissionOfTemplate(supabase, templateId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingTemplate }

  // NOTE — `p_case_type_id` is deliberately NOT sent here. ADR 0064 D4 makes the
  // TEMPLATE the declaring authority, and `create_case_from_template` inherits
  // `process_templates.case_type_id` when the caller passes none, snapshotting the
  // type's visibility/confidentiality defaults. The RPC still accepts an override, but
  // exposing it on this path would let a creator DOWNGRADE the posture an ethics
  // process declares — the exact Rule-12 gap this chain was built to close.
  const { data, error } = await supabase.rpc('create_case_from_template', {
    p_template_id: templateId,
    p_label: label || undefined,
    p_department_id: department.departmentId ?? undefined,
    p_department_other: department.departmentOther ?? undefined,
    // ADR 0083 — the dialog's custom-field values, snapshotted + written IN the
    // create transaction; a required field with no value raises HC068 here.
    p_custom_fields: customFieldsFromForm(formData),
  })

  if (error || !data) return { ok: false, error: mapCaseError(error) }

  // Optional, sanctioned PHI block (ADR 0038): write it in the SAME request so it
  // is never lost to a navigation race. The case already exists; if the PHI write
  // fails we surface it (with the caseId, so the user can open the case and add
  // identifiers via the detail panel) instead of swallowing the loss.
  const patientInput = patientInputFromForm(formData)
  if (patientInput) {
    const patientError = await writeCasePatient(supabase, data.id, patientInput)
    if (patientError) {
      revalidateCases()
      return { ok: false, caseId: data.id, error: patientError }
    }
  }

  revalidateCases()
  return { ok: true, error: MESSAGES.caseCreated, caseId: data.id }
}

/**
 * Create a process-less ("Sem processo") case (ADR — processless_cases): a case
 * with `template_id` NULL and ZERO phases at creation (ad-hoc phases grown later
 * via {@link addAdHocPhase}). Mirrors {@link createCaseFromTemplate}'s shape and
 * its atomic PHI fold, but mints via the `create_case` RPC instead.
 *
 * Hidden fields: `commissionId` (required), `label?` (NON-IDENTIFYING — the UI
 * warns), `emitsOutcome` (`'on'` when the "emite desfecho?" toggle is set),
 * `outcomeIds` (repeated — the chosen offered-outcome ids; required ≥1 when
 * `emitsOutcome`, forced to `[]` otherwise), `patientEnabled` (`'on'` when the
 * "registra identificadores de paciente?" toggle is set → the case is
 * PHI-capable). The optional PHI block is written in the SAME RLS-scoped request
 * (an empty block → null → clean no-op, leaving a PHI-capable case with no
 * `case_patient` row). Returns the new `caseId`.
 */
export async function createCase(
  _prev: CreateCaseState | undefined,
  formData: FormData,
): Promise<CreateCaseState> {
  const commissionId = String(formData.get('commissionId') ?? '')
  const label = String(formData.get('label') ?? '').trim()
  const emitsOutcome = formData.get('emitsOutcome') === 'on'
  const patientEnabled = formData.get('patientEnabled') === 'on'
  // ADR 0064 D4 — a process-less case has no template to inherit a type from, so the
  // dialog's picker is its ONLY channel. Empty = untyped (today's behaviour). The RPC
  // cross-checks the type's org and, when set, snapshots the type's
  // visibility/confidentiality defaults onto the case.
  const caseTypeId = String(formData.get('caseTypeId') ?? '').trim()
  // When the case emits an outcome, the chosen ids are the offered set (≥1
  // required); otherwise the set is forced empty (no outcome at conclusion).
  const outcomeIds = emitsOutcome
    ? formData.getAll('outcomeIds').map((v) => String(v)).filter(Boolean)
    : []

  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (emitsOutcome && outcomeIds.length === 0) {
    return { ok: false, fieldErrors: { outcomeIds: MESSAGES.outcomeRequiredForCase } }
  }

  const department = departmentFromForm(formData)
  if (department === 'invalid') {
    return { ok: false, fieldErrors: { departmentId: MESSAGES.departmentBoth } }
  }

  // The `create_case` RPC is the SOLE authority (coordinator/commission-admin OR a
  // `create_cases` Administrativo, ADR 0061); a coordinator-only `authorizeCommission`
  // pre-gate here shadowed the widened RPC and rejected Administrativos before it
  // (BUG-ADM-001). Refusal still returns a clean pt-BR error via `42501` → forbidden.
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_case', {
    p_commission_id: commissionId,
    p_label: label || undefined,
    p_patient_enabled: patientEnabled,
    p_outcome_ids: outcomeIds,
    p_department_id: department.departmentId ?? undefined,
    p_department_other: department.departmentOther ?? undefined,
    p_case_type_id: caseTypeId || undefined,
  })

  if (error || !data) return { ok: false, error: mapCaseError(error) }

  // Optional, sanctioned PHI block (ADR 0038): write it in the SAME request so it
  // is never lost to a navigation race — exactly as createCaseFromTemplate does.
  const patientInput = patientInputFromForm(formData)
  if (patientInput) {
    const patientError = await writeCasePatient(supabase, data.id, patientInput)
    if (patientError) {
      revalidateCases()
      return { ok: false, caseId: data.id, error: patientError }
    }
  }

  revalidateCases()
  return { ok: true, error: MESSAGES.caseCreated, caseId: data.id }
}

/**
 * Edit a case's META — its non-identifying `label` and its `department` (a managed
 * department id OR the "Outro" custom value). The SINGLE audited edit path for both
 * coordinators AND `create_cases` Administrativos (ADR 0061): it routes through the
 * `update_case_meta` DEFINER RPC, which is the authority — it self-gates
 * (coordinator/commission-admin, OR an Administrativo with `create_cases` behind the
 * flag), blocks a terminal case (HC025 → pt-BR), re-validates department shape +
 * hospital ownership, and touches ONLY `label`/`department_*` (never status / outcome
 * / closed / PHI). We deliberately do NOT pre-check authority here (the coordinator
 * `authorizeCommission` would wrongly reject the capability arm) — the RPC's 42501 is
 * mapped to a clean pt-BR "forbidden".
 *
 * FULL-REPLACE semantics: the RPC SETS label + department unconditionally, so the
 * dialog is PREFILLED with the current values and submits the complete desired state;
 * an empty label / unspecified department clears that field. Fields: `caseId`,
 * `label?`, and exactly one of `departmentId` / `departmentOther` (both empty = none).
 */
export async function updateCaseMeta(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const caseId = String(formData.get('caseId') ?? '')
  const label = String(formData.get('label') ?? '').trim()

  if (!caseId) return { ok: false, error: MESSAGES.missingCase }

  const department = departmentFromForm(formData)
  if (department === 'invalid') {
    return { ok: false, fieldErrors: { departmentId: MESSAGES.departmentBoth } }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_case_meta', {
    p_case_id: caseId,
    // Empty → undefined → the RPC clears it (nullif(btrim(null),'')). Non-empty sets it.
    p_label: label || undefined,
    p_department_id: department.departmentId ?? undefined,
    p_department_other: department.departmentOther ?? undefined,
  })

  if (error) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.caseMetaSaved }
}

/**
 * Edit a case's CUSTOM-FIELD values (ADR 0083) from the case detail. Routes through
 * the `update_case_custom_field_values` DEFINER RPC, which is the authority: it
 * self-gates (coordinator/commission-admin, OR a `create_cases` Administrativo behind
 * the flag), enforces the exclusion perimeter (HC0F1) + terminal-case freeze (HC025),
 * and UPDATES existing value rows only (the snapshot set is fixed at creation — no new
 * rows). Blanking a REQUIRED field raises HC068 → pt-BR. Every change is audited
 * (Rule 11). We do NOT pre-check authority here (the coordinator `authorizeCommission`
 * would wrongly reject the capability arm) — the RPC's 42501 maps to a clean forbidden.
 *
 * Fields: `caseId`, plus one hidden `customField` input per field carrying a JSON
 * `{ key, value }` (see {@link customFieldsFromForm}). A field absent from the payload
 * keeps its current value; a present-but-blank value clears it (unless required).
 */
export async function updateCaseCustomFieldValues(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const caseId = String(formData.get('caseId') ?? '')
  if (!caseId) return { ok: false, error: MESSAGES.missingCase }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_case_custom_field_values', {
    p_case_id: caseId,
    p_values: customFieldsFromForm(formData),
  })

  if (error) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.customFieldsSaved }
}

/**
 * Activate a pending phase and assign it. Fields: `casePhaseId`, `assignedTo`.
 * Guards (→ pt-BR): all earlier phases concluded/skipped (P0018), the phase is
 * pendente (P0019), the case is open (P0020), the assignee is a member (P0021).
 */
export async function activatePhase(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const casePhaseId = String(formData.get('casePhaseId') ?? '')
  const assignedTo = String(formData.get('assignedTo') ?? '')
  const dueDate = parseDueDate(String(formData.get('dueDate') ?? ''))

  if (!casePhaseId) return { ok: false, error: MESSAGES.missingPhase }
  if (!assignedTo) {
    return { ok: false, fieldErrors: { assignedTo: MESSAGES.assigneeRequired } }
  }
  if (dueDate === null) {
    return { ok: false, fieldErrors: { dueDate: MESSAGES.dueDateInvalid } }
  }

  const supabase = await createClient()
  // Existence/readability check only. `activate_phase` is the SOLE authority
  // (coordinator/commission-admin OR an `assign_case_phases` Administrativo, ADR 0061);
  // a coordinator-only `authorizeCommission` pre-gate here shadowed the widened DEFINER
  // RPC and rejected Administrativos before it (BUG-ADM-001). Refusal still returns a
  // clean pt-BR error via `42501` → `MESSAGES.forbidden`.
  const ctx = await contextOfPhase(supabase, casePhaseId)
  if (!ctx) return { ok: false, error: MESSAGES.missingPhase }

  const { error } = await supabase.rpc('activate_phase', {
    p_case_phase_id: casePhaseId,
    p_assigned_to: assignedTo,
    // Empty/omitted → undefined → the RPC stores null (no due date).
    p_due_date: dueDate || undefined,
  })

  if (error) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.phaseActivated }
}

/**
 * Skip a pending phase (`pendente → nao_necessaria`), unblocking the next phase.
 * Guards: phase pendente (P0019), case open (P0020). Then recomputes
 * recommendations.
 */
export async function skipPhase(casePhaseId: string): Promise<ActionState> {
  if (!casePhaseId) return { ok: false, error: MESSAGES.missingPhase }

  const supabase = await createClient()
  const ctx = await contextOfPhase(supabase, casePhaseId)
  if (!ctx) return { ok: false, error: MESSAGES.missingPhase }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('skip_phase', {
    p_case_phase_id: casePhaseId,
  })

  if (error) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.phaseSkipped }
}

/**
 * Append an ad-hoc phase to an open case (not from the template). Fields:
 * `caseId`, `formId`, `title?`, `recommendWhen?` (JSON), `assignedTo?`. Pins the
 * form's published version (P0017). Returns the new `phaseId`. Append-only.
 */
export async function addAdHocPhase(
  _prev: AddAdHocPhaseState | undefined,
  formData: FormData,
): Promise<AddAdHocPhaseState> {
  const caseId = String(formData.get('caseId') ?? '')
  const formId = String(formData.get('formId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const assignedTo = String(formData.get('assignedTo') ?? '').trim()
  const recommendWhen = parseRecommendWhen(
    String(formData.get('recommendWhen') ?? ''),
  )

  if (!caseId) return { ok: false, error: MESSAGES.missingCase }
  if (!formId) {
    return { ok: false, fieldErrors: { formId: MESSAGES.formRequired } }
  }
  if (recommendWhen === null) {
    return { ok: false, fieldErrors: { recommendWhen: MESSAGES.recommendInvalid } }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfCase(supabase, caseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { data, error } = await supabase.rpc('add_ad_hoc_phase', {
    p_case_id: caseId,
    p_form_id: formId,
    p_title: title || undefined,
    p_recommend_when: recommendWhen,
    p_assigned_to: assignedTo || undefined,
  })

  if (error || !data) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.adHocAdded, phaseId: data.id }
}

/**
 * Reassign a phase to another member BEFORE any response exists for it (P0019
 * otherwise — once a draft exists the assignee owns it). Fields: `casePhaseId`,
 * `newAssignee`, `dueDate?`. P0021 if the new assignee is not a member.
 */
export async function reassignPhase(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const casePhaseId = String(formData.get('casePhaseId') ?? '')
  const newAssignee = String(formData.get('newAssignee') ?? '')
  const dueDate = parseDueDate(String(formData.get('dueDate') ?? ''))

  if (!casePhaseId) return { ok: false, error: MESSAGES.missingPhase }
  if (!newAssignee) {
    return { ok: false, fieldErrors: { newAssignee: MESSAGES.assigneeRequired } }
  }
  if (dueDate === null) {
    return { ok: false, fieldErrors: { dueDate: MESSAGES.dueDateInvalid } }
  }

  const supabase = await createClient()
  // Existence/readability check only. `reassign_phase` is the SOLE authority
  // (coordinator/commission-admin OR an `assign_case_phases` Administrativo, ADR 0061);
  // a coordinator-only `authorizeCommission` pre-gate here shadowed the widened DEFINER
  // RPC and rejected Administrativos before it (BUG-ADM-001). Refusal still returns a
  // clean pt-BR error via `42501` → `MESSAGES.forbidden`.
  const ctx = await contextOfPhase(supabase, casePhaseId)
  if (!ctx) return { ok: false, error: MESSAGES.missingPhase }

  const { error } = await supabase.rpc('reassign_phase', {
    p_case_phase_id: casePhaseId,
    p_new_assignee: newAssignee,
    p_due_date: dueDate || undefined,
  })

  if (error) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.phaseReassigned }
}

/**
 * The ASSIGNEE's phase entry point: start or resume the phase's response (one
 * per phase) and return its `responseId` to deep-link the unchanged wizard.
 * Guards: phase is ativa (P0019), caller is the assignee (P0022). Uses the
 * PINNED form version (skips the published-only backstop — the pin may be
 * archived). NOT a coordinator action: any member may CALL it, but the RPC
 * (P0022) lets only the assignee through, so no commission-scoped authz re-check
 * is added here (it would wrongly require staff_admin).
 */
export async function startOrResumePhase(
  casePhaseId: string,
): Promise<StartPhaseState> {
  if (!casePhaseId) return { ok: false, error: MESSAGES.missingPhase }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('start_or_resume_phase', {
    p_case_phase_id: casePhaseId,
  })

  if (error || !data) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, responseId: data.id }
}

/**
 * Close an open case (`aberto → concluido`): flips any remaining
 * pendente/ativa phases to `not_required` so the board reads cleanly; a
 * stranded in-progress draft is then inert. Guard: case open (P0020).
 */
export async function closeCase(caseId: string): Promise<ActionState> {
  if (!caseId) return { ok: false, error: MESSAGES.missingCase }

  const supabase = await createClient()
  const commissionId = await commissionOfCase(supabase, caseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('close_case', { p_case_id: caseId })

  if (error) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.caseClosed }
}

/**
 * Cancel an open case (`aberto → cancelado`), same phase cleanup as close.
 * Guard: case open (P0020).
 */
export async function cancelCase(caseId: string): Promise<ActionState> {
  if (!caseId) return { ok: false, error: MESSAGES.missingCase }

  const supabase = await createClient()
  const commissionId = await commissionOfCase(supabase, caseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('cancel_case', { p_case_id: caseId })

  if (error) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.caseCancelled }
}

/**
 * Reopen a COMPLETED case (Case Correction Lifecycle) so it can be corrected.
 * Coordinator-only (staff_admin/commission-admin); a mandatory reason is durably
 * recorded on `case_reopenings` (kept out of the audit log — Rule 11). `cancelled`
 * is terminal-forever (HC0M8). Wraps the `reopen_case` RPC — the RPC's authority +
 * the case RLS are the boundary; the server-side re-check yields a clean pt-BR
 * forbidden. Raw PG errors never reach the UI.
 */
export async function reopenCase(
  caseId: string,
  reason: string,
): Promise<ActionState> {
  if (!caseId) return { ok: false, error: MESSAGES.missingCase }
  if (!reason.trim()) return { ok: false, error: MESSAGES.reopenReasonRequired }

  const supabase = await createClient()
  const commissionId = await commissionOfCase(supabase, caseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('reopen_case', {
    p_case_id: caseId,
    p_reason: reason,
  })

  if (error) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.caseReopened }
}

// ---------------------------------------------------------------------------
// case_patient — the THIRD PHI module (ADR 0038)
// ---------------------------------------------------------------------------

/**
 * Map a `case_patient` RPC error to friendly pt-BR. The DEFINER RPCs raise their
 * own pt-BR text for the authority (`42501`) / one-shot (`HC056`) / check
 * (`23514`) cases, so prefer `error.message` and fall back to a generic.
 */
function mapCasePatientError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return MESSAGES.generic
  // The RPC messages are already user-facing pt-BR; prefer them.
  if (error.message) return error.message
  return MESSAGES.generic
}

/**
 * Upsert the ISOLATED patient PHI on a case (Rule 12; same 9-arg shape as
 * `setEventPatient` / `setReferralPatient`). The minimum-necessary FLOOR (require
 * ≥ name OR mrn) is enforced HERE (matching the existing pattern). The
 * `set_case_patient` DEFINER is the authority: coordinators-only (`42501`
 * otherwise), the case must collect patient identifiers (`23514` otherwise), and
 * the write is audited WITHOUT copying any identifier into the audit metadata.
 */
export async function setCasePatient(
  caseId: string,
  input: SetCasePatientInput,
): Promise<ActionState> {
  if (!caseId) return { ok: false, error: MESSAGES.missingCase }
  if (!input.name?.trim() && !input.mrn?.trim()) {
    return { ok: false, error: MESSAGES.patientNameOrMrnRequired }
  }

  const supabase = await createClient()
  const error = await writeCasePatient(supabase, caseId, input)
  if (error) return { ok: false, error }

  revalidateCases()
  return { ok: true, error: MESSAGES.patientSaved }
}

/**
 * On-demand audited PHI read for the `"use client"` case-patient panel. A Client
 * Component cannot import the `getCasePatient` query (server-only, Rule 9), so this
 * thin `"use server"` wrapper triggers it on click. The audit (`case_patient.read`)
 * fires INSIDE the `get_case_patient` RPC; this returns `null` when no PHI exists OR
 * the caller is out of scope (the door returns NULL, not an error). The broad read
 * scope (= `can_read_case`) means a phase/narrative assignee CAN reveal — by design.
 */
export async function revealCasePatient(
  caseId: string,
): Promise<CasePatient | null> {
  if (!caseId) return null
  return getCasePatient(caseId)
}

/**
 * Downstream prefill bridge (ADR 0038) — load a case's patient identifiers to
 * SEED the "notify NSP" dialog's draft (value copy, never an FK link; the NSP
 * `event_patient` stays independently isolated + disposable). A `"use client"`
 * notify dialog cannot call `getCasePatient` (server-only, Rule 9); this thin
 * `"use server"` bridge triggers it (audited as `case_patient.read` inside the
 * door) only when the user opens the notify flow. Returns `null` when the case has
 * no identifiers OR the caller is out of scope. Distinct from `revealCasePatient`
 * only in intent (the notify-flow consumer), not behavior.
 */
export async function loadCasePatientForNotify(
  caseId: string,
): Promise<CasePatient | null> {
  if (!caseId) return null
  return getCasePatient(caseId)
}

/**
 * Dispose the case's PHI (LGPD Art. 18 erasure; copy of the NSP dispose action).
 * Destructively deletes the isolated `case_patient` row + NULLs/redacts the case
 * PHI free text (`case_narratives.body_md` → NULL, `case_events.body` → sentinel),
 * PRESERVING the governance skeleton (case number, status, phases, outcome, audit
 * chain), then stamps who/when/why + `has_patient=false` and emits one PHI-free
 * `case_patient.disposed` audit row. The `dispose_case_phi` DEFINER is the
 * authority (staff_admin/admin gate → `42501`; one-shot → `HC056`); `reason` is a
 * CONSTRAINED category, never free text.
 */
export async function disposeCasePhi(
  caseId: string,
  reason: PhiDisposeReason,
): Promise<ActionState> {
  if (!caseId) return { ok: false, error: MESSAGES.missingCase }

  const supabase = await createClient()
  const { error } = await supabase.rpc('dispose_case_phi', {
    p_case_id: caseId,
    p_reason: reason,
  })
  if (error) return { ok: false, error: mapCasePatientError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.phiDisposed }
}

/**
 * Toggle a template VERSION's `collects_patient` config (ADR 0096 D1 moved this
 * field onto the version). The `set_template_collects_patient` DEFINER gates
 * staff_admin/admin + the VERSION being `draft` (`42501` / `23514` otherwise).
 * When on (and the `case_patient` flag is on), cases created from the published
 * version offer the optional PHI block.
 */
export async function setTemplateCollectsPatient(
  templateVersionId: string,
  collects: boolean,
): Promise<ActionState> {
  if (!templateVersionId) return { ok: false, error: MESSAGES.missingTemplate }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_template_collects_patient', {
    p_template_version_id: templateVersionId,
    p_collects: collects,
  })
  if (error) return { ok: false, error: mapCasePatientError(error) }

  // The builder lives under a different route; revalidate the template pages.
  // Post-multi-tenancy the manage area is /o/[org]/c/[commission]/manage/...
  // (the old /c/[slug]/... pattern no longer exists → was a silent no-op).
  revalidatePath('/o/[org]/c/[commission]/manage/process-templates', 'page')
  revalidatePath(
    '/o/[org]/c/[commission]/manage/process-templates/[templateId]',
    'page',
  )
  return { ok: true, error: MESSAGES.templateCollectsPatientSaved }
}

/**
 * Delete an AD-HOC (avulsa) phase from an OPEN case. Coordinator-only; the
 * `delete_ad_hoc_case_phase` RPC is the authority and re-checks everything
 * server-side, so a hostile caller cannot route around this action.
 *
 * The RPC REFUSES (never cascades) when:
 *   - the phase is TEMPLATE-derived rather than `is_ad_hoc` (HC0D0) — the process
 *     definition is not editable per-case;
 *   - the phase has ANY response, in any status (HC0D1) — response data is never
 *     destroyed by a layout edit (the PO rule);
 *   - another phase's `recommend_when` depends on this phase's position (HC0D2);
 *   - the caller is not a coordinator, or is RECUSED from the case (42501).
 *
 * Mirrors {@link import('@/lib/cases/documents-actions').deleteCaseDocument}:
 * flag check → rpc → revalidate → pt-BR `ActionState`. Raw Postgres errors never
 * reach the UI (CLAUDE.md §8).
 */
export async function deleteAdHocPhase(phaseId: string): Promise<ActionState> {
  if (!phaseId) return { ok: false, error: MESSAGES.missingPhase }

  if (!(await featureEnabled('cases_multi_phase'))) {
    return { ok: false, error: MESSAGES.generic }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_ad_hoc_case_phase', {
    p_phase_id: phaseId,
  })
  if (error) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.adHocDeleted }
}

'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { ACCREDITATION_MESSAGES as MESSAGES, mapAccreditationError } from '@/lib/accreditation/messages'
import type { ArtifactKind, AssessmentStatus, FrameworkStatus, StandardLevel } from '@/lib/accreditation/types'

/**
 * Standards Crosswalk & Readiness/Gap Engine v2 (Phase 16) server actions
 * (Architecture Rules 9–11; ADR 0093). Mirrors the
 * `src/lib/indicators/actions.ts` conventions: every write routes through a
 * SECURITY DEFINER RPC (the RPC is the sole authority, no client pre-check),
 * `useActionState`-shaped `{ ok, error?, fieldErrors? }`, pt-BR strings (Rule
 * 10), raw Postgres errors never reach the UI (mapped via
 * {@link mapAccreditationError}, `@/lib/accreditation/messages`).
 *
 * Guard order per ADR 0093 Wave 2 (Migration D): every write RPC opens with
 * `app.assert_accreditation_enabled()` (→ HC0Q9); `link_evidence` continues
 * flag → belongs (`app.artifact_belongs_to_commission`) → `can_read_case` /
 * `can_read_capa` for the restricted kinds → duplicate → insert.
 *
 * ⚠ SEQUENCING NOTE (read before "fixing" a call site): at the time this file
 * was written, backend's Wave 2 RPC track (Migration C — framework/standard
 * CRUD; Migration D — evidence/assessment/ownership) had NOT landed yet —
 * `Database['public']['Functions']` does not carry `create_framework` /
 * `link_evidence` / etc., which is also why `src/lib/queries/accreditation.ts`
 * still `throw new Error('not implemented')`. `supabase.rpc(fn, args)` is
 * typed `FnName extends string & keyof Schema['Functions']`, so it cannot
 * even COMPILE against an RPC the catalog doesn't know yet. {@link callRpc}
 * is a narrow, single-purpose adapter that relaxes ONLY that function-name
 * constraint (via a documented `unknown` cast, never `any`) while every call
 * site below keeps full argument/return typing against the RPC names +
 * parameter shapes ADR 0093's Wave 2 plan documents — i.e. this is "write
 * against the contract signatures" in the one place where the contract is
 * prose (the ADR/plan) rather than a posted TS stub. Flagged to `backend`/the
 * lead for signature alignment; once Migration C/D lands these calls should
 * typecheck unchanged (call sites do not need to change — `callRpc` degrades
 * to a thin passthrough once the RPC is a real `Schema['Functions']` member).
 */

/** `useActionState`-shaped result (the indicators/action-items-hub convention). */
export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

export interface CreateFrameworkState extends ActionState {
  frameworkId?: string
}

export interface CloneFrameworkState extends ActionState {
  frameworkId?: string
}

export interface UpsertStandardState extends ActionState {
  standardId?: string
}

export interface LinkEvidenceState extends ActionState {
  evidenceLinkId?: string
}

type PgError = { code?: string; message?: string } | null

/** See the file-level "SEQUENCING NOTE" above. */
async function callRpc<TArgs extends Record<string, unknown>, TData>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fn: string,
  args: TArgs,
): Promise<{ data: TData | null; error: PgError }> {
  // `unknown`, never `any` (CLAUDE.md §8) — this reproduces exactly the shape
  // `PostgrestClient#rpc` already has; only the "FnName must already be a key
  // of the generated Functions map" constraint is relaxed, and only because
  // that map lags behind the RPC's own migration by construction.
  const client = supabase as unknown as {
    rpc(
      fn: string,
      args: TArgs,
    ): PromiseLike<{ data: TData | null; error: PgError }>
  }
  return client.rpc(fn, args)
}

// ---------------------------------------------------------------------------
// Path revalidation
// ---------------------------------------------------------------------------

const ACCREDITATION_PATH = '/o/[org]/c/[commission]/manage/acreditacao'
const FRAMEWORK_PATH = '/o/[org]/c/[commission]/manage/acreditacao/[framework]'
const STANDARD_PATH =
  '/o/[org]/c/[commission]/manage/acreditacao/[framework]/padrao/[standard]'

function revalidateAccreditation(): void {
  revalidatePath(ACCREDITATION_PATH, 'page')
  revalidatePath(FRAMEWORK_PATH, 'page')
  revalidatePath(STANDARD_PATH, 'page')
}

// --- form-field parsing helpers -------------------------------------------

function requiredString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

function optionalString(formData: FormData, key: string): string | undefined {
  const value = requiredString(formData, key)
  return value || undefined
}

function parseOptionalPosition(raw: FormDataEntryValue | null): number | undefined {
  const s = String(raw ?? '').trim()
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

function parseOptionalLevel(raw: FormDataEntryValue | null): StandardLevel | undefined | null {
  const s = String(raw ?? '').trim()
  if (!s) return undefined
  const n = Number(s)
  return n === 1 || n === 2 || n === 3 ? (n as StandardLevel) : null // null = invalid
}

// ---------------------------------------------------------------------------
// Framework CRUD (Migration C — global: platform_admin only; custom: staff_admin_of(owner))
// ---------------------------------------------------------------------------

/**
 * Create a framework. `ownerCommissionId` empty/omitted = a global pack
 * (`app.is_admin()`-only per D6's one legitimate `is_admin` use — the
 * vocabulary/catalog arm); set = a commission-owned custom framework
 * (`is_staff_admin_of(owner)`). Routes to `create_framework`.
 */
export async function createFramework(
  _prev: CreateFrameworkState | undefined,
  formData: FormData,
): Promise<CreateFrameworkState> {
  const ownerCommissionId = optionalString(formData, 'ownerCommissionId')
  const key = requiredString(formData, 'key')
  const name = requiredString(formData, 'name')
  const version = optionalString(formData, 'version')
  const description = optionalString(formData, 'description')

  if (!key) return { ok: false, fieldErrors: { key: MESSAGES.keyRequired } }
  if (!name) return { ok: false, fieldErrors: { name: MESSAGES.nameRequired } }

  const supabase = await createClient()
  const { data, error } = await callRpc<Record<string, unknown>, { id: string }>(
    supabase,
    'create_framework',
    {
      p_owner_commission: ownerCommissionId,
      p_key: key,
      p_name: name,
      p_version: version,
      p_description: description,
    },
  )

  if (error || !data) return { ok: false, error: mapAccreditationError(error) }

  revalidateAccreditation()
  return { ok: true, error: MESSAGES.frameworkCreated, frameworkId: data.id }
}

/** Edit a framework's own fields (not its standards). Routes to `update_framework`. */
export async function updateFramework(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = requiredString(formData, 'frameworkId')
  const name = requiredString(formData, 'name')
  const version = optionalString(formData, 'version')
  const description = optionalString(formData, 'description')

  if (!id) return { ok: false, error: MESSAGES.frameworkNotFound }
  if (!name) return { ok: false, fieldErrors: { name: MESSAGES.nameRequired } }

  const supabase = await createClient()
  const { error } = await callRpc<Record<string, unknown>, null>(supabase, 'update_framework', {
    p_framework: id,
    p_name: name,
    p_version: version,
    p_description: description,
  })

  if (error) return { ok: false, error: mapAccreditationError(error) }

  revalidateAccreditation()
  return { ok: true, error: MESSAGES.frameworkUpdated }
}

/** Archive or reactivate a framework. Routes to `set_framework_status`. */
export async function setFrameworkStatus(
  frameworkId: string,
  status: FrameworkStatus,
): Promise<ActionState> {
  if (!frameworkId) return { ok: false, error: MESSAGES.frameworkNotFound }

  const supabase = await createClient()
  const { error } = await callRpc<Record<string, unknown>, null>(
    supabase,
    'set_framework_status',
    { p_framework: frameworkId, p_status: status },
  )

  if (error) return { ok: false, error: mapAccreditationError(error) }

  revalidateAccreditation()
  return { ok: true, error: MESSAGES.frameworkStatusChanged }
}

/**
 * Clone a global (or another commission's — RLS forbids the latter in
 * practice) framework skeleton into a commission-owned, fully editable copy
 * (ADR 0093 D2/D9 — the clone is where a hospital pastes its own licensed
 * manual text). staff_admin-only; routes to `clone_framework`. Returns the
 * new framework id so the dialog can route straight to it.
 */
export async function cloneFramework(
  _prev: CloneFrameworkState | undefined,
  formData: FormData,
): Promise<CloneFrameworkState> {
  const frameworkId = requiredString(formData, 'frameworkId')
  const commissionId = requiredString(formData, 'commissionId')

  if (!frameworkId) return { ok: false, error: MESSAGES.frameworkNotFound }
  if (!commissionId) return { ok: false, error: MESSAGES.commissionNotFound }

  const supabase = await createClient()
  const { data, error } = await callRpc<Record<string, unknown>, { id: string }>(
    supabase,
    'clone_framework',
    { p_framework: frameworkId, p_commission: commissionId },
  )

  if (error || !data) return { ok: false, error: mapAccreditationError(error) }

  revalidateAccreditation()
  return { ok: true, error: MESSAGES.frameworkCloned, frameworkId: data.id }
}

// ---------------------------------------------------------------------------
// Standard CRUD (custom frameworks only — HC0QD rejects a global-pack write)
// ---------------------------------------------------------------------------

/**
 * Create or edit one standard (`standardId` present = edit). Routes to
 * `upsert_standard`. `level` is required only inside a leveled (ONA-shaped)
 * framework; leave empty for a non-leveled (JCI-shaped) one.
 */
export async function upsertStandard(
  _prev: UpsertStandardState | undefined,
  formData: FormData,
): Promise<UpsertStandardState> {
  const id = optionalString(formData, 'standardId')
  const frameworkId = requiredString(formData, 'frameworkId')
  const parentId = optionalString(formData, 'parentId')
  const code = requiredString(formData, 'code')
  const title = requiredString(formData, 'title')
  const descriptionMd = optionalString(formData, 'descriptionMd')
  const position = parseOptionalPosition(formData.get('position'))
  const level = parseOptionalLevel(formData.get('level'))

  if (!frameworkId) return { ok: false, error: MESSAGES.frameworkNotFound }
  if (!code) return { ok: false, fieldErrors: { code: MESSAGES.codeRequired } }
  if (!title) return { ok: false, fieldErrors: { title: MESSAGES.titleRequired } }
  if (level === null) return { ok: false, fieldErrors: { level: MESSAGES.levelInvalid } }

  const supabase = await createClient()
  const { data, error } = await callRpc<Record<string, unknown>, { id: string }>(
    supabase,
    'upsert_standard',
    {
      p_id: id,
      p_framework: frameworkId,
      p_parent: parentId,
      p_code: code,
      p_title: title,
      p_description_md: descriptionMd,
      p_position: position,
      p_level: level,
    },
  )

  if (error || !data) return { ok: false, error: mapAccreditationError(error) }

  revalidateAccreditation()
  return { ok: true, error: MESSAGES.standardSaved, standardId: data.id }
}

/** Remove a standard (and, per the DB cascade, its evidence links/assessments). Routes to `delete_standard`. */
export async function deleteStandard(standardId: string): Promise<ActionState> {
  if (!standardId) return { ok: false, error: MESSAGES.standardNotFound }

  const supabase = await createClient()
  const { error } = await callRpc<Record<string, unknown>, null>(supabase, 'delete_standard', {
    p_standard: standardId,
  })

  if (error) return { ok: false, error: mapAccreditationError(error) }

  revalidateAccreditation()
  return { ok: true, error: MESSAGES.standardDeleted }
}

// ---------------------------------------------------------------------------
// Evidence (Migration D — staff_admin; guard order flag → belongs → read-cap → duplicate → insert)
// ---------------------------------------------------------------------------

/**
 * Link one artifact as evidence for a standard. `note` carries the standing
 * PHI-discouragement copy on its field (ADR 0093 D8) — enforced at the UI
 * layer (the standard panel), not here. Routes to `link_evidence`; HC0QA
 * (not linkable) / HC0QB (duplicate) map to the pt-BR messages in
 * `@/lib/accreditation/messages`.
 */
export async function linkEvidence(
  _prev: LinkEvidenceState | undefined,
  formData: FormData,
): Promise<LinkEvidenceState> {
  const commissionId = requiredString(formData, 'commissionId')
  const standardId = requiredString(formData, 'standardId')
  const artifactKind = requiredString(formData, 'artifactKind') as ArtifactKind
  const artifactId = requiredString(formData, 'artifactId')
  const note = optionalString(formData, 'note')

  if (!commissionId) return { ok: false, error: MESSAGES.commissionNotFound }
  if (!standardId) return { ok: false, error: MESSAGES.standardNotFound }
  if (!artifactKind) {
    return { ok: false, fieldErrors: { artifactKind: MESSAGES.artifactKindRequired } }
  }
  if (!artifactId) return { ok: false, fieldErrors: { artifactId: MESSAGES.artifactRequired } }

  const supabase = await createClient()
  const { data, error } = await callRpc<Record<string, unknown>, { id: string }>(
    supabase,
    'link_evidence',
    {
      p_commission: commissionId,
      p_standard: standardId,
      p_kind: artifactKind,
      p_artifact: artifactId,
      p_note: note,
    },
  )

  if (error || !data) return { ok: false, error: mapAccreditationError(error) }

  revalidateAccreditation()
  return { ok: true, error: MESSAGES.evidenceLinked, evidenceLinkId: data.id }
}

/** Remove an evidence link. Routes to `unlink_evidence`. */
export async function unlinkEvidence(evidenceLinkId: string): Promise<ActionState> {
  if (!evidenceLinkId) return { ok: false, error: MESSAGES.evidenceLinkNotFound }

  const supabase = await createClient()
  const { error } = await callRpc<Record<string, unknown>, null>(supabase, 'unlink_evidence', {
    p_link: evidenceLinkId,
  })

  if (error) return { ok: false, error: mapAccreditationError(error) }

  revalidateAccreditation()
  return { ok: true, error: MESSAGES.evidenceUnlinked }
}

// ---------------------------------------------------------------------------
// Assessment (staff_admin upsert)
// ---------------------------------------------------------------------------

/**
 * Set (upsert) a commission's self-assessment for one standard. `noteMd`
 * carries the standing PHI-discouragement copy on its field (D8), enforced
 * at the UI layer. Routes to `set_standard_assessment`.
 */
export async function setStandardAssessment(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const commissionId = requiredString(formData, 'commissionId')
  const standardId = requiredString(formData, 'standardId')
  const status = requiredString(formData, 'status') as AssessmentStatus
  const noteMd = optionalString(formData, 'noteMd')

  if (!commissionId) return { ok: false, error: MESSAGES.commissionNotFound }
  if (!standardId) return { ok: false, error: MESSAGES.standardNotFound }
  if (!status) return { ok: false, fieldErrors: { status: MESSAGES.assessmentStatusRequired } }

  const supabase = await createClient()
  const { error } = await callRpc<Record<string, unknown>, null>(
    supabase,
    'set_standard_assessment',
    {
      p_commission: commissionId,
      p_standard: standardId,
      p_status: status,
      p_note_md: noteMd,
    },
  )

  if (error) return { ok: false, error: mapAccreditationError(error) }

  revalidateAccreditation()
  return { ok: true, error: MESSAGES.assessmentSaved }
}

// NOTE: no type re-exports here — a `'use server'` module may export ONLY
// async server functions (the RSC action compiler rejects `export type {…}`).
// Consumers import the field-value unions (ArtifactKind / AssessmentStatus /
// …) directly from the pure `@/lib/accreditation/types`.
//
// `standard_ownerships` (D7 — `set_standard_ownership`) is DELIBERATELY not
// wired here: it is hospital-tier, `is_hospital_admin_of`-only, and part of
// the hospital surface this turn explicitly defers to Wave 3
// (`docs/plans/phase-16-standards-crosswalk-program.md` Wave 3).

import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { accessToken } from './auth'

/**
 * Shared fixtures/helpers for the Phase 16 (Standards Crosswalk & Readiness/
 * Gap Engine v2, ADR 0093) E2E specs — `phase16-accreditation-{core,
 * freshness,hospital,restricted,clone}.spec.ts`.
 *
 * Every RPC signature, table shape, RLS policy, CHECK constraint and trigger
 * name below was read from the LIVE local catalog (`pg_proc` /
 * `pg_get_functiondef` / `pg_policies` / `pg_constraint` / `pg_trigger`) on
 * 2026-08-03, never from a migration file — CLAUDE.md's binding graphify
 * exception ("migration file text is stale by design; the live catalog is
 * the sole truth"). Seed ids (orgs/hospitals/commissions/personas) were
 * likewise verified live, not copied from `supabase/seed.sql` prose.
 *
 * ## The flag
 *
 * `accreditation` is seeded OFF (`app.feature_flags`) and flips ON only via
 * Migration G at the Phase Gate Record step (ADR 0093; PROGRESS.md). This
 * file's {@link setFeatureFlag} mutates ONLY the live local DB row — never
 * `seed.sql`, never a migration — mirroring `case-patient.spec.ts` /
 * `patient-index.spec.ts`'s capture/restore convention. BUG-P16-002's lesson:
 * a spec suite that runs with the flag off passes by certifying 404s, so the
 * flag-OFF→404 / flag-ON→renders proof in `phase16-accreditation-core.spec.ts`
 * is the harness's own self-test, run first, with the flag under this file's
 * explicit control both ways (never assumed from "whatever state we inherit").
 *
 * Run every phase16 spec together with `--workers=1` — `fullyParallel: true`
 * in `playwright.config.ts` would otherwise let multiple spec FILES race the
 * same global `app.feature_flags` row.
 */

// ---------------------------------------------------------------------------
// Environment / transport
// ---------------------------------------------------------------------------

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

const DB_CONTAINER = 'supabase_db_azkbbhskturikxpgmafq'

// ---------------------------------------------------------------------------
// Seed ground truth — verified against the live catalog, 2026-08-03. NEVER
// re-resolve a foreign id through an `authenticated` query in a cross-tenant
// negative test: RLS would null it and the assertion would prove nothing
// (the ff5-references.spec.ts / phase22-referrals.spec.ts lesson).
// ---------------------------------------------------------------------------

export const ORG_A = 'rede-a'
export const ORG_B = 'rede-b'
export const ORG_A_ID = '0c000000-0000-0000-0000-00000000000a'
export const ORG_B_ID = '0c000000-0000-0000-0000-00000000000b'

/** Hospital Central A — home of BOTH the CCIH and Farmácia commissions (spec 3's worst-wins fixture). */
export const HOSPITAL_CENTRAL_A = '05000000-0000-0000-0000-00000000000a'
/** Hospital Secundário A — home of Comissão de Ética. */
export const HOSPITAL_SECUNDARIO_A2 = '05000000-0000-0000-0000-0000000000a2'

export const CCIH_SLUG = 'ccih'
export const FARM_SLUG = 'farmacia'
export const QUALIDADE_B_SLUG = 'qualidade'

export const COMMISSION_CCIH = 'a0000000-0000-0000-0000-0000000000a1'
export const COMMISSION_FARMACIA = 'b0000000-0000-0000-0000-0000000000b1'
export const COMMISSION_ETICA = 'e0000000-0000-0000-0000-0000000000e1'
export const COMMISSION_QUALIDADE_B = 'c0000000-0000-0000-0000-0000000000c1'

/**
 * The ONE seeded `ethics_case_details` row in the whole DB
 * ("Denúncia Ética (fixture E1)", CCIH, `confidentiality_level:
 * ethics_investigation`, case_number 6). Read-only fixture — spec 4 links it
 * as evidence but never mutates it, and asserts it SURVIVES the file's
 * teardown. `can_read_case` verified LIVE per persona: chefe.ccih → true
 * (grant `max_confidentiality: legal_privileged`); staff1/2/3.ccih and
 * platform@test.local → false (staff1's grant carries `max_confidentiality:
 * null`, which does not cover `ethics_investigation` — a grant ROW existing
 * is not sufficient, confirmed live, not assumed from the grant table alone).
 */
export const ETHICS_CASE_ID = 'ca000000-0000-0000-0000-0000000000e1'

export const PLATFORM = 'platform@test.local'
export const CHEFE_CCIH = 'chefe.ccih@test.local'
export const CHEFE_FARM = 'chefe.farm@test.local'
export const STAFF1_CCIH = 'staff1.ccih@test.local'
export const STAFF2_CCIH = 'staff2.ccih@test.local'
export const STAFF3_CCIH = 'staff3.ccih@test.local'
export const HOSPITALADMIN_A1 = 'hospitaladmin.a1@test.local'
export const ORGADMIN_A = 'orgadmin.a@test.local'
export const ORGADMIN_B = 'orgadmin.b@test.local'
export const STAFF1_QUAL_B = 'staff1.qual.b@test.local'

export const UID_PLATFORM = '00000000-0000-0000-0000-0000000000b0'
export const UID_CHEFE_CCIH = '00000000-0000-0000-0000-000000000002'
export const UID_CHEFE_FARM = '00000000-0000-0000-0000-000000000005'
export const UID_HOSPITALADMIN_A1 = '00000000-0000-0000-0000-0000000000e1'

/** An existing CCIH published form (`review_due_date` null → evidence_status_of = valida). Read-only. */
export const CCIH_FORM_HIGIENE = {
  id: 'f0000000-0000-0000-0000-00000000a001',
  title: 'Checklist de Higienização das Mãos',
}

// ---------------------------------------------------------------------------
// DB-truth / fixture SQL (mirrors ff5-references.spec.ts's psql/sqlRows/sqlOne).
// Used for: reading ground truth (audit_log, evidence_links, …) and creating
// SUPPORTING artifacts (meeting/indicator-measurement/document/form-version)
// that are not themselves under test — every Phase 16 RPC under test
// (create_framework, link_evidence, set_standard_assessment, …) is always
// called for real, under a persona's JWT, via {@link rpcAs}.
// ---------------------------------------------------------------------------

export function psql(sqlText: string): string {
  return execSync(
    `docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -tA -F "|"`,
    { input: sqlText, encoding: 'utf8' },
  )
    .toString()
    .trim()
}

export function sqlRows(query: string): string[][] {
  const out = psql(query)
  if (out === '') return []
  return out.split(/\r?\n/).map((line) => line.split('|'))
}

export function sqlOne(query: string): string {
  const rows = sqlRows(query)
  expect(rows.length, `esperava exatamente uma linha de: ${query}`).toBe(1)
  return rows[0][0]
}

// ---------------------------------------------------------------------------
// Natural-key lookups — for seeded rows whose id is NOT a stable literal.
// ---------------------------------------------------------------------------

/**
 * Resolve a seeded indicator's id by its NATURAL KEY (commission + exact
 * name), never a hardcoded/captured literal.
 *
 * BUG-P16-006: unlike orgs/hospitals/commissions/personas/the demo form
 * (each seeded with an explicit fixed `id` literal — confirmed by direct
 * read of their `insert`/`v_* uuid :=` statements, not merely grepped),
 * `supabase/seed.sql`'s CCIH indicator block (`insert into public.indicators
 * (...) values (...) returning id into v_ind_*;`) has NO explicit `id`
 * column — `gen_random_uuid()` assigns a FRESH id on every
 * `supabase db reset`. A literal indicator id captured from one live
 * session is a latent, gate-blocking defect: green against the DB it was
 * captured from, red on the very next fresh reset (i.e. every `e2e:prod`
 * run), and nothing in a same-DB workflow is positioned to catch it.
 *
 * `sqlOne` already fails loudly — quoting the query — on 0 or >1 rows, so a
 * lookup miss surfaces here as a clear fixture error, never as a downstream
 * FK violation on whatever insert consumes the id next.
 */
export function lookupIndicatorId(commissionId: string, name: string): string {
  return sqlOne(`select id from public.indicators where commission_id = '${commissionId}' and name = '${name}';`)
}

// ---------------------------------------------------------------------------
// Feature flag — runtime-only toggle. NEVER touches seed.sql or a migration.
// ---------------------------------------------------------------------------

/**
 * ⚠ `boolean::text` casts to the LONG form ('true'/'false') — psql's short
 * 't'/'f' display is specific to an UNCAST boolean column/expression, not to
 * this explicit cast (verified live: `select enabled::text, enabled …` ->
 * `true|t` from the SAME row). Comparing against `'t'` here made this
 * function return `false` UNCONDITIONALLY, for every input — which is why
 * `setFeatureFlag(false)` always looked like it "succeeded" instantly (it
 * never actually checked anything) while `setFeatureFlag(true)` always
 * exhausted every retry. Root-caused only after ruling out CLI flakiness,
 * shell-quoting, and cross-connection visibility as the cause — the bug was
 * a plain string mismatch in this file, not an environment race.
 */
export function readFeatureFlag(flagKey: string): boolean {
  return sqlOne(`select enabled::text from app.feature_flags where key = '${flagKey}';`) === 'true'
}

/**
 * Flip a flag on the live local DB (never `seed.sql`, never a migration —
 * Migration G at the Phase Gate Record step is the only legitimate flip).
 * Uses the SAME `docker exec … psql` channel as every read in this file
 * (rather than the `npx supabase db query --local` pattern
 * `case-patient.spec.ts` / `patient-index.spec.ts` use) — one transport
 * instead of two, and no `npx` resolution overhead.
 *
 * Verifies the write landed before returning, with a couple of retries as
 * defensive insurance against a genuinely slow round trip — but this is not
 * standing in for a known flakiness. The one bug that made this LOOK flaky
 * turned out to be entirely in {@link readFeatureFlag} (a `::text` cast
 * compared against the wrong string, so it could never observe `true`) — see
 * that function's docstring. Every write actually landed on the first try,
 * every time; only the READ was ever lying.
 */
export function setFeatureFlag(flagKey: string, enabled: boolean, maxAttempts = 3): void {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    psql(`UPDATE app.feature_flags SET enabled = ${enabled} WHERE key = '${flagKey}';`)
    if (readFeatureFlag(flagKey) === enabled) return
    if (attempt === maxAttempts) {
      throw new Error(
        `setFeatureFlag('${flagKey}', ${enabled}): the DB still reads ${!enabled} after ${maxAttempts} attempts.`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Auth — a real JWT so RLS and every DEFINER gate see the persona's identity.
// Not memoized here (unlike helpers/auth.ts's cachedSignIn) — token fetches
// are cheap and every accreditation spec needs several distinct personas.
// ---------------------------------------------------------------------------

export async function getToken(
  page: Page,
  email: string,
  password = 'Test1234!',
  actAs?: string,
): Promise<string> {
  // ACT (ADR 0106) — delegates to the shared, hat-aware accessToken
  // (BUG-ACT-RAWGRANT-HATLESS-1): ORGADMIN_B (org_admin + staff_admin) and
  // STAFF1_QUAL_B (staff + staff_admin) otherwise come back with no
  // active_role claim. Every OTHER persona this file's 5 phase16 consumers
  // pass here (CHEFE_CCIH, CHEFE_FARM, STAFF1_CCIH, STAFF2_CCIH,
  // HOSPITALADMIN_A1, PLATFORM, ORGADMIN_A) is single-role-type and
  // unaffected — `actAs` left undefined is byte-identical to before.
  return accessToken(page, email, password, actAs)
}

// ---------------------------------------------------------------------------
// RPC-under-persona-JWT — the canonical server path. Every assertion about a
// server-side rejection or a door's row-visibility must go through this, not
// a raw table poke.
// ---------------------------------------------------------------------------

export interface RpcResult<T> {
  ok: boolean
  status: number
  json: T
  text: string
}

export async function rpcAs<T = unknown>(
  page: Page,
  token: string,
  fn: string,
  body: Record<string, unknown>,
): Promise<RpcResult<T>> {
  const resp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })
  const text = await resp.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { ok: resp.ok(), status: resp.status(), json: json as T, text }
}

/** A REST table read under a persona's JWT — the RLS-filtered view (never the
 *  service-role bypass). Proves a row IS/IS NOT visible per POLICY, independent
 *  of any route-level access gate (spec 5's cross-org clone-isolation check). */
export async function selectAs<T = unknown>(
  page: Page,
  token: string,
  path: string,
): Promise<{ ok: boolean; status: number; rows: T[] }> {
  const resp = await page.request.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
  })
  const text = await resp.text()
  let rows: unknown = []
  try {
    rows = text ? JSON.parse(text) : []
  } catch {
    rows = []
  }
  return { ok: resp.ok(), status: resp.status(), rows: rows as T[] }
}

// ---------------------------------------------------------------------------
// Typed convenience wrappers over the Phase 16 RPCs (param names verified
// live against `pg_get_function_identity_arguments`, not transcribed from
// the plan doc's prose).
// ---------------------------------------------------------------------------

export interface FrameworkRow {
  id: string
  key: string
  name: string
  version: string
  description: string | null
  owner_commission_id: string | null
  cloned_from_framework_id: string | null
  status: string
}

export function createFrameworkRpc(
  page: Page,
  token: string,
  args: { key: string; name: string; ownerCommission?: string | null; version?: string; description?: string | null },
) {
  return rpcAs<FrameworkRow>(page, token, 'create_framework', {
    p_key: args.key,
    p_name: args.name,
    p_owner_commission: args.ownerCommission ?? null,
    p_version: args.version ?? '1',
    p_description: args.description ?? null,
  })
}

export function updateFrameworkRpc(
  page: Page,
  token: string,
  args: { framework: string; name: string; version?: string | null; description?: string | null },
) {
  return rpcAs<FrameworkRow>(page, token, 'update_framework', {
    p_framework: args.framework,
    p_name: args.name,
    p_version: args.version ?? null,
    p_description: args.description ?? null,
  })
}

export function cloneFrameworkRpc(page: Page, token: string, args: { framework: string; commission: string }) {
  return rpcAs<FrameworkRow>(page, token, 'clone_framework', {
    p_framework: args.framework,
    p_commission: args.commission,
  })
}

export interface StandardRow {
  id: string
  framework_id: string
  parent_id: string | null
  code: string
  title: string
  description_md: string | null
  position: number
  level: number | null
}

export function upsertStandardRpc(
  page: Page,
  token: string,
  args: {
    framework: string
    code: string
    title: string
    id?: string | null
    parent?: string | null
    descriptionMd?: string | null
    position?: number
    level?: 1 | 2 | 3 | null
  },
) {
  return rpcAs<StandardRow>(page, token, 'upsert_standard', {
    p_framework: args.framework,
    p_code: args.code,
    p_title: args.title,
    p_id: args.id ?? null,
    p_parent: args.parent ?? null,
    p_description_md: args.descriptionMd ?? null,
    p_position: args.position ?? 0,
    p_level: args.level ?? null,
  })
}

export interface EvidenceLinkRow {
  id: string
  commission_id: string
  standard_id: string
  artifact_kind: string
  artifact_id: string
  note: string | null
  linked_by: string | null
  linked_at: string
}

export function linkEvidenceRpc(
  page: Page,
  token: string,
  args: { commission: string; standard: string; kind: string; artifact: string; note?: string | null },
) {
  return rpcAs<EvidenceLinkRow>(page, token, 'link_evidence', {
    p_commission: args.commission,
    p_standard: args.standard,
    p_kind: args.kind,
    p_artifact: args.artifact,
    p_note: args.note ?? null,
  })
}

export function unlinkEvidenceRpc(page: Page, token: string, linkId: string) {
  return rpcAs<null>(page, token, 'unlink_evidence', { p_link: linkId })
}

export interface AssessmentRow {
  id: string
  commission_id: string
  standard_id: string
  status: string
  assessed_by: string | null
  assessed_at: string
  note_md: string | null
}

export function setAssessmentRpc(
  page: Page,
  token: string,
  args: { commission: string; standard: string; status: string; noteMd?: string | null },
) {
  return rpcAs<AssessmentRow>(page, token, 'set_standard_assessment', {
    p_commission: args.commission,
    p_standard: args.standard,
    p_status: args.status,
    p_note_md: args.noteMd ?? null,
  })
}

export function setOwnershipRpc(
  page: Page,
  token: string,
  args: { hospital: string; standard: string; commission: string | null },
) {
  return rpcAs<{ id: string } | null>(page, token, 'set_standard_ownership', {
    p_hospital: args.hospital,
    p_standard: args.standard,
    p_commission: args.commission,
  })
}

export interface ReadinessReportRow {
  standard_id: string
  standard_code: string
  standard_title: string
  level: number | null
  assessment_status: string | null
  evidence_valida: number
  evidence_atencao: number
  evidence_vencida: number
  evidence_restrita: number
}

export function readinessReportRpc(page: Page, token: string, commission: string, framework: string) {
  return rpcAs<ReadinessReportRow[]>(page, token, 'readiness_report', {
    p_commission: commission,
    p_framework: framework,
  })
}

export interface ReadinessEvidenceRow {
  id: string
  standard_id: string
  artifact_kind: string
  artifact_id: string
  status: string
  label: string
  note: string | null
  restricted: boolean
  linked_by_name: string | null
  linked_at: string
}

export function readinessEvidenceRpc(page: Page, token: string, commission: string, standard: string) {
  return rpcAs<ReadinessEvidenceRow[]>(page, token, 'readiness_evidence', {
    p_commission: commission,
    p_standard: standard,
  })
}

export interface HospitalReadinessRow {
  standard_id: string
  standard_code: string
  standard_title: string
  level: number | null
  consolidated_status: string | null
  resolution: string
  responsible_commission_id: string | null
  evidence_valida: number
  evidence_atencao: number
  evidence_vencida: number
  evidence_restrita: number
}

export function hospitalReadinessRpc(page: Page, token: string, hospital: string, framework: string) {
  return rpcAs<HospitalReadinessRow[]>(page, token, 'hospital_readiness', {
    p_hospital: hospital,
    p_framework: framework,
  })
}

// ---------------------------------------------------------------------------
// Supporting-artifact fixtures (raw SQL — these tables are NOT under test;
// only their READ-SIDE freshness classification, `app.evidence_status_of`, is).
// Every guard trigger below fires on UPDATE/DELETE only, never INSERT (verified
// live), so a direct INSERT at a "late" status needs no escape hatch; DELETE
// (cleanup) does, using each RPC family's own session GUC — the same escape
// hatch the real RPCs set, never `session_replication_role = replica` (which
// disables FK CASCADE platform-wide — BUG-E2EISO-002).
// ---------------------------------------------------------------------------

/**
 * A fresh CCIH-commission meeting, `signed` by default (evidence_status_of →
 * valida) — pass `status` for another point on the freshness matrix, e.g.
 * `'held'`/`'in_signature'` → atencao (A3·2).
 *
 * ⚠ Never `RETURNING … ` through {@link sqlOne} for a mutating statement —
 * `psql -tA` suppresses a SELECT's header/footer but NOT an INSERT/UPDATE/
 * DELETE's own command-completion tag ("INSERT 0 1"), so a `RETURNING id`
 * read through this text-parsing helper comes back as TWO "rows", not one
 * (caught live: `sqlOne` threw "esperava exatamente uma linha", received 2).
 * `ff5-references.spec.ts`'s own `psql()` precedent sidesteps this by never
 * using RETURNING at all — generating the id client-side and inserting it
 * explicitly instead. Every fixture builder below follows that same shape.
 */
export function insertSignedMeeting(
  commissionId: string,
  title: string,
  createdBy: string,
  status: string = 'signed',
): string {
  const id = randomUUID()
  psql(`
    insert into public.meetings (id, commission_id, title, status, scheduled_start, modality, created_by)
    values ('${id}', '${commissionId}', '${title}', '${status}', now() - interval '7 days', 'presencial', '${createdBy}');
  `)
  return id
}

/**
 * Drop any falsy/`undefined` entry before it can reach a SQL string — a
 * `beforeAll` that throws partway through (e.g. the flag-flip flake above)
 * leaves later module-level `let`s unassigned, and `afterAll` still runs
 * regardless (Playwright/Jest semantics), so a purge helper WILL be called
 * with `[undefined]` on that path. `'undefined'::uuid` is a Postgres syntax
 * error, not a helpful "0 rows deleted" no-op — seen live, twice.
 */
function filterIds(ids: (string | undefined | null)[]): string[] {
  return ids.filter((id): id is string => Boolean(id))
}

export function purgeMeetings(ids: (string | undefined)[]): void {
  const list = filterIds(ids)
  if (list.length === 0) return
  const quoted = list.map((id) => `'${id}'`).join(',')
  psql(`begin;\nset local app.in_meeting_rpc = 'on';\ndelete from public.meetings where id in (${quoted});\ncommit;`)
}

/** One `indicator_measurements` row on an EXISTING (seeded) indicator — never
 *  a new indicator, to keep the fixture minimal. `dateExpr` is a raw SQL date
 *  expression (e.g. `now()` or `now() - interval '45 days'`) so freshness
 *  fixtures are always relative to the CURRENT test run, never a hardcoded
 *  calendar date (the BUG-P15-001 landmine — a literal date silently drifts
 *  in or out of a rolling window). */
export function insertIndicatorMeasurement(args: {
  indicatorId: string
  status: 'on_target' | 'off_target' | 'no_data'
  periodLabel: string
  dateExpr?: string
  enteredBy: string
}): string {
  const id = randomUUID()
  psql(`
    insert into public.indicator_measurements (id, indicator_id, period_label, status, source, entered_at, entered_by)
    values ('${id}', '${args.indicatorId}', '${args.periodLabel}', '${args.status}', 'manual', ${args.dateExpr ?? 'now()'}, '${args.enteredBy}');
  `)
  return id
}

export function purgeIndicatorMeasurements(ids: (string | undefined)[]): void {
  const list = filterIds(ids)
  if (list.length === 0) return
  const quoted = list.map((id) => `'${id}'`).join(',')
  psql(`delete from public.indicator_measurements where id in (${quoted});`)
}

/** An `effective` controlled document + its current version. `reviewDueExpr`
 *  is a raw SQL date expression or the literal string `'null'` — pass a
 *  PAST-relative expression (`current_date - 200`) for a deliberately
 *  backdated (vencida) fixture, or omit for a comfortably future one (valida). */
export function insertEffectiveDocument(args: {
  commissionId: string
  title: string
  createdBy: string
  reviewDueExpr?: string
}): { documentId: string; versionId: string } {
  const documentId = randomUUID()
  const versionId = randomUUID()
  const due = args.reviewDueExpr ?? 'current_date + 180'
  psql(`
    insert into public.controlled_documents (id, commission_id, title, doc_type, status, created_by)
    values ('${documentId}', '${args.commissionId}', '${args.title}', 'policy', 'effective', '${args.createdBy}');
    insert into public.controlled_document_versions
      (id, document_id, version_number, status, effective_date, review_due_date, created_by)
    values ('${versionId}', '${documentId}', 1, 'effective', current_date, ${due}, '${args.createdBy}');
    update public.controlled_documents set current_version_id = '${versionId}' where id = '${documentId}';
  `)
  return { documentId, versionId }
}

export function purgeControlledDocuments(ids: (string | undefined)[]): void {
  const list = filterIds(ids)
  if (list.length === 0) return
  const quoted = list.map((id) => `'${id}'`).join(',')
  psql(
    `begin;\nset local app.in_controlled_docs_rpc = 'on';\ndelete from public.controlled_documents where id in (${quoted});\ncommit;`,
  )
}

/** A bare `archived` form + version — evidence_status_of('form_version', …)
 *  only reads `form_versions.status`/`review_due_date`, so no section/item is
 *  needed for this narrow freshness-classification purpose. */
export function insertArchivedFormVersion(
  commissionId: string,
  title: string,
  createdBy: string,
): { formId: string; versionId: string } {
  const formId = randomUUID()
  const versionId = randomUUID()
  psql(`
    insert into public.forms (id, commission_id, title, created_by)
    values ('${formId}', '${commissionId}', '${title}', '${createdBy}');
    insert into public.form_versions (id, form_id, version_number, status, created_by)
    values ('${versionId}', '${formId}', 1, 'archived', '${createdBy}');
  `)
  return { formId, versionId }
}

/** `status='archived'` is never DELETE-locked (`guard_published_version`
 *  blocks only `status='published'`) — no GUC needed. */
export function purgeForms(formIds: (string | undefined)[], versionIds: (string | undefined)[]): void {
  const versions = filterIds(versionIds)
  if (versions.length > 0) {
    psql(`delete from public.form_versions where id in (${versions.map((id) => `'${id}'`).join(',')});`)
  }
  const forms = filterIds(formIds)
  if (forms.length > 0) {
    psql(`delete from public.forms where id in (${forms.map((id) => `'${id}'`).join(',')});`)
  }
}

/** Frameworks/standards created by a spec — plain DELETE, no guard trigger on
 *  either table (only `evidence_links`/`standard_assessments`/`standard_ownerships`
 *  cascade off `accreditation_standards ... ON DELETE CASCADE`, so deleting the
 *  framework alone is sufficient; standards cascade off the framework too). */
export function purgeFrameworks(ids: (string | undefined)[]): void {
  const list = filterIds(ids)
  if (list.length === 0) return
  psql(`delete from public.accreditation_frameworks where id in (${list.map((id) => `'${id}'`).join(',')});`)
}

export function purgeStandardOwnerships(hospitalId: string, standardIds: string[]): void {
  if (standardIds.length === 0) return
  psql(
    `delete from public.standard_ownerships where hospital_id = '${hospitalId}' and standard_id in (${standardIds
      .map((id) => `'${id}'`)
      .join(',')});`,
  )
}

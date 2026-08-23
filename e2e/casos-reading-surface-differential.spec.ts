import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { cachedSignIn } from './helpers/auth'
import { createDraftTemplateDirect } from './helpers/process-templates'
import {
  assertAbsentHere,
  assertAbsentOnCasos,
  assertPresentOnManage,
  caseHeader,
  region,
  CASE_WIDE_CLASS,
  CF_MEMBER,
  FULL_CLASS,
  G1_MEMBERS,
  G2_MEMBERS,
  G3_MEMBERS,
  G6_MEMBERS,
  PLESS_MEMBER,
} from './helpers/case-affordance-class'

/**
 * `/casos` READING-SURFACE DIFFERENTIAL — the CASE-WIDE AFFORDANCE CLASS, asserted
 * ABSENT on `/casos/[caseId]` and PRESENT on `/manage/cases/[caseId]` for the SAME
 * user and the SAME case (ADR 0134 D1/D2; closes
 * `FUP-CASOS-ABSENCE-DIFFERENTIAL-UNASSERTED`).
 *
 * Built in the shape `case-access.spec.ts` AC-3b and the T6 narrative differential
 * established: an absence paired with a positive control on the manage host, counted
 * by STRUCTURE (the region that hosts the control must itself render on both hosts)
 * as well as by accessible name. A bare `toHaveCount(0)` here would pass for the
 * wrong reason the moment a panel is renamed, moved or flag-gated off.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * THE CLASS IS DERIVED BY PROPERTY, NOT QUOTED FROM A LIST
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ⛔ The follow-up this file closes was filed WRONG TWICE, both times because a
 * hand-list stood in for the property (v1's sweep was bounded by BUTTON LABELS and
 * so missed a member whose control is labelled "Adicionar"; v2 reported a whole
 * class as newly-narrowed when only one viewer class's cells were). Do not extend
 * this file by adding a label someone named — re-run the derivation.
 *
 * THE PROPERTY: *an affordance rendered by `CaseDetailView` (or by the manage
 * `(detail)` layout header, which is its twin) whose visibility gate is a CASE-WIDE
 * capability.* Everything else on the page is flag-gated, data-gated, or
 * NAME-attributed (the assignee tests precede the capability tests — ADR 0033 Q14 /
 * CA-002) and is therefore NOT in the class.
 *
 * THE SIX GATES. All six are resolved in ONE file,
 * `src/components/cases/case-detail-view.tsx`; that single derivation point is what
 * makes this an enumeration of a property rather than a checklist:
 *
 *   G1  `caps.canWriteContent`           — zeroed by `narrowToReadingSurface`
 *   G2  `caps.canManageLifecycle`        — zeroed by `narrowToReadingSurface`
 *   G3  `effectiveCanAssignPhases`       — prop `canAssignPhases`,       not passed by `/casos`
 *   G4  `effectiveCanEditCustomFields`   — prop `canEditCustomFields`,   not passed by `/casos`
 *   G5  `effectiveCanManagePhaseResults` — prop `canManagePhaseResults`, not passed by `/casos`
 *   G6  `canEditMeta`                    — prop DELETED (ADR 0134 F-5); the affordance
 *                                          exists only in the manage layout header now
 *
 * `FULL_CLASS` below is that derivation written out — **16 members**, each row naming
 * its gate. (QA's enumeration named 7; the derivation returns nine more, in the same
 * direction v1's grep was wrong.) `CASE_WIDE_CLASS` is the 14 of them that share one
 * fixture case; the other two need a case of a particular SHAPE (process-less /
 * carrying custom-field values) and are exercised by PLESS-1 and CF-1.
 *
 * ⚠ THREE members are in the class by the same property but are absent for a
 * different MECHANISM — no gate narrows them; `/casos` has simply never passed
 * their fuel (measured at `df88dced` AND at HEAD, so "pre-existing" here means
 * older than `8675b7cd` too). They are labelled G2 by the capability they gate on
 * upstream, and marked **NEVER-FED** below because the distinction decides what a
 * regression in them would MEAN:
 *   • "Adicionar fase" / "Adicionar narrativa" — fuel `adHocForms` /
 *     `adHocNarrativeTypes`, defaulted `[]`/absent.
 *   • "Editar desfechos disponíveis" (PLESS-1) — fuel `casesExtrasEnabled`,
 *     defaulted `false`. ⛔ This one was labelled narrowing-driven in this file's
 *     first draft and the neutralization control below is what corrected it: with
 *     the narrowing fully neutralized the button still did not appear, because
 *     `showOfferedEditor` also requires a prop `/casos` does not pass. A member's
 *     mechanism is measured, not read off the gate it looks like it belongs to.
 * A fourth, "Editar" (G6), is absent because its JSX was DELETED (ADR 0134 F-5) —
 * see the control map.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * NEW (Increment 1) vs PRE-EXISTING — MEASURED AT THE MERGE BASE, NEVER INFERRED
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The merge base of the Increment-1 merge (`6e364203`) is **`df88dced`**. There
 * (`git show df88dced:src/components/cases/case-detail-view.tsx`):
 *
 *   readingAsMember = managementElsewhere && rawCaps.canManageLifecycle   // COORDINATOR ONLY
 *   caps            = readingAsMember ? {…, canManageLifecycle: false, canWriteContent: false} : rawCaps
 *   effectiveCanAssignPhases       = readingAsMember ? false : canAssignPhases || caps.canManageLifecycle
 *   effectiveCanEditMeta           = readingAsMember ? false : canEditMeta
 *   effectiveCanManagePhaseResults = readingAsMember ? false : canManagePhaseResults
 *
 * So new-vs-pre-existing is a fact about a (MEMBER, VIEWER CLASS) **cell**, not about
 * a member. The same button is pre-existing-absent for a coordinator and
 * newly-absent for a write-grantee:
 *
 *   • COORDINATOR — `readingAsMember` was already true at `df88dced`, and the
 *     narrowing there already zeroed BOTH `canManageLifecycle` and
 *     `canWriteContent`. Every G1–G5 member was therefore ALREADY absent on
 *     `/casos`. **The entire coordinator column is PRE-EXISTING (`8675b7cd`).**
 *   • WRITE-GRANTEE — `readingAsMember` was FALSE for them at `df88dced`, so the G1
 *     members were PRESENT on `/casos`. Increment 1 widened the trigger to
 *     `isReadingAsMember` (lifecycle ∨ per-case write). **The G1 cells are NEW.**
 *     The G2–G5 members were never theirs on EITHER host — absent for a reason that
 *     predates both commits, which is a different fact and is asserted below as a
 *     both-hosts control, never as a differential.
 *   • ADMINISTRATIVO — never `readingAsMember`, then or now. At `df88dced` the
 *     `/casos` host ITSELF passed `canAssignPhases={canInCommission(access,
 *     'assign_case_phases')}` and `canEditMeta={canInCommission(access,
 *     'create_cases')}`, so G3 and G6 rendered there for this class. Increment 1
 *     stopped passing both. **The G3 and G6 cells are NEW.**
 *
 * ⛔ TWO CELLS THAT *LOOK* NEW AND ARE NOT — the trap v2 of the follow-up fell into,
 * one member over:
 *   • **"Corrigir resultado" (G5)** — its prop stopped being passed by `/casos` in
 *     Increment 1, which reads as a new absence. It is not: at `df88dced` the
 *     `/casos` host computed `canManagePhaseResults = phaseResultsOn && access.role
 *     === 'staff_admin'`, i.e. coordinator-only — and a coordinator was already
 *     `readingAsMember`, so `effectiveCanManagePhaseResults` was already `false`. No
 *     class could see it there. **PRE-EXISTING for every class.** Never infer this
 *     from "the prop changed".
 *   • **Custom-field "Editar" (G4) for a COORDINATOR** — at `df88dced` the gate read
 *     `(caps.canManageLifecycle || effectiveCanEditMeta) && isOpen`, both already
 *     zeroed for them. **PRE-EXISTING for the coordinator; NEW only for the
 *     administrativo**, whose `create_cases` grant reached it via `effectiveCanEditMeta`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * THE NEUTRALIZATION CONTROL — which absences were PROVEN able to go RED
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * An absence assertion that cannot fail proves nothing. Run manually against the
 * local stack (not shipped as an executable step — there is no in-repo mechanism to
 * mutate Next.js source mid-suite), measured **2026-08-22**, reverted immediately
 * after, `git diff -- src/` empty before continuing:
 *
 *   N1 — `isReadingAsMember` left alone, `narrowToReadingSurface` returned `caps`
 *        unchanged. **9 of 14 members flipped PRESENT on `/casos`** for the
 *        coordinator: all four G1, plus Encaminhar caso · Nova entrevista ·
 *        Adicionar participante · Desfecho do caso · Não necessária. COORD-1 and
 *        WRITE-1 went RED; ADM-1, PLESS-1 and CF-1 stayed GREEN — correctly, since
 *        none of those rides on the narrowing.
 *   N2 — `isReadingAsMember` forced `false` AND `canAssignPhases` /
 *        `canManagePhaseResults` / `canEditCustomFields` re-passed by the `/casos`
 *        host. **11 of 14 flipped**: N1's nine plus "Ativar e atribuir" (G3) and
 *        "Corrigir resultado" (G5); ADM-1 flipped on G3 alone and CF-1 on G4.
 *        ⭐ G4 and G5 needed BOTH halves neutralized — for a coordinator they are
 *        doubly guarded (host does not pass the prop AND the narrowing zeroes it),
 *        which is the "neither end is load-bearing alone" design stated in
 *        `case-detail-view.tsx`, here measured rather than asserted.
 *
 *   ⛔ THREE MEMBERS COULD NOT BE MADE TO FAIL, and that is a property of the code,
 *   not a gap in the control: "Adicionar fase", "Adicionar narrativa" and "Editar
 *   desfechos disponíveis" are NEVER-FED (no prop to un-narrow), and the case-meta
 *   "Editar" (G6) has no JSX left to render. For these four the `/casos` half is a
 *   REGRESSION GUARD against the fuel/JSX being restored, and the manage-side
 *   positive control is what carries the differential. Stated because a control map
 *   that lists only what flipped reads as though everything did.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE DELIBERATELY DOES NOT COVER (stated so the sweep is not read as
 * wider than it is)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  1. **administrativo × custom fields (G4)** — the one NEW cell with no reachable
 *     fixture. `update_case_custom_field_values` admits `member_can('create_cases')`;
 *     exactly one non-coordinator holds it (`staff2.ccih`) and `can_read_case` is
 *     FALSE for them on the only case carrying custom-field values. Filed as
 *     `FUP-ADMINISTRATIVO-CUSTOM-FIELDS-ARM-NOT-E2E-VERIFIABLE`; closing it needs a
 *     SEED change, routed to Increment 2. The COORDINATOR cell is covered (CF-1).
 *  2. **Narrative authorship** (G1/G2 on a narrative card, and the second `/casos`
 *     route) — already owned by `case-access.spec.ts` AC-3b and the T6 narrative
 *     differential. Not duplicated; the ATTRIBUTED half is reused here as this
 *     file's anti-over-reach control (ADM-1).
 *  3. **Patient-panel edit** (G2) — PHI. `case-patient.spec.ts` owns that corridor
 *     including the audited door; a surface-level restatement here would add no
 *     evidence.
 *  4. **Event visibility** (`canSetVisibility`, G2) — a field INSIDE the "Adicionar
 *     registro" dialog, whose trigger member #2 already proves unreachable on
 *     `/casos`. Asserting it separately asserts the same absence twice.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * FIXTURES (built here; nothing seeded is mutated)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *   CASE_T  — a TEMPLATED case from a template this spec publishes. Phase 1 emits a
 *             result and is driven to `completed` through the real RPC chain
 *             (activate → start → save → submit): `app.guard_case_phase_status`
 *             refuses every direct write to `case_phases` outside `app.in_case_rpc`,
 *             a GUC PostgREST cannot set, and `add_ad_hoc_phase` has no
 *             `emits_result` parameter — so the template route is the ONLY way to
 *             produce a phase on which "Corrigir resultado" can render at all.
 *             Phase 2 stays `pending`. Two offered outcomes (snapshotted by
 *             `create_case_from_template` from `process_template_outcomes`).
 *             staff3 holds a per-case WRITE grant; staff2 (the seeded
 *             Administrativo) is assigned a narrative — both her READ attribution
 *             and the control proving the narrowing kept name-attributed work.
 *   CASE_P  — a PROCESS-LESS case (`create_case`), the only shape that renders the
 *             offered-outcomes EDITOR (`isProcessless`).
 *   CF case — the seeded `d0cf0000-…-c1` "Óbito enfermaria leito 3", READ-ONLY here:
 *             the only case carrying custom-field values.
 *
 * Serial — `beforeAll` builds shared fixtures. Needs the local Supabase stack and a
 * running app.
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants — every id below was measured from the local catalog, not assumed.
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes — defina-os em .env.local.',
  )
}

const ORG = 'rede-a'
const BASE = `/o/${ORG}/c/ccih`
const COMM_CCIH = 'a0000000-0000-0000-0000-0000000000a1'

const UID_CHEFE = '00000000-0000-0000-0000-000000000002' // coordinator (staff_admin)
const UID_STAFF2 = '00000000-0000-0000-0000-000000000004' // seeded Administrativo, all four capabilities
const UID_STAFF3 = '00000000-0000-0000-0000-000000000009' // write-grant target

const CHEFE = 'chefe.ccih@test.local'
const STAFF2 = 'staff2.ccih@test.local'
const STAFF3 = 'staff3.ccih@test.local'

// A seeded, published form used as both phases' form. Measured: two REQUIRED items,
// both selection-based (a multiple_choice and a dropdown) — hence the two-key
// `p_selections` payload in the fixture.
const FORM_ID = 'f0000000-0000-0000-0000-00000000a001'
const FORM_SECTION_ID = 'c0000000-0000-0000-0000-00000000a001'
const ITEM_MC = 'd0000000-0000-0000-0000-00000000a101'
const ITEM_DD = 'd0000000-0000-0000-0000-00000000a102'

const OUTCOME_1 = 'e1000000-0000-0000-0000-0000000000d1'
const OUTCOME_2 = 'e1000000-0000-0000-0000-0000000000d2'
const NARRATIVE_TYPE_RESUMO = 'e2000000-0000-0000-0000-0000000000f1'

// The seeded custom-fields case (case-custom-fields.spec.ts's AC-4 fixture) — the
// only case platform-wide carrying custom-field values. READ-ONLY here.
const CF_CASE_ID = 'd0cf0000-0000-0000-0000-0000000000c1'

const SPEC_TAG = 'CASOS-DIFF'
const DB_CONTAINER = 'supabase_db_azkbbhskturikxpgmafq'

// Fixture ids, populated in beforeAll.
let caseTemplated = ''
let caseProcessless = ''

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string) {
  await cachedSignIn(page, email, 'Test1234!')
}

async function signOut(page: Page) {
  await page.goto(`${BASE}/meus-casos`)
  await page.waitForURL(/meus-casos/)
  await page.getByRole('button', { name: /abrir menu da conta/i }).click()
  await page.getByRole('menuitem', { name: /sair/i }).click()
  await page.waitForURL(/\/login/)
}

async function getToken(request: APIRequestContext, email: string): Promise<string> {
  const resp = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    data: { email, password: 'Test1234!' },
  })
  expect(resp.ok(), `getToken(${email}) failed: ${await resp.text()}`).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

/** Call a PostgREST RPC as a REAL user — the door, not the service role. */
async function rpc(
  request: APIRequestContext,
  token: string,
  fn: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const resp = await request.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })
  const raw = await resp.text()
  expect(resp.ok(), `rpc ${fn} failed (${resp.status()}): ${raw}`).toBeTruthy()
  // A `returns void` RPC (set_process_outcomes, publish_process_template,
  // grant_case_access) answers with an EMPTY body — `resp.json()` would throw
  // there, which reads as a fixture bug in the wrong place.
  return raw.length > 0 ? (JSON.parse(raw) as unknown) : null
}

async function svcGet<T>(request: APIRequestContext, path: string): Promise<T[]> {
  const resp = await request.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  })
  const data: unknown = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

/**
 * Purge anything this spec created (also run FIRST, so an aborted run cannot poison
 * the next one).
 *
 * ⛔ `docker exec psql` with `session_replication_role = replica`, not PostgREST:
 * `app.guard_case_phase_status` refuses EVERY direct write to `case_phases` —
 * insert, status change, and the DELETE of a terminal phase — unless
 * `app.in_case_rpc` is on, and a PostgREST client cannot set that GUC. Same escape
 * `case-phase-result.spec.ts` uses, for the same reason.
 *
 * ⚠ Replica mode also disables FK CASCADE, so every child row is deleted
 * EXPLICITLY here instead of riding a cascade that only works in normal mode.
 * Ordering matters for the same reason: each subselect must run while its source
 * rows still exist.
 *
 * ⛔ THE EXIT STATUS IS READ, DELIBERATELY (QA case-surface-split-increment-2-review.md
 * B5b). `psql -c "<14 statements>"` runs the whole string as ONE implicit
 * transaction — the first statement to error aborts every statement after it,
 * silently, with `spawnSync`'s own return value carrying the only signal. The
 * previous version never inspected `status`/`stderr`, so a partial purge (a
 * process template, a `phase_results` vocabulary row, or a case surviving) leaked
 * into every later spec in the run with zero indication anything had gone wrong —
 * a restore that fails and reads exactly like one that worked. This throws on any
 * non-zero exit or spawn-level error, carrying `stderr` in the message, so a failed
 * purge fails the `beforeAll`/`afterAll` hook loudly instead of returning silently.
 */
function purgeFixtures() {
  const caseSel = `SELECT id FROM cases WHERE label LIKE 'Caso ${SPEC_TAG}%'`
  const versionSel = `SELECT id FROM process_template_versions WHERE title LIKE 'Template ${SPEC_TAG}%'`

  const sql = [
    'SET session_replication_role = replica',
    `DELETE FROM responses WHERE case_phase_id IN (
       SELECT cp.id FROM case_phases cp JOIN cases c ON c.id = cp.case_id
       WHERE c.label LIKE 'Caso ${SPEC_TAG}%')`,
    `DELETE FROM case_phases WHERE case_id IN (${caseSel})`,
    `DELETE FROM case_narratives WHERE case_id IN (${caseSel})`,
    `DELETE FROM case_offered_outcomes WHERE case_id IN (${caseSel})`,
    `DELETE FROM case_phase_offered_results WHERE case_id IN (${caseSel})`,
    `DELETE FROM case_access_grants WHERE case_id IN (${caseSel})`,
    `DELETE FROM securable_resources WHERE resource_type = 'case' AND id IN (${caseSel})`,
    `DELETE FROM cases WHERE label LIKE 'Caso ${SPEC_TAG}%'`,
    `DELETE FROM process_template_phases WHERE template_version_id IN (${versionSel})`,
    `DELETE FROM process_template_outcomes WHERE template_version_id IN (${versionSel})`,
    `DELETE FROM process_templates WHERE id IN (
       SELECT template_id FROM process_template_versions WHERE title LIKE 'Template ${SPEC_TAG}%')`,
    `DELETE FROM process_template_versions WHERE title LIKE 'Template ${SPEC_TAG}%'`,
    `DELETE FROM phase_results WHERE commission_id = '${COMM_CCIH}' AND label LIKE '%${SPEC_TAG}%'`,
    'SET session_replication_role = DEFAULT',
  ].join('; ')

  const result = spawnSync(
    'docker',
    ['exec', DB_CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-c', sql],
    { stdio: 'pipe' },
  )
  if (result.error) {
    throw new Error(`purgeFixtures: failed to spawn docker exec psql: ${result.error.message}`)
  }
  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString('utf-8') : '(no stderr captured)'
    throw new Error(
      `purgeFixtures: psql exited ${result.status} — the purge is PARTIAL (psql aborts the ` +
        `remaining statements on the first error), so every later spec in this run would ` +
        `otherwise inherit leftover fixture rows with no signal. stderr:
${stderr}`,
    )
  }
}

/**
 * THE CLASS ITSELF now lives in `./helpers/case-affordance-class` (imported above).
 * It moved out of this file for QA case-surface-split-increment-2-review.md M-15:
 * being module-private here is what let the next spec that needed "the read-only
 * shell" name TWO absences by hand against this 16-member derived class, in the same
 * delivery that derived it. The derivation, the NEVER-FED annotations and the N1/N2
 * neutralization record stay in THIS file's header — the tables are shared, the
 * evidence is not duplicated.
 */

async function openCasos(page: Page, caseId: string) {
  await page.goto(`${BASE}/casos/${caseId}`)
  await page.waitForURL(`${BASE}/casos/${caseId}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })
}

async function openManage(page: Page, caseId: string) {
  await page.goto(`${BASE}/manage/cases/${caseId}`)
  await page.waitForURL(`${BASE}/manage/cases/${caseId}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

test.beforeAll(async ({ request }) => {
  purgeFixtures()

  const chefe = await getToken(request, CHEFE)

  // A phase-result vocabulary row FIRST: `create_case_from_template` snapshots the
  // commission's active vocabulary into `case_phase_offered_results`, so a row
  // created after the case would not reach it. Without it the "Corrigir resultado"
  // dialog would open empty — a hollow positive control.
  const phaseResult = (await rpc(request, chefe, 'create_phase_result', {
    p_commission_id: COMM_CCIH,
    p_label: `Resultado ${SPEC_TAG}`,
  })) as { id: string }

  // A two-phase template: phase 1 EMITS a result, phase 2 does not.
  const tpl = await createDraftTemplateDirect(
    request,
    { baseUrl: SUPABASE_URL, apikey: SUPABASE_SERVICE_KEY, bearerToken: SUPABASE_SERVICE_KEY },
    { commissionId: COMM_CCIH, title: `Template ${SPEC_TAG}`, createdBy: UID_CHEFE },
  )

  await rpc(request, chefe, 'add_template_phase', {
    p_template_version_id: tpl.versionId,
    p_form_id: FORM_ID,
    p_title: `Fase 1 ${SPEC_TAG} — emite resultado`,
    p_emits_result: true,
    // Required by `app.validate_template_phase_result` (HC059): an emitting phase
    // must declare its allowed subset, or `publish_process_template` refuses.
    p_allowed_result_ids: [phaseResult.id],
  })
  await rpc(request, chefe, 'add_template_phase', {
    p_template_version_id: tpl.versionId,
    p_form_id: FORM_ID,
    p_title: `Fase 2 ${SPEC_TAG} — pendente`,
  })
  await rpc(request, chefe, 'set_process_outcomes', {
    p_template_version_id: tpl.versionId,
    p_outcome_ids: [OUTCOME_1, OUTCOME_2],
  })
  await rpc(request, chefe, 'publish_process_template', { p_template_id: tpl.templateId })

  const created = (await rpc(request, chefe, 'create_case_from_template', {
    p_template_id: tpl.templateId,
    p_label: `Caso ${SPEC_TAG} — diferencial da superfície de leitura`,
  })) as { id: string }
  caseTemplated = created.id

  const phases = await svcGet<{ id: string; position: number }>(
    request,
    `case_phases?case_id=eq.${caseTemplated}&select=id,position&order=position`,
  )
  expect(phases.length, 'fixture: the templated case must carry both phases').toBe(2)

  // Drive phase 1 to `completed` through the real RPC chain — the ONLY route (see
  // the CASE_T note in the header).
  await rpc(request, chefe, 'activate_phase', {
    p_case_phase_id: phases[0].id,
    p_assigned_to: UID_CHEFE,
  })
  const resp = (await rpc(request, chefe, 'start_or_resume_phase', {
    p_case_phase_id: phases[0].id,
  })) as { id: string }
  await rpc(request, chefe, 'save_section_answers', {
    p_response_id: resp.id,
    p_section_id: FORM_SECTION_ID,
    p_answers: {},
    p_selections: { [ITEM_MC]: ['sim'], [ITEM_DD]: ['manha'] },
  })
  // An emitting phase with no ruleset is MANUAL-mode: `app.compute_case_phase_result`
  // refuses the submit (HC061) until a result is chosen. Selecting it here is part of
  // filling the phase, not part of what this file asserts.
  await rpc(request, chefe, 'set_case_phase_result_override', {
    p_case_phase_id: phases[0].id,
    p_result_id: phaseResult.id,
    p_reason: `${SPEC_TAG} fixture — seleção de resultado da fase manual`,
  })
  await rpc(request, chefe, 'submit_response', { p_response_id: resp.id })

  const built = await svcGet<{ position: number; status: string; emits_result: boolean }>(
    request,
    `case_phases?case_id=eq.${caseTemplated}&select=position,status,emits_result&order=position`,
  )
  // ⛔ The fixture's own preconditions, asserted rather than assumed. Each one, if
  // false, would make a differential below GREEN while proving nothing: a
  // non-emitting phase resolves to correction mode "none" (control hidden on BOTH
  // hosts for a reason unrelated to the narrowing), and a phase that never reached
  // `completed` hides it the same way.
  expect(built[0]?.status, 'fixture: phase 1 must be COMPLETED').toBe('completed')
  expect(built[0]?.emits_result, 'fixture: phase 1 must EMIT a result').toBe(true)
  expect(built[1]?.status, 'fixture: phase 2 must stay PENDING').toBe('pending')
  const offered = await svcGet<{ outcome_id: string }>(
    request,
    `case_offered_outcomes?case_id=eq.${caseTemplated}&select=outcome_id`,
  )
  expect(offered.length, 'fixture: the case must offer outcomes').toBe(2)

  // staff2 (the seeded Administrativo) needs an ordinary READ on this case AND a
  // name-attributed piece of work — the ADM-1 control. An EXISTING narrative type,
  // never a new label: `add_ad_hoc_narrative` mints a COMMISSION-WIDE type from
  // `p_new_type_label`, which would pollute a vocabulary other specs assert on.
  await rpc(request, chefe, 'add_ad_hoc_narrative', {
    p_case_id: caseTemplated,
    p_narrative_type_id: NARRATIVE_TYPE_RESUMO,
    p_assigned_to: UID_STAFF2,
  })

  // staff3 — a per-case WRITE grant, through the real door.
  await rpc(request, chefe, 'grant_case_access', {
    p_case: caseTemplated,
    p_user: UID_STAFF3,
    p_level: 'write',
    p_reason: `${SPEC_TAG} write-grantee differential`,
  })

  // A PROCESS-LESS case — the only shape that renders the offered-outcomes EDITOR.
  const pless = (await rpc(request, chefe, 'create_case', {
    p_commission_id: COMM_CCIH,
    p_label: `Caso ${SPEC_TAG} — sem processo`,
    p_outcome_ids: [OUTCOME_1, OUTCOME_2],
  })) as { id: string }
  caseProcessless = pless.id
})

test.afterAll(async () => {
  purgeFixtures()
})

// ===========================================================================
// COORD-1 — the coordinator column: the WHOLE class, absent on /casos, present on
// /manage. Every cell here is PRE-EXISTING (`8675b7cd`). Nothing in this test is
// evidence about Increment 1, and saying so IS the point — the follow-up's v2
// error was reporting a coordinator's long-standing absence as newly narrowed.
// ===========================================================================

test('COORD-1 coordinator (chefe.ccih): every case-wide affordance is ABSENT on /casos and PRESENT on /manage/cases for the SAME case — all PRE-EXISTING (8675b7cd), none new', async ({
  page,
}) => {
  // Census guard: a table-driven differential that silently lost rows would pass
  // having asserted nothing. 16 = the whole derivation (4 G1 + 7 G2 + 1 G3 + 1 G5 +
  // 1 G6, plus the two members that need their own case SHAPE — PLESS-1's
  // process-less editor and CF-1's custom fields); 14 of them share this fixture.
  expect(FULL_CLASS.length, 'the derived case-wide class must have 16 members').toBe(16)
  expect(CASE_WIDE_CLASS.length, '14 of them share the templated fixture case').toBe(14)

  await signInAs(page, CHEFE)

  await openCasos(page, caseTemplated)
  await assertAbsentOnCasos(page, CASE_WIDE_CLASS)

  // The escape hatch is what makes the absences above a RELOCATION rather than a
  // deletion — counted by accessible name AND href (AC-3b's shape).
  const manageLink = caseHeader(page).getByRole('link', { name: 'Gerenciar caso' })
  await expect(manageLink).toBeVisible({ timeout: 15_000 })
  await expect(manageLink).toHaveAttribute('href', `${BASE}/manage/cases/${caseTemplated}`)

  await manageLink.click()
  await page.waitForURL(`${BASE}/manage/cases/${caseTemplated}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })

  await assertPresentOnManage(page, CASE_WIDE_CLASS)

  await signOut(page)
})

// ===========================================================================
// WRITE-1 — the write-grantee column. The G1 cells are the ones Increment 1 NEWLY
// narrowed: at `df88dced`, `readingAsMember` was coordinator-only, so a
// write-grantee kept the content editors on `/casos`.
// ===========================================================================

test('WRITE-1 write-grantee (staff3): the four canWriteContent affordances are NEWLY absent on /casos and present on /manage/cases; the lifecycle members are absent on BOTH hosts, which is a different fact', async ({
  page,
}) => {
  expect(G1_MEMBERS.length, 'the canWriteContent (G1) subset must have 4 members').toBe(4)

  await signInAs(page, STAFF3)

  await openCasos(page, caseTemplated)
  await assertAbsentOnCasos(page, G1_MEMBERS)

  const manageLink = caseHeader(page).getByRole('link', { name: 'Gerenciar caso' })
  await expect(manageLink).toBeVisible({ timeout: 15_000 })
  await expect(manageLink).toHaveAttribute('href', `${BASE}/manage/cases/${caseTemplated}`)

  await openManage(page, caseTemplated)
  await assertPresentOnManage(page, G1_MEMBERS)

  // ⛔ NOT a differential — a BOTH-HOSTS control. A write grant is not
  // `canManageLifecycle` on either host and never was, so reporting these as
  // "narrowed off /casos" for this class is precisely the v2 error this file exists
  // to stop repeating. Asserted here so the WRITE-1 absences above cannot be read
  // as "everything moved".
  await assertAbsentHere(
    page,
    G2_MEMBERS,
    'a write-grantee never held lifecycle — these must be absent on the MANAGE host too, so the /casos absences above are not read as "everything moved"',
  )

  await signOut(page)
})

// ===========================================================================
// ADM-1 — the administrativo column. G3 + G6 are the NEW cells: at `df88dced` the
// `/casos` host itself passed `canAssignPhases` and `canEditMeta` from the
// commission capability grants, so both rendered there for this class.
// ===========================================================================

test('ADM-1 administrativo (staff2): "Ativar e atribuir" and the case-meta "Editar" are NEWLY absent on /casos and present on /manage/cases; her ASSIGNED narrative stays editable on /casos, which is what proves the narrowing did not over-reach', async ({
  page,
}) => {
  const admMembers = [...G3_MEMBERS, ...G6_MEMBERS]
  expect(admMembers.length, 'the administrativo (G3+G6) subset must have 2 members').toBe(2)

  await signInAs(page, STAFF2)

  await openCasos(page, caseTemplated)
  await assertAbsentOnCasos(page, admMembers)

  // THE ANTI-OVER-REACH CONTROL. staff2 is the assignee of the narrative built onto
  // this case, and the assignee test precedes the capability test (ADR 0033 Q14 /
  // CA-002), so her name-attributed work survives on the reading surface. Without
  // this, the absences above would pass equally well if `/casos` rendered nothing
  // writable at all — which is neither the shipped behaviour nor what D1 says.
  const workZone = region(page, /^Trabalho do caso$/)
  await expect(workZone).toBeVisible({ timeout: 15_000 })
  await expect(
    workZone.getByRole('button', { name: /^Editar$/ }).first(),
    'staff2 must still edit the narrative SHE is assigned, on /casos',
  ).toBeVisible({ timeout: 15_000 })

  await openManage(page, caseTemplated)
  await assertPresentOnManage(page, admMembers)

  await signOut(page)
})

// ===========================================================================
// PLESS-1 — the offered-outcomes EDITOR, the one class member that renders only on
// a PROCESS-LESS case (`isProcessless`). PRE-EXISTING, and NEVER-FED: measured
// under both neutralizations, this button does NOT come back when the narrowing is
// removed, because `showOfferedEditor` also requires `casesExtrasEnabled` — a prop
// `/casos` has never passed (`df88dced` and HEAD alike). Its gate reads G2, its
// mechanism is the host. Recorded because the first draft of this file asserted the
// mechanism from the gate and was wrong.
// ===========================================================================

test('PLESS-1 coordinator, process-less case: "Editar desfechos disponíveis" is absent on /casos and present on /manage/cases (NEVER-FED — a regression guard, not a narrowing proof)', async ({
  page,
}) => {
  const editor = PLESS_MEMBER

  await signInAs(page, CHEFE)

  await openCasos(page, caseProcessless)
  await assertAbsentOnCasos(page, [editor])

  await openManage(page, caseProcessless)
  await assertPresentOnManage(page, [editor])

  await signOut(page)
})

// ===========================================================================
// CF-1 — custom fields (G4). PRE-EXISTING for a coordinator: at `df88dced` the gate
// read `(caps.canManageLifecycle || effectiveCanEditMeta) && isOpen`, both already
// zeroed for them. The administrativo cell — the NEW one — has no reachable
// fixture; see FUP-ADMINISTRATIVO-CUSTOM-FIELDS-ARM-NOT-E2E-VERIFIABLE.
// ===========================================================================

test('CF-1 coordinator, the seeded custom-fields case: "Editar" in "Campos personalizados" is absent on /casos and present on /manage/cases (PRE-EXISTING for this class)', async ({
  page,
}) => {
  const customFields = CF_MEMBER

  await signInAs(page, CHEFE)

  await openCasos(page, CF_CASE_ID)
  await assertAbsentOnCasos(page, [customFields])

  await openManage(page, CF_CASE_ID)
  await assertPresentOnManage(page, [customFields])

  await signOut(page)
})

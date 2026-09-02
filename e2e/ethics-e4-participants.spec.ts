import { test, expect, type Page, type Locator, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"

/**
 * Ethics E4 — Participant seating & professional identity (ADR
 * 0108; build plan docs/phases/ethics-e4-participant-seating.md §5.2; locator
 * contract docs/phases/ethics-e4-locator-contract.md). Closes FUP-ETH-1: before
 * this track NOTHING could seat a professional or an external person onto a
 * case's roster ("Médico denunciado" was an unfillable panel) — this file drives
 * the real product path (`CaseParticipantsPanel` + `AddParticipantDialog` +
 * `ResolveLinkageDialog`) end-to-end.
 *
 * Written EARLY, in parallel with `frontend`/`backend`, against the frozen
 * locator contract — not against a landed UI. Every `getByRole`/`getByLabel`
 * string below is copied verbatim from the contract (or from the lead's
 * follow-up answers, see "CONTRACT GAPS" below). Do not run this file until the
 * lead confirms the UI has landed.
 *
 * ## Why this file matters disproportionately (per the build plan)
 *
 * `ensure_professional_participant` and `create_external_participant` are BRAND
 * NEW `public`-schema DEFINER doors. pgTAP calls functions in-database and would
 * stay green even if a door were accidentally left in `app` (a PostgREST 404 no
 * client can reach — "the correct door nothing can reach" failure class already
 * on this project's record). Only E2E traverses PostgREST. PROF-CREATE and
 * EXT-CREATE below are that proof, not just UI coverage.
 *
 * ## CONTRACT GAPS surfaced while writing this file (all resolved by the lead
 * against the LANDED code — not guesses; one of my own working assumptions
 * below was WRONG and is noted as such, not smoothed over)
 *
 * 1. The resolve-linkage dialog's submit button name was NOT in the original
 *    contract (§3 only specified the dialog name + that it reuses §2a's
 *    radiogroup/picker/checkbox strings). Lead's answer: **"Registrar vínculo com
 *    conta"** (the codebase's `Registrar <object>` convention for an audited
 *    assertion; bare "Registrar vínculo" collides with
 *    `affiliations-panel.tsx`'s unrelated hospital-affiliation sense).
 * 2. "Row: change role | button | Alterar papel" doesn't say whether the click
 *    opens a dialog or reveals an inline select. **Both of my guesses were
 *    wrong** — the lead read the landed component: it's a `DropdownMenuTrigger`
 *    opening a menu ("Definir papel" label, one `menuitem` per allowed role,
 *    current role disabled), and `onSelect` fires the action directly — no
 *    submit button, no dialog. `changeParticipantRole` below matches this.
 * 3. "Definir como sujeito principal" — as FIRST BUILT it fired directly with no
 *    confirmation. The lead is having frontend add one (ADR 0108 D2 changed this
 *    from *impossible* to *silently demotes the incumbent* — reassigning who a
 *    disciplinary case is about deserves a confirm click): incumbent exists →
 *    `alertdialog` "Alterar o sujeito principal?", confirm "Alterar sujeito
 *    principal", cancel "Cancelar"; no incumbent yet → fires directly, no
 *    dialog. `setPrimarySubject` below matches this; PRIMARY-MOVE-CANCEL covers
 *    the decline path explicitly (an unconfirmed guard is decorative).
 * 4. "Remover" — I inferred an `alertdialog` confirmation from a DIFFERENT
 *    component's established pattern (phase3-admin-members.spec.ts) and
 *    reported it as the shape to expect. As first built there was NO
 *    confirmation at all — the inference was right in spirit (this codebase's
 *    house pattern for a destructive row action) but wrong as a claim about
 *    THIS component's current state; my spec would have hung waiting for a
 *    dialog that didn't exist yet. The lead is making frontend conform to the
 *    house pattern rather than changing the spec — pinned strings below match
 *    phase3 exactly: trigger "Remover" → `alertdialog` "Remover participante?"
 *    → confirm "Remover" (exact) → cancel "Cancelar". Lesson for next time: a
 *    precedent from a sibling component is a strong prior, not a verified fact
 *    about the component under test — same shape as this repo's "migration
 *    file text is stale" trap, one level up the stack.
 *
 * ## Fixture strategy
 *
 * ONE fresh ethics case (`CASE_ID`, real `create_case` RPC, `beforeAll`) whose
 * roster grows across the file's tests in `serial` order — later tests build on
 * earlier ones' seated participants (PRIMARY-MOVE reuses PROF-PICK's and
 * PROF-CREATE's rows; CHANGE-ROLE reuses LINKAGE-UX's row). This mirrors real
 * usage (a coordinator seats several people onto one roster over time) and the
 * house convention (ethics-e2-procedure.spec.ts, ethics-e3a-surfacing.spec.ts).
 * No cleanup: every id this file mints is either case-scoped (fresh per run,
 * like `create_case` elsewhere in this codebase) or an accepted-cost duplicate
 * on rerun-without-reset (external participants are create-always by design —
 * ADR 0108 D8; the professional/participant rows this file mints via
 * `create_professional_profile`/`ensure_professional_participant` inherit the
 * same acceptance). The full E2E gate always runs on a fresh `db reset`.
 *
 * Coverage map (plan §5.2's E2E bullet, expanded):
 *   PROF-PICK       professional respondent, pick-existing lane
 *   PROF-CREATE     professional respondent, create-inline lane (possui conta) —
 *                   PROVES ensure_professional_participant is PostgREST-reachable
 *   LINKAGE-UX      un-defaulted linkage choice (submit disabled until chosen;
 *                   não possui conta requires the consequence checkbox)
 *   EXT-CREATE      external denunciante, create lane — PROVES
 *                   create_external_participant is PostgREST-reachable
 *   EXT-REUSE       external denunciante, reuse-first search (same participant_id)
 *   REMOVE          remove a participant
 *   CHANGE-ROLE     change a participant's role
 *   PRIMARY-SET     set the first primary subject (no incumbent — no dialog)
 *   PRIMARY-MOVE    move the primary subject (the ADR 0108 D2 behavior change —
 *                   confirm the alertdialog; must succeed, must NOT raise "já
 *                   existe sujeito principal")
 *   PRIMARY-MOVE-CANCEL   decline the confirmation — the incumbent must stay
 *                   primary (the assertion that makes the guard real, not
 *                   decorative — the lead's explicit ask)
 *   UNKNOWN-RESOLVE seat resolved, revert to `unknown` via RPC (the add
 *                   dialog resolves an `unknown` pick inline — no product
 *                   path seats someone WHILE unknown, confirmed live), then
 *                   resolve via the roster's "Resolver vínculo" affordance
 *   KBD-1           keyboard-only (CLAUDE.md §8) — seat an external witness
 *                   using only Tab/Arrow/Enter/typing, no mouse
 *
 * Personas (supabase/seed.sql; password Test1234! for all):
 *   chefe.ccih@test.local   staff_admin of CCIH (Rede A) — the only persona this
 *             file signs in as; seating authority.
 *   staff3.ccih@test.local  ("Técnico CCIH Três") — the "possui conta" platform
 *             user behind PROF-CREATE's new professional.
 *   staff2.ccih@test.local  ("Enfermeira CCIH Dois") — the "possui conta"
 *             platform user behind UNKNOWN-RESOLVE's linkage fix.
 *   The seeded "Dra. Denunciada" (participants fa000000-…-e1 / professional_profiles
 *             fb000000-…-e1, bound to staff4.ccih's user_id) — PROF-PICK's
 *             pick-existing candidate; her `professional_profiles.link_state`
 *             is asserted 'linked' in `beforeAll` (the migration's insert-time
 *             derive trigger sets it since her seed row carries a user_id) so a
 *             surprise HC0F0 there fails loudly and close to the cause, not as a
 *             confusing downstream seating error.
 *
 * Runs against a PROD-STANDALONE build or a warm dev server — see
 * docs/testing/e2e-prod-build-gate.md. No `waitForLoadState('networkidle')`;
 * web-first assertions only. Serial (file-level): the roster is built up
 * incrementally and later tests depend on earlier ones' seated rows.
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants (from supabase/seed.sql)
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY missing — set it in .env.local.')
}

const ORG = 'rede-a'
const SLUG = 'ccih'
const BASE = `/o/${ORG}/c/${SLUG}`
const MANAGE_BASE = `${BASE}/manage/cases`
const COMMISSION_A = 'a0000000-0000-0000-0000-0000000000a1'
const ORG_A = '0c000000-0000-0000-0000-00000000000a'
const ETHICS_TYPE_ID = 'ce000000-0000-0000-0000-0000000000e1'

const CHEFE = 'chefe.ccih@test.local'
// org_admin of rede-a — passes `can_manage_professional` via `is_org_admin_of`. The
// only persona this file uses to RE-DECIDE an already-resolved linkage: AE4.7c
// (migration 20261003007230) put an authority bound in front of
// `set_professional_link_state` that a `staff_admin` no longer passes for that case
// (matrix § 12.8.5 — see `revertLinkToUnknown` below).
const ORG_ADMIN = 'orgadmin.a@test.local'
const STAFF2_SEARCH = 'Enfermeira CCIH Dois' // staff2.ccih — UNKNOWN-RESOLVE's platform-user target
const STAFF3_SEARCH = 'Técnico CCIH Três' // staff3.ccih — PROF-CREATE's platform-user target
// UIDs for the SAME two personas, needed to assert WHICH platform user actually got
// linked (QA m6): the roster never displays a linked account's identity, so nothing
// downstream of the typeahead pick would catch a wrong-candidate link without a
// direct DB check against these.
const UID_STAFF2 = '00000000-0000-0000-0000-000000000004'
const UID_STAFF3 = '00000000-0000-0000-0000-000000000009'

/** The seeded ETH·E1 professional profile "Dra. Denunciada" — PROF-PICK's target. */
const SEEDED_PROF_PROFILE_ID = 'fb000000-0000-0000-0000-0000000000e1'
const SEEDED_PROF_SEARCH = 'Denunciada'
const SEEDED_PROF_NAME = 'Dra. Denunciada'

const PW = 'Test1234!'

const NO_ACCOUNT_CONSEQUENCE_TEXT =
  'Confirmo que este profissional não possui conta na plataforma e que, por isso, o impedimento automático no caso não será aplicado.'

// ---------------------------------------------------------------------------
// Auth / navigation helpers (mirror ethics-e2-procedure.spec.ts / ethics-e3a-surfacing.spec.ts)
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, pw = PW) {
  await cachedSignIn(page, email, pw)
}

async function signOut(page: Page) {
  const menuBtn = page.getByRole('button', { name: /abrir menu da conta/i })
  await menuBtn.click()
  await page.getByRole('menuitem', { name: /sair/i }).click()
  await page.waitForURL(/\/login/)
}

async function gotoCase(page: Page) {
  await page.goto(`${MANAGE_BASE}/${CASE_ID}`)
  await page.waitForURL(`${MANAGE_BASE}/${CASE_ID}`)
  await expect(participantsPanel(page)).toBeVisible({ timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// Service-role + direct-authenticated-JWT helpers (mirror ethics-e3a-surfacing.spec.ts)
// ---------------------------------------------------------------------------

async function dbQuery<T = Record<string, unknown>>(
  table: string,
  params: Record<string, string>,
): Promise<T[]> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}&select=*`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  })
  if (!res.ok) return []
  const data: unknown = await res.json()
  return Array.isArray(data) ? (data as T[]) : []
}

async function dbInsert(table: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`dbInsert ${table} failed ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

async function getOwnerToken(request: APIRequestContext, email: string, password = PW): Promise<string> {
  const resp = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password },
  })
  expect(resp.ok()).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

async function callRpc(
  request: APIRequestContext,
  fn: string,
  bearer: string,
  body: Record<string, unknown>,
) {
  return request.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })
}

/** Create a fresh processless ethics case via the REAL `create_case` RPC (chefe). */
async function createEthicsCase(request: APIRequestContext, label: string): Promise<string> {
  const token = await getOwnerToken(request, CHEFE)
  const resp = await callRpc(request, 'create_case', token, {
    p_commission_id: COMMISSION_A,
    p_label: label,
    p_case_type_id: ETHICS_TYPE_ID,
  })
  expect(resp.ok(), `create_case: ${await resp.text()}`).toBeTruthy()
  const body = (await resp.json()) as { id: string } | { id: string }[]
  const id = Array.isArray(body) ? body[0]?.id : body?.id
  expect(id).toBeTruthy()
  return id as string
}

/**
 * Mint a professional profile + registry pairing via the real doors, RESOLVED
 * to `no_account` (not `unknown`) — found live, not assumed: the add dialog's
 * `needsLinkage` (add-participant-dialog.tsx) triggers the inline linkage
 * fieldset the moment an `unknown`-linkage candidate is PICKED from search,
 * for ANY target role — not only `respondent_doctor`, which is all the
 * backend's `assert_respondent_linkage_resolved` gates. There is therefore no
 * product path to seat someone WHILE their linkage is `unknown` (confirmed
 * live: the original version of this fixture tried exactly that and the
 * "Adicionar" submit button never left `disabled`, 30s timeout). `no_account`,
 * not `linked`, so this needs no real unused platform-user persona — every
 * seeded/fixture user is already someone else's linkage target elsewhere in
 * this file.
 */
async function mintSeatableProfessional(request: APIRequestContext, fullName: string): Promise<string> {
  const token = await getOwnerToken(request, CHEFE)
  const createResp = await callRpc(request, 'create_professional_profile', token, {
    p_org: ORG_A,
    p_full_name: fullName,
  })
  expect(createResp.ok(), `create_professional_profile: ${await createResp.text()}`).toBeTruthy()
  const profileId = (await createResp.json()) as string
  expect(profileId).toBeTruthy()

  const mintResp = await callRpc(request, 'ensure_professional_participant', token, {
    p_profile_id: profileId,
  })
  expect(mintResp.ok(), `ensure_professional_participant: ${await mintResp.text()}`).toBeTruthy()

  const resolveResp = await callRpc(request, 'set_professional_link_state', token, {
    p_profile_id: profileId,
    p_link_state: 'no_account',
  })
  expect(resolveResp.ok(), `set_professional_link_state(no_account): ${await resolveResp.text()}`).toBeTruthy()

  return profileId
}

/**
 * Revert an ALREADY-SEATED professional's linkage back to `unknown` via the
 * real RPC — as ORG AUTHORITY (`ORG_ADMIN`), not `CHEFE`.
 *
 * ⛔ SUPERSEDED CLAIM, kept visible rather than deleted: this docstring used to
 * say "`p_link_state not in ('linked', 'no_account', 'unknown')` is the only
 * rejection" — true before AE4.7c, false after. Migration 20261003007230
 * (AE4.7c) layered an AUTHORITY bound in front of that value check:
 *
 *   if v_current_link is distinct from 'unknown'
 *      and not app.can_manage_professional(v_org, auth.uid()) then
 *     raise exception 'o vínculo deste profissional já está definido; …'
 *       using errcode = '42501';
 *
 * This helper always runs on a profile `mintSeatableProfessional` already
 * resolved to `no_account` — i.e. `v_current_link` is NOT `'unknown'` — so the
 * call is a RE-DECISION of an already-decided linkage, not a first resolution.
 * Matrix § 12.8.5: a `staff_admin` may COMPLETE an add (resolve from
 * `unknown`), never RE-DECIDE one; only org authority may. `CHEFE` (staff_admin)
 * therefore gets 42501 here — `ORG_ADMIN` (org_admin of rede-a, passing
 * `can_manage_professional` via `is_org_admin_of`) is required. `unknown` is
 * still a genuine target state, not just a column default, and the original
 * value check still holds — this is an ADDITIONAL bound in front of it, not a
 * replacement for it.
 *
 * This remains the mechanism ADR 0108 actually names for how a seated
 * professional ends up needing "Resolver vínculo": "a profile can be flipped
 * back to unknown by set_professional_link_state after seating" — a legacy/
 * reverted profile, not a freshly-unresolved one. No UI reaches this
 * transition, so it is exercised directly, mirroring the shape of
 * `mintSeatableProfessional` above.
 */
async function revertLinkToUnknown(request: APIRequestContext, profileId: string): Promise<void> {
  const token = await getOwnerToken(request, ORG_ADMIN)
  const resp = await callRpc(request, 'set_professional_link_state', token, {
    p_profile_id: profileId,
    p_link_state: 'unknown',
  })
  expect(resp.ok(), `set_professional_link_state(unknown): ${await resp.text()}`).toBeTruthy()
}

// ---------------------------------------------------------------------------
// Roster + dialog UI helpers (locator strings verbatim from
// docs/phases/ethics-e4-locator-contract.md unless a "CONTRACT GAP" comment says
// otherwise)
// ---------------------------------------------------------------------------

function participantsPanel(page: Page): Locator {
  return page.getByRole('region', { name: 'Participantes' })
}

/**
 * The roster row(s) for `participantName`. The panel renders ONE <li> PER
 * (participant, role) SEATING, not one per unique participant —
 * case-participants-panel.tsx:327 keys its map on `p.id`, and `p.id` is the
 * `case_participants` row id (what `removeCaseParticipant`/`setPrimarySubject`
 * take), confirmed against the landed source. A participant seated under two
 * different roles (two separate `add_case_participant` calls — NOT a role
 * *change*, which updates the existing row via `set_case_participant_role`
 * and stays one row) therefore has TWO <li>s that both match on name alone.
 *
 * Pass `roleLabel` to disambiguate to the one row carrying both — a second
 * `.filter({ hasText })`, not `.first()`/`.last()`, which would silently
 * assert against whichever row happens to sort first and rot the moment
 * ordering changes. Omit `roleLabel` only where the participant is known to
 * have exactly one seating at that point in the file's serial sequence.
 */
function rosterRow(page: Page, participantName: string | RegExp, roleLabel?: string): Locator {
  const byName = participantsPanel(page).locator('li').filter({ hasText: participantName })
  return roleLabel ? byName.filter({ hasText: roleLabel }) : byName
}

async function openAddParticipantDialog(page: Page): Promise<Locator> {
  await participantsPanel(page).getByRole('button', { name: 'Adicionar participante' }).click()
  const dialog = page.getByRole('dialog', { name: 'Adicionar participante' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  return dialog
}

/**
 * `optionName` is a plain string, deliberately never wrapped in `new
 * RegExp(...)` by a caller — every candidate here is a known fixture NAME,
 * and several carry literal `(` `)` (e.g. "João Denunciante Externo (E4)")
 * that `new RegExp(name)` would compile as a capture group instead of
 * literal characters, requiring the impossible text "...Externo E4" and
 * timing out the `.click()` forever. Same trap this codebase has already
 * hit and documented twice (ethics-e1-access-spine.spec.ts AC-9;
 * ethics-e3a-surfacing.spec.ts's `cellCount`) — both landed on the same
 * fix: a plain string, left as Playwright's default SUBSTRING match (not
 * `exact: true`). Substring is deliberate, not an oversight: a typeahead
 * option MAY render more than the bare name (e.g. a professional's CRM
 * alongside it, per ADR 0108 D5's own disambiguation argument), and a
 * substring match finds it either way; `exact: true` would only work if the
 * option's full text is provably nothing but the name, which isn't known
 * here. `.first()` remains a safety net, not the correctness mechanism —
 * see the listbox scope below for that.
 *
 * QA m6: an earlier version of this helper looked up the option PAGE-WIDE,
 * on the theory that Radix-style popovers commonly portal their listbox to
 * `<body>` (true of `reference-picker.tsx`, the pattern this was copied
 * from, per ff5-references.spec.ts's own `pickReference`) — a theory never
 * checked against THIS component. Read live: `TypeaheadField` in
 * add-participant-dialog.tsx renders its listbox INLINE, an absolutely-
 * positioned sibling `<div>` in the same wrapper as the input, not a
 * Portal. A page-wide (or even dialog-wide) `getByRole('option')` can
 * therefore ALSO match a native `<select><option>` elsewhere in the SAME
 * dialog (Papel, Tipo) — those structurally carry role `option` too — and
 * `.first()` would silently click whichever comes first in DOM order.
 * Scoped to THIS field's own listbox instead, via the `aria-label="Opções
 * para {label}"` TypeaheadField sets on it — the precise boundary, not a
 * guess at portal-vs-inline.
 */
async function pickFromTypeahead(
  page: Page,
  dialog: Locator,
  fieldLabel: string,
  query: string,
  optionName: string,
) {
  const input = dialog.getByRole('combobox', { name: fieldLabel })
  await input.click()
  await input.fill(query)
  const listbox = dialog.getByRole('listbox', { name: `Opções para ${fieldLabel}` })
  await listbox.getByRole('option', { name: optionName }).first().click()
}

async function submitAddDialog(dialog: Locator) {
  await dialog.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })
}

/** Professional lane, pick-existing sub-flow. */
async function seatProfessionalExisting(
  page: Page,
  opts: { searchTerm: string; candidateName: string; roleLabel: string; involvementNote?: string },
) {
  const dialog = await openAddParticipantDialog(page)
  await dialog.getByRole('radio', { name: 'Profissional' }).check()
  await pickFromTypeahead(page, dialog, 'Buscar profissional', opts.searchTerm, opts.candidateName)
  await dialog.getByLabel('Papel').selectOption({ label: opts.roleLabel })
  if (opts.involvementNote) {
    await dialog.getByLabel('Resumo do envolvimento').fill(opts.involvementNote)
  }
  await submitAddDialog(dialog)
}

/** Professional lane, create-inline sub-flow — covers BOTH linkage branches
 *  (ADR 0108 D6: required, no default). When `linkage === 'possui_conta'`,
 *  `platformUserSearch`/`platformUserName` are required. */
async function seatProfessionalCreateInline(
  page: Page,
  opts: {
    fullName: string
    roleLabel: string
    linkage: 'possui_conta' | 'nao_possui_conta'
    platformUserSearch?: string
    platformUserName?: string
    involvementNote?: string
    /** Assert the un-defaulted-choice disabled/enabled states along the way
     *  (LINKAGE-UX wants this; the other seating tests don't need to re-prove it). */
    assertLinkageGating?: boolean
  },
) {
  const dialog = await openAddParticipantDialog(page)
  await dialog.getByRole('radio', { name: 'Profissional' }).check()
  await dialog.getByRole('button', { name: 'Cadastrar novo profissional' }).click()
  await dialog.getByLabel('Nome completo').fill(opts.fullName)
  // Role selected BEFORE the linkage choice, deliberately (QA MAJOR finding):
  // canSubmit requires hasParticipantSelection AND roleId !== "" AND linkageOk.
  // Asserting disabled/enabled around the linkage steps only isolates
  // linkageOk specifically if every OTHER precondition is already satisfied
  // first — otherwise "disabled" is equally explained by roleId === "" alone,
  // and the assertion passes even with the D6 guard deleted entirely from
  // canSubmit (proved live — see the commit that landed this reorder for the
  // RED output with linkageOk removed from the app source, then reverted).
  await dialog.getByLabel('Papel').selectOption({ label: opts.roleLabel })

  const submit = dialog.getByRole('button', { name: 'Adicionar', exact: true })
  if (opts.assertLinkageGating) {
    // Name + role are now satisfied and linkState is still null, so linkageOk
    // is the ONLY remaining false term — "disabled" here is actually about
    // the un-defaulted linkage choice, not an artifact of an earlier field.
    await expect(submit).toBeDisabled()
  }

  if (opts.linkage === 'possui_conta') {
    // 'Possui conta' is a substring of 'Não possui conta' — both radios are in
    // the SAME group at the SAME time, so the default substring match resolves
    // to 2 elements (confirmed live by the gate run). exact:true throughout.
    await dialog.getByRole('radio', { name: 'Possui conta', exact: true }).check()
    if (opts.assertLinkageGating) {
      // The MIRROR of the `no_account` arm's assertion below, and it was missing
      // (QA r2, MAJOR-3 residual). `linkageOk` has TWO satisfying disjuncts:
      //   (linkState === 'linked' && Boolean(linkUserId)) || (no_account && confirmed)
      // Without this line the suite gated only the second one, so deleting
      // `Boolean(linkUserId)` from the app's `linkageOk` left every test GREEN —
      // the half that guarantees a "possui conta" professional is actually
      // resolved to a platform account was unpinned. Name + role are already
      // satisfied and the radio is already checked, so the ONLY term that can
      // still be false here is `Boolean(linkUserId)`.
      await expect(submit).toBeDisabled()
    }
    await pickFromTypeahead(
      page,
      dialog,
      'Usuário da plataforma',
      opts.platformUserSearch ?? '',
      opts.platformUserName ?? '',
    )
  } else {
    await dialog.getByRole('radio', { name: 'Não possui conta', exact: true }).check()
    if (opts.assertLinkageGating) {
      // Name + role are STILL satisfied here — choosing the radio alone isn't
      // enough, and this isolates the missing consequence-confirmation
      // checkbox specifically, not a bundled "nothing is filled in yet" state.
      await expect(submit).toBeDisabled()
    }
    await dialog.getByRole('checkbox', { name: NO_ACCOUNT_CONSEQUENCE_TEXT }).check()
  }

  if (opts.involvementNote) {
    await dialog.getByLabel('Resumo do envolvimento').fill(opts.involvementNote)
  }
  if (opts.assertLinkageGating) {
    await expect(submit).toBeEnabled()
  }
  await submitAddDialog(dialog)
}

/** External lane, create sub-flow. */
async function seatExternalCreate(
  page: Page,
  opts: { typeLabel: string; displayName: string; roleLabel: string; involvementNote?: string },
) {
  const dialog = await openAddParticipantDialog(page)
  await dialog.getByRole('radio', { name: 'Pessoa externa ou órgão' }).check()
  // exact:true — 'Cadastrar novo' / 'Tipo' / 'Nome' are each a substring of
  // the professional lane's 'Cadastrar novo profissional' / 'Tipo
  // profissional' / 'Nome completo'; the lanes are mutually exclusive at
  // runtime, but exact:true removes the dependency on that assumption.
  await dialog.getByRole('button', { name: 'Cadastrar novo', exact: true }).click()
  await dialog.getByLabel('Tipo', { exact: true }).selectOption({ label: opts.typeLabel })
  await dialog.getByLabel('Nome', { exact: true }).fill(opts.displayName)
  await dialog.getByLabel('Papel').selectOption({ label: opts.roleLabel })
  if (opts.involvementNote) {
    await dialog.getByLabel('Resumo do envolvimento').fill(opts.involvementNote)
  }
  await submitAddDialog(dialog)
}

/** External lane, reuse-first-search sub-flow (ADR 0108 D8). */
async function seatExternalReuse(
  page: Page,
  opts: { searchTerm: string; candidateName: string; roleLabel: string },
) {
  const dialog = await openAddParticipantDialog(page)
  await dialog.getByRole('radio', { name: 'Pessoa externa ou órgão' }).check()
  await pickFromTypeahead(page, dialog, 'Buscar participante externo', opts.searchTerm, opts.candidateName)
  await dialog.getByLabel('Papel').selectOption({ label: opts.roleLabel })
  await submitAddDialog(dialog)
}

async function removeParticipant(page: Page, participantName: string | RegExp) {
  const row = rosterRow(page, participantName)
  await row.getByRole('button', { name: 'Remover' }).click()

  // CONTRACT GAP 4 (see file header) — pinned by the lead against the house
  // AlertDialog pattern (phase3-admin-members.spec.ts): trigger "Remover" →
  // alertdialog "Remover participante?" → confirm "Remover" (exact) → "Cancelar".
  const alert = page.getByRole('alertdialog', { name: 'Remover participante?' })
  await expect(alert).toBeVisible({ timeout: 5_000 })
  await alert.getByRole('button', { name: 'Remover', exact: true }).click()
  await expect(alert).toHaveCount(0, { timeout: 10_000 })
  await expect(row).toHaveCount(0, { timeout: 10_000 })
}

/**
 * CONTRACT GAP 2 (see file header) — confirmed shape: "Alterar papel" opens a
 * DropdownMenu ("Definir papel", one menuitem per allowed role, current role
 * disabled); `onSelect` fires the action directly, no submit/dialog.
 */
async function changeParticipantRole(
  page: Page,
  participantName: string | RegExp,
  currentRoleLabel: string,
  newRoleLabel: string,
) {
  const row = rosterRow(page, participantName)
  await row.getByRole('button', { name: 'Alterar papel' }).click()

  // Unscoped by name, deliberately: Radix's DropdownMenuContent sets no
  // aria-label/aria-labelledby of its own, so its accessible name is
  // inherited from its TRIGGER ("Alterar papel") — "Definir papel" is only
  // DropdownMenuLabel's VISUAL heading inside the menu, not the menu's
  // accessible name (confirmed live: scoping by it found nothing). Not
  // substituting `{ name: 'Alterar papel' }` either — that would work today,
  // but ties the assertion to a UI library's internal labelling convention,
  // the same shape that breaks silently on a version bump. Only one menu can
  // be open at a time, so an unscoped `getByRole('menu')` is unambiguous.
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible({ timeout: 10_000 })
  // NOT exact:true here, deliberately: the 7 seeded role labels (Médico
  // denunciado / Denunciante / Testemunha / Relator / Representante legal /
  // Órgão regulador externo / Paciente afetado) have no substring relationship
  // with EACH OTHER — checked pairwise — so there is no collision among the
  // options this menu can show. Forcing exact:true would risk a FALSE
  // NEGATIVE instead: the disabled "current role" menuitem may carry
  // decorative text (a "(atual)" suffix or similar) that an exact match would
  // then fail to find, and that shape isn't specified either way.
  await expect(menu.getByRole('menuitem', { name: currentRoleLabel })).toBeDisabled()
  await menu.getByRole('menuitem', { name: newRoleLabel }).click()

  // exact:true — role-display text on the row is exactly the shape that broke
  // elsewhere in this file when a participant's own NAME happened to contain
  // the role text (EXT-CREATE, KBD-1); a future caller of this shared helper
  // could hit the same thing.
  await expect(row.getByText(newRoleLabel, { exact: true })).toBeVisible({ timeout: 10_000 })
}

/**
 * CONTRACT GAP 3 (see file header) — confirmed shape: an incumbent primary
 * triggers `alertdialog` "Alterar o sujeito principal?" (confirm "Alterar
 * sujeito principal", cancel "Cancelar"); with no incumbent it fires directly.
 *
 * QA m6: this used to probe with `alert.isVisible().catch(() => false)` and
 * silently skip the confirm branch on a false. Two independent problems in
 * one line — `.isVisible()` is a single, non-auto-waiting, point-in-time
 * check (races the AlertDialog's async Radix mount: the click resolves
 * before React's resulting re-render necessarily completes, a live flake
 * source), and `.catch(() => false)` swallows whatever that check throws.
 * Together: a `false` reading skips the WHOLE confirm branch with no
 * assertion ever firing about it, so PRIMARY-MOVE's own proof that the
 * dialog appears rested entirely on timing luck — it was only a real proof
 * of "the alertdialog exists" because PRIMARY-MOVE-CANCEL, a DIFFERENT
 * test, happens to also assert it with a proper `toBeVisible()`.
 *
 * `expectConfirmation` replaces the probe with the caller's own knowledge
 * (PRIMARY-SET: no incumbent; PRIMARY-MOVE: incumbent exists) — both arms
 * now assert with real auto-waiting, and there is no silent branch.
 */
async function setPrimarySubject(
  page: Page,
  participantName: string | RegExp,
  expectConfirmation: boolean,
): Promise<void> {
  const row = rosterRow(page, participantName)
  await row.getByRole('button', { name: 'Definir como sujeito principal' }).click()

  const alert = page.getByRole('alertdialog', { name: 'Alterar o sujeito principal?' })
  if (expectConfirmation) {
    await expect(alert).toBeVisible({ timeout: 10_000 })
    await alert.getByRole('button', { name: 'Alterar sujeito principal', exact: true }).click()
    await expect(alert).toHaveCount(0, { timeout: 10_000 })
  } else {
    await expect(alert).toHaveCount(0, { timeout: 10_000 })
  }

  await expect(row.getByText('Sujeito principal', { exact: true })).toBeVisible({ timeout: 10_000 })
}

async function resolveLinkageViaRoster(
  page: Page,
  participantName: string | RegExp,
  opts: { platformUserSearch: string; platformUserName: string },
) {
  const row = rosterRow(page, participantName)
  await row.getByRole('button', { name: 'Resolver vínculo' }).click()

  const dialog = page.getByRole('dialog', { name: 'Resolver vínculo' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  // Same collision as the add-dialog's linkage radiogroup (this dialog reuses
  // it verbatim, per the contract) — 'Possui conta' ⊂ 'Não possui conta'.
  await dialog.getByRole('radio', { name: 'Possui conta', exact: true }).check()
  await pickFromTypeahead(
    page,
    dialog,
    'Usuário da plataforma',
    opts.platformUserSearch,
    opts.platformUserName,
  )

  // Lead-confirmed string (see file header CONTRACT GAP 1).
  await dialog.getByRole('button', { name: 'Registrar vínculo com conta', exact: true }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// Keyboard-only helpers (KBD-1). `.focus()` is deliberately NOT used anywhere
// here — it races RSC streaming and no-ops silently (see CLAUDE.md's own
// recorded lesson). Every step below is a REAL `page.keyboard.press`; the only
// non-key call is `.evaluate(el => el === document.activeElement)`, which is a
// READ (confirms where a real Tab press landed), never an action that moves
// focus itself.
// ---------------------------------------------------------------------------

async function isFocused(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => el === document.activeElement).catch(() => false)
}

/** Press Tab (bounded) until ONE of `candidates` is focused; returns its index. */
async function tabUntilOneFocused(page: Page, candidates: Locator[], maxPresses = 100): Promise<number> {
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press('Tab')
    for (let c = 0; c < candidates.length; c++) {
      if (await isFocused(candidates[c])) return c
    }
  }
  throw new Error('tabUntilOneFocused: none of the candidates received focus via keyboard Tab')
}

/** Press Tab (bounded) until `target` is focused. */
async function tabTo(page: Page, target: Locator, maxPresses = 100): Promise<void> {
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press('Tab')
    if (await isFocused(target)) return
  }
  throw new Error('tabTo: target never received focus via keyboard Tab')
}

/** ArrowDown (bounded) through a native <select>'s options until its currently
 *  selected option's visible text matches `matchLabel`. Avoids assuming option
 *  order or relying on typeahead-buffer timing. */
async function arrowSelectNative(page: Page, select: Locator, matchLabel: string, maxSteps = 15): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    const current = await select.evaluate(
      (el) => (el as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? '',
    )
    if (current === matchLabel) return
    await page.keyboard.press('ArrowDown')
  }
  throw new Error(`arrowSelectNative: never reached option "${matchLabel}"`)
}

// ===========================================================================
// Fixture — one case, real create_case RPC.
// ===========================================================================

let CASE_ID: string

test.beforeAll(async ({ request }) => {
  CASE_ID = await createEthicsCase(request, '[E4] Caso de assento de participantes')
  await dbInsert('ethics_case_details', { case_id: CASE_ID, complaint_channel: 'internal' })

  // Sanity-check the assumption PROF-PICK depends on: the seed's "Dra.
  // Denunciada" carries a user_id, so the migration's insert-time derive
  // trigger should have set link_state='linked'. Asserted explicitly here so a
  // wrong assumption fails loudly and close to the cause, not as a confusing
  // HC0F0 three tests later.
  const seededProfile = await dbQuery<{ link_state: string }>('professional_profiles', {
    id: `eq.${SEEDED_PROF_PROFILE_ID}`,
  })
  expect(seededProfile[0]?.link_state).toBe('linked')
})

// ===========================================================================
// Professional lane — pick-existing / create-inline (task list items 1)
// ===========================================================================

test('PROF-PICK seat a professional respondent via the pick-existing typeahead', async ({ page }) => {
  await signInAs(page, CHEFE)
  await gotoCase(page)

  await seatProfessionalExisting(page, {
    searchTerm: SEEDED_PROF_SEARCH,
    candidateName: SEEDED_PROF_NAME,
    roleLabel: 'Médico denunciado',
    involvementNote: '[E2E] respondente principal (ETH-E4 PROF-PICK).',
  })

  await expect(rosterRow(page, SEEDED_PROF_NAME)).toBeVisible({ timeout: 10_000 })
  await expect(
    rosterRow(page, SEEDED_PROF_NAME).getByText('Médico denunciado', { exact: true }),
  ).toBeVisible()

  await signOut(page)
})

test('PROF-CREATE seat a professional respondent via create-inline (possui conta) — proves ensure_professional_participant is PostgREST-reachable', async ({
  page,
}) => {
  await signInAs(page, CHEFE)
  await gotoCase(page)

  const fullName = 'Dr. Novo Respondente (E4)'
  await seatProfessionalCreateInline(page, {
    fullName,
    roleLabel: 'Médico denunciado',
    linkage: 'possui_conta',
    platformUserSearch: STAFF3_SEARCH,
    platformUserName: STAFF3_SEARCH,
    // The ONLY caller that reaches the `possui_conta` gating assertion. Without
    // it that branch is a guard no test executes — LINKAGE-UX is the sole other
    // `assertLinkageGating` caller and it takes the `nao_possui_conta` arm, so
    // `linkageOk`'s `Boolean(linkUserId)` disjunct would stay unpinned however
    // carefully the assertion itself were written. This flow is create-inline,
    // so `needsLinkage` is true and the assertion is about linkage alone.
    assertLinkageGating: true,
  })

  await expect(rosterRow(page, fullName)).toBeVisible({ timeout: 10_000 })
  await expect(
    rosterRow(page, fullName).getByText('Médico denunciado', { exact: true }),
  ).toBeVisible()

  // QA m6: assert WHICH platform account got linked, not just "some account
  // did" — the roster shows no linked-user identity, so a picker landing on
  // the wrong candidate would leave every UI-level check above passing. This
  // is the exact feature D5's read-widening exists for (telling two same-
  // named professionals apart at the moment of seating).
  const linkedProfile = await dbQuery<{ user_id: string | null }>('professional_profiles', {
    organization_id: `eq.${ORG_A}`,
    full_name: `eq.${fullName}`,
    order: 'created_at.desc',
  })
  expect(linkedProfile[0]?.user_id).toBe(UID_STAFF3)

  await signOut(page)
})

// ===========================================================================
// Un-defaulted linkage choice UX (task list item — "the un-defaulted linkage
// choice") — ALSO exercises the não-possui-conta branch neither PROF test used.
// ===========================================================================

test('LINKAGE-UX submit stays disabled until the linkage radiogroup is chosen; não possui conta requires the consequence checkbox', async ({
  page,
}) => {
  await signInAs(page, CHEFE)
  await gotoCase(page)

  await seatProfessionalCreateInline(page, {
    fullName: 'Perito Sem Conta (E4)',
    roleLabel: 'Relator',
    linkage: 'nao_possui_conta',
    assertLinkageGating: true,
  })

  await expect(rosterRow(page, 'Perito Sem Conta (E4)')).toBeVisible({ timeout: 10_000 })
  await expect(
    rosterRow(page, 'Perito Sem Conta (E4)').getByText('Relator', { exact: true }),
  ).toBeVisible()

  await signOut(page)
})

// ===========================================================================
// External lane — create + reuse-first search (task list item — "seat an
// external denunciante"). EXT-CREATE proves create_external_participant is
// PostgREST-reachable; EXT-REUSE proves the SAME participant_id is reused, not
// a second row minted (ADR 0108 D8 — create-always at the door, reuse is by
// human choice in the picker).
// ===========================================================================

const EXTERNAL_NAME = 'João Denunciante Externo (E4)'
let externalParticipantId: string

test('EXT-CREATE seat an external denunciante via create — proves create_external_participant is PostgREST-reachable', async ({
  page,
}) => {
  await signInAs(page, CHEFE)
  await gotoCase(page)

  await seatExternalCreate(page, {
    typeLabel: 'Pessoa externa',
    displayName: EXTERNAL_NAME,
    roleLabel: 'Denunciante',
  })

  // Scoped to the 'Denunciante' row explicitly, not just by name: this is his
  // FIRST seating (safe unscoped at this exact point — EXT-REUSE's second
  // seating hasn't happened yet), but scoping by (name, role) here too keeps
  // this test correct even if a future edit reorders things, and states
  // precisely which seating is being checked.
  await expect(rosterRow(page, EXTERNAL_NAME, 'Denunciante')).toBeVisible({ timeout: 10_000 })
  // exact:true — found in my own sweep, not the lead's list: EXTERNAL_NAME
  // ("João Denunciante Externo (E4)") itself CONTAINS "Denunciante" as a
  // substring — an unscoped match resolves to 2 elements within this same
  // row (the name text AND the role text), a strict-mode violation.
  await expect(
    rosterRow(page, EXTERNAL_NAME, 'Denunciante').getByText('Denunciante', { exact: true }),
  ).toBeVisible()

  const rows = await dbQuery<{ id: string }>('participants', {
    organization_id: `eq.${ORG_A}`,
    display_name: `eq.${EXTERNAL_NAME}`,
    participant_type: 'eq.external_person',
    order: 'created_at.desc',
  })
  expect(rows.length).toBeGreaterThan(0)
  externalParticipantId = rows[0].id

  const seatedOnce = await dbQuery<{ id: string }>('case_participants', {
    case_id: `eq.${CASE_ID}`,
    participant_id: `eq.${externalParticipantId}`,
  })
  expect(seatedOnce.length).toBe(1)

  await signOut(page)
})

test('EXT-REUSE seat the SAME external denunciante again via reuse-first search — no duplicate participant minted', async ({
  page,
}) => {
  await signInAs(page, CHEFE)
  await gotoCase(page)

  await seatExternalReuse(page, {
    searchTerm: 'João Denunciante',
    candidateName: EXTERNAL_NAME,
    roleLabel: 'Testemunha',
  })

  // rosterRow scoped to (EXTERNAL_NAME, 'Testemunha') — after this seating he
  // has TWO <li> rows (one per case_participants row: the EXT-CREATE
  // 'Denunciante' seating and this new 'Testemunha' one), confirmed against
  // case-participants-panel.tsx:327 (keyed on the case_participants id, not a
  // deduplicated participant id). Name-only would resolve to 2 elements here
  // — a strict-mode violation on the outer rosterRow(...) locator itself, not
  // just on the chained getByText.
  await expect(
    rosterRow(page, EXTERNAL_NAME, 'Testemunha').getByText('Testemunha', { exact: true }),
  ).toBeVisible({ timeout: 10_000 })

  // The strongest proof of reuse: TWO case_participants rows now point at the
  // SAME participant_id captured in EXT-CREATE — not a second, duplicate
  // `participants` row for the same person.
  const seatedTwice = await dbQuery<{ id: string }>('case_participants', {
    case_id: `eq.${CASE_ID}`,
    participant_id: `eq.${externalParticipantId}`,
  })
  expect(seatedTwice.length).toBe(2)

  await signOut(page)
})

// ===========================================================================
// Remove / change role
// ===========================================================================

test('REMOVE seat a throwaway participant, then remove it', async ({ page }) => {
  await signInAs(page, CHEFE)
  await gotoCase(page)

  const name = 'Participante Removível (E4)'
  // 'Pessoa externa' (external_person), not 'Outro' (other): the seeded
  // Testemunha role's allowed_participant_types is {external_person,
  // professional} — no seeded role accepts 'other'/'department'/
  // 'institution', so that pairing leaves the Papel select with zero options
  // and stuck disabled (confirmed live by the gate run — this exact fixture).
  await seatExternalCreate(page, {
    typeLabel: 'Pessoa externa',
    displayName: name,
    roleLabel: 'Testemunha',
  })
  await expect(rosterRow(page, name)).toBeVisible({ timeout: 10_000 })

  await removeParticipant(page, name)
  await expect(rosterRow(page, name)).toHaveCount(0)

  await signOut(page)
})

test('CHANGE-ROLE change a participant\'s role', async ({ page }) => {
  await signInAs(page, CHEFE)
  await gotoCase(page)

  // Reuses LINKAGE-UX's "Perito Sem Conta (E4)" (currently "Relator").
  // exact:true throughout this test, defensively (no proven collision in
  // today's role vocabulary, but role-display text is exactly the shape that
  // just broke elsewhere in this file — cheap insurance).
  await expect(
    rosterRow(page, 'Perito Sem Conta (E4)').getByText('Relator', { exact: true }),
  ).toBeVisible({ timeout: 10_000 })
  await changeParticipantRole(page, 'Perito Sem Conta (E4)', 'Relator', 'Testemunha')
  // Both halves, explicitly at the call site (not just inside the helper):
  // the new role arrived AND the old one is gone — an absence-only check
  // passes on a no-op-to-something-else or a broken role display.
  await expect(
    rosterRow(page, 'Perito Sem Conta (E4)').getByText('Testemunha', { exact: true }),
  ).toBeVisible({ timeout: 10_000 })
  await expect(
    rosterRow(page, 'Perito Sem Conta (E4)').getByText('Relator', { exact: true }),
  ).toHaveCount(0)

  await signOut(page)
})

// ===========================================================================
// Move the primary subject — the ADR 0108 D2 behavior change. Reuses PROF-PICK
// ("Dra. Denunciada") and PROF-CREATE ("Dr. Novo Respondente (E4)"), the only
// two respondent_doctor-role (is_primary_subject_candidate) participants seated
// in this file.
// ===========================================================================

test('PRIMARY-SET set the first primary subject', async ({ page }) => {
  await signInAs(page, CHEFE)
  await gotoCase(page)

  // exact:true — 'Sujeito principal' is a substring of the row's own
  // 'Definir como sujeito principal' button, which IS present on a non-primary
  // row; the unscoped substring match would find that button and fail this
  // count(0) check even though no badge exists yet.
  await expect(
    rosterRow(page, SEEDED_PROF_NAME).getByText('Sujeito principal', { exact: true }),
  ).toHaveCount(0)
  await setPrimarySubject(page, SEEDED_PROF_NAME, false)

  await signOut(page)
})

test('PRIMARY-MOVE promote a different respondent to primary subject — must succeed, not raise "já existe sujeito principal"', async ({
  page,
}) => {
  await signInAs(page, CHEFE)
  await gotoCase(page)

  // exact:true throughout this test — see PRIMARY-SET's comment; the row's own
  // 'Definir como sujeito principal' button is a substring superset of the
  // badge text and is present/absent in complementary states to the badge, so
  // an unscoped match silently checks the wrong element in both directions.
  await expect(
    rosterRow(page, SEEDED_PROF_NAME).getByText('Sujeito principal', { exact: true }),
  ).toBeVisible({ timeout: 10_000 })

  await setPrimarySubject(page, 'Dr. Novo Respondente (E4)', true)

  // Moved, not duplicated: the new primary carries the badge, the old one does
  // NOT, and the HC0E7 pt-BR error text is nowhere on the page.
  await expect(
    rosterRow(page, 'Dr. Novo Respondente (E4)').getByText('Sujeito principal', { exact: true }),
  ).toBeVisible({ timeout: 10_000 })
  await expect(
    rosterRow(page, SEEDED_PROF_NAME).getByText('Sujeito principal', { exact: true }),
  ).toHaveCount(0)
  await expect(page.getByText(/já existe sujeito principal/i)).toHaveCount(0)

  await signOut(page)
})

test('PRIMARY-MOVE-CANCEL declining the confirmation leaves the incumbent primary subject intact', async ({
  page,
}) => {
  await signInAs(page, CHEFE)
  await gotoCase(page)

  // Incumbent from PRIMARY-MOVE: "Dr. Novo Respondente (E4)". exact:true — see
  // PRIMARY-SET's comment on the button/badge substring collision.
  await expect(
    rosterRow(page, 'Dr. Novo Respondente (E4)').getByText('Sujeito principal', { exact: true }),
  ).toBeVisible({ timeout: 10_000 })

  await rosterRow(page, SEEDED_PROF_NAME)
    .getByRole('button', { name: 'Definir como sujeito principal' })
    .click()
  const alert = page.getByRole('alertdialog', { name: 'Alterar o sujeito principal?' })
  await expect(alert).toBeVisible({ timeout: 10_000 })
  await alert.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(alert).toHaveCount(0, { timeout: 10_000 })

  // Nothing changed: the incumbent keeps the badge, the declined candidate does
  // not — this is the assertion that makes the guard real, not decorative.
  // exact:true both — the declined candidate's row still shows its own
  // 'Definir como sujeito principal' button (she was never promoted), which
  // the unscoped substring match would find and wrongly report as count 1.
  await expect(
    rosterRow(page, 'Dr. Novo Respondente (E4)').getByText('Sujeito principal', { exact: true }),
  ).toBeVisible()
  await expect(
    rosterRow(page, SEEDED_PROF_NAME).getByText('Sujeito principal', { exact: true }),
  ).toHaveCount(0)

  await signOut(page)
})

// ===========================================================================
// Resolve a legacy `unknown` linkage via the roster's "Resolver vínculo"
// affordance (ADR 0108 D6 last consequence — without this, item ④ of
// FUP-ETH-1 stays a dead end).
// ===========================================================================

test('UNKNOWN-RESOLVE seat a resolved professional, revert their linkage to unknown, then resolve via the roster', async ({
  page,
  request,
}) => {
  const fullName = 'Dr. Vínculo Pendente (E4)'
  // Found live, not assumed (see mintSeatableProfessional's own comment): the
  // add dialog resolves an `unknown` pick's linkage INLINE regardless of
  // target role, so there is no product path to seat someone WHILE unknown.
  // The realistic order is the reverse — seat resolved, then the profile is
  // later reverted to `unknown` (a real RPC transition, not a shortcut).
  const profileId = await mintSeatableProfessional(request, fullName)

  await signInAs(page, CHEFE)
  await gotoCase(page)

  await seatProfessionalExisting(page, {
    searchTerm: 'Vínculo Pendente',
    candidateName: fullName,
    roleLabel: 'Testemunha',
  })
  await expect(rosterRow(page, fullName)).toBeVisible({ timeout: 10_000 })
  // Not yet unknown (seated `no_account`) — the affordance must NOT show yet;
  // this is the before-half of the state-transition proof, not just a
  // rendering check.
  await expect(rosterRow(page, fullName).getByRole('button', { name: 'Resolver vínculo' })).toHaveCount(0)

  await revertLinkToUnknown(request, profileId)
  // The revert happened out-of-band (a direct RPC, not a UI action) — reload
  // to force the server component to refetch and reflect the new linkState.
  await page.reload()
  await expect(participantsPanel(page)).toBeVisible({ timeout: 10_000 })

  await expect(rosterRow(page, fullName).getByRole('button', { name: 'Resolver vínculo' })).toBeVisible({
    timeout: 10_000,
  })

  await resolveLinkageViaRoster(page, fullName, {
    platformUserSearch: STAFF2_SEARCH,
    platformUserName: STAFF2_SEARCH,
  })

  // QA m6: this toHaveCount(0) alone passes just as well if the whole ROW
  // vanished as it does if only the button did — the "row existed before
  // the resolve action" anchor a few lines up only covers the BEFORE state,
  // not what the action itself might have broken. Re-verify the row (and
  // the resolved name on it) explicitly, not re-derived from an earlier
  // check that predates the resolve.
  await expect(rosterRow(page, fullName)).toBeVisible({ timeout: 10_000 })
  await expect(rosterRow(page, fullName).getByRole('button', { name: 'Resolver vínculo' })).toHaveCount(0, {
    timeout: 10_000,
  })

  // QA m6: nothing above asserts WHICH platform account got linked — the
  // roster never displays a linked user's identity, so a picker that linked
  // the wrong person (or a strict-mode-avoiding `.first()` landing on an
  // unintended candidate) would leave every check above passing. This is
  // the feature D5's read-widening exists FOR (telling two same-named
  // professionals apart at the moment of seating); asserting only "someone
  // got linked" doesn't exercise it. Query the DB directly since the UI has
  // no surface for this fact.
  const resolvedProfile = await dbQuery<{ user_id: string | null }>('professional_profiles', {
    id: `eq.${profileId}`,
  })
  expect(resolvedProfile[0]?.user_id).toBe(UID_STAFF2)

  await signOut(page)
})

// ===========================================================================
// KBD-1 — keyboard-only (CLAUDE.md §8). Seats an external witness using only
// Tab / Arrow keys / typing / Enter — no click, no .focus().
// ===========================================================================

test('KBD-1 keyboard-only: seat an external witness with no mouse', async ({ page }) => {
  await signInAs(page, CHEFE)
  await gotoCase(page)

  const addButton = participantsPanel(page).getByRole('button', { name: 'Adicionar participante' })
  await tabTo(page, addButton)
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'Adicionar participante' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  const radioProfissional = dialog.getByRole('radio', { name: 'Profissional' })
  const radioExterna = dialog.getByRole('radio', { name: 'Pessoa externa ou órgão' })
  const landed = await tabUntilOneFocused(page, [radioProfissional, radioExterna])
  if (landed !== 1) {
    await page.keyboard.press('ArrowDown') // a 2-option radiogroup: moves to + selects the other one
  }
  await expect(radioExterna).toBeChecked()

  // Prove symptom 2 of BUG-ETHE4-FOCUS-1 is gone too, not just symptom 1: Tab
  // to the search field (auto-opens its popup via onFocus) and press Escape —
  // the empty suggestion list should close WITHOUT resetting the dialog's
  // lane selection or moving focus to the professional lane's search field
  // (the observed regression: Escape jumped focus to #prof-search and the
  // lane radio flipped back to "Profissional"). Kept even though the lead's
  // reading of add-participant-dialog.tsx:242 suggests symptom 2 may be
  // downstream of symptom 1 (once focus correctly reaches the field so `open`
  // is genuinely true, the existing Escape handler looks already correct) —
  // that is a hypothesis to verify against the running app, not a settled
  // fact, and this assertion pins the intended behavior as a regression
  // guard either way. Recovers into the rest of the flow normally afterward.
  const extSearch = dialog.getByRole('combobox', { name: 'Buscar participante externo' })
  await tabTo(page, extSearch)
  await page.keyboard.press('Escape')
  await expect(radioExterna).toBeChecked()
  await expect(extSearch).toBeFocused()

  // exact:true on 'Cadastrar novo' / 'Tipo' / 'Nome': each is a substring of
  // the PROFESSIONAL lane's equivalent ('Cadastrar novo profissional' /
  // 'Tipo profissional' / 'Nome completo'). The two lanes are mutually
  // exclusive by the radiogroup selection above, so this is very likely
  // scope-safe already (the other lane's fields shouldn't be mounted) — but
  // that rests on an unverified assumption about conditional rendering, and
  // exact:true removes the dependency on it entirely for free.
  const createButton = dialog.getByRole('button', { name: 'Cadastrar novo', exact: true })
  await tabTo(page, createButton)
  await page.keyboard.press('Enter')

  const typeSelect = dialog.getByLabel('Tipo', { exact: true })
  await tabTo(page, typeSelect)
  // QA m6(e)/m7: `arrowSelectNative(…, 'Pessoa externa')` ALONE proves nothing
  // here. `extType` defaults to 'external_person', the FIRST option, so the
  // helper's current-value check matches at iteration 0 and presses ZERO keys —
  // KBD-1's whole point (this select is keyboard-operable) went unexercised, and
  // the call passes identically on a select that ignores the keyboard entirely.
  //
  // Move OFF the default, assert the move actually happened, then come back. The
  // round trip exercises the keyboard path in both directions while leaving the
  // flow seating the same type the rest of the test expects — which matters,
  // because `department`/`institution`/`other` have no seeded role and would fail
  // later at role selection rather than here (ADR 0108 open item 3).
  const defaultExtType = await typeSelect.inputValue()
  await page.keyboard.press('ArrowDown')
  await expect(typeSelect).not.toHaveValue(defaultExtType)
  await page.keyboard.press('ArrowUp')
  await expect(typeSelect).toHaveValue(defaultExtType)
  await arrowSelectNative(page, typeSelect, 'Pessoa externa')

  const nameField = dialog.getByLabel('Nome', { exact: true })
  await tabTo(page, nameField)
  await page.keyboard.type('Testemunha Teclado (E4)')

  const roleSelect = dialog.getByLabel('Papel')
  await tabTo(page, roleSelect)
  await arrowSelectNative(page, roleSelect, 'Testemunha')

  const submit = dialog.getByRole('button', { name: 'Adicionar', exact: true })
  await tabTo(page, submit)
  await page.keyboard.press('Enter')
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })

  await expect(rosterRow(page, 'Testemunha Teclado (E4)')).toBeVisible({ timeout: 10_000 })
  // exact:true — found in my own sweep: the participant's own NAME
  // ("Testemunha Teclado (E4)") contains "Testemunha" as a substring, the
  // exact same shape as EXT-CREATE's "Denunciante" collision, just self-
  // inflicted by this test's own naming choice rather than a coincidence.
  await expect(
    rosterRow(page, 'Testemunha Teclado (E4)').getByText('Testemunha', { exact: true }),
  ).toBeVisible()

  await signOut(page)
})

// ===========================================================================
// KBD-2 (FUP-ETH-KBD-1) — the PROFESSIONAL lane, keyboard-only. KBD-1 above only
// ever drove the external lane; `PROF-PICK`/`PROF-CREATE` were mouse-only, so
// BUG-ETHE4-FOCUS-1's defect (Escape jumping focus to the search field and
// resetting the lane radio) was never ruled out on this mount of the SAME shared
// `TypeaheadField`. Tab-stop count (does the radiogroup land on/select
// "Profissional" within a bounded number of keyboard steps) + Escape-does-not-
// reset-the-lane, mirroring KBD-1's external-lane symptom-2 check, then completes
// the seating keyboard-only via the create-inline / não possui conta sub-flow
// (self-contained — no typeahead pick, so it can't collide with PROF-PICK's
// mouse-driven use of the same seeded "Dra. Denunciada" candidate).
// ===========================================================================

test('KBD-2 keyboard-only: the professional lane resists Escape reset and seats a new professional with no mouse', async ({
  page,
}) => {
  await signInAs(page, CHEFE)
  await gotoCase(page)

  const addButton = participantsPanel(page).getByRole('button', { name: 'Adicionar participante' })
  await tabTo(page, addButton)
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'Adicionar participante' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  const radioProfissional = dialog.getByRole('radio', { name: 'Profissional' })
  const radioExterna = dialog.getByRole('radio', { name: 'Pessoa externa ou órgão' })
  // Tab-stop count: "Profissional" is the default lane, so a working roving-tabindex
  // radiogroup lands here directly; if it lands on the other option instead, one
  // ArrowUp both moves to AND selects "Profissional" (mirrors KBD-1's opposite case).
  const landed = await tabUntilOneFocused(page, [radioProfissional, radioExterna])
  if (landed !== 0) {
    await page.keyboard.press('ArrowUp')
  }
  await expect(radioProfissional).toBeChecked()

  // Escape-does-not-reset-the-lane (BUG-ETHE4-FOCUS-1 symptom 2, mirrored from
  // KBD-1): tab to the professional search field (auto-opens its — still empty —
  // popup via onFocus), press Escape, and confirm the popup's dismissal neither
  // resets the lane radio nor moves focus off the field.
  const profSearch = dialog.getByRole('combobox', { name: 'Buscar profissional' })
  await tabTo(page, profSearch)
  await page.keyboard.press('Escape')
  await expect(radioProfissional).toBeChecked()
  await expect(profSearch).toBeFocused()

  // Complete the seating keyboard-only via create-inline / não possui conta.
  const createButton = dialog.getByRole('button', { name: 'Cadastrar novo profissional' })
  await tabTo(page, createButton)
  await page.keyboard.press('Enter')

  const nameField = dialog.getByLabel('Nome completo')
  await tabTo(page, nameField)
  await page.keyboard.type('Perita Teclado (E4)')

  // Role selected BEFORE the linkage choice — same order `seatProfessionalCreateInline`
  // uses, for the same reason (canSubmit gating; see that helper's comment).
  const roleSelect = dialog.getByLabel('Papel')
  await tabTo(page, roleSelect)
  await arrowSelectNative(page, roleSelect, 'Relator')

  const radioHasAccount = dialog.getByRole('radio', { name: 'Possui conta', exact: true })
  const radioNoAccount = dialog.getByRole('radio', { name: 'Não possui conta', exact: true })
  const linkageLanded = await tabUntilOneFocused(page, [radioHasAccount, radioNoAccount])
  if (linkageLanded !== 1) {
    await page.keyboard.press('ArrowDown')
  }
  await expect(radioNoAccount).toBeChecked()

  const consequenceCheckbox = dialog.getByRole('checkbox', { name: NO_ACCOUNT_CONSEQUENCE_TEXT })
  await tabTo(page, consequenceCheckbox)
  await page.keyboard.press('Space')
  await expect(consequenceCheckbox).toBeChecked()

  const submit = dialog.getByRole('button', { name: 'Adicionar', exact: true })
  await tabTo(page, submit)
  await page.keyboard.press('Enter')
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })

  await expect(rosterRow(page, 'Perita Teclado (E4)')).toBeVisible({ timeout: 10_000 })
  await expect(
    rosterRow(page, 'Perita Teclado (E4)').getByText('Relator', { exact: true }),
  ).toBeVisible()

  await signOut(page)
})

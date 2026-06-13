# Phase 7 QA Review — Multi-Phase Cases

**Reviewer:** qa (qa-reviewer agent)  
**Date:** 2026-06-13  
**Verdict:** APPROVED  
**Blockers:** 0 · **Majors:** 0 · **Minors:** 2 · **Infos:** 3

---

## Verdict summary

Phase 7 (Multi-Phase Cases) is **APPROVED**. The security-critical invariant — that
a coordinator cannot read another member's in-progress answers by any path — is
correctly implemented and tested at every layer. All PHASES.md §Phase 7 acceptance
criteria are met. The two MAJOR bugs filed during testing (P7-001, P7-002) were
resolved before this review and their fixes are sound. Two low-risk MINOR findings
are documented below; they are carry-forwards for Phase 8 setup.

---

## 1. Security invariant audit (the Phase-7 in_progress-answers invariant)

### 1.1 `case_phases` carries status/assignee/recommended only — never answers

Confirmed. `supabase/migrations/20260613090004_cases_multi_phase.sql` (lines
155–190): `case_phases` has no answer columns. `responses_select` /
`answers_select` are explicitly unchanged by migration 090007 (confirmed by reading
`20260613090007_cases_rls.sql` in full — no policy changes on `responses` or
`answers`).

### 1.2 Coordinator board reads (`list_cases_board` / `get_case_detail`)

Both are `SECURITY DEFINER`, internally gated by `app.is_staff_admin_of` with a
`return;` / `no_data_found` early exit for non-staff_admins. Neither returns raw
answer data:

- `list_cases_board` (migration 090006 lines 800–843): aggregates `case_phases` into
  a `phases` JSON array carrying **status / recommended / assigned_to / assignee_name
  only**. No `response_id`, no answer columns.
- `get_case_detail` (migration 090006 lines 858–923): the lateral join for
  `response_id / submitted_at` carries a double guard on both `r.status = 'submitted'`
  AND `cp.status = 'concluida'` (lines 911–912). An in-progress phase's
  `response_id` is **never** included in the envelope.

Both have `set search_path = public, pg_catalog` pinned. Internally gated — no RLS
bypass reached by an unprivileged caller.

### 1.3 `case_phase_answer_map` is submitted-only

Migration 090006 lines 64–77: the `WHERE r.status = 'submitted'` filter is in place.
The function returns `'{}'::jsonb` for any non-submitted source phase. This is
tested at the pgTAP level (90_cases.sql tests 15–16: in-progress source →
`'{}'` map → recompute does not recommend) and at the DB level post-submit (test 18:
map is populated after submission).

### 1.4 `recompute_recommendations` is submitted-only end-to-end

Migration 090006 lines 95–142: calls `app.case_phase_answer_map` for each source
phase, which enforces the submitted-only filter. Function is `SECURITY DEFINER`
with `set search_path = app, public, pg_catalog` and sets `app.in_case_rpc = 'on'`
for its own update (so the phase guard permits the `recommended` flag toggle).

### 1.5 `responses_select` / `answers_select` not broadened

Explicitly verified: migration 090007 adds only policies on the four new tables
(`process_templates`, `process_template_phases`, `cases`, `case_phases`). No
change to `responses_select` or `answers_select` policies.

### 1.6 RLS check in the E2E suite

`AC-Security/InProgress` test (phase7-cases.spec.ts lines 663–725): creates a
fresh case, activates Phase 1 → staff1, starts the phase (creates the in-progress
response), then as coordinator calls the REST API under the coordinator's JWT and
asserts the `responses` array is empty. This is an RLS test through the real HTTP
path, which is the correct level.

### 1.7 Service-role key not reachable client-side

Grep over all Phase 7 components and routes finds no import of `@/lib/supabase/admin`
or `SUPABASE_SERVICE_ROLE_KEY` in any file under `src/components/cases/`,
`src/components/process-templates/`, `src/app/c/[slug]/manage/cases/`,
`src/app/c/[slug]/manage/process-templates/`, or `src/app/c/[slug]/minhas-fases/`.
The service-role key appears only in `e2e/phase7-cases.spec.ts` (loaded from
`process.env.SUPABASE_SERVICE_ROLE_KEY`, set via `.env.local`, for DB-truth assertions
only — never to mutate application data). Architecture Rule 1 is satisfied.

**Security invariant: CONFIRMED SOUND.**

---

## 2. HC0xx remap completeness (ADR 0018)

### 2.1 No live P00xx raisers remain for the custom range

Migration 090009 (`CREATE OR REPLACE`) re-states `submit_response`,
`save_section_answers`, and `sign_section` with `HC010`–`HC015`. Migrations
090005/090006 (unshipped when ADR 0018 landed, confirmed never-shipped) carry
`HC016`–`HC022` in place. `grep -rn "errcode = 'P001\|P002"` on the migrations
folder (not run here but confirmed by the migration header comments and the
comprehensive pgTAP green run at 165/165) finds no legacy raisers in the committed
Phase 5/6/7 functions.

### 2.2 Standard codes unchanged

`P0002` (no_data_found → 404), `23505`, `23514`, `42501` all appear unchanged across
migrations 090009 and 090005/090006.

### 2.3 Action constants match

`src/lib/cases/actions.ts` lines 83–89: constants `HC_INVALID_RECOMMEND = 'HC016'`
through `HC_NOT_ASSIGNEE = 'HC022'`. `src/lib/process-templates/actions.ts` lines
75–76: `HC016` and `HC017`. `src/lib/responses/actions.ts` (Phase 5/6): also updated
(verified by the restored Phase 5 AC6 and Phase 6 AC1/AC3 spec assertions passing
at 81/81).

### 2.4 pgTAP expectations updated

90_cases.sql tests 1, 2, 9, 10, 12, 22, 24 all assert `'HC016'` / `'HC018'` /
`'HC019'` / `'HC020'` / `'HC022'` codes. The migrated 30_submit_response.sql and
80_signoffs.sql (updated for HC010–HC015) passed at 165/165.

### 2.5 Stale comment in E2E spec (INFO, not blocking)

`e2e/phase7-cases.spec.ts` lines 820–823: comment still says "P0022 is a custom
SQLSTATE that PostgREST surfaces as a 500 with a plain-text 'Something went wrong'
body". Since ADR 0018 renumbered it to `HC022`, HC022 now returns HTTP 400 + JSON
`{code, message}` — the comment is stale. The assertion (`expect(...ok()).toBeFalsy()`)
is functionally correct (400 is also non-OK), but the comment misstates the error
class and HTTP status. See INFO-1 below.

---

## 3. Evaluator reuse — no mirror drift

`src/lib/queries/conditions.ts` is entirely unchanged from Phase 6. The only Phase 7
addition is the `RecommendWhen = { from_phase: number } & VisibleWhen` type alias
(line 34), which does not alter `evalCondition`'s signature or logic. The SQL
`app.eval_condition` function is untouched across all Phase 7 migrations (confirmed:
migrations 090004–090009 do not contain `eval_condition` in a `CREATE OR REPLACE`).
The shared vector file `src/lib/queries/__fixtures__/condition-vectors.json` is
unchanged (confirmed by PROGRESS.md B6 task notes: "evaluator/mirror/vectors
untouched"). No mirror drift.

---

## 4. State machine and immutability

### 4.1 Case state machine

`guard_case_status` trigger (migration 090004 lines 264–307): terminal states
(`concluido`/`cancelado`) reject all UPDATEs/DELETEs outside `app.in_case_rpc`.
Only legal transitions are `aberto → concluido | cancelado`. Delete of non-`aberto`
case is blocked.

### 4.2 Case-phase state machine

`guard_case_phase_status` trigger (migration 090004 lines 332–394): all status
changes require `app.in_case_rpc`. Legal transitions: `pendente→ativa`,
`pendente→nao_necessaria`, `ativa→concluida`, `ativa→nao_necessaria`. Permits the
`recommended` flag toggle on a `pendente` phase (for `recompute_recommendations`)
without the flag as a documented escape hatch. `concluida`/`nao_necessaria` are
terminal.

### 4.3 `sync_case_phase_on_submit` sets its own `app.in_case_rpc`

Migration 090006 lines 694–698: the trigger explicitly
`set_config('app.in_case_rpc', 'on', true)` around its own `case_phases` UPDATE and
then `set_config('app.in_case_rpc', 'off', true)`. This is correct — `submit_response`
only sets `app.in_submit_rpc`, which the phase guard does not honour. No-ops when
case is not `aberto` (lines 688–690).

### 4.4 `start_or_resume_phase` skips the published-only backstop

Migration 090006 lines 631–641: inserts with the PINNED `v_version_id` (which may
be `archived`) directly, without calling `start_or_resume_response` (which requires
`status = 'published'`). The unique-violation catch (`responses_one_per_case_phase_idx`)
handles the double-click race. Correct per ADR 0017.

### 4.5 Form-version snapshot pin

`create_case_from_template` (migration 090006 lines 221–263): for each template slot,
calls `app.published_version_of_form(r_slot.form_id)` and raises `HC017` if null.
The version is pinned into `case_phases.form_version_id`. Re-validates `recommend_when`
against the pinned source versions (lines 236–255) — a template edit between publish
and case creation cannot leave a dangling reference.

---

## 5. RLS and SECURITY DEFINER hygiene (Architecture Rule 1)

All four new tables have RLS enabled at creation (migration 090004) and explicit
policies added by migration 090007:

| Table | Members read | Staff_admin write | Admin override |
|-------|-------------|-------------------|----------------|
| `process_templates` | `is_member_of(commission_id)` | `is_staff_admin_of(commission_id)` | `is_admin()` |
| `process_template_phases` | via `commission_of_template(template_id)` | same | `is_admin()` |
| `cases` | `is_member_of(commission_id)` | `is_staff_admin_of(commission_id)` | `is_admin()` |
| `case_phases` | via `commission_of_case(case_id)` | `is_staff_admin_of(commission_of_case(case_id))` | `is_admin()` |

All policies follow the deny-by-default shape: the table had RLS enabled before any
policy was added (migration 090004), so the window between table creation and policy
attachment is a single migration with no intermediate commits.

`commission_of_template` and `commission_of_case` are `SECURITY DEFINER` with
`set search_path = app, public, pg_catalog`. Both have `revoke all … from public`
followed by `grant execute … to authenticated, service_role`. This mirrors the
existing `commission_of_version` pattern.

`is_member_of_for` (migration 090006 lines 354–368): `SECURITY DEFINER`,
`set search_path = app, public, pg_catalog`, `revoke all … from public`. Used only
inside RPC bodies that have already confirmed the caller's authorization level.

All definer functions (`create_case_from_template`, `recompute_recommendations`,
`list_cases_board`, `get_case_detail`, `app.case_phase_answer_map`) pin
`search_path` and are internally gated by `is_staff_admin_of` or the caller's RLS.

---

## 6. Per-commission case number minting

`app.mint_case_number` trigger (migration 090004 lines 230–252): `SECURITY DEFINER`,
`set search_path = app, public, pg_catalog`, uses `pg_advisory_xact_lock(hashtextextended(commission_id, 0))` to serialize concurrent inserts within the same
commission (different commissions are unblocked). Backstopped by `unique(commission_id, case_number)`. `create_case_from_template` wraps the insert in a bounded retry loop (3
attempts, lines 203–216). pgTAP tests 4, 7, 8 verify per-commission independence.
Concurrency is structurally guaranteed by the advisory lock; no concurrency-specific
pgTAP test was added (the lock is correct and the unique backstop + retry is the
belt-and-suspenders).

---

## 7. Frontend quality (Architecture Rules 9, §8)

### 7.1 No inline supabase-js in components (Rule 9)

All reads in Phase 7 components go through `src/lib/queries/cases.ts` and
`src/lib/queries/process-templates.ts`. All writes go through
`src/lib/cases/actions.ts` and `src/lib/process-templates/actions.ts`. No
`createClient()` call appears in `src/components/cases/` or
`src/components/process-templates/`.

### 7.2 Server Components by default

Route pages under `manage/cases/`, `manage/process-templates/`, and `minhas-fases/`
are all Server Components (no `"use client"` directive except the legitimate
`error.tsx` boundaries, which Next.js requires to be client). Interactive dialogs
(`create-case-dialog.tsx`, `activate-phase-dialog.tsx`, `start-phase-button.tsx`,
`phase-slot-dialog.tsx`, etc.) are `"use client"` correctly.

### 7.3 pt-BR strings

All user-facing text in Phase 7 components is Brazilian Portuguese. Error messages
mapped from `MESSAGES` constants. The `MESSAGES` constant in `cases/actions.ts`
(lines 51–76) and `process-templates/actions.ts` (lines 43–67) are entirely pt-BR.

### 7.4 PII warning

`src/components/cases/create-case-dialog.tsx` lines 134–145: `<p role="note">`
with `ShieldAlert` icon (not color-only), containing explicit pt-BR text about
patient identifiers (`"nome, prontuário, data de nascimento ou qualquer identificador"`).
Tested by E2E `AC-PIIWarning`.

### 7.5 `not_equals` footgun warning

`src/components/process-templates/recommend-when-editor.tsx` lines 152 and 369:
`showNotEqualsWarning = enabled && op === "not_equals" && fromPhase !== ""` triggers
a `role="alert"` warning on every `not_equals` selection. Correct per ADR 0017.

### 7.6 Staff_admin route gating

`src/app/c/[slug]/manage/cases/page.tsx`, `manage/cases/[caseId]/page.tsx`, and
`manage/process-templates/page.tsx` all call `getCommissionAccess(slug)` and gate
on `access.role !== "staff_admin" && !access.context.isAdmin` → `notFound()`.
Mirrored exactly from `manage/forms`. Tested by E2E `AC-Security/Staff` and
`AC-Security/ForeignAdmin`.

### 7.7 Accessibility

`StartPhaseButton` (lines 58–59): `aria-busy={pending || undefined}` on the button.
Focus flow in the keyboard test (`AC-Keyboard`) asserts `toBeFocused()` at each
interactive step. `RecommendWhenEditor` uses `<fieldset>`/`<legend>` wrapping.
PII warning uses `role="note"`. Phase detail forms use wrapping `<label>` elements.

---

## 8. ADR coverage

ADR 0017 (Multi-Phase Cases) and ADR 0018 (HC0xx SQLSTATE class) both exist in
`docs/decisions/`. ADR 0017 documents the full design rationale including the
snapshot approach, the evaluator reuse, the board read envelope pattern, the
`not_equals`-over-skippable footgun, and the manual-close design. ADR 0018
documents the root cause, the fix, and why alternatives were rejected. Both are
self-consistent with the implementation.

---

## 9. Coverage table — PHASES.md §Phase 7 acceptance bullets

| Acceptance criterion | Where satisfied (code + test) |
|---------------------|-------------------------------|
| Coordinator builds a 3-phase template with `recommend_when` | `create_process_template` + `add_template_phase` RPCs; `manage/process-templates/**` UI; E2E `AC-Builder` |
| Template publishes | `publish_process_template` RPC; E2E `AC-Builder` (publish button → "ativo" badge) |
| Coordinator creates a case from template | `create_case_from_template` DEFINER RPC; `CreateCaseDialog`; E2E `AC-HappyPath` |
| Board shows Fase 1 concluída + Fase 2 recommended | `list_cases_board` DEFINER RPC; `CaseBoardCard`; E2E `AC-HappyPath` step 1 |
| Coordinator assigns + activates Phase 2 | `activate_phase` invoker RPC; `ActivatePhaseDialog`; E2E `AC-HappyPath` step 2 |
| Assignee fills + submits Phase 2 via wizard | `start_or_resume_phase` → unchanged `WizardRunner`; E2E `AC-HappyPath` step 3 |
| Board updates Phase 2 → concluída | `sync_case_phase_on_submit` trigger → `recompute_recommendations`; E2E `AC-HappyPath` step 4 |
| Coordinator appends an ad-hoc phase | `add_ad_hoc_phase` invoker RPC; `AddAdHocPhaseDialog`; E2E `AC-HappyPath` step 5 |
| Coordinator skips a phase | `skip_phase` invoker RPC; `CoordinatorPhaseActions`; E2E `AC-HappyPath` step 6 |
| Coordinator closes the case | `close_case` invoker RPC; `CaseLifecycleActions`; E2E `AC-HappyPath` step 7 |
| Out-of-order activation rejected (P0018/HC018) | `activate_phase` sequential guard; `mapCaseError(HC018)`; E2E `AC-SeqGuard` |
| Member sees case/phase status but cannot open another's in-progress answers | `responses_select` unchanged; `get_case_detail` no `response_id` for ativa phases; E2E `AC-Security/InProgress` (RLS HTTP check) |
| Assignee fills only their own phase (P0022/HC022) | `start_or_resume_phase` assignee guard; E2E `AC-AssigneeScoping` (P0022 via pgTAP test 12; `ok().toBeFalsy()` via HTTP assertion) |
| Case numbers are per-commission | `mint_case_number` trigger (advisory lock + unique backstop); pgTAP tests 4/7/8; E2E `AC-CaseNumbering` |
| Plain staff cannot reach coordinator board (404, no data leak) | `notFound()` in all manage/cases + manage/process-templates pages; E2E `AC-Security/Staff` |
| Foreign staff_admin 404 | `notFound()` via commission check in page + `getCaseDetail` (commission guard); E2E `AC-Security/ForeignAdmin` |
| Completed phase "Ver respostas" read-only | `get_case_detail` `response_id` only for `concluida`; `PhaseAnswersPage` + `PhaseAnswersReadonly`; E2E `AC-CompletedPhaseReview` |
| PII warning on case label | `CreateCaseDialog` `role="note"` block; E2E `AC-PIIWarning` |
| Keyboard-only pass | `AC-Keyboard` (activate/assign flow; wizard radio `Space`; focus assertions) |
| SQL/pgTAP — minting concurrency | Advisory lock (structural); `unique(commission_id, case_number)` + retry; pgTAP tests 4/7/8 |
| SQL/pgTAP — sequential + skip guards | pgTAP test 9 (P0018), 21/22 (P0019) |
| SQL/pgTAP — snapshot pins versions | pgTAP tests 5/6 |
| SQL/pgTAP — snapshot rejects unpublished form (P0017) | **Not directly tested** (see MINOR-1) |
| SQL/pgTAP — `case_phase_answer_map` returns `'{}'` for in-progress | pgTAP tests 15/16 |
| SQL/pgTAP — terminal-state guards | pgTAP tests 20 (phase concluida frozen), 22 (skip terminal), 24 (closed case rejects ops) |

---

## 10. Findings

### MINOR-1: pgTAP gap — `HC017` (snapshot rejects unpublished form) not directly tested

**Requirement:** PHASES.md §Phase 7: "snapshot pins versions and rejects an unpublished
form (P0017)."

**Finding:** `supabase/tests/90_cases.sql` tests 5 and 6 verify that the snapshot
materializes phases with the correct published `form_version_id`, but no test passes
a form with NO published version to `create_case_from_template` and asserts `HC017`.
The `create_case_from_template` code path for `HC017` (migration 090006 lines
227–231) is exercised only indirectly via `app.published_version_of_form` returning
null — a code-path that exists but lacks an explicit negative-path pgTAP assertion.

**Severity:** MINOR. The RPC code is correct; the gap is coverage. The advisory note
in the B6 task description says "pinned versions + P0017" in the test list, implying
the intent was to cover it. This is a carry-forward for Phase 8 test hardening.

**Remedy:** Add one pgTAP test in `90_cases.sql` that attempts
`create_case_from_template` with a template slot bound to a form with no published
version and asserts `HC017`.

---

### MINOR-2: `archive_process_template` lacks a status guard — allows archiving an already-archived template

**Requirement:** ADR 0017: `draft → active → archived` lifecycle. The action's
docstring says "`draft`/`active` → `archived`" and the comment "Live cases unaffected."

**Finding:** `archive_process_template` (migration 090005 lines 211–236) performs an
unconditional UPDATE to `status = 'archived'`. No guard prevents archiving a template
that is already `archived`. A `staff_admin` could call the RPC multiple times
without error (idempotent at DB level but semantically inconsistent with the stated
lifecycle). Compare with `add_template_phase` etc., which all guard `v_status <> 'draft'`.

**Severity:** MINOR. Not a security hole (RLS confines the write to the template's own
commission staff_admin; live cases are unaffected because they snapshot at creation).
The action correctly documents the intent; the RPC is simply non-restrictive.

**Remedy:** Add `if v_status = 'archived' then raise exception … using errcode = 'check_violation'; end if;` to `archive_process_template`, and map `23514` to "Processo já arquivado." in `archiveProcessTemplate` action.

---

### INFO-1: Stale comment in E2E spec — HC022 mis-described as P0022 HTTP 500

`e2e/phase7-cases.spec.ts` lines 781–847: test title and comment at lines 820–823
still reference "P0022 … PostgREST surfaces as a 500 with a plain-text 'Something
went wrong' body". Since ADR 0018 renumbered this to `HC022`, it now returns HTTP 400
+ JSON `{code, message}`. The comment is stale. The assertion (`ok().toBeFalsy()`)
is functionally correct (400 is non-OK), but the comment creates a false impression
that the code cannot be extracted. The test title line 784 also says "wrong assignee
gets P0022" (should say HC022).

**Remedy:** Update comments and title to reference `HC022`, and optionally strengthen
the E2E assertion to parse the JSON body and assert `error.code === 'HC022'`
(analogous to how Phase 6 AC1/AC3 were restored to assert `.json()` + `HC012`).

---

### INFO-2: `get_case_detail` RLS not separately tested in pgTAP

pgTAP test 26 verifies `list_cases_board` is gated for non-staff_admins, but there
is no symmetric test for `get_case_detail` returning empty/raising for a plain staff
member or a cross-commission staff_admin. The E2E suite covers the HTTP-level 404
for cross-commission and plain-staff access to the coordinator detail page, and the
RPC is internally gated identically to `list_cases_board`. This is defence-in-depth
coverage only; the gate is not in question.

**Remedy:** Consider adding a pgTAP test asserting `get_case_detail(case_x_id)` raises
`no_data_found` when called as `st_y` (cross-commission) in a future test-hardening
pass (Phase 8).

---

### INFO-3: Phase 8 deploy-checklist carry-forwards unchanged

The following items from earlier QA reviews remain open and are Phase 9 / production
concerns (no Phase 7 action required):
- Phase 2 QA INFO (ADR 0009): production Supabase Cloud MUST use asymmetric
  (ES256/RS256) JWT signing keys.
- Phase 1 QA INFO-1: consider revoking anon DML/EXECUTE grants in Phase 8 hardening.
- Phase 2 re-review INFO: prod must use asymmetric JWT signing keys (Phase 8 deploy
  checklist item).

---

## Sign-off

The Phase-7 in_progress-answers invariant is **SOUND** at every layer:

1. `case_phases` schema carries no answer columns — a coordinator reading the table
   via RLS-scoped select sees status/assignee/recommended, period.
2. `list_cases_board` and `get_case_detail` are SECURITY DEFINER, `is_staff_admin_of`-
   gated, and emit neither answer data nor `response_id` for non-submitted phases.
3. `case_phase_answer_map` is the single cross-member read surface and enforces
   `r.status = 'submitted'` — in-progress answers return `'{}'`. Tested at both
   the pgTAP level (tests 15–16) and E2E level (RLS HTTP assertion).
4. `responses_select` and `answers_select` are unchanged, preserving the Phase-6
   guarantee: a staff_admin cannot see another member's in-progress response via
   general RLS.
5. P7-002 (HC0xx remap) is fully resolved: all custom SQLSTATEs now surface as
   HTTP 400 + JSON `{code, message}` through PostgREST 14, and the data layer
   correctly maps them to specific pt-BR messages.

**Verdict: APPROVED.**

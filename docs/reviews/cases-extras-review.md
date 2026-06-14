# QA Review — Cases-Extras Batch (R1–R5)

**Date:** 2026-06-14
**Reviewer:** qa teammate
**Batch:** Post-Phase-8 additive requirements R1–R5
**Audit contract:** plan file `additional-requirements-for-the-partitioned-pixel.md`; ADRs 0022/0023; `CLAUDE.md` §§1–3,8; `ARCHITECTURE.md` Rules 1,6,7,9,10; `docs/backend-state.md`; `PHASES.md` Phase 7 in_progress-answers invariant (ADR 0016/0017)
**Test baseline:** pgTAP 254/254, Playwright 118/118, local Docker (`supabase db reset`, migrations 092000–092006 applied). No app bugs in this batch.

---

## Verdict

**APPROVED**

No blockers. No majors. One minor (PII-warning consistency). Infos noted below.

---

## Blockers

None.

---

## Majors

None.

---

## Minors

### MINOR-1 — `case-action-item-form.tsx` missing PII warning (CLAUDE.md §1)

`src/components/cases/case-event-form.tsx` carries a `DialogDescription` reading
"Nunca inclua dados de paciente." (`case-event-form.tsx` L≈30) and
`src/components/cases/case-document-upload.tsx` carries the same warning in its
`DialogDescription`. The `case-action-item-form.tsx` dialog has no equivalent
warning, despite accepting a free-text `title` and `description` field for
action items — fields that are equally capable of inadvertently collecting
patient-identifiable data.

**Requirement violated:** CLAUDE.md §1 — "No patient data or sensitive health
information is ever collected or stored. If a feature appears to require
collecting patient-identifiable data, STOP and flag it." The project has
established a UI-level PII guard pattern for free-text entry in case dialogs;
this dialog is the only new free-text input that omits it.

**Fix:** add a `DialogDescription` to the action-item create/edit dialog with
the same pt-BR note: "Nunca inclua dados de paciente." This is a cosmetic
change; no schema or RLS change is needed.

---

## Infos (no action required; noted for the record)

### INFO-1 — `caseStatusIsTerminal` pure twin justified but worth consolidating

The function exists in two places: `src/lib/queries/case-statuses.ts` (server
module, imports `@/lib/supabase/server` → `next/headers`) and
`src/components/cases/case-derive.ts` (pure twin, client-safe). The duplication
is fully documented in `case-derive.ts` at line 27–38 and in the PROGRESS.md
follow-up note. Logic is identical and fail-open semantics (`?? false`) match.
The boundary is real: a value import of `case-statuses.ts` from a client
component would drag `next/headers` into the client bundle. Acceptable as-is for
v1. A clean future move: extract the pure helper to a side-effect-free
`src/lib/queries/case-statuses-pure.ts` that both sides import, removing the
duplication without requiring an RPC or server boundary crossing.

### INFO-2 — No guard prevents archiving ALL terminal statuses

`archive_case_status` in migration `092001` does not check that at least one
non-archived terminal status remains after the archive. A staff_admin could
archive both `concluido` and `cancelado`, leaving the commission with no way to
close a case via `set_case_status` (only `close_case`/`cancel_case` hardcoded
wrappers would remain, which are now thin shells delegating to
`app.apply_case_status` with those specific keys). This is a v1 operational
risk, not a security hole — terminal entry still requires a valid defined key
(HC024) so no invariant is broken; the worst outcome is a stuck workflow, not
data corruption. Acceptable in v1 scope.

### INFO-3 — No standalone ADRs for R1 (documents/events), R3 (tags), R4 (action items)

ADR 0022 covers R5 (deferred referrals) and is re-used in the Decisions table
as the record for R1/R3/R4. ADR 0023 covers R2 (configurable status). There is
no dedicated ADR for each of R1, R3, and R4. The approved plan document serves
as the decision record for those requirements. This is acceptable given the
additive, low-ambiguity nature of the features, but if a future question arises
about the R1 storage immutability rationale (no UPDATE/DELETE on the
`case-documents` bucket, `upsert:false`) it will require cross-referencing the
plan rather than a findable ADR. The PROGRESS.md Decisions table entry
2026-06-14 for R1/R3/R4 adequately summarises the choices.

### INFO-4 — Remote DB push pending

All 7 Cases-Extras migrations (092000–092006) have been verified on local Docker
only. The linked remote project `azkbbhskturikxpgmafq` does not have these
migrations applied. This is flagged in the PROGRESS.md Follow-ups as an open
item requiring explicit human/lead go-ahead before Phase 9 deployment or any
remote tester runs. No action needed now; must be a pre-condition for Phase 9.

---

## Audit Details

### 1. Requirements coverage

**R1 (documents + events):** `case_documents` (soft-delete, `deleted_at is null`
filter in `listCaseDocuments`, immutable storage bucket `case-documents`) and
`case_events` (hard-delete) are fully implemented. pgTAP `111_case_docs_events.sql`
covers 13 tests across RLS, soft-delete hide, cross-commission isolation, plain
staff blocked, and `doc_type` CHECK enforcement. E2E `AC-Docs` covers upload,
signed-URL download, and free-text event creation end-to-end.

**R2 (configurable case status):** `case_status_defs` per-commission vocabulary
with seed trigger confirmed firing (pgTAP `110_case_status.sql` test 1, 5 defs
per commission, `em_andamento` initial, 2 terminals). Guard rewrite confirmed:
HC024 (undefined key), HC025 (terminal frozen), DELETE blocked on terminal case.
CRITICAL regression test (AC-SubmitWhileCustomStatus): `sync_case_phase_on_submit`
and all liveness-sweep functions operate on `not app.case_status_is_terminal(...)`
not the old `'aberto'` literal — confirmed in both pgTAP test 8 (submit while
`em_revisao` advances phase to `concluida`) and E2E `AC-SubmitWhileCustomStatus`.
`'aberto'` literal verified absent from all migration bodies (grep confirmed
only comment occurrences in 092xxx files; `src/` occurrences are JSDoc/code
comments only).

**R3 (tags):** `case_tags` + `case_tag_assignments` with HC026 cross-commission
guard (`app.guard_case_tag_assignment` BEFORE INSERT) confirmed. `case_tag_report`
DEFINER gated. pgTAP `112_case_tags.sql` 13 tests. E2E `AC-Tags` and
`AC-StatusIsolation` (HC026 rejection path).

**R4 (action items):** `case_action_items` with status CHECK, assignee-member
guard (HC021), HC027 wrong-assignee rejection via `app.advance_action_item_core`
DEFINER. `case_action_items_kpis` DEFINER returns zeroed row to non-staff_admin.
pgTAP `113_case_action_items.sql` 19 tests. E2E `AC-ActionItems` covers the full
lifecycle including overdue KPI.

**R5 (cross-committee referrals):** Correctly deferred. ADR 0022 documents the
design and the deferral rationale. No schema change in this batch. Confirmed.

### 2. Security / RLS

**RLS boundary (Architecture Rule 1):** All 6 new tables carry explicit RLS
policies. Pattern is uniform: member-read via `is_member_of(commission_of_case(case_id))`
(or `commission_id` direct for `case_status_defs`/`case_tags`); staff_admin-write
via same. No UI-only access control.

**`app.in_case_rpc` chokepoint:** The rewritten `app.guard_case_status` trigger
function (migration 092001) checks `current_setting('app.in_case_rpc', true) = 'true'`
on every UPDATE/DELETE to `public.cases`. `app.apply_case_status` sets this flag
before updating the status column. Direct UPDATE to `cases.status` without going
through an RPC that calls `apply_case_status` will be blocked by the guard (HC025
or HC024 depending on the state). This is the correct chokepoint design.

**DEFINER core entry-point gates:** `set_case_status` (INVOKER) explicitly gates
`is_staff_admin_of(p_commission_id) OR is_admin()` before calling
`app.apply_case_status`. Both `close_case` and `cancel_case` (INVOKER wrappers)
carry the same explicit `SELECT ... WHERE is_staff_admin_of ... OR is_admin()`
guard. All three search_path-pinned at `search_path = app, public, pg_catalog`.
The DEFINER core `app.apply_case_status` itself sets `app.in_case_rpc`, validates
HC024/HC025, flips pendente/ativa phases to `nao_necessaria` on terminal entry,
and stamps `closed_at`/`closed_by`. DEFINER semantics are correct: the core runs
as the definer to bypass RLS for the multi-table write, but every public entry
point carries an explicit auth check first.

**`case-documents` storage bucket (Architecture Rule 6):** Migration 092003 creates
the bucket with no UPDATE or DELETE storage policies. INSERT policy requires
`is_staff_admin_of`. SELECT policy requires `is_member_of`. The action-layer
`uploadCaseDocument` uses `upsert: false` and generates a fresh UUID path for
every upload — immutability is enforced at both the storage policy layer (no
UPDATE/DELETE) and the action layer (no path reuse). `deleteCaseDocument` in the
action layer performs a soft-delete (sets `deleted_at`/`deleted_by` on the
metadata row, does NOT delete the storage object). Architecture Rule 6 satisfied.

**`app.guard_case_tag_assignment` DEFINER (HC026):** Runs on BEFORE INSERT on
`case_tag_assignments`. Checks that `case.commission_id = tag.commission_id`.
Raises `HC026` if they differ. Cross-commission tag assignment cannot be
bypassed because the trigger fires under the DEFINER context, not the invoker's
RLS, for the internal table reads (both `cases` and `case_tags` are read
internally). Confirmed in pgTAP `112_case_tags.sql` (cross-commission assertion)
and E2E `AC-StatusIsolation`.

**`app.advance_action_item_core` DEFINER (HC027):** Checks assignee OR
`is_staff_admin_of` OR `is_admin()` before advancing item status. HC027 raised if
none match. Action-layer `advanceActionItem` and `completeActionItem` do not
pre-check `authorizeCommission` (matches the `start_or_resume_phase` pattern:
the RPC's internal gate is the authority — the assignee may be a plain staff
member who cannot pass `is_staff_admin_of`, so the TS pre-check is intentionally
omitted). Confirmed in pgTAP `113_case_action_items.sql` tests 9–11 and E2E
`AC-ActionItems`.

**`app.case_status_is_terminal` DEFINER fail-open:** Returns `false` for an
unknown key. This means a case in an unknown/orphaned status (e.g. after a
status def is archived while a case holds that key) is treated as non-terminal.
This is acceptable: the worst outcome is that the case appears open in the board
instead of frozen — no data corruption, no security bypass. Noted in INFO-2
(the corresponding risk of archiving all terminals).

**`list_case_status_defs` DEFINER gate:** The function carries an explicit
`is_staff_admin_of OR is_admin` check before returning rows. Non-staff_admin
callers get zero rows. `listCaseStatusDefs` in the TS query module calls this
RPC through the cookie client — correct.

**`case_action_items_kpis` DEFINER:** Returns a zeroed row to non-staff_admin
callers (not an error, not raw data). Consistent with the Phase 8 dashboard
RPC pattern.

**`case_tag_report` DEFINER:** Gated `is_staff_admin_of`. Date-bounded on
`cases.created_at::date`. Cross-commission isolation verified (query JOIN on
`case_tags.commission_id = p_commission_id`).

**`cases_extras_enabled()` DEFINER:** A boolean read, no side effects. Returns
`false` on error (fail-closed). Called from the TS gate module
`src/lib/cases/extras-gate.ts` which itself returns `false` on any error.

**Service-role key:** Only in `src/lib/supabase/admin.ts` (has `import 'server-only'`).
No service-role key in any client component or bundle-reachable module.

**Anon/PUBLIC EXECUTE revoke:** Migration 092001 revokes anon and PUBLIC EXECUTE
on every function it creates or replaces, plus the 4 pre-existing functions
(`add_template_phase`, `update_template_phase`, `activate_phase`,
`reassign_phase`) that migration 091000 had left with the implicit PUBLIC grant.
pgTAP test 19 in `100_dashboard.sql` (0 anon-executable public functions) is
green.

**Phase-7 in_progress-answers invariant (ADR 0016/0017):** Confirmed untouched.
`case_phases` has no answer columns in any Cases-Extras migration. The board and
detail RPCs (`list_cases_board`, `get_case_detail`) are unchanged. The
`case_phase_answer_map` path (submitted-answers-only for `recommend_when`
evaluation) is untouched. `responses_select`/`answers_select` RLS unchanged.

### 3. Code quality

**TypeScript strict:** All new modules reviewed (`case-statuses.ts`,
`case-documents.ts`, `case-tags.ts`, `case-action-items.ts`, `extras-gate.ts`,
`status-actions.ts`, `documents-actions.ts`, `tags-actions.ts`,
`action-items-actions.ts`, `case-derive.ts`). No unexplained `any`. One
intentional open type: `CaseStatusKey = string` with an inline comment explaining
the open union (custom per-commission keys cannot be a closed union in TypeScript
at compile time). `resolveStatusDef` in `case-status-badge.tsx` provides a
guaranteed muted fallback for unknown keys at runtime.

**Data access through `src/lib/queries/`:** All new table reads go through the
four new query modules. Action files import from those modules. No inline
`supabase.from(...)` calls in components or pages. Architecture Rule 9 satisfied.

**Server Components by default:** `case-documents-panel.tsx` is a Server
Component (no `"use client"` directive). Client islands (`case-document-upload.tsx`,
`case-event-form.tsx`, `case-action-items-panel.tsx`, `case-tags-panel.tsx`) are
`"use client"` with interaction-only rationale. Pattern is correct.

**`"use server"` action files:** All four action files (`status-actions.ts`,
`documents-actions.ts`, `tags-actions.ts`, `action-items-actions.ts`) have `'use server'`
at the top. No server action logic in component files.

**`casesExtrasEnabled()` flag gating:** New write RPCs in SQL carry
`assert_extras_enabled()` internally. TypeScript actions additionally call
`casesExtrasEnabled()` before direct table writes. The flag is gated at both
layers — belt-and-suspenders correct.

**`cases_multi_phase` vs `cases_extras` gate split:** Confirmed: the modified
core phase RPCs (`activate_phase`, `skip_phase`, `add_ad_hoc_phase`,
`reassign_phase`, `create_case_from_template`, `set_case_status`,
`close_case`, `cancel_case`) remain gated by `cases_multi_phase` only (the
status guard is part of the case-lifecycle core, not extras). The NEW write RPCs
(document/event/tag/action-item CRUD) gate `cases_extras`. The split matches the
plan contract.

### 4. XSS / Rule 7

**`dangerouslySetInnerHTML`:** Grep confirmed zero occurrences in any new cases
component (`case-events-timeline.tsx`, `case-documents-panel.tsx`,
`case-action-items-panel.tsx`, `case-tags-panel.tsx`, `case-status-badge.tsx`,
`case-derive.ts`, `case-extras-labels.ts`).

**`case_events.body` rendering:** `case-events-timeline.tsx` renders `ev.body`
as `{ev.body}` inside `<p className="... whitespace-pre-wrap">` — plain React
text interpolation, not dangerouslySetInnerHTML. No XSS risk. Whitespace-only
formatting (no Markdown) is appropriate for working notes.

**Document title/description:** Rendered as plain text via JSX interpolation in
`case-documents-panel.tsx` (`{doc.title}`, `{doc.description}`) — no Markdown,
no HTML. Architecture Rule 7 satisfied.

**Tag labels, status labels, action item titles:** All rendered as plain text
interpolation. `case-extras-labels.ts` provides controlled-vocabulary pt-BR
labels for `DOC_TYPE`, `EVENT_KIND`, `ACTION_ITEM_STATUS` enums. No free-text
strings are passed through a Markdown renderer.

**Color tokens:** `case-status-badge.tsx` maps `color_token` values to a
hardcoded Tailwind class map (`TOKEN_STYLES`). Color tokens are validated by a
`color_token_check` CHECK constraint in the DB; unknown tokens fall back to
`muted`. No CSS injection vector.

### 5. pt-BR and a11y

**HC024 → "Status não reconhecido para esta comissão."**
**HC025 → "Não é possível alterar o status de um caso encerrado."**
**HC026 → "A etiqueta pertence a outra comissão."**
**HC027 → "Apenas o responsável pela ação pode avançar seu status."**

All four HC codes are mapped to pt-BR in the relevant action files. No raw
Postgres error strings reach the UI. Verified in `status-actions.ts` and
`action-items-actions.ts`.

**Accessibility:** `case-documents-panel.tsx` uses `<section aria-labelledby="case-docs-heading">`.
Download link carries `aria-label={Baixar ${doc.title}}`. `case-events-timeline.tsx`
interactive controls carry pt-BR `aria-label` attributes. `case-action-items-panel.tsx`
client component reviewed for labelled inputs. E2E `AC-Keyboard` test confirms
keyboard navigation of the Estado menu (Radix `DropdownMenu` is keyboard-accessible
by default; the spec asserts Tab navigation to the trigger and Enter/ArrowDown
operation). CLAUDE.md §8 keyboard mandate satisfied.

**`lang="pt-BR"`:** Set in `src/app/layout.tsx` (Phase 0 QA MINOR-1 fix,
confirmed still present).

### 6. No patient data / §1 compliance

Free-text fields introduced in this batch:
- `case_events.body` — event body, free-text working note
- `case_events.title` — event short title
- `case_documents.title` / `.description` — document metadata
- `case_action_items.title` / `.description` — action item text

The `case-event-form.tsx` and `case-document-upload.tsx` dialogs carry an
explicit "Nunca inclua dados de paciente." warning in their `DialogDescription`.
The `case-action-item-form.tsx` dialog does not (see MINOR-1 above). The
`case_tags.name` field is a controlled vocabulary created by staff_admin (not
end-user free text during case filling) — lower PII risk, no warning required.

### 7. Hygiene

**ADRs:** ADR 0022 (R5 deferred referrals), ADR 0023 (R2 configurable status)
exist. No standalone ADRs for R1/R3/R4 (see INFO-3 — acceptable).

**PROGRESS.md accuracy:** The Cases-Extras gate run row (254/254 pgTAP,
118/118 Playwright) is correctly recorded. The Follow-ups section documents
the pending remote `db push` and the resolved lint items.

**Secrets:** `.env.local` is gitignored. Service-role key is server-only
(`import 'server-only'` in `src/lib/supabase/admin.ts`). NEXT_PUBLIC_ vars
are Supabase URL and anon key only. No secrets in any new file.

**Migrations are additive:** All 7 Cases-Extras migrations (092000–092006)
create new objects or CREATE OR REPLACE existing functions without dropping
data-bearing columns or tables. The `cases_status_check` constraint drop
(migration 092000) is a deliberate part of the R2 design (replaced by the
trigger-based guard). No silent data loss.

---

## Summary

The Cases-Extras batch (R1–R5) meets all stated requirements. Security is
sound: RLS covers all 6 new tables plus the storage bucket; the DEFINER
core (`app.apply_case_status`) is correctly gated at every public entry
point; HC024/HC025/HC026/HC027 are correctly enforced and mapped to pt-BR;
the liveness sweep from `'aberto'` to `app.case_status_is_terminal()` is
complete and verified by a dedicated pgTAP regression test and an E2E test.
The Phase-7 in_progress-answers invariant is untouched. Architecture Rules
1, 6, 7, 9, and 10 are all satisfied. The single minor finding (PII warning
missing from the action-item form) is a cosmetic UI consistency issue with
no security implication.

**Verdict: APPROVED** (with MINOR-1 carried as a follow-up for the engineers).

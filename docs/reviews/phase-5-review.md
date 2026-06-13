# Phase 5 QA Review — Wizard Filling, Conditional Sections & Resume

**Verdict: APPROVED**
**Reviewer:** qa (QA Reviewer agent)
**Date:** 2026-06-13

---

## Scope Reviewed

| Area | Files / Artifacts |
|------|-------------------|
| Migration | `supabase/migrations/20260612100011_response_fill_rpcs.sql` |
| pgTAP | `supabase/tests/70_response_fill.sql` (16 tests) |
| Queries | `src/lib/queries/responses.ts` |
| Actions | `src/lib/responses/actions.ts` |
| Frontend — pages | `src/app/c/[slug]/forms/page.tsx`, `src/app/c/[slug]/forms/[formId]/responder/[responseId]/page.tsx`, `src/app/c/[slug]/respostas/page.tsx` + loading/error boundaries |
| Frontend — components | `src/components/responses/wizard/` (all files), `src/components/responses/{fillable-form-card,my-response-card,start-fill-button}.tsx` |
| E2E spec | `e2e/phase5-wizard.spec.ts` (12 tests, 63 total cross-phase) |
| ADR | `docs/decisions/0015-response-fill-rpcs.md` |
| Unchanged authority | `supabase/migrations/20260612100005_condition_evaluator_and_rpcs.sql` (submit_response, eval_condition — verified untouched) |
| RLS baseline | `supabase/migrations/20260612100006_rls_policies.sql`, `20260612100008_rls_hardening.sql` |

---

## 1. Requirements Audit (PHASES.md §Phase 5)

### Staff form list
PASS. `/c/[slug]/forms` (Server Component, `listFillableForms`) shows published-only versions. "Continuar preenchimento" link (direct to wizard) shown when `inProgressResponseId !== null`; "Preencher" `StartFillButton` (calls `startOrResumeResponse` then navigates) shown otherwise. AC1 flat-form render, AC3 resume, AC5 keyboard flow — all covered. Nav "Formulários" item wired.

### Unsectioned flat render
PASS. `isFlat = sections.length === 1 && sections[0].isDefault` mirrors `read-only-tree`'s rule. All four input types rendered via `InputItem`; `section_text` via `MarkdownRenderer` (sanitized, no `dangerouslySetInnerHTML`); `image` via server-resolved signed URL. `question_explanation` → `FieldDescription` wired via `aria-describedby` on all four input types. AC1 E2E verifies all of these.

### Sectioned wizard
PASS. `WizardProgress` over visible sections only with correct `aria-valuemax`. Back/next with per-section client validation. Conditional sections appear/disappear live via `evalCondition` (TS mirror only — no re-implementation). AC2 covers both branches (S2 shown/absent in review).

### Resume
PASS. `saveSection` called on every `handleNext`/`handleBack`; `last_section_id` updated. "Salvar e sair" routes back to forms list. On reopen, `useWizard` resolves `lastSectionId` from `WizardData` (set server-side from `ResponseForFill.lastSectionId`), clamped to visibility. AC3 verifies: sign out + sign in → "Continuar preenchimento" → last section with answers intact.

### Warn-and-clear
PASS. `previewAnswerChange` + `detectOrphans` + `commitAnswerChange` correctly detect a now-hidden section with saved answers. `OrphanWarningDialog` (Radix AlertDialog, `alertdialog` role, pt-BR, names the section) fires. Confirm → `commitAnswerChange` + `saveSection(clearItemIds)` — atomic DB clear. AC4 verifies: warn dialog appears, progress drops from `aria-valuemax=6` to `5`, S2 absent from review.

### Review screen
PASS. `ReviewScreen` uses semantic `<section aria-labelledby>`, `<h2>` per section, `<fieldset>` + `<dl>` for answers; "Sem resposta" for blanks. Per-section "Editar" jump-back. `SubmitPanel` calls `submitResponse` (server is the authority). Server rejection (P0011 via E2E AC6 with service-role REST delete) surfaces pt-BR message in `role="alert"`. Confirmation screen renders for submitted responses (server-rendered path avoids the redirect-race bug).

### "Minhas respostas" history
PASS. `listMyResponses` returns submitted + in_progress, commission-scoped, newest-activity-first. `MyResponseCard` with status icon + label (not colour-only), pt-BR date. In_progress → "Continuar"; submitted → "Ver" (links to wizard route which renders `ConfirmationScreen` for submitted — Phase 7 replaces with full read-only viewer, per agreed scope deferral).

### Sign-off sections treated as ordinary (Phase 6 deferral)
PASS. `requires_signoff` sections render as ordinary sections in the wizard. `submit_response`'s sign-off check is feature-flagged off (ADR 0004, `app.feature_enabled('signoff_enforcement')`). Confirmed `submit_response` in M5 is VERBATIM — untouched by this phase.

### Version-faithfulness
PASS. `getResponseForFill` loads the tree via `getVersionTree(response.form_version_id)` — always the version of the response, not the current published version. AC7 verifies: v1 in_progress resumes at v1 after v2 is published (wizard URL is response-scoped, not form-scoped).

---

## 2. Security / RLS Audit (Architecture Rule 1 + Rule 3)

### "No new policies needed" conclusion — VERIFIED

Both new RPCs are `SECURITY INVOKER`. Under invoker context:

- `start_or_resume_response`: the INSERT runs under `responses_insert_own` (`created_by = auth.uid() AND app.is_member_of(commission_id)`). A non-member cannot see the version (M6 `form_versions_select` requires membership) → RPC raises `no_data_found` before the INSERT. The resume SELECT (`created_by = v_uid AND status = 'in_progress'`) also limits to the caller's own draft. No cross-commission path.

- `save_section_answers`: the upsert runs under `answers_write_own_draft` (existence check on parent response: `created_by = auth.uid() AND status = 'in_progress'`). The `responses` UPDATE runs under `responses_update_own_draft` (`created_by = auth.uid() AND status = 'in_progress'`). A foreign user reads the draft as "not found" (M6 `responses_select` returns own rows + staff_admin-visible submitted only). Submitted immutability is trigger-enforced (`guard_submitted_response` / `guard_submitted_children`) — neither RPC sets `app.in_submit_rpc`, so the triggers block writes against submitted rows. pgTAP test 8 (foreign user → `no_data_found`) and test 9 (submitted immutability holds) confirm this.

- Cross-version item guard: `save_section_answers` rejects any `item_id` not belonging to `v_version_id` (`check_violation`). Not a security hole (inert rows would be excluded by `submit_response`'s walk of the version's own sections), but keeps data clean. pgTAP test 6 covers this.

- Cross-commission: `start_or_resume_response` rejects a non-member because the version is invisible to them (pgTAP test 3). `save_section_answers` rejects a foreign user via `no_data_found` (pgTAP test 8).

### Service-role key — VERIFIED SAFE

`src/lib/supabase/admin.ts` starts with `import 'server-only'` (line 1), which makes importing it from a Client Component a build-time error. The service-role key is `process.env.SUPABASE_SERVICE_ROLE_KEY` (not `NEXT_PUBLIC_`), so it is not bundled into client JS. The admin client is NOT used anywhere in Phase 5 fill paths — `src/lib/responses/actions.ts` uses only `createClient()` (the cookie-scoped server client).

### `submit_response` is the submission authority — VERIFIED

`submitResponse` in `actions.ts` (line 252) calls `supabase.rpc('submit_response', ...)` — the Phase-1 M5 RPC — unchanged. Client-side `validateSection` is explicitly marked UX-only. AC6 E2E proves the server rejects P0011 even after client-side validation passes (required answer deleted via service-role REST between save and submit).

### Condition evaluator — single authority — VERIFIED

`eval_condition` (M8 search_path-pinned version) is untouched by this phase. The TS `evalCondition` in `src/lib/queries/conditions.ts` is also untouched. `useWizard` delegates entirely to `evalCondition` (line 122: `sections.filter((s) => evalCondition(s.visibleWhen, answerMap))`). The shared vector file `src/lib/queries/__fixtures__/condition-vectors.json` (18 vectors) covers all three ops + checkbox arrays + missing-answer edge cases. Vitest `conditions.test.ts` + pgTAP `20_conditions.sql` both consume it. No drift.

### Client bundle isolation (Architecture Rule 9) — VERIFIED

`src/components/responses/wizard/prepare.ts` starts with `import 'server-only'` (line 1) — confirmed server-only. `use-wizard.ts` declares `INPUT_ITEM_TYPES` locally (lines 17-22) with a comment explaining why it does not value-import `forms.ts`. All domain types imported as `type`-only from server modules. `wizard-runner.tsx` imports server actions (`saveSection`, `saveAndExit`, `submitResponse`) from `@/lib/responses/actions` — this is the Next.js server action pattern (client imports a `'use server'` module; Next wires the RPC transport). No `createClient()` calls in any wizard component — confirmed by grep.

---

## 3. Code Quality (Architecture Rule 9 + CLAUDE.md §8)

### TypeScript strict
PASS. `npm run typecheck` exits clean (0 errors). No `any` found in new `src/lib/responses/` or `src/components/responses/` files.

### Data access through `src/lib/queries/`
PASS. Pages call `listFillableForms`, `getResponseForFill`, `listMyResponses` from `src/lib/queries/responses.ts`. Mutations go through `src/lib/responses/actions.ts`. No inline supabase-js in `src/app/` or `src/components/responses/`.

### Server Components by default
PASS. The fill list page, wizard page, and history page are Server Components. `"use client"` used only where interaction requires it (wizard engine, nav, inputs, dialogs, buttons, progress bar). `prepare.ts` is server-only. `wizard-runner.tsx` is a thin client adapter that binds the response ID into server actions.

### Lint
PASS with 1 warning: `e2e/phase5-wizard.spec.ts:1` — `Locator` imported from `@playwright/test` but never used as a value (it is used as a type annotation at line 1: `type Locator`). This is a test-file-only warning, not application code. Zero errors.

---

## 4. UX & Accessibility (CLAUDE.md §8, Architecture Rule 7)

### pt-BR user-facing strings
PASS. All wizard text, labels, banners, dialog copy, history page, confirmation screen are in pt-BR. Error messages in `MESSAGES` (actions.ts) are pt-BR. Raw Postgres error text never surfaces (all codes mapped).

### Markdown sanitization (Architecture Rule 7)
PASS. `MarkdownRenderer` (shared with Phase 4) uses `react-markdown` + `rehype-sanitize` (hardened schema) + no `rehype-raw`. No `dangerouslySetInnerHTML` in `block-renderer.tsx` or `markdown-renderer.tsx` — the grep hits are comments explaining why it is absent. `question_explanation` rendered as plain text via `FieldDescription` (not Markdown), appropriate for the field type.

### Accessible inputs
PASS.
- `free_text` / `dropdown`: `<label htmlFor>` via `FieldLabel`, `aria-describedby` includes `descriptionId` (explanation) and `errorId` (error) via `useFieldIds`, `aria-invalid` on error.
- `multiple_choice` / `checkbox`: `<fieldset>` + `<legend>`, group-level `aria-describedby` and `aria-invalid`, per-option `<label htmlFor>` with matching `id`.
- Review screen: `<section aria-labelledby>` + `<h2>`, `<fieldset>` + `<dl>`.
- Progress bar: `role="progressbar"`, `aria-valuemin/max/now`, `aria-label`.
- Orphan dialog: Radix `AlertDialog` → `alertdialog` role, focus trap, Esc-to-cancel.

### Keyboard-only (CLAUDE.md §8 mandate)
PASS. AC5 E2E verifies `toBeFocused` at the form card, radio, dropdown, "Revisar" button, and "Enviar respostas" button. All controls are native elements or Button primitives with visible focus rings.

---

## 5. Hygiene

### ADR
PASS. ADR 0015 (`docs/decisions/0015-response-fill-rpcs.md`) covers the two-RPC decision, RLS audit, double-click race, cross-version guard, and orphan-clear atomicity. ADR 0014 (Markdown renderer, Phase 4) remains in place and reused.

### PROGRESS.md
PASS. Phase 5 task table reflects reality (all B1–B4 and F1–F6 done). Test run summary records the 63/63 result with spec notes. QA Verdicts row awaits this review entry.

### Secrets
PASS. `SUPABASE_SERVICE_ROLE_KEY` is server-only (not `NEXT_PUBLIC_`). The key in `e2e/phase5-wizard.spec.ts` line 49 is the LOCAL Supabase Docker default service key (URL `127.0.0.1:54321`) — scoped to local test infrastructure, not a production secret. It is used only to simulate a "second tab" deletion in AC6 and is not a production leak.

---

## 6. Findings

### MINOR-1 — `save_section_answers` `p_section_id` not validated against `form_version_id`

**File:** `supabase/migrations/20260612100011_response_fill_rpcs.sql`, line 128  
**Requirement:** Architecture Rule 2 (schema integrity — `last_section_id` should reference a section of the response's version) and Rule 1 (DB-level invariants hold).

The RPC sets `last_section_id = p_section_id` without verifying that `p_section_id` belongs to `v_version_id`. The `responses.last_section_id` column is a FK to `form_sections(id)` but the schema has no check that it matches `form_version_id`. A well-formed client never sends a foreign `section_id`, but a hostile or buggy client could set `last_section_id` to a section from a different form version (or a different commission's form). This would only affect wizard resume navigation (the wizard renders from the version tree, so stray `last_section_id` values are clamped by `useWizard` if not found in the visible sections), but the DB row would contain a cross-version section reference.

**Not a security hole.** No data from another commission leaks. No blocker to phase approval. Recommended fix for Phase 6: add a `SELECT 1 FROM form_sections WHERE id = p_section_id AND form_version_id = v_version_id` guard before the UPDATE, similar to the existing item cross-version guard.

### MINOR-2 — `check_violation` from cross-version item guard maps to "already submitted" message

**File:** `src/lib/responses/actions.ts`, lines 199-202  
**Requirement:** CLAUDE.md §8 — errors are user-readable in pt-BR; raw Supabase/Postgres errors never reach the UI.

`saveSection` maps any `23514` `check_violation` to `MESSAGES.alreadySubmitted` ("Esta resposta já foi enviada."). This code handles both the status guard (correct mapping) and the cross-version item guard (which should map to something like "Dados inválidos" or `MESSAGES.generic`). In practice a legitimate user never triggers the cross-version guard, but if they did, the message would be misleading. Not a user-facing blocker under normal use.

**Suggested fix:** distinguish the two `check_violation` sources by inspecting `error.message` for a pattern (e.g. `'não pertence a esta versão'`) or by using a distinct SQLSTATE in the cross-version guard.

### INFO-1 — Unused `Locator` import in E2E spec (lint warning)

**File:** `e2e/phase5-wizard.spec.ts`, line 1  
`Locator` is imported but used only as a type annotation (`type Locator` on line 1 is the TypeScript type syntax). The `@typescript-eslint/no-unused-vars` warning fires because ESLint treats the inline `type` form as a value import. Fix: change `type Page, type Locator` to `type Page` (drop the unused type) or suppress with `// eslint-disable-next-line @typescript-eslint/no-unused-vars`. Test file only; no impact on production code.

---

## 7. Scope Deferrals Confirmed (Not Findings)

The following are confirmed as agreed Phase-5 scope deferrals and are NOT findings:

- **Sign-off step UI**: Phase 6. `requires_signoff` sections render as ordinary. `submit_response`'s sign-off check is feature-flagged off. Wizard correctly makes no sign-off affordance.
- **Submitted response read-only detail viewer**: Phase 7. "Ver" in "Minhas respostas" links to the wizard route which renders `ConfirmationScreen` for submitted responses. This is the agreed Phase-5 behavior (PROGRESS.md frontend notes).
- **AC7 version-faithfulness tested via in_progress resume** (not full read-only submission viewer): agreed Phase-5 reading per PROGRESS.md.

---

## 8. RLS Verification Summary

| Attack vector | Block mechanism | Verified by |
|---------------|-----------------|-------------|
| Foreign user reads another's in_progress response | `responses_select` (own rows only for in_progress) | pgTAP test 8; AC Security E2E |
| Foreign user saves into another's draft | `save_section_answers` status guard → `no_data_found`; `answers_write_own_draft` | pgTAP test 8 |
| Cross-commission start response | `form_versions_select` (membership required) → `no_data_found` before INSERT | pgTAP test 3 |
| Save to submitted response | `guard_submitted_response` / `guard_submitted_children` triggers; status guard in RPC | pgTAP test 9; AC6 (submit, not save, but same trigger) |
| Cross-version item in answers | Cross-version item guard in `save_section_answers` → `check_violation` | pgTAP test 6 |
| Draft on non-published version | `start_or_resume_response` published-only backstop → `check_violation` | RPC code; pgTAP test 3 (non-member covers version invisibility) |
| Service-role key client-side | `import 'server-only'` on `admin.ts`; key not `NEXT_PUBLIC_` | Code inspection |

---

## Verdict

**APPROVED**

All 7 Phase 5 acceptance criteria are met and E2E-verified (63/63 green, cross-phase regression included). The two new `security invoker` RPCs are correctly covered by existing Phase-1 RLS policies; no new policies were needed and the audit confirms this. The submission authority (`submit_response`), condition evaluator (`eval_condition`/`evalCondition`), and sign-off feature-flag remain untouched. Architecture Rules 1, 3, 7, 9, and 10 are all satisfied. TypeScript strict passes (0 errors). Two MINOR findings and one INFO warning are recorded above; none block phase completion. Both MINORs are recommended to be addressed in Phase 6 (backend owner), and the INFO warning is a test-file-only lint cleanup (tester owner).

---

## Follow-ups Carried into Phase 6

- [ ] **MINOR-1** (backend): add `p_section_id` validation against `form_version_id` in `save_section_answers` RPC — prevents a cross-version `last_section_id` reference.
- [ ] **MINOR-2** (backend): distinguish the two `check_violation` sources in `saveSection` action — the cross-version item guard should map to `generic` or a dedicated message, not `alreadySubmitted`.
- [ ] **INFO-1** (tester): remove unused `Locator` type import from `e2e/phase5-wizard.spec.ts` line 1 to clear the ESLint warning.

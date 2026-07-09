# UI/layout fixes batch + base-branch triage — 2026-07-08

Ad-hoc, out-of-phase. Archived from PROGRESS.md at the §6 Record step.
Committed: UI batch `2bc51f4` (+ backend discard migration in the same commit);
base-branch triage `96a6330`. All on `main`, pushed to origin (`4d89658`).
Remote `supabase db push` for the new migration(s) deferred to deploy (same as the
other unpushed local migrations).

---

## UI/layout fixes batch (frontend + backend)

Small targeted UI/layout fixes — no schema beyond the discard-draft RPC, no new
backend surface otherwise.

### Frontend rows

- **F1 (meeting badge)** — `em_assinatura` label "Em assinatura" → "Assinatura" in
  `meeting-labels.ts` + `timeline/format.ts` pill; matching prose in
  `meeting-lifecycle-actions.tsx` confirm dialog. Slug unchanged.
- **F2 (held/schedule date fields stacked)** — dropped `sm:grid-cols-2` in
  `held-window-fields.tsx` + `meeting-form-dialog.tsx` (Início/Término now
  full-width stacked).
- **F3 (source badge hug)** — added `w-fit` to `ActionItemSourceBadge` (fixes all 3
  source variants).
- **F4 (Meus Casos filter chips)** — new client `my-cases-filter.tsx` (2 combinable
  `aria-pressed` toggle chips "Abertos" / "Minhas atribuições em aberto" + count +
  empty state); page delegates to it.
- **F6 (single "Aparência Condicional" checkbox)** — `condition-builder.tsx`
  collapsed heading+sublabel into one checkbox styled like "Resposta obrigatória";
  body still renders when checked; required mutual-exclusion intact.
- **F7 (red flag on flagged options)** — `block-card.tsx` BlockPreview renders
  leading red `Flag` (aria-label "Sinalizada") on `opt.flagged` for
  multiple_choice/checkbox/dropdown.
- **F9 (discard-draft)** — new `responses/discard-draft-button.tsx` (destructive
  AlertDialog → `discardResponse` + `router.refresh()`); wired into
  `fillable-form-card.tsx` (standalone forms only, only when a draft exists).
  Backend action `discardResponse(responseId): Promise<ActionState>` merged
  (`actions.ts`); imported directly.
- **F5 (nav on Aprovações pendentes)** — (lead-approved, Option A, no backend query).
  New `documentos-pendentes/layout.tsx` mounts a right-sized org header shell + new
  `shell/org-approvals-nav.tsx` ("Aprovações pendentes" reads active via prefix
  match); gate mirrors the page's broad "any org standing"
  (member/org_admin/hospital_admin), org resolved from `getSessionContext()`. NOT
  `AppSidebar` (commission-scoped → wrong for an org route). Both
  `documentos-pendentes` pages' `<main>` wrappers → plain `<div>` (layout now owns
  `<main>`; no nested main / doubled padding).
- **F8 (move "Config. de Reuniões" into Configurações)** — (lead-approved).
  "Reuniões" tab added to `SettingsTabs` (new `meetingsEnabled` prop mirroring
  `phaseResultsEnabled`); all 4 existing settings pages
  (desfechos/etiquetas/titulos/resultados) resolve+pass `meetingsEnabled()`. New
  `manage/settings/reunioes/page.tsx` (staff_admin + `meetings`-flag gated) reuses
  `MeetingSettingsView` with the Configurações header. Old `manage/meetings/page.tsx`
  → `redirect()` to `settings/reunioes` (flag-gated safety net). AppSidebar
  "Config. de reuniões" href repointed DIRECTLY to `manage/settings/reunioes`.
  - **TESTER (done 2026-07-08):** `e2e/phase10-meetings.spec.ts` AC3/AC5c +
    `e2e/hospital-admin-tier.spec.ts` "title badge" test updated for the route move
    (`/manage/meetings` → `/manage/settings/reunioes`; the attendee-list test
    repointed to `/c/ccih/meetings`). Also swept 7 stale `Em assinatura` →
    `Assinatura` badge assertions broken by F1 (phase10 ×6, meeting-held-time T1.4,
    cases-meetings-minor C2). All GREEN: phase10 15/15, hospital-admin-tier 38/38,
    meeting-held-time+cases-meetings-minor 18/18.

**F5/F8 verification:** `npm run build` exit 0 — all 4 routes compiled
(`settings/reunioes`, `manage/meetings` redirect, `documentos-pendentes` +
`[documentId]` under the new layout). tsc + eslint clean on all touched files. No
authenticated dev-server browser walk — deferred to the E2E gate.

### Backend rows

- **B1 (discard-draft, standalone forms)** — COMPLETE (lead-approved DB plan).
  Contract `discardResponse(responseId: string): Promise<ActionState>`
  (`src/lib/responses/actions.ts`) wired to the new RPC. Migration
  `supabase/migrations/20260715000200_discard_standalone_draft.sql`: RLS
  `responses_delete_own_draft` (`created_by = auth.uid() AND status='in_progress'`) +
  SECURITY INVOKER RPC `public.discard_response(uuid)` (re-checks owner + in_progress
  + `case_phase_id IS NULL`; payload-free `response.discarded` audit via
  `app.audit_write`; DELETE cascades answers/selections/group-instances/sign-offs).
  `guard_submitted_response` BEFORE DELETE left intact (backstops submitted → HC065).
  Errcodes HC065 (not draft) / HC066 (case-bound) / no_data_found. `REVOKE ALL FROM
  PUBLIC` before `GRANT EXECUTE … TO authenticated, service_role`. Types regenerated
  → `database.ts` carries `discard_response`; tsc/lint 0. pgTAP
  `31_discard_response.sql` 10/10; full suite 1882/1882 on fresh reset (0 reg).
  Migration local-only — remote `db push` deferred to deploy.
- **B2 ("Outro" missing when default set)** — FIXED. Bisection (local DB):
  reconcile_item_options DOES mint the `__other__` row when `config.allowOther=true`
  (with OR without a default). Root cause was NOT default-value and NOT the render
  layer — it was `addItem` calling the raw `insertOptionRows` (never mints
  `__other__`) instead of `reconcile_item_options` (which `updateItem` uses). A
  freshly-added allowOther item had NO Outro until it was next edited; the "default
  value" correlation in the report was coincidental. Fix: route `addItem`'s
  choice-option write through `reconcileOptionRows` (one option-write path for
  add+update) and delete the now-dead `insertOptionRows`. `src/lib/forms/actions.ts`
  (+doc touch `option-code.ts`). Vitest 294/294, tsc/lint clean on the change.
  - **TESTER — B2 repro (verified 2026-07-08):** `e2e/ui-batch-2026-07.spec.ts` C1
    builds a NEW multiple_choice w/ "Outros" via the builder UI, publishes WITHOUT
    editing, then fills → "Outro" renders as a selectable radio, selecting it reveals
    the "Especifique…" free-text, and DB carries the `__other__` (is_other) option
    row. GREEN.

### E2E (scoped pass, NOT a formal gate)

New spec `e2e/ui-batch-2026-07.spec.ts` (10 tests): A1 discard round-trip, A2 no
discard on submitted, A3 server authority `discard_response` refuses case-linked
(HC066), B1 filter chips OFF-by-default/AND/aria-pressed, B2 pt-BR empty state, B-K
keyboard-only chip toggle, C1 B2 fix (fresh-add "Outro"), S1 badge-rename guard, S2
Aprovações-pendentes nav shell, S3 red "Sinalizada" marker + single "Aparência
Condicional".

Result: **ui-batch 10/10 · phase10 15/15 · hospital-admin-tier 38/38 ·
meeting-held-time+cases-meetings-minor 18/18 (= 81/81)**, all GREEN on fresh resets.
Env note (no code/spec bug): running all affected specs in ONE invocation flakes 4–6
login-timeout failures (the documented local-GoTrue rate-limit under heavy
reset+login cadence); the same tests pass in smaller batches. Full regression NOT run
(scoped pass, per lead).

---

## Base-branch failure triage (2026-07-08, lead)

6 tests inherited RED on `feat/meeting-held-time` (cut from `main` after the
`feat/administrativo-role` merge `1010f07`), all UNRELATED to `held_at` (reproduced
with the held_at working tree stashed out). Each reproduced in ISOLATION on a fresh
`supabase db reset` (chromium, `--workers=1`); pgTAP on a fresh reset. Committed
`96a6330`. Findings + fixes:

- **`hospital-departments.spec.ts:252` (AC-3) — REAL app regression (frontend
  layout), FIXED.** The coordinator case-detail header text column (`min-w-0`, no
  flex-basis) collapsed to width 0 when the `shrink-0` action cluster's buttons
  filled the row → title/label/department wrapped one word per line (Playwright reads
  the 0-width box as `hidden`). Fix: `sm:flex-wrap` on the header container + `sm:grow
  sm:basis-64` on the title block in
  `…/manage/cases/[caseId]/(detail)/layout.tsx`. Verified live desktop+mobile;
  `hospital-departments` 6/6 green. (Latent from the departments/extra-buttons work in
  the Form-Builder batch.)
- **`case-phase-result.spec.ts:707` (AC-3) — test-locator fragility, FIXED (spec).**
  `getByText(/Manual/i).first()` matched case 3's header LABEL `Caso CPR-SPEC —
  Override (Manual)` (hidden by the same layout collapse) instead of the result pill.
  Fix: `getByText('Manual', { exact: true })` targets the actual `PhaseResultBadge`.
  App pill always rendered correctly; `case-phase-result` 9/9 green.
- **`administrativo.spec.ts:680` (KBD) — environment/spec portability, FIXED (spec).**
  `Control+a` is the macOS "move caret to line start" binding (not select-all), so the
  field wasn't cleared → new label concatenated onto the old. Fix: `ControlOrMeta+a`
  (⌘A on darwin, Ctrl elsewhere). Passes.
- **`case-access.spec.ts:297` (AC-2) — flaky/full-suite artifact, NO fix.** Passes
  3/3 in isolation on fresh reset; code review confirms no administrativo-role path
  grants staff4 read of Caso 0001 or a Meus Casos row (no grant/attribution/
  appointment; `administrativo` flag OFF at the time). Full-suite failure = the known
  local-GoTrue reset/login rate-limit or cross-spec DB mutation.
- **pgTAP `90_cases` t33 — NOT a regression, FIXED (test).** ADR-0061 widened
  `list_cases_board` from a coordinator-only gate to a per-row `can_read_case` filter;
  this file runs with `case_access` OFF where `can_read_case` degrades to
  `is_member_of`, so plain member `st_x` (also a phase-1 assignee) now sees the board —
  the documented flag-OFF behavior, not a leak. Retargeted the assertion to a
  cross-commission non-member (`st_y` → empty board), the residual boundary that still
  holds.
- **pgTAP `184_hospital_admin_isolation` t15 — stale assertion, FIXED (test).** Commit
  `9e12ce8` expanded default member titles 3→5 and updated pgTAP `186` but missed
  `184`'s `= 3`. Updated to `= 5`. Both pgTAP files green (90_cases 35/35, 184 25/25).

Net app change: 1 file (`(detail)/layout.tsx`, additive Tailwind only). Spec/test
changes: `administrativo`, `case-phase-result`, `90_cases`,
`184_hospital_admin_isolation`. `case-access` unchanged.

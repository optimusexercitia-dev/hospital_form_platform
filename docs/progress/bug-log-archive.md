# Archive — Bug Log (resolved & closed)

> Archived verbatim from PROGRESS.md on 2026-06-25 at the §7 progress-tracker cleanup.
> This is the durable detail; PROGRESS.md keeps only a one-line pointer.

> 66 resolved/closed bug rows. The one OPEN bug (BUG-FBE-004) stays in PROGRESS.md.

| ID | Phase | Severity | Description / repro | Expected | Actual | Spec | Owner | Status |
| -- | ----- | -------- | ------------------- | -------- | ------ | ---- | ----- | ------ |
| P2-001 | 2 | MAJOR | Spec defect: bad-credentials test used `[role="alert"]` (no such element — `FormBanner` renders `role="status"`), so the locator silently matched nothing and the `not.toMatch(/e-mail\|senha/i)` assertion passed vacuously. Additionally the negative regex was semantically wrong: the correct enumeration-safe message IS "E-mail ou senha incorretos." (names both fields together), so the regex would fire on it. | Banner locator targets `[role="status"]`; test asserts the exact message `'E-mail ou senha incorretos.'` via positive `toBe` (sufficient proof of non-enumeration). | `[role="alert"]` matched nothing; test gave a false green without observing the actual banner. | `e2e/phase2-auth-shell.spec.ts` L261 — Phase 2 AC clause 7 (bad-creds, no field-specific leak) | tester | RESOLVED — fixed same session, re-verified 2026-06-12, 29/29 green |
| P4-001 | 4 | MAJOR | **Section/block/option reorder silently broke after the GSAP Flip plugin finished loading.** Repro: in the builder, trigger any reorder TWICE (the first call dynamically imports Flip; the second runs `flip.getState()`). `use-flip-reorder.ts` imported the Flip plugin but never `gsap.registerPlugin(Flip)`, so `getState()` threw — and because `handleMove` calls `onBeforeReorder()` (the capture) BEFORE dispatching the `moveSection`/`moveItem` server action, the throw aborted the click handler and the reorder never persisted. The happy-path smoke never reordered, so it slipped through; the AC-c forward-reference test (which reorders a section) caught it. | Up/down reorder persists every time; motion is decorative and never blocks the mutation. | Reorder no-op'd from the 2nd reorder onward (after Flip loaded); the move server action was never called. | `e2e/phase4-builder.spec.ts` (AC-c) | frontend(lead) | RESOLVED 2026-06-12 — `use-flip-reorder.ts`: register the Flip plugin on import (`gsap.registerPlugin`), and wrap `getState`/`from` in try/catch so a GSAP error can NEVER block the reorder (motion is best-effort per CLAUDE policy). Full Phase 4 E2E 4/4 green vs remote after the fix; typecheck+lint+unit green. |
| P2-002 | 2 | BLOCKER | Post-sign-in session race under parallel load. Repro: `npx playwright test --workers=5` — keyboard-only flow (~1 in 5 runs). After pressing Enter on the password field the sign-in action redirects to `/`; root `page.tsx` calls `getSessionContext()` and receives no session (or empty memberships), bouncing the user to `/login?redirect=%2Fc%2Fccih` instead of the authenticated shell. Occasionally surfaces as a 404 at `/c/ccih`. Navigation trace: `navigated to "/"` → `navigated to "/login?redirect=%2Fc%2Fccih"`. Intermittently violates Phase 2 primary acceptance criterion: "each persona logs in and lands on the correct area." | After sign-in, `waitForURL(/c/ccih)` succeeds and the authenticated shell renders. | `waitForURL(/c/ccih, 15s)` times out — browser bounced to `/login?redirect=/c/ccih`. | `e2e/phase2-auth-shell.spec.ts` L333 — keyboard-only flow; Phase 2 AC clause 1 (persona lands on correct area) | backend | RESOLVED — re-verified 2026-06-12: 430 sign-in/landing executions under --workers=5 (290 tests ×repeat-each=10 full suite + 140 tests ×repeat-each=20 targeted), 0 bounces. Fixes: c808f8d (signIn resolves landing directly, removes /hop) + 760d6a4 (middleware identity via local JWT getClaims(), no getUser() GoTrue round trip). |
| P3-001 | 3 | MINOR | **Spec defect (local-only):** `waitForMailpitMessage` filtered by `new Date(m.Created).getTime() > afterMs` (afterMs = Date.now() captured after the invite button click). On local Docker, GoTrue delivers the invite email to Mailpit before the JS timestamp is captured — the email arrives before `afterMs`, so the time-guard excludes it and the poll returns null after 20 s. Remote (slower network) was never affected. | Poll finds the invite email by address match; `expect(msg).not.toBeNull()` passes. | Poll returns null because the email's Created timestamp precedes afterMs; assertion fails with "Expected: not null / Received: null". | `e2e/phase3-admin-members.spec.ts` L205 — AC2 Mailpit intercept | tester | RESOLVED 2026-06-12 — removed the time filter from `waitForMailpitMessage`; address-only match is sufficient because every test uses a unique `Date.now()`-suffixed address. Full 51-test suite green on local. |
| P6-001 | 6 | BLOCKER | **APP bug — staff_admin can NEVER counter-sign from the queue via the UI.** `signSection` (`src/lib/responses/actions.ts`) pre-resolves the response's commission with `contextOfResponse()`, which reads `public.responses` through the RLS **cookie client**. But `responses_select` deliberately HIDES another member's `in_progress` response from a staff_admin (the Phase-7 invariant; ADR 0016 routes the queue/review reads through SECURITY DEFINER RPCs instead). So for chefe.farm signing staff1.farm's in_progress `e1`, `contextOfResponse()` returns null → the action returns "Resposta não encontrada." and never calls `sign_section`. Repro: `npx supabase db reset`; chefe.farm → `/c/farmacia/manage/assinaturas` → open the e1 row → fill a note → **"Assinar seção"**. Verified the underlying `sign_section` RPC works when called directly as chefe.farm (HTTP 200, b004 row inserted) and that `responses_select` returns `[]` for chefe.farm reading e1 — so the block is the action's RLS pre-check, not the RPC/RLS signer rule. | chefe.farm signs the staff_admin section; the row is recorded; e1 leaves the queue; the respondent can then submit. | UI shows the pt-BR error banner "Resposta não encontrada." (captured in the AC2 failure snapshot, `ref=e103`); no sign-off row is written; the response never leaves the queue. | `e2e/phase6-signoffs.spec.ts` AC2/AC6/AC1 (L331), AC4 (L432, cascades), AC7 (L564) — PHASES.md §Phase 6 AC "staff_admin-signed flow end-to-end including the pending queue" | **backend** | RESOLVED 2026-06-13 — `signSection` no longer pre-resolves the commission or calls `authorizeMember` (approach 1, lead's lean): `sign_section` + `signoffs_insert` RLS are the COMPLETE signer authority, so the redundant RLS-scoped `responses` read (the bug) is removed entirely. The action now calls the RPC directly and maps its codes (42501→forbidden, P0014/P0015/P0002). `revalidatePath` already used the literal `[slug]` patterns. `responses_select` UNCHANGED (Phase-7 invariant preserved). Verified at the authority layer via psql: chefe.farm signs e1's b004 → queue 1→0 → respondent submits → `submitted`; respondent self-sign still works; wrong-role staff→staff_admin section still 42501 (pgTAP `80_signoffs` test 3). pgTAP **138/138**; typecheck+lint clean. **Tester re-verified 2026-06-13: full 70-test suite green (70/70); AC2/AC4/AC7 all pass; see Test Run Summary gate run 2 row.** |
| P7-001 | 7 | MAJOR | **APP bug — `StartPhaseLanding` server action hangs after Next.js client-side navigation.** Repro: sign in as an assignee, go to `/c/ccih/minhas-fases`, click (or keyboard-Enter) the "Preencher" link. The page navigates to `/c/ccih/cases/{caseId}/phase/{phaseId}` and shows "Abrindo a fase…" indefinitely. The `startOrResumePhase` server action (called from `useEffect` inside `StartPhaseLanding`) never returns when reached via Next.js client-side routing; it works correctly on a fresh page load via `page.goto`. Verified: the underlying `start_or_resume_phase` RPC works via API and the redirect works with `page.goto`. Spec: used `page.goto(preencherHref)` as a workaround to keep the suite green; the "Preencher" link's presence and href are still asserted. | After clicking "Preencher", the page landing redirects within ≤10 s to `/phase/{phaseId}/responder/{responseId}` and the wizard renders. | Page stays at the phase landing URL showing "Abrindo a fase…" indefinitely; no wizard redirect. | `e2e/phase7-cases.spec.ts` AC-HappyPath + AC-Keyboard — PHASES.md §Phase 7 AC "staff enters their assigned phase via 'Minhas fases' and fills / submits the wizard" | **frontend** | RESOLVED 2026-06-13 (frontend) — Root cause: the auto-run-in-`useEffect`-on-mount landing pattern (`StartPhaseLanding` called `startOrResumePhase` from a mount effect, then self-redirected). That server-action-on-render hangs under Next.js client-side routing. **Fix (mirrors the working `StartFillButton`):** replaced it with a CLICK-driven `StartPhaseButton` (`src/components/cases/start-phase-button.tsx`) — on click it calls `startOrResumePhase(phaseId)` inside `useTransition`, then `router.push`es straight to `…/responder/{responseId}`. `MyPhaseCard`'s "Preencher" now renders that button (no `<Link>` to a landing). **Deleted** the intermediate self-redirecting route `cases/[caseId]/phase/[phaseId]/page.tsx` + `start-phase-landing.tsx` (nothing mutates on render now). Manually verified under client-side nav (db reset, flag ON, signed in as seeded assignee staff1.ccih, Fase 2 activated): click "Preencher" → responder route in ~1.5s → wizard renders; resume cycle returns the same response id; zero console errors. typecheck+lint+build clean. Tester can restore the real click-driven assertion (drop the `page.goto` workaround). **RE-VERIFIED 2026-06-13 (tester):** restored real click flow (`getByRole('button', { name: /Preencher/i })` → `.click()` → `waitForURL(/\/phase\/…\/responder\/…/)`) in AC-HappyPath and keyboard Enter in AC-Keyboard; AC-AssigneeScoping also updated to `getByRole('button')`. Full 81/81 green. |
| SPEC-P8-001 | 8 | MINOR | **Spec defect (Windows): `P7 INFO-1` test in `phase8-dashboard.spec.ts` reads `phase7-cases.spec.ts` via a hardcoded Mac absolute path `/Users/mike/Projects/...`.** Fails on Windows with `ENOENT`. Repro: run full suite on Windows (`npx playwright test --workers=1`). | Test reads the file and passes on all platforms. | `ENOENT: no such file or directory, open '/Users/mike/...'` on Windows. | `e2e/phase8-dashboard.spec.ts` L857-860 — P7 QA INFO-1 carry-forward assertion | tester | RESOLVED 2026-06-14 — changed to `join(__dirname, 'phase7-cases.spec.ts')` (platform-agnostic relative path). |
| P7-002 | 7 | MAJOR | **APP bug — `submitResponse` (and `signSection`) actions fall back to the generic error message for P0xxx custom SQLSTATE rejections.** PostgREST v14.5 returns HTTP 500 `Content-Type: text/plain` "Something went wrong" for custom SQLSTATE errors in the P-class range (P0011 missing-required, P0012 missing-signoff, P0022 not-assignee, etc.). The Supabase JS client cannot extract `error.code` from a plain-text body, so the `switch (error.code)` in `submitResponse`/`signSection` falls through to the `default` case → generic message "Não foi possível concluir. Tente novamente." instead of the specific pt-BR. Repro: fill Form A as staff2.ccih, reach review, DELETE the `dispensador_disponivel` answer via API, click submit — the alert shows the generic message, not "Há perguntas obrigatórias sem resposta. Revise o formulário." Verified: PostgREST v14.5 (`Server: postgrest/14.5`) returns `text/plain` for `raise exception ... using errcode = 'P0011'`. Phase 5 AC6 and Phase 6 AC1/AC3 specs updated to assert the current (generic) message pending this fix. | The specific pt-BR message for each SQLSTATE appears in the UI (P0011 → "Há perguntas obrigatórias…", P0012 → "Há seções…", etc.). | The generic "Não foi possível concluir. Tente novamente." appears for all P-class rejections. | `e2e/phase5-wizard.spec.ts` AC6 (L712), `e2e/phase6-signoffs.spec.ts` AC1/AC3 (L288) — PHASES.md §Phase 5 AC6, §Phase 6 AC3 | **backend** | RESOLVED 2026-06-13 (backend, ADR 0018) — custom codes `P0010`–`P0022` → `HC010`–`HC022` across all three layers — migration `…090009` (`CREATE OR REPLACE` of `submit_response`/`save_section_answers`/`sign_section`; the unshipped Phase-7 migrations carry HC in place), the action constants in `responses`/`cases`/`process-templates` actions, and every pgTAP `throws_ok` expectation. `P0002`/`23505`/`23514`/`42501` unchanged. Verified END-TO-END over the real HTTP path: missing-required submit → `400 application/json {"code":"HC011", "message":"há perguntas obrigatórias sem resposta"}`, missing-signoff → `{"code":"HC012", "message":"há seções pendentes de assinatura"}`; the action `switch` surfaces the SPECIFIC pt-BR (not the generic). Full pgTAP **165/165**; typecheck+lint green. **RE-VERIFIED 2026-06-13 (tester):** Phase 5 AC6 restored to `/Há perguntas obrigatórias sem resposta/i` + `/Revise o formulário/i`; Phase 6 AC1/AC3 restored to `.json()` parse + `HC012` code assertion. Full 81/81 green. |
| SPEC-D1-001 | Case data-model adjustments | MINOR | **Spec defect:** `AC-SecurityStatus` (cases-extras) and `AC-CancelAnytime` (cases-outcomes-blockers) expected `HC025` from `activate_phase` on a terminal case. The plan doc specifies HC025 as the "terminal case frozen" code (used by `guard_case_status` trigger and `cancel_case`/`close_case`). However, `activate_phase` has its own early-exit guard that fires HC020 ("case not open") before the row-level trigger runs. The error code returned from the activate RPC was HC020, not HC025. | Both tests assert `body.code === 'HC020'` (the `activate_phase`-specific code for "case not open / terminal") | Tests asserted `HC025` which is correct for status-trigger writes but NOT for the `activate_phase` early-exit path. 2 tests failed. | `e2e/cases-extras.spec.ts` AC-SecurityStatus L718; `e2e/cases-outcomes-blockers.spec.ts` AC-CancelAnytime L717 | tester | RESOLVED 2026-06-14 — updated both assertions to `HC020`; re-verified; 31/31 current-change-set tests green. |
| SPEC-D1-002 | Case data-model adjustments | MINOR | **Spec defects (3 locator precision issues):** (1) `AC-OutcomeFlow` + `AC-SeedDashboard`: `breakdownSection.getByText(/%$/)` and `breakdownSection.getByText(/Adverso/i)` matched 2 DOM elements each (the large % display + per-row % spans; the "Adverso" badge + "adversos (N/M)" denominator text) → strict mode violations. (2) `AC-OutcomeFilter`: `outcomeCombo.selectOption({ label: /Sem desfecho/i })` passed a regex where Playwright requires a string literal for the `label` option — runtime error "expected string, got object". | Locators scoped to `.first()` where multiple matches are valid; `selectOption` uses exact string `'Sem desfecho'`. | 3 test failures (strict mode violations + runtime type error). | `e2e/cases-outcomes-blockers.spec.ts` AC-OutcomeFlow L435, AC-OutcomeFilter L496, AC-SeedDashboard L770 | tester | RESOLVED 2026-06-14 — added `.first()` on ambiguous text locators; changed selectOption label to string. 5/5 previously-failing tests green. |
| SPEC-D1-003 | Case data-model adjustments | MINOR | **Spec defect:** `AC-OutcomeSelector` (cases-outcomes-blockers) visited the seeded Caso 0001 to test the outcome selector on a non-terminal case. `AC-HappyPath` in phase7-cases.spec.ts concludes Caso 0001 at the end of that test — when the full suite runs in order, AC-OutcomeSelector (which runs AFTER phase7 spec) sees Caso 0001 as `concluido` → `CaseOutcomeSelector` is hidden (`isOpen=false`) → heading and selector not found. Additionally, the `getByLabel('Desfecho do caso')` selector matched both the `<section aria-labelledby>` and the nested `<select aria-label>` → strict mode violation. | `AC-OutcomeSelector` creates its own fresh non-terminal case (independent of seeded case state). `getByRole('region', { name: 'Desfecho do caso' })` used to scope into the section; `outcomeSection.locator('select')` scopes the picker without ambiguity. | 1 test failure ("element not found" after test-ordering contamination; also strict mode on getByLabel). | `e2e/cases-outcomes-blockers.spec.ts` AC-OutcomeSelector L196 | tester | RESOLVED 2026-06-14 — test now creates a fresh case via API and visits that; scoped region locator used. Full 31-test current-change-set run green, then full 126-test suite green. |

| SPEC-P10-001 | 10 | MINOR | **Spec defect — modality uses toggle buttons, not a second `<select>`.** Repro: `dialog.locator('select').nth(1)` in AC1 create-meeting flow. The meeting-form dialog has exactly one `<select>` (meeting type); modality is rendered as aria-pressed toggle buttons. | `dialog.getByRole('button', { name: /Presencial/i }).click()` selects the modality. | Playwright timeout — no second `<select>` found. | `e2e/phase10-meetings.spec.ts` AC1 | tester | RESOLVED 2026-06-15 — removed modalitySelect locator; use toggle-button click instead. |
| SPEC-P10-002 | 10 | MINOR | **Spec defect — "Concluir" button matched multiple elements (lifecycle + action-item buttons).** `getByRole('button', { name: /Concluir/i })` triggered strict mode because action-item "Concluir X" buttons also matched. | Exact match `{ name: 'Concluir', exact: true }` scopes to the lifecycle button only. | Playwright strict mode violation. | `e2e/phase10-meetings.spec.ts` AC1b, AC5a | tester | RESOLVED 2026-06-15 — used `{ name: 'Concluir', exact: true }` throughout. |
| SPEC-P10-003 | 10 | MINOR | **Spec defect — wrong column name `is_active` on `commission_meeting_types`.** PostgREST returned an error body instead of rows when filtering `is_active=eq.false`. The table has an `archived boolean` column (not `is_active`). | Query uses `archived=eq.false`. | PostgREST `400` error body; tests timed out. | `e2e/phase10-meetings.spec.ts` AC4, AC8 | tester | RESOLVED 2026-06-15 — changed all queries to `archived=eq.false`. |
| SPEC-P10-004 | 10 | MINOR | **Spec defect — wrong column name `present_member_count` in `getMeetingRow` helper.** `meetings` table has `present_count` (not `present_member_count`). `getMeetingRow` also queried the non-existent column, causing undefined values in assertions. | Query selects `status,meeting_number,present_count,eligible_member_count,quorum_met`. | `undefined` returned for `present_count`; assertions evaluated against `undefined`. | `e2e/phase10-meetings.spec.ts` AC1, AC1b, AC6, AC8 | tester | RESOLVED 2026-06-15 — changed query to `select=status,meeting_number,present_count,eligible_member_count,quorum_met`. |
| SPEC-P10-005 | 10 | MINOR | **Spec defect — AlertDialog false positive: "Em assinatura" text in dialog description matched before route refresh.** `page.getByText(/Em assinatura/i)` found the string in the open Concluir dialog description ("A reunião passará para 'Em assinatura'...") before the meeting status actually updated. | Wait for `await expect(concluirDialog).not.toBeVisible()` first, THEN assert status text. | Assertion passed vacuously while meeting was still in prior status; test gave a false green. | `e2e/phase10-meetings.spec.ts` AC5a, AC5b | tester | RESOLVED 2026-06-15 — added `not.toBeVisible({ timeout: 25_000 })` on the dialog before checking the status chip. |
| SPEC-P10-006 | 10 | MINOR | **Spec defect — AC4c double-sign RPC error: expected HC035 but received HC033.** With 1 present attendee, `sign_meeting` auto-flips the meeting to `assinada` after the first signature. A second sign attempt then gets HC033 (wrong state — meeting already `assinada`) not HC035 (already signed). | Create a fresh meeting with 2 present attendees; first sign leaves status `em_assinatura`; second sign on the same slot returns HC035. | HC033 returned; assertion `body.code === 'HC035'` failed. | `e2e/phase10-meetings.spec.ts` AC4c | tester | RESOLVED 2026-06-15 — created fresh meeting with 2 seeded attendees (chefe + staff1 CCIH) before the double-sign assertion. |
| SPEC-P10-007 | 10 | MINOR | **Spec defect — `case_events` has no `meeting_id` column.** Query `select=id,kind,meeting_id` caused a PostgREST 400 error; `getCaseEvents` returned an error object instead of an array, so all length assertions evaluated against an object. | Query selects `id,kind,title` only; filter by `kind === 'meeting'`. | PostgREST 400 error body returned as data; `Array.isArray(data)` false; events-presence assertion failed. | `e2e/phase10-meetings.spec.ts` AC1b | tester | RESOLVED 2026-06-15 — changed select to `id,kind,title`; used `kind === 'meeting'` to identify meeting events. |
| SPEC-P10-008 | 10 | MINOR | **Spec defect — sign-dialog attestation text mismatch.** Regex `/declaro que participei/i` did not match. Actual text in `sign-dialog.tsx`: "Ao assinar, você declara que participou da reunião nº…" (third-person past tense). | `/você declara que participou/i` matches the rendered attestation. | Regex match failed; `toContainText` assertion timed out. | `e2e/phase10-meetings.spec.ts` AC2 | tester | RESOLVED 2026-06-15 — updated regex to `/você declara que participou/i`. |
| SPEC-P10-009 | 10 | MINOR | **Spec defect — "Reuniões" nav link accessible name includes badge count.** `{ exact: true, name: 'Reuniões' }` failed because the sidebar renders "Reuniões 1" (pending-sig badge appended to accessible name). | `{ name: /^Reuniões/ }` partial-prefix match resolves regardless of badge value. | Exact-match locator found no element; AC8 navigation step timed out. | `e2e/phase10-meetings.spec.ts` AC8 | tester | RESOLVED 2026-06-15 — changed all sidebar "Reuniões" link locators to `{ name: /^Reuniões/ }`. |
| SPEC-P10-010 | 10 | MINOR | **Spec defect — status filter "Todos" option uses value `"all"`, not `"".`** `statusFilter.selectOption('')` found no matching option; the all-statuses option in `meetings-list.tsx` has value `"all"`. | `statusFilter.selectOption('all')` selects the "Todos" option. | `selectOption('')` threw "No option matching 'value=\"\"' found". | `e2e/phase10-meetings.spec.ts` AC7 | tester | RESOLVED 2026-06-15 — changed to `selectOption('all')`. |
| SPEC-P10-011 | 10 | MINOR | **Spec defect — `[role="alert"]` matched Next.js `__next-route-announcer__` (always present).** `page.locator('[role="alert"]')` used to assert absence of error state; the route announcer always exists with `role="alert"`, so the negative assertion was vacuous. | `page.getByRole('status').filter({ hasText: /erro|error/i })` scopes to real error banners only. | `[role="alert"]` non-zero count even on success; assertion meaningless. | `e2e/phase10-meetings.spec.ts` AC7 | tester | RESOLVED 2026-06-15 — changed to `getByRole('status').filter({ hasText: /erro|error/i })`. |
| SPEC-P10-012 | 10 | MINOR | **Spec defect — quorum section not found via `getByRole('region', { name: /Regra de quórum/i })`.** The section element uses `aria-labelledby` (not `aria-label`), so Playwright's `getByRole('region', { name })` does not match it. | `getByRole('heading', { name: /Regra de quórum/i })` + `page.locator('section').filter({ has: heading })` to scope the section. | Element not found; AC3 quorum-settings step timed out. | `e2e/phase10-meetings.spec.ts` AC3 | tester | RESOLVED 2026-06-15 — changed to heading-based scoping; also added explicit `page.goto('/c/ccih/manage/meetings')` before the quorum step to ensure correct page. |
| SPEC-P10-013 | 10 | MINOR | **Spec typo — `present_member_count` (×2) and 5 unused variable declarations (`STAFF2_CCIH_ID`, `caseLinkerSection`, `timeline`, `url`, `is404`).** Column is `present_count` (matches the `getMeetingRow` return type). Unused vars caused `npm run typecheck` (2 errors) and `npm run lint` (4 warnings) to fail project-wide. Surfaced by the QA-MINOR fix drop that required reconfirming typecheck+lint. | `present_count` throughout; unused declarations removed. | `tsc --noEmit` 2 type errors; ESLint 4 unused-var warnings. | `e2e/phase10-meetings.spec.ts` lines 385-386, 59, 344, 451, 1046, 1048-1054 | tester | RESOLVED 2026-06-15 — corrected column name, removed all unused declarations; `npm run typecheck && npm run lint` clean (0 errors, 0 warnings); full suite 141/141 confirmed on re-confirmation run after `npx supabase db reset`. |
| P11-001 | 11 | BLOCKER | **APP bug — `AttachmentsPanel` (Server Component) passes an inline closure to `ConfirmDeleteButton` (Client Component), crashing the interview detail page.** Repro: sign in as chefe.ccih, navigate to any interview that has ≥1 attachment AND `canEdit=true` (e.g. the seeded interview `f2000000-…-e1` or any interview after a first attachment is added). The page renders "Algo deu errado" (error boundary) instead of the interview detail. Root cause: `src/components/interviews/attachments-panel.tsx` has no `"use client"` directive (it is a Server Component) but passes `() => softDeleteInterviewAttachment(att.id)` — an inline arrow function closing over `att.id` — as the `action` prop to `ConfirmDeleteButton` (`"use client"`). Next.js RSC cannot serialize closures across the Server→Client boundary even when the closure calls a `"use server"` action; only direct server action references (or `.bind()`-created bound actions) are serializable. Fix: replace `() => softDeleteInterviewAttachment(att.id)` with `softDeleteInterviewAttachment.bind(null, att.id)` in `attachments-panel.tsx`. Confirmed by dev-server console error and debug playwright test. Blocks AC1 (after first PDF upload, route refresh crashes page → "Adicionar gravação" button unreachable), AC6 (seeded interview has attachments), AC8 (seeded interview has attachments + canEdit=true). | Interview detail page renders normally for all visitors; all panels (subjects, interviewers, attachments) display correctly. | `Error: Element returned from the Server Component has a function prop. Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server".` Server-side error causes error boundary "Algo deu errado" to replace the interview detail content. | `e2e/phase11-interviews.spec.ts` AC1 (L386 timeout after PDF upload), AC6 (L829 heading not found), AC8 (L940 heading not found) — Phase 11 AC happy path, panel visibility | **frontend** | RESOLVED 2026-06-15 (frontend) — `attachments-panel.tsx:129` now passes `softDeleteInterviewAttachment.bind(null, att.id)` (serializable bound server action) instead of the inline closure, with an explanatory comment. **Audit done across `src/components/interviews/**`:** the crash only occurs when a SERVER component passes a closure to a `"use client"` child; scanned all 4 interviews Server Components (`attachments-panel`, `interview-badges`, `interview-header`, `interviews-panel`) — `attachments-panel` was the ONLY offending site (the other three pass no closure-action props). The remove/delete closures in `subjects-panel.tsx`/`interviewers-panel.tsx`/`interview-lifecycle-actions.tsx` are SAFE and unchanged — those files are `"use client"`, so their closures are created+consumed inside the client bundle and never cross the RSC boundary. `npm run typecheck && npm run lint` clean. Ready for tester re-run. |
| P10-LATENT-001 | 10 | MAJOR | **APP bug (latent, found during the P11-001 audit) — meetings `AttachmentsPanel` (Server Component) passes an inline closure to `ConfirmDeleteButton` (Client Component), crashing the meeting detail page on the delete-with-attachments path.** Same class as P11-001: `src/components/meetings/attachments-panel.tsx` is a Server Component (no `"use client"`) but passed `() => deleteMeetingAttachment(att.id)` — an inline closure over `att.id` — as the `action` prop to `ConfirmDeleteButton` (`"use client"`). RSC cannot serialize a closure across the Server→Client boundary even when it wraps a `"use server"` action; the meeting detail page would crash to the error boundary whenever `canEdit === true` AND the meeting has ≥1 attachment. Never exercised by a Phase 10 spec (no delete-with-attachments assertion), so it slipped through Phase 10 green. Surfaced by the Phase 11 cross-feature audit (the interviews panel was cloned from this one). | Meeting detail page renders normally and the attachment soft-delete works when a coordinator views a meeting that has attachments. | (Latent — not reproduced via a spec; identical mechanism to P11-001, which WAS reproduced: `Functions cannot be passed directly to Client Components…` → error boundary "Algo deu errado".) | `src/components/meetings/attachments-panel.tsx` (no Phase 10 spec covered this path) | **frontend** | RESOLVED 2026-06-15 (frontend) — `attachments-panel.tsx:103` now passes `deleteMeetingAttachment.bind(null, att.id)` (serializable bound server action) with an explanatory comment. **Audit of `src/components/meetings/**` Server Components:** `attachments-panel`, `meeting-badges`, `meeting-header`, `meeting-settings-view`, `signatures-panel` — `attachments-panel` was the ONLY offending site (the other four pass no closure-action props). Client-component delete/lifecycle closures (`attendees-panel`, `agenda-panel`, `case-linker`, `action-items-panel`, `meeting-lifecycle-actions`, etc.) are SAFE and unchanged (closures stay inside the client bundle). `npm run typecheck && npm run lint` clean. Fixed in-pass to freeze the tree before the single green regression run. |
| SPEC-P11-001 | 11 | MINOR | **Spec defect — `rascunho` status badge selector used CSS class names (`badge`/`chip`) which don't exist in `InterviewStatusBadge`.** The badge renders as a plain `<span>` with colour-token classes, not `badge` or `chip` class names. | `page.getByText('Rascunho', { exact: true })` matches the badge text directly. | `locator('[class*="badge"], [class*="chip"]').filter({ hasText: /rascunho/i })` found no elements; AC1 failed at step 6. | `e2e/phase11-interviews.spec.ts` AC1 L344 | tester | RESOLVED 2026-06-15 — changed to `getByText('Rascunho', { exact: true })`. |
| SPEC-P11-002 | 11 | MINOR | **Spec defect — `getByRole('button', { name: /Editar/i })` triggered strict mode violation.** After adding 2 subjects and 2 interviewers, there are per-row "Editar X" icon buttons (aria-label "Editar Enfermeira CCIH Dois", "Editar Dr. Externo Sujeito", etc.) in addition to the main "Editar" header button — 5 elements matched. | `getByRole('button', { name: 'Editar', exact: true })` matches only the main "Editar entrevista" button. | Playwright strict mode violation; AC1 and AC2a both failed. | `e2e/phase11-interviews.spec.ts` AC1 L348, AC2a L501 | tester | RESOLVED 2026-06-15 — changed to `{ name: 'Editar', exact: true }` in both AC1 and AC2a. |
| SPEC-P11-003 | 11 | MINOR | **Spec defect — `signOut` timed out in AC3 (foreign-commission 404 has no account-menu button).** After chefe.farm navigated to the CCIH commission URLs (which render a global 404 page with no commission shell), the `signOut` helper's `getByRole('button', { name: /abrir menu da conta/i })` found no element — the global 404 page has no app shell. | Navigate to chefe.farm's own commission (`/c/farmacia`) before calling `signOut` so the shell is present. | `locator.click` timeout: "waiting for getByRole('button', { name: /abrir menu da conta/i })" — AC3 test timeout. | `e2e/phase11-interviews.spec.ts` AC3 L643 | tester | RESOLVED 2026-06-15 — added `page.goto('/c/farmacia')` + `waitForURL` before `signOut`. |
| SPEC-P11-004 | 11 | MINOR | **Spec defect — AC5 keyboard Tab count was wrong: `datetime-local` inputs expose multiple internal sub-fields (month, day, year, hour, minute = 5+ Tab stops each) and a phase `<select>` is also present for the coordinator.** Fixed Tab count via a loop that Tabs until the submit button is focused (max 40 iterations). | The submit button is reachable by repeated Tab from the title input. | `toBeFocused()` failed because the hardcoded Tab count missed multiple internal date-field stops and the phase `<select>`. | `e2e/phase11-interviews.spec.ts` AC5 L785-788 | tester | RESOLVED 2026-06-15 — replaced hardcoded Tab count with a loop checking `document.activeElement` per Tab press (max 40). |
| SPEC-P11-005 | 11 | MINOR | **Spec defect — AC6 back-link assertion was a false green: regex `/caso\s*\d+|↩.*caso/i` matched the sidebar "Casos 1" nav link, not the interview header back-link.** The interview detail page was crashing (app bug P11-001), so the interview heading was never rendered; the only matching link was the sidebar item. Added explicit `getByRole('heading', { level: 1 })` assertion before the back-link check to ensure the interview page rendered, then scoped the back-link locator to `page.locator('header').first()` to exclude the sidebar. | `interviewHeader.getByRole('link', { name: /caso\s*\d+/i })` is visible only when the interview detail page fully renders. | Back-link assertion matched the sidebar nav; AC6 gave a false green even when the interview detail page crashed. | `e2e/phase11-interviews.spec.ts` AC6 L827-829 | tester | RESOLVED 2026-06-15 — added h1 heading assertion before back-link check; scoped back-link locator to `header` element. (AC6 now correctly FAILS until P11-001 is fixed.) |
| SPEC-P11-006 | 11 | MINOR | **Spec defect — AC1 step 13 (cancel a separate interview) relied on the seeded interview being in `em_andamento` state.** When the full suite runs after an isolated Phase-11 run without a `db reset` in between, the seeded interview was already `cancelada` (left by the previous run's AC1 step 13). The `text=Em andamento` assertion at step 13 failed. Root cause: the test shared DB state with a prior run via the seeded fixture instead of creating an independent interview for the cancel step. | AC1 creates its own fresh interview to cancel (creates via RPC and navigates to it); seeded interview state is irrelevant. | `locator('text=Em andamento').first()` timed out — seeded interview was `cancelada` from a prior run. | `e2e/phase11-interviews.spec.ts` AC1 L433 | tester | RESOLVED 2026-06-15 — replaced seeded-interview cancel with a fresh interview created via `create_interview` RPC; also removed the now-unused `goToSeededInterview` helper. |
| SPEC-P13-001 | 13 | MINOR | **Spec defect — AC-3f admin commission-B name assertion matched a hidden `<select>` `<option>` instead of the visible feed row.** `page.getByText(/Farmácia e Terapêutica/i).first()` resolved to the `<option selected>` in the commission filter (which is `hidden`), so `toBeVisible()` failed even though the admin commission-B feed rendered 27 rows each showing "Comissão de Farmácia e Terapêutica" in the row card. | Scope the commission-name assertion to the feed: `feed.getByText(/Farmácia e Terapêutica/i).first()`. | `toBeVisible()` failed: locator resolved to the hidden `<option>` (`13 × locator resolved to <option …>` / "Received: hidden"). | `e2e/phase13-audit.spec.ts` AC-3f — PHASES.md §Phase 13 AC "admin sees all (incl. commission-B + global rows)" | tester | RESOLVED 2026-06-17 — scoped the locator to the feed `<ol>`; re-verified green. |
| SPEC-P13-002 | 13 | MINOR | **Spec defect — AC-5b action filter asserted `signoff.recorded` exists in commission A, but all 10 seeded sign-off audit rows live in commission B.** The seed's sign-offs are on Form B / staff1.farm responses (commission Farmácia); CCIH's chain carries zero `signoff.recorded` rows, so filtering the CCIH audit view by that action produced an empty feed and the `toBeVisible()` on the feed list failed. | Filter by an action that exists in CCIH's chain (`commission_member.added`) and assert every card shows "Membro adicionado" + the filtered count ≤ unfiltered. | Feed list `not found` — CCIH has no `signoff.recorded` rows (DB truth: all 10 are `commission_id = b…b1`). | `e2e/phase13-audit.spec.ts` AC-5b — PHASES.md §Phase 13 AC "actor/action/date filters change results" | tester | RESOLVED 2026-06-17 — switched the filtered action to `commission_member.added`; re-verified green. |
| SPEC-P13-003 | 13 | MINOR | **Spec defect — AC-7b `getByRole('alert')` toHaveCount(0) matched the Next.js Dev Tools `alert` element (dev-server artifact), not an app tamper alert.** On an intact chain the integrity verdict correctly renders as `role="status"` ("Integridade verificada…"); the failed assertion was the broad global-`alert` count, which the running dev server's "Open Next.js Dev Tools" indicator (`alert [ref=e1079]`) always satisfies with count 1. | Assert the OK verdict via the `role="status"` region AND that the broken-chain text is absent (`page.getByText(/falha de integridade/i)).toHaveCount(0)`), instead of a global `role="alert"` count. | `toHaveCount(0)` failed: `getByRole('alert')` resolved to 1 (the Next.js Dev Tools alert), unrelated to the integrity control. | `e2e/phase13-audit.spec.ts` AC-7b — PHASES.md §Phase 13 AC "verificar integridade on an intact chain shows the OK state" | tester | RESOLVED 2026-06-17 — replaced the global-alert check with a "no failure-verdict text" assertion; re-verified green. |
| P11-MINOR-1 | 11 | MINOR | **QA finding — attachment upload UI more restrictive than the server/ADR contract post-conclusion.** The interview detail page (`src/app/c/[slug]/manage/cases/[caseId]/interviews/[interviewId]/page.tsx`) passed `canEditContent = canWrite && isEditableInterviewStatus(status)` to `AttachmentsPanel`; since `isEditableInterviewStatus` is false for `concluida`, the upload / add-link / soft-delete controls disappeared once concluded. But ADR 0026 deliberately EXCLUDES `case_interview_attachments` from the conclusion content-freeze (`add_interview_attachment` has no status check — the server accepts a late signed transcript after conclusion), so the UI forced an unnecessary reopen/re-conclude ceremony. | A concluded interview still shows upload/add-link/soft-delete (only `cancelada` hides them), matching the RLS/RPC layer + ADR 0026. | Upload/add-link controls hidden on `concluida`; coordinator had to reopen to attach a late transcript. | `src/app/c/[slug]/manage/cases/[caseId]/interviews/[interviewId]/page.tsx` (no spec — QA code review) | **frontend** | RESOLVED 2026-06-15 (frontend) — introduced a separate `const canManageAttachments = canWrite && interview.status !== "cancelada"` and pass it ONLY to `AttachmentsPanel`'s `canEdit`; `canEditContent` (unchanged) still gates the summary editor + participant panels + lifecycle actions. `AttachmentsPanel` needed no change (already gates on its `canEdit` prop). `npm run typecheck && npm run lint` clean. Tester to re-confirm green + add an assertion that upload stays available on a concluded interview. |
| P13-004 | 13 | MAJOR (spec) | **Spec-isolation defect — `phase13-audit.spec.ts` mutates SHARED SEEDED fixtures, contaminating the full serial suite.** The lead's full-suite run (`--workers=1`, fresh reset) returned **186 passed / 9 failed**. `phase13` sorts before `phase2/5/6/7` and after `phase10`, and the six AC-1 mutation tests drive destructive writes on shared seeds: **AC-1b** adds `staff1.farm`→CCIH (breaks `phase2` staff1.farm landing — now multi-commission→picker); **AC-1a** republishes `FORM_A_VER` + **AC-1c** submits/consumes the seeded in-progress draft (breaks `phase5` AC3/AC5/AC7); **AC-1d** signs `b004` on seeded `RESP_E1` (breaks `phase6` AC2/AC4 — e1 leaves the queue); **AC-1e** activates Caso 0001 phase 2 (breaks `phase7` AC-HappyPath/AC-DueDays — already `ativa`); **AC-1f** is contaminated BY `phase10`, which advances seeded `MEETING_1` past `realizada` (its own `conclude_meeting` fails). **0 application bugs** — feature proven by pgTAP 374/374 + scoped 26/26 + lead DB-layer security review. | Each AC-1 mutation test operates on its OWN disposable fixture (fresh form/member-target/response/case/meeting), so it's independent of seed pristine-state AND non-destructive to downstream specs. Full suite green serially. Repo precedent: SPEC-D1-003. | Full-suite serial run = 186/9; the 9 victims pass alone (historically 169/169) — pure cross-spec contamination. | `e2e/phase13-audit.spec.ts` AC-1a–f — CLAUDE.md §6 gate-2 (full suite declares green) | tester | RESOLVED 2026-06-18 — all six AC-1 tests now operate on disposable fixtures (fresh form/commission/response/signoff-section/case/meeting per test; `staff2.ccih`/…004 used as the AC-1b probe target — no phase2/5/6/7 landing assertions for that user). A secondary spec defect surfaced during subset re-run: AC-1d's disposable form left an in-progress response for `staff1.ccih`, causing `phase5-wizard.spec.ts` AC3's `getByRole('link', { name: /continuar preenchimento/i })` to match 2 elements (strict mode). Fixed in `e2e/phase5-wizard.spec.ts` AC3: scoped the `continuar` locator to the `<article>` containing "Higienização das Mãos" (the seeded form card), resolving strict mode without changing the assertion intent. **Subset re-run (fresh `supabase db reset`, `--project=chromium --workers=1`): `phase13-audit` + `phase2-auth-shell` + `phase5-wizard` + `phase6-signoffs` + `phase7-cases` = 85/85 passed.** Lead still owes the full-suite serial green run. |
| P13-005 | 13 | MAJOR (spec) | **Residual spec-isolation — AC-1 probe commissions add `chefe.ccih` as staff_admin of throwaway commissions in CCIH (probe commissions pollute the CCIH board/form state and audit RLS visible-set).** Root: AC-1a/1c/1d created forms/responses in COMMISSION_A (CCIH), which appears in the CCIH forms list/board — contaminating phase7/8 board/form-count assertions (full suite: 187/8, all phase7). Additionally AC-3a asserted "every visible row = COMMISSION_A" which breaks when probe commissions for AC-1 add chefe.ccih as staff_admin there. Additionally AC-6 queried `audit_log?action=eq.commission_member.added` without scoping to `COMMISSION_A`, over-counting probe-commission member rows chefe.ccih now has RLS visibility to. | AC-1a/1c/1d/1e operate in per-test throwaway commissions (created via service key). AC-1e builds a full disposable template+form+case in the probe commission instead of using the CCIH seeded template. AC-3a assertion corrected to "no COMMISSION_B row visible" (the actual security invariant). AC-6 DB query scoped to `commission_id=eq.COMMISSION_A` to match the CSV's commission scope. | Lead's full-suite run: 187/8, all phase7. Per-spec isolation run showed AC-3a failing on probe-commission rows and AC-6 mismatch (32 DB vs 4 CSV). | `e2e/phase13-audit.spec.ts` AC-1a/1c/1d/1e; AC-3a; AC-6 — CLAUDE.md §6 gate-2 | tester | RESOLVED 2026-06-18 — all spec defects fixed: (1) `makeProbeCommission` helper added; AC-1a/1c/1d/1e rewritten to throwaway commissions; (2) AC-3a assertion corrected from `=COMMISSION_A` to `not.toBe(COMMISSION_B)`; (3) AC-6 DB query scoped with `commission_id=eq.${COMMISSION_A}`. **Broader subset (fresh `supabase db reset`, chromium --workers=1): `phase13-audit + phase3-admin-members + phase4-builder + phase5-wizard + phase6-signoffs + phase7-cases + phase8-dashboard` = 106/106 passed.** Lead to run full suite for gate-2 green declaration. |

| P13-006 | 13 | MAJOR (spec) | **Residual spec-isolation — `makeProbeCommission` uses SEEDED users (`chefe.ccih`, `staff2.ccih`) as probe actors, making them multi-commission, breaking phase2 single-commission landing + phase3 boundary assertions.** Root: the P13-005 fix moved AC-1 content into throwaway commissions but still passed seeded user IDs to `makeProbeCommission`. When seeded users are added to ANY extra commission they become multi-commission: phase2:68 (chefe.ccih lands on picker, not /c/ccih), phase2:207 (staff_admin nav differs for multi-commission users), phase3:294 (chefe.ccih → /c/farmacia no longer 404 — they are now a member of probe commissions). The 106-test broader subset missed it because phase2 was excluded. | All probe actors (staff_admin + staff role in probe commissions) must be FRESH THROWAWAY USERS created via the Supabase auth admin API (`POST /auth/v1/admin/users`, `email_confirm: true`). Seeded personas are never added to any extra commission. | Lead's full-suite run: 192/3, failures in phase2:68/207 and phase3:294. | `e2e/phase13-audit.spec.ts` AC-1a/1c/1d/1e; `makeProbeCommission` — CLAUDE.md §6 gate-2 | tester | RESOLVED 2026-06-18 — `makeProbeUser` helper added (POST to `/auth/v1/admin/users`, unique `probe-${label}-${Date.now()}@probe.local` email, `email_confirm: true`; returns `{ userId, email }`). AC-1a/1c/1d/1e each create their own fresh throwaway staff_admin + staff (where needed) via `makeProbeUser`. AC-1b actor = admin (global, safe); member also switched to fresh throwaway user. AC-1f unchanged (creates a fresh CCIH meeting as chefe.ccih — the seeded CCIH membership is not changed). AC-3a comment updated (probe commissions no longer add chefe.ccih; `not.toBe(COMMISSION_B)` invariant unchanged). **Complete subset (fresh `supabase db reset`, chromium --workers=1): `phase13-audit + phase2-auth-shell + phase3-admin-members + phase4-builder + phase5-wizard + phase6-signoffs + phase7-cases + phase8-dashboard` = 131/131 passed.** Lead to run full suite for gate-2 declaration. |

| P14a-003 | 14a | BLOCKER | **App bug — `mapSafetyEvent` in `src/lib/queries/safety-events.ts` checks `r.event_patient?.length` to derive `hasPatient`, but PostgREST returns the one-to-one `event_patient` join as a SINGLE OBJECT (not an array) because `event_id` is both PK and FK on `event_patient`.** An object has no `.length`, so `(r.event_patient?.length ?? 0) > 0` always yields `false` → `hasPatient = false` → the detail page skips `getEventPatient` entirely → `PatientPanelEmpty` renders for every event (even those with a PHI row) → no `event_patient.read` audit row is ever written (HIPAA gap). Repro: `GET /rest/v1/patient_safety_event?id=eq.{EV1_ID}&select=id,event_patient(event_id)` as admin returns `"event_patient": {"event_id": "…"}` (object), not `[{"event_id": "…"}]` (array). Fix in `safety-events.ts`: change `hasPatient: (r.event_patient?.length ?? 0) > 0` → `hasPatient: r.event_patient != null`; also update the `SafetyEventRow` interface so `event_patient` is typed as `{ event_id: string } \| null` (not an array). | PHI panel always shows "Nenhum dado de paciente" — PHI is never rendered; `event_patient.read` audit rows are never written (HIPAA: PHI access goes unlogged). | AC-4a: "Dados sensíveis" badge absent, patient name/MRN absent from page. AC-4b: `after.length === before.length` (0 new audit rows). Confirmed via direct PostgREST query returning object shape. | `e2e/phase14a-safety-events.spec.ts` AC-4a + AC-4b; accreditation-track.md §14a PHI-reads-in-scope + PHI-read-audit ACs; Architecture Rule 12 | **backend** | ✅ RESOLVED 2026-06-18 (backend) — `safety-events.ts`: `hasPatient: r.event_patient != null` + `SafetyEventRow.event_patient: { event_id: string } \| null` (object, not array). **Scanned both `safety-events.ts` + `pqs.ts` for the same 1:1-embed-as-array trap: NONE remaining** — every other embed (`reporting_commission`/`owner_commission`/`reporter`/`acknowledger`/`closer`/`cases`/`assigner`) is many-to-one (FK on the row → single object) and already typed `{…}\|null`; `event_custody` reads the base table (array of rows, correct); `pqs.ts` has no embeds (flat RPC). Live-smoke confirmed: EV-0001 embed → `{"event_id":"…"}` (object → `hasPatient=true`), EV-0002 → `null` (→ false). typecheck 0 / lint 0. |

| P14a-002 | 14a | BLOCKER | **App bug — `src/lib/queries/safety-events.ts` imports `@/lib/supabase/server` (which uses `next/headers`) but is also imported by `event-notify-form.tsx` (a `"use client"` component), causing a Turbopack module-bundling error that crashes the `/login` page with HTTP 500.** Import chain: `event-notify-form.tsx` → `safety-events.ts` → `@/lib/supabase/server` → `next/headers`. Because `safety-events.ts` sits in both the server and client module graphs simultaneously, Next.js cannot bundle it, and **the `/login` page itself returns 500** — blocking all tests that call `signInAs()`. Repro: dev server running + `curl http://localhost:3000/login` → HTTP 500 with error "You're importing a module that depends on 'next/headers'. This API is only available in Server Components." | `/login` returns HTTP 500; ALL spec tests fail at `signInAs()` step. | `src/components/safety/event-notify-form.tsx` imports from `src/lib/queries/safety-events.ts`; `safety-events.ts:27` imports `@/lib/supabase/server`. `curl http://localhost:3000/login` returns HTTP 500 with "next/headers" bundling error. | `e2e/phase14a-safety-events.spec.ts` (all ACs) — blocks Phase 14a gate | **backend / frontend** | ✅ RESOLVED (2026-06-18) — Backend extracted client-safe `src/lib/safety/types.ts` (ZERO imports; all 22 safety domain types + label maps + action input/result shapes); `safety-events.ts`/`pqs.ts`/`actions.ts` re-export for back-compat. Frontend repointed all 9 client-graph safety components from `@/lib/queries/{safety-events,pqs}` → `@/lib/safety/types`. `curl /login` = 200; `npm run build` ✓; typecheck + lint clean. |

| CN-SPEC-001 | Case Narratives | MINOR | **Spec defect — AC-2b and AC-7 used `ul.grid` / `ul.grid li` to scope the events list, but `EventsList` renders a `<table>`, not a `<ul class="grid">`.** Repro: `page.locator('ul.grid').getByText(/reconhecido/i)` found nothing (no `ul.grid` in DOM); `page.locator('ul.grid li').count()` returned 0. Expectation: AC-2b asserts EV-0001 shows "Reconhecido" chip; AC-7 asserts ≥1 rows after clearing a filter. **Root cause:** spec written before the final component design settled — `EventsList` renders `<table><tbody><tr>` rows, not grid cards. Fix: change AC-2b locator to `page.locator('table tbody').getByText(/reconhecido/i).first()` (scopes to table body, avoids matching the hidden `<option>` in the status filter `<select>`); change AC-7 `ul.grid li` count to `table tbody tr` count. Spec-only defect; no application code involved. | `ul.grid` contains "Reconhecido" chip visible; `ul.grid li` count ≥ 1. | Locators found nothing; both AC-2b and AC-7 timed out. | `e2e/phase14a-safety-events.spec.ts` AC-2b (L287–288), AC-7 (L530) — Phase 14a AC-2b + AC-7 | tester | RESOLVED 2026-06-19 — changed AC-2b to `page.locator('table tbody').getByText(/reconhecido/i).first()`, changed AC-7 to `page.locator('table tbody tr').count()`; re-verified 2/2 green in isolation; full suite 270/270 green (final gate run). |

| CA-002 | Case Access Control | MAJOR | **App bug — `canEditNarrative` in `src/components/cases/narrative-access.ts` returns `false` for the narrative ASSIGNEE when they only have attribution-derived READ (no write grant).** The function checks `!caps.canWriteContent → return false` at line 29 BEFORE reaching the `narrative.assignedTo === viewerId` check at line 32. ADR 0033 D4/Q14 is unambiguous: narrative write = coordinator/admin **OR** the narrative's `assignedTo` **OR** (`canWriteContent` AND `assignedTo IS NULL`). The assignee gate must fire independently of `canWriteContent`. Repro: sign in as `staff2.ccih@test.local` (narrative assignee, attribution-derived read only, no write grant) and navigate to `/c/ccih/casos/d…c1/narrativa/<resumo-id>` — the page renders the body in read-only markdown, no textarea, no Salvar. Confirmed: the DB predicate `app.can_write_case_narrative` at line 160 of `20260619110001_case_access_predicates_rls.sql` is CORRECT (`v_assigned_to is not null and v_assigned_to = p_uid` fires before any `can_write_case_content` check). Only the TypeScript mirror is wrong. Fix: in `canEditNarrative`, move the assignee check to BEFORE the `!canWriteContent` early-return: `if (viewerId != null && narrative.assignedTo === viewerId) return true`. | Narrative assignee (`staff2`) sees a textarea + Salvar + Concluir buttons on the focused editor page. | Editor renders read-only (body as markdown paragraphs, no textarea); Salvar absent; Concluir absent. `canEdit` prop passed as `false` to `NarrativeEditor`. | `e2e/case-access.spec.ts` AC-4 (staff2 half); plan §5 AC-4; ADR 0033 D4/Q14 | **frontend** | RESOLVED 2026-06-19 (frontend), commit `e913efe` — reordered the WHO checks in `canEditNarrative` to mirror `app.can_write_case_narrative` EXACTLY: coordinator/admin → any; **assignee → their own narrative regardless of `canWriteContent` (the bug);** write-grantee → un-attributed only. The WHETHER checks (`caseOpen` + `status === 'aberta'`) are unchanged and kept above the WHO block. Traced both halves of AC-4: `staff2` (assignee, attribution-only) → `true`; `staff3` (write-grantee) on staff2's narrative → `false`, on an un-assigned one → `true`; coordinator → `true`. `npm run typecheck` exit 0; `src/` lint clean. Single-file change. Ready for tester re-run (AC-4 + the AC-4..10 resume). |
| CA-001 | Case Access Control | BLOCKER | **App bug — `get_case_detail` is declared `STABLE` but calls `public.log_audit_access` (which does an INSERT into `audit_log`). PostgreSQL rejects any INSERT inside a `STABLE` function, returning `{"code":"25006","details":null,"hint":null,"message":"cannot execute INSERT in a read-only transaction"}`. Repro: sign in as any non-coordinator with access to Caso 0001 (staff1, staff2, multi, staff3); navigate to `/c/ccih/casos/d0000000-0000-0000-0000-0000000000c1`; page shows Erro 404 instead of the case detail. Confirmed via direct RPC call: `POST /rest/v1/rpc/get_case_detail` with staff1.ccih bearer token → HTTP 500, `"message":"cannot execute INSERT in a read-only transaction"`. Root cause is in migration `20260619110002_case_access_rpcs.sql` L507: `create or replace function public.get_case_detail(p_case_id uuid) returns jsonb language plpgsql STABLE …` — the `STABLE` volatility marker makes PostgreSQL treat the function as read-only. The audit emit (`perform public.log_audit_access(…)`) on line 547 is an INSERT which PostgreSQL refuses inside a STABLE function. Fix: change `STABLE` → `VOLATILE` on `get_case_detail` (the function already was `VOLATILE` in earlier increments; the Case Access increment's `CREATE OR REPLACE` accidentally added `STABLE` which was appropriate for the pre-audit version but not the audit-emitting one). All non-coordinator case opens return 404 until fixed. | Non-coordinator (attributed or granted) opens the case detail page; `get_case_detail` runs without error, emitting a `case.opened` audit row and returning the full case JSON. | `get_case_detail` RPC fails with PostgreSQL code 25006 "cannot execute INSERT in a read-only transaction"; the Next.js route receives `null` from `getCaseDetail()` and calls `notFound()`, rendering Erro 404. Blocks AC-1, AC-3 (read/write grantees), AC-4, AC-6, AC-7, AC-8, AC-10. | `e2e/case-access.spec.ts` AC-1 (first failure); plan §5 ACs 1/3/4/6/7/8/10; ADR 0033 D8; Architecture Rule 11 | **backend** | ✅ RESOLVED (2026-06-19, backend) — changed `get_case_detail` `STABLE` → `VOLATILE` in migration `…110002` (the audit write side-effect requires it; same as the `event_patient.read` audited read). Verified end-to-end: `POST /rest/v1/rpc/get_case_detail` as `multi@test.local` (read-grantee) → **HTTP 200** + full payload (was 25006/500); exactly one `case.opened` audit row written, attributed to the opener; coordinator opens write none. **Scanned the other two re-gated reads** — `list_my_cases` + `case_viewer_capabilities` are pure reads (no writes), correctly `STABLE`; `get_case_detail` is the only audited read. **Permanent regression guard** added to `144_case_access.sql`: asserts `provolatile='v'` for `get_case_detail` (+ `'s'` for the two pure reads) AND that a non-coordinator open succeeds + writes exactly one `case.opened` row (coordinator writes none). Full pgTAP **619/619**; local `db reset` clean; typecheck clean. No remote push. |
| P14a-001 | 14a | BLOCKER | **App bug — Phase-14a B1 stub `patientSafetyEnabled()` throws `'not implemented (B5)'` and is wired into `c/[slug]/layout.tsx`, crashing EVERY commission page with HTTP 500.** `src/lib/queries/pqs.ts` exports `patientSafetyEnabled()` as a stub that unconditionally throws. `src/app/c/[slug]/layout.tsx` (modified as part of Phase-14a B1 work) now calls it at render time. Every commission page (`/c/ccih/**`, `/c/farmacia/**`) returns HTTP 500, crashing all commission UI tests (phase2/5/6/7/8/10/11/12 UI tests + phase13 AC-3d/3e/3f/4a/4c/4d/5a-d/6/7b/8). Repro: any navigation to `/c/ccih/manage/audit` (or any commission page) → "This page couldn't load. A server error occurred." with digest `2374292383`. Dev server log: `Error: not implemented (B5) at patientSafetyEnabled (src/lib/queries/pqs.ts:74:9) at CommissionLayout (src/app/c/[slug]/layout.tsx:50:25)`. | `patientSafetyEnabled()` must return `false` (safe default) until B5 implements it, OR the layout must guard with try/catch and default to false. | All commission pages return HTTP 500; all commission UI E2E tests fail. | `src/lib/queries/pqs.ts:74`, `src/app/c/[slug]/layout.tsx:50` — blocks ALL UI E2E including Phase-13 gate-2 closure | **backend / frontend** | ✅ RESOLVED (2026-06-18, backend) — `patientSafetyEnabled()` now `return false` (a feature-flag reader must safe-default; `false` is also the correct pre-B4 state — the `patient_safety` flag is OFF until the B4 flip, so the 14a UI correctly stays gated-off/404). Other pqs/safety stubs still throw `'not implemented (B5)'` (no safe default). `npm run typecheck` 0 errors + `npm run lint` exit 0. B5 wires it to the real `public.patient_safety_enabled()` DEFINER RPC, mirroring `auditTrailEnabled()` error→false. |

| CN-SPEC-AC3 | Case Narratives | MINOR | **Spec defect — `AC-3` (case-narratives) used `mergedSection.getByText(/Paciente do leito 7/i)` without `.first()`, triggering strict mode.** Repro: full suite run (workers=1) after the Phase-22 referrals seed was applied. The seeded `Caso 0001` has TWO text nodes matching `/Paciente do leito 7/i`: the `Resumo Clínico` narrative body (seed line 627) AND the referral snapshot body (`Resumo clínico`, seed line 1097). In a per-spec or pre-Phase-22 run only the narrative body existed, so the locator resolved to exactly one element. The Phase-22 seed adds the referral snapshot, making the locator ambiguous. Root: the spec was written before Phase-22 seed was committed; the Phase-22 gate passed (it still had AC-1/cascade skipping AC-3 under the stale build). | `mergedSection.getByText(/Paciente do leito 7/i).first()` resolves to the filled narrative body (visible and correct). | Playwright strict mode: `"strict mode violation: getByText(/Paciente do leito 7/i) — resolved to 2 elements."` | `e2e/case-narratives.spec.ts` AC-3 L454 — Phase-CN AC-3 acceptance clause "seeded text visible in merged layout" | tester | RESOLVED 2026-06-22 — added `.first()` to locator + explanatory comment; re-verified ok in isolation and in final gate run. |

| CA-SPEC-AC3a | Case Access Control | MINOR | **Spec defect — `AC-3a` (case-access) used `page.getByRole('region', { name: /Resumo Clínico/i })` without `.first()`, triggering strict mode.** Repro: full suite after Phase-22 referrals seed. `Caso 0001` now has both (a) the actual `Resumo Clínico` narrative rendered as `<section aria-labelledby="narrative-…-heading">` and (b) the referral snapshot block (seed line 1096) also rendered as a region with `display_name='Resumo clínico'`. In earlier suites, case-access AC-1 was the first failure and cascaded a skip to AC-3a; in the current run with a fresh build, AC-1 passes and AC-3a is reached for the first time with two matching regions. | `page.getByRole('region', { name: /Resumo Clínico/i }).first()` resolves to the narrative region (visible, correct). | Playwright strict mode: `"strict mode violation: getByRole('region', { name: /Resumo Clínico/i }) — resolved to 2 elements."` | `e2e/case-access.spec.ts` AC-3a L293 — Case-Access AC "read-grantee sees all narrative slots" | tester | RESOLVED 2026-06-22 — added `.first()` to locator + explanatory comment; re-verified ok in isolation and in final gate run. |

| SPEC-P8-002 | 8 | MINOR | **Spec defect — `AC-4` (phase8-dashboard) used a hardcoded "yesterday" date that becomes stale when ≥2 days elapse since the last `db reset`.** Repro: run the full suite on any day where `current_date > last_db_reset_date + 1`. The seeded Form-A responses have `submitted_at = now() - i days` (i=1..6) AT THE TIME OF reset. When "yesterday" = `reset_date + 1+` the date range contains zero seeded responses; the dashboard renders "Ainda não há respostas enviadas" with no form-picker tablist; the `getByRole('tablist', { name: /form/i })` assertion times out. The Phase-22 gate passed because the reset was < 2 days before the gate run; the case_patient gate (2 days later) failed. | The test computes the filter range from the actual most recent `submitted_at` via a service-key query; the filter selects ≥1 response and the headline count is < 6. | `getByRole('tablist', { name: /form/i })` timeout after 15 s — form picker absent when date range yields 0 responses. | `e2e/phase8-dashboard.spec.ts` AC-4 L312 — Phase 8 AC "date filter narrows results" | tester | RESOLVED 2026-06-22 — replaced hardcoded `yesterday` calculation with a PostgREST query for the two most-recent Form-A `submitted_at` values; uses `newestDate` as the single-day filter anchor; assertion updated to `< 6` (same invariant, now drift-resistant). SPEC-P8-002 logged for tracking. Re-verified AC-4 ok in isolation (1/1 pass); included in final gate run. |

| CA-SPEC-AC6 | case_patient / case-access | MINOR | **Spec defect — `case-access` AC-6 uses `page.getByRole('region', { name: /resumo clínico/i })` without `.first()`, triggering strict mode.** Repro: full suite after Phase-22 referrals seed applied. Caso 0001's coordinator manage page renders TWO sections whose accessible name matches `/resumo clínico/i` (case-insensitive): (1) the Resumo Clínico case narrative (uppercase C); (2) the referral snapshot from ENC-0001 with `display_name='Resumo clínico'` (lowercase c). Both live INSIDE the "Fases e narrativas do caso" container. Strict mode violation when `.first()` was applied. Correct fix: use exact case-sensitive string match `'Resumo Clínico'` (uppercase C) via `getByRole('region', { name: 'Resumo Clínico', exact: true })` — Playwright `exact: true` with a string literal performs case-sensitive matching, uniquely targeting the seeded narrative type. | Locator resolves to exactly one element (the Caso 0001 Resumo Clínico narrative, uppercase C); `reabrirBtn` is found and clicked; reopen succeeds; DB status → `aberta`; AC-7 through AC-N2 cascade-unblocked. | Playwright strict mode: "getByRole('region', ...) resolved to 2 elements"; AC-6 failed at coordinator reopen step; AC-7 through AC-N2 cascade-skipped. | `e2e/case-access.spec.ts` AC-6 — case-access "narrative lifecycle: staff2 fills, concludes; coordinator reopens" | tester | RESOLVED 2026-06-22 — changed locator to `page.getByRole('region', { name: 'Resumo Clínico', exact: true })` (case-sensitive exact match); full `case-access.spec.ts` run: **15 passed / 2 skipped by design** (AC-9 flag-ON skip; AC-7 conditional); 0 failures. |

| CN-CONTAM-AC1 | case_patient / case-narratives | MINOR | **DB contamination — `case-narratives` AC-1 expects `getByText('Resumo Clínico', { exact: true })` in the Configurações → Narrativas page, but the seeded narrative type has been renamed by AC-1b (`rename a narrative type`) in a prior gate run.** Repro: run `case-narratives.spec.ts` once (AC-1b renames `Resumo Clínico` to `Resumo Clínico (Renomeado) …` for the rename assertion); run again without `supabase db reset` — AC-1 now fails. | The seeded `Resumo Clínico` type name is stable; AC-1 finds `getByText('Resumo Clínico', { exact: true })` and passes. | `toBeVisible()` on `getByText('Resumo Clínico', { exact: true })` fails — element not found; type was renamed in prior run and never restored. | `e2e/case-narratives.spec.ts` AC-1 — case-narratives "coordinator creates a narrative type → seeded types visible" | tester | RESOLVED 2026-06-22 — AC-1b now restores the original label after the rename assertion using a `supabasePatch` service-role helper + verification step; AC-1 passes on re-run without `supabase db reset`. Verified: AC-1 PASS → AC-1b PASS (renames then restores) → AC-1 PASS (no contamination). |

| SPEC-P22-001 | 22 / Phase-23 gate | MINOR | **Spec defect — Phase-22 Flow 1c (`get_case_detail` RLS denial test) calls `resp.json()` but PostgREST v14.5 returns `Content-Type: text/plain` "Something went wrong" for P-class SQLSTATE raises (specifically P0002 raised by `get_case_detail` when the caller has no `can_read_case`).** `JSON.parse("Something went wrong")` throws a SyntaxError at the `resp.json()` call at `phase22-referrals.spec.ts:354`. The test should call `resp.text()` first and branch on content-type. Repro: fresh `supabase db reset` → `npx playwright test e2e/phase22-referrals.spec.ts -g "Flow 1c" --project=chromium --workers=1`. Root cause: at the Phase-22 gate the PostgREST schema cache returned a different response format for P0002 on that DB state; now consistently returns `text/plain`. NOT introduced by Phase-23 (zero case/referral code changed). | Flow 1c parses the response body correctly; asserts `isNoDataFound` (P0002 / 403 / 404 / "não encontrado"). | `SyntaxError: Unexpected token 'S', "Something went wrong" is not valid JSON` at `resp.json()` L354 of `phase22-referrals.spec.ts`. | `e2e/phase22-referrals.spec.ts` Flow 1c (L343) — Phase-22 AC "A-side user gets no_data_found (RLS) on B's target_case_id" | **tester** | RESOLVED 2026-06-22 — replaced `await resp.json()` with `resp.text()` + defensive JSON parse (only when text starts with `{` or `null`); `body === null` is included in `isNoDataFound` condition. Flow 1c passes in isolation: 1/1. |
| BUG-CPR-001 | case_phase_results | MAJOR | **Pre-existing regression — `100_dashboard.sql` pgTAP test `has_function_privilege('anon', 'public.add_template_phase(uuid,uuid,text,jsonb,integer,integer[])', 'EXECUTE')` fails because migration `20260620020000_phase_results.sql` drops the old 6-arg `add_template_phase(uuid,uuid,text,jsonb,integer,integer[])` signature and replaces it with the new 7-arg form.** The pgTAP assertion in `100_dashboard.sql` (line 340) references the old 6-arg signature which no longer exists, so `has_function_privilege` returns `false` instead of `true`, causing the assertion to fail with "not ok". This is not a security issue (the 6-arg form was intentionally superseded); the assertion just needs to reference the new 7-arg signature `add_template_phase(uuid,uuid,text,text,integer,integer[],jsonb)`. Repro: `npx supabase test db --local -f 100_dashboard.sql`. | `has_function_privilege` on the new 7-arg signature returns true (anon revoke confirmed). | Assertion references a dropped overload; result is `false`; pgTAP test fails. | `supabase/tests/100_dashboard.sql` anon-revoke assertion — Architecture Rule 1 (anon EXECUTE revoke sweep) | **backend** | CLOSED — fixed by lead in `100_dashboard.sql` (updated both `add_template_phase` + `update_template_phase` assertions to the 7-arg signature). pgTAP 824/824. |
| BUG-CPR-002 | case_phase_results | MAJOR | **Spec hermeticity — original `case-phase-result.spec.ts` depended on seeded Form A (`f0...a001`, version `50...a001`) and hardcoded item UUID `d9423933-…` (`turno_auditoria`).** When `phase5-wizard` AC7 ran first and published Form A v2, `create_case_from_template` snapshotted v2 — making `ITEM_TURNO_AUDITORIA` (a v1 item) invalid → HC013 in `beforeAll`. Also caused phase5-wizard AC3/AC5/AC7 resume failures when the spec ran first (shared seeded data mutation). | Spec creates its OWN form+version+section+item via service role in CCIH commission (title `Checklist CPR-SPEC`). Only required field: `cpr_check` (single `multiple_choice`). No seeded form IDs referenced. All cleanup via `docker exec psql session_replication_role=replica` purge. | HC013 in `beforeAll`; phase5-wizard AC3/AC5/AC7 failures when run in order. | `e2e/case-phase-result.spec.ts` hermeticity contract; CLAUDE.md §4 "hermetic specs" | **tester** | CLOSED — spec fully rewritten. 7/7 PASS standalone + 19/19 PASS with phase5-wizard combined (fresh reset). |
| BUG-CPR-003 | case_phase_results | INFO | **STALE SPEC — `phase3-admin-members` AC1 (3 tests) written for old `createCommission` behavior.** `admin creates a new commission`, `admin opens commission detail`, and `admin assigns a staff_admin by email` all fail because `createCommission` (commit 80eef96) now intentionally redirects to `/admin/comissoes/${slug}` on success. Specs expected the old behavior: stay on `/admin` and find the card link `a[href="/admin/comissoes/${slug}"]` in the list. | After create, land on detail page (`/admin/comissoes/${slug}`); heading shows `commissionName`; then `goto('/admin')` confirms card in list. | Card link `a[href="/admin/comissoes/${slug}"]` not found (browser is on detail page after redirect). | `e2e/phase3-admin-members.spec.ts` AC1 — Phase 3 acceptance criteria | **tester** | RESOLVED 2026-06-23 — spec fixed: AC1 test 1 uses `waitForURL` → detail page + heading assert → `goto('/admin')` → list assert; AC1 tests 2+3 drop the find-card-and-click steps entirely, relying on post-create redirect. AC4 keyboard test comment updated (no logic change needed — `getByText(commissionName)` passes on detail page). 14/14 PASS, chromium, fresh seed. |
| BUG-CPR-004 | case_phase_results | INFO | **STALE SPEC — `phase22-referrals` Flow 5a uses stale MRN constant `PRT-77`.** Seeded `referral_patient` for ENC-0001 had its MRN changed from `PRT-77` to `PRT-0099123` (seed.sql ~L1157, Phase-23 `patient_index` synthetic cross-committee patient sharing one MRN across NSP event + ENC-0001 referral + B-side case). `const PHI_MRN = 'PRT-77'` (L77) was stale → Flow 5a's `getByText(/PRT-77/)` failed; negative PHI assertions at L685/L699/L992/L1006/L1018 were vacuously true. | Flow 5a: MRN `PRT-0099123` visible after PHI panel reveal; negative assertions (hub/dashboard/timeline HTML + audit metadata) confirm MRN absent before reveal — no PHI leak. | `getByText(/PRT-77/)` not found; negative assertions vacuously true. | `e2e/phase22-referrals.spec.ts` Flow 5a + PHI-leak negatives — Phase 22 acceptance criteria (Rule 11/12) | **tester** | RESOLVED 2026-06-23 — L77 `PHI_MRN` updated to `'PRT-0099123'`. All 5 negative assertions now use the real MRN and PASS (no PHI leak confirmed). 29/29 PASS, chromium, fresh seed. |
| BUG-FBE-001 | form-builder-enhancements | HIGH | **APP bug — submission detail page does not pass `observationsByItemId` to `<SubmissionDetailView>`.** `getSubmissionDetail` (BE-7) correctly builds the `observationsByItemId: Record<string,string>` map from `answers.observation` and includes it in its return value. BUT `src/app/c/[slug]/dashboard/submissions/[responseId]/page.tsx` passes only `tree`, `answersByItemId`, `answersByKey`, `signoffs`, `imageUrls` to `<SubmissionDetailView>` — omitting `observationsByItemId`. `SubmissionDetailView` defaults the prop to `{}` (empty), so `AnswerSummary` never receives a non-null `observation` and the "Observação:" line is never rendered. Repro: fill a form with an observation on a non-free-text item → submit → navigate to the submission detail as staff_admin → "Observação:" text absent. | "Observação:" muted label and the observation text render on the submission detail page after the coloured chip answer. | `getByText(/Observação:/i)` not found at L1052 of FBE spec. | `e2e/form-builder-enhancements.spec.ts` AC-12 + AC-K (blocked in serial mode) — AC-12: "observation line renders on submission detail read view (BE-7)" | **frontend** | RESOLVED `848af1b` — `page.tsx` now passes `observationsByItemId={detail.observationsByItemId}`; also fixed `phase-answers-readonly.tsx` + `prepare.ts toAnswerState` rehydration (FE-5). AC-12 STILL FAILS — root cause shifted: the observation is not being SAVED at all (see BUG-FBE-004 which is the actual blocker). |
| BUG-FBE-002 | form-builder-enhancements | MAJOR | **REGRESSION — `phase4-builder.spec.ts` AC(a) fails because FE-1 relabeled `free_text` from "Texto livre" to "Resposta longa" in `add-block-menu.tsx`.** L151 `openAddBlock(page, ..., /Texto livre/)` and L313 `openAddBlock(page, ..., /Texto livre/)` both use the old menu label. Repro: fresh `db reset` → `npx playwright test e2e/phase4-builder.spec.ts --project=chromium`. | Menuitem found with label `/Resposta longa/`. | Menuitem with `/Texto livre/` not found (timeout 150s). | `e2e/phase4-builder.spec.ts` L151 + L313 — Phase 4 AC(a) | **tester** | RESOLVED 2026-06-23 — L151 + L313 updated to `/Resposta longa/`. Phase4 8/8 PASS confirmed. |
| BUG-FBE-003 | form-builder-enhancements | MAJOR | **REGRESSION — `phase4-builder.spec.ts` AC(b) and AC(c) fail because FE-2 replaced the section-condition dialog's single `<select>` labelled "Mostrar a seção quando" with the shared `ConditionBuilder` component.** L232 `getByLabel('Mostrar a seção quando')` and the same pattern in AC(c) L233 no longer find the old discrete select (it no longer exists). Repro: fresh `db reset` → `npx playwright test e2e/phase4-builder.spec.ts --project=chromium`. | Section condition is built via the `ConditionBuilder` selects (`select[id$="-target"]`, `select[id$="-value"]`) mirroring the FBE spec's AC-5. | Old `getByLabel('Mostrar a seção quando')` selects and `getByLabel('Valor')` not found (timeout). | `e2e/phase4-builder.spec.ts` L232 (AC(b)) and L233 (AC(c)) — Phase 4 AC(b)/AC(c) | **tester** | RESOLVED 2026-06-23 — condition-enable checkbox + `select[id$="-target"]` / `select[id$="-value"]` selectors in both AC(b) and AC(c) dialogs. Phase4 8/8 PASS confirmed. |
| BUG-FBE-005 | form-builder-enhancements | MAJOR | **STALE SPEC — `phase4-builder-smoke.spec.ts` L105-107 uses the old discrete section-condition selects (`getByLabel('Mostrar a seção quando')` / `getByLabel('Valor')`) that FE-2 replaced with the shared `ConditionBuilder`.** Same class as BUG-FBE-003. L103-107: the `settings` dialog's `getByLabel('Mostrar a seção quando').selectOption(...)` and `getByLabel('Valor').selectOption(...)` time out because neither label exists after the ConditionBuilder refactor. Repro: `npx playwright test e2e/phase4-builder-smoke.spec.ts --project=chromium`. | Section condition built via ConditionBuilder: enable checkbox (`/Exibir somente sob condições/i`) checked first, then `select[id$="-target"]` + `select[id$="-value"]` selects used. | L105 `getByLabel('Mostrar a seção quando')` times out. | `e2e/phase4-builder-smoke.spec.ts` L105–107 — Phase 4 smoke happy path (section condition step) | **tester** | RESOLVED 2026-06-23 — L103-111 updated: added condition-enable checkbox check + replaced old label-based selects with `select[id$="-target"]` / `select[id$="-value"]`. Parse-clean (1/1 test lists). |
| CN-APP-AC4 | case_patient / case-narratives | MAJOR | **PRE-EXISTING app bug — confirmed on `main` (`c770a33`), NOT introduced by `case_patient` branch.** Inline Markdown editor (`CaseNarrativeCard`) does not re-render the saved body after `upsertNarrativeBody`/`saveNarrativeBody` Server Actions on the prod standalone build. Both actions call `revalidateCase()` → `revalidatePath('/c/[slug]/manage/cases/[caseId]', 'page')`, but the Server Component does not re-render with the new body. Definitive isolation: ran AC-4 in complete isolation on `main`'s prod build (`node .next/standalone/server.js` port 3001) against a fresh `supabase db reset` — identical L549 failure. Same failure on feature branch in isolation. DB `body_md` IS persisted. The branch's `Promise.all` change to the case-detail page is NOT the cause (pre-dates the branch). Bug is prod-build-specific (`next dev` passed in Phase 22). **NOT a blocker for the `case_patient` gate** — it is a pre-existing baseline failure tracked for the next engineering cycle. | After "Salvar", the inline editor collapses and the card immediately re-renders the saved Markdown body (e.g., `## Achados do Comitê` h2 heading visible). | After "Salvar", editor collapses (textarea gone) but heading not rendered. `getByRole('heading', …)` times out at L549. DB has the saved body. | `e2e/case-narratives.spec.ts` AC-4 (L549) — case-narratives "inline Markdown fill — rendered Markdown appears in place" | **frontend** | RESOLVED 2026-06-23 (frontend fix + lead prod-build verification) — Root cause: `CaseNarrativeCard` rendered its body straight from the `narrative.bodyMd` PROP and relied on `router.refresh()`/`revalidatePath` to update it; on the prod standalone build that refresh does not re-render the Server Component synchronously, so the card fell back to the empty placeholder right after save. **Fix** (`src/components/cases/case-narrative-card.tsx` ONLY): added an optimistic `savedBody` override set on save success; the body now renders from `effectiveBody = savedBody ?? narrative.bodyMd ?? ""` (driving `hasBody`, the `MarkdownRenderer`, and the `handleEdit`/`handleCancel` seed), so the saved Markdown appears immediately — independent of the lagging prop refresh. A render-phase reconcile (`seenBodyMd` tracker — React's "adjust state during render"; chosen over `useEffect` to satisfy the repo's `react-hooks/set-state-in-effect` rule) drops the override once the refreshed prop lands or the body otherwise changes (reopen / external edit → server stays authoritative; a concluded/frozen body reflects the server). typecheck + lint clean. **Prod-build before/after proof (LEAD, `node .next/standalone/server.js` on :3000, fresh `supabase db reset`):** OLD code → AC-4 FAILS at L549 (heading not rendered, editor collapsed); FIXED code → `e2e/case-narratives.spec.ts` **11/11 PASS**; regression sweep `case-access + phase3-admin-members + phase22-referrals` **58 passed / 2 skipped-by-design**. Frontend flagged sibling inline-Markdown editors with the same prop-render + `router.refresh()` shape for a follow-up audit (see Follow-ups). |
| BUG-MT-001 | Multi-tenancy Phase E | BLOCKER | **APP bug — `admin@test.local` can no longer access `/admin/nsp/**` or `/admin/audit` after the multi-tenancy reseed.** The reseed changed `admin@test.local` (UID `00…001`) from `is_admin=true` to `is_admin=false` (it is now `org_admin` of rede-a). The `/admin/layout.tsx` gates on `context.isAdmin` (JWT `is_admin` claim) and calls `notFound()` for any user without it. `/admin/nsp/page.tsx` also re-checks `context.isAdmin`. Meanwhile `platform@test.local` (the sole `is_admin`) is NOT enrolled in `pqs_members` and has no tenant access, so it cannot reach NSP data either. **Result: no seeded persona can access `/admin/nsp/**` with full PQS data.** Repro: `npx supabase db reset --local` → sign in as `admin@test.local` → navigate to `/admin/nsp` → receives 404 (not found). Specs broken: `e2e/phase13-audit.spec.ts` AC-3f (`admin@` at `/admin/audit`); `e2e/phase14a-safety-events.spec.ts` (all UI tests at `/admin/nsp/…`); `e2e/phase14b-triage.spec.ts` (`admin@` at `/admin/nsp/triagem`); `e2e/phase14c-rca.spec.ts` (`admin@` at `/admin/nsp/rca/…`); `e2e/phase14d-capa.spec.ts` (`admin@` at `/admin/nsp/capa/…`); `e2e/phi-remediation.spec.ts` (all `/admin/nsp/` UI flows); `e2e/phase22-referrals.spec.ts` (`admin@` at `/admin/nsp/encaminhamentos`); `e2e/patient-index.spec.ts` (`admin@` at `/admin/nsp/pacientes`). | `admin@test.local` (pqs_member) can sign in and reach `/admin/nsp/**`; or a dedicated PQS persona that holds BOTH `is_admin` (JWT) AND enrollment in `pqs_members` exists in the seed. | All `/admin/nsp/**` routes return 404 for `admin@test.local`; `platform@test.local` (is_admin=true) returns 404 too because it is not in pqs_members. No seeded persona can exercise the NSP UI. | `e2e/phase14a-safety-events.spec.ts` (and 7 other NSP/PHI specs listed above) — Phase 14a–d, PHI remediation, Phase 22, patient-index ACs | **backend + seed** | **RESOLVED 2026-06-25 (by design)** — the multi-org PHI guard (`20260629000000`, ADR 0041 amendment 10) makes the entire NSP/referral surface inert in multi-org (the global PQS roster cannot span orgs). With the 2-org seed there is **no** persona that reaches `/admin/nsp/**` with PHI — that is the intended interim posture, not a regression. The 8 NSP/PHI specs are quarantined (`MULTI_ORG_PILOT_SKIP`, the 124 E2E skips) and lift when the **NSP-per-org** follow-up ships. |
| BUG-MT-002 | Multi-tenancy Phase E | MAJOR | **SPEC STALE — `e2e/phase13-audit.spec.ts` AC-3f uses `admin@test.local` at `/admin/audit`.** After the multi-tenancy reseed `admin@test.local` is no longer `is_admin`, so `/admin/layout.tsx` returns 404 for it. The test navigates `admin@` to `/admin/audit` expecting the cross-commission audit feed heading; it will get a 404 instead. Repro: fresh `supabase db reset --local` → sign in as `admin@test.local` → navigate to `/admin/audit` → 404. **Root cause is the same as BUG-MT-001** (persona JWT claim split). AC-3f tests the legitimate cross-commission audit view that only a platform-wide admin should have; once engineers fix BUG-MT-001, the spec must be updated to use the correct persona (either `platform@test.local` if it gains pqs_member or audit access, or a new dedicated persona). | AC-3f: `admin@` or `platform@` (whichever holds the audit-admin role after the fix) sees the cross-commission feed including commission-B rows at `/admin/audit`. | `admin@test.local` gets a 404 at `/admin/audit`; heading assertion times out. | `e2e/phase13-audit.spec.ts` AC-3f — Phase 13 AC "platform admin sees the full cross-commission audit feed" | **backend + seed** (for BUG-MT-001 fix), then **tester** (to update persona in spec) | **RESOLVED 2026-06-24 (tester)** — Spec rewritten to the new 2-tier audit model: (a) `AC-3f` uses `admin@test.local` (org_admin) at `/o/rede-a/manage/audit` with actor filter for Farmácia, asserting the org-scoped cross-commission feed total ≥ 83 rows; (b) `AC-3f-platform` uses `platform@test.local` (is_admin) at `/admin/audit`, asserting the platform-tier audit page renders (empty-state in the 2-org seed — no rows with both org_id=NULL and commission_id=NULL). Also fixed: `makeProbeCommission` now supplies `organization_id`/`hospital_id` (NOT NULL in multi-tenancy schema); `AC-7a` now uses `platform@test.local` for the platform-tier chain verify (replaces `admin@`). All 27 phase13 tests pass. |
| BUG-MT-006 | Multi-tenancy Phase E / case_access flag | MINOR | **STALE SPEC — `e2e/phase7-cases.spec.ts` (×4 routes), `e2e/cases-extras.spec.ts` (×1 route) used `/minhas-fases` URL and "Minhas fases" heading after `case_access` flag shipped ON by default (migration `20260624130000_feature_flags_default_on.sql`).** With `case_access=ON`, `/minhas-fases` redirects to `/meus-casos`; `waitForURL('**/minhas-fases')` timed out; heading assertion `/Minhas fases/i` never matched. Also: `signOut` helper had `page.evaluate(() => window.scrollTo(0, 0))` that could throw "Execution context was destroyed" when called while the page was still completing a redirect. And AC-HappyPath had a strict-mode violation on `getByRole('button', { name: /^Concluir$/i })` because narrative-card "Concluir" buttons (size="sm") now coexist with the header-level case-close button (size="lg"). Repro: `supabase db reset --local` → `npx playwright test e2e/phase7-cases.spec.ts --project=chromium --workers=1` → AC-HappyPath (:507) and AC-AssigneeScoping (:1106) fail. | Routes updated to `/meus-casos`; heading updated to `/Meus Casos/i`; `signOut` evaluate wrapped in `.catch(() => {})`; `concludeBtn` scoped to `page.locator('header')`; path-tamper OR condition updated to accept either `minhas-fases` or `meus-casos` URL fragment. | `waitForURL('**/minhas-fases')` timeout; heading not found; strict-mode violation on 5 Concluir buttons. | `e2e/phase7-cases.spec.ts` AC-HappyPath (:507), AC-AssigneeScoping (:1106), AC-Keyboard (:1264); `e2e/cases-extras.spec.ts` AC-FixedStatusAdvance | **tester** | RESOLVED 2026-06-25 — spec fixes in `e2e/phase7-cases.spec.ts` + `e2e/cases-extras.spec.ts`. Targeted run 23/23 PASS (chromium, --workers=1, fresh reset). |
| BUG-MT-005 | Multi-tenancy Phase E | MAJOR | **APP bug — `platform@test.local` (is_admin) gets HTTP 200 on `/o/rede-a/c/ccih` instead of expected 404.** Root cause: `getCommissionAccessByOrg` returns `{ role: null }` (a non-null object) for a platform admin who has no commission membership. The commission layout (`src/app/o/[org]/c/[commission]/layout.tsx`) checks `!access` which is falsy when the object exists. `access.context.isAdmin = true` then causes `isCoordinator = isAdmin = true`, giving the platform admin unintended coordinator-level access to all commission pages. Expected: `platform@` with no commission membership should get 404 (like it does for `/o/rede-b/manage`). Repro: fresh `supabase db reset --local` → navigate to `/o/rede-a/c/ccih` as `platform@test.local` → HTTP 200 returned (should be 404); commission home page renders with coordinator privileges. Fix: commission layout should check `!access || access.role === null` (or equivalent) to return 404 when access exists but has no role. | `platform@test.local` navigating to `/o/rede-a/c/ccih` gets a 404 (no commission membership). | HTTP 200 returned; commission home page renders. `e2e/phase-multitenancy.spec.ts` MT-3 `platform@ gets 404 on commission area /o/rede-a/c/ccih` fails: `expect(res.status()).toBe(404)` receives 200; and `expect(page.getByText(/Controle de Infecção Hospitalar|CCIH/i)).not.toBeVisible()` fails (commission name IS visible). | `e2e/phase-multitenancy.spec.ts` MT-3 — Multi-tenancy "platform admin is walled off from commission area" | **frontend** (`src/app/o/[org]/c/[commission]/layout.tsx`) | **RESOLVED 2026-06-25** (`f24f584`) — commission layout now 404s when `access.role === null` (not just `!access`), so a platform admin with no membership is walled off from the commission shell. MT-3 passes. |
| BUG-MT-003 | Multi-tenancy Phase E | BLOCKER | **APP bug — commission staff and staff_admin land at `/` (root) after login instead of their commission route `/o/rede-a/c/${slug}`.** Root cause: `resolveLanding()` in `src/lib/auth/actions.ts` queries `commission_members.select('commission:commissions(slug, organization:organizations(slug))')`. This PostgREST nested select joins through `organizations`, but the `organizations` RLS SELECT policy (`app.is_admin() OR app.is_org_admin_of(id)`) blocks regular commission members from reading `organizations`. PostgREST returns null for `organization.slug`, the membership filter `.filter((m) => Boolean(m.slug) && Boolean(m.orgSlug))` removes all memberships, and `memberships.length === 0` triggers the fallback `return '/'`. Repro: fresh `supabase db reset --local` → sign in as `staff1.ccih@test.local` (password: Test1234!) → observe redirect to `http://localhost:3000/` instead of `/o/rede-a/c/ccih`. Same for `chefe.ccih`, `staff1.farm`, `chefe.farm`. Fix options: (a) add a SELECT policy for `organizations` allowing commission members to read orgs their commission belongs to, or (b) rewrite `resolveLanding` to avoid the org join (e.g., query commissions directly with their org slug via a SECURITY DEFINER function, or denormalize org_slug onto commission_members). | After login, `staff1.ccih@test.local` redirects to `http://localhost:3000/o/rede-a/c/ccih`; `chefe.ccih@test.local` → same; `staff1.farm@test.local` → `/o/rede-a/c/farmacia`. | All commission-role personas redirect to `http://localhost:3000/` (root) after login. `toHaveURL` assertion `14 × unexpected value "http://localhost:3000/"`. Broken tests: `e2e/phase2-auth-shell.spec.ts` L71, L76, L81, L86, L94, L205, L222, L230, L243, L260, L333 (11 tests). | `e2e/phase2-auth-shell.spec.ts` — Phase 2 AC "each persona lands on the correct area" (AC-1, AC-5, AC-6, AC-7, AC-8) | **backend** | **RESOLVED 2026-06-25** (`ce53fe3`) — added `app.is_org_member(org)` + broadened the `organizations` SELECT policy so a commission member reads their own org row; `resolveLanding`'s org join now resolves and members land on `/o/<org>/c/<slug>`. |
| BUG-MT-004 | Multi-tenancy Phase E | BLOCKER | **APP bug — ALL commission pages under `/o/[org]/c/[commission]/...` return 404 for regular staff and staff_admin.** Root cause: `getCommissionAccessByOrgUncached()` in `src/lib/queries/session.ts` uses `commissions.select('..., organization:organizations!inner(...)')`. The `organizations!inner` join is blocked by the `organizations` RLS SELECT policy (`app.is_admin() OR app.is_org_admin_of(id)`), which does NOT include regular commission members. PostgREST's inner join returns no rows for a user who is not a platform_admin or org_admin, so `getCommissionAccessByOrg` returns null. The commission layout (`src/app/o/[org]/c/[commission]/layout.tsx`) calls `notFound()` on null. `getCommissionAccessByOrg` is the central access resolver used by 39+ commission pages. **Verified**: `staff1.ccih@test.local` navigating to `/o/rede-a/c/ccih` (their own commission) gets "Não encontramos esta página." `admin@test.local` (org_admin) is unaffected. Repro: fresh `supabase db reset --local` → sign in as `staff1.ccih@test.local` → goto `/o/rede-a/c/ccih` → 404. Fix: broaden `organizations` SELECT RLS to allow commission members of that org to read their org row, OR rewrite `getCommissionAccessByOrgUncached` to resolve the commission without an inner join to `organizations` (e.g., use a SECURITY DEFINER function, query commissions directly then fetch org separately with service-role, or filter via a lateral join that tolerates empty org rows). | `staff1.ccih@test.local` navigating to `/o/rede-a/c/ccih` sees the commission home page (not a 404). | 404 rendered with "Não encontramos esta página." for ALL commission-role staff navigating any commission page. Broken tests: `e2e/phase3-admin-members.spec.ts` L222, L253, L291, L454; all of phase4, phase5, phase6, phase7, phase8, and later spec files that test commission-area pages for staff/staff_admin personas — estimated 80+ test failures blocked by this. | Virtually all commission-area specs (Phase 3 AC2/AC4 through Phase 22) | **backend** | **RESOLVED 2026-06-25** (`ce53fe3`) — same fix as BUG-MT-003: the broadened `organizations` SELECT (via `app.is_org_member`) lets `getCommissionAccessByOrgUncached`'s `organizations!inner` join resolve for plain commission members, so commission pages render instead of 404ing. |


<!-- rotated from PROGRESS.md 2026-07-02 (§7): user-reg + NSP-per-org + form-model + form-builder resolved bugs -->
| BUG-NSP-001 | NSP-per-org (sub-phase A) | BLOCKER | **MIGRATION BUG — `create_referral_draft` re-created from a STALE pre-`…140000` 5-arg base → a NEW overload (42725 ambiguous) + stray PUBLIC grant.** ROOT-CAUSE corrected vs the tester's proposed drop-the-6-arg fix (which would have regressed `…140000`'s description feature): the fix re-creates the function as the **TRUE canonical = `…626000`** (6-arg WITH `p_description_md`, AND `…626000`'s gate that dropped `is_admin_for` — `…626000` superseded `…140000`), plus the cross-org-forbid guard + explicit `REVOKE PUBLIC`/`GRANT authenticated,service_role`. Now a true REPLACE: single 6-arg overload, no PUBLIC. Fixed in `ecf40e1`. DB-verified: 1 overload, `public_can_exec=false`. | `100_dashboard` t19 count=0; `150_referrals` t1 catches HC071. | (was) t19 count=1 anon-exec; t1 caught 42725. | `supabase/tests/100_dashboard.sql` t19 + `150_referrals.sql` t1 | **backend** | ✅ RESOLVED (`ecf40e1`) |
| BUG-NSP-002 | NSP-per-org (sub-phase A) | BLOCKER (PHI leak) | **Found via the BUG-NSP-001 stale-base self-check.** `get_referral_detail` was re-created from the `…014000` body, silently reverting `…015000`'s PHI-body lockdown — it served `description_md`/`frozen_body_md`/`result_md` UNCONDITIONALLY to metadata-only (non-`can_read_referral_phi`) readers. The behavioral isolation pgTAP did not catch it (it checks cross-ORG, not within-referral metadata-vs-PHI-reader). Fix: replaced with the `…015000` canonical verbatim (every PHI body `case when v_can_phi`); needs no org edit (rides rebound `can_read_referral[_phi]`). Fixed in `ecf40e1`; DB-verified `v_can_phi`-gated. **Tester re-verified + added regression coverage (`150_referrals.sql`, +4 assertions): a metadata-only reader (plain source member, not staff_admin/analyst/PQS) gets `description_md`/`frozen_body_md`/`result_md` ALL NULL; a PHI reader (target coord) gets all three populated. Mutation-tested live (flipping the `description_md` expectation fails as expected).** | a metadata-only referral reader gets NULL PHI bodies. | (was) PHI bodies served to any `can_read_referral` reader. | `150_referrals.sql` get_referral_detail body-gating block (BUG-NSP-002 GUARD assertions) | **backend** | ✅ RESOLVED (`ecf40e1`); tester re-verified + guarded 2026-06-25 |
| BUG-NSP-003 | NSP-per-org (sub-phase A) | MAJOR | **Found via the self-check.** `list_referral_target_commissions` re-created from the `…014000` gate (`is_staff_admin_of OR is_admin`), reverting `…626000`'s drop of the platform-admin arm — a walled-off `platform_admin` could again list a tenant's target commissions. Fix: `…626000` gate (`is_staff_admin_of` only) + kept the same-org filter. Fixed in `ecf40e1`; DB-verified no `is_admin()` call. | platform_admin cannot list tenant targets. | (was) `is_admin()` arm present. | (wall-off invariant; no direct pgTAP) | **backend** | ✅ RESOLVED (`ecf40e1`) |
| M1 (QA) | NSP-per-org (sub-phase A) | MAJOR | **Over-grant — `app.patient_trajectory_bundle` (internal helper, NO own auth check) was widened to `authenticated` by the 3-arg arity-change grant loop; the original 2-arg was `service_role`-ONLY (`…019000`).** A non-PQS staffer holding a `patient_key` could call it directly, bypassing the enrollment gate for ANY org (key-only cross-org linkage metadata). Fix: removed from the `authenticated` loop + explicit `REVOKE authenticated` / `GRANT service_role` only. DB-verified: `auth_exec=f`/`svc_exec=t`; direct call by a plain staffer = `permission denied`; the 3 DEFINER doors still work (run as postgres). **Grant-loop audit:** every other granted helper matches its sibling-predicate posture (`authenticated`+`service_role`); the bundle was the sole `service_role`-only outlier. **Tester re-verified + guarded (`152_patient_index.sql` §M1, +4): `has_function_privilege('authenticated', …)` = false (+ anon false); a non-PQS persona calling the helper directly raises 42501; the DEFINER door still returns org-scoped results. Mutation-proved live — flipping the privilege expectation to `true` fails, i.e. the guard WOULD fail against the pre-fix `authenticated` grant.** | non-enrolled direct call denied; gated doors unaffected. | (was) any authenticated user got cross-org linkage. | `152_patient_index.sql` §M1 bundle-bypass guard | **backend** | ✅ RESOLVED (`19bb30a`); tester re-verified + guarded 2026-06-25 |
| M2 (QA) | NSP-per-org (sub-phase A) | MAJOR | **Off-inventory callers of DROPPED symbols — found by a LIVE CATALOG SWEEP (not a file grep), which caught TWO (QA flagged one).** (a) `capa_viewer_can_manage` (`…009000`, never re-created) → `app.is_pqs_writer()` → errored at call time; `capa.ts:145` swallowed it → `viewerCanManage` silently `false` for every per-org writer. (b) **`capa_kpis`** (`…009000`, the NSP-dashboard headline) → `app.is_pqs_member(auth.uid())` → also broken. Fix: rebind `capa_viewer_can_manage` → `can_write_capa`; `capa_kpis` → `is_pqs_member_of_any` (no-arg cross-org PHI-free counts). **Catalog sweep now returns ZERO** dangling function/policy refs to the 3 dropped symbols (precise `\m…\(` regex). **Tester re-verified + guarded: (a) `143_capa.sql` §M2 (+3): `capa_viewer_can_manage` = true for an enrolled per-org writer / false for a non-writer (no error); `capa_kpis()` executes for a PQS member. (b) NEW `175_dropped_symbol_sweep.sql` (4) — PERMANENT systematic guard: ZERO refs to `is_pqs_writer`/`is_pqs_member`/`is_multi_org` across app+public `pg_proc` bodies + `pg_policies` qual/with_check, plus a calibration assertion that the rebound `_of` predicates ARE present. (Scoped to app+public — `test_helpers.bootstrap`'s prose comment legitimately names `is_multi_org`.)** | both functions resolve; per-org writer gets the manage signal. | (was) both errored at call time. | `143_capa.sql` §M2 + `175_dropped_symbol_sweep.sql` | **backend** | ✅ RESOLVED (`19bb30a`); tester re-verified + guarded 2026-06-25 |
| I1 (QA, folded-in) | case_patient (ADR 0038) — folded into NSP-per-org per human approval | MAJOR | **`dispose_case_phi` had a bare `app.is_admin()` arm = a LIVE cross-tenant PHI-erase path** (the `case_patient` flag is ON in the canonical seed; the vendor `platform_admin` holds zero memberships, so `is_admin()` was its only tenant reach → it could erase ANY org's case PHI). This is the case_patient module, slightly outside this phase's two-module NSP/referral inventory; folded in by human approval. Identical rewrite to `dispose_event_phi`: `is_admin()` → `is_org_admin_of_commission(commission_of_case(...))`, kept `is_staff_admin_of`. Canonical base = `…019000` (resolved via catalog, not `…017000`/`…626000`). Proven: `platform@` DENIED, `orgadmin.a` ALLOWED, `orgadmin.b` (cross-org) DENIED. `set_case_patient` confirmed already clean (no change). **Tester re-verified + guarded (`151_case_patient.sql` §I1, +3): the gate is asserted inside the rollback (no full lifecycle) on a dedicated throwaway case — platform-admin analog (is_admin, no tenant grant) DENIED 42501; a DIFFERENT-org org_admin DENIED 42501; the case's-org org_admin ALLOWED (`lives_ok`). Bootstrap is single-org, so the 2nd org + both org_admin org_members are minted directly inside the txn.** | platform_admin cannot erase tenant case PHI; org_admin of the case's org can. | (was) vendor platform_admin could erase any org's case PHI. | `151_case_patient.sql` §I1 gate guard | **backend** | ✅ RESOLVED (`19bb30a`); tester re-verified + guarded 2026-06-25 |
| M3 (QA) | NSP-per-org (sub-phase A) | MAJOR | **Gate-fixed but body-not-scoped — the M2 `capa_kpis` rebind fixed the GATE (`is_pqs_member_of_any`) but the body stayed a non-correlated boolean, so the `capa_plan` aggregate + `overdue_actions` subquery spanned ALL orgs** (a rede-a PQS member counted rede-b's CAPA volume; same posture MT org-scoped `commission_overview`/`dashboard_*` for). PHI-free → MAJOR. Fix (body, **no-arg + hermetic**): `v_orgs := caller's enrolled orgs` (pqs_inbox pattern); `in_scope` CTE keeps a plan iff its event-org ∈ `v_orgs` OR it is non-event-sourced (NULL event-org → any-org fallback, matching `can_write_capa`); the overdue subquery joins action→capa→in_scope. Signature stays `capa_kpis()`. **Proven (QA repro):** inject a rede-b event-sourced plan+overdue action → pqs.a `open_count` stays 1 / `overdue` stays 0; pqs.b open=1/overdue=1; non-PQS all-zero. **Body-scope-class audit (closed):** exhaustive catalog sweep of every aggregate/list/bundle DEFINER door over PHI/CAPA tables → all 9 org-scoped or entity-keyed (`capa_kpis` now scoped, was the sole offender); the any-org-gated set = `capa_kpis` (fixed) + 8 vocab CRUD (intentionally GLOBAL config) + `can_write_capa`/`open_capa_plan` (per-entity NULL-org fallback) + `is_pqs_member_self` (nav probe) — all correct. **Tester re-verified + guarded (`143_capa.sql` §M3, +4): inject ONE event-sourced `capa_plan` (em_execucao) + an overdue `capa_action` in a SECOND org → the org-b PQS member's `open_count` AND `overdue_actions` are UNCHANGED (org-scoped exclusion), while a PQS member OF that 2nd org DOES count both. Mutation-proved live — flipping M3a to expect `before+1` fails (`have 1, want 2`), i.e. the guard WOULD fail against the pre-fix non-correlated body.** | rede-a PQS member must NOT count a rede-b plan. | (was) pqs.a open_count rose 1→2 on a rede-b plan. | `143_capa.sql` §M3 result-scope guard | **backend** | ✅ RESOLVED (`5f4baf5`); tester re-verified + guarded 2026-06-25 |
| BUG-NSP-004 | NSP-per-org (sub-phase B) | MAJOR | **APP bug — `advance_capa_action_core` (rebound per-org in `supabase/migrations/20260630000000_nsp_per_org.sql:686`, L706-711) omits the manual/sourceless-plan `else` branch its own sibling `can_write_capa` (L539-548) requires, so a NON-event-sourced CAPA (`source ∈ {manual, indicator, audit_finding, meeting}`) with NO assignee becomes UNWRITABLE BY ANYONE — including the enrolled PQS member who opened it.** The PQS arm is `is_pqs_member_of(org_of_event(event_of_capa(v_capa_id)))`; for a non-event plan `event_of_capa`→NULL→`org_of_event(NULL)`→NULL→`is_pqs_member_of(NULL)`=false → HC050. `can_write_capa` handles exactly this with `else is_pqs_member_of_any(p_uid)` and its comment spells out the intent ("…those plans carry NO event PHI… 'any-org NSP member'… NULL org => is_pqs_member_of(NULL) is false, so the explicit branch is required"); the action-core rebind dropped it. **Repro (live, admin@ token):** `open_capa_plan{source:manual}` → `add_capa_action{no assignee}` → `complete_capa_action` ⇒ `400 {"code":"HC050"}`. Event/RCA-sourced CAPAs are unaffected (seeded CAPA-0001 is `source:rca` → C13 advance passes). `complete_capa_action`/`advance_capa_action` both route through the core. **Fix (backend, do not let me edit app code):** route the PQS arm through `app.can_write_capa(v_capa_id, v_uid)` (or add the same `event_of_capa IS NULL → is_pqs_member_of_any` branch) so manual-source plans stay writable by any-org NSP members — mirroring the immediate-sibling consolidation. | A PQS member who opens a manual-source CAPA can complete/advance its actions (`complete_capa_action`→200). | `complete_capa_action` on a manual-source plan's action returns `400 HC050 "você não pode alterar esta ação corretiva"` even for the plan's opener (an enrolled PQS member). | `e2e/phase14d-capa.spec.ts` C8/C10/C11/C12 (manual-source CAPA close/reopen lifecycle) | **backend** | ✅ RESOLVED (`6acc3dc`) — PQS arm now routes through `app.can_write_capa(v_capa_id, v_uid)` (DRY: identical authority to the 8 `capa_*_write` policies + `assert_capa_writable`, so no drift possible). Proven live: non-assignee PQS member advances a manual CAPA action (`em_andamento`); regression guard — cross-org member still `can_write_capa=false` on an event-sourced CAPA. pgTAP `143_capa` + full suite PASS (1094). **Consistency sweep — the "non-event fallback applied uniformly?" class CLOSED:** `advance_capa_action_core`→FIXED (now via `can_write_capa`); `can_write_capa`→already (explicit `event_of_capa IS NULL → is_pqs_member_of_any` branch); `assert_capa_writable`→already (delegates to `can_write_capa`); 8× `capa_*_write` policies→already (all delegate to `can_write_capa`; none call `is_pqs_writer`/`org_of_event` directly — verified); `open_capa_plan`→already (explicit `v_src_event IS NULL` branch); `capa_kpis`→already (M3 `in_scope` non-event fallback). **Tester RE-VERIFIED 2026-06-25: `phase14d-capa` now 19/19 PASS (the 4 previously-failing C8/C10/C11/C12 manual-source CAPA tests pass); `phase14c-rca` 17/17. Confirmed green on a fresh reset.** |
| BUG-NSP-005 | NSP-per-org (sub-phase B) | MAJOR | **APP bug — the per-org QPS referral dashboard (`src/app/o/[org]/nsp/encaminhamentos/page.tsx`) shows ZERO referrals to an enrolled PQS-member-only user (the canonical QPS persona `pqs.a@`), while it works for `admin@` only because admin@ is also an org_admin.** The page org-scopes the RLS-bounded referral list by intersecting it with `listCommissionsForOrg(access.orgId)` (page L96-101: `orgCommissionIds = new Set(commissions.map(c=>c.id))` then `referrals = allReferrals.filter(r => orgCommissionIds.has(r.sourceCommissionId) || orgCommissionIds.has(r.targetCommissionId))`). But `listCommissionsForOrg` (`src/lib/queries/org.ts:139`) reads `commissions` under RLS `commissions_select_member_or_admin` = `is_member_of(id) OR is_org_admin_of(organization_id)` — which has **NO PQS term**. A PQS-member-only user (no commission membership, no org_admin role) sees **0 commissions** → `orgCommissionIds` is empty → the filter drops EVERY referral → empty dashboard. The data layer itself is fine: `listAllReferrals` passes its `is_pqs_member_self()` gate (true for pqs.a) AND `case_referral` RLS (`can_read_referral` includes the PQS term) returns ENC-0001/0002 to pqs.a — proven live (direct `case_referral` SELECT as pqs.a returns the rows). The bug is purely the dashboard's commission-set intersection. **Repro (live):** sign in `pqs.a@test.local` → `/o/rede-a/nsp/encaminhamentos` → page renders (H1 "Encaminhamentos entre comissões") but 0 referral rows (no ENC codes, no subjects); `commissions?organization_id=eq.<rede-a>` as pqs.a returns `[]`. `admin@` (org_admin) sees the referrals. **Fix options:** (a) FRONTEND — derive `orgCommissionIds` from a source that a PQS member can read (e.g. a DEFINER RPC like the existing `list_org_eligible_users_for_pqs` pattern, or skip the client-side intersection and trust the already-org-scoped `listAllReferrals` if it can be made org-aware); OR (b) BACKEND — add a PQS/coordinator term to `commissions_select` (mirrors the `organizations_select` PQS broadening already done for the NSP seam), so a PQS member can read their org's commission list. Recommend (a) if the dashboard should stay the only surface that needs it, else (b) for parity with the org-row broadening. | The QPS referral dashboard shows the org's referrals (ENC-0001 etc.) to an enrolled PQS member. | Dashboard renders empty (0 referrals) for `pqs.a@`; works only for `admin@`/org_admins. | `e2e/phase22-referrals.spec.ts` Flow 3b (QPS member reads ENC-0001 via the per-org QPS referral dashboard) | **backend** | ✅ RESOLVED (`9c53035`) — lead chose fix (b): broadened `commissions_select_member_or_admin` += `OR is_pqs_member_of(organization_id) OR is_nsp_coordinator_of(organization_id)` (EXACT parity with the §A2.5b `organizations_select` broadening). `listCommissionsForOrg` is invoker-RLS so it takes effect with NO FE change. Proven per-persona: `pqs.a` reads rede-a's 2 commissions (was 0 → dashboard now shows ENC-0001/0002), 0 rede-b (cross-org denied); `pqs.b` inverse; `nspcoord.b` (unenrolled coordinator) reads rede-b's 2 to curate, 0 rede-a; plain non-PQS member (`staff1.ccih`) still reads only his 1 commission (NOT widened); `platform@`'s all-commission read is pre-existing via the `commissions_admin_write` ALL-policy, untouched. Full pgTAP PASS incl. 170/171/172 isolation. **Tester RE-VERIFIED 2026-06-25: `phase22-referrals` 29/29 PASS (Flow 3b — the QPS dashboard shows ENC-0001/0002 to `pqs.a`). Added pgTAP guard `176` §D (+8): D1 pqs.a reads rede-a's 2 commissions (was 0) + 0 rede-b; D2 nspcoord.a same; D3 KEYSTONE NEGATIVE — a plain non-PQS member (chefe.ccih) STILL reads only its own 1 commission (NOT the org's 2) + 0 cross-org, mutation-proved (1→2 fails); D4 policy carries all four arms.** | The QPS referral dashboard shows the org's referrals (ENC-0001 etc.) to an enrolled PQS member. | Dashboard renders empty (0 referrals) for `pqs.a@`; works only for `admin@`/org_admins. | `e2e/phase22-referrals.spec.ts` Flow 3b + `supabase/tests/176_nsp_per_org_b_support.sql` §D | **backend** | ✅ RESOLVED (`9c53035`); tester re-verified + guarded 2026-06-25 |
| BUG-FBE-004 | form-builder-enhancements | BLOCKER | **APP bug — `WizardRunner` adapter in `src/components/responses/wizard/wizard-runner.tsx` drops `observationsByItemId` before calling `saveSection` server action.** `WizardClient` passes `observationsByItemId` in `actions.saveSection(input)`, but `WizardRunner`'s implementation of that interface has `input` typed without `observationsByItemId` (L33-43) and passes `saveSection({responseId, sectionId, answersByItemId, clearItemIds})` without forwarding `input.observationsByItemId`. The field is silently dropped. Result: no observation is ever written to `answers.observation`, so `getSubmissionDetail` builds an empty `observationsByItemId`, "Observação:" never renders on any read surface. Repro: fill a form → add an observation → submit → submission detail shows no observation. Fix: add `observationsByItemId?: Record<string,string>` to the input type in `WizardRunner.saveSection` and forward `observationsByItemId: input.observationsByItemId` to the `saveSection` server action. Same fix needed for `saveAndExit` input type + forwarding. | "Observação:" label + observation text render on the submission detail page. | `getByText(/Observação:/i)` not found; observation silently dropped at the adapter layer. | `e2e/form-builder-enhancements.spec.ts` AC-12 + AC-K (serial block) — core observation persistence path | **frontend** | ✅ RESOLVED (`deb436c`) — the `WizardRunner` adapter now forwards `observationsByItemId` to BOTH `saveSection` and `saveAndExit` by binding its input types to `Parameters<WizardActions["saveSection"]>[0]` (the source of truth — any future field is a compile error here until forwarded, so the narrower-literal regression can't recur); `saveSection` persists it via `p_observations` → `save_section_answers` → `answers.observation`. **Lead re-verified 2026-06-30:** `form-builder-enhancements.spec.ts` **15/15** in isolation on a fresh reset (AC-9 fill · AC-12/AC-13 read · AC-K keyboard · AC-14 sign-off review all green) + present in the processless full E2E dev run (439/0). |
| BUG-FMN-001 | form-model-norm | BLOCKER | **APP bug (query layer) — `VERSION_TREE_SELECT` in `src/lib/queries/forms.ts:453-459` embeds `form_item_options(...)` AMBIGUOUSLY, so PostgREST returns `PGRST201` and the entire form tree fails to load.** After normalization there are TWO relationship paths between `form_items` and `form_item_options`: (1) the direct FK `form_item_options_item_id_fkey` (item_id→id), and (2) a many-to-many via `answer_selected_options` (which FKs to both tables). The bare embed `form_item_options(id, code, label, color_token, score, analytics_code, position)` (L459) doesn't disambiguate, so PostgREST can't resolve it. `getEditableDraftTree` (L512, logs the error) and `getVersionTree` (L533, silently returns null) BOTH break. **Blast radius (all read paths that build the version tree):** builder edit view (empty page — no "Adicionar bloco"/"Publicar"), wizard fill (`getResponseForFill`→`getVersionTree`→null→**ERRO 404** on `/responder/<id>`), published-form manage view + versions view, dashboard `answerableItems` (`dashboard.ts:428`), and process-template phase reads (`process-templates.ts:359`). **Repro (live, service key):** `GET /rest/v1/form_versions?select=...form_items(form_item_options(id,code))` → `PGRST201 "Could not embed because more than one relationship was found for 'form_items' and 'form_item_options'"`, hint = `form_item_options!form_item_options_item_id_fkey`. Reproduced in-app: new draft builder renders empty `<main>`; seeded Form A `/responder/<id>` renders ERRO 404. **Fix (backend/query owner — do NOT let tester edit src):** disambiguate the embed to the direct FK, e.g. `form_item_options!form_item_options_item_id_fkey(id, code, label, color_token, score, analytics_code, position)` in `VERSION_TREE_SELECT`. Re-run T-1 after. | Builder loads its blocks; wizard `/responder/<id>` renders the form controls; `getVersionTree`/`getEditableDraftTree` return a populated tree. | `PGRST201` ambiguous-embed error; builder `<main>` empty (no add-block/publish); wizard fill page = ERRO 404; `getVersionTree` silently null. | `e2e/form-model-normalization.spec.ts` NORM-1..4 (blocked at `openAddBlock`) + regression: `phase4-builder`, `phase5-wizard`, `phase8-dashboard` all depend on the tree | **backend** | ✅ RESOLVED (`8e073a9`) — embed pinned to `form_item_options!form_item_options_item_id_fkey`; **tester re-verified 2026-07-01**: live REST returns option rows (no PGRST201); builder loads blocks + publishes; wizard `/responder/<id>` renders controls; NORM-1..4 + phase4/5/8 all reach the tree. |
| BUG-FMN-002 | form-model-norm | MAJOR | **APP bug (RPC) — `get_response_for_signoff` was NOT migrated to the normalized answer model, so the sign-off review omits EVERY choice (multiple_choice / dropdown / checkbox) answer.** The RPC (last defined in `supabase/migrations/20260623130000_signoff_observations.sql`, which PREDATES the normalization migrations `…010000+`) builds `answers_by_item` as `jsonb_object_agg(a.item_id, a.value) FROM public.answers` — but under normalization `answers.value` is scalars-only; choice selections live in `answer_selected_options`. So a reviewing staff_admin sees scalar answers + observations but NOT the selected option label. The parallel rehydration paths were fixed (TS `buildAnswerMaps` in `src/lib/queries/responses.ts` materializes `answer_selected_options` into `answersByItemId` for `getResponseForFill`/`getSubmissionDetail`); `get_response_for_signoff` is the one path that was missed. The render chain confirms the impact: `review-and-sign.tsx:60/89` reads `data.answersByItemId[item.id]` → `AnswerSummary` resolves code→label from the item's options — with the code absent, the label never renders. **Repro (live):** fill FORM_SIGNOFF as staff1 (short_text S0 + MC "Aprovado" S1 + an observation) → open `/o/rede-a/c/ccih/manage/assinaturas/<id>` as chefe.ccih → the observation line renders but the MC label "Aprovado" is absent. **Fix (backend — do NOT let tester edit RPCs):** make `get_response_for_signoff` build `answers_by_item` from `app.answer_map(p_response_id)`-equivalent logic (mirror the fill/submission-detail materialization: scalars from `answers.value`, single-choice→scalar code, checkbox→ordered code array from `answer_selected_options`). Re-run T-1 after. | The sign-off review shows the selected choice-option label (e.g. "Aprovado") alongside its observation. | Only scalar answers + observations render; choice-answer labels are missing (the code is never materialized into `answers_by_item`). | `e2e/form-builder-enhancements.spec.ts` AC-14 (`getByText('Aprovado', { exact: true })` not found; observation line DOES render) | **backend** | ✅ RESOLVED (`eacbe2f`) — `get_response_for_signoff` now materializes `answers_by_item` via new `app.answer_map_by_item` (scalars + single-choice code + checkbox code array). **Tester re-verified 2026-07-01:** live helper returns `{free_text, "nao", "tarde", ["luvas","mascara","touca"]}`; FBE **AC-14 PASS**; `phase6-signoffs` GREEN. |
| BUG-HAT-001 | Hospital-admin tier (Phase A) | BLOCKER | Root landing (`src/app/page.tsx`) never checked `context.hospitalAdminOf` — a `hospital_admin`-only persona (`hospitaladmin.a1@`/`.dual@`, no org_admin role, no commission membership) fell through every precedence branch to the `NoAccess` "Você ainda não tem acesso" screen instead of `/o/<org>/manage`. | `hospitaladmin.a1@`/`.dual@` land on `/o/rede-a/manage` (ADR 0051 Decision 7). | "Você ainda não tem acesso" dead end. | `e2e/hospital-admin-tier.spec.ts` HA-1/HA-3 | frontend (`src/app/page.tsx`) | ✅ RESOLVED — fix `9b2a0ff` (added the `hospitalAdminOf` landing branch); was inert until BUG-HAT-003 (RLS) landed. Tester re-verified 2026-07-03: landing + switcher pass; full spec 38/38 GREEN. |
| BUG-HAT-002 | Hospital-admin tier (Phase A) | BLOCKER | `getCommissionAccessByOrgUncached` (`src/lib/queries/session.ts`) resolved `role` from `memberRole ?? (isOrgAdmin ? 'staff_admin' : null)` only, never consulting `hospitalAdminOf`; the TS mirror `isCommissionAdmin` (`src/lib/auth/access.ts`) existed but was dead code. Every `/o/[org]/c/[commission]/manage/**` page gated on `role==='staff_admin'` 404'd a hospital_admin of that commission's hospital (ADR 0051 Decision 1). | `hospitaladmin.a1@` reaches `/o/rede-a/c/ccih/manage/**` as its hospital's staff_admin would. | 404 on every commission-manage sub-route. | `e2e/hospital-admin-tier.spec.ts` HA-1/HA-4/HA-5/HA-6 | backend (`session.ts` + `access.ts`) | ✅ RESOLVED — fix `18b37af` (wired `isCommissionAdmin` in); was inert until BUG-HAT-003 populated `hospitalAdminOf`. Tester re-verified 2026-07-03: commission-manage reachable for a1/dual; full spec 38/38 GREEN. |
| BUG-HAT-003 | Hospital-admin tier (Phase A) | BLOCKER | **Root cause behind HAT-001/002.** `getSessionContext` builds `hospitalAdminOf` from an `organization_members` self-read with embedded `organizations`+`hospitals`, then filters out null embeds. But `hospitals_select` and `organizations_select` (baseline `20260620000000`) were `USING (is_admin() OR is_org_admin_of(organization_id))` — neither admitted a hospital_admin reading its OWN hospital/org, so both embeds resolved null, the filter dropped every row, and `hospitalAdminOf` was `[]` at runtime — starving both merged fixes. The A10 self-read arm was added to `organization_members` (`…000500`) but the sibling `hospitals`/`organizations` reads were not widened. | A hospital_admin reads its own hospital + org (minimum-necessary) so `getSessionContext` resolves `hospitalAdminOf`. | Both embeds null → `hospitalAdminOf=[]` → landing dead-end + commission 404s persisted despite HAT-001/002. | `e2e/hospital-admin-tier.spec.ts` HA-1/HA-3/HA-5/HA-6 (17 fails, all rooted here) | backend (RLS `hospitals_select` + `organizations_select`) | ✅ RESOLVED — fix `b6338a0` + migration `…000800`: `hospitals_select` += `is_hospital_admin_of(id)`; `organizations_select` += `is_org_level_admin_within(id)` (new helper — an org-level admin holds no commission membership). Live self-verify: a1→[Central A], dual→[Central A, Secundário A], chefe.ccih→[] (no false positive). pgTAP 188 §6 (own read + per-hospital isolation). Tester re-verified 2026-07-03: all 17 pass, full spec 38/38 GREEN. |
| BUG-PRE-001 | Pre-existing (non-Phase-B) | MINOR | `hospital-admin-tier` HA-4 titles reorder assertion didn't flip (GSAP-Flip class). | Reorder changes first title. | First title unchanged. | `hospital-admin-tier.spec.ts` HA-4 | tester | ✅ RESOLVED 2026-07-04 (`a4caab0`, branch `fix/e2e-pre-bugs`). Root cause = SPEC fragility not app code: fixed `waitForTimeout(500)`+non-retrying assert; rewritten to `expect.poll(10s)`. App path (`useFlipReorder`→`reorderMemberTitles`→`router.refresh`) correct. |
| BUG-PRE-002 | Pre-existing (non-Phase-B) | MINOR | `phase10-meetings` AC2 signing flow: "Assinar" never appears in the full dev suite. | Sign flow completes. | Button times out. | `phase10-meetings.spec.ts` AC2 | — | ✅ NOT AN APP DEFECT (2026-07-04). Passes 3/3 on a fresh `db reset --local`+`next dev`; full-suite failure = dev load/fixture flake; prod-standalone failure = BUG-AIF-001. App + `sign_meeting` RPC correct. |
| BUG-PRE-003 | Pre-existing (non-Phase-B) | MINOR | `phase11-interviews` AC2a: "Adicionar entrevistador" dialog won't close after add. | Dialog closes. | Dialog stays open. | `phase11-interviews.spec.ts` AC2a | — | ✅ NOT AN APP DEFECT (2026-07-04). Full file passes 10/10 on a fresh `next dev` stack; full-suite failure = dev flake; prod-standalone = BUG-AIF-001. `add_interview_interviewer` returns row → dialog closes. |
| BUG-QI-001 | 15 | BLOCKER | **Every indicator DETAIL page crashed to the `error.tsx` boundary on the prod (standalone) build.** A plain server closure (`capaHref = (capaId) => nspHref(...)`, `[indicatorId]/page.tsx` L82) was passed as a prop to the `<CapaAffordance>` client component → RSC "Functions cannot be passed directly to Client Components" serialization crash BEFORE render (digest `1343968568`); not caught by `next build`/tsc (runtime-only; dev behaves differently). Reproduced 7/7 detail visits; blocked AC-1/2/3/4/5a/5b/7/9. | Detail renders the trend chart + measurement grid + two-tier CAPA affordance. | Error boundary on every detail visit. | `phase15-indicators.spec.ts` AC-1…AC-9 | frontend | ✅ FIXED 2026-07-06 — swept every function/closure prop across the server→client boundary (`CapaAffordance`/`IndicatorBuilder`/`IndicatorList` take plain strings + build hrefs internally via pure `routing.ts`); ALSO fixed a 2nd bug found in the same surface (F4 run-chart `next/dynamic({ ssr:false })` left the skeleton stuck on standalone prod → removed `ssr:false`, Recharts SSRs cleanly). Tester re-verified on a fresh standalone prod build + `db reset`: full Phase-15 spec 12/12 green, 0 "Functions cannot be passed" signatures. Full detail → [phase-15.md](phase-15.md). |

<!-- Phase 17 — Controlled-Document Lifecycle: 5 bugs, all RESOLVED + tester-verified 2026-07-06 (phase17 E2E 14/14 + pgTAP 47/47). Full DB-proven narrative for each → phase-17.md. -->
| BUG-DOC-001 | 17 | BLOCKER | Systemic form↔action FormData field-name mismatch (`documentVersionId`/`documentId` vs `versionId`/`commissionId`) broke the whole UI write path ("Documento não encontrado." on every write). | phase17-documents.spec.ts AC-1/3/4/5/7/9/13 | frontend | ✅ RESOLVED 2026-07-06 — aligned the 4 write forms to the action contract (+ split a latent supersede-via-AddVersionForm mis-wire). → [phase-17.md](phase-17.md) |
| BUG-DOC-002 | 17 | MINOR (seed) | Seeded `storage_path` had no backing storage object → "Sem arquivo". | phase17-documents.spec.ts AC-2 | backend (seed) | ✅ RESOLVED 2026-07-06 — NULLed the dangling path (honest "Sem arquivo"; download coverage = AC-1 real upload). → [phase-17.md](phase-17.md) |
| BUG-DOC-003 | 17 | BLOCKER | `approvers` JSON serialized camelCase but `submit_document_for_approval` reads snake_case → NULL id → misleading HC091. | phase17-documents.spec.ts AC-1/4/5/7 | backend (action) | ✅ RESOLVED 2026-07-06 — mapped camel→snake in the action (TS↔SQL boundary; form stays camelCase). → [phase-17.md](phase-17.md) |
| BUG-DOC-004 | 17 | BLOCKER | Supersede UI dead-end on the coordinator detail page (new draft unreachable). | phase17-documents.spec.ts AC-5/7 | frontend | ✅ RESOLVED 2026-07-06 — separated in-force version from working draft (backend state correct, per lead). → [phase-17.md](phase-17.md) |
| BUG-DOC-005 | 17 | BLOCKER | Org approver-detail page signed the wrong version after a supersede (same class as DOC-004, sibling page). | phase17-documents.spec.ts AC-5 | frontend | ✅ RESOLVED 2026-07-06 — whole-UI sweep + extracted shared `version-select.ts` (both detail pages consume it); also fixed a 2nd latent cross-version `isPendingApprover` bug. → [phase-17.md](phase-17.md) |
| BUG-FBE-005 | Form-builder batch | BLOCKER | Client value-import of `OTHER_OPTION_LABEL`/`OTHER_OPTION_CODE` from server-only `queries/forms.ts` pulled `next/headers` into the client bundle → `next build` aborted + wizard-fill/builder routes errored on dev. | (build gate) | backend+frontend | ✅ RESOLVED 2026-07-07 — consts relocated to client-safe `src/lib/forms/option-constants.ts` (re-exported); 3 client imports repointed; `next build` EXIT 0. → [adjustments-batch.md](adjustments-batch.md) |
| BUG-FBE-006 | Form-builder batch | BLOCKER | Aggregate result rules couldn't save — `validate_template_result_ruleset` rejected `__total_score__`/`__flagged_count__` via HC016 (compute wired, save/validate seam wasn't). | flagged-aggregate-result.spec.ts AC-1/2/3 | backend | ✅ RESOLVED 2026-07-07 — migration `…001000` whitelists the 2 synthetic keys (mirrors `__phase_result__`), skips option-code assertion for numeric values; unknown key still HC016; pgTAP `202` §5. → [adjustments-batch.md](adjustments-batch.md) |
| BUG-FBE-007 | Form-builder batch | MAJOR | Masked time `930`→`93:0`→blur cleared instead of `09:30`. | wizard-others-ux AC-2 / views-labels AC-6b | frontend | ✅ RESOLVED 2026-07-07 — mask↔normalize made self-consistent; ultimately mooted by restoring the segmented time control (human decision). → [adjustments-batch.md](adjustments-batch.md) |
| BUG-FBE-008 | Form-builder batch | MAJOR | "Outro" free text never persisted — absent from the save payload. 4 iters chased upstream suspects; TRUE cause = `wizard-runner.tsx` `actions` adapter hand-listed forwarded fields and OMITTED `otherTextByItemId` in both saveSection/saveAndExit (BUG-FBE-004 recurrence; optional-field omission is tsc-invisible). | wizard-others-ux.spec.ts AC-4 | frontend | ✅ RESOLVED 2026-07-07 (iter-4) — spread-forward the whole input in both adapters (recurrence-proof) + adapter-layer regression test; wire-confirmed `otherTextByItemId` + non-NULL `other_text` on resume; 5-spec batch 29/29. → [adjustments-batch.md](adjustments-batch.md) |
| BUG-FBE-009 | Form-builder batch | NOT-A-BUG (test-selector) | Filed MAJOR vs the app; frontend proved app correct — AC-9's `.first()` observação locator grabbed an unrelated unanswered controller MC's disabled button. | form-builder-enhancements AC-9/12-13/K/14 | tester (test-side) | ✅ RESOLVED 2026-07-07 — reclassified NOT-A-BUG; app gained `aria-label="Adicionar observação — <pergunta>"`; tests scoped to per-item name + `toBeEnabled`. → [adjustments-batch.md](adjustments-batch.md) |
| BUG-ADM-001 | Administrativo (ADR 0061) | **MAJOR** — the `create_cases` + `assign_case_phases` capabilities are NON-FUNCTIONAL through the UI | The affordance-gated server actions in `src/lib/cases/actions.ts` still pre-gate on the coordinator-only `authorizeCommission` (returns true only for `admin` / `staff_admin` member), so an Administrativo's submit is rejected with `MESSAGES.forbidden` **before** the widened DEFINER RPC is reached — even though the frontend renders the affordance and the RPC itself admits the capability holder. Affected: **`activatePhase` (L539)**, **`reassignPhase` (L651)**, **`createCaseFromTemplate` (L369)**, **`createCase` (L438)**. Only **`updateCaseMeta` (L500)** was correctly written to SKIP the pre-check and rely on the RPC gate (see its L477-479 comment — the intended pattern). **Repro (E2E `administrativo.spec.ts` › BUG-ADM-001):** as `staff2.ccih` (Administrativo, `assign_case_phases`), open a fresh case's staff route → "Ativar e atribuir" → pick assignee → "Ativar fase". The dialog closes only on `state.ok`; it stays open (the action returned `forbidden`). **Proven not-an-RLS-issue:** the same `activate_phase` / `reassign_phase` RPCs called under `staff2`'s OWN JWT (flag ON) SUCCEED and auto-grant the assignee `case_access` write (POS-3 passes). **Fix:** remove the `authorizeCommission` pre-check from those four actions (mirror `updateCaseMeta`), letting the RPC's `member_can` gate be the authority; a rejection maps to `mapCaseError` → clean pt-BR forbidden. | Administrativo can create a case and activate/reassign a phase through the UI (the affordance already renders). | Server action returns `forbidden`; the create / activate / reassign dialog stays open, no mutation. | `administrativo.spec.ts` › REG-ADM-001 (UI activate lands server-side); create/reassign shared the identical `authorizeCommission` pre-gate | backend | ✅ **RESOLVED + verified 2026-07-07.** Fixed by dropping the coordinator pre-gate from `createCase`/`createCaseFromTemplate`/`activatePhase`/`reassignPhase` (+ the same-class shadow in `createMeeting`); RPC `member_can` is now the authority. Tester re-verified on a fresh standalone build: an Administrativo's UI "Ativar e atribuir" lands server-side (phase→ativa, assignee auto-granted `case_access` write); **all 10 `administrativo.spec.ts` green.** |
| BUG-AIF-001 | Action-items fold / cross-cutting (first surfaced pre-F2, confirmed through F2/F3 gates) | HIGH | On the **prod-standalone** build, every `useActionState` mutation dialog (case action-items, document/tag dialogs, F2 meeting/case-document upload dialogs) returned 200 + wrote the row, but never closed — stuck on "Salvando…/Enviando…". Deep-diagnosed 2026-07-04 to a "200 response body never delivered" signature (Next/RSC/`revalidatePath`/`@supabase/ssr` proxy/response-size all ruled out by experiment); a Linux/Docker-native repro (2026-07-11) proved it wasn't Windows-only. **Root cause found 2026-07-11 (session 2):** an upstream Next.js App-Router bug — a route's `loading.tsx` Suspense boundary + the server action's deferred `router.refresh()` (a discarded action advances the router action queue against stale state, so the refresh never flushes); `vercel/next.js` issues #86151/#86055, fix [PR #95391](https://github.com/vercel/next.js/pull/95391). The earlier "RSC truncation" theory was a CDP `getResponseBody` misread (React had already consumed the body). | `cases-extras.spec.ts` AC-Docs/AC-Tags/AC-ActionItems; `phase-f2-attachments.spec.ts` F2-1/F2-4 | lead | ✅ **RESOLVED 2026-07-11** — proven via a 3-run control matrix on a prod standalone build: (1) `next` 16.2.9 + `loading.tsx` intact → HANGS; (2) 16.2.9, `loading.tsx` removed → PASSES (6.8s); (3) `next` 16.3.0-preview.5, `loading.tsx` intact → PASSES (6.1s). **Fix landed = the Next bump to `16.3.0-preview.5`** (carries #95391; confirmed current in `package.json`), keeping every loading skeleton. Regression gate PASSED same day: full E2E on the 16.3 prod build = 608 pass/12 fail, every failure pre-existing (stale form-builder label-rename assertions + known flakes below the documented baseline) — **zero 16.3 regressions**; independently reconfirmed clean through the later F2 (24/24, upload dialogs green) and F3 (632p/6f, 0 F3 reg) gates. Move to 16.3.0 stable when it ships. **— DONE 2026-08-08** (`next: 16.3.0` stable in `package.json`; full `e2e:prod` on it = ZERO assertion failures, 991 passed). **The follow-up FUP-AI-1 was CLOSED by the PO 2026-08-10 without a refactor** — canonical repro re-run on the stable toolchain: GATE GREEN 8/8, 17.9s, mutation tests 1.2–2.0s vs the 21–31 s hangs. Close-out + what is deliberately NOT claimed → [ai-satellites.md](ai-satellites.md) § Pre-pilot follow-ups. → [bug-aif-001-linux-handoff.md](bug-aif-001-linux-handoff.md); memory [[case-dialog-prod-refresh-layout-revalidate]] |
| BUG-MEM-001 | S1·MEM (memberships collapse) | **BLOCKER** — real product regression, not test-only | `src/lib/queries/members.ts:64` `listMembers()` embeds `profiles(full_name, email)` inside a `.from('memberships').select(...)`. Since MEM added a second FK from `memberships` to `profiles` (`granted_by → profiles.id`, alongside the pre-existing `principal_id → profiles.id`), PostgREST can no longer resolve the unqualified `profiles(...)` embed and returns **`PGRST201`** ("Could not embed because more than one relationship was found for 'memberships' and 'profiles'"), HTTP **300**. `members.ts` does not check `{ error }` on the query result, so the failed call silently degrades to `(data ?? [])` → an EMPTY roster is rendered — "Esta comissão ainda não tem membros." — for a commission that genuinely has members. **Repro (live-verified, fresh `supabase db reset`, `npm run dev`):** sign in `chefe.ccih@test.local`, `GET /o/rede-a/c/ccih/manage/members` → renders 0 members. Direct PostgREST call under her real session JWT for `memberships?commission_id=eq.<ccih>&select=id,principal_id,role` (no embed) returns all **9** seeded rows correctly (RLS/`has_role`/predicate family all correct — NOT an RLS bug); the SAME query WITH the embed (`select=id,...,profiles(full_name,email),commission_member_titles(name)`) returns `{"code":"PGRST201", "hint":"Try changing 'profiles' to one of the following: 'profiles!memberships_granted_by_fkey', 'profiles!memberships_principal_id_fkey'"}`. This also breaks 3/4 of `phase3-admin-members.spec.ts` AC2 tests when re-run targeted (`-g "AC2"`): "adds an existing org user via the picker" / "removes a staff member via AlertDialog" / "AlertDialog Cancelar" all fail on `memberRow` not found (the newly-added member never appears because the roster read returns empty). **Fix (for `backend`, not applied by tester):** qualify the embed with the explicit FK hint per PostgREST's own error message — `profiles!memberships_principal_id_fkey(full_name, email)` — in `members.ts:64`. | `manage/members` roster renders all commission members (staff + staff_admin); AC2 add/remove flows see the added member appear. | Roster renders 0 members / "Esta comissão ainda não tem membros." regardless of actual membership count; `listMembers` query returns HTTP 300 PGRST201, silently swallowed to `[]`. | `phase3-admin-members.spec.ts` AC2 (3 of 4 tests); violates MEM plan §6 E2E acceptance "staff_admin adds AND removes a staff member" (docs/plans/memberships-collapse-s6-1.md §6) and Rule 9 (typed data-access — the query must handle its own ambiguity, not silently drop rows) | backend | **RESOLVED + VERIFIED 2026-07-13 (tester).** Backend fix (fix loop 1, TS-only, no schema change): `members.ts:66` qualified to `profiles!memberships_principal_id_fkey(...)` + real `{error}` throw. Backend also caught a SECOND ambiguous embed my repo-wide grep missed — nested one level deep inside the `memberships!memberships_commission_id_fkey(...)` embed in `commissions.ts:84,120` (`listCommissionsForAdmin`/`getCommissionForAdmin`, backing `/admin/audit`'s commission list + `/o/[org]/manage/comissoes/[slug]`) — same PGRST201 risk, same fix pattern applied + error throws added. `org.ts`/`pqs.ts` use the column-hint form (`profiles:principal_id(...)`) and were confirmed already safe (unchanged). **Re-verification (fresh `supabase db reset`, `npm run dev`, chromium `--workers=1`):** ran the previously-failing specs + the regression-confirm specs together — `e2e/hospital-admin-tier.spec.ts` **38/38** (was 35/38, HA-4/HA-K now green), `e2e/phase3-admin-members.spec.ts` **15/15** (was 12/15, AC2 now green), `e2e/mem-memberships-collapse.spec.ts` **7/7** (regression-clean), `e2e/phase13-audit.spec.ts` **27/27** (regression-clean, audit-verb repoint still holds) — **87/87 total, 0 failures.** The admin commission-list path (`listCommissionsForAdmin`/`getCommissionForAdmin`) is live-exercised by `phase3-admin-members` AC1 ("admin opens commission detail page") and `phase13-audit` AC-3f-platform (`/admin/audit`) — both green, confirming it now populates. **CLOSED.** |


<!-- rotated from PROGRESS.md 2026-07-16 (lead, playbook §5): resolved, verified by tester -->
| BUG-SUP-001 | S1·SUP (supersession correction) | MEDIUM — real product gap, narrow but realistic trigger; no data corruption (RPC correctly refuses, just with a useless message) | `public.supersede_response` has no precondition check / error mapping for the platform's pre-existing "one `in_progress` draft per user per version" invariant (Architecture Rule 3, `responses_one_draft_per_user_idx` on `(form_version_id, created_by)`). **Repro (clean, fresh `supabase db reset`, direct RPC calls, no test leftovers):** as `chefe.ccih` (staff_admin CCIH), call `supersede_response(A)` where A is a standalone submitted Form-A response — succeeds, creates successor A′ `in_progress`. WITHOUT submitting A′, call `supersede_response(B)` on a DIFFERENT standalone submitted Form-A response B (same corrector, same `form_version_id`). The RPC's successor INSERT collides with the unique index and returns raw Postgres `23505` (`duplicate key value violates unique constraint "responses_one_draft_per_user_idx"`, detail `Key (form_version_id, created_by)=(...) already exists`). `supersedeResponseAction` (`src/lib/responses/actions.ts:590-611`) has a `switch (error?.code)` mapping only `HC0H0..HC0H4` / `23514` / `P0002` / `42501` — `23505` falls to the `default` branch → generic `MESSAGES.generic` ("Não foi possível concluir. Tente novamente."). Trigger is realistic: any staff_admin/commission-admin who starts correcting one wrong submission, gets interrupted, and tries to correct a SECOND wrong submission of the *same form* before finishing/discarding the first correction hits this. Not considered anywhere in ADR 0074 or `docs/plans/supersession-correction.md` (grepped both, zero hits for `one_draft_per_user`/`23505`/"concurrent correction"). NOT a data-integrity bug — the unique index correctly prevents two in_progress drafts; the gap is purely UX (no actionable pt-BR guidance, and technically a raw-code fallback rather than a discriminated message, though `MESSAGES.generic` itself IS pt-BR so Rule 10 "no raw Postgres reaches the UI" is NOT violated — the message is just unhelpful/generic instead of specific). | Either: (a) a discriminated pt-BR message telling the corrector they already have a correction in progress for this form and must finish/discard it first (mirrors the RPC's own `HC0H2` "já existe uma correção em andamento" messaging, one level up — per-form-version rather than per-response), or (b) if judged out of scope/acceptable, an explicit product decision to leave it as the generic fallback (defensible, but should be a conscious call, not a silent gap). | Generic "Não foi possível concluir. Tente novamente." — no indication of WHY or what to do. | Not covered by any pgTAP or E2E acceptance bullet in plan §8; found via manual RPC repro while debugging `sup-supersession.spec.ts` SUP-1 (the E2E spec itself does not trigger it in normal single-pass order — each SUP-1/4 correction fully submits or is isolated to a distinct predecessor/corrector, so the file as authored is order-safe and green). Violates no written acceptance criterion directly but is a real gap against the general product-quality bar (CLAUDE.md §8 "Errors user-readable in pt-BR" — technically met; the spirit of a *useful* discriminated error is not). | backend | **OPEN — reported, not fixed by tester (out of scope; tester never edits app code).** | F3 gate (pre-existing, NOT F3) | LOW — test-only; feature verified working | `nsp-per-hospital.spec.ts` AC-1b:315 + AC-5:716 deterministically time out (30s) on `page.waitForLoadState('networkidle')` after a **successful** `page.goto('/o/rede-a/nsp/{event}')` on the **prod-standalone** build — the event-detail page never reaches network-idle (GSAP/long-poll keeps the connection busy; the known Playwright `networkidle` anti-pattern), so the following `expect(bodyText).toContain(MRN)` is never reached. Reproduces on fresh-reset ISOLATION + retry #1 (nsp-alone = **30 pass / 2 fail**, deterministic, not flaky). NOT F3: `git diff` shows F3 touches ZERO NSP/event-detail/app-route files (only `conditions.ts` evaluator + 3 OP_LABELS files + inert migrations), so the served page is byte-identical to main; 30/32 nsp tests pass incl. EVERY real PHI-isolation/read assertion (AC-1/AC-6/AC-7). | Event-detail PHI panel renders; MRN assertion passes. | 30s `networkidle` timeout; assertion never reached. | `nsp-per-hospital.spec.ts:315,716` | tester | **RESOLVED 2026-07-12** (tester, per lead directive). Fix applied spec-side (no app code): AC-1b:315 + AC-5:716 `networkidle` → web-first `await expect(page.getByText(MRN)).toBeVisible()`; **all 23** non-deliberate `networkidle` waits in the spec converted to web-first assertions (the 1 remaining is an INTENTIONAL network-leak-audit settle on `/nsp-org`, now commented). Verified on a fresh `supabase db reset --local` + `npm run build` prod-standalone run (`node .next/standalone/server.js`, chromium, `--workers=1`, `unset CI`): **`nsp-per-hospital.spec.ts` 32/32** (38.3s) — was 30/32; the two 30s deterministic timeouts are gone. |
| BUG-FLAG-001 | AUTHZ (ADR 0078) — test-infra, but with a REAL live blast radius | **HIGH** — not test-only: it silently disarmed a LIVE PHI arm on the shared local stack after every run, and its false reading was written into a permanent ADR in the urgency-SUPPRESSING direction | `e2e/case-patient.spec.ts` + `e2e/patient-index.spec.ts` teardowns restored `case_patient` / `patient_index` / `case_referrals` to a **hardcoded `false`**, justified by the comment *"seed default — flag ships OFF"*. **That premise is FALSE.** `supabase/migrations/20260620000000_baseline.sql:25005-25018` force-sets all three to `true` via `insert … on conflict (key) do update set enabled = excluded.enabled`, and baseline is a **MIGRATION**, so `true` is the state in EVERY environment, production included. The "Ships OFF" phrasing survives only inside each flag's `description` **column** — stale narration that was mistaken for state. So the teardown did not *restore*; it drove the stack into a configuration no environment ships and left it there. **Repro (A/B, both on a fresh `RESET=1` reset, verified this session):** run `SPECS="e2e/case-patient.spec.ts" RESET=1 npm run e2e:prod` on the pre-fix file → **17/17 GATE GREEN** → then `select key, enabled from app.feature_flags` → `case_patient=false, case_referrals=false, patient_index=false`. **The suite is green and corrupting at the same time — the green result carries zero information about the teardown, which is the entire defect.** Live consequence: `case_referrals` left OFF disarms the PQS referral-PHI arm for any manual testing that follows. This is the mechanism behind the `backend`-vs-lead disagreement (`case_referrals = f` read after an e2e run vs `t` read after a reset — both readings correct, neither a fact), which put a false "inert" claim about a **live** PHI arm into ADR 0078 A36·3. | Teardown restores the value the environment ACTUALLY held. | Teardown wrote `false` — a value no environment ships — and left it. | `e2e/case-patient.spec.ts` afterAll (3 flags) + AC-4 finally (`case_referrals`); `e2e/patient-index.spec.ts` afterAll (`patient_index`) + AC-3 finally (`case_referrals`). Violates no acceptance bullet — it corrupts the shared fixture every other spec's bullets depend on. | tester | **RESOLVED 2026-07-15 (tester, own scope, e2e-only).** Replaced every hardcoded restore with **capture-in-`beforeAll` / restore-in-`afterAll`** (`captureFeatureFlags()` reads the live catalog via a `FLAGCAP:` sentinel — robust against the CLI's JSON envelope + version notices — and **throws** if a key has no row, so a silent no-restore can't recur). A captured restore cannot go stale when a default changes; a hardcoded `true` would only have been marginally better than the `false` it replaced. Lying comments corrected in all 3 files. **A/B proof:** OLD → 17/17 green + all three `false`; FIXED → 17/17 green + all three `true`. `patient-index` 15/15 + clean. `select … where enabled=false` → zero rows. tsc + eslint clean. |

<!-- rotated from PROGRESS.md 2026-07-17 (lead, playbook §5): AUTHZ Gate-2 resolved bugs, tester-verified -->
| BUG-STAGEC-READER | AUTHZ · Gate 2 · Stage C (meeting confidentiality — reserved sessions) | MAJOR — functional access defect + inaccurate security-relevant UI copy in newly-shipped Stage-C surface. NOT a leak (fails CLOSED, the safe direction): nothing over-exposed; a coordinator loses read access to content she herself authored. | The reserved-sessions panel's own copy (`src/components/meetings/reserved-sessions-panel.tsx`, the "Parte fechada…" paragraph) promises: *"itens sem caso, apenas os leitores indicados **e a coordenação**"* (case-less items: only the named readers AND the coordination). Live-probed against the real `get_reserved_session_items` RPC (ADR 0078 C5): as `chefe.ccih` (staff_admin/coordinator of CCIH, and the item's own author), calling the RPC for a case-less item whose reader list contains only `multi` returns `substance: null, decision: null` for her too — identical to any other non-reader. The schema has no item-level author/`created_by` column at all, so there is structurally no way for the RPC to grant an "I authored this" bypass; behaviourally there is also no "I am staff_admin of this commission" bypass — the reader list (`meeting_closed_session_item_readers`) is the SOLE gate for case-less substance/decision, both tiers, no exception. Repro (both the failing UI path and the direct RPC probe): `npx playwright test e2e/meetings-reserved-sessions.spec.ts --project=chromium --workers=1 -g "BUG-STAGEC-READER"` (test is `test.fail()`-marked — it PASSES by correctly reproducing the defect; it will start FAILING the moment this is fixed, which is deliberate so the fix can't go unnoticed). Direct RPC probe: create a case-less item as `chefe.ccih` with only `multi` as reader, then `POST rest/v1/rpc/get_reserved_session_items` as `chefe.ccih` — the item comes back with both fields `null`. Re-verified 2026-07-17 on a fully fresh dev server (killed a 2.5h-old leftover PID, restarted, fresh `db reset`) + full spec re-run — identical result, ruling out reused-server flakiness. | Per the panel's own copy, the coordinator (`chefe.ccih`) reads the substance/decision of a case-less item she authored, without needing to add herself to the reader list. | The RPC projects `null` for both fields to her — she must explicitly check her own name in the reader-list UI (same as any other member) or she cannot read back what she just wrote. | `e2e/meetings-reserved-sessions.spec.ts:408` (`test.fail()`-marked reproduction) | backend-authz (RPC coordinator-bypass) or frontend-stagec (copy correction) — PO/engineering call on which side is "correct" | **RESOLVED 2026-07-17 (tester, re-verified).** Adjudicated: keep the RPC behavior (reader list stays the sole gate, no coordinator bypass — fails closed, the safe direction), fix the copy. `frontend-stagec` corrected both call sites: `reserved-sessions-panel.tsx`'s "Parte fechada…" paragraph dropped "e a coordenação" (now: *"itens sem caso, apenas os leitores indicados"*), and `reserved-item-form.tsx`'s reader-list legend now warns explicitly: *"A coordenação não tem acesso automático — adicione seu próprio nome à lista para manter o acesso."* Re-verified live (read both files directly, fresh reset + full spec re-run): copy is accurate now, no false promise remains. The `test.fail()`-marked repro test correctly STILL fails as expected — the RPC/behavior is unchanged by design, only the copy changed — so the pin stays in place and will flip to a hard failure if a future change ever adds the bypass without updating the test. 8/8 spec green. |
| BUG-STAGEC-ACL | AUTHZ · Gate 2 · Stage C Wave 2 (meeting_cases / meeting_agenda_items projection) | MAJOR — genuine regression against a binding project rule + the purpose-built guard test for it; contained blast radius (measured, not assumed). | pgTAP `100_dashboard.sql` t19 ("no public function is anon-executable — catches any future PUBLIC re-leak") reddened on a fresh reset: `have: 3, want: 0`. Catalog-verified (`pg_proc.proacl`): `public.create_meeting_agenda_item`, `public.link_meeting_case`, `public.update_meeting_agenda_item` each carry `{=X/postgres,postgres=X/postgres,service_role=X/postgres}` — the bare `=X` entry is PUBLIC (incl. `anon`) EXECUTE, with no explicit `authenticated` grant at all (it rides PUBLIC). Root cause: ADR 0078 C1/C2 Wave 2's landmine-L1 fix (`RETURNING *` → `RETURNING id`/`returns uuid`, migrations `20260805000000`/`20260806000000`) re-emitted these three via `CREATE OR REPLACE FUNCTION` from live `pg_get_functiondef()`, which resets a function's ACL to the Postgres default (PUBLIC execute) — the migrations did not re-apply the project's own binding `REVOKE ALL … FROM PUBLIC; GRANT EXECUTE … TO authenticated;` pattern (memory: "every new `public.*` RPC must REVOKE ALL FROM PUBLIC before GRANT") after the re-emission. Reachability measured, not inferred: live-probed `link_meeting_case` as a genuinely unauthenticated `anon`-role caller (REST `apikey`+`Authorization: Bearer <anon key>`, no user session) → `401 {"code":"42501","message":"permission denied for schema app"}` — the function body touches an `app.*` helper before any table write, and `anon` lacks `USAGE` on the `app` schema, so the call fails closed before mutating anything. Contained, not wide-open, but still a real violation of the grant-hygiene invariant this specific guard test exists to enforce — both other Stage-C RPCs re-emitted the same wave (`get_meeting_cases`, `get_case_meeting_links`, `get_meeting_agenda_items`) correctly kept `REVOKE…FROM PUBLIC`+`GRANT…TO authenticated` (spot-checked, not anon-executable), so this is scoped to exactly the three landmine-L1 re-emits. Repro: `npx supabase test db supabase/tests/100_dashboard.sql` on a fresh reset. | 0 `public.*` functions are anon-executable (t19's own invariant). | 3 are: `create_meeting_agenda_item`, `link_meeting_case`, `update_meeting_agenda_item`. | `supabase/tests/100_dashboard.sql` t19 (not my scope to fix — SQL/migrations) | backend-authz | **RESOLVED 2026-07-17 (tester, re-verified).** `backend-authz` shipped `REVOKE ALL … FROM PUBLIC; GRANT EXECUTE … TO authenticated;` on all 3 functions (migration `20260815000000_authz_meeting_rpc_revoke_public.sql`, 138 migrations). Re-verified on a fresh reset: full `supabase test db` shows `100_dashboard.sql` fully green (only the pre-cleared `228` 115–118 remain in the whole 3147-test suite). Catalog spot-check confirms `anon=f, authenticated=t` on all 3. |
| BUG-GATE2-235-PLANCOUNT | AUTHZ · Gate 2 re-gate · A4 (`235_authz_a4_org_admin_not_case_source.sql`) | LOW — test-authoring only; zero functional defect found. | Fresh-reset full pgTAP (`npx supabase test db`, this re-gate) reports `235_authz_a4_org_admin_not_case_source.sql` as FAILED: `Tests: 41 Failed: 0`, `Parse errors: Bad plan. You planned 42 tests but ran 41.` Isolated re-run (`npx supabase test db supabase/tests/235_….sql --debug`) confirms a clean exit (Wstat 0, no SQL ERROR anywhere) with all 41 executed assertions green — including the two things this re-gate specifically required: **K1·DOOR** (`ok 9`/`ok 10`, via `list_cases_board`) and **K1·DENY** (`ok 36`-`ok 41`), both fully present and passing. Direct count of the file's own top-level `select is(/throws_ok(/lives_ok(` statements = 41, but line 33 reads `select plan(42);` — one higher than the file actually contains (a stale/miscounted plan literal, most likely left over from editing this file in the same fix wave that added K1·DOOR/K1·DENY). | `select plan(42)` at line 33 should equal the file's actual assertion count (41) so `pg_prove` reports the file PASS. | `pg_prove`/`supabase test db` marks the whole file FAILED on the plan/count mismatch alone, even though every individual assertion passed — this is what keeps the full-suite pgTAP run from reporting clean `Result: PASS`. | `supabase/tests/235_authz_a4_org_admin_not_case_source.sql:33` | backend (pgTAP file — outside tester's edit scope; a one-line `plan(42)`→`plan(41)`) | ✅ **FIXED & VERIFIED 2026-07-17** (post-drift audit, `235` now **42/42**; full pgTAP **112 files / 3186 / PASS**). Root cause: the fix wave added **8** assertions but bumped `plan(33)`→`plan(42)` (intended +9). The missing 9th is the **base-table no-over-reach twin** in the K1·DENY block (the base layer had a DENY twin but no no-over-reach twin, asymmetric with the board layer). **Restored the assertion** (not lowered the plan — the intended coverage was real), so the coordinator's scoped hard-deny is now proven at both the base table and `list_cases_board`. |
| BUG-GATE2-243-FIXTURELOCK | AUTHZ · Gate 2 re-gate · MAJOR-2 (`243_authz_c5_reserved_session_tiers.sql`) | MAJOR (test-only — no product defect found; but MAJOR-2's own dedicated RPC-level proof does not currently execute at all, which is exactly what this gate exists to catch — memory `pgtap-needs-fresh-reset-vs-e2e-leftovers` and ADR-0078 §7.1 "a test that cannot fail is not evidence" apply in spirit even though here the test can't even RUN). | Fresh-reset full pgTAP: `243_authz_c5_reserved_session_tiers.sql` FAILS: `Wstat: 768 (exited 3)`, `Tests: 27 Failed: 0`, `Parse errors: Bad plan. You planned 31 tests but ran 27.` Isolated `--debug` run shows tests 1-27 all green (`ok 1`…`ok 27`), then a hard SQL ERROR at line 211: `ERROR: o conteúdo desta reunião está bloqueado (distributed)` (raised by `app.guard_meeting_child_lock()`), which poisons the transaction for the rest of the file (repeated "current transaction is aborted, commands ignored") — tests 28-31 (the MAJOR-2 CONTROL, the two MAJOR-2 `throws_ok` keystones themselves, and the NO-OVER-REACH twin) never run at all; `red ≠ abort` (handoff §7.1). Root cause, confirmed against the **live catalog** (not migration text — CLAUDE.md's binding SQL exception): `select tgname, tgrelid::regclass from pg_trigger where tgname ilike '%child_lock%'` shows `guard_meeting_child_lock_closed_sessions_trg` IS attached to `meeting_closed_sessions` (one of the "three reserved tables" per MAJOR-2's own description), and `pg_get_functiondef('app.guard_meeting_child_lock')` shows it raises `23514` whenever the row's parent meeting's `status in ('in_signature','signed','distributed','cancelled')` — exactly as intended (MAJOR-2's commit message explicitly names `open_reserved_session` — which inserts into this same table — as one of the two RPCs the fix must now block). The test's OWN fixture (lines 208-211) inserts a brand-new meeting with `status='distributed'` set AT CREATION, then immediately inserts a `meeting_closed_sessions` row against it as unconditional, un-wrapped setup (not inside `throws_ok`) — i.e. the fixture performs, as ordinary setup, precisely the operation MAJOR-2 now (correctly) blocks. This reads as a fixture-ordering bug in the same commit that added these tests (`b91b41a`): the closed session needs to exist BEFORE the meeting is flipped to a locked status (e.g. create the meeting open, insert the closed session while it's still writable, THEN `update meetings set status='distributed'` — a plain `meetings`-table UPDATE, which does not itself touch any of the three guarded reserved tables) so the later `open_reserved_session`/`add_reserved_item` RPC calls still have a pre-existing closed session to exercise MAJOR-2 against. Repro: `npx supabase test db supabase/tests/243_authz_c5_reserved_session_tiers.sql --debug` on a fresh reset. | The file reports 31/31 green, including the MAJOR-2 CONTROL (line 216), the two MAJOR-2 `throws_ok` keystones (lines 222, 226), and the NO-OVER-REACH twin (line 239). | The file aborts after 27 tests; MAJOR-2's own dedicated proof (tests 28-31) never executes — 0 pass, 0 fail, simply absent. | `supabase/tests/243_authz_c5_reserved_session_tiers.sql:208-211` (fixture) / `:216-242` (the 4 assertions that never run) | backend (pgTAP file — outside tester's edit scope) | ✅ **FIXED & VERIFIED 2026-07-17** (post-drift audit, `243` now **31/31** — MAJOR-2 keystones 28-31 now EXECUTE and PASS, proving the reserved-session child lock live). Root cause confirmed at line 211: the fixture inserted a `meeting_closed_sessions` row into an already-`distributed` meeting, tripping `guard_meeting_child_lock` (23514) at setup. ⚠ The originally-proposed 'create the session before distributing' fix is INSUFFICIENT — `guard_meeting_status` blocks a raw `scheduled→distributed` UPDATE (non-RPC path + invalid transition). Correct fix: plant the session while `scheduled`, then walk `held→in_signature→signed→distributed` under `app.in_meeting_rpc='on'` (the real conclude→sign→distribute lifecycle). No product defect — the lock was always correct. |

<!-- rotated from PROGRESS.md 2026-07-17 (lead, playbook §5): BUG-PROD-ACTIONS full investigation — RESOLVED = Next 16.2.9 env drift, confirmed in the Gate-2 audit -->
· 🔴 **P0 · BUG-PROD-ACTIONS — Server Actions do not dispatch in the prod standalone build.** Found by the Gate-2 `e2e:prod` gate 2026-07-17. **Predates Stage C; app-wide; NOT AUTHZ's bug** — PO-directed (2026-07-17) as its own unit, **before the pilot**; explicitly NOT a Gate-2 blocker. **Signature:** UI-button-driven Server-Action mutations hang 21–31s with a frozen pending button and **no error**; direct-RPC + read-only tests pass in 100–900ms. **Verified on pre-existing specs across unrelated features:** `phase10-meetings` (AC1b Concluir ✘+retry, AC2 signing ✘+retry, AC4e Reabrir ✘; while its RPC negatives pass in 112–147ms) and `cases-extras` (AC-Docs ✘31s, AC-Tags ✘11s, AC-ActionItems ✘16s). **Probe (FE, `REBUILD=1`):** zero `[PROBE]` lines — not even the action's first statement — and 0 DB rows ⇒ **the action never executes server-side**; the client dispatches (isPending latches), the server never runs it. **Eliminated:** action-throws (try/catch silent), refresh-inside-transition (plan-(b) disproved it), `revalidatePath`/`revalidateMeetings()`, `open_reserved_session`, the audit advisory lock, the VOLATILE `get_reserved_session_items` change, and machine-load/slowness (RSC render 72ms, server.log clean, all 15 chunks 200). **Remaining lead:** Server-Action dispatch/registration in the standalone build — fits the open button lacking `__reactProps$`/`__reactFiber$` while siblings have them, and the 0→1 specificity. ⚠ **Reclassifies the documented "~18–27 prod flaky baseline"** — likely this bug, not dialog/toast animation flakes. ⚠ **Coolify deploys this exact standalone build (see next line)** → if it reproduces there, **every mutation hangs in the pilot**. **Deterministic repro:** `REBUILD=1 SPECS=e2e/meetings-reserved-sessions.spec.ts npm run e2e:prod`. **Open discrepancy to resolve first:** the tester's direct DB query reported the session row EXISTS post-failure, the FE probe found 0 rows — both can't be right. **Next step:** capture the action POST in the browser against the prod build (does it fire? what status? does it ever respond?).
  > ⭐ **2026-07-17 (tester, Gate-2 RE-GATE) — LIKELY ROOT CAUSE FOUND: `node_modules/next` had silently drifted to 16.2.9 — the exact PRE-BUG-AIF-001 version — while `package.json`/`package-lock.json` both correctly declared `16.3.0-preview.5`.** `npm ls next` flagged it outright: `next@16.2.9 invalid: "16.3.0-preview.5" from the root project`. Confirmed independently three ways: the installed package's OWN `package.json` read `"version": "16.2.9"`; a fresh `next build`'s banner read `▲ Next.js 16.2.9`; `npm ls` agreed. This predates my session — I did not install/change any dependency before finding it — so it was already broken when the P0 above was filed, and BUG-AIF-001's own fix (2026-07-11) was **exactly** this upgrade, for **exactly** this symptom class (App-Router action/refresh stall). **Fixed:** `npm install` → `npm ls next` now clean, `next build` banner now reads `▲ Next.js 16.3.0-preview.5`. `package-lock.json`'s OWN `next` entry already specified `16.3.0-preview.5` correctly (it was `node_modules` that hadn't been reinstalled to match); the install did touch `package-lock.json` by 13 lines, but only cosmetic npm metadata churn unrelated to `next` itself (dropped stale `libc` platform-tags on 4 unrelated optional deps, added `"dev": true` to `fsevents`) — no package version changed. Left as committed; flagging for backend/lead review alongside the two filed bugs. **Re-ran the documented deterministic repro on the corrected install** (`rm -rf .next && REBUILD=1 SPECS=e2e/meetings-reserved-sessions.spec.ts npm run e2e:prod`, fresh reset+server): **8/8 GREEN, 17.4s total, GATE GREEN on the first try** — every mutation-driving test (open a reserved session, add a reserved item, the keyboard-only flow) completed in 0.6–2.1s each, versus the documented 21–31s hangs. Zero hangs, zero retries needed. This is strong evidence BUG-PROD-ACTIONS **was this environment drift, not a Next.js/React Server Components dispatch defect** — i.e., a **regression of the already-fixed BUG-AIF-001** via a stale `node_modules`, not a new mystery bug in the standalone build. **Not marking this row RESOLVED myself** — it was filed as its own PO-adjudicated pre-pilot unit, not a Bug Log row under my ownership, and the pilot-deployment implication ("if it reproduces in Coolify, every mutation hangs") deserves a fresh look with this evidence rather than a unilateral close. **Recommend:** re-run this repro from a totally clean `node_modules` (`rm -rf node_modules && npm ci`) as an independent confirmation, then have the lead/PO decide whether this P0 is resolved outright or merely "explained, verify no other cause is layered underneath." **Consequence for today's Gate-2 declare-green run:** proceeding to the full `e2e:prod` suite on the now-corrected install; expect the historical "~18–31 prod flaky baseline" to shrink, since BUG-PROD-ACTIONS was suspected (by this same PROGRESS.md row, "Reclassifies the documented '~18–27 prod flaky baseline'") to BE much of that noise. Will report the actual full-suite numbers, not assume.

<!-- rotated from PROGRESS.md 2026-07-23 (lead, playbook §5): BUG-AISAT-002 resolved + tester-verified (a9af7a7) -->
| BUG-AISAT-002 | Meetings (Phase 10) — surfaced via `action-items-satellites.spec.ts` §7.2 (S2·AI); NOT AI-satellites-specific | MAJOR — 100% reproducible, whole panel silently broken; fails CLOSED (empty list, never over-shows) so not a P0/PHI leak | **REAL APP BUG (not stale spec).** `listMeetingActionItems()` (`src/lib/queries/meeting-action-items.ts`) still SELECTed the literal `case_id` column (line 104; also stale at the `MeetingActionItemRow` field, the mapper, and the line-9 doc comment) after migration `20260818000300` renamed `action_items.case_id` → `linked_case_id` platform-wide. Every call → PostgREST `400 / 42703 "column action_items.case_id does not exist"`, swallowed by `if (error \|\| !data) return []` → the meeting-detail **"Itens de ação"** panel rendered empty for EVERY meeting, any commission, any `visibility_scope`. Confirmed vs the live catalog + a raw REST repro of the exact select string; ruled out RLS (`create_committee_action_item` RPC + RLS-scoped read-back returned the row). Isolated to this one call site (`case-action-items.ts`/`getActionItem`/`suggest_carry_forward` already correct). | `listMeetingActionItems` selects `linked_case_id`; panel shows every meeting-sourced item the viewer may read. | Panel always empty (rows exist + are RLS-readable); item reachable only via its own detail URL. | `e2e/action-items-satellites.spec.ts:539` (§7.2) | backend | **RESOLVED 2026-07-23 (commit `a9af7a7`, docs close-out `e767175`).** Renamed the four stale `case_id` refs to `linked_case_id`; also split the swallowed-error guard so a genuine query error now logs code/message/details/hint before failing closed (mirrors `getActionItem`) — future column drift fails loudly instead of silently emptying the panel; RLS denials still return `[]` with no error (no log-spam). Verified: 42703 reproduced vs live catalog; `tsc --noEmit` + `eslint --max-warnings=0` clean; fresh `db reset` then `action-items-satellites.spec.ts` **9/9 green** (chromium, workers=1), incl. the previously-failing §7.2/§7.3/§7.4. Spec left UNCHANGED — its assertion was correct all along. |

<!-- rotated from PROGRESS.md 2026-07-23 (lead): document-detail-redesign branch — 7 pre-existing-suite regressions from the redesign's shipped UI changes, ALL test-only (spec-side), ALL RESOLVED + tester-verified (doc suite 24/24). -->
| BUG-DDR-001 | document-detail-redesign | MAJOR (test-only) | Wizard `Tipo` became a native `<select>` (was a Segmented radiogroup); `selectSegmented()` (radio-based) timed out at all 9 doc-type call sites across both doc specs + the shared `buildPublishedDocViaWizard` helper. | Callers use a NativeSelect-aware `selectDocType()`. | `getByRole('radio', {name})` 30s timeout — role gone. | documents-redesign.spec.ts + phase17-documents.spec.ts + helpers/documents.ts | tester | RESOLVED 2026-07-22 — 9 sites → `selectDocType`; RW-1b/RW-10 re-authored for the select's keyboard/value model. Commit `a59574a`. |
| BUG-DDR-002 | document-detail-redesign | MINOR (test-only) | ApprovalsPanel nested under the "Versões" `<section>`; `section,hasText:'Aprovadores'.first()` bound to the wrong ancestor. | Locator uses `getByRole('region',{name:'Aprovadores'})`. | Over-broad section match. | documents-redesign.spec.ts:567,776 | tester | RESOLVED 2026-07-22 — both sites → region role. Commit `a59574a`. |
| BUG-DDR-003 | document-detail-redesign | MAJOR (test-only) | "Marcar como obsoleto"/"Substituir por rascunho em branco" moved behind a "Mais ações" overflow menu (menuitems, not top-level buttons). | Open "Mais ações" then act on the menuitem. | `getByRole('button',{name:/tornar obsoleto/i})` etc. timeout. | documents-redesign.spec.ts (RW-8) + phase17-documents.spec.ts (AC-5/AC-7) | tester | RESOLVED 2026-07-22d — open menu first. Commit `f60af12`. |
| BUG-DDR-004 | document-detail-redesign | MINOR (test-only) | Draft-edit link "Editar" → "Editar rascunho"; anchored `/^editar$/i` never matched. | Locator matches "Editar rascunho". | link locator timeout. | documents-redesign.spec.ts:710 (RW-9) | tester | RESOLVED 2026-07-22d — regex updated. Commit `f60af12`. |
| BUG-DDR-005 | document-detail-redesign | MAJOR (test-only) | "Publicar" now client-disabled while approvals pending, so AC-3's click-through-to-server-rejection path is unreachable via the UI. | AC-3 asserts the disabled-button UX + hits `publish_document` RPC directly for the HC090 guard. | click on disabled button retries 30s. | phase17-documents.spec.ts:223 (AC-3) | tester | RESOLVED 2026-07-22e (PO-authorized rewrite) — doc suite 24/24. Commit `d6d253a`. |
| BUG-DDR-006 | document-detail-redesign | MAJOR (test-only) | AC-4 encoded the pre-`changes_requested` reject→draft criterion (button "Rejeitar", terminal `draft`); both superseded by ADR 0082 (`changes_requested`), covered by documents-changes-requested.spec.ts CR-1. | RETIRE AC-4 (superseded). | `getByRole('button',{name:/^rejeitar$/i})` timeout. | phase17-documents.spec.ts (AC-4, removed) | tester | RESOLVED/RETIRED 2026-07-22 — AC-4 deleted, one-line pointer to CR-1. Commit `8662c26`. |
| BUG-DDR-007 | document-detail-redesign | MEDIUM (test-only) | (a) AC-2 chefe.farm pending-queue never showed DOC-0002; (b) AC-13 keyboard flow never focused its target. | Self-sufficient fixtures / current HEAD. | getByText('DOC-0002') false; focusByTabbing budget exceeded. | phase17-documents.spec.ts:194,725 | tester | RESOLVED 2026-07-22d — root-caused NOT app bugs: AC-2 was a shared-fixture ordering artifact (AC-13 permanently approves DOC-0002) → AC-2 now builds its own `in_approval` doc; AC-13 already green on current HEAD. Commit `f60af12`. |

<!-- rotated from PROGRESS.md 2026-07-23 (lead): the 3 remaining OPEN test-only bugs, all now RESOLVED + verified this session (fresh `db reset`, chromium). -->
| BUG-MAIO-001 | action-items overview (spec) | LOW (test-only) | `ItemRow` added a Título self-link to every row (commit 4f23558, closing a documented dead-end); member-action-items-overview AC-2/3 (`toHaveCount(0)`) + AC-7 (`.first()` link) assumed 1 link/row. | Assertions scoped to the "Gerado de" column (td[1]). | Row-level link count/target off by the new self-link. | member-action-items-overview.spec.ts:452,608,617 | tester | RESOLVED (verified 2026-07-23, lead) — all 3 sites already scoped to `td.nth(1)` with explanatory comments; member-action-items-overview 16/16 green on a fresh reset. |
| BUG-AISAT-001 | action-items satellites (spec) | LOW (test-only) | `action-items-satellites.spec.ts` §7.4 `openSatellites` timed out locating a MEETING-sourced item row. **Same root cause as BUG-AISAT-002**: `listMeetingActionItems()` selected the pre-rename `case_id` → the meeting "Itens de ação" panel was ALWAYS empty, so the row (and its "Ver detalhes" link) never rendered. | Panel lists meeting-sourced items → helper finds the row. | 30s timeout in openSatellites. | action-items-satellites.spec.ts (§7.4) | backend | RESOLVED (verified 2026-07-23, lead) — fixed by the BUG-AISAT-002 backend fix (`a9af7a7`) + the helper's rework to navigate via the row link; action-items-satellites 9/9 green (§7.1–§7.11) on a fresh reset, incl. §7.4. |
| BUG-F3E2E-002 | test-infra (full-suite ordering) | LOW (test-only) | Full-suite-only failures from cross-spec seed contamination (4 sites) + the Windows prod-standalone monolith backlog-collapse; each passes in isolation. | Each assertion order-independent. | Fails only under full-suite ordering. | case-access:AC-2 · ui-batch:S1 · views-labels:AC-4 · perf-sweep-wave2:P2-b | tester/infra/lead | RESOLVED 2026-07-23 (lead) — `reducedMotion` (playwright.config:28) + the chunked `e2e:prod` gate already in place; 3/4 sites already hardened (case-access AC-2 asserts by IDENTITY not global emptiness; ui-batch S1 is a non-destructive rename guard; perf-sweep P2-b calls `ensureReferralsFlagOn`). The last — views-labels AC-4's hardcoded `expect(rows.length).toBe(9)` — replaced with an IDENTITY assertion vs the live `memberships` set (mirrors the `seed_expected_meeting_attendees` RPC: one attendee per membership row, keyed `principal_id`). PROVEN order-independent by injecting 2 extra CCIH members → AC-4 green at 11 (the old `toBe(9)` would have failed with the exact "11 vs 9"). Full per-test DB isolation remains the only unaddressed durable item (large infra change, deferred — non-blocking). |

<!-- rotated from PROGRESS.md 2026-07-27 (lead): the 3 resolved bugs at the ETH·E3a + Case-Correction gate close — all RESOLVED + re-verified by tester (fresh db reset, chromium). Verbatim; PROGRESS.md keeps 0 open bugs + the pointer. -->
| BUG-CORR-001 | case-corrections (T-1) | MINOR (stale user-facing copy + dead code, not a security/data issue) | `ConcludeNarrativeButton`'s confirm dialog (`src/components/cases/conclude-narrative-button.tsx:52-53`) still reads "Ao concluir, o conteúdo desta narrativa é congelado e deixa de ser editável. **A coordenação pode reabri-la depois, se necessário.**" — but `reopen_narrative` was dropped platform-wide (BE-4) and NO "Reabrir narrativa" control exists anywhere in the render tree (grepped every `case-*.tsx`; only live "Reabrir" is the case-level `ReopenCaseButton`, ADR 0085 intended). Repro: sign in `chefe.ccih@test.local`, open any case with an open narrative, click "Concluir" on the narrative card → the confirm dialog text. Related dead code (same root cause, not user-facing but worth cleaning alongside): `case-narrative-card.tsx`'s `canReopen` prop (doc comment L52-53 + the guard at L213) and `case-phase-list.tsx`'s live `canReopen` computation (L160-163, `isOpen && status==='completed' && canManageLifecycle`) are both now VESTIGIAL — computed/threaded but never used to render a control. | The confirm-dialog copy should say the narrative can only be corrected via the correction lifecycle (no more in-place reopen); the dead `canReopen` prop/computation should be removed. | Copy still promises an in-place reopen; dead prop survives BE-6's stub cleanup. | `e2e/case-narratives.spec.ts` AC-9 | frontend | **✅ RESOLVED** — fixed by FE-4 `450d8d5` (copy now points at the correction lifecycle; `canReopen` removed from both files). Re-verified 2026-07-24 (tester, T-2): `e2e/case-narratives.spec.ts` AC-9 updated to assert the NEW copy + absence of the old string, clean-stack re-run green. |
| BUG-E3A-001 | ETH·E3a (T-1) | MAJOR (2 of the phase's 3 terminology strings never render anywhere in the UI, despite the backend fully resolving them — the primary deliverable of E3a is 2/3 unimplemented) | `getCaseDetail` correctly resolves `detail.terminology.case.singular = "Denúncia"` and `detail.terminology.primarySubject.singular = "Médico denunciado"` for the seeded Ethics case (`ca000000-…-e1`) — confirmed live via the passing pgTAP `262`. But NO frontend component reads `detail.terminology.case` or `detail.terminology.primarySubject` anywhere (exhaustive grep of `src/app` + `src/components`: the ONLY consumer of `.terminology.` is `case-tabs.tsx`/`(detail)/layout.tsx`'s `timelineLabel={detail.terminology.timeline.singular}`). `case-detail-view.tsx`'s H1 and the `(detail)/layout.tsx`'s H1 both call `formatCaseNumber(c.caseNumber)` (`src/components/cases/format.ts:9`), which hardcodes the literal string `"Caso "` regardless of case type. The string "Médico denunciado" (the seeded `case_participant_roles.display_name` for `respondent_doctor`) is never rendered by any component — no participants/subject panel exists on the case-detail surface for a `primary_subject_kind='professional'` case (the design doc's own §2.5 touch-list called for `case-detail-view.tsx` to "swap primary_subject-framed copy", but the delivered FE-1/FE-2 build (PROGRESS.md's own reconciliation note) only wired the timeline-tab label). Repro: sign in `chefe.ccih@test.local`, open `/o/rede-a/c/ccih/manage/cases/ca000000-0000-0000-0000-0000000000e1` → H1 reads "Caso 0006" (not "Denúncia …"); "Médico denunciado" does not appear anywhere on the page (confirmed via `page.getByText(...)`, 10s timeout, element not found). | H1/breadcrumb renders "Denúncia" (not "Caso"); "Médico denunciado" appears where the primary-subject label belongs (acceptance §4-1). | H1 = "Caso 0006"; "Médico denunciado" absent from the DOM entirely. | `e2e/ethics-e3a-surfacing.spec.ts` TERM-3, TERM-4 (both fail reproducibly — isolated re-runs + 2 full-file runs on independent fresh resets) | frontend | **✅ RESOLVED** — fixed by FE `ef5c38b` (new `formatCaseNumberWithTerm(detail.terminology.case.singular, caseNumber)` on both detail H1s; new read-only `CasePrimarySubjectPanel` rendering `terminology.primarySubject.singular` + the primary-subject participant, shown when `primarySubjectKind` is `professional`/`entity`). Re-verified 2026-07-27 (tester): TERM-3 passes as-is; TERM-4 needed a spec-only selector fix (see Test Run Summary — the panel legitimately shows "Médico denunciado" twice, as its own heading and as the seeded respondent's role line, so a plain `getByText` strict-mode-failed; retargeted to `getByRole('region'/'heading', {name:...})`). Full spec 21/21 on 2 independent fresh resets, no regression in the other 17. |
| BUG-E3A-002 | ETH·E3a (T-1) | MINOR (cosmetic — the RLS security boundary is unaffected and independently proven correct; only the informational badge fails to render, and only for viewers already authorized to see the row) | `src/lib/queries/case-documents.ts`'s `listCaseEvents()` (the sole reader feeding `CaseEventsTimeline`) never selects the `case_events.visibility` column (its `.select(...)` list at L234-238 omits it) and its row mapper hardcodes `visibility: 'case_readers'` for EVERY returned event (L255), with a stale comment claiming "BE-5 projects it" — it never was. Consequence: the "Somente coordenação" Lock badge (`case-events-timeline.tsx:96-101`, gated on `ev.visibility === "coordinator_only"`) can NEVER render for anyone, even a coordinator legitimately viewing a genuine `coordinator_only` row (confirmed both for an auto-derived `finding_recorded` event AND a manually-created one via the UI's own "Visibilidade → Somente coordenação" toggle — both persist `coordinator_only` correctly in the DB, per direct query, but the client always displays them as if `case_readers`). Row PRESENCE/ABSENCE per viewer is unaffected (proven correct: EVT-4/5/6 pass — an ordinary reader never receives the row at all, RLS-enforced upstream of this bug). Repro: sign in `chefe.ccih@test.local` on any case with a `coordinator_only` event → the event row renders with no "Somente coordenação" badge. | A `coordinator_only` event's row carries the "Somente coordenação" badge for any viewer who can see it (design doc §2.5). | Every event displays as if `case_readers`; the badge never renders regardless of the true value. | `e2e/ethics-e3a-surfacing.spec.ts` EVT-2 (auto-derived), EVT-3 (manual) — both fail reproducibly, isolated + full-file runs | backend | **✅ RESOLVED** — fixed by BE `1ce0876` (`listCaseEvents()` now selects `visibility` and projects the real column instead of the hardcoded `'case_readers'`; stale comment removed). Re-verified 2026-07-27 (tester): EVT-2 (auto-derived `finding_recorded`) and EVT-3 (manually-flagged note) both now show the "Somente coordenação" badge, on 2 independent fresh resets. Row presence/absence (the actual RLS boundary) was already correct throughout and remains unaffected (EVT-4/5/6 still pass). |

## FF-3-era closed bugs (rotated from PROGRESS.md 2026-07-28 at the FF-3 Record)

FF-2's five (BUG-FF2-001…005) and the two out-of-phase fixes it absorbed (BUG-FF1-006 `HC0N2`,
BUG-FF1-007 `<> ''''`) are **all closed and re-verified**, with full repro/fix detail in
[ff-2-matrix-risk-matrix.md](./ff-2-matrix-risk-matrix.md). The ETH·E2 targeted-lane fix
(`4ee24c8`) is recorded there too.

#### ✅ BUG-E2E-001 — `mem-memberships-collapse` AC-1 deleted a SEED membership in its own cleanup, poisoning every later batch of the gate · severity **MAJOR (test-suite)** · **CLOSED 2026-07-28** (found + fixed + re-verified by `tester`)

**The only real defect in the 2026-07-28 gate's 140 failures**, and it is in `e2e/`, not in app code.

AC-1 enrolls a PQS member on the central-a roster, then removes one to "restore the seed roster" —
but it took **`.first()`** of the remove buttons, which is the *first row in the card*, not the row it
had just added. On the seeded roster that first row is **`admin@test.local` (`pqs_member`, hospital
`05000000-…-000a`)**. So the cleanup deleted a **seed** row and left the test's own addition behind.

**Why it detonated only in the gate:** the gate does **not** `db reset` between batches.
`open_capa_plan` infers its hospital from exactly that membership, so once it was gone the RPC
answered **HTTP 400 `HC083` — "informe o hospital do plano de ação"**, and every CAPA-dependent spec
downstream failed in setup. That is the entire **9-failure `notifications.spec.ts` cascade in batch 7**.
Running `notifications.spec.ts` alone passes 8/8, which is why it had never been caught.

**Proven, not inferred**, in four steps: (1) reproduced batch 7's exact six-file composition on a
**fresh** DB → the same cascade; (2) read the persona's memberships in the contaminated state → only
the `org_admin` row survived, the `pqs_member` row was gone; (3) replayed the RPC live in that state →
`400 HC083`, against `200` on a fresh seed; (4) compared to a fresh seed → two rows, confirming which
one was destroyed.

**Fixed** by removing the member the test actually added, addressed **by name**
(`Remover ${personName} da equipe do NSP`), with a guard that fails loudly if that control is missing
rather than falling back to an arbitrary row. Two assertions were added so the old behaviour cannot
return silently: the added member's control is gone **and** the seeded `pqs_member` row still exists.
The second is the load-bearing one — the old bug also ends with one fewer row, so an
absence-only check passes under it.

**Re-verified:** batch 7's composition went **78/87 → 86/87** on a fresh DB (the notifications cascade
gone entirely), and `mem-memberships-collapse` is **7/7** standalone.

> ⚠ **The class, worth a sweep beyond this fix:** a spec whose cleanup targets `.first()` (or any
> positional locator) rather than the row it created will eventually eat a seed row. It is invisible
> file-locally and only surfaces in a gate that does not reset between batches.

#### ✅ BUG-FF3-002 — the two unary operators were OFFERED by every condition picker but could not be SAVED · severity **MAJOR / phase-blocking** · **CLOSED 2026-07-28** (fixed `91f4931`, re-verified by `tester`)

**Blocks ADR 0090 ruling 5 + Amendment 2** — the pickers are the phase's whole shipped operator
surface, and choosing either option makes the question **unsaveable**. Fails **CLOSED** (a refusal,
not a silent accept), which is why lint / tsc / Vitest 748 / pgTAP 4157 / `next build` all stayed green.

**Root cause — and a correction to this report.** The drift was real and the direction was right
(the database was the *permissive* side; the TypeScript half of the mirror was never widened). **But
the line this report originally blamed was the wrong one.** It fingered `isValidCondition`'s
`if (!('value' in rec)) return false`. The actual rejection was **one line earlier**: `CONDITION_OPS`
still held the pre-F3 seven operators, so `is_empty` failed the allowlist before the value check was
ever reached — and `condition-builder.tsx:204` emits `value: null`, a **present** key, so the blamed
line never fired at all. `backend` checked the prescribed one-line exemption against reality, found it
would not have worked, and fixed the real cause instead.

*Lesson worth keeping, since this is the second time this phase:* **a repro proves the symptom; the
line you can see failing is a hypothesis until something mutates it.** The fix is mutation-proven both
ways — reverting `CONDITION_OPS` to seven reds 8 assertions including *"is_empty with an explicit null
value (what the builder emits)"*, while removing only the value exemption reds 3 and leaves that one
green.

**Live proof, three cells so it cannot be read as "`required_if` is just broken"** (prod-standalone
:3100, `chefe.ccih@test.local`, item editor on a `short_text` with a `multiple_choice` target):

| # | What was authored | Result |
|---|---|---|
| A | `required_if` + `equals` + value | **SAVED** — `{"op": "equals", "value": "uti_…", "question_key": "setor_auditado_…"}` in `form_items.required_if` |
| B | `required_if` + `is_empty` | **REFUSED** — dialog stays open: *"A condição de obrigatoriedade deve ser uma única condição (sem E/OU)."* `required_if` stays NULL |
| C | item **`visible_when`** + `is_empty` | **REFUSED** — dialog stays open, no recognisable message surfaced at all; `visible_when` stays NULL |
| — | the catalog's opinion of the same shape | `select app.is_valid_condition('{"question_key":"x","op":"is_empty"}'::jsonb)` → **`t`** |

**Scope is wider than `required_if`.** `parseVisibleWhen` calls the same helper
(`actions.ts:854`/`861`), so **item and section visibility are equally blocked** — and FF-3 is what
added the unary options to `condition-builder.tsx` in *all three* contexts, so cell C is this phase's
regression surface too, on a long-shipped feature.

**Secondary claims, re-checked at the lead's request — one stands, one was mine to retract.**
(1) Cell B's message *was* wrong — "sem E/OU" when the author used neither. Moot now that the input
saves. (2) **"Cell C surfaces no message" was a false report, and the fault was the probe's, not the
product's:** it scraped for `/A condição/` while the copy is *"Condição de aparência inválida."* — no
leading article. The dialog was refusing with a message the probe could not see. **No swallow exists**
— re-verified positively by **FF3-6e**, which drives a reachable action refusal (`min > max` on the
character limits) and asserts it lands in a `role="alert"` live region with the dialog still open and
nothing persisted. Nor is there anything left to swallow: the builder gates on `isRowComplete` and only
offers operators from `opsForType`, and `app.is_valid_condition` returns `f` for an unknown op (so one
cannot even be seeded), which makes the invalid-condition branch unreachable from the UI by
construction. **No dispatch to `frontend` needed.**

**Why FF-3's own verification missed it:** F1 proved unary publishability by calling
`public.validate_visible_when` **directly on a cloned draft**, and B5 proved storability against
`app.is_valid_condition`. Neither path goes through the server action, which is the only thing the UI
can reach. *(Same shape as the memory note "a declared param no caller passes is invisible to every
layer" — here, a widened gate no caller can reach.)*

**Regression cover — all green at `91f4931`, all RED before it:** **FF3-6** (`required_if`, 4 target
types, save → round-trip → **publish**), **FF3-6b** (item `visible_when`), **FF3-6d** (**section**
`visible_when` — the cell the first report only *reasoned* was identical because it shares
`parseVisibleWhen`; reasoning from a shared code path is how this bug survived F1, so it is now
executed), **FF3-6c** (picker vocabulary, incl. Amendment 2's deliberate absence of
`contains`/`not_contains`) and **FF3-6e** (the error channel, above).

The **publish** half matters most: it had been verified only at the DB layer, by calling
`validate_visible_when` directly on a cloned draft — the layer that missed the bug. It now runs through
the UI for all four target types.

#### ✅ BUG-FF3-001 — after a blocked navigation, the untouched peer repetition kept a stale `unique_within_group` message and `aria-invalid` · severity **MINOR** · **CLOSED 2026-07-28** (fixed `8d53b3d`, re-verified by `tester`)

`unique_within_group` is the only **symmetric** rule in the vocabulary: two repetitions violate it
jointly, so resolving it on one resolves it on both. The wizard's sticky error map is cleared **per
edited field**, so the peer the user did not touch keeps both its message and `aria-invalid="true"`
for a violation that no longer exists.

**Isolated in both directions** (so it is not "instance errors are broken"):

| Path | flat field | instance bounds | `unique_within_group` peer |
|---|---|---|---|
| live only, **before** any blocked navigation | clears ✅ | clears ✅ | clears ✅ |
| **after** pressing Revisar (sticky map installed) | clears ✅ | clears ✅ | **stale ❌** (`aria-invalid` still `true`) |

**Display-only:** a second Revisar reaches the review screen and the banner clears, so nothing is
blocked and no bad submit is possible. The harm is that ADR 0090 ruling 3's own reasoning —
*"marking an input invalid for a rule the server accepts misinforms assistive tech"* — is violated
transiently, on a field that is now valid.

**Fixed** by keying the clear on the symmetric rule's whole participant set rather than on the edited
field alone. **FF3-7b has been deleted and its assertion folded back into FF3-7**, exactly as its own
note said to do on the day of the fix: FF3-7 now asserts the full contract — after resolving the
duplicate on one side, the message count is **0 across the page** and `aria-invalid` is null on **both**
repetitions, the untouched one included. The `test.fail()` marker is gone from the file entirely.


### ✅ BUG-FF1-008 — CLOSED by FF-3 (ADR 0090 Amendment 3)

#### 🟡 BUG-FF1-008 — `form-builder-enhancements.spec.ts:768` AC-4 pins behaviour FF-1 deliberately removed · owner `tester` · **OPEN** (filed 2026-07-27)

Asserts the "obrigatória" toggle is DISABLED beside a visibility condition. `git log -L` blames the
"offered BESIDE a visibility condition" change to **`633e688 feat(ff-1)`**, and FF-1's own
`20260828000000` dropped `form_items_conditional_not_required` (confirmed absent from the live
catalog). ~2 lines to repin. **Red on every run since FF-1 and written off as flaky-baseline noise** —
see FUP-E2E-1.


**Closed 2026-07-28.** It pinned decision #9 (a conditionally-visible question cannot be `obrigatória`) — behaviour FF-1 had already dropped at the DB level (`form_items_conditional_not_required`), leaving it UI-only for two phases. FF-3 removed the UI half and the lead ratified it as **Amendment 3**; `tester` updated AC-4 to the new contract in `b723ccc`, asserting the old note's **absence**.


---

## FF-5 (Entity Reference, ADR 0091) — closed bugs, rotated 2026-07-28

Both were invisible to pgTAP 4240, Vitest 851, tsc, lint and `next build`; only E2E found them.
Full phase context → [ff-5-entity-reference.md](ff-5-entity-reference.md).

#### 🟢 BUG-FF5-001 — the builder cannot author a `reference` item: `addItem` rejects it with "Tipo de item inválido." · owner **backend** · **FIXED, VERIFIED by tester** (filed 2026-07-28, fixed `cc4194a`, re-verified 2026-07-28)

**Re-verified**: `npx playwright test e2e/ff5-references.spec.ts --project=chromium --workers=1 -g "FF5-1"` after the fix — the test now proceeds all the way through builder authoring (3 lanes) → publish → wizard fill → advance → review → submit → the DB-truth assertion (exact `reference_kind`/target per lane), all passing. **It was actually THREE sites, not two** — `backend` found the third independently: `parseItemFields` had no `reference` arm at all and fell through to its OWN `itemTypeInvalid`, so a fix to only the two lists would have shown the identical error from a different line. All three (`ALL_ITEM_TYPES`, `ANSWERABLE_TYPES`, `parseItemFields`) are now fixed and single-sourced from `item-tree.ts`; `item-type-sets.test.ts` pins them against the live DB CHECK (mutation-proven: removing `reference` reds 4 of 5 assertions). `updateItem` was ALSO broken independently (same `parseItemFields` call, no `addItem` involved) — now covered by **FF5-8** (editing an existing reference item through the builder; round-trips, and the published version stays untouched). **FF5-9** additionally covers a reference authored as a repeating-group CHILD through the builder (the other half of this bug's blast radius FF5-1's flat form didn't reach).

FF5-1 went red for a **completely different, unrelated reason** next — see **BUG-FF5-002** immediately below, now also fixed and verified.

#### 🟢 BUG-FF5-002 — the submissions dashboard shows "Sem resposta" for every top-level reference answer, even though the DB and the exact same query both hold/return the correct data · owner **frontend** · **FIXED, VERIFIED by tester** (filed 2026-07-28, fixed `cf6a949`, re-verified 2026-07-28)

**Root cause (frontend, confirmed by tester's re-run): `submissions/[responseId]/page.tsx` never
passed `referencesByItemId` to `SubmissionDetailView`, and the prop was declared optional with a
`= {}` default** — neither backend suspect (the query, the RLS policy) was the cause, which is
exactly why reading them by inspection found nothing wrong: both were fine. Fix `cf6a949` passes the
prop and makes it (and the four sibling payload props with the same latent exposure) required, so a
future omission fails the build instead of rendering blank.

**Re-verified**: `e2e/ff5-references.spec.ts` full file, 2 consecutive runs, 10/10 green — FF5-1
(the original repro) now shows `UTI Adulto` / `Comissão de Controle de Infecção Hospitalar` / `Chefe
CCIH` on the submissions view, and the new **FF5-10** (added as a regression guard on the sibling
sign-off review screen, which was already wired correctly) confirms that call site too. One
transient login-timeout flake hit an unrelated test on a full-suite run; an isolated re-run of that
test passed cleanly — not attributable to this fix.

**Not the same bug as BUG-FF5-001 and not caused by the builder.** Reproduced TWICE, independently:
1. FF5-1's real, wizard-driven, `submit_response`-submitted response (3 reference lanes, authored through the builder) — DB truth (a raw SQL join across `answer_references`/`answers`/`form_items`) confirms all 3 rows are exactly correct, in order, immediately before the failing assertion.
2. A throwaway raw-SQL probe response (bypassing the builder AND the wizard entirely) on the **SEEDED** Form D's own `referencia_setor` item (`d0000000-0000-0000-0000-00000000a301`, participant lane) — same symptom.

Both land on `/o/{org}/c/{slug}/dashboard/submissions/{responseId}` showing the item's own label
("Setor envolvido") and its "REFERÊNCIA" type tag correctly, but the answer itself renders
**"Sem resposta"** — i.e. `SubmissionDetailView` → `AnswerSummary` → `ReferencePicker` (`readOnly`)
received `reference: undefined` for that item.

**Verified NOT a data or query problem** (ruling out the two most obvious explanations before filing):
- `docker exec supabase_db… psql`: `answer_references` holds the correct row for both repros.
- The exact embed string `getSubmissionDetail` uses (`src/lib/queries/submissions.ts` L567-577) —
  copied verbatim, not paraphrased — returns the correct row via raw PostgREST, both under the
  service-role key AND under `chefe.ccih`'s own session token (RLS applies and still returns it).
- `docker logs supabase_kong_…`: the RUNNING NEXT.JS SERVER's own request for the probe response
  (`user-agent: node`, not curl) is `GET …/answer_references?...&answers.response_id=eq.<id> → 200,
  388 bytes` — the identical byte count as the correct manual response, confirming the correct
  payload really did reach the server process, not just PostgREST.
- Read `buildReferenceAnswers` (`src/lib/queries/responses.ts` L708-763) and the `referencesByItemId`
  wiring (`submissions.ts` L692, L718; `submission-detail-view.tsx` L324; `answer-summary.tsx`
  L143-156) end to end — the keying (`row.answers.item_id`), the `TOP_LEVEL_SCOPE` constant (single
  source, imported not re-spelled), and the dispatch all read correctly by inspection.

**So the break was somewhere between a confirmed-correct 388-byte HTTP response landing in the
Next.js process and the value reaching the component** — I could not isolate it further without
runtime instrumentation, which was out of my scope; handed off with the full trail above instead of
guessing. **The decisive clue was in that trail**: the symptom was top-level-only (in-group
references, via `instances`, always rendered fine — confirmed by FF5-9 passing throughout) — no
embed or RLS fault produces that asymmetry, only a missing prop does. Worth remembering next time a
render bug shows an odd asymmetry between two sibling paths off the same query: ask what they don't
share, not just whether either one is individually correct.

**Impact (resolved)**: every reference answer in the platform's durable, accreditation-facing
record previously displayed as unanswered — the FF-5 acceptance criterion this bug blocked directly.
The REVIEW screen (pre-submit, same-request, client-side state) was never affected.


---

## BUG-FF4-001 (rotated from PROGRESS.md at the FF-4 Record, 2026-08-03) — RESOLVED

#### ✅ BUG-FF4-001 — clearing a dynamic-default answer and resuming the draft RE-SEEDS it, violating ADR 0092 ruling 5's idempotency contract · owner **backend** · **RESOLVED** (filed 2026-08-03, fixed `b5c505e`, re-verified by tester 2026-08-03)

**Verified fixed:** `npx playwright test e2e/ff4-power-authoring.spec.ts -g "FF4-4" --project=chromium --workers=1` → **1/1 pass** against a fresh prod standalone build on `b5c505e` (re-staged/re-served, no rebuild needed — no `src/` file was newer than the existing `.next/BUILD_ID`). Full file independently re-confirmed **7/7** by both tester and lead.

**Spec:** `e2e/ff4-power-authoring.spec.ts` FF4-4 (acceptance criterion 4's idempotency clause). **Repro**
(deterministic — 3 consecutive runs, prod standalone, fresh state each time): author a `date` item with
a `today` dynamic default, publish, fill as a respondent (the field correctly prefills). Click the
field's own **"Limpar"** clear button (the real per-field affordance, not a raw `.fill('')`), confirm it
reads empty, **"Salvar e sair"**, then **"Continuar preenchimento"** back into the same draft.

**Expected** (ADR [0092](../decisions/0092-ff4-power-authoring.md) ruling 5 — *"a filler who clears a
field does not have it refilled behind them"*; pgTAP keystone `default_prefill_idempotent` — *"re-entering
the draft does not overwrite an edited or cleared answer"*): the field resumes **empty**.

**Actual:** the field resumes prefilled with `today` again (`2026-08-03`), indistinguishable from a
field that was never touched.

**Not a save-path defect** — DB truth (asserted in the spec, immediately after "Salvar e sair") proves
the clear DID persist: `select value from answers where response_id=… and item_id=…` returns exactly
**one row**, `value = 'null'::jsonb` — an explicit "answered as empty" row, not a missing one. The defect
is entirely on the READ/resume side.

**Root cause, traced to one line:** `buildAnswerMaps` in `src/lib/queries/responses.ts:429`:
```ts
for (const a of scalarAnswers) {
  if (a.value === null) continue   // ← drops the row instead of keeping "answered: null"
  ...
  answersByItemId[a.item_id] = a.value
}
```
unconditionally skips any scalar answer row whose `value` is JSON `null`, so `answersByItemId` never gets
a key for it. `toAnswerState` (`src/components/responses/wizard/prepare.ts:42-54`) then reads
`response.answersByItemId[item.id]` as `undefined`, and — since `observation`/`otherText` are also
`undefined` for this item — `continue`s past it, so it never lands in `initialAnswers`. `withDefaults`
(`src/components/responses/wizard/use-wizard.ts:406`, `if (item.id in initialAnswers) continue`)
therefore sees no saved answer at all and re-seeds the default. The line-429 filter predates FF-4 — its
comment explains a different, still-valid concern (ignoring a stray non-null value on a CHOICE item,
whose real answer lives in `answer_selected_options`) — but nobody revisited it for the new "explicit
null = deliberately cleared" semantic FF-4's idempotency ruling depends on.

**Broader blast radius, NOT directly exercised by this spec:** `withDefaults` seeds from a LITERAL
`default_value` before falling to `defaultSource` (rulings 5/6 share the one function), so the same root
cause very likely also re-seeds a plain, pre-FF-4 (answer-model-v2) literal default after it is cleared
and the draft resumed — FF4-4 only exercises the two FF-4 dynamic tokens; worth the owning engineer's own
check before calling the fix's scope closed.

**Not filed as a fix suggestion** (tester scope): `buildAnswerMaps` needs to represent "answered, value is
`null`" as distinct from "no row" rather than dropping the row — how to do that without disturbing the
CHOICE-item exclusion sharing the same loop is backend's call.

---

## BUG-E2EISO-002 — rotated from PROGRESS.md 2026-08-03 (RESOLVED)

#### ✅ BUG-E2EISO-002 — `session_replication_role = replica` in the FF-1/2/3/5 specs' `purge()` disables FK CASCADE and orphans form rows on every run · owner **tester** · **RESOLVED 2026-08-03** (filed 2026-08-03; found by tester during the FF-4 test pass, hit again in a second file during triage)

**Fixed.** All teardown now goes through one shared helper, `e2e/helpers/purge-forms.ts`, which keeps the
`replica` bypass (the immutability guards genuinely require it) and adds the explicit child-first deletes
it can no longer get from FK CASCADE. Seven files: the four FF specs (`ff1-repeating-groups`,
`ff2-matrix`, `ff3-validations`, `ff5-references`) plus `helpers/ff2-matrix.ts`'s shared `purgeByTag`,
**and two more the original report did not list** — `answer-model-v2` and `form-model-normalization`,
which carried the identical leak at **three** sites each.

**⚠ Correction to the fix note below: `app.copy_version_children` alone is NOT sufficient.** It
enumerates only the *authoring* subtree, because cloning a version does not clone its responses. The
response subtree (`responses` → `answers` → `answer_selected_options`/`_matrix_cells`/`_risk_matrix`/
`_references`, plus `response_group_instances`/`_section_signoffs`) had to come from the FK graph in
`pg_constraint` rooted at `public.forms` — and that is precisely the half that orphaned the 2 published
versions carrying real submitted data. The helper derives from **both**, both read from the live catalog.

**The DV-6 collision is fixed, not just the leak.** The two by-id sites in those extra specs delete a
form with a FIXED id and re-insert children with fixed ids; once a version is orphaned its `forms` row is
gone, so nothing form-rooted can reach it and the re-insert collides on
`form_versions_form_id_version_number_key`. Reproduced exactly, then fixed via `purgeVersionsByIds`,
which deletes by version id directly. Those specs are now idempotent across runs on one DB.

**Also added:** a runtime tripwire for the `NO ACTION` referrers (`case_phases`,
`process_template_phases`, `case_interviews`) that `replica` would orphan just as silently — an
assertion rather than a comment, because "no spec attaches a case to its own forms" is a claim about
fixtures that would go stale unnoticed. Mutation-proven to fire (caught 7 rows). Purges are now atomic
(`--single-transaction`) so a tripwire abort cannot leave a half-deleted fixture.

**Verification:** 60 tests across the five FF specs, all green, **0 orphans across all 15 FK edges** after
each. `answer-model-v2` + `form-model-normalization` run **twice on one DB with no reset** — green
(one unrelated NORM-2 publish-timeout flake in pass 1; that test's code is untouched by this change and
passes 3/3 in isolation at 7–8s vs the 44.3s timeout). Mutation-proved both directions: same fixture,
old teardown → orphan; new helper → 0 rows left, 0 orphans. lint + typecheck clean; `src/` and
`supabase/` untouched.

**Production is NOT affected**, verified three ways: `session_replication_role` is a `superuser`-context
GUC and `anon`/`authenticated`/`service_role` all get `permission denied` when they try to set it (tested
empirically, not inferred); no app code sets it (the only non-test occurrences are one migration comment
and the demo script); and an orphan sweep against the **linked remote project returned 0 on all 15
edges**. The leak was also structurally confined to the local stack — every purge helper shells into the
local Docker container by name.

**Left open (adjacent, not this bug):** `supabase/demo/reset-revisao-prontuario.sql` deletes
`forms`/`form_items` under `replica` while clearing only 2 of the 10 child tables. **Latent** — the demo
seed creates zero rows in any of the 8 uncovered tables, so nothing orphans today; it would bite the
first time the demo grows a matrix, reference, repeating-group, or validation item.

<details><summary>Original report (2026-08-03)</summary>

Promoted from a prose "side finding" in the Test Run Summary to a numbered bug so it survives a sweep.
**Full technical detail is in the Test Run Summary below — not duplicated here.**

**One line:** `session_replication_role = replica` is used to bypass `guard_submitted_response` before
deleting a form, but it disables **all** non-origin triggers including Postgres's own FK-CASCADE, so
`delete from forms …` leaves `form_versions`/`form_items`/`form_sections`/`answers` orphaned.

**Scope:** **46 pre-existing orphaned draft versions + 2 orphaned PUBLISHED versions carrying real
`responses`/`answers`** were found and cleaned. `e2e/ff4-power-authoring.spec.ts` was written immune
(explicit child-first, table-by-table deletes — use it as the reference implementation). **The FF-1,
FF-2, FF-3 and FF-5 specs still carry the leaky one-liner and keep leaking on every run.**

**It is not inert.** During FF-4 triage it caused a *second*, unrelated failure: `answer-model-v2` DV-6
collided with a leftover orphaned `form_versions` row via a hardcoded fixture id. So it manufactures
phantom failures in other files later, which is the expensive part.

**Fix note:** derive the child-table set from `app.copy_version_children` in the **live catalog**, not a
hand-written list — that function's insert list is the authoritative enumeration of a version's children
(see ADR 0092's substrate section). A background task was spawned for this on 2026-08-03.
*(Superseded — see the correction above: that enumeration covers only the authoring half.)*

</details>

## Phase 16 + ad-hoc-batch closed bugs (rotated from PROGRESS.md 2026-08-04)

> Verbatim from PROGRESS.md's live Bug Log at the 2026-08-04 size rotation. PROGRESS.md keeps a
> one-line summary row per bug; this is the durable detail. The only bug left live there is the
> still-OPEN **BUG-AUTHZ-002**.

### Phase 16 — BUG-P16-001 … 006, all closed

> ⚠ **BUG-P16-006 appeared TWICE in the live log** — a full write-up at the top of the section and a
> second, earlier-worded block further down. Both are preserved below in the order they appeared; the
> first is the fuller one.

✅ **BUG-P16-006 — CLOSED 2026-08-04, tester-verified (fix + two independent fresh-reset re-runs).**
Root cause: `phase16-accreditation-core.spec.ts` and `phase16-accreditation-freshness.spec.ts` each
hardcoded 2 indicator ids (`INDICATOR_AC1`/`INDICATOR_AC5`; `INDICATOR_ATENCAO`/`INDICATOR_VENCIDA`) as
literal UUIDs captured live from a running DB. Unlike orgs/hospitals/commissions/personas/the demo
form/the ethics case (all seeded with an explicit fixed `id` literal — individually confirmed by
reading their actual `insert`/`v_* uuid :=` statements in `supabase/seed.sql`, not merely grepped),
`seed.sql`'s CCIH indicator block (`insert into public.indicators (...) values (...) returning id into
v_ind_*;`) has NO explicit `id` column, so `gen_random_uuid()` assigns a fresh id on every
`supabase db reset` — the captured literals were only ever valid against the exact DB session they were
read from, and went stale on the very next reset, which is exactly what `npm run e2e:prod`'s `RESET=1`
does every run. The prior 31/31 report was green against the SAME session the ids had been captured
from; nothing in that workflow was positioned to observe the instability.

**Fix:** added `lookupIndicatorId(commissionId, name)` to `e2e/helpers/accreditation.ts` — a thin
wrapper on the existing `sqlOne`, which already fails loudly (quoting the query) on 0 or >1 rows, so a
lookup miss surfaces as a clear fixture error, never a downstream FK violation on whatever insert
consumes the id next. Both spec files now declare the 4 constants as module-level `let`s and resolve
them by NATURAL KEY (`commission_id` + exact seeded `name`) inside `beforeAll`, before first use —
never a hardcoded literal.

**Full sweep, every hardcoded UUID in scope (18 distinct literals across the 5 specs + the helper):**
the 4 indicator ids were the ONLY unstable ones. The other 14 — `ORG_A_ID`, `ORG_B_ID`,
`HOSPITAL_CENTRAL_A`, `HOSPITAL_SECUNDARIO_A2`, `COMMISSION_CCIH`, `COMMISSION_FARMACIA`,
`COMMISSION_ETICA`, `COMMISSION_QUALIDADE_B`, `ETHICS_CASE_ID`, `UID_PLATFORM`, `UID_CHEFE_CCIH`,
`UID_CHEFE_FARM`, `UID_HOSPITALADMIN_A1`, `CCIH_FORM_HIGIENE.id` — were each individually confirmed
safe by reading their actual seed.sql insert/assignment statement (not a grep occurrence count alone),
all `insert into ... (id, ...) values ('<literal>', ...)` or `v_* uuid := '<literal>';` later consumed
as an explicit id. Also swept the wider `e2e/` suite for the same defect shape (report-only, out of
scope to fix): every other seed.sql table seeded via an auto-generated id (`rca_root_causes`; two
`controlled_documents`/`controlled_document_versions` pairs, `DOC-0001`/`DOC-0002`) is ALREADY resolved
by other specs via a live natural-key lookup — `docIdByCode()` in `e2e/helpers/documents.ts`, and a
direct `rca_id`-keyed query in `phase14d-capa.spec.ts` — so no other spec hardcodes an unstable
captured id; Phase 16's 4 indicators were the only instance of this defect, not a systemic pattern.

**Verification (two independent fresh resets, per the coordinator's bar — "a pass on the current DB
proves nothing"):** `supabase db reset --local` → all 5 specs **31/31 GREEN**; reset a second time
(confirmed live: all 4 indicator ids resolved to entirely new values, matching neither the removed
literals nor each other across the two resets) → all 5 specs **31/31 GREEN** again.

Committed `test(e2e): resolve seeded rows by natural key, not captured ids (BUG-P16-006)`.

<details><summary>BUG-P16-006 original report (kept for the record)</summary>

**Repro:** run the full `npm run e2e:prod` gate (resets the DB before running).
`phase16-accreditation-core.spec.ts:124`'s `INDICATOR_AC1 = '6f4e4aa5-df6f-455a-a550-038453a45394'` — a
UUID captured live from the DB as it stood during the tester's authoring session — does not exist in a
freshly-reset DB. Reproducible across two independent runs, including one against a verified-healthy
stack, confirming a real fixture defect, not environment flakiness.

</details>

✅ **BUG-P16-005 — CLOSED 2026-08-04, tester-verified (fix + exact-string re-run + source read).** Landed in two commits: `c1f098b` fixed the noun (`padrão`/`padrões`, literal ternary) and swept for the same string-concatenation pattern, catching a real sibling in `evidence-count-badge.tsx` (`"em atenção"` → `"em atençãos"` whenever an `atencao`-status count exceeded 1 — same irregular `-ão`→`-ões` class, also fixed to literal singular/plural pairs). The PO then ruled on a judgment call `c1f098b` had explicitly left open (verb-vs-noun agreement): `aad4877` keys the noun on `totalStandards` and the verb+adjective on `cleanStandards` — `"{clean} de {total} {padrão|padrões} {está conforme|estão conformes} (não cumulativo)"`.

`tester`'s own `/padr\S+/`-tolerant regexes (deliberate while the wording was open, so the spec would not encode the wrong spelling) were **replaced with exact-literal assertions** citing the PO ruling — `phase16-accreditation-core.spec.ts` AC-1, both the `1 de 2` and `0 de 0` cases — since a tolerant matcher can't red a regression once the correct wording is settled. Swept all 5 specs for any OTHER assertion loosened around this bug or its `evidence-count-badge.tsx` sibling: none found (no spec fixture ever produced an `atencao` count > 1 on the aggregate badge, so no assertion was ever positioned to observe that half of the bug either). Re-verified: `core.spec.ts` + `freshness.spec.ts` 15/15, all 5 specs combined 30/30, `--project=chromium --workers=1`.

⚠ **That last gap was closed as its own follow-up, not left as a permanent caveat** — "fixed but unguarded" for a bug class that shipped twice in one phase is the same shape as the bug itself. `phase16-accreditation-freshness.spec.ts` gained a dedicated `AC-3-plural` test (`8bdefe0`): a new standard with TWO `atencao`-status evidence links (INDICATOR_ATENCAO's existing measurement relinked to a second standard + a new `held` meeting) drives the aggregate badge's `atencao` bucket to 2, and the test asserts the exact literal `"2 evidências — 2 em atenções"` (read from the live `evidence-count-badge.tsx` source, not retyped from memory) **and** that the old buggy spelling (`"atençãos"`) is explicitly absent — so it would genuinely have failed pre-fix, not passed vacuously. Re-verified: `freshness.spec.ts` 9/9, all 5 specs combined **31/31**.

<details><summary>BUG-P16-005 original report (kept for the record)</summary>

**Repro:** view any ONA (leveled) framework's readiness dashboard where a level has `totalStandards !== 1`. Observed live (`level1Card.innerText()`, `totalStandards: 2`): `"1 de 2 padrãoes conforme (não cumulativo)"`.

**Root cause:** `src/components/accreditation/readiness-dashboard.tsx`'s `LevelCard` built the plural by concatenation — `padrão{level.totalStandards === 1 ? "" : "es"}` — which produced `"padrão" + "es" = "padrãoes"`. Portuguese `-ão` nouns pluralize irregularly (three patterns: `-ões`/`-ães`/`-ãos`); "padrão" → **"padrões"**, never "+es". Contrast `hospital-readiness-register.tsx`, which got this right nearby: `{rows.length === 1 ? "padrão" : "padrões"}` — a literal, not a suffix concatenation.

</details>

✅ **BUG-P16-004 — CLOSED 2026-08-03, tester-verified (fix + re-run + source read).** Fixed exactly along the lines flagged: `[framework]/layout.tsx` now passes `org`/`commission`/`frameworkId` (plain strings) to `<StandardsTree>` instead of the `standardHref` closure; `standards-tree.tsx` resolves its own hrefs client-side via the pure `commissionHref` helper (confirmed both files now carry an explicit `BUG-P16-003 (fixed)` comment documenting the shape). Re-verified live: `phase16-accreditation-core.spec.ts` AC-1/AC-3b/AC-5, `-freshness.spec.ts`'s four `-ui` tests, and `-restricted.spec.ts` AC-3b (every test that navigates a `[framework]/**` route) now reach real rendered content — none hit the crash. Two of those re-runs then failed on genuinely NEW, unrelated issues (a tester locator ambiguity in AC-1, a keyboard-race in AC-5's combobox selection) — both are test-authoring bugs on `tester`'s own side, not product defects, and are being fixed there, not here.

<details><summary>BUG-P16-004 original report (kept for the record)</summary>

**This was the more severe of the two.** `src/app/o/[org]/c/[commission]/manage/acreditacao/[framework]/layout.tsx:60` passed an inline closure `standardHref={(standardId) => commissionHref(...)}` straight into `<StandardsTree standardHref={standardHref} .../>` — and `standards-tree.tsx:1` is `"use client"`. Since `FrameworkLayout` wraps the framework overview page AND every `padrao/[standard]` detail page (the sidebar tree renders on both), **this crashed the entire commission-side Accreditação surface below the bare list** — not an edge case gated behind "a global framework exists," it fired on the very first framework a coordinator opened, always. Confirmed live (dev server log, same error shape as BUG-P16-003):
```
⨯ Error: Functions cannot be passed directly to Client Components unless you explicitly expose it by
marking it with "use server". Or maybe you meant to call this function rather than return it.
  <... nodes={[...]} readinessByStandardId=... standardHref={function standardHref}>
                                                            ^^^^^^^^^^^^^^^^^^^^^^^
```
Reproduced both server-side and in the browser console, at `/o/rede-a/c/ccih/manage/acreditacao/{frameworkId}`.

**Swept the rest of the route tree for the identical shape** (every inline `Href={(...) => ...}` prop passed FROM an `src/app/**/acreditacao/**` route file): exactly 3 existed. `manage/acreditacao/page.tsx:49` (→ `FrameworkList`, Server→Client — BUG-P16-003) and this one were broken; `[framework]/page.tsx:38` (→ `ReadinessDashboard`) was SAFE — `ReadinessDashboard` has no `"use client"`, stays a Server Component, and only ever CALLS the closure server-side to produce a plain string for a bare `<Link href=...>` (`GapListSection`, same file) — the function itself never crosses a client boundary there. That safe example turned out to be the model the fix followed.

**Test impact while open**: blocked most UI-layer assertions across all 5 phase16 specs. `tester` kept exercising and reporting on the RPC/DB-truth layer (unaffected — those calls never touch this render path) while frontend fixed this.

</details>

✅ **BUG-P16-003 — CLOSED 2026-08-03, tester-verified (fix + re-run + source read).** `src/components/accreditation/framework-list.tsx` no longer receives a `frameworkHref` closure — it now takes `org`/`commission` (plain strings) and resolves its own hrefs (both for its `<Link>` and for what it hands `CloneFrameworkDialogTrigger`) via the pure `commissionHref` helper; the file carries an explicit `BUG-P16-003 (fixed)` docblock recording the shape. Re-verified live: a staff_admin viewing a global-framework-bearing list (`/o/rede-a/c/ccih/manage/acreditacao`) now renders the real "Acreditação" heading, no crash. Same root cause and same fix shape as BUG-P16-004 (below) — filed and closed together.

<details><summary>BUG-P16-003 original report (kept for the record)</summary>

**Severity: blocking.** This was the route's unconditional happy path, not an edge case — the layout already restricts the whole `manage/acreditacao` area to `staff_admin` (`AcreditacaoLayout`'s `access.role !== "staff_admin"` → `notFound()`), so `AcreditacaoPage` always called `<FrameworkList canManage={true} .../>` for anyone who reached it. Once Migration F seeds the ONA/JCI global packs, this would have fired for **every** staff_admin, every time, everywhere — it only needed one commission-visible global framework to exist, which a single `create_framework(ownerCommission: null)` call produces.

**Repro:** sign in as `chefe.ccih@test.local` (staff_admin, CCIH), ensure at least one GLOBAL framework exists (`owner_commission_id is null`), navigate to `/o/rede-a/c/ccih/manage/acreditacao` with the `accreditation` flag ON.

**Actual (before the fix):** the route crashed to `manage/acreditacao/error.tsx`:
```
⨯ Error: Functions cannot be passed directly to Client Components unless you explicitly expose it by
marking it with "use server". Or maybe you meant to call this function rather than return it.
  <... frameworkId=... frameworkName=... commissionId=... frameworkHref={function frameworkHref}>
                                                                        ^^^^^^^^^^^^^^^^^^^^^^^^
```
Reproduced in the browser console too (`(src/app/o/[org]/c/[commission]/manage/acreditacao/error.tsx:16:13)`), not a server-only artifact.

**Root cause, traced to the exact line:** `framework-list.tsx` (Server Component, no `"use client"`) forwarded its `frameworkHref` closure prop verbatim at line 71 into `<CloneFrameworkDialogTrigger frameworkHref={frameworkHref} .../>`, and `clone-framework-dialog.tsx` is `"use client"` — a plain (non-Server-Action) function cannot cross that boundary. Same bug CLASS as the earlier BUG-QI-001 ("Server fn prop → client = RSC crash").

</details>

✅ **BUG-P16-002 — CLOSED 2026-08-03** (`93a3bf8`). All 7 implemented + `listGlobalFrameworks()` added; lead-verified **0** occurrences of `not implemented` remain. Backend **verified by executing, not compiling**: a standalone probe signed in as real seeded personas (`chefe.ccih`, `hospitaladmin.a1`), flipped the flag **at runtime only** (never committed), seeded a throwaway fixture and called every operation for real — all 9 probes PASS, including `getHospitalReadiness(foreign) → [] not throw`. ⚠ **The probe immediately earned its keep**: `gen:types` had not been re-run after Migration E, so the three new doors weren't in the RPC union and `tsc` failed outright — *another* green-bar-over-dead-code instance, caught only because someone executed the code. **This is the lesson to keep: for a flag-gated phase, "it compiles" and "it works" are unrelated claims.**

<details><summary>BUG-P16-002 original report (kept for the lesson)</summary>

🔴 **Every Phase 16 screen dead on arrival: all 7 query-layer functions `throw new Error('not implemented')`.** Filed 2026-08-03 (lead), **P0.** `src/lib/queries/accreditation.ts` was committed in Wave 0 as the *contract* (`de2404c`) with throwing bodies, and **its implementation was never scheduled** — Wave 2's backend brief covered migrations and RPCs only. Meanwhile all five routes wired themselves to it:
`manage/acreditacao/page.tsx` → `listFrameworks` · `[framework]/layout.tsx` → `getStandardTree` + `listFrameworks` + `getReadinessReport` · `[framework]/page.tsx` → `getStandardTree` + `getReadinessReport` · `[framework]/padrao/[standard]/page.tsx` → `getReadinessEvidence` + `getReadinessReport` + `listStandards` · `o/[org]/manage/acreditacao/page.tsx` → `listFrameworks` + `getHospitalReadiness`. **Every one throws.**
**This is not a frontend defect** — `src/lib/queries/` is backend-owned (CLAUDE.md §4) and frontend correctly refused to touch it, routing `searchEvidenceCandidates` around it instead and saying so. **It is a lead coordination gap**: "commit the contract" was scheduled, "implement the contract" never was.
⚠ **It survived the entire green bar** — lint (0 warnings + css-vars), typecheck, 895 Vitest, and a real `next build`, all green — because the routes gate on `accreditation` which is seeded **OFF**, so they `notFound()` before ever reaching a query. **The bug is invisible until Migration G flips the flag at the Record step, at which point every screen 500s.** This is the standing [green-bar-misses-the-wired-seam](./bug-log-archive.md) pattern exactly — FF-1 shipped three live bugs past lint+tsc+build+457 unit+3919 pgTAP, one of them *actions still throwing `not implemented`*, and only E2E caught it. **Corollary: a flag-gated phase cannot be declared green by a build. The tester must run with the flag ON.**
**Fix:** backend implements all 7 against the now-live RPCs, typed off `src/lib/accreditation/types.ts`. Then frontend's prefill (BUG-P16-001) can land.

</details>

✅ **BUG-P16-001 — CLOSED 2026-08-03, lead-verified on all three ends.** Door `public.get_standard_assessment(p_commission, p_standard)` is `prosecdef=t`, gated `app.is_member_of` with empty-deny, **no `is_admin()` arm**, no `PUBLIC` in its ACL. `optionalClearableText` returns `''` for present-but-empty and `undefined` only for absent, so an intentional clear now reaches the RPC. `StandardDetailPage` passes `assessmentDetail?.noteMd`, not `null`. **Both round-trips asserted in pgTAP 281** — **C7b** (status-only re-save preserves the note), **C11** (explicit `''` clears it), plus **C10** (explicit non-null overwrites) as a positive control. ⚠ Either assertion alone passes in a broken world; **the pair is what pins it** — that is the durable lesson from this bug's two-stage failure.
📌 **Follow-up (not a defect — Rule 9 hygiene):** `getStandardAssessmentDetail` and `searchEvidenceCandidates` are **reads living in `src/lib/accreditation/actions.ts`**, because `queries/accreditation.ts` was still throwing when frontend needed them (BUG-P16-002). Once backend's query layer is real, route both through `src/lib/queries/` per Architecture Rule 9. Frontend must not move them unilaterally — `queries/` is backend-owned.

<details><summary>BUG-P16-001 — original report, kept for the lesson</summary>

🔴 **Saving a standard assessment SILENTLY DESTROYED the existing `note_md`.** Filed 2026-08-03 (lead), Phase 16 Wave 2. Traced end to end against the live catalog and the committed code, not inferred:
1. `StandardDetailPage` passes `assessmentNoteMd={null}` — there is **no read path** returning `standard_assessments.note_md` for a single standard (`ReadinessRow` deliberately carries no note per D8, and `getReadinessEvidence` returns evidence links, not the assessment).
2. So the textarea renders **empty** even when a note exists.
3. `setStandardAssessment` reads `optionalString(formData,'noteMd')` → `null`, and passes `p_note_md: null` unconditionally.
4. `public.set_standard_assessment` upserts `on conflict … do update set note_md = excluded.note_md` — **unconditional**.

**Repro (ordinary flow, no edge case):** write a justification note on a standard → later reopen it to change the status `parcial` → `conforme` → submit. **The note is gone.** ⚠ Frontend flagged the gap honestly but graded it "Low-risk (the note is never lost — resubmitting just overwrites it)" — those are *the same thing*; overwriting IS losing it. The self-contradiction is the tell, and it is why the fix was scheduled as polish rather than as a defect.
**Fix — all three halves, in the order they were found:**
- ✅ **RPC half** (`20260903001400`, `ee2e52b`): `note_md = coalesce(excluded.note_md, standard_assessments.note_md)` — NULL leaves the note untouched, a real value (**including `''`**) overwrites. pgTAP C7b, mutation-proven (K9). Backend did this **against the lead's explicit "no coalesce" instruction and was right to** — it was a defect in code it shipped that same turn, and clearing survives at the SQL layer via `''`. A teammate overriding a wrong instruction, and saying so, is the behaviour to keep.
- ✅ **Action half** (`83e3155`): the partial fix had opened a **silent no-op** — `optionalString` (`actions.ts:107`) is `return value || undefined`, so an emptied textarea yielded `undefined`, never `''`, and the coalesce then silently restored the old note. Fixed with `optionalClearableText`, scoped to `setStandardAssessment`'s `noteMd` alone after checking every other `optionalString` call site (`version`, `description`, `descriptionMd`, `parentId`, `note` — none needed the distinction).
- ✅ **Read path** (`3ece65f` + `83e3155`): `public.get_standard_assessment` → `getStandardAssessmentDetail` → `StandardDetailPage`. The textarea prefills; the read-only view stops claiming "Nenhuma observação registrada" when a note exists.
⚠ **The standing lesson: a fix that removes a symptom can hide the defect it was masking.** With the coalesce in, the missing read path no longer destroyed data — so the pressure to build it dropped to zero, and the new "cannot clear" bug was invisible to everything except a test that explicitly clears. **Hence both round-trips are asserted, not one:** C7b (status-only save → note SURVIVES) and C11 (explicit `''` → note is GONE). **Either one alone passes in a broken world.** Relates to ADR 0093 D8.

</details>

✅ **BUG-P16-006 — CLOSED 2026-08-04, tester-verified.** Filed 2026-08-04 (lead), **gate-blocking**. `phase16-accreditation-core.spec.ts:124` hardcoded `INDICATOR_AC1 = '6f4e4aa5-df6f-455a-a550-038453a45394'`, commented "Adesão à higienização das mãos". **That UUID did not exist and never did** — `grep 6f4e4aa5 supabase/seed.sql` returned **0**; the live row of that name was `4f1e8313-9cb2-4f88-91a1-18241ab491c1` at filing time (and a THIRD, different value again after the verification reset below — confirming the id is not just wrong once but unstable on every reset). Cause: `seed.sql:1896` inserts indicators **with no explicit id** (`returning id into v_ind_manual`), so **every `supabase db reset` mints new ids**. A live id was captured mid-session and hardcoded as though it were a seed constant.
Surfaced as `indicator_measurements_indicator_id_fkey` violated at `helpers/accreditation.ts:121`, killing core AC-0 and freshness AC-1.
⚠ **The tester's original 31/31 was green against the DB state that already contained the captured id.** Nothing in the authoring workflow was positioned to catch this — **only the gate's `RESET=1` was.** Reproduced across **two independent gate runs**, the second on a stack verified healthy by a real token POST, so it was not infra.
⚠ **Lead self-correction (kept for the record):** the first gate run's two failures were reported here as "almost certainly infra casualties" of the auth 502. **That was wrong.** The 502 was real and did cause the 100 unrun + 32 infra results, but *these two* were this defect throughout. The re-run is what separated them — **a plausible infra explanation for a real failure is the most expensive kind of wrong**, because it retires the symptom without touching the cause.
**Fix, applied exactly as prescribed:** seeded rows now resolve by a **stable natural key** at fixture time (via a new `lookupIndicatorId(commissionId, name)`, which fails loudly — quoting the query — if the lookup returns no row), never by a captured id. Full 18-UUID hardcoded-literal classification (4 unstable, 14 individually confirmed stable) for all 5 specs + the helper, the fix itself, and both required consecutive fresh-reset verification runs (31/31 → reset → 31/31) are written up in full at the **top of this Bug Log** (above BUG-P16-005) and in the Test Run Summary. Committed `test(e2e): resolve seeded rows by natural key, not captured ids (BUG-P16-006)`.

🧭 **BUG-P16-003/004 — the AUTHORITATIVE sweep (lead, 2026-08-03). Exactly 2 defects; no third exists.** The tester's sweep was keyed on the `Href={(…) => …}` **shape in route files**; the real property is **"any function-valued prop crossing a server→client boundary"** (an `onSelect`/`formatter`/`render` prop crashes identically and matches no `Href` grep). Re-derived **from the boundary**: classified every component in `src/components/accreditation/` by `"use client"`, then inspected every server→client prop block.
**Client components (8):** `assessment-form` · `clone-framework-dialog` · `evidence-picker` · `ownership-editor` · `readiness-chart-loader` · `readiness-chart` · `standards-tree` · `unlink-evidence-button`.
**Function-valued props reaching one — exactly 2:** `framework-list.tsx:71` → `CloneFrameworkDialogTrigger` (**003**) · `[framework]/layout.tsx:58` → `StandardsTree` (**004**).
**Verified safe** (plain data only): `OwnershipEditor`, `AssessmentForm`, `LinkEvidenceDialogTrigger`, `UnlinkEvidenceButton`, `ReadinessChartLoader`.
✅ **Two independent methods agree** — the tester's shape-keyed sweep and this boundary-derived one both return the same 2. That agreement is the evidence, not either sweep alone.
⚠ **Why `readiness-dashboard.tsx` is the safe model, stated precisely:** not because it "calls the closure first", but because **it is a Server Component** — the closure `[framework]/page.tsx` hands it never crosses a boundary; it resolves hrefs to strings *before* rendering the client `ReadinessChartLoader`. **Resolve to strings on the server side of the boundary.**
⚠ **Third green-bar-over-unreached-code instance this phase.** `tsc` + `lint` + a real `next build` are all green with both crashes live: 003 renders only when a **global** framework exists (none locally; Migration F makes it unconditional) and 004 only below the flag gate. **Red-before-green is mandatory on both** — a fix nobody saw fail is unvouched.

### Ad-hoc bug-fix batch (2026-08-03) and the seven bugs it triaged

**Ad-hoc bug-fix batch, 2026-08-03 (lead, uncommitted on `main`).** Seven items triaged together, and
the headline finding is about the BUG LOG rather than the code: **four of the seven were not the defect
they were filed as.** Three do not reproduce at all (BUG-P22-001, BUG-E2EISO-003, BUG-E2EISO-001 —
each re-run under its own documented recipe), and BUG-P22-002 was a spec-timing bug filed as a product
defect. Of the three that were real, **two had materially wrong reports**: BUG-AUTHZ-001 named 4
functions when the catalog holds 5, misnamed one relation, and described only half the defect;
BUG-GATE-001's stated mechanism ("would have printed GATE GREEN") was false. Every correction came from
re-running the repro or querying the live catalog — none from re-reading the report.

Fixed: **BUG-GATE-001** (denominator + UNRUN verdict), **BUG-AUTHZ-001** (migration `…000700` +
pgTAP `270`), **BUG-P22-002** (spec timing), **BUG-P15-001** (spec-side derived window — a seed-side
clamp was tried first and reverted for regressing `phase8-dashboard` 8×). Closed not-reproducible:
**BUG-P22-001**, **BUG-E2EISO-003**, **BUG-E2EISO-001**. Already closed before the batch began:
**BUG-E2EISO-002**. Also fixed in passing: `referrals-list.tsx`'s `STATUS_LIFECYCLE_ORDER` was
missing R3's `answered`/`resolved`, so `STATUS_RANK[status]` was `undefined` → **NaN sort comparator**
and neither state was filterable — despite a JSDoc asserting the list "must stay TOTAL"; it now carries
a compile-time totality guard instead of the comment.

#### ✅ BUG-GATE-001 — `scripts/e2e-prod-gate.sh` drops a `reset FAILED` batch from its OWN coverage denominator · owner **lead** · **FIXED 2026-08-03** (filed 2026-08-03, found by the lead during the FF-4 gate)

**Fix:** `abort_batch()` in `scripts/e2e-prod-gate.sh`. `exp` is now collected BEFORE the reset/server
steps (`--list` needs neither a DB nor a server), and both abort paths add it to **`TOTAL_EXPECTED`
and `TOTAL_DNR`** instead of `continue 2`-ing past the tally. A `batch-N.log` stub is written so the
gap shows in `ls`, a per-batch `-> DID NOT RUN` line prints, the summary carries an explicit
`!! N test(s) NEVER RAN` warning, and a new **`GATE RED (UNRUN)`** verdict (exit 5) replaces the
misleading fall-through to `GATE RED — 0 real failure(s)`.

**Verified by fault injection** (PATH-shadowed `supabase` failing every `db reset`, 48 collected
tests): post-fix → `COVERAGE: accounted for 48 of 48` · `48 did-not-run` · stub logs · RED.
**Over-grant twin on the pre-fix script, same injection** → `accounted for 0 of 0` · `0 did-not-run`:
the 48 vanished from *both* sides. That twin is what proves the fix.

**⚠ ONE CORRECTION TO THE ORIGINAL REPORT.** Its headline — "so it can print GATE GREEN over tests
that never ran" — is **wrong**, and was wrong when filed. Both abort paths already appended to
`RED_BATCHES`, and the verdict requires `[ -z "$RED_BATCHES" ]`, so a run with a dead batch could
never print `GATE GREEN`; the pre-fix script prints `GATE RED` (confirmed by the twin above, on the
byte-identical script the FF-4 gate ran — `9d7bc12`, unchanged through `87fbdde`). The real failure
mode is a **lying summary**, not a false green: `860 of 865` reads as ~99% coverage while 66 tests
never executed. Still the only bug here that makes tests *disappear* rather than go red — the
severity call was right even though its stated mechanism was not.

**Observed.** The FF-4 full-suite run printed:
```
COVERAGE: accounted for 860 of 865 collected tests     ← reads as ~99%
```
The true total across all specs is **931**. Batch 4 had died on `reset FAILED`, so its five spec files —
`ethics-e2-procedure` · `ethics-e3a-surfacing` · `ff1-repeating-groups` · `ff2-matrix-views` ·
`ff2-matrix` = **66 tests** — never executed. `931 − 66 = 865`: the script removed the dead batch from
its own denominator rather than counting it as unrun. **Had those 66 contained the only failures, the
script would have printed `GATE GREEN`.**

**Why it evades notice.** The summary looks *better* than a normal run, not worse. `reset FAILED` is a
single unindexed line hundreds of lines up with no batch number on it, no `batch-4.log` is written, and
the per-batch result lines simply have no row for the dead batch — you must spot a **gap in the batch
numbering**, which nothing highlights. `did-not-run` stayed `0` throughout.

**Repro.** Any run where a per-batch `supabase db reset` fails. It happened **twice in one session, on
different batches**, while a manual `supabase db reset` succeeded immediately afterward — so the reset
failure is transient contention (suspects: back-to-back per-batch resets, and `supabase_edge_runtime`
sitting in `exited` state during "Restarting containers"), not a broken migration chain.

**Fix shape (not prescribed — verify first):** the denominator must come from the collected total, and a
batch that never ran must be reported as unrun (and force RED), not subtracted. Consider also emitting a
`batch-N.log` stub on reset failure so the gap is visible in `ls`.

**Interim workaround for whoever runs the next gate — do all three:**
1. `grep -c "reset FAILED" <log>` **before** reading the summary.
2. Check `m` in `COVERAGE: n of m` against `awk '{s+=$1} END {print s}' /tmp/e2e-prod-gate/spec-counts.txt`.
3. Enumerate batches: `grep -oE "BATCH [0-9]+" <log> | sort -k2 -n -u` — a `BATCH N` header with no
   matching `batch N -> …` result line is an unrun batch.

*(In the FF-4 gate the 66 were re-run standalone → **66/66 green**, so no FF-4 regression hid there. That
had to be established, not assumed.)*

#### ⚪ BUG-E2EISO-003 — `bulk-case-creation.spec.ts:344` (AC2) is not idempotent across runs on one DB · owner **tester** · **NOT REPRODUCIBLE 2026-08-03 — recommend CLOSE** (filed 2026-08-03)

**Ran the record's own decisive repro, both ways, on `20260903000700`:**

| Condition | Result |
| --- | --- |
| prod-standalone (`e2e-prod-gate.sh`), fresh `db reset` | **8/8 · GATE GREEN** |
| prod-standalone, **same DB, second run** (`RESET=0`) | **8/8 · GATE GREEN** (27s — no 3× slowdown) |
| `next dev`, fresh reset then immediate re-run | run 1 7/8, run 2 **8/8** |

The AC2 timeout does not occur. Note the dev-server column is *inverted* from the report: the failure
landed on **AC1a** in the cold run and vanished when warm — a first-test-after-cold-compile artifact
(45.8s vs 26.9s), not a data-leftover one. The spec's own fixtures are `Date.now()`-tagged
(`uniquePrefix`, `mrnTag`), so cross-run collisions are not structurally possible.

**Why the original observation still probably happened:** the record says it fired when batch 1 *died
mid-run* and was re-run "against the DB the dead attempt had already mutated". That is a **partially
executed** run's state — not the same thing as a **completed** run's state, which is what "run the same
file again" actually tests and what passes above. So the trigger is the dead-batch interaction, not
per-run idempotency, and the repro written into the record does not exercise it.

**Recommend closing as not-reproducible** rather than as fixed — nothing was changed in this spec. If it
resurfaces, capture whether the preceding attempt *completed*, which is the variable that matters.

**Symptom:** `TimeoutError: page.waitForURL: Timeout 30000ms exceeded` at line 427, waiting for
`/\/manage\/cases\?criados=2\b/` after clicking commit.

**Repro (decisive, run by the lead):** on a **fresh** `supabase db reset` the file is **8/8 pass**
(12.9s). Running the *same file again* against the now-mutated DB → **1 failed / 7 passed** (43.3s — note
the 3× slowdown). So the spec does not tolerate its own prior run's leftovers.

**Why it surfaced in the gate:** the script gives each batch a fresh DB, so this normally never fires.
It fired because batch 1 **died mid-run** (`server_dead=1, conn_errors=24`) and the **rerun executed
against the DB the dead attempt had already mutated**. That also explains why a *different* test in the
same batch failed in the previous full run — batch-1 instability, not a specific defect.

**Not FF-4, not a product defect.** Pre-existing test-isolation weakness. Interacts with BUG-GATE-001:
an unstable batch produces a rerun on dirty state, which surfaces this, which reads as a real failure.

#### ✅ BUG-P15-001 — `phase15-indicators.spec.ts` AC-4 fails on the 1st-4th of any calendar month — seed-data date arithmetic · owner **tester** · **FIXED 2026-08-03** (filed 2026-08-03)

**Fix (spec-side, `e2e/phase15-indicators.spec.ts`):** AC-4 now reads its aggregation window off the
**actual seeded rows** instead of assuming they share the calendar month containing `new Date()`:

```
responses?status=eq.submitted&select=submitted_at,answers!inner(question_key)
  &answers.question_key=eq.dispensador_disponivel&order=submitted_at.asc
```

…then overrides the dialog's label-derived month bounds with `[first, last]` via the
`Início/Fim do período` inputs MINOR-1 added. Nothing constrains the window to the label's month —
`compute_derived_measurement` uses `p_period_start`/`p_period_end` directly — so a span crossing a
month boundary is legal, which is exactly what the 1st–4th needs. The month label stays the current
month; it is only an identifier for the throwaway measurement.

**Verified on 2026-08-03, inside the failing window.** Before: `Numerador derivado: 1 · Valor: 1`.
After: AC-4 passes, full file **12/12**. **Mutation-falsifiable** — narrowing the window to a single
day yields `Numerador derivado: 0` and reds, so the assertion is load-bearing and the window genuinely
drives the result. Also carries a non-vacuity guard: zero source rows fails loudly rather than
silently computing against an empty window.

**Strictly more robust than the old behaviour, not merely boundary-patched.** On a normal day the
derived window sits inside the month and yields the same 2. On the **1st**, where all six fixtures are
in the *previous* month, the old current-month window would have found **0**; the derived one finds
both. It is date-independent by construction.

<details><summary>⚠ A seed-side fix was attempted first and REVERTED — read before re-attempting</summary>

**⚠ The seed-side fix does not work. Do not re-attempt it without reading this.**

Attempt: age both response loops by `least((i || ' days')::interval, v_month_span * i / 7.0)` where
`v_month_span := now() - date_trunc('month', now())`, so the largest age is strictly less than the span
and every response is provably inside the current month. It **did** fix AC-4, and it is byte-identical
to the old values from the 8th onward.

**It regressed `phase8-dashboard.spec.ts` — 8 failures**, caught by the scoped gate
(`GATE RED — 8 real failure(s)`, batch 1). AC-1 read `Expected "6", Received "5"`; AC-1b, AC-1c, AC-2,
AC-3, AC-5a, AC-5b and the Form-B headline all failed the same way. **A/B-confirmed:** revert
`supabase/seed.sql` alone → fresh reset → AC-1 passes. The DB genuinely holds all 6 rows
(verified in-catalog), so the count is lost in the dashboard read path, not in the seed.

**The underlying conflict.** On the 3rd there are only ~2.5 days of month available, so clamping six
fixtures into it collapses a 6-distinct-day spread into ~3 days. `phase8-dashboard` asserts EXACT
counts against the seeded spread; `phase15` AC-4 needs the two `'nao'` responses inside one calendar
month. **Near a month boundary those two requirements cannot both hold in the seed** — there aren't
enough days. So this is not a matter of picking a better clamp expression.

**Recommendation: take the OTHER option the original report offered** — have AC-4 derive its
aggregation window from the actual seeded dates instead of assuming "the calendar month containing
`new Date()`". That is an `e2e/**` change (tester-owned), leaves the seed untouched, and cannot
perturb `phase8-dashboard`. The seed boundary (backend) should be considered closed to this fix.

</details>

Everything below this line is the original diagnosis, which remains correct.

**Repro:** `npx playwright test e2e/phase15-indicators.spec.ts -g "AC-4" --project=chromium --workers=1` on
its own (no neighbours) → **fails identically**: expects derived numerator **2**, gets **1**
(`"Taxa calculada Numerador derivado: 1 · Valor: 1 /1000 pac-dia"`). Ruled out both hypotheses the lead
asked to check:
- **Not FF-4/`seed_default_answers`** — that mechanism only writes answers on a DRAFT's CREATE branch;
  `compute_derived_measurement` counts only `status='submitted'` responses via
  `app.submitted_form_responses`, and both responses this test depends on are long-submitted, pre-existing
  Phase-15-era seed fixtures FF-4 never touches.
- **Not intra-file ordering / neighbour contamination** — reproduces byte-identical run completely alone.

**Root cause, traced and confirmed against live data (today: 2026-08-03):** `supabase/seed.sql`'s Form-A
response-seeding loop (`for i in 1..6`) sets `submitted_at = now() - (i || ' days')::interval`; the
`'nao'`-answered responses (the ones IND-0003's derived numerator counts) land at `i=1` and `i=4`. AC-4
computes its throwaway aggregation period as **the calendar month containing `new Date()` at test-run
time** (by design — see the spec's own MINOR-1 comment). Confirmed live: the `i=1` response is
`2026-08-02` (this month); the `i=4` response is `2026-07-30` (**last** month — `now() - 4 days` crossed
the month boundary because today is only the 3rd). The just-written measurement row proves it exactly:
`period_start=2026-08-01, period_end=2026-08-31, numerator=1` — `compute_derived_measurement`'s own
`sr.submitted_at::date >= v_from` correctly excludes the `2026-07-30` row; the RPC is behaving exactly as
designed. **The defect is that the seed's fixed day-offsets are not guaranteed to stay within the same
calendar month as each other**, which is only ever false on/near a month boundary — i.e. this reproduces
on the 1st–4th of **every** month (the exact window depends on which seeded index answers `'nao'` and its
offset), not just today.

**Verdict: product/seed-data bug, not a spec defect** — the test's assumption ("today's date-relative seed
responses land in the same calendar month") is reasonable and was true when AC-4 was written; the RPC and
the test's own logic are both correct. Left the spec **unmodified** — weakening or rerouting its window
selection to dodge this would hide a real fixture fragility rather than fix it, and the fix boundary
(`supabase/seed.sql`, owned by backend) is outside `e2e/**`. **Not an FF-4 regression** and not blocking
this phase's own acceptance criteria; flagged because it will keep recurring near every month boundary
until the seed's date arithmetic is made month-safe (e.g. an offset that cannot cross `date_trunc('month',
now())`, or the test deriving its window from the actual seeded dates instead of assuming "current
month" — implementation choice is backend's/tester's call, not prescribed here).

#### ✅ BUG-AUTHZ-001 — `platform_admin` reads response-level content through DEFINER dashboard functions, invisible to a policy audit of `responses` · owner **AUTHZ** · **FIXED 2026-08-03** (filed 2026-07-27, PO's call)

**Fix:** migration `20260903000700_authz_dashboard_gate_uniformity.sql` + pgTAP
`270_authz_dashboard_gate_uniformity.sql` (8/8). PO-ruled 2026-08-03: **unify on the 4-fn shape**
— `app.is_admin()` → `app.is_commission_admin_of(v_commission_id)`. All nine `dashboard_*`
functions now carry one identical gate: `is_staff_admin_of(cid) OR is_commission_admin_of(cid)`.
Verified live: pgTAP 4301/4301 + the 8 new keystones; **mutation-tested** (revert the gate → 6 of
the 8 go red, the 2 non-vacuity tests correctly stay green).

**Three corrections to this report, all found against the live catalog:**
1. **It was FIVE functions, not four.** `dashboard_entity_references` (FF-5's reference surface,
   added after the report) carried the same arm and was never listed.
2. **`dashboard_matrix_risk_scores` does not exist** — the relation is `dashboard_risk_scores`.
3. **The report named only half the defect.** The same five functions also **DENIED**
   `is_commission_admin_of`, which the other four ADMIT. Since `getCommissionAccessByOrg` maps an
   `org_admin`/`hospital_admin` into the `staff_admin` branch (ADR 0051 D1), those users *do* reach
   `/dashboard` — and were served populated Totais/Texto-livre/Ao-longo-do-tempo beside **empty**
   Distribuições/Exportar/Matriz/Risco/Referências. A live user-facing gap nobody filed.

**Root cause (found in `docs/reviews/phase-8-review.md`):** at Phase 8 all six original dashboard
functions shared ONE gate — shape A. A later change put the commission-admin mirror on four and
**missed `dashboard_distributions` + `dashboard_export_rows`**. That partial conversion created the
second shape, broke no test, and every door added since copied a sibling in good faith (FF-2 two,
FF-5 one), carrying the stale shape from 2 doors to 5. **A rewrite applied to PART of a function
family is invisible to every check this platform runs.**

Because of (1) the fix enumerates from `pg_proc`, never a hand-written list. The ADR 0078 A35
census is **not** invalidated for `responses` policies — those were correct; the leak was a
`prosecdef` door the policy-shaped census is structurally blind to, which is ADR 0078's own
documented blind spot. Reachable via PostgREST only: a bare `platform_admin` was already 404'd at
the page (`getCommissionAccessByOrg` → `null`).

**Not FF-2's defect** — FF-2 correctly inherited its sibling's arm (lead-ruled; deviating would have
been the inconsistency). The pre-existing question is what got filed.

| Surface | `prosecdef` | `is_admin()` arm |
|---|---|---|
| `dashboard_distributions` · `dashboard_export_rows` · `dashboard_matrix_cells` · ~~`dashboard_matrix_risk_scores`~~ **`dashboard_risk_scores`** · **+ `dashboard_entity_references` (omitted)** | ✅ | ✅ |
| **`responses` — every policy** | — | ❌ **none** |

**`dashboard_export_rows` is the sharp one: it returns `TABLE(response_id, member_name, submitted_at,
version_number, answers jsonb, signoffs jsonb)` — one row per response with its answers and the
member's name, not an aggregate.** Verified live.

CLAUDE.md's noun rule says `platform_admin` may **not** touch commission content, and ADR 0078 A35
rests on a census finding it reads *0 cases / 0 responses / 0 narratives / 0 meetings*. That census
is consistent with the `responses` policies **and structurally blind to the four DEFINER rows** —
ADR 0078's own documented blind spot (*`prosecdef` belongs beside `pg_policies`*). **So the census
may have understated `platform_admin`'s reach across every dashboard function.** Spans far more than
FF-2 and re-opens an ADR 0078 finding → PO decides, not a phase.

#### ✅ BUG-P22-001 — the referrals hub does not render a seeded `completed` referral · owner Phase 22 · **CLOSED — NOT REPRODUCIBLE 2026-08-03** (filed 2026-07-27)

**Flow 1a passes**, standalone (2.3s) and in full-file context — `e2e/phase22-referrals.spec.ts` is
**40/40 on a clean `supabase db reset`**. The filed diagnosis is wrong on the mechanism too:
`ReferralsList`'s status filter defaults to `"all"`, so a `completed` referral is never filtered out,
and `listCommissionReferrals` excludes only `draft`. The report's "deterministic, fails every run on
a clean stack" does not hold.

**What that triage round was almost certainly seeing:** run the same file twice on one DB and
`R1-4c/R1-8` fails with `strict mode violation: resolved to 2 elements` — ENC-0033 **and** ENC-0035,
both carrying the R1 fixture's subject, because the file's `beforeAll` mints a referral per run
unconditionally. Serial mode then aborts, leaving **5 tests unrun**. Same defect class as
BUG-E2EISO-003; tracked there, not here.

#### ✅ BUG-P22-002 — `phase22-referrals-governance.spec.ts:1187` R5-6 keyboard-only internal note fails · owner **tester** · **FIXED 2026-08-03** (filed 2026-07-27)

**Spec defect, not a product defect.** The test called `textarea.focus()` immediately after
`page.goto()`. `.focus()` is **not** an auto-waiting action — it resolves the node and fires at once,
so racing RSC streaming makes it silently no-op; only the follow-up `toBeFocused()` reports, as
`Received: inactive`, which reads like a focus-management defect rather than a timing one. The notes
panel renders late (after the related-cases panel).

Proof it was never a product bug: **R1-9 in the sibling R1 file is the same keyboard-only flow
against the message composer and has always passed** — because it awaits
`expect(composer).toBeVisible()` first. R5-6 now uses that same shape (gate on the form, then scope
the textarea/submit to it). Re-verified on a fresh reset: **1/1 pass in 4.5s** (was a 19.5s timeout).

#### ⚪ BUG-E2EISO-001 — `orgadmin.a` loses org-admin affordances when 4 specs share a prod batch · owner **tester** · **NOT REPRODUCIBLE 2026-08-03 — recommend CLOSE** (filed 2026-07-28)

**Ran the record's own repro verbatim** — the same four specs packed into ONE prod-standalone batch
(`BATCH_TESTS=200`, one server, one DB, `RETRIES=0`), on `20260903000700`:

```
batch 1 -> 80 passed, 0 failed, 0 flaky, 0 skipped, 0 did-not-run · accounted 80/80 · pw_exit 0
GATE GREEN
```

**80/80.** Same batch composition as the filed 77 + 3. All three named tests
(`hospital-admin-tier` HA-2 ×2, `phase-multitenancy` MT-6) pass batched.

**Most likely already fixed by BUG-E2EISO-002** (`074cc4d`, 2026-08-03 — the FK-CASCADE orphan leak in
the shared `purge()` helper, where `session_replication_role = replica` disabled Postgres's own cascade
triggers and teardown orphaned rows across 15 edges). This record's own hypothesis was "a
membership/roster mutation by an earlier spec in the batch" — a teardown cascading further than intended
is exactly that mechanism, and E2EISO-002's fix landed after this was filed. Stated as the likely cause,
not proven: no one re-ran this repro between the two.

**Recommend closing as not-reproducible.** If it returns, the variable to capture is which spec in the
batch last purged, not which persona lost affordances.

<details><summary>Original report (retained for the repro recipe)</summary>

Three tests fail **only when batched**, each passing when its file runs alone:

| Test | Symptom |
|---|---|
| `hospital-admin-tier.spec.ts:243` HA-2 appoint/revoke | `getByRole('button', {name:'Nomear administrador(a)'})` never appears (30s timeout) |
| `hospital-admin-tier.spec.ts:291` HA-2 no self-delegation | same button, same timeout |
| `phase-multitenancy.spec.ts:205` MT-6 hospital selector | `toBeVisible()` fails on the populated selector |

**Repro** (deterministic — 3 consecutive runs, fresh `db reset` each):
```
SPECS="e2e/phase-multitenancy.spec.ts e2e/hospital-admin-tier.spec.ts \
       e2e/administrativo.spec.ts e2e/cases-board-access.spec.ts" \
  RESET=0 REBUILD=0 RETRIES=0 bash scripts/e2e-prod-gate.sh     # 77 passed / 3 failed
```
`hospital-admin-tier` alone → **38/38**. `phase-multitenancy` + `hospital-admin-tier` on a dev
server → **68/68**.

**Pre-existing, NOT caused by the auth-cache change** — proven by an A/B on unmodified code
through the identical batch: **77 passed / 3 failed, byte-identical outcome** (only the GoTrue
login count differs, 91 → 32). Do not attribute this to `e2e/helpers/auth.ts`.

All three involve `orgadmin.a@test.local` losing org-level UI affordances, so the likely cause is
a membership/roster mutation by an earlier spec in the batch (bucket C-4, shared-seed isolation —
same family as P13-004/005/006). Needs a probe-commission/probe-user fixture rather than mutating
the seeded rede-a org. Not a product defect until that is ruled out.

</details>

---

## AFF-era closed bugs (rotated from PROGRESS.md 2026-08-06 at the AFF Record)

⬛ **BUG-AFF-1 — `addStaff`'s `authorizeStaffOps` has no `hospital_admin` arm; the
commission's own "Adicionar membro" picker is fully offered to a hospital_admin and
refused only at submit. ✅ FIXED 2026-08-06 (`8155be2`).** Filed 2026-08-06, AFF T3.6
(`tester`). **NOT an AFF regression** — `src/lib/members/actions.ts` was last touched by
`36a69d5` (`feat(mem-w2,w3)`, unrelated to AFF) and its `authorizeStaffOps` had only two
arms (staff_admin of the commission, or org_admin of its org) since before this
workstream. **Repro (originally RED-proven; now INVERTED, not deleted, in
`e2e/aff-hospital-affiliation.spec.ts` AFF-1):** as `hospitaladmin.dual@test.local`
(hospital_admin of both `central-a` and `secundario-a`, Rede A), reach
`/o/rede-a/c/etica/manage/members` (renders fine — the page gate
`getCommissionAccessByOrg` and the candidate list `list_addable_commission_members`
both already admit hospital_admin via `is_commission_admin_of`'s hospital leg, ADR 0097
finding 1), click "Adicionar membro", search and select a real, addable org person,
click "Adicionar". **Was:** `[role="status"]` rendered "Você não tem permissão para
esta ação." — the whole picker flow (search, select, enable the submit button) was
offered and interactive, then refused only on the final call. **Violated:** CLAUDE.md
Architecture Rule 1 in spirit (a fully-enabled control that always failed for this role)
and the "a new door must inherit every sibling arm" lesson (memory:
new-door-must-inherit-every-sibling-arm) — the OLDER door was the one missing the arm
its newer sibling (`assignCommitteeRole`/`authorizeForCommission`,
`authorizeHospitalOps(hospitalId)`) already had.
**Status:** ✅ **FIXED 2026-08-06** by `8155be2` (`backend`) — `authorizeStaffOps` gains
a third arm, `hospital_admin` of the commission's `hospital_id`, mirroring
`is_commission_admin_of`'s hospital leg exactly (verified door-by-door against the live
catalog: every door `authorizeStaffOps` fronts already resolved that predicate, so the
TS pre-check was strictly STRICTER than its own doors — it failed CLOSED, which is why
nothing caught it earlier; a refusal always looks like the system working). A second
instance of the same drift (`isInactive` not checked) was found and fixed in the same
commit. Backend unit keystone: `src/lib/members/staff-ops-mirror.test.ts`.
⚠ **This was a MIRROR-DRIFT CORRECTION, not a capability widening** — every door behind
`authorizeStaffOps` already admitted a hospital_admin of the commission's hospital, so
the fix grants nothing the database did not already grant. A future reader must not read
this row as "hospital_admin gained committee-member management" as a security change.
*(The durable statement of the same fact lives in `docs/backend-state.md` under
`authorizeStaffOps` — that, not this archived row, is the surface map.)*
**Re-verified 2026-08-06 (`tester`):** the repro is now the ALLOW arm —
`hospitaladmin.dual` seats the person on Comissão de Ética AS THEMSELVES, asserted by a
service-role `memberships` row read (not merely the toast), plus confirmation the
person's OTHER hospital's affiliation is untouched. A DENY arm sits alongside it in the
same file: `hospitaladmin.a1` (a sibling hospital's admin, central-a only) is still
refused for that same commission, with the membership row count asserted unchanged by
the attempt. Both green, twice-run. The `orgadmin.a` workaround from the original repro
is gone — the intended actor (hospital_admin) now completes the scenario directly.

---

## TV-era closed bugs (rotated from PROGRESS.md 2026-08-06 — overdue from the TV Record)

> All three closed 2026-08-05 but were left in the live Bug Log past their Record step.
> Rotated in the same pass as BUG-AFF-1. `BUG-TV-001` stays in PROGRESS.md — still OPEN.

⬛ **BUG-RCA-001 — RCA citation targets silently omit ALL interviews. ✅ FIXED 2026-08-05.** Filed 2026-08-05 by `backend`, found by the BUG-TV-001 sibling sweep —
**nobody was looking for this one; it is unrelated to ADR 0096.** `listRcaCitationTargets`
(`src/lib/queries/rca.ts:450`) issues
`.from('case_interviews').select('id, interview_number, title, scheduled_start')`.
**`case_interviews` has no `scheduled_start` column** — per `information_schema`, it lives on
`interview_sessions` (an interview has many sessions). PostgREST/Postgres reject the whole
select with `42703 column case_interviews.scheduled_start does not exist`, so `data` is
`null`, `interviews ?? []` yields `[]`, and **every interview is silently dropped from the RCA
citation-target list** — no error, no toast, just missing options. **Invisible to every
existing gate** for the standard reason: a `.select()` is an opaque string and `.returns<T>()`
is a type *assertion*, so it typechecks, lints, and passes E2E (which has no coverage of this
picker). **Fix is a product decision, deliberately NOT taken unilaterally:** an interview has
N sessions, so "the interview's date" must be defined (earliest session's `scheduled_start`?
the interview's `created_at`?) — needs an owner ruling before the embed is written.
**PO RULING 2026-08-05: "the interview's date" is the EARLIEST session's `scheduled_start`.**
**Fixed** in `listRcaCitationTargets` — the select now embeds `interview_sessions ( scheduled_start )`
and derives via the new exported `earliestSessionStart()`. No migration; client layer only.
**Verified against PostgREST, not `tsc`:** the old select returns `42703 column
case_interviews.scheduled_start does not exist`; the new one returns HTTP 200 with real rows — and the
seeded interview genuinely carries TWO sessions (08-03 and 08-08), so the derivation is exercised rather
than trivially satisfied. A full `probe-embeds.mjs` re-run over 286 sites now shows **zero 42703**.
**The ruling is pinned by a TEST, not a comment** (`rca.test.ts`, 5 cases). The helper is exported and
pure precisely because "its date" is a CHOICE — `created_at` was the live alternative, and a comment
would not have survived the next refactor.
⚠ Deliberately NOT status-filtered like `toNextSession` — that helper answers "what is NEXT", this one
answers "when WAS it", and a concluded interview's sessions are exactly the ones it excludes.
⚠ **Mutation-proven per arm** (ADR 0079 A2): sorting descending reds the earliest-wins case; dropping the
undated filter reds the null-handling case. **My first attempt at the second probe was INERT** — the
replace matched nothing and stayed green, which is indistinguishable from a surviving probe and would
have had me delete a good test as vacuous. Confirm a mutation APPLIED before trusting its verdict.

⬛ **BUG-A11Y-001 — duplicate DOM ids on `/admin` broke label→control association. ✅ FIXED 2026-08-05.**
Found by FUP-MEM-2's spec on its **first ever execution** (written 08-04, never run until the full gate).
`useFieldIds(name)` used `name` as BOTH the form key and the DOM id, so two forms on one page sharing a
field name emitted duplicate ids. `/admin` renders three forms and had **three** collisions: `name` and
`slug` (organization vs hospital create) and `organizationId` (hospital create vs org-admin assign).
`htmlFor` resolves to the FIRST match in document order, so each LATER form's labels pointed at the
EARLIER form's controls — clicking "Organização" in the org-admin section moved focus into the hospital
form, and a screen reader announced the wrong field. **Impact is accessibility + focus, not authorization.**
**Fix:** `useFieldIds` gains an optional `id`; `name` still drives `formData.get(name)`, so no action
contract changed. Applied to the two later forms. The systemic fix (id from `useId()`) was deliberately
NOT taken — that primitive backs **38 components** and rewriting it with no cheap re-verification is how a
regression ships → FUP-A11Y-1.
⚠ **The first fix was INERT.** `controlId` was threaded into `descriptionId`/`errorId` while `controlProps`
still returned `id: name`, so nothing reached the DOM and the re-run failed identically. Caught by dumping
the LIVE DOM — re-reading the diff would only have confirmed my intent, never the behaviour.
⚠ **A green suite is not a working teardown.** This spec's purge fought two invariants
(`guard_profile_no_delete` raises unconditionally; `profiles.id` FKs `auth.users.id` with no cascade) and
had never executed, because MEM2-1 failed BEFORE creating the invitee so the purge always matched zero
rows. A teardown is first exercised when the test it cleans up after starts passing.

⬛ **BUG-AUTHZ-002 — the BUG-AUTHZ-001 sweep missed two hospital doors (noun-rule violation). ✅ FIXED 2026-08-05.**
Filed 2026-08-03 during Phase 16 Wave 0; **NOT in Phase 16 scope** — must not ride a Phase 16
migration. `20260903000700` fixed the five `dashboard_*` DEFINERs but left the identical
`app.is_admin()` OR-arm live in **`public.hospital_document_register`** and
**`public.hospital_indicator_rollup`** — both `prosecdef = t`, both returning commission content
(documents; indicator rollups) that ADR 0078 A35's noun rule forbids platform_admin from reading.
**Verified against the live catalog, not the plan text** — the gate reads literally:
```
if not (app.is_admin()
        or app.is_hospital_admin_of(p_hospital)
        or app.is_org_admin_of(app.org_of_hospital(p_hospital))) then return;
```
So the `is_admin()` arm *is* the gate, not a comment. ⚠ Verified at the **catalog** layer
(gate text + `prosecdef` + return shape); a live platform_admin row-count probe has **not** been
run — do that first when fixing, so the fix has a red-before-green. Fix = own migration dropping
the arm + a `270_authz_dashboard_gate_uniformity.sql`-style **parity** extension asserting
platform_admin gets zero rows from *every* hospital-tier DEFINER, ideally before the pilot deploy.
**The lesson is the sweep's boundary, not the two functions**: `20260903000700` enumerated by
*name prefix* (`dashboard_*`) where the real property is "DEFINER door returning commission
content" — the standing "if your enumeration's boundary is a filename, it's wrong" rule, one
level up. Phase 16's own doors are specified to inherit the correct shape (ADR 0093 D6).
**Status:** ✅ **FIXED 2026-08-05** by `20260908000100`, held by
`299_hospital_content_door_noun_rule.sql` (11/11).
**RED BEFORE GREEN, as this entry asked:** the live probe it was missing was run first —
platform@ read **3 documents / 2 rollups** from Hospital Central A; after the migration, **0 / 0**.
Twins: hospital_admin.a1 and orgadmin.a still read 3 / 2, so the fix did not fail closed.
**Mutation-proven per arm** (ADR 0079 A2's FORK rule): restoring the disjunct on
`hospital_document_register` reds §2.1 only, on `hospital_indicator_rollup` reds §2.2 only —
neither assertion is redundant, and one probe would have made the other look vacuous.
⚠ **This entry's prescribed test was wrong as written.** "Zero rows from *every* hospital-tier
DEFINER" fails on `verify_audit_chain`: enumerating the property live returns **four** doors, and
that one's `app.is_admin()` is its **platform-tier** branch (all args null) — audit is
platform_admin's own noun, so the arm is correct and permanent. Its hospital branch already
excluded platform_admin. Probed both ways (42501 at hospital tier, `ok = t` at platform tier). The
property is commission **content**, not hospital **tier**; `299` §4 derives the door set from
`pg_proc` at run time and reds on any unrecognised member.
⚠ **Two existing tests encoded the OLD behaviour and had to be inverted** — the fix is not
complete without them: `200_controlled_documents.sql` #30 *required* `>= 2` rows for platform_admin
(a test pinning the leak), and `283_accreditation_readiness_report.sql` E3 used this very bug as its
**non-vacuity control**, so fixing the bug removed the control and left E1/E2 unfalsifiable. E3 is
re-anchored on `verify_audit_chain`. **A control anchored on a defect evaporates when the defect is
fixed — anchor it on something correct BY DESIGN.**

---

## TV phase — BUG-TV-001 (rotated from PROGRESS.md 2026-08-06, closed at rotation)

⬛ **BUG-TV-001 — process-template narrative-slot EDIT and REMOVE are dead end-to-end
(QA finding F-1, `tester`-owned F-2 coverage).** Filed 2026-08-05, TV phase.
**Repro:** as `chefe.ccih@test.local` (staff_admin, CCIH/Rede A), create a draft process
template, add a narrative slot (works), then (a) open its edit dialog, change the title,
submit, or (b) click its trash icon and confirm removal. **Expected:** (a) the dialog
closes and the card shows the new title; (b) the card disappears and the DB row is gone.
**Actual:** both fail with the friendly pt-BR toast "Narrativa não encontrada." — (a) the
edit dialog stays open showing that banner, title unchanged; (b) the confirm dialog closes
(Radix default) but the page-level banner shows the same message and the card/DB row
survive untouched. **Root cause (F-1):** `commissionOfTemplateNarrative`
(`src/lib/case-narratives/actions.ts:232`) selects the PostgREST embed
`process_templates(commission_id)` from `.from('process_template_narratives')`. ADR-0096
dropped `process_template_narratives.template_id` — the FK that embed relied on — so
PostgREST rejects it with `PGRST200` at parse time. The helper discards `error` and
returns `null` from `data?.process_templates?.commission_id ?? null`, so both
`updateTemplateNarrative` and `removeTemplateNarrative` take the `!commissionId`
early-return and answer with `MESSAGES.missingNarrative` ("Narrativa não encontrada.").
Fails CLOSED, not an authz hole, but both actions are fully wired to the UI
(`narrative-slot-dialog.tsx:129` / `template-builder-shell.tsx:243`), so this is a
deterministic dead end for every staff_admin, on their own commission's own template.
**Violates:** PHASES.md TV acceptance for narrative-slot authoring (edit/remove parity
with create); ARCHITECTURE.md Rule 9 data-access-layer correctness (the query no longer
matches the live FK graph). **Spec (RED-proven against current HEAD, before any fix):**
`e2e/process-template-narrative-slot-crud.spec.ts` — two independent tests (own draft
template + own narrative slot each, no shared/seeded fixture), asserting the CORRECT
behavior (edit persists the new title; remove deletes the row), so both currently fail
red for exactly the F-1 reason: `narrative-slot EDIT` fails at the "dialog closed"
assertion (stays open, showing `status: Narrativa não encontrada.`); `narrative-slot
REMOVE` fails at the "no not-found banner" assertion (banner present; DOM snapshot
confirms the slot card `region "Slot Para Remover …"` survived). **Owner:** `backend`
(fix `commissionOfTemplateNarrative` to resolve the commission without the dead FK
embed — e.g. join through `process_template_versions.template_id` in two round trips, or
add a substitute FK/view). **Status:** ✅ **FIXED by `backend` 2026-08-05** — no migration
needed (client-layer only). `commissionOfTemplateNarrative` now selects the nested embed
`process_template_versions(process_templates(commission_id))` — a single round trip along
the live FK path `process_template_narratives.template_version_id →
process_template_versions.template_id → process_templates`, derived from `pg_constraint`
and mirroring `contextOfPhase` (`src/lib/process-templates/actions.ts:179`). **Verified
against PostgREST, not `tsc`:** the old embed returns `PGRST200` ("Could not find a
relationship…", hint: "Perhaps you meant 'process_template_versions'"); the new one
returns the correct `commission_id` for a real slot under an authenticated session.
Both actions' resolver helpers (all 5 in the file) now log the discarded `error` instead
of folding a query failure into an indistinguishable "not found". **Mutation-checked:**
reverting only the select string turns the spec red again (2 failed) and fires the new
log line — so the green is causally attributable to the fix, not to environment.
`e2e/process-template-narrative-slot-crud.spec.ts` 2/2 green locally (chromium); spec
unmodified — final gate verification remains `tester`'s.
**CLOSED 2026-08-06 (lead).** The entry’s own last condition — “final gate verification
remains `tester`’s” — is discharged, and was already discharged when the row was written: the fix
`c557a32` is an **ancestor of** `f6c847d`, which is the commit the **PCI + TV final `e2e:prod`**
ran green on (965 passed / 0 failed), and the **AFF final gate** then ran the full 85-spec suite
green again on 2026-08-06 (985 passed / 0 failed · 16 batches, no gaps · 0 did-not-run · accounted
986/991). Re-verified at the **code** layer, not from this entry’s text: the resolver now selects
`process_template_versions(process_templates(commission_id))` and `console.error`s the discarded
error instead of folding it into “not found”.
⚠ **Honest limit of the evidence:** the gate artifacts are gone from disk, so this rests on the
gate’s denominator reconciliation (no batch gaps, 0 did-not-run, 986/991 accounted) rather than on
seeing these 2 tests named in a log. That is the project’s own standard for “the suite actually ran
it” — but it is a reconciliation, not a sighting.
⚠ **The row sat 🔴 for a day after it was green.** Nothing re-reads a bug row once its Status line
says FIXED; the marker is what gets scanned. When a fix lands, move the MARKER in the same edit.


## Live-file closed table + method notes (rotated from PROGRESS.md 2026-08-06)

> The one-line closed table PROGRESS.md kept after the 2026-08-04/06 rotations, plus the
> 2026-08-03 batch’s two standing method notes and the "earlier eras" pointer paragraph,
> moved verbatim. Every bug named here has its full entry earlier in this file.

### Closed — rotated 2026-08-04 · 2026-08-06 → [bug-log-archive.md](./bug-log-archive.md)

| Bug | Summary | Closed |
| --- | --- | --- |
| **BUG-TV-001** | Process-template narrative-slot EDIT and REMOVE were dead end-to-end — ADR 0096 dropped the FK a one-hop PostgREST embed relied on, and the helper folded the resulting `PGRST200` into a friendly "Narrativa não encontrada." Fixed by `c557a32` (client layer, no migration) via the live 3-relation path; green on two full prod gates. ⚠ **A `.select()` is an opaque string and `.maybeSingle<T>()` asserts rather than validates** — the dead embed typechecked perfectly. Verify embed changes against PostgREST, never `tsc` | 2026-08-06 |
| **BUG-AUTHZ-002** | The BUG-AUTHZ-001 sweep enumerated by **name prefix** (`dashboard_*`) where the property is "DEFINER door returning commission content" — it left the same `app.is_admin()` arm live in `hospital_document_register` + `hospital_indicator_rollup`. Fixed by `20260908000100`, held by pgTAP `299` (11/11); red-before-green proven (3 docs / 2 rollups → 0 / 0). ⚠ The entry's own prescribed test was wrong — `verify_audit_chain`'s `is_admin()` arm is its **platform-tier** branch and is correct BY DESIGN | 2026-08-05 |
| **BUG-RCA-001** | `listRcaCitationTargets` selected `case_interviews.scheduled_start` — a column that lives on `interview_sessions`. `42703` → `data` null → **every interview silently dropped** from the RCA citation picker. PO ruled "the interview's date" = earliest session; pinned by `rca.test.ts` (5 cases), not a comment. Zero `42703` across 286 embed sites after the fix | 2026-08-05 |
| **BUG-A11Y-001** | `useFieldIds(name)` used `name` as both form key and DOM id — three id collisions on `/admin` sent each later form's labels at the earlier form's controls. ⚠ The **first fix was INERT** (`controlProps` still returned `id: name`); caught only by dumping the live DOM. Systemic `useId()` fix deliberately deferred → FUP-A11Y-1 | 2026-08-05 |
| **BUG-AFF-1** | `addStaff`'s `authorizeStaffOps` lacked a `hospital_admin` arm — the "Adicionar membro" picker was fully offered to a hospital_admin and refused only at submit. ⚠ A **mirror-drift correction, not a capability widening**: every door it fronts already admitted them, so it failed CLOSED and nothing caught it. Durable statement → `docs/backend-state.md` (`authorizeStaffOps`); AFF-1 E2E now carries an ALLOW **and** a DENY arm | 2026-08-06 |
| **BUG-P16-001** | Saving a standard assessment **silently destroyed** the existing `note_md` — no read path, unconditional upsert. Fixed in three halves (RPC `coalesce` + `optionalClearableText` + a real read path). ⚠ **Both** round-trips are asserted (pgTAP 281 C7b *and* C11) because either alone passes in a broken world | 2026-08-03 |
| **BUG-P16-002** | **P0** — all 7 `queries/accreditation.ts` functions still `throw new Error('not implemented')`; every Phase 16 screen dead on arrival. The contract was scheduled, the implementation never was. Survived the whole green bar because the routes sat behind a flag seeded OFF | 2026-08-03 |
| **BUG-P16-003** | `framework-list.tsx` forwarded a `frameworkHref` **closure across a Server→Client boundary** — crashed the commission framework list for every staff_admin as soon as one global framework existed | 2026-08-03 |
| **BUG-P16-004** | Same shape in `[framework]/layout.tsx` → `StandardsTree`; crashed every framework **and** standard-detail page — the larger blast radius of the two | 2026-08-03 |
| **BUG-P16-005** | `"padrãoes"` — a plural built by suffix concatenation on an irregular `-ão` noun. The sweep found a live sibling (`"em atençãos"`); the PO ruled the final wording; tolerant regexes were then replaced with exact literals **plus** a dedicated plural guard test | 2026-08-04 |
| **BUG-P16-006** | 4 indicator ids hardcoded as **captured** UUIDs; `seed.sql` mints fresh ones on every reset, so the gate's `RESET=1` broke them. Fixed by natural-key lookup; verified across two consecutive fresh resets (31/31 → reset → 31/31) | 2026-08-04 |
| **BUG-GATE-001** | `scripts/e2e-prod-gate.sh` dropped a `reset FAILED` batch from its **own** coverage denominator — 66 unrun tests reported as "860 of 865". Fixed + fault-injection-verified, with an over-grant twin on the pre-fix script | 2026-08-03 |
| **BUG-AUTHZ-001** | `platform_admin` read response-level content through **five** `dashboard_*` DEFINER doors, invisible to a policy audit of `responses`. Unified on the 4-fn gate shape (`…000700` + pgTAP `270`). ⚠ **The report was wrong 3×** — 5 functions not 4, one relation misnamed, and only half the defect described | 2026-08-03 |
| **BUG-P15-001** | `phase15-indicators` AC-4 red on the 1st–4th of any month (seed day-offsets crossing the month boundary). Fixed **spec-side** (`93a0f9a`) by deriving the window from the seeded rows. ⚠ A seed-side clamp was tried FIRST and reverted — it regressed `phase8-dashboard` 8× | 2026-08-03 |
| **BUG-P22-002** | R5-6 keyboard-only internal note — a **spec-timing** bug filed as a product defect; `.focus()` is not auto-waiting | 2026-08-03 |
| ⚪ **BUG-P22-001** | **Not reproducible** — 40/40 on a clean reset; the filed mechanism was wrong too | 2026-08-03 |
| ⚪ **BUG-E2EISO-001** | **Not reproducible** — 80/80 on the record's own batch repro; most likely already fixed by BUG-E2EISO-002 | 2026-08-03 |
| ⚪ **BUG-E2EISO-003** | **Not reproducible** — 8/8 fresh and 8/8 again on the same DB; the real trigger is a *partially executed* prior run, which the filed repro never exercises | 2026-08-03 |

⚠ **The 2026-08-03 ad-hoc batch's headline finding was about the bug log itself, not the code: four of
seven items were not the defect they were filed as** — three do not reproduce at all, one was a spec
bug. Of the three that were real, two had materially wrong reports. **Every correction came from
re-running the repro or querying the live catalog; none from re-reading the report.**

⚠ **BUG-P16-003/004 leave a reusable sweep rule.** The tester keyed its sweep on the `Href={(…) => …}`
*shape in route files*; the real property is **any function-valued prop crossing a server→client
boundary** (an `onSelect`/`formatter`/`render` prop crashes identically and matches no `Href` grep).
Re-deriving **from the boundary** — classify components by `"use client"`, then inspect every
server→client prop block — found the same 2, and *that agreement* is the evidence, not either sweep
alone. **Resolve hrefs to strings on the server side of the boundary.**

Earlier eras, all closed and rotated → [bug-log-archive.md](./bug-log-archive.md):
**FF-3** (BUG-E2E-001 · BUG-FF3-001/002 · BUG-FF1-008) · **FF-5** (BUG-FF5-001/002 — both passed pgTAP
4240 + Vitest 851 + tsc + lint + `next build`; **only E2E found them**) · **FF-4** (BUG-FF4-001 — a
pre-existing answer-model-v2 bug FF-4 surfaced; ⚠ the obvious one-line fix would break Rule 3 SQL↔TS
evaluator parity, read the entry before touching `buildAnswerMaps`) · **BUG-E2EISO-002** (the
`session_replication_role = replica` FK-CASCADE orphan leak, fixed across seven files behind one shared
`e2e/helpers/purge-forms.ts`; production was never affected — app roles are denied the GUC).

## Rotated 2026-08-08 at the PDF·P2 Record step

✅ **BUG-PDF2-001 — printed-documents empty-state copy hardcodes "desta resposta" for every
source kind, including meetings.** Filed 2026-08-08 (tester, PDF·P2 M-T1). **Repro:** mint
nothing on a fresh meeting, open its "Documentos emitidos" panel → empty state reads "Nenhum
documento emitido **a partir desta resposta** ainda." **Expected:** copy that reads correctly
for whichever `sourceKind` the panel is bound to (a meeting is not "a resposta"). **Actual:**
the string is a literal in `PrintedDocumentsList` (`src/components/printing/printed-documents-panel.tsx`),
unchanged from P1 — reused AS-IS per the phase's own "provider + template + arm only" rule, so
this is not a P2 regression, just P1's form-specific wording now visibly wrong on a second
kind. **Severity LOW** — cosmetic pt-BR mismatch, no functional/security impact, no clause of
the P2 acceptance list references it. **Owner:** frontend, whenever `src/components/printing/`
is next touched (do NOT special-case this alone — the fix is presumably a `sourceKind`-driven
label, which is exactly the kind of shared-component edit the phase's review question asks to
be justified, not free-floated into M-F1's diff post hoc).
**FIXED 2026-08-08 (frontend, `2e8ef7f`)** — kind-aware copy parameterized in
`src/components/printing/labels.ts` (`documentSourcePhrase` + four copy helpers), per the lead's
recorded ruling authorizing this as legitimate parameterization rather than an abstraction leak.
`form_response` → "desta resposta", `meeting` → "desta reunião"; `case`/`interview` fall through
to a neutral "deste registro" rather than being enumerated ahead of the phases that build them.
⚠ **The filed repro was the empty state, but a sweep of `src/components/printing/` found the same
defect in FOUR more strings** — all in the mint dialog (`mint-document-button.tsx`): its
description, the supersession sentence, and both watermark rationales. All five are fixed. The
watermark rationale needed kind-aware SENTENCES, not noun substitution: a form response is final
once *submitted*, a meeting once its ata is *signed*, so a noun swap would have produced "A
reunião já foi enviada". Copy only — no structural change; `WATERMARK_COPY` became
`WATERMARK_MARK` + `watermarkReasonCopy(kind, watermark)`. Lint + typecheck + `next build` green.


🟦 **BUG-PDF2-002 — meeting-detail `notFound()` returns HTTP 200, not 404, on prod builds.
RESOLVED BY-DESIGN 2026-08-08 (investigated solo session; no app change).** The status is
**Next.js's documented streamed-response contract**, not an app defect, and the fix candidates
were empirically exhausted on the prod-standalone build (Next **16.3.0 stable**, upgraded the
same session): (1) **Baseline probe** — nonexistent meeting id under `chefe.ccih` → 200 with
`<meta name="robots" content="noindex">` injected; **the P1 "sibling proven 404" was a misread**:
a nonexistent `responseId` on `dashboard/submissions/[responseId]` under a legit `staff_admin`
ALSO returns 200 — P1's platform_admin 404 fires in the **commission layout**
(`o/[org]/c/[commission]/layout.tsx`), which **no `loading.tsx` wraps**, hence pre-stream.
(2) **Mechanism** (per `node_modules/next/dist/docs` loading.md §Status Codes + streaming.md
§The HTTP contract): the moment a `loading.tsx` fallback flushes, the 200 is committed; a later
`notFound()` renders the 404 UI inline + injects noindex but can never change the status. The
meeting-detail guard needs fresh DB reads (`getMeetingDetail` under RLS), which suspend below
THREE nested boundaries (`c/[commission]/loading.tsx` → `meetings/loading.tsx` →
`[meetingId]/loading.tsx`). (3) **Guard-in-layout DISPROVEN**: a new `[meetingId]/layout.tsx`
running the guard (cache()-wrapped shared helper) still returned 200 — parent loading
boundaries wrap **nested layouts** too (loading.md: "wraps not-found.js, page.js, and nested
layout.js"); the restructure was reverted as pure cost (extra audit emit on `revisao-ata`,
delayed soft-nav skeleton, zero status benefit). (4) **Remaining real-404 paths, both
rejected as disproportionate**: removing all three loading boundaries (platform-wide
instant-loading regression, violates the §1 UX mandate) or an RLS-scoped existence probe in
`src/proxy.ts` per document request (a THIRD copy of the reach predicate for the door-audit
sweeps to keep in sync, +1 DB round trip per view). **Security unaffected** — RLS boundary
independently held throughout (raw PostgREST probe under the excluded JWT → `[]`); noindex
covers SEO; the app is auth-gated. **Contract now pinned in E2E**
(`e2e/pdf-printing-meetings.spec.ts` test 3: 200 + noindex + 404 UI + zero leak; comment
explains that this assertion going red on a future Next = upgrade it to 404, not a
regression). **Systemic corollary, recorded not fixed:** every detail route whose guard
depends on a fresh read below a `loading.tsx` (`dashboard/submissions/[responseId]` —
probe-confirmed — `casos/[caseId]`, `encaminhamentos/[referralId]`, `itens-de-acao/[itemId]`,
`nsp/[eventId]`, …) shares this contract; if a compliance/monitoring requirement ever
demands a real 404 on any of them, the two costed paths above are the menu.

## BUG-QO-001 (rotated from PROGRESS.md 2026-08-08 — CLOSED in-phase by M8+M9)

⬛ **BUG-QO-001 — the oversight reviewer reached case attachment BYTES; CLOSED in-phase by M8+M9
(2026-08-06, backend; found by frontend post-M8).** Filed with an honest amendment to the M8
record because M8's first close-out overstated it. **Mechanism:** S7 (the `quality_reviewer`
content arm) propagated to two byte surfaces no threading list named — (1) the direct storage
policy `attachments_obj_select_readable` (user-JWT `createSignedUrl`), and (2) `public.open_attachment`
(`prosecdef`), whose app action signs the resolved path with the **service role**, which does NOT
consult `storage.objects` policies at all. **The M8 record was wrong for ~one wave:** it said "the
reviewer reaches zero object rows," true only of surface (1); surface (2) stayed open until M9,
and `frontend` caught it by refusing to infer the door's gate from M8. **Impact:** latent, never
shipped — case attachments can carry PHI and the byte fetch had no audit emit (Rule 11), but the
console offers no download affordance (`bf0f824`) and the reviewer has no product path to the door;
severity was byte-reachability in the DB, not a live UI leak. **Fix:** M8 (`20260911000700`, storage
policy) + M9 (`20260911000800`, in-body `open_attachment` cut) both require `read_case_deliberation`
for case/interview bytes — the bit every content source confers except S7 (D4). Metadata stays
reviewer-visible; an S3-granted reviewer still reads (capability-shaped). **Live-probed both
directions** (reviewer 0 / coordinator 1 on `open_attachment` and `storage.objects`); pinned by
`308` §5 (5.2 + 5.5 each observed RED pre-fix) + q1 `open_bytes_cut` / `open_resolver_door`.
**Lesson (the reason it's logged not silently fixed):** "reads 0 rows through RLS" says nothing
about what a `SECURITY DEFINER` door signs with the service role — the exact BUG-AUTHZ-001 shape,
one surface over. A `createAdminClient()` app-layer sweep (2026-08-06) confirmed `open_attachment`
was the ONLY service-role storage sign reachable by a signed-in user through a per-item door; the
minutes-audio service-role signs are service-to-service / upload, admin-role-gated, not
reviewer-reachable.

## Rotated 2026-08-08 (cont.) — BUG-RESP-001; BUG-PDF2-002 live row retired

BUG-PDF2-002's live-file summary row was removed at this rotation; its full entry (incl. the
RESOLVED BY-DESIGN status) is above, under "Rotated 2026-08-08 at the PDF·P2 Record step".

🟩 **BUG-RESP-001 — "Minhas respostas" listed the WHOLE commission to a `staff_admin`; FIXED
2026-08-08** (found while placing FUP-PDF-1's creator route on top of that list). `listMyResponses`
carried no `created_by` filter and leaned entirely on RLS — but `responses_select` is WIDER than
the screen: it also grants a `staff_admin` every SUBMITTED row of the commission (and a
commission-admin every row). Verified under `set role authenticated`: `chefe.ccih`, author of
**zero** responses, read all **10** CCIH rows on a page titled "Minhas respostas". **Severity:**
no privilege escalation and no cross-tenant leak — every row shown was one RLS already permits
that reader — but the screen's own promise was false, and the resume/print affordances it offers
are creator-shaped. **Fix:** `.eq('created_by', uid)` (uid from `getClaims()`, the ADR 0009 local
JWT idiom), with the reason recorded at the call site so nobody "simplifies" it back out as
redundant-with-RLS. **Pinned** by `e2e/pdf-printing.spec.ts` "Minhas respostas is OWN-only",
asserted against DB truth rather than a row count; the control was run — reverting the filter
turns that spec RED. **Lesson:** RLS being the security boundary (Rule 1) does not make it the
SEMANTIC filter — "who may read this row" and "whose page is this" are different questions, and
a read policy with an admin arm silently answers the first.

## Rotated 2026-08-10 — BUG-QOB-004 (+ its original tester report)

> Moved out of the live Bug Log when that section was cut back to OPEN bugs only. Verbatim.
> The residual product question this entry raised — whether `encaminhamentos/**` should get its own
> KEEP treatment for a bare tenancy admin — did **not** close with the bug: it lives in
> **FUP-QOB-2** (parked with the PO), and the sibling finding it spawned is **FUP-QOB-3**
> (`dispose_event_phi` is now the only Rule-12 disposal door still granting a bare tenancy admin).

⬛ **BUG-QOB-004 — RESOLVED 2026-08-09 (PO ruled CUT-the-arms; `20260917000000`).** The DB moved
to meet the UI rather than the reverse: `is_commission_admin_of` is gone from
`can_dispose_referral_phi`, `dispose_referral_phi` and `create_referral_draft`
(`_for` variant), so the orphaned authorization no longer exists to be orphaned. Follows the
ratified **D5** precedent verbatim (*"a principal with zero PHI bits does not destroy Rule 12
data"* — the same reasoning that CUT `dispose_case_phi`). **Population derived from the live
catalog by property, twice, not from this bug's remembered list of three:** the sweep returned 5
functions and both extras were excluded for a *ratified* reason — `app._audit_access_authorized`
(its tenancy arms are on AUDIT branches, ruling ② KEEP; its referral branches delegate to
`can_read_referral_phi` with no tenancy arm) and `app._case_caps` (`v_orgadmin` confers
`manage_case_access` ONLY — the case-ACCESS KEEP; its S6 referral branch gates on
`is_pqs_operator_of_for`). **0 policies** on the 13 referral relations carried a tenancy arm, and
no other tenancy helper reaches the plane, so the whole cut is function-side.
⚠ **Real consequence, not a no-op:** neither disposal door ever carried a `staff_admin` arm, so
referral-PHI disposal is now **NSP-exclusive** (PQS operator of source or target hospital). The
pt-BR message moved with the arm — *"apenas um administrador da organização ou o NSP…"* was false
the moment the arm went, and is now *"apenas o NSP pode descartar dados do paciente"*.
`create_referral_draft`'s HC071 text needed no change: it already said "apenas a coordenação da
comissão de origem", which the cut turns from an overstatement into the truth. Two stale TS
docblocks fixed in the same wave ([`referrals/actions.ts`](../../src/lib/referrals/actions.ts),
[`referral-dispose-dialog.tsx`](../../src/components/referrals/referral-dispose-dialog.tsx)) — both still
asserted `is_admin() OR is_commission_admin_of(...)`, i.e. they were **already** stale by one wave
(ADR 0078 A35 removed `is_admin()`) and would have been stale by two.
**Gate:** fresh `db reset` 330=330 · pgTAP **175f/5617 PASS** · the re-anchored `295` §7.6 twin +
new **7.7** keystone **RED-PROVEN** (restoring the arm reds test 50 and *only* test 50; 7.6 stayed
green, proving the twin measures a different arm) · restore **byte-identical** (md5 match) ·
`ARM=census` + `ARM=floor` **HOLD** · diff-scoped door sweep **COVERED, 0 BLIND / 0 ERROR**
(findings file backed up and restored — the scoped run truncated it 393→36 lines, the known
partial-sweep hazard) · lint 0/0 · tsc · vitest 1194 · `database.ts` content-unchanged.
▶ **Spawned [FUP-QOB-3](./follow-ups.md): `dispose_event_phi` is now the only Rule-12
disposal door still granting a bare tenancy admin** — found by the sibling-coherence check, left
untouched on purpose, needs its own ruling.

<details><summary>Original report (2026-08-09, tester)</summary>

🔴 **QO·B's UI half orphaned a DB-authorized referral capability for a bare
tenancy admin; `encaminhamentos/**` was never part of the D12 classification.** Filed
2026-08-09 (`tester`, writing the QO·B UI E2E extension). **Not a security defect** — nothing
unauthorized became reachable; the opposite: an authorized capability became UNREACHABLE.
**[CAT]** `docs/plans/quality-office-oversight-phase-b-inventory.md`'s §4 classification (the
PO-ratified Q1–Q9 CUT/KEEP list) never mentions "referral" or "encaminhamento" anywhere —
referrals were **out of scope** for the QO·B program. **[CAT]** confirmed live: `can_dispose_referral_phi`,
`create_referral_draft`, and `dispose_referral_phi` still route `app.is_commission_admin_of`
verbatim (`pg_get_functiondef`, unmodified by any `20260915*` QO·B migration) — the tenancy-admin
disposal/draft capability is **fully intact at the DB layer**. **[MEAS]** but
`src/app/o/[org]/c/[commission]/encaminhamentos/[referralId]/page.tsx:107`'s gate
(`if (!access || access.role === null) notFound()`) **predates QO·B** — it was written when the
session resolver coerced a tenancy admin to `role: 'staff_admin'`, so it always passed for them.
BUG-QOB-003's coercion removal (backend, `4dd5cfa`) makes `access.role` genuinely `null` for a
bare tenancy admin everywhere at once, including this route nobody re-examined during QO·B — so
`admin@test.local` (org_admin of rede-a, zero CCIH membership) now 404s on every
`encaminhamentos/**` route, unable to ever reach the "Apagar dados do paciente" button or the
compose-draft affordance the DB still grants it. **Proven live, twice, on a fresh reset**:
`e2e/phase22-referrals.spec.ts` "Flow 3d" (hub content) and `e2e/nsp-per-hospital.spec.ts` AC-7
"entitled caller (admin) disposes ENC-0004 PHI" both reproduce the 404 for `admin@test.local`
specifically (a genuine committee member on the SAME routes, e.g. `chefe.ccih`/`pqsdual.a`,
reaches them fine — isolated by re-running each file fresh after ruling out an unrelated
self-inflicted `case_referrals`-flag contamination artifact from an earlier scoped test run).
**Blast radius, why this earned a bug rather than a silent spec-only fix:** `phase22-referrals.spec.ts`
runs its whole file `mode: 'serial'`; Flow 3d's failure alone **skipped the remaining 29 tests** in
that file (Flow 4a onward) when it broke — the single stale assertion was hiding nearly the whole
file's coverage, a collateral-damage shape worth flagging on its own.
**Disposition (tester):** did **not** rewrite the two affected tests to assert 404 — that would
have silently canonized an unratified capability loss as intended behavior. Instead swapped both
to `pqsdual.a@test.local` (a genuine CCIH `staff` member who is ALSO a central-a+secundario-a PQS
operator — the same PQS-operator arm `can_dispose_referral_phi` grants, reached through a
membership row the wall never touches), which restores full E2E proof of the underlying
capability without depending on the now-retired coercion. Both files are green (40/40, 32/32) —
see the Test Run Summary row below. **What is genuinely open:** whether `admin@`/`hospitaladmin.*`
losing referral-hub reach is accepted as collateral (the capability lives on for anyone who is
also a genuine committee member or PQS operator, which every real coordinator already is) or
whether `encaminhamentos/**` should get its own `canConfigureCommission`-style KEEP treatment —
**a PO ruling this program never asked for**, same class as the standing rule *"conferring a
capability requires enumerating its consumers."* Owner: PO/backend.
**Registered 2026-08-09 (phase close): ruling PARKED — see FUP-QOB-2. RULED the same day:
CUT-the-arms; see the closure record above.**

</details>

---

## BUG-ACT-EXPIRY-1 · BUG-ACT-ACL-1 · BUG-VACUOUS-ASSERT-1 — RESOLVED 2026-08-10

Rotated from PROGRESS.md at closure. All three were filed by the ACT program (ADR 0106/0107)
and deliberately left open there: the two SQL ones because a behaviour-preserving refactor must
preserve flaws or it is smuggling an authz change under a rename, and the test one because
fixing test logic without the file owner's review is a boundary the tester holds.

Branch: `worktree-fix-vacuous-assert-act-expiry-acl`. Migrations `20260918003000` +
`20260918003100`; new keystone `supabase/tests/320_act_expiry_and_acl_hardening.sql`;
keystone `318` PART 2 amended.

### BUG-ACT-EXPIRY-1 — RESOLVED (migration `20260918003000`, keystones `318` + `320`)

`app.can_manage_professional`'s raw `public.memberships` arm carried no `expires_at` filter, so
an expired `staff_admin` still passed the gate on **10** Class-2 professional-identity /
ethics-vocabulary write RPCs. **Fix:** the arm is gone entirely — `app.has_role` is now the only
membership path, so expiry (`expires_at is null or expires_at > now()`) AND the ACT caller-only
hat condition are both INHERITED rather than re-implemented.

**RED-first, at the door and not just at the gate.** Keystone `320` was run against the pre-fix
catalog first: the expired principal's `create_case_assignment_role` call returned **"caught: no
exception"** — it succeeded and inserted a real row into another org's vocabulary. Post-fix it
raises 42501. A live-staff_admin CONTROL in the same session, same hat, same RPC still succeeds,
so the refusal is not a broken-closed pass.

⚠ **This bug was NOT latent-only, despite being filed that way** (carried here from PROGRESS.md at
the 2026-08-12 rotation — the durable half of the finding). "Latent" described the **seed**, which
carries zero expired memberships, **not the door**, which was genuinely open and inserted a real
row into another org's vocabulary the first time a keystone actually pushed on it. A severity set
from what the fixture happens to contain travels afterwards as if it described the mechanism.
Re-derive "latent" from the door before deferring on it.

⚠ **Keystone `318` PART 2 changed with the fix, as its own comment had instructed.** Assertion 10
is INVERTED (it read `ok(can_manage_professional(...))` at Stage 3 and now reads `ok(not ...)`).
The D5 hat twin was **re-anchored onto the LIVE arm**: leaving it measuring the expired arm would
have left a control anchored on a defect — true by construction once the defect was fixed, and
unable to fail for the reason its own message claims. A CONTROL assertion was added between them
so the pair cannot both pass against a function broken closed.

### BUG-ACT-ACL-1 — RESOLVED (migration `20260918003100`, keystone `320`)

`app.is_entitled_document_approver` carried `proacl = NULL` — not "no grants" but the Postgres
default of EXECUTE **to PUBLIC** — where all 7 of its Stage-2 siblings carry
`postgres/authenticated/service_role`. Re-confirmed from the catalog on a quiet stack before
acting (the original reading was taken while a gate was mid-run). Not an ACT regression: Stage 2
used `CREATE OR REPLACE`, which left NULL→NULL exactly as intended.

**Fix:** the house idiom, `revoke all … from public` then `grant execute … to authenticated,
service_role`. REVOKE-then-GRANT is load-bearing: with `proacl` NULL a bare GRANT would
materialise the ACL with PUBLIC's default EXECUTE still in it and change nothing.

Nothing legitimate lost access — the only in-database caller,
`public.submit_document_for_approval`, is SECURITY DEFINER owned by `postgres`. `320` asserts the
over-revoke twin (`authenticated`/`service_role` RETAIN execute) alongside the denial, and adds a
**uniformity assertion across all 8** Stage-2 gates, so it also reds if any of them is ever
rebuilt with DROP+CREATE — the documented failure mode in which a rebuild silently loses the ACL
the original carried.

⚠ This closed **one instance**, not the population. The standing **AUDIT-INVOKER-WRAPPER** item
remains open.

### BUG-VACUOUS-ASSERT-1 — RESOLVED for its 4 confirmed instances (`e2e/phase22-referrals.spec.ts`)

A conditional whose branches do not all assert is a test that reports confidence it never earned.
All four instances now assert on every path.

**Flow 4c — this one was not merely vacuous, it was hiding a live spec defect.** The moment the
`if (!draftResp.ok()) return` became an assertion, the test went red with
`HC071 — apenas a coordenação da comissão de origem pode encaminhar o caso`. The test ran as
`admin@test.local` acting as `org_admin`, on a comment's stated theory that the admin token
"bypasses the source-coordinator constraint". It never did: `create_referral_draft` gates on
`app.is_staff_admin_of_for(source_commission, auth.uid())` (catalog-verified), and tenancy
authority is not commission-content authority — the CLAUDE.md §1 noun rule. **Every run of this
test since it was written took the silent `return` and asserted nothing.** Fixed by using the
real source-commission coordinator (`chefe.ccih`), plus `p_description_md` so the draft is
actually sendable (`send_referral` refuses a draft with neither a description nor a shared item —
a second gate the test had never reached). Failure messages now carry the response BODY, not just
the status: this RPC has four distinct 400s and a bare status cannot tell them apart.

**Flow 5c** — the entire body sat inside `if (resp.ok()) { if (body !== null) { … } }`. Both are
now assertions, plus a CONTROL (`code === 'ENC-0001'`) proving the reader actually received the
metadata row, so the null PHI fields mean something rather than being a null-everything response.
The `if (resultMd !== undefined)` guard became an unconditional `expect(resultMd ?? null)`.

**Flow 5d** — the `ok() && rows.length === 0` path hit neither branch. Zero rows IS a legitimate
denial (invisibility rather than an explicit error), but it has to be said, not skipped. All
paths now fold into one asserted discriminant (`denied` | `no-rows` | `null-column` | `LEAKED`),
which also fixes the other half of the defect: nothing used to record which branch had run.

**Flow 8c — the accessibility one, and the reason this bug was filed 🟡 rather than lower.** Two
un-elsed `if (isVisible)` blocks with no unconditional assertion anywhere: if neither control
rendered, the test passed while its title claimed to have verified keyboard accessibility — the
exact artifact CLAUDE.md §8's one-keyboard-flow-per-phase rule exists to prevent. Both controls
are now REQUIRED. **Proven able to fail by neutralization**: with the reveal-button locator
swapped for a nonexistent name the test reds with a named message, where the same absent-element
condition previously produced a silent green. `toBeVisible()` now precedes every `focus()` —
`focus()` does not auto-wait and no-ops silently against a still-streaming RSC payload, which
reads like an accessibility defect but is a timing bug.

⚠ **Scope, unchanged:** this covered the ONE file the original bounded check covered. The
repo-wide vacuous-pass audit the bug proposes is **still open** — see the follow-up in
PROGRESS.md. The four fixed here remain a lower bound on the shape's prevalence, and Flow 4c is
now direct evidence that the shape hides real defects rather than merely failing to catch them.

**Verification:** `supabase db reset` → pgTAP **181 files / 5718 tests, all green**;
`phase22-referrals.spec.ts` **40/40** on a fresh seed (the file runs `mode: 'serial'`, so the
newly-created-and-sent referral in Flow 4c was confirmed not to disturb the 26 tests after it);
ESLint clean.

**Authz gates run at closure** (the changes touched a `prosecdef` boolean gate, so ADR 0079's
diff-scoped sweep applies): `ARM=census` 450 live gates / 461 verdicts — **no unswept newcomer**,
and `can_manage_professional`'s name-keyed verdict survived the body rewrite (a *rename* would
have orphaned it; a body replace does not). `ARM=hat` holds, 3 findings all pre-existing and
reasoned-allowlisted. **Diff-scoped `p0-authz-door-audit.sh` over exactly the two changed gates**
(derived from the migration diff, on a fresh reset — the first attempt aborted on a non-green
baseline, which is the documented E2E-leftover artifact, not a defect):
- `app.can_manage_professional` → **COVERED**, failing files include the new `320` and the
  amended `318`.
- `app.is_entitled_document_approver` → **`ERROR` (harness), NOT unswept.** Per §6 an ERROR is
  not a pass, so the runlog was read rather than the verdict taken at face value: neutralizing it
  made `200_controlled_documents.sql` fail **14 of 24** and abort at 24 of a planned 51 — which is
  exactly the 27-test shortfall behind `run-shape!=baseline` — plus a directly-named assertion
  ("7.11: is_entitled_document_approver false for a non-member"). The suite noticed emphatically;
  the harness simply cannot classify a run whose shape differs from baseline.

The partial run overwrote `docs/reviews/authz-door-audit-findings.md` (a full-sweep record);
restored from git per lead-playbook §4.


## BUG-ETHE4-FOCUS-1 (rotated from PROGRESS.md 2026-08-12, closed at rotation)

Phase **ETH·E4**. Fixed `8e5ebcd` 2026-08-11, QA-verified at the mechanism
([eth-e4-review.md](../reviews/eth-e4-review.md) focus item 5). Rotated verbatim below.

> ⚠ **The final paragraph is NOT closed.** The professional lane's typeahead was never
> keyboard-navigated, so whether it shares this defect is untested. It now lives as
> **FUP-ETH-KBD-1** in PROGRESS.md Follow-ups — do not read it here as resolved.

> ⚠ **Distinct from BUG-RDR-001** (open): that one is the *generic* dialog close path
> (focus never returns to a non-`DialogPrimitive.Trigger`), pinned by `test.fail()` KB-3.
> This one was an `onBlur` race + capture-phase Escape **inside one dialog's own typeahead**.
> Fixing either does not fix the other.

✅ **BUG-ETHE4-FOCUS-1 — FIXED 2026-08-11 (`8e5ebcd`), verified by KBD-1 on a prod build.
Add-participant dialog: keyboard focus gets trapped after the typeahead search field, and Escape
silently resets the whole form.** Phase ETH·E4 (`tester`, found live during the dev-server fix
loop, not from static review). Fixed by `frontend` in
`src/components/cases/add-participant-dialog.tsx` + `resolve-linkage-dialog.tsx`.

**Root causes — TWO independent mechanisms, not one.** The lead hypothesized symptom 2 was
downstream of symptom 1; `frontend` disproved that empirically (re-tested with the popup
demonstrably open — Escape still dismissed) rather than accepting it. Both found by reading
`@radix-ui/*` source in `node_modules`, then confirmed live:
- **Trap:** `onBlur={() => setOpen(false)}` closed the popup *synchronously*, racing the browser's
  native focus handoff. The popup's removal dropped `document.activeElement` to `body` for one
  tick; `@radix-ui/react-focus-scope`'s `handleMutations` safety net then refocused its own
  container (`tabIndex=-1`) — a stop Tab should never reach — and the next Tab restarted the
  candidate list from the top. Hence the 3-element loop. **Fix:** defer `setOpen(false)` one tick.
- **Escape:** Radix's `DismissableLayer` listens for Escape on `document` in the **CAPTURE
  phase**, so the field's own bubble-phase `stopPropagation()` was structurally too late
  regardless of where focus sat — the handler was correct in isolation and was NOT the bug.
  **Fix:** `suppressEscapeWhilePopupOpen` wired to `DialogContent`'s `onEscapeKeyDown` (the
  escape hatch `DismissableLayer` honours via `!event.defaultPrevented`), calling
  `preventDefault()` only so the event still reaches the field and closes just the popup.

**Durable lesson:** a component's own event handler can be correct and still lose, if a library
ancestor handles the same key in the capture phase. Read the library source, not just yours.
All three `TypeaheadField` mounts + the resolve-linkage mount verified individually (7+ unique
tab stops each; was 3, forever). The KBD-1 Escape assertion was committed **before** the fix
(`bc60555`), which is why it is a regression guard rather than a description of the fix.

**Repro (keyboard-only, chromium, local dev server):** sign in `chefe.ccih@test.local` → open a
case → Tab to "Adicionar participante", Enter → Tab into the "Tipo de participante" radiogroup,
ArrowDown to select "Pessoa externa ou órgão" (confirmed checked) → Tab once more (lands on the
"Buscar participante externo" search input, which auto-opens its (empty) suggestion popup via
`onFocus`) → continue pressing Tab.

**Expected:** focus moves sequentially through the remaining dialog controls — "Cadastrar novo",
then (once in create mode) Tipo / Nome / Papel / Resumo do envolvimento / Cancelar / Adicionar —
same as every other dialog in this codebase.

**Actual, two distinct symptoms, both reproduced twice on a fresh `db reset`:**
1. **Plain Tab, no Escape:** focus cycles through exactly THREE elements forever — the search
   input (`#ext-search`) → the dialog's own container (`role="dialog"`, which should not normally
   be a tab stop) → a radio input → back to the search input. "Cadastrar novo" and everything
   after it is **never reached** — confirmed via a temporary `document.activeElement` dump over
   10 Tab presses, not inferred from the timeout alone.
2. **Tab then Escape (a natural instinct to dismiss an empty suggestion list):** focus jumps to
   `#prof-search` — the **professional** lane's search field — and the subsequent Tab sequence
   shows the Papel `<select>` now listing only professional-allowed roles and the "Profissional"
   radio checked. **The Escape key resets the entire form's lane selection (and by implication
   the rest of `resetAll()`'s state) back to its defaults**, without the dialog closing and
   without the user asking for that. The second run's test then hit the outer 30s timeout mid-
   diagnostic and Playwright force-closed the page (`Target page, context or browser has been
   closed`) — the state churn is severe enough to blow the budget even instrumented.

**Violates:** CLAUDE.md §8 ("Every form input accessible: labels, keyboard navigation, visible
focus") and this phase's own acceptance criterion for a keyboard-only flow
(`docs/phases/ethics-e4-participant-seating.md` §5.2's E2E bullet). Test:
`e2e/ethics-e4-participants.spec.ts` KBD-1 — left failing (not weakened, not skipped) because the
failure is the accurate signal; do not edit the spec to route around this.

**Not confirmed, flagged as a hypothesis for whoever fixes it:** `TypeaheadField` is shared by
"Buscar profissional", "Buscar participante externo", and "Usuário da plataforma" — the
professional lane's own typeahead was never keyboard-navigated in this suite (`PROF-PICK`/
`PROF-CREATE` drive it by mouse), so whether it shares this defect is untested, not ruled out.

---

## Rotated 2026-08-12 — the FUP batch (both CLOSED)

> Rotated out of PROGRESS.md at the §6 Record step for the 2026-08-12 follow-up batch.
> Full entries verbatim below, each preceded by its resolution.

### ✅ BUG-MIN-E2E-1 — RESOLVED 2026-08-12: **it was never a product defect**

**Root cause: stale local config.** `.env.local` carried
`MINUTES_SERVICE_URL=http://localhost:8000`, but the spec starts its own in-process stub at
`STUB_SERVICE_PORT = 8891` (`e2e/helpers/minutes.ts`), bound to `127.0.0.1`. So the app POSTed
`/jobs` at a closed port, `submitMinutesJob` failed, the upload dialog never closed, and — the file
being `mode: 'serial'` — its 9 siblings stranded. The `:8000` value is the **temporary** flip that
`FUP-MIN-CUTOVER`'s T5 smoke step prescribes ("flip `MINUTES_SERVICE_URL` :8891→:8000 for the
session"); it was never reverted. This also explains the entry's own puzzle (d): the spec was 10/10
green in another worktree at 08:37 the same day because **`.env.local` is gitignored and
per-worktree**, and that checkout still held 8891.

Fixed to `http://127.0.0.1:8891` — deliberately `127.0.0.1`, not `localhost`: the stub binds
`127.0.0.1`, and on Windows `localhost` can resolve to `::1` first and fail identically.
**Verified:** `RESET=1 REBUILD=1 SPECS="meeting-audio-minutes.spec.ts"` → GATE GREEN, test 1 passing
on first attempt, `accounted 10/10`, **0 did-not-run**.

⚠ **The durable fix is the guard, not the value.** Because `.env.local` is per-worktree, any other
checkout flipped during a T5 smoke is still broken. `tester` added
`assertMinutesServiceUrlPointsAtStub()` in `beforeAll`, which compares the configured URL against
the stub port and fails with a one-line diagnostic naming both values. **It was mutation-proven** —
`.env.local` was deliberately mis-set to `:8000`, the diagnostic fired instead of a 30-second
timeout, and the file was restored.

**The lesson worth keeping:** a config error presented as a 30-second `toBeVisible` timeout deep in a
feature spec, and was carried for two days as a *major product bug with a whole feature's E2E
unproven*. Four careful measurements in the original entry correctly ruled out batch-order,
contamination, blast radius and storage — and still landed on the wrong class, because none of them
asked whether the thing under test was **configured to be reachable at all**. The entry even named
the suspect ("a stale value … remains the most likely remaining cause") and stopped, correctly, at
the app/spec ownership boundary.

### ✅ BUG-RDR-001 — RESOLVED 2026-08-12: fixed at the shared layer, both dialog primitives

**The recorded mechanism was right about the symptom but incomplete about the cause.** The entry
said Radix "restores only to a `DialogPrimitive.Trigger`". Confirmed against the installed source
(`@radix-ui/react-dialog/dist/index.mjs:146-149`), the close handler does **two** things:

```js
onCloseAutoFocus: composeEventHandlers(props.onCloseAutoFocus, (event) => {
  event.preventDefault();
  context.triggerRef.current?.focus();
}),
```

That `preventDefault()` **also cancels `FocusScope`'s own restore** (`react-focus-scope` skips it on
`defaultPrevented`). So with a null `triggerRef` — every controlled call site — *both* restore paths
are dead and focus lands on `<body>`. **Consequence for any fix: the two halves must be replaced
together.** Replacing only the `.focus()` leaves the cancelled fallback; replacing only the
`preventDefault()` re-enables a fallback that aims at the wrong element.

**Fix:** `src/components/ui/dialog-focus-restore.tsx` — capture the previously-focused element in a
**layout** effect keyed on `open` (FocusScope moves focus in a *passive* effect, and all layout
effects of a commit flush first), publish it on context, restore on close. Falls through
un-prevented when the captured element is disconnected or disabled, so Radix's own
`DialogTrigger` path still works.

**`alert-dialog.tsx` shared the identical defect and was fixed in the same mechanism** (PO-approved
widening, folded in to ride the same E2E pass). Justified from source, not preference:
`AlertDialogContent` spreads `...contentProps` straight into Radix's *own* `DialogContentModal` and
overrides only `onOpenAutoFocus` / `onPointerDownOutside` / `onInteractOutside` — `onCloseAutoFocus`
is untouched, so the two primitives do not merely have similar bugs, **they share one defective
close path**. Dismissal, where the primitives genuinely differ (`AlertDialog` hard-`preventDefault`s
outside-pointer interaction and has no overlay-click path), was deliberately left unshared.

**Measured `document.activeElement`, before → after** (real key events, before/after isolated by
flipping exactly one line):

| Dialog | Before | After |
| --- | --- | --- |
| "Quem tem acesso?" (ENC-0001, `staff2.farm`) | `BODY` | `BUTTON` — trigger |
| "Atribuir responsável" (ENC-0002, `chefe.ccih`) | `BODY` | `BUTTON` — trigger |
| "Desativar" (`user-lifecycle-actions`, AlertDialog) | `BODY` | `BUTTON` — trigger |

Escape, overlay click and programmatic close all restore; the focus trap still holds after 25 Tabs
(KB-2 unregressed).

⚠ **The honest count for the six AlertDialog call sites is not six** — recorded so it is not
rounded up later: **1 fixed + measured** (`users/user-lifecycle-actions.tsx`) · **3 fixed,
structurally verified only** (`meetings/minutes-audio-slot`, `meetings/review/conclude-bar`,
`users/affiliations-panel`) · **1 fixed and independently measured by `tester`**
(`responses/wizard/orphan-warning-dialog` — the one at genuine risk, since it opens programmatically
and would degrade silently if the wizard replaced the control on re-render; measured restoring) ·
**1 that was NEVER BROKEN** (`documents/document-actions-menu` — Radix's `DropdownMenu` already
restored focus to its own trigger, so the AlertDialog's null-`triggerRef` no-op left it in the right
place; measured identical before and after — **unregressed, not fixed**).

**The KB-3 pin was dropped correctly, not deleted.** `e2e/referral-registros.spec.ts` KB-3 carried
the assertion under `test.fail()`; with the fix in place that marker makes the suite RED, so
`tester` folded the assertion back into KB-2 as the bug's own instruction required.

**The lesson worth keeping:** the entry's own diagnosis — *"`dialog.tsx`'s doc comment claims focus
trapping/restoration come for free … the restore half of that comment is false"* — was a textbook
instance of *a comment is an assertion that goes stale silently*, and the fix corrected the comment
in both primitives rather than leaving the false claim in place beside working code.

---

---

## BUG-REFNOTE-001 — DEFINER doors returned the unmasked `body_md` past the column GRANT

Rotated from PROGRESS.md 2026-08-12 at the §6 Record step. Fix + full reasoning:
ADR [0113](../decisions/0113-referral-door-return-shape.md); completion record:
[authz-invoker-wrapper.md](./authz-invoker-wrapper.md).

⚠ The entry below is the report AS FILED (4 doors). The catalog said **23** across three
tables, and the 15 `case_referral` doors — serving `description_md` — were the larger half
and are NOT described below. Read the ADR for the real scope; this is kept for the repro,
which is what a filed bug is worth archiving for.

✅ **BUG-REFNOTE-001 — DEFINER doors returned the unmasked `body_md` past the column GRANT.
FIXED 2026-08-12** (migration `20260922000100_refnote_referral_door_return_shape.sql`, pgTAP 326,
ADR [0113](../decisions/0113-referral-door-return-shape.md); branch `authz-wrapper-refnote`).
Filed as **4 doors; the catalog said 23** — the same shape (`RETURNS <table>` re-opening what a
column-list GRANT closed) held across `case_referral` (15 doors, serving `description_md` +
`decline_note`), `referral_internal_notes` (6, `body_md`) and `referral_messages` (2, `body`).
**The 15 `case_referral` doors were the larger half and were not in the report.** Fixed as a class:
one named composite per table mirroring its GRANT exactly, projected BY NAME. The filed Control G
was reproduced and closed — the reverted door served `SEGREDO-CLINICO-XYZ` to a plain member, the
narrowed one returns 16 fields with no `body_md`. **Rule 11's two halves resolved separately**: the
READ obligation is discharged by removal (no withheld column is served anymore); the MUTATION
obligation already held (`trg_audit_referral_aiud` + direct `app.audit_write`, catalog-verified, not
taken from body comments). ⚠ The durable defence is pgTAP 326 **t1–t3**, which pin composite ≡ GRANT
— a column added to either side alone reds. Full record → the ADR.

## Rotated from PROGRESS.md at the DM2 Record step (2026-08-13)

Four closed bugs, verbatim, including the "as filed" bodies kept for the evidence trail.
BUG-DM2-001/002/003 were found by the tester during DM2·S4 and fixed in-phase;
BUG-CASEKIND-001 was a pre-existing defect found by QA on 2026-08-12.

✅ **BUG-DM2-001 — FIXED 2026-08-13** (backend, migration `20260924000600`, 373 registered; lead-verified from `pg_proc`): the `p_verified = false` branch now **inserts the `document_version_files` binding** alongside marking the file `failed`, so the failure becomes part of the version's record, the chain policies make it reader-observable, and the projection derives **`failed`** rather than eternal `pending`. No UNIQUE collision is reachable — the proven retry contract is the **pre-finalize** one (re-PUT to the same reserved URL); a post-failure retry is `begin` again, minting a new version with its own binding slot. The immutable-binding guard is untouched. Keystones assert the **projection's substrate, not only the column**: B1 red-first (`have: 0 / want: 1`), **B2 reads the failed state through the chain under `set local role authenticated`** (pre-fix: invisible), B4 message-matches the corridor refusing on *state* rather than as merely-unbound.
**Tester re-verification (2026-08-13):** un-pinned. `e2e/phase-f2-attachments.spec.ts`'s `test.fail()` pin (`DM2-BUG-1`) flipped to an unexpected PASS on the FIRST re-run after the fix (confirmed not a flake — 2 further isolated runs, same result), so it is rewritten as a positive regression pin, **`DM2-VERIFY-FAILED`**: asserts the DB truth (the binding + `upload_state='failed'`) before the UI text ("Falha no envio"). Green on a fresh reset alongside the other 5 restored files (77 collected / 76 passed / 1 pre-existing unrelated skip).

<!-- original filing retained below -->
🟠 **BUG-DM2-001 (as filed) — a verification FAILURE never binds `document_version_files`, so the row reads
"Processando envio" (pending) forever instead of "Falha no envio" (failed).** Filed 2026-08-13
(tester, DM2·S4 write-path testing). Severity: MAJOR (silent data-loss-adjacent UX — no path exists
for the user to ever learn the upload failed, or to retry, once this branch is hit).
**Repro:** `begin_document_upload` → PUT real bytes to Storage (succeeds) → `finalize_document_upload`
(transitions `file_objects.upload_state` to `verifying`) → `complete_document_upload_verification`
called with `p_verified: false` (the documented branch for "the service's own re-download of the
just-uploaded object failed") → `file_objects.upload_state = 'failed'`, but **no**
`document_version_files` row is ever inserted for that version (only the SUCCESS branch of
`complete_document_upload_verification` inserts one). **Expected:** the row's availability reads
`failed` (`AVAILABILITY_PRESENTATION.failed` — "Falha no envio... Remova este item e envie o arquivo
novamente"), per `src/components/documents/document-labels.ts`. **Actual:** `versionAvailability`
(`src/lib/queries/documents.ts`) finds no `document_version_files` binding for the version, so it
falls through to `pending` regardless of the underlying `file_objects.upload_state` — the row is
indistinguishable from a merely slow, still-in-flight upload, forever. **Violates:** the DM2 Wave-A
5-state availability contract (task brief: "`failed` and `disposed` are deliberately distinct on
four axes"); pinned RED via `test.fail()` in `e2e/phase-f2-attachments.spec.ts` (`DM2-BUG-1`), which
will flip to a hard failure the moment this is fixed. **Owner:** backend.

✅ **BUG-DM2-002 — FIXED 2026-08-13** (frontend, `18d08e9`): the unreachable branch,
`DocumentRestrictedBadge` and the `DOCUMENT_RESTRICTED` strings are removed, and the false comment is
replaced in **both** files with the true mechanism — denial is *absence*, `app.can_read_document`
behind the `documents_select` policy is why, an uncleared reader gets zero rows including the
creator, this is **stricter** than the UI assumed, and **ADR 0114 D16** is the named trigger that
would bring the affordance back. `canOpen` deliberately **left alone** (it is correct), and
`version.canOpen` is deliberately **kept** in the `showOpen` condition despite being currently
redundant — inlining today's equivalence would bake a coincidence into the UI, and D16 may tighten
the definition. ⚠ **Its `test.fail()` pin must be REWRITTEN, not un-pinned** (unlike 001/003): the
defect was a *false claim*, not broken behaviour, so nothing will ever flip that pin — a
`test.fail()` that can never flip is a test asserting behaviour the product deliberately does not
have, the same trap the plan's Q1 discharge condition warns about ("a keystone left pinning a
rejection the product no longer wants is a test asserting a bug"). Row-absence is already covered by
the restored AC-4a–d/AC-9.
**Tester re-verification (2026-08-13):** rewritten, not un-pinned, per the lead's ruling — a
`test.fail()` asserting the (now-removed) badge would sit as a permanent expected-failure forever, so
that is not the right closure shape. `e2e/phase-f2-attachments.spec.ts`'s `DM2-BUG-2` is replaced with
**`DM2-CEILING-NOONE`** (`test.fail()` removed): a positive, non-redundant pin — a case with **zero**
`case_access_grants` rows denies an enforcing-labeled document to its own creator/coordinator too, not
just a third-party grantee (AC-4a/b's scenario). Green on a fresh reset alongside the other 5 restored
files.

<!-- original filing retained below for the evidence trail -->
🟡 **BUG-DM2-002 (as filed) — the D15 ceiling's "Restrito" badge is unreachable dead code; `canOpen` can never
be `false` on a rendered document row.** Filed 2026-08-13 (tester, DM2·S4 ceiling testing). Severity:
MINOR/documentation (the underlying SECURITY property is intact and arguably stronger — see below —
this is a dead-code / stale-doc-comment finding, not an access-control hole).
**Repro/evidence:** `app.can_read_document` (read live from `pg_proc`) embeds the D15 ceiling as a
ROW-level AND-conjunct — an uncleared reader gets **zero rows** for an enforcing-labeled document (the
`documents_select`/`document_versions_select` RLS policies both gate on this same predicate), not a
visible row with `canOpen: false`. Confirmed live via a real `begin_document_upload` + PostgREST
probe: even the document's own creator/coordinator got `[]` back for her own just-created
`legal_privileged` document on a case with no `case_access_grants` clearance row (the S1 "fail-closed
— readable by NO ONE" backstop, working as designed). Separately, `DocumentVersionSummary.canOpen`
(`src/lib/queries/documents.ts`) is defined purely as `availability === 'available'`, with **no**
separate door call — so for any row that DOES pass RLS, `canOpen` is unconditionally `true`.
**Expected** (per `src/components/documents/document-row.tsx`'s own doc comment): "The interesting
cell is `available && !canOpen` — the D15 ceiling denying an ordinary case reader. It renders a
NON-INTERACTIVE 'Restrito' badge... E2E AC-9 asserts exactly that." **Actual:** that branch cannot be
reached by any caller today — the denial is 100% row-absence, never a visible Restrito badge.
**Violates:** `document-row.tsx`'s own doc comment (a false claim about observable behavior) and the
original DM2 task brief's framing of the AC-9 contract. Pinned RED via `test.fail()` in
`e2e/phase-f2-attachments.spec.ts` (`DM2-BUG-2`). **Restored `e2e/ethics-e1-access-spine.spec.ts`
AC-4a/b/AC-9 assert the TRUE (row-absence) shape**, matching the pre-DM1 test's own historical
behavior ("O2: hidden from the LIST") — not blocked on this bug. **Owner:** backend/frontend (either
fix the comment to describe row-absence, or wire a genuine row-visible-but-ceiling-denied state if
Phase 19's general access plane wants one later).

✅ **BUG-DM2-003 — FIXED 2026-08-13** (backend; lead-verified from `pg_proc`: the dead `update … set state = 'expired'` is gone from `finalize_document_upload`). The refusal stays **predicate-based** (`expires_at < now()`) — unchanged and still correct — and the **marking moved to reconciliation**, which now sweeps lapsed reserved sessions → `expired` and their still-reserved files → `abandoned`, both counted in its report. Rationale, worth keeping: *a refusal that must also persist state is fighting its own transaction*; reconciliation already existed to sweep exactly this. ⚠ **The sweep validated the bug with real data on first contact** — its smoke run caught **3** lapsed sessions: one planted, plus **two genuine reservations left by the tester's own E2E runs**, i.e. precisely the rows nothing would ever have marked before.
**Tester re-verification (2026-08-13):** un-pinned, rewritten as **`DM2-RECONCILE-EXPIRY`** in
`e2e/phase-f2-attachments.spec.ts` (`test.fail()` removed) — a deliberate choice between the two honest
contracts the marking-moved fix admits (picked, not assumed): asserts `state` stays `reserved`
immediately after the HC0DE refusal (no synchronous marking), then runs the REAL reconciliation script
(`node scripts/document-reconciliation.mjs`, not simulated) and asserts `state='expired'` +
`file_objects.upload_state='abandoned'` afterward. The script's own exit code / global drift count is
deliberately NOT asserted (only this test's own entity is checked) — the pgTAP `329` F3 shared-fixture
lesson the lead flagged applies equally to E2E: a bare count over an append-only/shared table is a
fragility this file's own `auditRows` helper already avoids by always scoping to one `entity_id`
(re-audited across all 5 touched files: every `audit_log` read is action+entity-scoped, none global).
Green on a fresh reset alongside the other 5 restored files.

<!-- original filing retained below -->
🟡 **BUG-DM2-003 (as filed) — `upload_sessions.state` never actually becomes `'expired'`; the UPDATE is rolled
back by its own `RAISE EXCEPTION` in the same statement.** Filed 2026-08-13 (tester, DM2·S4 expiry
testing). Severity: MINOR (the functional refusal is correct and unaffected — only the persisted
`state` column is wrong).
**Repro:** `finalize_document_upload`'s expiry branch: `update public.upload_sessions set state =
'expired' where id = v_s.id; raise exception … using errcode = 'HC0DE';` — no `BEGIN/EXCEPTION`
block, no autonomous transaction; a single PostgREST RPC call is one implicit transaction, so the
`UPDATE` is unconditionally undone when the `RAISE` aborts it. **Expected:** `upload_sessions.state =
'expired'` after an expired-reservation retry attempt (the CHECK-enumerated vocabulary includes
`'expired'` as a distinct member; pinned by pgTAP `329` U12 per the DM2·S2 record). **Actual:** the
row is left in `state = 'reserved'` forever (confirmed by a live E2E run before this was filed — the
functional HC0DE refusal and the UI's "Feche e comece o envio novamente" message both fire correctly
on EVERY subsequent retry attempt, since the check re-evaluates `expires_at < now()` rather than
`state`, but the column itself never reflects reality). **Impact:** any future code that queries
`upload_sessions.state = 'expired'` directly (an abandoned-upload cleanup sweep, an admin report)
will find nothing, even though the refusal-by-timestamp behavior keeps working. Pinned RED via
`test.fail()` in `e2e/phase-f2-attachments.spec.ts` (`DM2-BUG-3`). **Owner:** backend.

✅ **BUG-CASEKIND-001 — `case_events.kind` was enforced in TypeScript ONLY; a forged `kind` insert
succeeded. FIXED 2026-08-12** (migration `20260921000400_case_events_kind_write_authority.sql`).
Found 2026-08-12 by `qa` during the same review; PRE-EXISTING, did not block that batch.

**Mechanism, catalog-verified:** a 16-value `CHECK` on the column, **zero triggers**, and **no `kind`
arm in either INSERT policy**. The vocabulary's real authority was `src/lib/cases/registro-kinds.ts`
— application code. A forged `kind='decision_issued'` insert **succeeded** as an ordinary committee
writer, i.e. a user could mint an event the UI presents as a governance decision. This is the
recorded *"a correct predicate ≠ correct policies"* family: the CHECK constrains the **domain** of
`kind`; nothing constrained **who may write which value**.

**The fix.** `app.is_manual_case_event_kind(text)` — the SQL mirror of the six-value manual
vocabulary — is appended as a `kind` arm to **all four** user-role write policies. The ten system
kinds stay writable only by the eleven `SECURITY DEFINER` RPCs that emit them: they are owned by
`postgres`, which owns `case_events`, and the table is **not** `force row level security`, so they
bypass RLS and are unaffected (`relowner`/`relforcerowsecurity`/`proowner` read from the catalog,
not inferred). ⚠ **The arm is on both INSERTs AND both UPDATEs** — an INSERT-only arm is defeated by
insert-then-update (`note` → `decision_issued`), the recorded *"an exclusion is only as strong as its
weakest mutator"* shape. Policies were amended with `alter policy … with check (<existing catalog
expr> and <arm>)`, never DROP+CREATE, so the E3a `coordinator_only` narrowing and the
`is_case_excluded` arm survive verbatim.

**Proved live as a real persona, `staff3.ccih@test.local`** (a plain `staff` holding a case write
grant — the exact "ordinary committee writer" of the report), rolled back, with controls:

| Check | Result |
| --- | --- |
| Control A — is the persona `staff_admin` of the case's commission? | `false` |
| Control B — a MANUAL kind insert, same session | **succeeds** (capability genuinely intact) |
| F — forged `kind='decision_issued'` INSERT | **refused `42501`** |
| G — insert `note`, then UPDATE to `decision_issued` | **refused `42501`** |
| Oracle — neutralize the arm (`… returns true`), re-run F and G | **both succeed again** |

**Keystones:** `supabase/tests/111_case_docs_events.sql` grows 5 → 9 (forged INSERT refused ·
manual-kind positive control · UPDATE-to-system-kind refused · all four policies carry the arm).
Proved able to fail: neutralizing the helper reds tests 6 and 8. Full pgTAP **5886/5886 PASS** on a
fresh reset; `lint` (5 gates) + `typecheck` clean; authz `ARM=census` / `ARM=hat` / `ARM=floor` all
INVARIANT HOLDS.

**NOT closed by this (deliberate, separate obligations, no minting path):** a case writer can still
`DELETE` a procedural event, and no audit row distinguishes a forged kind from an authentic one.


🟠 **FUP-AUTHZ-WP-SNAPSHOT — the write-path sweep's policy arm silently ran ZERO cases for a valid
subset.** Filed 2026-08-12 while gating BUG-CASEKIND-001. A diff-scoped
`CASES="case_events_writer_insert case_events_staff_admin_insert case_events_writer_update
case_events_staff_admin_update" p0-authz-writepath-audit.sh` printed `BLIND: 0 ERROR: 0 SKIPPED: 0`
and **exercised nothing** — its ARM-2 domain is the 33-row worklist hardcoded at
`p0-authz-writepath-audit.sh:388`, embedded 2026-07-18 and never grown; it contains **zero**
`case_events` rows. ADR 0079 Amendment 3 already names the stale snapshot as a structural gap; what
is new is that a **subset run over policies outside it is indistinguishable from a clean pass**.
The Phase-Gate step-1 "diff-scoped ARM=policy" is therefore a no-op for any policy the snapshot
misses — the recorded *"a detector that finds nothing must be proven able to find something"* class.
⚠ Also re-confirms hazard 1: the run **overwrote** `docs/reviews/authz-writepath-audit-findings.md`
with its empty report (restored via `git checkout --`). Fix: derive ARM 2's worklist from
`pg_policies` at run time, and make a subset that matches no case a non-zero exit.


🟡 **FUP-VACUOUS-COVERAGE-1 — OPEN, spun out of the audit: two tests that NEVER RUN.**
`phi-remediation.spec.ts` REM-8 and REM-9 skip on every run — there is no seeded RCA for
EV-0001, and the only CAPA has a NULL `source_event_id` (both catalog-verified). They are
honest `test.skip()`s, not silent greens, so they are outside the vacuity property and the gate
will never catch them. Closing them means new fixture work against `seed.sql`, which is a
contract with ~900 tests — hence its own item rather than a drive-by.




---

## Archived 2026-08-14 (DM5 resume audit) — the five DM4+DM5 bug records

> Rotated verbatim from PROGRESS.md at the resume audit: the live file had reached **139 KB**
> against CLAUDE.md §7's "well under 60 KB", and every teammate spawn reads it.
> **All five were CLOSED.** ⚠ `BUG-DM4-DUP-1` was still carrying a 🟠 OPEN marker while it
> had been fixed at `5ac8d849` and pinned red-first by `f8052575` — corrected on rotation.

### 🟢 BUG-DM5-S2-STUB-1 — ✅ **FIXED 2026-08-14** (`cbcabe7a`) — the RCA and CAPA NSP workspace pages 500'd for EVERY user — the S2 query/action TS layer was never wired to the RPCs (owner: `backend`)

> ✅ **Verified by `tester`, independently, not on the fix commit's say-so:** `grep -c "not implemented — DM5
> S2"` → 0 across `rca-actions.ts` / `capa-actions.ts` / `queries/rca.ts` / `queries/capa.ts`; both
> `EVID-RCA-UPLOAD-1` and `EVID-CAPA-UPLOAD-1` (new suite, `e2e/dm5-nsp-evidence.spec.ts`) drive a
> real browser round trip through `NspRcaPage`/`NspCapaPage` end to end; the pre-existing
> `phase14c-rca.spec.ts` + `phase14d-capa.spec.ts` return to their **exact prior baseline, 36/36**,
> confirming the page-render regression is gone, not merely worked around.

Filed 2026-08-14 (`tester`, DM5 S2 gate step 2, before writing any new spec — the fixture-vs-defect
check CLAUDE.md/the spawn brief calls for). Severity: **CRITICAL / phase-blocking** — this is not the
upload-kind gap `BUG-DM5-CAPA-1` was about; it takes down the ENTIRE RCA and CAPA workspace page for
every persona, including the pre-existing (pre-DM5) regression suite.

**Repro:**
1. Fresh-reset, seeded local stack; `npm run dev`.
2. Sign in as `pqs.a@test.local`, navigate to `/o/rede-a/nsp/rca/f3000000-0000-0000-0000-0000000000a3`.
3. Page returns HTTP 200 (Next streams past a `loading.tsx` boundary, so status alone hides this —
   see memory `streamed-notfound-status-contract`) but renders only the top-level
   `ErrorBoundaryHandler` fallback: **"Algo deu errado — Não foi possível carregar a análise de causa
   raiz. Tente novamente em alguns instantes."** No workspace content of any kind renders — not the
   problem statement, not factors, not root causes, not evidence.
4. Server/browser console shows the underlying throw:
   `Error: not implemented — DM5 S2` at `listRcaEvidenceViews`
   (`src/lib/queries/rca.ts:492-494`), inside `NspRcaPage`.
5. Identical shape for CAPA: `/o/rede-a/nsp/capa/ca000000-0000-0000-0000-0000000000a3` renders "Algo
   deu errado — Não foi possível carregar o plano de ação", thrown from `listCapaActionEvidenceViews`
   (`src/lib/queries/capa.ts:474-477`) inside `NspCapaPage`.

**Mechanism:** `listRcaEvidenceViews` / `listCapaActionEvidenceViews` (reads) and every S2 write
action — `beginRcaEvidenceUpload` / `finalizeRcaEvidenceUpload` / `addRcaEvidenceLink` /
`addRcaEvidenceCitation` / `openRcaEvidence` (`src/lib/safety/rca-actions.ts:480-525`),
`beginCapaEvidenceUpload` / `finalizeCapaEvidenceUpload` / `addCapaEvidenceLink` / `openCapaEvidence`
(`src/lib/safety/capa-actions.ts:402-429`) — still literally `throw new Error('not implemented — DM5
S2')`, the placeholder body posted with the contract (`fec8a84f`, `fec8a84f`/`fc96514b`). `git log
--all -- src/lib/safety/rca-actions.ts src/lib/safety/capa-actions.ts` shows no commit after
`fc96514b` (which deleted the OLD pre-S2 implementation) ever filled these bodies in — the migrations
(M1–M6, the BUG-DM5-CAPA-1 fix, pgTAP `341`) built and keystoned the real RPCs/policies directly in
SQL, but nobody wired the TS query/action layer the UI actually calls to invoke them.

Because `NspRcaPage` / `NspCapaPage` (`src/app/o/[org]/nsp/rca/[rcaId]/page.tsx`,
`.../capa/[capaId]/page.tsx`) await these calls inside the **same** `Promise.all(...)` as every other
read on the page, one throw takes the WHOLE page down, not just an evidence section — there is no
per-section error boundary here.

**Not a fixture problem — proven against the pre-existing baseline.** Re-ran the already-passing
`e2e/phase14c-rca.spec.ts` `R1` and `e2e/phase14d-capa.spec.ts` `C1` (both predate DM5) at current
HEAD: **both now fail** — the seeded content (`compressa cirúrgica retida` / `dupla checagem
padronizada`) never renders, 5 s timeout, same root cause. So DM5 S2 did not merely fail to add
evidence coverage; it regressed the pre-existing RCA/CAPA workspace suite outright.

**Expected (ADR 0120 / the S2 contract, `src/lib/safety/evidence-contract.ts`):** the workspace loads
normally; the evidence panel lists rows with `availability`/`canOpen` per row; upload/link/citation
writes go through begin→PUT→finalize or the direct RPC and return `NspEvidenceActionState`.

**Actual:** the entire RCA/CAPA workspace page is unrenderable for every persona.

**Violates:** PHASES.md's test contract for Phase 14c/14d (workspace loads, R1/C1) — a pre-existing
acceptance criterion, not just the DM5 S2 acceptance surface — and ADR 0120's own S2 scope (evidence
read/write functional).

**Blocks:** all four items in this gate-step-2 task (upload-kind E2E for RCA+CAPA, the keyboard-only
begin→PUT→finalize flow, the `pending`/`failed`/`disposed` availability states, and the `link`/
`citation`/`document`-target regression) — none can be driven through the UI while the page cannot
render. Full spec coverage is being written regardless (ready to validate once the bodies are wired);
see the Test Run Summary entry below for the as-run (blocked) result.

**Fix pattern already proven in this codebase:** `src/lib/documents/actions.ts` +
`src/lib/queries/documents.ts` implement the equivalent begin/finalize/open/list wiring for the
Wave-A/B/C document corridor against the same RPC family; `e2e/helpers/document-model.ts` has the
matching E2E helpers (`beginUpload`, `finalizeUpload`, `openDocumentVersion`, `createDocumentFixture`)
this suite reuses once the bodies land.

### 🟢 BUG-DM5-S2-WRITE-ARM-1 — ✅ **FIXED 2026-08-14** (`fc7a146d`, migration `20260927000160_dm5_s2_write_arm_nsp.sql`) — `app.can_write_document` had NO `rca`/`capa_action` case — the write corridor P0002'd for EVERY user, independent of BUG-DM5-S2-STUB-1 (owner: `backend`)

> ✅ **Verified by `tester` — ONE clean confirmation, not two.** My first post-"fixes landed" probe
> (`chefe.farm@test.local` / `staff1.farm@test.local` / `nspcoord.a@test.local` all **ACCEPTED**) is
> **NOT valid evidence for this fix** — it is entangled with a separate, same-stack incident: a
> lead-run mutation-testing harness had transactionlessly neutralized this exact function minutes
> earlier (`app.can_write_document` → unconditional `return true`), and that probe caught the
> neutralization, not the fix. Recorded here only as provenance for that incident, corrected after the
> fact so it does not read as a fix check. **The clean confirmation is the probe run AFTER the harness
> restored the function**: `chefe.farm@test.local` — zero relationship to the RCA — gets `500 P0002` on
> `begin_document_upload('rca', …)`; `prosrc` diffed against the migration's intended body (both arms
> present, zero `return true` residue); registry 399==399; siblings
> `can_write_rca`/`can_write_capa`/`can_read_document` all non-degenerate. `EVID-RCA-UPLOAD-1` /
> `EVID-CAPA-UPLOAD-1` completing the real corridor end to end is independent, clean confirmation on
> top of that.

Filed 2026-08-14 (`tester`). Severity: **CRITICAL** — a distinct root cause from BUG-DM5-S2-STUB-1,
one layer deeper: even a hand-written `beginRcaEvidenceUpload`/`beginCapaEvidenceUpload` that calls
`begin_document_upload` correctly would still fail, because the SQL authority function it depends on
has no branch for either new home type.

**Mechanism (read from `pg_get_functiondef`, the live catalog — never migration text):**
`app.can_write_document(p_document_id, p_uid)`'s dispatch is a `case v_type when 'case' … when
'case_referral' … else return false end case` over `securable_resources.resource_type`. **`rca` and
`capa_action` are absent from the case list**, so they fall through to the unconditional `else return
false`. `git grep -l can_write_document supabase/migrations/*.sql` confirms the function was last
touched by DM4's `20260926000200_dm4_document_kernel_referral_arms.sql` — no DM5 migration
(`2026092[7-9]…`) ever added an `rca`/`capa_action` branch. M2 (`5fd60ff1`) added the **read** arms to
`app.can_read_document` only; the **write** counterpart was never built.

**Repro (empirical, direct RPC call — bypasses the still-stubbed TS layer entirely, service-role
`apikey` + a real persona JWT):**
```
POST /rest/v1/rpc/begin_document_upload
{ p_resource_type: 'rca', p_resource_id: 'f3000000-0000-0000-0000-0000000000a3',
  p_title: 'probe', p_declared_file_name: 'probe.pdf', p_declared_mime: 'application/pdf',
  p_declared_size: 128 }
```
→ `500 {"code":"P0002","message":"recurso não encontrado"}` for **every** persona tried:
`chefe.ccih@test.local` (RCA lead, non-observer team member), `admin@test.local` (platform admin
acting `pqs_member`), and `pqs.a@test.local` (PQS member) — including on `capa_action` with the
seeded `caa00000-0000-0000-0000-0000000000a1`. **Absence ≡ denial by design elsewhere in this
codebase, but here it is NOT a deliberate refusal** — `securable_resources` genuinely has both rows
(catalog-verified: `resource_type='rca'` at the RCA_ID, `resource_type='capa_action'` at the seeded
action id, both fully tenanted), so `begin_document_upload`'s earlier "resource not found" branch does
not fire; the P0002 comes specifically from the `can_write_document` authority check, confirmed by
elimination (every other precondition in the function body holds for these fixtures).

**Fails closed — an availability defect, not a leak** (same shape as the original BUG-DM5-CAPA-1): a
user who genuinely can write the RCA/CAPA (`app.can_write_rca`/`can_write_capa`) still cannot begin an
upload, because the two authority functions were never connected for these two new home types.

**Blocks:** upload for RCA + CAPA evidence at the SQL layer, in addition to and independent of
BUG-DM5-S2-STUB-1. Fixing the TS stubs alone (BUG-DM5-S2-STUB-1) is **not sufficient** — this must
also land, most likely as a small migration adding `when 'rca' then app.can_write_rca(v_resource,
p_uid)` / `when 'capa_action' then app.can_write_capa(v_resource, p_uid)` arms (names inferred from
the existing read-arm pattern in `can_read_document`; verify the actual write-authority function names
against the catalog, not this line).

### 🟢 BUG-DM5-S2-CITATION-TARGETS-1 — ✅ **FIXED 2026-08-14** (`e307a979`) — the RCA citation picker never offered a DOCUMENT target — `listRcaCitationTargets` was never updated when the seam was un-parked (owner: `backend`)

> ✅ **Verified by `tester` by reading the landed function** (source, not the commit message):
> `listRcaCitationTargets` now queries `documents` scoped to the event's case
> (`securable_resources.resource_type = 'case'`, `status = 'active'`), RLS-bounded rather than
> hand-filtered — a real, offerable document candidate as of this fix. **Still not UI-tested**, for a
> reason now confirmed to be entirely orthogonal to this bug: the fix is scoped by the event's
> `case_id`, and the ONLY seeded RCA's event (EV-0003) has `case_id = NULL` — of the five seeded
> events only EV-0001 carries one, and no RCA is seeded against it. No RPC exists to backfill an
> event's `case_id`. This is a pre-existing fixture gap, not a residual defect; see the citation-scope
> comment in `e2e/dm5-nsp-evidence.spec.ts`.

Filed 2026-08-14 (`tester`). Severity: **MAJOR** — narrower than the two bugs above (citation is one of
three evidence kinds, and link/interview/meeting citation are unaffected), but it directly blocks one
of this gate step's four named acceptance items: *"the RCA citation form's new document target
functions."* Independent of BUG-DM5-S2-STUB-1 — will reproduce even after that one is fixed.

**Mechanism:** `src/lib/queries/rca.ts:459-465`, inside `listRcaCitationTargets`, still reads:
```
// PARKED (DM1, ADR 0114 D5): document citation candidates came from the
// dropped attachments substrate, and add_rca_evidence now refuses a document
// citation (HC0DM) until Wave D re-points cited_document_id at the document
// model. No document targets are offered meanwhile …
```
— followed by `return targets` with **no query against `documents` at all**. This comment is now
**stale** (`a-comment-is-an-assertion-that-goes-stale-silently`): DM5 M4 (`e07e72fc`) already dropped
the `HC0DM` refusal and the `rca_evidence_cited_document_parked` CHECK, and `add_rca_evidence`'s
signature already accepts `p_document_id` for a citation row (catalog-verified,
`add_rca_evidence(p_rca_id, p_kind, p_title, p_document_id, p_external_url, p_citation_target,
p_cited_entity_id, p_citation_label)`). The SQL-side seam is un-parked; the TS read that populates the
UI picker (`EvidenceCitationForm`'s `targets` prop, sourced from `page.tsx`'s
`listRcaCitationTargets(rca.eventId)`, no other merge point) was never told.

**Effect:** `RcaEvidencePanel` only renders the "Citar registro" button when `citationTargets.length >
0` (currently true only via seeded interviews/meetings), and even when it renders, the `<select>` it
builds from `targets` can **never** contain a `kind: 'document'` option — there is no code path that
would ever push one. A user cannot cite a document through the UI no matter how the RPC/table permit
it underneath.

**Fix:** `listRcaCitationTargets` needs a third query (documents homed on the event's case, or
whichever scope ADR 0120/the citation contract intends) pushing `{ kind: 'document', id, label, date }`
entries onto `targets`, mirroring the existing interview/meeting blocks.

### 🟢 BUG-DM5-CAPA-1 — ✅ **FIXED 2026-08-14** (`e938f36d`, DM5 S2 `…000140`) — CAPA evidence UPLOAD was broken for every user since it shipped (owner: `backend`)

> ✅ **Fix:** both policies in the CAPA pair now read path segment 1 as a **CAPA id** (they disagreed:
> SELECT read it correctly, INSERT resolved it through an **event** resolver), gated on the existing
> `app.can_write_capa`. Verified: capa-shaped insert **ACCEPTED** (was 42501) · rca-shaped **still
> ACCEPTED** (RCA pair untouched) · **NEGATIVE** `staff1.farm` with no CAPA authority **REFUSED 42501**.
> ⭐ **The negative arm is what makes it a fix rather than a widening** — without it, *"the insert now
> works"* is equally consistent with having opened the bucket ([[no-regression-claim-needs-overgrant-twin]]).
> Post-condition asserts the other three `nsp-evidence` policies survive and no UPDATE/DELETE policy
> appeared (Rule 6).
> ⚠ **Deliberate non-symmetry:** the fix mirrors the RCA pair's **shape** (read predicate on SELECT,
> write on INSERT) but **NOT its segments** — the path conventions genuinely differ
> (`{event}/{rca}/…` vs `{capa}/{action}/…`) and flattening them would have broken the RCA pair. That
> was the trap step 0 flagged in this exact bucket.
> ⭐ **Re-measured at HEAD before fixing, and it was not a formality.** `…000100` had altered CAPA
> tenancy underneath this policy, so *"the red has moved"* was live. It **still reproduced** — because
> the broken predicate calls `app.hospital_of_event`, **not** the `app.hospital_of_capa_action` that
> D16 corrected. A near-miss that reads as *obviously unaffected* in hindsight and was only knowable
> by measuring ([[a-rename-orphans-a-name-keyed-verdict]]).
> **Still owed by `tester`:** the upload-kind E2E the suite has NEVER had — its absence is exactly why
> this survived from ship to now — plus the keyboard-only path. ⚠ pgTAP `143` asserts these policies
> **exist**, never that they **admit**; *a policy-existence assertion is not a policy test.*

<details><summary>Original filing (retained — the diagnosis and universality proof)</summary>

Filed 2026-08-14 (DM5 S2 planning). Found by `backend`, **independently re-verified by the lead**
against the live catalog — not accepted from the report.

**The defect.** `capa_evidence_obj_insert_writable` gates on
`app.is_pqs_writer_of(app.hospital_of_event((storage.foldername(name))[1]::uuid))` — it resolves the
path's **first segment through an EVENT resolver**. But that segment is a **CAPA id**: the SELECT
policy on the *same bucket* reads it as `app.can_read_capa((storage.foldername(name))[1]::uuid, …)`,
and `uploadCapaEvidenceFile` (`src/lib/safety/capa-actions.ts:308`) writes
`{capa_id}/{action_id}/{uuid}.ext`. **Two policies on one bucket disagree about what segment 1 is.**

**Universality proven, not inferred** — `app.hospital_of_event(<a real capa_plan id>)` → **NULL**,
`app.is_pqs_writer_of(null)` → **`f`**, and
`select count(*) from capa_plan c join patient_safety_event e on e.id=c.id` → **0**, so no CAPA id
can ever collide with an event id. The predicate is `false` for **every** possible upload path.
Differential measured in a rolled-back txn as `nspcoord.a`: rca-shaped path **ACCEPTED**, capa-shaped
path **REFUSED (42501)**, same session.

⚠ **Fails CLOSED — an availability defect, not a leak.** A user who can *read* CAPA evidence
(`can_read_capa` → true) cannot upload it.

**Why every gate missed it, and this is the transferable part:** E2E covers only the **`link`** kind
(`e2e/phase14d-capa.spec.ts:267-273`, `p_external_url`) and never the upload kind; pgTAP `143:266-285`
asserts the policies **exist**, never that they **admit** anything. *A policy-existence assertion is
not a policy test* — the same class as [[a-detector-that-finds-nothing-must-be-proven-able-to-find-something]].
⭐ **Backend's first probe reported the control failing too** — it wore `active_role='staff'`, so the
`nsp_coordinator` membership was not worn and `can_write_rca` was false **for the wrong reason**. The
control is what caught it; a bare subject-only probe would have filed a much wider, wrong bug.

</details>

### 🟠 BUG-DM4-DUP-1 — the reply-attachment list renders the just-uploaded file TWICE (owner: `frontend`)

Filed 2026-08-14 (DM4 gate step 2). Surfaced as a **strict-mode violation, not a timeout** —
`DM4-RT-1`'s row locator resolved to **2 elements** with identical title and size. Mechanism traced
from source by `tester` and **independently verified by the lead**; it is a defect, not a locator fault:

- `src/components/referrals/referral-reply-attachments.tsx:135` builds its row list as a **plain
  concatenation with no dedup**: `[...initialDocuments.map(d => ({key: d.documentId, …})), ...uploaded]`.
- `:181` appends the optimistic entry with `key: finalized.documentId` — **the same id** as the
  server row it just created.
- `src/lib/referrals/actions.ts:521` → `revalidateReferrals()` → `:80`
  `revalidatePath(REFERRAL_DETAIL_PATH, 'page')` on **every** successful finalize.
- `revalidatePath` on a mounted route makes Next refetch the RSC payload; `page.tsx` re-runs
  `listReferralReplyDocuments`, which now **includes** the new attachment, and passes it down as
  `initialDocuments`. The dialog does not unmount, so `uploaded` still holds its copy ⇒ **two `<li>`,
  same React key** (React also logs a duplicate-key warning and renders both anyway).

⚠ **Timing-sensitive, not conditional** — it depends on whether the refetch resolves before the
assertion, which is exactly why it can differ between dev and prod-standalone. **The bug exists
regardless of whether a given run reproduces it**; non-reproduction only means the race was lost.
⛔ **Do NOT fix this by relaxing the locator** — `tester` correctly refused to. Fix is id-based dedup
(merge by `documentId`, e.g. a `Map` with `uploaded` winning ties).

ℹ️ **DM3 Wave B gate step 2 filed NO bug** (tester, 2026-08-13) — stated explicitly because a silent
absence and a clean result look identical. All 9 baseline reds were **tester-owned**: 7 stale locators
(the DM3 substrate/affordance move) and 2 worker interference. See the Test Run Summary row for the
per-red triage and for the two non-regression observations (`open_document_version` refusals surface as
**HTTP 500, not 404** — pre-existing DM2 transport behaviour; and **AC-13's Tab budget is coupled to
register row count**, so a green AC-13 is only meaningful on a fresh reset).


## Rotated from PROGRESS.md 2026-08-14 (the size rotation) — the live Bug Log's two CLOSED blocks

> ⚠ The five bug records themselves were **already archived above** (§ *Archived 2026-08-14 (DM5 resume
> audit)*, BUG-DM5-S2-STUB-1 / -WRITE-ARM-1 / -CITATION-TARGETS-1 / BUG-DM5-CAPA-1 / BUG-DM4-DUP-1) —
> what follows is the live file's summary + pointer prose, kept because it carries the "read this before
> touching X" navigation hooks. The live Bug Log now holds **OPEN bugs only**, per lead-playbook §5.

### Closed this phase → [bug-log-archive.md](./bug-log-archive.md) (rotated 2026-08-14)

All five carried full repro + mechanism; the durable lessons also live in the phase records.

- 🟢 **BUG-DM5-S2-STUB-1** — 11 TS bodies still `throw 'not implemented'`; the entire RCA/CAPA
  workspace 500'd for every persona. Fixed `cbcabe7a`.
- 🟢 **BUG-DM5-S2-WRITE-ARM-1** — `app.can_write_document` had no `rca`/`capa_action` arm, so
  `begin_document_upload` refused **everyone** with `P0002`. Fixed `fc7a146d` (`…000160`).
  ⚠ Its first probe is **not** valid fix evidence — it ran while the gate was neutralized.
- 🟢 **BUG-DM5-S2-CITATION-TARGETS-1** — the picker could never offer a document target. `e307a979`.
- 🟢 **BUG-DM5-CAPA-1** — CAPA evidence upload had been broken for every user since it shipped.
  Fixed `e938f36d` (`…000140`, kept as its own migration so the red was provable pre-fix).
- 🟢 **BUG-DM4-DUP-1** — the reply-attachment list rendered the file twice. Fixed `5ac8d849`,
  pinned `f8052575` (5/6 proven RED first). ⚠ **It was still marked 🟠 OPEN here until
  2026-08-14** — *a fix commit is not a status edit.*

✅ **BUG-DM2-001 / -002 / -003** (DM2·S4, all FIXED 2026-08-13) and **BUG-CASEKIND-001**
(pre-existing, FIXED 2026-08-12) — rotated with their full "as filed" bodies →
[bug-log-archive.md](./bug-log-archive.md).

_(⚠ A truncated first line of **BUG-DM5-S3-INACTIVE-PRINT-1** was copied here by an over-wide line
range during the 2026-08-14 rotation and removed immediately. That bug is **OPEN and lives in
PROGRESS.md** — nothing about it is archived here.)_

### Closed → [bug-log-archive.md](./bug-log-archive.md)

All closed rows (incl. the one-line table, the 2026-08-03 batch’s method notes, and the
earlier-era pointers) rotated 2026-08-06; each bug’s full entry — repro, fix, lessons — is in
the archive. ⚠ Before touching `buildAnswerMaps`, read BUG-FF4-001 there (the obvious one-line
fix breaks Rule 3 SQL↔TS evaluator parity).

**Rotated 2026-08-12 (the FUP batch):** **BUG-MIN-E2E-1** — closed as **NOT a product defect**: a
stale per-worktree `.env.local` `MINUTES_SERVICE_URL` (`:8000` vs the spec stub's `127.0.0.1:8891`),
left over from the `FUP-MIN-CUTOVER` T5 smoke flip. ⚠ Read it before diagnosing any minutes E2E
failure — the durable fix is the mutation-proven `beforeAll` precondition guard, not the value. ·
**BUG-RDR-001** — fixed at the shared layer for **both** dialog primitives
(`dialog-focus-restore.tsx`). ⚠ Read it before touching Radix dialog focus: it records that
`onCloseAutoFocus`'s `preventDefault()` **also cancels `FocusScope`'s own restore**, so the two
halves must be replaced together — and it carries the honest per-call-site count (1 measured, 3
structural, 1 tester-measured, **1 that was never broken**), which is not six.

**Rotated 2026-08-12:** **BUG-ETHE4-FOCUS-1** (ETH·E4, fixed `8e5ebcd`) → the archive's closing
section. ⚠ Before touching `TypeaheadField` or any Radix dialog focus behaviour, read it there:
it carries the only written record of the `@radix-ui/react-focus-scope` `handleMutations`
mechanism behind the 3-element tab loop, and of why a bubble-phase `stopPropagation()` cannot
beat `DismissableLayer`'s capture-phase Escape. Its untested residual is live as **FUP-ETH-KBD-1**.

**Also 2026-08-12:** the **BUG-VACUOUS-ASSERT-1 · BUG-ACT-EXPIRY-1 · BUG-ACT-ACL-1** summary block
— a residual duplicate; the record itself was rotated at closure 2026-08-10 and every claim in the
summary was verified present in the archive before deletion. ⚠ **BUG-ACT-ACL-1 closed one instance,
not the population** — that population is now swept: **AUDIT-INVOKER-WRAPPER closed 2026-08-12**
(ARM 5; *Completed work* above → [authz-invoker-wrapper.md](./authz-invoker-wrapper.md)),
and `FROMFINDINGS=1 ARM=wrapper` is a standing §6 step-1 gate over it.

**Also 2026-08-12:** **FUP-VACUOUS-AUDIT-1** (closed 2026-08-10) → closing line in
[follow-ups-archive.md](./follow-ups-archive.md); its full record was already
[docs/reviews/vacuous-assertion-audit.md](../reviews/vacuous-assertion-audit.md) and the live
block duplicated it. ⚠ Its output, `lint:vacuous`, is a **standing member of `npm run lint`** —
see CLAUDE.md §8. **FUP-VACUOUS-COVERAGE-1 stays OPEN above**: REM-8/REM-9 are honest
`test.skip()`s, outside the vacuity property, so this gate will never catch them.

## Rotated 2026-08-18 (DM5 Record follow-through) — BUG-DM5-S6-EVID-KBD-1, CLOSED at rotation

> Rotated **verbatim** from PROGRESS.md § Bug Log on **2026-08-18**. Filed and fixed the same day —
> **2026-08-17**, DM5·S6 gate step 2 — and verified by the DECLARING-GREEN `e2e:prod` run
> (1121 passed · 0 failed · 2 flaky · 0 did-not-run; batch 4 = **64/0**, was 63/1). It sat under
> PROGRESS.md's **🔴 OPEN** heading marked ⬛ for a day: *a fix commit is not a status edit* — the
> same lesson **BUG-DM4-DUP-1** carries, and the reason that section's own note says to derive a
> rotation boundary **by the PROPERTY (is this CLOSED?), never by markup**.
>
> One link repointed for this file's depth (`src/app/…` → `../../src/app/…`); nothing else changed.
>
> ⚠ **The body below is AS FILED, and its tail contradicts its own header on purpose.** It still
> reads *"S6 gate step 2 is RED until this is resolved"* and cites the test at **`:347`** — both
> true when written. The fix moved the test to **`:388`** and the gate went **GREEN**. Do not read
> the filing's status lines as current: the ✅ header and this note are the status.
>
> **Fix commit `15396276`** (*"EVID-KBD-1 raced its own readiness check — gate step 2 GREEN"*);
> RED-first pin `348acf5f`. Live successor in PROGRESS.md: **`FUP-E2E-REPEAT-FLAKY`**, which keeps
> the two remaining members and the ⭐ **unverified** lead that `phase2-auth-shell:268` may share
> this root cause.

**⬛ BUG-DM5-S6-EVID-KBD-1 — ✅ FIXED + VERIFIED GREEN 2026-08-17** (filed and closed the same day,
S6 gate step 2; `tester`) — *it was never a flake; the readiness helper was lying one layer above the test*

> **Root cause — a readiness check that could not distinguish the skeleton from the page.**
> `expectRcaWorkspaceRendered` / `expectCapaWorkspaceRendered` (local to the spec) treated
> `getByRole('main')` as proof the workspace had rendered. But `<main>` is rendered by the
> **ancestor layout** ([`nsp/layout.tsx:108`](../../src/app/o/[org]/nsp/layout.tsx)), which **persists
> across the `loading.tsx` → `page.tsx` Suspense swap** — so it is already visible while the route
> still shows bare `<Skeleton>` placeholders with almost nothing focusable. `focusByTabbing` has
> **no auto-retry** (it is a fixed count of blind Tab presses), so it began counting against a
> skeleton and exhausted its budget. Every *other* caller in the file is mouse-driven and was
> immune, because `.click()` auto-retries until its target is actionable — which is why exactly one
> keyboard-only test was ever hit.
> ⭐ **This explains all four measurements**: the race is lost only when the data fetch is still
> pending, so it is load-dependent, not random — green alone, green paired, red once four more files
> shared the run. The spec's own comment already warned *"never `.focus()` — races RSC streaming"*;
> the identical race sat one layer up, inside the check that decides when it is safe to start.
> → [[playwright-focus-is-not-auto-waiting]]
>
> **Fix** (`e2e/dm5-nsp-evidence.spec.ts` only — `e2e/helpers/documents.ts` has **zero** net diff):
> both helpers now also wait for the evidence panel's own heading — a signal the skeleton cannot
> produce — raced via `.or()` against the existing error boundary so a genuine stub regression still
> fails fast with its specific message instead of a generic timeout.
> ⛔ **It strengthens a PRECONDITION; it does not weaken an assertion.** `focusByTabbing`, the tab
> budget, and the keyboard-reachability contract are untouched. **Measured before changing anything:
> real tab counts were 34 / 1 / 2 / 36 against a budget of 60** — so "the budget was too tight" was
> *excluded by measurement*, not assumed, and the budget was deliberately not raised. The CAPA twin
> got the same fix: identical mechanism, no keyboard test yet to expose it, and leaving it is a
> landmine for whoever writes one.
>
> **Verified — lead-run, not accepted from the report.** Diff inspected (one file); the three
> structural claims re-checked independently (`<main>` is in the layout; both `loading.tsx`
> boundaries exist; the skeleton renders **no** `<main>` of its own); the **five-gate** `npm run
> lint` run — the tester had only run `npx eslint` + `tsc`, and *that exact gap has produced a false
> green in this project before*. Then the full `e2e:prod`: **GATE GREEN**, batch 4 **64 passed / 0
> failed** (was 63/1), `ok 13 … dm5-nsp-evidence.spec.ts:388:5 › EVID-KBD-1`.
> ⚠ **The test moved `:347` → `:388`** (the fix added helper lines above it), so a line-keyed grep
> for `:347` returns nothing — which reads exactly like *"the test did not run."*
>
> **`FUP-E2E-REPEAT-FLAKY`: EVID-KBD-1 is REMOVED** — it has an identified, fixed root cause, not an
> unexplained flake. The other two members remain, and this run's 2 flaky are exactly those two
> (`act-role-assumption:157`, `phase2-auth-shell:268`), so EVID-KBD-1 did not merely degrade from
> failed to flaky. ⭐ **New lead, explicitly unverified:** `phase2-auth-shell.spec.ts` calls a bare
> `.focus()` shortly after a navigation — the same anti-pattern, and `:268` is one of the two
> survivors. Possibly the same root cause; **not investigated, offered as a lead, not a finding.**

- **Spec:** `e2e/dm5-nsp-evidence.spec.ts:347` — *"EVID-KBD-1: keyboard-only — Tab to «Enviar
  arquivo», fill the dialog by keyboard, submit with Enter, and Tab+Enter to open the result"*.
  Failure: `keyboard: target element was never focused within the tab budget`
  (`focusByTabbing`, spec `:293`), then the follow-on `toBeVisible` at `:409`.
- **The S6 gate run went RED on this one test:** 1120 passed · **1 failed** · 2 flaky · 6 skipped ·
  **0 did-not-run** · 18 batches. It failed **through** its retry (`RETRIES=1`).
- ⭐ **Why the existing label must not be reused.** `EVID-KBD-1` is a recorded member of
  `FUP-E2E-REPEAT-FLAKY`, added at S3's gate and flaky again at S4's — **both times it passed on
  retry.** It no longer does. *A test that used to be rescued by a retry and now is not has changed
  behaviour, and "known flaky" would file that change as nothing.*
- **Measured, 4 runs, `RETRIES=0` throughout — it is composition-dependent, not random:**

  | run | specs | tests | result |
  |---|---|---|---|
  | alone | `dm5-nsp-evidence` | 8 | ✅ 8 passed |
  | pair | `dm4-referral-documents` + `dm5-nsp-evidence` | 18 | ✅ 18 passed |
  | **batch-4 composition** | the gate's actual 6 | 65 | ⛔ **63 passed, 1 failed** |
  | **batch-4 composition, again** | same 6 | 65 | ⛔ **63 passed, 1 failed** |

- **Not an S6 regression, and that is measured, not assumed:** the last green run and this red one
  are separated by **0 `src/` files and 0 migrations** (S6 and the QA commit are both docs-only).
  Something in *batch composition*, not in the product, moved it over the line.
- **Leads for whoever takes it** (none verified — offered as starting points, not conclusions):
  `playwright.config.ts` sets **`fullyParallel: true`**, so scheduling is not strictly file-bound;
  and the preceding spec's `DM4-TTL-1` **sleeps ~2.1 min by design** (it proves byte doors survive a
  delay that would expire a render-time credential), which is the kind of thing a tab budget or a
  cached session can be sensitive to. Shape matches the standing
  [[playwright-focus-is-not-auto-waiting]] class — *reads like a11y, is timing.*
- ⛔ **S6 gate step 2 is RED until this is resolved.** Do not re-declare green on the isolated
  8/8 pass: it does not reproduce the failing condition.

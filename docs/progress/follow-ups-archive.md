# Archive — Follow-ups / Deferred Items (full snapshot incl. resolved)

> Archived verbatim from PROGRESS.md on 2026-06-25 at the §7 progress-tracker cleanup.
> This is the durable detail; PROGRESS.md keeps only a one-line pointer.

> PROGRESS.md keeps only the OPEN items going forward. Resolved [x] items are preserved here.

## Follow-ups / Deferred Items

- [ ] (minor QA findings, nice-to-haves, tech debt — reviewed at each phase start)
- [ ] **NSP-per-org — the phase that lifts the multi-org PHI guard (ADR 0041 amendment 13).** The NSP/patient-safety and inter-committee **referral** modules are currently **inert in any multi-org deployment** because their single global `pqs_members`/QPS roster can't safely span orgs (the `app.is_pqs_member` chokepoint returns false when `is_multi_org()`; modules absent in the 2-org seed; 124 E2E specs quarantined as `MULTI_ORG_PILOT_SKIP`). Restoring them under multi-tenancy needs a **per-org PQS roster** + org-bound event/referral PHI scope (org-scope the roster term, the DEFINER doors, and the audit). Its own gated phase. Until it ships, the guard is the safe interim posture. Tracked in PHASES.md (Structural / platform phases) + ADR 0041.
- [ ] **Multi-tenancy — org_admin TS-gate gap in the invoker `authorize*` helpers (QA INFO / lead #15, non-blocking).** ~8 invoker-context `authorize*` server-action helpers gate on `is_staff_admin_of` / `isAdmin` but do **not** yet grant the org_admin → coordinator branch that `getCommissionAccessByOrg` grants on the read path. RLS is the security backstop (these are invoker-context, not service-role, so the worst case is an org_admin being *denied* a write they should be allowed, not an escalation), but the gates should be aligned with the read path for consistency. Enumerate + add the `is_org_admin_of_commission` term.
- [x] **✅ RESOLVED 2026-06-23 — remote `patient_index` re-enabled (verified `enabled=true` via `db query --linked`).** Cause: a tester `supabase db reset --linked` during the FBE fix loop reset+reseeded REMOTE and reverted the **out-of-band** `patient_index` flag (manually enabled ON per Phase-23, never a committed migration) to its committed default OFF. Remote data fine (reseeded; test/seed-only, no real PHI; always-on triggers re-key the seed → `patient_xref` repopulated). Fixed with `supabase db query --linked "update app.feature_flags set enabled=true where key='patient_index';"`. Other remote flags verified correct 2026-06-23 (case_referrals OFF by design; all else ON via committed enable-migrations). **Process fix:** gate E2E runs must use **local** `supabase db reset` (NOT `--linked`) — see memory `e2e-gate-run-mechanics`.
- [ ] **Pre-existing full-serial-suite contamination (NOT a form-builder regression).** A single full serial run is RED on `main` itself (~17–19 failures; branch ≤ baseline, 0 net new — proven by failing-title diff). Cross-spec seed-mutation in lexical run order (phase10–14/22 before phase2–8). Separate spec-isolation effort (phase13-saga class); the team's green path is chunked runs with a fresh reset per chunk. Tracked, does not gate any single feature.
- [ ] **Harden `e2e/form-builder-enhancements.spec.ts` to a throwaway commission (QA INFO-4, nice-to-have).** It builds fixtures in the seeded CCIH commission (`COMM_A`/`/c/ccih`) rather than a probe commission/users (cf. P13-005/006 lessons). Acceptable now (branch added 0 net contamination); harden (use `makeProbeCommission`/`makeProbeUser`) if it joins the full gate matrix.
- [ ] **`dispose_referral_phi` — LGPD-erasure parity for the referral PHI module (backend; surfaced 2026-06-22 building `case_patient`; ADR 0038 Consequences).** The referral module (Phase 22, ADR 0037) ships `referral_patient` + PHI free-text but, unlike NSP (`dispose_event_phi`) and Cases (`dispose_case_phi`), has **no** LGPD Art. 18 erasure RPC. Add `dispose_referral_phi(referral, reason)` modeled on `dispose_event_phi`/`dispose_case_phi`: delete `referral_patient`, redact `description_md`/`decline_note`/`frozen_body_md`/`result_md`, preserve skeleton + audit chain, one-shot, constrained reason enum, `phi_disposed_*` on `case_referral`, emit `referral_patient.disposed`, source/target-coord-or-admin gate, + pgTAP. (Spawn chip `task_e51cc87d` was filed; chips don't persist across restarts — THIS is the durable record.)
- [ ] **`case_patient` disposal UI — "Descartar dados do paciente" (frontend, not blocking; mirrors the NSP WS C item below).** `dispose_case_phi` + the `disposeCasePhi(caseId, reason)` action are live; the UI is a coordinator/admin-gated button on the case detail opening a confirm dialog with a reason-category `<select>` bound to `PhiDisposeReason`/`CASE_PHI_DISPOSE_REASON_LABELS` (NO free-text — constrained category), reflecting `has_patient=false` + the `phi_disposed_*` stamp post-action. One-shot (HC056).
- [x] **CN-APP-AC4 — narrative-body save not re-rendering on the prod standalone build (PRE-EXISTING; surfaced 2026-06-22, NOT a `case_patient` regression). RESOLVED 2026-06-23.** Root cause was NOT a `revalidatePath` 'page'-vs-'layout' quirk to chase server-side — `CaseNarrativeCard` rendered the body from the `narrative.bodyMd` prop and depended on `router.refresh()` re-rendering the Server Component, which lags on the standalone build. Fixed client-side in `src/components/cases/case-narrative-card.tsx` with an optimistic `savedBody` override (renders the just-saved Markdown immediately, reconciles back to the prop when it lands). Verified RED→GREEN on `node .next/standalone` (case-narratives 11/11). See Bug Log CN-APP-AC4. **Open sub-item for a future cycle (low priority, not a registered bug):** the at-risk pattern is specifically a component that, after a save, COLLAPSES from its editor to a `MarkdownRenderer content={prop.xMd}` view and relies on `router.refresh()` to land the new prop. Triaged 2026-06-23: `narrative-editor.tsx` (the dedicated narrative route) is **SAFE** — a writer always stays on the local `value`; its prop-render branch is read-only (no save). Editors that render `content={value}` (local state) — `rca/problem-stage`, `meeting-minutes-editor`, `interview-summary-editor` — are also likely safe. The real candidates to verify are the collapse-to-prop panels: `safety/capa/capa-effectiveness-panel` (`effectiveness.methodMd`) and `safety/capa/capa-closure-panel` (`plan.lessonsLearnedMd`). If confirmed, apply the same optimistic-`savedBody` fix used in `case-narrative-card.tsx`.
- [ ] **WS A FE — PQS-membership management UI (frontend, not blocking).** `pqs_members` is admin-managed via `add/remove/list_pqs_members` RPCs + a seeded admin (functional/testable now). A roster-management screen under `/admin` (enroll/remove PQS staff, list members) is a frontend task; in prod the first admin enrolls staff via `add_pqs_member`. Mirror the `assignStaffAdmin` admin-action pattern (`requireAdmin` + admin client) for the server actions.
- [ ] **WS A FE — `/admin/nsp` gating + patient-panel affordance (frontend/tester, surfaced by WS A trace 2026-06-20).** (a) `/admin/nsp/[eventId]/page.tsx` gates ONLY on `context.isAdmin`. Post-WS-A a **non-PQS admin** degrades to `notFound()` (clean pt-BR 404 — `getSafetyEvent`'s `patient_safety_event` SELECT is now `can_read_event`, which denies a non-PQS/non-custodian admin → null → 404), NOT a crash/broken-empty page. Ideal: gate the NSP routes on `is_pqs_member` (e.g. via `patient_safety_enabled()` + a PQS check / a new `public.is_pqs_member()` read) for a tailored "não autorizado" instead of a generic 404. (b) The patient panel renders on `event.hasPatient` ALONE; entitlement is enforced at the data layer (the `get_event_patient` RPC returns null for an unentitled caller → `<PatientPanelEmpty>`), so **no PHI leaks**, but the affordance ideally gates on `hasPatient` AND entitlement to avoid showing an empty panel to an entitled-event-but-unentitled-PHI viewer. **No reporter-facing route renders the panel** (verified: `/c/[slug]/eventos` is governance-only, PHI-free; the panel is admin-route-exclusive) — so a reporter, incl. after custody handoff, never reaches it. Flagged per coordinator; NOT fixed in WS A.
- [x] **WS A — RCA WRITE policies standalone `OR app.is_admin()` — RESOLVED in Round 3 (2026-06-20).** Lead ruled SEVER. Stripped the `OR app.is_admin()` from the 7 `rca_*_write` policies; RCA writes now follow `can_write_rca` (PQS member OR assigned non-observer). `can_write_rca` needed no change (no `is_admin` term). Confirmed these were the last standalone-`is_admin` NSP write surfaces. pgTAP `145` proves the severance. (CAPA writes were already PQS-only via `is_pqs_writer`.)
- [ ] **WS E / M2 — per-vocabulary reorder/archive RPC consolidation DEFERRED (backend, 2026-06-20).** The reorder/archive RPCs for `case_tags`/`case_outcomes`/`case_narrative_types` (commission-scoped, `assert_*_enabled`+`is_staff_admin_of`) vs `pqs_event_types`/`pqs_sentinel_criteria` (GLOBAL, `assert_patient_safety_enabled`+`is_pqs_member`, two-step negative-offset against a deferrable position unique) diverge by gate/flag/scope/collision-strategy/pt-BR message. A shared `app.reorder_vocab(table,…)` helper would need table-name-interpolated dynamic SQL (injection surface + allow-list) and couldn't encode the per-table divergence — less auditable than the current explicit static RPCs. Revisit only if the vocab set grows materially. No code change.
- [ ] **WS B — authoritative PHI-bearing free-text column list (for ARCHITECTURE.md Rule 11/12 + ADR alignment, lead-owned). FINAL count = 22 columns** (18 + the 4 borderline, lead ruled CLASSIFY 2026-06-20). Backend applied SQL column COMMENTs (`'PHI-BEARING free text (WS B; Rule 11/12)…'`) to: `patient_safety_event.description_md`, `event_triage.disposition_notes_md`, `rca.{what_md,expected_md,summary_md,impact,scope}`, `rca_factors.text`, `rca_root_causes.text`, `rca_timeline_entries.description`, `capa_plan.lessons_learned_md`, `capa_effectiveness.method_md`, `capa_action_task.description`, `capa_measure_result.note`, `meetings.minutes_md`, `case_interviews.summary_md`, `case_narratives.body_md`, `case_events.body` **(the original 18)** + **`meeting_agenda_items.{description,discussion_notes,resolution}` + `case_interview_subjects.note` (the +4 addendum** — all are multi-line textareas; agenda free-text already read-audited via `meeting.viewed` on `getMeetingDetail`/`listMeetingAgenda`, subject note via `interview.viewed` on `getInterviewDetail`/`listInterviewSubjects`; no new audit emit needed). **EXCLUDED** (governance metadata, PHI-free by the title invariant): all `*.title` + `case_interview_subjects.clinical_role`. Comment-only; `db diff` clean; types unchanged. Lead aligns ARCHITECTURE.md/ADRs from this 22-column list (backend left those docs untouched per instruction).
- [ ] **WS C FE — "Descartar dados do paciente" disposal UI (frontend, not blocking).** The `disposeEventPhi(eventId, reason)` server action + the `dispose_event_phi` RPC are live and E2E-testable; the UI is a frontend task: an admin/PQS-gated button on the NSP event detail (`/admin/nsp/[eventId]`) opening a confirm dialog with a **reason-category `<select>`** bound to `PhiDisposeReason` / `PHI_DISPOSE_REASON_LABELS` (NO free-text field — the reason is a constrained category), a destructive-action confirm, and post-action it should reflect `has_patient=false` (panel gone) + show the `phi_disposed_at/by/reason` stamp ("dados descartados em … por … — motivo: …"). Disposal is one-shot (HC056 → "PHI já descartada"). Owned by `frontend`.
- [ ] **WS B/C FE — discourage PHI in `*.title` / structured short fields (frontend, not blocking; surfaced 2026-06-20).** The minimum-necessary invariant assumes titles stay PHI-free (they ride on queue/list paths). Add helper text / a soft validation note ("Não inclua dados do paciente.") to the title inputs on event/RCA/CAPA/meeting/interview/case forms (mirrors the existing case-action-item dialog note). Soft guidance only — no hard block. Owned by `frontend`.
- [ ] **Migration squash — REMOTE rollout is a full reset, owner-run (Workstream 0, 2026-06-20).** The 12-file consolidated baseline (`20260620001000`–`012000`) replaces the entire 86-migration history; it was verified ONLY against local `supabase db reset` (db diff "no changes", pgTAP 619/619, types byte-identical, personas green). It is **forward-only and additive going forward**, but adopting it on the linked remote means the remote's `supabase_migrations.schema_migrations` ledger no longer matches — the remote must be reset to this baseline (`supabase db reset --linked` is destructive; the project is pre-live per the plan). **Auto-blocked for background agents** (remote pushes need the owner). The PHI-remediation Workstreams A–E (the actual security fixes) build ON this baseline and ship together; do the remote reset when that round lands, not before. Supersedes the per-increment `…092xxx`/`…093xxx`/`…110xxx` remote-push deferrals below (those migration files no longer exist — folded into the baseline).
- [ ] **Case Access — `case_interviews` still member-read (ADR 0033 D2 fast-follow; QA INFO-N1).** The restrictive boundary tightened cases + child tables to `can_read_case`, but `case_interviews` kept its existing `commission_of_interview` member-read to bound blast radius. Case-scope it to `can_read_case` to fully close the boundary. Backend-owned.
- [ ] **Case Access — `listCaseAccess(caseId)` read for the access panel (QA INFO-N3).** The coordinator panel grants/revokes off the member roster but can't display each member's live read/write grant level (no query returns the stored `case_access` rows). Add a coordinator-readable `listCaseAccess` + wire the panel. Small BE read + FE wire-up.
- [ ] **Case Access — push migrations `…110000–110004` (+ the in-place CA-001 edit to `…110002`) to the linked REMOTE** (`supabase db push --linked`) when taking the feature live. Verified ONLY against local `supabase db reset` (pgTAP 619/619, seed personas). **Auto-blocked as a production deploy — needs explicit human/lead go-ahead** (mirrors the Cases-Extras / case-model remote-push deferrals above).
- [ ] **E2E regression suite is NOT reliably green against a PROD build (test-harness debt, surfaced 2026-06-18; NOT a Phase-14 defect).** The freeze-proof gate now requires `next build`+`next start` (the heavy NSP pages crawl + balloon the `next dev` server to 4.3 GB — see user MEMORY `e2e-gate-prod-build`). But the pre-≤13 specs were authored against `next dev` and flake against the prod build: (a) Radix dialog close-animations (`data-[state=closed]:animate-out`) race tight `toBeHidden`/`toHaveCount` timeouts because — unlike the Phase-14 specs — the older specs DON'T set `reducedMotion: 'reduce'`; (b) the suite shares one mutable DB with no per-test reset, so Playwright `retries` (and parallel workers) CASCADE write-pollution: retries=2 produced MORE hard failures (25) than retries=0 (14). **Phase-14 specs are clean (65/65).** Evidence (2026-06-18, prod build, LOCAL Docker): full suite workers=1/retries=0 → 246 pass / 14 fail; non-14 specs workers=4/retries=2 → 162/13 flaky/20 fail; non-14 specs workers=1/retries=2 → 167/3 flaky/25 fail. Every failure is a pre-14 spec. **Fixes (test-infra; `tester` + `backend` for config):** add `use: { reducedMotion: 'reduce' }` to `playwright.config.ts` (one line, stabilizes animation timing globally); point `webServer.command` at a prod build for the gate; give the older mutation specs DB isolation (unique per-test fixtures or reset-per-file). Until then, the older specs' "green" depends on the `next dev` model.
- [ ] **E2E `case-narratives` AC-1b spec-isolation (tester-owned; surfaced 2026-06-19 during the case-access refinement triage).** AC-1b renames the "Resumo Clínico" narrative TYPE to "…(Renomeado) {timestamp}" and never restores it, so on the shared DB a re-run/later-ordered AC-1 (which asserts the original label) fails. NOT a code regression — pre-existing test debt, an instance of the no-per-test-DB-isolation problem in the item above. Fix: AC-1b restores the original label in a teardown/`finally` (or uses a throwaway type). Until then `case-narratives` AC-1 is order/state-dependent.
- [ ] **Phase 14a deferred (QA re-verify INFO):** sweep the success string out of `ActionState.error` for the 4 remaining safety actions (`transferEventCustody` / `updateEvent` / `setEventPatient` / `cancelEvent`) into the new `message` field — harmless today (all consumers gate on `!result.ok`), do it on the next `src/lib/safety/actions.ts` touch (e.g. Phase 14b). Backend-owned. The 2 flagged in QA N1/I2 (`notifySafetyEvent`/`acknowledgeEvent`) are already done.
- [ ] **Interviews — "Minhas entrevistas" discovery surface for plain-`staff` interviewers (Phase 11, deferred per lead).** v1 has NO dedicated list for a plain-`staff` registered interviewer to find interviews they may write — they reach the detail by DIRECT LINK only (the case-detail "Entrevistas" panel is coordinator-gated). The interview detail page renders correctly for them (membership guard + `viewerCanWrite` controls), and the detail header back-link points non-coordinators at the commission home (`/c/[slug]`), never the coordinator case page. A future "Minhas entrevistas" surface (mirroring "Minhas fases") would close the discovery gap. Owned by `frontend` when scheduled.
- [ ] **Case data-model — D12 status-file DELETIONS deferred to land WITH frontend §H (backend tasks #2/#3 handoff).** Deleting the configurable-status modules now would red-line ~12 not-yet-reworked frontend consumers (kanban drag, the "Estado" picker, the status manager, `case-derive`, the badges, the cases/detail/settings pages), which is the §H rework owned by `frontend` — so to hand over a GREEN `lint`+`typecheck` baseline without touching `src/components/**`/`src/app/**`, backend INTERIM-SHIMMED the two backend D12 lib modules instead of deleting them:
  - `src/lib/queries/case-statuses.ts` → now a deprecated module: re-exports `CaseStatusColorToken` from the new home and **`listCaseStatusDefs` synthesizes the 5 FIXED statuses** into the legacy `CaseStatusDef` shape (NO DB read), `caseStatusIsTerminal` delegates to the fixed helper. So the un-reworked board/table/badge/lifecycle render the CORRECT fixed statuses live during §H.
  - `src/lib/cases/status-actions.ts` → deprecated INERT no-ops (`setCaseStatus`/`create/update/reorder/archive_CaseStatus` return a pt-BR "estado é automático"); their RPCs are gone.
  - **TO DELETE during/after §H (frontend removes the importers, then backend removes the files):** `src/lib/queries/case-statuses.ts`, `src/lib/cases/status-actions.ts`, `src/components/cases/status-manager.tsx`, `src/components/cases/status-def-dialog.tsx`, `src/app/c/[slug]/manage/settings/statuses/page.tsx`. **KEEP** `src/components/cases/color-token-picker.tsx` (shared by tags/outcomes; its `CaseStatusColorToken` import should be re-pointed to `@/lib/cases/case-status` during §H). The new single source of truth is **`src/lib/cases/case-status.ts`** (`CaseStatus`/`CASE_STATUSES`/`CASE_STATUS_META`/`isTerminalCaseStatus`/`CaseStatusColorToken`).
  - **§H consumer rework owned by frontend** (plan §H): kanban → 5 fixed read-only columns (drop drag/`setCaseStatus`); table/view chips → fixed statuses + outcome/adverse filters; `case-lifecycle-actions` → drop the "Estado" picker, "Concluir" (outcome-capture dialog → `setCaseOutcome` then `closeCase`) + "Cancelar"; `case-derive` → import the fixed model; blocked-phase rendering ("Bloqueada por Fase N"); process outcome picker + case outcome selector + the `desfechos` settings manager + dashboard % adverse breakdown; `settings-tabs` drop "Estados" add "Desfechos". Backend posted the contracts (task #1) + impls (task #3): `case-outcomes.ts`, `outcomes-actions.ts`, `setTemplatePhaseBlocks`.
  - **✅ FRONTEND §H DONE 2026-06-14 (frontend, task #5).** All consumers reworked off the configurable-status modules onto `@/lib/cases/case-status`; the 3 frontend-owned D12 files DELETED (`status-manager.tsx`, `status-def-dialog.tsx`, `settings/statuses/page.tsx` + its now-empty route dir). **The 2 backend-owned shims (`src/lib/queries/case-statuses.ts`, `src/lib/cases/status-actions.ts`) are now ORPHANED — zero `src/app`/`src/components` importers remain (verified by grep; the only residual references are inside the two shim files themselves + the deprecated `CaseStatusKey` alias in `src/lib/queries/cases.ts`, all backend-owned). Backend can delete the 2 shims (and drop the `CaseStatusKey` alias) in lockstep.** Built: `case-status-badge.tsx` (fixed-key `CaseStatusBadgeFixed` + still owns `TOKEN_STYLES`/`TOKEN_COLOR_VAR`); `case-derive.ts` (`groupByFixedStatus`, `activePhases` for A5, `blockedBy` D4, `computeOutcomeBreakdown` D14, `computeCaseKpis(rows)` rebased on `isTerminalCaseStatus`); `cases-kanban.tsx` (5 fixed read-only link-columns, outcome chip + "N fases ativas"); `cases-table.tsx` (Desfecho column, fixed status badge/sort, A5); `cases-view.tsx` (fixed status chips + outcome `<select>` + "Apenas adversos" toggle, all client-side over board rows); `cases-kpi-strip.tsx` (outcome breakdown panel: per-outcome counts + % adverse); `case-lifecycle-actions.tsx` (Concluir dialog requires an outcome when offered → `setCaseOutcome` then `closeCase`; Cancelar confirm → `cancelCase`); NEW `case-outcome-selector.tsx` (non-terminal + D15-hidden when no offered outcomes; advisory markers); `coordinator-phase-actions.tsx` (blocked "Ativar e atribuir" disabled + "Bloqueada por Fase N" via `blockedBy`); NEW `outcome-manager.tsx` + `outcome-def-dialog.tsx` + `settings/desfechos/page.tsx` (mirror tag-manager; reorder via Flip; the requires-action-plan/is-adverse toggles); `settings-tabs.tsx` drops "Estados" adds "Desfechos"; settings index redirect → `desfechos`; NEW `phase-blocks-editor.tsx` + `process-outcomes-picker.tsx` wired into `phase-slot-dialog.tsx` / `template-builder-shell.tsx` (draft-only; blockers persisted via `setTemplatePhaseBlocks` chained off the slot save; offered outcomes via `setProcessOutcomes` + inline create); `phase-slot-card.tsx` shows "Bloqueada por: Fase N"; `layout.tsx` open-cases sidebar count → `isTerminalCaseStatus`; case-detail page off `case-statuses`. **Verified:** `npm run typecheck` + `npm run lint` + `npm run test` (24/24) + `next build` ALL GREEN; build route map confirms `/settings/desfechos` added and `/settings/statuses` gone. Client/server boundary sound — every `@/lib/queries/*` import in client components is `import type` (no `next/headers` leak). Local DB probe confirms `case_outcomes` table present + `case_status_defs` dropped (093000–093003 applied locally), so the running dev server HMR-compiled all changed pages without error (all 307 auth-redirects, no 500s). Live click-through of Radix dialogs/menus left to the tester (trusted events) — same env limitation noted in prior waves; could not start an own preview server (Next single-instance lock held by the tester's running :3000 dev server — did not disturb it). **NOTE for backend:** no missing envelope fields found — `Case.outcomeId`, `CasePhase.blocks`, `CaseDetail.outcome`/`offeredOutcomes`, board-row `outcome`, and all outcome/blocker actions matched the posted contracts exactly; built against them directly with no provisional shapes.
- [ ] **Case data-model — push migrations `…093000`–`…093003` (all 4) to the linked REMOTE** (`supabase db push --linked`) at the verification/tester stage. Backend verified ONLY against a local `supabase db reset` (4 migrations apply clean; functional probe confirmed the conclude gate HC031, terminal-first close, recompute → `pendente`; types regenerated; lint+typecheck+unit green). The defensive `update cases set status='nao_iniciado' where status not in (5 keys)` in `…093001` lets the additive CHECK apply cleanly on the drifted remote. **Auto-blocked as a production deploy — needs explicit human/lead go-ahead** (lead is coordinating the remote push at the tester wave). pgTAP for this batch is task #4 (tester-owned specs; backend owns the enabling migrations + seed enrichment).
- [x] **Cases-Extras QA MINOR-1 (frontend):** RESOLVED 2026-06-14 (frontend). Appended the standard PII note "Nunca inclua dados de paciente." to the action-item dialog's existing `DialogDescription` in `src/components/cases/case-action-item-form.tsx` (L81) — same string + same inline placement as `case-event-form.tsx`/`case-document-upload.tsx`; all three dialogs now carry it. No new dialog element/role/structure (appended to the existing description sentence), so it does NOT affect the AC-ActionItems spec — `e2e/cases-extras.spec.ts` L551–552 only targets the `Novo item` button + the dialog by its `DialogTitle` ("Novo item de ação"), neither changed; no tester re-run needed on its account. `npm run typecheck` + `npm run lint` clean; the edited module compiles in the running dev server (detail route 307, no compile error). Live dialog-open render left to the tester's Playwright (Radix portal needs trusted events; did not disrupt the tester's in-progress local gate server on :3000).
- [ ] **Cases-Extras — push migrations `…092000`–`…092006` (all 7) to the linked REMOTE** (`supabase db push --linked`). Backend verified ONLY against a local `supabase db reset` (191/191 pgTAP green, types regenerated); the remote drifts from local (user MEMORY) and the tester's remote runs need these. `db push` was auto-blocked as an unapproved production deploy — **needs explicit human/lead go-ahead** before the tester hits remote. (Lead is making the remote-vs-local test-gate call before the tester wave.)
- [x] **Cases-Extras — frontend lint:** both items RESOLVED 2026-06-14 (frontend). `case-document-upload.tsx` refactored to the parent-owns-`open` pattern (trigger owns the dialog `open`; the dialog's success effect calls only the `onOpenChange` PROP + `router.refresh()` — no local setState in an effect; the filename reset moved to a render-phase open-transition sync). `case-tags-panel.tsx` unused `useState` import removed. `npm run lint` clean.
- [x] **Cases-Extras TASK #6 + #7 — frontend UI (R1/R2/R3/R4)** — **DONE 2026-06-14** (frontend). Built the full Cases-Extras UI against backend's typed stubs (all R1/R3/R4 impls + flag flip now live locally). **R2 board rework (data-driven, no hard-coded status maps):** `case-status-badge.tsx` now owns the single `colorToken→class` map (`TOKEN_STYLES`) + `TOKEN_COLOR_VAR` + `resolveStatusDef`/`CaseStatusBadgeForKey` with a guaranteed `muted` fallback; `case-derive.ts` superseded `deriveStage`/`STAGE_*`/`CaseStage` with `groupByStatus(rows, defs)`, re-based `computeCaseKpis` onto `is_terminal`, kept the phase helpers, and **re-homes a client-safe `caseStatusIsTerminal`** (see BOUNDARY note below); `cases-kanban.tsx` = one column per non-archived def (def order) + drag-to-set-status (HTML5 DnD) + a keyboard-accessible "Mover para" menu (terminal cards frozen), card left-border tint from the def token; `cases-table.tsx` STATUS_RANK→def position; `cases-view.tsx` chips → Todos / Sem responsável / Em aberto / Encerrados (is_terminal); `cases-kpi-strip.tsx` generic labels + optional R4 "Itens de ação" card; detail page `isOpen = !caseStatusIsTerminal(defs,…)`; `case-lifecycle-actions.tsx` gains an "Estado" picker (non-terminal targets) + terminal "Encerrar" menu (concluido/cancelado keep the close/cancel wrappers, custom terminals → `setCaseStatus`). New **status manager** at `/c/[slug]/manage/settings/statuses` (create/rename/recolor/reorder via GSAP-Flip up-down/archive). **R1/R3/R4 panels below `CasePhaseList`:** `case-documents-panel` + `case-document-upload` (clones image-item-editor UX; signed-URL download; soft-delete), `case-events-timeline` (add/edit/delete free-text), `case-tags-panel` (assign/unassign chips) + **tag manager** at `/c/[slug]/manage/settings/etiquetas`, `case-action-items-panel` (create/edit/advance/complete/delete; cancel = `advanceActionItem(id,'cancelled')` per lead clarification; open/overdue surfaced). **Dashboard:** `tag-report-card` wired into `/c/[slug]/dashboard` honoring `?from/?to`. Sidebar gains a "Configurações" item (+ `manage/settings` redirect index); `layout.tsx` casos count fixed (`'aberto'` literal → `!caseStatusIsTerminal`). Shared: `case-extras-labels.ts`, `color-token-picker.tsx`, `confirm-delete-button.tsx`, `settings-tabs.tsx`. **Verified:** typecheck + lint clean, unit 24/24. Runtime-verified against LOCAL Docker (R1–R4 live, `cases_extras` ON): kanban renders the 5 seeded def columns in order with the seeded case in "Em andamento"; data-driven KPIs; detail page shows all 4 panels + the "Estado"/"Encerrar" header; status manager lists the 5 defs with Inicial/Final flags; tag manager + dashboard tag-report render a live inserted tag (count 1); action item + event render in their panels; all interactive controls carry pt-BR `aria-label`s. Could NOT drive Radix menus / Dialog opens via `preview_eval` (untrusted synthetic events — env limitation, same class as the screenshot timeout); the interactive drag/menu/dialog submit paths are left for the tester's Playwright (trusted events). Backend RPCs (`set_case_status`/`list_case_status_defs`/`create_action_item`/`case_tag_report`/`case_action_items_kpis`) confirmed present in the live DB. Test data cleaned up; `.env.local` restored to REMOTE.
  - **STUB-GAP note for lead (no `src/lib` edits made):** (1) the settings status/tag managers operate on the NON-archived set only — `listCaseStatusDefs`/`listCaseTags` return non-archived, and there is no `unarchive`/full-set read or `unarchiveCaseStatus`/`unarchiveCaseTag` action, so an archived status/tag disappears from the manager with no UI to restore it (coherent v1: "create a new one"). If un-archive is wanted, backend needs a full-set read + unarchive actions. (2) **BOUNDARY finding:** once backend implemented `case-statuses.ts` (`listCaseStatusDefs` now value-imports `@/lib/supabase/server` → `next/headers`), the module became server-only, so the pure helper `caseStatusIsTerminal` exported from it can no longer be value-imported by client components (it dragged `next/headers` into the client bundle → dev 500). I re-homed a client-safe twin in `src/components/cases/case-derive.ts` and pointed the client components (`cases-view`, `cases-kanban`) at it; server components (layout, detail page) still use the lib one. No `src/lib` change. If backend prefers the pure helpers to live in a `next/headers`-free lib module that both sides import, that's a clean future move.
- [x] **Cases-Extras R2 — pre-existing anon-EXECUTE leak closed (backend, task #1):** the 091000/091001 due-date migrations `CREATE OR REPLACE`d `add_template_phase`/`update_template_phase`/`activate_phase`/`reassign_phase` WITHOUT re-revoking the implicit PUBLIC grant, so those 4 public RPCs were anon-executable since (latent; pgTAP `100_dashboard` test 19 wasn't re-run after the due-date migrations). Migration `…092001` now re-revokes anon/PUBLIC EXECUTE on every public function this batch creates OR replaces, plus those 4 — **DONE 2026-06-14**; pgTAP test 19 green (0 anon-executable public functions).
- [x] **Post-Phase-8 due dates (frontend, task #2):** due-date inputs in the two dialogs + tracking display — **DONE 2026-06-14** (frontend). `phase-slot-dialog` gains optional `defaultDays`; `activate-phase-dialog` gains an activate-only `dueDate` field (prefilled today+`defaultDueDays`, local-date math, "Remover prazo" clear button, reset-on-open via render-phase prop-change pattern); `coordinator-phase-actions` passes `defaultDueDays`. New `formatDueDate`/`isOverdue` helpers in `format.ts`; due-date chip (CalendarClock + "Prazo: …", destructive "· Atrasada" when overdue) on `case-phase-list`, `my-phase-card`, `cases-table`; "Prazo padrão: N dias" on `phase-slot-card`. lint+typecheck green. Live login-gated walkthrough blocked by a host TLS root-CA failure reaching remote Supabase (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`, infra/env — outside frontend scope); verified pure logic (prefill TZ-safety, overdue date-only comparison, pt-BR formatting) against concrete cases + rendered the real chip markup with live tokens (`preview_inspect` confirms destructive token + font-medium on overdue, muted-foreground/weight-400 on normal). `preview_screenshot` capture itself times out in this env (renderer-side), so no image attached — flagged for the lead/tester.
- [x] **Phase 8 QA MINOR-1 (backend):** CSV export honors the active date window. Migration `…090015` adds optional `p_from`/`p_to` to `dashboard_export_rows`; `getFormExport(formId, range?)` + the export route read `from`/`to` from the query string — **DONE 2026-06-13**.
- [x] **Phase 8 QA MINOR-2 (backend):** form-picker tab totals respect the active window. Migration `…090015` adds optional `p_from`/`p_to` to `dashboard_form_totals`; **`listDashboardForms(commissionId, range?)`** (range OPTIONAL — existing call still typechecks; frontend passes the range in a one-line page change) — **DONE 2026-06-13** (backend; frontend wires the range).
- [x] **Phase 8 QA INFO-1 (backend):** `getFormDashboard.totalSubmitted` is derived from the over-time RPC (same `app.submitted_form_responses` source as the trend chart), so headline and chart cannot silently disagree; clarifying comment added — **DONE 2026-06-13**.
- [x] **Phase 8 lint (tester):** `e2e/phase8-dashboard.spec.ts` 4 unused-var warnings removed (`FORM_A_ID`, `RESPONSE_E1`, `signOut`, `tables`) — **DONE 2026-06-14** (tester, `49ed2dc`); ESLint clean.
- [x] **Phase 5 QA MINOR-1 → folded into Phase 6 (backend):** `save_section_answers` now guards that `p_section_id` belongs to the response's `form_version_id` (raises `P0013`) — **DONE 2026-06-13** (migration `20260613090001_signoff_phase6_amendments.sql`).
- [x] **Phase 5 QA MINOR-2 → folded into Phase 6 (backend):** the cross-version guard now raises a distinct SQLSTATE `P0013` (`invalid_cross_version_item`), and `saveSection` maps it to "Dados inválidos para este formulário." — distinct from the "já enviada" `check_violation` — **DONE 2026-06-13** (migration `20260613090001` + `src/lib/responses/actions.ts`).
- [x] **Phase 5 QA INFO-1 (tester)** — removed the unused `type Locator` import in `e2e/phase5-wizard.spec.ts` — **DONE 2026-06-13** (lead, at the Phase 5 record step; trivial lint cleanup, no test-logic change).
- [x] Choose the sanitizing Markdown renderer library (ARCHITECTURE.md Rule 7) — **DONE** (Phase 4): `react-markdown` + `rehype-sanitize` + `remark-gfm`, ADR [0014](../decisions/0014-markdown-renderer.md); no `dangerouslySetInnerHTML`. Reused by the Phase 5 wizard `section_text` renderer.
- [x] Phase 3 QA MINOR-1 — `assignStaffAdmin`/`removeStaffAdmin` revalidate the `/admin/comissoes/[slug]` detail page (helper `revalidateCommissionPages`, slug resolved from `commissionId`) so the roster refreshes without navigation — Done 2026-06-12 (backend).
- [x] Phase 3 QA MINOR-2 — `ConfirmRemoveButton` types its `action` prop against `ActionState` from `@/lib/admin/actions` (was `AuthState` from `@/lib/auth/actions`); structurally identical, `removeStaff` still assignable — Done 2026-06-12 (frontend).
- [x] Phase 3 QA INFO-1 — assert the "Coordenação" `RoleBadge` renders for a seeded staff_admin in the member roster — **DONE 2026-06-12** (tester, Phase 4 gate): added to `e2e/phase4-builder.spec.ts` as the INFO-1 test; asserts `chefe.ccih@test.local` row carries "Coordenação" badge and `staff1.ccih@test.local` carries "Membro" badge at `/c/ccih/manage/members`. Green vs remote.
- [x] **UX (observed Phase 4 testing):** a page-level `notFound()` deep under `c/[slug]/**` rendered a BLANK `<main>` inside the commission shell — **FIXED 2026-06-12**: added `src/app/c/[slug]/not-found.tsx` (friendly pt-BR 404 that renders inside the shell). An unknown/inaccessible slug still hits the layout's own `notFound()` → global 404 with no shell (no leak, unchanged). E2E asserts the message renders for staff at the builder.
- [x] **Phase 4 AC-d image-path assertion** — **DONE 2026-06-12**: `e2e/phase4-builder.spec.ts` AC-d builds an image form, publishes v1, clones to v2, RE-UPLOADS the image, publishes v2, and asserts (via the signed-URL paths in the rendered views) that v2's storage path differs from v1's AND v1's history view still renders the ORIGINAL path (immutable). **Bonus hardening:** testing surfaced a real race — saving the item editor WHILE an image upload was in flight persisted the previous/stale path. Fixed: `ImageItemEditor` reports `onUploadingChange`; `ItemEditorDialog` now disables submit ("Enviando imagem…") until the upload resolves.
- [x] Fix bad-credentials E2E test selector/assertion (Phase 2 MAJOR-1 / bug P2-001) — Done 2026-06-12 (`f1c561f`): targets `[role="status"]`, asserts exact pt-BR message.
- [x] ADR 0007: middleware coarse-gate + root Server Component role-landing design (Phase 2 INFO-1) — Done 2026-06-12 (`d4d80dc`).
- [x] ADR 0008: GSAP 3.15.0 animation dependency — rationale, version pin, license (Phase 2 INFO-2) — Done 2026-06-12 (`409c24c`).
- [x] Run `supabase start` to confirm the local stack boots from a clean clone (Phase 0 acceptance). — Done 2026-06-11 (backend task #1; REST + Auth healthy).
- [x] Set `lang="pt-BR"` in `src/app/layout.tsx` (QA Phase 0 MINOR-1) — Done 2026-06-12 in F0 (`src/app/layout.tsx:47`).
- [x] ADR on the new Supabase CLI publishable/secret key scheme (env var names kept) — Done 2026-06-12, ADR 0006.
- [ ] **Phase 8 deploy checklist — production Supabase Cloud MUST use asymmetric (ES256/RS256) JWT signing keys** (Phase 2 QA re-review, ADR 0009). Otherwise `getClaims()` silently falls back to a per-request `getUser()` GoTrue round trip, re-introducing the P2-002 post-login race in production (behavioral regression, not a security hole — tampered tokens still fail closed). Add a testable verification step.
- [~] Register the custom access token hook (ADR 0002) — **DONE on the remote TEST project `azkbbhskturikxpgmafq` 2026-06-12** via `supabase config push` (auth section). Verified: `admin@test.local` JWT carries `is_admin:true`, `chefe.ccih@test.local` `is_admin:false`. Config push also set Site URL + redirect allow-list to `localhost:3000`/`127.0.0.1:3000` and `enable_confirmations=false` on remote. NOTE: the storage section of `config push` 402s (`[storage].vector enabled=true` needs a paid tier) — harmless for auth, but a clean full `config push` will fail there. **Still TODO for real production**: re-apply on the prod project at deploy.


<!-- rotated from PROGRESS.md 2026-07-02 (§7): resolved/done follow-ups -->
- [~] **NSP-per-org — IN PROGRESS (this is the phase that lifts the multi-org PHI guard; ADR [0042](../decisions/0042-nsp-per-org.md), amendment 13 fulfilled).** Sub-phase A (backend security core) complete on `feat/nsp-per-org` (migration `20260630000000`); A6 pgTAP gate + sub-phase B (FE + un-quarantine 124 E2E) pending. See the Current Phase Tasks table + [nsp-per-org-design.md](../progress/nsp-per-org-design.md).
- [x] **case-patient `is_admin()` PHI-write/erase arms — RESOLVED in NSP-per-org.** `dispose_case_phi` org-scoped (`is_admin`→`is_org_admin_of_commission`; I1 fold-in, `19bb30a`); QA confirmed `set_case_patient` was already clean; the broad `is_admin()` DEFINER sweep completed in the [A QA review](../reviews/nsp-per-org-a-review.md) (dispose_case_phi was the sole live finding). _(orig note:)_ **case-patient module — bare `app.is_admin()` PHI-write/erase arms (cross-tenant gap; flag is ON → potentially LIVE; surfaced by `backend` during NSP-per-org A3, 2026-06-25).** `set_case_patient` (`…017000:232`) and `dispose_case_phi` (`…017000:340`) still gate on a bare platform `app.is_admin()` arm — the **same leak class** NSP-per-org just fixed in `dispose_event_phi` (`is_admin` → `is_org_admin_of_commission`). Under multi-tenancy `is_admin` = vendor `platform_admin`, walled off all PHI (ADR 0041), so this lets a platform_admin **write/erase ANY org's case PHI** cross-tenant. `case_patient` flag is **ON** (all 13 flags ON per the 2026-06-25 run) — so this is potentially live, not dormant (backend's note said "flag OFF" — INCORRECT, reconcile). It is an integrity/erase gap, not a read-leak (`can_read_case_patient` is org-guarded). **Fix = the identical surgical rewrite** (org-scope both arms + update pgTAP `151`). Out of NSP/referral scope but small + backend is warm — recommend a fast-follow. **QA to confirm severity + sweep for any OTHER missed `is_admin()` DEFINER arms the multi-tenancy `…626000` rewrite skipped** (e.g. `dispose_event_phi` was one; there may be more).
- [~] Register the custom access token hook (ADR 0002) — **DONE on the remote TEST project `azkbbhskturikxpgmafq` 2026-06-12** via `supabase config push` (auth section). Verified: `admin@test.local` JWT carries `is_admin:true`, `chefe.ccih@test.local` `is_admin:false`. Config push also set Site URL + redirect allow-list to `localhost:3000`/`127.0.0.1:3000` and `enable_confirmations=false` on remote. NOTE: the storage section of `config push` 402s (`[storage].vector enabled=true` needs a paid tier) — harmless for auth, but a clean full `config push` will fail there. **Still TODO for real production**: re-apply on the prod project at deploy.

## Rotated out 2026-07-02 (§7 cleanup) — resolved / superseded

> These items were removed from the live PROGRESS.md Follow-ups list because they are now
> resolved or superseded. Reasons:
> - **Answer-Model v2** — built & QA-APPROVED 2026-07-01 (see Phase Status + docs/progress/answer-model-v2.md); the "PLANNED, not started" note is stale.
> - **`listCaseAccess` read** — delivered by the action-items-fold + case-access-expiry work (ADR 0050), which passed its gate 2026-07-02.
> - **Remote-push deferrals `…110xxx` / `…093xxx` / `…092xxx`** — those migration files no longer exist; they were folded into the single squashed baseline (`20260620000000`) and are superseded by the migration-squash follow-up. The remote has since been re-baselined (Phase Status "remote re-baselined 2026-07-01").
> - **D12 status-file deletions** — frontend §H completed 2026-06-14; the only residue (backend deleting 2 now-orphaned shims + dropping the `CaseStatusKey` alias) is kept as a one-line open item in PROGRESS.md.

- [ ] **Answer-Model v2 — PLANNED, not started (2026-07-01; ADRs [0045](../decisions/0045-answer-model-v2.md)/[0046](../decisions/0046-forward-compat-form-capabilities.md), plan [docs/plans/answer-model-v2.md](../plans/answer-model-v2.md)).** Pre-launch schema-shape hardening from the 2026-07-01 forms data-model review: uniform answer row (choice items get a parent `answers` row; `answer_selected_options` → `answer_id`), typed scalar columns (`value_number/date/time`, trigger-derived; `value` stays the canonical evaluator input), instance-ready answer key (`answers.group_instance_id` + `response_group_instances` + `form_items.parent_item_id`) as **scaffolding only — NO repeating-group or new-answer-block UX**, `answered_at` + reserved `confidentiality_level`, and question **default values**. Evaluator byte-for-byte unchanged (Rule 3); additive forward-only migrations, no flag, user-run remote `db push`. Run as a mini-phase (§6), full plan review on the answer migrations; at implementation update ARCHITECTURE.md Rule 2 + docs/backend-state.md. Owned by `backend` (+ `frontend` for the defaults UI).
- [~] **Case Access — `listCaseAccess(caseId)` read for the access panel (QA INFO-N3).** BEING ADDRESSED by the action-items-fold + case-access-expiry work (2026-07-02, ADR [0050](../decisions/0050-action-items-fold-visibility-scope-case-access-expiry.md), tasks B3/F2): `list_case_access` now returns `(user_id, level, granted_at, expires_at, reason)` and the rebuilt access panel wires it. Close when that feature passes its gate.
- [ ] **Case Access — push migrations `…110000–110004` (+ the in-place CA-001 edit to `…110002`) to the linked REMOTE** (`supabase db push --linked`) when taking the feature live. Verified ONLY against local `supabase db reset` (pgTAP 619/619, seed personas). **Auto-blocked as a production deploy — needs explicit human/lead go-ahead** (mirrors the Cases-Extras / case-model remote-push deferrals above).
- [ ] **Case data-model — push migrations `…093000`–`…093003` (all 4) to the linked REMOTE** (`supabase db push --linked`) at the verification/tester stage. Backend verified ONLY against a local `supabase db reset` (4 migrations apply clean; functional probe confirmed the conclude gate HC031, terminal-first close, recompute → `pendente`; types regenerated; lint+typecheck+unit green). The defensive `update cases set status='nao_iniciado' where status not in (5 keys)` in `…093001` lets the additive CHECK apply cleanly on the drifted remote. **Auto-blocked as a production deploy — needs explicit human/lead go-ahead** (lead is coordinating the remote push at the tester wave). pgTAP for this batch is task #4 (tester-owned specs; backend owns the enabling migrations + seed enrichment).
- [ ] **Cases-Extras — push migrations `…092000`–`…092006` (all 7) to the linked REMOTE** (`supabase db push --linked`). Backend verified ONLY against a local `supabase db reset` (191/191 pgTAP green, types regenerated); the remote drifts from local (user MEMORY) and the tester's remote runs need these. `db push` was auto-blocked as an unapproved production deploy — **needs explicit human/lead go-ahead** before the tester hits remote. (Lead is making the remote-vs-local test-gate call before the tester wave.)
- [ ] **Case data-model — D12 status-file DELETIONS deferred to land WITH frontend §H (backend tasks #2/#3 handoff).** Deleting the configurable-status modules now would red-line ~12 not-yet-reworked frontend consumers (kanban drag, the "Estado" picker, the status manager, `case-derive`, the badges, the cases/detail/settings pages), which is the §H rework owned by `frontend` — so to hand over a GREEN `lint`+`typecheck` baseline without touching `src/components/**`/`src/app/**`, backend INTERIM-SHIMMED the two backend D12 lib modules instead of deleting them:
  - `src/lib/queries/case-statuses.ts` → now a deprecated module: re-exports `CaseStatusColorToken` from the new home and **`listCaseStatusDefs` synthesizes the 5 FIXED statuses** into the legacy `CaseStatusDef` shape (NO DB read), `caseStatusIsTerminal` delegates to the fixed helper. So the un-reworked board/table/badge/lifecycle render the CORRECT fixed statuses live during §H.
  - `src/lib/cases/status-actions.ts` → deprecated INERT no-ops (`setCaseStatus`/`create/update/reorder/archive_CaseStatus` return a pt-BR "estado é automático"); their RPCs are gone.
  - **TO DELETE during/after §H (frontend removes the importers, then backend removes the files):** `src/lib/queries/case-statuses.ts`, `src/lib/cases/status-actions.ts`, `src/components/cases/status-manager.tsx`, `src/components/cases/status-def-dialog.tsx`, `src/app/c/[slug]/manage/settings/statuses/page.tsx`. **KEEP** `src/components/cases/color-token-picker.tsx` (shared by tags/outcomes; its `CaseStatusColorToken` import should be re-pointed to `@/lib/cases/case-status` during §H). The new single source of truth is **`src/lib/cases/case-status.ts`** (`CaseStatus`/`CASE_STATUSES`/`CASE_STATUS_META`/`isTerminalCaseStatus`/`CaseStatusColorToken`).
  - **§H consumer rework owned by frontend** (plan §H): kanban → 5 fixed read-only columns (drop drag/`setCaseStatus`); table/view chips → fixed statuses + outcome/adverse filters; `case-lifecycle-actions` → drop the "Estado" picker, "Concluir" (outcome-capture dialog → `setCaseOutcome` then `closeCase`) + "Cancelar"; `case-derive` → import the fixed model; blocked-phase rendering ("Bloqueada por Fase N"); process outcome picker + case outcome selector + the `desfechos` settings manager + dashboard % adverse breakdown; `settings-tabs` drop "Estados" add "Desfechos". Backend posted the contracts (task #1) + impls (task #3): `case-outcomes.ts`, `outcomes-actions.ts`, `setTemplatePhaseBlocks`.
  - **✅ FRONTEND §H DONE 2026-06-14 (frontend, task #5).** All consumers reworked off the configurable-status modules onto `@/lib/cases/case-status`; the 3 frontend-owned D12 files DELETED (`status-manager.tsx`, `status-def-dialog.tsx`, `settings/statuses/page.tsx` + its now-empty route dir). **The 2 backend-owned shims (`src/lib/queries/case-statuses.ts`, `src/lib/cases/status-actions.ts`) are now ORPHANED — zero `src/app`/`src/components` importers remain (verified by grep; the only residual references are inside the two shim files themselves + the deprecated `CaseStatusKey` alias in `src/lib/queries/cases.ts`, all backend-owned). Backend can delete the 2 shims (and drop the `CaseStatusKey` alias) in lockstep.** Built: `case-status-badge.tsx` (fixed-key `CaseStatusBadgeFixed` + still owns `TOKEN_STYLES`/`TOKEN_COLOR_VAR`); `case-derive.ts` (`groupByFixedStatus`, `activePhases` for A5, `blockedBy` D4, `computeOutcomeBreakdown` D14, `computeCaseKpis(rows)` rebased on `isTerminalCaseStatus`); `cases-kanban.tsx` (5 fixed read-only link-columns, outcome chip + "N fases ativas"); `cases-table.tsx` (Desfecho column, fixed status badge/sort, A5); `cases-view.tsx` (fixed status chips + outcome `<select>` + "Apenas adversos" toggle, all client-side over board rows); `cases-kpi-strip.tsx` (outcome breakdown panel: per-outcome counts + % adverse); `case-lifecycle-actions.tsx` (Concluir dialog requires an outcome when offered → `setCaseOutcome` then `closeCase`; Cancelar confirm → `cancelCase`); NEW `case-outcome-selector.tsx` (non-terminal + D15-hidden when no offered outcomes; advisory markers); `coordinator-phase-actions.tsx` (blocked "Ativar e atribuir" disabled + "Bloqueada por Fase N" via `blockedBy`); NEW `outcome-manager.tsx` + `outcome-def-dialog.tsx` + `settings/desfechos/page.tsx` (mirror tag-manager; reorder via Flip; the requires-action-plan/is-adverse toggles); `settings-tabs.tsx` drops "Estados" adds "Desfechos"; settings index redirect → `desfechos`; NEW `phase-blocks-editor.tsx` + `process-outcomes-picker.tsx` wired into `phase-slot-dialog.tsx` / `template-builder-shell.tsx` (draft-only; blockers persisted via `setTemplatePhaseBlocks` chained off the slot save; offered outcomes via `setProcessOutcomes` + inline create); `phase-slot-card.tsx` shows "Bloqueada por: Fase N"; `layout.tsx` open-cases sidebar count → `isTerminalCaseStatus`; case-detail page off `case-statuses`. **Verified:** `npm run typecheck` + `npm run lint` + `npm run test` (24/24) + `next build` ALL GREEN; build route map confirms `/settings/desfechos` added and `/settings/statuses` gone. Client/server boundary sound — every `@/lib/queries/*` import in client components is `import type` (no `next/headers` leak). Local DB probe confirms `case_outcomes` table present + `case_status_defs` dropped (093000–093003 applied locally), so the running dev server HMR-compiled all changed pages without error (all 307 auth-redirects, no 500s). Live click-through of Radix dialogs/menus left to the tester (trusted events) — same env limitation noted in prior waves; could not start an own preview server (Next single-instance lock held by the tester's running :3000 dev server — did not disturb it). **NOTE for backend:** no missing envelope fields found — `Case.outcomeId`, `CasePhase.blocks`, `CaseDetail.outcome`/`offeredOutcomes`, board-row `outcome`, and all outcome/blocker actions matched the posted contracts exactly; built against them directly with no provisional shapes.

## Closed 2026-07-05 (rotated out of PROGRESS live Follow-ups)
- [x] **3 pre-existing (non-Phase-B) E2E failures — RESOLVED/re-characterized 2026-07-04.** BUG-PRE-001 (HA-4 titles reorder) FIXED (spec `expect.poll`, `a4caab0`). BUG-PRE-002/003 (phase10 signing, phase11 interviewer) NOT app defects — pass on a fresh `next dev` stack; full-suite failures are dev flakes, prod-standalone = BUG-AIF-001.
- [x] **Phase B — remote deploy via `supabase db reset --linked` — DONE.** Merged to main (`374de47`; migration hotfix `2988d58` for the 23514 §1c ordering defect). Pre-launch full remote reset (not incremental push); deployed 2026-07-03. Superseded by later Wave-1/Wave-2 `reset --linked` deploys (2026-07-05).
- [x] **Migration squash — REMOTE rollout full reset (Workstream 0, 2026-06-20) — DONE.** The consolidated baseline replaced the 86-migration history; adopted on remote via `supabase db reset --linked` (repeated on the answer-model-v2 re-baseline 2026-07-01 and the Wave-1/2 deploys 2026-07-05). Remote ledger matches local.

## Closed 2026-07-07 (rotated out of PROGRESS live Follow-ups)
- [x] **✅ RESOLVED 2026-07-07 — pre-2026-07-02 uncommitted working-tree edits: intent confirmed via commits.** The two files flagged "human to confirm intent" at the 2026-07-02 session start are both committed and clean in the working tree now. (a) `supabase/config.toml` — the **Resend** SMTP switch was **reverted to local Mailpit for E2E** in `b413950` ("chore(supabase): local-only auth rate limits + SMTP to Mailpit for E2E"), so the local invite-email flow / the 4 `user-registration` E2E failures it caused are unblocked; prod SMTP is handled at deploy (Coolify — ADR [0059](../decisions/0059-coolify-deployment-target.md) — + the Phase-9 email-template follow-up). (b) `src/app/page.tsx` — the NoAccess "Entrar com outra conta" `signOut` form was committed (`e6c699b`/`ccb6bc3`) and is the settled behavior (a plain `/login` link is bounced by the proxy `AUTHED_REDIRECT_AWAY`). No pending human decision remains.

- [x] **Frontend audit (external consultant, 2026-07-05) — apply the 10 recommended changes. ✅ CONCLUDED 2026-07-07 (branch `frontend-audit-conclude`).** Full report: [docs/reviews/frontend-audit-2026-07.md](../reviews/frontend-audit-2026-07.md). Overall verdict: frontend is in very good shape; the findings were refinements. **9 of 10 applied; #6 left as documented opportunistic-on-touch.** **(1) quick batch — ✅ DONE 2026-07-07** — root `app/error.tsx` + `app/global-error.tsx` (pt-BR, styled); `import "server-only"` in `lib/supabase/server.ts` + the PHI query readers; all 7 raw `amber-*` files → `--warning` token; `viewport`/`themeColor` in `layout.tsx`. **(2) sprint — ✅ DONE 2026-07-07** — #2 `useTransition`+`isPending` (aria-busy + opacity + disabled-while-pending) on all 6 URL-driven filter components (`audit-filters`, `submissions-filters`, `dashboard-filters`, `document-filter-bar`, `pqs-inbox-filters`, `referral-dashboard-filters`); #2 `<Suspense>` streaming on the 3 heaviest pages (org `manage/audit`, dashboard, submissions) via 4 new async Server Components (`*-async.tsx`) so primary content paints without blocking on filter-dropdown/tag-report/indicator queries; #3 `Promise.all` sweep over 16 waterfall pages (dependent chains kept sequential). **(3) opportunistic — ✅ DONE 2026-07-07** — #5 consolidated the 4 GSAP rise-in wrappers into `components/motion/{rise-in-group,motion-tokens,use-reduced-motion}` (the 4 old wrappers kept as thin re-export shims → consumer imports unchanged; motion tokens now read from CSS custom props, no more magic numbers; `use-reduced-motion` relocated out of `components/dashboard/`, 7 importers updated); #8 stable `crypto.randomUUID()` client keys for the reorderable options editor + metadata-panel `expanded` set re-keyed (`options-editor`; `block-card` preview re-keyed on persisted id); #10 `memo(InputItem)` **plus** the real win — stabilized `section-step.tsx`'s per-item callbacks via a `useMemo` handler map so the memo actually skips sibling re-renders on keystroke. **#6 (decompose the 800–1,200-line rule editors) — INTENTIONALLY DEFERRED:** the report itself sequences it as opportunistic-on-next-touch and warns "don't do a big-bang rewrite; these work and are tested." Do it incrementally when `recommend-when-editor.tsx` / `result-ruleset-editor.tsx` / `referral-send-wizard.tsx` are next touched. **Verification (merged tree, both work-streams):** typecheck clean, `next build` compiles, full vitest 294/294 green; no file touched by both agents. Full E2E gate not yet run (low-risk additive refactors; lead to schedule the background prod-build E2E run). Owned by frontend; lead coordinated.
- [x] **WS-2 MINOR-5 — revoke TRUNCATE on the two membership tables (QA MINOR, latent/unreachable). ✅ DONE 2026-07-07 (local; remote push pending deploy).** Migration `supabase/migrations/20260713001100_revoke_membership_truncate.sql` = `revoke truncate on public.organization_members, public.pqs_members from authenticated;` (mirrors C-1's audit_log posture). Applied to LOCAL via `supabase migration up`; verified in `role_table_grants` (authenticated now holds only SELECT/REFERENCES/TRIGGER on both). Types unchanged (grant-only). **Remote `db push` deferred to deploy — needs user auth.**
- [x] **WS-6 Wave-2 QA MINOR — `pqs_inbox` tampered-cursor degrades to an empty page, not page 1. ✅ DONE 2026-07-07.** `pqsInbox` (`src/lib/queries/pqs.ts`) now validates the cursor with a `PQS_INBOX_CURSOR_SCHEMA` (`{ r: 'timestamp', id: 'uuid' }`) via the shared `decodeCursor` before the RPC — an invalid cursor degrades to page 1, matching the flat `.or()` sites (was: empty page). Stale "pqsInbox is exempt" note in `pagination.ts` corrected; added a 4-case unit block (pagination.test.ts 17/17). typecheck/lint clean.
- [x] **Stale `revalidatePath('/c/[slug]/…')` route paths — SYSTEMIC no-op across the action surface. ✅ DONE 2026-07-07 (full verify-then-rewrite sweep).** The 2026-07-03 item described "3 remaining sites"; the real scope was ~40 route-pattern constants across **13 action files** (`cases/{actions,documents-actions,outcomes-actions,result-actions,tags-actions}`, `case-narratives/actions`, `forms/actions`, `interviews/actions`, `meetings/actions`, `process-templates/actions`, `referrals/actions`, `responses/actions`, `safety/actions`) — every `revalidatePath(CONST, scope)` whose CONST began `/c/[slug]` silently no-op'd (there is no `src/app/c/[slug]` route; only `src/app/o/[org]/c/[commission]/**`), so post-mutation revalidation across cases/meetings/forms/responses/referrals/safety was NOT happening (staleness masked by natural navigation/refresh). The 2 originally-named sites (`setTemplateCollectsPatient`, `titles-actions`) had already been fixed in prior commits (`20c1bf5`/`da1d00d`). **Fix:** mechanical prefix rewrite `/c/[slug]` → `/o/[org]/c/[commission]`, each target route verified to exist under the new tree, **scopes preserved exactly** (page-vs-layout scope question stays deferred; **orthogonal to BUG-AIF-001** = prod response-truncation, not path/scope). One rename found + repointed: settings `tags` → pt-BR `etiquetas`. Verified constants only ever feed `revalidatePath` (never `redirect()`). Final `grep '/c/[slug]' src/lib/` → 0; typecheck/lint clean; only the 13 target files changed.
- [x] **Layout-batch L5 — `gen types` regen + `backend-state.md` RPC entry. ✅ DONE 2026-07-07.** Remote was verified (Supabase MCP `list_migrations`) to already have `20260705000000` (remote current through `20260713001000`), so the deploy precondition was already met. Regenerated `src/lib/types/database.ts` via `supabase gen types --local` → **byte-identical no-op** (the hand-added `list_addable_commission_members` type already matched the generator output exactly — now authoritative). Added the RPC to the `docs/backend-state.md` RPC inventory (DEFINER, coordinator-gated, org-scoped roster read). typecheck/lint clean. See [layout-adjustments-2026-07.md](../progress/layout-adjustments-2026-07.md).
- [x] **`dispose_referral_phi` — LGPD-erasure parity for the referral PHI module. ✅ ALREADY SHIPPED — item was stale (verified 2026-07-07, Batch B).** The "no erasure RPC" premise pre-dated the fix. `dispose_referral_phi(p_referral_id uuid, p_reason text)` (SECURITY DEFINER) was created in `20260710000000_nsp_per_hospital.sql` + gap-filled in `20260711000700_phi_disposal_closure.sql`: deletes `referral_patient`; redacts `case_referral.{subject,description_md,decline_note}` + `referral_reply.result_md` + `referral_shared_item.{frozen_title,frozen_body_md}` + `referral_reply_attachment.title`; one-shot **HC056**; `phi_disposed_*` on `case_referral`; emits `referral_patient.disposed` at hospital tier; gate = `is_admin OR is_commission_admin_of(source) OR pqs-operator(source/target hospital)`. TS action `disposeReferralPhi` at `src/lib/referrals/actions.ts:468`; pgTAP `supabase/tests/189_nsp_per_hospital_isolation.sql`.
- [x] **Case Access — `case_interviews` (+ 3 child tables) case-scoped to `can_read_case`. ✅ DONE 2026-07-07 (Batch B; ADR 0033 D2 fast-follow, QA INFO-N1).** Migration `20260713001200_case_interviews_case_scope_read.sql` (local-applied; remote push deploy-time) rewrites the SELECT policies on `case_interviews` + `case_interview_{subjects,interviewers,attachments}` from broad `is_member_of(commission_of_interview)` → `can_read_case(…) OR is_commission_admin_of(commission_of_case/interview)`, fully closing the boundary (children resolve via a new STABLE helper `app.case_of_interview(interview_id)`). Writes untouched. Used live-DB `is_commission_admin_of` (the ADR 0051 sweep retired `is_org_admin_of_commission`). pgTAP `144_case_access.sql` extended +14 (member-without-access denied / granted+attributed case-workers allowed / org-admin preserved, parent + 3 children); full suite green (1801). gen types no-op.
- [x] **Case data-model — delete the 2 orphaned D12 status shims (backend). ✅ DONE (already resolved; verified 2026-07-07).** `src/lib/queries/case-statuses.ts` + `src/lib/cases/status-actions.ts` were deleted in commit `1ddd7ba` (pre-dating this pass); both absent on disk, zero importers repo-wide, and `CaseStatusKey` has zero refs anywhere in `src/`. Single source of truth is `src/lib/cases/case-status.ts`. Archive → [follow-ups-archive.md](../progress/follow-ups-archive.md).
- [x] **BUG-AIF-001 — Linux/production safety confirmation. ✅ ANSWERED + RESOLVED 2026-07-11.** The open sub-question ("does the Windows-prod-standalone truncation also hit the Linux/Docker deploy target?") was settled first: a decisive Docker-network repro (real deploy Dockerfile image + a Playwright Linux container, zero Windows networking in the path) confirmed it **does** reproduce natively on Linux — see `docs/progress/bug-aif-001-linux-handoff.md`. That handoff then led to the root cause (session 2, same day): an upstream Next.js App-Router bug (`loading.tsx` Suspense boundary + the server action's deferred `router.refresh()` never flushing; `vercel/next.js` #86151/#86055, fix PR #95391) — proven via a 3-run control matrix and fixed by bumping `next` 16.2.9 → 16.3.0-preview.5 (confirmed current in `package.json`). Regression gate passed (608p/12f, 0 new regressions). Full bug detail → [bug-log-archive.md](../progress/bug-log-archive.md) BUG-AIF-001 row; memory [[case-dialog-prod-refresh-layout-revalidate]].

## Closed 2026-07-15 (rotated out of PROGRESS live Follow-ups — E0/E1 now COMPLETE)

- [x] **Ethics Committee & non-patient-centered case track — original E0→E3 sequencing narrative (authored 2026-07-09, superseded by implementation).** ✅ **E0 (case-participants foundation) COMPLETE 2026-07-10** as phase F1 of the Pre-Pilot Foundations Program → [f1-case-participants.md](f1-case-participants.md). ✅ **E1 (access spine) COMPLETE 2026-07-14** (ADR 0072) → [eth-e1-access-spine.md](eth-e1-access-spine.md). E2 (procedure) + E3 (terminology/UX) remain open — tracked live in PROGRESS.md's Follow-ups + "Current Phase Tasks" S4/S5. Original planning text, preserved verbatim below:

  - [ ] **Ethics Committee & non-patient-centered case track — DESIGN LANDED, NOT IMPLEMENTED (2026-07-09). PULLED PRE-PILOT 2026-07-12 — ADR [0071](../decisions/0071-pre-pilot-release-scope-expansion.md) (E1→E2→E3, access-spine first; each still needs its own ADR).** The platform's `cases` root already *is* a generic committee-matter engine; the one axiom still assuming a patient world is the **case subject** (`case_patient`, patient-only). This track generalizes the subject so a case can be **doctor-centered** (Ethics), patient-centered, or entity-centered — **one model, never a forked root.** Full evaluation + feature-by-feature comparison vs the external design → [case-generalization-evaluation.md](../design/case-generalization-evaluation.md); foundation decisions → ADR [0064](../decisions/0064-case-subject-generalization-participants.md) (product-owner-approved 2026-07-09). Ships as a new track behind flags (`case_participants`, `case_types`), OFF until in-phase flips. **Sequencing:**
    - **E0 — Foundation (ADR 0064) — SCHEDULED 2026-07-10 as phase F1 of the [Pre-Pilot Foundations Program](../plans/pre-pilot-foundations-program.md)** (build plan + migration batching now in that program; sequenced **before** attachments F2): `participants` + `case_participant_roles` + `case_participants`; `professional_profiles` (own audited class); `case_types` + `case_type_terminology`; `case_patient` → N per case (`patient_identifiers(participant_id)`, done while flag OFF). Prereq for everything below. Amends ARCHITECTURE.md Rule 2 (schema) + Rule 12 (adds the professional-identity sensitivity class) **at implementation time**.
    - **E1 — Access spine (ADR TBD, ~0065) — BUILD BEFORE ANY REAL COMPLAINT DATA (external-doc §7 warning):** confidentiality levels; wire `case_types.default_visibility_policy` → `can_read_case` (Ethics = explicit-grants-only, committee membership ≠ case access); **respondent-exclusion** RLS (a doctor can't read their own case); `case_conflict_declarations` + `case_recusals` folded into `can_read_case` (RLS-enforced, not UI); document-level access grants. The external doc §14.4 checklist is a good `can_read_case` acceptance spec.
    - **E2 — Ethics procedure (ADR TBD):** `ethics_case_details` (admissibility/notification/response deadlines); `ethics_allegations` + `ethics_findings`; `ethics_notifications` (deadlines); `case_decisions` + `ethics_decision_details` (**sanctions**, **CRM/CFM** external reporting, decision letter, appeal window); `case_votes`; `ethics_hearings`; `ethics_appeals`. Some may debut as narrative/form phases and graduate to tables where deadlines/querying demand.
    - **E3 — Terminology/UX + accreditation linkage:** ethics label bundles, procedural-timeline categories, dashboards; link ethics decisions/CAPA to the standards crosswalk (Phase 16) as evidence.
    - **Open sub-decisions carried in ADR 0064 §"Open items":** `form_responses.target_case_participant_id` (participant-targeted forms); assignment-role vocabulary on `case_phases`; reconcile the interview-scoped `case_interview_subjects` with case-level participants; whether a doctor-under-review needs its own audited door vs shared reader.
    - **Same E0 work unlocks** credentialing/privileging, risk/legal, and enriched sentinel-event review (all currently blocked by the patient-subject axiom).
    - **Design reviews (2026-07-09):** `backend` **SOUND WITH CHANGES** ([adr-0064-backend-review.md](../reviews/adr-0064-backend-review.md)) + `qa` **CHANGES REQUESTED** ([adr-0064-qa-review.md](../reviews/adr-0064-qa-review.md)) — design sound, no BLOCKER, E0-before-E1 valid; **all findings resolved in ADR 0064 §"Review outcomes & resolutions"** (documentary/spec, design unchanged). Load-bearing corrections a future E0 engineer MUST honor: **R2** (denormalize `organization_id` onto `cases` — no org col today, so no pure composite FK), **R3** (re-key couples to `patient_index`/`patient_xref` ADR 0039 — disposal must purge per-participant), **R5** (`UNIQUE(id,participant_type)` + subtype composite-FK+CHECK — the class-separation invariant), **R6** (E1 anti-recursion), **M1/M2** (Rule 12 final wording + professional-identity erasure posture). **⚠ R1 caveat:** the backend review's `is_multi_org()`/migration-`…629000000` claim **could not be verified** (no such symbol/migration in-tree) — E0 must verify the *actual* PHI-door tenant gate against the live catalog, not trust that detail. **m2 HARD GATE:** do not flip the `case_participants`/`case_types` flags on real ethics data until E1's respondent-exclusion RLS lands. Owned by lead (scheduling) + backend/frontend when picked up.
    - **Doc-hygiene spun off:** CLAUDE.md §3's Rule-12 summary still says "PHI lives in exactly two modules" — stale since ADR 0038 (case = 3rd); must become "three patient-PHI modules + professional-identity class" at E0 (or sooner). Flagged as a separate task. **✅ DONE** — CLAUDE.md §1/§3 now reads "three isolated Class-1 patient-PHI modules" + "a distinct Class-2 professional-identity class."

## Closed 2026-07-18 (rotated out of PROGRESS live Follow-ups — AUDIT-DOOR-BLINDNESS now COMPLETE)

- [x] **AUDIT-DOOR-BLINDNESS (pre-pilot P0) — program-wide `prosecdef` door audit. ✅ COMPLETE 2026-07-18, human-approved.** The whole-platform sweep (292 gate neutralizations across every `authenticated`-reachable DEFINER door) found **no live leak** — door-blindness was platform-wide test-coverage debt, not a Gate-1 breach. Closed with a standing invariant (ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md), INVARIANT HOLDS) + 50 mutation-proven isolation keystones; qa APPROVED (0 P0/0 MAJOR/2 MINOR). Full record → [authz-p0-door-blindness.md](authz-p0-door-blindness.md).

## Closed 2026-08-04 (rotated out of PROGRESS live Follow-ups — Phase 16 items)

### ✅ FUP-P16-1 — 14 never-called doors fail the ADR 0079 floor — **RESOLVED 2026-08-04**

> **RESOLVED.** `ARM=floor` now reports `=== INVARIANT HOLDS ===` (exit 0): doors with 0 calls
> **103 → 89**, all 89 on the allowlist. Full pgTAP green on a **fresh reset** — `Files=151,
> Tests=4615, Result: PASS`. **Nothing was added to the allowlist**: all 14 were verdict (b), a
> real coverage gap. Keystones: `supabase/tests/290_authz_never_called_door_floor.sql` (40
> assertions). Fixes: `supabase/migrations/20260904000000_fix_never_called_ethics_doors.sql`.
> No Phase 16 file touched.
>
> **Writing the ADR-0079 positive twins found 3 doors whose AUTHORIZED path could never succeed** —
> each had a *working* deny arm, so any deny-only test passes while the door is 100% broken for the
> principal it serves. All three were latent (no component wires them yet):
> - `assign_ethics_remediation` — `22P02`: `create_committee_action_item` returns the `action_items`
>   ROW, assigned into a `uuid`. · `open_ethics_external_referral` — `22P02`: same shape, with
>   `create_referral_draft` returning `case_referral`. · `set_case_phase_assignment_role` — `23514`:
>   wrote `case_phases` without setting `app.in_case_rpc`, so `app.guard_case_phase_status` rejected
>   it; its siblings (`activate_phase`, `reassign_phase`, `add_ad_hoc_phase`, …) all set the flag —
>   this door never inherited that arm.
>
> ⚠ **The reusable mechanic — a deny-only keystone CANNOT clear the floor.**
> `pg_stat_user_functions` does not count a call that raises (verified with a probe pair: returning
> fn `calls=1`, raising fn `calls=0`). So ARM 2 is implicitly also a *"this door can complete
> successfully at least once"* check, and a permanently-throwing door reads as **never called**
> rather than **failing** — which is exactly why these 3 hid for months. **If a door stays on the
> offender list after you keystone it, suspect the door, not the test.** Recorded in the allowlist
> header so the next reader hits it there. Never allowlist a door to silence this.
>
> Every deny keystone is **mutation-proven**: neutralizing `can_manage_professional`,
> `assert_ethics_coordinator`, `can_manage_referral_source`/`_target`, `is_staff_admin_of` and
> `is_admin` in turn reddens exactly the expected assertions (both `unlink_referral_case` branches
> redden independently). Mutations ran inside the rolled-back test transaction; catalog verified
> restored after.

<details><summary>Original filing (2026-08-03/04) — kept for provenance</summary>

#### 🔴 FUP-P16-1 — **14** never-called doors fail the ADR 0079 floor (pre-existing, NOT Phase 16)

> **Lead re-ran it at the gate (2026-08-04, fresh reset): `ARM=floor` reports `=== INVARIANT VIOLATED ===`, 103 authenticated-reachable DEFINER doors with 0 calls, 14 of them off the allowlist.** (Backend's earlier count of 13 was one short.) **Provenance verified, not assumed** — every offender traces to a migration that predates this branch:
> `archive_case_assignment_role`, `create_ethics_allegation_category`, `void_decision` → `20260817000500_ethics_e2_rpcs.sql` · `open_ethics_external_referral` → `20260817000600` · `unlink_referral_case` → `20260817001600` · `set_template_case_type` → `20260829000100`. All ≪ Phase 16's `20260903000800`. `git log main..HEAD -- supabase/tests/mutation/` is **empty** — Phase 16 never touched the audit or its allowlist, and it *removed* an offender (`delete_standard`) rather than adding one.
> ⚠ **So the standing invariant is RED at the Phase 16 gate, and Phase 16 did not make it red.** ARCHITECTURE.md Rule 1 calls this a gate that must keep passing, so **whether to ship Phase 16 (and therefore the pilot, which it gates) over a pre-existing red is a PO decision, not a lead one.** What the red actually means: those 14 doors have **no pgTAP exercising their authorization body** — a *coverage* gap, not a proven vulnerability. It is the same shape as Phase 16's own `delete_standard`, which *looked* covered because its only test was a flag-off negative that raised before reaching the gate.

Surfaced 2026-08-03 while running `ARM=floor bash supabase/tests/mutation/p0-authz-invariant.sh`
during Phase 16. Thirteen `prosecdef` doors — in **ethics vocabulary, case-assignment roles and
referral actions** — are never exercised by any pgTAP suite, so the standing door audit cannot see
whether their authorization bodies work at all. **Predates Phase 16 and is unrelated to it**; all
Phase 16 doors now pass the floor.

⚠ **The mechanism is the reusable part.** Phase 16 had a door of its own in this state —
`delete_standard`, "covered" by pgTAP 280 via a **flag-off negative test that raises *before*
reaching the authorization body**. It looked covered and was not. **Coverage that raises early is
not coverage**, and a `grep` for the function name in the test suite would have said "covered" for
every one of these 13.

**To act on it:** re-run the floor sweep to regenerate the current list (it is derived, not
copied here, precisely so it cannot go stale — the standing "encode load-bearing claims
executably" rule), then add a genuine successful call per door. Relates to ARCHITECTURE.md Rule 1,
ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md), and the open
**AUDIT-INVOKER-WRAPPER** item, which is the *other* structural blind spot in the same sweep.

</details>

### ✅ FUP-P16-3 — `app.copy_version_children` temp-table concern: **INVESTIGATED, NOT A BUG**

Recorded so it is not re-raised. During Phase 16, `clone_framework` genuinely needed a
`drop table if exists` guard (its temp map failed on a second call in one transaction), and the
finding was reported as "the same pattern exists in the precedent I copied it from,
`app.copy_version_children` — confirmed live". **Lead re-checked the live body: it is not the same
pattern.** `copy_version_children` drops **both** temp tables **unconditionally at the end of its
body** (`drop table _clone_section_map; drop table _clone_item_map;`) and has **no exception
block** — so sequential calls in one transaction are fine, and a call that raises aborts the
transaction, leaving no second call to collide with.

⚠ **The lesson, which is why this entry exists at all:** confirming that a *pattern* is present is
not confirming that the *defect* is present. The `on commit drop` line was really there; the
conclusion drawn from it was still wrong. Same family as the standing false-P0 rule — read the
whole body, not the line that matches.

## Rotated 2026-08-05 — the pre-resolution text of FUP-AUTHZ-2, FUP-MEM-1 and FUP-BULK-1

Kept verbatim because each names a hypothesis or a measurement that the resolution DISPROVED,
and a resolution reads very differently once you can no longer see what it argued against.
FUP-MEM-1 in particular proposed that `pg_stat_user_functions` drops stats from a rolled-back
pgTAP transaction — plausible, tidy, and wrong.



**Open, and it contradicts FUP-P16-1's close two commits earlier**, which is the only reason it is
filed red rather than shrugged off. On the MEM branch, `ARM=floor` on a fresh reset reports
`INVARIANT VIOLATED` for exactly three Phase-15 doors — `hospital_indicator_rollup` ·
`indicator_kpis` · `record_indicator_measurement`.

**Not attributable to MEM, on evidence rather than plausibility:**
- MEM touches `memberships`, `session_context` and the grant/revoke doors; indicators are untouched.
- `110_indicators.sql` **passes in full** and demonstrably calls all three (e.g. its
  `indicator_kpis total = 6` assertion cannot pass without executing the function).
- Running `00_setup` + `110_indicators` **ALONE** still reports `calls = 0` for the three, while 773
  other functions register calls in the same run. A MEM migration cannot change whether 110's own
  calls are counted — so the METRIC is unreliable here, not the doors.
- All five MEM doors ARE exercised: `session_context` 18 · `grant_role` 43 · `grant_role_for` 14 ·
  `revoke_role` 8 · `revoke_role_for` 2. Nothing MEM added is door-blind.

**Leading hypothesis to test first:** `pg_stat_user_functions` appears not to retain function stats
from the ROLLED-BACK pgTAP transaction for these three, while `00_setup` (which commits) does. A
date-sensitivity angle is also live — the indicator suite is known date-fragile on the 1st–4th
(BUG-P15-001) and this ran on the 4th.

**Next step (cheap, decisive):** run `ARM=floor` on `main` at a comparable date. If it violates there
too, this is a harness/stats artifact and the allowlist or the harness needs the fix — not MEM. ⚠ Do
NOT "fix" it by allowlisting the three until that baseline exists; that would hide a real regression
if one is there.

⛔ **ARM 1 (the ~90-min policy sweep) was NOT run on this branch.** It is still owed before merge.
⚠ A killed ARM-1 run overwrites `docs/reviews/authz-door-audit-findings.md` with a TRUNCATED result
(it rewrote 246 BLIND rows down to 11 here, and was reverted). If you interrupt that sweep, restore
that file before committing.


---



`p0-authz-invariant.sh ARM=policy` (full sweep, 2026-08-04, ~5 h, run on the MEM branch). **302 door
cases + the write-path sweep. BLIND set 83; 15 are NOT in `authz-blind-allowlist.txt` ⇒ INVARIANT
VIOLATED** (exit 1). ⚠ **None is MEM/W4** — W4's migration contains zero `create/alter/drop policy`
statements; it rewrote predicates, not policies.

| violation | landed | source |
| --------- | ------ | ------ |
| `case_assignment_roles_select` · `ethics_sanction_types_select` | 2026-07-18 | ETH·E2 BE-3/BE-6 |
| `referral_{assignments,case_links,internal_notes,read_receipts,resolutions}_select*` · `referral_requested_actions_write_admin` | 2026-07-19 | Referrals-v2 R3/R4/R5 |
| `case_correction_requests_select` · `case_narrative_revisions_select` · `case_reopenings_select` | 2026-07-24 | Case Corrections |
| `answer_selected_options_{select,write}_targeted` · `form_item_options_select_targeted` | 2026-07-27 | ETH hotfix `4ee24c8` (**out-of-phase**) |
| `accreditation_standards_select` | 2026-08-03 | Phase 16 |

**The cause is one process gap, not 15 oversights.** The allowlist was last written 2026-07-18
(`14cd626`). Dating every BLIND policy by its creating migration: **20 allowlisted, all ≤ 07-17; 15
violations, all ≥ 07-18. Zero overlap.** The violations are simply *every RLS policy added since the
invariant last ran*. CLAUDE.md §5 calls this gate **standing**, but §6's numbered Phase Gate is
build → test → QA → approval → record — ARM 1 appears in **none** of them, so it runs only when
someone remembers. Five phases shipped RLS in that window; all five passed pgTAP, E2E, QA and human
approval.

⚠ **And it is worse than "nobody ran it" — Phase 16 DID run it, and recorded a pass.** Its gate row
reads "`p0-authz-invariant.sh` INVARIANT HOLDS", but the only recorded execution is `ARM=floor`
(**ARM 2 only, ~1 min**). ARM 2 asks "is every door CALLED at least once"; ARM 1 asks "does anything
NOTICE if the gate is opened". Phase 16's own `accreditation_standards_select` passes the first and
fails the second. A gate row naming the *script* rather than the *arm* reads as full coverage while
delivering the cheap half — the "text is not truth" failure applied to a gate record. **Record the
ARM, never just the script name.**

⚠ **BLIND means un-keystoned, not broken.** Each policy looks correct; nothing would notice if it
stopped being. Worst-case exposure if one regresses: licensed standard text across commissions
(P16 — commission-owned framework clones, **not PHI**); answer corruption on the ETH targeted lane
(its migration warns the lane is DELETE-then-INSERT, so an INSERT-only widening is data-corrupting,
not merely over-read).

**Two shapes worth carrying forward.** (1) *Sibling covered, derived blind*:
`accreditation_frameworks_select` is COVERED by `278` while `accreditation_standards_select` — which
delegates to it — is BLIND. (2) *ADR 0079 decision 2 predicts `answer_selected_options_write_targeted`
exactly*: a write-policy keystone needs a **reader-non-writer** principal, because row location
applies the SELECT policy, so a fully-foreign principal silently tests the SELECT gate instead. The
allowlist already carries several `*_write` policies for this reason — the shape is known and unfixed.

**Fix:** keystone all 15 (never allowlist — these are ordinary tenant-isolation policies), each with a
POSITIVE twin, mutation-proven via `p0b-isolation-mutation-audit.sh`; the ALL policies need the
reader-non-writer principal. **AND wire the gate into §6** — ARM 2 is ~1 min and belongs in gate step
1; ARM 1 at phase close. Without that, this report regenerates itself with a different 15.

**Recorded ceiling — 30 cases ARM 1 CANNOT audit** (28 door + 2 write-path): neutralizing them aborts
files mid-transaction, so the harness scores `ERROR`, never BLIND/COVERED (a run that didn't happen is
not evidence). ⚠ **The gap correlates with centrality** — `has_role` (259 tests never ran),
`can_manage_referral_{source,target}` (101/61), `is_active`, `is_member_of_for`, `is_staff_admin_of*`,
`is_admin`. For the membership primitives, ARM 1 can never be the evidence; the per-workstream
mutation audits are (`291` 9/9 · `292` 9/9 · `293` 8/8 · `294` 8/8 · `295` 13/13).

**Done in the same run:** pruned 4 allowlist entries the sweep reports as now-COVERED (72 → 68) —
`answer_references_select` (an FF-5 obligation, now closed), `app.is_admin_for`,
`app.is_hospital_admin_of_for` (both covered by MEM W1/W3), `form_item_validations_select`.


---



Found 2026-08-04 during the MEM full-gate triage. **Not a MEM regression** — the mechanism is
probabilistic and identical on `main`.

`listMembers()` (`src/lib/queries/members.ts`) filters the commission roster **by role only**, so it
returns all 9 CCIH staff/staff_admin — including `suspenso.temp@test.local`, whose profile carries a
future `suspended_until`. The bulk wizard defaults every listed member to selected, and
`balancedDeal()` (`src/lib/cases/distribute.ts`) **shuffles with `Math.random`** and hands the 2 cases
to the first 2 of the shuffled list. `bulk_create_cases` then calls `app.is_member_of_for`, which
requires `app.is_active` (checks `is_active` **and** `suspended_until`) and raises **HC021 — "o
responsável deve ser membro da comissão"**.

**The list and the door disagree about what "member" means.** P(the suspended member lands in the
first 2 of 9) = **2/9 ≈ 22%**, which matches the observed rate: 6 branch runs → 4 green, 1 HC021
(AC2), 1 unrelated focus flake (AC8); `main` → 2 runs, both green. A 2-run green on `main` is ~61%
likely by chance, so it is **not** evidence of branch attribution — I initially read it that way and
was wrong.

**Fix:** make the list agree with the door — filter `listMembers` (or at least the bulk wizard's
member source) on the same activity predicate the RPC enforces, so a suspended member is never
offered as a deal target. Until then this reds `bulk-case-creation.spec.ts` roughly one run in five,
on any branch. Related: the door/list-disagreement family in
`docs/progress/authz-handoff.md §7`.



## Resolved 2026-08-05 batch (rotated from PROGRESS.md 2026-08-06)

> Nine ⬛ items resolved 2026-08-05 (MEM follow-ups · AUTHZ sweeps · A11Y · BULK), moved
> verbatim with their full resolution bodies.

### ⬛ FUP-MEM-1 — `ARM=floor`'s 3 never-called INDICATOR doors — **RESOLVED 2026-08-05, not a defect**

The baseline this asked for now exists. On the **merged** tree (branch + `main`, 285 migrations) on a
**fresh `supabase db reset`**, `ARM=floor` reports **INVARIANT HOLDS**, and the three doors register
calls: `hospital_indicator_rollup` **5** · `indicator_kpis` **1** · `record_indicator_measurement` **1**.

**The leading hypothesis is DISPROVEN.** This entry proposed that `pg_stat_user_functions` does not
retain stats from the ROLLED-BACK pgTAP transaction for these three. It demonstrably does — the same
rolled-back suite now produces the counts above. ⚠ Note `hospital_indicator_rollup`'s 5 is
**over-determined** (the new `299` suite calls it), so it proves nothing on its own; the evidence is
`indicator_kpis` and `record_indicator_measurement`, which **nothing in this session touches** and
which went 0 → 1.

**The surviving explanation is the date.** The violating run was 2026-08-04 — inside BUG-P15-001's
known date-fragile window for the indicator suite (the 1st–4th of any month), which this entry itself
flagged as a live angle. Today is the 5th. ⚠ Not proven, and cheap to settle: re-run `ARM=floor` on a
1st–4th. Until then, **do not allowlist the three** — the correct fix, if it recurs, is BUG-P15-001's
date fragility, not the floor.

⛔ **The wider lesson:** an `ARM=floor` violation is a claim about the SUITE's coverage, and a
date-fragile suite makes that claim date-dependent. Record the DATE beside any floor result.

_Original entry rotated → [follow-ups-archive.md](../progress/follow-ups-archive.md) (2026-08-05)._

### ⬛ FUP-MEM-2 — `assignOrgAdmin` door migration — **RESOLVED 2026-08-05, spec RUN and green (3/3)**

`e2e/platform-org-admin-provisioning.spec.ts` (3 tests) exists. The claim it pins is specific, not
"it works": the action must pass the **platform admin's own uid** as `p_actor`, and `grant_role_impl`
stamps `granted_by = p_actor` — so `granted_by` is the observable separating "the right actor reached
the door" from "something did". Asserting the membership row merely EXISTS would pass in both broken
worlds. Uses a dedicated invitee (never a seed persona — `seed.sql` is a contract ~900 tests read
from), purged by e-mail identity before AND after.

⚠ **Still owed: an actual run.** Writing a spec is not coverage. Folds into the same `e2e:prod` run
FUP-BULK-1 needs.


W3/T3.3 moved `assignOrgAdmin` (`src/lib/platform/actions.ts` — the first-org_admin provisioning
path) off raw `memberships` DML and onto `public.grant_role_for`. **No E2E spec exercises it**: a
sweep of `e2e/` finds nothing driving the platform organisation/org-admin provisioning UI, so the
targeted 8-spec run that validated the other five callers could not have covered this one.

It is not unverified — `293`'s equivalence grid drives the `organization` × `org_admin` cells through
both entry points, and §3.3–3.6 pin the anti-lockout on the service path. But the **wiring** (does the
action pass the right actor and scope from a real request?) is exactly the seam a green DB bar cannot
see — the FF-1 lesson, where three live bugs survived lint + tsc + build + 457 unit + 3919 pgTAP and
only E2E caught them.

**Fix:** either add a spec covering platform org-admin provisioning, or drive the path once manually
before merge and record it. Cheap either way; do it before the full `e2e:prod` declare-green.

### ⬛ FUP-AUTHZ-2 — 15 BLIND authz gates — **RESOLVED 2026-08-05**

All 15 keystoned in `supabase/tests/298_authz_p0_isolation.sql` (**32/32**, DENY + POSITIVE twin
each), **15/15 RED-PROVEN** by `p0b-isolation-mutation-audit.sh` Batch 4, all four controls green.
Verified on a **fresh reset of the merged tree**: full pgTAP **160 files / 4903 / PASS**. Nothing was
allowlisted — these are ordinary tenant-isolation policies. ⚠ The fixtures are pinned to seed ids and
`main` rewrote `seed.sql` by 58 lines between authoring and running; they survived, but that was luck
rather than design.

**The gate that stops the sixteenth is `ARM=census` (ARM 3, ADR 0079 Amendment 3).** ARM 1 asserts
BLIND ⊆ allowlist, and a never-swept gate is in NEITHER set, so it passes vacuously — instantly in
`FROMFINDINGS` mode. That is how 15 policies crossed five phase gates. ARM 3 asserts every live gate
carries a verdict *somewhere*; ~2 s, wired into CLAUDE.md §6 step 1, and proven by deleting a backlog
line (exit 1) and restoring it (holds).

**It has already earned it, twice.** Against the merged catalog it found
`process_template_versions_{select,staff_admin_write}` unswept (FUP-PCITV-1 row 1), and its
ghost-check named five `validate_template_*` signatures ADR 0096 had re-keyed. It also caught **my
own** error: three policy names entered from a commit message instead of the catalog.

⚠ **Two design holes were found in ARM 3 itself and fixed in the same session** — recorded because a
census that looks complete is worse than one that admits its edge:
1. **The verdict had nowhere to land.** ARM 3 reads the committed findings md; the diff-scoped ARM 1
   recipe *ends by discarding that file*. The sweep §6 mandates could not record a verdict, so a
   correctly-swept gate would read UNSWEPT forever. Added a `swept:` section.
2. **Boolean-only domain.** BUG-AUTHZ-002's two doors are `prosecdef` DEFINERs returning `TABLE(...)`,
   so ARM 3 as first written **could not have caught them** — the same enumeration hole it exists to
   close. Domain extended to authenticated-reachable row-returning DEFINERs (**+45**, all registered
   as `gate:` debt); justification is the standing rule that a DEFINER's gate REPLACES RLS.

⛔ **Still outside ARM 3: AUDIT-INVOKER-WRAPPER** (`prosecdef = f` wrappers whose hand-written probe
is the only gate; 130 of 281 `app` DEFINERs are PUBLIC-executable). Named in the backlog header so
ARM 3 holding is not mistaken for evidence about that class.

_Original entry rotated → [follow-ups-archive.md](../progress/follow-ups-archive.md) (2026-08-05)._

### ⬛ FUP-BULK-1 — bulk wizard deals to SUSPENDED members — **RESOLVED 2026-08-05**

`listMembers` now carries `isActive`, a TS mirror of `app.is_active`; `activeMembers()` narrows the
bulk wizard's source to members `bulk_create_cases` will accept. **Carried, never pre-filtered** — the
two consumers need opposite answers, since member management is where a suspension gets lifted.
Mutation-proven: removing the suspension term reds 2 of 9 new unit tests. No migration — both columns
already carry a column-level SELECT grant, **re-verified after `main`'s 23 migrations** (the TV phase
did revoke work, so the grant was not assumed).

⚠ **The new embed was probed against PostgREST, not `tsc`** — the change adds two columns to a select
string, which is exactly the shape of BUG-TV-001 and BUG-RCA-001. `scripts/probe-embeds.mjs` resolves
it 200/OK. ⚠ **That tool reports `42501` for 228 of 286 sites** (it runs as `anon`), and a 42501 means
PostgREST stopped at permissions and never resolved the embed — those sites are **unvalidated, not
validated**. Read its output accordingly; the service-role replay is what actually proves a site.

**Owed:** the ~22% red is a probabilistic E2E failure, so only a full `e2e:prod` run can confirm it is
gone. Not yet run.

_Original entry rotated → [follow-ups-archive.md](../progress/follow-ups-archive.md) (2026-08-05)._

### ⬛ FUP-MEM-3 — the DT referral plane's product callers — **COMPLETE 2026-08-05**

**Built:** the hospital-detail **appointment panel** (appoint / replace titular / deputies / revoke,
flag-gated) and the send-wizard **target picker**. The titular affordance is *Substituir*, not *Adicionar*
— `appoint_technical_director` revokes and grants in one transaction, and a plain grant over a seated
office is refused (HC0G4), so an "add" button would be an affordance that cannot work. Destination is
modelled as the sum type it is; the action mirrors the RPC's two-sided XOR rather than asking "is a
commission set?", since the one-sided form admits the "both" case.

⚠ `p_target_commission_id` is sent as an **explicit null** on the DT arm. The generated Args type says
`string`; the RPC requires NULL there. The parameter cannot be given a DEFAULT — it is argument 2, and
Postgres refuses a default on a parameter followed by mandatory ones — so expressing the sum type in
the signature needs a **parameter reorder**. Recorded at the call site, not smuggled in.

✅ **The inbox landed the same day** → FUP-MEM-3b below. The office can now be addressed, read AND
acted on; `295` §4's RPC-surface claim is finally wired to a product path.


W4 ships no frontend by plan, so `create_referral_draft`'s new `p_target_hospital_id` parameter has no
caller anywhere in `src/`: nothing in the product can create a `target_type = 'technical_director'`
referral. The flag is ON, so the *audience* half is fully live — a DT would see such a referral if one
existed — but none can exist.

This is the **declared-param-with-no-caller** blind spot in its exact known shape: the branch behind it
passes tsc, lint, unit, pgTAP **and** E2E, because no product code path reaches it. `295` drives the
RPC directly (§2.1–2.7 including the same-hospital refusal), so the DOOR is proven; the **wiring** is
not, and cannot be until the UI exists.

Also un-wired by the same decision: the four `src/lib/org/actions.ts` appointment actions
(`appointTechnicalDirector`, `appointTechnicalDirectorDeputy`, and their revokes) are exported and
typed but called from no component.

**Fix:** carry both into the DT UI phase — a send-wizard target picker (committee | direção técnica) and
a hospital-manage appointment panel — and add the E2E specs there. Until then, treat "DT referrals work"
as proven at the RPC surface only.

### ⬛ FUP-MEM-3b — the DT referral inbox — **BUILT 2026-08-05**

Two routes under `/o/[org]/direcao-tecnica` (list + detail) — ORG level, because the office has no
commission and every commission-scoped gate refuses a DT by construction. Root landing gained a DT
branch placed AFTER the commission branches, so it only changes the outcome for someone who would
otherwise hit "sem acesso" — which is what a pure DT got.

**The detail page is not a fork of the 540-line commission page.** Four of its panels are unreachable
for a DT BY GATE — internal notes (needs the note's own committee), assignments (commission-scoped),
case links/forward (need a case board), draft affordances (a DT can never author a referral). The
office's surface is genuinely smaller.

⚠ **`next build` passed and the page still crashed on first load** — `hrefFor` was a FUNCTION prop
into a `"use client"` component (BUG-QI-001's shape). Typecheck, lint and a real production build all
reported green on code that could not render. Now a string (`hrefBase`), with the reason on the prop.

E2E `e2e/technical-direction-referrals.spec.ts` **5/5**: wizard → sum type; DT lands on the inbox;
titular drives `sent → received`; **deputy** drives `received → accepted` (D1 asserted, not assumed);
foreign-org isolation. Manually walked once too, DB-confirmed.

⚠ **Still owed:** a DT who is ALSO a commission member lands on their commission and has no nav link
to the inbox. Reachable by URL; a nav entry for the dual-hat case is open.

### ⬛ FUP-A11Y-1 — `useFieldIds` derives the DOM id from `useId()`. ✅ DONE 2026-08-05.

BUG-A11Y-001 was fixed by breaking three ties by hand; the CLASS remained (`name` doubled as the DOM id,
so the next two forms sharing a field name on one page reproduced it silently). `useFieldIds` now returns
`` `${name}-${useId()}` `` as the control id and keeps `name` as the form key alone. The three hand-written
`id:` ties on `/admin` are deleted — one mechanism, not two. The `id` option survives, re-purposed: it PINS
an id for a control something addresses, and its JSDoc says so.

**Live-DOM verified on `/admin`**, the page that carried the three collisions: 0 duplicate ids, and all 7
labels resolve to a control **inside their own `<form>`** (the defect was cross-form resolution, so
`sameForm` is the assertion that matters, not mere uniqueness). No console/hydration error — `useId` is
SSR-stable by construction.

⚠⚠ **IT SHIPPED A REGRESSION, AND ONLY THE E2E GATE CAUGHT IT — BUG-A11Y-002.** `ethics-e2-procedure.spec.ts`
FLOW-7 (the required keyboard-only vote flow) tabs until `i.id === 'ethics-vote-value'`. With a generated
id that predicate never matches, `reachedSelect` is false, and FLOW-8…12 then never run because the file is
serial. **My pre-flight sweep looked for `locator('#id')` and quoted `#id` strings — so its boundary was a
SYNTAX, and this is an id EQUALITY comparison.** Same failure as the memory that says *if your enumeration's
boundary is a filename, it's wrong*: here it was a selector shape, and the real property is "anything that
depends on a hook-produced DOM id". The correct sweep — id equality, `getAttribute('id')`,
`getElementById`, `toHaveAttribute('id'|'for')`, and every `tabUntil` predicate — finds **exactly one** such
site, now fixed at the SOURCE with `{ id: "ethics-vote-value" }` rather than by editing the spec (§6 step 2:
engineers never edit specs to pass). Nothing in lint, typecheck, `next build`, 963 unit tests or the live
`/admin` DOM check could see it.

⚠ **The prior entry's safety evidence was wrong on its central claim.** It said "nothing reads the literal
ids — the only hardcoded `-description`/`-error` strings, in `charter-form.tsx`, do not come from the hook."
In fact **fourteen** files build ids by hand (`assessment-form`, `case-access-panel`, `file-correction-control`,
`reopen-case-button`, `correct-submission-button`, `group-block`, `matrix-grid`, `reference-picker`,
`risk-matrix-picker`, `repeating-group-block`, `input-item` ×3 sites, …) and E2E hardcodes 11 `#id`
selectors. The change was safe anyway — but for a DIFFERENT reason, established by enumeration rather than
by trusting the note: **none of those ids is hook-produced.** The hand-built ones are self-consistent pairs
in components that never call the hook, and the wizard's addressed ids (`item-<id>-opt-<i>`, the radio
`name`) come from `fieldScope`, not from `controlProps.id`. Every spec that touches a hook id READS it off
the DOM first (`getAttribute('id')`, splitting `aria-describedby`) and only then builds `#${id}` — so they
bind behaviour, not spelling.

⚠ **`useId()`'s output shape is a moving target and the code now says so.** React 18 emitted `:r0:` — `:` is
not a legal CSS ident — and 19.2.4 emits `_r_0_`. The hook strips to the plain token, because
`required-marker.test.tsx` and `e2e/ff3-validations.spec.ts` both string-build `#${id}` from
`aria-describedby`. **My first comment asserted the wrong format** (`«r0»`) and was corrected against a live
probe, not from memory.

**Pinned by `src/components/ui/field.test.tsx` (4 cases), mutation-proven per arm:** reverting to
`options.id ?? name` reds the duplicate-id case AND the label-resolution case. ⚠ The CSS-ident case is
**deliberately recorded as NOT pinned to the `replace()`** — React 19.2.4's own format already satisfies it,
so deleting that line leaves the test green. It binds the emitted shape, which is what a React upgrade would
break. Saying so beats letting a future reader mistake it for a mutation-proven guard.

`rules-of-hooks` under `--max-warnings=0` is the hook-position gate: it errors on a hook in a non-component
function, so a green `npm run lint` across all **118** call sites IS the proof, and no call site needed
moving. 963 unit tests green.

### ⬛ FUP-AUTHZ-3 — the 45 row-returning DEFINER doors are swept. ✅ DONE 2026-08-05.

The blocker was harness work, and that is what this was: **`supabase/tests/mutation/p0-authz-rowdoor-audit.sh`**,
a THIRD sweep joining ARM 1 (ADR 0079 **Amendment 4**). The boolean sweep opens a gate by rewriting its
body to `select true`; a function returning `TABLE(...)` has no boolean to open. This one opens the
door's **identity guard** — `if <cond> then` → `if false then` — so the door returns the rows it would
have withheld, then reads the suite exactly as the other two do. Wired into ARM 1's BLIND union and
ARM 3's verdict sources.

**Result over all 45: 32 COVERED · 1 BLIND (allowlisted, measured backstop) · 1 ERROR · 11 UNSUPPORTED.**
Nine came back BLIND; **`supabase/tests/300_rowdoor_gate_keystones.sql`** (18 assertions) moved **eight**
to COVERED — proven by re-running the sweep, not by review.

⚠ **The ninth stayed BLIND, and that is the finding worth keeping.** `get_case_meeting_links`'s guard
is backstopped by a second gate inside its own query (`app.can_reach_meeting`). **Measured, not argued:**
with the guard rewritten to `if false then` the outsider **still reads 0** while the legitimate
staff_admin still reads 1 — so no row-count assertion through that door can ever red on the guard.
Allowlisted as a genuine backstop with that experiment as the justification; the assertion stays but
now says in the file that it is **not** a keystone. Writing nine assertions, watching eight red, and
assuming the ninth held would have been the *"7 keystones that could not fail"* error committed inside
the file written to end it.

⚠ **`open_attachment` is ERROR and deliberately NOT upgraded.** Opening its guard lets an unauthorized
principal reach `log_audit_access`, which RAISES → `208_attachments.sql` aborts (planned 50, ran 36) →
run shape ≠ baseline. Something clearly noticed (`228_ethics_e1.sql` failed a real assertion), so in
substance it is covered — but the shape rule exists to stop verdicts awarded by judgement. It owes a
clean verdict.

**11 UNSUPPORTED stay in the backlog, and the word is load-bearing.** Their gate is an identity
conjunct *inside* the query, not a statement guard, so there is nothing to rewrite — the harness
returns **no verdict**, which is neither BLIND nor COVERED. ARM 3 got a row-door-specific extractor
that filters on the verdict column precisely so an UNSUPPORTED row cannot be mistaken for a sweep
result and let a door leave the census on the strength of the harness admitting it could not test it.

⚠ **My first harness reported 0 guards in ALL 45 doors — a complete false negative that reads exactly
like an honest finding** ("no door has an openable guard" is coherent). The tag regex was an E-string
copied from the boolean sweep, which returns NULL when evaluated directly. Caught only by dry-running
the detector against the catalog and comparing to a hand classification of the bodies. **A detector
that finds nothing must be proven able to find something before its silence is believed.** The same
class bit again within the hour: ARM 3's new extractor used `-F' *\| *'`, where awk treats `\|` as
alternation matching the empty string, and printed nothing — ARM 3 would have stayed green while never
parsing the report at all.

⚠ **And the first sweep had a SOUNDNESS bug, not just a broken case.** `\yif\y[^;]*?<authz>[^;]*?\ythen\y`
could span from an OUTER `if … then` across an inner guard (plpgsql puts no `;` between them),
collapsing both into one `if false then`. `verify_audit_chain` failed to compile — **the lucky
outcome**. The same swallow in a door without an `elsif` chain still compiles, opens a condition that
is *not* an authorization decision, and reports whatever the suite then did as a verdict about the
gate: **a false COVERED manufactured by the audit itself.** Blast radius was established by diffing
both regexes over every body — exactly 1 of 45 — and the corrected re-run changed exactly that one
verdict (ERROR → COVERED), confirming the analysis empirically.

**Verified after:** `ARM=census` HOLDS (436 live gates, all carrying a verdict); the ARM 1 offender set
is **byte-identical to HEAD** (the 15 pre-existing FUP-AUTHZ-2 items) — this work introduced zero new
un-keystoned gates. pgTAP 161 files / 4921 tests green.

### ⬛ FUP-AUTHZ-4 — pruned the 6 now-COVERED entries from the BLIND allowlist. ✅ DONE 2026-08-05.

The PCI+TV phase keystoned the six `process_template_{phases,narratives,outcomes}_{select,staff_admin_write}`
policies but left their allowlist lines in place, so ARM 1 reported them as "no longer BLIND — prune".

**Executed in the mandated order**, which was the whole content of the item: a **diff-scoped ARM 1** over
exactly those six (baseline Files=160, Tests=4903) returned **COVERED ×6**, each attributed to
`supabase/tests/297_process_template_versioning.sql` → those verdicts were **hand-merged** from the subset
report into `docs/reviews/authz-door-audit-findings.md` (BLIND table → COVERED table) → *only then* were
the six allowlist lines and the six `swept:` backlog lines deleted, in the same change. The subset report
was discarded with `git checkout --` as Amendment 1 requires.

**Both arms verified after:** `ARM=census` **HOLDS** (436 live gates, all carrying a verdict — the six now
carry theirs from the findings md, which is what makes deleting the `swept:` lines safe), and ARM 1's
"no longer BLIND — prune" note is **gone**.

⚠ **ARM 1 still exits non-zero — 15 offenders, and they are NOT from this change.** Proven, not assumed:
the offender set computed from `git show HEAD:` versions of the findings + allowlist is **byte-identical**
to the set after the prune. They are the known FUP-AUTHZ-2 fifteen (the 2026-07-27 out-of-phase ETH
hotfix's write policies). Recomputing the before/after sets is cheap and is the only thing that separates
"pre-existing" from "I broke it" — a `tail` of the output cannot.

The `swept:` section is now **empty**, and its header carries the ordering trap in full: prune the
allowlist first and ARM 1 fails for an already-fixed condition; delete a `swept:` line with no findings
verdict and ARM 3 reports the gate as an unswept newcomer.

---

## Rotated 2026-08-07 — QO·FUP close-out (FUP-QO-1/2/3/4/5/7/8; QA APPROVED r2)

### ✅ FUP-QO-8 — RESOLVED 2026-08-07 (backend, F8) — `list_my_nsp_hospitals()` ignored `is_active` and expiry (2026-08-07, backend; lead-scoped)

Found while grounding F7's landing-surface check — i.e. by reading the door I was about to route
users through, not by looking for it. The NSP console-entry door read `public.memberships` **raw**:
no `app.is_active` gate and no `expires_at is null or expires_at > now()` filter, while **every**
sibling in the same lane carries both (`is_pqs_member_of_for`, `is_pqs_member_of_any`,
`is_pqs_operator_in_org_for`).

⚠ **The reason it survived is the interesting part.** In the console path the org read
(`organizations_select` → `app.is_pqs_operator_in_org`) applies the correct filters, so the shell
was saved by the **org read**, not by the door — the laxity was invisible exactly where anyone
would look for it. `src/components/indicators/capa-operator-gate.ts:26` calls it **directly**,
outside that cover, so an expired or deactivated `pqs_member` kept the "Abrir plano de ação (CAPA)"
affordance. Display-only (`open_capa_plan` re-gates, 42501), so no data leak — but a DEFINER door
whose own gate is weaker than its siblings' is invisible to a policy-shaped audit by construction
(`prosecdef` REPLACES RLS), and it becomes a leak the first time someone reads data from it.

⚠ **It had NO pgTAP caller at all** — it sat on `authz-neverclled-door-allowlist.txt`, which is
precisely how its gate drifted below its siblings' unnoticed. That is the floor arm reporting a real
blind spot rather than a bookkeeping nit.

**Fix — migration `20260912000100`.** `app.is_active` moved into a `me` CTE (an inactive caller
yields no rows, both union arms collapse, and the existing `coalesce(..., '[]')` returns the
documented safe default — no second exit path to keep in sync); expiry filter + `hospital_id is not
null` on **both** arms. `create or replace`, unchanged signature: BEFORE/AFTER catalog snapshots
identical property-for-property, **including the `authenticated=X/postgres` ACL that IS this door's
reachability**.

**Caller sweep before writing a line:** SQL callers **ZERO** (comment-stripped `prosrc` scan +
`pg_policies` scan); TS callers exactly one RPC site (`pqs.ts:223`) with two consumers
(`getNspAccessByOrg`, `capa-operator-gate`). Both ask "may this caller operate here NOW" — **the
laxity was not load-bearing for anyone**, so no STOP-and-report was warranted.

**Evidence.** `145` §I (I1–I7), **red-first observed before the migration: I2 / I3 / I6 red
(`have: 1, want: 0`), 42/42 ran**. Positive twins on both sides (I1/I5) and a both-ways probe (I4 —
reactivating restores the row, so I3's zero came from `is_active` and not a broken fixture); I6
exists because the coordinator arm is a **separate union branch** and a one-arm fix passes I1–I4.
`jsonb_array_length`, never `count(*)` — the door returns scalar jsonb, so `count(*)` is always 1
and would read the same on both sides of the fix. I7 pins the ACL structurally. Post-fix 42/42.
Door **removed from the floor allowlist** — verified with `track_functions='all'` that pgTAP now
records **6 calls**, so `ARM=floor` will see it as genuinely called.

### ✅ FUP-QO-7 — RESOLVED 2026-08-07 (PO ruling: **a NULL `p_expires_at` means PERMANENT — INTENDED**; ADR 0103; pinned in `183` §E) — the case-access PHI door NULL-CLEARS expiry on re-grant, UI-reachable

**Ruling.** The PO ruled the behaviour **intended**: `_grant_case_access_unchecked`'s uncoalesced
`expires_at = excluded.expires_at` **stays exactly as it is**, and the door was not changed.
The two doors are ruled OPPOSITELY on purpose, and the deciding fact is the **caller population**:
the role door has **no** caller that passes an expiry (all 12 TS sites omit it), so a NULL argument
there is an accident nobody asked for → NULL = leave unchanged (ADR 0102); this door has **exactly
one** — `grantCaseAccess` → NULL = make permanent (ADR 0103).

⚠ **The UI cannot send NULL by accident — that is what makes the ruling safe** (corrected by
`frontend`'s F9 before this entry was committed; the first framing said "blank expiry field" and
there is no such field). The grant dialog's expiry control is a **NativeSelect** — `Sem prazo` /
`30 dias` / `90 dias` / `Data específica` — and the only blankable control, the DatePicker under
`Data específica`, **fails client-side validation when empty**. NULL reaches the door ONLY through
the explicit **`Sem prazo`** choice, whose meaning on a re-grant is therefore "remove the existing
expiry" (frontend added hint text saying exactly that). ⚠ **Do not unify the two doors without
re-running BOTH caller sweeps.**

**Caller sweep, bounded by the property "reaches `app._grant_case_access_unchecked`"** (line numbers
are a 2026-08-07 snapshot — resolve by symbol): `public.grant_case_access` passes `p_expires_at`
through verbatim, TS caller `grantCaseAccess` (`case-access/actions.ts:177`) — **the only path by which
a NULL expiry can reach an EXISTING grant**, and only deliberately; `public.create_case` and
`public.create_case_from_template` reach the kernel only for the creator self-grant with a hardcoded
`null` on a BRAND-NEW case, where no conflicting row can exist, so the `DO UPDATE` arm is
**unreachable** from them (TS: `createCase` `cases/actions.ts:547`, `createCaseFromTemplate` `:469`).

**Pin + falsifiability.** `183` §E (E0–E3), plan 19→23. Green on first run — the vacuity trap — so
proven by TWO neutralisations, recorded **as measured, not as predicted**: adding the `coalesce`
reds **E1 and only E1**; swapping `greatest()` reds **E0/E1/E3** and leaves E2 green (wider than the
tidy sentence, because a ratchet also refuses E0's narrowing). ⛔ First attempt read
`case_access_grants` under `set local role authenticated` and all four went red on RLS — a
grantee-invisible row is indistinguishable from a wrong value through an `ok()`, so the door is
CALLED as `authenticated` and every assertion runs after `reset role`.

<details><summary>The finding as filed (and the mis-reading that preceded it)</summary>

⛔ **Read this entry, not its first version.** It originally said the case door "omits `expires_at`",
i.e. that it kept the seam limit F1 removed from the role door — and told this follow-up's future
owner to consider **adding** a capability the door **already has**, pointing them away from a live
widening. QA reproduced from the live catalog and through the real door and inverted it.

**The actual finding.** `app._grant_case_access_unchecked`'s `on conflict (case_id, principal_id,
source, source_entity_id) where revoked_at is null do update set …` list **ENDS with
`expires_at = excluded.expires_at` — uncoalesced**. So the case-access door **already extends on
re-grant, and NULL-CLEARS**: as case coordinator, re-granting an existing 7-day grant with a blank
expiry sets `expires_at = null`. It is **UI-reachable** — `src/lib/case-access/actions.ts:181` sends
`p_expires_at: expiry ?? undefined`. This is the exact silent-privilege-widening shape ADR 0102 §2
**refused** for the role door, on a door that carries **`read_standard_phi` / `read_restricted_phi`**.
Reachable through `public.grant_case_access` (and `create_case` / `create_case_from_template`).

**Severity: PHI-grade.** Not "a divergence to tidy up".

</details>

⚠ **NOT a defect until the PO says so, and the door must NOT be changed on that assumption.** An
admin re-granting case access with a blank expiry may legitimately mean "make this permanent" — the
role door's ruling turned on the fact that *no* caller passes the argument, and the case door has a
UI that deliberately sends it. What this needs: **(1)** its own caller sweep bounded by the property
"reaches `app._grant_case_access_unchecked`", **(2)** a PO ruling on the intended NULL semantics,
**(3)** whichever way it goes, an executable pin so the behaviour stops being discoverable only by
reading. `306` 4.4's "mirrors `grant_case_access` verbatim" refers to the **past-expiry refusal** and
is still true — only the re-grant gloss was wrong.

⭐ **How the mis-reading happened — the reusable half.** The probe was
`substring(prosrc from position('on conflict' in prosrc) for 600)`. The `do update` list is longer
than 600 characters and `expires_at` sat just past the cut, so the **window's edge was read as the
statement's end**. **A fixed-width `substring(… for N)` is a WINDOW, not a delimiter — the absence of
a token inside it is not absence.** It is the "text is not truth" family one level down: the catalog
*was* the source, and the *framing* of the query still produced a confident inversion. Note the
direction — it under-reported a live widening, i.e. it failed in the urgency-suppressing direction,
which is the same direction as the `case_referrals` flag-description scar. Ask of any extraction
probe: *could my answer be an artifact of where I cut?*

### ✅ FUP-QO-1 — RESOLVED 2026-08-07 (backend, F1; PO ruling D-FUP-1) — `p_expires_at` seam limits, deferred to Phase C (2026-08-06, backend; consumer: **D14 break-glass**)

**Resolution — migration `20260912000000`, ADR [0102](../decisions/0102-extend-on-regrant-expiry-seam.md).**
Both limits closed inside `app.grant_role_impl`: the targeted `on conflict … do nothing` became
`do update set expires_at = coalesce(excluded.expires_at, memberships.expires_at)`, and the
commission-tier atomic replace now writes `expires_at = coalesce(p_expires_at, expires_at)`. The
value is **absolute, not a ratchet** (a shorter argument shortens — D14 must be able to close a
window early). **NULL = LEAVE UNCHANGED**, decided by a caller sweep rather than symmetry: **no
production caller passes the argument**, so "NULL clears" would have made every ordinary member-add
and promotion silently strip a deliberately-set expiry.

⚠ **The recorded sweep was RE-CUT 2026-08-07 (QA R2), and the ruling SURVIVED.** It first read
"all three production callers" and named `admin/actions.ts:285`, `members/actions.ts:235`,
`org/actions.ts:618` — the output of a `rpc('grant_role'` grep, a boundary drawn by **syntax**, which
missed the `_for` twin entirely. Bounded by the PROPERTY "reaches `app.grant_role_impl`" the set is:
**3 public doors** (`grant_role`, `grant_role_for`, `appoint_technical_director`); **5 further SQL
functions** through them (`add_pqs_member`, `assign_org_admin`, `assign_hospital_admin`,
`assign_nsp_org_admin`, `assign_nsp_coordinator`); **12 TS RPC sites**, named by enclosing server
action because line numbers drift (they drifted once inside the commit that first recorded them —
**resolve by symbol**): `assignStaffAdmin` (`admin/actions.ts:285`) · `addStaff`
(`members/actions.ts:235`) · `assignNspCoordinator` (`org/actions.ts:238`) · `assignHospitalAdmin`
(`org/actions.ts:320`) · `assignNspOrgAdmin` (`org/actions.ts:385`) · `appointTechnicalDirector`
(`org/actions.ts:581`) · `appointTechnicalDirectorDeputy` (`org/actions.ts:618`) · `assignOrgAdmin`
(`platform/actions.ts:215` **and** `:255`) · `addPqsMember` (`pqs/actions.ts:71`) · `registerUser`
(`users/actions.ts:714`) · `assignCommitteeRole` (`users/actions.ts:949`). `assign_org_admin` is
SQL-reachable only (no TS site), which is why it is 12 and not 13. **None of the 12 passes
`p_expires_at`** — the only occurrence of that identifier across the six caller files is the warning
comment F1 itself added. The ruling therefore holds on a population **4× larger**, now including
both platform-provisioning sites, the worst place to clear an expiry silently. Third instance this
workstream of the recorded rule: **an enumeration's boundary must be the property, not a syntax**
(the others: F2's error-code detector, the case-sensitive diff-derivation grep). ⚠ Note the second
lesson stacked on top: the first re-cut fixed the *boundary* and still shipped a *stale snapshot* —
**a recorded line number is itself an assertion that goes stale silently.**

**Rule 11 companion, and it is the part worth reading.** `app.trg_audit_memberships`'s UPDATE branch
is if/**elsif** and `role_changed` **wins** over `expiry_changed`. Harmless until now, because the
replace path never touched `expires_at` — the change to that path is precisely what turned a dormant
asymmetry into an unaudited write of a security control. `role_changed` now carries
`expires_at_before`/`expires_at_after` when (and only when) the expiry also moved. Metadata only.

**Evidence.** `306` recut 37 → 45; the six new/flipped keystones were **observed RED before the
migration** (6 of 43, all 43 ran — no abort). `supabase/tests/mutation/f1-expiry-seam-audit.sh`:
**6/6 RED-PROVEN**, control all green (45 ran). Three of those six (`ratchet`,
`drop_insert_coalesce`, `drop_replace_coalesce`) leave the headline assertions 4.6/4.13 GREEN — the
NULL semantics and the not-a-ratchet property would have been unpinned without them.
`292` §2.1's singleton **survives unrecut** (re-verified: the `string_agg` still reads exactly
`app.grant_role_impl`); §2.2 was **honestly recut** — the door now matches the `set expires_at` half
too, so the positive twin asserts the NAMED SET rather than `count = 1`, since `2` would also be
satisfied by an unrelated third writer. BEFORE/AFTER catalog snapshots identical property-for-property
(`create or replace`, unchanged signature). Divergence from the sibling PHI door filed as **FUP-QO-7**.

<details><summary>Original entry (the two deferred limits, for the record)</summary>

M3 (`20260911000200`) added the D9 expiry SETTER to the grant chain; enforcement was already
universal. Two behaviors are **deliberately deferred**, lead-acked at plan approval, and — because
Phase C's break-glass (ADR 0100 D14) will ride this exact seam — each is pinned **executably** in
pgTAP `306` §4 rather than in prose (a changed behavior must red the suite, not surprise D14):

- **Re-grant does not extend expiry.** An identical (principal, role, org, hospital, commission)
  grant with a NEW `p_expires_at` hits the **targeted** `ON CONFLICT … DO NOTHING` and leaves the
  existing row's expiry untouched (`306` 4.5/4.6). Break-glass "extend the window" therefore needs
  its own door decision in Phase C (revoke+regrant, or a widen of the conflict clause).
- **The commission-tier atomic-replace UPDATE path does not write `expires_at`** (`306` 4.13) —
  a role change keeps the ORIGINAL expiry and ignores the new argument.

Also recorded: `292` §2.1 now pins `app.grant_role_impl` as the **only** `expires_at` writer
(singleton set, both directions).

</details>

### ✅ FUP-QO-3 — RESOLVED 2026-08-07 (backend, F3, `bac7821`) — two vacuous `a2` mutation cases: the audit's coverage claim is overstated (2026-08-06, backend; lead-ratified file-don't-fix)

**Resolution.** Neither case deleted; both RETARGETED onto `241` (the summary-masking lane, where
`read_case_deliberation` is still the gate — `app._project_meeting_case` masks `summary`) plus `241`'s
direct `has_case_capability` PRE probe, on the m5/m6 precedent. `run_case` now takes a per-case source
file, and the CONTROL runs once per targeted suite (a red in a file whose control never ran is not
evidence). **`a2` reads 12/12 RED-PROVEN**, and each retarget was inspected line by line rather than
trusted from the verdict column: `drop_member_default` → `have: false / want: true` (the capability
genuinely vanished) **and** `have: NULL / want: RESUMO_CD` (the masking surface genuinely masked);
`member_ignores_visibility` → `have: true / want: false` **and** `have: RESUMO_EG / want: NULL` (the
over-grant genuinely leaks the sub-group summary to a plain member). 16/16 tests ran under both
mutations — no abort; controls all green (234: 54, 241: 16).

Found while re-running the sibling audits after QO·A M4. `a2-mutation-audit.sh` reads
**10/12 RED-PROVEN**; the two others are **stale since Gate 2 C1** (2026-07-17,
`456d008` — zero diff on the QO·A branch, proven):

- **`K8 member_default` is VACUOUS**: its expected-red positive reads `meeting_cases`,
  which C1 made **member-wide** — the read no longer routes S5's
  `read_case_deliberation`, so dropping the member arm reds nothing. A detector
  reporting coverage it does not have (same class as "a detector that finds nothing
  must be proven able to find something").
- **`Kv member_ignores_visibility` is UNANCHORED**: its expected-red string
  ("reads NO ata section for the explicit_grants_only case") no longer exists
  anywhere in `supabase/tests/` — C1's rewrite of `234` deleted the K8-twin it
  targeted. The harness reports ABSENT, which is the tri-state doing its job.

**Until retargeted, read `a2`'s coverage claim as 10/12, not 12/12.** Needs its own
retarget unit on the m5/m6 precedent (relocate the discriminating power — e.g. the
S5 deliberation proof onto a surface that is still deliberation-gated post-C1, such
as the `241` summary-masking lane or a direct `has_case_capability` probe) — never
delete the cases without replacing what they proved.

### ✅ FUP-QO-5 — RESOLVED 2026-08-07 (backend, F2) — t19 could MASK a real `anon` EXECUTE leak (2026-08-07)

Found by `backend` during QO·A's final estate run, surfaced rather than self-filed. **Out of scope for
QO·A; not a product defect; not caused by M10.**

The pgTAP estate first came back **FAIL** on `100_dashboard` t19 — *"no public function is
anon-executable"*, **have 1079, want 0**. On a **fresh `supabase db reset --local` the count is 0** and
everything passes. Something in the mutation-harness / door-sweep machinery leaves broad `anon` EXECUTE
grants behind in the session.

⚠ **The dangerous direction is the second one.** A spurious red is merely expensive. But the same
contamination means t19 — the invariant that **no public function is anon-executable** — can **PASS on a
genuinely regressed catalog** whenever it runs after a sweep, because the grants it would flag are
indistinguishable from the ones the harness left. An anon-executable door is close to the worst outcome
this codebase has; its guard is currently **sensitive to run order**, which is the same property that
makes a keystone vacuous.

Note the shape: this is a **test-environment side effect disarming a later assertion** — the identical
class as the QO·A finding where `record_recusal` succeeding earlier in a pgTAP file recused the principal,
flipped `is_case_excluded`, and made a later D7 keystone refuse through the *exclusion* arm while
returning the same SQLSTATE as the gate under test (see the `308` §6 header). Both are "the thing that
ran before quietly changed what the next assertion means."

⭐ **MECHANISM IDENTIFIED 2026-08-07 (`backend`) — it is NOT the sweep machinery.** Installing **`pgtap`
into `public`** is what does it: `create extension pgtap` (which the standalone single-file run workflow
performs) leaves **~1079 extension-owned functions anon-executable**, and t19 then fails. Measured both
ways: pgtap present → **1079**; after a reset that drops it → **0**.

That turns a vague hygiene item into a precise, cheap fix — **install pgtap into its own schema**, or have
t19 **exclude extension-owned functions** (join `pg_depend` → `pg_extension`). The latter is the more
honest invariant: t19 means "no *first-party* public function is anon-executable", and it should say so
rather than counting a number that a test dependency can move.

✅ **RESOLVED 2026-08-07 (backend, F2, `bac7821`).** t19 now counts **first-party** functions only,
excluding extension-owned ones by PROPERTY (`pg_depend.deptype = 'e'` → `pg_extension`), never by name —
a `proname not like 'pg_tap%'` filter would be a syntax boundary and would go stale on the next
extension. The verdict no longer depends on run order in either direction. New **19c CONTROL** plants a
first-party anon-executable function and requires the SAME expression to move **0 → 1** (both share one
`pg_temp` helper, so the control cannot drift away from the assertion it proves); it plants-asserts-drops
rather than using a savepoint, because `rollback to savepoint` would rewind pgTAP's transaction-local
test counter. Verified BOTH directions: **22/22 with pgtap installed into `public`** (raw count 1079,
first-party 0) and **PASS via `supabase test db` on a fresh reset**. The "never trust a t19 result that
did not run on a fresh reset" caveat is retired.

### ✅ FUP-QO-4 — RESOLVED 2026-08-07 (PO ruling D-FUP-4: strip stays global; shipped scope label is the fix; A.9 stands) — KPI-strip scope vs. the chip filter

Found by `tester` while writing the A.9 chip-row extension — **by reading the source rather than writing the
assertion the lead's brief asked for.** The lead's coverage bullet ("the KPI strip and locked count recompute
per filter") does not match what ships, and the code is the thing that was right.

`QualityKpiStrip` and the locked-count note in `qualidade/page.tsx` are computed **server-side from the full
`commissions` array** and rendered as *siblings* of `QualityBoardView`, which is where the chip-selection
`useState` lives. No path exists for a chip click to reach either. Selecting a chip narrows **only the table
rows**; the strip stays the global aggregate over every oversight-visible commission. `QualityKpiStrip`'s own
docstring agrees ("derived entirely from `quality_board_summary` rows already loaded by the page").

**Ruled NOT a bug.** The strip is a context header ("how much do I oversee in total"); the chips are a table
filter. Making the strip recompute means lifting client state above a Server Component — an architecture
change — and **no ADR 0100 decision settles which scope is correct**. D10 specifies a cross-committee board
and PHI-free aggregates; it is silent on filter interaction.

⚠ The user-visible consequence, and the reason this is logged rather than dropped: once two commissions are
oversight-visible, a reviewer can see **"Casos visíveis: 6" directly above a table showing one row.** Both
numbers are correct; together they read as contradictory. A presentational label clarifying the strip's scope
was explored as a near-zero-cost mitigation (lead → `frontend`, 2026-08-07) with a hard instruction to stop
if it needed anything beyond a text change.

Pinned executably: A.9 asserts the strip and locked count stay **constant** across chip selections. That is
deliberate — if someone later makes the strip recompute, the test notices. **Post-pilot PO decision**; if the
ruling flips, that assertion is the thing to update, not delete.

### ✅ FUP-QO-2 — RESOLVED 2026-08-07 (F4+F7: catalog-derived role→landing guard, ADR 0101, `KNOWN_UNROUTED` empty; guard caught + F7 routed instances 4+5) — a non-commission-scoped role lands on "sem acesso": THIRD recurrence (2026-08-06, lead)

Found by `frontend` during QO·A planning, **verified by the lead against the live code**, and in scope
for QO·A only as a one-instance fix — **the class is open.**

`src/app/page.tsx` routes a signed-in user through platform_admin → org_admin → hospital_admin →
nsp_org_admin → `context.memberships` (commission-scoped) → technical_director → `NoAccess`. Any
principal whose authority is **hospital- or org-scoped with `commission_id NULL`** is stepped over by
every branch and lands on "Você ainda não tem acesso" — an account that looks unprovisioned while
being fully provisioned. `quality_reviewer` is exactly that shape.

⚠ **This is the third instance of one failure.** The first was BUG-HAT-001; the second was the Diretor
Técnico, patched after the fact by ADR 0094 W4 — and that patch's own comment, still in the file at
`src/app/page.tsx:103-111`, states the mechanism outright: *"The office confers no membership, so every
branch above steps over it and the account looked unprovisioned."* The lesson was written down, in the
right file, and did not prevent recurrence three months later. **Prose in a comment is not a guard.**

Note the near-miss: QO·A's own plan (§A.3) did not list `src/app/page.tsx`. Had the teammate not read
the routing chain unprompted, `quality_reviewer` would have shipped as recurrence three *undetected* —
the pilot's primary daily user, unable to log in to anything.

Proposed scope (post-A): a guard that cannot be forgotten — e.g. a test that enumerates
`memberships_role_check`'s role list from the catalog and asserts each role resolves to a landing route,
so a **newly added role with no home fails the suite** rather than failing the user. The enumeration's
boundary must be the role list itself, not a remembered list of routes. Same class as FUP-AFF-3 below;
relates to ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md)'s
standing-invariant discipline.

**GUARD BUILT 2026-08-07 (backend, F4, `49883c2`; ADR
[0101](../decisions/0101-role-landing-guard.md)) — `src/lib/queries/session-grants.test.ts`.** It
enumerates `memberships_role_check` from `pg_constraint` at test time (the derivation `292` §3 already
uses) and drives **both** seams for real: the role partition, extracted behaviour-identical into a pure
`src/lib/queries/session-grants.ts` so it can load without `next/headers`, and then the **unmodified
default export of `src/app/page.tsx`** (only `getSessionContext` / `signOut` / `next/navigation.redirect`
stubbed; `@/lib/routing` stays real). Nothing is re-implemented. Red-proven: neutralising the
`quality_reviewer` arm of `partitionGrants` reds exactly that role's case; restoring it returns 12/12.
Two vacuity controls ship with it — a synthetic role the catalog does not admit must report NoAccess, and
the routed roles must not collapse onto a single landing URL. It **fails loud** when the stack is down
rather than skipping.

⛔ **THE GUARD FIRED ON ITS FIRST RUN — the class is at FIVE instances, not three.**
**`nsp_coordinator` and `pqs_member`** are hospital-scoped with `commission_id NULL`, have **no
`partitionGrants` filter at all**, and are therefore stepped over by every branch in `page.tsx`: a
principal holding only one of them gets an all-empty `SessionContext` and lands on "Você ainda não tem
acesso". Pre-existing, not introduced here. Held in the test's `KNOWN_UNROUTED` **ledger**, which is
asserted in BOTH directions — an unlisted unrouted role reds, and a listed role that starts landing also
reds — so it cannot be silenced by leaving it alone. **The remaining fix spans `src/app/page.tsx`
(frontend-owned) and one `partitionGrants` filter (backend); it is NOT done.** Needs a lead/PO call on
where a pure `nsp_coordinator` / `pqs_member` should land (the NSP console under `/o/<org>/nsp` is the
obvious candidate) before either half is written.


## FUP-PDF-1 — creator-mint had no UI surface — ✅ RESOLVED 2026-08-08

Archived from PROGRESS.md at resolution. Original entry (2026-08-08, PDF·P1/P2; owner:
frontend + lead placement decision):

> ADR 0104 D11 grants mint to *anyone who can view the source*, and the doors support it — but
> the only response-detail screen (`…/dashboard/submissions/[responseId]`) is wholly
> `staff_admin`-gated, so a response **creator** has no UI from which to mint their own
> submitted response's PDF. Deliberate P1/P2 scope, twice recorded. Fix = decide where a
> creator sees their own submitted response and thread the existing `PrintedDocumentsSection`
> there (pure prop-threading, proven by P2's meeting wiring).

**Placement decision (PO, 2026-08-08):** a NEW respondent-side route
`…/c/[commission]/respostas/[responseId]`, not a relaxed gate on the `staff_admin` dashboard
screen — that screen's back-link, sidebar highlight and mental model are all admin, and dropping
a plain `staff` into `/dashboard` is the wrong IA even though RLS would hold.

**Shipped:** the new page + its `loading.tsx`; `MyResponseCard` now routes submitted rows there
(in_progress rows still resume the wizard), which also retires the "full read-only viewer arrives
in Phase 7" placeholder — a submitted row used to lead into the wizard and bounce to its
confirmation screen. Authority is membership + RLS, deliberately NOT a re-derived creator check;
`getSubmissionDetail` withholds what `responses_select` withholds and still emits
`response.opened_foreign` for a staff_admin reading someone else's row. `canRevoke` stays
`staff_admin`-only (D11: revocation is a governance act, not the minter's undo).

**Zero backend change** — `app.can_view_printed_document`'s `form_response` arm already opened on
`created_by = uid`, and the same predicate backs `printed_documents_select` and
`open_printed_document`. The door was never over-tight; the UI was under-built, exactly as QA
recorded at P1.

**Verified:** `e2e/pdf-printing.spec.ts` 9/9 on a fresh reset, including a new spec that walks a
plain `staff` respondent from "Minhas respostas" → own response → mint → 200 `%PDF-` download,
with no revoke affordance. Catalog-confirmed afterwards: the minting principal was
`staff2.ccih` / role `staff` — the platform's first non-admin mint.

**Fixture hazard found and closed in the same change:** the first version picked the author's
highest-id response, which collided with the id-ascending pool on the very first run (the seed
mints response ids with `gen_random_uuid()`, so pool membership is re-rolled by every
`db reset`). `creatorMintFixture` now recomputes and subtracts the pool prefix, and
`submittedResponseIds` refuses a `count` beyond it.

**Carried a pre-existing find:** BUG-RESP-001 (PROGRESS.md Bug Log) — `listMyResponses` had no
`created_by` filter, so a `staff_admin` saw the whole commission on "Minhas respostas".

---

## Rotated 2026-08-11 — the FUP quick batch (6 items, out of both PROGRESS.md and follow-ups.md)

Six follow-ups closed in one worktree batch (`603e23c`..`97acfd6`, merged to `main` as
`97acfd6`). Criterion for the batch: no migration, no PO ruling, no schema/RLS blast radius —
so the whole set verified with `lint` + `typecheck` + Vitest and needed no pgTAP or authz sweep.

⚠ **Read the three premise corrections below before trusting any other follow-up's prescription.**
Three of these six were measurably WRONG about the code, and each was written as an instruction
someone would have executed: FUP-PDF-4 prescribed a fix that already shipped (a no-op that would
have closed the item with the real gap untouched), FUP-QO-9(b) claimed a false green that three
checks already caught, and FUP-PDF-2 called `23514` a leak path when no door raises it at all.
**A prescription in a follow-up is a claim about the code and ages exactly like one** — re-measure
against the live catalog before implementing, not after.

Still OPEN and deliberately left in `follow-ups.md`: **FUP-PDF-4** (re-scoped — the global
rate-limit arm is the real availability lever, and closing it needs a trusted client identity
plus shared cross-process state) and **FUP-PCITV-1** (5 sub-items; only its embed-sweep entry
point closed here).

### ⬛ FUP-PDF-2 — RESOLVED 2026-08-11: the allowlist is now "ours BY CONSTRUCTION", not "ours today"

`SURFACEABLE_CODES` in `src/lib/pdf-mint/actions.ts` is now `{HC0D1, HC0D2, HC0D3, HC0D5}` —
the custom `HC*` class only — and `mapDoorError` takes a per-call-site pt-BR authorization
message. All three removals were verified against the **live catalog** (`pg_proc.prosrc` of
all four PDF doors), not migration text:

- **`P0002`** — dead, as filed. No PDF door raises it. Removed.
- **`23514`** — ⚠ **filed as "generic", but it is worse than that: NO door raises it either.**
  `check_violation` comes from Postgres alone and its message NAMES THE CONSTRAINT in English,
  so this entry had no house message behind it and could *only* ever leak. QA's "no live path
  today" (it walked every CHECK) is why it stayed latent.
- **`42501`** — the real hazard, and the reason this became a MAPPING rather than a shorter
  list. Both doors DO raise it with pt-BR text (`mint`: *"sem autorização para emitir…"*;
  `revoke`: *"apenas a coordenação…"*), **and** it is Postgres's own `insufficient_privilege`
  for an RLS/grant denial in English. A code shared between our text and Postgres's cannot
  certify the message. Each call site now supplies its own pt-BR string and the DB's text is
  discarded — the mint/revoke distinction is preserved by the CALLER, which knows which door
  it opened.

⚠ **The generalisable rule, which the original filing did not state:** a code is surfaceable
when **nothing but our own `raise` can produce it**, not when our doors happen to raise it
today. "Which codes do we raise?" is the wrong question; "which codes can only we raise?" is
the right one. Only the custom `HC*` class passes it.

### ⬛ FUP-QO-9 — RESOLVED 2026-08-11: both classifier gaps closed, plus the race itself is now WAITED OUT

Original diagnosis (QO·FUP F6 gate run, 2026-08-07, GATE RED 924/5/5/12): a **PGRST002
schema-cache-not-ready race right after `db reset`** hit batches 3 (self-healed), 12 and 17
(each failed + cascaded 6 did-not-run); batch 4 crashed outright at 42 s / exit 127 / **0 tests**.

**Fixed, all in `scripts/e2e-prod-gate.sh`:**
1. **`pgrst_unready()`** — new detector matching **both** shapes (the bare `PGRST002` and
   PostgREST's English *"Could not query the database for the schema cache"*), folded into the
   INFRA classifier with the same `>= f` floor logic `conn_errors` uses. This is why the arm was
   needed at all: a schema-cache race fails **assertions** (the page renders an error), so the
   server is up and answering and `conn_errors` returns **0** — the existing detector was blind
   by construction. Both patterns were verified against a real PGRST002 payload and against an
   ordinary `ERR_CONNECTION_REFUSED` log (1 hit / 0 false positives).
2. **Zero-summary crash** now classifies as INFRA (`parsed == 0 && pw_rc != 0`) and is therefore
   auto-retried, and its reason string reports the **unrun count** (`infra-crash(exit127; 56 unrun)`)
   rather than `infra-unproven(0)`, which read as "nothing wrong here".
3. **`pgrst_ok()` + a preflight wait** — the root-cause half. `reload_pgrst` only *NOTIFIES*; the
   rebuild is **asynchronous and was never waited on**, and starting a batch inside that window
   is the race. Preflight now polls REST readiness (re-NOTIFYing each round, since the first
   NOTIFY can be lost if it lands before the DB accepts connections). Non-fatal by design —
   aborting a 40-minute gate on a cache rebuild would be worse than the warning + retry.

⛔ **Premise correction, measured 2026-08-11.** Gap (b) as filed said a zero-test crash *"slips
past ... an unrun batch that only the denominator check catches"*. **It was never a false green** —
**three** independent checks red it (`exit$pw_rc` :416, `no-summary` :417, `count` :420). The real
and narrower defect was that it was never **auto-retried**, which is what actually costs a batch.
Worth keeping straight: the gate's redness guarantees were sound; only its recovery was missing.

### ⬛ FUP-GATE-RESET-FLAKE — RESOLVED 2026-08-11 (the diagnosable half); the restart POLICY stays the PO's call

Filed 2026-08-10: two consecutive full gates each lost a whole batch (run 2: batch 8 / 61 tests;
run 3: batch 12 / 56 tests) to a transient mid-gate `supabase db reset`, each re-running fully
green when scoped. Same file as FUP-QO-9, so the two were fixed together.

**Fixed in `scripts/e2e-prod-gate.sh`:**
1. **The reset's output is no longer discarded.** `:346` was `>/dev/null 2>&1`, which is why the
   CAUSE was unrecoverable from the logs across two occurrences. Both the per-batch reset and
   `recover_stack`'s reset now write to `$GATE_LOGDIR`.
2. **One logged retry.** The reset is retried once before the batch is abandoned — but attempt 1's
   stderr is **always printed even when attempt 2 succeeds**, precisely so the retry cannot mask
   the transient it exists to survive. ⚠ This is the deliberate compromise on the entry's own
   *"worth capturing before diagnosing"*: capture is preserved, and a 56-test batch is no longer
   the price of one blip.
3. **`renderer_ok()`** — preflight now probes `PDF_RENDERER_URL/health` and names the cause when
   it is down. This is the `gotenberg-pdf` half: the sidecar sits **outside** the Supabase stack
   and carries no restart policy, so any Docker restart silently kills it and every PDF spec reds
   as an assertion failure (8 such reds in one gate, diagnosed only after the run). Vacuously
   true when the var is unset. **Detection only** — `docker update --restart unless-stopped
   gotenberg-pdf` is an infra change and stays the PO's call, exactly as originally recorded.
   Fault-injected end-to-end against a dead port: the warning fires and the gate proceeds.

▶ **Still open, unfixed by design:** the reporting hazard the entry flags — *"COVERAGE: accounted
for 1059 of 1064"* scanning as 99% while an entire batch never ran. The loud `!! NEVER RAN` banner
already works (it is how both were caught); the risk is a **reader** quoting the coverage line
alone, which is a habit, not a script bug.

### ⬛ FUP-P16-4 — RESOLVED 2026-08-11 — 10 files carried the pluralization pattern that shipped two bugs (latent, safe today)

Found 2026-08-04 while closing QA's INFO. Outside `src/components/accreditation/**`, ten files still
build plurals by suffix concatenation (`? "" : "s"`): `manage/cases/page.tsx`, `bulk-step-deal.tsx`,
`bulk-step-members.tsx`, `case-bulk-grid.tsx`, `create-wizard.tsx`, `checklist-section.tsx`,
`notification-bell-client.tsx`, `cases-kpi-strip.tsx`, `triage-queue.tsx`,
`orphan-warning-dialog.tsx`.

**Every word each one pluralizes was checked individually and all are regular pt-BR** (concluído,
linha, coluna, selecionado, caso, lida, atrasado, novo) — a bare `s` is correct for all of them, so
**there is no live defect**. Left untouched deliberately: Phase 16 was at its gate, and the risk is
structural, not present.

⚠ **The risk is the shape, not today's words.** This is exactly how `padrãoes` and `em atençãos`
shipped — the pattern was correct until someone added a word ending in `-ão`. Migrating these to
`plural(count, one, many)` removes the trap rather than relying on every future author noticing
it. An ESLint rule banning `+ "s"` was **considered and rejected** for now: it false-positives
heavily against ordinary string concatenation and would need real tuning — shipping it half-tuned
for an INFO-level item would be worse than the JSDoc steering the helper already carries.

**⬛ RESOLVED 2026-08-11.** All **12 sites across the 10 files** migrated to `plural()`; zero
`? "" : "s"` remain in `src/`. As filed, every word was regular, so there is **no behavioural
change** — this removes the trap, it does not fix a bug.

⚠ **One structural change the entry did not anticipate:** the helper was moved to a new
**`src/lib/text.ts`** and re-exported from `src/components/accreditation/format.ts` (its four
existing importers and `format.test.ts` are untouched). The entry proposed importing `plural`
*from* the accreditation module — but the consumers are notifications, safety, documents, cases
and the wizard, and making the notification bell depend on an accreditation module is the wrong
edge. `src/lib/text.ts` is for pt-BR LANGUAGE primitives, deliberately distinct from the
per-domain `format.ts` convention (which formats DOMAIN values: case numbers, dates, file sizes).
The full rationale JSDoc travels with the definition, so it is now in front of every author who
reaches for it rather than only accreditation's.

### ⬛ FUP-P16-2 — RESOLVED 2026-08-11: both reads routed through `queries/` (Rule 9)

`getStandardAssessmentDetail` and `searchEvidenceCandidates` were **reads** in
`src/lib/accreditation/actions.ts` — debt from **BUG-P16-002**, not a design choice:
`src/lib/queries/accreditation.ts` was still throwing `not implemented` when frontend needed them,
and frontend correctly refused to edit a backend-owned file.

- **`getStandardAssessmentDetail`** — moved wholesale (with its `StandardAssessmentDetail`
  interface) to `queries/accreditation.ts`; its single caller is a Server Component, which can
  read the query layer directly, so **no action wrapper was needed or kept**.
- **`searchEvidenceCandidates`** — **stays a server action** and must: its caller
  `evidence-picker.tsx` is a Client Component. Only its *data access* moved.

⚠ **The non-obvious part, worth recording because the naive move is a silent regression.** A
sibling `getEvidenceCandidates` already existed in the query layer hitting the same RPC, so
"delegate to it" looks like a one-line fix — but it **swallows errors and returns `[]`**, while
the action maps them to pt-BR and the picker renders an error banner (`setSearchError`). Routing
through it would have turned every failure into a silent *"no results found"* — telling the user
their search succeeded. Resolved by adding **`findEvidenceCandidates`**, which returns candidates
**and** the raw error; `getEvidenceCandidates` keeps swallowing (correct for a list), the action
keeps mapping (correct for a picker). Error text stays in the action layer — the query module
owns no user-facing copy.

*Verified: `npm run lint` 0/0 (all three gates) · `tsc --noEmit` clean · Vitest 1218/1218.*

### ⬛ FUP-QOB-2 — the QO·B PO ratification package — **FULLY DISCHARGED** (①②③④ 2026-08-09; ⑤ closed 2026-08-11 when ACT shipped)

Registered at phase close, worked 2026-08-09 with the PO ruling item by item (the PO declined a
block ratification and asked to be walked through each with its evidence — so every verdict below
was taken against a **live-catalog** measurement, not against the doc's own claim). Full context:
[phase record](quality-office-oversight-phase-b.md) + the 2026-08-09 Decisions rows in PROGRESS.md.

**RATIFIED (3 of 5):**
1. ⬛ **BUG-QOB-003 fix shape** — tenancy admin = a session FLAG (`isTenancyAdmin`), never a
   coerced role; content routes 404; KEEP surfaces gate through `canConfigureCommission`.
   *Evidence weighed:* `session.ts:412` carries the flag distinct from `role`; `:584` is the whole
   seam (`role === 'staff_admin' || isTenancyAdmin`); ~20 KEEP routes consume it, only 3 files read
   the raw flag. **Decisive:** the alternative — coercion — is the direct cause of BUG-QOB-004, and
   it makes every `role`-based gate silently wrong one route at a time.
2. ⬛ **`manage/audit/**` + its CSV export = KEEP.** *Evidence:* the live `audit_log_select` qual
   carries `app.is_commission_admin_of(commission_id)` verbatim beside org/hospital-scoped arms —
   the DB already grants it, so the UI is being made to agree, not widened. Agrees with the noun
   rule (platform_admin **may** administer audit).
4. ⬛ **`manage/acreditacao/**` stays membership-gated.** *Evidence:* all four accreditation-plane
   policies measured (`accreditation_frameworks_select`, `accreditation_standards_select`,
   `evidence_links_select`, `standard_assessments_select`) — **tenancy arm = false on every one.**
   Pre-QO·B "access" was the coercion rendering an empty shell. Reversing would be a WIDENING.

**LEFT OPEN BY DELIBERATE PO CHOICE (2 of 5)** — these are *not* pending review, they are recorded
as undecided, with the measurement already done so whoever rules next does not re-derive it:
3. ⬛ **`manage/charter` — RULED 2026-08-09: NOT KEEP ratified, and the underlying need served a
   different way.** The page stays coordinator-only. The oversight question it raised —
   *"which committees are behind on meetings?"* — is answered instead by a **read-only cadence
   column on `/o/[org]/manage/comissoes`**, the registry tenancy admins already own.
   *Measured before ruling:* `upsert_commission_charter` is `prosecdef`, sole arm
   `is_staff_admin_of`, raises HC0K0 with an explicit *"not org/hospital admin"* comment;
   `commission_charters_select` = `app.is_member_of(...)`; and `authenticated` holds **SELECT
   only** on the table, so every write must pass that one door. **No tenancy arm exists on the
   plane at either layer** — unlike the Q2 template case, where RLS already admitted the
   principal and only the doors refused. Granting the page would therefore have been a **genuine
   widening at both layers**, and worse, it would hand out **WRITE** to satisfy a **READ** need:
   the page is fundamentally an edit form for ONE committee, so it could not answer the actual
   question without visiting each committee in turn. It would also dangle a broken affordance —
   the linked regimento is a `controlled_documents` row, and documents are CUT (re-verified
   2026-08-09), so "Ver documento" would 404 for the very principal being granted access.
   ⚠ The charter row is far smaller than its name suggests: `meeting_frequency` +
   `controlled_document_id` + bookkeeping. It is cadence config plus a POINTER; the regimento
   itself lives in the documents module.
5. 🟡 **Dual-hat (quality_reviewer + tenancy admin) precedence: SUPERSEDED 2026-08-09 — the
   question is being replaced by an explicit "act as" role picker (ADR in progress).**

   ⛔ **The previously recorded ruling was FALSE and stated the OPPOSITE of what ships.** It read
   *"dual-hat keeps reviewer-shell precedence"*; it was never implemented and never checked
   against the routing chain. **Measured 2026-08-09** in `src/app/page.tsx`, an ordered redirect
   chain: `orgAdminOf` branches at **line 64**, `qualityReviewerOf` at **line 152** — so a
   dual-role principal lands on the **tenancy admin area**. Tenancy wins, not the reviewer.

   The reviewer branch sits last for an unrelated reason its own comment gives: it was added to
   fix the *dead-end* class (a hospital-scoped role with no landing route → "Você ainda não tem
   acesso"; ADR 0101 records **five** instances). It was never an expression of precedence.

   **Consequence measured, not inferred:** a bare tenancy admin holding the reviewer seat lands on
   `/o/<org>/manage`, sees **no link** to the console (the "Escritório da Qualidade" entry is
   gated `showsMemberItems && isQualityReviewer`, i.e. the COMMITTEE-MEMBER sidebar only; the
   org-manage shell has none), yet **can** reach `/o/<org>/qualidade` by URL — its guard admits
   anyone genuinely holding the seat. So the capability is orphaned behind a URL, the BUG-QOB-004
   shape again.

   **RESOLVED as a design, 2026-08-09: ADR [0106](../decisions/0106-act-as-role-assumption.md)
   — "act as" role assumption.** Precedence is replaced by explicit, *binding* role assumption:
   strict (the active role is the ONLY role), reads AND writes, fail-closed, fresh each session,
   audit-stamped. Ten decisions taken in a PO design interview; three went against the author's
   recommendation and are marked ⚑ in the ADR.
   ⚠ Enforcement lands in ONE function (`app.has_role`, after normalising 7 strays onto it);
   the bulk of the work is the TEST HARNESS, since fail-closed reds every unwired path at once.

   ⬛ **CLOSED 2026-08-11 — this item is STALE and was still reading "NOT YET BUILT" five days
   after it shipped.** ACT **S0–S4** is complete, QA-APPROVED, human-approved, merged
   (`ff0e76a` + `ac4a270` → `main`, pushed), and the remote is **cut over** (`db push` done,
   `custom_access_token_hook` enabled on Supabase Cloud). See the ACT row in PROGRESS.md.
   ⚠ Exactly the failure mode already recorded in the memory note *"merge status truth is git"*
   (ADRs 0083/0084 claimed unmerged for 5 days): **a doc's own build-status prose ages silently
   and nothing gates it** — verify against `git`/the live catalog, and update all three surfaces
   (ADR, PROGRESS row, follow-up body) at Record.

**The separately-tracked items:**
- ⬛ **FUP-QOB-1** — J1c structural pin **RATIFIED** as the standing guard (own entry above).
- ⬛ **BUG-QOB-004** — **RULED CUT-the-arms** (PO 2026-08-09), following the ratified D5 precedent
  verbatim. Executed as `20260917000000`; see the Bug Log entry for the closure record.
- ⬛ **`setTemplateCaseType`** — **DONE 2026-08-09** (`20260917000100`, ADR 0088 Amendment 1).
  Both `set_template_case_type` **and `set_template_collects_patient`** gained the tenancy arm;
  the second was never named in this list and was found by sweeping the plane by property.
  ⚠ Recorded because it changes how the item should have been framed: this was **not a
  widening**. Measured on a bare tenancy admin — direct `UPDATE` through RLS **wrote the row**
  while both doors answered 42501, because all 16 `process_template*` policies already carry the
  arm and a DEFINER's gate *replaces* RLS. The doors were refusing what the boundary already
  granted. `create_case_from_template` deliberately keeps staff_admin-only (content, not
  container).
- ⬛ **The `is_commission_admin_of` → `is_tenancy_admin_of` rename** — **DONE 2026-08-09**
  (`20260917000200`, ADR [0105](../decisions/0105-rename-is-tenancy-admin-of.md)). No shim;
  historical docs deliberately not rewritten (PO). ⚠ **The mechanism was the opposite of the
  D11 prior:** `pg_policy` stores a parsed tree referencing the function by **OID**, so all 54
  policies followed the rename with **zero edits**; only `pg_proc.prosrc` (plain text) had to be
  rewritten, 75 bodies. D11's "rewrote pg_proc, never pg_policy" was an **enum** re-key, where
  labels are string literals — same-shaped task, different substrate. Measured, not assumed.
- *(Same family, pre-existing, recorded by backend during B.11: the `context.isAdmin`
  platform-admin arms on content action pre-checks — a noun-rule sweep candidate at the TS
  layer; DB re-gates, no leak.)*

Owner: **PO** for items 3 + 5 (no deadline, nothing blocked); lead/backend for the scheduled waves.


---

### Also rotated 2026-08-11 — FUP-QOB-1 (a separate, earlier closure)

Not part of the quick batch: closed by PO ruling on **2026-08-09** and simply never rotated.
Included here because it was fully resolved and still occupying both live files.

### ⬛ FUP-QOB-1 — RESOLVED 2026-08-09: the J1c structural pin is RATIFIED as the standing guard (PO)

**PO ruling 2026-08-09:** ratify J1c as it stands. Rationale accepted as recorded below — the
behavioural surface did not weaken, it **collapsed**: post-M1 there is no reader-non-writer
principal left to probe with, and the two alternatives are worse (an invented pgTAP persona
measures the invented grant rather than the live policy; retiring J1b+J1c together leaves the
`created_by` term with no guard at all). The pin's own honestly-stated limit — a structural
assertion is weaker than a behavioural one — stands as a **known** limitation rather than an
open question. J1b stays annotated-not-deleted per the A2 precedent. No further action.

<details><summary>Original entry (2026-08-09, pre-ruling) — the collapse, the guard, and its limit</summary>

### `created_by = auth.uid()` in `response_group_instances_write_own_draft` is no longer independently observable; PROVISIONAL structural pin landed (backend 2026-08-09; needs PO ratification)

- **The collapse (filed 2026-08-08, QO·B):** M1's wall removed `is_commission_admin_of` —
  the only reader-non-writer persona — from the response plane. Post-M1 the readers of an
  in-progress response's instances are exactly {creator, targeted respondent}, and **both
  are writers**; `staff_admin` on a *submitted* response is stopped first by the
  immutability trigger (23514 — proves immutability, not the qual). `270` §J's J1b
  reader-non-writer keystone is therefore VACUOUS (annotated in-file, kept per the A2
  annotate-never-delete precedent). No replacement persona exists without inventing one.
- **Interim guard (backend 2026-08-09, PROVISIONAL pending PO):** `270` §J **J1c** — an
  executable CATALOG pin asserting the policy still exists (FOR ALL, to `authenticated`,
  on `response_group_instances`) AND still carries `created_by = auth.uid()` in **both**
  its USING and WITH CHECK halves. **Red-proven** by the b1 mutation audit's
  `fup_qob1_drop_created_by` case: deleting the term reds J1c **while J1b stays green**
  (observed live: `ok 40 — J1b` / `not ok 41 — J1c`) — the vacuity claim demonstrated in
  the same run. The policy-disappears direction fails closed (the count), no mutation
  needed.
- **Honestly stated limit:** this is a STRUCTURAL pin, and QO·B's own lesson is that a
  structural assertion cannot substitute for a behavioural one. It is accepted here
  because the behavioural surface **collapsed** — there is no principal to probe with.
  During implementation the behavioural alternatives were re-checked and none exists
  without inventing a persona (a bespoke in-test SELECT grant would test the invented
  grant, not the live surface).
- **PO question:** ratify the pin as the standing guard, or direct an alternative
  (invented pgTAP persona / accept the read≡write coincidence as the stronger pinned
  property and retire J1b+J1c together). → **RATIFIED as-is, 2026-08-09.**

</details>

## Closed 2026-08-11 at the ETH·E4 Record step (rotated out of PROGRESS.md + follow-ups.md)

Both are discharged by phase **ETH·E4** — record:
[eth-e4-participant-seating.md](./eth-e4-participant-seating.md), review:
[eth-e4-review.md](../reviews/eth-e4-review.md) (r3 APPROVED).

- **FUP-ETH-1** — CLOSED by the phase itself: the seating panel is fillable on both lanes, all 7
  stubbed actions are implemented, the roster UI ships, and the acceptance criterion (rewriting
  `ethics-e3a-surfacing.spec.ts`'s three raw `dbInsert` sites onto the real doors) is met.
- **FUP-ETH-CPF-1** — CLOSED in-phase by the P0 remediation: `professional_profiles` moved to a
  **column-list grant (12 of 17)** revoking `cpf`, `redacted_by`, `retention_pin_reason`,
  `retention_pinned_at`, `user_id`, **plus** an explicit projection in the `prosecdef`
  `get_case_professional` — both halves load-bearing, measured not argued. QA r2 verified it four
  ways and r3 re-verified it from the catalog (projection ≡ granted set, `set_eq`-pinned in both
  directions).

### 🔴 FUP-ETH-CPF-1 — the D5 widening also exposes `professional_profiles.cpf` (2026-08-11, backend)

Found by `backend` during the ETH·E4 build, measuring rather than reasoning. **Does not block
ETH·E4** — the exposure is latent — but ADR [0108](../decisions/0108-eth-e4-participant-seating.md)
D5's "exposure argument, stated so it can be checked" **enumerates `license_number` / `specialty` /
`professional_type` and does not name `cpf`.** The PO ratified the widening against an incomplete
description of what it discloses. That is the finding.

**The substrate, catalog-verified:** `authenticated` holds a **table-wide** SELECT on
`professional_profiles` — all 17 columns, **no column-list grant**, unlike `profiles` and
`case_referral`, which both restrict by column. `get_case_professional` returns
`to_jsonb(<whole row>)`. So any caller whose RLS row-read succeeds gets every column, and D5
widened *which rows* succeed to every org manager.

**Measured live:** a `staff_admin` of a sibling commission with **no case access** read the
professional's `full_name` **and** `cpf`.

**Why it is latent, not live:** no door writes the column — neither `create_professional_profile`
nor `update_professional_profile` has a CPF parameter, so the column is always NULL in practice.
pgTAP suite **321 K3c** now pins that writer-absence, with the detector **proven able to fire**
against a planted writer (a detector that finds nothing must be shown able to find something).

**Second-order:** `redact_professional_profile` does **not** scrub `cpf` either, so the redaction
path would not save it if the column were ever populated.

**Proposed fix** — a column-list SELECT grant excluding `cpf`, mirroring `profiles`. Deliberately
**not** made inside ETH·E4: it touches a shipped grant on a Class-2 table and is a PO/lead call,
not a build-time one. Related: the `profiles` column-list-grant trap (every new column needs its
own GRANT or reads 42501) and FUP-FF5-1's "sem CPF" affordance above.

### 🔴 FUP-ETH-1 — NOTHING can seat a professional: "Médico denunciado" is an unfillable panel (2026-08-05)

ETH·E3a shipped the primary-subject rail card ([`case-primary-subject-panel.tsx`](../../src/components/cases/case-primary-subject-panel.tsx),
rendered by [`case-detail-view.tsx:352`](../../src/components/cases/case-detail-view.tsx:352) when
`case_types.primary_subject_kind ∈ {professional, entity}`). With `ethics` + `case_participants` +
`case_types` all flag-ON, **an Ethics case in production will show that panel in its empty state
forever** — no product path fills it. Found by the PO asking how a professional gets included; the
answer is that they cannot. Verified against the **live catalog** (`pg_proc` / `pg_policies` / grants /
`pg_trigger`), not migration text.

Seating a respondent needs four rows. **Two have doors; two have none:**

| Row | Door | |
| --- | ---- | - |
| `professional_profiles` | `create_professional_profile` (DEFINER) | ✅ |
| `participants` (`participant_type='professional'`) | — | ❌ **no writer exists** |
| `professional_participants` (the link) | — | ❌ **no writer exists** |
| `case_participants` | `add_case_participant` (DEFINER) | ✅ |

**This is a hole in the substrate, not just missing UI.** A `pg_proc` sweep for `insert into
participants` returns **exactly one** function — `set_participant_patient`, the patient lane;
`create_professional_profile` writes `professional_profiles` **only** (no `participants` row, no
trigger creating one — `professional_profiles` carries one trigger, `guard_professional_linkage`,
unrelated); nothing anywhere INSERTs `professional_participants` outside [`seed.sql:2592`](../../supabase/seed.sql:2592).
All four tables are **SELECT-only** for `authenticated` (no INSERT grant, no INSERT policy), so there
is no direct-DML fallback. `add_case_participant` therefore demands a `participants.id` that no door
can mint for a professional.

⚠ **The TS layer is still the BE-1 contract stub, and its docblock says otherwise.**
[`src/lib/participants/actions.ts`](../../src/lib/participants/actions.ts) — all 7 actions
(`addCaseParticipant`, `removeCaseParticipant`, `setPrimarySubject`, `setCaseParticipantRole`,
`createProfessionalProfile`, `updateProfessionalProfile`, `setProfessionalLinkState`) call
`notImplemented()`. The file says *"Bodies land in BE-5"*; **BE-5 (`9180a27`) shipped the SQL RPCs +
regenerated `database.ts` and never touched it** — the file has two commits ever, both stub-authoring.
The E1 review's ✅ on D6 is about the RPCs, and is correct at that scope. **Zero callers** of any of
the 7 exist in `src/` or `e2e/`; there is no `src/components/participants/`. The panel's own docblock
is honest (*"the full participants roster … not built here"*), as is [`queries/cases.ts:450`](../../src/lib/queries/cases.ts:450)
(`[]` until BE-7). Sequencing debt, not a regression — but **`grep` for the RPC name says "built" and
the product says "unreachable"**, which is the §7 "text is not truth" shape.

**Corroboration that no path exists:** [`ethics-e3a-surfacing.spec.ts`](../../e2e/ethics-e3a-surfacing.spec.ts:298)
seats every respondent with raw `dbInsert('case_participants', …)` — three sites. A spec that must
bypass the product to reach a shipped panel is the tell.

**To close (backend-owned; contract-first):** ① a DEFINER door minting `participants` +
`professional_participants` for a professional, mirroring `set_participant_patient` (⚠ it must preserve
the surrogate-label property ADR 0091 §O pins) · ② fill the 7 action bodies, reads via `src/lib/queries/`
(Rule 9) · ③ a roster surface on the case detail page (add / remove / set-role / set-primary) · ④ **the
link-state flow, or ③ dead-ends**: `app.assert_respondent_linkage_resolved` rejects an `unknown`-linkage
profile from `respondent_doctor` with `HC0F0`, and `setProfessionalLinkState` — the only remedy — is
one of the stubs.

**Two adjacent seed-only gaps, same shape** (both plausibly in scope): `case_participant_roles` has an
admin-write RLS policy but **no RPC and no UI** — the 7 roles, incl. `respondent_doctor` → "Médico
denunciado", exist only because `seed.sql` wrote them; `case_type_terminology` has **no writer at all**,
so the 5 label slots cannot be edited in-app on any tenant.

▶ **Feeds FUP-FF5-2.** That row asks for an assertion pinning the `participants` writer set by count
*and* name. Today's catalog answers **one** (`set_participant_patient`) against ADR 0091's prose claim of
*"exactly two functions"* — so the assertion should be written from the catalog, and the discrepancy
resolved as part of writing it, **not** from the ADR's number.

## FUP-VACUOUS-AUDIT-1 — CLOSED 2026-08-10 (rotated from PROGRESS.md 2026-08-12)

- [x] **FUP-VACUOUS-AUDIT-1 — repo-wide vacuous-assertion audit. 89 raw → 33 real → 0, and it
  is now a STANDING GATE.** `npm run lint` runs `lint:vacuous`
  (`scripts/check-vacuous-assertions.mjs --gate`), which exits non-zero on any finding and
  names the offending test. **Full record — the checkable property, the six real defects it
  exposed, the retraction, and the seven detector defects behind 56 of the first 89 — is
  [docs/reviews/vacuous-assertion-audit.md](../reviews/vacuous-assertion-audit.md).** The live
  PROGRESS.md block was a duplicate of that record and was verified claim-by-claim against it
  before deletion.
  ▶ **Still open: FUP-VACUOUS-COVERAGE-1** (`phi-remediation` REM-8/REM-9 never run). They are
  honest `test.skip()`s, so they sit OUTSIDE the vacuity property and this gate will never
  catch them — closing the audit did not close them.

## Rotated 2026-08-12 — the backend FUP wave (FUP-PDF-3 · FUP-F2-BUCKETS)

### ⬛ FUP-PDF-3 — RESOLVED 2026-08-12: mint/revoke doors narrowed to the granted-column composite (backend)

**Original finding (QA P1 MINOR-2):** both doors `returns printed_documents` (the full row
type), so a **direct PostgREST caller** received `storage_path` + `verification_token` — the
columns deliberately excluded from the authenticated column-list GRANT. `storage_path` is
derivable from granted columns anyway (defense-in-depth, recorded Note C); **the token was the
real widening** (the public-verification credential). Catalog measurement at fix time found
the GRANT excludes FOUR columns, not two: also `revoked_by` + `revoked_reason`.

**Resolution (ADR 0111; migration `20260921000100`):** both doors now
`RETURNS public.printed_document_public` — a named composite mirroring the authenticated
column-list SELECT GRANT exactly (15 columns), projected BY NAME via `jsonb_populate_record`.
Chosen over `RETURNS TABLE` (set-returning → an array over PostgREST, breaking the
single-object action contract) and over ad-hoc lists (one shared type forces a future column
to join together with its own GRANT). Product impact none: the mint action supplies the
credentials itself and reads only summary columns; the revoke caller ignores the returned row.
TS: `src/lib/pdf-mint/actions.ts` retyped to a `Pick<>` of the table Row limited to the
granted columns.

**Method record:** the return-type change forced DROP+CREATE; the before/after property diff
FROM THE CATALOG (prosecdef · provolatile · proleakproof · proisstrict · owner · proacl ·
proconfig) shows `returns` as the ONLY changed property on both doors. pgTAP
`323_printed_document_door_return_shape.sql`: keystones t2–t5/t7–t8 observed RED pre-change
(returns=printed_documents; to_jsonb carried the withheld keys); t10–t13 pin the
rebuild-loss-prone properties (ACL incl. anon=none, SECURITY DEFINER, search_path) with the
population pinned to exactly 2.

### ⬛ FUP-F2-BUCKETS — RESOLVED 2026-08-12: `meeting-attachments` retired; the other two buckets deliberately untouched (backend)

**Original finding (2026-08-11):** F2's legacy-bucket retirement was deferred in writing four
times (f2-attachments-migration-contract §D:326 · phase-14e:167 · the
`20260717000300_attachments_foldin.sql` header · a retrospective) and tracked nowhere. Live
catalog state: `referral-attachments` NOT legacy (live referral PHI plane, Phase 22);
`interview-attachments` already sealed (member SELECT dropped as a confirmed PHI exposure;
pgTAP `236` §③b + `u1-mutation-audit.sh` own that state); **`meeting-attachments` was the
finding** — no product writer (every writer through `bucketForTier`) but BOTH policies live,
the read gating on bare `is_member_of(seg[1])`, the coarse rule F2 replaced.

**Resolution (migration `20260921000300`):**
1. **Measure** — local (fresh reset): `storage.objects` is empty; bucket count 0. ⚠ **Remote
   count could NOT be measured from the fixing session** — a background agent's remote SQL is
   auto-denied by the permission system (the standing remote-auth constraint). Compensated in
   the migration itself: a guard COUNTS `storage.objects` for the bucket at apply time and
   RAISES on non-zero, so a data-bearing remote turns `db push` into the loud data decision
   the original item required, never a silent strand. (The backfill-guard shape, inverted into
   a defense.)
2. **Dropped** `meeting_attachments_select_member` + `meeting_attachments_insert_staff_admin`.
3. **Deleted** the `meeting-attachments` bucket row (via the transaction-local
   `storage.allow_delete_query` opt-in that `storage.protect_delete` — catalog-verified
   trigger — requires; SET LOCAL, nothing leaks). `interview-attachments` bucket row KEPT
   (pgTAP `236` fixtures insert probe objects into it — the FK needs the row);
   `case-documents` KEPT: its snapshot-reader SELECT (`can_read_snapshot_document`) is live by
   design while `getReferralDocumentUrl` still signs from it — that retirement travels with
   the separate open item in [f2-attachments.md](./f2-attachments.md) § *Open risks*.
4. **Pinned** — pgTAP `325_legacy_bucket_policy_pin.sql`, derived from `pg_policies` (never
   transcribed): 0 policies referencing `meeting-attachments` (t1, RED pre-migration: 2) or
   `interview-attachments` (t2, keeps the seal from silently returning); bucket row absent
   (t3, RED pre-migration); t4 POSITIVE CONTROL — the derivation must still SEE the live
   case-documents policy, so the zero-counts cannot go vacuous ("a detector that finds
   nothing must be proven able to find something").
5. **authz-capability-inventory §5.1 question #3** ("`interview-attachments` +
   `case-documents` — in scope, or Stage E?") — answered in substance for the interview/meeting
   half (sealed + pinned / retired + pinned); the `case-documents` half stays open with the
   `getReferralDocumentUrl` item. Noted inline there.

## Rotated from PROGRESS.md + follow-ups.md at the DM2 Record step (2026-08-13)

Three DM1-handoff follow-ups, all DISCHARGED by DM2. Out of both live files per the
lead-playbook §5 discipline. Each discharge was verified independently, not accepted
from a report: DISPOSE from the live `pg_proc.prosrc`; E2E from the restored (and since
strengthened) M8 assertion; CEILING from the S1 catalog probes + the S4 AC-4a–d/AC-9
restoration.

- 🟢 **FUP-DM1-CEILING** — **DB HALF DISCHARGED 2026-08-13 by DM2·S1** (`5dbeb76`; migrations `20260924000100`+`…000200`, ADR [0117](../decisions/0117-dm2-s1-confidentiality-ceiling-decisions.md), record [dm2-orchestration-wave-a.md](../progress/dm2-orchestration-wave-a.md)). The ceiling is live and **lead-verified against the catalog, not from the report**: on one case with one reader, label as the sole variable → plain `t` / `legal_privileged` `f` while `can_read_case` stays `t`, so the denial is the ceiling and not lost home access; the seam guard admits `ethics_investigation` on a meeting home and refuses `legal_privileged` (HC0D6, pt-BR). **Remaining to close:** pgTAP `228` **t40** + the two open-door pins (S1-O1) ride S2's `open_document_version`, and E2E **AC-4a–d / AC-9** ride S4. — **RULED 2026-08-13 (ADR [0114](../decisions/0114-document-model-redesign.md) Amendment 1 D15/D16)**: option 1 — re-express the ADR 0072 D7 ceiling as a nullable confidentiality column on `documents` + a `can_read_document` kernel arm, **interim**; the general access plane is **scheduled at Phase 19** (landing point `documents.access_policy_id`). No longer a blocker — now a **DM2 Wave A PREREQUISITE** (build before Wave A re-points any document). Option 3 rejected. Discharge = D15 shipped + pgTAP `228` t36–40 and E2E AC-4a–d/AC-9 restored as an ADR 0114 amendment — PO/lead → [body](../progress/follow-ups.md)
- 🟢 **FUP-DM1-E2E** — ✅ **DISCHARGED 2026-08-13 by DM2·S4** (parking done 2026-08-12; rewrite done at S4). All 6+1 attachment-touching specs/blocks rewritten against the document model per ADR 0114 D5 (rewritten, never merely deleted). **Lead-verified at the source, not from the S4 report** (QA r1 MINOR-6 was that this row contradicted the S2/S4 rows it should agree with): the M8 bytes-cut assertion is live in `e2e/quality-oversight.spec.ts` and was since **strengthened past its original form** — it now calls `open_document_version` directly via REST rather than asserting the download button's absence (QA r1 P0-1; `56e3989`). ⚠ One residue, routed to tester: that file's **header comment at `:39` still reads `⛔ PARKED`** while the assertion below it is restored — the repo's own "a comment is an assertion that goes stale silently" class. — tester + DM2 ✅ → [body](../progress/follow-ups.md)
- 🟢 **FUP-DM1-DISPOSE** — ✅ **DISCHARGED 2026-08-13 by DM2·S2**: `dispose_case_phi` carries its case-homed-document arm again (the DM1 substrate drop had cost it the attachment-redaction step — a PHI erasure path losing a step; no-op at the time, zero rows carried bytes). **Lead-verified from the live catalog** (`pg_proc.prosrc`, per the standing catalog-over-migration-text rule), not from a commit message. Discharged **before** Wave A's flags flip, as required — backend ✅ → [body](../progress/follow-ups.md)


<!-- Bodies rotated from follow-ups.md at the DM2 Record step (2026-08-13):
     FUP-DM1-CEILING, FUP-DM1-E2E, FUP-DM1-DISPOSE - all discharged by DM2. -->

### 🟠 FUP-DM1-CEILING — **RULED 2026-08-13**; now a **DM2 Wave A PREREQUISITE**, no longer a blocker (owner: backend @ DM2; filed by backend, upgraded by lead 2026-08-12, ruled by PO 2026-08-13)

> **PO ruling — option 1, recorded as [ADR 0114](../decisions/0114-document-model-redesign.md)
> Amendment 1 (D15/D16).** **D15:** re-express the ceiling on `documents` — a nullable
> confidentiality column + an arm in the `app.can_read_document` kernel — as an explicit
> **interim**. **Build it BEFORE Wave A re-points any case / meeting / interview document**;
> that is the phase in which a formerly gated document would otherwise silently become
> readable by every ordinary case reader. Deliberately **not** built in DM1 (a new migration
> would have reopened a closed gate). **D16:** the general access plane is **scheduled at
> Phase 19** (Surveyor Access), must cover **both** widening and narrowing, and absorbs D15's
> column; `documents.access_policy_id` is its declared landing point. Option 3 (ratify the
> loss) was **rejected**. **Discharge:** D15 shipped + the parked pgTAP `228` t36–40 and the
> AC-4a–d / AC-9 E2E contracts restored. The analysis below is the record of why.

Escalated out of the DM1 triage (228 tests 36–40) and **upgraded by the lead
from "retired coverage" to a blocking design input**: it is not a coverage
loss, it is an authorization control with no home in the replacement substrate.

**The control.** ADR **0072 D7 / ETH·E1** made `legal_privileged` +
`credentialing_sensitive` **ENFORCING** per-document ceilings: a document so
labeled is gated ABOVE ordinary case-read (clearance via
`case_access_grants.max_confidentiality`), while `ethics_investigation`
documents stay visible to ordinary case readers (the O2 pair). DM1 dropped its
enforcement mechanism — `app.attachment_confidentiality_ok` + the label column
+ the `HC0E6` open-door arm — with the substrate (ADR 0116 §10).

**Why the new model cannot express it (each verified against the catalog
2026-08-12):**
- `documents` / `document_versions` / `document_version_files` /
  `file_objects` carry NO label column; the only sensitivity axis is
  `file_objects.sensitivity_tier (standard|phi)`, which **selects a BUCKET —
  it is not an access ceiling**.
- ADR 0114 **D6 defers the audience plane as a WIDENING feature**
  (share-with-user/group). This control **narrows below** home-resource
  access — a different plane; D6's deferral does not cover it.
- **ADR 0114 does not supersede ADR 0072**, so the D7 control is still the
  ruled state of the platform.

**The live contract that encodes it:** `e2e/ethics-e1-access-spine.spec.ts`
**AC-4a/b/c/d** (two documents on the SAME ethics case; an ordinary case
reader sees one and is denied the other) and **AC-9** (a keyboard-only path to
the privileged one) — currently parked under FUP-DM1-E2E; plus the five
retired pgTAP pins (228 tests 36–40: absent-from-list / refused-open /
O2-stays-visible / clearance-admits-list / clearance-admits-open).

**Why DM2, not later:** `cases.confidentiality_level` snapshots from the label
vocabulary, and Wave A (DM2) re-points case / meeting / interview documents.
If a wave re-points documents before this is resolved, a document that was
gated above case-read becomes readable by every ordinary case reader — **a
silent authorization regression introduced by a data-model migration.**
Current real-world risk is zero (flag off, zero bytes), which is exactly why
it would be easy to wave through.

**Discharge condition: a PO ruling recorded as an ADR 0114 amendment. Wave A
cannot start without it.** The ruling decides the ceiling's carrier in the
document model (or explicitly retires the D7 control, superseding 0072); the
implementation then restores all five pgTAP pins + AC-4/AC-9. 228's retired
block stays retired until the control exists — the coverage returns WITH it,
not before. Record only — the design is the PO/ADR decision, not backend's.

### 🟢 FUP-DM1-E2E — ✅ DISCHARGED 2026-08-13 (DM2·S4) — six (+1 found) attachment-touching E2E specs were PARKED by the DM1 substrate drop; DM2 rewrote them against the document model, never merely deleted them (owner: tester [park — ✅ done 2026-08-12] + frontend/backend [DM2 rewrite — ✅ done 2026-08-13])

Filed at DM1 build start (2026-08-12, lead condition 3). Migration `20260923000100`
dropped the centralized attachments substrate (ADR 0114 D5) and `seed.sql` no longer
enables the `attachments` flag nor seeds attachment fixtures, so every spec that
exercises the old attachment surface fails or asserts against removed fixtures.
**ADR 0114 D5 is binding here: attachment specs are REWRITTEN against the new module
in the same program (DM2 / Wave A) — a park with no named list is a deletion with
extra steps.**

**✅ Parking done 2026-08-12 (tester), verified by running every file to green on a
fresh `db reset` — chromium, dev server.** The original per-file sweep (static, never
run) got the *mechanism* right but the *boundary* wrong in three of six files, plus
missed one test entirely. Corrected list, each verified live:

1. **`e2e/phase-f2-attachments.spec.ts`** — parks ENTIRELY, as predicted (6/6 tests).
   Wrapped the whole file in `test.describe.skip(...)` naming this FUP + the discharge
   condition, body preserved verbatim for DM2's reference. **6 skipped, 0 run.**
2. **`e2e/ethics-e1-access-spine.spec.ts`** — as predicted: AC-4a/b, AC-4c/d, and AC-9
   each call the dropped `open_attachment` RPC against the removed seed fixtures
   (`a7000000-…e1`/`…e2`), individually `test.skip(true, …)`'d in-body. The rest of
   the spine stands. **10 passed, 4 skipped** (the 3 above + the pre-existing AC-6
   skip) — matches the file's own 14-test count exactly.
3. **`e2e/quality-oversight.spec.ts`** — CORRECTED MECHANISM, same two sites. Playwright
   cannot skip mid-test, and the "Baixar Prescrição digitalizada" assertions sit inside
   two otherwise-standing tests ("content renders…" and "no-lockout control…") that
   cover unrelated write-affordance/sidebar/interview-omission contracts.
   ⚠ **CORRECTED at QA r1 (MINOR-3): the four assertions were DELETED, not "preserved
   as a comment"** as this item first claimed — the file's `expect()` count went
   137→133 and zero commented-out expects remain (verified against the file
   2026-08-13); what was preserved is the inline FUP-DM1-E2E annotations at both
   sites + the corrected header "Ground truth" doc-comment. **The four carried the
   M8 BYTES-CUT security contract** (the reviewer sees the doc title but the audited
   download door renders for `canDownload` only / absent otherwise) — that contract
   is now a NAMED DM2 obligation (dm1-substrate-cutover.md §obligations, item 2),
   so its disappearance is tracked, not silent. **21/21 passed**, both host tests
   intact for everything else they assert.
4. **`e2e/phase11-interviews.spec.ts`** — CORRECTED BOUNDARY + ONE MISSED TEST.
   - IV2-4: the FUP predicted "FILE gone, LINK remains" — **wrong**, verified by running
     before parking. `attachments-panel.tsx` gates BOTH "Enviar anexo" (file) and
     "Adicionar gravação" (link) behind the SAME `attachmentsEnabled()` flag
     (`canEditNow = canEdit && flagOn`), and seed.sql now leaves that flag OFF by
     default — so neither write control renders, not just the file one. Commented out
     the whole "attachments stay manageable" assertion pair.
   - IV2-11 — **NOT in the original list.** Its trailing "UI: MIME rejection on upload"
     block also clicks "Enviar anexo" and hung to the 30s test timeout (same flag gate).
     HC021 / the non-https-link CHECK / HC038 / HC0B0 earlier in the same test are
     unrelated and stand — only the MIME-rejection sub-block parked.
   Both test titles annotated inline. **13/13 passed.**
5. **`e2e/cases-extras.spec.ts`** — CORRECTED SCOPE. The FUP framed this as "the
   download assertion… parks with the panel dark" — **wrong**, verified by running
   before parking: the "Anexar" UPLOAD TRIGGER itself is gated by
   `canWriteNow = canWrite && attachmentsEnabled()` (`case-documents-panel.tsx`), so
   the click on "Anexar" hangs to the 120s test timeout — the whole upload→list→
   download flow parks, not just the download button. The test's separate "add a
   free-text event" half is unrelated and stands. **8/8 passed** (fresh reset; a
   same-run-twice collision on the event title during my own iterative re-runs was
   NOT a DM1 regression — the "Reunião de revisão E2E" title has no per-run
   uniqueness suffix, unlike the F2 tests' `Date.now()` pattern; confirmed clean on a
   single fresh-reset run).
6. **`e2e/meeting-audio-minutes.spec.ts`** — confirmed NO park needed, as predicted.
   Its only reference is a comment (L124); no live dependency on the dropped
   substrate. **10/10 passed** on a fresh reset. (BUG-MIN-E2E-1, flagged as a
   possible pre-existing red to expect in this suite, did NOT reproduce — it was
   already closed 2026-08-12, before this parking task, as a stale `.env.local`
   `MINUTES_SERVICE_URL`, not a product defect; see the Bug Log archive.)

Both `path`/`fs` imports in `phase11-interviews.spec.ts` and `cases-extras.spec.ts`
were dropped where the parked blocks were their only remaining live use (kept the
import list green, noted inline).

**Discharge condition (unchanged):** DM2 (Wave A) lands rewritten specs covering the
same contracts on the document model AND un-parks/restores the parked
tests/assertion-blocks in the same change, with the corrected list above checked off
item by item — including the IV2-11 MIME-rejection block this FUP's original filing
missed. The DM1 phase gate runs the suite with these parked per the mechanism used
(whole-file `test.describe.skip` for file 1; per-test `test.skip(true, …)` for file 2;
commented-out assertion blocks with inline FUP-DM1-E2E annotations for files 3–5,
since Playwright has no mid-test skip), not silently red.

### 🟢 FUP-DM1-DISPOSE — ✅ DISCHARGED 2026-08-13 (DM2·S2) — `dispose_case_phi` lost its attachment-redaction step in DM1; DM2 wired case PHI erasure to document disposition, verified present in the live `pg_proc.prosrc` (owner: backend, DM2)

Filed at DM1 build start (2026-08-12, lead condition 3). Migration `20260923000100`
removed the F2 SEAM block from `public.dispose_case_phi` (it redacted
title/description and stamped `phi_disposed_*` on live case-owned `attachments`
rows) because the substrate it wrote to was dropped. **This is a PHI erasure path
(LGPD Art. 18, ADR 0035/0038) losing a step.** It is a no-op TODAY — zero attachment
rows carried bytes anywhere (production census 2026-08-11; the flag has been OFF
since D1) — but it stops being a no-op the moment Wave A creates case-homed
documents.

**Discharge condition (DM2 / Wave A, before its flag flips ON):**
`dispose_case_phi` triggers document disposition (ADR 0114 D10: fail-closed reads →
verified byte deletion → `disposed`) — or the documented equivalent — for every
document homed on the disposed case, WITH a keystone asserting it (a case with a
live document → dispose → `open_document_version` refuses + bytes verified absent),
mutation-proven per authz-handoff §7.1. The in-body comment at `dispose_case_phi`
(f) names this FUP; ADR 0116 records the decision.


## Index lines rotated from PROGRESS.md 2026-08-18 (live-state restructure)

> The 14 fully-resolved index lines below left `PROGRESS.md § Follow-ups` on
> 2026-08-18 — under the new contract a resolved entry leaves the live file at the
> Record step that resolves it (enforced by `npm run lint:progress`). Moved verbatim
> except the mechanical link transform for this directory (`](docs/progress/` → `](`,
> `](docs/{decisions,plans,reviews}/` → `](../{decisions,plans,reviews}/`).
> ⚠ **Their full bodies remain in [follow-ups.md](follow-ups.md) for now** — body
> rotation out of that file is a separate, later pass; this section is the index of
> record for the resolved set. Derived by property (every `- ⬛` line, all 14
> containing RESOLVED/CLOSED), not by hand-listing.

- ⬛ **FUP-DM5-BACKEND-STATE-SLICE-SECTIONS** — ✅ **✅ RESOLVED 2026-08-18 (backend). The four `##` sections (`DM5·S5` · `DM5·S4` · `DM5·S3` · `DM5·S2`) — S4 added the same day on the PO's ruling, so the scope is wider than the item's title…** — backend
- ⬛ **FUP-DM5-BYTE-PROOF-NOT-ATTEMPTED** — ✅ **✅ RESOLVED 2026-08-18 (`src/lib/documents/actions.ts`): the one lane that deletes bytes now declares `'unavailable_on_platform'` instead of riding the DEFAULT. ⭐ The pin was PROVEN ABLE TO…** — backend
- ⬛ **FUP-DM5-ATTACHMENTS-MODULE-SURVIVED-RETIREMENT** — ✅ **✅ RESOLVED 2026-08-18: `src/lib/attachments/actions.ts` DELETED (6 dead exports, zero importers) and the stale `openAttachment` reference in `queries/case-documents.ts` repointed to the…** — frontend + backend
- ⬛ **FUP-QOB-3** — ✅ RESOLVED 2026-08-09 (PO): `dispose_event_phi` KEEPS its tenancy arm and referral disposal gets the same backstop back. ⚠ This line sat 🔴 OPEN for six days describing a gap already ruled — PO
- ⬛ **FUP-DM4-RECUSAL** — ✅ **✅ RESOLVED 2026-08-17 (`32054942`, `20260928000100`, ADR 0122): a `can_read_case` arm above the `p_kind` dispatch, covering both arms; `340` 76→82 red-first. ✅✅ AND NOW LIVE ON THE REMOTE — **
- ⬛ **FUP-DM5-342-PLAN-COMMENT** — ✅ RESOLVED 2026-08-17 (`24cee179`); ⭐ the itemisation **already summed to 59** — only the leading total was stale, so the comment disagreed with *itself* — backend
- ⬛ **FUP-DM5-330-WRITE-BLIND** — ✅ RESOLVED 2026-08-17 (`67cac33b`), `330` 57→62. ⭐ Closed **on its own terms**: blindness re-derived from the live catalog and still real — **not** closed on `342`'s coverage, as the item's warning forbade — backend
- ⬛ **FUP-DM5-FINALIZE-ATOMIC** — ✅ RESOLVED 2026-08-17 (`20260928000500`): bytes + evidence row commit in ONE transaction; `341` 57→67. ⭐ **The obvious keystone was VACUOUS** — one RPC call is one transaction, so any raise rolls back whatever the check order is — backend/lead
- ⬛ **FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT** — ✅ **CLOSED 2026-08-18** (`20260928000800`, ADR [0123](../decisions/0123-discarding-a-draft-that-has-emitted-documents.md)): guard widened to `superseded` (D1) + the mint KEY-SHARE-locks its source (D3, race **measured**); both remainders answered by D4 (orphans = 0, measured both envs) and D5 (the securable is the disposition anchor — **deleting it is the defect**). `312` 80→85, red-first — backend
- ⬛ **FUP-DM5-DEAD-CORE-PROJECTION** — ✅ RESOLVED 2026-08-17 (`24cee179`) by DELETION; verified at every **import site**, not by grepping the symbol — frontend/backend
- ⬛ **FUP-DM5-GRANTS** — ✅ CLOSED 2026-08-17 (`20260928000200`): direct write revoked, the RPCs are now the only writers; `341` 53→57. ⭐ **The fix would have made TWO P0 policies silently BLIND** — `252` now restores the grant in its own rolled-back txn to keep them mutation-proven — backend
- ⬛ **FUP-DM5-DVF-FILEOBJ** — ✅ **✅ RESOLVED 2026-08-18 (`20260928000600`): `UNIQUE (file_object_id)` makes the 1:1 binding structural instead of a property of caller discipline; pgTAP `328` 128→130, red-first (K17b's…** — backend
- ⬛ **FUP-DM5-SETLOCAL-MIGRATION** — ✅ **RESOLVED 2026-08-18: the gate is BUILT + WIRED.** — backend
- ⬛ **FUP-AUTHZ-ALLOWLIST-ROT** — ✅ RESOLVED 2026-08-17 (`4102149b`): `ARM=floor` now anti-joins every allowlist signature against `pg_proc`. **Red-first — it found SIX stale entries where this item named one** — lead/backend

- ⬛ **FUP-DM5-CLOUD-ORPHAN-SURFACE** — ✅ **RESOLVED 2026-08-18 by measurement: Supabase Cloud exposes NO orphan-visible surface.** All 5 surfaces METADATA-BOUND (both S3 auth modes); the byte was proven still present in the same run, so no arm is vacuous. ⇒ ADR 0120 D9's byte-side controls are NOT recoverable on Cloud. Rotated from PROGRESS.md 2026-08-18. Body: [follow-ups.md](follow-ups.md) · run record: [cloud-orphan-probe-2026-08-18.md](cloud-orphan-probe-2026-08-18.md) — backend/lead
  <!-- prior PROGRESS.md index line, verbatim: - 🔴 **FUP-DM5-CLOUD-ORPHAN-SURFACE** — ⭕ **ESCALATED 2026-08-18: `FUP-DM4-PRODROW` NOW BLOCKS ON THIS PROBE (PO), and the probe has a REAL subject.** — backend/lead -->
### ⬛ FUP-DM5-DRAFT-PRINT-INVISIBLE-TO-COORDINATION — ✅ **RESOLVED 2026-08-19: the subject was removed, not the predicate widened (ADR 0126 D5)** — a print of an `in_progress` draft is visible to its CREATOR ONLY, and the minter can lose the only way out (owner: PO decision, then backend + frontend)

> ### ✅ RESOLVED 2026-08-19 — the prévia SHIPPED, and the defect is gone BY CONSTRUCTION.
>
> Closed by the ADR 0125/0126 build (branch `feat/previa-split-adr-0125-0126`, QA **APPROVED** r2 —
> [previa-split-review.md](../reviews/previa-split-review.md)). The mechanism this item described was that
> `can_view_printed_document`'s **`form_response` arm** grants its `staff_admin` term only at
> `status = 'submitted'`, so an `in_progress` draft's print was visible to `created_by` and nobody else.
>
> ⭐ **It closes by REMOVING THE SUBJECT, not by widening a predicate** (ADR 0126 **D5**): a draft no longer
> registers at all — `mint_printed_document` refuses it with **`HC0DP`**, DB-enforced, so there is no
> draft print to be invisible. The `list_printed_documents_for_governance` door was **not built**; nothing
> was widened; the reachable dead end (a minter who loses `staff_admin`, cannot discover the print, and is
> refused HC069 on discard) has no state to occur in.
>
> ⚠ Option 4 ("never mint from a draft") stays **refuted** as written — 0125 D2 keeps drafts **printable**;
> what changed is only whether that paper enters the registry.
>
> **The option list below is retained as the record of what was considered, not as work.**

> ## ⚠ (superseded — kept for the record) ANSWERED IN APPROACH 2026-08-18 — ADR [0125](../decisions/0125-previa-ephemeral-and-emission-registered.md). **NOT CLOSED.**
>
> The PO ruled the ADR 0123 **D7** product split: registration is **derived from source state at
> the lock point**, so a still-editable source yields an ephemeral unregistered prévia. Once no
> `in_progress` response registers, the **`form_response`** arm below always fires for every
> registered print — the predicate is correct **by construction**.
>
> ⚠ **Stated precisely, because the arm below is kind-specific.** ADR 0125 D1 registers meetings
> from `in_signature`, so it is **not** true that every registered print has a *final* source. It
> does not matter here: **measured**, `can_view_printed_document`'s **`meeting`** arm is
> `can_reach_meeting AND can_read_full_meeting_content` — **no `status` term at all** — so it never
> carried this defect, and an `in_signature` ata is visible to every member who can reach the
> meeting and read its full content.
>
> ⇒ **Option 1 is NOT built** (no `list_printed_documents_for_governance` door — it would have been
> a door with no subject), **option 2 is not needed** (no widening), **option 3 is not needed** (the
> dead end disappears: drafts have no prints, so the discard always succeeds). Option 4 stays
> refuted — 0125 keeps drafts **printable**, it changes only whether the paper enters the registry.
>
> ⛔ **Closes only when the prévia ships** (`FUP-PREVIA-SPLIT-BUILD`). Until then the defect below
> is live exactly as described, and the option list is retained as the record of what was
> considered — not as work.

Filed 2026-08-18 (lead) while closing `FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT` (ADR
[0123](../decisions/0123-discarding-a-draft-that-has-emitted-documents.md) **D6**). **Measured from
the live catalog and from every UI mount, not reasoned.** No deletion is involved — this is live
today, with the source response perfectly alive.

**The mechanism.** `app.can_view_printed_document`'s `form_response` arm grants its `staff_admin`
term only when `v_resp.status = 'submitted'`:

```
return v_resp.created_by = p_uid
    or (v_resp.status = 'submitted' and app.is_staff_admin_of_for(v_resp.commission_id, p_uid))
    or app.can_read_correction_response(...) or app.can_access_targeted_response(...)
```

That same predicate **is** the whole of the `printed_documents_select` policy (verified: it is the
table's only policy), and `listPrintedDocuments` is a plain table read under it. So for an
`in_progress` draft, **`created_by = p_uid` is the only arm that can fire** — the print is invisible
to every other coordinator, to `org_admin`, and to `platform_admin`.

**Why it is not merely cosmetic.** `revoke_printed_document` authorizes on
`is_staff_admin_of_for(v_row.commission_id, …) or is_tenancy_admin_of_for(…)` — it does **not**
consult source visibility. So a coordinator **may** revoke a draft print; they simply have no way to
**discover** its `id`. Authority without discovery is a door with no handle.

**The reachable dead end.** The only UI mount that renders the print panel for an `in_progress`
response is `…/dashboard/submissions/[responseId]`, gated `access.role === "staff_admin"`
(`watermark={isSubmitted ? "final" : "draft"}`); the respondent's own `…/respostas/[responseId]`
**redirects a draft back into the wizard**, and the wizard mounts no panel. So exactly one persona can
mint a draft print through the product: **a `staff_admin` who is the creator** — who can also revoke,
so they are fine. ⭐ **But if that person later loses `staff_admin`**, they keep the `created_by` mint
arm and lose revoke, no other coordinator can see the print, and `HC069` now refuses their discard
**with no in-product way out**. Same shape for a print minted by direct RPC call by a plain `staff`
creator, whom the door permits and the UI merely does not offer.

**Options** (PO picks; ⚠ the option list is an assertion too — re-derive before ruling, this item's
predecessor was withdrawn for exactly that):

1. ⭐ **A read-only governance registry door** — `list_printed_documents_for_governance(commission_id,
   …)`, `SECURITY DEFINER`, authorized with the **same** coordinator predicate `revoke`/the kernel
   write arm already use, returning zero-PHI metadata plus a derived `source_exists`. ⛔ **Must NOT**
   widen `app.can_view_printed_document` (mint/open read it, and it means *current source
   visibility*), and **must NOT** add a permissive `printed_documents` policy — permissive policies
   `OR` together, so that would make source panels show documents whose sources the viewer cannot
   read. ⚠ Needs a UI caller in the same slice or it is a [[correct-door-that-nothing-can-reach]];
   and per ADR 0079 Am. 3/7 a brand-new gate passes `ARM=policy` **vacuously**, so `ARM=census` is the
   arm that must see it — plus the explicit ACL (`20260928000700` shipped a DEFINER function with
   default **PUBLIC EXECUTE**, caught only by the `320` U1 census with `312` fully green).
2. **Widen the `staff_admin` arm to drafts.** One-line, but it widens *content* sight of unfinished
   drafts as a side effect — the Phase-7 invariant deliberately hides a foreign member's `in_progress`
   response, and this predicate is a **parity mirror** of the `responses` read policies, not an
   improvement on them. A widening cannot be wrong-and-safe.
3. **"Solicitar anulação"** — a creator-initiated request that notifies coordination with the
   registry id. Solves the dead end without widening any read, but adds a workflow.
4. **Never mint from a draft** — ⛔ **refuted**: reverses ADR 0104 **D7**, which is exactly how this
   item's predecessor got withdrawn. `312` t6/t43 pin draft prints by name.

⚠ Interacts with the product split deferred by ADR 0123 **D7** (`Imprimir prévia`, ephemeral and
unregistered, vs `Emitir documento`): if previews stop entering the registry, options 1 and 3 shrink
to the rare case. Rule D7 first, or knowingly build for both.

### ⬛ FUP-PREVIA-SPLIT-BUILD — ✅ **RESOLVED 2026-08-19: shipped, QA APPROVED r2** — build ADR 0125: the ephemeral `Imprimir prévia` / registered `Emitir documento` split (owner: backend + frontend)

> ### ✅ RESOLVED 2026-08-19 — SHIPPED. QA **APPROVED** (r2) — [previa-split-review.md](../reviews/previa-split-review.md).
>
> Branch `feat/previa-split-adr-0125-0126`, 22 commits. Gate on a fresh reset: pgTAP **197f/6520** · seven
> lint gates · `tsc` · vitest **1447** · E2E **20/20** (six corridor cases, zero-leftover query) · **all four
> authz ARMs HOLD** · full 51-door row sweep · **12 new `prosecdef` gates**, catalog-confirmed, none an
> INVOKER wrapper.
>
> **Every scope item landed**, plus ADR 0126's round-2 core (`meetings.revision`, the per-kind HEAD dispatch,
> the void conjunct, `guard_meeting_active_print`, derived currency, `/verificar`'s third term).
>
> ⭐ **Three live defects were found and fixed that this item never anticipated**, each invisible to a green
> suite and each found by reading the **caller**, not the door:
> 1. **Re-minting a reopened ata was impossible through the UI** — the action never passed
>    `p_source_revision`, so it defaulted to `0` and the door raised `HC0DU`. That is precisely the corridor
>    ADR 0126 **D9** exists to support.
> 2. **A locked source could be served as a prévia** — the route derived the affordance correctly and the
>    **door had no registration term at all** (Architecture Rule 1). Fixed DB-side as `HC0DV`.
> 3. **The panel promised a permanent verifiable record** directly above the prévia link.
>
> ⭐ **The lesson this build earned, and the one worth carrying:** *a keystone proves the DOOR works and says
> nothing about whether the ACTION can reach it — the test is a SECOND CALLER, and a second caller can
> satisfy a door the real one cannot even open.*
>
> **Residue, carried NOT inherited:** the commission-level cascade path (0125's residual pair; its sibling is
> closed by measurement, 0125 Amendment 1 §C) stays open, and `case`/`interview`'s lock/watermark/series
> declarations remain deferred to provider activation (0126 D7). Five follow-ups filed during the build, none
> of them this item's subject: `FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE` (🔴, blocks C1a/C1b),
> `FUP-42501-CONFLATES-GRANT-WITH-RLS`, `FUP-SUPERSESSION-BADGE-LANE-BLIND`,
> `FUP-E2E-SUBMITTED-POOL-UNSCOPED`, `FUP-PREVIA-MINT-FLAG-ASYMMETRY`.
>
> **The scope list below is retained as the build record.**

Filed 2026-08-18 (lead) on the PO ruling of ADR
[0125](../decisions/0125-previa-ephemeral-and-emission-registered.md), which discharges ADR 0123
**D7** and amends ADR 0104 **D7** item 4. The nine decisions are in the ADR; this item carries the
**build**, and specifically the two pieces that are easy to ship green while asserting nothing.

**⭐ Measured 2026-08-18, before any code — two findings that shape the build.**

**(a) Registration is DB-enforced, not app-layer convention.** D7's *"HC069 becomes structurally
unreachable"* is only STRUCTURAL if `mint_printed_document` itself refuses a non-locked source; if
only the server action refused, a direct RPC call would still construct the state. Three independent
anchors agree: D7's own wording, D2 rewriting `t43` (which pins that a draft mint SUCCEEDS), and this
item's instruction to rebuild §9 by inserting a `printed_documents` row **"bypassing the mint"** —
you only bypass a door that would otherwise refuse.

**(b) ⛔ But the gate MUST NOT go inside that door as a fourth kind-conditional site.** Measured from
the live catalog — `mint_printed_document` carries this in its own body:

> ⚠ the REGISTRATION-MIRROR TRIO, site 3 of exactly 3 (template coherence · commission resolution ·
> PHI capability). **A FOURTH kind-conditional site in this door is the abstraction-leak signal —
> stop and re-plan, never extend.**

⇒ The lock predicate lands as a **separate kind-dispatch** with its own per-kind CASE and fail-closed
ELSE (mirroring `app.can_view_printed_document`'s shape), which the door then calls **once,
kind-agnostically**. That satisfies the trio constraint and **D8** ("every kind MUST declare TWO
predicates") in the same move — the constraint and the ADR want the same structure. Error code
`HC0DP` is free (`HC0D1-4`, `HC0D6-9`, `HC0DA-N`, `HC0DR`, `HC0DS` are taken).

⚠ The new dispatch is a **brand-new gate**, so per ADR 0079 Amendment 3 it passes `ARM=policy`
**vacuously** — `ARM=census` is the arm that must see it — and it enters the catalog with a NULL
`proacl`, which is the DEFAULT and includes PUBLIC (the class that shipped live in `20260928000700`).
Explicit REVOKE/GRANT, diffed **from the catalog**.

**Scope, in dependency order.**

1. **The render path** (D4) — HTML → Gotenberg → buffer → **response stream**. The `.upload()` and
   the `mint_printed_document` RPC are simply not called. ⛔ **No temporary object at any point** —
   a "temp upload, delete after" variant is rejected by name in the ADR.
2. **The prévia footer primitive** (D5) — sibling to
   [`qr-footer.ts`](../../src/lib/pdf/primitives/qr-footer.ts), which today renders the QR, the
   `código` **and** `Emitido em … por …` as one block, so dropping the QR drops provenance with it.
   ⛔ The verb **`Emitido` must not appear** on an unregistered page.
3. **The action split** (D1) — ⚠ **TWO predicates, and only one of them already exists.** For
   `form_response` the discriminator is `status = 'submitted'`, which is also the watermark's. For
   `meeting` it is a **NEW** predicate, `status in ('in_signature','signed','distributed')`, which
   is **neither** `meetingWatermarkFor` (that stays `signed|distributed` — **do not change it**;
   an `in_signature` ata registers stamped RASCUNHO on purpose) **nor** the lock set
   (`cancelled` is locked but excluded by decision). Write it as its own pure, client-importable
   function **beside** `meetingWatermarkFor` — overloading the existing one silently couples the
   two axes back together, which is the thing D1 separates. The dialog already previews the mark,
   so the button label follows the same shape.
   ⚠ **Round 2 supersedes the `form_response` half of this item:** the discriminator is the
   **three-conjunct** predicate (0126 D5 + D10) and the watermark refines **in tandem** (0125
   Amendment 2) — `submitted` alone is neither axis, and both now read
   `case_correction_requests` + `case_phases`. `meetingWatermarkFor` still unchanged.
4. **The audit row** (D3) — the prévia emits its own `app.audit_write`, actor + timestamp + source
   + template, no payload. ⭐ **The only half that cannot be added retroactively.**
5. **Contention** (D9) — same `mintSemaphore`, unchanged at 3 permits; the prévia acquires with a
   materially shorter wait so it is the one that loses under load.
6. **Round 2 core (0126 D8–D10)** — `meetings.revision` (bumped only by `reopen_meeting`) + the
   per-kind HEAD dispatch (`form_response`: approved-successor; `meeting`: revision match) + the
   third registration conjunct (attached phase not `voided`) + the tandem watermark (0125
   Amendment 2). The predicate/watermark read set now spans `case_correction_requests` +
   `case_phases` — their writers are swept per 0126's standing method rule.
7. **`guard_meeting_active_print`** (0126 D11) — BEFORE DELETE symmetric of
   `guard_response_active_print`, with the t76/t80-shaped differential keystone (print revoked ⇒
   the same delete succeeds). New gate ⇒ the same `ARM=census` + explicit-ACL discipline as the
   dispatch above.
8. **Currency + `/verificar`** (0126 D2/D4/D12) — derived at read, two-sided keystones per
   conjunct incl. the D9 round-trip and D10 void corridors; the widened anon DEFINER door goes
   through the diff-scoped 0079 sweep; the `revoked` arm keeps its no-join independence.
   ⚠ The mint door is **compare-and-mint**: the predicate evaluates inside the RPC's transaction
   against render-time source state (TOCTOU — 0126 Consequences).

**⛔ The two things that will pass green having asserted nothing.**

- **`312` §9 goes VACUOUS** (t74/t76/t80 + the supersede block from line 764). Its fixture is *"mint
  from a draft, then discard it"*, and that state becomes **unconstructible**: measured,
  `guard_submitted_response` raises unconditionally on a submitted DELETE and the RLS policy is
  `responses_delete_own_draft`, so only drafts are deletable. Rebuild the block to **construct** the
  state at table level (insert `printed_documents` against a draft response directly, bypassing the
  mint). ⚠ **The differentials must survive the rewrite** — t76/t80's *"the same delete now
  SUCCEEDS"* is what stops the block being equally satisfied by a guard that blocks every draft
  delete. Also rewrite **t6** (line 198) and **t43** (line 447), which pin registered draft mints by
  name. → [[removing-a-subject-breaks-its-assertions-in-two-directions]]
- **No authz ARM covers the prévia route** (D6). Its authorization is inherited RLS and it is real —
  verified in the modules, not the comment: `queries/responses.ts` and `queries/meetings.ts` use
  `createClient()` throughout, so a caller who cannot read the source cannot build the payload. But
  an app-layer route with no `prosecdef` gate is in **no arm's domain** (the ADR 0079 Am. 7 shape),
  so nothing goes red if a future edit swaps one of those queries to the admin client. Ships with a
  **behavioural** keystone — a principal who cannot read the source is refused a prévia — not an arm.

- **The fourth cell must be proven unreachable** (D5). The two axes give four combinations and
  three are legal; **FINAL + prévia footer** must not exist — a page the platform disclaims whose
  source is immutable. It is unreachable *by construction* under D1, which is exactly the shape
  that rots silently: nothing fails if a later edit makes it reachable. Pin it, don't reason it.

**Also in scope:** `pdf-printing-meetings.spec.ts` T2 (mints from a `held` meeting, asserts
RASCUNHO) stays a **prévia** — `held` is not locked — but needs a **new sibling** covering the
`in_signature` → **registered RASCUNHO** case, which is where the two axes visibly separate: QR
footer present, diagonal mark still RASCUNHO. Add one for the supersession chain too (mint at
`in_signature`, re-mint at `signed`, first flips `SUBSTITUÍDO`) — that chain is the ADR's stated
accreditation answer and nothing pins it today. Keep the RASCUNHO variants in
`fingerprint.test.ts`. **No data migration** — production holds `0` prints (measured, ADR 0123 D4)
and local resets.

**Open question carried here — round 2 resolved most of it:** the original "meetings need no
`guard_response_active_print` analogue" rested on *lock set ⊇ registering set*, which was **FALSE**
(`reopen_meeting` exits the refusal set — 0125 Amendment 1 §B); today's real anchor is the mint's
own `documents` row → `securable_resources` **RESTRICT**, owned by the disposal-bound documents
domain, and **0126 D11 orders `guard_meeting_active_print` + keystone** (scope item 7). Of the two
residual paths: delete-inside-a-meeting-RPC is **CLOSED by measurement** (0125 Amendment 1 §C —
filter `prokind = 'f'` when sweeping, or the aggregate throw reads as a clean result); the
**commission-level cascade is still OPEN** and stays carried here, uninherited.

**Not in scope:** the **lock and watermark predicates** for `case` / `interview` (ADR 0125 D8
binds the principle — both declared separately, not-locked ⇒ ephemeral — and defers each
predicate to that kind's provider activation).


### ⬛ Resolved — rotated 2026-08-19 (the ADR 0125/0126 prévia-split Record step)

- ⬛ **FUP-PREVIA-SPLIT-BUILD** — ✅ **RESOLVED 2026-08-19: SHIPPED, QA APPROVED r2** ([review](../reviews/previa-split-review.md)). Branch `feat/previa-split-adr-0125-0126`, 22 commits. Gate on a fresh reset: pgTAP 197f/6520 · seven lint gates · `tsc` · vitest 1447 · E2E 20/20 · all four authz ARMs HOLD · 12 new `prosecdef` gates, catalog-confirmed. ⭐ Three live defects fixed that this item never anticipated, each invisible to a green suite and each found by reading the CALLER: re-minting a reopened ata was impossible through the UI; a locked source could be served as a prévia (the door had no registration term at all — Architecture Rule 1); the panel promised a permanent verifiable record above the prévia link. **The lesson: a keystone proves the DOOR works and says nothing about whether the ACTION can reach it — the test is a SECOND CALLER.**
<!-- prior PROGRESS.md index line, verbatim: - 🟠 **FUP-PREVIA-SPLIT-BUILD** — 🔨 **IN BUILD 2026-08-18** (backend contract slice first): build ADR [0125](../decisions/0125-previa-ephemeral-and-emission-registered.md) (ephemeral prévia / registered emission). Nine decisions, each measured before ruling. Carries the `312` §9 + t6/t43 rewrite (the fixture goes unconstructible — vacuous-and-green if left alone) and the D6 **behavioural** keystone, because an app-layer route with no `prosecdef` gate is in **no authz ARM's domain** — backend/frontend -->
- ⬛ **FUP-DM5-DRAFT-PRINT-INVISIBLE-TO-COORDINATION** — ✅ **RESOLVED 2026-08-19 by ADR 0126 D5, which removes the SUBJECT rather than widening the predicate.** A draft no longer registers (`HC0DP`, DB-enforced), so there is no draft print to be invisible. The `list_printed_documents_for_governance` door was **not built**; nothing was widened; the reachable dead end (a minter who loses `staff_admin`, cannot discover the print, and is refused HC069 on discard) has no state to occur in. ⚠ Option 4 stays refuted — 0125 D2 keeps drafts printable; only registry entry changed.
<!-- prior PROGRESS.md index line, verbatim: - 🟠 **FUP-DM5-DRAFT-PRINT-INVISIBLE-TO-COORDINATION** — ⚠ **ANSWERED IN APPROACH 2026-08-18 by ADR [0125](../decisions/0125-previa-ephemeral-and-emission-registered.md) — NOT closed.** Once no `in_progress` response registers, `can_view_printed_document`'s **`form_response`** arm always fires for every registered print: correct **by construction**, with **no** `list_printed_documents_for_governance` door and **no** widening. ⚠ Not "every registered print has a final source" — 0125 D1 registers meetings from `in_signature`; it doesn't matter because the **`meeting`** arm is `can_reach_meeting AND can_read_full_meeting_content`, **no `status` term at all** (measured), so it never carried this defect. The reachable dead end (minter loses `staff_admin` → cannot discover the print → HC069 refuses the discard) disappears with it. **Closes only when the prévia ships** — backend/frontend -->

## ↩ Rotated from PROGRESS.md 2026-08-19 — two concluded provenance notes

> Both described a past compression pass. Four of the six ids the first note names no longer
> have index lines at all (resolved and rotated since), so it had already gone partly stale.
> The lesson both carry — an index line is the register, a body plus a narrative mention is
> not one — now lives in `.claude/rules/progress-contract.md`.

⚠ **Six lines below are NEW index entries, not new items** (2026-08-14): FUP-AUTHZ-HARNESS-TRANSACTIONAL ·
FUP-AUTHZ-ALLOWLIST-ROT · FUP-DM5-GRANTS · FUP-DM5-FINALIZE-ATOMIC · FUP-DM5-DVF-FILEOBJ ·
FUP-VACUOUS-COVERAGE-1 — each was OPEN but named **only** inside the DM5 phase section or a Bug Log
pointer, so compressing those would have dropped it from the index entirely.
⚠ **Two MORE lines added 2026-08-17 (phase QA R3), and the 2026-08-14 warning above was written and
then immediately re-earned — this time by the highest-severity item in the phase.** Both were
announced as new by the follow-up batch, given full bodies in `follow-ups.md`, and named repeatedly in
the phase narrative — **but neither ever got an index line**, so the next rotation would have dropped
them. ⭐ *A body plus a narrative mention is not an index entry; the index is what a reader greps.*

## Index line rotated from PROGRESS.md 2026-08-19

> One line, resolved the same day it left. Moved verbatim except for the state marker
> and the resolution clause; the item's full body remains in
> [follow-ups.md](follow-ups.md), consistent with the 2026-08-18 set above.

- ⬛ **FUP-DM5-NO-ANSWER-VS-NOTHING** — ✅ **CLOSED 2026-08-19 — all six instances. ⭐ THE CLASS: an observable PROXY is substituted for the property that actually matters, always failing in the REASSURING direction.** Last open instance (1, `--allow-orphans`) fixed by ADR [0128](../decisions/0128-unproven-is-not-clean-capture-outcome-classes.md): unproven (exit 3) and dirty (exit 1) are separate classes with separate acknowledgements, **dirty outranks unproven**, and the retired flag is refused rather than aliased. Instance 3 discharged by ADR 0121 D4 **plus the 2026-08-18 Cloud probe**, which made `unavailable_on_platform` the true and permanent value rather than a holding one. ⛔ Closing the CONFLATION is not a claim that Cloud orphans are absent — they are **unobservable**, which is the opposite of reassuring — backend/lead

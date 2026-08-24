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

- ⬛ **FUP-DM5-BACKUP-IS-PHI-EXPORT** — ✅ **RESOLVED 2026-08-19 by EXECUTION** — a Storage backup is an unmanaged plaintext PHI export, and the S5 drill created one (245 files, 68 PHI-tier, no RLS, no audited door, no TTL). The widest PHI egress path the system has. Both remaining deliverables discharged: **destination path set** (archive `D:\phi-backups`, key `C:\Users\micha\phi-backup-keys` — separate volume) and the **§ 6b procedure executed end-to-end** on the local stack (census 812/14,691,282/231 PHI-tier → encrypted at creation → catalog-compared **812 = 812** + per-object hash → key-first destruction; the empty-archive control proven able to refuse). Record: [phi-backup-run-log.md](../deployment/phi-backup-run-log.md). ⛔ **Does NOT discharge C1a or C1b** — § 3 was not run, and the mechanism has **no Cloud form**. Residue carried by two NEW items, not dropped: 🔴 `FUP-DM5-BACKUP-HAS-NO-CLOUD-FORM` · 🟠 `FUP-DM5-DB-DUMP-AND-SCRATCH-DB-UNGOVERNED` — PO/backend/lead
- ⬛ **FUP-DM5-NO-ANSWER-VS-NOTHING** — ✅ **CLOSED 2026-08-19 — all six instances. ⭐ THE CLASS: an observable PROXY is substituted for the property that actually matters, always failing in the REASSURING direction.** Last open instance (1, `--allow-orphans`) fixed by ADR [0128](../decisions/0128-unproven-is-not-clean-capture-outcome-classes.md): unproven (exit 3) and dirty (exit 1) are separate classes with separate acknowledgements, **dirty outranks unproven**, and the retired flag is refused rather than aliased. Instance 3 discharged by ADR 0121 D4 **plus the 2026-08-18 Cloud probe**, which made `unavailable_on_platform` the true and permanent value rather than a holding one. ⛔ Closing the CONFLATION is not a claim that Cloud orphans are absent — they are **unobservable**, which is the opposite of reassuring — backend/lead

## Rotated from follow-ups.md 2026-08-19 — the ADR 0129 child-lock fix (DSR plan Slice 1)

### ⬛ FUP-DISPOSAL-CHILD-LOCK-BLOCKS-PHI-ERASURE — ✅ **RESOLVED 2026-08-19** — `dispose_meeting_minutes` could not complete on any locked meeting that had agenda items; its own "bypass the freeze guards" comment was FALSE (owner: backend + PO; ⛔ its **"blocks C1a/C1b"** claim was WRONG IN GRAIN — see the correction below; Rule 12 / LGPD Art. 18)

> ## ⛔ CORRECTION 2026-08-19 — the "blocks Critical FUP C1a/C1b" claim in the preserved body below is FALSE, and it failed in the reassuring direction
>
> The body states *"It blocks Critical FUP C1a/C1b directly"*. Measured at build time: **it does
> not.** C1a is a run of [`phi-disposal-runbook.md`](../deployment/phi-disposal-runbook.md), which
> is the **`file_objects` / Storage-bytes** completion mechanism — its § 0 says it exists because
> `complete_document_disposal` has no automated caller. The two paths are **disjoint in the
> catalog**: `dispose_meeting_minutes` writes no `file_objects` row and never sets
> `disposal_pending`; `complete_document_disposal` never touches meetings; the runbook contains
> **zero** occurrences of "meeting", "minutes_md", or `dispose_meeting_minutes`.
>
> The *defect* was real and severe — meeting-minutes PHI erasure was impossible on exactly the
> population that carries PHI. Only its **consequence** was overstated. ⭐ The body's own reasoning
> shows how: it argues that "a rehearsal that only ever exercises agenda-less meetings would go
> green while proving nothing" — true of a rehearsal that exercises meetings, and **the runbook
> exercises none**. A real filter cited for a conclusion it does not bound reads like a proof:
> [[a-predicate-quoted-at-the-wrong-grain]]. It propagated into ADR 0121, the backup run log, the
> runbook, PROGRESS.md § Now and the C1 row, and was corrected in all of them the same day.
>
> ⭐ The correction exposed the larger gap: `FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES` — the runbook
> covers one of **two** PHI-disposal substrates, and the four column-erasing `dispose_*` doors have
> no operational procedure at all.

> ## ✅ RESOLVED 2026-08-19 — built as DSR plan **Slice 1**; this block supersedes every status line in the preserved body below
>
> **Shape 2, as ruled.** Migration
> `20260930000100_disposal_flag_through_meeting_child_lock.sql`: the new transaction-local GUC
> `app.in_disposal_rpc` is **set only** by `dispose_meeting_minutes` (immediately before its child
> UPDATE, reset immediately after) and **read only** by `app.guard_meeting_child_lock`. The false
> comment is corrected in the same migration; ADR 0126 §E was amended in the same change (ADR 0129
> Decision 3), and §F's "not fixed here" note now points at the fix.
>
> **Evidence — the fixture the item demanded, and the differential.** Suite
> `supabase/tests/348_disposal_flag_meeting_child_lock.sql` (15 tests) on a fresh reset. ⚠ **The seed
> contains no locked meeting with agenda items** — its only meeting with children is `held` — so the
> suite **constructs** the population instead of searching for it. (An E2E-mutated database shows that
> same meeting as `in_signature`; a fixture derived from seed state can look correct and be wrong.)
> Verified by **neutralization, not by reading**: with the stand-aside removed, the keystone dies
> `23514 … está bloqueado`; with it, disposal completes and `status` is untouched. The refusal pins
> (t5/t6/t8/t15) stay green in **both** directions — they are the over-grant twin, not the fix's
> subject, and they go red if anyone later widens the stand-aside to `app.in_meeting_rpc` (which **26**
> `public.*` doors set).
>
> **Gates:** pgTAP **199 files / 6550 tests PASS** · eight lint gates · `tsc` · vitest **1447** ·
> `ARM=census` + `ARM=hat` + `ARM=floor` + `FROMFINDINGS=1 ARM=wrapper` **all HOLD**.
>
> ⭐ **The build found a second thing the obligations did not ask for.** ADR 0079 Amdt 1's diff-scoped
> recipe filters to `^(is_|can_|has_)` names + RLS policies, and by that **syntax** this diff's case
> list is **empty** (a trigger function and a plain `if not (...)` inside a door). Swept by the
> **property** instead: rewriting `dispose_meeting_minutes`'s authorization gate to `if false then` —
> so **any** caller passes — left the full **6548-test** suite **GREEN**. Door-blind by construction,
> on a PHI-erasure door, since ADR 0056. `348` **t7** is the missing keystone (a plain commission
> member refused `42501`) and it goes RED under exactly that mutation. Filed forward:
> `FUP-DISPOSAL-DOOR-GATES-UNKEYSTONED` (the other three disposal doors were **not** measured).
>
> ⚠ **A residue is carried, not dropped:** `FUP-MEETING-DISPOSAL-LEAVES-CHILD-TEXT` — the door redacts
> three of `meeting_agenda_items`' four text columns (`title` survives), and nothing redacts
> `meeting_attendees.{note,external_name}` or `meeting_closed_sessions.label`. ADR 0056 §2 **declares**
> that scope, so this is an over-claim in the disposal language rather than a regression — DSR Slice 4's
> subject.


> ⭕ **FIX RULED 2026-08-19 (PO, DSR design session Q11) — shape 2: a new narrow flag
> `app.in_disposal_rpc`, read ONLY by `guard_meeting_child_lock`, set ONLY by
> `dispose_meeting_minutes`.** Shape 1 (honour `app.in_meeting_rpc`) REJECTED as a widening —
> ADR 0126 §E leans on the guard refusing inside RPCs; shape 3 rejected (redaction outside the
> audited door). Full decision + obligations (the with-agenda pgTAP fixture, the no-flag
> differential, the sibling over-grant twin, the diff-scoped sweep, the same-change ADR 0126 §E
> amendment): ADR [0129](../decisions/0129-meeting-child-lock-disposal-flag.md); build slot:
> [dsr-workflow-plan.md](../plans/dsr-workflow-plan.md) **Slice 1**. ⛔ **NOT BUILT — the item
> stays OPEN and C1a/C1b stay blocked until the 0129 evidence exists**, per PO instruction that
> implementation waits for a future session.

Filed 2026-08-18 (lead) — found by `backend` during the ADR 0125/0126 build while sweeping the writers of
the content the meeting template renders, and **independently re-measured from the live catalog by the lead
before filing**. Not the prévia build's subject; filed so it is not carried inside a build that does not own it.

**The mechanism, measured — a comment that asserts a bypass it does not perform.**
`public.dispose_meeting_minutes` opens with:

```
perform set_config('app.in_meeting_rpc', 'on', true);  -- bypass the meeting freeze guards
```

That flag is real and other meeting guards honour it. **`app.guard_meeting_child_lock` does not** — its body
contains **no reference to `app.in_meeting_rpc` at all** (verified against `pg_get_functiondef`, not the
migration text). It raises unconditionally:

```
if v_status in ('in_signature', 'signed', 'distributed', 'cancelled') then
  raise exception 'o conteúdo desta reunião está bloqueado (%)', v_status using errcode = 'check_violation';
```

It is installed on **four** child tables: `meeting_agenda_items`, `meeting_attendees`, `meeting_cases`,
`meeting_closed_sessions`.

**⇒ The disposal door raises partway through its own transaction.** It nulls `minutes_md` first (the parent
table, which *does* honour the flag), then UPDATEs `meeting_agenda_items` to `[PHI removido]` — and **that**
statement trips the child lock, rolling the whole call back.

**Constructed, not argued — three probes:**

| Probe | Fixture | Result |
| ----- | ------- | ------ |
| **A** | `signed` meeting **with 2 agenda items** | ⛔ **RAISES** `o conteúdo desta reunião está bloqueado (signed)` — disposal impossible |
| **B** | `signed` meeting, **0 agenda items** | ✅ succeeds; `phi_disposed_at` stamped, status stays `signed` |
| **C** | as B, `minutes_md` populated first | ✅ succeeds; `minutes_md` → null, `phi_disposed = true`, status still `signed` |

**Why it is 🔴 and not a curiosity.** The meetings that carry agenda content are exactly the meetings that
carry PHI worth disposing. So the erasure obligation **cannot be discharged on precisely the population it
exists for**, while succeeding on the empty ones — which means a disposal run over a real tenant would report
partial success and leave the PHI-bearing minutes intact. Rule 12 / ADR 0035's LGPD + ANVISA/RDC regime makes
this an obligation, not a feature: **LGPD Art. 18** erasure, and the 20-yr retention regime's expiry path.

⛔ **It blocks Critical FUP C1a/C1b directly.** The disposal runbook
([`phi-disposal-runbook.md`](../deployment/phi-disposal-runbook.md)) is the next PO-sequenced item, and a
rehearsal that only ever exercises agenda-less meetings would go **green while proving nothing about the
blocking case** — the [[a-detector-that-finds-nothing-must-be-proven-able-to-find-something]] shape, in the
highest-severity item in the register. **The C1a rehearsal must include a locked meeting WITH agenda items as
a named fixture**, or its green is not evidence.

**Not yet decided — the fix is a real design question, not a one-liner.** Three shapes, none ruled:
1. Teach `guard_meeting_child_lock` to honour `app.in_meeting_rpc`, like its siblings. ⚠ **A widening** — it
   opens every child table to every meeting RPC, and the guard's refusal-inside-RPCs may be load-bearing
   somewhere it was not measured. A widening cannot be wrong-and-safe.
2. A narrower flag read only by the child lock and set only by the disposal door.
3. Redact through a DEFINER path that does not transit the trigger.

**⭐ The class, because the instance is the cheap part.** A **comment asserted a bypass that the guard it
names does not implement**, and nothing could contradict it — the door's own suite passes on agenda-less
fixtures, and the runbook was written from the comment. Same family as
[[a-comment-is-an-assertion-that-goes-stale-silently]] and [[guards-that-read-right-but-fail-open]]: the text
read correctly and the catalog disagreed. ⚠ Note **which** measurement found it — not a read of the disposal
function (that is where the false comment lives) but a **property-bounded sweep of every writer of the
rendered content**, run for an unrelated reason. A sweep bounded by "writers of `meetings`" would have found
the door and believed its comment.

### ✅ FUP-ACT-DISPOSE-UI — RESOLVED 2026-08-20 (DSR Slice 2, ADR 0130). The LGPD Art. 18 erasure path has a working UI route.

> **The check, run and recorded.** Persona **`pqs.a@test.local`** (`pqs_member` of Hospital Central A)
> (a) reaches **`/o/rede-a/titulares`** — the DSR task inbox behind the `dsr` flag, because
> `app.can_execute_dsr_task` admits `app.is_pqs_operator_of_for(hospital)` — and (b) passes
> `dispose_event_phi`'s own gate, catalog-verified. **Both halves executed in a browser**:
> `e2e/dsr-subject-requests.spec.ts` clicks the affordance, then asserts
> `patient_safety_event.phi_disposed_at is not null` and `event_patient` gone via the service role.
> The item's own row is updated in place at [dm5-po-decisions.md](dm5-po-decisions.md)
> § "Remaining pre-pilot work" item 0, which is where the pilot decision is actually read.
>
> ⚠ **What was wrong, precisely.** The two sets were disjoint because **no surface existed**, not
> because the gates were misaligned — the referral dispose dialog had a component and the
> case/event dispose actions had **no caller anywhere in the app**. ⛔ **No disposal gate widened**:
> the executor fires the module's own door under their own session (ADR 0130 Decision 2), which is
> exactly why the check could be answered without touching authorization.
>
> ⚠ **Bounded, so this is not read as more than it is.** The corridor proven end-to-end is the
> **event** lane; case and referral ride the identical inbox path and fan-out but their proof is the
> pgTAP matrix (`349`), not the E2E — disposal is irreversible and pointing a spec at seeded records
> would erase PHI ~900 other tests share. The **meetings** lane is NOT discharged and is not claimed:
> ADR 0056 Consequence (a)'s missing meetings-dispose UI moved to DSR **Slice 3** with the
> adjudication that mints the task (ADR 0130 Amendment 2 item 3), because minting a whole-minutes
> erasure from a one-agenda-item match would destroy other committees' records.
>
> _Body below is the live text at resolution, verbatim._

### 🔴 FUP-ACT-DISPOSE-UI — LGPD Art. 18 referral-erasure has no UI route (owner: PO — mount point)

> ⭕ **MOUNT POINT DECIDED 2026-08-19 (PO, DSR design session Q8b/Q16): SUBSUMED by the DSR task
> inbox at `/o/[org]/titulares`** (ADR [0130](../decisions/0130-dsr-subject-request-workflow.md)
> Decision 11; [dsr-workflow-plan.md](../plans/dsr-workflow-plan.md) **Slice 2**, which includes
> running THIS item's check and recording the named persona). Executors fire the existing doors
> under their own sessions — zero gate changes. The same surface also gives `dispose_meeting_minutes`
> its first UI (ADR 0056 Consequence (a), never built — verified 2026-08-19: no component calls the
> case/event/meeting dispose actions; only the referral dialog exists). ⛔ **The item stays OPEN and
> stays pilot-gate item 0 until that slice ships and the check passes** — a decided mount is not a
> working route.

_Verbatim from PROGRESS.md § "Remaining pre-pilot work" item 0, where it was carried as a **pilot-gate
check** rather than a follow-up-list entry. It stays item 0 of that list; this is its body._

**0. 🔴 PILOT-GATE CHECK — the LGPD Art. 18 referral-erasure path must have a working UI route
(FUP-ACT-DISPOSE-UI).** Placed here, as a **gate check rather than a follow-up-list entry**, on the
Stage-3 QA reviewer's explicit recommendation — *"this program's own record shows 'standing in prose
alone' once meant a thing ran once in three weeks"* (the same failure ADR 0079 was written about).
**The check, stated so it can be run and can fail:** name a persona who can (a) reach the surface
hosting the dispose affordance AND (b) pass `dispose_referral_phi`'s own gate. Today **no such
persona exists** — the two sets are disjoint (catalog-verified; full mechanism in the
`FUP-ACT-DISPOSE-UI` body → [follow-ups.md](follow-ups.md)). Until one does,
subject-erasure is API-only. **Decision owner: PO** —
*where* the affordance mounts is a product call (NSP surface reaches operators; manage-tier reaches
tenancy admins); *whether* it must work before pilot is not. ⚠ Precedent that makes this
non-negotiable: migration `20260917000400` restored this door's tenancy-admin arm specifically to
un-strand this same obligation after QO·B cut it — the platform has already ruled once.

## Rotated from PROGRESS.md 2026-08-20 — the DSR Slice 4 close-out (2 items)

Both index lines left PROGRESS.md in the same edit that closed them. Full bodies remain in
[follow-ups.md](./follow-ups.md) under their `⬛` headings until the next bulk rotation.

**The two index lines as they stood in PROGRESS.md, verbatim** (links repointed for this directory):

> - 🟠 **FUP-DISPOSE-DIALOG-OVERCLAIM** — the shipped referral-dispose copy is ADR 0056 (b)'s forbidden "tudo apagado" over-claim (*"apaga permanentemente … todos os campos"*, no retained-bytes mention). ⭕ *Narrowed 2026-08-19: counsel's return keeps the Art. 18 lane live, so the reason option is valid — the over-claim is the whole defect.* Fix = the shared residue-language constant, [DSR plan](../plans/dsr-workflow-plan.md) Slice 4 — frontend
> - 🟠 **FUP-NOTIFICATIONS-PHI-RESIDUE** — `notifications.title/body` copy entity text at write time and **no dispose door touches the table**: a granted disposal leaves pre-redaction PHI in every notification the entity emitted. Fix = scrub-by-(entity_type,entity_id) in all four doors + pgTAP pins w/ vacuity control, DSR plan Slice 4 — backend

Closure records:

- [x] **✅ CLOSED 2026-08-20 — FUP-DISPOSE-DIALOG-OVERCLAIM** (DSR plan Slice 4 item 3).
  `referral-dispose-dialog.tsx` now renders the shared `DSR_RESIDUE_NOTICE` verbatim and both
  over-claiming strings are **replaced, not supplemented** — verified independently of the
  implementer's report (`grep` for *permanentemente* / *todos os campos* / *Não é possível
  desfazer* exits 1); eight lint gates + tsc green. ⚠ Carry forward: **the verification
  instrument for this item was a grep, so the fix could have defeated its own check** — a first
  draft quoted the removed pt-BR strings in a docblock as "do not reintroduce", which would have
  made that grep hit forever on a comment rather than on live copy. *Nothing in that file,
  comments included, may ever contain those strings.* Left deliberately and flagged: the
  confirm-field helper ("exclusão **definitiva**") and the destructive button ("Apagar
  **definitivamente**") assert *finality*, not the *completeness* ADR 0056 (b) forbids.
- [x] **✅ CLOSED 2026-08-20 as PREMISE-FALSIFIED — FUP-NOTIFICATIONS-PHI-RESIDUE.** The residue
  class it named **does not exist**. `notifications.entity_type`'s CHECK admits eight values and
  **`case`, `referral` and `event` are not among them**, so the prescribed
  scrub-by-`(entity_type,entity_id)` matches **zero rows by construction** for three of the four
  doors — the pgTAP pin it asked for would have been vacuous *by CHECK constraint*, unfalsifiable
  by any code. Established by **constructing the state** (both inserts refused; a `meeting` insert
  as positive control). Its own cited evidence was false: **no notification writer reads
  `cases.label`** — one writer, sixteen callers, none touches it — and the writer set is *bounded*
  (SELECT/UPDATE policies only; **no INSERT GRANTED to `authenticated` at any grain**, table or column), not merely
  enumerated. ⛔ **Corrected (QA r1):** this first said *"`authenticated` holds `r` alone"* — false;
  `pg_attribute.attacl` carries a **column** grant `read_at = authenticated=w` invisible in
  `pg_class.relacl`. Conclusion holds (scoped to `read_at`; `title`/`body` unwritable), reason did
  not — ⭐ **`attacl` belongs beside `relacl`.** Nor is
  any notification text source erased by any door. Full census: ADR
  [0130](../decisions/0130-dsr-subject-request-workflow.md) **Amendment 4**; Decision 9's
  scrubbing clause is **withdrawn** while its residue-language clause stands.
  ⭐ *Why it read as obviously right for a day:* the design was inferred from **column names** —
  `entity_type`/`entity_id` look exactly like a polymorphic handle to the disposed entity — and
  was internally coherent throughout; only the **writers** say what the key points at, and
  `compute_due_ethics_notifications` stores a `cases.id` under `entity_type='ethics_notification'`.
  Successor, filed not folded in: **`FUP-DOOR-ERASURE-FREETEXT-CENSUS`**.

## Rotated from PROGRESS.md 2026-08-20 — DSR Slice 4 item 4 (the meeting-door widening)

**The index line as it stood in PROGRESS.md, verbatim** (links repointed for this directory):

> - 🟠 **FUP-MEETING-DISPOSAL-LEAVES-CHILD-TEXT** — meeting PHI disposal redacts **three of `meeting_agenda_items`' four** text columns (`title` survives) and touches none of `meeting_attendees.{note,external_name}` or `meeting_closed_sessions.label`. ADR 0056 §2 **declares** that scope, so this is an **over-claim in the language**, not a regression — but "the meeting's PHI is erased" is false while an agenda item can be titled with a patient's name. Fix vehicle: DSR plan **Slice 4** (residue + copy honesty) — either redact them or name them as retained; the one unacceptable state is the current one — backend

Closure record:

- [x] **✅ CLOSED 2026-08-20 — FUP-MEETING-DISPOSAL-LEAVES-CHILD-TEXT.** The door was **widened**
  (PO-ruled) rather than the copy hedged, so `DSR_RESIDUE_NOTICE` line 1 is true as written.
  ⛔ **Slice 4's copy half had shipped straight into the state this item forbade** — the notice went
  live claiming the record's DB patient data was erased while none of these columns were named as
  retained; QA r1 blocked on it. *An open follow-up naming your slice as its vehicle is scope you
  already own.* ⭐ The census returned **10 columns, not the 4 this item listed**, and each addition
  was missed by a boundary that looked principled: `meeting_closed_session_items.{substance,decision,
  withdrawals}` is **depth-2** (a direct-children census cannot see it); `meeting_minutes_jobs.
  {transcript,draft,result}` — **`draft`/`result` are `jsonb`**, and the first census filtered on
  `text/varchar/citext`, so ***free text is not a type***; `meeting_attendees.external_org` sat beside
  the `external_name` already listed. ⛔ **The finding that outranks the item:** only 3 of
  `audio_job_status`' 6 values purged the transcript, so a job resting in **`done`** — the normal
  state, awaiting review — kept the **verbatim transcript of the whole meeting** indefinitely,
  falsifying ADR 0056 **§4's central claim**, not merely the residue copy. Now nulled unconditionally
  and set-based (no UNIQUE on `meeting_id`, so never `limit 1`). `meetings.title` is **kept and
  therefore disclosed** (`DSR_MEETING_RESIDUE_RETAINED`). Two findings no column list could show: a
  blanket `external_name` redaction violates `meeting_attendees_identity_xor` and **aborts the entire
  disposal** (a legal obligation failing closed), and the first census was measured **mid-`db reset`**,
  returning an **empty trigger census when there are 17** — which reads as *"no guards, safe to
  widen."* Coverage: pgTAP `351`, **33** assertions (its declared `plan()`) on a **locked** meeting (a `scheduled` fixture fires
  neither guard and would pass while the door is broken for every real disposal), **17/17
  neutralization probes RED** incl. the over-grant twin; ⚠ **one pin was found vacuous by its own
  author** — it asserted what the CHECK guarantees structurally and was green while the door was
  completely broken. ⛔ `ARM=census`/`ARM=wrapper` are exit 0 and **vacuous here** (neither changed
  function is in any arm's domain); ADR 0079 Amdt 1's syntax-filtered case list is **empty** and it was
  swept by the property instead. Records: ADR 0056 **Amdt 1**, ADR 0129 **Amdt 1** (`app.in_disposal_rpc`
  now has **two readers, still one setter**). ⛔ **No successor filed:** the reported gap *"a PHI-bearing
  title on a locked meeting has no product remedy"* was written into two records and is **false as
  stated absolutely** — `reopen_meeting` sets `public.meetings → 'held'`, which **is** in
  `update_meeting`'s allowed set, so the revoke corridor is the remedy (at the cost of a revision bump
  invalidating registered prints, ADR 0126 D9). ⭐ *A gate tells you what it refuses; only the
  transition graph tells you what is reachable.* ⚠ **The lead's correction was itself too absolute and
  was narrowed on re-measurement:** `reopen_meeting` accepts only `in_signature`/`signed`, while the
  child lock also covers **`distributed` and `cancelled`** — and `app.guard_meeting_status` has **no
  transition arm** for either (arms are `scheduled`/`held`/`in_signature`/`signed`), so for those two
  terminal states the title genuinely cannot be changed by any door; and `reopen_meeting` gates on
  `is_staff_admin_of` alone while the disposal door also allows `is_tenancy_admin_of`, so the operator
  holding the erasure duty may be unable to walk the corridor. ⭐ *Correcting a claim's **direction**
  without re-deriving its **magnitude** produces a second wrong claim that reads as a fix* — which is
  why the retention copy deliberately offers no remedy guidance.

## Rotated from PROGRESS.md + follow-ups.md 2026-08-20 — FUP-GREP-VERIFIED-FOLLOWUP-IS-SELF-DEFEATING (resolved by dissolution)

**The index line as it stood in PROGRESS.md, verbatim:**

> - 🟡 **FUP-GREP-VERIFIED-FOLLOWUP-IS-SELF-DEFEATING** — prose documenting a forbidden string defeats the grep verifying its absence; **4 recurrences in one day**, the 4th by the author who fixed the first 3, in a docblock explaining the detecting regex. ⛔ **PO ruled 2026-08-20: record only, no gate.** Two measured constraints for any future implementation: a literal-string gate is wrong **both** ways (false-positive on prose about it, false-negative on a paraphrase), and the check must run in `npm run lint` where the writing happens, not at QA time a cycle late — unassigned

**The body as it stood in follow-ups.md, verbatim** (it contained no links, so nothing was repointed):

### 🟡 FUP-GREP-VERIFIED-FOLLOWUP-IS-SELF-DEFEATING — prose that documents a forbidden string DEFEATS the grep that verifies its absence; 4 recurrences in one day, the 4th by the author who fixed the first 3 (owner: unassigned; **PO ruled 2026-08-20: RECORD ONLY, no gate**)

Filed 2026-08-20 (lead), from DSR Slice 4 QA r1 + r2.

**The class.** `FUP-DISPOSE-DIALOG-OVERCLAIM`'s closure instrument was a grep over `src/` for the
shipped pt-BR over-claim. But the natural way to warn the next reader off a defect is to **quote
it** — so every warning comment makes the detector fire, and a fixed defect reads as unfixed.
Measured instances, all on 2026-08-20: `dsr-meeting-dispose-dialog.tsx` · `dsr-task-inbox.tsx` ·
`messages.ts` (worst — the docblock of `DSR_RESIDUE_NOTICE` itself) · `referral-dispose-dialog.test.tsx`.

⭐⭐ **The finding is not the four instances — it is that the prohibition is not holdable by
discipline.** The fourth author had *personally fixed the other three* and had written the
"deliberately not quoted" note into each, then reintroduced it **in a docblock explaining the regex
that detects it**. Their own account: *"when you write a pattern that matches a defect, quoting the
defect is how you justify the pattern."* A rule that asks every future author to suppress the
obvious phrasing forever, with nothing able to contradict them, is the shape CLAUDE.md §8 says a
**gate** exists for — and it is also the shape ADR 0127 refuses to admit as a `.claude/rules/` entry,
because it cannot be shown stale.

⛔ **PO ruled 2026-08-20: record only.** No ninth lint gate, no rule file, no change to the closure
instrument. A fifth recurrence is expected; this entry is so it is recognised rather than
re-diagnosed.

⚠ **Two design constraints, measured, for whoever does build it.** Both make the obvious
implementation wrong:
1. **The grep pattern and the prohibition are not the same set.** The fourth instance matched only
   because the pattern happened to include `todos os campos com dados`; it was written in caps with
   an ellipsis. A paraphrase one word off — different casing, a synonym, a line break mid-phrase —
   **slips a real reintroduction past the same grep**. So a literal-string gate is wrong in *both*
   directions: false-positive on prose *about* the defect, false-negative on a reworded instance of
   it. The honest form is a lint rule scoped to **UI string literals, excluding comments**, keyed on
   the over-claim *family* (a permanence adverb paired with a universal quantifier over the
   sensitive fields — ⭐ the quantifier is the load-bearing half; ADR 0056 (b) forbids the
   *completeness* claim, not the finality one).
2. **The check must run where the writing happens.** All four were introduced by someone editing a
   file for an unrelated reason. A repo-wide grep at QA time catches them a full cycle late; the
   same check inside `npm run lint` fails the author within seconds — *the difference between a
   habit and a gate.*

**What actually guards the property today** (so this is not read as uncovered): a mutation-proven
component test asserts it on **rendered output** — no totality quantifier, and no erasure claim
without the residue lines beside it — which is a stronger instrument than the grep, and on
2026-08-20 it **replaced** the grep as `FUP-DISPOSE-DIALOG-OVERCLAIM`'s closure instrument (that
item's note (a)).

⛔ **CORRECTED 2026-08-20 (measured, same day this was filed).** The sentence above previously read
*"the mutation-proven component **tests** assert it … on the surfaces that have tests"*, which
over-claimed the breadth in the entry that exists to document an over-claim. Measured: **one**
surface carries the totality assertion — `referral-dispose-dialog.test.tsx` claim 2. Its sibling
`dsr-meeting-residue.test.tsx` imports all four components but greps **0** for a totality
quantifier: it pins the *residue lines*, not the *absence of the over-claim*. So the gap is not
only the hypothetical **new** surface — it is **three existing ones**. Filed as
`FUP-OVERCLAIM-PROPERTY-ONE-SURFACE-ONLY`; ⭐ the general lesson is that *"the tests cover it"* is
a claim with a cardinality, and this entry shipped without measuring it.

Closure record:

- [x] **✅ CLOSED 2026-08-20 — resolved by DISSOLUTION plus one standing rule. The PO's
  record-only ruling stands: no ninth lint gate was built, and none should be.**
  ⭐ **The item's own title over-scopes what was left to solve.** Re-measured at close:
  the originating trap is already structurally dead. The `src/` grep for the three shipped
  literals returns **exit 1** — all four false-positive sites are clean — and it is no
  longer anyone's instrument, having been swapped on 2026-08-20 for claim 2 of
  `referral-dispose-dialog.test.tsx`, which reads **rendered DOM text**, where comments do
  not exist. The prohibition that made the four recurrences *defects* ("nothing in that
  file, comments included, may contain those strings") was downstream of the grep and had
  no other ground; it is now removed from the file that carried it, with the reason stated
  in place. **The fifth recurrence the entry expected is a non-event, not a suppressed
  instinct.** What genuinely remained was narrower and never stated in the title: nothing
  stopped the **next** forbidden-string follow-up from being closed with a source grep and
  re-arming the identical trap. That is now `.claude/rules/ui-copy-forbidden-strings.md`.
- ⛔ **Why a rule and not the ninth gate — and why the entry's own second constraint is
  the one that had to be dropped.** The entry required (1) a non-literal pattern and (2) a
  check inside `npm run lint`, "where the writing happens". Constraint 2 is **void once
  constraint 1's successor is measured**: `FUP-OVERCLAIM-PROPERTY-ONE-SURFACE-ONLY` showed
  the *family* pattern false-positives on `DSR_MEETING_DISPOSAL_WARNING`
  (`src/lib/dsr/messages.ts:205`, *"⛔ Never soften this"*), so the cheapest way to green a
  lexical gate is the edit ADR 0130 forbids. Re-measured at close: that constant is the
  **only** totality quantifier surviving across all four disposal surfaces plus
  `messages.ts`. A gate whose sole live match is copy that must never change is not a
  tuning problem. ⭐ And constraint 2 was aimed at catching an author writing a **comment**
  — which the instrument swap makes not-a-defect. *A constraint on the fix inherits the
  premises of the instrument that motivated it; when the instrument is replaced, re-derive
  the constraint instead of carrying it forward.*
- **The rule states the instrument class, and contains no pt-BR pattern at all** — so it
  cannot false-positive on prose *about* a string, and cannot false-negative on a
  paraphrase. Both directions of the measured constraint are answered by having no pattern
  rather than by a better one. ADR 0127 admission: `paths:` scoped to 4 files (the
  register, the copy module, the two disposal-copy tests), two resolving `anchors:`, a
  named `source:`. It **can** be shown stale — the exemplar anchor
  (`referral-dispose-dialog.test.tsx#TOTALITY_QUANTIFIER`) reds if the instrument is
  renamed or removed, and `lint:rules` was **observed red** on the archive anchor before
  this rotation landed, so the gate is proven able to fail on this rule specifically.
- ⚠ **What this closure does NOT cover, stated so it is not read as wider than it is.**
  Three of the four disposal surfaces still carry **no** assertion of the over-claim's
  absence — that is `FUP-OVERCLAIM-PROPERTY-ONE-SURFACE-ONLY`, which stays **OPEN** and is
  the successor for the breadth half. This item was about the *instrument*, not the
  *coverage*, and closing it changes the coverage by nothing.

## Rotated from PROGRESS.md + follow-ups.md 2026-08-20 — FUP-OVERCLAIM-PROPERTY-ONE-SURFACE-ONLY (built)

**The index line as it stood in PROGRESS.md, verbatim:**

> - 🟡 **FUP-OVERCLAIM-PROPERTY-ONE-SURFACE-ONLY** — the ADR 0056 (b) over-claim is pinned on **1 of 4** disposal surfaces (`referral-dispose-dialog.test.tsx` claim 2); `dsr-meeting-residue.test.tsx` imports all four but greps **0** for a totality quantifier — it pins the residue lines, a different property. ⛔ **No live defect, and the obvious fix is harmful:** extending the pattern REDS on `DSR_MEETING_DISPOSAL_WARNING` ([messages.ts:205](../../src/lib/dsr/messages.ts:205)) — *"⛔ Never soften this"* — so the cheapest green is to damage the ADR 0130 warning that a meeting disposal destroys **other committees'** items. ⭐ The undrawn distinction is **polarity, not syntax**: a quantifier over the subject's data in a REASSURING frame is forbidden, over others' records in a WARNING frame is required. Kills the lexical ninth-gate design outright — unassigned

**The body as it stood in follow-ups.md, verbatim** (same directory, so its two links needed no repointing):

### 🟡 FUP-OVERCLAIM-PROPERTY-ONE-SURFACE-ONLY — the ADR 0056 (b) over-claim is asserted on ONE of four disposal surfaces, and the obvious extension REDS on the one string the slice forbids softening (owner: unassigned; found 2026-08-20 while swapping `FUP-DISPOSE-DIALOG-OVERCLAIM`'s closure instrument)

Filed 2026-08-20 (lead). Successor to the breadth clause of
`FUP-GREP-VERIFIED-FOLLOWUP-IS-SELF-DEFEATING` (**closed 2026-08-20 by dissolution** — full body
+ closure record in [follow-ups-archive.md](follow-ups-archive.md); the instrument half became
`.claude/rules/ui-copy-forbidden-strings.md`), which stated the gap as *"a **new** dispose
surface with no test"* — measurement makes it **three existing ones**. ⚠ **The coverage half is
this item and it is UNCHANGED by that closure**: the predecessor was about the *instrument*.

**Measured.** Four components reach a `dispose_*` door and render disposal copy. Only
`referral-dispose-dialog.test.tsx` (claim 2) asserts the **absence of the over-claim** as a
property, via `TOTALITY_QUANTIFIER` over rendered DOM text. `dsr-meeting-residue.test.tsx` imports
all four components but greps **0** for a totality quantifier — it pins the *residue lines*, which
is a different property. So `dsr-meeting-dispose-dialog`, the `dsr-task-inbox` dispose card and
`dsr-outcome-record` are unpinned for this class.

**No live defect.** All three are clean today: zero totality quantifiers in their own source.
`src/lib/dsr/messages.ts` has two hits and **neither is an over-claim** — one is subject-data
guidance (`…nem qualquer dado que identifique o titular`), the other is below.

⛔ **The obvious fix is actively harmful, and this is the whole reason to file rather than just do
it.** Extending claim 2's pattern to the meeting dialog REDS on **`DSR_MEETING_DISPOSAL_WARNING`**
([messages.ts:205](../../src/lib/dsr/messages.ts:205)) — the constant whose own docblock calls it
*"THE SINGLE MOST IMPORTANT STRING IN THIS SLICE"* and *"⛔ Never soften this"*, required by ADR
0130 Amdt 2 item 3 to tell an operator that `dispose_meeting_minutes` destroys **other committees'**
unrelated agenda items. Under a naive quantifier gate, **the cheapest way to make the build green is
to soften that warning** — the gate would push an engineer toward the exact edit the docblock
forbids.

⭐ **The distinction the pattern cannot currently make is POLARITY, not syntax.** Both strings pair a
universal quantifier with an erasure verb. The forbidden shape quantifies over **the subject's data
as the erased set, in a REASSURING frame** ("everything of yours is gone"); the required shape
quantifies over **other people's records, in a WARNING frame** ("this also destroys all of that").
Identical syntax, inverted semantics. Any extension must key on the *frame*, or scope itself to the
reassurance block rather than the whole dialog.

**Consequence for the register's design constraints.** `FUP-GREP-VERIFIED-FOLLOWUP-IS-SELF-DEFEATING`
recorded that a *literal* gate is wrong in both directions. This is the measured demonstration that
the *family* pattern is too — false-positive on correct, deliberate, PO-ruled copy. Whoever revisits
the ninth-gate question should treat this as the constraint that kills the lexical design outright,
not as a tuning problem. ⛔ **Re-measured at the predecessor's close: `DSR_MEETING_DISPOSAL_WARNING`
is the ONLY totality quantifier left across all four disposal surfaces plus `messages.ts`** — so a
lexical gate's entire live yield today would be the one string that must never change.

**Cost, corrected.** Estimated at "~15 lines" when filed as a breadth gap; that estimate assumed the
pattern transferred. It does not. The cheap honest step is scoping claim 2's assertion to each
dialog's *residue/reassurance* region; sizing that is the first task, not a foregone conclusion.

Closure record:

- [x] **✅ CLOSED 2026-08-20 — the property is asserted on 4 of 4 disposal surfaces, defined
  ONCE in [`src/components/dsr/disposal-copy-property.ts`](../../src/components/dsr/disposal-copy-property.ts).**
  New suite [`dsr-disposal-overclaim.test.tsx`](../../src/components/dsr/dsr-disposal-overclaim.test.tsx)
  (21 tests) covers the meeting dialog, the task-inbox card over **every** disposal kind plus its
  executable arm, and the outcome record in **both** meeting arms;
  `referral-dispose-dialog.test.tsx` claim 2 stays where it is — it is
  `FUP-DISPOSE-DIALOG-OVERCLAIM`'s closure instrument and also covers that dialog's pre-open
  summary region — and now imports the same property, so the two cannot drift.
- ⛔ **THIS ITEM'S OWN PRESCRIPTION WAS WRONG, AND MEASURING IT FIRST IS WHY THAT SURFACED.**
  It named the cheap honest step as *"scoping claim 2's assertion to each dialog's
  residue/reassurance region"*. Measured on all four: that region renders `DSR_RESIDUE_NOTICE`
  (and `DSR_MEETING_RESIDUE_RETAINED`) **and nothing else** — so an assertion scoped to it would
  only ever re-check constants claim 1 already pins, while the shipped defect lived in the
  dialog's own **bespoke** copy *outside* that region. The prescribed fix would have moved the
  assertion **away from the only place the defect has ever appeared** and read as coverage. ⭐ *A
  filed item's proposed remedy is a hypothesis, not a spec; the item said "sizing that is the
  first task" and sizing it is what falsified it.*
- **What replaced it: subtraction by IDENTITY, not a cleverer pattern.** The property is applied
  to the whole rendered surface MINUS the deliberately warning-framed constants, which are
  imported rather than re-typed. That answers the polarity problem the item called
  design-killing: a component's own bespoke string can never be in the subtraction set, so the
  set cannot become an escape hatch. ⚠ Subtraction buys blindness unless paired, so the meeting
  dialog carries a **positive pin** that `DSR_MEETING_DISPOSAL_WARNING` renders verbatim —
  measured, nothing pinned it before, and a silent deletion of *"the single most important
  string in this slice"* would have left every other assertion green.
- **The item's central fear, discharged executably.** Mutation **M6** softens the warning by
  removing its quantifier: the suite stays **GREEN** (36/36) — the gate is indifferent to that
  edit, so it can never be the cheapest way to a green build. **M7** empties the subtraction set
  and the meeting surface goes **RED**, which is the same claim from the other side: the naive
  lexical gate really would have fired on the one string ADR 0130 forbids softening.
- ⭐⭐ **A DEFECT IN THE INSTRUMENT ITSELF, found only by mutating it — and it narrows what the
  PREDECESSOR ever proved.** `Element.textContent` concatenates descendant text with **no**
  separator, so the last word of one element fuses to the first of the next
  (`…Ana Souza` + `Tudo apagado` → `…SouzaTudo apagado`). There is no word boundary before that
  `T`, so `\btudo\b` **does not match** and the over-claim passes. A deliberate over-claim
  injected into `dsr-outcome-record.tsx` left the entire new suite **green** until
  `renderedText()` (join text NODES with a space) existed. ⛔ `FUP-DISPOSE-DIALOG-OVERCLAIM`'s
  closure assertion read `dialog.textContent` directly, so **it could only ever have caught a
  quantifier sitting mid-element** — which the shipped defect happened to be. That closure was
  true but narrower than it read; both files are on `renderedText()` now, with a positive
  control that *demonstrates* the blind spot rather than asserting it away.
  ⚠ **Bounded sweep, so this is not read as an unswept class:** only patterns anchored on `\b`
  or `^` can be defeated by concatenation. Across `src/` and `e2e/`, the other four
  regex-absence assertions over `.textContent` (`previa-link` ×1, `verification-result` ×3) are
  unanchored substring alternations and are **not** vulnerable. The two fixed here were the only
  ones.
- **Four docblocks were still asserting a detector that no longer exists** — `messages.ts`,
  `dsr-meeting-dispose-dialog.tsx`, `dsr-task-inbox.tsx` and `referral-dispose-dialog.tsx` each
  told the next author the over-claim "is verified by a grep over `src/`" and reimposed the
  prohibition dissolved when that grep was retired. ⛔ The 2026-08-20 dissolution had landed in
  **one** of five sites — the test file — because the fix was enumerated by *"where was the
  string quoted"* (4 sites) rather than by *"where is the claim made"* (5). All four corrected
  and pointed at `.claude/rules/ui-copy-forbidden-strings.md`.
- **Coverage:** 12 mutations — 11 that must red do (bespoke over-claim on each of the four
  surfaces incl. the referral dialog; an over-claim at an element EDGE; the warning no longer
  rendered; the subtraction set emptied; `reassuranceText` neutered; a residue line dropped; the
  `SURFACES` roster emptied), and M6 must stay green and does. Rollback was proven before the
  battery ran and re-verified byte-identical after every mutation; baseline and final both 36/36.
  Full unit suite **1501 passed**, eight lint gates + typecheck green.
- ⚠ **NOT covered, stated plainly:** the attestation lane is deliberately out of the roster —
  `DSR_ATTEST_PROCEDURE_COMMON`'s last line quantifies universally in a PROHIBITION frame
  addressed to the reviewer, which is required copy. And `outcomeBasis` /
  `legalConsultationRef` are operator free text, not platform copy; the fixtures hold them null
  on purpose, because asserting a copy property over what a DPO typed would red on their words.

## Rotated from PROGRESS.md 2026-08-20 — RULED OUT OF SCOPE by ADR 0131 (2 items)

⛔ **These closed by RULING, not by remediation. The residue they name is REAL, MEASURED and
ACCEPTED** — PHI erasure reaches designated PHI fields only; free text that *may* hold PHI is
out of pilot scope, with **training** as the compensating control (ADR
[0131](../decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md)). A reader who
finds these here must not read them as "investigated, nothing found": the census
([door-erasure-freetext-census.md](./door-erasure-freetext-census.md)) is retained precisely
so what is knowingly retained stays legible.

⚠ **One question this ruling does not obviously settle**, preserved so a close cannot bury it:
the `ethics_*` lane exposed **two** data subjects. The patient half is descoped by ADR 0131.
The other is the **accused professional** — **Class-2 professional identity** under Rule 12, a
different data class from patient PHI, for which ADR 0130's workflow can return `granted` with
**no door to call**. ADR 0131 is written about PHI; whether it also rules on Class-2 erasure is
the PO's to confirm.

Index lines as they stood, verbatim (links repointed for this directory):

- 🔴 **FUP-ETHICS-LANE-NO-ERASURE-DOOR** — **`ethics_` appears ZERO times in all four disposal doors**; 7 tables / 12 free-text `*_md` columns, every one a **composition** child of `cases` (`case_id NOT NULL` + CASCADE). Split from the census item 2026-08-20 (PO) because it is not a missed column — it is **a module with no erasure path at all**. ⛔ **Two data subjects, not one:** patient PHI on an ethics case (no CHECK gates these tables by case type — measured 0 — so nothing separates the lanes), and ⭐ **the accused professional, who is themselves a DSR data subject** — ADR 0130 can adjudicate `granted` and the platform has **no door to call**. PO ruling: widen `dispose_case_phi`, or rule out-of-scope with a basis **and disclose it in `DSR_RESIDUE_NOTICE`**. ⛔ Not by default because it is cheaper — Slice 4 ruled the opposite way on the same question. Verified by direct `prosrc` match, not by the census instrument — backend/PO
- 🟠 **FUP-DOOR-ERASURE-FREETEXT-CENSUS** — ⭕ **MEASUREMENT HALF DONE 2026-08-20; the ruling half is OPEN.** All three remaining doors censused → [door-erasure-freetext-census.md](../progress/door-erasure-freetext-census.md). ⛔ **`DSR_RESIDUE_NOTICE` line 1 is NOT true for `dispose_case_phi`**: the door erases `case_narratives.body_md` and leaves **`case_narrative_revisions.body_md`** — every prior revision of the same prose — and **no door names any `ethics_*` table** (both verified against `prosrc` directly, not via the instrument). ⭐ The prescribed method missed the lane holding the filed defect: `capa_plan.source_event_id` is NULLABLE, so composition closure never reaches capa. **5 instrument defects, 3 under-reporting**; 6-anchor control battery. ⚠ Counts are candidates, not defects — the PO-ruled-**complete** meeting door still scores 16. Next: PO ruling per column, then the empirical sentinel differential (static census cannot see a `where` that matches nothing) — backend/PO

## Index lines rotated from PROGRESS.md 2026-08-21 — the DSR remediation round

- 🟠 **FUP-DISPOSE-EVENT-DOOR-GATE-BLIND** — ✅ **RESOLVED 2026-08-21.** `dispose_event_phi`'s authorization gate was exercised by **no keystone**: opened alone, the full suite still PASSED. Suite `352_dispose_event_door_gate.sql` (6 tests) was written on 2026-08-19 but ⛔ **the item did not close on the file existing** — it closed when `352` **ran inside the full suite on a fresh reset** and was **re-neutralized in that context** (opening the gate reds 2/6). ⭐ *A keystone that has never run in the suite it protects is a file, not a control.*
- 🟠 **FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES** — ✅ **RESOLVED 2026-08-21.** PHI leaves by **two** substrates and only one had a procedure. Now: [`phi-column-disposal-procedure.md`](../deployment/phi-column-disposal-procedure.md) covers the four column-erasing doors (which door, which audit action, what a verifier reads after, and ⛔ **count rows — a stamp is not an erasure**), and [`phi-disposal-runbook.md`](../deployment/phi-disposal-runbook.md) now names its own substrate in its banner so a green run of it can no longer read as covering column PHI.
- 🟡 **FUP-RESIDUE-NOTICE-RESTS-ON-TRAINING** — ✅ **RESOLVED 2026-08-21 by ruling.** PO ruled `DSR_RESIDUE_NOTICE` line 1 **stays as written** on the training premise. ⛔ The item's real requirement was never the copy — it was that the premise be recorded **where the pilot decision is made**; that is now [dm5-po-decisions.md](dm5-po-decisions.md) § *Remaining pre-pilot work* item 2, with the corridor's measured bounds beside it (for a `distributed`/`cancelled` meeting's non-erased columns there is **no removal path by any door**). ⚠ The notice is therefore **conditionally** true — not falsified, premise newly explicit.

## ↩ Rotated from PROGRESS.md 2026-08-22 — the ADR 0134 Increment-2 Record step

_All four were held OPEN by an explicit condition — "stays OPEN until it merges" — and that merge is `be546bbf`. Resolution notes appended to each line; the lines themselves are verbatim._

- 🟡 **FUP-ORPHAN-ADMINISTRATIVO-REACHABILITY-UNVERIFIED** — ✅ **MEASURED + FIXED 2026-08-22, NOT COMMITTED / NOT MERGED** (`canInCommission` + `session-capability-mirror.test.ts` + `e2e/orphan-administrativo-reachability.spec.ts`; body carries the record). The "probably unreachable" guess was **half wrong**: the plain orphan indeed never reaches, but by a **different mechanism** (RLS denies the *commission row*, so the resolver returns null — the shell gate never runs); **orphan × tenancy-admin and orphan × quality-reviewer DID reach `/manage/cases`** and were offered "Novo caso" behind a refusing door (C3's inside the *SOMENTE LEITURA* shell). ⛔ The close condition **as filed** would have closed it wrong — QA §7.8 had already sharpened it to the composites and warned the plain orphan is the one composition that provably cannot reach. Dead END, not over-grant (both door arms measured false; neither orphan created anything). ⭐ Only **2 of 4** E2E tests guard the fix — and a **wrong matcher** first reported C2 as still-reaching on an already-fixed build — backend ✅ **RESOLVED — MERGED to local `main` 2026-08-22** (`be546bbf`). The close condition *as filed* would have closed it WRONG: it said "construct an orphan and measure", and the plain orphan is the one composition that provably cannot reach.
- 🟠 **FUP-S8-UNBOUNDED-BY-CASE-ACCESS-POLICY** — ✅ **RULED 2026-08-22 (ADR 0134 Amdt 4): S8 IS bounded by `not v_eg`, like S5/S7.** ⛔ **Ruled ≠ discharged — stays OPEN on the residue**: the bound must be written into M2, pinned by **P9 / P9-twin / P10 / P11**, and the `is_oversight_only_reader` door set enumerated by `prosrc` property (size **not established**). Filing evidence, retained: ADR 0134 **D6's S8 arm had no `explicit_grants_only` bound** and neither the ADR nor the plan mentions one (measured: zero occurrences in both), while **both sibling read arms have it** (S5 `if v_member and not v_eg`, S7 `if not v_eg`). ⛔ Unbounded, S8 **overrides the access policy** whose whole purpose is that only explicit grants confer reach — and on such a case the appointee's bits become `read_case_content ∧ ¬read_case_deliberation`, which **IS** `is_oversight_only_reader`, so every door keyed on that predicate reads an administrativo as a **quality reviewer** (first instance: `file_correction_request` raises `42501` while `/casos` still renders "Corrigir…", because the UI's `isOversight` is a *different test* from the door's). ⚠ Door-set size **not established** — enumerate by `prosrc` property, never by recall. Rule **before M2 is written**; ⛔ **not** closed by accepting Amdt 3 (a D1 wording question) — backend/PO ✅ **RESOLVED 2026-08-22 — the residue is discharged, not just ruled**: the `not v_eg` bound is applied and P9 / P9-twin / P10 / P11 are green, the twin mutation-proven; the door set is enumerated **and pinned** in `356` §13 (4 routines direct, **11 policies + 3 routines transitively**). MERGED `be546bbf`.
- 🟡 **FUP-ADMINISTRATIVO-CUSTOM-FIELDS-ARM-NOT-E2E-VERIFIABLE** — measured: **one** case platform-wide has custom-field values, **one** non-coordinator holds `create_cases`, and they **cannot read that case** — so the `member_can` disjunct of `update_case_custom_field_values` has **no reachable fixture**. ⚠ NOT “no coverage”: AC-5 + POS-2 pin every other arm. ⭐ The **second** reason the R-2 under-grant was invisible — a spec to catch it had no persona to write it with. Close via a **seed** change in Increment 2 (Inc 1 is DB-free by decision; its empty `supabase/` diff is load-bearing in three gate records) — backend/tester ✅ **CLOSED 2026-08-22 ON A MEASUREMENT, not an inference.** S8 made the "impossible" fixture reachable: the tester drove `update_case_custom_field_values` under staff2's own JWT — 204, DB value changed and restored — and pinned it as `administrativo.spec.ts` POS-2b. ⚠ It was NOT closed by reasoning that S8 *should* have made it reachable. MERGED `be546bbf`.
- 🟡 **FUP-CASOS-ABSENCE-DIFFERENTIAL-UNASSERTED** — ✅ **BUILT + GREEN 2026-08-22, NOT MERGED** (`e2e/casos-reading-surface-differential.spec.ts`, 5 tests; body carries the record). Re-derived **by property**: **16 members**, not QA's 7 — the hand-list missed NINE, under half the class. New-vs-pre-existing is a **cell**, not a member. ⭐ A THIRD mechanism the entry never anticipated (**NEVER-FED** — fuel `/casos` never passed), caught by the **neutralization control** (N1 9/14 flip RED, N2 11/14; **4 cannot flip at all**) after the spec's own first draft mislabelled one — tester ✅ **RESOLVED — MERGED 2026-08-22** (`be546bbf`). ⭐ The entry's own lesson survived to the end: it was wrong twice, and the third derivation — **by property, 16 members not the hand-list's 7** — is what made it right.

## ↩ Rotated from PROGRESS.md 2026-08-22 — the assertion-integrity group (ADR 0134 residue)

- 🔴 **FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME** — ⭐ **RAISED 🟠→🔴 on QA's argument 2026-08-22:** the consequence is not a coverage gap but that an **empty-domain run prints the BYTE-IDENTICAL line a clean run prints** — and it has now produced a §6 step-1 record reading *"all four ARMs HOLD"* for a change that added a **PHI writer**. — `p0-authz-door-audit.sh:~231` bounds the predicate arm by a **name prefix**, not by a property. `ARM=census` correctly VIOLATED on the new gate `member_can_for`; the diff-scoped sweep it prints **as the remediation** then ran **ZERO cases** and printed **`BLIND: 0 ERROR: 0`** — a detector that found nothing because it looked at nothing, in a line a gate record reads as a clean pass. Measured: **802** DEFINER fns, **101** in domain, **42 outside it yet BOOLEAN** — incl. **`_audit_access_authorized`** (the PHI-read audit gate), `confidentiality_clearance_ok`, `member_can*`. ⛔ Outside the arm ≠ unswept, and 42 is not a defect count either. ⚠ Worse one level up: `app._case_caps` returns **`int`**, so it is in **no** arm's domain at all. **Cheapest real fix: forbid an empty-domain run from printing the line a clean run prints** — backend — ✅ **RESOLVED 2026-08-22** (assertion-integrity group; record: [case-split-assertion-integrity.md](case-split-assertion-integrity.md)). ⭐ **The empty-domain/clean-run byte-identity was REPRODUCED before fixing** (`diff` empty, `cmp -s` identical, both exit 0), then closed by a four-way partition — `0` CLEAN · `1` DIRTY · `2` ABORT · `3` UNPROVEN — plus a machine-greppable `ARM-DOMAIN` line and a per-arm *"it did not hold; it did not run"*. Lead-verified on the incident verbatim (`CASES="member_can_for"` → **exit 3**, no BLIND/ERROR count printed). ⭐⭐ **A LARGER defect fell out: the old script ended on `echo "BLIND: …"` with no `exit`, so it returned 0 on `BLIND: 5`** — §6 says BLIND blocks the phase and the exit code had been saying pass. ⛔ **The name→property widening was declined on measurement, not skipped:** 2 of the 42 out-of-domain `prosecdef` booleans are side-effecting writers (`app.enqueue_notification`, `public.remind_document_approver`) that neutralization would silently disarm; the gap is censused every run instead. ⚠ Sweep half proven separately by the lead: `ARM-DOMAIN predicate=1/101 policy=0/225`, CLEAN exit 0.
- 🟠 **FUP-GRANT-CASE-ACCESS-UNCHECKED-HAS-NO-COVERAGE** — `app._grant_case_access_unchecked` writes **`case_access_grants`** — the table deciding who can reach a case — with no authority check by design, and has had **no targeted test and no tracked class since 2026-07**. ⭐ Found by deriving a class **by property** instead of naming the instance that prompted it: the sweep returns **2**, and the second is the precedent the new PHI helper was modelled on. **The class predates the increment that revealed it.** ⚠ Untested ≠ unprotected — ACL `{postgres}`, `anon`/`authenticated` false; what is missing is a pin that this is still true tomorrow. ⛔⛔ **`ARM=census` prints a PRUNE hint naming both entries — correct about its own domain, wrong as advice; acting on it deletes the admitted gap.** ⭐ A gate telling you to erase the record of a gap deserves more attention than the gap — backend — ✅ **RESOLVED 2026-08-22** (assertion-integrity group; record: [case-split-assertion-integrity.md](case-split-assertion-integrity.md)). `358` §A pins both class members' ACL + `prosecdef` and `_grant_case_access_unchecked`'s 3-caller set, red-first proven (grant+DEFINER flip → tests 1–5, 7–10 RED). ⛔ The `ARM=census` PRUNE hint was **not** acted on.
- 🟡 **FUP-CASE-T5-MEUS-CASOS-UNREPOINTED** — T5's text says board rows re-point to manage; `meus-casos` rows still go to `/casos`. ⚠ Arguably **correct** (Meus Casos *is* name-attributed work, which D1 keeps there) — filed because the plan text and the behaviour disagree and one is wrong; leaving them disagreeing is what makes a later reader fix the wrong one — frontend ✅ **RESOLVED 2026-08-22 by PO ruling: the BEHAVIOUR was right and the PLAN SENTENCE was the defect.** Meus Casos is name-attributed work, which ADR 0134 **D1** keeps on the read surface by definition — re-pointing it would contradict D1 for the one surface D1 names as staying put. ⚠ T5 never named `meus-casos` at all; it said *"Board/list rows"*, which **reads as covering every row-bearing surface**. Wrong **by omission**, which is why it was filed as a disagreement rather than a bug. T5 now states the exclusion and its reason. ⛔ Do not "fix" the routing to match a plan sentence.
- 🟠 **FUP-CREATE-CASE-IS-ADMIN-DISJUNCT-VS-THE-NOUN-RULE** — `public.create_case` admits `app.is_admin()`, which `create_case_from_template` and `bulk_create_cases` do **not**. CLAUDE.md's noun rule (ADR 0078 A35) says `platform_admin` **may not touch commission content or PHI** — so a hatted platform admin creating a case in any commission of any tenant is noun-rule territory. ⚠ **Pre-existing and deliberately NOT removed** by Increment 2, which only stopped that arm carrying a **PHI write** it had just been handed. Measured: **11** `public` routines call `app.is_admin()`, enumerated in the body — ⛔ their split into "commission content" vs "sanctioned vocabulary/audit" is **a judgement, not a measurement** (not derivable from `prosrc`) and the PO should correct it rather than inherit it. Needs a **PO ruling**, not a patch — backend/PO ✅ **RESOLVED 2026-08-22 — PO ruled: REMOVE the disjunct; the noun rule stands unamended** (ADR [0134](../decisions/0134-case-surface-split-and-administrativo-case-read.md) **Amdt 8**). Gate is now `is_staff_admin_of ∨ member_can('create_cases')`, identical to `create_case_from_template`. ⚠ **Cutting the arm made Amendment 2's separate PHI gate STRUCTURALLY UNREACHABLE** — its predicate was the authority gate minus `is_admin` — so it was deleted rather than left as dead code a later reader counts as a second lock. ⛔ **The coverage everyone believed in did not exist:** NO pgTAP test pinned `is_admin` absence on ANY door; the `bulk_create_cases` comment claimed `314` §11.34 covered it and §11.34's subject is `is_tenancy_admin_of`. New pins are `357` §8d.1/8d.2 + `314` §11.36/11.37 — **new coverage, not a restoration**. Red-first: 6 tests RED pre-change, incl. the platform_admin genuinely minting a case. No under-grant (both arms exercised with PHI read-back); no dead-end (already 404'd upstream by `canInCommission`).
- 🟡 **FUP-CASE-PHASE-RESULT-ASSIGNEE-UNDERGRANT** — `set_case_phase_result_override` (⛔ **grain-corrected**: the assignee arm applies **only while the phase is `active`**; once `completed` it is coordinator-only — the original line quoted one branch of two as the whole guard) admits **assignee ∨ coordinator** (per-*phase*), but the UI prop is a per-*case* boolean, so a non-coordinator phase assignee is offered nothing. ⛔ An **under-grant emits NOTHING** — no error, no log, no failing test — so no §6 gate can find it, unlike a dead-end door's visible `42501` — frontend/PO ✅ **RESOLVED 2026-08-22 — PO ruled WIDEN THE UI to per-phase.** Delivered as a KIND (`none`/`set`/`correct`), not a boolean, mirroring the door's two branches; the per-case `canManagePhaseResults` boolean is gone. ⛔ **It could NOT land in the UI alone** — the server action `overrideCasePhaseResult` pre-gated with its own coordinator-only `authorizeCommission`, so a widened UI would have produced a dead end behind a friendlier string than `42501` ([[sql-door-is-not-evidence-about-its-ts-caller]]). Now membership-only, letting the DEFINER door be the boundary (Rule 1). ⭐ **The `isAdmin` short-circuit was DROPPED** — the RPC has no `is_admin` arm, so a hatted `platform_admin` passed the TS gate and was refused by the door; proven directly (N6), not inferred from a suite. Config-seam actions keep theirs (ADR 0100 D12 axis untouched). ⚠ **The filed claim was wrong in BOTH directions:** the assignee always had the end-of-wizard path, and the real gap was wider — an `active` phase offered nothing to **anyone**, coordinator included. **Five negatives proven at the door with positive controls** (without which every refusal is vacuous). ⛔ **Two residues filed, NOT folded into this close:** `FUP-PLAIN-STAFF-ASSIGNEE-CANNOT-REACH-THE-MANAGE-HOST` and `FUP-ACTIVE-PHASE-STASHED-OVERRIDE-IS-INVISIBLE`.

## ↩ Rotated from PROGRESS.md 2026-08-24 — the ADR 0137 "full-replace upsert on PHI" family

_The two 🟠 were filed as one family and resolved as one, in opposite directions: the DRAFT half was
a real overwrite and is FIXED; the POST-SEND half is NOT REACHABLE and closed by fixture. ⭐ Neither
outcome was knowable from the function definitions both were raised from — which is what the orange
one asked for and why it got a pgTAP arm before a patch. Lines verbatim; resolution appended._

- 🟠 **FUP-0137-MRN-BLANKABLE-AFTER-SEND** — `sent` stays amendable + `p_mrn` defaults NULL, so the erasure key can be blanked post-send; the cases-side analogue IS guarded. Read off live defs, no fixture — a pgTAP arm settles it — backend ✅ **RESOLVED 2026-08-24 — NOT REACHABLE, settled the way the item asked (fixture, not reading):** `supabase/tests/365_referral_mrn_persistence_floor.sql`, 12 tests green. ⚠ **Both premises were TRUE and the conclusion still wrong** — the missing fact is in a different object: the door's last statement (`update case_referral set has_patient = true`) trips **`app.guard_referral_status`**, a BEFORE UPDATE trigger refusing non-`draft` edits outside `app.in_referral_rpc`, which this door never sets, so the PHI upsert rolls back with it (verified attached + enabled + `tgqual is null`). ⛔ **The closure is INCIDENTAL, not designed** — nothing in `set_referral_patient` protects the MRN. Under neutralization (add the flag — the obvious way to "allow post-send amends") **§1.2 reds with `have: NULL`**: the blanking is real and one edit away. §2.2 is the keystone that reds on exactly that edit. ⭐ A second finding fell out and was filed rather than folded in: [[FUP-0137-POSTSEND-PHI-AMEND-IS-DEAD]].
- 🟠 **FUP-0137-RESUME-SWALLOW-SILENT-PHI-OVERWRITE** — `goToPatientStep` sets `resumePatientLoaded` BEFORE the await and swallows the failure, so saved PHI never reloads that session; the next keystroke's full-replace upsert BLANKS `mrn`/`name`/`date_of_birth`. D4's send gate catches only the MRN. ⛔ QA r1 R-3, unfiled until r2 caught it — frontend ✅ **FIXED 2026-08-24** — boolean → `resumePatientState` state machine set **after** the await (`error` on failure, no latch, retry on re-entry); `flush` **refuses** to write PHI while `error`; inputs disabled + a pt-BR banner so it is known before typing. Pinned by `referral-send-wizard-phi-failclosed.test.tsx` (4 tests). ⛔ **The first version of that test was VACUOUS — it passed with the guard removed**, because an empty buffer meant the flush's pre-existing `referralPatientDraftHasData` short-circuit was doing the work. ⭐ The overwrite is reachable **not by typing** (inputs are disabled) but via **`applyPrefill`** — a separate load with its own state, gated only on `isPending` — and the test now reds carrying **`"mrn": "MRN-EVENT-9"`**. ⚠ The neutralization record itself was wrong twice, both flattering: a "re-latch" is **two** edits (one alone left the file fully green) and it reds §1+§2, never §4.
- 🟡 **FUP-0137-FLUSH-FAILS-OPEN** — wizard proceeds on a null re-read, against its own docblock; sole guard against duplicate adds on retry, which `HC0T4` made common — frontend ✅ **FIXED 2026-08-24** — `if (fresh) {…}` → an explicit `if (!fresh) { setError(draftReloadFailed); return }`, in the same edit as the sibling above (same function, same swallow-becomes-silent-wrong-outcome family). ⛔ **Not separately test-pinned, stated rather than implied:** the path needs `onLoadDraft` to resolve null *after* a successful first load, which the new spec's fixture does not construct.
- 🟡 **FUP-0137-POSTSEND-PHI-AMEND-IS-DEAD** — `can_amend_referral_phi_snapshot`’s non-draft branch is structurally unreachable: the door’s own `has_patient` update trips `guard_referral_status` (HC070) for any non-`draft`. NOT a hole (3 independent reasons) — a decision owed. ⛔ Resolving it by adding the RPC flag ALONE opens the blanking `365` §1.2 red-proves — PO + backend ✅ **RESOLVED 2026-08-24 — PO-ruled shape (a): post-send PHI amendment is NOT a product capability, and the door now SAYS SO.** Migration `20261003001700` moves the refusal INTO `public.set_referral_patient`: any non-`draft` status is refused BEFORE the upsert with the door's own **HC078** and a message about patient data. Behaviour is unchanged (every such call already failed); what changed is WHEN, WITH WHAT CODE, and WHY — the caller was previously told *“mudanças de estado do encaminhamento devem passar pelas RPCs”* for a PHI edit. ⭐ **The two locks now fail independently, measured rather than asserted:** removing the door's arm alone reds `365` §1.1/§1.3/§2.1 but §1.2 stays GREEN (the trigger still rolls the upsert back); removing the arm AND setting `in_referral_rpc` reds §1.2 too — so the blanking that was ONE edit away now takes TWO. Harness: `supabase/tests/mutation/p0137-phi-door-mutation-audit.sh` (mutations 5/6). `can_amend_referral_phi_snapshot`'s `COMMENT` records that it governs draft re-saves only. ⚠ `365`'s header and §2.2/§2.4 were REWRITTEN, not just re-coded: its central claim (*“the closure is incidental”*) was the premise this change retired, and leaving that prose standing is the stale-tighter-rule shape. pgTAP 216 files / 7139 tests PASS — backend/PO
- 🟡 **FUP-0137-KIND-VISUAL-NO-FALLBACK** — widening `case_events_kind_check` in SQL touches no TS, so `KIND_VISUAL[ev.kind]` destructure THROWS and takes the card down; latent today (16=16 verified). ⛔ QA r1 R-6, unfiled until r2 — frontend ✅ **FIXED 2026-08-24** — `kindVisual(kind: string)` with an `UNKNOWN_KIND_VISUAL` fallback, and the comment reworded to claim what it delivers (exhaustive over the UNION, which is not a guarantee about `case_events_kind_check`). ⚠ **The parameter is `string` DELIBERATELY**: typed as `AnyCaseEventKind` the lookup is non-nullable, TS prunes the fallback as dead, and a reviewer reads unreachable code while the runtime value is whatever the CHECK admitted. ⭐ **The SIBLING was swept in the same edit** — `EVENT_KIND_LABEL[ev.kind]` on the same row yields `undefined` → an EMPTY chip, quieter than the throw and therefore likelier to ship; `kindLabel()` falls back to the raw kind. Pinned by 3 tests in `case-events-timeline.test.tsx`, all RED on the pre-fix build (the render THREW, so every assertion died at once) — frontend
- 🟡 **FUP-0137-ALERT-INSIDE-LABEL-MUTATES-NAME** — a `role="alert"` inside the wrapping `<label>` mutates the textarea's accessible name on failure; `useFieldIds`+`FieldError` is the house pattern one file over. ⛔ QA r1 R-7, unfiled until r2 — frontend ✅ **FIXED 2026-08-24** — adopted the house pattern (`Field` + `FieldLabel` + `FieldError` + `useFieldIds`), so the message is linked by `aria-describedby` instead of living inside the `<label>`. `nameRequiredFor: “formData”` is DECLARED (the action reads `formData.get('body')`). ⭐ **The test asserts INVARIANCE across the error transition, not the presence of a string** — the same `getByRole(“textbox”, { name: “Descrição do registro” })` runs either side of a failed submit; the clean-state half passes on the DEFECTIVE build too, so only the pairing reds. Paired with a presence assertion on the message, or a “fix” that simply DELETED the alert would inherit the green — frontend
- 🟡 **FUP-0137-PERSIST-REFRESH-DROPS-FOCUS** — `persist()` + `router.refresh()` resets `activeElement` to `<body>`, so a keyboard user re-Tabs (~40) per field. Verified by real Tab walk; NOT a D2 violation. ⚠ Scope by the PROPERTY (refreshes the route on an input event), not this one file — frontend ✅ **FIXED 2026-08-24 — and the item NAMED THE WRONG MECHANISM, which is what changed the sweep.** Measured in Chromium on a page isolating the candidates: disabling an ancestor `<fieldset>` while a descendant holds focus → `activeElement` = **BODY**; sibling churn around a REUSED node → **unchanged**; the node REPLACED → BODY. So it is the `disabled={isPending}` the transition toggles, firing BEFORE any refresh — `router.refresh()` is innocent. ⚠ That matters: the item's own predicate (*“does this component refresh the route on an input event?”*) matches **146 files** and still MISSES a component that disables without refreshing. The real property — *a control whose own change starts a transition that then disables it, on a surface that stays mounted* — swept to exactly **3**: `collects-patient-picker`, `commission-oversight-toggle`, `submissions-filters`, all fixed via the shared `usePendingFocus`. Verified END-TO-END in the real app with a positive control: neutralized, focus sits on `<body>` at every sample; with the hook it returns. Pinned by `use-pending-focus.test.tsx` (4 tests, incl. one PINNING that jsdom does not reproduce the browser blur — so nobody reads a green run here as browser coverage) + E2E `patient-mode-required.spec.ts` AC-R5, red-proven — frontend
- 🟡 **FUP-0137-BULK-WIZARD-STILL-BOOLEAN** — the bulk grid still reads deprecated `collectsPatient`, so a `required` template offers the PHI columns UNMARKED; the DB still refuses, so it is a worse error, not a hole — frontend ✅ **FIXED 2026-08-24** — `BulkTemplateOption.collectsPatient` → `patientMode` + `patientRequiredFields`; a `required` template now WELDS its identifier columns into the selection (`aria-disabled`, ticked, *“Exigido pelo processo”* — the builder's `mrn` idiom), `validateGrid` gained a `requiredPhiFields` arm that marks the offending CELL and names the short ROWS, and the toggle refuses a welded key in the handler as well as the renderer. ⚠ **The `sex = 'unknown'` SENTINEL is mirrored** — `coercePatientCell` writes that default for a blank cell, so a naive blank-check would find every row satisfied and advance a batch the door refuses row by row. ⭐ **And the CORRECTION this item recorded is discharged**: `HC0T1` really was absent from `bulk-error-map.ts`, so the bulk path returned the GENERIC string where the single-case path named the fields. Mapped, and red-proven by removing it again. 6 new model tests, each pairing the `required` case with the `[]` case so the regression half is covered — frontend
- 🟡 **FUP-0137-CASE-PATIENT-EDIT-NOT-MARKED** — `patientRequiredFields` is not threaded page → panel → dialog, so the case patient-edit dialog marks nothing; `_set_participant_patient_unchecked` still enforces — frontend ✅ **FIXED 2026-08-24** — `requiredFields` threaded `case-detail-view` → `CasePatientPanel` → `CasePatientEditDialog` → `PatientFields`, plus the create-dialog's submit gate and its `Faltam preencher:` line, word for word so the two surfaces cannot drift into two vocabularies for one rule. ⚠ Sourced from the CASE's OWN snapshot (`c.patientRequiredFields`), never the template's live set — `patient_mode` is frozen at creation (HC0T3), so a later template edit must not retroactively change what an open case demands. ⚠ The gate is suppressed while the audited reveal is still `loading`: the draft is empty until it lands, and gating on it then would tell a coordinator their COMPLETE record is missing every field — frontend
- 🟡 **FUP-0137-357-TWINS-ON-STALE-BODY** — `357`'s twins red-proved the **pre-0137** body this batch re-emitted; `ARM=census` cannot cover this fn (non-boolean, `app`). Re-run — backend ✅ **RESOLVED 2026-08-24 by measurement — all four twins BITE against the re-emitted body**, on a fresh reset (baseline `357`: 48 ok / 0 not ok). PHI write neutralized → **8 RED**; wrapper gate removed → **4 RED incl. BOTH K-CREATION-ONLY pins (4.1 + 4.2)**; helper ACL opened → **1 RED**; helper's own flag assert removed → **1 RED**. ⚠ **The 8 is NOT comparable to the 2026-08-22 record's 11** — that run's exact edit was never written down and `357` itself grew 43→48 assertions in between, so the honest claim is *“the current body is covered”*, not *“the count matches”*. ⭐ **Hand-running it again would have left the next reader exactly where this item found them**, so the twins are now a committed harness: `supabase/tests/mutation/p0137-phi-door-mutation-audit.sh` — each mutation is injected INSIDE `357`'s own transaction (nothing persists), the helper RAISES when a `replace()` needle drifted (a no-op mutation reporting GREEN is the failure this repo has already shipped), and every run DIFFS against a clean baseline instead of a hand-written expected-red list — backend
- 🟡 **FUP-REFERRAL-REVIEW-STEP-MRN-WARNING** — warn on the wizard's review step before `send_referral` refuses (`HC0T4`). ⛔ Buffer is NOT authoritative on a resumed draft, and ⛔ never fetch to power it (audited read) — frontend ✅ **FIXED 2026-08-24** — the review step renders `REFERRAL_MESSAGES.sendRequiresMrn` verbatim (no second string) as a non-blocking `role=“status”` note; the MRN input's `required` is untouched and `Salvar rascunho` still works. ⭐ **The binding constraint is honoured and TIGHTENED by measurement**: the buffer is authoritative only when `!isResume || resumePatientState === 'loaded'`. ⚠ The item's table implied `idle`-at-review was reachable; it is NOT — the only route to `review` runs through the patient step, and reaching that step fires the load (the step `<ol>` is not clickable, verified). The row that pays for itself is **`error`**: on a failed prefill the buffer is empty and an unguarded warning would fire on precisely the draft whose stored MRN this session could not read. Nothing fetches, so no `referral_patient.read` audit row is emitted for merely reaching review. 6 tests, each pairing a VISIBLE case with an ABSENT one; two neutralizations red exactly their own assertions — frontend
- 🟡 **FUP-CASE-DEPARTMENT-FIELD-HAS-NO-CONSUMER** — ADR 0137 D9 removed the "Unidade / setor" input from BOTH of `CaseDepartmentField`'s app call sites, leaving **only its own test**. ⚠ The Inc-1 brief's *"the hospital-admin surface still uses it"* is FALSE — that surface uses `DepartmentsManager`, a different component. Not a defect; a **decision owed** (delete · wire · keep-with-a-named-reason), and no gate can raise it again — PO + frontend ✅ **RESOLVED 2026-08-24 — PO-ruled option 1: DELETED** (`case-department-field.tsx` + `case-department-field.test.tsx`). It had no app consumer and its own test kept `tsc`, eslint and `lint:vacuous` satisfied forever — dead code wearing a green check, which no gate in the eight can distinguish from *“exercised by the product”*. The two call-site comments describing it as *“retained by decision”* were corrected in the same edit, and the edit-meta docblock now says where to recover it from if D9 is ever reversed. `DepartmentsManager` (the hospital-admin department VOCABULARY) is untouched — a different component, which was the false premise this item existed to correct — PO + frontend

## ↩ Rotated from PROGRESS.md 2026-08-24 — the LAST ADR 0137 PHI-mode shim

_The item verbatim (links repointed), with its closure appended. It was the one follow-up ADR 0137
left open on purpose: the shim protected the build deployed at the time, so it could only close
AFTER the code deploy, in its own migration. Body (now `⬛`) stays in [follow-ups.md](follow-ups.md)._

- 🟡 **FUP-0137-PHI-MODE-SHIMS** — ⚠ **HALF CLOSED 2026-08-24, and the remaining half is the one that can break production.** The three TS shims (`patientEnabled` / `collectsPatient` / `setTemplateCollectsPatient`) are **DELETED** — the builder adopted `patientMode`, and every consumer migrated with the bulk-wizard + case-edit fixes. ⛔ **`get_case_detail` still emits the derived `patient_enabled` key and MUST keep it until the code is DEPLOYED**: it is what the currently-deployed build reads, and dropping it first makes that build decide every case collects no PHI — `?? false` degrades SILENTLY. ⚠ And it is not the whole deploy story: the deployed build also selects the DROPPED `collects_patient` / `patient_enabled` COLUMNS directly, so those routes break on the new schema regardless — the schema→code window is real, not zero. Retire the key in its own migration AFTER the push — backend ✅ **RESOLVED 2026-08-24 — the last shim is gone.** Migration `20261003001800` removes the derived key from `get_case_detail` (re-emitted from `pg_get_functiondef`, with an anchor-uniqueness assert AND a post-patch catalog assert, so a drifted body fails loudly instead of patching nothing); `CaseDetailJson.patient_enabled` deleted. ⛔ **The deploy gate was discharged by the PO, not by a check** — no Coolify status is readable from this repo, and the pilot has no real users, which bounds the window to zero. Keystone: **pgTAP `366`, 10 tests** — two levels (catalog `prosrc` + the ENVELOPE the product receives), with vacuity controls, because `jsonb ? 'k'` is FALSE for an empty envelope, a NULL door and a refused call alike. ⭐ **Red-proven, not assumed**: re-adding the key moved the body md5 and reds exactly 1.1/2.1/2.5 (`have: true`); the restore was verified byte-identical to baseline (`0f72da26…`) by rebuilding from the migration chain, after a hand-patch restore silently left a stray newline. ⚠ **The item's own "verify by property" grep was WRONG and could never have returned zero** — `create_case(p_patient_enabled)` and the processless dialog legitimately carry those names; the surviving boolean there is filed as [[FUP-0137-PROCESSLESS-CASES-CANNOT-REQUIRE-PHI]].


## ↩ Rotated from PROGRESS.md 2026-08-24 — the processless PHI gap, closed BY RULING the day it was filed

_Filed and concluded the same day. ⛔ **Closed as EXPECTED BEHAVIOUR, not as fixed** — nothing about
the code changed, so the measured facts in the line below are all still TRUE of `main` today. That is
the whole reason the ruling lives in **ADR 0137 Amendment 4** and not only here: an archive is not
loaded, and a reader who re-measures `create_case` will re-derive this finding and be right about the
mechanism while wrong about whether it is a defect._

- 🟡 **FUP-0137-PROCESSLESS-CASES-CANNOT-REQUIRE-PHI** — ADR 0137's MRN floor does NOT reach processless cases: `create_case(p_patient_enabled boolean)` maps to `'none'`/`'optional'` and always writes `patient_required_fields = '{}'`, so **`required` is unreachable on that door** and its PHI floor stays the legacy `name OR mrn` — the "record the platform cannot later erase" the ADR calls a compliance hole, still open on the one path the ADR never mentions (grep: 0137 says "processless" zero times). ⛔ Do NOT close it by citing `app.guard_case_patient_required` — that trigger returns immediately when `patient_mode <> 'required'`, so it bounds nothing here. Three shapes, PO's call: (a) scope it out IN the ADR · (b) widen the door — a new DEFINER arm + authz re-verification · (c) MRN-always on this path, which invents a fourth floor the ADR warns against — PO decision, then backend + frontend ✅ **CONCLUDED 2026-08-24 — PO RULING: expected, and in line with platform specifications.** Shape **(a)** of the three offered. D1 puts the mode on the TEMPLATE VERSION because that is what makes it versioned, publishable and reviewable; a processless case has no version to carry one, and a per-case compliance setting would sit where nothing governs it. ⛔ **Scope, now stated in the ADR so it stops reading as universal:** D1–D3 deliver *a commission may REQUIRE the MRN on cases minted from a process template version* — not a platform-wide MRN mandate. ⛔ **Do not reopen this by widening `create_case`**: that is a new DEFINER arm owing its own authz re-verification, and it would reverse a ruling rather than fill a gap. ⚠ **The erasure consequence is ACCEPTED, not overlooked** — a processless case may hold a name-only record that an MRN-keyed erasure lookup cannot find, so ADR 0137 § Open's cross-module lookup must treat name-only rows as a known bounded population, never assume the key is universal. Full ruling → **ADR 0137 Amendment 4**.
- 🟠 **FUP-ADR-AMENDMENT-HAS-NO-BACK-POINTER** — an amended ADR reads as **live**; only the amending one records it. 0133's three targets held **zero** mentions of it, so 0048 D10 read *"no `date_of_birth`"* while the column shipped. ✅ Those 3 fixed 2026-08-23; ⛔ the class is not. Sweep reports **44** — ⚠ **do NOT quote it**: proximity-based, over-reports (`0073→0078` was an existing back-pointer misread). **Upper bound; 4 hand-verified.** Parse direction before any gate — lead ✅ **RESOLVED 2026-08-24** — detector now parses the declarative header (and its VOICE: `Amended:` ≠ `Amends:`), which killed this line's own named false positive `0073→0078`. ⛔ **44 is superseded**: the real population is **42 pairs over 30 amended ADRs**, only 5 of which had a hand-written back-pointer. All 30 now carry a generated banner, byte-compared by gate 9 (`lint:adr-index`). Body: `docs/progress/follow-ups.md`.

## ↩ Body rotation 2026-08-24 (ADR 0140) — resolved bodies moved out of follow-ups.md

Moved **verbatim** from [follow-ups.md](follow-ups.md): the full bodies of resolved items
whose index lines already live above in this archive. Trigger: follow-ups.md stood at
604 KB with 145 body headings, 47 of them for items no live register indexes;
`lint:progress` now REDS on such residue (the inverse of the R3 body check).

⚠ **Two index lines are RECONSTRUCTED here, not moved** — these two ids were in **no
register at all** (not in PROGRESS.md, not in deferred-backlog.md, not in this archive):
resolved per their own bodies, their index lines were evidently deleted instead of moved.

- ⬛ **FUP-DM5-MANIFEST-FLAG** — ✅ RESOLVED (already fixed when re-checked 2026-08-17).
  ⚠ Index line reconstructed 2026-08-24 from the body heading; the original was never archived.
- 🟠 **FUP-DM5-REMOTE-STATE-MEASURED** — ✅ RESOLVED same-day (the 7 stranded objects
  deleted; `db push` unblocked). ⚠ Index line reconstructed 2026-08-24 from the body
  heading; the original was never archived.

### The bodies
### 🟠 FUP-DM5-REMOTE-STATE-MEASURED — the remote was measured for the first time; **the "flags ship OFF" grading premise is WRONG at the grain it was used**, and 7 objects are stranded in two retiring buckets (owner: lead; **blocks the next `db push`**)

Filed 2026-08-17 (lead), from the first **read-only** contact with the linked project
(`azkbbhskturikxpgmafq`). The handoff banner named this the next session's first action precisely
because so many severities rested on it. Every figure below is a `select`, not an inference.

**1 · The remote holds ZERO application data.** `organizations` **0** · `profiles` **0** ·
`commissions` **0** · `cases` **0** · `documents` **0** · `document_versions` **0** ·
`document_version_files` **0** · `file_objects` **0** · `printed_documents` **0** ·
`controlled_documents` **0**. There are **no production users and no production rows**. This is the
true reason there is no production exposure, and it is *stronger* than the reason the record has been
giving — but it is a **different** reason, and the difference is the finding:

**2 · ⛔ The "flags ship OFF so the path is unreachable in production" grading is WRONG AT ITS GRAIN.**
Measured: all six document flags **are** off on the remote (`documents_foundation`,
`documents_wave_a`..`_d`, `document_printing` — all `enabled = false`; 31 other flags are on). But of
the **52** document-model functions in `app`/`public`, **51 do not read the flag at all** — exactly
**one** does (`app.compute_due_document_review_notifications`), and **no RLS policy** on any document
table consults it either. The flag is an **application-layer** gate. It does **not** make a DEFINER
door or a policy unreachable to anything holding a JWT and speaking PostgREST.

> ⭐ This is [[a-predicate-quoted-at-the-wrong-grain]] again, and it is the third time this phase: a
> **real** control (the flag genuinely is off) cited for a conclusion it does not bound (DB-level
> reachability). It reads exactly like a proof. **Re-grade on "the remote has no data", never on
> "the flags are off"** — and when the pilot loads data, the flag will *still* not be the boundary.

**3 · 7 objects are stranded in two retiring buckets, with nothing governing them.**
`printed-documents` **4** (`std/…pdf` ×1 + **`phi/…pdf` ×3**, 103–109 KB each, minted 2026-08-10,
`owner_id` NULL = service-role) and `controlled-documents` **3** (2 `.docx`, 1 `.txt`,
2026-07-21 → 2026-08-05). The two **core** document buckets are clean (`documents-standard` 0,
`documents-phi` 0). Separately `form-assets` holds **38** objects against **0** commissions — same
shape, outside DM scope, noted so it is not rediscovered as new.

*Inference, flagged as such:* one cause fits all of it — the remote DB was reset at some point and
**storage was not**, which is the mechanism in [[remote-reset-storage-orphan-is-cli-version-dependent]].
Not needed for anything below; the counts stand on their own.

**Reachability — measured, not reasoned.** `storage.objects` has RLS **enabled** with **8** policies,
and **none** of them grants SELECT on `printed-documents` or `controlled-documents` (the only
document-bucket policies are `documents_{phi,std}_obj_insert_reserved`, INSERT-only). So no tenant
JWT can read these bytes; they are reachable only by service-role, which is the app's own print path
(`open_printed_document`), and that path finds **no `printed_documents` row** to authorise. **Not an
exposure.** What they are is **permanently outside the disposal lifecycle**: every disposal path keys
off `file_objects`, and there is no row — so nothing can ever mark, complete, or evidence their
destruction. PHI-tier bytes that the platform's own retirement machinery cannot see.

### ✅ RESOLVED the same day — the 7 objects are DELETED and the push is unblocked

**PO-authorized 2026-08-17** (*"a remote database reset, including the S3 bucket, is acceptable — no
active users"*). ⚠ **The offered tool was declined and the reason matters:** a `db:reset:linked`
drops DB rows but **leaves storage objects behind** — that is the CLI-version-dependent orphaning
hazard in [[remote-reset-storage-orphan-is-cli-version-dependent]], and almost certainly **how this
state was created in the first place**. Resetting would have *recreated* the orphan condition, not
cleared it. The bytes had to go through the **Storage API**.

**Executed:** `supabase storage rm` per object, **by explicit path** — never a recursive/positional
sweep ([[a-positional-cleanup-eats-seed-rows]]). 7/7 reported deleted.

⚠ **The first attempt deleted NOTHING and reported success.** The CLI prompts
`Confirm deleting files in bucket …? [y/N]`, stdin is null in this environment, and the loop still
exited 0 — the exit code belonged to the pipeline, not the deletion. Caught by re-listing **before**
believing it (still 4 + 3), then re-run with `--yes`. Textbook
[[your-own-measurement-goes-stale-like-any-other]]: *"nothing failed" ≠ "nothing ran"*.

**Verified on BOTH surfaces after the fact**, which is the runbook's mandatory count-vs-census step:
CLI `ls -r` → `printed-documents` **0**, `controlled-documents` **0**; and `storage.objects` → the
only bucket with rows anywhere is `form-assets` (**38**). ⇒ **all EIGHT S4 retirement buckets are
empty**, so the Block-1 data guard now passes and `20260927000400` can be pushed.

**`form-assets` — ✅ ALSO CLEARED, PO-authorized separately.** It held **38** objects against **0**
commissions: equally stranded, but a RETAINED bucket (ADR 0114 D13) outside the document model and
blocking nothing, so it was deliberately left out of the first pass and raised as its own decision.
The PO then authorized it. Remote storage is now **12 buckets / 0 objects** total.

### ⛔ INCIDENT — `supabase storage rm -r ss:///<bucket>` DELETES THE BUCKET, not just its contents

Hit live on the remote, 2026-08-17, clearing `form-assets`. The flag reads
`--recursive, -r  Recursively remove a directory`, and the object paths are `{org}/{file}`, so `-r` on
the bucket root is the natural way to say *"remove everything inside"*. It is not. The output ends:

```
Deleting objects: [ …38 paths… ]
Deleting bucket: form-assets          ← NOT asked for
Successfully deleted
```

**Blast radius, measured rather than assumed:** the `storage.buckets` row was gone (12 → 11); the RLS
policies `form_assets_insert_staff_admin` / `form_assets_select_member` **survived**, because they live
on `storage.objects` and are not tied to the bucket row. So the failure mode is a bucket that no longer
exists while every policy still references it — uploads would fail at runtime with nothing in
`pg_policies` looking wrong.

**Restored** from the authoritative definition — `20260620000000_baseline.sql:24962`, cross-checked
against the live LOCAL row, which agrees exactly: `public=false`, `file_size_limit=5242880`,
`allowed_mime_types={image/png,image/jpeg,image/webp,image/gif}`. Verified after: 12 buckets, 0 objects,
`form-assets` present. ⚠ The pre-deletion REMOTE row was never captured, so the restore is to the
**migration's intent**, not to a measured prior state — if the remote had drifted, that drift is gone.
*Capture the row before deleting anything that owns rows.*

⚠ **Binding on the ADR 0120 D9 byte-deletion runbook**, which sends an operator to do exactly this
against a live project: **delete by explicit object path, never `-r` on a bucket root.** The project's
own `scripts/storage-manifest.mjs delete --execute` is safe here — it calls `remove()` with an explicit
path list — which is another reason to prefer it over ad-hoc CLI.

⭐ The same shape as the confirmation-prompt miss two steps earlier: **the tool did what it was told,
not what was meant, and reported "Successfully deleted" either way.** Read what a destructive command
*enumerated*, not just its exit line.

⭐ **A cheap CLOUD-ORPHAN-SURFACE sub-probe fell out of this for free.** That item names
*"whether `supabase storage ls --linked --experimental` differs from a `storage.objects` query"* as a
secondary probe. Both were run here, before and after: **they agreed exactly, in both states.**
⛔ That does **not** settle the item — agreement is equally consistent with the CLI simply reading the
same metadata (the likely explanation, since it speaks the Storage API). It rules the CLI **out** as
an orphan-visible surface; the **S3 endpoint remains UNPROBED**.

**4 · ✅ The S4 guard will fire, and that is the designed outcome — but it BLOCKS the next `db push`.**
⚠ **PRESENT TENSE HERE IS HISTORICAL — read the "✅ RESOLVED the same day" section above first.** The
7 objects were deleted 2026-08-17, all eight retirement buckets are empty, and `20260927000400` is
**pushable**. This paragraph is preserved as the measurement that *predicted* the abort correctly;
it is not a live blocker. ⛔ The **ordering** it states (byte-first, D9) still binds on any future run.
`20260927000400_dm5_s4_retire_legacy_buckets.sql` Block 1 counts `storage.objects` per bucket and
`raise exception`s naming the bucket and count. It is the **earliest of FIVE** local-only migrations
(⚠ this read *"one of only two"* until re-measured 2026-08-17 — the batch added three more after it:
`…0928000200`, `…0928000400`, `…0928000500`), so
the next `db push` **will abort** on `printed-documents (4)` and `controlled-documents (3)`. Nothing to
fix — the guard is correct and my measurement says exactly when it fires. **Ordering owed (ADR 0120
D9, byte-first):** `scripts/storage-manifest.mjs capture` → `delete --execute` **against the remote**,
then push. ⚠ And per the D9 Cloud half above, `locateVolume()` now **refuses** on a Cloud URL, so that
deletion runs **without** byte-level proof — the API-only over-count refusal survives, the byte-side
controls do not.

**5 · `scripts/document-reconciliation.mjs` would have caught #3 and has never been pointed at the
remote.** Checked rather than assumed: `BUCKETS` walks only the core two, **but** line 368 censuses
`[...LEGACY_BUCKETS, ...RETAINED_BUCKETS]` — `printed-documents` and `controlled-documents` are both
in `LEGACY_BUCKETS`. The tool is **correct and sufficient**; the gap is that it has only ever run
against local. ⚠ Its comment *"DM5 S4 retired 8 of those 12 — only `documents-standard`,
`documents-phi`, `form-assets` and `meeting-audio` still exist"* is **true locally and FALSE on the
remote** (12 buckets live) — [[a-comment-is-an-assertion-that-goes-stale-silently]] in the narrow form
where the subject is another system. Fixed in the same commit.

**⛔ What this does NOT settle.** It does **not** touch **FUP-DM5-CLOUD-ORPHAN-SURFACE**, and the
distinction is the whole point of that item's promotion ruling. **Two different "orphans":** what I
found are **reconciler-orphans** — a `storage.objects` row with no `file_objects` row, *visible* to a
metadata query, which is how I found them. That item asks about **byte-orphans** — bytes in the
backing store with **no `storage.objects` row**, invisible to every query I ran. I read the metadata
side only; **the S3 endpoint remains UNPROBED** and that item's severity is unchanged. Recording this
explicitly because that section's own ruling is *"a buried obligation gets discharged by association
the moment its parent looks resolved"* — remote contact having been made is exactly the kind of event
that would otherwise be misread as having settled it.


### ⬛ FUP-DM5-BACKEND-STATE-SLICE-SECTIONS — ✅ **RESOLVED 2026-08-18** — the per-slice `backend-state.md` sections for **S2 / S3 / S5** are written (owner: **backend**)

> ### ✅ RESOLVED 2026-08-18 (backend). Three `##` sections added to `docs/backend-state.md`, in the
> chronological body between the **DM5 follow-up batch** and **DM4** sections: `## DM5·S5` ·
> `## DM5·S3` · `## DM5·S2`. Every figure carries its deriving query inline, per the S6 convention.
>
> **Derived from the LIVE catalog only** (local stack, read-only; registry **411 == 411**), never
> from migration text, the slice records, or graphify: `supabase_migrations.schema_migrations`
> (slice ranges, bounded by the **registry interval**, not a filename pattern) · `pg_proc`
> (`prosecdef`, `provolatile`, `proconfig`, `proacl`, `pg_get_functiondef`,
> `pg_get_function_identity_arguments`, `pg_get_function_result`) · `pg_constraint` +
> `pg_get_constraintdef` · `pg_attribute` (+ `attacl` / `has_column_privilege`) · `pg_class.relacl` ·
> `pg_trigger` · `pg_policy` / `pg_policies` · `pg_extension` / `pg_namespace` (the no-scheduler
> proof) · `storage.buckets` / `storage.objects` policies.
>
> **Every DM END STATE aggregate figure re-derived and REPRODUCES**: 411==411 · 13 doc-model tables
> × exactly 1 policy · 38 document-surface doors, 5 of them not EXECUTE-able by `authenticated` ·
> 4 buckets · 4 `storage.objects` policies (3 INSERT + 1 SELECT) · 165/165 RLS · the flag census
> **75 functions / 6 read a flag**. No aggregate figure was retired.
>
> ⛔ **Writing the sections found FOUR defects in the `###` stamps the aggregate block carries** —
> corrected in place there, derived in the new sections:
> 1. **S3 stamp header said "`…000350`, 6 migrations" — the registry says SEVEN** (`…000360
>    dm5_s3_r1_mint_unique_violation_discrimination`, the QA-r1 fix). *A range typed at authoring
>    time does not know about the migration the review adds.*
> 2. ⛔ **S3 stamp: "A trigger on `responses` mints/drops its securable" — THERE IS NO SUCH
>    TRIGGER.** `responses` carries 5 user triggers, none touching `securable_resources`; the
>    `form_response` securable is minted **lazily inside `mint_printed_document`**, and the
>    function's own comment says ADR 0120 **D17.2** rejected the trigger *on purpose*. ⭐ The claim
>    did not merely go stale — it asserts the exact mechanism the design wrote a paragraph to refuse.
> 3. **S2 stamp: "`securable_resources_tenant_shape` … `capa_action` (org + hospital, NULL
>    commission)"** — the CHECK places **no** constraint on `commission_id` and the column is
>    nullable. **NULL-commission is the INTENT, not the constraint.**
> 4. **S2 stamp's "admits 8 types" is now 9** (S3 added `form_response`) — true as a delta, wrong as
>    current state; both bounds now stated.
>
> ⚠ **Three more figures were right only under an unstated bound, and the bound is now written down:**
> **(a)** `FUP-DM5-DISPOSAL-JOB`'s *"three inflow doors"* — there are **4** SET-form writers of
> `disposal_pending`; 3 are `authenticated`-reachable and the 4th,
> `complete_document_reclassification`, is service-role-only, so the queue is fed wider than the
> figure says. **(b)** The DM5 follow-up-batch section's *"`authenticated` holds SELECT and nothing
> else"* on the evidence tables — the ACL is **`rm`** (SELECT + MAINTAIN); the security conclusion
> holds (no `a`/`w`/`d`), the literal string does not. **(c)** The S3 stamp's *"FIVE write guards"*
> is a curated set; the property-bounded enumeration (*body references `printed_documents` AND
> raises*) returns a **different** five, and the union is **7** — `guard_printed_document_binding`
> raises **`HC0DA`**, outside the `HC0D[KLN]` family an errcode sweep would use.
>
> **Nothing failed to reproduce**; no figure was carried forward undivided. Two figures are stated as
> *structural* rather than populated: `file_objects` and `printed_documents` both hold **0 rows** on
> this stack, so the disposal census comes from function bodies and ACLs, not data — the measured
> form of C1's UNREHEARSED gap.
>
> ✅ **S4 ADDED 2026-08-18 on a second PO ruling** — `## DM5·S4` now sits between the S5 and S3
> sections, so **all four DM5 slices have one**. Derived from: `schema_migrations` (the interval is
> **1** migration, `20260927000400`, derived not assumed) · `storage.buckets` · `pg_policy` on
> `storage.objects` (**`polcmd` census: 3 INSERT + 1 SELECT; ZERO DELETE / UPDATE / FOR ALL**) ·
> `pg_class.relacl` (`arwdDxtm` to `authenticated` **and `anon`**) · `pg_trigger` (`protect_objects_delete` /
> `protect_buckets_delete`, both **BEFORE DELETE STATEMENT**) · `pg_proc` (`storage.protect_delete`
> is role-agnostic, verified from the body) · `pg_constraint` (`file_objects_bucket_check` /
> `_bucket_from_tier`). **Residue sweep: all NINE retired bucket names score 0 across function
> bodies (comment-stripped), policy expressions and constraint defs. The census sums — 13 historical
> names = 4 live + 9 retired.**
>
> ⛔ **S4 added a THIRD catalog-false stamp claim and the FIRST figure that does not reproduce at all:**
> **(i)** *"`begin_document_upload` is the only thing that names a bucket"* — three functions do, plus
> two CHECK constraints and a client-side constant; **`app.printed_rendition_storage_bucket` landed at
> S3, so the claim was false when authored, not aged.** The correctly-bounded version is in
> `docs/reviews/dm5-s4-review.md:334` — **the stamp is a compression of it into a false absolute.**
> **(ii)** ⛔ **"4 / 6 / 4 / 13 other callers" — RETIRED, does not reproduce under any bound**
> (measured: fn `5/5/5/12`, policy `8/7/8/11`, combined `13/12/13/23`; the stamp never said which it
> counted, and two of the four drift the wrong way for a later-addition story). ⭐ **Its conclusion
> survives untouched — every count is ≥5.**
>
> ⚠ **Two traps I walked into and had to back out of, both recorded in the section because they are
> the item's whole point:** **(a)** grepping `src/` for bucket names as **string literals** returned
> `'attachments'` ×3 and `"interview-attachments"` — which are a **feature-flag key** and a **`domId`**.
> A string-literal bound is a *syntax* bound. **(b)** I nearly filed "the retirement has no standing
> pin" — `325_legacy_bucket_policy_pin.sql` t6/t7/t8 pins it thoroughly, **with an explicit positive
> control** (t8: a sweep that retired *everything* would satisfy t7 and fail t8). *Absence of a
> verdict is not absence of coverage; neutralize before escalating.* The one true residual: the pin
> is keyed to a **closed list of names**, and no assertion anywhere reads the **total** bucket count
> (complete enumeration: 7 lines across 4 files read `storage.buckets`, all name-keyed).
>
> ⚠ **The sweep's own domain was under-wide on the first pass** — it began as the DM5 record's twelve
> names and missed **`meeting-attachments`** (retired earlier at F2's `20260921000300`), which
> surfaced only from the pgTAP estate. ⛔ **The dead set cannot be enumerated from the live catalog at
> all** — a retired bucket leaves no residue to find — which is exactly why retirement had to be a
> migration and why the only standing assertion possible is over the **surviving** set.
>
> **Deployment:** as of the **2026-08-18 push** local and remote are both at `20260928000500`; the
> retirement is LIVE on the remote. The S4 section states that and carries no "local-only" phrasing.

✅ **PO-RULED 2026-08-18: yes, still wanted — written by the `backend` engineer as ONE small task, before DM5 closes.**

⛔ **Filed 2026-08-18 with an ID because it did not have one, and that was the whole risk.** Raised by
the **S6 QA (F6)**, re-homed by the **DM5 phase QA**, and carried into the gate-step-4 docket as item
6 — but it existed **only** inside those three documents and the `🛑 START HERE` block, which is
retired the moment the docket is answered. ⭐ *A body plus a narrative mention is not an index entry;
the index is what a reader greps* — the exact class as phase-QA finding **R3**, re-earned one item
later, by an obligation whose stated purpose was *"named explicitly so it cannot die quietly when DM5
closes."* **Naming a thing in the document that expires is not naming it.**

**Scope.** Three sections in `docs/backend-state.md`, one per slice — **S2** (NSP RCA/CAPA evidence),
**S3** (prints onto the core substrate), **S5** (operational closure). The DM END STATE block S6
wrote is the *aggregate*; these are the per-slice surface deltas that let a future session see what
each slice changed without re-deriving it.

⚠ **Derive every figure from the live catalog, never from the slice records** — those are exactly the
documents whose staleness this file exists to replace, and this program has already shipped
`backend-state.md` currency stamps that were themselves stale (*"stale by three slices … registry
391→407"*, corrected at S6 to a measured **411==411**). Each figure carries its query, per the
convention S6 established.


### ⬛ FUP-DM5-SETLOCAL-MIGRATION — `SET LOCAL` in a migration is **not guaranteed to be inside a transaction**; `20260921000300` still relies on it (owner: backend)

> ## ✅ RESOLVED 2026-08-18 — the watermark-bounded gate is BUILT, WIRED, and VALIDATED AGAINST GROUND TRUTH
>
> `scripts/check-migration-set-local.mjs`, wired as **`lint:set-local`** — the **sixth** gate in the
> `npm run lint` chain. Current state: **2 migrations above the watermark, 411 grandfathered, 0 findings.**
>
> **It is a position scanner, not a regex.** The whole question is *context* — the same eight characters
> are a defect at top level, correct inside `do $$`, and irrelevant inside a comment or a string. It
> tracks line comments, **nested** block comments, `''`-escaped strings, quoted identifiers, `$tag$`
> bodies (consumed whole; `$1` is *not* a quote opener) and explicit `begin`/`commit` depth.
>
> ### ⭐ The validation that matters: it reproduces the BEHAVIOUR's answer exactly
> Swept over **all 413** migrations with the watermark ignored, it returns **4 files / 6 sites** —
> `20260710000000:40` · `20260711000200:68,73` · `20260921000300:58` · `20260925000300:100,118` — which
> is *precisely* the set Postgres itself named via its `25P01` warnings during a reset, **line numbers
> included**, while correctly clearing the other 8 of the 12 files `grep` flags. The ground truth was
> established by the runtime, independently of this scanner. That is what retires the "syntax finds 12,
> behaviour finds 4" objection: it is retired **empirically**, not by argument.
> → [[detector-that-finds-nothing-must-be-proven-able-to-find-something]]
>
> ### The positive control the ruling demanded — three layers
> 1. **23 in-process fixtures**, run before every scan; the gate refuses to report if they fail.
>    The load-bearing one is *"bare `set local` AFTER a closed do-block"*: a scanner that enters a
>    dollar quote and never leaves would pass **every file in the repo** silently, and that fixture is
>    the only one that can catch it.
> 2. **End-to-end injection**: a bare `set local` appended to an in-scope migration → **RED, exit 1**,
>    correct file:line. Appended to a *grandfathered* migration → **green** (the watermark bound holds
>    end-to-end, not just in a unit). Wrapped in `do $$ … $$` in an in-scope file → **green**.
> 3. **Scope fixtures** pin the boundary itself, including that the watermark file *is* grandfathered
>    (strictly-above, not at-or-above).
>
> ### ⛔ The watermark is a GRANDFATHER LINE — do not bump it on a push
> Written at length in the script header, because the obvious "maintenance" is the one thing that
> breaks it. Advancing it after each `db push` would grandfather the files you just wrote, converting
> a gate that rots toward **stricter** into one that rots toward **weaker** — reversing the exact trade
> the PO made. It never needs updating.
>
> ### One real defect found while validating
> Importing the module for the all-migrations sweep **executed the CLI block**, which can
> `process.exit(1)` and kill an importing test run. Guarded with an `import.meta.url` vs `process.argv[1]`
> main check. Observed, not theorised — the sweep printed the gate's own summary line into my results.

> ## ⛔ THIS ITEM HAD NO PROGRESS.md INDEX LINE UNTIL 2026-08-18 — added that day
>
> It has a full body here and is named in **five** documents, but `grep SETLOCAL PROGRESS.md` returned
> **nothing** for its entire life, so the next §6-step-5 rotation would have dropped it silently.
> ⭐ *A body plus a narrative mention is not an index entry; the index is what a reader greps.* That
> warning is written twice in the register itself — this is the **third** item to re-earn it.
>
> ## ✅ REMEDY RULED 2026-08-18 (DM-FUP TRIAGE #7) — **a WATERMARK-bounded static lint gate, no allowlist**
>
> The lead proposed an allowlist of the frozen files and **was wrong**; the PO's instrument is better.
> Bound the gate by the **frozen watermark** (`20260928000500`) instead: check only migrations *above*
> it. **Measured: all 12 files containing `set local` sit at or below the watermark. Zero above.** So the
> gate starts green with **nothing to allowlist** — no entry to rot, no anti-join to maintain.
>
> ⭐ **The failure directions are opposite, and that is the whole argument.** A stale **allowlist** rots
> toward *weaker*: an entry outlives its file and silently skips it (`FUP-AUTHZ-ALLOWLIST-ROT` found six
> such entries where the filing named one). A stale **watermark** rots toward *stricter*: it starts
> checking newly-frozen files and reds **loudly**. Given a choice of rot, choose the one that fails loud.
>
> **Two consequences:**
> - Because nothing existing sits above the line, the gate can be a **fast static check inside
>   `npm run lint`** rather than a slow reset-log check in the Phase Gate. The "syntax finds 12, behaviour
>   finds 4" objection dissolves — those 12 are excluded by construction, not by judgement.
> - ⚠ It still needs a **positive control** proving its `do $$` / explicit-`begin` nesting detection can
>   actually fail. A gate nobody has seen fire is not a gate.

> ⛔ **STALE, CORRECTED 2026-08-18 — read this before the "still editable in place" paragraph below.**
> That paragraph says *"the five local-only ones ARE still editable in place."* **They are not.** The
> `db push` executed 2026-08-18 applied all five; the remote is at **`20260928000500`** and **zero
> local-only migrations remain**. Nothing at or below that version may be edited in place — the editable
> window did not move forward, it **closed**. → [[a-records-claim-about-an-external-system-goes-stale-silently]]

> **⛔ CORRECTED 2026-08-17 by QA (S4 review).** Two claims in the original filing below were wrong:
> 1. **It is NOT e2e-path-specific.** A plain `npx supabase db reset --local` emits **six** `25P01`
>    warnings, one of them from `20260921000300` itself. The lead's standalone reset had simply been
>    read with `tail -25`, which cut them off.
> 2. **The lead's "the opt-in is load-bearing" probe was taken at the WRONG GRAIN.** It probed the
>    **post-reset live DB**, where `protect_delete` genuinely raises `42501` — but that is not
>    *migration-apply time*. QA's surviving hypothesis (stated as hypothesis, not demonstration): the
>    trigger **is not in force while migrations apply**, because `storage.migrations` row 55
>    (`prevent-direct-deletes`) re-executes during the reset. That explains the otherwise-unexplained
>    fact that the DELETE succeeded despite a no-op opt-in.
>
> **The fix still stands and is still correct** — the `do`-block form removes the dependency on the
> runner's transaction handling either way, and was re-proved by QA. Only the causal story changes.
> ⭐ *A probe answers the question at the grain you took it; "the guard refuses" and "the guard refuses
> **at apply time**" are different claims.* → [[a-predicate-quoted-at-the-wrong-grain]]

> ## ⛔ RE-SCOPED 2026-08-17 — THREE different enumerations, and the REMEDY IS BLOCKED
>
> **The count, measured three ways, giving three answers:**
> | method | answer |
> | --- | --- |
> | this item, as filed (one specimen someone noticed) | **1** migration |
> | `grep -l 'set local' supabase/migrations/` (bounded by a SYNTAX) | **11** migrations |
> | ⭐ **the reset's own `25P01` warnings** (bounded by the BEHAVIOUR) | **4 migrations, 6 sites** |
>
> Only the third is the defect set. The other seven `set local` uses are already inside a
> `do $$` block or an explicit transaction and never warn. Sites, triaged — **they do not
> share a severity**, which the single-specimen framing hid:
> - 🔵 `20260710000000_nsp_per_hospital:40` — `check_function_bodies = false`. **Benign**: a
>   no-op here makes `CREATE FUNCTION` fail **loudly**, and it is a validation setting, not a
>   security bypass.
> - 🟠 `20260711000200_answers_form_fk:68,73` · 🟠 `20260925000300_dm3_domain_core_binding:100,118`
>   — **the dangerous class**: a GUC that bypasses an immutability guard, wrapped around a
>   **data-dependent backfill**. On a fresh local reset the backfill matches **0 rows**, so the
>   guard never fires and the no-op is invisible; on a data-bearing target it is not.
>   Exactly [[backfill-guard-wrap-data-dependent-migration]].
> - 🟠 `20260921000300_retire_meeting_attachments_bucket:58` — the originally-filed site.
>
> ### ⛔⛔ AND THE IN-PLACE FIX IS NOT AVAILABLE: all four are APPLIED ON THE REMOTE
> Measured with `supabase migration list --linked`: the remote carries every migration through
> **`20260927000360`**, i.e. **DM1–DM5·S3 have been pushed**. ⚠ **Re-measured 2026-08-17: FIVE are
> local-only, not two** — `…0927000400` (S4) · `…0928000100` (recusal) · `…0928000200` (evidence
> revoke) · `…0928000400` (D4 contract) · `…0928000500` (finalize-atomic); `…0928000300` was the
> reverted D11 inflow and does not exist. Editing applied history creates the
> drift that blocks `db push` — *restore, don't repair*. ⛔ **The five local-only ones ARE still
> editable in place** — the "not available" verdict below applies only to the four APPLIED files.
>
> ⚠ **This contradicts `dm5-handoff.md` §13.1, which states "NOTHING PUSHED, no `db push`, no
> remote reset … remote never touched by DM1–DM5". BOTH halves of that sentence are false** —
> `origin/main` is also a DM5·S5 commit. **Nothing downstream may rely on either claim.**
>
> **Past state is fine and this is not an incident:** all four applied successfully, and
> `answers_form_fk`'s following `alter column … set not null` would have failed had its backfill
> silently skipped rows. The residual risk is **future invocations**, so the remaining remedy is
> the **lint gate** below — a gate change, and therefore a PO decision, not a mid-batch edit.
>
> ⚠ **Two consequences that outrank this item.** S4's bucket retirement (`…000400`) has **never
> reached the remote**, so ADR 0120 **D9**'s binding "delete bytes by manifest FIRST" ordering is
> still owed against a **live remote** — and `FUP-DM5-CLOUD-ORPHAN-SURFACE` stops being
> theoretical. And every follow-up resting on *"the flags ship OFF so the path is unreachable in
> production"* now depends on the **remote** flag state, which **no one in this record has
> measured**.

Filed 2026-08-16 (lead) from a live near-miss in DM5·S4. `supabase db reset` **as invoked by
`scripts/e2e-prod-gate.sh`** emitted `WARNING (25P01): SET LOCAL can only be used in transaction blocks`
against `20260927000400`, whose destructive `delete from storage.buckets` is gated on
`set local storage.allow_delete_query = 'true'`. **`SET LOCAL` outside a transaction is a silent no-op.**

**The opt-in is genuinely load-bearing** — probed in a rolled-back txn: without it,
`delete from storage.buckets` raises **`42501` from `storage.protect_delete()`**; with
`set_config(..., is_local => true)` inside a `do` block, it succeeds.

- ✅ **S4's own migration is FIXED** — opt-in and DELETE moved into one `do` block, which always runs
  inside a transaction (its own, if none is open). Applies with no warning; catalog re-verified.
- ⛔ **`20260921000300_retire_meeting_attachments_bucket.sql` still carries the original idiom.** It is
  applied history and was deliberately left alone. It is fine wherever the runner wraps the file — which
  is exactly the problem: *the correctness is conditional on an undocumented property of the tool that
  applies it*, and **`db push` to the remote is a different invocation from `supabase db reset`.**
- **Worth a lint gate:** flag `set local` at migration top level (outside `do $$`/explicit `begin`).
  Cheap, and it is the same class as the four existing non-eslint gates — each added after the class
  shipped a live defect.

⚠ **Unexplained, recorded as such:** in the observed e2e-path run the migration did **not** error after
the warning (the log continues to `Seeding data`; that batch failed later on an unrelated 502). Given the
probe, a delete matching ≥1 row without the opt-in must raise — so either it matched 0 rows there or the
session already held the GUC. **Not reproduced, and no mechanism invented for it.**


### ⬛ FUP-DM5-MANIFEST-FLAG — ✅ **RESOLVED — and it was ALREADY FIXED when re-checked 2026-08-17** (owner: backend)

> **✅ RESOLVED.** Re-measured before being worked on, and the guard was already live —
> shipped in S5 (selftest control **C11**) but never marked here. Measured:
> `capture --manifest /tmp/x.json` prints *"unknown flag "--manifest" for "capture" — that
> is "verify"/"delete"'s flag"*, refuses to run, and **exits 2** — exactly the remedy this
> item specified. The committed baseline was **not** touched (`git status` on
> `supabase/manifests/` clean).
>
> ⚠ **A method note worth more than the item.** The first exit-code reading was taken
> through `| head -5` and came back **0**; the real code is **2**. That is
> [[gate-summary-can-hide-unrun-tests]]'s sibling — *a pipe reports the PIPE's exit code* —
> the same mechanism that once masked an `exit 2` as `0` in a mutation sweep. **Never read
> an exit code through a pipe.**

Filed 2026-08-16 (lead) from a live near-miss during S4. `capture` takes **`--out`**; **`--manifest`** is
`delete`'s flag. Passing `--manifest <scratch-path>` to `capture` did not error — `argFlag` returned nothing
and the code took `?? DEFAULT_MANIFEST`, **overwriting the committed S0 baseline**
(`supabase/manifests/dm5-retirement-baseline.json`). Caught by `git status`, restored with `git checkout`.

**Why it is worth fixing rather than remembering:** this is a tool whose entire purpose is to be the
authoritative record immediately *before* an irreversible deletion, and its failure mode on a typo is to
**silently overwrite the previous authoritative record**. A wrong-but-plausible flag is exactly the input it
must be hostile to. Fix: reject unrecognised `--flags` with exit 2, and/or refuse to write the default
manifest path unless `--out` is given explicitly.

⭐ **The accident was also a free verification, worth keeping:** the diff showed the retirement-bucket
figures **byte-identical** to S0's (only `capturedAt` and the core-bucket census moved) — an independent
reproduction of the 221 files / 6.93 MB / 15 PHI-tier orphan census, four days apart.


### ⬛ FUP-DM5-DANGLING-PRINT-ON-DELETED-DRAFT — ✅ **CLOSED 2026-08-18** (`20260928000800`, ADR [0123](../decisions/0123-discarding-a-draft-that-has-emitted-documents.md)) — a print of a DRAFT response outlives its response, invisible to every UI (owner: backend)

> ## ✅ CLOSED 2026-08-18 — and re-deriving the shipped fix found TWO MORE DEFECTS
>
> Migration `20260928000800`. `312` **80 → 85**, red-first. The item is closed on **four** answers,
> two of which are to questions it never asked:
>
> **D1 — the guard was WRONG, not merely incomplete.** `20260928000700` argued *"Only an ACTIVE print
> represents a live page."* ⭐ **That sentence is false by this platform's own ruling.** ADR 0120
> **D6/D8** — established the hard way by the D11 serving collision — says states change the overlay
> **STAMP, never reachability**: a `superseded` print still serves bytes and still answers
> `/verificar`. Reachable through supported actions only: mint P1 → re-mint (the mint's own
> `SUPERSEDE_ACTIVE` flips P1) → coordination revokes the active P2. **Zero actives, one superseded,
> guard open.** The exit holds: `revoke_printed_document` refuses only `status='revoked'`, so a
> superseded row can still be voided (`312` t79 pins exactly that).
> → [[a-partial-fix-reads-as-a-complete-one]] · [[a-comment-is-an-assertion-that-goes-stale-silently]]
>
> **D3 — the mint read its source UNLOCKED, and no arm was asking.** The guard is `BEFORE DELETE`;
> nothing ordered it against a concurrent mint. **Measured**, not reasoned, in a scratch schema:
> unlocked → *delete succeeds, mint commits after,* **orphan created**; with `for key share` → delete
> blocks, then the trigger raises; reversed → the locked select returns **zero rows** and the mint
> aborts on its **existing** `HC0D1`. Works because Postgres takes `LockTupleExclusive` **before**
> running a `BEFORE DELETE` trigger body. The whole fix is `for key share` on one `select`.
> ⚠ **Not pinnable behaviourally** — pgTAP is single-session, so `312` t81 pins it **structurally**
> from `pg_proc`. Weaker, and said out loud rather than papered over: the alternative was a comment.
>
> **D4 — pre-existing orphans: the subject was EMPTY.** Measured on **both** environments: production
> `0` prints / `0` responses / `0` documents / `0` dangling securables; local `0` after reset. ⭐ The
> item's own *"6 of 9 local prints are `form_response` kind"* was **E2E residue in a since-reset DB**,
> quoted forward for four days as a population. A reconcile would have had nothing to reconcile.
> ⛔ **The measurement expires at the pilot** — the set is empty because nothing exists yet; D1+D3 are
> what keep it empty. → [[your-own-measurement-goes-stale-like-any-other]]
>
> **D5 — the dangling securable: the obvious repair was the DEFECT.** Both `app.can_read_document` and
> `app.can_write_document` open with `documents d join securable_resources s on s.id =
> d.home_resource_id` and return **false** when the join misses. **Deleting** the orphaned securable
> would silently revoke `request_document_disposition` for that print — **D11's only outflow** — and
> leave unreachable bytes with no disposition authority at all. It is **retained by design** as the
> historical home anchor; the full post-deletion semantics table is ADR 0123 D5.
>
> ## ⚠ A THIRD DEFECT WAS FOUND HERE AND DELIBERATELY NOT FIXED HERE
>
> `can_view_printed_document`'s `form_response` arm grants its `staff_admin` term only when
> `status = 'submitted'`, and that predicate **is** the `printed_documents_select` policy — so a print
> of an `in_progress` draft is invisible to **every coordinator except its creator**, with the source
> still alive and no deletion involved. Filed as **FUP-DM5-DRAFT-PRINT-INVISIBLE-TO-COORDINATION**
> rather than folded in: closing this item over a new door with no UI caller would have been a
> [[correct-door-that-nothing-can-reach]].
>
> <details><summary>The shipped-prevention record as it stood before closure (superseded)</summary>

> ## ⛔ RULED THEN WITHDRAWN, SAME DAY (2026-08-18) — **option 1 reverses ADR 0104 D7. Nothing was built.**
>
> **The option list below is wrong, and that is the finding.** It offers *"refuse a mint from a
> non-`submitted` response (narrowest, and **arguably right — a draft is not a document of record**)"*.
> ADR [0104](../decisions/0104-pdf-document-printing-module.md) **D7** had already ruled the opposite:
> the `RASCUNHO` watermark's derivation is *"Source not in final state at mint (**in_progress
> response**, unapproved minutes, unsigned interview)"*, and D7 item 4 says outright — ***"Completeness
> does not gate minting — FINAL/RASCUNHO already encodes it."*** Printing a draft is a **designed
> feature with its own watermark**, not an oversight.
>
> pgTAP `312` t6 pins it **by name**: *"creator sees his own in_progress draft (RASCUNHO prints are
> legal, D7)"*. The ruling would have red-ed that keystone.
>
> ⭐ **Where this actually went wrong.** The option list is part of this item's body — written once, by
> the filer, and then quoted forward as the menu. The lead recommended from it without re-deriving its
> premise; the PO ruled on the recommendation. **An option list is an assertion, and this one carried a
> justification an ADR had already refuted.** It was caught only because implementation needed a
> fixture, and the fixture file stated D7 in a comment.
> → [[verify-dont-comply]] · [[a-comment-is-an-assertion-that-goes-stale-silently]]
>
> ## ✅ RE-RULED AND BUILT 2026-08-18 (#8b) — **option 1 below: refuse the DELETE, not the mint**
>
> Migration `20260928000700` — `app.guard_response_active_print`, BEFORE DELETE on `responses`,
> raising **`HC069`**, mapped to pt-BR in `discardResponse`. ADR 0104 D7 is untouched; drafts still
> print. pgTAP `312` **77 → 80**, red-first: t74 red **and its delete succeeded**, so the orphan is
> demonstrated rather than argued.
>
> **Three design points, each measured rather than assumed:**
> - **`status = 'active'` only.** `lookup_printed_document` (the public `/verificar` door) reads
>   `printed_documents` directly and joins **only** commissions/hospitals — **never `responses`**. So
>   public verification **survives** an orphan, and a *revoked* print must keep its row and bytes
>   precisely so a paper-holder is still told `ANULADO`. Orphaning a revoked print is correct.
> - **A trigger, not an RLS predicate.** Narrowing `responses_delete_own_draft` would refuse
>   **silently**, as a zero-row delete the caller reads as success.
> - **`SECURITY DEFINER`, and it is load-bearing.** `printed_documents` carries a SELECT policy; an
>   invoker read would let a print the deleter cannot see make the guard find nothing and **allow** the
>   delete → [[guards-that-read-right-but-fail-open]].
>
> ⭐ **t76 is the assertion that carries the weight.** After the coordinator revokes, the *same* delete
> by the *same* principal succeeds. Without it, t74 is equally satisfied by a guard that blocks every
> draft delete unconditionally — a worse bug that would have read as a pass.
>
> ## ⚠ AND THE MIGRATION SHIPPED A PUBLIC-EXECUTABLE DEFINER FUNCTION — caught by a gate, not by review
>
> Written without an explicit ACL, the function took Postgres' **default PUBLIC EXECUTE**, and pgTAP
> `320` U1 (the `FUP-ACL-APP-POPULATION` census) went red at **237 → 238**. A `SECURITY DEFINER`
> function PUBLIC may call is a live door, not a detail. Fixed with `revoke all … from public` plus
> grants mirroring both sibling guards. ⭐⭐ **The defect was invisible in the diff, in review, and in
> every functional test — `312` was fully GREEN with the door open.** That is the standing argument for
> keeping the ACL census in the phase gate. → [[new-door-must-inherit-every-sibling-arm]]
>
> ## ~~⛔ STILL OPEN — two things this ruling does NOT close~~ ✅ BOTH ANSWERED 2026-08-18 (D4/D5 above)
>
> 1. ~~**Pre-existing orphans.** The guard prevents new ones; it repairs none.~~ → **D4: the set is
>    empty in both environments, measured.** Nothing to repair.
> 2. ~~**The dangling `securable_resources` row** — a securable with no subject, which every kernel arm
>    joins through. Unchanged by this fix, and still owed.~~ → **D5: retained BY DESIGN.** It is the
>    print's disposition anchor; ⛔ deleting it is the defect, not the fix.
>
> <details><summary>The options as they stood before the re-rule (superseded)</summary>
>
> ### 🔁 RE-RULE OWED — and the surviving options are NOT the three below
>
> D7 removes option 1. It also reframes the defect: **the harm was never that a draft can be printed —
> it is that the print outlives the DELETED response** as a dangling `securable_resources` row with
> unreachable bytes. Candidates, with the lead's current recommendation first:
>
> 1. ⭐ **Refuse to delete a response that has an active print.** A narrowing on the DELETE path, not the
>    mint path. Preserves D7 completely, needs **no disposal outflow**, and therefore is **not gated on
>    Critical FUP C1** — unlike cascade-disposal. The orphan stops being created.
> 2. **Cascade the print's disposal when its source is deleted.** Handles existing rows too, but widens
>    the disposal path whose only outflow is the manual unrehearsed runbook ⇒ gated on **C1**.
> 3. **Surface orphaned prints in an admin view.** Manages orphans rather than preventing them.
>
> ⚠ Under **every** candidate, the two follow-on items stand: the **existing** dangling rows, and the
> dangling **`securable_resources`** row itself — a securable with no subject, which every kernel arm
> joins through.
>
> </details>
>
> **Cheap by measurement, not by assumption:** no E2E spec mints from an `in_progress` response, and the
> print fixture pool is `submittedResponseIds` — submitted-only by construction.
>
> ⚠ **Two things the ruling does NOT cover, and they are the follow-on work:**
> 1. **Existing rows.** 6 of 9 local prints are `form_response` kind; refusing future mints leaves those
>    where they are. Needs a one-off reconcile.
> 2. **The dangling `securable_resources` row** — the body below already says this needs handling under
>    *every* option, because every kernel arm joins through it. A securable with no subject is a latent
>    authorization question, and the chosen option does not answer it.
>
> ⛔ **Cascade-on-delete was declined** — it widens the disposal path, whose only outflow is the manual
> **unrehearsed** runbook, so it would have created work gated on Critical FUP C1.

</details>

Filed 2026-08-14 (lead) from `qa`'s DM5·S3 review MINOR-5. **CONFIRMED by probe, not reasoned.**

Mint a print from a **draft** response, then delete the response: the `responses` row goes, its
`securable_resources` row is left **dangling**, and the print becomes reachable by **no UI surface at all**
(0 rows in every projection) while its bytes and registry row persist. `revoke → dispose` still works **at the
door**, so it is recoverable by someone who already knows the id — which in practice is nobody.

Note the interaction with **D18** and `DocumentHomeResourceType`: `form_response` homes render **no panel**, so
even without deletion a `form_response` print has no surface — deletion just makes it permanent. **6 of 9
prints in the local DB are that kind**, so this is the common case, not the exotic one.

**Options:** refuse a mint from a non-`submitted` response (narrowest, and arguably right — a draft is not a
document of record); or cascade the print's disposal when its source is deleted; or surface orphaned prints in
an admin view. ⚠ Whichever is chosen, the **`securable_resources` dangling row** needs handling either way —
a securable with no subject is a latent authorization question, since every kernel arm joins through it.


### ⬛ FUP-DM5-DEAD-CORE-PROJECTION — ✅ **RESOLVED 2026-08-17 by deletion** (owner: frontend + backend)

> **✅ RESOLVED.** `getDocument` deleted from `src/lib/queries/documents.ts`. Verified at
> every **import site**, not by grepping the symbol: all five detail routes import
> `getDocument` from `@/lib/queries/controlled-documents`; the only imports from
> `queries/documents` are `listDocumentsForResource` and `documentVersionAvailability`.
> `tsc` 0, all five lint gates green after removing the now-unused `DocumentDetail` import.
>
> **Deleted rather than kept-and-documented:** keeping it preserves the trap — the next
> reader has the same 50/50 chance of editing the unreachable copy, which is exactly what
> happened to ADR 0120 **D18**. ⚠ The D18 filter **survives where it is reachable**:
> `EXCLUDE_PRINTED_RENDITIONS` is still used by `listDocumentsForResource`.
>
> ⭐ **The "check for other same-name pairs" sub-item is discharged by measurement, not by
> looking:** across `src/lib/queries/*.ts`, `getDocument` was the **only** duplicated
> export name.

Filed 2026-08-14 (lead) after `tester` found it and the lead re-verified by grep. **No behavioural
defect — a legibility trap with a live cost already paid.**

- `src/lib/queries/documents.ts:260` exports `getDocument` (Wave-A core `documents` projection). **Nothing
  under `src/` imports it.**
- `src/lib/queries/controlled-documents.ts:360` exports `getDocument` **too**, and *that* is the one all
  five detail routes import.
- **The cost already paid:** the lead's ADR-0120 **D18** ruling ("exclude prints from the detail projection
  too") was implemented on the **unreachable** one. Harmless — the reachable projection selects
  `from('controlled_documents')` and a print has no row there, so prints are excluded *structurally* — but
  the ruling bought nothing, and the record briefly implied the detail path was protected by a filter when
  it is protected by the schema. Recorded in ADR 0120's D18 amendment.

**Why it hid:** two exports, one name, different modules. A grep for `getDocument` returns hits and
*looks* answered; only `grep` for the **import site** distinguishes the reachable one. Same class as
[[an-enumeration-s-boundary-must-be-the-property-not-a-syntax]] — the name is the syntax, "what the routes
actually call" is the property.

**Fix:** decide whether the core projection is (a) dead and should be deleted, or (b) intended for a
detail route not yet mounted — and if (b), say so at the definition with what will mount it. **Do not
simply delete the D18 filter from it**: if the function survives, the filter must survive with it, or a
future route mounts an unfiltered projection. ⚠ Check for other same-name-different-module pairs in
`src/lib/queries/` while there; this one was found by accident.


### ⬛ FUP-DM5-BYTE-PROOF-NOT-ATTEMPTED — ✅ **RESOLVED 2026-08-18** — the disposal evidence recorded `not_attempted` from the ONE lane that actually deleted the bytes (owner: backend)

> ## ✅ RULED 2026-08-18 (DM-FUP TRIAGE #2) — **write `unavailable_on_platform`**
>
> Fix site: `reclassifyDocument` in [`src/lib/documents/actions.ts`](../../src/lib/documents/actions.ts)
> — named by SYMBOL, not by line: this cited `:416` when written and the fix's own comment block moved
> it to `:426` within the hour ([[a-comment-is-an-assertion-that-goes-stale-silently]]). Add
> `p_byte_proof: 'unavailable_on_platform'` to the `complete_document_disposal` call, plus a pin so
> nothing silently reverts to the DEFAULT. Vocabulary re-verified from the live catalog
> (`pg_get_functiondef`, not migration text): `local_volume_verified` · `unavailable_on_platform` ·
> `not_attempted`.
>
> ⭐ **The deciding fact was not in the filing: no app code branches on deployment.** `src/lib/documents/`
> and `src/lib/supabase/` carry **zero** `STORAGE_BACKEND` / `isLocal` / `NODE_ENV` checks, so ONE literal
> serves both environments — while the honest answer differs between them (locally the volume is
> walkable and `local_volume_verified` is earnable; on Cloud it is not). `unavailable_on_platform` is the
> only value that is never an overclaim in either: it understates locally and is exact on Cloud.
>
> **Two alternatives explicitly rejected, and why they are worth naming:**
> - **Derive it from an env var.** Accurate per environment, but a *misconfigured* env writes a FALSE
>   proof into the regulator-facing ADR 0121 D4 evidence — failing in the reassuring direction, which is
>   the entire `FUP-DM5-NO-ANSWER-VS-NOTHING` class.
> - **⛔ Verify at call time, then write the result.** The intuitive option, and the trap: a Storage-API
>   `list()` after `remove()` reads **`storage.objects`** — metadata, not the volume. It would manufacture
>   `local_volume_verified` out of the exact proxy that NO-ANSWER instance 3 exists to condemn. Recorded
>   here so it is rejected deliberately rather than proposed again later.
>
> ⚠ **This ruling may be revisited by `FUP-DM5-CLOUD-ORPHAN-SURFACE`.** If the constructed-orphan probe
> proves Cloud *does* expose an orphan-visible surface, a fourth vocabulary value gets **earned by that
> measurement** — it is deliberately not pre-authorized here.

Filed 2026-08-17 at the DM5 **phase** QA (M4), catalog-verified by the lead before filing.

**Measured.** `public.complete_document_disposal(p_file_object_id uuid, p_byte_proof text DEFAULT
'not_attempted')`. Its **only production caller** is `reclassifyDocument`
(`src/lib/documents/actions.ts`), which calls it **without `p_byte_proof`** — *three lines after*
performing `admin.storage.remove([oldFile.storage_path])` and checking `rmError`. So the row records
**"byte deletion not attempted"** for a deletion that **was attempted and succeeded**.

⛔ **Why this is more than cosmetic.** `disposal_evidence` is the ADR **0121 D4** artifact — the thing
that says what a disposal actually did, for a regulator. This is the one code path in the product that
*can* honestly claim a byte proof, and it is the one that disclaims it. ⚠ It errs **conservatively**
(claims less than it did), which is why nothing catches it: no gate fails, and the record merely looks
modest. But it is still a **false statement in a PHI evidence trail**, and it makes the strongest
available evidence indistinguishable from the weakest.

⭐ **Shape:** [[declared-param-no-caller-blind-spot]] — a parameter exists, carries a safe-looking
default, and the only caller never passes it, so the default *is* the behaviour and the parameter reads
as unused. Related: [[a-backfill-masks-the-broken-write-path]] (the write path was never taught).

**Fix:** pass the real outcome from the lane that knows it. ⚠ Decide deliberately what the value means
when `remove()` succeeds against Cloud — the S5 finding stands that a Storage-API success is **not**
proof of byte destruction there (`FUP-DM5-CLOUD-ORPHAN-SURFACE`), so the honest value may be
lane-dependent rather than a flat "attempted". **Needs a pgTAP pin either way** — today nothing asserts
what any lane writes into `byte_proof`.


### ⬛ FUP-DM5-ATTACHMENTS-MODULE-SURVIVED-RETIREMENT — ✅ **RESOLVED 2026-08-18 by deletion of `actions.ts` ONLY** — the legacy module the retirement phase was named for (owner: frontend + backend)

> ## ⚠ SCOPE NARROWED 2026-08-18 BY MEASUREMENT — **the title over-reaches; do not delete the directory**
>
> The item says *"`src/lib/attachments/` survives."* Measured, the directory has **two** files and they
> have opposite fates:
> - **`actions.ts` — DELETE.** 6 `'use server'` exports, **zero importers**. The only surviving reference
>   anywhere is a doc comment at `src/lib/queries/case-documents.ts:17` naming `openAttachment` as the
>   audited door, which should be corrected in the same pass.
> - **`constants.ts` — KEEP. It is LIVE**, with 3 importers: `src/lib/queries/attachments.ts`,
>   `src/lib/queries/interviews.ts`, and transitively `src/lib/queries/meetings.ts` via `listAttachments`.
>
> ⭐ Deleting on the title rather than on the measurement would have broken three query modules — the
> same shape as the defect the item itself describes, where a sweep bounded by the wrong unit misses what
> it was aimed at.

Filed 2026-08-17 at the DM5 **phase** QA (M3).

`src/lib/attachments/` survives DM5 with **6 dead `'use server'` exports** whose own comments say
*"until DM2 retires it"*. The **buckets** are retired and the catalog is clean — the S6 exit sweep
measured **0 functions / 0 policies / 0 constraints / 0 defaults** referencing any of the 8 retired
names — so this is **dead application code, not a live byte path**, which is why it is 🟡 and not
higher.

⭐ **Why the S6 exit sweep could not see it, and this is the transferable part:** that sweep was bounded
by **identifier** (`storage_path`, `storage_bucket`, bucket literals, `createSignedUrl`) — deliberately,
because bounding by directory had failed before. A module that no longer *references* a retired bucket
but still *exists* matches none of those identifiers. **Both bounds are right and both are incomplete:**
"does anything still point at the retired thing?" and "is the thing that pointed at it gone?" are
different questions, and DM5 only ever asked the first.
→ [[enumeration-boundary-is-a-syntax-not-a-property]], [[cutting-a-table-does-not-cut-its-doors]].

**Before deleting:** verify by identifier that nothing imports these exports (a dead `'use server'`
export is still a live RPC surface if any client references it), and check the `attachments`
**feature-flag key** separately — it is still read live at `attachments/actions.ts:35` and
`interviews/actions.ts:798`/`:834`, and it is a *flag key*, **not** a bucket name (the `case_patient`
name-collision class).


### ⬛ FUP-DM5-330-WRITE-BLIND — ✅ **RESOLVED 2026-08-17** (owner: backend)

> **✅ RESOLVED** by `330` block W (+5, plan 57 → 62), a labelled commit of its own as the
> re-scoping required.
>
> ⭐ **The blindness was RE-DERIVED, not inherited — and it was still real.** The filing
> warned that `BUG-DM5-S2-WRITE-ARM-1`'s fix (`fc7a146d`) changed the body after the
> verdict was recorded, and [[a-rename-orphans-a-name-keyed-verdict]] applies to a body
> edit too. Measured against the live catalog: rewriting the `controlled_document` arm to
> `return true` and re-running the file gave **All tests successful across all 57**. The
> keystone was then authored *against that open gate*, so its red is a **run, not a
> prediction** — W2 and W3 fail, the three positive controls stay green, and after
> restoring the gate all 62 pass.
>
> **W3 is the discriminating one.** `staff1.farm` is an approver of this document and A3
> (same file) already proves he READS it. The write arm deliberately has no approver half
> — *"an approver reads the artifact he reviews; he does not replace its bytes"*, the
> body's own comment. Same persona, same document, opposite answers: the asymmetry is now
> pinned as a **decision** rather than surviving as an oversight nobody could distinguish
> from one.
>
> ⚠ **The distinction that kept this open was correct and is worth keeping:** door-level
> BLIND lifting ≠ arm-level coverage. `342` covering the print arm would have lifted the
> door's finding while this arm stayed uncovered **wearing a COVERED status** — STALE-
> COVERED as a *status* change rather than a *body* change, which no existing check looks
> for. It was right not to close this on `342`.
>
> ⛔ **The gate restore was verified against `prosrc`, not assumed** — the shared local
> stack has had an authz gate left open by a sweep before
> ([[mutation-harness-must-prove-its-rollback-first]]).

<details><summary>Original filing + re-scoping (2026-08-14) — retained</summary>

> **Re-scoped 2026-08-14 (lead) after `backend` correctly declined to fix it inside S3.** Its reasoning
> is right and is retained: the door sweep's unit is the **suite set**, not one file, so `342` noticing a
> neutralized `can_write_document` is what lifts BLIND — and folding S3 keystones into DM3's suite is the
> same objection that moved S3's own suite off `341`, one file over.
>
> ⛔ **The distinction that keeps this open: door-level BLIND lifting ≠ arm-level coverage.** Once `342`
> covers the **print** arm, neutralizing the whole door is noticed and the finding lifts — while the
> `controlled_document` arm `330` was supposed to be watching stays uncovered, now wearing a COVERED
> status. That is **STALE-COVERED reappearing as a *status* change rather than a *body* change**, which no
> existing check looks for. Do **not** close this on `342`'s coverage. `330`'s own hygiene is a separate
> labelled commit, deliberately not in S3.

Filed 2026-08-14 (lead), carried out of the DM5 handoff where it existed **only in prose** and so was
in no tracked place. Surfaced when `can_write_document` was re-swept for the S2 arms (`fa28ec19`) —
it had been **STALE-COVERED**: a verdict recorded against the door under its pre-S2 body, which the
S2 `rca`/`capa_action` arms then changed. Per §6 step 1 a BLIND door **blocks a phase**, so this must
be keystoned (not allowlisted — `can_write_document` is a write authority, never an unreachable
backstop). ⚠ Re-derive whether it is *still* blind from the live catalog before writing the keystone:
`BUG-DM5-S2-WRITE-ARM-1`'s fix (`fc7a146d`) changed the body afterwards, and
[[a-rename-orphans-a-name-keyed-verdict]] applies — a name-keyed verdict does not follow a body edit.

</details>


### 🟡 FUP-VACUOUS-COVERAGE-1 — two PHI-remediation tests that **NEVER RUN**, and `lint:vacuous` is structurally unable to catch them (owner: tester + backend)

> ### ⛔ BODY WRITTEN 2026-08-17 — this item had **NO body in this file** for its entire life
>
> Until now its single line in PROGRESS.md's head list *was* the whole record, and that line carried
> its own warning: *"THIS LINE IS THE ONLY RECORD — do not compress or cut it believing a body
> exists."* ⭐ **It was found exactly the way that warning anticipated** — by a pre-rotation check that
> asked, for all 54 head entries, *"does this have a body?"* rather than assuming the head list was a
> summary of something. **53 did. This one did not.** A rotation that compressed the head list without
> that check would have deleted the item outright while looking like tidying.
> → [[enumeration-boundary-is-a-syntax-not-a-property]]
>
> ⚠ Context also survives in `docs/reviews/vacuous-assertion-audit.md` and
> `docs/progress/bug-log-archive.md`, but neither is the follow-up register, so neither would have
> kept the item *open* — they record it as history, not as work.

**The finding.** `e2e/phi-remediation.spec.ts` **REM-8** and **REM-9** skip on **every** run: there is
no seeded RCA for `EV-0001`, and the only CAPA has a `NULL source_event_id` (both catalog-verified).

⛔ **Why the lint gate can never help here — this is the point of the item.** They are *honest*
`test.skip()`s, not silent greens. `lint:vacuous` (`scripts/check-vacuous-assertions.mjs`) exists to
catch **a test that goes GREEN having asserted nothing**; a test that never runs is **outside that
property**. So the gate is working as designed and the coverage hole is invisible to it —
**two different failures that both end in "the suite is green and the behaviour is untested."**
⭐ Filed *because* the audit that produced the gate noticed the gate's own boundary.

**Why it is its own item and not a drive-by.** Closing it means new fixture work against `seed.sql`,
which is **a contract with ~900 tests** — the shared-fixture hazard in
[[shared-fixture-cannot-satisfy-two-specs]]. Adding a seeded RCA for `EV-0001` and a CAPA with a real
`source_event_id` changes counts other specs assert on.

⚠ **Whoever closes this must show the two tests RUN and can FAIL** — un-skipping them and observing
green proves nothing on its own, which is the same class the parent audit was about.


### ⬛ FUP-DM5-342-PLAN-COMMENT — ✅ **RESOLVED 2026-08-17**; the comment's own arithmetic already summed to 59 (owner: backend)

> **✅ RESOLVED.** The header now cites the plan (`plan(59) = …`) instead of carrying a
> free-standing total.
>
> ⭐ **The detail the item missed:** the itemised breakdown under that heading **already
> summed to 59**. Only the leading total was stale — items were appended over three QA
> rounds without re-adding. So the comment did not merely disagree with the code, it
> disagreed with **itself**, and a reader who trusted the total would have concluded 15
> assertions had gone missing. Textbook
> [[a-comment-is-an-assertion-that-goes-stale-silently]].

Filed 2026-08-14 from DM5·S3 QA **r2** (INFO). `supabase/tests/342_dm5_s3_printed_renditions.sql:21-27`
documents a plan of 44; the executable `plan(59)` is correct and the suite passes. **Cosmetic today** —
filed anyway because it is a pure instance of [[a-comment-is-an-assertion-that-goes-stale-silently]], the
class that has been hit repeatedly in this repo and **shipped a live bug once**. The header is the first
thing a reader trusts when deciding whether assertions went missing, which is precisely the judgement
`pg_prove`'s plan line exists to support. **Fix:** make the comment cite the plan or drop the number.
⚠ Lead did **not** fix it inline — `342` is `backend`'s file and file ownership is binding (CLAUDE.md §4).


### ⬛ FUP-AUTHZ-ALLOWLIST-ROT — ✅ **RESOLVED 2026-08-17.** A resolve-in-`pg_proc` check now runs inside `ARM=floor`; it found **SIX** stale entries where this item named one (owner: lead + backend; filed 2026-08-14, DM5 S2)

> **✅ RESOLVED 2026-08-17.** `ARM=floor` now anti-joins every allowlist signature against
> `pg_proc` and fails `RC=1` on any that does not resolve. **Proven red-first**: the first run
> exited **1** listing six entries; after the fix, `EXIT=0 · INVARIANT HOLDS` with the offender
> count unchanged at **74**, all still allowlisted.
>
> ⭐ **This item named one specimen; the property-bounded check found six** — the phase's dominant
> class ([[enumeration-boundary-is-a-syntax-not-a-property]]) recurring inside the follow-up list
> itself. The six split cleanly, and the split is the interesting part:
> - **ABSENT** (door dropped, entry is pure rot): `add_referral_reply_attachment` ·
>   `get_referral_attachment_path` · `get_referral_snapshot_document_path`.
> - **RE-SIGNATURED** (door LIVE under new params, and **called**): `decline_referral` (gained
>   `p_decline_reason_code`) · `set_template_collects_patient` (`p_template_id` →
>   `p_template_version_id`) · `update_controlled_document` (gained three params).
>
> **All six were removed, none replaced.** The three live doors are not in the offender set under
> their real signatures, so they need no exemption — and per the `set_primary_subject` precedent
> already in the file, *an allowlist entry for a door that IS called suppresses the floor arm's only
> question about it.* If one later stops being called, the arm **should** fire and a human should
> justify it then. ⚠ Note the second-order rot this exposes: a re-signatured entry keeps its original
> **justification comment**, which now describes a door shape that no longer exists.

`supabase/tests/mutation/authz-neverclled-door-allowlist.txt` keys entries on the **full identity
signature**, and `p0-authz-invariant.sh:229` consumes it with
`comm -23 <(offenders) <(allow_body …)` — i.e. it **only ever subtracts**. Nothing checks that a
listed signature resolves to a function that exists.

**Live specimen:** line 41 names `add_referral_reply_attachment(...)`, which **DM4 dropped**
(`20260926000400`). Verified absent from `pg_proc` at HEAD.

⚠ **Calibrated, and this corrects the lead's first framing.** A stale entry is **inert, not
dangerous**: it can never match a live offender, so it masks nothing and fails nothing. The failure
mode is **legibility, not enforcement** — a human reading the file sees a door "accounted for" that
does not exist, and the entry's justification comment outlives the thing it justified.

⭐ **The signature-keying is otherwise a FEATURE, and DM5 S2 demonstrates why.** When `…000120`
drops `p_storage_path` from `add_capa_action_evidence`, line 37 stops matching the live door, which
then appears in `unlisted` ⇒ **FLOOR VIOLATED, RC=1** — **loud**, exactly as designed. So the
remedy for line 37 is to update it in the migration's own commit (planned), and the follow-up here
is only about the rot the mechanism cannot see.

**Proposed fix (not built):** a cheap assertion that every allowlist signature resolves in `pg_proc`,
run as part of `ARM=floor` — turning silent rot into the same loud failure the live half already
gets. ⚠ Prove it able to fail before trusting it: line 41 is a ready-made positive control.


### ⬛ FUP-DM5-GRANTS — ✅ **CLOSED 2026-08-17.** The RPCs are now the only writers — and closing it nearly INTRODUCED a stale-COVERED policy (owner: backend; filed 2026-08-14 by ADR 0120)

**Fix:** migration `20260928000200_evidence_tables_revoke_direct_write.sql` revokes
`insert, update, delete, truncate, references, trigger` on both tables from `authenticated`.
**SELECT is deliberately kept** — six measured call sites read these tables directly under RLS
(`queries/rca.ts:553`, `queries/capa.ts:505`, `safety/capa-actions.ts:501,558`,
`safety/rca-actions.ts:592,694`), all `.select()`, zero direct writes. The migration is
self-verifying (asserts the write privileges are gone, that SELECT survived, and that the owner
can still write).

**Safe because the authorization moved WITH the path, verified from the live catalog:** all four
doors are `prosecdef = t` owned by `postgres`, and each gates on the *same* predicate the RLS policy
used — `add_rca_evidence` → `app.assert_rca_writable` → `app.can_write_rca` (HC048);
`add_capa_action_evidence` → `app.assert_capa_writable` → `app.can_write_capa` (42501).
⚠ **A first pass concluded there was NO gate**, because it grepped for `can_write_rca|can_write_capa`
and the call is named `assert_rca_writable` — [[enumeration-boundary-is-a-syntax-not-a-property]]
inside the verification of a security change. **The body was read; the regex was not believed.**

**Evidence:** pgTAP `341` block **H**, plan 53→57 — H1/H2 `table_privs_are(...) = {SELECT}` exactly
(fails in BOTH directions: a re-grant reds it, so does an over-revoke that strips SELECT), H3/H4
behavioural twins proving the FUP's own bypass (`POST /rest/v1/rca_evidence`) now gets 42501.
`table_privs_are` was **red-proven** by re-granting inside a throwaway suite.

### ⭐⭐ The finding: this fix would have made TWO P0 policies silently BLIND

The revoke closes the direct-DML path — which is the **subject under test** of two keystones in
`252_authz_p0_isolation.sql`, an ADR-0078 P0 suite whose contract
(`p0b-isolation-mutation-audit.sh:146,154`) is *"opening the policy must redden the DENY"*. With the
grant gone the reader-non-writer's INSERT fails at the **grant** (42501) before RLS is consulted, so:

| | before | after the naive revoke |
|---|---|---|
| `*_write POS` (authorized writer inserts) | passes | **FAILS** — loud, catchable |
| `*_write DENY` (reader-non-writer refused) | passes *because RLS refused* | **passes because the GRANT refused** — green, and testing nothing |

The DENY half is the dangerous one: `rca_evidence_write` and `capa_action_evidence_write` would have
gone **BLIND** while `docs/reviews/authz-door-audit-findings.md:324,436` still recorded them
**COVERED**. That is *STALE-COVERED arriving as a status change rather than a body change* — the exact
defect **FUP-DM5-330-WRITE-BLIND** is open about. Found by asking which OTHER suites do direct DML on
these tables, not by running the suite and reacting; `341`'s own F8 failed first and was the prompt.

**Resolution — keep both properties.** `252` restores the grant **inside its own rolled-back
transaction**, solely to reach the policy under test; production keeps the revoke, pinned by `341`
H1–H4. **Mutation-proven, not asserted:** re-running `252` with both policies opened to
`using(true) with check(true)` fails **tests 1 and 14 — exactly those two and nothing else**. Verified
afterwards that neither policy was left open and grants are SELECT-only (the shared-stack hazard from
[[mutation-harness-must-prove-its-rollback-first]]).

⭐ **Why the RLS policies are KEPT rather than retired as unreachable.** They are now the second lock,
and the one that matters: `ALTER DEFAULT PRIVILEGES FOR supabase_admin IN SCHEMA public` still grants
`arwdDxtm` to `authenticated` on **every new table**, and `20260620000000_baseline.sql:22989,23088`
is a pg_dump that already restored these grants once. A re-dump silently re-arms direct DML — and if
RLS had been dropped as "unreachable", the tables would then be defended by nothing. **A protection
that a routine re-dump disarms, while its keystone reads COVERED, is worse than the one it replaced.**

⚠ **Generalises past this item:** that default-privilege posture means **any new table in `public`
starts with full `authenticated` grants**. The narrow idiom this project uses elsewhere
(`grant select on public.X to authenticated`) only holds where someone remembered to write it.

<details><summary>Original filing (2026-08-14) — retained</summary>


Both tables carry **table-wide `arwdDxtm` grants to `authenticated`**, so a client can
`POST /rest/v1/rca_evidence` directly and never traverse `add_rca_evidence`.

**⚠ Calibrated — this is hardening, NOT an open door.** RLS *is* enabled on both, with genuinely
**distinct** read and write predicates — `app.can_read_event(app.event_of_rca(rca_id), auth.uid())`
for SELECT versus `app.can_write_rca(rca_id, auth.uid())` for the `FOR ALL` write policy — so this is
a real second lock, not [[a-door-can-have-two-locks]]'s same-predicate-twice trap. Verified against
`pg_class.relacl` and `pg_policies` directly, at the DM5 open. What direct DML bypasses is the
**RPC's flag gate and its fail-closed arms**, not row authorization.

**Binding on DM5 S2:** do not assume the RPC is the only writer when placing the `documents_wave_d`
assert (ADR 0120 D10). A flag gate that lives only in the RPC body is bypassable by exactly this
path — the DM3 QA MAJOR-1 shape, where the gate sat on the last step of a corridor rather than the
corridor. Note the parked CHECK `rca_evidence_cited_document_parked` **does** hold against direct
DML, being a table constraint; that is the third of the three locks and the reason the citation seam
is safe today.
</details>


### ⬛ FUP-DM4-RECUSAL — ✅ **RESOLVED 2026-08-17 (local catalog); ⚠ NOT YET ON THE REMOTE** — a RECUSED coordinator could freeze a case's PHI documents into a referral, around the exclusion perimeter (owner: lead + PO + backend; **deadline was the `documents_wave_c` flag-on date**)

> ### ✅ RESOLUTION 2026-08-17 — `32054942`, migration `20260928000100`, ADR [0122](../decisions/0122-recusal-case-read-arm-at-the-referral-freeze-door.md)
>
> ⛔ **This header read `🟠` open until 2026-08-17 — a full day after the fix landed, in the file that
> is the authority for what is open.** Nothing in the entry below had been touched. Recording it here
> rather than silently rewriting: a closed security obligation that still reads OPEN costs the next
> session a re-investigation, and the same rot in the opposite direction ships a hole.
> → [[a-records-claim-about-an-external-system-goes-stale-silently]].
>
> **The PO overturned the 2026-08-14 Phase-19 deferral** (ADR 0122 **D1**): the deadline was always
> the `documents_wave_c` flag-on date, and — as QA's standing caveat below demanded — **a plane that
> only WIDENS cannot close an under-inclusive gate.** So it was closed by a **narrowing** arm, which
> is what the caveat required.
>
> **What was built.** A `app.can_read_case(v_referral.source_case_id, auth.uid())` arm raising
> `HC0DM`, placed **ABOVE the `p_kind` dispatch** — deliberately not inside the `document` arm where
> the item was filed, because the **narrative** arm freezes `case_narratives.body_md` with the
> identical omission and a guard in the reported arm would have left its sibling open
> (that is `FUP-DM5-SIBLING-GUARD-DIFF`, applied rather than merely filed).
>
> **Evidence, red-first against the pre-migration catalog:** `340` R1–R4 green, **R5/R6 RED with
> `caught: HC077 / wanted: HC0DM`** — and that `HC077` *is* the finding, the recused coordinator
> reaching past every gate into the arm's own content lookup. Plan 76 → 82, all green after.
>
> **✅ Lead-verified from the LIVE CATALOG 2026-08-17, not from the commit message**
> (`pg_get_functiondef`, per the CLAUDE.md §graphify SQL exception): the guard is at body line 24,
> the `p_kind` dispatch at line 29 — the ordering the fix depends on is real, and
> `public.add_referral_shared_item` is `prosecdef=true`.
>
> ⚠⚠ **THE ONE THING THIS DOES NOT YET COVER — and it is the half the deadline was about.**
> `20260928000100` is **LOCAL-ONLY**. `supabase migration list --linked` (measured 2026-08-17) shows
> the remote current through **`20260927000360`**, so **the recused-coordinator hole is still OPEN on
> the remote.** It closes there on `db push`, which is itself gated behind S4's `20260927000400`.
> **Do not read this ⬛ as "safe in production."** The deadline condition is unchanged: this must be
> on the remote before `documents_wave_c` is ever enabled there.

<details>
<summary>Original filing (2026-08-14) — kept in full; the gap, the PO's first ruling, and QA's binding caveat</summary>

Filed 2026-08-14 at DM4 QA r1 (**MAJOR-3**). **Found by `qa`, demonstrated LIVE** in a rolled-back
transaction — not inferred from reading code.

**The gap.** `add_referral_shared_item` checks referral-**source** authority
(`can_manage_referral_source`) but **never `can_read_case` or `can_read_document`**. So for one
user and one case, simultaneously:

```
can_read_case(caseA, u)                     = false      ← recused / excluded
can_manage_referral_source(ref on caseA, u) = true
can_read_referral_phi(ref on caseA, u)      = true        ← reaches the PHI bytes
```

A coordinator **recused** under the ADR-0072 / ETH·E1 exclusion perimeter can therefore freeze that
case's PHI documents into a referral and read them through the referral corridor. ⚠ **Two
authorization planes that were each individually correct**: ADR 0119 **D4** reasoned about exactly
this seam for the D15 **clearance** plane and never considered the **case-capability** plane.
Same shape as [[exclusion-only-as-strong-as-weakest-mutator]] — the excluded party reaches the
content by a route the exclusion never modelled.

**PO ruling 2026-08-14: DEFER to the Phase 19 access plane** (ADR 0114 Amdt 1 **D16**, which must
cover **both widening and narrowing**). Legitimate: not P0 because `documents_wave_c` **ships OFF**,
so the path is unreachable in production today. The other options offered and not taken were fixing
it inside DM4 with a keystone + negative twin, or ratifying source-authority-is-enough in ADR 0119.

⛔ **QA's standing caveat, binding on how this may close.** This is an open **security** obligation,
not a backlog item, and **its deadline is the flag-on date, not Phase 19's delivery date**. It must
**never** be absorbed into *"Phase 19 delivered an access plane"* — **a plane that only WIDENS would
not close it.** Closure requires a **narrowing** arm that refuses a recused coordinator at the
freeze door, **proven by a negative twin**, and the FUP is closed only against that evidence.

⚠ **Before `documents_wave_c` is ever enabled in production, this must be resolved or explicitly
re-ratified by the PO.** Name it in Phase 19's scope in
[accreditation-track.md](../phases/accreditation-track.md) so D16 cannot land without meeting it.

</details>

> ⭐ **The caveat above was met on its own terms, and that is why this closed rather than deferred.**
> It demanded a *narrowing* arm proven by a negative twin; it got one (R5/R6 red-first). ⚠ Its final
> paragraph still binds on the **remote**, which does not have the fix — see the resolution box above.


### 🟡 FUP-PDF-4 — verification rate limiter: comment FIXED, availability lever still OPEN and re-scoped (QA P1 MINOR-3; owner: backend)

⛔ **The filed premise was wrong in a way that mattered, corrected 2026-08-11 against the code.**
The entry said the limiter is *"one **global** 60/min counter"* and prescribed *"per-credential
granularity (keep the global cap as a backstop)"* — **that is already exactly what ships, and
has since the original commit `e1daba9`**: `PER_CREDENTIAL_LIMIT = 5` over a `perCredentialHits`
map, plus the global 60 backstop. Anyone executing the prescription literally would have written
a no-op and closed the item. The lesson is the standing one: **a prescription in a follow-up is a
claim about the code and ages like one** — re-measure before implementing, not after.

**DONE:** the false *"the page shows it verbatim"* comment is corrected. Confirmed against
`src/app/(public)/verificar/[token]/page.tsx:84-90`, which catches **every** error, logs it, and
returns `{ state: "unavailable" }` — so `VERIFICATION_RATE_LIMIT_MESSAGE` is never rendered and
reaches only the server log. (The comment-asserting-an-untruth family, invisible to every gate.)

**STILL OPEN — the availability lever, correctly described:** the per-credential arm bounds
brute-forcing ONE code; it does nothing about the actual DoS. One visitor cycling ~12 distinct
credentials × 5 each exhausts the **global** 60/min budget and throttles *every* anonymous
visitor on the public `/verificar` surface. Both windows are also module-level process memory, so
they are per-PROCESS — N app instances mean N× every budget.

⚠ **Deliberately not fixed in the FUP quick batch, because neither half is guessable:** closing
it needs per-**client** granularity (which needs a *trusted* client identity — `x-forwarded-for`
is only as trustworthy as the proxy in front of it, a Coolify deploy decision, ADR 0059) **plus**
shared cross-process state. Both are decisions, not code. The limitation is now recorded in the
module docblock so the next reader does not re-derive it. The RPC stays service_role-only.


### ⬛ FUP-QOB-3 — RESOLVED 2026-08-09: `dispose_event_phi` KEEPS its tenancy arm, and referral disposal gets the same backstop BACK (PO)

**PO ruling 2026-08-09.** The finding was framed as "event is the odd one out" — investigating it
inverted that: **event was the one that got it right**, and the same-day BUG-QOB-004 cut had gone
one step too far on the referral plane.

**Two facts decided it, neither available when BUG-QOB-004 was ruled:**
1. **A hospital can have ZERO NSP operators.** Measured: `Hospital Unico C` has none, and NSP
   staffing is a separate onboarding step. NSP-only disposal leaves such a hospital unable to
   honour an **LGPD Art. 18 erasure request** — an obligation that sits with the ORGANIZATION
   (the *controlador*), not with a clinical nurse.
2. **This platform already rules the other way for acts of this shape.** ADR 0104 D11 keeps the
   tenancy arm on `revoke_printed_document` because revocation is a **governance act that reveals
   no content** — guarded by pgTAP `314` 8.5. Disposal is identical in shape: it discloses
   nothing, it destroys. D5's "zero PHI bits must not destroy Rule 12 data" guards against
   destroying what you cannot verify; that is a real concern, and it is the same one D11 already
   weighed and answered.

**Executed (`20260917000400`):** the tenancy arm is restored on `dispose_referral_phi` +
`can_dispose_referral_phi`. **`create_referral_draft` stays CUT** and the **UI wall stays** — the
backstop is disposal-only. ⚠ For a BARE tenancy admin the capability is therefore reachable only
out-of-band; that is deliberate and recorded, unlike BUG-QOB-004's accidental orphan. A tenancy
admin who is also a committee member reaches it normally.

**Guarded so it cannot be re-cut by symmetry:** `314` **8.6** (all three disposal doors keep the
arm) + **8.7** (drafting stays cut) + `295` **§7.7** flipped to assert the backstop behaviourally.
Red-proven: re-cutting the arm reds both 7.7 and 8.6 and nothing else.

**Also fixed in the same wave — three stale pt-BR messages, one per direction:**
`dispose_referral_phi` (fixed in `…000000`, re-fixed here), `dispose_case_phi` (**promised** an
org-admin arm QO·B had removed) and `revoke_printed_document` (**hid** the tenancy arm it carries).
⚠ The class: *every* time an arm moved, its sentence stayed. Invisible to every gate in the repo —
no test reads prose — and user-facing in both harmful directions.

Found by the **sibling-coherence check** run immediately after `20260917000000` landed — i.e. by
asking "what do this door's siblings look like now", not by anything in the ruling's own scope.
Measured live (`pg_get_functiondef`), all six disposal doors:

| Door | tenancy arm | PHI module (Rule 12) |
| ---- | ----------- | -------------------- |
| `dispose_case_phi` | ✗ cut (D5) | case |
| `dispose_referral_phi` / `can_dispose_referral_phi` | ✗ cut 2026-08-09 | referral |
| `dispose_attachment_phi` | ✗ none | — |
| **`dispose_event_phi`** | ✅ **LIVE** | **patient-safety / NSP** |
| `dispose_meeting_minutes` | ✅ live | not a PHI module |

**The finding:** D5's ratified reasoning — *"a principal with zero PHI bits does not destroy Rule 12
data"* — is what put `dispose_case_phi` on the CUT side, and it is what the PO applied verbatim to
the referral plane on 2026-08-09. It applies to `dispose_event_phi` **identically**: patient-safety
is PHI module 1, and a bare tenancy admin holds no PHI bits there either. So of the three Rule-12
modules, two now deny the tenancy tier its disposal arm and one still grants it — a split produced
by the order the rulings happened in, not by any decision about NSP.

**Corroborating tell:** `dispose_event_phi` still carries the pt-BR message *"apenas um administrador
da organização ou o NSP pode descartar dados do paciente"* — the exact sentence
`dispose_referral_phi` had to shed in the same wave because the cut made it false. It is currently
still TRUE for `dispose_event_phi`, which is the point: the two doors were written as a pair and have
now diverged.

⚠ **Deliberately NOT acted on.** It is outside the BUG-QOB-004 ruling, and cutting a live capability
unasked is the standing trap in the other direction — *conferring or removing a capability requires
enumerating its consumers*. `dispose_meeting_minutes` is a separate question and probably a genuine
KEEP (meeting minutes are a governance artifact, not one of the three PHI modules) — do not sweep it
in reflexively with the NSP call.

**To close:** a PO ruling on `dispose_event_phi` only — CUT (D5 consistency across all three PHI
modules) or KEEP-with-a-recorded-reason (NSP disposal is genuinely a tenancy-tier duty). Whichever
way, the pt-BR message must end up matching the arms. Owner: **PO**, then backend.


### 🟡 FUP-AFF-3 — pin door ACLs by DERIVING the door set, not by remembering it (2026-08-06)

Raised by `backend` at AFF close-out, and it is the **class** behind QA's N2. `302` §1's ACL
assertions covered "the doors that existed when §1 was written"; `log_cpf_probe_for` arrived two
commits later and **inherited nothing** — its ACL is its *entire* boundary (it fronts nothing, it
writes one audit row), so the one property most worth pinning was the one unpinned. Fixed for that
instance in `304` §9; the class is open.

⚠ **This is the third and fourth instance of the same failure inside one workstream** — the others
being F2's error-code detector (bounded by a 5-char syntax, so it could not see `check_violation`)
and `backend`'s own case-sensitive diff-derivation grep (which listed 1 of 4 changed gates, because
`pg_get_functiondef` emits uppercase — ADR 0079 Amendment 5a). Every instance is the recorded rule:
**an enumeration's boundary must be the property, not a syntax and not a remembered list.**

Proposed scope: one assertion that derives the door set from `pg_proc` — every `public` `prosecdef`
function granted to `service_role` must **not** be executable by `authenticated` — replacing the
per-door transcription. Needs its own allowlist discussion (legitimate dual-audience doors exist),
which is why it was flagged rather than widened into AFF unasked.


### ▶ FUP-FF5-2 — `r2-m-1`: §O pins the door's behaviour, not the closure of the writer set

ADR 0091's substrate paragraph claims *"an exhaustive `pg_proc` sweep for writers of `participants`
returns exactly two functions"*. §O proves the two known doors behave (the surrogate holds) and O5
proves no writer is invoker-rights — but neither pins that the set is **closed**, so a third
DEFINER writer taking a caller-supplied label satisfies every assertion. QA r2: MINOR, not blocking
(the runtime property is held by the mutation-proven O4, and a new writer arrives with its own
migration and ADR). **Close:** one assertion pinning the writer set by **count *and* name**,
matching `(public\.)?participants\y`. Two specifics — O5's current regex is
`insert\s+into\s+public\.participants`, which matches only `public.`-qualified writes (exactly why
a rogue *unqualified* writer probe stayed green), and use `\y`, **not `\b`** (backspace in Postgres
regex).


### ⬛ FUP-DM5-FINALIZE-ATOMIC — ✅ **RESOLVED 2026-08-17** (owner: backend + lead)

> **✅ RESOLVED** by migration `20260928000500` + `341` block J (+10, plan 57 → 67).
> `public.complete_evidence_upload_verification` **delegates** to the existing byte
> verifier (one verifier, no drift) and mints the evidence row in the SAME transaction.
> Both evidence actions now pass `{ evidenceCorridor: true }`; the old four-round-trip
> sequence survives ONLY as the idempotent-retry recovery path, where the bytes are
> already committed and there is nothing left to make atomic.
>
> ⭐ **The keystone I first wrote would have been VACUOUS, and the near-miss is the
> transferable part.** "Call the door with an unwritable actor, assert the file is still
> `verifying`" passes **whatever order the checks are in** — one RPC call is one
> transaction, so any raise rolls everything back. It asserts Postgres, not the
> migration; no reordering of the function could redden it. The property only becomes
> observable as the **difference between one round-trip and two**, so J2 CONSTRUCTS the
> orphan on the old path (`unscanned_accepted/0` — verified servable bytes, zero domain
> rows) and J4 shows the identical fixture cannot reach it (`verifying/0`). Same shape as
> [[construct-the-state-nobody-constructed]]: the assertion had to build the state the
> defect lives in before it could measure anything.
>
> **Mutation-proven, not asserted:** neutralizing `can_write_rca` in the door reddens
> **exactly J3 and J4** and nothing else. Restored from the migration file afterwards and
> the restore VERIFIED against `prosrc` ([[mutation-harness-must-prove-its-rollback-first]]).
>
> ⛔ **Two designs were rejected, and the reasons are load-bearing.** (1) *Grant the
> verification door to `authenticated` and wrap it* — its measured ACL is postgres +
> service_role, never authenticated, and it takes `p_sha256`/`p_verified`, an
> **attestation by the server that downloaded the bytes**. Exposed to `authenticated`,
> any JWT holder could mark its own upload verified under a fabricated hash, defeating D9
> on a PHI-adjacent corridor. J7 now pins BOTH doors closed. (2) *Impersonate the
> uploader so `add_rca_evidence` could be reused unmodified* — `auth.uid()` is
> `coalesce(request.jwt.claim.sub, request.jwt.claims->>'sub')` (catalog-read): **two**
> GUCs behind a coalesce, so setting the one you thought of leaves the other winning.
> [[guards-that-read-right-but-fail-open]]. The actor is instead read from
> `upload_sessions.reserved_by` — written by the user-scoped `begin_document_upload`,
> never supplied by the caller — and passed explicitly to the `(id, uid)` predicates.
>
> ⚠ **The document arm's validation is DUPLICATED in the new door, deliberately.**
> Extracting a shared helper would rewrite the bodies of `add_rca_evidence` and
> `add_capa_action_evidence` — two live DEFINER doors — and a body edit **orphans a
> name-keyed door verdict** ([[a-rename-orphans-a-name-keyed-verdict]]). The duplication
> is pinned executably instead: J3/J5/J8 assert the new door refuses and accepts on the
> same terms, so drift reddens rather than accumulating.
>
> ⬜ **NOT closed by this:** the ⭐ blind-class half below. `document-reconciliation.mjs`
> still cannot see a domain-layer orphan — J2c demonstrates one it would call healthy.
> The corridor can no longer MINT one, but pre-existing rows and the other three
> corridors are untouched. **That remains a binding input to S5.**

<details><summary>Original filing (2026-08-14) — retained</summary>

Filed 2026-08-14 at DM5 S2 close. Found by `backend` while implementing the TS layer;
**not a bug in what shipped** — it is a design gap the contract's single-argument
signature makes invisible.

**The real path.** `finalizeRcaEvidenceUpload(sessionId)` / `finalizeCapaEvidenceUpload`
delegate to `finalizeDocumentUpload` (`src/lib/documents/actions.ts:158`) rather than
re-deriving the D9 verifier — one verifier, no drift, which is right. The consequence is
that finalize is **four DB round-trips**:

1. `finalize_document_upload(sessionId)`
2. service-role `storage.download` + sha256 → `complete_document_upload_verification`
3. admin read `document_versions → documents` (the evidence title comes from
   `documents.title`, and finalize returns no `document_id` — see the note below)
4. `add_rca_evidence` / `add_capa_action_evidence` (`kind:'document'`)

**The failure path, precisely.** Steps 1–3 commit independently of step 4. If step 4
fails — e.g. `assert_rca_writable` raises `HC048` because the RCA was locked between
begin and finalize — the outcome is a **verified, servable `file_object`, a
`document_version`, a bound rendition and an `active` document, with NO evidence row**.
The user sees the upload fail. A retry re-enters at `begin_document_upload`, which mints
a **NEW** document: the orphan is never recovered, only accumulated. It is invisible to
`scripts/document-reconciliation.mjs`, whose classifier judges `file_objects` against
storage and would call this row perfectly healthy — because it is. The drift is at the
DOMAIN layer, which nothing reconciles.

**Why it is not fixed in S2.** Making it atomic needs a wrapping RPC that finalizes and
creates the evidence row in one transaction — a **design change, not a bug fix**, and S2
has already been reopened once. A partial mitigation IS shipped: an idempotency guard
probes for a live evidence row on the same `document_id` before inserting, so a *retried
finalize on the same session* recovers rather than duplicating. It does not help when the
session is already consumed and the caller restarts at `begin`.

⚠ **Related latent defect in the DM2 twin, not introduced here.**
`finalize_document_upload` returns no `document_id` on either arm, so
`finalizeDocumentUpload` yields `documentId: ''` on the idempotent re-call
(`actions.ts:172`, `r.document_id ?? ''`). It propagates through
`finalizeReferralReplyAttachmentUpload`, which returns that result straight to its
caller. S2 routes around it by resolving from `documentVersionId`; the twin still has it.

⭐ **This is a BLIND CLASS in the reconciliation tooling, not just a property of this
bug — and it is a binding S5 input.** `scripts/document-reconciliation.mjs` compares
storage against `file_objects` in both directions. It cannot see a document that has
bytes, a verified file object and **no domain row**, because every object it judges is
accounted for. **S5 must not sign off a reconciliation command whose coverage is
narrower than the orphan classes it is meant to catch** — S5's job is to name the
operational owner and mechanism for the disposal job and the reconciliation command,
and this is a class that command does not currently cover.

Cross-reference: **FUP-DM5-STORAGE-ORPHANS** is the same shape one layer down — an
emptiness proof narrower than the thing it claims to prove (the Storage API lists *from*
`storage.objects`, so it cannot see bytes that table has forgotten). Two layers, one
defect shape: **the reconciler's domain is narrower than the drift it is trusted to
rule out.**

</details>


### ⬛ FUP-DM5-DVF-FILEOBJ — ✅ **RESOLVED 2026-08-18 (`20260928000600`, `UNIQUE (file_object_id)`); ⛔ LOCAL ONLY — census the remote before `db push`** — latency had rested on CALLER DISCIPLINE ALONE (owner: backend)

> ## ✅ RULED 2026-08-18 (DM-FUP TRIAGE #4) — **add `UNIQUE (file_object_id)`**, in a migration above `20260928000500`
>
> Confirmed from the catalog: `document_version_files` carries `UNIQUE (document_version_id,
> rendition_kind)` and **nothing on `file_object_id`**. All three writers —
> `complete_document_reclassification`, `complete_document_upload_verification`,
> `mint_printed_document` — insert a `file_object` they minted in the **same call**, so 1:1 holds today
> by caller discipline and by nothing else.
>
> **Why structural beats a test:** a shared `file_object` means marking one row `disposal_pending`
> silently destroys **another row's** bytes, and no arm would notice. That is the failure ADR 0121's
> disposal lifecycle cannot absorb, so the invariant belongs in the schema rather than in a suite that
> pins current behaviour. The ruling **knowingly forecloses** rendition byte-sharing (a PDF whose
> `source` and `preview` are one object); the disposal-safety argument was judged worth that price.
>
> ⛔ **Census the remote for duplicates BEFORE pushing.** Local is **0 DVF rows / 0 duplicates**, so a
> green local `db reset` proves **nothing** about push-safety — a constraint migration that passes an
> empty local DB is exactly the shape that fails `db push` on data.
> → [[backfill-guard-wrap-data-dependent-migration]]

> **RE-CHECKED 2026-08-17 (the item's own "re-check at S4/S5" instruction).**
> ✅ **Still latent, for the stated reason:** `mint_printed_document` is the only door that
> both inserts into `document_version_files` **and** mints its own `file_objects` row, so the
> S3 property held.
>
> ⚠ **What the recheck ADDED, and it changes who must care.** The item reads as though the
> schema were holding the line. It is not: `document_version_files`'s only unique constraint
> is **`(document_version_id, rendition_kind)`** — there is **no uniqueness on
> `file_object_id`**. So one `file_object` bound to many versions is **structurally
> permitted**, `ON DELETE RESTRICT` is the only backstop, and nothing would notice a slice
> that started sharing bytes.
>
> ⛔ **This is a BINDING input to ADR 0121's disposal lifecycle, which is the slice that makes
> it live.** Disposing a shared `file_object` would retire bytes still bound to another
> version, and `complete_document_disposal`'s "all versions disposed" check walks
> `document_id`, not the sharing graph. Whoever builds the outflow must either add the
> uniqueness, or make disposal sharing-aware, or record the assumption executably.
>
> ⚠ A first pass at this recheck asked "does any door bind a pre-existing `file_object`" and
> got **two** hits (`complete_document_upload_verification`, `complete_document_reclassification`)
> — both false positives: they bind a row created moments earlier in the same corridor, which
> is not the sharing the item means. *The predicate was quoted at the wrong grain*
> ([[a-predicate-quoted-at-the-wrong-grain]]); the discriminating question was about the
> CONSTRAINT, not the callers.

⚠ **This item had no live bullet of its own** — it was named only inside the DM5 phase section's
"Open:" list and inside the DM5·S3 QA verdict. Both were rotated on 2026-08-14, so without this body
and the new live index line it would have disappeared entirely. Substance, from the QA r1 report:
the S3 mint **creates a fresh `file_object`** rather than binding a pre-existing one, which is what
ADR 0120 required S3 to ensure, so the concern **stays latent** — it becomes live only if a future
slice binds an existing `file_objects` row into `document_version_files`. Re-check at S4/S5.


### ⬛ FUP-NOTIFICATIONS-PHI-RESIDUE — ✅ **CLOSED 2026-08-20 as PREMISE-FALSIFIED** — `notifications.title/body` copy entity text at write time and NO dispose door touches the table (owner: backend; vehicle: DSR plan Slice 4)

> ## ✅ CLOSED 2026-08-20 — the residue class this item names DOES NOT EXIST
>
> Slice 4 opened by measuring the premise instead of building the fix. It does not hold.
> Full census in ADR [0130](../decisions/0130-dsr-subject-request-workflow.md)
> **Amendment 4**; the three findings in short:
>
> 1. ⭐ **`notifications.entity_type` cannot NAME three of the four doors' subjects.** Its
>    CHECK admits eight values and **`case`, `referral`, `event` are not among them**, so
>    the prescribed predicate matches **zero rows by construction** — and the pgTAP pin
>    this item asked for would have been vacuous *by CHECK constraint*, unfalsifiable by
>    any code. ⚠ Established by **constructing the state**: inserts of `'case'` and
>    `'referral'` were refused, with a `'meeting'` insert as the positive control proving
>    the probe could succeed. Reading the constraint would have been the same guess again.
> 2. ⛔ **This item's own cited evidence is false.** It argued *"ADR 0056 redacts
>    `cases.label` because it is PHI-warned — but every notification that label ever
>    generated keeps the pre-redaction text."* **No notification writer reads
>    `cases.label`.** One writer exists (`app.enqueue_notification`) with sixteen callers;
>    none touches a case label. The described residue has never existed. The writer set is
>    **bounded**, not merely enumerated: `notifications` has SELECT/UPDATE policies only and
>    **no INSERT privilege GRANTED to `authenticated` at any grain** — table or column — so nothing inserts
>    except that DEFINER.
>    ⛔ **CORRECTED (QA r1):** this first read *"grants `authenticated` `r` alone"* — **false**.
>    The table ACL is `authenticated=r`, but `pg_attribute.attacl` carries a **column** grant
>    `read_at = authenticated=w` (how the INVOKER `mark_notification_read` works) that
>    `pg_class.relacl` does not show. The conclusion holds — the grant is scoped to `read_at`,
>    and `title`/`body` stay unwritable (constructed + rolled back) — but the reason was wrong.
>    ⭐ **A table ACL is not the privilege census: `attacl` belongs beside `relacl`** — and this
>    slipped into the very sentence claiming the enumeration was *bounded*.
> 3. **No notification text source is erased by any door** — census cross-referenced
>    against all four bodies, zero overlap. Even `meeting`, the one representable subject,
>    would have had `meetings.title` copy scrubbed while `dispose_meeting_minutes`
>    deliberately keeps that column.
>
> ⭐ **Why it read as obviously right for a day:** the design was inferred from the
> *column names* — `entity_type`/`entity_id` look exactly like a polymorphic handle to the
> disposed entity — and was internally coherent throughout. Only the **writers** say what
> the key points at, and `compute_due_ethics_notifications` stores a **`cases.id` under
> `entity_type = 'ethics_notification'`**. *A predicate read off a column name is a guess
> wearing a schema's authority.*
>
> **Successor:** `FUP-DOOR-ERASURE-FREETEXT-CENSUS` — the real question this stood in
> front of, and it is about the doors, not about `notifications`.

Filed 2026-08-19 (lead) — measured during the DSR design session: `notifications` carries `title` +
`body` built from entity labels/summaries at event time, and none of the four `dispose_*` door
bodies references the table. ADR 0056 redacts `cases.label` *because* it is PHI-warned — but every
notification that label ever generated keeps the pre-redaction text. So a `granted` disposal leaves
PHI residue in a table the erasure claim never mentions.

**Fix (decided, Q12a):** each dispose door gains a scrub of `notifications.title/body` by
(`entity_type`, `entity_id`), one pgTAP pin each **plus the vacuity control** (a sibling entity's
notification must survive — a scrub test that would also pass on `delete from notifications` is not
a pin). [dsr-workflow-plan.md](../plans/dsr-workflow-plan.md) **Slice 4**. Until built, the two-tier
outcome record's residue language must not claim notifications are clean.


### ⬛ FUP-DOOR-ERASURE-FREETEXT-CENSUS — ✅ **CLOSED 2026-08-20 — RULED OUT OF SCOPE by ADR 0131, not remediated.** The four dispose doors erase a hand-picked column set, and at least one door demonstrably erases a GRANDCHILD while leaving its CHILD's free text intact (owner: backend; found 2026-08-20 while falsifying `FUP-NOTIFICATIONS-PHI-RESIDUE`)

> ⛔ **CLOSED BY RULING 2026-08-20, and the distinction is load-bearing: the residue is REAL,
> MEASURED and ACCEPTED — not absent.** ADR
> [0131](../decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md) bounds PHI
> erasure to **designated PHI fields**; free text and titles that *may* hold PHI are out of
> pilot scope, with **training** as the compensating control, and the pilot's effort goes to
> perfect execution on the confirmed set. Shipped reach (the ADR 0056 Amdt 1 meeting
> widening) is **maintained, not rolled back**.
>
> **The measurement is retained deliberately** →
> [door-erasure-freetext-census.md](./door-erasure-freetext-census.md): 133 candidate columns
> across the three doors, incl. `case_narrative_revisions.body_md` (every prior revision of
> prose the door does erase) and `rca_why_chains.steps` (jsonb). That record is what makes
> the acceptance auditable; deleting it would leave the decision with no evidence of what
> was accepted.
>
> ⚠ **Consequence carried forward, not closed:** `DSR_RESIDUE_NOTICE` line 1 is now
> conditionally rather than structurally true → `FUP-RESIDUE-NOTICE-RESTS-ON-TRAINING`.
> ⛔ **Explicitly NOT descoped by 0131:** `FUP-DISPOSE-EVENT-DOOR-GATE-BLIND` (a *gate*, not
> a reach) and `FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES` (an operational procedure) — both are
> "perfect execution of the confirmed set" and remain owed.

Filed 2026-08-20 (lead). Successor to `FUP-NOTIFICATIONS-PHI-RESIDUE`, which was closed as
premise-falsified — this is the question that one was standing in front of, and it is about
the **doors**, not about `notifications`.

**The measured instance.** `capa_plan.source_event_id` is a FK straight to
`patient_safety_event`, so a CAPA plan hangs directly off a patient-safety event and its
rows are on a PHI lane. `dispose_event_phi` erases `capa_plan.lessons_learned_md`,
`capa_effectiveness.method_md`, `capa_measure_result.note` and
**`capa_action_task.description`** — the *grandchild* — while leaving
**`capa_action.title`** (`text not null`, operator free text, the *child*) untouched. Two
readings, and the item exists because nobody has ruled between them: either the title is
out-of-scope by design and should be *recorded as such*, or the door **under-erases** and
has done since it shipped.

**Why this is a class and not one column.** Three further free-text columns are copied into
`notifications` at write time and are erased by **no** door: `meetings.title`,
`action_items.title`, and the form-section title. That census was assembled from the
notification *writers*, which is an arbitrary lens — it enumerates the columns that happen
to be quoted in a notification, **not** the columns a door leaves behind. The real boundary
is *"every free-text column on the lane each door claims to clear"*, and nothing has ever
enumerated it. ⚠ Bound this by the **property**, not by a table list and not by whatever a
door's own body already mentions — a door's body is exactly the wrong enumerator, because
what is missing from it is the finding.

**Method that is known to work here** (it found both this and the DM2 child-lock gap): a
**column census of the door's subject tables and their descendants**, diffed against the
door's actual erasure set from `pg_proc`. Reading a door tells you what it redacts; only
reading the tables tells you what it does not.

⭕ **MEASURED 2026-08-20 (lead) — the census half is DONE; the ruling half is OPEN.** Full
record, method, the five instrument defects and the six-anchor control battery →
[door-erasure-freetext-census.md](./door-erasure-freetext-census.md). Headlines, both
**verified directly against `prosrc`** rather than through the instrument:
- ⛔⛔ `dispose_case_phi` erases `case_narratives.body_md` and **never names
  `case_narrative_revisions`** — every prior revision of the same prose survives. An
  erasure that clears the current narrative and keeps its version history has not erased
  the narrative.
- ⛔ **No door names any `ethics_*` table** (0 matches across all four). Eleven free-text
  `*_md` columns on a lane that hangs off `cases` by composition.
- ⭐ `rca_why_chains.steps` (**jsonb**) survives while its `root_text` sibling is erased —
  the Slice 4 lesson recurring: *free text is not a type*.
- ✅ The filed instance (`capa_action.title`) is **confirmed**, and its sibling shape
  recurs in a second door: `referral_internal_notes.title` survives while `body_md` dies.

⛔ **The method this item prescribed missed the lane holding its own filed defect.**
Composition closure (FK `NOT NULL` + `ON DELETE CASCADE`) cannot reach `capa_plan` —
`source_event_id` is NULLABLE — so the capa lane was invisible until the walk was seeded
with *the door's own write set* as well as the root. Three of the five instrument defects
under-reported, each producing a clean confident answer on the one column named above.
⚠ **A candidate count is not a defect count**: run against the PO-ruled-**complete**
meeting door the same census returns **16**, which is the noise floor.
⚠ **Static, therefore bounded**: it cannot see a `where` clause that matches no rows. The
successor instrument is an **empirical sentinel differential** (seed every free-text column,
run the door, assert which sentinels survive) — not yet built.

⛔ **Consequence if the census finds PHI.** `DSR_RESIDUE_NOTICE`'s first line —
*"O descarte apaga os dados do paciente armazenados no banco para este registro"* — is a
claim about the **database**, shown to an operator discharging an LGPD obligation. It is
sound only while the doors really do clear their lane. A confirmed under-erasure makes that
line the same species of over-claim `FUP-DISPOSE-DIALOG-OVERCLAIM` was filed to remove, in
the constant written to prevent it. Re-check the notice as part of closing this item.


### ⬛ FUP-ETHICS-LANE-NO-ERASURE-DOOR — ✅ **CLOSED 2026-08-20 — RULED OUT OF SCOPE by ADR 0131, not remediated.** Seven `ethics_*` tables hang off `cases` by composition and hold twelve free-text columns; no disposal door names any of them (owner: backend + PO; split out of `FUP-DOOR-ERASURE-FREETEXT-CENSUS` 2026-08-20 on PO instruction)

> ⛔ **CLOSED BY RULING 2026-08-20 — the residue is REAL, MEASURED and ACCEPTED.** ADR
> [0131](../decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md): PHI erasure
> reaches designated PHI fields only; free text that *may* contain PHI is out of pilot
> scope, with **training** as the compensating control. The `ethics_*` lane holds **no
> designated PHI field**, so it is descoped in full. ⛔ Do not read this close as
> "investigated, nothing found" — everything measured below still stands.
>
> ⚠ **One half of this item is NOT obviously ruled on, and is preserved here rather than
> buried in the close.** The lane exposed **two** data subjects. The *patient* half follows
> directly from 0131. The other is the **accused professional**, whose allegation text is
> personal data about them — **Class-2 professional identity** (Rule 12), a different data
> class from patient PHI, for which ADR 0130's DSR workflow can return `granted` with **no
> door to call**. ADR 0131 is written about *PHI*. Whether it also rules on Class-2 erasure
> is the PO's to confirm; until then this question is open even though the item is closed.

Filed 2026-08-20 (lead). Split from `FUP-DOOR-ERASURE-FREETEXT-CENSUS` because it is not a
missed column on a covered lane — it is **a whole module with no erasure path at all**, and
absorbing it into a per-column ruling would have hidden that difference. Census record:
[door-erasure-freetext-census.md](./door-erasure-freetext-census.md).

**Measured against the live catalog, 2026-08-20:**

- **`ethics_` appears ZERO times in all four disposal doors' `prosrc`** — `dispose_case_phi`,
  `dispose_event_phi`, `dispose_referral_phi`, `dispose_meeting_minutes`. Not "partially
  covered": named nowhere.
- **7 tables, 12 free-text columns**, every one a direct child of `cases` with
  `case_id NOT NULL` + `ON DELETE CASCADE` — i.e. **composition**, the same relation that
  makes `case_narratives` unambiguously in scope:
  `ethics_allegations.description_md` · `ethics_appeals.{appeal_reason_md,outcome_rationale_md}` ·
  `ethics_case_details.{admissibility_rationale_md,summary_md}` ·
  `ethics_decision_details.remediation_description_md` ·
  `ethics_findings.{evidence_summary_md,rationale_md}` ·
  `ethics_hearings.{outcome_md,summary_md}` · `ethics_notifications.notes_md`.
- **Nothing structurally separates an ethics case from a patient case.** `cases.case_type_id`
  is a data-driven FK, not an enum, and **no CHECK gates any `ethics_*` table by case type**
  (measured: 0). So a case may hold ethics rows *and* patient participants simultaneously,
  and `dispose_case_phi` is the erasure door for **all** cases regardless of type.

⛔ **Why 🔴 rather than 🟠.** Two distinct data subjects are exposed, not one:
1. **Patient PHI** — an ethics narrative on a case with a patient participant may quote the
   clinical facts, and the door that exists to erase that case's PHI does not reach it.
2. ⭐ **The accused professional is themselves a data subject.** An ethics allegation is
   personal data *about a named professional*, which is exactly what the ADR 0130 DSR
   workflow adjudicates. A `granted` erasure on such a request has **no door to call** — the
   workflow can decide, and the platform cannot execute. That is a gap in the DSR program's
   own promise, not only in the case module's.

**What must happen** — PO ruling first, two shapes, and the choice is not obvious:
(a) **widen `dispose_case_phi`** to cover the lane, treating ethics prose as case content; or
(b) **rule the lane out of scope with a recorded basis** — a plausible one exists (an ethics
proceeding is a governance record with its own retention duty, and redacting a finding may
destroy the evidence of due process), in which case `DSR_RESIDUE_NOTICE` must **disclose**
it, since the notice claims the database is cleared.
⛔ Do not pick (b) by default because it is cheaper. The Slice 4 precedent is the opposite
ruling on the same question: *make the claim true, then disclose what is retained.*

⚠ **Bounded:** this is a **static** finding — `ethics_` is named in no door body. It does not
rest on the census instrument (which was wrong five times before it was right); it was
verified by a direct `prosrc` match returning 0 across all four doors. What it does **not**
establish is that these columns hold data today, which is a fixture question and irrelevant
to the structural gap.


### ⬛ FUP-MEETING-DISPOSAL-LEAVES-CHILD-TEXT — ✅ **CLOSED 2026-08-20 (DSR Slice 4 item 4)** — meeting PHI disposal redacts THREE of `meeting_agenda_items`' four text columns and none of the other child tables' (owner: backend; vehicle: DSR plan Slice 4)

> ## ✅ CLOSED 2026-08-20 — the door was WIDENED (PO-ruled), and the census found 10 columns, not 4
>
> This item gave two lawful exits and forbade the middle. ⛔ **Slice 4's copy half shipped
> straight into the forbidden state** — `DSR_RESIDUE_NOTICE` went live claiming the record's
> database patient data was erased, while none of these columns were named as retained. That
> is what QA r1 blocked on, and it is the sharpest lesson of the slice: **an open follow-up
> naming your slice as its vehicle is scope you already own**, not adjacent work.
>
> **PO ruled: widen the door.** Making the claim *true* beat hedging it — the notice is shared
> by all four doors, so a meeting-specific retention line would have been false on the referral
> and case lanes.
>
> ⭐ **The census returned 10 columns, not the 4 this item listed** — and every one of the six
> additions was missed by a *boundary that looked principled*:
> - `meeting_closed_session_items.{substance, decision, withdrawals}` — **depth-2** (keys on
>   `closed_session_id`), so a direct-children census cannot see it. The most sensitive prose
>   in the aggregate.
> - `meeting_minutes_jobs.{transcript, draft, result}` — ⭐ **`draft`/`result` are `jsonb`**
>   carrying the AI-generated minutes text. The first census filtered on
>   `text/varchar/citext`. ***Free text is not a type.***
> - `meeting_attendees.external_org` — sitting directly beside the `external_name` this item
>   did list.
>
> ⛔ **The finding that outranks the whole item.** Only 3 of `audio_job_status`' 6 values
> purge the transcript. A job resting in **`done`** — transcribed, awaiting human review, the
> normal resting state — kept the **verbatim transcript of everything said in the meeting**,
> indefinitely, and disposal never touched it. That falsifies ADR 0056 **§4's central claim**
> ("disposal erases all DB-side PHI"), not merely the residue copy. Now nulled
> **unconditionally** and set-based (no `limit 1` — there is no UNIQUE on `meeting_id`), so
> the fix does not depend on the transition graph being complete. *A lifecycle predicate needs
> the transition graph, not the state list.*
>
> **`meetings.title` is KEPT, by PO ruling, and therefore DISCLOSED** — the second lawful exit,
> taken deliberately for one column: it is the meeting's identity in every list. Named in the
> new `DSR_MEETING_RESIDUE_RETAINED`, beside (never merged into) the shared notice.
>
> ⚠ **Two implementation findings a column list could never show.**
> **(a)** `meeting_attendees_identity_xor` — a blanket `set external_name = v_redacted` stamps
> internal attendees, violates the CHECK and **aborts the entire disposal**: a legal obligation
> failing closed on every meeting with an internal attendee. The conditional branches are
> load-bearing for *correctness*, and this was visible only in `pg_constraint`.
> **(b)** The first census was measured **mid-`db reset`** and returned an **empty trigger
> census when there are 17** — which reads as *"no guards, safe to widen."* Re-derived as one
> REPEATABLE READ snapshot bracketed by the migration count.
>
> **Coverage:** pgTAP `351`, **33** assertions (its declared `plan()`) on a **locked** meeting (⭐ a `scheduled` fixture
> fires neither guard, so the pins would pass while the door is broken for every real
> disposal), every redaction paired with a sibling-meeting survival control; **17/17
> neutralization probes RED**, harness proving anchor-uniqueness and that the probe *moves* the
> live body hash and restore *returns* it. Includes the over-grant twin (guard widened to
> `in_meeting_rpc` → reds t32 alone) and guard-removal (door aborts).
> ⚠ **One pin was found vacuous by its own author**: t22 asserted "no row has both `user_id`
> and `external_name`" — but under the mutation the CHECK raises, everything rolls back, and an
> unchanged row still satisfies it. **Green while the door was completely broken**, because it
> pinned what the constraint guarantees structurally. Rewritten as a differential (the row must
> be *touched* while `external_name` stayed NULL).
>
> ⛔ **Do NOT cite `ARM=census` / `ARM=wrapper` as coverage here.** Both are exit 0 and both are
> **vacuous for this change**: the guards return `trigger` and `dispose_meeting_minutes` returns
> `void`, so neither changed function is in any arm's domain and no findings file carries a
> verdict for either. ADR 0079 Amdt 1's syntax-filtered case list is likewise **empty**; it was
> swept **by the property** instead (recorded in ADR 0129 Amendment 1). What covers this is
> pgTAP 351, mutation-proven in both directions.
>
> Records: ADR 0056 **Amendment 1** (incl. the PHI classification of every retained column) ·
> ADR 0129 **Amendment 1** (`app.in_disposal_rpc` had **two readers, still one setter** *as of
> 2026-08-19* — the flag's one-reader bound was 0129's own stated property, so it could not be
> widened silently).
> ⛔ **Corrected 2026-08-21: that sentence was present-tense in a LIVE file and had gone false.**
> ADR 0129 **Amendment 3** took it to **3 setters / 5 readers**. ⭐ It was found by sweeping the
> axis *"which statement of the invariant did I just falsify?"* — not by the three-instance list a
> reviewer had pointed at, which would have missed this one and one other. **The bound was never
> the count**: it is that only the LGPD disposal doors set the flag, and the setter count is what
> bounds the bypass. Re-derive it from `pg_proc`, never quote a figure in prose.
>
> ⛔ **No successor follow-up — a claimed gap did not survive measurement.** The build reported
> that *"a PHI-bearing title on a locked meeting has no product remedy"* (`update_meeting`
> refuses outside `scheduled`/`held`, and disposal targets locked meetings), and it was written
> into ADR 0056 Amdt 1 and the constant's docblock before being checked. **It is false as
> stated absolutely.** `reopen_meeting` issues two updates to *different tables* —
> `meeting_signatures → 'revoked'` **and `public.meetings → 'held'`** — and `held` **is** in
> `update_meeting`'s allowed set, so the remedy is the revoke corridor already documented in
> `DSR_ATTEST_PROCEDURE_COMMON`: reopen → edit → re-sign, at the real cost of a revision bump
> that invalidates registered prints (ADR 0126 D9). Both records corrected in place.
>
> ⚠ **And my correction was itself too absolute — narrowed on re-measurement, which is the
> point.** The corridor is **narrower than the disposal door in two measured ways**, so the
> original claim was wrong *everywhere it was stated*, not wrong *everywhere*:
> **(1)** `reopen_meeting` accepts only `in_signature` and `signed`, while the child lock covers
> those **plus `distributed` and `cancelled`** — and `app.guard_meeting_status`' transition list
> has **no arm whose `old.status` is `distributed` or `cancelled`** (verified: its only arms are
> `scheduled`/`held`/`in_signature`/`signed`). For those two terminal states the title genuinely
> **cannot** be changed by any door. **(2)** `dispose_meeting_minutes` gates on
> `is_staff_admin_of` **OR** `is_tenancy_admin_of`; `reopen_meeting` on `is_staff_admin_of`
> alone — so the operator holding the erasure duty may be unable to walk the corridor.
> ⭐ *Correcting a claim's **direction** without re-deriving its **magnitude** produces a second
> wrong claim that reads as a fix.* This is why the four pt-BR retention lines deliberately do
> **not** point operators at the corridor: it would be advice that is wrong for two of the four
> locked states and for a whole class of operators.
> ⭐ **The shape, because this slice hit it repeatedly:** the gate was read correctly and the
> target population was read correctly, but no one asked whether *another door moves the row
> into the permitted state*. **A gate tells you what it refuses; only the transition graph tells
> you what is reachable** — the same lesson as the `done`-state transcript, one level up.

**Measured 2026-08-19 from `information_schema` + the live `pg_proc` body**, while building ADR 0129.
`dispose_meeting_minutes` nulls `meetings.minutes_md` and redacts
`meeting_agenda_items.{description, discussion_notes, resolution}`. The free-text columns it does
**not** touch:

| Column | Touched by any dispose door? |
|---|---|
| `meeting_agenda_items.title` | ⛔ **no** — three of that table's four text columns are redacted; `title` survives |
| `meeting_attendees.{note, external_name}` | ⛔ no |
| `meeting_closed_sessions.label` | ⛔ no |
| `meeting_cases.{summary, decision}` | ✅ yes — but by `dispose_case_phi`, per-case (ADR 0056 §2's deliberate decoupling), **not** by the meeting door |

⚠ **This is an over-claim, not a regression.** ADR 0056 §2 *declares* exactly this scope, so the door
does what its ADR says. The defect is that the **language** around it — the disposal confirmations and
the runbook — reads as "the meeting's PHI is erased", and an agenda item titled with a patient's name
survives that claim. `title` is the sharp one: a reader who sees three of a table's four text columns
redacted will reasonably assume the fourth was considered.

**Why it belongs to DSR Slice 4** (residue + copy honesty, ADR 0130 Decision 9): Slice 4 already owns
the fixed, pre-written residue language and the `referral-dispose-dialog` rewrite. Either the columns
join the redaction set or the residue language names them as retained — **the one thing that must not
happen is the current state, where neither is true**. Sibling item: `FUP-NOTIFICATIONS-PHI-RESIDUE`.

⚠ Note the method that found it, because the door's own suite could not: a **column census of the
guard's four child tables**, run for an unrelated reason (checking what the child lock protects).
Reading the door tells you what it redacts; only reading the *tables* tells you what it does not —
[[new-door-must-inherit-every-sibling-arm]], applied to columns.


### 🟡 FUP-CASE-PHASE-RESULT-ASSIGNEE-UNDERGRANT — the UI boolean cannot express the door's per-phase assignee arm (owner: frontend/PO; filed 2026-08-21, case-surface-split Increment 1, QA F-6; ✅ **RESOLVED 2026-08-22 — PO ruled WIDEN; delivered as a KIND + a server-gate fix**; two residues filed separately; index line rotated → [follow-ups-archive.md](follow-ups-archive.md))

`public.set_case_phase_result_override` (`prosecdef = t`) admits **`v_assigned_to = auth.uid()` ∨
`app.is_staff_admin_of(commission)`** — measured from the live catalog; there is **no `member_can`
arm**, so an administrativo is correctly excluded.
⛔ **GRAIN CORRECTION (QA r2 R-4, re-measured 2026-08-21):** that disjunction is **NOT the door's
authority** — it is **one branch of two**. The body reads `if v_phase_status not in ('active',
'completed') then raise …; if v_phase_status = 'active' then if not (v_assigned_to = auth.uid() or
v_is_staff_admin) then raise 42501`. **The assignee arm applies ONLY while the phase is `active`**;
once `completed` the caller falls to the other branch and it is **coordinator-only**. The original
filing quoted one branch as the whole guard — the same wrong-grain error this program recorded
against a line-filtered `prosrc` read, committed here by hand instead. **The under-grant is
therefore narrower than filed:** it is the *active*-phase assignee who is offered nothing.
But the **assignee** disjunct is **per-phase**,
and the UI's `canManagePhaseResults` prop is a **per-case boolean**, so it cannot represent it.
Increment 1 set the manage host to `phaseResultsOn && access.role === "staff_admin"` — which is
correct as far as it goes and closed a real over-grant T1 had created.

**The residue** — ⛔ **CORRECTED 2026-08-22 (frontend, at build time): the original wording below was
WRONG IN BOTH DIRECTIONS, and the truth is a BIGGER gap, not a smaller one.**
① *"Offered no affordance anywhere"* is **false**: the active-phase assignee already has a path — the
**end-of-wizard override panel**, which reaches the same RPC through `submitCasePhaseResponse`
(member-authorized). So the item over-stated the user-visible harm.
② But the real gap is **wider than the assignee**: on the **case-detail** surface an `active` phase
offers the override to **NOBODY — the coordinator included** — because `case-phase-article.tsx:113`
hard-codes `phase.status === "completed"`, while the door admits assignee ∨ coordinator on `active`.
③ And it **cannot be closed in the UI alone**: the dialog's server action `overrideCasePhaseResult`
(`src/lib/cases/result-actions.ts`) pre-checks with its own `authorizeCommission` — `isAdmin ∨ membership
staff_admin` — which is **coordinator-only and strictly narrower than the RPC**, so a widened UI would
have produced a dead end behind a friendlier string than `42501`. ⭐ Class:
[[sql-door-is-not-evidence-about-its-ts-caller]] — the door was measured correct and the TS caller
re-filters. ⚠ That same gate admits `isAdmin` where the **RPC has no `is_admin` arm at all**, so it is
*also* wider than its door in the other direction — an existing dead end for `platform_admin`.

_Original wording, kept because the correction is the point:_ a phase's own assignee who is *not* a
coordinator can legitimately override that phase's result at the DB and is offered no affordance
anywhere. That is an **under-grant**, and its
signature is the dangerous one — a dead-end door raises a visible `42501`, an under-grant emits
**nothing at all**: no error, no log, no failing test. No §6 gate can detect it.

Deliberately **not** closed inside Increment 1: surfacing the assignee arm needs a per-phase prop
and is a product decision about whether phase assignees should self-serve result corrections, not a
gap to be silently patched. **Fix direction if ruled in:** thread a per-phase capability rather than
widening the per-case boolean.


### 🟡 FUP-CASE-T5-MEUS-CASOS-UNREPOINTED — T5 shipped narrower than its own text (owner: frontend; filed 2026-08-21, QA F-7; ✅ **RESOLVED 2026-08-22 — PO ruled the behaviour right and the PLAN TEXT wrong**; T5 clarified, index line rotated → [follow-ups-archive.md](follow-ups-archive.md))

Plan T5 says board/list rows link to manage detail for viewers passing the entry predicate. Shipped:
the `/casos` staff board and `manage/cases` re-point; **`meus-casos` rows still link to `/casos`**.

⚠ **This is arguably correct, not merely unfinished** — "Meus Casos" is by definition
name-attributed work, which D1 keeps on `/casos`. Filed rather than fixed because the *plan text*
and the *shipped behaviour* disagree, and one of the two is wrong: either re-point the rows, or
amend T5 to state the exception and why. Leaving them disagreeing is what makes a later reader
"fix" the wrong one.


### 🟡 FUP-ORPHAN-ADMINISTRATIVO-REACHABILITY-UNVERIFIED — the dead-end door WAS reachable (owner: backend; filed 2026-08-21 from QA F-3's remediation; ✅ **RESOLVED — MERGED to local `main` 2026-08-22 (`be546bbf`)** — see § Resolution; index line rotated → [follow-ups-archive.md](follow-ups-archive.md))

`app.member_can` = `feature_enabled('administrativo') ∧ is_active(uid) ∧ app.is_member_of(commission)
∧ ∃ capability row` (measured **four times independently** now; ADR 0134 Amdt 2 **M8**). The TS mirror
`canInCommission` checked **no membership**, so the mirror was **wider than the door** — an
administrativo whose commission membership was removed but whose capability row survives was, on
the TS side, offered affordances the DB refuses.

**Filing state, kept:** the entry recorded reachability as UNVERIFIED **in both directions** and
guessed "probably not" — `access.role` is membership-only, and the commission shell 404s
`role === null && !isQualityViewer && !isTenancyAdmin`. It said so rather than asserting it because
the docblock it replaced had stated the door's *opposite* for weeks (QA F-3).

⛔ **The close condition as filed would have closed this WRONG.** It said "construct an orphan and
measure whether they reach the board". QA's review (§7.8) had already sharpened it to *"construct
orphan × tenancy-admin **and** orphan × quality-reviewer"* and warned, in those words, that the plain
orphan is **the one composition that provably cannot reach** — so testing only it returns a clean
GREEN that means nothing. That warning was correct and load-bearing: the sharper question is the
whole finding.

**✅ Resolution — MEASURED 2026-08-22 by construction, then FIXED. Not committed, not merged; this
entry stays OPEN until it is.**

**1. The guess was HALF WRONG, and wrong about the mechanism even where it was right.**

| composition | `member_can` | commission row readable | reaches `/manage/cases` |
| --- | --- | --- | --- |
| C0 control — **member** administrativo | **true** | 1 | **yes, and the door SERVES it** |
| C1 plain orphan | false | **0** | no |
| C2 orphan × **tenancy-admin** | false | **1** | ⛔ **YES — offered "Novo caso"** |
| C3 orphan × **quality-reviewer** | false | **1** | ⛔ **YES — offered "Novo caso"** |

- **C1 never reaches — but NOT via the shell gate this entry predicted.**
  `commissions_select_member_or_admin` denies a plain orphan the commission ROW, so
  `getCommissionAccessByOrg` returns `null` and `!access` 404s them one step *earlier*; the shell's
  `role === null && …` test never runs. Confirmed by the rendered boundary: C1 gets the **root**
  404 ("Não encontramos esta página"), which only a LAYOUT `notFound()` produces.
- **C2 and C3 DID reach.** They read that same row on a different policy arm
  (`is_org_admin_of` / `is_quality_reviewer_of`), arrive with `role: null` **and** a full
  `capabilities` array — the appointment and capability rows survive a membership deletion (no FK,
  no cascade trigger) and stay readable through the **hat-blind** `user_id = auth.uid()` self arm of
  `commission_administrativo_capabilities_select`. Both were offered "Novo caso"
  (C2 twice — header + empty state) and both got **"Você não tem permissão para esta ação."**
  ⚠ C3's rendered inside the **`QualityViewerShell`**, i.e. a write affordance inside a shell
  labelled *SOMENTE LEITURA*.

**2. Dead END, not over-grant — measured, because the severity turns entirely on it.**
`create_case_from_template` opens `if not (is_staff_admin_of ∨ member_can(…,'create_cases'))`, and
both arms were **false** for C2/C3 (`is_staff_admin_of` is membership-only — an org_admin does not
satisfy it). Driven through the real dialog: the control created a case (board 22 → 23, torn down by
id); **neither orphan created anything**. The refusal surfaces as sanitized pt-BR, not a raw `42501`.

**3. The fix is in the mirror, not the pages.** `canInCommission` now carries the membership
conjunct `app.member_can` always had — `access.role !== null` **is** that test, since `role` is
populated only from the caller's own hat-filtered, non-expired `memberships` row. ⛔ It cannot
under-grant: enumerated from the catalog, **every** consumer of the four capabilities is
`is_staff_admin_of OR member_can(…)` — 9 functions plus the three `meetings_staff_admin_*` policies
— and both arms require a membership. The narrowed mirror is the door's shape exactly.

**4. Controls, stated in full including what cannot fail.** Unit: `session-capability-mirror.test.ts`
(5 cases) — neutralized, **1 of 5** goes RED, and it is the orphan row; the other four pass either
way because they do not exercise the missing conjunct. E2E:
`orphan-administrativo-reachability.spec.ts` (4 tests) — neutralized **and the standalone bundle
rebuilt**, C2 and C3 go RED, C0 and C1 stay GREEN. ⭐ **Only 2 of the 4 E2E tests guard this fix**;
C0 guards the fixture and C1 guards a different mechanism upstream of the mirror. C3's RED needed a
`-g` run of its own — the file is `serial`, so C2's failure aborted it and **"did not run" is not a
verdict**.

⛔ **A wrong matcher read exactly like a live defect.** The spec's first draft matched only the root
404 copy and reported C2 as *still reaching the board* on a build that had already fixed it. The two
boundaries carry different text — root `not-found.tsx` says "Não encontramos esta página", the
commission-scoped one says "Página não encontrada" — and the distinction is not cosmetic: it names
*which* gate fired. The spec now asserts the KIND, so a C2 refusal by the shell (C1's reason) cannot
be mistaken for a refusal by the board gate.

**5. Regression, run: `administrativo.spec.ts` 10/10, plus `cases-board-access` /
`case-manage-entry-gate` / `case-custom-fields` / `casos-reading-surface-differential` 21/21.** The
`administrativo` POS tests are the no-under-grant twin — they drive all five other `canInCommission`
call sites (meetings, sign-off queue + drill-in, case meta, phase assignment) as a *member*
administrativo, and all still pass.

**6. Left alone, deliberately:** `hasCaseStanding`'s `isAdministrativo` arm on the board page. After
the mirror fix every principal past the gate above already satisfies its `isCommissionMember` arm, so
it can no longer decide anything. Kept as a fail-closed backstop and **documented as redundant rather
than counted as defense in depth** — it reads off the same `context.memberships` as the gate above,
so it is the same predicate twice, not a second lock.

**Fixtures are purely additive** — C1/C2/C3 are built by *appointing* three personas who already hold
no CCIH membership (`staff2.farm`, `orgadmin.a`, `quality.a`), never by deleting a seed persona's
membership; `seed.sql` is a contract with ~900 tests. Teardown is asserted empty and the seed's own
four grants asserted intact.


### 🟡 FUP-CASOS-ABSENCE-DIFFERENTIAL-UNASSERTED — the case-wide affordance class has **no absence assertions on `/casos`** (owner: tester; filed 2026-08-21; ✅ **RESOLVED — MERGED to local `main` 2026-08-22 (`be546bbf`)** — see § Resolution; index line rotated → [follow-ups-archive.md](follow-ups-archive.md); ⛔ **WRONG TWICE, corrected twice — read the history, it is the point of this entry**)

⛔ **Filing history, kept because the item was wrong in a different way each time:**
1. **v1 — FALSE.** Claimed case tags and the outcome selector had *“zero E2E coverage on any route”*. Both **are** covered on the manage host (`cases-extras.spec.ts:443` assigns a tag via `getByRole('region', {name:/Etiquetas/i})`; `processless-cases.spec.ts:473` drives the “Desfechos disponíveis” dialog). Cause: the sweep grepped **button labels**, while the real coverage uses a role+region locator and a dialog filter containing none of those strings — *a grep bounded by a label is a proxy for the property, not the property.* It reached the tracker as “confirmed … twice”, which reads like a measurement and was a restatement of one unsound search.
2. **v2 — STILL HALF WRONG.** Claimed *“both were narrowed off `/casos` by Increment 1”*. Measured against the merge base: **tags** gate on `caps.canWriteContent`, which Increment 1 newly narrows, so tags did move — **but only for write-grantees** (a coordinator's were already hidden). The **outcome selector** gates on `caps.canManageLifecycle`, which `8675b7cd` already zeroed, so it was **already absent on `main` for everyone** and this increment changed nothing about it. And the class is **not two members**.

⭐ **The lesson is the repetition, not the item.** Each correction fixed the specific wrong clause and left the *method* that produced it unexamined — which is how one entry was wrong three times in a day, twice while being corrected. **Recorded as [[a-partial-fix-reads-as-a-complete-one]].**

**What is actually open.** The case-wide affordance class — QA's enumeration, **to be re-derived by property before use, not quoted**: *Novo item · Adicionar registro · Anexar documento · custom fields · Corrigir resultado · Ativar e atribuir*, plus **tags** — has **no absence assertions on `/casos`**. Manage-side presence is covered for several of them; the `/casos` side is asserted for none. Close it the way `case-access.spec.ts` AC-3b and the T6 narrative differential are built: absence on `/casos` paired against presence on manage, same user and case, counted by structure as well as accessible name. ⚠ State for each member whether its absence is **new** (Increment 1) or **pre-existing** (`8675b7cd`) — conflating those is what made v2 wrong. ⛔ **And one member is already mis-labelled, which is v2's error one member over: “Corrigir resultado” is PRE-EXISTING, not new** — it *looks* new because its prop stopped being passed, but `effectiveCanManagePhaseResults` had already zeroed it for that class. **Derive new-vs-pre-existing per member from the merge base; never infer it from “the prop changed”.**

**✅ Resolution — BUILT + GREEN 2026-08-22, `e2e/casos-reading-surface-differential.spec.ts` (5 tests). MERGED to local `main` 2026-08-22 (`be546bbf`); the condition this entry named is satisfied and it is CLOSED.**

**1. The class, re-derived by property (not quoted).** Property: *an affordance rendered by `CaseDetailView`, or by the manage `(detail)` layout header that is its twin, whose visibility gate is a CASE-WIDE capability.* All six such gates resolve in ONE file (`case-detail-view.tsx`), which is what makes this an enumeration rather than a checklist: **G1** `caps.canWriteContent` · **G2** `caps.canManageLifecycle` · **G3** `effectiveCanAssignPhases` · **G4** `effectiveCanEditCustomFields` · **G5** `effectiveCanManagePhaseResults` · **G6** `canEditMeta` (prop deleted, ADR 0134 F-5). ⭐ **The derivation returns 16 members — QA's enumeration named 7.** The **nine** it missed entirely: *Encaminhar caso* · *Nova entrevista* · *Adicionar participante* · *Não necessária* · *Desfecho do caso* · *Adicionar fase* · *Adicionar narrativa* · *Editar desfechos disponíveis* · the case-meta *Editar*. The hand-list was under half the class, wrong in the same direction as v1's grep.

**2. New vs pre-existing is a (MEMBER × VIEWER-CLASS) CELL, not a member property** — measured at the merge base **`df88dced`**, never inferred. Coordinator column: **entirely PRE-EXISTING** (`readingAsMember` was already true there and already zeroed BOTH caps). Write-grantee: **G1 is NEW** (the trigger widened to `isReadingAsMember`); G2–G5 were never theirs on either host and are asserted as a *both-hosts control*, never as a differential. Administrativo: **G3 and G6 are NEW** (`/casos` itself passed both props at `df88dced`). "Corrigir resultado" confirmed **PRE-EXISTING for every class**, as this entry warned.

**3. A THIRD mechanism the entry did not anticipate — NEVER-FED.** Three members are absent because `/casos` has never passed their fuel, at `df88dced` or at HEAD: *Adicionar fase* / *Adicionar narrativa* (`adHocForms`/`adHocNarrativeTypes`) and *Editar desfechos disponíveis* (`casesExtrasEnabled`). ⛔ **The spec's first draft labelled the third one narrowing-driven and the neutralization control is what caught it** — with the narrowing fully neutralized the button still did not appear. A member's mechanism is measured, not read off the gate it looks like it belongs to. A fourth, the case-meta *Editar*, is absent because its JSX was **deleted**.

**4. The neutralization control (the part that makes the absences mean anything).** Run manually against the local stack, reverted immediately, `git diff -- src/` empty before continuing. **N1** (`narrowToReadingSurface` → identity): **9 of 14** members flip PRESENT on `/casos`; COORD-1 + WRITE-1 RED, ADM-1/PLESS-1/CF-1 correctly stay GREEN. **N2** (`isReadingAsMember` → false **and** the three props re-passed by `/casos`): **11 of 14**, adding G3 and G5; ADM-1 flips on G3 alone, CF-1 on G4. ⭐ **G4 and G5 needed BOTH halves neutralized** — for a coordinator they are doubly guarded, the "neither end is load-bearing alone" design measured rather than asserted. ⛔ **Four members cannot be made to fail at all** (the three NEVER-FED + G6): for those the `/casos` half is a regression guard, and the manage-side positive is what carries the differential. Stated because a control map listing only what flipped reads as though everything did.

**5. Still not covered, deliberately:** the **administrativo × custom fields** cell (the one NEW cell with no reachable fixture — `FUP-ADMINISTRATIVO-CUSTOM-FIELDS-ARM-NOT-E2E-VERIFIABLE`, needs a seed change routed to Increment 2) · narrative authorship (owned by AC-3b + T6; its attributed half is reused here as the anti-over-reach control) · patient-panel edit (PHI, owned by `case-patient.spec.ts`) · event visibility (a field inside a dialog whose trigger is already proven unreachable).

**Fixtures** are built and torn down by the spec itself (a published 2-phase template with an emitting phase driven to `completed` through the real RPC chain — `case_phases` refuses every direct write outside `app.in_case_rpc`; a process-less case; a per-case write grant; an assigned narrative). Teardown verified empty after the run. Nothing seeded is mutated.


### 🟡 FUP-ADMINISTRATIVO-CUSTOM-FIELDS-ARM-NOT-E2E-VERIFIABLE — the `member_can` disjunct has no reachable fixture (owner: backend/tester; filed 2026-08-21, QA r3 §8.3)

**Measured from the DB, not asserted:** exactly **one** case platform-wide carries custom-field values; exactly **three** principals can read it (`chefe.ccih`, `dualhat.a`, `quality.a`); exactly **one** non-coordinator holds `create_cases` (`staff2.ccih`), and `can_read_case` for them on that case is **false**. So the `member_can('create_cases')` arm of `update_case_custom_field_values` cannot be exercised end-to-end by any seed persona.

⚠ **Do not state this as “not E2E-verifiable” unqualified — that overstates it.** `case-custom-fields.spec.ts` **AC-5** (coordinator edits custom fields on the manage host) and `administrativo.spec.ts` **POS-2** pin everything **except** the `member_can` disjunct. That one disjunct is what has no reachable fixture.

⭐ **This is the SECOND reason the R-2 under-grant was invisible** — alongside the fact that an under-grant emits no signal at all, even a spec written to catch it would have had no persona to write it with.

**To close:** a **seed** change — a case with custom-field values readable by a `create_cases` holder. Deliberately **not** done in Increment 1, which is DB-free **by decision** and whose empty `supabase/` diff is load-bearing in three gate records (it is why no diff-scoped door sweep was required). Forcing a seed change in would have broken the boundary those records rest on. Natural home: Increment 2, which touches the seed anyway for `read_cases`.


### 🟠 FUP-S8-UNBOUNDED-BY-CASE-ACCESS-POLICY — D6's S8 arm has no `explicit_grants_only` bound, and the resulting bit-shape IS a quality reviewer's (owner: backend/PO; filed 2026-08-22, from the ADR 0134 Amendment 3 wording test; ✅ **RESOLVED — residue discharged and MERGED to local `main` 2026-08-22 (`be546bbf`)**; index line rotated → [follow-ups-archive.md](follow-ups-archive.md))

✅ **RULED 2026-08-22 by the PO — ADR 0134 Amendment 4: S8 IS bounded by `not v_eg`, exactly like S5
and S7.** An `explicit_grants_only` case is invisible to the arm; reach there rides an explicit grant
(S3) or nothing. ⛔ **The item stays OPEN, because a ruling is not an implementation** — what remains
is listed under *To close* below, and none of it is discharged by the ADR edit. The ruling was made
**separately from Amendment 3** and does not inherit its scope; Amendment 3 §A3.7 item 5 says so
explicitly.

**Measured from the live catalog 2026-08-22** (`pg_get_functiondef` on `app._case_caps`,
`app.can_read_case`, `app.is_oversight_only_reader`, `app.is_member_of`) — not read from a migration
file, which is stale by design here:

- `app.can_read_case` = `has_case_capability(case, uid, 'read_case_content')`. Content bit only.
- **S5 · `committee_member_default`** confers `read_case_deliberation` **only**, and is guarded
  `if v_member and not v_eg`, where `v_eg := (v_policy = 'explicit_grants_only')`.
- **S7 · `quality_reviewer`** confers `read_case_content` + `view_case_overview`, deliberately **no**
  `read_case_deliberation`, and is likewise bounded `not v_eg`.
- `app.is_oversight_only_reader` = `read_case_content ∧ ¬read_case_deliberation` — i.e. **the
  quality reviewer's bit-shape is the predicate**, not a role test.

**The gap:** ADR 0134 D6 specifies S8 as conferring `read_case_content` **only**, and neither the ADR
nor [case-surface-split.md](../plans/case-surface-split.md) mentions `explicit_grants_only`, `v_eg`
or a locked-case bound **anywhere** (measured: zero occurrences in both). Two consequences, and the
second is the one that will not announce itself:

1. **An unbounded S8 overrides `explicit_grants_only`** — the access policy whose entire purpose is
   that only explicit grants confer reach. Both sibling read arms (S5, S7) are bounded by it; a new
   read arm that is not inherits none of that intent. *A new door must inherit every sibling arm's
   check, and no authz arm can see a door that OMITS a check its siblings all make.*
2. **On such a case the administrativo's bits become content-without-deliberation — exactly
   `is_oversight_only_reader`** — so every door keyed on that predicate classifies an appointed
   administrativo as a quality reviewer. First live instance: `public.file_correction_request` refuses
   them (`42501`) while `/casos` still renders the "Corrigir…" affordance, because the UI's
   `isOversight` is `access.isQualityViewer` — **a different test from the door's**. A dead-end door,
   the same shape ADR 0134 Amendment 1 §A1.2 caught for `bulk_create_cases`.

⚠ **Not established: the size of the affected door set.** `file_correction_request` is the one member
found while measuring something else. Before M2 ships, enumerate **by property** — every routine whose
comment-stripped `prosrc` references `is_oversight_only_reader` — never by recalling which doors
"feel oversight-related".

**To close** — ~~a PO/backend ruling on whether S8 is bounded~~ ✅ **ruled 2026-08-22 (yes, bounded)**;
what is left is all implementation, inside Increment 2, and each item is a separate way this can still
go wrong:

1. **The `not v_eg` condition in the M2 arm itself**, written from `pg_get_functiondef` and positioned
   with the other positive arms so it inherits STEP 4's hard denies the way S5/S7 do.
2. **P9** — locked-case negative: `can_read_case` false, absent from `list_cases_board`,
   `get_case_detail` refuses.
3. **P9-twin** — remove the bound, P9 must go **RED**. ⛔ Non-optional: a check a door OMITS is
   invisible to every ARM, so nothing else in the §6 gate set can see this bound at all. An asserted
   bound and an absent bound look identical in a green suite.
4. **P10** — bit-shape, both directions (ordinary case: holds content **and** deliberation, so not
   `is_oversight_only_reader`; locked case: holds neither). Amendment 4 §A4.2 derives this from the arm
   conditions and says so; P10 is what makes it evidence.
5. **P11** — an explicit S3 grant on a locked case still confers reach. The bound narrows the *arm*, not
   the *grant path*.
6. **The door-set enumeration** by comment-stripped `prosrc` referencing `is_oversight_only_reader`,
   recorded. ⚠ Size still **not established** — `file_correction_request` is the one member found while
   measuring something else.

⛔ **Do not close this item on the ADR edit.** The ruling settled the design question in one line; every
line above is still un-built, and this is the register the PO reads reach from.


### 🟠 FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME — the sweep's domain is a syntax standing in for a property (owner: backend; filed 2026-08-22, found when the census's own remediation recipe could not clear the gate it raised; ✅ **RESOLVED 2026-08-22** — four-way partition + `ARM-DOMAIN` census, both halves proven; ⭐⭐ it also surfaced that the script **exited 0 on `BLIND: 5`**. Record: [case-split-assertion-integrity.md](case-split-assertion-integrity.md); index line rotated → [follow-ups-archive.md](follow-ups-archive.md))

`supabase/tests/mutation/p0-authz-door-audit.sh:~231` bounds the **predicate arm** by a **name prefix**:

```
prosecdef = true AND ( (rettype = bool AND proname ~ '^(is_|can_|has_|referral_target_analyst|attachment_confidentiality_ok)' AND proname !~ '^is_valid_') OR proname = 'assert_not_case_excluded' )
```

**How it surfaced.** `ARM=census` correctly VIOLATED on the brand-new gate `app.member_can_for`, and the
diff-scoped door sweep it prints **as the remediation** then ran **zero cases** — `member_can*` matches
no prefix. The run printed **`BLIND: 0  ERROR: 0`** with an empty predicate arm and an empty policy arm.
⛔ **A detector that found nothing because it looked at nothing, and in a gate record that reads as a
clean pass.** (The findings file was not overwritten — 0 cases, empty `git diff --numstat` — so the
known clobber hazard did not bite.) It was resolved honestly, by adding `member_can_for` to
`authz-unswept-backlog.txt` beside its twin `member_can`, which has been there since the first census —
**not** by hand-writing a COVERED row into a machine-generated findings file. That file's own rule holds:
*a verdict nobody earned is worse than an admitted gap.*

**Measured 2026-08-22 (live catalog):**

| property | count |
|---|---|
| `SECURITY DEFINER` functions in `app` + `public` | **802** |
| in the predicate arm's domain | **101** |
| outside it | **701** |
| ⭐ outside it **and returning `boolean`** — i.e. shaped exactly like a predicate, excluded purely by NAME | **42** |

Among those 42: **`_audit_access_authorized`** (the gate in front of every PHI-read audit),
`confidentiality_clearance_ok`, `capa_viewer_can_manage`, `interview_viewer_can_write`,
`rca_writer_can_write`, `member_can`, `member_can_for`, `event_capa_fully_settled`,
`artifact_belongs_to_commission`, `department_belongs_to_commission`. The rest are feature-flag readers
and `validate_*` shape-checkers, which is why **42 is not the defect count either** — the set needs
classifying by whether each is an authorization predicate, which no regex decides.

⛔ **Bound, stated so this is not over-read: "outside the predicate arm" ≠ "unswept".** The audit has
other arms, and `ARM=census` demonstrably reached `member_can_for` — that is how this was found.
**Whether each of the 42 is covered by another arm is NOT established by this measurement.**

⚠ **Same class, one level worse, recorded in the same place:** `app._case_caps` — the resolver every
case predicate bottoms out in — returns **`int`**, so it is in **no** arm's domain at all (`census`,
`hat`, `floor` and `wrapper` each bound by `prosecdef` as a *boolean gate*). Its only evidence is the
targeted P4/P9-twin mutations written by hand for this increment. That is the pre-existing
`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` class.

**To close:** replace the name filter with the property it stands in for, or — if no computable property
exists — make the arm **declare its domain size and refuse to report `BLIND: 0` on an empty domain**. ⛔
An empty-domain run must not be able to print the same line a clean run prints; that is the whole finding
and it is cheaper to fix than the classification.

---

#### ⭐ Third instance, 2026-08-22 — and the first on a REAL SHIPPED CHANGE, not on a new gate

The two instances above were both about a **brand-new** object (`member_can_for`), which is the easiest
case to dismiss as a corner. The Increment-2 PHI migration produced the general form. Its §6 step-1 gate
record reads:

> `ARM=census` 0 · `ARM=hat` 0 · `ARM=floor` 0 · `FROMFINDINGS=1 ARM=wrapper` 0 — **all HOLD**

**All four held VACUOUSLY with respect to that change.** Measured per object, not inferred:

| changed object | `prosecdef` | returns | in a census/bool domain | in the invoker arm |
| --- | --- | --- | --- | --- |
| `public.bulk_create_cases` | t | `integer` | **no** | no |
| `public.create_case` | t | `cases` | **no** | no |
| `public.create_case_from_template` | t | `cases` | **no** | no |
| `public.set_participant_patient` | t | `uuid` | **no** | no |
| `app._set_participant_patient_unchecked` | **f** | `uuid` | no | **no** (arm is `nspname='public'`-bounded) |

Four are `prosecdef` **scalar non-bool command doors** — the census's own explicitly-named excluded class
(`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`, 407 reachable). The fifth is an `app` INVOKER helper, outside a
`public`-bounded arm. The diff-scoped sweep was then **run rather than predicted**, with all five objects
passed in: **PREDICATE ARM empty, POLICY ARM empty, `BLIND: 0  ERROR: 0`** — zero cases, the same line a
clean run prints. Findings file verified untouched.

⇒ **A change that rewrote the authority gate of the bulk-creation door and added a new PHI writer moved
through all four ARMs without any of them looking at it.** The actual coverage is the targeted mutation
twins written by hand in `357` / `189`. ⛔ The gate record must say *which arm had a domain* — "four ARMs
HOLD" is true and, on this change, means nothing.

⚠ **A class with no home, found in the same pass:** `app._set_participant_patient_unchecked` is in **no**
tracked authz class at all — not the census contract (`prosecdef` booleans + policies), not the
audit-invoker-wrapper class (`public`-bounded), not the composite-returning backlog. Unlike
`member_can_for`, there was no backlog section it belonged to. Ruled 2026-08-22: add the class to
`authz-unswept-backlog.txt` with membership **derived by property** (schema `app`, `prosecdef = f`, writes
a PHI-bearing or invariant-bearing table, not executable by `authenticated`/`anon`), ⭐ expecting **≥ 2**
members — `app._grant_case_access_unchecked`, the precedent it was modelled on, should be one, and if that
function is not already tracked anywhere then this class has been unswept since before this increment.


### 🟠 FUP-GRANT-CASE-ACCESS-UNCHECKED-HAS-NO-COVERAGE — the precedent every `app` unchecked writer is modelled on has never been tested (owner: backend; filed 2026-08-22, found by deriving a class instead of naming an instance; ✅ **RESOLVED 2026-08-22** — `358` §A pins both class members' ACL + `prosecdef` and the 3-caller set, red-first. ⛔ The `ARM=census` PRUNE hint was NOT acted on. Record: [case-split-assertion-integrity.md](case-split-assertion-integrity.md); index line rotated → [follow-ups-archive.md](follow-ups-archive.md))

Filed because a **property sweep** was run instead of a hand-list. Increment 2 added
`app._set_participant_patient_unchecked` and it landed in **no tracked authorization class at all**.
Rather than invent a class around the new function, the lead required its membership be derived by
property, and predicted the count would be **≥ 2** — because the function the new one was *modelled on*
must be a member. It is.

**Property:** schema `app` · `prosecdef = f` · `prokind = 'f'` · comment-stripped body performs an
INSERT/UPDATE/DELETE on a table carrying **PHI or an authorization invariant** · **not** executable by
`authenticated`/`anon`. **Returns 2.**

| member | ACL | `authenticated` / `anon` EXECUTE | targeted coverage |
| --- | --- | --- | --- |
| **`app._grant_case_access_unchecked`** | `{postgres=X/postgres}` | f / f | ⛔ **NONE KNOWN** |
| `app._set_participant_patient_unchecked` | `{postgres=X/postgres}` | f / f | `357` mutation twins, `276` O5+O5b, `321` K8 |

⛔ **`app._grant_case_access_unchecked` writes `case_access_grants` — the table that decides who can
reach a case — with no authority check of its own, by design, and it has carried no targeted mutation
case and belonged to no tracked class since it was written (2026-07).** ⭐ **The class predates the
increment that revealed it.** The new helper did not create this gap; it made it visible, by being the
second member of a class nobody had drawn.

⚠ **It is not unprotected — it is untested, and those are different claims.** Its ACL is
`{postgres=X/postgres}`, `authenticated` and `anon` hold no EXECUTE, and schema `app` is not exposed to
PostgREST. What is missing is a **pin that any of that is still true tomorrow**: nothing reddens if the
ACL is widened, if it is flipped to `SECURITY DEFINER`, or if a fifth caller appears.

⚠ **Sweep hygiene recorded with it**, because the exclusions matter as much as the members: the property
returns **four** `app` INVOKER writers. Two are excluded — `app.save_instance_answers` and
`app.seed_default_answers` — for **two independent reasons each**, so the exclusion does not rest on the
weaker one: they write response-plane **content** (neither PHI nor an invariant), **and** they *are*
executable by `authenticated` **and** `anon`, because their `proacl` is **NULL — the permissive default
including PUBLIC**. Not escalated (`app` is not PostgREST-reachable — see
`FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED`), but recorded: that is the fail-open shape this repo
has hit four times.

⛔⛔ **DO NOT ACT ON THE CENSUS'S PRUNE HINT.** Once both members were entered in
`authz-unswept-backlog.txt`, `ARM=census` began printing them every run under *"backlog entries with no
matching live gate (renamed/dropped — prune)"*. The note is **correct about its own domain and wrong as
advice**: the census's live-gate set is `prosecdef` booleans, set-returning doors, `public` INVOKER
plpgsql and policies, and these are `app` INVOKER **scalars** — they match nothing in it, **which is
exactly why they are listed**. Acting on that hint deletes the admitted gap. Both entries carry a
DO-NOT-PRUNE block naming the note verbatim. ⭐ A gate that instructs the next maintainer to remove the
record of a gap is worth more attention than the gap.

**To close:** a targeted mutation case for `_grant_case_access_unchecked` of the same shape the new
helper has — ACL widened ⇒ red · flipped to `SECURITY DEFINER` ⇒ red (the differential that proved
INVOKER is the second lock, run on this function too) · caller set pinned by property. ⛔ Do **not**
close it by asserting today's ACL alone; an assertion that restates the current catalog and cannot fail
is the shape this increment spent the day removing.


### 🟠 FUP-CREATE-CASE-IS-ADMIN-DISJUNCT-VS-THE-NOUN-RULE — `platform_admin` can create commission content, and `create_case` is the only creation door that lets them (owner: PO decision, measured by backend; filed 2026-08-22, split out of QA B1; ✅ **RESOLVED 2026-08-22 — PO ruled REMOVE; ADR 0134 Amdt 8**; index line rotated → [follow-ups-archive.md](follow-ups-archive.md))

**Not the PHI half.** QA B1's PHI widening is CLOSED by migration `20261003000800`: `create_case`
now refuses a `p_patient` payload unless the caller is `is_staff_admin_of ∨ member_can('create_cases')`,
refused **at the gate** with its own pt-BR message, pinned in `357` §8c both directions plus a
same-door positive control. **This item is the disjunct underneath it**, which was deliberately left
alone: it is pre-existing, outside Increment 2's authorization, and a noun-rule question the PO has
never been asked.

**The question.** CLAUDE.md §1 (ADR 0078 A35, the *noun rule*): `platform_admin` **may** administer
**tenancy, identity, vocabulary and audit**, and **may NOT** touch **commission content or PHI**.
`public.create_case`'s authority gate is
```sql
if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()
        or app.member_can(p_commission_id, 'create_cases')) then
```
⇒ a hatted `platform_admin` can open a case — commission content — in **any commission of any
tenant**, and (`create_case:341-343`) receives a `creator_self_grant` READ on it, so they can then
read what they opened. `app.is_admin()` requires the entitlement **and** `active_role() =
'platform_admin'`, reachable in the product through `assume_role`.

**⭐ THE SHARP MEASUREMENT — it is the sole outlier of its own family.** Comment-stripped `prosrc`
over the three creation doors:

| door | `app.is_admin()` arm | writes PHI |
| --- | --- | --- |
| **`public.create_case`** | **YES** | yes |
| `public.create_case_from_template` | no | yes |
| `public.bulk_create_cases` | no | yes |

Two doors that do the same thing disagree, and nothing records which is intended. The delivery that
found this even wrote the correct reasoning nine lines long for `bulk_create_cases` — *"NO
`app.is_admin()` DISJUNCT AND NO TENANCY ARM … the noun rule keeps platform_admin out of commission
content"* — one function away from where it was needed.

**Population, by property** (`public` routines whose comment-stripped body calls `app.is_admin(`):
**11**.
```
create_case · create_framework · create_referral_requested_action · delete_standard ·
list_approver_candidates · set_case_offered_outcomes · set_framework_status ·
update_framework · update_referral_requested_action · upsert_standard · verify_audit_chain
```
⚠ **The split below is a JUDGEMENT, not a measurement, and it is offered for the PO to correct.**
Per the standing lesson that *"is this caller gated?" is a per-function judgement no text filter
decides*, the count of 11 is the closed set; which of them are "commission content" is not derivable
from `prosrc`:
- **Plausibly noun-rule territory (content):** `create_case`, `set_case_offered_outcomes`,
  `create_referral_requested_action`, `update_referral_requested_action`.
- **Plausibly sanctioned (vocabulary / catalog / audit — explicitly allowed by A35):**
  `create_framework`, `update_framework`, `set_framework_status`, `upsert_standard`,
  `delete_standard`, `verify_audit_chain`.
- **Unclassified:** `list_approver_candidates` (identity-adjacent; not read).

**Why it is filed rather than fixed.** Removing the disjunct would (a) change `platform_admin`
behaviour outside this increment's authorization, and (b) need re-derivation against the **whole**
reach, not just the PHI half — the `creator_self_grant` above is the part a narrow reading misses.
⛔ And the census census-arms cannot help here: `create_case` returns a composite, so it is in **no
authz ARM's domain**; nothing would have flagged this and nothing will flag the next one.

**To close:** a PO ruling on whether `platform_admin` may create commission content at all — with,
whichever way it goes, a pin at the DOOR (not the predicate; asserting the predicate is what let the
PHI half hide, QA B1's recorded contributing cause) and a same-door positive control so the verdict
is not a broken fixture.


### ⬛ FUP-ADR-AMENDMENT-HAS-NO-BACK-POINTER — ✅ **RESOLVED 2026-08-24** — an amended ADR reads as live, and only the amending ADR knows (owner: lead; filed 2026-08-23 at the AFF2 post-Record documentation review)

> **Closed by doing the three steps below in the order this item required.**
>
> **(1) Detector reads direction, not proximity.** `scripts/build-adr-index.mjs` parses the
> declarative `**Supersedes:**` / `**Amends:**` header label. ⭐ It also had to learn **voice**:
> `**Amended (2026-07-14):**` in ADR 0073 is that ADR recording it *was* amended, and a naive
> `/amend/` test read it as a forward claim — reproducing **this item's own named false
> positive, `0073 → 0078`**, by a different mechanism. `\b` fails before the trailing `d`, so
> `amends` never matches `amended`; that is the whole fix. The same pass found a *missing* edge
> the proximity sweep never had: ADR 0047 `**Extends / partially reverses:**` ADR 0032.
>
> **(2) Measured, then back-pointed.** The real population, replacing the 44 upper bound:
> **50 verb-edges → 42 distinct source→target pairs across 30 amended ADRs**, of which only
> **5** carried a hand-written back-pointer (0028, 0032, 0033, 0061, 0120). All 30 now carry a
> generated `<!-- adr-backpointers -->` banner directly under the H1 — a pure insertion, no
> existing line touched, and the richer hand-written decision-level notes in those 5 are left
> exactly as they were. The banner is ADR-level ("0078 changed this one"); those notes are
> decision-level ("D9 specifically"), and they complement rather than duplicate.
>
> **(3) Gate built only after (1).** `npm run lint:adr-index` is gate 9. It byte-compares both
> the index and every banner, so a new ADR declaring `**Amends:** 0033` puts the pointer into
> 0033 with nobody remembering to. Idempotency and **edge-neutrality** are pinned in the
> self-test — without the latter the generator would read its own banners back as new edges and
> never reach a fixed point.
>
> ⚠ **What is still uncovered, unchanged from the filing:** an ADR whose claim went false with
> **no** amending ADR to point back from, and an amendment nobody declared with a label. No gate
> can see either — an undeclared amendment leaves no trace to detect. The Record step
> (lead-playbook §4 step 5) is the only place the label is checked.

ADR 0133 declares *"**Amends** ADR 0097 D11 + D14, ADR 0098 §W3.2, and ADR 0048 D10."* Measured at the
Record step: **all three amended ADRs contained zero occurrences of `0133` or `AFF2`.** A reader arriving at
ADR 0048 D10 read *"LGPD minimization: no `date_of_birth`"* while the column existed and was being
collected; a reader at 0097 D14 read *"person-level fields are `org_admin`-only"* and *"account deactivation
is unreachable by hospital admins"*, both retired. **Those three are now fixed** (in-place amendment
blockquotes, matching the house style 0097 D4 and D14 already used for ADR 0098's amendments).

⛔ **The class is not.** A property-derived sweep over `docs/decisions/` — every ADR that claims to
supersede or amend another, checked for whether the target mentions the claimant — reports **44** such
relationships with no back-pointer, including `0110 → 0109` (which PROGRESS.md independently records as a
real supersession) and `0079 → 0078`.

⚠ **Do NOT quote 44 as a count.** The detector is **proximity-based** — an ADR number within 160 characters
of the word *supersede*/*amend* — and it demonstrably over-reports: `0073 → 0078` was a false positive,
because ADR 0073 line 31 reads *"Amended … reconciled to ADR 0078"*, which is a back-pointer **already
present, in the correct direction**, misread as a forward claim. A number-ordering filter (a later ADR may
amend an earlier one, not the reverse) removed exactly that one hit and no others, so the remaining shapes
are unbounded. ⭐ *A detector that finds a lot needs proving too* — **44 is an upper bound on a population
whose true size is unmeasured; 4 are verified by hand.**

**Fix, in order:** (1) sharpen the detector to read **direction** rather than proximity — parse the
declarative `**Amends** / **Supersedes**` header line ADRs already use, not free prose; (2) run it, and
back-point what it finds; (3) only then consider a gate. ⛔ **Do not add a `lint:` gate for this before
step 1** — a proximity detector wired to a gate would red on its own false positives and be waived, which
is worse than no gate. ⚠ And note what no gate can catch: an ADR whose **claim** went false with **no**
amending ADR to point back from. This item covers only the case where the amendment exists and is
one-directional.


### ⬛ FUP-CASE-DEPARTMENT-FIELD-HAS-NO-CONSUMER — ✅ **RESOLVED 2026-08-24, PO ruling: DELETED** (owner: PO + frontend)

> **Ruled option 1.** `case-department-field.tsx` and `case-department-field.test.tsx` are
> deleted. The two call-site comments that described the component as *"retained by decision"*
> were corrected in the same edit, and `edit-case-meta-dialog.tsx`'s docblock now says to recover
> the component from git if ADR 0137 D9 is ever reversed — so the next reader does not re-derive
> this question from an absence.
>
> ⭐ The reason it needed a ruling rather than a cleanup: it was **dead code wearing a green
> check**. A test-only consumer satisfies `tsc`, eslint and `lint:vacuous` forever, and no gate in
> the eight can distinguish "exercised by the product" from "exercised only by its own test".
> `DepartmentsManager` — the hospital-admin department VOCABULARY — is untouched; it is a
> different component, which was the false premise this item existed to correct.

ADR [0137](../decisions/0137-mrn-erasure-key-and-case-referral-usability-batch.md) **D9** removed the
"Unidade / setor" input from BOTH of `CaseDepartmentField`'s app call sites (`create-case-dialog.tsx`
and `edit-case-meta-dialog.tsx`, Increment 1). Measured after that change:
`grep -rn "CaseDepartmentField" src/ --include=*.tsx` returns the component's own definition, two
explanatory comments, and **`case-department-field.test.tsx`** — **no app consumer at all.**

⚠ **The Increment 1 brief's parenthetical is FALSE as written.** It read *"the component survives (the
hospital-admin surface still uses departments)"*. The hospital-admin surface uses the department
**vocabulary**, through `components/hospitals/departments-manager.tsx` — a **different component**.
`CaseDepartmentField` is the per-case picker, and nothing renders it now. The brief's instruction ("do
not delete the file") was followed, so this is a *recorded* orphan rather than an undetected one.

⛔ **Not a defect and not urgent** — five tests still pass and nothing is broken. What is owed is a
DECISION, and it is one of exactly three:

1. **Delete** the component + its test (D9 says the case models a unit as a process custom field, ADR
   0083, so the picker has no future call site).
2. **Wire it** somewhere the department is still authored per case (no such surface exists today —
   inventing one would reverse D9).
3. **Keep it deliberately** as scaffolding for a named future increment — in which case say which one,
   in the file's docblock, or the next reader re-derives this same question.

⛔ **Do NOT delete it in this batch** (lead ruling 2026-08-23) — it is outside D9's scope, and deletion
is a decision, not a cleanup.

⚠ **The reason nobody will notice this on their own: it is DEAD CODE WEARING A GREEN CHECK.**
`case-department-field.test.tsx` still renders the component five times and still passes. A test-only
consumer satisfies `tsc` (the import is real), eslint (the symbol is used), and `lint:vacuous` (the
assertions are unconditional and genuine) — **forever**. There is no gate in the eight that can
distinguish "exercised by the product" from "exercised only by its own test", so this item's index line
in PROGRESS.md is the ONLY thing that will ever raise it again. The resolution event is the ruling, not
the code: whichever way it goes, the answer belongs in the component's docblock.


### ⬛ FUP-REFERRAL-REVIEW-STEP-MRN-WARNING — ✅ **FIXED 2026-08-24** (owner: frontend)

> The review step renders `REFERRAL_MESSAGES.sendRequiresMrn` **verbatim** (no second string)
> as a non-blocking `role="status"` note. The MRN input's `required` is untouched and
> `Salvar rascunho` still works, so pgTAP `363 §1.2a` is unaffected.
>
> ⭐ **The binding constraint is honoured — and tightened by measurement.** The buffer is
> authoritative only when `!isResume || resumePatientState === 'loaded'`. ⚠ This item's table
> implied `idle`-at-review was reachable; it is NOT — the only route to `review` runs through the
> patient step, and reaching that step fires the load (the step indicator `<ol>` is not
> clickable, verified). The row that pays for itself today is **`error`**: on a failed prefill
> the buffer is empty and an unguarded warning would fire on precisely the draft whose stored MRN
> this session could not read. The guard is still written over the STATE rather than over that
> routing, because the routing is one button away from changing and the failure is silent.
>
> Nothing fetches, so no `referral_patient.read` audit row is emitted for merely reaching review.
> Six tests, each pairing a VISIBLE case with an ABSENT one; two neutralizations red exactly
> their own assertions.

ADR [0137](../decisions/0137-mrn-erasure-key-and-case-referral-usability-batch.md) **D4** makes the MRN
mandatory at SEND: `public.send_referral` raises `HC0T4`, `mapReferralError` maps it, and
`sendReferral` surfaces `REFERRAL_MESSAGES.sendRequiresMrn` in the wizard's error banner. That works —
but the coordinator only learns after pressing **Enviar encaminhamento** and eating a round trip.

**The ask:** render `sendRequiresMrn` as a NON-BLOCKING warning on the wizard's review step when the
referral will be refused for a missing MRN, so the requirement is visible before the attempt.

⛔ **Do NOT invent a second string.** Reuse `REFERRAL_MESSAGES.sendRequiresMrn` verbatim — backend
confirmed 2026-08-23 that its wording ("Informe o prontuário do paciente antes de enviar o
encaminhamento.") already reads as advance notice, not only as a refusal. Two sentences for one rule is
the drift class this repo keeps paying for.

⛔ **Do NOT block the send, and do NOT touch the MRN input's `required`.** The DB is the authority
(D3's three-layer model), and a native `required` would break `Salvar rascunho`, which D4 deliberately
keeps working — pgTAP `363 §1.2a` pins that a name-only PHI block still SAVES.

---

⛔⛔ **THE BINDING CONSTRAINT — the naive version of this is WRONG, and wrong in the direction that
teaches people to ignore warnings.** Raised by `inc0-backend` 2026-08-23, who read
`goToPatientStep()` rather than assuming.

The wizard's resume PHI hydration fires **only** inside `goToPatientStep()`, once, asynchronously:

```
if (isResume && referralId && onLoadPatient && !resumePatientLoaded) { … }
```

So on a RESUMED draft the local `patient` buffer is **empty until the coordinator actually walks
through the patient step** — even when the server already holds a perfectly good MRN. A warning driven
off the buffer alone is therefore **FALSE exactly on the resume path**: it tells a coordinator their
referral has no MRN when it does, and pushes them to re-enter PHI that already exists.

**Render only when the buffer is AUTHORITATIVE. Three cases, and the third is the important one:**

| Case | Buffer is truth? | Render |
|---|---|---|
| Fresh draft | ✅ yes — nothing is persisted until flush | Warn. This is where it earns its keep (majority path). |
| Resume, patient step visited (`resumePatientLoaded`, transition settled) | ✅ yes | Warn. |
| Resume, patient step never visited | ⛔ **no — the client cannot answer** | **Render NOTHING.** Not a warning, and not a reassurance either. |

⛔ **And do NOT fetch to power the warning.** That is the tempting fix and it is the wrong one:
`get_referral_patient` emits an audited `referral_patient.read` row, fired deliberately *on intent, not
on card mount*. A review-step warning that fetched would emit a PHI-read audit row for merely REACHING
review — quietly changing what `referral_patient.read` means in the audit trail. That is a Rule 11 /
Rule 12 semantic change smuggled in as a UX nicety, and it is a **lead decision, not a component one**.

⭐ **The silence in case 3 is the correct answer, not a gap.** *"I could not look" is not "I looked and
found nothing."* A warning that renders identically for "no MRN" and "MRN unknown to this client"
collapses exactly the two states `FUP-DM5-NO-ANSWER-VS-NOTHING` exists to keep apart.

**Why it was filed rather than built** (lead ruling): beyond §2c as scoped; the PO approved D1–D14, not
adjacent improvements; and it adds accessible names that would land on the tester mid-gate. It is a
genuine improvement on the majority path and costs nothing to suppress on the one path where the client
cannot honestly answer — so it is worth doing, just not inside this batch.



## ⬛ FUP-0137-PROCESSLESS-CASES-CANNOT-REQUIRE-PHI — ✅ **CONCLUDED 2026-08-24 by PO ruling: EXPECTED, and in line with platform specifications.** Filed and closed the same day.

> **The ruling** (shape **(a)** of the three below): D1 puts the mode on the **template version**
> because that is what makes it versioned, publishable and reviewable. A processless case has no
> version to carry one, so a per-case compliance setting would sit where nothing governs it.
> ADR 0137 gains **Amendment 4**, which states the scope this ADR had left implicit: D1–D3 deliver
> *a commission may REQUIRE the MRN on cases minted from a process template version* — **not** a
> platform-wide MRN mandate.
>
> ⛔ **CLOSED BY RULING, NOT BY A CODE CHANGE — and that distinction is the whole risk here.**
> Nothing below was fixed. Every measured fact in this item is still TRUE of `main`: `create_case`
> still takes `p_patient_enabled boolean`, still writes `patient_required_fields = '{}'`, and
> `required` is still unreachable on that door. A future reader who re-measures will re-derive this
> finding and be **right about the mechanism and wrong about whether it is a defect**. That is why
> the ruling lives in the ADR — the document they will already be reading — and not only in this
> archive, which nothing loads.
>
> ⛔ **Do not reopen it by widening `create_case`.** That is a new DEFINER arm owing its own authz
> re-verification, and it reverses a ruling rather than filling a gap.
>
> ⚠ **The erasure consequence is ACCEPTED, not overlooked.** A processless case may hold a name-only
> patient record that an MRN-keyed lookup cannot find. ADR 0137 § Open's cross-module erasure
> workflow must therefore treat name-only rows as a known, bounded population — never assume the key
> is universally present. This is the one place the ruling has downstream cost.

<details><summary>Original item, as filed 2026-08-24</summary>


### 🟡 FUP-0137-PROCESSLESS-CASES-CANNOT-REQUIRE-PHI — ADR 0137's compliance floor does not reach processless cases, and the boolean that made the others lossy is still live on that door (owner: PO decision, then backend + frontend)

**Filed 2026-08-24**, found while closing [[FUP-0137-PHI-MODE-SHIMS]] — its "grep must return zero"
property matched this code, which is how the gap surfaced. **Not caused by that work**, and
deliberately filed rather than folded into it.

**Measured from the live catalog, not read off the ADR:**

- `public.create_case(p_commission_id, p_label, **p_patient_enabled boolean**, …)` is the processless
  door. Its body computes `v_patient_mode := case when coalesce(p_patient_enabled,false) …` and
  inserts `patient_mode, patient_required_fields` as that mode and **`'{}'::text[]`**, always.
- So a processless case can only ever be `none` or `optional`. **`required` is unreachable on that
  path**, and the required-field set is empty by construction.
- The PHI writer's floor for such a case is therefore the legacy one:
  `app._set_participant_patient_unchecked` raises *"informe ao menos o nome ou o prontuário"* when
  BOTH are blank, and only calls `app.assert_patient_required_fields` — which no-ops outside
  `required` mode.
- Reachable in the product: `create-case-dialog.tsx` renders the `patientEnabled` checkbox on the
  `isProcessless` branch and posts it as a form field.

⛔ **Why this is an ADR-level gap and not a cosmetic one.** ADR 0137's Context calls a name-only
patient record *"a record the platform cannot later erase on request … a compliance hole dressed as
flexibility"*, and D1–D3 close it — **for cases minted from a template version**. A processless case
is minted by a different door that the ADR never mentions (grep: `0137` says "processless" zero
times), so the same hole is still open on it. The MRN is the erasure key or it is not; today it is,
except here.

⚠ **The mechanism is exactly the one the shims item described, still standing on this door**: a
boolean over a three-valued setting is lossy in only the NEW direction. Nothing fails, no gate fires,
and the compliance mode is simply unreachable.

**Not obviously a build item — the PO's call, and the shapes differ in cost:**

- **(a)** Rule that processless cases are out of scope for `required`, and say so IN ADR 0137
  (it currently reads as universal). Cheapest; leaves the hole named rather than open.
- **(b)** Widen the door: `create_case` takes a mode + required set like its template twin. ⚠ That is
  a **new DEFINER arm and its own authz re-verification** — the same cost D7 declined for the
  referral destination.
- **(c)** Enforce MRN-always on the processless path only, without a mode. Narrowest fix, but it
  invents a fourth floor across the three PHI modules, which ADR 0137's Consequences explicitly
  warns a future reader will try to "fix".

⚠ **Do NOT close this by pointing at `app.guard_case_patient_required`.** That guard is real and
correct, and it is an `AFTER INSERT` constraint trigger keyed on `new.patient_mode <> 'required'` —
so on a processless case it returns immediately. A guard that cannot be reached by the state in
question bounds nothing about it.

</details>


## ⬛ FUP-0137-MRN-BLANKABLE-AFTER-SEND — ✅ **RESOLVED 2026-08-24 by measurement: NOT REACHABLE. The prediction was correct about its two premises and wrong about the conclusion.**

> ⭐ **SETTLED THE WAY THE ITEM ITSELF ASKED — by fixture, not by reading.** The arm is
> `supabase/tests/365_referral_mrn_persistence_floor.sql` (12 tests, green). An amend that
> omits the MRN on a `sent` referral does **not** blank the key: the call raises **HC070**
> and rolls back.
>
> ⚠ **BOTH PREMISES BELOW ARE TRUE — the missing one was in a different object.**
> `set_referral_patient` really does refuse only `completed`/`rejected`/`withdrawn`, and its
> `on conflict do update set mrn = excluded.mrn` really is a full replace. What no reading of
> that definition can show is its **last statement** — `update public.case_referral set
> has_patient = true` — tripping **`app.guard_referral_status`**, a BEFORE UPDATE trigger
> that refuses any edit to a non-`draft` referral outside `app.in_referral_rpc`, a flag this
> door never sets. The PHI upsert is rolled back with it. Verified attached, enabled and
> unconditional (`tgqual is null`), not just present in `pg_proc`.
>
> ⛔ **THE CLOSURE IS INCIDENTAL, AND THAT IS THE PART TO CARRY FORWARD.** Nothing in
> `set_referral_patient` protects the MRN; a trigger placed there for status immutability
> does. Under neutralization — adding `set_config('app.in_referral_rpc','on')` to the door,
> which is the obvious way to implement "let the source coordinator amend PHI after sending"
> — **365 §1.2 reds with `have: NULL`**: the erasure key really is blanked, exactly as
> predicted. So this was never a false alarm; it was a live mechanism one edit away from
> reachable. **§2.2 is the keystone that reds on that edit.**
>
> ⭐ **A SECOND FINDING FELL OUT and is filed separately, not folded in here:** because the
> door cannot complete for ANY non-draft, the post-send amend branch ADR 0078 D7 gates with
> `can_amend_referral_phi_snapshot` is unreachable — pinned as the differential in §2.1 so
> no reader mistakes §1 for an MRN floor. See [[FUP-0137-POSTSEND-PHI-AMEND-IS-DEAD]].
>
> ⚠ The **draft** half of this family was real and IS fixed:
> [[FUP-0137-RESUME-SWALLOW-SILENT-PHI-OVERWRITE]].

🟠 **The erasure key can be blanked after the referral is sent.** Raised by `qa` in
[adr-0137-batch-review.md](../reviews/adr-0137-batch-review.md) § 5, 2026-08-23.

`public.set_referral_patient` refuses only `completed` / `rejected` / `withdrawn`. A **`sent`**
referral stays amendable by the source coordinator, and the body's `on conflict do update set
mrn = excluded.mrn` combined with `p_mrn` defaulting to NULL means an amend that omits the MRN
**blanks it**. ADR 0137 D4 makes the MRN the erasure key and puts a floor at *send* (`HC0T4`) —
that floor is real and correctly placed, but it **bounds entry, not persistence**.

⚠ The cases module already closed the identical shape with `app.guard_case_patient_mode_immutable`.
The referral analogue does not exist.

⛔ **Status of the evidence, stated honestly:** derived from the **live function definitions**, not
driven through a fixture — `test_helpers` does not exist outside the pgTAP harness, so `qa` could
not construct the state. **A pgTAP arm settles it in either direction** and should be written before
anyone treats this as either confirmed or dismissed. A guard read off its definition is exactly the
class this project has been wrong about before.

**Owner:** backend.

---


## ⬛ FUP-0137-FLUSH-FAILS-OPEN — ✅ **FIXED 2026-08-24** (owner: frontend)

> `if (fresh) { … }` → an explicit `if (!fresh) { setError(REFERRAL_MESSAGES.draftReloadFailed);
> return }`, so the flush no longer proceeds against the stale frozen map when the pre-flush
> re-read returns null. The docblock's *refuse rather than ship more than the screen shows*
> principle now holds in code and not only in prose.
>
> ⚠ Fixed in the same edit as [[FUP-0137-RESUME-SWALLOW-SILENT-PHI-OVERWRITE]] — same function,
> same swallow-becomes-a-silent-wrong-outcome family. ⛔ **Not separately test-pinned**: the
> null-re-read path needs `onLoadDraft` to resolve null *after* a successful first load, which
> the new spec's fixture does not construct. Stated rather than implied — the fix is a
> three-line early return whose correctness is legible, but it is unguarded against regression.

🟡 **A staleness re-read fails open, against the principle its own docblock claims.** Raised by `qa`,
2026-08-23.

`src/components/referrals/referral-send-wizard.tsx:692` guards the flush with `if (fresh) { … }` and
then **proceeds against the stale map when the re-read returns null** — the docblock ~70 lines above
states the fail-closed principle it believes it is preserving.

⚠ **Why it matters more now than when it was written:** the ADD step never records new shared-item
ids, so that re-read is the *only* thing preventing duplicate adds on a retry — and ADR 0137 D4 made
retries **common**, because `HC0T4` leaves the dialog open for the user to supply the MRN and try
again. A pre-existing fail-open became reachable when the batch changed the retry rate.

**Owner:** frontend.

---


## ⬛ FUP-0137-357-TWINS-ON-STALE-BODY — ✅ **RESOLVED 2026-08-24** (owner: backend)

> **Re-run against the re-emitted body. All four twins bite.** Fresh reset; `357` baseline
> 48 ok / 0 not ok. PHI write neutralized → **8 RED** · wrapper gate removed → **4 RED**, incl.
> BOTH K-CREATION-ONLY pins (4.1 `set_case_patient`, 4.2 `set_participant_patient` — one
> mutation reaches both, because the compat door delegates rather than re-gating) · helper ACL
> opened → **1 RED** · helper's own flag assert removed → **1 RED**.
>
> ⚠ **The 8 is NOT the recorded 11, and that is not a regression.** The 2026-08-22 run's exact
> edit was never written down, and `357` itself grew 43→48 assertions in between. The claim this
> measurement supports is *"the current body is covered"* — not *"the count matches"*. Writing
> the smaller number down rather than reconciling it to the remembered one is the point.
>
> ⭐ **The twins are now a committed harness**, `supabase/tests/mutation/p0137-phi-door-mutation-audit.sh`,
> because hand-running them a second time would leave the next reader exactly where this item
> found them. Three disciplines are built in: each mutation is injected INSIDE `357`'s own
> transaction (nothing persists, even on abort); the mutation helper RAISES when a `replace()`
> needle drifted, so a no-op mutation can never report GREEN; and each run DIFFS against a clean
> baseline instead of a hand-written expected-red list, which is the copy that drifts.

🟡 **The case-side gate's real coverage was red-proved against a body this batch replaced.** Raised by
`qa`, 2026-08-23.

`app._set_participant_patient_unchecked` is the enforcement point for ADR 0137 D3. It is
`prosecdef = f`, non-boolean, and lives in `app` — so it is **outside every authz arm's domain**.
⛔ `ARM=census` HOLDS is therefore *not* evidence about it; the census printed it as an orphaned
backlog entry, and that orphan **predates this batch**.

Its actual coverage is suite `357`'s mutation twins — whose recorded reds were taken on the
**pre-0137 body that this batch re-emitted**. The twins have not been re-run against the current
definition, so the compensating evidence for the batch's main case-side gate is stale by
construction.

**Fix:** re-run `357`'s mutation twins against the re-emitted body and record the reds. This is a
measurement, not a defect claim — it may well pass.

**Owner:** backend.

---


## ⬛ FUP-0137-BULK-WIZARD-STILL-BOOLEAN — ✅ **FIXED 2026-08-24** (owner: frontend)

> `BulkTemplateOption.collectsPatient` → `patientMode` + `patientRequiredFields`, and the
> `required` mode is now expressed in the grid rather than merely survived by it:
> the required identifier columns are **welded** into the selection (`aria-disabled`, ticked,
> *"Exigido pelo processo"* — the builder's `mrn` idiom, so a coordinator can reach the control
> and hear that it cannot be removed); `validateGrid` gained a `requiredPhiFields` arm that
> marks the offending **cell** and names the short **rows**; and `togglePhi` refuses a welded key
> in the handler as well as in the renderer.
>
> ⚠ **The `sex = 'unknown'` sentinel is mirrored** (`app.patient_required_missing`). A blank sex
> cell is coerced to `'unknown'`, so a naive is-the-cell-blank check would find every row
> satisfied and advance a batch the door then refuses row by row.
>
> ⭐ **The CORRECTION this item recorded is discharged too:** `HC0T1` really was absent from
> `bulk-error-map.ts`, so the bulk path returned the GENERIC string where the single-case path
> named the fields. Mapped, and red-proven by removing it again. Six new model tests, each
> pairing the `required` case with the `[]` case, so the regression half — every batch from an
> `optional` template — is covered rather than assumed.

🟡 **The bulk case wizard still reads the deprecated `collectsPatient`, so `required` mode degrades to a
worse error.** Raised by `frontend` while building ADR 0137 D2/D3, 2026-08-23.

`src/components/cases/bulk-create-types.ts` and `bulk-step-process.tsx` were not migrated to
`patientMode` / `patientRequiredFields`. Against a `required` template the bulk grid therefore offers
the PHI columns **unmarked** — no required indicator, no submit gate, no named missing field.

⛔ **Not a compliance hole** — `app.patient_required_missing` still refuses the creation server-side, so
nothing is written without its required PHI.

⚠ **CORRECTION 2026-08-24 (QA r2): this item originally SOFTENED itself.** It claimed the refusal reaches
the user "with the pt-BR message naming the fields". Measured: **`HC0T1` is absent from the mapped codes
in `src/lib/cases/bulk-error-map.ts`**, so on the bulk path the user gets the **GENERIC** string — no
named fields. The single-case path maps it; the bulk path does not. A follow-up that overstates the
consolation is worse than none, because it is read as the reason not to prioritise the work. The defect is **user-facing quality** — the user is allowed to fill a whole grid before
being told, instead of being told up front, which is precisely what D3 layer 3 exists to prevent on the
single-case path.

⚠ Deliberately out of scope: the QA remediation named two files and this is a third surface. Sequence it
rather than letting it drift — the single-case and bulk paths now disagree about the same template.

**Owner:** frontend.

---


## ⬛ FUP-0137-CASE-PATIENT-EDIT-NOT-MARKED — ✅ **FIXED 2026-08-24** (owner: frontend)

> `requiredFields` threaded `case-detail-view` → `CasePatientPanel` → `CasePatientEditDialog`
> → `PatientFields`, plus the create dialog's submit gate and its `Faltam preencher:` line,
> reused word for word so the two surfaces cannot drift into two vocabularies for one rule.
>
> ⚠ **Sourced from the CASE's own snapshot** (`c.patientRequiredFields`), never the template's
> live set: `patient_mode` is frozen at creation (`HC0T3`), so a later template edit must not
> retroactively change what an open case demands.
>
> ⚠ **The gate is suppressed while the audited reveal is still `loading`.** The draft is empty
> until that read lands, so gating on it then would tell a coordinator their COMPLETE record is
> missing every field — the fixture-cannot-reach-the-state shape, pointed the other way.

🟡 **`case-patient-edit-dialog.tsx` does not mark required fields.** Raised by `frontend`, 2026-08-23.

The case's `patientRequiredFields` is not threaded page → panel → dialog, so editing a `required`
case's patient block shows no required markers and no submit gate.

⛔ Enforcement is intact — `app._set_participant_patient_unchecked` (ADR 0137 D3's enforcement point,
`prosecdef = f`, inherited by both write doors) still refuses. As above, this is the **offer** layer
disagreeing with the **enforcement** layer, not an authorization gap.

⚠ Same class as [[FUP-0137-BULK-WIZARD-STILL-BOOLEAN]]: a value that was unreachable until 2026-08-23
leaves every downstream surface **unexercised by construction**. The audit set is every reader of
`patient_mode` down to and including the rendering layer — ask *"what does this DO when it meets
`required`?"*, never *"is this still right?"*.

**Owner:** frontend.

---


## ⬛ FUP-0137-PERSIST-REFRESH-DROPS-FOCUS — ✅ **FIXED 2026-08-24** (owner: frontend)

> ⛔⛔ **THIS ITEM NAMED THE WRONG MECHANISM, and the correction is the valuable part.**
> Measured in Chromium on a page isolating the three candidates:
>
> | what happens | `document.activeElement` after |
> |---|---|
> | an ancestor `<fieldset>` becomes `disabled` while a descendant holds focus | **`BODY`** |
> | siblings churn around the focused node (what reconciliation does) | unchanged |
> | the focused node is REPLACED | `BODY` |
>
> So it is the `disabled={isPending}` the transition toggles — which fires the instant
> `startTransition` runs, **before** any refresh — and `router.refresh()` is innocent.
>
> ⚠ **That changes the sweep, which is why the item asked for one.** Its own predicate
> (*"does this component refresh the route on an input event?"*) matches **146 files** and still
> MISSES a component that disables without refreshing. The property that actually predicts the
> defect is: *a control whose own change starts a transition that then disables it (directly or
> through an ancestor `<fieldset>`), on a surface that stays mounted.* Swept, that is exactly
> **three** components — `collects-patient-picker.tsx`, `commission-oversight-toggle.tsx`,
> `submissions-filters.tsx` — all three now using the shared `usePendingFocus`
> (`src/components/ui/use-pending-focus.ts`). A dialog whose SUBMIT starts the transition is
> not in the class: it unmounts, and Radix restores focus to the trigger.
>
> **Verified end-to-end in the real app, with a positive control.** Neutralized, focus sits on
> `<body>` at every sample after the persist and never returns; with the hook it returns.
> Pinned by `use-pending-focus.test.tsx` (4 tests — one of which PINS that jsdom does NOT
> reproduce the browser's blur, so nobody reads a green unit run as browser coverage) and by
> E2E `patient-mode-required.spec.ts` **AC-R5**, red-proven with the message *"focus was dropped
> to `<body>` by the persist"*.
>
> ⚠ AC-R5 must stay ordered BEFORE AC-R2, which publishes the version: the picker mounts for
> DRAFT versions only, and placed after the publish the test fails on the fixture instead of on
> the property.

🟡 **`persist()` + `router.refresh()` resets keyboard focus to `<body>`, costing a keyboard user ~40 Tab
presses per field.** Found by `tester` while writing `e2e/patient-mode-required.spec.ts`, 2026-08-23.

`src/components/process-templates/collects-patient-picker.tsx`'s `persist()` calls `router.refresh()` on
every mode/field change. Once that lands, `document.activeElement` is `<body>`: a keyboard or
screen-reader user who ticks one required field **loses their position** and must Tab from the top of
the page to reach the next one.

⛔ **Verified in a real browser via genuine Tab-key navigation, not inferred and not a Playwright
artifact.**

⚠ **It does NOT violate ADR 0137 D2** — the welded `Prontuário` checkbox does keep its place in the tab
order (confirmed by a full Tab walk), which is why `tester` correctly declined to file it as a bug
against this batch. The defect is the refresh's effect on *everything after* it.

⭐ **The reason this is filed rather than dropped: the shape is not specific to this picker.** Any
component that persists on change and then calls `router.refresh()` has it. Scope the fix by the
PROPERTY — *does this component refresh the route on an input event?* — not by grepping this one file.
CLAUDE.md §8 requires keyboard navigation and visible focus on every input.

**Owner:** frontend.

---


## ⬛ FUP-0137-RESUME-SWALLOW-SILENT-PHI-OVERWRITE — ✅ **FIXED 2026-08-24** (owner: frontend)

> **The fix, in three layers** — `referral-send-wizard.tsx`:
> 1. `resumePatientLoaded: boolean` → `resumePatientState: "idle" | "loading" | "loaded" |
>    "error"`, set **after** the await; the `catch` records `error` instead of swallowing,
>    so a transient failure no longer latches for the session and re-entry retries.
> 2. `flush` **refuses** to write PHI while the state is `error` — the write-level guard,
>    because the buffer is a full row and not a patch.
> 3. The PHI inputs are **disabled** and the step carries a pt-BR banner
>    (`patientFieldsLocked`), so the coordinator learns it before typing rather than at save.
>
> Pinned by `src/components/referrals/referral-send-wizard-phi-failclosed.test.tsx` (4 tests).
>
> ⛔ **THE FIRST VERSION OF THAT TEST WAS VACUOUS AND THE REASON IS THE USEFUL PART.** It
> asserted `setReferralPatient` was not called after a failed read — and **passed with the
> guard removed**, because it never populated the buffer, so the flush's pre-existing
> `referralPatientDraftHasData` short-circuit was doing the work. ⭐ What makes the overwrite
> reachable is **not typing** (the inputs are disabled) but **`applyPrefill`**: the
> safety-event prefill is a *separate* load with its own state and a button gated only on
> `isPending`, so it fills the buffer with the EVENT's identifiers while the draft's own PHI
> failed to load. Under the neutralization the test now reds carrying
> **`"mrn": "MRN-EVENT-9"`** — the overwrite in the assertion output.
>
> ⚠ **A second record error, kept:** the neutralization list first claimed a "re-latch"
> mutation reds three tests. Measured, (a) the re-latch is **two** edits and applying one
> alone left the file entirely GREEN — a cosmetic mutation certifying coverage that did not
> exist; (b) it reds **§1 + §2 only**, never §4, whose success path never enters the `catch`.
> Both errors ran in the flattering direction.
>
> ⚠ The post-send half of this family turned out **not reachable** —
> [[FUP-0137-MRN-BLANKABLE-AFTER-SEND]], closed by fixture the same day.

🟠 **A swallowed PHI load turns into a silent PHI overwrite.** Raised as R-3 in
[adr-0137-batch-review.md](../reviews/adr-0137-batch-review.md) § 5, 2026-08-23. ⛔ **Filed 2026-08-24
only because QA r2 noticed it had never been filed anywhere** — it existed solely in a superseded review
file, which is the same as deleted.

`goToPatientStep` sets `resumePatientLoaded = true` **before** the await and swallows any failure
(`:502-515`, `catch {}`), so **one transient failure means the saved PHI never loads again for the rest
of the session.** If the coordinator then types anything, `flush` calls `setReferralPatient`, whose
`ON CONFLICT DO UPDATE` **replaces every column** — blanking the stored `mrn`, `name`, `date_of_birth`.

⭐ This is the **same full-replace shape the team correctly caught for departments in D9-bis**, here on a
PHI field. And it is the same swallow-converts-a-broken-path-into-a-silent-outcome shape the plan already
warns about in its own note.

**Bounded:** confined to a draft, and D4's send gate catches the MRN case specifically. It does **not**
catch `name` or `date_of_birth`.

⚠ Related and worth fixing together: [[FUP-0137-MRN-BLANKABLE-AFTER-SEND]] is the post-send half of the
same "full-replace upsert on PHI" family.

**Owner:** frontend.

---


## ⬛ FUP-0137-KIND-VISUAL-NO-FALLBACK — ✅ **FIXED 2026-08-24** (owner: frontend)

> `kindVisual(kind: string)` resolves the row's visual with an `UNKNOWN_KIND_VISUAL` fallback,
> and the comment now claims what it delivers: exhaustive over the TYPE UNION, which is not a
> guarantee about `case_events_kind_check`.
>
> ⚠ **The parameter is `string` deliberately.** Narrowed back to `AnyCaseEventKind` the lookup is
> typed non-nullable, TypeScript prunes the fallback as unreachable, and a reviewer reads dead
> code — while at runtime the value that arrives is whatever the CHECK admitted, asserted into
> the union by a `.returns<>()` that verifies nothing.
>
> ⭐ **The SIBLING was swept in the same edit.** `EVENT_KIND_LABEL[ev.kind]` on the same row also
> misses an unknown kind; it yields `undefined`, which React renders as an EMPTY chip — quieter
> than the throw, and therefore likelier to ship. Fixing one lookup on a row and leaving the
> other reads as having swept the class. Three tests, all RED on the pre-fix build (the render
> THREW, so every assertion in the block died at once — which is the failure mode: a blank card,
> not a missing icon).

🟡 **`KIND_VISUAL[ev.kind]` has no runtime fallback, and its comment over-claims the guarantee.** R-6,
same review; filed 2026-08-24 for the same reason.

`case-events-timeline.tsx:59-60` claims exhaustiveness "by TYPE" means widening `case_events_kind_check`
"cannot land without a visual". ⛔ **Widening the SQL CHECK touches no TypeScript**: `tsc` stays green,
`.returns<CaseEventRow[]>()` asserts the row into the **stale** union, and `:386`'s destructure of
`KIND_VISUAL[ev.kind]` **throws — taking the whole card down.**

**Latent today** (DB CHECK and TS union agree, 16 = 16, verified). It becomes live the moment someone adds
a kind in SQL — which is exactly the [[keystone-measured-what-i-built-not-what-breaks]] shape: a new enum
value leaves every downstream reader unexercised by construction.

**Fix:** a `?? { Icon: MoreHorizontal, tint: … }` fallback, and reword the comment so it claims what it
actually delivers. ⚠ A comment is an assertion; this one asserts a cross-language guarantee no gate enforces.

**Owner:** frontend.

---


## ⬛ FUP-0137-ALERT-INSIDE-LABEL-MUTATES-NAME — ✅ **FIXED 2026-08-24** (owner: frontend)

> Adopted the house pattern — `Field` + `FieldLabel` + `FieldError` + `useFieldIds` — so the
> message is linked through `aria-describedby` instead of living inside the `<label>`.
> `nameRequiredFor: "formData"` is DECLARED, because `createCaseEvent` reads
> `formData.get('body')` and `useFieldIds` emits no `name` unless a caller says why it needs one.
>
> ⭐ **The test asserts INVARIANCE across the error transition, not the presence of a string.**
> The same `getByRole("textbox", { name: "Descrição do registro" })` runs either side of a failed
> submit; the clean-state half passes on the DEFECTIVE build too, so only the pairing reds — and
> it is paired with a presence assertion on the message, because a "fix" that simply deleted the
> alert would keep the name invariant and inherit the green.

🟡 **A `role="alert"` inside the wrapping `<label>` mutates the textarea's accessible name on validation
failure.** R-7, same review; filed 2026-08-24 for the same reason.

`case-events-timeline.tsx:312-329`: the body-error `<span role="alert">` is a **child of the wrapping
`<label>`**, so on failure the accessible name changes from `Descrição do registro` to that **plus the
error text**. `aria-invalid` is set, but nothing is linked via `aria-describedby`.

⭐ **The house pattern already exists and is used one file over** — `useFieldIds` + `FieldError`
(`src/components/ui/field.tsx:201-207`), as in `case-type-picker.tsx:65`. This is adoption, not design.

⚠ Same family as [[a-component-may-own-a-message-only-for-outcomes-it-survives]] and the "count badge
inside the `h2`" defect: **data reaching a name that should be invariant.** Pin it by rendering at two
states and asserting the name is unchanged, not by asserting one string.

**Owner:** frontend.

---


## ⬛ FUP-0137-POSTSEND-PHI-AMEND-IS-DEAD — ✅ **RESOLVED 2026-08-24, PO ruling** (owner: backend/PO)

> **Ruled shape (a): post-send PHI amendment is NOT a product capability** — and the door now
> says so instead of stumbling into it. Migration `20261003001700` moves the refusal INTO
> `public.set_referral_patient`: any non-`draft` status is refused BEFORE the upsert, with the
> door's own `HC078` and a message about patient data (*"encaminhamento já enviado; …"* /
> *"encaminhamento concluído; …"*). Behaviour is unchanged — every such call already failed —
> but it failed LATER, by rollback, wearing the status trigger's `HC070` (*"mudanças de estado
> do encaminhamento devem passar pelas RPCs"*), a sentence about lifecycle transitions surfaced
> for a PHI edit.
>
> ⭐ **The two locks now fail INDEPENDENTLY, and that is measured rather than argued.** Removing
> the door's arm alone reds `365` §1.1/§1.3/§2.1 — but §1.2 stays GREEN, because the trigger
> still rolls the upsert back. Removing the arm AND setting `in_referral_rpc` reds §1.2 too.
> So the blanking that was ONE edit away now takes TWO. Harness: mutations 5/6 of
> `supabase/tests/mutation/p0137-phi-door-mutation-audit.sh`.
>
> `app.can_amend_referral_phi_snapshot`'s `COMMENT` now records its real scope — draft re-saves
> only — so it can no longer be cited as evidence that a sent referral's PHI can be corrected.
>
> ⚠ **`365`'s header and §2.2/§2.4 were rewritten, not merely re-coded.** Its central claim
> (*"the closure is incidental"*) was the premise this change retired; leaving that prose
> standing would be the stale-tighter-rule shape — the old text reads as MORE careful, so nobody
> questions it. The old mechanism is kept in the header as the lesson, marked as history.
>
> ⛔ **If post-send amendment is ever wanted, deleting the arm is NOT sufficient**: the
> full-replace upsert is untouched, so an amend that omits the MRN blanks the erasure key. Build
> the MRN persistence floor in the same change.

🟡 **An authored write capability that cannot be exercised — `can_amend_referral_phi_snapshot`'s
non-draft branch is structurally unreachable.** Found 2026-08-24 while settling
[[FUP-0137-MRN-BLANKABLE-AFTER-SEND]] by fixture; **not** a hole, and filed so the dead branch is
not later read as live protection.

`public.set_referral_patient` branches on whether a `referral_patient` row already exists: a new
snapshot needs `can_manage_referral_phi_disclosure`, an **amend** needs
`can_amend_referral_phi_snapshot` (ADR 0078 D7). Measured: for any referral whose status is not
`draft`, the door's own final statement — `update public.case_referral set has_patient = true` —
is refused by `app.guard_referral_status` with **HC070**, so the call can never complete. The amend
predicate therefore only ever governs **draft** re-saves, which is the one case it was not written
for. Pinned as the differential in `365` §2.1.

⚠ **Three independent reasons it is not a live defect**, which is why this is 🟡 and not orange:
the door cannot complete; the only UI caller of `setReferralPatient` is the send wizard, which
ADR 0137 **D6** confines to drafts; and the referral detail page (which serves non-drafts) offers
no PHI-edit affordance at all.

⛔ **The decision owed is which way to resolve it, and it is a PO question, not a patch.** Either
(a) post-send PHI amendment is intended — then the door needs the RPC flag **and** the MRN
persistence floor the sibling follow-up proposed, because `365` proves the flag alone opens the
blanking (§1.2 reds with `have: NULL`); or (b) it is not intended — then the amend predicate and
the `completed`/`rejected`/`withdrawn` arm are dead code, and HC070's *"encaminhamentos enviados
são imutáveis fora das RPCs"* is a confusing thing to surface for a PHI edit.

⭐ **Do not resolve it by adding the flag alone.** That is the cheap-looking half, and it is the
exact edit `365` §2.2 exists to red.

**Owner:** PO + backend.

### Resolved 2026-08-24 — the ADR 0136 follow-up round (index lines rotated verbatim from PROGRESS.md)

- 🟡 **FUP-DSS-STANDALONE-ROUTE-DISABLES-SUBMIT** — the standalone `/forms/…/responder` route is not prevented from serving a CASE-PHASE response and passes `deferStaffSignoff=false`, so the same response has a dead submit button on one route and a live one on the other. ✅ Strictly MORE restrictive — not a security defect — but a divergence ADR 0136 created — frontend
- 🟡 **FUP-DSS-PENDING-SIGNOFFS-WALKTHROUGH-KEYSTONE** — `app.pending_staff_signoffs` came back **UNSUPPORTED** from the row-door harness (no identity guard) and owes the per-principal walk-through keystone its class owes. ⚠ Behaviour IS drilled; that is a different question — backend
- 🟡 **FUP-DSS-SIGN-SECTION-INVOKER-VERDICT-STALE** — `sign_section`'s invoker verdict is **PROVISIONAL** *and* was measured against the body ADR 0136 changed. ⛔ `FROMFINDINGS=1 ARM=wrapper` re-measures nothing, so a changed body is invisible to it by construction — backend
- 🟡 **FUP-DOOR-AUDIT-PREDICATE-ARM-BOUNDED-BY-A-NAME** — the door sweep's predicate arm is bounded by a NAME REGEX standing in for a property (42 `prosecdef` booleans outside it, measured). ADR 0136 hit it live: the sweep matched **zero gates** until the function was renamed. ⛔ The rename is a workaround that makes coverage depend on a convention no gate enforces — backend
- 🟡 **FUP-DSS-KEYBOARD-FLOW-IS-THIN** — the ADR 0136 spec's keyboard test asserts an a11y floor, not a keyboard-only flow; it never signs. ⚠ A thin test where the requirement points reads as the requirement being met — tester

### Resolved 2026-08-24 — the finding the ADR 0136 round's own sweep produced (index line rotated verbatim from PROGRESS.md)

- 🟠 **FUP-RCA-WRITER-CAN-WRITE-IS-BLIND** — opening `public.rca_writer_can_write` reddens **NOTHING** across 218 files. ⭐ The first finding produced by ADR 0079 **Amdt 9**'s widening of the door sweep's predicate arm — the gate had never been swept in either direction, being outside the arm's NAME-bounded domain. ⛔ BLIND blocks a phase (§6 step 1) and owes a keystone; not an unreachable backstop, so the allowlist is not available — backend

> ✅ **Closed the same day.** Keystone `142_rca.sql` §K (4 assertions, the wrapper called AS each
> principal); re-swept single-case **COVERED**, baseline `Files=218, Tests=7232, PASS`,
> `ARM-DOMAIN predicate=1/110`, exit 0 unpiped, the neutralized run failing ONE file —
> `142_rca.sql` tests 10–11, by name. Its `authz-neverclled-door-allowlist.txt` line was deleted
> in the same commit, so `ARM=floor` re-proves the call (`calls=4`, was 0). ⚠ Two things the
> body in [follow-ups.md](./follow-ups.md) carries and this line cannot: the door is a **UI
> capability probe** (no policy, no routine calls it — opening it granted no write), and this
> follow-up's own prescribed shape — *"a row count through the door, never a predicate call"* —
> **could not apply**, because the door returns a boolean and has no rows behind it.

### Rotation notes rotated from PROGRESS.md 2026-08-24

> Moved verbatim from PROGRESS.md § Follow-ups (byte-identical apart from link
> repointing: root-relative `docs/...` -> this directory's `../...`). Each records a
> rotation that had already concluded; PROGRESS.md keeps one pointer line.

_**Three items RESOLVED by the DSR remediation round, index lines rotated 2026-08-21** → [follow-ups-archive.md](follow-ups-archive.md): **FUP-DISPOSE-EVENT-DOOR-GATE-BLIND** (keystone `352` run **inside the full suite** on a fresh reset and re-neutralized there — the item closed on the RUN, never on the file existing) · **FUP-DISPOSAL-RUNBOOK-COVERS-ONLY-BYTES** (the four column doors have their first operational procedure, and the bytes runbook now names its own substrate) · **FUP-RESIDUE-NOTICE-RESTS-ON-TRAINING** (PO ruled the copy stays; the training premise it rests on is recorded at the pilot-decision surface, which was the item's actual requirement). Bodies stay in [follow-ups.md](follow-ups.md)._


_Resolved, rotated out of both live files → [follow-ups-archive.md](follow-ups-archive.md):
**FUP-DM1-CEILING · FUP-DM1-E2E · FUP-DM1-DISPOSE** (discharged by DM2 S1/S4/S2) · **FUP-F2-BUCKETS**
(`meeting-attachments` retired in `20260921000300`, pinned by pgTAP `325`) · **FUP-PDF-3** (both doors
now `RETURNS public.printed_document_public`; ADR 0111, pgTAP `323`)._


_14 more index lines (the 2026-08-18 resolved set, `FUP-DM5-*` and peers) rotated 2026-08-18 → [follow-ups-archive.md](follow-ups-archive.md) § "Index lines rotated from PROGRESS.md 2026-08-18"; their bodies remain in [follow-ups.md](follow-ups.md) pending body rotation._


_**FUP-DM5-NO-ANSWER-VS-NOTHING** (🔴, the class) rotated 2026-08-19 → [follow-ups-archive.md](follow-ups-archive.md) § "Index line rotated from PROGRESS.md 2026-08-19" — all six instances closed; last one (`--allow-orphans`) fixed by ADR [0128](../decisions/0128-unproven-is-not-clean-capture-outcome-classes.md). Body stays in [follow-ups.md](follow-ups.md); ⭐ the one-sentence class statement is deliberately KEPT there as a review lens, not archived away._


_**FUP-DM5-BACKUP-IS-PHI-EXPORT** (🔴) rotated 2026-08-19 → the same archive section — ✅ **RESOLVED by execution**, not by decision: both remaining deliverables (destination path, first run) discharged against the local stack; record [phi-backup-run-log.md](../deployment/phi-backup-run-log.md). Body stays in [follow-ups.md](follow-ups.md). ⛔ **Its two residues are the NEW 🔴/🟠 lines above — the close is bounded, not total.**_

### Bodies rotated from follow-ups.md 2026-08-24 (resolved; their index lines left PROGRESS.md earlier)

> Moved VERBATIM. All resolved on 2026-08-13/19/21 with their PROGRESS.md index lines
> rotated then, but kept reachable only by the rotation NOTES — which themselves rotated
> on 2026-08-24. `lint:progress` caught the orphaning the moment those notes left, which
> is the check working: a body no live register indexes is invisible work. Link paths are
> unchanged — both files sit in `docs/progress/`, so every relative link resolves here.

### â¬› Resolved â€” rotated 2026-08-13 (the DM2 Record step): **FUP-DM1-CEILING** (D15 ceiling, DM2Â·S1 + S4) Â· **FUP-DM1-E2E** (6+1 specs rewritten, DM2Â·S4) Â· **FUP-DM1-DISPOSE** (`dispose_case_phi` arm restored, DM2Â·S2) â€” each verified independently, not accepted from a report â†’ [follow-ups-archive.md](./follow-ups-archive.md)

### ðŸŸ¡ FUP-RESIDUE-NOTICE-RESTS-ON-TRAINING â€” `DSR_RESIDUE_NOTICE` line 1 is now CONDITIONALLY true, and the condition is a control the software cannot enforce (owner: PO copy call, then frontend; created by ADR 0131, 2026-08-20)

Filed 2026-08-20 (lead). Not a defect â€” a **premise that became explicit** when ADR
[0131](../decisions/0131-phi-erasure-reach-bounded-to-designated-fields.md) bounded PHI
erasure to designated PHI fields.

**The sentence** ([messages.ts:97](../../src/lib/dsr/messages.ts:97)), shown to an operator
discharging an LGPD obligation and reproduced in the outcome record handed to the data
subject: *"O descarte apaga os dados do paciente armazenados no banco para este registro e
preserva o histÃ³rico de governanÃ§aâ€¦"*

**Before 0131** its truth was structural: the door was to be widened until it cleared every
PHI-capable column on the lane. **After 0131** it holds **iff PHI was entered only into PHI
fields** â€” a *training* control. The software cannot detect a patient name typed into a
title, so nothing in the platform can make the sentence false-proof.

â›” **This does NOT make the notice an over-claim today**, and it must not be filed as one:
under the ruling's own premise the sentence is true. What changed is *what the sentence
rests on*. Compare `FUP-DISPOSE-DIALOG-OVERCLAIM`, which was a genuinely false claim about
the door's reach; this is a true claim with a newly named dependency.

**The PO's call, two shapes:**
(a) **scope the sentence** to the designated fields (*"â€¦apaga os dados do paciente
registrados nos campos de identificaÃ§Ã£o do pacienteâ€¦"*) â€” narrower, and true independent of
operator behaviour; or
(b) **accept it as written** on the training premise, and record that premise.
âš  Either way, **ADR 0131's risk acceptance must also be recorded where the pilot decision is
made**, not only in the ADR â€” the identical requirement Critical FUP C3 carries, and the
reason C3 says it: an acceptance that lives only in the document that created it is invisible
at the moment it matters.

âš  Whoever edits this constant: it is shared by **four** consumers (two dispose dialogs, the
task-inbox disclosure, and `queries/dsr.ts` feeding the outcome record) and its per-lane
companion `DSR_MEETING_DISPOSAL_WARNING` must stay a **separate** constant. Enumerate from
the symbol's references, never from a roster.

### ðŸŸ  FUP-DISPOSE-EVENT-DOOR-GATE-BLIND â€” `dispose_event_phi`'s authorization gate is exercised by NO keystone: opening it leaves the full suite green (owner: backend; found by the ADR 0129 diff-scoped sweep)

**Measured 2026-08-19, by neutralization, on a fresh reset.** Rewriting the door's authz raise to
`perform 1;` â€” so **any** caller passes the gate â€” and running the full pgTAP suite:

| Door | Gate | Suite notices? |
|---|---|---|
| `dispose_case_phi` | `is_staff_admin_of(commission)` | âœ… **YES** â€” `151_case_patient` (6 tests) + `314_qob_org_admin_content_wall` (1) |
| `dispose_referral_phi` | `is_tenancy_admin_of` âˆ¨ `is_pqs_operator_of` (source âˆ¨ target) | âœ… **YES** â€” `189_nsp_per_hospital_isolation` |
| `dispose_meeting_minutes` | `is_staff_admin_of` âˆ¨ `is_tenancy_admin_of` | â›” **WAS BLIND** â€” âœ… now keystoned by `348` t7 (ADR 0129 build) |
| **`dispose_event_phi`** | `is_tenancy_admin_of(commission_of_event)` âˆ¨ `is_pqs_operator_of(hospital_of_event)` | â›” **BLIND** â€” gate opened **alone**, suite **PASS**, 6550/6550 |

âš  **BLIND â‰  vulnerable, and the distinction is the whole point.** The gate is present and correct
today; nothing is reachable that should not be. What is missing is the *keystone* â€” if a refactor
dropped or weakened this gate, **nothing in 6550 tests would go red**, and a PHI-erasure door on the
patient-safety module would be silently open. That is door-blindness in the ADR 0079 sense.

**Why the standing gates did not catch it.** `ARM=census` asks whether a gate carries a *verdict*,
not whether a keystone exercises it; `ARM=floor` asks only whether the door is **called** â€” and it
is (its happy path is tested), which is exactly the [[a-predicate-quoted-at-the-wrong-grain]] shape:
"the door is exercised" is true and does not bound "the door's *gate* is exercised". ADR 0079
Amendment 1's diff-scoped recipe filters the diff to `^(is_|can_|has_)` function names + RLS
policies; this gate is a plain `if not (...)` **inside** a door and matches no filter. â­ **The
enumeration boundary is a syntax; the property is "an authorization decision no test can see change"**
â€” [[enumeration-boundary-is-a-syntax-not-a-property]].

**The fix** is one `throws_ok(..., '42501')` per door with a persona who holds the module's ordinary
membership but neither gate arm â€” the shape `348` t7 uses (a plain commission member), with a CONTROL
pinning that the persona really lacks the hat, so the refusal is attributable to the role and not to
tenancy. â›” **Do not "fix" this by widening the gate to make a test pass.**

**Not fixed here, deliberately.** Found *during* the ADR 0129 build, whose migration is bound to amend
nothing else (0129 Decision 1) and whose subject is the child lock. Filed rather than carried, so it is
not lost inside a build that does not own it â€” the same reason this door's sibling item was filed in the
first place.

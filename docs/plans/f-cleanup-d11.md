# F-cleanup D11 — anglicize Portuguese status-enum internal keys (FULL, 12 enums)

> **Decision:** PO chose **full 12-enum anglicization** (2026-07-12), as a staged cross-team track.
> **Branch:** `f-cleanup`. **Serialized AFTER D3/D10** (both regen `src/lib/types/database.ts` and reset the
> same local DB — never run two backend migration streams concurrently). **Posture:** reset-OK / pre-launch.
> **Not a Rule-10 breach:** these are INTERNAL stored keys, not user-facing labels. The pt-BR string *values*
> in label/visual dictionaries stay; only their **map keys** (which mirror the DB key) change.
> **Source map:** the exhaustive per-enum file:line site list is produced by `backend` (folded in below at
> "SITE MAP" once the D3/D10 agent reports it).

## Execution rules (the failure mode is a missed literal)

- **No blind global find-replace.** `concluida`/`concluido`/`cancelada`/`cancelado`/`pendente`/`agendada`
  are shared across enums. Move **one enum's sites as a unit**, disambiguated by column/context.
- **One coupled group per migration**, cheapest-first (order below). Each group runs the full mini-loop:
  **backend (SQL + seed + `src/lib/**`) → frontend (`src/components/**`, `src/app/**`) → tester (`e2e/**`) →
  per-group gate** (targeted specs). The **full E2E suite runs once at the very end** to declare green (§6).
- **File ownership for D11 (lead call):** status keys are a *data* concern, so **backend owns every
  `src/lib/**` change** — not just `{supabase,queries,types}` but the hand-written unions and the
  label/visual **key** dictionaries (`interview-labels.ts`, `capa-types.ts`, `capa-visuals.ts`, …).
  **frontend** owns only `src/components/**` + `src/app/**` literal usages. **tester** owns `e2e/**`.
  No two teammates touch one file in a group.
- **Spelling:** align with English keys already in the schema. `responses.status` already uses
  **`in_progress`** and **`submitted`** — reuse `in_progress` verbatim. Confirm `cancelled` (double-l) vs
  `canceled` and `draft`/`archived` against any existing English enum before the first mass edit; whatever
  is chosen is applied uniformly. Backend locks the final spelling in this doc before G1.
- **Per-enum pgTAP (the lock):** NEG (the old pt-BR key is now rejected by the CHECK) · POS (the new key is
  accepted) · POS (every transition RPC / recompute still moves the state). Plus regen types + `npm run build`
  each group. Memory `pgtap-fixture-flag-gaps`: full ordered `supabase test db` after a fresh reset, never a
  subset.

## Locked translation dictionary — ✅ CONFIRMED (backend, 2026-07-12)

> **Spelling locked** against existing schema keys: `cancelled` (double-l — 29 uses in-tree, 0 `canceled`),
> `draft`, `archived`, `active`, `in_progress` (reused verbatim from `responses.status`), `completed`,
> `in_review`, `open`, `submitted` are all already present in English CHECKs. The dictionary below is binding.

| # | Enum (table.column) | old → new |
|---|---|---|
| 1 | `indicators.status` | ativo→**active**, arquivado→**archived** |
| 2 | `meeting_attendees.attendance` | convocado→**summoned**, presente→**present**, ausente→**absent**, justificado→**excused** |
| 3 | `case_narratives.status` | aberta→**open**, concluida→**completed** |
| 4 | `indicator_measurements.status` | na_meta→**on_target**, fora_da_meta→**off_target**, sem_dados→**no_data** *(these keys ALSO surface as RPC output field names → regen `database.ts` + fix `queries/indicators.ts` mapping + any reader)* |
| 5 | `capa_action.status` | pendente→**pending**, em_andamento→**in_progress**, concluida→**completed**, cancelada→**cancelled** |
| 6 | `case_interviews.status` | rascunho→**draft**, agendada→**scheduled**, em_andamento→**in_progress**, concluida→**completed**, cancelada→**cancelled** |
| 7 | `capa_plan.status` | aberto→**open**, em_execucao→**in_execution**, em_verificacao→**in_verification**, concluido→**completed**, cancelado→**cancelled** |
| 8 | `controlled_documents.status` + `controlled_document_versions.status` | rascunho→**draft**, em_aprovacao→**in_approval**, vigente→**effective**, obsoleto→**obsolete** |
| 9 | `case_referral.status` | rascunho→**draft**, enviada→**sent**, recebida→**received**, aceita→**accepted**, recusada→**rejected**, em_analise→**in_review**, concluida→**completed**, retirada→**withdrawn** |
| 10 | `meetings.status` | agendada→**scheduled**, realizada→**held**, em_assinatura→**in_signature**, assinada→**signed**, distribuida→**distributed**, cancelada→**cancelled** |
| 11 | `cases.status` | nao_iniciado→**not_started**, pendente→**pending**, em_revisao→**in_review**, concluido→**completed**, cancelado→**cancelled** |
| 12 | `case_phases.status` | pendente→**pending**, ativa→**active**, concluida→**completed**, nao_necessaria→**not_required** |

Consistency is intentional: fem/masc pairs collapse to one English key (`concluida`/`concluido`→`completed`,
`cancelada`/`cancelado`→`cancelled`); `in_progress` reuses the existing response-lifecycle key. Same English
key in *different* enums (e.g. `in_review` in #9 and #11) is fine — different columns, no collision.

## Coupled-group execution order (migrations `20260719000300…`, after D3=`…0000` / D10=`…0200`)

| Group | Enums | Migration | Risk | Cross-team surface |
|---|---|---|---|---|
| **G1** ✅ DONE | #1 indicators.status, #2 meeting_attendees.attendance | `20260719000300_status_keys_indicators_attendance.sql` (+ test `212`) | low | backend-heavy; tiny frontend/e2e |
| **G2** ✅ DONE | #3 case_narratives.status, #4 indicator_measurements.status | `20260719000400_status_keys_narratives_measurements.sql` (+ test `214`) | small-med | #4 renamed the `indicator_kpis`/`hospital_indicator_rollup` RETURNS-TABLE cols; `queries/indicators.ts` + generated types updated |
| **G3** ✅ DONE | #5 capa_action, #6 case_interviews, #7 capa_plan | `20260719000500_status_keys_capa_interviews.sql` (+ test `216`) | med | CAPA + interview components; nsp rollups |
| **G4** ✅ DONE | #8 controlled_documents(+_versions) | `20260719000600_status_keys_controlled_docs.sql` (+ test `218`) | med-high | 2 columns, ~15 RPC sites, phase17 ~51 e2e |
| **G5** ✅ DONE | #9 case_referral, #10 meetings | `20260719000700_status_keys_referral_meetings.sql` (+ test `220`) | high | 8-state + 6-state chains; resolved/in-flight Sets; phase10/phase22 e2e |
| **G6** ✅ DONE | #11 cases.status **+** #12 case_phases.status | `20260719000800_status_keys_cases_phases.sql` (+ test `222`) | highest | **MUST be one migration** — `cases.status` is recomputed from `case_phases.status` (`baseline` L3879 `bool_or(status='ativa'/'concluida')`); terminal gate `('concluido','cancelado')` in ~15 RPCs / 6+ migrations; ~8 components; cases-* / case-* e2e |

**Gate cadence:** targeted specs per group during the loop; the **full standalone-prod E2E suite once after
G6** to declare the whole D11 track green (lead runs it as a background command — memory
`subagent-cannot-run-full-e2e`, `e2e-standalone-server-not-next-start`, `e2e-prod-build-flaky-baseline`).

## Execution status (backend, 2026-07-12)

- **G1 ✅ + G2 ✅ complete and verified** — full ordered `supabase db reset` + `supabase test db`
  green after each (**Files=82, Tests=2065 PASS**; new locks `212`/`214`). Migrations
  `20260719000300` / `…000400` on disk. Types regen (`--local`). Backend `src/lib` anglicized for
  #1-#4.
- **G3 ✅ complete and verified** — `20260719000500_status_keys_capa_interviews.sql` + lock `216`.
  Full ordered reset + `supabase test db` green (**Files=83, Tests=2074 PASS**). Function rewrite =
  the G3 function-set × full map, scoped by owning-table + named guards (guard_capa_status,
  guard_interview_status), excluding conflicting-table fns; dry-run verified the G6 phase guard /
  G5 referral / G5 meeting literals stay pt-BR. Backend `src/lib` anglicized: `safety/capa-types.ts`
  (both unions + label-map keys), `queries/interviews.ts` (union + docs), `interviews/actions.ts`
  (docs), `queries/case-timeline.ts` L476 (interview `iv.status`). Seed + fixtures (143/196/121/144/
  193/197/208) anglicized.
- **G4 ✅ complete and verified** — `20260719000600_status_keys_controlled_docs.sql` + lock `218`.
  Full ordered reset + `supabase test db` green (**Files=84, Tests=2080 PASS**). rascunho→draft,
  em_aprovacao→in_approval, vigente→effective, obsoleto→obsolete on both columns; rewrite scoped to
  ctrl-docs functions + guard_controlled_document_status, excluding case_referral (shares `rascunho`,
  G5). Backend `src/lib`: `documents/types.ts` (union + label keys + docs), `documents/version-select.ts`
  (L39/L57 comparisons), `documents/actions.ts` (docs; L73 pt-BR message value LEFT), `queries/documents.ts`
  L294 (`v.status === 'in_approval'`). Seed + fixture 200 anglicized.
- **G5 ✅ complete and verified** — `20260719000700_status_keys_referral_meetings.sql` + lock `220`.
  Full ordered reset + `supabase test db` green (**Files=85, Tests=2086 PASS**). By G5, only `concluida`
  is still shared (case_phases, G6); all other G5 literals became unique once G3/G4 ran. Rewrite = the
  referral+meetings function set (table-ref + named guards guard_referral_status/guard_meeting_status/
  add_referral_reply_attachment); `concluida`→completed guarded to skip any case_phases-referencing fn.
  Dry-run verified phase `concluida` (guard/recompute/sync) + close_case's cases `concluido` stay pt-BR
  while close_case's referral `enviada`→sent converts. Backend `src/lib`: `referrals/types.ts` +
  `queries/referrals.ts` (unions, label/visual keys, `.in`/`.eq`/resolved+inFlight Sets, comparisons),
  `queries/meetings.ts` (union + em_assinatura filters), `case-timeline.ts` L492 (meeting)/L546 (referral),
  `meetings/actions.ts` + `referrals/actions.ts` + `overview.ts` + `event-model.ts` + `meetings/messages.ts`
  (doc comments). Seed + fixtures (120/150/152/183/197/206) anglicized.
- **G6 ✅ complete and verified** — `20260719000800_status_keys_cases_phases.sql` + lock `222`.
  Full ordered reset + `supabase test db` green (**Files=86, Tests=2094 PASS**). FINAL group: since
  every other owner of pendente/concluida/concluido/cancelado was already anglicized (G2-G5), NO scoping
  is needed — a blanket catalog rewrite over every function whose def changes is provably safe (live-catalog
  verified: only cases/case_phases fns carry any G6 literal, incl. the blank-table guard_case_phase_status).
  Migration re-anglicizes the cases_closed_at_paired terminal gate + both CHECKs + defaults; dry-run confirmed
  recompute_case_status derives cases.status FROM case_phases.status in English and close_case's terminal
  gate flipped. Backend `src/lib`: `cases/case-status.ts` (union + label-map keys + isTerminal), `queries/cases.ts`
  (phase union + `.eq('status','active')`), `queries/case-timeline.ts` (phase type + comparisons, LEFT the
  pt-BR `'Caso cancelado'`/`'Caso concluído'` VALUES), `case-narratives.test.ts` mocks, + doc comments
  (backtick refs) across cases/actions, result-actions, process-templates, responses/actions, event-model,
  overview. Seed + 21 fixtures anglicized (quote-anchored — VALUES converted, assertion-message prose left).
- **ALL D11 GROUPS G1–G6 ✅ COMPLETE (backend layer).** Types regenerated (`--local`); `src/lib` typechecks
  CLEAN (0 errors). `npm run typecheck` is RED (167 errors) ONLY at `src/components`/`src/app`/`e2e` — the
  frontend/tester work list below. No `git commit`, no remote push, no `graphify update` performed (per task).
- **Frontend + tester layer NOT done for ANY group yet** (backend-only per the plan). After G1-G2,
  `src/components`/`src/app`/`e2e` still carry the old pt-BR keys → **tsc is RED at those sites now**
  (that red list IS the frontend/tester work — do not run a green `next build` until they catch up).

## PROVEN METHOD (use for G3–G6 — each step earned by a G1/G2 failure)

1. **CHECK + column default:** explicit `ALTER TABLE … DROP/ADD CONSTRAINT` + `ALTER COLUMN … SET
   DEFAULT`. Empty DB at migration time (seed runs after) → no data backfill (reset-OK).
2. **Function rewrite = programmatic catalog pass** (ADR-0051 precedent), NOT hand-reproduction:
   loop `pg_proc` where `prokind = 'f'` (⚠ `pg_get_functiondef` **raises on aggregates** — never put it
   in a `WHERE` over all of pg_proc; filter `prokind='f'` and fetch the def INSIDE the loop), and for
   each (search,replace) pair `if position(search in def) > 0 then execute replace(def, search, new)`.
3. **Partial indexes:** same loop over `pg_index` — capture `pg_get_indexdef` BEFORE `drop index`; skip
   constraint-backed indexes (`not exists (… pg_constraint conindid = indexrelid)`).
4. **UNIQUE literal → blanket replace is safe. SHARED literal → MUST be function-SCOPED**: rewrite it
   only in functions that reference the enum's OWN table AND **none** of the other status-enum tables
   (e.g. G2 narrative `concluida`: `position('case_narratives' in def)>0 AND position('case_interviews'
   in def)=0 AND 'case_referral'=0 AND 'case_phases'=0`). A per-file `sed` of a shared literal is UNSAFE.
5. **RETURNS TABLE output-column rename ⇒ 42P13** ("cannot change return type") under CREATE OR REPLACE
   → **DROP FUNCTION + re-CREATE + re-`grant execute … to authenticated, service_role`** (grants reset on
   drop). Do it in a separate block AFTER the body pass (see G2's `indicator_kpis`/`hospital_indicator_rollup`).
6. **seed.sql + pgTAP fixtures + `src/lib`** in the SAME migration/group. For SHARED literals in fixtures,
   classify PER-SITE (G2 burned on this: `144:402` is a case_phase, `183:73` a case_referral, `197:69` a
   case_phase — all feminine `concluida`, none narrative). Unique literals → sed is fine.
7. **Per-group lock:** a `21x_status_keys_gN.sql` pgTAP asserting each CHECK accepts the new key + rejects
   the old + the default, THEN full ordered `supabase test db` after a fresh reset (never a subset).

## SHARED-LITERAL REGISTRY (the failure-mode map — which literal spans which groups)

| pt-BR literal | → English | enums / groups | scoping note |
|---|---|---|---|
| `concluida` (fem) | completed | narratives(G2✅) · capa_action+case_interviews(G3) · case_referral(G5) · case_phases(G6) | `conclude_narrative`/`conclude_interview`/`conclude_referral` ALL write `'concluida', concluded_at` (same columns) — scope by owning-table filter (step 4). `reopen_*` guards also carry it. |
| `concluido` (masc) | completed | capa_plan(G3) · cases(G6) | |
| `pendente` | pending | capa_action(G3) · cases+case_phases(G6) | |
| `rascunho` | draft | case_interviews(G3) · controlled_docs(G4) · case_referral(G5) | |
| `cancelada` (fem) | cancelled | capa_action+case_interviews(G3) · meetings(G5) | |
| `cancelado` (masc) | cancelled | capa_plan(G3) · cases(G6) | |
| `em_andamento` | in_progress | capa_action + case_interviews (BOTH G3 — fully contained) | |
| `aberto` (masc) | open | capa_plan(G3) only | unique within remaining groups |

Enum-UNIQUE remaining literals (blanket-safe within their group): G3 `em_execucao`/`em_verificacao`(capa_plan),
`agendada`(interviews — but also meetings G5! → scope), `em_andamento`(G3-contained); G4
`em_aprovacao`/`vigente`/`obsoleto`; G5 `enviada`/`recebida`/`aceita`/`recusada`/`em_analise`/`retirada`
(referral), `realizada`/`em_assinatura`/`assinada`/`distribuida`(meetings); G6 `nao_iniciado`/`em_revisao`(cases),
`ativa`/`nao_necessaria`(case_phases). ⚠ `agendada` is in BOTH case_interviews(G3) and meetings(G5) → scope it.

## FRONTEND / TESTER work list (per enum) — derive authoritatively, then hand off

The precise list = **tsc errors after `supabase gen types --local` + the QUOTED-key literals** (`'ativo'`,
`"presente"`, …) in `src/components` / `src/app` / `e2e`. (A bare-word grep is noisy — `ausente` etc. also
appear in pt-BR prose/labels that must NOT change.) Backend hands `frontend` the `src/components`+`src/app`
sites and `tester` the `e2e` sites. **G1/G2 frontend files** already carrying English-mismatched keys (from the
quoted-key grep) include: indicators — `indicators-panel.tsx`, `measurement-grid.tsx`, `indicator-list.tsx`,
`indicator-format.tsx`, `capa-affordance.tsx`, `archive-template-button.tsx`, `template-builder-shell.tsx`,
`indicadores/[indicatorId]/**`; meetings — `attendee-form.tsx`, `attendees-panel.tsx`, `meeting-labels.ts`,
`meeting-badges.tsx`, `signatures-panel.tsx`, `meeting-lifecycle-actions.tsx`; narratives — `case-narrative-card.tsx`,
`conclude-narrative-button.tsx`, `narrative-editor.tsx`, `narrative-status-pill.tsx`, `narrative-access.ts`,
`add-ad-hoc-narrative-dialog.tsx`, `casos/[caseId]/narrativa/**`. **G1/G2 e2e**: `phase15-indicators.spec.ts`
(measurements), `phase10-meetings.spec.ts` / `meeting-held-time.spec.ts` / `cases-meetings-minor.spec.ts`
(attendance quoted keys), `case-narratives.spec.ts` / `ad-hoc-narratives.spec.ts` / `case-access.spec.ts`
(narrative status). (These are NOT backend's to edit — file-ownership.)

### SITE MAP — G3–G6 frontend + tester sites (recorded by backend after G6, 2026-07-12)

Derived from `npm run typecheck` (167 errors, ALL in `src/components`/`src/app`/`e2e`; `src/lib` = 0)
after `supabase gen types --local`, cross-checked with a QUOTED-key grep. **frontend** owns the
`src/components`+`src/app` files; **tester** owns the `e2e` files. (Note: the full tsc-RED list also
still carries the never-done **G1/G2** frontend leftovers already listed above — indicators
`measurement-grid.tsx`/`indicator-list.tsx`/`indicator-format.tsx`, attendance `attendee-form.tsx`/
`attendees-panel.tsx`, narrative `narrative-editor.tsx`/`case-narrative-card.tsx`/`narrative-access.ts`.)

**FRONTEND (`src/components` + `src/app`):**
- **G3 CAPA** — `safety/capa/capa-derive.ts`, `capa-action-card.tsx`, `capa-visuals.ts`, `capa-workspace.tsx`,
  `capa-header.tsx`, `capa-closure-panel.tsx`, `capa-badges.tsx`; `indicators/capa-affordance.tsx`.
- **G3 Interviews** — `interviews/interview-labels.ts`, `interviews/interview-lifecycle-actions.tsx`;
  `app/o/[org]/c/[commission]/manage/cases/[caseId]/interviews/[interviewId]/page.tsx`.
- **G4 Controlled Docs** — `documents/document-filter-bar.tsx`, `documents/document-badges.tsx`;
  `app/…/manage/documentos/page.tsx`, `…/documentos/[documentId]/page.tsx`, `…/documentos/[documentId]/editar/page.tsx`.
- **G5 Referrals** — `referrals/referrals-list.tsx`, `referral-actions.tsx`, `referral-chips.tsx`;
  `app/o/[org]/nsp/encaminhamentos/page.tsx`, `app/o/[org]/c/[commission]/encaminhamentos/[referralId]/page.tsx`.
- **G5 Meetings** — `meetings/meeting-labels.ts`, `meeting-lifecycle-actions.tsx`, `meetings-list.tsx`,
  `signatures-panel.tsx`, `meeting-header.tsx` (`attendee-form.tsx`/`attendees-panel.tsx` are G1 attendance).
- **G6 Cases/Phases** — `cases/case-derive.ts`, `coordinator-phase-actions.tsx`, `case-phase-list.tsx`,
  `case-phase-article.tsx`, `cases-table.tsx`, `case-lifecycle-actions.tsx`, `my-cases-filter.tsx`, `format.ts`,
  `phase-status-pill.tsx`, `my-phase-card.tsx`, `cases-kanban.tsx`; `app/…/casos/[caseId]/narrativa/[narrativeId]/page.tsx`
  (`narrative-editor.tsx`/`case-narrative-card.tsx`/`narrative-access.ts` are G2 narrative).

**TESTER (`e2e`):** — G3: `phase14d-capa.spec.ts`, `cases-extras.spec.ts`, `member-action-items-overview.spec.ts`,
`meeting-held-time.spec.ts`. · G4: `phase17-documents.spec.ts`. · G5: `phase10-meetings.spec.ts`,
`cases-meetings-minor.spec.ts`, `meeting-held-time.spec.ts`, `perf-sweep-wave2.spec.ts`. · G6:
`phase7-cases.spec.ts`, `case-phase-result.spec.ts`, `processless-cases.spec.ts`, `cases-extras.spec.ts`,
`case-patient.spec.ts`, `patient-index.spec.ts`, `phase22-referrals.spec.ts`, `phase13-audit.spec.ts`,
`form-model-normalization.spec.ts`, `member-action-items-overview.spec.ts` (files overlap groups via shared keys).

> **Backend note for QA/reviewers:** two intentional non-conversions. (1) pgTAP **assertion-message** prose
> (the 3rd `is()`/`throws_ok` arg) and a few dense guard-comment bare words retain pt-BR keywords — they are
> test/doc labels, not stored keys, and word-boundary rewriting them would corrupt pt-BR VALUES
> (`'Caso cancelado'`, `'fase ativa'`) + G2 narrative-message substrings. (2) `case-narratives/actions.ts`
> carries stale **G2** lifecycle comments (`aberta → concluida`) — that is G2's file, left untouched per
> file-ownership. All stored KEYS (unions, CHECKs, defaults, function bodies, label/visual map keys, seed +
> fixture VALUES, runtime comparisons/filters) ARE converted.

## Open confirmations before G1
- Backend locks spelling (`cancelled`/`draft`/`archived`/`in_progress`) against existing schema keys.
- Confirm D11 covers **status enums only** — the ~13 non-status Portuguese enum columns
  (`classification`, `modality`, member/interviewer `role`, attachment `kind`, indicator
  `kind/direction/frequency/data_source`, …) are **excluded** (out of "status enum" scope; can be a later pass).

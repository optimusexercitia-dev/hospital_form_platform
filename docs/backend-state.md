# backend-state.md — Living Backend Capability Map

> **Purpose.** A durable, terse map of what the backend already provides, so the lead
> references it at phase start instead of re-deriving ~50 lines of "lead notes" each
> phase. The **lead keeps this current** at the §6 Record step (CLAUDE.md §7): when a
> phase adds an RPC, flips a flag, or changes an RLS surface, update the relevant table
> here. This is a map, not the authority — `ARCHITECTURE.md` is the spec and the
> migrations are the truth. Last updated: **2026-06-15 (Case data-model adjustments batch — phase blocking + fixed auto-computed statuses replacing the R2 configurable system + per-commission outcomes; ADR 0024, supersedes 0023). Earlier: post-Phase-8 Cases-Extras batch (R1 documents/events, R3 tags, R4 action items; ADR 0022).**

## Migrations (forward-only, additive)

| Range | Phase | What landed |
| ----- | ----- | ----------- |
| `…100001–100003` | 1 | Core schema: profiles trigger, commissions, members, forms, versions, sections, items; admin claim (access-token hook, ADR 0002). |
| `…100004` | 1 | Response lifecycle: responses, answers, signoffs; published + submitted immutability triggers; display-item answer-rejection trigger. |
| `…100005` | 1 | Condition evaluator + `submit_response` + publish validation. Sign-off check feature-flagged OFF (ADR 0004). |
| `…100006–100007` | 1 | Full RLS policy set + helpers; `form-assets` Storage bucket policies. Deny-by-default. |
| `…100008` | 1 | QA loop-back RLS hardening (staff_admin UPDATE role-restricted; `eval_condition` search_path pinned; profiles no-delete; version↔commission guard). |
| `…100009` | 3 | Denormalized `profiles.email` (citext, nullable) + sync triggers (ADR 0010). |
| `…100010` | 4 | Builder RPCs + deferrable position uniques (ADR 0011); repaired `form_versions` insert RLS (ADR 0013). |
| `…100011` | 5 | Response-fill RPCs (ADR 0015). |
| `…090001–090003` | 6 | Sign-off: flag flip + cross-version guard (P0013); sign-off RPCs; definer read path (ADR 0016). |
| `…090004–090007` | 7 | Multi-phase cases (ADR 0017): 4 tables (`process_templates`, `process_template_phases`, `cases`, `case_phases`) + `responses.case_phase_id` bridge + reworked unique indexes; per-commission case-number minting + case/phase state-machine guards (`app.in_case_rpc`); template/case RPCs; submit trigger + recompute; **submitted-only** `case_phase_answer_map`; definer board reads; RLS (members read / staff_admin write). Evaluator REUSED unchanged. |
| `…090008` | 7 | Flag flip: `cases_multi_phase` → **ON** (mirror `…090001`). The feature is live; the Phase-7 ship state. |
| `…090009` | 7 | P7-002 fix: custom SQLSTATE class `P00xx` → **`HC0xx`** (ADR 0018). `CREATE OR REPLACE`s `submit_response`/`save_section_answers`/`sign_section` (committed Phase 5/6) with `HC010`–`HC015`; the unshipped `090005`/`090006` carry `HC016`–`HC022` in place. Restores `error.code` discrimination on PostgREST 14 (unknown class → 400/JSON). |
| `…090010` | maint | Default (anchor) section may carry a title + builder rename (ADR 0019). |
| `…090011` | 8 | Dashboard aggregation: 5 definer RPCs (`dashboard_distributions`/`_free_text`/`_submissions_over_time`/`_completion_by_member`/`_form_totals`) + `commission_overview`; helpers `app.submitted_form_responses` (canonical submitted+standalone filter) + `app.latest_published_version`. `is_staff_admin_of OR is_admin`-gated, `search_path` pinned (ADR 0020). |
| `…090012` | 8 | B6: revoke anon **and PUBLIC** DML/EXECUTE on `public` (+ default-priv revokes). auth/storage/realtime untouched. |
| `…090013` | 8 | `dashboard_export_rows` definer RPC (CSV export, standalone submitted-only). |
| `…090014` | 8 | B6 follow-up: revoke the re-inherited PUBLIC EXECUTE on `dashboard_export_rows` + durable `alter default privileges … revoke execute on functions from public`. |
| `…090015` | 8 | QA MINOR-1/2: date params (`p_from`/`p_to`) added to `dashboard_export_rows` + `dashboard_form_totals`. |
| `20260614091000` | 7 (post) | Case-phase **due dates** (ADR 0021): additive cols `process_template_phases.default_due_days` (int, nonneg) + `case_phases.default_due_days` (snapshot copy at case creation) + `case_phases.due_date` (date). Trailing optional params appended: `add_template_phase(+p_default_due_days)`, `update_template_phase(+p_default_due_days,+p_clear_default_due_days)` (clear/replace/keep, mirrors `recommend_when`), `activate_phase(+p_due_date)` (set under existing `app.in_case_rpc`). `create_case_from_template` snapshots the slot default; `list_cases_board` exposes `due_date`, `get_case_detail` exposes `due_date`+`default_due_days`. No new RLS/SQLSTATE; evaluator untouched. |
| `20260614091001` | 7 (post) | `reassign_phase(+p_due_date)` overload (ADR 0021). |
| `…092000` | Extras (R2) | **Configurable case status** (ADR 0023): `public.case_status_defs` (per-commission vocab; unique key + DEFERRABLE unique position + partial-unique single non-archived `is_initial`); RLS member-read/staff_admin-write; `app.case_status_is_terminal(commission,key)`; `app.seed_default_case_statuses()` + AFTER INSERT trigger on `public.commissions`; **dropped `cases_status_check`** (no row remap, from-scratch reset). |
| `…092001` | Extras (R2) | `cases.status` default → `em_andamento`; **rewritten `app.guard_case_status`** (configurable: HC024 undefined key / HC025 terminal-frozen; any non-terminal→any-defined); **liveness sweep** — `'aberto'` literal → `app.case_status_is_terminal(...)` across `sync_case_phase_on_submit`/`activate_phase`/`skip_phase`/`add_ad_hoc_phase`/`reassign_phase`/`create_case_from_template`; `app.apply_case_status` DEFINER core + `set_case_status`; `close_case`/`cancel_case` → thin wrappers (gate only `cases_multi_phase`); status CRUD + `list_case_status_defs` (definer); `cases_extras` flag (OFF) + `app.assert_extras_enabled()`. Re-revoked anon/PUBLIC EXECUTE on every public fn created/replaced (+ closed a 091000/091001 leak). |
| `…092002` | Extras (R1) | **Documents & events:** `public.case_documents` (soft-delete `deleted_at`/`deleted_by`; unique `storage_path`) + `public.case_events` (edit + hard-delete); RLS member-read/staff_admin-write via `app.commission_of_case`. `public.cases_extras_enabled()` DEFINER read (TS-layer gate for the R1 direct-table-write actions). |
| `…092003` | Extras (R1) | **`case-documents` Storage bucket** (private, 25 MiB, MIME allow-list PDF/images/Word/Excel/CSV/plain); path `{commission_id}/{case_id}/{uuid}.{ext}`; member-read / staff_admin-insert / NO update/delete (immutable, clone of `form-assets`). |
| `…092004` | Extras (R3) | **Tagging:** `public.case_tags` (unique(commission,name)) + `public.case_tag_assignments` (PK (case,tag)) + `app.guard_case_tag_assignment` BEFORE INSERT (**HC026** mismatch); RLS member-read/staff_admin-write; RPCs `create/rename/archive_case_tag` + `assign/unassign_case_tag` (gate `cases_extras`); `case_tag_report(commission,from?,to?)` DEFINER/gated, counts on `cases.created_at::date`. |
| `…092005` | Extras (R4) | **Action items:** `public.case_action_items` (status open/in_progress/done/cancelled; `source_case_phase_id` ON DELETE SET NULL); RLS member-read/staff_admin full-write; authoring RPCs `create/update_action_item`; lifecycle via `app.advance_action_item_core` (DEFINER, assignee OR staff_admin gate → **HC027**) behind `advance/complete_action_item`; hard-delete via RLS; `case_action_items_kpis(commission)` DEFINER/gated (open/overdue/completed-YTD). |
| `…092006` | Extras | Flag flip: `cases_extras` → **ON** (mirror `…090008`). |
| `…093000` | Case-model | **DROP the R2 configurable status** (ADR 0024 / D12): `case_status_defs` (+ policies) + the status CRUD/`set_case_status`/`apply_case_status`/`case_terminal_key`/`case_status_is_terminal`/`slugify_status_key`/`unaccent_fallback`/`seed_default_case_statuses` + the `seed_case_statuses_on_commission_insert` commission trigger. No cascade (fails loud on a stray dependent). `guard_case_status` kept (its trigger stays) — rewritten in 093001. |
| `…093001` | Case-model | **Fixed auto-computed status** (D6/D7): defensive normalize → `cases.status` fixed 5-value CHECK (`nao_iniciado`/`em_revisao`/`pendente`/`concluido`/`cancelado`), default `nao_iniciado`; `app.recompute_case_status` + AFTER-trigger on `case_phases`; `guard_case_status` rewritten (validity → CHECK; HC025 terminal-frozen). **Liveness-sweep landmine:** re-`CREATE OR REPLACE` `sync_case_phase_on_submit`/`skip_phase`/`add_ad_hoc_phase`/`reassign_phase`/`cancel_case` with a fixed-enum terminal check (`activate_phase`→093002, `create_case_from_template`/`close_case`→093003 — one final def each). `cancel_case` anytime + terminal-first. Re-revoke anon/PUBLIC. |
| `…093002` | Case-model | **Phase blockers** (D1/D4): `blocks integer[]` on `process_template_phases` + `case_phases` (`not null default '{}'`); `app.guard_phase_blocks_shape` BEFORE INS/UPD (earlier-only → HC016) + `app.validate_template_phase_blocks` (deep "position exists" → HC016); `set_template_phase_blocks`; `add/update_template_phase` gain `p_blocks`; `reorder/remove_template_phase` remap the `blocks` arrays across the renumber **in a single atomic UPDATE per row** (shape trigger sees no transient forward-ref); `activate_phase` FINAL — blocker gate (HC018 reworded) replaces strict-sequential, parallel-safe. Re-revoke anon/PUBLIC. |
| `…093003` | Case-model | **Outcomes** (D8–D11/D15): `case_outcomes` (per-commission vocab) + `process_template_outcomes` (offered set, `app.guard_process_template_outcome` → **HC030**) + `case_offered_outcomes` (per-case FROZEN snapshot) + `cases.outcome_id` (single FK, `NO ACTION`); RLS member-read/staff_admin-write on all three. RPCs `set_case_outcome` (HC025/HC029), `set_process_outcomes`, outcome CRUD (`create/update/reorder/archive_case_outcome`); **`close_case` FINAL = D3 conclude gate** (HC031 unsettled / HC028 outcome-required, terminal-first); `create_case_from_template` FINAL also snapshots `blocks` + copies `process_template_outcomes`→`case_offered_outcomes`; `list_cases_board` (DROP+recreate, return-shape changed) + `get_case_detail` gain answer-free outcome metadata + per-phase `blocks`. Re-revoke anon/PUBLIC. |

## RPC inventory

All `security invoker` unless marked **DEFINER**. Invoker RPCs rely on RLS as the
authority; definer RPCs are narrow, internally gated exceptions (documented in an ADR).

| RPC | Mode | Purpose / notes |
| --- | ---- | --------------- |
| `submit_response(response)` | invoker | **The submission authority.** Visibility eval from saved answers, required-answer check, sign-off check (gated by `signoff_enforcement` flag), stray-answer cleanup, atomic flip → submitted. |
| `publish_form_version(version)` | invoker | Runs `validate_visible_when`, archives prior published, flips to published. |
| `validate_visible_when(version)` | invoker | Publish-time condition structural validation (referenced key exists, earlier section only, not on first section). |
| `create_form(...)` | invoker | Form + v1 draft + default section, atomic. |
| `clone_form_version(source)` | invoker | Copy sections+items, preserve `question_key`/`visible_when`/sign-off/`storage_path`, remap ids. Returns existing draft if one exists (ADR 0012). |
| `reorder_section` / `reorder_item` | invoker | Single-statement CASE swap against deferrable uniques (ADR 0011). |
| `delete_section_moving_items(section, target?)` | invoker | Atomic "move items to target then delete source". |
| `save_section_answers(response, section, answers, clear_item_ids)` | invoker | Atomic section upsert + `last_section_id` + `updated_at`; `clear_item_ids` = orphan-clear; cross-version item guard → **P0013**. |
| `start_or_resume_response(version)` | invoker | Resume existing in_progress or create; `unique_violation`-catch race; published-only backstop. |
| `sign_section(response, section, note)` | invoker | Backs BOTH respondent (wizard) and staff_admin (queue) sign. RLS `signoffs_insert` enforces signer-role; RPC adds visibility + in_progress precondition. Unique-race → **P0015**. |
| `list_signoff_queue(commission)` | **DEFINER** | `is_staff_admin_of`-gated; predicate = visible + unsigned + `staff_admin`-role + submit-ready (`app.response_required_complete`). ADR 0016. |
| `get_response_for_signoff(response)` | **DEFINER** | Narrow read of one in_progress response with a pending staff_admin sign-off. Does NOT broaden `responses_select` (preserves Phase-7 invariant). ADR 0016. |
| **Phase 7 — cases (all gate `cases_multi_phase`):** | | |
| `create_process_template` / `archive_process_template` / `publish_process_template` | invoker | Template lifecycle (`draft→active→archived`). Publish requires ≥1 phase + validates every `recommend_when` (P0016/P0017). |
| `add_template_phase` / `update_template_phase` / `reorder_template_phase` / `remove_template_phase` | invoker | Slot CRUD + adjacent-swap reorder (deferrable unique) + renumber; re-validate `recommend_when` (HC016). Draft-only. As of ADR 0024: `add/update_template_phase` gain a trailing `p_blocks` (`+p_clear_blocks` on update); `reorder/remove` also **remap the `blocks` arrays** across the renumber (single atomic UPDATE per row; HC016 on a dangling/forward ref). |
| `set_template_phase_blocks(phase, blocks[])` | invoker | (ADR 0024) Set a slot's EARLIER-phase blockers (D1). Draft-only; validates earlier-only + position-exists (HC016) via `app.validate_template_phase_blocks`. Gates `cases_multi_phase`. |
| `create_case_from_template(template, label?)` | **DEFINER** | `is_staff_admin_of`-self-gated. Mints case (per-commission number trigger, bounded retry; status defaults to `nao_iniciado`), snapshots slots → `case_phases` pinning each form's published version (HC017), copies+revalidates `recommend_when` (HC016), **snapshots `blocks`** + copies `process_template_outcomes`→`case_offered_outcomes` (ADR 0024), initial recompute. |
| `activate_phase(phase, assignee, due_date?)` | invoker | (ADR 0024) **Blocker gate** (HC018, reworded "blocked by phases") replaces strict-sequential: rejected while any phase it `blocks` is not yet `concluida`/`nao_necessaria`; **parallel-safe** (empty blocks activates freely, multiple phases may be `ativa`). + pendente (HC019) + case non-terminal (HC020) + assignee member (HC021); sets `due_date` under `app.in_case_rpc`. |
| `skip_phase(phase)` | invoker | `pendente→nao_necessaria` (HC019/HC020); recompute. |
| `add_ad_hoc_phase(case, form, …)` | invoker | Append (`is_ad_hoc`) on a non-terminal case (HC020), pin published version (HC017), validate recommend_when (HC016). |
| `reassign_phase(phase, assignee, due_date?)` | invoker | Change assignee only before a response exists (HC019); member check (HC021); case non-terminal (HC020). |
| `start_or_resume_phase(phase)` | invoker | Assignee-only (HC022), phase ativa (HC019); uses the PINNED version (**skips** the published-only backstop); one-response-per-phase race catch. |
| `recompute_recommendations(case)` | **DEFINER** | Flags `recommended` on pendente phases via `eval_condition(recommend_when - 'from_phase', case_phase_answer_map(source))`. Submitted-only source. |
| `close_case(case)` | invoker | (ADR 0024) **D3 conclude gate:** rejects unsettled (pendente/ativa) phases → **HC031**; if the case offers outcomes and none chosen → **HC028**; else terminal-FIRST `concluido` + `closed_*`, then flip residual phases (recompute early-returns). Gates only `cases_multi_phase`. |
| `cancel_case(case)` | invoker | (ADR 0024) `→ cancelado` **anytime** (no settle gate; only HC025 if already terminal); terminal-FIRST then flip residual phases. Gates only `cases_multi_phase`. |
| `list_cases_board(commission)` | **DEFINER** | `is_staff_admin_of`-gated; one row/case + phases **status only** (no answers); **+ resolved `outcome` (label/flags, LIVE)** (ADR 0024). |
| `get_case_detail(case)` | **DEFINER** | `is_staff_admin_of`-gated; case header + phases; `response_id`/`submitted_at` only for SUBMITTED phases (Phase-7 invariant); **+ resolved `outcome` + frozen `offered_outcomes` + per-phase `blocks`** (answer-free) (ADR 0024). |
| *phase submission* | trigger | **Reuses `submit_response` unchanged.** `sync_case_phase_on_submit` (AFTER UPDATE on `responses`) flips the phase `ativa→concluida` (sets its OWN `app.in_case_rpc`; that flip fires `recompute_case_status_trg` → macro status auto-advances), recomputes recs. No-op when the case is terminal. |
| **Phase 8 — dashboards (DEFINER; `is_staff_admin_of OR is_admin`-gated; `commission_overview` is `is_admin`):** | | |
| `dashboard_distributions(form, from?, to?)` | **DEFINER** | Per-(question_key, option) counts; checkbox unnested; per-section denominator; standalone submitted-only; date-bounded. |
| `dashboard_free_text` / `dashboard_submissions_over_time` / `dashboard_completion_by_member` / `dashboard_form_totals(commission, from?, to?)` | **DEFINER** | Free-text samples / volume trend / completion-by-member / per-form totals. Standalone submitted-only, date-bounded. |
| `dashboard_export_rows(form, from?, to?)` | **DEFINER** | CSV rows: one col per `question_key` (checkbox `;`-joined) + per-signed-section sign-off status. |
| `commission_overview()` | **DEFINER** | `is_admin`-gated cross-commission counts/volume (case-phase-excluded). |
| **Case-model adjustments — OUTCOMES (all gate `cases_extras`; ADR 0024):** | | |
| `set_case_outcome(case, outcome_id?)` | invoker | Assign/clear a case's single outcome (D9). `is_staff_admin_of`/admin gate; rejects terminal case (**HC025**); a non-null outcome must be in the case's FROZEN `case_offered_outcomes` (**HC029**); writes `cases.outcome_id` (a non-status column — the rewritten `guard_case_status` permits it on a non-terminal case without `app.in_case_rpc`). |
| `set_process_outcomes(template, outcome_ids[])` | invoker | The draft builder's offered-set persistence (D15). Draft-only; delete-then-insert `process_template_outcomes`; same-commission guard → **HC030**; `[]` offers none. |
| `create_case_outcome` / `update_case_outcome` / `reorder_case_outcomes` / `archive_case_outcome` | invoker | Outcome-vocab CRUD (mirror tag CRUD); `is_staff_admin_of`-gated; `unique(commission,label)` → 23505; deferrable-position reorder; edits propagate (D11); a referenced row is archived, never deleted (`cases.outcome_id` is `NO ACTION`). |
| **(R2 configurable-status RPCs `set_case_status` / `create/update/reorder/archive_case_status` / `list_case_status_defs` were REMOVED — ADR 0024 / migration 093000. Status is now a FIXED auto-computed enum: see `app.recompute_case_status` + its AFTER-trigger under Helpers; `close_case`/`cancel_case` above are the only manual transitions.)** | | |
| **Cases-Extras — R1 documents/events (writes are DIRECT table ops gated in TS via `cases_extras_enabled`):** | | |
| *(no write RPCs)* | — | `case_documents`/`case_events` writes go through the staff_admin-write RLS from the server actions (upload clones `uploadFormAsset`). `cases_extras_enabled()` DEFINER read is the TS-layer flag gate. |
| **Cases-Extras — R3 tags (all gate `cases_extras`):** | | |
| `create_case_tag` / `rename_case_tag` / `archive_case_tag` | invoker | Vocab CRUD; `is_staff_admin_of`-gated; `unique(commission,name)` → 23505. |
| `assign_case_tag(case, tag)` / `unassign_case_tag(case, tag)` | invoker | `is_staff_admin_of`-gated; assign idempotent on PK; BEFORE INSERT guard → **HC026** on commission mismatch. |
| `case_tag_report(commission, from?, to?)` | **DEFINER** | `is_staff_admin_of`/admin-gated; per-tag DISTINCT case count over `created_at::date` window (mirrors `dashboard_form_totals`). |
| **Cases-Extras — R4 action items (writes gate `cases_extras`):** | | |
| `create_action_item` / `update_action_item` | invoker | `is_staff_admin_of`-gated authoring; assignee-member check (HC021); source phase must belong to the case. |
| `advance_action_item(item, status)` / `complete_action_item(item)` | invoker | Lifecycle via `app.advance_action_item_core` (DEFINER): caller must be the assignee OR staff_admin/admin → **HC027**; stamps `completed_*` on `done`. |
| `case_action_items_kpis(commission)` | **DEFINER** | `is_staff_admin_of`/admin-gated; open / overdue / completed-YTD (zeroed row to non-staff_admin). |

## Helper functions

- `is_member_of(commission)` / `is_staff_admin_of(commission)` — `security definer`,
  used throughout RLS.
- `app.is_admin()` — from the verified JWT claim, DB fallback as defense-in-depth.
- `app.eval_condition(...)` — the **SQL** condition evaluator. Mirrored in TypeScript by
  `evalCondition` in `src/lib/queries/conditions.ts`; the shared vector file
  `src/lib/queries/__fixtures__/condition-vectors.json` keeps them in agreement.
  **Drift is phase-blocking.**
- `app.answer_map(response)` — answers keyed for evaluation.
- `app.response_required_complete(response)` — submit-readiness (used by the queue).
- `app.can_sign_section` / `app.can_read_signoff` — definer predicates (090003) that
  do response fact-finding for the sign-off path without RLS-filtering the parent row;
  signer-role rules unchanged.
- `app.feature_enabled(name)` — reads `app.feature_flags`; `app.assert_cases_enabled()` is
  the Phase-7 entry gate wrapper (raises `23514` when `cases_multi_phase` is OFF);
  `app.assert_extras_enabled()` is the Cases-Extras wrapper (raises `23514` when
  `cases_extras` is OFF); `public.cases_extras_enabled()` is the DEFINER boolean read the
  R1 direct-table-write actions call to gate the flag from TS.
- **Case-model adjustments (ADR 0024):** `app.recompute_case_status(case)` — **DEFINER**; the
  single authority for the three auto-computed statuses (any phase `ativa`→`em_revisao`; else
  ≥1 `concluida`→`pendente`; else `nao_iniciado`), early-returns on a terminal case (never
  overrides the manual `concluido`/`cancelado`, D6), writes only on change under
  `app.in_case_rpc`. `app.trg_recompute_case_status()` backs the **AFTER INSERT OR UPDATE OF
  status ON `case_phases`** trigger (`recompute_case_status_trg`; no DELETE event — avoids the
  case-cascade hazard; writes `cases` only → depth-1). The TS twin of the terminal check is now
  **`isTerminalCaseStatus(status)` in `@/lib/cases/case-status`** (a pure fixed-union check; the
  old `caseStatusIsTerminal(defs,key)` + the R2 `case_status_is_terminal`/`apply_case_status`/
  `case_terminal_key`/`slugify_status_key`/`unaccent_fallback` are gone). `app.guard_phase_blocks_shape()`
  — BEFORE INS/UPD on both phase tables, asserts `blocks` is earlier-positions-only (→ HC016).
  `app.validate_template_phase_blocks(template, position, blocks)` — DEFINER deep validity
  (every referenced position exists in the template; → HC016). `app.guard_process_template_outcome()`
  — BEFORE INSERT on `process_template_outcomes`, asserts outcome+template share a commission
  (→ **HC030**).
- **Cases-Extras (R3/R4):** `app.guard_case_tag_assignment()` — BEFORE INSERT trigger asserting
  tag+case share a commission (HC026). `app.advance_action_item_core(item, status)` — DEFINER
  gated mutation (assignee OR staff_admin → HC027; stamps `completed_*` on `done`).
- **Phase 7 (cases):** `app.commission_of_template(id)` / `app.commission_of_case(id)` —
  definer, mirror `commission_of_version` (drive RLS + definer reads).
  `app.case_phase_answer_map(case_phase)` — **definer, SUBMITTED-ONLY** `question_key→value`
  for ONE phase; returns `'{}'` for an in-progress/skipped source (the single cross-member
  answer surface; the Phase-7 invariant — tested, do not relax). `app.published_version_of_form`,
  `app.version_has_input_key`, `app.validate_template_recommend_when`,
  `app.is_member_of_for(commission, user)` (arbitrary-user membership, for assignee checks).
- **Phase 8 (dashboards):** `app.submitted_form_responses(form)` — the canonical "dashboard-countable"
  response-id set (`status='submitted' AND case_phase_id IS NULL AND form_id=…`); TS twin
  `isDashboardCountable` in `dashboard.ts` (ADR 0020). `app.latest_published_version(form)` — labels/
  sections for cross-version aggregation.

## Feature flags (`app.feature_flags`)

| Flag | State | Notes |
| ---- | ----- | ----- |
| `signoff_enforcement` | **ON** (Phase 6, migration `…090001`) | `submit_response` blocks submission until every VISIBLE `requires_signoff` section is signed → **P0012**. Was OFF in Phases 1–5 (ADR 0004). |
| `cases_multi_phase` | **ON** (Phase 7, migration `…090008`) | Gates every Phase-7 cases RPC. Inserted OFF in `…090004`; flipped ON by the separate one-line `…090008` (mirrors the `signoff_enforcement` flip). The feature is live. |
| `cases_extras` | **ON** (Extras, migration `…092006`) | Gates the Cases-Extras + outcome WRITE surface: the **OUTCOME** RPCs (`set_case_outcome`, `set_process_outcomes`, outcome vocab CRUD — ADR 0024); R3 tag CRUD/assign; R4 action-item authoring + lifecycle; R1 document/event actions via `cases_extras_enabled`. (The R2 `set_case_status` + status CRUD it formerly gated were REMOVED by ADR 0024.) Inserted OFF in `…092001`; flipped ON by `…092006`. The core phase RPCs (`activate_phase`/`skip_phase`/`add_ad_hoc_phase`/`reassign_phase`/`close_case`/`cancel_case`/`create_case_from_template`/`set_template_phase_blocks`) gate ONLY `cases_multi_phase`. |

## RLS authorization surface (who can do what)

- **Builder mutation surface** — `forms`, `form_versions`, `form_sections`,
  `form_items` grant ALL to `staff_admin` of the commission + admin. Published
  immutability is **trigger-enforced**, not RLS. Draft edits need no new RLS.
- **Responses/answers** — creator alone reads/edits their `in_progress` response +
  answers. One draft per (version, user) via `responses_one_draft_per_user_idx`.
  Submitted responses/answers/signoffs are immutable (triggers). **Staff_admins
  deliberately CANNOT read another member's in_progress answers** via general RLS —
  the Phase-7 invariant; the sign-off queue/review uses the DEFINER RPCs above instead.
- **Sign-offs** — `signoffs_insert` enforces the signer-role rule in the DB
  (respondent → `created_by`; staff_admin → `is_staff_admin_of`, `signed_by =
  auth.uid()`, in_progress only). `signoffs_select` lets creator/admin/staff_admin read.
- **Storage** (`form-assets`) — members read, staff_admin upload; no UPDATE/DELETE
  (immutable paths). Service role never used on the display/upload path.
- **Cases-Extras + outcome child entities** — `case_documents`, `case_events`, `case_tags`,
  `case_tag_assignments`, `case_action_items`, and (ADR 0024) `case_outcomes` (direct
  `commission_id`), `process_template_outcomes` (via `app.commission_of_template`),
  `case_offered_outcomes` (via `app.commission_of_case`) all grant member-READ / staff_admin-WRITE.
  (`case_status_defs` was DROPPED — ADR 0024.) An action-item ASSIGNEE who is a plain staff member
  does NOT get a broad UPDATE — they move status only via the narrow `advance/complete_action_item`
  DEFINER RPC (assignee-or-staff_admin gate). Document "delete" is a SOFT delete (row hidden, object
  retained); reads filter `deleted_at is null`.
- **Storage** (`case-documents`) — members read, staff_admin INSERT; NO UPDATE/DELETE
  (immutable, Rule 6). Path `{commission_id}/{case_id}/{uuid}.{ext}`; `foldername[1]` = commission.
  Reads via signed URLs (cookie client). 25 MiB, MIME allow-list (PDF/images/Word/Excel/CSV/plain).
- **Submitted cross-member read (Phase 8)** — `responses_select`/`answers_select` ALREADY grant a
  staff_admin read of ANOTHER member's `status='submitted'` response+answers (the dashboard/
  submissions browser path); `in_progress` stays creator-only. **No Phase-8 RLS change** — the
  Phase-7 in_progress-answers invariant is preserved at every dashboard/list/detail/export path.
- **Anon grants (Phase 8 B6)** — `anon` now has **zero** DML/EXECUTE on `public` (revoked from anon
  AND the implicit PUBLIC role; durable default-privilege revoke). `authenticated`/`service_role`
  retain explicit grants. pgTAP guards "zero anon-executable public functions".

## SQLSTATE → meaning (data-layer maps these to pt-BR; no raw PG errors reach the UI)

The CUSTOM codes use the `HC0xx` class ("Hospital Commission"), renumbered from `P00xx` in
migration `…090009` so PostgREST 14 returns **400 + JSON `{code,message}`** (unknown class)
rather than a 500 that drops the body for non-ASCII messages (ADR 0018). The standard codes
(`P0002` no_data_found → 404, `23505`, `23514`, `42501`) are unchanged.

| Code | Meaning | Example pt-BR mapping |
| ---- | ------- | --------------------- |
| `P0002` | not found | "Resposta não encontrada." |
| `HC010` | already submitted | "Resposta já enviada." |
| `HC011` | required answer missing | "Há perguntas obrigatórias sem resposta." |
| `HC012` | sign-off pending | "Há seções pendentes de assinatura." |
| `HC013` | invalid cross-version item/section | "Dados inválidos para este formulário." |
| `HC014` | section not available / not visible | "Seção não disponível para assinatura." |
| `HC015` | already signed (unique race) | "Seção já assinada." |
| `HC016` | invalid template / recommend_when (from_phase / absent key / referenced slot) | "A condição de recomendação é inválida." |
| `HC017` | form has no published version | "O formulário desta fase ainda não foi publicado." |
| `HC018` | phase blocked by its blockers (ADR 0024; reworded from "not sequentially activatable") | "Conclua ou marque as fases que bloqueiam esta antes de ativá-la." |
| `HC019` | phase wrong state | "Esta fase não está no estado necessário para esta ação." |
| `HC020` | case not open (terminal) | "Este caso não está aberto." |
| `HC021` | assignee not a member | "O responsável deve ser membro da comissão." |
| `HC022` | caller not the assignee | "Apenas o responsável pode preencher esta fase." |
| `HC023` | template not in an archivable state | "Este processo não pode ser arquivado." |
| `HC024` | ~~invalid case status key~~ **RETIRED** (ADR 0024 — the configurable status vocab was removed; status is now a fixed CHECK enum) | — |
| `HC025` | case already in a terminal status (frozen) | "Este caso está em um estado final e não pode mais ser alterado." |
| `HC026` | tag/case commission mismatch | "Esta etiqueta não pertence à comissão deste caso." |
| `HC027` | not entitled to update this action item | "Você não pode alterar este item de ação." |
| `HC028` | conclude: process offers outcomes but none chosen (ADR 0024) | "Selecione um desfecho antes de concluir o caso." |
| `HC029` | outcome not in the case's frozen offered set (ADR 0024) | "Este desfecho não está disponível para este caso." |
| `HC030` | process/outcome commission mismatch (ADR 0024) | "Este desfecho não pertence à comissão deste processo." |
| `HC031` | conclude: unsettled (pendente/ativa) phases remain (ADR 0024) | "Conclua ou marque todas as fases antes de concluir o caso." |
| `23514` | check violation | "Publique um rascunho." / "já enviada." / "recurso indisponível" (context) |
| `23505` | unique violation | (resume race; question_key collision retry) |
| `42501` | RLS denied | forbidden (e.g. wrong signer role) |

## Data-access & action modules (Rule 9 — no inline supabase-js in UI)

- Queries: `src/lib/queries/{session,commissions,members,forms,responses,signoffs,
  process-templates,cases}.ts` + the canonical helpers `answerableItems(tree)` and the
  submitted-responses filter. Cases: `listProcessTemplates`/`getProcessTemplate`;
  `listCasesBoard`/`getCaseDetail` (definer RPCs) + `getCasePhaseForFill` (RLS-scoped).
- Actions: `src/lib/{auth,admin,members,forms,responses,process-templates,cases}/actions.ts`
  — `ActionState` shape, server-side authz re-check before write, pt-BR mapping.
- Domain types: `RecommendWhen = { from_phase } & VisibleWhen` is the only Phase-7 addition
  to `conditions.ts` (additive; evaluator/mirror/vectors UNCHANGED).
- **Phase 8:** `src/lib/queries/dashboard.ts` (`getFormDashboard`/`listDashboardForms`/`getCommissionOverview`/
  `getFormExport`/`isDashboardCountable`) + `src/lib/queries/submissions.ts` (`listSubmissions`/
  `getSubmissionDetail`/filter lists). CSV route handler `src/app/c/[slug]/dashboard/export/route.ts`
  (staff_admin/admin-gated, cookie client — no service role).
- **Cases-Extras:** Queries `src/lib/queries/{case-documents,case-tags,case-action-items}.ts`
  (`listCaseDocuments`/`getCaseDocumentDownloadUrl`/`listCaseEvents`; `listCaseTags`/
  `listCaseTagsForCase`/`getCaseTagReport`; `listCaseActionItems`/`getCaseActionItemKpis`).
  Actions `src/lib/cases/{documents-actions,tags-actions,action-items-actions}.ts` + the shared
  `src/lib/cases/extras-gate.ts` (`casesExtrasEnabled`). NOTE: `deleteActionItem` is a HARD delete;
  cancel = `advanceActionItem(id,'cancelled')`.
- **Case-model adjustments (ADR 0024):** **`src/lib/cases/case-status.ts`** is the fixed-status
  source of truth — `CaseStatus` (fixed 5-value union, NOT `CaseStatusKey = string` anymore),
  `CASE_STATUSES` (board order), `CASE_STATUS_META` (pt-BR label + colour token),
  `isTerminalCaseStatus`, and the re-homed `CaseStatusColorToken` (the shared palette, also used by
  tags/outcomes). Outcomes: queries `src/lib/queries/case-outcomes.ts` (`listCaseOutcomes(commission,
  includeArchived?)` / `listProcessOutcomes(template)`) + actions `src/lib/cases/outcomes-actions.ts`
  (`setCaseOutcome` / `createCaseOutcome` / `updateCaseOutcome` / `reorderCaseOutcomes` /
  `archiveCaseOutcome` / `setProcessOutcomes`). Blockers: `setTemplatePhaseBlocks(phaseId, blocks[])`
  in `src/lib/process-templates/actions.ts`. `cases.ts` `Case` gains `outcomeId`, `CasePhase` gains
  `blocks: number[]`, `CaseDetail`/board rows gain resolved `outcome` + `offeredOutcomes`;
  `process-templates.ts` `ProcessTemplatePhase` gains `blocks`, `ProcessTemplate` gains
  `offeredOutcomeIds`. **REMOVED:** `src/lib/queries/case-statuses.ts` + `src/lib/cases/status-actions.ts`
  (the R2 configurable-status modules).
- Service-role client: `src/lib/supabase/admin.ts` (`import 'server-only'`), invite path only.

## ADR index (decisions that shape the backend)

0002 admin claim hook · 0003 pgTAP · 0004 sign-off flag · 0005 visible_when shape ·
0009 JWT local verification (prod needs asymmetric keys) · 0010 email denorm ·
0011 reorder · 0012 clone-returns-existing-draft · 0013 form_versions insert RLS ·
0015 response-fill RPCs · 0016 sign-off definer read path · 0017 multi-phase cases ·
0018 custom SQLSTATE class `HC0xx` · 0019 default section may carry title ·
0020 dashboard-countable responses · 0021 case-phase due dates ·
0022 cross-committee referrals (proposed/deferred) · 0023 configurable per-committee case status
(**superseded by 0024**) · 0024 case-model adjustments (fixed auto-computed statuses + phase
blocking + outcomes).

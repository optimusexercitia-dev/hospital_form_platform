# Backend State — the data-access surface

> Part of `docs/backend-state/` — **start at [`README.md`](README.md)**, which routes you to the
> one file you need and carries the maintenance rules in full. ⛔ A posted section is FROZEN:
> correct it by APPENDING a `⚠ **Superseded** — … See <file> § <heading>.` marker, never in place.

## Current state

**Updated:** 2026-09-09 — a REPLACEABLE projection of the frozen slices below; the rules that govern it are [`README.md` § Maintenance rules](README.md#maintenance-rules) 7–8.

### Surface

- **The four registries are GENERATED, not maintained** — derived from the live catalog and from
  `src/` by [`scripts/gen-data-access-surface.mjs`](../../scripts/gen-data-access-surface.mjs), whose
  catalog grammar has ONE home in
  [`scripts/data-access-census.sql`](../../scripts/data-access-census.sql); rebuild with
  `npm run data-access:surface`. ⛔ A correction belongs in the GENERATOR or in the catalog, never in
  a generated file: an edit there is erased by the next run and gated in the meantime.
- **`public` RPCs** → [`generated-rpc-surface.md`](generated-rpc-surface.md). **`app` helpers,
  predicates and trigger functions** → [`generated-helper-surface.md`](generated-helper-surface.md).
  Each row carries the same facts: arguments, return type, `prosecdef`, volatility and EXECUTE
  grants.
- **Feature-flag keys**, each key's `FeatureFlags` field and the readers that resolve it →
  [`generated-feature-flags.md`](generated-feature-flags.md); both drift polarities are derived — a
  live key with no typed field, and a typed field naming no live key.
- **Rule-9 query and action modules** and what each exports →
  [`generated-query-modules.md`](generated-query-modules.md); the population is a DIRECTORY WALK
  bound to the naming property, never a hand-list.
- **What stays handwritten here is what a catalog cannot hold**: what a door is FOR and which of its
  arms is load-bearing (§ RPC inventory's notes column); the helper GRAIN, `confidentiality_rank`'s
  ordering, `can_read_case_or_admin`'s "ORing the admin arm OUTSIDE the DEFINER out-votes the deny",
  and every SQL↔TS mirror whose drift is phase-blocking
  (§ Helper functions); each flag's **production** claim (§ Feature flags); why a module seam is
  where it is (§ Data-access & action modules). Each of the four frozen headings carries a forward
  marker naming its generated file and stating what is superseded (the inventory) and what is not.

### Invariants

- **Architecture Rule 9 — data access goes through these modules; no inline supabase-js in UI.**
  ⚠ Presence in the generated registry is **not a Rule-9 audit**: it answers "which module owns this
  query", and a module appearing there is not evidence that nothing bypasses it.
- **The condition evaluator is mirrored SQL ↔ TS.** `app.eval_condition` has the TypeScript twin
  `evalCondition` in `src/lib/queries/conditions.ts`, kept in agreement by the shared vector file
  `src/lib/queries/__fixtures__/condition-vectors.json`; **drift is phase-blocking.** § Helper
  functions names the other dual evaluators and parity-tested twins under the same rule.
- **A NULL `proacl` is rendered `<NULL=PUBLIC>` and means PUBLIC MAY EXECUTE** — it is the default,
  not an absence of grants. Reading it as "no grants" inverts the fact.
- **A `definer` row's gate REPLACES RLS**, so its EXECUTE list is the whole boundary: `prosecdef`
  belongs beside `pg_policies`, never read alone (ADR 0078, ADR 0079).
- **"The doc matches the catalog" is TWO composable halves, and neither alone is the verdict.**
  `npm run lint:data-access` (gate 17) reds when a generated file and its pgTAP pin disagree — text
  only, no database — and
  [`supabase/tests/400_data_access_census.sql`](../../supabase/tests/400_data_access_census.sql), in
  `npm run test:db`, reds when the pin and the catalog disagree.

### Rollout

- ⛔ Resolve each flag's VALUE, its `FeatureFlags` field and its readers from
  [`generated-feature-flags.md`](generated-feature-flags.md), never from a sentence here.
- ⛔ **The generated `local` column is NOT production.** `supabase/seed.sql` forces flags ON for local
  + E2E. Nothing asserts on that column — not gate 17, not the pgTAP mirror — because only a human
  knows whether the flip migration reached the remote, which is why the production claim stays
  handwritten in § Feature flags. Resolve a value in `app.feature_flags.enabled` on the deployment
  you mean, never from a table and never from a comment.

### Open edges

- **Generation covers only what a machine can DERIVE.** What can be proven without a database is
  proven by gate 17 itself; what cannot is NAMED rather than assumed — three states, never two.
- **`Typed readers` is a nearest-preceding-export attribution, not a call graph.** A call inside a
  non-exported helper is attributed to the exported symbol above it, which over-reports reach.
- **The `public` registry is derived from the catalog, not from `src/lib/types/database.ts`** —
  generated types expose only what PostgREST can see, and the gap between the two is itself
  undocumented surface.
- **Only these four registries are generated.** The remaining hand-maintained tables elsewhere in
  `docs/backend-state/` are untouched, as is the follow-up filed against
  `check-service-role-registry.mjs`'s `process.cwd()` resolution — deliberately, being a live
  behaviour change to a gate outside that decision's subject.

### Where the detail lives

- The frozen slices below, in order: **§ RPC inventory** · **§ Helper functions** · **§ Feature
  flags** · **§ Data-access & action modules** (carrying **§ Form-Builder Enhancements batch**).
- The generated registries: [`generated-rpc-surface.md`](generated-rpc-surface.md) ·
  [`generated-helper-surface.md`](generated-helper-surface.md) ·
  [`generated-feature-flags.md`](generated-feature-flags.md) ·
  [`generated-query-modules.md`](generated-query-modules.md).
- ADR [0197](../decisions/0197-data-access-registries-are-generated-not-maintained.md) (the
  registries are generated, and gated in two halves) ·
  ADR [0196](../decisions/0196-backend-state-split-on-the-module-seam-axis.md) (the seam split; a
  posted section is frozen) · ADR [0078](../decisions/0078-authorization-capability-model.md) and
  ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) (the live catalog is the
  truth; `prosecdef` beside `pg_policies`). Architecture Rule 9:
  [`ARCHITECTURE.md`](../../ARCHITECTURE.md).

## RPC inventory

⚠ **Superseded** — the table below is a hand-maintained snapshot which, measured 2026-09-09
against the live catalog, named 169 of the 533 non-trigger `public` functions that exist; the
inventory is now DERIVED from `pg_proc` on every run. ⛔ The *notes* in its third column are
**not** superseded and are not reproduced anywhere else — a catalog knows a signature and an
ACL, not which of a door's arms is load-bearing. Read both.
See generated-rpc-surface.md § The generated function registry.

⚠ **Superseded** — the Phase 8 dashboard row's gate reads `is_staff_admin_of OR is_admin`; no `dashboard_*` function carries an `is_admin` arm. See data-access.md § Extracted from the pre-split stamp chain.

⚠ **Superseded** — the `*_template_phase` row treats `allowed_result_ids` as a live column; it was dropped for three junction tables. See data-access.md § Extracted from the pre-split stamp chain.

All `security invoker` unless marked **DEFINER**. Invoker RPCs rely on RLS as the
authority; definer RPCs are narrow, internally gated exceptions (documented in an ADR).

> ⛔ **DM1 (2026-08-12) dropped every centralized-attachment door** — any `*attachment*`
> row below is HISTORICAL except `add_referral_reply_attachment` and
> `get_referral_attachment_path` (referral-owned, DM4 allowlist). The phase-10/11
> meeting/interview attachment RPCs were already folded away by F2. See §DM1.

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
| `start_or_resume_response(version)` | invoker | Resume existing in_progress **STANDALONE** draft or create; `unique_violation`-catch race; published-only backstop. ⛔ Both the resume branch and the conflict re-read carry `case_phase_id is null` (migration `20261003002000`), mirroring `responses_one_draft_per_user_idx` — without it this door handed the caller's CASE-PHASE draft to the standalone responder route, which refuses that lane (ADR 0136). Pinned red-first: pgTAP `367` §15. |
| `sign_section(response, section, note)` | invoker | Backs BOTH respondent (wizard) and staff_admin (queue) sign. RLS `signoffs_insert` enforces signer-role; RPC adds visibility + in_progress precondition. Unique-race → **P0015**. |
| `list_signoff_queue(commission)` | **DEFINER** | `is_staff_admin_of`-gated; predicate = visible + unsigned + `staff_admin`-role + submit-ready (`app.response_required_complete`). ADR 0016. |
| `get_response_for_signoff(response)` | **DEFINER** | Narrow read of one in_progress response with a pending staff_admin sign-off. Does NOT broaden `responses_select` (preserves Phase-7 invariant). ADR 0016. |
| **Phase 7 — cases (all gate `cases_multi_phase`):** | | |
| `create_process_template` / `archive_process_template` / `publish_process_template` | invoker | Template lifecycle. ⚠ **Re-shaped by ADR 0096 — see the `PCI + TV` section.** Lifecycle now lives on `process_template_versions` (`draft→published→archived`), NOT on `process_templates` (which has no `status` column). `publish_process_template` is a thin wrapper over `publish_template_version(app.draft_version_of_template(...))`; `archive_process_template` archives every non-archived version. Publish still requires ≥1 phase + validates every `recommend_when` (P0016/P0017; + ADR 0043 HC063/HC064 for result-conditions). |
| `clone_template_version(source)` / `publish_template_version(version)` / `discard_template_draft(version)` / `draft_version_of_template(template)` | invoker | **New in ADR 0096.** Version lifecycle. `clone` is idempotent (returns the existing draft). Publish: draft-only, ≥1 phase (HC016), archives the prior published version. Status flips are trigger-gated on the GUC `app.in_template_publish_rpc` — see `PCI + TV`. |
| `add_template_phase` / `update_template_phase` / `reorder_template_phase` / `remove_template_phase` | invoker | ⚠ **All take `p_template_version_id` since ADR 0096.** Slot CRUD + adjacent-swap reorder (deferrable unique) + renumber; re-validate `recommend_when` via group-aware `app.validate_template_recommend_when` (HC016; ADR 0043: **HC063** result-condition on a non-emitting source slot · **HC064** result id outside the source's `allowed_result_ids` / archived / out-of-commission). Draft-only. As of ADR 0024: `add/update_template_phase` gain a trailing `p_blocks` (`+p_clear_blocks` on update); `reorder/remove` also **remap the `blocks` arrays** across the renumber (single atomic UPDATE per row; HC016 on a dangling/forward ref). |
| `set_template_phase_blocks(phase, blocks[])` | invoker | (ADR 0024) Set a slot's EARLIER-phase blockers (D1). Draft-only; validates earlier-only + position-exists (HC016) via `app.validate_template_phase_blocks`. Gates `cases_multi_phase`. |
| `create_case_from_template(p_template_id, label?, department?, department_other?, case_type?, custom_fields?)` | **DEFINER** | Still takes a **template** id and resolves the version internally via `app.published_version_of_template` (ADR 0096); `bulk_create_cases` does the same. `is_staff_admin_of`-self-gated. Mints case (per-commission number trigger, bounded retry; status defaults to `nao_iniciado`), snapshots slots → `case_phases` pinning each form's published version (HC017), copies+revalidates `recommend_when` via group-aware `app.validate_template_recommend_when` (HC016/HC063/HC064; ADR 0043), **snapshots `blocks`** + copies `process_template_outcomes`→`case_offered_outcomes` (ADR 0024), initial recompute. |
| `activate_phase(phase, assignee, due_date?)` | invoker | (ADR 0024) **Blocker gate** (HC018, reworded "blocked by phases") replaces strict-sequential: rejected while any phase it `blocks` is not yet `concluida`/`nao_necessaria`; **parallel-safe** (empty blocks activates freely, multiple phases may be `ativa`). + pendente (HC019) + case non-terminal (HC020) + assignee member (HC021); sets `due_date` under `app.in_case_rpc`. |
| `skip_phase(phase)` | invoker | `pendente→nao_necessaria` (HC019/HC020); recompute. |
| `add_ad_hoc_phase(case, form, …)` | invoker | Append (`is_ad_hoc`) on a non-terminal case (HC020), pin published version (HC017), validate recommend_when (HC016). |
| `add_ad_hoc_narrative(case, narrative_type?, new_type_label?, title?, instructions?, assigned_to?)` | **DEFINER** | Append a narrative (`is_ad_hoc=true`, `status='aberta'`) to an OPEN case (ADR 0047), mirroring `add_ad_hoc_phase`. Narratives-flag gate → terminal HC020 → coordinator 42501 → type from vocabulary or inline create-or-reuse (`on conflict(commission_id,label) do update … archived=false` — un-archives) / cross-commission HC054 → `display_position`=max over the phases+narratives interleave → non-member assignee HC021. `body_md`/`title`/`instructions` never audited (Rule 11). |
| `reassign_phase(phase, assignee, due_date?)` | invoker | Change assignee only before a response exists (HC019); member check (HC021); case non-terminal (HC020). |
| `start_or_resume_phase(phase)` | invoker | Assignee-only (HC022), phase ativa (HC019); uses the PINNED version (**skips** the published-only backstop); one-response-per-phase race catch. |
| `recompute_recommendations(case)` | **DEFINER** | Flags `recommended` on pendente phases. As of ADR 0043 (`…630000004`) `recommend_when` is a **combinable group** (`{match:all\|any, conditions:[…]}`, legacy single still valid) of answer- AND/OR result-conditions; walks the group and per condition evaluates the UNCHANGED `app.eval_condition` over a **synthetic map** — answer → `case_phase_answer_map(source)` (submitted-only); result-specific → `{__phase_result__:<result_id>}` (absent ⇒ no result); result-adverse → `{__phase_result_adverse__:<bool>}`. Folds all→AND/any→OR. Suggestion-only (only the `recommended` flag); also re-run by `set_case_phase_result_override` when a **concluded** phase's effective result changes. TS mirror `evalRecommendation` in `conditions.ts`. |
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
| `set_process_outcomes(p_template_version_id, outcome_ids[])` | invoker | The draft builder's offered-set persistence (D15). ⚠ **Takes a VERSION id since ADR 0096** (it was `DROP`+`CREATE`d for the rename — one of the 10 doors whose ACL reset; see `PCI + TV`). Draft-only; delete-then-insert `process_template_outcomes`; same-commission guard → **HC030**; `[]` offers none. |
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
| **Phase 10 — meetings (all gate `meetings`; ADR 0025):** | | |
| `create_meeting` / `update_meeting` | invoker | Header + scheduling; edit only while agendada/realizada; mint retry on unique. |
| `mark_meeting_held` / `conclude_meeting` / `reopen_meeting` / `distribute_meeting` / `cancel_meeting` | invoker | Lifecycle under `app.in_meeting_rpc`. conclude (realizada\|agendada → em_assinatura): ≥1 present (**HC034**), snapshot quorum (members only — guests excluded), write `case_events` kind='meeting' per linkage. reopen (em_assinatura\|assinada → realizada): **revokes** signatures. Cancel blocked on `assinada`. |
| agenda/attendee CRUD, `reorder_meeting_agenda_item`, `seed_expected_meeting_attendees`, `link_meeting_case` / `unlink_meeting_case`, attachment insert + soft-delete | invoker | Child authoring; blocked once parent ≥ `em_assinatura` (child-lock trigger). `meeting_cases` same-commission guard → **HC032**. |
| `sign_meeting(attendee, note?)` | **DEFINER** | Signs the caller's own present-platform-attendee row; re-checks `app.can_sign_meeting` (a DEFINER fn bypasses RLS) → **HC036**; double-sign → **HC035**; computes `content_hash`; **auto-flips em_assinatura→assinada** when all required signatures present (RPC-side, not a trigger). |
| `my_pending_meeting_signatures()` | **DEFINER** | Caller's em_assinatura meetings where they are a present platform attendee with no active signature (drives the "Pending Signatures" badge). |
| `create/update/advance/complete/delete_meeting_action_item` | invoker | Mirror case action items; advance gated assignee-or-staff_admin → **HC037**. |
| `create_meeting_type` / `rename_meeting_type` / `archive_meeting_type` / `update_meeting_settings` | invoker | F5 settings; `is_staff_admin_of`-gated; `unique(commission,name)` → 23505. |
| **Phase 11 — interviews (all gate `interviews`; all **DEFINER**; ADR 0026; **revised by IV2 2026-07-14, ADR 0070 — `interview_sessions` 1:N, `HC0B0-2`; status keys ENGLISH (D11): `draft/scheduled/in_progress/awaiting_follow_up/completed/cancelled`; detail → [iv2-interviews.md](../progress/iv2-interviews.md)**):** | | |
| `create_interview(case, title?, phase?, category, confidentiality='standard')` | **DEFINER** | **IV2:** drops all scheduling args; **requires `interview_category`** (→ **HC0B1**); `confidentiality_level` **non-enforcing** (default `standard`). Bootstrap = staff_admin/admin only (42501); derives `commission_id`; mint retry; `status='draft'`. |
| `update_interview` / `update_interview_summary` | **DEFINER** | Header (title/phase/category/confidentiality) / `summary_md` edit; `app.assert_interview_writable` (→ **HC039**); rejected once completed/cancelled (**HC038**). Emits `interview.confidentiality_changed` on level change. |
| `conclude_interview` / `reopen_interview` / `cancel_interview` (interview-level) | **DEFINER** | Under `app.in_interview_rpc`, writable-gated. **IV2: `schedule_interview`/`start_interview` DROPPED** (scheduling → sessions). conclude precondition widened to `{in_progress, awaiting_follow_up}` + ≥1 subject (**HC041**); recomposes the single `case_events kind='interview'` registry row from session actuals (no dup on re-conclude). `cancel_interview` cascades non-terminal sessions → cancelled BEFORE the parent flip. `cancelled` TERMINAL (only `completed` reopens). Wrong state → **HC038**. |
| **session RPCs (IV2, NEW; on `public.interview_sessions` 1:N):** `schedule_session` · `update_session` · `start_session` · `complete_session(session, actual_end=now)` · `cancel_session`/`no_show_session(session, reason)` | **DEFINER** | Writable via `app.assert_session_writable` (→ **HC039**). Reason persists on `interview_sessions.cancellation_reason` only; audit payloads structured-keys-only since `20260826000000` (Rule 11/LGPD). `sequence_number=max+1`; `schedule` precond interview ∈ {draft,scheduled,in_progress,awaiting_follow_up} (**HC0B0**), flips draft→scheduled. `start`→in_progress + `actual_start`. `complete`→completed, derives interview→`awaiting_follow_up` iff another `scheduled` remains (side-effect, not a trigger). cancel/no_show terminal + reason (never hard-delete). All emit `interview.session_*` via `app.audit_write`. |
| subject CRUD (`add/update/remove_interview_subject`), interviewer CRUD (`add/update/remove_interview_interviewer`) | **DEFINER** | Writable-gated; member XOR external; a REGISTERED interviewer must be a commission member → **HC021**. **IV2:** subject `relationship_to_case` **required** (→ **HC0B2**; excludes patient/family — staff-only). Locked once parent completed/cancelled (child-lock 23514). |
| `add_interview_attachment(interview, kind, title, storage_path?, external_url?, mime?, size?)` / `delete_interview_attachment` | **DEFINER** | Writable-gated; storage_path XOR external_url + https → **HC040**; soft-delete. NOT child-locked (late signed transcript). |
| `interview_viewer_can_write(interview)` | **DEFINER** | Thin read of `app.can_write_interview(interview, auth.uid())` — the query layer's `viewerCanWrite` signal (the `app` helper is not PostgREST-callable). |
| `interviews_enabled()` | **DEFINER** | TS-layer flag read (mirror `meetings_enabled`). |
| **Phase 14a — patient-safety/NSP (all gate `patient_safety`; all **DEFINER**; ADR 0030/0031):** | | |
| `notify_safety_event(reporting_commission, title, desc_md?, suspected_harm?, discovered_at?, location?, case?)` | **DEFINER** | **Any member** of the reporting commission (just-culture; non-member → 42501) — NOT a role gate; mints `EV-%04d`; writes a `case_events kind='safety_event'` when case-linked. Returns the row (`.id`/`.code`). |
| `acknowledge_event` / `update_event` / `cancel_event` | **DEFINER** | NSP custody ops under `app.in_safety_rpc`; state machine (**HC043**); `acknowledge` stamps who/when. |
| `transfer_event_custody(event, to_kind, to_commission?)` | **DEFINER** | Append-only custody hand-off — closes the open interval, appends a new one, updates the denormalized owner; only the **current custodian** (or PQS/admin) may transfer → **HC044**. |
| `set_event_patient(event, …PHI…)` | **DEFINER** | Writes the isolated `event_patient` row (PHI). The query layer's `getEventPatient` read is the audited path (`event_patient.read`). |
| `pqs_inbox(status?, priority?, reporting_commission?)` | **DEFINER** | NSP queue — **PHI-FREE** projection (no identifiers); PQS/admin only. |
| `patient_safety_enabled()` | **DEFINER** | TS-layer flag read (mirror `audit_trail_enabled`). |
| **Phase 22 — inter-committee referrals (all gate `case_referrals`; all **DEFINER**; ADR 0037; **revised by RV2·R1 2026-07-14, ADR 0037 Amendment 1 — dialogue thread + `awaiting_information`; `HC0A0`/`HC0A1`; status keys ENGLISH; detail → [rv2-r1-referrals.md](../progress/rv2-r1-referrals.md)**):** | | |
| `create_referral_draft(source_case, target_commission, type, subject, response_expected?)` | **DEFINER** | Source coordinator only (→ **HC071**); target ≠ source; snapshots `type_label`; seeds `response_expected` from the type when NULL. Returns the row (`.id`/`.code`). |
| `update_referral_draft` / `add_referral_shared_item(referral, kind, narrative?, document?)` / `remove_referral_shared_item` | **DEFINER** | Draft-only (`app.assert_referral_draft_writable` → HC071/**HC070**); `add` validates the source belongs to the referral's `source_case_id` + the one-of shape (**HC077**) and freezes the copy. |
| `set_referral_patient(referral, …9-arg PHI…)` | **DEFINER** | Upserts the isolated `referral_patient`; new snapshot needs `can_manage_referral_phi_disclosure`, an amend needs `can_amend_referral_phi_snapshot` (ADR 0078 D7) — **never** `can_read_referral_phi`, read must not imply write; maintains `has_patient`; audited WITHOUT identifiers. ⚠ **DRAFT-ONLY since `20261003001700`** (ADR 0137 Amdt 1, PO ruling 2026-08-24): every non-`draft` status is refused BEFORE the upsert with its own **HC078**, so post-send PHI amendment does not exist and `can_amend_referral_phi_snapshot` governs draft re-saves only. Until then a `sent` referral reached the upsert and was stopped by `app.guard_referral_status`'s **HC070** on the trailing `case_referral` update — an incidental closure, one edit from being reopened. |
| `send_referral` / `withdraw_referral` | **DEFINER** | Source-coord transitions under `app.in_referral_rpc`. send (`rascunho→enviada`) freezes the snapshot + requires ≥1 item or a description; withdraw (`→retirada`) resolves the close-gate. |
| `receive_referral` / `accept_referral` / `decline_referral(referral, note?)` / `start_referral_review` | **DEFINER** | Target-coord transitions (`app.assert_referral_target_acts` → **HC072**/HC070). decline (`→recusada`) resolves the close-gate. |
| `link_referral_case(referral, target_case?)` | **DEFINER** | Target-coord; the case must belong to the target commission (→ **HC079**); this is how B's analyst earns PHI access (`referral_target_analyst`). NULL clears the link. |
| `add_referral_reply_attachment` / `conclude_referral(referral, outcome?, result_md?, acknowledged_only?)` | **DEFINER** | Target-coord. conclude (`em_analise→concluida`) writes + freezes `referral_reply`; when `response_expected`, `result_md`+`outcome` are REQUIRED (→ **HC075**); a no-reply referral may conclude `acknowledged_only`; invalid outcome → **HC074**. |
| `get_referral_detail(referral)` → jsonb | **DEFINER** | **Audited door.** Re-gates `can_read_referral` (P0002 out of scope); serves PHI free-text (`frozen_body_md`/`result_md`/`description_md`/`decline_note` + **RV2·R1** the `messages[]` thread `body`) ONLY to a `can_read_referral_phi` reader, nulls otherwise; emits `referral.viewed` on a body-serve to a non-source-coordinator (incl. QPS). **RV2·R1** also returns `waiting_on_committee_id`, `last_message_at`, and the PHI-free compose-authority flags `can_compose_as_source` (=`is_staff_admin_of(source)`) / `can_compose_as_target` (=`is_staff_admin_of(target) OR referral_target_analyst`) — byte-for-gate parity with the R1 write RPCs. |
| **RV2·R1 dialogue (NEW; migs `20260720000900`–`…000940`):** `post_referral_message` · `request_referral_information` · `provide_referral_information` | **DEFINER** | On `public.referral_messages` (thread; `body` **PHI — Option B**: row RLS `can_read_referral_phi` + column-REVOKE `body` → body served only via the door, stricter than the siblings; DML revoked, writes RPC-only + `FOR UPDATE` parent + `guard_referral_message` sender∈{source,target} + t19). `post` = general/clarification comment (**HC0A0**; rejects the state-driving types — QA M-1); `request` (target coord/analyst) → posts `information_request`, `status=awaiting_information`, `waiting_on=source` (**HC0A1** wrong-status); `provide` (source coord) → `information_response`, `status=in_review`, `waiting_on=target`. All emit `referral.message_created` via **`app.audit_write`** (mutation trail, NOT `log_audit_access`). `case_referral += waiting_on_committee_id`/`last_message_at` (both `authenticated` column-granted — `…000930`); status +`awaiting_information`. **`close_case` corrected** to block `awaiting_information` (HC076 inclusion list). `dispose_referral_phi` purges message `body`. |
| `get_referral_patient(referral)` → jsonb | **DEFINER** | **The SINGLE audited PHI-identifier door** (`referral_patient` SELECT is REVOKED). Re-gates `can_read_referral_phi`; NULL out of scope / no PHI (no audit row); emits `referral_patient.read` (empty metadata, source-commission-attributed) on a real entitled read. Mirrors `get_event_patient`. |
| `get_referral_snapshot_document_path(item)` / `get_referral_attachment_path(attachment)` → text | **DEFINER** | Re-gate `can_read_referral_phi` + audit (`referral.viewed`), return the authorized storage path; the **cookie client** then signs it (snapshot docs ride the `case-documents` snapshot OR-term; **no service-role**). NULL out of scope. |
| `list_referral_target_commissions(source_commission)` | **DEFINER** | The wizard's target picker — every commission except the source (id+name, PHI-free); source-coord/admin-gated (→ HC071). |
| `referrals_enabled()` / `is_pqs_member_self()` | **DEFINER** | TS-layer flag read; and the duty-separation probe gating the QPS dashboard data layer (`listAllReferrals`/`referralFlowMetrics` return nothing to a non-PQS caller). |
| `list_my_action_items(commission)` → jsonb | **DEFINER** | Self-scoped (`assigned_to = auth.uid()`) union of the caller's `case_action_items` (flag `cases_extras`) + `meeting_action_items` (flag `meetings`) for one commission; ALL statuses; a flag-OFF source is OMITTED (no error); joins parent case/meeting for PHI-FREE label cols + `created_by` name; default order due_date asc nulls last, created_at desc. No audit row (own items). |
| `get_member_overview(commission)` → jsonb | **DEFINER** | Self-scoped "Visão Geral": 5 counts + 2 hints in one round-trip — cases-not-concluded (PERSONAL rule; attribution counts regardless of a `case_access_grants` grant — the grant leg is always evaluated now the `case_access` flag is retired), pending action items (+overdue), meetings-not-concluded (attendee-scoped, +next start), pending signatures (mirrors `my_pending_meeting_signatures`), own `in_progress` responses. Flag-dependent counts → 0/null when off (never raise). No audit row (own aggregates). |
| **Layout batch — coordinator "add existing member" (migration `20260705000000`):** | | |
| `list_addable_commission_members(commission, search?)` → table(user_id, full_name, email) | **DEFINER** | Coordinator-gated (`is_staff_admin_of(commission)` OR `is_org_admin_of_commission(commission)`; anyone else → empty set, never an org-roster leak). Returns ACTIVE profiles anchored to the commission's ORGANIZATION who are NOT already members, excluding platform (vendor) `is_admin` accounts. ⚠ **The anchor was `pr.home_organization_id = v_org_id` until AE2.2; it is now an `exists` on `organization_affiliations` with `ended_on is null AND voided_at is null`** — the old form carried **no affiliation filter of any kind** and so listed a fully offboarded person as addable. ⛔ **ACTIVE here, deliberately unlike `app.person_known_to_org`'s non-voided**: an ended row retains administrative authority (ADR 0163) but never membership eligibility (bound 3); optional `search` ILIKEs name/email; ordered name-then-email, `limit 500`. The ONLY path a staff_admin reads the org roster (no blanket `profiles` SELECT under RLS) — minimum-necessary + DB-side gated. The invite-brand-new-user-by-email path was removed from the coordinator flow (new people are registered by an org_admin via `registerUser`). Grants: `authenticated` + `service_role`; owner `postgres`. |

| **Phase 15 — quality indicators (all gate `quality_indicators`; all **DEFINER**; ADR 0057/0058):** | | |
| `create_indicator` / `update_indicator` / `archive_indicator` | **DEFINER** | Authoring gate `is_staff_admin_of OR is_tenancy_admin_of` (RLS posture-(b): no direct write); per-commission `IND-%04d` mint; `derived_config` validated à la `version_has_option_code`; **manual `taxa` allowed**. → **HC084** (config)/**HC085** (is-manual)/**HC086** (is-derived). |
| `set_indicator_target(indicator, target, comparator, direction)` | **DEFINER** | Retarget + reclassify the latest measurement across both directions. |
| `record_indicator_measurement(indicator, period, numerator, denominator?, note?, period_start?, period_end?)` | **DEFINER** | Manual entry; computes `value` + off-target detection (both directions); upsert on `(indicator, period)`; audited `.recorded`/`.updated` (note NOT copied into the log). **HC085** on a derived indicator. |
| `compute_derived_measurement(indicator, period, p_denominator := null, p_period_start?, p_period_end?)` | **DEFINER** | Derived/hybrid compute — percentual/contagem via option `code`s, tempo_medio via `answers.value_number`; **equals `dashboard_distributions` for the window** (parity lock); hybrid ONE-STEP (denominator inline) + **preserve-on-recompute** (stored denominator kept when not re-passed → **HC088** on first compute). **HC086** on a manual indicator, **HC087** denom=0. |
| `indicator_series(indicator)` / `indicator_kpis(commission)` | **DEFINER** | Reads gated `is_staff_admin_of OR is_tenancy_admin_of`; foreign-commission → empty. |
| `hospital_indicator_rollup(hospital)` | **DEFINER** | **PHI-FREE** per-commission counts (total/fora/na/sem-dados by latest measurement); gate `is_hospital_admin_of OR is_org_admin_of(org_of_hospital)`; foreign caller → `[]`. ⚠ **The `is_admin` arm was REMOVED 2026-08-05** (`20260908000100`, BUG-AUTHZ-002) — rollups are commission content and the noun rule puts them out of platform_admin's reach. Held by pgTAP `299`. |
| `open_capa_plan(p_source='indicator', p_source_id=indicator, …)` | **DEFINER** | Indicator arm — derives `hospital_id` from the indicator's commission (no manual hospital); **PQS-operator-gated (`can_write_capa` UNTOUCHED**, WS-3c posture). |
| `quality_indicators_enabled()` | **DEFINER** | TS-layer flag read (`qualityIndicatorsEnabled()` also delegates to `get_feature_flags()`). |
| **S1·N — notifications (ADR 0076; all t19 `revoke…public` + grant):** | | |
| `mark_notification_read(id)` | invoker | Own-row set `read_at` (`user_id = auth.uid()`); **HC0C1** if not found/not owned; already-read is an idempotent success. Asserts the flag. |
| `mark_all_notifications_read()` | invoker | Own unread → read. |
| `set_notification_preferences(surface, enabled)` | invoker | Own-row upsert of the per-surface reminder toggle; **HC0C0** on an invalid surface. |
| `compute_due_notifications()` | **DEFINER** | Batch scan over CAPA + sign-off + meeting due/pending state → enqueues via `app.enqueue_notification` (idempotent, prefs-aware). Returns the count of NEW rows. **service_role-only** (NOT `authenticated` — ADR 0076 dec. 8, no manual "run now"; scheduled at pilot deploy); flag-OFF → returns 0 without raising. |
| `list_my_assigned_capa_actions()` | **DEFINER** | Self-scoped (`assignee_user_id = auth.uid()`) list of the caller's CAPA actions for `/conta/itens-de-acao` (BUG-N-001); config-level columns only (id/capa_id/title/owner/action_strength/due_date/status/updated_at) — **PHI-free, Rule 12**; no rca/root-cause/event/patient/plan join. Read-only. |
| `add_case_participant(case, participant, role, is_primary?, involvement?)` | **DEFINER** | E1 / ADR 0072 D6. Coordinator-gated; role↔participant-type check → `HC0E3`; a non-coordinator reader → `HC0E4`; a 2nd live primary → `HC0E7`. `case_participants` stays **SELECT-only** (no write grant exists). |
| `remove_case_participant(cp)` / `set_primary_subject(cp)` / `set_case_participant_role(cp, role)` | **DEFINER** | Same gate/codes; remove is soft (`removed_at`). ⚠ **`set_primary_subject` is no longer set-only** — ETH·E4 `create or replace`d it with **MOVE** semantics (a 2nd set used to raise `HC0E7`) and it now re-runs the linkage assert. See the ETH·E4 section. |
| `create_professional_profile(org, …)` / `update_professional_profile(id, …)` | **DEFINER** | Class-2 writers; `app.can_manage_professional` (admin / org_admin / staff_admin-in-org). **Correction only — NO erasure path** (M2 posture, Rule 12); audited `professional_profile.created`/`.updated` with **no identity payload**. ⚠ **`create_professional_profile` is a BARE INSERT** — no lookup, no `on conflict`. It is *not* get-or-create; `ensure_professional_participant` is the get-or-create door, and it mints the **registry** row from an already-existing profile. Assuming otherwise cost ETH·E4 a QA round (a retry after a failed step 2/3 minted a duplicate, or dead-ended on 23505). |
| `set_case_confidentiality(case, level)` | **DEFINER** | Coordinator; `HC0E5`; the ONLY mutation door for `cases.confidentiality_level`. Emits exactly one `case.confidentiality_changed` (the case audit trigger fires only on a status change). |
| `declare_conflict(case, type, description_md)` | **DEFINER** | Self-service for any case **reader**; `HC0E2` on a duplicate. |
| `record_recusal(case, user, reason_md, declaration?)` | **DEFINER** | Coordinator-or-self. **Reach-gated** (QA MAJOR-2): a caller with no reach gets `P0002 caso não encontrado` — byte-identical to a non-existent case, so it is **not** a case-existence oracle. `HC0E0` on a live duplicate; the target loses read immediately via the deny-term. |
| `lift_recusal(recusal, reason_md)` | **DEFINER** | Coordinator; soft-lift; `HC0E1`; read restored. |
| `set_interview_participant(interview, cp)` (+ `_subject_` / `_interviewer_` variants) | **DEFINER** | E1 D7 fold-in; `can_write_interview` → `HC039`; rejects a participant from another case. |
| `set_interview_confidentiality(interview, level)` | **DEFINER** | Now **enforcing** + 7-value; `HC0E5`; audited `interview.confidentiality_changed`. |
| `record_session_attendance(session, cp, status?, role_at_session?)` | **DEFINER** | Upsert per (session, participant). |

## Helper functions

⚠ **Superseded** — for the INVENTORY only. Which `app` functions exist, with their arguments,
return types, `prosecdef`, volatility and EXECUTE grants, is now derived from the catalog (526
of them; this section names a fraction). ⛔ Everything else here **survives and is
authoritative**: the three-hop `commission_of_template_*` grain, `confidentiality_rank`'s
"do NOT re-order it", `can_read_case_or_admin`'s "ORing the admin arm OUTSIDE the DEFINER
out-votes the m2 deny", and every SQL↔TS mirror whose drift is phase-blocking. None of that is
derivable, and none of it is repeated in the generated file.
See generated-helper-surface.md § The generated function registry.

⚠ **Superseded** — the `app.submitted_form_responses` predicate below omits the SUP successor-exclusion that is in the live body. See data-access.md § Extracted from the pre-split stamp chain.

⚠ **Superseded** — `mint_event_code` is described as taking a global advisory lock; it is per-hospital. See data-access.md § Extracted from the pre-split stamp chain.

⚠ **Superseded** — `app.can_read_case_or_admin` is presented as mandatory for case-scoped admin arms; the function no longer exists. See data-access.md § Extracted from the pre-split stamp chain.

- **FF-3 validation predicates (ADR 0090)** - `app.eval_validation(rule_type, config, value, answers,
  peer_values)` **IMMUTABLE + pure** (the SQL half of the second dual evaluator; TS twin `evalValidation`
  in `src/lib/forms/validation-rules.ts`, locked by `__fixtures__/validation-vectors.json`) *
  `app.item_is_required(required, required_if, answers)` **IMMUTABLE**, total by `coalesce` (visibility is
  NOT consulted - the CALLERS filter by `app.eval_visibility` first, which is what makes "visibility wins"
  structural) * `app.validation_rule_allowed(rule_type, item_type, parent_item_type)` **IMMUTABLE**, total
  by `coalesce(..., false)` (the NULL-returning version admitted forbidden pairs) *
  `app.is_valid_validation_config(rule_type, config)` (every key test resolves the ABSENT case via
  `coalesce(jsonb_typeof(...), 'missing')` - the FF-2 defect-1 fail-open shape) *
  `app.validation_value_is_empty(value)` (the ONE notion of empty, shared with `eval_condition`'s
  `is_empty`) * `app.item_bound_violations(item_type, config, label, value)` (the legacy config-bound lane,
  made enumerable; `app.assert_item_bounds` is now a thin `HC061`-raising wrapper over it) *
  `app.response_validation_errors(response)` **DEFINER** - the single walker both the read path and the
  submit gate consume.

- **`app.is_manual_case_event_kind(kind)`** (BUG-CASEKIND-001, migration `20260921000400`) —
  **IMMUTABLE + security INVOKER + pure**; the SQL mirror of the six-value manual registro
  vocabulary in `src/lib/cases/registro-kinds.ts`. It is the `kind` arm of **all four** user-role
  write policies on `case_events` (`writer_insert` · `staff_admin_insert` · `writer_update` ·
  `staff_admin_update`), so the ten SYSTEM kinds (2 registry echoes + 8 E3a ethics procedural) are
  writable only by the eleven `SECURITY DEFINER` RPCs that emit them — those are owned by `postgres`,
  which owns `case_events`, and the table is NOT `force row level security`, so they bypass RLS.
  ⚠ The arm is on the UPDATEs too: an INSERT-only arm is defeated by insert-then-update. Widening
  the manual vocabulary means widening this function, `case_events_kind_check`,
  `referral_internal_notes_kind_check` and the TS module **together**. Keystones: pgTAP
  `111_case_docs_events.sql` tests 6–9.

- `is_member_of(commission)` / `is_staff_admin_of(commission)` — `security definer`,
  used throughout RLS.
- `app.is_admin()` — from the verified JWT claim, DB fallback as defense-in-depth.
  **Multi-tenancy (ADR 0041): now `platform_admin` — provisioning-only, walled off all tenant
  data/PHI; never an authorization grant on a tenant path (esp. in service-role actions).**
- **Multi-tenancy org predicates (ADR 0041), `security definer`, mirror `is_member_of`:**
  `app.is_org_admin_of(org)` / `is_org_admin_of_commission(commission)` (+ `_for(…, user_id)`
  variants) — customer org_admin authority (single-hop via the denormalized
  `commissions.organization_id`); `app.is_org_member(org)` — member of any commission in the org
  (gates a commission member reading their own org row); `app.is_multi_org()` —
  `(select count(*) from public.organizations) > 1`, the guard that makes `app.is_pqs_member`
  (and thus the entire global-PQS/QPS NSP + referral PHI surface) inert in a multi-org deployment.
- `app.eval_condition(...)` — the **SQL** condition evaluator. Mirrored in TypeScript by
  `evalCondition` in `src/lib/queries/conditions.ts`; the shared vector file
  `src/lib/queries/__fixtures__/condition-vectors.json` keeps them in agreement.
  **Drift is phase-blocking.**
- `app.answer_map(response)` — `question_key→value` for evaluation; since form-model-normalization
  it **rebuilds** the value from `answers` (scalars) + `answer_selected_options` (single→scalar code,
  checkbox→ordered code array), keeping the evaluator + shared vectors byte-for-byte unchanged.
  `app.answer_map_by_item(response)` is the `item_id`-keyed twin (drives `get_response_for_signoff`).
- `app.response_required_complete(response)` — submit-readiness (used by the queue); "answered" =
  scalar value OR ≥1 selection row.
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
  `app.validate_template_phase_blocks(p_template_version_id, position, blocks)` — DEFINER deep
  validity (every referenced position exists in the VERSION; → HC016). `app.guard_process_template_outcome()`
  — BEFORE INSERT on `process_template_outcomes`, asserts outcome+template share a commission
  (→ **HC030**). ⚠ The whole `app.validate_template_*` family (`_recommend_when`, `_phase_result`,
  `_result_ruleset`, `_allowed_results`, `_phase_blocks`) takes `p_template_version_id` since ADR 0096.
- **Cases-Extras (R3/R4):** `app.guard_case_tag_assignment()` — BEFORE INSERT trigger asserting
  tag+case share a commission (HC026). `app.advance_action_item_core(item, status)` — DEFINER
  gated mutation (assignee OR staff_admin → HC027; stamps `completed_*` on `done`).
- **Phase 7 (cases):** `app.commission_of_template(id)` / `app.commission_of_case(id)` —
  definer, mirror `commission_of_version` (drive RLS + definer reads). ⚠ Since ADR 0096 the
  template side is a THREE-function family, because the child tables lost their FK to
  `process_templates`: `commission_of_template` (1 hop) · `commission_of_template_version`
  (2 hops, version → identity) · `commission_of_template_phase` (**3 hops**, phase → version
  → identity). Use the one matching your grain — see `PCI + TV`.
  `app.case_phase_answer_map(case_phase)` — **definer, SUBMITTED-ONLY** `question_key→value`
  for ONE phase; returns `'{}'` for an in-progress/skipped source (the single cross-member
  answer surface; the Phase-7 invariant — tested, do not relax). Since form-model-normalization it
  rebuilds from `answers`+`answer_selected_options` like `answer_map` (choice-based cross-phase
  recommendations/result-rulesets were silently blank before that fix). `app.published_version_of_form`,
  `app.version_has_input_key`, `app.validate_template_recommend_when`,
  `app.is_member_of_for(commission, user)` (arbitrary-user membership, for assignee checks).
- **Phase 10 (meetings):** `app.commission_of_meeting(id)` — definer, drives child-table RLS + definer
  reads. `app.can_sign_meeting(attendee, signer)` — definer predicate (caller's OWN row, present
  PLATFORM attendee, meeting `em_assinatura`, member of commission); the sign-own-row authority for
  BOTH the `meeting_signatures_insert` policy AND the `sign_meeting` DEFINER path (a DEFINER fn
  bypasses RLS, so it re-checks explicitly). `app.guard_meeting_status` (state-machine + content-freeze
  ≥`em_assinatura`) / `app.guard_meeting_child_lock` (keys on PARENT status, NOT the RPC flag) /
  `app.mint_meeting_number` (advisory-lock, mirrors case number) / `app.seed_default_meeting_types`
  (AFTER INSERT on `commissions`). `app.assert_meetings_enabled()` gate; `public.meetings_enabled()`
  DEFINER boolean (TS-layer write gate). `content_hash = encode(extensions.digest(coalesce(minutes_md,''),'sha256'),'hex')`
  (note the `extensions.` qualifier — pgcrypto isn't on the pinned search_path).
- **Phase 11 (interviews):** `app.commission_of_interview(id)` — definer, drives child-table RLS + the
  writable gate (reads the DENORMALIZED `commission_id` → no recursion). `app.can_write_interview(interview, uid)`
  — **the NEW participant-write authority** (DEFINER, uid-pure): staff_admin/admin of the interview's
  commission OR a registered interviewer (a `case_interview_interviewers` row with `user_id=uid`); drives
  every `case_interviews` UPDATE/DELETE + child WRITE policy + the Storage INSERT policy + the
  `assert_interview_writable` RPC gate. Built on NEW uid-pure mirrors `app.is_staff_admin_of_for(commission, uid)`
  + `app.is_admin_for(uid)` (DB `profiles.is_admin` only — the JWT claim is per-session, so policies also OR
  `app.is_admin()`). `app.guard_interview_status` (state-machine + content-freeze ≥`concluida`, gated
  `app.in_interview_rpc`) / `app.guard_interview_child_lock` (keys on PARENT status; subjects+interviewers
  only — **attachments excluded**) / `app.guard_interview_links` (commission-honesty + phase-in-case →
  check_violation) / `app.mint_interview_number` (advisory-lock, mirrors meeting number) /
  `app.assert_interview_writable(interview)` (→ HC039). `app.assert_interviews_enabled()` gate;
  `public.interviews_enabled()` + `public.interview_viewer_can_write(interview)` DEFINER reads. No seed-on-commission
  trigger (interviews are created per-case, not per-commission). **IV2 (2026-07-14):** adds
  `app.commission_of_session(session)` + `app.assert_session_writable(session)` (resolve `interview_id`, delegate to
  the interview equivalents → HC039) driving `interview_sessions` RLS/RPCs; `guard_interview_status` rewritten for
  the English-key §4 machine incl. `awaiting_follow_up` (content-freeze at `completed`); `guard_interview_child_lock`
  now also fronts `interview_sessions`. `case_interviews` scheduling cols dropped; a session carries them.
- **Phase 8 (dashboards):** `app.submitted_form_responses(form)` — the canonical "dashboard-countable"
  response-id set (`status='submitted' AND case_phase_id IS NULL AND form_id=…`); TS twin
  `isDashboardCountable` in `dashboard.ts` (ADR 0020). `app.latest_published_version(form)` — labels/
  sections for cross-version aggregation.
- **Phase 14a (patient-safety/NSP, ADR 0030/0031):** `app.is_pqs_member(uid)` — PQS-staff/admin predicate (mirrors the uid-pure `..._for` helpers). `app.can_read_event(event, uid)` — **DEFINER, uid-pure** access-follows-custody predicate driving the SELECT policy on `patient_safety_event` + `event_patient` + `event_custody` (current custodian OR reporting-commission provenance OR PQS/admin). `app.guard_event_status` (state machine + freeze@triaged, gated `app.in_safety_rpc` → HC043) / `app.guard_event_custody` (append-only ledger: rejects closed-interval edit, non-`held_until` column edit, DELETE → HC043) / `app.event_current_custodian(event)` (the HC044 gate) / `app.mint_event_code` (global advisory-lock `EV-%04d`, mirrors meeting/interview numbering). `app.assert_patient_safety_enabled()` gate (raises 23514 when OFF); `public.patient_safety_enabled()` DEFINER boolean (TS-layer read). **PHI isolation:** identifiers live ONLY in `event_patient`; never selected on queue/aggregate/timeline paths; every `getEventPatient` read emits a Phase-13 `event_patient.read` audit row with empty metadata.
- **S1·N (notifications, ADR 0076), internal DEFINER (schema `app`, NOT public — no `authenticated` grant):**
  `app.enqueue_notification(user, commission, kind, milestone, is_reminder, entity_type, entity_id, title,
  body, dedup_key) → boolean` — the SOLE `notifications` insert door; idempotent
  (`ON CONFLICT (user_id, dedup_key) DO NOTHING`); returns false / never raises on flag-OFF, missing arg,
  dedup collision, or a disabled reminder surface (assignments — `is_reminder=false` — never suppressed);
  called from the 9 event-hook host mutations AND `compute_due_notifications`. `app.resolve_notifications_for(entity_type, entity_id)` —
  stamps `resolved_at` on unresolved **reminders** of an entity (assignments untouched); called from the
  CAPA-close / sign-off-sign / meeting-conclude mutations. `app.assert_notifications_enabled()` gate
  (raises `23514` when OFF; mirrors `assert_response_correction_enabled`).
- **ETH·E1 access spine (ADR 0072)** — all `security definer`, **R6-safe over BASE tables**. See the
  **E1** section for the map and the ⚠ three-shapes rule.
  `app.is_case_respondent(case, uid)` / `app.is_recused_from_case(case, uid)` — the two **hard denies**,
  fed FIRST into `can_read_case` / `can_read_case_patient` / `can_write_case_content`.
  `app.is_case_excluded(case, uid)` = either — the **conjunct** form (`AND NOT is_case_excluded(…)`)
  applied to the bare-admin `FOR ALL` write policies (a no-op for every non-excluded user).
  **`app.can_read_case_or_admin(case, uid)`** — denies FIRST, THEN ORs the commission-admin arm.
  **Every case-scoped policy needing an admin arm MUST use this**: ORing the admin arm *outside* the
  DEFINER out-votes the m2 deny (QA MAJOR-1).
  **`app.can_reach_case_on_member_surface(case, uid)`** (ADR 0072 D2·8) — the **member-facing** reach
  predicate: excluded ⇒ false; `explicit_grants_only` ⇒ `can_read_case_or_admin`; `commission_default`
  ⇒ member-wide reach **unchanged**. Use on member-facing surfaces (meeting case-labels, board, Meus
  Casos, timeline refs) — `can_read_case` has **no plain-member arm** by design (the `case_access` flag is retired — single path), so
  gating those on it **silently deletes ordinary members' reach of ordinary cases**.
  `app.can_read_interview(interview, uid)` — case read + the confidentiality ceiling; covers all 7
  interview-family SELECT policies in one place.
  ⛔ `app.attachment_confidentiality_ok` **was DROPPED by DM1** (`20260923000100` — the document
  ceiling currently has NO enforcement mechanism on documents; PO ruled option 1 = re-express on
  `documents` as a **DM2 prerequisite**, FUP-DM1-CEILING; general plane at Phase 19). The entry below
  is kept for `confidentiality_clearance_ok` (still live — interviews) + the clearance semantics the
  DM2 rebuild must reproduce:
  `app.attachment_confidentiality_ok(owner_type, owner_id, label, uid)` [DROPPED] / `app.confidentiality_clearance_ok(
  case, label, uid)` — the **document ceiling** (`legal_privileged` + `credentialing_sensitive` only — O2;
  `ethics_investigation` stays at ordinary case-read). Clearance rides `case_access_grants.max_confidentiality`
  **only**: **no admin bypass** and **no coordinator arm** — an uploading `staff_admin` without a
  clearance grant is denied (the accepted D5 deviation; the E2/E3 UX follow-up is self-clearance-on-upload).
  `app.confidentiality_rank(label)` — the **authoritative** sensitivity ordering; `ethics_investigation`=4
  ranks **below** `legal_privileged`=5. **Do NOT** re-order it to match the union's declaration order (the
  picker's display order): that would let an `ethics_investigation` clearance open legal-privileged docs.
  `app.can_manage_professional(org, uid)` · `app.assert_case_participants_enabled()` (gates the whole
  ethics write spine) · `app.normalize_interview_confidentiality()` (trigger — maps IV2's legacy 3-value
  input to the 7-value taxonomy, which is why `create_interview`/`update_interview` needed no reproduction).

## Feature flags (`app.feature_flags`)

⚠ **Superseded** — for the KEY SET only. 18 of the 42 typed `FeatureFlags` fields appeared
nowhere in this table when it was measured on 2026-09-09, and two live keys had no typed field
at all; the key set, its typed readers and both drift polarities are now derived. ⛔ The
**State** column is NOT superseded and must stay handwritten: it is a claim about *production*,
and only a human knows whether a flip migration was pushed — the generated table's `local`
column is the seeded value and asserts nothing about any deployment.
See generated-feature-flags.md § The generated flag registry.

| Flag | State | Notes |
| ---- | ----- | ----- |
| `signoff_enforcement` | **ON** (Phase 6, migration `…090001`) | `submit_response` blocks submission until every VISIBLE `requires_signoff` section is signed → **P0012**. Was OFF in Phases 1–5 (ADR 0004). |
| `deferred_staff_signoff` | **ON** (ADR 0136 — created OFF by `20261003001900`, flipped by `20261003002100` at the gate, 2026-08-24) | Role-SPLITS `signoff_enforcement` (ADR 0004 amended in effect). When ON, `submit_response` stops blocking on an unsigned `signoff_role='staff_admin'` section **of a CASE-PHASE response** (`case_phase_id is not null` — D2); the phase parks in `case_phases.status = 'awaiting_signoff'` and the last signature completes it. HC012 SURVIVES for the `respondent` arm and for every standalone response. ⛔ **Resolve the VALUE in the `enabled` column, never this sentence** — and on the REMOTE, measure it: the flip only reaches production when `20261003002100` is pushed. ⚠ The status-list widenings (`close_case`, `cancel_case`, `recompute_case_status`, `guard_case_phase_status`, `file_correction_request`) are deliberately **NOT** flag-gated: with the flag off no phase can reach the status, so they are inert — and gating them would strand a parked phase if the flag were ever flipped back OFF. |
| `cases_multi_phase` | **ON** (Phase 7, migration `…090008`) | Gates every Phase-7 cases RPC. Inserted OFF in `…090004`; flipped ON by the separate one-line `…090008` (mirrors the `signoff_enforcement` flip). The feature is live. |
| `cases_extras` | **ON** (Extras, migration `…092006`) | Gates the Cases-Extras + outcome WRITE surface: the **OUTCOME** RPCs (`set_case_outcome`, `set_process_outcomes`, outcome vocab CRUD — ADR 0024); R3 tag CRUD/assign; R4 action-item authoring + lifecycle; R1 document/event actions via `cases_extras_enabled`. (The R2 `set_case_status` + status CRUD it formerly gated were REMOVED by ADR 0024.) Inserted OFF in `…092001`; flipped ON by `…092006`. The core phase RPCs (`activate_phase`/`skip_phase`/`add_ad_hoc_phase`/`reassign_phase`/`close_case`/`cancel_case`/`create_case_from_template`/`set_template_phase_blocks`) gate ONLY `cases_multi_phase`. |
| `meetings` | **ON** (Phase 10, migration `…090008`) | Gates every Phase-10 meetings RPC + the TS-layer table writes via `public.meetings_enabled()`. Inserted OFF in `…090000`; flipped ON by `…090008` (enabled in-phase so the gate exercised the live feature — same pattern as `cases_multi_phase`). |
| `interviews` | **ON** (Phase 11, migration `…091004`) | Gates every Phase-11 interviews RPC + the TS-layer writes via `public.interviews_enabled()`. Inserted OFF in `…091000`; flipped ON by `…091004` (enabled in-phase — same pattern as `meetings`). |
| `audit_trail` | **ON** (Phase 13, migration `…120003`) | `app.audit_write` no-ops while OFF; the AFTER-triggers + `log_audit_access` capture once ON. TS-layer reads via `public.audit_trail_enabled()`. Inserted OFF in `…120000`; flipped ON by `…120003` (in-phase). |
| `patient_safety` | **ON** (Phase 14a, migration `…121003`) | Gates every Phase-14a NSP RPC via `app.assert_patient_safety_enabled()` + the TS-layer reads via `public.patient_safety_enabled()`. Inserted OFF in `…121000`; flipped ON by `…121003` (in-phase — same pattern as `audit_trail`). Establishes Architecture Rule 12 (PHI/HIPAA — first PHI). |
| `case_access` | ⛔ **RETIRED** (Stage B, migration `20260802000000`; ADR 0078) | **Dropped from `app.feature_flags` — no longer a live flag.** Stage B cut the store `public.case_access` → `public.case_access_grants` and collapsed this flag to a single always-on path (`public.case_access_enabled()` → `true`; `assert_case_access_enabled` gone; the flag-OFF `is_member_of` fallback DELETED, D9). *History:* inserted OFF `…110000`, flipped ON `…110004` (Case Access increment, ADR 0033); while it existed it gated the grant / narrative-lifecycle / `list_my_cases` RPCs + the content-write broadening + the grant UI. |
| `case_referrals` | **OFF** (Phase 22, inserted in `…013000`; ADR 0037) | Gates every Phase-22 referral RPC via `app.assert_referrals_enabled()` + the TS-layer reads via `public.referrals_enabled()`, AND three flag-gated cross-cutting terms: the `app.can_read_case` QPS macro-read, the `close_case` HC076 gate, and the `case-documents` snapshot-doc OR-term. **Ships OFF** (like `audit_trail`/`patient_safety` pre-flip); the E2E gate flips it ON. Flag-OFF behavior is byte-identical to pre-Phase-22 at every touched function. |
| `quality_indicators` | **ON** (Phase 15, migration `…000300`; ADR 0057/0058) | Gates every Phase-15 indicator RPC + the TS-layer reads via `public.quality_indicators_enabled()` / `qualityIndicatorsEnabled()`. Inserted OFF in `20260712000000`; flipped ON by `…000300` (in-phase, same pattern as `patient_safety`). Note: the indicator→CAPA arm additionally needs `patient_safety` ON (CAPA lives in the NSP module). |
| `controlled_docs` | **ON** (Phase 17, migration `…013000400`; ADR 0057) | Gates every Phase-17 controlled-document RPC via `app.assert_controlled_docs_enabled()`; the TS layer reads it via `controlledDocsEnabled()` (delegates to the consolidated `get_feature_flags()`). Seeded OFF in `20260713000000`; enabled locally via `seed.sql` for the test gate; flipped ON for prod by the Record-step `…013000400` (deliberate deferred flip). PHI-free module (Rule 12 N/A). |
| `notifications` | **ON** (S1·N, migration `…000720`; ADR 0076) | **21st flag.** Gates the notification engine — `app.assert_notifications_enabled()` on the write RPCs, and `app.enqueue_notification`/`app.resolve_notifications_for`/`compute_due_notifications` all no-op when OFF (so the 9 event-hook splices are inert + a scheduled scan is harmless). TS layer reads via `notificationsEnabled()` (delegates to `get_feature_flags()`). Inserted OFF in `20260720000700`; flipped ON by the gate-flip `…000720`; `seed.sql` forces ON for local/E2E. Flag-OFF preserves byte-for-byte pre-N behaviour (shell renders no bell). PHI-free by construction (Rule 12). |
| `case_participants` | **ON** (E1, migration `…001040`; ADR 0064/0072) | **The m2 hard gate — released by E1.** Seeded OFF at F1; flipped ON only once respondent-exclusion RLS landed. Gates the ethics write spine via `app.assert_case_participants_enabled()`. **Local only** — never `db push`ed this phase; prod flips at the deliberate pilot reset. RLS is live regardless of the flag (the flag gates RPC reachability, never the boundary). |
| `matrix_fields` | **ON** (FF-2, migration `…001200`; ADR 0089) | Gates `upsert_matrix_axes` + both matrix answer writers (`HC0P2`) and the builder's matrix types; TS reads via `matrixFieldsEnabled()`. Seeded **OFF** in `20260830000100`; flipped ON by the gate-flip `…001200`; `seed.sql` forces ON for local/E2E. **READ paths are ungated** - a stored grid renders either way, so the flag governs authoring + filling only. |
| `entity_refs` | **ON** (FF-5, gate-flip `20260902000600`; ADR 0091) | Gates `app.save_reference_answers` and `public.reference_candidates` (both raise `HC0Q3`), the reference arms of both save paths, and the builder's `reference` type. Seeded **OFF** in `20260902000000`; flipped by `20260902000600_enable_entity_refs.sql`; `seed.sql` forces ON for local/E2E. **READ paths are ungated** - a stored reference still projects and aggregates, so the flag governs authoring + filling only (same posture as `matrix_fields`). |
| `power_authoring` | **ON** (FF-4, gate-flip `20260903000600`; ADR 0092) | Gates all four block-library DEFINER doors, `app.seed_default_answers`, and the builder's library browser + dynamic-default selector. Seeded **OFF** in `20260903000000`; flipped by `20260903000600_enable_power_authoring.sql`; `seed.sql` forces ON for local/E2E. **READ paths are ungated** - an inserted block is ordinary form structure and a stored `default_value` still applies, so the flag governs authoring + draft-start seeding only (same posture as `matrix_fields`/`entity_refs`). ⚠ **This flip has no later phase behind it**: FF-4 is the last of the five phases gating the pilot (ADR 0086 ruling 2), so the next `db push` is the pilot's - an absent flip would have gone dark straight into the customer pilot. |
| `item_validations` | **ON** (FF-3, gate-flip `20260901000800`; ADR 0090) | ⚠ This row read "**the gate-flip migration does NOT exist yet**" until FF-5 - it does: `20260901000800_enable_item_validations.sql`, verified against the tree. Seeded OFF in `20260901000000`; flipped by `…000800`; `seed.sql` forces ON for local/E2E. Gates BOTH sides: `set_item_validations` raises `HC0Q0`, `get_response_validation_errors` returns the EMPTY SET, and the `required_if` layer + the `HC0P9` gate are skipped inside `submit_response`/`app.response_required_complete` (the flag is read ONCE per call and the `required_if` argument nulled at the call site, so the predicate stays IMMUTABLE). TS reads via `itemValidationsEnabled()`. **Fail-closed in a specific way**: with the flag OFF the writer raises `HC0Q0`, so a rules editor offered anyway is a dialog whose save can never succeed. ⚠ Without the flip, `db push` ships the phase DARK while local stays green - FF-2's review blocker. |
| `case_types` | **ON** (E1, migration `…001040`; ADR 0064/0072) | The other half of the m2 gate. Gates the `create_case_from_template` type→case snapshot (`p_case_type_id` is ignored while OFF ⇒ `commission_default`/`non_phi_internal`). |
| `accreditation` | **ON** (Phase 16, gate-flip `20260904000100`; ADR 0093) | Gates ALL 15 `public.*` accreditation RPCs (framework CRUD, evidence/assessment, the 3 readiness read doors) via `app.assert_accreditation_enabled()` → `HC0Q9`, called FIRST in every one. Seeded **OFF** in `20260903000800_accreditation_schema.sql`; flipped by `20260904000100_enable_accreditation.sql`; `seed.sql` forces ON for local/E2E. **Unlike `matrix_fields`/`entity_refs`/`power_authoring`, READ paths are gated too** — this is a brand-new module with no pre-existing ungated behavior to preserve, so there is no "reads still work while OFF" carve-out. Full surface → the P16 section above. |
| `documents_foundation` | **OFF** (DM1, `20260923000600`; ADR 0114) | The document-model substrate flag. **Gates NOTHING yet** — DM1 shipped no RPCs; DM2's command doors assert it. The metadata RLS is flag-independent (the flag gates reachability, never the boundary). Seed does NOT enable it. |
| `documents_wave_a` … `documents_wave_d` | **OFF** ×4 (DM1, `20260923000600`; ADR 0114 D13) | Per-wave consumer flags (A: case/meeting/interview/action-item attachments UI · B: controlled docs · C: referrals · D: NSP evidence + printed renditions). All inert until their wave. Wave A additionally retires the legacy `attachments` flag KEY (below). |
| `attachments` | **OFF — VERBLESS since DM1** (D1 flip 2026-08-11; substrate dropped `20260923000100`) | The key SURVIVES but `assert_attachments_enabled` and every RPC that read it are GONE; the only remaining readers are the TS-layer `attachmentsEnabled()` stubs keeping the parked UI dark. Retired at DM2 per the program plan. Seed no longer enables it (local == prod). |

## Data-access & action modules (Rule 9 — no inline supabase-js in UI)

⚠ **Superseded** — for the module INVENTORY only. 36 of the 109 query and action modules on
disk were unnamed here when this was measured on 2026-09-09; which modules exist and what each
exports is now derived from a directory walk. ⛔ The reasoning below **survives**: why the FF-3
pure/server split is load-bearing, why `set_item_validations` REPLACE makes the read path the
writer's safety, which types are a frozen contract `frontend` built against. A walk sees files,
not why a seam is where it is.
See generated-query-modules.md § The generated module registry.

> ⛔ **The whole attachment lane is PARKED STUBS since DM1** (2026-08-12; ADR 0114 D5):
> `src/lib/attachments/actions.ts` + `src/lib/queries/attachments.ts` keep their exported
> signatures but return "indisponível" / `[]` / `null`; the attachment halves of
> `cases/documents-actions.ts`, `meetings/actions.ts`, `interviews/actions.ts` fail closed
> the same way (interview LINKS still write `case_interview_links` — the one live remnant);
> `queries/rca.ts` no longer offers document citation targets; `getCaseDocumentDownloadUrl`
> is a null stub. Any `uploadInterviewAttachment`-style mention below is the pre-DM1
> HISTORICAL contract; the live replacement is DM2's `src/lib/documents/` module.

- **FF-3 (ADR 0090) - the module SPLIT, and why it is not cosmetic.**
  `src/lib/forms/validation-rules.ts` holds the PURE half: the vocabulary consts, the per-rule config
  types, `ValidationRuleSpec`/`ItemValidationRule`/`ValidationRuleInput`/`RequiredIf`/`ValidationErrorRow`,
  and `evalValidation` / `itemIsRequired` / `isValidationRuleAllowed` / `validationValueIsEmpty`.
  `src/lib/queries/validations.ts` holds ONLY `getResponseValidationErrors` and **re-exports** the pure
  surface, so server callers import from one place.
  **The split is load-bearing**: the builder and the wizard value-import those helpers in the BROWSER, and
  a client component value-importing a module that transitively pulls `@/lib/supabase/server`
  (`import 'server-only'`) **aborts `next build`** while tsc, lint and Vitest all stay green
  (BUG-FBE-005). The precedent is `src/lib/forms/matrix.ts`, not `queries/conditions.ts` - the latter is
  pure but no client value-imports it, so it never proved the property. A static test in
  `queries/validations.test.ts` fails if the pure module regains a server import; it is the only check
  that fires at the moment the mistake is made.
- **FF-3 writers/readers** - `setItemValidations({itemId, rules})` in `src/lib/forms/actions.ts`
  (REPLACE semantics; maps `HC0Q0`/`HC0Q1`/`HC0Q2`/`HC0P4`/`42501`) * `required_if` rides the existing
  `addItem`/`updateItem` on the `requiredIf` FormData field, parsed by `parseRequiredIf` which accepts the
  SINGLE condition shape ONLY (the group shape is refused before the round trip, because
  `app.is_valid_condition` rejects it) * `Item.requiredIf` + `Item.validations` on the version tree in
  `src/lib/queries/forms.ts`, via an **FK-HINTED** `form_item_validations!form_item_validations_item_id_fkey`
  embed (the table FKs BOTH `form_items` and `form_versions`, the PGRST201 shape this repo already ate once)
  * `SubmitActionState.validationErrors` on **both** submit paths in `src/lib/responses/actions.ts`.
  ⚠ **The read path is what makes the writer safe**: `set_item_validations` REPLACES, so a builder that
  opened without hydrating `Item.validations` and then saved would DELETE every existing rule on the item.
  `itemValidationsEnabled()` in `src/lib/queries/feature-flags.ts`.

- Queries: `src/lib/queries/{session,commissions,members,forms,responses,signoffs,
  process-templates,cases}.ts` + the canonical helpers `answerableItems(tree)` and the
  submitted-responses filter. Cases: `listProcessTemplates`/`getProcessTemplate`;
  `listCasesBoard`/`getCaseDetail` (definer RPCs) + `getCasePhaseForFill` (RLS-scoped).
  **ADR 0096 adds the version-aware read surface** in `queries/process-templates.ts`:
  `listTemplateVersions` · `listProcessTemplateVersions` · `getProcessTemplateVersion` ·
  `getPublishedTemplateVersion` · `getDraftTemplateVersion` · `getProcessTemplateWithVersion` ·
  `getCaseTemplateProvenance`; and in `process-templates/actions.ts`:
  `cloneTemplateVersion` · `beginTemplateEdit` · `publishTemplateVersion` ·
  `discardTemplateDraft` · `archiveTemplateVersions`.
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
- **Phase 10 (meetings):** Queries `src/lib/queries/{meetings,meeting-action-items}.ts`. Actions
  `src/lib/meetings/actions.ts` + `src/lib/meetings/messages.ts` (the SQLSTATE→pt-BR map is
  centralized here — a deliberate divergence from the inline cases pattern, noted in-file) +
  the `meetingsEnabled()` TS-layer gate. Attachment upload mirrors the case-documents flow; minutes
  render via the project's sanitizing Markdown renderer (Rule 7). Domain types are the frozen
  contract `frontend` built against (`MeetingStatus`/`MeetingModality`/`AttendeeRole`/`AttendanceStatus`/
  `SignatureStatus`/`MeetingAttachmentKind`/`QuorumRuleType`).
- **Phase 11 (interviews):** Queries `src/lib/queries/interviews.ts` (`listCaseInterviews(caseId)` —
  list items carry `subjectCount`/`subjectSummary`; `getInterviewDetail(id)` — carries
  `viewerCanWrite` (via the `interview_viewer_can_write` RPC), `commissionId`, `caseId`, `caseNumber`
  for the UI's write-gating + URL-consistency guards; `listInterviewSubjects`/`listInterviewInterviewers`/
  `listInterviewAttachments` — attachments expose BOTH `openUrl` (signed URL, non-null for stored files)
  and `externalUrl` (non-null for links), exactly one non-null; `interviewsEnabled()`). Actions
  `src/lib/interviews/actions.ts` + `src/lib/interviews/messages.ts` (centralized SQLSTATE→pt-BR map,
  mirroring meetings) + the `interviewsEnabled()` gate. `createInterview` returns `interviewId`;
  attachment upload mirrors the case-documents/meetings flow (`uploadInterviewAttachment` file +
  `addInterviewLink` https-only); summary renders via the sanitizing Markdown renderer (Rule 7). Domain
  types are the frozen contract `frontend` built against (`InterviewStatus`/`InterviewModality`/
  `InterviewerRole`/`InterviewAttachmentKind`). NOTE: every write action EXCEPT `createInterview` (staff_admin
  bootstrap) does NO staff_admin pre-check — a registered interviewer who is a plain `staff` member must pass;
  the RPC's `can_write_interview` gate (→ HC039) is the authority. `InterviewSubjectInput.externalOrg` is
  OPTIONAL (the subject form need not collect it).
- **Phase 12 (case timeline, ADR 0027 — read-only, NO migration/RLS):** Pure model
  `src/lib/timeline/event-model.ts` (`CaseTimelineEvent`/`TimelineEventType`/`TimelineStatus`/
  `TimelinePerson` + helpers `anchor`/`endDay`/`durationDays`/`statusOf`/`initialsOf`) — client-
  importable, ZERO imports (no server leakage). Query `src/lib/queries/case-timeline.ts`
  (`getCaseTimeline(caseId)` → `{ events, reference, closedAt, isOpen }`; `listCaseMeetings(caseId)`
  → reverse `meeting_cases→meetings`). `getCaseTimeline` COMPOSES existing RLS-scoped reads only —
  gated by `getCaseDetail` (returns `null`/empty for non-staff_admin/foreign), + a DIRECT RLS-scoped
  `case_phases` read for bar timestamps (`case_phases_select` member-read; no RPC change). Two dedups:
  interview→case_event by `registry_event_id`, AND meeting-echo (drop `case_events kind='meeting'` —
  the meeting-conclusion RPC auto-writes one per linked case; the reverse `meeting_cases` link is
  authoritative). **`getCaseDetail` (`cases.ts`) + `getCommissionAccess` (`session.ts`) are now wrapped
  in React `cache()`** (request-scoped memo for the `(detail)` layout+child split; signatures
  unchanged). `meetings.ts` gained ADDITIVE exports reused by the reverse read: `MeetingRow`,
  `mapMeetingListItem`, `MEETING_LIST_COLUMNS`. No new RPC/SQLSTATE/feature-flag.
- **Phase 14a (patient-safety/NSP, ADR 0030/0031):** Queries `src/lib/queries/{safety-events,pqs}.ts` (`listCommissionEvents`/`getSafetyEvent`/`getEventCustody` PHI-free; **`getEventPatient` — the ONLY PHI read, wired to `logAuditAccess('event_patient.read')`** with empty metadata, called only when `event.hasPatient`; `pqsInbox`/`patientSafetyEnabled`). Actions `src/lib/safety/actions.ts` (`notifySafetyEvent`/`acknowledgeEvent`/`transferEventCustody`/`updateEvent`/`setEventPatient`/`cancelEvent`) + `src/lib/safety/messages.ts` (HC043/HC044→pt-BR). **`src/lib/safety/types.ts` is the import-free, client-safe contract** (all domain unions + label maps + the `ActionState` shape — `message?` carries success text; P14a-002 boundary fix); the server query/action modules import types from it. `src/lib/audit/access.ts` extended with the `event_patient.read` allow-list entry. `getCaseTimeline` composes PHI-free `safety_event` rows (echo-dedup vs `case_events kind='safety_event'`).
- **Multi-tenancy (ADR 0041):** the frontend authorization seam is `src/lib/queries/session.ts` —
  `getSessionContext()` now carries `memberships[].commission.organization` + `orgAdminOf[]`, and
  the canonical resolver is **`getCommissionAccessByOrg(orgSlug, commissionSlug)`** (resolves org
  then commission by `(organization_id, slug)`; `role` gains an org_admin → coordinator branch;
  foreign-org → `null` so the layout `notFound()`s — the legacy single-arg `getCommissionAccess`
  was removed, `82ea157`). `src/lib/routing.ts` `commissionHref(org, commission, …segments)` is the
  href codemod target. **Provisioning splits by actor:** `src/lib/platform/actions.ts`
  (**service-role**, `requireAdmin()`-gated — `createOrganization`/`createHospital`/`assignOrgAdmin`,
  `org_admin` hard-coded never from formData) vs `src/lib/org/actions.ts` (org_admin's own session,
  RLS is the authority — org-scoped hospital/commission/staff management). **Rule of the phase:** a
  `platform_admin` claim is never an authorization grant on a tenant path — most critically in the
  service-role actions where RLS is not a backstop (the TS gate is the sole control).
- **User Registration & Identity (ADR 0048):** Queries `src/lib/queries/org-users.ts`
  (`listOrgUsers(orgId, search, {page,pageSize})` → `{rows,total}` with derived status +
  committee count + home hospital; `getOrgUser(userId)` → profile + `credentials[]` +
  `committees[]` w/ role; `listProfessionalCategories()` — all RLS-scoped cookie client, the
  `profiles` SELECT path admits a committee-less pending user — ⚠ **that path was
  `is_org_admin_of(home_organization_id)` until AE2.2, which re-predicated it onto
  `organization_affiliations`; re-derive the current legs from `pg_policies`, not from here**).
  Actions `src/lib/users/actions.ts` (**service-role**, each `app.is_org_admin_of()`-gated
  BEFORE any write — the platform_admin is NOT admitted): `registerUser` (atomic invite +
  profile/credential/committee write, **email-collision block**, never swallows a write failure),
  `updateUserProfile`, `upsertCredential` (edit clears `verified_at`), `removeCredential`,
  `assignCommitteeRole`/`removeCommittee`, `deactivateUser`, `reactivateUser` (clears
  `suspended_until`), `suspendUser`, `resendInvite`. **`src/lib/users/types.ts` is the import-free,
  client-safe contract** — `UserStatus` + the pure **`deriveUserStatus(isActive, suspendedUntil,
  emailConfirmedAt, now?)`** (the SINGLE SQL↔TS status authority; parity-tested via
  `__fixtures__/status-vectors.json` in both Vitest + pgTAP) + the DTOs. **`app.is_active(uid)` is
  folded into every membership SD-helper** (deactivation/suspension enforce platform-wide via RLS;
  NOT into `app.is_admin*` — vendor must not be lockable). **`signIn` gate + `getSessionContext`
  `isInactive` → `/conta-inativa`** (loop-free; the residual ADR-0009 ≤~1h self-data window is
  accepted). ⛔ **Anchor invariant — RETIRED AT AE2, and the mechanism is worth keeping because its
  replacement inverts it.** It read: *"deferred `profiles_tenant_has_org_trg` (non-admin ⇒
  `home_organization_id` set), populated via invite `user_metadata` (service-role-set-once, NOT
  authz); org-less vendor via `bootstrap_admin` (`app_metadata`)."* The trigger is **dropped**
  (`…005600`), `user_metadata` now seeds **`full_name` only**, and the invariant is no longer a
  *column-presence* CHECK at all — anchoring is an `organization_affiliations` row written by the
  **creation door**, and the "must be anchored" rule survives only as ADR 0166's `HC0RB` demotion
  backstop (see the AE2 section). ⚠ The vendor carve-out **inverted**: `bootstrap_admin` no longer
  needs one, because `app.person_is_anchorless` deliberately has no `is_admin` arm. The shared
  `resolveOrInviteUser` (`src/lib/members/invite.ts`) took a **required** `homeOrganizationId`
  (BUG-UREG-003); the parameter still exists and is still threaded by every new-invite caller
  (`inviteStaff`, assign-staff_admin, `assignOrgAdmin`), but it is renamed **`organizationId`** and
  is used **only** by the tenant check — it is no longer written anywhere.
  **PROD DEPLOY DEPENDENCY (Phase 9):** the pt-BR `token_hash` invite + recovery email templates
  (`supabase/templates/{invite,recovery}.html`, wired via `config.toml [auth.email.template.*]`) are
  NOT applied to Supabase Cloud — upload them to Dashboard → Auth → Email Templates (keeping the
  `{{ .TokenHash }}` + `?type=` shape), alongside custom SMTP. Migration `20260702000000_user_registration.sql`.
- **Member overview (migration `20260704000000`):** Queries `src/lib/queries/action-items.ts`
  (`listMyActionItems(commissionId) → MyActionItem[]`; types `ActionItemSource` `'case'|'meeting'`,
  `MyActionItemStatus`, `MyActionItem`) + `src/lib/queries/overview.ts` (`getMemberOverview(commissionId)
  → MemberOverview`; the 7-field `MemberOverview` interface). Both wrap the self-scoped DEFINER RPCs
  `list_my_action_items` / `get_member_overview`; read-only, fail-closed (`[]` / all-zero). Back the
  current-member landing surface at `/o/[org]/c/[commission]/` (the "Meus itens de ação" list + the
  "Visão Geral" cards) — frontend owns the pages/cards. No new actions module (reads only).
- **S1·N (notifications, ADR 0076):** Queries `src/lib/queries/notifications.ts` (`listNotifications({limit?,unreadOnly?})` — filters `resolved_at IS NULL` [BUG-N-002] + pre-resolves each row's `href`; `getUnreadCount()` — unread AND unresolved, drives the shell badge; `getPreferences()` — always all 3 surfaces, missing → enabled) + `listMyAssignedCapaActions()` in `src/lib/queries/capa.ts` (BUG-N-001; wraps the self-scoped DEFINER, returns `MyAssignedCapaAction[]` from `@/lib/safety/capa-types`). Actions `src/lib/notifications/actions.ts` (`markNotificationRead`/`markAllNotificationsRead`/`setNotificationPreference` — each an own-row RPC call) + `src/lib/notifications/messages.ts` (**HC0C0/HC0C1 → pt-BR** via `mapNotificationsError`) + `src/lib/notifications/routing-context.ts` (batched `resolveCommissionSlugs` for signoff/meeting hrefs). `src/lib/routing.ts` gains **`notificationHref({entityType, entityId, orgSlug?, commissionSlug?})`** — pure path builder: `capa_action` → static `/conta/itens-de-acao` (BUG-N-001, no lookup), `meeting` → meeting detail, `response_section_signoff` → `/manage/assinaturas`; unresolvable → `#`. `feature-flags.ts` += `notifications` (21st `FeatureFlags` key) + `notificationsEnabled()`. Advancing a CAPA action from the personal page reuses `advanceCapaAction`/`completeCapaAction` (`src/lib/safety/capa-actions.ts`). `frontend` owns the bell/center/prefs UI + `/conta/itens-de-acao` page.
- Service-role client: `src/lib/supabase/admin.ts` (`import 'server-only'`), invite path only.

### Form-Builder Enhancements batch (2026-07-07; no dedicated ADR — see [adjustments-batch.md](../progress/adjustments-batch.md))

Migrations `20260713000500…001000` (on remote). New backend surface:

- **`hospital_departments`** — hospital-scoped unit/setor list (`hospital_id`, `name`, `sort_order`,
  `archived_at`). RLS: hospital-member SELECT (`app.is_hospital_member_of(hospital_id)`, new helper),
  admin (org/hospital) INSERT/UPDATE. Hardened `reorder_departments(p_hospital_id, p_ordered_ids[])`
  DEFINER RPC (admin-gated, same-hospital assertion). `cases.department_id` (FK, nullable) +
  `cases.department_other` (free text for the "Outros" department) — captured at case create.
- **Flagged + aggregate result criteria** — `form_item_options.flagged` (bool); per-item
  `config.flaggedWhen`. `app.compute_case_phase_result` injects two **synthetic answer-map keys** at
  runtime — `__total_score__` (Σ option scores) and `__flagged_count__` (Σ flagged selections) — so
  result rules can key on aggregates. **Evaluator (Rule 3) byte-for-byte unchanged** (synthetic keys ride
  the existing `__phase_result__` reserved-key precedent). `app.validate_template_result_ruleset` whitelists
  the two keys (mirrors `__phase_result__`) and skips option-code assertion for their **numeric** values;
  unknown reserved keys still throw HC016. Client keys: `TOTAL_SCORE_KEY`/`FLAGGED_COUNT_KEY`
  (`src/lib/queries/conditions.ts`). The aggregate source `app.case_phase_option_aggregates`
  resolves the phase's `current_response_id` **completed-only**, mirroring `case_phase_answer_map`
  — a voided / non-completed phase → **zero aggregates**, keeping `compute`'s two inputs consistent
  (QA INFO-1 parity, migration `…000200`; sole caller `compute_case_phase_result` only ever runs on a
  completed phase, so this is defensive/future-proofing, not a live behavior change).
- **"Others" open option** — reserved option `code='__other__'` (`form_item_options.is_other`),
  reconciled like a normal option; `answers.other_text` holds the free text. `save_section_answers` gains
  `p_other_text jsonb` (item→text map). Submit validation honors per-item `config.minLength/maxLength`.
  Client-safe constants live in **`src/lib/forms/option-constants.ts`** (`OTHER_OPTION_CODE`/`OTHER_OPTION_LABEL`,
  re-exported from `queries/forms.ts`) — NEVER value-import them from `queries/forms.ts` in a client component
  (drags `next/headers` into the bundle; see BUG-FBE-005).
- **`seed_selected_meeting_attendees(p_meeting_id, p_user_ids[])`** DEFINER RPC — bulk-convoke a selected
  member set at UI meeting create ("Convocar todos" default). To promote an already-convoked attendee use
  the existing `update_meeting_attendee(p_attendee_id, p_role, p_attendance)` (do NOT re-`add` — unique
  `(meeting_id,user_id)` index).
- **`openNarrativeCount`** surfaced on the cases-board read (Etapas-pendentes support).

## Extracted from the pre-split stamp chain

Facts recovered from the frozen pre-split currency-stamp chain when it left this directory
(→ [`../progress/backend-state-stamp-history-archive.md`](../progress/backend-state-stamp-history-archive.md),
ADR 0199). **Provenance is on every entry**: the stamp date it came from, and the date its subject was
re-measured against the live catalog. ⛔ Nothing here was copied on the chain's authority — the chain is a
2026-07/08 record, and four of the six corrections below exist because the chain disagreed with a posted
section and the **catalog** settled it.

### Corrections to posted sections above

Each of these supersedes a statement that is still posted above; the forward markers sit under the owning
headings. All six re-measured **2026-09-09** against the local catalog at migration `20261003007350`.

- **Phase 8 dashboards are NOT `is_staff_admin_of OR is_admin`-gated.** No `dashboard_*` function carries
  an `app.is_admin()` arm at all. BUG-AUTHZ-001 (`20260903000700`, stamp 2026-08-03) unified them.
  Measured — `select p.proname, p.prosrc ~ 'is_tenancy_admin_of' from pg_proc p join pg_namespace n on
  n.oid=p.pronamespace where n.nspname='public' and p.proname like 'dashboard%'` → **9 functions, 0 with
  `is_admin()`**. ⚠ The chain claims all nine carry `is_staff_admin_of OR is_tenancy_admin_of`; that is
  **not** what the catalog shows — **six** do, and three (`dashboard_completion_by_member`,
  `dashboard_export_rows`, `dashboard_free_text`) gate on `app.is_staff_admin_of(...)` **alone**, with no
  tenancy-admin disjunct. The narrower three are the per-member / per-response / free-text readers.
  Uniformity is asserted by pgTAP `270_authz_dashboard_gate_uniformity.sql`; read that suite before
  "fixing" the asymmetry — it may be deliberate.
- **`app.can_read_case_or_admin` DOES NOT EXIST.** The posted line tells the reader every case-scoped
  policy needing an admin arm **MUST** use it. It was retired at AUTHZ Gate 2 (stamp 2026-07-17) as
  byte-equivalent to `can_read_case`. Measured — `select count(*) from pg_proc where
  proname='can_read_case_or_admin'` → **0**. A policy written against the posted instruction would fail
  to compile.
- **`process_template_phases.allowed_result_ids` / `case_phases.allowed_result_ids` were DROPPED**
  (f-cleanup D3, stamp 2026-07-12), replaced by the junctions
  `process_template_phase_allowed_results` / `..._offered_results` / `case_phase_allowed_results`.
  Measured — `select count(*) from information_schema.columns where column_name='allowed_result_ids'`
  → **0**; the three junction tables are present in `pg_tables`.
- **`app.submitted_form_responses` carries a successor exclusion** that the posted predicate omits. The
  live body appends `and not exists (select 1 from public.responses succ where succ.supersedes_id = r.id
  and succ.status = 'submitted')` — and its own comment records the discrimination that matters: *a merely
  `in_progress` successor does NOT exclude the predecessor*, so a half-finished correction never blanks a
  metric. From S1·SUP (stamp 2026-07-13). Read `prosrc` before restating this predicate.
- **`mint_event_code` is PER-HOSPITAL, not global.** The live body takes
  `app.hospital_of_commission(new.reporting_commission_id)`, takes a per-hospital advisory lock, and
  filters the `EV-####` max to that hospital's events — its own comment gives the reason: *so a hospital
  cannot infer another's event volume from gaps*. Re-keyed from per-org by ADR 0052 (stamp 2026-07-03).

### Chain-only facts with no other home

- **`earliestSessionStart()`** (`src/lib/queries/rca.ts:364`, exported, unit-pinned in `rca.test.ts`) —
  BUG-RCA-001's PO ruling that "the interview's date" is the **earliest**
  `interview_sessions.scheduled_start`. It is a function rather than a select because `case_interviews`
  has **no** `scheduled_start` column, and the old select silently `42703`'d the whole read — a defect
  that returned empty rather than erroring. ⚠ It is **not** status-filtered, unlike `toNextSession` in
  `interviews.ts`; the two are not interchangeable. Verified present 2026-09-09. Stamp 2026-08-05.

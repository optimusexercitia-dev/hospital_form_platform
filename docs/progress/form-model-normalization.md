# Form data-model normalization — completed phase detail

> Rotated from PROGRESS.md at the §6.5 Record step (CLAUDE.md §7). Completed 2026-07-01.
> Plan `~/.claude/plans/snappy-juggling-duckling.md`; decisions memory `form-model-normalization-decisions`;
> QA review `docs/reviews/form-model-normalization-review.md`; ADR-free (pre-launch refactor).

### Form data-model normalization (🏗️ planning — started 2026-06-30)

> Plan `~/.claude/plans/snappy-juggling-duckling.md` · decisions memory
> `form-model-normalization-decisions`. Contract-first: BE-1 posts signatures + a plan for lead
> review BEFORE any migration; FE builds against the contract in parallel. **Invariant:** the dual
> evaluator (`app.eval_condition`/`eval_visibility` + TS mirror) and `__fixtures__` vectors stay
> byte-for-byte unchanged — `app.answer_map` is rewritten to rebuild the same `question_key →
> code(s)` shapes. Rollout = squash to clean baseline + full local & remote reset (human-run push).

| ID | Owner | Task | Dep | Status |
| -- | ----- | ---- | --- | ------ |
| BE-1 | backend | **[plan-review]** Implementation plan + contract-first typed stubs. **✅ Lead-APPROVED 2026-06-30** (commit `29d93cf`). Decisions: full-absorption squash done as a FINAL dump-packaging step (develop as additive migrations, squash last); app-side `code` gen (question_key parity); whole plan approved with check-backs after BE-3 + before squash/remote handoff. | — | ✅ |
| BE-2 | backend | New tables `form_item_options` + `answer_selected_options` (DDL/constraints/indexes/RLS/triggers: version-sync, immutable-code, parent-type guard, published-structure + submitted-children guards, display-item rejection); drop `options` jsonb + CHECKs. **Additive migration** (squash is BE-7). | BE-1✓ | ✅ applied + smoke-test 7/7 (commit `8c6f01f`) |
| BE-3 | backend | `app.answer_map` rewrite — identical `question_key → code(s)` jsonb from both tables (single→scalar code, checkbox→array; evaluator + vectors UNCHANGED) + server-side answer-map assembly in `getResponseForFill`/`getSubmissionDetail`. **[check-back: vectors + answer_map shape pgTAP green]** | BE-2 | ✅ **GATE GREEN — awaiting lead ack** (Vitest vectors 45/45 + full 170/170; pgTAP 00+20+21 PASS, answer_map 8/8) |
| BE-4 | backend | Rewrite `save_section_answers` + `submit_response` (scalars + selection-replace, resolve code→option_id; required/bounds/hidden-cleanup; HC013) **+ `src/lib/**` adapters/actions**: `toOptions`/`VERSION_TREE_SELECT`, `forms/actions.ts` addItem/updateItem option-row CRUD + app-side code gen, `responses/actions.ts` saveSection selections. | BE-3 | ✅ applied + smoke 5/5; Vitest 170/170; types regen'd (early). **FE contract: editor must emit `optionCode` per row to preserve codes on edit (empty=new).** |
| BE-5 | backend | `clone_form_version` copies option rows (codes verbatim, item-id remap); publish-time "≥1 option" + condition/rule code-existence validation. | BE-2 | ✅ applied + smoke 4/4 (clone-preserves-codes, publish ≥1-option, publish rejects bad code, valid passes); `validate_template_*` now code-based (replaces `5f4de89` TODO). |
| BE-6 | backend | Dashboards/export RPCs (GROUP BY `option.code`, resolve current label) + `dashboard.ts` + export route; regen `database.ts`; update `seed.sql` (option rows + selection rows) **+ rewrite the ~14 pgTAP fixtures to the normalized tables → full pgTAP green**. | BE-4 | ✅ **DONE-BAR GREEN**: full pgTAP **1168/1168** (43 files), Vitest **170/170**, lint 0 errors, tsc 0 errors in owned src/lib (14 = FE `distribution-chart` FE-4 + pre-existing dep-missing), clean `db reset` (migrations+seed). |
| BE-7 | backend | **[STOP for lead]** Squash → single clean baseline via schema dump of the validated local DB (absorbs the 4 pending-remote migrations); `db reset` local; pre/post schema diff proving no object lost; hand lead the exact **human-run** remote re-baseline sequence. | BE-6, T-1✓ | 🔜 |
| FE-1 | frontend | **Builder UI** (components only): `OptionsEditor` gains score + analytics_code fields; `item-editor-dialog`/`block-card` render & edit option rows; build the FormData the backend actions expect. | BE-1 | ✅ DONE — score/analytics_code fields + FormData (`61ef52c`); + **`optionCode` hidden field** so `updateItem` preserves stable codes on edit (BE-6 follow-up); tsc 0-in-my-files, lint+vitest green |
| FE-2 | frontend | **Wizard** (components only): `input-item` renders option rows + emits selected **codes**; the client-side live answer-map (`question_key → code(s)`) MUST mirror the SQL `answer_map` shape (single→scalar code, checkbox→array) or live show/skip diverges from submit; `answer-summary` resolves label/color by code; `validation` required accounts for selections. | BE-1 | ✅ compiles vs contract; answer-map mirror Vitest added (green); ⚠ rehydration `ResponseForFill` gap flagged |
| FE-3 | frontend | **Conditions/rulesets pickers** (components only): `condition-targets`, recommend-when + result-ruleset editors show **labels**, store **codes**. | BE-1 | ✅ DONE — `condition-targets`+`condition-builder`+`describe-visibility` (`61ef52c`) + recommend-when/result-ruleset editors flipped after `PhaseConditionTarget` landed (`5f4de89`); tsc+lint+vitest 170/170 green |
| FE-4 | frontend | **Dashboard components** (`distribution-chart`/`dashboard-charts`) consume `{ code, label, count }`. | BE-6 | ✅ DONE — `distribution-chart` renders `label` (chart nameKey/YAxis + table cell), keys by stable `code`; `dashboard-charts` needed no change (operates at question level). tsc 0-in-my-files, lint+vitest 170/170 green. All FE tasks complete. |
| T-1 | tester | **[gate]** E2E: builder (colors/scores/analytics_code/reorder), wizard (single+multi, option-driven show/skip, bounds), submit+immutability, clone preserves codes, dashboard+CSV resolve current labels, sign-off. Prod-build gate, workers=1. | FE-*, BE-6 | 🟢 **NORMALIZATION-GREEN — handing back to lead for the authoritative full-suite run** (iter 3, 2026-07-01). Both FMN bugs fixed+re-verified. All refactor-touched specs GREEN in isolation: NORM-1..4, phase4-builder(+smoke), phase5-wizard, phase6-signoffs, phase8-dashboard (37/37 incl. AC-4/5a), form-builder-enhancements (incl. AC-14), **case-phase-result 9/9 + recommend-result 9/9** (Bucket-1 fixture debt migrated). Residual full-suite reds (phase3-admin-members, phase10-meetings, phase11-interviews, cases-extras, cases-meetings-minor, phase7-cases) are PRE-EXISTING and OUT OF SCOPE — the branch diff touches ZERO of their code and the seed rewrite touches ZERO of their data (commission-create toast / meeting / interview-attachment / document-upload flows). **Lead authoritative full-suite (standalone server `be8qb57be`): 428/460 pass**; all 26 reds are pre-existing Bucket-3 (git-diff-proven untouched) or server-OOM / render-timeout flakes — **ZERO real refactor failures** (phase5-wizard re-confirmed 0-in-isolation; phase8 full-run reds are all `ERR_CONNECTION_REFUSED` server crashes, not assertions; distribution-count assertions passed). **✅ T-1 GREEN — human-accepted 2026-07-01**; pristine 460/0 skipped by decision (machine resource-exhausted → intermittent app-server OOM = env, not code). Harness fix banked: E2E prod gate must use `node .next/standalone/server.js`, not `next start` (memory `e2e-standalone-server-not-next-start`). |
| QA-1 | qa | Requirements audit (wishlist delivered; translations deferred by design) + RLS review of 2 new tables + evaluator-non-drift confirmation. | T-1✓ | ✅ CHANGES→**APPROVED** 2026-07-01 — MAJOR-1 (reorder-existing-options duplicate-key) RESOLVED via single-txn RPC `reconcile_item_options` + re-verified live (repro passes, codes preserved, INVOKER, published-guard holds); coverage pgTAP `61` (suite 1180/1180) + E2E NORM-5. RLS/immutability/non-drift/clone/dashboards/wishlist all PASS. Cleared for human approval + BE-7 squash. [report](../../docs/reviews/form-model-normalization-review.md) |

**Backend contract (BE-1, posted 2026-06-30 — branch `feat/form-model-normalization`).** Typed
stubs committed so FE compiles against real types now; bodies land BE-2…BE-6.
- `src/lib/queries/forms.ts` — `ItemOption` is now the normalized row `{ id, code, label, color,
  score, analyticsCode, position }`. `VERSION_TREE_SELECT` embeds
  `form_item_options(id, code, label, color_token, score, analytics_code, position)` (the
  `options` jsonb is gone). `toOptions(rows)` re-typed to the embedded rows (stub).
  `ConditionTarget.options` → `ConditionTargetOption[] = { code, label }[]` (condition STORES the
  `code`, picker SHOWS the `label`).
- `src/lib/responses/actions.ts` — `SaveSectionInput` gains `selectionsByItemId: Record<itemId,
  string[]>` (selected option **codes**); `answersByItemId` is SCALARS only. `save_section_answers`
  gains a `p_selections` jsonb arg (replace-semantics).
- `src/lib/queries/dashboard.ts` — `DistributionOption` is `{ code, label, count }` (was
  `{ value, count }`); aggregation keys on `code`, `label` resolved server-side (current version).
- Expected contract-break compile errors are confined to FE-owned `src/components/**` (FE-1…FE-6
  adopt them). My three owned files typecheck clean; the only other `tsc` errors pre-exist on `main`
  (missing `react-day-picker`/`date-fns`/`react-aria-components`/`@internationalized/date` deps).

**FE note (2026-06-30, frontend) — FE-1…FE-3 built against the contract; tsc+lint+vitest GREEN for
all FE-owned files except FE-4 (deferred). Three contract items need lead → backend routing:**
1. **FormData field names for score/analytics_code (FE-1) — ✅ CONFIRMED by backend + `optionCode`
   added.** BE-4 `parseOptions` reads the index-parallel `option`/`optionColor`/`optionScore`/
   `optionAnalyticsCode` exactly as emitted. BE-6 follow-up: added **`optionCode`** hidden field per
   row so `updateItem` matches a submitted option to its existing row BY CODE and preserves it (stable
   analytics + conditions across a label rename); new rows send `""` so the backend mints a fresh code.
2. **`PhaseConditionTarget` → `{ code, label }[]` — ✅ RESOLVED (backend `5f4de89`; FE flip done).**
   `recommend-when-editor.tsx` + `result-ruleset-editor.tsx` now show the option label / store the
   option code (equals + `in` arrays + the live-preview answer selects), mirroring the form
   `condition-builder`. FE-3 fully complete; tsc+lint+vitest green.
3. **Rehydration + submission-detail need choice codes in `ResponseForFill.answersByItemId` /
   submission `answersByItemId` (FE-2).** `prepare.ts`/`toAnswerState` and the read-only views
   (`submission-detail-view`, `phase-answers-readonly` via `AnswerSummary`) read
   `answersByItemId[item.id]`. With `answers.value` now scalars-only, choice answers won't appear
   there unless backend's BE-3/BE-4 `getResponseForFill`/`getSubmissionDetail` **materialize each
   choice item's selected code(s) into `answersByItemId`** (single→scalar code, checkbox→code array) —
   which also matches what the wizard stores and the `answersByKey`/answer-map must be. Recommend
   backend keep `answersByItemId` as that unified code-or-scalar rehydration map so `prepare.ts` and
   the read-only views need NO change (I left them untouched). `AnswerSummary` already resolves
   code → label/color from the item's option rows.

**BE-3 CHECK-BACK (2026-06-30) — evaluator-non-drift gate GREEN, requesting lead ack to start BE-4.**
- `app.answer_map` rewritten (migration `20260630011000_answer_map_rewrite.sql`): rebuilds `question_key → code(s)` from `answers` (scalars) + `answer_selected_options` (single→scalar code, checkbox→array ordered by `option.position`). **Evaluator + TS mirror + shared `__fixtures__` vectors untouched.**
- **Gate evidence:** Vitest evaluator vectors **45/45** (full Vitest **170/170**); pgTAP `00_setup` + `20_conditions` + new **`21_answer_map.sql` 8/8** PASS — incl. two assertions that `eval_condition` agrees on the rebuilt map (equals + `in`), the direct non-drift proof.
- TS sibling `buildAnswerMaps` in `responses.ts` (exported), consumed by `getResponseForFill` + `getSubmissionDetail` → unified `answersByItemId`/`answersByKey` in the canonical shape (FE's `prepare.ts` + read-only views unchanged). `answer_selected_options` reads use an untyped-client cast until BE-6 regen.
- **SCOPE FLAG for the gate (T-1):** BE-2 dropping `form_items.options` means the shared pgTAP fixture `00_setup.sql` (✅ updated to option rows) AND ~14 other `supabase/tests/*.sql` files that insert `options`/choice-`answers` directly (100_dashboard, 10_immutability, 30_submit_response, 40_rls, 50/51/52, 60_builder, 80_signoffs, 130_audit, 160_phase_results, 172, 144 …) will fail until rewritten to `form_item_options` + `answer_selected_options`. That fixture rewrite rides with BE-4/BE-6 (which rewrite the save/submit/dashboard code those tests exercise). Flagging so it's not a surprise at the gate.

**BE-7 SQUASH COMPLETE (2026-07-01, backend) — single clean baseline, proven equivalent.**
Replaced all 53 migrations with one `supabase/migrations/20260620000000_baseline.sql` = a schema-only
`supabase db dump` of the fully-migrated local DB (absorbs the 4 pending-remote 20260630000004/5/6/7 +
the refactor chain). The dump is lossy for 5 things, each CARRIED into the baseline from the live DB and
verified: (1) storage buckets + object policies (FINAL post-NSP-per-org state); (2) app config data —
feature_flags (14) + app_secrets (mrn_pepper); (3) global config vocabularies (referral_types /
reply_outcomes / pqs_event_types / pqs_sentinel_criteria — 29 rows, referenced by seed.sql + tests);
(4) the two auth.users triggers; (5) the **hardened privilege posture** — pg_dump does NOT re-emit
REVOKE-from-default ACLs, so a naive dump silently re-grants anon to everything and **re-opens the
isolated-PHI tables (event/case/referral_patient, patient_xref) + the case_referral column-grant model to
authenticated**. The posture block re-asserts the anon/PUBLIC lockdown, the PHI single-door REVOKEs, and
the case_referral granular re-grant. **EQUIVALENCE PROVEN:** empty SORTED pre/post `pg_dump` diff (every
DDL/grant/policy/trigger present in both), direct live checks (all 4 PHI tables + zero anon grants +
case_referral 0 table-SELECT/27 column-SELECT), full pgTAP **1180/1180**, Vitest **170/170**, clean
`db reset` (baseline + normalized seed). **Remote re-baseline is the human-run step (handed to lead);
I did NOT run it.**

**QA MAJOR-1 RESOLVED (2026-07-01, backend) — reordering an existing item's options failed with duplicate-key.**
`reconcileOptionRows` updated each kept row's `position` in SEPARATE supabase-js calls = separate
transactions; `unique(item_id, position)` is DEFERRABLE but not INITIALLY DEFERRED and deferral can't span
transactions, so moving an option UP into an occupied slot raised `form_item_options_item_id_position_key`
and the reorder was silently lost. **Fix:** a set-based SECURITY-INVOKER RPC `reconcile_item_options(item_id,
p_options jsonb)` (migration `20260630017000`) folds the whole reconcile — delete removed / update kept /
insert new (temp high-position band) / assign ALL positions in ONE statement — into a single transaction,
where the DEFERRABLE constraint tolerates the transient collisions (the proven `reorder_phase_results`
`unnest … with ordinality` pattern). `reconcileOptionRows` now generates codes for NEW rows app-side
(Decision 2 preserved) and calls the RPC ONCE; the per-row position loop is gone. staff_admin-write RLS +
`guard_published_structure` (draft-only) still apply (SECURITY INVOKER). New pgTAP `61_option_reconcile.sql`
(9 assertions): the exact repro (reorder UP into an occupied slot → no violation), codes preserved through
reorder, add/remove/reorder atomic, kept-row content update with frozen code, duplicate-code rejection
(HC013). Live-verified the published-structure guard blocks reconcile on a published item. Full pgTAP
1180/1180, Vitest 170/170, owned lint+typecheck clean, clean `db reset`.

**BUG-FMN-002 RESOLVED (2026-06-30, backend) — sign-off review omitted choice answers.**
`get_response_for_signoff.answers_by_item` read `answers.value` only → every CHOICE answer (now in
`answer_selected_options`) was missing from the review-and-sign surface (FBE AC-14: MC label absent).
Fix: extracted `app.answer_map_by_item(response_id)` — the canonical SQL home for by-item_id
materialization (SQL twin of TS `buildAnswerMaps`' answersByItemId; same shapes as `app.answer_map`) —
and pointed `answers_by_item` at it (migration `20260630016000`; 3 access gates + `answers` +
`observations_by_item` byte-for-byte unchanged). Verified LIVE: the seeded staff_admin-pending response
now returns `{b101:"sim", b102:"nao", b104:"sim"}` for its choice items (was `{}`). pgTAP `21_answer_map`
+3 assertions (now 11); full suite 1171/1171, Vitest 170/170.

**CLASS SWEEP — "reads answers.value / builds an answer map" — COMPLETE, no third sibling.** Grepped
every SQL fn in `supabase/**` and every TS path in `src/lib/**`. Status of each:
- `app.answer_map` / `app.answer_map_by_item` (NEW) / `app.case_phase_answer_map` — selections+scalars ✅
- `submit_response` / `response_required_complete` — "value OR ≥1 selection" ✅
- `list_signoff_queue` — via `app.answer_map` ✅ · `get_response_for_signoff` — now both maps ✅ FIXED
- `dashboard_distributions` / `dashboard_export_rows` — selections→code ✅
- `dashboard_free_text` (item_type='free_text') + `app.assert_item_bounds` (number/date) — `answers.value`
  reads that are **scalar-only by filter**, correct by design ✅
- `save_section_answers` — writes answers(scalar)+selections ✅
- TS `buildAnswerMaps` → `getResponseForFill`/`getSubmissionDetail` ✅ · TS `signoffs.ts` is a pure
  pass-through of the RPC payload (inherits the SQL fix) ✅ · TS `conditions.ts` is map-agnostic ✅
Every CHOICE-path `answers.value` read is now normalized; the only remaining `answers.value` reads are
the two scalar-only paths, correct by design.

**BUG-FMN-001 RESOLVED (2026-06-30, backend) — PGRST201 embed ambiguity in the version-tree read.**
`answer_selected_options` gave PostgREST a 2nd form_items↔form_item_options path (direct FK + inferred
M2M), so the bare `form_item_options(...)` embed in `VERSION_TREE_SELECT` (`src/lib/queries/forms.ts`)
returned PGRST201 — emptied the builder, 404'd the wizard (every version-tree read). Fix: pinned the
embed to the direct FK `form_item_options!form_item_options_item_id_fkey(...)`. **Audited all of `src/`:
the ONLY `form_item_options` embed (dashboards/process-templates use SQL RPCs, not embeds;
`answer_selected_options` is only ever `.from()`, never nested) — the one hint kills the whole class.**
Verified LIVE via REST against the seeded local DB: bare embed → PGRST201 (reproduced); hinted embed →
option rows return (dispensador_disponivel/turno_auditoria/epis_observados resolve codes+labels, no
error). Vitest 170/170, forms.ts typecheck clean. SQL smoke/pgTAP missed it (it only manifests through
supabase-js embeds, not raw SQL).

**BE-6 COMPLETE (2026-06-30) — full backend done-bar GREEN, ready for lead → FE-4 + tester.**
- Dashboards: `dashboard_distributions` now emits `option_code` + `option_label` (was label-only `option_value`), GROUP BY code, current label resolved from the latest published version; `dashboard_export_rows` renders choice cells as current label(s) (checkbox joined `'; '`). `dashboard.ts` already consumes `{code,label,count}` (BE-1); `export/route.ts` needs no change (pre-rendered strings). Smoke 2/2 incl. rename-survives (v2 relabels an option, distribution still counts by code + shows the NEW label).
- **Product-correctness fix found via pgTAP:** `app.case_phase_answer_map` still read only `answers.value`, so cross-phase recommendations + result rulesets over CHOICE questions never matched under the normalized model. Rewrote it to mirror `app.answer_map` (migration `20260630015000`). This is a real bug the fixture conversion surfaced, not just test upkeep.
- `seed.sql` rewritten to option rows + `answer_selected_options` selections; conditional-section + recommend_when values are now option CODES. Clean `db reset` passes.
- **Full pgTAP 1168/1168 (43 files)** — the ~14 fixtures converted (10 by me: 90/160/161/100/130/10 + the case_phase_answer_map fix; 5 via two backend sub-agents: 50/51/60 and 52/80; `30_submit_response` needed no change). Convention: option `code` = lowercase ASCII slug of label (Sim→`sim`, Não→`nao`, Luvas→`luvas`, A→`a`). Two `10_immutability` subtests retargeted from `answers` to `answer_selected_options` (same immutability intent; the choice answer moved tables) — no plan() count changes anywhere.
- `database.ts` regenerated against the final applied schema.

**BE-4 → FRONTEND coordination (NEW, needs FE-1 follow-up):** `updateItem` preserves an option's
stable `code` across edits by matching the submitted row to its existing row **by code**. The editor
(`item-editor-dialog.tsx`) currently emits `option`/`optionColor`/`optionScore`/`optionAnalyticsCode`
but **NOT `optionCode`** — so every edit currently looks like an all-new option set and would
REGENERATE codes (breaking analytics stability + any condition referencing the old code). **FE fix
(one hidden field):** emit an index-parallel `<input type="hidden" name="optionCode" value={opt.code ?? ""} />`
per option row — existing rows carry their `code` (already on `ItemOption`), brand-new rows send `""`.
`addItem` doesn't need it (all rows are new). Flagged for the lead to route to frontend.

**Backend ACK (2026-06-30) — all three FE items confirmed + folded into the downstream tasks (lead-approved):**
1. **CONFIRMED** the field names — BE-4 `parseOptions`/`parseItemFields` read `option`/`optionColor`/`optionScore`/`optionAnalyticsCode` (index-parallel; `""` = none for score/analytics_code).
2. **BE-5** changes `PhaseConditionTarget.options` → `{ code, label }[]` in `src/lib/queries/process-templates.ts`, projects codes in `phaseConditionTargets`, and makes `recommend_when`/`result_ruleset` stored values + `validate_template_recommend_when`/`validate_template_result_ruleset` code-based with code-existence checks.
3. **BE-3/BE-6** materialize choice selections into `answersByItemId[item.id]` (single→scalar code, checkbox→code array, scalars→raw) in `getResponseForFill` + `getSubmissionDetail` — the by-item_id sibling of the by-question_key `answer_map`; `prepare.ts` + read-only views unchanged.

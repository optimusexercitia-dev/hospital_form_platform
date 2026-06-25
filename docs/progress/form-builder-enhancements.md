# Archive — Form Builder Enhancements (mini-phase)

> Archived verbatim from PROGRESS.md on 2026-06-25 at the §7 progress-tracker cleanup.
> This is the durable detail; PROGRESS.md keeps only a one-line pointer.

### Feature — Form Builder Enhancements (new question types · option colors · per-question conditions · observations) — ✅ COMPLETE (gate APPROVED · Human ✅ 2026-06-23)

> Seven additive author/respondent capabilities (plan
> [docs/plans/form-builder-enhancements.md](docs/plans/form-builder-enhancements.md), human-APPROVED
> `12a89fc`): `short_text`/`number`/`date`/`time` item types; per-option colors on
> multiple_choice+checkbox; per-question conditional appearance (flat ALL/ANY groups + `gt/gte/lt/lte`
> ops); optional per-answer observations. **Backward-compatible, additive migration, NO feature flag,
> NO data migration.** Dashboard aggregation/colored charts DEFERRED. Run as a mini-phase (§6 gate) —
> touches migrations + the condition evaluator + the submit RPC. Branch `feat/form-builder-enhancements`.
> **✅ GATE CLOSED 2026-06-23.** Build green (tsc/lint 0 · vitest 113/113 · pgTAP **870/870** · prod build OK) ·
> E2E `form-builder-enhancements` **15/15** + phase4 8/8 (clean DB) · full-suite **0 regressions** vs the `main`
> baseline · QA **APPROVED** ([review](docs/reviews/form-builder-enhancements-review.md) — 1 MAJOR fixed + MINORs
> cleared) · Human ✅ 2026-06-23. Commits `89989df`→`ef1e040`; ADR
> [0040](docs/decisions/0040-form-builder-enhancements-condition-engine.md). **Remote: migrations
> `…120000/130000/140000` already applied (remote in sync, `db push` = no-op; NO flag → feature live on remote).**
> ✅ **Resolved 2026-06-23:** the fix-loop's `db reset --linked` had reset+reseeded remote and reverted the
> out-of-band `patient_index` flag → OFF (was manually ON per Phase-23) — **re-enabled + verified ON** on remote.

> ## ▶ RESUME CHECKPOINT — paused 2026-06-23 — **[SUPERSEDED: resumed + gate CLOSED; feature ✅ complete. Sole open item: re-enable remote `patient_index` flag — Follow-ups]**
>
> **Where we are:** build complete + E2E gate green (no regressions). QA returned **CHANGES REQUESTED**
> (one MAJOR + MINORs); **all QA fixes have LANDED** — FE `b80c5ba` (number-condition value coercion +
> a11y MINOR-1/3 + new `condition-builder.test.ts`), BE `cf6dcfb` (publish-time number-value guard
> MAJOR-1 net + MINOR-2 + INFO-1; pgTAP **870/870**). **HEAD at pause: `b80c5ba`.**
>
> **In-flight at pause (VERIFY with `git log`/`git status` on resume):** the **tester** (`af9e7dd0464433361`)
> was finishing (a) the `prefer-const` lint nit at `e2e/form-builder-enhancements.spec.ts:747` and (b) a
> **number-condition E2E** (AC-15: build `<number> gt 5` via ConditionBuilder, fill **10 → shows**, **3 →
> hidden** — the multi-digit lexical≠numeric guard for MAJOR-1), then a fresh-reset re-run of
> `form-builder-enhancements.spec.ts` + `phase4-builder.spec.ts`. At pause its spec edit was **uncommitted**
> (`M e2e/form-builder-enhancements.spec.ts`). The QA review doc `docs/reviews/form-builder-enhancements-review.md`
> was **untracked** (committed at this checkpoint).
>
> **Remaining steps to close the gate (in order):**
> 1. Confirm the tester's lint fix + number-condition E2E are committed & the subset is GREEN (re-dispatch
>    tester `af9e7dd0464433361` if it didn't finish; the FE fix `b80c5ba` makes the number E2E pass).
> 2. **QA re-review** — route the QA-fix diff (`cf6dcfb`+`b80c5ba`+ tester's number-E2E) to QA
>    (`a99c26051bfdff186`); expect **APPROVED** (MAJOR-1 fixed both sides + now covered; MINOR-1/2/3 + INFO-1 cleared).
> 3. **Human approval** — present the gate summary + the pre-existing-contamination finding (below).
> 4. **Remote deploy (HUMAN-GATED, not yet done):** `supabase db push` to apply migrations
>    `20260623120000` + `130000` + `140000` to remote. Deferred all session; needs explicit user go-ahead.
> 5. **Record (§6.5):** flip this feature → ✅; update `docs/backend-state.md` (the 3 new migrations: form-builder
>    additive schema + evaluator ops + submit forward-pass; BE-8 sign-off observations; BE-9 number-value guard);
>    update memory `condition-targets-choice-types-only` (now WIDENED to number/date/time per ADR 0040); final commit.
>
> **Warm-teammate agent IDs (same-session resume via SendMessage):** backend `a49907074955eb291` ·
> frontend `aa9ee5d38f59d8022` · tester `af9e7dd0464433361` · qa `a99c26051bfdff186`. (Fresh session: re-spawn
> as needed; all context is in this file + the plan + ADR 0040.)
>
> **Key artifacts:** plan `docs/plans/form-builder-enhancements.md`; ADR `docs/decisions/0040-…`; migrations
> `supabase/migrations/20260623{120000,130000,140000}_*.sql`; QA review `docs/reviews/form-builder-enhancements-review.md`.
>
> **Non-blocking follow-ups (do NOT gate this feature):** (a) **pre-existing full-serial-suite contamination** —
> ~17–19 failures on BOTH this branch AND `main` (0 net new from this feature; the 2 branch-unique failures are
> proven contamination/flaky churn) — a separate spec-isolation effort (phase13-saga class); (b) the FBE E2E spec
> builds fixtures in the **seeded CCIH commission**, not a throwaway (QA INFO-4) — harden if it joins the full gate
> matrix; (c) gate practice: declare via **prod build** (`next start`) — the **dev server crashes** under the full
> serial run (`uncaughtException: Error: aborted`); the **lead** runs the full suite (subagents drop on long runs).

Backend (`backend`):

| # | Task | Status |
| - | ---- | ------ |
| BE-1 | **Contract-first typed stubs** — `forms.ts` (`ColorToken`/`ItemOption`/`InputItemType`+4/`ItemConfig`/`Item.{options:ItemOption[],config,visibleWhen}`/`toOptions` normalizer); `conditions.ts` (`ConditionOp`+4 ops/`ConditionGroup`/`Visibility`/`evalVisibility` sig); `forms/actions.ts` + `responses/actions.ts` FormData/param additions. Update backend-owned (`src/lib/**`) readers; **list frontend-owned `item.options` readers** for FE sweep. Post signatures + SQL implementation plan to lead. | ✅ `89989df` — contract landed; FE-sweep list (13 files) + SQL plan posted; SQL plan APPROVED. |
| BE-2 | Migration `20260623120000_form_builder_enhancements.sql` — `form_items` item_type CHECK +4 / input-vs-display / options-shape relax (`app.is_valid_options`) / `visible_when`+`config` cols + CHECKs / conditional-not-required CHECK; `form_sections` visible_when CHECK → `app.is_valid_visibility`; `answers.observation`; helpers `app.is_valid_condition`/`is_valid_visibility`/`is_valid_options`. Regen types `--local`. **NO remote push.** | ✅ migration applies clean on `db reset`; full seed re-validates (backward-compat proof — every relaxed CHECK a strict superset); `database.ts` regenerated `--local`. |
| BE-3 | Condition engine — SQL `app.eval_condition` +4 ops / `app.eval_visibility` / `validate_visible_when` extended to ITEMS (forward-ref/self-ref reject, op↔target-type) **and group-aware SECTION validation**; TS `evalCondition` +4 ops + `evalVisibility`; shared vectors (`condition-vectors.json` +17 / new `visibility-vectors.json`). **Drift is phase-blocking.** | ✅ TS+SQL mirror green on shared vectors; `validate_visible_when` walks BOTH section (earlier-section semantics) + item (doc-order tuple) conditions, both group-aware, via `app.assert_condition_op_target`. |
| BE-4 | `submit_response` per-item visibility forward pass (`v_eff` map, clear hidden answers, drop hidden keys) + number/date min/max (**HC061**) enforcement; `clone_form_version` copy `visible_when`/`config`; `save_section_answers`+`saveSection` observation upsert (DROP+CREATE 5-arg, grants re-applied; touches only `observation`); widen `conditionTargets` to number/date/time (carry target `type`). | ✅ submit forward-pass clears hidden-item strays + enforces present-only min/max (HC061 below-min/above-max); clone copies both cols; observations isolated from `value`. |
| BE-5 | SQL tests — `20_conditions.sql` (+ops +`eval_visibility` group), new `51_item_visibility_validation.sql` (item forward/self-ref reject, conditional-not-required CHECK, op↔type mismatch, group section), new `52_submit_item_visibility.sql` (hidden-item cleared + min/max blocks + clone). Vitest `conditions.test.ts` (+ops + `evalVisibility`). | ✅ **full pgTAP 867/867** (34 files, no regression); **vitest src/lib 94/94**; typecheck `src/lib` 0, lint 0. |
| BE-6 | **Close FE gap #1** — route `updateSection` (`forms/actions.ts:347`) through the group-aware `parseVisibleWhen(formData)` (drop the legacy `conditionKey`/`conditionOp`/`conditionValue` parse) so section conditions authored in the shared `ConditionBuilder` persist; clear→null; default-section guard (DB CHECK `form_sections_default_shape`). | ✅ `updateSection` now reads the shared `visibleWhen` JSON field via `parseVisibleWhen` (absent→null clear; preserve dialogs re-emit via `SectionConditionFields`); default-section posts a `visibleWhen`→friendly pt-BR error (`defaultSectionNoCondition`); dead `conditionInvalid` msg removed. Confirmed `section-settings-dialog` is the editor + no caller posts legacy `conditionKey`. |
| BE-7 | **Close FE gap #2** — surface `answers.observation` in the read query shapes (`SubmissionDetail` in `queries/submissions.ts`; `ResponseForFill`/`ClientResponseForFill` in `queries/responses.ts`) as `observationsByItemId` so read views render the observation line (FE props already optional + wired). | ✅ `observationsByItemId: Record<string,string>` added to `ResponseForFill` + `SubmissionDetail` (selects `observation`, non-null/non-empty per item_id; collected independent of the value guard for observation-only rows). No migration (column exists since BE-2); no `database.ts` change (row interfaces hand-written). |
| BE-8 | **Observations on the sign-off read path** (unblocks FE-5) — `CREATE OR REPLACE get_response_for_signoff` (new migration) adds an `observations_by_item` projection (sibling of `answers_by_item`, non-null/non-blank); map into `ResponseForSignoff.observationsByItemId` in `queries/signoffs.ts`. **Gating byte-identical** (additive projection only). | ✅ migration `20260623130000_signoff_observations.sql`; all 3 gates reproduced verbatim (no RLS/scope change); `observationsByItemId` mapped in query layer; pgTAP `80_signoffs.sql` +1 assertion (obs round-trips). Full pgTAP **868/868**, full-tree tsc 0 / lint 0 / vitest 106/106. No `database.ts` change (RPC returns `jsonb`). |
| BE-9 | **QA MAJOR-1 safety net + cleanups** — publish-time guard that a `number` condition carries a JSON-number value (`app.assert_condition_op_target`); trim stale `serializeOptions` BE-1 stub comment (MINOR-2); delete dead throwing `questionConditionTargets` server stub (INFO-1; live caller uses the client twin). | ✅ migration `20260623140000_number_condition_value_guard.sql` (number target + scalar op ⇒ `jsonb_typeof(value)='number'`, else `check_violation` "condição numérica … valor numérico"; date/time text, choice unchanged); pgTAP `51` +2 (string value rejected / numeric accepted). Full pgTAP **870/870**; full-tree tsc 0; my files lint 0; vitest 113/113. No `database.ts` shift. ⚠ unrelated lint **error** in tester-owned `e2e/form-builder-enhancements.spec.ts:747` (`prefer-const`) — flagged to lead. |

Frontend (`frontend`):

| # | Task | Status |
| - | ---- | ------ |
| FE-1 | Builder type meta + item dialog — `item-type-meta.tsx`/`add-block-menu.tsx` pt-BR labels (Resposta curta/longa, Número, Data, Hora) under "Perguntas"; `item-editor-dialog.tsx` (short/long no options; number/date Mínimo/Máximo→`config`; time plain); `options-editor.tsx` per-row colour picker (mc+checkbox, "sem cor" default; reuses `TOKEN_COLOR_VAR` palette). | ✅ local-green — `tsc` 0 / `lint` 0 / `vitest` 106/106. `frontend-design` applied |
| FE-2 | `ConditionBuilder` (NEW `condition-builder.tsx` + pure `condition-targets.ts`) — reusable ALL/ANY + condition rows (target picker = earlier-in-doc-order inputs → op filtered by type → value control); disables+clears "obrigatória" when ≥1 condition. Wired into `item-editor-dialog.tsx` (questions) + refactored `section-settings-dialog.tsx`/`section-condition-fields.tsx` to reuse it (serializes group shape via `visibleWhen` JSON; legacy single round-trips). | ✅ local-green — **DEP: needs `updateSection` to read `visibleWhen` JSON (see CONTRACT note below)** |
| FE-3 | Fill inputs + colors + observations — `input-item.tsx` render switch (short_text/number/date/time, pt-BR number comma I/O, date min/max); colored mc+checkbox rows (left-accent + `TOKEN_STYLES` chips); "Adicionar observação" 2-line affordance on non-free-text items. **Swept all `item.options` readers** (block-card, read-only-tree, input-item, item-editor-dialog, section-settings, answer-summary, submission-detail, recommend-when/result-ruleset op-maps). | ✅ local-green |
| FE-4 | Item-level visibility + summary — NEW pure `effective-visibility.ts` `computeEffectiveVisibility` (doc-order forward pass mirroring submit RPC; group-safe `evalVisibility`; drops hidden keys; cascades) shared by wizard + read views; `use-wizard.ts` consumes it + `setObservation` + orphan-clear hidden items (cross-section warn / same-section silent); `validation.ts` skip-hidden + number/date min/max; `types.ts` `AnswerRecord.observation`; `wizard-client.tsx`/`section-step`/`review-screen` thread `observationsByItemId` + `visibleItemIds`; `answer-summary.tsx`/`submission-detail-view.tsx`/`review-and-sign.tsx` number/date/time format + colored chip + observation line + item-level hide. 6 new `computeEffectiveVisibility` unit tests. | ✅ local-green |
| FE-5 | **BUG-FBE-001 fix + read-surface observation audit** — submission-detail page now passes `observationsByItemId={detail.observationsByItemId}` (BE-7); `phase-answers-readonly.tsx` threads `response.observationsByItemId` into `AnswerSummary`; `prepare.ts` `toAnswerState` rehydrates observations into wizard `initialAnswers` (resume + review). Sign-off review still blocked on BE-8 (see DEP note). | ✅ local-green — `tsc` 0 / `lint` 0 / `vitest` 106/106 |
| FE-6 | **Sign-off review observations (post-BE-8 `bf2a945`)** — `ClientResponseForSignoff` + `toClientResponseForSignoff` (`signoffs/types.ts`, `signoffs/adapt.ts`) now carry/map `observationsByItemId`; threaded through `ReviewAndSign → ReviewSection → SectionBody → AnswerSummary` (page/`SignRunner` unchanged — already pass the full `clientData`). The FE-4 observation line on the sign-off review now renders the real prop. **Observations now render on EVERY read surface** (fill/resume, submission detail, sign-off review). | ✅ local-green — `tsc` 0 / `lint` 0 / `vitest` 106/106 |
| FE-7 | **BUG-FBE-004 (BLOCKER) — persist observations through the save adapter** — `wizard-runner.tsx`'s inline `saveSection`/`saveAndExit` adapter input literals omitted `observationsByItemId` (and didn't forward it), silently dropping it at the server-action seam even though `use-wizard` collected it and the action/RPC accepted it (structural typing hid it). Fix: rebind both adapter inputs to `Parameters<WizardActions["saveSection"/"saveAndExit"]>[0]` (the single source of truth, so a dropped field is now a compile error) and forward `observationsByItemId` in both calls. **Full write path now wired: wizard → `save_section_answers` → DB `answers.observation`.** | ✅ local-green — `tsc` 0 / `lint` 0 / `vitest` 106/106; live round-trip via tester FBE re-run |
| FE-8 | **QA CHANGES-REQUESTED — MAJOR-1 + MINOR-1/3** — (MAJOR-1, blocker) `condition-builder.tsx` `toCondition` now serializes a **number**-target value as a JSON **number** (`Number(...)`, NaN-guarded in `isRowComplete`), keyed on `ConditionTarget.type`; date/time/choice keep strings/array. `toDrafts` read-back stringifies the JSON number for the `<input type=number>`. Was emitting `"5"` → evaluators fell to lexical compare (`"10"<"5"`) → wrongly hidden. NEW `condition-builder.test.ts` (7 cases: number→JSON number, date/time/choice/`in` typing, number round-trip). (MINOR-1) added pt-BR `DialogDescription` to `item-editor-dialog.tsx` + `section-meta-dialog.tsx`. (MINOR-3) wired the number bounds hint into the input's `aria-describedby` in `input-item.tsx`. | ✅ local-green — `tsc` 0 / `lint` 0 / `vitest` 113/113; number-condition E2E to be added by tester |

> **CONTRACT note (frontend → backend, blocks section conditions at runtime).**
> Committed `updateSection` (`src/lib/forms/actions.ts:391`) still reads the LEGACY
> discrete `conditionKey`/`conditionOp`/`conditionValue` fields (only equals/not_equals/in,
> single shape). FE-2 moved sections to the shared `ConditionBuilder`, which serializes the
> group shape via a `visibleWhen` JSON field (same as `addItem`/`updateItem`). **Requested:
> make `updateSection` use the same `parseVisibleWhen(formData)` path** (read `visibleWhen`,
> clear the legacy fields). Until then, saving a SECTION condition is a no-op at runtime
> (item conditions work). FE compiles green against the group shape and is ready the moment
> that lands. (Couldn't reach lead by name mid-session — flagging here + in handoff.)
>
> **DEP note (read-view observation rehydration) — RESOLVED.** BE-7 surfaced
> `observationsByItemId` on `SubmissionDetail` + `ResponseForFill` (wired in FE-5: submission
> detail / `PhaseAnswersReadonly` / wizard resume), and BE-8 (`bf2a945`) surfaced it on
> `ResponseForSignoff` (wired in FE-6: sign-off review via the client adapter). Observations
> now render on every read surface — no remaining FE↔BE observation dependency.

Tester (`tester`): **build complete** — full tree green (tsc 0 · lint 0 · vitest 106/106 + src/lib 94/94 · pgTAP 867/867 · clean `db reset` + backward-compat proof · **prod build green**). Spawned for the §6.2 test pass.

| # | Task | Status |
| - | ---- | ------ |
| QT-1 | E2E `e2e/form-builder-enhancements.spec.ts` — builder (add each new type, color options, build a QUESTION condition + confirm "obrigatória" disables, build a SECTION condition, number/date min/max); fill (render all new inputs, live show/hide incl. same-section AND cross-section ref, pt-BR number, add observation); submit (hidden answer cleared, min/max blocks = HC061); read views (observation + colored chip render). ≥1 keyboard-only flow. Chromium `--workers=1`, fresh `db reset`; during fix loop run only failing + current-phase specs (lead runs full suite to declare green). | 🏗️ in progress — **21/21 PASS** confirmed (FBE 13/13 + phase4 8/8) after BUG-FBE-004 fix (`deb436c`). BUG-FBE-002/003/004 all RESOLVED. **AC-14 added** (sign-off observation surface, BE-8/FE-6) — 14 tests total, parse-clean. **Lead runs FBE 14-test + full declaring suite to call gate green.** |

QA (`qa`): _spawned after tester reports green._ Writes `docs/reviews/form-builder-enhancements-review.md`.

---


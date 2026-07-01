# Answer-Model v2 — machine-switch handoff (2026-07-01)

> **Purpose.** Self-contained continuation note so a fresh session on another machine can
> finish the **answer-model-v2** mini-phase without re-deriving context. Everything is
> committed on branch `feat/answer-model-v2`. This doc travels via git.

## TL;DR — where we are

| Gate step (CLAUDE.md §6) | State |
| --- | --- |
| 1. Build complete | ✅ **Done.** Backend BE-0..BE-5 (`e13b2dc`) + Frontend FE-1/FE-2 (`ca7d4ea`, `e5d30de`). Lint + typecheck clean; **pgTAP 1202**, **Vitest 176**; clean `supabase db reset --local`. |
| 2. Test pass | 🧪 **In progress, PAUSED.** E2E spec `e2e/answer-model-v2.spec.ts` written (DV-1..DV-6) but **UNVERIFIED** (tester interrupted mid-run). Full E2E suite **not yet run**. |
| 3. QA review | ⬜ Not started. |
| 4. Human approval | ⬜ Not started. |
| 5. Record + re-squash | ⬜ Not started. Remote is UNTOUCHED — nothing pushed. |

**Branch:** `feat/answer-model-v2` (off `main`). **Head:** `e13b2dc`. Working tree is clean once the
paused-state commit lands (this handoff + the E2E spec + PROGRESS.md updates are committed together).

## Confirmed kickoff decisions (human, 2026-07-01) — do not re-litigate
1. All six locked plan defaults as written (additive forward-only migrations; reserved
   `answers.confidentiality_level` now, unenforced; default-values = schema + minimal builder UI +
   wizard prefill; `form_items.parent_item_id` now, always NULL; **no feature flag**; no
   `value_text`/`answered_by`).
2. **End-of-package re-squash 2→1 into a fresh clean baseline** (like form-model-normalization). Do
   this at the Record step; the **human runs the remote re-baseline**.
3. **Remote `supabase db push` is USER-run.** Everything so far is validated **local only**
   (`supabase migration up` / `supabase db reset --local`; `.env.local` → local Supabase). Do NOT
   attempt remote deploy from an agent.

## What shipped (commits on `feat/answer-model-v2`)
- `91922c1` docs: kickoff (plan + ADRs 0045/0046)
- `71a1fb0` **BE-0** contract stubs (`Item.defaultValue`/`parentItemId`; `AnswerRecord.answeredAt`; `defaultValue` FormData field)
- `ca7d4ea` **FE-1** builder "Valor padrão" control (`src/components/forms/default-value-editor.tsx` + `item-editor-dialog.tsx`)
- `e5d30de` **FE-2** wizard default prefill (`use-wizard.ts` `withDefaults`) + 6 tests
- `e5eaf55` docs: FE progress
- `e13b2dc` **BE-1..BE-5** — the two migrations + RPC rewrites + pgTAP + regen types

### Migrations (forward-only additive on `20260620000000_baseline.sql`; baseline NOT edited)
- `supabase/migrations/20260701000000_answer_model_v2_definition.sql` — BE-1: `form_items.parent_item_id`
  (self-FK cascade, always NULL) + `default_value jsonb` + display-null CHECK; new `response_group_instances`
  table (INERT until repeating groups ship) + RLS (member-read / creator-write-in_progress, mirroring the
  **inline `answers` predicate verbatim** — `app.commission_of_response` does NOT exist) + submitted guard.
- `supabase/migrations/20260701000010_answer_model_v2_answers.sql` — BE-2/3/4: `answers` new columns; two
  partial-unique indexes (`answers_uq_top` where group_instance_id is null / `answers_uq_inst` where not null);
  `answer_selected_options` re-keyed to `answer_id` (PK `(answer_id, option_id)`, index, RLS via `answer_id→answers`);
  `app.sync_answer_typed_values` (BEFORE INS/UPD, exception-guarded casts — **never fails a save**, `value` jsonb
  stays canonical); `app.guard_submitted_selections` twin; `reject_invalid_selection` re-keyed; `answer_map` /
  `answer_map_by_item` / `case_phase_answer_map` re-sourced via `answer_id`; `save_section_answers` /
  `submit_response` / `response_required_complete` re-keyed; `clone_form_version` copies default_value + remaps
  parent_item_id; `publish_form_version` validates default_value → **HC080**.

### The keystone invariant (Rule 3) — verified
The **evaluator is untouched**: the answer migration does NOT redefine `app.eval_condition`/`eval_visibility`,
and no TS twin (`conditions.ts`/`effective-visibility.ts`) is in the branch diff. Only `app.answer_map` (the
rehydration layer) and data-sourcing changed. Guarded byte-for-byte by **`supabase/tests/60_answer_map_golden.sql`**
(expected jsonb frozen from the pre-change baseline). **If `60_answer_map_golden` ever fails, that is phase-blocking.**

## RESUME — do these in order

### 1. Finish the tester gate (spawn `tester`, qa-tester)
The tester wrote `e2e/answer-model-v2.spec.ts` but was interrupted while fixing **DV-4**. Known issue: DV-4
(`~line 544-564`) has a **dead PostgREST subselect** in the `responses?...in.(select id from ...)` query — the
code already falls back to resolving via `versionId`, but the first query should be removed/cleaned so it isn't
misleading. Do a quick read-through of the whole spec before running (it's hermetic: spec-owned forms tagged
`AMV2-SPEC`, purged by title in before/afterAll; personas `chefe.ccih@` builder + `staff1.ccih@`/`staff2.ccih@`
respondents; needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`).

Then, per project memory:
- **Scoped feedback runs (tester):** new spec + the form-builder + wizard/fill + dashboard/export regression
  specs, **chromium, `--workers=1`**, one **foreground** command that does `supabase db reset --local`
  (pw `postgres`) + builds/starts the **prod standalone** server (`node .next/standalone/server.js` + copy
  static/public — `e2e-standalone-server-not-next-start`), clearing port-3000 zombies first
  (`e2e-foreground-run-recipe`).
- **The full E2E suite is LEAD-owned** (`subagent-cannot-run-full-e2e`): after the tester's scoped run is green,
  the **lead** runs `npx playwright test` (full regression) as a **background** command against the prod-standalone
  build, triaged vs the known flaky baseline (`e2e-prod-build-flaky-baseline` — ~18-27 pre-existing flaky
  failures; run a baseline first if in doubt).

### 2. Triage BUG-AMV2-001 (see PROGRESS.md bug table)
Tester flagged that the **HC080** publish rejection (correct at the RPC layer, pgTAP-covered) may not surface its
pt-BR message in the **builder Publish UI**. Verify: trigger an invalid default and publish via the UI — is the
`o valor padrão da pergunta "…" é inválido` message shown, or a generic error? If generic, it's a small
**frontend** error-mapping fix (map HC080 like other HC0xx codes). May be low-priority/moot if the FE option-prune
makes invalid choice-defaults unreachable — confirm scope before treating as a real defect. Fix loop: engineers
fix app code, tester re-runs, never the reverse.

### 3. QA review (spawn `qa`, qa-reviewer, after tester green)
Audit against CLAUDE.md + ADRs 0045/0046: requirements coverage, **evaluator parity** (golden test), RLS on the
new surfaces (`response_group_instances`, re-keyed `answer_selected_options`), immutability on all new
columns/tables, types regenerated. Write `docs/reviews/answer-model-v2-review.md` (APPROVED / CHANGES REQUESTED).

### 4. Human approval → 5. Record (lead)
On approval: flip the PROGRESS.md phase-status row to ✅ (date, commit); rotate this phase's task detail into a
`docs/progress/` pointer; **update the current-state docs that were deliberately deferred**:
- `ARCHITECTURE.md` **Rule 2 canonical schema** — the new `answers` columns, the re-keyed
  `answer_selected_options`, the new `response_group_instances` table, `form_items.parent_item_id`/`default_value`.
- `docs/backend-state.md` — new migration-table rows, the changed RPCs, the `sync_answer_typed_values` trigger,
  the new HC080 code, updated pgTAP/Vitest totals (**1202 / 176**).

Then the **re-squash 2→1** into a fresh single baseline (as form-model-normalization did) + the **user-run remote
`supabase db push`** (or full remote reset — pre-launch, `prelaunch-db-reset-ok`). Commit `phase(answer-model-v2):
complete — …`. Keep the team warm; full cleanup at project end.

## Teammate context (for re-spawns on the new machine)
Teammates do NOT share the lead's conversation and start fresh on a new machine — re-spawn `tester`, then `qa`,
with task-specific prompts (they can read this handoff + the plan + PROGRESS.md rows). The `backend`/`frontend`
work is complete for this package; only re-spawn them if the tester finds a bug (backend owns `supabase/**` +
`src/lib/{queries,forms,responses,types}`; frontend owns `src/app/**` + `src/components/**`; never both edit the
same file in a phase; shared types change only via backend).

# Result-based phase recommendation — `recommend_when` answer/result groups (✅ COMPLETE 2026-06-26)

> Kicked off 2026-06-26 (human-directed, post design-interview); finished same day
> across a machine handoff. `recommend_when` becomes a combinable group of answer-
> and/or result-conditions; a phase can be recommended from an EARLIER phase's
> RESULT (specific option or `adverse`), mixed freely with answer-conditions under
> TODAS/QUALQUER. Suggestion-only (the `recommended` flag); zero `eval_condition`
> drift (synthetic-map reuse). Locked design: ADR
> [0043](../decisions/0043-phase-result-based-recommendation.md). QA review:
> [docs/reviews/result-rec-review.md](../reviews/result-rec-review.md) — **APPROVED**.

## Handoff note (historical)

Work was started on another machine: the WIP commit `6c5baeb` landed backend
BR1–BR3 (types + migration `20260630000004` + regenerated `database.ts`) but paused
mid-BR4 before any lead verification. On resume the lead verified the backend
(`supabase db reset` replays all migrations incl. `20260630000004` cleanly;
`database.ts` matches `gen types`; typecheck + lint clean), completed BR4, then ran
the frontend and tester to gate. A pre-existing anon-EXECUTE leak from the unrelated
referral snapshot (`37584f4`, `snap_referral_commission_names`) tripped
`100_dashboard` test 19 and was closed by forward-only revoke migration
`20260630000005` (user-approved). A stale `cases-extras` AC-Docs locator (the
doc-upload trigger button was renamed "Enviar documento"→"Anexar" by the same
`37584f4` snapshot) was fixed in-spec along the way.

## Backend (`backend`)

| # | Task | Status |
| - | ---- | ------ |
| BR1 | **Contract-first** — `conditions.ts` (`RecommendGroup` + result-condition types, superset of `RecommendWhen`, legacy single valid; `evalRecommendation(rule,resolve)` mirror; reserved keys `__phase_result__`/`__phase_result_adverse__`) + type-only widen in `process-templates.ts`; `actions.ts` passthrough unchanged. | ✅ done (`6c5baeb`) |
| BR2 | Migration `supabase/migrations/20260630000004_recommend_when_result_source.sql` (728 lines): both CHECKs widened via `app.is_valid_recommend_when`; `is_valid_recommend_cond`, `recommend_when_conditions`, group-aware `validate_template_recommend_when` (HC063 non-emitting source · HC064 id ∉ allowed-set), group-walk `recompute_recommendations` (synthetic-map result eval), `set_case_phase_result_override` (+recompute), `create_case_from_template` (group-aware inline fix). | ✅ applies clean on `db reset` (lead-verified); remote `db push` PENDING (human) |
| BR3 | `database.ts` regenerated. | ✅ matches `gen types` regen; typecheck + lint green (lead-verified) |
| BR4 | pgTAP `161_recommend_result_source.sql` (20 assertions) + `recommendation.test.ts` (32, `evalRecommendation` mirror + no-drift). Plus forward-only revoke migration `20260630000005` (unrelated referral anon-leak fix). | ✅ done (`333085a`) — full pgTAP 1122/1122 + Vitest 164/164 |

## Frontend (`frontend`, `aebe7cdff7d0fbfad` / `a20b5bd87cf9c7014`)

| # | Task | Status |
| - | ---- | ------ |
| FR1 | Rebuild `src/components/process-templates/recommend-when-editor.tsx` into a group builder (mirror `condition-builder.tsx`): TODAS/QUALQUER toggle, add/remove rows, per-row source toggle (Resposta de fase / Resultado de fase — result hidden when `!phaseResultsEnabled`), source-phase picker filtered by source type, value control (answer = existing; result = specific-id `equals/not_equals/in` OR `adverso` true/false), per-row live preview via `evalRecommendation`, `not_equals` footgun warning. Build against BR1 types. | ✅ done (`f4c8b9a`) — typecheck/lint 0 errors; smoke-verified |
| FR2 | Wire `phase-slot-dialog.tsx` (serialized `recommendWhen` field already exists) + pass `phaseResults` + `phaseResultsEnabled` (already on the slot card) into the editor; derive each source phase's emittable results from `allowedResultIds` × `phaseResults`. typecheck/lint/build + preview smoke. | ✅ done (`f4c8b9a`) — dialog passes new props; smoke confirmed result options render by label, live preview fires correctly |

## Tester (`tester`, `a5775c724f7eaab9c`) — gate

| # | Task | Status |
| - | ---- | ------ |
| TR1 `[gate]` | E2E — author a process with a result-based + a mixed answer/result recommendation; run a case; assert the downstream phase flips `recommended` when the source result matches (specific + adverse paths) and not otherwise; a post-conclusion result override re-flips it. | ✅ **GATE GREEN (lead-declared 2026-06-26)** — `e2e/recommend-result.spec.ts` 9/9 (`c2e90bb`) + **full E2E 431 passed / 0 failed / 4 known skips** (chromium, `--workers=1`, fresh `db reset`) + **full pgTAP 1122/1122** + Vitest 164/164 + typecheck/lint clean. First full run had 2 transient flakes (`form-builder-enhancements:669` colour-picker — passes isolated; `cases-extras:341` AC-Docs — stale `37584f4` locator, fixed) + 12-did-not-run instability; the clean re-run is 431/0. |

## §6 gate

1. Build ✅ · 2. Test pass ✅ (lead-declared) · 3. QA review ✅ **APPROVED** (2026-06-26,
[report](../reviews/result-rec-review.md)) · 4. Human approval ✅ (2026-06-26) ·
5. Record ✅ (this file + PROGRESS.md row).

**Open follow-up:** remote `supabase db push` of `20260630000004` + `20260630000005`
is still **PENDING** (human-run; background agents can't deploy to remote).

# F-cleanup — residual DB-hardening (durable record)

> Rotated out of PROGRESS.md at the Record step (lead-playbook §5). Branch `f-cleanup` (off
> `main`), 2026-07-12. Reset-OK / pre-pilot. **Local-only; not merged; remote deploy folds into
> the pilot reset.** Plans: [f-cleanup.md](../plans/f-cleanup.md) · [f-cleanup-d11.md](../plans/f-cleanup-d11.md).
> ADRs: [0068](../decisions/0068-result-engine-fk-junctions.md) (D3) · [0069](../decisions/0069-status-key-anglicization.md) (D11).
> QA: [f-cleanup-review.md](../reviews/f-cleanup-review.md).

F-cleanup is the last residual-hardening item of the Pre-Pilot Foundations Program (audit **D3** +
**WS-8** D8/D10/D11). The PO chose the **full** D11 (all 12 status enums), so this pass = D3-mid +
D10 + D8 + D11.

## What shipped (8 migrations `20260719000000`–`…000800`)

- **D3 — result-engine jsonb/array → FK-backed junctions (`…000000`).** The un-FK'd
  `allowed_result_ids` jsonb arrays became three junctions: `process_template_phase_allowed_results`,
  `process_template_phase_offered_results` (FK-integrity shadow = allowed ∪ ruleset refs ∪ default),
  `case_phase_allowed_results`. RLS from creation mirroring parents (member/`can_read_case` read;
  `is_staff_admin_of`/`is_commission_admin_of` write). `result_ruleset` **stays jsonb** — the
  evaluator `compute_case_phase_result` is UNCHANGED (Rule 3); `blocks` **stays `integer[]`** (no
  dangling-UUID risk, atomic reorder untouched). RPC signatures UNCHANGED (`add_/update_template_phase`,
  `create_case_from_template`, `set_case_phase_result_override` decompose jsonb→junction internally);
  the query layer re-aggregates to `allowedResultIds: string[]` ⇒ **zero frontend change**. Dropped
  the two `allowed_result_ids` columns + their `*_allowed_shape` CHECKs. New helpers
  `commission_of_template_phase` / `case_of_case_phase` / `recompute_template_phase_offered_results`.
- **D10 — uniform `updated_at` (`…000200`).** Generic `app.touch_updated_at()` + `updated_at` column
  and BEFORE-UPDATE trigger on `cases` / `commissions` / `forms`. Metadata — not audited (Rule 11).
- **D8 — forward-FK lock.** No schema change; a pgTAP regression lock (`211`) asserting the two
  Phase-15 indicator FKs still exist and that `capa_plan.source_audit_finding_id` stays intentionally
  FK-less (add the FK at Phase 18). All other forward-compat cols are already FK'd/intentional.
- **D11 — anglicize all 12 status-enum internal keys → English (`…000300`–`…000800`).** 1:1,
  semantics identical, in 6 coupled-group migrations (cheapest-first; the `cases`↔`case_phases`
  recompute-coupled pair as one migration). Keys changed in CHECKs, defaults, function bodies, seed,
  pgTAP fixtures, hand-written TS unions, and label/visual **map keys**; pt-BR label **values** kept
  (Rule 10). Enums: `indicators` · `meeting_attendees.attendance` · `case_narratives` ·
  `indicator_measurements` (its RPC output cols na_meta/fora_da_meta/sem_dados → on_target/off_target/no_data)
  · `capa_action` · `case_interviews` · `capa_plan` · `controlled_documents(+_versions)` ·
  `case_referral` · `meetings` · `cases` · `case_phases`. Method: programmatic catalog rewrite
  (`pg_proc`/`pg_index` scoped `replace`), function-scoped for shared literals. Dictionary + per-group
  method + SHARED-LITERAL REGISTRY → [f-cleanup-d11.md](../plans/f-cleanup-d11.md).

## Gate

- **pgTAP 2100 / 86 files / 0 fail** (fresh reset, full ordered). New locks: `210` (D3 keystone incl.
  the HC067 re-enforcement), `211` (D8/D10), `212`–`222` (D11 per-group).
- whole-project **`tsc` 0**, **lint 0**, **vitest 356**, **`next build`** success.
- **Full standalone-prod E2E: all 51 specs green.** Runs: initial full gate 555p/2f → both fixed →
  final full gate 572p/1f → the 1 (`administrativo`) fixed → isolation-confirmed. The gate caught **3
  stale test assertions** (below); **0 app or schema regressions** — every failure was a test asserting
  on an old status key.
- **QA ✅ APPROVED** (0 Blocker / 0 Major / 2 Minor / 3 Info). D3 RLS confirmed leak-free, evaluator
  unchanged, column-drop safe (all 6 dependent functions traced); D11 a faithful 1:1 rename.

## QA Minor-1 — re-enforced (not deferred)

D3's dropped `*_allowed_shape` CHECK had guaranteed "a non-emitting phase has no allowed results."
Per the PO decision, re-enforced (rather than accepted as an inert relaxation): a guard in
`add_template_phase` / `update_template_phase` (evaluated on the *resulting* state, covering the
emits→false transition) and the `create_case_from_template` snapshot, raising new errcode **HC067**.
Verified: the frontend never sends the now-rejected state (`parseAllowedResultIds` sends NULL when
non-emitting), so HC067 is pure DB-layer defense — no app-code change. +6 pgTAP (NEG/POS both sides).

## Process learning — e2e completeness (for future D11-style renames)

The tester's grep-based e2e pass missed status keys in two forms that a quoted-key grep can't see —
**error-body interpolation** (`body.message` embedding the key, e.g. HC049 → `capa:569`) and
**template-literal composites** (`` `ativa:${uid}` `` in `administrativo.spec.ts`, a spec that wasn't
even on the SITE MAP). Both were caught by the full E2E gate (not by `tsc`, which can't see runtime
string comparisons), fixed, and a latent sibling (`perf-sweep` P3) hardened. **Lesson:** for a
status-key rename, the authoritative e2e sweep must grep backtick/template-literal and
error-message-interpolation forms across the WHOLE `e2e/` tree, not just the SITE-MAP files — and the
full prod E2E gate is the only reliable detector.

## Remaining / deferred

- **Info fast-follows (non-blocking):** the HC049 *diagnostic* error body now echoes the English key
  (the UI still renders pt-BR labels — cosmetic); `210` covers the cross-commission NEG indirectly.
- **Not merged / remote-deferred:** committed to `f-cleanup` for human review; the remote deploy folds
  into the pilot reset (one `db reset --linked` landing F1 + F2 + F3 + F-cleanup).
- Next pre-pilot work: **Phase 16** (Standards Crosswalk — deferred, needs replanning), then the pilot.
